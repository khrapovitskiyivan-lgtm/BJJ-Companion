import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { useProgress } from "@/lib/bjj/store";
import { Button, Chip } from "@/components/bjj/ui";
import { unlockAudio } from "@/lib/bjj/sound";
import { track } from "@/lib/bjj/telemetry";
import { useRunner } from "@/lib/bjj/useRunner";
import type { RunSection } from "@/lib/bjj/runner";
import { TECH_BY_ID } from "@/lib/bjj/data";
import type { Technique } from "@/lib/bjj/types";
import { Play, Pause, ArrowLeft, RotateCcw } from "lucide-react";

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
          <h3 className="text-sm font-semibold">{s.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
        </button>
      ))}
    </div>
  );
}

// Остаток таймера на время сессии: заглянул в технику и вернулся — таймер не сбросился (на паузе)
let runnerCache: { id: string; left: number; duration: number } | null = null;

// Выбор времени раунда сценария
const SCENARIO_MINUTES = [3, 5];

function ScenarioRunner({ scenario, onExit }: { scenario: Scenario; onExit: () => void }) {
  const cached = runnerCache?.id === scenario.id ? runnerCache : null;
  const [duration, setDuration] = useState(cached?.duration ?? scenario.duration);
  // Один «раздел» на весь раунд: сигналы и настенные часы даёт общий useRunner
  const sections = useMemo<RunSection[]>(
    () => [{ key: "scenario", title: scenario.title, seconds: duration }],
    [scenario.title, duration],
  );
  const { phase, setPhase, paused, setPaused } = useRunner(
    sections,
    cached ? { sectionIdx: 0, left: cached.left, finished: cached.left === 0 } : undefined,
  );
  const left = phase.left;

  useEffect(() => {
    runnerCache = { id: scenario.id, left, duration };
  }, [scenario.id, left, duration]);

  // Смена времени раунда: сброс таймера на новую длительность
  const chooseMinutes = (mins: number) => {
    setDuration(mins * 60);
    setPhase({ sectionIdx: 0, left: mins * 60, finished: false });
    setPaused(true);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const starts = scenario.startPositions.map((i) => TECH_BY_ID[i]).filter(Boolean) as Technique[];
  const goals = scenario.goalPositions.map((i) => TECH_BY_ID[i]).filter(Boolean) as Technique[];

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        К сценариям
      </button>
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{scenario.title}</p>
        <p className={`mt-2 font-mono text-5xl font-bold tabular-nums ${left === 0 ? "text-destructive" : ""}`}>
          {mm}:{ss}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{scenario.description}</p>
        <div className="mt-3 flex justify-center gap-2">
          {SCENARIO_MINUTES.map((m) => (
            <Chip key={m} active={duration === m * 60} onClick={() => chooseMinutes(m)}>
              {m} мин
            </Chip>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              unlockAudio();
              // телеметрия только на старт раунда с нуля (не пауза/продолжить)
              if (paused && left === duration) track("scenario_run");
              setPaused((p) => !p);
            }}
            disabled={left === 0}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? (left === duration ? "Старт" : "Продолжить") : "Пауза"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setPhase({ sectionIdx: 0, left: duration, finished: false }); setPaused(true); }}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Сброс
          </Button>
        </div>
      </div>

      {starts.length > 0 && <PositionRow title="Стартовая позиция" items={starts} />}
      {goals.length > 0 && <PositionRow title="Цель" items={goals} />}
    </div>
  );
}

function PositionRow({ title, items }: { title: string; items: Technique[] }) {
  const { progress, cycleStatus } = useProgress();
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link to="/technique/$id" params={{ id: String(t.id) }} className="block">
              <TechniqueCard
                technique={t}
                status={progress[t.id] ?? "not_started"}
                onCycleStatus={cycleStatus}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
