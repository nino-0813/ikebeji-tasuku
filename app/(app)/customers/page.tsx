import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockAccess } from "@/lib/dock-access";
import { db } from "@/lib/supabase";
import { DockGate } from "@/components/DockGate";
import { addCustomer, saveCustomerForecast, updateCustomer } from "@/lib/dock-actions";
import { DockCustomerHistory } from "@/components/DockCustomerHistory";
import { money } from "@/components/DockCharts";
import { httpUrl } from "@/lib/dock-project";
export default async function Customers({
  searchParams,
}: PageProps<"/customers">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  const access = await dockAccess();
  if (!access) return <DockGate />;
  const { q, id, stage } = await searchParams;
  const [list, projects] = await Promise.all([
    db.from("dock_customers").select("id,name,stage,summary,next_action,prefecture,address,email,phone,history_url").order("name"),
    db
      .from("tm_projects")
      .select("id,title,phase,archived,dock_customer_id,client_name")
      .eq("workspace_id", WITH_DOCK_ID),
  ]);
  if (list.error || projects.error)
    throw new Error("顧客情報を取得できませんでした。");
  const visible = list.data.filter(
    (c) => (!q || c.name.includes(String(q))) && (!stage || c.stage === stage),
  );
  const selected = id ? visible.find((c) => c.id === id) : visible[0];
  const forecast = selected && access.view_finance && selected.stage !== "active"
    ? await db.from("dock_customers").select("forecast_amount,forecast_month,forecast_confidence").eq("id", selected.id).single() : null;
  if (forecast?.error) throw new Error("商談予測を取得できませんでした。");
  const sales = projects.data.filter(p => p.phase === "sales" && !p.archived && !p.dock_customer_id);
  const unlinked = projects.data.filter(p => p.phase !== "sales" && !p.archived && !p.dock_customer_id);
  return (
    <div className="wd-stack">
      <h1 className="text-xl font-bold">顧客理解</h1>
      <div className="wd-toolbar">
        <nav className="wd-tabs">
          {Object.entries({
            "": "すべての顧客",
            lead: "リスト段階",
            negotiation: "商談中",
            active: "取引中",
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
        <div className="flex gap-2 items-start">
          {access.edit_operations && <details className="wd-edit">
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
          </details>}
          {selected && (
            <a
              className="wd-primary"
              href={
                httpUrl(selected.history_url) || "#history"
              }
            >
              顧客履歴を参照 ↗
            </a>
          )}
        </div>
      </div>
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
              <h2 className="wd-title">
                {selected.name}｜顧客理解{" "}
                <small>顧客ID {selected.id.slice(0, 8)}</small>
              </h2>
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
              {access.edit_operations && (
                <details className="mt-4">
                  <summary>顧客情報を更新・履歴を追加</summary>
                  <form action={updateCustomer} className="mt-2 grid gap-2">
                    <input type="hidden" name="customer" value={selected.id} />
                    <input type="hidden" name="request" value={crypto.randomUUID()} />
                    <label>状況<select className="field" name="stage" defaultValue={selected.stage}>
                      <option value="lead">リスト段階</option><option value="negotiation">商談中</option><option value="active">取引中</option>
                    </select></label>
                    <label>事業背景<textarea className="field" name="summary" defaultValue={selected.summary} /></label>
                    <label>次のアクション<input className="field" name="next_action" defaultValue={selected.next_action} /></label>
                    <label>顧客履歴のDrive URL<input className="field" type="url" name="history_url" defaultValue={selected.history_url || ""} /></label>
                    <label>履歴の種類<select className="field" name="source_kind"><option value="manual">手動更新</option><option value="meeting">会議</option></select></label>
                    <label>履歴メモ<textarea className="field" name="note" /></label>
                    <label>履歴の原文URL<input className="field" type="url" name="source_url" /></label>
                    <button className="wd-primary">顧客情報を保存</button>
                  </form>
                </details>
              )}
              {forecast?.data && (
                <section className="mt-4">
                  <h3 className="wd-title">商談予測</h3>
                  <p>{forecast.data.forecast_month?.slice(0, 7)}　{money(forecast.data.forecast_amount)}</p>
                  {access.edit_finance && (
                    <details className="mt-2">
                      <summary>商談予測を編集</summary>
                      <form action={saveCustomerForecast} className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="customer" value={selected.id} />
                        <label>見込月<input type="month" className="field" name="month" defaultValue={forecast.data.forecast_month?.slice(0, 7) || ""} /></label>
                        <label>金額（空欄で予測を解除）<input type="number" min="1" className="field" name="amount" defaultValue={forecast.data.forecast_amount ?? ""} /></label>
                        <label>確度<select className="field" name="confidence" defaultValue={forecast.data.forecast_confidence || "medium"}>
                          <option value="low">低</option><option value="medium">中</option><option value="high">高</option>
                        </select></label>
                        <button className="wd-primary">商談予測を保存</button>
                      </form>
                    </details>
                  )}
                </section>
              )}
              <DockCustomerHistory customer={selected.id} />
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
      {unlinked.length > 0 && (
        <section className="wd-panel">
          <h2 className="wd-title">顧客未紐づけの案件 <Link href="/projects?filter=unlinked">{unlinked.length}件 →</Link></h2>
          <p className="text-sm">案件詳細から既存顧客を選んで紐づけられます。</p>
        </section>
      )}
      {sales.length > 0 && (
        <section className="wd-panel">
          <h2 className="wd-title">顧客との紐づけが必要な商談</h2>
          {sales.map(p => <Link className="wd-row" key={p.id} href={"/projects/" + p.id}>{p.title} →</Link>)}
        </section>
      )}
    </div>
  );
}
