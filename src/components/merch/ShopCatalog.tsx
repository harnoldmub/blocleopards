import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, ShoppingBag, Shirt, Sparkles, Tag } from "lucide-react";
import { MERCH_CATEGORIES, MERCH_PRODUCTS, type MerchCategory, type MerchProduct, type MerchSize } from "../../data/merch";
import { ProductCard } from "./ProductParts";

const PAGE_SIZE = 9;
type Filter = "all" | MerchCategory;
type Sort = "featured" | "price-asc" | "price-desc";

const CATEGORY_ICONS: Record<Filter, typeof Shirt> = {
  all: LayoutGrid,
  textile: Shirt,
  accessoires: Tag,
  goodies: Sparkles
};

const SORTS: { id: Sort; label: string }[] = [
  { id: "featured", label: "Mis en avant" },
  { id: "price-asc", label: "Prix croissant" },
  { id: "price-desc", label: "Prix décroissant" }
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Props {
  cartCount: number;
  onOpenCart: () => void;
  onAdd: (p: MerchProduct, s: MerchSize | null) => void;
  onBuy: (p: MerchProduct, s: MerchSize | null) => void;
}

export default function ShopCatalog({ cartCount, onOpenCart, onAdd, onBuy }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Filter>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => [
      { id: "all" as Filter, label: "Tous les articles", count: MERCH_PRODUCTS.length },
      ...MERCH_CATEGORIES.map((c) => ({ id: c.id as Filter, label: c.label, count: MERCH_PRODUCTS.filter((p) => p.category === c.id).length }))
    ],
    []
  );

  const results = useMemo(() => {
    const q = norm(query.trim());
    const list = MERCH_PRODUCTS.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!inStockOnly || p.availability === "in_stock" || p.availability === "low_stock") &&
        (!q || norm(`${p.name} ${p.description}`).includes(q))
    );
    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [query, category, inStockOnly, sort]);

  useEffect(() => setPage(1), [query, category, inStockOnly, sort]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reset = () => {
    setQuery("");
    setCategory("all");
    setInStockOnly(false);
  };

  return (
    <>
      {/* Barre titre + recherche, qui chevauche le héros */}
      <div className="relative z-10 -mt-16 flex flex-col gap-4 rounded-[12px] bg-white p-4 shadow-[0_24px_60px_-30px_rgba(5,11,24,0.45)] ring-1 ring-slate-100 sm:-mt-20 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <h2 className="font-display text-3xl uppercase leading-none text-congo-night sm:text-4xl">Portez les couleurs</h2>
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <span className="sr-only">Rechercher un article</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un article"
              className="min-h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-congo-night placeholder:text-slate-400 focus:border-congo focus:bg-white focus:outline-none focus:ring-2 focus:ring-congo/20 sm:text-sm"
            />
          </label>
          <button
            type="button"
            onClick={onOpenCart}
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-congo-night text-white transition-colors hover:bg-congo"
            aria-label={`Ouvrir le panier (${cartCount} article${cartCount > 1 ? "s" : ""})`}
          >
            <ShoppingBag size={18} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-or px-1 text-[0.65rem] font-black text-congo-night">{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        {/* Filtres : colonne sur desktop, pastilles défilantes sur mobile */}
        <aside aria-label="Filtres" className="lg:sticky lg:top-28 lg:self-start">
          <h3 className="hidden text-lg font-bold text-congo-night lg:block">Catégories</h3>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:mt-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {filters.map((f) => {
              const Icon = CATEGORY_ICONS[f.id];
              const active = category === f.id;
              return (
                <li key={f.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(f.id)}
                    className={`flex min-h-10 w-full items-center gap-2.5 whitespace-nowrap rounded-full border px-4 text-sm transition-colors lg:rounded-[8px] lg:border-transparent lg:px-3 ${
                      active ? "border-congo-night bg-congo-night font-semibold text-white lg:bg-slate-100 lg:text-congo-night" : "border-slate-200 text-slate-600 hover:text-congo-night lg:hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" className="hidden lg:block" />
                    {f.label}
                    <span className={`ml-auto rounded-full px-1.5 text-[0.68rem] font-bold tabular-nums ${active ? "bg-or text-congo-night" : "bg-slate-100 text-slate-500"}`}>{f.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3 lg:mt-8 lg:flex-col lg:items-stretch lg:border-t lg:border-slate-100 lg:pt-6">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-congo" />
              Disponible immédiatement
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 lg:flex-col lg:items-stretch">
              <span className="font-semibold text-congo-night lg:text-lg lg:font-bold">Trier</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="min-h-10 rounded-full border border-slate-200 bg-white px-3 text-sm text-congo-night focus:border-congo focus:outline-none lg:rounded-[8px]"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <div>
          <p className="mb-5 text-sm text-slate-500" aria-live="polite">
            {results.length} article{results.length > 1 ? "s" : ""}
            {category !== "all" && ` · ${filters.find((f) => f.id === category)?.label}`}
          </p>

          {visible.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-500">Aucun article ne correspond à votre recherche.</p>
              <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-full border border-slate-200 px-6 text-sm font-semibold text-congo-night hover:border-congo-night">
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-10 min-[520px]:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={onAdd} onBuy={onBuy} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-congo-night disabled:opacity-30">
                <ChevronLeft size={16} aria-hidden="true" /> Précédent
              </button>
              <div className="flex gap-1">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}
                    className={`h-10 min-w-10 rounded-[8px] text-sm font-semibold tabular-nums ${n === page ? "bg-slate-100 text-congo-night" : "text-slate-500 hover:text-congo-night"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" disabled={page === pages} onClick={() => setPage(page + 1)} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-congo-night disabled:opacity-30">
                Suivant <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
