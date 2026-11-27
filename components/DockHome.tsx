import { money, MonthBars } from "./DockCharts";
import Link from "next/link";
import { db } from "@/lib/supabase";
import { getTasks, getProjects } from "@/lib/data";
import { dockAccess } from "@/lib/dock-access";
import { dockToday } from "@/lib/dock-project";
import { dockFinance } from "@/lib/dock-finance-data";
import { cashOutlook } from "@/lib/dock-cash";
import { DockGate } from "./DockGate";
export async function DockHome() {
  const access = await dockAccess();
  if (!access) return <DockGate />;
  const today = dockToday();
  const month = today.slice(0, 7);
  const [tasks, projects, pending, finance, steps, sync] = await Promise.all([
    getTasks(), getProjects(),
    db.from("dock_proposals").select("kind", { count: "exact" }).eq("state", "pending"),
    access.view_finance ? dockFinance(month) : null,
    db.from("dock_steps").select("project_id"),
    db.from("dock_sync_runs").select("succeeded").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (pending.error || steps.error || sync.error) throw new Error("ホームを取得できませんでした。");
  const active = projects.filter(p => p.phase !== "sales");
  const unlinked = active.filter(p => !p.dock_customer_id);
  const noSteps = active.filter(p => !steps.data.some(s => s.project_id === p.id));
  const totals = finance ? cashOutlook(month, finance.targets, finance.payments, finance.sales)[0] : null;
  const due = tasks
    .filter(
      (t) =>
        t.status !== "done" && t.owner_id === access.member && t.due_date <= today,
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <div className="wd-stack">
      <div className="wd-four">
        {[
          ["承認待ちの提案", (pending.count || 0) + "件", "/inbox"],
          ["期限を迎えた担当作業", due.length + "件", "#due"],
          ...(totals ? [
            ["今月の実入金", money(totals.received), "/cash"],
            ["目標まで", totals.target === null ? "目標未設定" : money(Math.max(0, totals.target - totals.received)), "/cash"],
          ] : []),
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
          {unlinked.length > 0 && (
            <Link className="wd-row wd-signal amber" href="/projects?filter=unlinked">
              <b>顧客未紐づけ</b><span>{unlinked.length}件 →</span>
            </Link>
          )}
          {noSteps.length > 0 && (
            <Link className="wd-row wd-signal amber" href="/projects?filter=no-steps">
              <b>工程未登録</b><span>{noSteps.length}件 →</span>
            </Link>
          )}
          {sync.data?.succeeded === false && (
            <Link className="wd-row wd-signal rose" href="/settings#drive-sync">
              <b>Drive同期に失敗</b><span>実行履歴を見る →</span>
            </Link>
          )}
        </section>
        {totals && (
          <section className="wd-panel">
            <h2 className="wd-title">
              今月の入金状況<Link href="/cash">目標・入金 →</Link>
            </h2>
            <MonthBars row={totals} />
          </section>
        )}
      </div>
      <section className="wd-panel">
        <h2 className="wd-title">
          進行中の案件<Link href="/projects">プロジェクトを見る →</Link>
        </h2>
        <div className="wd-three">
          {active
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
        {!active.length && (
          <p className="wd-empty">進行中の案件はありません。</p>
        )}
      </section>
    </div>
  );
}
