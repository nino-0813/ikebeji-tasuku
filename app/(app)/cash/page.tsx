import { receivePayment,saveTarget } from "@/lib/dock-actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { dockTeamMember } from "@/lib/dock-team";
import { db } from "@/lib/supabase";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { cashOutlook, type FeeKind } from "@/lib/dock-cash";

const yen = new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY"});
export default async function CashPage({searchParams}:PageProps<"/cash">) {
  if (await getActiveWorkspaceId() !== WITH_DOCK_ID) notFound();
  if (!await dockTeamMember()) return <section><h1>目標・入金</h1><p>with dockのチーム用合言葉でログインしてください。</p></section>;
  const query = await searchParams;
  const kind = query.kind === "one_off" || query.kind === "recurring" ? query.kind : undefined;
  const month = new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit"}).format(new Date());
  const last = cashOutlook(month,[],[]).at(-1)!.month;
  const end = new Date(Date.UTC(Number(last.slice(0,4)),Number(last.slice(5)),1)).toISOString().slice(0,10);
  const start = month+"-01";
  const [targets,payments] = await Promise.all([
    db.from("dock_monthly_targets").select("month,kind,amount").gte("month",start).lt("month",end),
    db.from("dock_payments").select("id,label,amount,due_on,received_amount,received_on,certainty,dock_contracts!inner(kind,legal_name)")
      .or(`and(due_on.gte.${start},due_on.lt.${end}),and(received_on.gte.${start},received_on.lt.${end})`).order("due_on")
  ]);
  if (targets.error || payments.error) throw new Error("入金情報を取得できませんでした。");
  const rows = payments.data.map(p=>{
    const c=Array.isArray(p.dock_contracts)?p.dock_contracts[0]:p.dock_contracts;
    return {...p,kind:c.kind as FeeKind,customer:c.legal_name};
  });
  return <section className="space-y-5"><h1 className="text-xl font-bold">目標・入金</h1>
    <details className="card p-3"><summary>月別目標を編集</summary><form action={saveTarget} className="mt-3 grid gap-3 sm:grid-cols-4"><label>対象月<input required className="field" type="month" name="month" defaultValue={month}/></label><label>区分<select name="kind" className="field"><option value="one_off">単発制作費</option><option value="recurring">継続支援費</option></select></label><label>目標額（円）<input required className="field" name="amount" type="number" min="0" step="1"/></label><button>目標を保存</button></form></details>
    <nav className="flex gap-4">{[["","すべて"],["one_off","単発制作費"],["recurring","継続支援費"]].map(([key,label])=><Link key={label} aria-current={(kind||"")===key?"page":undefined} className="text-brand underline" href={key?"/cash?kind="+key:"/cash"}>{label}</Link>)}</nav>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cashOutlook(month,targets.data,rows,kind).map(row=><section className="card space-y-2 p-4" key={row.month}><h2 className="font-bold">{row.month}</h2><p>目標　{row.target===null?"未設定":yen.format(row.target)}</p><p>実入金　{yen.format(row.received)}</p><p>月の着地見込み　{yen.format(row.forecast)}</p><small>未入金の内訳　確定 {yen.format(row.confirmed)}・想定 {yen.format(row.estimated)}</small></section>)}</div>
    <h2 className="font-bold">入金の内訳</h2>{rows.filter(r=>!kind||r.kind===kind).map(r=><div key={r.id} className="border-b py-2">{r.customer} · {r.label}　予定 {r.due_on}　{yen.format(r.amount)}　{r.received_on?"入金 "+r.received_on:"未入金"}{!r.received_on && <details><summary>入金を記録</summary><form action={receivePayment} className="flex flex-wrap items-end gap-2"><input type="hidden" name="payment" value={r.id}/><label>実入金日<input className="field" type="date" name="received_on" required/></label><label>実入金額（円）<input className="field" type="number" min="1" name="received_amount" required defaultValue={r.amount}/></label><button>記録する</button></form></details>}</div>)}
  </section>;
}
