-- ============================================================
-- イケベジ 進行ボード / スキーマ
-- Supabase → SQL Editor に丸ごと貼り付けて Run してください。
-- 何度流しても壊れません（作成済みならスキップされます）。
-- ============================================================

-- ---------- メンバー ----------
create table if not exists tm_members (
  id          text primary key,
  name        text not null,
  color       text not null,
  sort_order  int  not null default 0
);

-- ---------- 目標 / KPI ----------
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

create table if not exists tm_goal_logs (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references tm_goals(id) on delete cascade,
  recorded_on date not null default current_date,
  value       numeric not null,
  memo        text,
  created_at  timestamptz not null default now()
);
create index if not exists tm_goal_logs_goal_idx on tm_goal_logs(goal_id, recorded_on desc);

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
create index if not exists tm_tasks_status_idx  on tm_tasks(status, sort_order);
create index if not exists tm_tasks_owner_idx   on tm_tasks(owner_id);
create index if not exists tm_tasks_due_idx     on tm_tasks(due_date);
create index if not exists tm_tasks_meeting_idx on tm_tasks(meeting_id);

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

create trigger tm_tasks_touch    before update on tm_tasks    for each row execute function tm_touch_task();
create trigger tm_goals_touch    before update on tm_goals    for each row execute function tm_touch_updated_at();
create trigger tm_meetings_touch before update on tm_meetings for each row execute function tm_touch_updated_at();

-- ---------- RLS ----------
-- 公開ポリシーは作らない。アクセスは全てアプリのサーバー側（service_role）経由。
alter table tm_members   enable row level security;
alter table tm_goals     enable row level security;
alter table tm_goal_logs enable row level security;
alter table tm_meetings  enable row level security;
alter table tm_tasks     enable row level security;
alter table tm_comments  enable row level security;
alter table tm_inbox_items enable row level security;
alter table tm_subtasks enable row level security;

-- ---------- メンバー登録 ----------
insert into tm_members (id, name, color, sort_order) values
  ('ninomiya', '二宮',   '#2563eb', 1),
  ('honma',    '本間',   '#059669', 2),
  ('goda',     'ゴーダ', '#d97706', 3)
on conflict (id) do update
  set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;
