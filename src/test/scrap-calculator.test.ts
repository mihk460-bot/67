import { describe, expect, it } from "vitest";
import { computeSettlement, evaluateLine, formatMg, parseDecimal } from "@/lib/scrap/calc";
import { buildReceiptHtml, buildReceiptText } from "@/lib/scrap/receipt-html";

describe("scrap calculator", () => {
  it("parses Arabic digits and decimal separators", () => {
    expect(parseDecimal("١٢٫٥٠٠")).toBe(12.5);
    expect(parseDecimal("۱۲٬۳۴۵٫٦٧")).toBe(12345.67);
  });

  it("converts gross weight to fineness using integer milligrams", () => {
    const result = evaluateLine({ gross: "10", shares: "875" }, 1000);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(formatMg(result.line.equivMg)).toBe("8.750");
  });

  it("calculates metal and cash settlement balances", () => {
    const result = computeSettlement({
      received: [{ gross: "10", shares: "875" }],
      delivered: [{ gross: "9", shares: "1000" }],
      target: 1000,
      ratePerGram: "10",
      cashPaid: "50",
    });
    expect(result.errors).toEqual([]);
    expect(result.totals.diffEquivMg).toBe(250);
    expect(result.totals.workmanshipCents).toBe(9000);
    expect(result.totals.cashDueCents).toBe(4000);
  });

  it("rejects fractional shares and out-of-range money", () => {
    expect(evaluateLine({ gross: "1", shares: "875.5" }, 1000).kind).toBe("invalid");
    const result = computeSettlement({
      received: [],
      delivered: [{ gross: "1", shares: "875" }],
      target: 1000,
      ratePerGram: "0",
      cashPaid: "10000001",
    });
    expect(result.errors).toContain("المبلغ المدفوع غير صالح أو أكبر من الحد المسموح");
  });

  it("labels an offline settlement receipt as provisional", () => {
    const evaluation = computeSettlement({ received: [{ gross: "10", shares: "875" }], delivered: [{ gross: "9", shares: "1000" }], target: 1000, ratePerGram: "10", cashPaid: "50" });
    const receipt = {
      ...evaluation.totals, id: "local-123", serial: "PEND-12345678", shopId: "1", shopName: "المحل", employeeName: "موظف",
      customerName: null, notes: null, metal: "gold" as const, targetShares: 1000, currency: "EGP", createdAt: "2026-10-16T10:00:00.000Z",
      timeZone: "Africa/Cairo", received: evaluation.received, delivered: evaluation.delivered, syncStatus: "pending" as const,
    };
    expect(buildReceiptText(receipt)).toContain("مؤقت");
    expect(buildReceiptText(receipt)).toContain("PEND-12345678");
    expect(buildReceiptHtml(receipt, { layout: "a4" })).toContain("pending-notice");
  });
});
