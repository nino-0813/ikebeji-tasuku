begin;
set local search_path = public, pg_temp;
set local lock_timeout = '5s';

alter table tm_projects
  add column dock_owner_ids text[] not null default '{}',
  add column dock_finish_on date,
  add column dock_preview_url text,
  add column dock_deployment_url text,
  add column dock_archived_on date,
  add column dock_archive_reason text,
  add column dock_archive_support text check (dock_archive_support in ('continue','end','none'));

alter table dock_steps add column owner_id text references tm_members;
alter table dock_proposals add column project_id uuid references tm_projects;
with recorded as (
  select distinct on (e.proposal_id) e.proposal_id,p.id as project_id
    from dock_review_events e join tm_projects p on p.id::text=e.changes->>'project'
    where p.workspace_id='00000000-0000-4000-8000-000000000005'
    order by e.proposal_id,e.created_at desc,e.id desc
)
update dock_proposals d set project_id=r.project_id from recorded r where d.id=r.proposal_id;
alter table dock_history add column source_kind text check (source_kind in ('manual','meeting','ai'));
alter table dock_improvements
  add column expected_effect text,
  add column review_on date,
  add column review_result text;
alter table dock_customers
  add column forecast_amount numeric(14,0) check (forecast_amount > 0),
  add column forecast_month date check (extract(day from forecast_month) = 1),
  add column forecast_confidence text check (forecast_confidence in ('low','medium','high'));

create table dock_permissions (
  member_id text primary key references tm_members,
  view_finance boolean not null default true,
  edit_finance boolean not null default true,
  edit_operations boolean not null default true,
  approve_proposals boolean not null default true,
  check (view_finance or not edit_finance)
);

create table dock_sync_runs (
  id text primary key,
  finished_at timestamptz not null default now(),
  succeeded boolean not null,
  item_count integer not null check (item_count >= 0)
);
create index dock_sync_runs_latest on dock_sync_runs(finished_at desc);

create table dock_receipts (
  id uuid primary key,
  payment_id uuid not null references dock_payments,
  received_on date not null,
  amount numeric(14,0) not null check (amount > 0)
);
create index dock_receipts_payment on dock_receipts(payment_id);
create index dock_receipts_received on dock_receipts(received_on);
insert into dock_receipts (id,payment_id,received_on,amount)
  select id,id,received_on,received_amount from dock_payments where received_on is not null
  on conflict (id) do nothing;

create table dock_recurring_rates (
  contract_id uuid not null references dock_contracts,
  effective_on date not null,
  amount numeric(14,0) not null check (amount >= 0),
  day_of_month integer not null check (day_of_month between 1 and 31),
  primary key (contract_id,effective_on)
);
alter table dock_payments add column recurring_month date;
create unique index dock_payments_recurring_month
  on dock_payments(contract_id,recurring_month);

alter table dock_permissions enable row level security;
alter table dock_receipts enable row level security;
alter table dock_recurring_rates enable row level security;
alter table dock_sync_runs enable row level security;

do $$
declare relation text;
begin
  foreach relation in array array['dock_permissions','dock_receipts','dock_recurring_rates','dock_sync_runs'] loop
    execute format('revoke all on %I from public, anon, authenticated', relation);
    execute format('grant select, insert, update, delete on %I to service_role', relation);
  end loop;
end $$;

-- Keep one receipt for writes made by the earlier app during deployment.
create function dock_mirror_legacy_receipt() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.received_on is not null then
    if not exists (select 1 from dock_receipts where id=new.id)
       and (select coalesce(sum(amount),0) from dock_receipts where payment_id=new.id) + new.received_amount > new.amount
       and exists (select 1 from dock_receipts where payment_id=new.id)
      then raise exception 'receipt exceeds remaining balance'; end if;
    insert into dock_receipts(id,payment_id,received_on,amount)
    values(new.id,new.id,new.received_on,new.received_amount)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
create trigger dock_mirror_legacy_receipt
after insert or update of received_on,received_amount on dock_payments
for each row execute function dock_mirror_legacy_receipt();

