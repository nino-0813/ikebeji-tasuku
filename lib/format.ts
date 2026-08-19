import { STALL_DAYS } from "./types";

/** その日の 00:00 (ローカル) */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayISO(): string {
  const d = startOfToday();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function addDaysISO(days: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** 期限まであと何日か。マイナスなら超過 */
export function daysUntil(dateISO: string): number {
  const target = new Date(`${dateISO}T00:00:00`);
  return Math.round((target.getTime() - startOfToday().getTime()) / 86_400_000);
}

/** ある時刻から今日までの経過日数 */
export function daysSince(ts: string): number {
  const from = new Date(ts);
  from.setHours(0, 0, 0, 0);
  return Math.round((startOfToday().getTime() - from.getTime()) / 86_400_000);
}

export function isStalled(task: { status: string; status_changed_at: string }): boolean {
  return task.status !== "done" && daysSince(task.status_changed_at) >= STALL_DAYS;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function formatDateLong(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
}

/** 「あと3日」「2日超過」「今日」 */
export function dueLabel(dateISO: string): string {
  const n = daysUntil(dateISO);
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n < 0) return `${-n}日超過`;
  return `あと${n}日`;
}

export function formatNumber(v: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.round(v));
}

/** 金額を万円単位で読みやすく。単位が「円」以外ならそのまま返す */
export function formatValue(v: number, unit: string): string {
  if (unit === "円" && Math.abs(v) >= 10_000) {
    const man = v / 10_000;
    const s = man >= 100 ? formatNumber(man) : String(Math.round(man * 10) / 10);
    return `${s}万円`;
  }
  return `${formatNumber(v)}${unit}`;
}
