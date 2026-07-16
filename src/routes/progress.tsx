import { useState, useMemo, useCallback, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { GapCard } from "@/components/bjj/GapCard";
import { Avatar } from "@/components/bjj/Avatar";
import { useProgress, useProfile, useDiary } from "@/lib/bjj/store";
import { currentFocus, nextToLearn } from "@/lib/bjj/recommend";
import { computeStyleAffinity, type StyleScore } from "@/lib/bjj/styleProfile";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_ORDER, BELT_LABEL, GROUP_LABEL, STYLE_META } from "@/lib/bjj/constants";
import { computeStats, countDone, ARCHETYPE_MIN_DONE, STAT_META, ARCHETYPE_STATS } from "@/lib/bjj/stats";
import type { Technique } from "@/lib/bjj/types";
import {
  TrendingUp,
  Download,
  Upload,
  Trash2,
  Award,
  Target,
  CircleDot,
  BookOpen,
  AlertTriangle,
  Flag,
} from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

// === Вспомогательные утилиты ===
const getDateKey = (date: Date): string => date.toISOString().split("T")[0];

// === ГЛАВНЫЙ КОМПОНЕНТ ===
function ProgressPage() {
  const { progress, setProgress, clearProgress } = useProgress();
  const { profile } = useProfile();
  const { practiceCount } = useDiary();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");

  // Раскрытие списка техник по статусу: клик по карточке «Изучено» / «В процессе»
  const [openList, setOpenList] = useState<"done" | "in_progress" | null>(null);
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

  // === Статистика по поясам ===
  const beltStats = useMemo(() => {
    return BELT_ORDER.map((belt) => {
      const techniques = TECHNIQUES.filter((t) => t.belt === belt);
      const done = techniques.filter((t) => progress[t.id] === "done").length;
      const total = techniques.length;
      return { belt, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    }).filter((s) => s.total > 0);
  }, [progress]);

  // === Статистика по группам ===
  const groupStats = useMemo(() => {
    const groups = Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[];
    return groups.map((group) => {
      const techniques = TECHNIQUES.filter((t) => t.group === group);
      const done = techniques.filter((t) => progress[t.id] === "done").length;
      const total = techniques.length;
      return { group, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    }).filter((s) => s.total > 0);
  }, [progress]);

  // === Экспорт прогресса ===
  const exportProgress = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      progress,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bjj-progress-${getDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  // === Импорт прогресса ===
  const importProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.progress && typeof data.progress === "object") {
          setProgress(data.progress);
          setImportStatus("success");
          setTimeout(() => setImportStatus("idle"), 2000);
        } else {
          throw new Error("Invalid format");
        }
      } catch {
        setImportStatus("error");
        setTimeout(() => setImportStatus("idle"), 2000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [setProgress]);

  // === Сброс прогресса ===
  const handleReset = useCallback(() => {
    if (showResetConfirm) {
      clearProgress();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  }, [showResetConfirm, clearProgress]);

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        {/* Шапка */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Моя игра</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ваша статистика и путь от белого до чёрного пояса
          </p>
        </header>

        {/* Hero-статистика — «Изучено» и «В процессе» кликабельны, раскрывают список */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Прогресс"
            value={`${stats.pct}%`}
            accent="var(--color-primary)"
          />
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <Avatar profile={profile} className="mx-auto h-20" />
            <p className="mt-1.5 truncate text-[11px] font-medium">
              {doneCount >= ARCHETYPE_MIN_DONE && styleScores.length > 0
                ? STYLE_META[styleScores[0].style].ru
                : `${BELT_LABEL[profile.belt]} пояс`}
            </p>
          </div>
        </section>

        {/* Раскрытый список техник выбранного статуса */}
        {openList && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {openList === "done" ? "Изученные техники" : "Техники в процессе"}{" "}
                <span className="text-muted-foreground">({listTechniques.length})</span>
              </h2>
              <button
                onClick={() => setOpenList(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Свернуть
              </button>
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
                    <Link
                      to="/technique/$id"
                      params={{ id: String(t.id) }}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2.5 transition hover:bg-muted"
                      style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]} · сложность {t.difficulty}/5
                        </span>
                      </span>
                    </Link>
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
          />
        </section>

        <YourStyle scores={styleScores} doneCount={doneCount} />

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

        <GapCard
          scores={styleScores}
          preferredStyles={profile.preferredStyles}
          progress={progress}
          belt={profile.belt}
          doneCount={doneCount}
        />

        {/* Статистика по поясам */}
        <section className="rounded-2xl border border-border bg-card p-4">
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

        {/* Статистика по группам */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Прогресс по группам</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groupStats.map(({ group, done, total, pct }) => (
              <div key={group} className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{GROUP_LABEL[group]}</span>
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
              </div>
            ))}
          </div>
        </section>

        {/* Экспорт / Импорт / Сброс */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Управление данными</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportProgress}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {importStatus === "success" ? "✓ Импортировано" : importStatus === "error" ? "✗ Ошибка" : "Импорт"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={importProgress}
              className="hidden"
            />
            <button
              onClick={handleReset}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                showResetConfirm
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-destructive/30 bg-background text-destructive hover:bg-destructive/10"
              }`}
            >
              {showResetConfirm ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Подтвердить сброс?
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Сбросить
                </>
              )}
            </button>
          </div>
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


// «Твой стиль» — аффинити к игровым архетипам
function YourStyle({ scores, doneCount }: { scores: StyleScore[]; doneCount: number }) {
  if (doneCount < ARCHETYPE_MIN_DONE) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Твой стиль</h2>
        <p className="text-xs text-muted-foreground">
          Стиль определяется. Отметь ещё {ARCHETYPE_MIN_DONE - doneCount} техник как изученные,
          и приложение вычислит твой игровой архетип.
        </p>
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

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Твой стиль</h2>
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
}: {
  icon: React.ReactNode;
  caption: string;
  tech: Technique | null;
  extra?: Technique[];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "border-ring/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {caption}
      </p>
      {tech ? (
        <>
          <Link
            to="/technique/$id"
            params={{ id: String(tech.id) }}
            className="mt-1.5 block text-sm font-semibold hover:underline"
          >
            {tech.nameRu}
          </Link>
          <p className="text-[11px] text-muted-foreground">
            {GROUP_LABEL[tech.group]} · {BELT_LABEL[tech.belt]} · сложность {tech.difficulty}/5
          </p>
          {extra && extra.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {extra.map((t) => (
                <Link
                  key={t.id}
                  to="/technique/$id"
                  params={{ id: String(t.id) }}
                  className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  {t.label}
                </Link>
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
