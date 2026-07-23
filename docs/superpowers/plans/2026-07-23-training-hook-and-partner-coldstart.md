# Крючок после тренировки + вечерний пинг + холодный старт партнёров — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть петлю удержания вокруг тренировки (записал показанное -> разобрал -> задрилил) и включить холодный старт партнёров в момент темпа.

**Architecture:** Часть A — новое локальное состояние `reviewed` (что уже разобрал) + чистая функция очереди `pendingReview`, из которой питаются блок «Разбери показанное» на «Моей игре» и секция на экране награды; вечерний soft-пинг добавляется в существующую чистую `decide()` и крон. Часть B — momentum-aware empty state внутри существующего `PartnersBlock` (без нового компонента, т.к. блок уже стоит под Today). Все правки хирургические, поверх здорового ядра.

**Tech Stack:** TanStack Start/Router (React 19), Tailwind 4, Supabase (RPC телеметрии, крон-таблица `bjj_tg_chats`), vitest.

## Global Constraints

- Без эмодзи в исходнике (сырой эмодзи ломает iOS JavaScriptCore webview Telegram); символы через `String.fromCodePoint` при необходимости.
- Без em-dash в коде и текстах; комментарии по-русски (стиль проекта).
- Правило языка цвета: золото строго у достижений/тепла; статусы серый -> `--status-progress` (в процессе) -> зелёный (изучено). Новые блоки новых смыслов цвета не вводят.
- Типографика: кикеры `text-[11px] uppercase tracking-widest`, секции `text-sm font-semibold`, вторичка `text-xs`/`text-[11px]`.
- Общие контролы из `src/components/bjj/ui.tsx` (`Button`, `buttonClass`, `EmptyState`); строки техник — `TechniqueRow`/`TechniqueChip` из `TechniqueCard.tsx`. Локальные копии не плодить.
- SSR-безопасность: `new Date()`/`Math.random()`/localStorage только после гидратации, не в инициализаторах `useState`.
- Store-хуки с общей шиной (module snapshot + listeners) как `useProgress`/`useNotes`.
- Тесты: `npx vitest run`. Сейчас 95 тестов зелёные — держать зелёными.
- Деплой ручной из `bjj-companion/`: `npx vercel --prod --yes --scope ivankhr`. SQL-миграции применяет пользователь ДО деплоя серверной части.

---

### Task 1: Чистая функция очереди `pendingReview`

**Files:**
- Create: `src/lib/bjj/reviewQueue.ts`
- Test: `src/lib/bjj/reviewQueue.test.ts`

**Interfaces:**
- Consumes: `DiaryEntry` (`./types`), `ProgressMap` (`./store`, type-only).
- Produces: `pendingReview(entries: DiaryEntry[], reviewed: Record<number, number>, progress: ProgressMap, today: Date, windowDays?: number, cap?: number): number[]` — id техник для разбора, свежие сверху.

- [ ] **Step 1: Написать падающий тест**

Create `src/lib/bjj/reviewQueue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pendingReview } from "./reviewQueue";
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

function entry(date: string, ids: number[]): DiaryEntry {
  return { id: date + ids.join(","), date, techniqueIds: ids };
}

// «Сегодня» фиксировано: 16 июля 2026 (чт)
const TODAY = new Date(2026, 6, 16);
const NO_PROGRESS: ProgressMap = {};

describe("pendingReview", () => {
  it("техники из окна попадают, вне окна — нет", () => {
    const entries = [
      entry("2026-07-15", [1]), // в окне
      entry("2026-07-01", [2]), // старше 7 дней
    ];
    expect(pendingReview(entries, {}, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("разобранное (reviewed после лога) уходит", () => {
    const entries = [entry("2026-07-15", [1])];
    const shownMs = new Date(2026, 6, 15).getTime();
    // открыл карточку позже лога -> не в очереди
    expect(pendingReview(entries, { 1: shownMs + 1000 }, NO_PROGRESS, TODAY)).toEqual([]);
    // открывал ДО лога -> всё ещё в очереди
    expect(pendingReview(entries, { 1: shownMs - 1000 }, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("повторный лог возвращает разобранную технику", () => {
    // разобрал 10-го, снова показали 15-го
    const reviewedMs = new Date(2026, 6, 10).getTime();
    const entries = [entry("2026-07-15", [1])];
    expect(pendingReview(entries, { 1: reviewedMs }, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("изученная (done) не попадает", () => {
    const entries = [entry("2026-07-15", [1, 2])];
    expect(pendingReview(entries, {}, { 1: "done" }, TODAY)).toEqual([2]);
  });

  it("caughtBy не учитывается", () => {
    const e: DiaryEntry = { id: "x", date: "2026-07-15", techniqueIds: [1], caughtBy: [9] };
    expect(pendingReview([e], {}, NO_PROGRESS, TODAY)).toEqual([1]);
  });

  it("свежие сверху и кап", () => {
    const entries = [entry("2026-07-16", [3]), entry("2026-07-14", [1, 2])];
    expect(pendingReview(entries, {}, NO_PROGRESS, TODAY, 7, 2)).toEqual([3, 1]);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/reviewQueue.test.ts`
