import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readToken } from "@/lib/auth-client";
import { OFFLINE_OUTBOX_CHANGED_EVENT } from "@/lib/offline/config";
import { flushOutbox, getOutboxStats, type OutboxStats } from "@/lib/offline/outbox";

export function OfflineStatusBar({ merchantId }: { merchantId?: number }) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<OutboxStats>(() => getOutboxStats(merchantId));

  useEffect(() => {
    const refresh = () => setStats(getOutboxStats(merchantId));
    const updateNetwork = () => setOnline(navigator.onLine);
    const onQueueChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ merchantId?: number }>).detail;
      if (detail?.merchantId === merchantId) refresh();
    };
    updateNetwork();
    refresh();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    window.addEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
      window.removeEventListener(OFFLINE_OUTBOX_CHANGED_EVENT, onQueueChanged);
    };
  }, [merchantId]);

  async function syncNow() {
    if (!merchantId || !online || syncing) return;
    setSyncing(true);
    try {
      const result = await flushOutbox(merchantId, readToken(), { retryBlocked: true });
      if (result.syncedKinds.includes("sale")) {
        await queryClient.invalidateQueries({ queryKey: ["sales-log"] });
        await queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      }
      if (result.syncedKinds.includes("scrap")) {
        await queryClient.invalidateQueries({ queryKey: ["scrap", "receipts"] });
      }
    } finally {
      setSyncing(false);
      setStats(getOutboxStats(merchantId));
    }
  }

  if (stats.pending === 0 && stats.blocked === 0 && online && !stats.unavailable) return null;

  return (
    <section role="status" aria-live="polite" className="border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {!online ? <CloudOff className="mt-0.5 size-4 shrink-0" /> : null}
          <div>
            {!online ? <p className="font-semibold">غير متصل بالإنترنت؛ يعرض التطبيق آخر بيانات محفوظة.</p> : null}
            {stats.pending > 0 ? <p>{stats.pending} عملية بانتظار المزامنة.</p> : null}
            {stats.blocked > 0 ? <p>{stats.blocked} عملية لم تُقبل بعد؛ بقيت محفوظة على هذا الجهاز.</p> : null}
            {stats.migrationRequired ? <p className="text-xs">تطبيق ترحيل 0003_offline_idempotency.sql على قاعدة البيانات مطلوب قبل مزامنة الطابور.</p> : null}
            {stats.authRequired ? <p className="text-xs">أعد تسجيل الدخول إلى الحساب نفسه ثم أعد المحاولة.</p> : null}
            {stats.unavailable ? <p className="text-xs text-destructive">تعذر قراءة الطابور المحلي؛ لم نحذف بياناته ولم نبدأ المزامنة.</p> : null}
          </div>
        </div>
        {(stats.pending > 0 || stats.blocked > 0) ? (
          <Button type="button" size="sm" variant="outline" disabled={!online || syncing || stats.unavailable} onClick={() => void syncNow()}>
            <RefreshCw className={syncing ? "me-2 size-4 animate-spin" : "me-2 size-4"} />
            {syncing ? "جارٍ المزامنة" : "مزامنة الآن"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
