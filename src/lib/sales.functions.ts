import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyToken, type TokenPayload } from "./auth.server";

// ============================
// Shared helpers
// ============================

type Fail = {
  ok: false;
  message: string;
  error?: string;
};

type Ok<T> = { ok: true } & T;

function fail(message: string, error?: string): Fail {
  return { ok: false, message, error };
}

async function getCurrentMerchantFromToken(token: string) {
  const payload: TokenPayload | null = verifyToken(token);
  if (!payload) return null;

  const { data, error } = await supabaseAdmin
    .from("merchants")
    .select("*")
    .eq("id", Number(payload.sub))
    .maybeSingle();

  if (error || !data) return null;
  return data as {
    id: number;
    username: string;
    parent_merchant_id: number | null;
    role?: string;
    is_active: boolean;
    expires_at: string;
  };
}

async function logAuditEvent({
  actorId,
  actorRole,
  merchantId,
  employeeId,
  action,
  actionCategory,
  details,
  status = "success",
  errorMessage,
}: {
  actorId?: number | null;
  actorRole: "merchant" | "employee" | "admin" | "price_manager";
  merchantId?: number | null;
  employeeId?: number | null;
  action: string;
  actionCategory:
    | "authentication"
    | "merchant_management"
    | "employee_management"
    | "sales"
    | "pricing"
    | "settings"
    | "system";
  details?: Record<string, unknown>;
  status?: "success" | "failure";
  errorMessage?: string | null;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId ?? null,
      actor_role: actorRole,
      merchant_id: merchantId ?? null,
      employee_id: employeeId ?? null,
      action,
      action_category: actionCategory,
      details: details ?? {},
      status,
      error_message: errorMessage ?? null,
    });
  } catch {
    // لا نريد أن تتوقف العملية بسبب فشل سجل النشاط
  }
}

// ============================
// Sale validation schema
// ============================

const saleInputSchema = z.object({
  token: z.string().min(1),
  metalType: z.enum(["gold", "silver"]),
  karat: z.string().min(1).max(10),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  saleType: z.enum(["sell", "buy"]),
  note: z.string().max(500).optional().default(""),
});

// ============================
// Record a sale
// ============================

