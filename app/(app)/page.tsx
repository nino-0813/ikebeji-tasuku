import Link from "next/link";
import { getGoals, getMeetings, getMembers, getProjects, getTasks } from "@/lib/data";
import { STALL_DAYS, type Task } from "@/lib/types";
import { daysSince, daysUntil, formatDate, formatDateLong, isStalled, todayISO } from "@/lib/format";
import { GoalStrip } from "@/components/GoalStrip";
import { TaskRow } from "@/components/TaskCard";
import { ProjectAccordion, NewProjectButton } from "@/components/ProjectParts";
import { EmptyState, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 期限が近い順。同じ日なら優先度の高い方が上 */
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 } as const;
function byUrgency(a: Task, b: Task) {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export default async function DashboardPage() {
  const [tasks, members, goals, projects, meetings] = await Promise.all([
    getTasks(),
    getMembers(),
    getGoals(),
    getProjects(),
    getMeetings(),
  ]);

  const open = tasks.filter((t) => t.status !== "done");

  // 「詰まっている」= 期限を過ぎた or ステータスが N 日動いていない
  const stuck = open
    .map((t) => {
      const over = daysUntil(t.due_date) < 0;
      const stalled = isStalled(t);
      if (!over && !stalled) return null;
      const note = over
        ? `${-daysUntil(t.due_date)}日超過`
        : `${daysSince(t.status_changed_at)}日動いていません`;
      return { task: t, note, over };
    })
    .filter((x): x is { task: Task; note: string; over: boolean } => x !== null)
    .sort((a, b) => (a.over === b.over ? byUrgency(a.task, b.task) : a.over ? -1 : 1));

  const doneThisWeek = tasks.filter(
    (t) => t.status === "done" && t.done_at && daysSince(t.done_at) <= 7,
  ).length;

  const lastMeeting = meetings[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">今日の状況</h1>
          <p className="tnum mt-0.5 text-xs text-ink-mute">{formatDateLong(todayISO())}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
          <Stat label="動いている" value={open.filter((t) => t.status === "doing").length} />
          <Stat label="相手待ち" value={open.filter((t) => t.status === "waiting").length} />
          <Stat label="未着手" value={open.filter((t) => t.status === "todo").length} />
          <Stat label="今週の完了" value={doneThisWeek} tone="brand" />
        </div>
      </div>

      <section>
        <SectionTitle hint="バーの縦線が「今日あるべき地点」">目標に対する現在地</SectionTitle>
        <GoalStrip goals={goals} tasks={tasks} />
      </section>

      <section>
        <SectionTitle
          count={stuck.length}
          hint={`期限超過、または${STALL_DAYS}日以上ステータスが動いていないもの`}
        >
          ⚠️ 詰まっているもの
        </SectionTitle>
        {stuck.length === 0 ? (
          <EmptyState>止まっているタスクはありません。いい状態です。</EmptyState>
        ) : (
          <div className="card divide-y divide-line px-2 py-1">
            {stuck.map(({ task, note }) => (
              <TaskRow key={task.id} task={task} members={members} note={note} showStalledAction />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold tracking-wide text-ink">プロジェクト</h2>
            <span className="tnum text-xs text-ink-mute">{projects.length}件</span>
            <span className="text-xs text-ink-mute">
              クリックすると中のタスクが開きます。完了したタスクは一覧から消えますが、プロジェクトは残ります
            </span>
          </div>
          <span className="grow" />
          <NewProjectButton goals={goals} />
        </div>
        <ProjectAccordion projects={projects} tasks={tasks} members={members} goals={goals} />
      </section>

      <section>
        <SectionTitle>打ち合わせ</SectionTitle>
        {lastMeeting ? (
          <Link
            href={`/meetings/${lastMeeting.id}`}
            className="card flex items-center justify-between px-4 py-3 transition hover:border-line-strong"
          >
            <div>
              <p className="text-sm font-medium">{lastMeeting.title}</p>
              <p className="tnum mt-0.5 text-xs text-ink-mute">
                {formatDate(lastMeeting.held_on)} ・ ここで決まったタスク{" "}
                {tasks.filter((t) => t.meeting_id === lastMeeting.id).length}件
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-brand">開く →</span>
          </Link>
        ) : (
          <Link
            href="/meetings"
            className="card flex items-center justify-between px-4 py-3 text-sm transition hover:border-line-strong"
          >
            <span className="text-ink-soft">
              打ち合わせを1回登録すると、次回の冒頭で「前回の宿題がどうなったか」が自動で出ます。
            </span>
            <span className="shrink-0 text-xs font-bold text-brand">作る →</span>
          </Link>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "brand" }) {
  return (
    <div className="text-center">
      <p
        className={`tnum text-lg leading-none font-bold ${tone === "brand" ? "text-brand" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-mute">{label}</p>
    </div>
  );
}
