import { useState, useEffect, useCallback } from "react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", green: "#34d399", red: "#f87171",
};

type Article = {
  id: string; slug: string; title: string; description: string; body: string;
  date: string; tags: string[]; image: string | null; video: string | null;
  audio: string | null; source_title: string | null; source_url: string | null;
  published: boolean;
};

const empty: Omit<Article, "id"> = {
  slug: "", title: "", description: "", body: "", date: new Date().toISOString().slice(0, 10),
  tags: [], image: "", video: "", audio: "", source_title: "", source_url: "", published: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "9px 12px", color: C.text, fontSize: 13,
  fontFamily: "'Sora', sans-serif", outline: "none",
};

function ArticleDrawer({ article, onClose, onSave }: {
  article: Partial<Article> | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState<any>(article ?? empty);
  const [saving, setSaving] = useState(false);
  const [tagsStr, setTagsStr] = useState((article?.tags ?? []).join(", "));

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    await onSave({ ...form, tags: tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean) });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", zIndex: 1, background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: "20px 0 0 20px", width: "100%", maxWidth: 560, height: "100vh", overflowY: "auto", padding: 28 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: C.text, letterSpacing: "0.04em" }}>
            {form.id ? "Modifier l'article" : "Nouvel article"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <Field label="Titre *"><input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} /></Field>
        <Field label="Slug * (format : 2026-06-03-naza-liege)">
          <input style={inputStyle} value={form.slug} onChange={e => set("slug", e.target.value)} />
        </Field>
        <Field label="Date *"><input style={inputStyle} type="date" value={form.date} onChange={e => set("date", e.target.value)} /></Field>
        <Field label="Description *"><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.description} onChange={e => set("description", e.target.value)} /></Field>
        <Field label="Corps de l'article * (séparer les paragraphes par une ligne vide)">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 180 }} rows={8} value={form.body} onChange={e => set("body", e.target.value)} />
        </Field>
        <Field label="Tags (séparés par virgule)"><input style={inputStyle} value={tagsStr} onChange={e => setTagsStr(e.target.value)} /></Field>
        <Field label="Image (chemin /media/...)"><input style={inputStyle} value={form.image ?? ""} onChange={e => set("image", e.target.value)} /></Field>
        <Field label="Vidéo (chemin /videos/...)"><input style={inputStyle} value={form.video ?? ""} onChange={e => set("video", e.target.value)} /></Field>
        <Field label="Audio (chemin /audio/...)"><input style={inputStyle} value={form.audio ?? ""} onChange={e => set("audio", e.target.value)} /></Field>
        <Field label="Source — titre"><input style={inputStyle} value={form.source_title ?? ""} onChange={e => set("source_title", e.target.value)} /></Field>
        <Field label="Source — URL"><input style={inputStyle} value={form.source_url ?? ""} onChange={e => set("source_url", e.target.value)} /></Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => set("published", !form.published)}
            style={{ width: 44, height: 24, borderRadius: 12, background: form.published ? C.green : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
          >
            <span style={{ position: "absolute", top: 3, left: form.published ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </button>
          <span style={{ fontSize: 13, color: form.published ? C.green : C.muted }}>{form.published ? "Publié" : "Brouillon"}</span>
        </div>

        <button onClick={save} disabled={saving} style={{ width: "100%", padding: 14, background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export default function AdminArticlesDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Article> | null | false>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/articles");
    const d = await r.json();
    setArticles(d.articles || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (data: any) => {
    const method = data.id ? "PUT" : "POST";
    await fetch("/api/admin/articles", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    await load();
  };

  const del = async (id: string) => {
    setDeleting(id);
    await fetch("/api/admin/articles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
    setDeleting(null);
  };

  const filtered = articles.filter(a => !search || `${a.title} ${a.slug} ${a.tags?.join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .art-table-view { display: block; }
        .art-cards-view { display: none; flex-direction: column; gap: 8px; }
        @media (max-width: 700px) {
          .art-table-view { display: none !important; }
          .art-cards-view { display: flex !important; }
        }
        .art-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px; }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em" }}>Articles</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", color: C.yellow }}>{articles.length}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>Total</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", color: C.green }}>{articles.filter(a => a.published).length}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>Publiés</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 220 }} />
        <button onClick={() => setEditing(empty)} style={{ marginLeft: "auto", padding: "8px 18px", borderRadius: 10, background: C.yellow, border: "none", color: "#07090f", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Nouvel article
        </button>
      </div>

      {/* Cards — mobile */}
      <div className="art-cards-view">
        {filtered.map(a => (
          <div key={a.id} className="art-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, flex: 1, marginRight: 8 }}>{a.title}</div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: a.published ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", color: a.published ? C.green : C.muted, fontWeight: 700, flexShrink: 0 }}>
                {a.published ? "Publié" : "Brouillon"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{a.date} · {a.slug}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setEditing(a)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 11, cursor: "pointer" }}>Modifier</button>
              <button onClick={() => setPendingDeleteId(a.id)} disabled={deleting === a.id} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid rgba(248,113,113,0.3)`, background: "transparent", color: C.red, fontSize: 11, cursor: "pointer" }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      {/* Table — desktop */}
      <div className="art-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Titre", "Date", "Statut", "Tags", ""].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun article</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{a.slug}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{a.date}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: a.published ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", color: a.published ? C.green : C.muted, fontWeight: 700 }}>
                    {a.published ? "Publié" : "Brouillon"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: C.muted }}>{a.tags?.slice(0, 3).join(", ")}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setEditing(a)} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 11, cursor: "pointer" }}>Modifier</button>
                    <button onClick={() => setPendingDeleteId(a.id)} disabled={deleting === a.id} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(248,113,113,0.3)`, background: "transparent", color: C.red, fontSize: 11, cursor: "pointer", opacity: deleting === a.id ? 0.5 : 1 }}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== false && (
        <ArticleDrawer article={editing} onClose={() => setEditing(false)} onSave={save} />
      )}
      {pendingDeleteId && (
        <ConfirmDialog
          message="Supprimer cet article ?"
          detail="Il sera retiré définitivement du site."
          confirmLabel="Supprimer"
          onConfirm={() => { del(pendingDeleteId); setPendingDeleteId(null); }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
