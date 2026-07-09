import { useState, useMemo, useCallback, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { useProgress } from "@/lib/bjj/store";
import { TECHNIQUES } from "@/lib/bjj/data";
import { BELT_ORDER, BELT_LABEL, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Belt, ProgressStatus, Technique } from "@/lib/bjj/types";
import {
  Flame,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  Filter,
  Search,
  Award,
  Target,
  CheckCircle2,
  Circle,
  CircleDot,
  Calendar,
  BarChart3,
  BookOpen,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

// === Типы ===
type StatusFilter = "all" | ProgressStatus;
type BeltFilter = "all" | Belt;
type GroupFilter = "all" | keyof typeof GROUP_LABEL;

// === Вспомогательные утилиты ===
const getDateKey = (date: Date): string => date.toISOString().split("T")[0];

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

// Расчёт streak (дни подряд с активностью)
const calculateStreak = (history: Record<string, number[]>): number => {
  const days = Object.keys(history)
    .filter((k) => history[k].length > 0)
    .sort()
    .reverse();
  if (days.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const key = getDateKey(expected);
    if (days.includes(key)) {
      streak++;
    } else if (i === 0) {
      // Сегодня ещё не было активности — проверяем вчера
      continue;
    } else {
      break;
    }
  }
  return streak;
};

// === ГЛАВНЫЙ КОМПОНЕНТ ===
function ProgressPage() {
  const { progress, setProgress, clearProgress } = useProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [beltFilter, setBeltFilter] = useState<BeltFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");

  // === История активности (из localStorage) ===
  const activityHistory = useMemo<Record<string, number[]>>(() => {
    try {
      const raw = localStorage.getItem("bjj_activity_history");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [progress]);

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

  // === Streak ===
  const streak = useMemo(() => calculateStreak(activityHistory), [activityHistory]);

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

  // === Данные для графика (последние 30 дней) ===
  const chartData = useMemo(() => {
    const data: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      data.push({
        date: key,
        count: activityHistory[key]?.length ?? 0,
      });
    }
    return data;
  }, [activityHistory]);

  // === Тепловая карта (последние 20 недель) ===
  const heatmapData = useMemo(() => {
    const weeks: { date: string; count: number }[][] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Идём назад 140 дней (20 недель)
    for (let i = 139; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      const weekIndex = Math.floor(i / 7);
      const dayIndex = 6 - (i % 7); // 0 = воскресенье, 6 = суббота

      if (!weeks[19 - weekIndex]) weeks[19 - weekIndex] = [];
      weeks[19 - weekIndex][dayIndex] = {
        date: key,
        count: activityHistory[key]?.length ?? 0,
      };
    }
    return weeks;
  }, [activityHistory]);

  // === Максимальное значение для нормализации heatmap ===
  const maxActivity = useMemo(() => {
    let max = 1;
    for (const week of heatmapData) {
      for (const day of week) {
        if (day && day.count > max) max = day.count;
      }
    }
    return max;
  }, [heatmapData]);

  // === Отфильтрованный список техник ===
  const filteredTechniques = useMemo(() => {
    return TECHNIQUES.filter((t) => {
      const s = progress[t.id] ?? "not_started";
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (beltFilter !== "all" && t.belt !== beltFilter) return false;
      if (groupFilter !== "all" && t.group !== groupFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.nameRu.toLowerCase().includes(q) && !t.nameEn.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [progress, statusFilter, beltFilter, groupFilter, searchQuery]);

  const visibleTechniques = filteredTechniques.slice(0, visibleCount);

  // === Экспорт прогресса ===
  const exportProgress = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      progress,
      activityHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bjj-progress-${getDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [progress, activityHistory]);

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
          if (data.activityHistory) {
            localStorage.setItem("bjj_activity_history", JSON.stringify(data.activityHistory));
          }
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
          <h1 className="text-2xl font-bold tracking-tight">Прогресс</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ваша статистика и путь от белого до чёрного пояса
          </p>
        </header>

        {/* Hero-статистика */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Изучено"
            value={stats.done}
            total={stats.total}
            accent="var(--status-done)"
          />
          <StatCard
            icon={<CircleDot className="h-5 w-5" />}
            label="В процессе"
            value={stats.inProgress}
            accent="var(--status-progress)"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Прогресс"
            value={`${stats.pct}%`}
            accent="var(--color-primary)"
          />
          <StatCard
            icon={<Flame className="h-5 w-5" />}
            label="Streak"
            value={streak}
            suffix="дн."
            accent="#f97316"
          />
        </section>

        {/* Streak-карточка */}
        {streak > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                  <Flame className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold text-orange-600 shadow">
                  {streak}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {streak} {streak === 1 ? "день" : streak < 5 ? "дня" : "дней"} подряд
                </h3>
                <p className="text-sm text-muted-foreground">
                  {streak >= 7
                    ? "Отличная серия! Так держать 🔥"
                    : "Продолжайте тренироваться каждый день"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* График прогресса */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Активность за 30 дней</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Всего: {chartData.reduce((sum, d) => sum + d.count, 0)} действий
            </span>
          </div>
          <ProgressChart data={chartData} />
        </section>

        {/* Тепловая карта */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Тепловая карта</h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Меньше</span>
              <div className="flex gap-0.5">
                {[0, 0.25, 0.5, 0.75, 1].map((level, i) => (
                  <div
                    key={i}
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{
                      background: level === 0
                        ? "var(--color-muted)"
                        : `color-mix(in oklch, var(--color-primary) ${level * 100}%, var(--color-muted))`,
                    }}
                  />
                ))}
              </div>
              <span>Больше</span>
            </div>
          </div>
          <Heatmap data={heatmapData} max={maxActivity} />
        </section>

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

        {/* Список техник с фильтрами */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Все техники</h2>
              <span className="text-xs text-muted-foreground">
                {filteredTechniques.length} из {TECHNIQUES.length}
              </span>
            </div>

            {/* Поиск */}
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск техники…"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-1.5">
              <FilterSelect
                icon={<Filter className="h-3 w-3" />}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  { value: "all", label: "Все статусы" },
                  { value: "done", label: "Изучено" },
                  { value: "in_progress", label: "В процессе" },
                  { value: "not_started", label: "Не начато" },
                ]}
              />
              <FilterSelect
                value={beltFilter}
                onChange={(v) => setBeltFilter(v as BeltFilter)}
                options={[
                  { value: "all", label: "Все пояса" },
                  ...BELT_ORDER.map((b) => ({ value: b, label: BELT_LABEL[b] })),
                ]}
              />
              <FilterSelect
                value={groupFilter}
                onChange={(v) => setGroupFilter(v as GroupFilter)}
                options={[
                  { value: "all", label: "Все группы" },
                  ...(Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[]).map((g) => ({
                    value: g,
                    label: GROUP_LABEL[g],
                  })),
                ]}
              />
            </div>
          </div>

          {/* Список */}
          <div className="divide-y divide-border">
            {visibleTechniques.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Ничего не найдено</p>
              </div>
            ) : (
              <>
                {visibleTechniques.map((t) => (
                  <TechniqueRow key={t.id} tech={t} progress={progress} />
                ))}
                {visibleCount < filteredTechniques.length && (
                  <button
                    onClick={() => setVisibleCount((c) => c + 30)}
                    className="w-full py-3 text-xs font-medium text-primary hover:bg-muted transition-colors"
                  >
                    Показать ещё ({filteredTechniques.length - visibleCount})
                  </button>
                )}
              </>
            )}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  total?: number;
  suffix?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
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
    </div>
  );
}

// SVG-график прогресса
function ProgressChart({ data }: { data: { date: string; count: number }[] }) {
  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const xStep = chartWidth / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - (d.count / maxCount) * chartHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Метки по X (каждые 5 дней)
  const xLabels = data
    .map((d, i) => ({ date: d.date, x: padding.left + i * xStep }))
    .filter((_, i) => i % 5 === 0 || i === data.length - 1);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 400 }}>
        {/* Сетка */}
        {[0, 0.25, 0.5, 0.75, 1].map((level) => (
          <line
            key={level}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartHeight * (1 - level)}
            y2={padding.top + chartHeight * (1 - level)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="2 2"
          />
        ))}

        {/* Область под графиком */}
        <path d={areaD} fill="url(#progressGradient)" />

        {/* Линия */}
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2} />

        {/* Точки */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={data[i].count > 0 ? 3 : 0}
            fill="var(--color-primary)"
          />
        ))}

        {/* Метки X */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {formatDate(label.date)}
          </text>
        ))}

        {/* Метки Y */}
        {[0, 0.5, 1].map((level) => (
          <text
            key={level}
            x={padding.left - 6}
            y={padding.top + chartHeight * (1 - level) + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[9px]"
          >
            {Math.round(maxCount * level)}
          </text>
        ))}

        <defs>
          <linearGradient id="progressGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Тепловая карта
function Heatmap({ data, max }: { data: { date: string; count: number }[][]; max: number }) {
  const cellSize = 12;
  const gap = 2;
  const weeks = data.length;
  const days = 7;
  const width = weeks * (cellSize + gap);
  const height = days * (cellSize + gap);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 280 }}>
        {data.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            const intensity = day.count / max;
            const color =
              intensity === 0
                ? "var(--color-muted)"
                : `color-mix(in oklch, var(--color-primary) ${Math.max(20, intensity * 100)}%, var(--color-muted))`;

            return (
              <rect
                key={`${wi}-${di}`}
                x={wi * (cellSize + gap)}
                y={di * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={color}
              >
                <title>
                  {formatDate(day.date)}: {day.count} действий
                </title>
              </rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}

// Строка техники в списке
function TechniqueRow({ tech, progress }: { tech: Technique; progress: Record<number, ProgressStatus> }) {
  const status = progress[tech.id] ?? "not_started";
  const statusConfig = {
    not_started: { icon: Circle, color: "var(--status-idle)", label: "Не начато" },
    in_progress: { icon: CircleDot, color: "var(--status-progress)", label: "В процессе" },
    done: { icon: CheckCircle2, color: "var(--status-done)", label: "Изучено" },
  };
  const { icon: Icon, color, label } = statusConfig[status];

  return (
    <Link
      to="/technique/$id"
      params={{ id: String(tech.id) }}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}20`, color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{tech.nameRu}</span>
          <span
            className="inline-block h-2 w-4 shrink-0 rounded-sm ring-1 ring-black/10"
            style={{ background: `var(--belt-${tech.belt})` }}
          />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{GROUP_LABEL[tech.group]}</span>
          <span>·</span>
          <span>{label}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Селектор фильтров
function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground outline-none transition hover:bg-muted focus:ring-1 focus:ring-ring"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
