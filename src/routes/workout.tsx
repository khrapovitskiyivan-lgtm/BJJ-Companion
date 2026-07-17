import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { Scenarios } from "@/components/bjj/Scenarios";
import { useDiary, useProfile, useProgress } from "@/lib/bjj/store";
import { generateWorkout, generateWorkoutFromDiary } from "@/lib/bjj/workout";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import type {
  Group,
  Intensity,
  SafetyMode,
  Workout,
  WorkoutConfig,
} from "@/lib/bjj/types";
import { Chip, FilterRow } from "@/components/bjj/ui";
import { WorkoutRunner } from "@/components/bjj/WorkoutRunner";
import { Flame, Snowflake, Sparkles, Timer, Dumbbell, Swords, NotebookPen, Play } from "lucide-react";

export const Route = createFileRoute("/workout")({
  component: WorkoutPage,
  // Вкладка, активный сценарий и режим раннера в search-параметрах:
  // переживают уход на карточку техники и возврат
  validateSearch: (search: Record<string, unknown>): { tab?: "scenarios"; s?: string; run?: boolean } => {
    const out: { tab?: "scenarios"; s?: string; run?: boolean } = {};
    if (search.tab === "scenarios") out.tab = "scenarios";
    if (typeof search.s === "string" && search.s) out.s = search.s;
    if (search.run === true || search.run === "true") out.run = true;
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
  const { tab: tabParam, s, run } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = tabParam ?? "generator";
  return (
    <AppShell>
      <div className="space-y-4">
        <header className="px-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Тренировка</p>
          <h1 className="text-xl font-bold tracking-tight">
            {tab === "generator" ? "Умная тренировка" : "Отработка сценариев"}
          </h1>
        </header>

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
  onRun,
  onExitRun,
}: {
  running: boolean;
  onRun: () => void;
  onExitRun: () => void;
}) {
  const { profile } = useProfile();
  const { progress, cycleStatus } = useProgress();
  const { entries } = useDiary();

  const [config, setConfig] = useState<WorkoutConfig>(
    () =>
      workoutCache?.config ?? {
        duration: 45,
        intensity: "medium",
        safety: "smart",
        focus: "all",
      },
  );
  // Источник подбора техник: профиль (пояс/цель) или дневник (что реально отрабатывал)
  const [source, setSource] = useState<"profile" | "diary">(() => workoutCache?.source ?? "profile");
  const [workout, setWorkout] = useState<Workout | null>(() => workoutCache?.workout ?? null);

  // Держим кэш в актуальном состоянии для восстановления после возврата
  useEffect(() => {
    if (workout) workoutCache = { workout, config, source };
  }, [workout, config, source]);

  // ?run=true без тренировки (свежая загрузка страницы) — выходим из режима раннера
  useEffect(() => {
    if (running && !workout) onExitRun();
  }, [running, workout, onExitRun]);

  if (running && workout) {
    return <WorkoutRunner workout={workout} onExit={onExitRun} />;
  }

  const handleGenerate = () => {
    setWorkout(
      source === "diary"
        ? generateWorkoutFromDiary(config, profile, progress, entries)
        : generateWorkout(config, profile),
    );
  };

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <FilterRow label="Подбор" icon={<NotebookPen className="h-4 w-4" />}>
          <Chip
            active={source === "profile"}
            onClick={() => setSource("profile")}
            title="По поясу и настройкам профиля"
          >
            По профилю
          </Chip>
          <Chip
            active={source === "diary"}
            onClick={() => setSource("diary")}
            title="По дневнику: что учишь сейчас и что давно не отрабатывал"
          >
            По дневнику
          </Chip>
        </FilterRow>

        {source === "diary" && (
          <p className="-mt-2 text-[11px] text-muted-foreground">
            {entries.length === 0
              ? "Дневник пуст — план соберётся по профилю. Отмечайте тренировки, и он станет точнее."
              : `Учтём ${entries.length} ${entries.length === 1 ? "запись" : entries.length < 5 ? "записи" : "записей"}: приоритет — техники в процессе и те, что давно не отрабатывали.`}
          </p>
        )}

        <FilterRow label="Длительность" icon={<Timer className="h-4 w-4" />}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              active={config.duration === d}
              onClick={() => setConfig((c) => ({ ...c, duration: d }))}
            >
              {d} мин
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Интенсивность" icon={<Flame className="h-4 w-4" />}>
          {INTENSITIES.map((i) => (
            <Chip
              key={i.value}
              active={config.intensity === i.value}
              onClick={() => setConfig((c) => ({ ...c, intensity: i.value }))}
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
              onClick={() => setConfig((c) => ({ ...c, safety: s.value }))}
              title={s.desc}
            >
              {s.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Фокус">
          {FOCUSES.map((g) => (
            <Chip
              key={g}
              active={config.focus === g}
              onClick={() => setConfig((c) => ({ ...c, focus: g }))}
            >
              {g === "all" ? "Все" : GROUP_LABEL[g]}
            </Chip>
          ))}
        </FilterRow>

        <button
          type="button"
          onClick={handleGenerate}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          {workout ? "Сгенерировать заново" : "Сгенерировать тренировку"}
        </button>
      </section>

      {workout && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={onRun}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ring bg-primary/10 py-3 text-sm font-semibold text-foreground transition hover:bg-primary/15"
          >
            <Play className="h-4 w-4" />
            Запустить тренировку
          </button>
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
            icon={<Flame className="h-4 w-4" style={{ color: "var(--status-progress)" }} />}
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
