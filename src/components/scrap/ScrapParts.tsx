import { useState, type ReactNode } from "react";
import { Plus, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatTimestampWithZone, METAL_LABEL } from "@/lib/scrap/format";
import type { Metal } from "@/lib/scrap/config";
import { evaluateLine, formatMg, type LineDraftInput } from "@/lib/scrap/calc";
import { defaultSharesFor, presetsFor } from "@/lib/scrap/config";

/** بند قيد الإدخال (نصوص كما يكتبها المستخدم) */
export interface LineDraft extends LineDraftInput {
  id: string;
}

let lineSequence = 0;

function newLineId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "line-" + Date.now() + "-" + (++lineSequence);
}

export function newLine(metal: Metal): LineDraft {
  return { id: newLineId(), gross: "", shares: defaultSharesFor(metal) };
}

const CUSTOM = "__custom__";

/* ------------------------------------------------------------------ */
/* اختيار العيار / الأسهم                                                */
/* ------------------------------------------------------------------ */

export function SharesPicker({
  metal,
  value,
  onChange,
}: {
  metal: Metal;
  value: string;
  onChange: (value: string) => void;
}) {
  const presets = presetsFor(metal);
  const isPreset = presets.some((p) => String(p.shares) === value);
  const [custom, setCustom] = useState(false);
  const showCustom = custom || !isPreset;

  return (
    <div className="flex gap-2">
      <select
        className={selectClass}
        aria-label="العيار / الأسهم"
        value={showCustom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {presets.map((preset) => (
          <option key={preset.shares} value={String(preset.shares)}>
            {preset.label}
          </option>
        ))}
        <option value={CUSTOM}>سهم مخصص…</option>
      </select>
      {showCustom ? (
        <Input
          dir="ltr"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 shrink-0"
          placeholder="سهم"
          aria-label="عدد الأسهم"
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* محرر بنود (وزن قائم + عيار)                                           */
/* ------------------------------------------------------------------ */

export function LinesEditor({
  title,
  hint,
  metal,
  target,
  unitLabel,
  lines,
  onChange,
  children,
}: {
  title: string;
  hint?: string;
  metal: Metal;
  target: number;
  unitLabel: string;
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  children?: ReactNode;
}) {
  function update(id: string, patch: Partial<LineDraftInput>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function remove(id: string) {
    const next = lines.filter((line) => line.id !== id);
    onChange(next.length > 0 ? next : [newLine(metal)]);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.map((line, index) => {
          const state = evaluateLine(line, target);
          return (
            <div key={line.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>بند {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(line.id)}
                  aria-label={`حذف البند ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-muted-foreground">الوزن القائم (جم)</span>
                  <Input
                    dir="ltr"
                    inputMode="decimal"
                    value={line.gross}
                    onChange={(e) => update(line.id, { gross: e.target.value })}
                    placeholder="0.000"
                  />
                </label>
                <div className="flex flex-col gap-1.5 text-sm">
                  <span className="text-muted-foreground">العيار / الأسهم</span>
                  <SharesPicker metal={metal} value={line.shares} onChange={(shares) => update(line.id, { shares })} />
                </div>
              </div>

              <div className="text-sm" aria-live="polite">
                {state.kind === "ok" ? (
                  <span>
                    {unitLabel}:{" "}
                    <strong dir="ltr" className="tabular-nums">
                      {formatMg(state.line.equivMg)} جم
                    </strong>
                  </span>
                ) : state.kind === "invalid" ? (
                  <span className="text-red-600 dark:text-red-400">{state.error}</span>
                ) : (
                  <span className="text-muted-foreground">أدخل الوزن القائم</span>
                )}
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, newLine(metal)])}>
          <Plus className="me-2 h-4 w-4" />
          إضافة بند
        </Button>

        {children}
      </CardContent>
    </Card>
  );
}


/** الحقول والتنسيقات المشتركة لواجهات الحاسبة. */
export const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-start text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyRow({ colSpan, loading, text }: { colSpan: number; loading: boolean; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">
        {loading ? "جارٍ التحميل..." : text}
      </td>
    </tr>
  );
}

export function MetalBadge({ metal }: { metal: Metal }) {
  return <Badge variant={metal === "gold" ? "default" : "secondary"}>{METAL_LABEL[metal]}</Badge>;
}

export function Timestamp({ value, timeZone }: { value: string; timeZone: string }) {
  return <span dir="ltr" className="text-xs">{formatTimestampWithZone(value, timeZone)}</span>;
}

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    page: currentPage,
    pageCount,
    total: items.length,
    setPage: (next: number) => setPage(Math.max(1, Math.min(next, pageCount))),
  };
}

export function Pager({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  if (total <= 20) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>عدد السندات: {total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>السابق</Button>
        <span dir="ltr">{page} / {pageCount}</span>
        <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>التالي</Button>
      </div>
    </div>
  );
}
