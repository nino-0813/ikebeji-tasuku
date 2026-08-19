import { getGoalLogs, getGoals, getMembers, getTasks } from "@/lib/data";
import { formatValue } from "@/lib/format";
import { goalStats } from "@/lib/goal";
import {
  GoalActions,
  GoalLogForm,
  GoalLogList,
  GoalVerdict,
  NewGoalButton,
} from "@/components/GoalParts";
import { TaskRow } from "@/components/TaskCard";
import { AddTaskButton } from "@/components/AddTaskButton";
import { CategoryBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [goals, tasks, members] = await Promise.all([getGoals(), getTasks(), getMembers()]);
  const logsByGoal = Object.fromEntries(
    await Promise.all(goals.map(async (g) => [g.id, await getGoalLogs(g.id)] as const)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">目標</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            月に1回、実績の数字を入れるだけ。遅れていればタスクの優先順位が変わります。
          </p>
        </div>
        <NewGoalButton />
      </div>

      {goals.length === 0 ? (
        <EmptyState>
          まだ目標がありません。「12月までにお米を◯◯万円」のように、期限と数字がある形で1つ置いてみてください。
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const s = goalStats(goal);
            const linked = tasks.filter((t) => t.goal_id === goal.id);
            const open = linked.filter((t) => t.status !== "done");
            const pct = Math.round(s.progress * 100);

            return (
              <div key={goal.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">{goal.title}</h2>
                    <CategoryBadge category={goal.category} />
                  </div>
                  <GoalActions goal={goal} />
                </div>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="tnum text-3xl leading-none font-bold">
                    {formatValue(goal.current_value, goal.unit)}
                  </span>
                  <span className="tnum text-sm text-ink-mute">
                    / {formatValue(goal.target_value, goal.unit)}
                  </span>
                  <span className="tnum ml-1 text-sm font-bold text-ink-soft">{pct}%</span>
                </div>

                <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100">
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

                <div className="mt-2">
                  <GoalVerdict goal={goal} />
                </div>

                <div className="mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <GoalLogForm goal={goal} />
                    <GoalLogList goal={goal} logs={logsByGoal[goal.id] ?? []} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-xs font-bold text-ink-soft">
                        この目標のための打ち手
                      </h3>
                      <span className="tnum text-[11px] text-ink-mute">
                        未完了{open.length} / 全{linked.length}
                      </span>
                      <span className="grow" />
                      <AddTaskButton
                        label="＋ 打ち手を足す"
                        defaults={{ goal_id: goal.id, category: goal.category }}
                      />
                    </div>
                    {linked.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-xs text-ink-mute">
                        打ち手がひもづいていません。数字だけあって動きがない状態です。
                      </p>
                    ) : (
                      <div className="rounded-lg border border-line px-1 py-0.5">
                        {[...open, ...linked.filter((t) => t.status === "done")].map((t) => (
                          <TaskRow key={t.id} task={t} members={members} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
