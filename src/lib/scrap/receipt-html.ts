import { formatMoney, formatTimestamp, formatTimestampWithZone, METAL_LABEL, orDash } from "./format";
import {
  cashBalanceLabel,
  formatCents,
  formatMg,
  metalBalanceLabel,
  type CalcLine,
} from "./calc";
import { RECEIPT_FOOTER_TEXT, RECEIPT_LOGO_URL, RECEIPT_TITLE, targetLabel } from "./config";
import type { SettlementReceipt } from "./receipts";

export type ReceiptLayout = "thermal" | "a4";

export interface ReceiptHtmlOptions {
  layout: ReceiptLayout;
  /** يتفوق على RECEIPT_LOGO_URL من config.ts */
  logoUrl?: string;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** يسمح فقط برابط https/http أو data:image أو مسار نسبي، لمنع حقن عناوين خطرة */
function safeLogo(url: string | undefined): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  return /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,|\/(?!\/))/i.test(value) ? value : "";
}

function linesTable(lines: CalcLine[], equivHeader: string): string {
  if (lines.length === 0) {
    return `<p class="muted">لا توجد بنود</p>`;
  }
  const rows = lines
    .map(
      (line, index) =>
        `<tr><td>${index + 1}</td><td dir="ltr">${esc(formatMg(line.grossMg))}</td><td dir="ltr">${esc(
          String(line.shares),
        )}</td><td dir="ltr">${esc(formatMg(line.equivMg))}</td></tr>`,
    )
    .join("");
  return `<table class="lines"><thead><tr><th>#</th><th>القائم (جم)</th><th>الأسهم</th><th>${esc(
    equivHeader,
  )}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function row(label: string, value: string): string {
  return `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
}

/**
 * قالب السند (RTL). layout = "thermal" لطابعة 80mm، و"a4" للطباعة العادية / حفظ PDF.
 * كل النصوص المدخلة تمر عبر esc() لمنع حقن HTML.
 */
