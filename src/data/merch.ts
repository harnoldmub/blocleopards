/**
 * Boutique Merch Bloc Léopards — source unique du catalogue.
 *
 * Pour modifier un produit (prix, stock, photo, tailles), il suffit d'éditer
 * la liste `MERCH_PRODUCTS` ci-dessous : la page /boutique se met à jour au
 * prochain build. Les photos vont dans `public/media/merch/`.
 */

/**
 * Boutique visible sur le site ? À `false`, les liens disparaissent et
 * /boutique, /boutique/* et /merch redirigent temporairement vers l'accueil.
 */
export const SHOP_ENABLED = false;

export type MerchSize = "S" | "M" | "L" | "XL" | "XXL";
export const APPAREL_SIZES: MerchSize[] = ["S", "M", "L", "XL", "XXL"];

export type MerchCategory = "textile" | "accessoires" | "goodies";

/** Ordre d'affichage des filtres de la boutique. */
export const MERCH_CATEGORIES: { id: MerchCategory; label: string }[] = [
  { id: "textile", label: "Textile" },
  { id: "accessoires", label: "Accessoires" },
  { id: "goodies", label: "Goodies" }
];

export type MerchAvailability = "in_stock" | "low_stock" | "preorder" | "out_of_stock";

export interface MerchProduct {
  id: string;
  name: string;
  description: string;
  /** Prix unitaire en USD (entier ou décimal). */
  price: number;
  image: string;
  category: MerchCategory;
  availability: MerchAvailability;
  /** Absent = taille unique. */
  sizes?: MerchSize[];
  badge?: string;
  /** Points clés affichés sur la fiche produit. */
  details: string[];
}

export const MERCH_CURRENCY = "USD";

/** Contact de l'équipe boutique (WhatsApp + appel). */
export const MERCH_CONTACT_PHONE = "+243850620014";

export const MERCH_PRODUCTS: MerchProduct[] = [
  {
    id: "maillot-supporter",
    name: "Maillot supporter",
    description: "Bleu Congo, bande jaune et rouge. Tissu respirant pour chanter 90 minutes.",
    price: 35,
    image: "/media/merch/maillot-supporter.svg",
    category: "textile",
    availability: "in_stock",
    sizes: APPAREL_SIZES,
    badge: "Best-seller",
    details: ["Coupe supporter, confortable en tribune", "Polyester respirant, séchage rapide", "Bande diagonale jaune et rouge, étoile brodée", "Lavage à 30 °C"]
  },
  {
    id: "tshirt-bloc-leopards",
    name: "T-shirt Bloc Léopards",
    description: "Coton blanc, logo Bloc Léopards brodé côté cœur.",
    price: 15,
    image: "/media/merch/tshirt-bloc-leopards.svg",
    category: "textile",
    availability: "in_stock",
    sizes: APPAREL_SIZES,
    details: ["100 % coton, col rond", "Logo Bloc Léopards côté cœur", "Liseré aux couleurs du drapeau", "Lavage à 30 °C, sur l'envers"]
  },
  {
    id: "casquette",
    name: "Casquette",
    description: "Casquette bleu nuit, étoile jaune brodée, réglable.",
    price: 12,
    image: "/media/merch/casquette.svg",
    category: "accessoires",
    availability: "low_stock",
    details: ["Taille unique, réglable à l'arrière", "Étoile jaune brodée", "Visière incurvée"]
  },
  {
    id: "echarpe",
    name: "Écharpe",
    description: "Écharpe tricotée aux couleurs du drapeau, à lever en tribune.",
    price: 10,
    image: "/media/merch/echarpe.svg",
    category: "accessoires",
    availability: "in_stock",
    details: ["Maille tricotée double face", "Environ 140 × 18 cm, franges", "Idéale pour les chants en tribune"]
  },
  {
    id: "bracelets-goodies",
    name: "Bracelets & goodies",
    description: "Lot de 3 bracelets silicone bleu, jaune et rouge.",
    price: 3,
    image: "/media/merch/bracelets.svg",
    category: "goodies",
    availability: "preorder",
    details: ["Lot de 3 : bleu, jaune et rouge", "Silicone souple, taille adulte", "Inscription « Toza bomoko »"]
  }
];

export const AVAILABILITY_LABELS: Record<MerchAvailability, string> = {
  in_stock: "En stock",
  low_stock: "Stock limité",
  preorder: "Précommande",
  out_of_stock: "Épuisé"
};

export const isPurchasable = (p: MerchProduct) => p.availability !== "out_of_stock";

/**
 * Le choix du moyen de paiement est masqué tant que le paiement en ligne
 * n'est pas actif : la commande part sur WhatsApp. Repasser à `true` pour
 * réafficher les options dans le formulaire.
 */
export const SHOW_PAYMENT_METHODS = false;

export type PaymentMethod = "mobile_money" | "airtel_money" | "orange_money" | "mpesa" | "card";

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "mobile_money", label: "Mobile Money" },
  { id: "airtel_money", label: "Airtel Money" },
  { id: "orange_money", label: "Orange Money" },
  { id: "mpesa", label: "M-Pesa" },
  { id: "card", label: "Visa / Mastercard" }
];

/** Cycle de vie d'une commande (back-office à venir). */
export type OrderStatus = "pending" | "confirmed" | "paid" | "delivered" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  delivered: "Livrée",
  cancelled: "Annulée"
};

/** « 35 $ », « 7,50 $ » : format usuel en RDC plutôt que « 35,00 $US ». */
export const formatMerchPrice = (amount: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount)} $`;
