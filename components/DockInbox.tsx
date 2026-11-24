import Link from "next/link";
import { reviewProposal } from "@/lib/dock-actions";
import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { getProjects,getWorkspaceMembers } from "@/lib/data";

const kinds:Record<string,string>={customer:"顧客",project:"案件",task:"タスク",improvement:"改善提案"};
export async function DockInbox({state}:{state:string}) {
  if (!await dockTeamMember()) return <Link href="/login">with dockのチーム用合言葉でログイン</Link>;
  const [proposals,customers,projects,members]=await Promise.all([
    db.from("dock_proposals").select("*").eq("state",state).order("created_at",{ascending:false}),
    db.from("dock_customers").select("id,name").order("name"),getProjects(),getWorkspaceMembers()
  ]);
  if(proposals.error || customers.error) throw new Error("候補を取得できませんでした。");
  return <section className="space-y-3"><h2 className="font-bold">会議からの提案</h2>
    <nav className="flex gap-4">{Object.entries({pending:"承認待ち",held:"保留",archived:"削除済み",approved:"承認済み"}).map(([key,label])=><Link className="underline" key={key} href={"/inbox?state="+key} aria-current={key===state?"page":undefined}>{label}</Link>)}</nav>
    {!proposals.data.length && <p className="text-sm">この状態の提案はありません。</p>}
    {proposals.data.map(p=><details key={p.id} className="card p-4"><summary className="cursor-pointer font-bold">{kinds[p.kind]}　{p.title}</summary>
      <p className="mt-2 text-sm">{p.proposed.subject || "対象未定"} · {p.meeting_date} · 確かさ {({high:"高",medium:"中",low:"低"} as Record<string,string>)[p.confidence]}</p>
      <blockquote className="my-2 border-l-2 pl-3">{p.quote}</blockquote><a href={"https://withdock-workspace.vercel.app/#meetings/"+p.meeting_key} className="text-brand underline">{p.meeting_title}</a>
      <form action={reviewProposal} className="mt-3 space-y-2"><input type="hidden" name="id" value={p.id}/><input type="hidden" name="version" value={p.version}/>
      {["pending","held"].includes(state) && <>
        <label className="label">反映する内容<input className="field" name="title" defaultValue={p.title} required/></label>
        {["customer","project"].includes(p.kind) && <label className="label">対象顧客<select className="field" name="customer" required={p.kind==="project"}><option value="">{p.kind==="customer"?"新しい顧客":"選択してください"}</option>{customers.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {p.kind==="customer" && <label className="label">新規の場合の顧客名<input className="field" name="name" defaultValue={p.proposed.subject || ""}/></label>}
        {["task","project"].includes(p.kind) && <label className="label">登録先案件<select className="field" name="project" required={p.kind==="task"}><option value="">{p.kind==="project"?"新規案件":"選択してください"}</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>}
        {p.kind==="task" && <><label className="label">担当（発言　{p.proposed.owner || "未指定"}）<select name="owner" className="field" required defaultValue={members.find(m=>m.name===p.proposed.owner)?.id || ""}><option value="">担当を選択</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="label">期限（発言　{p.proposed.timing || "未指定"}）<input className="field" type="date" name="due" required/></label></>}
        <div className="flex gap-4"><button className="text-brand font-bold" name="decision" value="approved">内容を承認して反映</button><button formNoValidate name="decision" value={state==="held"?"pending":"held"}>{state==="held"?"承認待ちに戻す":"保留"}</button><button formNoValidate name="decision" value="archived">削除</button></div></>}
        {state==="archived" && <button name="decision" value="restore">復元</button>}
      </form></details>)}</section>;
}
