"use client";

import { useState } from "react";
import type { Member, Task } from "@/lib/types";
import { TaskRow } from "./TaskCard";

/**
 * プロジェクトの中身。完了したタスクは既定で隠す。
 * 「終わったら消える」体験にしつつ、履歴は畳んだ場所から見られるようにしている。
 */
export function ProjectTaskList({
  open,
  done,
  members,
}: {
  open: Task[];
  done: Task[];
  members: Member[];
}) {
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="space-y-3">
      {open.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-10 text-center">
          <p className="text-sm font-medium text-ink-soft">いまの手持ちはゼロです</p>
          <p className="mt-1 text-xs text-ink-mute">
            このプロジェクトは残ります。次にやることが決まったら上のボタンから足してください。
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-line px-2 py-1">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} members={members} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs text-ink-mute hover:bg-stone-100"
          >
            {showDone ? "▾ 完了したものを隠す" : `▸ 完了したもの ${done.length}件`}
          </button>
          {showDone && (
            <div className="card mt-2 divide-y divide-line px-2 py-1 opacity-70">
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