Expected: FAIL — `pendingReview is not a function` / модуль не найден.

- [ ] **Step 3: Реализовать функцию**

Create `src/lib/bjj/reviewQueue.ts`:

```ts
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

// Очередь «Разбери показанное»: техники из недавних записей дневника, которые
// пользователь ещё не открывал после лога и не отметил изученными. Чистая
// функция — «сегодня» параметром (тестируемость, SSR-безопасность).
// «Разобрал» = открыл карточку (reviewed[id] = момент открытия в ms).

// Локальная полночь дня записи ('YYYY-MM-DD') в ms
function dayStartMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function pendingReview(
  entries: DiaryEntry[],
  reviewed: Record<number, number>,
  progress: ProgressMap,
  today: Date,
  windowDays = 7,
  cap = 6,
): number[] {
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startMs = todayMs - (windowDays - 1) * 86_400_000;

  // techId -> самая свежая полночь лога в окне (по techniqueIds, НЕ caughtBy)
  const shownAt = new Map<number, number>();
  for (const e of entries) {
    const ms = dayStartMs(e.date);
    if (ms < startMs || ms > todayMs) continue;
    for (const id of e.techniqueIds) {
      if (ms > (shownAt.get(id) ?? 0)) shownAt.set(id, ms);
    }
  }

  const out: { id: number; at: number }[] = [];
  for (const [id, at] of shownAt) {
    if (progress[id] === "done") continue; // освоенное не разбираем
    if ((reviewed[id] ?? 0) < at) out.push({ id, at }); // не открывали после лога
  }
  out.sort((a, b) => b.at - a.at || a.id - b.id); // свежие сверху, id для детерминизма
  return out.slice(0, cap).map((x) => x.id);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/reviewQueue.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/reviewQueue.ts src/lib/bjj/reviewQueue.test.ts
git commit -m "$(cat <<'EOF'
feat: pendingReview — очередь «Разбери показанное»

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Хук `useReviewed` + пометка «разобрал» на карточке техники

**Files:**
- Modify: `src/lib/bjj/store.ts` (добавить хук рядом с `useNotes`, ~после строки 287)
- Modify: `src/routes/technique.$id.tsx` (импорт + эффект)

**Interfaces:**
- Consumes: `readJSON`/`writeJSON`, `useState`/`useEffect`/`useCallback` (уже в store.ts).
- Produces: `useReviewed(): { reviewed: ReviewedMap; markReviewed(id: number): void; hydrated: boolean }`, `type ReviewedMap = Record<number, number>`.

- [ ] **Step 1: Добавить хук `useReviewed` в store.ts**

В `src/lib/bjj/store.ts` рядом с ключами добавить `const REVIEWED_KEY = "bjj.reviewed.v1";` (около строки 14, к остальным `*_KEY`). Затем после блока `useNotes` (после строки 287) вставить:

```ts
// === REVIEWED HOOK ===
// Что пользователь уже «разобрал» (открыл карточку) после лога в дневнике.
// Локально, per-device: это UI-нюанс очистки блока «Разбери показанное», а не
// пользовательские данные — облако не нужно. Общая шина как у useNotes:
// пометка ставится на карточке техники, а блок живёт на «Моей игре».
export type ReviewedMap = Record<number, number>; // techId -> момент разбора (ms)

let reviewedSnapshot: ReviewedMap | null = null;
const reviewedListeners = new Set<(m: ReviewedMap) => void>();

function publishReviewed(next: ReviewedMap) {
  reviewedSnapshot = next;
  for (const listener of reviewedListeners) listener(next);
}

