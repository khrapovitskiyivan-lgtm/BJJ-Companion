# Дневник: диагностика «Что не получилось?» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в форму дневника необязательный single-select вопрос «Что не получилось?», который появляется только при сигнале сопротивления (был спарринг), пишется в запись и даёт строку «акцент» на экране награды.

**Architecture:** Новый чистый модуль `struggle.ts` (тег-тип, подписи, гейт `showStruggle`) — единый источник для формы и экрана награды. Поле `DiaryEntry.struggle` прокидывается в `computeEntryReward` и отдаётся `EntryRewardSheet` через существующий объект `EntryReward`. UI формы: чипы в основном потоке между пикером «Чем тебя поймали?» и заметкой. Логика `caughtBy`/защит/генератора/XP НЕ трогается.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Tailwind 4, vitest. Скоуп — реализация секции B спеки `docs/superpowers/specs/2026-07-31-diary-diagnostic-design.md` (секция A копирайт сделана отдельной веткой; секция C «выигрыши/landed» отложена).

## Global Constraints

- Без эмодзи и em-dash в коде и копирайте; комментарии по-русски (стиль проекта).
- Диагностика **необязательна**, не блокирует «Сохранить», **без XP** (защита от фарма).
- **Гейт показа**: `caught.length > 0` ИЛИ `intensity` задана ИЛИ `rounds > 0`. На быстром логе (дата+техника) вопрос НЕ появляется — быстрый лог не утяжеляется.
- Чипы **single-select**, порядок: `Захват` · `База/поза` · `Угол/тайминг` · `Реакция партнёра` · `Не уверен`.
- **Размещение**: основной поток, после пикера «Чем тебя поймали?», перед заметкой. НЕ в «Подробнее».
- **«Акцент» на награде**: только при заданном `struggle` и НЕ `unsure`.
- Хранение: `DiaryEntry.struggle?: StruggleTag`. Телеметрия: `struggle_logged` (detail = тег), только для новой записи (как `caught_logged`). SQL применяет пользователь позже.
- НЕ трогать: `caughtBy`, защиты, генератор, XP-модуль, данные техник.
- Файлы читать перед правкой; хирургические изменения; стиль окружающего кода.

---

### Task 1: Тип `StruggleTag` + модуль `struggle.ts` + гейт

**Files:**
- Modify: `bjj-companion/src/lib/bjj/types.ts` (добавить `StruggleTag`; поле `struggle?` в `DiaryEntry`)
- Create: `bjj-companion/src/lib/bjj/struggle.ts`
- Test: `bjj-companion/src/lib/bjj/struggle.test.ts`

**Interfaces:**
- Consumes: `Intensity` из `./types`.
- Produces:
  - `type StruggleTag = "grip" | "base" | "timing" | "reaction" | "unsure"`
  - `const STRUGGLE_TAGS: StruggleTag[]` (порядок как выше)
  - `const STRUGGLE_LABEL: Record<StruggleTag, string>`
  - `function showStruggle(draft: { caught: number[]; intensity: Intensity | null; rounds: number }): boolean`

- [ ] **Step 1: Написать падающий тест**

Создать `bjj-companion/src/lib/bjj/struggle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { showStruggle, STRUGGLE_TAGS, STRUGGLE_LABEL } from "./struggle";

describe("showStruggle: гейт по сигналу сопротивления", () => {
  it("быстрый лог (нет поймали/интенсивности/раундов) — скрыт", () => {
    expect(showStruggle({ caught: [], intensity: null, rounds: 0 })).toBe(false);
  });
  it("есть 'чем поймали' — показан", () => {
    expect(showStruggle({ caught: [100], intensity: null, rounds: 0 })).toBe(true);
  });
  it("задана интенсивность — показан", () => {
    expect(showStruggle({ caught: [], intensity: "hard", rounds: 0 })).toBe(true);
  });
  it("есть раунды — показан", () => {
    expect(showStruggle({ caught: [], intensity: null, rounds: 3 })).toBe(true);
  });
});

describe("подписи струггла", () => {
  it("на каждый тег есть непустая подпись", () => {
    for (const tag of STRUGGLE_TAGS) {
      expect(STRUGGLE_LABEL[tag]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run (из `bjj-companion/`): `npx vitest run src/lib/bjj/struggle.test.ts`
Expected: FAIL — `Failed to resolve import "./struggle"`.

- [ ] **Step 3: Добавить тип в `types.ts`**

В `bjj-companion/src/lib/bjj/types.ts` рядом с `Intensity` (строка 33) добавить строку:

```ts
export type StruggleTag = "grip" | "base" | "timing" | "reaction" | "unsure";
```

В интерфейсе `DiaryEntry` (после `caughtBy?` — строка 129) добавить поле:

```ts
  caughtBy?: number[];       // «Чем поймали»: сабмишены соперника (id техник)
  struggle?: StruggleTag;    // «Что не получилось?»: single-select диагностика (необязательно)
