import { useState, useRef, useEffect, useMemo } from "react";

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;       // libellé de l'option "tout" (value: "all")
  searchPlaceholder?: string;
  minWidth?: number;
}

const C = {
  card: "#0d1117", border: "rgba(255,255,255,0.07)", text: "#e2e8f0",
  muted: "rgba(255,255,255,0.4)", yellow: "#f7d618",
};

export default function SearchableSelect({ value, onChange, options, placeholder, searchPlaceholder = "Rechercher...", minWidth = 170 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allOptions = useMemo<SelectOption[]>(
    () => [{ value: "all", label: placeholder }, ...options],
    [options, placeholder]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allOptions;
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = norm(query);
    return allOptions.filter(o => norm(o.label).includes(q));
  }, [allOptions, query]);

  const selected = allOptions.find(o => o.value === value);
  const isActive = value !== "all";

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setHighlight(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight].value); }
  };

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
          background: isActive ? "rgba(247,214,24,0.08)" : C.card,
          border: `1px solid ${isActive ? "rgba(247,214,24,0.35)" : open ? "rgba(255,255,255,0.2)" : C.border}`,
          borderRadius: 10, padding: "8px 12px", color: isActive ? C.yellow : C.text,
          fontSize: 12, fontWeight: isActive ? 700 : 400, fontFamily: "'Sora', sans-serif",
          cursor: "pointer", transition: "border-color 0.15s, background 0.15s", textAlign: "left",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300, minWidth: "100%", width: "max-content", maxWidth: 320,
          background: "#11161f", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)", overflow: "hidden",
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ position: "relative" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onInputKey}
                placeholder={searchPlaceholder}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "7px 10px 7px 30px", color: C.text, fontSize: 12,
                  fontFamily: "'Sora', sans-serif", outline: "none",
                }} />
            </div>
          </div>
          <div ref={listRef} style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: 12, color: C.muted, textAlign: "center" }}>Aucun résultat</div>
            ) : filtered.map((o, i) => {
              const isSel = o.value === value;
              const isHl = i === highlight;
              return (
                <button key={o.value} type="button" onClick={() => pick(o.value)} onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
                    padding: "8px 10px", borderRadius: 8, border: "none", textAlign: "left",
                    background: isHl ? "rgba(247,214,24,0.1)" : "transparent",
                    color: isSel ? C.yellow : isHl ? C.text : "rgba(255,255,255,0.7)",
                    fontSize: 12, fontWeight: isSel ? 700 : 400, fontFamily: "'Sora', sans-serif", cursor: "pointer",
                  }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
                    <span style={{ width: 13, flexShrink: 0, display: "inline-flex" }}>
                      {isSel && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                  </span>
                  {o.count != null && <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{o.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
