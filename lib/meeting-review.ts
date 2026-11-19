import type { InboxItem, Project } from "./types";
import { readSource } from "./meeting-inbox";

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
function words(text: string) {
  return new Set(Array.from(segmenter.segment(text.normalize("NFKC").toLowerCase()))
    .map(part => part.segment).filter(word => word.length >= 2 && !/^(する|いる|ため|について|対応|作成|担当|案件|行う|確認|整理)$/.test(word)));
}

function suggest(title: string, quote: string, projects: Project[]) {
  const scores = projects.map(project => {
    const labels = [project.title.split(/[（(]/)[0], project.client_name || ""]
      .map(normalize).filter(label => label.length >= 2);
    const match = (text: string, label: string) =>
      normalize(text).replace(/の/g, "").includes(label.replace(/の/g, ""));
    const score = Math.max(0, ...labels.map(label => match(title,label) ? 3 : match(quote,label) ? 2 : 0));
    return { project, score };
  }).sort((a,b) => b.score - a.score);
  return scores[0]?.score && scores[0].score > (scores[1]?.score || 0) ? scores[0].project : null;
}

const equivalentIntents = [
  [/規模別/, /経費率/, /作成|試算/],
  [/広島/, /品質/, /人材/, /探/],
  [/ヒアリングシート/, /確認/, /洗い出し/],
  [/タスクボード/, /改善/, /ダッシュボード/, /要件/],
  [/ヤマト/, /excel/i, /以外/, /修正/],
  [/スキップ履歴/, /変更履歴/, /出力/],
  [/契約まで/, /価格/, /納品条件/, /契約後/, /引き継/],
  [/ヒアリング/, /明日10時/, /定例/, /実施/],
];
function sameIntent(a: string, b: string) {
  return equivalentIntents.some(rule => rule.every(term => term.test(a) && term.test(b)));
}
function similar(a: string, b: string) {
  if (normalize(a) === normalize(b)) return true;
  if (sameIntent(a,b)) return true;
  const left = words(a), right = words(b);
  const shared = [...left].filter(word => right.has(word)).length;
  return shared >= 4 && shared / new Set([...left, ...right]).size >= 0.72;
}

export function reviewGroups(items: InboxItem[], projects: Project[]) {
  type Entry = {item: InboxItem; candidate: NonNullable<ReturnType<typeof readSource>>};
  const groups: {entries: Entry[]; project: Project | null}[] = [];
  for (const item of items) {
    const candidate = readSource(item.detail);
    if (!candidate) continue;
    const project = suggest(item.title, candidate.source.quote, projects);
    const group = candidate.state === "pending" && groups.find(group =>
      group.project?.id === project?.id && group.entries.every(entry =>
        entry.candidate.state === "pending" &&
        (project || entry.candidate.source.key === candidate.source.key || sameIntent(entry.item.title,item.title)) &&
        similar(entry.item.title, item.title)));
    if (group) group.entries.push({item, candidate});
    else groups.push({entries:[{item, candidate}], project});
  }
  return groups.sort((a,b) => b.entries.length - a.entries.length);
}
