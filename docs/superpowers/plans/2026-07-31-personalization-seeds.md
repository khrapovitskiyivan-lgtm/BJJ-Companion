# Семена персонализации — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `goal` редактируемым в листе игрока и превратить спящую карточку «Разрыв» в промпт выбора аспирации (стиля), который активирует «Разрыв» и вес генератора; добавить метрику показа.

**Architecture:** Чистая `gapState()` решает состояние карточки (hidden/prompt/ontrack/gap). `GapCard` вызывает её, рендерит промпт при пустой аспирации (client-only, дисмисс через `styleAspiration.ts`), пик пишет `preferredStyles` через `onPickStyle`. `goal` редактируется секцией в CharacterSheet. Логику step 2 (генератор/иерархию сигналов) НЕ трогаем.

**Tech Stack:** TanStack Start (React 19), TypeScript, vitest, lucide-react, Tailwind CSS 4.

## Global Constraints

- Логику step 2 (генератор `workout.ts`/`workoutCluster.ts`, иерархию сигналов) НЕ менять. Пик аспирации меняет только вес (effectiveStyle), якорь по-прежнему из избранного/в-процессе.
- Хуки в `GapCard` вызываются БЕЗУСЛОВНО в начале компонента, до любых ранних `return` (rules-of-hooks).
- Промпт и дисмисс — только после mount (SSR-safe, паттерн `VideoInterestPrompt`): первый рендер как на сервере, затем клиентское чтение. Иначе гидрация разойдётся.
- Внутренние идентификаторы сторов/телеметрии не переименовывать.
- В коде и текстах: без эмодзи и em-dash. Комментарии по-русски.
- Данные техник НЕ меняются (`build-data.mjs` не запускать).
- Обе темы (светлая/тёмная). Это `/progress` + лист игрока (список), НЕ граф — скриншоты работают.
- Превью: launch-конфиг `bjj-companion` (порт 8080) в КОРНЕВОМ `.claude/launch.json` умбрелла-репо.

---

### Task 1: goal-editable в листе игрока

**Files:**
- Modify: `src/components/bjj/CharacterSheet.tsx` (импорт иконок+Goal, `GOAL_OPTIONS`, секция «Цель»)

**Interfaces:**
- Consumes: `useProfile()` -> `{ profile, update }` (уже используется в файле); `update({ goal })`.
- Produces: ничего для других задач (самодостаточно).

- [ ] **Step 1: Импорты (иконки + тип Goal)**

В `src/components/bjj/CharacterSheet.tsx` строка 9 сейчас:
```tsx
import { Check } from "lucide-react";
```
заменить на:
```tsx
import { Check, Shield, Trophy, Smile, Heart } from "lucide-react";
```
Строка 8 сейчас:
```tsx
import type { Belt, Frequency } from "@/lib/bjj/types";
```
заменить на:
```tsx
import type { Belt, Frequency, Goal } from "@/lib/bjj/types";
```

- [ ] **Step 2: Константа GOAL_OPTIONS**

После `FREQ_OPTIONS` (заканчивается на строке 16 `];`) добавить:
```tsx
// Цель — те же 4 варианта, что в онбординге; влияет на рекомендации подбора
const GOAL_OPTIONS: { value: Goal; label: string; Icon: typeof Shield }[] = [
  { value: "self-defense", label: "Самооборона", Icon: Shield },
  { value: "competition", label: "Соревнования", Icon: Trophy },
  { value: "hobby", label: "Для удовольствия", Icon: Smile },
  { value: "health", label: "Здоровье", Icon: Heart },
];
```

- [ ] **Step 3: Секция «Цель» в разметке**

В `CharacterSheet.tsx` найти конец секции «Формат тренировок» (строки 80-85):
```tsx
      <Section title="Формат тренировок">
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Gi (в кимоно)" active={profile.gi} onClick={() => (profile.noGi || !profile.gi) && update({ gi: !profile.gi })} />
          <Toggle label="No-Gi" active={profile.noGi} onClick={() => (profile.gi || !profile.noGi) && update({ noGi: !profile.noGi })} />
        </div>
      </Section>
```
СРАЗУ ПОСЛЕ этой `</Section>` вставить новую секцию:
```tsx
      {/* Цель — редактируемая (была заморожена после онбординга); влияет на подбор */}
      <Section title="Цель" hint="Влияет на рекомендации в отработке и следующих техниках.">
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => update({ goal: value })}
              className="flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all"
              style={{
                borderColor: profile.goal === value ? "var(--color-primary)" : "var(--color-border)",
                background:
                  profile.goal === value
                    ? "color-mix(in oklch, var(--color-primary) 8%, var(--color-card))"
                    : "var(--color-card)",
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Section>
```

