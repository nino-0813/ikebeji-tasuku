import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockTeamMember } from "@/lib/dock-team";
import { db } from "@/lib/supabase";
import { DockGate } from "@/components/DockGate";
import { addCustomer } from "@/lib/dock-actions";
export default async function Customers({searchParams}:PageProps<"/customers">) {
  if(await getActiveWorkspaceId()!==WITH_DOCK_ID) notFound();
  if(!await dockTeamMember()) return <DockGate/>;
  const {q,id}=await searchParams;
  const [list,projects]=await Promise.all([
    db.from("dock_customers").select("*").order("name"),
    db.from("tm_projects").select("id,title,phase,archived,dock_customer_id").eq("workspace_id",WITH_DOCK_ID)
  ]);
  if(list.error||projects.error) throw new Error("顧客情報を取得できませんでした。");
  const visible=list.data.filter(c=>!q || c.name.includes(String(q)));
  const selected=id?list.data.find(c=>c.id===id):visible[0];
  const history=selected?await db.from("dock_history").select("*").eq("customer_id",selected.id).order("created_at",{ascending:false}):null;
  if(history?.error) throw new Error("顧客履歴を取得できませんでした。");
  return <div className="space-y-5"><h1 className="text-xl font-bold">顧客理解</h1>
    <form className="flex gap-2"><input className="field" name="q" aria-label="顧客名" placeholder="顧客名で検索" defaultValue={String(q||"")}/><button>検索</button></form>
    <details className="card p-4"><summary>顧客を登録</summary><form action={addCustomer} className="space-y-2"><label className="label">顧客名<input required className="field" name="name"/></label><label className="label">状況<select className="field" name="stage"><option value="lead">リスト段階</option><option value="negotiation">商談中</option><option value="active">取引中</option></select></label><label className="label">事業背景・関心<textarea name="summary" className="field"/></label><label className="label">次のアクション<input name="next_action" className="field"/></label><button className="text-brand">登録する</button></form></details>
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]"><nav className="card space-y-1 p-3">{visible.map(c=><Link key={c.id} className="block rounded p-2 hover:bg-stone-100" href={"/customers?id="+c.id}>{c.name}</Link>)}{!visible.length&&"該当する顧客はありません。"}</nav>
    {selected&&<article className="card space-y-3 p-5"><h2 className="text-lg font-bold">{selected.name}</h2><p>{selected.summary}</p><p>次のアクション　{selected.next_action||"未設定"}</p><h3 className="font-bold">関連案件</h3>{projects.data.filter(p=>p.dock_customer_id===selected.id).map(p=><Link key={p.id} className="block text-brand" href={"/projects/"+p.id}>{p.title} {p.archived?"（完了）":""}</Link>)}<h3 className="font-bold">顧客履歴</h3>{history?.data?.map(h=><p key={h.id}>{h.created_at.slice(0,10)}　{h.body} {h.source_url?.startsWith("https://")&&<a className="underline" href={h.source_url}>原文</a>}</p>)}</article>}</div></div>;
}
