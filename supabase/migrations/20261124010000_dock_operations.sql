-- With Dock uses a shared customer across engagements. Existing project IDs remain stable.
begin;
set local search_path = public, pg_temp;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtext('withdock-v1-20261124'));
do $$ begin
  if not exists (select 1 from tm_workspaces where id='00000000-0000-4000-8000-000000000005'
    and lower(trim(name))='with dock') then raise exception 'With Dock workspace missing. Verify project.'; end if;
end $$;


create table if not exists dock_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  stage text not null default 'lead' check (stage in ('lead','negotiation','active')),
  summary text not null default '', next_action text not null default '',
  prefecture text, address text, email text, phone text, history_url text,
  created_at timestamptz not null default now()
);
alter table tm_projects add column if not exists dock_customer_id uuid references dock_customers;
do $$ begin
 alter table tm_projects add constraint dock_project_workspace check
  (dock_customer_id is null or workspace_id = '00000000-0000-4000-8000-000000000005');
exception when duplicate_object then null; end $$;
create index if not exists dock_projects_by_customer on tm_projects(dock_customer_id);

create table if not exists dock_contracts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references tm_projects,
  legal_name text not null, scope text not null default '', free_support_terms text,
  kind text not null check (kind in ('one_off','recurring')),
  starts_on date, ends_on date, check (ends_on >= starts_on)
);
create table if not exists dock_payments (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references dock_contracts,
  label text not null, amount numeric(14,0) not null check (amount > 0),
  due_on date not null, certainty text not null check (certainty in ('confirmed','estimated')),
  received_on date, received_amount numeric(14,0) check (received_amount > 0),
  check ((received_on is null) = (received_amount is null))
);
create table if not exists dock_monthly_targets (
  month date not null check (extract(day from month)=1),
  kind text not null check (kind in ('one_off','recurring')),
  amount numeric(14,0) not null check (amount >= 0), primary key (month,kind)
);
create table if not exists dock_history (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references dock_customers,
  body text not null, source_url text, actor text not null, created_at timestamptz not null default now()
);
create table if not exists dock_steps (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references tm_projects,
  title text not null, position integer not null, starts_on date, due_on date, completed_on date,
  check (due_on >= starts_on)
);
create table if not exists dock_proposals (
  id uuid primary key, kind text not null check (kind in ('customer','project','task','improvement')),
  title text not null, quote text not null, meeting_key text not null, meeting_title text not null,
  meeting_date date, proposed jsonb not null, confidence text,
  state text not null default 'pending' check (state in ('pending','held','approved','archived')),
  previous_state text, version integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists dock_improvements (
  id uuid primary key default gen_random_uuid(), title text not null, detail text not null,
  proposal_id uuid unique references dock_proposals, task_id uuid references tm_tasks,
  created_at timestamptz not null default now()
);
create table if not exists dock_review_events (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references dock_proposals,
  actor text not null, before_state text not null, after_state text not null, changes jsonb not null,
  created_at timestamptz not null default now()
);
-- The board's server authenticates the caller; PostgREST clients cannot access these relations.
do $$
declare relation text;
begin
  foreach relation in array array['dock_customers','dock_contracts','dock_payments','dock_monthly_targets',
    'dock_history','dock_steps','dock_proposals','dock_improvements','dock_review_events'] loop
    execute format('alter table %I enable row level security', relation);
    execute format('revoke all on %I from public, anon, authenticated', relation);
    execute format('grant select, insert, update, delete on %I to service_role', relation);
  end loop;
end $$;

-- Review and its business write commit together. Retrying a stale card cannot apply twice.
create or replace function dock_review(pid uuid, expected_version integer, decision text, actor_id text, edit jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
declare p dock_proposals; dest uuid; cust uuid; next_state text; caption text;
        dock constant uuid := '00000000-0000-4000-8000-000000000005';
begin
  if not exists (select 1 from tm_workspace_members where workspace_id=dock and member_id=actor_id) then
    raise exception 'not a team member';
  end if;
  select * into strict p from dock_proposals where id=pid for update;
  if p.version is distinct from expected_version or p.state='approved' then raise exception 'stale proposal'; end if;
  if decision='restore' and p.state='archived' then next_state:=coalesce(p.previous_state,'pending');
  elsif p.state='archived' then raise exception 'archived proposal';
  elsif decision in ('held','archived','approved','pending') then next_state:=decision;
  else raise exception 'invalid decision'; end if;
  caption := nullif(btrim(edit->>'title'),'');
  if decision='approved' then
    if caption is null then raise exception 'title required'; end if;
    cust:=nullif(edit->>'customer','')::uuid;
    dest:=nullif(edit->>'project','')::uuid;
    if dest is not null and not exists(select 1 from tm_projects where id=dest and workspace_id=dock and not archived)
      then raise exception 'invalid project'; end if;
    case p.kind
      when 'customer' then
        if cust is null then
          insert into dock_customers(name,summary) values(nullif(btrim(edit->>'name'),''),caption) returning id into cust;
        end if;
        insert into dock_history(customer_id,body,source_url,actor) values(cust,caption,'https://withdock-workspace.vercel.app/#meetings/'||p.meeting_key,actor_id);
      when 'project' then
        if cust is null then raise exception 'customer required'; end if;
        if dest is null then
          insert into tm_projects(title,workspace_id,phase,category,dock_customer_id) values(caption,dock,'production','system',cust);
        else
          update tm_projects set detail=concat_ws(E'\n',nullif(detail,''),caption),dock_customer_id=cust
            where id=dest and (dock_customer_id is null or dock_customer_id=cust);
          if not found then raise exception 'project belongs to a different customer'; end if;
        end if;
      when 'task' then
        if dest is null or not exists(select 1 from tm_workspace_members where workspace_id=dock and member_id=edit->>'owner')
          then raise exception 'project and team owner required'; end if;
        insert into tm_tasks(title,workspace_id,project_id,owner_id,due_date,category)
          select caption,dock,dest,edit->>'owner',(edit->>'due')::date,category from tm_projects where id=dest;
      when 'improvement' then
        insert into dock_improvements(title,detail,proposal_id) values(caption,p.quote,pid);
    end case;
  end if;
  update dock_proposals set state=next_state,version=version+1,
    previous_state=case when next_state='archived' then p.state end where id=pid;
  insert into dock_review_events(proposal_id,actor,before_state,after_state,changes) values(pid,actor_id,p.state,next_state,edit);
end $$;
revoke all on function dock_review(uuid,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function dock_review(uuid,integer,text,text,jsonb) to service_role;

insert into tm_workspace_members (workspace_id,member_id)
  select '00000000-0000-4000-8000-000000000005', id from tm_members where id='goda'
  on conflict do nothing;

notify pgrst, 'reload schema';
commit;
select 'WITH DOCK DB ready' as result,
  (select count(*) from tm_workspace_members where workspace_id='00000000-0000-4000-8000-000000000005') as team_members;
