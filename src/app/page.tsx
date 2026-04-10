import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto px-6 animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center glow-brand">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          <span className="gradient-text">Altcointurk</span>{" "}
          <span className="text-text-primary">Team Hub</span>
        </h1>

        <p className="text-text-secondary text-lg mb-2">
          Autonomous Engagement Suite
        </p>
        <p className="text-text-muted text-sm mb-10 max-w-md mx-auto">
          AI destekli otomatik ekip etkileşim yönetim paneli.
          Her ekip üyesi kendi kişiliğiyle, kendi API&apos;siyle.
        </p>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="btn-primary text-base px-8 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Giriş Yap
          </Link>
          <Link href="/register" className="btn-secondary text-base px-8 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Kayıt Ol
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-3 gap-6">
          {[
            { icon: "🤖", label: "AI Yanıtlar", desc: "Gemini ile kişiselleştirilmiş" },
            { icon: "⚡", label: "Otomatik", desc: "10dk aralıklarla izleme" },
            { icon: "🛡️", label: "Güvenli", desc: "AES-256 şifreleme" },
          ].map((feature) => (
            <div key={feature.label} className="glass-card p-4 text-center">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-sm font-medium text-text-primary">{feature.label}</div>
              <div className="text-xs text-text-muted mt-1">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
