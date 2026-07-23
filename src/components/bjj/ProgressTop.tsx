import { Link } from "@tanstack/react-router";
import { TrendingUp, BookOpen, CircleDot, Star, Flame, CheckCircle2, NotebookPen } from "lucide-react";
import { buttonClass } from "@/components/bjj/ui";
import { initials } from "@/components/bjj/AppShell";
import { BELT_LABEL } from "@/lib/bjj/constants";
import type { StyleProfile } from "@/lib/bjj/types";
import type { TodayCardModel } from "@/lib/bjj/todayCard";

// Компактный верх «Моей игры»: слева карточка профиль + статы списком, справа
// «Сегодня». Чистый компонент — данные и колбэки приходят из progress.tsx
// (сама страница держит стейт шторок и раскрытого списка).

export type StatListKind = "done" | "in_progress" | "favorites";

interface Props {
  profile: StyleProfile;
  stats: { pct: number; done: number; inProgress: number; total: number };
  favCount: number;
  today: TodayCardModel | null; // null до гидратации (new Date() только на клиенте)
  openList: StatListKind | null;
  onToggleList: (k: StatListKind) => void;
  onOpenProgress: () => void;
  onOpenProfile: () => void;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function StatRow({
  icon,
  label,
  value,
  valueColor,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mx-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-1 py-2 text-left transition first:border-t-0 hover:bg-muted ${active ? "bg-muted" : ""}`}
    >
      {icon}
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </button>
  );
}

export function ProgressTop({
  profile,
  stats,
  favCount,
  today,
  openList,
  onToggleList,
  onOpenProgress,
  onOpenProfile,
}: Props) {
  // Сегменты недели: изученная часть статусом, сверхплановые золотом
  const segments: string[] = [];
  if (today?.week) {
    const total = Math.max(today.week.quota, today.week.done);
    for (let i = 0; i < total; i++) {
      segments.push(
        i >= today.week.quota
          ? "var(--brand-gold)"
          : i < today.week.done
            ? "var(--status-progress)"
            : "var(--color-muted)",
      );
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Левая колонка: профиль + статы списком */}
      <section className="rounded-2xl border border-border bg-card p-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex w-full items-center gap-2.5 text-left"
          aria-label="Мой профиль игрока"
        >
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="block h-10 w-10 shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px var(--belt-${profile.belt})` }}
            />
          ) : profile.name ? (
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-border"
              style={{ background: `var(--belt-${profile.belt})` }}
            >
              {initials(profile.name)}
            </span>
          ) : (
            <span
              className="block h-10 w-10 shrink-0 rounded-full ring-2 ring-border"
              style={{ background: `var(--belt-${profile.belt})` }}
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{profile.name || "Боец"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {BELT_LABEL[profile.belt]} пояс
            </span>
          </span>
        </button>

        <div className="mt-2">
          <StatRow
            icon={<TrendingUp className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />}
            label="Прогресс"
            value={`${stats.pct}%`}
            valueColor="var(--color-primary)"
            onClick={onOpenProgress}
          />
          <StatRow
            icon={<BookOpen className="h-4 w-4 shrink-0" style={{ color: "var(--status-done)" }} />}
            label="Изучено"
            value={`${stats.done}`}
            active={openList === "done"}
            onClick={() => onToggleList("done")}
          />
          <StatRow
            icon={<CircleDot className="h-4 w-4 shrink-0" style={{ color: "var(--status-progress)" }} />}
            label="В процессе"
            value={`${stats.inProgress}`}
            active={openList === "in_progress"}
            onClick={() => onToggleList("in_progress")}
          />
          <StatRow
            icon={<Star className="h-4 w-4 shrink-0" style={{ color: "var(--brand-gold-ink)" }} />}
            label="Избранное"
            value={`${favCount}`}
            valueColor="var(--brand-gold-ink)"
            active={openList === "favorites"}
            onClick={() => onToggleList("favorites")}
          />
        </div>
      </section>

      {/* Правая колонка: Сегодня */}
      <section
        className="flex flex-col rounded-2xl border bg-card p-3"
        style={{ borderColor: today && !today.loggedToday ? "var(--color-primary)" : "var(--color-border)" }}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Сегодня</p>
          {today?.loggedToday && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--status-done)" }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              записано
            </span>
          )}
        </div>

        {!today ? (
          <p className="mt-2 text-sm text-muted-foreground">…</p>
        ) : today.week ? (
          <>
            <p className="mt-1.5 text-sm font-semibold">
              {today.week.done} из {today.week.quota}
            </p>
            <p className="text-[11px] text-muted-foreground">на этой неделе</p>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {segments.map((bg, i) => (
                <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: bg }} />
              ))}
            </div>
            {today.week.done >= today.week.quota ? (
              <p className="mt-1.5 text-[11px] font-medium" style={{ color: today.week.over > 0 ? "var(--brand-gold-ink)" : "var(--status-done)" }}>
                {today.week.over > 0 ? `План закрыт, +${today.week.over}` : "План недели закрыт"}
              </p>
            ) : today.week.daysLeft > 0 ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                До плана {today.week.quota - today.week.done}, {today.week.daysLeft === 1 ? "остался" : "осталось"} {today.week.daysLeft} {plural(today.week.daysLeft, "день", "дня", "дней")}
              </p>
            ) : null}
            {today.weeksStreak >= 2 && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--brand-gold-ink)" }}>
                <Flame className="h-3.5 w-3.5" />
                {today.weeksStreak} {plural(today.weeksStreak, "неделя", "недели", "недель")}
              </p>
            )}
          </>
        ) : today.daysStreakNoPlan > 0 ? (
          <p className="mt-1.5 text-sm font-semibold">
            {today.daysStreakNoPlan} {plural(today.daysStreakNoPlan, "день", "дня", "дней")} подряд
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">Отмечай тренировки</p>
        )}

        {today && !today.loggedToday && (
          <Link to="/diary" search={{ add: true }} className={buttonClass("primary", "sm", "mt-auto w-full")}>
            <NotebookPen className="h-3.5 w-3.5" />
            Записать
          </Link>
        )}
      </section>
    </div>
  );
}
