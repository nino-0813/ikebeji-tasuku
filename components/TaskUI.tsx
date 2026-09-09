"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Comment, Goal, Member, Project, Subtask, Task, TaskAttachment } from "@/lib/types";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/types";
import { addDaysISO, formatDateLong, todayISO } from "@/lib/format";
import { addComment, addSubtask, createTask, deleteInboxItem, deleteSubtask, deleteTask, toggleSubtask, updateTask } from "@/lib/actions";
import { Avatar } from "./ui";

export type NewTaskDefaults = {
  title?: string;
  category?: Task["category"];
  owner_id?: string;
  status?: Task["status"];
  goal_id?: string | null;
  project_id?: string | null;
  meeting_id?: string | null;
  due_date?: string;
  inbox_id?: string;
};

type Ctx = {
  openNew: (defaults?: NewTaskDefaults) => void;
  openTask: (task: Task) => void;
  members: Member[];
  goals: Goal[];
  projects: Project[];
  me: Member | null;
};

const TaskUIContext = createContext<Ctx | null>(null);

export function useTaskUI() {
  const ctx = useContext(TaskUIContext);
  if (!ctx) throw new Error("useTaskUI must be used inside <TaskUIProvider>");
  return ctx;
}

export function TaskUIProvider({
  members,
  goals,
  projects,
  me,
  children,
}: {
  members: Member[];
  goals: Goal[];
  projects: Project[];
  me: Member | null;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<NewTaskDefaults | null>(null);

  const openNew = useCallback((defaults?: NewTaskDefaults) => {
    setEditing(null);
    setCreating(defaults ?? {});
  }, []);
  const openTask = useCallback((task: Task) => {
    setCreating(null);
    setEditing(task);
  }, []);
  const close = useCallback(() => {
    setEditing(null);
    setCreating(null);
  }, []);

  // どこにいても「n」で新規タスク
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openNew();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);

  const value = useMemo(
    () => ({ openNew, openTask, members, goals, projects, me }),
    [openNew, openTask, members, goals, projects, me],
  );

  return (
    <TaskUIContext.Provider value={value}>
      {children}
      {(editing || creating) && (
        <TaskDialog
          key={editing?.id ?? "new"}
          task={editing}
          defaults={creating ?? undefined}
          members={members}
          goals={goals}
          projects={projects}
          me={me}
          onClose={close}
        />
      )}
    </TaskUIContext.Provider>
  );
}

// ---------------------------------------------------------------- ダイアログ

