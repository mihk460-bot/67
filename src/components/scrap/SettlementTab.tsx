import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Gem, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterField, StatCard, selectClass, LinesEditor, newLine, type LineDraft } from "@/components/scrap/ScrapParts";
import { ReceiptDialog } from "@/components/scrap/ReceiptDialog";
import { readToken, useRequireRole } from "@/lib/auth-client";
import { deviceTimeZone } from "@/lib/datetime";
import { METAL_LABEL } from "@/lib/scrap/format";
import type { Metal } from "@/lib/scrap/config";
import {
  cashBalanceLabel,
  computeSettlement,
  formatCents,
  formatMg,
  metalBalanceLabel,
  type BalanceLabel,
  type BalanceSide,
} from "@/lib/scrap/calc";
import { GOLD_TARGETS, defaultTargetFor, targetLabel } from "@/lib/scrap/config";
import { scrapKeys } from "@/lib/scrap/queries";
import { issueScrapReceipt } from "@/lib/scrap.functions";
import type { SettlementReceipt } from "@/lib/scrap/receipts";

const sideClass: Record<BalanceSide, string> = {
  customer_owes: "border-primary/50 bg-primary/10",
  shop_owes: "border-secondary bg-secondary/40",
  even: "border-border bg-muted",
};

function BalanceBox({ heading, label }: { heading: string; label: BalanceLabel }) {
  return (
    <div className={`rounded-lg border p-4 ${sideClass[label.side]}`} aria-live="polite">
      <p className="text-sm text-muted-foreground">{heading}</p>
      <p className="mt-1 font-medium">{label.title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" dir="ltr">
        {label.amount}
      </p>
    </div>
  );
}

/** مقاصة وتصفية الحساب (الربط) بين الصائغ والزبون/الورشة */
export function SettlementTab() {
  const auth = useRequireRole("merchant");
  const queryClient = useQueryClient();

  const [metal, setMetal] = useState<Metal>("gold");
  const [target, setTarget] = useState<number>(defaultTargetFor("gold"));
  const [received, setReceived] = useState<LineDraft[]>(() => [newLine("gold")]);
  const [delivered, setDelivered] = useState<LineDraft[]>(() => [newLine("gold")]);
  const [rate, setRate] = useState("");
  const [cashPaid, setCashPaid] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<SettlementReceipt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const evaluation = useMemo(
    () => computeSettlement({ received, delivered, target, ratePerGram: rate, cashPaid }),
    [received, delivered, target, rate, cashPaid],
  );
  const { totals } = evaluation;
  const unit = targetLabel(metal, target);

  function resetForm(forMetal: Metal = metal) {
    setReceived([newLine(forMetal)]);
    setDelivered([newLine(forMetal)]);
    setRate("");
    setCashPaid("");
    setCustomer("");
    setNotes("");
  }

  function changeMetal(next: Metal) {
    if (next === metal) return;
    setMetal(next);
    setTarget(defaultTargetFor(next));
    resetForm(next);
  }

  async function handleIssue() {
    if (evaluation.errors.length > 0) return void toast.error(evaluation.errors[0]);
    if (!evaluation.hasData) return void toast.error("أدخل بنداً واحداً على الأقل");
    const token = readToken();
    if (!token) return void toast.error("انتهت الجلسة — سجّل الدخول مرة أخرى");

    setSaving(true);
    try {
      const result = await issueScrapReceipt({
        data: {
          token,
          metal,
          target,
          received: received.map(({ gross, shares }) => ({ gross, shares })),
          delivered: delivered.map(({ gross, shares }) => ({ gross, shares })),
          ratePerGram: rate,
          cashPaid,
          customerName: customer,
          notes,
          timeZone: deviceTimeZone(),
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const receipt = result.receipt;
      await queryClient.invalidateQueries({ queryKey: scrapKeys.receipts(auth?.merchantId) });
      setIssued(receipt);
      setDialogOpen(true);
      resetForm();
      toast.success("تم إصدار السند " + receipt.serial);
    } catch {
      toast.error("تعذّر حفظ السند في سجل المحل");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* المعدن وأساس الصافي */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <FilterField label="المعدن">
            <div className="flex gap-2">
              {(["gold", "silver"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={metal === m ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => changeMetal(m)}
                >
                  {METAL_LABEL[m]}
                </Button>
              ))}
            </div>
          </FilterField>

          {metal === "gold" ? (
            <FilterField label="عرض فرق الذهب الصافي بـ">
              <select className={selectClass} value={String(target)} onChange={(e) => setTarget(Number(e.target.value))}>
                {GOLD_TARGETS.map((t) => (
                  <option key={t.shares} value={String(t.shares)}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FilterField>
          ) : (
            <FilterField label="أساس الصافي">
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">فضة صافية 999</div>
            </FilterField>
          )}
        </CardContent>
      </Card>

      {/* طرفا المقاصة */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LinesEditor
          title="استلام كسر / قديم"
          hint="ما استلمه الصائغ من الزبون أو الورشة"
          metal={metal}
          target={target}
          unitLabel={unit}
          lines={received}
          onChange={setReceived}
        />
        <LinesEditor
          title="تسليم جديد / صافي"
          hint="ما سلّمه الصائغ للزبون"
          metal={metal}
          target={target}
          unitLabel={unit}
          lines={delivered}
          onChange={setDelivered}
        >
          <FilterField label="المصنعية / أجرة الجرام (نقداً) على الوزن القائم المسلَّم">
            <Input
              dir="ltr"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              aria-label="أجرة المصنعية للجرام"
            />
          </FilterField>
        </LinesEditor>
      </div>

      {/* بيانات إضافية */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">بيانات السند</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterField label="اسم الزبون / الورشة (اختياري)">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </FilterField>
          <FilterField label="مبلغ نقدي مدفوع مقدماً (اختياري)">
            <Input dir="ltr" inputMode="decimal" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} placeholder="0.00" />
          </FilterField>
          <FilterField label="ملاحظات (اختياري)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FilterField>
        </CardContent>
      </Card>

      {/* نتيجة التصفية */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">نتيجة التصفية (الربط)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={`صافي المستلم (${unit})`} value={`${formatMg(totals.receivedEquivMg)} جم`} hint={`قائم: ${formatMg(totals.receivedGrossMg)} جم`} icon={Scale} />
            <StatCard label={`صافي المسلَّم (${unit})`} value={`${formatMg(totals.deliveredEquivMg)} جم`} hint={`قائم: ${formatMg(totals.deliveredGrossMg)} جم`} icon={Gem} />
            <StatCard label="إجمالي المصنعية" value={formatCents(totals.workmanshipCents)} hint={`مدفوع مقدماً: ${formatCents(totals.cashPaidCents)}`} icon={Coins} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BalanceBox heading={`فرق ${unit}`} label={metalBalanceLabel(totals.diffEquivMg, unit)} />
            <BalanceBox heading="فرق النقدية / المصنعية" label={cashBalanceLabel(totals.cashDueCents)} />
          </div>

          {evaluation.errors.length > 0 ? (
            <ul className="list-disc space-y-1 ps-5 text-sm text-red-600 dark:text-red-400">
              {evaluation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => resetForm()}>
              مسح الحقول
            </Button>
            <Button type="button" disabled={saving || evaluation.errors.length > 0 || !evaluation.hasData} onClick={() => void handleIssue()}>
              {saving ? "جارٍ الإصدار..." : "إصدار سند ربط / تسوية"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReceiptDialog receipt={issued} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
