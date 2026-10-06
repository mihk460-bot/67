import type { Json } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ALL_PRICE_KEYS } from "./prices";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
  type TokenPayload,
} from "./auth.server";

// ---------- shared helpers ----------

type MerchantRow = {
  id: number;
  username: string;
  password_hash: string;
  session_version: number;
  parent_merchant_id: number | null;
  is_active: boolean;
  expires_at: string;
  created_at: string;
};

type Prices = Record<string, number>;

const DEFAULT_PRICES: Prices = Object.fromEntries(ALL_PRICE_KEYS.map((k) => [k, 0]));

const pricesSchema = z.object(
  Object.fromEntries(ALL_PRICE_KEYS.map((k) => [k, z.number().min(0).default(0)])) as Record<
    string,
    z.ZodDefault<z.ZodNumber>
  >,
);

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as unknown as T) ?? fallback;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await supabaseAdmin.from("settings").upsert({ key, value: value as Json });
}

async function isMerchantActive(m: MerchantRow): Promise<boolean> {
  return m.is_active && new Date(m.expires_at).getTime() > Date.now();
}

async function getMerchantByToken(token: string): Promise<MerchantRow | null> {
  const payload: TokenPayload | null = verifyToken(token);
  if (!payload || payload.role !== "merchant") return null;
  const { data } = await supabaseAdmin
    .from("merchants")
    .select("*")
    .eq("id", Number(payload.sub))
    .maybeSingle();
  if (!data) return null;
  if (data.session_version !== payload.sv) return null;
  return data as MerchantRow;
}

type Fail = {
  ok: false;
  message: string;
  error?: string;
  supportContact?: string;
  supportContactType?: string;
};
type Ok<T> = { ok: true } & T;

function fail(
  message: string,
  extra?: Partial<Pick<Fail, "error" | "supportContact" | "supportContactType">>,
): Fail {
  return { ok: false, message, ...extra };
}

// ---------- public prices ----------

export type SupportContact = { label: string; type: "phone" | "whatsapp" | "link"; value: string };
const supportContactSchema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(["phone", "whatsapp", "link"]),
  value: z.string().trim().min(1).max(300),
});
async function getSupportContacts(): Promise<SupportContact[]> {
  const list = await getSetting<SupportContact[]>("supportContacts", []);
  return Array.isArray(list) ? list : [];
}

export const getPublicPrices = createServerFn({ method: "GET" }).handler(async () => {
  const [prices, displayCounter, supportContact, supportContactType] = await Promise.all([
    getSetting<Prices>("prices", DEFAULT_PRICES).then((p) => ({ ...DEFAULT_PRICES, ...p })),
    getSetting<number>("displayCounter", 0),
    getSetting<string>("supportContact", ""),
    getSetting<string>("supportContactType", "phone"),
  ]);
  const supportContacts = await getSupportContacts();
  return { prices, displayCounter, supportContact, supportContactType, supportContacts };
});

// ---------- merchant auth ----------

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9_.-]+$/, "اسم المستخدم غير صالح");

export const merchantRegister = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ username: usernameSchema, password: z.string().min(6).max(128) }).parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{ token: string; merchantId: number }> | Fail> => {
    const username = data.username.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) return fail("اسم المستخدم مستخدم بالفعل");
    const { data: created, error } = await supabaseAdmin
      .from("merchants")
      .insert({ username, password_hash: hashPassword(data.password) })
      .select("id")
      .single();
    if (error || !created) return fail("تعذر إنشاء الحساب، حاول مرة أخرى");
    const token = signToken({ sub: String(created.id), role: "merchant", sv: 1 });
    return { ok: true, token, merchantId: created.id };
  });

export const merchantLogin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<Ok<{ token: string; merchantId: number }> | Fail> => {
      const username = data.username.trim().toLowerCase();
      const { data: merchant } = await supabaseAdmin
        .from("merchants")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      const passwordOk =
        !!merchant &&
        (verifyPassword(data.password, merchant.password_hash) ||
          (data.password.trim() !== data.password &&
            verifyPassword(data.password.trim(), merchant.password_hash)));
      if (!merchant || !passwordOk) {
        return fail("بيانات الدخول غير صحيحة");
      }
      const active = await isMerchantActive(merchant as MerchantRow);
      if (!active) {
        const [supportContact, supportContactType] = await Promise.all([
          getSetting<string>("supportContact", ""),
          getSetting<string>("supportContactType", "phone"),
        ]);
        return fail("انتهت الفترة المجانية أو الاشتراك", {
          error: "subscription_inactive",
          supportContact,
          supportContactType,
        });
      }
      const token = signToken({
        sub: String(merchant.id),
        role: "merchant",
        sv: merchant.session_version,
      });
      return { ok: true, token, merchantId: merchant.id };
    },
  );

