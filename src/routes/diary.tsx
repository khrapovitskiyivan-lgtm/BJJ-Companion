import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bjj/AppShell";
import { ActivityHeatmap } from "@/components/bjj/ActivityHeatmap";
import { CharacterSheet } from "@/components/bjj/CharacterSheet";
import { EntryRewardSheet } from "@/components/bjj/EntryReward";
import { TechniqueChip } from "@/components/bjj/TechniqueCard";
import { Button, Chip, EmptyState, PageHeader } from "@/components/bjj/ui";
import { computeEntryReward, type EntryReward } from "@/lib/bjj/reward";
import { computeEntryXpReward, type EntryXpReward } from "@/lib/bjj/xp";
import { track } from "@/lib/bjj/telemetry";
import { useDiary, useProfile, useProgress, useReviewed } from "@/lib/bjj/store";
import { hapticSuccess } from "@/lib/telegram";
import { TECHNIQUES, TECH_BY_ID } from "@/lib/bjj/data";
import { BELT_ORDER, GROUP_LABEL } from "@/lib/bjj/constants";
import type { Group, Intensity, Technique } from "@/lib/bjj/types";
import { Plus, Search, CalendarDays, ChevronDown, Trash2, NotebookPen, HeartPulse, Pencil, Minus, ShieldAlert } from "lucide-react";

const MAX_ROUNDS = 20;

const INTENSITY: { key: Intensity; label: string }[] = [
  { key: "light", label: "Лёгкая" },
  { key: "medium", label: "Средняя" },
  { key: "hard", label: "Жёсткая" },
];
// Смайлы через fromCodePoint: сырой эмодзи в исходнике ломает iOS JavaScriptCore (webview Telegram)
const WELLBEING = [0x1f623, 0x1f615, 0x1f610, 0x1f642, 0x1f604].map((c) => String.fromCodePoint(c));

