import { isTeamPage } from "./board-pages";
import { createHash } from "node:crypto";
import identities from "./dock-invitations.json";
import { db } from "./supabase";
import { WITH_DOCK_ID } from "./meeting-inbox";
import { authTemporarilyUnavailable } from "./dock-session";

export const TEAM_COOKIE = "dock_personal";
const entries = Object.entries(identities);

export function invitation(code: string) {
  const digest = createHash("sha256").update(code).digest("hex");
  return entries.find(([, identity]) => identity.digest === digest);
}

export async function teamIdentity(token: string | undefined) {
  return (await teamIdentityStatus(token)).member;
}

export async function teamIdentityStatus(token: string | undefined) {
  if (!token) return { member: null, unavailable: false };
  const [auth, membership] = await Promise.all([
    db.auth.getUser(token),
    db.from("tm_workspace_members").select("member_id").eq("workspace_id", WITH_DOCK_ID),
  ]);
  const user = auth.data.user;
  if (authTemporarilyUnavailable(auth.error) || (!auth.error && membership.error)) {
    return { member: null, unavailable: true };
  }
  if (auth.error || !user || membership.error) return { member: null, unavailable: false };
  const match = entries.find(([, identity]) => identity.id === user.id)?.[0];
  const member = match && membership.data.some(row => row.member_id === match) ? match : null;
  return { member, unavailable: false };
}

export async function canOpenWorkspace(member: string, id: string) {
  if (isTeamPage(id)) return true;
  const { data, error } = await db.from("tm_workspace_members").select("member_id")
    .eq("workspace_id", id).eq("member_id", member).maybeSingle();
  return !error && Boolean(data);
}
