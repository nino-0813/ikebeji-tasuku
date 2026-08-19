import { getInboxItems, getMe } from "@/lib/data";
import { InboxUI } from "@/components/InboxUI";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [items, me] = await Promise.all([getInboxItems(), getMe()]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-sm text-ink-mute">担当や期限を決める前のアイデアを、ここで一度受け止めます。</p>
      </div>
      <InboxUI items={items} me={me} />
    </div>
  );
}
