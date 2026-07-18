import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueRow, TechniqueChip } from "@/components/bjj/TechniqueCard";
import { GapCard } from "@/components/bjj/GapCard";
import { TodayCard } from "@/components/bjj/TodayCard";
import { CharacterSheet } from "@/components/bjj/CharacterSheet";
import { ProgressSheet } from "@/components/bjj/ProgressSheet";
import { Button, PageHeader, buttonClass } from "@/components/bjj/ui";
import { initials } from "@/components/bjj/AppShell";
import { useProgress, useProfile, useDiary } from "@/lib/bjj/store";
import { currentFocus, nextToLearn } from "@/lib/bjj/recommend";
import { computeStyleAffinity, type StyleScore } from "@/lib/bjj/styleProfile";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { topCatchers, defensesFor } from "@/lib/bjj/caught";
import { track } from "@/lib/bjj/telemetry";
import { buildStyleShare, shareText } from "@/lib/bjj/share";
import { BELT_ORDER, BELT_LABEL, STYLE_META } from "@/lib/bjj/constants";
import { computeStats, countDone, ARCHETYPE_MIN_DONE, STAT_META, ARCHETYPE_STATS } from "@/lib/bjj/stats";
import type { Technique } from "@/lib/bjj/types";
import {
  TrendingUp,
  Target,
  CircleDot,
  BookOpen,
  Flag,
  History,
  ArrowRight,
  ShieldAlert,
  Share2,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

// === ГЛАВНЫЙ КОМПОНЕНТ ===
function ProgressPage() {
  const { progress } = useProgress();
  const { profile } = useProfile();
  const { entries, practiceCount } = useDiary();

  // Текущий фокус (в процессе) + следующая цель (рекомендации)
  const focusTech = useMemo(() => currentFocus(TECHNIQUES, progress), [progress]);
  const recommendations = useMemo(
    () => nextToLearn(TECHNIQUES, progress, profile.belt, 4, { goal: profile.goal, gi: profile.gi, noGi: profile.noGi }),
    [progress, profile.belt, profile.goal, profile.gi, profile.noGi],
  );

  // «Твой стиль» — аффинити к 10 архетипам из прогресса + отработок дневника
  const styleScores = useMemo(
    () => computeStyleAffinity(progress, practiceCount()),
    [progress, practiceCount],
  );

  // 6 статов (вторая ось: механика из тегов) и число освоенных для порога
  const statScores = useMemo(
    () => computeStats(progress, practiceCount()),
    [progress, practiceCount],
  );
  const doneCount = useMemo(() => countDone(progress), [progress]);

  // «Что тебя ловит»: сабмишены, которыми попадаются 2+ раз, и защиты от них из графа
  const catchers = useMemo(() => {
    return topCatchers(entries, 2).map(({ id, count }) => ({
      tech: TECH_BY_ID[id],
      count,
      defenses: defensesFor(id, TECHNIQUES, 3),
    })).filter((c) => c.tech);
  }, [entries]);

  // «Пора повторить»: изученное, чего давно (3+ недели) или вообще не было в дневнике.
  // Показываем только когда дневник ведётся — иначе кричали бы на всё изученное разом.
  const staleTechniques = useMemo(() => {
    if (entries.length === 0) return [];
    const last = new Map<number, string>();
    for (const e of entries) {
      for (const id of e.techniqueIds) {
        const prev = last.get(id);
        if (!prev || e.date > prev) last.set(id, e.date);
      }
    }
    const now = Date.now();
    const staleDays = (id: number) => {
      const iso = last.get(id);
      if (!iso) return Infinity; // изучена, но в дневнике ни разу
      return (now - new Date(iso).getTime()) / 86_400_000;
    };
    return TECHNIQUES.filter((t) => progress[t.id] === "done" && staleDays(t.id) >= 21)
      .sort((a, b) => staleDays(b.id) - staleDays(a.id))
      .slice(0, 5);
  }, [entries, progress]);

  // Раскрытие списка техник по статусу: клик по карточке «Изучено» / «В процессе»
  const [openList, setOpenList] = useState<"done" | "in_progress" | null>(null);
  // Лист персонажа (пояс, кимоно, стиль игры) — по тапу на аватара
  const [sheetOpen, setSheetOpen] = useState(false);
  // Шторка «Прогресс» (пояса + группы) — по тапу на hero-карточку «Прогресс»
  const [progressOpen, setProgressOpen] = useState(false);
  const listTechniques = useMemo(() => {
    if (!openList) return [];
    return TECHNIQUES.filter((t) => (progress[t.id] ?? "not_started") === openList).sort(
      (a, b) => BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) || a.difficulty - b.difficulty,
    );
  }, [openList, progress]);

  // === Общая статистика ===
  const stats = useMemo(() => {
    const total = TECHNIQUES.length;
    let done = 0, inProgress = 0, notStarted = 0;
    for (const t of TECHNIQUES) {
      const s = progress[t.id] ?? "not_started";
      if (s === "done") done++;
      else if (s === "in_progress") inProgress++;
      else notStarted++;
    }
    return { total, done, inProgress, notStarted, pct: Math.round((done / total) * 100) };
  }, [progress]);

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Шапка — единая форма с остальными разделами: кикер сверху, название ниже */}
        <PageHeader kicker="Статистика и путь до чёрного пояса" title="Моя игра" className="px-1" />

        <TodayCard />

        {/* Hero: верхний ряд — Прогресс и Профиль; нижний — Изучено и В процессе */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Прогресс"
            value={`${stats.pct}%`}
            accent="var(--color-primary)"
            onClick={() => setProgressOpen(true)}
          />
          {/* Профиль: кружок слева, имя из Telegram, ниже титул. Тап открывает лист игрока */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-muted"
            aria-label="Мой профиль игрока"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="block h-12 w-12 shrink-0 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 3px var(--belt-${profile.belt})` }}
              />
            ) : profile.name ? (
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-bold text-white ring-2 ring-border"
                style={{ background: `var(--belt-${profile.belt})` }}
              >
                {initials(profile.name)}
              </span>
            ) : (
              <span
                className="block h-12 w-12 shrink-0 rounded-full ring-2 ring-border"
                style={{ background: `var(--belt-${profile.belt})` }}
              />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {profile.name || "Боец"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {BELT_LABEL[profile.belt]} пояс
              </span>
            </span>
          </button>
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Изучено"
            value={stats.done}
            total={stats.total}
            accent="var(--status-done)"
            onClick={() => setOpenList((v) => (v === "done" ? null : "done"))}
            active={openList === "done"}
          />
          <StatCard
            icon={<CircleDot className="h-5 w-5" />}
            label="В процессе"
            value={stats.inProgress}
            accent="var(--status-progress)"
            onClick={() => setOpenList((v) => (v === "in_progress" ? null : "in_progress"))}
            active={openList === "in_progress"}
          />
        </section>

        {sheetOpen && <CharacterSheet onClose={() => setSheetOpen(false)} />}
        {progressOpen && <ProgressSheet onClose={() => setProgressOpen(false)} />}

        {/* Раскрытый список техник выбранного статуса */}
        {openList && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {openList === "done" ? "Изученные техники" : "Техники в процессе"}{" "}
                <span className="text-muted-foreground">({listTechniques.length})</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setOpenList(null)}>
                Свернуть
              </Button>
            </div>
            {listTechniques.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {openList === "done"
                  ? "Пока нет изученных техник. Отмечайте их в библиотеке."
                  : "Пока нет техник в процессе. Отметьте технику «в процессе» — она появится здесь."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {listTechniques.map((t) => (
                  <li key={t.id}>
                    <TechniqueRow technique={t} inset />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Текущий фокус + следующая цель (перенесено из графа) */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FocusCard
            icon={<Target className="h-4 w-4" />}
            caption="Текущий фокус"
            tech={focusTech}
            empty="Отметьте технику «в процессе» — она появится здесь"
          />
          <FocusCard
            icon={<Flag className="h-4 w-4" />}
            caption="Следующая цель"
            tech={recommendations[0] ?? null}
            extra={recommendations.slice(1)}
            empty="Всё доступное освоено!"
            highlight
            onNav={() => track("reco_click", "next")}
          />
        </section>

        {/* Что тебя ловит: повторяющиеся сабмишены соперников и защиты от них */}
        {catchers.length > 0 && (
          <section
            onClickCapture={() => track("reco_click", "catcher")}
            className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"
          >
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Что тебя ловит
            </h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Из «Чем поймали» в дневнике. Разучи защиты — генератор уже поднял их в приоритете.
            </p>
            <div className="space-y-4">
              {catchers.map(({ tech, count, defenses }) => (
                <div key={tech.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{tech.nameRu}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-destructive">
                      {count} {count === 1 ? "раз" : count < 5 ? "раза" : "раз"}
                    </span>
                  </div>
                  {defenses.length > 0 ? (
                    <ul className="space-y-1.5">
                      {defenses.map((d) => (
                        <li key={d.id}>
                          <TechniqueRow technique={d} inset />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Прямых защит в базе нет — разбери позицию входа на карте.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Link
              to="/workout"
              search={{ src: "diary" }}
              className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}
            >
              Собрать тренировку по дневнику
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        {/* Пора повторить: изученное выветривается — дневник это видит */}
        {staleTechniques.length > 0 && (
          <section
            onClickCapture={() => track("reco_click", "repeat")}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" />
              Пора повторить
            </h2>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Изучено, но в дневнике давно не появлялось. Изученное без повторения выветривается.
            </p>
            <ul className="space-y-1.5">
              {staleTechniques.map((t) => (
                <li key={t.id}>
                  <TechniqueRow technique={t} inset />
                </li>
              ))}
            </ul>
            <Link
              to="/workout"
              search={{ src: "diary" }}
              className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}
            >
              Собрать тренировку по дневнику
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        <YourStyle scores={styleScores} doneCount={doneCount} />

        {/* Разрыв сразу после «Твоего стиля»: пара «кто я -> кем хочу быть»
            не разрывается справкой (анализ docs/analysis/2026-07-18-progress-order.md) */}
        {/* Обёртка только для телеметрии кликов по «Разрыву» */}
        <div onClickCapture={() => track("reco_click", "gap")}>
          <GapCard
            scores={styleScores}
            preferredStyles={profile.preferredStyles}
            progress={progress}
            belt={profile.belt}
            doneCount={doneCount}
          />
        </div>

        {/* Характеристики: 6 статов из механических тегов */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Характеристики</h2>
          <div className="space-y-2">
            {statScores.map((s) => (
              <div key={s.stat} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px]">{STAT_META[s.stat].ru}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[11px] text-muted-foreground">{s.pct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Растут от изученных техник и отработок в дневнике.
          </p>
        </section>

      </div>
    </AppShell>
  );
}

// === ПОДКОМПОНЕНТЫ ===

function StatCard({
  icon,
  label,
  value,
  total,
  suffix,
  accent,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  total?: number;
  suffix?: string;
  accent: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const inner = (
    <>
      <div
        className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: `${accent}20`, color: accent }}
      >
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        {total !== undefined && (
          <span className="text-xs text-muted-foreground">/ {total}</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-border bg-card p-4">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className="rounded-2xl border bg-card p-4 text-left transition hover:bg-muted"
      style={{ borderColor: active ? accent : "var(--color-border)" }}
    >
      {inner}
    </button>
  );
}


// Винительный падеж для «отметь N техник(у/и)»
function techWordAcc(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return "техник";
  if (d10 === 1) return "технику";
  if (d10 >= 2 && d10 <= 4) return "техники";
  return "техник";
}

// «Твой стиль» — аффинити к игровым архетипам
function YourStyle({ scores, doneCount }: { scores: StyleScore[]; doneCount: number }) {
  // «Скопировано» после шеринга через буфер (браузер без Web Share)
  const [shared, setShared] = useState(false);
  if (doneCount < ARCHETYPE_MIN_DONE) {
    const left = ARCHETYPE_MIN_DONE - doneCount;
    // Квест холодного старта: пустота становится целью — сегменты N из 5 и путь к действию
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Твой стиль</h2>
        <p className="text-xs text-muted-foreground">
          Отметь ещё {left} {techWordAcc(left)} как {left === 1 ? "изученную" : "изученные"}, и
          приложение вычислит твой игровой архетип.
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {Array.from({ length: ARCHETYPE_MIN_DONE }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${i < doneCount ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          {doneCount} из {ARCHETYPE_MIN_DONE}
        </p>
        <Link to="/library" className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}>
          Отметить изученное
        </Link>
      </section>
    );
  }
  if (scores.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Твой стиль</h2>
        <p className="text-xs text-muted-foreground">
          Отмечай изученные техники и веди дневник — приложение определит твой игровой стиль.
        </p>
      </section>
    );
  }
  const top = scores[0];
  const TopIcon = STYLE_ICONS[top.style];
  const bars = scores.slice(0, 5);
  const max = bars[0]?.pct || 1;

  const onShare = async () => {
    const res = await shareText(buildStyleShare(top, doneCount, TECHNIQUES.length));
    if (res === "copied") {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Твой стиль</h2>
        <button
          type="button"
          onClick={onShare}
          aria-label="Поделиться стилем"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <TopIcon className="h-6 w-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight">{STYLE_META[top.style].ru}</p>
          <p className="truncate text-xs text-muted-foreground">
            {STYLE_META[top.style].desc} · {top.pct}% игры · ключевой стат: {STAT_META[ARCHETYPE_STATS[top.style].primary].ru}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {bars.map((b) => {
          const Icon = STYLE_ICONS[b.style];
          return (
            <div key={b.style} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
              <span className="w-24 shrink-0 truncate text-[11px]">{STYLE_META[b.style].ru}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((b.pct / max) * 100)}%` }}
                />
              </div>
              <span className="w-8 text-right text-[11px] text-muted-foreground">{b.pct}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Карточка «Текущий фокус» / «Следующая цель» — клик открывает технику
function FocusCard({
  icon,
  caption,
  tech,
  extra,
  empty,
  highlight,
  onNav,
}: {
  icon: React.ReactNode;
  caption: string;
  tech: Technique | null;
  extra?: Technique[];
  empty: string;
  highlight?: boolean;
  onNav?: () => void; // телеметрия кликов по рекомендации (капчур, не мешает Link)
}) {
  return (
    <div
      onClickCapture={onNav}
      className={`rounded-2xl border p-4 ${
        highlight ? "border-ring/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {caption}
      </p>
      {tech ? (
        <>
          <div className="mt-2">
            <TechniqueRow technique={tech} inset />
          </div>
          {extra && extra.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {extra.map((t) => (
                <TechniqueChip key={t.id} technique={t} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
