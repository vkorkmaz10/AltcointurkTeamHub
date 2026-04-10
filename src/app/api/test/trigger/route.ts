import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

// POST /api/test/trigger — Manuel test tetikleyici
// Sadece development ortamında çalışır
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test endpoint sadece dev ortamında çalışır" }, { status: 403 });
  }

  const body = await request.json();
  const { tweetId, authorHandle, authorName, content, tweetUrl } = body;

  if (!tweetId || !authorHandle || !content) {
    return NextResponse.json(
      {
        error: "Eksik alanlar",
        usage: {
          method: "POST",
          body: {
            tweetId: "1234567890",
            authorHandle: "altcointurk",
            authorName: "Altcointurk",
            content: "Bitcoin yeni ATH yapabilir mi? 🚀",
            tweetUrl: "https://x.com/altcointurk/status/1234567890",
          },
        },
      },
      { status: 400 }
    );
  }

  try {
    // 1. Tweet'i DB'ye kaydet
    const tweet = await prisma.tweet.upsert({
      where: { tweetId },
      update: {},
      create: {
        tweetId,
        authorHandle,
        authorName: authorName || authorHandle,
        content,
        tweetUrl: tweetUrl || `https://x.com/${authorHandle}/status/${tweetId}`,
        isOriginal: true,
      },
    });

    // 2. Aktif kullanıcıları kontrol et
    const activeUsers = await prisma.user.findMany({
      where: {
        approved: true,
        status: "ACTIVE",
        xApiKey: { not: null },
        skillContent: { not: null },
      },
      select: { id: true, displayName: true, xHandle: true },
    });

    // 3. Inngest event gönder
    let inngestResult = null;
    try {
      inngestResult = await inngest.send({
        name: "tweet/new",
        data: {
          tweetId: tweet.tweetId,
          tweetDbId: tweet.id,
          authorHandle,
          content,
        },
      });
    } catch (inngestError) {
      inngestResult = {
        error: "Inngest event gönderilemedi. Inngest dev server çalışıyor mu?",
        details: String(inngestError),
        help: "Terminal'de 'npx inngest-cli@latest dev' çalıştırın",
      };
    }

    return NextResponse.json({
      success: true,
      message: "Test tweet oluşturuldu ve işleme gönderildi",
      tweet: {
        id: tweet.id,
        tweetId: tweet.tweetId,
        content: tweet.content,
      },
      activeUsers: activeUsers.length > 0
        ? activeUsers.map((u) => ({
            name: u.displayName,
            xHandle: u.xHandle,
            hasApiKey: true,
            hasSkill: true,
          }))
        : {
            count: 0,
            warning:
              "Hiçbir kullanıcı aktif değil veya API key/skill eksik. Ayarlar sayfasından tamamlayın.",
          },
      inngest: inngestResult,
    });
  } catch (error) {
    console.error("Test trigger error:", error);
    return NextResponse.json(
      { error: "Test tetiklenirken hata oluştu", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/test/trigger — Durum kontrolü
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test endpoint sadece dev ortamında çalışır" }, { status: 403 });
  }

  const [userCount, tweetCount, interactionCount, activeUsers] = await Promise.all([
    prisma.user.count(),
    prisma.tweet.count(),
    prisma.interaction.count(),
    prisma.user.findMany({
      where: { approved: true, status: "ACTIVE" },
      select: {
        id: true,
        displayName: true,
        xHandle: true,
        xApiKey: true,
        skillContent: true,
        _count: { select: { interactions: true } },
      },
    }),
  ]);

  return NextResponse.json({
    status: "ok",
    summary: {
      users: userCount,
      tweets: tweetCount,
      interactions: interactionCount,
    },
    users: activeUsers.map((u) => ({
      name: u.displayName,
      xHandle: u.xHandle || "—",
      hasApiKey: !!u.xApiKey,
      hasSkill: !!u.skillContent,
      interactions: u._count.interactions,
      ready: !!u.xApiKey && !!u.skillContent,
    })),
    checklist: {
      "1_db": "✅ Veritabanı bağlı",
      "2_users": userCount > 0 ? "✅ Kullanıcı var" : "❌ Kullanıcı yok — kayıt olun",
      "3_apiKeys": activeUsers.some((u) => u.xApiKey)
        ? "✅ En az 1 kullanıcıda API key var"
        : "❌ Hiçbir kullanıcıda API key yok — Ayarlar'dan girin",
      "4_skills": activeUsers.some((u) => u.skillContent)
        ? "✅ En az 1 kullanıcıda skill var"
        : "❌ Hiçbir kullanıcıda skill yok — Skill Builder'dan oluşturun",
      "5_gemini": process.env.GEMINI_API_KEY ? "✅ Gemini API Key var" : "❌ GEMINI_API_KEY .env'de boş",
      "6_inngest": "⚠️ npx inngest-cli@latest dev çalıştırın",
    },
  });
}
