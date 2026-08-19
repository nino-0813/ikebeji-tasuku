"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InboxItem, Member } from "@/lib/types";
import { createInboxItem, deleteInboxItem } from "@/lib/actions";
import { useTaskUI } from "./TaskUI";

export function InboxUI({ items, me }: { items: InboxItem[]; me: Member | null }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { openNew } = useTaskUI();

  function capture() {
    if (!title.trim() || pending) return;
    start(async () => {
      await createInboxItem(title, me?.id);
      setTitle("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="card flex gap-2 p-2">
        <input autoFocus className="field border-0 bg-transparent shadow-none" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") capture(); }} placeholder="思いついたことを入力して Enter" />
        <button onClick={capture} disabled={!title.trim() || pending} className="rounded-lg bg-brand px-4 text-xs font-bold text-white disabled:opacity-40">保存</button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-mute">Inboxは空です。思いついたことをすぐに放り込めます。</div>
      ) : (
        <div className="card divide-y divide-line">
          {items.map((item) => (
            <div key={item.id} className="group flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm text-ink">{item.title}</span>
              <span className="hidden text-[11px] text-ink-mute sm:block">{new Date(item.created_at).toLocaleDateString("ja-JP")}</span>
              <button onClick={() => openNew({ title: item.title, inbox_id: item.id })} className="rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand">タスクにする</button>
              <button onClick={() => start(async () => { await deleteInboxItem(item.id); router.refresh(); })} className="rounded-md px-2 py-1.5 text-xs text-ink-mute hover:bg-stone-100">削除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
