import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { getAdminLogs, type ActivityRow } from "@/lib/logs.functions";
import { readToken, useRequireRole } from "@/lib/auth-client";
import { formatDateTime, formatDuration, zoneLabel } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/logs")({
  head: () => pageHead("سجلات النظام", "سجلات الاشتراكات والأسعار والدخول وإحصائيات التطبيق لمالك التطبيق"),
  component: AdminLogsPage,
});

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const roleAr: Record<string, string> = { admin: "مالك التطبيق", price_manager: "مدير الأسعار", merchant: "تاجر", employee: "موظف" };
const tabs = [["stats", "الإحصائيات"], ["subs", "الاشتراكات"], ["prices", "الأسعار"], ["sessions", "الدخول والخروج"], ["accounts", "الحسابات"]] as const;

function subStatus(end: string) {
  const left = new Date(end).getTime() - Date.now();
  if (left <= 0) return <span className="text-destructive">منتهي</span>;
  if (left < 7 * 864e5) return <span className="text-primary">قريب من الانتهاء</span>;
  return <span className="text-foreground">نشط</span>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="py-8 text-center text-muted-foreground">لا توجد سجلات بعد</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-secondary text-muted-foreground"><tr>{head.map((h) => <th key={h} className="p-3 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border bg-card">{r.map((c, j) => <td key={j} className="p-3 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
const T = ({ v }: { v: string | null | undefined }) => <span className="num text-xs" dir="ltr">{formatDateTime(v)}</span>;

function AdminLogsPage() {
  useRequireRole("admin");
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("stats");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["admin-logs"], queryFn: () => getAdminLogs({ data: { token: readToken() } }) });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (!data?.ok) return <p className="py-16 text-center text-destructive">{data?.message ?? "تعذر التحميل"}</p>;
  const act = (k: string) => data.activity.filter((a) => a.kind === k);
  const d = (a: ActivityRow, k: string) => a.details[k] as never;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-foreground">سجلات النظام</h1><p className="text-xs text-muted-foreground" dir="ltr">{zoneLabel()}</p></div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isRefetching}><RefreshCw className={isRefetching ? "animate-spin" : ""} />تحديث</Button>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-card p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>)}
      </div>

      {tab === "stats" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[["إجمالي عمليات البيع", fmt(data.stats.salesCount)], ["إجمالي المبيعات المالية", fmt(data.stats.salesTotal)], ["عدد المحلات", fmt(data.shops.length)],
            ["وزن الذهب المحسوب", `${fmt(data.stats.goldWeight)} جم`], ["وزن الفضة المحسوب", `${fmt(data.stats.silverWeight)} جم`], ["عدد الموظفين", fmt(data.shops.reduce((a, s) => a + s.employees.length, 0))],
            ["مبيعات الذهب", fmt(data.stats.goldTotal)], ["مبيعات الفضة", fmt(data.stats.silverTotal)], ["عمليات تعديل الأسعار", fmt(act("price_update").length)]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="num mt-1 text-lg font-bold text-primary">{v}</p></div>
          ))}
        </div>
      ) : null}

      {tab === "subs" ? <>
        <h2 className="font-bold text-foreground">حالة اشتراكات المحلات</h2>
        <Table head={["المحل", "صاحب المحل", "تاريخ التسجيل", "نهاية الاشتراك", "الحالة"]} rows={data.shops.map((s) => [s.storeName || "—", s.username, <T v={s.createdAt} />, <T v={s.expiresAt} />, subStatus(s.expiresAt)])} />
        <h2 className="pt-2 font-bold text-foreground">سجل التجديدات والدفع</h2>
        <Table head={["وقت العملية", "التاجر", "النوع", "بداية الاشتراك", "نهاية الاشتراك", "النهاية السابقة", "المدفوع", "ملاحظة", "الحالة"]} rows={act("subscription").map((a) => [
          <T v={a.createdAt} />, d(a, "shopUsername"), d(a, "action") === "new" ? "اشتراك جديد" : "تجديد", <T v={d(a, "startAt")} />, <T v={d(a, "endAt")} />, <T v={d(a, "previousEndAt")} />,
          d(a, "paymentAmount") != null ? <span className="num">{fmt(Number(d(a, "paymentAmount")))}</span> : <span className="text-muted-foreground">غير مسجل</span>, d(a, "paymentNote") || "—", subStatus(d(a, "endAt"))])} />
      </> : null}

      {tab === "prices" ? <Table head={["الوقت", "من قام بالتحديث", "التغييرات (القديم ← الجديد)"]} rows={act("price_update").map((a) => [
        <T v={a.createdAt} />, `${a.actorName} (${roleAr[a.actorRole] ?? a.actorRole})`,
        <div className="space-y-0.5">{((a.details["changes"] as { key: string; old: number; new: number }[]) ?? []).map((c) => <div key={c.key} className="num text-xs" dir="ltr">{c.key}: {fmt(c.old)} → <b className="text-primary">{fmt(c.new)}</b></div>)}</div>])} /> : null}

      {tab === "sessions" ? <Table head={["الوقت", "العملية", "المستخدم", "الدور", "وقت الدخول", "مدة الجلسة"]} rows={data.activity.filter((a) => a.kind === "login" || a.kind === "logout").map((a) => [
        <T v={a.createdAt} />, a.kind === "login" ? <span className="text-primary">دخول</span> : <span className="text-muted-foreground">خروج</span>, a.actorName, roleAr[a.actorRole] ?? a.actorRole,
        a.kind === "logout" ? <T v={d(a, "loginAt")} /> : "—", a.kind === "logout" ? <span className="num" dir="ltr">{formatDuration(d(a, "durationSeconds"))}</span> : "—"])} /> : null}

      {tab === "accounts" ? <div className="space-y-3">{data.shops.length === 0 ? <p className="text-center text-muted-foreground">لا يوجد تجار</p> : data.shops.map((s) => (
        <div key={s.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-bold text-foreground">{s.storeName || "محل بدون اسم"}</p><p className="text-xs text-muted-foreground">صاحب المحل: {s.username} • الموظفون: {s.employees.length} • الفواتير: {s.salesCount}</p></div>
            <div className="text-xs">{s.isActive ? subStatus(s.expiresAt) : <span className="text-destructive">معطل</span>} • آخر ظهور: <T v={s.lastSeenAt} /></div>
          </div>
          {s.employees.length ? <Table head={["اسم المستخدم", "الحالة", "آخر ظهور / نشاط", "تاريخ الإنشاء"]} rows={s.employees.map((e) => [e.username, e.isActive ? <span className="text-primary">فعال</span> : <span className="text-destructive">معطل</span>, <T v={e.lastSeenAt} />, <T v={e.createdAt} />])} /> : null}
        </div>))}</div> : null}
    </main>
  );
}
