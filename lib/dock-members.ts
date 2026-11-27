import type { Member } from "./types";

const display: Record<string, { name: string; color: string; aliases: string[] }> = {
  ninomiya: { name: "二宮", color: "#308578", aliases: ["ニノ", "ニノさん"] },
  honma: { name: "本間", color: "#b66925", aliases: ["本間さん"] },
  toru: { name: "とおる", color: "#4779ab", aliases: ["とおるさん", "トール"] },
  goda: { name: "郷田", color: "#795ca0", aliases: ["合田", "郷田さん", "ゴーダ"] },
};

export function dockMemberDisplay(member: Member): Member {
  const entry = display[member.id];
  return entry ? { ...member, name: entry.name, color: entry.color } : member;
}

export function proposedOwner(members: Member[], value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = value.normalize("NFKC").trim();
  const matches = members.filter(m => [m.id, m.name, ...(display[m.id]?.aliases ?? [])].includes(normalized));
  return matches.length === 1 ? matches[0].id : "";
}