export function buildReceiptHtml(receipt: SettlementReceipt, options: ReceiptHtmlOptions): string {
  const thermal = options.layout === "thermal";
  const unit = targetLabel(receipt.metal, receipt.targetShares);
  const logo = safeLogo(options.logoUrl ?? RECEIPT_LOGO_URL);
  const metalBalance = metalBalanceLabel(receipt.diffEquivMg, unit);
  const cashBalance = cashBalanceLabel(receipt.workmanshipCents - receipt.cashPaidCents, receipt.currency);

  const meta = [
    row("رقم السند", `<strong dir="ltr">${esc(receipt.serial)}</strong>`),
    row("التاريخ والوقت", `<span dir="ltr">${esc(formatTimestampWithZone(receipt.createdAt, receipt.timeZone))}</span>`),
    row("المعدن", esc(METAL_LABEL[receipt.metal])),
    row("الموظف", esc(orDash(receipt.employeeName))),
    row("الزبون", esc(orDash(receipt.customerName))),
  ].join("");

  const pendingNotice = receipt.syncStatus
    ? "<div class=\"pending-notice\">نسخة محلية مؤقتة — لا تحمل رقمًا رسميًا، ولا تُعد صادرة حتى تكتمل المزامنة والتحقق من الخادم.</div>"
    : "";

  const summary = [
    row("إجمالي الصافي المستلم (كسر)", `<span dir="ltr">${esc(formatMg(receipt.receivedEquivMg))} جم</span>`),
    row("إجمالي الصافي المسلَّم (جديد)", `<span dir="ltr">${esc(formatMg(receipt.deliveredEquivMg))} جم</span>`),
    row("وزن قائم مسلَّم", `<span dir="ltr">${esc(formatMg(receipt.deliveredGrossMg))} جم</span>`),
    row(
      "أجرة المصنعية للجرام",
      `<span dir="ltr">${esc(formatMoney(receipt.workmanshipRateCents / 100, receipt.currency))}</span>`,
    ),
    row("إجمالي المصنعية", `<span dir="ltr">${esc(formatCents(receipt.workmanshipCents, receipt.currency))}</span>`),
    row("مدفوع مقدماً", `<span dir="ltr">${esc(formatCents(receipt.cashPaidCents, receipt.currency))}</span>`),
  ].join("");

  const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; line-height: 1.5; }
  ${
    thermal
      ? `@page { size: 80mm auto; margin: 2mm; }
  body { width: 76mm; font-size: 12px; padding: 0; }`
      : `@page { size: A4; margin: 14mm; }
  body { max-width: 180mm; margin: 0 auto; font-size: 14px; padding: 8px; }`
  }
  .center { text-align: center; }
  .logo { max-height: ${thermal ? "18mm" : "28mm"}; max-width: 60%; display: block; margin: 0 auto 4px; }
  h1 { font-size: ${thermal ? "15px" : "20px"}; margin: 2px 0; }
  h2 { font-size: ${thermal ? "13px" : "16px"}; margin: 10px 0 4px; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .muted { color: #555; }
  .pending-notice { border: 2px solid #9b1c1c; color: #7f1d1d; background: #fff1f1; padding: 7px; margin: 8px 0; font-weight: 700; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 3px 2px; vertical-align: top; }
  table.meta th { width: 42%; font-weight: 600; }
  table.lines th, table.lines td { border-bottom: 1px dashed #999; font-size: ${thermal ? "11px" : "13px"}; }
  table.lines thead th { border-bottom: 1px solid #000; }
  .result { border: 2px solid #000; border-radius: 6px; padding: 6px 8px; margin-top: 10px; }
  .result .title { font-size: ${thermal ? "11px" : "13px"}; }
  .result .amount { font-size: ${thermal ? "15px" : "19px"}; font-weight: 700; }
  .result + .result { margin-top: 6px; }
  .sign { display: flex; gap: 16px; margin-top: 26px; }
  .sign div { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 12px; }
  .footer { margin-top: 12px; padding-top: 6px; border-top: 1px dashed #666; text-align: center; font-size: 11px; color: #333; }
  `;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(RECEIPT_TITLE)} ${esc(receipt.serial)}</title>
<style>${css}</style>
</head>
<body>
  <div class="center">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="" />` : ""}
    <h1>${esc(orDash(receipt.shopName))}</h1>
    <div class="muted">${esc(RECEIPT_TITLE)}</div>
  </div>

  ${pendingNotice}
  <table class="meta">${meta}</table>

  <h2>استلام كسر / قديم</h2>
  ${linesTable(receipt.received, unit)}

  <h2>تسليم جديد / صافي</h2>
  ${linesTable(receipt.delivered, unit)}

  <h2>الملخص</h2>
  <table class="meta">${summary}</table>

  <div class="result">
    <div class="title">فرق ${esc(unit)}: ${esc(metalBalance.title)}</div>
    <div class="amount" dir="ltr">${esc(metalBalance.amount)}</div>
  </div>
  <div class="result">
    <div class="title">فرق النقدية / المصنعية: ${esc(cashBalance.title)}</div>
    <div class="amount" dir="ltr">${esc(cashBalance.amount)}</div>
  </div>

  ${receipt.notes ? `<p><strong>ملاحظات:</strong> ${esc(receipt.notes)}</p>` : ""}

  ${
    thermal
      ? ""
      : `<div class="sign"><div>توقيع الصائغ</div><div>توقيع الزبون</div></div>`
  }

  <div class="footer">
    <div dir="ltr">${esc(RECEIPT_FOOTER_TEXT)}</div>
    <div class="muted" dir="ltr">${esc(formatTimestamp(receipt.createdAt, receipt.timeZone))}</div>
  </div>
</body>
</html>`;
}

/** ملخص نصي للمشاركة عبر واتساب أو أي تطبيق */
export function buildReceiptText(receipt: SettlementReceipt): string {
  const unit = targetLabel(receipt.metal, receipt.targetShares);
  const metalBalance = metalBalanceLabel(receipt.diffEquivMg, unit);
  const cashBalance = cashBalanceLabel(receipt.workmanshipCents - receipt.cashPaidCents, receipt.currency);
  return [
    `${RECEIPT_TITLE}`,
    `${orDash(receipt.shopName)}`,
    `رقم السند: ${receipt.serial}`,
    receipt.syncStatus ? "الحالة: مؤقت — بانتظار المزامنة، وليس رقمًا رسميًا" : "",
    `${formatTimestampWithZone(receipt.createdAt, receipt.timeZone)}`,
    receipt.customerName ? `الزبون: ${receipt.customerName}` : "",
    `${METAL_LABEL[receipt.metal]} — ${unit}`,
    `المستلم (كسر): ${formatMg(receipt.receivedEquivMg)} جم`,
    `المسلَّم (جديد): ${formatMg(receipt.deliveredEquivMg)} جم`,
    `الفرق: ${metalBalance.title} — ${metalBalance.amount}`,
    `المصنعية: ${formatCents(receipt.workmanshipCents, receipt.currency)}`,
    `النقدية: ${cashBalance.title} — ${cashBalance.amount}`,
    ``,
    RECEIPT_FOOTER_TEXT,
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}
