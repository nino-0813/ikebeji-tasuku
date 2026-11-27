"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseClient, db } from "@/lib/supabase";
import { invitation, TEAM_COOKIE, teamIdentity } from "@/lib/dock-identity";
import { ME_COOKIE, WORKSPACE_COOKIE } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { DEFAULT_WORKSPACE_ID } from "@/lib/data";
import { isTeamPage } from "@/lib/board-pages";
import { REMEMBER_SESSION_SECONDS, TEAM_REFRESH_COOKIE, teamCookieOptions } from "@/lib/dock-session";

export async function personalLogin(_previous: string | null, form: FormData): Promise<string | null> {
  const code = String(form.get("invite") || "");
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || !password) return "メールアドレスとパスワードを入力してください。";
  if (code) {
    const account = invitation(code);
    if (!account) return "登録リンクを確認してください。";
    if (password.length < 12) return "パスワードは12文字以上で設定してください。";
    const [member, identity] = account;
    const membership = await db.from("tm_workspace_members").select("member_id")
      .eq("workspace_id", WITH_DOCK_ID).eq("member_id", member).maybeSingle();
    if (!membership.data) return "このメンバーは登録できません。";
    const { error } = await db.auth.admin.createUser({ id: identity.id, email, password, email_confirm: true });
    if (error) return "登録できませんでした。登録済みの場合はログインしてください。";
  }
  // signInWithPassword changes the client session. Never use the shared admin client here.
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  const session = data.session;
  if (error || !session) return "メールアドレスまたはパスワードを確認してください。";
  const member = await teamIdentity(session.access_token);
  if (!member) return "このアカウントではウィズドックを開けません。";
  const store = await cookies();
  const remember = form.get("remember") === "yes";
  store.delete("tm_auth");
  store.set(TEAM_COOKIE, session.access_token, remember
    ? { ...teamCookieOptions, maxAge: session.expires_in }
    : teamCookieOptions);
  if (remember) {
    store.set(TEAM_REFRESH_COOKIE, session.refresh_token, { ...teamCookieOptions, maxAge: REMEMBER_SESSION_SECONDS });
  } else {
    store.delete(TEAM_REFRESH_COOKIE);
  }
  const target = String(form.get("workspace") || store.get(WORKSPACE_COOKIE)?.value || DEFAULT_WORKSPACE_ID);
  store.set(WORKSPACE_COOKIE, isTeamPage(target) ? target : DEFAULT_WORKSPACE_ID, remember
    ? { ...teamCookieOptions, maxAge: REMEMBER_SESSION_SECONDS }
    : teamCookieOptions);
  store.set(ME_COOKIE, member, teamCookieOptions);
  redirect("/");
}
