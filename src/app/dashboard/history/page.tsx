import { getRecentInteractions } from "@/actions/settings";

export default async function HistoryPage() {
  const interactions = await getRecentInteractions(50);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Etkileşim Geçmişi</h1>
          <p className="text-text-muted mt-1">Tüm otomatik yanıtların kaydı</p>
        </div>
        <span className="badge badge-sent">{interactions.length} kayıt</span>
      </div>

      {interactions.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Henüz kayıt yok</h3>
          <p className="text-text-muted text-sm">Etkileşimler başladığında burada listelenecek.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Tweet Sahibi</th>
                  <th>Yanıt</th>
                  <th>Durum</th>
                  <th>Beğeni</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map((interaction) => (
                  <tr key={interaction.id}>
                    <td>
                      <span className="font-medium text-brand-primary">
                        @{interaction.user.xHandle || interaction.user.username}
                      </span>
                    </td>
                    <td>
                      <span className="text-brand-accent">
                        @{interaction.tweet.authorHandle}
                      </span>
                    </td>
                    <td>
                      <p className="max-w-xs truncate text-text-secondary">
                        {interaction.replyText || "—"}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          {
                            SENT: "badge-sent",
                            PENDING: "badge-pending",
                            FAILED: "badge-failed",
                            GENERATING: "badge-generating",
                            SCHEDULED: "badge-pending",
                            SKIPPED: "badge-passive",
                          }[interaction.status] || "badge-passive"
                        }`}
                      >
                        {interaction.status}
                      </span>
                    </td>
                    <td>{interaction.liked ? "❤️" : "—"}</td>
                    <td className="text-xs whitespace-nowrap">
                      {new Date(interaction.createdAt).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
