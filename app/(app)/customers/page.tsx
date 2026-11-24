import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockTeamMember } from "@/lib/dock-team";
import { db } from "@/lib/supabase";
import { DockGate } from "@/components/DockGate";
import { addCustomer } from "@/lib/dock-actions";
export default async function Customers({
  searchParams,
}: PageProps<"/customers">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  if (!(await dockTeamMember())) return <DockGate />;
  const { q, id, stage } = await searchParams;
  const [list, projects] = await Promise.all([
    db.from("dock_customers").select("*").order("name"),
    db
      .from("tm_projects")
      .select("id,title,phase,archived,dock_customer_id")
      .eq("workspace_id", WITH_DOCK_ID),
  ]);
  if (list.error || projects.error)
    throw new Error("顧客情報を取得できませんでした。");
  const visible = list.data.filter(
    (c) => (!q || c.name.includes(String(q))) && (!stage || c.stage === stage),
  );
  const selected = id ? visible.find((c) => c.id === id) : visible[0];
  const history = selected
    ? await db
        .from("dock_history")
        .select("*")
        .eq("customer_id", selected.id)
        .order("created_at", { ascending: false })
    : null;
  if (history?.error) throw new Error("顧客履歴を取得できませんでした。");
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">顧客理解</h1>
      <nav className="wd-tabs">
        {Object.entries({
          "": "すべての顧客",
          lead: "リスト段階",
          negotiation: "商談中",
        }).map(([key, label]) => (
          <Link
            href={"/customers?stage=" + key}
            key={key}
            aria-current={(stage || "") === key ? "page" : undefined}
          >
            {label} {list.data.filter((c) => !key || c.stage === key).length}
          </Link>
        ))}
      </nav>
      <details className="card p-4">
        <summary>顧客を登録</summary>
        <form action={addCustomer} className="space-y-2">
          <label className="label">
            顧客名
            <input required className="field" name="name" />
          </label>
          <label className="label">
            状況
            <select className="field" name="stage">
              <option value="lead">リスト段階</option>
              <option value="negotiation">商談中</option>
              <option value="active">取引中</option>
            </select>
          </label>
          <label className="label">
            事業背景・関心
            <textarea name="summary" className="field" />
          </label>
          <label className="label">
            次のアクション
            <input name="next_action" className="field" />
          </label>
          <button className="text-brand">登録する</button>
        </form>
      </details>
      <div className="wd-customer">
        <section className="wd-panel">
          <h2 className="wd-title">顧客一覧</h2>{" "}
          <form id="search" className="flex gap-2">
            <input type="hidden" name="stage" value={String(stage || "")} />
            <input
              className="field"
              name="q"
              aria-label="顧客名"
              placeholder="顧客名で検索"
              defaultValue={String(q || "")}
            />
            <button>検索</button>
          </form>
          <nav>
            {visible.map((c) => (
              <Link
                key={c.id}
                className={"wd-row " + (c.id === selected?.id ? "wd-note" : "")}
                href={
                  "/customers?" +
                  new URLSearchParams({
                    id: c.id,
                    stage: String(stage || ""),
                    q: String(q || ""),
                  })
                }
              >
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.stage === "lead"
                      ? "リスト段階"
                      : c.stage === "negotiation"
                        ? "商談中"
                        : "取引中"}
                    　{c.next_action}
                  </small>
                </span>
                →
              </Link>
            ))}
            {!visible.length && (
              <p className="wd-empty">該当する顧客はありません。</p>
            )}
          </nav>
        </section>
        <article className="wd-panel">
          {selected ? (
            <>
              <h2 className="wd-title">{selected.name}｜顧客理解</h2>
              <div className="wd-three">
                {[
                  ["地域", selected.prefecture],
                  ["住所", selected.address],
                  ["連絡先", selected.email || selected.phone],
                ].map(([label, value]) => (
                  <div key={label} className="wd-note">
                    <small>{label}</small>
                    <b className="block">{value || "未登録"}</b>
                  </div>
                ))}
              </div>
              <div className="wd-note my-3">
                <b>この顧客について</b>
                <p>{selected.summary || "概要は未登録です。"}</p>
              </div>
              <p className="wd-row">
                次のアクション<b>{selected.next_action || "未設定"}</b>
              </p>
              <div className="wd-row">
                関連案件
                <span>
                  {projects.data
                    .filter((p) => p.dock_customer_id === selected.id)
                    .map((p) => (
                      <Link
                        key={p.id}
                        className="block"
                        href={"/projects/" + p.id}
                      >
                        {p.title} →
                      </Link>
                    ))}
                </span>
              </div>
              {selected.history_url?.startsWith("https://") && (
                <a className="wd-row" href={selected.history_url}>
                  顧客履歴ドキュメントを開く ↗
                </a>
              )}
              <h3 className="wd-title mt-4">最近の情報更新</h3>
              {history?.data?.map((h) => (
                <p className="wd-row" key={h.id}>
                  {h.created_at.slice(0, 10)}　{h.body}{" "}
                  {h.source_url?.startsWith("https://") && (
                    <a href={h.source_url}>原文 ↗</a>
                  )}
                </p>
              ))}
              {!history?.data?.length && (
                <p className="wd-empty">履歴はまだありません。</p>
              )}
            </>
          ) : (
            <>
              <h2 className="wd-title">顧客の詳細</h2>
              <p className="wd-empty">
                顧客を登録すると、概要と履歴をここで確認できます。
              </p>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
