import type { cashOutlook } from "@/lib/dock-cash";
type Month = ReturnType<typeof cashOutlook>[number];
const metrics = [
  { key: "target", name: "目標", color: "#9caea5" },
  { key: "received", name: "実入金", color: "#307967" },
  { key: "committed", name: "契約済み予定の残額", color: "#5e84a2" },
  { key: "sales", name: "商談予測", color: "#a07948" },
] as const;

export const money = (value: number | null) =>
  value === null ? "未設定" : "¥" + value.toLocaleString("ja-JP");

export function MonthBars({ row }: { row: Month }) {
  const scale = Math.max(1, ...metrics.map(({ key }) => row[key] ?? 0));
  return metrics.map(({ key, name, color }) => (
    <div key={key} className="wd-stats-bar">
      <span>{name}</span>
      <div className="wd-track" aria-hidden="true">
        <i style={{ height: "100%", width: ((row[key] ?? 0) / scale) * 100 + "%", background: color }} />
      </div>
      <strong>{money(row[key])}</strong>
    </div>
  ));
}

export function OutlookChart({ rows }: { rows: Month[] }) {
  const visible = metrics.filter(({ key }) => key !== "sales" || rows.some(row => row.sales !== null));
  const scale = Math.max(1, ...rows.flatMap(row => visible.map(({ key }) => row[key] ?? 0)));
  return (
    <figure className="wd-panel">
      <figcaption className="wd-title">
        4か月の目標・予定・実績 <small>{rows[0].month} ～ {rows.at(-1)?.month}</small>
      </figcaption>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {visible.map(({ key, name, color }) => (
          <li className="flex items-center gap-1.5" key={key}>
            <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />{name}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
        {rows.map(row => (
          <div key={row.month}>
            <b>{Number(row.month.slice(5))}月</b>
            <div className="wd-bars" aria-hidden="true">
              {visible.map(({ key, color }) => (
                <i key={key} style={{ height: ((row[key] ?? 0) / scale) * 100 + "%", background: color }} />
              ))}
            </div>
            <dl className="mt-2 text-xs">
              {visible.map(({ key, name }) => (
                <div key={key} className="flex justify-between gap-1">
                  <dt>{name}</dt><dd>{money(row[key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </figure>
  );
}
