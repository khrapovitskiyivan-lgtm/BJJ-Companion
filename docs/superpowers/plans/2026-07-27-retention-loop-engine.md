# Retention Loop — Insights Engine (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить чистый клиентский движок `insights.ts` — «что сделать сегодня» — собирающий ранжированные инсайты из дневника поверх существующих чистых функций.

**Architecture:** Чистая функция `computeInsights(input) -> Insight[]` (сортирована по весу) + `primaryAction()`. Живёт на клиенте (сервер дневник не видит). Переиспользует `caught`/`reviewQueue`/`todayCard`/`nextToLearn`. Новое: окно у `topCatchers`, чистый `staleToRepeat`, композитор с калиброванными весами (из спайка).

**Tech Stack:** TypeScript, vitest. Чистые функции, `today` параметром (SSR-safe, детерминизм).

**Спека:** [2026-07-27-retention-loop-design.md](../specs/2026-07-27-retention-loop-design.md). **Это Plan 1 из 3** (движок). Дальше: Plan 2 — рендерер `TodayAction` + консолидация 4 блоков в `progress.tsx` + телеметрия; Plan 3 — утренний пуш выходного (`decide`/крон). Каждый — свой файл-план.

## Global Constraints
- Без эмодзи и em-dash. Комментарии в коде — по-русски.
- Чистые функции: `today: Date` параметром, никаких `new Date()` внутри, никакого доступа к localStorage/DOM.
- Не менять данные (CSV/JSON), не трогать существующее поведение других модулей.
- Пороги/веса — строго из спеки (калибровка спайка): catcher `100+count*10` (окно 30д, порог 2+), review `80`, repeat-stale `70` (21д), plan `60`, learn-next `40`, cold-start `200` (нет записей за 7д).
- Запуск тестов: `npx vitest run <path>`.

---

### Task 1: Окно у `topCatchers` в `caught.ts`

**Files:**
- Modify: `src/lib/bjj/caught.ts`
- Test: `src/lib/bjj/caught.test.ts`

**Interfaces:**
- Produces: `topCatchers(entries: DiaryEntry[], limit?: number, opts?: { sinceMs?: number }): { id: number; count: number }[]` — при `sinceMs` учитывает только записи с датой `>= sinceMs`.

- [ ] **Step 1: Написать падающий тест**

В `src/lib/bjj/caught.test.ts` добавить (если файла нет — создать с импортом `import { describe, it, expect } from "vitest"; import { topCatchers } from "./caught"; import type { DiaryEntry } from "./types";`):

```typescript
describe("topCatchers окно", () => {
  it("с sinceMs игнорирует записи старше окна", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-25", techniqueIds: [], caughtBy: [31, 31] }, // свежее, 2x
      { id: "2", date: "2026-06-01", techniqueIds: [], caughtBy: [40, 40] }, // старое, 2x
    ];
    const sinceMs = new Date(2026, 6, 1).getTime(); // 1 июля 2026
    const out = topCatchers(entries, 3, { sinceMs });
    expect(out.map((c) => c.id)).toEqual([31]);
  });

  it("без sinceMs поведение прежнее", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-25", techniqueIds: [], caughtBy: [31, 31] },
      { id: "2", date: "2026-06-01", techniqueIds: [], caughtBy: [40, 40] },
    ];
    expect(topCatchers(entries, 3).map((c) => c.id).sort()).toEqual([31, 40]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/caught.test.ts`
Expected: FAIL — `topCatchers` не принимает `opts`, окно не фильтрует (первый тест вернёт оба id).

- [ ] **Step 3: Реализовать окно**

В `src/lib/bjj/caught.ts` заменить сигнатуру `topCatchers` и добавить парсер даты:

```typescript
// Локальная полночь 'yyyy-mm-dd' в ms
function dayMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

// Чем ловят: 2+ раз — закономерность, один раз — случайность.
// opts.sinceMs — учитывать только записи начиная с этой полночи (окно свежести).
export function topCatchers(
  entries: DiaryEntry[],
  limit = 3,
  opts?: { sinceMs?: number },
): { id: number; count: number }[] {
  const within = opts?.sinceMs != null ? entries.filter((e) => dayMs(e.date) >= opts.sinceMs!) : entries;
  return [...caughtCounts(within)]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/caught.test.ts`
