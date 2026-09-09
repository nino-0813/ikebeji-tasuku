import { getGoals, getProjects, getTasks, getWorkspaceMembers } from "@/lib/data";
import { ProjectAccordion, NewProjectButton } from "@/components/ProjectParts";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, tasks, members, goals] = await Promise.all([
    getProjects(),
    getTasks(),
    getWorkspaceMembers(),
    getGoals(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">プロジェクト</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            仕事の塊。中のタスクが全部終わっても消えません。次のタスクがまた出てくるからです。
          </p>
        </div>
        <NewProjectButton goals={goals} />
      </div>

      <ProjectAccordion projects={projects} tasks={tasks} members={members} goals={goals} />
    </div>
  );
}
