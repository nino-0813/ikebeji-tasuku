-- タスク添付ファイル（Supabase SQL Editor でこのファイルを実行）
create table if not exists public.tm_task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tm_tasks(id) on delete cascade,
  file_name    text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  text references public.tm_members(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists tm_task_attachments_task_idx
  on public.tm_task_attachments(task_id, created_at);

alter table public.tm_task_attachments enable row level security;

-- 非公開Storageバケット。アプリのサーバー（service_role）からのみアクセスする。
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;