- [ ] **Step 4: Тесты + рантайм**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS (число тестов не изменилось; это UI-правка).
Рантайм (превью `bjj-companion`): открыть лист игрока (тап по аватару на «Моей игре»), секция «Цель» видна, тап по варианту выделяет его и пишет `goal` в профиль. Проверка через `javascript_tool`:
```js
JSON.parse(localStorage.getItem('bjj.profile.v1')).goal
```
(меняется при выборе). Обе темы.

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/components/bjj/CharacterSheet.tsx
git commit -m "feat(профиль): цель редактируется в листе игрока (была заморожена #4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: gapState — чистая логика состояния «Разрыва»

**Files:**
- Create: `src/lib/bjj/gapState.ts`
- Test: `src/lib/bjj/gapState.test.ts`

**Interfaces:**
- Consumes: `ARCHETYPE_MIN_DONE` из `./stats`; `StyleScore` из `./styleProfile`.
- Produces:
  ```ts
  export type GapState = "hidden" | "prompt" | "ontrack" | "gap";
  export function gapState(input: {
    scores: StyleScore[]; preferredStyles?: Style[]; doneCount: number; mounted: boolean; dismissed: boolean;
  }): GapState
  ```

- [ ] **Step 1: Тест (падающий)**

Создать `src/lib/bjj/gapState.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gapState } from "./gapState";
import type { StyleScore } from "./styleProfile";
import type { Style } from "./types";

const sc = (style: Style, pct = 50): StyleScore => ({ style, score: 1, pct, done: 3 });
const top = [sc("back_hunter" as Style)];

describe("gapState", () => {
  it("холодный старт (мало done) -> hidden", () => {
    expect(gapState({ scores: top, doneCount: 2, mounted: true, dismissed: false })).toBe("hidden");
  });
  it("нет данных стиля (scores пусто) -> hidden", () => {
    expect(gapState({ scores: [], doneCount: 10, mounted: true, dismissed: false })).toBe("hidden");
  });
  it("порог пройден, аспирация пуста, mounted -> prompt", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: true, dismissed: false })).toBe("prompt");
  });
  it("до mount -> hidden (SSR-safe)", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: false, dismissed: false })).toBe("hidden");
  });
  it("дисмисснут -> hidden", () => {
    expect(gapState({ scores: top, doneCount: 10, mounted: true, dismissed: true })).toBe("hidden");
  });
  it("аспирация совпала с топом -> ontrack", () => {
    expect(gapState({ scores: top, preferredStyles: ["back_hunter" as Style], doneCount: 10, mounted: true, dismissed: false })).toBe("ontrack");
  });
  it("аспирация не совпала -> gap", () => {
    expect(gapState({ scores: top, preferredStyles: ["sweeper" as Style], doneCount: 10, mounted: true, dismissed: false })).toBe("gap");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/gapState.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Реализация gapState.ts**

```ts
// Состояние карточки «Разрыв»: чистая функция (тестируемость + rules-of-hooks в GapCard).
// hidden — холодный старт / до mount / дисмисснут; prompt — пора выбрать аспирацию;
// ontrack/gap — аспирация задана и совпадает/не совпадает с реальным топ-архетипом.
import { ARCHETYPE_MIN_DONE } from "./stats";
import type { StyleScore } from "./styleProfile";
import type { Style } from "./types";

export type GapState = "hidden" | "prompt" | "ontrack" | "gap";

