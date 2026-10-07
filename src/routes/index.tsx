import { useEffect, useState } from "react";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { merchantLogin, merchantRegister, getPublicPrices, type SupportContact } from "@/lib/app.functions";
import { ContactLink } from "@/components/ContactLink";
import { loginAs, loadAuthState, routeForRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => pageHead("تسجيل الدخول", "تسجيل دخول التجار والموظفين لحساب أسعار الذهب والفضة والتواصل لتجديد الاشتراك"),
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
  const [supportType, setSupportType] = useState<"phone" | "link" | "text">("phone");
  const [allContacts, setAllContacts] = useState<SupportContact[]>([]);
  const [supportList, setSupportList] = useState<SupportContact[]>([]);

  useEffect(() => {
    const state = loadAuthState();
    if (state.token && state.role) {
      navigate({ to: routeForRole(state.role), replace: true });
    }
    getPublicPrices().then((d) => {
      setSupportContact(d.supportContact || null);
      setSupportType(d.supportContactType as "phone" | "link" | "text");
      setAllContacts(d.supportContacts ?? []);
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setErrorMsg("");
    setExpiredContact(null);
    setSupportList([]);
    setPending(true);
    try {
      const res = await merchantLogin({ data: { username: username.trim(), password } });
      if (res.ok) {
        loginAs({ token: res.token, role: "merchant", merchantId: res.merchantId });
        navigate({ to: "/app", replace: true });
      } else {
        setErrorMsg(res.message);
        if (res.error === "subscription_inactive") {
          setSupportList(allContacts);
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
                {expiredContact || supportList.length > 0 ? (
                  <div className="space-y-2.5 rounded-xl border border-border bg-card p-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                      للتجديد تواصل مع الإدارة
                    </p>
                    {supportList.map((contact, i) => <ContactLink key={i} {...contact} />)}
                    {expiredContact ? <ContactLink {...expiredContact} label="تحديث الاشتراك" /> : null}
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

        {!errorMsg && (allContacts.length > 0 || supportContact) ? <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold text-primary">التواصل مع الدعم</h2>
          {allContacts.map((contact, i) => <ContactLink key={i} {...contact} />)}
          {supportContact ? <ContactLink type={supportType} value={supportContact} label="تحديث الاشتراك" /> : null}
        </section> : null}
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
