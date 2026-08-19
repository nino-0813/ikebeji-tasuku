"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Category, Member, Status, Task } from "@/lib/types";
import { CATEGORIES, STATUSES } from "@/lib/types";
import { moveTask } from "@/lib/actions";
import { TaskCard } from "./TaskCard";
import { useTaskUI } from "./TaskUI";
import { Avatar } from "./ui";

type Columns = Record<Status, Task[]>;

function group(tasks: Task[]): Columns {
  const cols = { todo: [], doing: [], waiting: [], done: [] } as Columns;
  for (const t of tasks) cols[t.status].push(t);
  for (const key of Object.keys(cols) as Status[]) {
    cols[key].sort((a, b) => a.sort_order - b.sort_order);
  }
  return cols;
}

export function Board({ tasks, members }: { tasks: Task[]; members: Member[] }) {
  const router = useRouter();
  const [cols, setCols] = useState<Columns>(() => group(tasks));
  const [dragging, setDragging] = useState<Task | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [owner, setOwner] = useState<string>("all");

  // サーバー側の更新を取り込む（ドラッグ中は上書きしない）
  useEffect(() => {
    // props由来の最新データを、操作中でないローカルDnD状態へ同期する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dragging) setCols(group(tasks));
  }, [tasks, dragging]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const visible = useMemo(() => {
    const pass = (t: Task) =>
      (category === "all" || t.category === category) && (owner === "all" || t.owner_id === owner);
    return {
      todo: cols.todo.filter(pass),
      doing: cols.doing.filter(pass),
      waiting: cols.waiting.filter(pass),
      done: cols.done.filter(pass),
    } as Columns;
  }, [cols, category, owner]);

  function columnOf(id: string, source: Columns): Status | null {
    if ((STATUSES as { key: Status }[]).some((s) => s.key === id)) return id as Status;
    for (const key of Object.keys(source) as Status[]) {
      if (source[key].some((t) => t.id === id)) return key;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const from = columnOf(id, cols);
    setDragging(from ? (cols[from].find((t) => t.id === id) ?? null) : null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setCols((prev) => {
      const from = columnOf(activeId, prev);
      const to = columnOf(overId, prev);
      if (!from || !to || from === to) return prev;

      const task = prev[from].find((t) => t.id === activeId);
      if (!task) return prev;

      const overIndex = prev[to].findIndex((t) => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;
      const next = { ...prev };
      next[from] = prev[from].filter((t) => t.id !== activeId);
      next[to] = [...prev[to]];
      next[to].splice(insertAt, 0, { ...task, status: to });
      return next;
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDragging(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const to = columnOf(overId, cols);
    const from = columnOf(activeId, cols);
    if (!to || !from) return;

    let ordered: string[] = [];
    setCols((prev) => {
      const list = prev[to];
      const oldIndex = list.findIndex((t) => t.id === activeId);
      const newIndex = list.findIndex((t) => t.id === overId);
      const next = { ...prev };
      next[to] = oldIndex >= 0 && newIndex >= 0 ? arrayMove(list, oldIndex, newIndex) : list;
      ordered = next[to].map((t) => t.id);
      return next;
    });

    await moveTask(activeId, to, ordered);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Filter
          label="領域"
          options={[{ key: "all", label: "すべて" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))]}
          value={category}
          onChange={(v) => setCategory(v as Category | "all")}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-mute">担当</span>
          <div className="inline-flex rounded-lg border border-line-strong bg-stone-50 p-0.5">
            <button
              onClick={() => setOwner("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                owner === "all" ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft"
              }`}
            >
              全員
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setOwner(m.id)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  owner === m.id ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft"
                }`}
              >
                <Avatar member={m} size={16} />
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => (
            <Column
              key={s.key}
              status={s.key}
              label={s.label}
              hint={s.hint}
              tasks={visible[s.key]}
              members={members}
              filterOwner={owner === "all" ? undefined : owner}
              filterCategory={category === "all" ? undefined : category}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging && (
            <div className="rotate-1 opacity-90">
              <TaskCard task={dragging} members={members} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Filter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold text-ink-mute">{label}</span>
      <div className="inline-flex rounded-lg border border-line-strong bg-stone-50 p-0.5">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              value === o.key ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink-soft"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const COLUMN_ACCENT: Record<Status, string> = {
  todo: "bg-stone-400",
  doing: "bg-blue-500",
  waiting: "bg-amber-500",
  done: "bg-green-600",
};

function Column({
  status,
  label,
  hint,
  tasks,
  members,
  filterOwner,
  filterCategory,
}: {
  status: Status;
  label: string;
  hint: string;
  tasks: Task[];
  members: Member[];
  filterOwner?: string;
  filterCategory?: Category;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { openNew } = useTaskUI();

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border p-2 transition ${
        isOver ? "border-brand bg-brand-soft/50" : "border-line bg-stone-50/70"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`size-2 rounded-full ${COLUMN_ACCENT[status]}`} />
        <span className="text-xs font-bold text-ink">{label}</span>
        <span className="tnum text-[11px] text-ink-mute">{tasks.length}</span>
        <span className="grow" />
        <button
          onClick={() =>
            openNew({ status, owner_id: filterOwner, category: filterCategory })
          }
          title={`${label}にタスクを追加`}
          className="rounded px-1.5 text-sm leading-none text-ink-mute hover:bg-stone-200 hover:text-ink"
        >
          ＋
        </button>
      </div>
      <p className="mb-2 px-1 text-[11px] leading-tight text-ink-mute">{hint}</p>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-24 space-y-2">
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} members={members} />
          ))}
          {tasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-line-strong py-6 text-center text-[11px] text-ink-mute">
              ここにドラッグ
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task, members }: { task: Task; members: Member[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "dragging" : ""}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} members={members} />
    </div>
  );
}
