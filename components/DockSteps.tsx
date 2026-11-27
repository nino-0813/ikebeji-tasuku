import { db } from "@/lib/supabase";
import type { Member, Project } from "@/lib/types";
import { dockToday } from "@/lib/dock-project";
import { addStep, finishStep, archiveProject } from "@/lib/dock-actions";
export async function DockSteps({ project: record, members, canEdit }: {
  project: Project; members: Member[]; canEdit: boolean;
}) {
  const id = record.id;
  const archived = record.archived;
  const { data, error } = await db
    .from("dock_steps")
    .select("*")
    .eq("project_id", id)
    .order("position")
    .order("id");
  if (error) throw new Error("工程を取得できませんでした。");
  const completed = data.filter((s) => s.completed_on);
  const project = <input type="hidden" name="project" value={id} />;
  const days = data
    .flatMap((s) => [s.starts_on, s.due_on])
    .filter(Boolean)
    .map((x) => Date.parse(x) / 86400000);
  const start = Math.min(...days),
    end = Math.max(...days),
    span = Math.max(1, end - start + 1);
  const [current, next] = data.filter((s) => !s.completed_on);
  return (
    <section className="space-y-3 pt-4">
      <h2 className="wd-title">制作工程・スケジュール</h2>
      <dl className="wd-three">
        {[
          ["完了した工程", completed.length ? completed.map(s => s.title).join("、") : "まだありません"],
          ["現在の工程", current?.title || (data.length ? "全工程完了" : "工程未登録")],
          ["次の工程", next?.title || "—"],
        ].map(([label, value]) => <div className="wd-note" key={label}><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}
      </dl>
      {data.map((s) => (
        <div key={s.id} className="wd-gantt-row">
          <p>
            <strong>{s.title}</strong>
            <small className="block">
              {members.find(m => m.id === s.owner_id)?.name || "担当未設定"} ｜ {s.starts_on?.slice(5) || "未定"} ～{" "}
              {s.due_on?.slice(5) || "未定"}
            </small>
          </p>
          {s.starts_on && s.due_on ? (
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
          ) : (
            <small>日程未設定</small>
          )}
          {canEdit ? <details>
            <summary>
              {s.completed_on
                ? "完了"
                : s.id === current?.id
                  ? "進行中"
                  : "未着手"}
            </summary>
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
          </details> : <small>{s.completed_on ? "完了" : s.id === current?.id ? "進行中" : "未着手"}</small>}
        </div>
      ))}
      {canEdit && <details>
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
          <label>工程の担当<select name="owner" className="field">
            <option value="">未設定</option>
            {members.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
          </select></label>
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
      </details>}
      {archived && (
        <dl className="wd-note">
          <dt>終了日</dt><dd>{record.dock_archived_on || "未登録"}</dd>
          <dt>終了理由</dt><dd>{record.dock_archive_reason || "未登録"}</dd>
          <dt>保守</dt><dd>{record.dock_archive_support === "continue" ? "継続" : record.dock_archive_support === "end" ? "終了" : record.dock_archive_support === "none" ? "対象なし" : "未登録"}</dd>
        </dl>
      )}
      {canEdit && <details>
        <summary>{archived ? "終了の記録を編集" : "完了・アーカイブへ移す"}</summary>
        <form action={archiveProject} className="mt-2 grid gap-2">
          {project}
          <input type="hidden" name="archive" value="yes" />
            <label>終了日<input type="date" className="field" name="archived_on" defaultValue={record.dock_archived_on || dockToday()} required /></label>
            <label>終了理由<input className="field" name="archive_reason" defaultValue={record.dock_archive_reason || ""} required /></label>
            <label>保守の扱い<select name="archive_support" className="field" required defaultValue={record.dock_archive_support || ""}>
              <option value="">選択してください</option>
              <option value="continue">継続</option><option value="end">終了</option><option value="none">対象なし</option>
            </select></label>
          <button className="wd-primary">終了を記録する</button>
        </form>
      </details>}
      {archived && canEdit && <form action={archiveProject}>
        {project}<input type="hidden" name="archive" value="no" />
        <button className="text-brand">進行中に戻す</button>
      </form>}
    </section>
  );
}
