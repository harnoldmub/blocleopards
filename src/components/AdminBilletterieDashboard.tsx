import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  card: "#0d1117",
  raised: "#121a29",
  border: "rgba(255,255,255,0.08)",
  text: "#e2e8f0",
  muted: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.38)",
  yellow: "#f7d618",
  blue: "#4aa3ff",
  green: "#34d399",
  red: "#f87171",
};
const FONT = "'Sora', sans-serif";
const PAGE_SIZE = 50;

type Status = "pending" | "paid" | "cancelled";

interface Reservation {
  reservation_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  whatsapp: string | null;
  country: string | null;
  quantity: number;
  total_price_fc: number;
  status: Status;
  created_at: string;
  match_key: string;
}

interface Match {
  key: string;
  label: string;
  date: string;
  venue: string;
  current: boolean;
}

const STATUS: Record<Status, { label: string; color: string; bg: string }> = {
  pending: { label: "À retirer", color: C.yellow, bg: "rgba(247,214,24,0.12)" },
  paid: { label: "Retirée et payée", color: C.green, bg: "rgba(52,211,153,0.12)" },
  cancelled: { label: "Annulée", color: C.red, bg: "rgba(248,113,113,0.12)" },
};

const FILTERS: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "pending", label: "À retirer" },
  { id: "paid", label: "Retirées" },
  { id: "cancelled", label: "Annulées" },
];

