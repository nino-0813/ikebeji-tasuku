import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { TEAM_COOKIE, teamIdentity } from "./dock-identity";

export const dockTeamMember = cache(async () =>
  teamIdentity((await cookies()).get(TEAM_COOKIE)?.value)
);
