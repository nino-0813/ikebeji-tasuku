import { getWorkspaceMembers } from "@/lib/data";
import Link from "next/link";
import { dockAccess } from "@/lib/dock-access";
import { PREFECTURES } from "@/lib/dock-project";
import { db } from "@/lib/supabase";
import { registerProject } from "@/lib/dock-actions";
import { DockGate } from "@/components/DockGate";
export const dynamic = "force-dynamic";
export default async function NewProject() {
  const access = await dockAccess();
  if (!access) return <DockGate />;
  if (!access.edit_operations) return <p className="wd-panel">案件を登録する権限はありません。</p>;
  const { data, error } = await db
    .from("dock_customers")
    .select("id,name")
    .order("name");
  if (error) throw new Error("顧客を取得できませんでした。");
  const members = await getWorkspaceMembers();
  return (
    <div className="wd-split">
      <form action={registerProject} className="wd-panel">
        <h2 className="wd-title">新規案件を作成</h2>
        <input type="hidden" name="request" value={crypto.randomUUID()} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            顧客
            <select name="customer" required className="field">
              <option value="">既存顧客を選択</option>
              {data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            プロジェクト名
            <input name="title" required className="field" />
          </label>
          <label>
            契約名義（正式名称）
            <input className="field" name="legal" />
          </label>
          <label>
            状態
            <select name="phase" className="field">
              <option value="production">制作中</option>
              <option value="maintenance">伴走中</option>
            </select>
          </label>
          <fieldset>
            <legend>担当メンバー</legend>
            {members.map((m) => (
              <label className="mr-2" key={m.id}>
                <input type="checkbox" name="member" value={m.id} /> {m.name}
              </label>
            ))}
          </fieldset>
          <label>
            完了予定日
            <input type="date" name="finish" className="field" />
          </label>
        </div>
        <details open className="my-4 wd-supplement">
          <summary>制作リンク・顧客情報の補足</summary>
          <p className="my-2 text-sm">住所と連絡先は顧客情報の空欄を補足します。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>都道府県<select name="prefecture" className="field" defaultValue="">
              <option value="">未選択</option>
              {PREFECTURES.map(name => <option key={name}>{name}</option>)}
            </select></label>
            {[
              ["address", "市区町村・住所", "text"],
              ["email", "メールアドレス", "email"],
              ["phone", "電話番号", "tel"],
              ["website", "公開サイト", "url"],
              ["preview", "確認用URL", "url"],
              ["deployment", "最新版Vercel URL", "url"],
            ].map(([name, label, type]) => (
              <label key={name}>
                {label}
                <input className="field" name={name} type={type} />
              </label>
            ))}
          </div>
        </details>
        <button className="wd-primary">案件を登録</button>
      </form>
      <aside className="wd-panel">
        <h2 className="wd-title">顧客との紐付け</h2>
        <div className="wd-note">
          同じ会社の案件は既存の顧客を選択してください。複数の案件から共通の顧客履歴を参照できます。
        </div>
        <p className="wd-row">
          顧客情報<b>顧客理解で共有</b>
        </p>
        <p className="wd-row">
          案件ごとに登録<b>契約・担当・工程</b>
        </p>
        <Link className="wd-row" href="/customers">
          新しい顧客を登録 →
        </Link>
      </aside>
    </div>
  );
}
