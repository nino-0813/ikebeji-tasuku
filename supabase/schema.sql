-- ============================================================
-- イケベジ 進行ボード / スキーマ
-- Supabase → SQL Editor に丸ごと貼り付けて Run してください。
-- 何度流しても壊れません（作成済みならスキップされます）。
--
-- 階層:  目標（長期 → 短期） → プロジェクト → タスク → サブタスク
-- ============================================================

-- ---------- ページ ----------
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
on conflict (id) do update set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

-- ---------- メンバー ----------
create table if not exists tm_members (
  id          text primary key,
  name        text not null,
  color       text not null,
  sort_order  int  not null default 0
);

-- ---------- 目標 / KPI ----------
-- horizon で長期・短期を分ける。短期は parent_goal_id で長期にぶら下げる
-- （例: 長期「12月までに定期購入者100人」の下に 短期「9月末までに40人」）。
create table if not exists tm_goals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null check (category in ('marketing','system')),
  unit          text not null default '円',
  target_value  numeric not null,
  current_value numeric not null default 0,
  start_date    date not null default current_date,
  deadline      date not null,
  memo          text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table tm_goals add column if not exists horizon text not null default 'long';
alter table tm_goals add column if not exists parent_goal_id uuid references tm_goals(id) on delete set null;

do $$ begin
  alter table tm_goals add constraint tm_goals_horizon_check check (horizon in ('long','short'));
exception when duplicate_object then null; end $$;

create index if not exists tm_goals_parent_idx on tm_goals(parent_goal_id);

create table if not exists tm_goal_logs (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references tm_goals(id) on delete cascade,
  recorded_on date not null default current_date,
  value       numeric not null,
  memo        text,
  created_at  timestamptz not null default now()
);
create index if not exists tm_goal_logs_goal_idx on tm_goal_logs(goal_id, recorded_on desc);