Expected: PASS (оба теста). Прогнать и полный `npx vitest run` — прежние тесты зелёные.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/caught.ts src/lib/bjj/caught.test.ts
git commit -m "insights: окно свежести у topCatchers"
```

---

### Task 2: `staleToRepeat` в `insights.ts`

**Files:**
- Create: `src/lib/bjj/insights.ts`
- Test: `src/lib/bjj/insights.test.ts`

**Interfaces:**
- Produces: `staleToRepeat(entries: DiaryEntry[], progress: ProgressMap, today: Date, staleDays?: number, cap?: number): number[]` — id изученных (`done`) техник, которых нет в `techniqueIds` дневника `staleDays`+ дней (самые залежавшиеся первыми). Пустой дневник -> `[]`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/bjj/insights.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { staleToRepeat } from "./insights";
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

const TODAY = new Date(2026, 6, 27); // 27 июля 2026

describe("staleToRepeat", () => {
  it("возвращает изученное, чего 3+ недель нет в дневнике; свежее не берёт", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-26", techniqueIds: [70], caughtBy: [] }, // 70 свежее
      { id: "2", date: "2026-06-20", techniqueIds: [132], caughtBy: [] }, // 132 старое (>3 нед)
    ];
    const progress: ProgressMap = { 70: "done", 132: "done", 200: "done" }; // 200 done, но не в дневнике
    const out = staleToRepeat(entries, progress, TODAY, 21, 5);
    expect(out).toContain(132);
    expect(out).toContain(200);
    expect(out).not.toContain(70);
  });

  it("пустой дневник -> пусто", () => {
    expect(staleToRepeat([], { 200: "done" }, TODAY, 21, 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: FAIL — модуль `./insights` не существует.

- [ ] **Step 3: Реализовать `staleToRepeat`**

Создать `src/lib/bjj/insights.ts`:

```typescript
import type { DiaryEntry } from "./types";
import type { ProgressMap } from "./store";

