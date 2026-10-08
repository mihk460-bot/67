/**
 * تنظيف رابط دعم واتساب في صفحة الإعدادات.
 *
 * يعالج الحالات:
 *   "[https://wa.me/201000000000]"                → https://wa.me/201000000000
 *   "[تواصل معنا](https://wa.me/201000000000)"    → https://wa.me/201000000000
 *   "+20 100 000 0000"                            → https://wa.me/201000000000
 *   رابط مقسّم على أسطر أو به مسافات زائدة        → رابط واحد نظيف
 */
export function cleanWhatsappLink(raw: string | null | undefined): string {
  if (!raw) return "";

  let value = raw.replace(/\r?\n|\r/g, " ").trim();

  // صيغة Markdown: [نص](رابط)
  const markdown = value.match(/\[[^\]]*\]\(\s*([^)\s]+)\s*\)/);
  if (markdown) value = markdown[1];

  // إزالة الأقواس وعلامات الاقتباس وأي مسافات
  value = value.replace(/[\[\]()<>"'`]/g, "").replace(/\s+/g, "");
  if (!value) return "";

  // رقم هاتف فقط
  if (/^\+?[\d\-.]{6,}$/.test(value)) {
    return `https://wa.me/${value.replace(/\D/g, "")}`;
  }

  if (/^https?:\/\//i.test(value)) return value;

  // نطاق بدون بروتوكول (wa.me/..., api.whatsapp.com/...)
  if (value.includes(".")) return `https://${value}`;

  return "";
}

/** نسخة قصيرة للعرض بدون البروتوكول */
export function displayWhatsappLink(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
