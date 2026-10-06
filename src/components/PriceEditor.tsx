import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updatePrices } from "@/lib/app.functions";
import { readToken } from "@/lib/auth-client";
import {
  ALL_PRICE_KEYS,
  GOLD_KARATS,
  SILVER_KARATS,
  priceKey,
  resolvePrice,
  type Metal,
  type PriceMap,
} from "@/lib/prices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PriceEditor({ initial }: { initial: PriceMap | undefined }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const loaded = !!initial;

  useEffect(() => {
    if (!initial) return;
    const v: Record<string, string> = {};
    for (const k of ALL_PRICE_KEYS) {
      const n = Number(initial[k]) || 0;
      v[k] = n ? String(n) : "";
    }
    setValues(v);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const numeric: PriceMap = Object.fromEntries(
    ALL_PRICE_KEYS.map((k) => [k, parseFloat(values[k] ?? "") || 0]),
  );

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePrices({ data: { token: readToken(), prices: numeric } });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["public-prices"] });
        await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
        toast.success("تم حفظ الأسعار بنجاح");
      } else toast.error(res.message);
    } catch {
      toast.error("تعذر الحفظ، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  const section = (metal: Metal, karats: readonly string[], title: string) => (
    <div className="space-y-3">
      <h2 className="pt-2 text-lg font-bold text-foreground">{title}</h2>
      <div className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2 text-xs text-muted-foreground">
        <span>العيار</span>
        <span className="text-center">سعر البيع</span>
        <span className="text-center">سعر الشراء</span>
      </div>
      {karats.map((k) => (
        <div key={k} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">عيار {k}</span>
          {(["sell", "buy"] as const).map((side) => {
            const key = priceKey(metal, k, side);
            const r = resolvePrice(numeric, metal, k, side);
            return (
              <Input
                key={key}
                value={values[key] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value }))}
                inputMode="decimal"
                placeholder={r.derived ? String(r.value) : "0"}
                className="h-12 bg-card text-center font-semibold"
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-card p-3 text-xs leading-relaxed text-muted-foreground">
        يكفي إدخال سعر عيار 24 للذهب وعيار 999 للفضة، وباقي العيارات تُحسب تلقائيًا. اترك أي خانة فارغة
        لتُحسب من أعلى عيار، أو اكتب سعرها لتثبيته.
      </p>
      {section("gold", GOLD_KARATS, "أسعار الذهب")}
      {section("silver", SILVER_KARATS, "أسعار الفضة")}
      <Button className="mt-2 h-14 w-full text-base font-bold" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : "حفظ الأسعار"}
      </Button>
    </div>
  );
}
