"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import type { Member } from "@/lib/types";
import { setMe, signOut } from "@/lib/actions";
import { useTaskUI } from "./TaskUI";
import { Avatar } from "./ui";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/board", label: "ボード" },
  { href: "/meetings", label: "打ち合わせ" },
  { href: "/goals", label: "目標" },
];

export function Nav({ members, me }: { members: Member[]; me: Member | null }) {
  const pathname = usePathname();
  const { openNew } = useTaskUI();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
            イケ
          </span>
          <span className="hidden text-sm font-bold sm:inline">イケベジ 進行ボード</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:ml-3">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:text-[13px] ${
                  active ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-stone-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <span className="grow" />

        <button
          onClick={() => openNew()}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
          title="キーボードの n でも開けます"
        >
          ＋ タスク
        </button>

        <MeSwitcher members={members} me={me} />
      </div>
    </header>
  );
}

function MeSwitcher({ members, me }: { members: Member[]; me: Member | null }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-white px-2 py-1 text-xs text-ink-soft hover:bg-stone-50"
      >
        <Avatar member={me} size={20} />
        <span className="hidden sm:inline">{me?.name ?? "自分を選ぶ"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="pop-in card absolute right-0 z-20 mt-1 w-44 py-1 shadow-lg">
            <p className="px-3 py-1 text-[11px] text-ink-mute">自分は誰？</p>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setOpen(false);
                  start(() => {
                    setMe(m.id);
                  });
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-stone-50 ${
                  me?.id === m.id ? "font-bold text-ink" : "text-ink-soft"
                }`}
              >
                <Avatar member={m} size={20} />
                {m.name}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              onClick={() => start(() => void signOut())}
              className="w-full px-3 py-1.5 text-left text-xs text-ink-mute hover:bg-stone-50"
            >
              ログアウト
            </button>
          </div>
        </>
      )}
    </div>
  );
}
