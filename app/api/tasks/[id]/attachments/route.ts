import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKET = "task-attachments";
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { data, error } = await db
    .from("tm_task_attachments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const value = form.get("file");
  if (!(value instanceof File)) {
    return NextResponse.json({ error: "ファイルを選択してください。" }, { status: 400 });
  }
  if (value.size === 0) {
    return NextResponse.json({ error: "空のファイルは添付できません。" }, { status: 400 });
  }
  if (value.size > MAX_BYTES) {
    return NextResponse.json({ error: "添付できるファイルは10MBまでです。" }, { status: 413 });
  }

  const { data: task, error: taskError } = await db.from("tm_tasks").select("id").eq("id", id).maybeSingle();
  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "タスクが見つかりません。" }, { status: 404 });

  const safeName = value.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "file";
  const storagePath = `${id}/${crypto.randomUUID()}-${safeName}`;
  const bytes = await value.arrayBuffer();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: value.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await db
    .from("tm_task_attachments")
    .insert({
      task_id: id,
      file_name: value.name.slice(0, 255),
      storage_path: storagePath,
      content_type: value.type || null,
      size_bytes: value.size,
    })
    .select("*")
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attachment: data }, { status: 201 });
}
