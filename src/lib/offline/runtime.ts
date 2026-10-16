import type { QueryClient } from "@tanstack/react-query";
import { loadAuthState } from "@/lib/auth-client";
import { OFFLINE_AUTH_CHANGED_EVENT, OFFLINE_OUTBOX_CHANGED_EVENT, OFFLINE_SYNCED_EVENT } from "./config";
import { flushOutbox, type OfflineSyncedDetail } from "./outbox";
import { persistOfflineQueries, restoreOfflineQueries } from "./query-cache";

function merchantIdFromState(state: ReturnType<typeof loadAuthState>): number | undefined {
  return state.role === "merchant" && Number.isSafeInteger(state.merchantId) && (state.merchantId ?? 0) > 0
    ? state.merchantId
    : undefined;
}

function invalidateSyncedQueries(queryClient: QueryClient, kinds: string[]) {
  if (kinds.includes("sale")) {
    void queryClient.invalidateQueries({ queryKey: ["sales-log"] });
    void queryClient.invalidateQueries({ queryKey: ["sales-report"] });
  }
  if (kinds.includes("scrap")) void queryClient.invalidateQueries({ queryKey: ["scrap", "receipts"] });
}

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (registration) => {
    await navigator.serviceWorker.ready;
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    worker?.postMessage({ type: "PRECACHE_ROUTES" });
  }).catch(() => undefined);
}

export function installOfflineRuntime(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => undefined;
  registerServiceWorker();
  let auth = loadAuthState();
  let currentMerchantId = merchantIdFromState(auth);
  restoreOfflineQueries(queryClient, currentMerchantId);

  const persist = () => {
    const current = loadAuthState();
    const merchantId = merchantIdFromState(current);
    if (merchantId) persistOfflineQueries(queryClient, merchantId);
  };
  const cacheSubscription = queryClient.getQueryCache().subscribe(persist);

  const syncCurrentUser = (retryBlocked = false) => {
    const current = loadAuthState();
    const merchantId = merchantIdFromState(current);
    if (!merchantId || !current.token) return;
    void flushOutbox(merchantId, current.token, { retryBlocked }).then((result) => {
      if (result.syncedKinds.length > 0) invalidateSyncedQueries(queryClient, result.syncedKinds);
    });
  };

  const onAuthChanged = () => {
    const next = loadAuthState();
    const nextMerchantId = merchantIdFromState(next);
    if (nextMerchantId !== currentMerchantId || next.role !== auth.role) {
      queryClient.clear();
      restoreOfflineQueries(queryClient, nextMerchantId);
    }
    currentMerchantId = nextMerchantId;
    auth = next;
    syncCurrentUser(!!nextMerchantId && !!next.token);
  };

  const onQueueChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ merchantId?: number }>).detail;
    if (detail?.merchantId !== currentMerchantId) return;
    invalidateSyncedQueries(queryClient, ["sale", "scrap"]);
  };

  const onSynced = (event: Event) => {
    const detail = (event as CustomEvent<OfflineSyncedDetail>).detail;
    if (detail?.kind) invalidateSyncedQueries(queryClient, [detail.kind]);
  };

  const onOnline = () => syncCurrentUser(false);
  window.addEventListener(OFFLINE_AUTH_CHANGED_EVENT, onAuthChanged);
  window.addEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
  window.addEventListener(OFFLINE_SYNCED_EVENT, onSynced);
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(() => syncCurrentUser(false), 60_000);
  syncCurrentUser(false);

  return () => {
    cacheSubscription();
    window.removeEventListener(OFFLINE_AUTH_CHANGED_EVENT, onAuthChanged);
    window.removeEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
    window.removeEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}
