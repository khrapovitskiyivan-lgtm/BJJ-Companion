import { Link } from "@tanstack/react-router";
import { TECHNIQUES } from "@/lib/bjj/data";
import { nextForStyle } from "@/lib/bjj/recommend";
import { ARCHETYPE_MIN_DONE } from "@/lib/bjj/stats";
import { BELT_LABEL, GROUP_LABEL, STYLE_META } from "@/lib/bjj/constants";
import type { StyleScore } from "@/lib/bjj/styleProfile";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, Style } from "@/lib/bjj/types";
import { Compass, ArrowRight } from "lucide-react";

// "Разрыв": аспирация (кем хочешь быть, из настроек) против реального архетипа
// (что тренируешь по прогрессу и дневнику). Ядро геймификации: это может только
// дневник. Показывается при заданной аспирации и пройденном пороге холодного старта.
export function GapCard({
  scores, preferredStyles, progress, belt, doneCount,
}: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  progress: ProgressMap;
  belt: Belt;
  doneCount: number;
}) {
  if (!preferredStyles?.length || doneCount < ARCHETYPE_MIN_DONE || scores.length === 0) return null;

  const top = scores[0];
  const onTrack = preferredStyles.includes(top.style);
  const aspiration = onTrack ? top.style : preferredStyles[0];
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
          Идёшь по плану: твой стиль "{STYLE_META[top.style].ru}" совпадает с целью
          и занимает {top.pct}% игры.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Хочешь играть "{STYLE_META[aspiration].ru}", но в твоей игре это {aspirationPct}%.
            Реально тренируешь "{STYLE_META[top.style].ru}" ({top.pct}%).
          </p>
          {next.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Сдвинут в нужную сторону
              </p>
              <ul className="space-y-1.5">
                {next.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/technique/$id"
                      params={{ id: String(t.id) }}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition hover:bg-muted"
                      style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]} · сложность {t.difficulty}/5
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/workout"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            Собрать тренировку по дневнику
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </section>
  );
}