function TaskDialog({
  task,
  defaults,
  members,
  goals,
  projects,
  me,
  onClose,
}: {
  task: Task | null;
  defaults?: NewTaskDefaults;
  members: Member[];
  goals: Goal[];
  projects: Project[];
  me: Member | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTaskId, setActiveTaskId] = useState(task?.id);
  const isNew = !activeTaskId;

  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [category, setCategory] = useState<Task["category"]>(
    task?.category ?? defaults?.category ?? "marketing",
  );
  const [ownerId, setOwnerId] = useState(
    task?.owner_id ?? defaults?.owner_id ?? members.find((member) => member.id === me?.id)?.id ?? members[0]?.id ?? "",
  );
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaults?.due_date ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "mid");
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? defaults?.status ?? "todo");
  const [waitingOn, setWaitingOn] = useState(task?.waiting_on ?? "");
  const [goalId, setGoalId] = useState(task?.goal_id ?? defaults?.goal_id ?? "");
  const [projectId, setProjectId] = useState(task?.project_id ?? defaults?.project_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const missing: string[] = [];
  if (!title.trim()) missing.push("タスク名");
  if (!ownerId) missing.push("担当者");
  if (!dueDate) missing.push("期限");
  const canSave = missing.length === 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const payload = {
      title,
      detail,
      category,
      owner_id: ownerId,
      due_date: dueDate,
      priority,
      status,
      waiting_on: status === "waiting" ? waitingOn : null,
      goal_id: goalId || null,
      project_id: projectId || null,
      meeting_id: task?.meeting_id ?? defaults?.meeting_id ?? null,
    };
    let createdId: string | undefined;
    const res = activeTaskId
      ? await updateTask(activeTaskId, payload)
      : await createTask(payload).then((result) => {
          createdId = result.id;
          return result;
        });
    if (res.error) {
      setSaving(false);
      setError(res.error);
      return;
    }
    const taskId = activeTaskId ?? createdId;
    if (taskId && isNew) setActiveTaskId(taskId);
    if (taskId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        const upload = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
        if (!upload.ok) {
          const body = await upload.json().catch(() => ({}));
          setSaving(false);
          setError(body.error ?? `「${file.name}」のアップロードに失敗しました。`);
          router.refresh();
          return;
        }
      }
    }
    if (isNew && defaults?.inbox_id) await deleteInboxItem(defaults.inbox_id);
    setSaving(false);
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!activeTaskId) return;
    if (!confirm(`「${title}」を削除します。よろしいですか？`)) return;
    setSaving(true);
    const res = await deleteTask(activeTaskId);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  const dueShortcuts: { label: string; value: string }[] = [
    { label: "今日", value: todayISO() },
    { label: "明日", value: addDaysISO(1) },
    { label: "3日後", value: addDaysISO(3) },
    { label: "1週間後", value: addDaysISO(7) },
    { label: "1ヶ月後", value: addDaysISO(30) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 sm:p-8">
      <div
        className="pop-in card w-full max-w-2xl shadow-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold">{isNew ? "タスクを追加" : "タスク"}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-ink-mute hover:bg-stone-100"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="label">タスク名</label>
            <input
              autoFocus
              className="field text-base"
              value={title}
              placeholder="例）Google広告の見出し11本を確認して採用案を決める"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">領域</label>
              <Segmented
                options={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
                value={category}
                onChange={(v) => setCategory(v as Task["category"])}
              />
            </div>
            <div>
              <label className="label">
                担当（いまボールを持つ人）<Req />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = ownerId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setOwnerId(m.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        on
                          ? "border-transparent text-white shadow-sm"
                          : "border-line-strong bg-white text-ink-soft hover:bg-stone-50"
                      }`}
                      style={on ? { background: m.color } : undefined}
                    >
                      <Avatar member={m} size={16} />
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                期限<Req />
              </label>
              <input
                type="date"
                className="field tnum"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {dueShortcuts.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setDueDate(s.value)}
                    className="rounded border border-line-strong bg-white px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-stone-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {dueDate && (
                <p className="tnum mt-1 text-[11px] text-ink-mute">{formatDateLong(dueDate)}</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">優先度</label>
                <Segmented
                  options={PRIORITIES.map((p) => ({ key: p.key, label: p.label }))}
                  value={priority}
                  onChange={(v) => setPriority(v as Task["priority"])}
                />
              </div>
              <div>
                <label className="label">ステータス</label>
                <Segmented
                  options={STATUSES.map((s) => ({ key: s.key, label: s.label }))}
                  value={status}
                  onChange={(v) => setStatus(v as Task["status"])}
                  small
                />
              </div>
            </div>
          </div>

          {status === "waiting" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <label className="label text-amber-800">何を待っている？（誰の・何の返事か）</label>
              <input
                className="field"
                value={waitingOn}
                placeholder="例）農家さんに商品写真を依頼中"
                onChange={(e) => setWaitingOn(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-amber-700">
                ここを書いておくと、次の打ち合わせで「誰に何を催促するか」が一目でわかります。
              </p>
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <label className="label">プロジェクト（どの塊の中の作業か）</label>
              <select
                className="field"
                value={projectId}
                onChange={(e) => {
                  const next = e.target.value;
                  setProjectId(next);
                  // プロジェクトを選んだら、領域と目標もそれに合わせる
                  const proj = projects.find((p) => p.id === next);
                  if (proj) {
                    setCategory(proj.category);
                    if (proj.goal_id) setGoalId(proj.goal_id);
                  }
                }}
              >
                <option value="">— プロジェクト未設定 —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {goals.length > 0 && (
            <div>
              <label className="label">紐づく目標（任意）</label>
              <select className="field" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">— 紐づけない —</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">メモ・決まったこと（任意）</label>
            <textarea
              className="field min-h-20 resize-y"
              value={detail}
              placeholder="打ち合わせで決まった前提、参考リンク、判断の理由など"
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <AttachmentList
            taskId={activeTaskId}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
          />

          {activeTaskId && <SubtaskList taskId={activeTaskId} />}
          {activeTaskId && <CommentThread taskId={activeTaskId} members={members} me={me} />}

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <div className="text-[11px] text-ink-mute">
            {missing.length > 0 ? (
              <span className="text-amber-700">{missing.join("・")}は必須です</span>
            ) : (
              <span>⌘ + Enter で保存</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={remove}
                className="rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:bg-stone-50"
            >
              キャンセル
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-sm transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "保存中…" : isNew ? "追加する" : "保存する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function AttachmentList({
  taskId,
  pendingFiles,
  onPendingFilesChange,
}: {
  taskId?: string;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<TaskAttachment[] | null>(taskId ? null : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    const res = await fetch(`/api/tasks/${taskId}/attachments`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "添付ファイルを取得できませんでした。");
    setItems(body.attachments ?? []);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    fetch(`/api/tasks/${taskId}/attachments`)
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (!ok) throw new Error(body.error);
        setItems(body.attachments ?? []);
      })
      .catch((e) => { if (alive) { setItems([]); setError(e.message); } });
    return () => { alive = false; };
  }, [taskId]);

  async function choose(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const selected = Array.from(files);
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setError(`「${oversized.name}」は10MBを超えています。`);
      return;
    }
    if (!taskId) {
      onPendingFilesChange([...pendingFiles, ...selected]);
      return;
    }
    setBusy(true);
    for (const file of selected) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `「${file.name}」をアップロードできませんでした。`);
        break;
      }
    }
    await load().catch((e) => setError(e.message));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(item: TaskAttachment) {
    if (!taskId || !confirm(`「${item.file_name}」を削除しますか？`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/attachments/${item.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? "削除できませんでした。");
    else await load().catch((e) => setError(e.message));
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label mb-0">添付ファイル</p>
          <p className="text-[11px] text-ink-mute">1ファイル10MBまで</p>
        </div>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-medium hover:bg-stone-50 disabled:opacity-40">
          {busy ? "処理中…" : "ファイルを選択"}
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void choose(e.target.files)} />
      </div>
      <div className="mt-2 space-y-1">
        {items === null && <p className="text-xs text-ink-mute">読み込み中…</p>}
        {items?.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-stone-50">
            <span aria-hidden="true">📎</span>
            <a className="min-w-0 flex-1 truncate text-sm text-brand hover:underline" href={`/api/tasks/${taskId}/attachments/${item.id}`} target="_blank" rel="noreferrer">{item.file_name}</a>
            <span className="shrink-0 text-[11px] text-ink-mute">{formatBytes(item.size_bytes)}</span>
            <button type="button" disabled={busy} onClick={() => void remove(item)} className="px-1 text-xs text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100">削除</button>
          </div>
        ))}
        {pendingFiles.map((file, index) => (
          <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded bg-brand-soft px-2 py-1.5">
            <span aria-hidden="true">📎</span>
            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
            <span className="text-[11px] text-ink-mute">{formatBytes(file.size)}</span>
            <button type="button" onClick={() => onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))} className="px-1 text-xs text-red-600">取消</button>
          </div>
        ))}
        {items?.length === 0 && pendingFiles.length === 0 && <p className="text-xs text-ink-mute">まだ添付ファイルはありません。</p>}
      </div>
      {!taskId && pendingFiles.length > 0 && <p className="mt-2 text-[11px] text-ink-mute">タスクの保存時にアップロードします。</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SubtaskList({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<Subtask[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`);
    const data = await res.json();
    setItems(data.subtasks ?? []);
  }, [taskId]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tasks/${taskId}/subtasks`)
      .then((res) => res.json())
      .then((data) => { if (alive) setItems(data.subtasks ?? []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [taskId]);

  async function add() {
    if (!title.trim() || busy) return;
    setBusy(true);
    await addSubtask(taskId, title);
    setTitle("");
    await load();
    setBusy(false);
  }

  const done = items?.filter((item) => item.done).length ?? 0;
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="label mb-0">サブタスク</p>
        {items && items.length > 0 && <span className="text-[11px] text-ink-mute">{done}/{items.length} 完了</span>}
      </div>
      <div className="space-y-1">
        {items === null && <p className="text-xs text-ink-mute">読み込み中…</p>}
        {items?.map((item) => (
          <div key={item.id} className="group flex min-h-9 items-center gap-2 rounded px-1 hover:bg-stone-50">
            <button
              type="button"
              onClick={async () => { await toggleSubtask(item.id, !item.done); await load(); }}
              className={`grid size-5 place-items-center rounded border ${item.done ? "border-brand bg-brand text-white" : "border-line-strong bg-white"}`}
              aria-label={item.done ? "未完了に戻す" : "完了にする"}
            >{item.done ? "✓" : ""}</button>
            <span className={`min-w-0 flex-1 text-sm ${item.done ? "text-ink-mute line-through" : "text-ink"}`}>{item.title}</span>
            <button type="button" onClick={async () => { await deleteSubtask(item.id); await load(); }} className="px-2 text-xs text-ink-mute opacity-0 group-hover:opacity-100" aria-label="サブタスクを削除">削除</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} placeholder="サブタスクを追加" />
        <button type="button" disabled={!title.trim() || busy} onClick={add} className="shrink-0 rounded-lg border border-line-strong px-3 text-xs font-medium disabled:opacity-40">追加</button>
      </div>
    </div>
  );
}

function Req() {
  return <span className="ml-1 text-red-500">*</span>;
}

function Segmented({
  options,
  value,
  onChange,
  small,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line-strong bg-stone-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 font-medium transition ${small ? "py-1 text-[11px]" : "py-1.5 text-xs"} ${
            value === o.key ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CommentThread({
  taskId,
  members,
  me,
}: {
  taskId: string;
  members: Member[];
  me: Member | null;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((d) => alive && setComments(d.comments ?? []))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [taskId]);

  async function send() {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    await addComment(taskId, me.id, body);
    const res = await fetch(`/api/tasks/${taskId}/comments`).then((r) => r.json());
    setComments(res.comments ?? []);
    setBody("");
    setSending(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-line bg-stone-50/60 p-3">
      <p className="label">やり取り</p>
      <div className="space-y-2">
        {comments === null && <p className="text-xs text-ink-mute">読み込み中…</p>}
        {comments?.length === 0 && (
          <p className="text-xs text-ink-mute">
            まだありません。詰まっていることをここに書けば、次の打ち合わせを待たずに動きます。
          </p>
        )}
        {comments?.map((c) => {
          const author = members.find((m) => m.id === c.author_id);
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar member={author} size={22} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-mute">
                  {author?.name ?? "?"} ・{" "}
                  {new Date(c.created_at).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      {me ? (
        <div className="mt-2 flex gap-2">
          <input
            className="field"
            value={body}
            placeholder={`${me.name}としてコメント`}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="shrink-0 rounded-lg border border-line-strong bg-white px-3 text-xs font-medium text-ink-soft hover:bg-stone-50 disabled:opacity-40"
          >
            送信
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-mute">右上で「自分が誰か」を選ぶとコメントできます。</p>
      )}
    </div>
  );
}
