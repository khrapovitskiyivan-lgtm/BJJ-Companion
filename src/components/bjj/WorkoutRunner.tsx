import { useEffect, useMemo } from "react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buildSections, currentDrillIndex, type RunPhase } from "@/lib/bjj/runner";
import { useRunner } from "@/lib/bjj/useRunner";
import { unlockAudio } from "@/lib/bjj/sound";
import type { Workout } from "@/lib/bjj/types";
import { ArrowLeft, Play, Pause, RotateCcw, Flame, Sparkles, Snowflake, CheckCircle2 } from "lucide-react";

// Раннер сгенерированной тренировки: таймер идёт по разделам
// (разминка -> основа -> заминка), за 5 сек до конца раздела короткие гудки,
// громкий сигнал в конце раздела и тройной в конце тренировки.

const SECTION_ICON: Record<string, React.ReactNode> = {
  warmup: <Flame className="h-3.5 w-3.5" style={{ color: "var(--brand-gold-ink)" }} />,
  main: <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--color-primary)" }} />,
  cooldown: <Snowflake className="h-3.5 w-3.5" style={{ color: "var(--status-done)" }} />,
};

// Фаза на время сессии: заглянул в карточку техники и вернулся — раннер на месте (на паузе)
let runCache: { w: Workout; phase: RunPhase } | null = null;

export function WorkoutRunner({ workout, onExit }: { workout: Workout; onExit: () => void }) {
  const sections = useMemo(() => buildSections(workout), [workout]);
  const { phase, paused, setPaused, reset } = useRunner(
    sections,
    runCache?.w === workout ? runCache.phase : undefined,
  );

  useEffect(() => {
    runCache = { w: workout, phase };
  }, [workout, phase]);

  const section = sections[phase.sectionIdx];
  if (!section) return null;

  const mm = String(Math.floor(phase.left / 60)).padStart(2, "0");
  const ss = String(phase.left % 60).padStart(2, "0");
  const drillIdx =
    section.key === "main"
      ? currentDrillIndex(workout.drills.map((d) => d.minutes), section.seconds, phase.left)
      : -1;

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        К плану тренировки
      </button>

      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {phase.finished ? "Готово" : `Раздел ${phase.sectionIdx + 1}/${sections.length} · ${section.title}`}
        </p>
        {phase.finished ? (
          <div className="mt-3 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10" style={{ color: "var(--status-done)" }} />
            <p className="text-lg font-bold">Тренировка завершена</p>
          </div>
        ) : (
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums">
            {mm}:{ss}
          </p>
        )}

        {/* Прогресс по разделам */}
        <div className="mt-3 flex justify-center gap-1.5">
          {sections.map((s, i) => {
            const done = phase.finished || i < phase.sectionIdx;
            const current = !phase.finished && i === phase.sectionIdx;
            return (
              <span
                key={s.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                  current
                    ? "border-ring bg-primary/10 font-medium text-foreground"
                    : done
                      ? "border-border text-muted-foreground line-through"
                      : "border-border text-muted-foreground"
                }`}
              >
                {SECTION_ICON[s.key]}
                {s.title}
              </span>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {!phase.finished && (
            <button
              onClick={() => {
                unlockAudio();
                setPaused((p) => !p);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? (phase.sectionIdx === 0 && phase.left === section.seconds ? "Старт" : "Продолжить") : "Пауза"}
            </button>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Сброс
          </button>
        </div>
      </div>

      {/* Содержимое текущего раздела */}
      {!phase.finished && section.key === "main" && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Техники раздела</h3>
          <ul className="space-y-2">
            {workout.drills.map((d, i) => (
              <li key={d.technique.id} className={i === drillIdx ? "rounded-xl ring-2 ring-ring" : ""}>
                <TechniqueRow technique={d.technique} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {!phase.finished && section.key !== "main" && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{section.title}</h3>
          <ul className="space-y-2">
            {(section.key === "warmup" ? workout.warmup : workout.cooldown).map((w, i) => (
              <li key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.desc}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {w.duration} мин
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Отметить отработанное после финала */}
      {phase.finished && workout.drills.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Что отрабатывали</h3>
          <ul className="space-y-2">
            {workout.drills.map((d) => (
              <li key={d.technique.id}>
                <TechniqueRow technique={d.technique} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
