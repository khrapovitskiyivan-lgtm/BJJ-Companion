# Геймификация «Моей игры» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Игровой профиль в «Моей игре»: цель влияет на рекомендации, 6 статов из тегов, порог холодного старта (5), фича «Разрыв» (аспирация vs реальный архетип), аватар с титулом.

**Architecture:** Две независимые оси: архетип из `styles` (уже есть в `styleProfile.ts`), статы из `tags` (новый `stats.ts`). Профили архетипов выводятся в рантайме из lift по данным. UI — секции в `progress.tsx`. Спек: `docs/superpowers/specs/2026-07-16-gamification-design.md`.

**Tech Stack:** TanStack Start (React 19, SSR), Tailwind 4, vitest (тестов в репо ещё нет — эти будут первыми), sharp (dev-only, нарезка аватаров).

## Global Constraints

- Без сырых эмодзи в исходниках (ломают iOS JavaScriptCore) — только `String.fromCodePoint` при необходимости.
- В коде и UI-текстах: без эмодзи и em-dash. Комментарии в коде по-русски.
- SSR-safe: не читать localStorage в useState-инициализаторах; страницы рендерятся на сервере.
- `esbuild` не типчекает: после каждой задачи `npx tsc --noEmit` (предсуществующие ошибки в `recommend.ts:80-85` и cloud-sync части `store.ts` — игнорировать) и рантайм-проверка в браузере (dev-сервер `bjj-companion`, порт 8080).
- Порог холодного старта: **5** освоенных техник (константа `ARCHETYPE_MIN_DONE`).
- Ни одна техника не скрывается ни при каких условиях.
- Каждая задача — отдельный коммит с русским сообщением.

---

### Task 1: Цель влияет на рекомендации

Поле `profile.goal` пишется онбордингом и не читается никем. Добавляем goal-бонус в сортировку кандидатов `nextToLearn` (мягкий приоритет, не фильтр) и прокидываем из вызывающих мест.

**Files:**
- Modify: `src/lib/bjj/recommend.ts` (функция `nextToLearn`, строки ~33-63)
- Test: `src/lib/bjj/recommend.test.ts` (создать — первый тест в репо)
- Modify: `src/routes/progress.tsx` (~строка 41, вызов `nextToLearn`)
- Modify: `src/components/bjj/flow/TechniqueFlow.tsx` (~строка 61, вызов `nextToLearn`)

**Interfaces:**
- Produces: `nextToLearn(techniques, progress, userBelt, count = 5, opts?: { goal?: Goal; gi?: boolean; noGi?: boolean })` — сигнатура обратно совместима (opts опционален).
- Produces: `nextForStyle(techniques: Technique[], progress: ProgressMap, userBelt: Belt, style: Style, count = 3): Technique[]` — понадобится Task 4 (Разрыв).

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/bjj/recommend.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextToLearn, nextForStyle } from "./recommend";
import type { Technique } from "./types";

// Фабрика синтетической техники: все обязательные поля, переопределяем нужное
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

describe("nextToLearn с целью", () => {
  it("self-defense поднимает escape выше submission при равных прочих", () => {
    const ts = [
      tech(1, { group: "submission" }),
      tech(2, { group: "escape" }),
    ];
    const out = nextToLearn(ts, {}, "white", 2, { goal: "self-defense" });
    expect(out[0].id).toBe(2);
  });

  it("competition поднимает очковую легальную технику", () => {
    const ts = [
      tech(1, { points_ibjjf: 0 }),
      tech(2, { points_ibjjf: 4 }),
    ];
    const out = nextToLearn(ts, {}, "white", 2, { goal: "competition", gi: true });
    expect(out[0].id).toBe(2);
  });

  it("без цели порядок прежний (пояс, сложность)", () => {
    const ts = [
      tech(1, { difficulty: 2 }),
      tech(2, { difficulty: 1 }),
    ];
    const out = nextToLearn(ts, {}, "white", 2);
    expect(out[0].id).toBe(2);
  });
});

