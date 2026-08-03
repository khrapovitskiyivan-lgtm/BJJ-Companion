# Пауза тренировок — Фаза 1 (клиент) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователь ставит тренировки на паузу (травма/отпуск/перерыв); в приложении план перестаёт «гореть», серия замирает (не рвётся), блок «Сегодня» спокойный. Чисто клиент, без SQL.

**Architecture:** Пауза хранится в профиле как история интервалов `pauses: PausePeriod[]` (активная = без `to`). Чистые хелперы `pause.ts` (string-даты yyyy-mm-dd, лексикографическое сравнение = хронологическое). `planStreak`/`dayStreak` получают опц. `pauses` и ПРОПУСКАЮТ паузные периоды (серия не рвётся). `todayCardModel` при активной паузе возвращает состояние `paused` вместо `week`; `ProgressTop` рисует спокойную плашку. Постановка/снятие — секция «Пауза» в листе игрока (`CharacterSheet`).

**Tech Stack:** TypeScript, React 19 (TanStack Start SSR), vitest. Даты — параметром (детерминизм/SSR).

## Global Constraints

- В коде и ответах: без эмодзи и без em-dash. Комментарии на русском (как в проекте).
- Даты внутри модели — строки `yyyy-mm-dd` (совпадает с `plan.ts::dayKey`); сравнение строк = хронологическое.
- Обратная совместимость: новый параметр `pauses` во всех сигнатурах ОПЦИОНАЛЕН и последний; без него поведение прежнее (существующие вызовы и тесты не ломаются).
- Фаза 1 — ТОЛЬКО клиент, БЕЗ SQL и без изменений бота/партнёров (это Фазы 2-3).
- Чистые функции — «сегодня» параметром. Хирургические правки, стиль окружающего кода.
- Тесты: `npx vitest run <файл>`. Рантайм-проверка UI — через DOM/`javascript_tool` (скриншоты этого приложения таймаутят), обе темы. Порт превью сверять по `preview_logs`.
- Профиль-стаб для превью: `localStorage['bjj.profile.v1']` = `{"belt":"blue","gi":true,"noGi":true,"theme":"light","locale":"ru","onboardingDone":true,"consentChoice":"accepted","consentVersion":2}`.

## Резолюция объёма (что НЕ входит в Фазу 1)
- `weekStatus`/календарь дневника (историческая «недобор»-штриховка паузных недель) — отдельный маленький follow-up; на текущий нудж не влияет.
- Явный экран «С возвращением» — переиспользуется существующий `return-after-pause` (инсайт при разрыве 14-90 дней); отдельного экрана не делаем.
- Бот (`/pause`, тишина, SQL) — Фаза 2. Партнёры «на паузе» — Фаза 3.

---

### Task 1: Модель паузы + чистые хелперы `pause.ts`

**Files:**
- Modify: `src/lib/bjj/types.ts` (добавить `PausePeriod` + поле `pauses?` в `StyleProfile`)
- Create: `src/lib/bjj/pause.ts`
- Test: `src/lib/bjj/pause.test.ts`

**Interfaces:**
- Produces:
  - `interface PausePeriod { from: string; until?: string; to?: string }` (types.ts).
  - `StyleProfile.pauses?: PausePeriod[]`.
  - `activePause(pauses: PausePeriod[] | undefined, todayKey: string): PausePeriod | null`
  - `isPausedOn(k: string, pauses: PausePeriod[] | undefined, todayKey: string): boolean`
  - `weekOverlapsPause(weekKeys: string[], pauses: PausePeriod[] | undefined, todayKey: string): boolean`

- [ ] **Step 1: Добавить тип и поле профиля**

В `src/lib/bjj/types.ts`, перед `export interface StyleProfile`:

```ts
// Период паузы тренировок (травма/отпуск/перерыв). from/until/to — yyyy-mm-dd.
// Активная пауза — та, у которой нет `to`. until — планируемая дата возврата
// (опционально, для авто-снятия). to — фактическая дата снятия.
export interface PausePeriod {
  from: string;
  until?: string;
  to?: string;
}
```

В `StyleProfile` добавить поле (рядом с `preferredStyles`):

