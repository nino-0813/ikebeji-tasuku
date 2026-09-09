-- 「本間と合田」はページ名ではなく、nacoページの構成員として扱う。

-- 誤って作成したページにデータがあれば、nacoへ安全に移す。
update tm_goals       set workspace_id = '00000000-0000-4000-8000-000000000002' where workspace_id = '00000000-0000-4000-8000-000000000003';
update tm_projects    set workspace_id = '00000000-0000-4000-8000-000000000002' where workspace_id = '00000000-0000-4000-8000-000000000003';
update tm_meetings    set workspace_id = '00000000-0000-4000-8000-000000000002' where workspace_id = '00000000-0000-4000-8000-000000000003';
update tm_tasks       set workspace_id = '00000000-0000-4000-8000-000000000002' where workspace_id = '00000000-0000-4000-8000-000000000003';
update tm_inbox_items set workspace_id = '00000000-0000-4000-8000-000000000002' where workspace_id = '00000000-0000-4000-8000-000000000003';

delete from tm_workspaces where id = '00000000-0000-4000-8000-000000000003';

create table if not exists tm_workspace_members (
  workspace_id uuid not null references tm_workspaces(id) on delete cascade,
  member_id    text not null references tm_members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, member_id)
);
create index if not exists tm_workspace_members_member_idx on tm_workspace_members(member_id);

insert into tm_workspace_members (workspace_id, member_id) values
  ('00000000-0000-4000-8000-000000000001', 'ninomiya'),
  ('00000000-0000-4000-8000-000000000001', 'honma'),
  ('00000000-0000-4000-8000-000000000001', 'goda'),
  ('00000000-0000-4000-8000-000000000002', 'honma'),
  ('00000000-0000-4000-8000-000000000002', 'goda'),
  ('00000000-0000-4000-8000-000000000004', 'honma')
on conflict (workspace_id, member_id) do nothing;

alter table tm_workspace_members enable row level security;