const fc = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} FC`;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function StatCard({ label, value, hint, color = "#fff" }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "clamp(17px, 4.6vw, 26px)", fontWeight: 800, color, marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

export default function AdminBilletterieDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [matchKey, setMatchKey] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/billetterie");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Impossible de charger les réservations.");
      setMatches(data.matches || []);
      setRows(data.reservations || []);
      setMatchKey((prev) => prev || data.matches?.find((m: Match) => m.current)?.key || data.matches?.[0]?.key || "");
    } catch (error: any) {
      setLoadError(error instanceof TypeError ? "Connexion interrompue. Vérifiez votre réseau." : error?.message || "Impossible de charger les réservations.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => { setPage(1); }, [matchKey, filter, query]);

  const countByMatch = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => { map[r.match_key] = (map[r.match_key] || 0) + 1; });
    return map;
  }, [rows]);

  const matchRows = useMemo(() => rows.filter((r) => r.match_key === matchKey), [rows, matchKey]);

  const stats = useMemo(() => {
    const active = matchRows.filter((r) => r.status !== "cancelled");
    const paid = matchRows.filter((r) => r.status === "paid");
    const sum = (list: Reservation[], key: "quantity" | "total_price_fc") => list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return {
      reservations: active.length,
      tickets: sum(active, "quantity"),
      expected: sum(active, "total_price_fc"),
      paidCount: paid.length,
      paidTickets: sum(paid, "quantity"),
      collected: sum(paid, "total_price_fc"),
      cancelled: matchRows.length - active.length,
    };
  }, [matchRows]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return matchRows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return normalize(`${r.first_name} ${r.last_name} ${r.reservation_code} ${r.whatsapp || ""} ${r.country || ""}`).includes(q);
    });
  }, [matchRows, filter, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const currentMatch = matches.find((m) => m.key === matchKey);

  const setStatus = async (row: Reservation, status: Status) => {
    setBusy(row.reservation_code);
    try {
      const res = await fetch("/api/admin/billetterie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: row.reservation_code, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "La mise à jour a échoué.");
      setRows((prev) => prev.map((r) => (r.reservation_code === row.reservation_code ? { ...r, status } : r)));
      setToast({ kind: "ok", text: `${row.reservation_code} : ${STATUS[status].label.toLowerCase()}.` });
    } catch (error: any) {
      setToast({ kind: "err", text: error instanceof TypeError ? "Connexion interrompue. Rien n'a été modifié." : error?.message || "La mise à jour a échoué." });
    }
    setBusy("");
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Dossier", "Prénom", "Nom", "WhatsApp", "Pays", "Billets", "Total FC", "Statut", "Date"].map(esc).join(";"),
      ...visible.map((r) =>
        [r.reservation_code, r.first_name, r.last_name, r.whatsapp, r.country, r.quantity, r.total_price_fc, STATUS[r.status]?.label, dateFmt.format(new Date(r.created_at))].map(esc).join(";")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `billetterie-${matchKey}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast({ kind: "ok", text: `${visible.length} réservation${visible.length > 1 ? "s" : ""} exportée${visible.length > 1 ? "s" : ""}.` });
  };

  const btn = (active = false): React.CSSProperties => ({
    minHeight: 40, padding: "0 14px", borderRadius: 10, cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 700,
    border: `1px solid ${active ? "rgba(247,214,24,0.5)" : C.border}`,
    background: active ? "rgba(247,214,24,0.12)" : "transparent",
    color: active ? C.yellow : C.text, whiteSpace: "nowrap",
  });
  const rowBtn = (color: string): React.CSSProperties => ({
    minHeight: 36, padding: "0 12px", borderRadius: 9, cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 700,
    border: `1px solid ${color}55`, background: `${color}14`, color, whiteSpace: "nowrap",
  });

  return (
    <div style={{ color: C.text, fontFamily: FONT }} className="bt-admin">
      <style>{`
        .bt-admin button:focus-visible, .bt-admin a:focus-visible, .bt-admin input:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .bt-admin button:disabled { opacity: .45; cursor: not-allowed; }
        .bt-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .bt-row { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1.1fr) 5.5rem 7.5rem 9.5rem auto; gap: 14px; align-items: center; padding: 14px 18px; border-top: 1px solid ${C.border}; }
        .bt-head { border-top: 0; color: ${C.faint}; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
        .bt-actions { display: flex; gap: 8px; justify-content: flex-end; min-width: 13.5rem; }
        .bt-skeleton { height: 58px; border-radius: 12px; background: linear-gradient(90deg, #0d1117 0%, #161f30 50%, #0d1117 100%); background-size: 200% 100%; animation: bt-shimmer 1.4s linear infinite; }
        @keyframes bt-shimmer { to { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) { .bt-skeleton { animation: none; } }
        @media (max-width: 1100px) {
          .bt-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .bt-head { display: none; }
          .bt-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; padding: 14px; }
          .bt-row > .bt-actions { grid-column: 1 / -1; justify-content: flex-start; min-width: 0; flex-wrap: wrap; }
          .bt-cell-date { display: none; }
        }
      `}</style>

      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        <div>
          <p style={{ color: C.yellow, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", marginBottom: 6 }}>BILLETTERIE</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>Réservations par match</h1>
          {currentMatch && <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{currentMatch.date} · {currentMatch.venue}</p>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href="/billetterie" style={{ ...btn(), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Voir la billetterie</a>
          <a href="/billetterie/inscriptions" style={{ ...btn(), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Liste d'émargement</a>
          <button type="button" style={btn()} onClick={load} disabled={loading}>{loading ? "Chargement…" : "Actualiser"}</button>
        </div>
      </header>

      {/* Un onglet par match */}
      <div role="tablist" aria-label="Match" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {matches.map((m) => {
          const active = m.key === matchKey;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMatchKey(m.key)}
              style={{
                flex: "none", textAlign: "left", padding: "12px 16px", borderRadius: 14, cursor: "pointer", fontFamily: FONT,
                border: `1.5px solid ${active ? C.yellow : C.border}`,
                background: active ? "rgba(247,214,24,0.08)" : C.card, color: C.text,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                {m.label}
                {m.current && <span style={{ padding: "2px 8px", borderRadius: 20, background: C.yellow, color: "#0b1730", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>EN COURS</span>}
              </span>
              <span style={{ display: "block", marginTop: 3, fontSize: 12, color: C.muted }}>
                {m.date.split(" · ")[0]} · {(countByMatch[m.key] || 0).toLocaleString("fr-FR")} réservation{(countByMatch[m.key] || 0) > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {loadError ? (
        <div role="alert" style={{ padding: 28, borderRadius: 16, border: `1px solid rgba(248,113,113,0.35)`, background: "rgba(248,113,113,0.08)", textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Les réservations n'ont pas pu être chargées</p>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>{loadError}</p>
          <button type="button" style={btn(true)} onClick={load}>Réessayer</button>
        </div>
      ) : (
        <>
          <div className="bt-stats" style={{ marginBottom: 16 }}>
            <StatCard label="Réservations" value={loading ? "–" : stats.reservations.toLocaleString("fr-FR")} hint={stats.cancelled ? `${stats.cancelled} annulée${stats.cancelled > 1 ? "s" : ""} en plus` : "Hors annulations"} />
            <StatCard label="Billets demandés" value={loading ? "–" : stats.tickets.toLocaleString("fr-FR")} hint="Hors annulations" />
            <StatCard label="Retirées et payées" value={loading ? "–" : `${stats.paidCount.toLocaleString("fr-FR")} / ${stats.reservations.toLocaleString("fr-FR")}`} hint={`${stats.paidTickets.toLocaleString("fr-FR")} billet${stats.paidTickets > 1 ? "s" : ""} remis`} color={C.green} />
            <StatCard label="Encaissé" value={loading ? "–" : fc(stats.collected)} hint={`sur ${fc(stats.expected)} attendus`} color={C.yellow} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <label style={{ flex: "1 1 16rem", minWidth: 0 }}>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>Rechercher une réservation</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, WhatsApp, pays ou n° de dossier"
                style={{ width: "100%", minHeight: 42, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontFamily: FONT, fontSize: 14 }}
              />
            </label>
            <div role="group" aria-label="Filtrer par statut" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} style={btn(filter === f.id)} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            <button type="button" style={btn()} onClick={exportCsv} disabled={loading || visible.length === 0}>Exporter en CSV</button>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.card, overflow: "hidden" }}>
            <div className="bt-row bt-head">
              <span>Supporter</span><span>Contact</span><span>Billets</span><span>Total</span><span>Statut</span><span style={{ textAlign: "right", minWidth: "13.5rem" }}>Actions</span>
            </div>

            {loading && (
              <div style={{ display: "grid", gap: 8, padding: 14 }} aria-busy="true" aria-label="Chargement des réservations">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="bt-skeleton" />)}
              </div>
            )}

            {!loading && pageRows.map((r) => {
              const digits = (r.whatsapp || "").replace(/[^\d]/g, "");
              const isBusy = busy === r.reservation_code;
              return (
                <div key={r.reservation_code} className="bt-row" style={{ opacity: r.status === "cancelled" ? 0.6 : 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: C.muted }}>{r.reservation_code}</div>
                    <div className="bt-cell-date" style={{ fontSize: 11, color: C.faint }}>{dateFmt.format(new Date(r.created_at))}</div>
                  </div>
                  <div style={{ minWidth: 0, fontSize: 13 }}>
                    {digits
                      ? <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" style={{ color: C.green, fontWeight: 600, textDecoration: "none" }}>{r.whatsapp}</a>
                      : <span style={{ color: C.faint }}>Sans numéro</span>}
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.country || ""}</div>
                  </div>
                  <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.quantity} billet{r.quantity > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fc(r.total_price_fc)}</div>
                  <div><StatusBadge status={r.status} /></div>
                  <div className="bt-actions">
                    {r.status === "pending" && (
                      <>
                        <button type="button" style={rowBtn(C.green)} disabled={isBusy} onClick={() => setStatus(r, "paid")}>{isBusy ? "…" : "Marquer retirée"}</button>
                        <button type="button" style={rowBtn(C.red)} disabled={isBusy} onClick={() => setToCancel(r)}>Annuler</button>
                      </>
                    )}
                    {r.status === "paid" && (
                      <button type="button" style={rowBtn("#94a3b8")} disabled={isBusy} onClick={() => setStatus(r, "pending")}>{isBusy ? "…" : "Remettre à retirer"}</button>
                    )}
                    {r.status === "cancelled" && (
                      <button type="button" style={rowBtn("#94a3b8")} disabled={isBusy} onClick={() => setStatus(r, "pending")}>{isBusy ? "…" : "Rétablir"}</button>
                    )}
                  </div>
                </div>
              );
            })}

            {!loading && visible.length === 0 && (
              <div style={{ padding: "44px 20px", textAlign: "center", borderTop: `1px solid ${C.border}` }}>
                <p style={{ fontWeight: 700, marginBottom: 6 }}>
                  {matchRows.length === 0 ? "Aucune réservation pour ce match" : "Aucune réservation ne correspond"}
                </p>
                <p style={{ color: C.muted, fontSize: 13 }}>
                  {matchRows.length === 0 ? "Les réservations apparaîtront ici dès la première demande." : "Modifiez la recherche ou le filtre de statut."}
                </p>
                {matchRows.length > 0 && (
                  <button type="button" style={{ ...btn(), marginTop: 14 }} onClick={() => { setQuery(""); setFilter("all"); }}>Tout afficher</button>
                )}
              </div>
            )}
          </div>

          {!loading && visible.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, color: C.muted, fontSize: 13 }}>
              <span aria-live="polite">
                {visible.length.toLocaleString("fr-FR")} réservation{visible.length > 1 ? "s" : ""}
                {pageCount > 1 && ` · page ${page} sur ${pageCount}`}
              </span>
              {pageCount > 1 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={btn()} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
                  <button type="button" style={btn()} disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Suivant</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {toCancel && (
        <ConfirmDialog
          message="Annuler cette réservation ?"
          detail={`${toCancel.first_name} ${toCancel.last_name} (${toCancel.reservation_code}) : ${toCancel.quantity} billet${toCancel.quantity > 1 ? "s" : ""} seront remis en vente et le QR code ne sera plus valable. Vous pourrez la rétablir.`}
          confirmLabel="Annuler la réservation"
          icon="⚠️"
          tone="danger"
          onCancel={() => setToCancel(null)}
          onConfirm={() => { const row = toCancel; setToCancel(null); setStatus(row, "cancelled"); }}
        />
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", right: 20, bottom: 20, zIndex: 400, maxWidth: "calc(100vw - 40px)", padding: "12px 16px", borderRadius: 12,
            background: toast.kind === "ok" ? "#0f2a1f" : "#3a1414",
            border: `1px solid ${toast.kind === "ok" ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.45)"}`,
            color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