export const getMerchantMe = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }): Promise<Ok<{ username: string; subscriptionActive: boolean; expiresAt: string; isEmployee: boolean }> | Fail> => {
    const merchant = await getMerchantByToken(data.token);
    if (!merchant) return fail("انتهت الجلسة", { error: "invalid_session" });
    return {
      ok: true,
      username: merchant.username,
      subscriptionActive: await isMerchantActive(merchant),
      expiresAt: merchant.expires_at,
      isEmployee: merchant.parent_merchant_id !== null,
    };
  });

// ---------- merchant team (employees) ----------

export const getMerchantTeam = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      | Ok<{
          total: number;
          limit: number;
          canManage: boolean;
          ownerActive: boolean;
          employees: { id: number; username: string; isExpired: boolean; isDisabled: boolean }[];
        }>
      | Fail
    > => {
      const merchant = await getMerchantByToken(data.token);
      if (!merchant) return fail("انتهت الجلسة", { error: "invalid_session" });
      const ownerActive = await isMerchantActive(merchant);
      const { data: employees } = await supabaseAdmin
        .from("merchants")
        .select("id, username, is_active, expires_at")
        .eq("parent_merchant_id", merchant.id)
        .order("id");
      const list = (employees ?? []).map((e: { id: number; username: string; is_active: boolean; expires_at: string }) => ({
        id: e.id,
        username: e.username,
        isDisabled: !e.is_active,
        isExpired: !ownerActive || !e.is_active || new Date(e.expires_at).getTime() <= Date.now(),
      }));
      return {
        ok: true,
        total: list.length,
        limit: 2,
        canManage: merchant.parent_merchant_id === null,
        ownerActive,
        employees: list,
      };
    },
  );

async function getOwnedEmployee(token: string, employeeId: number) {
  const merchant = await getMerchantByToken(token);
  if (!merchant) return { error: fail("انتهت الجلسة", { error: "invalid_session" }) };
  if (merchant.parent_merchant_id !== null) return { error: fail("غير مسموح للموظفين") };
  const { data: emp } = await supabaseAdmin
    .from("merchants")
    .select("id, session_version")
    .eq("id", employeeId)
    .eq("parent_merchant_id", merchant.id)
    .maybeSingle();
  if (!emp) return { error: fail("الموظف غير موجود") };
  return { emp };
}

export const deleteEmployee = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string(), employeeId: z.number().int() }).parse(data))
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const r = await getOwnedEmployee(data.token, data.employeeId);
    if (r.error) return r.error;
    const { error } = await supabaseAdmin.from("merchants").delete().eq("id", r.emp.id);
    if (error) return fail("تعذر حذف الموظف");
    return { ok: true };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string(), employeeId: z.number().int(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const r = await getOwnedEmployee(data.token, data.employeeId);
    if (r.error) return r.error;
    const { error } = await supabaseAdmin
      .from("merchants")
      .update({ is_active: data.active, session_version: r.emp.session_version + 1, updated_at: new Date().toISOString() })
      .eq("id", r.emp.id);
    if (error) return fail("تعذر تحديث حالة الموظف");
    return { ok: true };
  });

export const createEmployee = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string(), username: usernameSchema, password: z.string().min(6).max(128) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<Ok<{ id: number }> | Fail> => {
      const merchant = await getMerchantByToken(data.token);
      if (!merchant) return fail("انتهت الجلسة", { error: "invalid_session" });
      if (merchant.parent_merchant_id !== null) {
        return fail("الموظفون لا يمكنهم إنشاء حسابات");
      }
      const { count, error: countError } = await supabaseAdmin
        .from("merchants")
        .select("id", { count: "exact" })
        .eq("parent_merchant_id", merchant.id);
      if (countError) return fail("تعذر إنشاء حساب الموظف");
      if ((count ?? 0) >= 2) return fail("تم الوصول للحد الأقصى (حسابان للموظفين)");
      const username = data.username.trim().toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("merchants")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) return fail("اسم المستخدم مستخدم بالفعل");
      const { data: created, error } = await supabaseAdmin
        .from("merchants")
        .insert({
          username,
          password_hash: hashPassword(data.password),
          parent_merchant_id: merchant.id,
          expires_at: merchant.expires_at,
        })
        .select("id")
        .single();
      if (error || !created) return fail("تعذر إنشاء حساب الموظف، حاول مرة أخرى");
      return { ok: true, id: created.id };
    },
  );

