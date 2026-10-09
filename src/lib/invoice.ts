export type InvoiceData = {
  storeName: string; metal: "gold" | "silver"; karat: string; side: "sell" | "buy";
  weight: number; price: number; craftsmanship: number; wastage: number; wastageUnit: "grams" | "percent";
  profitPercent: number; baseCost: number; craftCost: number; wastageCost: number; fees: number;
  profitAmount: number; finalTotal: number; issuedAt: string;
  invoiceNumber?: string; issuedBy?: string;
};
import { formatDateTime } from "./datetime";
export const invoiceFooter = "Powered by 21 Gain Global";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export type InvoicePaper = "a4" | "thermal";

export function customerInvoiceRows(data: InvoiceData): { label: string; value: string }[] {
  const rows = [
    { label: "تفاصيل القطعة", value: `${data.metal === "gold" ? "ذهب" : "فضة"} • ${data.side === "sell" ? "بيع" : "شراء"}` },
    { label: "الوزن القائم", value: `${fmt(data.weight)} جرام` },
    { label: "العيار", value: data.karat },
    { label: "سعر الجرام", value: fmt(data.price) },
  ];

  if (data.craftCost > 0) rows.push({ label: "إجمالي المصنعية", value: fmt(data.craftCost) });
  if (data.wastage > 0) {
    rows.push({
      label: "الهالك / الكسر",
      value: `${fmt(data.wastage)} ${data.wastageUnit === "grams" ? "جرام" : "%"}${data.wastageCost > 0 ? ` • ${fmt(data.wastageCost)}` : ""}`,
    });
  }

  return rows;
}

export function buildCustomerInvoiceText(data: InvoiceData): string {
  const lines = [
    `المحل: ${data.storeName.trim() || "حاسبة الصاغة"}`,
    `الموظف: ${data.issuedBy?.trim() || "—"}`,
    ...(data.invoiceNumber ? [`رقم الفاتورة: ${data.invoiceNumber}`] : []),
    `التاريخ والوقت: ${formatDateTime(data.issuedAt)}`,
    ...customerInvoiceRows(data).map(({ label, value }) => `${label}: ${value}`),
    `الإجمالي النهائي المطلوب: ${fmt(data.finalTotal)}`,
  ];
  return lines.join("\n");
}

