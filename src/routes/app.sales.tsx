import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { getMerchantSales } from "@/lib/sales.functions";
import { readToken, useRequireRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/app/sales")({
  head: () => pageHead("سجل المبيعات", "سجل المبيعات للتاجر والموظفين"),
  component: SalesHistoryPage,
});

export default function SalesHistoryPage() {
  useRequireRole("merchant");
  const token = readToken();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-sales", page],
    queryFn: () => getMerchantSales({ data: { token, page, limit } }),
    enabled: !!token,
  });

  const sales = data?.ok ? data.sales : [];
  const totalPages = data?.ok ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 pb-16 pt-5">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">سجل المبيعات</h1>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 rounded-full p-0"
          onClick={() => window.history.back()}
          aria-label="رجوع"
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ShoppingBag className="mx-auto mb-3 size-9 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">لا توجد مبيعات مسجلة حتى الآن</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((row) => (
            <article key={row.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-primary">
                  {row.saleType === "sell" ? "بيع" : "شراء"}
                </span>
                <span className="num text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>

              <div className="space-y-2 text-sm text-foreground">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المعدن</span>
                  <span className="font-semibold">{row.metalType === "gold" ? "ذهب" : "فضة"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">العيار</span>
                  <span className="font-semibold">{row.karat}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الكمية</span>
                  <span className="num font-semibold">{row.quantity} جرام</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">سعر الجرام</span>
                  <span className="num font-semibold">{row.unitPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">إجمالي المبيعة</span>
                  <span className="num font-bold text-primary">{row.totalPrice}</span>
                </div>
                {row.employeeUsername ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">الموظف</span>
                    <span className="font-semibold">{row.employeeUsername}</span>
                  </div>
                ) : null}
                {row.note ? (
                  <div className="rounded-xl bg-background p-2 text-xs text-muted-foreground">
                    {row.note}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {sales.length > 0 ? (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            الصفحة {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            التالي
          </Button>
        </div>
      ) : null}
    </main>
  );
}