describe("nextForStyle", () => {
  it("возвращает только не начатые разблокированные техники стиля", () => {
    const ts = [
      tech(1, { styles: ["leg_game"] }),
      tech(2, { styles: ["leg_game"] }),
      tech(3, { styles: ["closed_guard"] }),
    ];
    const out = nextForStyle(ts, { 1: "done" }, "white", "leg_game", 3);
    expect(out.map((t) => t.id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/recommend.test.ts`
Expected: FAIL — `nextForStyle` не существует; тест self-defense падает (порядок без бонуса).

- [ ] **Step 3: Реализация в recommend.ts**

В `recommend.ts` добавить импорт `Style` и `Goal` в существующую строку импорта типов, затем изменить `nextToLearn` и добавить `nextForStyle`:

```ts
import type { Belt, Goal, Style, Technique } from "./types";

// Бонус техники под цель тренировок (мягкий приоритет сортировки, не фильтр)
function goalScore(t: Technique, opts?: { goal?: Goal; gi?: boolean; noGi?: boolean }): number {
  if (!opts?.goal) return 0;
  if (opts.goal === "self-defense") {
    let s = 0;
    if (t.group === "escape" || t.group === "takedown") s += 2;
    if (t.tags.includes("fundamental")) s += 1;
    return s;
  }
  if (opts.goal === "competition") {
    let s = 0;
    const legal = opts.gi !== false ? t.legal_ibjjf_gi : t.legal_ibjjf_nogi;
    if (t.points_ibjjf > 0 && legal) s += 2;
    if (t.legal_adcc) s += 1;
    return s;
  }
  return 0; // hobby: разнообразие уже даёт round-robin по группам
}

export function nextToLearn(
  techniques: Technique[],
  progress: ProgressMap,
  userBelt: Belt,
  count = 5,
  opts?: { goal?: Goal; gi?: boolean; noGi?: boolean },
): Technique[] {
  const myIdx = beltIdx(userBelt);
  const candidates = techniques.filter(
    (t) =>
      (progress[t.id] ?? "not_started") === "not_started" &&
      beltIdx(t.belt) <= myIdx &&
      isUnlocked(t, progress),
  );
  candidates.sort(
    (a, b) =>
      goalScore(b, opts) - goalScore(a, opts) ||
      beltIdx(a.belt) - beltIdx(b.belt) ||
      a.difficulty - b.difficulty,
  );
  // round-robin по группам, чтобы не рекомендовать 5 сабмишенов подряд
  const byGroup = new Map<string, Technique[]>();
  for (const t of candidates) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }
  const out: Technique[] = [];
  const queues = [...byGroup.values()];
  let qi = 0;
  while (out.length < count && queues.some((q) => q.length)) {
    const q = queues[qi % queues.length];
    qi++;
    const t = q.shift();
    if (t) out.push(t);
  }
  return out;
}

// Ближайшие к изучению техники конкретного стиля (для фичи «Разрыв»)
export function nextForStyle(
  techniques: Technique[],
  progress: ProgressMap,
  userBelt: Belt,
  style: Style,
  count = 3,
): Technique[] {
  const myIdx = beltIdx(userBelt);
  return techniques
    .filter(
      (t) =>
        t.styles.includes(style) &&
        (progress[t.id] ?? "not_started") === "not_started" &&
        beltIdx(t.belt) <= myIdx &&
        isUnlocked(t, progress),
    )
    .sort((a, b) => beltIdx(a.belt) - beltIdx(b.belt) || a.difficulty - b.difficulty)
    .slice(0, count);
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/lib/bjj/recommend.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Прокинуть opts из вызывающих мест**

В `src/routes/progress.tsx` (вызов recommendations, ~строка 41):

```ts
const recommendations = useMemo(
  () => nextToLearn(TECHNIQUES, progress, profile.belt, 4, { goal: profile.goal, gi: profile.gi, noGi: profile.noGi }),
  [progress, profile.belt, profile.goal, profile.gi, profile.noGi],
);
```

В `src/components/bjj/flow/TechniqueFlow.tsx` (startId, ~строка 61):

```ts
const rec = nextToLearn(TECHNIQUES, progress, profile.belt, 1, { goal: profile.goal, gi: profile.gi, noGi: profile.noGi })[0] ?? currentFocus(TECHNIQUES, progress);
```

- [ ] **Step 6: Типчек + рантайм**

Run: `npx tsc --noEmit` — новых ошибок нет (предсуществующие в recommend.ts:80-85 допустимы; если Step 3 их вылечил заодно — хорошо).
Рантайм: открыть `http://localhost:8080/progress`, убедиться что «Следующая цель» рендерится. В консоли браузера: `localStorage.setItem('bjj.profile.v1', JSON.stringify({...JSON.parse(localStorage.getItem('bjj.profile.v1')), goal:'self-defense'}))`, перезагрузить — состав рекомендаций должен смениться в сторону escape/takedown.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bjj/recommend.ts src/lib/bjj/recommend.test.ts src/routes/progress.tsx src/components/bjj/flow/TechniqueFlow.tsx
git commit -m "Цель из онбординга влияет на рекомендации (goal-бонус в nextToLearn) + nextForStyle; первые vitest-тесты"
```

---

### Task 2: Модуль статов и профилей архетипов

Новый чистый модуль: 6 статов из тегов, вычисление прокачки, профили архетипов через lift (в рантайме при загрузке модуля — не трогаем core-скрипт `build-data.mjs`, эффект тот же: не разойдётся с CSV).

**Files:**
- Create: `src/lib/bjj/stats.ts`
- Test: `src/lib/bjj/stats.test.ts`

**Interfaces:**
- Produces: `type StatKey = "control" | "pressure" | "structure" | "leverage" | "flexibility" | "speed"`
- Produces: `STAT_ORDER: StatKey[]`, `STAT_META: Record<StatKey, { ru: string; tags: string[] }>`
- Produces: `ARCHETYPE_MIN_DONE = 5`
- Produces: `computeStatsFor(techniques, progress, practiceCount): StatScore[]` и обёртка `computeStats(progress, practiceCount)` на реальных TECHNIQUES; `StatScore = { stat: StatKey; pct: number; done: number; total: number }`
- Produces: `deriveArchetypeStats(techniques): Record<Style, { primary: StatKey; secondary: StatKey }>` и константа `ARCHETYPE_STATS` на реальных данных.
- Produces: `countDone(progress): number` — число освоенных техник (для порога).

- [ ] **Step 1: Написать падающие тесты**

Создать `src/lib/bjj/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeStatsFor, deriveArchetypeStats, countDone, ARCHETYPE_MIN_DONE } from "./stats";
import type { Technique } from "./types";

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

describe("computeStatsFor", () => {
  it("процент от доступного по стату: 1 done из 2 speed-техник = 50", () => {
    const ts = [tech(1, { tags: ["speed"] }), tech(2, { tags: ["speed"] })];
    const out = computeStatsFor(ts, { 1: "done" }, {});
    const speed = out.find((s) => s.stat === "speed")!;
    expect(speed.pct).toBe(50);
    expect(speed.done).toBe(1);
    expect(speed.total).toBe(2);
  });

  it("отработки в дневнике добавляют вес, но pct не выше 100", () => {
    const ts = [tech(1, { tags: ["speed"] })];
    const out = computeStatsFor(ts, { 1: "done" }, { 1: 10 });
    expect(out.find((s) => s.stat === "speed")!.pct).toBe(100);
  });

  it("пустой стат даёт pct 0, не NaN", () => {
    const out = computeStatsFor([tech(1)], {}, {});
    for (const s of out) expect(Number.isNaN(s.pct)).toBe(false);
  });
});

describe("deriveArchetypeStats", () => {
  it("primary стат архетипа = тег с максимальным lift", () => {
    const ts = [
      tech(1, { styles: ["pressure_passer"], tags: ["pressure"] }),
      tech(2, { styles: ["pressure_passer"], tags: ["pressure"] }),
      tech(3, { styles: ["closed_guard"], tags: ["flexibility"] }),
      tech(4, { styles: ["closed_guard"], tags: ["flexibility"] }),
    ];
    const prof = deriveArchetypeStats(ts);
    expect(prof.pressure_passer.primary).toBe("pressure");
    expect(prof.closed_guard.primary).toBe("flexibility");
  });
});

describe("countDone / порог", () => {
  it("считает только done", () => {
    expect(countDone({ 1: "done", 2: "in_progress", 3: "done" })).toBe(2);
  });
  it("порог равен 5", () => {
    expect(ARCHETYPE_MIN_DONE).toBe(5);
  });
});
```

- [ ] **Step 2: Убедиться, что падают**

Run: `npx vitest run src/lib/bjj/stats.test.ts`
Expected: FAIL — модуль `./stats` не существует.

- [ ] **Step 3: Реализация stats.ts**

```ts
// === 6 СТАТОВ ИЗ ТЕГОВ + ПРОФИЛИ АРХЕТИПОВ ===
// Вторая ось геймификации, независимая от архетипов: архетип считается из styles
// (что играешь), статы из tags (как механически работает). Разные источники —
// модель не схлопывается в дубль. Профили архетипов (primary/secondary стат)
// выводятся из данных через lift, а не пишутся руками: не разойдутся с CSV.
import { TECHNIQUES } from "./data";
import { STYLE_ORDER } from "./constants";
import type { ProgressMap } from "./store";
import type { Style, Technique } from "./types";

export type StatKey = "control" | "pressure" | "structure" | "leverage" | "flexibility" | "speed";

export const STAT_ORDER: StatKey[] = ["control", "pressure", "structure", "leverage", "flexibility", "speed"];

export const STAT_META: Record<StatKey, { ru: string; tags: string[] }> = {
  control: { ru: "Контроль", tags: ["angle_control", "control"] },
  pressure: { ru: "Давление", tags: ["pressure", "weight_distribution"] },
  structure: { ru: "Структура", tags: ["frames", "base_break"] },
  leverage: { ru: "Рычаг", tags: ["limb_isolation", "joint_lock", "leverage"] },
  flexibility: { ru: "Гибкость", tags: ["flexibility"] },
  speed: { ru: "Скорость", tags: ["speed"] },
};

// До этого числа освоенных техник архетип и «Разрыв» не показываем (холодный старт)
export const ARCHETYPE_MIN_DONE = 5;

export interface StatScore {
  stat: StatKey;
  pct: number;  // 0..100, доля прокачки от доступного по стату
  done: number; // освоено техник этого стата
  total: number; // всего техник этого стата в базе
}

function hasStat(t: Technique, stat: StatKey): boolean {
  return t.tags.some((g) => STAT_META[stat].tags.includes(g));
}

export function countDone(progress: ProgressMap): number {
  return Object.values(progress).filter((s) => s === "done").length;
}

// Прокачка статов: вес техники как в computeStyleAffinity (done=2, in_progress=1,
// отработка в дневнике +1.5). Проценты от максимума по стату (2*total), не сырьё —
// иначе редкие статы (speed: 34 техники) никогда не догонят частые (control: 140).
export function computeStatsFor(
  techniques: Technique[],
  progress: ProgressMap,
  practiceCount: Record<number, number> = {},
): StatScore[] {
  return STAT_ORDER.map((stat) => {
    let raw = 0, done = 0, total = 0;
    for (const t of techniques) {
      if (!hasStat(t, stat)) continue;
      total++;
      const status = progress[t.id];
      let w = 0;
      if (status === "done") { w += 2; done++; }
      else if (status === "in_progress") w += 1;
      w += (practiceCount[t.id] ?? 0) * 1.5;
      raw += w;
    }
    const max = total * 2;
    const pct = max > 0 ? Math.min(100, Math.round((raw / max) * 100)) : 0;
    return { stat, pct, done, total };
  });
}

export function computeStats(progress: ProgressMap, practiceCount: Record<number, number> = {}): StatScore[] {
  return computeStatsFor(TECHNIQUES, progress, practiceCount);
}

// Профили архетипов через lift: доля стата внутри архетипа / доля стата по базе.
// primary — максимальный lift, secondary — следующий.
export function deriveArchetypeStats(
  techniques: Technique[],
): Record<Style, { primary: StatKey; secondary: StatKey }> {
  const base: Record<StatKey, number> = {} as Record<StatKey, number>;
  for (const s of STAT_ORDER) {
    base[s] = techniques.filter((t) => hasStat(t, s)).length / (techniques.length || 1);
  }
  const out = {} as Record<Style, { primary: StatKey; secondary: StatKey }>;
  for (const style of STYLE_ORDER) {
    const pool = techniques.filter((t) => t.styles.includes(style));
    const ranked = STAT_ORDER.map((s) => {
      const share = pool.length ? pool.filter((t) => hasStat(t, s)).length / pool.length : 0;
      return { s, lift: base[s] > 0 ? share / base[s] : 0 };
    }).sort((a, b) => b.lift - a.lift);
    out[style] = { primary: ranked[0].s, secondary: ranked[1].s };
  }
  return out;
}

// Профили на реальных данных (вычисляются один раз при загрузке модуля)
export const ARCHETYPE_STATS = deriveArchetypeStats(TECHNIQUES);
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run src/lib/bjj/stats.test.ts`
Expected: PASS (6 тестов). Также `npx vitest run` — все тесты репо зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bjj/stats.ts src/lib/bjj/stats.test.ts
git commit -m "Модуль статов: 6 характеристик из тегов, профили архетипов через lift, порог холодного старта"
```

---

### Task 3: Секция «Характеристики» и порог архетипа в «Моей игре»

UI: 6 полосок статов под hero-статистикой; блок «Твой стиль» до 5 освоенных показывает «стиль определяется» вместо преждевременного ярлыка.

**Files:**
- Modify: `src/routes/progress.tsx` (импорты; вставка секции после `<YourStyle .../>`; правка компонента `YourStyle`)

**Interfaces:**
- Consumes: `computeStats`, `countDone`, `ARCHETYPE_MIN_DONE`, `STAT_META`, `ARCHETYPE_STATS` из `@/lib/bjj/stats` (Task 2); `styleScores` уже есть в компоненте.

- [ ] **Step 1: Импорты и данные**

В `progress.tsx` добавить к импортам:

```ts
import { computeStats, countDone, ARCHETYPE_MIN_DONE, STAT_META, ARCHETYPE_STATS } from "@/lib/bjj/stats";
```

В `ProgressPage` после вычисления `styleScores` добавить:

```ts
// 6 статов (вторая ось: механика из тегов) и число освоенных для порога
const statScores = useMemo(
  () => computeStats(progress, practiceCount()),
  [progress, practiceCount],
);
const doneCount = useMemo(() => countDone(progress), [progress]);
```

- [ ] **Step 2: Секция статов**

Вставить сразу после `<YourStyle ... />` (передав туда новые пропсы — см. Step 3):

```tsx
{/* Характеристики: 6 статов из механических тегов */}
<section className="rounded-2xl border border-border bg-card p-4">
  <h2 className="mb-3 text-sm font-semibold">Характеристики</h2>
  <div className="space-y-2">
    {statScores.map((s) => (
      <div key={s.stat} className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-[11px]">{STAT_META[s.stat].ru}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${s.pct}%` }}
          />
        </div>
        <span className="w-10 text-right text-[11px] text-muted-foreground">{s.pct}%</span>
      </div>
    ))}
  </div>
  <p className="mt-3 text-[11px] text-muted-foreground">
    Растут от изученных техник и отработок в дневнике.
  </p>
