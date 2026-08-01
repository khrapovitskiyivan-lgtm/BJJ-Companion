import { useState } from "react";
import { Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { useProgress } from "@/lib/bjj/store";
import { starterProgress } from "@/lib/bjj/starterSet";
import type { ProgressStatus } from "@/lib/bjj/types";

// Маркер статуса справа в строке (те же цвета, что на карточке техники)
const STATUS_ICON = { not_started: Circle, in_progress: CircleDot, done: Check } as const;
const STATUS_COLOR: Record<ProgressStatus, string> = {
  not_started: "var(--status-idle)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
};
function StatusMark({ status }: { status: ProgressStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Icon className="h-5 w-5 shrink-0" style={{ color: STATUS_COLOR[status] }} strokeWidth={2.2} />
  );
}

// Сколько бакетов раскрыто по умолчанию (остальные аккордеоном). Финализируется рантаймом.
const OPEN_BY_DEFAULT = 2;

// Стартовый набор новичка: базовые техники по позициям с отметкой пройденного.
// Отметка «изучено» ставится на карточке техники (строка -> карточка), не инлайн.
export function StarterSet() {
  const { progress } = useProgress();
  const sp = starterProgress(progress);
  const [openIdx, setOpenIdx] = useState<Set<number>>(
    () => new Set(sp.buckets.map((_, i) => i).slice(0, OPEN_BY_DEFAULT)),
  );

  const pct = sp.total ? Math.round((sp.done / sp.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Базовый набор белого пояса. Порядок — ориентир, а не строгий путь.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {sp.done} из {sp.total}
          </span>
        </div>
      </div>

      {sp.buckets.map((b, i) => {
        const open = openIdx.has(i);
        return (
          <section key={b.title}>
            <button
              type="button"
              onClick={() =>
                setOpenIdx((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              aria-expanded={open}
              className="flex w-full items-center justify-between px-1 pb-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {b.title}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {b.done}/{b.total}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {open && (
              <div className="space-y-1.5">
                {b.techniques.map((t) => (
                  <TechniqueRow
                    key={t.id}
                    technique={t}
                    right={<StatusMark status={progress[t.id] ?? "not_started"} />}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
