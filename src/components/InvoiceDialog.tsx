import { useEffect, useState } from "react";
import { Download, Loader2, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadInvoice, invoiceFile, printInvoice, renderInvoice, type InvoiceData } from "@/lib/invoice";

export function InvoiceDialog({ data, onClose }: { data: InvoiceData | null; onClose: () => void }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pending, setPending] = useState(false);
  const [format, setFormat] = useState<"pdf" | "png">("pdf");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setCanvas(null); setFailed(false);
    if (data) renderInvoice(data).then((result) => { if (active) setCanvas(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [data]);
  const exportFile = async (share: boolean) => {
    if (!canvas || !data || pending) return;
    setPending(true);
    try {
      const file = await invoiceFile(canvas, data.metal, share ? format : "pdf");
      if (share && navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ files: [file] });
      else { downloadInvoice(file); toast.success(share ? "تم تحميل الفاتورة؛ يمكنك إرفاقها في واتساب" : "تم تحميل الفاتورة"); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("تعذر تصدير الفاتورة، حاول مرة أخرى");
    } finally { setPending(false); }
  };
  return <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[94dvh] max-w-xl overflow-y-auto p-4 pt-10">
      <DialogHeader><DialogTitle className="text-start">فاتورة {data?.metal === "gold" ? "الذهب" : "الفضة"}</DialogTitle><DialogDescription className="sr-only">معاينة الفاتورة ومشاركتها أو طباعتها</DialogDescription></DialogHeader>
      {canvas ? <img src={canvas.toDataURL("image/png")} alt={`فاتورة ${data?.storeName || "حاسبة الصاغة"}`} className="mx-auto w-full max-w-sm" width={1240} height={1754} /> : <div className="flex min-h-48 items-center justify-center">{failed ? <p className="text-destructive">تعذر إنشاء الفاتورة، أعد المحاولة</p> : <Loader2 className="animate-spin text-primary" />}</div>}
      <div className="flex gap-2" role="group" aria-label="صيغة المشاركة">
        <Button variant={format === "pdf" ? "default" : "secondary"} className="flex-1" aria-pressed={format === "pdf"} onClick={() => setFormat("pdf")}>PDF</Button>
        <Button variant={format === "png" ? "default" : "secondary"} className="flex-1" aria-pressed={format === "png"} onClick={() => setFormat("png")}>صورة</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!canvas || pending} onClick={() => exportFile(true)}>{pending ? <Loader2 className="animate-spin" /> : <Share2 />}مشاركة الفاتورة</Button>
        <Button disabled={!canvas || pending} variant="secondary" onClick={() => exportFile(false)}><Download />تحميل PDF</Button>
        <Button disabled={!canvas || pending} variant="outline" className="col-span-2" onClick={() => { if (canvas) { try { printInvoice(canvas); } catch { toast.error("تعذر فتح الطباعة"); } } }}><Printer />طباعة الفاتورة</Button>
      </div>
    </DialogContent>
  </Dialog>;
}