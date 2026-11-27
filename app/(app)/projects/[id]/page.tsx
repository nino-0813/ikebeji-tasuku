import { dockAccess } from "@/lib/dock-access";
import { saveProductionLinks, saveDockProject } from "@/lib/dock-actions";
import { httpUrl, legacyProjectField } from "@/lib/dock-project";
import { DockCustomerHistory } from "@/components/DockCustomerHistory";
import { DockGate } from "@/components/DockGate";
import { DockTaskLine } from "@/components/DockTaskLine";
import { DockSteps } from "@/components/DockSteps";
import { DockContract } from "@/components/DockContract";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGoals,
  getProject,
  getTasks,
  getWorkspaceMembers,
} from "@/lib/data";
import { daysUntil, isStalled } from "@/lib/format";
import { goalStats } from "@/lib/goal";
import { formatValue } from "@/lib/format";
import { ProjectSettings } from "@/components/ProjectParts";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { AddTaskButton } from "@/components/AddTaskButton";
import { Avatar, CategoryBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[id]">) {
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

  if (project.workspace_id === WITH_DOCK_ID) {
    const access = await dockAccess();
    if (!access) return <DockGate />;
    const visibleTasks = [...open, ...done];
    const links = [
      ["website", "本番URL", project.client_website],
      ["preview", "確認用URL", project.dock_preview_url ?? legacyProjectField(project.detail, "プレビュー")],
      ["deployment", "最新版Vercel", project.dock_deployment_url],
    ] as const;
    return (
      <section className="wd-stack">
        <div className="wd-tabs">
          <Link href="/projects">← プロジェクト一覧</Link>
          <span>
            {project.archived
              ? "完了"
              : project.phase === "maintenance"
                ? "伴走中"
                : project.phase === "sales" ? "商談中" : "制作中"}
          </span>
          <span className="grow" />
          {project.dock_customer_id && (
            <Link href={"/customers?id=" + project.dock_customer_id}>
              顧客の履歴を見る ↗
            </Link>
          )}
        </div>
        <div className="wd-split">
          <section className="wd-panel">
            <header className="wd-title">
              <h2>{project.title}</h2>
              {!project.archived && access.edit_operations && <details>
                <summary>案件情報を編集</summary>
                <form action={saveDockProject} className="mt-2 grid gap-2">
                  <input type="hidden" name="project" value={id} />
                  <label>案件名<input name="title" className="field" defaultValue={project.title} required /></label>
                  <label>契約名義<input name="legal" className="field" defaultValue={project.client_name || ""} /></label>
                  <label>状態<select name="phase" className="field" defaultValue={project.phase}>
                    <option value="sales">商談中</option><option value="production">制作中</option><option value="maintenance">伴走中</option>
                  </select></label>
                  <label>完了予定日<input type="date" name="finish" className="field" defaultValue={project.dock_finish_on || legacyProjectField(project.detail, "完了予定日")} /></label>
                  <fieldset><legend>担当メンバー</legend>
                    {members.map(m => <label className="mr-3" key={m.id}><input type="checkbox" name="member" value={m.id} defaultChecked={project.dock_owner_ids?.includes(m.id) || legacyProjectField(project.detail, "担当")?.split("・").includes(m.name)} /> {m.name}</label>)}
                  </fieldset>
                  <label>案件メモ<textarea name="detail" className="field" defaultValue={project.detail || ""} /></label>
                  <button className="wd-primary">案件情報を保存</button>
                </form>
              </details>}
            </header>
            <DockSteps project={project} members={members} canEdit={access.edit_operations} />
            {project.detail && <details className="wd-note mt-3"><summary>案件メモ</summary><p className="whitespace-pre-wrap">{project.detail}</p></details>}
            <h2 className="wd-title mt-4">
              タスク
              {!project.archived && access.edit_operations && <AddTaskButton label="＋ 追加" defaults={{ project_id: id, category: project.category }} />}
            </h2>
            {visibleTasks.map(t => <DockTaskLine key={t.id} task={t} members={members} canEdit={access.edit_operations} />)}
            {!visibleTasks.length && <p className="wd-empty">タスクはまだ登録されていません。</p>}
          </section>
          <aside className="wd-stack content-start">
            <DockContract
              id={id}
              customer={project.dock_customer_id}
              legal={project.client_name}
              legacyAmounts={[
                { label: "契約金額", value: Number(project.contract_amount) },
                { label: "請求額", value: Number(project.invoiced_amount) },
                { label: "入金済み金額", value: Number(project.paid_amount) },
                { label: "月額保守", value: Number(project.maintenance_monthly_fee) },
              ]}
            />
            <section className="wd-panel">
              <h2 className="wd-title">制作リンク</h2>
              {links.map(([key, label, value]) => {
                const url = httpUrl(value);
                return <p className="wd-row" key={key}>{label}{url ? <a className="underline" href={url} target="_blank" rel="noreferrer">開く ↗</a> : <small>未登録</small>}</p>;
              })}
              {access.edit_operations && <details className="mt-3">
                <summary>制作リンクを編集</summary>
                <form action={saveProductionLinks} className="mt-2 grid gap-2">
                  <input type="hidden" name="project" value={id} />
                  {links.map(([key, label, value]) => <label key={key}>{label}<input type="url" name={key} className="field" defaultValue={value || ""} /></label>)}
                  <button className="wd-primary">制作リンクを保存</button>
                </form>
              </details>}
            </section>
            {project.dock_customer_id && (
              <section className="wd-panel"><DockCustomerHistory customer={project.dock_customer_id} /></section>
            )}
          </aside>
        </div>
      </section>
    );
  }
  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/projects"
          className="text-xs text-ink-mute hover:text-ink-soft"
        >
          ← プロジェクト一覧
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
            残り <b className="text-ink-soft">{open.length}</b> 件 ・ 完了{" "}
            {done.length} 件
          </span>
          {overdue > 0 && (
            <span className="tnum font-semibold text-red-600">
              期限超過 {overdue}件
            </span>
          )}
          {stalled > 0 && (
            <span className="tnum font-semibold text-amber-600">
              止まっている {stalled}件
            </span>
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

      <ProjectDashboard project={project} tasks={mine} />

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
            {formatValue(goal.current_value, goal.unit)} /{" "}
            {formatValue(goal.target_value, goal.unit)}
          </span>
          <span
            className={`tnum text-xs font-semibold ${
              goalStats(goal).onTrack ? "text-brand" : "text-amber-600"
            }`}
          >
            {goalStats(goal).onTrack ? "順調" : "遅れ"}
          </span>
          <span className="grow" />
          <span className="shrink-0 text-xs font-bold text-brand">
            目標を見る →
          </span>
        </Link>
      )}

      <section className="space-y-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-mute">
                SCHEDULE
              </p>
              <h2 className="mt-1 text-sm font-bold">制作工程</h2>
            </div>
            <span className="tnum text-xs text-ink-mute">
              全{mine.length}件
            </span>
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

        <ProjectTimeline
          tasks={[
            ...open.sort(
              (a, b) =>
                a.due_date.localeCompare(b.due_date) ||
                a.start_date.localeCompare(b.start_date),
            ),
            ...done.sort((a, b) =>
              (b.done_at ?? b.updated_at).localeCompare(
                a.done_at ?? a.updated_at,
              ),
            ),
          ]}
          members={members}
        />
      </section>
    </div>
  );
}
