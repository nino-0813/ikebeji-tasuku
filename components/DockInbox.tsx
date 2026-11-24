import Link from "next/link";
import { reviewProposal } from "@/lib/dock-actions";
import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { getProjects, getWorkspaceMembers } from "@/lib/data";

const kinds: Record<string, string> = {
  customer: "顧客",
  project: "案件",
  task: "タスク",
  improvement: "改善提案",
};
export async function DockInbox({
  state,
  kind,
  id,
}: {
  state: string;
  kind: string;
  id: string;
}) {
  if (!(await dockTeamMember()))
    return <Link href="/login">メールアドレスとパスワードでログイン</Link>;
  const [proposals, customers, projects, members] = await Promise.all([
    db
      .from("dock_proposals")
      .select("*")
      .eq("state", state)
      .order("created_at", { ascending: false }),
    db.from("dock_customers").select("id,name,summary").order("name"),
    getProjects(),
    getWorkspaceMembers(),
  ]);
  if (proposals.error || customers.error)
    throw new Error("候補を取得できませんでした。");
  const groups = new Map<string, typeof proposals.data>();
  const visible = proposals.data.filter((p) => !kind || p.kind === kind);
  const selected = visible.find((p) => p.id === id) || visible[0];
  for (const proposal of visible) {
    const key = String(proposal.proposed.subject || "未紐付け・新規相談");
    groups.set(key, [...(groups.get(key) || []), proposal]);
  }
  const href = (filter: string, selectedId = "") =>
    "/inbox?" + new URLSearchParams({ state, kind: filter, id: selectedId });
  return (
    <section className="wd-stack">
      <nav className="wd-tabs">
        {Object.entries({ "": "すべて", ...kinds }).map(([key, label]) => (
          <Link
            key={key}
            href={href(key)}
            aria-current={kind === key ? "page" : undefined}
          >
            {label}{" "}
            {proposals.data.filter((x) => !key || x.kind === key).length}
          </Link>
        ))}
        <span className="grow" />
        {Object.entries({
          pending: "承認待ち",
          held: "保留",
          archived: "削除済み",
          approved: "承認済み",
        }).map(([key, label]) => (
          <Link
            key={key}
            href={"/inbox?state=" + key}
            aria-current={state === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="wd-split">
        <section className="wd-panel">
          <h2 className="wd-title">候補一覧</h2>
          {[...groups].map(([subject, items]) => (
            <section key={subject}>
              <h3 className="wd-note font-bold">
                {subject}　{items.length}件
              </h3>
              {items.map((p) => (
                <article key={p.id} className="wd-candidate">
                  {" "}
                  <Link
                    className="wd-row"

                    aria-current={selected?.id === p.id ? "true" : undefined}
                    href={href(kind, p.id) + "#evidence"}
                  >
                    <span>
                      <small>{kinds[p.kind]} ／ 提案</small>
                      <b>{p.title}</b>
                      <small>
                        {[p.proposed.owner, p.proposed.timing]
                          .filter(Boolean)
                          .join("　｜　")}
                      </small>
                    </span>
                    →
                  </Link>
                  {selected?.id === p.id ? (
                    <details className="wd-review" open={id === p.id}>
                      <summary>内容を確認・修正</summary>{" "}
                      <form action={reviewProposal} className="mt-3 space-y-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="version" value={p.version} />
                        {["pending", "held"].includes(state) && (
                          <>
                            <label className="label">
                              反映する内容
                              <input
                                className="field"
                                name="title"
                                defaultValue={p.title}
                                required
                              />
                            </label>
                            {["customer", "project"].includes(p.kind) && (
                              <label className="label">
                                対象顧客
                                <select
                                  className="field"
                                  name="customer"
                                  defaultValue={
                                    customers.data.find(
                                      (c) => c.name === p.proposed.subject,
                                    )?.id || ""
                                  }
                                  required={p.kind === "project"}
                                >
                                  <option value="">
                                    {p.kind === "customer"
                                      ? "新しい顧客"
                                      : "選択してください"}
                                  </option>
                                  {customers.data.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {p.kind === "customer" && (
                              <label className="label">
                                新規の場合の顧客名
                                <input
                                  className="field"
                                  name="name"
                                  defaultValue={p.proposed.subject || ""}
                                />
                              </label>
                            )}
                            {["task", "project"].includes(p.kind) && (
                              <label className="label">
                                登録先案件
                                <select
                                  className="field"
                                  name="project"
                                  defaultValue={
                                    projects.find(
                                      (x) => x.title === p.proposed.subject,
                                    )?.id || ""
                                  }
                                  required={p.kind === "task"}
                                >
                                  <option value="">
                                    {p.kind === "project"
                                      ? "新規案件"
                                      : "選択してください"}
                                  </option>
                                  {projects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                      {project.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {p.kind === "task" && (
                              <>
                                <Link
                                  className="text-brand underline"
                                  href="/projects/new"
                                  target="_blank"
                                >
                                  新規案件を作成
                                </Link>
                                <label className="label">
                                  担当（発言　{p.proposed.owner || "未指定"}）
                                  <select
                                    name="owner"
                                    className="field"
                                    required
                                    defaultValue={
                                      members.find(
                                        (m) => m.name === p.proposed.owner,
                                      )?.id || ""
                                    }
                                  >
                                    <option value="">担当を選択</option>
                                    {members.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="label">
                                  期限（発言　{p.proposed.timing || "未指定"}）
                                  <input
                                    className="field"
                                    type="date"
                                    name="due"
                                    required
                                  />
                                </label>
                              </>
                            )}
                            <div className="flex gap-4">
                              <button
                                className="text-brand font-bold"
                                name="decision"
                                value="approved"
                              >
                                内容を承認して反映
                              </button>
                              <button
                                formNoValidate
                                name="decision"
                                value={state === "held" ? "pending" : "held"}
                              >
                                {state === "held" ? "承認待ちに戻す" : "保留"}
                              </button>
                              <button
                                formNoValidate
                                name="decision"
                                value="archived"
                              >
                                削除
                              </button>
                            </div>
                          </>
                        )}
                        {state === "archived" && (
                          <button name="decision" value="restore">
                            復元
                          </button>
                        )}
                      </form>
                    </details>
                  ) : (
                    <Link className="wd-review-link" href={href(kind, p.id)}>
                      内容を確認 →
                    </Link>
                  )}
                </article>
              ))}
            </section>
          ))}
          {!visible.length && (
            <p className="wd-empty">この条件の候補はありません。</p>
          )}
        </section>
        <section className="wd-panel" id="evidence">
          <h2 className="wd-title">候補の詳細・根拠</h2>
          {selected ? (
            [selected].map((p) => (
              <div key={p.id}>
                <h3 className="font-bold">{p.title}</h3>
                <p className="mt-2 text-sm">
                  {p.proposed.subject || "対象未定"} · {p.meeting_date} · 確かさ{" "}
                  {
                    (
                      { high: "高", medium: "中", low: "低" } as Record<
                        string,
                        string
                      >
                    )[p.confidence]
                  }
                </p>
                {p.kind === "customer" &&
                  customers.data.some((c) => c.name === p.proposed.subject) && (
                    <p>
                      現在の顧客概要　
                      {customers.data.find((c) => c.name === p.proposed.subject)
                        ?.summary || "未設定"}
                    </p>
                  )}
                {p.kind === "project" &&
                  projects.some((x) => x.title === p.proposed.subject) && (
                    <p>
                      現在の案件メモ　
                      {projects.find((x) => x.title === p.proposed.subject)
                        ?.detail || "未設定"}
                    </p>
                  )}
                <blockquote className="wd-note my-3">
                  <b>録音からの提案</b>
                  <p>{p.quote}</p>
                </blockquote>
                <a
                  href={
                    "https://withdock-workspace.vercel.app/#meetings/" +
                    p.meeting_key
                  }
                  className="text-brand underline"
                >
                  {p.meeting_title}
                </a>
                <div className="wd-row">
                  状態
                  <b>
                    {
                      (
                        {
                          pending: "未承認",
                          held: "保留",
                          approved: "承認済み",
                          archived: "削除済み",
                        } as Record<string, string>
                      )[state]
                    }
                  </b>
                </div>
                <p className="wd-notice">
                  承認前に元の発言と反映内容を確認してください。
                </p>
              </div>
            ))
          ) : (
            <p className="wd-empty">
              候補を選択すると、元の発言と反映内容が表示されます。
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
