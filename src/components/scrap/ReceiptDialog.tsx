import { useMemo, useState } from "react";
import { FileText, MessageCircle, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob, printHtml } from "@/lib/scrap/print";
import { buildReceiptHtml, buildReceiptText, type ReceiptLayout } from "@/lib/scrap/receipt-html";
import type { SettlementReceipt } from "@/lib/scrap/receipts";

interface ReceiptDialogProps {
  receipt: SettlementReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** اختياري: مولّد PDF الموجود في مشروعك — يُستخدم لزر PDF بدل نافذة الطباعة */
  generatePdf?: (receipt: SettlementReceipt, html: string) => Promise<Blob>;
  /** اختياري: شعار المحل (يتفوق على RECEIPT_LOGO_URL) */
  logoUrl?: string;
}

export function ReceiptDialog({ receipt, open, onOpenChange, generatePdf, logoUrl }: ReceiptDialogProps) {
  const [layout, setLayout] = useState<ReceiptLayout>("thermal");

  const html = useMemo(
    () => (receipt ? buildReceiptHtml(receipt, { layout, ...(logoUrl === undefined ? {} : { logoUrl }) }) : ""),
    [receipt, layout, logoUrl],
  );

  if (!receipt) return null;

  const printFailed = () => toast.error("تعذّرت الطباعة من هذا المتصفح");

  function printThermal() {
    if (!receipt) return;
    printHtml(buildReceiptHtml(receipt, { layout: "thermal", ...(logoUrl === undefined ? {} : { logoUrl }) }), printFailed);
  }

  async function savePdf() {
    if (!receipt) return;
    const a4 = buildReceiptHtml(receipt, { layout: "a4", ...(logoUrl === undefined ? {} : { logoUrl }) });
    if (!generatePdf) {
      toast.success("اختر «حفظ كـ PDF» من نافذة الطباعة");
      printHtml(a4, printFailed);
      return;
    }
    try {
      const blob = await generatePdf(receipt, a4);
      const filename = `settlement-${receipt.serial}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: receipt.serial });
      } else {
        downloadBlob(blob, filename);
        toast.success("تم تنزيل ملف PDF");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("تعذّر إنشاء ملف PDF");
    }
  }

  function shareWhatsapp() {
    if (!receipt) return;
    const text = encodeURIComponent(buildReceiptText(receipt));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function shareGeneric() {
    if (!receipt) return;
    const text = buildReceiptText(receipt);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: receipt.serial, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("تم نسخ ملخص السند");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("تعذّرت المشاركة");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            سند تسوية <span dir="ltr">{receipt.serial}</span>
          </DialogTitle>
          <DialogDescription>{receipt.syncStatus ? "هذا سند مؤقت محفوظ على الجهاز؛ لا يصبح رسميًا حتى تتم المزامنة ويحصل على رقم من الخادم." : "معاينة السند. اختر قالب الطباعة ثم اطبع أو شارك."}</DialogDescription>
          {receipt.syncStatus ? <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">نسخة مؤقتة — رقمها غير رسمي حتى اكتمال المزامنة. إذا انقطع الاتصال فلا تحذف بيانات المتصفح.</div> : null}
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={layout === "thermal" ? "default" : "outline"}
            onClick={() => setLayout("thermal")}
          >
            حراري 80mm
          </Button>
          <Button
            type="button"
            size="sm"
            variant={layout === "a4" ? "default" : "outline"}
            onClick={() => setLayout("a4")}
          >
            A4
          </Button>
        </div>

        <iframe
          title={`سند ${receipt.serial}`}
          srcDoc={html}
          sandbox=""
          className="h-[55vh] w-full rounded-md border bg-white"
        />

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={printThermal}>
            <Printer className="me-2 h-4 w-4" />
            طباعة حرارية
          </Button>
          <Button type="button" variant="outline" onClick={() => void savePdf()}>
            <FileText className="me-2 h-4 w-4" />
            PDF
          </Button>
          <Button type="button" variant="outline" onClick={shareWhatsapp}>
            <MessageCircle className="me-2 h-4 w-4" />
            واتساب
          </Button>
          <Button type="button" onClick={() => void shareGeneric()}>
            <Share2 className="me-2 h-4 w-4" />
            مشاركة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
