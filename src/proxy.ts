import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const session = await auth();

  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = request.nextUrl.pathname === "/login";
  const isOnRegister = request.nextUrl.pathname === "/register";

  if (isOnDashboard && !session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session?.user && (isOnLogin || isOnRegister)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
