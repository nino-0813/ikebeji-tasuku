"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InboxItem, Member } from "@/lib/types";
import { createInboxItem, deleteInboxItem, linkMeetingItem } from "@/lib/actions";
import { readSource, sourceUrl } from "@/lib/meeting-inbox";
import { useTaskUI } from "./TaskUI";

type TaskOption = {id:string; title:string};
export function InboxUI({ items, me, tasks }: { items: InboxItem[]; me: Member | null; tasks:TaskOption[] }) {
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
          {items.map((item) => readSource(item.detail) ? <MeetingCandidate key={item.id} item={item} tasks={tasks}/> : (
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

function MeetingCandidate({item,tasks}:{item:InboxItem;tasks:TaskOption[]}) {
  const candidate = readSource(item.detail)!;
  const {source,state} = candidate;
  const [choosing,setChoosing] = useState(state === "linking");
  const [target,setTarget] = useState(candidate.target);
  const [error,setError] = useState("");
  const [busy,start] = useTransition();
  const {openNew} = useTaskUI();
  const router = useRouter();
  function review(action:()=>Promise<{error?:string}>) {
    start(async()=>{
      try { const result = await action(); setError(result.error || ""); router.refresh(); }
      catch { setError("保存できませんでした。もう一度お試しください。"); }
    });
  }
  return <article className="space-y-2 px-4 py-4">
    <p className="text-xs text-ink-mute">会議からの候補　{source.date}</p>
    <h2 className="font-bold">{item.title}</h2>
    <blockquote className="border-l-2 border-line-strong pl-3 text-sm">{source.quote}</blockquote>
    {(source.owner || source.timing) && <p className="text-xs text-ink-mute">{[source.owner && "担当の発言："+source.owner, source.timing && "時期の発言："+source.timing].filter(Boolean).join("　")}</p>}
    <a href={sourceUrl(source)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">議事録を開く · {source.meeting}</a>
    <div className="flex flex-wrap gap-2">
      {state !== "linking" && <button className="rounded-md bg-brand-soft px-3 py-2 text-xs font-bold text-brand" disabled={busy} onClick={()=>openNew({title:item.title,candidate_id:item.id})}>タスクにする</button>}
      {state === "pending" && <><button disabled={busy} className="px-2 text-xs" onClick={()=>setChoosing(!choosing)}>既存タスクに紐づける</button>
      <button disabled={busy} className="px-2 text-xs text-ink-mute" onClick={()=>review(()=>deleteInboxItem(item.id))}>見送る</button></>}
    </div>
    {choosing && <div className="flex flex-wrap gap-2"><select className="field max-w-full" aria-label="紐づけ先のタスク" disabled={state === "linking"} value={target} onChange={e=>setTarget(e.target.value)}><option value="">タスクを選ぶ</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
    <button className="text-sm font-bold text-brand" disabled={!target || busy} onClick={()=>review(()=>linkMeetingItem(item.id,target))}>このタスクに紐づける</button></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </article>;
}
