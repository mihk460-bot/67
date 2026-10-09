import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { getSalesLog, getSalesReport, type SaleRow } from "@/lib/logs.functions";
import { readToken, useRequireRole } from "@/lib/auth-client";
import { formatDateTime, zoneLabel } from "@/lib/datetime";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import type { InvoiceData } from "@/lib/invoice";
import { getReportWindow, type ReportRange } from "@/lib/sales-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/sales-log")({
  head: () => pageHead("سجل المبيعات والعمليات", "جميع فواتير الذهب والفضة الصادرة من المحل مع الفلترة والإحصائيات"),
  component: SalesLogPage,
});

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function SalesLogPage() {
  const state = useRequireRole("merchant");
  const [range, setRange] = useState<ReportRange>("daily");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const reportWindow = getReportWindow(range, now);
  const { data, isLoading } = useQuery({
    queryKey: ["sales-log"],
    queryFn: () => getSalesLog({ data: { token: readToken() } }),
    enabled: !!state?.token,
  });
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ["sales-report", range, reportWindow.from, reportWindow.to],
    queryFn: () => getSalesReport({ data: { token: readToken(), from: reportWindow.from, to: reportWindow.to } }),
    enabled: !!state?.token,
    refetchInterval: 60_000,
  });
  const report = reportData?.ok ? reportData.summary : undefined;
  const sales = useMemo(() => data?.ok ? data.sales : [], [data]);
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

  const stats = [
    {
      label: "إجمالي المبيعات المالية",
      value: report ? fmt(report.revenue) : reportLoading ? "…" : "—",
    },
    {
      label: "إجمالي صافي الأرباح",
      value: report ? fmt(report.netProfit) : reportLoading ? "…" : "—",
    },
    {
      label: "متوسط نسبة الربح",
      value: report ? `${fmt(report.averageProfitMarginPercent)}%` : reportLoading ? "…" : "—",
    },
    {
      label: "وزن الذهب المباع",
      value: report ? `${fmt(report.goldWeight)} جم` : reportLoading ? "…" : "—",
      detail: report ? ["24", "22", "21", "18"].filter((karat) => (report.goldWeightByKarat[karat] ?? 0) > 0).map((karat) => `${karat}: ${fmt(report.goldWeightByKarat[karat] ?? 0)} جم`).join(" • ") : "",
    },
    {
      label: "وزن الفضة المباعة",
      value: report ? `${fmt(report.silverWeight)} جم` : reportLoading ? "…" : "—",
      detail: report ? ["999", "925", "900", "800"].filter((karat) => (report.silverWeightByKarat[karat] ?? 0) > 0).map((karat) => `${karat}: ${fmt(report.silverWeightByKarat[karat] ?? 0)} جم`).join(" • ") : "",
    },
    {
      label: "عدد الفواتير الصادرة",
      value: report ? fmt(report.invoiceCount) : reportLoading ? "…" : "—",
    },
  ];

  const openInvoice = (s: SaleRow) => setOpen({ ...(s.invoice as unknown as InvoiceData), invoiceNumber: s.invoiceNumber, issuedAt: s.createdAt, issuedBy: s.employeeName });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">سجل المبيعات والعمليات</h1>
        <p className="text-xs text-muted-foreground" dir="ltr">{zoneLabel()}</p>
      </div>
      <section className="space-y-3" aria-label="تصفية التقرير المالي">
        <Tabs value={range} onValueChange={(value) => setRange(value as ReportRange)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-6">
            <TabsTrigger className="py-2" value="daily">يومي</TabsTrigger>
            <TabsTrigger className="py-2" value="weekly">أسبوعي</TabsTrigger>
            <TabsTrigger className="py-2" value="monthly">شهري</TabsTrigger>
            <TabsTrigger className="py-2" value="quarterly">ربع سنوي</TabsTrigger>
            <TabsTrigger className="py-2" value="semiannual">نصف سنوي</TabsTrigger>
            <TabsTrigger className="py-2" value="yearly">سنوي</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">{reportWindow.label} — الأرقام المالية تخص فواتير البيع ضمن الفترة</p>
        {reportData && !reportData.ok ? <p className="text-sm text-destructive">{reportData.message}</p> : null}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map(({ label, value, detail }) => (
            <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="num mt-1 text-lg font-bold text-primary">{value}</p>
              {detail ? <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{detail}</p> : null}
            </div>
          ))}
        </div>
      </section>

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
