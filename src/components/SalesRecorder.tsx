import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, ShoppingCart } from "lucide-react";
import { recordSale } from "@/lib/sales.functions";
import { readToken } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SalesRecorderProps {
  onSaleRecorded?: () => void;
}

export function SalesRecorder({ onSaleRecorded }: SalesRecorderProps) {
  const queryClient = useQueryClient();
  const token = readToken();
  const [open, setOpen] = useState(false);

  // Form state
  const [metalType, setMetalType] = useState<"gold" | "silver">("gold");
  const [karat, setKarat] = useState("21");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saleType, setSaleType] = useState<"sell" | "buy">("sell");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordSale({
        data: {
          token,
          metalType,
          karat,
          quantity: parseFloat(quantity),
          unitPrice: parseFloat(unitPrice),
          saleType,
          note,
        },
      }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("تم تسجيل المبيعة بنجاح ✅");
        queryClient.invalidateQueries({ queryKey: ["merchant-sales"] });
        queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
        queryClient.invalidateQueries({ queryKey: ["employee-stats"] });

        // Reset form
        setMetalType("gold");
        setKarat("21");
        setQuantity("");
        setUnitPrice("");
        setSaleType("sell");
        setNote("");
        setOpen(false);

        onSaleRecorded?.();
      } else {
        toast.error(result.message || "تعذر تسجيل المبيعة");
      }
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تسجيل المبيعة");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!quantity || !unitPrice) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }

    const q = parseFloat(quantity);
    const p = parseFloat(unitPrice);

    if (q <= 0 || p < 0) {
      toast.error("الكمية يجب أن تكون أكبر من صفر، والسعر لا يمكن أن يكون سالباً");
      return;
    }

    mutation.mutate();
  };

  const goldKarats = ["24", "22", "21", "18"];
  const silverKarats = ["999", "925", "900", "800"];
  const karats = metalType === "gold" ? goldKarats : silverKarats;

  const totalPrice =
    quantity && unitPrice
      ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2)
      : "0.00";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 font-semibold"
        size="lg"
      >
        <ShoppingCart className="size-4" />
        تسجيل مبيعة جديدة
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start text-lg font-bold text-foreground">
              📊 تسجيل مبيعة جديدة
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pb-6">
            {/* نوع المعدن */}
            <div className="space-y-2">
              <Label className="text-start text-sm font-semibold">
                نوع المعدن
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMetalType("gold");
                    setKarat("21");
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    metalType === "gold"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  🔨 ذهب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetalType("silver");
                    setKarat("925");
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    metalType === "silver"
                      ? "bg-secondary text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  💍 فضة
                </button>
              </div>
            </div>

            {/* العيار */}
            <div className="space-y-2">
              <Label className="text-start text-sm font-semibold">العيار</Label>
              <div className="grid grid-cols-4 gap-2">
                {karats.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKarat(k)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                      karat === k
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* نوع الصفقة */}
            <div className="space-y-2">
              <Label className="text-start text-sm font-semibold">
                نوع الصفقة
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaleType("sell")}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    saleType === "sell"
                      ? "bg-success text-white"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  📤 بيع
                </button>
                <button
                  type="button"
                  onClick={() => setSaleType("buy")}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    saleType === "buy"
                      ? "bg-warning text-white"
                      : "bg-card border border-border text-foreground"
                  }`}
                >
                  📥 شراء
                </button>
              </div>
            </div>

            {/* الكمية والسعر */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-start text-sm">
                  الكمية (جرام)
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-12 bg-card font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice" className="text-start text-sm">
                  سعر الجرام
                </Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="h-12 bg-card font-semibold"
                />
              </div>
            </div>

            {/* الإجمالي المعاين */}
            {quantity && unitPrice && (
              <div className="rounded-xl border border-primary bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    الإجمالي المبدئي:
                  </span>
                  <span className="num text-lg font-bold text-primary">
                    {totalPrice}
                  </span>
                </div>
              </div>
            )}

            {/* الملاحظة */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-start text-sm">
                ملاحظة (اختيارية)
              </Label>
              <textarea
                id="note"
                placeholder="مثال: عميل جديد، صفقة نقد..."
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                maxLength={500}
                className="h-20 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <p className="text-xs text-muted-foreground text-end">
                {note.length}/500
              </p>
            </div>

            {/* الأزرار */}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={mutation.isPending || !quantity || !unitPrice}
                className="h-12 flex-1 gap-2 text-base font-semibold"
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                حفظ المبيعة
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-12 flex-1 text-base font-semibold"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
