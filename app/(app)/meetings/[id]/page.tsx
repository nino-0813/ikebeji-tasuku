import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeeting, getMeetings, getTasks, getWorkspaceMembers } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { MeetingHeader, MeetingNotes } from "@/components/MeetingParts";
import { TaskRow } from "@/components/TaskCard";
import { AddTaskButton } from "@/components/AddTaskButton";
import { EmptyState, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  const [meeting, meetings, tasks, members] = await Promise.all([
    getMeeting(id),
    getMeetings(),
    getTasks(),
    getWorkspaceMembers(),
  ]);
  if (!meeting) notFound();

  // この打ち合わせより前で、いちばん近い回
  const previous = meetings.find(
    (m) => m.id !== meeting.id && (m.held_on < meeting.held_on || (m.held_on === meeting.held_on && m.created_at < meeting.created_at)),
  );

  const homework = previous ? tasks.filter((t) => t.meeting_id === previous.id) : [];
  const homeworkDone = homework.filter((t) => t.status === "done");
  const homeworkOpen = homework.filter((t) => t.status !== "done");
  const decided = tasks.filter((t) => t.meeting_id === meeting.id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/meetings" className="text-xs text-ink-mute hover:text-ink-soft">
          ← 打ち合わせ一覧
        </Link>
        <div className="mt-2">
          <MeetingHeader meeting={meeting} />
        </div>
      </div>

      {/* 会議はここから始める。前回の宿題の答え合わせ */}
      <section>
        <SectionTitle hint="まずここから。終わっていないものは、この場で期限を引き直します">
          前回の宿題
        </SectionTitle>
        {!previous ? (
          <EmptyState>これが最初の打ち合わせです。次回からここに前回の宿題が出ます。</EmptyState>
        ) : homework.length === 0 ? (
          <EmptyState>
            {formatDate(previous.held_on)}「{previous.title}」ではタスクが登録されませんでした。
          </EmptyState>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-stone-50 px-4 py-2.5 text-xs">
              <span className="text-ink-mute">
                {formatDate(previous.held_on)}「{previous.title}」で決めたこと
              </span>
              <span className="grow" />
              <span className="tnum font-bold text-brand">完了 {homeworkDone.length}</span>
              <span className="tnum font-bold text-amber-600">残り {homeworkOpen.length}</span>
            </div>
            <div className="divide-y divide-line px-2 py-1">
              {[...homeworkOpen, ...homeworkDone].map((t) => (
                <TaskRow key={t.id} task={t} members={members} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <MeetingNotes meeting={meeting} />
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold">この打ち合わせで決まったこと</h2>
            <span className="tnum text-xs text-ink-mute">{decided.length}件</span>
          </div>
          <span className="grow" />
          <AddTaskButton
            variant="solid"
            label="＋ 決まったことを足す"
            defaults={{ meeting_id: meeting.id }}
          />
        </div>
        {decided.length === 0 ? (
          <EmptyState>
            「誰が・いつまでに・何をするか」をその場で1件ずつ足していきます。担当と期限は必須なので、
            <br />
            持ち帰りが宙に浮くことがありません。
          </EmptyState>
        ) : (
          <div className="card divide-y divide-line px-2 py-1">
            {decided.map((t) => (
              <TaskRow key={t.id} task={t} members={members} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
