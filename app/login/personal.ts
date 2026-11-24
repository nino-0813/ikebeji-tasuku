"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { invitation, TEAM_COOKIE, teamIdentity } from "@/lib/dock-identity";
import { ME_COOKIE, WORKSPACE_COOKIE } from "@/lib/data";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import { AUTH_COOKIE } from "@/lib/auth";

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
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  const session = data.session;
  if (error || !session) return "メールアドレスまたはパスワードを確認してください。";
  const member = await teamIdentity(session.access_token);
  if (!member) return "このアカウントではウィズドックを開けません。";
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  store.delete(AUTH_COOKIE);
  store.set(TEAM_COOKIE, session.access_token, { ...options, maxAge: session.expires_in });
  store.set(WORKSPACE_COOKIE, WITH_DOCK_ID, options);
  store.set(ME_COOKIE, member, options);
  redirect("/");
}
