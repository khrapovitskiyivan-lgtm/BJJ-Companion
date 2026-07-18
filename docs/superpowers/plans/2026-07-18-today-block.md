# Блок «Сегодня» + переименование «Отработка» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Блок «Сегодня» (статус недели + кнопка «Записать в дневник») наверху /progress; раздел генератора переименован в «Отработку» во всём приложении (спек docs/superpowers/specs/2026-07-18-today-block-design.md, п.18.9).

**Architecture:** Чистая модель `todayCard.ts` (+ хелпер `daysLeftInWeek` в plan.ts) с тестами; тонкий компонент TodayCard на существующих контролах ui.tsx; форма дневника открывается search-параметром `?add` (паттерн `?s=` из situations.tsx). Переименование — механическая замена строк только в контексте генератора.

**Tech Stack:** TanStack Start/Router, React 19, Tailwind 4, vitest.

## Global Constraints

- Без эмодзи и em-dash в коде и текстах; сырой эмодзи ломает iOS (String.fromCodePoint).
- Комментарии в коде по-русски, стиль окружающего кода.
- «тренировка» = клубная (дневник/план/напоминания) — эти строки НЕ трогать; «отработка» = генератор.
- SSR-safe: не читать localStorage/Date в рендере до `hydrated`; хуки стора возвращают `hydrated`.
- meta/OG в `__root.tsx` не переименовывать (решение в спеке).
- Тесты: `npx vitest run` (сейчас 73 проходят). Сборка: `npx vite build`.
- Деплой: `npx vercel --prod --yes --scope ivankhr` из bjj-companion/, после — curl прода (уроки 3, 8).

---

### Task 1: daysLeftInWeek в plan.ts

**Files:**
- Modify: `src/lib/bjj/plan.ts` (после dayStreak, ~строка 90)
- Test: `src/lib/bjj/plan.test.ts`

**Interfaces:**
- Produces: `daysLeftInWeek(today: Date, loggedToday: boolean): number` — тренировочные дни (Пн-Сб, вс выходной) до конца недели; сегодня считается, только если записи ещё нет.

- [ ] **Step 1: Написать падающий тест** — в конец plan.test.ts:

```ts
describe("daysLeftInWeek", () => {
  it("Пн-Сб, вс выходной; сегодня считается только без записи", () => {
    expect(daysLeftInWeek(d(2026, 6, 13), false)).toBe(6); // пн, не записано
    expect(daysLeftInWeek(d(2026, 6, 13), true)).toBe(5); // пн, записано
    expect(daysLeftInWeek(d(2026, 6, 18), false)).toBe(1); // сб, не записано
    expect(daysLeftInWeek(d(2026, 6, 18), true)).toBe(0); // сб, записано
    expect(daysLeftInWeek(d(2026, 6, 19), false)).toBe(0); // вс — всегда 0
  });
});
```

Импорт: добавить `daysLeftInWeek` в import из "./plan" (строка 2).

- [ ] **Step 2: Прогнать — убедиться, что падает.** `npx vitest run src/lib/bjj/plan.test.ts` — FAIL (daysLeftInWeek is not exported).

- [ ] **Step 3: Реализация** — в plan.ts после dayStreak:

```ts
// Сколько тренировочных дней осталось в неделе. Модель недели как у напоминаний
// бота (tgRemind): тренировочные дни Пн-Сб, воскресенье всегда выходной.
// Сегодня считается, только если записи ещё нет (ещё можно потренироваться).
export function daysLeftInWeek(today: Date, loggedToday: boolean): number {
  const dow = (today.getDay() + 6) % 7; // 0=Пн .. 6=Вс
  const after = Math.max(0, 5 - dow); // тренировочные дни строго после сегодня
  return after + (dow <= 5 && !loggedToday ? 1 : 0);
}
```

- [ ] **Step 4: Прогнать — PASS.** `npx vitest run src/lib/bjj/plan.test.ts`

- [ ] **Step 5: Commit** — `git add src/lib/bjj/plan.ts src/lib/bjj/plan.test.ts && git commit -m "plan: daysLeftInWeek — остаток тренировочных дней недели (Пн-Сб)"`

---

### Task 2: чистая модель todayCard.ts

**Files:**
- Create: `src/lib/bjj/todayCard.ts`
- Test: `src/lib/bjj/todayCard.test.ts`

