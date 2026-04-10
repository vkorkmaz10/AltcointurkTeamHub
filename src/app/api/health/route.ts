import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health — Veritabanı ve sistem sağlık kontrolü
export async function GET() {
  const checks: Record<string, string> = {};

  // 1. ENV kontrolu
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "✅ set" : "❌ missing";
  checks.DATABASE_URL = process.env.DATABASE_URL
    ? `✅ set (${process.env.DATABASE_URL.substring(0, 30)}...)`
    : "❌ missing";
  checks.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? "✅ set" : "❌ missing";
  checks.GEMINI_API_KEY = process.env.GEMINI_API_KEY ? "✅ set" : "❌ missing";
  checks.NODE_ENV = process.env.NODE_ENV || "unknown";

  // 2. DB bağlantı testi
  try {
    const userCount = await prisma.user.count();
    checks.database = `✅ connected (${userCount} users)`;
  } catch (error) {
    checks.database = `❌ connection failed: ${String(error).substring(0, 200)}`;
  }

  // 3. Prisma provider kontrolu
  try {
    // Simple raw query to verify connection
    await prisma.$queryRaw`SELECT 1 as ok`;
    checks.db_query = "✅ query works";
  } catch (error) {
    checks.db_query = `❌ query failed: ${String(error).substring(0, 200)}`;
  }

  const allOk = !Object.values(checks).some((v) => v.startsWith("❌"));

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 500 }
  );
}
