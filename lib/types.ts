export type Category = "marketing" | "system";
export type Status = "todo" | "doing" | "waiting" | "done";
export type Priority = "high" | "mid" | "low";
export type Horizon = "long" | "short";

export type Member = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type Workspace = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
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
  project_id: string | null;
  sort_order: number;
  status_changed_at: string;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  workspace_id: string;
  title: string;
  category: Category;
  horizon: Horizon;
  /** 短期目標のとき、どの長期目標の区切りなのか */
  parent_goal_id: string | null;
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

export type Project = {
  id: string;
  workspace_id: string;
  title: string;
  detail: string | null;
  category: Category;
  goal_id: string | null;
  color: string;
  archived: boolean;
  sort_order: number;
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
  workspace_id: string;
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

export type InboxItem = {
  id: string;
  workspace_id: string;
  title: string;
  detail: string | null;
  created_by: string | null;
  created_at: string;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
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

export const HORIZONS: { key: Horizon; label: string; hint: string }[] = [
  { key: "long", label: "長期目標", hint: "半年〜1年で到達したい数字。ここは動かさない" },
  { key: "short", label: "短期目標", hint: "長期目標の中の区切り。今月・今四半期どこまで行けばいいか" },
];

export const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "high", label: "高" },
  { key: "mid", label: "中" },
  { key: "low", label: "低" },
];

/** 何日ステータスが動かなければ「止まっている」とみなすか */
export const STALL_DAYS = 5;

/** プロジェクトの色。一覧でどれがどれか一目で分かるようにするためのもの */
export const PROJECT_COLORS = [
  "#15803d",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#dc2626",
];