create function dock_record_receipt(
  payment uuid, receipt uuid, received date, value numeric
) returns void language plpgsql set search_path = public, pg_temp as $$
declare planned numeric; linked dock_receipts;
begin
  select p.amount into strict planned from dock_payments p
    join dock_contracts c on c.id=p.contract_id
    join tm_projects j on j.id=c.project_id
    where p.id=payment and j.workspace_id='00000000-0000-4000-8000-000000000005'
    for update of p;
  select * into linked from dock_receipts where id=receipt;
  if found then
    if linked.payment_id=payment and linked.received_on=received and linked.amount=value then return; end if;
    raise exception 'receipt request already used';
  end if;
  if value is null or value <> trunc(value) or value <= 0 or received is null
    or (select coalesce(sum(amount),0) from dock_receipts where payment_id=payment) + value > planned
    then raise exception 'invalid receipt amount or date'; end if;
  insert into dock_receipts(id,payment_id,received_on,amount) values(receipt,payment,received,value);
end $$;
revoke all on function dock_record_receipt(uuid,uuid,date,numeric) from public, anon, authenticated;
grant execute on function dock_record_receipt(uuid,uuid,date,numeric) to service_role;

-- A projected monthly row becomes a payment only when recording its receipt.
-- Existing manual schedules take precedence, and paid months are immutable here.
create function dock_check_payment_month() returns trigger language plpgsql
set search_path = public, pg_temp as $$
declare category text;
begin
  select kind into category from dock_contracts where id=new.contract_id for update;
  if category='recurring' and exists (
    select 1 from dock_payments p where p.contract_id=new.contract_id
      and p.due_on>=date_trunc('month',new.due_on)::date
      and p.due_on<date_trunc('month',new.due_on)+interval '1 month'
      and p.id<>new.id and (p.recurring_month is not null or new.recurring_month is not null)
  ) then raise exception 'payment already scheduled for the month'; end if;
  return new;
end $$;
create trigger dock_check_payment_month before insert on dock_payments
for each row execute function dock_check_payment_month();

create function dock_recurring_payment(
  contract uuid, period date
) returns uuid language plpgsql set search_path = public, pg_temp as $$
declare c dock_contracts; due date; monthly_amount numeric; result uuid; archive_end date;
begin
  select dc.* into strict c from dock_contracts dc
    join tm_projects j on j.id=dc.project_id
    where dc.id=contract and dc.kind='recurring'
    and j.workspace_id='00000000-0000-4000-8000-000000000005'
    for update of dc;
  if period is null or period is distinct from date_trunc('month',period)::date then raise exception 'invalid month'; end if;
  select id into result from dock_payments
    where contract_id=contract and recurring_month=period;
  if found then return result; end if;
  if exists(select 1 from dock_payments where contract_id=contract and due_on>=period
    and due_on<period+interval '1 month') then raise exception 'payment already scheduled manually'; end if;
  select dock_archived_on into archive_end from tm_projects
    where id=c.project_id and archived and dock_archive_support in ('end','none');
  with rules as (
    select amount,effective_on,lead(effective_on) over (order by effective_on) as next_effective,
      period+(least(day_of_month,extract(day from period+interval '1 month - 1 day')::integer)-1) as candidate
    from dock_recurring_rates where contract_id=contract
  )
  select candidate,amount into due,monthly_amount from rules
    where amount>0 and candidate>=effective_on and (next_effective is null or candidate<next_effective)
      and (c.starts_on is null or candidate>=c.starts_on) and (c.ends_on is null or candidate<=c.ends_on)
      and (archive_end is null or candidate<=archive_end)
    order by candidate limit 1;
  if not found then raise exception 'no scheduled payment'; end if;
  insert into dock_payments(contract_id,label,amount,due_on,certainty,recurring_month)
  values(contract,'継続支援費',monthly_amount,due,'confirmed',period) returning id into result;
  return result;
end $$;
revoke all on function dock_recurring_payment(uuid,date) from public, anon, authenticated;
grant execute on function dock_recurring_payment(uuid,date) to service_role;