export function gapState(input: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  doneCount: number;
  mounted: boolean;
  dismissed: boolean;
}): GapState {
  const { scores, preferredStyles, doneCount, mounted, dismissed } = input;
  if (doneCount < ARCHETYPE_MIN_DONE || scores.length === 0) return "hidden";
  if (!preferredStyles?.length) return mounted && !dismissed ? "prompt" : "hidden";
  return preferredStyles.includes(scores[0].style) ? "ontrack" : "gap";
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd bjj-companion && npx vitest run src/lib/bjj/gapState.test.ts`
Expected: PASS (7 кейсов).

- [ ] **Step 5: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/gapState.ts src/lib/bjj/gapState.test.ts
git commit -m "feat(разрыв): чистая gapState (hidden/prompt/ontrack/gap)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Промпт аспирации в GapCard + дисмисс + телеметрия

**Files:**
- Create: `src/lib/bjj/styleAspiration.ts`
- Modify: `src/lib/bjj/telemetry.ts` (событие `gap_shown`)
- Modify: `src/components/bjj/GapCard.tsx` (хуки, gapState, промпт, onPickStyle, gap_shown)
- Modify: `src/routes/progress.tsx` (передать onPickStyle, взять update)
- Create: `docs/sql/2026-07-31-telemetry-gap-shown.sql`

**Interfaces:**
- Consumes: `gapState`/`GapState` (Task 2); `STYLE_ORDER`/`STYLE_META` из `./constants`; `STYLE_ICONS` из `./styleIcons`; `track` из `./telemetry`; `useProfile().update` в progress.tsx.
- Produces: `GapCard` +проп `onPickStyle?: (s: Style) => void`.

- [ ] **Step 1: styleAspiration.ts (дисмисс-флаг, паттерн videoInterest)**

Создать `src/lib/bjj/styleAspiration.ts`:
```ts
// Флаг «промпт выбора стиля закрыт» в localStorage. SSR-guard как в videoInterest.ts.
const KEY = "bjj.styleAspiration.dismissed.v1";

export function isStyleAspirationDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissStyleAspiration(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // приватный режим/квота: молча
  }
}
```

- [ ] **Step 2: Событие gap_shown в телеметрии**

В `src/lib/bjj/telemetry.ts` в union `TelemetryEvent` после `| "workout_theme"` добавить:
```ts
  | "gap_shown";
```
(перенести завершающую `;` с `"workout_theme"` на `"gap_shown"`).

- [ ] **Step 3: Переписать GapCard.tsx**

Заменить ВЕСЬ файл `src/components/bjj/GapCard.tsx` на:
```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TECHNIQUES } from "@/lib/bjj/data";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { nextForStyle } from "@/lib/bjj/recommend";
import { STYLE_META, STYLE_ORDER } from "@/lib/bjj/constants";
import { STYLE_ICONS } from "@/lib/bjj/styleIcons";
import { gapState } from "@/lib/bjj/gapState";
import { isStyleAspirationDismissed, dismissStyleAspiration } from "@/lib/bjj/styleAspiration";
import { track } from "@/lib/bjj/telemetry";
import type { StyleScore } from "@/lib/bjj/styleProfile";
import type { ProgressMap } from "@/lib/bjj/store";
import type { Belt, Style } from "@/lib/bjj/types";
import { Compass, ArrowRight } from "lucide-react";

