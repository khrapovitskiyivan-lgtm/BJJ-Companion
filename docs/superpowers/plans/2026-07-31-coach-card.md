# Карточка-тренер — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Персонализировать карточку техники: строка «зачем тебе это», видимый «следующий шаг», «знаешь N из M» в пилюлях списков, убрать общий блок «Похожие».

**Architecture:** Чистый модуль `coachCard.ts` (knownCount/nextStep/cardReason), переиспользующий `effectiveStyleSet`/`goalScore`/`topCatchers`. `RelatedList` получает аддитивные пропы `badge`/`highlightId`. `technique.$id.tsx` вычисляет сигналы за гейтом гидратации и рендерит их. Логику генератора не трогаем.

**Tech Stack:** TanStack Start (React 19), TypeScript, vitest, lucide-react, Tailwind CSS 4.

## Global Constraints

- Только `setup_from`/`chain_to`/`prerequisites`; `common_setups`/`usedBy` НЕ трогать.
- `cardReason` возвращает `null` при отсутствии сильной причины — строку НЕ рисуем (никакого generic-филлера).
- Персональные добавки — за гейтом гидратации (все три стора), иначе прыжок layout на видном месте.
- Аддитивные пропы у общих компонентов (`RelatedList`); не плодить локальные копии строк; не ломать прочих потребителей `TechniqueRow`.
- Логику step 2 (генератор/иерархию) НЕ менять.
- В коде и текстах: без эмодзи и em-dash (стрелка «→» допустима). Комментарии по-русски.
- Данные техник НЕ меняются (`build-data.mjs` не запускать).
- Тесты — на синтетических техниках (id вне базы). Обе темы. Превью: launch-конфиг `bjj-companion` (порт 8080).

---

### Task 1: coachCard.ts — чистая логика персональных сигналов

**Files:**
- Create: `src/lib/bjj/coachCard.ts`
- Test: `src/lib/bjj/coachCard.test.ts`

**Interfaces:**
- Consumes: `goalScore` из `./recommend`; `topCatchers` из `./caught`.
- Produces:
  ```ts
  export function knownCount(ids: number[], progress: ProgressMap): { done: number; total: number };
  export function nextStep(input: { tech: Technique; byId: Map<number, Technique>; progress: ProgressMap; styleSet: Set<Style>; goal?: Goal; gi?: boolean; noGi?: boolean }): Technique | null;
  export function cardReason(input: { tech: Technique; entries: DiaryEntry[]; styleSet: Set<Style>; goal?: Goal; gi?: boolean; noGi?: boolean; byId: Map<number, Technique> }): { kind: "gap" | "style" | "goal"; text: string } | null;
  ```

- [ ] **Step 1: Тест (падающий)**

