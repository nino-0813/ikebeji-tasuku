"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WITH_DOCK_ID, readSource, encodeSource, sourceNote, type ReviewState } from "./meeting-inbox";
import { db } from "./supabase";
import { getActiveWorkspaceId, ME_COOKIE, WORKSPACE_COOKIE } from "./data";

import { TEAM_COOKIE, canOpenWorkspace } from "./dock-identity";
import { dockTeamMember, signedInMember } from "./dock-team";
import { TEAM_REFRESH_COOKIE } from "./dock-session";
import { dockAccess, requireDock } from "./dock-access";
import { isDockDate } from "./dock-project";

import type { Category, Horizon, Priority, ProjectPhase, Status } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

async function requireRecord(table: string, id: string) {
  const workspace = await getActiveWorkspaceId();
  if (workspace === WITH_DOCK_ID) await requireDock("edit_operations");
  const { data } = await db.from(table).select("id").eq("id", id).eq("workspace_id", workspace).maybeSingle();
  if (!data) throw new Error("このページの対象を選択してください。");
}

async function requireSubtask(id: string) {
  const { data } = await db.from("tm_subtasks").select("task_id").eq("id", id).maybeSingle();
  if (!data) throw new Error("サブタスクが見つかりません。");
  await requireRecord("tm_tasks", data.task_id);
}

async function checkTaskLinks(input: Partial<TaskInput>) {
  await Promise.all([
    input.goal_id && requireRecord("tm_goals", input.goal_id),
    input.meeting_id && requireRecord("tm_meetings", input.meeting_id),
    input.project_id && requireRecord("tm_projects", input.project_id),
  ]);
}

// ---------------------------------------------------------------- ログイン

export async function signOut() {
  const store = await cookies();
  const accessToken = store.get(TEAM_COOKIE)?.value;
  if (accessToken) await db.auth.admin.signOut(accessToken, "local");
  for (const key of [TEAM_COOKIE, TEAM_REFRESH_COOKIE, WORKSPACE_COOKIE, ME_COOKIE, "tm_auth"]) store.delete(key);
  redirect("/login");
}

export async function setWorkspace(workspaceId: string): Promise<{ error?: string }> {
  await getActiveWorkspaceId();
  const member = await signedInMember();
  if (!member || !(await canOpenWorkspace(member, workspaceId))) return { error: "このページは開けません。" };
  const { data, error } = await db.from("tm_workspaces").select("id").eq("id", workspaceId).maybeSingle();
  if (error || !data) return { error: error?.message ?? "ページが見つかりません。" };

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
  return {};
}

