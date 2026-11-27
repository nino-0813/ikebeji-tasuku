"use client";
import { useActionState, useEffect, useState } from "react";
import { personalLogin } from "./personal";

export function PersonalForm({ workspace }: { workspace: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, action, pending] = useActionState(personalLogin, null);
  useEffect(() => {
    const readInvite = () => setCode(new URLSearchParams(window.location.hash.slice(1)).get("invite") || "");
    readInvite();
    window.addEventListener("hashchange", readInvite);
    return () => window.removeEventListener("hashchange", readInvite);
  }, []);
  const setup = Boolean(code);
  return <form action={action} className="card space-y-4 p-5">
    <h1 className="text-xl font-bold">{setup ? "初回登録" : "ログイン"}</h1>
    {setup && <p>ご自身のメールアドレスと、12文字以上のパスワードを設定してください。</p>}
    <input type="hidden" name="workspace" value={workspace} />
    <input type="hidden" name="invite" value={code || ""} />
    <label className="label">メールアドレス<input className="field" type="email" name="email" required autoComplete="username" /></label>
    <label className="label">パスワード<input className="field" type="password" name="password" required minLength={setup ? 12 : 1} autoComplete={setup ? "new-password" : "current-password"} /></label>
    <label className="flex items-start gap-2 text-sm">
      <input className="mt-0.5" type="checkbox" name="remember" value="yes" />
      <span>この端末でログインを保持する<span className="mt-1 block text-xs text-ink-mute">30日間利用しないと、再ログインが必要です。</span></span>
    </label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className="w-full rounded-lg bg-brand p-2 font-bold text-white" disabled={code === null || pending}>{pending ? "確認中…" : setup ? "登録して入る" : "ログインする"}</button>
    {setup && <a className="block text-sm underline" href="/login?team=withdock">登録済みの方はこちら</a>}
  </form>;
}
