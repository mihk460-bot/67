import { useEffect, useMemo, useState } from "react";
import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getPublicPrices, getMerchantMe } from "@/lib/app.functions";
import { useRequireRole, readToken } from "@/lib/auth-client";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { recordSale } from "@/lib/logs.functions";
import { createRequestId, enqueueSaleOperation, isLikelyNetworkError, type OfflineSyncedDetail } from "@/lib/offline/outbox";
import { OFFLINE_SYNCED_EVENT } from "@/lib/offline/config";
import type { InvoiceData } from "@/lib/invoice";
import { resolvePrice, type Side } from "@/lib/prices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/")({
  head: () => pageHead("الحاسبة والفواتير", "حساب بيع وشراء الذهب والفضة وإصدار فواتير باسم المحل ومشاركتها وطباعتها"),
  component: CalculatorPage,
});

type Metal = "gold" | "silver";
type GoldKarat = "24" | "22" | "21" | "18";
type SilverKarat = "999" | "925" | "900" | "800";
type WastageUnit = "grams" | "percent";

function CalculatorPage() {
  const auth = useRequireRole("merchant");
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["merchant-me"], queryFn: () => getMerchantMe({ data: { token: readToken() } }) });
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSyncedDetail>).detail;
      if (detail?.kind !== "sale") return;
      setInvoice((current) => {
        if (!current || current.offlineRequestId !== detail.requestId) return current;
        const { syncStatus: _syncStatus, offlineRequestId: _offlineRequestId, ...official } = current;
        return { ...official, invoiceNumber: detail.invoiceNumber, issuedAt: detail.createdAt };
      });
    };
    window.addEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(OFFLINE_SYNCED_EVENT, onSynced);
  }, []);

  const { data: publicPrices, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["public-prices"],
    queryFn: () => getPublicPrices(),
    refetchInterval: 60_000,
  });

  const [metal, setMetal] = useState<Metal>("gold");
  const [karat, setKarat] = useState<GoldKarat>("21");
  const [silverKarat, setSilverKarat] = useState<SilverKarat>("925");

  const [side, setSide] = useState<Side>("sell");
  const [manualPrice, setManualPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [craftsmanship, setCraftsmanship] = useState("");
  const [wastage, setWastage] = useState("");
  const [wastageUnit, setWastageUnit] = useState<WastageUnit>("grams");
  const [profitPercent, setProfitPercent] = useState("");
  const [additionalFees, setAdditionalFees] = useState("");

  const currentKarat = metal === "gold" ? karat : silverKarat;
  const resolved = resolvePrice(publicPrices?.prices, metal, currentKarat, side);

  useEffect(() => {
    if (!publicPrices) return;
    const r = resolvePrice(publicPrices.prices, metal, currentKarat, side);
    setManualPrice(r.value ? String(r.value) : "");
  }, [metal, currentKarat, side, publicPrices]);

  const handleUpdatePrice = async (target: Metal) => {
    setMetal(target);
    const result = await refetch();
    const fresh = result.data;
    if (!fresh) return;
    queryClient.setQueryData(["public-prices"], fresh);
    const r = resolvePrice(fresh.prices, target, target === "gold" ? karat : silverKarat, side);
    setManualPrice(r.value ? String(r.value) : "");
  };

  const calc = useMemo(() => {
    const p = parseFloat(manualPrice) || 0;
    const w = parseFloat(weight) || 0;
    const c = parseFloat(craftsmanship) || 0;
    const wast = parseFloat(wastage) || 0;
    const prof = parseFloat(profitPercent) || 0;
    const fees = parseFloat(additionalFees) || 0;

    const baseCost = p * w;
    const craftCost = c * w;
    const wastageCost = wastageUnit === "grams" ? wast * p : w * (wast / 100) * p;
    const subTotal = baseCost + craftCost + wastageCost + fees;
    const profitAmount = subTotal * (prof / 100);
    const finalTotal = subTotal + profitAmount;

    return { baseCost, craftCost, wastageCost, fees, profitAmount, finalTotal };
  }, [manualPrice, weight, craftsmanship, wastage, wastageUnit, profitPercent, additionalFees]);

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 pb-16 pt-6">
      {/* Metal toggle */}
      <div className="rounded-xl bg-card p-1">
        <div className="flex">
          <button
            type="button"
            onClick={() => setMetal("gold")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-colors ${
              metal === "gold" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            الذهب
          </button>
          <button
            type="button"
            onClick={() => setMetal("silver")}
            className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-colors ${
              metal === "silver" ? "bg-secondary text-foreground" : "text-muted-foreground"
            }`}
          >
            الفضة
          </button>
        </div>
      </div>

      {/* Karat toggle */}
      <div className="rounded-xl bg-card p-1">
        <div className="flex">
          {(metal === "gold"
            ? (["24", "22", "21", "18"] as GoldKarat[])
            : (["999", "925", "900", "800"] as SilverKarat[])
          ).map((k) => {
            const active = metal === "gold" ? karat === (k as GoldKarat) : silverKarat === (k as SilverKarat);
            return (
              <button
                key={k}
                type="button"
                onClick={() => (metal === "gold" ? setKarat(k as GoldKarat) : setSilverKarat(k as SilverKarat))}
                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                  active ? "bg-secondary text-primary" : "text-muted-foreground"
                }`}
              >
                {metal === "gold" ? `عيار ${k}` : `فضة ${k}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sell / buy toggle */}
      <div className="rounded-xl bg-card p-1">
        <div className="flex">
          {(["sell", "buy"] as Side[]).map((sd) => (
            <button
              key={sd}
              type="button"
              onClick={() => setSide(sd)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                side === sd ? "bg-secondary text-primary" : "text-muted-foreground"
              }`}
            >
              {sd === "sell" ? "سعر البيع" : "سعر الشراء"}
            </button>
          ))}
        </div>
      </div>

      {/* Update buttons */}
      <div className="flex gap-2.5">
        <Button
          type="button"
          className="h-12 flex-1 gap-2 font-semibold"
          disabled={isRefetching}
          onClick={() => handleUpdatePrice("gold")}
        >
          {isRefetching && metal === "gold" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          تحديث الذهب
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12 flex-1 gap-2 font-semibold text-primary"
          disabled={isRefetching}
          onClick={() => handleUpdatePrice("silver")}
        >
          {isRefetching && metal === "silver" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          تحديث الفضة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : null}

      {/* Inputs */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-start text-sm text-muted-foreground">
            {side === "sell" ? "سعر بيع" : "سعر شراء"} الجرام ({metal === "gold" ? `ذهب عيار ${karat}` : `فضة عيار ${silverKarat}`})
            {resolved.derived ? (
              <span className="ms-1 text-xs text-primary">
                (محسوب من عيار {metal === "gold" ? "24" : "999"})
              </span>
            ) : null}
          </Label>
          <Input
            inputMode="decimal"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            className="h-14 bg-card font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-start text-sm text-muted-foreground">الوزن (جرام)</Label>
            <Input
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-14 bg-card font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-start text-sm text-muted-foreground">المصنعية (للجرام)</Label>
            <Input
              inputMode="decimal"
              value={craftsmanship}
              onChange={(e) => setCraftsmanship(e.target.value)}
              className="h-14 bg-card font-semibold"
            />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label className="text-start text-sm text-muted-foreground">الخسارة / الكسر</Label>
            <Input
              inputMode="decimal"
              value={wastage}
              onChange={(e) => setWastage(e.target.value)}
              className="h-14 bg-card font-semibold"
            />
          </div>
          <div className="flex rounded-xl bg-card p-1">
            <button
              type="button"
              onClick={() => setWastageUnit("grams")}
              className={`w-16 rounded-lg py-3 text-xs font-semibold ${
                wastageUnit === "grams" ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              جرام
            </button>
            <button
              type="button"
              onClick={() => setWastageUnit("percent")}
              className={`w-16 rounded-lg py-3 text-xs font-semibold ${
                wastageUnit === "percent" ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              نسبة
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-start text-sm text-muted-foreground">نسبة الربح (%)</Label>
            <Input
              inputMode="decimal"
              value={profitPercent}
              onChange={(e) => setProfitPercent(e.target.value)}
              className="h-14 bg-card font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-start text-sm text-muted-foreground">رسوم إضافية</Label>
            <Input
              inputMode="decimal"
              value={additionalFees}
              onChange={(e) => setAdditionalFees(e.target.value)}
              className="h-14 bg-card font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-bold text-foreground">تفاصيل الحساب</h2>
        <div className="space-y-3">
          <BreakdownRow label={`سعر ${metal === "gold" ? "الذهب" : "الفضة"} الخام`} value={calc.baseCost} fmt={fmt} />
          <BreakdownRow label="إجمالي المصنعية" value={calc.craftCost} fmt={fmt} />
          <BreakdownRow label="تكلفة الخسارة" value={calc.wastageCost} fmt={fmt} />
          <BreakdownRow label="الرسوم الإضافية" value={calc.fees} fmt={fmt} />
          <BreakdownRow label="قيمة الربح" value={calc.profitAmount} fmt={fmt} highlight />
          <div className="my-2 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">الإجمالي النهائي</span>
            <span className="num text-2xl font-bold text-primary">{fmt(calc.finalTotal)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5">
        <Button
          type="button"
          className="h-12 flex-1 gap-2 font-semibold"
          disabled={!me?.ok || !me.subscriptionActive || issuing}
          onClick={async () => {
            const values = [manualPrice, weight, craftsmanship, wastage, profitPercent, additionalFees].map((value) => value.trim() === "" ? 0 : Number(value));
            if (values.some((value) => !Number.isFinite(value) || value < 0) || (values[0] ?? 0) <= 0 || (values[1] ?? 0) <= 0 || !Number.isFinite(calc.finalTotal)) {
              toast.error("أدخل سعراً ووزناً أكبر من صفر وقِيماً صحيحة لبقية الحقول"); return;
            }
            if (!auth?.merchantId) { toast.error("تعذر تحديد حساب التاجر"); return; }
            const [price = 0, w = 0, craft = 0, wast = 0, profit = 0] = values;
            const draft: InvoiceData = { storeName: me?.ok ? me.storeName : "", metal, karat: currentKarat, side,
              weight: w, price, craftsmanship: craft, wastage: wast, wastageUnit,
              profitPercent: profit, ...calc, issuedAt: new Date().toISOString(), issuedBy: me?.ok ? me.username : "" };
            setIssuing(true);
            try {
              const token = readToken();
              if (!token) { toast.error("انتهت الجلسة — سجّل الدخول مرة أخرى"); return; }
              const requestId = createRequestId();
              const queueDraft = () => {
                enqueueSaleOperation(auth.merchantId!, requestId, draft);
                setInvoice({ ...draft, invoiceNumber: "PEND-" + requestId.slice(0, 8).toUpperCase(), syncStatus: "pending", offlineRequestId: requestId });
                toast.success("حُفظت الفاتورة مؤقتًا؛ سيصدر رقمها الرسمي بعد المزامنة");
              };
              if (!navigator.onLine) {
                queueDraft();
                return;
              }
              try {
                const res = await recordSale({ data: { token, clientRequestId: requestId, expectedMerchantId: auth.merchantId, invoice: draft } });
                if (!res.ok && res.code === "offline_migration_required") {
                  try {
                    const legacy = await recordSale({ data: { token, expectedMerchantId: auth.merchantId, invoice: draft } });
                    if (!legacy.ok) { toast.error(legacy.message); return; }
                    setInvoice({ ...draft, invoiceNumber: legacy.invoiceNumber, issuedAt: legacy.createdAt });
                    return;
                  } catch {
                    toast.error("لم يصل تأكيد الخادم. تحقّق من سجل المبيعات قبل إعادة الإرسال؛ لم نحفظ نسخة مؤقتة لتجنب التكرار.");
                    return;
                  }
                }
                if (!res.ok) {
                  if (res.code === "database_error") { queueDraft(); return; }
                  toast.error(res.message);
                  return;
                }
                setInvoice({ ...draft, invoiceNumber: res.invoiceNumber, issuedAt: res.createdAt });
              } catch (error) {
                if (!isLikelyNetworkError(error)) throw error;
                queueDraft();
              }
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "تعذر إصدار الفاتورة، حاول مرة أخرى");
            } finally { setIssuing(false); }
          }}
        >
          {issuing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} إصدار الفاتورة
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12 gap-2 font-semibold"
          onClick={() => {
            setWeight("");
            setCraftsmanship("");
            setWastage("");
            setProfitPercent("");
            setAdditionalFees("");
          }}
        >
          <RotateCcw className="size-4" /> تصفير
        </Button>
      </div>
      <InvoiceDialog data={invoice} onClose={() => setInvoice(null)} />
    </main>
  );
}

function BreakdownRow({
  label,
  value,
  fmt,
  highlight,
}: {
  label: string;
  value: number;
  fmt: (v: number) => string;
  highlight?: boolean;
}) {
  if (value === 0 && !highlight) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`num text-sm font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
        {fmt(value)}
      </span>
    </div>
  );
}
