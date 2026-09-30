import { useCallback, useEffect, useMemo, useState } from "react";
import { MERCH_PRODUCTS, type MerchProduct, type MerchSize } from "../../data/merch";

export interface CartLine {
  productId: string;
  size: MerchSize | null;
  quantity: number;
}

export interface ResolvedCartLine extends CartLine {
  key: string;
  product: MerchProduct;
  lineTotal: number;
}

const STORAGE_KEY = "bl-merch-cart-v1";
const MAX_QTY = 20;

export const lineKey = (productId: string, size: MerchSize | null) => `${productId}::${size ?? "unique"}`;

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Panier local (localStorage) : aucun compte requis. Les prix sont toujours
 * relus depuis le catalogue, jamais depuis le stockage.
 */
export function useMerchCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* stockage indisponible : le panier reste en mémoire */
    }
  }, [lines, ready]);

  const add = useCallback((productId: string, size: MerchSize | null, quantity = 1) => {
    setLines((prev) => {
      const key = lineKey(productId, size);
      const existing = prev.find((l) => lineKey(l.productId, l.size) === key);
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l
        );
      }
      return [...prev, { productId, size, quantity }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => lineKey(l.productId, l.size) !== key)
        : prev.map((l) => (lineKey(l.productId, l.size) === key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l))
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l.productId, l.size) !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const items = useMemo<ResolvedCartLine[]>(
    () =>
      lines.flatMap((l) => {
        const product = MERCH_PRODUCTS.find((p) => p.id === l.productId);
        if (!product) return [];
        return [{ ...l, key: lineKey(l.productId, l.size), product, lineTotal: product.price * l.quantity }];
      }),
    [lines]
  );

  const count = items.reduce((n, l) => n + l.quantity, 0);
  const total = items.reduce((n, l) => n + l.lineTotal, 0);

  return { items, count, total, ready, add, setQuantity, remove, clear, maxQty: MAX_QTY };
}
