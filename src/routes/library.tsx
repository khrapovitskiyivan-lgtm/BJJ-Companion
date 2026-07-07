import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniqueCard } from "@/components/bjj/TechniqueCard";
import { useProfile, useProgress } from "@/lib/bjj/store";
import { filterTechniques } from "@/lib/bjj/workout";
import {
  BELT_LABEL,
  BELT_ORDER,
  GROUP_LABEL,
} from "@/lib/bjj/constants";
import type { Belt, Group } from "@/lib/bjj/types";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});

const PAGE_SIZE = 40;
const GROUPS: (Group | "all")[] = [
  "all",
  "position",
  "guard_pass",
  "submission",
  "sweep",
  "takedown",
  "transition",
  "escape",
  "system",
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

  const [search, setSearch] = useState("");
  const [belt, setBelt] = useState<Belt>(profile.belt);
  const [giMode, setGiMode] = useState<"both" | "gi" | "nogi">(
    profile.gi && profile.noGi ? "both" : profile.gi ? "gi" : "nogi",
  );
  const [group, setGroup] = useState<Group | "all">("all");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Reset page when filters change
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Библиотека техник</h1>
        <p className="text-xs text-muted-foreground">
          {filtered.length} техник · страница {currentPage}/{totalPages}
        </p>
      </header>

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

      {/* List */}
      {pageItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ничего не найдено. Попробуйте изменить фильтры.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {pageItems.map((t) => (
            <li key={t.id}>
              <Link to="/technique/$id" params={{ id: String(t.id) }} className="block">
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
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
