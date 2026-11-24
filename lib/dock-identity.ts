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
  const [auth, membership] = await Promise.all([
    db.auth.getUser(token),
    db.from("tm_workspace_members").select("member_id").eq("workspace_id", WITH_DOCK_ID),
  ]);
  const user = auth.data.user;
  if (auth.error || !user || membership.error) return null;
  const member = entries.find(([, identity]) => identity.id === user.id)?.[0];
  return member && membership.data.some(row => row.member_id === member) ? member : null;
}
