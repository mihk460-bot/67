import type { QueryClient } from "@tanstack/react-query";
import { OFFLINE_QUERY_STORAGE_PREFIX } from "./config";

interface PersistedQuery {
  queryKey: unknown[];
  data: unknown;
  updatedAt: number;
}

function storageKey(merchantId: number): string {
  return OFFLINE_QUERY_STORAGE_PREFIX + String(merchantId);
}

function isAllowedQueryKey(key: readonly unknown[]): boolean {
  const root = key[0];
  if (root === "public-prices" || root === "merchant-me" || root === "sales-log" || root === "sales-report") return true;
  return root === "scrap" && key[1] === "receipts";
}

function isPersistedQuery(value: unknown): value is PersistedQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate["queryKey"]) && isAllowedQueryKey(candidate["queryKey"] as unknown[]) &&
    typeof candidate["updatedAt"] === "number" && "data" in candidate;
}

export function persistOfflineQueries(queryClient: QueryClient, merchantId: number) {
  if (typeof window === "undefined" || !Number.isSafeInteger(merchantId) || merchantId <= 0) return;
  const queries: PersistedQuery[] = queryClient.getQueryCache().getAll()
    .filter((query) => query.state.status === "success" && query.state.data !== undefined && isAllowedQueryKey(query.queryKey))
    .slice(-100)
    .map((query) => ({ queryKey: [...query.queryKey], data: query.state.data, updatedAt: query.state.dataUpdatedAt }));
  try {
    const serialized = JSON.stringify(queries);
    if (serialized.length > 1_500_000) return;
    window.localStorage.setItem(storageKey(merchantId), serialized);
  } catch {
    // Offline reads are best-effort; queued writes have their own explicit error path.
  }
}

export function restoreOfflineQueries(queryClient: QueryClient, merchantId: number | undefined) {
  if (typeof window === "undefined" || !merchantId || !Number.isSafeInteger(merchantId) || merchantId <= 0) return;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(merchantId));
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (!isPersistedQuery(entry)) continue;
      queryClient.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.updatedAt });
    }
  } catch {
    // Ignore unreadable cached queries; the server remains the source of truth.
  }
}
