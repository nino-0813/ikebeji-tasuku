import Link from "next/link";
import { dockTeamMember } from "@/lib/dock-team";
import { db } from "@/lib/supabase";
import { registerProject } from "@/lib/dock-actions";
import { DockGate } from "@/components/DockGate";
export const dynamic = "force-dynamic";
export default async function NewProject(){
  if(!await dockTeamMember()) return <DockGate/>;
  const {data,error}=await db.from("dock_customers").select("id,name").order("name");
  if(error) throw new Error("顧客を取得できませんでした。");
  return <section className="max-w-xl space-y-4"><h1 className="text-xl font-bold">新規案件</h1><form action={registerProject} className="card space-y-4 p-5">
    <label className="label">顧客<select name="customer" required className="field"><option value="">選択してください</option>{data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <Link href="/customers" className="text-brand underline">新しい顧客を登録</Link>
    <label className="label">案件名<input name="title" required className="field"/></label><label className="label">状態<select name="phase" className="field"><option value="production">制作中</option><option value="maintenance">伴走中</option></select></label><button className="rounded bg-brand px-4 py-2 text-white">案件を登録</button>
  </form></section>;
}