</section>
```

- [ ] **Step 3: Порог в YourStyle**

Изменить вызов: `<YourStyle scores={styleScores} doneCount={doneCount} />`.
В компоненте `YourStyle` изменить сигнатуру и добавить ветку порога перед существующей проверкой пустоты:

Сигнатура: `function YourStyle({ scores, doneCount }: { scores: StyleScore[]; doneCount: number })`.

Первой веткой (до существующей проверки `scores.length === 0`, которая остаётся без изменений) вставить:

```tsx
if (doneCount < ARCHETYPE_MIN_DONE) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Твой стиль</h2>
      <p className="text-xs text-muted-foreground">
        Стиль определяется. Отметь ещё {ARCHETYPE_MIN_DONE - doneCount} техник как изученные,
        и приложение вычислит твой игровой архетип.
      </p>
    </section>
  );
}
```

В существующей шапке топ-архетипа заменить строку описания

```tsx
<p className="truncate text-xs text-muted-foreground">
  {STYLE_META[top.style].desc} · {top.pct}% игры
</p>
```

на

```tsx
<p className="truncate text-xs text-muted-foreground">
  {STYLE_META[top.style].desc} · {top.pct}% игры · ключевой стат: {STAT_META[ARCHETYPE_STATS[top.style].primary].ru}