export const Route = createFileRoute("/diary")({
  // ?add=true — сразу открытая форма новой записи (кнопка «Записать в дневник» на «Моей игре»)
  validateSearch: (search: Record<string, unknown>): { add?: boolean } => ({
    add: search.add ? true : undefined,
  }),
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
  const { reviewed } = useReviewed();

  const [adding, setAdding] = useState(false);
  const [reward, setReward] = useState<{ reward: EntryReward; techniqueIds: number[]; xp: EntryXpReward } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [caught, setCaught] = useState<number[]>([]);
  const [caughtQuery, setCaughtQuery] = useState("");
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [wellbeing, setWellbeing] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [injury, setInjury] = useState("");
  // Выбор техник из групп: раскрытая группа под рядом чипов
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  // Вторичные поля (интенсивность/раунды/самочувствие/травма) под «Подробнее»
  const [detailsOpen, setDetailsOpen] = useState(false);

  const resetForm = () => {
    setPicked([]);
    setNote("");
    setQuery("");
    setCaught([]);
    setCaughtQuery("");
    setIntensity(null);
    setWellbeing(null);
    setRounds(0);
    setInjury("");
    setOpenGroup(null);
    setDetailsOpen(false);
    setAdding(false);
    setEditingId(null);
  };

  // Открыть форму для новой записи (чистые поля, дата — сегодня)
  const startAdd = () => {
    setEditingId(null);
    setPicked([]);
    setNote("");
    setQuery("");
    setCaught([]);
    setCaughtQuery("");
    setIntensity(null);
    setWellbeing(null);
    setRounds(0);
    setInjury("");
    setOpenGroup(null);
    setDetailsOpen(false);
    setDate(new Date().toISOString().slice(0, 10));
    setConfirmDelete(null);
    setAdding(true);
  };

  const { add } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Вход с ?add: открыть форму и вычистить параметр (replace — «назад» не переоткрывает)
  useEffect(() => {
    if (add) {
      startAdd();
      navigate({ search: {}, replace: true });
    }
  }, [add]); // eslint-disable-line react-hooks/exhaustive-deps

  // Открыть форму на редактирование существующей записи
  const startEdit = (e: (typeof entries)[number]) => {
    setEditingId(e.id);
    setAdding(true);
    setDate(e.date);
    setPicked(e.techniqueIds);
    setNote(e.note ?? "");
    setQuery("");
    setCaught(e.caughtBy ?? []);
    setCaughtQuery("");
    setIntensity(e.intensity ?? null);
    setWellbeing(e.wellbeing ?? null);
    setRounds(e.rounds ?? 0);
    setInjury(e.injury ?? "");
    setOpenGroup(null);
    // При редактировании с заполненными вторичными полями раскрываем сразу, иначе они «пропали»
    setDetailsOpen(Boolean(e.intensity || e.wellbeing || e.rounds || e.injury));
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

  // Техники раскрытой группы: не выбранные, в процессе и изученные сверху, дальше по поясам
  const groupList = useMemo(() => {
    if (!openGroup) return [];
    const rank = (t: Technique) => {
      const s = progress[t.id] ?? "not_started";
      return s === "in_progress" ? 0 : s === "done" ? 1 : 2;
    };
    return TECHNIQUES.filter((t) => t.group === openGroup && !picked.includes(t.id)).sort(
      (a, b) =>
        rank(a) - rank(b) ||
        BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) ||
        a.difficulty - b.difficulty,
    );
  }, [openGroup, picked, progress]);

  // «Чем поймали»: ищем только среди сабмишенов
  const caughtResults = useMemo(() => {
    const q = caughtQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return TECHNIQUES.filter(
      (t) =>
        t.group === "submission" &&
        !caught.includes(t.id) &&
        (t.nameRu.toLowerCase().includes(q) ||
          t.nameEn.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q)),
    ).slice(0, 6);
  }, [caughtQuery, caught]);

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
      caughtBy: caught.length > 0 ? caught : undefined,
    };
    if (editingId) {
      updateEntry(editingId, payload);
    } else {
      // показанное для разбора: без изученных (done не нуждается в разборе)
      const shownIds = picked.filter((id) => (progress[id] ?? "not_started") !== "done");
      // награда считается на данных «до»: entries и progress ещё не обновлены
      setReward({
        reward: computeEntryReward({
          entriesBefore: entries,
          entry: payload,
          progressBefore: progress,
          techniques: TECHNIQUES,
          frequency: profile.frequency,
          today: new Date(),
        }),
        techniqueIds: shownIds,
        xp: computeEntryXpReward({
          entriesBefore: entries,
          entry: payload,
          progressBefore: progress,
          techniques: TECHNIQUES,
          belt: profile.belt,
          reviewed,
        }),
      });
      addEntry(payload);
      track("entry_saved");
      if (caught.length > 0) track("caught_logged");
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
      {reward && (
        <EntryRewardSheet
          reward={reward.reward}
          techniqueIds={reward.techniqueIds}
          xp={reward.xp}
          onClose={() => setReward(null)}
        />
      )}

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

          {/* Выбор из групп: ряд чипов, тап раскрывает список техник группы */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
              <span key={g} className="shrink-0">
                <Chip active={openGroup === g} onClick={() => setOpenGroup((v) => (v === g ? null : g))}>
                  {GROUP_LABEL[g]}
                </Chip>
              </span>
            ))}
          </div>
          {openGroup && (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
              {groupList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPicked((p) => [...p, t.id])}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-muted"
                  style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                >
                  <span className="min-w-0 flex-1 truncate">{t.nameRu}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {groupList.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Все техники группы уже в записи</p>
              )}
            </div>
          )}

          {/* Чем поймали: сабмишены соперника — кормят «Что тебя ловит» и генератор */}
          {caught.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {caught.map((id) => (
                <TechniqueChip
                  key={id}
                  technique={TECH_BY_ID[id]}
                  onRemove={() => setCaught((p) => p.filter((x) => x !== id))}
                />
              ))}
            </div>
          )}
          <div className="relative">
            <ShieldAlert className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={caughtQuery}
              onChange={(e) => setCaughtQuery(e.target.value)}
              placeholder="Чем поймали? Добавить сабмишен…"
              className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {caughtResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {caughtResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setCaught((p) => [...p, t.id]); setCaughtQuery(""); }}
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

          {/* Вторичные поля свёрнуты: запись в два тапа, детали по желанию */}
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center gap-1.5 rounded-xl px-1 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            Подробнее: интенсивность, раунды, самочувствие
          </button>

          {detailsOpen && (
          <>
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
          </>
          )}

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
            {e.caughtBy && e.caughtBy.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive/70" />
                  Поймали:
                </span>
                {e.caughtBy.map((id) => {
                  const t = TECH_BY_ID[id];
                  if (!t) return null;
                  return <TechniqueChip key={id} technique={t} />;
                })}
              </div>
            )}
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
