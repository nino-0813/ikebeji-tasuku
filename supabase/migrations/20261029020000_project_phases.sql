-- プロジェクト一覧を「商談中・製作中・保守管理」に分類する。
-- 既存プロジェクトは一旦「製作中」に分類し、画面の編集から変更できる。
alter table tm_projects
  add column if not exists phase text not null default 'production';

do $$ begin
  alter table tm_projects
    add constraint tm_projects_phase_check
    check (phase in ('sales','production','maintenance'));
exception when duplicate_object then null; end $$;

create index if not exists tm_projects_phase_idx
  on tm_projects(workspace_id, phase, sort_order);