export function useReviewed() {
  const [reviewed, setReviewedState] = useState<ReviewedMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = reviewedSnapshot ?? readJSON<ReviewedMap>(REVIEWED_KEY, {});
    reviewedSnapshot = initial;
    setReviewedState(initial);
    setHydrated(true);
    reviewedListeners.add(setReviewedState);
    return () => {
      reviewedListeners.delete(setReviewedState);
    };
  }, []);

  const markReviewed = useCallback((id: number) => {
    const next = { ...(reviewedSnapshot ?? {}), [id]: Date.now() };
    writeJSON(REVIEWED_KEY, next);
    publishReviewed(next);
  }, []);

  return { reviewed, markReviewed, hydrated };
}
```

- [ ] **Step 2: Повесить `markReviewed` на карточку техники**

В `src/routes/technique.$id.tsx`:
- Строка 1: заменить `import { useState, useMemo } from "react";` на `import { useState, useMemo, useEffect } from "react";`
- Строка 6: добавить `useReviewed` в импорт из store: `import { useProgress, useProfile, useReviewed } from "@/lib/bjj/store";`
- В теле компонента (после того как `tech` резолвится, рядом со строкой 100 `const videoUrl = tech.videoUrl;`) добавить:

```tsx
  // Открыл карточку = разобрал показанное (уводит технику из блока «Разбери показанное»)
  const { markReviewed, hydrated: reviewedHydrated } = useReviewed();
  useEffect(() => {
    if (reviewedHydrated) markReviewed(tech.id);
  }, [reviewedHydrated, tech.id, markReviewed]);
```

- [ ] **Step 3: Прогнать всю сборку и тесты (регрессии)**

Run: `npx vitest run` затем `npx vite build`
Expected: тесты зелёные (95), сборка Ready без ошибок типов.

- [ ] **Step 4: Коммит**

```bash
git add src/lib/bjj/store.ts src/routes/technique.\$id.tsx
git commit -m "$(cat <<'EOF'
feat: useReviewed + пометка «разобрал» при открытии карточки

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Телеметрия — новые события в union и whitelist

**Files:**
- Modify: `src/lib/bjj/telemetry.ts:9-24` (union `TelemetryEvent`)
- Create: `docs/sql/2026-07-23-telemetry.sql`

**Interfaces:**
- Produces: события `review_opened`, `review_drill`, `partner_nudge` в типе `TelemetryEvent` (используются в задачах 4, 5, 8).

- [ ] **Step 1: Расширить union событий**

В `src/lib/bjj/telemetry.ts` в тип `TelemetryEvent` (после `| "pro_video_interest"` на строке 24) добавить:

```ts
  | "review_opened"
  | "review_drill"
  | "partner_nudge";
```

(Заменить точку с запятой на прежней последней строке — итоговый union должен корректно закрываться `;` после `"partner_nudge"`.)

- [ ] **Step 2: SQL-миграция whitelist**

Create `docs/sql/2026-07-23-telemetry.sql`:

```sql
-- Расширение белого списка телеметрии: разбор показанного и холодный старт партнёров.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Только create or replace функции bjj_track (таблица bjj_events уже есть,
-- docs/sql/2026-07-18-telemetry.sql). Приватность прежняя: имя события +
-- короткая метка + device_id, без содержимого записей/заметок.
--
-- Новые события: review_opened (detail = technique_id, открыл показанное из блока),
-- review_drill (тап «В отработку»), partner_nudge (клик momentum-кнопки холодного старта).

create or replace function public.bjj_track(p_device uuid, p_event text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in (
    'app_open', 'onboarding_done', 'entry_saved', 'caught_logged', 'workout_run',
    'workout_filter', 'scenario_run', 'section_open', 'reco_click', 'note_saved',
    'consent', 'invite_created', 'invite_accepted', 'partner_opened',
    'pro_video_interest', 'review_opened', 'review_drill', 'partner_nudge'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Чтение спроса на разбор (что курировать видео первым):
-- select detail as technique_id, count(*) as opens
-- from public.bjj_events where event = 'review_opened'
-- group by detail order by opens desc;
```

- [ ] **Step 3: Проверить типы**

Run: `npx vite build`
Expected: Ready без ошибок типов (union расширен корректно).

- [ ] **Step 4: Коммит**

