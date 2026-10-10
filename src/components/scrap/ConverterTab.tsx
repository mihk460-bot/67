import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SharesPicker } from "@/components/scrap/ScrapParts";
import { METAL_LABEL } from "@/lib/scrap/format";
import type { Metal } from "@/lib/scrap/config";
import { equivalentMg, evaluateLine, formatMg } from "@/lib/scrap/calc";
import { defaultSharesFor, defaultTargetFor, presetsFor, targetLabel } from "@/lib/scrap/config";

/** تحويل الوزن القائم إلى صافي بالأسهم (ذهب / فضة) */
export function ConverterTab() {
  const [metal, setMetal] = useState<Metal>("gold");

  return (
    <Tabs value={metal} onValueChange={(value: string) => setMetal(value === "silver" ? "silver" : "gold")} dir="rtl" className="space-y-4">
      <TabsList>
        <TabsTrigger value="gold">{METAL_LABEL.gold}</TabsTrigger>
        <TabsTrigger value="silver">{METAL_LABEL.silver}</TabsTrigger>
      </TabsList>
      <TabsContent value="gold">
        <ConverterPanel metal="gold" />
      </TabsContent>
      <TabsContent value="silver">
        <ConverterPanel metal="silver" />
      </TabsContent>
    </Tabs>
  );
}

function ConverterPanel({ metal }: { metal: Metal }) {
  const [gross, setGross] = useState("");
  const [shares, setShares] = useState(defaultSharesFor(metal));

  const base = defaultTargetFor(metal);
  const state = useMemo(() => evaluateLine({ gross, shares }, base), [gross, shares, base]);
  const presets = presetsFor(metal);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {metal === "gold" ? "تحويل الذهب القائم إلى صافي" : "تحويل الفضة القائمة إلى صافي"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">الوزن القائم (جم)</span>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              placeholder="0.000"
              aria-label="الوزن القائم"
            />
          </label>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">العيار / الأسهم</span>
            <SharesPicker metal={metal} value={shares} onChange={setShares} />
          </div>

          <div className="rounded-lg bg-muted p-4" aria-live="polite">
            <p className="text-sm text-muted-foreground">الوزن الصافي — {targetLabel(metal, base)}</p>
            {state.kind === "ok" ? (
              <p className="mt-1 text-3xl font-bold tabular-nums" dir="ltr">
                {formatMg(state.line.equivMg)} <span className="text-base font-medium">جم</span>
              </p>
            ) : state.kind === "invalid" ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{state.error}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">أدخل الوزن القائم لعرض الصافي</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            الصافي = الوزن القائم × الأسهم ÷ {base}. التقريب لأقرب ملّيجرام.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">المكافئ بكل عيار</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العيار / الأسهم</TableHead>
                <TableHead>الوزن المكافئ (جم)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.map((preset) => (
                <TableRow key={preset.shares}>
                  <TableCell>{preset.label}</TableCell>
                  <TableCell className="tabular-nums" dir="ltr">
                    {state.kind === "ok"
                      ? formatMg(equivalentMg(state.line.grossMg, state.line.shares, preset.shares))
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="pt-3 text-xs text-muted-foreground">
            الوزن الذي يعادل نفس كمية المعدن الصافي لو صيغت بكل عيار.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
