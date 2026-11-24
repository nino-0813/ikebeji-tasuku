import { createHash } from "node:crypto";
import identities from "./dock-invitations.json";
import { db } from "./supabase";
import { WITH_DOCK_ID } from "./meeting-inbox";

export const TEAM_COOKIE = "dock_personal";
const entries = Object.entries(identities);

export function invitation(code: string) {
  const digest = createHash("sha256").update(code).digest("hex");
  return entries.find(([, identity]) => identity.digest === digest);
}

export async function teamIdentity(token: string | undefined) {
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const account = entries.find(([, identity]) => identity.id === data.user.id);
  if (!account) return null;
  const [member] = account;
  const membership = await db.from("tm_workspace_members").select("member_id")
    .eq("workspace_id", WITH_DOCK_ID).eq("member_id", member).maybeSingle();
  return membership.data && !membership.error ? member : null;
}
