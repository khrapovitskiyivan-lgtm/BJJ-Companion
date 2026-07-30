# Связный генератор отработки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить плоский список генератора отработки на якорный позиционный кластер из графа (вход -> якорь -> продолжения -> родня), взвешенный избранным/стилем/целью, с фиксами безопасности (#2) и мёртвых качеств (#3).

**Architecture:** Новый чистый модуль `src/lib/bjj/workoutCluster.ts` (SSR-safe, всё параметрами). `workout.ts` вызывает его вместо «отсортировать available и срезать». Иерархия сигналов: прогресс/дневник (гейт) -> избранное (якорь) -> стиль (вес) -> goal (нудж+безопасность), с инвариантом «избранный якорь не выкидывается».

**Tech Stack:** TanStack Start (React 19), TypeScript, vitest, lucide-react, Tailwind CSS 4.

## Global Constraints

- ИНВАРИАНТ ДОВЕРИЯ: goal и стиль НИКОГДА не удаляют технику, которую пользователь занёс в избранное; они меняют только порядок/вес. Тесты это проверяют.
- Цикличность графа (урок 5): любой обход `setup_from`/`chain_to` — с `visited`-guard и капом длины.
- Данные техник НЕ меняются: `node scripts/build-data.mjs` не запускать.
- Внутренние идентификаторы сторов/телеметрии не переименовывать.
- В коде и текстах: без эмодзи и em-dash. Комментарии по-русски.
- Тесты — на синтетических техниках (id вне базы 1..700, как в существующих тестах), чтобы не зависеть от реальных данных.
- Обе темы (светлая/тёмная) для UI. Это маршрут `/workout` (список), НЕ граф — скриншоты списка работают.
- Превью: launch-конфиг `bjj-companion` (порт 8080) в КОРНЕВОМ `.claude/launch.json` умбрелла-репо.
- Обновлять `p_detail` строкой; телеметрия fire-and-forget (до применения SQL событие глотается catch — это нормально).

---

### Task 1: Фикс #2 — безопасность по реальному сигналу риска

**Files:**
- Modify: `src/lib/bjj/workout.ts` (добавить `isCriticalTech`, переключить `safetyOk`, убрать `CRITICAL_TAGS`)
- Test: `src/lib/bjj/workout.test.ts` (существующий — добавить кейсы)

**Interfaces:**
- Produces: `export function isCriticalTech(t: Technique): boolean` — критичность по `injuryRisk «КРИТИЧНО»` или тегам `leg_locks`/`spinal_lock`.

- [ ] **Step 1: Тест на isCriticalTech (падающий)**

В `src/lib/bjj/workout.test.ts` добавить (импорт `isCriticalTech` из `./workout`):
```ts
import { isCriticalTech } from "./workout";

function critTech(over: Partial<Technique> = {}): Technique {
  return {
    id: 9001, label: "T", title: "T", nameRu: "T", nameEn: "T", group: "submission",
    belt: "white", styles: [], gi: true, noGi: true, legal_ibjjf_gi: true, legal_ibjjf_nogi: true,
    legal_adcc: true, points_ibjjf: 0, points_adcc: 0, tags: [], aliases: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 2, successRate: "N/A",
    energyCost: "Low", content: { ru: { concept: "", mechanics: "", keyPoints: "", when: "",
    mistakes: "", drills: "", injuryRisk: "Низкий", tapWarning: "Нет" } }, ...over,
  } as Technique;
}

describe("isCriticalTech", () => {
  it("ловит КРИТИЧНО в injuryRisk", () => {
    expect(isCriticalTech(critTech({ content: { ru: { concept:"",mechanics:"",keyPoints:"",when:"",mistakes:"",drills:"",injuryRisk:"КРИТИЧНО (колено)",tapWarning:"" } } }))).toBe(true);
  });
  it("ловит теги leg_locks и spinal_lock", () => {
    expect(isCriticalTech(critTech({ tags: ["leg_locks"] }))).toBe(true);
    expect(isCriticalTech(critTech({ tags: ["spinal_lock"] }))).toBe(true);
  });
  it("обычную технику не считает критичной", () => {
    expect(isCriticalTech(critTech())).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workout.test.ts`
Expected: FAIL (`isCriticalTech` не экспортирована).

- [ ] **Step 3: Реализация в workout.ts**

