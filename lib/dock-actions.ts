"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireDock } from "./dock-access";
import { dockToday, httpUrl, isDockDate, PREFECTURES } from "./dock-project";
import { getProject, getWorkspaceMembers } from "./data";
import { WITH_DOCK_ID } from "./meeting-inbox";
import { db } from "./supabase";

export async function reviewProposal(form: FormData) {
  const { member: actor } = await requireDock("approve_proposals");
  const edit = Object.fromEntries(
    ["title", "project", "customer", "name", "owner", "due"].map((k) => [
      k,
      String(form.get(k) || "").trim(),
    ]),
  );
  const { error } = await db.rpc("dock_review", {
    pid: form.get("id"),
    expected_version: Number(form.get("version")),
    decision: form.get("decision"),
    actor_id: actor,
    edit,
  });
  if (error)
    throw new Error(
      "保存できませんでした。候補の状態と、登録先・担当者・期日を確認してください。",
    );
  revalidatePath("/", "layout");
}

export async function addCustomer(form: FormData) {
  await requireDock("edit_operations");
  const entry = Object.fromEntries(
    ["name", "summary", "next_action", "stage"].map((k) => [
      k,
      String(form.get(k) || "").trim(),
    ]),
  );
  if (!entry.name || !["lead", "negotiation", "active"].includes(entry.stage))
    throw new Error("顧客名・状況を確認してください。");
  const { error } = await db.rpc("dock_create_customer", { entry });
  if (error) throw new Error("顧客を保存できませんでした。すでに登録されている顧客名を確認してください。");
  revalidatePath("/customers");
}

function field(f: FormData, k: string) {
  return String(f.get(k) || "").trim();
}
export async function saveTarget(f: FormData) {
  await requireDock("edit_finance");
  const month = field(f, "month"),
    kind = field(f, "kind"),
    amount = field(f, "amount");
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !["one_off", "recurring"].includes(kind) ||
    !/^\d{1,14}$/.test(amount)
  )
    throw new Error("月・区分・金額を確認してください。");
  const { error } = await db
    .from("dock_monthly_targets")
    .upsert(
      { month: month + "-01", kind, amount: Number(amount) },
      { onConflict: "month,kind" },
    );
  if (error) throw new Error("目標を保存できませんでした。");
  revalidatePath("/", "layout");
}
export async function registerProject(f: FormData) {
  await requireDock("edit_operations");
  const title = field(f, "title");
  const phase = field(f, "phase");
  const customer = field(f, "customer");
  const prefecture = field(f, "prefecture");
  const finish = field(f, "finish");
  if (!title || !customer || !["production", "maintenance"].includes(phase) ||
      (prefecture && !PREFECTURES.includes(prefecture)) || (finish && !isDockDate(finish)))
    throw new Error("案件名・顧客・状態・日付を確認してください。");
  const members = await getWorkspaceMembers();
  const { data, error } = await db.rpc("dock_register_project", {
    entry: {
      id: field(f, "request"),
      title,
      client_name: field(f, "legal") || null,
      client_website: optionalUrl(f, "website"),
      dock_customer_id: customer,
      phase,
      category: "system",
      workspace_id: WITH_DOCK_ID,
      dock_owner_ids: members.filter((m) => f.getAll("member").includes(m.id)).map((m) => m.id),
      dock_finish_on: finish || null,
      dock_preview_url: optionalUrl(f, "preview"),
      dock_deployment_url: optionalUrl(f, "deployment"),
      prefecture,
      address: field(f, "address"),
      email: field(f, "email"),
      phone: field(f, "phone"),
    },
  });
  if (error || !data) throw new Error("案件を保存できませんでした。");
  revalidatePath("/", "layout");
  redirect("/projects/" + data);
}

function optionalUrl(f: FormData, key: string) {
  const value = field(f, key);
  const url = httpUrl(value);
  if (value && !url) throw new Error("有効なURLを入力してください。");
  return url;
}

