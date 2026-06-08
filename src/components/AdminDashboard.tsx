import { useState, useEffect } from "react";
import { Ticket, Users, Mail, Send, LayoutDashboard } from "lucide-react";

const C = {
  bg: "#07090f",
  card: "#0d1117",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)",
  yellow: "#f7d618",
  blue: "#1c2e8f",
  red: "#ce1021",
  green: "#16a34a",
};

function StatCard({ icon, label, value, sub, color = C.yellow }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em", color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon, href, stats }: { title: string; icon: React.ReactNode; href: string; stats: { label: string; value: string | number; color?: string }[] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block", textDecoration: "none",
        background: hovered ? "rgba(247,214,24,0.04)" : C.card,
        border: `1px solid ${hovered ? "rgba(247,214,24,0.25)" : C.border}`,
        borderRadius: 16, padding: "20px 24px",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</span>
        </div>
        <span style={{ fontSize: 12, color: hovered ? C.yellow : C.muted, transition: "color 0.2s" }}>Gérer →</span>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {stats.map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 24, fontFamily: "'Bebas Neue', sans-serif", color: s.color || C.yellow }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </a>
  );
}

function BilleterieToggle() {
  const [active, setActive] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setActive(d.settings?.billeterie_active !== "false"))
      .catch(() => setActive(true));
  }, []);

  const toggle = async () => {
    if (active === null) return;
    setSaving(true);
    const next = !active;
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billeterie_active: next ? "true" : "false" }),
    });
    setActive(next);
    setSaving(false);
  };

  if (active === null) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${active ? "rgba(52,211,153,0.3)" : C.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Billetterie</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {active ? "Visible sur le site — supporters peuvent s'inscrire" : "Cachée partout sur le site"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          position: "relative",
          width: 52,
          height: 28,
          borderRadius: 999,
          background: active ? "#34d399" : "rgba(255,255,255,0.12)",
          border: "none",
          cursor: saving ? "not-allowed" : "pointer",
          transition: "background 0.25s ease",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute",
          top: 3,
          left: active ? 26 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.25s ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: C.muted, fontSize: 14 }}>
      Chargement...
    </div>
  );

  const b = data?.billets || {};
  const a = data?.adhesions || {};
  const c = data?.contacts || {};
  const n = data?.newsletter || {};

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Dashboard</h1>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Vue d'ensemble de l'activité du Bloc des Léopards</p>
      </div>

      {/* Billeterie toggle */}
      <div style={{ marginBottom: 24 }}>
        <BilleterieToggle />
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard icon={<Ticket size={20} />} label="Billets total" value={b.total || 0} sub={`${b.pending || 0} en attente`} />
        <StatCard icon={<Users size={20} />} label="Adhésions" value={a.total || 0} sub={`${a.pending || 0} en attente`} color="#60a5fa" />
        <StatCard icon={<Mail size={20} />} label="Messages" value={c.total || 0} sub={`${c.unread || 0} non lus`} color="#f472b6" />
        <StatCard icon={<Send size={20} />} label="Newsletter" value={n.total || 0} sub="abonnés" color="#34d399" />
      </div>

      {/* Sections */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <SectionCard
          title="Billets" icon={<Ticket size={20} />} href="/admin/billets"
          stats={[
            { label: "Total", value: b.total || 0 },
            { label: "En attente", value: b.pending || 0 },
            { label: "Sélectionnés", value: b.selected || 0 },
            { label: "Remis", value: b.ticket_given || 0 },
          ]}
        />
        <SectionCard
          title="Adhésions" icon={<Users size={20} />} href="/admin/adhesions"
          stats={[
            { label: "Total", value: a.total || 0, color: "#60a5fa" },
            { label: "En attente", value: a.pending || 0, color: "#60a5fa" },
            { label: "Validés", value: a.validated || 0, color: "#34d399" },
          ]}
        />
        <SectionCard
          title="Messages" icon={<Mail size={20} />} href="/admin/contacts"
          stats={[
            { label: "Total", value: c.total || 0, color: "#f472b6" },
            { label: "Non lus", value: c.unread || 0, color: "#f472b6" },
            { label: "Répondus", value: c.replied || 0, color: "#34d399" },
          ]}
        />
        <SectionCard
          title="Newsletter" icon={<Send size={20} />} href="/admin/newsletter"
          stats={[
            { label: "Abonnés", value: n.total || 0, color: "#34d399" },
          ]}
        />
      </div>
    </div>
  );
}
