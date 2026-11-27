import assert from "node:assert/strict";
import test from "node:test";
import { cashOutlook, paymentBalance, projectRecurringPayments } from "../lib/dock-cash.ts";
import { dockToday, isDockDate, PREFECTURES } from "../lib/dock-project.ts";

const payment = {
  id: "p", kind: "one_off", due_on: "2026-12-01", amount: 1000000,
  receipts: [{ received_on: "2026-11-27", amount: 600000 }],
  project: "j", contract: "c", label: "制作費", customer: "顧客", certainty: "confirmed",
};

test("partial receipt, contract balance and sales are assigned to separate months and metrics", () => {
  assert.deepEqual(paymentBalance(payment), { received: 600000, remaining: 400000 });
  const results = cashOutlook("2026-11", [], [payment], [
    { id: "s", name: "商談", month: "2026-11-01", amount: 123000, confidence: "low" },
  ]);
  assert.deepEqual(results[0], { month: "2026-11", target: null, received: 600000, committed: 0, sales: 123000 });
  assert.deepEqual(results[1], { month: "2026-12", target: null, received: 0, committed: 400000, sales: 0 });
});

test("recurring projections honor changes, suspension, existing rows and contract end", () => {
  const contract = {
    id: "r", legal_name: "顧客", project_id: "j", starts_on: "2026-11-01", ends_on: "2027-02-28",
    dock_recurring_rates: [
      { effective_on: "2026-11-01", amount: 100, day_of_month: 31 },
      { effective_on: "2026-12-01", amount: 200, day_of_month: 31 },
      { effective_on: "2027-01-01", amount: 0, day_of_month: 31 },
      { effective_on: "2027-02-01", amount: 300, day_of_month: 31 },
    ],
  };
  const existing = { ...payment, contract: "r", due_on: "2026-12-31" };
  assert.deepEqual(projectRecurringPayments([contract], [existing], "2027-03").map(p => [p.due_on, p.amount]), [
    ["2026-11-30", 100], ["2027-02-28", 300],
  ]);
});

test("Tokyo dates and the prefecture input retain their boundaries", () => {
  assert.equal(dockToday(new Date("2026-11-26T15:00:00Z")), "2026-11-27");
  assert.equal(isDockDate("2026-02-29"), false);
  assert.equal(isDockDate("2028-02-29"), true);
  assert.equal(new Set(PREFECTURES).size, 47);
});

test("a later-in-month rate change leaves the earlier scheduled payment intact", () => {
  const contract = {
    id: "r", legal_name: "顧客", project_id: "j", starts_on: null, ends_on: null,
    dock_recurring_rates: [
      { effective_on: "2026-11-01", amount: 100, day_of_month: 1 },
      { effective_on: "2026-12-15", amount: 200, day_of_month: 1 },
    ],
  };
  assert.deepEqual(projectRecurringPayments([contract], [], "2027-01").map(p => [p.due_on, p.amount]), [
    ["2026-11-01", 100], ["2026-12-01", 100], ["2027-01-01", 200],
  ]);
});
