import { cookies } from "next/headers";
import { db } from "./supabase";
import type { Comment, Goal, GoalLog, Meeting, Member, Task } from "./types";

export const ME_COOKIE = "tm_me";

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
  const { data, error } = await db
    .from("tm_tasks")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await db.from("tm_tasks").select("*").eq("id", id).maybeSingle();
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

export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await db
    .from("tm_goals")
    .select("*")
    .eq("archived", false)
    .order("deadline");
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await db
    .from("tm_meetings")
    .select("*")
    .order("held_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await db.from("tm_meetings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
