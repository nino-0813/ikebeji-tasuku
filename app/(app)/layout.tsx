import { getCurrentWorkspace, getGoals, getMe, getMembers, getProjects, getWorkspaces, getWorkspaceMembers } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { TaskUIProvider } from "@/components/TaskUI";
import { Nav } from "@/components/Nav";
import { SetupNotice } from "@/components/SetupNotice";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isConfigured()) return <SetupNotice />;

  const [allMembers, members, goals, projects, me, workspaces, currentWorkspace] = await Promise.all([
    getMembers(),
    getWorkspaceMembers(),
    getGoals(),
    getProjects(),
    getMe(),
    getWorkspaces(),
    getCurrentWorkspace(),
  ]);

  return (
    <TaskUIProvider members={members} goals={goals} projects={projects} me={me}>
      <div className="app-shell">
        <Nav members={allMembers} me={me} workspaces={workspaces} currentWorkspace={currentWorkspace} />
        <main id="main-content" className="app-main">
          <div className="page-content">{children}</div>
        </main>
      </div>
    </TaskUIProvider>
  );
}
