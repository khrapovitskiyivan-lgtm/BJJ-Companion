import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";
import { Lightbulb, Swords, Timer, Play, Pause, X, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/solutions")({
  component: SolutionsPage,
});

// === «ЧТО ДЕЛАТЬ, ЕСЛИ…» — позиции-ситуации (перенесено из bjj-map) ===
const SITUATIONS: { id: number; label: string }[] = [
  { id: 1, label: "Я в закрытом гарде снизу" },
  { id: 2, label: "Я в закрытом гарде сверху" },
  { id: 3, label: "Я в халф-гарде снизу" },
  { id: 4, label: "Я в халф-гарде сверху" },
  { id: 5, label: "Я в баттерфляе снизу" },
  { id: 6, label: "Я в баттерфляе сверху" },
  { id: 7, label: "Я в паук-гарде снизу" },
  { id: 8, label: "Я в де-ла-Рива снизу" },
  { id: 10, label: "Я в X-гарде снизу" },
  { id: 11, label: "Я в 50/50 гарде" },
  { id: 13, label: "Я в сайд-контроле снизу" },
  { id: 14, label: "Я в сайд-контроле сверху" },
  { id: 15, label: "Я в маунте снизу" },
  { id: 16, label: "Я в маунте сверху" },
  { id: 17, label: "Я контролирую спину" },
  { id: 18, label: "Соперник взял мою спину" },
  { id: 19, label: "Соперник в черепахе" },
  { id: 20, label: "Я в черепахе снизу" },
  { id: 21, label: "Мы в стойке" },
  { id: 22, label: "Я в север-юг сверху" },
  { id: 23, label: "Я в север-юг снизу" },
  { id: 24, label: "Колено на животе сверху" },
  { id: 25, label: "Колено на животе снизу" },
  { id: 300, label: "Я в Single Leg X" },
  { id: 610, label: "Я во фронт-хедлоке" },
];

// === СЦЕНАРИИ СПАРРИНГОВ (перенесено из bjj-map) ===
interface Scenario {
  id: string;
  title: string;
  description: string;
  startPositions: number[];
  goalPositions: number[];
  duration: number;
}
const SCENARIOS: Scenario[] = [
  { id: "guard_pass", title: "Проходы гарда", description: "Начните из закрытого гарда сверху. Цель: пройти гард.", startPositions: [2], goalPositions: [14, 16], duration: 180 },
  { id: "back_control", title: "Взятие спины", description: "Начните из сайд-контроля. Цель: взять спину.", startPositions: [14], goalPositions: [17], duration: 180 },
  { id: "submission_hunt", title: "Охота за сабмишеном", description: "Начните из маунта. Цель: завершить сабмишен.", startPositions: [16], goalPositions: [], duration: 180 },
  { id: "escape_mount", title: "Выход из маунта", description: "Начните из маунта снизу. Цель: восстановить гард.", startPositions: [15], goalPositions: [1, 17], duration: 180 },
  { id: "sweep_from_guard", title: "Свипы из гарда", description: "Начните из закрытого гарда снизу. Цель: сделать свип.", startPositions: [1], goalPositions: [14, 16], duration: 180 },
  { id: "takedown", title: "Тейкдауны", description: "Начните из стойки. Цель: сделать тейкдаун.", startPositions: [21], goalPositions: [14, 16, 17], duration: 180 },
  { id: "leg_locks", title: "Болевые на ноги", description: "Начните из Single Leg X. Цель: атаковать ногу.", startPositions: [300], goalPositions: [], duration: 180 },
  { id: "turtle_attack", title: "Атака черепахи", description: "Начните сверху в черепахе. Цель: взять спину.", startPositions: [19], goalPositions: [17], duration: 180 },
];

function SolutionsPage() {
  const [tab, setTab] = useState<"decide" | "spar">("decide");
  return (
    <AppShell>
      <div className="space-y-4">
        <header className="px-1">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">На татами</p>
          <h1 className="text-xl font-bold tracking-tight">Решения</h1>
        </header>

        <div className="grid grid-cols-2 gap-2">
          <TabButton active={tab === "decide"} onClick={() => setTab("decide")} icon={<Lightbulb className="h-4 w-4" />}>
            Что делать, если…
          </TabButton>
          <TabButton active={tab === "spar"} onClick={() => setTab("spar")} icon={<Swords className="h-4 w-4" />}>
            Сценарии
          </TabButton>
        </div>

        {tab === "decide" ? <DecideTab /> : <SparTab />}
      </div>
    </AppShell>
  );
}

