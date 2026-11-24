import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./supabase";
import { getActiveWorkspaceId } from "./data";
import { WITH_DOCK_ID } from "./meeting-inbox";

export const TEAM_COOKIE = "dock_team";
export function signTeamMember(member:string, expires:number, key:string) {
  const body = JSON.stringify([member, expires]);
  const payload = Buffer.from(body).toString("base64url");
  const signature = createHmac("sha256",key).update(payload).digest("base64url");
  return payload+"."+signature;
}
export const dockTeamMember = cache(async () => {
  const key = process.env.WITHDOCK_TEAM_PASSWORD;
  if (!key || await getActiveWorkspaceId() !== WITH_DOCK_ID) return null;
  const token = (await cookies()).get(TEAM_COOKIE)?.value;
  if (!token) return null;
  const [payload] = token.split(".");
  try {
    const [member,expires] = JSON.parse(Buffer.from(payload,"base64url").toString());
    if (typeof member !== "string" || !Number.isSafeInteger(expires) || expires<Date.now()) return null;
    const signed = Buffer.from(signTeamMember(member,expires,key)), received=Buffer.from(token);
    if (received.length!==signed.length || !timingSafeEqual(received,signed)) return null;
    const {data,error} = await db.from("tm_workspace_members").select("member_id").eq("workspace_id",WITH_DOCK_ID).eq("member_id",member).maybeSingle();
    return !error && data ? member : null;
  } catch {return null;}
});
