import { MessageCircle } from "lucide-react";
import type { SupportContact } from "@/lib/app.functions";
import { whatsappMessageHref, type SupportDestination } from "@/lib/support";

type Props = {
  contacts?: SupportContact[];
  supportContact?: string | undefined;
  supportContactType?: string | undefined;
  storeName?: string;
  message?: string;
  purpose?: "support" | "renewal";
  size?: "compact" | "card" | "large";
};

export function WhatsAppSupportButton({
  contacts = [],
  supportContact,
  supportContactType = "phone",
  storeName = "",
  message,
  purpose = "support",
  size = "card",
}: Props) {
  const legacyContact: SupportDestination | null = supportContact
    ? { type: supportContactType as SupportDestination["type"], value: supportContact }
    : null;
  const contactList: SupportDestination[] = contacts.map(({ type, value }) => ({ type, value }));
  const preparedMessage = message ?? (purpose === "renewal"
    ? `أرغب في تجديد اشتراك محلي (${storeName.trim() || "اسم المحل"})`
    : "هل تحتاچ مساعدة؟ تواصل مع الدعم الفني المباشر الآن");
  const href = whatsappMessageHref(contactList, legacyContact, preparedMessage);

  if (!href) return null;

  const sizeClass = size === "compact"
    ? "gap-2 rounded-xl px-3 py-3 text-sm"
    : size === "large"
      ? "gap-4 rounded-2xl px-6 py-5 text-lg"
      : "gap-3 rounded-2xl px-5 py-4 text-base";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-full items-center justify-center bg-success font-bold text-primary-foreground shadow-lg shadow-success/20 transition hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${purpose === "renewal" && size === "large" ? "motion-safe:animate-pulse" : ""} ${sizeClass}`}
    >
      <MessageCircle className={size === "compact" ? "size-5 shrink-0" : "size-7 shrink-0"} aria-hidden="true" />
      <span className="text-center leading-relaxed">
        {purpose === "renewal" ? "تواصل عبر واتساب لتجديد الاشتراك" : "هل تحتاچ مساعدة؟ تواصل مع الدعم الفني المباشر الآن"}
      </span>
    </a>
  );
}
