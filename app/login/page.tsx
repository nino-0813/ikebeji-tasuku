import Link from "next/link";
import { boardPages } from "@/lib/board-pages";
import { getMembers } from "@/lib/data";
import { isConfigured } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { PersonalForm } from "./PersonalForm";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({searchParams}:PageProps<"/login">) {
  if (!isConfigured()) return <SetupNotice />;
  const params = await searchParams;
  const destination = boardPages.find(page => page.id === params.workspace);
  if (params.team === "withdock") return <main className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-sm"><p className="mb-4 font-bold">with dock 進行ボード</p><PersonalForm /><Link href="/login" className="mt-4 block text-sm underline">全体の進行ボードへ</Link></div></main>;
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
        {destination && <h1 className="mb-3 font-bold">{destination.name} にログイン</h1>}
        <LoginForm members={members} workspace={destination?.id} />
        <Link href="/login?team=withdock" className="mt-4 block text-sm underline">with dock の個人ログインへ</Link>
      </div>
    </main>
  );
}