Создать `src/lib/bjj/coachCard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { knownCount, nextStep, cardReason } from "./coachCard";
import type { DiaryEntry, Style, Technique } from "./types";

function T(over: Partial<Technique> = {}): Technique {
  return {
    id: 1, label: "T", title: "T", nameRu: "T", nameEn: "T", group: "submission",
    belt: "white", styles: [], gi: true, noGi: true, legal_ibjjf_gi: true, legal_ibjjf_nogi: true,
    legal_adcc: true, points_ibjjf: 0, points_adcc: 0, tags: [], aliases: [], prerequisites: [],
    setup_from: [], common_setups: [], chain_to: [], difficulty: 2, successRate: "N/A",
    energyCost: "Low", content: { ru: { concept:"",mechanics:"",keyPoints:"",when:"",mistakes:"",drills:"",injuryRisk:"Низкий",tapWarning:"Нет" } }, ...over,
  } as Technique;
}
const mapOf = (...ts: Technique[]) => new Map(ts.map((t) => [t.id, t]));

describe("knownCount", () => {
  it("считает освоенные из списка", () => {
    expect(knownCount([1, 2, 3], { 1: "done", 2: "in_progress" })).toEqual({ done: 1, total: 3 });
  });
  it("пустой список -> 0/0", () => {
    expect(knownCount([], {})).toEqual({ done: 0, total: 0 });
  });
});

describe("nextStep", () => {
  it("исключает пройденные продолжения", () => {
    const tech = T({ id: 1, chain_to: [2, 3] });
    const s = nextStep({ tech, byId: mapOf(T({ id: 2 }), T({ id: 3 })), progress: { 2: "done" }, styleSet: new Set() });
    expect(s?.id).toBe(3);
  });
  it("ранг: стиль важнее сложности", () => {
    const tech = T({ id: 1, chain_to: [2, 3] });
    const byId = mapOf(T({ id: 2, difficulty: 1 }), T({ id: 3, difficulty: 5, styles: ["sweeper" as Style] }));
    const s = nextStep({ tech, byId, progress: {}, styleSet: new Set(["sweeper" as Style]) });
    expect(s?.id).toBe(3);
  });
  it("нет непройденных продолжений -> null", () => {
    const tech = T({ id: 1, chain_to: [] });
    expect(nextStep({ tech, byId: mapOf(), progress: {}, styleSet: new Set() })).toBeNull();
  });
});

describe("cardReason", () => {
  const byId = mapOf(T({ id: 9, nameRu: "Треугольник" }));
  it("дыра бьёт стиль", () => {
    const tech = T({ id: 1, setup_from: [9], styles: ["sweeper" as Style] });
    const entries: DiaryEntry[] = [
      { id: "a", date: "2026-07-01", techniqueIds: [], caughtBy: [9] },
      { id: "b", date: "2026-07-02", techniqueIds: [], caughtBy: [9] },
    ];
    const r = cardReason({ tech, entries, styleSet: new Set(["sweeper" as Style]), byId });
    expect(r).toEqual({ kind: "gap", text: "Закрывает твою дыру: Треугольник" });
  });
  it("стиль, если нет дыры", () => {
    const tech = T({ id: 1, styles: ["sweeper" as Style] });
    expect(cardReason({ tech, entries: [], styleSet: new Set(["sweeper" as Style]), byId })).toEqual({ kind: "style", text: "Усиливает твою игру" });
  });
  it("очковая под соревнования", () => {
    const tech = T({ id: 1, points_ibjjf: 2 });
    expect(cardReason({ tech, entries: [], styleSet: new Set(), goal: "competition", byId })).toEqual({ kind: "goal", text: "Очковая под соревнования" });
  });
  it("нет сильной причины -> null (без филлера)", () => {
    expect(cardReason({ tech: T({ id: 1 }), entries: [], styleSet: new Set(), byId })).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/coachCard.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Реализация coachCard.ts**

```ts
// Персональные сигналы карточки техники (чистые функции, тестируемость + SSR-safe).
import { goalScore } from "./recommend";
import { topCatchers } from "./caught";
import type { DiaryEntry, Goal, Style, Technique } from "./types";
import type { ProgressMap } from "./store";

// «Знаешь N из M»: сколько из id освоено
export function knownCount(ids: number[], progress: ProgressMap): { done: number; total: number } {
  return { done: ids.filter((id) => progress[id] === "done").length, total: ids.length };
}

// Лучшее следующее звено из chain_to: непройденное, ранг стиль -> goalScore -> сложность -> id
export function nextStep(input: {
  tech: Technique; byId: Map<number, Technique>; progress: ProgressMap;
  styleSet: Set<Style>; goal?: Goal; gi?: boolean; noGi?: boolean;
}): Technique | null {
  const { tech, byId, progress, styleSet, goal, gi, noGi } = input;
  const opts = { goal, gi, noGi };
  const cands = tech.chain_to
    .map((id) => byId.get(id))
    .filter((t): t is Technique => !!t && progress[t.id] !== "done");
  if (!cands.length) return null;
  cands.sort(
    (a, b) =>
      (b.styles.some((s) => styleSet.has(s)) ? 1 : 0) - (a.styles.some((s) => styleSet.has(s)) ? 1 : 0) ||
      goalScore(b, opts) - goalScore(a, opts) ||
      a.difficulty - b.difficulty ||
      a.id - b.id,
  );
  return cands[0];
}