**Interfaces:**
- Consumes: plan.ts — `dayKey`, `trainedByDate`, `weekDays`, `weekStatus`, `planStreak`, `dayStreak`, `daysLeftInWeek`; types — `DiaryEntry`, `Frequency`.
- Produces: `todayCardModel(entries: DiaryEntry[], frequency: Frequency | undefined, today: Date): TodayCardModel`, где `TodayCardModel = { loggedToday: boolean; week?: { done: number; quota: number; over: number; daysLeft: number }; weeksStreak: number; daysStreakNoPlan: number }`. `week` есть только при заданной частоте; `weeksStreak` — planStreak (UI показывает при >= 2); `daysStreakNoPlan` — dayStreak, только без частоты.

- [ ] **Step 1: Тест** — `src/lib/bjj/todayCard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { todayCardModel } from "./todayCard";
import type { DiaryEntry } from "./types";

function entry(date: string): DiaryEntry {
  return { id: date, date, techniqueIds: [1] };
}
// 16 июля 2026 — четверг; неделя 13-19 июля
const today = new Date(2026, 6, 16);

describe("todayCardModel", () => {
  it("без частоты: дневной стрик, week отсутствует", () => {
    const m = todayCardModel([entry("2026-07-15"), entry("2026-07-16")], undefined, today);
    expect(m.loggedToday).toBe(true);
    expect(m.week).toBeUndefined();
    expect(m.daysStreakNoPlan).toBe(2);
  });

  it("частота 3, сегодня не записано: done/quota/daysLeft", () => {
    const m = todayCardModel([entry("2026-07-13"), entry("2026-07-14")], 3, today);
    expect(m.loggedToday).toBe(false);
    expect(m.week).toEqual({ done: 2, quota: 3, over: 0, daysLeft: 3 }); // чт+пт+сб
    expect(m.daysStreakNoPlan).toBe(0);
  });

  it("квота перевыполнена: over и серия недель", () => {
    const m = todayCardModel(
      ["2026-07-06", "2026-07-07", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"].map(entry),
      2,
      today,
    );
    expect(m.week).toEqual({ done: 4, quota: 2, over: 2, daysLeft: 2 }); // пт+сб
    expect(m.weeksStreak).toBe(2); // прошлая неделя 2/2 + текущая добита
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (модуля нет). `npx vitest run src/lib/bjj/todayCard.test.ts`

- [ ] **Step 3: Реализация** — `src/lib/bjj/todayCard.ts`:

```ts
import type { DiaryEntry, Frequency } from "./types";
import { dayKey, trainedByDate, weekDays, weekStatus, planStreak, dayStreak, daysLeftInWeek } from "./plan";

// Модель блока «Сегодня» на «Моей игре»: статус недели по плану из частоты.
// Чистая функция — «сегодня» параметром (тестируемость, SSR-безопасность).

export interface TodayCardModel {
  loggedToday: boolean;
  // Строка недели — только при заданной частоте
  week?: { done: number; quota: number; over: number; daysLeft: number };
  weeksStreak: number; // недель в плане подряд (UI показывает при >= 2)
  daysStreakNoPlan: number; // дневной стрик — только без частоты
}

