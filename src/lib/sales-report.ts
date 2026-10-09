export type ReportRange = "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "yearly";

export type ReportWindow = {
  from: string;
  to: string;
  label: string;
};

export type SalesReportRow = {
  metal: string;
  karat: string;
  side: string;
  weight: number;
  total: number;
  invoice: Record<string, unknown>;
};

export type SalesReportSummary = {
  invoiceCount: number;
  revenue: number;
  netProfit: number;
  averageProfitMarginPercent: number;
  goldWeight: number;
  silverWeight: number;
  goldWeightByKarat: Record<string, number>;
  silverWeightByKarat: Record<string, number>;
};

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function getReportWindow(range: ReportRange, now = new Date()): ReportWindow {
  const year = now.getFullYear();
  const month = now.getMonth();
  let start: Date;
  let end: Date;
  let label: string;

  switch (range) {
    case "daily":
      start = new Date(year, month, now.getDate());
      end = addDays(start, 1);
      label = "اليوم";
      break;
    case "weekly":
      start = addDays(now, -6);
      end = addDays(now, 1);
      label = "آخر 7 أيام";
      break;
    case "monthly":
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 1);
      label = "الشهر الحالي";
      break;
    case "quarterly": {
      const firstMonth = Math.floor(month / 3) * 3;
      start = new Date(year, firstMonth, 1);
      end = new Date(year, firstMonth + 3, 1);
      label = `الربع ${Math.floor(month / 3) + 1} • ${year}`;
      break;
    }
    case "semiannual": {
      const firstMonth = Math.floor(month / 6) * 6;
      start = new Date(year, firstMonth, 1);
      end = new Date(year, firstMonth + 6, 1);
      label = `${firstMonth === 0 ? "النصف الأول" : "النصف الثاني"} • ${year}`;
      break;
    }
    case "yearly":
      start = new Date(year, 0, 1);
      end = new Date(year + 1, 0, 1);
      label = `السنة الحالية • ${year}`;
      break;
  }

  return { from: start.toISOString(), to: end.toISOString(), label };
}

function numeric(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function calculateSalesSummary(rows: SalesReportRow[]): SalesReportSummary {
  const sold = rows.filter((row) => row.side === "sell");
  const goldWeightByKarat: Record<string, number> = {};
  const silverWeightByKarat: Record<string, number> = {};
  const margins: number[] = [];
  let revenue = 0;
  let netProfit = 0;
  let goldWeight = 0;
  let silverWeight = 0;

  for (const row of sold) {
    const weight = numeric(row.weight);
    revenue += numeric(row.total);
    netProfit += numeric(row.invoice["profitAmount"]);

    const margin = Number(row.invoice["profitPercent"]);
    if (Number.isFinite(margin)) margins.push(margin);

    if (row.metal === "gold") {
      goldWeight += weight;
      goldWeightByKarat[row.karat] = (goldWeightByKarat[row.karat] ?? 0) + weight;
    } else if (row.metal === "silver") {
      silverWeight += weight;
      silverWeightByKarat[row.karat] = (silverWeightByKarat[row.karat] ?? 0) + weight;
    }
  }

  return {
    invoiceCount: rows.length,
    revenue,
    netProfit,
    averageProfitMarginPercent: margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : 0,
    goldWeight,
    silverWeight,
    goldWeightByKarat,
    silverWeightByKarat,
  };
}
