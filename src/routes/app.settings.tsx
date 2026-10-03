import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Loader2, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { createEmployee, getMerchantTeam } from "@/lib/app.functions";
import { useRequireRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/settings")({
  component: MerchantSettingsPage,
});

function MerchantSettingsPage() {
  useRequireRole("merchant");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [pending, setPending] = useState(false);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ["merchant-team"],
    queryFn: () => getMerchantTeam({ data: { token: tokenOf() } }),
    enabled: true,
  });

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/app", replace: true })}
          className="flex size-10 items-center justify-center rounded-full bg-card"
          aria-label="إغلاق"
        >
          <ArrowRight className="size-5 text-foreground" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Notifications note (in-app delivery on web) */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <Bell className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">الإشعارات</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              تصلك تنبيهات تغير أسعار الذهب والفضة داخل التطبيق
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate({ to: "/app/notifications" })}>
            عرض
          </Button>
        </div>

        {/* Employees */}
        <div className="space-y-3.5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">حسابات الموظفين</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {team?.total ?? 0} من {team?.limit ?? 2} حسابين مستخدمين
              </p>
            </div>
            <Users className="size-6 text-primary" />
          </div>

          {teamLoading ? <Loader2 className="size-5 animate-spin text-primary" /> : null}

          {team?.employees.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center justify-between rounded-xl bg-background p-3"
            >
              <span className="font-medium text-foreground">{employee.username}</span>
              <span className={`text-xs ${employee.isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                {employee.isExpired ? "منتهي" : "نشط"}
              </span>
            </div>
          ))}

          {team?.canManage && (team.total ?? 0) < (team.limit ?? 2) ? (
            <Button variant="secondary" className="w-full py-3 font-semibold" onClick={() => setModalOpen(true)}>
              إضافة حساب موظف
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-t-3xl bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start text-lg font-bold text-foreground">
              حساب موظف جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="emp-username" className="text-start">
                اسم المستخدم
              </Label>
              <Input
                id="emp-username"
                value={employeeUsername}
                onChange={(e) => setEmployeeUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-password" className="text-start">
                كلمة المرور
              </Label>
              <Input
                id="emp-password"
                type="password"
                value={employeePassword}
                onChange={(e) => setEmployeePassword(e.target.value)}
              />
            </div>
            <Button
              className="h-12 w-full font-bold"
              disabled={pending}
              onClick={async () => {
                if (!employeeUsername.trim() || employeePassword.length < 6) {
                  toast.error("أدخل اسم المستخدم وكلمة مرور من 6 أحرف على الأقل");
                  return;
                }
                setPending(true);
                try {
                  const res = await createEmployee({
                    data: { token: tokenOf(), username: employeeUsername.trim(), password: employeePassword },
                  });
                  if (res.ok) {
                    await queryClient.invalidateQueries({ queryKey: ["merchant-team"] });
                    setEmployeeUsername("");
                    setEmployeePassword("");
                    setModalOpen(false);
                    toast.success("تم إنشاء حساب الموظف");
                  } else {
                    toast.error(res.message);
                  }
                } catch {
                  toast.error("تعذر إنشاء حساب الموظف");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? <Loader2 className="animate-spin" /> : "إنشاء الحساب"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function tokenOf(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("jewelry_auth_state");
    return raw ? (JSON.parse(raw).token ?? "") : "";
  } catch {
    return "";
  }
}

// re-export to satisfy lint about unused import X
void X;