// ---------- admin auth ----------

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ password: z.string().min(1) }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<Ok<{ token: string; role: "admin" | "price_manager" }> | Fail> => {
      const adminPassword = process.env["ADMIN_PASSWORD"]?.trim();
      const priceManagerPassword = process.env["PRICE_MANAGER_PASSWORD"]?.trim();
      const input = data.password.trim();
      if (!adminPassword && !priceManagerPassword) {
        return fail("كلمات مرور الإدارة غير مهيأة بعد");
      }
      if (adminPassword && input === adminPassword) {
        return { ok: true, token: signToken({ sub: "admin", role: "admin" }), role: "admin" };
      }
      if (priceManagerPassword && input === priceManagerPassword) {
        return {
          ok: true,
          token: signToken({ sub: "price-manager", role: "price_manager" }),
          role: "price_manager",
        };
      }
      return fail("كلمة المرور غير صحيحة");
    },
  );

// ---------- admin settings & prices ----------

export const getAdminSettings = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      | Ok<
          {
            prices: Prices;
            realCounter: number;
            displayCounter: number;
            supportContact: string;
            supportContactType: string;
            supportContacts: SupportContact[];
          }
        >
      | Fail
    > => {
      const payload = verifyToken(data.token);
      if (!payload || payload.role !== "admin") return fail("غير مصرح");
      const prices = { ...DEFAULT_PRICES, ...(await getSetting<Prices>("prices", DEFAULT_PRICES)) };
      const [displayCounter, supportContact, supportContactType] = await Promise.all([
        getSetting<number>("displayCounter", 0),
        getSetting<string>("supportContact", ""),
        getSetting<string>("supportContactType", "phone"),
      ]);
      const { count } = await supabaseAdmin
        .from("merchants")
        .select("id", { count: "exact" })
        .is("parent_merchant_id", null)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());
      return {
        ok: true,
        prices,
        realCounter: count ?? 0,
        displayCounter,
        supportContact,
        supportContactType,
        supportContacts: await getSupportContacts(),
      };
    },
  );

export const updatePrices = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string(), prices: pricesSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || (payload.role !== "admin" && payload.role !== "price_manager")) {
      return fail("غير مصرح");
    }
    await setSetting("prices", data.prices);
    return { ok: true };
  });

export const updateAdminSettings = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string(),
        displayCounter: z.number().int().min(0),
        supportContact: z.string().max(300),
        supportContactType: z.enum(["phone", "link", "text"]),
        supportContacts: z.array(supportContactSchema).max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") return fail("غير مصرح");
    await Promise.all([
      setSetting("displayCounter", data.displayCounter),
      setSetting("supportContact", data.supportContact),
      setSetting("supportContactType", data.supportContactType),
      ...(data.supportContacts ? [setSetting("supportContacts", data.supportContacts)] : []),
    ]);
    return { ok: true };
  });

// ---------- admin merchants management ----------

export const listMerchants = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      | Ok<{ merchants: { id: number; username: string; isActive: boolean; expiresAt: string }[] }>
      | Fail
    > => {
      const payload = verifyToken(data.token);
      if (!payload || payload.role !== "admin") return fail("غير مصرح");
      const { data: merchants, error } = await supabaseAdmin
        .from("merchants")
        .select("id, username, is_active, expires_at")
        .is("parent_merchant_id", null)
        .order("id", { ascending: false });
      if (error) return fail("تعذر جلب قائمة التجار");
      return {
        ok: true,
        merchants: (merchants ?? []).map((m: { id: number; username: string; is_active: boolean; expires_at: string }) => ({
          id: m.id,
          username: m.username,
          isActive: m.is_active,
          expiresAt: m.expires_at,
        })),
      };
    },
  );

