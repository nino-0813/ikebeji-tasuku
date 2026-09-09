-- ページ（ワークスペース）を追加し、既存データを「イケベジweb」へ移行する。
-- Supabase SQL Editor でこのファイルを丸ごと実行できます。

create table if not exists tm_workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default '#15803d',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into tm_workspaces (id, name, color, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'イケベジweb', '#15803d', 1),
  ('00000000-0000-4000-8000-000000000002', 'naco',         '#2563eb', 2),
  ('00000000-0000-4000-8000-000000000003', '本間と合田',   '#d97706', 3),
  ('00000000-0000-4000-8000-000000000004', '本間 個人',    '#7c3aed', 4)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order;

alter table tm_goals       add column if not exists workspace_id uuid references tm_workspaces(id) on delete restrict;
alter table tm_projects    add column if not exists workspace_id uuid references tm_workspaces(id) on delete restrict;
alter table tm_meetings    add column if not exists workspace_id uuid references tm_workspaces(id) on delete restrict;
alter table tm_tasks       add column if not exists workspace_id uuid references tm_workspaces(id) on delete restrict;
alter table tm_inbox_items add column if not exists workspace_id uuid references tm_workspaces(id) on delete restrict;

update tm_goals       set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update tm_projects    set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update tm_meetings    set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update tm_tasks       set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update tm_inbox_items set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;

alter table tm_goals       alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table tm_projects    alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table tm_meetings    alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table tm_tasks       alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table tm_inbox_items alter column workspace_id set default '00000000-0000-4000-8000-000000000001';

alter table tm_goals       alter column workspace_id set not null;
alter table tm_projects    alter column workspace_id set not null;
alter table tm_meetings    alter column workspace_id set not null;
alter table tm_tasks       alter column workspace_id set not null;
alter table tm_inbox_items alter column workspace_id set not null;

create index if not exists tm_goals_workspace_idx       on tm_goals(workspace_id);
create index if not exists tm_projects_workspace_idx    on tm_projects(workspace_id);
create index if not exists tm_meetings_workspace_idx    on tm_meetings(workspace_id);
create index if not exists tm_tasks_workspace_idx       on tm_tasks(workspace_id);
create index if not exists tm_inbox_workspace_idx       on tm_inbox_items(workspace_id);

drop trigger if exists tm_workspaces_touch on tm_workspaces;
create trigger tm_workspaces_touch before update on tm_workspaces
for each row execute function tm_touch_updated_at();

alter table tm_workspaces enable row level security;