create function dock_register_project(entry jsonb)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare result uuid; customer uuid := (entry->>'dock_customer_id')::uuid;
begin
  perform 1 from dock_customers where id=customer for update;
  if not found or entry->>'workspace_id' is distinct from '00000000-0000-4000-8000-000000000005'
    then raise exception 'invalid customer or workspace'; end if;
  insert into tm_projects(id,title,detail,client_name,client_website,dock_customer_id,
    phase,category,workspace_id,dock_owner_ids,dock_finish_on,dock_preview_url,dock_deployment_url)
  select id,title,detail,client_name,client_website,dock_customer_id,
    phase,category,workspace_id,dock_owner_ids,dock_finish_on,dock_preview_url,dock_deployment_url
    from jsonb_populate_record(null::tm_projects,entry)
    on conflict (id) do nothing returning id into result;
  if result is null then
    select id into strict result from tm_projects where id=(entry->>'id')::uuid
      and dock_customer_id=customer and workspace_id='00000000-0000-4000-8000-000000000005';
    return result;
  end if;
  update dock_customers set stage='active',
    prefecture=coalesce(prefecture,nullif(entry->>'prefecture','')),
    address=coalesce(address,nullif(entry->>'address','')),
    email=coalesce(email,nullif(entry->>'email','')),
    phone=coalesce(phone,nullif(entry->>'phone',''))
    where id=customer;
  return result;
end $$;
revoke all on function dock_register_project(jsonb) from public, anon, authenticated;
grant execute on function dock_register_project(jsonb) to service_role;

create function dock_apply_receipt(payment uuid, contract uuid, period date, receipt uuid, received date, value numeric)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  perform dock_record_receipt(coalesce(payment,dock_recurring_payment(contract,period)),receipt,received,value);
end $$;
revoke all on function dock_apply_receipt(uuid,uuid,date,uuid,date,numeric) from public, anon, authenticated;
grant execute on function dock_apply_receipt(uuid,uuid,date,uuid,date,numeric) to service_role;

create function dock_create_customer(entry jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext(lower(btrim(entry->>'name'))));
  if exists(select 1 from dock_customers where lower(btrim(name))=lower(btrim(entry->>'name')))
    then raise exception 'select existing customer'; end if;
  insert into dock_customers(name,stage,summary,next_action)
    select name,stage,summary,next_action from jsonb_populate_record(null::dock_customers,entry);
end $$;
revoke all on function dock_create_customer(jsonb) from public, anon, authenticated;
grant execute on function dock_create_customer(jsonb) to service_role;

