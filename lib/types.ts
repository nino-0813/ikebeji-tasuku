export type Category = "marketing" | "system";
export type Status = "todo" | "doing" | "waiting" | "done";
export type Priority = "high" | "mid" | "low";

export type Member = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type Task = {
  id: string;
  title: string;
  detail: string | null;
  category: Category;
  status: Status;
  owner_id: string;
  due_date: string;
  priority: Priority;
  waiting_on: string | null;
  goal_id: string | null;
  meeting_id: string | null;
  sort_order: number;
  status_changed_at: string;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  title: string;
  category: Category;
  unit: string;
  target_value: number;
  current_value: number;
  start_date: string;
  deadline: string;
  memo: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalLog = {
  id: string;
  goal_id: string;
  recorded_on: string;
  value: number;
  memo: string | null;
  created_at: string;
};

export type Meeting = {
  id: string;
  held_on: string;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

/** ステータスの表示定義。ボードの列順もこの順番。 */
export const STATUSES: { key: Status; label: string; hint: string }[] = [
  { key: "todo", label: "未着手", hint: "やると決まった。まだ手をつけていない" },
  { key: "doing", label: "進行中", hint: "いま自分が手を動かしている" },
  { key: "waiting", label: "相手待ち", hint: "自分の手は離れた。相手の返事待ち" },
  { key: "done", label: "完了", hint: "終わった" },
];

export const CATEGORIES: { key: Category; label: string; short: string }[] = [
  { key: "marketing", label: "マーケティング", short: "マーケ" },
  { key: "system", label: "システム", short: "システム" },
];

export const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "high", label: "高" },
  { key: "mid", label: "中" },
  { key: "low", label: "低" },
];

/** 何日ステータスが動かなければ「止まっている」とみなすか */
export const STALL_DAYS = 5;