</p>
```

- [ ] **Step 4: Типчек + рантайм**

Run: `npx tsc --noEmit` — новых ошибок нет.
Рантайм: `http://localhost:8080/progress`.
1. Сброс прогресса (кнопка «Сбросить» с подтверждением) — «Твой стиль» показывает «Стиль определяется. Отметь ещё 5...», секция «Характеристики» с нулями.
2. В консоли: `localStorage.setItem('bjj.progress.v1', JSON.stringify({1:'done',2:'done',26:'done',27:'done',30:'done'}))`, перезагрузка — архетип показан, полоски статов ненулевые.

- [ ] **Step 5: Commit**

```bash
git add src/routes/progress.tsx
git commit -m "Моя игра: секция «Характеристики» (6 статов) и порог холодного старта архетипа (5 техник)"
```

---

### Task 4: Фича «Разрыв»

Карточка сравнения аспирации (`profile.preferredStyles` из настроек) с реальным архетипом (топ `styleScores`). Показывается только при заданной аспирации и пройденном пороге.

**Files:**
- Create: `src/components/bjj/GapCard.tsx`
- Modify: `src/routes/progress.tsx` (импорт + вставка после секции «Характеристики»)

**Interfaces:**
- Consumes: `nextForStyle` (Task 1), `ARCHETYPE_MIN_DONE` (Task 2), `StyleScore` из `styleProfile.ts`, `STYLE_META`, `GROUP_LABEL`, `BELT_LABEL` из constants.
- Produces: `<GapCard scores={StyleScore[]} preferredStyles={Style[] | undefined} progress={ProgressMap} belt={Belt} doneCount={number} />`

