"use client";

import { useState, useEffect } from "react";
import { saveApiKeys, getApiKeyStatus, toggleUserStatus } from "@/actions/settings";

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState({
    xApiKey: "",
    xApiSecret: "",
    xAccessToken: "",
    xAccessSecret: "",
  });
  const [status, setStatus] = useState<{ hasKeys: boolean; xHandle: string | null; xUserId: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getApiKeyStatus().then(setStatus);
  }, []);

  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const result = await saveApiKeys(apiKeys);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: `API bağlantısı başarılı! @${result.username}` });
      setApiKeys({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });
      getApiKeyStatus().then(setStatus);
    }
    setSaving(false);
  }

  async function handleToggleStatus() {
    const result = await toggleUserStatus();
    if (result.success) {
      setMessage({ type: "success", text: `Durumunuz: ${result.status}` });
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Ayarlar</h1>
        <p className="text-text-muted mt-1">X API anahtarlarınızı ve hesap ayarlarınızı yönetin</p>
      </div>

      {/* Connection Status */}
      {status && (
        <div className={`glass-card p-6 ${status.hasKeys ? "glow-success" : ""}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status.hasKeys ? "bg-success" : "bg-text-muted"}`} />
              <div>
                <p className="font-medium text-text-primary">
                  {status.hasKeys ? "X API Bağlı" : "X API Bağlı Değil"}
                </p>
                {status.xHandle && (
                  <p className="text-sm text-text-muted">@{status.xHandle}</p>
                )}
              </div>
            </div>
            <button onClick={handleToggleStatus} className="btn-secondary text-xs">
              Aktif/Pasif Değiştir
            </button>
          </div>
        </div>
      )}

      {/* API Keys Form */}
      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-text-primary mb-1">X (Twitter) API Anahtarları</h2>
        <p className="text-sm text-text-muted mb-6">
          Anahtarlarınız AES-256 ile şifrelenerek saklanır. Developer Portal&apos;dan alabilirsiniz.
        </p>

        <form onSubmit={handleSaveKeys} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder="Gizli"
                value={apiKeys.xApiKey}
                onChange={(e) => setApiKeys({ ...apiKeys, xApiKey: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="input-label">API Secret</label>
              <input
                type="password"
                className="input-field"
                placeholder="Gizli"
                value={apiKeys.xApiSecret}
                onChange={(e) => setApiKeys({ ...apiKeys, xApiSecret: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="input-label">Access Token</label>
              <input
                type="password"
                className="input-field"
                placeholder="Gizli"
                value={apiKeys.xAccessToken}
                onChange={(e) => setApiKeys({ ...apiKeys, xAccessToken: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="input-label">Access Secret</label>
              <input
                type="password"
                className="input-field"
                placeholder="Gizli"
                value={apiKeys.xAccessSecret}
                onChange={(e) => setApiKeys({ ...apiKeys, xAccessSecret: e.target.value })}
                required
              />
            </div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-success/10 border border-success/20 text-success"
                  : "bg-error/10 border border-error/20 text-error"
              }`}
            >
              {message.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Doğrulanıyor..." : "Kaydet ve Doğrula"}
          </button>
        </form>
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-3">📚 API Anahtarı Nasıl Alınır?</h3>
        <ol className="space-y-2 text-sm text-text-secondary">
          <li>1. <a href="https://developer.x.com" target="_blank" rel="noopener" className="text-brand-primary hover:underline">developer.x.com</a>&apos;a gidin</li>
          <li>2. Yeni bir uygulama oluşturun (Free tier yeterli)</li>
          <li>3. <strong>Read and Write</strong> izinlerini aktif edin</li>
          <li>4. Keys and Tokens sekmesinden değerleri kopyalayın</li>
          <li>5. Yukarıdaki forma yapıştırın</li>
        </ol>
      </div>
    </div>
  );
}
