import { OutlookChart, money } from "@/components/DockCharts";
import { receivePayment, saveTarget } from "@/lib/dock-actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { dockAccess } from "@/lib/dock-access";
import { DockGate } from "@/components/DockGate";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { cashOutlook, paymentBalance } from "@/lib/dock-cash";
import { dockFinance } from "@/lib/dock-finance-data";
import { dockToday } from "@/lib/dock-project";

export default async function CashPage({ searchParams }: PageProps<"/cash">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  const access = await dockAccess();
  if (!access) return <DockGate />;
  if (!access.view_finance) return <p className="wd-panel">入金情報を閲覧する権限はありません。</p>;
  const query = await searchParams;
  const kind = query.kind === "one_off" || query.kind === "recurring" ? query.kind : undefined;
  const project = typeof query.project === "string" ? query.project : undefined;
  const today = dockToday();
  const month = today.slice(0, 7);
  const { targets, payments, sales } = await dockFinance(month);
  const outlook = cashOutlook(month, targets, payments, sales, kind);
  const current = outlook[0];
  const rows = payments.filter(p => (!kind || kind === p.kind) && (!project || p.project === project));
  const metrics = [
    ["今月の目標", current.target], ["今月の実入金", current.received],
    ["契約済み予定の残額", current.committed],
    ...(!kind ? [["商談予測", current.sales] as const] : []),
  ] as const;
  return (
    <section className="wd-stack">
      <div className="wd-toolbar">
        <nav className="wd-tabs" aria-label="入金の区分">
          {[
            ["", "すべて"], ["one_off", "単発制作費"], ["recurring", "継続支援費"],
          ].map(([key, label]) => {
            const params = new URLSearchParams();
            if (key) params.set("kind", key);
            if (project) params.set("project", project);
            return <Link key={label} aria-current={(kind || "") === key ? "page" : undefined} href={"/cash?" + params}>{label}</Link>;
          })}
        </nav>
        {access.edit_finance && (
          <details className="wd-edit">
            <summary className="wd-primary">月別目標を編集</summary>
            <form action={saveTarget} className="mt-3 grid gap-3 sm:grid-cols-4">
              <label>対象月<input required className="field" type="month" name="month" defaultValue={month} /></label>
              <label>区分<select name="kind" className="field" defaultValue={kind}>
                <option value="one_off">単発制作費</option><option value="recurring">継続支援費</option>
              </select></label>
              <label>目標額（円）<input required className="field" name="amount" type="number" min="0" step="1" /></label>
              <button className="wd-primary">目標を保存</button>
            </form>
          </details>
        )}
      </div>
      <div className="wd-four">
        {metrics.map(([label, value]) => (
          <div key={label} className="wd-panel wd-stat"><span>{label}</span><strong>{money(value)}</strong></div>
        ))}
      </div>
      <OutlookChart rows={outlook} />
      {!kind && (
        <section className="wd-panel">
          <h2 className="wd-title">商談予測</h2>
          {sales.map(row => (
            <Link className="wd-row" key={row.id} href={"/customers?id=" + row.id}>
              <span>{row.name}<small>{row.month.slice(0, 7)} ｜ 確度 {({ low: "低", medium: "中", high: "高" } as Record<string, string>)[row.confidence]}</small></span>
              <strong>{money(row.amount)} →</strong>
            </Link>
          ))}
          {!sales.length && <p className="wd-empty">対象期間の商談予測はありません。</p>}
        </section>
      )}
      <section className="wd-panel" id="ledger">
        <h2 className="wd-title">入金予定・実入金の内訳 {project && <Link href="/cash#ledger">全案件を表示 →</Link>}</h2>
        {rows.map(row => {
          const balance = paymentBalance(row);
          return (
            <article key={row.id} className="wd-ledger">
              <div>
                <small>{row.due_on}</small>
                <Link className="font-bold underline" href={"/projects/" + row.project}>{row.customer}｜{row.label}</Link>
                <small>{row.kind === "one_off" ? "単発" : "継続"}{row.certainty === "estimated" ? "・日程調整中" : ""}</small>
                <strong>{balance.remaining === 0 ? "入金済み" : balance.received ? "一部入金" : "未入金"}</strong>
              </div>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                {[["予定", row.amount], ["実入金", balance.received], ["残額", balance.remaining]].map(([label, amount]) => (
                  <div key={label}><dt>{label}</dt><dd className="font-semibold">{money(Number(amount))}</dd></div>
                ))}
              </dl>
              {!!row.receipts.length && (
                <ul className="mt-2 text-sm">
                  {row.receipts.map((receipt, index) => <li key={index}>{receipt.received_on}　{money(receipt.amount)}</li>)}
                </ul>
              )}
              {access.edit_finance && balance.remaining > 0 && (
                <details className="mt-2">
                  <summary>入金を記録</summary>
                  <form action={receivePayment} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="request" value={crypto.randomUUID()} />
                    {row.period ? (
                      <><input type="hidden" name="contract" value={row.contract} /><input type="hidden" name="period" value={row.period} /></>
                    ) : <input type="hidden" name="payment" value={row.id} />}
                    <label>実入金日<input type="date" className="field" name="received_on" required max={today} defaultValue={today} /></label>
                    <label>実入金額（円）<input type="number" className="field" name="received_amount" min="1" max={balance.remaining} required defaultValue={balance.remaining} /></label>
                    <button className="wd-primary">記録する</button>
                  </form>
                </details>
              )}
            </article>
          );
        })}
        {!rows.length && <p className="wd-empty">入金の記録はありません。</p>}
      </section>
    </section>
  );
}
