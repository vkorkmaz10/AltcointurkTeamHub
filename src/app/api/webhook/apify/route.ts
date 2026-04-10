import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { filterOriginalTweets, normalizeTweet } from "@/lib/apify";

/**
 * Apify webhook endpoint — receives scraped tweets
 * POST /api/webhook/apify
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const secret = req.headers.get("x-apify-webhook-secret");
    if (secret !== process.env.APIFY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const tweets = body.items || body.data || body;

    if (!Array.isArray(tweets)) {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 }
      );
    }

    // Filter only original tweets
    const originalTweets = filterOriginalTweets(tweets);

    let newTweetCount = 0;

    for (const rawTweet of originalTweets) {
      const normalized = normalizeTweet(rawTweet);

      // Skip if tweet already exists
      const existing = await prisma.tweet.findUnique({
        where: { tweetId: normalized.tweetId },
      });

      if (existing) continue;

      // Save new tweet
      const tweet = await prisma.tweet.create({
        data: normalized,
      });

      // Trigger Inngest event for processing
      await inngest.send({
        name: "tweet/new",
        data: {
          tweetId: tweet.tweetId,
          tweetDbId: tweet.id,
          authorHandle: tweet.authorHandle,
          content: tweet.content,
        },
      });

      newTweetCount++;
    }

    // Log the watcher run
    await prisma.watcherLog.create({
      data: {
        type: "run_complete",
        message: `Scraped ${tweets.length} tweets, ${originalTweets.length} original, ${newTweetCount} new`,
        metadata: JSON.stringify({
          totalScraped: tweets.length,
          originalCount: originalTweets.length,
          newCount: newTweetCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      processed: newTweetCount,
      total: originalTweets.length,
    });
  } catch (error) {
    console.error("Apify webhook error:", error);

    await prisma.watcherLog.create({
      data: {
        type: "error",
        message: `Webhook error: ${error instanceof Error ? error.message : "Unknown"}`,
      },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
