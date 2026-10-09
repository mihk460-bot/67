import { describe, expect, it } from "vitest";
import { calculateSalesSummary, getReportWindow } from "@/lib/sales-report";

describe("getReportWindow", () => {
  const now = new Date(2026, 9, 9, 14, 30, 45);

  it("uses local midnight for daily and the trailing seven calendar days for weekly", () => {
    const daily = getReportWindow("daily", now);
    const weekly = getReportWindow("weekly", now);
    expect(new Date(daily.from)).toEqual(new Date(2026, 9, 9));
    expect(new Date(daily.to)).toEqual(new Date(2026, 9, 10));
    expect(new Date(weekly.from)).toEqual(new Date(2026, 9, 3));
    expect(new Date(weekly.to)).toEqual(new Date(2026, 9, 10));
  });

  it("uses the current calendar month, quarter, half-year, and year", () => {
    expect(new Date(getReportWindow("monthly", now).from)).toEqual(new Date(2026, 9, 1));
    expect(new Date(getReportWindow("quarterly", now).from)).toEqual(new Date(2026, 9, 1));
    expect(new Date(getReportWindow("semiannual", now).from)).toEqual(new Date(2026, 6, 1));
    expect(new Date(getReportWindow("yearly", now).from)).toEqual(new Date(2026, 0, 1));
  });
});

describe("calculateSalesSummary", () => {
  it("sums sales and margins, groups sold weights by metal and karat, and counts all invoices", () => {
    const summary = calculateSalesSummary([
      { metal: "gold", karat: "21", side: "sell", weight: 2, total: 2200, invoice: { profitAmount: 200, profitPercent: 10 } },
      { metal: "silver", karat: "925", side: "sell", weight: 3, total: 600, invoice: { profitAmount: 60, profitPercent: 12 } },
      { metal: "gold", karat: "24", side: "buy", weight: 5, total: 5000, invoice: { profitAmount: 900, profitPercent: 90 } },
    ]);

    expect(summary).toEqual({
      invoiceCount: 3,
      revenue: 2800,
      netProfit: 260,
      averageProfitMarginPercent: 11,
      goldWeight: 2,
      silverWeight: 3,
      goldWeightByKarat: { "21": 2 },
      silverWeightByKarat: { "925": 3 },
    });
  });
});
