import Link from "next/link";
import { db } from "@/lib/supabase";
import { dockAccess } from "@/lib/dock-access";
import { dockFinance } from "@/lib/dock-finance-data";
import { paymentBalance } from "@/lib/dock-cash";
import { dockToday } from "@/lib/dock-project";
import { money } from "./DockCharts";
import { addContract, addPayment, assignCustomer, saveRecurringRate, saveRecurringEnd } from "@/lib/dock-actions";
import { DockGate } from "./DockGate";
export async function DockContract({
  id,
  customer,
  legal,
  legacyAmounts,
}: {
  id: string;
  customer?: string | null;
  legal?: string | null;
  legacyAmounts: { label: string; value: number }[];
}) {
  const access = await dockAccess();
  if (!access) return <DockGate />;
  const [customers, contracts, finance] = await Promise.all([
    db.from("dock_customers").select("id,name").order("name"),
    access.view_finance ? db
      .from("dock_contracts")
      .select(
        "id,legal_name,kind,scope,free_support_terms,starts_on,ends_on,dock_recurring_rates(effective_on,amount,day_of_month)",
      )
      .eq("project_id", id) : { data: [], error: null },
    access.view_finance ? dockFinance(dockToday().slice(0, 7)) : null,
  ]);
  if (customers.error || contracts.error)
    throw new Error("顧客・契約の読み込みに失敗しました。");
  const payments = finance?.payments.filter(p => p.project === id) ?? [];
  const project = <input type="hidden" name="project" value={id} />;
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-bold">契約と顧客情報</h2>
      {legal && (
        <p className="wd-row">
          契約名義<b>{legal}</b>
        </p>
      )}
      {customer && (
        <Link
          href={"/customers?id=" + customer}
          className="text-brand underline"
        >
          顧客の背景・履歴を見る
        </Link>
      )}
      {access.edit_operations && <details open={!customer}>
        <summary>顧客の紐付けを変更</summary>
        <form action={assignCustomer} className="flex flex-wrap items-end gap-2">
          {project}
          <label>
            顧客
            <select
              className="field"
              name="customer"
              required
              defaultValue={customer || ""}
            >
              <option value="">選択してください</option>
              {customers.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button>紐付けを保存</button>
        </form>
      </details>}
      {contracts.data.map((c) => (
        <div key={c.id}>
          <strong>
            {c.legal_name} · {c.kind === "one_off" ? "単発制作" : "継続支援"}
          </strong>
          <p className="wd-row">
            提供範囲<b>{c.scope || "未登録"}</b>
          </p>
          {c.free_support_terms && <p>無償対応　{c.free_support_terms}</p>}
          {(c.starts_on || c.ends_on) && <p>契約期間　{c.starts_on || "未登録"} ～ {c.ends_on || "未登録"}</p>}
          {c.kind === "recurring" && (
            <details className="mt-2">
              <summary>月額の設定・履歴</summary>
              {c.dock_recurring_rates.slice().sort((a, b) => b.effective_on.localeCompare(a.effective_on)).map(rate => (
                <p className="wd-row" key={rate.effective_on}>{rate.effective_on}から
                  <b>{rate.amount ? money(Number(rate.amount)) + " ／ 毎月" + rate.day_of_month + "日" : "停止"}</b>
                </p>
              ))}
              {!c.dock_recurring_rates.length && <p className="wd-empty">月額は未設定です。</p>}
              {access.edit_finance && (
                <>
                <form action={saveRecurringRate} className="grid gap-2 mt-2">
                  {project}<input type="hidden" name="contract" value={c.id} />
                  <label>適用日<input type="date" className="field" name="effective_on" required /></label>
                  <label>月額（停止は0円）<input type="number" className="field" name="amount" min="0" required /></label>
                  <label>毎月の予定日<input type="number" className="field" name="day_of_month" min="1" max="31" required defaultValue="1" /></label>
                  <button className="wd-primary">月額を保存</button>
                </form>
                <form action={saveRecurringEnd} className="grid gap-2 mt-3">
                  {project}<input type="hidden" name="contract" value={c.id} />
                  <label>継続契約の終了日<input type="date" className="field" name="ends_on" defaultValue={c.ends_on || ""} min={c.starts_on || undefined} /></label>
                  <button className="wd-primary">終了日を保存</button>
                </form>
                </>
              )}
            </details>
          )}
        </div>
      ))}
      {access.view_finance && (
        <>
          <h3 className="wd-title">入金<Link href={"/cash?project=" + id + "#ledger"}>入金の詳細 →</Link></h3>
          {payments.filter(p => paymentBalance(p).remaining > 0).slice(0, 3).map(p => (
            <p className="wd-row" key={p.id}><span>{p.label}<small>{p.due_on} 予定</small></span>
              <b>残額 {money(paymentBalance(p).remaining)}</b>
            </p>
          ))}
          {!payments.some(p => paymentBalance(p).remaining > 0) && <p>残額のある入金予定はありません。</p>}
          {legacyAmounts.some(amount => amount.value > 0) && (
            <details className="wd-note mt-2">
              <summary>以前の金額欄を確認</summary>
              <p className="text-sm">入金集計には契約ごとの入金記録を使います。以前の金額は照合用に表示しています。</p>
              {legacyAmounts.filter(amount => amount.value > 0).map(amount => <p className="wd-row" key={amount.label}>{amount.label}<b>{money(amount.value)}</b></p>)}
            </details>
          )}
        </>
      )}
      {access.edit_finance && <details>
        <summary>契約を追加</summary>
        <form action={addContract} className="mt-2 grid gap-2 sm:grid-cols-2">
          {project}
          <input type="hidden" name="request" value={crypto.randomUUID()} />
          <label>
            正式契約名
            <input required name="legal_name" className="field" />
          </label>
          <label>
            区分
            <select name="kind" className="field">
              <option value="one_off">単発制作</option>
              <option value="recurring">継続支援</option>
            </select>
          </label>
          <label>
            提供範囲
            <input name="scope" className="field" />
          </label>
          <label>
            無償対応の条件
            <input name="free_support_terms" className="field" />
          </label>
          <label>
            開始日
            <input type="date" name="starts_on" className="field" />
          </label>
          <label>
            終了日
            <input type="date" name="ends_on" className="field" />
          </label>
          <button className="text-brand">契約を保存</button>
        </form>
      </details>}
      {access.edit_finance && !!contracts.data.length && (
        <details>
          <summary>入金予定を追加</summary>
          <form action={addPayment} className="mt-2 grid gap-2 sm:grid-cols-2">
            {project}
            <input type="hidden" name="request" value={crypto.randomUUID()} />
            <label>
              契約
              <select name="contract" className="field">
                {contracts.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              内訳
              <input
                name="label"
                placeholder="着手金・残金など"
                required
                className="field"
              />
            </label>
            <label>
              金額（円）
              <input
                name="amount"
                type="number"
                min="1"
                required
                className="field"
              />
            </label>
            <label>
              予定日
              <input type="date" name="due_on" required className="field" />
            </label>
            <label>
              確度
              <select name="certainty" className="field">
                <option value="confirmed">確定</option>
                <option value="estimated">契約済み・日程調整中</option>
              </select>
            </label>
            <button className="text-brand">予定を保存</button>
          </form>
        </details>
      )}
    </section>
  );
}