// «Зачем тебе это»: сильная причина или null. Приоритет дыра > стиль > цель.
export function cardReason(input: {
  tech: Technique; entries: DiaryEntry[]; styleSet: Set<Style>;
  goal?: Goal; gi?: boolean; noGi?: boolean; byId: Map<number, Technique>;
}): { kind: "gap" | "style" | "goal"; text: string } | null {
  const { tech, entries, styleSet, goal, byId } = input;
  for (const c of topCatchers(entries, 3)) {
    if (tech.setup_from.includes(c.id)) {
      const name = byId.get(c.id)?.nameRu ?? "сабмишена";
      return { kind: "gap", text: `Закрывает твою дыру: ${name}` };
    }
  }
  if (tech.styles.some((s) => styleSet.has(s))) {
    return { kind: "style", text: "Усиливает твою игру" };
  }
  if (goal === "competition" && tech.points_ibjjf > 0) {
    return { kind: "goal", text: "Очковая под соревнования" };
  }
  return null;
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/coachCard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/coachCard.ts src/lib/bjj/coachCard.test.ts
git commit -m "feat(карточка): coachCard — knownCount / nextStep / cardReason

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Интеграция в карточку техники + телеметрия

**Files:**
- Modify: `src/components/bjj/technique/RelatedList.tsx` (пропы `badge`, `highlightId`)
- Modify: `src/lib/bjj/telemetry.ts` (событие `coach_shown`)
- Modify: `src/routes/technique.$id.tsx` (вычисление сигналов, рендер, удаление «Похожие», телеметрия)
- Create: `docs/sql/2026-07-31-telemetry-coach-shown.sql`

**Interfaces:**
- Consumes: `knownCount`/`nextStep`/`cardReason` (Task 1); `effectiveStyleSet`/`practiceCountFrom` из `./workoutCluster`; `track` из `./telemetry`.

- [ ] **Step 1: RelatedList — пропы badge и highlightId**

Заменить `src/components/bjj/technique/RelatedList.tsx` целиком на:
```tsx
import { Link2, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import type { Technique } from "@/lib/bjj/types";

// Раскрываемая вкладка со связанными техниками (нативный <details>, SSR-безопасно).
// badge — замена счётчика в summary (для «N/M»); highlightId — подсветка строки (следующий шаг).
export function RelatedList({
  title,
  items,
  empty,
  defaultOpen = false,
  badge,
  highlightId,
}: {
  title: string;
  items: Technique[];
  empty?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  highlightId?: number;
}) {
  if (items.length === 0 && !empty) return null;

  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {title}
          {badge != null ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {badge}
            </span>
          ) : items.length > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {items.length}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((t) => (
              <li key={t.id} className={highlightId === t.id ? "rounded-xl ring-2 ring-primary/40" : undefined}>
                <TechniqueRow
                  technique={t}
                  inset
                  right={<Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: telemetry — событие coach_shown**

В `src/lib/bjj/telemetry.ts` в union `TelemetryEvent` после `| "gap_shown"` добавить:
```ts
  | "coach_shown";
```
(перенести завершающую `;` на `"coach_shown"`).

- [ ] **Step 3: SQL whitelist**

Создать `docs/sql/2026-07-31-telemetry-coach-shown.sql`:
```sql
-- Расширение белого списка телеметрии: coach_shown
-- (показ персональных сигналов карточки техники; detail = gap|style|goal|next, дедуп раз в сутки).
-- Выполнить один раз в Supabase -> SQL Editor. Полный текущий whitelist + новое событие.

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
    'reverse_search', 'workout_theme', 'gap_shown', 'coach_shown'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;
```

- [ ] **Step 4: technique.$id.tsx — импорты**

В `src/routes/technique.$id.tsx`:
Строка 6 заменить:
```tsx
import { useProgress, useProfile, useReviewed, useFavorites } from "@/lib/bjj/store";
```
на:
```tsx
import { useProgress, useProfile, useReviewed, useFavorites, useDiary } from "@/lib/bjj/store";
```
После строки 6 добавить:
```tsx
import { effectiveStyleSet } from "@/lib/bjj/workoutCluster";
import { knownCount, nextStep, cardReason } from "@/lib/bjj/coachCard";
```
В блоке иконок (строки 11-22) добавить `ArrowRight,` (например, после `ArrowLeft,`).

- [ ] **Step 5: technique.$id.tsx — хуки и вычисления**

Строки 90-91 заменить:
```tsx
  const { progress, cycleStatus } = useProgress();
  const { profile } = useProfile();
```
на:
```tsx
  const { progress, cycleStatus, hydrated: progressHydrated } = useProgress();
  const { profile, hydrated: profileHydrated } = useProfile();
  const { entries, practiceCount, hydrated: diaryHydrated } = useDiary();
  const personalReady = progressHydrated && profileHydrated && diaryHydrated;
```
Удалить `similar` useMemo (строки 129-133 целиком):
```tsx
  const similar = useMemo(() => {
    return TECHNIQUES.filter(
      (t) => t.id !== tech.id && t.group === tech.group && t.belt === tech.belt,
    ).slice(0, 6);
  }, [tech]);
```
Сразу ПОСЛЕ `practiceHistory` useMemo (после строки 127 `}, [tech.id]);`) добавить вычисления:
```tsx
  // Персональные сигналы карточки-тренера (за гейтом гидратации)
  const byId = useMemo(() => new Map(TECHNIQUES.map((t) => [t.id, t])), []);
  const styleSet = useMemo(
    () => effectiveStyleSet(profile, progress, practiceCount()),
    [profile, progress, practiceCount],
  );
  const reason = useMemo(
    () =>
      personalReady
        ? cardReason({ tech, entries, styleSet, goal: profile.goal, gi: profile.gi, noGi: profile.noGi, byId })
        : null,
    [personalReady, tech, entries, styleSet, profile, byId],
  );
  const step = useMemo(
    () =>
      personalReady
        ? nextStep({ tech, byId, progress, styleSet, goal: profile.goal, gi: profile.gi, noGi: profile.noGi })
        : null,
    [personalReady, tech, byId, progress, styleSet, profile],
  );
  const prereqKnown = knownCount(tech.prerequisites, progress);
  const setupKnown = knownCount(tech.setup_from, progress);

  // Телеметрия показа тренера (раз в сутки на вид причины)
  useEffect(() => {
    if (personalReady && (reason || step)) track("coach_shown", reason?.kind ?? "next", { dailyDedup: true });
  }, [personalReady, reason, step]);
