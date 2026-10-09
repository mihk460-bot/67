import { describe, expect, it } from "vitest";
import { buildCustomerInvoiceText, customerInvoiceRows, type InvoiceData } from "@/lib/invoice";
import { whatsappMessageHref } from "@/lib/support";

const invoice: InvoiceData = {
  storeName: "مجوهرات النور",
  metal: "gold",
  karat: "21",
  side: "sell",
  weight: 4.5,
  price: 5000,
  craftsmanship: 0,
  wastage: 1,
  wastageUnit: "grams",
  profitPercent: 73,
  baseCost: 22500,
  craftCost: 250,
  wastageCost: 5000,
  fees: 125,
  profitAmount: 987654,
  finalTotal: 32879,
  issuedAt: "2026-10-09T12:34:56.000Z",
  issuedBy: "موظف 1",
};

describe("customer invoice output", () => {
  it("whitelists customer-facing details and never prints internal profit fields", () => {
    const rows = customerInvoiceRows(invoice);
    const text = buildCustomerInvoiceText(invoice);

    expect(rows.map((row) => row.label)).toEqual([
      "تفاصيل القطعة",
      "الوزن القائم",
      "العيار",
      "سعر الجرام",
      "إجمالي المصنعية",
      "الهالك / الكسر",
    ]);
    expect(text).toContain("المحل: مجوهرات النور");
    expect(text).toContain("الموظف: موظف 1");
    expect(text).toContain("الإجمالي النهائي المطلوب: 32,879");
    expect(text).not.toMatch(/نسبة الربح|هامش الربح|قيمة الربح|الرسوم الإضافية|المعدن الخام/);
    expect(text).not.toContain("73");
    expect(text).not.toContain("987,654");
    expect(text).not.toContain("22,500");
    expect(text).not.toContain("125");
  });
});

describe("whatsappMessageHref", () => {
  it("creates a WhatsApp link with the prepared Arabic text", () => {
    const message = "أرغب في تجديد اشتراك محلي (مجوهرات النور)";
    const href = whatsappMessageHref([{ type: "phone", value: "+20 100 000 0000" }], null, message);

    expect(href).not.toBeNull();
    const url = new URL(href as string);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/201000000000");
    expect(url.searchParams.get("text")).toBe(message);
  });

  it("does not invent a WhatsApp destination for an unrelated support link", () => {
    expect(whatsappMessageHref([{ type: "link", value: "https://example.com/help" }], null, "hello")).toBeNull();
  });
});
