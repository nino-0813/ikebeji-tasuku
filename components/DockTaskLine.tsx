"use client";
import { useTaskUI } from "./TaskUI";
import { DoneToggle } from "./TaskCard";
import type { Member, Task } from "@/lib/types";
export function DockTaskLine({
  task,
  members,
}: {
  task: Task;
  members: Member[];
}) {
  const { openTask } = useTaskUI();
  return (
    <div className="wd-task">
      <DoneToggle task={task} />
      <button className="text-left" onClick={() => openTask(task)}>
        {task.title}
      </button>
      <small>
        {members.find((m) => m.id === task.owner_id)?.name}　{task.due_date}
      </small>
    </div>
  );
}
