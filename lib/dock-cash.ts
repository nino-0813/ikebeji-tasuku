export type FeeKind = "one_off" | "recurring";
type Target = { month: string; kind: FeeKind; amount: number };
type Payment = { kind: FeeKind; amount: number; due_on: string; certainty: "confirmed" | "estimated"; received_on: string | null; received_amount: number | null };

export function cashOutlook(firstMonth: string, targets: Target[], payments: Payment[], kind?: FeeKind) {
  const [year, month] = firstMonth.split("-").map(Number);
  return Array.from({ length: 4 }, (_, offset) => {
    const key = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0,7);
    const matchingTargets = targets.filter(t => t.month.startsWith(key) && (!kind || t.kind === kind));
    const target = matchingTargets.length ? matchingTargets.reduce((sum,t)=>sum+Number(t.amount),0) : null;
    let received = 0, confirmed = 0, estimated = 0;
    for (const p of payments) {
      if (kind && p.kind !== kind) continue;
      if (p.received_on) {
        if (p.received_on.startsWith(key)) received += Number(p.received_amount);
      } else if (p.due_on.startsWith(key)) {
        if (p.certainty === "confirmed") confirmed += Number(p.amount);
        else estimated += Number(p.amount);
      }
    }
    return { month:key, target, received, confirmed, estimated, forecast:received+confirmed+estimated };
  });
}
