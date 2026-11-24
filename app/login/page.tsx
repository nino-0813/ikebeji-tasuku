import { isConfigured } from "@/lib/supabase";
import { SetupNotice } from "@/components/SetupNotice";
import { PersonalForm } from "./PersonalForm";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";

export const dynamic = "force-dynamic";

export default async function LoginPage({searchParams}:PageProps<"/login">) {
  if (!isConfigured()) return <SetupNotice />;
  const params = await searchParams;
  const target = params.team === "withdock" ? WITH_DOCK_ID : String(params.workspace || "");
  return <main className="grid min-h-dvh place-items-center px-4">
    <div className="w-full max-w-sm"><p className="mb-4 font-bold">進行ボード</p><PersonalForm workspace={target} /></div>
  </main>;
}
