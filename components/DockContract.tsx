import Link from "next/link";
import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { addContract, addPayment, assignCustomer } from "@/lib/dock-actions";
import { DockGate } from "./DockGate";
export async function DockContract({
  id,
  customer,
  legal,
}: {
  id: string;
  customer?: string | null;
  legal?: string | null;
}) {
  if (!(await dockTeamMember())) return <DockGate />;
  const [customers, contracts] = await Promise.all([
    db.from("dock_customers").select("id,name").order("name"),
    db
      .from("dock_contracts")
      .select(
        "id,legal_name,kind,scope,free_support_terms,starts_on,ends_on,dock_payments(id,label,due_on,amount,received_on,received_amount)",
      )
      .eq("project_id", id),
  ]);
  if (customers.error || contracts.error)
    throw new Error("顧客・契約の読み込みに失敗しました。");
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
      <details open={!customer}>
        <summary>顧客の紐付けを変更</summary>
        <form action={assignCustomer} className="flex items-end gap-2">
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
      </details>
      {contracts.data.map((c) => (
        <div key={c.id}>
          <strong>
            {c.legal_name} · {c.kind === "one_off" ? "単発制作" : "継続支援"}
          </strong>
          <p className="wd-row">
            提供範囲<b>{c.scope || "未登録"}</b>
          </p>
          {c.free_support_terms && <p>無償対応　{c.free_support_terms}</p>}
        </div>
      ))}
      <h3 className="wd-title">
        お金の流れ<Link href="/cash">入金の詳細 →</Link>
      </h3>
      {contracts.data.flatMap((c) =>
        (c.dock_payments || []).map((p) => (
          <p className="wd-row" key={p.id}>
            <span>
              {p.label}
              <small>{p.due_on} 予定</small>
            </span>
            <b>
              ¥{Number(p.amount).toLocaleString()}
              <small>{p.received_on ? "入金済" : "未入金"}</small>
            </b>
          </p>
        )),
      )}
      {!contracts.data.some((c) => c.dock_payments?.length) && (
        <p>入金予定は未登録です。</p>
      )}
      <details>
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
      </details>
      {!!contracts.data.length && (
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
                <option value="estimated">想定</option>
              </select>
            </label>
            <button className="text-brand">予定を保存</button>
          </form>
        </details>
      )}
    </section>
  );
}
