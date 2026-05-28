import { useState, useEffect, useCallback } from "react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", green: "#34d399",
};

export default function AdminNewsletterDashboard() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const PER_PAGE = 30;

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/newsletter");
    const d = await r.json();
    setSubscribers(d.subscribers || []);
    setStats(d.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteSubscriber = async (id: string) => {
    setDeleting(id);
    await fetch("/api/admin/newsletter", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
    setDeleting(null);
  };

  const exportCsv = () => {
    const rows = [["Email", "Date"], ...subscribers.map((s) => [s.email, new Date(s.created_at).toLocaleDateString("fr-FR")])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "newsletter-bloc-leopards.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = subscribers.filter((s) => !search || s.email.toLowerCase().includes(search.toLowerCase()));
  const page_rows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const total_pages = Math.ceil(filtered.length / PER_PAGE);

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .nl-table-view { display: block; }
        .nl-cards-view { display: none; flex-direction: column; gap: 8px; }
        @media (max-width: 700px) {
          .nl-table-view { display: none !important; }
          .nl-cards-view { display: flex !important; }
        }
        .nl-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      `}</style>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em" }}>Newsletter</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", color: C.green }}>{Number(stats.total || 0)}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 2 }}>Abonnés</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", minWidth: 220 }}
        />
        <button onClick={exportCsv} style={{ marginLeft: "auto", padding: "8px 18px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ↓ Exporter CSV
        </button>
      </div>

      {/* Cards — mobile */}
      <div className="nl-cards-view">
        {page_rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun abonné</div>
        ) : page_rows.map((row) => (
          <div key={row.id} className="nl-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{row.source || "website"} · {new Date(row.created_at).toLocaleDateString("fr-FR")}</div>
            </div>
            <button onClick={() => setPendingDeleteId(row.id)} disabled={deleting === row.id} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid rgba(248,113,113,0.3)`, background: "transparent", color: "#f87171", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
              Supprimer
            </button>
          </div>
        ))}
      </div>

      {/* Table — desktop */}
      <div className="nl-table-view" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Email", "Source", "Date", ""].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page_rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun abonné</td></tr>
            ) : page_rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{row.email}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{row.source || "website"}</td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: C.muted }}>{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => setPendingDeleteId(row.id)} disabled={deleting === row.id} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(248,113,113,0.3)`, background: "transparent", color: "#f87171", fontSize: 11, cursor: "pointer", opacity: deleting === row.id ? 0.5 : 1 }}>
                    Supprimer
                  </button>
                </td>
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

      {pendingDeleteId && (
        <ConfirmDialog
          message="Supprimer cet abonné ?"
          detail="Il sera retiré définitivement de la liste newsletter."
          confirmLabel="Supprimer"
          onConfirm={() => { deleteSubscriber(pendingDeleteId); setPendingDeleteId(null); }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
