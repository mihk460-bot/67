import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequireRole } from "@/lib/auth-client";
import { pageHead } from "@/lib/page-head";
import { zoneLabel } from "@/lib/datetime";
import { ConverterTab } from "@/components/scrap/ConverterTab";
import { HistoryTab } from "@/components/scrap/HistoryTab";
import { SettlementTab } from "@/components/scrap/SettlementTab";

export const Route = createFileRoute("/app/scrap-calculator")({
  head: () => pageHead("حاسبة الكسر والربط", "تحويل عيارات الذهب والفضة وإصدار سندات التسوية للمحل"),
  component: ScrapCalculatorPage,
});

function ScrapCalculatorPage() {
  useRequireRole("merchant");

  return (
    <main dir="rtl" className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 pt-6 md:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">حاسبة الكسر والربط</h1>
        <p className="text-sm text-muted-foreground">
          الحساب بالأسهم للذهب والفضة — التوقيت: <span dir="ltr" className="inline-block">{zoneLabel()}</span>
        </p>
      </header>
      <Tabs defaultValue="converter" dir="rtl" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="converter">التحويل إلى صافي</TabsTrigger>
          <TabsTrigger value="settlement">المقاصة والربط</TabsTrigger>
          <TabsTrigger value="history">سجل السندات</TabsTrigger>
        </TabsList>
        <TabsContent value="converter"><ConverterTab /></TabsContent>
        <TabsContent value="settlement"><SettlementTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </main>
  );
}
