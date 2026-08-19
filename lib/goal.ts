import type { Goal } from "./types";
import { daysUntil, startOfToday } from "./format";

export type GoalStats = {
  /** 達成率 0-1 */
  progress: number;
  /** 期間のうち何割が過ぎたか 0-1 */
  elapsed: number;
  /** 今日時点で本来到達しているべき値 */
  expected: number;
  /** 期待値との差。マイナスなら遅れている */
  gap: number;
  onTrack: boolean;
  daysLeft: number;
  /** 残りを均等に割ったとき、1ヶ月あたり必要な量 */
  perMonthNeeded: number;
  remaining: number;
};

export function goalStats(goal: Goal): GoalStats {
  const start = new Date(`${goal.start_date}T00:00:00`).getTime();
  const end = new Date(`${goal.deadline}T00:00:00`).getTime();
  const now = startOfToday().getTime();

  const span = Math.max(end - start, 86_400_000);
  const elapsed = Math.min(Math.max((now - start) / span, 0), 1);

  const progress = goal.target_value > 0 ? goal.current_value / goal.target_value : 0;
  const expected = goal.target_value * elapsed;
  const gap = goal.current_value - expected;
  const daysLeft = daysUntil(goal.deadline);
  const remaining = Math.max(goal.target_value - goal.current_value, 0);
  const monthsLeft = Math.max(daysLeft / 30.4, 0.1);

  return {
    progress,
    elapsed,
    expected,
    gap,
    onTrack: gap >= 0,
    daysLeft,
    perMonthNeeded: remaining / monthsLeft,
    remaining,
  };
}
