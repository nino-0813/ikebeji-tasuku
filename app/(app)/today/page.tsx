import { getMembers, getTasks } from "@/lib/data";
import { daysUntil, formatDateLong, todayISO } from "@/lib/format";
import type { Task } from "@/lib/types";
import { TaskRow } from "@/components/TaskCard";
import { EmptyState, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const rank = { high: 0, mid: 1, low: 2 } as const;
function urgency(a: Task, b: Task) {
  const date = a.due_date.localeCompare(b.due_date);
  return date || rank[a.priority] - rank[b.priority];
}

export default async function TodayPage() {
  const [tasks, members] = await Promise.all([getTasks(), getMembers()]);
  const open = tasks.filter((task) => task.status !== "done");
  const overdue = open.filter((task) => daysUntil(task.due_date) < 0).sort(urgency);
  const today = open.filter((task) => daysUntil(task.due_date) === 0).sort(urgency);
  const focus = open.filter((task) => task.status === "doing" && daysUntil(task.due_date) > 0).sort(urgency).slice(0, 5);
  const waiting = open.filter((task) => task.status === "waiting").sort(urgency);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">今日</h1>
        <p className="tnum mt-1 text-sm text-ink-mute">{formatDateLong(todayISO())} · 今日動かすものだけに集中</p>
      </div>
      <TaskSection title="期限超過" tasks={overdue} members={members} empty="期限を過ぎたタスクはありません。" />
      <TaskSection title="今日が期限" tasks={today} members={members} empty="今日が期限のタスクはありません。" />
      <TaskSection title="進行中から優先" tasks={focus} members={members} empty="現在進行中のタスクはありません。" />
      <TaskSection title="返信・確認待ち" tasks={waiting} members={members} empty="相手待ちのタスクはありません。" />
    </div>
  );
}

function TaskSection({ title, tasks, members, empty }: { title: string; tasks: Task[]; members: Awaited<ReturnType<typeof getMembers>>; empty: string }) {
  return <section><SectionTitle count={tasks.length}>{title}</SectionTitle>{tasks.length ? <div className="card divide-y divide-line px-2 py-1">{tasks.map((task) => <TaskRow key={task.id} task={task} members={members} />)}</div> : <EmptyState>{empty}</EmptyState>}</section>;
}
