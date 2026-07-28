import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ArrowLeft, SearchX } from "lucide-react";
import { Sheet, EmptyState } from "@/components/bjj/ui";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { TECHNIQUES } from "@/lib/bjj/data";
import { reverseCandidates, type Scenario, type Region } from "@/lib/bjj/reverseSearch";
import { track } from "@/lib/bjj/telemetry";

// Обратный поиск: «опиши, что со мной случилось» -> кандидаты. Шторка из поиска
// Библиотеки. Для новичка, который не знает названия. Не отдельная вкладка.

const SCENARIOS: { key: Scenario; label: string; sub: string }[] = [
  { key: "submission", label: "Заставили сдаться, было больно", sub: "удушение или болевой" },
  { key: "control", label: "Прижали, не мог двигаться", sub: "контроль сверху" },
  { key: "takedown", label: "Свалили в стойке", sub: "тейкдаун" },
];
const REGIONS: { key: Region; label: string }[] = [
  { key: "neck", label: "Шея, душили" },
  { key: "arm", label: "Рука, ломали" },
  { key: "leg", label: "Нога, крутили" },
];
const POSITIONS: { id: number; label: string }[] = [
  { id: 13, label: "Сбоку (сайд-контроль)" },
  { id: 15, label: "Сверху (маунт)" },
  { id: 25, label: "Колено на животе" },
  { id: 18, label: "Взяли спину" },
  { id: 20, label: "В черепахе" },
];

function OptionButton({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function ReverseSearch({ onClose }: { onClose: () => void }) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [position, setPosition] = useState<number | null>(null);

  // Готов ли запрос: сабмишен нужен регион; контроль нужна позиция; тейкдаун сразу
  const ready =
    scenario === "takedown" ||
    (scenario === "submission" && region != null) ||
    (scenario === "control" && position != null);

  const results = useMemo(() => {
    if (!ready || !scenario) return [];
    return reverseCandidates(TECHNIQUES, {
      scenario,
      region: region ?? undefined,
      fromPosition: position ?? undefined,
    });
  }, [ready, scenario, region, position]);

  useEffect(() => {
    if (ready && scenario) track("reverse_search", `${scenario}:${region ?? position ?? "-"}`);
  }, [ready, scenario, region, position]);

  const back = () => {
    if (region != null) setRegion(null);
    else if (position != null) setPosition(null);
    else setScenario(null);
  };

  const title = !scenario
    ? "Что со мной случилось?"
    : !ready
      ? scenario === "submission"
        ? "Куда пришлось?"
        : "Где держали?"
      : "Похоже на это?";

  return (
    <Sheet
      kicker="Не знаешь названия"
      title={title}
      subtitle={ready ? "Тапни технику - покажем, как защититься" : undefined}
      onClose={onClose}
    >
      {scenario && (
        <button
          type="button"
          onClick={back}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
      )}

      {!scenario && (
        <div className="space-y-2">
          {SCENARIOS.map((s) => (
            <OptionButton key={s.key} label={s.label} sub={s.sub} onClick={() => setScenario(s.key)} />
          ))}
        </div>
      )}

      {scenario === "submission" && region == null && (
        <div className="space-y-2">
          {REGIONS.map((r) => (
            <OptionButton key={r.key} label={r.label} onClick={() => setRegion(r.key)} />
          ))}
        </div>
      )}

      {scenario === "control" && position == null && (
        <div className="space-y-2">
          {POSITIONS.map((p) => (
            <OptionButton key={p.id} label={p.label} onClick={() => setPosition(p.id)} />
          ))}
        </div>
      )}

      {ready && (
        <div className="space-y-2">
          {results.length ? (
            results.map((t) => <TechniqueRow key={t.id} technique={t} />)
          ) : (
            <EmptyState icon={<SearchX className="h-5 w-5" />} title="Ничего не нашлось" hint="Попробуй другую ветку или обычный поиск." />
          )}
        </div>
      )}
    </Sheet>
  );
}
