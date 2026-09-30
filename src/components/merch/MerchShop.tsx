import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import {
  AVAILABILITY_LABELS,
  MERCH_PRODUCTS,
  PAYMENT_METHODS,
  SHOW_PAYMENT_METHODS,
  formatMerchPrice,
  isPurchasable,
  type MerchProduct,
  type MerchSize,
  type PaymentMethod
} from "../../data/merch";
import type { GeoCountry } from "../../lib/geo";
import { useMerchCart, type ResolvedCartLine } from "../../lib/merch/cart";
import { buildOrder, formatPhone, orderWhatsappMessage, submitOrder, whatsappUrl, type MerchOrder } from "../../lib/merch/orders";
import Combobox, { FlagIcon, type ComboOption } from "./Combobox";

type Panel = "closed" | "cart" | "checkout" | "done";

const DEFAULT_COUNTRY = "CD";

const availabilityTone: Record<MerchProduct["availability"], string> = {
  in_stock: "bg-emerald-400",
  low_stock: "bg-or",
  preorder: "bg-congo-bright",
  out_of_stock: "bg-feu"
};

const productHref = (p: MerchProduct) => `/boutique/${p.id}`;

/* ---------------------------------------------------------------- */

interface Props {
  countries: GeoCountry[];
  /** Fiche produit : affiche ce produit au lieu de la grille. */
  productId?: string;
}

export default function MerchShop({ countries, productId }: Props) {
  const cart = useMerchCart();
  const [panel, setPanel] = useState<Panel>("closed");
  const [order, setOrder] = useState<MerchOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const detail = productId ? MERCH_PRODUCTS.find((p) => p.id === productId) : undefined;

  // Bloque le scroll (Lenis + natif) quand un panneau est ouvert.
  useEffect(() => {
    const open = panel !== "closed";
    const lenis = (window as any).lenis;
    if (open) lenis?.stop?.();
    else lenis?.start?.();
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function close() {
    setPanel("closed");
    setOrder(null);
  }

  function handleAdd(product: MerchProduct, size: MerchSize | null, quantity = 1) {
    cart.add(product.id, size, quantity);
    setToast(`${product.name}${size ? ` (${size})` : ""} ajouté au panier`);
  }

  return (
    <>
      {detail ? (
        <ProductDetail product={detail} cartCount={cart.count} onAdd={handleAdd} onOpenCart={() => setPanel("cart")} />
      ) : (
        <>
          <div className="mb-8 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">{MERCH_PRODUCTS.length} produits · Livraison à Kinshasa, en province et diaspora</p>
            <CartButton count={cart.count} onClick={() => setPanel("cart")} />
          </div>
          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {MERCH_PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={handleAdd} />
            ))}
          </div>
        </>
      )}

      {/* Bouton panier flottant (mobile), à gauche pour ne pas gêner l'assistant */}
      {cart.count > 0 && panel === "closed" && (
        <button
          type="button"
          onClick={() => setPanel("cart")}
          className="fixed bottom-5 left-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-congo-night px-5 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-white shadow-[0_18px_40px_-16px_rgba(5,11,24,0.8)] md:hidden"
        >
          <ShoppingBag size={18} aria-hidden="true" />
          Panier · {cart.count}
        </button>
      )}

      <Toast message={panel === "closed" ? toast : null} />

      <Drawer open={panel !== "closed"} onClose={close} title={panelTitle(panel)}>
        {panel === "cart" && (
          <CartPanel
            items={cart.items}
            total={cart.total}
            maxQty={cart.maxQty}
            onQty={cart.setQuantity}
            onRemove={cart.remove}
            onCheckout={() => setPanel("checkout")}
            onContinue={close}
          />
        )}
        {panel === "checkout" && (
          <CheckoutPanel
            countries={countries}
            items={cart.items}
            total={cart.total}
            onBack={() => setPanel("cart")}
            onDone={(o) => {
              setOrder(o);
              cart.clear();
              setPanel("done");
            }}
          />
        )}
        {panel === "done" && order && <ConfirmationPanel order={order} onClose={close} />}
      </Drawer>
    </>
  );
}

const panelTitle = (p: Panel) => (p === "checkout" ? "Vos coordonnées" : p === "done" ? "Commande envoyée" : "Votre panier");

/* ---------------------------------------------------------------- */

function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-congo-night transition-colors hover:border-congo hover:text-congo"
      aria-label={`Ouvrir le panier (${count} article${count > 1 ? "s" : ""})`}
    >
      <ShoppingBag size={18} aria-hidden="true" />
      Panier
      <span className="grid min-w-6 place-items-center rounded-full bg-or px-1.5 text-[0.7rem] font-black text-congo-night">{count}</span>
    </button>
  );
}