```bash
git add src/lib/bjj/telemetry.ts docs/sql/2026-07-23-telemetry.sql
git commit -m "$(cat <<'EOF'
feat: телеметрия review_opened/review_drill/partner_nudge

SQL-миграцию whitelist применяет пользователь до деплоя.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

**После коммита сообщить пользователю: применить `docs/sql/2026-07-23-telemetry.sql` в Supabase.**

---

### Task 4: Блок «Разбери показанное» на «Моей игре»

**Files:**
- Create: `src/components/bjj/ReviewShownBlock.tsx`
- Modify: `src/routes/progress.tsx` (импорт + вставка под `<TodayCard />`, строка 148)

**Interfaces:**
- Consumes: `pendingReview` (Task 1), `useReviewed` (Task 2), `useDiary`/`useProgress` (store), `TechniqueRow`, `buttonClass`, `track`, события `review_opened`/`review_drill` (Task 3).

- [ ] **Step 1: Создать компонент**

Create `src/components/bjj/ReviewShownBlock.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { useDiary, useProgress, useReviewed } from "@/lib/bjj/store";
import { pendingReview } from "@/lib/bjj/reviewQueue";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { track } from "@/lib/bjj/telemetry";

// Блок «Разбери показанное»: техники из недавних записей, которые ещё не открывали
// после лога. Сердце крючка после тренировки — освежить детали/связи, пока свежо,
// и закинуть в свою отработку. Само-очищается (открыл карточку -> техника уходит).
export function ReviewShownBlock() {
  const { entries, hydrated: dh } = useDiary();
  const { progress, hydrated: ph } = useProgress();
  const { reviewed, hydrated: rh } = useReviewed();
  // До гидратации не считаем: new Date() и localStorage только на клиенте
  if (!dh || !ph || !rh) return null;

  const ids = pendingReview(entries, reviewed, progress, new Date());
  const techs = ids.map((id) => TECH_BY_ID[id]).filter(Boolean);
  if (techs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Разбери показанное</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Открой карточку — освежи детали и связи, пока свежо.
      </p>
      <div className="mt-3 space-y-2">
        {techs.map((t) => (
          // onClick на обёртке: TechniqueRow сам ссылка, пометка «разобрал» — на карточке
          <div key={t.id} onClick={() => track("review_opened", String(t.id))}>
            <TechniqueRow technique={t} inset />
          </div>
        ))}
      </div>
      <Link
        to="/workout"
        search={{ src: "diary" }}
        onClick={() => track("review_drill")}
        className={buttonClass("soft", "md", "mt-3 w-full")}
      >
        <Dumbbell className="h-4 w-4" />
        В отработку
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Вставить блок в progress.tsx**

В `src/routes/progress.tsx`:
- В импорты компонентов (рядом со строкой 6 `import { TodayCard } ...`) добавить:
  `import { ReviewShownBlock } from "@/components/bjj/ReviewShownBlock";`
- После `<TodayCard />` (строка 148) и перед `<PartnersBlock />` вставить:

```tsx
        <ReviewShownBlock />
```

Итоговый порядок: `PageHeader` -> `TodayCard` -> `ReviewShownBlock` -> `PartnersBlock` -> hero.

- [ ] **Step 3: Сборка + тесты**

Run: `npx vitest run` затем `npx vite build`
Expected: 95 тестов зелёные, сборка Ready.

- [ ] **Step 4: Проверить рантаймом**

Запустить dev (`preview_start` с dev-конфигом), открыть `/progress`. Через `javascript_tool`/DOM убедиться: при наличии свежих записей с не-изученными техниками блок «Разбери показанное» виден под Today; тап по строке ведёт на карточку; после возврата техника исчезла из блока (открытие пометило разобранной). Проверить обе темы. Пустой дневник -> блока нет.

- [ ] **Step 5: Коммит**

```bash
git add src/components/bjj/ReviewShownBlock.tsx src/routes/progress.tsx
git commit -m "$(cat <<'EOF'
feat: блок «Разбери показанное» на «Моей игре»

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Секция «Разбери показанное» на экране награды

**Files:**
- Modify: `src/components/bjj/EntryReward.tsx` (проп + секция)
- Modify: `src/routes/diary.tsx` (тип state награды + фильтр `done` + передача пропа)

**Interfaces:**
- Consumes: `TechniqueRow`, `buttonClass`, `track`, `TECH_BY_ID`, `Link`.
- Produces: `EntryRewardSheet` теперь принимает проп `techniqueIds: number[]`.

- [ ] **Step 1: Добавить проп и секцию в EntryReward.tsx**

В `src/components/bjj/EntryReward.tsx`:
- В импорты добавить:
```tsx
import { Link } from "@tanstack/react-router";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { TechniqueRow, buttonClass } from ... // см. ниже
import { track } from "@/lib/bjj/telemetry";
import { Dumbbell } from "lucide-react";
```
Точные импорты: `TechniqueRow` из `@/components/bjj/TechniqueCard`, `buttonClass` из `@/components/bjj/ui` (в файле уже есть `import { Button, Sheet } from "@/components/bjj/ui";` — дополнить до `import { Button, Sheet, buttonClass } from "@/components/bjj/ui";`), `Dumbbell` добавить к существующему импорту иконок из `lucide-react` (строка 5).
- Сигнатуру компонента (строка 53) изменить на:
```tsx
export function EntryRewardSheet({
  reward,
  techniqueIds,
  onClose,
}: {
  reward: EntryReward;
  techniqueIds: number[];
  onClose: () => void;
}) {
```
- Перед финальной кнопкой «Отлично» (строка 153, внутри `<Sheet>`, после закрывающего `</div>` блока дельт на строке 151) вставить секцию:

```tsx
      {techniqueIds.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Разбери показанное
          </p>
          {techniqueIds.map((id) => {
            const t = TECH_BY_ID[id];
            if (!t) return null;
            return (
              <div key={id} onClick={() => track("review_opened", String(id))}>
                <TechniqueRow technique={t} inset />
              </div>
            );
          })}
          <Link
            to="/workout"
            search={{ src: "diary" }}
            onClick={() => track("review_drill")}
            className={buttonClass("soft", "md", "w-full")}
          >
            <Dumbbell className="h-4 w-4" />
            В отработку
          </Link>
        </div>
      )}
```

- [ ] **Step 2: Прокинуть отфильтрованные id из diary.tsx**

В `src/routes/diary.tsx`:
- Строка 50: заменить
```tsx
  const [reward, setReward] = useState<EntryReward | null>(null);
```
на
```tsx
  const [reward, setReward] = useState<{ reward: EntryReward; techniqueIds: number[] } | null>(null);
```
- В `save()` (ветка нового entry, строки 196-206) заменить `setReward(computeEntryReward({...}))` так, чтобы отфильтровать изученные и сохранить id:
```tsx
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
      });
