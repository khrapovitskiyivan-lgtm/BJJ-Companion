# Стартовый набор новичка — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать белому поясу курированную дорожную карту базовых техник — под-вкладку «Старт» в разделе Техники (только для белого пояса) плюс промо-инсайт на «Моей игре».

**Architecture:** Курированный статический список (`data/starter-set.json`, бакеты по позициям) валидируется в билде и эмитится в `generated/`. Чистый модуль `starterSet.ts` считает прогресс по обычным статусам `done`. Новый роут `/starter` с клиентским гейтом пояса; вкладка добавляется первой в `TechniquesTabs` только белому; промо через новый инсайт `starter-set` в существующей ленте `TodayAction`.

**Tech Stack:** TanStack Start/Router (file-based роуты), React 19, Tailwind CSS 4, vitest. Данные: CSV/JSON → `scripts/build-data.mjs` → `src/lib/bjj/generated/`.

## Global Constraints

- Рабочая директория репозитория: `bjj-companion/` (отдельный git-репо). Все пути ниже — относительно него. Ветка: `feat/starter-set` (уже создана).
- В коде и текстах: без эмодзи и без em-dash. Комментарии в коде — по-русски.
- SSR-safe: не читать localStorage в инициализаторе `useState`; гейтить рендер флагом `hydrated`.
- Вкладка «Старт» видна ТОЛЬКО при `profile.belt === "white"` и первой в ряду под-вкладок.
- Набор курируется вручную (`data/starter-set.json`), НЕ через `nextToLearn`/`isUnlocked`.
- Нижняя навигация остаётся 4 таба; на «Мою игру» постоянный блок не добавляется.
- Вес инсайта `starter-set` = 240 (выше `return-after-pause` 220 и `cold-start` 200).
- Прогресс — существующий статус `done` в `useProgress`, без нового стейта.
- Тесты гонять из `bjj-companion/`: `npx vitest run <файл>`. Полный прогон: `npx vitest run`.
- Превью этого приложения на скриншотах таймаутит — рантайм проверять через DOM (`javascript_tool`) и `preview_logs`; фактический порт брать из `preview_logs` (lovable-vite берёт 8080→8081 сам).

---

### Task 1: Данные набора, валидатор и эмит в generated

**Files:**
- Create: `data/starter-set.json`
- Modify: `scripts/build-data.mjs` (загрузка ~строка 49, валидация после ~строки 124, эмит после ~строки 170)

**Interfaces:**
- Produces: `src/lib/bjj/generated/starter-set.json` — массив `{ title: string, ids: number[] }`, потребляется Task 2.

Временный набор ниже — реальные белые id с тегом `fundamental` (проверены по собранным данным). Он валиден и достаточен для Task 2-5; финальную выборку докрутит инструктор в Task 6.

- [ ] **Step 1: Создать `data/starter-set.json`**

```json
[
  { "title": "Стойка и тейкдаун", "ids": [150, 151] },
  { "title": "Гард снизу", "ids": [1, 70, 72] },
  { "title": "Проход гарда", "ids": [2, 93] },
  { "title": "Выходы из-под контроля", "ids": [132, 133, 134] },
  { "title": "Базовые сабмишены", "ids": [35, 30, 32] },
  { "title": "Контроль сверху", "ids": [16, 14] }
]
```

- [ ] **Step 2: Загрузить набор в `scripts/build-data.mjs`**

После блока загрузки `aliasMap` (после строки `);` на ~строке 49) добавить:

```js
// Стартовый набор новичка (курируется вручную): массив бакетов { title, ids }
const starterSet = JSON.parse(
  readFileSync(join(ROOT, 'data', 'starter-set.json'), 'utf8'),
);
```

- [ ] **Step 3: Валидация набора**

Сразу после цикла валидации техник (после закрывающей `}` цикла `for (const t of techniques)`, перед комментарием `// --- Проверка циклических зависимостей`) добавить:

