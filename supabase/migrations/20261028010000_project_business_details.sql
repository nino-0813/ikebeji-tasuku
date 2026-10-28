-- Web制作プロジェクトで顧客情報とお金の流れを管理する。
alter table tm_projects add column if not exists client_name text;
alter table tm_projects add column if not exists client_contact_name text;
alter table tm_projects add column if not exists client_email text;
alter table tm_projects add column if not exists client_phone text;
alter table tm_projects add column if not exists client_website text;
alter table tm_projects add column if not exists contract_amount numeric not null default 0;
alter table tm_projects add column if not exists invoiced_amount numeric not null default 0;
alter table tm_projects add column if not exists paid_amount numeric not null default 0;
alter table tm_projects add column if not exists payment_due_date date;

do $$ begin
  alter table tm_projects add constraint tm_projects_money_nonnegative_check
    check (contract_amount >= 0 and invoiced_amount >= 0 and paid_amount >= 0);
exception when duplicate_object then null; end $$;
