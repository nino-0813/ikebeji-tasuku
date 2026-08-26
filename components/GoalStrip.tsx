import Link from "next/link";
import type { Goal, Task } from "@/lib/types";
import { goalStats } from "@/lib/goal";
import { formatDate, formatValue } from "@/lib/format";
import { CategoryBadge } from "./ui";

export function GoalStrip({ goals, tasks }: { goals: Goal[]; tasks: Task[] }) {
  if (goals.length === 0) {
    return (
      <Link
        href="/goals"
        className="card flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:border-line-strong"
      >
        <span className="text-ink-soft">
          目標がまだありません。「12月までに定期購入者を◯人」のような数字を1つ置くと、タスクの優先順位が決まります。
        </span>
        <span className="shrink-0 text-xs font-bold text-brand">目標を作る →</span>
      </Link>
    );
  }

  const longs = goals.filter((g) => g.horizon !== "short");
  const shorts = goals.filter((g) => g.horizon === "short");
  // 長期にぶら下がっていない短期は、単体のカードとして出す
  const orphanShorts = shorts.filter(
    (s) => !s.parent_goal_id || !longs.some((l) => l.id === s.parent_goal_id),
  );

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {longs.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          tasks={tasks.filter((t) => t.goal_id === g.id)}
          milestones={shorts.filter((s) => s.parent_goal_id === g.id)}
        />
      ))}
      {orphanShorts.map((g) => (
        <GoalCard key={g.id} goal={g} tasks={tasks.filter((t) => t.goal_id === g.id)} milestones={[]} />
      ))}
    </div>
  );
}

export function GoalCard({
  goal,
  tasks,
  milestones = [],
}: {
  goal: Goal;
  tasks: Task[];
  milestones?: Goal[];
}) {
  const s = goalStats(goal);
  const open = tasks.filter((t) => t.status !== "done").length;
  const pct = Math.round(s.progress * 100);
  const isShort = goal.horizon === "short";

  return (
    <Link href="/goals" className="card block p-4 transition hover:border-line-strong hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isShort ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"
            }`}
          >
            {isShort ? "短期" : "長期"}
          </span>
          <p className="text-[13px] leading-snug font-bold text-ink">{goal.title}</p>
        </div>
        <CategoryBadge category={goal.category} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-2xl leading-none font-bold text-ink">
          {formatValue(goal.current_value, goal.unit)}
        </span>
        <span className="tnum text-xs text-ink-mute">
          / {formatValue(goal.target_value, goal.unit)}
        </span>
      </div>

      {/* バーの上に「今日あるべき地点」の目盛りを重ねる */}
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full ${s.onTrack ? "bg-brand" : "bg-amber-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-stone-500"
          style={{ left: `${Math.min(s.elapsed * 100, 100)}%` }}
          title="今日あるべき地点"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="tnum font-bold text-ink-soft">{pct}%</span>
        <span className={`tnum font-semibold ${s.onTrack ? "text-brand" : "text-amber-600"}`}>
          {s.onTrack
            ? `予定より ${formatValue(Math.abs(s.gap), goal.unit)} 先行`
            : `予定より ${formatValue(Math.abs(s.gap), goal.unit)} 遅れ`}
        </span>
        <span className="tnum text-ink-mute">
          {s.daysLeft >= 0 ? `残り${s.daysLeft}日` : `${-s.daysLeft}日超過`}
        </span>
      </div>

      {milestones.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-line pt-2">
          <p className="text-[10px] font-bold text-ink-mute">この中の区切り</p>
          {milestones.map((m) => (
            <MilestoneRow key={m.id} goal={m} />
          ))}
        </div>
      )}

      <p className="tnum mt-2 border-t border-line pt-2 text-[11px] text-ink-mute">
        達成には月あたり <b className="text-ink-soft">{formatValue(s.perMonthNeeded, goal.unit)}</b>
        {open > 0 && <> ・ ひもづくタスク {open}件</>}
      </p>
    </Link>
  );
}

/** 長期目標カードの中に並ぶ、短期目標の1行 */
function MilestoneRow({ goal }: { goal: Goal }) {
  const s = goalStats(goal);
  const pct = Math.round(s.progress * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="tnum w-14 shrink-0 text-[10px] text-ink-mute">
        {formatDate(goal.deadline)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{goal.title}</span>
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full ${s.onTrack ? "bg-brand" : "bg-amber-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={`tnum w-9 shrink-0 text-right text-[10px] font-bold ${
          s.onTrack ? "text-brand" : "text-amber-600"
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}
