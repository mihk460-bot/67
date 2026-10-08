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

export async function renderInvoice(data: InvoiceData): Promise<HTMLCanvasElement> {
  await document.fonts.load('600 32px "IBM Plex Sans Arabic"');
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء الفاتورة");
  const tokens = getComputedStyle(document.documentElement);
  const token = (name: string) => tokens.getPropertyValue(name).trim();
  const paper = token("--invoice-paper"), ink = token("--invoice-ink"), muted = token("--invoice-muted");
  const accent = token(data.metal === "gold" ? "--invoice-gold" : "--invoice-silver");
  const soft = token(data.metal === "gold" ? "--invoice-gold-soft" : "--invoice-silver-soft");
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 1240, 1754);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 1240, 18);
  const text = (value: string, x: number, y: number, size = 30, color = ink, align: CanvasTextAlign = "right", bold = false, maxWidth = 1040) => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.direction = align === "right" ? "rtl" : "ltr";
    ctx.font = `${bold ? 600 : 400} ${size}px "IBM Plex Sans Arabic", sans-serif`;
    ctx.fillText(value, x, y, maxWidth);
  };
  const name = data.storeName.trim() || "حاسبة الصاغة";
  let nameSize = 58;
  ctx.font = `600 ${nameSize}px "IBM Plex Sans Arabic"`;
  while (ctx.measureText(name).width > 1040 && nameSize > 22) { nameSize -= 2; ctx.font = `600 ${nameSize}px "IBM Plex Sans Arabic"`; }
  text(name, 620, 150, nameSize, ink, "center", true);
  text(`فاتورة ${data.metal === "gold" ? "ذهب" : "فضة"} • ${data.side === "sell" ? "بيع" : "شراء"}`, 620, 215, 32, accent, "center", true);
  text(formatDateTime(data.issuedAt, true), 620, 277, 23, muted, "center", false);
  if (data.invoiceNumber) text(`رقم الفاتورة: ${data.invoiceNumber}${data.issuedBy ? ` • الموظف: ${data.issuedBy}` : ""}`, 620, 312, 22, muted, "center");
  ctx.fillStyle = soft; ctx.fillRect(90, 330, 1060, 175);
  text("العيار", 1090, 388, 25, muted); text(data.karat, 1090, 452, 40, ink, "right", true);
  text("الوزن (جرام)", 760, 388, 25, muted); text(fmt(data.weight), 760, 452, 40, ink, "right", true);
  text("سعر الجرام", 395, 388, 25, muted); text(fmt(data.price), 395, 452, 40, ink, "right", true, 245);
  text("تفاصيل الفاتورة", 1150, 580, 32, ink, "right", true);
  const rows: [string, number][] = [
    ["قيمة المعدن الخام", data.baseCost],
    [`المصنعية (${fmt(data.craftsmanship)} للجرام)`, data.craftCost],
    [`الخسارة / الكسر (${fmt(data.wastage)} ${data.wastageUnit === "grams" ? "جرام" : "%"})`, data.wastageCost],
    ["الرسوم الإضافية", data.fees],
    [`الربح (${fmt(data.profitPercent)}%)`, data.profitAmount],
  ];
  rows.forEach(([label, value], i) => {
    const y = 672 + i * 112;
    text(label, 1140, y, 29, muted, "right", false, 730); text(fmt(value), 100, y, 32, ink, "left", true, 290);
    ctx.fillStyle = soft; ctx.fillRect(90, y + 35, 1060, 2);
  });
  ctx.fillStyle = accent; ctx.fillRect(90, 1280, 1060, 160);
  text("الإجمالي النهائي", 1110, 1378, 38, paper, "right", true, 480);
  text(fmt(data.finalTotal), 130, 1378, 48, paper, "left", true, 520);
  text(invoiceFooter, 620, 1670, 23, muted, "center");
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

export function printInvoice(canvas: HTMLCanvasElement) {
  const frame = document.createElement("iframe");
  frame.className = "invoice-print-frame"; frame.title = "طباعة الفاتورة";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); throw new Error("تعذر فتح الطباعة"); }
  doc.open(); doc.write('<!doctype html><html><head><title>فاتورة حاسبة الصاغة</title><style>@page{size:A4;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm}</style></head><body></body></html>'); doc.close();
  const image = doc.createElement("img"); image.alt = "الفاتورة";
  image.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); };
  image.src = canvas.toDataURL("image/png"); doc.body.append(image);
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
  setTimeout(() => frame.remove(), 120_000);
}