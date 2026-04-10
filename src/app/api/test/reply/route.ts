import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReply } from "@/lib/gemini";
import { replyToTweet, likeTweet } from "@/lib/twitter";
import { decrypt } from "@/lib/encryption";

// POST /api/test/reply — Tek bir tweet'e manuel AI yanıt üret ve gönder
// Inngest OLMADAN direkt test eder
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test endpoint sadece dev ortamında çalışır" }, { status: 403 });
  }

  const body = await request.json();
  const { tweetId, tweetContent, tweetAuthor, userId, dryRun = true } = body;

  if (!tweetContent || !userId) {
    return NextResponse.json({
      error: "Eksik alanlar",
      usage: {
        method: "POST",
        body: {
          tweetId: "TWEET_ID_NUMARASI (opsiyonel - gerçek gönderim için gerekli)",
          tweetContent: "Tweet içeriği buraya",
          tweetAuthor: "@kullanici",
          userId: "DB'deki kullanıcı ID'si",
          dryRun: true,
        },
      },
      help: "Kullanıcı listesi için GET /api/test/trigger'ı kontrol edin",
    }, { status: 400 });
  }

  const steps: Record<string, unknown>[] = [];

  try {
    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }
    steps.push({ step: "1_user", status: "✅", detail: `${user.displayName} (@${user.xHandle})` });

    // 2. Skill kontrolü
    if (!user.skillContent) {
      return NextResponse.json({
        error: "Kullanıcının skill dosyası yok. Skill Builder'dan oluşturun.",
        steps,
      }, { status: 400 });
    }
    steps.push({ step: "2_skill", status: "✅", detail: `Skill var (${user.skillContent.length} karakter)` });

    // 3. Gemini ile AI yanıt üret
    if (!process.env.GEMINI_API_KEY) {
      steps.push({ step: "3_gemini", status: "❌", detail: "GEMINI_API_KEY .env dosyasında tanımlı değil" });
      return NextResponse.json({
        error: "GEMINI_API_KEY .env dosyasında tanımlı değil",
        steps,
      }, { status: 500 });
    }

    let aiReply: string;
    try {
      aiReply = await generateReply({
        displayName: user.displayName,
        xHandle: user.xHandle || "user",
        skillContent: user.skillContent,
        tweetAuthor: tweetAuthor || "bilinmiyor",
        tweetContent,
      });
      steps.push({ step: "3_ai_reply", status: "✅", detail: aiReply });
    } catch (geminiErr) {
      steps.push({ step: "3_ai_reply", status: "❌", detail: `Gemini hatası: ${geminiErr}` });
      return NextResponse.json({ error: "AI yanıt üretilemedi", steps, details: String(geminiErr) }, { status: 500 });
    }

    // 4. API key kontrolü
    if (!user.xApiKey || !user.xApiSecret || !user.xAccessToken || !user.xAccessSecret) {
      steps.push({ step: "4_api_keys", status: "⚠️", detail: "X API anahtarları eksik — yanıt gönderilemez" });
      return NextResponse.json({
        success: true,
        mode: "AI_ONLY",
        message: "AI yanıt üretildi ama X API anahtarları eksik — gönderilemedi",
        aiReply,
        steps,
      });
    }
    steps.push({ step: "4_api_keys", status: "✅", detail: "X API anahtarları mevcut" });

    // 5. DRY RUN kontrolü
    if (dryRun) {
      steps.push({ step: "5_send", status: "⏸️", detail: "DRY RUN — göndermedi" });
      return NextResponse.json({
        success: true,
        mode: "DRY_RUN",
        aiReply,
        tweetContent,
        tweetAuthor,
        user: user.displayName,
        steps,
        hint: "Gerçek gönderim için body'ye \"dryRun\": false ekleyin",
      });
    }

    // 6. Gerçek gönderim
    if (!tweetId) {
      return NextResponse.json({
        error: "Gerçek gönderim için tweetId gerekli",
        aiReply,
        steps,
      }, { status: 400 });
    }

    const credentials = {
      apiKey: decrypt(user.xApiKey),
      apiSecret: decrypt(user.xApiSecret!),
      accessToken: decrypt(user.xAccessToken!),
      accessSecret: decrypt(user.xAccessSecret!),
    };

    // Reply
    const replyResult = await replyToTweet(credentials, tweetId, aiReply);
    steps.push({
      step: "5_reply",
      status: replyResult.success ? "✅" : "❌",
      detail: replyResult.success ? `Reply gönderildi: ${replyResult.replyId}` : `Hata: ${replyResult.error}`,
    });

    // Like
    let likeResult: { success: boolean; error?: string } = { success: false, error: "xUserId yok" };
    if (user.xUserId) {
      likeResult = await likeTweet(credentials, user.xUserId, tweetId);
      steps.push({
        step: "6_like",
        status: likeResult.success ? "✅" : "⚠️",
        detail: likeResult.success ? "Tweet beğenildi" : `Like hatası: ${likeResult.error}`,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "LIVE",
      aiReply,
      replyTweetId: replyResult.replyId,
      liked: likeResult.success,
      steps,
    });

  } catch (error) {
    steps.push({ step: "error", status: "❌", detail: String(error) });
    return NextResponse.json({ error: "Hata oluştu", steps, details: String(error) }, { status: 500 });
  }
}