export function todayCardModel(
  entries: DiaryEntry[],
  frequency: Frequency | undefined,
  today: Date,
): TodayCardModel {
  const trained = trainedByDate(entries);
  const loggedToday = trained.has(dayKey(today));
  if (!frequency) {
    return { loggedToday, weeksStreak: 0, daysStreakNoPlan: dayStreak(trained, today) };
  }
  const ws = weekStatus(weekDays(today), trained, frequency, today);
  return {
    loggedToday,
    week: { done: ws.done, quota: ws.quota, over: ws.over, daysLeft: daysLeftInWeek(today, loggedToday) },
    weeksStreak: planStreak(trained, frequency, today),
    daysStreakNoPlan: 0,
  };
}
```

- [ ] **Step 4: Прогнать — PASS**, затем весь пакет: `npx vitest run` (все зелёные).

- [ ] **Step 5: Commit** — `git add src/lib/bjj/todayCard.ts src/lib/bjj/todayCard.test.ts && git commit -m "todayCard: чистая модель блока «Сегодня»"`

---

### Task 3: компонент TodayCard + монтаж на /progress

**Files:**
- Create: `src/components/bjj/TodayCard.tsx`
- Modify: `src/routes/progress.tsx` (импорт + одна строка после PageHeader, строка ~125)

**Interfaces:**
- Consumes: `todayCardModel` (Task 2); `buttonClass` из ui.tsx; `useDiary`/`useProfile` из store (оба возвращают `hydrated`).
- Produces: `<TodayCard />` без пропсов. Ссылка кнопки: `/diary?add=true` (search-параметр из Task 4).

- [ ] **Step 1: Компонент** — `src/components/bjj/TodayCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { NotebookPen, Flame, CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/bjj/ui";
import { useDiary, useProfile } from "@/lib/bjj/store";
import { todayCardModel } from "@/lib/bjj/todayCard";

// Блок «Сегодня» наверху «Моей игры»: статус недели по плану и кнопка записи.
// Кнопка всегда про дневник (клубную тренировку) — генератор здесь не упоминается,
// чтобы не путать с «Отработкой». После записи за сегодня кнопка исчезает.

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function TodayCard() {
  const { entries, hydrated: diaryHydrated } = useDiary();
  const { profile, hydrated: profileHydrated } = useProfile();
  // До гидратации не рендерим: new Date() и localStorage-данные только на клиенте
  if (!diaryHydrated || !profileHydrated) return null;

  const today = new Date();
  const m = todayCardModel(entries, profile.frequency, today);
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" }).format(today);

  // Сегменты квоты: изученная часть синим статусом, сверхплановые золотом
  const segments: string[] = [];
  if (m.week) {
    const total = Math.max(m.week.quota, m.week.done);
    for (let i = 0; i < total; i++) {
      segments.push(
        i >= m.week.quota ? "var(--brand-gold)" : i < m.week.done ? "var(--status-progress)" : "var(--color-muted)",
      );
    }
  }

  return (
    <section
      className="rounded-2xl border bg-card p-4"
      style={{ borderColor: m.loggedToday ? "var(--color-border)" : "var(--color-primary)" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Сегодня</p>
        {m.loggedToday ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--status-done)" }}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            записано
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        )}
      </div>

      {m.week ? (
        <>
          <p className="mt-2 text-sm font-semibold">
            На этой неделе {m.week.done} из {m.week.quota}
          </p>
          <div className="mt-2 flex gap-1">
            {segments.map((bg, i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: bg }} />
            ))}
          </div>
          {m.week.done >= m.week.quota ? (
            <p className="mt-1.5 text-xs font-medium" style={{ color: m.week.over > 0 ? "var(--brand-gold-ink)" : "var(--status-done)" }}>
              {m.week.over > 0 ? `План недели закрыт, +${m.week.over} сверх плана` : "План недели закрыт"}
            </p>
          ) : m.week.daysLeft > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              До плана {m.week.quota - m.week.done} {plural(m.week.quota - m.week.done, "тренировка", "тренировки", "тренировок")},
              {" "}осталось {m.week.daysLeft} {plural(m.week.daysLeft, "день", "дня", "дней")}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Воскресенье — выходной</p>
          )}
        </>
      ) : m.daysStreakNoPlan > 0 ? (
        <p className="mt-2 text-sm font-semibold">
          {m.daysStreakNoPlan} {plural(m.daysStreakNoPlan, "день", "дня", "дней")} подряд
        </p>
      ) : null}

      {m.weeksStreak >= 2 && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--brand-gold-ink)" }}>
          <Flame className="h-3.5 w-3.5" />
          {m.weeksStreak} {plural(m.weeksStreak, "неделя", "недели", "недель")} в плане подряд
        </p>
      )}

      {!m.loggedToday && (
        <Link to="/diary" search={{ add: true }} className={buttonClass("primary", "md", "mt-3 w-full")}>
          <NotebookPen className="h-4 w-4" />
          Записать в дневник
        </Link>
      )}
    </section>
  );
}
```

Строка «Воскресенье — выходной» с « — » — это UI-текст, длинное тире в строковых данных
в проекте уже принято (тексты бота в api.tg-webhook.ts); запрет em-dash касается комментариев и ответов.

- [ ] **Step 2: Монтаж** — в `src/routes/progress.tsx`: импорт `import { TodayCard } from "@/components/bjj/TodayCard";` рядом с GapCard (строка ~5); в JSX сразу после `<PageHeader ... />` (строка ~125) вставить `<TodayCard />`.

- [ ] **Step 3: Сборка и рантайм.** `npx vite build` — зелёная. Дев-превью (preview_start, launch.json уже есть): /progress показывает блок между шапкой и hero; кнопка ведёт на /diary (параметр пока игнорируется — форма откроется после Task 4). Проверить обе темы (тумблер в шапке).

- [ ] **Step 4: Commit** — `git add src/components/bjj/TodayCard.tsx src/routes/progress.tsx && git commit -m "Моя игра: блок «Сегодня» — статус недели и запись в дневник (п.18.9)"`

---

### Task 4: /diary?add — форма сразу открыта

**Files:**
- Modify: `src/routes/diary.tsx` (Route ~строка 28, компонент Diary ~строки 40-124)

**Interfaces:**
- Consumes: `startAdd()` уже есть в Diary (строка 82).
- Produces: заход на `/diary?add=true` открывает форму новой записи; параметр сразу вычищается replace-ом (назад не переоткрывает).

- [ ] **Step 1: validateSearch** — заменить определение Route:

```tsx
export const Route = createFileRoute("/diary")({
  // ?add=true — сразу открытая форма новой записи (кнопка «Записать в дневник» на «Моей игре»)
  validateSearch: (search: Record<string, unknown>): { add?: boolean } => ({
    add: search.add ? true : undefined,
  }),
  component: DiaryPage,
});
```

- [ ] **Step 2: Эффект в Diary** — после объявления `startAdd` (~строка 99) добавить:

```tsx
  const { add } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Вход с ?add: открыть форму и вычистить параметр (replace — «назад» не переоткрывает)
  useEffect(() => {
    if (add) {
      startAdd();
      navigate({ search: {}, replace: true });
    }
  }, [add]); // eslint-disable-line react-hooks/exhaustive-deps
