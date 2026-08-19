"use client";

import { useActionState, useState } from "react";
import type { Member } from "@/lib/types";
import { signIn } from "@/lib/actions";
import { Avatar } from "@/components/ui";

export function LoginForm({ members }: { members: Member[] }) {
  const [error, action, pending] = useActionState(signIn, null);
  const [member, setMember] = useState(members[0]?.id ?? "");

  return (
    <form action={action} className="card space-y-4 p-5 shadow-sm">
      <div>
        <label className="label">自分は誰？</label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const on = member === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMember(m.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "border-transparent text-white shadow-sm"
                    : "border-line-strong bg-white text-ink-soft hover:bg-stone-50"
                }`}
                style={on ? { background: m.color } : undefined}
              >
                <Avatar member={m} size={18} />
                {m.name}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="member" value={member} />
      </div>

      <div>
        <label className="label" htmlFor="password">
          合言葉
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field"
        />
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "確認中…" : "入る"}
      </button>
    </form>
  );
}
