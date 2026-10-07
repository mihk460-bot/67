import { useEffect, useState } from "react";
import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type SupportContact, getAdminSettings, updateAdminSettings } from "@/lib/app.functions";
import { useRequireRole, readToken } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceEditor } from "@/components/PriceEditor";

export const Route = createFileRoute("/admin/")({
  head: () => pageHead("الأسعار وإعدادات الإدارة", "إدارة أسعار بيع وشراء العيارات وإعدادات الدعم والاشتراكات"),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  useRequireRole("admin");
  const queryClient = useQueryClient();
  const token = readToken();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getAdminSettings({ data: { token } }),
  });

  const [displayCounter, setDisplayCounter] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [supportContactType, setSupportContactType] = useState<"phone" | "link" | "text">("phone");
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const initialized = settings?.ok;
  useEffect(() => {
    if (settings?.ok) {
      setDisplayCounter(String(settings.displayCounter));
      setSupportContact(settings.supportContact);
      setSupportContactType(settings.supportContactType as "phone" | "link" | "text");
      setContacts(settings.supportContacts ?? []);
    }
  }, [initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await updateAdminSettings({
        data: {
          token,
          displayCounter: parseInt(displayCounter, 10) || 0,
          supportContact,
          supportContactType,
          supportContacts: contacts
            .map((c) => ({ ...c, label: c.label.trim(), value: c.value.trim() }))
            .filter((c) => c.label && c.value),
        },
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
        await queryClient.invalidateQueries({ queryKey: ["public-prices"] });
        toast.success("تم تحديث الإعدادات بنجاح");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("تعذر حفظ الإعدادات، حاول مرة أخرى");
    } finally {
      setSavingSettings(false);
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
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 pb-24 pt-6">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="mb-2 text-xs text-muted-foreground">التجار المشتركين (فعلي)</p>
          <p className="num text-2xl font-bold text-foreground">{settings?.ok ? settings.realCounter : 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-center text-xs text-muted-foreground">الرقم المعروض</p>
          <Input
            value={displayCounter}
            onChange={(e) => setDisplayCounter(e.target.value)}
            inputMode="numeric"
            className="num h-10 border-none bg-background text-center text-xl font-bold text-primary focus-visible:ring-0"
          />
        </div>
      </div>

      <Button variant="secondary" className="h-11 w-full font-semibold" onClick={handleSaveSettings} disabled={savingSettings}>
        {savingSettings ? <Loader2 className="animate-spin" /> : "حفظ الإعدادات"}
      </Button>

      <div className="h-px bg-border" />

      {/* Support contact */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">تواصل الاشتراكات</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          يظهر هذا الرابط أو الرقم للتاجر عند انتهاء الفترة المجانية أو الاشتراك.
        </p>
        <Input
          value={supportContact}
          onChange={(e) => setSupportContact(e.target.value)}
          placeholder="رقم الهاتف أو الرابط"
          className="h-13 bg-card"
        />
        <div className="flex gap-2">
          {([
            ["phone", "رقم هاتف"],
            ["link", "رابط"],
            ["text", "نص"],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setSupportContactType(type)}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                supportContactType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Support contacts for merchants */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">أرقام وروابط الدعم</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          تظهر للتاجر عند الضغط على زر «الدعم» داخل التطبيق.
        </p>
        {contacts.map((c, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex gap-2">
              <Input
                value={c.label}
                onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                placeholder="الاسم (مثال: واتساب الدعم)"
                className="bg-background"
              />
              <button
                type="button"
                aria-label="حذف"
                onClick={() => setContacts((l) => l.filter((_, j) => j !== i))}
                className="px-2 text-destructive"
              >
                <Trash2 className="size-5" />
              </button>
            </div>
            <Input
              value={c.value}
              onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              placeholder={c.type === "link" ? "https://..." : "رقم الهاتف مع رمز الدولة"}
              dir="ltr"
              className="bg-background"
            />
            <div className="flex gap-2">
              {([
                ["phone", "اتصال"],
                ["whatsapp", "واتساب"],
                ["link", "رابط"],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setContacts((l) => l.map((x, j) => (j === i ? { ...x, type } : x)))}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                    c.type === type ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {contacts.length < 10 ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setContacts((l) => [...l, { label: "", type: "whatsapp", value: "" }])}
          >
            <Plus className="size-4" /> إضافة رقم أو رابط
          </Button>
        ) : null}
        <Button className="h-11 w-full font-semibold" onClick={handleSaveSettings} disabled={savingSettings}>
          {savingSettings ? <Loader2 className="animate-spin" /> : "حفظ أرقام الدعم"}
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* Prices */}
      <PriceEditor initial={settings?.ok ? settings.prices : undefined} />
    </main>
  );
}
