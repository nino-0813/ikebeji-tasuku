"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import type { Member, Workspace } from "@/lib/types";
import { createWorkspace, setMe, setWorkspace, signOut } from "@/lib/actions";
import { useTaskUI } from "./TaskUI";
import { Avatar } from "./ui";

const LINKS = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/today", label: "今日", icon: "today" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/projects", label: "プロジェクト", icon: "project" },
  { href: "/board", label: "ボード", icon: "board" },
  { href: "/meetings", label: "打ち合わせ", icon: "meeting" },
  { href: "/goals", label: "目標", icon: "goal" },
];

export function Nav({
  members,
  me,
  workspaces,
  currentWorkspace,
}: {
  members: Member[];
  me: Member | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
}) {
  const pathname = usePathname();
  const { openNew } = useTaskUI();

  return (
    <aside className="app-sidebar">
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <div className="sidebar-inner">
        <WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} />

        <button
          onClick={() => openNew()}
          className="new-task-button"
          title="キーボードの n でも開けます"
        >
          <Icon name="plus" />
          <span>新しいタスク</span>
          <kbd>N</kbd>
        </button>

        <nav className="sidebar-nav" aria-label="メインナビゲーション">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link ${
                  active ? "sidebar-link-active" : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={l.icon} />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button className="mobile-quick-add" onClick={() => openNew()} aria-label="新しいタスクを追加">
          <Icon name="plus" />
        </button>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><MeSwitcher members={members} me={me} /></div>
      </div>
    </aside>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
    board: <><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="10" rx="1.5"/></>,
    project: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    today: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/></>,
    inbox: <><path d="M4 4h16v16H4z"/><path d="M4 14h4l2 3h4l2-3h4"/></>,
    meeting: <><path d="M8 3v3M16 3v3"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></>,
    goal: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    chevrons: <path d="m8 9 4-4 4 4M16 15l-4 4-4-4"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function WorkspaceSwitcher({
  workspaces,
  currentWorkspace,
}: {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const selectWorkspace = (id: string) => {
    setError("");
    start(async () => {
      const result = await setWorkspace(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push("/");
      router.refresh();
    });
  };

  const submitWorkspace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    start(async () => {
      const result = await createWorkspace(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setAdding(false);
      setOpen(false);
      router.push("/");
      router.refresh();
    });
  };

  const initial = currentWorkspace?.name.trim().charAt(0) || "頁";

  return (
    <div className="workspace-menu-wrap">
      <button
        type="button"
        className="workspace-switcher"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`ページを切り替える。現在は${currentWorkspace?.name ?? "未選択"}`}
      >
        <span className="workspace-mark" style={{ color: currentWorkspace?.color }}>{initial}</span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {currentWorkspace?.name ?? "ページを選ぶ"}
        </span>
        <Icon name="chevrons" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="workspace-menu pop-in card absolute left-0 top-full z-20 mt-1 w-full min-w-56 overflow-hidden py-1 shadow-lg" role="menu">
            <p className="px-3 py-1.5 text-[11px] font-medium text-ink-mute">ページ</p>
            {workspaces.map((workspace) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={workspace.id === currentWorkspace?.id}
                key={workspace.id}
                disabled={pending}
                onClick={() => selectWorkspace(workspace.id)}
                className="workspace-option"
              >
                <span className="workspace-dot" style={{ background: workspace.color }} />
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === currentWorkspace?.id && <Icon name="check" />}
              </button>
            ))}

            <div className="my-1 border-t border-line" />
            {adding ? (
              <form onSubmit={submitWorkspace} className="px-2 py-1.5">
                <label className="sr-only" htmlFor="new-workspace-name">新しいページ名</label>
                <div className="flex gap-1.5">
                  <input
                    id="new-workspace-name"
                    autoFocus
                    maxLength={40}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="field min-w-0 py-1 text-xs"
                    placeholder="ページ名"
                  />
                  <button type="submit" disabled={pending || !name.trim()} className="workspace-add-submit">
                    追加
                  </button>
                </div>
                {error && <p className="mt-1 text-[11px] text-alert" role="alert">{error}</p>}
              </form>
            ) : (
              <button type="button" className="workspace-option text-ink-soft" onClick={() => setAdding(true)}>
                <Icon name="plus" />
                <span>新しいページを追加</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MeSwitcher({ members, me }: { members: Member[]; me: Member | null }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className="profile-button"
        aria-expanded={open}
      >
        <Avatar member={me} size={20} />
        <span className="min-w-0 flex-1 truncate text-left">{me?.name ?? "自分を選ぶ"}</span>
        <Icon name="chevrons" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="profile-menu pop-in card absolute right-0 z-20 w-52 py-1 shadow-lg">
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
