import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sendNotification } from "@/lib/app.functions";
import { useRequireRole, readToken } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  useRequireRole("admin");
  const token = readToken();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("العنوان والنص مطلوبان");
      return;
    }
    setPending(true);
    try {
      const res = await sendNotification({ data: { token, title: title.trim(), body: body.trim() } });
      if (res.ok) {
        toast.success("تم إرسال الإشعار بنجاح");
        setTitle("");
        setBody("");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("حدث خطأ أثناء إرسال الإشعار");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 flex items-start justify-between">
          <p className="text-sm leading-relaxed text-muted-foreground">
            سيتم إرسال هذا الإشعار لجميع التجار المسجلين. استخدمه للتنبيه بتغير حاد في الأسعار أو تحديثات
            مهمة.
          </p>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
            <Bell className="size-5 text-primary" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="n-title" className="text-start">
              عنوان الإشعار
            </Label>
            <Input
              id="n-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تحديث أسعار الذهب"
              className="h-12 bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-body" className="text-start">
              نص الإشعار
            </Label>
            <Textarea
              id="n-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="تفاصيل التحديث..."
              className="min-h-28 bg-background"
            />
          </div>
          <Button className="h-14 w-full gap-2 text-base font-bold" onClick={handleSend} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
            إرسال الآن
          </Button>
        </div>
      </div>
    </main>
  );
}
