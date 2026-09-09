import { getTasks, getWorkspaceMembers } from "@/lib/data";
import { Board } from "@/components/Board";
import { AddTaskButton } from "@/components/AddTaskButton";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [tasks, members] = await Promise.all([getTasks(), getWorkspaceMembers()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ボード</h1>
          <p className="mt-0.5 text-xs text-ink-mute">
            カードをドラッグして列を移動できます。自分の手を離れたら「相手待ち」に置くのがコツです。
          </p>
        </div>
        <AddTaskButton variant="solid" />
      </div>
      <Board tasks={tasks} members={members} />
    </div>
  );
}
