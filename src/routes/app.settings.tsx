import { useEffect, useState } from "react";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { createEmployee, deleteEmployee, getMerchantMe, getMerchantTeam, setEmployeeActive, updateStoreName, getPublicPrices } from "@/lib/app.functions";
import { ContactLink } from "@/components/ContactLink";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import { useRequireRole, readToken } from "@/lib/auth-client";
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
  head: () => pageHead("إعدادات المحل", "إدارة اسم المحل وحسابات الموظفين والتواصل مع الدعم لتجديد الاشتراك"),
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
  const [storeName, setStoreName] = useState("");
  const [savingStore, setSavingStore] = useState(false);
  const { data: publicSettings } = useQuery({ queryKey: ["public-prices"], queryFn: () => getPublicPrices() });

  const { data: teamRaw, isLoading: teamLoading } = useQuery({
    queryKey: ["merchant-team"],
    queryFn: () => getMerchantTeam({ data: { token: readToken() } }),
    enabled: true,
  });
  const team = teamRaw && teamRaw.ok ? teamRaw : undefined;
  const { data: me } = useQuery({
    queryKey: ["merchant-me"],
    queryFn: () => getMerchantMe({ data: { token: readToken() } }),
  });
  const isEmployee = !!me && me.ok && me.isEmployee;
  useEffect(() => { if (me?.ok) setStoreName(me.storeName); }, [me]);
  useEffect(() => {
    if (isEmployee) navigate({ to: "/app", replace: true });
  }, [isEmployee, navigate]);
  if (isEmployee) return null;

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
        <form className="space-y-3 border-b border-border pb-6" onSubmit={async (event) => {
          event.preventDefault(); if (savingStore || !storeName.trim()) return;
          setSavingStore(true);
          try {
            const result = await updateStoreName({ data: { token: readToken(), storeName } });
            if (result.ok) { await queryClient.invalidateQueries({ queryKey: ["merchant-me"] }); toast.success("تم حفظ اسم المحل"); }
            else toast.error(result.message);
          } catch { toast.error("تعذر حفظ اسم المحل"); } finally { setSavingStore(false); }
        }}>
          <Label htmlFor="store-name">اسم المحل</Label>
          <Input id="store-name" maxLength={100} required disabled={!me?.ok || savingStore} value={storeName} onChange={(event) => setStoreName(event.target.value)} />
          <Button type="submit" disabled={savingStore || !me?.ok || !storeName.trim()}>{savingStore ? <Loader2 className="animate-spin" /> : null}حفظ اسم المحل</Button>
        </form>
        {publicSettings && (publicSettings.supportContacts.length > 0 || publicSettings.supportContact) ? <section className="space-y-3 border-b border-border pb-6">
          <h2 className="font-semibold">التواصل مع الدعم وتحديث الاشتراك</h2>
          <WhatsAppSupportButton
            contacts={publicSettings.supportContacts}
            supportContact={publicSettings.supportContact}
            supportContactType={publicSettings.supportContactType}
            storeName={me?.ok ? me.storeName : storeName}
            size="large"
          />
          {publicSettings.supportContacts.map((contact, i) => <ContactLink key={i} {...contact} />)}
          {publicSettings.supportContact ? <ContactLink type={publicSettings.supportContactType as "phone" | "link" | "text"} value={publicSettings.supportContact} label="تحديث الاشتراك" /> : null}
        </section> : null}
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

          {team && !team.ownerActive ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
              اشتراكك منتهي، لذلك حسابات الموظفين متوقفة حتى التجديد
            </p>
          ) : null}

          {team?.employees.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center gap-2 rounded-xl bg-background p-3"
            >
              <div className="flex-1">
                <p className="font-medium text-foreground">{employee.username}</p>
                <p className={`text-xs ${employee.isExpired ? "text-destructive" : "text-primary"}`}>
                  {employee.isDisabled ? "معطّل" : employee.isExpired ? "متوقف" : "فعّال"}
                </p>
              </div>
              {team.canManage ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = await setEmployeeActive({
                        data: { token: readToken(), employeeId: employee.id, active: employee.isDisabled },
                      });
                      if (res.ok) {
                        await queryClient.invalidateQueries({ queryKey: ["merchant-team"] });
                        toast.success(employee.isDisabled ? "تم تفعيل الموظف" : "تم تعطيل الموظف");
                      } else toast.error(res.message);
                    }}
                  >
                    {employee.isDisabled ? "تفعيل" : "تعطيل"}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    aria-label="حذف"
                    onClick={async () => {
                      if (!confirm(`حذف حساب ${employee.username}؟`)) return;
                      const res = await deleteEmployee({
                        data: { token: readToken(), employeeId: employee.id },
                      });
                      if (res.ok) {
                        await queryClient.invalidateQueries({ queryKey: ["merchant-team"] });
                        toast.success("تم حذف الموظف");
                      } else toast.error(res.message);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : null}
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
                    data: { token: readToken(), username: employeeUsername.trim(), password: employeePassword },
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

