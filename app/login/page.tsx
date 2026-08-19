import { getMembers } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (!isConfigured()) return <SetupNotice />;
  const members = await getMembers();
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">
            イケ
          </span>
          <span className="text-base font-bold">イケベジ 進行ボード</span>
        </div>
        <LoginForm members={members} />
      </div>
    </main>
  );
}
