import { DockInbox } from "@/components/DockInbox";
import { WITH_DOCK_ID } from "@/lib/meeting-inbox";
import {
  getActiveWorkspaceId,
  getInboxItems,
  getMe,
  getTasks,
} from "@/lib/data";
import { readSource } from "@/lib/meeting-inbox";
import { InboxUI } from "@/components/InboxUI";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const dock = (await getActiveWorkspaceId()) === WITH_DOCK_ID;
  const tab = (await searchParams).state;
  const state =
    typeof tab === "string" && ["held", "approved", "archived"].includes(tab)
      ? tab
      : "pending";
  const [items, me] = await Promise.all([getInboxItems(), getMe()]);
  const tasks = items.some((item) => readSource(item.detail))
    ? (await getTasks()).map(({ id, title }) => ({ id, title }))
    : [];
  if (dock)
    return (
      <div className="wd-stack">
        <DockInbox
          state={state}
          kind={String((await searchParams).kind || "")}
          id={String((await searchParams).id || "")}
        />
        <details className="wd-panel">
          <summary>従来のタスク候補・メモ（{items.length}件）</summary>
          <InboxUI items={items} me={me} tasks={tasks} />
        </details>
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-sm text-ink-mute">
          担当や期限を決める前のアイデアを、ここで一度受け止めます。
        </p>
      </div>

      <InboxUI items={items} me={me} tasks={tasks} />
    </div>
  );
}
