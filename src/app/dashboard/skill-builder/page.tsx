"use client";

import { useState, useEffect } from "react";
import { saveSkillContent, generateSkill, getSkillContent } from "@/actions/settings";

const STYLE_OPTIONS = [
  { id: "samimi", label: "Samimi", emoji: "🤗" },
  { id: "teknik", label: "Teknik", emoji: "🔬" },
  { id: "esprili", label: "Esprili", emoji: "😄" },
  { id: "kisa", label: "Kısa & Öz", emoji: "⚡" },
  { id: "detayli", label: "Detaylı", emoji: "📝" },
  { id: "motivasyonel", label: "Motivasyonel", emoji: "🚀" },
  { id: "analitik", label: "Analitik", emoji: "📊" },
];

const EXPERTISE_OPTIONS = [
  { id: "defi", label: "DeFi" },
  { id: "nft", label: "NFT" },
  { id: "trading", label: "Trading" },
  { id: "makro", label: "Makro Ekonomi" },
  { id: "teknoloji", label: "Blockchain Teknolojisi" },
  { id: "layer2", label: "Layer 2" },
  { id: "mining", label: "Mining" },
  { id: "regulation", label: "Regülasyon" },
  { id: "altcoin", label: "Altcoin Analiz" },
  { id: "bitcoin", label: "Bitcoin Maximalist" },
];

export default function SkillBuilderPage() {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [description, setDescription] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [bannedWords, setBannedWords] = useState("");
  const [skillContent, setSkillContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSkillContent().then((content) => {
      if (content) setSkillContent(content);
    });
  }, []);

  function toggleStyle(id: string) {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleExpertise(id: string) {
    setSelectedExpertise((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!description) {
      setMessage({ type: "error", text: "Lütfen kendinizi tanımlayın." });
      return;
    }
    setGenerating(true);
    setMessage(null);

    const result = await generateSkill({
      description,
      style: selectedStyles.map(
        (id) => STYLE_OPTIONS.find((s) => s.id === id)?.label || id
      ),
      expertise: selectedExpertise.map(
        (id) => EXPERTISE_OPTIONS.find((s) => s.id === id)?.label || id
      ),
      bannedWords: bannedWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
    });

    if (result.skillContent) {
      setSkillContent(result.skillContent);
      setMode("manual"); // Switch to manual to see & edit
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!skillContent.trim()) {
      setMessage({ type: "error", text: "Skill içeriği boş olamaz." });
      return;
    }
    setSaving(true);
    const result = await saveSkillContent(skillContent);
    if (result.success) {
      setMessage({ type: "success", text: "Skill dosyanız kaydedildi! ✨" });
    } else {
      setMessage({ type: "error", text: result.error || "Hata oluştu." });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Skill Builder</h1>
        <p className="text-text-muted mt-1">
          AI&apos;ın sizi nasıl temsil edeceğini tanımlayın
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("ai")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "ai"
              ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
              : "bg-bg-card text-text-muted border border-border hover:text-text-primary"
          }`}
        >
          🤖 AI Destekli
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
              : "bg-bg-card text-text-muted border border-border hover:text-text-primary"
          }`}
        >
          ✏️ Manuel
        </button>
      </div>

      {/* AI Mode */}
      {mode === "ai" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <label className="input-label text-base mb-2">
              Kendinizi tanımlayın
            </label>
            <p className="text-xs text-text-muted mb-3">
              &quot;Nasıl biri gibi görünmek istersiniz?&quot; sorusunu cevaplayın.
            </p>
            <textarea
              className="input-field min-h-[100px] resize-y"
              placeholder="Örn: Türkiye'nin önde gelen kripto analistlerinden biriyim. DeFi ve Layer 2 projelerine özellikle ilgi duyarım. Muhabbet kurmayı seven, teknik ama anlaşılır bir dil kullanan biriyim..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="glass-card p-6">
            <label className="input-label text-base mb-3">Konuşma Tarzı</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedStyles.includes(style.id)
                      ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                      : "bg-bg-input text-text-muted border border-border hover:text-text-secondary"
                  }`}
                >
                  {style.emoji} {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <label className="input-label text-base mb-3">Uzmanlık Alanları</label>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_OPTIONS.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => toggleExpertise(exp.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedExpertise.includes(exp.id)
                      ? "bg-brand-accent/20 text-brand-accent border border-brand-accent/30"
                      : "bg-bg-input text-text-muted border border-border hover:text-text-secondary"
                  }`}
                >
                  {exp.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <label className="input-label text-base mb-2">
              Yasaklı Kelimeler <span className="text-text-muted font-normal">(opsiyonel)</span>
            </label>
            <input
              className="input-field"
              placeholder="virgülle ayırın: shitcoin, pump, dump"
              value={bannedWords}
              onChange={(e) => setBannedWords(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                Skill üretiliyor...
              </span>
            ) : (
              "🤖 Skill Oluştur"
            )}
          </button>
        </div>
      )}

      {/* Manual Mode / Preview */}
      {(mode === "manual" || skillContent) && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="input-label text-base">.skill Dosyası</label>
            {skillContent && (
              <span className="text-xs text-text-muted">
                {skillContent.length} karakter
              </span>
            )}
          </div>
          <textarea
            className="input-field min-h-[250px] resize-y font-mono text-sm"
            placeholder="Skill içeriğinizi buraya yazın veya yukarıdaki AI aracını kullanarak üretin..."
            value={skillContent}
            onChange={(e) => setSkillContent(e.target.value)}
          />

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-success/10 border border-success/20 text-success"
                  : "bg-error/10 border border-error/20 text-error"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Kaydediliyor..." : "💾 Kaydet"}
            </button>
            {mode === "manual" && (
              <button
                onClick={() => setMode("ai")}
                className="btn-secondary"
              >
                🤖 AI ile Yeniden Oluştur
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
