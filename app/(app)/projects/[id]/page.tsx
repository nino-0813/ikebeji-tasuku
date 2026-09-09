import Link from "next/link";
import { notFound } from "next/navigation";
import { getGoals, getProject, getTasks, getWorkspaceMembers } from "@/lib/data";
import { daysUntil, isStalled } from "@/lib/format";
import { goalStats } from "@/lib/goal";
import { formatValue } from "@/lib/format";
import { ProjectSettings } from "@/components/ProjectParts";
import { ProjectTaskList } from "@/components/ProjectTaskList";
import { AddTaskButton } from "@/components/AddTaskButton";
import { Avatar, CategoryBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const [project, tasks, members, goals] = await Promise.all([
    getProject(id),
    getTasks(),
    getWorkspaceMembers(),
    getGoals(),
  ]);
  if (!project) notFound();

  const mine = tasks.filter((t) => t.project_id === project.id);
  const open = mine.filter((t) => t.status !== "done");
  const done = mine.filter((t) => t.status === "done");
  const goal = goals.find((g) => g.id === project.goal_id);
  const ownerIds = new Set(open.map((t) => t.owner_id));

  const overdue = open.filter((t) => daysUntil(t.due_date) < 0).length;
  const stalled = open.filter(isStalled).length;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/" className="text-xs text-ink-mute hover:text-ink-soft">
          ← ホーム
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: project.color }}
                aria-hidden
              />
              <h1 className="text-xl font-bold">{project.title}</h1>
              <CategoryBadge category={project.category} />
              {project.archived && (
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                  畳んでいる
                </span>
              )}
            </div>
            {project.detail && (
              <p className="mt-2 max-w-2xl text-xs leading-relaxed whitespace-pre-wrap text-ink-soft">
                {project.detail}
              </p>
            )}
          </div>
          <ProjectSettings project={project} goals={goals} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="tnum text-ink-mute">
            残り <b className="text-ink-soft">{open.length}</b> 件 ・ 完了 {done.length} 件
          </span>
          {overdue > 0 && <span className="tnum font-semibold text-red-600">期限超過 {overdue}件</span>}
          {stalled > 0 && (
            <span className="tnum font-semibold text-amber-600">止まっている {stalled}件</span>
          )}
          <span className="flex -space-x-1.5">
            {members
              .filter((m) => ownerIds.has(m.id))
              .map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-white">
                  <Avatar member={m} size={22} />
                </span>
              ))}
          </span>
        </div>
      </div>

      {goal && (
        <Link
          href="/goals"
          className="card flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:border-line-strong"
        >
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
            {goal.horizon === "short" ? "短期" : "長期"}
          </span>
          <span className="text-sm font-medium">{goal.title}</span>
          <span className="tnum text-xs text-ink-mute">
            {formatValue(goal.current_value, goal.unit)} / {formatValue(goal.target_value, goal.unit)}
          </span>
          <span
            className={`tnum text-xs font-semibold ${
              goalStats(goal).onTrack ? "text-brand" : "text-amber-600"
            }`}
          >
            {goalStats(goal).onTrack ? "順調" : "遅れ"}
          </span>
          <span className="grow" />
          <span className="shrink-0 text-xs font-bold text-brand">目標を見る →</span>
        </Link>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold">やること</h2>
            <span className="tnum text-xs text-ink-mute">{open.length}件</span>
          </div>
          <span className="grow" />
          <AddTaskButton
            variant="solid"
            label="＋ タスクを追加"
            defaults={{
              project_id: project.id,
              category: project.category,
              goal_id: project.goal_id,
            }}
          />
        </div>

        <ProjectTaskList open={open} done={done} members={members} />
      </section>
    </div>
  );
}
