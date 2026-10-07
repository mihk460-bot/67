import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { getPublicPrices } from "@/lib/app.functions";
import { logout, useRequireRole } from "@/lib/auth-client";
import { PriceEditor } from "@/components/PriceEditor";

export const Route = createFileRoute("/prices")({
  head: () => pageHead("مدير الأسعار", "تحديث سعر بيع وشراء الذهب والفضة لكل عيار"),
  component: PriceManagerPage,
});

function PriceManagerPage() {
  useRequireRole("price_manager");

  const { data: prices, isLoading } = useQuery({
    queryKey: ["public-prices"],
    queryFn: () => getPublicPrices(),
    refetchInterval: 60_000,
  });

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

        <PriceEditor initial={prices?.prices} />
      </main>
    </div>
  );
}

