import Link from "next/link";
import { signOut } from "@/lib/actions";
import { saveDockPermissions } from "@/lib/dock-actions";
import { notFound } from "next/navigation";
import { getActiveWorkspaceId, getWorkspaceMembers } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { dockAccess, configuredAccess } from "@/lib/dock-access";
import { DockGate } from "@/components/DockGate";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/supabase";

const labels = {
  view_finance: "金額を閲覧",
  edit_finance: "入金・金額を編集",
  edit_operations: "顧客・案件・タスクを編集",
  approve_proposals: "AI提案を承認",
} as const;
const dateTime = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo",
});

export default async function Settings() {
  if ((await getActiveWorkspaceId()) !== WITH_DOCK_ID) notFound();
  const access = await dockAccess();
  if (!access) return <DockGate />;
  const [members, permissions, last, success] = await Promise.all([
    getWorkspaceMembers(),
    db.from("dock_permissions").select("member_id,view_finance,edit_finance,edit_operations,approve_proposals"),
    db.from("dock_sync_runs").select("finished_at,succeeded,item_count")
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("dock_sync_runs").select("finished_at").eq("succeeded", true)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (permissions.error || last.error || success.error) throw new Error("設定情報を取得できませんでした。");
  return (
    <div className="wd-split">
      <section className="wd-panel">
        <h2 className="wd-title">メンバーと操作権限</h2>
        {members.map(member => {
          const settings = configuredAccess(permissions.data.find(p => p.member_id === member.id));
          return <article className="border-b border-line py-3" key={member.id}>
            <p className="flex items-center gap-3"><Avatar member={member} size={36} /><strong>{member.name}</strong></p>
            <p className="mt-1 text-sm">案件を閲覧
              {Object.entries(labels).map(([key, label]) => settings[key as keyof typeof labels] ? "・" + label : "")}
            </p>
            {access.manage && <details className="mt-2">
              <summary>{member.name}の権限を編集</summary>
              <form action={saveDockPermissions} className="mt-2 grid gap-2">
                <input type="hidden" name="member" value={member.id} />
                {Object.entries(labels).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" name={key} defaultChecked={settings[key as keyof typeof labels]} />{label}
                  </label>
                ))}
                <button className="wd-primary">権限を保存</button>
              </form>
            </details>}
          </article>;
        })}
        <form className="mt-4" action={signOut}><button className="wd-primary">ログアウト</button></form>
      </section>
      <section className="wd-panel" id="drive-sync">
        <h2 className="wd-title">Google Driveの同期</h2>
        <p className="wd-row">同期頻度<b>{process.env.WITHDOCK_SYNC_SCHEDULE_LABEL || "未確認"}</b></p>
        <p className="wd-row">最終実行<b>{last.data ? dateTime.format(new Date(last.data.finished_at)) : "実行報告なし"}</b></p>
        <p className="wd-row">結果<b>{last.data ? (last.data.succeeded ? "成功" : "失敗") : "未確認"}</b></p>
        <p className="wd-row">処理件数<b>{last.data ? last.data.item_count + "件" : "—"}</b></p>
        <p className="wd-row">最終成功<b>{success.data ? dateTime.format(new Date(success.data.finished_at)) : "成功報告なし"}</b></p>
        <p className="wd-row">AI承認先<Link href="/inbox">インボックス →</Link></p>
        {!last.data && <p className="wd-notice mt-4">外部ジョブから実行結果が届くと、ここに表示されます。</p>}
      </section>
    </div>
  );
}
