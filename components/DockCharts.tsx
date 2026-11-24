import type { cashOutlook } from "@/lib/dock-cash";
type Month = ReturnType<typeof cashOutlook>[number];
const colors = ["#d4e2db", "#97bdb1", "#307967"];
const names = ["目標", "見込み", "入金済"];
export const money = (value: number | null) =>
  value === null ? "未設定" : "¥" + value.toLocaleString("ja-JP");
export function MonthBars({ row }: { row: Month }) {
  const scale = Math.max(1, row.target || 0, row.received, row.forecast);
  return (
    <>
      {[0, 2, 1].map((i) => {
        const n = [row.target, row.forecast, row.received][i];
        return (
          <div key={i} className="wd-stats-bar">
            <span>{names[i]}</span>
            <div className="wd-track">
              <i
                style={{
                  height: "100%",
                  width: ((n || 0) / scale) * 100 + "%",
                  background: colors[i],
                }}
              />
            </div>
            <strong>{money(n)}</strong>
          </div>
        );
      })}
    </>
  );
}
export function OutlookChart({ rows }: { rows: Month[] }) {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.target || 0, row.forecast, row.received]),
  );
  return (
    <figure className="wd-panel">
      <figcaption className="wd-title">
        4か月の目標・見込み・実績{" "}
        <small>
          {rows[0].month} ～ {rows.at(-1)?.month}
        </small>
      </figcaption>
      <div className="grid grid-cols-4 gap-2 text-center">
        {rows.map((row) => (
          <div key={row.month}>
            <b>{Number(row.month.slice(5))}月</b>
            <div className="wd-bars">
              {[row.target, row.forecast, row.received].map((n, i) => (
                <i
                  key={i}
                  title={names[i] + " " + money(n)}
                  style={{
                    height: ((n || 0) / max) * 100 + "%",
                    background: colors[i],
                  }}
                />
              ))}
            </div>
            <small>
              {[row.target, row.forecast, row.received]
                .map((n) =>
                  n === null ? "未設定" : (n / 10000).toLocaleString("ja-JP"),
                )
                .join(" / ")}
            </small>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        {names.map((v, i) => (
          <span key={v}>
            <b style={{ color: colors[i] }}>■</b> {v}
          </span>
        ))}
        <span>単位：万円</span>
      </div>
    </figure>
  );
}
