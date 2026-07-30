import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TECHNIQUES } from "@/lib/bjj/data";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { nextForStyle } from "@/lib/bjj/recommend";
import { STYLE_META, STYLE_ORDER } from "@/lib/bjj/constants";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import { gapState } from "@/lib/bjj/gapState";
import { isStyleAspirationDismissed, dismissStyleAspiration } from "@/lib/bjj/styleAspiration";
import { track } from "@/lib/bjj/telemetry";
import type { StyleScore } from "@/lib/bjj/styleProfile";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, Style } from "@/lib/bjj/types";
import { Compass, ArrowRight } from "lucide-react";

// "Разрыв": аспирация (кем хочешь быть) против реального архетипа (что тренируешь).
// Пусто + порог пройден -> промпт выбора аспирации (client-only, дисмиссится навсегда).
export function GapCard({
  scores,
  preferredStyles,
  progress,
  belt,
  doneCount,
  onPickStyle,
}: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  progress: ProgressMap;
  belt: Belt;
  doneCount: number;
  onPickStyle?: (s: Style) => void;
}) {
  // Хуки безусловно вверху (rules-of-hooks). Промпт/дисмисс — только после mount (SSR-safe).
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setMounted(true);
    setDismissed(isStyleAspirationDismissed());
  }, []);

  const state = gapState({ scores, preferredStyles, doneCount, mounted, dismissed });

  useEffect(() => {
    if (state !== "hidden") track("gap_shown", state, { dailyDedup: true });
  }, [state]);

  if (state === "hidden") return null;

  if (state === "prompt") {
    return (
      <section className="rounded-2xl border border-ring/50 bg-primary/5 p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Compass className="h-4 w-4 text-primary" />
          Каким стилем хочешь играть?
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Выбери цель-стиль — покажем разрыв с реальной игрой и подтянем отработку.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {STYLE_ORDER.map((s) => {
            const Icon = STYLE_ICONS[s];
            return (
              <button
                key={s}
                onClick={() => onPickStyle?.(s)}
                className="flex items-center gap-2 rounded-xl border-2 border-border bg-card p-2 text-left transition-all hover:border-ring"
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
                <span className="truncate text-xs font-medium">{STYLE_META[s].ru}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            dismissStyleAspiration();
            setDismissed(true);
          }}
          className="mt-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Не сейчас
        </button>
      </section>
    );
  }

  // state === "ontrack" | "gap": реальный «Разрыв»
  const top = scores[0];
  const onTrack = state === "ontrack";
  const aspiration = onTrack ? top.style : preferredStyles?.[0] ?? top.style;
  const aspirationPct = scores.find((s) => s.style === aspiration)?.pct ?? 0;
  const next = onTrack ? [] : nextForStyle(TECHNIQUES, progress, belt, aspiration, 3);

  return (
    <section className="rounded-2xl border border-ring/50 bg-primary/5 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Compass className="h-4 w-4 text-primary" />
        Хочу и тренирую
      </h2>
      {onTrack ? (
        <p className="text-xs text-muted-foreground">
          Идёшь по плану: твой стиль «{STYLE_META[top.style].ru}» совпадает с целью
          и занимает {top.pct}% игры.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Хочешь играть «{STYLE_META[aspiration].ru}», но в твоей игре это {aspirationPct}%.
            Реально тренируешь «{STYLE_META[top.style].ru}» ({top.pct}%).
          </p>
          {next.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Сдвинут в нужную сторону
              </p>
              <ul className="space-y-1.5">
                {next.map((t) => (
                  <li key={t.id}>
                    <TechniqueRow technique={t} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/workout"
            search={{ src: "diary" }}
            className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}
          >
            Собрать отработку по дневнику
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </section>
  );
}