export const recordSale = createServerFn({ method: "POST" })
  .inputValidator((data) => saleInputSchema.parse(data))
  .handler(async ({ data }): Promise<Ok<{ id: number }> | Fail> => {
    const merchant = await getCurrentMerchantFromToken(data.token);
    if (!merchant) return fail("انتهت الجلسة أو غير مصرح لك", "invalid_session");

    if (!merchant.is_active) {
      return fail("حسابك غير فعال، يرجى تجديد الاشتراك", "inactive_account");
    }

    const totalPrice = Number((data.quantity * data.unitPrice).toFixed(2));

    const { data: inserted, error } = await supabaseAdmin
      .from("sales")
      .insert({
        merchant_id: merchant.id,
        employee_id: merchant.parent_merchant_id ?? null,
        metal_type: data.metalType,
        karat: data.karat,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        total_price: totalPrice,
        sale_type: data.saleType,
        note: data.note,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await logAuditEvent({
        actorId: merchant.id,
        actorRole: merchant.parent_merchant_id ? "employee" : "merchant",
        merchantId: merchant.id,
        employeeId: merchant.parent_merchant_id ?? null,
        action: "sale_record_failed",
        actionCategory: "sales",
        details: {
          metalType: data.metalType,
          karat: data.karat,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          note: data.note,
        },
        status: "failure",
        errorMessage: error?.message ?? "unknown_error",
      });
      return fail("تعذر تسجيل المبيعة، حاول مرة أخرى", error?.message ?? "insert_failed");
    }

    await logAuditEvent({
      actorId: merchant.id,
      actorRole: merchant.parent_merchant_id ? "employee" : "merchant",
      merchantId: merchant.id,
      employeeId: merchant.parent_merchant_id ?? null,
      action: "sale_recorded",
      actionCategory: "sales",
      details: {
        saleId: inserted.id,
        metalType: data.metalType,
        karat: data.karat,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice,
        saleType: data.saleType,
        note: data.note,
      },
    });

    return { ok: true, id: inserted.id };
  });

// ============================
// Get merchant sales
// ============================

const salesListSchema = z.object({
  token: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional().default(50),
  page: z.number().int().min(1).optional().default(1),
});

export const getMerchantSales = createServerFn({ method: "POST" })
  .inputValidator((data) => salesListSchema.parse(data))
  .handler(async ({ data }): Promise<
    | Ok<{
        sales: Array<{
          id: number;
          employeeId: number | null;
          employeeUsername: string | null;
          metalType: string;
          karat: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          saleType: string;
          note: string;
          createdAt: string;
        }>;
        total: number;
      }>
    | Fail
  > => {
    const merchant = await getCurrentMerchantFromToken(data.token);
    if (!merchant) return fail("انتهت الجلسة أو غير مصرح لك", "invalid_session");

    const offset = (data.page - 1) * data.limit;

    const saleQuery = supabaseAdmin
      .from("sales")
      .select(
        "id, employee_id, metal_type, karat, quantity, unit_price, total_price, sale_type, note, created_at",
        { count: "exact" },
      )
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);

    const { data: rows, error, count } = await saleQuery;

    if (error) {
      return fail("تعذر جلب سجل المبيعات", error.message);
    }

    const employeeIds = Array.from(new Set((rows ?? []).map((row) => row.employee_id).filter(Boolean))) as number[];
    let employeeMap: Record<number, string> = {};

    if (employeeIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from("merchants")
        .select("id, username")
        .in("id", employeeIds);

      employeeMap = Object.fromEntries((employees ?? []).map((item) => [item.id, item.username]));
    }

    return {
      ok: true,
      total: count ?? 0,
      sales: (rows ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeUsername: row.employee_id ? employeeMap[row.employee_id] ?? null : null,
        metalType: row.metal_type,
        karat: row.karat,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        totalPrice: Number(row.total_price),
        saleType: row.sale_type,
        note: row.note ?? "",
        createdAt: row.created_at,
      })),
    };
  });

// ============================
// Admin: get all sales
// ============================

