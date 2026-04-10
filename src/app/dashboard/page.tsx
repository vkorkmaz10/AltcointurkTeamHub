import { getDashboardStats, getRecentInteractions } from "@/actions/settings";

function StatusBadge({ status }: { status: string }) {
  const badgeClass = {
    SENT: "badge-sent",
    PENDING: "badge-pending",
    FAILED: "badge-failed",
    GENERATING: "badge-generating",
    SCHEDULED: "badge-pending",
    SKIPPED: "badge-passive",
  }[status] || "badge-passive";

  const label = {
    SENT: "Gönderildi",
    PENDING: "Bekliyor",
    FAILED: "Başarısız",
    GENERATING: "Üretiliyor",
    SCHEDULED: "Zamanlandı",
    SKIPPED: "Atlandı",
  }[status] || status;

  return <span className={`badge ${badgeClass}`}>{label}</span>;
}

export default async function DashboardPage() {
  const [stats, interactions] = await Promise.all([
    getDashboardStats(),
    getRecentInteractions(15),
  ]);

  const statCards = [
    {
      label: "Bugün",
      value: stats?.todayInteractions || 0,
      icon: "📊",
      color: "from-brand-primary/20 to-brand-accent/20",
    },
    {
      label: "Bu Hafta",
      value: stats?.weekInteractions || 0,
      icon: "📈",
      color: "from-success/20 to-brand-accent/20",
    },
    {
      label: "Toplam",
      value: stats?.totalInteractions || 0,
      icon: "🏆",
      color: "from-brand-secondary/20 to-brand-primary/20",
    },
    {
      label: "Aktif Üyeler",
      value: stats?.activeUsers || 0,
      icon: "👥",
      color: "from-info/20 to-brand-primary/20",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-muted mt-1">Ekip etkileşimlerini izleyin</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              {stats?.pendingCount && stats.pendingCount > 0 && stat.label === "Bugün" && (
                <span className="badge badge-pending text-xs">{stats.pendingCount} bekliyor</span>
              )}
            </div>
            <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
            <p className="text-sm text-text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Interactions Feed */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-4">Son Etkileşimler</h2>
        
        {interactions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-lg font-medium text-text-primary mb-2">Henüz etkileşim yok</h3>
            <p className="text-text-muted text-sm">
              Sistem yeni tweetleri izlemeye başladığında etkileşimler burada görünecek.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interactions.map((interaction, i) => (
              <div
                key={interaction.id}
                className="feed-card"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Who replied to whom */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-medium text-brand-primary">
                        @{interaction.user.xHandle || interaction.user.username}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-text-muted shrink-0" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="text-sm font-medium text-brand-accent">
                        @{interaction.tweet.authorHandle}
                      </span>
                      <StatusBadge status={interaction.status} />
                    </div>

                    {/* Original tweet */}
                    <p className="text-sm text-text-muted mb-2 line-clamp-2">
                      💬 {interaction.tweet.content}
                    </p>

                    {/* Reply */}
                    {interaction.replyText && (
                      <p className="text-sm text-text-secondary bg-bg-elevated rounded-lg p-3">
                        ↪️ {interaction.replyText}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-muted">
                      {new Date(interaction.createdAt).toLocaleString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                    {interaction.liked && (
                      <span className="text-xs text-error">❤️</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
