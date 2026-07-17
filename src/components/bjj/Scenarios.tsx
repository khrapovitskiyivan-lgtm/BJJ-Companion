import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TECH_BY_ID } from "@/lib/bjj/data";
import type { Technique } from "@/lib/bjj/types";
import { Timer, Play, Pause, X, RotateCcw } from "lucide-react";

// Сценарии спаррингов из заданной позиции + таймер (перенесено из «Решений»).
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
  { id: "sweep_from_guard", title: "Свипы из гарда", description: "Начните из закрытого гарда снизу. Цель: сделать свип.", startPositions: [1], goalPositions: [14, 16], duration: 180 },
  { id: "back_control", title: "Взятие спины", description: "Начните из сайд-контроля. Цель: взять спину.", startPositions: [14], goalPositions: [17], duration: 180 },
  { id: "submission_hunt", title: "Охота за сабмишеном", description: "Начните из маунта. Цель: завершить сабмишен.", startPositions: [16], goalPositions: [], duration: 180 },
  { id: "escape_mount", title: "Выход из маунта", description: "Начните из маунта снизу. Цель: восстановить гард.", startPositions: [15], goalPositions: [1, 17], duration: 180 },
  { id: "takedown", title: "Тейкдауны", description: "Начните из стойки. Цель: сделать тейкдаун.", startPositions: [21], goalPositions: [14, 16, 17], duration: 180 },
  { id: "leg_locks", title: "Болевые на ноги", description: "Начните из Single Leg X. Цель: атаковать ногу.", startPositions: [300], goalPositions: [], duration: 180 },
  { id: "turtle_attack", title: "Атака черепахи", description: "Начните сверху в черепахе. Цель: взять спину.", startPositions: [19], goalPositions: [17], duration: 180 },
];

// Активный сценарий приходит search-параметром из /workout: переживает уход
// на карточку техники, «назад» возвращает в текущий сценарий, а не к выбору.
export function Scenarios({
  activeId,
  onSelect,
  onExit,
}: {
  activeId?: string;
  onSelect: (id: string) => void;
  onExit: () => void;
}) {
  const active = activeId ? SCENARIOS.find((x) => x.id === activeId) ?? null : null;
  if (active) return <ScenarioRunner scenario={active} onExit={onExit} />;
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        Спарринг из заданной позиции: выберите сценарий, договоритесь с партнёром и запустите таймер.
      </p>
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
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

// Остаток таймера на время сессии: заглянул в технику и вернулся — таймер не сбросился (на паузе)
let runnerCache: { id: string; left: number } | null = null;

function ScenarioRunner({ scenario, onExit }: { scenario: Scenario; onExit: () => void }) {
  const [left, setLeft] = useState(() =>
    runnerCache?.id === scenario.id ? runnerCache.left : scenario.duration,
  );
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    runnerCache = { id: scenario.id, left };
  }, [scenario.id, left]);

  useEffect(() => {
    if (paused || left <= 0) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [paused, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const starts = scenario.startPositions.map((i) => TECH_BY_ID[i]).filter(Boolean) as Technique[];
  const goals = scenario.goalPositions.map((i) => TECH_BY_ID[i]).filter(Boolean) as Technique[];

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
        К сценариям
      </button>
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{scenario.title}</p>
        <p className={`mt-2 font-mono text-5xl font-bold tabular-nums ${left === 0 ? "text-destructive" : ""}`}>
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
            onClick={() => { setLeft(scenario.duration); setPaused(true); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Сброс
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
