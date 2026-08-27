import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

const C = {
  card: "#0d1117",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
  muted: "rgba(255,255,255,0.42)",
  yellow: "#f7d618",
  green: "#34d399",
  red: "#f87171",
  blue: "#60a5fa",
};

type EventItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  date: string;
  time: string;
  location: string;
  cta: string;
  map: string | null;
  image: string | null;
  category: string;
  published: boolean;
};

type EventDraft = Partial<EventItem> & { date: string };

const today = new Date().toISOString().slice(0, 10);
const empty = (date = today): EventDraft => ({
  slug: "",
  title: "",
  description: "",
  body: "",
  date,
  time: "",
  location: "",
  cta: "",
  map: "",
  image: "",
  category: "event",
  published: true,
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "9px 12px",
  color: C.text,
  fontSize: 13,
  fontFamily: "'Sora', sans-serif",
  outline: "none",
};

function asDateOnly(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Drawer({ event, onClose, onSave, onDelete }: {
  event: EventDraft;
  onClose: () => void;
  onSave: (event: EventDraft) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<EventDraft>(event);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof EventDraft, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", zIndex: 1, background: "#0d1117", borderLeft: `1px solid ${C.border}`, width: "100%", maxWidth: 560, height: "100vh", overflowY: "auto", padding: 28 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.85rem", color: C.text, letterSpacing: "0.04em" }}>
            {form.id ? "Modifier l'evenement" : "Nouvel evenement"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
          <Field label="Date *"><input type="date" style={inputStyle} value={asDateOnly(form.date)} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Heure"><input style={inputStyle} value={form.time ?? ""} onChange={(e) => set("time", e.target.value)} /></Field>
        </div>

        <Field label="Titre *"><input style={inputStyle} value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Slug *"><input style={inputStyle} value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="genere automatiquement si vide" /></Field>
        <Field label="Description *"><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Texte de detail"><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 130 }} rows={6} value={form.body ?? ""} onChange={(e) => set("body", e.target.value)} /></Field>
        <Field label="Lieu"><input style={inputStyle} value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="CTA"><input style={inputStyle} value={form.cta ?? ""} onChange={(e) => set("cta", e.target.value)} /></Field>
        <Field label="Carte"><input style={inputStyle} value={form.map ?? ""} onChange={(e) => set("map", e.target.value)} /></Field>
        <Field label="Image"><input style={inputStyle} value={form.image ?? ""} onChange={(e) => set("image", e.target.value)} /></Field>
        <Field label="Categorie">
          <select style={inputStyle} value={form.category ?? "event"} onChange={(e) => set("category", e.target.value)}>
            <option value="event">Evenement</option>
            <option value="match">Match</option>
            <option value="meeting">Rassemblement</option>
          </select>
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => set("published", !form.published)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: `1px solid ${form.published ? "rgba(52,211,153,0.35)" : C.border}`, background: form.published ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)", color: form.published ? C.green : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            {form.published ? <Eye size={15} /> : <EyeOff size={15} />}
            {form.published ? "Publie" : "Masque"}
          </button>
          {form.id && (
            <button onClick={() => onDelete(form.id!)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.28)", background: "rgba(248,113,113,0.08)", color: C.red, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              <Trash2 size={15} />
              Supprimer
            </button>
          )}
        </div>

        <button onClick={save} disabled={saving} style={{ width: "100%", padding: 14, background: C.yellow, border: "none", borderRadius: 12, color: "#07090f", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1 }}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export default function AdminEventsCalendar() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventDraft | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/events");
    const data = await response.json();
    setEvents((data.events || []).map((event: EventItem) => ({ ...event, date: asDateOnly(event.date) })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    return events.reduce<Record<string, EventItem[]>>((acc, event) => {
      const key = asDateOnly(event.date);
      acc[key] = [...(acc[key] || []), event];
      return acc;
    }, {});
  }, [events]);

  const days = useMemo(() => getMonthDays(month), [month]);
  const visibleEvents = events.filter((event) => toMonthKey(new Date(`${event.date}T12:00:00`)) === toMonthKey(month));

  const save = async (event: EventDraft) => {
    const method = event.id ? "PUT" : "POST";
    await fetch("/api/admin/events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    await load();
  };

  const del = async (id: string) => {
    await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPendingDeleteId(null);
    setEditing(null);
    await load();
  };

  const moveMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  if (loading) return <div style={{ color: C.muted, fontSize: 14, padding: 40 }}>Chargement...</div>;

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        .events-calendar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; background: #0d1117; }
        .events-day { min-height: 122px; padding: 10px; border-right: 1px solid rgba(255,255,255,0.07); border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); cursor: pointer; }
        .events-day:nth-child(7n) { border-right: none; }
        .events-day:hover { background: rgba(247,214,24,0.05); }
        .events-pill { width: 100%; margin-top: 6px; padding: 6px 7px; border: 1px solid rgba(247,214,24,0.18); border-radius: 7px; background: rgba(247,214,24,0.09); color: #f7d618; font-size: 11px; font-weight: 700; text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .events-pill.is-hidden { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.38); }
        @media (max-width: 760px) {
          .events-calendar { display: flex; flex-direction: column; }
          .events-weekday { display: none; }
          .events-day { min-height: auto; border-right: none; }
          .events-day.is-outside { display: none; }
        }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontWeight: 700, marginBottom: 8 }}>Backoffice</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "0.04em" }}>Calendrier</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 34, fontFamily: "'Bebas Neue', sans-serif", color: C.yellow }}>{events.length}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Total</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 34, fontFamily: "'Bebas Neue', sans-serif", color: C.green }}>{events.filter((event) => event.published).length}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Publies</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontSize: 34, fontFamily: "'Bebas Neue', sans-serif", color: C.blue }}>{visibleEvents.length}</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Ce mois</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => moveMonth(-1)} aria-label="Mois precedent" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer" }}><ChevronLeft size={18} /></button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 220, color: C.text, fontWeight: 800, textTransform: "capitalize" }}>
          <CalendarDays size={18} style={{ color: C.yellow }} />
          {monthLabel(month)}
        </div>
        <button onClick={() => moveMonth(1)} aria-label="Mois suivant" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: "pointer" }}><ChevronRight size={18} /></button>
        <button onClick={() => setEditing(empty())} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: C.yellow, border: "none", color: "#07090f", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          <Plus size={16} />
          Nouvel evenement
        </button>
      </div>

      <div className="events-calendar">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="events-weekday" style={{ padding: "10px 12px", color: C.muted, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>{day}</div>
        ))}
        {days.map((day) => {
          const key = asDateOnly(day);
          const outside = day.getMonth() !== month.getMonth();
          const dayEvents = grouped[key] || [];
          return (
            <div key={key} className={`events-day${outside ? " is-outside" : ""}`} onClick={() => setEditing(empty(key))} style={{ opacity: outside ? 0.32 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: key === today ? C.yellow : C.text, fontWeight: 800, fontSize: 13 }}>{day.getDate()}</span>
                {dayEvents.length > 0 && <span style={{ color: C.muted, fontSize: 10 }}>{dayEvents.length}</span>}
              </div>
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  className={`events-pill${event.published ? "" : " is-hidden"}`}
                  onClick={(e) => { e.stopPropagation(); setEditing(event); }}
                  title={event.title}
                >
                  {event.time ? `${event.time} · ` : ""}{event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {editing && <Drawer event={editing} onClose={() => setEditing(null)} onSave={save} onDelete={setPendingDeleteId} />}
      {pendingDeleteId && (
        <ConfirmDialog
          message="Supprimer cet evenement ?"
          detail="Il sera retire du calendrier et du site public."
          confirmLabel="Supprimer"
          onConfirm={() => del(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}
