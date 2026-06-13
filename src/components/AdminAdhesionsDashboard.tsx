import { useState, useEffect, useCallback, useMemo } from "react";
import ConfirmDialog from "./ConfirmDialog";
import SearchableSelect from "./SearchableSelect";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", red: "#ce1021",
  green: "#16a34a", blue: "#60a5fa",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "En attente", color: "#f7d618", bg: "rgba(247,214,24,0.12)" },
  validated: { label: "Validé",     color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  rejected:  { label: "Rejeté",     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

const ROLES: Record<string, string> = {
  supporter: "Supporter",
  benevole: "Bénévole",
  animateur: "Animateur",
  photographe: "Photo/Vidéo",
  communication: "Communication",
  logistique: "Logistique",
  autre: "Autre",
};

// Palette of distinct colors for role badges
const ROLE_PALETTE = [
  { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },   // blue
  { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },  // purple
  { color: "#fb923c", bg: "rgba(251,146,60,0.12)" },   // orange
  { color: "#34d399", bg: "rgba(52,211,153,0.12)" },   // green
  { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },  // pink
  { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },   // sky
  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },   // amber
  { color: "#4ade80", bg: "rgba(74,222,128,0.12)" },   // lime
];

function getRoleStyle(role: string) {
  if (!role) return { color: C.muted, bg: "rgba(255,255,255,0.05)" };
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) & 0xffff;
  return ROLE_PALETTE[hash % ROLE_PALETTE.length];
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (!role || role === "—") return <span style={{ fontSize: 12, color: C.muted }}>—</span>;
  const s = getRoleStyle(role);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {role}
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

function Drawer({ row, onClose, onUpdate, onDelete }: { row: any; onClose: () => void; onUpdate: (id: string, status: string, notes: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    await onUpdate(row.id, status, notes);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(row.id);
    setDeleting(false);
    onClose();
  };

  const waPhone = row.telephone ? row.telephone.replace(/\D/g, "") : null;
  const waText = encodeURIComponent(`Bonjour ${row.prenom}, votre adhésion au Bloc des Léopards a bien été reçue. Bloc Léopards`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;

  const actions: { s: string; label: string; color: string }[] = [
    { s: "pending",   label: "En attente", color: C.yellow },
    { s: "validated", label: "Valider",    color: "#34d399" },
    { s: "rejected",  label: "Rejeter",    color: "#f87171" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", zIndex: 1, background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: "20px 0 0 20px", width: "100%", maxWidth: 480, height: "100vh", overflowY: "auto", padding: 28 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: C.yellow, letterSpacing: "0.04em", marginBottom: 6 }}>{row.prenom} {row.nom}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={row.status} />
              {row.role && <RoleBadge role={row.role} />}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <a href={`mailto:${row.email}?subject=Adhésion Bloc Léopards`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "#1c2e8f", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 100 }}>
            Email
          </a>
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "#25d366", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 100 }}>
              WhatsApp
            </a>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12, minWidth: 100 }}>
              Pas de téléphone
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {[
            ["Nom", `${row.prenom} ${row.nom}`],
            ["Email", row.email],
            ["Téléphone", row.telephone || "—"],
            ["Ville", `${row.ville}${row.pays ? `, ${row.pays}` : ""}`],
            ["Canal", row.canal || "—"],
            ["Disponibilité", row.disponibilite || "—"],
            ["Newsletter", row.newsletter_opt_in ? "Oui" : "Non"],
          ].map(([label, value]) => (
            <div key={label} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, color: C.text }}>{value}</div>
            </div>
          ))}
          {row.motivation && (
            <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 3 }}>Motivation</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{row.motivation}</div>
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

        <button onClick={save} disabled={saving} style={{ width: "100%", padding: "14px", background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>

        <button onClick={() => setConfirmOpen(true)} disabled={deleting} style={{ width: "100%", marginTop: 10, padding: "12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {deleting ? "Suppression..." : "Supprimer cette adhésion"}
        </button>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          message={`Supprimer ${row.prenom} ${row.nom} ?`}
          detail="Cette action est irréversible. L'adhésion sera définitivement supprimée."
          confirmLabel="Supprimer"
          onConfirm={() => { setConfirmOpen(false); handleDelete(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

export default function AdminAdhesionsDashboard() {
  const [adhesions, setAdhesions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/adhesions");
    const d = await r.json();
    setAdhesions(d.adhesions || []);
    setStats(d.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string, notes: string) => {
    await fetch("/api/admin/adhesion-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, notes }) });
    await load();
  };

  const deleteAdhesion = async (id: string) => {
    await fetch("/api/admin/adhesions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  };

  const countOptions = (values: string[], labelFn?: (v: string) => string) => {
    const counts = new Map<string, number>();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: labelFn ? labelFn(value) : value, count }));
  };

  const cities = useMemo(() => countOptions(adhesions.map(r => r.ville).filter(Boolean)), [adhesions]);
  const roles = useMemo(() => countOptions(adhesions.map(r => r.role).filter(Boolean), v => ROLES[v] || v), [adhesions]);

  const filtered = useMemo(() => adhesions
    .filter((r) => filterStatus === "all" || r.status === filterStatus)
    .filter((r) => filterCity === "all" || r.ville === filterCity)
    .filter((r) => filterRole === "all" || r.role === filterRole)
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${r.prenom} ${r.nom} ${r.email} ${r.ville}`.toLowerCase().includes(q);
    }), [adhesions, filterStatus, filterCity, filterRole, search]);

  const page_rows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const total_pages = Math.ceil(filtered.length / PER_PAGE);

  const statusFilters = [
    { id: "all",       label: "Tous",       count: adhesions.length },
    { id: "pending",   label: "En attente", count: Number(stats.pending   || 0) },
    { id: "validated", label: "Validés",    count: Number(stats.validated || 0) },
    { id: "rejected",  label: "Rejetés",    count: Number(stats.rejected  || 0) },
  ];

  const resetPage = () => setPage(0);

  const exportCsv = () => {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const statusLabel = (s: string) => STATUS_CONFIG[s]?.label || s;
    const header = ["Prénom", "Nom", "Email", "Téléphone", "Ville", "Pays", "Rôle", "Canal", "Disponibilité", "Newsletter", "Statut", "Notes admin", "Date"];
    const lines = filtered.map(r => [
      r.prenom, r.nom, r.email, r.telephone || "", r.ville, r.pays || "",
      r.role || "", r.canal || "", r.disponibilite || "",
      r.newsletter_opt_in ? "Oui" : "Non", statusLabel(r.status),
      r.admin_notes || "", new Date(r.created_at).toLocaleDateString("fr-FR"),
    ].map(esc).join(","));
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adhesions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .adh-table-view { display: block; }
        .adh-cards-view { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 700px) {
          .adh-table-view { display: none !important; }
          .adh-cards-view { display: flex !important; }
        }
        .adh-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 16px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .adh-card:hover { background: rgba(247,214,24,0.04); border-color: rgba(247,214,24,0.2); }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Adhésions</h1>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total"      value={Number(stats.total      || 0)} />
        <StatCard label="En attente" value={Number(stats.pending    || 0)} />
        <StatCard label="Validés"    value={Number(stats.validated  || 0)} color="#34d399" />
        <StatCard label="Rejetés"    value={Number(stats.rejected   || 0)} color="#f87171" />
        <StatCard label="Newsletter" value={Number(stats.newsletter || 0)} color={C.blue} />
      </div>

      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {statusFilters.map((f) => (
          <button key={f.id} onClick={() => { setFilterStatus(f.id); resetPage(); }}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${filterStatus === f.id ? C.yellow : C.border}`, background: filterStatus === f.id ? "rgba(247,214,24,0.1)" : "transparent", color: filterStatus === f.id ? C.yellow : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* Secondary filters row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchableSelect value={filterCity} onChange={v => { setFilterCity(v); resetPage(); }}
          options={cities} placeholder="Toutes les villes" searchPlaceholder="Chercher une ville..." />
        <SearchableSelect value={filterRole} onChange={v => { setFilterRole(v); resetPage(); }}
          options={roles} placeholder="Tous les rôles" searchPlaceholder="Chercher un rôle..." />

        {/* Search */}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          placeholder="Rechercher nom, email..."
          style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 200 }}
        />

        {/* Active filter count */}
        {filtered.length !== adhesions.length && (
          <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
        )}

        {/* Export CSV */}
        <button onClick={exportCsv} disabled={filtered.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: `1.5px solid rgba(52,211,153,0.3)`, background: "rgba(52,211,153,0.08)", color: "#34d399", fontSize: 12, fontWeight: 700, cursor: filtered.length === 0 ? "not-allowed" : "pointer", opacity: filtered.length === 0 ? 0.5 : 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Mobile cards */}
      <div className="adh-cards-view">
        {page_rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</div>
        ) : page_rows.map((row) => (
          <div key={row.id} className="adh-card" onClick={() => setSelected(row)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{row.prenom} {row.nom}</div>
              <StatusBadge status={row.status} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{row.email}</div>
            {row.telephone && <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{row.telephone}</div>}
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{row.ville}{row.pays ? `, ${row.pays}` : ""}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <RoleBadge role={row.role || "—"} />
              <span style={{ fontSize: 11, color: C.muted }}>{new Date(row.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="adh-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Nom", "Email", "Ville", "Rôle", "Statut", "Date"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page_rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</td></tr>
            ) : page_rows.map((row) => (
              <tr key={row.id} onClick={() => setSelected(row)}
                style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{row.prenom} {row.nom}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{row.email}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{row.ville}{row.pays ? `, ${row.pays}` : ""}</td>
                <td style={{ padding: "12px 16px" }}><RoleBadge role={row.role || "—"} /></td>
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
            <button key={i} onClick={() => setPage(i)}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${page === i ? C.yellow : C.border}`, background: page === i ? "rgba(247,214,24,0.12)" : "transparent", color: page === i ? C.yellow : C.muted, fontSize: 12, cursor: "pointer" }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {selected && <Drawer row={selected} onClose={() => setSelected(null)} onUpdate={updateStatus} onDelete={deleteAdhesion} />}
    </div>
  );
}