```ts
  preferredStyles?: Style[]; // выбранные игроком стили игры (заменяют «качества»)
  pauses?: PausePeriod[];    // история пауз тренировок; активная = без `to`
```

- [ ] **Step 2: Написать падающие тесты хелперов**

Создать `src/lib/bjj/pause.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activePause, isPausedOn, weekOverlapsPause } from "./pause";
import type { PausePeriod } from "./types";

const P = (p: PausePeriod[]) => p;

describe("activePause", () => {
  it("без пауз -> null", () => {
    expect(activePause(undefined, "2026-08-10")).toBeNull();
  });
  it("открытая пауза (нет to, нет until) -> активна", () => {
    const p = P([{ from: "2026-08-03" }]);
    expect(activePause(p, "2026-08-10")).toEqual({ from: "2026-08-03" });
  });
  it("с датой возврата в будущем -> активна", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-20" }]);
    expect(activePause(p, "2026-08-10")?.from).toBe("2026-08-03");
  });
  it("дата возврата прошла -> авто-снята, null", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-08" }]);
    expect(activePause(p, "2026-08-10")).toBeNull();
  });
  it("закрытая (есть to) -> null", () => {
    const p = P([{ from: "2026-08-03", to: "2026-08-06" }]);
    expect(activePause(p, "2026-08-10")).toBeNull();
  });
});

describe("isPausedOn", () => {
  const open = P([{ from: "2026-08-03" }]);
  it("день внутри открытой паузы (from..today) -> true", () => {
    expect(isPausedOn("2026-08-05", open, "2026-08-10")).toBe(true);
  });
  it("день до начала -> false", () => {
    expect(isPausedOn("2026-08-01", open, "2026-08-10")).toBe(false);
  });
  it("день после авто-снятия по until -> false", () => {
    const p = P([{ from: "2026-08-03", until: "2026-08-08" }]);
    expect(isPausedOn("2026-08-09", p, "2026-08-10")).toBe(false);
  });
  it("день в закрытом интервале [from,to] -> true", () => {
    const p = P([{ from: "2026-08-03", to: "2026-08-06" }]);
    expect(isPausedOn("2026-08-04", p, "2026-08-10")).toBe(true);
  });
});

describe("weekOverlapsPause", () => {
  const week = ["2026-08-03","2026-08-04","2026-08-05","2026-08-06","2026-08-07","2026-08-08","2026-08-09"];
  it("неделя с паузным днём -> true", () => {
    expect(weekOverlapsPause(week, P([{ from: "2026-08-05", to: "2026-08-05" }]), "2026-08-20")).toBe(true);
  });
  it("неделя вне паузы -> false", () => {
    expect(weekOverlapsPause(week, P([{ from: "2026-09-01" }]), "2026-09-10")).toBe(false);
  });
});
```

- [ ] **Step 3: Запустить тесты — падают**

Run: `npx vitest run src/lib/bjj/pause.test.ts`
Expected: FAIL (модуль `./pause` не найден).

- [ ] **Step 4: Реализовать `pause.ts`**

Создать `src/lib/bjj/pause.ts`:

```ts
import type { PausePeriod } from "./types";

// Чистые хелперы паузы. Даты — строки yyyy-mm-dd (сравнение строк = хронологическое).

// Эффективный конец периода: фактическое снятие `to`; иначе если дата возврата
// `until` уже прошла — авто-снятие на `until`; иначе сегодня (пауза ещё активна
// и покрывает дни по сегодня включительно).
function effEnd(p: PausePeriod, todayKey: string): string {
  if (p.to) return p.to;
  if (p.until && p.until < todayKey) return p.until;
  return todayKey;
}

// Активная сейчас пауза: без `to` и (без `until` или `until` ещё не прошёл).
export function activePause(
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): PausePeriod | null {
  if (!pauses) return null;
  for (const p of pauses) {
    if (!p.to && (!p.until || p.until >= todayKey)) return p;
  }
  return null;
}

// Попадает ли день k в какой-либо паузный интервал [from, effEnd].
export function isPausedOn(
  k: string,
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): boolean {
  if (!pauses) return false;
  for (const p of pauses) {
    if (k >= p.from && k <= effEnd(p, todayKey)) return true;
  }
  return false;
}

// Пересекает ли календарная неделя (ключи её дней) какую-либо паузу.
export function weekOverlapsPause(
  weekKeys: string[],
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): boolean {
  if (!pauses) return false;
  return weekKeys.some((k) => isPausedOn(k, pauses, todayKey));
}
```

