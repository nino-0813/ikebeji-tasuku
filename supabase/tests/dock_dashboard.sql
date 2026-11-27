-- Run after both Dock migrations against an isolated test database.
begin;
do $$
declare
  dock constant uuid := '00000000-0000-4000-8000-000000000005';
  actor constant text := 'ninomiya';
  cust uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  contract_id uuid := gen_random_uuid();
  recurring_contract uuid := gen_random_uuid();
  revised_contract uuid := gen_random_uuid();
  invoice uuid := gen_random_uuid();
  receipt_id uuid := gen_random_uuid();
  proposal uuid := gen_random_uuid();
  recurring_invoice uuid;
  rejected boolean;
begin
  insert into dock_customers(id,name,stage) values(cust,'SQL検証用顧客','negotiation');
  rejected := false;
  begin
    perform dock_create_customer('{"name":" SQL検証用顧客 ","stage":"lead","summary":"","next_action":""}');
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'duplicate customer accepted'; end if;
  perform dock_register_project(jsonb_build_object(
    'id',job,'title','SQL検証用案件','phase','production','category','system',
    'dock_customer_id',cust,'workspace_id',dock,'dock_owner_ids',array[actor],
    'prefecture','東京都','address','検証用住所'
  ));
  perform dock_register_project(jsonb_build_object(
    'id',job,'title','SQL検証用案件','phase','production','category','system',
    'dock_customer_id',cust,'workspace_id',dock,'dock_owner_ids',array[actor]
  ));
  if not exists(select 1 from dock_customers where id=cust and stage='active' and prefecture='東京都')
    then raise exception 'customer information or lifecycle lost'; end if;
  insert into tm_projects(id,title,category,workspace_id)
    values(other,'他ワークスペース検証','system','00000000-0000-4000-8000-000000000001');
  perform dock_update_project(job,'{"title":"SQL検証用案件 更新","phase":"production","dock_owner_ids":["ninomiya"]}');
  if not exists(select 1 from tm_projects where id=job and title='SQL検証用案件 更新')
    then raise exception 'project update failed'; end if;
  insert into dock_contracts(id,project_id,legal_name,kind) values
    (contract_id,job,'SQL検証用契約','one_off'),
    (recurring_contract,job,'SQL検証用月額契約','recurring'),
    (revised_contract,job,'SQL検証用月額改定','recurring');
  insert into dock_payments(id,contract_id,label,amount,due_on,certainty)
    values(invoice,contract_id,'制作費',1000000,'2026-11-30','confirmed');
  perform dock_apply_receipt(invoice,null,null,receipt_id,'2026-11-27',600000);
  perform dock_apply_receipt(invoice,null,null,receipt_id,'2026-11-27',600000);
  if (select amount - (select sum(r.amount) from dock_receipts r where r.payment_id=invoice)
      from dock_payments where id=invoice) <> 400000 then raise exception 'wrong remaining balance'; end if;
  rejected := false;
  begin
    perform dock_apply_receipt(invoice,null,null,gen_random_uuid(),'2026-12-01',400001);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'overpayment accepted'; end if;
  perform dock_apply_receipt(invoice,null,null,gen_random_uuid(),'2026-12-01',400000);
  insert into dock_payments(contract_id,label,amount,due_on,certainty,received_on,received_amount)
    values(contract_id,'旧アプリ入金',1000,'2026-11-25','confirmed','2026-11-26',500);
  if not exists(select 1 from dock_receipts r join dock_payments p on p.id=r.payment_id where p.label='旧アプリ入金' and r.amount=500)
    then raise exception 'old app payment lost'; end if;

  insert into dock_recurring_rates(contract_id,effective_on,amount,day_of_month) values
    (recurring_contract,'2026-11-01',20000,31),(recurring_contract,'2026-12-01',25000,31),
    (recurring_contract,'2027-01-01',0,31);
  recurring_invoice := dock_recurring_payment(recurring_contract,'2026-11-01');
  if not exists(select 1 from dock_payments where id=recurring_invoice and amount=20000 and due_on='2026-11-30')
    then raise exception 'short month or recurring rate wrong'; end if;
  perform dock_apply_receipt(null,recurring_contract,'2026-12-01',gen_random_uuid(),'2026-12-01',25000);
  rejected := false;
  begin
    perform dock_recurring_payment(recurring_contract,'2027-01-01');
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'paused recurring payment generated'; end if;

  insert into dock_recurring_rates(contract_id,effective_on,amount,day_of_month) values
    (revised_contract,'2026-11-01',20000,1),(revised_contract,'2026-12-15',25000,1);
  recurring_invoice := dock_recurring_payment(revised_contract,'2026-12-01');
  if not exists(select 1 from dock_payments where id=recurring_invoice and amount=20000 and due_on='2026-12-01')
    then raise exception 'mid-month revision rewrote an earlier due date'; end if;

  insert into dock_proposals(id,kind,title,quote,meeting_key,meeting_title,proposed)
    values(proposal,'task','検証タスク','確認済み原文','test-doc','検証会議','{"origin":"ai","source_url":"https://example.org/test-doc"}');
  insert into dock_permissions(member_id,approve_proposals) values(actor,false)
    on conflict(member_id) do update set approve_proposals=false;
  rejected := false;
  begin
    perform dock_review(proposal,1,'approved',actor,jsonb_build_object('title','検証タスク','project',job,'owner',actor,'due','2026-11-30'));
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'restricted member approved a proposal'; end if;
  update dock_permissions set approve_proposals=true where member_id=actor;
  rejected := false;
  begin
    perform dock_review(proposal,1,'approved',actor,jsonb_build_object('title','検証タスク','project',other,'owner',actor,'due','2026-11-30'));
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'cross-workspace approval accepted'; end if;
  perform dock_review(proposal,1,'held',actor,jsonb_build_object('project',job));
  perform dock_review(proposal,2,'archived',actor,'{}');
  perform dock_review(proposal,3,'restore',actor,'{}');
  perform dock_review(proposal,4,'approved',actor,jsonb_build_object('title','検証タスク','project',job,'owner',actor,'due','2026-11-30'));
  rejected := false;
  begin
    perform dock_review(proposal,4,'approved',actor,jsonb_build_object('title','検証タスク','project',job,'owner',actor,'due','2026-11-30'));
  exception when raise_exception then rejected := true;
  end;
  if not rejected or (select count(*) from tm_tasks where project_id=job and title='検証タスク') <> 1
    or (select count(*) from dock_review_events where proposal_id=proposal) <> 4
    or not exists(select 1 from dock_history where customer_id=cust and source_kind='ai' and source_url='https://example.org/test-doc')
    then raise exception 'approval retry, history or preservation failed'; end if;
  if has_table_privilege('authenticated','dock_receipts','SELECT') or
    has_function_privilege('authenticated','dock_apply_receipt(uuid,uuid,date,uuid,date,numeric)','EXECUTE')
    then raise exception 'database grants expose finance'; end if;
end $$;
rollback;
