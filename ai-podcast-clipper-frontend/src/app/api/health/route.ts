import { NextResponse } from "next/server";
import { db } from "~/server/db";

// The daily keep-alive ping hits this (.github/workflows/keepalive.yml): one tiny query is enough
// activity to stop Supabase's free plan pausing the project after a quiet week.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
