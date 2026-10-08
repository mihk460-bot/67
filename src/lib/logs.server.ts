import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ActivityKind = "login" | "logout" | "price_update" | "subscription";

/** Writes one audit row; never throws so logging can't break the main action. */
export async function logActivity(entry: {
  kind: ActivityKind;
  actorId: string;
  actorName: string;
  actorRole: string;
  shopId?: number | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from("activity_logs").insert({
      kind: entry.kind,
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      shop_id: entry.shopId ?? null,
      details: (entry.details ?? {}) as Json,
    });
  } catch (error) {
    console.error("activity log failed", error);
  }
}

export const roleName = (role: string) =>
  role === "admin" ? "مالك التطبيق" : role === "price_manager" ? "مدير الأسعار" : role === "employee" ? "موظف" : "تاجر";