```
- Строка 239: заменить рендер на:
```tsx
      {reward && (
        <EntryRewardSheet
          reward={reward.reward}
          techniqueIds={reward.techniqueIds}
          onClose={() => setReward(null)}
        />
      )}
```

- [ ] **Step 3: Сборка + тесты**

Run: `npx vitest run` затем `npx vite build`
Expected: 95 тестов зелёные, сборка Ready (проп типизирован, `EntryReward` импорт в diary.tsx уже есть).

- [ ] **Step 4: Проверить рантаймом**

Открыть `/diary`, добавить запись с не-изученной техникой -> экран награды показывает секцию «Разбери показанное» со строками и кнопкой «В отработку». Запись только с изученными техниками -> секции нет. Тап по строке уводит на карточку (шторка закрывается). Обе темы.

- [ ] **Step 5: Коммит**

```bash
git add src/components/bjj/EntryReward.tsx src/routes/diary.tsx
git commit -m "$(cat <<'EOF'
feat: секция «Разбери показанное» на экране награды

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Вечерний soft-пинг в `decide()`

**Files:**
- Modify: `src/lib/bjj/tgRemind.ts` (тип `TgChatRow`, `CronDecision`, логика `decide`)
- Modify: `src/lib/bjj/tgRemind.test.ts` (обновить 3 существующих ассерта + новые тесты)

**Interfaces:**
- Consumes: существующая `decide(row, todayIso, dow, mondayIso)`.
- Produces: `CronDecision` включает `kind: "soft"`; `TgChatRow` включает `soft_ping_week: string | null; soft_ping_count: number`; экспорт `SOFT_CAP` (для крона).

- [ ] **Step 1: Обновить существующие тесты под soft + добавить новые**

