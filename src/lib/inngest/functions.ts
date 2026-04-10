import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { generateReply } from "@/lib/gemini";
import { replyToTweet, likeTweet } from "@/lib/twitter";
import { decrypt } from "@/lib/encryption";

/**
 * Process a new tweet: create interaction tasks for all active users
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

    // Get the tweet from DB
    const tweet = await step.run("fetch-tweet", async () => {
      return prisma.tweet.findUnique({ where: { tweetId } });
    });

    if (!tweet) {
      return { message: "Tweet not found" };
    }

    // Get all active & approved users (except the tweet author)
    const users = await step.run("fetch-active-users", async () => {
      return prisma.user.findMany({
        where: {
          status: "ACTIVE",
          approved: true,
          xHandle: { not: authorHandle },
          xApiKey: { not: null },
          skillContent: { not: null },
        },
      });
    });

    if (users.length === 0) {
      return { message: "No active users to process" };
    }

    // Create interaction records with random jitter delays
    const interactions = await step.run("create-interactions", async () => {
      const results = [];
      for (const user of users) {
        // Random delay between 1 and 15 minutes
        const delayMinutes = Math.floor(Math.random() * 14) + 1;
        const scheduledAt = new Date(
          Date.now() + delayMinutes * 60 * 1000
        );

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

        results.push({
          interactionId: interaction.id,
          userId: user.id,
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

    return {
      message: `Created ${interactions.length} interaction tasks`,
      interactions,
    };
  }
);

/**
 * Generate AI reply and send via Twitter API for a single user
 */
export const generateAndSendReply = inngest.createFunction(
  {
    id: "generate-and-send-reply",
    name: "Generate and Send Reply",
    retries: 3,
    concurrency: {
      limit: 2,
    },
    triggers: [{ event: "interaction/generate" }],
  },
  async ({ event, step }) => {
    const { interactionId, userId, tweetDbId, delayMinutes } = event.data;

    // Apply jitter delay
    await step.sleep("jitter-delay", `${delayMinutes}m`);

    // Fetch user and tweet data
    const data = await step.run("fetch-data", async () => {
      const [user, tweet, interaction] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.tweet.findUnique({ where: { id: tweetDbId } }),
        prisma.interaction.findUnique({ where: { id: interactionId } }),
      ]);
      return { user, tweet, interaction };
    });

    if (!data.user || !data.tweet || !data.interaction) {
      return { error: "Data not found" };
    }

    if (data.interaction.status === "SENT") {
      return { message: "Already sent" };
    }

    // Update status to GENERATING
    await step.run("update-status-generating", async () => {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { status: "GENERATING" },
      });
    });

    // Generate AI reply
    const replyText = await step.run("generate-reply", async () => {
      return generateReply({
        displayName: data.user!.displayName,
        xHandle: data.user!.xHandle || data.user!.username,
        skillContent: data.user!.skillContent || "Samimi ve doğal bir ekip üyesi.",
        tweetAuthor: `@${data.tweet!.authorHandle}`,
        tweetContent: data.tweet!.content,
      });
    });

    // Update with generated reply text
    await step.run("save-reply-text", async () => {
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { replyText, status: "SCHEDULED" },
      });
    });

    // Decrypt user credentials
    const credentials = await step.run("decrypt-credentials", async () => {
      if (
        !data.user!.xApiKey ||
        !data.user!.xApiSecret ||
        !data.user!.xAccessToken ||
        !data.user!.xAccessSecret
      ) {
        throw new Error("Missing API credentials");
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
      return replyToTweet(credentials, data.tweet!.tweetId, replyText);
    });

    // Like the tweet
    const likeResult = await step.run("like-tweet", async () => {
      if (!data.user!.xUserId) {
        return { success: false, error: "No X user ID" };
      }
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
            ? null
            : replyResult.error || "Unknown error",
        },
      });
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
