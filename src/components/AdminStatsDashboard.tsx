import { useState, useEffect, useMemo } from "react";

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618", blue: "#60a5fa",
  green: "#34d399", red: "#f87171", purple: "#a78bfa", orange: "#fb923c",
};

const MATCH_LABELS: Record<string, string> = {
  houston: "RDC vs Portugal (Houston)",
  guadalajara: "RDC vs Colombie (Guadalajara)",
  atlanta: "RDC vs Ouzbékistan (Atlanta)",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: C.yellow },
  validated: { label: "Validés", color: C.green },
  rejected: { label: "Rejetés", color: C.red },
  verified: { label: "Vérifiés", color: C.green },
  flagged: { label: "Signalés", color: C.orange },
};

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function BigNumber({ label, value, color = C.yellow, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 22px" }}>
      <div style={{ fontSize: 34, fontFamily: "'Bebas Neue', sans-serif", color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* Area chart over last 30 days, multi-series */
function TrendChart({ series }: { series: { name: string; color: string; data: { day: string; count: number }[] }[] }) {
  const W = 720, H = 180, PAD = { t: 12, r: 12, b: 26, l: 30 };

  const days = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      out.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, []);

  const filled = series.map(s => {
    const map = new Map(s.data.map(d => [String(d.day).slice(0, 10), Number(d.count)]));
    return { ...s, points: days.map(day => map.get(day) ?? 0) };
  });

  const maxY = Math.max(4, ...filled.flatMap(s => s.points));
  const x = (i: number) => PAD.l + (i / 29) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);

  const fmtDay = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.5, 1].map(f => {
          const v = Math.round(maxY * f);
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3} fill={C.muted} fontSize={9} textAnchor="end">{v}</text>
            </g>
          );
        })}
        {[0, 7, 14, 21, 29].map(i => (
          <text key={i} x={x(i)} y={H - 8} fill={C.muted} fontSize={9} textAnchor="middle">{fmtDay(days[i])}</text>
        ))}
        {filled.map(s => {
          const line = s.points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const area = `${line} L${x(29).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={s.color} opacity={0.08} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        {filled.map(s => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            {s.name} <strong style={{ color: C.text }}>({s.points.reduce((a, b) => a + b, 0)} / 30j)</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Horizontal bars */
function BarList({ items, color = C.blue, labelMap }: { items: { label: string; count: number }[]; color?: string; labelMap?: Record<string, string> }) {
  if (!items?.length) return <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Aucune donnée</div>;
  const max = Math.max(...items.map(i => Number(i.count)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it) => (
        <div key={it.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{labelMap?.[it.label] || it.label}</span>
            <span style={{ color: C.muted, fontWeight: 700 }}>{it.count}</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(Number(it.count) / max) * 100}%`, borderRadius: 4, background: color, transition: "width 0.6s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Donut chart */
function Donut({ items }: { items: { label: string; count: number }[] }) {
  if (!items?.length) return <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Aucune donnée</div>;
  const total = items.reduce((a, b) => a + Number(b.count), 0);
  if (total === 0) return <div style={{ color: C.muted, fontSize: 12, padding: "12px 0" }}>Aucune donnée</div>;
  const R = 52, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const palette = [C.yellow, C.green, C.red, C.blue, C.purple, C.orange];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg viewBox="0 0 140 140" style={{ width: 130, height: 130, flexShrink: 0 }}>
        <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={16} />
        {items.map((it, i) => {
          const frac = Number(it.count) / total;
          const conf = STATUS_LABELS[it.label];
          const col = conf?.color ?? palette[i % palette.length];
          const el = (
            <circle key={it.label} cx={70} cy={70} r={R} fill="none"
              stroke={col} strokeWidth={16}
              strokeDasharray={`${frac * CIRC} ${CIRC}`}
              strokeDashoffset={-offset * CIRC}
              transform="rotate(-90 70 70)" strokeLinecap="butt" />
          );
          offset += frac;
          return el;
        })}
        <text x={70} y={66} textAnchor="middle" fill={C.text} fontSize={24} fontWeight={800} fontFamily="'Bebas Neue', sans-serif">{total}</text>
        <text x={70} y={84} textAnchor="middle" fill={C.muted} fontSize={9} letterSpacing="0.1em">TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => {
          const conf = STATUS_LABELS[it.label];
          const col = conf?.color ?? palette[i % palette.length];
          return (
            <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: col, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: C.text }}>{conf?.label ?? it.label}</span>
              <span style={{ color: C.muted, fontWeight: 700 }}>{it.count}</span>
              <span style={{ color: C.muted, fontSize: 11 }}>({Math.round((Number(it.count) / total) * 100)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminStatsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement des statistiques...</div>;
  if (error || !data) return <div style={{ color: C.red, fontSize: 14, padding: 40 }}>Impossible de charger les statistiques.</div>;

  const adhesionsTotal = (data.adhesions?.byStatus || []).reduce((a: number, b: any) => a + Number(b.count), 0);
  const mondialTotal = (data.mondial?.byStatus || []).reduce((a: number, b: any) => a + Number(b.count), 0);
  const fraudPct = data.mondial?.fraud?.total > 0
    ? Math.round((Number(data.mondial.fraud.flagged) / Number(data.mondial.fraud.total)) * 100)
    : 0;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em", color: C.text }}>Statistiques</h1>
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          Données en direct · {new Date(data.generatedAt).toLocaleString("fr-FR")}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        <BigNumber label="Supporters" value={Number(data.supporters?.total || 0)} color={C.orange} />
        <BigNumber label="Adhésions" value={adhesionsTotal} />
        <BigNumber label="Inscriptions Mondial" value={mondialTotal} color={C.blue} />
        <BigNumber label="Newsletter" value={Number(data.newsletter?.total || 0)} color={C.purple} />
        <BigNumber label="Messages" value={Number(data.contacts?.total || 0)} color={C.green} sub={`${data.contacts?.unread || 0} non lus`} />
        <BigNumber label="Dossiers signalés" value={`${fraudPct}%`} color={fraudPct > 20 ? C.red : C.orange} sub={`${data.mondial?.fraud?.flagged || 0} sur ${data.mondial?.fraud?.total || 0}`} />
      </div>

      {/* Trend */}
      <div style={{ marginBottom: 20 }}>
        <Card title="Activité des 30 derniers jours" sub="Nouvelles entrées par jour">
          <TrendChart series={[
            { name: "Adhésions", color: C.yellow, data: data.daily?.adhesions || [] },
            { name: "Mondial", color: C.blue, data: data.daily?.mondial || [] },
            { name: "Newsletter", color: C.purple, data: data.daily?.newsletter || [] },
          ]} />
        </Card>
      </div>

      {/* Statuses */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card title="Adhésions par statut">
          <Donut items={data.adhesions?.byStatus || []} />
        </Card>
        <Card title="Dossiers Mondial par statut" sub="Vérification d'identité">
          <Donut items={data.mondial?.byStatus || []} />
        </Card>
      </div>

      {/* Breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card title="Top villes — Adhésions">
          <BarList items={data.adhesions?.byCity || []} color={C.yellow} />
        </Card>
        <Card title="Rôles souhaités — Adhésions">
          <BarList items={data.adhesions?.byRole || []} color={C.purple} />
        </Card>
        <Card title="Pays — Adhésions">
          <BarList items={data.adhesions?.byCountry || []} color={C.green} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card title="Matchs demandés — Mondial" sub="Popularité par match (un dossier peut viser plusieurs matchs)">
          <BarList items={data.mondial?.byMatch || []} color={C.blue} labelMap={MATCH_LABELS} />
        </Card>
        <Card title="Localisation — Mondial" sub="Par État / ville">
          <BarList items={data.mondial?.byState || []} color={C.orange} />
        </Card>
        <Card title="Canal de découverte — Adhésions">
          <BarList items={data.adhesions?.byCanal || []} color={C.red} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card title="Supporters par pays" sub="Base supporters centralisée">
          <BarList items={data.supporters?.byCountry || []} color={C.orange} />
        </Card>
        <Card title="Supporters par ville">
          <BarList items={data.supporters?.byCity || []} color={C.yellow} />
        </Card>
        {data.mondial?.diaspora?.length > 0 && (
          <Card title="Diaspora RDC — Mondial">
            <Donut items={data.mondial.diaspora} />
          </Card>
        )}
      </div>
    </div>
  );
}
