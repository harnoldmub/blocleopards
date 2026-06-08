import { useState, useEffect } from "react";
import { Ticket, Users, Mail, Send, Globe, CheckCircle, Clock, AlertTriangle, Trophy } from "lucide-react";

const C = {
  bg: "#07090f",
  card: "#0d1117",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)",
  yellow: "#f7d618",
  blue: "#60a5fa",
  red: "#f87171",
  green: "#34d399",
  purple: "#a78bfa",
  orange: "#fb923c",
};

function StatCard({ icon, label, value, sub, color = C.yellow, href }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; href?: string;
}) {
  return (
    <a href={href ?? "#"} style={{ textDecoration: "none" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8, cursor: href ? "pointer" : "default", transition: "border-color 0.15s" }}
        onMouseEnter={e => href && ((e.currentTarget as HTMLElement).style.borderColor = color + "55")}
        onMouseLeave={e => href && ((e.currentTarget as HTMLElement).style.borderColor = C.border)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color }}>
          {icon}
          <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{label}</span>
        </div>
        <div style={{ fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em", color }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
      </div>
    </a>
  );
}

function SectionCard({ title, icon, href, color = C.yellow, stats }: {
  title: string; icon: React.ReactNode; href: string; color?: string;
  stats: { label: string; value: string | number; color?: string }[];
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color }}>
          {icon}
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{title}</span>
        </div>
        <a href={href} style={{ fontSize: 11, color: C.muted, textDecoration: "none", letterSpacing: "0.05em" }}>Gérer →</a>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {stats.map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: s.color ?? color, letterSpacing: "0.04em" }}>{s.value}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BilleterieToggle() {
  const [active, setActive] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => setActive(d.settings?.billeterie_active !== "false"))
      .catch(() => setActive(true));
  }, []);

  const toggle = async () => {
    if (active === null) return;
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billeterie_active: !active ? "true" : "false" }),
    });
    setActive(!active);
    setSaving(false);
  };

  if (active === null) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${active ? "rgba(52,211,153,0.3)" : C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Billetterie</div>
        <div style={{ fontSize: 12, color: C.muted }}>{active ? "Visible sur le site — supporters peuvent s'inscrire" : "Cachée partout sur le site"}</div>
      </div>
      <button onClick={toggle} disabled={saving} style={{ position: "relative", width: 52, height: 28, borderRadius: 999, background: active ? C.green : "rgba(255,255,255,0.12)", border: "none", cursor: saving ? "not-allowed" : "pointer", transition: "background 0.25s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: active ? 26 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }} />
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: C.muted, fontSize: 14 }}>
      Chargement...
    </div>
  );

  const b = data?.billets  || {};
  const a = data?.adhesions || {};
  const c = data?.contacts  || {};
  const n = data?.newsletter || {};
  const m = data?.mondial   || {};

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Dashboard</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Vue d'ensemble de l'activité du Bloc des Léopards</p>
      </div>

      {/* Billetterie toggle */}
      <div style={{ marginBottom: 24 }}>
        <BilleterieToggle />
      </div>

      {/* Top stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard icon={<Ticket size={18} />}       label="Billets"      value={b.total || 0}   sub={`${b.pending || 0} en attente`}   color={C.yellow} href="/admin/billets" />
        <StatCard icon={<Globe size={18} />}         label="Mondial USA"  value={m.total || 0}   sub={`${m.verified || 0} vérifiés`}    color={C.purple} href="/admin/mondial" />
        <StatCard icon={<Users size={18} />}         label="Adhésions"    value={a.total || 0}   sub={`${a.pending || 0} en attente`}   color={C.blue}   href="/admin/adhesions" />
        <StatCard icon={<Mail size={18} />}          label="Messages"     value={c.total || 0}   sub={`${c.unread || 0} non lus`}       color="#f472b6"  href="/admin/contacts" />
        <StatCard icon={<Send size={18} />}          label="Newsletter"   value={n.total || 0}   sub="abonnés"                          color={C.green}  href="/admin/newsletter" />
      </div>

      {/* Mondial detail card — highlighted */}
      <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 16, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={18} style={{ color: C.purple }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Mondial USA 2026 — Tirage au Sort</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {m.tiragePublie ? (
              <span style={{ padding: "3px 10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 20, fontSize: 11, color: C.green, fontWeight: 700 }}>
                Publié
              </span>
            ) : (
              <span style={{ padding: "3px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, color: C.muted, fontWeight: 700 }}>
                En cours
              </span>
            )}
            <a href="/admin/mondial" style={{ fontSize: 11, color: C.muted, textDecoration: "none" }}>Gérer →</a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Inscrits",   value: m.total    || 0, color: C.purple, icon: <Users size={13} /> },
            { label: "Vérifiés",   value: m.verified  || 0, color: C.green,  icon: <CheckCircle size={13} /> },
            { label: "En attente", value: m.pending   || 0, color: C.yellow, icon: <Clock size={13} /> },
            { label: "Signalés",   value: m.flagged   || 0, color: C.orange, icon: <AlertTriangle size={13} /> },
            { label: "Sélectionnés", value: m.selected || 0, color: C.green, icon: <Trophy size={13} /> },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: s.color }}>{s.icon}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: s.color, letterSpacing: "0.04em" }}>{s.value}</div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Other sections */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <SectionCard title="Billets (matchs amicaux)" icon={<Ticket size={18} />} href="/admin/billets" color={C.yellow}
          stats={[
            { label: "Total",        value: b.total        || 0 },
            { label: "En attente",   value: b.pending      || 0 },
            { label: "Sélectionnés", value: b.selected     || 0 },
            { label: "Remis",        value: b.ticket_given || 0 },
          ]}
        />
        <SectionCard title="Adhésions" icon={<Users size={18} />} href="/admin/adhesions" color={C.blue}
          stats={[
            { label: "Total",       value: a.total     || 0, color: C.blue },
            { label: "En attente",  value: a.pending   || 0, color: C.blue },
            { label: "Validés",     value: a.validated || 0, color: C.green },
          ]}
        />
        <SectionCard title="Messages" icon={<Mail size={18} />} href="/admin/contacts" color="#f472b6"
          stats={[
            { label: "Total",     value: c.total   || 0, color: "#f472b6" },
            { label: "Non lus",   value: c.unread  || 0, color: "#f472b6" },
            { label: "Répondus",  value: c.replied || 0, color: C.green },
          ]}
        />
        <SectionCard title="Newsletter" icon={<Send size={18} />} href="/admin/newsletter" color={C.green}
          stats={[
            { label: "Abonnés", value: n.total || 0, color: C.green },
          ]}
        />
      </div>
    </div>
  );
}
