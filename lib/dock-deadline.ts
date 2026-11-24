const tokyoCalendar = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
});

export function dockDeadline(due: string, now = new Date()) {
  const today = tokyoCalendar.format(now);
  const days = (Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000;
  if (days < 0) return { surface: "bg-red-50 border-red-200", label: `期日から${-days}日` };
  if (days === 0) return { surface: "bg-yellow-100 border-yellow-300", label: "今日が期限" };
  if (days <= 2) return { surface: "bg-yellow-50 border-yellow-200", label: `期限まで${days}日` };
  return { surface: "bg-white", label: `期限 ${due}` };
}