export const getAdminSales = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(1), limit: z.number().int().min(1).max(200).optional().default(50), page: z.number().int().min(1).optional().default(1) }).parse(data))
  .handler(async ({ data }): Promise<
    | Ok<{
        sales: Array<{
          id: number;
          merchantId: number;
          merchantUsername: string;
          employeeId: number | null;
          employeeUsername: string | null;
          metalType: string;
          karat: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          saleType: string;
          note: string;
          createdAt: string;
        }>;
        total: number;
      }>
    | Fail
  > => {
    const payload = verifyToken(data.token);
    if (!payload || (payload.role !== "admin" && payload.role !== "price_manager")) {
      return fail("غير مصرح لك", "not_authorized");
    }

    const offset = (data.page - 1) * data.limit;

    const { data: rows, error, count } = await supabaseAdmin
      .from("sales")
      .select(
        "id, merchant_id, employee_id, metal_type, karat, quantity, unit_price, total_price, sale_type, note, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);

    if (error) return fail("تعذر جلب المبيعات", error.message);

    const merchantIds = Array.from(new Set((rows ?? []).map((row) => row.merchant_id)));
    const employeeIds = Array.from(new Set((rows ?? []).map((row) => row.employee_id).filter(Boolean))) as number[];

    let merchantMap: Record<number, string> = {};
    let employeeMap: Record<number, string> = {};

    if (merchantIds.length > 0) {
      const { data: merchants } = await supabaseAdmin
        .from("merchants")
        .select("id, username")
        .in("id", merchantIds);

      merchantMap = Object.fromEntries((merchants ?? []).map((item) => [item.id, item.username]));
    }

    if (employeeIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from("merchants")
        .select("id, username")
        .in("id", employeeIds);

      employeeMap = Object.fromEntries((employees ?? []).map((item) => [item.id, item.username]));
    }

    return {
      ok: true,
      total: count ?? 0,
      sales: (rows ?? []).map((row) => ({
        id: row.id,
        merchantId: row.merchant_id,
        merchantUsername: merchantMap[row.merchant_id] ?? "غير معروف",
        employeeId: row.employee_id,
        employeeUsername: row.employee_id ? employeeMap[row.employee_id] ?? null : null,
        metalType: row.metal_type,
        karat: row.karat,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        totalPrice: Number(row.total_price),
        saleType: row.sale_type,
        note: row.note ?? "",
        createdAt: row.created_at,
      })),
    };
  });

// ============================
// Audit log helpers
// ============================

export const getAuditLogs = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(1), limit: z.number().int().min(1).max(200).optional().default(50), page: z.number().int().min(1).optional().default(1) }).parse(data))
  .handler(async ({ data }): Promise<
    | Ok<{
        logs: Array<{
          id: number;
          actorUsername: string | null;
          actorRole: string;
          merchantId: number | null;
          employeeId: number | null;
          action: string;
          actionCategory: string;
          details: Record<string, unknown>;
          status: string;
          errorMessage: string | null;
          createdAt: string;
        }>;
        total: number;
      }>
    | Fail
  > => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") {
      return fail("غير مصرح لك", "not_authorized");
    }

    const offset = (data.page - 1) * data.limit;

    const { data: rows, error, count } = await supabaseAdmin
      .from("audit_logs")
      .select("id, actor_username, actor_role, merchant_id, employee_id, action, action_category, details, status, error_message, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);

    if (error) return fail("تعذر جلب سجل النشاط", error.message);

    return {
      ok: true,
      total: count ?? 0,
      logs: (rows ?? []).map((row) => ({
        id: row.id,
        actorUsername: row.actor_username ?? null,
        actorRole: row.actor_role,
        merchantId: row.merchant_id,
        employeeId: row.employee_id,
        action: row.action,
        actionCategory: row.action_category,
        details: (row.details as Record<string, unknown>) ?? {},
        status: row.status,
        errorMessage: row.error_message ?? null,
        createdAt: row.created_at,
      })),
    };
  });

// ============================
// Employee stats
// ============================

export const getEmployeeStats = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<
    | Ok<{
        employees: Array<{
          id: number;
          username: string;
          totalSales: number;
          totalAmount: number;
          lastSaleAt: string | null;
          lastLogin: string | null;
        }>;
      }>
    | Fail
  > => {
    const merchant = await getCurrentMerchantFromToken(data.token);
    if (!merchant) return fail("انتهت الجلسة أو غير مصرح لك", "invalid_session");

    const { data: employees, error } = await supabaseAdmin
      .from("merchants")
      .select("id, username")
      .eq("parent_merchant_id", merchant.id)
      .order("id", { ascending: false });

    if (error) return fail("تعذر جلب موظفيك", error.message);

    const employeeIds = (employees ?? []).map((e) => e.id);

    let statsMap: Record<number, { totalSales: number; totalAmount: number; lastSaleAt: string | null }> = {};

    if (employeeIds.length > 0) {
      const { data: salesRows } = await supabaseAdmin
        .from("sales")
        .select("employee_id, id, total_price, created_at")
        .in("employee_id", employeeIds);

      for (const row of salesRows ?? []) {
        if (!row.employee_id) continue;
        const current = statsMap[row.employee_id] ?? { totalSales: 0, totalAmount: 0, lastSaleAt: null };
        current.totalSales += 1;
        current.totalAmount += Number(row.total_price || 0);
        if (!current.lastSaleAt || row.created_at > current.lastSaleAt) {
          current.lastSaleAt = row.created_at;
        }
        statsMap[row.employee_id] = current;
      }
    }

    return {
      ok: true,
      employees: (employees ?? []).map((employee) => ({
        id: employee.id,
        username: employee.username,
        totalSales: statsMap[employee.id]?.totalSales ?? 0,
        totalAmount: statsMap[employee.id]?.totalAmount ?? 0,
        lastSaleAt: statsMap[employee.id]?.lastSaleAt ?? null,
        lastLogin: null,
      })),
    };
  });
