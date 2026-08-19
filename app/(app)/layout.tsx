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
      <Nav members={members} me={me} />
      <main className="mx-auto w-full max-w-7xl grow px-4 py-6">{children}</main>
    </TaskUIProvider>
  );
}
