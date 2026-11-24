import { adoptImprovement } from "@/lib/dock-actions";
import { getProjects,getWorkspaceMembers } from "@/lib/data";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { getActiveWorkspaceId } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { DockGate } from "@/components/DockGate";
export default async function Improvements(){
  if(await getActiveWorkspaceId()!==WITH_DOCK_ID) notFound();
  if(!await dockTeamMember()) return <DockGate/>;
  const {data,error}=await db.from("dock_improvements").select("id,title,detail,task_id").order("created_at",{ascending:false});
  if(error) throw new Error("改善提案を取得できませんでした。");
  const [projects,members]=await Promise.all([getProjects(),getWorkspaceMembers()]);
  return <section className="space-y-4"><h1 className="text-xl font-bold">改善提案</h1>
    {!data.length&&<p>承認された改善提案はまだありません。</p>}{data.map(p=><article key={p.id} className="card space-y-2 p-4"><h2 className="font-bold">{p.title}</h2><p>{p.detail}</p><p className="text-sm">{p.task_id?"タスク登録済み":"採用検討中"}</p>{!p.task_id&&<details><summary>実装タスクにする</summary><form action={adoptImprovement} className="grid gap-2 sm:grid-cols-2"><input type="hidden" name="improvement" value={p.id}/><label>登録先<select name="project" required className="field"><option value="">案件を選ぶ</option>{projects.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>担当<select name="owner" required className="field"><option value="">担当者を選ぶ</option>{members.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>期限<input name="due" type="date" required className="field"/></label><button>タスクを登録</button></form></details>}</article>)}</section>
}
