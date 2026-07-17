import { Fragment, useMemo, useState } from "react";
import type { DiaryEntry, Frequency } from "@/lib/bjj/types";
import { dayKey, monthGrid, trainedByDate, weekStatus, monthSummary } from "@/lib/bjj/plan";
import { IconButton } from "@/components/bjj/ui";
import { Flame, ChevronLeft, ChevronRight, CalendarCog } from "lucide-react";

// Календарь месяца от плановой частоты: тренировочные дни, недельные квоты,
// недобор закрытых недель, сверхплановые дни и итог месяца.
// Без частоты — календарь без квот и кнопка «Указать частоту» (лист игрока).

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const VERDICT_LABEL: Record<string, string> = {
  under: "план не выполнен",
  met: "план выполнен",
  over: "план перевыполнен",
  on_track: "идёшь по плану",
  behind: "отстаёшь от плана",
};

export function ActivityHeatmap({
  entries,
  frequency,
  onSetFrequency,
}: {
  entries: DiaryEntry[];
  frequency?: Frequency;
  onSetFrequency?: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  const trained = useMemo(() => trainedByDate(entries), [entries]);

  // Стрик: подряд идущие дни с активностью, считая от сегодня (или вчера)
  const streak = useMemo(() => {
    let n = 0;
    const cursor = new Date(today);
    if (!trained.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (trained.has(dayKey(cursor))) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [trained]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const max = Math.max(1, ...trained.values());

  // Назад — не раньше месяца самой старой записи, вперёд — не дальше текущего
  const earliest = useMemo(() => {
    let min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    for (const k of trained.keys()) if (k.slice(0, 7) < min) min = k.slice(0, 7);
    return min;
  }, [trained]); // eslint-disable-line react-hooks/exhaustive-deps
  const viewYm = `${view.y}-${String(view.m + 1).padStart(2, "0")}`;
  const canPrev = viewYm > earliest;
  const canNext = view.y < today.getFullYear() || (view.y === today.getFullYear() && view.m < today.getMonth());
  const shift = (d: number) => setView(({ y, m }) => {
    const next = new Date(y, m + d, 1);
    return { y: next.getFullYear(), m: next.getMonth() };
  });

  const summary = frequency ? monthSummary(trained, frequency, view.y, view.m, today) : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Flame className="h-4 w-4 text-orange-500" />
          {streak} {streak === 1 ? "день" : streak >= 2 && streak <= 4 ? "дня" : "дней"} подряд
        </span>
        <span className="flex items-center gap-1 text-xs font-medium">
          <IconButton label="Предыдущий месяц" onClick={() => shift(-1)} disabled={!canPrev}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <span className="w-24 text-center">{MONTHS[view.m]} {view.y}</span>
          <IconButton label="Следующий месяц" onClick={() => shift(1)} disabled={!canNext}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </span>
      </div>

      {/* Сетка: 7 дней + колонка недельной квоты */}
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr)) 44px" }}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-0.5 text-center text-[10px] text-muted-foreground">{w}</span>
        ))}
        <span />
        {grid.map((week) => {
          const st = frequency ? weekStatus(week, trained, frequency, today) : null;
          return (
            <Fragment key={dayKey(week[0])}>
              {week.map((day) => {
              const key = dayKey(day);
              const count = trained.get(key) ?? 0;
              const inMonth = day.getMonth() === view.m;
              const isToday = key === dayKey(today);
              const overPlan = st?.overDates.has(key) ?? false;
              const bg =
                count === 0
                  ? "var(--color-muted)"
                  : `color-mix(in oklch, var(--color-primary) ${Math.round(Math.max(30, (count / max) * 100))}%, var(--color-muted))`;
              return (
                <div
                  key={key}
                  className={`relative grid h-8 place-items-center rounded-md text-[10px] tabular-nums ${
                    inMonth ? "" : "opacity-35"
                  } ${count > 0 ? "font-semibold text-primary-foreground" : "text-muted-foreground"}`}
                  style={{ background: bg, boxShadow: isToday ? "inset 0 0 0 1.5px var(--color-primary)" : undefined }}
                  title={count > 0 ? `${key}: техник ${count}${overPlan ? ", сверх плана" : ""}` : key}
                >
                  {day.getDate()}
                  {overPlan && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand-gold)" }} />}
                </div>
              );
              })}
              {/* Квота недели: счётчик, пунктирные слоты недобора, «+n» за сверхплан */}
              <div className="flex h-8 flex-col items-center justify-center gap-0.5">
                {st && !st.future && (
                  <>
                    <span
                      className={`text-[10px] tabular-nums ${st.closed && st.missed > 0 ? "text-muted-foreground" : st.over > 0 ? "font-semibold" : st.closed ? "font-semibold text-primary" : "text-muted-foreground"}`}
                      style={st.over > 0 ? { color: "var(--brand-gold-ink)" } : undefined}
                    >
                      {st.over > 0 ? `+${st.over}` : `${Math.min(st.done, st.quota)}/${st.quota}`}
                    </span>
                    {st.missed > 0 && (
                      <span className="flex gap-[2px]" title={`Пропущено: ${st.missed}`}>
                        {Array.from({ length: st.missed }, (_, i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-[2px] border border-dashed border-muted-foreground/60" />
                        ))}
                      </span>
                    )}
                  </>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Итог месяца или приглашение задать частоту */}
      <div className="mt-3 border-t border-border pt-2.5">
        {summary ? (
          <p className="text-xs text-muted-foreground">
            Сделано <span className="font-semibold text-foreground">{summary.done}</span> из {summary.plan}{" "}
            {summary.current ? "по плану месяца" : "за месяц"} ·{" "}
            <span
              className={
                summary.verdict === "over" ? "font-semibold"
                : summary.verdict === "met" || summary.verdict === "on_track" ? "font-semibold text-primary"
                : "font-medium"
              }
              style={summary.verdict === "over" ? { color: "var(--brand-gold-ink)" } : undefined}
            >
              {VERDICT_LABEL[summary.verdict]}
            </span>
          </p>
        ) : (
          <button
            onClick={onSetFrequency}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <CalendarCog className="h-3.5 w-3.5" />
            Указать частоту тренировок — появится план и итог месяца
          </button>
        )}
      </div>
    </section>
  );
}
