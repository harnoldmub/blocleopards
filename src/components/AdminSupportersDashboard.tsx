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

/* Parse CSV simple, gère guillemets et virgules/points-virgules */
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

  // Mapping souple des entêtes
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

export default function AdminSupportersDashboard() {
  const [supporters, setSupporters] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [toDelete, setToDelete] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const PER_PAGE = 25;

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/supporters");
    const d = await r.json();
    setSupporters(d.supporters || []);
    setStats(d.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    // Matchs d'abord, puis le reste
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

  const pageRows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
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
        @media (max-width: 700px) {
          .sup-table-view { display: none !important; }
          .sup-cards-view { display: flex !important; }
        }
        .sup-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 16px; }
      `}</style>

      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Supporters</h1>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total" value={Number(stats.total || 0)} />
        <StatCard label="Pays" value={Number(stats.countries || 0)} color={C.blue} />
        <StatCard label="Avec email" value={Number(stats.with_email || 0)} color={C.green} />
        <StatCard label="Avec téléphone" value={Number(stats.with_phone || 0)} color={C.purple} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchableSelect value={filterCountry} onChange={v => { setFilterCountry(v); resetPage(); }}
          options={countries} placeholder="Tous les pays" searchPlaceholder="Chercher un pays..." />
        <SearchableSelect value={filterCity} onChange={v => { setFilterCity(v); resetPage(); }}
          options={cities} placeholder="Toutes les villes" searchPlaceholder="Chercher une ville..." />
        <SearchableSelect value={filterTag} onChange={v => { setFilterTag(v); resetPage(); }}
          options={allTags} placeholder="Tous les segments" searchPlaceholder="Chercher un segment..." />
        <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
          placeholder="Rechercher..."
          style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 180 }} />
        {filtered.length !== supporters.length && (
          <span style={{ fontSize: 12, color: C.muted }}>{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sup-cards-view">
        {pageRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</div>
        ) : pageRows.map(s => (
          <div key={s.id} className="sup-card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.first_name} {s.last_name}</div>
            {s.email && <div style={{ fontSize: 12, color: C.muted }}>{s.email}</div>}
            {s.phone && <div style={{ fontSize: 12, color: C.muted }}>{s.phone}</div>}
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{[s.city, s.country].filter(Boolean).join(", ")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Array.isArray(s.tags) ? s.tags : []).map((t: string) => {
                const ts = tagStyle(t);
                return <Badge key={t} text={ts.label} color={ts.color} bg={ts.bg} />;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="sup-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Nom", "Contact", "Ville", "Pays", "Segments", ""].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun résultat</td></tr>
            ) : pageRows.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }} title={s.notes || undefined}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{s.first_name} {s.last_name}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
                  {s.email && <div>{s.email}</div>}
                  {s.phone && <div>{s.phone}</div>}
                  {!s.email && !s.phone && "—"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{s.city || "—"}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{s.country || "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(Array.isArray(s.tags) ? s.tags : []).map((t: string) => {
                      const ts = tagStyle(t);
                      return <Badge key={t} text={ts.label} color={ts.color} bg={ts.bg} />;
                    })}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => setToDelete(s)} title="Supprimer"
                    style={{ background: "none", border: "none", color: "rgba(248,113,113,0.5)", cursor: "pointer", padding: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
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
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${page === i ? C.yellow : C.border}`, background: page === i ? "rgba(247,214,24,0.12)" : "transparent", color: page === i ? C.yellow : C.muted, fontSize: 12, cursor: "pointer" }}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

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
