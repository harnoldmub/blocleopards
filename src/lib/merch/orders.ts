import { MERCH_CONTACT_PHONE, MERCH_CURRENCY, PAYMENT_METHODS, formatMerchPrice, type MerchSize, type OrderStatus, type PaymentMethod } from "../../data/merch";
import type { ResolvedCartLine } from "./cart";

export interface MerchCustomer {
  firstName: string;
  lastName: string;
  /** Indicatif sans « + » et numéro local, ex. { dial: "243", number: "850 620 014" }. */
  phone: { dial: string; number: string };
  country: { iso: string; name: string };
  city: string;
  address: string;
  notes?: string;
}

export interface MerchOrderItem {
  productId: string;
  name: string;
  size: MerchSize | null;
  quantity: number;
  unitPrice: number;
}

/** Forme d'une commande — c'est ce que recevra la future API POST /api/orders. */
export interface MerchOrder {
  number: string;
  status: OrderStatus;
  items: MerchOrderItem[];
  customer: MerchCustomer;
  /** Vide tant que le choix du paiement est masqué (SHOW_PAYMENT_METHODS). */
  paymentMethod?: PaymentMethod;
  total: number;
  currency: string;
  channel: "whatsapp";
  createdAt: string;
}

/**
 * Passer à `true` quand la route /api/orders existera (enregistrement Neon,
 * notification équipe…). D'ici là, la commande est simulée côté navigateur.
 * Rappel : l'API devra recalculer les prix depuis le catalogue, pas faire
 * confiance au total envoyé par le client.
 */
const ORDERS_API_ENABLED = import.meta.env.PUBLIC_MERCH_ORDERS_API === "true";

export function generateOrderNumber(date = new Date()) {
  const digits = new Uint16Array(1);
  crypto.getRandomValues(digits);
  const suffix = String(digits[0] % 10000).padStart(4, "0");
  return `BL-MERCH-${date.getFullYear()}-${suffix}`;
}

export const formatPhone = (p: MerchCustomer["phone"]) => `+${p.dial} ${p.number}`.trim();

export function buildOrder(items: ResolvedCartLine[], customer: MerchCustomer, paymentMethod?: PaymentMethod): MerchOrder {
  const orderItems = items.map((l) => ({
    productId: l.product.id,
    name: l.product.name,
    size: l.size,
    quantity: l.quantity,
    unitPrice: l.product.price
  }));
  return {
    number: generateOrderNumber(),
    status: "pending",
    items: orderItems,
    customer,
    paymentMethod,
    total: orderItems.reduce((n, i) => n + i.unitPrice * i.quantity, 0),
    currency: MERCH_CURRENCY,
    channel: "whatsapp",
    createdAt: new Date().toISOString()
  };
}

/** Résumé complet envoyé à l'équipe sur WhatsApp (liens produits inclus). */
export function orderWhatsappMessage(order: MerchOrder, origin: string) {
  const c = order.customer;
  const payment = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)?.label;
  return [
    `Bonjour Bloc Léopards, je souhaite commander.`,
    `Commande : ${order.number}`,
    ``,
    `ARTICLES`,
    ...order.items.flatMap((i) => [
      `• ${i.quantity} × ${i.name}${i.size ? ` (taille ${i.size})` : ""} : ${formatMerchPrice(i.unitPrice * i.quantity)}`,
      `  ${origin}/boutique/${i.productId}`
    ]),
    `Total : ${formatMerchPrice(order.total)} (hors livraison)`,
    ``,
    `CLIENT`,
    `Nom : ${c.firstName} ${c.lastName}`,
    `WhatsApp : ${formatPhone(c.phone)}`,
    `Pays : ${c.country.name}`,
    `Ville : ${c.city}`,
    `Adresse : ${c.address}`,
    ...(payment ? [`Paiement souhaité : ${payment}`] : []),
    ...(c.notes ? [`Notes : ${c.notes}`] : [])
  ].join("\n");
}

export const whatsappUrl = (text: string) =>
  `https://wa.me/${MERCH_CONTACT_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export async function submitOrder(order: MerchOrder): Promise<MerchOrder> {
  if (ORDERS_API_ENABLED) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });
    if (!res.ok) throw new Error("La commande n'a pas pu être enregistrée. Réessayez dans un instant.");
    const saved = await res.json().catch(() => ({}));
    return { ...order, ...(saved?.order ?? {}) };
  }

  // Simulation : trace locale (10 dernières commandes) pour le support.
  try {
    const history = JSON.parse(localStorage.getItem("bl-merch-orders") ?? "[]");
    localStorage.setItem("bl-merch-orders", JSON.stringify([...history, order].slice(-10)));
  } catch {
    /* sans importance */
  }
  return order;
}
