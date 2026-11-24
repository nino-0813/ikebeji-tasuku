import { money, MonthBars } from "./DockCharts";
import Link from "next/link";
import { db } from "@/lib/supabase";
import { getTasks, getProjects } from "@/lib/data";
import { dockTeamMember } from "@/lib/dock-team";
import { DockGate } from "./DockGate";
export async function DockHome() {
  const member = await dockTeamMember();
  if (!member) return <DockGate />;
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  const start = today.slice(0, 7) + "-01";
  const end = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 10);
  const [tasks, projects, pending, paid, targets, unpaid] = await Promise.all([
    getTasks(),
    getProjects(),
    db
      .from("dock_proposals")
      .select("kind", { count: "exact" })
      .eq("state", "pending"),
    db
      .from("dock_payments")
      .select("received_amount")
      .gte("received_on", start)
      .lt("received_on", end),
    db.from("dock_monthly_targets").select("amount").eq("month", start),
    db
      .from("dock_payments")
      .select("amount")
      .is("received_on", null)
      .gte("due_on", start)
      .lt("due_on", end),
  ]);
  if (pending.error || paid.error || unpaid.error || targets.error)
    throw new Error("ホームを取得できませんでした。");
  const due = tasks
    .filter(
      (t) =>
        t.status !== "done" && t.owner_id === member && t.due_date <= today,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const receipts = paid.data.reduce((n, p) => n + Number(p.received_amount), 0),
    target = targets.data.reduce((n, p) => n + Number(p.amount), 0);
  const forecast =
    receipts + unpaid.data.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <div className="wd-stack">
      <div className="wd-four">
        {[
          ["承認待ちの提案", (pending.count || 0) + "件", "/inbox"],
          ["期限を迎えた担当作業", due.length + "件", "#due"],
          ["今月の実入金", money(receipts), "/cash"],
          [
            "目標まで",
            targets.data.length
              ? money(Math.max(0, target - receipts))
              : "目標未設定",
            "/cash",
          ],
        ].map(([label, value, url]) => (
          <Link href={url} key={label} className="wd-panel wd-stat">
            <p className="text-sm">{label}</p>
            <strong className="text-xl">{value}</strong>
            <small>
              {url === "/inbox"
                ? Object.entries({
                    customer: "顧客",
                    project: "案件",
                    task: "タスク",
                    improvement: "改善",
                  })
                    .map(
                      ([key, name]) =>
                        name +
                        " " +
                        pending.data.filter((p) => p.kind === key).length,
                    )
                    .join(" / ")
                : url === "#due"
                  ? "担当作業と期限"
                  : label === "今月の実入金"
                    ? "入金日を基準に集計"
                    : "月別目標と実入金の差"}
            </small>
          </Link>
        ))}
      </div>
      <div className="wd-split">
        <section id="due" className="wd-panel">
          <h2 className="wd-title">
            今日の確認事項<Link href="/today">すべて見る →</Link>
          </h2>
          {due.slice(0, 5).map((t) => (
            <Link
              className="wd-row wd-signal amber"
              href={t.project_id ? "/projects/" + t.project_id : "/today"}
              key={t.id}
            >
              <span>
                <strong>期限が近い作業</strong>
                <small>{t.title}</small>
              </span>
              {t.due_date}
            </Link>
          ))}
          {!due.length && (
            <p className="wd-row">期限を迎えた担当作業はありません。</p>
          )}
          <Link className="wd-row wd-signal blue" href="/inbox">
            <b>AI抽出の承認待ち</b>
            <span>{pending.count || 0} 件 →</span>
          </Link>
          {tasks.some(
            (t) => t.status !== "done" && t.due_date < today && t.project_id,
          ) && (
            <Link className="wd-row wd-signal rose" href="/projects">
              <b>要確認の案件</b>
              <span>期限を過ぎた作業があります →</span>
            </Link>
          )}
        </section>
        <section className="wd-panel">
          <h2 className="wd-title">
            今月の入金状況<Link href="/cash">目標・入金 →</Link>
          </h2>
          <MonthBars
            row={{
              month: start,
              target: targets.data.length ? target : null,
              received: receipts,
              forecast,
              confirmed: 0,
              estimated: 0,
            }}
          />
        </section>
      </div>
      <section className="wd-panel">
        <h2 className="wd-title">
          進行中の案件<Link href="/projects">プロジェクトを見る →</Link>
        </h2>
        <div className="wd-three">
          {projects
            .filter((p) => p.phase !== "sales")
            .slice(0, 6)
            .map((p) => (
              <Link key={p.id} href={"/projects/" + p.id} className="wd-note">
                <b>{p.title}</b>
                <small className="block">
                  {p.phase === "maintenance" ? "伴走中" : "制作中"}
                </small>
              </Link>
            ))}
        </div>
        {!projects.some((p) => p.phase !== "sales") && (
          <p className="wd-empty">進行中の案件はありません。</p>
        )}
      </section>
    </div>
  );
}
