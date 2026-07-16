import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { useProfile, useProgress } from "@/lib/bjj/store";
import { filterTechniques } from "@/lib/bjj/workout";
import { TECHNIQUES } from "@/lib/bjj/data";
import {
  BELT_LABEL,
  BELT_ORDER,
  GROUP_LABEL,
} from "@/lib/bjj/constants";
import type { Belt, Group } from "@/lib/bjj/types";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { Search, X, RotateCcw, Filter } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});

const PAGE_SIZE = 40;

// Кэш фильтров на время сессии: переживает уход на карточку техники и возврат
// (страница размонтируется, локальный useState теряется — держим последнее состояние здесь).
type LibFilters = {
  search: string;
  belt: Belt;
  giMode: "both" | "gi" | "nogi";
  group: Group | "all";
  page: number;
};
let libFiltersCache: LibFilters | null = null;

// ✅ Динамическая генерация из GROUP_LABEL
// Если добавите новую группу в constants.ts — она автоматически появится здесь
const GROUPS: (Group | "all")[] = [
  "all",
  ...(Object.keys(GROUP_LABEL) as Group[]),
];

function LibraryPage() {
  return (
    <AppShell>
      <Library />
    </AppShell>
  );
}

function Library() {
  const { profile } = useProfile();
  const { progress, cycleStatus } = useProgress();

  // Дефолтные значения из профиля (для сброса и сравнения)
  const defaultGiMode: "both" | "gi" | "nogi" =
    profile.gi && profile.noGi ? "both" : profile.gi ? "gi" : "nogi";

  const [search, setSearch] = useState(() => libFiltersCache?.search ?? "");
  const [belt, setBelt] = useState<Belt>(() => libFiltersCache?.belt ?? profile.belt);
  const [giMode, setGiMode] = useState<"both" | "gi" | "nogi">(
    () => libFiltersCache?.giMode ?? defaultGiMode,
  );
  const [group, setGroup] = useState<Group | "all">(() => libFiltersCache?.group ?? "all");
  const [page, setPage] = useState(() => libFiltersCache?.page ?? 1);

  // Держим кэш в актуальном состоянии, чтобы восстановить фильтры после возврата
  useEffect(() => {
    libFiltersCache = { search, belt, giMode, group, page };
  }, [search, belt, giMode, group, page]);

  // ✅ Фильтрация техник
  const filtered = useMemo(
    () =>
      filterTechniques({
        belt,
        gi: giMode === "gi" || giMode === "both" ? true : undefined,
        noGi: giMode === "nogi" || giMode === "both" ? true : undefined,
        group,
        search,
      }),
    [belt, giMode, group, search],
  );

  // ✅ Пагинация
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // ✅ Сброс страницы при изменении фильтров
  const resetPage = () => setPage(1);

  // ✅ Сброс всех фильтров к значениям по умолчанию (из профиля)
  const resetAllFilters = () => {
    setSearch("");
    setBelt(profile.belt);
    setGiMode(defaultGiMode);
    setGroup("all");
    setPage(1);
  };

  // ✅ Подсчёт активных фильтров для индикатора
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (belt !== profile.belt) count++;
    if (giMode !== defaultGiMode) count++;
    if (group !== "all") count++;
    return count;
  }, [search, belt, giMode, group, profile.belt, defaultGiMode]);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="space-y-3">
      {/* Шапка — единая форма с /map и /situations: кикер + заголовок слева, табы справа */}
      <header className="flex items-end justify-between px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Каталог</p>
          <h1 className="text-xl font-bold tracking-tight">Библиотека техник</h1>
        </div>
        <TechniquesTabs />
      </header>

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} техник · страница {currentPage}/{totalPages}
        {hasActiveFilters && (
          <span className="ml-2 inline-flex items-center gap-1 text-primary">
            <Filter className="h-3 w-3" />
            {activeFiltersCount}{" "}
            {activeFiltersCount === 1
              ? "фильтр"
              : activeFiltersCount < 5
                ? "фильтра"
                : "фильтров"}
          </span>
        )}
      </p>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Поиск по названию или тегам…"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              resetPage();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Belt filter */}
      <FilterRow label="Пояс">
        {BELT_ORDER.map((b) => (
          <Chip
            key={b}
            active={belt === b}
            onClick={() => {
              setBelt(b);
              resetPage();
            }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ background: `var(--belt-${b})` }}
            />
            {BELT_LABEL[b]}
          </Chip>
        ))}
      </FilterRow>

      {/* Gi filter */}
      <FilterRow label="Формат">
        {(["both", "gi", "nogi"] as const).map((m) => (
          <Chip
            key={m}
            active={giMode === m}
            onClick={() => {
              setGiMode(m);
              resetPage();
            }}
          >
            {m === "both" ? "Все" : m === "gi" ? "Gi" : "No-Gi"}
          </Chip>
        ))}
      </FilterRow>

      {/* Group filter */}
      <FilterRow label="Категория">
        {GROUPS.map((g) => (
          <Chip
            key={g}
            active={group === g}
            onClick={() => {
              setGroup(g);
              resetPage();
            }}
          >
            {g === "all" ? "Все" : GROUP_LABEL[g]}
          </Chip>
        ))}
      </FilterRow>

      {/* ✅ Панель быстрого сброса фильтров */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            Применено фильтров:{" "}
            <span className="font-semibold text-foreground">
              {activeFiltersCount}
            </span>
          </span>
          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Сбросить все
          </button>
        </div>
      )}

      {/* ✅ Умное пустое состояние */}
      {pageItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 px-6 text-center">
          {/* Иконка */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Заголовок и описание */}
          <h3 className="mb-1.5 text-lg font-semibold">Техники не найдены</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Попробуйте изменить или сбросить фильтры, чтобы увидеть больше результатов."
              : "В базе пока нет техник. Проверьте подключение к данным."}
          </p>

          {/* Кнопки действий */}
          <div className="flex flex-wrap justify-center gap-3">
            {hasActiveFilters && (
              <>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                >
                  <RotateCcw className="h-4 w-4" />
                  Сбросить все фильтры
                </button>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      resetPage();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/80"
                  >
                    <X className="h-4 w-4" />
                    Очистить поиск
                  </button>
                )}
              </>
            )}
          </div>

          {/* Подсказка: сколько всего техник в базе */}
          <p className="mt-6 text-xs text-muted-foreground">
            Всего в базе:{" "}
            <span className="font-semibold text-foreground">
              {TECHNIQUES.length}
            </span>{" "}
            техник
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {pageItems.map((t) => (
            <li key={t.id}>
              <Link
                to="/technique/$id"
                params={{ id: String(t.id) }}
                className="block"
              >
                <TechniqueCard
                  technique={t}
                  status={progress[t.id] ?? "not_started"}
                  onCycleStatus={cycleStatus}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Пагинация"
          className="flex items-center justify-between gap-3 pt-2"
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Вперёд →
          </button>
        </nav>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active
          ? "color-mix(in oklch, var(--color-primary) 12%, var(--color-card))"
          : "var(--color-card)",
        color: active ? "var(--color-primary)" : "var(--color-foreground)",
      }}
    >
      {children}
    </button>
  );
}
