import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ArrowLeft, SearchX } from "lucide-react";
import { Sheet, EmptyState } from "@/components/bjj/ui";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { TECHNIQUES } from "@/lib/bjj/data";
import { reverseCandidates, type Scenario, type Region } from "@/lib/bjj/reverseSearch";
import { track } from "@/lib/bjj/telemetry";

// Найди приём по описанию: новичок не знает названия того, что показали или чем
// поймали -> описывает простыми словами -> открываем карточку. Шторка из поиска
// Библиотеки, не отдельная вкладка. Просто помогаем найти, ничего не обещаем сверх.

const SCENARIOS: { key: Scenario; label: string; sub: string }[] = [
  { key: "submission", label: "Душили или было больно", sub: "удушение или болевой" },
  { key: "takedown", label: "Свалили в стойке", sub: "бросок" },
  { key: "sweep", label: "Перевернули снизу", sub: "свип" },
  { key: "pass", label: "Прошли мои ноги", sub: "проход гарда" },
  { key: "escape", label: "Держали, не мог выйти", sub: "выход из-под контроля" },
];
const REGIONS: { key: Region; label: string }[] = [
  { key: "neck", label: "Шея (душили)" },
  { key: "arm", label: "Рука (выкручивали, ломали)" },
  { key: "leg", label: "Нога (стопа или колено)" },
];
const POSITIONS: { id: number; label: string }[] = [
  { id: 13, label: "Сбоку" },
  { id: 15, label: "Сел на грудь" },
  { id: 18, label: "Со спины" },
  { id: 25, label: "Коленом на живот" },
  { id: 20, label: "Я был на четвереньках" },
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

  // Второй шаг нужен только сабмишену (регион) и выходу (позиция); остальным - сразу список
  const needsRegion = scenario === "submission";
  const needsPosition = scenario === "escape";
  const ready =
    scenario != null &&
    (needsRegion ? region != null : needsPosition ? position != null : true);

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
    ? "Что это было?"
    : !ready
      ? needsRegion
        ? "Куда пришлось?"
        : "Где держали?"
      : "Похоже на это?";

  return (
    <Sheet
      kicker="Найди приём по описанию"
      title={title}
      subtitle={ready ? "Тапни - откроем карточку приёма" : undefined}
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

      {needsRegion && region == null && (
        <div className="space-y-2">
          {REGIONS.map((r) => (
            <OptionButton key={r.key} label={r.label} onClick={() => setRegion(r.key)} />
          ))}
        </div>
      )}

      {needsPosition && position == null && (
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
