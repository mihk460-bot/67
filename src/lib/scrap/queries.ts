import { useQuery } from "@tanstack/react-query";
import { readToken } from "@/lib/auth-client";
import { getScrapReceipts } from "@/lib/scrap.functions";
import type { SettlementReceipt } from "./receipts";

export const scrapKeys = {
  receipts: (merchantId: number | undefined) => ["scrap", "receipts", merchantId ?? "current"] as const,
};

/** يجلب سندات المحل من قاعدة البيانات، مع عزل ذاكرة التخزين المؤقت لكل حساب. */
export function useScrapReceipts(merchantId: number | undefined) {
  return useQuery<SettlementReceipt[]>({
    queryKey: scrapKeys.receipts(merchantId),
    queryFn: async () => {
      const result = await getScrapReceipts({ data: { token: readToken() } });
      if (!result.ok) throw new Error(result.message);
      return result.receipts;
    },
    enabled: Boolean(readToken()),
  });
}
