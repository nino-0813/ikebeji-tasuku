import { signOut } from "@/lib/actions";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId,getWorkspaceMembers } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockTeamMember } from "@/lib/dock-team";
import { DockGate } from "@/components/DockGate";
import { db } from "@/lib/supabase";
export default async function Settings(){
  if(await getActiveWorkspaceId()!==WITH_DOCK_ID) notFound();
  if(!await dockTeamMember()) return <DockGate/>;
  const [members,last]=await Promise.all([getWorkspaceMembers(),db.from("dock_proposals").select("created_at").order("created_at",{ascending:false}).limit(1)]);
  if(last.error) throw new Error("受信履歴を取得できませんでした。");
  return <section className="space-y-4"><h1 className="text-xl font-bold">設定・連携</h1><section className="card p-4"><h2 className="font-bold">チーム権限</h2>{members.map(m=><p className="mt-2" key={m.id}><span style={{color:m.color}}>●</span>　{m.id==="goda"?"合田":m.name}　閲覧・承認</p>)}</section><section className="card space-y-2 p-4"><h2 className="font-bold">議事録の取り込み</h2><p>Google Drive → With Dock Workspace → インボックス</p><p>4分類の候補を最後に受信した日時　{last.data?.[0]?new Date(last.data[0].created_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"受信記録なし"}</p></section><form action={signOut}><button className="rounded-lg border px-4 py-2">ログアウト</button></form></section>
}
