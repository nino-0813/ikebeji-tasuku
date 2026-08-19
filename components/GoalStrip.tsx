import Link from "next/link";
import type { Goal, Task } from "@/lib/types";
import { goalStats } from "@/lib/goal";
import { formatValue } from "@/lib/format";
import { CategoryBadge } from "./ui";

export function GoalStrip({ goals, tasks }: { goals: Goal[]; tasks: Task[] }) {
  if (goals.length === 0) {
    return (
      <Link
        href="/goals"
        className="card flex items-center justify-between px-4 py-3 text-sm transition hover:border-line-strong"
      >
        <span className="text-ink-soft">
          目標がまだありません。「12月までにお米を◯円」のような数字を1つ置くと、タスクの優先順位が決まります。
        </span>
        <span className="shrink-0 text-xs font-bold text-brand">目標を作る →</span>
      </Link>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} tasks={tasks.filter((t) => t.goal_id === g.id)} />
      ))}
    </div>
  );
}

export function GoalCard({ goal, tasks }: { goal: Goal; tasks: Task[] }) {
  const s = goalStats(goal);
  const open = tasks.filter((t) => t.status !== "done").length;
  const pct = Math.round(s.progress * 100);

  return (
    <Link href="/goals" className="card block p-4 transition hover:border-line-strong hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] leading-snug font-bold text-ink">{goal.title}</p>
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

      <p className="tnum mt-2 border-t border-line pt-2 text-[11px] text-ink-mute">
        達成には月あたり <b className="text-ink-soft">{formatValue(s.perMonthNeeded, goal.unit)}</b>
        {open > 0 && <> ・ ひもづくタスク {open}件</>}
      </p>
    </Link>
  );
}
