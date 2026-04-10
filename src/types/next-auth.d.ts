import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      approved: boolean;
      xHandle: string | null;
      status: "ACTIVE" | "PASSIVE";
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "MEMBER";
    approved: boolean;
    xHandle: string | null;
    status: "ACTIVE" | "PASSIVE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "MEMBER";
    approved: boolean;
    xHandle: string | null;
    status: "ACTIVE" | "PASSIVE";
  }
}