- [ ] **Step 5: Запустить тесты — проходят**

Run: `npx vitest run src/lib/bjj/pause.test.ts`
Expected: PASS (Test Files 1 passed, Tests 11 passed).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/bjj/types.ts src/lib/bjj/pause.ts src/lib/bjj/pause.test.ts
git commit -m "feat(pause): модель PausePeriod + чистые хелперы pause.ts"
```

---

### Task 2: Заморозка серии — `planStreak` и `dayStreak`

**Files:**
- Modify: `src/lib/bjj/plan.ts` (`planStreak`, `dayStreak` — добавить опц. `pauses`)
- Test: `src/lib/bjj/plan.test.ts` (существующий; дописать кейсы)

**Interfaces:**
- Consumes: `weekOverlapsPause`, `isPausedOn` (Task 1), `dayKey` (plan.ts).
- Produces:
  - `planStreak(trained, quota, today, pauses?): number` — паузные недели не рвут серию.
  - `dayStreak(trained, today, pauses?): number` — паузные дни не рвут серию.

- [ ] **Step 1: Дописать падающие тесты в `plan.test.ts`**

В `src/lib/bjj/plan.test.ts` добавить (импорт `planStreak, dayStreak, trainedByDate` — проверить, что есть; `type PausePeriod` из `./types`):

```ts
import { planStreak, dayStreak, trainedByDate } from "./plan";
import type { PausePeriod } from "./types";

describe("planStreak с паузой", () => {
  // Квота 3/нед. Неделя A (2026-07-27..08-02) добита, неделя B (08-03..08-09) пропущена
  // из-за паузы, неделя C (08-10..08-16) снова добита. Пауза не должна порвать серию.
  const trained = trainedByDate([
    { id: "1", date: "2026-07-27", techniqueIds: [1] },
    { id: "2", date: "2026-07-29", techniqueIds: [1] },
    { id: "3", date: "2026-07-31", techniqueIds: [1] },
    { id: "4", date: "2026-08-10", techniqueIds: [1] },
    { id: "5", date: "2026-08-12", techniqueIds: [1] },
    { id: "6", date: "2026-08-14", techniqueIds: [1] },
  ]);
  const pauses: PausePeriod[] = [{ from: "2026-08-03", to: "2026-08-09" }];
  const today = new Date(2026, 7, 14); // пт 14 авг, неделя C

  it("без пауз паузная неделя рвёт серию -> 1", () => {
    expect(planStreak(trained, 3, today)).toBe(1); // только текущая неделя C
  });
  it("с паузой неделя B пропускается -> серия 2 (C + A)", () => {
    expect(planStreak(trained, 3, today, pauses)).toBe(2);
  });
});

