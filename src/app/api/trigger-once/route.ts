import { NextRequest, NextResponse } from "next/server";
import { Inngest } from "inngest";
import { prisma } from "@/lib/prisma";
import { generateReply } from "@/lib/gemini";
import { replyToTweet, likeTweet } from "@/lib/twitter";
import { decrypt } from "@/lib/encryption";

/**
 * TEMPORARY one-time test endpoint — DELETE AFTER USE
 * POST /api/trigger-once?token=altcointurk2026
 *
 * Bypasses Inngest entirely — directly generates AI reply and sends via Twitter.
 * Used for debugging the pipeline when Inngest event delivery has issues.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== "altcointurk2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tweetId, tweetContent, tweetAuthor } = body;

  if (!tweetId || !tweetContent || !tweetAuthor) {
    return NextResponse.json({ error: "Missing: tweetId, tweetContent, tweetAuthor" }, { status: 400 });
  }

  const log: Record<string, unknown>[] = [];

  try {
    // 1. Save tweet to DB
    const tweet = await prisma.tweet.upsert({
      where: { tweetId },
      update: {},
      create: {
        tweetId,
        authorHandle: tweetAuthor,
        authorName: tweetAuthor,
        content: tweetContent,
        tweetUrl: `https://x.com/${tweetAuthor}/status/${tweetId}`,
        isOriginal: true,
      },
    });
    log.push({ step: "tweet_saved", id: tweet.id });

    // 2. Find active users (except tweet author)
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        approved: true,
        xHandle: { not: tweetAuthor },
        xApiKey: { not: null },
        skillContent: { not: null },
      },
    });
    log.push({ step: "users_found", count: users.length, users: users.map(u => `${u.displayName} (@${u.xHandle})`) });

    if (users.length === 0) {
      return NextResponse.json({ success: false, error: "No eligible users", log });
    }

    // 3. Debug: Check Inngest env
    const inngestDebug = {
      eventKeySet: !!process.env.INNGEST_EVENT_KEY,
      eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.substring(0, 8) || "EMPTY",
      signingKeySet: !!process.env.INNGEST_SIGNING_KEY,
    };
    log.push({ step: "inngest_debug", ...inngestDebug });

    // 4. Also try Inngest send in parallel (for debugging)
    let inngestResult: unknown = null;
    try {
      const testClient = new Inngest({
        id: "altcointurk-team-hub",
        eventKey: process.env.INNGEST_EVENT_KEY,
      });
      inngestResult = await testClient.send({
        name: "tweet/new",
        data: { tweetId, tweetDbId: tweet.id, authorHandle: tweetAuthor, content: tweetContent },
      });
      log.push({ step: "inngest_send", status: "success", result: inngestResult });
    } catch (inngestErr) {
      log.push({ step: "inngest_send", status: "failed", error: String(inngestErr) });
    }

    // 5. Direct pipeline: generate & send for each user
    const results = [];
    for (const user of users) {
      const userResult: Record<string, unknown> = { user: user.displayName, handle: `@${user.xHandle}` };

      try {
        // Generate AI reply
        const aiReply = await generateReply({
          displayName: user.displayName,
          xHandle: user.xHandle || user.username,
          skillContent: user.skillContent || "Samimi ve doğal bir ekip üyesi.",
          tweetAuthor: `@${tweetAuthor}`,
          tweetContent,
        });
        userResult.aiReply = aiReply;

        // Create interaction record
        const interaction = await prisma.interaction.upsert({
          where: { userId_tweetId: { userId: user.id, tweetId: tweet.id } },
          update: { replyText: aiReply, status: "SCHEDULED" },
          create: {
            userId: user.id,
            tweetId: tweet.id,
            replyText: aiReply,
            status: "SCHEDULED",
            scheduledAt: new Date(),
          },
        });

        // Decrypt credentials & send
        const credentials = {
          apiKey: decrypt(user.xApiKey!),
          apiSecret: decrypt(user.xApiSecret!),
          accessToken: decrypt(user.xAccessToken!),
          accessSecret: decrypt(user.xAccessSecret!),
        };

        // Reply
        const replyResult = await replyToTweet(credentials, tweetId, aiReply);
        userResult.replySent = replyResult.success;
        userResult.replyTweetId = replyResult.replyId;
        userResult.replyError = replyResult.error;

        // Like
        let likeResult: { success: boolean; error?: string } = { success: false, error: "No xUserId" };
        if (user.xUserId) {
          likeResult = await likeTweet(credentials, user.xUserId, tweetId);
        }
        userResult.liked = likeResult.success;
        userResult.likeError = likeResult.error;

        // Update DB
        await prisma.interaction.update({
          where: { id: interaction.id },
          data: {
            status: replyResult.success ? "SENT" : "FAILED",
            replyTweetId: replyResult.replyId || null,
            liked: likeResult.success,
            executedAt: new Date(),
            errorMessage: replyResult.success ? null : replyResult.error,
          },
        });

        userResult.status = replyResult.success ? "SENT" : "FAILED";
      } catch (err) {
        userResult.status = "ERROR";
        userResult.error = String(err);
      }

      results.push(userResult);
    }

    return NextResponse.json({ success: true, results, log });
  } catch (error) {
    return NextResponse.json({ error: "Failed", details: String(error), log }, { status: 500 });
  }
}

export async function GET() {
  // Debug endpoint — show Inngest key info
  return NextResponse.json({
    inngestEventKey: process.env.INNGEST_EVENT_KEY ? `${process.env.INNGEST_EVENT_KEY.substring(0, 8)}...` : "NOT SET",
    inngestSigningKey: process.env.INNGEST_SIGNING_KEY ? "SET" : "NOT SET",
  });
}
