create table if not exists tm_inbox_items (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  detail     text,
  created_by text references tm_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tm_inbox_items_created_idx on tm_inbox_items(created_at desc);

create table if not exists tm_subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tm_tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tm_subtasks_task_idx on tm_subtasks(task_id, sort_order, created_at);

alter table tm_inbox_items enable row level security;
alter table tm_subtasks enable row level security;
