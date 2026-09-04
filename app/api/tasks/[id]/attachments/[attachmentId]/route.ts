import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKET = "task-attachments";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

async function findAttachment(id: string, attachmentId: string) {
  return db
    .from("tm_task_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("task_id", id)
    .maybeSingle();
}

export async function GET(_request: Request, context: Context) {
  const { id, attachmentId } = await context.params;
  const { data, error } = await findAttachment(id, attachmentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "添付ファイルが見つかりません。" }, { status: 404 });

  const { data: file, error: downloadError } = await db.storage.from(BUCKET).download(data.storage_path);
  if (downloadError) return NextResponse.json({ error: downloadError.message }, { status: 500 });
  const encoded = encodeURIComponent(data.file_name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(file, {
    headers: {
      "Content-Type": data.content_type || "application/octet-stream",
      "Content-Length": String(data.size_bytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(_request: Request, context: Context) {
  const { id, attachmentId } = await context.params;
  const { data, error } = await findAttachment(id, attachmentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "添付ファイルが見つかりません。" }, { status: 404 });

  const { error: storageError } = await db.storage.from(BUCKET).remove([data.storage_path]);
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  const { error: deleteError } = await db.from("tm_task_attachments").delete().eq("id", attachmentId).eq("task_id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
