import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

/**
 * TEMPORARY one-time test endpoint — DELETE AFTER USE
 * POST /api/trigger-once?token=altcointurk2026
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== "altcointurk2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tweetId, tweetDbId, authorHandle, content } = body;

  if (!tweetId || !tweetDbId || !authorHandle) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const result = await inngest.send({
      name: "tweet/new",
      data: { tweetId, tweetDbId, authorHandle, content },
    });

    return NextResponse.json({
      success: true,
      message: "Inngest tweet/new event sent",
      inngestResult: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Inngest send failed", details: String(error) },
      { status: 500 }
    );
  }
}
