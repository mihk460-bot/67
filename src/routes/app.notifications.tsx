import { useEffect, useState } from "react";
import { pageHead } from "@/lib/page-head";
import { Linkify } from "@/components/Linkify";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell } from "lucide-react";
import { getNotifications } from "@/lib/app.functions";
import { useRequireRole } from "@/lib/auth-client";

export const Route = createFileRoute("/app/notifications")({
  head: () => pageHead("إشعارات التاجر", "إشعارات الأسعار وأخبار الذهب والفضة للتجار"),
  component: NotificationsPage,
});

function NotificationsPage() {
  useRequireRole("merchant");
  const navigate = useNavigate();
  const token = readToken();

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-notifications"],
    queryFn: () => getNotifications({ data: { token } }),
    refetchInterval: 60_000,
  });

  const [lastSeen, setLastSeen] = useState<number>(0);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem("jewelry_last_seen_notification") || "0");
      setLastSeen(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const notifications = data?.ok ? data.notifications : [];

  useEffect(() => {
    if (notifications.length > 0) {
      try {
        window.localStorage.setItem(
          "jewelry_last_seen_notification",
          String(notifications[0]?.id ?? ""),
        );
      } catch {
        /* ignore */
      }
    }
  }, [notifications]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">الإشعارات</h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/app", replace: true })}
          className="flex size-10 items-center justify-center rounded-full bg-card"
          aria-label="رجوع"
        >
          <ArrowRight className="size-5 text-foreground" />
        </button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bell className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">لا توجد إشعارات حتى الآن</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isNew = n.id > lastSeen;
            return (
              <article
                key={n.id}
                className="rounded-2xl border border-border bg-card p-5"
                style={isNew ? { borderColor: "var(--primary)" } : undefined}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 className="font-bold text-foreground">{n.title}</h2>
                  {isNew ? <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">جديد</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"><Linkify text={n.body} /></p>
                <p className="num mt-3 text-xs text-muted-foreground/70">
                  {new Date(n.createdAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("jewelry_auth_state");
    return raw ? (JSON.parse(raw).token ?? "") : "";
  } catch {
    return "";
  }
}