export const createMerchant = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string(),
        username: usernameSchema,
        password: z.string().min(6).max(128),
        subscriptionMonths: z.number().int().min(1).max(120).optional(),
        expiresAt: z.string().optional(),
      })
      .refine((d) => d.subscriptionMonths != null || d.expiresAt != null, {
        message: "حدد مدة الاشتراك أو تاريخ الانتهاء",
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{ id: number }> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") return fail("غير مصرح");
    const username = data.username.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) return fail("اسم المستخدم مستخدم بالفعل");
    const expiresAt = data.expiresAt ?? addMonths(new Date(), data.subscriptionMonths ?? 1).toISOString();
    const { data: created, error } = await supabaseAdmin
      .from("merchants")
      .insert({ username, password_hash: hashPassword(data.password), expires_at: expiresAt })
      .select("id")
      .single();
    if (error || !created) return fail("تعذر إنشاء التاجر، حاول مرة أخرى");
    return { ok: true, id: created.id };
  });

export const updateMerchant = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string(),
        id: z.number().int().positive(),
        isActive: z.boolean().optional(),
        password: z.string().min(6).max(128).optional(),
        subscriptionMonths: z.number().int().min(1).max(120).optional(),
        expiresAt: z.string().optional(),
      })
      .refine((d) => d.subscriptionMonths != null || d.expiresAt != null, {
        message: "حدد مدة الاشتراك أو تاريخ الانتهاء",
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") return fail("غير مصرح");
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!merchant) return fail("التاجر غير موجود");

    const updates: {
      updated_at: string;
      is_active?: boolean;
      password_hash?: string;
      session_version?: number;
      expires_at?: string;
    } = { updated_at: new Date().toISOString() };
    if (data.isActive !== undefined) updates["is_active"] = data.isActive;
    if (data.password) {
      updates["password_hash"] = hashPassword(data.password);
      updates["session_version"] = (merchant as MerchantRow)["session_version"] + 1;
    }

    if (data.expiresAt) {
      const parsed = new Date(`${data.expiresAt.slice(0, 10)}T23:59:59`);
      if (Number.isNaN(parsed.getTime())) return fail("اكتب التاريخ بالصيغة: سنة-شهر-يوم، مثال: 2026-12-31");
      updates["expires_at"] = parsed.toISOString();
    } else if (data.subscriptionMonths) {
      const current = new Date((merchant as MerchantRow)["expires_at"]).getTime();
      const base = current > Date.now() ? new Date(current) : new Date();
      updates["expires_at"] = addMonths(base, data.subscriptionMonths).toISOString();
    }

    const { error } = await supabaseAdmin.from("merchants").update(updates).eq("id", data.id);
    if (error) return fail("تعذر تحديث التاجر، حاول مرة أخرى");
    return { ok: true };
  });

export const deleteMerchant = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string(), id: z.number().int().positive() }).parse(data))
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") return fail("غير مصرح");
    const { error } = await supabaseAdmin.from("merchants").delete().eq("id", data.id);
    if (error) return fail("تعذر حذف التاجر، حاول مرة أخرى");
    return { ok: true };
  });

// ---------- notifications (in-app, replaces Expo push) ----------

export const sendNotification = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string(), title: z.string().min(1).max(120), body: z.string().min(1).max(1000) }).parse(data),
  )
  .handler(async ({ data }): Promise<Ok<{}> | Fail> => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") return fail("غير مصرح");
    const { error } = await supabaseAdmin
      .from("notifications")
      .insert({ title: data.title, body: data.body });
    if (error) return fail("حدث خطأ أثناء إرسال الإشعار");
    return { ok: true };
  });

export const getNotifications = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<Ok<{ notifications: { id: number; title: string; body: string; createdAt: string }[] }> | Fail> => {
      const merchant = await getMerchantByToken(data.token);
      if (!merchant) return fail("انتهت الجلسة", { error: "invalid_session" });
      const { data: rows, error } = await supabaseAdmin
        .from("notifications")
        .select("id, title, body, created_at")
        .order("id", { ascending: false })
        .limit(20);
      if (error) return fail("تعذر جلب الإشعارات");
      return {
        ok: true,
        notifications: (rows ?? []).map((n: { id: number; title: string; body: string; created_at: string }) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.created_at,
        })),
      };
    },
  );

// ---------- utils ----------

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}
