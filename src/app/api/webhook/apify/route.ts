import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { filterOriginalTweets, normalizeTweet } from "@/lib/apify";

/**
 * Apify webhook endpoint — receives scraped tweets
 * POST /api/webhook/apify
 *
 * Flow: Apify scrape completes → webhook fires → save new tweets to DB
 *       → inngest.send("tweet/new") → Inngest Cloud picks up → runs processNewTweet
 */
export async function POST(req: NextRequest) {
  console.log("[WEBHOOK/APIFY] Incoming request");

  try {
    // Verify webhook secret
    const secret = req.headers.get("x-apify-webhook-secret");
    if (secret !== process.env.APIFY_WEBHOOK_SECRET) {
      console.warn("[WEBHOOK/APIFY] Unauthorized — invalid secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const tweets = body.items || body.data || body;

    if (!Array.isArray(tweets)) {
      console.warn("[WEBHOOK/APIFY] Invalid payload format:", typeof tweets);
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 }
      );
    }

    console.log(`[WEBHOOK/APIFY] Received ${tweets.length} raw tweets`);

    // Filter only original tweets (no RTs, replies, quotes)
    const originalTweets = filterOriginalTweets(tweets);
    console.log(`[WEBHOOK/APIFY] ${originalTweets.length} original tweets after filtering`);

    let newTweetCount = 0;
    const inngestEvents: Array<{
      name: "tweet/new";
      data: { tweetId: string; tweetDbId: string; authorHandle: string; content: string };
    }> = [];

    for (const rawTweet of originalTweets) {
      const normalized = normalizeTweet(rawTweet);

      // Skip if tweet already exists
      const existing = await prisma.tweet.findUnique({
        where: { tweetId: normalized.tweetId },
      });

      if (existing) {
        console.log(`[WEBHOOK/APIFY] Tweet ${normalized.tweetId} already exists, skipping`);
        continue;
      }

      // Save new tweet
      const tweet = await prisma.tweet.create({
        data: normalized,
      });

      console.log(`[WEBHOOK/APIFY] New tweet saved: ${tweet.tweetId} by @${tweet.authorHandle}`);

      // Collect Inngest events for batch send
      inngestEvents.push({
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

    // Batch send all events to Inngest in one call (more reliable)
    if (inngestEvents.length > 0) {
      try {
        await inngest.send(inngestEvents);
        console.log(`[WEBHOOK/APIFY] ✅ Sent ${inngestEvents.length} tweet/new events to Inngest`);
      } catch (inngestError) {
        console.error("[WEBHOOK/APIFY] ❌ Failed to send events to Inngest:", inngestError);
        // Log the error but don't fail the webhook — tweets are already saved
        await prisma.watcherLog.create({
          data: {
            type: "inngest_error",
            message: `Failed to send ${inngestEvents.length} events to Inngest: ${inngestError instanceof Error ? inngestError.message : "Unknown"}`,
            metadata: JSON.stringify({
              tweetIds: inngestEvents.map((e) => e.data.tweetId),
            }),
          },
        });
      }
    }

    // Log the watcher run
    await prisma.watcherLog.create({
      data: {
        type: "run_complete",
        message: `Scraped ${tweets.length} tweets, ${originalTweets.length} original, ${newTweetCount} new, ${inngestEvents.length} sent to Inngest`,
        metadata: JSON.stringify({
          totalScraped: tweets.length,
          originalCount: originalTweets.length,
          newCount: newTweetCount,
          inngestEventsSent: inngestEvents.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      processed: newTweetCount,
      total: originalTweets.length,
      inngestEventsSent: inngestEvents.length,
    });
  } catch (error) {
    console.error("[WEBHOOK/APIFY] Error:", error);

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
