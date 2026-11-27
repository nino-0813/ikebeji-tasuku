export type FeeKind = "one_off" | "recurring";
export type Target = { month: string; kind: FeeKind; amount: number };
export type Receipt = { received_on: string; amount: number };
export type Payment = {
  id: string;
  kind: FeeKind;
  amount: number;
  due_on: string;
  receipts: Receipt[];
  label: string;
  customer: string;
  project: string;
  contract: string;
  certainty: "confirmed" | "estimated";
  period?: string;
};
export type SalesForecast = { id: string; name: string; month: string; amount: number; confidence: string };

export function monthOffset(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function paymentBalance(payment: Pick<Payment, "amount" | "receipts">) {
  const received = payment.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
  return { received, remaining: Math.max(0, Number(payment.amount) - received) };
}

export function cashOutlook(
  firstMonth: string, targets: Target[], payments: Payment[], sales: SalesForecast[], kind?: FeeKind,
) {
  return Array.from({ length: 4 }, (_, offset) => {
    const month = monthOffset(firstMonth, offset);
    const matching = targets.filter(t => t.month.startsWith(month) && (!kind || t.kind === kind));
    const target = matching.length ? matching.reduce((sum, t) => sum + Number(t.amount), 0) : null;
    let received = 0;
    let committed = 0;
    for (const payment of payments) {
      if (kind && payment.kind !== kind) continue;
      for (const receipt of payment.receipts) {
        if (receipt.received_on.startsWith(month)) received += Number(receipt.amount);
      }
      if (payment.due_on.startsWith(month)) committed += paymentBalance(payment).remaining;
    }
    const salesAmount = kind ? null : sales.filter(s => s.month.startsWith(month))
      .reduce((sum, s) => sum + Number(s.amount), 0);
    return { month, target, received, committed, sales: salesAmount };
  });
}

type RecurringRate = { effective_on: string; amount: number; day_of_month: number };

export function projectRecurringPayments(
  contracts: {
    id: string; legal_name: string; project_id: string; starts_on: string | null;
    ends_on: string | null; dock_recurring_rates: RecurringRate[];
  }[],
  payments: Payment[],
  lastMonth: string,
) {
  const scheduled = new Set(payments.map(p => p.contract + "/" + p.due_on.slice(0, 7)));
  const rows: Payment[] = [];
  for (const contract of contracts) {
    const rates = [...contract.dock_recurring_rates].sort((a, b) => a.effective_on.localeCompare(b.effective_on));
    if (!rates.length) continue;
    const firstMonth = rates[0].effective_on.slice(0, 7);
    let firstRate = 0;
    for (let month = firstMonth; month <= lastMonth; month = monthOffset(month, 1)) {
      if (scheduled.has(contract.id + "/" + month)) continue;
      const nextMonth = monthOffset(month, 1) + "-01";
      const [year, number] = month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
      while (rates[firstRate + 1]?.effective_on <= month + "-01") firstRate++;
      // Select the first due date that falls within a rate's effective window.
      let due: string | undefined;
      let amount = 0;
      for (let i = firstRate; i < rates.length && rates[i].effective_on < nextMonth; i++) {
        const rate = rates[i];
        const candidate = month + "-" + String(Math.min(rate.day_of_month, lastDay)).padStart(2, "0");
        const nextEffective = rates[i + 1]?.effective_on;
        if (!Number(rate.amount) || candidate < rate.effective_on || (nextEffective && candidate >= nextEffective)
          || (contract.starts_on && candidate < contract.starts_on) || (contract.ends_on && candidate > contract.ends_on)) continue;
        if (!due || candidate < due) {
          due = candidate;
          amount = Number(rate.amount);
        }
      }
      if (!due) continue;
      rows.push({
        id: contract.id + "/" + month, contract: contract.id, project: contract.project_id,
        due_on: due, amount, kind: "recurring", receipts: [],
        label: "継続支援費", customer: contract.legal_name, certainty: "confirmed", period: month + "-01",
      });
    }
  }
  return rows;
}
