"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAction } from "@/actions/auth";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await registerAction(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.success) {
      if (result.isFirstUser) {
        // First user is auto-approved, redirect to login
        router.push("/login");
      } else {
        setSuccess(true);
      }
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-10 max-w-md text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-warning" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Kayıt Başarılı!</h2>
          <p className="text-text-secondary text-sm mb-6">
            Hesabınız oluşturuldu. Admin onayı bekleniyor.
            Onaylandıktan sonra giriş yapabilirsiniz.
          </p>
          <Link href="/login" className="btn-primary">
            Giriş Sayfasına Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 right-1/3 w-72 h-72 bg-brand-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center mx-auto glow-brand">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Hesap Oluştur</h1>
          <p className="text-text-muted text-sm mt-1">Altcointurk Team Hub&apos;a katılın</p>
        </div>

        {/* Form */}
        <div className="glass-card p-8">
          <form action={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="input-label">Görünen Ad</label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                className="input-field"
                placeholder="Volkan Korkmaz"
              />
            </div>

            <div>
              <label htmlFor="username" className="input-label">Kullanıcı Adı</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input-field"
                placeholder="vkorkmaz"
              />
            </div>

            <div>
              <label htmlFor="email" className="input-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input-field"
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="input-label">Şifre</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="input-field"
                placeholder="En az 6 karakter"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  Kayıt yapılıyor...
                </span>
              ) : (
                "Kayıt Ol"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="text-brand-primary hover:text-brand-secondary transition-colors font-medium">
                Giriş Yap
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-text-muted text-xs mt-4">
          Kaydınız admin onayına tabidir.
        </p>
      </div>
    </div>
  );
}
