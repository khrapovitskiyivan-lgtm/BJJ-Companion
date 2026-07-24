import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Sheet, buttonClass } from "@/components/bjj/ui";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { STAT_META } from "@/lib/bjj/stats";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { track } from "@/lib/bjj/telemetry";
import type { EntryReward } from "@/lib/bjj/reward";
import type { EntryXpReward } from "@/lib/bjj/xp";
import { CalendarDays, Dumbbell, Flame, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

// Экран награды после сохранения записи дневника: 2-3 дельты каскадом.
// Золото строго у достижений (квота недели, сверх плана, серия дней) —
// правило языка цвета из дизайн-системы; защита и стат в тоне primary.

function fmtPct(v: number): string {
  return v.toFixed(1).replace(".", ",");
}

function weekWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "недель";
  if (d10 === 1) return "неделя";
  if (d10 >= 2 && d10 <= 4) return "недели";
  return "недель";
}

function dayWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "дней";
  if (d10 === 1) return "день";
  if (d10 >= 2 && d10 <= 4) return "дня";
  return "дней";
}

function trainWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "тренировок";
  if (d10 === 1) return "тренировка";
  if (d10 >= 2 && d10 <= 4) return "тренировки";
  return "тренировок";
}

function razWord(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "раз";
  if (d10 >= 2 && d10 <= 4) return "раза";
  return "раз";
}

const CARD = "rounded-xl border border-border bg-card p-3 animate-in fade-in slide-in-from-bottom-2 duration-300";
const cardDelay = (i: number) => ({ animationDelay: `${i * 130}ms`, animationFillMode: "both" as const });

export function EntryRewardSheet({
  reward,
  techniqueIds,
  xp,
  onClose,
}: {
  reward: EntryReward;
  techniqueIds: number[];
  xp?: EntryXpReward;
  onClose: () => void;
}) {
  const { week, stat, defense } = reward;

  // Бар стата и XP: монтируемся на «до», после появления карточек переезжаем на «после»
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrow(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Телеметрия перехода уровня. dailyDedup: уровень достигается один раз, дедуп по
  // (событие+уровень) гасит повторный вызов (StrictMode/перемонтирование шторки).
  useEffect(() => {
    if (xp?.leveledUp) track("level_up", String(xp.level), { dailyDedup: true });
  }, [xp]);

  const goldWeek = week.kind === "plan" ? week.hitNow || week.over : week.streak >= 2;
  let weekTitle: string;
  let weekSub: string;
  if (week.kind === "plan") {
    if (week.hitNow) {
      weekTitle = "Неделя в плане!";
      weekSub =
        week.weekStreak > 1
          ? `Серия: ${week.weekStreak} ${weekWord(week.weekStreak)} подряд`
          : `Квота добита: ${week.done} из ${week.quota}`;
    } else if (week.over) {
      weekTitle = "Сверх плана!";
      weekSub = `На этой неделе: ${week.done} при плане ${week.quota}`;
    } else if (week.done < week.quota) {
      weekTitle = `Неделя: ${week.done} из ${week.quota}`;
      const left = week.quota - week.done;
      weekSub = `Ещё ${left} ${trainWord(left)} до плана`;
    } else {
      // вторая запись в уже закрытый день или неделя уже была в плане
      weekTitle = `Неделя: ${week.done} из ${week.quota}`;
      weekSub = "План недели закрыт";
    }
  } else {
    weekTitle = week.streak >= 2 ? `${week.streak} ${dayWord(week.streak)} подряд` : "Тренировка записана";
    weekSub = week.streak >= 2 ? "Так держать" : "Отмечай каждую тренировку";
  }

  let idx = 0;
  const statDelta = stat ? stat.pctAfter - stat.pctBefore : 0;

  return (
    <Sheet kicker="Дневник" title="Записано!" onClose={onClose}>
      <div className="space-y-2.5">
        {xp && (
          <div className={CARD} style={cardDelay(idx++)}>
            <div className="flex items-start gap-2.5">
              <Sparkles
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: xp.leveledUp ? "var(--brand-gold-ink)" : "var(--color-primary)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <p
                      className="text-sm font-semibold"
                      style={xp.leveledUp ? { color: "var(--brand-gold-ink)" } : undefined}
                    >
                      {xp.leveledUp ? "Новый уровень!" : "Опыт"}
                    </p>
                    {xp.leveledUp && (
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-tight text-white" style={{ background: "var(--brand-gold-ink)" }}>
                        LVL {xp.level}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-primary">+{xp.delta} XP</span>
                </div>
                {xp.beltBonus > 0 && (
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--brand-gold-ink)" }}>
                    Бонус за развитие: +{xp.beltBonus}
                  </p>
                )}
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: `${grow ? Math.round((xp.xpIntoLevel / xp.xpForLevel) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  ещё {xp.xpForLevel - xp.xpIntoLevel} XP до LVL {xp.level + 1}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={CARD} style={cardDelay(idx++)}>
          <div className="flex items-start gap-2.5">
            {goldWeek ? (
              <Flame className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--brand-gold-ink)" }} />
            ) : week.kind === "plan" ? (
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            ) : (
              <Flame className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={goldWeek ? { color: "var(--brand-gold-ink)" } : undefined}>
                {weekTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{weekSub}</p>
            </div>
          </div>
        </div>

        {stat && (
          <div className={CARD} style={cardDelay(idx++)}>
            <div className="flex items-start gap-2.5">
              <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{STAT_META[stat.stat].ru}</p>
                  <span className="text-xs font-bold tabular-nums text-primary">+{fmtPct(statDelta)}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                    style={{ width: `${grow ? stat.pctAfter : stat.pctBefore}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  В записи: {stat.count} техн. этого стата
                </p>
              </div>
            </div>
          </div>
        )}

        {defense && (
          <div className={CARD} style={cardDelay(idx++)}>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Закрываешь дыру</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {defense.defense.nameRu}: ответ на «{defense.catcher.nameRu}» (ловили{" "}
                  {defense.timesCaught} {razWord(defense.timesCaught)})
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {techniqueIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Разбери показанное
          </p>
          {techniqueIds.map((id) => {
            const t = TECH_BY_ID[id];
            if (!t) return null;
            return (
              <div key={id} onClick={() => track("review_opened", String(id))}>
                <TechniqueRow technique={t} inset />
              </div>
            );
          })}
          <Link
            to="/workout"
            search={{ src: "diary" }}
            onClick={() => track("review_drill")}
            className={buttonClass("soft", "md", "w-full")}
          >
            <Dumbbell className="h-4 w-4" />
            В отработку
          </Link>
        </div>
      )}

      <Button variant="primary" size="lg" onClick={onClose} className="w-full">
        Отлично
      </Button>
    </Sheet>
  );
}
