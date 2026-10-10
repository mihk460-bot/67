import type { Metal } from "./config";

export const METAL_LABEL: Record<Metal, string> = { gold: "ذهب", silver: "فضة" };

export function orDash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export function formatMoney(amount: number, currency = "EGP"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return amount.toFixed(2) + " " + currency;
  }
}

export function formatTimestamp(value: string | Date, timeZone?: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  let zone = timeZone;
  if (!zone) {
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { zone = "UTC"; }
  }
  const options: Intl.DateTimeFormatOptions = {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" }).formatToParts(date);
    zone = "UTC";
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values["year"] + "-" + values["month"] + "-" + values["day"] + " " + values["hour"] + ":" + values["minute"] + ":" + values["second"];
}

export function formatTimestampWithZone(value: string | Date, timeZone: string): string {
  const zone = timeZone.trim() || "UTC";
  return formatTimestamp(value, zone) + " (" + zone + ")";
}
