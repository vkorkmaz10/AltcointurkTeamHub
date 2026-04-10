import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReply } from "@/lib/gemini";
import { replyToTweet, likeTweet } from "@/lib/twitter";
import { decrypt } from "@/lib/encryption";

const ADMIN_SECRET = process.env.AUTH_SECRET;

/**
 * POST /api/manual-trigger
 * 
 * Inngest olmadan doğrudan test: Bir tweet URL/ID verin,
 * aktif kullanıcılar AI yanıt üretip göndersin.
 * 
 * Header: x-admin-secret: AUTH_SECRET değeri
 */
export async function POST(req: NextRequest) {
  // Auth kontrolü — AUTH_SECRET ile koruyoruz
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tweetId, tweetContent, tweetAuthor, dryRun = true } = body;

  console.log("[MANUAL-TRIGGER] Request received:", {
    tweetId,
    tweetAuthor,
    dryRun,
    contentLength: tweetContent?.length,
  });

  if (!tweetId || !tweetContent || !tweetAuthor) {
    return NextResponse.json({
      error: "Eksik alanlar",
      usage: {
        tweetId: "Twitter tweet ID (URL'den alınır)",
        tweetContent: "Tweet içeriği",
        tweetAuthor: "altcointurk (@ olmadan)",
        dryRun: "true = sadece AI yanıt üret, false = gerçekten gönder",
      },
    }, { status: 400 });
  }

  const log: Record<string, unknown>[] = [];

  try {
    // 1. Tweet'i DB'ye kaydet
    const tweet = await prisma.tweet.upsert({
      where: { tweetId },
      update: {},
      create: {
        tweetId,
        authorHandle: tweetAuthor.replace("@", ""),
        authorName: tweetAuthor,
        content: tweetContent,
        tweetUrl: `https://x.com/${tweetAuthor.replace("@", "")}/status/${tweetId}`,
        isOriginal: true,
      },
    });
    log.push({ step: "tweet_saved", tweetDbId: tweet.id });
    console.log("[MANUAL-TRIGGER] Tweet saved to DB:", tweet.id);

    // 2. Aktif kullanıcıları bul (tweet sahibi hariç)
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        approved: true,
        xHandle: { not: tweetAuthor.replace("@", "") },
        xApiKey: { not: null },
        skillContent: { not: null },
      },
    });

    log.push({
      step: "active_users",
      count: users.length,
      users: users.map((u) => ({
        name: u.displayName,
        handle: u.xHandle,
        hasXUserId: !!u.xUserId,
      })),
    });
    console.log(`[MANUAL-TRIGGER] Found ${users.length} active users:`,
      users.map((u) => `${u.displayName} (@${u.xHandle}, xUserId: ${u.xUserId ? "✅" : "❌"})`)
    );

    if (users.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Aktif, onaylı, API keyli ve skill'li kullanıcı yok.",
        log,
      });
    }

    const results = [];

    // 3. Her kullanıcı için AI yanıt üret
    for (const user of users) {
      const userResult: Record<string, unknown> = {
        user: user.displayName,
        handle: `@${user.xHandle}`,
      };

      try {
        // AI yanıt üret
        const aiReply = await generateReply({
          displayName: user.displayName,
          xHandle: user.xHandle || user.username,
          skillContent: user.skillContent || "Samimi ve doğal bir ekip üyesi.",
          tweetAuthor: `@${tweetAuthor.replace("@", "")}`,
          tweetContent,
        });
        userResult.aiReply = aiReply;

        // Etkileşim kaydı oluştur
        const interaction = await prisma.interaction.upsert({
          where: {
            userId_tweetId: { userId: user.id, tweetId: tweet.id },
          },
          update: { replyText: aiReply, status: dryRun ? "PENDING" : "SCHEDULED" },
          create: {
            userId: user.id,
            tweetId: tweet.id,
            replyText: aiReply,
            status: dryRun ? "PENDING" : "SCHEDULED",
            scheduledAt: new Date(),
          },
        });
        userResult.interactionId = interaction.id;

        if (!dryRun) {
          console.log(`[MANUAL-TRIGGER] LIVE mode — sending reply for ${user.displayName}`);
          // Gerçek gönderim
          const credentials = {
            apiKey: decrypt(user.xApiKey!),
            apiSecret: decrypt(user.xApiSecret!),
            accessToken: decrypt(user.xAccessToken!),
            accessSecret: decrypt(user.xAccessSecret!),
          };

          // Reply gönder
          const replyResult = await replyToTweet(credentials, tweetId, aiReply);
          userResult.replySent = replyResult.success;
          userResult.replyTweetId = replyResult.replyId;
          userResult.replyError = replyResult.error;
          console.log(`[MANUAL-TRIGGER] Reply result for ${user.displayName}:`, replyResult);

          // Like gönder
          let likeResult: { success: boolean; error?: string } = { success: false, error: "xUserId yok" };
          if (user.xUserId) {
            likeResult = await likeTweet(credentials, user.xUserId, tweetId);
            userResult.liked = likeResult.success;
            userResult.likeError = likeResult.error;
          } else {
            userResult.liked = false;
            userResult.likeError = "xUserId yok — API key doğrulaması yapılmalı";
          }

          // DB güncelle
          await prisma.interaction.update({
            where: { id: interaction.id },
            data: {
              status: replyResult.success ? "SENT" : "FAILED",
              replyTweetId: replyResult.replyId || null,
              liked: likeResult.success,
              executedAt: new Date(),
              errorMessage: replyResult.success
                ? (likeResult.success ? null : `Like hatası: ${likeResult.error}`)
                : replyResult.error || "Unknown error",
            },
          });
        }

        userResult.status = dryRun ? "DRY_RUN" : "SENT";
      } catch (err) {
        console.error(`[MANUAL-TRIGGER] Error for user ${user.displayName}:`, err);
        userResult.status = "ERROR";
        userResult.error = String(err);
      }

      results.push(userResult);
    }

    return NextResponse.json({
      success: true,
      mode: dryRun ? "DRY_RUN" : "LIVE",
      tweet: { id: tweetId, author: tweetAuthor, content: tweetContent },
      results,
      log,
    });
  } catch (error) {
    console.error("[MANUAL-TRIGGER] Error:", error);
    return NextResponse.json(
      { error: "Hata oluştu", details: String(error) },
      { status: 500 }
    );
  }
}
