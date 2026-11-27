import Link from "next/link";
import { adoptImprovement, reviewImprovementEffect } from "@/lib/dock-actions";
import { getProjects, getWorkspaceMembers } from "@/lib/data";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { dockAccess } from "@/lib/dock-access";
import { httpUrl } from "@/lib/dock-project";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { DockGate } from "@/components/DockGate";
export default async function Improvements({
  searchParams,
}: PageProps<"/improvements">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  const access = await dockAccess();
  if (!access) return <DockGate />;
  const { data, error } = await db
    .from("dock_improvements")
    .select(
      "id,title,detail,task_id,proposal_id,expected_effect,review_on,review_result,dock_proposals(proposed,meeting_key,meeting_title),tm_tasks(status,project_id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("改善提案を取得できませんでした。");
  const [projects, members] = await Promise.all([
    getProjects(),
    getWorkspaceMembers(),
  ]);
  const tab = String((await searchParams).tab || "all");
  const proposalOf = (p: (typeof data)[number]) =>
    Array.isArray(p.dock_proposals) ? p.dock_proposals[0] : p.dock_proposals;
  const taskOf = (p: (typeof data)[number]) => Array.isArray(p.tm_tasks) ? p.tm_tasks[0] : p.tm_tasks;
  const source = (p: (typeof data)[number]) => {
    const origin = proposalOf(p)?.proposed?.origin;
    return origin === "ai" || origin === "meeting" ? origin : "unknown";
  };
  const finished = (p: (typeof data)[number]) =>
    taskOf(p)?.status === "done";
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
          <Link
            key={key}
            aria-current={key === tab ? "page" : undefined}
            href={"/improvements?tab=" + key}
          >
            {label}
          </Link>
        ))}
        <span className="grow" />
        <Link className="wd-accent" href="/improvements?tab=adopted">
          採用履歴を見る ↗
        </Link>
      </nav>
      <div className="wd-three">
        {!visible.length && <p>この条件の改善提案はありません。</p>}
        {visible.map((p) => {
          const proposal = proposalOf(p);
          const sourceUrl = httpUrl(proposal?.proposed?.source_url)
            || (proposal?.meeting_key ? "https://withdock-workspace.vercel.app/#meetings/" + proposal.meeting_key : null);
          return <article key={p.id} className="wd-idea card space-y-2 p-4">
            <small>{source(p) === "ai" ? "AIから" : source(p) === "meeting" ? "会議から" : "提案元は未確認"}</small>
            <h2 className="font-bold">{p.title}</h2>
            <p className="whitespace-pre-wrap">{p.detail}</p>
            {sourceUrl && <a className="underline text-sm" href={sourceUrl}>{proposal?.meeting_title || "原文"} ↗</a>}
            <p className="text-sm">
              {finished(p)
                ? "実装完了"
                : p.task_id
                  ? "タスク登録済み"
                  : "採用検討中"}
            </p>
            {!p.task_id && access.edit_operations && (
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
            {p.task_id && (
              <section className="border-t border-line pt-2">
                {taskOf(p)?.project_id && <Link className="underline text-sm" href={"/projects/" + taskOf(p).project_id}>登録先の案件 →</Link>}
                <h3 className="mt-2 font-semibold">効果検証</h3>
                <p className="text-sm">期待する効果　{p.expected_effect || "未設定"}</p>
                <p className="text-sm">振り返り日　{p.review_on || "未設定"}</p>
                <p className="text-sm whitespace-pre-wrap">結果　{p.review_result || "未記録"}</p>
                {access.edit_operations && <details className="mt-2">
                  <summary>効果検証を編集</summary>
                  <form action={reviewImprovementEffect} className="mt-2 grid gap-2">
                    <input type="hidden" name="improvement" value={p.id} />
                    <label>期待する効果<input className="field" name="expected_effect" defaultValue={p.expected_effect || ""} /></label>
                    <label>振り返り日<input className="field" type="date" name="review_on" defaultValue={p.review_on || ""} /></label>
                    <label>結果<textarea className="field" name="review_result" defaultValue={p.review_result || ""} /></label>
                    <button className="wd-primary">保存する</button>
                  </form>
                </details>}
              </section>
            )}
          </article>;
        })}
      </div>
    </section>
  );
}