describe("dayStreak с паузой", () => {
  const trained = trainedByDate([
    { id: "1", date: "2026-08-01", techniqueIds: [1] },
    { id: "2", date: "2026-08-02", techniqueIds: [1] },
    { id: "3", date: "2026-08-06", techniqueIds: [1] },
  ]);
  const pauses: PausePeriod[] = [{ from: "2026-08-03", to: "2026-08-05" }];
  const today = new Date(2026, 7, 6); // 6 авг тренировался
  it("паузные дни 03-05 не рвут дневную серию -> 3", () => {
    expect(dayStreak(trained, today, pauses)).toBe(3); // 06 + (пауза 05,04,03) + 02,01
  });
  it("без пауз серия рвётся на 03 -> 1", () => {
    expect(dayStreak(trained, today)).toBe(1);
  });
});
```

- [ ] **Step 2: Запустить — новые падают**

Run: `npx vitest run src/lib/bjj/plan.test.ts`
Expected: FAIL на новых кейсах (`planStreak`/`dayStreak` ещё не принимают `pauses`).

- [ ] **Step 3: Обновить `planStreak` в `plan.ts`**

Вверху файла добавить импорт:

```ts
import { weekOverlapsPause, isPausedOn } from "./pause";
import type { PausePeriod } from "./types";
```

Заменить сигнатуру и тело `planStreak` (сейчас строки 107-132):

```ts
export function planStreak(
  trained: Map<string, number>,
  quota: Frequency,
  today: Date,
  pauses?: PausePeriod[],
): number {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = dayKey(t0);
  const monday = new Date(t0);
  monday.setDate(t0.getDate() - ((t0.getDay() + 6) % 7));

  const weekKeys = (start: Date): string[] => {
    const ks: string[] = [];
    const c = new Date(start);
    for (let i = 0; i < 7; i++) {
      ks.push(dayKey(c));
      c.setDate(c.getDate() + 1);
    }
    return ks;
  };
  const weekDone = (start: Date): number => weekKeys(start).filter((k) => trained.has(k)).length;

  let streak = 0;
  const cursor = new Date(monday);
  if (weekDone(cursor) >= quota) streak++;
  // Назад по закрытым неделям; предохранитель — 10 лет
  for (let i = 0; i < 520; i++) {
    cursor.setDate(cursor.getDate() - 7);
    if (weekDone(cursor) >= quota) streak++;
    else if (weekOverlapsPause(weekKeys(cursor), pauses, todayKey)) continue; // пауза не рвёт серию
    else break;
  }
  return streak;
}
```

- [ ] **Step 4: Обновить `dayStreak` в `plan.ts`**

Заменить `dayStreak` (сейчас строки 81-90):

```ts
export function dayStreak(trained: Map<string, number>, today: Date, pauses?: PausePeriod[]): number {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = dayKey(t0);
  const cursor = new Date(t0);
  // если сегодня не тренировался и не на паузе — серия считается со вчера (днём не сгорает)
  const ck = dayKey(cursor);
  if (!trained.has(ck) && !isPausedOn(ck, pauses, todayKey)) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  for (;;) {
    const k = dayKey(cursor);
    if (trained.has(k)) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (isPausedOn(k, pauses, todayKey)) {
      cursor.setDate(cursor.getDate() - 1); // паузный день пропускаем: не рвёт и не считается
    } else break;
  }
  return n;
}
```

- [ ] **Step 5: Запустить — проходят, регрессов нет**

Run: `npx vitest run src/lib/bjj/plan.test.ts`
Expected: PASS (все прежние + новые).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/bjj/plan.ts src/lib/bjj/plan.test.ts
git commit -m "feat(pause): заморозка серии planStreak/dayStreak на паузных периодах"
```

---

### Task 3: `todayCardModel` — состояние «на паузе»

**Files:**
- Modify: `src/lib/bjj/todayCard.ts`
- Modify: `src/routes/progress.tsx:105` (пробросить `profile.pauses`)
- Test: `src/lib/bjj/todayCard.test.ts` (дописать)

**Interfaces:**
- Consumes: `activePause` (Task 1), `planStreak`/`dayStreak` с `pauses` (Task 2).
- Produces:
  - `TodayCardModel.paused?: { until?: string }`
  - `todayCardModel(entries, frequency, today, trainingDays?, pauses?): TodayCardModel`

- [ ] **Step 1: Дописать падающий тест**

В `src/lib/bjj/todayCard.test.ts` добавить (импорт `type PausePeriod` из `./types`):

```ts
import type { PausePeriod } from "./types";

it("активная пауза -> paused, без week", () => {
  const pauses: PausePeriod[] = [{ from: "2026-07-14" }];
  const m = todayCardModel([entry("2026-07-10")], 3, new Date(2026, 6, 16), undefined, pauses);
  expect(m.paused).toEqual({ until: undefined });
  expect(m.week).toBeUndefined();
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/lib/bjj/todayCard.test.ts`
Expected: FAIL (`todayCardModel` не принимает `pauses`; `paused` нет).

- [ ] **Step 3: Обновить `todayCard.ts`**

Импорты вверху дополнить:

