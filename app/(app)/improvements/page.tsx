import { adoptImprovement } from "@/lib/dock-actions";
import { getProjects, getWorkspaceMembers } from "@/lib/data";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { DockGate } from "@/components/DockGate";
export default async function Improvements({
  searchParams,
}: PageProps<"/improvements">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  if (!(await dockTeamMember())) return <DockGate />;
  const { data, error } = await db
    .from("dock_improvements")
    .select(
      "id,title,detail,task_id,proposal_id,dock_proposals(proposed),tm_tasks(status)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("改善提案を取得できませんでした。");
  const [projects, members] = await Promise.all([
    getProjects(),
    getWorkspaceMembers(),
  ]);
  const tab = String((await searchParams).tab || "all");
  const source = (p: (typeof data)[number]) => {
    const proposal = Array.isArray(p.dock_proposals)
      ? p.dock_proposals[0]
      : p.dock_proposals;
    return proposal?.proposed?.origin === "ai"
      ? "ai"
      : p.proposal_id
        ? "meeting"
        : "unknown";
  };
  const finished = (p: (typeof data)[number]) =>
    (Array.isArray(p.tm_tasks) ? p.tm_tasks[0] : p.tm_tasks)?.status === "done";
  const visible = data.filter(
    (p) =>
      tab === "all" || tab === source(p) || (tab === "adopted" && p.task_id),
  );
  return (
    <section className="wd-stack">
      <nav className="wd-tabs">
        {Object.entries({
          all: "提案一覧",
          ai: "AIから",
          meeting: "会話から",
          adopted: "採用済み",
        }).map(([key, label]) => (
          <a
            key={key}
            aria-current={key === tab ? "page" : undefined}
            href={"/improvements?tab=" + key}
          >
            {label}
          </a>
        ))}
        <span className="grow" />
        <a className="wd-accent" href="/improvements?tab=adopted">
          採用履歴を見る ↗
        </a>
      </nav>
      <div className="wd-three">
        {!visible.length && <p>この条件の改善提案はありません。</p>}
        {visible.map((p) => (
          <article key={p.id} className="wd-idea card space-y-2 p-4">
            <small>
              {source(p) === "ai"
                ? "AI GENERATED ／ AIから"
                : p.proposal_id
                  ? "MEETING DERIVED ／ 会議由来"
                  : "改善提案"}
            </small>
            <h2 className="font-bold">{p.title}</h2>
            <p>{p.detail}</p>
            <p className="text-sm">
              {finished(p)
                ? "実装完了"
                : p.task_id
                  ? "タスク登録済み"
                  : "採用検討中"}
            </p>
            {!p.task_id && (
              <details>
                <summary>実装タスクにする</summary>
                <form
                  action={adoptImprovement}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <input type="hidden" name="improvement" value={p.id} />
                  <label>
                    登録先
                    <select name="project" required className="field">
                      <option value="">案件を選ぶ</option>
                      {projects.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    担当
                    <select name="owner" required className="field">
                      <option value="">担当者を選ぶ</option>
                      {members.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    期限
                    <input name="due" type="date" required className="field" />
                  </label>
                  <button>タスクを登録</button>
                </form>
              </details>
            )}
          </article>
        ))}
      </div>
      <section className="wd-panel">
        <h2 className="wd-title">改善の進め方</h2>
        <div className="wd-three">
          {[
            ["提案", "根拠を保存"],
            ["検討", "実装範囲を判断"],
            ["採用", "実装タスクへ"],
            ["完了", "効果を振り返る"],
          ].map(([title, note]) => (
            <div className="wd-note" key={title}>
              <b>{title}</b>
              <small className="block">{note}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
