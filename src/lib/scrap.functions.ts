import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyToken } from "./auth.server";
import { computeSettlement } from "./scrap/calc";
import { DEFAULT_CURRENCY, MAX_RECEIPTS, type Metal } from "./scrap/config";
import type { SettlementReceipt } from "./scrap/receipts";
import type { Json } from "@/integrations/supabase/types";

const lineSchema = z.object({ gross: z.string().max(40), shares: z.string().max(40) });
const tokenSchema = z.string().min(1).max(8192);

type MerchantContext = {
  merchantId: number;
  shopId: number;
  username: string;
  shopName: string;
};

type MerchantRow = {
  id: number;
  username: string;
  session_version: number;
  parent_merchant_id: number | null;
  is_active: boolean;
  expires_at: string;
};

async function getMerchantContext(token: string): Promise<MerchantContext | null> {
  const payload = verifyToken(token);
  const merchantId = Number(payload?.sub);
  if (!payload || payload.role !== "merchant" || !Number.isSafeInteger(merchantId) || merchantId <= 0) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("merchants")
    .select("id, username, session_version, parent_merchant_id, is_active, expires_at")
    .eq("id", merchantId)
    .maybeSingle();
  if (!data || data.session_version !== payload.sv) return null;
  const merchant = data as MerchantRow;
  if (!merchant.is_active || new Date(merchant.expires_at).getTime() <= Date.now()) return null;

  const shopId = merchant.parent_merchant_id ?? merchant.id;
  if (merchant.parent_merchant_id !== null) {
    const { data: owner } = await supabaseAdmin
      .from("merchants")
      .select("is_active, expires_at")
      .eq("id", shopId)
      .maybeSingle();
    if (!owner?.is_active || new Date(owner.expires_at).getTime() <= Date.now()) return null;
  }

  const { data: setting } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "merchant_store_name:" + shopId)
    .maybeSingle();
  const shopName = typeof setting?.value === "string" ? setting.value : "";
  return { merchantId: merchant.id, shopId, username: merchant.username, shopName };
}

function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values["year"] + "-" + values["month"] + "-" + values["day"];
}

function isMetalTargetValid(metal: Metal, target: number): boolean {
  return metal === "gold" ? target === 1000 || target === 875 : target === 999;
}

const failure = (message: string) => ({ ok: false as const, message });

export const getScrapReceipts = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: tokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const context = await getMerchantContext(data.token);
    if (!context) return failure("انتهت الجلسة أو اشتراك المحل غير فعال");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("scrap_receipts")
      .select("receipt")
      .eq("shop_id", context.shopId)
      .order("created_at", { ascending: false })
      .limit(MAX_RECEIPTS);
    if (error) return failure("تعذّر تحميل سجل السندات");
    const receipts = (rows ?? []).flatMap((row) => {
      if (!row.receipt || typeof row.receipt !== "object" || Array.isArray(row.receipt)) return [];
      const receipt = row.receipt as unknown as SettlementReceipt;
      return String(receipt.shopId) === String(context.shopId) ? [receipt] : [];
    });
    return { ok: true as const, receipts };
  });

export const issueScrapReceipt = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    token: tokenSchema,
    metal: z.enum(["gold", "silver"]),
    target: z.number().int().min(1).max(1000),
    received: z.array(lineSchema).max(100),
    delivered: z.array(lineSchema).max(100),
    ratePerGram: z.string().max(40),
    cashPaid: z.string().max(40),
    customerName: z.string().max(200),
    notes: z.string().max(1000),
    timeZone: z.string().trim().min(1).max(100),
  }).parse(data))
  .handler(async ({ data }) => {
    const context = await getMerchantContext(data.token);
    if (!context) return failure("انتهت الجلسة أو اشتراك المحل غير فعال");
    if (!isMetalTargetValid(data.metal, data.target)) return failure("أساس الصافي غير صالح للمعدن المختار");

    let timeZone = data.timeZone;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
      return failure("المنطقة الزمنية غير صالحة");
    }

    const evaluation = computeSettlement({
      received: data.received,
      delivered: data.delivered,
      target: data.target,
      ratePerGram: data.ratePerGram,
      cashPaid: data.cashPaid,
    });
    if (evaluation.errors.length > 0) return failure(evaluation.errors[0] ?? "بيانات الحساب غير صالحة");
    if (!evaluation.hasData) return failure("أدخل بنداً واحداً على الأقل");

    const createdAt = new Date();
    const receiptDay = localDateKey(createdAt, timeZone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: serialNumber, error: serialError } = await supabaseAdmin.rpc("next_scrap_receipt_number", {
      p_shop_id: context.shopId,
      p_receipt_day: receiptDay,
    });
    if (serialError || typeof serialNumber !== "number" || serialNumber < 1) {
      return failure("تعذّر إنشاء رقم السند");
    }

    const serial = "ST-" + receiptDay.replace(/-/g, "") + "-" + String(serialNumber).padStart(4, "0");
    const receipt: SettlementReceipt = {
      ...evaluation.totals,
      id: String(context.shopId) + "-" + serial,
      serial,
      shopId: String(context.shopId),
      shopName: context.shopName,
      employeeName: context.username,
      customerName: data.customerName.trim() || null,
      notes: data.notes.trim() || null,
      metal: data.metal,
      targetShares: data.target,
      currency: DEFAULT_CURRENCY,
      createdAt: createdAt.toISOString(),
      timeZone,
      received: evaluation.received,
      delivered: evaluation.delivered,
    };

    const { error: saveError } = await supabaseAdmin.from("scrap_receipts").insert({
      shop_id: context.shopId,
      employee_id: context.merchantId,
      employee_name: context.username,
      serial,
      customer_name: receipt.customerName,
      metal: data.metal,
      created_at: receipt.createdAt,
      receipt: receipt as unknown as Json,
    });
    if (saveError) return failure("تعذّر حفظ السند في سجل المحل");
    return { ok: true as const, receipt };
  });
