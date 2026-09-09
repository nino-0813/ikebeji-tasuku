import Link from "next/link";
import { getGoalLogs, getGoals, getProjects, getTasks, getWorkspaceMembers } from "@/lib/data";
import type { Goal, GoalLog, Member, Project, Task } from "@/lib/types";
import { formatDate, formatValue } from "@/lib/format";
import { goalStats } from "@/lib/goal";
import {
  GoalActions,
  GoalLogForm,
  GoalLogList,
  GoalVerdict,
  NewGoalButton,
} from "@/components/GoalParts";
import { NewProjectButton } from "@/components/ProjectParts";
import { CategoryBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [goals, tasks, members, projects] = await Promise.all([
    getGoals(),
    getTasks(),
    getWorkspaceMembers(),
    getProjects(),
  ]);
  const logsByGoal = Object.fromEntries(
    await Promise.all(goals.map(async (g) => [g.id, await getGoalLogs(g.id)] as const)),
  );

  const longs = goals.filter((g) => g.horizon !== "short");
  const shorts = goals.filter((g) => g.horizon === "short");
  const orphanShorts = shorts.filter(
    (s) => !s.parent_goal_id || !longs.some((l) => l.id === s.parent_goal_id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">目標</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            長期目標を1つ置いて、その中に短期の区切りを足していきます。月に1回、実績の数字を入れるだけ。
          </p>
        </div>
        <NewGoalButton horizon="long" />
      </div>

      {goals.length === 0 ? (
        <EmptyState>
          まだ目標がありません。「12月までに定期購入者を100人」のように、期限と数字がある形で
          長期目標を1つ置いてみてください。
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {longs.map((goal) => (
            <GoalBlock
              key={goal.id}
              goal={goal}
              milestones={shorts.filter((s) => s.parent_goal_id === goal.id)}
              logs={logsByGoal[goal.id] ?? []}
              logsByGoal={logsByGoal}
              tasks={tasks}
              members={members}
              projects={projects}
              allGoals={goals}
            />
          ))}

          {orphanShorts.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-ink-mute">
                長期目標にひもづいていない短期目標
              </p>
              {orphanShorts.map((goal) => (
                <GoalBlock
                  key={goal.id}
                  goal={goal}
                  milestones={[]}
                  logs={logsByGoal[goal.id] ?? []}
                  logsByGoal={logsByGoal}
                  tasks={tasks}
                  members={members}
                  projects={projects}
                  allGoals={goals}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GoalBlock({
  goal,
  milestones,
  logs,
  logsByGoal,
  tasks,
  projects,
}: {
  goal: Goal;
  milestones: Goal[];
  logs: GoalLog[];
  logsByGoal: Record<string, GoalLog[]>;
  tasks: Task[];
  members: Member[];
  projects: Project[];
  allGoals: Goal[];
}) {
  const s = goalStats(goal);
  const pct = Math.round(s.progress * 100);
  const isShort = goal.horizon === "short";
  const linkedProjects = projects.filter((p) => p.goal_id === goal.id);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isShort ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"
            }`}
          >
            {isShort ? "短期" : "長期"}
          </span>
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

      {/* ---- 短期目標（区切り） ---- */}
      {!isShort && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-bold text-ink-soft">短期目標（この中の区切り）</h3>
            <span className="tnum text-[11px] text-ink-mute">{milestones.length}件</span>
            <span className="grow" />
            <NewGoalButton horizon="short" parentGoal={goal} />
          </div>
          {milestones.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-ink-mute">
              区切りがありません。「今月末までにここまで」を1つ置くと、遅れに早く気づけます。
            </p>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <MilestoneBlock key={m.id} goal={m} logs={logsByGoal[m.id] ?? []} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- 実績と打ち手 ---- */}
      <div className="mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-2">
        <div className="space-y-3">
          <GoalLogForm goal={goal} />
          <GoalLogList goal={goal} logs={logs} />
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-bold text-ink-soft">この目標のためのプロジェクト</h3>
            <span className="tnum text-[11px] text-ink-mute">{linkedProjects.length}件</span>
            <span className="grow" />
            <NewProjectButton goals={[goal]} defaultGoalId={goal.id} label="＋ プロジェクト" />
          </div>
          {linkedProjects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-xs text-ink-mute">
              プロジェクトがひもづいていません。数字だけあって動きがない状態です。
            </p>
          ) : (
            <div className="card divide-y divide-line">
              {linkedProjects.map((p) => {
                const open = tasks.filter((t) => t.project_id === p.id && t.status !== "done");
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-2 px-3 py-2 transition hover:bg-stone-50"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
                    <span className="tnum shrink-0 text-[11px] text-ink-mute">
                      残り{open.length}件
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 長期目標の中に並ぶ短期目標。実績は長期と別に入れられる */
function MilestoneBlock({ goal, logs }: { goal: Goal; logs: GoalLog[] }) {
  const s = goalStats(goal);
  const pct = Math.round(s.progress * 100);

  return (
    <div className="rounded-lg border border-line bg-stone-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tnum shrink-0 text-[11px] text-ink-mute">
          〜{formatDate(goal.deadline)}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{goal.title}</span>
        <span className="tnum text-[11px] text-ink-mute">
          {formatValue(goal.current_value, goal.unit)} / {formatValue(goal.target_value, goal.unit)}
        </span>
        <GoalActions goal={goal} />
      </div>

      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-stone-200/70">
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

      <div className="mt-3">
        <GoalLogForm goal={goal} />
        {logs.length > 0 && (
          <div className="mt-2">
            <GoalLogList goal={goal} logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}
