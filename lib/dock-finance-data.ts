import "server-only";
import { cache } from "react";
import { db } from "./supabase";
import { WITH_DOCK_ID } from "./meeting-inbox";
import { monthOffset, projectRecurringPayments, type FeeKind, type Payment } from "./dock-cash";

export const dockFinance = cache(async (month: string) => {
  const start = month + "-01";
  const end = monthOffset(month, 4) + "-01";
  const [targets, contracts, sales] = await Promise.all([
    db.from("dock_monthly_targets").select("month,kind,amount").gte("month", start).lt("month", end),
    db.from("dock_contracts").select(
      "id,legal_name,project_id,kind,starts_on,ends_on,tm_projects!inner(workspace_id,archived,dock_archived_on,dock_archive_support),dock_recurring_rates(effective_on,amount,day_of_month),dock_payments(id,label,due_on,amount,certainty,dock_receipts(received_on,amount))",
    ).eq("tm_projects.workspace_id", WITH_DOCK_ID),
    db.from("dock_customers").select("id,name,forecast_month,forecast_amount,forecast_confidence")
      .neq("stage", "active").gte("forecast_month", start).lt("forecast_month", end),
  ]);
  if (targets.error || contracts.error || sales.error) throw new Error("入金情報を取得できませんでした。");
  const payments: Payment[] = contracts.data.flatMap(c => c.dock_payments.map(p => ({
    ...p, project: c.project_id, contract: c.id, customer: c.legal_name, kind: c.kind as FeeKind,
    certainty: p.certainty as Payment["certainty"], receipts: p.dock_receipts,
  })));
  const recurring = contracts.data.filter(c => c.kind === "recurring").map(c => {
    const project = Array.isArray(c.tm_projects) ? c.tm_projects[0] : c.tm_projects;
    const archivedEnd = project?.archived && ["end", "none"].includes(project.dock_archive_support)
      ? project.dock_archived_on : null;
    return {
      ...c,
      ends_on: archivedEnd && (!c.ends_on || archivedEnd < c.ends_on) ? archivedEnd : c.ends_on,
    };
  });
  payments.push(...projectRecurringPayments(recurring, payments, monthOffset(month, 3)));
  payments.sort((a, b) => a.due_on.localeCompare(b.due_on));
  return {
    targets: targets.data.map(t => ({ ...t, kind: t.kind as FeeKind })),
    payments,
    sales: sales.data.map(s => ({
      id: s.id, name: s.name, month: s.forecast_month,
      amount: Number(s.forecast_amount), confidence: s.forecast_confidence,
    })),
  };
});
