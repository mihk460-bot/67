import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readToken } from "@/lib/auth-client";
import { getScrapReceipts } from "@/lib/scrap.functions";
import { OFFLINE_OUTBOX_CHANGED_EVENT } from "@/lib/offline/config";
import { getQueuedScrapReceipts } from "@/lib/offline/outbox";
import type { SettlementReceipt } from "./receipts";

export const scrapKeys = {
  receipts: (merchantId: number | undefined) => ["scrap", "receipts", merchantId ?? "current"] as const,
};

/** Loads server receipts and overlays this account's local pending receipts. */
export function useScrapReceipts(merchantId: number | undefined) {
  const [queueRevision, setQueueRevision] = useState(0);
  useEffect(() => {
    const onQueueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ merchantId?: number }>).detail;
      if (detail?.merchantId === merchantId) setQueueRevision((value) => value + 1);
    };
    window.addEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
    return () => window.removeEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
  }, [merchantId]);

  const query = useQuery<SettlementReceipt[]>({
    queryKey: scrapKeys.receipts(merchantId),
    queryFn: async () => {
      const result = await getScrapReceipts({ data: { token: readToken() } });
      if (!result.ok) throw new Error(result.message);
      return result.receipts;
    },
    enabled: Boolean(readToken()),
  });
  const mergedReceipts = useMemo(() => {
    const pending = getQueuedScrapReceipts(merchantId);
    if (!query.data) return pending.length > 0 ? pending : undefined;
    const knownIds = new Set(query.data.map((receipt) => receipt.offlineRequestId).filter((id): id is string => !!id));
    return [...pending.filter((receipt) => !receipt.offlineRequestId || !knownIds.has(receipt.offlineRequestId)), ...query.data];
  }, [query.data, merchantId, queueRevision]);
  return { ...query, data: mergedReceipts };
}
