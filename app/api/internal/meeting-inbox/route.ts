import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { db } from "@/lib/supabase";
import { httpUrl, isDockDate } from "@/lib/dock-project";
import { encodeSource, WITH_DOCK_ID, type Candidate } from "@/lib/meeting-inbox";

function candidate(value: unknown): value is Candidate {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return [["title", 200], ["quote", 450], ["owner", 80], ["timing", 100]].every(([k, n]) =>
    typeof c[k] === "string" && (c[k] as string).length <= Number(n)) &&
    Boolean((c.title as string)?.trim() && (c.quote as string)?.trim());
}
function candidateId(key: string, c: Candidate) {
  const h = createHash("sha256").update("withdock-inbox-v1\n" + key + "\n" + c.quote.normalize("NFKC").replace(/\s/g, "") + "\n" + c.title.normalize("NFKC").trim()).digest("hex");
  return [h.slice(0,8), h.slice(8,12), "8" + h.slice(13,16), "a" + h.slice(17,20), h.slice(20,32)].join("-");
}
export async function POST(req: Request) {
  const secret = process.env.WITHDOCK_INBOX_SECRET;
  const ts = req.headers.get("x-withdock-time") || "", sig = req.headers.get("x-withdock-signature") || "";
  if (!secret || secret.length < 32 || !/^\d{13}$/.test(ts) || Math.abs(Date.now()-Number(ts)) > 300000 || !/^[a-f0-9]{64}$/.test(sig)) return new Response(null,{status:401});
  if (Number(req.headers.get("content-length")) > 180000) return new Response(null,{status:413});
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 180000) return new Response(null,{status:413});
  if (!timingSafeEqual(createHmac("sha256",secret).update(ts+"\n"+raw).digest(),Buffer.from(sig,"hex"))) return new Response(null,{status:401});
  let d;
  try { d = JSON.parse(raw); } catch { return new Response(null,{status:400}); }
  if (!d || typeof d !== "object") return new Response(null, { status: 400 });
  if (d.sync !== undefined) {
    const result = d.sync;
    if (!result || typeof result.id !== "string" || !/^[\w-]{1,160}$/.test(result.id)
      || typeof result.succeeded !== "boolean" || !Number.isSafeInteger(result.item_count)
      || result.item_count < 0 || result.item_count > 1_000_000 || d.candidates !== undefined)
      return new Response(null, { status: 400 });
    const { error } = await db.from("dock_sync_runs").upsert({
      id: result.id, succeeded: result.succeeded, item_count: result.item_count,
    }, { onConflict: "id", ignoreDuplicates: true });
    return error ? new Response(null, { status: 503 }) : Response.json({ ok: true });
  }
  if (typeof d.key !== "string" || !/^[\w-]{1,160}$/.test(d.key) || typeof d.meeting !== "string" || !d.meeting.trim() || d.meeting.length > 1500 ||
    !(d.date === null || (typeof d.date === "string" && isDockDate(d.date))) ||
    !Array.isArray(d.candidates) || d.candidates.length > 40 || !d.candidates.every(candidate)) return new Response(null,{status:400});
  type Proposal = Candidate & {kind: string; confidence: string; subject: string; origin?: string; due?: string; source_url?: string};
  const incoming = d.candidates as (Candidate & Partial<Proposal>)[];
  const proposals: Proposal[] = [];
  for (const c of incoming) {
    if (c.kind === undefined) continue;
    if (!["customer","project","task","improvement"].includes(c.kind) ||
        !["high","medium","low"].includes(c.confidence || "") || typeof c.subject !== "string" || c.subject.length > 150 ||
        (c.origin !== undefined && !["ai", "meeting"].includes(c.origin)) ||
        (c.due !== undefined && (typeof c.due !== "string" || !isDockDate(c.due))) ||
        (c.source_url !== undefined && (typeof c.source_url !== "string" || c.source_url.length > 2048 || !httpUrl(c.source_url)))) {
      return new Response(null,{status:400});
    }
    proposals.push(c as Proposal);
  }
  if (proposals.length) {
    const records = proposals.map(c=>({
      id:candidateId(d.key,{...c,title:c.kind+"\n"+c.subject+"\n"+c.title}), kind:c.kind, title:c.title,
      quote:c.quote, confidence:c.confidence, meeting_key:d.key, meeting_title:d.meeting, meeting_date:d.date,
      proposed:{subject:c.subject,owner:c.owner,timing:c.timing,
        origin:c.origin, due:c.due, source_url:httpUrl(c.source_url) ?? undefined}
    }));
    const {error} = await db.from("dock_proposals").upsert(records,{onConflict:"id",ignoreDuplicates:true});
    if (error) return new Response(null,{status:503});
  }
  const rows = incoming.filter(c=>c.kind === undefined).map(c => ({ id: candidateId(d.key,c), workspace_id: WITH_DOCK_ID, title: c.title,
    detail: encodeSource({...c, key:d.key, meeting:d.meeting, date:d.date},"pending") }));
  if (rows.length) {
    const {error} = await db.from("tm_inbox_items").upsert(rows, { onConflict:"id", ignoreDuplicates:true });
    if (error) return new Response(null,{status:503});
  } else {
    const {data,error} = await db.from("tm_workspaces").select("id").eq("id",WITH_DOCK_ID).maybeSingle();
    if (error || !data) return new Response(null,{status:503});
  }
  return Response.json({ok:true});
}
