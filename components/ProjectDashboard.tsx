import type { Project, Task } from "@/lib/types";
import { formatDate } from "@/lib/format";

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ProjectDashboard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const doing = tasks.filter((task) => task.status === "doing").length;
  const waiting = tasks.filter((task) => task.status === "waiting").length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const dates = tasks.flatMap((task) => [task.start_date, task.due_date]).filter(Boolean).sort();
  const start = dates.at(0);
  const end = dates.at(-1);
  const unpaid = Math.max(0, project.invoiced_amount - project.paid_amount);
  const remaining = Math.max(0, project.contract_amount - project.paid_amount);
  const website = safeUrl(project.client_website);

  return (
    <div className="space-y-5">
      <section aria-labelledby="project-summary-heading">
        <h2 id="project-summary-heading" className="sr-only">プロジェクト概要</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="進捗率" value={`${progress}%`} hint={`${done} / ${total} タスク完了`} tone="green">
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
            </div>
          </SummaryCard>
          <SummaryCard label="現在の工程" value={doing ? `進行中 ${doing}件` : done === total && total ? "すべて完了" : "着手待ち"} hint={waiting ? `相手待ち ${waiting}件` : "相手待ちはありません"} tone="blue" />
          <SummaryCard label="プロジェクト期間" value={start && end ? `${formatDate(start)}〜` : "未設定"} hint={end ? `完了予定 ${formatDate(end)}` : "タスクに日付を設定してください"} />
          <SummaryCard label="入金残額" value={yen(remaining)} hint={`入金済み ${yen(project.paid_amount)}`} tone={remaining > 0 ? "amber" : "green"} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="client-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-mute">CLIENT</p>
              <h2 id="client-heading" className="mt-1 text-sm font-bold">クライアント情報</h2>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">案件窓口</span>
          </div>
          {project.client_name ? (
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Info label="会社・屋号" value={project.client_name} />
              <Info label="担当者" value={project.client_contact_name || "未設定"} />
              <Info label="メール" value={project.client_email || "未設定"} href={project.client_email ? `mailto:${project.client_email}` : undefined} />
              <Info label="電話番号" value={project.client_phone || "未設定"} href={project.client_phone ? `tel:${project.client_phone}` : undefined} />
              <div className="sm:col-span-2">
                <Info label="Webサイト" value={project.client_website || "未設定"} href={website || undefined} external />
              </div>
            </dl>
          ) : (
            <EmptyInfo text="クライアント情報はまだ登録されていません。右上の「編集」から追加できます。" />
          )}
        </section>

        <section className="card p-5" aria-labelledby="finance-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-ink-mute">FINANCE</p>
              <h2 id="finance-heading" className="mt-1 text-sm font-bold">お金の流れ</h2>
            </div>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${unpaid > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
              {unpaid > 0 ? `未入金 ${yen(unpaid)}` : "請求分は入金済み"}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Money label="契約金額" value={project.contract_amount} />
            <Money label="請求済み" value={project.invoiced_amount} />
            <Money label="入金済み" value={project.paid_amount} strong />
            <Money label="保守管理 / 月" value={project.maintenance_monthly_fee} recurring />
          </dl>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] text-ink-mute">
              <span>入金進捗</span>
              <span className="tnum font-semibold text-ink-soft">{project.contract_amount ? Math.min(100, Math.round(project.paid_amount / project.contract_amount * 100)) : 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${project.contract_amount ? Math.min(100, project.paid_amount / project.contract_amount * 100) : 0}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-ink-mute">入金期日：{project.payment_due_date ? formatDate(project.payment_due_date) : "未設定"}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint, tone = "stone", children }: { label: string; value: string; hint: string; tone?: "stone" | "green" | "blue" | "amber"; children?: React.ReactNode }) {
  const tones = { stone: "bg-stone-100 text-stone-600", green: "bg-green-50 text-green-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700" };
  return <div className="card p-4"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${tones[tone]}`}>{label}</span><p className="tnum mt-3 text-lg font-bold text-ink">{value}</p><p className="mt-1 text-[11px] text-ink-mute">{hint}</p>{children}</div>;
}

function Info({ label, value, href, external }: { label: string; value: string; href?: string; external?: boolean }) {
  return <div><dt className="text-[10px] font-semibold text-ink-mute">{label}</dt><dd className="mt-1 break-words text-xs font-medium text-ink">{href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="text-brand underline-offset-2 hover:underline">{value}</a> : value}</dd></div>;
}

function Money({ label, value, strong, recurring }: { label: string; value: number; strong?: boolean; recurring?: boolean }) {
  return <div><dt className="text-[10px] font-semibold text-ink-mute">{label}</dt><dd className={`tnum mt-1 text-sm ${strong ? "font-bold text-brand" : recurring ? "font-bold text-blue-700" : "font-semibold text-ink"}`}>{yen(value)}{recurring && value > 0 ? <span className="ml-1 text-[10px] font-medium">/ 月</span> : null}</dd></div>;
}

function EmptyInfo({ text }: { text: string }) {
  return <div className="mt-5 rounded-lg border border-dashed border-line-strong bg-stone-50 px-4 py-6 text-center text-xs leading-relaxed text-ink-mute">{text}</div>;
}
