"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Goal, GoalLog } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { addDaysISO, formatDate, formatValue, todayISO } from "@/lib/format";
import { goalStats } from "@/lib/goal";
import { addGoalLog, createGoal, deleteGoal, updateGoal } from "@/lib/actions";

export function NewGoalButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("marketing");
  const [unit, setUnit] = useState("円");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [start, setStart] = useState(todayISO());
  const [deadline, setDeadline] = useState(addDaysISO(90));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
      >
        ＋ 目標を作る
      </button>
    );
  }

  return (
    <div className="pop-in card w-full space-y-3 p-4">
      <div>
        <label className="label">目標（数字が入る言い方にする）</label>
        <input
          autoFocus
          className="field"
          value={title}
          placeholder="例）お米の売上（オンラインストア＋定期便）"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">領域</label>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">単位</label>
          <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div>
          <label className="label">目標値</label>
          <input
            type="number"
            className="field tnum"
            value={target}
            placeholder="3000000"
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div>
          <label className="label">現在値</label>
          <input
            type="number"
            className="field tnum"
            value={current}
            placeholder="820000"
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">開始日</label>
          <input
            type="date"
            className="field tnum"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="label">期限</label>
          <input
            type="date"
            className="field tnum"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:bg-stone-50"
        >
          やめる
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await createGoal({
                title,
                category,
                unit: unit || "円",
                target_value: Number(target) || 0,
                current_value: Number(current) || 0,
                start_date: start,
                deadline,
              });
              if (res.error) return setError(res.error);
              setOpen(false);
              setTitle("");
              setTarget("");
              setCurrent("");
              router.refresh();
            })
          }
          className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "作成中…" : "作る"}
        </button>
      </div>
    </div>
  );
}

/** 実績を記録する。ここを月1回埋めるだけで、遅れているかどうかが自動で出る */
export function GoalLogForm({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">日付</label>
        <input
          type="date"
          className="field tnum w-36"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="grow">
        <label className="label">この日時点の累計（{goal.unit}）</label>
        <input
          type="number"
          className="field tnum"
          value={value}
          placeholder="今いくらまで来ているか"
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <button
        disabled={pending || value === ""}
        onClick={() =>
          start(async () => {
            await addGoalLog(goal.id, Number(value), date);
            setValue("");
            router.refresh();
          })
        }
        className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        {pending ? "記録中…" : "実績を記録"}
      </button>
    </div>
  );
}

export function GoalLogList({ goal, logs }: { goal: Goal; logs: GoalLog[] }) {
  if (logs.length === 0) {
    return <p className="text-xs text-ink-mute">まだ実績の記録がありません。</p>;
  }
  const max = Math.max(goal.target_value, ...logs.map((l) => l.value)) || 1;
  return (
    <div className="space-y-1">
      {[...logs].reverse().map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <span className="tnum w-14 shrink-0 text-[11px] text-ink-mute">
            {formatDate(l.recorded_on)}
          </span>
          <div className="h-1.5 grow overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-brand/60" style={{ width: `${(l.value / max) * 100}%` }} />
          </div>
          <span className="tnum w-24 shrink-0 text-right text-[11px] font-semibold text-ink-soft">
            {formatValue(l.value, goal.unit)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GoalActions({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(goal.target_value));
  const [deadline, setDeadline] = useState(goal.deadline);
  const [, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          className="rounded px-2 py-1 text-[11px] text-ink-mute hover:bg-stone-100"
        >
          編集
        </button>
        <button
          onClick={() => {
            if (!confirm(`「${goal.title}」を削除します。よろしいですか？`)) return;
            start(async () => {
              await deleteGoal(goal.id);
              router.refresh();
            });
          }}
          className="rounded px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
        >
          削除
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="label">目標値</label>
        <input
          type="number"
          className="field tnum w-32"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </div>
      <div>
        <label className="label">期限</label>
        <input
          type="date"
          className="field tnum w-36"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <button
        onClick={() =>
          start(async () => {
            await updateGoal(goal.id, { target_value: Number(target) || 0, deadline });
            setEditing(false);
            router.refresh();
          })
        }
        className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
      >
        保存
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-lg border border-line-strong px-3 py-2 text-xs text-ink-soft"
      >
        やめる
      </button>
    </div>
  );
}

/** 目標の下に置く一言サマリー。数字を「次に何をするか」に翻訳する */
export function GoalVerdict({ goal }: { goal: Goal }) {
  const s = goalStats(goal);
  if (s.daysLeft < 0) {
    return <p className="text-xs text-ink-mute">期限を過ぎています。次の期間の目標を作り直しましょう。</p>;
  }
  if (s.remaining <= 0) {
    return <p className="text-xs font-bold text-brand">目標達成。次の目標を決めましょう。</p>;
  }
  return (
    <p className="text-xs text-ink-soft">
      期限まで<b className="tnum">{s.daysLeft}日</b>。残り
      <b className="tnum"> {formatValue(s.remaining, goal.unit)}</b>なので、
      <b className="tnum"> 月{formatValue(s.perMonthNeeded, goal.unit)}</b>のペースが必要です。
      {!s.onTrack && (
        <span className="font-bold text-amber-700">
          {" "}
          いまは{formatValue(Math.abs(s.gap), goal.unit)}分の遅れです。打ち手を1つ足してください。
        </span>
      )}
    </p>
  );
}
