import { DockTaskLine } from "@/components/DockTaskLine";
import { db } from "@/lib/supabase";
import { dockDeadline } from "@/lib/dock-deadline";
import Link from "next/link";
import {
  getAllProjects,
  getCurrentWorkspace,
  getGoals,
  getProjects,
  getTasks,
  getWorkspaceMembers,
} from "@/lib/data";
import { ProjectAccordion, NewProjectButton } from "@/components/ProjectParts";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: PageProps<"/projects">) {
  const [projects, tasks, members, goals, currentWorkspace] = await Promise.all(
    [
      getProjects(),
      getTasks(),
      getWorkspaceMembers(),
      getGoals(),
      getCurrentWorkspace(),
    ],
  );

  if (currentWorkspace?.id === "00000000-0000-4000-8000-000000000005") {
    const tab = String((await searchParams).tab || "active");
    const [all, steps, customers] = await Promise.all([
      getAllProjects(),
      db
        .from("dock_steps")
        .select("project_id,title,position,completed_on,due_on")
        .order("position"),
      db.from("dock_customers").select("id,name"),
    ]);
    if (steps.error || customers.error)
      throw new Error("案件の工程を取得できませんでした。");
    const filtered = all.filter((p) =>
      tab === "archive"
        ? p.archived
        : !p.archived &&
          (tab === "sales"
            ? p.phase === "sales"
            : tab === "active"
              ? p.phase !== "sales"
              : p.phase === tab),
    );
    return (
      <section className="wd-stack">
        <nav className="wd-tabs">
          {Object.entries({
            active: "すべて",
            production: "制作中",
            maintenance: "伴走中",
            archive: "完了・アーカイブ",
            ...(all.some((p) => p.phase === "sales")
              ? { sales: "既存の商談" }
              : {}),
          }).map(([key, label]) => (
            <Link
              aria-current={key === tab ? "page" : undefined}
              key={key}
              href={"/projects?tab=" + key}
            >
              {label}
            </Link>
          ))}
          <span className="grow" />
          <Link href="/projects/new" className="wd-primary">
            ＋ プロジェクトを追加
          </Link>
        </nav>
        <div className="wd-three">
          {filtered.map((p) => {
            const mine = tasks.filter((t) => t.project_id === p.id),
              stages = steps.data.filter((s) => s.project_id === p.id),
              current = stages.find((s) => !s.completed_on);
            const next = mine
              .filter((t) => t.status !== "done")
              .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
            const date = [next?.due_date, current?.due_on]
                .filter(Boolean)
                .sort()[0],
              risk = !p.archived && date ? dockDeadline(date) : null;
            return (
              <article
                key={p.id}
                className={
                  "rounded-xl border p-4 " +
                  (risk?.surface || "bg-white border-line")
                }
              >
                <div className="wd-row">
                  <small>
                    {p.archived
                      ? "完了"
                      : p.phase === "maintenance"
                        ? "伴走中"
                        : p.phase === "sales"
                          ? "商談中"
                          : "制作中"}
                  </small>
                  <small>
                    工程 {stages.filter((s) => s.completed_on).length}/
                    {stages.length}
                  </small>
                </div>
                <h2 className="my-3 text-lg font-bold">
                  <Link href={"/projects/" + p.id}>{p.title} →</Link>
                </h2>
                <p>
                  顧客　
                  {customers.data.find((c) => c.id === p.dock_customer_id)
                    ?.name ||
                    p.client_name ||
                    "未登録"}
                </p>
                <p>現在　{current?.title || next?.title || "未設定"}</p>
                <small>{risk?.label}</small>
                {mine.slice(0, 3).map((t) => (
                  <DockTaskLine key={t.id} task={t} members={members} />
                ))}
              </article>
            );
          })}
        </div>
        {!filtered.length && (
          <p className="wd-panel wd-empty">該当する案件はありません。</p>
        )}
        <section className="wd-panel">
          <h2 className="wd-title">見落とし防止</h2>
          <div className="wd-three">
            {[
              ["通常", "期限まで3日以上", "bg-stone-50"],
              ["期限間近", "期限2日前から当日", "bg-yellow-50"],
              ["期限経過", "期限の翌日から", "bg-red-50"],
            ].map(([label, note, color]) => (
              <div key={label} className={"rounded p-3 " + color}>
                <b>{label}</b>
                <small className="block">{note}</small>
              </div>
            ))}
          </div>
        </section>
      </section>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">プロジェクト</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            仕事の塊。中のタスクが全部終わっても消えません。次のタスクがまた出てくるからです。
          </p>
        </div>
        {currentWorkspace?.id === "00000000-0000-4000-8000-000000000005" ? (
          <Link
            href="/projects/new"
            className="rounded bg-brand px-4 py-2 font-semibold text-white"
          >
            ＋ 新規案件
          </Link>
        ) : (
          <NewProjectButton goals={goals} />
        )}
      </div>

      <ProjectAccordion
        projects={projects}
        tasks={tasks}
        members={members}
        goals={goals}
        boardMode={currentWorkspace?.name.trim().toLowerCase() === "with dock"}
      />
    </div>
  );
}
