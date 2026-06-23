import { useState, useEffect, useCallback } from "react";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unread:  { label: "Non lu",  color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  read:    { label: "Lu",      color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  replied: { label: "Répondu", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  spam:    { label: "Spam",    color: "#f97316", bg: "rgba(249,115,22,0.12)" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.unread;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function StatCard({ label, value, color = C.yellow }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Drawer({ row, onClose, onUpdate, onReload }: { row: any; onClose: () => void; onUpdate: (id: string, status: string, notes: string) => Promise<void>; onReload: () => Promise<void> }) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");
  const [consigne, setConsigne] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    await onUpdate(row.id, status, notes);
    setSaving(false);
    onClose();
  };

  const generateDraft = async () => {
    setDrafting(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/admin/contact-ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: row.nom, objet: row.objet, message: row.message, consigne }),
      });
      const d = await r.json();
      if (r.ok && d.draft) {
        setReply(d.draft);
      } else {
        setFeedback({ type: "err", text: d.error || "Impossible de générer le brouillon." });
      }
    } catch {
      setFeedback({ type: "err", text: "Erreur réseau lors de la génération." });
    }
    setDrafting(false);
  };

  const sendReply = async () => {
    if (!reply.trim()) { setFeedback({ type: "err", text: "Le message est vide." }); return; }
    setSending(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/admin/contact-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, to: row.email, objet: row.objet, body: reply, notes }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setFeedback({ type: "ok", text: "Réponse envoyée et message marqué « Répondu »." });
        await onReload();
        setTimeout(onClose, 900);
      } else {
        setFeedback({ type: "err", text: d.error || "Échec de l'envoi." });
      }
    } catch {
      setFeedback({ type: "err", text: "Erreur réseau lors de l'envoi." });
    }
    setSending(false);
  };

  const actions = [
    { s: "unread",  label: "Non lu",  color: "#f472b6" },
    { s: "read",    label: "Lu",      color: "#94a3b8" },
    { s: "replied", label: "Répondu", color: "#34d399" },
    { s: "spam",    label: "Spam",    color: "#f97316" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", zIndex: 1, background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: "20px 0 0 20px", width: "100%", maxWidth: 500, height: "100vh", overflowY: "auto", padding: 28 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: C.text, letterSpacing: "0.04em" }}>Message</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {[["Nom", row.nom], ["Email", row.email], ["Objet", row.objet]].map(([label, value]) => (
            <div key={label} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, color: C.text }}>{value}</div>
            </div>
          ))}
          {row.message && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Message</div>
              <p style={{ fontSize: 14, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{row.message}</p>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.muted }}>Reçu le {new Date(row.created_at).toLocaleDateString("fr-FR")}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 10 }}>Statut</div>
          <div style={{ display: "flex", gap: 8 }}>
            {actions.map((a) => (
              <button key={a.s} onClick={() => setStatus(a.s)} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${status === a.s ? a.color : C.border}`, background: status === a.s ? `${a.color}22` : "transparent", color: status === a.s ? a.color : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Réponse directe + IA */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Répondre à {row.email}</div>
            <button onClick={generateDraft} disabled={drafting} title="Rédiger la réponse avec l'IA"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: `1.5px solid rgba(167,139,250,0.4)`, background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontSize: 12, fontWeight: 700, cursor: drafting ? "wait" : "pointer", whiteSpace: "nowrap" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>
              {drafting ? "Rédaction…" : "Répondre avec l'IA"}
            </button>
          </div>

          <input value={consigne} onChange={(e) => setConsigne(e.target.value)} aria-label="Consigne pour l'IA"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", color: C.text, fontSize: 12, fontFamily: "'Sora', sans-serif", outline: "none", marginBottom: 10 }} />
          <div style={{ fontSize: 10, color: C.muted, marginTop: -6, marginBottom: 10 }}>Consigne optionnelle pour l'IA (ton, infos à inclure…)</div>

          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={8} aria-label="Message de réponse"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, lineHeight: 1.6, fontFamily: "'Sora', sans-serif", resize: "vertical", outline: "none" }} />
        </div>

        {feedback && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13,
            background: feedback.type === "ok" ? "rgba(52,211,153,0.1)" : feedback.type === "err" ? "rgba(248,113,113,0.1)" : "rgba(96,165,250,0.1)",
            border: `1px solid ${feedback.type === "ok" ? "rgba(52,211,153,0.3)" : feedback.type === "err" ? "rgba(248,113,113,0.3)" : "rgba(96,165,250,0.3)"}`,
            color: feedback.type === "ok" ? "#34d399" : feedback.type === "err" ? "#f87171" : "#60a5fa" }}>
            {feedback.text}
          </div>
        )}

        <button onClick={sendReply} disabled={sending || !reply.trim()} style={{ width: "100%", padding: "14px", background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: sending || !reply.trim() ? "not-allowed" : "pointer", opacity: sending || !reply.trim() ? 0.5 : 1, marginBottom: 10 }}>
          {sending ? "Envoi…" : "Envoyer la réponse"}
        </button>

        <button onClick={save} disabled={saving} style={{ width: "100%", padding: "12px", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement…" : "Enregistrer le statut sans envoyer"}
        </button>

        {/* Notes admin — tout en bas */}
        <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Notes admin (privées)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} aria-label="Notes admin privées" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", resize: "vertical", outline: "none" }} />
          <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Enregistrées via « Envoyer la réponse » ou « Enregistrer le statut ».</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminContactsDashboard() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/contacts");
    const d = await r.json();
    setContacts(d.contacts || []);
    setStats(d.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string, notes: string) => {
    await fetch("/api/admin/contact-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, notes }) });
    await load();
  };

  const filtered = contacts
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => !search || `${r.nom} ${r.email} ${r.objet}`.toLowerCase().includes(search.toLowerCase()));

  const page_rows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const total_pages = Math.ceil(filtered.length / PER_PAGE);

  const filters = [
    { id: "all",     label: "Tous",      count: contacts.length },
    { id: "unread",  label: "Non lus",   count: Number(stats.unread || 0) },
    { id: "read",    label: "Lus",       count: Number(stats.read || 0) },
    { id: "replied", label: "Répondus",  count: Number(stats.replied || 0) },
    { id: "spam",    label: "Spam",      count: Number(stats.spam || 0) },
  ];

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .msg-table-view { display: block; }
        .msg-cards-view { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 700px) {
          .msg-table-view { display: none !important; }
          .msg-cards-view { display: flex !important; }
        }
        .msg-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 16px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .msg-card:hover { background: rgba(247,214,24,0.04); border-color: rgba(247,214,24,0.2); }
        .msg-card.unread { border-left: 3px solid #f472b6; }
      `}</style>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em" }}>Messages Contact</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total" value={Number(stats.total || 0)} />
        <StatCard label="Non lus" value={Number(stats.unread || 0)} color="#f472b6" />
        <StatCard label="Lus" value={Number(stats.read || 0)} color="#94a3b8" />
        <StatCard label="Répondus" value={Number(stats.replied || 0)} color="#34d399" />
        <StatCard label="Spam" value={Number(stats.spam || 0)} color="#f97316" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map((f) => (
          <button key={f.id} onClick={() => { setFilter(f.id); setPage(0); }} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${filter === f.id ? C.yellow : C.border}`, background: filter === f.id ? "rgba(247,214,24,0.1)" : "transparent", color: filter === f.id ? C.yellow : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 200 }} />
      </div>

      {/* Cards — mobile */}
      <div className="msg-cards-view">
        {page_rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun message</div>
        ) : page_rows.map((row) => (
          <div key={row.id} className={`msg-card${row.status === "unread" ? " unread" : ""}`} onClick={() => setSelected(row)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: row.status === "unread" ? 700 : 500, color: C.text, fontSize: 14 }}>{row.nom}</div>
              <StatusBadge status={row.status} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{row.email}</div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.objet}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{new Date(row.created_at).toLocaleDateString("fr-FR")}</div>
          </div>
        ))}
      </div>

      {/* Table — desktop */}
      <div className="msg-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Nom", "Email", "Objet", "Statut", "Date"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page_rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun message</td></tr>
            ) : page_rows.map((row) => (
              <tr key={row.id} onClick={() => setSelected(row)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: row.status === "unread" ? 700 : 400 }}>{row.nom}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{row.email}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.objet}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={row.status} /></td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: C.muted }}>{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total_pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {Array.from({ length: total_pages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${page === i ? C.yellow : C.border}`, background: page === i ? "rgba(247,214,24,0.12)" : "transparent", color: page === i ? C.yellow : C.muted, fontSize: 12, cursor: "pointer" }}>{i + 1}</button>
          ))}
        </div>
      )}

      {selected && <Drawer row={selected} onClose={() => setSelected(null)} onUpdate={updateStatus} onReload={load} />}
    </div>
  );
}
