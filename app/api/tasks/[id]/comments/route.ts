import { NextResponse } from "next/server";
import { getComments } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const comments = await getComments(id);
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: [] }, { status: 500 });
  }
}