export async function renderInvoice(data: InvoiceData, paper: InvoicePaper = "a4"): Promise<HTMLCanvasElement> {
  await document.fonts.load('600 32px "IBM Plex Sans Arabic"');
  await document.fonts.ready;
  const thermal = paper === "thermal";
  const width = thermal ? 800 : 1240;
  const rows = customerInvoiceRows(data);
  const rowStart = thermal ? 330 : 690;
  const rowHeight = thermal ? 62 : 105;
  const totalTop = rowStart + rows.length * rowHeight + (thermal ? 25 : 45);
  const totalHeight = thermal ? 125 : 160;
  const footerY = totalTop + totalHeight + (thermal ? 70 : 165);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = thermal ? footerY + 75 : 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء الفاتورة");
  const tokens = getComputedStyle(document.documentElement);
  const token = (name: string) => tokens.getPropertyValue(name).trim();
  const paperColor = token("--invoice-paper"), ink = token("--invoice-ink"), muted = token("--invoice-muted");
  const accent = token(data.metal === "gold" ? "--invoice-gold" : "--invoice-silver");
  const soft = token(data.metal === "gold" ? "--invoice-gold-soft" : "--invoice-silver-soft");
  ctx.fillStyle = paperColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, thermal ? 12 : 18);
  const text = (value: string, x: number, y: number, size = 30, color = ink, align: CanvasTextAlign = "right", bold = false, maxWidth = width - 100) => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.direction = align === "right" ? "rtl" : "ltr";
    ctx.font = `${bold ? 600 : 400} ${size}px "IBM Plex Sans Arabic", sans-serif`;
    ctx.fillText(value, x, y, maxWidth);
  };
  const name = data.storeName.trim() || "حاسبة الصاغة";
  let nameSize = thermal ? 42 : 58;
  ctx.font = `600 ${nameSize}px "IBM Plex Sans Arabic"`;
  while (ctx.measureText(name).width > width - 100 && nameSize > 22) {
    nameSize -= 2;
    ctx.font = `600 ${nameSize}px "IBM Plex Sans Arabic"`;
  }
  text(name, width / 2, thermal ? 78 : 150, nameSize, ink, "center", true);
  text(`فاتورة ${data.metal === "gold" ? "ذهب" : "فضة"} • ${data.side === "sell" ? "بيع" : "شراء"}`, width / 2, thermal ? 130 : 215, thermal ? 30 : 32, accent, "center", true);
  text(`الموظف: ${data.issuedBy?.trim() || "—"}`, width / 2, thermal ? 180 : 270, thermal ? 24 : 23, muted, "center");
  text(formatDateTime(data.issuedAt, true), width / 2, thermal ? 218 : 315, thermal ? 18 : 21, muted, "center", false);
  if (data.invoiceNumber) text(`رقم الفاتورة: ${data.invoiceNumber}`, width / 2, thermal ? 252 : 355, thermal ? 19 : 22, muted, "center");

  rows.forEach(({ label, value }, index) => {
    const y = rowStart + index * rowHeight;
    if (!thermal) {
      ctx.fillStyle = soft;
      ctx.fillRect(90, y - 53, 1060, 76);
    }
    text(label, width - (thermal ? 45 : 110), y, thermal ? 29 : 29, muted, "right", false, thermal ? 440 : 680);
    text(value, thermal ? 45 : 110, y, thermal ? 27 : 30, ink, "left", true, thermal ? 250 : 350);
    ctx.fillStyle = soft;
    ctx.fillRect(thermal ? 40 : 90, y + (thermal ? 20 : 35), width - (thermal ? 80 : 180), 2);
  });
  ctx.fillStyle = accent;
  ctx.fillRect(thermal ? 35 : 90, totalTop, width - (thermal ? 70 : 180), totalHeight);
  text("الإجمالي النهائي المطلوب", width - (thermal ? 55 : 130), totalTop + (thermal ? 53 : 63), thermal ? 25 : 35, paperColor, "right", true, thermal ? 390 : 480);
  text(fmt(data.finalTotal), thermal ? 55 : 130, totalTop + (thermal ? 100 : 125), thermal ? 36 : 48, paperColor, "left", true, thermal ? 300 : 520);
  text(invoiceFooter, width / 2, footerY + 35, thermal ? 17 : 23, muted, "center");
  return canvas;
}

export async function invoiceFile(canvas: HTMLCanvasElement, metal: InvoiceData["metal"], format: "pdf" | "png"): Promise<File> {
  const filename = `invoice-${metal}-${Date.now()}.${format}`; // unique per export
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.setProperties({ title: "حاسبة الصاغة — فاتورة", creator: invoiceFooter });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
    return new File([pdf.output("blob")], filename, { type: "application/pdf" });
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("تعذر إنشاء الصورة")), "image/png"));
  return new File([blob], filename, { type: "image/png" });
}

export function downloadInvoice(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a"); link.href = url; link.download = file.name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printInvoice(canvas: HTMLCanvasElement, paper: InvoicePaper = "a4") {
  const frame = document.createElement("iframe");
  frame.className = "invoice-print-frame"; frame.title = "طباعة الفاتورة";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); throw new Error("تعذر فتح الطباعة"); }
  const printStyles = paper === "thermal"
    ? "@page{size:80mm auto;margin:0}html,body{margin:0;width:80mm}img{display:block;width:80mm;height:auto}"
    : "@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}";
  doc.open();
  doc.write(`<!doctype html><html><head><title>فاتورة حاسبة الصاغة</title><style>${printStyles}</style></head><body></body></html>`);
  doc.close();
  const image = doc.createElement("img"); image.alt = "الفاتورة";
  image.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); };
  image.src = canvas.toDataURL("image/png"); doc.body.append(image);
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
  setTimeout(() => frame.remove(), 120_000);
}