import { db } from "@/lib/supabase";
import { httpUrl } from "@/lib/dock-project";

export async function DockCustomerHistory({ customer }: { customer: string }) {
  const { data, error } = await db.from("dock_history").select("id,body,source_kind,source_url,created_at")
    .eq("customer_id", customer).order("created_at", { ascending: false }).order("id");
  if (error) throw new Error("顧客履歴を取得できませんでした。");
  return (
    <section className="mt-4">
      <h3 className="wd-title" id="history">顧客の履歴</h3>
      {data.map(row => {
        const url = httpUrl(row.source_url);
        const label = ({ manual: "手動更新", meeting: "会議", ai: "AI要約" } as Record<string, string>)[row.source_kind] || "既存履歴";
        return (
          <article className="wd-note mt-2" key={row.id}>
            <small>{new Date(row.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} ｜ {label}</small>
            <p className="whitespace-pre-wrap">{row.body}</p>
            {url && <a className="underline" href={url}>原文を開く ↗</a>}
          </article>
        );
      })}
      {!data.length && <p className="wd-empty">履歴はまだありません。</p>}
    </section>
  );
}
