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

export type SupportDestination = { type: ContactType | "text"; value: string };

function whatsappNumber(destination: SupportDestination): string | null {
  const value = destination.value.trim();
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (host === "wa.me" || host.endsWith(".wa.me")) {
      const number = url.pathname.replace(/\D/g, "");
      if (number.length >= 8) return number;
    }
    if (host === "api.whatsapp.com" || host.endsWith(".whatsapp.com")) {
      const number = (url.searchParams.get("phone") ?? "").replace(/\D/g, "");
      if (number.length >= 8) return number;
    }
  } catch {
    // Phone values are handled below.
  }

  if (destination.type === "phone" || destination.type === "whatsapp" || destination.type === "text") {
    const number = value.replace(/\D/g, "");
    if (number.length >= 8) return number;
  }
  return null;
}

export function whatsappMessageHref(
  contacts: SupportDestination[],
  legacyContact: SupportDestination | null,
  message: string,
): string | null {
  const ordered = [
    ...contacts.filter((contact) => contact.type === "whatsapp"),
    ...(legacyContact?.type === "whatsapp" ? [legacyContact] : []),
    ...contacts.filter((contact) => contact.type === "phone"),
    ...(legacyContact && legacyContact.type !== "link" ? [legacyContact] : []),
    ...contacts.filter((contact) => contact.type === "link"),
    ...(legacyContact?.type === "link" ? [legacyContact] : []),
  ];

  for (const destination of ordered) {
    const number = whatsappNumber(destination);
    if (number) return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }
  return null;
}
