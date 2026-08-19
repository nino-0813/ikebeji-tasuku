"use client";

import { useTaskUI, type NewTaskDefaults } from "./TaskUI";

export function AddTaskButton({
  defaults,
  label = "＋ タスク",
  title,
  variant = "ghost",
}: {
  defaults?: NewTaskDefaults;
  label?: string;
  title?: string;
  variant?: "ghost" | "solid";
}) {
  const { openNew } = useTaskUI();
  const cls =
    variant === "solid"
      ? "rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
      : "rounded-lg border border-line-strong bg-white px-2 py-0.5 text-xs text-ink-soft transition hover:bg-stone-50";

  return (
    <button type="button" title={title} onClick={() => openNew(defaults)} className={cls}>
      {label}
    </button>
  );
}
