import { OutlookChart, money } from "@/components/DockCharts";
import { receivePayment, saveTarget } from "@/lib/dock-actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { dockTeamMember } from "@/lib/dock-team";
import { db } from "@/lib/supabase";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { cashOutlook, type FeeKind } from "@/lib/dock-cash";

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});
export default async function CashPage({ searchParams }: PageProps<"/cash">) {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  if (!(await dockTeamMember()))
    return (
      <section>
        <h1>目標・入金</h1>
        <p>with dockのチーム用合言葉でログインしてください。</p>
      </section>
    );
  const query = await searchParams;
  const kind =
    query.kind === "one_off" || query.kind === "recurring"
      ? query.kind
      : undefined;
  const month = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const last = cashOutlook(month, [], []).at(-1)!.month;
  const end = new Date(
    Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5)), 1),
  )
    .toISOString()
    .slice(0, 10);
  const start = month + "-01";
  const [targets, payments] = await Promise.all([
    db
      .from("dock_monthly_targets")
      .select("month,kind,amount")
      .gte("month", start)
      .lt("month", end),
    db
      .from("dock_payments")
      .select(
        "id,label,amount,due_on,received_amount,received_on,certainty,dock_contracts!inner(kind,legal_name)",
      )
      .or(`due_on.gte.${start},received_on.gte.${start},received_on.is.null`)
      .order("due_on"),
  ]);
  if (targets.error || payments.error)
    throw new Error("入金情報を取得できませんでした。");
  const rows = payments.data.map((p) => {
    const c = Array.isArray(p.dock_contracts)
      ? p.dock_contracts[0]
      : p.dock_contracts;
    return { ...p, kind: c.kind as FeeKind, customer: c.legal_name };
  });
  const outlook = cashOutlook(month, targets.data, rows, kind);
  const current = outlook[0];
  return (
    <section className="wd-stack">
      <h1 className="text-xl font-bold">目標・入金</h1>
      <div className="wd-toolbar">
        <nav className="wd-tabs">
          {[
            ["", "入金ベース"],
            ["one_off", "単発制作費"],
            ["recurring", "継続支援費"],
          ].map(([key, label]) => (
            <Link
              key={label}
              aria-current={(kind || "") === key ? "page" : undefined}
              href={key ? "/cash?kind=" + key : "/cash"}
            >
              {label}
            </Link>
          ))}
        </nav>
        <details className="wd-edit">
          <summary className="wd-primary">月別目標を編集</summary>
          <form action={saveTarget} className="mt-3 grid gap-3 sm:grid-cols-4">
            <label>
              対象月
              <input
                required
                className="field"
                type="month"
                name="month"
                defaultValue={month}
              />
            </label>
            <label>
              区分
              <select name="kind" className="field">
                <option value="one_off">単発制作費</option>
                <option value="recurring">継続支援費</option>
              </select>
            </label>
            <label>
              目標額（円）
              <input
                required
                className="field"
                name="amount"
                type="number"
                min="0"
                step="1"
              />
            </label>
            <button>目標を保存</button>
          </form>
        </details>
      </div>
      <div className="wd-three">
        {[
          ["今月の目標", money(current.target)],
          ["今月の実入金", money(current.received)],
          ["今月の入金見込み", money(current.forecast)],
        ].map(([label, value]) => (
          <div key={label} className="wd-panel wd-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <OutlookChart rows={outlook} />
      <section className="wd-panel">
        <h2 className="wd-title">入金予定の内訳</h2>
        {rows
          .filter((r) => !kind || r.kind === kind)
          .map((r) => (
            <div key={r.id} className="wd-ledger">
              <div>
                <small>{r.due_on}</small>
                <strong>
                  {r.customer}｜{r.label}
                </strong>
                <small>{r.kind === "one_off" ? "単発" : "継続"}</small>
                <b>
                  {yen.format(
                    r.received_on ? r.received_amount || 0 : r.amount,
                  )}
                </b>
                <span>
                  {r.received_on
                    ? "入金済"
                    : r.certainty === "confirmed"
                      ? "確定予定"
                      : "想定"}
                </span>
              </div>
              {!r.received_on && (
                <details>
                  <summary>入金を記録</summary>
                  <form
                    action={receivePayment}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="payment" value={r.id} />
                    <label>
                      実入金日
                      <input
                        className="field"
                        type="date"
                        name="received_on"
                        required
                      />
                    </label>
                    <label>
                      実入金額（円）
                      <input
                        className="field"
                        type="number"
                        min="1"
                        name="received_amount"
                        required
                        defaultValue={r.amount}
                      />
                    </label>
                    <button>記録する</button>
                  </form>
                </details>
              )}
            </div>
          ))}
        {!rows.some((r) => !kind || r.kind === kind) && (
          <p className="wd-empty">この期間の入金予定はありません。</p>
        )}
      </section>
    </section>
  );
}
