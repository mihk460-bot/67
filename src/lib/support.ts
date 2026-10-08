export type ContactType = "phone" | "whatsapp" | "link";

export function contactHref(type: ContactType, value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (type === "phone") return `tel:${digits}`;
  if (type === "whatsapp") {
    if (/[a-z]/i.test(value)) return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
