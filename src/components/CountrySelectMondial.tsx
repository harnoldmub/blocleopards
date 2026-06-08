import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const COUNTRIES = [
  { label: "États-Unis",  flag: "us" },
  { label: "France",      flag: "fr" },
  { label: "Belgique",    flag: "be" },
  { label: "Royaume-Uni", flag: "gb" },
  { label: "Canada",      flag: "ca" },
  { label: "Mexique",     flag: "mx" },
  { label: "RDC",         flag: "cd" },
  { label: "Autre",       flag: null },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CountrySelectMondial({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find(c => c.label === value) ?? COUNTRIES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: open ? "rgba(247,214,24,0.06)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? "#f7d618" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 12,
          padding: "12px 16px",
          color: "#fff",
          fontSize: 14,
          cursor: "pointer",
          transition: "all 0.15s",
          textAlign: "left",
        }}
      >
        {selected.flag ? (
          <img src={`/flags/${selected.flag}.png`} alt={selected.label} style={{ height: 18, width: "auto", borderRadius: 2, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 26, height: 18, background: "rgba(255,255,255,0.1)", borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
        )}
        <span style={{ flex: 1 }}>{selected.label}</span>
        <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(100% + 6px)",
          background: "#0d1221",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          zIndex: 50,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {COUNTRIES.map(c => (
            <button
              key={c.label}
              type="button"
              onClick={() => { onChange(c.label); setOpen(false); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                background: value === c.label ? "rgba(247,214,24,0.08)" : "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: value === c.label ? "#f7d618" : "rgba(255,255,255,0.85)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (value !== c.label) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (value !== c.label) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {c.flag ? (
                <img src={`/flags/${c.flag}.png`} alt={c.label} style={{ height: 18, width: "auto", borderRadius: 2, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <span style={{ width: 26, height: 18, background: "rgba(255,255,255,0.08)", borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
              )}
              {c.label}
              {value === c.label && (
                <span style={{ marginLeft: "auto", color: "#f7d618", fontSize: 12 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
