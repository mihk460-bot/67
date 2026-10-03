import { Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { logout, useRequireRole } from "@/lib/auth-client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const state = useRequireRole("admin");
  const navigate = useNavigate();

  if (!state?.token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-4">
          <span className="text-lg font-bold text-primary">لوحة الإدارة</span>
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
        <nav className="mx-auto flex w-full max-w-xl gap-1 px-4 pb-2">
          {[
            { to: "/admin", label: "الأسعار والإعدادات" },
            { to: "/admin/merchants", label: "التجار" },
            { to: "/admin/notifications", label: "الإشعارات" },
          ].map((tab) => (
            <button
              key={tab.to}
              type="button"
              onClick={() => navigate({ to: tab.to })}
              className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
