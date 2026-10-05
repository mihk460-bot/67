import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Headset, Link2, LogOut, MessageCircle, Phone, Settings } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createFileRoute } from "@tanstack/react-router";
import { getMerchantMe, getPublicPrices } from "@/lib/app.functions";
import { logout, readToken, useRequireRole } from "@/lib/auth-client";
import { Logo } from "@/components/logo";

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
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const contacts = prices?.supportContacts ?? [];
  const isOwner = !!me && me.ok && !me.isEmployee;

  if (!state?.token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
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
            {isOwner ? (
              <Link to="/app/settings" className="p-2 text-foreground" aria-label="الإعدادات">
                <Settings className="size-5" />
              </Link>
            ) : null}
            {contacts.length > 0 ? (
              <button
                type="button"
                className="p-2 text-primary"
                aria-label="الدعم"
                onClick={() => setSupportOpen(true)}
              >
                <Headset className="size-5" />
              </button>
            ) : null}
            <Link to="/app/notifications" className="p-2 text-foreground" aria-label="الإشعارات">
              <Bell className="size-5" />
            </Link>
            <button
              type="button"
              className="p-2 text-foreground"
              aria-label="تسجيل الخروج"
              onClick={() => {
                logout();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start text-lg font-bold text-foreground">تواصل مع الدعم</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            {contacts.map((c, i) => {
              const href = contactHref(c.type, c.value);
              const Icon = c.type === "phone" ? Phone : c.type === "whatsapp" ? MessageCircle : Link2;
              return (
                <a
                  key={i}
                  href={href}
                  target={c.type === "phone" ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Icon className="size-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{c.value}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
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
