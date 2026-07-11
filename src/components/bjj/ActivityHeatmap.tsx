import { useMemo } from "react";
import type { DiaryEntry } from "@/lib/bjj/types";
import { Flame, CalendarCheck } from "lucide-react";

// Активность + тепловая карта, посчитанные из записей дневника.
// Тренировочный день = день, за который есть запись; интенсивность клетки — число техник.
const WEEKS = 18;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ActivityHeatmap({ entries }: { entries: DiaryEntry[] }) {
  const { byDate, streak, thisMonth, max } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + Math.max(1, e.techniqueIds.length));

    // streak: подряд идущие дни с активностью, считая от сегодня (или вчера)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const cursor = new Date(today);
    if (!byDate.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1); // сегодня ещё не тренировались — начнём со вчера
    while (byDate.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // тренировок в этом месяце
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = [...byDate.keys()].filter((k) => k.startsWith(ym)).length;

    const max = Math.max(1, ...byDate.values());
    return { byDate, streak, thisMonth, max };
  }, [entries]);

  // сетка недель × 7 дней, заканчивается сегодняшней неделей
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grid: { date: string; count: number }[][] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(today);
        const offset = w * 7 + (6 - d) - ((6 - today.getDay() + 7) % 7);
        day.setDate(day.getDate() - offset);
        const key = dateKey(day);
        week.push({ date: key, count: byDate.get(key) ?? 0 });
      }
      grid.push(week);
    }
    return grid;
  }, [byDate]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Flame className="h-4 w-4 text-orange-500" />
          {streak} {streak === 1 ? "день" : streak >= 2 && streak <= 4 ? "дня" : "дней"} подряд
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" />
          {thisMonth} трен. в этом месяце
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ minWidth: 260 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                const intensity = day.count / max;
                const bg =
                  day.count === 0
                    ? "var(--color-muted)"
                    : `color-mix(in oklch, var(--color-primary) ${Math.round(Math.max(25, intensity * 100))}%, var(--color-muted))`;
                return (
                  <div
                    key={di}
                    className="h-3 w-3 rounded-[3px]"
                    style={{ background: bg }}
                    title={day.count > 0 ? `${day.date}: ${day.count}` : day.date}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
