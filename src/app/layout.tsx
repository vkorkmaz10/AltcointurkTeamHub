import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Altcointurk Team Hub",
  description:
    "Autonomous Engagement Suite — AI destekli otomatik ekip etkileşim yönetim paneli",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${inter.variable} dark`}>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
