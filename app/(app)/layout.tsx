import { getGoals, getMe, getMembers } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { TaskUIProvider } from "@/components/TaskUI";
import { Nav } from "@/components/Nav";
import { SetupNotice } from "@/components/SetupNotice";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isConfigured()) return <SetupNotice />;

  const [members, goals, me] = await Promise.all([getMembers(), getGoals(), getMe()]);

  return (
    <TaskUIProvider members={members} goals={goals} me={me}>
      <div className="app-shell">
        <Nav members={members} me={me} />
        <main id="main-content" className="app-main">
          <div className="page-content">{children}</div>
        </main>
      </div>
    </TaskUIProvider>
  );
}
