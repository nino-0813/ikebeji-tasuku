"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Member, Project, Task } from "@/lib/types";
import { daysUntil, isStalled } from "@/lib/format";
import { TaskCard } from "./TaskCard";
import { AddTaskButton } from "./AddTaskButton";
import { Avatar } from "./ui";

/** 期限が近い順。同じ日なら優先度の高い方が上 */
const PRIORITY_RANK = { high: 0, mid: 1, low: 2 } as const;
function byUrgency(a: Task, b: Task) {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

type Group = {
  project: Project | null;
  tasks: Task[];
  /** 並び順。急ぎのタスクを抱えているプロジェクトを上に出す */
  rank: string;
};

/**
 * 個人 → プロジェクト → タスク の3階層。
 * 列は人。列の中はプロジェクトごとの塊。塊の見出しを押すと畳める。
 */
export function PersonLanes({
  members,
  tasks,
  projects,
}: {
  members: Member[];
  tasks: Task[];
  projects: Project[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const byMember = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    return members.map((m) => {
      const mine = open.filter((t) => t.owner_id === m.id);

      const groups: Group[] = [];
      for (const p of projects) {
        const inProject = mine.filter((t) => t.project_id === p.id).sort(byUrgency);
        if (inProject.length === 0) continue;
        groups.push({ project: p, tasks: inProject, rank: inProject[0].due_date });
      }
      const orphans = mine.filter((t) => !t.project_id).sort(byUrgency);
      if (orphans.length > 0) {
        groups.push({ project: null, tasks: orphans, rank: orphans[0].due_date });
      }
      // 締切が近いタスクを持つ塊から上に出す
      groups.sort((a, b) => a.rank.localeCompare(b.rank));

      return {
        member: m,
        groups,
        total: mine.length,
        doing: mine.filter((t) => t.status === "doing").length,
        waiting: mine.filter((t) => t.status === "waiting").length,
        overdue: mine.filter((t) => daysUntil(t.due_date) < 0).length,
        stalled: mine.filter(isStalled).length,
      };
    });
  }, [members, tasks, projects]);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {byMember.map(({ member, groups, total, doing, waiting, overdue, stalled }) => (
        <div key={member.id} className="card flex flex-col p-3">
          <div className="mb-1 flex items-center gap-2">
            <Avatar member={member} size={26} />
            <span className="text-sm font-bold">{member.name}</span>
            <span className="tnum text-[11px] text-ink-mute">
              進行中{doing}・待ち{waiting}
            </span>
            <span className="grow" />
            <span className="tnum text-[11px] font-bold text-ink-soft">{total}</span>
            <AddTaskButton
              defaults={{ owner_id: member.id }}
              label="＋"
              title={`${member.name}にタスクを追加`}
            />
          </div>

          {(overdue > 0 || stalled > 0) && (
            <div className="mb-2 flex flex-wrap gap-x-3 text-[11px]">
              {overdue > 0 && (
                <span className="tnum font-semibold text-red-600">期限超過 {overdue}件</span>
              )}
              {stalled > 0 && (
                <span className="tnum font-semibold text-amber-600">止まっている {stalled}件</span>
              )}
            </div>
          )}

          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong py-6 text-center text-xs text-ink-mute">
              手持ちなし
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const key = `${member.id}:${g.project?.id ?? "none"}`;
                const isOpen = !collapsed.has(key);
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <button
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition hover:bg-stone-100"
                      >
                        <span
                          className={`shrink-0 text-[10px] text-ink-mute transition ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        >
                          ›
                        </span>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: g.project?.color ?? "#d6d3d1" }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink-soft">
                          {g.project?.title ?? "プロジェクト未設定"}
                        </span>
                        <span className="tnum shrink-0 text-[11px] text-ink-mute">
                          {g.tasks.length}
                        </span>
                      </button>
                      {g.project && (
                        <Link
                          href={`/projects/${g.project.id}`}
                          title={`${g.project.title} を開く`}
                          className="shrink-0 rounded px-1 text-[11px] text-ink-mute hover:bg-stone-100 hover:text-brand"
                        >
                          ↗
                        </Link>
                      )}
                    </div>

                    {isOpen && (
                      <div className="space-y-2 border-l border-line pl-2">
                        {g.tasks.map((t) => (
                          <TaskCard key={t.id} task={t} members={members} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
