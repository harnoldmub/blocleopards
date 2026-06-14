import { useState, useEffect } from "react";
import { Ticket, Users, ShieldAlert, Sparkles, Trash2, Download, ExternalLink, RefreshCw, Check, X, ShieldCheck } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  bg: "#07090f",
  card: "#0d1117",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)",
  yellow: "#f7d618",
  blue: "#007fff",
  red: "#ce1021",
  green: "#16a34a"
};

// SVG map paths for major states containing RDC diaspora
// Scaled to 400x250 viewbox
const MAP_STATES = [
  { code: "TX", name: "Texas", path: "M 130 150 L 155 145 L 180 180 L 185 220 L 140 210 L 115 170 Z", color: "rgba(247,214,24,0.7)" },
  { code: "GA", name: "Géorgie", path: "M 275 160 L 295 160 L 290 185 L 270 180 Z", color: "rgba(0,127,255,0.6)" },
  { code: "NY", name: "New York", path: "M 320 85 L 340 75 L 345 85 L 330 95 Z", color: "rgba(226,232,240,0.5)" },
  { code: "CA", name: "Californie", path: "M 15 70 L 40 85 L 25 155 L 10 135 Z", color: "rgba(168,85,247,0.4)" },
  { code: "FL", name: "Floride", path: "M 285 190 L 305 190 L 320 225 L 305 230 L 290 205 Z", color: "rgba(249,115,22,0.3)" },
  { code: "IL", name: "Illinois", path: "M 215 95 L 230 95 L 230 125 L 215 125 Z", color: "rgba(14,165,233,0.3)" },
  { code: "WA", name: "Washington", path: "M 20 20 L 55 20 L 50 45 L 20 40 Z", color: "rgba(16,185,129,0.3)" }
];

const MATCHES = [
  { key: "houston", label: "RDC vs Portugal", details: "Houston · 17 juin 2026" },
  { key: "guadalajara", label: "RDC vs Colombie", details: "Guadalajara · 23 juin 2026" },
  { key: "atlanta", label: "RDC vs Ouzbékistan", details: "Atlanta · 27 juin 2026" }
];

const formatMatches = (matches: unknown) => {
  const keys = Array.isArray(matches) ? matches : [];
  if (keys.length === 0) return "Aucun match";
  return keys
    .map((key) => MATCHES.find((match) => match.key === key)?.label || String(key))
    .join(", ");
};