```

Хуки Route.useSearch/useNavigate работают внутри Diary (Route определён в этом же файле — паттерн situations.tsx).

- [ ] **Step 3: Рантайм.** В превью: с /progress тап «Записать в дневник» — на /diary форма открыта, URL без ?add; browser back с /diary возвращает на /progress (не переоткрывая форму). Полный цикл: сохранить запись — экран награды; вернуться на /progress — блок в состоянии «записано», кнопки нет.

- [ ] **Step 4: Commit** — `git add src/routes/diary.tsx && git commit -m "Дневник: ?add открывает форму записи (вход из блока «Сегодня»)"`

---

### Task 5: переименование «Тренировка» -> «Отработка» (контекст генератора)

**Files:**
- Modify: `src/components/bjj/BottomNav.tsx:7,12`, `src/routes/workout.tsx:68-69,125-126,293`, `src/components/bjj/WorkoutRunner.tsx:10,48,58`, `src/components/bjj/GapCard.tsx:69`, `src/routes/about.tsx:46`, `src/components/bjj/Onboarding.tsx:162`, `src/routes/api.tg-webhook.ts:14,33,45,61-62`, `src/lib/i18n.ts:11`

**Interfaces:** нет новых; только строки. Дневниковые «тренировки» НЕ трогать (в т.ч. workout.tsx:229, workout.ts:163, about.tsx:42,57, api.tg-webhook.ts:15,22,32,65, Onboarding частота/цель).

- [ ] **Step 1: Правки** (старое -> новое, точные строки):
  - BottomNav.tsx:12 `label: "Тренировка"` -> `label: "Отработка"`; коммент :7 `4 Тренировка (генератор/сценарии)` -> `4 Отработка (генератор/сценарии)`.
  - workout.tsx:68 `kicker="Тренировка"` -> `kicker="Отработка"`; :69 `"Умная тренировка"` -> `"Умная отработка"`; :293 `Запустить тренировку` -> `Запустить отработку`; комменты :125-126 `сгенерированной тренировки` -> `сгенерированной отработки`, `перегенерировало бы тренировку` -> `перегенерировало бы отработку`.
  - WorkoutRunner.tsx:48 `К плану тренировки` -> `К плану отработки`; :58 `Тренировка завершена` -> `Отработка завершена`; коммент :10 `Раннер сгенерированной тренировки` -> `Раннер сгенерированной отработки`; :12 `в конце тренировки` -> `в конце отработки`.
  - GapCard.tsx:69 `Собрать тренировку по дневнику` -> `Собрать отработку по дневнику`.
  - about.tsx:46 `title="Тренировка"` -> `title="Отработка"` (текст :47 не трогать — слова «тренировка» в нём нет).
  - Onboarding.tsx:162 `title: "Умные тренировки"` -> `title: "Умная отработка"` (описание :163 оставить).
  - api.tg-webhook.ts:14 `"/train — готовая тренировка"` -> `"/train — готовая отработка"`; :33 `"Тренировка — готовый комплекс по профилю или по дневнику, с таймером и звуком."` -> `"Отработка — готовый комплекс по профилю или по дневнику, с таймером и звуком."`; :45 `умный генератор тренировок` -> `готовые отработки с таймером`; :61 `Готовая тренировка уже собрана` -> `Готовая отработка уже собрана`; :62 `appButton("Открыть тренировку", "/workout")` -> `appButton("Открыть отработку", "/workout")`.
  - i18n.ts:11 `workout: "Тренировка"` -> `workout: "Отработка"`.

- [ ] **Step 2: Контроль полноты.** `grep -rn "тренир" src --include="*.tsx" --include="*.ts" -i | grep -i "workout\|generator\|runner\|отраб"` — глазами убедиться, что в генераторном контексте «тренировок» не осталось (дневниковые остаются).

- [ ] **Step 3: Сборка + рантайм.** `npx vite build`; в превью пройтись: нижняя навигация («Отработка»), /workout (кикер, тайтл, кнопка запуска), раннер (запустить, выйти — обе строки), «Моя игра» -> Разрыв («Собрать отработку по дневнику»), /about (карточка «Отработка»).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "Терминология: генератор — «Отработка», тренировка — только клубная (п.18.9)"`