```ts
import { dayKey, trainedByDate, weekDays, weekStatus, planStreak, dayStreak, daysLeftInWeek } from "./plan";
import { activePause } from "./pause";
import type { DiaryEntry, Frequency, PausePeriod } from "./types";
```

Добавить поле в `TodayCardModel`:

```ts
export interface TodayCardModel {
  loggedToday: boolean;
  week?: { done: number; quota: number; over: number; daysLeft: number };
  paused?: { until?: string }; // активная пауза: показываем спокойное «На паузе»
  weeksStreak: number;
  daysStreakNoPlan: number;
}
```

Заменить тело `todayCardModel`:

```ts
export function todayCardModel(
  entries: DiaryEntry[],
  frequency: Frequency | undefined,
  today: Date,
  trainingDays?: number[],
  pauses?: PausePeriod[],
): TodayCardModel {
  const trained = trainedByDate(entries);
  const loggedToday = trained.has(dayKey(today));
  const pause = activePause(pauses, dayKey(today));
  if (pause) {
    return {
      loggedToday,
      paused: { until: pause.until },
      weeksStreak: frequency ? planStreak(trained, frequency, today, pauses) : 0,
      daysStreakNoPlan: frequency ? 0 : dayStreak(trained, today, pauses),
    };
  }
  if (!frequency) {
    return { loggedToday, weeksStreak: 0, daysStreakNoPlan: dayStreak(trained, today, pauses) };
  }
  const ws = weekStatus(weekDays(today), trained, frequency, today);
  return {
    loggedToday,
    week: { done: ws.done, quota: ws.quota, over: ws.over, daysLeft: daysLeftInWeek(today, loggedToday, trainingDays) },
    weeksStreak: planStreak(trained, frequency, today, pauses),
    daysStreakNoPlan: 0,
  };
}
```

- [ ] **Step 4: Пробросить `profile.pauses` в `progress.tsx`**

В `src/routes/progress.tsx` строка 105, было:

```ts
      ? todayCardModel(entries, profile.frequency, new Date(), profile.trainingDays)
```

Стало:

```ts
      ? todayCardModel(entries, profile.frequency, new Date(), profile.trainingDays, profile.pauses)
```

- [ ] **Step 5: Запустить — проходят**

