import { useState, useEffect, useCallback } from "react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", red: "#f87171",
  green: "#34d399", orange: "#fb923c", blue: "#60a5fa",
};

interface Match {
  key: string; label: string; venue: string; date: string;
  source: string; isPast: boolean; demandes: number; documents: number;
}

type PendingAction = { match: Match; scope: "documents" | "demandes" } | null;

export default function AdminMatchDataManager() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/match-data");
    const d = await r.json();
    setMatches(d.matches || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runDelete = async () => {
    if (!pending) return;
    setBusy(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/admin/match-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_key: pending.match.key, scope: pending.scope }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        const parts = [];
        if (d.purgedDocuments != null) parts.push(`${d.purgedDocuments} pièce(s) purgée(s)`);
        if (d.deletedDemandes != null) parts.push(`${d.deletedDemandes} demande(s) supprimée(s)`);
        setFeedback({ type: "ok", text: `${pending.match.label} — ${parts.join(", ") || "terminé"}.` });
        await load();
      } else {
        setFeedback({ type: "err", text: d.error || "Échec de la suppression." });
      }
    } catch {
      setFeedback({ type: "err", text: "Erreur réseau." });
    }
    setBusy(false);
    setPending(null);
  };

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice · RGPD</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em" }}>Données des matchs</h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6, maxWidth: 620, lineHeight: 1.6 }}>
          Après un match, purgez les pièces justificatives (documents d'identité, preuves de transport) ou supprimez les demandes associées. Les actions ne sont disponibles que pour les matchs passés.
        </p>
      </div>

      {feedback && (
        <div style={{ marginBottom: 18, padding: "11px 16px", borderRadius: 10, fontSize: 13,
          background: feedback.type === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${feedback.type === "ok" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
          color: feedback.type === "ok" ? C.green : C.red }}>
          {feedback.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {matches.map((m) => (
          <div key={m.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", opacity: m.isPast ? 1 : 0.7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.03em" }}>{m.label}</div>
              <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                color: m.isPast ? C.muted : C.green, background: m.isPast ? "rgba(255,255,255,0.06)" : "rgba(52,211,153,0.12)" }}>
                {m.isPast ? "Passé" : "À venir"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{m.venue} · {fmtDate(m.date)}</div>

            <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: C.blue }}>{m.demandes}</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 700 }}>Demandes</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: C.orange }}>{m.documents}</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 700 }}>Pièces</div>
              </div>
            </div>

            {m.isPast ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => setPending({ match: m, scope: "documents" })} disabled={busy || m.documents === 0}
                  style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid rgba(251,146,60,0.35)`, background: "rgba(251,146,60,0.08)", color: C.orange, fontSize: 12, fontWeight: 700, cursor: busy || m.documents === 0 ? "not-allowed" : "pointer", opacity: m.documents === 0 ? 0.4 : 1 }}>
                  Purger les pièces justificatives
                </button>
                <button onClick={() => setPending({ match: m, scope: "demandes" })} disabled={busy || m.demandes === 0}
                  style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid rgba(248,113,113,0.35)`, background: "rgba(248,113,113,0.08)", color: C.red, fontSize: 12, fontWeight: 700, cursor: busy || m.demandes === 0 ? "not-allowed" : "pointer", opacity: m.demandes === 0 ? 0.4 : 1 }}>
                  Supprimer toutes les demandes
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>Suppression disponible après le match.</div>
            )}
          </div>
        ))}
      </div>

      {pending && (
        <ConfirmDialog
          tone="danger"
          message={pending.scope === "documents"
            ? `Purger les pièces justificatives de « ${pending.match.label} » ?`
            : `Supprimer toutes les demandes de « ${pending.match.label} » ?`}
          detail={pending.scope === "documents"
            ? `${pending.match.documents} document(s) seront définitivement effacés du stockage (RGPD). Les demandes et statistiques sont conservées.`
            : pending.match.source === "mondial_usa"
              ? `Les demandes ne visant QUE ce match seront supprimées (celles visant aussi un match à venir sont conservées). Les pièces justificatives liées sont aussi purgées. Action irréversible.`
              : `Les demandes et leurs pièces justificatives seront définitivement supprimées. Action irréversible.`}
          confirmLabel={busy ? "Suppression…" : "Confirmer la suppression"}
          onConfirm={runDelete}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
