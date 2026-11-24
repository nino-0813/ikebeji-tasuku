import "server-only";
import { cookies } from "next/headers";
import { WITH_DOCK_ID } from "./meeting-inbox";
import { cache } from "react";
import { TEAM_COOKIE, teamIdentity } from "./dock-identity";

export const signedInMember = cache(async () =>
  teamIdentity((await cookies()).get(TEAM_COOKIE)?.value)
);

export const dockTeamMember = cache(async () => {
  const selected = (await cookies()).get("tm_workspace")?.value;
  if (selected !== WITH_DOCK_ID) return null;
  return signedInMember();
});
