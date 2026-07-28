# Retention Loop — TodayAction + консолидация (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Вывести движок `insights.ts` на «Мою игру»: один блок «3 минуты сегодня» (`primaryAction` + раскрытие «что ещё»), заменяющий 4 отдельных реко-блока.

**Architecture:** Клиентский `computeInsights` в `progress.tsx` (после гидратации, `new Date()` только на клиенте) -> `<TodayAction insights={...} />`. Удаляем 4 блока + инлайновый repeat-stale/catchers/focus. Телеметрия `insight_shown/click`.

**Tech Stack:** React 19, TanStack Router, Tailwind, vitest (юнит-тестов у UI нет — проверка рантаймом/DOM).

**Спека:** [2026-07-27-retention-loop-design.md](../specs/2026-07-27-retention-loop-design.md). Опирается на Plan 1 (движок, в main).

## Global Constraints
- Без эмодзи и em-dash; комментарии по-русски.
- Инсайты считать ТОЛЬКО после гидратации (`profileHydrated && diaryHydrated`), иначе `[]` (SSR: `new Date()` дал бы mismatch).
- Не менять данные; движок не трогаем (Plan 1 готов).

---

### Task 1: События телеметрии `insight_shown` / `insight_click`

**Files:**
- Modify: `src/lib/bjj/telemetry.ts` (union `TelemetryEvent`)
- Create: `docs/sql/2026-07-27-telemetry-insights.sql`

- [ ] **Step 1: Добавить в union `TelemetryEvent`** две строки: `| "insight_shown"` и `| "insight_click"` (рядом с `"reco_click"`).
- [ ] **Step 2: SQL whitelist** — создать `docs/sql/2026-07-27-telemetry-insights.sql` с `alter`/`create or replace` по образцу прошлых telemetry-SQL, добавляющим `'insight_shown','insight_click'` в белый список `bjj_track` (применяет пользователь).
- [ ] **Step 3: Проверка** — `npx tsc --noEmit` (union расширен, вызовы `track("insight_shown", ...)` появятся в Task 2/3). Пока просто убедиться, что файл компилируется.
- [ ] **Step 4: Коммит** — `git add src/lib/bjj/telemetry.ts docs/sql/2026-07-27-telemetry-insights.sql && git commit -m "telemetry: события insight_shown/insight_click"`

---

### Task 2: Компонент `TodayAction.tsx`

**Files:**
- Create: `src/components/bjj/TodayAction.tsx`

**Interfaces:**
- Consumes: `Insight`, `InsightKind` из `@/lib/bjj/insights`; `TECH_BY_ID`; `TechniqueRow`; `buttonClass`; `track`.
- Produces: `export function TodayAction({ insights }: { insights: Insight[] })`.

