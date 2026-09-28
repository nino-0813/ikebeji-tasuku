-- with dock ページと「とおるさん」メンバーを追加する。

insert into tm_members (id, name, color, sort_order) values
  ('toru', 'とおるさん', '#0891b2', 4)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order;

insert into tm_workspaces (id, name, color, sort_order) values
  ('00000000-0000-4000-8000-000000000005', 'with dock', '#0891b2', 4)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order;

insert into tm_workspace_members (workspace_id, member_id) values
  ('00000000-0000-4000-8000-000000000005', 'honma'),
  ('00000000-0000-4000-8000-000000000005', 'ninomiya'),
  ('00000000-0000-4000-8000-000000000005', 'toru')
on conflict (workspace_id, member_id) do nothing;