Заменить (строки ~10-11 и safetyOk 17-26):
```ts
const CRITICAL_TAGS = ["dangerous", "critical", "high_risk"];
const BANNED_IDS = new Set<number>([384]); // Kani Basami — запрещён во всех режимах smart
```
на:
```ts
const BANNED_IDS = new Set<number>([384]); // Kani Basami — запрещён во всех режимах smart

// Критичность техники: реальный сигнал риска (тег dangerous/critical/high_risk в базе
// не встречается — фикс #2). Опасное = injuryRisk «КРИТИЧНО» или ножные/шейные замки.
export function isCriticalTech(t: Technique): boolean {
  const injury = t.content?.ru?.injuryRisk ?? "";
  if (injury.startsWith("КРИТИЧНО")) return true;
  return t.tags.includes("leg_locks") || t.tags.includes("spinal_lock");
}
```
И в `safetyOk` заменить строку `const isCritical = t.tags.some((x) => CRITICAL_TAGS.includes(x));` на:
```ts
  const isCritical = isCriticalTech(t);
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workout.ts src/lib/bjj/workout.test.ts
git commit -m "fix(отработка): безопасность по injuryRisk/leg_locks/spinal_lock (мёртвый CRITICAL_TAGS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: workoutCluster.ts — effective style (фикс #1 действует у всех)

**Files:**
- Create: `src/lib/bjj/workoutCluster.ts`
- Test: `src/lib/bjj/workoutCluster.test.ts`

**Interfaces:**
- Consumes: `computeStyleAffinity(progress, practiceCount)` из `./styleProfile`.
- Produces: `export function effectiveStyleSet(profile: StyleProfile, progress: ProgressMap, practiceCount: Record<number, number>): Set<Style>` и `export function practiceCountFrom(entries: DiaryEntry[]): Record<number, number>`.

- [ ] **Step 1: Тест (падающий)**

Создать `src/lib/bjj/workoutCluster.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { effectiveStyleSet, practiceCountFrom } from "./workoutCluster";
import type { DiaryEntry, StyleProfile, Style, Technique } from "./types";

// Полная синтетическая техника с переопределениями
export function T(over: Partial<Technique> = {}): Technique {
  return {
    id: 1, label: "T", title: "T", nameRu: "T", nameEn: "T", group: "submission",
    belt: "white", styles: [], gi: true, noGi: true, legal_ibjjf_gi: true, legal_ibjjf_nogi: true,
    legal_adcc: true, points_ibjjf: 0, points_adcc: 0, tags: [], aliases: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 2, successRate: "N/A",
    energyCost: "Low", content: { ru: { concept:"",mechanics:"",keyPoints:"",when:"",mistakes:"",drills:"",injuryRisk:"Низкий",tapWarning:"Нет" } }, ...over,
  } as Technique;
}
const prof = (over: Partial<StyleProfile> = {}): StyleProfile =>
  ({ belt: "blue", gi: true, noGi: true, theme: "light", locale: "ru", onboardingDone: true, ...over });

describe("effectiveStyleSet", () => {
  it("preferredStyles приоритетнее выведенного", () => {
    const s = effectiveStyleSet(prof({ preferredStyles: ["back_hunter" as Style] }), {}, {});
    expect(s.has("back_hunter" as Style)).toBe(true);
    expect(s.size).toBe(1);
  });
  it("пустой preferredStyles -> пустой набор при пустой активности", () => {
    expect(effectiveStyleSet(prof(), {}, {}).size).toBe(0);
  });
});

