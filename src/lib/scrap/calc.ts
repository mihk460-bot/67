import { formatMoney } from "./format";
import { DEFAULT_CURRENCY } from "./config";

/**
 * حسابات الكسر والربط — كلها بأعداد صحيحة لتفادي أخطاء الفاصلة العائمة:
 *   الأوزان بالملّيجرام (1 جم = 1000 ملجم)، والمبالغ بالقروش (1 = 100).
 * التقريب إلى أقرب ملّيجرام يتم لكل بند على حدة، ثم تُجمع الأعداد الصحيحة.
 */

export const MAX_SHARES = 1000;
const MAX_GRAMS = 100_000;
const MAX_MONEY = 10_000_000;

/* ------------------------------------------------------------------ */
/* قراءة الأرقام (تدعم الأرقام العربية والفاصلة العشرية العربية)         */
/* ------------------------------------------------------------------ */

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, "")
    .replace(/[٫,]/g, ".")
    .replace(/\s+/g, "");
}

/** يعيد رقماً غير سالب أو null إذا كان النص فارغاً/غير صالح */
export function parseDecimal(input: string): number | null {
  const s = normalizeDigits(input);
  if (!s || !/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toMg(grams: number): number {
  return Math.round(grams * 1000);
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** 87500 → "87.500" (بدون استخدام الفاصلة العائمة) */
export function formatMg(mg: number): string {
  const abs = Math.abs(Math.round(mg));
  const sign = mg < 0 && abs > 0 ? "-" : "";
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}

export function formatCents(cents: number, currency: string = DEFAULT_CURRENCY): string {
  return formatMoney(cents / 100, currency);
}

/* ------------------------------------------------------------------ */
/* التحويل إلى صافي                                                      */
/* ------------------------------------------------------------------ */

/** الوزن المكافئ بملّيجرام عند أساس معيّن: القائم × الأسهم ÷ الأساس */
export function equivalentMg(grossMg: number, shares: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.round((grossMg * shares) / target);
}

export interface LineDraftInput {
  gross: string;
  shares: string;
}

export interface CalcLine {
  grossMg: number;
  shares: number;
  equivMg: number;
}

export type LineState =
  | { kind: "empty" }
  | { kind: "invalid"; error: string }
  | { kind: "ok"; line: CalcLine };

/** بند فارغ = الوزن القائم فارغ. العيار له قيمة افتراضية دائماً. */
export function evaluateLine(draft: LineDraftInput, target: number): LineState {
  if (!draft.gross.trim()) return { kind: "empty" };

  const gross = parseDecimal(draft.gross);
  if (gross === null || gross <= 0) return { kind: "invalid", error: "الوزن القائم غير صالح" };
  if (gross > MAX_GRAMS) return { kind: "invalid", error: "الوزن القائم كبير جداً" };

  const shares = parseDecimal(draft.shares);
  if (shares === null || !Number.isInteger(shares) || shares <= 0 || shares > MAX_SHARES) {
    return { kind: "invalid", error: `العيار/الأسهم يجب أن يكون بين 1 و ${MAX_SHARES}` };
  }

  const grossMg = toMg(gross);
  if (grossMg <= 0) return { kind: "invalid", error: "الوزن القائم صغير جداً" };

  return { kind: "ok", line: { grossMg, shares, equivMg: equivalentMg(grossMg, shares, target) } };
}

/* ------------------------------------------------------------------ */
/* المقاصة والربط                                                        */
/* ------------------------------------------------------------------ */

export interface SettlementInput {
  received: LineDraftInput[];
  delivered: LineDraftInput[];
  /** أساس الصافي: 1000 (عيار 24) أو 875 (عيار 21) للذهب، و999 للفضة */
  target: number;
  /** أجرة المصنعية للجرام (نقداً) على الوزن القائم المسلَّم */
  ratePerGram: string;
  /** مبلغ نقدي مدفوع مقدماً من الزبون */
  cashPaid: string;
}

export interface SettlementTotals {
  receivedGrossMg: number;
  receivedEquivMg: number;
  deliveredGrossMg: number;
  deliveredEquivMg: number;
  /** المسلَّم − المستلم (موجب = على الزبون، سالب = للزبون) */
  diffEquivMg: number;
  workmanshipRateCents: number;
  workmanshipCents: number;
  cashPaidCents: number;
  /** المصنعية − المدفوع (موجب = مطلوب من الزبون، سالب = يُرد للزبون) */
  cashDueCents: number;
}

export interface SettlementEvaluation {
  errors: string[];
  received: CalcLine[];
  delivered: CalcLine[];
  totals: SettlementTotals;
  /** هل يوجد بند صالح واحد على الأقل في أي طرف */
  hasData: boolean;
}

function collect(
  drafts: LineDraftInput[],
  target: number,
  sideLabel: string,
  errors: string[],
): CalcLine[] {
  const lines: CalcLine[] = [];
  drafts.forEach((draft, index) => {
    const state = evaluateLine(draft, target);
    if (state.kind === "ok") lines.push(state.line);
    else if (state.kind === "invalid") errors.push(`${sideLabel} — بند ${index + 1}: ${state.error}`);
  });
  return lines;
}

function sum(lines: CalcLine[], pick: (line: CalcLine) => number): number {
  return lines.reduce((total, line) => total + pick(line), 0);
}

function parseMoneyField(value: string, label: string, errors: string[]): number {
  if (!value.trim()) return 0;
  const parsed = parseDecimal(value);
  if (parsed === null || parsed > MAX_MONEY) {
    errors.push(`${label} غير صالح أو أكبر من الحد المسموح`);
    return 0;
  }
  return toCents(parsed);
}

export function computeSettlement(input: SettlementInput): SettlementEvaluation {
  const errors: string[] = [];
  const received = collect(input.received, input.target, "استلام كسر", errors);
  const delivered = collect(input.delivered, input.target, "تسليم جديد", errors);

  const rateCents = parseMoneyField(input.ratePerGram, "أجرة المصنعية", errors);
  const paidCents = parseMoneyField(input.cashPaid, "المبلغ المدفوع", errors);

  const receivedGrossMg = sum(received, (l) => l.grossMg);
  const receivedEquivMg = sum(received, (l) => l.equivMg);
  const deliveredGrossMg = sum(delivered, (l) => l.grossMg);
  const deliveredEquivMg = sum(delivered, (l) => l.equivMg);
  const workmanshipCents = Math.round((rateCents * deliveredGrossMg) / 1000);

  return {
    errors,
    received,
    delivered,
    hasData: received.length + delivered.length > 0,
    totals: {
      receivedGrossMg,
      receivedEquivMg,
      deliveredGrossMg,
      deliveredEquivMg,
      diffEquivMg: deliveredEquivMg - receivedEquivMg,
      workmanshipRateCents: rateCents,
      workmanshipCents,
      cashPaidCents: paidCents,
      cashDueCents: workmanshipCents - paidCents,
    },
  };
}

/* ------------------------------------------------------------------ */
/* عبارات النتيجة                                                        */
/* ------------------------------------------------------------------ */

export type BalanceSide = "customer_owes" | "shop_owes" | "even";

export interface BalanceLabel {
  side: BalanceSide;
  title: string;
  amount: string;
}

/** فرق الذهب/الفضة الصافي */
export function metalBalanceLabel(diffMg: number, unitLabel: string): BalanceLabel {
  if (diffMg === 0) return { side: "even", title: "متعادل — لا فرق في الصافي", amount: formatMg(0) };
  const amount = `${formatMg(Math.abs(diffMg))} جم ${unitLabel}`;
  return diffMg > 0
    ? { side: "customer_owes", title: "على الزبون (مدين للمحل)", amount }
    : { side: "shop_owes", title: "للزبون (دائن على المحل)", amount };
}

/** فرق النقدية/المصنعية */
export function cashBalanceLabel(cents: number, currency: string = DEFAULT_CURRENCY): BalanceLabel {
  if (cents === 0) return { side: "even", title: "مسدّد — لا فرق نقدي", amount: formatCents(0, currency) };
  const amount = formatCents(Math.abs(cents), currency);
  return cents > 0
    ? { side: "customer_owes", title: "مطلوب من الزبون", amount }
    : { side: "shop_owes", title: "يُرَدّ للزبون", amount };
}
