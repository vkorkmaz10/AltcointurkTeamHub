"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { verifyCredentials } from "@/lib/twitter";
import { generateSkillProfile } from "@/lib/gemini";
import { revalidatePath } from "next/cache";

interface SaveApiKeysInput {
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessSecret: string;
}

export async function saveApiKeys(data: SaveApiKeysInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Oturum bulunamadı." };
  }

  try {
    // Verify credentials with 8s timeout (Vercel free = 10s limit)
    const verificationPromise = verifyCredentials({
      apiKey: data.xApiKey,
      apiSecret: data.xApiSecret,
      accessToken: data.xAccessToken,
      accessSecret: data.xAccessSecret,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Twitter API doğrulaması zaman aşımına uğradı (8s)")), 8000)
    );

    const verification = await Promise.race([verificationPromise, timeoutPromise]);

    if (!verification.success) {
      return { error: `API doğrulama başarısız: ${verification.error}` };
    }

    // Encrypt and save
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        xApiKey: encrypt(data.xApiKey),
        xApiSecret: encrypt(data.xApiSecret),
        xAccessToken: encrypt(data.xAccessToken),
        xAccessSecret: encrypt(data.xAccessSecret),
        xUserId: verification.userId,
        xHandle: verification.username,
      },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, username: verification.username };
  } catch (error) {
    console.error("[SETTINGS] saveApiKeys error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Hata: ${message}` };
  }
}

export async function getApiKeyStatus() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      xApiKey: true,
      xHandle: true,
      xUserId: true,
    },
  });

  return {
    hasKeys: !!user?.xApiKey,
    xHandle: user?.xHandle || null,
    xUserId: user?.xUserId || null,
  };
}

export async function saveSkillContent(content: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Oturum bulunamadı." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { skillContent: content },
  });

  revalidatePath("/dashboard/skill-builder");
  return { success: true };
}

export async function generateSkill(data: {
  description: string;
  style: string[];
  expertise: string[];
  bannedWords: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Oturum bulunamadı." };
  }

  const skillContent = await generateSkillProfile(data);
  return { success: true, skillContent };
}

export async function getSkillContent() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { skillContent: true },
  });

  return user?.skillContent || null;
}

export async function toggleUserStatus() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Oturum bulunamadı." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });

  if (!user) return { error: "Kullanıcı bulunamadı." };

  const newStatus = user.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { status: newStatus },
  });

  revalidatePath("/dashboard");
  return { success: true, status: newStatus };
}

// ── Admin Actions ──────────────────────────────────────

export async function approveUser(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Yetkiniz yok." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { approved: true },
  });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

export async function rejectUser(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: "Yetkiniz yok." };
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/dashboard/admin");
  return { success: true };
}

export async function getPendingUsers() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return [];
  }

  return prisma.user.findMany({
    where: { approved: false },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllUsers() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return [];
  }

  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      xHandle: true,
      status: true,
      approved: true,
      role: true,
      xApiKey: true,
      skillContent: true,
      createdAt: true,
      _count: {
        select: { interactions: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRecentInteractions(limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.interaction.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          displayName: true,
          xHandle: true,
          username: true,
        },
      },
      tweet: {
        select: {
          authorHandle: true,
          authorName: true,
          content: true,
          tweetUrl: true,
        },
      },
    },
  });
}

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalInteractions, todayInteractions, weekInteractions, activeUsers, pendingCount] =
    await Promise.all([
      prisma.interaction.count({ where: { status: "SENT" } }),
      prisma.interaction.count({
        where: { status: "SENT", executedAt: { gte: todayStart } },
      }),
      prisma.interaction.count({
        where: { status: "SENT", executedAt: { gte: weekStart } },
      }),
      prisma.user.count({ where: { status: "ACTIVE", approved: true } }),
      prisma.interaction.count({ where: { status: "PENDING" } }),
    ]);

  return {
    totalInteractions,
    todayInteractions,
    weekInteractions,
    activeUsers,
    pendingCount,
  };
}
