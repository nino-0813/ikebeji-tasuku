import "server-only";
import { cache } from "react";
import { dockTeamMember } from "./dock-team";
import { db } from "./supabase";

const defaults = {
  view_finance: true,
  edit_finance: true,
  edit_operations: true,
  approve_proposals: true,
};

export const dockAccess = cache(async () => {
  const member = await dockTeamMember();
  if (!member) return null;
  const { data, error } = await db.from("dock_permissions").select(
    "view_finance,edit_finance,edit_operations,approve_proposals",
  ).eq("member_id", member).maybeSingle();
  if (error) throw new Error("操作権限を取得できませんでした。");
  return { member, ...(data ?? defaults), manage: member === "ninomiya" };
});

export async function requireDock(permission: keyof typeof defaults | "manage") {
  const access = await dockAccess();
  if (!access?.[permission]) throw new Error("この操作を行う権限がありません。");
  return access;
}

export function configuredAccess<T extends Partial<typeof defaults>>(row: T | undefined) {
  return { ...defaults, ...row };
}
