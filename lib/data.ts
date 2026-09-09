import { cookies } from "next/headers";
import { db } from "./supabase";
import type { Comment, Goal, GoalLog, InboxItem, Meeting, Member, Project, Subtask, Task, Workspace } from "./types";

export const ME_COOKIE = "tm_me";
export const WORKSPACE_COOKIE = "tm_workspace";
export const DEFAULT_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await db.from("tm_workspaces").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getActiveWorkspaceId(): Promise<string> {
  const store = await cookies();
  return store.get(WORKSPACE_COOKIE)?.value || DEFAULT_WORKSPACE_ID;
}

export async function getCurrentWorkspace(): Promise<Workspace | null> {
  const [workspaces, activeId] = await Promise.all([getWorkspaces(), getActiveWorkspaceId()]);
  return workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null;
}

export async function getMembers(): Promise<Member[]> {
  const { data, error } = await db.from("tm_members").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/** 「今このブラウザを使っているのは誰か」。未設定なら null */
export async function getMe(): Promise<Member | null> {
  const store = await cookies();
  const id = store.get(ME_COOKIE)?.value;
  if (!id) return null;
  const members = await getMembers();
  return members.find((m) => m.id === id) ?? null;
}

export async function getTasks(): Promise<Task[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db
    .from("tm_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true })
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTask(id: string): Promise<Task | null> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db.from("tm_tasks").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await db
    .from("tm_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getInboxItems(): Promise<InboxItem[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db.from("tm_inbox_items").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await db
    .from("tm_subtasks")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getGoals(): Promise<Goal[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db
    .from("tm_goals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("horizon", { ascending: false })
    .order("deadline");
  if (error) throw error;
  return data ?? [];
}

/** 畳んでいないプロジェクト。並び順 → 作成順 */
export async function getProjects(): Promise<Project[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db
    .from("tm_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 畳んだものも含めた全プロジェクト */
export async function getAllProjects(): Promise<Project[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db
    .from("tm_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("archived", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db.from("tm_projects").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGoalLogs(goalId: string): Promise<GoalLog[]> {
  const { data, error } = await db
    .from("tm_goal_logs")
    .select("*")
    .eq("goal_id", goalId)
    .order("recorded_on", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMeetings(): Promise<Meeting[]> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db
    .from("tm_meetings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("held_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const workspaceId = await getActiveWorkspaceId();
  const { data, error } = await db.from("tm_meetings").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw error;
  return data;
}
