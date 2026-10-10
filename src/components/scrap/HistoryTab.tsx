import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, FilterField, MetalBadge, Pager, Timestamp, usePagination } from "@/components/scrap/ScrapParts";
import { ReceiptDialog } from "@/components/scrap/ReceiptDialog";
import { useRequireRole } from "@/lib/auth-client";
import { orDash } from "@/lib/scrap/format";
import { cashBalanceLabel, formatMg, metalBalanceLabel } from "@/lib/scrap/calc";
import { targetLabel } from "@/lib/scrap/config";
import { useScrapReceipts } from "@/lib/scrap/queries";
import type { SettlementReceipt } from "@/lib/scrap/receipts";

/** سجل السندات الصادرة من قاعدة بيانات المحل. */
export function HistoryTab() {
  const auth = useRequireRole("merchant");
  const { data: receipts = [], isLoading, error } = useScrapReceipts(auth?.merchantId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SettlementReceipt | null>(null);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return receipts;
    return receipts.filter((receipt) =>
      (receipt.serial + " " + (receipt.customerName ?? "")).toLocaleLowerCase().includes(q),
    );
  }, [receipts, query]);
  const pager = usePagination(rows, 20);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">سجل سندات التسوية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <FilterField label="بحث برقم السند أو اسم الزبون">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ST-... / الزبون" />
          </FilterField>
        </div>

        {error ? <p role="alert" className="text-sm text-destructive">{error.message}</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم السند</TableHead>
              <TableHead>التاريخ والوقت</TableHead>
              <TableHead>الزبون</TableHead>
              <TableHead>المعدن</TableHead>
              <TableHead>فرق الصافي</TableHead>
              <TableHead>فرق النقدية</TableHead>
              <TableHead className="text-end">عرض</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.slice.length === 0 ? (
              <EmptyRow colSpan={7} loading={isLoading} text="لا توجد سندات بعد" />
            ) : (
              pager.slice.map((receipt) => {
                const unit = targetLabel(receipt.metal, receipt.targetShares);
                const metal = metalBalanceLabel(receipt.diffEquivMg, unit);
                const cash = cashBalanceLabel(receipt.workmanshipCents - receipt.cashPaidCents, receipt.currency);
                return (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium tabular-nums" dir="ltr">{receipt.serial}</TableCell>
                    <TableCell><Timestamp value={receipt.createdAt} timeZone={receipt.timeZone} /></TableCell>
                    <TableCell>{orDash(receipt.customerName)}</TableCell>
                    <TableCell><MetalBadge metal={receipt.metal} /></TableCell>
                    <TableCell className="text-sm">
                      <div>{metal.title}</div>
                      <div className="tabular-nums text-muted-foreground" dir="ltr">
                        {receipt.diffEquivMg === 0 ? formatMg(0) : metal.amount}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{cash.title}</div>
                      <div className="tabular-nums text-muted-foreground" dir="ltr">{cash.amount}</div>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button type="button" variant="ghost" size="icon" aria-label="عرض السند" onClick={() => { setSelected(receipt); setOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <Pager page={pager.page} pageCount={pager.pageCount} total={pager.total} onChange={pager.setPage} />
      </CardContent>
      <ReceiptDialog receipt={selected} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
