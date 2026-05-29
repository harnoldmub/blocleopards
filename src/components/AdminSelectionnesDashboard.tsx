import { useState, useEffect, useCallback } from "react";

const C = {
  bg: "#07090f", card: "#0d1117", border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0", muted: "rgba(255,255,255,0.4)", yellow: "#f7d618",
};

const MATCH_CONFIG: Record<string, { label: string; date: string; location: string; color: string }> = {
  "rdc-denmark": { label: "RDC vs Danemark", date: "3 juin 2026", location: "Liège", color: "#60a5fa" },
  "rdc-chili":   { label: "RDC vs Chili",    date: "9 juin 2026", location: "Marbella", color: "#f87171" },
};

interface Inscription {
  id: string;
  match_key: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: "selected" | "ticket_given";
  ticket_given_at: string | null;
}

export default function AdminSelectionnesDashboard() {
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterMatch, setFilterMatch] = useState<string>("all");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/billets");
    if (r.status === 401) { window.location.href = "/admin/login"; return; }
    const d = await r.json();
    const sel = (d.inscriptions || []).filter(
      (i: any) => i.status === "selected" || i.status === "ticket_given"
    );
    setInscriptions(sel);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTicket = async (row: Inscription) => {
    setToggling(row.id);
    const next = row.status === "ticket_given" ? "selected" : "ticket_given";
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, status: next }),
    });
    await load();
    setToggling(null);
  };

  const filtered = filterMatch === "all"
    ? inscriptions
    : inscriptions.filter((i) => i.match_key === filterMatch);

  const byMatch = filtered.reduce((acc, row) => {
    acc[row.match_key] = acc[row.match_key] || [];
    acc[row.match_key].push(row);
    return acc;
  }, {} as Record<string, Inscription[]>);

  const totalSent = inscriptions.filter((i) => i.status === "ticket_given").length;
  const totalPending = inscriptions.filter((i) => i.status === "selected").length;

  if (loading) {
    return <div style={{ color: C.muted, padding: 60, textAlign: "center", fontSize: 14 }}>Chargement...</div>;
  }

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem,5vw,3rem)", letterSpacing: "0.04em" }}>
          Sélectionnés pour recevoir un billet
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: C.muted }}>
          Coche la case pour marquer qu'un billet a été envoyé à la personne.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Sélectionnés", value: inscriptions.length, color: "#22c55e" },
          { label: "Billets envoyés", value: totalSent, color: "#60a5fa" },
          { label: "En attente d'envoi", value: totalPending, color: C.yellow },
        ].map((s) => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${s.color}30`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Match filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { id: "all", label: "Tous les matchs" },
          { id: "rdc-denmark", label: "RDC vs Danemark" },
          { id: "rdc-chili", label: "RDC vs Chili" },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilterMatch(f.id)}
            style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${filterMatch === f.id ? C.yellow : C.border}`, background: filterMatch === f.id ? "rgba(247,214,24,0.1)" : "transparent", color: filterMatch === f.id ? C.yellow : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
      </div>

      {inscriptions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p>Aucun sélectionné pour l'instant.</p>
        </div>
      ) : (
        Object.entries(byMatch).map(([matchKey, rows]) => {
          const cfg = MATCH_CONFIG[matchKey];
          const sent = rows.filter((r) => r.status === "ticket_given").length;
          return (
            <div key={matchKey} style={{ marginBottom: 32 }}>
              {/* Match header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "12px 16px", background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`, borderRadius: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: cfg.color, letterSpacing: "0.06em" }}>{cfg.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cfg.date} · {cfg.location}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", color: "#60a5fa" }}>{sent}/{rows.length}</div>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>billets envoyés</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${rows.length ? (sent / rows.length) * 100 : 0}%`, background: "#60a5fa", borderRadius: 4, transition: "width 0.4s ease" }} />
              </div>

              {/* List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((row) => {
                  const sent = row.status === "ticket_given";
                  const busy = toggling === row.id;
                  return (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: sent ? "rgba(96,165,250,0.06)" : C.card, border: `1px solid ${sent ? "rgba(96,165,250,0.2)" : C.border}`, borderRadius: 14, transition: "all 0.2s" }}>
                      {/* Checkbox */}
                      <label style={{ display: "flex", alignItems: "center", cursor: busy ? "wait" : "pointer", flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={sent}
                          disabled={busy}
                          onChange={() => toggleTicket(row)}
                          style={{ width: 20, height: 20, accentColor: "#60a5fa", cursor: busy ? "wait" : "pointer" }}
                        />
                      </label>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: sent ? "rgba(255,255,255,0.6)" : C.text, textDecoration: sent ? "line-through" : "none" }}>
                          {row.first_name} {row.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.email}{row.city ? ` · ${row.city}` : ""}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div style={{ flexShrink: 0 }}>
                        {sent ? (
                          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(96,165,250,0.15)", color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
                            ✓ Envoyé
                          </span>
                        ) : (
                          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(247,214,24,0.1)", color: C.yellow, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
                            En attente
                          </span>
                        )}
                      </div>

                      {/* Contact */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <a href={`mailto:${row.email}`} title="Envoyer un email" style={{ padding: "6px 10px", background: "rgba(28,46,143,0.3)", borderRadius: 8, color: "#93c5fd", fontSize: 13, textDecoration: "none" }}>✉️</a>
                        {row.phone && (
                          <a href={`https://wa.me/${row.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Bonjour ${row.first_name}, ton billet pour ${cfg.label} est disponible ! Bloc Léopards 🐆🇨🇩`)}`} target="_blank" rel="noopener" title="WhatsApp" style={{ padding: "6px 10px", background: "rgba(37,211,102,0.15)", borderRadius: 8, color: "#4ade80", fontSize: 13, textDecoration: "none" }}>💬</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