export async function createWorkspace(name: string, memberIds: string[]): Promise<{ error?: string; id?: string }> {
  await getActiveWorkspaceId();
  const member = await signedInMember();
  if (!member || !memberIds.includes(member)) return { error: "自分を構成員に含めてください。" };
  const cleanName = name.trim();
  if (!cleanName) return { error: "ページ名を入力してください。" };
  if (cleanName.length > 40) return { error: "ページ名は40文字以内で入力してください。" };
  if (!memberIds.length) return { error: "構成員を1人以上選んでください。" };

  const { count } = await db.from("tm_workspaces").select("id", { count: "exact", head: true });
  const colors = ["#15803d", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2"];
  const { data, error } = await db
    .from("tm_workspaces")
    .insert({ name: cleanName, color: colors[(count ?? 0) % colors.length], sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: memberError } = await db.from("tm_workspace_members").insert(
    [...new Set(memberIds)].map((memberId) => ({ workspace_id: data.id, member_id: memberId })),
  );
  if (memberError) {
    await db.from("tm_workspaces").delete().eq("id", data.id);
    return { error: memberError.message };
  }

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
  return { id: data.id };
}

// ---------------------------------------------------------------- タスク

export type TaskInput = {
  title: string;
  detail?: string | null;
  category: Category;
  owner_id: string;
  start_date?: string;
  due_date: string;
  priority?: Priority;
  status?: Status;
  waiting_on?: string | null;
  goal_id?: string | null;
  meeting_id?: string | null;
  project_id?: string | null;
};

/**
 * 担当者と期限は必須。「誰かがいつかやる」タスクを構造的に作れなくするための番人。
 */
function validate(input: TaskInput): string | null {
  if (!input.title.trim()) return "タスク名を入れてください。";
  if (!input.owner_id) return "担当者（ボールを持つ人）を選んでください。";
  if (!isDockDate(input.due_date)) return "期限を入れてください。";
  if (input.start_date && input.start_date > input.due_date) return "開始日は期限以前にしてください。";
  return null;
}

export async function createTask(input: TaskInput): Promise<{ error?: string; id?: string }> {
  return insertTask(input);
}

async function insertTask(input: TaskInput, candidateId?: string): Promise<{ error?: string; id?: string }> {
  await checkTaskLinks(input);
  const error = validate(input);
  if (error) return { error };

  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId === WITH_DOCK_ID) {
    await requireDock("edit_operations");
    const { data } = await db.from("tm_workspace_members").select("member_id")
      .eq("workspace_id", workspaceId).eq("member_id", input.owner_id).maybeSingle();
    if (!data) return { error: "with dockの担当者を選んでください。" };
  }
  // 新規は各列の先頭に積む
  const { data: top } = await db
    .from("tm_tasks")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .eq("status", input.status ?? "todo")
    .order("sort_order", { ascending: true })
    .limit(1);
  const sort_order = (top?.[0]?.sort_order ?? 0) - 1;

  const { data, error: dbError } = await db
    .from("tm_tasks")
    .insert({
      ...(candidateId ? { id: candidateId } : {}),
      title: input.title.trim(),
      workspace_id: workspaceId,
      detail: input.detail?.trim() || null,
      category: input.category,
      owner_id: input.owner_id,
      start_date: input.start_date || new Date().toISOString().slice(0, 10),
      due_date: input.due_date,
      priority: input.priority ?? "mid",
      status: input.status ?? "todo",
      waiting_on: input.waiting_on?.trim() || null,
      goal_id: input.goal_id || null,
      meeting_id: input.meeting_id || null,
      project_id: input.project_id || null,
      sort_order,
    })
    .select("id")
    .single();

  if (candidateId && dbError?.code === "23505") {
    const existing = await db.from("tm_tasks").select("id").eq("id", candidateId).eq("workspace_id", workspaceId).maybeSingle();
    if (existing.data) return { id: existing.data.id };
  }
  if (dbError) return { error: dbError.message };
  refresh();
  return { id: data.id };
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>,
): Promise<{ error?: string }> {
  await checkTaskLinks(patch);
  await requireRecord("tm_tasks", id);
  if (patch.owner_id && (await getActiveWorkspaceId()) === WITH_DOCK_ID) {
    const { data } = await db.from("tm_workspace_members").select("member_id")
      .eq("workspace_id", WITH_DOCK_ID).eq("member_id", patch.owner_id).maybeSingle();
    if (!data) return { error: "with dockの担当者を選んでください。" };
  }
  if (patch.title !== undefined && !patch.title.trim()) return { error: "タスク名は空にできません。" };
  if (patch.owner_id !== undefined && !patch.owner_id) return { error: "担当者は空にできません。" };
  if (patch.due_date !== undefined && !isDockDate(patch.due_date)) return { error: "期限は空にできません。" };
  if (patch.start_date && patch.due_date && patch.start_date > patch.due_date)
    return { error: "開始日は期限以前にしてください。" };

  const clean: Record<string, unknown> = { ...patch };
  delete clean.workspace_id;
  delete clean.id;
  if (typeof clean.title === "string") clean.title = clean.title.trim();
  if (typeof clean.detail === "string") clean.detail = clean.detail.trim() || null;
  if (typeof clean.waiting_on === "string") clean.waiting_on = clean.waiting_on.trim() || null;
  if (clean.goal_id === "") clean.goal_id = null;
  if (clean.project_id === "") clean.project_id = null;

  const { error } = await db.from("tm_tasks").update(clean).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/**
 * タスクを別ページへ移す。ページ固有のプロジェクト・目標・打ち合わせは解除し、
 * コメント・サブタスク・添付ファイルはタスクに紐づいたまま保持する。
 */
export async function moveTaskToWorkspace(
  id: string,
  workspaceId: string,
  ownerId: string,
): Promise<{ error?: string }> {
  await requireRecord("tm_tasks", id);
  const member = await signedInMember();
  if (!member || !(await canOpenWorkspace(member, workspaceId))) return { error: "このページには移動できません。" };
  if (workspaceId === WITH_DOCK_ID && (await getActiveWorkspaceId()) !== WITH_DOCK_ID) {
    const { data, error } = await db.from("dock_permissions").select("edit_operations").eq("member_id", member).maybeSingle();
    if (error || data?.edit_operations === false) return { error: "移動先のタスクを編集する権限がありません。" };
  }
  const [{ data: workspace, error: workspaceError }, { data: membership, error: memberError }] =
    await Promise.all([
      db.from("tm_workspaces").select("id").eq("id", workspaceId).maybeSingle(),
      db
        .from("tm_workspace_members")
        .select("member_id")
        .eq("workspace_id", workspaceId)
        .eq("member_id", ownerId)
        .maybeSingle(),
    ]);
  if (workspaceError || !workspace) return { error: "移動先のページが見つかりません。" };
  if (memberError || !membership) return { error: "担当者は移動先ページのメンバーから選んでください。" };

  const { error } = await db
    .from("tm_tasks")
    .update({
      workspace_id: workspaceId,
      owner_id: ownerId,
      project_id: null,
      goal_id: null,
      meeting_id: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** ボードのドラッグ＆ドロップ。列と並び順をまとめて確定させる */
export async function moveTask(
  id: string,
  status: Status,
  orderedIdsInColumn: string[],
): Promise<{ error?: string }> {
  await Promise.all(orderedIdsInColumn.map(taskId => requireRecord("tm_tasks", taskId)));
  await requireRecord("tm_tasks", id);
  const { error } = await db.from("tm_tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  await Promise.all(
    orderedIdsInColumn.map((taskId, index) =>
      db.from("tm_tasks").update({ sort_order: index }).eq("id", taskId),
    ),
  );
  refresh();
  return {};
}

/** カードの「完了」ボタンなど、1クリックのステータス変更 */
export async function setTaskStatus(id: string, status: Status): Promise<{ error?: string }> {
  await requireRecord("tm_tasks", id);
  const { error } = await db.from("tm_tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 止まっているタスクを「今日から仕切り直す」。status_changed_at を今にリセットする */
export async function nudgeTask(id: string): Promise<{ error?: string }> {
  await requireRecord("tm_tasks", id);
  const { error } = await db
    .from("tm_tasks")
    .update({ status_changed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteTask(id: string): Promise<{ error?: string }> {
  await requireRecord("tm_tasks", id);
  const { data: attachments, error: attachmentError } = await db
    .from("tm_task_attachments")
    .select("storage_path")
    .eq("task_id", id);
  if (attachmentError) return { error: attachmentError.message };
  if (attachments?.length) {
    const { error: storageError } = await db.storage
      .from("task-attachments")
      .remove(attachments.map((item) => item.storage_path));
    if (storageError) return { error: storageError.message };
  }
  const { error } = await db.from("tm_tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function addComment(taskId: string, authorId: string, body: string) {
  await requireRecord("tm_tasks", taskId);
  if (!body.trim()) return { error: "コメントが空です。" };
  const { error } = await db
    .from("tm_comments")
    .insert({ task_id: taskId, author_id: await signedInMember(), body: body.trim() });
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- Inbox

export async function createInboxItem(title: string, createdBy?: string | null) {
  if (!title.trim()) return { error: "メモを入力してください。" };
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId === WITH_DOCK_ID) await requireDock("edit_operations");
  const { error } = await db.from("tm_inbox_items").insert({
    title: title.trim(),
    workspace_id: workspaceId,
    created_by: await signedInMember(),
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

async function meetingItem(id: string) {
  if (!(await dockAccess())?.approve_proposals) return null;
  const { data, error } = await db.from("tm_inbox_items").select("id,detail").eq("id",id).eq("workspace_id",WITH_DOCK_ID).maybeSingle();
  if (error) throw error;
  const parsed = readSource(data?.detail);
  return parsed ? { ...parsed, id } : null;
}
type Imported = NonNullable<Awaited<ReturnType<typeof meetingItem>>>;
async function transition(item: Imported, state: ReviewState, target = "") {
  const next = encodeSource(item.source, state, target);
  const before = encodeSource(item.source,item.state,item.target);
  const { data,error } = await db.from("tm_inbox_items").update({detail:next})
    .eq("id",item.id).eq("workspace_id",WITH_DOCK_ID)
    .like("detail", before.slice(0,before.indexOf("\n")) + "\n%").select("id");
  if (error) throw error;
  return Boolean(data?.length);
}
async function claim(id: string, action: "creating" | "linking", target: string) {
  const item = await meetingItem(id);
  if (!item) return null;
  if (item.target === target && item.state === action) return item;
  if (item.state !== "pending" || !await transition(item,action,target)) return null;
  return { ...item, state:action, target };
}
const reviewed = "候補の状態が変わりました。Inboxを再読み込みしてください。";

export async function promoteMeetingItem(id: string, input: TaskInput, related: string[] = []): Promise<{error?:string; id?:string}> {
  const invalid = validate(input);
  if (invalid) return {error:invalid};
  if (!input.project_id || await getActiveWorkspaceId() !== WITH_DOCK_ID) return {error:"登録先のプロジェクトを選択してください。"};
  await requireDock("edit_operations");
  await requireDock("approve_proposals");
  const {data: project,error: projectError} = await db.from("tm_projects").select("id")
    .eq("id",input.project_id).eq("workspace_id",WITH_DOCK_ID).eq("archived",false).maybeSingle();
  if (projectError || !project) return {error:"登録先のプロジェクトを確認して、もう一度選んでください。"};
  const item = await claim(id,"creating",id);
  if (!item) return {error:reviewed};
  const result = await insertTask({...input, detail:[input.detail,sourceNote(item.source)].filter(Boolean).join("\n\n")},id);
  if (result.error) return result;
  await transition(item,"closed",id);
  for (const otherId of new Set(related)) {
    if (otherId === id) continue;
    const linked = await linkMeetingItem(otherId, id);
    if (linked.error) {
      refresh();
      return {id, error:"タスクを登録しました。一部の候補を紐づけられなかったため、Inboxで残りの候補を確認してください。"};
    }
  }
  refresh();
  return result;
}
export async function linkMeetingItem(id: string, taskId: string): Promise<{error?:string}> {
  if (await getActiveWorkspaceId() !== WITH_DOCK_ID) return {error:reviewed};
  const {data:task} = await db.from("tm_tasks").select("id").eq("workspace_id",WITH_DOCK_ID).eq("id",taskId).maybeSingle();
  const me = await dockTeamMember();
  if (!task || !me) return {error:"ログイン中の担当者と紐づけ先のタスクを確認してください。"};
  const item = await claim(id,"linking",taskId);
  if (!item) return {error:reviewed};
  const {error} = await db.from("tm_comments").upsert({id,task_id:taskId,author_id:me,body:sourceNote(item.source)},{onConflict:"id",ignoreDuplicates:true});
  if (error) return {error:"リンクの保存に失敗しました。同じタスクを選んで再試行してください。"};
  await transition(item,"closed",taskId);
  refresh();
  return {};
}
export async function deleteInboxItem(id: string) {
  const workspace = await getActiveWorkspaceId();
  const {data,error:readError} = await db.from("tm_inbox_items").select("detail").eq("id",id).eq("workspace_id",workspace).maybeSingle();
  if (readError) return {error:readError.message};
  if (readSource(data?.detail)) {
    const item = await meetingItem(id);
    if (!item || item.state !== "pending" || !await transition(item,"closed")) return {error:reviewed};
  } else {
    if (workspace === WITH_DOCK_ID) await requireDock("edit_operations");
    const { error } = await db.from("tm_inbox_items").delete().eq("id",id).eq("workspace_id",workspace);
    if (error) return { error: error.message };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------- サブタスク

export async function addSubtask(taskId: string, title: string) {
  await requireRecord("tm_tasks", taskId);
  if (!title.trim()) return { error: "サブタスクを入力してください。" };
  const { data: last } = await db
    .from("tm_subtasks")
    .select("sort_order")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await db.from("tm_subtasks").insert({
    task_id: taskId,
    title: title.trim(),
    sort_order: (last?.[0]?.sort_order ?? -1) + 1,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function toggleSubtask(id: string, done: boolean) {
  await requireSubtask(id);
  const { error } = await db.from("tm_subtasks").update({ done }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteSubtask(id: string) {
  await requireSubtask(id);
  const { error } = await db.from("tm_subtasks").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- 打ち合わせ

export async function createMeeting(title: string, heldOn: string) {
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId === WITH_DOCK_ID) await requireDock("edit_operations");
  const { data, error } = await db
    .from("tm_meetings")
    .insert({ title: title.trim() || "打ち合わせ", held_on: heldOn, workspace_id: workspaceId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refresh();
  return { id: data.id };
}

export async function updateMeeting(id: string, patch: { title?: string; notes?: string; held_on?: string }) {
  await requireRecord("tm_meetings", id);
  const { error } = await db.from("tm_meetings").update({ ...patch, id, workspace_id: await getActiveWorkspaceId() }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteMeeting(id: string) {
  await requireRecord("tm_meetings", id);
  const { error } = await db.from("tm_meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- プロジェクト

export type ProjectInput = {
  title: string;
  phase?: ProjectPhase;
  detail?: string | null;
  category: Category;
  goal_id?: string | null;
  color?: string;
  client_name?: string | null;
  client_contact_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_website?: string | null;
  contract_amount?: number;
  invoiced_amount?: number;
  paid_amount?: number;
  maintenance_monthly_fee?: number;
  payment_due_date?: string | null;
};

export async function createProject(input: ProjectInput): Promise<{ error?: string; id?: string }> {
  if (input.goal_id) await requireRecord("tm_goals", input.goal_id);
  if (!input.title.trim()) return { error: "プロジェクト名を入れてください。" };

  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId === WITH_DOCK_ID) return { error: "新規案件登録から顧客を紐づけてください。" };
  // 新規は一覧の先頭に積む
  const { data: top } = await db
    .from("tm_projects")
    .select("sort_order")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("sort_order", { ascending: true })
    .limit(1);
  const sort_order = (top?.[0]?.sort_order ?? 0) - 1;

  const { data, error } = await db
    .from("tm_projects")
    .insert({
      title: input.title.trim(),
      phase: input.phase ?? "production",
      workspace_id: workspaceId,
      detail: input.detail?.trim() || null,
      category: input.category,
      goal_id: input.goal_id || null,
      color: input.color || "#15803d",
      sort_order,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refresh();
  return { id: data.id };
}

export async function updateProject(
  id: string,
  patch: Partial<ProjectInput> & { archived?: boolean },
): Promise<{ error?: string }> {
  if (patch.goal_id) await requireRecord("tm_goals", patch.goal_id);
  await requireRecord("tm_projects", id);
  if ((await getActiveWorkspaceId()) === WITH_DOCK_ID) return { error: "案件詳細から案件情報を編集してください。" };
  if (patch.title !== undefined && !patch.title.trim())
    return { error: "プロジェクト名は空にできません。" };

  const clean: Record<string, unknown> = { ...patch };
  delete clean.workspace_id;
  delete clean.id;
  if (typeof clean.title === "string") clean.title = clean.title.trim();
  if (typeof clean.detail === "string") clean.detail = clean.detail.trim() || null;
  for (const key of ["client_name", "client_contact_name", "client_email", "client_phone", "client_website", "payment_due_date"]) {
    if (typeof clean[key] === "string") clean[key] = (clean[key] as string).trim() || null;
  }
  for (const key of ["contract_amount", "invoiced_amount", "paid_amount", "maintenance_monthly_fee"]) {
    if (clean[key] !== undefined) clean[key] = Math.max(0, Number(clean[key]) || 0);
  }
  if (clean.goal_id === "") clean.goal_id = null;

  const { error } = await db.from("tm_projects").update(clean).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/**
 * プロジェクトを削除する。中のタスクは残り、所属だけ外れる（DBの on delete set null）。
 * 中身が全部終わっただけなら削除ではなく updateProject({ archived: true }) を使うこと。
 */
export async function deleteProject(id: string): Promise<{ error?: string }> {
  await requireRecord("tm_projects", id);
  if ((await getActiveWorkspaceId()) === WITH_DOCK_ID) return { error: "案件詳細からアーカイブしてください。" };
  const { error } = await db.from("tm_projects").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 一覧の並べ替え */
export async function reorderProjects(orderedIds: string[]): Promise<{ error?: string }> {
  await Promise.all(orderedIds.map(id => requireRecord("tm_projects", id)));
  await Promise.all(
    orderedIds.map((id, index) => db.from("tm_projects").update({ sort_order: index }).eq("id", id)),
  );
  refresh();
  return {};
}

// ---------------------------------------------------------------- 目標 / KPI

export type GoalInput = {
  title: string;
  category: Category;
  horizon?: Horizon;
  parent_goal_id?: string | null;
  unit: string;
  target_value: number;
  current_value: number;
  start_date: string;
  deadline: string;
  memo?: string | null;
};

export async function createGoal(input: GoalInput) {
  if (input.parent_goal_id) await requireRecord("tm_goals", input.parent_goal_id);
  if (!input.title.trim()) return { error: "目標名を入れてください。" };
  if (!input.deadline) return { error: "期限を入れてください。" };
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId === WITH_DOCK_ID) await requireDock("edit_operations");
  const { error } = await db.from("tm_goals").insert({
    ...input,
    workspace_id: workspaceId,
    title: input.title.trim(),
    horizon: input.horizon ?? "long",
    parent_goal_id: input.parent_goal_id || null,
    memo: input.memo?.trim() || null,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function updateGoal(id: string, patch: Partial<GoalInput> & { archived?: boolean }) {
  if (patch.parent_goal_id) await requireRecord("tm_goals", patch.parent_goal_id);
  await requireRecord("tm_goals", id);
  const { error } = await db.from("tm_goals").update({ ...patch, id, workspace_id: await getActiveWorkspaceId() }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 実績を記録する。goals.current_value も最新値に合わせて更新する */
export async function addGoalLog(goalId: string, value: number, recordedOn: string, memo?: string) {
  await requireRecord("tm_goals", goalId);
  const { error } = await db
    .from("tm_goal_logs")
    .insert({ goal_id: goalId, value, recorded_on: recordedOn, memo: memo?.trim() || null });
  if (error) return { error: error.message };

  const { data: latest } = await db
    .from("tm_goal_logs")
    .select("value")
    .eq("goal_id", goalId)
    .order("recorded_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (latest?.[0]) {
    await db.from("tm_goals").update({ current_value: latest[0].value }).eq("id", goalId);
  }
  refresh();
  return {};
}

export async function deleteGoal(id: string) {
  await requireRecord("tm_goals", id);
  const { error } = await db.from("tm_goals").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}
