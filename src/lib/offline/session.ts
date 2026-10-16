import { OFFLINE_AUTH_CHANGED_EVENT, OFFLINE_QUERY_STORAGE_PREFIX } from "./config";

export interface OfflineAuthChange {
  previousMerchantId?: number;
  merchantId?: number;
  role: string | null;
}

export function dispatchOfflineAuthChanged(detail: OfflineAuthChange) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_AUTH_CHANGED_EVENT, { detail }));
}

/** Clears private cached pages/data, never the pending financial outbox. */
export function clearOfflineSessionCache(merchantId?: number) {
  if (typeof window === "undefined") return;
  if (merchantId && Number.isSafeInteger(merchantId) && merchantId > 0) {
    try {
      window.localStorage.removeItem(OFFLINE_QUERY_STORAGE_PREFIX + String(merchantId));
    } catch {
      // Cache cleanup must not prevent logout.
    }
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE" });
  } catch {
    // Service workers are optional; the app still clears its in-memory cache.
  }
}
