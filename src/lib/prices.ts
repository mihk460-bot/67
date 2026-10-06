// Shared, client-safe price helpers.
export type Metal = "gold" | "silver";
export type Side = "sell" | "buy";
export const GOLD_KARATS = ["24", "22", "21", "18"] as const;
export const SILVER_KARATS = ["999", "925", "900", "800"] as const;

export function priceKey(metal: Metal, karat: string, side: Side): string {
  return `${metal}${karat}${side === "buy" ? "Buy" : ""}Price`;
}

export const ALL_PRICE_KEYS: string[] = (["sell", "buy"] as Side[]).flatMap((side) => [
  ...GOLD_KARATS.map((k) => priceKey("gold", k, side)),
  ...SILVER_KARATS.map((k) => priceKey("silver", k, side)),
]);

export type PriceMap = Record<string, number>;

/** Returns the price for a karat; if not set, derives it from the top karat (24 / 999). */
export function resolvePrice(
  prices: PriceMap | undefined,
  metal: Metal,
  karat: string,
  side: Side,
): { value: number; derived: boolean } {
  const own = Number(prices?.[priceKey(metal, karat, side)]) || 0;
  if (own > 0) return { value: own, derived: false };
  const top = metal === "gold" ? "24" : "999";
  const topPrice = Number(prices?.[priceKey(metal, top, side)]) || 0;
  if (!topPrice || karat === top) return { value: 0, derived: false };
  const v = (topPrice * Number(karat)) / Number(top);
  return { value: Math.round(v * 100) / 100, derived: true };
}
