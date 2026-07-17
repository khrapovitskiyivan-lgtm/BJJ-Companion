import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { Scenarios } from "@/components/bjj/Scenarios";
import { useDiary, useProfile, useProgress } from "@/lib/bjj/store";
import { generateWorkout, generateWorkoutFromDiary } from "@/lib/bjj/workout";
import { track } from "@/lib/bjj/telemetry";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import type {
  Group,
  Intensity,
  SafetyMode,
  Workout,
  WorkoutConfig,
} from "@/lib/bjj/types";
import { Button, Chip, FilterRow, PageHeader } from "@/components/bjj/ui";
import { WorkoutRunner } from "@/components/bjj/WorkoutRunner";
import { Flame, Snowflake, Sparkles, Timer, Dumbbell, Swords, NotebookPen, Play, UserRound } from "lucide-react";

export const Route = createFileRoute("/workout")({
  component: WorkoutPage,
  // Вкладка, активный сценарий, режим раннера и источник подбора в search-параметрах:
  // переживают уход на карточку техники и возврат. ?src=diary — вход из «Моей игры»
  // («Хочу и тренирую») сразу на готовый план по дневнику.
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "scenarios"; s?: string; run?: boolean; src?: "diary" } => {
    const out: { tab?: "scenarios"; s?: string; run?: boolean; src?: "diary" } = {};
    if (search.tab === "scenarios") out.tab = "scenarios";
    if (typeof search.s === "string" && search.s) out.s = search.s;
    if (search.run === true || search.run === "true") out.run = true;
    if (search.src === "diary") out.src = "diary";
    return out;
  },
});

const DURATIONS: WorkoutConfig["duration"][] = [15, 30, 45, 60];
const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "light", label: "Лёгкая" },
  { value: "medium", label: "Средняя" },
  { value: "hard", label: "Тяжёлая" },
];
const SAFETY: { value: SafetyMode; label: string; desc: string }[] = [
  { value: "smart", label: "Умный", desc: "Ограничения по поясу" },
  { value: "safe", label: "Безопасный", desc: "Без сложных и опасных" },
  { value: "all", label: "Все", desc: "Без ограничений" },
];
const FOCUSES: (Group | "all")[] = [
  "all",
  "position",
  "guard_pass",
  "submission",
  "sweep",
  "takedown",
  "transition",
  "escape",
];