- [ ] **Step 1: Компонент GapCard**

```tsx
import { Link } from "@tanstack/react-router";
import { TECHNIQUES } from "@/lib/bjj/data";
import { nextForStyle } from "@/lib/bjj/recommend";
import { ARCHETYPE_MIN_DONE } from "@/lib/bjj/stats";
import { BELT_LABEL, GROUP_LABEL, STYLE_META } from "@/lib/bjj/constants";
import type { StyleScore } from "@/lib/bjj/styleProfile";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, Style } from "@/lib/bjj/types";
import { Compass, ArrowRight } from "lucide-react";

// «Разрыв»: аспирация (кем хочешь быть, из настроек) против реального архетипа
// (что тренируешь по прогрессу и дневнику). Ядро геймификации: это может только
// дневник. Показывается при заданной аспирации и пройденном пороге холодного старта.
export function GapCard({
  scores, preferredStyles, progress, belt, doneCount,
}: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  progress: ProgressMap;
  belt: Belt;
  doneCount: number;
}) {
  if (!preferredStyles?.length || doneCount < ARCHETYPE_MIN_DONE || scores.length === 0) return null;

  const top = scores[0];
  const onTrack = preferredStyles.includes(top.style);
  const aspiration = onTrack ? top.style : preferredStyles[0];
  const aspirationPct = scores.find((s) => s.style === aspiration)?.pct ?? 0;
  const next = onTrack ? [] : nextForStyle(TECHNIQUES, progress, belt, aspiration, 3);

  return (
    <section className="rounded-2xl border border-ring/50 bg-primary/5 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Compass className="h-4 w-4 text-primary" />
        Хочу и тренирую
      </h2>
      {onTrack ? (
        <p className="text-xs text-muted-foreground">
          Идёшь по плану: твой стиль «{STYLE_META[top.style].ru}» совпадает с целью
          и занимает {top.pct}% игры.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Хочешь играть «{STYLE_META[aspiration].ru}», но в твоей игре это {aspirationPct}%.
            Реально тренируешь «{STYLE_META[top.style].ru}» ({top.pct}%).
          </p>
          {next.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Сдвинут в нужную сторону
              </p>
              <ul className="space-y-1.5">
                {next.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/technique/$id"
                      params={{ id: String(t.id) }}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition hover:bg-muted"
                      style={{ borderLeft: `3px solid var(--belt-${t.belt})` }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.nameRu}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {GROUP_LABEL[t.group]} · {BELT_LABEL[t.belt]} · сложность {t.difficulty}/5
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/workout"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            Собрать тренировку по дневнику
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Вставка в progress.tsx**

Импорт `import { GapCard } from "@/components/bjj/GapCard";`; после секции «Характеристики»:

```tsx
<GapCard
  scores={styleScores}
  preferredStyles={profile.preferredStyles}
  progress={progress}
  belt={profile.belt}
  doneCount={doneCount}
