"use client";

import { Fragment, type CSSProperties } from "react";
import type { Member, Status, Task } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/format";
import { useTaskUI } from "./TaskUI";
import { Avatar } from "./ui";

const DAY_MS = 86_400_000;
const STATUS_COLOR: Record<Status, string> = {
  todo: "#78716c",
  doing: "#2563eb",
  waiting: "#d97706",
  done: "#15803d",
};

function dateValue(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime();
}

function dateISO(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function rangeDays(start: string, end: string) {
  const result: string[] = [];
  for (let value = dateValue(start); value <= dateValue(end); value += DAY_MS) result.push(dateISO(value));
  return result;
}

function offset(date: string, start: string) {
  return Math.round((dateValue(date) - dateValue(start)) / DAY_MS);
}

export function ProjectTimeline({ tasks, members }: { tasks: Task[]; members: Member[] }) {
  const { openTask } = useTaskUI();

  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-5 py-12 text-center">
        <p className="text-sm font-semibold text-ink-soft">工程はまだありません</p>
        <p className="mt-1 text-xs text-ink-mute">タスクを追加すると、ここに期間バーが表示されます。</p>
      </div>
    );
  }

  const today = todayISO();
  const starts = tasks.map((task) => task.start_date || task.created_at.slice(0, 10));
  const rangeStart = [...starts, today].sort()[0];
  const rangeEnd = [...tasks.map((task) => task.due_date), today].sort().at(-1) ?? today;
  const days = rangeDays(rangeStart, rangeEnd);
  const timelineWidth = Math.max(680, days.length * 28);
  const todayOffset = offset(today, rangeStart);
  const openCount = tasks.filter((task) => task.status !== "done").length;
  const doneCount = tasks.length - openCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" aria-label="工程の集計">
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
          これから・進行中 {openCount}件
        </span>
        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
          完了 {doneCount}件
        </span>
        <span className="ml-auto text-[11px] text-ink-mute">未完了は期日の近い順です</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-mute" aria-label="ステータス凡例">
        {STATUSES.map((status) => (
          <span key={status.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[status.key] }} />
            {status.label}
          </span>
        ))}
        <span className="ml-auto">バーをクリックするとタスク詳細を開きます</span>
      </div>

      <div className="card overflow-x-auto" role="region" aria-label="プロジェクト工程表" tabIndex={0}>
        <div style={{ minWidth: 320 + timelineWidth }}>
          <div className="flex border-b border-line bg-stone-50/80">
            <div className="sticky left-0 z-20 flex w-80 shrink-0 items-end border-r border-line bg-stone-50 px-4 py-2">
              <span className="text-[11px] font-semibold text-ink-soft">タスク / 担当</span>
            </div>
            <div className="relative h-12" style={{ width: timelineWidth }}>
              <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                {days.map((day) => {
                  const date = new Date(`${day}T00:00:00Z`);
                  const first = date.getUTCDate() === 1 || day === rangeStart;
                  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                  return (
                    <div key={day} className={`relative border-r border-line/60 px-1 pt-5 text-center text-[10px] ${weekend ? "bg-stone-100/70 text-ink-mute" : "text-ink-soft"}`}>
                      {first && (
                        <span className="absolute left-1 top-1 whitespace-nowrap text-[10px] font-bold text-ink">
                          {date.getUTCFullYear()}年{date.getUTCMonth() + 1}月
                        </span>
                      )}
                      {date.getUTCDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {tasks.map((task, index) => {
            const owner = members.find((member) => member.id === task.owner_id);
            const start = task.start_date || task.created_at.slice(0, 10);
            const startOffset = Math.max(0, offset(start, rangeStart));
            const duration = Math.max(1, offset(task.due_date, start) + 1);
            const barStyle: CSSProperties = {
              left: `${(startOffset / days.length) * 100}%`,
              width: `${(duration / days.length) * 100}%`,
              background: STATUS_COLOR[task.status],
            };

            const beginsDoneSection = task.status === "done" && (index === 0 || tasks[index - 1].status !== "done");

            return (
              <Fragment key={task.id}>
              {beginsDoneSection && (
                <div className="flex h-10 border-b border-line bg-green-50/70" role="separator" aria-label="完了した工程">
                  <div className="sticky left-0 z-10 flex w-80 shrink-0 items-center gap-2 border-r border-green-100 bg-green-50 px-4 text-[11px] font-bold text-green-800">
                    <span className="flex size-4 items-center justify-center rounded-full bg-green-700 text-[10px] text-white" aria-hidden>✓</span>
                    完了した工程
                    <span className="tnum font-medium text-green-700">{doneCount}件</span>
                  </div>
                  <div className="flex items-center px-4 text-[10px] text-green-700" style={{ width: timelineWidth }}>完了日は新しい順</div>
                </div>
              )}
              <div className={`group flex min-h-16 border-b border-line last:border-b-0 ${task.status === "done" ? "bg-stone-50/60" : ""}`}>
                <button
                  type="button"
                  onClick={() => openTask(task)}
                  className={`sticky left-0 z-10 flex w-80 shrink-0 items-center gap-3 border-r border-line px-4 py-2 text-left transition group-hover:bg-stone-50 ${task.status === "done" ? "bg-stone-50" : "bg-white"}`}
                >
                  <Avatar member={owner} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-semibold ${task.status === "done" ? "text-ink-mute line-through" : "text-ink"}`}>
                      {task.title}
                    </span>
                    <span className="tnum mt-0.5 block text-[10px] text-ink-mute">
                      {owner?.name ?? "担当未設定"} ・ {formatDate(start)} → {formatDate(task.due_date)}
                    </span>
                    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${task.status === "done" ? "bg-green-100 text-green-700" : task.status === "doing" ? "bg-blue-50 text-blue-700" : task.status === "waiting" ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                      {STATUSES.find((status) => status.key === task.status)?.label}
                    </span>
                  </span>
                  <span className="text-ink-mute" aria-hidden>›</span>
                </button>

                <div
                  className="relative min-h-16"
                  style={{
                    width: timelineWidth,
                    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / days.length}% - 1px), rgba(231,229,228,.75) calc(${100 / days.length}% - 1px), rgba(231,229,228,.75) ${100 / days.length}%)`,
                  }}
                >
                  {todayOffset >= 0 && todayOffset < days.length && (
                    <span
                      className="absolute inset-y-0 z-[1] w-px bg-red-400"
                      style={{ left: `${((todayOffset + 0.5) / days.length) * 100}%` }}
                      aria-label="今日"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => openTask(task)}
                    style={barStyle}
                    className={`absolute top-3 z-[2] h-9 min-w-7 overflow-hidden rounded-md px-2 text-left text-[10px] font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:z-10 ${task.status === "done" ? "opacity-70" : ""}`}
                    aria-label={`${task.title}。${formatDate(start)}から${formatDate(task.due_date)}。詳細を開く`}
                    title={`${task.title}｜${formatDate(start)}〜${formatDate(task.due_date)}`}
                  >
                    <span className="block truncate">{task.title}</span>
                  </button>
                </div>
              </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
