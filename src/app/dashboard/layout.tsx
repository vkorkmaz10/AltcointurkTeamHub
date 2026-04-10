import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { signOutAction } from "@/actions/signout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.approved) {
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
          <h2 className="text-xl font-bold text-text-primary mb-2">Onay Bekleniyor</h2>
          <p className="text-text-secondary text-sm mb-4">
            Hesabınız henüz admin tarafından onaylanmadı.
            Onaylandığında dashboard&apos;a erişebileceksiniz.
          </p>
          <p className="text-text-muted text-xs">
            Hoş geldin, {session.user.name} 👋
          </p>
          <form action={signOutAction}>
            <button type="submit" className="btn-secondary mt-6">
              Çıkış Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
          name: session.user.name || "",
          role: session.user.role,
          xHandle: session.user.xHandle,
        }}
      />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
