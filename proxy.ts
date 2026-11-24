import { NextResponse, type NextRequest } from "next/server";

import { TEAM_COOKIE, teamIdentity, canOpenWorkspace } from "./lib/dock-identity";
import { WITH_DOCK_ID } from "./lib/meeting-inbox";
import { db } from "./lib/supabase";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/api/internal/meeting-inbox" && request.method === "POST") return NextResponse.next();
  const personal = request.cookies.get(TEAM_COOKIE)?.value;
  const workspace = request.cookies.get("tm_workspace")?.value;
  if (personal) {
    const member = await teamIdentity(personal);
    if (member) {
      const selected = workspace || WITH_DOCK_ID;
      if (!(await canOpenWorkspace(member, selected))) return new NextResponse("ページを開く権限がありません。", { status: 403 });
      const task = path.match(/^\/api\/tasks\/([^/]+)/);
      if (task) {
        const { data } = await db.from("tm_tasks").select("id").eq("id", task[1]).eq("workspace_id", selected).maybeSingle();
        if (!data) return new NextResponse(null, { status: 404 });
      }
      request.cookies.set("tm_workspace", selected);
      request.cookies.set("tm_me", member);
      return NextResponse.next({ request: { headers: request.headers } });
    }
  }
  const url = new URL("/login", request.url);
  if (workspace === WITH_DOCK_ID) url.searchParams.set("team","withdock");
  return NextResponse.redirect(url);
}
export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