Run: `npx vitest run src/lib/bjj/todayCard.test.ts`
Expected: PASS (прежние + новый).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/bjj/todayCard.ts src/routes/progress.tsx src/lib/bjj/todayCard.test.ts
git commit -m "feat(pause): todayCardModel состояние paused + проброс profile.pauses"
```

---

### Task 4: UI блока «Сегодня» — спокойная плашка «На паузе» (`ProgressTop`)

**Files:**
- Modify: `src/components/bjj/ProgressTop.tsx` (правая колонка «Сегодня»)

**Interfaces:**
- Consumes: `today.paused?: { until?: string }` (Task 3). Снятие паузы — колбэк, добавляемый в Task 5 (пока рендерим статичную плашку без кнопки-снятия; кнопка «Снять» живёт в листе игрока Task 5).

- [ ] **Step 1: Прочитать регион «Сегодня» в ProgressTop**

Прочитать `src/components/bjj/ProgressTop.tsx` строки ~205-265 (правая колонка: кикер «Сегодня», ветки `today.week` / `loggedToday` / кнопка «Записать»). Найти начало условного рендера колонки «Сегодня».

- [ ] **Step 2: Добавить ветку `today.paused` первой в колонке «Сегодня»**

В правой колонке «Сегодня», ПЕРЕД существующими ветками (`today.week ? ... : ...`), добавить приоритетную проверку паузы. Обёртка колонки уже есть; вставить сразу после кикера `<p ...>Сегодня</p>`:

```tsx
{today.paused ? (
  <div className="mt-2 rounded-xl border border-border bg-muted/40 p-3">
    <div className="flex items-center gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-primary">
        <rect x="6" y="4" width="4" height="16" rx="1.3" fill="currentColor" />
        <rect x="14" y="4" width="4" height="16" rx="1.3" fill="currentColor" />
      </svg>
      <span className="text-sm font-semibold">На паузе</span>
    </div>
    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
      {today.paused.until
        ? `План и серия заморожены до ${today.paused.until}. Отдыхай.`
        : "План и серия заморожены. Отдыхай, вернёшься — встретим."}
    </p>
  </div>
) : today.week ? (
  /* ...существующая ветка week без изменений... */
```

Закрыть добавленную тернарку так, чтобы существующие ветки (`today.week ? (...) : ...`) стали её else-веткой. То есть обернуть текущее содержимое колонки в `today.paused ? (плашка) : (текущее)`. Кнопку «Записать» существующая ветка рендерит внутри `today.week`/`loggedToday` — при паузе она не показывается (мы в другой ветке).

- [ ] **Step 3: Проверить сборку рантаймом (пауза видна)**

Собрать данные не нужно (модель/UI). Поднять превью (`preview_start` имя `bjj-companion`), порт сверить по `preview_logs`. Проставить профиль-стаб (Global Constraints) + активную паузу, перезагрузить `/progress`:

```js
// в javascript_tool: добавить паузу в профиль и перезагрузить
const p = JSON.parse(localStorage.getItem("bjj.profile.v1"));
p.frequency = 3; p.pauses = [{ from: "2020-01-01" }];
localStorage.setItem("bjj.profile.v1", JSON.stringify(p));
location.href = "http://localhost:<порт>/progress";
```

Затем DOM-проверка:

```js
(() => ({
  hasPaused: document.body.innerText.includes("На паузе"),
  noBurn: !document.body.innerText.includes("До плана"),
  frozen: document.body.innerText.includes("заморожены"),
}))();
```

Expected: `hasPaused: true`, `noBurn: true`, `frozen: true`. Проверить обе темы (переключить `p.theme`), ошибок из своего кода в `read_console_messages` нет (известный tg-стаб/`data-tsd-source` игнорировать).

- [ ] **Step 4: Коммит**

```bash
git add src/components/bjj/ProgressTop.tsx
git commit -m "feat(pause): спокойная плашка «На паузе» в блоке «Сегодня»"
```

---

### Task 5: Секция «Пауза» в листе игрока (`CharacterSheet`)

**Files:**
- Modify: `src/components/bjj/CharacterSheet.tsx` (добавить `<Section title="Пауза">` после «Дни тренировок»)

**Interfaces:**
- Consumes: `activePause` (Task 1), `dayKey` (plan.ts), `useProfile().update` (мерж профиля), `PausePeriod` (types).
- Produces: постановка паузы (открытая или с датой `until`) и снятие (`to = сегодня`) через `update({ pauses })`.

- [ ] **Step 1: Импорты и хелперы состояния паузы**

В `src/components/bjj/CharacterSheet.tsx` дополнить импорты:

```ts
import { activePause } from "@/lib/bjj/pause";
import { dayKey } from "@/lib/bjj/plan";
import type { Belt, Frequency, Goal, PausePeriod } from "@/lib/bjj/types";
import { useState } from "react";
```

Внутри компонента (после `const { profile, update } = useProfile();`) добавить:

```ts
  const todayKey = dayKey(new Date());
  const pause = activePause(profile.pauses, todayKey);
  const [pauseUntil, setPauseUntil] = useState("");

  // Ставит паузу: закрывает любую «застрявшую» активную (авто-снятую по дате),
  // затем добавляет новую (открытую или с датой возврата until).
  const startPause = (until?: string) => {
    const prev = (profile.pauses ?? []).map((p) =>
      !p.to && p !== pause ? { ...p, to: p.until ?? todayKey } : p,
    );
    update({ pauses: [...prev, until ? { from: todayKey, until } : { from: todayKey }] });
  };
  // Снимает активную паузу: проставляет фактическую дату снятия.
  const endPause = () => {
    update({
      pauses: (profile.pauses ?? []).map((p) => (p === pause ? { ...p, to: todayKey } : p)),
    });
  };
```

- [ ] **Step 2: Добавить секцию «Пауза» после «Дни тренировок»**

Сразу ПОСЛЕ закрывающего `</Section>` блока «Дни тренировок» (перед секцией «Стиль игры») вставить:

```tsx
      <Section title="Пауза" hint="Травма, отпуск, перерыв? План и серия замрут, напоминания выключатся. Это не провал.">
        {pause ? (
          <div className="rounded-xl border-2 p-3" style={{ borderColor: "var(--color-primary)", background: "color-mix(in oklch, var(--color-primary) 6%, var(--color-card))" }}>
            <p className="text-sm font-semibold text-primary">
              На паузе с {pause.from}
              {pause.until ? ` · до ${pause.until}` : " · без срока"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">План и серия заморожены. Вернёшься — встретим.</p>
            <button
              onClick={endPause}
              className="mt-3 rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Снять паузу
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => startPause()}
              className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
            >
              Поставить на паузу
            </button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={pauseUntil}
                onChange={(e) => setPauseUntil(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Дата возврата"
              />
              <button
                onClick={() => pauseUntil && startPause(pauseUntil)}
                disabled={!pauseUntil}
                className="rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-40"
              >
                До даты
              </button>
            </div>
          </div>
        )}
      </Section>
```

- [ ] **Step 3: Рантайм-проверка (поставить/снять)**

Превью (порт по `preview_logs`), профиль-стаб + открыть лист игрока. Проще проверить через прямой вызов из DOM состояния до/после, т.к. лист игрока — шторка по тапу. Открыть `/progress`, затем:

```js
// поставить паузу через тот же профиль-мерж, что делает кнопка
const p = JSON.parse(localStorage.getItem("bjj.profile.v1"));
const today = new Date().toISOString().slice(0,10);
p.pauses = [{ from: today }];
localStorage.setItem("bjj.profile.v1", JSON.stringify(p));
location.href = location.origin + "/progress";
```

Открыть лист игрока (тап по профилю) и DOM-проверка секции:

```js
(() => ({
  section: document.body.innerText.includes("Пауза"),
  active: document.body.innerText.includes("На паузе с"),
  hasEnd: [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Снять паузу"),
}))();
```

Expected: `section: true`, `active: true`, `hasEnd: true`. Снять паузу (localStorage `pauses[0].to = today`), убедиться что показывается «Поставить на паузу». Обе темы, консоль без ошибок своего кода.

- [ ] **Step 4: Полный прогон тестов + сборка данных**

Run: `npx vitest run`
Expected: все зелёные (прежние + новые pause/plan/todayCard).

Run: `node scripts/build-data.mjs`
Expected: OK (данные не трогали; sanity).

- [ ] **Step 5: Коммит**

```bash
git add src/components/bjj/CharacterSheet.tsx
git commit -m "feat(pause): секция «Пауза» в листе игрока (поставить/снять, дата возврата)"
```

---

## Self-Review

**1. Spec coverage (Фаза 1 из спеки):**
- Поле `pauses` (история) -> Task 1. ✓
- Хелперы activePause/isPausedOn/weekOverlapsPause -> Task 1. ✓
- Заморозка `planStreak`/`dayStreak` (пропуск паузных периодов) -> Task 2. ✓
- «Сегодня» состояние paused (todayCard + ProgressTop) -> Task 3, 4. ✓
- UI постановки/снятия в листе игрока (открытая + дата возврата + авто-снятие через activePause) -> Task 5. ✓
- Граничные: авто-снятие по дате (effEnd в pause.ts), пауза среди недели (weekOverlapsPause -> skip в planStreak), закрытие «застрявшей» активной при новой постановке (startPause). ✓
- Явно вне Фазы 1 (зафиксировано в «Резолюция объёма»): weekStatus/календарь, экран «С возвращением», бот, партнёры.

**2. Placeholder scan:** заглушек нет; весь код приведён.

**3. Type consistency:** `PausePeriod{from,until?,to?}` одинаков в types/pause/plan/todayCard/CharacterSheet. `activePause(pauses,todayKey)`, `isPausedOn(k,pauses,todayKey)`, `weekOverlapsPause(weekKeys,pauses,todayKey)` — вызовы совпадают с сигнатурами. `planStreak(...,pauses?)`, `dayStreak(...,pauses?)`, `todayCardModel(...,pauses?)` — опциональный последний параметр везде; `progress.tsx` передаёт `profile.pauses`. `TodayCardModel.paused?.until` читается в `ProgressTop`. ✓
