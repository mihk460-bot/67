import { ContactLink } from "@/components/ContactLink";
import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, Headset, LockKeyhole, LogOut, Scale, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { getMerchantMe, getPublicPrices } from "@/lib/app.functions";
import { logout, readToken, useRequireRole } from "@/lib/auth-client";
import { Logo } from "@/components/logo";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { getSubscriptionExpiry } from "@/lib/subscription";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { getOutboxStats } from "@/lib/offline/outbox";

export const Route = createFileRoute("/app")({
  component: MerchantLayout,
});

function MerchantLayout() {
  const state = useRequireRole("merchant");
  const navigate = useNavigate();
  const { data: prices } = useQuery({
    queryKey: ["public-prices"],
    queryFn: () => getPublicPrices(),
    refetchInterval: 60_000,
  });

  const { data: me } = useQuery({
    queryKey: ["merchant-me"],
    queryFn: () => getMerchantMe({ data: { token: readToken() } }),
    enabled: !!state?.token,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const contacts = prices?.supportContacts ?? [];
  const isOwner = !!me && me.ok && !me.isEmployee;
  const expiry = me?.ok ? getSubscriptionExpiry(me.expiresAt) : null;
  const subscriptionExpired = !!me?.ok && !me.subscriptionActive;
  const expiringSoon = !!me?.ok && me.subscriptionActive && !!expiry?.expiringSoon;

  if (!state?.token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        {expiringSoon ? (
          <div role="alert" className="w-full border-b border-primary/40 bg-primary/15 px-4 py-3 text-foreground">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold leading-relaxed">
                تنبيه: اشتراكك ينتهي خلال {expiry.daysRemaining} أيام. لتجنب توقف الخدمة تواصل مع الإدارة لتجديد الاشتراك
              </p>
              <div className="w-full shrink-0 sm:w-72">
                <WhatsAppSupportButton
                  contacts={contacts}
                  supportContact={prices?.supportContact}
                  supportContactType={prices?.supportContactType}
                  storeName={me?.ok ? me.storeName : ""}
                  purpose="renewal"
                  size="card"
                />
              </div>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-lg font-bold text-primary">حاسبة الصاغة</span>
          </div>
          <div className="flex items-center gap-1.5">
            {prices?.displayCounter != null && prices.displayCounter > 0 ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5">
                <UsersIcon />
                <span className="num text-xs font-semibold text-foreground">
                  {prices.displayCounter}
                </span>
              </div>
            ) : null}
            <a href="/app/scrap-calculator" className="p-2 text-foreground" aria-label="حاسبة الكسر والربط" title="حاسبة الكسر والربط">
              <Scale className="size-5" />
            </a>
            <Link to="/app/sales-log" className="p-2 text-foreground" aria-label="سجل المبيعات والعمليات" title="سجل المبيعات والعمليات">
              <ClipboardList className="size-5" />
            </Link>
            {isOwner ? (
              <Link to="/app/settings" className="p-2 text-foreground" aria-label="الإعدادات">
                <Settings className="size-5" />
              </Link>
            ) : null}
            {contacts.length > 0 || prices?.supportContact ? (
              <Button variant="ghost" size="icon"
                type="button"
                className="p-2 text-primary"
                aria-label="الدعم"
                onClick={() => setSupportOpen(true)}
              >
                <Headset className="size-5" />
              </Button>
            ) : null}
            <Link to="/app/notifications" className="p-2 text-foreground" aria-label="الإشعارات">
              <Bell className="size-5" />
            </Link>
            <button
              type="button"
              className="p-2 text-foreground"
              aria-label="تسجيل الخروج"
              onClick={() => {
                const stats = getOutboxStats(state?.merchantId);
                const count = stats.pending + stats.blocked;
                if (stats.unavailable && !window.confirm("تعذر قراءة الطابور المحلي. قد توجد عمليات معلقة محفوظة على هذا الجهاز. هل تريد تسجيل الخروج رغم ذلك؟")) return;
                if (count > 0 && !window.confirm("لديك " + String(count) + " عملية غير متزامنة. ستبقى محفوظة على هذا الجهاز ولن تُرسل إلا بعد تسجيل الدخول إلى الحساب نفسه. هل تريد المتابعة؟")) return;
                logout();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
        {contacts.length > 0 || prices?.supportContact ? (
          <div className="mx-auto w-full max-w-lg px-4 pb-3">
            <WhatsAppSupportButton
              contacts={contacts}
              supportContact={prices?.supportContact}
              supportContactType={prices?.supportContactType}
              storeName={me?.ok ? me.storeName : ""}
              size="compact"
            />
          </div>
        ) : null}
      </header>
      <OfflineStatusBar {...(state?.merchantId ? { merchantId: state.merchantId } : {})} />
      <Outlet />
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start text-lg font-bold text-foreground">تواصل مع الدعم</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            {contacts.map((contact, i) => <ContactLink key={i} {...contact} />)}
            {prices?.supportContact ? <ContactLink label="تحديث الاشتراك" value={prices.supportContact} type={prices.supportContactType as "phone" | "link" | "text"} /> : null}
          </div>
        </DialogContent>
      </Dialog>
      {subscriptionExpired ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-lock-title"
        >
          <section className="my-auto w-full max-w-xl space-y-6 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl sm:p-10">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
              <LockKeyhole className="size-10" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <h1 id="subscription-lock-title" className="text-3xl font-extrabold leading-relaxed text-foreground sm:text-4xl">
                عفواً، انتهت فترة اشتراك المحل
              </h1>
              <p className="text-lg leading-8 text-muted-foreground sm:text-xl">
                يرجى التواصل مع إدارة المنصة لتجديد اشتراكك واستعادة الوصول الكامل للخدمات.
              </p>
            </div>
            <WhatsAppSupportButton
              contacts={contacts}
              supportContact={prices?.supportContact}
              supportContactType={prices?.supportContactType}
              storeName={me?.ok ? me.storeName : ""}
              purpose="renewal"
              size="large"
            />
            {contacts.length > 0 || prices?.supportContact ? (
              <div className="space-y-2 text-start">
                <p className="text-sm font-semibold text-muted-foreground">قنوات التواصل المتاحة:</p>
                {contacts.map((contact, index) => <ContactLink key={`lock-${index}`} {...contact} />)}
                {prices?.supportContact ? (
                  <ContactLink
                    label="تواصل مع الإدارة"
                    value={prices.supportContact}
                    type={prices.supportContactType as "phone" | "link" | "text"}
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لم تُضف الإدارة بيانات تواصل للدعم حتى الآن.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-primary">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
