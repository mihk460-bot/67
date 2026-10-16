import { recordSale, type SaleRow } from "@/lib/logs.functions";
import { issueScrapReceipt } from "@/lib/scrap.functions";
import { computeSettlement } from "@/lib/scrap/calc";
import { DEFAULT_CURRENCY } from "@/lib/scrap/config";
import type { IssueScrapReceiptInput, SettlementReceipt } from "@/lib/scrap/receipts";
import type { InvoiceData } from "@/lib/invoice";
import {
  OFFLINE_MAX_QUEUED_OPERATIONS,
  OFFLINE_OUTBOX_CHANGED_EVENT,
  OFFLINE_OUTBOX_STORAGE_PREFIX,
  OFFLINE_SYNCED_EVENT,
  type OfflineBlockCode,
  type OfflineOperationKind,
} from "./config";

interface OperationBase {
  version: 1;
  id: string;
  merchantId: number;
  kind: OfflineOperationKind;
  createdAt: string;
  status: "pending" | "blocked";
  blockCode?: OfflineBlockCode;
  lastError?: string;
}

export interface QueuedSale extends OperationBase {
  kind: "sale";
  invoice: InvoiceData;
}

export interface QueuedScrap extends OperationBase {
  kind: "scrap";
  input: IssueScrapReceiptInput;
  receipt: SettlementReceipt;
}

export type QueuedOperation = QueuedSale | QueuedScrap;

export type OfflineSyncedDetail =
  | { kind: "sale"; requestId: string; invoiceNumber: string; createdAt: string }
  | { kind: "scrap"; requestId: string; receipt: SettlementReceipt };

export interface OutboxStats {
  pending: number;
  blocked: number;
  migrationRequired: boolean;
  authRequired: boolean;
  unavailable: boolean;
}

export interface FlushResult {
  syncedCount: number;
  syncedKinds: OfflineOperationKind[];
  paused: boolean;
  offline: boolean;
  unavailable: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (!cryptoApi?.getRandomValues) throw new Error("هذا المتصفح لا يدعم إنشاء معرف آمن للمعاملة");
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}

function storageKey(merchantId: number): string {
  return OFFLINE_OUTBOX_STORAGE_PREFIX + String(merchantId);
}

function isQueuedOperation(value: unknown, merchantId: number): value is QueuedOperation {
  if (!isRecord(value)) return false;
  if (value["version"] !== 1 || value["merchantId"] !== merchantId || !isUuid(value["id"])) return false;
  if (value["status"] !== "pending" && value["status"] !== "blocked") return false;
  if (typeof value["createdAt"] !== "string" || !Number.isFinite(Date.parse(value["createdAt"]))) return false;
  if (value["kind"] === "sale") return isRecord(value["invoice"]);
  if (value["kind"] === "scrap") return isRecord(value["input"]) && isRecord(value["receipt"]);
  return false;
}

function readQueue(merchantId: number): QueuedOperation[] {
  if (typeof window === "undefined") throw new Error("لا يتوفر التخزين المحلي في هذا السياق");
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(merchantId));
  } catch {
    throw new Error("تعذرت قراءة طابور العمليات من هذا الجهاز");
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("تعذر قراءة بيانات الطابور؛ لم تُحذف أي عملية");
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => isQueuedOperation(item, merchantId))) {
    throw new Error("بيانات طابور العمليات غير سليمة؛ أوقفنا المزامنة لحماية المعاملات");
  }
  return parsed as QueuedOperation[];
}

function announceQueueChanged(merchantId: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_OUTBOX_CHANGED_EVENT, { detail: { merchantId } }));
}

function writeQueue(merchantId: number, operations: QueuedOperation[]) {
  if (typeof window === "undefined") throw new Error("لا يتوفر التخزين المحلي في هذا السياق");
  const key = storageKey(merchantId);
  try {
    if (operations.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(operations));
  } catch {
    throw new Error("تعذر حفظ العملية على هذا الجهاز؛ لم يتم تأكيد إصدارها");
  }
  announceQueueChanged(merchantId);
}

function updateOperation(merchantId: number, id: string, update: (operation: QueuedOperation) => QueuedOperation) {
  const operations = readQueue(merchantId);
  const index = operations.findIndex((operation) => operation.id === id);
  if (index < 0) return;
  const next = operations.slice();
  next[index] = update(next[index]!);
  writeQueue(merchantId, next);
}

function removeOperation(merchantId: number, id: string) {
  const operations = readQueue(merchantId);
  writeQueue(merchantId, operations.filter((operation) => operation.id !== id));
}

function assertCanQueue(merchantId: number, requestId: string) {
  if (!Number.isSafeInteger(merchantId) || merchantId <= 0) throw new Error("تعذر تحديد حساب التاجر للعملية");
  if (!isUuid(requestId)) throw new Error("معرف العملية غير صالح");
}

