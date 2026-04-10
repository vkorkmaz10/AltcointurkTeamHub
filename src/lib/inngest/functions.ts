import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { generateReply } from "@/lib/gemini";
import { replyToTweet, likeTweet } from "@/lib/twitter";
import { decrypt } from "@/lib/encryption";

/**
 * Process a new tweet: create interaction tasks for all active users.
 * Triggered by the Apify webhook when a team member posts a new tweet.
 */
export const processNewTweet = inngest.createFunction(
  {
    id: "process-new-tweet",
    name: "Process New Tweet",
    retries: 3,
    triggers: [{ event: "tweet/new" }],
  },
  async ({ event, step }) => {
    const { tweetId, authorHandle } = event.data;

    console.log(`[INNGEST] process-new-tweet fired for tweetId=${tweetId}, author=${authorHandle}`);

    // Get the tweet from DB
    const tweet = await step.run("fetch-tweet", async () => {
      const t = await prisma.tweet.findUnique({ where: { tweetId } });
      console.log(`[INNGEST] fetch-tweet: ${t ? "found" : "NOT FOUND"} (tweetId=${tweetId})`);
      return t;
    });

    if (!tweet) {
      console.log(`[INNGEST] Tweet not found, aborting.`);
      return { message: "Tweet not found" };
    }

    // Get all active & approved users (except the tweet author)
    const users = await step.run("fetch-active-users", async () => {
      const found = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          approved: true,
          xHandle: { not: authorHandle },
          xApiKey: { not: null },
          skillContent: { not: null },
        },
      });
      console.log(`[INNGEST] fetch-active-users: ${found.length} users found (excluding @${authorHandle})`);
      found.forEach((u) =>
        console.log(`  - ${u.displayName} (@${u.xHandle}) xUserId=${u.xUserId ? "✅" : "❌"}`)
      );
      return found;
    });

    if (users.length === 0) {
      console.log(`[INNGEST] No active users to process. Check: approved=true, status=ACTIVE, xApiKey!=null, skillContent!=null`);
      return { message: "No active users to process" };
    }

    // Create interaction records with random jitter delays (2-5 min per user)
    const interactions = await step.run("create-interactions", async () => {
      const results = [];
      for (const user of users) {
        // Random delay between 2 and 5 minutes to appear natural
        const delayMinutes = Math.floor(Math.random() * 4) + 2;
        const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        const interaction = await prisma.interaction.upsert({
          where: {
            userId_tweetId: {
              userId: user.id,
              tweetId: tweet.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            tweetId: tweet.id,
            status: "PENDING",
            scheduledAt,
          },
        });

        console.log(`[INNGEST] Interaction created: ${user.displayName} -> delay=${delayMinutes}m, id=${interaction.id}`);

        results.push({
          interactionId: interaction.id,
          userId: user.id,
          displayName: user.displayName,
          delayMinutes,
        });
      }
      return results;
    });

    // Send individual events for each user with their delay
    for (const interaction of interactions) {
      await step.sendEvent(`send-interaction-${interaction.userId}`, {
        name: "interaction/generate",
        data: {
          interactionId: interaction.interactionId,
          userId: interaction.userId,
          tweetDbId: tweet.id,
          delayMinutes: interaction.delayMinutes,
        },
      });
    }

    // Log to watcher_logs
    await step.run("log-processing", async () => {
      await prisma.watcherLog.create({
        data: {
          type: "inngest_process",
          message: `Inngest processed tweet by @${authorHandle}: ${interactions.length} interactions queued`,
          metadata: JSON.stringify({
            tweetId,
            authorHandle,
            users: interactions.map((i) => i.displayName),
            delays: interactions.map((i) => i.delayMinutes),
          }),
        },
      });
    });

    return {
      message: `Created ${interactions.length} interaction tasks`,
      interactions,
    };
  }
);

/**
 * Generate AI reply and send via Twitter API for a single user.
 * Each user gets their own function run with a random sleep delay.
 */
