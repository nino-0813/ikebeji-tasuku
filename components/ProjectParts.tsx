"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Goal, Member, Project, Task } from "@/lib/types";
import { CATEGORIES, PROJECT_COLORS } from "@/lib/types";
import { daysUntil, isStalled } from "@/lib/format";
import { createProject, deleteProject, updateProject } from "@/lib/actions";
import { TaskRow } from "./TaskCard";
import { AddTaskButton } from "./AddTaskButton";
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
}: {
  projects: Project[];
  tasks: Task[];
  members: Member[];
  goals: Goal[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const summaries = useMemo(
    () => projects.map((p) => summarize(p, tasks, members)),
    [projects, tasks, members],
  );

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

  return (
    <div className="space-y-2">
      {summaries.map((s) => (
        <ProjectCard
          key={s.project.id}
          summary={s}
          members={members}
          goals={goals}
          expanded={openId === s.project.id}
          onToggle={() => setOpenId(openId === s.project.id ? null : s.project.id)}
        />
      ))}

      {orphans.length > 0 && (
        <OrphanCard tasks={orphans} members={members} projects={projects} />
      )}
    </div>
  );
}

function ProjectCard({
  summary,
  members,
  goals,
  expanded,
  onToggle,
}: {
  summary: ProjectSummary;
  members: Member[];
  goals: Goal[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { project, open, done, owners, overdue, stalled } = summary;
  const [showDone, setShowDone] = useState(false);
  const goal = goals.find((g) => g.id === project.goal_id);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-stone-50"
      >
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

        <span className={`shrink-0 text-ink-mute transition ${expanded ? "rotate-90" : ""}`}>›</span>
      </button>

      {expanded && (
        <div className="border-t border-line bg-stone-50/60 px-2 py-2">
          {open.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-mute">
              このプロジェクトの手持ちはゼロです。次にやることが決まったら足してください。
            </p>
          ) : (
            <div className="divide-y divide-line">
              {open.map((t) => (
                <TaskRow key={t.id} task={t} members={members} />
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
            <AddTaskButton
              label="＋ タスクを追加"
              defaults={{ project_id: project.id, category: project.category, goal_id: project.goal_id }}
            />
            {done.length > 0 && (
              <button
                onClick={() => setShowDone((v) => !v)}
                className="rounded-lg px-2 py-0.5 text-[11px] text-ink-mute hover:bg-stone-200/60"
              >
                {showDone ? "完了したものを隠す" : `完了したもの ${done.length}件を見る`}
              </button>
            )}
            <span className="grow" />
            <Link
              href={`/projects/${project.id}`}
              className="rounded-lg px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand-soft"
            >
              プロジェクトを開く →
            </Link>
          </div>

          {showDone && done.length > 0 && (
            <div className="mt-2 divide-y divide-line border-t border-line pt-1 opacity-70">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} members={members} />
              ))}
            </div>
          )}
        </div>
      )}
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

      <div className="grid gap-3 sm:grid-cols-2">
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
              const res = await createProject({ title, category, goal_id: goalId || null, color });
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
  const [detail, setDetail] = useState(project.detail ?? "");
  const [goalId, setGoalId] = useState(project.goal_id ?? "");
  const [color, setColor] = useState(project.color);
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
    <div className="card w-full space-y-3 p-4">
      <div>
        <label className="label">プロジェクト名</label>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label">メモ（任意）</label>
        <textarea
          className="field min-h-20 resize-y"
          value={detail}
          placeholder="このプロジェクトのゴール、前提、参考リンクなど"
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>
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
              await updateProject(project.id, { title, detail, goal_id: goalId || null, color });
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
