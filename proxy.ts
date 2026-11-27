import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "@supabase/supabase-js";

import { TEAM_COOKIE, teamIdentityStatus, canOpenWorkspace } from "./lib/dock-identity";
import { authTemporarilyUnavailable, REMEMBER_SESSION_SECONDS, TEAM_REFRESH_COOKIE, teamCookieOptions } from "./lib/dock-session";
import { WITH_DOCK_ID } from "./lib/meeting-inbox";
import { createSupabaseClient, db } from "./lib/supabase";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/internal/meeting-inbox" && request.method === "POST") return NextResponse.next();

  const workspace = request.cookies.get("tm_workspace")?.value;
  const savedToken = request.cookies.get(TEAM_REFRESH_COOKIE)?.value;
  let identity = await teamIdentityStatus(request.cookies.get(TEAM_COOKIE)?.value);
  let refreshed: Session | null = null;

  if (!identity.member && !identity.unavailable && savedToken) {
    const { data, error } = await createSupabaseClient().auth.refreshSession({ refresh_token: savedToken });
    if (authTemporarilyUnavailable(error)) return authUnavailable();
    refreshed = data.session;
    if (refreshed) {
      identity = await teamIdentityStatus(refreshed.access_token);
      request.cookies.set(TEAM_COOKIE, refreshed.access_token);
    }
  }

  if (identity.unavailable) return authUnavailable();
  const { member } = identity;
  if (!member) {
    const login = new URL("/login", request.url);
    if (workspace === WITH_DOCK_ID) login.searchParams.set("team", "withdock");
    const response = NextResponse.redirect(login, request.method === "GET" ? 307 : 303);
    response.cookies.delete(TEAM_COOKIE);
    response.cookies.delete(TEAM_REFRESH_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const selected = workspace || WITH_DOCK_ID;
  let response: NextResponse;
  const task = path.match(/^\/api\/tasks\/([^/]+)/);
  if (!(await canOpenWorkspace(member, selected))) {
    response = new NextResponse("ページを開く権限がありません。", { status: 403 });
  } else if (task && !(await db.from("tm_tasks").select("id").eq("id", task[1]).eq("workspace_id", selected).maybeSingle()).data) {
    response = new NextResponse(null, { status: 404 });
  } else {
    request.cookies.set("tm_workspace", selected);
    request.cookies.set("tm_me", member);
    response = NextResponse.next({ request: { headers: request.headers } });
  }
  if (refreshed) {
    const maxAge = REMEMBER_SESSION_SECONDS;
    response.cookies.set(TEAM_COOKIE, refreshed.access_token, { ...teamCookieOptions, maxAge: refreshed.expires_in });
    response.cookies.set(TEAM_REFRESH_COOKIE, refreshed.refresh_token, { ...teamCookieOptions, maxAge });
    response.cookies.set("tm_workspace", selected, { ...teamCookieOptions, maxAge });
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

function authUnavailable() {
  return new NextResponse("ログイン状態を確認できませんでした。少し待ってから再読み込みしてください。", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