export const generateAndSendReply = inngest.createFunction(
  {
    id: "generate-and-send-reply",
    name: "Generate and Send Reply",
    retries: 2,
    concurrency: {
      limit: 2, // Max 2 concurrent Twitter API calls to avoid rate limits
    },
    triggers: [{ event: "interaction/generate" }],
  },
  async ({ event, step }) => {
    const { interactionId, userId, tweetDbId, delayMinutes } = event.data;

    console.log(`[INNGEST] generate-and-send-reply started: interactionId=${interactionId}, delay=${delayMinutes}m`);

    // Apply jitter delay — makes engagement look natural
    await step.sleep("jitter-delay", `${delayMinutes}m`);

    // Fetch user and tweet data
    const data = await step.run("fetch-data", async () => {
      const [user, tweet, interaction] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.tweet.findUnique({ where: { id: tweetDbId } }),
        prisma.interaction.findUnique({ where: { id: interactionId } }),
      ]);

      console.log(`[INNGEST] fetch-data: user=${user?.displayName || "NOT FOUND"}, tweet=${tweet?.tweetId || "NOT FOUND"}, interaction=${interaction?.status || "NOT FOUND"}`);

      return { user, tweet, interaction };
    });

    if (!data.user || !data.tweet || !data.interaction) {
      console.error(`[INNGEST] Data not found — user: ${!!data.user}, tweet: ${!!data.tweet}, interaction: ${!!data.interaction}`);
      return { error: "Data not found" };
    }

    if (data.interaction.status === "SENT") {
      console.log(`[INNGEST] Already sent, skipping.`);
      return { message: "Already sent" };
    }

    // Update status to GENERATING
    await step.run("update-status-generating", async () => {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { status: "GENERATING" },
      });
    });

    // Generate AI reply via Gemini
    const replyText = await step.run("generate-reply", async () => {
      console.log(`[INNGEST] Generating AI reply for ${data.user!.displayName} -> @${data.tweet!.authorHandle}`);
      const reply = await generateReply({
        displayName: data.user!.displayName,
        xHandle: data.user!.xHandle || data.user!.username,
        skillContent: data.user!.skillContent || "Samimi ve doğal bir ekip üyesi.",
        tweetAuthor: `@${data.tweet!.authorHandle}`,
        tweetContent: data.tweet!.content,
      });
      console.log(`[INNGEST] AI reply generated (${reply.length} chars): "${reply.substring(0, 80)}..."`);
      return reply;
    });

    // Save generated reply text
    await step.run("save-reply-text", async () => {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { replyText, status: "SCHEDULED" },
      });
    });

    // Small extra delay between generate and send (30s-90s) for natural pacing
    const extraDelay = Math.floor(Math.random() * 60) + 30;
    await step.sleep("pre-send-delay", `${extraDelay}s`);

    // Decrypt user credentials
    const credentials = await step.run("decrypt-credentials", async () => {
      if (
        !data.user!.xApiKey ||
        !data.user!.xApiSecret ||
        !data.user!.xAccessToken ||
        !data.user!.xAccessSecret
      ) {
        throw new Error(`Missing API credentials for ${data.user!.displayName}`);
      }

      return {
        apiKey: decrypt(data.user!.xApiKey),
        apiSecret: decrypt(data.user!.xApiSecret),
        accessToken: decrypt(data.user!.xAccessToken),
        accessSecret: decrypt(data.user!.xAccessSecret),
      };
    });

    // Send reply via Twitter API
    const replyResult = await step.run("send-reply", async () => {
      console.log(`[INNGEST] Sending reply to tweet ${data.tweet!.tweetId} as ${data.user!.displayName}`);
      return replyToTweet(credentials, data.tweet!.tweetId, replyText);
    });

    // Small delay between reply and like (15-45s)
    await step.sleep("reply-to-like-gap", `${Math.floor(Math.random() * 30) + 15}s`);

    // Like the tweet
    const likeResult = await step.run("like-tweet", async () => {
      if (!data.user!.xUserId) {
        console.warn(`[INNGEST] No xUserId for ${data.user!.displayName} — skipping like`);
        return { success: false, error: "No X user ID" };
      }
      console.log(`[INNGEST] Liking tweet ${data.tweet!.tweetId} as ${data.user!.displayName}`);
      return likeTweet(credentials, data.user!.xUserId, data.tweet!.tweetId);
    });

    // Update final status
    await step.run("update-final-status", async () => {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: {
          status: replyResult.success ? "SENT" : "FAILED",
          replyTweetId: replyResult.replyId || null,
          liked: likeResult.success,
          executedAt: new Date(),
          errorMessage: replyResult.success
            ? (likeResult.success ? null : `Like failed: ${likeResult.error}`)
            : replyResult.error || "Unknown error",
        },
      });

      console.log(`[INNGEST] Final status: reply=${replyResult.success ? "✅" : "❌"}, like=${likeResult.success ? "✅" : "❌"}, user=${data.user!.displayName}`);
    });

    return {
      success: replyResult.success,
      replyId: replyResult.replyId,
      liked: likeResult.success,
      error: replyResult.error,
    };
  }
);

export const inngestFunctions = [processNewTweet, generateAndSendReply];