async function selectedProject(f: FormData, permission: "edit_operations" | "edit_finance" = "edit_operations") {
  await requireDock(permission);
  const project = await getProject(field(f, "project"));
  if (!project || project.workspace_id !== WITH_DOCK_ID)
    throw new Error("案件を選択してください。");
  return project;
}

export async function saveProductionLinks(f: FormData) {
  const project = await selectedProject(f);
  const { error } = await db.from("tm_projects").update({
    client_website: optionalUrl(f, "website"),
    dock_preview_url: optionalUrl(f, "preview") ?? "",
    dock_deployment_url: optionalUrl(f, "deployment"),
  }).eq("workspace_id", WITH_DOCK_ID).eq("id", project.id);
  if (error) throw new Error("制作リンクを保存できませんでした。");
  revalidatePath("/projects/" + project.id);
}

export async function assignCustomer(f: FormData) {
  const p = await selectedProject(f);
  const { error } = await db.rpc("dock_assign_customer", {
    project: p.id, customer: field(f, "customer"),
  });
  if (error) throw new Error("顧客を設定できませんでした。");
  revalidatePath("/", "layout");
}
export async function addContract(f: FormData) {
  const p = await selectedProject(f, "edit_finance");
  const { error } = await db
    .from("dock_contracts")
    .upsert(
      {
        id: field(f, "request"),
        project_id: p.id,
        legal_name: field(f, "legal_name"),
        kind: field(f, "kind"),
        scope: field(f, "scope"),
        free_support_terms: field(f, "free_support_terms"),
        starts_on: field(f, "starts_on") || null,
        ends_on: field(f, "ends_on") || null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw new Error("契約を保存できませんでした。");
  revalidatePath("/projects/" + p.id);
}
export async function addPayment(f: FormData) {
  const p = await selectedProject(f, "edit_finance");
  const contract = field(f, "contract");
  const check = await db
    .from("dock_contracts")
    .select("id")
    .eq("id", contract)
    .eq("project_id", p.id)
    .maybeSingle();
  if (!check.data) throw new Error("この案件の契約を選択してください。");
  const { error } = await db
    .from("dock_payments")
    .upsert(
      {
        id: field(f, "request"),
        contract_id: contract,
        label: field(f, "label"),
        certainty: field(f, "certainty"),
        amount: field(f, "amount"),
        due_on: field(f, "due_on"),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw new Error("入金予定を保存できませんでした。");
  revalidatePath("/", "layout");
}
export async function receivePayment(f: FormData) {
  await requireDock("edit_finance");
  const received = field(f, "received_on");
  const amount = field(f, "received_amount");
  if (!isDockDate(received) || received > dockToday() || !/^[1-9]\d{0,13}$/.test(amount))
    throw new Error("実入金日と金額を確認してください。");
  const { error } = await db.rpc("dock_apply_receipt", {
    payment: field(f, "payment") || null,
    contract: field(f, "contract") || null,
    period: field(f, "period") || null,
    receipt: field(f, "request"),
    received,
    value: Number(amount),
  });
  if (error) throw new Error("入金を記録できませんでした。残額を確認してください。");
  revalidatePath("/", "layout");
}

export async function saveRecurringRate(f: FormData) {
  const p = await selectedProject(f, "edit_finance");
  const contract = field(f, "contract");
  const date = field(f, "effective_on");
  const amount = field(f, "amount");
  const day = Number(field(f, "day_of_month"));
  if (!isDockDate(date) || !/^\d{1,14}$/.test(amount) || !Number.isInteger(day) || day < 1 || day > 31)
    throw new Error("適用日・月額・入金予定日を確認してください。");
  const match = await db.from("dock_contracts").select("id").eq("id", contract)
    .eq("kind", "recurring").eq("project_id", p.id).maybeSingle();
  if (!match.data) throw new Error("継続契約を選択してください。");
  const { error } = await db.from("dock_recurring_rates").upsert({
    contract_id: contract, effective_on: date, amount: Number(amount), day_of_month: day,
  }, { onConflict: "contract_id,effective_on" });
  if (error) throw new Error("継続支援費を保存できませんでした。");
  revalidatePath("/", "layout");
}

export async function updateCustomer(f: FormData) {
  const { member } = await requireDock("edit_operations");
  const stage = field(f, "stage");
  const source = field(f, "source_kind");
  if (!["lead", "negotiation", "active"].includes(stage) || !["manual", "meeting"].includes(source))
    throw new Error("顧客の状況と履歴の種類を確認してください。");
  const { error } = await db.rpc("dock_update_customer", {
    customer: field(f, "customer"),
    entry: {
      stage, summary: field(f, "summary"), next_action: field(f, "next_action"),
      history_url: optionalUrl(f, "history_url"), note: field(f, "note"),
      source_url: optionalUrl(f, "source_url"), source_kind: source, actor: member,
      request: field(f, "request"),
    },
  });
  if (error) throw new Error("顧客情報を更新できませんでした。");
  revalidatePath("/", "layout");
}

export async function saveCustomerForecast(f: FormData) {
  await requireDock("edit_finance");
  const amount = field(f, "amount");
  const month = field(f, "month");
  const confidence = field(f, "confidence");
  if (amount && (!/^[1-9]\d{0,13}$/.test(amount) || !isDockDate(month + "-01") || !["low", "medium", "high"].includes(confidence)))
    throw new Error("見込月・金額・確度を確認してください。");
  const { error } = await db.from("dock_customers").update({
    forecast_amount: amount ? Number(amount) : null,
    forecast_month: amount ? month + "-01" : null,
    forecast_confidence: amount ? confidence : null,
  }).eq("id", field(f, "customer")).neq("stage", "active").select("id").single();
  if (error) throw new Error("商談予測を保存できませんでした。");
  revalidatePath("/", "layout");
}

export async function saveDockPermissions(f: FormData) {
  await requireDock("manage");
  const member = field(f, "member");
  const members = await getWorkspaceMembers();
  if (!members.some((m) => m.id === member)) throw new Error("メンバーを選択してください。");
  const view = f.has("view_finance");
  const { error } = await db.from("dock_permissions").upsert({
    member_id: member,
    view_finance: view,
    edit_finance: view && f.has("edit_finance"),
    edit_operations: f.has("edit_operations"),
    approve_proposals: f.has("approve_proposals"),
  });
  if (error) throw new Error("権限を保存できませんでした。");
  revalidatePath("/", "layout");
}

export async function reviewImprovementEffect(f: FormData) {
  await requireDock("edit_operations");
  const date = field(f, "review_on");
  if (date && !isDockDate(date)) throw new Error("振り返り日を確認してください。");
  const { error } = await db.from("dock_improvements").update({
    expected_effect: field(f, "expected_effect") || null,
    review_on: date || null,
    review_result: field(f, "review_result") || null,
  }).eq("id", field(f, "improvement")).not("task_id", "is", null).select("id").single();
  if (error) throw new Error("効果検証を保存できませんでした。");
  revalidatePath("/improvements");
}

export async function adoptImprovement(f: FormData) {
  const project = await selectedProject(f),
    owner = field(f, "owner"),
    id = field(f, "improvement");
  const [proposal, member] = await Promise.all([
    db
      .from("dock_improvements")
      .select("title,detail,task_id")
      .eq("id", id)
      .single(),
    db
      .from("tm_workspace_members")
      .select("member_id")
      .eq("workspace_id", WITH_DOCK_ID)
      .eq("member_id", owner)
      .maybeSingle(),
  ]);
  if (!proposal.data || !member.data)
    throw new Error("改善案と担当者を確認してください。");
  if (!proposal.data.task_id) {
    const task = await db
      .from("tm_tasks")
      .upsert(
        {
          id,
          workspace_id: WITH_DOCK_ID,
          project_id: project.id,
          title: proposal.data.title,
          detail: proposal.data.detail,
          category: project.category,
          owner_id: owner,
          due_date: field(f, "due"),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (task.error) throw new Error("タスクを作成できませんでした。");
    const linked = await db
      .from("dock_improvements")
      .update({ task_id: id })
      .eq("id", id)
      .is("task_id", null);
    if (linked.error)
      throw new Error("タスクを作成しました。再試行すると紐付けを完了します。");
  }
  revalidatePath("/", "layout");
}

export async function addStep(f: FormData) {
  const p = await selectedProject(f);
  const owner = field(f, "owner");
  if (owner && !(await getWorkspaceMembers()).some((m) => m.id === owner))
    throw new Error("担当者を確認してください。");
  const { error } = await db
    .from("dock_steps")
    .upsert(
      {
        id: field(f, "request"),
        project_id: p.id,
        title: field(f, "title"),
        position: Number(field(f, "position")),
        owner_id: owner || null,
        starts_on: field(f, "starts_on") || null,
        due_on: field(f, "due_on") || null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw new Error("工程名と日付を確認してください。");
  revalidatePath("/", "layout");
}
export async function finishStep(f: FormData) {
  const p = await selectedProject(f);
  const completed_on = field(f, "completed_on") || null;
  if (completed_on && !isDockDate(completed_on)) throw new Error("完成日を確認してください。");
  const { error } = await db
    .from("dock_steps")
    .update({ completed_on })
    .eq("project_id", p.id)
    .eq("id", field(f, "step"));
  if (error) throw new Error("完成日を更新できませんでした。");
  revalidatePath("/", "layout");
}
export async function archiveProject(f: FormData) {
  const p = await selectedProject(f);
  const archived = field(f, "archive") === "yes";
  const date = field(f, "archived_on");
  const reason = field(f, "archive_reason");
  const support = field(f, "archive_support");
  if (archived && (!isDockDate(date) || !reason || !["continue", "end", "none"].includes(support)))
    throw new Error("終了日・理由・保守の扱いを確認してください。");
  const ended = p.archived && p.dock_archive_support !== "continue" && Boolean(p.dock_archive_support);
  const willEnd = archived && support !== "continue";
  if (ended !== willEnd || (ended && date !== p.dock_archived_on)) {
    const { data, error } = await db.from("dock_contracts").select("id").eq("project_id", p.id)
      .eq("kind", "recurring").limit(1).maybeSingle();
    if (error) throw new Error("保守契約を確認できませんでした。");
    if (data) await requireDock("edit_finance");
  }
  const { error } = await db.from("tm_projects").update(archived ? {
    archived, dock_archived_on: date, dock_archive_reason: reason, dock_archive_support: support,
  } : { archived }).eq("id", p.id).eq("workspace_id", WITH_DOCK_ID);
  if (error) throw new Error("案件の状態を変更できませんでした。");
  revalidatePath("/", "layout");
}

export async function saveDockProject(f: FormData) {
  const p = await selectedProject(f);
  const members = await getWorkspaceMembers();
  const title = field(f, "title");
  const phase = field(f, "phase");
  const finish = field(f, "finish");
  if (!title || !["sales", "production", "maintenance"].includes(phase) ||
      (finish && !isDockDate(finish)) || (phase !== "sales" && !p.dock_customer_id && p.phase === "sales"))
    throw new Error("案件名、顧客との紐づけ、状態、完了予定日を確認してください。");
  const { error } = await db.rpc("dock_update_project", {
    project: p.id,
    entry: {
      title, phase,
      detail: field(f, "detail") || null,
      client_name: field(f, "legal") || null,
      dock_finish_on: finish || null,
      dock_owner_ids: members.filter(m => f.getAll("member").includes(m.id)).map(m => m.id),
    },
  });
  if (error) throw new Error("案件情報を保存できませんでした。");
  revalidatePath("/", "layout");
}

export async function saveRecurringEnd(f: FormData) {
  const project = await selectedProject(f, "edit_finance");
  const date = field(f, "ends_on");
  if (date && !isDockDate(date)) throw new Error("終了日を確認してください。");
  const { error } = await db.from("dock_contracts").update({ ends_on: date || null })
    .eq("id", field(f, "contract")).eq("project_id", project.id)
    .eq("kind", "recurring").select("id").single();
  if (error) throw new Error("継続契約の終了日を更新できませんでした。");
  revalidatePath("/", "layout");
}
