import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { getSalesLog, type SaleRow } from "@/lib/logs.functions";
import { readToken, useRequireRole } from "@/lib/auth-client";
import { formatDateTime, localDay, zoneLabel } from "@/lib/datetime";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import type { InvoiceData } from "@/lib/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/sales-log")({
  head: () => pageHead("سجل المبيعات والعمليات", "جميع فواتير الذهب والفضة الصادرة من المحل مع الفلترة والإحصائيات"),
  component: SalesLogPage,
});

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function SalesLogPage() {
  const state = useRequireRole("merchant");
  const { data, isLoading } = useQuery({
    queryKey: ["sales-log"],
    queryFn: () => getSalesLog({ data: { token: readToken() } }),
    enabled: !!state?.token,
  });
  const sales = data?.ok ? data.sales : [];
  const [q, setQ] = useState("");
  const [metal, setMetal] = useState<"all" | "gold" | "silver">("all");
  const [employee, setEmployee] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<InvoiceData | null>(null);

  const employees = useMemo(() => [...new Set(sales.map((s) => s.employeeName))], [sales]);
  const filtered = useMemo(() => sales.filter((s) => {
    if (q.trim() && !s.invoiceNumber.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (metal !== "all" && s.metal !== metal) return false;
    if (employee !== "all" && s.employeeName !== employee) return false;
    const t = new Date(s.createdAt).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 59_999) return false;
    return true;
  }), [sales, q, metal, employee, from, to]);

  const today = localDay(new Date());
  const todays = sales.filter((s) => localDay(s.createdAt) === today);
  const stats = [
    ["مبيعات اليوم", fmt(todays.filter((s) => s.side === "sell").reduce((a, s) => a + s.total, 0))],
    ["الفواتير الصادرة", `${fmt(sales.length)} (اليوم ${todays.length})`],
    ["وزن الذهب المباع", `${fmt(sales.filter((s) => s.metal === "gold" && s.side === "sell").reduce((a, s) => a + s.weight, 0))} جم`],
    ["وزن الفضة المباع", `${fmt(sales.filter((s) => s.metal === "silver" && s.side === "sell").reduce((a, s) => a + s.weight, 0))} جم`],
  ];

  const openInvoice = (s: SaleRow) => setOpen({ ...(s.invoice as unknown as InvoiceData), invoiceNumber: s.invoiceNumber, issuedAt: s.createdAt, issuedBy: s.employeeName });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">سجل المبيعات والعمليات</h1>
        <p className="text-xs text-muted-foreground" dir="ltr">{zoneLabel()}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="num mt-1 text-lg font-bold text-primary">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم الفاتورة" className="bg-background ps-9" aria-label="بحث برقم الفاتورة" />
        </div>
        <select value={metal} onChange={(e) => setMetal(e.target.value as typeof metal)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" aria-label="نوع المعدن">
          <option value="all">كل المعادن</option><option value="gold">ذهب</option><option value="silver">فضة</option>
        </select>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground md:col-span-2" aria-label="الموظف">
          <option value="all">كل الموظفين</option>
          {employees.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <div className="space-y-1 md:col-span-2"><Label className="text-xs text-muted-foreground">من تاريخ ووقت</Label><Input type="datetime-local" step={1} value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background" dir="ltr" /></div>
        <div className="space-y-1 md:col-span-2"><Label className="text-xs text-muted-foreground">إلى تاريخ ووقت</Label><Input type="datetime-local" step={1} value={to} onChange={(e) => setTo(e.target.value)} className="bg-background" dir="ltr" /></div>
        <Button variant="secondary" className="self-end" onClick={() => { setQ(""); setMetal("all"); setEmployee("all"); setFrom(""); setTo(""); }}>مسح الفلاتر</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div> : data && !data.ok ? (
        <p className="text-center text-destructive">{data.message}</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">لا توجد فواتير مطابقة. الفواتير تُسجَّل عند الضغط على «إصدار الفاتورة» في الحاسبة.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>{["رقم الفاتورة", "الموظف", "المعدن", "العيار", "الوزن", "الإجمالي", "التاريخ والوقت", ""].map((h) => <th key={h} className="p-3 text-start font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border bg-card">
                  <td className="num p-3 font-semibold text-foreground" dir="ltr">{s.invoiceNumber}</td>
                  <td className="p-3 text-foreground">{s.employeeName}</td>
                  <td className="p-3"><span className={s.metal === "gold" ? "text-primary" : "text-muted-foreground"}>{s.metal === "gold" ? "ذهب" : "فضة"}</span> <span className="text-xs text-muted-foreground">({s.side === "sell" ? "بيع" : "شراء"})</span></td>
                  <td className="num p-3">{s.karat}</td>
                  <td className="num p-3">{fmt(s.weight)} جم</td>
                  <td className="num p-3 font-bold text-primary">{fmt(s.total)}</td>
                  <td className="num p-3 text-xs" dir="ltr">{formatDateTime(s.createdAt)}</td>
                  <td className="p-3"><Button size="sm" variant="secondary" onClick={() => openInvoice(s)}><Eye className="size-4" />عرض / طباعة / PDF</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InvoiceDialog data={open} onClose={() => setOpen(null)} />
    </main>
  );
}
