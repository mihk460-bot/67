import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { merchantLogin, merchantRegister, getPublicPrices } from "@/lib/app.functions";
import { loginAs, loadAuthState, routeForRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حاسبة الصاغة — تسجيل الدخول" },
      {
        name: "description",
        content: "تسجيل دخول التجار لحساب أسعار الذهب والفضة",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regPending, setRegPending] = useState(false);
  const [expiredContact, setExpiredContact] = useState<{
    value: string;
    type: "phone" | "link" | "text";
  } | null>(null);
  const [supportContact, setSupportContact] = useState<string | null>(null);

  useEffect(() => {
    const state = loadAuthState();
    if (state.token && state.role) {
      navigate({ to: routeForRole(state.role), replace: true });
    }
    getPublicPrices().then((d) => setSupportContact(d.supportContact || null));
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setErrorMsg("");
    setExpiredContact(null);
    setPending(true);
    try {
      const res = await merchantLogin({ data: { username: username.trim(), password } });
      if (res.ok) {
        loginAs({ token: res.token, role: "merchant", merchantId: res.merchantId });
        navigate({ to: "/app", replace: true });
      } else {
        setErrorMsg(res.message);
        if (res.error === "subscription_inactive") {
          const contact = res.supportContact || supportContact;
          const type = (res.supportContactType || "phone") as "phone" | "link" | "text";
          if (contact) setExpiredContact({ value: contact, type });
        }
      }
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword || !regConfirm) {
      toast.error("أدخل اسم المستخدم وكلمة المرور وتأكيدها");
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setRegPending(true);
    try {
      const res = await merchantRegister({
        data: { username: regUsername.trim(), password: regPassword },
      });
      if (res.ok) {
        loginAs({ token: res.token, role: "merchant", merchantId: res.merchantId });
        navigate({ to: "/app", replace: true });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("تعذر إنشاء الحساب، حاول مرة أخرى");
    } finally {
      setRegPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-5 text-2xl font-bold text-primary">حاسبة الصاغة</h1>
          <p className="mt-1 text-sm text-muted-foreground">تسجيل الدخول للتجار</p>
        </div>

        {showRegister ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-username" className="text-start">
                اسم المستخدم
              </Label>
              <Input
                id="reg-username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-start">
                كلمة المرور
              </Label>
              <Input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-confirm" className="text-start">
                تأكيد كلمة المرور
              </Label>
              <Input
                id="reg-confirm"
                type="password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              ابدأ بفترة مجانية لمدة 14 يومًا
            </p>
            {errorMsg ? <p className="text-center text-sm text-destructive">{errorMsg}</p> : null}
            <Button type="submit" disabled={regPending} className="h-12 w-full text-base font-semibold">
              {regPending ? <Loader2 className="animate-spin" /> : "إنشاء الحساب"}
            </Button>
            <button
              type="button"
              onClick={() => setShowRegister(false)}
              className="w-full py-3 text-center text-sm font-semibold text-primary"
            >
              لديك حساب؟ تسجيل الدخول
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-start">
                اسم المستخدم
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-start">
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorMsg ? (
              <div className="space-y-2.5">
                <p className="text-center text-sm text-destructive">{errorMsg}</p>
                {expiredContact ? (
                  <div className="space-y-2.5 rounded-xl border border-border bg-card p-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                      للتجديد تواصل مع الإدارة
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          if (expiredContact.type === "phone") {
                            window.location.href = `tel:${expiredContact.value}`;
                          } else if (expiredContact.type === "link") {
                            window.open(expiredContact.value, "_blank");
                          }
                        }}
                        disabled={expiredContact.type === "text"}
                      >
                        {expiredContact.type === "phone" ? (
                          <>
                            <Phone className="size-4" /> اتصال
                          </>
                        ) : expiredContact.type === "link" ? (
                          "فتح الرابط"
                        ) : (
                          "بيانات التواصل"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          navigator.clipboard.writeText(expiredContact.value);
                          toast.success("تم نسخ بيانات التواصل");
                        }}
                      >
                        نسخ
                      </Button>
                    </div>
                    <p className="select-text text-center font-semibold text-foreground">
                      {expiredContact.value}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" disabled={pending} className="h-12 w-full text-base font-semibold">
              {pending ? <Loader2 className="animate-spin" /> : "دخول"}
            </Button>
          </form>
        )}

        {!showRegister ? (
          <button
            type="button"
            onClick={() => {
              setShowRegister(true);
              setErrorMsg("");
            }}
            className="mt-3 w-full py-3 text-center text-sm font-semibold text-primary"
          >
            إنشاء حساب تاجر جديد
          </button>
        ) : null}

        <div className="mt-14 flex flex-col items-center gap-1 pb-4 text-center">
          <Users className="size-4 text-muted-foreground/60" />
          <a href="/admin-login" className="text-xs text-muted-foreground hover:text-foreground">
            الإدارة
          </a>
        </div>
      </div>
    </div>
  );
}
