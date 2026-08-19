import type { Category, Member, Priority, Status } from "@/lib/types";
import { dueLabel, daysUntil } from "@/lib/format";

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  todo: { label: "未着手", cls: "bg-stone-100 text-stone-600 border-stone-200" },
  doing: { label: "進行中", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  waiting: { label: "相手待ち", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  done: { label: "完了", cls: "bg-green-50 text-green-700 border-green-200" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

const CATEGORY_STYLE: Record<Category, { label: string; cls: string }> = {
  marketing: { label: "マーケ", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  system: { label: "システム", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export function CategoryBadge({ category }: { category: Category }) {
  const c = CATEGORY_STYLE[category];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}

export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority !== "high") return null;
  return (
    <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-600">
      優先
    </span>
  );
}

/** 担当者のイニシャル丸アイコン。色で誰のタスクか一目でわかるようにする */
export function Avatar({ member, size = 24 }: { member?: Member | null; size?: number }) {
  if (!member) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] text-stone-500"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: member.color, fontSize: size * 0.42 }}
      title={member.name}
    >
      {member.name.slice(0, 1)}
    </span>
  );
}

/** 期限。今日/超過は赤、3日以内は橙 */
export function DueChip({ date, done }: { date: string; done?: boolean }) {
  const n = daysUntil(date);
  const tone = done
    ? "text-stone-400"
    : n < 0
      ? "text-red-600 font-semibold"
      : n <= 2
        ? "text-amber-600 font-semibold"
        : "text-stone-500";
  return <span className={`tnum text-[11px] ${tone}`}>{done ? "完了" : dueLabel(date)}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-mute">
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  count,
  hint,
}: {
  children: React.ReactNode;
  count?: number;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-sm font-bold tracking-wide text-ink">{children}</h2>
      {count !== undefined && <span className="tnum text-xs text-ink-mute">{count}件</span>}
      {hint && <span className="text-xs text-ink-mute">{hint}</span>}
    </div>
  );
}