export default function AdminMondialDashboard({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [inscriptions, setInscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsCount, setTicketsCount] = useState(2); // low mock count or actual setting
  const [selectedMatch, setSelectedMatch] = useState("houston");
  const [activeTab, setActiveTab] = useState<"list" | "fraud" | "draw">("list");
  
  // Animation states for draw machine
  const [drawState, setDrawState] = useState<"idle" | "drawing" | "done">("idle");
  const [runningName, setRunningName] = useState("");
  const [drawResults, setDrawResults] = useState<any>(null);

  const [hoveredState, setHoveredState] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ id: string; filename: string; mimeType: string } | null>(null);
  const [comparePreview, setComparePreview] = useState<{
    identity: { id: string; filename: string; mimeType: string } | null;
    portrait: { id: string; filename: string; mimeType: string } | null;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "single" | "group";
    ids: string[];
    status: "verified" | "rejected";
    label: string;
  } | null>(null);
  const [confirmDanger, setConfirmDanger] = useState<{
    message: string;
    detail: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // ─── Fetching ──────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const rStats = await fetch("/api/admin/mondial/stats");
      const dStats = await rStats.json();
      setStats(dStats);
      setTicketsCount(dStats.ticketsAvailable || 500);

      const rIns = await fetch("/api/admin/mondial/inscriptions");
      const dIns = await rIns.json();
      setInscriptions(dIns.inscriptions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const askStatusChange = (ids: string[], status: "verified" | "rejected", label: string, type: "single" | "group" = "single") => {
    setConfirmAction({ type, ids, status, label });
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/mondial/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", id, status })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteInscription = (id: string, name: string) => {
    setConfirmDanger({
      message: `Supprimer l'inscription de ${name} ?`,
      detail: "Cette action est irréversible. Ses fichiers d'identité seront aussi effacés.",
      confirmLabel: "Supprimer",
      onConfirm: async () => {
        setConfirmDanger(null);
        setActionLoading(`del-${id}`);
        try {
          const res = await fetch("/api/admin/mondial/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete_inscription", id })
          });
          if (res.ok) await loadData();
          else { const d = await res.json(); alert(d.error ?? "Erreur serveur."); }
        } catch (e) { console.error(e); }
        finally { setActionLoading(null); }
      },
    });
  };

  const verifyGroup = async (groupIds: string[], groupStatus: string) => {
    setActionLoading("group");
    try {
      const res = await fetch("/api/admin/mondial/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verifyGroup", groupIds, groupStatus })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmStatusChange = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action.type === "group") {
      await verifyGroup(action.ids, action.status);
    } else {
      await updateStatus(action.ids[0], action.status);
    }
  };

  const purgeDocuments = () => {
    setConfirmDanger({
      message: "Purger toutes les pièces d'identité ?",
      detail: "Toutes les pièces d'identité des dossiers vérifiés et rejetés seront supprimées physiquement. Opération irréversible (conformité RGPD).",
      confirmLabel: "Purger les documents",
      onConfirm: async () => {
        setConfirmDanger(null);
        setActionLoading("purge");
        try {
          const res = await fetch("/api/admin/mondial/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete_documents" })
          });
          const d = await res.json();
          if (res.ok) {
            alert(`${d.deletedCount} documents d'identité supprimés en toute sécurité.`);
            await loadData();
          }
        } catch (e) {
          console.error(e);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const startDraw = async () => {
    if (!selectedMatch) {
      alert("Choisissez un match avant de lancer le tirage.");
      return;
    }
    if (!ticketsCount || ticketsCount <= 0) {
      alert("Indiquez un quota de gagnants valide.");
      return;
    }
    setDrawState("drawing");
    
    // Roller animation
    let cycles = 0;
    const interval = setInterval(() => {
      if (inscriptions.length > 0) {
        const randIndex = Math.floor(Math.random() * inscriptions.length);
        const randCand = inscriptions[randIndex];
        setRunningName(`${randCand.first_name} ${randCand.last_name} (${randCand.state_us})`);
      }
      cycles++;
      if (cycles > 40) {
        clearInterval(interval);
        finalizeDraw();
      }
    }, 60);
  };

  const finalizeDraw = async () => {
    try {
      const res = await fetch("/api/admin/mondial/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_draw", matchKey: selectedMatch, ticketsCount })
      });
      const data = await res.json();
      if (res.ok) {
        setDrawResults(data);
        setDrawState("done");
        await loadData();
      } else {
        alert(data.error || "Erreur de tirage");
        setDrawState("idle");
      }
    } catch (e) {
      console.error(e);
      setDrawState("idle");
    }
  };

  const publishResults = async (matchKey: string) => {
    setActionLoading(`publish-${matchKey}`);
    try {
      const res = await fetch("/api/admin/mondial/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", matchKey })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Les résultats de ${MATCHES.find((match) => match.key === matchKey)?.label || "ce match"} ont été publiés.`);
        await loadData();
      } else {
        alert(data.error || "Impossible de publier ce match.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Client CSV Export ──────────────────────────────────────────────────────

  const exportCSV = () => {
    const link = document.createElement("a");
    link.href = "/api/admin/mondial/export";
    link.download = `inscriptions-mondial-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Grouping Duplicates ────────────────────────────────────────────────────

  const getFraudGroups = () => {
    const groups: { [key: string]: typeof inscriptions } = {};
    inscriptions.forEach(inc => {
      if (inc.phone) {
        const key = `phone-${inc.phone}`;
        groups[key] = groups[key] || [];
        if (!groups[key].some(x => x.id === inc.id)) groups[key].push(inc);
      }
      if (inc.ip_address) {
        const key = `ip-${inc.ip_address}`;
        groups[key] = groups[key] || [];
        if (!groups[key].some(x => x.id === inc.id)) groups[key].push(inc);
      }
      if (inc.document_checksum) {
        const key = `doc-${inc.document_checksum}`;
        groups[key] = groups[key] || [];
        if (!groups[key].some(x => x.id === inc.id)) groups[key].push(inc);
      }
    });

    return Object.entries(groups)
      .map(([key, members]) => {
        let type = "";
        let isFraud = false;
        if (key.startsWith("phone-") && members.length > 1) { type = "Téléphone identique"; isFraud = true; }
        if (key.startsWith("ip-") && members.length >= 3) { type = "Même IP (3+)"; isFraud = true; }
        if (key.startsWith("doc-") && members.length > 1) { type = "Même fichier d'identité (checksum)"; isFraud = true; }
        return { key, type, members, isFraud };
      })
      .filter(g => g.isFraud);
  };

  const fraudGroups = getFraudGroups();
  const selectedMatchInfo = MATCHES.find((match) => match.key === selectedMatch);
  const selectedLatestDraw = stats?.latestDraws?.find((draw: any) => draw.match_key === selectedMatch);
  const eligibleForSelectedMatch = inscriptions.filter((inc) => {
    const matches = Array.isArray(inc.matchs_vises) ? inc.matchs_vises : [];
    return inc.verification_status === "verified" && matches.includes(selectedMatch);
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", minHeight: "50vh", color: C.muted }}>
        Chargement des outils Mondial...
      </div>
    );
  }

  return (
    <>
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text, paddingBottom: 60 }}>
      
      {/* Title block */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>EXPÉRIENCE USA</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.5rem, 5vw, 3.5rem)", letterSpacing: "0.04em", color: C.text }}>Mondial 2026 Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            onClick={purgeDocuments} 
            disabled={actionLoading === "purge"}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[#ce1021]/15 text-[#ff6b7a] border border-[#ce1021]/30 rounded-xl hover:bg-[#ce1021]/25 transition-all"
          >
            <Trash2 size={14} /> Purger Justificatifs (RGPD)
          </button>
          <button 
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-300"
          >
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Inscriptions total</div>
          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: C.yellow, marginTop: 4 }}>{stats?.total || 0}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Identités vérifiées</div>
          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: C.green, marginTop: 4 }}>{stats?.verified || 0}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Dossiers signalés</div>
          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: "#f97316", marginTop: 4 }}>{stats?.flagged || 0}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>États représentés</div>
          <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: C.blue, marginTop: 4 }}>{stats?.statesCount || 0}</div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Draw configuration info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 32 }}>
        {/* Interactive SVG US Map Heatmap */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>DENSITÉ DES INSCRITS PAR ÉTAT</h3>
          
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <svg viewBox="0 0 400 250" style={{ width: "100%", height: "auto", maxWidth: 400 }}>
              {/* Background outline mock for US continental borders */}
              <path d="M 10 30 L 380 30 L 390 180 L 300 230 L 100 200 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              
              {/* Major RDC Diaspora States mapped */}
              {MAP_STATES.map(state => {
                const stateData = stats?.stateDistribution?.find((s: any) => s.state_us === state.name);
                const count = stateData?.count || 0;
                
                return (
                  <path 
                    key={state.code}
                    d={state.path} 
                    fill={count > 0 ? state.color : "rgba(255,255,255,0.06)"}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={() => setHoveredState({ name: state.name, code: state.code, count })}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                );
              })}
            </svg>

            {/* Float Tooltip */}
            {hoveredState && (
              <div style={{ position: "absolute", top: 10, left: 10, background: "#07090f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", fontSize: 11, pointerEvents: "none" }}>
                <strong>{hoveredState.name} ({hoveredState.code})</strong>
                <div style={{ color: C.yellow, marginTop: 2 }}>{hoveredState.count} supporters inscrits</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 12, textAlign: "center" }}>
            Survolez les zones colorées pour afficher le nombre de supporters.
          </div>
        </div>

        {/* Global info draw status card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>STATUT DE SÉCURITÉ DU TIRAGE</h3>
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              Le tirage se fait match par match. Vérifiez les candidats, choisissez le match, indiquez le quota de billets, puis lancez une sélection aléatoire parmi les inscrits vérifiés pour ce match.
            </p>

            <div style={{ marginTop: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Dernier quota enregistré</div>
              <div style={{ fontSize: 14, color: C.yellow, marginTop: 4, fontWeight: 800 }}>
                {stats?.ticketsAvailable || 0} billet(s)
              </div>
            </div>

            <div style={{ marginTop: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>Mode</div>
              <div style={{ fontSize: 12, color: C.blue, marginTop: 4, fontWeight: 700 }}>
                Tirage aléatoire par match
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <span className="w-full text-center py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <ShieldCheck size={14} /> Publication match par match
            </span>
            <button 
              onClick={exportCSV}
              className="px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-slate-300 flex items-center justify-center"
              title="Exporter au format CSV"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 24, gap: 16 }}>
        <button 
          onClick={() => setActiveTab("list")}
          style={{ padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === "list" ? C.yellow : "transparent"}`, color: activeTab === "list" ? C.text : C.muted, fontWeight: activeTab === "list" ? 700 : 400, cursor: "pointer", fontSize: 13 }}
        >
          📂 Candidats
        </button>
        <button 
          onClick={() => setActiveTab("fraud")}
          style={{ padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === "fraud" ? C.yellow : "transparent"}`, color: activeTab === "fraud" ? C.text : C.muted, fontWeight: activeTab === "fraud" ? 700 : 400, cursor: "pointer", fontSize: 13 }}
        >
          🚨 Alertes Fraude ({fraudGroups.length})
        </button>
        <button 
          onClick={() => setActiveTab("draw")}
          style={{ padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === "draw" ? C.yellow : "transparent"}`, color: activeTab === "draw" ? C.text : C.muted, fontWeight: activeTab === "draw" ? 700 : 400, cursor: "pointer", fontSize: 13 }}
        >
          ⚙️ Tirage au Sort
        </button>
      </div>

      {/* TAB CONTENTS */}

      {/* TAB: CANDIDATE LIST */}
      {activeTab === "list" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
                  <th style={{ padding: "16px 20px" }}>Candidat</th>
                  <th style={{ padding: "16px 20px" }}>Résidence</th>
                  <th style={{ padding: "16px 20px" }}>Matchs</th>
                  <th style={{ padding: "16px 20px" }}>Contact</th>
                  <th style={{ padding: "16px 20px" }}>Pièce</th>
                  <th style={{ padding: "16px 20px" }}>Statut</th>
                  <th style={{ padding: "16px 20px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px 20px", textAlign: "center", color: C.muted }}>Aucune inscription enregistrée.</td>
                  </tr>
                ) : (
                  inscriptions.map((inc) => (
                    <tr key={inc.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{inc.first_name} {inc.last_name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>Né le {new Date(inc.date_of_birth).toLocaleDateString("fr-FR")}</div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div>{inc.city}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{inc.state_us} (USA)</div>
                      </td>
                      <td style={{ padding: "16px 20px", maxWidth: 190 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(Array.isArray(inc.matchs_vises) ? inc.matchs_vises : []).map((key: string) => {
                            const match = MATCHES.find((m) => m.key === key);
                            return (
                              <span
                                key={key}
                                title={match?.details}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 7px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(247,214,24,0.22)",
                                  background: "rgba(247,214,24,0.08)",
                                  color: C.yellow,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {match?.label || key}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div>{inc.email}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{inc.phone}</div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {inc.document_deleted_at ? (
                          <span style={{ color: C.muted, fontSize: 10 }}>Supprimé (RGPD)</span>
                        ) : inc.document_id ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            {inc.portrait_document_id && !inc.portrait_deleted_at ? (
                              <button
                                onClick={() => setComparePreview({
                                  identity: { id: inc.document_id, filename: inc.original_filename || "document", mimeType: inc.document_mime_type || "image/jpeg" },
                                  portrait: { id: inc.portrait_document_id, filename: inc.portrait_original_filename || "photo-portrait", mimeType: inc.portrait_mime_type || "image/jpeg" }
                                })}
                                style={{ background: "rgba(0,127,255,0.1)", border: "1px solid rgba(0,127,255,0.25)", cursor: "pointer", color: C.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 12, padding: "7px 10px", borderRadius: 8, fontWeight: 700 }}
                              >
                                Comparer pièce + photo
                              </button>
                            ) : (
                              <span style={{ color: "#f97316", fontSize: 10 }}>Photo portrait manquante</span>
                            )}
                            <button
                              onClick={() => setDocPreview({ id: inc.document_id, filename: inc.original_filename || "document", mimeType: inc.document_mime_type || "image/jpeg" })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: 0 }}
                            >
                              Voir {inc.type_document === "PASSPORT" ? "Passeport" : "Permis"}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: C.red }}>Manquante</span>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{
                          padding: "4px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                          background: inc.verification_status === "verified" ? "rgba(22,163,74,0.15)" : inc.verification_status === "flagged" ? "rgba(249,115,22,0.15)" : inc.verification_status === "rejected" ? "rgba(206,16,33,0.15)" : "rgba(255,255,255,0.06)",
                          color: inc.verification_status === "verified" ? C.green : inc.verification_status === "flagged" ? "#f97316" : inc.verification_status === "rejected" ? "#ff6b7a" : C.muted
                        }}>
                          {inc.verification_status === "verified" ? "Vérifié" : inc.verification_status === "flagged" ? "Alerte doublon" : inc.verification_status === "rejected" ? "Rejeté" : "En cours"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={() => askStatusChange([inc.id], "verified", `${inc.first_name} ${inc.last_name}`)}
                            disabled={!!actionLoading}
                            style={{ padding: 6, background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 6, color: C.green, cursor: "pointer" }}
                            title="Valider"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => askStatusChange([inc.id], "rejected", `${inc.first_name} ${inc.last_name}`)}
                            disabled={!!actionLoading}
                            style={{ padding: 6, background: "rgba(206,16,33,0.1)", border: "1px solid rgba(206,16,33,0.2)", borderRadius: 6, color: "#ff6b7a", cursor: "pointer" }}
                            title="Rejeter"
                          >
                            <X size={14} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => deleteInscription(inc.id, `${inc.first_name} ${inc.last_name}`)}
                              disabled={!!actionLoading}
                              style={{ padding: 6, background: "rgba(206,16,33,0.08)", border: "1px solid rgba(206,16,33,0.25)", borderRadius: 6, color: "#ff6b7a", cursor: "pointer", opacity: actionLoading === `del-${inc.id}` ? 0.5 : 1 }}
                              title="Supprimer l'inscription (Super Admin)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ANTI-FRAUD ALERTS */}
      {activeTab === "fraud" && (
        <div style={{ spaceY: 16 }}>
          {fraudGroups.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center", color: C.muted }}>
              Aucun signal de fraude ou doublon détecté pour le moment.
            </div>
          ) : (
            fraudGroups.map((group, index) => {
              const ids = group.members.map(m => m.id);
              return (
                <div key={index} style={{ background: C.card, border: "1px solid rgba(249,115,22,0.25)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShieldAlert size={18} style={{ color: "#f97316" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Signal : {group.type}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => askStatusChange(ids, "verified", `${ids.length} dossier(s)`, "group")}
                        className="px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-950/70 transition-all"
                      >
                        Valider Tout
                      </button>
                      <button
                        onClick={() => askStatusChange(ids, "rejected", `${ids.length} dossier(s)`, "group")}
                        className="px-3 py-1 bg-red-950/40 border border-red-500/30 text-[#ff6b7a] rounded-lg text-xs font-bold hover:bg-red-950/70 transition-all"
                      >
                        Rejeter Tout
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {group.members.map(m => (
                      <div key={m.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontSize: 11 }}>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{m.first_name} {m.last_name}</div>
                        <div style={{ color: C.muted, marginTop: 4 }}>{m.email}</div>
                        <div style={{ color: C.muted }}>{m.phone}</div>
                        <div style={{ color: C.yellow, marginTop: 6, fontWeight: 700 }}>{formatMatches(m.matchs_vises)}</div>
                        <div style={{ color: C.muted }}>IP: {m.ip_address}</div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ 
                            fontSize: 9, padding: "2px 6px", borderRadius: 4, 
                            background: m.verification_status === "verified" ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.15)",
                            color: m.verification_status === "verified" ? C.green : "#f97316"
                          }}>
                            {m.verification_status === "verified" ? "Vérifié" : "Signalé"}
                          </span>
                          
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => askStatusChange([m.id], "verified", `${m.first_name} ${m.last_name}`)}
                              style={{ padding: 4, background: "none", border: "none", color: C.green, cursor: "pointer" }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => askStatusChange([m.id], "rejected", `${m.first_name} ${m.last_name}`)}
                              style={{ padding: 4, background: "none", border: "none", color: C.red, cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: DRAW MACHINE */}
      {activeTab === "draw" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, maxWidth: 500, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 32 }}>🗳️</span>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, tracking: "0.05em", color: "#fff", marginTop: 8 }}>MACHINE DE TIRAGE MONDIAL</h3>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Sélection aléatoire par match, selon quota.</p>
          </div>

          <div style={{ spaceY: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 6 }}>1. Match à tirer *</label>
              <select
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "#fff", fontSize: 12, outline: "none" }}
              >
                {MATCHES.map((match) => (
                  <option key={match.key} value={match.key} style={{ background: "#0d1117", color: "#fff" }}>
                    {match.label} — {match.details}
                  </option>
                ))}
              </select>
              <p style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: C.muted }}>
                {eligibleForSelectedMatch.length} candidat(s) vérifié(s) sont inscrits pour {selectedMatchInfo?.label || "ce match"}.
              </p>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 6 }}>2. Quota de billets à attribuer</label>
              <input 
                type="number" 
                value={ticketsCount}
                onChange={e => setTicketsCount(parseInt(e.target.value) || 0)}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: "#fff", fontSize: 12, outline: "none" }}
              />
            </div>

            {/* Rollover Animation Box */}
            {drawState === "drawing" && (
              <div style={{ background: "rgba(247,214,24,0.05)", border: "1.5px dashed rgba(247,214,24,0.4)", borderRadius: 12, padding: 16, textAlign: "center", marginTop: 20 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: C.yellow, fontWeight: 700, letterSpacing: 1 }}>Sélection en cours...</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 8 }}>{runningName}</div>
              </div>
            )}

            {/* Results summary box */}
            {drawState === "done" && drawResults && (
              <div style={{ background: "rgba(22,163,74,0.05)", border: "1.5px solid rgba(22,163,74,0.3)", borderRadius: 12, padding: 16, marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} /> Tirage complété avec succès !
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                  Match : <strong>{selectedMatchInfo?.label}</strong>
                  <br />
                  Candidats éligibles : <strong>{drawResults.totalEligible}</strong>
                  <br />
                  Gagnants sélectionnés : <strong>{drawResults.winnersCount}</strong>
                </div>
              </div>
            )}

            {selectedLatestDraw && (
              <div style={{ background: selectedLatestDraw.published ? "rgba(22,163,74,0.05)" : "rgba(247,214,24,0.05)", border: `1px solid ${selectedLatestDraw.published ? "rgba(22,163,74,0.25)" : "rgba(247,214,24,0.25)"}`, borderRadius: 12, padding: 14, marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", fontWeight: 800 }}>Dernier tirage de ce match</div>
                    <div style={{ fontSize: 12, color: "#fff", marginTop: 4 }}>
                      {selectedLatestDraw.candidates_count} candidat(s) → {selectedLatestDraw.winners_count} sélectionné(s)
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: selectedLatestDraw.published ? C.green : C.yellow }}>
                    {selectedLatestDraw.published ? "Publié" : "Non publié"}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={startDraw}
              disabled={drawState === "drawing"}
              style={{
                width: "100%", marginTop: 24, padding: 14,
                background: C.yellow, color: "#07090f",
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
                borderRadius: 12, border: "none", cursor: drawState === "drawing" ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(247,214,24,0.25)",
                fontWeight: 700
              }}
            >
              🎲 Lancer le Tirage au Sort
            </button>

            <button
              onClick={() => publishResults(selectedMatch)}
              disabled={!selectedLatestDraw || selectedLatestDraw.published || actionLoading === `publish-${selectedMatch}`}
              style={{
                width: "100%", marginTop: 12, padding: 13,
                background: selectedLatestDraw && !selectedLatestDraw.published ? C.green : "rgba(255,255,255,0.06)",
                color: selectedLatestDraw && !selectedLatestDraw.published ? "#fff" : C.muted,
                borderRadius: 12,
                border: selectedLatestDraw && !selectedLatestDraw.published ? "1px solid rgba(22,163,74,0.35)" : `1px solid ${C.border}`,
                cursor: !selectedLatestDraw || selectedLatestDraw.published ? "not-allowed" : "pointer",
                fontWeight: 800,
                fontSize: 12
              }}
            >
              {selectedLatestDraw?.published ? "Résultats déjà publiés pour ce match" : `Publier les résultats de ${selectedMatchInfo?.label || "ce match"}`}
            </button>
          </div>
        </div>
      )}

    </div>

    {/* ── Identity / portrait comparison modal ── */}
    {confirmAction && (
      <ConfirmDialog
        icon={confirmAction.status === "verified" ? "✓" : "✕"}
        tone={confirmAction.status === "verified" ? "success" : "danger"}
        message={confirmAction.status === "verified" ? "Vérifier ce dossier ?" : "Refuser ce dossier ?"}
        detail={
          confirmAction.status === "verified"
            ? `${confirmAction.label} sera marqué comme vérifié et pourra entrer dans le tirage des matchs choisis.`
            : `${confirmAction.label} sera marqué comme refusé et ne pourra pas participer au tirage.`
        }
        confirmLabel={confirmAction.status === "verified" ? "Oui, vérifier" : "Oui, refuser"}
        onConfirm={confirmStatusChange}
        onCancel={() => setConfirmAction(null)}
      />
    )}

    {confirmDanger && (
      <ConfirmDialog
        tone="danger"
        message={confirmDanger.message}
        detail={confirmDanger.detail}
        confirmLabel={confirmDanger.confirmLabel}
        onConfirm={confirmDanger.onConfirm}
        onCancel={() => setConfirmDanger(null)}
      />
    )}

    {/* ── Identity / portrait comparison modal ── */}
    {comparePreview && (
      <div
        onClick={() => setComparePreview(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: "hidden",
            width: "100%", maxWidth: 1120,
            display: "flex", flexDirection: "column",
            maxHeight: "92vh",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Comparaison identité</p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Pièce officielle et photo portrait récente</p>
            </div>
            <button
              onClick={() => setComparePreview(null)}
              style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(206,16,33,0.1)", border: `1px solid rgba(206,16,33,0.2)`, borderRadius: 8, color: "#ff6b7a", cursor: "pointer", fontSize: 16 }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 1, background: C.border, overflow: "auto" }}>
            {[
              { label: "Pièce d'identité", doc: comparePreview.identity },
              { label: "Photo portrait", doc: comparePreview.portrait }
            ].map((panel) => (
              <div key={panel.label} style={{ background: "#000", minHeight: 420, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 12px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.yellow, textTransform: "uppercase", letterSpacing: "0.08em" }}>{panel.label}</p>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{panel.doc?.filename}</p>
                </div>
                <div style={{ flex: 1, minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
                  {panel.doc ? (
                    panel.doc.mimeType.startsWith("image/") ? (
                      <img
                        src={`/api/admin/mondial/justificatif?id=${panel.doc.id}`}
                        alt={panel.doc.filename}
                        style={{ display: "block", width: "100%", height: "100%", maxHeight: "72vh", objectFit: "contain" }}
                      />
                    ) : (
                      <iframe
                        src={`/api/admin/mondial/justificatif?id=${panel.doc.id}`}
                        style={{ width: "100%", height: "72vh", border: "none", display: "block" }}
                        title={panel.doc.filename}
                      />
                    )
                  ) : (
                    <span style={{ color: C.muted, fontSize: 12 }}>Document manquant</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Document preview modal ── */}
    {docPreview && (
      <div
        onClick={() => setDocPreview(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, overflow: "hidden",
            width: "100%", maxWidth: 560,
            display: "flex", flexDirection: "column",
            maxHeight: "90vh",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{docPreview.filename}</p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{docPreview.mimeType}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`/api/admin/mondial/justificatif?id=${docPreview.id}`}
                download={docPreview.filename}
                style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, textDecoration: "none", fontSize: 12 }}
              >
                Télécharger
              </a>
              <button
                onClick={() => setDocPreview(null)}
                style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(206,16,33,0.1)", border: `1px solid rgba(206,16,33,0.2)`, borderRadius: 8, color: "#ff6b7a", cursor: "pointer", fontSize: 16 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, overflow: "auto", background: "#000", minHeight: 200 }}>
            {docPreview.mimeType.startsWith("image/") ? (
              <img
                src={`/api/admin/mondial/justificatif?id=${docPreview.id}`}
                alt={docPreview.filename}
                style={{ display: "block", width: "100%", height: "auto", maxHeight: "75vh", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("hidden");
                }}
              />
            ) : (
              <iframe
                src={`/api/admin/mondial/justificatif?id=${docPreview.id}`}
                style={{ width: "100%", height: "75vh", border: "none", display: "block" }}
                title={docPreview.filename}
              />
            )}
            <div hidden style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
              Impossible de charger le document.<br />
              <a href={`/api/admin/mondial/justificatif?id=${docPreview.id}`} target="_blank" rel="noopener" style={{ color: C.blue, marginTop: 8, display: "inline-block" }}>Ouvrir dans un nouvel onglet</a>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