/>
```

- [ ] **Step 3: Типчек + рантайм**

Run: `npx tsc --noEmit` — новых ошибок нет.
Рантайм на `http://localhost:8080/progress`:
1. Без аспирации карточки нет.
2. В меню профиля (аватар в шапке) выбрать стиль «Игра ног»; прогресс с 5+ done в другом стиле — карточка показывает разрыв и 3 техники leg_game.
3. Выбрать стиль, совпадающий с топом, — «Идёшь по плану».

- [ ] **Step 4: Commit**

```bash
git add src/components/bjj/GapCard.tsx src/routes/progress.tsx
git commit -m "Фича «Разрыв»: аспирация из настроек против реального архетипа, ближайшие техники цели"
```

---

### Task 5: Составной аватар (тело + голова), выбор головы, титул

Пересмотр 2026-07-16 (v2): вместо 30 цельных фигурок — «бумажная кукла». Тело (кимоно + пояс) и голова — отдельные слои: 15 тел + 12 голов = 180 комбинаций. Исходники: `design/bodies-sheet.png` (5 колонок-поясов x 3 ряда-кимоно, тела безголовые), `design/heads-male-sheet.png` и `design/heads-female-sheet.png` (по 6 голов, сетка 3x2; у мужского листа чёрные линии сетки). Головам при нарезке убирается фон (flood-fill от краёв), иначе белый прямоугольник головы закроет грудь тела при наложении.

Нарезку, подбор констант выравнивания и превью-композит выполняет КОНТРОЛЛЕР (нужна визуальная итерация); имплементер получает готовые ассеты и точные константы и делает интеграцию в приложение.

**Files:**
- Create: `scripts/slice-avatars.mjs` (контроллер)
- Create: `public/avatars/body-{kimono}-{belt}.webp` — 15 шт (контроллер)
- Create: `public/avatars/head-{m1..m6|f1..f6}.webp` — 12 шт, прозрачный фон (контроллер)
- Create: `src/lib/bjj/avatar.ts` (имплементер)
- Create: `src/components/bjj/Avatar.tsx` (имплементер)
- Modify: `src/lib/bjj/types.ts` (StyleProfile: kimono, headId)
- Modify: `src/components/bjj/Onboarding.tsx` (шаг выбора головы)
- Modify: `src/components/bjj/AvatarMenu.tsx` (секция «Персонаж»: голова + кимоно)
- Modify: `src/routes/progress.tsx` (4-я hero-карточка с Avatar и титулом)
- Modify: `docs/superpowers/specs/2026-07-16-gamification-design.md` (аватар: схема тело+голова)

**Interfaces:**
- Produces: `StyleProfile.kimono?: "white" | "blue" | "black"`, `StyleProfile.headId?: HeadId`.
- Produces (`src/lib/bjj/avatar.ts`): `HEAD_IDS: readonly ["m1",...,"f6"]`, `type HeadId`, `bodySrc(p: StyleProfile): string` (`/avatars/body-{kimono}-{belt}.webp`, дефолт кимоно white), `headSrc(p: StyleProfile): string` (`/avatars/head-{headId}.webp`, дефолт m1).
- Produces (`src/components/bjj/Avatar.tsx`): `<Avatar profile={StyleProfile} className?>` — контейнер с составным персонажем; константы выравнивания даёт контроллер в диспатче.

- [ ] **Step 1 (КОНТРОЛЛЕР): sharp, нарезка, прозрачность голов, превью-композит**