export function enqueueSaleOperation(merchantId: number, requestId: string, invoice: InvoiceData): QueuedSale {
  assertCanQueue(merchantId, requestId);
  const operations = readQueue(merchantId);
  const existing = operations.find((operation) => operation.id === requestId);
  if (existing) {
    if (existing.kind !== "sale") throw new Error("معرف العملية مستخدم لنوع آخر؛ لم يتم استبدال البيانات");
    return existing;
  }
  if (operations.length >= OFFLINE_MAX_QUEUED_OPERATIONS) throw new Error("وصل طابور العمليات إلى الحد المسموح؛ أعد الاتصال والمزامنة أولاً");
  const savedInvoice = { ...invoice };
  delete savedInvoice.syncStatus;
  delete savedInvoice.offlineRequestId;
  const operation: QueuedSale = {
    version: 1, id: requestId, merchantId, kind: "sale", createdAt: new Date().toISOString(),
    status: "pending", invoice: savedInvoice,
  };
  writeQueue(merchantId, [...operations, operation]);
  return operation;
}

export function createPendingScrapReceipt(
  merchantId: number,
  requestId: string,
  input: IssueScrapReceiptInput,
  shopName: string,
  employeeName: string,
): SettlementReceipt {
  const evaluation = computeSettlement({
    received: input.received, delivered: input.delivered, target: input.target,
    ratePerGram: input.ratePerGram, cashPaid: input.cashPaid,
  });
  if (evaluation.errors.length > 0 || !evaluation.hasData) throw new Error(evaluation.errors[0] ?? "أدخل بنداً واحداً على الأقل");
  return {
    ...evaluation.totals,
    id: "local-" + requestId,
    serial: "PEND-" + requestId.slice(0, 8).toUpperCase(),
    shopId: String(merchantId),
    shopName: shopName || "المحل — بانتظار المزامنة",
    employeeName: employeeName || "—",
    customerName: input.customerName.trim() || null,
    notes: input.notes.trim() || null,
    metal: input.metal,
    targetShares: input.target,
    currency: DEFAULT_CURRENCY,
    createdAt: new Date().toISOString(),
    timeZone: input.timeZone,
    received: evaluation.received,
    delivered: evaluation.delivered,
    offlineRequestId: requestId,
    syncStatus: "pending",
  };
}

export function enqueueScrapOperation(
  merchantId: number,
  requestId: string,
  input: IssueScrapReceiptInput,
  shopName: string,
  employeeName: string,
): QueuedScrap {
  assertCanQueue(merchantId, requestId);
  const operations = readQueue(merchantId);
  const existing = operations.find((operation) => operation.id === requestId);
  if (existing) {
    if (existing.kind !== "scrap") throw new Error("معرف العملية مستخدم لنوع آخر؛ لم يتم استبدال البيانات");
    return existing;
  }
  if (operations.length >= OFFLINE_MAX_QUEUED_OPERATIONS) throw new Error("وصل طابور العمليات إلى الحد المسموح؛ أعد الاتصال والمزامنة أولاً");
  const receipt = createPendingScrapReceipt(merchantId, requestId, input, shopName, employeeName);
  const operation: QueuedScrap = {
    version: 1, id: requestId, merchantId, kind: "scrap", createdAt: receipt.createdAt,
    status: "pending", input: { ...input }, receipt,
  };
  writeQueue(merchantId, [...operations, operation]);
  return operation;
}

export function getOutboxStats(merchantId: number | undefined): OutboxStats {
  if (!merchantId || !Number.isSafeInteger(merchantId) || merchantId <= 0) {
    return { pending: 0, blocked: 0, migrationRequired: false, authRequired: false, unavailable: false };
  }
  try {
    const operations = readQueue(merchantId);
    return {
      pending: operations.filter((operation) => operation.status === "pending").length,
      blocked: operations.filter((operation) => operation.status === "blocked").length,
      migrationRequired: operations.some((operation) => operation.blockCode === "migration_required"),
      authRequired: operations.some((operation) => operation.blockCode === "auth_required"),
      unavailable: false,
    };
  } catch {
    return { pending: 0, blocked: 0, migrationRequired: false, authRequired: false, unavailable: true };
  }
}

export function getQueuedScrapReceipts(merchantId: number | undefined): SettlementReceipt[] {
  if (!merchantId || !Number.isSafeInteger(merchantId) || merchantId <= 0) return [];
  try {
    return readQueue(merchantId).filter((operation): operation is QueuedScrap => operation.kind === "scrap")
      .map((operation) => ({
        ...operation.receipt,
        syncStatus: operation.status === "blocked" ? "blocked" : "pending",
        offlineRequestId: operation.id,
      }));
  } catch {
    return [];
  }
}