В `src/lib/bjj/tgRemind.test.ts`:
- В хелпере `row()` (строки 10-23) добавить в дефолт два поля: `soft_ping_week: null,` и `soft_ping_count: 0,`.
- Строки 48-49 (пн/вт пустой недели) — теперь soft, заменить на:
```ts
    expect(decide(row(), "2026-07-13", 1, MONDAY).kind).toBe("soft"); // пн: план не горит -> мягкий нудж
    expect(decide(row(), "2026-07-14", 2, MONDAY).kind).toBe("soft"); // вт: тоже мягкий
```
- Строка 63 (1 из 3, среда, не горит) — теперь soft:
```ts
    expect(decide(row({ week_done: 1 }), "2026-07-15", 3, MONDAY).kind).toBe("soft");
```
- Добавить новый describe в конец файла (после блока «глушители»):
```ts
describe("decide: вечерний soft-пинг", () => {
  it("трен. день, план не горит, недобор -> soft", () => {
    const d = decide(row(), "2026-07-13", 1, MONDAY); // пн, need 3 < after 5
    expect(d.kind).toBe("soft");
    expect(d.kind === "soft" && d.text).toContain("Была тренировка");
  });

  it("кап 2/нед: третий soft на неделе -> тишина", () => {
    const r = row({ soft_ping_week: MONDAY, soft_ping_count: 2 });
    expect(decide(r, "2026-07-13", 1, MONDAY).kind).toBe("none");
  });

  it("счётчик прошлой недели не считается (сброс)", () => {
    const r = row({ soft_ping_week: "2026-07-06", soft_ping_count: 5 });
    expect(decide(r, "2026-07-13", 1, MONDAY).kind).toBe("soft");
  });

  it("план горит -> remind важнее soft", () => {
    // ср пустой недели: need 3 >= after 3 -> remind
    expect(decide(row(), "2026-07-15", 3, MONDAY).kind).toBe("remind");
  });

  it("логировал сегодня -> ни soft, ни remind", () => {
    expect(decide(row({ last_entry: "2026-07-13" }), "2026-07-13", 1, MONDAY).kind).toBe("none");
  });

  it("выходной день (кастомные дни) soft не шлёт", () => {
    // Пн/Ср/Пт; вторник не тренировочный
    expect(decide(row({ training_days: [0, 2, 4] }), "2026-07-14", 2, MONDAY).kind).toBe("none");
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run src/lib/bjj/tgRemind.test.ts`
Expected: FAIL (soft ещё не реализован; тип row без soft-полей ломает сборку теста).

- [ ] **Step 3: Реализовать soft в tgRemind.ts**

В `src/lib/bjj/tgRemind.ts`:
- В `interface TgChatRow` (после `last_ping` на строке 44) добавить:
```ts
  soft_ping_week: string | null; // понедельник недели последнего мягкого нуджа
  soft_ping_count: number; // сколько мягких нуджей на этой неделе
```
- Тип решения (строка 48) заменить на:
```ts
export type CronDecision =
  | { kind: "none" }
  | { kind: "remind" | "recap" | "soft"; text: string };
```
- Над `decide` добавить константы:
```ts
export const SOFT_CAP = 2; // максимум мягких нуджей в неделю
const SOFT_TEXT =
  "Была тренировка сегодня? Запиши, что показали — потом разберёшь в приложении. Отключить: /mute";
```
- В `decide`, блок с `need` (строки 95-100) заменить:
```ts
  // Горит, когда будущих тренировочных дней уже не хватает на недостающие тренировки
  const need = quota - done;
  if (need <= 0) return { kind: "none" };
  if (row.last_entry === todayIso) return { kind: "none" }; // сегодня уже отметился
  if (need < after) {
    // План не горит: мягкий вечерний нудж, если кап недели не исчерпан
    const usedThisWeek = row.soft_ping_week === mondayIso ? row.soft_ping_count : 0;
    if (usedThisWeek >= SOFT_CAP) return { kind: "none" };
    return { kind: "soft", text: SOFT_TEXT };
  }
  const text = `План недели под угрозой: ${done} из ${quota}, осталось ${after} ${dayWord(after)} до конца недели. Тренировался — отметь в два тапа. Отключить напоминания: /mute`;
  return { kind: "remind", text };
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npx vitest run src/lib/bjj/tgRemind.test.ts`
Expected: PASS (все, включая обновлённые и новый describe).

- [ ] **Step 5: Полный прогон**

Run: `npx vitest run`
Expected: все зелёные (95 + новые soft-тесты).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/bjj/tgRemind.ts src/lib/bjj/tgRemind.test.ts
git commit -m "$(cat <<'EOF'
feat: вечерний soft-пинг в decide() (кап 2/нед)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Крон — отправка soft-пинга + миграция колонок

