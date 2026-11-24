import { signOut } from "@/lib/actions";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId, getWorkspaceMembers } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockTeamMember } from "@/lib/dock-team";
import { DockGate } from "@/components/DockGate";
import { db } from "@/lib/supabase";
export default async function Settings() {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  if (!(await dockTeamMember())) return <DockGate />;
  const [members, last] = await Promise.all([
    getWorkspaceMembers(),
    db
      .from("dock_proposals")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (last.error) throw new Error("受信履歴を取得できませんでした。");
  return (
    <div className="wd-split">
      <section className="wd-panel">
        <h2 className="wd-title">メンバー表示</h2>
        {members.map((m) => (
          <div className="wd-row" key={m.id}>
            <span className="flex items-center gap-3">
              <b
                className="grid size-9 place-items-center rounded-full text-white"
                style={{
                  background:
                    (
                      {
                        ninomiya: "#308578",
                        honma: "#cd803a",
                        toru: "#5587bb",
                        goda: "#8869aa",
                      } as Record<string, string>
                    )[m.id] || m.color,
                }}
              >
                {m.id === "goda" ? "合" : m.name[0]}
              </b>
              <strong>{m.id === "goda" ? "合田" : m.name}</strong>
            </span>
            <small>閲覧・承認</small>
          </div>
        ))}
        <h3 className="wd-title mt-5">権限の基本方針</h3>
        <p>
          4人の個人アカウントで顧客・契約・入金を確認し、AI提案を承認できます。
        </p>
        <form className="mt-4" action={signOut}>
          <button className="wd-primary">ログアウト</button>
        </form>
      </section>
      <section className="wd-panel">
        <h2 className="wd-title">データ連携</h2>
        <p className="wd-row">
          議事録・資料<b>Google Drive</b>
        </p>
        <p className="wd-row">
          同期頻度<b>毎時</b>
        </p>
        <p className="wd-row">
          AI承認先<a href="/inbox">インボックス →</a>
        </p>
        <p className="wd-row">
          提案の最終受信
          <b>
            {last.data?.[0]?.created_at &&
            Number.isFinite(Date.parse(last.data[0].created_at))
              ? new Date(last.data[0].created_at).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                })
              : "受信記録なし"}
          </b>
        </p>
        <div className="wd-notice mt-4">
          会議から抽出した候補は、チームが承認すると反映されます。
        </div>
      </section>
    </div>
  );
}