export function getQueuedSales(merchantId: number | undefined): SaleRow[] {
  if (!merchantId || !Number.isSafeInteger(merchantId) || merchantId <= 0) return [];
  try {
    return readQueue(merchantId).filter((operation): operation is QueuedSale => operation.kind === "sale")
      .map((operation) => {
        const invoiceNumber = operation.invoice.invoiceNumber || "PEND-" + operation.id.slice(0, 8).toUpperCase();
        const invoice: InvoiceData = {
          ...operation.invoice,
          invoiceNumber,
          syncStatus: operation.status === "blocked" ? "blocked" : "pending",
          offlineRequestId: operation.id,
        };
        return {
          id: "local-" + operation.id,
          invoiceNumber,
          employeeId: operation.merchantId,
          employeeName: operation.invoice.issuedBy || "—",
          metal: operation.invoice.metal,
          karat: operation.invoice.karat,
          side: operation.invoice.side,
          weight: operation.invoice.weight,
          total: operation.invoice.finalTotal,
          invoice: invoice as unknown as SaleRow["invoice"],
          createdAt: operation.invoice.issuedAt,
          offlineRequestId: operation.id,
          syncStatus: operation.status,
        };
      });
  } catch {
    return [];
  }
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch failed|load failed|connection|offline/i.test(message);
}

function toBlockCode(code: string | undefined): OfflineBlockCode {
  if (code === "offline_migration_required") return "migration_required";
  if (code === "auth_required") return "auth_required";
  return "server_rejected";
}

async function runFlushOutbox(
  merchantId: number,
  token: string,
  options: { retryBlocked?: boolean } = {},
): Promise<FlushResult> {
  if (!Number.isSafeInteger(merchantId) || merchantId <= 0 || !token) {
    return { syncedCount: 0, syncedKinds: [], paused: true, offline: false, unavailable: false };
  }
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return { syncedCount: 0, syncedKinds: [], paused: false, offline: true, unavailable: false };
  }

  let operations: QueuedOperation[];
  try {
    operations = readQueue(merchantId);
  } catch {
    return { syncedCount: 0, syncedKinds: [], paused: true, offline: false, unavailable: true };
  }
  const candidates = operations.filter((operation) => operation.status === "pending" || options.retryBlocked === true);
  const syncedKinds = new Set<OfflineOperationKind>();
  let syncedCount = 0;

  for (const operation of candidates) {
    let result: Awaited<ReturnType<typeof recordSale>> | Awaited<ReturnType<typeof issueScrapReceipt>>;
    try {
      if (operation.kind === "sale") {
        const invoice = { ...operation.invoice };
        delete invoice.syncStatus;
        delete invoice.offlineRequestId;
        result = await recordSale({ data: { token, clientRequestId: operation.id, expectedMerchantId: operation.merchantId, invoice } });
      } else {
        result = await issueScrapReceipt({ data: { token, clientRequestId: operation.id, expectedMerchantId: operation.merchantId, ...operation.input } });
      }
    } catch {
      return { syncedCount, syncedKinds: [...syncedKinds], paused: true, offline: false, unavailable: false };
    }

    if (!result.ok) {
      try {
        updateOperation(merchantId, operation.id, (current) => ({
          ...current,
          status: "blocked",
          blockCode: toBlockCode(result.code),
          lastError: result.message,
        }));
      } catch {
        // Keep the original durable entry; retrying remains safe because the request id is stable.
      }
      return { syncedCount, syncedKinds: [...syncedKinds], paused: true, offline: false, unavailable: false };
    }

    let detail: OfflineSyncedDetail;
    if (operation.kind === "sale" && "invoiceNumber" in result) {
      detail = { kind: "sale", requestId: operation.id, invoiceNumber: result.invoiceNumber, createdAt: result.createdAt };
    } else if (operation.kind === "scrap" && "receipt" in result) {
      detail = { kind: "scrap", requestId: operation.id, receipt: result.receipt };
    } else {
      return { syncedCount, syncedKinds: [...syncedKinds], paused: true, offline: false, unavailable: false };
    }

    try {
      removeOperation(merchantId, operation.id);
    } catch {
      try {
        updateOperation(merchantId, operation.id, (current) => ({
          ...current, status: "blocked", blockCode: "storage_error",
          lastError: "حُفظت العملية في الخادم، لكن تعذّر تحديث الطابور المحلي؛ ستتم إعادة التحقق بأمان عند المحاولة التالية",
        }));
      } catch {
        // The server idempotency key makes a later retry safe even if local cleanup failed.
      }
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OFFLINE_SYNCED_EVENT, { detail }));
    syncedKinds.add(operation.kind);
    syncedCount += 1;
  }

  return { syncedCount, syncedKinds: [...syncedKinds], paused: false, offline: false, unavailable: false };
}


const activeFlushes = new Map<number, Promise<FlushResult>>();

export function flushOutbox(
  merchantId: number,
  token: string,
  options: { retryBlocked?: boolean } = {},
): Promise<FlushResult> {
  const active = activeFlushes.get(merchantId);
  if (active) return active;
  const current = runFlushOutbox(merchantId, token, options);
  activeFlushes.set(merchantId, current);
  return current.finally(() => {
    if (activeFlushes.get(merchantId) === current) activeFlushes.delete(merchantId);
  });
}
