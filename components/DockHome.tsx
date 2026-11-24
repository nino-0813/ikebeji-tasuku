import Link from "next/link";
import { db } from "@/lib/supabase";
import { getTasks,getProjects } from "@/lib/data";
import { dockTeamMember } from "@/lib/dock-team";
import { DockGate } from "./DockGate";
export async function DockHome(){
  const member=await dockTeamMember();
  if(!member)return <DockGate/>;
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date());
  const start=today.slice(0,7)+"-01";
  const end=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),1)).toISOString().slice(0,10);
  const [tasks,projects,pending,paid,targets]=await Promise.all([getTasks(),getProjects(),
    db.from("dock_proposals").select("id",{count:"exact",head:true}).eq("state","pending"),
    db.from("dock_payments").select("received_amount").gte("received_on",start).lt("received_on",end),
    db.from("dock_monthly_targets").select("amount").eq("month",start)]);
  if(pending.error||paid.error||targets.error)throw new Error("ホームを取得できませんでした。");
  const due=tasks.filter(t=>t.status!=="done"&&t.owner_id===member&&t.due_date<=today).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const receipts=paid.data.reduce((n,p)=>n+Number(p.received_amount),0),target=targets.data.reduce((n,p)=>n+Number(p.amount),0);
  return <div className="space-y-6"><header><p className="text-sm text-ink-mute">{today}</p><h1 className="text-2xl font-bold">今日の全体像</h1></header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["承認待ちの提案",(pending.count||0)+"件","/inbox"],["期限を迎えた担当作業",due.length+"件","#due"],["今月の実入金",receipts.toLocaleString()+"円","/cash"],["目標まで",targets.data.length?Math.max(0,target-receipts).toLocaleString()+"円":"目標未設定","/cash"]].map(([label,value,url])=><Link href={url} key={label} className="card p-4"><p className="text-sm">{label}</p><strong className="text-xl">{value}</strong></Link>)}</div>
    <section id="due" className="space-y-2"><h2 className="font-bold">今日確認する作業</h2>{due.length?due.map(t=><Link className="card block p-3" href={t.project_id?"/projects/"+t.project_id:"/today"} key={t.id}>{t.title}　{t.due_date}</Link>):<p>期限を迎えた担当作業はありません。</p>}</section>
    <section><h2 className="mb-2 font-bold">進行中の案件</h2><div className="grid gap-2 sm:grid-cols-3">{projects.filter(p=>p.phase!=="sales").map(p=><Link key={p.id} href={"/projects/"+p.id} className="card p-3">{p.title}<small className="block">{p.phase==="maintenance"?"伴走中":"制作中"}</small></Link>)}</div></section></div>;
}
