export const WITH_DOCK_ID = "00000000-0000-4000-8000-000000000005";
const marker = "withdock-meeting-v1/";
export type Candidate = { title: string; quote: string; owner: string; timing: string };
export type MeetingSource = Candidate & { key: string; meeting: string; date: string | null };
export type ReviewState = "pending" | "creating" | "linking" | "closed";

export function encodeSource(source: MeetingSource, state: ReviewState, target = "") {
  return marker + state + "/" + target + "\n" + JSON.stringify(source);
}
export function readSource(detail: string | null) {
  if (!detail?.startsWith(marker)) return null;
  const end = detail.indexOf("\n");
  const [state, target] = detail.slice(marker.length, end).split("/");
  if (!["pending", "creating", "linking", "closed"].includes(state)) return null;
  try {
    const source = JSON.parse(detail.slice(end + 1)) as MeetingSource;
    if (typeof source.key !== "string" || !/^[\w-]{1,160}$/.test(source.key)) return null;
    return { state: state as ReviewState, target, source };
  } catch { return null; }
}
export function sourceUrl(source: MeetingSource) {
  return "https://withdock-workspace.vercel.app/#meetings/" + source.key;
}
export function sourceNote(s: MeetingSource) {
  return [s.meeting, s.date, s.owner && "担当の発言：" + s.owner, s.timing && "時期の発言：" + s.timing,
    "「" + s.quote + "」", sourceUrl(s)].filter(Boolean).join("\n");
}
