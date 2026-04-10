import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingUsers, getAllUsers } from "@/actions/settings";
import { AdminActions } from "@/components/dashboard/admin-actions";

export default async function AdminPage() {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [pendingUsers, allUsers] = await Promise.all([
    getPendingUsers(),
    getAllUsers(),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Admin Panel</h1>
        <p className="text-text-muted mt-1">Kullanıcıları ve sistemi yönetin</p>
      </div>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="glass-card p-6 glow-brand">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <h2 className="text-lg font-semibold text-text-primary">
              Onay Bekleyenler ({pendingUsers.length})
            </h2>
          </div>

          <div className="space-y-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl border border-border"
              >
                <div>
                  <p className="font-medium text-text-primary">{user.displayName}</p>
                  <p className="text-sm text-text-muted">
                    @{user.username} · {user.email}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {new Date(user.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <AdminActions userId={user.id} type="pending" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Team Members */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            Ekip Üyeleri ({allUsers.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>X Handle</th>
                <th>API</th>
                <th>Skill</th>
                <th>Durum</th>
                <th>Etkileşim</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <p className="font-medium text-text-primary">{user.displayName}</p>
                      <p className="text-xs text-text-muted">@{user.username}</p>
                    </div>
                  </td>
                  <td>
                    {user.xHandle ? (
                      <span className="text-brand-primary">@{user.xHandle}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {user.xApiKey ? (
                      <span className="badge badge-sent">✓</span>
                    ) : (
                      <span className="badge badge-failed">✗</span>
                    )}
                  </td>
                  <td>
                    {user.skillContent ? (
                      <span className="badge badge-sent">✓</span>
                    ) : (
                      <span className="badge badge-failed">✗</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${user.status === "ACTIVE" ? "badge-active" : "badge-passive"}`}>
                      {user.status === "ACTIVE" ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="text-center">{user._count.interactions}</td>
                  <td>
                    <span className={`badge ${user.role === "ADMIN" ? "badge-generating" : "badge-passive"}`}>
                      {user.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
