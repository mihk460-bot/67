import { Copy, Link2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { contactHref, type ContactType } from "@/lib/support";
import { cleanWhatsappLink, displayWhatsappLink } from "@/lib/whatsapp";

export function ContactLink({ type, value: raw, label }: { type: ContactType | "text"; value: string; label: string }) {
  const value = type === "whatsapp" ? displayWhatsappLink(cleanWhatsappLink(raw)) || raw.replace(/[[\]]/g, "").trim() : type === "link" ? raw.replace(/\[[^\]]*\]\(([^)]+)\)/, "$1").replace(/[[\]()<>]/g, "").trim() : raw;
  const href = type === "text" ? (/^(https?:\/\/|www\.)/i.test(value) ? contactHref("link", value) : /^[+\d\s()-]+$/.test(value) ? contactHref("phone", value) : null) : contactHref(type, value);
  const Icon = type === "phone" ? Phone : type === "whatsapp" ? MessageCircle : Link2;
  const content = <><Icon className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block break-all text-xs text-muted-foreground" dir="ltr">{value}</span></span></>;
  return <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
    {href ? <a href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3 text-foreground hover:underline">{content}</a> : <span className="flex min-w-0 flex-1 items-center gap-3">{content}</span>}
    <Button type="button" variant="ghost" size="icon" title="نسخ الرابط" aria-label={`نسخ ${label}`} onClick={async () => {
      try { await navigator.clipboard.writeText(href ?? value); toast.success("تم النسخ"); }
      catch { toast.error("تعذر النسخ، يمكنك نسخ بيانات التواصل يدوياً"); }
    }}><Copy /></Button>
  </div>;
}