Run: `npm i -D sharp`. Скрипт `scripts/slice-avatars.mjs`: тела — фиксированные ячейки 5x3 из `bodies-sheet.png` в `body-{kimono}-{belt}.webp` (ряды: white, blue, black кимоно; колонки: white, blue, purple, brown, black пояса; фон остаётся — это нижний слой). Головы — ячейки 3x2 из двух листов с внутренним отступом (у мужского листа чёрные линии сетки), затем flood-fill от краёв: почти-белые пиксели, связанные с краем, получают альфу 0 (глазные белки не связаны с краем — не страдают); вывод `head-{m|f}{1..6}.webp`. Дополнительно скрипт собирает превью-композит (тело + голова с параметрами HEAD_W_FRAC / HEAD_BOTTOM_PX) в `.superpowers/sdd/avatar-preview.png`; контроллер смотрит его через Read и итерирует константы до посадки головы на воротник. Итоговые константы фиксируются в диспатче имплементера.

Expected: `ls public/avatars | wc -l` = 27; превью-композит визуально корректен.

- [ ] **Step 2 (имплементер): поля профиля, avatar.ts, компонент Avatar**

`src/lib/bjj/types.ts`, в `StyleProfile` после `avatarUrl?: string;`:

```ts
  // Игровой персонаж (составной аватар из public/avatars; avatarUrl выше — фото из Telegram)
  kimono?: "white" | "blue" | "black";
  headId?: import("./avatar").HeadId;
```

(Если циклический импорт мешает — объявить `HeadId` прямо в types.ts и реэкспортировать из avatar.ts.)

`src/lib/bjj/avatar.ts`:

```ts
// Составной аватар: тело (кимоно + пояс) и голова — отдельные слои.
// Пояс в пути тела берётся из профиля на лету: повышение пояса
// автоматически переодевает персонажа.
import type { StyleProfile } from "./types";

export const HEAD_IDS = ["m1", "m2", "m3", "m4", "m5", "m6", "f1", "f2", "f3", "f4", "f5", "f6"] as const;
export type HeadId = (typeof HEAD_IDS)[number];

export function bodySrc(p: StyleProfile): string {
  return `/avatars/body-${p.kimono ?? "white"}-${p.belt}.webp`;
}

export function headSrc(p: StyleProfile): string {
  return `/avatars/head-${p.headId ?? "m1"}.webp`;
}
```

`src/components/bjj/Avatar.tsx` — константы выравнивания приходят из диспатча контроллера:

