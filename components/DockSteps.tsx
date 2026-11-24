import { db } from "@/lib/supabase";
import { dockTeamMember } from "@/lib/dock-team";
import { addStep, finishStep, archiveProject } from "@/lib/dock-actions";
export async function DockSteps({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  if (!(await dockTeamMember())) return null;
  const { data, error } = await db
    .from("dock_steps")
    .select("*")
    .eq("project_id", id)
    .order("position")
    .order("id");
  if (error) throw new Error("工程を取得できませんでした。");
  const done = data.filter((s) => s.completed_on).length;
  const project = <input type="hidden" name="project" value={id} />;
  const days = data
    .flatMap((s) => [s.starts_on, s.due_on])
    .filter(Boolean)
    .map((x) => Date.parse(x) / 86400000);
  const start = Math.min(...days),
    end = Math.max(...days),
    span = Math.max(1, end - start + 1);
  const current = data.find((s) => !s.completed_on);
  return (
    <section className="space-y-3 pt-4">
      <div className="wd-step">
        {data.map((s, i) => (
          <span
            key={s.id}
            className={
              s.completed_on ? "done" : s.id === current?.id ? "current" : ""
            }
          >
            <b>{s.completed_on ? "✓" : i + 1}</b>
            <small className="block" style={{ color: "inherit" }}>
              {s.title}
            </small>
          </span>
        ))}
      </div>
      <h2 className="font-bold">
        制作工程・スケジュール　{done} / {data.length}
      </h2>
      {data.map((s) => (
        <div key={s.id} className="border-t py-2">
          <p>
            <strong>{s.title}</strong>　{s.starts_on || "未定"} 〜{" "}
            {s.due_on || "未定"}
          </p>
          {s.starts_on && s.due_on && (
            <div className="wd-track my-2">
              <i
                style={{
                  height: "100%",
                  marginLeft:
                    ((Date.parse(s.starts_on) / 86400000 - start) / span) *
                      100 +
                    "%",
                  width:
                    Math.max(
                      1,
                      ((Date.parse(s.due_on) / 86400000 -
                        Date.parse(s.starts_on) / 86400000 +
                        1) /
                        span) *
                        100,
                    ) + "%",
                  background: s.completed_on
                    ? "#9fbeb3"
                    : s.id === current?.id
                      ? "#307967"
                      : "#c6d4cd",
                }}
              />
            </div>
          )}
          <details>
            <summary>{s.completed_on ? "完了日を変更" : "完了を記録"}</summary>
            <form
              action={finishStep}
              className="flex flex-wrap items-end gap-2"
            >
              {project}
              <input type="hidden" name="step" value={s.id} />
              <label>
                完成日
                <input
                  type="date"
                  name="completed_on"
                  defaultValue={s.completed_on || ""}
                  className="field"
                />
              </label>
              <button>更新</button>
            </form>
          </details>
        </div>
      ))}
      <details>
        <summary>工程を追加</summary>
        <form action={addStep} className="grid gap-2 sm:grid-cols-2">
          {project}
          <input type="hidden" name="request" value={crypto.randomUUID()} />
          <input
            type="hidden"
            name="position"
            value={(data.at(-1)?.position || 0) + 1}
          />
          <label>
            工程名
            <input name="title" required className="field" />
          </label>
          <label>
            開始予定
            <input name="starts_on" type="date" className="field" />
          </label>
          <label>
            完了予定
            <input name="due_on" type="date" className="field" />
          </label>
          <button>工程を保存</button>
        </form>
      </details>
      <form action={archiveProject}>
        {project}
        <input type="hidden" name="archive" value={archived ? "no" : "yes"} />
        <button className="text-sm text-brand">
          {archived ? "進行中に戻す" : "完了・アーカイブへ移す"}
        </button>
      </form>
    </section>
  );
}
