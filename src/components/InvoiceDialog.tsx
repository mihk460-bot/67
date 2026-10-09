import { useEffect, useState } from "react";
import { Download, Loader2, MessageCircle, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCustomerInvoiceText, downloadInvoice, invoiceFile, printInvoice, renderInvoice, type InvoiceData, type InvoicePaper } from "@/lib/invoice";

export function InvoiceDialog({ data, onClose }: { data: InvoiceData | null; onClose: () => void }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pending, setPending] = useState(false);
  const [format, setFormat] = useState<"pdf" | "png">("pdf");
  const [paper, setPaper] = useState<InvoicePaper>("a4");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setCanvas(null); setFailed(false);
    if (data) renderInvoice(data, paper).then((result) => { if (active) setCanvas(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [data, paper]);
  const exportFile = async (share: boolean) => {
    if (!canvas || !data || pending) return;
    setPending(true);
    try {
      const outputFormat = share ? format : "pdf";
      const outputCanvas = outputFormat === "pdf" && paper !== "a4" ? await renderInvoice(data, "a4") : canvas;
      const file = await invoiceFile(outputCanvas, data.metal, outputFormat);
      if (share && navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file] });
      else { downloadInvoice(file); toast.success(share ? "تم تحميل الفاتورة؛ يمكنك إرفاقها في واتساب" : "تم تحميل الفاتورة"); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("تعذر تصدير الفاتورة، حاول مرة أخرى");
    } finally { setPending(false); }
  };
  return <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[94dvh] max-w-xl overflow-y-auto p-4 pt-10">
      <DialogHeader><DialogTitle className="text-start">فاتورة {data?.metal === "gold" ? "الذهب" : "الفضة"}</DialogTitle><DialogDescription className="sr-only">معاينة الفاتورة ومشاركتها أو طباعتها</DialogDescription></DialogHeader>
      {canvas ? <img src={canvas.toDataURL("image/png")} alt={`فاتورة ${data?.storeName || "حاسبة الصاغة"}`} className={`mx-auto w-full ${paper === "thermal" ? "max-w-xs" : "max-w-sm"}`} width={canvas.width} height={canvas.height} /> : <div className="flex min-h-48 items-center justify-center">{failed ? <p className="text-destructive">تعذر إنشاء الفاتورة، أعد المحاولة</p> : <Loader2 className="animate-spin text-primary" />}</div>}
      <div className="flex gap-2" role="group" aria-label="صيغة المشاركة">
        <Button variant={format === "pdf" ? "default" : "secondary"} className="flex-1" aria-pressed={format === "pdf"} onClick={() => setFormat("pdf")}>PDF</Button>
        <Button variant={format === "png" ? "default" : "secondary"} className="flex-1" aria-pressed={format === "png"} onClick={() => setFormat("png")}>صورة</Button>
      </div>
      <div className="flex gap-2" role="group" aria-label="مقاس الطباعة">
        <Button variant={paper === "a4" ? "default" : "secondary"} className="flex-1" aria-pressed={paper === "a4"} onClick={() => setPaper("a4")}>A4</Button>
        <Button variant={paper === "thermal" ? "default" : "secondary"} className="flex-1" aria-pressed={paper === "thermal"} onClick={() => setPaper("thermal")}>حراري 80 مم</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!canvas || pending} onClick={() => exportFile(true)}>{pending ? <Loader2 className="animate-spin" /> : <Share2 />}مشاركة الفاتورة</Button>
        <Button disabled={!canvas || pending} variant="secondary" onClick={() => exportFile(false)}><Download />تحميل PDF</Button>
        <Button disabled={!data || pending} className="col-span-2 bg-success text-primary-foreground hover:bg-success/90" onClick={() => {
          if (!data) return;
          const url = `https://wa.me/?text=${encodeURIComponent(buildCustomerInvoiceText(data))}`;
          window.open(url, "_blank", "noopener,noreferrer");
        }}><MessageCircle />إرسال نص الفاتورة عبر واتساب</Button>
        <Button disabled={!canvas || pending} variant="outline" className="col-span-2" onClick={() => { if (canvas) { try { printInvoice(canvas, paper); } catch { toast.error("تعذر فتح الطباعة"); } } }}><Printer />طباعة الفاتورة {paper === "thermal" ? "حراري 80 مم" : "A4"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}