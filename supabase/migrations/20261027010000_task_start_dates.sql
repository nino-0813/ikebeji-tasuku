-- ガントチャート用にタスクの開始日を追加する。
-- 既存タスクは「作成日」と「期限」の早い方を開始日にする。

alter table tm_tasks add column if not exists start_date date;

update tm_tasks
set start_date = least(created_at::date, due_date)
where start_date is null;

alter table tm_tasks alter column start_date set default current_date;
alter table tm_tasks alter column start_date set not null;

do $$ begin
  alter table tm_tasks
    add constraint tm_tasks_date_order_check check (start_date <= due_date);
exception when duplicate_object then null; end $$;

create index if not exists tm_tasks_start_date_idx on tm_tasks(start_date);
