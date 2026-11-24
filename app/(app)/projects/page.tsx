import { dockDeadline } from "@/lib/dock-deadline";
import Link from "next/link";
import { getAllProjects, getCurrentWorkspace, getGoals, getProjects, getTasks, getWorkspaceMembers } from "@/lib/data";
import { ProjectAccordion, NewProjectButton } from "@/components/ProjectParts";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({searchParams}:PageProps<"/projects">) {
  const [projects, tasks, members, goals, currentWorkspace] = await Promise.all([
    getProjects(),
    getTasks(),
    getWorkspaceMembers(),
    getGoals(),
    getCurrentWorkspace(),
  ]);

  if(currentWorkspace?.id==="00000000-0000-4000-8000-000000000005"){
    const tab=String((await searchParams).tab||"active");
    const all=await getAllProjects();
    const filtered=all.filter(p=>tab==="archive"?p.archived:!p.archived&&(tab==="sales"?p.phase==="sales":tab==="active"?p.phase!=="sales":p.phase===tab));
    return <section className="space-y-4"><header className="flex items-center justify-between"><h1 className="text-xl font-bold">プロジェクト</h1><Link href="/projects/new" className="rounded bg-brand px-3 py-2 text-white">＋ 新規案件</Link></header>
      <nav className="flex flex-wrap gap-3">{Object.entries({active:"進行中",production:"制作中",maintenance:"伴走中",archive:"完了・アーカイブ",sales:"既存の商談"}).map(([key,label])=><Link aria-current={key===tab?"page":undefined} className="text-sm underline" key={key} href={"/projects?tab="+key}>{label}</Link>)}</nav>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(p=>{
        const mine=tasks.filter(t=>t.project_id===p.id), next=mine.filter(t=>t.status!=="done").sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];
        const due=next?.due_date ? dockDeadline(next.due_date):null;
        return <Link key={p.id} href={"/projects/"+p.id} className={"rounded-xl border p-4 "+(due?.surface||"bg-white")}><strong>{p.title}</strong><p className="mt-2 text-sm">{p.archived?"完了":p.phase==="maintenance"?"伴走中":p.phase==="sales"?"商談中":"制作中"}</p><p>{next?.title}</p><small>{due?.label}　{members.find(m=>m.id===next?.owner_id)?.name}　完了 {mine.filter(t=>t.status==="done").length}/{mine.length} 作業</small></Link>
      })}</div>{!filtered.length&&<p>該当する案件はありません。</p>}</section>;
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">プロジェクト</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            仕事の塊。中のタスクが全部終わっても消えません。次のタスクがまた出てくるからです。
          </p>
        </div>
        {currentWorkspace?.id==="00000000-0000-4000-8000-000000000005" ? <Link href="/projects/new" className="rounded bg-brand px-4 py-2 font-semibold text-white">＋ 新規案件</Link> : <NewProjectButton goals={goals} />}
      </div>

      <ProjectAccordion
        projects={projects}
        tasks={tasks}
        members={members}
        goals={goals}
        boardMode={currentWorkspace?.name.trim().toLowerCase() === "with dock"}
      />
    </div>
  );
}
