import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Clock, CheckCircle, XCircle, RefreshCw, ExternalLink, Pencil, List } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import Flag from "./Flag";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "pending" | "selected" | "ticket_given" | "rejected";
type MatchKey = "rdc-denmark" | "rdc-chili";

interface Inscription {
  id: string;
  match_key: MatchKey;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
  source: "formulaire" | "chatbot";
  status: Status;
  created_at: string;
  updated_at: string;
  ticket_given_at: string | null;
  validated_by_admin: string | null;
}

interface Stats {
  total: string;
  denmark: string;
  chili: string;
  pending: string;
  selected: string;
  ticket_given: string;
  rejected: string;
}

interface ApiResponse {
  inscriptions: Inscription[];
  stats: Stats;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "En attente", color: "#f7d618", bg: "rgba(247,214,24,0.1)", border: "rgba(247,214,24,0.25)" },
  selected: { label: "Sélectionné", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" },
  ticket_given: { label: "Billet donné", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)" },
  rejected: { label: "Refusé", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
};

const MATCH_CONFIG: Record<MatchKey, { label: string; flagCode: string; color: string }> = {
  "rdc-denmark": { label: "RDC vs Danemark", flagCode: "dk", color: "#60a5fa" },
  "rdc-chili": { label: "RDC vs Chili", flagCode: "cl", color: "#f87171" },
};

const PAGE_SIZE = 20;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub, color }: { icon: React.ReactNode; value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1.5px solid ${color ? `${color}30` : "rgba(255,255,255,0.09)"}`,
        borderRadius: "20px",
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        boxShadow: color ? `0 8px 32px -12px ${color}40` : "none",
      }}
    >
      {color && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: color, opacity: 0.7 }} />
      )}
      <div style={{ fontSize: "24px", marginBottom: "10px" }}>{icon}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.4rem", color: color || "#fff", letterSpacing: "0.04em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, marginTop: "6px" }}>{label}</div>
      {sub && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", marginTop: "3px" }}>{sub}</div>}
    </motion.div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: "40px",
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function ActionButton({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "6px 12px",
        background: hovered ? color : `${color}18`,
        border: `1px solid ${color}50`,
        borderRadius: "8px",
        color: hovered ? "#07090f" : color,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        fontFamily: "'Sora', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, active, onClick, count }: { label: React.ReactNode; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "7px 14px",
        background: active ? "#f7d618" : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${active ? "#f7d618" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "40px",
        color: active ? "#07090f" : "rgba(255,255,255,0.65)",
        fontSize: "12px",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        fontFamily: "'Sora', sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)",
          borderRadius: "40px",
          padding: "1px 6px",
          fontSize: "10px",
          fontWeight: 800,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Row detail drawer ─────────────────────────────────────────────────────────

const F = { label: { fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 4 }, input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: "'Sora',sans-serif", outline: "none" } };

function RowDrawer({ row, onClose, onUpdate, onDelete }: {
  row: Inscription; onClose: () => void;
  onUpdate: (id: string, status: Status) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<Status | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: row.first_name, last_name: row.last_name, email: row.email, phone: row.phone || "", city: row.city || "", country: row.country || "" });

  const handleUpdate = async (status: Status) => {
    setUpdating(status);
    await onUpdate(row.id, status);
    setUpdating(null);
    onClose();
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    await fetch("/api/admin/billets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, ...editForm }) });
    setSaving(false);
    setEditing(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(row.id);
    setDeleting(false);
    onClose();
  };

  const waText = encodeURIComponent(`Bonjour ${row.first_name}, ton inscription au Bloc des Léopards (${MATCH_CONFIG[row.match_key]?.label}) a été ${row.status === "selected" ? "retenue ✅" : "enregistrée 🎫"}. Bloc Léopards 🐆🇨🇩`);
  const waUrl = row.phone ? `https://wa.me/${row.phone.replace(/\D/g, "")}?text=${waText}` : null;

  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
      onClick={onClose}>
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: "#0e1628", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "20px 0 0 20px", padding: "28px 24px 48px", height: "100vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 4 }}>
              {MATCH_CONFIG[row.match_key]?.label}
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", letterSpacing: "0.05em", color: "#f7d618" }}>
              {row.first_name} {row.last_name}
            </h3>
            <div style={{ marginTop: 6 }}><StatusBadge status={row.status} /></div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>×</button>
        </div>

        {/* Contact buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <a href={`mailto:${row.email}?subject=Bloc Léopards – ${MATCH_CONFIG[row.match_key]?.label}`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "#1c2e8f", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 120 }}>
            ✉️ Email
          </a>
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "#25d366", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", minWidth: 120 }}>
              💬 WhatsApp
            </a>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "rgba(255,255,255,0.3)", fontSize: 12, minWidth: 120 }}>
              Pas de WhatsApp
            </div>
          )}
        </div>

        {/* Info / Edit */}
        {!editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {[["Email", row.email], ["WhatsApp", row.phone || "—"], ["Ville", row.city || "—"], ["Pays", row.country || "—"], ["Source", row.source === "chatbot" ? "🤖 ChatBot" : "📝 Formulaire"], ["Date", new Date(row.created_at).toLocaleDateString("fr-FR")]].map(([l, v]) => (
              <div key={l} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
                <div style={F.label}>{l}</div>
                <div style={{ color: "#fff", fontSize: 13 }}>{v}</div>
              </div>
            ))}
            <button onClick={() => setEditing(true)} style={{ marginTop: 4, padding: "9px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Pencil size={12} /> Modifier les infos
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {[["Prénom", "first_name"], ["Nom", "last_name"], ["Email", "email"], ["WhatsApp", "phone"], ["Ville", "city"], ["Pays", "country"]].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={F.label}>{l}</div>
                <input value={(editForm as any)[k]} onChange={(e) => setEditForm(p => ({ ...p, [k]: e.target.value }))} style={F.input} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: "12px", background: "#f7d618", border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "..." : "Enregistrer"}
              </button>
              <button onClick={() => setEditing(false)} style={{ padding: "12px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Status actions */}
        <div style={{ marginBottom: 16 }}>
          <div style={F.label}>Changer le statut</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {(["selected", "ticket_given", "pending", "rejected"] as Status[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const isActive = row.status === s;
              return (
                <button key={s} type="button" onClick={() => !isActive && handleUpdate(s)} disabled={updating !== null || isActive}
                  style={{ padding: "9px 14px", background: isActive ? `${cfg.bg}` : "transparent", border: `1.5px solid ${isActive ? cfg.color : "rgba(255,255,255,0.1)"}`, borderRadius: 10, color: isActive ? cfg.color : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: isActive ? "default" : "pointer", transition: "all 0.15s" }}>
                  {updating === s ? "..." : cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete */}
        <button onClick={() => setConfirmOpen(true)} disabled={deleting} style={{ width: "100%", padding: "12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
          {deleting ? "Suppression..." : "🗑 Supprimer cette inscription"}
        </button>
      </motion.div>
    </motion.div>

    {confirmOpen && (
      <ConfirmDialog
        message={`Supprimer ${row.first_name} ${row.last_name} ?`}
        detail="Cette action est irréversible. La demande sera définitivement supprimée."
        confirmLabel="Supprimer"
        onConfirm={() => { setConfirmOpen(false); handleDelete(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminBilletsDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMatch, setFilterMatch] = useState<MatchKey | "all">("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inscription | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/billets");
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) throw new Error("Erreur API");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = useCallback(async (id: string, status: Status) => {
    setUpdatingId(id);
    try {
      await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await fetchData();
    } finally {
      setUpdatingId(null);
    }
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.inscriptions.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || `${r.first_name} ${r.last_name} ${r.email} ${r.city} ${r.country}`.toLowerCase().includes(q);
      const matchesMatch = filterMatch === "all" || r.match_key === filterMatch;
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      return matchesSearch && matchesMatch && matchesStatus;
    });
  }, [data, search, filterMatch, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = data?.stats;
  const n = (v: string | undefined) => parseInt(v || "0", 10);

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 60px" }}>
      <style>{`
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(247,214,24,0.25); border-radius:4px; }
        * { box-sizing: border-box; }
        .admin-table-view { display: block; }
        .admin-cards-view { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 700px) {
          .admin-table-view { display: none !important; }
          .admin-cards-view { display: flex !important; }
        }
        .admin-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 14px 16px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .admin-card:hover { background: rgba(247,214,24,0.04); border-color: rgba(247,214,24,0.2); }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(7,9,15,0.92)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img src="/brand/logo.png" alt="Bloc Léopards" style={{ height: "28px", width: "auto" }} />
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "#f7d618", letterSpacing: "0.06em" }}>
              Admin · Billets
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Bloc Léopards · Backoffice
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <a href="/billets" target="_blank" rel="noopener" style={{
            padding: "9px 16px", background: "rgba(247,214,24,0.1)", border: "1px solid rgba(247,214,24,0.25)",
            borderRadius: "10px", color: "#f7d618", fontSize: "12px", fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <ExternalLink size={13} /> Voir la page billets
          </a>
          <button onClick={fetchData} type="button" style={{
            padding: "9px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "36px" }}>
          <StatCard icon={<List size={22} />} value={n(stats?.total)} label="Total inscrits" color="#a78bfa" />
          <StatCard icon={<Flag code="dk" size={18} />} value={n(stats?.denmark)} label="RDC vs Danemark" sub="3 juin · Liège" color="#60a5fa" />
          <StatCard icon={<Flag code="cl" size={18} />} value={n(stats?.chili)} label="RDC vs Chili" sub="9 juin · Marbella" color="#f87171" />
          <StatCard icon={<Clock size={22} />} value={n(stats?.pending)} label="En attente" color="#f7d618" />
          <StatCard icon={<CheckCircle size={22} />} value={n(stats?.selected)} label="Sélectionnés" color="#22c55e" />
          <StatCard icon={<Ticket size={22} />} value={n(stats?.ticket_given)} label="Billets donnés" color="#60a5fa" />
          <StatCard icon={<XCircle size={22} />} value={n(stats?.rejected)} label="Refusés" color="#f87171" />
        </div>

        {/* Filters */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "18px",
          padding: "20px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}>
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Chercher par nom, email, ville..."
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "13px",
                fontFamily: "'Sora', sans-serif",
                outline: "none",
                caretColor: "#f7d618",
              }}
            />
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>🔍</span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <FilterChip label="Tous les matchs" active={filterMatch === "all"} onClick={() => { setFilterMatch("all"); setPage(1); }} count={n(stats?.total)} />
            <FilterChip label={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Flag code="dk" size={14} /> Danemark</span>} active={filterMatch === "rdc-denmark"} onClick={() => { setFilterMatch("rdc-denmark"); setPage(1); }} count={n(stats?.denmark)} />
            <FilterChip label={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Flag code="cl" size={14} /> Chili</span>} active={filterMatch === "rdc-chili"} onClick={() => { setFilterMatch("rdc-chili"); setPage(1); }} count={n(stats?.chili)} />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <FilterChip label="Tous" active={filterStatus === "all"} onClick={() => { setFilterStatus("all"); setPage(1); }} />
            <FilterChip label="En attente" active={filterStatus === "pending"} onClick={() => { setFilterStatus("pending"); setPage(1); }} />
            <FilterChip label="Sélectionnés" active={filterStatus === "selected"} onClick={() => { setFilterStatus("selected"); setPage(1); }} />
            <FilterChip label="Billets donnés" active={filterStatus === "ticket_given"} onClick={() => { setFilterStatus("ticket_given"); setPage(1); }} />
            <FilterChip label="Refusés" active={filterStatus === "rejected"} onClick={() => { setFilterStatus("rejected"); setPage(1); }} />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>⚽</div>
            <p>Chargement des données...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#f87171" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
            <p>{error}</p>
            <button onClick={fetchData} type="button" style={{ marginTop: "16px", padding: "10px 20px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "10px", color: "#f87171", cursor: "pointer" }}>
              Réessayer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
            <p>Aucune inscription trouvée avec ces filtres.</p>
          </div>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className="admin-cards-view">
              {pageData.map((row) => (
                <div key={row.id} className="admin-card" onClick={() => setSelected(row)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{row.first_name} {row.last_name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                        <Flag code={MATCH_CONFIG[row.match_key]?.flagCode} size={13} />
                        <span style={{ fontSize: 12, color: MATCH_CONFIG[row.match_key]?.color, fontWeight: 600 }}>
                          {row.match_key === "rdc-denmark" ? "RDC vs Danemark" : "RDC vs Chili"}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{row.email}</div>
                  {row.phone && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>📱 {row.phone}</div>}
                  {(row.city || row.country) && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>📍 {[row.city, row.country].filter(Boolean).join(", ")}</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      {new Date(row.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                    <span style={{ padding: "2px 8px", background: row.source === "chatbot" ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 10, color: row.source === "chatbot" ? "#a78bfa" : "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      {row.source === "chatbot" ? "Bot" : "Form"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Table — desktop */}
            <div className="admin-table-view" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Supporter", "Match", "Bloc", "Contact", "Source", "Inscription", "Statut", "Actions"].map((h) => (
                        <th key={h} style={{
                          padding: "14px 16px",
                          textAlign: "left",
                          fontSize: "10px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.4)",
                          fontWeight: 700,
                          fontFamily: "'Sora', sans-serif",
                          whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                        onClick={() => setSelected(row)}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(247,214,24,0.04)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                      >
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, color: "#fff", fontSize: "14px" }}>
                            {row.first_name} {row.last_name}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            background: `${MATCH_CONFIG[row.match_key]?.color}18`,
                            border: `1px solid ${MATCH_CONFIG[row.match_key]?.color}40`,
                            borderRadius: "40px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: MATCH_CONFIG[row.match_key]?.color,
                          }}>
                            <Flag code={MATCH_CONFIG[row.match_key]?.flagCode} size={12} /> {row.match_key === "rdc-denmark" ? "Danemark" : "Chili"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px" }}>
                            {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row.email}
                          </div>
                          {row.phone && (
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginTop: "2px" }}>
                              💬 {row.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <span style={{
                            padding: "3px 8px",
                            background: row.source === "chatbot" ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)",
                            border: `1px solid ${row.source === "chatbot" ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: row.source === "chatbot" ? "#a78bfa" : "rgba(255,255,255,0.5)",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}>
                            {row.source === "chatbot" ? "🤖 Bot" : "📝 Form"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                            {new Date(row.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
                            {new Date(row.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <StatusBadge status={row.status} />
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                            {row.status !== "selected" && (
                              <ActionButton
                                label="✓ Sélect."
                                color="#22c55e"
                                disabled={updatingId === row.id}
                                onClick={() => updateStatus(row.id, "selected")}
                              />
                            )}
                            {row.status !== "ticket_given" && (
                              <ActionButton
                                label="🎫 Billet"
                                color="#60a5fa"
                                disabled={updatingId === row.id}
                                onClick={() => updateStatus(row.id, "ticket_given")}
                              />
                            )}
                            {row.status !== "rejected" && (
                              <ActionButton
                                label="✕"
                                color="#f87171"
                                disabled={updatingId === row.id}
                                onClick={() => updateStatus(row.id, "rejected")}
                              />
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "24px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: "9px 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    color: page === 1 ? "rgba(255,255,255,0.2)" : "#fff",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    fontSize: "13px",
                  }}
                >
                  ←
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      style={{
                        width: "36px",
                        height: "36px",
                        background: p === page ? "#f7d618" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${p === page ? "#f7d618" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: "10px",
                        color: p === page ? "#07090f" : "#fff",
                        fontWeight: p === page ? 700 : 500,
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: "9px 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    color: page === totalPages ? "rgba(255,255,255,0.2)" : "#fff",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    fontSize: "13px",
                  }}
                >
                  →
                </button>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginLeft: "8px" }}>
                  {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <RowDrawer
            row={selected}
            onClose={() => setSelected(null)}
            onUpdate={async (id, status) => {
              await updateStatus(id, status);
              setSelected(null);
            }}
            onDelete={async (id) => {
              await fetch("/api/admin/billets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
              await fetchData();
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
