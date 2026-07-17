import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { ActivityHeatmap } from "@/components/bjj/ActivityHeatmap";
import { CharacterSheet } from "@/components/bjj/CharacterSheet";
import { TechniqueChip } from "@/components/bjj/TechniqueCard";
import { Button, EmptyState, PageHeader } from "@/components/bjj/ui";
import { useDiary, useProfile, useProgress } from "@/lib/bjj/store";
import { hapticSuccess } from "@/lib/telegram";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { GROUP_LABEL } from "@/lib/bjj/constants";
import type { Intensity } from "@/lib/bjj/types";
import { Plus, Search, CalendarDays, Trash2, NotebookPen, HeartPulse, Pencil, Minus } from "lucide-react";

const MAX_ROUNDS = 20;

const INTENSITY: { key: Intensity; label: string }[] = [
  { key: "light", label: "Лёгкая" },
  { key: "medium", label: "Средняя" },
  { key: "hard", label: "Жёсткая" },
];
// Смайлы через fromCodePoint: сырой эмодзи в исходнике ломает iOS JavaScriptCore (webview Telegram)
const WELLBEING = [0x1f623, 0x1f615, 0x1f610, 0x1f642, 0x1f604].map((c) => String.fromCodePoint(c));

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
  const { entries, addEntry, updateEntry, deleteEntry, hydrated } = useDiary();
  const { setStatus, progress } = useProgress();
  const { profile } = useProfile();

  const [adding, setAdding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [wellbeing, setWellbeing] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [injury, setInjury] = useState("");

  const resetForm = () => {
    setPicked([]);
    setNote("");
    setQuery("");
    setIntensity(null);
    setWellbeing(null);
    setRounds(0);
    setInjury("");
    setAdding(false);
    setEditingId(null);
  };

  // Открыть форму для новой записи (чистые поля, дата — сегодня)
  const startAdd = () => {
    setEditingId(null);
    setPicked([]);
    setNote("");
    setQuery("");
    setIntensity(null);
    setWellbeing(null);
    setRounds(0);
    setInjury("");
    setDate(new Date().toISOString().slice(0, 10));
    setConfirmDelete(null);
    setAdding(true);
  };

  // Открыть форму на редактирование существующей записи
  const startEdit = (e: (typeof entries)[number]) => {
    setEditingId(e.id);
    setAdding(true);
    setDate(e.date);
    setPicked(e.techniqueIds);
    setNote(e.note ?? "");
    setQuery("");
    setIntensity(e.intensity ?? null);
    setWellbeing(e.wellbeing ?? null);
    setRounds(e.rounds ?? 0);
    setInjury(e.injury ?? "");
    setConfirmDelete(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    const payload = {
      date,
      techniqueIds: picked,
      note: note.trim() || undefined,
      intensity: intensity ?? undefined,
      wellbeing: wellbeing ?? undefined,
      rounds: rounds > 0 ? rounds : undefined,
      injury: injury.trim() || undefined,
    };
    if (editingId) {
      updateEntry(editingId, payload);
    } else {
      addEntry(payload);
    }
    // ежедневный цикл: отмеченные техники минимум «в процессе»
    for (const id of picked) {
      if ((progress[id] ?? "not_started") === "not_started") setStatus(id, "in_progress");
    }
    hapticSuccess();
    resetForm();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Ежедневник"
        title="Дневник тренировок"
        action={
          !adding && (
            <Button variant="primary" onClick={startAdd}>
              <Plus className="h-4 w-4" />
              Тренировка
            </Button>
          )
        }
      />

      {/* Календарь месяца: записи дневника + план от частоты из профиля */}
      {hydrated && entries.length > 0 && (
        <ActivityHeatmap entries={entries} frequency={profile.frequency} onSetFrequency={() => setSheetOpen(true)} />
      )}
      {sheetOpen && <CharacterSheet onClose={() => setSheetOpen(false)} />}

      {/* Форма новой тренировки */}
      {adding && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            {editingId ? "Редактировать тренировку" : "Новая тренировка"}
          </p>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Выбранные техники */}
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((id) => (
                <TechniqueChip
                  key={id}
                  technique={TECH_BY_ID[id]}
                  onRemove={() => setPicked((p) => p.filter((x) => x !== id))}
                />
              ))}
            </div>
          )}

          {/* Поиск техник */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Добавить отработанную технику…"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {searchResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setPicked((p) => [...p, t.id]); setQuery(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                    style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                  >
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
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Интенсивность + раунды */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Интенсивность</span>
            {INTENSITY.map((it) => (
              <button
                key={it.key}
                onClick={() => setIntensity((v) => (v === it.key ? null : it.key))}
                className="rounded-full border-2 px-3 py-1 text-xs font-medium transition-all"
                style={{
                  borderColor: intensity === it.key ? "var(--color-primary)" : "var(--color-border)",
                  background: intensity === it.key ? "color-mix(in oklch, var(--color-primary) 10%, transparent)" : "transparent",
                }}
              >
                {it.label}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              Раунды
              <span className="inline-flex items-center rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setRounds((r) => Math.max(0, r - 1))}
                  disabled={rounds <= 0}
                  className="grid h-8 w-8 place-items-center rounded-l-lg text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                  aria-label="Меньше раундов"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium tabular-nums text-foreground">{rounds}</span>
                <button
                  type="button"
                  onClick={() => setRounds((r) => Math.min(MAX_ROUNDS, r + 1))}
                  disabled={rounds >= MAX_ROUNDS}
                  className="grid h-8 w-8 place-items-center rounded-r-lg text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                  aria-label="Больше раундов"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </span>
          </div>

          {/* Самочувствие */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Самочувствие</span>
            <div className="flex gap-1">
              {WELLBEING.map((face, i) => (
                <button
                  key={i}
                  onClick={() => setWellbeing((v) => (v === i + 1 ? null : i + 1))}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 text-base transition-all"
                  style={{
                    borderColor: wellbeing === i + 1 ? "var(--color-primary)" : "var(--color-border)",
                    background: wellbeing === i + 1 ? "color-mix(in oklch, var(--color-primary) 12%, transparent)" : "transparent",
                    filter: wellbeing && wellbeing !== i + 1 ? "grayscale(1) opacity(0.5)" : "none",
                  }}
                  aria-label={`Самочувствие ${i + 1}`}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>

          {/* Травма / дискомфорт */}
          <div className="relative">
            <HeartPulse className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={injury}
              onChange={(e) => setInjury(e.target.value)}
              placeholder="Травма / дискомфорт — зона (необязательно)"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetForm} className="flex-1 text-muted-foreground">
              Отмена
            </Button>
            <Button variant="primary" onClick={save} disabled={picked.length === 0} className="flex-1">
              {editingId ? "Сохранить изменения" : "Сохранить"}
            </Button>
          </div>
        </section>
      )}

      {/* Список записей */}
      {hydrated && entries.length === 0 && !adding && (
        <EmptyState
          icon={<NotebookPen className="h-8 w-8" />}
          title="Пока нет записей"
          hint="Отмечайте каждую тренировку — приложение подскажет, что повторить и куда двигаться."
        />
      )}

      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{formatDate(e.date)}</span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {e.intensity && <span>{INTENSITY.find((i) => i.key === e.intensity)?.label}</span>}
                {e.rounds ? <span>{e.rounds} р.</span> : null}
                {e.wellbeing ? <span className="text-sm leading-none">{WELLBEING[e.wellbeing - 1]}</span> : null}
                <span>{e.techniqueIds.length} техн.</span>
                {confirmDelete === e.id ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-destructive">Удалить?</span>
                    <button
                      onClick={() => { deleteEntry(e.id); setConfirmDelete(null); }}
                      className="rounded px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/10"
                    >
                      Да
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-1.5 py-0.5 font-medium hover:bg-muted"
                    >
                      Нет
                    </button>
                  </span>
                ) : (
                  <>
                    {/* Крупные зоны нажатия с зазором: на телефоне легко промахнуться */}
                    <button
                      onClick={() => startEdit(e)}
                      aria-label="Редактировать"
                      className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(e.id)}
                      aria-label="Удалить"
                      className="ml-1.5 grid h-8 w-8 place-items-center rounded-lg transition hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.techniqueIds.map((id) => {
                const t = TECH_BY_ID[id];
                if (!t) return null;
                return <TechniqueChip key={id} technique={t} />;
              })}
            </div>
            {e.note && <p className="mt-2 text-xs text-muted-foreground">{e.note}</p>}
            {e.injury && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <HeartPulse className="h-3.5 w-3.5" />
                {e.injury}
              </p>
            )}
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