function TabButton({
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

// === ТАБ «ЧТО ДЕЛАТЬ, ЕСЛИ…» ===
function DecideTab() {
  const [situationId, setSituationId] = useState<number | null>(null);
  const situation = situationId != null ? TECH_BY_ID[situationId] : null;

  const options = useMemo(() => {
    if (situationId == null) return null;
    const out: Record<string, Technique[]> = { attacks: [], sweeps: [], transitions: [], escapes: [] };
    const src = TECH_BY_ID[situationId];
    if (!src) return out;
    // исходящие связи позиции + техники, у которых эта позиция в setup_from
    const targets = new Set<number>(src.chain_to);
    for (const t of TECHNIQUES) {
      if (t.setup_from.includes(situationId)) targets.add(t.id);
    }
    for (const id of targets) {
      const t = TECH_BY_ID[id];
      if (!t || t.id === situationId) continue;
      if (t.group === "submission" || t.group === "guard_pass" || t.group === "takedown") out.attacks.push(t);
      else if (t.group === "sweep") out.sweeps.push(t);
      else if (t.group === "escape" || t.group === "retention") out.escapes.push(t);
      else out.transitions.push(t);
    }
    return out;
  }, [situationId]);

  if (situation && options) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSituationId(null)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          К ситуациям
        </button>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ваша ситуация</p>
          <h2 className="mt-0.5 text-base font-semibold">
            {SITUATIONS.find((s) => s.id === situationId)?.label ?? situation.nameRu}
          </h2>
        </div>
        <OptionSection title="Атаки" items={options.attacks} />
        <OptionSection title="Свипы" items={options.sweeps} />
        <OptionSection title="Переходы" items={options.transitions} />
        <OptionSection title="Выходы и защита" items={options.escapes} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        Выберите ситуацию — покажем, что из неё делать: атаки, свипы, переходы и выходы.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SITUATIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSituationId(s.id)}
            className="rounded-xl border border-border bg-card p-3 text-left text-xs font-medium transition hover:bg-muted"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionSection({ title, items }: { title: string; items: Technique[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({items.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {items.map((t) => (
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
    </section>
  );
}

// === ТАБ «СЦЕНАРИИ» ===
function SparTab() {
  const [active, setActive] = useState<Scenario | null>(null);
  if (active) return <ScenarioRunner scenario={active} onExit={() => setActive(null)} />;
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        Спарринг из заданной позиции: выберите сценарий, договоритесь с партнёром и запустите таймер.
      </p>
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          onClick={() => setActive(s)}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:bg-muted"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              {Math.floor(s.duration / 60)} мин
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
        </button>
      ))}
    </div>
  );
}

function ScenarioRunner({ scenario, onExit }: { scenario: Scenario; onExit: () => void }) {
  const [left, setLeft] = useState(scenario.duration);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    if (paused || left <= 0) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [paused, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const starts = scenario.startPositions.map((i) => TECH_BY_ID[i]).filter(Boolean);
  const goals = scenario.goalPositions.map((i) => TECH_BY_ID[i]).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{scenario.title}</p>
        <p
          className={`mt-2 font-mono text-5xl font-bold tabular-nums ${left === 0 ? "text-destructive" : ""}`}
        >
          {mm}:{ss}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{scenario.description}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            disabled={left === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? (left === scenario.duration ? "Старт" : "Продолжить") : "Пауза"}
          </button>
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </div>

      {starts.length > 0 && <PositionRow title="Стартовая позиция" items={starts} />}
      {goals.length > 0 && <PositionRow title="Цель" items={goals} />}
    </div>
  );
}

function PositionRow({ title, items }: { title: string; items: Technique[] }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Link
            key={t.id}
            to="/technique/$id"
            params={{ id: String(t.id) }}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs transition hover:bg-muted"
            style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
          >
            {t.nameRu}
          </Link>
        ))}
      </div>
    </section>
  );
}
