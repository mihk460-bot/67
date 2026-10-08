import { useState } from "react";
import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createMerchant,
  deleteMerchant,
  listMerchants,
  updateMerchant,
} from "@/lib/app.functions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/merchants")({
  head: () => pageHead("إدارة التجار", "إدارة حسابات التجار ومواعيد الاشتراكات وحالة الحسابات"),
  component: AdminMerchantsPage,
});

type MerchantRow = {
  id: number;
  username: string;
  isActive: boolean;
  expiresAt: string;
};

function AdminMerchantsPage() {
  useRequireRole("admin");
  const queryClient = useQueryClient();
  const token = readToken();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: () => listMerchants({ data: { token } }),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantRow | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subscriptionMonths, setSubscriptionMonths] = useState("1");
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const merchants = data?.ok ? data.merchants : [];

  const openCreate = () => {
    setEditing(null);
    setUsername("");
    setPassword("");
    setSubscriptionMonths("1");
    setCustomExpiryDate("");
    setIsActive(true);
    setPaymentAmount(""); setPaymentNote("");
    setModalOpen(true);
  };

  const openEdit = (m: MerchantRow) => {
    setEditing(m);
    setUsername(m.username);
    setPassword("");
    setSubscriptionMonths("");
    setCustomExpiryDate(m.expiresAt ? new Date(m.expiresAt).toISOString().slice(0, 10) : "");
    setIsActive(m.isActive);
    setPaymentAmount(""); setPaymentNote("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    let expiresAt: string | undefined;
    if (customExpiryDate.trim()) {
      const raw = customExpiryDate
        .trim()
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[/.\s]+/g, "-");
      const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const y = m ? +m[1]! : 0, mo = m ? +m[2]! : 0, d = m ? +m[3]! : 0;
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (!m || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
        toast.error("اكتب التاريخ بالصيغة: سنة-شهر-يوم، مثال: 2026-10-4");
        return;
      }
      expiresAt = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    const amount = paymentAmount.trim() ? Number(paymentAmount.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) { toast.error("مبلغ الدفع غير صحيح"); return; }
    const payment = { ...(amount !== undefined ? { paymentAmount: amount } : {}), ...(paymentNote.trim() ? { paymentNote: paymentNote.trim() } : {}) };
    setPending(true);
    try {
      if (!editing) {
        if (!username.trim() || !password) {
          toast.error("اسم المستخدم وكلمة المرور مطلوبة");
          return;
        }
        const res = await createMerchant({
          data: {
            token,
            username: username.trim(),
            password,
            ...(expiresAt ? { expiresAt } : { subscriptionMonths: parseInt(subscriptionMonths) || 1 }),
            ...payment,
          },
        });
        if (res.ok) {
          await queryClient.invalidateQueries({ queryKey: ["admin-merchants"] });
          toast.success("تم إنشاء التاجر");
          setModalOpen(false);
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await updateMerchant({
          data: {
            token,
            id: editing.id,
            isActive,
            ...(password ? { password } : {}),
            ...(subscriptionMonths ? { subscriptionMonths: parseInt(subscriptionMonths) } : {}),
            ...(expiresAt ? { expiresAt } : {}),
            ...payment,
          },
        });
        if (res.ok) {
          await queryClient.invalidateQueries({ queryKey: ["admin-merchants"] });
          toast.success("تم تحديث التاجر");
          setModalOpen(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch {
      toast.error("تعذر الحفظ، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId == null) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      const res = await deleteMerchant({ data: { token, id } });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["admin-merchants"] });
        toast.success("تم حذف التاجر");
        if (editing?.id === id) setModalOpen(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("تعذر حذف التاجر");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 pb-24 pt-6">
      <Button className="gap-2 font-semibold" onClick={openCreate}>
        <Plus className="size-4" />
        إضافة
      </Button>

      {merchants.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">لا يوجد تجار بعد</p>
      ) : null}

      <div className="space-y-3">
        {merchants.map((m) => {
          const expired = new Date(m.expiresAt).getTime() <= Date.now();
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => openEdit(m)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-start"
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{m.username}</p>
                <p className={`text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                  <span className="num">ينتهي: {new Date(m.expiresAt).toLocaleDateString("ar-EG")}</span>
                </p>
              </div>
              <span
                className={`size-3 rounded-full ${m.isActive && !expired ? "bg-success" : "bg-destructive"}`}
              />
            </button>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start text-lg font-bold text-foreground">
              {editing ? "تعديل التاجر" : "تاجر جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pb-2">
            {!editing ? (
              <div className="space-y-2">
                <Label htmlFor="m-username" className="text-start">
                  اسم المستخدم
                </Label>
                <Input id="m-username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="m-password" className="text-start">
                {editing ? "كلمة المرور الجديدة (اختياري)" : "كلمة المرور"}
              </Label>
              <Input id="m-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-months" className="text-start">
                {editing ? "تمديد الاشتراك (بالأشهر)" : "مدة الاشتراك (بالأشهر)"}
              </Label>
              <div className="mb-2 flex gap-2">
                {[1, 3, 6, 12].map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => {
                      setSubscriptionMonths(String(months));
                      setCustomExpiryDate("");
                    }}
                    className={`h-10 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                      subscriptionMonths === String(months)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-primary"
                    }`}
                  >
                    {months} {months === 1 ? "شهر" : "أشهر"}
                  </button>
                ))}
              </div>
              <Input
                id="m-months"
                value={subscriptionMonths}
                onChange={(e) => {
                  setSubscriptionMonths(e.target.value);
                  if (e.target.value) setCustomExpiryDate("");
                }}
                inputMode="numeric"
                placeholder="أو أدخل عدد الأشهر"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-expiry" className="text-start">
                أو حدّد تاريخ انتهاء مخصص
              </Label>
              <Input
                id="m-expiry"
                value={customExpiryDate}
                onChange={(e) => {
                  setCustomExpiryDate(e.target.value);
                  if (e.target.value) setSubscriptionMonths("");
                }}
                placeholder="2026-12-31"
                className="num"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                التاريخ المخصص يتجاوز مدة الاشتراك بالأشهر.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="m-pay" className="text-start">المبلغ المدفوع (اختياري)</Label>
                <Input id="m-pay" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} inputMode="decimal" className="num" dir="ltr" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-pay-note" className="text-start">ملاحظة الدفع</Label>
                <Input id="m-pay-note" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} maxLength={200} placeholder="تحويل / نقدي..." />
              </div>
            </div>

            {editing ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <span className="font-semibold text-foreground">حالة الحساب</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    isActive ? "bg-success text-white" : "bg-destructive text-white"
                  }`}
                >
                  {isActive ? "نشط" : "معطل"}
                </button>
              </div>
            ) : null}

            <Button className="h-12 w-full text-base font-bold" onClick={handleSave} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : "حفظ"}
            </Button>

            {editing ? (
              <Button
                variant="outline"
                className="h-12 w-full border-destructive text-base font-bold text-destructive hover:text-destructive"
                onClick={() => setDeletingId(editing.id)}
              >
                حذف التاجر
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId != null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا التاجر نهائيًا؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
