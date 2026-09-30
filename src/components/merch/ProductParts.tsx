import { useState } from "react";
import {
  AVAILABILITY_LABELS,
  MERCH_CATEGORIES,
  formatMerchPrice,
  isPurchasable,
  type MerchProduct,
  type MerchSize
} from "../../data/merch";

export const productHref = (p: MerchProduct) => `/boutique/${p.id}`;

export const categoryLabel = (p: MerchProduct) => MERCH_CATEGORIES.find((c) => c.id === p.category)?.label ?? "";

const availabilityTone: Record<MerchProduct["availability"], string> = {
  in_stock: "bg-emerald-400",
  low_stock: "bg-or",
  preorder: "bg-congo-bright",
  out_of_stock: "bg-feu"
};

export function Availability({ product }: { product: MerchProduct }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
      <span className={`h-2 w-2 rounded-full ${availabilityTone[product.availability]}`} aria-hidden="true" />
      {AVAILABILITY_LABELS[product.availability]}
    </p>
  );
}

export function SizePicker({
  sizes,
  value,
  onChange,
  error,
  compact
}: {
  sizes: MerchSize[];
  value: MerchSize | null;
  onChange: (s: MerchSize) => void;
  error: boolean;
  /** Version carte : pastilles plus petites, légende masquée visuellement. */
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className={compact ? "sr-only" : "mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400"}>Taille</legend>
      <div className="flex flex-wrap gap-1.5">
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={value === s}
            onClick={() => onChange(s)}
            className={`${compact ? "h-9 min-w-9 text-[0.7rem]" : "min-h-10 min-w-10 text-xs"} rounded-full border px-2 font-bold transition-colors ${
              value === s ? "border-congo-night bg-congo-night text-white" : "border-slate-200 bg-white text-slate-700 hover:border-congo-night"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-feu" role="alert">Choisissez une taille.</p>}
    </fieldset>
  );
}

/** Taille obligatoire pour les vêtements : logique partagée carte / fiche. */
export function useSizeChoice(product: MerchProduct) {
  const [size, setSize] = useState<MerchSize | null>(null);
  const [error, setError] = useState(false);
  const needsSize = !!product.sizes?.length;
  return {
    size,
    error,
    needsSize,
    choose: (s: MerchSize) => {
      setSize(s);
      setError(false);
    },
    /** Renvoie la taille à utiliser, ou `false` si elle manque. */
    resolve: (): MerchSize | null | false => {
      if (needsSize && !size) {
        setError(true);
        return false;
      }
      return needsSize ? size : null;
    }
  };
}

export function ProductImage({ product, className = "", showCategory }: { product: MerchProduct; className?: string; showCategory?: boolean }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-[10px] bg-[#EEF2F8] ${className}`}>
      <img
        src={product.image}
        alt={product.name}
        className="h-full w-full object-contain p-8 transition-transform duration-500 ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
      />
      {product.badge && (
        <span className="absolute left-3 top-3 rounded-full bg-or px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-congo-night">{product.badge}</span>
      )}
      {showCategory && (
        <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-[0.68rem] font-semibold text-congo-night shadow-[0_1px_2px_rgba(5,11,24,0.08)]">
          {categoryLabel(product)}
        </span>
      )}
    </div>
  );
}

export function ProductCard({
  product,
  onAdd,
  onBuy
}: {
  product: MerchProduct;
  onAdd: (p: MerchProduct, s: MerchSize | null) => void;
  onBuy: (p: MerchProduct, s: MerchSize | null) => void;
}) {
  const choice = useSizeChoice(product);
  const purchasable = isPurchasable(product);

  const run = (fn: typeof onAdd) => () => {
    const size = choice.resolve();
    if (size !== false) fn(product, size);
  };

  return (
    // Toute la carte ouvre la fiche (lien étiré sur le nom) ; tailles et boutons restent au-dessus (z-10).
    <article className="group relative flex cursor-pointer flex-col">
      <ProductImage product={product} showCategory />
      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-congo-night">
          <a
            href={productHref(product)}
            className="after:absolute after:inset-0 after:content-[''] group-hover:text-congo focus-visible:outline-none after:focus-visible:rounded-[10px] after:focus-visible:ring-2 after:focus-visible:ring-congo"
          >
            {product.name}
          </a>
        </h3>
        <span className="shrink-0 font-bold tabular-nums text-congo-night">{formatMerchPrice(product.price)}</span>
      </div>
      <div className="mt-1">
        <Availability product={product} />
      </div>

      {choice.needsSize && (
        <div className="relative z-10 mt-3 w-fit">
          <SizePicker compact sizes={product.sizes!} value={choice.size} onChange={choice.choose} error={choice.error} />
        </div>
      )}

      <div className="relative z-10 mt-auto grid grid-cols-2 gap-2 pt-4">
        <button
          type="button"
          onClick={run(onAdd)}
          disabled={!purchasable}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[0.78rem] font-semibold text-congo-night transition-colors hover:border-congo-night disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={run(onBuy)}
          disabled={!purchasable}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-congo-night px-3 text-[0.78rem] font-semibold text-white transition-colors hover:bg-congo disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {purchasable ? "Commander" : "Épuisé"}
        </button>
      </div>
    </article>
  );
}
