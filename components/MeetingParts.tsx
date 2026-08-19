"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Meeting } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { createMeeting, deleteMeeting, updateMeeting } from "@/lib/actions";

export function NewMeetingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
      >
        ＋ 打ち合わせを始める
      </button>
    );
  }

  return (
    <div className="pop-in card flex flex-wrap items-end gap-2 p-3">
      <div>
        <label className="label">日付</label>
        <input
          type="date"
          className="field tnum w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="min-w-56 grow">
        <label className="label">タイトル</label>
        <input
          autoFocus
          className="field"
          value={title}
          placeholder="例）11月度 定例（広告 / 顧客管理）"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createMeeting(title || "打ち合わせ", date);
            if (res.id) router.push(`/meetings/${res.id}`);
          })
        }
        className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        {pending ? "作成中…" : "作る"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="rounded-lg border border-line-strong px-3 py-2 text-xs text-ink-soft hover:bg-stone-50"
      >
        やめる
      </button>
    </div>
  );
}

/** 議事メモ。打ち込みが止まって1秒で自動保存する */
export function MeetingNotes({ meeting }: { meeting: Meeting }) {
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await updateMeeting(meeting.id, { notes });
      setSaved("saved");
    }, 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notes, meeting.id]);

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-bold">議事メモ</h2>
        <span className="text-[11px] text-ink-mute">
          {saved === "saving" ? "保存中…" : saved === "saved" ? "自動保存しました" : "自動保存されます"}
        </span>
      </div>
      <textarea
        className="field min-h-40 resize-y leading-relaxed"
        value={notes}
        placeholder={`話したこと、決めたこと、保留にしたことを書き残す。\n決まったタスクは下の「決まったこと」に足すと、担当と期限つきで残ります。`}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}

export function MeetingHeader({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [title, setTitle] = useState(meeting.title);
  const [heldOn, setHeldOn] = useState(meeting.held_on);
  const [, start] = useTransition();

  function commit(patch: { title?: string; held_on?: string }) {
    start(async () => {
      await updateMeeting(meeting.id, patch);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        className="field tnum w-40"
        value={heldOn}
        onChange={(e) => {
          setHeldOn(e.target.value);
          commit({ held_on: e.target.value });
        }}
      />
      <input
        className="field min-w-56 grow text-base font-bold"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => commit({ title })}
      />
      <button
        onClick={() => {
          if (!confirm(`「${meeting.title}」を削除します。よろしいですか？`)) return;
          start(async () => {
            await deleteMeeting(meeting.id);
            router.push("/meetings");
          });
        }}
        className="rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50"
      >
        削除
      </button>
    </div>
  );
}
