import { Fragment, useMemo, useState } from "react";
import { Button, Sheet } from "@/components/bjj/ui";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { useProgress } from "@/lib/bjj/store";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_ORDER, BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Technique } from "@/lib/bjj/types";
import { Award, Target, ChevronDown } from "lucide-react";

// Шторка «Прогресс»: пояса и группы, переехавшие со страницы «Моя игра».
// Открывается тапом по hero-карточке «Прогресс» (как профиль открывает
// CharacterSheet). Аккордеон групп перенесён как был.
export function ProgressSheet({ onClose }: { onClose: () => void }) {
  const { progress } = useProgress();
  // Раскрытая группа: тап по карточке — список её техник
  const [openGroup, setOpenGroup] = useState<keyof typeof GROUP_LABEL | null>(null);

  const beltStats = useMemo(() => {
    return BELT_ORDER.map((belt) => {
      const techniques = TECHNIQUES.filter((t) => t.belt === belt);
      const done = techniques.filter((t) => progress[t.id] === "done").length;
      const total = techniques.length;
      return { belt, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    }).filter((s) => s.total > 0);
  }, [progress]);

  const groupStats = useMemo(() => {
    const groups = Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[];
    return groups.map((group) => {
      const techniques = TECHNIQUES.filter((t) => t.group === group);
      const done = techniques.filter((t) => progress[t.id] === "done").length;
      const total = techniques.length;
      return { group, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    }).filter((s) => s.total > 0);
  }, [progress]);

  // Техники раскрытой группы: изученные и в процессе сверху, дальше по поясам
  const groupTechniques = useMemo(() => {
    if (!openGroup) return [];
    const rank = (t: Technique) => {
      const s = progress[t.id] ?? "not_started";
      return s === "in_progress" ? 0 : s === "done" ? 1 : 2;
    };
    return TECHNIQUES.filter((t) => t.group === openGroup).sort(
      (a, b) =>
        rank(a) - rank(b) ||
        BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) ||
        a.difficulty - b.difficulty,
    );
  }, [openGroup, progress]);

  return (
    <Sheet kicker="Моя игра" title="Прогресс" onClose={onClose}>
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Прогресс по поясам</h2>
        </div>
        <div className="space-y-3">
          {beltStats.map(({ belt, done, total, pct }) => (
            <div key={belt}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-6 rounded-sm ring-1 ring-black/10"
                    style={{ background: `var(--belt-${belt})` }}
                  />
                  <span className="font-medium">{BELT_LABEL[belt]}</span>
                </div>
                <span className="text-muted-foreground">
                  {done}/{total} · {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `var(--belt-${belt})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Прогресс по группам</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groupStats.map(({ group, done, total, pct }) => (
            <Fragment key={group}>
              <button
                type="button"
                onClick={() => setOpenGroup((g) => (g === group ? null : group))}
                aria-expanded={openGroup === group}
                className="rounded-xl border-2 bg-background p-3 text-left transition-all"
                style={{
                  borderColor: openGroup === group ? "var(--color-ring)" : "var(--color-border)",
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {GROUP_LABEL[group]}
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openGroup === group ? "rotate-180" : ""}`}
                    />
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {/* Аккордеон: список техник сразу под нажатой группой, на всю ширину ряда */}
              {openGroup === group && (
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold">
                      {GROUP_LABEL[group]}{" "}
                      <span className="font-normal text-muted-foreground">({groupTechniques.length})</span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setOpenGroup(null)}>
                      Свернуть
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {groupTechniques.map((t) => (
                      <li key={t.id}>
                        <TechniqueRow technique={t} inset />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </section>
    </Sheet>
  );
}
