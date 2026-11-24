import { WITH_DOCK_ID } from "./meeting-inbox";
// Original shared-board destinations visible from the With Dock workspace.
export const boardPages = [
  { id: "00000000-0000-4000-8000-000000000001", name: "イケベジweb" },
  { id: "00000000-0000-4000-8000-000000000002", name: "naco" },
  { id: "00000000-0000-4000-8000-000000000004", name: "本間 個人" },
] as const;

export function isTeamPage(id: string) {
  return id === WITH_DOCK_ID || boardPages.some(page => page.id === id);
}
