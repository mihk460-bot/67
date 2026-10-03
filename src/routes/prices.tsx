import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { getPublicPrices, updatePrices } from "@/lib/app.functions";
import { logout, readToken, useRequireRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/prices")({
  component: PriceManagerPage,
});

type PriceState = {
  gold24Price: string;
  gold22Price: string;
  gold21Price: string;
  gold18Price: string;
  silver999Price: string;
  silver925Price: string;
  silver900Price: string;
  silver800Price: string;
};

const GOLD_FIELDS: [keyof PriceState, string][] = [
  ["gold24Price", "ذهب عيار 24"],
  ["gold22Price", "ذهب عيار 22"],
  ["gold21Price", "ذهب عيار 21"],
  ["gold18Price", "ذهب عيار 18"],
];

const SILVER_FIELDS: [keyof PriceState, string][] = [
  ["silver999Price", "فضة عيار 999"],
  ["silver925Price", "فضة عيار 925"],
  ["silver900Price", "فضة عيار 900"],
  ["silver800Price", "فضة عيار 800"],
];

function PriceManagerPage() {
  useRequireRole("price_manager");
  const queryClient = useQueryClient();

  const { data: prices, isLoading } = useQuery({
    queryKey: ["public-prices"],
    queryFn: () => getPublicPrices(),
    refetchInterval: 60_000,
  });

  const [values, setValues] = useState<PriceState>({
    gold24Price: "",
    gold22Price: "",
    gold21Price: "",
    gold18Price: "",
    silver999Price: "",
    silver925Price: "",
    silver900Price: "",
    silver800Price: "",
  });
  const [saving, setSaving] = useState(false);

  const loaded = !!prices;
  useEffect(() => {
    if (prices) {
      setValues({
        gold24Price: String(prices.prices.gold24Price),
        gold22Price: String(prices.prices.gold22Price),
        gold21Price: String(prices.prices.gold21Price),
        gold18Price: String(prices.prices.gold18Price),
        silver999Price: String(prices.prices.silver999Price),
        silver925Price: String(prices.prices.silver925Price),
        silver900Price: String(prices.prices.silver900Price),
        silver800Price: String(prices.prices.silver800Price),
      });
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updatePrices({
        data: {
          token: readToken(),
          prices: {
            gold24Price: parseFloat(values.gold24Price) || 0,
            gold22Price: parseFloat(values.gold22Price) || 0,
            gold21Price: parseFloat(values.gold21Price) || 0,
            gold18Price: parseFloat(values.gold18Price) || 0,
            silver999Price: parseFloat(values.silver999Price) || 0,
            silver925Price: parseFloat(values.silver925Price) || 0,
            silver900Price: parseFloat(values.silver900Price) || 0,
            silver800Price: parseFloat(values.silver800Price) || 0,
          },
        },
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["public-prices"] });
        toast.success("تم تحديث أسعار الذهب والفضة بنجاح");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("تعذر الحفظ، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-4">
          <div>
            <h1 className="text-lg font-bold text-primary">تعديل الأسعار</h1>
            <p className="text-xs text-muted-foreground">صلاحية الأسعار فقط</p>
          </div>
          <button
            type="button"
            className="p-2 text-foreground"
            aria-label="تسجيل الخروج"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 px-4 pb-24 pt-6">
        <p className="text-sm text-muted-foreground">
          يمكنك تعديل أسعار المعادن فقط. لا تظهر لك إدارة التجار أو الاشتراكات أو الإشعارات.
        </p>

        <h2 className="pt-2 text-lg font-bold text-foreground">أسعار الذهب</h2>
        {GOLD_FIELDS.map(([key, label]) => (
          <PriceInput key={key} label={label} value={values[key]} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} />
        ))}

        <h2 className="pt-4 text-lg font-bold text-foreground">أسعار الفضة</h2>
        {SILVER_FIELDS.map(([key, label]) => (
          <PriceInput key={key} label={label} value={values[key]} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} />
        ))}

        <Button className="mt-4 h-14 w-full text-base font-bold" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : "حفظ الأسعار"}
        </Button>
      </main>
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Label className="w-28 shrink-0 text-start text-sm font-semibold text-muted-foreground">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-12 bg-card font-semibold"
      />
    </div>
  );
}