// Локальная полночь 'yyyy-mm-dd' в ms
function dayMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
function todayMs(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

// «Пора повторить»: изученное (done), чего нет в techniqueIds дневника staleDays+ дней.
// Никогда не встречавшееся в дневнике done тоже считается залежавшимся. Пустой дневник -> [].
export function staleToRepeat(
  entries: DiaryEntry[],
  progress: ProgressMap,
  today: Date,
  staleDays = 21,
  cap = 5,
): number[] {
  if (entries.length === 0) return [];
  const lastSeen = new Map<number, number>();
  for (const e of entries) {
    const ms = dayMs(e.date);
    for (const id of e.techniqueIds) if (ms > (lastSeen.get(id) ?? 0)) lastSeen.set(id, ms);
  }
  const cutoff = todayMs(today) - staleDays * 86_400_000;
  const out: { id: number; at: number }[] = [];
  for (const key of Object.keys(progress)) {
    const id = Number(key);
    if (progress[id] !== "done") continue;
    const seen = lastSeen.get(id) ?? 0;
    if (seen <= cutoff) out.push({ id, at: seen });
  }
  out.sort((a, b) => a.at - b.at || a.id - b.id); // самые залежавшиеся первыми
  return out.slice(0, cap).map((x) => x.id);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: PASS (оба теста).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/insights.ts src/lib/bjj/insights.test.ts
git commit -m "insights: staleToRepeat (пора повторить, чистая)"
```

---

### Task 3: `computeInsights` + `primaryAction`

**Files:**
- Modify: `src/lib/bjj/insights.ts`
- Test: `src/lib/bjj/insights.test.ts`

**Interfaces:**
- Consumes: `staleToRepeat` (Task 2), `topCatchers`/`defensesFor` (Task 1 + существующий), `pendingReview`, `todayCardModel`, `nextToLearn`.
- Produces:
  - `type InsightKind = "cold-start" | "catcher-defense" | "review-shown" | "repeat-stale" | "plan" | "learn-next"`
  - `interface Insight { kind: InsightKind; weight: number; techniqueIds: number[]; reason: string; route: string }`
  - `computeInsights(input: InsightsInput): Insight[]` (сортирован по weight desc)
  - `primaryAction(insights: Insight[]): Insight | null`
  - `interface InsightsInput { entries; progress; reviewed; belt; goal?; gi?; noGi?; frequency?; techniques; today }`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/lib/bjj/insights.test.ts` (в конец; фабрика синтетической техники, чтобы не зависеть от реальных данных):

```typescript
import { computeInsights, primaryAction } from "./insights";
import type { Technique, Belt } from "./types";

function tech(id: number, over: Partial<Technique> = {}): Technique {
  return {
    id, label: `t${id}`, title: `t${id}`, nameRu: `t${id}`, nameEn: `t${id}`,
    group: "position", belt: "white", styles: [], gi: true, noGi: true,
    legal_ibjjf_gi: true, legal_ibjjf_nogi: true, legal_adcc: true,
    points_ibjjf: 0, points_adcc: 0, tags: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 1,
    successRate: "N/A", energyCost: "Low", content: {}, ...over,
  };
}
const base = { belt: "blue" as Belt, techniques: [] as Technique[], today: TODAY };

describe("computeInsights / primaryAction", () => {
  it("нет записей за 7 дней -> primary cold-start (вес 200)", () => {
    const ins = computeInsights({ ...base, entries: [], progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("cold-start");
    expect(pa?.weight).toBe(200);
  });

  it("свежий паттерн ловли (2+ в окне) с защитой -> primary catcher-defense", () => {
    const defense = tech(900, { group: "escape", setup_from: [31] }); // защита от 31
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-26", techniqueIds: [], caughtBy: [31, 31] },
    ];
    const ins = computeInsights({ ...base, techniques: [defense], entries, progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("catcher-defense");
    expect(pa?.techniqueIds).toContain(900);
  });

  it("свежий лог без паттерна, не разобрано -> primary review-shown", () => {
    const entries: DiaryEntry[] = [
      { id: "1", date: "2026-07-27", techniqueIds: [354, 368], caughtBy: [] },
    ];
    const ins = computeInsights({ ...base, entries, progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("review-shown");
  });

  it("catcher вне окна (старый) не перебивает review-shown", () => {
    const defense = tech(900, { group: "escape", setup_from: [31] });
    const entries: DiaryEntry[] = [
      { id: "old", date: "2026-05-01", techniqueIds: [], caughtBy: [31, 31] }, // >30 дней
      { id: "new", date: "2026-07-27", techniqueIds: [354], caughtBy: [] },
    ];
    const ins = computeInsights({ ...base, techniques: [defense], entries, progress: {}, reviewed: {}, frequency: 3 });
    expect(primaryAction(ins)?.kind).toBe("review-shown");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: FAIL — `computeInsights`/`primaryAction` не определены.

- [ ] **Step 3: Реализовать композитор**

Добавить в `src/lib/bjj/insights.ts` (импорты — вверх файла к существующим):

```typescript
import type { Technique, Belt, Goal, Frequency } from "./types";
import { topCatchers, defensesFor } from "./caught";
import { pendingReview } from "./reviewQueue";
import { todayCardModel } from "./todayCard";
import { nextToLearn } from "./recommend";

export type InsightKind = "cold-start" | "catcher-defense" | "review-shown" | "repeat-stale" | "plan" | "learn-next";
export interface Insight { kind: InsightKind; weight: number; techniqueIds: number[]; reason: string; route: string }
export interface InsightsInput {
  entries: DiaryEntry[];
  progress: ProgressMap;
  reviewed: Record<number, number>;
  belt: Belt;
  goal?: Goal;
  gi?: boolean;
  noGi?: boolean;
  frequency?: Frequency;
  techniques: Technique[];
  today: Date;
}

const DAY = 86_400_000;
const nameOf = (techs: Technique[], id: number) => techs.find((t) => t.id === id)?.nameRu ?? `#${id}`;

export function computeInsights(input: InsightsInput): Insight[] {
  const { entries, progress, reviewed, belt, goal, gi, noGi, frequency, techniques, today } = input;
  const nowMs = todayMs(today);
  const out: Insight[] = [];

  // cold-start: нет записей за последние 7 дней -> вернуть к записи (перебивает контент)
  const recent = entries.some((e) => dayMs(e.date) >= nowMs - 6 * DAY);
  if (!recent) {
    out.push({ kind: "cold-start", weight: 200, techniqueIds: [], reason: "Запиши тренировку за 30 секунд", route: "/diary?add" });
  }

  // catcher-defense: 2+ ловли в окне 30 дней, есть невыученная защита
  for (const c of topCatchers(entries, 3, { sinceMs: nowMs - 30 * DAY })) {
    const defs = defensesFor(c.id, techniques, 3).filter((t) => progress[t.id] !== "done");
    if (defs.length) {
      out.push({
        kind: "catcher-defense", weight: 100 + c.count * 10, techniqueIds: defs.map((d) => d.id),
        reason: `Тебя ${c.count} раза поймали на «${nameOf(techniques, c.id)}»`, route: `/technique/${defs[0].id}`,
      });
    }
  }

  // review-shown: показанное на тренировке за 7 дней, не открытое после лога
  const rev = pendingReview(entries, reviewed, progress, today, 7, 6);
  if (rev.length) {
    out.push({ kind: "review-shown", weight: 80, techniqueIds: rev, reason: `Разбери показанное (${rev.length})`, route: `/technique/${rev[0]}` });
  }

  // repeat-stale
  const stale = staleToRepeat(entries, progress, today, 21, 5);
  if (stale.length) {
    out.push({ kind: "repeat-stale", weight: 70, techniqueIds: stale, reason: `Пора повторить: «${nameOf(techniques, stale[0])}»`, route: `/technique/${stale[0]}` });
  }

  // plan: недобор недели
  const tc = todayCardModel(entries, frequency, today);
  if (tc.week && tc.week.done < tc.week.quota && tc.week.daysLeft > 0) {
    out.push({ kind: "plan", weight: 60, techniqueIds: [], reason: `До плана недели ${tc.week.quota - tc.week.done}`, route: "/diary?add" });
  }

  // learn-next: фолбэк (goal-aware)
  const nl = nextToLearn(techniques, progress, belt, 1, { goal, gi, noGi });
  if (nl.length) {
    out.push({ kind: "learn-next", weight: 40, techniqueIds: [nl[0].id], reason: `Следующая цель: «${nl[0].nameRu}»`, route: `/technique/${nl[0].id}` });
  }

  out.sort((a, b) => b.weight - a.weight || (a.techniqueIds[0] ?? 0) - (b.techniqueIds[0] ?? 0));
  return out;
}

export function primaryAction(insights: Insight[]): Insight | null {
  return insights[0] ?? null;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: PASS (все кейсы). Затем полный `npx vitest run` — всё зелёное. Затем `npx tsc --noEmit` — в изменённых файлах (`insights.ts`, `caught.ts`) без новых ошибок (прежние ошибки `recommend.ts`/`store.ts` про `prereqs`/`a`/`b` — не наши).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/insights.ts src/lib/bjj/insights.test.ts
git commit -m "insights: движок computeInsights + primaryAction"
```

---

## Дальше (отдельные планы, НЕ в этом файле)
- **Plan 2 — рендерер + консолидация:** `TodayAction.tsx` (герой `primaryAction` + раскрытие «что ещё»); замена 4 реко-блоков в `progress.tsx` на него; удалить инлайновый repeat-stale из `progress.tsx` (заменён `staleToRepeat`); телеметрия `insight_shown`/`insight_click` (union `telemetry.ts` + whitelist SQL); рантайм-проверка в превью.
- **Plan 3 — триггер:** утренний нудж выходного «3 минуты повторить» — новый kind в `tgRemind.decide()` (+тест) + слот крона `api.tg-cron.ts`; проверить, что web_app-кнопка ведёт на экран с TodayAction.