```

- [ ] **Step 6: technique.$id.tsx — строка причины в шапке**

Найти конец шапки (строки 240-245):
```tsx
        {content && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <GlossaryText text={content.concept} excludeTechId={tech.id} />
          </p>
        )}
      </header>
```
Заменить на (добавить строку причины перед `</header>`):
```tsx
        {content && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <GlossaryText text={content.concept} excludeTechId={tech.id} />
          </p>
        )}
        {personalReady && reason && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {reason.text}
          </p>
        )}
      </header>
```

- [ ] **Step 7: technique.$id.tsx — строка «следующий шаг» под шапкой**

Сразу ПОСЛЕ `</header>` (перед комментарием `{/* Под описанием: ... видео ... */}`) вставить:
```tsx
      {personalReady && step && (
        <Link
          to="/technique/$id"
          params={{ id: String(step.id) }}
          onClick={() => track("reco_click", "next_step")}
          className="flex items-center justify-between gap-2 rounded-xl border border-ring/50 bg-primary/5 px-4 py-2.5 text-sm"
        >
          <span className="text-muted-foreground">
            Дальше: <span className="font-medium text-foreground">{step.nameRu}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        </Link>
      )}
```

- [ ] **Step 8: technique.$id.tsx — убрать «Похожие», N/M-пилюли, подсветка chain_to**

Удалить секцию «Похожие техники» целиком (строки 338-355):
```tsx
      {similar.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Похожие техники
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {similar.map((t) => (
              <TechniqueRow
                key={t.id}
                technique={t}
                inset
                right={<Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              />
            ))}
          </div>
        </section>
      )}

