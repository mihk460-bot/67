import type { Json } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyToken } from "./auth.server";
import { logActivity } from "./logs.server";

type Merchant = { id: number; username: string; parent_merchant_id: number | null; session_version: number; is_active: boolean; expires_at: string; last_seen_at: string | null; created_at: string };

async function merchantFromToken(token: string): Promise<Merchant | null> {
  const p = verifyToken(token);
  if (!p || p.role !== "merchant") return null;
  const { data } = await supabaseAdmin.from("merchants").select("id, username, parent_merchant_id, session_version, is_active, expires_at, last_seen_at, created_at").eq("id", Number(p.sub)).maybeSingle();
  if (!data || data.session_version !== p.sv) return null;
  return data as Merchant;
}

const err = (message: string) => ({ ok: false as const, message });

export type SaleRow = {
  id: number; invoiceNumber: string; employeeId: number; employeeName: string; metal: "gold" | "silver";
  karat: string; side: "sell" | "buy"; weight: number; total: number; invoice: Record<string, Json>; createdAt: string;
};
const mapSale = (r: { id: number; invoice_number: string | null; employee_id: number; employee_name: string; metal: string; karat: string; side: string; weight: number; total: number; invoice: Json; created_at: string }): SaleRow => ({
  id: r.id, invoiceNumber: r.invoice_number ?? "", employeeId: r.employee_id, employeeName: r.employee_name,
  metal: r.metal === "silver" ? "silver" : "gold", karat: r.karat, side: r.side === "buy" ? "buy" : "sell",
  weight: Number(r.weight), total: Number(r.total), invoice: (r.invoice ?? {}) as Record<string, Json>, createdAt: r.created_at,
});

export const recordSale = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string(),
    invoice: z.object({
      metal: z.enum(["gold", "silver"]), karat: z.string().max(10), side: z.enum(["sell", "buy"]),
      weight: z.number().positive().max(1e7), finalTotal: z.number().min(0).max(1e12),
    }).passthrough(),
  }).parse(d))
  .handler(async ({ data }) => {
    const m = await merchantFromToken(data.token);
    if (!m) return err("انتهت الجلسة");
    const shopId = m.parent_merchant_id ?? m.id;
    const { data: row, error } = await supabaseAdmin.from("sales_logs").insert({
      shop_id: shopId, employee_id: m.id, employee_name: m.username, metal: data.invoice.metal, karat: data.invoice.karat,
      side: data.invoice.side, weight: data.invoice.weight, total: data.invoice.finalTotal, invoice: data.invoice as Json,
    }).select("invoice_number, created_at").single();
    if (error || !row) return err("تعذر حفظ الفاتورة في السجل");
    return { ok: true as const, invoiceNumber: row.invoice_number ?? "", createdAt: row.created_at };
  });

export const getSalesLog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const m = await merchantFromToken(data.token);
    if (!m) return err("انتهت الجلسة");
    const { data: rows, error } = await supabaseAdmin.from("sales_logs").select("*").eq("shop_id", m.parent_merchant_id ?? m.id).order("created_at", { ascending: false }).limit(2000);
    if (error) return err("تعذر تحميل السجل");
    return { ok: true as const, sales: (rows ?? []).map(mapSale) };
  });

export const logLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const p = verifyToken(data.token);
    if (!p) return { ok: true as const };
    let actorName = p.role === "admin" ? "مالك التطبيق" : "مدير الأسعار";
    let actorRole: string = p.role;
    let shopId: number | null = null;
    if (p.role === "merchant") {
      const m = await merchantFromToken(data.token);
      if (!m) return { ok: true as const };
      actorName = m.username; actorRole = m.parent_merchant_id ? "employee" : "merchant"; shopId = m.parent_merchant_id ?? m.id;
    }
    const { data: lastLogin } = await supabaseAdmin.from("activity_logs").select("created_at").eq("kind", "login").eq("actor_id", p.sub).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const loginAt = lastLogin?.created_at ?? null;
    await logActivity({ kind: "logout", actorId: p.sub, actorName, actorRole, shopId, details: {
      loginAt, durationSeconds: loginAt ? Math.max(0, Math.round((Date.now() - new Date(loginAt).getTime()) / 1000)) : null,
    } });
    return { ok: true as const };
  });

export type ActivityRow = { id: number; kind: string; actorId: string; actorName: string; actorRole: string; shopId: number | null; details: Record<string, Json>; createdAt: string };
export type AccountRow = { id: number; username: string; isActive: boolean; expiresAt: string; lastSeenAt: string | null; createdAt: string };
export type ShopRow = AccountRow & { storeName: string; employees: AccountRow[]; salesCount: number; salesTotal: number };

export const getAdminLogs = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const p = verifyToken(data.token);
    if (!p || p.role !== "admin") return err("غير مصرح");
    const [acts, sales, merchants, names] = await Promise.all([
      supabaseAdmin.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(3000),
      supabaseAdmin.from("sales_logs").select("shop_id, metal, weight, total, side").limit(100000),
      supabaseAdmin.from("merchants").select("id, username, parent_merchant_id, is_active, expires_at, last_seen_at, created_at").order("id"),
      supabaseAdmin.from("settings").select("key, value").like("key", "merchant_store_name:%"),
    ]);
    if (acts.error || sales.error || merchants.error) return err("تعذر تحميل السجلات");
    const storeNames = new Map((names.data ?? []).map((r) => [r.key.split(":")[1], typeof r.value === "string" ? r.value : ""]));
    const all = (merchants.data ?? []) as Omit<Merchant, "session_version">[];
    const acc = (m: (typeof all)[number]): AccountRow => ({ id: m.id, username: m.username, isActive: m.is_active, expiresAt: m.expires_at, lastSeenAt: m.last_seen_at, createdAt: m.created_at });
    const salesRows = sales.data ?? [];
    const shops: ShopRow[] = all.filter((m) => m.parent_merchant_id === null).map((m) => {
      const mine = salesRows.filter((s) => s.shop_id === m.id);
      return { ...acc(m), storeName: storeNames.get(String(m.id)) ?? "", employees: all.filter((e) => e.parent_merchant_id === m.id).map(acc),
        salesCount: mine.length, salesTotal: mine.reduce((a, s) => a + Number(s.total), 0) };
    });
    const sum = (metal: string, f: "weight" | "total") => salesRows.filter((s) => s.metal === metal).reduce((a, s) => a + Number(s[f]), 0);
    return {
      ok: true as const,
      activity: (acts.data ?? []).map((a): ActivityRow => ({ id: a.id, kind: a.kind, actorId: a.actor_id, actorName: a.actor_name, actorRole: a.actor_role, shopId: a.shop_id, details: (a.details ?? {}) as Record<string, Json>, createdAt: a.created_at })),
      shops,
      stats: { salesCount: salesRows.length, salesTotal: sum("gold", "total") + sum("silver", "total"), goldWeight: sum("gold", "weight"), silverWeight: sum("silver", "weight"), goldTotal: sum("gold", "total"), silverTotal: sum("silver", "total") },
    };
  });