```js
// --- валидация стартового набора: id существуют, нет дублей, предупреждение о не-белых ---
const starterSeen = new Set();
for (const bucket of starterSet) {
  if (!bucket.title || !Array.isArray(bucket.ids)) {
    errs.push(`starter-set: бакет без title/ids`);
    continue;
  }
  for (const ref of bucket.ids) {
    if (!validIds.has(ref)) errs.push(`starter-set «${bucket.title}»: битый id ${ref}`);
    if (starterSeen.has(ref)) errs.push(`starter-set: дубль id ${ref}`);
    starterSeen.add(ref);
    const tech = techniques.find((t) => t.id === ref);
    if (tech && tech.belt !== 'white') {
      console.warn(`⚠️  starter-set: id ${ref} (${tech.nameRu}) не белый пояс (${tech.belt})`);
    }
  }
}
```

- [ ] **Step 4: Эмит собранного набора**

После записи `techniques.json` (после строки `console.log(\`OK: ${techniques.length} техник ...\`)`, ~строка 171) добавить:

```js
writeFileSync(join(ROOT, 'src', 'lib', 'bjj', 'generated', 'starter-set.json'), JSON.stringify(starterSet), 'utf8');
console.log(`OK: стартовый набор ${starterSeen.size} техник → generated/starter-set.json`);
```

- [ ] **Step 5: Прогнать билд, убедиться что валиден и файл создан**

Run: `node scripts/build-data.mjs`
Expected: строки «✅ Все ссылки валидны», «OK: стартовый набор 15 техник → generated/starter-set.json». Файл `src/lib/bjj/generated/starter-set.json` существует.

- [ ] **Step 6: Проверить, что битый id роняет билд**

Временно вписать в любой бакет `999999`, запустить `node scripts/build-data.mjs`.
Expected: `ОШИБКИ ДАННЫХ: ✗ starter-set ...: битый id 999999`, exit 1. Затем убрать `999999` и перегнать (снова зелёный).

- [ ] **Step 7: Commit**

```bash
git add data/starter-set.json scripts/build-data.mjs src/lib/bjj/generated/starter-set.json
git commit -m "feat: данные стартового набора + валидатор в build-data"
```

---

### Task 2: Чистый модуль starterSet.ts

**Files:**
- Create: `src/lib/bjj/starterSet.ts`
- Test: `src/lib/bjj/starterSet.test.ts`

**Interfaces:**
- Consumes: `generated/starter-set.json` (Task 1), `TECH_BY_ID` из `./data`, `ProgressMap` из `./store`, `Technique` из `./types`.
- Produces:
  - `interface StarterBucket { title: string; ids: number[] }`
  - `STARTER_SET: StarterBucket[]`
  - `interface StarterBucketProgress { title: string; total: number; done: number; techniques: Technique[] }`
  - `interface StarterProgress { done: number; total: number; buckets: StarterBucketProgress[] }`
  - `starterProgress(progress: ProgressMap, set?: StarterBucket[]): StarterProgress`