```
Блок RelatedList (строки 357-366) заменить на (добавить badge/highlightId):
```tsx
      <RelatedList
        title="Что изучить сначала"
        items={resolve(tech.prerequisites)}
        empty="Нет требований — можно изучать сразу."
        defaultOpen
        badge={personalReady && prereqKnown.total > 0 ? `${prereqKnown.done}/${prereqKnown.total}` : undefined}
      />
      <RelatedList
        title="Заходы из"
        items={resolve(tech.setup_from)}
        badge={personalReady && setupKnown.total > 0 ? `${setupKnown.done}/${setupKnown.total}` : undefined}
      />
      <RelatedList title="Типичные сетапы" items={resolve(tech.common_setups)} />
      <RelatedList title="Продолжения" items={resolve(tech.chain_to)} highlightId={step?.id} />
      <RelatedList title="Используется в" items={usedBy} />
```

- [ ] **Step 9: Тесты + типы**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS (coachCard-тесты + прежние; счётчик вырос).
Run: `cd bjj-companion && npx tsc --noEmit 2>&1 | grep -E "technique\.\\\$id|RelatedList|coachCard|telemetry"`
Expected: пусто (мои файлы типо-чисты; предсуществующие ошибки в recommend.ts/store.ts игнорируем).

- [ ] **Step 10: Рантайм через DOM**

Открыть превью (`bjj-companion`, порт 8080), seed профиля (onboardingDone+consent local, goal competition), `bjj.progress.v1` с несколькими "done" среди prerequisites/setup_from разбираемой техники, дневник с `caughtBy`. Открыть карточку техники, у которой есть setup_from/chain_to (напр. `/technique/40`):
- в summary «Что изучить сначала»/«Заходы из» видно «N/M» БЕЗ раскрытия;
- строка «Дальше: X» под шапкой; клик ведёт на технику X;
- строка причины в шапке при сильной причине; при её отсутствии строки НЕТ;
- «Похожие техники» отсутствует;
- обе темы; нет прыжка layout при загрузке (гейт гидратации).
Проверка через `javascript_tool`:
```js
(() => { const b=document.body.innerText; return JSON.stringify({ hasDalshe:b.includes('Дальше:'), hasPohozhie:b.includes('Похожие техники'), nm:/\d+\/\d+/.test(b) }); })()
```

- [ ] **Step 11: Commit**

```bash
cd bjj-companion && git add src/components/bjj/technique/RelatedList.tsx src/lib/bjj/telemetry.ts src/routes/technique.\$id.tsx docs/sql/2026-07-31-telemetry-coach-shown.sql
git commit -m "feat(карточка): персонализация — причина, следующий шаг, N/M, убрать «Похожие»

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- «Зачем тебе это» (строка в шапке, null без причины) -> Task 1 `cardReason` + Task 2 Step 6. Покрыто.
- «Твой следующий шаг» (видимая строка + подсветка chain_to) -> Task 1 `nextStep` + Task 2 Step 7/8. Покрыто.
- «Знаешь N из M» (пилюля) -> Task 1 `knownCount` + Task 2 Step 1 (badge) + Step 8. Покрыто.
- Убрать «Похожие» -> Task 2 Step 8. Покрыто.
- Телеметрия (`coach_shown` + `reco_click` detail) -> Task 2 Step 2/3/5/7. Покрыто.
- Гейт гидратации -> Task 2 Step 5 (`personalReady`) + условия рендера. Покрыто.
- Только setup_from/chain_to/prerequisites; common_setups/usedBy не тронуты -> Task 2 Step 8 (оставлены как есть). Покрыто.

**2. Placeholder scan:** плейсхолдеров нет; SQL приведён полностью (whitelist из предыдущей миграции + coach_shown). Каждый шаг с кодом содержит код.

**3. Type consistency:** `knownCount`/`nextStep`/`cardReason` (Task 1) вызываются в Task 2 Step 5 с теми же сигнатурами. `badge?: ReactNode`/`highlightId?: number` (Task 2 Step 1) переданы в Task 2 Step 8. `effectiveStyleSet(profile, progress, practiceCount())` — `practiceCount` из `useDiary` вызывается как функция (как в progress.tsx). `coach_shown` в union (Step 2) и в `track` (Step 5). `step?.id` -> `highlightId` (number). Согласовано.