function WorkoutPage() {
  const { tab: tabParam, s, run, src } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = tabParam ?? "generator";
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          kicker="Тренировка"
          title={tab === "generator" ? "Умная тренировка" : "Отработка сценариев"}
          className="px-1"
        />

        <div className="grid grid-cols-2 gap-2">
          <SubTab active={tab === "generator"} onClick={() => navigate({ search: {} })} icon={<Dumbbell className="h-4 w-4" />}>
            Генератор
          </SubTab>
          <SubTab active={tab === "scenarios"} onClick={() => navigate({ search: { tab: "scenarios" } })} icon={<Swords className="h-4 w-4" />}>
            Сценарии
          </SubTab>
        </div>

        {tab === "generator" ? (
          <WorkoutGenerator
            running={!!run}
            initialSource={src}
            onRun={() => navigate({ search: { run: true } })}
            onExitRun={() => navigate({ search: {} })}
          />
        ) : (
          <Scenarios
            activeId={s}
            onSelect={(id) => navigate({ search: { tab: "scenarios", s: id } })}
            onExit={() => navigate({ search: { tab: "scenarios" } })}
          />
        )}
      </div>
    </AppShell>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${
        active ? "border-ring bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// Кэш сгенерированной тренировки на время сессии: переживает уход на карточку
// техники и возврат (иначе «назад» перегенерировало бы тренировку). Как в library.
let workoutCache: { workout: Workout; config: WorkoutConfig; source: "profile" | "diary" } | null = null;

function WorkoutGenerator({
  running,
  initialSource,
  onRun,
  onExitRun,
}: {
  running: boolean;
  initialSource?: "diary";
  onRun: () => void;
  onExitRun: () => void;
}) {
  const { profile, hydrated: profileHydrated } = useProfile();
  const { progress, cycleStatus, hydrated: progressHydrated } = useProgress();
  const { entries, hydrated: diaryHydrated } = useDiary();
  // Генерация зависит от всех трёх сторов: ждём полной гидратации
  const hydrated = profileHydrated && progressHydrated && diaryHydrated;

  const [config, setConfig] = useState<WorkoutConfig>(
    () =>
      workoutCache?.config ?? {
        duration: 45,
        intensity: "medium",
        safety: "smart",
        focus: "all",
      },
  );
  // Источник подбора техник: профиль (пояс/цель) или дневник (что реально отрабатывал).
  // Явный ?src= из «Моей игры» важнее кэша.
  const [source, setSource] = useState<"profile" | "diary">(
    () => initialSource ?? workoutCache?.source ?? "profile",
  );
  // Кэш с другим источником не подходит: ?src=diary должен дать план по дневнику
  const [workout, setWorkout] = useState<Workout | null>(() =>
    initialSource && workoutCache && workoutCache.source !== initialSource
      ? null
      : workoutCache?.workout ?? null,
  );

  const generate = (cfg: WorkoutConfig, src: "profile" | "diary"): Workout =>
    src === "diary"
      ? generateWorkoutFromDiary(cfg, profile, progress, entries)
      : generateWorkout(cfg, profile);

  // Готовый план сразу при заходе: генерация только на клиенте после гидратации
  // (в генераторе Math.random — на SSR дал бы hydration mismatch)
  useEffect(() => {
    if (hydrated && !workout) setWorkout(generate(config, source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, workout]);

  // Держим кэш в актуальном состоянии для восстановления после возврата
  useEffect(() => {
    if (workout) workoutCache = { workout, config, source };
  }, [workout, config, source]);

  // ?run=true без тренировки (свежая загрузка страницы) — выходим из режима раннера
  useEffect(() => {
    if (running && hydrated && !workout) onExitRun();
  }, [running, hydrated, workout, onExitRun]);

  if (running && workout) {
    return <WorkoutRunner workout={workout} onExit={onExitRun} />;
  }

  // Смена источника или настроек сразу пересобирает план: экран никогда не пустой
  const pickSource = (src: "profile" | "diary") => {
    setSource(src);
    if (hydrated) setWorkout(generate(config, src));
  };
  const applyConfig = (patch: Partial<WorkoutConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    if (hydrated) setWorkout(generate(next, source));
    track("workout_filter", undefined, { dailyDedup: true });
  };
  const handleGenerate = () => setWorkout(generate(config, source));

  return (
    <div className="space-y-5">
      {/* Источник — две кнопки отдельно на поле: тап сразу даёт готовый план */}
      <div className="grid grid-cols-2 gap-2">
        <SourceTile
          active={source === "profile"}
          onClick={() => pickSource("profile")}
          icon={<UserRound className="h-4 w-4" />}
          title="По профилю"
          desc="Пояс, формат и цель"
        />
        <SourceTile
          active={source === "diary"}
          onClick={() => pickSource("diary")}
          icon={<NotebookPen className="h-4 w-4" />}
          title="По дневнику"
          desc="Что реально тренируешь"
        />
      </div>

      {source === "diary" && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {entries.length === 0
            ? "Дневник пуст — план соберётся по профилю. Отмечайте тренировки, и он станет точнее."
            : `Учтём ${entries.length} ${entries.length === 1 ? "запись" : entries.length < 5 ? "записи" : "записей"}: приоритет — техники в процессе и те, что давно не отрабатывали.`}
        </p>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">

        <FilterRow label="Длительность" icon={<Timer className="h-4 w-4" />}>
          {DURATIONS.map((d) => (
            <Chip key={d} active={config.duration === d} onClick={() => applyConfig({ duration: d })}>
              {d} мин
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Интенсивность" icon={<Flame className="h-4 w-4" />}>
          {INTENSITIES.map((i) => (
            <Chip
              key={i.value}
              active={config.intensity === i.value}
              onClick={() => applyConfig({ intensity: i.value })}
            >
              {i.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Безопасность" icon={<Sparkles className="h-4 w-4" />}>
          {SAFETY.map((s) => (
            <Chip
              key={s.value}
              active={config.safety === s.value}
              onClick={() => applyConfig({ safety: s.value })}
              title={s.desc}
            >
              {s.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Фокус">
          {FOCUSES.map((g) => (
            <Chip key={g} active={config.focus === g} onClick={() => applyConfig({ focus: g })}>
              {g === "all" ? "Все" : GROUP_LABEL[g]}
            </Chip>
          ))}
        </FilterRow>

        <Button variant="primary" size="lg" fullWidth onClick={handleGenerate} className="shadow-sm">
          Сгенерировать заново
        </Button>
      </section>

      {workout && (
        <section className="space-y-4">
          {/* Рамкой, а не заливкой: главное действие экрана выше — генератор */}
          <Button
            variant="soft"
            size="lg"
            fullWidth
            onClick={() => { track("workout_run", source); onRun(); }}
            className="border-2 border-ring text-foreground"
          >
            <Play className="h-4 w-4" />
            Запустить тренировку
          </Button>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              План · {workout.totalMinutes} мин
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
              <Stat label="Разминка" value={`${workout.warmupMinutes} мин`} />
              <Stat label="Основа" value={`${workout.mainMinutes} мин`} />
              <Stat label="Заминка" value={`${workout.cooldownMinutes} мин`} />
            </div>
          </div>

          {workout.message && (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              {workout.message}
            </div>
          )}

          <Section
            title="Разминка"
            subtitle={`${workout.warmupMinutes} мин`}
            icon={<Flame className="h-4 w-4" style={{ color: "var(--brand-gold-ink)" }} />}
          >
            <ul className="space-y-2">
              {workout.warmup.map((w, i) => (
                <ItemRow key={i} title={w.name} desc={w.desc} time={`${w.duration} мин`} />
              ))}
            </ul>
          </Section>

          {workout.drills.length > 0 && (
            <Section
              title="Основная часть"
              subtitle={`${workout.drills.length} техник × ${workout.drills[0].minutes} мин`}
              icon={<Sparkles className="h-4 w-4" style={{ color: "var(--color-primary)" }} />}
            >
              <ul className="space-y-2">
                {workout.drills.map((d) => (
                  <li key={d.technique.id}>
                    <Link to="/technique/$id" params={{ id: String(d.technique.id) }} className="block">
                      <TechniqueCard
                        technique={d.technique}
                        status={progress[d.technique.id] ?? "not_started"}
                        onCycleStatus={cycleStatus}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Заминка"
            subtitle={`${workout.cooldownMinutes} мин`}
            icon={<Snowflake className="h-4 w-4" style={{ color: "var(--status-done)" }} />}
          >
            <ul className="space-y-2">
              {workout.cooldown.map((w, i) => (
                <ItemRow key={i} title={w.name} desc={w.desc} time={`${w.duration} мин`} />
              ))}
            </ul>
          </Section>
        </section>
      )}
    </div>
  );
}

// Кнопка источника подбора: та же семья, что плитки выбора (border-2 + подсветка)
function SourceTile({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-all ${
        active ? "border-ring bg-primary/10" : "border-border bg-card"
      }`}
    >
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? "" : "text-muted-foreground"}`}>
        {icon}
        {title}
      </span>
      <span className="text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </header>
      {children}
    </section>
  );
}

function ItemRow({ title, desc, time }: { title: string; desc: string; time: string }) {
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {time}
        </span>
      </div>
    </li>
  );
}