create function dock_assign_customer(project uuid, customer uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare current_phase text;
begin
  update tm_projects set dock_customer_id=customer where id=project
    and workspace_id='00000000-0000-4000-8000-000000000005' returning phase into strict current_phase;
  if current_phase in ('production','maintenance') then update dock_customers set stage='active' where id=customer; end if;
end $$;
revoke all on function dock_assign_customer(uuid,uuid) from public, anon, authenticated;
grant execute on function dock_assign_customer(uuid,uuid) to service_role;

create function dock_update_customer(customer uuid, entry jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  if entry->>'stage' <> 'active' and exists(
    select 1 from tm_projects where dock_customer_id=customer and phase in ('production','maintenance') and not archived
  ) then raise exception 'customer has active projects'; end if;
  update dock_customers set stage=entry->>'stage', summary=entry->>'summary',
    next_action=entry->>'next_action', history_url=entry->>'history_url' where id=customer;
  if not found then raise exception 'unknown customer'; end if;
  if nullif(btrim(entry->>'note'),'') is not null then
    insert into dock_history(id,customer_id,body,source_url,actor,source_kind)
      values((entry->>'request')::uuid,customer,entry->>'note',entry->>'source_url',entry->>'actor',entry->>'source_kind')
      on conflict (id) do nothing;
  end if;
end $$;
revoke all on function dock_update_customer(uuid,jsonb) from public, anon, authenticated;
grant execute on function dock_update_customer(uuid,jsonb) to service_role;

create function dock_update_project(project uuid, entry jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
declare customer uuid;
begin
  update tm_projects p set title=e.title,phase=e.phase,detail=e.detail,client_name=e.client_name,
     dock_finish_on=e.dock_finish_on,dock_owner_ids=e.dock_owner_ids
    from jsonb_populate_record(null::tm_projects,entry) e
    where p.id=project and p.workspace_id='00000000-0000-4000-8000-000000000005'
      and not p.archived and (p.phase<>'sales' or e.phase='sales' or p.dock_customer_id is not null)
    returning p.dock_customer_id into strict customer;
  if entry->>'phase' in ('production','maintenance') then update dock_customers set stage='active' where id=customer; end if;
end $$;
revoke all on function dock_update_project(uuid,jsonb) from public, anon, authenticated;
grant execute on function dock_update_project(uuid,jsonb) to service_role;

create or replace function dock_review(pid uuid, expected_version integer, decision text, actor_id text, edit jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
declare p dock_proposals; dest uuid; cust uuid; next_state text; caption text;
        dock constant uuid := '00000000-0000-4000-8000-000000000005';
begin
  if not exists (select 1 from tm_workspace_members where workspace_id=dock and member_id=actor_id) then
    raise exception 'not a team member';
  end if;
  if coalesce((select not approve_proposals from dock_permissions where member_id=actor_id),false)
    then raise exception 'not permitted to approve'; end if;
  select * into strict p from dock_proposals where id=pid for update;
  if p.version is distinct from expected_version or p.state='approved' then raise exception 'stale proposal'; end if;
  if decision='restore' and p.state='archived' then next_state:=coalesce(p.previous_state,'pending');
  elsif p.state='archived' then raise exception 'archived proposal';
  elsif decision in ('held','archived','approved','pending') then next_state:=decision;
  else raise exception 'invalid decision'; end if;
  caption := nullif(btrim(edit->>'title'),'');
  dest:=nullif(edit->>'project','')::uuid;
  if dest is not null and not exists(select 1 from tm_projects where id=dest and workspace_id=dock and not archived)
    then raise exception 'invalid project'; end if;
  if decision='approved' then
    if caption is null then raise exception 'title required'; end if;
    cust:=nullif(edit->>'customer','')::uuid;
    case p.kind
      when 'customer' then
        if cust is null then
          perform pg_advisory_xact_lock(hashtext(lower(btrim(edit->>'name'))));
          if exists(select 1 from dock_customers where lower(btrim(name))=lower(btrim(edit->>'name')))
            then raise exception 'select existing customer'; end if;
          insert into dock_customers(name,summary) values(nullif(btrim(edit->>'name'),''),caption) returning id into cust;
        end if;
        insert into dock_history(customer_id,body,source_url,actor,source_kind) values(cust,caption,coalesce(p.proposed->>'source_url','https://withdock-workspace.vercel.app/#meetings/'||p.meeting_key),actor_id,'ai');
      when 'project' then
        if cust is null then raise exception 'customer required'; end if;
        if dest is null then
          insert into tm_projects(title,workspace_id,phase,category,dock_customer_id) values(caption,dock,'production','system',cust) returning id into dest;
        else
          update tm_projects set detail=concat_ws(E'\n',nullif(detail,''),caption),dock_customer_id=cust
            where id=dest and (dock_customer_id is null or dock_customer_id=cust);
          if not found then raise exception 'project belongs to a different customer'; end if;
        end if;
        update dock_customers set stage='active' where id=cust;
      when 'task' then
        if dest is null or not exists(select 1 from tm_workspace_members where workspace_id=dock and member_id=edit->>'owner')
          then raise exception 'project and team owner required'; end if;
        insert into tm_tasks(title,detail,workspace_id,project_id,owner_id,due_date,category)
          select caption,concat_ws(E'\n',p.meeting_title,p.quote,
            coalesce(p.proposed->>'source_url','https://withdock-workspace.vercel.app/#meetings/'||p.meeting_key)),
            dock,dest,edit->>'owner',(edit->>'due')::date,category from tm_projects where id=dest;
        select dock_customer_id into cust from tm_projects where id=dest;
      when 'improvement' then
        insert into dock_improvements(title,detail,proposal_id) values(caption,p.quote,pid);
    end case;
    if p.kind in ('project','task') and cust is not null then
      insert into dock_history(customer_id,body,source_url,actor,source_kind)
        values(cust,caption,coalesce(p.proposed->>'source_url','https://withdock-workspace.vercel.app/#meetings/'||p.meeting_key),actor_id,'ai');
    end if;
  end if;
  update dock_proposals set state=next_state,version=version+1,project_id=coalesce(dest,p.project_id),
    previous_state=case when next_state='archived' then p.state end where id=pid;
  insert into dock_review_events(proposal_id,actor,before_state,after_state,changes) values(pid,actor_id,p.state,next_state,edit);
end $$;
revoke all on function dock_review(uuid,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function dock_review(uuid,integer,text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
