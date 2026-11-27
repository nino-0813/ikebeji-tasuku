import { dockMemberDisplay } from "@/lib/dock-members";
import "./dock.css";
import { DockShell } from "@/components/DockShell";
import { dockAccess } from "@/lib/dock-access";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { DockGate } from "@/components/DockGate";
import {
  getActiveWorkspaceId,
  getCurrentWorkspace,
  getGoals,
  getMe,
  getMembers,
  getProjects,
  getWorkspaces,
  getWorkspaceMembers,
} from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { TaskUIProvider } from "@/components/TaskUI";
import { Nav } from "@/components/Nav";
import { SetupNotice } from "@/components/SetupNotice";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isConfigured()) return <SetupNotice />;

  const personal = (await getActiveWorkspaceId()) === WITH_DOCK_ID;
  const access = personal ? await dockAccess() : null;
  if (personal && !access)
    return (
      <main className="mx-auto max-w-lg p-5">
        <DockGate />
      </main>
    );

  const [
    allMembers,
    members,
    goals,
    projects,
    me,
    workspaces,
    currentWorkspace,
  ] = await Promise.all([
    personal ? [] : getMembers(),
    getWorkspaceMembers(),
    getGoals(),
    getProjects(),
    getMe(),
    getWorkspaces(),
    getCurrentWorkspace(),
  ]);


  return (
    <TaskUIProvider
      members={members}
      goals={goals}
      projects={projects.map(({ id, title, category, goal_id, client_name }) => ({ id, title, category, goal_id, client_name }))}
      me={personal && me ? dockMemberDisplay(me) : me}
      canEdit={!personal || !!access?.edit_operations}
      workspaces={workspaces}
      currentWorkspace={currentWorkspace}
    >
      {personal ? (
        <DockShell canViewFinance={!!access?.view_finance} workspaces={workspaces.map(({id,name}) => ({id,name}))} user={me ? dockMemberDisplay(me).name : "メンバー"}>{children}</DockShell>
      ) : (
        <div className="app-shell">
          <Nav
            members={personal ? members : allMembers}
            me={me}
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
          />
          <main id="main-content" className="app-main">
            <div className="page-content">{children}</div>
          </main>
        </div>
      )}
    </TaskUIProvider>
  );
}