**Files:**
- Modify: `src/routes/api.tg-cron.ts` (PATCH счётчиков soft при успешной отправке)
- Create: `docs/sql/2026-07-23-evening-ping.sql`

**Interfaces:**
- Consumes: `decide` возвращает `kind: "soft"`, `SOFT_CAP`, поля `soft_ping_week`/`soft_ping_count` в `TgChatRow` (Task 6).

- [ ] **Step 1: SQL-миграция колонок**

Create `docs/sql/2026-07-23-evening-ping.sql`:

```sql
-- Вечерний soft-пинг: счётчик мягких нуджей на неделе (кап 2/нед) в bjj_tg_chats.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- ДО деплоя серверной части (крон читает/пишет эти колонки).

alter table public.bjj_tg_chats
  add column if not exists soft_ping_week date,
  add column if not exists soft_ping_count int not null default 0;
```

- [ ] **Step 2: Обновить PATCH в кроне**

В `src/routes/api.tg-cron.ts`, блок успешной отправки (строки 65-71, `if (res?.ok)`), заменить тело на:

```ts
          if (res?.ok) {
            sent++;
            const patch: Record<string, unknown> = { last_ping: todayIso };
            if (d.kind === "soft") {
              const used = row.soft_ping_week === mondayIso ? row.soft_ping_count : 0;
              patch.soft_ping_week = mondayIso;
              patch.soft_ping_count = used + 1;
            }
            await fetch(`${supaUrl}/rest/v1/bjj_tg_chats?tg_user_id=eq.${row.tg_user_id}`, {
              method: "PATCH",
              headers: { ...supaHeaders, Prefer: "return=minimal" },
              body: JSON.stringify(patch),
            }).catch(() => {});
          } else if (res?.status === 403) {
```

(Остальная ветка `else if (res?.status === 403)` не меняется.)

- [ ] **Step 3: Сборка**

Run: `npx vite build`
Expected: Ready (крон типизирован, `d.kind === "soft"` в союзе).

- [ ] **Step 4: Коммит**

```bash
git add src/routes/api.tg-cron.ts docs/sql/2026-07-23-evening-ping.sql
git commit -m "$(cat <<'EOF'
feat: крон шлёт soft-пинг и ведёт счётчик недели

Миграцию колонок применяет пользователь до деплоя.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

**После коммита сообщить пользователю: применить `docs/sql/2026-07-23-evening-ping.sql` ДО деплоя. Живую доставку soft-пинга проверяет пользователь на реальном чате.**

---

### Task 8: Холодный старт партнёров (momentum-aware empty state)

**Files:**
- Modify: `src/lib/bjj/partners.ts` (общий хелпер `sharePartnerInvite`)
- Modify: `src/components/bjj/PartnersBlock.tsx` (empty state + переход `onInvite` на хелпер + momentum)

**Interfaces:**
- Consumes: `publishProfile`, `markPartnersJoined` (partners.ts), `shareText`, `buildInviteLink` (share.ts), `planStreak`/`dayStreak`/`trainedByDate` (plan.ts), `track("partner_nudge")` (Task 3).
- Produces: `sharePartnerInvite(input: PublishInput): Promise<string | null>`.

- [ ] **Step 1: Вынести общий invite-хелпер в partners.ts**

В `src/lib/bjj/partners.ts`:
- В начало добавить импорт: `import { shareText, buildInviteLink } from "./share";`
- В конец файла добавить:
```ts
// Общий invite-флоу: публикует профиль, помечает участие, открывает шторку выбора
// чата с личной ссылкой-кодом. Используют кнопка «Пригласить» и холодный старт.
export async function sharePartnerInvite(input: PublishInput): Promise<string | null> {
  const code = await publishProfile(input);
  if (!code) return null;
  markPartnersJoined();
  await shareText(
    "Давай держать недельный план вместе в BJJ Companion. Прими приглашение в партнёры:",
    buildInviteLink(code),
  );
  return code;
}
```

- [ ] **Step 2: Перевести `onInvite` на хелпер и добавить momentum empty state**

В `src/components/bjj/PartnersBlock.tsx`:
- В импорт из partners (строки 5-14) добавить `sharePartnerInvite`.
- Добавить импорт из plan: `import { planStreak, dayStreak, trainedByDate } from "@/lib/bjj/plan";`
- Заменить тело `onInvite` (строки 342-354) на:
```tsx
  const onInvite = async () => {
    haptic();
    setBusy(true);
    const code = await sharePartnerInvite(currentInput());
    setBusy(false);
    if (!code) return flash("Не получилось. Попробуй позже");
    track("invite_created");
  };
