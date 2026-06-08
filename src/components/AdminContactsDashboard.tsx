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

function Drawer({ row, onClose, onUpdate }: { row: any; onClose: () => void; onUpdate: (id: string, status: string, notes: string) => Promise<void> }) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.admin_notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onUpdate(row.id, status, notes);
    setSaving(false);
    onClose();
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

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Notes admin</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", resize: "vertical", outline: "none" }} />
        </div>

        <a href={`mailto:${row.email}?subject=Re: ${encodeURIComponent(row.objet)}`} style={{ display: "block", width: "100%", padding: "14px", background: "#1c2e8f", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", textDecoration: "none", textAlign: "center", marginBottom: 10 }}>
          Répondre par email
        </a>

        <button onClick={save} disabled={saving} style={{ width: "100%", padding: "14px", background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement..." : "Enregistrer le statut"}
        </button>
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

      {selected && <Drawer row={selected} onClose={() => setSelected(null)} onUpdate={updateStatus} />}
    </div>
  );
}
