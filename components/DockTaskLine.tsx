"use client";
import { useTaskUI } from "./TaskUI";
import { DoneToggle } from "./TaskCard";
import type { Member, Task } from "@/lib/types";
export function DockTaskLine({
  task,
  members,
  canEdit = true,
}: {
  task: Task;
  members: Member[];
  canEdit?: boolean;
}) {
  const { openTask } = useTaskUI();
  return (
    <div className="wd-task">
      {canEdit ? <>
        <DoneToggle task={task} />
        <button className="text-left" onClick={() => openTask(task)}>{task.title}</button>
      </> : <><span>{task.status === "done" ? "完了" : "未完了"}</span><span>{task.title}</span></>}
      <small>
        {members.find((m) => m.id === task.owner_id)?.name}　{task.due_date}
      </small>
    </div>
  );
}
