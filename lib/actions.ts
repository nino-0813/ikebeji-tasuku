"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./supabase";
import { getActiveWorkspaceId, ME_COOKIE, WORKSPACE_COOKIE } from "./data";
import { AUTH_COOKIE, authToken } from "./auth";
import type { Category, Horizon, Priority, Status } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- ログイン

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  const password = String(form.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  if (!expected) return "APP_PASSWORD が .env.local に設定されていません。";
  if (password !== expected) return "合言葉が違います。";

  const store = await cookies();
  store.set(AUTH_COOKIE, authToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  const member = String(form.get("member") ?? "");
  if (member) store.set(ME_COOKIE, member, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}

export async function setMe(memberId: string) {
  const store = await cookies();
  store.set(ME_COOKIE, memberId, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  refresh();
}

// ---------------------------------------------------------------- ページ

export async function setWorkspace(workspaceId: string): Promise<{ error?: string }> {
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

export async function createWorkspace(name: string): Promise<{ error?: string; id?: string }> {
  const cleanName = name.trim();
  if (!cleanName) return { error: "ページ名を入力してください。" };
  if (cleanName.length > 40) return { error: "ページ名は40文字以内で入力してください。" };

  const { count } = await db.from("tm_workspaces").select("id", { count: "exact", head: true });
  const colors = ["#15803d", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2"];
  const { data, error } = await db
    .from("tm_workspaces")
    .insert({ name: cleanName, color: colors[(count ?? 0) % colors.length], sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { error: error.message };

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
  if (!input.due_date) return "期限を入れてください。";
  return null;
}

export async function createTask(input: TaskInput): Promise<{ error?: string; id?: string }> {
  const error = validate(input);
  if (error) return { error };

  const workspaceId = await getActiveWorkspaceId();
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
      title: input.title.trim(),
      workspace_id: workspaceId,
      detail: input.detail?.trim() || null,
      category: input.category,
      owner_id: input.owner_id,
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

  if (dbError) return { error: dbError.message };
  refresh();
  return { id: data.id };
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>,
): Promise<{ error?: string }> {
  if (patch.title !== undefined && !patch.title.trim()) return { error: "タスク名は空にできません。" };
  if (patch.owner_id !== undefined && !patch.owner_id) return { error: "担当者は空にできません。" };
  if (patch.due_date !== undefined && !patch.due_date) return { error: "期限は空にできません。" };

  const clean: Record<string, unknown> = { ...patch };
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

/** ボードのドラッグ＆ドロップ。列と並び順をまとめて確定させる */
export async function moveTask(
  id: string,
  status: Status,
  orderedIdsInColumn: string[],
): Promise<{ error?: string }> {
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
  const { error } = await db.from("tm_tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 止まっているタスクを「今日から仕切り直す」。status_changed_at を今にリセットする */
export async function nudgeTask(id: string): Promise<{ error?: string }> {
  const { error } = await db
    .from("tm_tasks")
    .update({ status_changed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteTask(id: string): Promise<{ error?: string }> {
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
  if (!body.trim()) return { error: "コメントが空です。" };
  const { error } = await db
    .from("tm_comments")
    .insert({ task_id: taskId, author_id: authorId, body: body.trim() });
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- Inbox

export async function createInboxItem(title: string, createdBy?: string | null) {
  if (!title.trim()) return { error: "メモを入力してください。" };
  const workspaceId = await getActiveWorkspaceId();
  const { error } = await db.from("tm_inbox_items").insert({
    title: title.trim(),
    workspace_id: workspaceId,
    created_by: createdBy || null,
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteInboxItem(id: string) {
  const { error } = await db.from("tm_inbox_items").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- サブタスク

export async function addSubtask(taskId: string, title: string) {
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
  const { error } = await db.from("tm_subtasks").update({ done }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteSubtask(id: string) {
  const { error } = await db.from("tm_subtasks").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- 打ち合わせ

export async function createMeeting(title: string, heldOn: string) {
  const workspaceId = await getActiveWorkspaceId();
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
  const { error } = await db.from("tm_meetings").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteMeeting(id: string) {
  const { error } = await db.from("tm_meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

// ---------------------------------------------------------------- プロジェクト

export type ProjectInput = {
  title: string;
  detail?: string | null;
  category: Category;
  goal_id?: string | null;
  color?: string;
};

export async function createProject(input: ProjectInput): Promise<{ error?: string; id?: string }> {
  if (!input.title.trim()) return { error: "プロジェクト名を入れてください。" };

  const workspaceId = await getActiveWorkspaceId();
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
  if (patch.title !== undefined && !patch.title.trim())
    return { error: "プロジェクト名は空にできません。" };

  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.title === "string") clean.title = clean.title.trim();
  if (typeof clean.detail === "string") clean.detail = clean.detail.trim() || null;
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
  const { error } = await db.from("tm_projects").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 一覧の並べ替え */
export async function reorderProjects(orderedIds: string[]): Promise<{ error?: string }> {
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
  if (!input.title.trim()) return { error: "目標名を入れてください。" };
  if (!input.deadline) return { error: "期限を入れてください。" };
  const workspaceId = await getActiveWorkspaceId();
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
  const { error } = await db.from("tm_goals").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** 実績を記録する。goals.current_value も最新値に合わせて更新する */
export async function addGoalLog(goalId: string, value: number, recordedOn: string, memo?: string) {
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
  const { error } = await db.from("tm_goals").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}
