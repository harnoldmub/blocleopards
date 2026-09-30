import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface ComboOption {
  value: string;
  label: string;
  /** Code ISO pays → drapeau. */
  flag?: string;
  /** Texte secondaire aligné à droite (ex. « +243 »). */
  hint?: string;
  /** Termes supplémentaires pour la recherche (ex. « 243 »). */
  keywords?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder: string;
  searchPlaceholder?: string;
  /** Autorise une valeur absente de la liste (ex. ville non référencée). */
  allowCustom?: boolean;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  /** Contenu du bouton quand une valeur est choisie (par défaut : drapeau + libellé). */
  renderValue?: (opt: ComboOption) => ReactNode;
  className?: string;
  "aria-labelledby"?: string;
  listWidth?: string;
}

const MAX_RESULTS = 150;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const flagUrl = (iso: string) => `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;

export function FlagIcon({ iso }: { iso: string }) {
  return <img src={flagUrl(iso)} alt="" width={22} height={16} loading="lazy" className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/5" />;
}

/**
 * Liste déroulante avec recherche (clavier : ↑ ↓ Entrée Échap).
 * Reprend la logique de SearchableSelect, en thème clair.
 */
export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Rechercher…",
  allowCustom,
  disabled,
  loading,
  invalid,
  renderValue,
  className = "",
  listWidth = "100%",
  ...aria
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const list = q ? options.filter((o) => norm(`${o.label} ${o.keywords ?? ""}`).includes(q)) : options;
    return list.slice(0, MAX_RESULTS);
  }, [options, query]);

  const custom = allowCustom && query.trim() && !options.some((o) => norm(o.label) === norm(query.trim())) ? query.trim() : null;
  const rows: ComboOption[] = custom ? [...filtered, { value: custom, label: `Utiliser « ${custom} »` }] : filtered;

  const selected = options.find((o) => o.value === value) ?? (value ? { value, label: value } : undefined);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    const onDown = (e: MouseEvent) => rootRef.current && !rootRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  useEffect(() => setHighlight(0), [query]);
  useEffect(() => {
    (listRef.current?.children[highlight] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[highlight]) pick(rows[highlight].value);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // ne ferme pas le panier
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        {...aria}
        className={`flex min-h-12 w-full items-center gap-2.5 rounded-[6px] border bg-white px-3.5 text-left text-base transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
          invalid ? "border-feu" : open ? "border-congo ring-2 ring-congo/20" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {selected ? (
          renderValue ? (
            renderValue(selected)
          ) : (
            <>
              {selected.flag && <FlagIcon iso={selected.flag} />}
              <span className="truncate text-congo-night">{selected.label}</span>
            </>
          )
        ) : (
          <span className="truncate text-slate-400">{loading ? "Chargement…" : placeholder}</span>
        )}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_18px_40px_-18px_rgba(5,11,24,0.45)]" style={{ width: listWidth, minWidth: "100%" }}>
          <div className="relative border-b border-slate-100 p-2">
            <Search size={15} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={rows[highlight] ? `${listId}-${highlight}` : undefined}
              className="min-h-10 w-full rounded-[6px] bg-slate-50 pl-9 pr-3 text-base text-congo-night placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-congo/20"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1" data-lenis-prevent>
            {rows.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">Aucun résultat</li>}
            {rows.map((o, i) => (
              <li
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[4px] px-3 text-sm ${
                  i === highlight ? "bg-congo/5 text-congo" : "text-slate-700"
                } ${o.value === value ? "font-semibold" : ""}`}
              >
                {o.flag && <FlagIcon iso={o.flag} />}
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-400">{o.hint}</span>}
                {o.value === value && <Check size={14} className={o.hint ? "shrink-0" : "ml-auto shrink-0"} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {filtered.length === MAX_RESULTS && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">Tapez pour affiner la recherche.</p>}
        </div>
      )}
    </div>
  );
}