- [ ] **Step 1: Написать падающий тест `src/lib/bjj/starterSet.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { starterProgress, type StarterBucket } from "./starterSet";
import type { ProgressMap } from "./store";

// Реальные белые id из базы (существуют в TECH_BY_ID)
const SET: StarterBucket[] = [
  { title: "Гард снизу", ids: [1, 70] },
  { title: "Выходы", ids: [132, 133] },
];

describe("starterProgress", () => {
  it("пустой прогресс -> done 0, total = число валидных id", () => {
    const r = starterProgress({}, SET);
    expect(r.done).toBe(0);
    expect(r.total).toBe(4);
    expect(r.buckets).toHaveLength(2);
    expect(r.buckets[0].techniques).toHaveLength(2);
  });

  it("частичный прогресс -> счётчики по бакетам и итог согласованы", () => {
    const progress: ProgressMap = { 1: "done", 70: "in_progress", 132: "done" };
    const r = starterProgress(progress, SET);
    expect(r.done).toBe(2);
    expect(r.buckets[0].done).toBe(1); // 1 done, 70 in_progress не считается
    expect(r.buckets[1].done).toBe(1); // 132 done, 133 нет
    expect(r.done).toBe(r.buckets.reduce((n, b) => n + b.done, 0));
  });

  it("несуществующий id пропускается, не роняет", () => {
    const r = starterProgress({}, [{ title: "X", ids: [1, 999999] }]);
    expect(r.total).toBe(1);
    expect(r.buckets[0].techniques).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Запустить тест, убедиться что падает**

Run: `npx vitest run src/lib/bjj/starterSet.test.ts`
Expected: FAIL (`starterProgress` не существует / нет модуля).

- [ ] **Step 3: Реализовать `src/lib/bjj/starterSet.ts`**

```ts
// Стартовый набор новичка: курированные бакеты базовых техник (data/starter-set.json).
// Прогресс считается по обычным статусам done, без отдельного стейта.
import type { Technique } from "./types";
import type { ProgressMap } from "./store";
import { TECH_BY_ID } from "./data";
import raw from "./generated/starter-set.json";

export interface StarterBucket {
  title: string;
  ids: number[];
}

export const STARTER_SET: StarterBucket[] = raw as StarterBucket[];

export interface StarterBucketProgress {
  title: string;
  total: number;
  done: number;
  techniques: Technique[];
}

export interface StarterProgress {
  done: number;
  total: number;
  buckets: StarterBucketProgress[];
}

