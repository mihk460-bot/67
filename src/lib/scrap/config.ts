export type Metal = "gold" | "silver";

/**
 * إعدادات حاسبة الكسر والربط — عدّل القيم هنا فقط.
 *
 * الأسهم: ذهب عيار 24 = 1000 سهم، وعيار 21 = 875 سهم (= 21 ÷ 24 × 1000)، وعيار 18 = 750 سهم.
 * الصافي = الوزن القائم × الأسهم ÷ أساس الصافي (1000 للذهب عيار 24، و999 للفضة).
 */

export interface SharesPreset {
  shares: number;
  label: string;
}

export const GOLD_PRESETS: SharesPreset[] = [
  { shares: 1000, label: "عيار 24 — 1000 سهم" },
  { shares: 916, label: "عيار 22 — 916 سهم" },
  { shares: 875, label: "عيار 21 — 875 سهم" },
  { shares: 750, label: "عيار 18 — 750 سهم" },
];

export const SILVER_PRESETS: SharesPreset[] = [
  { shares: 999, label: "فضة 999 سهم" },
  { shares: 925, label: "فضة 925 سهم" },
  { shares: 900, label: "فضة 900 سهم" },
  { shares: 800, label: "فضة 800 سهم" },
];

/** أساس الصافي الافتراضي لكل معدن */
export const GOLD_PURE_BASE = 1000;
export const SILVER_PURE_BASE = 999;

/** الأسس المتاحة لعرض فرق الذهب الصافي في المقاصة (عيار 24 أو عيار 21) */
export const GOLD_TARGETS: Array<{ shares: number; label: string }> = [
  { shares: 1000, label: "صافي عيار 24" },
  { shares: 875, label: "صافي عيار 21" },
];

/** العملة الافتراضية للمصنعية (EGP) */
export const DEFAULT_CURRENCY = "EGP";

/** شعار المحل على السند: رابط (https://...) أو data:image/... أو مسار يبدأ بـ / — اتركه فارغاً لإخفائه */
export const RECEIPT_LOGO_URL = "";

/** مذيّلة السند */
export const RECEIPT_FOOTER_TEXT = "Powered by 21 Gain Global";

/** عنوان السند */
export const RECEIPT_TITLE = "سند تسوية كسر وربط";

/** أقصى عدد سندات يعرضها الاستعلام في الصفحة الواحدة */
export const MAX_RECEIPTS = 500;

export function presetsFor(metal: Metal): SharesPreset[] {
  return metal === "gold" ? GOLD_PRESETS : SILVER_PRESETS;
}

export function defaultSharesFor(metal: Metal): string {
  return metal === "gold" ? "875" : "925";
}

export function defaultTargetFor(metal: Metal): number {
  return metal === "gold" ? GOLD_PURE_BASE : SILVER_PURE_BASE;
}

/** تسمية أساس الصافي: 1000 → صافي عيار 24، 875 → صافي عيار 21، 999 → فضة صافية 999 */
export function targetLabel(metal: Metal, target: number): string {
  if (metal === "silver") return `فضة صافية ${target}`;
  if (target === 1000) return "صافي عيار 24";
  if (target === 875) return "صافي عيار 21";
  return `صافي ${target} سهم`;
}