function Availability({ product }: { product: MerchProduct }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
      <span className={`h-2 w-2 rounded-full ${availabilityTone[product.availability]}`} aria-hidden="true" />
      {AVAILABILITY_LABELS[product.availability]}
    </p>
  );
}

function SizePicker({ sizes, value, onChange, error }: { sizes: MerchSize[]; value: MerchSize | null; onChange: (s: MerchSize) => void; error: boolean }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Taille</legend>
      <div className="flex flex-wrap gap-1.5">
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={value === s}
            onClick={() => onChange(s)}
            className={`min-h-10 min-w-10 rounded-[4px] border px-2 text-xs font-bold transition-colors ${
              value === s ? "border-congo bg-congo text-white" : "border-slate-200 text-slate-700 hover:border-congo hover:text-congo"
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
function useSizeChoice(product: MerchProduct) {
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

function ProductImage({ product, className = "" }: { product: MerchProduct; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden bg-gradient-to-br from-congo-nuit to-congo-night ${className}`}>
      <img src={product.image} alt={product.name} className="h-full w-full object-contain p-6 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none" />
      {product.badge && (
        <span className="absolute left-3 top-3 rounded-full bg-or px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-congo-night">{product.badge}</span>
      )}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: MerchProduct; onAdd: (p: MerchProduct, s: MerchSize | null) => void }) {
  const choice = useSizeChoice(product);
  const purchasable = isPurchasable(product);

  function add() {
    const size = choice.resolve();
    if (size !== false) onAdd(product, size);
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[6px] border border-slate-200 bg-white">
      <a href={productHref(product)} aria-label={`Voir ${product.name}`}>
        <ProductImage product={product} />
      </a>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-2xl uppercase leading-none text-congo-night">
              <a href={productHref(product)} className="hover:text-congo">{product.name}</a>
            </h3>
            <span className="shrink-0 text-base font-bold tabular-nums text-congo">{formatMerchPrice(product.price)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{product.description}</p>
        </div>
        <Availability product={product} />
        {choice.needsSize && <SizePicker sizes={product.sizes!} value={choice.size} onChange={choice.choose} error={choice.error} />}
        <button
          type="button"
          onClick={add}
          disabled={!purchasable}
          className="mt-auto inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-congo px-5 text-[0.75rem] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-congo-deep disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {purchasable ? "Ajouter au panier" : "Épuisé"}
        </button>
      </div>
    </article>
  );
}

function ProductDetail({
  product,
  cartCount,
  onAdd,
  onOpenCart
}: {
  product: MerchProduct;
  cartCount: number;
  onAdd: (p: MerchProduct, s: MerchSize | null, q: number) => void;
  onOpenCart: () => void;
}) {
  const choice = useSizeChoice(product);
  const [qty, setQty] = useState(1);
  const purchasable = isPurchasable(product);

  function add() {
    const size = choice.resolve();
    if (size === false) return;
    onAdd(product, size, qty);
    setQty(1);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
      <ProductImage product={product} className="rounded-[6px]" />

      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-5xl uppercase leading-[0.9] text-congo-night sm:text-6xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-black tabular-nums text-congo">{formatMerchPrice(product.price)}</p>
          <div className="mt-3"><Availability product={product} /></div>
        </div>

        <p className="leading-relaxed text-slate-600">{product.description}</p>

        {choice.needsSize && <SizePicker sizes={product.sizes!} value={choice.size} onChange={choice.choose} error={choice.error} />}

        <div>
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Quantité</p>
          <QtyStepper value={qty} onChange={setQty} max={20} label={product.name} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={add}
            disabled={!purchasable}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-congo px-6 text-[0.8rem] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-congo-deep disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {purchasable ? "Ajouter au panier" : "Épuisé"}
          </button>
          {cartCount > 0 && (
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 px-6 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-congo-night hover:border-congo hover:text-congo"
            >
              <ShoppingBag size={16} aria-hidden="true" /> Voir le panier ({cartCount})
            </button>
          )}
        </div>

        <ul className="space-y-2 border-t border-slate-100 pt-5 text-sm text-slate-600">
          {product.details.map((d) => (
            <li key={d} className="flex gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-congo" aria-hidden="true" />
              {d}
            </li>
          ))}
        </ul>

        <p className="rounded-[6px] bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          Commande sans compte : vous validez votre panier, la commande nous arrive sur WhatsApp et l'équipe vous recontacte pour le paiement et la livraison.
        </p>
      </div>
    </div>
  );
}

/** `min={0}` dans le panier : descendre sous 1 retire la ligne. */
function QtyStepper({ value, onChange, min = 1, max, label }: { value: number; onChange: (q: number) => void; min?: number; max: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className="grid h-10 w-10 place-items-center text-slate-600 hover:text-congo disabled:opacity-30" aria-label={`Diminuer la quantité (${label})`}>
        <Minus size={14} />
      </button>
      <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="grid h-10 w-10 place-items-center text-slate-600 hover:text-congo disabled:opacity-30" aria-label={`Augmenter la quantité (${label})`}>
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[400]">
          <motion.div
            className="absolute inset-0 bg-congo-night/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-lenis-prevent
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl outline-none"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: reduce ? 0 : 0.35 }}
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-3xl uppercase leading-none text-congo-night">{title}</h2>
              <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-congo-night" aria-label="Fermer">
                <X size={20} />
              </button>
            </header>
            <div className="grid h-[3px] grid-cols-3" aria-hidden="true">
              <div className="bg-flag-blue" />
              <div className="bg-flag-yellow" />
              <div className="bg-flag-red" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function CartPanel({
  items,
  total,
  maxQty,
  onQty,
  onRemove,
  onCheckout,
  onContinue
}: {
  items: ResolvedCartLine[];
  total: number;
  maxQty: number;
  onQty: (key: string, q: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
  onContinue: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <ShoppingBag size={36} className="text-slate-200" aria-hidden="true" />
        <p className="text-slate-500">Votre panier est vide.</p>
        <a href="/boutique" onClick={onContinue} className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-6 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-congo-night hover:border-congo hover:text-congo">
          Voir les produits
        </a>
      </div>
    );
  }

  return (
    <>
      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
        {items.map((l) => (
          <li key={l.key} className="flex gap-4 py-4">
            <a href={productHref(l.product)} className="h-20 w-20 shrink-0 overflow-hidden rounded-[4px] bg-gradient-to-br from-congo-nuit to-congo-night">
              <img src={l.product.image} alt="" className="h-full w-full object-contain p-2" />
            </a>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight text-congo-night">{l.product.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {l.size ? `Taille ${l.size}` : "Taille unique"} · {formatMerchPrice(l.product.price)}
                  </p>
                </div>
                <button type="button" onClick={() => onRemove(l.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-feu" aria-label={`Retirer ${l.product.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <QtyStepper value={l.quantity} onChange={(q) => onQty(l.key, q)} min={0} max={maxQty} label={l.product.name} />
                <span className="font-bold tabular-nums text-congo-night">{formatMerchPrice(l.lineTotal)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-100 p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Total</span>
          <span className="text-2xl font-black tabular-nums text-congo-night">{formatMerchPrice(total)}</span>
        </div>
        <p className="mb-4 text-xs text-slate-400">Frais de livraison confirmés par l'équipe selon votre ville.</p>
        <button type="button" onClick={onCheckout} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-or px-6 text-[0.8rem] font-black uppercase tracking-[0.12em] text-congo-night transition-colors hover:bg-yellow-300">
          Commander
        </button>
      </footer>
    </>
  );
}

/* ---------------------------------------------------------------- */

const inputCls =
  "mt-1.5 block w-full min-h-12 rounded-[6px] border border-slate-200 bg-white px-3.5 text-base text-congo-night placeholder:text-slate-400 focus:border-congo focus:outline-none focus:ring-2 focus:ring-congo/20";

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-congo-night">
      {label} {optional && <span className="font-normal text-slate-400">(facultatif)</span>}
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold text-feu" role="alert">{error}</span>}
    </label>
  );
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.37 9.37 0 0 1 9.43 9.44c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.04.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.3 11.3 0 0 0 5.36 1.37h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.04" />
    </svg>
  );
}

type Errors = Partial<Record<"country" | "city" | "phone", string>>;

function CheckoutPanel({
  countries,
  items,
  total,
  onBack,
  onDone
}: {
  countries: GeoCountry[];
  items: ResolvedCartLine[];
  total: number;
  onBack: () => void;
  onDone: (o: MerchOrder) => void;
}) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [dial, setDial] = useState(countries.find((c) => c.iso === DEFAULT_COUNTRY)?.dial ?? "243");
  const [dialIso, setDialIso] = useState(DEFAULT_COUNTRY);
  const [dialTouched, setDialTouched] = useState(false);
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("mobile_money");
  const [errors, setErrors] = useState<Errors>({});
  const cityCache = useRef(new Map<string, string[]>());

  const countryOptions = useMemo<ComboOption[]>(
    () => countries.map((c) => ({ value: c.iso, label: c.name, flag: c.iso })),
    [countries]
  );
  const dialOptions = useMemo<ComboOption[]>(
    () => countries.map((c) => ({ value: c.iso, label: c.name, flag: c.iso, hint: `+${c.dial}`, keywords: `+${c.dial} ${c.dial}` })),
    [countries]
  );
  const cityOptions = useMemo<ComboOption[]>(() => cities.map((c) => ({ value: c, label: c })), [cities]);

  // Villes du pays choisi (chargées à la demande, mises en cache).
  useEffect(() => {
    const cached = cityCache.current.get(country);
    if (cached) {
      setCities(cached);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    fetch(`/api/geo/cities?country=${country}`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((list: string[]) => {
        if (cancelled) return;
        cityCache.current.set(country, list);
        setCities(list);
        setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  function changeCountry(iso: string) {
    setCountry(iso);
    setCity(""); // la ville dépend du pays : on repart de zéro
    setErrors((e) => ({ ...e, country: undefined, city: undefined }));
    // L'indicatif suit le pays tant que l'utilisateur ne l'a pas choisi lui-même.
    if (!dialTouched) {
      const c = countries.find((x) => x.iso === iso);
      if (c) {
        setDial(c.dial);
        setDialIso(c.iso);
      }
    }
  }

  function changeDial(iso: string) {
    const c = countries.find((x) => x.iso === iso);
    if (!c) return;
    setDial(c.dial);
    setDialIso(iso);
    setDialTouched(true);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const number = get("phone");

    const next: Errors = {};
    if (!country) next.country = "Choisissez un pays.";
    if (!city) next.city = "Choisissez ou saisissez une ville.";
    if (number.replace(/\D/g, "").length < 6) next.phone = "Vérifiez votre numéro WhatsApp.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const countryName = countries.find((c) => c.iso === country)?.name ?? country;
    const order = buildOrder(
      items,
      {
        firstName: get("firstName"),
        lastName: get("lastName"),
        phone: { dial, number },
        country: { iso: country, name: countryName },
        city,
        address: get("address"),
        notes: get("notes") || undefined
      },
      SHOW_PAYMENT_METHODS ? payment : undefined
    );

    // Ouverture synchrone (dans le geste utilisateur) pour ne pas être bloquée.
    window.open(whatsappUrl(orderWhatsappMessage(order, window.location.origin)), "_blank", "noopener");
    submitOrder(order).catch(() => {});
    onDone(order);
  }

  return (
    <form onSubmit={onSubmit} noValidate={false} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input name="firstName" required autoComplete="given-name" className={inputCls} />
          </Field>
          <Field label="Nom">
            <input name="lastName" required autoComplete="family-name" className={inputCls} />
          </Field>
        </div>

        <div>
          <span id="lbl-country" className="block text-sm font-semibold text-congo-night">Pays</span>
          <Combobox
            aria-labelledby="lbl-country"
            className="mt-1.5"
            value={country}
            onChange={changeCountry}
            options={countryOptions}
            placeholder="Choisir un pays"
            searchPlaceholder="Rechercher un pays"
            invalid={!!errors.country}
          />
          {errors.country && <p className="mt-1.5 text-xs font-semibold text-feu" role="alert">{errors.country}</p>}
        </div>

        <div>
          <span id="lbl-city" className="block text-sm font-semibold text-congo-night">Ville</span>
          <Combobox
            key={country}
            aria-labelledby="lbl-city"
            className="mt-1.5"
            value={city}
            onChange={(v) => {
              setCity(v);
              setErrors((e) => ({ ...e, city: undefined }));
            }}
            options={cityOptions}
            placeholder="Choisir une ville"
            searchPlaceholder="Rechercher ou saisir une ville"
            allowCustom
            loading={citiesLoading}
            invalid={!!errors.city}
          />
          {errors.city && <p className="mt-1.5 text-xs font-semibold text-feu" role="alert">{errors.city}</p>}
        </div>

        <div>
          <span id="lbl-phone" className="block text-sm font-semibold text-congo-night">Téléphone WhatsApp</span>
          <div className="mt-1.5 flex gap-2">
            <Combobox
              aria-labelledby="lbl-phone"
              className="w-[7.5rem] shrink-0"
              listWidth="min(20rem, calc(100vw - 2.5rem))"
              value={dialIso}
              onChange={changeDial}
              options={dialOptions}
              placeholder="+"
              searchPlaceholder="Pays ou indicatif"
              renderValue={() => (
                <>
                  <FlagIcon iso={dialIso} />
                  <span className="tabular-nums text-congo-night">+{dial}</span>
                </>
              )}
            />
            <input
              name="phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              aria-labelledby="lbl-phone"
              aria-invalid={!!errors.phone || undefined}
              placeholder="Votre numéro"
              onChange={() => errors.phone && setErrors((e) => ({ ...e, phone: undefined }))}
              className={`${inputCls} mt-0 min-w-0 flex-1 ${errors.phone ? "border-feu" : ""}`}
            />
          </div>
          {errors.phone && <p className="mt-1.5 text-xs font-semibold text-feu" role="alert">{errors.phone}</p>}
        </div>

        <Field label="Commune / adresse de livraison">
          <input name="address" required autoComplete="street-address" placeholder="Gombe, avenue…" className={inputCls} />
        </Field>

        {SHOW_PAYMENT_METHODS && (
          <fieldset>
            <legend className="text-sm font-semibold text-congo-night">Moyen de paiement souhaité</legend>
            <img src="/media/paiement-operateurs.webp" alt="Visa, Mastercard, M-Pesa, Orange Money, Airtel Money, Afrimoney, Visa Pay" width="768" height="115" className="mt-2 h-auto w-full" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[6px] border px-3 text-sm font-semibold transition-colors ${
                    payment === m.id ? "border-congo bg-congo/5 text-congo" : "border-slate-200 text-slate-700 hover:border-slate-300"
                  } ${m.id === "card" ? "col-span-2" : ""}`}
                >
                  <input type="radio" name="payment" value={m.id} checked={payment === m.id} onChange={() => setPayment(m.id)} className="accent-congo" />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Notes" optional>
          <textarea name="notes" rows={3} className={`${inputCls} min-h-[5.5rem] py-3`} placeholder="Point de repère, horaires de livraison…" />
        </Field>

      </div>

      <footer className="border-t border-slate-100 p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">{items.reduce((n, l) => n + l.quantity, 0)} article(s)</span>
          <span className="text-xl font-black tabular-nums text-congo-night">{formatMerchPrice(total)}</span>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="min-h-12 rounded-full border border-slate-200 px-5 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-slate-600 hover:border-slate-300">
            Retour
          </button>
          <button type="submit" disabled={items.length === 0} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-[0.78rem] font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#1ebe5a] disabled:opacity-60">
            <WhatsappIcon /> Commander sur WhatsApp
          </button>
        </div>
      </footer>
    </form>
  );
}

function ConfirmationPanel({ order, onClose }: { order: MerchOrder; onClose: () => void }) {
  const url = whatsappUrl(orderWhatsappMessage(order, typeof window !== "undefined" ? window.location.origin : ""));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={28} aria-hidden="true" />
      </div>
      <p className="mt-5 text-lg font-semibold leading-snug text-congo-night" role="status">
        Commande reçue. Nous allons vous contacter sur WhatsApp pour confirmer le paiement et la livraison.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        WhatsApp s'est ouvert avec le résumé de votre commande : pensez à <strong>envoyer le message</strong>.
      </p>
      <div className="mt-6 rounded-[6px] bg-slate-50 p-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Numéro de commande</p>
        <p className="mt-1 font-mono text-xl font-bold text-congo">{order.number}</p>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          {order.items.map((i) => (
            <li key={`${i.productId}-${i.size}`} className="flex justify-between gap-3">
              <span>{i.quantity} × {i.name}{i.size ? ` (${i.size})` : ""}</span>
              <span className="tabular-nums">{formatMerchPrice(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-bold text-congo-night">
          <span>Total</span>
          <span className="tabular-nums">{formatMerchPrice(order.total)}</span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {order.customer.firstName} {order.customer.lastName} · {formatPhone(order.customer.phone)} · {order.customer.city}, {order.customer.country.name}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <a href={url} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 text-[0.78rem] font-black uppercase tracking-[0.1em] text-white hover:bg-[#1ebe5a]">
          <WhatsappIcon /> Rouvrir WhatsApp
        </a>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full border border-slate-200 px-6 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-congo-night hover:border-congo hover:text-congo">
          Retour à la boutique
        </button>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-24 z-[450] flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="inline-flex items-center gap-2 rounded-full bg-congo-night px-5 py-3 text-sm font-semibold text-white shadow-xl"
          >
            <Check size={16} className="text-or" aria-hidden="true" />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