---

### Task 6: полный прогон, прод, setMyCommands, CLAUDE.md

**Files:**
- Modify: `../CLAUDE.md` (п.18.9 -> СДЕЛАНО, зонтичный репо)

- [ ] **Step 1: Полный vitest + сборка.** `npx vitest run` (все, включая новые), `npx vite build`.

- [ ] **Step 2: Рантайм-матрица в превью** (урок 2): /progress оба состояния блока (без записи; после добавления записи за сегодня — «записано», без кнопки), обе темы; цикл кнопка -> форма -> сохранение -> награда -> назад.

- [ ] **Step 3: Деплой.** `npx vercel --prod --yes --scope ivankhr`; после — curl прод-страницы и клиентского чанка: строка «Записать в дневник» есть в ассетах (кириллицу искать в клиентских чанках, не в SSR-HTML — урок п.18.5), «Отработка» в бандле.

- [ ] **Step 4: setMyCommands.** Токен из `.env.local` (TELEGRAM_BOT_TOKEN). Сначала `getMyCommands` — снять текущий список; затем перерегистрировать тот же список с новым описанием /train («готовая отработка»). Кириллицу слать файлом через Bash curl (`--data @file`, Content-Type application/json; консоль отдаёт не UTF-8 — урок п.13):

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN .env.local | cut -d= -f2)
curl -s "https://api.telegram.org/bot$TOKEN/getMyCommands"
```

Ожидаемый состав (сверить с выводом getMyCommands; если текущий список другой — сохранить его состав, поменяв ТОЛЬКО описание train). Файл cmds.json писать инструментом Write в scratchpad (UTF-8 без BOM):

```json
{"commands":[
  {"command":"help","description":"как пользоваться"},
  {"command":"about","description":"что это за приложение"},
  {"command":"train","description":"готовая отработка"},
  {"command":"diary","description":"отметить тренировку"},
  {"command":"mute","description":"выключить напоминания"},
  {"command":"unmute","description":"включить напоминания"}
]}
```

```bash
curl -s -X POST "https://api.telegram.org/bot$TOKEN/setMyCommands" -H "Content-Type: application/json" --data @<путь к cmds.json>
```

Ожидаемо: `{"ok":true,"result":true}`, повторный getMyCommands показывает новое описание.

- [ ] **Step 5: CLAUDE.md + коммиты.** В зонтичном CLAUDE.md: п.18.9 -> СДЕЛАНО с датой и сутью (блок «Сегодня», ?add, переименование, setMyCommands). Коммит обоих репо, пуш bjj-companion в GitHub (для истории; авто-деплой сломан — прод уже выпущен вручную).
