import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import {
  GLOSSARY,
  GLOSSARY_CATEGORY_LABEL,
  GLOSSARY_CATEGORY_ORDER,
  type GlossaryCategory,
} from "@/lib/bjj/glossary";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/glossary")({
  component: GlossaryPage,
});

function GlossaryPage() {
  return (
    <AppShell>
      <Glossary />
    </AppShell>
  );
}

function Glossary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.term.toLowerCase().includes(q) ||
        (t.en?.toLowerCase().includes(q) ?? false) ||
        t.definition.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  // Группировка по категориям в фиксированном порядке
  const grouped = useMemo(
    () =>
      GLOSSARY_CATEGORY_ORDER.map((c) => ({
        category: c,
        items: filtered.filter((t) => t.category === c),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  return (
    <div className="space-y-3">
      <header className="px-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Справочник</p>
        <h1 className="text-xl font-bold tracking-tight">Словарь терминов</h1>
      </header>
      <TechniquesTabs />

      <p className="px-1 text-xs text-muted-foreground">
        Что говорят на тренировке и что это значит. {GLOSSARY.length} терминов.
      </p>

      {/* Поиск */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти термин или определение…"
          className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Категории */}
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          Все
        </Chip>
        {GLOSSARY_CATEGORY_ORDER.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {GLOSSARY_CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Search className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Ничего не найдено</p>
          <p className="mt-1 text-xs text-muted-foreground">Попробуйте другой запрос или снимите фильтр.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.category}>
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {GLOSSARY_CATEGORY_LABEL[g.category]}
            </h2>
            <ul className="space-y-2">
              {g.items.map((t) => (
                <li key={t.term} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{t.term}</span>
                    {t.en && <span className="text-xs text-muted-foreground">{t.en}</span>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.definition}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
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
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
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
