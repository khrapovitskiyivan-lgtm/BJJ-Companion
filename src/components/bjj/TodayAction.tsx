import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { track } from "@/lib/bjj/telemetry";
import type { Insight, InsightKind } from "@/lib/bjj/insights";

// Блок «3 минуты сегодня»: герой = primaryAction, ниже — раскрытие «что ещё».
// Консолидирует прежние реко-блоки в одно ранжированное действие.

const CTA: Record<InsightKind, string> = {
  "return-after-pause": "Повторить за 3 минуты",
  "cold-start": "Записать тренировку",
  "catcher-defense": "Разобрать защиту",
  "review-shown": "Разобрать показанное",
  "repeat-stale": "Повторить",
  plan: "Записать тренировку",
  "learn-next": "Открыть",
};

// Навигация инсайта: есть техника -> её карточка; иначе -> запись в дневник.
function linkProps(ins: Insight) {
  const id = ins.techniqueIds[0];
  if (id != null) return { to: "/technique/$id" as const, params: { id: String(id) } };
  return { to: "/diary" as const, search: { add: true } };
}

export function TodayAction({ insights }: { insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const primary = insights[0] ?? null;
  const rest = insights.slice(1);

  useEffect(() => {
    if (primary) track("insight_shown", primary.kind);
  }, [primary?.kind]);

  if (!primary) return null;
  const heroTech = primary.techniqueIds[0] != null ? TECH_BY_ID[primary.techniqueIds[0]] : null;

  return (
    <div className="space-y-2">
      <section className="rounded-2xl border-2 border-ring/50 bg-primary/5 p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
          <Clock className="h-3.5 w-3.5" /> Сегодня · 3 минуты
        </p>
        <p className="mb-3 text-[15px] font-semibold">{primary.reason}</p>
        {heroTech && (
          <div className="mb-3">
            <TechniqueRow technique={heroTech} inset />
          </div>
        )}
        <Link
          {...linkProps(primary)}
          onClickCapture={() => track("insight_click", primary.kind)}
          className={buttonClass("primary", "md", "w-full")}
        >
          {CTA[primary.kind]}
        </Link>
      </section>

      {rest.length > 0 && (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
          >
            <span className="text-sm text-muted-foreground">Что ещё сегодня</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {rest.length}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </button>
          {open && (
            <ul className="border-t border-border px-2 pb-2 pt-1">
              {rest.map((ins) => (
                <li key={ins.kind + ins.techniqueIds.join(",")}>
                  <Link
                    {...linkProps(ins)}
                    onClickCapture={() => track("insight_click", ins.kind)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-muted"
                  >
                    <span className="flex-1">{ins.reason}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