```

- [ ] **Step 4: Создать `struggle.ts`**

Создать `bjj-companion/src/lib/bjj/struggle.ts`:

```ts
import type { Intensity, StruggleTag } from "./types";

// Диагностика «Что не получилось?»: единый источник тегов, подписей и гейта показа
// для формы дневника и экрана награды. Необязательно, без XP.

export const STRUGGLE_TAGS: StruggleTag[] = ["grip", "base", "timing", "reaction", "unsure"];

export const STRUGGLE_LABEL: Record<StruggleTag, string> = {
  grip: "Захват",
  base: "База/поза",
  timing: "Угол/тайминг",
  reaction: "Реакция партнёра",
  unsure: "Не уверен",
};

// Гейт: вопрос виден только при сигнале сопротивления (был спарринг) —
// поймали, задана интенсивность или есть раунды. Быстрый лог его не получает.
export function showStruggle(draft: {
  caught: number[];
  intensity: Intensity | null;
  rounds: number;
}): boolean {
  return draft.caught.length > 0 || draft.intensity !== null || draft.rounds > 0;
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/struggle.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Коммит**

```bash
git add bjj-companion/src/lib/bjj/types.ts bjj-companion/src/lib/bjj/struggle.ts bjj-companion/src/lib/bjj/struggle.test.ts
git commit -m "feat(diary): тип StruggleTag и модуль диагностики struggle.ts с гейтом showStruggle"
```

---

### Task 2: Прокидка `struggle` в награду (`reward.ts`)

**Files:**
- Modify: `bjj-companion/src/lib/bjj/reward.ts` (интерфейс `EntryReward` + `computeEntryReward`)
- Test: `bjj-companion/src/lib/bjj/reward.test.ts` (добавить кейсы)

**Interfaces:**
- Consumes: `StruggleTag` из `./types`; `entry.struggle` во входе `computeEntryReward`.
- Produces: `EntryReward.struggle?: StruggleTag` — уже отфильтровано (не `unsure`, иначе `undefined`). Экран награды рендерит «акцент» только при непустом значении.

- [ ] **Step 1: Добавить падающие тесты в `reward.test.ts`**

В конце `bjj-companion/src/lib/bjj/reward.test.ts` добавить блок:

```ts
describe("computeEntryReward: акцент диагностики", () => {
  it("struggle (не unsure) прокидывается в награду", () => {
    const r = reward({ entry: { date: "2026-07-15", techniqueIds: [1], struggle: "grip" } });
    expect(r.struggle).toBe("grip");
  });

  it("unsure не даёт акцента", () => {
    const r = reward({ entry: { date: "2026-07-15", techniqueIds: [1], struggle: "unsure" } });
    expect(r.struggle).toBeUndefined();
  });

  it("без диагностики — undefined", () => {
    const r = reward();
    expect(r.struggle).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/lib/bjj/reward.test.ts`
Expected: FAIL — `r.struggle` is undefined в первом кейсе (поле ещё не возвращается) / тип не знает `struggle`.

- [ ] **Step 3: Реализовать прокидку в `reward.ts`**

В `bjj-companion/src/lib/bjj/reward.ts` импорт типов (строка 5) дополнить `StruggleTag`:

```ts
import type { DiaryEntry, Frequency, StruggleTag, Technique } from "./types";
```

В интерфейс `EntryReward` (строки 38-42) добавить поле:

```ts
export interface EntryReward {
  week: PlanSlot | DaysSlot;
  stat?: StatSlot;
  defense?: DefenseSlot;
  struggle?: StruggleTag; // акцент диагностики «Что не получилось?» (не unsure)
}
```

В `computeEntryReward` перед `return { week, stat, defense };` (строка 127) добавить вычисление и вернуть поле:

```ts
  // Акцент: эхо диагностики «Что не получилось?» на экране награды. «Не уверен» акцента не даёт.
  const struggle: StruggleTag | undefined =
    entry.struggle && entry.struggle !== "unsure" ? entry.struggle : undefined;

  return { week, stat, defense, struggle };
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/lib/bjj/reward.test.ts`
Expected: PASS (существующие + 3 новых).

- [ ] **Step 5: Коммит**

```bash
git add bjj-companion/src/lib/bjj/reward.ts bjj-companion/src/lib/bjj/reward.test.ts
git commit -m "feat(diary): reward прокидывает struggle (акцент) в экран награды"
```

---

### Task 3: Форма дневника, карточка «акцент», телеметрия, SQL

**Files:**
- Modify: `bjj-companion/src/lib/bjj/telemetry.ts` (union `+ "struggle_logged"`)
- Modify: `bjj-companion/src/routes/diary.tsx` (импорты, стейт, reset/startAdd/startEdit, save, чипы)
- Modify: `bjj-companion/src/components/bjj/EntryReward.tsx` (карточка «акцент»)
- Create: `bjj-companion/docs/sql/2026-07-31-telemetry-diary.sql`

**Interfaces:**
- Consumes: `STRUGGLE_TAGS`, `STRUGGLE_LABEL`, `showStruggle` из `struggle.ts`; `StruggleTag` из `types`; `EntryReward.struggle` из `reward.ts`; `track("struggle_logged", tag)`.

- [ ] **Step 1: Добавить событие в union телеметрии**

В `bjj-companion/src/lib/bjj/telemetry.ts` в конец union `TelemetryEvent` (строки 34-36) добавить строку. Было:

```ts
  | "workout_theme"
  | "gap_shown"
  | "coach_shown";
```

Стало:

```ts
  | "workout_theme"
  | "gap_shown"
  | "coach_shown"
  | "struggle_logged";
```

- [ ] **Step 2: Импорты в `diary.tsx`**

В `bjj-companion/src/routes/diary.tsx` строку 16 (импорт типов) дополнить `StruggleTag`:

```ts
import type { Group, Intensity, StruggleTag, Technique } from "@/lib/bjj/types";
```

После строки 16 добавить импорт модуля диагностики:

```ts
import { STRUGGLE_TAGS, STRUGGLE_LABEL, showStruggle } from "@/lib/bjj/struggle";
```

- [ ] **Step 3: Стейт + сброс/старт/редактирование**

В `diary.tsx` после `const [injury, setInjury] = useState("");` (строка 65) добавить:

```ts
  const [struggle, setStruggle] = useState<StruggleTag | null>(null);
```

В `resetForm` (после `setInjury("");`, строка 80) добавить: `setStruggle(null);`
В `startAdd` (после `setInjury("");`, строка 98) добавить: `setStruggle(null);`
В `startEdit` (после `setInjury(e.injury ?? "");`, строка 129) добавить: `setStruggle(e.struggle ?? null);`

- [ ] **Step 4: Сохранение — payload + телеметрия**

В `diary.tsx::save` перед `const payload = {` (строка 185) добавить вычисление (гейт защищает от «осиротевшего» struggle, если сигнал сопротивления убрали):

```ts
    const struggleOut = showStruggle({ caught, intensity, rounds }) ? struggle ?? undefined : undefined;
```

В объект `payload` после `caughtBy: caught.length > 0 ? caught : undefined,` (строка 193) добавить:

```ts
      struggle: struggleOut,
```

В ветке новой записи после `if (caught.length > 0) track("caught_logged");` (строка 222) добавить:

```ts
      if (struggleOut) track("struggle_logged", struggleOut);
```

- [ ] **Step 5: Чипы «Что не получилось?» в форме**

В `diary.tsx` между блоком пикера «Чем тебя поймали?» (закрывающий `</div>` на строке 380) и `<textarea` заметки (строка 382) вставить (стиль кнопок как у «Интенсивности» — единый вид):

```tsx
          {/* Диагностика: показывается только при сигнале сопротивления (был спарринг) */}
          {showStruggle({ caught, intensity, rounds }) && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Что не получилось?</span>
              <div className="flex flex-wrap gap-1.5">
                {STRUGGLE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setStruggle((v) => (v === tag ? null : tag))}
                    className="rounded-full border-2 px-3 py-1 text-xs font-medium transition-all"
                    style={{
                      borderColor: struggle === tag ? "var(--color-primary)" : "var(--color-border)",
                      background: struggle === tag ? "color-mix(in oklch, var(--color-primary) 10%, transparent)" : "transparent",
                    }}
                  >
                    {STRUGGLE_LABEL[tag]}
                  </button>
                ))}
              </div>
            </div>
          )}

```

- [ ] **Step 6: Карточка «акцент» на экране награды**

В `bjj-companion/src/components/bjj/EntryReward.tsx` импорт иконок (строка 10) дополнить `Target`:

```ts
import { CalendarDays, Dumbbell, Flame, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
```

После импорта иконок (строка 10) добавить импорт подписей:

```ts
import { STRUGGLE_LABEL } from "@/lib/bjj/struggle";
```

В каскаде карточек, после блока `{defense && (...)}` (закрывается на строке 214, перед `</div>` на 215) добавить карточку акцента (тон primary, как у стата/защиты):

```tsx
        {reward.struggle && (
          <div className={CARD} style={cardDelay(idx++)}>
            <div className="flex items-start gap-2.5">
              <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">В следующий раз акцент</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{STRUGGLE_LABEL[reward.struggle]}</p>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 7: SQL белого списка телеметрии**

Создать `bjj-companion/docs/sql/2026-07-31-telemetry-diary.sql` (полный текущий whitelist + `struggle_logged`; `landed_logged` из секции C добавится, когда её построим):

```sql
-- Расширение белого списка телеметрии: struggle_logged
-- (диагностика дневника «Что не получилось?»; detail = grip|base|timing|reaction|unsure).
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
    'reverse_search', 'workout_theme', 'gap_shown', 'coach_shown',
    'struggle_logged'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Что не получилось (распределение по тегам):
-- select detail, count(*) from public.bjj_events
-- where event = 'struggle_logged' group by detail order by count(*) desc;
```

- [ ] **Step 8: Полный прогон тестов + сборка + типы**

Run (из `bjj-companion/`):
```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: vitest — все зелёные (включая новые struggle/reward); tsc — без ошибок; build — успешно.

- [ ] **Step 9: Рантайм-проверка через DOM (превью)**

Запустить превью (конфиг «bjj-companion» из КОРНЕВОГО `.claude/launch.json`, порт 8080), открыть `/diary`, форму новой записи. Проверять через `read_page`/`javascript_tool` (скриншоты формы работают, но DOM надёжнее):
- быстрый лог (дата + техника, без «поймали»/интенсивности/раундов): блока «Что не получилось?» НЕТ;
- добавить сабмишен в «Чем тебя поймали?»: блок появляется; клик по тегу выделяет один (single-select), повторный клик снимает;
- открыть «Подробнее», задать раунды при пустом «поймали»: блок тоже появляется;
- сохранить с выбранным тегом (не «Не уверен»): на экране награды есть карточка «В следующий раз акцент: <подпись>»;
- сохранить с «Не уверен»: карточки акцента НЕТ;
- обе темы (светлая/тёмная): чипы читаемы, выделение видно.

- [ ] **Step 10: Коммит**

```bash
git add bjj-companion/src/lib/bjj/telemetry.ts bjj-companion/src/routes/diary.tsx bjj-companion/src/components/bjj/EntryReward.tsx bjj-companion/docs/sql/2026-07-31-telemetry-diary.sql
git commit -m "feat(diary): диагностика «Что не получилось?» — чипы в форме, акцент на награде, телеметрия"
```

---

## Self-Review

**1. Spec coverage (секция B спеки):**
- Single-select чипы 5 тегов — Task 3 Step 5. ✓
- Гейт caught/intensity/rounds — Task 1 (`showStruggle`) + применён в Task 3 Steps 4-5. ✓
- Размещение после «поймали», перед заметкой, не в «Подробнее» — Task 3 Step 5. ✓
- Необязательно, не блокирует save, без XP — struggle не влияет на `disabled` кнопки (осталась `picked.length === 0`), XP-модуль не тронут. ✓
- `DiaryEntry.struggle` пишется в save, предзаполняется при редактировании — Task 1 (тип) + Task 3 Steps 3-4. ✓
- «Акцент» на награде при заданном и не unsure — Task 2 (фильтр) + Task 3 Step 6. ✓
- Телеметрия `struggle_logged` (detail=тег) — Task 3 Steps 1, 4, 7. ✓
- Данные техник не меняются; caughtBy/защиты/генератор не тронуты — ни один шаг их не касается. ✓

**2. Placeholder scan:** плейсхолдеров нет; весь код и SQL приведены целиком.

**3. Type consistency:** `StruggleTag` определён в Task 1, используется одинаково в `struggle.ts`, `reward.ts`, `diary.tsx`, `EntryReward.tsx`. `showStruggle` — одна сигнатура, вызывается с `{ caught, intensity, rounds }` в форме и в save. `EntryReward.struggle` — одно имя поля, производится в Task 2, читается в Task 3 Step 6.
