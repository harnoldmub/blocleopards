import { useState, useEffect, useCallback, useMemo } from "react";
import ConfirmDialog from "./ConfirmDialog";
import SearchableSelect from "./SearchableSelect";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", blue: "#60a5fa",
  green: "#34d399", red: "#f87171", orange: "#fb923c",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "En attente", color: "#f7d618", bg: "rgba(247,214,24,0.12)" },
  verified: { label: "Vérifié",    color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  selected: { label: "Sélectionné", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  rejected: { label: "Refusé",     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  flagged:  { label: "Signalé",    color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
};

const TRANSPORT_LABELS: Record<string, string> = {
  avion: "Avion", autocar: "Autocar", voiture: "Voiture", autre: "Autre",
};

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg, whiteSpace: "nowrap" }}>{text}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <Badge text={s.label} color={s.color} bg={s.bg} />;
}

function StatCard({ label, value, color = C.yellow }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DocViewer({ fichiers, onClose }: { fichiers: any[]; onClose: () => void }) {
  const labelFor = (t: string) => t === "PIECE_IDENTITE" ? "Pièce d'identité" : t === "PREUVE_TRANSPORT" ? "Preuve de transport" : t;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", zIndex: 1, background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 18, width: "100%", maxWidth: 920, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Documents de la demande</div>
            <div style={{ fontSize: 11, color: C.muted }}>Pièce d'identité et preuve de réservation de transport</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(248,113,113,0.12)", border: "none", color: "#f87171", width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 1, background: C.border, overflow: "auto" }}>
          {fichiers.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, background: "#0d1117" }}>Aucun document</div>
          ) : fichiers.map((f: any) => {
            const src = `/api/admin/guadalajara/justificatif?id=${f.id}`;
            const isPdf = f.mime === "application/pdf";
            return (
              <div key={f.id} style={{ background: "#0d1117", padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.yellow, fontWeight: 700, marginBottom: 4 }}>{labelFor(f.type)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, wordBreak: "break-all" }}>{f.filename}</div>
                {isPdf ? (
                  <iframe src={src} style={{ width: "100%", height: 400, border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff" }} title={f.filename} />
                ) : (
                  <a href={src} target="_blank" rel="noopener">
                    <img src={src} alt={f.filename} style={{ width: "100%", maxHeight: 400, objectFit: "contain", border: `1px solid ${C.border}`, borderRadius: 10, background: "#000" }} />
                  </a>
                )}
                <a href={src} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: C.blue, textDecoration: "none" }}>Ouvrir en plein écran →</a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Drawer({ row, onClose, onUpdate, onDelete, onViewDocs }: {
  row: any; onClose: () => void;
  onUpdate: (id: number, status: string, notes: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onViewDocs: () => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = async () => { setSaving(true); await onUpdate(row.id, status, notes); setSaving(false); onClose(); };

  const waPhone = row.whatsapp || row.phone ? (row.whatsapp || row.phone).replace(/\D/g, "") : null;
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Bonjour ${row.first_name}, concernant votre demande Bloc de Guadalajara (${row.reference}).`)}` : null;

  const actions = [
    { s: "pending",  label: "En attente", color: C.yellow },
    { s: "verified", label: "Vérifié",    color: C.blue },
    { s: "selected", label: "Sélectionné", color: C.green },
    { s: "rejected", label: "Refuser",    color: C.red },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", zIndex: 1, background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: "20px 0 0 20px", width: "100%", maxWidth: 460, height: "100vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.7rem", color: C.yellow, letterSpacing: "0.04em", marginBottom: 4 }}>{row.first_name} {row.last_name}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={row.status} />
              <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{row.reference}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <a href={`mailto:${row.email}?subject=Bloc de Guadalajara — ${row.reference}`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", background: "#1c2e8f", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 90 }}>Email</a>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", background: "#25d366", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 90 }}>WhatsApp</a>
          )}
        </div>

        <button onClick={onViewDocs} disabled={!row.fichiers?.length}
          style={{ width: "100%", marginBottom: 20, padding: "12px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 12, color: C.blue, fontSize: 13, fontWeight: 700, cursor: row.fichiers?.length ? "pointer" : "not-allowed", opacity: row.fichiers?.length ? 1 : 0.5 }}>
          Voir les documents ({row.fichiers?.length || 0})
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {[
            ["Email", row.email],
            ["Téléphone", row.phone || "—"],
            ["WhatsApp", row.whatsapp || "—"],
            ["Localisation", [row.city, row.country].filter(Boolean).join(", ") || "—"],
            ["Transport prévu", TRANSPORT_LABELS[row.transport_type] || row.transport_type || "—"],
            ["Hébergement souhaité", row.needs_lodging ? "Oui" : "Non"],
            ["Reçu le", new Date(row.created_at).toLocaleDateString("fr-FR")],
          ].map(([label, value]) => (
            <div key={label as string} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, color: C.text }}>{value}</div>
            </div>
          ))}
          {Array.isArray(row.anti_fraud_flags) && row.anti_fraud_flags.length > 0 && (
            <div style={{ padding: "10px 12px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 10 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: C.orange, fontWeight: 700, marginBottom: 4 }}>Signalements anti-fraude</div>
              <div style={{ fontSize: 12, color: C.text }}>{row.anti_fraud_flags.join(", ")}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 10 }}>Statut</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions.map(a => (
              <button key={a.s} onClick={() => setStatus(a.s)}
                style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${status === a.s ? a.color : C.border}`, background: status === a.s ? `${a.color}22` : "transparent", color: status === a.s ? a.color : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Notes admin</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", resize: "vertical", outline: "none" }} />
        </div>

        <button onClick={save} disabled={saving}
          style={{ width: "100%", padding: "14px", background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button onClick={() => setConfirmOpen(true)}
          style={{ width: "100%", marginTop: 10, padding: "12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Supprimer cette demande
        </button>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          message={`Supprimer la demande de ${row.first_name} ${row.last_name} ?`}
          detail="Cette action est irréversible. Les documents seront aussi supprimés."
          confirmLabel="Supprimer"
          onConfirm={() => { setConfirmOpen(false); onDelete(row.id); onClose(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

export default function AdminGuadalajaraDashboard() {
  const [demandes, setDemandes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [docsView, setDocsView] = useState<any[] | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; status: string; label: string; detail: string; name: string } | null>(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/guadalajara");
    const d = await r.json();
    setDemandes(d.demandes || []);
    setStats(d.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string, notes: string) => {
    await fetch("/api/admin/guadalajara", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, notes }) });
    await load();
  };
  const quickStatus = async (id: number, status: string) => {
    await fetch("/api/admin/guadalajara", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  };
  const deleteDemande = async (id: number) => {
    await fetch("/api/admin/guadalajara", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  };

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    demandes.forEach(d => { if (d.country) counts.set(d.country, (counts.get(d.country) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([value, count]) => ({ value, label: value, count }));
  }, [demandes]);

  const filtered = useMemo(() => demandes
    .filter(d => filterStatus === "all" || d.status === filterStatus)
    .filter(d => filterCountry === "all" || d.country === filterCountry)
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${d.first_name} ${d.last_name} ${d.email} ${d.reference} ${d.city || ""}`.toLowerCase().includes(q);
    }), [demandes, filterStatus, filterCountry, search]);

  const pageRows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const resetPage = () => setPage(0);

  const statusFilters = [
    { id: "all", label: "Toutes", count: demandes.length },
    { id: "pending", label: "En attente", count: Number(stats.pending || 0) },
    { id: "verified", label: "Vérifiés", count: Number(stats.verified || 0) },
    { id: "selected", label: "Sélectionnés", count: Number(stats.selected || 0) },
    { id: "rejected", label: "Refusés", count: Number(stats.rejected || 0) },
  ];

  const exportCsv = () => {
    const esc = (v: any) => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ["Référence", "Prénom", "Nom", "Email", "Téléphone", "WhatsApp", "Ville", "Pays", "Transport", "Hébergement", "Statut", "Notes", "Date"];
    const lines = filtered.map(d => [
      d.reference, d.first_name, d.last_name, d.email, d.phone || "", d.whatsapp || "",
      d.city || "", d.country || "", TRANSPORT_LABELS[d.transport_type] || d.transport_type || "",
      d.needs_lodging ? "Oui" : "Non", STATUS_CONFIG[d.status]?.label || d.status,
      d.admin_notes || "", new Date(d.created_at).toLocaleDateString("fr-FR"),
    ].map(esc).join(","));
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `guadalajara-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .gua-table-view { display: block; }
        .gua-cards-view { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 760px) {
          .gua-table-view { display: none !important; }
          .gua-cards-view { display: flex !important; }
        }
        .gua-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 16px; cursor: pointer; }
        .gua-card:hover { border-color: rgba(247,214,24,0.2); }
      `}</style>

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Programme diaspora · 23 juin 2026</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Bloc de Guadalajara</h1>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1.5px solid rgba(52,211,153,0.3)`, background: "rgba(52,211,153,0.08)", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: filtered.length === 0 ? 0.5 : 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV ({filtered.length})
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total" value={Number(stats.total || 0)} />
        <StatCard label="En attente" value={Number(stats.pending || 0)} />
        <StatCard label="Vérifiés" value={Number(stats.verified || 0)} color={C.blue} />
        <StatCard label="Sélectionnés" value={Number(stats.selected || 0)} color={C.green} />
        <StatCard label="Hébergement" value={Number(stats.lodging || 0)} color={C.orange} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {statusFilters.map(f => (
          <button key={f.id} onClick={() => { setFilterStatus(f.id); resetPage(); }}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${filterStatus === f.id ? C.yellow : C.border}`, background: filterStatus === f.id ? "rgba(247,214,24,0.1)" : "transparent", color: filterStatus === f.id ? C.yellow : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchableSelect value={filterCountry} onChange={v => { setFilterCountry(v); resetPage(); }}
          options={countries} placeholder="Tous les pays" searchPlaceholder="Chercher un pays..." />
        <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Rechercher nom, email, réf..."
          style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 200 }} />
        {filtered.length !== demandes.length && <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>}
      </div>

      {/* Mobile cards */}
      <div className="gua-cards-view">
        {pageRows.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</div>
        : pageRows.map(d => (
          <div key={d.id} className="gua-card" onClick={() => setSelected(d)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.first_name} {d.last_name}</div>
              <StatusBadge status={d.status} />
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{d.email}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{[d.city, d.country].filter(Boolean).join(", ")}</div>
            <div style={{ display: "flex", gap: 6, paddingTop: 8, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
              {d.status !== "verified" && d.status !== "selected" && (
                <button onClick={() => quickStatus(d.id, "verified")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.3)`, background: "rgba(96,165,250,0.08)", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Valider</button>
              )}
              {d.status !== "selected" && (
                <button onClick={() => setConfirmAction({ id: d.id, status: "selected", label: "Attribuer le billet", detail: `${d.first_name} ${d.last_name} sera sélectionné(e) pour le billet Guadalajara.`, name: `${d.first_name} ${d.last_name}` })} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid rgba(52,211,153,0.3)`, background: "rgba(52,211,153,0.08)", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Sélectionner</button>
              )}
              <button onClick={() => setSelected(d)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Gérer</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="gua-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Nom", "Contact", "Localisation", "Transport", "Docs", "Statut", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</td></tr>
            : pageRows.map(d => (
              <tr key={d.id} onClick={() => setSelected(d)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                  {d.first_name} {d.last_name}
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{d.reference}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
                  <div>{d.email}</div>
                  {(d.whatsapp || d.phone) && <div>{d.whatsapp || d.phone}</div>}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{[d.city, d.country].filter(Boolean).join(", ") || "—"}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
                  {TRANSPORT_LABELS[d.transport_type] || "—"}
                  {d.needs_lodging && <Badge text="Hébergt" color={C.orange} bg="rgba(251,146,60,0.12)" />}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={e => { e.stopPropagation(); setDocsView(d.fichiers || []); }} disabled={!d.fichiers?.length}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, border: `1px solid rgba(96,165,250,0.3)`, background: "rgba(96,165,250,0.08)", color: C.blue, fontSize: 11, fontWeight: 700, cursor: d.fichiers?.length ? "pointer" : "not-allowed", opacity: d.fichiers?.length ? 1 : 0.4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {d.fichiers?.length || 0}
                  </button>
                </td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={d.status} /></td>
                <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {d.status !== "verified" && d.status !== "selected" && (
                      <button title="Valider (vérifié)" onClick={() => quickStatus(d.id, "verified")}
                        style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: `1px solid rgba(96,165,250,0.3)`, background: "rgba(96,165,250,0.08)", color: C.blue, cursor: "pointer" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    )}
                    {d.status !== "selected" && (
                      <button title="Sélectionner (attribuer le billet)" onClick={() => setConfirmAction({ id: d.id, status: "selected", label: "Attribuer le billet", detail: `${d.first_name} ${d.last_name} sera sélectionné(e) pour le billet Guadalajara. Un email pourra lui être envoyé.`, name: `${d.first_name} ${d.last_name}` })}
                        style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: `1px solid rgba(52,211,153,0.3)`, background: "rgba(52,211,153,0.08)", color: C.green, cursor: "pointer" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      </button>
                    )}
                    {d.status !== "rejected" && (
                      <button title="Refuser" onClick={() => setConfirmAction({ id: d.id, status: "rejected", label: "Refuser la demande", detail: `La demande de ${d.first_name} ${d.last_name} sera marquée comme refusée.`, name: `${d.first_name} ${d.last_name}` })}
                        style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: `1px solid rgba(248,113,113,0.3)`, background: "rgba(248,113,113,0.08)", color: C.red, cursor: "pointer" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                    <button title="Gérer / modifier" onClick={() => setSelected(d)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Gérer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${page === i ? C.yellow : C.border}`, background: page === i ? "rgba(247,214,24,0.12)" : "transparent", color: page === i ? C.yellow : C.muted, fontSize: 12, cursor: "pointer" }}>{i + 1}</button>
          ))}
        </div>
      )}

      {selected && <Drawer row={selected} onClose={() => setSelected(null)} onUpdate={updateStatus} onDelete={deleteDemande} onViewDocs={() => setDocsView(selected.fichiers || [])} />}
      {docsView && <DocViewer fichiers={docsView} onClose={() => setDocsView(null)} />}
      {confirmAction && (
        <ConfirmDialog
          message={`${confirmAction.label} — ${confirmAction.name} ?`}
          detail={confirmAction.detail}
          confirmLabel={confirmAction.label}
          onConfirm={() => { quickStatus(confirmAction.id, confirmAction.status); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