// Резолвит id в техники (несуществующие пропускает, cycle-safe), считает изученные.
// set параметризован для тестируемости; в приложении используется STARTER_SET.
export function starterProgress(
  progress: ProgressMap,
  set: StarterBucket[] = STARTER_SET,
): StarterProgress {
  let done = 0;
  let total = 0;
  const buckets: StarterBucketProgress[] = set.map((b) => {
    const techniques = b.ids
      .map((id) => TECH_BY_ID[id])
      .filter((t): t is Technique => !!t);
    const bDone = techniques.filter((t) => progress[t.id] === "done").length;
    done += bDone;
    total += techniques.length;
    return { title: b.title, total: techniques.length, done: bDone, techniques };
  });
  return { done, total, buckets };
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run: `npx vitest run src/lib/bjj/starterSet.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bjj/starterSet.ts src/lib/bjj/starterSet.test.ts
git commit -m "feat: модуль starterSet + расчёт прогресса набора"
```

---

### Task 3: Промо-инсайт starter-set и его отображение

**Files:**
- Modify: `src/lib/bjj/insights.ts` (тип `InsightKind` ~строка 44; блок в `computeInsights` после cold-start ~строка 91)
- Modify: `src/lib/bjj/insights.test.ts` (добавить кейсы в `describe("computeInsights / primaryAction")`)
- Modify: `src/components/bjj/TodayAction.tsx` (`CTA` ~строка 13; `linkProps` ~строка 24)

**Interfaces:**
- Consumes: `starterProgress` из `./starterSet` (Task 2).
- Produces: инсайт `{ kind: "starter-set", weight: 240, techniqueIds: [], route: "/starter" }`.

- [ ] **Step 1: Добавить падающие тесты в `src/lib/bjj/insights.test.ts`**

В начало файла к импортам добавить:

```ts
import { STARTER_SET } from "./starterSet";
```

Внутри `describe("computeInsights / primaryAction", ...)` добавить:

```ts
  it("белый пояс с непройденным набором -> primary starter-set (вес 240)", () => {
    const ins = computeInsights({ ...base, belt: "white", entries: [], progress: {}, reviewed: {}, frequency: 3 });
    const pa = primaryAction(ins);
    expect(pa?.kind).toBe("starter-set");
    expect(pa?.weight).toBe(240);
    expect(pa?.route).toBe("/starter");
  });

  it("не-белый пояс -> нет starter-set", () => {
    const ins = computeInsights({ ...base, belt: "blue", entries: [], progress: {}, reviewed: {}, frequency: 3 });
    expect(ins.some((i) => i.kind === "starter-set")).toBe(false);
  });

  it("весь набор изучен -> starter-set гаснет", () => {
    const progress: ProgressMap = {};
    for (const b of STARTER_SET) for (const id of b.ids) progress[id] = "done";
    const ins = computeInsights({ ...base, belt: "white", entries: [], progress, reviewed: {}, frequency: 3 });
    expect(ins.some((i) => i.kind === "starter-set")).toBe(false);
  });
```

- [ ] **Step 2: Запустить, убедиться что падают**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: FAIL (kind `starter-set` не появляется; тип не знает `"starter-set"`).

- [ ] **Step 3: Добавить kind в тип `InsightKind` (`insights.ts`)**

Заменить строку 44:

```ts
export type InsightKind = "return-after-pause" | "cold-start" | "catcher-defense" | "review-shown" | "repeat-stale" | "plan" | "learn-next";
```

на:

```ts
export type InsightKind = "starter-set" | "return-after-pause" | "cold-start" | "catcher-defense" | "review-shown" | "repeat-stale" | "plan" | "learn-next";
```

- [ ] **Step 4: Импорт и блок инсайта (`insights.ts`)**

К импортам добавить:

```ts
import { starterProgress } from "./starterSet";
```

Сразу после блока `cold-start` (после закрывающей `}` его `if`, перед комментарием `// catcher-defense`) вставить:

```ts
  // starter-set: белый пояс, пока базовый набор не пройден целиком -> «с чего начать».
  // Вес выше return-after-pause/cold-start: для нового белого это герой дня.
  // Когда набор пройден (done === total) — инсайт гаснет (хендофф на дневник).
  if (belt === "white") {
    const sp = starterProgress(progress);
    if (sp.total > 0 && sp.done < sp.total) {
      out.push({
        kind: "starter-set", weight: 240, techniqueIds: [],
        reason: "С чего начать: собери базу белого пояса", route: "/starter",
      });
    }
  }
```

- [ ] **Step 5: Запустить тесты инсайтов, убедиться что проходят**

Run: `npx vitest run src/lib/bjj/insights.test.ts`
Expected: PASS (включая 3 новых кейса).

- [ ] **Step 6: Отобразить инсайт в `TodayAction.tsx`**

В объекте `CTA` (после строки 13) добавить запись:

```ts
  "starter-set": "Открыть набор",
```

Заменить функцию `linkProps` (строки 24-28) на:

```ts
function linkProps(ins: Insight) {
  if (ins.kind === "starter-set") return { to: "/starter" as const };
  const id = ins.techniqueIds[0];
  if (id != null) return { to: "/technique/$id" as const, params: { id: String(id) } };
  return { to: "/diary" as const, search: { add: true } };
}
```

- [ ] **Step 7: Проверить сборку/типы**

Run: `npx vitest run src/lib/bjj/insights.test.ts && npx tsc --noEmit`
Expected: тесты PASS; `tsc` без ошибок (маршрут `/starter` появится в типах роутера после Task 4 — если `tsc` ругается на `to: "/starter"`, выполнить Step этой задачи после Task 4; см. примечание ниже).

> Примечание по порядку: типобезопасные маршруты TanStack генерируются из файлов роутов. Ссылка `to: "/starter"` станет валидной для `tsc` только после создания `src/routes/starter.tsx` (Task 4). Тесты (vitest) от этого не зависят и проходят сразу. Если исполняете строго по порядку — закоммитьте Task 3 по зелёным тестам, а `tsc --noEmit` прогоните в конце Task 4.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bjj/insights.ts src/lib/bjj/insights.test.ts src/components/bjj/TodayAction.tsx
git commit -m "feat: промо-инсайт starter-set в ленте Сегодня"
```

---

### Task 4: Вкладка StarterSet и роут /starter

**Files:**
- Create: `src/components/bjj/StarterSet.tsx`
- Create: `src/routes/starter.tsx`
- Modify: `src/lib/bjj/telemetry.ts` (union `TelemetryEvent`, ~строка 37)

**Interfaces:**
- Consumes: `starterProgress` (Task 2), `TechniqueRow` из `./TechniqueCard`, `useProgress`/`useProfile` из `../lib/bjj/store`, `AppShell`, `PageHeader`, `TechniquesTabs`, `track`.
- Produces: роут `/starter` (делает `to: "/starter"` из Task 3 типобезопасным), компонент `StarterSet`.

- [ ] **Step 1: Добавить событие телеметрии в `telemetry.ts`**

В union `TelemetryEvent` добавить строку (например после `"struggle_logged"`, до `;`):

```ts
  | "starter_open"
```

- [ ] **Step 2: Создать `src/components/bjj/StarterSet.tsx`**

```tsx
import { useState } from "react";
import { Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { useProgress } from "@/lib/bjj/store";
import { starterProgress } from "@/lib/bjj/starterSet";
import type { ProgressStatus } from "@/lib/bjj/types";

// Маркер статуса справа в строке (те же цвета, что на карточке техники)
const STATUS_ICON = { not_started: Circle, in_progress: CircleDot, done: Check } as const;
const STATUS_COLOR: Record<ProgressStatus, string> = {
  not_started: "var(--status-idle)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
};
function StatusMark({ status }: { status: ProgressStatus }) {
  const Icon = STATUS_ICON[status];
  return <Icon className="h-5 w-5 shrink-0" style={{ color: STATUS_COLOR[status] }} strokeWidth={2.2} />;
}

// Сколько бакетов раскрыто по умолчанию (остальные аккордеоном). Финализируется рантаймом.
const OPEN_BY_DEFAULT = 2;

// Стартовый набор новичка: базовые техники по позициям с отметкой пройденного.
// Отметка «изучено» ставится на карточке техники (строка -> карточка), не инлайн.
export function StarterSet() {
  const { progress } = useProgress();
  const sp = starterProgress(progress);
  const [openIdx, setOpenIdx] = useState<Set<number>>(
    () => new Set(sp.buckets.map((_, i) => i).slice(0, OPEN_BY_DEFAULT)),
  );

  const pct = sp.total ? Math.round((sp.done / sp.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[15px] font-semibold">С чего начать</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Базовый набор белого пояса. Порядок — ориентир, а не строгий путь.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {sp.done} из {sp.total}
          </span>
        </div>
      </div>

      {sp.buckets.map((b, i) => {
        const open = openIdx.has(i);
        return (
          <section key={b.title}>
            <button
              type="button"
              onClick={() =>
                setOpenIdx((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              aria-expanded={open}
              className="flex w-full items-center justify-between px-1 pb-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {b.title}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {b.done}/{b.total}
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </span>
            </button>
            {open && (
              <div className="space-y-1.5">
                {b.techniques.map((t) => (
                  <TechniqueRow
                    key={t.id}
                    technique={t}
                    right={<StatusMark status={progress[t.id] ?? "not_started"} />}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Создать роут `src/routes/starter.tsx` с гейтом пояса**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/bjj/AppShell";
import { PageHeader } from "@/components/bjj/ui";
import { TechniquesTabs } from "@/components/bjj/TechniquesTabs";
import { StarterSet } from "@/components/bjj/StarterSet";
import { useProfile } from "@/lib/bjj/store";
import { track } from "@/lib/bjj/telemetry";

export const Route = createFileRoute("/starter")({
  component: StarterPage,
});

function StarterPage() {
  const { profile, hydrated } = useProfile();
  const navigate = Route.useNavigate();
  const isWhite = profile.belt === "white";

  // Гейт пояса на клиенте (пояс в localStorage, beforeLoad его не видит):
  // не белый -> на карту. Ждём hydrated, иначе ложный редирект/мигание.
  useEffect(() => {
    if (hydrated && !isWhite) navigate({ to: "/map", replace: true });
  }, [hydrated, isWhite, navigate]);

  useEffect(() => {
    if (hydrated && isWhite) track("starter_open", undefined, { dailyDedup: true });
  }, [hydrated, isWhite]);

  return (
    <AppShell>
      <div className="space-y-3">
        <PageHeader kicker="Для новичка" title="С чего начать" className="px-1" />
        <TechniquesTabs />
        {hydrated && isWhite ? (
          <StarterSet />
        ) : (
          <div className="h-40 rounded-2xl border border-border bg-card" />
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Проверить типы и сборку**

Run: `npx tsc --noEmit`
Expected: без ошибок (роут `/starter` теперь известен роутеру; `to: "/starter"` из Task 3 валиден).

- [ ] **Step 5: Рантайм-проверка через DOM**

Запустить превью (конфиг `bjj-companion` из корневого `.claude/launch.json`), взять фактический порт из `preview_logs`. Стабом профиля выставить белый пояс, перейти на `/starter`.
Проверить через `javascript_tool`: заголовок «С чего начать», прогресс-хедер «N из M», бакеты, строки-техники ведут на `/technique/$id`. Отметить технику `done` на карточке, вернуться — прогресс-хедер и `done/total` бакета выросли. Консоль без ошибок из нового кода (`read_console_messages`).

- [ ] **Step 6: Commit**

```bash
git add src/components/bjj/StarterSet.tsx src/routes/starter.tsx src/lib/bjj/telemetry.ts src/routeTree.gen.ts
git commit -m "feat: вкладка StarterSet и роут /starter (гейт белого пояса)"
```

> `src/routeTree.gen.ts` регенерируется dev-сервером/сборкой при добавлении файла роута. Если он изменился — включить в коммит; если генерация ещё не прошла, запустить `npx vite build` один раз или дев-сервер, затем добавить.

---

### Task 5: Под-вкладка «Старт» первой, только для белого пояса

**Files:**
- Modify: `src/components/bjj/TechniquesTabs.tsx` (полностью, файл маленький)

**Interfaces:**
- Consumes: `useProfile` из `@/lib/bjj/store`, роут `/starter` (Task 4).

- [ ] **Step 1: Обновить `src/components/bjj/TechniquesTabs.tsx`**

Заменить импорты и тело `TechniquesTabs` (функция `Tab` ниже не меняется):

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { Flag, Network, List, HelpCircle, BookA } from "lucide-react";
import { useProfile } from "@/lib/bjj/store";

// Переключатель внутри раздела «Техники»: Старт (только белый) · Карта · Список · Что если · Словарь.
// Ставится отдельной строкой ПОД шапкой раздела (не рядом с заголовком).
export function TechniquesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, hydrated } = useProfile();
  const showStarter = hydrated && profile.belt === "white";
  return (
    <div className="flex w-full rounded-full border border-border bg-card p-0.5">
      {showStarter && (
        <Tab to="/starter" active={pathname.startsWith("/starter")} icon={<Flag className="h-3.5 w-3.5" />} label="Старт" />
      )}
      <Tab to="/map" active={pathname.startsWith("/map")} icon={<Network className="h-3.5 w-3.5" />} label="Карта" />
      <Tab to="/library" active={pathname.startsWith("/library")} icon={<List className="h-3.5 w-3.5" />} label="Список" />
      <Tab to="/situations" active={pathname.startsWith("/situations")} icon={<HelpCircle className="h-3.5 w-3.5" />} label="Что если" />
      <Tab to="/glossary" active={pathname.startsWith("/glossary")} icon={<BookA className="h-3.5 w-3.5" />} label="Словарь" />
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Рантайм-проверка ширины и видимости (DOM)**

Белый пояс: на `/starter` (и на `/map`) вкладка «Старт» первая, всего 5 табов. Через `javascript_tool` замерить, что ряд не переполняется (сумма ширин табов <= ширины контейнера; текст «Что если» не обрезан). Синий пояс: 4 таба, «Старт» отсутствует.

- [ ] **Step 4 (условный фолбэк ширины): если 5 табов тесно у белого**

Если замер показал переполнение/обрезку, скрыть иконки когда виден «Старт»: в `Tab` не рендерить `icon`, либо в контейнере при `showStarter` уменьшить отступы. Минимальный вариант — передавать иконку условно:

```tsx
// в TechniquesTabs, когда showStarter: иконки убираем, чтобы 5 подписей поместились
const withIcons = !showStarter;
// ...
<Tab ... icon={withIcons ? <Network className="h-3.5 w-3.5" /> : null} label="Карта" />
```

Применять ТОЛЬКО если Step 3 подтвердил переполнение. Повторить замер.

- [ ] **Step 5: Commit**

```bash
git add src/components/bjj/TechniquesTabs.tsx
git commit -m "feat: вкладка Старт первой в разделе Техники (только белый пояс)"
```

---

### Task 6: Курирование финального набора (bjj-instructor)

**Files:**
- Modify: `data/starter-set.json`
- Regenerate: `src/lib/bjj/generated/starter-set.json`

**Interfaces:** не меняет код; только содержимое набора.

Кандидаты (79 белых `fundamental`, сгруппированы) — уже известны. Ключевые по темам:
- Стойка/тейкдаун: 150 (двойной проход в ноги), 151 (одна нога), 21 (стойка), 636 (паммелинг).
- Гард снизу: 1 (играешь закрытый гард), 70 (свип ножницы), 72 (хип-бамп), 71 (флауэр свип), 34 (гильотина из гарда).
- Проход гарда: 2 (проходишь закрытый гард), 93 (тореадор), 90 (проход коленом), 376 (разрушение гарда).
- Выходы: 132 (локтевой из маунта), 133 (креветка из сайда), 134 (защита спины), 131 (мост из маунта).
- Базовые сабмишены: 35 (кросс-коллар из гарда), 30 (рычаг локтя из гарда), 32 (кимура из гарда), 39 (американа с маунта).
- Контроль сверху: 16 (держишь маунт), 14 (держишь сайд), 24 (колено на животе).
Полный список кандидатов при необходимости получить командой:
`node -e 'const t=require("./src/lib/bjj/generated/techniques.json");t.filter(x=>x.belt==="white"&&(x.tags||[]).includes("fundamental")).forEach(x=>console.log(x.id,x.group,x.nameRu))'`

- [ ] **Step 1: Получить курированный список ~12-18 id**

Отобрать финальный набор одним из способов: (а) диспатч `general-purpose` в роли инструктора (`.claude/agents/bjj-instructor.md` как системная роль) с задачей «выбрать 12-18 канонических техник белого пояса по тематическим бакетам из списка кандидатов, обосновать каждую»; либо (б) утверждение временного набора пользователем. Требование: только белые `fundamental` id; каждый бакет непустой; порядок бакетов — от стойки к финишу.

- [ ] **Step 2: Обновить `data/starter-set.json`**

Заменить содержимое на курированный список (та же форма `[{ "title", "ids" }]`).

- [ ] **Step 3: Перегенерировать и проверить**

Run: `node scripts/build-data.mjs`
Expected: «✅ Все ссылки валидны», «OK: стартовый набор N техник». Ни одного предупреждения «не белый пояс» (если инструктор осознанно включил не-белую базовую — предупреждение допустимо, зафиксировать причину).

- [ ] **Step 4: Прогнать тесты (набор реальный -> инсайт-кейсы всё ещё валидны)**

Run: `npx vitest run src/lib/bjj/starterSet.test.ts src/lib/bjj/insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add data/starter-set.json src/lib/bjj/generated/starter-set.json
git commit -m "feat: курированный стартовый набор (инструктор)"
```

---

### Task 7: Интеграция, телеметрия-SQL и деплой

**Files:** нет правок кода — верификация и хендофф.

- [ ] **Step 1: Полный прогон тестов**

Run: `npx vitest run`
Expected: все тесты зелёные (существующие + starterSet + новые insights-кейсы).

- [ ] **Step 2: Сборка**

Run: `npx vite build`
Expected: успешная сборка без ошибок типов.

- [ ] **Step 3: Рантайм-чеклист (DOM, скриншоты таймаутят)**

Проверить на фактическом порту превью:
- Белый пояс: `/progress` показывает промо-героя «Открыть набор» (kind starter-set) первым; тап ведёт на `/starter`.
- Вкладка «Старт» первая; набор, прогресс-хедер, аккордеон, отметка на карточке двигает прогресс.
- Отметить все техники набора `done` -> промо-герой на «Моей игре» исчезает (уступает cold-start).
- Синий пояс: вкладки «Старт» нет; прямой заход на `/starter` редиректит на `/map`.

- [ ] **Step 4: Выдать SQL пользователю (инлайн в чат готовым sql-блоком)**

Кумулятивный whitelist телеметрии с новым `starter_open` (перекрывает все прежние). Постить прямо в ответ, НЕ ссылкой на файл:

```sql
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
    'pro_video_interest', 'review_opened', 'review_drill', 'partner_nudge',
    'favorite_toggle', 'level_up', 'glossary_open',
    'insight_shown', 'insight_click',
    'reverse_search', 'workout_theme', 'gap_shown', 'coach_shown',
    'struggle_logged', 'starter_open'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;
```
Также сохранить копию в `docs/sql/2026-08-01-telemetry-starter.sql` для истории.

- [ ] **Step 5: Деплой**

Из `bjj-companion/`:
```bash
npx vercel --prod --yes --scope ivankhr
```
После деплоя curl-проверка прода (SSR `/starter` = 200; свежий хеш AppShell-чанка). Пушить ветку в git для истории.

- [ ] **Step 6: Финальный коммит документации (при необходимости) и слияние ветки**

Слить `feat/starter-set` в `main` после зелёной верификации (skill finishing-a-development-branch).

---

## Self-Review

**1. Spec coverage:**
- Данные `starter-set.json` + валидация + эмит -> Task 1. ✔
- Чистый модуль `starterProgress` -> Task 2. ✔
- Промо-инсайт `starter-set` (вес 240, гаснет при пройденном) + отображение -> Task 3. ✔
- Вкладка/роут `/starter` + гейт пояса + edge-cases (прямой URL, смена пояса, до гидратации) -> Task 4. ✔
- «Старт» первой, white-only, риск ширины -> Task 5. ✔
- Курирование инструктором -> Task 6. ✔
- Телеметрия `starter_open` + SQL + тесты + деплой -> Task 4 (union) + Task 7. ✔
- Онбординг-CTA из спеки (секция 6) СОЗНАТЕЛЬНО опущен: клик уводит с незавершённого онбординга (onboardingDone ещё не выставлен) -> риск возврата в онбординг; промо-инсайт на «Моей игре» покрывает первое касание сразу после онбординга. YAGNI, «малая ставка».
- Открытый вопрос 1 (дефолт раздела) решён пользователем: оставить как есть -> дефолтный роут не меняем. ✔

**2. Placeholder scan:** код во всех шагах реальный; временный набор Task 1 — конкретные валидные id, не placeholder. Курирование Task 6 — data-шаг с известными кандидатами. Нет «TODO/добавить обработку».

**3. Type consistency:** `starterProgress(progress, set?)`, `StarterBucket{title,ids}`, `StarterProgress{done,total,buckets}` — одни имена в Task 2, 3, 4. Инсайт `kind:"starter-set"`, `route:"/starter"`, `weight:240` — согласованы между `insights.ts`, тестом и `TodayAction`. Событие `starter_open` — union (Task 4) и SQL (Task 7) совпадают.
