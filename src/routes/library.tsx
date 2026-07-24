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
import { Button, Chip, FilterRow, EmptyState, PageHeader } from "@/components/bjj/ui";
import { Search, X, RotateCcw, Filter, ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});

const PAGE_SIZE = 40;

// Кэш фильтров на время сессии: переживает уход на карточку техники и возврат
// (страница размонтируется, локальный useState теряется — держим последнее состояние здесь).
type LibFilters = {
  search: string;
  belts: Belt[];
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

  // Чёрный пояс из фильтра исключён: техник этого пояса в базе нет (мастерство = шлифовка,
  // не новый пласт движений). У чёрнопоясных дефолт = вся база, иначе фильтр открывался бы пустым.
  const filterBelts = BELT_ORDER.filter((b) => b !== "black");
  const defBelts: Belt[] = profile.belt === "black" ? filterBelts : [profile.belt];

  const [search, setSearch] = useState(() => libFiltersCache?.search ?? "");
  // Мультивыбор поясов (точное объединение). Дефолт — пояс профиля; пусто = все
  const [belts, setBelts] = useState<Belt[]>(() => libFiltersCache?.belts ?? defBelts);
  const [giMode, setGiMode] = useState<"both" | "gi" | "nogi">(
    () => libFiltersCache?.giMode ?? defaultGiMode,
  );
  const [group, setGroup] = useState<Group | "all">(() => libFiltersCache?.group ?? "all");
  const [page, setPage] = useState(() => libFiltersCache?.page ?? 1);

  // Держим кэш в актуальном состоянии, чтобы восстановить фильтры после возврата
  useEffect(() => {
    libFiltersCache = { search, belts, giMode, group, page };
  }, [search, belts, giMode, group, page]);

  // ✅ Фильтрация техник
  const filtered = useMemo(
    () =>
      filterTechniques({
        belts,
        gi: giMode === "gi" || giMode === "both" ? true : undefined,
        noGi: giMode === "nogi" || giMode === "both" ? true : undefined,
        group,
        search,
      }),
    [belts, giMode, group, search],
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
    setBelts(defBelts);
    setGiMode(defaultGiMode);
    setGroup("all");
    setPage(1);
  };

  // ✅ Подсчёт активных фильтров для индикатора
  // Пояс активен, если выбор отличается от дефолта (ровно пояс профиля)
  const beltFilterActive = !(belts.length === defBelts.length && defBelts.every((b) => belts.includes(b)));
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (beltFilterActive) count++;
    if (giMode !== defaultGiMode) count++;
    if (group !== "all") count++;
    return count;
  }, [search, beltFilterActive, giMode, group, defaultGiMode]);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="space-y-3">
      {/* Шапка — единая форма: кикер + заголовок, табы отдельной строкой ниже */}
      <PageHeader kicker="Каталог" title="Библиотека техник" className="px-1" />
      <TechniquesTabs />

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
        {filterBelts.map((b) => (
          <Chip
            key={b}
            active={belts.includes(b)}
            onClick={() => {
              setBelts((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
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
          <Button variant="soft" size="sm" onClick={resetAllFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
            Сбросить все
          </Button>
        </div>
      )}

      {pageItems.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="Техники не найдены"
          hint={
            hasActiveFilters
              ? `Попробуйте изменить или сбросить фильтры. Всего в базе: ${TECHNIQUES.length} техник.`
              : "В базе пока нет техник. Проверьте подключение к данным."
          }
          action={
            hasActiveFilters ? (
              <>
                <Button variant="primary" onClick={resetAllFilters}>
                  <RotateCcw className="h-4 w-4" />
                  Сбросить все фильтры
                </Button>
                {search && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      resetPage();
                    }}
                  >
                    <X className="h-4 w-4" />
                    Очистить поиск
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
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
          <Button
            variant="secondary"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex-1"
          >
            Вперёд
            <ArrowRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}

