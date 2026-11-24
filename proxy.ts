import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "./lib/auth";
import { TEAM_COOKIE, teamIdentity } from "./lib/dock-identity";
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
      const task = path.match(/^\/api\/tasks\/([^/]+)/);
      if (task) {
        const { data } = await db.from("tm_tasks").select("id").eq("id", task[1]).eq("workspace_id", WITH_DOCK_ID).maybeSingle();
        if (!data) return new NextResponse(null, { status: 404 });
      }
      request.cookies.set("tm_workspace", WITH_DOCK_ID);
      request.cookies.set("tm_me", member);
      return NextResponse.next({ request: { headers: request.headers } });
    }
  } else {
    const expected = process.env.APP_PASSWORD;
    if (expected && request.cookies.get(AUTH_COOKIE)?.value === authToken(expected) && workspace !== WITH_DOCK_ID) return NextResponse.next();
  }
  const url = new URL("/login", request.url);
  if (personal || workspace === WITH_DOCK_ID) url.searchParams.set("team","withdock");
  return NextResponse.redirect(url);
}
export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
