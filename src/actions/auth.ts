"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function registerAction(formData: FormData) {
  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;
  const password = formData.get("password") as string;

  if (!email || !username || !displayName || !password) {
    return { error: "Tüm alanlar zorunludur." };
  }

  if (password.length < 6) {
    return { error: "Şifre en az 6 karakter olmalıdır." };
  }

  try {
    // Check if email or username already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      return {
        error:
          existing.email === email
            ? "Bu email zaten kayıtlı."
            : "Bu kullanıcı adı zaten alınmış.",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if this is the first user → make admin
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        password: hashedPassword,
        role: isFirstUser ? "ADMIN" : "MEMBER",
        approved: isFirstUser, // First user auto-approved
      },
    });

    return { success: true, isFirstUser };
  } catch (error) {
    console.error("Register error:", error);
    return {
      error:
        "Veritabanı bağlantı hatası. Lütfen DATABASE_URL ayarını kontrol edin.",
    };
  }
}

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Email veya şifre hatalı." };
        case "CallbackRouteError":
          return {
            error:
              "Giriş sırasında hata oluştu. Veritabanı bağlantısını kontrol edin.",
          };
        default:
          return { error: `Giriş hatası: ${error.type}` };
      }
    }
    // NEXT_REDIRECT throws an error that is NOT an AuthError, so we re-throw it
    throw error;
  }
}
