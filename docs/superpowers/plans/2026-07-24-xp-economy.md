# XP-экономика и уровни — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить XP/уровни поверх существующей петли (дневник→стат→рекомендации), отражая их на 4 существующих поверхностях и в блоке партнёров, без нового экрана.

**Architecture:** XP **выводится, не хранится** — новый чистый модуль `src/lib/bjj/xp.ts` считает тотал из уже синхронизируемых данных (дневник, прогресс, пояс) + локального `reviewed`. Уровень — из порогов. Ретроактивность бесплатна, конфликтов синхронизации нет, откат = удаление модуля. Паттерн «дельта до/после» для экрана награды повторяет `reward.ts`.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Tailwind 4, vitest. Всё в под-репозитории `bjj-companion/`.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-24-xp-economy-design.md`.
- Без эмодзи и em-dash в коде и UI-текстах. Комментарии по-русски.
- Хирургические правки, стиль окружающего кода. Не трогать «здоровое ядро».
- Тесты: `npx vitest run` из `bjj-companion/`. Сейчас зелёных 107.
- Числа-константы формулы держать в одном месте (калибруются по телеметрии).
- Деплой и SQL применяет пользователь вручную — задачи с SQL останавливаются на «SQL готов, применяет пользователь».
- Формула: запись +20; техника +10 (кап 3); поясной бонус +10 (кап 3); разбор +10 за отдельную технику. Порог уровня cost(L→L+1)=min(50×L,400). skillLevel(pct)=max(1,floor(pct/10)).
- Поясной бонус (инверсия): белый — техника ВНЕ топ-архетипа; синий+ — техника В топ-архетипе. Топ-архетип и пояс берём текущие.

---

### Task 1: `xp.ts` — уровни и скилы (чистое ядро)

**Files:**
- Create: `src/lib/bjj/xp.ts`
- Test: `src/lib/bjj/xp.test.ts`

**Interfaces:**
- Consumes: ничего (первый модуль).
- Produces:
  - `levelForXp(totalXp: number): { level: number; xpIntoLevel: number; xpForLevel: number; xpToNext: number }`
  - `skillLevel(pct: number): number`
  - Константы: `XP_ENTRY=20`, `XP_PER_TECH=10`, `TECH_CAP=3`, `XP_BELT_BONUS=10`, `BONUS_CAP=3`, `XP_PER_REVIEW=10`, `LEVEL_STEP=50`, `LEVEL_CAP=400`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { levelForXp, skillLevel } from "./xp";

describe("levelForXp: пороги min(50*L, 400)", () => {
  it("0 XP — уровень 1, до следующего 50", () => {
    expect(levelForXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForLevel: 50, xpToNext: 50 });
  });
  it("50 XP — ровно уровень 2", () => {
    expect(levelForXp(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForLevel: 100, xpToNext: 100 });
  });
  it("60 XP — уровень 2, 10 внутри", () => {
    expect(levelForXp(60)).toMatchObject({ level: 2, xpIntoLevel: 10, xpForLevel: 100, xpToNext: 90 });
  });
  it("150 XP — уровень 3 (50+100)", () => {
    expect(levelForXp(150)).toMatchObject({ level: 3 });
  });
  it("плато 400: уровень 10 при 2200 (…+400)", () => {
    // 50+100+150+200+250+300+350+400+400 = 2200
    expect(levelForXp(2200)).toMatchObject({ level: 10, xpIntoLevel: 0 });
  });
  it("отрицательный/дробный XP клампится", () => {
    expect(levelForXp(-5)).toMatchObject({ level: 1, xpIntoLevel: 0 });
    expect(levelForXp(60.9)).toMatchObject({ level: 2, xpIntoLevel: 10 });
  });
});

describe("skillLevel: max(1, floor(pct/10))", () => {
  it("0% — уровень 1 (без ур.0)", () => expect(skillLevel(0)).toBe(1));
  it("18% — уровень 1", () => expect(skillLevel(18)).toBe(1));
  it("55% — уровень 5", () => expect(skillLevel(55)).toBe(5));
  it("100% — уровень 10", () => expect(skillLevel(100)).toBe(10));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: FAIL — `xp.ts` не существует / нет экспортов.

- [ ] **Step 3: Write minimal implementation**

```typescript
// === XP-ЭКОНОМИКА (выводится, не хранится) ===
// Тотал считается из дневника/прогресса/пояса + локального reviewed. Уровень — из
// порогов cost(L->L+1)=min(50*L,400). Спек docs/superpowers/specs/2026-07-24-xp-economy-design.md.

export const XP_ENTRY = 20;        // за запись тренировки
export const XP_PER_TECH = 10;     // за технику в записи
export const TECH_CAP = 3;         // максимум техник, дающих XP, на запись
export const XP_BELT_BONUS = 10;   // поясной бонус за технику «в направлении роста»
export const BONUS_CAP = 3;        // максимум поясных бонусов на запись
export const XP_PER_REVIEW = 10;   // за отдельную разобранную технику
export const LEVEL_STEP = 50;      // шаг стоимости уровня
export const LEVEL_CAP = 400;      // плато стоимости уровня

