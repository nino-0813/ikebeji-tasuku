"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Member, Task } from "@/lib/types";
import { daysSince, isStalled } from "@/lib/format";
import { nudgeTask, setTaskStatus } from "@/lib/actions";
import { useTaskUI } from "./TaskUI";
import { Avatar, CategoryBadge, DueChip, PriorityMark, StatusBadge } from "./ui";

/** 完了に送る／未完了に戻す。カードの上で1クリック */
function DoneToggle({ task }: { task: Task }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = task.status === "done";
  return (
    <button
      title={done ? "未着手に戻す" : "完了にする"}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          await setTaskStatus(task.id, done ? "todo" : "done");
          router.refresh();
        });
      }}
      className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] transition ${
        done
          ? "border-green-600 bg-green-600 text-white"
          : "border-line-strong bg-white text-transparent hover:border-green-600 hover:text-green-600"
      } ${pending ? "opacity-50" : ""}`}
    >
      ✓
    </button>
  );
}

/** ボードの列に並ぶカード */
export function TaskCard({ task, members }: { task: Task; members: Member[] }) {
  const { openTask } = useTaskUI();
  const owner = members.find((m) => m.id === task.owner_id);
  const stalled = isStalled(task);

  return (
    <div
      onClick={() => openTask(task)}
      className={`card cursor-pointer p-2.5 shadow-xs transition hover:border-line-strong hover:shadow-sm ${
        stalled ? "border-l-[3px] border-l-red-500" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <DoneToggle task={task} />
        <p
          className={`min-w-0 flex-1 text-[13px] leading-snug font-medium ${
            task.status === "done" ? "text-ink-mute line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <Avatar member={owner} size={22} />
      </div>

      {task.status === "waiting" && task.waiting_on && (
        <p className="mt-1.5 truncate rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
          待ち: {task.waiting_on}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={task.category} />
        <PriorityMark priority={task.priority} />
        <span className="grow" />
        <DueChip date={task.due_date} done={task.status === "done"} />
      </div>

      {stalled && (
        <p className="tnum mt-1.5 text-[11px] font-semibold text-red-600">
          {daysSince(task.status_changed_at)}日動いていません
        </p>
      )}
    </div>
  );
}

/** ダッシュボードのリスト表示。横1行で情報密度を高くする */
export function TaskRow({
  task,
  members,
  showOwner = true,
  showStalledAction = false,
  note,
}: {
  task: Task;
  members: Member[];
  showOwner?: boolean;
  showStalledAction?: boolean;
  /** 「なぜここに出ているか」の一言。詰まりリストで使う */
  note?: string;
}) {
  const { openTask } = useTaskUI();
  const router = useRouter();
  const [pending, start] = useTransition();
  const owner = members.find((m) => m.id === task.owner_id);

  return (
    <div
      onClick={() => openTask(task)}
      className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-stone-50"
    >
      <DoneToggle task={task} />
      {showOwner && <Avatar member={owner} size={22} />}
      <p
        className={`min-w-0 flex-1 truncate text-[13px] ${
          task.status === "done" ? "text-ink-mute line-through" : "text-ink"
        }`}
      >
        {task.title}
        {task.status === "waiting" && task.waiting_on && (
          <span className="ml-2 text-[11px] text-amber-700">（待ち: {task.waiting_on}）</span>
        )}
      </p>
      {note && (
        <span className="tnum shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
          {note}
        </span>
      )}
      <CategoryBadge category={task.category} />
      <StatusBadge status={task.status} />
      <DueChip date={task.due_date} done={task.status === "done"} />
      {showStalledAction && (
        <button
          title="今日から仕切り直す（止まっている表示を消す）"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            start(async () => {
              await nudgeTask(task.id);
              router.refresh();
            });
          }}
          className="shrink-0 rounded border border-line-strong bg-white px-2 py-0.5 text-[11px] text-ink-soft opacity-0 transition group-hover:opacity-100 hover:bg-stone-50"
        >
          仕切り直す
        </button>
      )}
    </div>
  );
}
