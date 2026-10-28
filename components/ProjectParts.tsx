"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Goal, Member, Project, Task } from "@/lib/types";
import { CATEGORIES, PROJECT_COLORS, PROJECT_PHASES, type ProjectPhase } from "@/lib/types";
import { daysUntil, isStalled } from "@/lib/format";
import { createProject, deleteProject, updateProject } from "@/lib/actions";
import { TaskRow } from "./TaskCard";
import { Avatar, CategoryBadge, EmptyState } from "./ui";

/** 期限が近い順。同じ日なら優先度の高い方が上 */
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 } as const;
export function byUrgency(a: Task, b: Task) {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export type ProjectSummary = {
  project: Project;
  open: Task[];
  done: Task[];
  owners: Member[];
  overdue: number;
  stalled: number;
};

export function summarize(project: Project, tasks: Task[], members: Member[]): ProjectSummary {
  const mine = tasks.filter((t) => t.project_id === project.id);
  const open = mine.filter((t) => t.status !== "done").sort(byUrgency);
  const done = mine
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const ownerIds = new Set(open.map((t) => t.owner_id));
  return {
    project,
    open,
    done,
    owners: members.filter((m) => ownerIds.has(m.id)),
    overdue: open.filter((t) => daysUntil(t.due_date) < 0).length,
    stalled: open.filter(isStalled).length,
  };
}

// ---------------------------------------------------------------- 一覧

export function ProjectAccordion({
  projects,
  tasks,
  members,
  goals,
  boardMode = false,
}: {
  projects: Project[];
  tasks: Task[];
  members: Member[];
  goals: Goal[];
  boardMode?: boolean;
}) {
  const router = useRouter();
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, ProjectPhase>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [, startMoving] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const summaries = useMemo(
    () => projects.map((p) => summarize(p, tasks, members)),
    [projects, tasks, members],
  );
  const visibleSummaries = summaries.map((summary) => ({
    ...summary,
    project: {
      ...summary.project,
      phase: phaseOverrides[summary.project.id] ?? summary.project.phase,
    },
  }));
  const dragging = visibleSummaries.find((summary) => summary.project.id === draggingId);

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setMoveError(null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    if (!event.over) return;
    const projectId = String(event.active.id);
    const phase = String(event.over.id) as ProjectPhase;
    if (!PROJECT_PHASES.some((item) => item.key === phase)) return;
    const project = visibleSummaries.find((summary) => summary.project.id === projectId)?.project;
    if (!project || project.phase === phase) return;
    const previous = project.phase;
    setPhaseOverrides((current) => ({ ...current, [projectId]: phase }));
    startMoving(async () => {
      const result = await updateProject(projectId, { phase });
      if (result.error) {
        setPhaseOverrides((current) => ({ ...current, [projectId]: previous }));
        setMoveError(result.error);
        return;
      }
      router.refresh();
    });
  }

  // どのプロジェクトにも入っていないタスク（移行中に必ず出るので拾えるようにしておく）
  const orphans = useMemo(
    () => tasks.filter((t) => !t.project_id && t.status !== "done").sort(byUrgency),
    [tasks],
  );

  if (projects.length === 0 && orphans.length === 0) {
    return (
      <EmptyState>
        プロジェクトがまだありません。「ブランドリニューアル」「定期便システム」のように、
        <br />
        しばらく続く塊で1つ作ってみてください。中のタスクが全部終わっても消えません。
      </EmptyState>
    );
  }

  if (!boardMode) {
    return (
      <div className="space-y-2">
        {summaries.map((summary) => (
          <ProjectCard key={summary.project.id} summary={summary} goals={goals} />
        ))}
        {orphans.length > 0 && <OrphanCard tasks={orphans} members={members} projects={projects} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-ink-mute">カード左上のハンドルをつかんで、別の列へ移動できます。</p>
      {moveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">移動できませんでした：{moveError}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <div className="overflow-x-auto pb-2" role="region" aria-label="進行区分別のプロジェクト一覧" tabIndex={0}>
          <div className="grid min-w-[900px] grid-cols-3 gap-4">
            {PROJECT_PHASES.map((phase) => (
              <ProjectPhaseColumn
                key={phase.key}
                phase={phase}
                summaries={visibleSummaries.filter((summary) => summary.project.phase === phase.key)}
                goals={goals}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {dragging ? (
            <div className="w-72 rotate-1 rounded-xl border border-brand bg-white px-4 py-4 shadow-xl">
              <p className="truncate text-sm font-bold text-ink">{dragging.project.title}</p>
              <p className="mt-1 text-[11px] text-ink-mute">移動先の列へドロップ</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {orphans.length > 0 && (
        <OrphanCard tasks={orphans} members={members} projects={projects} />
      )}
    </div>
  );
}

function ProjectPhaseColumn({ phase, summaries, goals }: { phase: (typeof PROJECT_PHASES)[number]; summaries: ProjectSummary[]; goals: Goal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  const tone = phase.key === "sales" ? "bg-amber-500" : phase.key === "production" ? "bg-blue-600" : "bg-green-600";
  const surface = phase.key === "sales" ? "bg-amber-50/40" : phase.key === "production" ? "bg-blue-50/40" : "bg-green-50/40";
  return (
    <section ref={setNodeRef} aria-labelledby={`phase-${phase.key}`} className={`min-h-[420px] rounded-xl border p-3 transition ${isOver ? "border-brand bg-brand-soft/60 ring-2 ring-brand/20" : `border-line ${surface}`}`}>
      <div className="mb-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tone}`} aria-hidden />
          <h2 id={`phase-${phase.key}`} className="text-sm font-bold text-ink">{phase.label}</h2>
          <span className="tnum ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-mute">{summaries.length}件</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-mute">{phase.hint}</p>
      </div>
      <div className="space-y-2">
        {summaries.map((summary) => <DraggableProjectCard key={summary.project.id} summary={summary} goals={goals} />)}
        {summaries.length === 0 && <div className={`rounded-xl border border-dashed bg-white/70 px-4 py-8 text-center text-xs ${isOver ? "border-brand text-brand" : "border-line-strong text-ink-mute"}`}>{isOver ? "ここへ移動" : `${phase.label}のプロジェクトはありません`}</div>}
      </div>
    </section>
  );
}

function DraggableProjectCard({ summary, goals }: { summary: ProjectSummary; goals: Goal[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: summary.project.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={isDragging ? "opacity-30" : ""}>
      <ProjectCard summary={summary} goals={goals} dragHandle={
        <button type="button" {...listeners} {...attributes} className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-base text-ink-mute transition hover:bg-stone-100 hover:text-ink active:cursor-grabbing" aria-label={`${summary.project.title}を別の区分へ移動`} title="ドラッグして移動">⠿</button>
      } />
    </div>
  );
}

function ProjectCard({
  summary,
  goals,
  dragHandle,
}: {
  summary: ProjectSummary;
  goals: Goal[];
  dragHandle?: React.ReactNode;
}) {
  const { project, open, done, owners, overdue, stalled } = summary;
  const goal = goals.find((g) => g.id === project.goal_id);

  return (
    <div className="card flex min-h-24 w-full items-center gap-2 px-2 py-3 text-left transition hover:border-line-strong hover:bg-stone-50 hover:shadow-sm">
        {dragHandle}
      <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-brand">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: project.color }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">{project.title}</span>
            <CategoryBadge category={project.category} />
            {goal && (
              <span className="truncate text-[11px] text-ink-mute">目標: {goal.title}</span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="tnum text-ink-mute">
              残り <b className="text-ink-soft">{open.length}</b> 件
              {done.length > 0 && <> ・ 完了 {done.length} 件</>}
            </span>
            {overdue > 0 && (
              <span className="tnum font-semibold text-red-600">期限超過 {overdue}件</span>
            )}
            {stalled > 0 && (
              <span className="tnum font-semibold text-amber-600">止まっている {stalled}件</span>
            )}
            {open.length === 0 && (
              <span className="font-semibold text-brand">いまは手待ちなし</span>
            )}
          </span>
        </span>

        <span className="flex -space-x-1.5">
          {owners.map((m) => (
            <span key={m.id} className="rounded-full ring-2 ring-white">
              <Avatar member={m} size={22} />
            </span>
          ))}
        </span>

        <span className="shrink-0 text-lg text-ink-mute" aria-hidden>›</span>
      </Link>
    </div>
  );
}

/** プロジェクトに入っていないタスクの受け皿 */
function OrphanCard({
  tasks,
  members,
  projects,
}: {
  tasks: Task[];
  members: Member[];
  projects: Project[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card overflow-hidden border-dashed">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-stone-50"
      >
        <span className="size-2.5 shrink-0 rounded-full bg-stone-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="text-sm font-bold text-ink-soft">プロジェクト未設定</span>
          <span className="tnum mt-1 block text-[11px] text-ink-mute">
            {tasks.length}件 ・ タスクを開いて「プロジェクト」を選ぶと、上の一覧に入ります
          </span>
        </span>
        <span className={`shrink-0 text-ink-mute transition ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>
      {expanded && (
        <div className="divide-y divide-line border-t border-line bg-stone-50/60 px-2 py-1">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} members={members} />
          ))}
          {projects.length === 0 && (
            <p className="px-2 py-3 text-[11px] text-ink-mute">
              先にプロジェクトを1つ作ると、ここから割り当てられるようになります。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 新規作成

export function NewProjectButton({
  goals,
  defaultGoalId,
  label = "＋ プロジェクト",
}: {
  goals: Goal[];
  defaultGoalId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Project["category"]>("marketing");
  const [phase, setPhase] = useState<Project["phase"]>("sales");
  const [goalId, setGoalId] = useState(defaultGoalId ?? "");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="pop-in card w-full space-y-3 p-4">
      <div>
        <label className="label">プロジェクト名（しばらく続く塊の名前）</label>
        <input
          autoFocus
          className="field"
          value={title}
          placeholder="例）定期便のリニューアル"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">進行区分</label>
          <select className="field" value={phase} onChange={(e) => setPhase(e.target.value as Project["phase"])}>
            {PROJECT_PHASES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">領域</label>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as Project["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ひもづく目標（任意）</label>
          <select className="field" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">— 紐づけない —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.horizon === "short" ? "（短期）" : "（長期）"}
                {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">色</label>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`色 ${c}`}
              className={`size-6 rounded-full transition ${
                color === c ? "ring-2 ring-ink ring-offset-2" : ""
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:bg-stone-50"
        >
          やめる
        </button>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await createProject({ title, phase, category, goal_id: goalId || null, color });
              if (res.error) return setError(res.error);
              setOpen(false);
              setTitle("");
              router.refresh();
            })
          }
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "作成中…" : "作る"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 詳細ページの操作

export function ProjectSettings({ project, goals }: { project: Project; goals: Goal[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [phase, setPhase] = useState(project.phase);
  const [detail, setDetail] = useState(project.detail ?? "");
  const [goalId, setGoalId] = useState(project.goal_id ?? "");
  const [color, setColor] = useState(project.color);
  const [clientName, setClientName] = useState(project.client_name ?? "");
  const [clientContactName, setClientContactName] = useState(project.client_contact_name ?? "");
  const [clientEmail, setClientEmail] = useState(project.client_email ?? "");
  const [clientPhone, setClientPhone] = useState(project.client_phone ?? "");
  const [clientWebsite, setClientWebsite] = useState(project.client_website ?? "");
  const [contractAmount, setContractAmount] = useState(String(project.contract_amount || ""));
  const [invoicedAmount, setInvoicedAmount] = useState(String(project.invoiced_amount || ""));
  const [paidAmount, setPaidAmount] = useState(String(project.paid_amount || ""));
  const [maintenanceMonthlyFee, setMaintenanceMonthlyFee] = useState(String(project.maintenance_monthly_fee || ""));
  const [paymentDueDate, setPaymentDueDate] = useState(project.payment_due_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setEditing(true)}
          className="rounded px-2 py-1 text-[11px] text-ink-mute hover:bg-stone-100"
        >
          編集
        </button>
        <button
          onClick={() => {
            if (!confirm(`「${project.title}」を一覧から隠します。中のタスクは残ります。`)) return;
            start(async () => {
              await updateProject(project.id, { archived: true });
              router.push("/");
            });
          }}
          className="rounded px-2 py-1 text-[11px] text-ink-mute hover:bg-stone-100"
        >
          畳む
        </button>
        <button
          onClick={() => {
            if (
              !confirm(
                `「${project.title}」を削除します。中のタスクは消えず、プロジェクト未設定に戻ります。`,
              )
            )
              return;
            start(async () => {
              await deleteProject(project.id);
              router.push("/");
            });
          }}
          className="rounded px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
        >
          削除
        </button>
      </div>
    );
  }

  return (
    <div className="card w-full space-y-5 p-5">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-ink-mute">PROJECT SETTINGS</p>
          <h2 className="mt-1 text-sm font-bold">プロジェクト情報を編集</h2>
        </div>
        <button onClick={() => setEditing(false)} className="min-h-11 rounded-lg px-3 text-xs text-ink-mute hover:bg-stone-100">閉じる</button>
      </div>
      <div>
        <label className="label">プロジェクト名</label>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label">進行区分</label>
        <select className="field" value={phase} onChange={(e) => setPhase(e.target.value as Project["phase"])}>
          {PROJECT_PHASES.map((item) => (
            <option key={item.key} value={item.key}>{item.label} — {item.hint}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">プロジェクト概要</label>
        <textarea
          className="field min-h-20 resize-y"
          value={detail}
          placeholder="このプロジェクトのゴール、前提、参考リンクなど"
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>
      <fieldset className="space-y-3 rounded-xl border border-line bg-stone-50/60 p-4">
        <legend className="px-1 text-xs font-bold text-ink">クライアント情報</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">会社・屋号</label><input className="field" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="例）株式会社〇〇" /></div>
          <div><label className="label">担当者名</label><input className="field" value={clientContactName} onChange={(e) => setClientContactName(e.target.value)} placeholder="例）山田 太郎" /></div>
          <div><label className="label">メールアドレス</label><input type="email" className="field" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="contact@example.com" /></div>
          <div><label className="label">電話番号</label><input type="tel" className="field" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="090-0000-0000" /></div>
          <div className="sm:col-span-2"><label className="label">Webサイト</label><input type="url" className="field" value={clientWebsite} onChange={(e) => setClientWebsite(e.target.value)} placeholder="https://example.com" /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-line bg-stone-50/60 p-4">
        <legend className="px-1 text-xs font-bold text-ink">契約・入金情報</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><label className="label">契約金額</label><input type="number" min="0" inputMode="numeric" className="field tnum" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} placeholder="0" /></div>
          <div><label className="label">請求済み金額</label><input type="number" min="0" inputMode="numeric" className="field tnum" value={invoicedAmount} onChange={(e) => setInvoicedAmount(e.target.value)} placeholder="0" /></div>
          <div><label className="label">入金済み金額</label><input type="number" min="0" inputMode="numeric" className="field tnum" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" /></div>
          <div><label className="label">保守管理（月額）</label><input type="number" min="0" inputMode="numeric" className="field tnum" value={maintenanceMonthlyFee} onChange={(e) => setMaintenanceMonthlyFee(e.target.value)} placeholder="0" /></div>
          <div><label className="label">入金期日</label><input type="date" className="field tnum" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} /></div>
        </div>
        <p className="text-[10px] text-ink-mute">金額は税込・税抜のどちらかに運用を統一してください。</p>
      </fieldset>
      <div>
        <label className="label">ひもづく目標</label>
        <select className="field" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">— 紐づけない —</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.horizon === "short" ? "（短期）" : "（長期）"}
              {g.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">色</label>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`色 ${c}`}
              className={`size-6 rounded-full transition ${
                color === c ? "ring-2 ring-ink ring-offset-2" : ""
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setEditing(false)}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:bg-stone-50"
        >
          やめる
        </button>
        <button
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await updateProject(project.id, {
                title, phase, detail, goal_id: goalId || null, color,
                client_name: clientName, client_contact_name: clientContactName,
                client_email: clientEmail, client_phone: clientPhone, client_website: clientWebsite,
                contract_amount: Number(contractAmount) || 0,
                invoiced_amount: Number(invoicedAmount) || 0,
                paid_amount: Number(paidAmount) || 0,
                maintenance_monthly_fee: Number(maintenanceMonthlyFee) || 0,
                payment_due_date: paymentDueDate || null,
              });
              if (result.error) { setError(result.error); return; }
              setEditing(false);
              router.refresh();
            })
          }
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white"
        >
          保存
        </button>
      </div>
    </div>
  );
}