-- ---------- プロジェクト（大タスク） ----------
-- 中のタスクが全部終わっても消さない。同じプロジェクトから次のタスクが出てくるため。
-- 畳むときは archived を true にする。
create table if not exists tm_projects (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  detail     text,
  category   text not null check (category in ('marketing','system')),
  goal_id    uuid references tm_goals(id) on delete set null,
  color      text not null default '#15803d',
  archived   boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tm_projects_goal_idx  on tm_projects(goal_id);
create index if not exists tm_projects_order_idx on tm_projects(archived, sort_order);

-- ---------- 打ち合わせ ----------
create table if not exists tm_meetings (
  id         uuid primary key default gen_random_uuid(),
  held_on    date not null default current_date,
  title      text not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tm_meetings_held_idx on tm_meetings(held_on desc);

-- ---------- タスク ----------
-- owner_id と due_date を NOT NULL にしているのが肝。
-- 「誰かがいつかやる」タスクをDBレベルで作れなくしている。
create table if not exists tm_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  detail            text,
  category          text not null check (category in ('marketing','system')),
  status            text not null default 'todo' check (status in ('todo','doing','waiting','done')),
  owner_id          text not null references tm_members(id),
  due_date          date not null,
  priority          text not null default 'mid' check (priority in ('high','mid','low')),
  waiting_on        text,
  goal_id           uuid references tm_goals(id) on delete set null,
  meeting_id        uuid references tm_meetings(id) on delete set null,
  sort_order        double precision not null default 0,
  status_changed_at timestamptz not null default now(),
  done_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table tm_tasks add column if not exists project_id uuid references tm_projects(id) on delete set null;

create index if not exists tm_tasks_status_idx  on tm_tasks(status, sort_order);
create index if not exists tm_tasks_owner_idx   on tm_tasks(owner_id);
create index if not exists tm_tasks_due_idx     on tm_tasks(due_date);
create index if not exists tm_tasks_meeting_idx on tm_tasks(meeting_id);
create index if not exists tm_tasks_project_idx on tm_tasks(project_id);

-- ---------- タスクのやり取り ----------
create table if not exists tm_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tm_tasks(id) on delete cascade,
  author_id  text not null references tm_members(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists tm_comments_task_idx on tm_comments(task_id, created_at);

-- ---------- Inbox / あとで整理するメモ ----------
create table if not exists tm_inbox_items (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  detail     text,
  created_by text references tm_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tm_inbox_items_created_idx on tm_inbox_items(created_at desc);

-- ---------- サブタスク ----------
create table if not exists tm_subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tm_tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tm_subtasks_task_idx on tm_subtasks(task_id, sort_order, created_at);

-- ---------- ページ所属 ----------
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

alter table tm_goals       alter column workspace_id set default '00000000-0000-4000-8000-000000000001', alter column workspace_id set not null;
alter table tm_projects    alter column workspace_id set default '00000000-0000-4000-8000-000000000001', alter column workspace_id set not null;
alter table tm_meetings    alter column workspace_id set default '00000000-0000-4000-8000-000000000001', alter column workspace_id set not null;
alter table tm_tasks       alter column workspace_id set default '00000000-0000-4000-8000-000000000001', alter column workspace_id set not null;
alter table tm_inbox_items alter column workspace_id set default '00000000-0000-4000-8000-000000000001', alter column workspace_id set not null;

create index if not exists tm_goals_workspace_idx    on tm_goals(workspace_id);
create index if not exists tm_projects_workspace_idx on tm_projects(workspace_id);
create index if not exists tm_meetings_workspace_idx on tm_meetings(workspace_id);
create index if not exists tm_tasks_workspace_idx    on tm_tasks(workspace_id);
create index if not exists tm_inbox_workspace_idx    on tm_inbox_items(workspace_id);

-- ---------- タスク添付ファイル ----------
create table if not exists tm_task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tm_tasks(id) on delete cascade,
  file_name    text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  text references tm_members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists tm_task_attachments_task_idx on tm_task_attachments(task_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- ---------- 自動更新 ----------
create or replace function tm_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ステータスが変わった時刻を記録する。これが「何日止まっているか」の基準になる。
create or replace function tm_touch_task() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'done' then
      new.done_at := now();
    else
      new.done_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tm_tasks_touch    on tm_tasks;
drop trigger if exists tm_goals_touch    on tm_goals;
drop trigger if exists tm_meetings_touch on tm_meetings;
drop trigger if exists tm_projects_touch on tm_projects;
drop trigger if exists tm_workspaces_touch on tm_workspaces;

create trigger tm_tasks_touch    before update on tm_tasks    for each row execute function tm_touch_task();
create trigger tm_goals_touch    before update on tm_goals    for each row execute function tm_touch_updated_at();
create trigger tm_meetings_touch before update on tm_meetings for each row execute function tm_touch_updated_at();
create trigger tm_projects_touch before update on tm_projects for each row execute function tm_touch_updated_at();
create trigger tm_workspaces_touch before update on tm_workspaces for each row execute function tm_touch_updated_at();

-- ---------- RLS ----------
-- 公開ポリシーは作らない。アクセスは全てアプリのサーバー側（service_role）経由。
alter table tm_members     enable row level security;
alter table tm_workspaces  enable row level security;
alter table tm_goals       enable row level security;
alter table tm_goal_logs   enable row level security;
alter table tm_projects    enable row level security;
alter table tm_meetings    enable row level security;
alter table tm_tasks       enable row level security;
alter table tm_comments    enable row level security;
alter table tm_inbox_items enable row level security;
alter table tm_subtasks    enable row level security;
alter table tm_task_attachments enable row level security;

-- ---------- メンバー登録 ----------
insert into tm_members (id, name, color, sort_order) values
  ('ninomiya', '二宮',   '#2563eb', 1),
  ('honma',    '本間',   '#059669', 2),
  ('goda',     'ゴーダ', '#d97706', 3)
on conflict (id) do update
  set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;
