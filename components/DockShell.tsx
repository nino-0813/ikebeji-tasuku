"use client";
import { boardPages } from "@/lib/board-pages";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const pages = [
  ["/", "ホーム", "今日の全体像"],
  ["/customers", "顧客理解", "共通する顧客の歴史"],
  ["/cash", "目標・入金", "資金の見通し"],
  ["/projects", "プロジェクト", "制作と伴走"],
  ["/inbox", "インボックス", "AI提案の承認"],
  ["/improvements", "改善提案", "道具も育てる"],
  ["/settings", "設定・連携", "人とデータの境界"],
];
export function DockShell({
  children,
  user,
}: {
  children: ReactNode;
  user: string;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const page = pages.find(
    ([url]) => url === path || (url !== "/" && path.startsWith(url + "/")),
  );
  const title =
    path === "/projects/new"
      ? "新規案件登録｜最小限の入力"
      : path.startsWith("/projects/")
        ? "案件詳細｜工程・契約・タスク"
        : page
          ? (path === "/projects" ? "プロジェクト一覧" : page[1]) +
            "｜" +
            page[2]
          : "作業一覧";
  return (
    <div className="wd-shell">
      <aside className={"wd-side " + (menu ? "opened" : "")}>
        <Link href="/" className="wd-logo">
          with<span>dock</span>
          <small>OPERATIONS</small>
        </Link>
        <details className="wd-switch">
          <summary className="wd-workspace" aria-label="ページを切り替える。現在はwith dock">◆　with dock　⌄</summary>
          <div>
            {boardPages.map(({ id, name }) => (
              <Link key={id} href={"/login?workspace=" + id}>{name}</Link>
            ))}
            <span aria-current="true">✓　with dock</span>
          </div>
        </details>
        <nav aria-label="ワークスペース">
          {pages.map(([url, label]) => (
            <Link
              key={url}
              href={url}
              aria-current={url === page?.[0] ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <i />
              {label}
            </Link>
          ))}
        </nav>
        <Link className="wd-sync" href="/settings">
          ● 共有中　　 ○ 同期状況
        </Link>
      </aside>
      <div className="wd-main">
        <header className="wd-top">
          <button onClick={() => setMenu(!menu)} aria-expanded={menu}>
            ☰ メニュー
          </button>
          <Link href="/">WORKSPACE / with dock</Link>
          <div>
            <Link href="/customers#search">顧客検索</Link>
            <Link href="/inbox">通知</Link>
            <Link href="/settings">◯ {user}</Link>
          </div>
        </header>
        <main id="main-content" className="wd-body">
          <small>with dock / {title}</small>
          <h1>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
