import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Shield } from "lucide-react";
import { adminLogin } from "@/lib/app.functions";
import { loginAs, routeForRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "حاسبة الصاغة — دخول الإدارة" },
      { name: "description", content: "دخول لوحة الإدارة ومدير الأسعار" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, setPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("يرجى إدخال كلمة المرور");
      return;
    }
    setErrorMsg("");
    setPending(true);
    try {
      const res = await adminLogin({ data: { password } });
      if (res.ok) {
        loginAs({ token: res.token, role: res.role });
        navigate({ to: routeForRole(res.role), replace: true });
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <button
        type="button"
        onClick={() => navigate({ to: "/", replace: true })}
        className="mb-6 flex items-center gap-2 self-start p-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-5" />
        رجوع
      </button>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-card">
            <Shield className="size-7 text-primary" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">لوحة الإدارة</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="password"
            placeholder="كلمة مرور الإدارة"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-14"
          />
          {errorMsg ? <p className="text-center text-sm text-destructive">{errorMsg}</p> : null}
          <Button type="submit" disabled={pending} className="h-12 w-full text-base font-semibold">
            {pending ? <Loader2 className="animate-spin" /> : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
