import { getMembers } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { PersonalForm } from "./PersonalForm";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({searchParams}:PageProps<"/login">) {
  if (!isConfigured()) return <SetupNotice />;
  if ((await searchParams).team === "withdock") return <main className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-sm"><p className="mb-4 font-bold">with dock 進行ボード</p><PersonalForm /></div></main>;
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
