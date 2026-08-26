-- ============================================================
-- 追加分（2026-08-26）
--   1. 目標に 長期 / 短期 の区別を足す
--   2. プロジェクト（大タスク）を足して、タスクをその下にぶら下げる
--
-- Supabase → SQL Editor に貼り付けて Run。
-- 既存のデータは消えません。何度流しても大丈夫です。
-- ============================================================

-- ---------- 1. 目標: 長期 / 短期 ----------
alter table tm_goals add column if not exists horizon text not null default 'long';
alter table tm_goals add column if not exists parent_goal_id uuid references tm_goals(id) on delete set null;

do $$ begin
  alter table tm_goals add constraint tm_goals_horizon_check check (horizon in ('long','short'));
exception when duplicate_object then null; end $$;

create index if not exists tm_goals_parent_idx on tm_goals(parent_goal_id);

-- ---------- 2. プロジェクト（大タスク） ----------
-- 中のタスクが全部終わっても消さない。同じプロジェクトから次のタスクが出てくるため。
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

-- タスクの所属先。プロジェクトを消してもタスクは残る（所属だけ外れる）。
alter table tm_tasks add column if not exists project_id uuid references tm_projects(id) on delete set null;
create index if not exists tm_tasks_project_idx on tm_tasks(project_id);

-- updated_at の自動更新
drop trigger if exists tm_projects_touch on tm_projects;
create trigger tm_projects_touch before update on tm_projects
  for each row execute function tm_touch_updated_at();

alter table tm_projects enable row level security;