// Уровень и позиция внутри него из суммарного XP.
export function levelForXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
} {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  // защитный кап итераций (в реальности недостижим)
  for (let i = 0; i < 100000; i++) {
    const cost = Math.min(LEVEL_STEP * level, LEVEL_CAP);
    if (remaining < cost) {
      return { level, xpIntoLevel: remaining, xpForLevel: cost, xpToNext: cost - remaining };
    }
    remaining -= cost;
    level++;
  }
  const cost = LEVEL_CAP;
  return { level, xpIntoLevel: 0, xpForLevel: cost, xpToNext: cost };
}

// Скил-уровень из процента освоения стата (переосмысление существующего pct).
export function skillLevel(pct: number): number {
  return Math.max(1, Math.min(10, Math.floor(pct / 10)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: PASS (10 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bjj/xp.ts src/lib/bjj/xp.test.ts
git commit -m "feat(xp): уровни и скилы — levelForXp + skillLevel"
```

---

### Task 2: `xp.ts` — начисление XP (entryXp, isGrowthTech, computeTotalXp)

**Files:**
- Modify: `src/lib/bjj/xp.ts`
- Modify: `src/lib/bjj/xp.test.ts`

**Interfaces:**
- Consumes: `computeStyleAffinity` из `./styleProfile`; типы `Belt`, `DiaryEntry`, `Style`, `Technique` из `./types`; `ProgressMap` из `./store`.
- Produces:
  - `isGrowthTech(t: Technique, belt: Belt, topStyle: Style | null): boolean`
  - `entryXp(techniqueIds: number[], opts: { belt: Belt; topStyle: Style | null; byId: Map<number, Technique> }): { base: number; techniques: number; beltBonus: number; bonusCount: number; total: number }`
  - `computeTotalXp(input: { entries: DiaryEntry[]; progress: ProgressMap; belt: Belt; techniques: Technique[]; reviewed: Record<number, number> }): number`

- [ ] **Step 1: Write the failing test**

Добавить в `src/lib/bjj/xp.test.ts` (сверху — импорты и фабрика техники как в `reward.test.ts`):

```typescript
import { entryXp, isGrowthTech, computeTotalXp } from "./xp";
import type { Belt, Style, Technique } from "./types";

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
const P = "pressure_passer" as Style;
const O = "open_guard" as Style;

describe("isGrowthTech: инверсия по поясу", () => {
  it("белый: техника ВНЕ топ-архетипа даёт бонус", () => {
    expect(isGrowthTech(tech(1, { styles: [O] }), "white", P)).toBe(true);
    expect(isGrowthTech(tech(2, { styles: [P] }), "white", P)).toBe(false);
  });
  it("синий+: техника В топ-архетипе даёт бонус", () => {
    expect(isGrowthTech(tech(3, { styles: [P] }), "blue", P)).toBe(true);
    expect(isGrowthTech(tech(4, { styles: [O] }), "purple", P)).toBe(false);
  });
  it("без топ-архетипа бонуса нет", () => {
    expect(isGrowthTech(tech(5, { styles: [P] }), "white", null)).toBe(false);
  });
});

describe("entryXp: база + техники (кап 3) + поясной бонус (кап 3)", () => {
  const byId = new Map([1, 2, 3, 4].map((id) => [id, tech(id, { styles: [O] })]));
  it("одна техника вне архетипа у белого: 20 + 10 + 10", () => {
    const r = entryXp([1], { belt: "white", topStyle: P, byId });
    expect(r).toMatchObject({ base: 20, techniques: 10, beltBonus: 10, bonusCount: 1, total: 40 });
  });
  it("капы: 5 техник -> техники max 30, бонус max 30", () => {
    const many = new Map(Array.from({ length: 5 }, (_, i) => [i + 1, tech(i + 1, { styles: [O] })]));
    const r = entryXp([1, 2, 3, 4, 5], { belt: "white", topStyle: P, byId: many });
    expect(r).toMatchObject({ techniques: 30, beltBonus: 30, total: 80 });
  });
});

describe("computeTotalXp: сумма записей + разбор", () => {
  const techs = [tech(1, { styles: [O] }), tech(2, { styles: [O] })];
  it("две записи по одной технике + одна разобранная", () => {
    const total = computeTotalXp({
      entries: [
        { id: "a", date: "2026-07-10", techniqueIds: [1] },
        { id: "b", date: "2026-07-11", techniqueIds: [2] },
      ],
      progress: {},
      belt: "white",
      techniques: techs,
      reviewed: { 1: 123 },
    });
    // topStyle из affinity = O (обе техники O). belt white -> бонус за технику ВНЕ O = 0.
    // каждая запись: 20 + 10 + 0 = 30; две = 60; разбор 1*10 = 10; итого 70
    expect(total).toBe(70);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: FAIL — нет `entryXp`/`isGrowthTech`/`computeTotalXp`.

- [ ] **Step 3: Write minimal implementation**

Добавить в начало `src/lib/bjj/xp.ts` импорты и функции:

```typescript
import { computeStyleAffinity } from "./styleProfile";
import type { Belt, DiaryEntry, Style, Technique } from "./types";
import type { ProgressMap } from "./store";
```

```typescript
// Техника «в направлении роста» для пояса: белый охватывает базу (вне архетипа),
// синий+ специализируется (в архетипе). Без топ-архетипа бонуса нет.
export function isGrowthTech(t: Technique, belt: Belt, topStyle: Style | null): boolean {
  if (!topStyle) return false;
  const inArchetype = t.styles.includes(topStyle);
  return belt === "white" ? !inArchetype : inArchetype;
}

// XP за одну запись дневника: база + техники (кап) + поясной бонус (кап).
export function entryXp(
  techniqueIds: number[],
  opts: { belt: Belt; topStyle: Style | null; byId: Map<number, Technique> },
): { base: number; techniques: number; beltBonus: number; bonusCount: number; total: number } {
  const base = XP_ENTRY;
  const techniques = Math.min(techniqueIds.length, TECH_CAP) * XP_PER_TECH;
  let bonusCount = 0;
  for (const id of techniqueIds) {
    const t = opts.byId.get(id);
    if (t && isGrowthTech(t, opts.belt, opts.topStyle)) bonusCount++;
  }
  bonusCount = Math.min(bonusCount, BONUS_CAP);
  const beltBonus = bonusCount * XP_BELT_BONUS;
  return { base, techniques, beltBonus, bonusCount, total: base + techniques + beltBonus };
}

function practiceFrom(entries: DiaryEntry[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const e of entries) for (const id of e.techniqueIds) m[id] = (m[id] ?? 0) + 1;
  return m;
}

function topStyleOf(progress: ProgressMap, entries: DiaryEntry[]): Style | null {
  const affinity = computeStyleAffinity(progress, practiceFrom(entries));
  return affinity[0]?.style ?? null; // отсортирован по score desc, отфильтрован score>0
}

// Суммарный XP: сумма записей (текущий пояс/архетип) + разбор показанного.
export function computeTotalXp(input: {
  entries: DiaryEntry[];
  progress: ProgressMap;
  belt: Belt;
  techniques: Technique[];
  reviewed: Record<number, number>;
}): number {
  const { entries, progress, belt, techniques, reviewed } = input;
  const byId = new Map(techniques.map((t) => [t.id, t]));
  const topStyle = topStyleOf(progress, entries);
  let total = 0;
  for (const e of entries) total += entryXp(e.techniqueIds, { belt, topStyle, byId }).total;
  total += Object.keys(reviewed).length * XP_PER_REVIEW;
  return total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bjj/xp.ts src/lib/bjj/xp.test.ts
git commit -m "feat(xp): начисление — entryXp, isGrowthTech, computeTotalXp"
```

---

### Task 3: `xp.ts` — XP-награда за запись (computeEntryXpReward)

**Files:**
- Modify: `src/lib/bjj/xp.ts`
- Modify: `src/lib/bjj/xp.test.ts`

**Interfaces:**
- Consumes: всё из Task 1-2.
- Produces:
  - `interface EntryXpReward { delta: number; base: number; techniques: number; beltBonus: number; bonusCount: number; leveledUp: boolean; level: number; xpIntoLevel: number; xpForLevel: number }`
  - `computeEntryXpReward(input: { entriesBefore: DiaryEntry[]; entry: Omit<DiaryEntry, "id">; progressBefore: ProgressMap; techniques: Technique[]; belt: Belt; reviewed: Record<number, number> }): EntryXpReward`

- [ ] **Step 1: Write the failing test**

```typescript
import { computeEntryXpReward } from "./xp";

describe("computeEntryXpReward: дельта и level-up", () => {
  const techs = [tech(1, { styles: [O] }), tech(2, { styles: [O] })];
  it("первая запись поднимает с уровня 1 на 2 (порог 50)", () => {
    const r = computeEntryXpReward({
      entriesBefore: [],
      entry: { date: "2026-07-15", techniqueIds: [1] },
      progressBefore: {},
      techniques: techs,
      belt: "white",
      reviewed: {},
    });
    // до: 0 XP (уровень 1). запись white, техника O, topStyle до записи = null (пусто) -> бонуса нет.
    // delta = 20 + 10 + 0 = 30. Итого 30 < 50 -> остаёмся на уровне 1, level-up нет.
    expect(r).toMatchObject({ delta: 30, leveledUp: false, level: 1 });
  });
  it("вторая запись пересекает 50 -> level-up на 2", () => {
    const r = computeEntryXpReward({
      entriesBefore: [{ id: "a", date: "2026-07-14", techniqueIds: [1] }],
      entry: { date: "2026-07-15", techniqueIds: [2] },
      progressBefore: {},
      techniques: techs,
      belt: "white",
      reviewed: {},
    });
    // до: 1 запись = 30 XP (уровень 1). delta = 30. Итого 60 -> уровень 2. level-up.
    expect(r).toMatchObject({ delta: 30, leveledUp: true, level: 2, xpIntoLevel: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: FAIL — нет `computeEntryXpReward`.

- [ ] **Step 3: Write minimal implementation**

Добавить в `src/lib/bjj/xp.ts`:

```typescript
export interface EntryXpReward {
  delta: number;
  base: number;
  techniques: number;
  beltBonus: number;
  bonusCount: number;
  leveledUp: boolean;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
}

// XP-награда за сохранённую запись: дельта (лог + техники + поясной бонус) и
// проверка перехода уровня. Разбор показанного сюда НЕ входит (заработается позже).
export function computeEntryXpReward(input: {
  entriesBefore: DiaryEntry[];
  entry: Omit<DiaryEntry, "id">;
  progressBefore: ProgressMap;
  techniques: Technique[];
  belt: Belt;
  reviewed: Record<number, number>;
}): EntryXpReward {
  const { entriesBefore, entry, progressBefore, techniques, belt, reviewed } = input;
  const byId = new Map(techniques.map((t) => [t.id, t]));
  const topStyle = topStyleOf(progressBefore, entriesBefore);
  const ex = entryXp(entry.techniqueIds, { belt, topStyle, byId });
  const totalBefore = computeTotalXp({ entries: entriesBefore, progress: progressBefore, belt, techniques, reviewed });
  const before = levelForXp(totalBefore);
  const after = levelForXp(totalBefore + ex.total);
  return {
    delta: ex.total,
    base: ex.base,
    techniques: ex.techniques,
    beltBonus: ex.beltBonus,
    bonusCount: ex.bonusCount,
    leveledUp: after.level > before.level,
    level: after.level,
    xpIntoLevel: after.xpIntoLevel,
    xpForLevel: after.xpForLevel,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bjj/xp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bjj/xp.ts src/lib/bjj/xp.test.ts
git commit -m "feat(xp): computeEntryXpReward — дельта и level-up для экрана награды"
```

---

### Task 4: Экран награды — блок «+N XP» + полоска уровня + level-up

**Files:**
- Modify: `src/components/bjj/EntryReward.tsx`
- Modify: `src/routes/diary.tsx` (вычисление XP-награды при сохранении и передача пропа)

**Interfaces:**
- Consumes: `EntryXpReward`, `computeEntryXpReward` из Task 3; `useReviewed` из `./store` (в diary.tsx уже есть остальные хуки).
- Produces: `EntryRewardSheet` принимает новый опциональный проп `xp?: EntryXpReward`.

- [ ] **Step 1: diary.tsx — посчитать XP-награду и передать пропом**

Прочитать `src/routes/diary.tsx` целиком. В блоке сохранения новой записи (сейчас строки ~196-209, ветка `else` при `!editingId`) добавить вычисление XP рядом с `computeEntryReward` и сохранить в стейт `reward`.

1. В импортах добавить:
```typescript
import { computeEntryXpReward, type EntryXpReward } from "@/lib/bjj/xp";
```
2. Добавить хук `useReviewed` к остальным хукам компонента (рядом с `useDiary`/`useProgress`):
```typescript
const { reviewed } = useReviewed();
```
   (импорт `useReviewed` из `@/lib/bjj/store` — добавить к существующему импорту стора).
3. Расширить тип стейта `reward` полем `xp`:
```typescript
const [reward, setReward] = useState<{ reward: EntryReward; techniqueIds: number[]; xp: EntryXpReward } | null>(null);
```
4. В `setReward({...})` добавить поле `xp`:
```typescript
xp: computeEntryXpReward({
  entriesBefore: entries,
  entry: payload,
  progressBefore: progress,
  techniques: TECHNIQUES,
  belt: profile.belt,
  reviewed,
}),
```
5. В JSX передать проп в `EntryRewardSheet`:
```typescript
<EntryRewardSheet
  reward={reward.reward}
  techniqueIds={reward.techniqueIds}
  xp={reward.xp}
  onClose={() => setReward(null)}
/>
```

- [ ] **Step 2: EntryReward.tsx — отрисовать XP-карточку**

В `src/components/bjj/EntryReward.tsx`:

1. Импорт типа и телеметрии (track уже импортирован):
```typescript
import type { EntryXpReward } from "@/lib/bjj/xp";
import { Sparkles } from "lucide-react";
```
2. Добавить `xp` в пропсы `EntryRewardSheet`:
```typescript
export function EntryRewardSheet({
  reward,
  techniqueIds,
  xp,
  onClose,
}: {
  reward: EntryReward;
  techniqueIds: number[];
  xp?: EntryXpReward;
  onClose: () => void;
}) {
```
3. Первой карточкой в `<div className="space-y-2.5">` (перед карточкой недели) вставить XP-блок. Level-up переключает заголовок и золотит. Полоска уровня — `xpIntoLevel / xpForLevel`. Поясной бонус — золотой строкой при `bonusCount > 0`:
```tsx
{xp && (
  <div className={CARD} style={cardDelay(idx++)}>
    <div className="flex items-start gap-2.5">
      <Sparkles
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color: xp.leveledUp ? "var(--brand-gold-ink)" : "var(--color-primary)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold" style={xp.leveledUp ? { color: "var(--brand-gold-ink)" } : undefined}>
            {xp.leveledUp ? `Уровень ${xp.level}!` : "Опыт"}
          </p>
          <span className="text-xs font-bold tabular-nums text-primary">+{xp.delta} XP</span>
        </div>
        {xp.beltBonus > 0 && (
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--brand-gold-ink)" }}>
            Бонус за развитие: +{xp.beltBonus}
          </p>
        )}
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${grow ? Math.round((xp.xpIntoLevel / xp.xpForLevel) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {xp.xpIntoLevel} / {xp.xpForLevel} до {xp.level + 1} уровня
        </p>
      </div>
    </div>
  </div>
)}
```
4. Телеметрия level-up: в существующий `useEffect` (или добавить новый) при `xp?.leveledUp` вызвать `track` один раз:
```typescript
useEffect(() => {
  if (xp?.leveledUp) track("level_up", String(xp.level));
}, [xp]);
```
(Событие `level_up` в whitelist добавляется Task 10; до применения SQL ответ глотается catch — не мешает.)

- [ ] **Step 3: Проверка сборкой и тестами**

Run: `npx vitest run && npx tsc --noEmit`
Expected: тесты зелёные, типы без ошибок. (Если `tsc` не сконфигурирован для прямого запуска — использовать `npm run build` или существующий скрипт проверки типов.)

- [ ] **Step 4: Проверка рантаймом**

Запустить превью (launch.json «bjj-companion» из КОРНЕВОГО `.claude/launch.json` умбрелла-репо, порт 8080). Открыть `/diary`, добавить запись с 1-2 техниками, убедиться: шторка награды показывает «+N XP», полоску уровня, при переходе порога — «Уровень N!» золотом. Скриншоты в этом приложении таймаутят — проверять через DOM (`javascript_tool`), как принято в проекте.

- [ ] **Step 5: Commit**

```bash
git add src/components/bjj/EntryReward.tsx src/routes/diary.tsx
git commit -m "feat(xp): экран награды — блок опыта, полоска уровня, level-up"
```

---

### Task 5: Верх «Моей игры» — бейдж уровня + полоска XP в шапке

**Files:**
- Modify: `src/components/bjj/ProgressTop.tsx`
- Modify: `src/routes/progress.tsx` (вычисление уровня и передача пропов)

**Interfaces:**
- Consumes: `computeTotalXp`, `levelForXp` из `./xp`; `useReviewed` из `./store`.
- Produces: `ProgressTop` принимает новый проп `level?: { level: number; xpIntoLevel: number; xpForLevel: number } | null`.

- [ ] **Step 1: progress.tsx — посчитать уровень и передать в ProgressTop**

В `src/routes/progress.tsx`:

1. Импорты:
```typescript
import { computeTotalXp, levelForXp } from "@/lib/bjj/xp";
import { useReviewed } from "@/lib/bjj/store"; // добавить к существующему импорту стора
```
2. Хук рядом с остальными (после `useFavorites`):
```typescript
const { reviewed } = useReviewed();
```
3. Мемо уровня (после `statScores`/`doneCount`):
```typescript
const level = useMemo(
  () =>
    levelForXp(
      computeTotalXp({ entries, progress, belt: profile.belt, techniques: TECHNIQUES, reviewed }),
    ),
  [entries, progress, profile.belt, reviewed],
);
```
4. В `<ProgressTop .../>` добавить проп `level={level}`.

- [ ] **Step 2: ProgressTop.tsx — отрисовать бейдж и полоску**

В `src/components/bjj/ProgressTop.tsx`:

1. Расширить `Props`:
```typescript
level?: { level: number; xpIntoLevel: number; xpForLevel: number } | null;
```
2. Добавить `level` в деструктуризацию параметров.
3. В строке профиля (кнопка-шапка) заменить блок аватара так, чтобы бейдж уровня лёг в правый-нижний угол аватара, и под именем/поясом добавить тонкую полоску XP. Аватар сейчас — три ветки (img / initials / пустой круг). Обернуть аватар в `relative`-контейнер и добавить бейдж поверх; после `<span>` с именем/поясом добавить полоску.

Обёртка аватара (заменить текущий рендер аватара на):
```tsx
<span className="relative block h-10 w-10 shrink-0">
  {profile.avatarUrl ? (
    <img
      src={profile.avatarUrl}
      alt=""
      className="block h-10 w-10 rounded-full object-cover"
      style={{ boxShadow: `0 0 0 2px var(--belt-${profile.belt})` }}
    />
  ) : profile.name ? (
    <span
      className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ring-2 ring-border"
      style={{ background: `var(--belt-${profile.belt})` }}
    >
      {initials(profile.name)}
    </span>
  ) : (
    <span
      className="block h-10 w-10 rounded-full ring-2 ring-border"
      style={{ background: `var(--belt-${profile.belt})` }}
    />
  )}
  {level && (
    <span
      className="absolute -bottom-1 -right-1 grid min-w-[18px] place-items-center rounded-md px-1 text-[11px] font-bold leading-none text-white ring-2"
      style={{ background: "var(--color-primary)", boxShadow: "0 0 0 2px var(--color-card)" }}
    >
      {level.level}
    </span>
  )}
</span>
```
Полоска XP — добавить внутрь `<span className="min-w-0 flex-1">` после строки с поясом:
```tsx
{level && (
  <span className="mt-1 flex items-center gap-1.5">
    <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-muted)" }}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.round((level.xpIntoLevel / level.xpForLevel) * 100)}%`, background: "var(--color-primary)" }}
      />
    </span>
    <span className="text-[10px] tabular-nums text-muted-foreground">
      {level.xpIntoLevel}/{level.xpForLevel}
    </span>
  </span>
)}
```
(`min-w-0 flex-1` контейнер имён — сейчас `<span className="min-w-0 flex-1">`; полоску вложить перед закрывающим тегом этого span. `<span>` внутри `<span>` с `display:flex` валиден через классы Tailwind, но для строчных потомков задать `block`/`flex` как выше.)

- [ ] **Step 3: Проверка сборкой**

Run: `npx vitest run && npx tsc --noEmit`
Expected: зелёные, типов ошибок нет.

- [ ] **Step 4: Проверка рантаймом**

Превью `/progress`: в шапке профиля виден бейдж уровня на аватаре и полоска XP под именем. Проверить обе темы через DOM. Убедиться, что до гидратации (`today===null`) страница не падает — `level` считается синхронно из стора, но `entries` до гидратации пусты -> уровень 1, это норм.

- [ ] **Step 5: Commit**

```bash
git add src/components/bjj/ProgressTop.tsx src/routes/progress.tsx
git commit -m "feat(xp): бейдж уровня и полоска XP в шапке Моей игры"
```

---

### Task 6: «Характеристики» — скил-уровни у 6 статов

**Files:**
- Modify: `src/routes/progress.tsx` (секция «Характеристики», строки ~332-354)

**Interfaces:**
- Consumes: `skillLevel` из `./xp`.
- Produces: ничего нового (только визуальная деталь).

- [ ] **Step 1: Добавить «ур. N» к строке стата**

В `src/routes/progress.tsx`:
1. Импорт `skillLevel` из `@/lib/bjj/xp` (добавить к импорту xp из Task 5).
2. В `statScores.map(...)` добавить бейдж уровня слева от процента. Заменить блок строки стата (сейчас `<span className="w-24...">{STAT_META...}</span>` + бар + `<span className="w-10...">{s.pct}%</span>`), вставив уровень между именем и баром:
```tsx
<div key={s.stat} className="flex items-center gap-2">
  <span className="w-24 shrink-0 text-[11px]">{STAT_META[s.stat].ru}</span>
  <span className="w-12 shrink-0 text-[11px] text-muted-foreground">ур. {skillLevel(s.pct)}</span>
  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${s.pct}%` }} />
  </div>
  <span className="w-10 text-right text-[11px] text-muted-foreground">{s.pct}%</span>
</div>
```

- [ ] **Step 2: Проверка сборкой**

Run: `npx vitest run && npx tsc --noEmit`
Expected: зелёные.

- [ ] **Step 3: Проверка рантаймом**

Превью `/progress`, раскрыть «Характеристики»: у каждого стата виден «ур. N» рядом со шкалой. Проверить через DOM.

- [ ] **Step 4: Commit**

```bash
git add src/routes/progress.tsx
git commit -m "feat(xp): скил-уровни у 6 статов в Характеристиках"
```

---

### Task 7: Лист игрока — витрина уровня

**Files:**
- Modify: `src/components/bjj/CharacterSheet.tsx`

**Interfaces:**
- Consumes: `computeTotalXp`, `levelForXp` из `./xp`; хуки `useDiary`/`useProgress`/`useProfile`/`useReviewed` (проверить, какие уже используются внутри CharacterSheet — читать файл целиком перед правкой).
- Produces: ничего нового.

- [ ] **Step 1: Прочитать CharacterSheet.tsx**

Прочитать `src/components/bjj/CharacterSheet.tsx` полностью — понять, какие хуки уже подключены и где секции (пояс, Gi/No-Gi, стиль). Витрину уровня добавить верхней секцией.

- [ ] **Step 2: Добавить секцию уровня**

Подключить недостающие хуки (`useDiary` для `entries`, `useProgress` для `progress`, `useProfile` для `profile.belt`, `useReviewed` для `reviewed` — те, которых ещё нет). Посчитать:
```typescript
const lvl = levelForXp(
  computeTotalXp({ entries, progress, belt: profile.belt, techniques: TECHNIQUES, reviewed }),
);
```
(`TECHNIQUES` импортировать из `@/lib/bjj/data` если ещё не импортирован.)

Вверху листа (первой секцией) вывести уровень крупно + полоску XP до следующего:
```tsx
<div className="rounded-xl border border-border bg-card p-4">
  <div className="flex items-baseline justify-between">
    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Уровень</p>
    <span className="text-2xl font-bold tabular-nums text-primary">{lvl.level}</span>
  </div>
  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((lvl.xpIntoLevel / lvl.xpForLevel) * 100)}%` }} />
  </div>
  <p className="mt-1 text-[11px] text-muted-foreground">
    {lvl.xpIntoLevel} / {lvl.xpForLevel} до {lvl.level + 1} уровня
  </p>
</div>
```
Титул архетипа (если уже есть в листе) оставить рядом — это идентичность, уровень — прогресс.

- [ ] **Step 3: Проверка сборкой**

Run: `npx vitest run && npx tsc --noEmit`
Expected: зелёные.

- [ ] **Step 4: Проверка рантаймом**

Превью: тап по шапке профиля в «Моей игре» открывает лист игрока — видна секция «Уровень» с числом и полоской. Проверить через DOM.

- [ ] **Step 5: Commit**

```bash
git add src/components/bjj/CharacterSheet.tsx
git commit -m "feat(xp): витрина уровня в листе игрока"
```

---

### Task 8: Партнёры — публикация уровня (клиент + типы + SQL)

**Files:**
- Modify: `src/lib/bjj/partnersProfile.ts`
- Modify: `src/lib/bjj/partners.ts` (типы `PublishInput`, `PartnerProfile`)
- Modify: `src/lib/bjj/partnersProfile.test.ts` (если есть; иначе создать) — тест на `level` в publish
- Modify: `src/routes/api.partners.ts` (проброс `level` в RPC publish, чтение в list)
- Create: `docs/sql/2026-07-24-partners-level.sql`

**Interfaces:**
- Consumes: `computeTotalXp`, `levelForXp` из `./xp`.
- Produces: `PublishInput.level: number`; `PartnerProfile.level: number`.

- [ ] **Step 1: Написать/дополнить тест buildPublishInput**

Проверить наличие `src/lib/bjj/partnersProfile.test.ts`. Если есть — добавить кейс, если нет — создать по образцу `reward.test.ts`. Тест: publish включает `level`, посчитанный из entries/progress/belt/reviewed.

```typescript
import { describe, it, expect } from "vitest";
import { buildPublishInput } from "./partnersProfile";

it("buildPublishInput включает уровень игрока", () => {
  const out = buildPublishInput({
    device: "dev1",
    profile: { belt: "white", gi: true, noGi: false, theme: "light", locale: "ru", onboardingDone: true },
    progress: {},
    practiceCount: {},
    entries: [{ id: "a", date: "2026-07-10", techniqueIds: [1] }],
    reviewed: {},
    today: new Date(2026, 6, 15),
  });
  expect(typeof out.level).toBe("number");
  expect(out.level).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bjj/partnersProfile.test.ts`
Expected: FAIL — `buildPublishInput` не принимает `reviewed` / не возвращает `level`.

- [ ] **Step 3: Реализация**

1. `src/lib/bjj/partners.ts` — добавить `level: number` в `PublishInput` и `level: number` в `PartnerProfile`.
2. `src/lib/bjj/partnersProfile.ts` — добавить `reviewed` в аргументы, посчитать уровень, вернуть в объекте:
```typescript
import { computeTotalXp, levelForXp } from "./xp";
import { TECHNIQUES } from "./data";
```
В сигнатуре `buildPublishInput` добавить `reviewed: Record<number, number>` в тип `args`. Перед `return`:
```typescript
const level = levelForXp(
  computeTotalXp({ entries, progress, belt: profile.belt, techniques: TECHNIQUES, reviewed }),
).level;
```
В возвращаемый объект добавить `level`.
3. Найти вызов `buildPublishInput` (в `reportPartnerProfile.ts` и/или AppShell — грепнуть `buildPublishInput`) и пробросить `reviewed` из стора туда, где строится профиль. Прочитать `src/lib/bjj/reportPartnerProfile.ts` перед правкой; добавить чтение reviewed (снапшот из localStorage `bjj.reviewed.v1` тем же способом, что модуль читает другие данные, или принять параметром — следовать существующему паттерну модуля).
4. `src/routes/api.partners.ts` — прочитать файл; в ветке `publish` пробросить `level` в RPC-параметры; в ветке `list` — вернуть `level` в объекте партнёра (имя поля согласовать с SQL: `level`).

- [ ] **Step 4: SQL-миграция**

Создать `docs/sql/2026-07-24-partners-level.sql` по образцу `docs/sql/2026-07-22-partners.sql` (прочитать его для точных имён RPC/таблиц):
- `ALTER TABLE bjj_partner_profiles ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;`
- Обновить RPC `publish` (принять параметр уровня, писать в колонку) и RPC `list` (возвращать `level`). Точные сигнатуры взять из существующего файла партнёров; сохранить `security definer` и доступ только `service_role`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bjj/partnersProfile.test.ts`
Expected: PASS. Затем полный `npx vitest run` — все зелёные.

- [ ] **Step 6: Commit + остановка на SQL**

```bash
git add src/lib/bjj/partnersProfile.ts src/lib/bjj/partners.ts src/lib/bjj/partnersProfile.test.ts src/routes/api.partners.ts src/lib/bjj/reportPartnerProfile.ts docs/sql/2026-07-24-partners-level.sql
git commit -m "feat(xp): публикация уровня игрока в профиль партнёра"
```
Сообщить пользователю: SQL `docs/sql/2026-07-24-partners-level.sql` готов, применяет он вручную (как прошлые миграции партнёров). Клиент до применения деградирует мягко (level из RPC отсутствует -> считать 1).

---

### Task 9: Партнёры — бейдж уровня в списке и карточке + скил-уровни

**Files:**
- Modify: `src/components/bjj/PartnersBlock.tsx`

**Interfaces:**
- Consumes: `PartnerProfile.level` (Task 8); `skillLevel` из `./xp`; `STAT_META`/`STAT_ORDER` из `./stats`.
- Produces: ничего нового.

- [ ] **Step 1: Прочитать PartnersBlock.tsx**

Прочитать `src/components/bjj/PartnersBlock.tsx` целиком — найти рендер строки партнёра в списке и карточку партнёра (где показываются пояс/стиль/характеристики/статус недели).

- [ ] **Step 2: Бейдж уровня в строке списка**

Рядом с именем/поясом партнёра добавить маленький бейдж уровня (как идентичность, НЕ ключ сортировки — сортировку не трогать):
```tsx
<span
  className="grid h-5 min-w-[20px] place-items-center rounded-md px-1 text-[11px] font-bold text-white"
  style={{ background: "var(--color-primary)" }}
>
  {p.level ?? 1}
</span>
```

- [ ] **Step 3: Уровень + скил-уровни в карточке партнёра**

В карточке (где рендерятся `p.stats`): показать число уровня рядом с титулом/стилем, а строки характеристик дополнить «ур. N» из `skillLevel(pct)`. `p.stats` — `Record<string, number>` (ключи — StatKey, значения — pct). Отрисовать по `STAT_ORDER`:
```tsx
import { skillLevel } from "@/lib/bjj/xp";
import { STAT_META, STAT_ORDER } from "@/lib/bjj/stats";
```
```tsx
{STAT_ORDER.map((k) => {
  const pct = p.stats?.[k] ?? 0;
  return (
    <div key={k} className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px]">{STAT_META[k].ru}</span>
      <span className="w-12 shrink-0 text-[11px] text-muted-foreground">ур. {skillLevel(pct)}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
})}
```
Полоску «XP до следующего» у чужого профиля НЕ показывать (только уровень).

Если карточка уже рендерит характеристики своим способом — не дублировать, а дополнить существующий рендер «ур. N». Следовать тому, что уже есть в файле.

- [ ] **Step 4: Проверка сборкой**

Run: `npx vitest run && npx tsc --noEmit`
Expected: зелёные.

- [ ] **Step 5: Проверка рантаймом (ограниченная)**

Партнёры живут только в Telegram; полный рантайм за реальным initData. Проверить сборку и, если есть стаб партнёров в превью, отрисовку бейджа/скилов. Живую проверку в TG — отметить как пользовательскую (как в п.24).

- [ ] **Step 6: Commit**

```bash
git add src/components/bjj/PartnersBlock.tsx
git commit -m "feat(xp): уровень и скил-уровни в блоке партнёров"
```

---

### Task 10: Телеметрия level_up + whitelist

**Files:**
- Modify: `src/lib/bjj/telemetry.ts` (union типов событий)
- Create: `docs/sql/2026-07-24-telemetry-xp.sql`

**Interfaces:**
- Consumes: `track` уже вызывается в Task 4 с событием `level_up`.
- Produces: тип события `level_up` в union.

- [ ] **Step 1: Добавить событие в union**

Прочитать `src/lib/bjj/telemetry.ts`, найти union допустимых событий (как `review_opened`/`partner_nudge`). Добавить `"level_up"`.

- [ ] **Step 2: SQL whitelist**

Создать `docs/sql/2026-07-24-telemetry-xp.sql` по образцу `docs/sql/2026-07-23-telemetry.sql` (прочитать его) — добавить `level_up` в whitelist функции `bjj_track`.

- [ ] **Step 3: Проверка сборкой**

Run: `npx vitest run && npx tsc --noEmit`
Expected: зелёные.

- [ ] **Step 4: Commit + остановка на SQL**

```bash
git add src/lib/bjj/telemetry.ts docs/sql/2026-07-24-telemetry-xp.sql
git commit -m "feat(xp): телеметрия level_up"
```
Сообщить пользователю: SQL `docs/sql/2026-07-24-telemetry-xp.sql` применяет он. До применения событие глотается catch (не мешает).

---

## Финальная интеграция

- [ ] Полный прогон `npx vitest run` — все зелёные (было 107, добавилось ~16: xp.test).
- [ ] Рантайм-проход обеих тем: `/diary` (награда с XP + level-up), `/progress` (бейдж+полоска в шапке, скил-уровни в Характеристиках), лист игрока (витрина уровня). Через DOM, скриншоты таймаутят.
- [ ] Деплой `npx vercel --prod --yes --scope ivankhr` из `bjj-companion/`, затем curl прода (урок 3). Пуш в git.
- [ ] Пользователь применяет 2 SQL (`partners-level`, `telemetry-xp`), затем redeploy если требуется (двойной деплой env — не про эти SQL, но партнёрский RPC должен быть обновлён до показа уровней партнёров).
- [ ] Живые проверки пользователю: level-up в TG, уровни партнёров после применения partners-SQL.

## Self-Review

**Spec coverage:**
- Формула XP (лог/техники/поясной бонус/разбор) — Task 2-3. ✓
- Пороги уровней — Task 1. ✓
- skillLevel — Task 1, применён Task 6/9. ✓
- Derived-архитектура (xp.ts, ничего не хранит) — Task 1-3. ✓
- Отметка «изучил» = 0 XP — по конструкции (XP только из entries/reviewed, не из progress-статуса). ✓
- 4 поверхности: шапка (Task 5), награда (Task 4), Характеристики (Task 6), лист игрока (Task 7). ✓
- Партнёры: publish уровня (Task 8), бейдж+карточка+скилы, не лидерборд, сортировку не трогаем (Task 9). ✓
- Телеметрия level_up (Task 10). ✓
- Review XP начисляется при открытии карточки, не на награде — учтено: `computeTotalXp` считает review из `reviewed`, `computeEntryXpReward` его НЕ включает в delta. ✓ (сам markReviewed уже пишет `reviewed` — Task не меняет крючок разбора, XP подхватывается тоталом автоматически.)

**Placeholder scan:** нет TBD/«обработать ошибки»/«похоже на Task N» — код приведён в каждом шаге.

**Type consistency:** `EntryXpReward`, `PublishInput.level`, `PartnerProfile.level`, `levelForXp(...)`-поля (`level/xpIntoLevel/xpForLevel/xpToNext`), `computeTotalXp` вход `{entries,progress,belt,techniques,reviewed}` — совпадают между задачами.

**Открытый риск (не блокер):** Task 8 шаг 3 требует пробросить `reviewed` в место сборки publish (`reportPartnerProfile.ts`) — файл не читался при написании плана; шаг явно инструктирует прочитать и следовать паттерну модуля. Если reviewed там недоступен, допустимо считать уровень без review-компонента (тотал чуть ниже, партнёрам это несущественно) — зафиксировать в коде комментом.
