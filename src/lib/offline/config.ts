export const OFFLINE_OUTBOX_STORAGE_PREFIX = "huggy.offline.outbox.v1:";
export const OFFLINE_QUERY_STORAGE_PREFIX = "huggy.offline.queries.v1:";
export const OFFLINE_AUTH_CHANGED_EVENT = "huggy:offline-auth-changed";
export const OFFLINE_OUTBOX_CHANGED_EVENT = "huggy:offline-outbox-changed";
export const OFFLINE_SYNCED_EVENT = "huggy:offline-synced";
export const OFFLINE_MAX_QUEUED_OPERATIONS = 100;

export type OfflineOperationKind = "sale" | "scrap";
export type OfflineBlockCode = "migration_required" | "auth_required" | "server_rejected" | "storage_error";