```tsx
// Составной персонаж: тело снизу, голова слоем сверху по центру.
// Константы подобраны по превью-композиту (scripts/slice-avatars.mjs).
import { bodySrc, headSrc } from "@/lib/bjj/avatar";
import type { StyleProfile } from "@/lib/bjj/types";

export function Avatar({ profile, className }: { profile: StyleProfile; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`} style={{ aspectRatio: "AR_PLACEHOLDER" }}>
      <img src={bodySrc(profile)} alt="" className="absolute bottom-0 left-0 w-full" />
      <img
        src={headSrc(profile)}
        alt="Персонаж"
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: "HEAD_TOP_PLACEHOLDER", width: "HEAD_W_PLACEHOLDER" }}
      />
    </div>
  );
}
```

- [ ] **Step 3 (имплементер): шаг выбора головы в онбординге**

`Onboarding.tsx`: расширить `Step` до `0..7`, `totalSteps = 8`. Новый шаг 1 (после welcome, до пояса): состояние `const [headId, setHeadId] = useState<HeadId | null>(null);`, в `canProceed` добавить `if (step === 1) return headId !== null;`. Существующие проверки шагов сдвинуть на +1 (пояс 2, формат 3, цель 4, частота 5, знакомые техники 6, финал 7); граничные проверки `step < 6` -> `step < 7`, `step === 5` (кнопка «Пропустить») -> `step === 6`, `step === 6` («Начать») -> `step === 7`. В `onDone` добавить `headId: headId ?? undefined` в патч профиля.

Разметка шага: сетка 4 колонки, 12 кнопок-голов:

```tsx
{step === 1 && (
  <section aria-label="Персонаж" className="space-y-4">
    <div>
      <h2 className="text-2xl font-bold">Ваш персонаж</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Выберите голову. Кимоно и пояс персонаж возьмёт из профиля и будет расти вместе с вами.
      </p>
    </div>
    <div className="grid grid-cols-4 gap-2">
      {HEAD_IDS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => setHeadId(h)}
          className="rounded-xl border-2 p-1.5 transition-all"
          style={{
            borderColor: headId === h ? "var(--color-primary)" : "var(--color-border)",
            background: headId === h
              ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
              : "var(--color-card)",
          }}
          aria-label={`Голова ${h}`}
        >
          <img src={`/avatars/head-${h}.webp`} alt="" className="mx-auto h-14 object-contain" />
        </button>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 4 (имплементер): секция «Персонаж» в AvatarMenu**

После секции «Формат тренировок» добавить (использует существующий `Toggle`):

```tsx
{/* Персонаж: голова и цвет кимоно (составной аватар в «Моей игре») */}
<section>
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Персонаж</h3>
  <div className="mb-2 grid grid-cols-6 gap-1.5">
    {HEAD_IDS.map((h) => (
      <button
        key={h}
        type="button"
        onClick={() => update({ headId: h })}
        className="rounded-lg border-2 p-1 transition-all"
        style={{
          borderColor: (profile.headId ?? "m1") === h ? "var(--color-primary)" : "var(--color-border)",
          background: (profile.headId ?? "m1") === h
            ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
            : "var(--color-card)",
        }}
        aria-label={`Голова ${h}`}
      >
        <img src={`/avatars/head-${h}.webp`} alt="" className="mx-auto h-9 object-contain" />
      </button>
    ))}
  </div>
  <div className="grid grid-cols-3 gap-2">
    <Toggle label="Белое ги" active={(profile.kimono ?? "white") === "white"} onClick={() => update({ kimono: "white" })} />
    <Toggle label="Синее ги" active={profile.kimono === "blue"} onClick={() => update({ kimono: "blue" })} />
    <Toggle label="Чёрное ги" active={profile.kimono === "black"} onClick={() => update({ kimono: "black" })} />
  </div>
</section>
```

Импорт в AvatarMenu: `import { HEAD_IDS } from "@/lib/bjj/avatar";`

- [ ] **Step 5 (имплементер): карточка аватара с титулом в hero-ряду «Моей игры»**

`progress.tsx`: импорт `Avatar` (STYLE_META уже импортирован). В hero-секции добавить четвёртую карточку после «Прогресс»:

```tsx
<div className="rounded-2xl border border-border bg-card p-3 text-center">
  <Avatar profile={profile} className="mx-auto h-20" />
  <p className="mt-1.5 truncate text-[11px] font-medium">
    {doneCount >= ARCHETYPE_MIN_DONE && styleScores.length > 0
      ? STYLE_META[styleScores[0].style].ru
      : `${BELT_LABEL[profile.belt]} пояс`}
  </p>
</div>
```

Сетка секции уже `grid-cols-2 sm:grid-cols-4` — карточка встаёт четвёртой.

- [ ] **Step 6 (имплементер): фикс спека (схема аватара)**

В `docs/superpowers/specs/2026-07-16-gamification-design.md` в разделе «7. Аватар персонажа» заменить пункты про пол и нарезку листа 5x6 на: «Схема v2 (2026-07-16): составной аватар — 15 тел (body-{kimono}-{belt}) + 12 голов (head-{m1..f6}, прозрачный фон) = 180 комбинаций. В профиле {kimono, headId}; пояс тела берётся из profile.belt на лету. Онбординг: шаг выбора головы вместо пола.»

- [ ] **Step 7 (КОНТРОЛЛЕР): типчек + рантайм**

Run: `npx tsc --noEmit` — новых ошибок нет. `npx vitest run` — зелёные.
Рантайм:
1. `localStorage.clear()`, онбординг: шаг 2 из 8 — сетка из 12 голов, «Далее» заблокирован до выбора; выбрать женскую голову.
2. `/progress`: 4-я карточка — составной персонаж (выбранная голова, белое ги, белый пояс), подпись «Белый пояс».
3. В меню профиля сменить пояс на синий и кимоно на чёрное — тело сменилось на body-black-blue, голова та же.
4. Засеять 5 done — подпись карточки сменилась на титул архетипа.

- [ ] **Step 8 (имплементер): Commit**

```bash
git add scripts/slice-avatars.mjs public/avatars src/lib/bjj/avatar.ts src/components/bjj/Avatar.tsx src/lib/bjj/types.ts src/components/bjj/Onboarding.tsx src/components/bjj/AvatarMenu.tsx src/routes/progress.tsx docs/superpowers/specs/2026-07-16-gamification-design.md package.json package-lock.json
git commit -m "Составной аватар: 15 тел + 12 голов (180 комбинаций), выбор головы в онбординге, титул архетипа"
```

---

### Task 6: Сквозная проверка и сборка

**Files:** нет новых — только проверка.

- [ ] **Step 1: Полный прогон**

Run: `npx tsc --noEmit` (только предсуществующие ошибки), `npx vitest run` (все зелёные), `npx vite build` (успех).

- [ ] **Step 2: Сквозной рантайм-сценарий**

`localStorage.clear()` → онбординг целиком (пол, пояс, формат, цель «соревнования», частота, 2 знакомые техники) → `/progress`: аватар с поясом, «стиль определяется, отметь ещё 3», рекомендации со смещением в очковые техники → досеять до 5 done → архетип и титул появились, «Характеристики» ненулевые → задать аспirацию в настройках → карточка «Хочу и тренирую» показывает разрыв → кнопка ведёт на `/workout`.
Проверить консоль браузера: без новых ошибок (шум `data-tsd-source` и Telegram-мока допустим).

- [ ] **Step 3: Push**

```bash
git push
```

Деплой на Vercel — вручную по команде пользователя (`npx vercel --prod --yes --scope ivankhr`), в план не входит.
