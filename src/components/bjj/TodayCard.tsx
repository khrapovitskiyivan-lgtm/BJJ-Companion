import { Link } from "@tanstack/react-router";
import { NotebookPen, Flame, CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/bjj/ui";
import { useDiary, useProfile } from "@/lib/bjj/store";
import { todayCardModel } from "@/lib/bjj/todayCard";

// Блок «Сегодня» наверху «Моей игры»: статус недели по плану и кнопка записи.
// Кнопка всегда про дневник (клубную тренировку) — генератор здесь не упоминается,
// чтобы не путать с «Отработкой». После записи за сегодня кнопка исчезает.

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function TodayCard() {
  const { entries, hydrated: diaryHydrated } = useDiary();
  const { profile, hydrated: profileHydrated } = useProfile();
  // До гидратации не рендерим: new Date() и localStorage-данные только на клиенте
  if (!diaryHydrated || !profileHydrated) return null;

  const today = new Date();
  const m = todayCardModel(entries, profile.frequency, today);
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" }).format(today);

  // Сегменты квоты: изученная часть синим статусом, сверхплановые золотом
  const segments: string[] = [];
  if (m.week) {
    const total = Math.max(m.week.quota, m.week.done);
    for (let i = 0; i < total; i++) {
      segments.push(
        i >= m.week.quota ? "var(--brand-gold)" : i < m.week.done ? "var(--status-progress)" : "var(--color-muted)",
      );
    }
  }

  return (
    <section
      className="rounded-2xl border bg-card p-4"
      style={{ borderColor: m.loggedToday ? "var(--color-border)" : "var(--color-primary)" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Сегодня</p>
        {m.loggedToday ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--status-done)" }}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            записано
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        )}
      </div>

      {m.week ? (
        <>
          <p className="mt-2 text-sm font-semibold">
            На этой неделе {m.week.done} из {m.week.quota}
          </p>
          <div className="mt-2 flex gap-1">
            {segments.map((bg, i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: bg }} />
            ))}
          </div>
          {m.week.done >= m.week.quota ? (
            <p className="mt-1.5 text-xs font-medium" style={{ color: m.week.over > 0 ? "var(--brand-gold-ink)" : "var(--status-done)" }}>
              {m.week.over > 0 ? `План недели закрыт, +${m.week.over} сверх плана` : "План недели закрыт"}
            </p>
          ) : m.week.daysLeft > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              До плана {m.week.quota - m.week.done} {plural(m.week.quota - m.week.done, "тренировка", "тренировки", "тренировок")},
              {" "}осталось {m.week.daysLeft} {plural(m.week.daysLeft, "день", "дня", "дней")}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Воскресенье — выходной</p>
          )}
        </>
      ) : m.daysStreakNoPlan > 0 ? (
        <p className="mt-2 text-sm font-semibold">
          {m.daysStreakNoPlan} {plural(m.daysStreakNoPlan, "день", "дня", "дней")} подряд
        </p>
      ) : null}

      {m.weeksStreak >= 2 && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--brand-gold-ink)" }}>
          <Flame className="h-3.5 w-3.5" />
          {m.weeksStreak} {plural(m.weeksStreak, "неделя", "недели", "недель")} в плане подряд
        </p>
      )}

      {!m.loggedToday && (
        <Link to="/diary" search={{ add: true }} className={buttonClass("primary", "md", "mt-3 w-full")}>
          <NotebookPen className="h-4 w-4" />
          Записать в дневник
        </Link>
      )}
    </section>
  );
}