```
- Перед `return (` компонента (около строки 395) добавить расчёт темпа:
```tsx
  // Холодный старт: активный призыв в пустом состоянии, если есть недельный темп
  const today = new Date();
  const trained = trainedByDate(entries);
  const weeksStreak = profile.frequency ? planStreak(trained, profile.frequency, today) : 0;
  const daysStreakNoPlan = profile.frequency ? 0 : dayStreak(trained, today);
  const hasMomentum = weeksStreak >= 1 || daysStreakNoPlan >= 3;
  const momentumLine =
    weeksStreak >= 2
      ? `Серия ${weeksStreak} нед. в плане — держи темп с партнёром`
      : daysStreakNoPlan >= 3
        ? `${daysStreakNoPlan} дн. подряд — держи темп с партнёром`
        : "Ты в темпе — позови партнёра по залу";
```
- Заменить ветку пустого состояния (строки 444-449, `partners.length === 0 ? (<EmptyState ... />)`) на:
```tsx
        ) : partners.length === 0 ? (
          hasMomentum ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-medium">{momentumLine}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Держать недельный план вместе проще.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  track("partner_nudge");
                  void onInvite();
                }}
                disabled={busy}
                className="mt-2"
              >
                <UserPlus className="h-4 w-4" />
                Позвать партнёра
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Пока никого"
              hint="Пригласи партнёра — держать недельный план вместе проще."
            />
          )
        ) : (
```

- [ ] **Step 3: Сборка + тесты**

Run: `npx vitest run` затем `npx vite build`
Expected: зелёные, Ready. (Циклов импорта нет: share.ts не импортит partners.ts.)

- [ ] **Step 4: Проверить рантаймом (стаб Telegram)**

В превью со стабом Telegram + согласием, при 0 партнёров: без темпа — прежний тихий `EmptyState`; при закрытой неделе/серии — активный призыв с primary-кнопкой «Позвать партнёра». Клик открывает шеринг (перехват `openTelegramLink`/`writeText`). Обе темы. Обычная кнопка «Пригласить» в шапке по-прежнему работает.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/partners.ts src/components/bjj/PartnersBlock.tsx
git commit -m "$(cat <<'EOF'
feat: холодный старт партнёров — momentum-aware приглашение

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Финал (после всех задач)

- [ ] Полный прогон `npx vitest run` (все зелёные) + `npx vite build` (Ready).
- [ ] Деплой: `npx vercel --prod --yes --scope ivankhr` из `bjj-companion/` (после того как пользователь применил обе SQL-миграции). Curl-проверка прода (урок 3/8): строки новых блоков в бандле, SSR отдаёт 200.
- [ ] Обновить `CLAUDE.md` (новый пункт сессии: что сделано, открытые хвосты — живая доставка soft-пинга и deep-link партнёров проверяются пользователем).

## Self-Review (проведён при написании)

**Покрытие спека:** A1 `pendingReview` -> Task 1; A1/A2 `useReviewed`+`markReviewed` -> Task 2; A3 блок -> Task 4; A4 награда -> Task 5; A5 soft-пинг -> Task 6 (логика) + Task 7 (крон+миграция); телеметрия -> Task 3; B momentum empty state + `sharePartnerInvite` -> Task 8. Все разделы покрыты.

**Плейсхолдеры:** нет — весь код и команды приведены полностью.

**Согласованность типов:** `pendingReview(entries, reviewed, progress, today, windowDays?, cap?)` одинаково в Task 1 и потребителях (Task 4). `ReviewedMap`/`useReviewed` из Task 2 используются в Task 4. Проп `techniqueIds: number[]` определён в Task 5 (EntryReward) и там же передаётся. `CronDecision.kind` включает `soft` (Task 6), крон читает `d.kind === "soft"` (Task 7). `sharePartnerInvite(PublishInput)` определён в Task 8 и там же вызван. События телеметрии (`review_opened`/`review_drill`/`partner_nudge`) объявлены в Task 3 до использования.
