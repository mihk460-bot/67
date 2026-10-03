import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { getPublicPrices } from "@/lib/app.functions";
import { logout, useRequireRole } from "@/lib/auth-client";
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