- [ ] **Step 1: Создать компонент** `src/components/bjj/TodayAction.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import { TechniqueRow } from "@/components/bjj/TechniqueCard";
import { buttonClass } from "@/components/bjj/ui";
import { TECH_BY_ID } from "@/lib/bjj/data";
import { track } from "@/lib/bjj/telemetry";
import type { Insight, InsightKind } from "@/lib/bjj/insights";

// Блок «3 минуты сегодня»: герой = primaryAction, ниже — раскрытие «что ещё».
// Консолидирует прежние реко-блоки в одно ранжированное действие.

const CTA: Record<InsightKind, string> = {
  "cold-start": "Записать тренировку",
  "catcher-defense": "Разобрать защиту",
  "review-shown": "Разобрать показанное",
  "repeat-stale": "Повторить",
  plan: "Записать тренировку",
  "learn-next": "Открыть",
};

// Навигация инсайта: есть техника -> её карточка; иначе -> запись в дневник.
function linkProps(ins: Insight) {
  const id = ins.techniqueIds[0];
  if (id != null) return { to: "/technique/$id" as const, params: { id: String(id) } };
  return { to: "/diary" as const, search: { add: true } };
}

export function TodayAction({ insights }: { insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const primary = insights[0] ?? null;
  const rest = insights.slice(1);

  useEffect(() => {
    if (primary) track("insight_shown", primary.kind);
  }, [primary?.kind]);

  if (!primary) return null;
  const heroTech = primary.techniqueIds[0] != null ? TECH_BY_ID[primary.techniqueIds[0]] : null;

  return (
    <div className="space-y-2">
      <section className="rounded-2xl border-2 border-ring/50 bg-primary/5 p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
          <Clock className="h-3.5 w-3.5" /> Сегодня · 3 минуты
        </p>
        <p className="mb-3 text-[15px] font-semibold">{primary.reason}</p>
        {heroTech && (
          <div className="mb-3">
            <TechniqueRow technique={heroTech} inset />
          </div>
        )}
        <Link
          {...linkProps(primary)}
          onClickCapture={() => track("insight_click", primary.kind)}
          className={buttonClass("primary", "md", "w-full")}
        >
          {CTA[primary.kind]}
        </Link>
      </section>

      {rest.length > 0 && (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
          >
            <span className="text-sm text-muted-foreground">Что ещё сегодня</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {rest.length}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </button>
          {open && (
            <ul className="border-t border-border px-2 pb-2 pt-1">
              {rest.map((ins) => (
                <li key={ins.kind + ins.techniqueIds.join(",")}>
                  <Link
                    {...linkProps(ins)}
                    onClickCapture={() => track("insight_click", ins.kind)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-muted"
                  >
                    <span className="flex-1">{ins.reason}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверка** — `npx tsc --noEmit` без ошибок в `TodayAction.tsx`.
- [ ] **Step 3: Коммит** — `git add src/components/bjj/TodayAction.tsx && git commit -m "insights: компонент TodayAction (3 минуты сегодня)"`

---

### Task 3: Интеграция в `progress.tsx` + удаление 4 блоков

**Files:**
- Modify: `src/routes/progress.tsx`

- [ ] **Step 1: Импорты** — добавить `import { computeInsights } from "@/lib/bjj/insights";` и `import { TodayAction } from "@/components/bjj/TodayAction";`. Удалить более не нужные: `ReviewShownBlock`, `currentFocus`, `nextToLearn` (см. ниже — `recommendations`/`focusTech` уходят), `topCatchers`, `defensesFor`, `TechniqueChip`, иконки `Target, Flag, History, ShieldAlert, ArrowRight`. Оставить: `Link`, `track`, `buttonClass` (нужны в YourStyle/GapCard), `TechniqueRow`, `ChevronDown` (Характеристики).

- [ ] **Step 2: Вычислить инсайты** — после блока `today` (стр.~155) добавить:

```tsx
const insights = useMemo(
  () =>
    profileHydrated && diaryHydrated
      ? computeInsights({
          entries, progress, reviewed, belt: profile.belt, goal: profile.goal,
          gi: profile.gi, noGi: profile.noGi, frequency: profile.frequency,
          techniques: TECHNIQUES, today: new Date(),
        })
      : [],
  [entries, progress, reviewed, profile.belt, profile.goal, profile.gi, profile.noGi, profile.frequency, profileHydrated, diaryHydrated],
);
```

- [ ] **Step 3: Удалить мёртвые useMemo** — `focusTech` (стр.61), `recommendations` (62-70), `catchers` (86-94), `staleTechniques` (98-116). (`styleScores`, `statScores`, `doneCount`, `stats`, `listTechniques`, `level` — остаются.)

- [ ] **Step 4: Заменить JSX блоки** — вместо `<ReviewShownBlock />` (стр.217) поставить `<TodayAction insights={insights} />`. Удалить целиком: секцию FocusCard (222-238), секцию «Что тебя ловит» (241-279), секцию «Пора повторить» (282-310). `<PartnersBlock />` оставить (идёт после TodayAction). Удалить подкомпонент `FocusCard` (489-536) — больше не используется.

- [ ] **Step 5: Проверка сборки** — `npx tsc --noEmit` (в `progress.tsx` без новых ошибок — особенно неиспользуемых импортов) и `npx vitest run` (148 зелёных, юнит-тесты UI не трогали).

- [ ] **Step 6: Рантайм-проверка** (превью, DOM — скриншоты этого приложения таймаутят):
  - `preview_start {name:"bjj-companion"}`; профиль `{belt:"blue",onboardingDone:true,consentChoice:"accepted",consentVersion:2}` в localStorage + записи дневника со свежим `caughtBy` (напр. `{date: сегодня, techniqueIds:[], caughtBy:[31,31]}`), чтобы сработал catcher-defense.
  - Проверить: на «Моей игре» есть один блок «Сегодня · 3 минуты» с primaryAction; старых 4 блоков нет; «Что ещё сегодня» раскрывается; тап по действию ведёт на карточку/дневник.

- [ ] **Step 7: Коммит + деплой** — `git add src/routes/progress.tsx && git commit -m "insights: TodayAction на Моей игре, консолидация 4 реко-блоков"`; затем деплой (`npx vercel --prod --yes --scope ivankhr`) + curl прод + DOM-проверка (гейт-обход как обычно).

---

## Дальше (Plan 3)
Утренний пуш выходного «3 минуты повторить»: новый kind в `tgRemind.decide()` (+тест) + слот крона `api.tg-cron.ts`; web_app-кнопка ведёт на экран с TodayAction.
