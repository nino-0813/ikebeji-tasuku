"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InboxItem, Member, Project } from "@/lib/types";
import { createInboxItem, deleteInboxItem, linkMeetingItem } from "@/lib/actions";
import { readSource, sourceUrl } from "@/lib/meeting-inbox";
import { reviewGroups } from "@/lib/meeting-review";
import { useTaskUI } from "./TaskUI";

type TaskOption = {id:string; title:string};
export function InboxUI({ items, me, tasks }: { items: InboxItem[]; me: Member | null; tasks:TaskOption[] }) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { openNew, projects } = useTaskUI();
  const groups = useMemo(() => reviewGroups(items, projects), [items, projects]);
  const [filter, setFilter] = useState("all");

  const [limit,setLimit] = useState(12);
  const visible = groups.filter(g=>filter==="all" || (g.project?.id || "unknown")===filter);

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
          {groups.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <strong>会議の候補 {groups.reduce((sum,g)=>sum+g.entries.length,0)}件 → 確認する項目 {groups.length}件</strong>
            <select aria-label="登録先の候補で絞り込み" className="field max-w-xs" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(12);}}>
              <option value="all">すべての登録先</option><option value="unknown">登録先を相談・新規作成</option>
              {projects.filter(p=>groups.some(g=>g.project?.id===p.id)).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select></div>}
          {visible.slice(0,limit).map(({entries,project})=>{
            const members = entries.map(entry=>entry.item).sort((a,b)=>a.id.localeCompare(b.id));
            return <MeetingCandidate key={members[0].id} item={members[0]} siblings={members.slice(1)} tasks={tasks} project={project}/>;
          })}
          {visible.length > limit && <button className="w-full p-3 text-sm font-bold text-brand" onClick={()=>setLimit(limit+12)}>次の{Math.min(12,visible.length-limit)}項目を表示（残り{visible.length-limit}項目）</button>}
          {groups.length > 0 && !visible.length && <p className="p-4 text-sm">この登録先の候補はありません。</p>}
          {items.filter(item=>!readSource(item.detail)).map((item) => (
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

function MeetingCandidate({item,tasks,project,siblings=[]}:{item:InboxItem;tasks:TaskOption[];project:Project|null;siblings?:InboxItem[]}) {
  const candidate = readSource(item.detail)!;
  const {source,state} = candidate;
  const [choosing,setChoosing] = useState(state === "linking");
  const [target,setTarget] = useState(candidate.target);
  const [error,setError] = useState("");
  const [busy,start] = useTransition();
  const {openNew} = useTaskUI();
  const router = useRouter();
  const group = [item, ...siblings];
  const grouped = siblings.length > 0;
  async function applyAll(action:(id:string)=>Promise<{error?:string}>) {
    for (const member of group) {
      const result = await action(member.id);
      if (result.error) return result;
    }
    return {};
  }
  const defaults = {project_id:project?.id, category:project?.category, goal_id:project?.goal_id};
  function review(action:()=>Promise<{error?:string}>) {
    start(async()=>{
      try { const result = await action(); setError(result.error || ""); router.refresh(); }
      catch { setError("保存できませんでした。もう一度お試しください。"); }
    });
  }
  return <article className="space-y-2 px-4 py-4">
    <p className="text-xs text-ink-mute">会議からの候補　{source.date}</p>
    <h2 className="font-bold">{item.title}</h2>
    <p className="text-sm text-brand">登録先候補　{project?.title || "未定（選択・新規作成できます）"}</p>
    {grouped && <details className="rounded-lg bg-stone-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">似ている候補 {group.length}件を確認・個別に判断</summary>
      {group.map(member => {
        const evidence = readSource(member.detail)!.source;
        return <div key={member.id} className="mt-3 border-t pt-2"><strong>{member.title}</strong><p>{evidence.quote}</p>
          <a className="text-brand underline" href={sourceUrl(evidence)} target="_blank" rel="noopener noreferrer">{evidence.date} · {evidence.meeting}</a>
          <div className="mt-2 flex gap-4"><button disabled={busy} onClick={()=>openNew({...defaults,title:member.title,candidate_id:member.id})}>この候補だけタスクにする</button>
          <button disabled={busy} onClick={()=>review(()=>deleteInboxItem(member.id))}>この候補だけ見送る</button></div></div>;
      })}</details>}
    <blockquote className="border-l-2 border-line-strong pl-3 text-sm">{source.quote}</blockquote>
    {(source.owner || source.timing) && <p className="text-xs text-ink-mute">{[source.owner && "担当の発言："+source.owner, source.timing && "時期の発言："+source.timing].filter(Boolean).join("　")}</p>}
    <a href={sourceUrl(source)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">議事録を開く · {source.meeting}</a>
    <div className="flex flex-wrap gap-2">
      {state !== "linking" && <button className="rounded-md bg-brand-soft px-3 py-2 text-xs font-bold text-brand" disabled={busy} onClick={()=>openNew({...defaults,title:item.title,candidate_id:item.id,related_candidates:siblings.map(s=>s.id)})}>{grouped ? group.length+"件をまとめてタスクにする" : "タスクにする"}</button>}
      {state === "pending" && <><button disabled={busy} className="px-2 text-xs" onClick={()=>setChoosing(!choosing)}>既存タスクに紐づける</button>
      <button disabled={busy} className="px-2 text-xs text-ink-mute" onClick={()=>review(()=>applyAll(deleteInboxItem))}>{grouped ? "まとめて見送る" : "見送る"}</button></>}
    </div>
    {choosing && <div className="flex flex-wrap gap-2"><select className="field max-w-full" aria-label="紐づけ先のタスク" disabled={state === "linking"} value={target} onChange={e=>setTarget(e.target.value)}><option value="">タスクを選ぶ</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
    <button className="text-sm font-bold text-brand" disabled={!target || busy} onClick={()=>review(()=>applyAll(id=>linkMeetingItem(id,target)))}>このタスクに紐づける</button></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </article>;
}
