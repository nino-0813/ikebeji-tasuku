-- プロジェクトごとの保守管理月額を追加する。
alter table tm_projects
  add column if not exists maintenance_monthly_fee numeric not null default 0;

do $$ begin
  alter table tm_projects
    add constraint tm_projects_maintenance_fee_nonnegative_check
    check (maintenance_monthly_fee >= 0);
exception when duplicate_object then null; end $$;
