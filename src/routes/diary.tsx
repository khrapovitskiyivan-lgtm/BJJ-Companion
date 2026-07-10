import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { useDiary, useProgress } from "@/lib/bjj/store";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import { Plus, Search, X, CalendarDays, Trash2, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/diary")({
  component: DiaryPage,
});

function DiaryPage() {
  return (
    <AppShell>
      <Diary />
    </AppShell>
  );
}

function Diary() {
  const { entries, addEntry, deleteEntry, hydrated } = useDiary();
  const { setStatus, progress } = useProgress();

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  // дата по умолчанию — сегодня (в effect, чтобы не ловить hydration mismatch)
  useEffect(() => {
    if (!date) setDate(new Date().toISOString().slice(0, 10));
  }, [date]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return TECHNIQUES.filter(
      (t) =>
        !picked.includes(t.id) &&
        (t.nameRu.toLowerCase().includes(q) ||
          t.nameEn.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q)),
    ).slice(0, 6);
  }, [query, picked]);

  const save = () => {
    if (!date || picked.length === 0) return;
    addEntry({
      date,
      techniqueIds: picked,
      note: note.trim() || undefined,
    });
    // ежедневный цикл: отмеченные техники минимум «в процессе»
    for (const id of picked) {
      if ((progress[id] ?? "not_started") === "not_started") setStatus(id, "in_progress");
    }
    setPicked([]);
    setNote("");
    setQuery("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Ежедневник</p>
          <h1 className="text-xl font-bold tracking-tight">Дневник тренировок</h1>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Тренировка
          </button>
        )}
      </header>

      {/* Форма новой тренировки */}
      {adding && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Выбранные техники */}
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((id) => {
                const t = TECH_BY_ID[id];
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                    style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                  >
                    {t.nameRu}
                    <button onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Поиск техник */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Добавить отработанную технику…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {searchResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setPicked((p) => [...p, t.id]); setQuery(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--belt-${t.belt})` }} />
                    <span className="min-w-0 flex-1 truncate">{t.nameRu}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{GROUP_LABEL[t.group]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка: что получилось, над чем работать…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />

          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setPicked([]); setNote(""); setQuery(""); }}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={picked.length === 0}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </section>
      )}

      {/* Список записей */}
      {hydrated && entries.length === 0 && !adding && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <NotebookPen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Пока нет записей</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Отмечайте каждую тренировку — приложение подскажет, что повторить и куда двигаться.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{formatDate(e.date)}</span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{e.techniqueIds.length} техн.</span>
                <button onClick={() => deleteEntry(e.id)} aria-label="Удалить">
                  <Trash2 className="h-3.5 w-3.5 hover:text-destructive" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.techniqueIds.map((id) => {
                const t = TECH_BY_ID[id];
                if (!t) return null;
                return (
                  <Link
                    key={id}
                    to="/technique/$id"
                    params={{ id: String(id) }}
                    className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] transition hover:bg-background"
                    style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                  >
                    {t.nameRu}
                  </Link>
                );
              })}
            </div>
            {e.note && <p className="mt-2 text-xs text-muted-foreground">{e.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1] ?? m} ${y}`;
}
