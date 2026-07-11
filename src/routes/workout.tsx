import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { Scenarios } from "@/components/bjj/Scenarios";
import { useProfile, useProgress } from "@/lib/bjj/store";
import { generateWorkout } from "@/lib/bjj/workout";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import type {
  Group,
  Intensity,
  SafetyMode,
  Workout,
  WorkoutConfig,
} from "@/lib/bjj/types";
import { Flame, Snowflake, Sparkles, Timer, Dumbbell, Swords } from "lucide-react";

export const Route = createFileRoute("/workout")({
  component: WorkoutPage,
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
  const [tab, setTab] = useState<"generator" | "scenarios">("generator");
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
          <SubTab active={tab === "generator"} onClick={() => setTab("generator")} icon={<Dumbbell className="h-4 w-4" />}>
            Генератор
          </SubTab>
          <SubTab active={tab === "scenarios"} onClick={() => setTab("scenarios")} icon={<Swords className="h-4 w-4" />}>
            Сценарии
          </SubTab>
        </div>

        {tab === "generator" ? <WorkoutGenerator /> : <Scenarios />}
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

function WorkoutGenerator() {
  const { profile } = useProfile();
  const { progress, cycleStatus } = useProgress();

  const [config, setConfig] = useState<WorkoutConfig>({
    duration: 45,
    intensity: "medium",
    safety: "smart",
    focus: "all",
  });
  const [workout, setWorkout] = useState<Workout | null>(null);

  const handleGenerate = () => {
    setWorkout(generateWorkout(config, profile));
  };

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Row label="Длительность" icon={<Timer className="h-4 w-4" />}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              active={config.duration === d}
              onClick={() => setConfig((c) => ({ ...c, duration: d }))}
            >
              {d} мин
            </Chip>
          ))}
        </Row>

        <Row label="Интенсивность" icon={<Flame className="h-4 w-4" />}>
          {INTENSITIES.map((i) => (
            <Chip
              key={i.value}
              active={config.intensity === i.value}
              onClick={() => setConfig((c) => ({ ...c, intensity: i.value }))}
            >
              {i.label}
            </Chip>
          ))}
        </Row>

        <Row label="Безопасность" icon={<Sparkles className="h-4 w-4" />}>
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
        </Row>

        <Row label="Фокус">
          {FOCUSES.map((g) => (
            <Chip
              key={g}
              active={config.focus === g}
              onClick={() => setConfig((c) => ({ ...c, focus: g }))}
            >
              {g === "all" ? "Все" : GROUP_LABEL[g]}
            </Chip>
          ))}
        </Row>

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
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
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
                    <TechniqueCard
                      technique={d.technique}
                      status={progress[d.technique.id] ?? "not_started"}
                      onCycleStatus={cycleStatus}
                    />
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

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active
          ? "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))"
          : "var(--color-card)",
        color: active ? "var(--color-primary)" : "var(--color-foreground)",
      }}
    >
      {children}
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
