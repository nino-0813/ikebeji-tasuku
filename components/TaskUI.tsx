"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Comment, Goal, Member, Task } from "@/lib/types";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/types";
import { addDaysISO, formatDateLong, todayISO } from "@/lib/format";
import { addComment, createTask, deleteTask, updateTask } from "@/lib/actions";
import { Avatar } from "./ui";

export type NewTaskDefaults = {
  category?: Task["category"];
  owner_id?: string;
  status?: Task["status"];
  goal_id?: string | null;
  meeting_id?: string | null;
  due_date?: string;
};

type Ctx = {
  openNew: (defaults?: NewTaskDefaults) => void;
  openTask: (task: Task) => void;
  members: Member[];
  goals: Goal[];
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
  me,
  children,
}: {
  members: Member[];
  goals: Goal[];
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

  const value = useMemo(() => ({ openNew, openTask, members, goals, me }), [openNew, openTask, members, goals, me]);

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
  me,
  onClose,
}: {
  task: Task | null;
  defaults?: NewTaskDefaults;
  members: Member[];
  goals: Goal[];
  me: Member | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [category, setCategory] = useState<Task["category"]>(
    task?.category ?? defaults?.category ?? "marketing",
  );
  const [ownerId, setOwnerId] = useState(task?.owner_id ?? defaults?.owner_id ?? me?.id ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaults?.due_date ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "mid");
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? defaults?.status ?? "todo");
  const [waitingOn, setWaitingOn] = useState(task?.waiting_on ?? "");
  const [goalId, setGoalId] = useState(task?.goal_id ?? defaults?.goal_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      meeting_id: task?.meeting_id ?? defaults?.meeting_id ?? null,
    };
    const res = isNew ? await createTask(payload) : await updateTask(task.id, payload);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!task) return;
    if (!confirm(`「${task.title}」を削除します。よろしいですか？`)) return;
    setSaving(true);
    const res = await deleteTask(task.id);
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

          {!isNew && <CommentThread taskId={task.id} members={members} me={me} />}

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