// "Разрыв": аспирация (кем хочешь быть) против реального архетипа (что тренируешь).
// Пусто + порог пройден -> промпт выбора аспирации (client-only, дисмиссится навсегда).
export function GapCard({
  scores,
  preferredStyles,
  progress,
  belt,
  doneCount,
  onPickStyle,
}: {
  scores: StyleScore[];
  preferredStyles?: Style[];
  progress: ProgressMap;
  belt: Belt;
  doneCount: number;
  onPickStyle?: (s: Style) => void;
}) {
  // Хуки безусловно вверху (rules-of-hooks). Промпт/дисмисс — только после mount (SSR-safe).
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setMounted(true);
    setDismissed(isStyleAspirationDismissed());
  }, []);

  const state = gapState({ scores, preferredStyles, doneCount, mounted, dismissed });

  useEffect(() => {
    if (state !== "hidden") track("gap_shown", state, { dailyDedup: true });
  }, [state]);

  if (state === "hidden") return null;

  if (state === "prompt") {
    return (
      <section className="rounded-2xl border border-ring/50 bg-primary/5 p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Compass className="h-4 w-4 text-primary" />
          Каким стилем хочешь играть?
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Выбери цель-стиль — покажем разрыв с реальной игрой и подтянем отработку.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {STYLE_ORDER.map((s) => {
            const Icon = STYLE_ICONS[s];
            return (
              <button
                key={s}
                onClick={() => onPickStyle?.(s)}
                className="flex items-center gap-2 rounded-xl border-2 border-border bg-card p-2 text-left transition-all hover:border-ring"
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground/80" strokeWidth={1.9} />
                <span className="truncate text-xs font-medium">{STYLE_META[s].ru}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            dismissStyleAspiration();
            setDismissed(true);
          }}
          className="mt-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Не сейчас
        </button>
      </section>
    );
  }

  // state === "ontrack" | "gap": реальный «Разрыв»
  const top = scores[0];
  const onTrack = state === "ontrack";
  const aspiration = onTrack ? top.style : preferredStyles?.[0] ?? top.style;
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
                    <TechniqueRow technique={t} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/workout"
            search={{ src: "diary" }}
            className={buttonClass("secondary", "sm", "mt-3 w-full text-muted-foreground")}
          >
            Собрать отработку по дневнику
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: progress.tsx — взять update и передать onPickStyle**

В `src/routes/progress.tsx` строка 39 сейчас:
```tsx
  const { profile, hydrated: profileHydrated } = useProfile();
```
заменить на:
```tsx
  const { profile, update, hydrated: profileHydrated } = useProfile();
```
Найти использование `<GapCard` (внутри `<div onClickCapture={() => track("reco_click", "gap")}>`), сейчас:
```tsx
          <GapCard
            scores={styleScores}
            preferredStyles={profile.preferredStyles}
            progress={progress}
            belt={profile.belt}
            doneCount={doneCount}
          />
```
заменить на (добавить onPickStyle):
```tsx
          <GapCard
            scores={styleScores}
            preferredStyles={profile.preferredStyles}
            progress={progress}
            belt={profile.belt}
            doneCount={doneCount}
            onPickStyle={(s) => update({ preferredStyles: [s] })}
          />
```

- [ ] **Step 5: SQL whitelist**

Создать `docs/sql/2026-07-31-telemetry-gap-shown.sql`:
```sql
-- Расширение белого списка телеметрии: gap_shown
-- (показ карточки «Разрыв»/промпта аспирации; detail = prompt|ontrack|gap, дедуп раз в сутки).
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
    'reverse_search', 'workout_theme', 'gap_shown'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;
```

- [ ] **Step 6: Тесты + рантайм**

Run: `cd bjj-companion && npx vitest run`
Expected: PASS (gapState-тесты + прежние; счётчик вырос на 7).
Рантайм (превью `bjj-companion`, seed профиля onboardingDone+consent local, `bjj.progress.v1` с >=5 техниками "done", `bjj.favorites.v1` любое, `preferredStyles` НЕ задавать):
- на «Моей игре» после гидратации виден промпт «Каким стилем хочешь играть?» с 10 стилями;
- клик по стилю -> промпт исчезает, появляется реальный «Разрыв» (Хочу и тренирую) с этой аспирацией; `preferredStyles` записан в профиль;
- перезагрузить, снять preferredStyles (сбросить профиль на без аспирации), нажать «Не сейчас» -> промпт исчезает и НЕ возвращается после перезагрузки (`bjj.styleAspiration.dismissed.v1 === "1"`);
- обе темы. Скриншот списка ок (не граф).

- [ ] **Step 7: Commit**

```bash
cd bjj-companion && git add src/lib/bjj/styleAspiration.ts src/lib/bjj/telemetry.ts src/components/bjj/GapCard.tsx src/routes/progress.tsx docs/sql/2026-07-31-telemetry-gap-shown.sql
git commit -m "feat(разрыв): промпт выбора аспирации при пустом стиле + метрика gap_shown

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- A. goal-editable -> Task 1. Покрыто.
- B. Промпт аспирации (gapState, prompt-ветка, дисмисс, onPickStyle) -> Task 2 (gapState) + Task 3 (styleAspiration, GapCard, progress). Покрыто.
- C. Событие gap_shown (prompt/ontrack/gap, дедуп) + SQL -> Task 3 Step 2/5. Покрыто.
- Авто-засев preferredStyles НЕ добавлен -> ни одна задача его не вводит. Покрыто.
- SSR-safe / rules-of-hooks / step-2 не трогаем -> Global Constraints + Task 3 Step 3. Покрыто.

**2. Placeholder scan:** плейсхолдеров нет; SQL приведён полностью (whitelist известен из docs/sql/2026-07-31-telemetry-workout-theme.sql, добавлен gap_shown). Каждый шаг с кодом содержит код.

**3. Type consistency:** `gapState`/`GapState` (Task 2) потребляются в GapCard (Task 3) с теми же полями (`scores/preferredStyles/doneCount/mounted/dismissed`). `onPickStyle?: (s: Style) => void` — объявлен в GapCard (Task 3 Step 3) и передан из progress.tsx (Task 3 Step 4) как `(s) => update({ preferredStyles: [s] })`. `isStyleAspirationDismissed`/`dismissStyleAspiration` (Task 3 Step 1) вызываются в GapCard (Step 3). `GOAL_OPTIONS` (Task 1) — `Goal` из types. Согласовано.
