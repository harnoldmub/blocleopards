import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ConfirmDialog from "./ConfirmDialog";
import SearchableSelect from "./SearchableSelect";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", blue: "#60a5fa",
  green: "#34d399", red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};

const TAG_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "adhesion":           { label: "Adhésion",            color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "contact":            { label: "Contact",             color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  "concours_can2027":   { label: "Concours CAN 2027",   color: "#f7d618", bg: "rgba(247,214,24,0.15)" },
  "match_kinshasa":     { label: "Match Kinshasa",      color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  "mondial-2026":       { label: "Mondial",             color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "billet-houston":     { label: "Portugal (Houston)",  color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "billet-guadalajara": { label: "Colombie (Guadalajara)", color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  "billet-atlanta":     { label: "Ouzbékistan (Atlanta)", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "billet-danemark":    { label: "Danemark",            color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  "billet-chili":       { label: "Chili",               color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "import-canada-2026": { label: "Canada 2026",         color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "import-csv":         { label: "Import CSV",          color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
};

function tagStyle(tag: string) {
  if (TAG_CONFIG[tag]) return TAG_CONFIG[tag];
  return { label: tag, color: C.muted, bg: "rgba(255,255,255,0.05)" };
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function StatCard({ label, value, color = C.yellow }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );
}

/**
 * Normalise les numéros de téléphone pour WhatsApp et appels :
 * - Ajoute le préfixe international RDC (+243) si manquant (ex: 0829..., 829..., 243...)
 * - Conserve les autres indicatifs s'ils ont déjà un préfixe ou un +
 */
export function normalizePhone(raw: string | null | undefined): {
  display: string;
  waLink: string;
  telLink: string;
} | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let intl = digits;

  if (trimmed.startsWith("+")) {
    intl = digits;
  } else if (digits.startsWith("00")) {
    intl = digits.slice(2);
  } else if (digits.startsWith("243") && digits.length >= 12) {
    intl = digits;
  } else if (/^0[89]\d{8}$/.test(digits)) {
    // 08... ou 09... (10 chiffres RDC) -> +243...
    intl = "243" + digits.slice(1);
  } else if (/^[89]\d{8}$/.test(digits)) {
    // 8... ou 9... (9 chiffres RDC) -> +243...
    intl = "243" + digits;
  } else if (digits.length === 9) {
    intl = "243" + digits;
  } else if (digits.length === 10 && digits.startsWith("0")) {
    intl = "243" + digits.slice(1);
  }

  const display = `+${intl}`;
  return {
    display,
    waLink: `https://wa.me/${intl}`,
    telLink: `tel:+${intl}`,
  };
}

/* Parse CSV simple */
function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.slice(0, text.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some(c => c.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.some(c => c.trim() !== "")) rows.push(cur); }
  if (rows.length < 2) return [];

  const norm = (h: string) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const headerMap: Record<string, string> = {
    "prenom": "first_name", "first name": "first_name", "first_name": "first_name", "firstname": "first_name",
    "nom": "last_name", "last name": "last_name", "last_name": "last_name", "lastname": "last_name", "name": "last_name",
    "email": "email", "courriel": "email", "mail": "email",
    "telephone": "phone", "phone": "phone", "tel": "phone",
    "ville": "city", "city": "city",
    "pays": "country", "country": "country",
  };
  const headers = rows[0].map(h => headerMap[norm(h)] || norm(h));
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { if (h) obj[h] = (r[i] || "").trim(); });
    return obj;
  });
}

/**
 * Drawer latéral droit : Fiche d'adhésion ou fiche supporter
 */
function FicheDrawer({
  item,
  adhesion,
  onClose,
  onUpdateAdhesion,
  onOpenAdhesion,
}: {
  item: any;
  adhesion: any | null;
  onClose: () => void;
  onUpdateAdhesion: (id: string, status: string, notes: string) => Promise<void>;
  onOpenAdhesion: (adh: any) => void;
}) {
  const isAdhesion = Boolean(adhesion);
  const data = adhesion || item;

  const [status, setStatus] = useState<string>(adhesion?.status || "pending");
  const [notes, setNotes] = useState<string>(adhesion?.admin_notes || item?.notes || "");
  const [saving, setSaving] = useState(false);

  const phoneInfo = normalizePhone(data.telephone || data.phone);
  const waText = encodeURIComponent(
    isAdhesion
      ? `Bonjour ${data.prenom || data.first_name}, votre adhésion au Bloc des Léopards a bien été reçue. Bloc Léopards`
      : `Bonjour ${data.first_name || data.prenom}, le Bloc Léopards vous contacte concernant votre participation supporters.`
  );
  const waUrl = phoneInfo ? `${phoneInfo.waLink}?text=${waText}` : null;

  const handleSaveStatus = async (newStatus: string) => {
    if (!isAdhesion || !data.id) return;
    setSaving(true);
    setStatus(newStatus);
    await onUpdateAdhesion(data.id, newStatus, notes);
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    if (isAdhesion && data.id) {
      setSaving(true);
      await onUpdateAdhesion(data.id, status, notes);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 1,
          background: "#0d1117",
          border: `1px solid ${C.border}`,
          borderRadius: "20px 0 0 20px",
          width: "100%",
          maxWidth: 480,
          height: "100vh",
          overflowY: "auto",
          padding: 28,
          boxShadow: "-10px 0 40px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: isAdhesion ? "#34d399" : C.yellow, fontWeight: 700, marginBottom: 4 }}>
              {isAdhesion ? "📋 Fiche d'Adhésion" : "👤 Fiche Supporter"}
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: C.text, letterSpacing: "0.04em", margin: 0, lineHeight: 1 }}>
              {data.prenom || data.first_name} {data.nom || data.last_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 26, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Boutons d'actions rapides (WhatsApp + Email) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 16px",
                background: "#25d366",
                borderRadius: 12,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                minWidth: 140,
                boxShadow: "0 2px 8px rgba(37,211,102,0.3)",
              }}
            >
              <span>💬 Ouvrir WhatsApp</span>
            </a>
          ) : (
            <div style={{ flex: 1, padding: "11px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12, textAlign: "center" }}>
              Pas de téléphone
            </div>
          )}

          {(data.email) && (
            <a
              href={`mailto:${data.email}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "11px 16px",
                background: "rgba(96,165,250,0.12)",
                border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 12,
                color: C.blue,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <span>✉️ Écrire</span>
            </a>
          )}
        </div>

        {/* Si c'est une adhésion : Gestion du statut */}
        {isAdhesion && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 10 }}>
              Statut de l'adhésion : <span style={{ color: status === "validated" ? "#34d399" : status === "rejected" ? "#f87171" : C.yellow }}>{status === "validated" ? "Validé" : status === "rejected" ? "Rejeté" : "En attente"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSaveStatus("pending")}
                disabled={saving}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: status === "pending" ? "rgba(247,214,24,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status === "pending" ? C.yellow : C.border}`,
                  color: status === "pending" ? C.yellow : C.muted,
                }}
              >
                En attente
              </button>
              <button
                type="button"
                onClick={() => handleSaveStatus("validated")}
                disabled={saving}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: status === "validated" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status === "validated" ? "#34d399" : C.border}`,
                  color: status === "validated" ? "#34d399" : C.muted,
                }}
              >
                ✓ Valider
              </button>
              <button
                type="button"
                onClick={() => handleSaveStatus("rejected")}
                disabled={saving}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: status === "rejected" ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${status === "rejected" ? "#f87171" : C.border}`,
                  color: status === "rejected" ? "#f87171" : C.muted,
                }}
              >
                ✕ Rejeter
              </button>
            </div>
          </div>
        )}

        {/* Détails du contact */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
            Coordonnées
          </div>
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <div>
              <span style={{ color: C.muted, display: "block", fontSize: 11 }}>Téléphone / WhatsApp :</span>
              <span style={{ fontWeight: 600, color: phoneInfo ? "#25d366" : C.muted }}>
                {phoneInfo?.display || data.telephone || data.phone || "—"}
              </span>
            </div>
            <div>
              <span style={{ color: C.muted, display: "block", fontSize: 11 }}>Email :</span>
              <span style={{ fontWeight: 600 }}>{data.email || "—"}</span>
            </div>
            <div>
              <span style={{ color: C.muted, display: "block", fontSize: 11 }}>Ville & Pays :</span>
              <span style={{ fontWeight: 600 }}>{[data.ville || data.city, data.pays || data.country].filter(Boolean).join(", ") || "—"}</span>
            </div>
            {data.role && (
              <div>
                <span style={{ color: C.muted, display: "block", fontSize: 11 }}>Rôle / Pôle :</span>
                <span style={{ fontWeight: 700, color: C.blue }}>{data.role}</span>
              </div>
            )}
            {data.created_at && (
              <div>
                <span style={{ color: C.muted, display: "block", fontSize: 11 }}>Date d'enregistrement :</span>
                <span style={{ color: C.muted, fontSize: 12 }}>
                  {new Date(data.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Motivation / Message si présent */}
        {(data.motivation || data.message) && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>
              {isAdhesion ? "Motivation du membre" : "Message / Motivation"}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6, fontStyle: "italic" }}>
              « {data.motivation || data.message} »
            </p>
          </div>
        )}

        {/* Si fiche supporter et qu'une adhésion existe : Bouton de bascule */}
        {!isAdhesion && adhesion && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => onOpenAdhesion(adhesion)}
              style={{
                width: "100%",
                padding: "12px",
                background: "rgba(52,211,153,0.15)",
                border: "1px solid rgba(52,211,153,0.4)",
                borderRadius: 12,
                color: "#34d399",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>📋 Consulter la Fiche d'Adhésion correspondante →</span>
            </button>
          </div>
        )}

        {/* Segments / Tags */}
        {Array.isArray(item?.tags) && item.tags.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 10 }}>
              Segments associés
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.map((t: string) => {
                const ts = tagStyle(t);
                return <Badge key={t} text={ts.label} color={ts.color} bg={ts.bg} />;
              })}
            </div>
          </div>
        )}

        {/* Notes administratives */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>
            Notes / Remarques
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ajouter une note administrative (suivi WhatsApp, validation...)"
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 10,
              color: C.text,
              fontSize: 12,
              fontFamily: "'Sora', sans-serif",
              resize: "vertical",
              outline: "none",
            }}
          />
          {isAdhesion && (
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={saving}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background: C.yellow,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {saving ? "Sauvegarde..." : "Enregistrer la note"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSupportersDashboard() {
  const [supporters, setSupporters] = useState<any[]>([]);
  const [adhesions, setAdhesions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState<number>(25);
  const [toDelete, setToDelete] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // État du Drawer latéral
  const [activeFiche, setActiveFiche] = useState<{ item: any; adhesion: any | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [rSup, rAdh] = await Promise.all([
        fetch("/api/admin/supporters"),
        fetch("/api/admin/adhesions").catch(() => null),
      ]);
      const dSup = await rSup.json();
      setSupporters(dSup.supporters || []);
      setStats(dSup.stats || {});

      if (rAdh && rAdh.ok) {
        const dAdh = await rAdh.json();
        setAdhesions(dAdh.adhesions || []);
      }
    } catch (err) {
      console.error("Erreur de chargement des supporters:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Associer un supporter à son adhésion éventuelle
  const findAdhesionForSupporter = useCallback((s: any) => {
    if (!adhesions || !adhesions.length) return null;
    const cleanDigits = (p: string) => (p || "").replace(/\D/g, "").slice(-8);
    const sPhone = cleanDigits(s.phone);
    const sEmail = (s.email || "").toLowerCase().trim();
    const sFirst = (s.first_name || "").toLowerCase().trim();
    const sLast = (s.last_name || "").toLowerCase().trim();

    return adhesions.find((a: any) => {
      if (sEmail && a.email && a.email.toLowerCase().trim() === sEmail) return true;
      if (sPhone && a.telephone && cleanDigits(a.telephone) === sPhone) return true;
      const aFirst = (a.prenom || "").toLowerCase().trim();
      const aLast = (a.nom || "").toLowerCase().trim();
      if (sFirst && sLast && aFirst === sFirst && aLast === sLast) return true;
      return false;
    }) || null;
  }, [adhesions]);

  // Mise à jour de statut d'adhésion depuis le Drawer
  const handleUpdateAdhesion = async (id: string, status: string, notes: string) => {
    try {
      await fetch("/api/admin/adhesion-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, notes }),
      });
      await load();
    } catch (err) {
      console.error("Erreur mise à jour adhésion:", err);
    }
  };

  const countOptions = (values: string[]) => {
    const counts = new Map<string, number>();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  };

  const countries = useMemo(() => countOptions(supporters.map(s => s.country).filter(Boolean)), [supporters]);
  const cities = useMemo(() => countOptions(supporters.map(s => s.city).filter(Boolean)), [supporters]);
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    supporters.forEach(s => (Array.isArray(s.tags) ? s.tags : []).forEach((t: string) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => {
        const am = a[0].startsWith("billet-") ? 0 : 1;
        const bm = b[0].startsWith("billet-") ? 0 : 1;
        return am - bm || a[0].localeCompare(b[0]);
      })
      .map(([value, count]) => ({ value, label: tagStyle(value).label, count }));
  }, [supporters]);

  const filtered = useMemo(() => supporters
    .filter(s => filterCountry === "all" || s.country === filterCountry)
    .filter(s => filterCity === "all" || s.city === filterCity)
    .filter(s => filterTag === "all" || (Array.isArray(s.tags) && s.tags.includes(filterTag)))
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${s.first_name} ${s.last_name} ${s.email || ""} ${s.phone || ""} ${s.city || ""}`.toLowerCase().includes(q);
    }), [supporters, filterCountry, filterCity, filterTag, search]);

  const pageRows = useMemo(() => {
    return filtered.slice(page * perPage, (page + 1) * perPage);
  }, [filtered, page, perPage]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const resetPage = () => setPage(0);

  const deleteSupporter = async (id: number) => {
    await fetch("/api/admin/supporters", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  };

  const exportCsv = () => {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Prénom", "Nom", "Email", "Téléphone", "Ville", "Pays", "Tags", "Notes"];
    const lines = filtered.map(s => [
      s.first_name, s.last_name, s.email || "", s.phone || "", s.city || "",
      s.country || "",
      (Array.isArray(s.tags) ? s.tags : []).map((t: string) => tagStyle(t).label).join(" | "),
      s.notes || "",
    ].map(esc).join(","));
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = filterTag !== "all" ? `-${filterTag}` : "";
    a.download = `supporters${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportStatus("Lecture du fichier...");
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setImportStatus("Aucune ligne détectée. Vérifiez les entêtes (prenom, nom, email, telephone, ville, pays).");
        setImporting(false);
        return;
      }
      const country = window.prompt(`${rows.length} lignes détectées. Pays par défaut de cette liste ?`, "Canada");
      if (country === null) { setImportStatus(""); setImporting(false); return; }

      setImportStatus(`Import de ${rows.length} lignes en cours...`);
      const r = await fetch("/api/admin/supporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, country }),
      });
      const d = await r.json();
      if (d.success) {
        setImportStatus(`Import terminé : ${d.inserted} ajoutés, ${d.skipped} ignorés (doublons ou incomplets).`);
        await load();
      } else {
        setImportStatus(d.error || "Erreur lors de l'import.");
      }
    } catch {
      setImportStatus("Erreur de lecture du fichier.");
    }
    setImporting(false);
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .sup-table-view { display: block; }
        .sup-cards-view { display: none; flex-direction: column; gap: 10px; }
        @media (max-width: 768px) {
          .sup-table-view { display: none !important; }
          .sup-cards-view { display: flex !important; }
        }
        .sup-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 16px; }
        .sup-row { transition: background 0.15s ease; }
        .sup-row:hover { background: rgba(255,255,255,0.02); }
      `}</style>

      {/* Titre & Actions globales */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text, margin: 0 }}>Supporters</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1.5px solid rgba(96,165,250,0.3)`, background: "rgba(96,165,250,0.08)", color: C.blue, fontSize: 12, fontWeight: 700, cursor: importing ? "wait" : "pointer" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importer CSV
          </button>
          <button onClick={exportCsv} disabled={filtered.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: `1.5px solid rgba(52,211,153,0.3)`, background: "rgba(52,211,153,0.08)", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: filtered.length === 0 ? 0.5 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {importStatus && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 10, color: C.blue, fontSize: 13 }}>
          {importStatus}
        </div>
      )}

      {/* Cartes de statistiques */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total" value={Number(stats.total || 0)} />
        <StatCard label="Pays" value={Number(stats.countries || 0)} color={C.blue} />
        <StatCard label="Avec email" value={Number(stats.with_email || 0)} color={C.green} />
        <StatCard label="Avec téléphone" value={Number(stats.with_phone || 0)} color={C.purple} />
      </div>

      {/* Barre de filtres + Nombre de résultats par page */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchableSelect value={filterCountry} onChange={v => { setFilterCountry(v); resetPage(); }}
          options={countries} placeholder="Tous les pays" searchPlaceholder="Chercher un pays..." />
        <SearchableSelect value={filterCity} onChange={v => { setFilterCity(v); resetPage(); }}
          options={cities} placeholder="Toutes les villes" searchPlaceholder="Chercher une ville..." />
        <SearchableSelect value={filterTag} onChange={v => { setFilterTag(v); resetPage(); }}
          options={allTags} placeholder="Tous les segments" searchPlaceholder="Chercher un segment..." />

        {/* Sélecteur de nombre de résultats par page */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "2px 10px", height: 38 }}>
          <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Par page :</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              resetPage();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: C.yellow,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Sora', sans-serif",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value={25} style={{ background: "#0d1117", color: "#fff" }}>25</option>
            <option value={50} style={{ background: "#0d1117", color: "#fff" }}>50</option>
            <option value={100} style={{ background: "#0d1117", color: "#fff" }}>100</option>
            <option value={200} style={{ background: "#0d1117", color: "#fff" }}>200</option>
            <option value={10000} style={{ background: "#0d1117", color: "#fff" }}>Tous ({filtered.length})</option>
          </select>
        </div>

        {/* Recherche */}
        <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
          placeholder="Rechercher..."
          style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 200 }} />

        <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Mobile cards view */}
      <div className="sup-cards-view">
        {pageRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</div>
        ) : pageRows.map(s => {
          const phoneInfo = normalizePhone(s.phone);
          const adh = findAdhesionForSupporter(s);
          return (
            <div key={s.id} className="sup-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.first_name} {s.last_name}</div>
                <button
                  onClick={() => setActiveFiche({ item: s, adhesion: adh })}
                  style={{
                    background: "rgba(247,214,24,0.12)",
                    border: "1px solid rgba(247,214,24,0.3)",
                    color: C.yellow,
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Fiche →
                </button>
              </div>

              {/* Contacts séparés */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {s.email && (
                  <a
                    href={`mailto:${s.email}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: C.blue,
                      textDecoration: "none",
                      fontSize: 12,
                    }}
                  >
                    <span>✉️</span>
                    <span>{s.email}</span>
                  </a>
                )}
                {phoneInfo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a
                      href={phoneInfo.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        background: "rgba(37,211,102,0.15)",
                        border: "1px solid rgba(37,211,102,0.4)",
                        borderRadius: 6,
                        color: "#25d366",
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      <span>💬 WhatsApp</span>
                    </a>
                    <a href={phoneInfo.telLink} style={{ color: C.muted, fontSize: 11, textDecoration: "none" }}>
                      {phoneInfo.display}
                    </a>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{[s.city, s.country].filter(Boolean).join(", ")}</div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {(Array.isArray(s.tags) ? s.tags : []).map((t: string) => {
                  const ts = tagStyle(t);
                  if (t === "adhesion") {
                    return (
                      <button
                        key={t}
                        onClick={() => setActiveFiche({ item: s, adhesion: adh })}
                        title="Ouvrir la fiche d'adhésion"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#34d399",
                          background: "rgba(52,211,153,0.18)",
                          border: "1px solid rgba(52,211,153,0.4)",
                          cursor: "pointer",
                        }}
                      >
                        <span>✓ Adhésion ↗</span>
                      </button>
                    );
                  }
                  return <Badge key={t} text={ts.label} color={ts.color} bg={ts.bg} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="sup-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.01)" }}>
              {["Nom", "Contact (WhatsApp & Email)", "Ville", "Pays", "Segments", "Actions"].map((h, i) => (
                <th key={i} style={{ padding: "14px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</td></tr>
            ) : pageRows.map(s => {
              const phoneInfo = normalizePhone(s.phone);
              const adh = findAdhesionForSupporter(s);
              return (
                <tr
                  key={s.id}
                  className="sup-row"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                  title={s.notes || undefined}
                >
                  {/* Nom complet */}
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: C.text }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{s.first_name} {s.last_name}</span>
                    </div>
                  </td>

                  {/* Contact : Email et WhatsApp séparés avec formatage + */}
                  <td style={{ padding: "14px 16px", fontSize: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                      {/* Email séparé */}
                      {s.email && (
                        <a
                          href={`mailto:${s.email}`}
                          title={`Envoyer un email (${s.email})`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#93c5fd",
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "rgba(96,165,250,0.08)",
                            border: "1px solid rgba(96,165,250,0.18)",
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ fontSize: 11 }}>✉️</span>
                          <span style={{ textDecoration: "underline" }}>{s.email}</span>
                        </a>
                      )}

                      {/* Numéro WhatsApp avec + ajouté si manquant et lien direct */}
                      {phoneInfo && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <a
                            href={phoneInfo.waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Ouvrir WhatsApp avec ${phoneInfo.display}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "rgba(37,211,102,0.16)",
                              border: "1px solid rgba(37,211,102,0.4)",
                              color: "#25d366",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }}
                          >
                            <span>💬 WhatsApp</span>
                          </a>
                          <a
                            href={phoneInfo.telLink}
                            title={`Appeler ${phoneInfo.display}`}
                            style={{
                              color: C.text,
                              fontSize: 11,
                              textDecoration: "none",
                              fontFamily: "'Sora', monospace",
                              letterSpacing: "0.02em",
                              opacity: 0.9,
                            }}
                          >
                            {phoneInfo.display}
                          </a>
                        </div>
                      )}

                      {!s.email && !s.phone && <span style={{ color: C.muted }}>—</span>}
                    </div>
                  </td>

                  {/* Ville */}
                  <td style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>
                    {s.city || "—"}
                  </td>

                  {/* Pays */}
                  <td style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>
                    {s.country || "Non renseigné"}
                  </td>

                  {/* Segments (avec bouton adhésion cliquable pour ouvrir la fiche à droite) */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      {(Array.isArray(s.tags) ? s.tags : []).map((t: string) => {
                        const ts = tagStyle(t);
                        if (t === "adhesion") {
                          return (
                            <button
                              key={t}
                              onClick={() => setActiveFiche({ item: s, adhesion: adh })}
                              title="Cliquer pour ouvrir la fiche d'adhésion à droite"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#34d399",
                                background: "rgba(52,211,153,0.18)",
                                border: "1px solid rgba(52,211,153,0.45)",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(52,211,153,0.3)";
                                e.currentTarget.style.transform = "scale(1.05)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(52,211,153,0.18)";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              <span>✓ Adhésion</span>
                              <span style={{ fontSize: 10 }}>↗</span>
                            </button>
                          );
                        }
                        return <Badge key={t} text={ts.label} color={ts.color} bg={ts.bg} />;
                      })}
                    </div>
                  </td>

                  {/* Actions : Bouton Fiche (ouvre à droite) + Bouton Supprimer */}
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        onClick={() => setActiveFiche({ item: s, adhesion: adh })}
                        title="Ouvrir la fiche à droite"
                        style={{
                          background: "rgba(247,214,24,0.08)",
                          border: "1px solid rgba(247,214,24,0.3)",
                          borderRadius: 8,
                          color: C.yellow,
                          cursor: "pointer",
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(247,214,24,0.18)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(247,214,24,0.08)")}
                      >
                        <span>Fiche</span>
                        <span style={{ fontSize: 10 }}>→</span>
                      </button>

                      <button
                        onClick={() => setToDelete(s)}
                        title="Supprimer"
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(248,113,113,0.5)",
                          cursor: "pointer",
                          padding: 5,
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(248,113,113,0.5)")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination avec sélecteur de pages */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.muted }}>
            Affichage de <strong>{page * perPage + 1}</strong> à <strong>{Math.min((page + 1) * perPage, filtered.length)}</strong> sur <strong>{filtered.length}</strong> supporters
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: page === 0 ? "rgba(255,255,255,0.2)" : C.text,
                fontSize: 12,
                cursor: page === 0 ? "default" : "pointer",
              }}
            >
              ← Précédent
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${page === i ? C.yellow : C.border}`,
                  background: page === i ? "rgba(247,214,24,0.12)" : "transparent",
                  color: page === i ? C.yellow : C.muted,
                  fontSize: 12,
                  fontWeight: page === i ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: page === totalPages - 1 ? "rgba(255,255,255,0.2)" : C.text,
                fontSize: 12,
                cursor: page === totalPages - 1 ? "default" : "pointer",
              }}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Drawer latéral droit pour afficher la fiche */}
      {activeFiche && (
        <FicheDrawer
          item={activeFiche.item}
          adhesion={activeFiche.adhesion}
          onClose={() => setActiveFiche(null)}
          onUpdateAdhesion={handleUpdateAdhesion}
          onOpenAdhesion={(adh) => setActiveFiche(prev => prev ? { ...prev, adhesion: adh } : null)}
        />
      )}

      {/* Boîte de confirmation pour suppression */}
      {toDelete && (
        <ConfirmDialog
          message={`Supprimer ${toDelete.first_name} ${toDelete.last_name} ?`}
          detail="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => { deleteSupporter(toDelete.id); setToDelete(null); }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
