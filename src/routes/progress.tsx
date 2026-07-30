import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { GapCard } from "@/components/bjj/GapCard";
import { ProgressTop } from "@/components/bjj/ProgressTop";
import { TodayAction } from "@/components/bjj/TodayAction";
import { PartnersBlock } from "@/components/bjj/PartnersBlock";
import { todayCardModel } from "@/lib/bjj/todayCard";
import { CharacterSheet } from "@/components/bjj/CharacterSheet";
import { ProgressSheet } from "@/components/bjj/ProgressSheet";
import { Button, PageHeader, buttonClass } from "@/components/bjj/ui";
import { useProgress, useProfile, useDiary, useFavorites, useReviewed } from "@/lib/bjj/store";
import { computeTotalXp, levelForXp, skillLevel } from "@/lib/bjj/xp";
import { computeInsights } from "@/lib/bjj/insights";
import { computeStyleAffinity, type StyleScore } from "@/lib/bjj/styleProfile";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import { TECHNIQUES } from "@/lib/bjj/data";
import { track } from "@/lib/bjj/telemetry";
import { buildStyleShare, shareText } from "@/lib/bjj/share";
import { BELT_ORDER, BELT_LABEL, STYLE_META } from "@/lib/bjj/constants";
import {
  computeStats,
  countDone,
  ARCHETYPE_MIN_DONE,
  STAT_META,
  ARCHETYPE_STATS,
} from "@/lib/bjj/stats";
import type { Technique } from "@/lib/bjj/types";
import { Share2, Check, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

// === ГЛАВНЫЙ КОМПОНЕНТ ===
function ProgressPage() {
  const { progress } = useProgress();
  const { profile, hydrated: profileHydrated } = useProfile();
  const { entries, practiceCount, hydrated: diaryHydrated } = useDiary();
  const { favorites } = useFavorites();
  const { reviewed } = useReviewed();

  // Уровень игрока: выводится из дневника/прогресса/пояса + разбор (reviewed)
  const level = useMemo(
    () => levelForXp(computeTotalXp({ entries, progress, belt: profile.belt, techniques: TECHNIQUES, reviewed })),
    [entries, progress, profile.belt, reviewed],
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

  // Раскрытие списка техник: клик по стату «Изучено» / «В процессе» / «Избранное»
  const [openList, setOpenList] = useState<"done" | "in_progress" | "favorites" | null>(null);
  // Лист персонажа (пояс, кимоно, стиль игры) — по тапу на аватара
  const [sheetOpen, setSheetOpen] = useState(false);
  // Шторка «Прогресс» (пояса + группы) — по тапу на hero-карточку «Прогресс»
  const [progressOpen, setProgressOpen] = useState(false);
  // Характеристики свёрнуты по умолчанию (плотность экрана): деталь под «Твой стиль → Разрыв»
  const [statsOpen, setStatsOpen] = useState(false);
  const listTechniques = useMemo(() => {
    if (!openList) return [];
    const base =
      openList === "favorites"
        ? TECHNIQUES.filter((t) => favorites[t.id])
        : TECHNIQUES.filter((t) => (progress[t.id] ?? "not_started") === openList);
    return base.sort(
      (a, b) =>
        BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) || a.difficulty - b.difficulty,
    );
  }, [openList, progress, favorites]);

  // === Общая статистика ===
  const stats = useMemo(() => {
    const total = TECHNIQUES.length;
    let done = 0,
      inProgress = 0,
      notStarted = 0;
    for (const t of TECHNIQUES) {
      const s = progress[t.id] ?? "not_started";
      if (s === "done") done++;
      else if (s === "in_progress") inProgress++;
      else notStarted++;
    }
    return { total, done, inProgress, notStarted, pct: Math.round((done / total) * 100) };
  }, [progress]);

  const favCount = Object.keys(favorites).length;
  // Модель «Сегодня» — только после гидратации (new Date() на клиенте, иначе SSR mismatch)
  const today =
    profileHydrated && diaryHydrated
      ? todayCardModel(entries, profile.frequency, new Date(), profile.trainingDays)
      : null;

  // Инсайты «что сделать сегодня» — только на клиенте после гидратации (new Date())
  const insights = useMemo(
    () =>
      profileHydrated && diaryHydrated
        ? computeInsights({
            entries, progress, reviewed, belt: profile.belt, goal: profile.goal,
            gi: profile.gi, noGi: profile.noGi, frequency: profile.frequency,
            techniques: TECHNIQUES, today: new Date(),
          })
        : [],
    [entries, progress, reviewed, profile.belt, profile.goal, profile.gi, profile.noGi, profile.frequency, profileHydrated, diaryHydrated],
  );

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Шапка — единая форма с остальными разделами: кикер сверху, название ниже */}
        <PageHeader kicker="Статистика и путь до чёрного пояса" title="Моя игра" className="px-1" />

        <ProgressTop
          profile={profile}
          stats={stats}
          favCount={favCount}
          level={level}
          today={today}
          openList={openList}
          onToggleList={(k) => setOpenList((v) => (v === k ? null : k))}
          onOpenProgress={() => setProgressOpen(true)}
          onOpenProfile={() => setSheetOpen(true)}
        />

        {sheetOpen && <CharacterSheet onClose={() => setSheetOpen(false)} />}
        {progressOpen && <ProgressSheet onClose={() => setProgressOpen(false)} />}

        {/* Раскрытый список техник выбранного стата (под верхом) */}
        {openList && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {openList === "done"
                  ? "Изученные техники"
                  : openList === "in_progress"
                    ? "Техники в процессе"
                    : "Твои коронки"}{" "}
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
                  : openList === "in_progress"
                    ? "Пока нет техник в процессе. Отметьте технику «в процессе» — она появится здесь."
                    : "Пока пусто. Отмечай коронкой (корона в шапке техники) те приёмы, на которые ставишь."}
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

        <TodayAction insights={insights} />

        <PartnersBlock />

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

        {/* Характеристики: 6 статов из механических тегов. Свёрнуты по умолчанию —
            деталь второго уровня под парой «Твой стиль → Разрыв» (плотность экрана) */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-sm font-semibold">Характеристики</h2>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${statsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {statsOpen && (
            <>
              <div className="mt-3 space-y-2">
                {statScores.map((s) => (
                  <div key={s.stat} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px]">{STAT_META[s.stat].ru}</span>
                    <span className="w-12 shrink-0 text-[11px] text-muted-foreground">
                      ур. {skillLevel(s.pct)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] text-muted-foreground">
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Растут от изученных техник и отработок в дневнике.
              </p>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

// === ПОДКОМПОНЕНТЫ ===

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
        <Link
          to="/library"
          className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}
        >
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
            {STYLE_META[top.style].desc} · {top.pct}% игры · ключевой стат:{" "}
            {STAT_META[ARCHETYPE_STATS[top.style].primary].ru}
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

