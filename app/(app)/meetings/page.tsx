import Link from "next/link";
import { getMeetings, getTasks } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { NewMeetingButton } from "@/components/MeetingParts";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, tasks] = await Promise.all([getMeetings(), getTasks()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">打ち合わせ</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            開くたびに、前回決めたことがどうなったかを先頭に表示します。
          </p>
        </div>
        <NewMeetingButton />
      </div>

      {meetings.length === 0 ? (
        <EmptyState>
          まだありません。次の打ち合わせを1件作って、その場で決まったことをタスクにしていきましょう。
        </EmptyState>
      ) : (
        <div className="card divide-y divide-line">
          {meetings.map((m) => {
            const linked = tasks.filter((t) => t.meeting_id === m.id);
            const done = linked.filter((t) => t.status === "done").length;
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50"
              >
                <span className="tnum w-16 shrink-0 text-xs text-ink-mute">
                  {formatDate(m.held_on)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</span>
                {linked.length > 0 && (
                  <span className="tnum shrink-0 text-xs text-ink-mute">
                    宿題 {done}/{linked.length} 完了
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