describe("practiceCountFrom", () => {
  it("считает повторы техник в записях", () => {
    const entries: DiaryEntry[] = [
      { id: "a", date: "2026-07-01", techniqueIds: [10, 20] },
      { id: "b", date: "2026-07-02", techniqueIds: [10] },
    ];
    expect(practiceCountFrom(entries)).toEqual({ 10: 2, 20: 1 });
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Создать workoutCluster.ts с двумя функциями**

```ts
// === Якорный позиционный кластер: подбор связной отработки из графа ===
// Иерархия сигналов: прогресс/дневник (гейт) -> избранное (якорь) -> стиль (вес)
// -> goal (нудж). Инвариант: избранный якорь не выкидывается goal/стилем.
import { computeStyleAffinity } from "./styleProfile";
import { goalScore } from "./recommend";
import { topCatchers } from "./caught";
import type { DiaryEntry, Goal, Style, StyleProfile, Technique } from "./types";
import type { FavoritesMap, ProgressMap } from "./store";

// Повторы техник в дневнике (как practiceCount в сторе/статах)
export function practiceCountFrom(entries: DiaryEntry[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const e of entries) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
  return m;
}

// Effective style: заданный игроком (preferredStyles) приоритетнее выведенного из
// активности (топ computeStyleAffinity). Даёт стиль-вес у всех без нового экрана онбординга.
export function effectiveStyleSet(
  profile: StyleProfile, progress: ProgressMap, practiceCount: Record<number, number>,
): Set<Style> {
  if (profile.preferredStyles?.length) return new Set(profile.preferredStyles);
  const top = computeStyleAffinity(progress, practiceCount)[0]?.style;
  return top ? new Set<Style>([top]) : new Set<Style>();
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workoutCluster.ts src/lib/bjj/workoutCluster.test.ts
git commit -m "feat(отработка): workoutCluster — effective style (preferredStyles ?? выведенный)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: pickAnchor — выбор якоря по иерархии сигналов + ротация

**Files:**
- Modify: `src/lib/bjj/workoutCluster.ts`
- Test: `src/lib/bjj/workoutCluster.test.ts`

**Interfaces:**
- Consumes: `goalScore` из `./recommend`; `FavoritesMap`/`ProgressMap` из `./store`.
- Produces:
  ```ts
  export function recentDiaryIds(entries: DiaryEntry[], days: number, today?: Date): Set<number>
  export function pickAnchor(input: {
    available: Technique[]; favorites: FavoritesMap; progress: ProgressMap; entries: DiaryEntry[];
    styleSet: Set<Style>; goal?: Goal; gi?: boolean; noGi?: boolean; avoidId?: number;
    source: "profile" | "diary";
  }): Technique | null
  ```

- [ ] **Step 1: Тесты (падающие)**

Добавить в `workoutCluster.test.ts`:
```ts
import { pickAnchor, recentDiaryIds } from "./workoutCluster";
import type { FavoritesMap } from "./store";

describe("pickAnchor", () => {
  const base = { entries: [] as DiaryEntry[], styleSet: new Set<Style>(), source: "profile" as const };
  it("избранное бьёт in_progress", () => {
    const av = [T({ id: 10 }), T({ id: 20 })];
    const fav: FavoritesMap = { 20: true };
    const a = pickAnchor({ ...base, available: av, favorites: fav, progress: { 10: "in_progress" } });
    expect(a?.id).toBe(20);
  });
  it("инвариант доверия: goal=health не выкидывает избранный лег-лок-якорь", () => {
    const legFav = T({ id: 30, tags: ["leg_locks"], group: "submission" });
    const escape = T({ id: 40, group: "escape" });
    const a = pickAnchor({ ...base, available: [legFav, escape], favorites: { 30: true }, progress: {}, goal: "health" });
    expect(a?.id).toBe(30); // избранное (tier) выше goalScore-штрафа
  });
  it("avoidId исключается (ротация)", () => {
    const av = [T({ id: 10 }), T({ id: 20 })];
    const a = pickAnchor({ ...base, available: av, favorites: { 10: true, 20: true }, progress: {}, avoidId: 10 });
    expect(a?.id).toBe(20);
  });
  it("пустой пул -> null (холодный старт)", () => {
    const a = pickAnchor({ ...base, available: [T({ id: 10 })], favorites: {}, progress: {} });
    expect(a).toBeNull();
  });
  it("diary-источник берёт свежую технику из дневника", () => {
    const av = [T({ id: 10 }), T({ id: 99 })];
    const entries: DiaryEntry[] = [{ id: "a", date: "2026-07-30", techniqueIds: [99] }];
    const a = pickAnchor({ available: av, favorites: {}, progress: {}, entries, styleSet: new Set(), source: "diary", today: undefined } as any);
    expect(a?.id).toBe(99);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: FAIL (`pickAnchor`/`recentDiaryIds` не определены).

- [ ] **Step 3: Реализация pickAnchor + recentDiaryIds**

Добавить в `workoutCluster.ts`:
```ts
const RECENT_DAYS = 21;
const DAY_MS = 86_400_000;

// Техники из записей дневника за последние `days` дней
export function recentDiaryIds(entries: DiaryEntry[], days: number, today: Date = new Date()): Set<number> {
  const cutoff = today.getTime() - days * DAY_MS;
  const out = new Set<number>();
  for (const e of entries) {
    const [y, m, d] = e.date.split("-").map(Number);
    if (new Date(y, m - 1, d).getTime() >= cutoff) for (const id of e.techniqueIds) out.add(id);
  }
  return out;
}

// Выбор якоря. Пул: profile -> избранное ∪ in_progress; diary -> плюс свежий дневник (приоритетно).
// Ранг тиров кодирует иерархию; стиль и goal — мягкие тай-брейки поверх (не удаляют кандидатов).
export function pickAnchor(input: {
  available: Technique[]; favorites: FavoritesMap; progress: ProgressMap; entries: DiaryEntry[];
  styleSet: Set<Style>; goal?: Goal; gi?: boolean; noGi?: boolean; avoidId?: number;
  source: "profile" | "diary"; today?: Date;
}): Technique | null {
  const { available, favorites, progress, entries, styleSet, goal, gi, noGi, avoidId, source } = input;
  const recent = source === "diary" ? recentDiaryIds(entries, RECENT_DAYS, input.today) : new Set<number>();
  const pool = available.filter(
    (t) => t.id !== avoidId && (favorites[t.id] || progress[t.id] === "in_progress" || recent.has(t.id)),
  );
  if (!pool.length) return null;
  const tier = (t: Technique): number => {
    // diary: свежее из дневника приоритетно; избранное свежее — самый верх
    if (recent.has(t.id)) return favorites[t.id] ? 4 : 3;
    if (favorites[t.id]) return 2;
    if (progress[t.id] === "in_progress") return 1;
    return 0;
  };
  const styleW = (t: Technique) => (t.styles.some((s) => styleSet.has(s)) ? 1 : 0);
  const opts = { goal, gi, noGi };
  const sorted = [...pool].sort(
    (a, b) =>
      tier(b) - tier(a) ||
      styleW(b) - styleW(a) ||
      goalScore(b, opts) - goalScore(a, opts) ||
      a.difficulty - b.difficulty ||
      a.id - b.id,
  );
  return sorted[0];
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: PASS (5 новых кейсов pickAnchor + recentDiaryIds).

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workoutCluster.ts src/lib/bjj/workoutCluster.test.ts
git commit -m "feat(отработка): pickAnchor — иерархия сигналов, инвариант доверия, ротация

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: buildCluster — упорядоченный кластер из графа (cycle-safe)

**Files:**
- Modify: `src/lib/bjj/workoutCluster.ts`
- Test: `src/lib/bjj/workoutCluster.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function buildCluster(input: {
    anchor: Technique; available: Technique[]; styleSet: Set<Style>;
    goal?: Goal; gi?: boolean; noGi?: boolean; count: number;
  }): Technique[] // порядок: [вход?, якорь, ...продолжения(<=2), ...родня], длина <= count
  ```

- [ ] **Step 1: Тесты (падающие)**

Добавить в `workoutCluster.test.ts`:
```ts
import { buildCluster } from "./workoutCluster";

describe("buildCluster", () => {
  it("порядок вход -> якорь -> продолжение; всё из available", () => {
    const entry = T({ id: 1, group: "position" });
    const anchor = T({ id: 2, setup_from: [1], chain_to: [3], group: "submission" });
    const follow = T({ id: 3, group: "submission" });
    const cl = buildCluster({ anchor, available: [entry, anchor, follow], styleSet: new Set(), count: 5 });
    expect(cl.map((t) => t.id)).toEqual([1, 2, 3]);
  });
  it("тонкий якорь (нет chain_to/родни) не даёт «поток из 1» — добор из available", () => {
    const anchor = T({ id: 2, setup_from: [], chain_to: [], group: "submission" });
    const other = T({ id: 9, group: "sweep" });
    const cl = buildCluster({ anchor, available: [anchor, other], styleSet: new Set(), count: 3 });
    expect(cl.length).toBe(2);
    expect(cl[0].id).toBe(2);
  });
  it("родня: та же группа + общий вход с якорем", () => {
    const anchor = T({ id: 2, setup_from: [1], chain_to: [], group: "sweep" });
    const kin = T({ id: 5, setup_from: [1], group: "sweep" });        // общий вход 1, та же группа
    const notKin = T({ id: 6, setup_from: [7], group: "sweep" });     // другой вход
    const cl = buildCluster({ anchor, available: [anchor, kin, notKin], styleSet: new Set(), count: 2 });
    expect(cl.map((t) => t.id)).toEqual([2, 5]);
  });
  it("цикл в графе не зависает и уважает count", () => {
    const a = T({ id: 2, chain_to: [3], setup_from: [] });
    const b = T({ id: 3, chain_to: [2], setup_from: [] }); // цикл 2<->3
    const cl = buildCluster({ anchor: a, available: [a, b], styleSet: new Set(), count: 5 });
    expect(cl.map((t) => t.id)).toEqual([2, 3]);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: FAIL (`buildCluster` не определён).

- [ ] **Step 3: Реализация buildCluster + posRank**

Добавить в `workoutCluster.ts`:
```ts
const CLUSTER_CAP = 8;

// Позиции/проходы/переходы — лучший «вход» (встать в позицию)
function posRank(t: Technique): number {
  return t.group === "position" ? 0 : t.group === "guard_pass" ? 1 : t.group === "transition" ? 2 : 3;
}

// Кластер вокруг якоря: вход -> якорь -> 1-2 продолжения -> родня той же позиции.
// Всё из available (пост-фильтр пояс/безопасность), visited-guard + кап (граф цикличен).
export function buildCluster(input: {
  anchor: Technique; available: Technique[]; styleSet: Set<Style>;
  goal?: Goal; gi?: boolean; noGi?: boolean; count: number;
}): Technique[] {
  const { anchor, available, styleSet, goal, gi, noGi, count } = input;
  const byId = new Map(available.map((t) => [t.id, t]));
  const opts = { goal, gi, noGi };
  const rank = (a: Technique, b: Technique) =>
    (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
    goalScore(b, opts) - goalScore(a, opts) ||
    a.difficulty - b.difficulty ||
    a.id - b.id;

  const cap = Math.min(count, CLUSTER_CAP);
  const chosen: Technique[] = [];
  const visited = new Set<number>();
  const push = (t?: Technique): void => {
    if (t && !visited.has(t.id) && chosen.length < cap) { visited.add(t.id); chosen.push(t); }
  };

  // вход: 1 из setup_from, доступный, предпочтительно позиция
  const entry = anchor.setup_from
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t)
    .sort((a, b) => posRank(a) - posRank(b) || rank(a, b))[0];
  push(entry);
  push(anchor);

  // продолжения: до 2 из chain_to
  const followups = anchor.chain_to
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t && !visited.has(t.id))
    .sort(rank);
  push(followups[0]);
  push(followups[1]);

  // родня: та же группа + общий вход (setup_from) с якорем
  const anchorEntries = new Set(anchor.setup_from);
  const kin = available
    .filter((t) => !visited.has(t.id) && t.group === anchor.group && t.setup_from.some((id) => anchorEntries.has(id)))
    .sort(rank);
  for (const t of kin) { if (chosen.length >= cap) break; push(t); }

  // добор до count по available (никогда «поток из 1»)
  if (chosen.length < cap) {
    const rest = available.filter((t) => !visited.has(t.id)).sort(rank);
    for (const t of rest) { if (chosen.length >= cap) break; push(t); }
  }
  return chosen;
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workoutCluster.ts src/lib/bjj/workoutCluster.test.ts
git commit -m "feat(отработка): buildCluster — вход/якорь/продолжения/родня, cycle-safe

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Время по новизне + причина темы + тип Workout.theme

**Files:**
- Modify: `src/lib/bjj/workoutCluster.ts` (`clusterMinutes`, `themeReason`)
- Modify: `src/lib/bjj/types.ts` (`Workout.theme`)
- Test: `src/lib/bjj/workoutCluster.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function clusterMinutes(cluster: Technique[], mainMinutes: number, progress: ProgressMap, practiceCount: Record<number, number>): number[]
  export function themeReason(input: { anchor: Technique; favorites: FavoritesMap; progress: ProgressMap; entries: DiaryEntry[]; byId: Map<number, Technique>; today?: Date }): string
  ```
- `Workout.theme?: { anchorId: number; reason: string }`

- [ ] **Step 1: Тесты (падающие)**

Добавить в `workoutCluster.test.ts`:
```ts
import { clusterMinutes, themeReason } from "./workoutCluster";

describe("clusterMinutes", () => {
  it("сумма = mainMinutes, минимум 2, новому больше знакомого", () => {
    const cl = [T({ id: 1 }), T({ id: 2 })];
    const mins = clusterMinutes(cl, 20, { 2: "done" }, { 2: 5 });
    expect(mins.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.min(...mins)).toBeGreaterThanOrEqual(2);
    expect(mins[0]).toBeGreaterThan(mins[1]); // id1 not_started > id2 done+практикован
  });
});

describe("themeReason", () => {
  const byId = new Map<number, Technique>();
  it("избранное", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: { 1: true }, progress: {}, entries: [], byId })).toBe("Твой избранный приём");
  });
  it("в процессе", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: {}, progress: { 1: "in_progress" }, entries: [], byId })).toBe("Ты это учишь");
  });
  it("холодный старт", () => {
    expect(themeReason({ anchor: T({ id: 1 }), favorites: {}, progress: {}, entries: [], byId })).toBe("Основа под твой пояс");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация clusterMinutes + themeReason**

Добавить в `workoutCluster.ts`:
```ts
// Вес новизны: не начатое важнее, часто отработанное — меньше
function noveltyWeight(t: Technique, progress: ProgressMap, practiceCount: Record<number, number>): number {
  const status = progress[t.id] ?? "not_started";
  let w = status === "not_started" ? 3 : status === "in_progress" ? 2 : 1;
  w -= Math.min(practiceCount[t.id] ?? 0, 4) * 0.25;
  return Math.max(0.5, w);
}

// Распределение mainMinutes по новизне: целые минуты, минимум 2, сумма = mainMinutes.
export function clusterMinutes(
  cluster: Technique[], mainMinutes: number, progress: ProgressMap, practiceCount: Record<number, number>,
): number[] {
  const n = cluster.length;
  if (n === 0) return [];
  const weights = cluster.map((t) => noveltyWeight(t, progress, practiceCount));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const mins = weights.map((w) => Math.max(2, Math.round((w / sum) * mainMinutes)));
  let diff = mainMinutes - mins.reduce((a, b) => a + b, 0);
  const order = mins.map((_, i) => i).sort((a, b) => mins[b] - mins[a]);
  let guard = 0;
  while (diff !== 0 && guard < 1000) {
    const i = order[guard % order.length];
    if (diff > 0) { mins[i]++; diff--; }
    else if (mins[i] > 2) { mins[i]--; diff++; }
    guard++;
  }
  return mins;
}

// Строка «почему эта тема» для заголовка
export function themeReason(input: {
  anchor: Technique; favorites: FavoritesMap; progress: ProgressMap; entries: DiaryEntry[];
  byId: Map<number, Technique>; today?: Date;
}): string {
  const { anchor, favorites, progress, entries, byId } = input;
  if (favorites[anchor.id]) return "Твой избранный приём";
  if (progress[anchor.id] === "in_progress") return "Ты это учишь";
  if (recentDiaryIds(entries, RECENT_DAYS, input.today).has(anchor.id)) return "Свежее с тренировки";
  for (const c of topCatchers(entries, 3)) {
    if (anchor.setup_from.includes(c.id)) {
      const name = byId.get(c.id)?.nameRu ?? "сабмишена";
      return `Закрывает твою дыру: ${name}`;
    }
  }
  return "Основа под твой пояс";
}
```

- [ ] **Step 4: Тип Workout.theme**

В `src/lib/bjj/types.ts`, в интерфейс `Workout` (после поля `message?: string;`) добавить:
```ts
  // Тема сессии: якорь кластера + причина (для заголовка на маршруте отработки)
  theme?: { anchorId: number; reason: string };
```

- [ ] **Step 5: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workoutCluster.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workoutCluster.ts src/lib/bjj/types.ts src/lib/bjj/workoutCluster.test.ts
git commit -m "feat(отработка): время по новизне + причина темы + Workout.theme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Рефактор генераторов на кластер + фикс #3

**Files:**
- Modify: `src/lib/bjj/workout.ts` (clusterWorkout, generateWorkout, generateWorkoutFromDiary, assemble)
- Modify: `src/lib/bjj/types.ts` (удалить 4 устаревших поля StyleProfile)
- Modify: `src/routes/workout.tsx` (call site: передать favorites)
- Test: `src/lib/bjj/workout.test.ts` (обновить существующие)

**Interfaces:**
- Consumes: `pickAnchor`, `buildCluster`, `clusterMinutes`, `themeReason`, `effectiveStyleSet`, `practiceCountFrom` из `./workoutCluster`.
- Produces (новые сигнатуры):
  ```ts
  generateWorkout(config: WorkoutConfig, profile: StyleProfile, progress: ProgressMap, favorites: FavoritesMap, entries: DiaryEntry[]): Workout
  generateWorkoutFromDiary(config: WorkoutConfig, profile: StyleProfile, progress: ProgressMap, entries: DiaryEntry[], favorites: FavoritesMap): Workout
  ```

- [ ] **Step 1: Обновить существующий workout.test.ts под новые сигнатуры**

В `src/lib/bjj/workout.test.ts` текущие тесты зовут `generateWorkout(config, profile(...))`. Обновить вызовы на `generateWorkout(config, profile(...), {}, {}, [])` (пустые progress/favorites/entries) и проверить, что тест «goal смещает подбор» остаётся осмысленным: при пустых сигналах якорь = холодный старт (фундамент по поясу), поэтому заменить ассерт на проверку, что результат непустой и содержит drills. Конкретно заменить блок теста «goal смещает подбор»:
```ts
  it("генерирует непустой план по профилю (холодный старт)", () => {
    const w = generateWorkout(config, profile({ goal: "health" }), {}, {}, []);
    expect(w.drills.length).toBeGreaterThan(0);
    expect(w.theme).toBeTruthy();
  });
```
(Старый ассерт про escapes health>=competition убрать: он проверял старую сортировку, которой больше нет.)

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/workout.test.ts`
Expected: FAIL (старые сигнатуры/логика).

- [ ] **Step 3: Рефактор workout.ts**

Заменить `generateWorkout` (строки ~125-152) и `generateWorkoutFromDiary` (строки ~159-221) на общий `clusterWorkout` + две обёртки. Также изменить `assemble`, чтобы принимал готовые `drills`. Полный новый блок (заменяет обе функции и их импорты вверху файла — добавить импорт кластера):

Вверху файла добавить импорт:
```ts
import { effectiveStyleSet, practiceCountFrom, pickAnchor, buildCluster, clusterMinutes, themeReason } from "./workoutCluster";
import type { FavoritesMap } from "./store";
import { TECH_BY_ID } from "./data";
```
Изменить сигнатуру `assemble` — принимать готовые drills вместо selected:
```ts
function assemble(
  belt: Belt,
  drills: WorkoutDrill[],
  times: ReturnType<typeof splitTime>,
  config: WorkoutConfig,
  extra?: { message?: string; theme?: Workout["theme"] },
): Workout {
  const { warmupMinutes, cooldownMinutes, mainMinutes } = times;
  const base = {
    belt, warmup: WARMUP_BY_BELT[belt], warmupMinutes, mainMinutes,
    cooldown: COOLDOWN_BY_BELT[belt], cooldownMinutes, totalMinutes: config.duration,
  };
  if (drills.length === 0) {
    return { ...base, drills: [], message: "Нет техник под текущие фильтры. Попробуйте снять ограничения." };
  }
  return { ...base, drills, message: extra?.message, theme: extra?.theme };
}
```
Заменить `generateWorkout` и `generateWorkoutFromDiary` на:
```ts
// Ротация якоря между генерациями сессии (свежесть темы)
let lastAnchorId: number | undefined;

// Общий сборщик: якорь -> кластер -> время по новизне -> заголовок темы
function clusterWorkout(
  config: WorkoutConfig, profile: StyleProfile, progress: ProgressMap,
  favorites: FavoritesMap, entries: DiaryEntry[], source: "profile" | "diary",
): Workout {
  const available = availableFor(config, profile);
  const times = splitTime(config);
  if (available.length === 0) return assemble(profile.belt, [], times, config);

  const practiceCount = practiceCountFrom(entries);
  const styleSet = effectiveStyleSet(profile, progress, practiceCount);
  const opts = { goal: profile.goal, gi: profile.gi, noGi: profile.noGi };

  let anchor = pickAnchor({ available, favorites, progress, entries, styleSet, avoidId: lastAnchorId, source, ...opts });
  if (!anchor) {
    // холодный старт: фундаментальная позиция по поясу; стиль решает ничьи
    const cold = [...available].sort(
      (a, b) =>
        (a.group === "position" || a.group === "fundamentals" ? 0 : 1) -
          (b.group === "position" || b.group === "fundamentals" ? 0 : 1) ||
        (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
        a.difficulty - b.difficulty || a.id - b.id,
    );
    anchor = cold[0];
  }
  if (!anchor) return assemble(profile.belt, [], times, config);
  lastAnchorId = anchor.id;

  const cluster = buildCluster({ anchor, available, styleSet, count: times.techniqueCount, ...opts });
  const minutes = clusterMinutes(cluster, times.mainMinutes, progress, practiceCount);
  const drills: WorkoutDrill[] = cluster.map((t, i) => ({ technique: t, minutes: minutes[i] ?? 2 }));
  const byId = new Map(TECHNIQUES.map((t) => [t.id, t]));
  const reason = themeReason({ anchor, favorites, progress, entries, byId });
  return assemble(profile.belt, drills, times, config, { theme: { anchorId: anchor.id, reason } });
}

export function generateWorkout(
  config: WorkoutConfig, profile: StyleProfile, progress: ProgressMap,
  favorites: FavoritesMap, entries: DiaryEntry[],
): Workout {
  return clusterWorkout(config, profile, progress, favorites, entries, "profile");
}

export function generateWorkoutFromDiary(
  config: WorkoutConfig, profile: StyleProfile, progress: ProgressMap,
  entries: DiaryEntry[], favorites: FavoritesMap,
): Workout {
  return clusterWorkout(config, profile, progress, favorites, entries, "diary");
}
```
Удалить старые импорты, ставшие ненужными в workout.ts: `isUnlocked`, `caughtCounts` (если больше не используются в файле — проверить; `goalScore` мог остаться нужен только в кластере, тогда убрать из workout.ts импортов). Проверить `npx tsc` косвенно через сборку/тесты (неиспользуемый импорт — ошибка линта, но не сборки; убрать вручную).

- [ ] **Step 4: Фикс #3 — удалить мёртвые поля StyleProfile**

В `src/lib/bjj/types.ts` удалить из `StyleProfile` (строки ~105-109):
```ts
  // Устаревшее — «качества» (заменены на preferredStyles); поля оставлены для совместимости
  flexibility?: boolean;
  pressure?: boolean;
  long_limbs?: boolean;
  speed?: boolean;
```
Проверить, что нигде не осталось чтения этих полей:
Run: `cd bjj-companion && grep -rn "profile.flexibility\|profile.pressure\|profile.long_limbs\|profile.speed\|\.flexibility\b" src | grep -v STAT_META`
Expected: пусто (в `workout.ts` ветка удалена рефактором Step 3; `stats.ts` использует строковые ключи статов, не поля профиля).

- [ ] **Step 5: Call site в workout.tsx — передать favorites**

В `src/routes/workout.tsx`:
- Добавить в импорт стора `useFavorites`: строка `import { useDiary, useProfile, useProgress } from "@/lib/bjj/store";` -> добавить `useFavorites`.
- В `WorkoutGenerator` рядом с `const { entries, hydrated: diaryHydrated } = useDiary();` добавить:
```ts
  const { favorites } = useFavorites();
```
- Заменить функцию `generate`:
```ts
  const generate = (cfg: WorkoutConfig, src: "profile" | "diary"): Workout =>
    src === "diary"
      ? generateWorkoutFromDiary(cfg, profile, progress, entries, favorites)
      : generateWorkout(cfg, profile, progress, favorites, entries);
```

- [ ] **Step 6: Тесты зелёные + сборка**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS (все файлы; счётчик = прежний + новые cluster-тесты).

- [ ] **Step 7: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/workout.ts src/lib/bjj/types.ts src/routes/workout.tsx src/lib/bjj/workout.test.ts
git commit -m "feat(отработка): генераторы на якорный кластер + удалить мёртвые качества (#3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: UI заголовок темы + телеметрия workout_theme

**Files:**
- Modify: `src/routes/workout.tsx` (заголовок темы над планом; трек события)
- Modify: `src/lib/bjj/telemetry.ts` (событие в union)
- Create: `docs/sql/2026-07-31-telemetry-workout-theme.sql`

**Interfaces:**
- Consumes: `workout.theme` (`{ anchorId, reason }`), `TECH_BY_ID`, `track`.

- [ ] **Step 1: Событие в telemetry union**

В `src/lib/bjj/telemetry.ts` в тип `TelemetryEvent` добавить строку (после `"reverse_search"`):
```ts
  | "workout_theme";
```
(запятую перенести: `"reverse_search"` -> `"reverse_search"` без завершающей, `"workout_theme";` последним).

- [ ] **Step 2: Заголовок темы в workout.tsx**

В `src/routes/workout.tsx` импортировать `TECH_BY_ID`:
```ts
import { TECH_BY_ID } from "@/lib/bjj/data";
```
В блоке `{workout && (` (секция плана), СРАЗУ после открытия `<section className="space-y-4">` и ПЕРЕД кнопкой «Запустить отработку», добавить заголовок темы:
```tsx
          {workout.theme && (
            <div className="rounded-2xl border-2 border-ring bg-primary/5 p-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Тема</p>
              <p className="mt-0.5 text-base font-semibold">
                {TECH_BY_ID[workout.theme.anchorId]?.nameRu ?? "Отработка"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{workout.theme.reason}</p>
            </div>
          )}
```

- [ ] **Step 3: Трек события при показе темы**

В `WorkoutGenerator`, рядом с другими эффектами, добавить (после эффекта кэша):
```ts
  // Телеметрия темы: раз в сутки на якорь (как workout_filter)
  useEffect(() => {
    if (workout?.theme) track("workout_theme", String(workout.theme.anchorId), { dailyDedup: true });
  }, [workout?.theme?.anchorId]);
```
(`track` уже импортирован в workout.tsx.)

- [ ] **Step 4: SQL whitelist**

Создать `docs/sql/2026-07-31-telemetry-workout-theme.sql`:
```sql
-- Расширение белого списка событий bjj_track: workout_theme (показ темы-кластера отработки).
-- Применяет пользователь. Паттерн: docs/sql/2026-07-18-telemetry.sql (там определён allowed-набор).
-- Замени список ниже на актуальный allowed-массив из последней telemetry-миграции + 'workout_theme'.
-- Пример (сверить с текущей функцией bjj_track перед применением):
--   ... AND p_event = ANY (ARRAY[
--     'app_open','onboarding_done','entry_saved', ... ,'reverse_search','workout_theme'
--   ])
```
(Точный allowed-массив берётся из текущего тела `bjj_track`; см. предыдущие telemetry-SQL. Пользователь применяет.)

- [ ] **Step 5: Тесты + сборка**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS (типы телеметрии не ломают сборку).

- [ ] **Step 6: Рантайм-проверка через DOM**

Открыть превью (`bjj-companion`, порт 8080), засеять профиль (onboardingDone, consent local) + пару техник в progress/favorites (localStorage `bjj.progress.v1`/`bjj.favorites.v1`). На `/workout`:
- виден блок «Тема» с именем якоря и строкой «почему»;
- список идёт в порядке кластера (вход -> якорь -> продолжения -> родня);
- переключение «По профилю»/«По дневнику» пересобирает; смена фильтра пересобирает;
- обе темы. Проверка через `javascript_tool`:
```js
(() => {
  const body = document.body.innerText;
  return JSON.stringify({ hasTema: body.includes('Тема'), drills: document.querySelectorAll('[href^="/technique/"]').length });
})();
```

- [ ] **Step 7: Commit**

```bash
cd bjj-companion && git add src/routes/workout.tsx src/lib/bjj/telemetry.ts docs/sql/2026-07-31-telemetry-workout-theme.sql
git commit -m "feat(отработка): заголовок темы кластера + телеметрия workout_theme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Форма C (якорный кластер) -> Task 3 (pickAnchor) + Task 4 (buildCluster) + Task 6 (сборка). Покрыто.
- Иерархия сигналов + инвариант доверия -> Task 3 (tier + тест «goal=health не выкидывает избранное»). Покрыто.
- Effective style (#1 у всех) -> Task 2. Покрыто.
- Фикс #2 безопасность -> Task 1. Покрыто.
- Фикс #3 мёртвые качества + 4 поля -> Task 6 Step 3-4. Покрыто.
- Время по новизне -> Task 5 (`clusterMinutes`). Покрыто.
- Ротация якоря -> Task 3 (`avoidId`) + Task 6 (`lastAnchorId`). Покрыто.
- UI заголовок темы + «почему» -> Task 5 (`themeReason`) + Task 7. Покрыто.
- Телеметрия темы -> Task 7. Покрыто.
- Cycle-safety -> Task 4 (тест цикла) + Global Constraints. Покрыто.
- Тонкие цепочки (не «поток из 1») -> Task 4 (тест + добор). Покрыто.

**2. Placeholder scan:** SQL в Task 7 Step 4 содержит инструкцию «сверить allowed-массив», а не готовый массив — это осознанно: точный массив зависит от текущего тела `bjj_track` в БД (нельзя выдумывать); пользователь применяет по образцу прошлых telemetry-SQL. Не код-плейсхолдер приложения. Прочих плейсхолдеров нет.

**3. Type consistency:** `pickAnchor`/`buildCluster`/`clusterMinutes`/`themeReason`/`effectiveStyleSet`/`practiceCountFrom` — имена и сигнатуры совпадают между определением (Tasks 2-5) и потреблением (Task 6). `FavoritesMap`/`ProgressMap` из `./store`; `Workout["theme"]` из Task 5 используется в assemble (Task 6) и UI (Task 7) одинаково (`{ anchorId, reason }`). `generateWorkout`/`generateWorkoutFromDiary` новые сигнатуры согласованы между workout.ts (Task 6) и call site workout.tsx (Task 6 Step 5) и тестом (Task 6 Step 1).
