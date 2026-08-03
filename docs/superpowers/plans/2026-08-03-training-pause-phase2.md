# Пауза тренировок — Фаза 2 (бот молчит) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пока пользователь на паузе, бот НЕ шлёт напоминаний («план под угрозой»/soft/итог), а из чата паузу можно поставить/снять командами `/pause` `/resume`.

**Architecture:** Новая колонка `paused_until date` в `bjj_tg_chats` (null = не на паузе; дата = молчим по неё включительно; без-срочная пауза = сентинел `2099-12-31`). Клиент синхронизирует её через существующий RPC `bjj_tg_report` (+параметр `p_paused_until`), вычисляя значение чистым `pausedUntilForBot(pauses, todayKey)`. `decide()` в самом начале молчит, если `todayIso <= paused_until`. Команды `/pause`/`/resume` в вебхуке зовут новый RPC `bjj_tg_set_pause` (паттерн `bjj_tg_set_muted`).

**Tech Stack:** TypeScript, TanStack Start server routes (Vercel), Supabase RPC (SQL), vitest.

## Global Constraints

- Без эмодзи и em-dash. Комментарии на русском.
- SQL применяет ПОЛЬЗОВАТЕЛЬ вручную в Supabase (нет DDL-доступа у агента). SQL постить ИНЛАЙНОМ в чат готовым sql-блоком (память feedback-sql-inline). **SQL применить ДО деплоя клиента** (как с training_days: старая 7-арг RPC отклонит новый `p_paused_until`, отчёты молча встанут).
- Env-переменные (TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, CRON_SECRET) уже заданы на Vercel.
- `paused_until` — строка/date; сравнение ISO-дат yyyy-mm-dd лексикографическое.
- Опираемся на Фазу 1 (`pause.ts::activePause`, поле `profile.pauses`) — она влита в main.
- Тесты: `npx vitest run`. Деплой (`npx vercel --prod --yes --scope ivankhr`) — по слову владельца.

---

### Task 1: SQL — колонка `paused_until`, RPC `bjj_tg_report`(+param), `bjj_tg_set_pause`

**Files:**
- Create: `docs/sql/2026-08-03-tg-pause.sql` (для истории; применяет пользователь инлайном)

**Deliverable:** применённый в Supabase SQL. Это не тестируется кодом — Task 3/4 полагаются на колонку и 8-арг RPC.

- [ ] **Step 1: Записать SQL в файл (история) и выдать пользователю инлайном**

Создать `docs/sql/2026-08-03-tg-pause.sql` со следующим содержимым и ОТДЕЛЬНО вставить этот же блок в чат пользователю готовым ```sql-блоком:

```sql
-- Пауза тренировок: бот молчит, пока paused_until в будущем.
-- Применить ДО деплоя клиента (иначе новый p_paused_until отклонится старой RPC).

-- 1. Колонка (null = не на паузе)
alter table public.bjj_tg_chats add column if not exists paused_until date;

-- 2. bjj_tg_report +p_paused_until (снять 7-арг, создать 8-арг)
drop function if exists public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date, int[]);
create or replace function public.bjj_tg_report(
  p_tg bigint, p_device uuid, p_frequency smallint, p_week_start date,
  p_week_done smallint, p_last_entry date,
  p_training_days int[] default '{0,1,2,3,4,5}', p_paused_until date default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tg is null or p_tg <= 0 then return; end if;
  insert into public.bjj_tg_chats
    (tg_user_id, device_id, frequency, week_start, week_done, last_entry, training_days, paused_until)
  values (p_tg, p_device, p_frequency, p_week_start,
     least(greatest(coalesce(p_week_done,0),0),14), p_last_entry,
     coalesce(p_training_days,'{0,1,2,3,4,5}'), p_paused_until)
  on conflict (tg_user_id) do update
    set device_id=excluded.device_id, frequency=excluded.frequency,
        week_start=excluded.week_start, week_done=excluded.week_done,
        last_entry=excluded.last_entry, training_days=excluded.training_days,
        paused_until=excluded.paused_until, updated_at=now();
end; $$;
revoke all on function public.bjj_tg_report(bigint,uuid,smallint,date,smallint,date,int[],date) from public;
grant execute on function public.bjj_tg_report(bigint,uuid,smallint,date,smallint,date,int[],date) to anon, authenticated;

-- 3. set_pause: /pause -> дата (сентинел для без-срока), /resume -> null
create or replace function public.bjj_tg_set_pause(p_tg bigint, p_until date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tg is null or p_tg <= 0 then return; end if;
  insert into public.bjj_tg_chats (tg_user_id, paused_until) values (p_tg, p_until)
  on conflict (tg_user_id) do update set paused_until = excluded.paused_until, updated_at = now();
end; $$;
revoke all on function public.bjj_tg_set_pause(bigint, date) from public;
grant execute on function public.bjj_tg_set_pause(bigint, date) to anon, authenticated;
```

- [ ] **Step 2: Дождаться подтверждения применения от пользователя, затем коммит файла**

```bash
git add docs/sql/2026-08-03-tg-pause.sql
git commit -m "docs(sql): пауза бота (paused_until + bjj_tg_report param + bjj_tg_set_pause)"
```

---

### Task 2: Чистый хелпер `pausedUntilForBot`

**Files:**
- Modify: `src/lib/bjj/pause.ts`
- Test: `src/lib/bjj/pause.test.ts`

**Interfaces:**
- Consumes: `activePause` (Фаза 1).
- Produces: `pausedUntilForBot(pauses: PausePeriod[] | undefined, todayKey: string): string | null` — дата для сервера: `until` активной паузы, сентинел `2099-12-31` для без-срочной, `null` если не на паузе.

- [ ] **Step 1: Падающий тест (дописать в pause.test.ts)**

```ts
import { activePause, isPausedOn, weekOverlapsPause, pausedUntilForBot } from "./pause";

describe("pausedUntilForBot", () => {
  it("не на паузе -> null", () => {
    expect(pausedUntilForBot(undefined, "2026-08-10")).toBeNull();
  });
  it("без срока -> сентинел 2099-12-31", () => {
    expect(pausedUntilForBot([{ from: "2026-08-03" }], "2026-08-10")).toBe("2099-12-31");
  });
  it("с датой -> сама дата", () => {
    expect(pausedUntilForBot([{ from: "2026-08-03", until: "2026-08-20" }], "2026-08-10")).toBe("2026-08-20");
  });
  it("дата прошла (авто-снята) -> null", () => {
    expect(pausedUntilForBot([{ from: "2026-08-03", until: "2026-08-08" }], "2026-08-10")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/lib/bjj/pause.test.ts`
Expected: FAIL (`pausedUntilForBot` не экспортирован).

- [ ] **Step 3: Реализовать в pause.ts (в конец файла)**

```ts
// Дата паузы для сервера бота: until активной паузы; сентинел для без-срочной; null если не на паузе.
const OPEN_PAUSE_SENTINEL = "2099-12-31";
export function pausedUntilForBot(
  pauses: PausePeriod[] | undefined,
  todayKey: string,
): string | null {
  const p = activePause(pauses, todayKey);
  if (!p) return null;
  return p.until ?? OPEN_PAUSE_SENTINEL;
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run src/lib/bjj/pause.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/pause.ts src/lib/bjj/pause.test.ts
git commit -m "feat(pause): pausedUntilForBot (дата паузы для сервера бота)"
```

---

### Task 3: `decide()` молчит на паузе

**Files:**
- Modify: `src/lib/bjj/tgRemind.ts` (`TgChatRow` +поле, `decide` +проверка)
- Test: `src/lib/bjj/tgRemind.test.ts` (дописать)

**Interfaces:**
- Produces: `TgChatRow.paused_until: string | null`; `decide` возвращает `{kind:"none"}` при активной серверной паузе.

- [ ] **Step 1: Падающий тест (дописать в tgRemind.test.ts)**

Взять любую существующую строку-заготовку `TgChatRow` из теста как образец (в тестах есть базовый объект; если нет — собрать по интерфейсу). Добавить:

```ts
it("на паузе (paused_until в будущем) -> молчит даже когда план горит", () => {
  const row: TgChatRow = {
    tg_user_id: 1, frequency: 4, week_start: "2026-08-03", week_done: 0,
    last_entry: null, training_days: [0, 1, 2, 3, 4, 5], muted: false,
    last_ping: null, soft_ping_week: null, soft_ping_count: 0,
    updated_at: "2026-08-05", paused_until: "2026-08-20",
  };
  // среда, план горит, но пауза -> none
  expect(decide(row, "2026-08-05", 3, "2026-08-03")).toEqual({ kind: "none" });
});
it("пауза истекла (paused_until в прошлом) -> обычная логика", () => {
  const row: TgChatRow = {
    tg_user_id: 1, frequency: 4, week_start: "2026-08-03", week_done: 0,
    last_entry: null, training_days: [0, 1, 2, 3, 4, 5], muted: false,
    last_ping: null, soft_ping_week: null, soft_ping_count: 0,
    updated_at: "2026-08-05", paused_until: "2026-08-04",
  };
  expect(decide(row, "2026-08-05", 3, "2026-08-03").kind).toBe("remind");
});
```

(Если в существующих тестах `TgChatRow`-объекты уже собираются — добавить в них `paused_until: null`, чтобы не падала типизация. Проверить: `grep -n "updated_at:" src/lib/bjj/tgRemind.test.ts` и дописать `paused_until: null` в каждый объект.)

- [ ] **Step 2: Запустить — новые падают, старые могут падать по типу**

Run: `npx vitest run src/lib/bjj/tgRemind.test.ts`
Expected: FAIL (нет `paused_until` в типе / логика не молчит).

- [ ] **Step 3: Обновить `TgChatRow` и `decide` в tgRemind.ts**

В `interface TgChatRow` добавить поле (после `soft_ping_count`):

```ts
  paused_until: string | null; // пауза тренировок: молчим, пока todayIso <= paused_until (null = не на паузе)
```

В `decide`, сразу после `if (row.muted || !row.frequency) return { kind: "none" };`:

```ts
  if (row.paused_until && todayIso <= row.paused_until) return { kind: "none" }; // на паузе — молчим
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run src/lib/bjj/tgRemind.test.ts`
Expected: PASS (прежние + 2 новых).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/bjj/tgRemind.ts src/lib/bjj/tgRemind.test.ts
git commit -m "feat(pause): decide() молчит при активной серверной паузе"
```

---

### Task 4: Клиент шлёт `p_paused_until`

**Files:**
- Modify: `src/lib/bjj/tgReport.ts` (сигнатура + payload + hash)
- Modify: `src/components/bjj/AppShell.tsx:88` (передать `profile.pauses`)

**Interfaces:**
- Consumes: `pausedUntilForBot` (Task 2), `dayKey` (plan.ts), `activePause` косвенно.
- Produces: `reportTgPlan(frequency, entries, trainingDays?, pauses?)` шлёт `p_paused_until`.

- [ ] **Step 1: Обновить `tgReport.ts`**

Дополнить импорты:

```ts
import { pausedUntilForBot } from "./pause";
import { dayKey } from "./plan";
import type { DiaryEntry, Frequency, PausePeriod } from "./types";
```

Сигнатуру:

```ts
export function reportTgPlan(
  frequency: Frequency | undefined,
  entries: DiaryEntry[],
  trainingDays?: number[],
  pauses?: PausePeriod[],
): void {
```

В `payload` добавить поле (после `p_training_days`):

```ts
      p_paused_until: pausedUntilForBot(pauses, dayKey(new Date())),
```

В `hash`-массив добавить `payload.p_paused_until` (чтобы смена паузы форсировала отправку):

```ts
    const hash = JSON.stringify([
      payload.p_frequency,
      payload.p_week_start,
      payload.p_week_done,
      payload.p_last_entry,
      payload.p_training_days,
      payload.p_paused_until,
    ]);
```

- [ ] **Step 2: Передать `profile.pauses` из AppShell**

`src/components/bjj/AppShell.tsx` строка 88, было:

```ts
    reportTgPlan(profile.frequency, entries, profile.trainingDays);
```

Стало:

```ts
    reportTgPlan(profile.frequency, entries, profile.trainingDays, profile.pauses);
```

- [ ] **Step 3: Прогон тестов + сборка (нет регрессов)**

Run: `npx vitest run`
Expected: все зелёные.

Run: `node scripts/build-data.mjs`
Expected: OK.

- [ ] **Step 4: Коммит**

```bash
git add src/lib/bjj/tgReport.ts src/components/bjj/AppShell.tsx
git commit -m "feat(pause): reportTgPlan шлёт p_paused_until (пауза уходит на сервер бота)"
```

---

### Task 5: Команды бота `/pause` и `/resume`

**Files:**
- Modify: `src/routes/api.tg-webhook.ts` (setPause + PAUSE_REPLIES + диспетч + COMMANDS_HINT + HELP)

**Interfaces:**
- Consumes: RPC `bjj_tg_set_pause` (Task 1 SQL).
- Produces: `/pause` (без-срока = сентинел `2099-12-31`) и `/resume` (null) в чате бота.

- [ ] **Step 1: Добавить `setPause` и `PAUSE_REPLIES` (после `MUTE_REPLIES`)**

```ts
// /pause и /resume: тот же security-definer паттерн, что и mute (anon-ключ)
async function setPause(chatId: number, until: string | null): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/bjj_tg_set_pause`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_tg: chatId, p_until: until }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const PAUSE_REPLIES: Record<string, { until: string | null; ok: string; fail: string }> = {
  "/pause": {
    until: "2099-12-31",
    ok: "Поставил на паузу. Напоминания молчат, план и серия заморожены. Вернёшься — сними: /resume. Поправляйся.",
    fail: "Не получилось поставить паузу, попробуй позже.",
  },
  "/resume": {
    until: null,
    ok: "С возвращением! Пауза снята, напоминания снова активны.",
    fail: "Не получилось снять паузу, попробуй позже.",
  },
};
```

- [ ] **Step 2: Диспетч в обработчике (после блока `muteCmd`)**

В теле `POST`, после `if (chatId && muteCmd) { ... }`-блока добавить ветку (перед `else if (chatId && command === "/guide")`):

```ts
          } else if (chatId && PAUSE_REPLIES[command]) {
            const pc = PAUSE_REPLIES[command];
            const ok = await setPause(chatId, pc.until);
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: ok ? pc.ok : pc.fail }),
            });
```

(вставляется как дополнительная `else if` в существующую цепочку; следить за корректной скобочной структурой.)

- [ ] **Step 3: Добавить `/pause` в подсказку команд**

В `COMMANDS_HINT` добавить строку (после `/mute`):

```ts
  "/mute — выключить напоминания",
  "/pause — пауза (уехал, травма, перерыв)",
```

В `HELP`, в абзац про напоминания, добавить предложение:

```ts
  "Уезжаешь или травма? Поставь паузу: /pause — план и серия замрут, бот замолчит. Снять: /resume.",
```

- [ ] **Step 4: Проверка сборки роута рантаймом**

Поднять превью (`preview_start` имя `bjj-companion`, порт по `preview_logs`). Вебхук — POST-роут, в браузере не тестируется напрямую; проверить, что сборка не сломана и dev-сервер поднялся без ошибок (`preview_logs` без ошибок компиляции api.tg-webhook.ts). Живую доставку `/pause` проверяет пользователь в Telegram после деплоя.

- [ ] **Step 5: setMyCommands (зарегистрировать /pause в меню бота)**

Отдельным шагом обновить меню команд бота (кириллицу слать файлом через curl, память): добавить `{command:"pause", description:"Пауза: уехал, травма, перерыв"}` и `{command:"resume", description:"Снять паузу"}` в вызов `setMyCommands`. Выполняется по готовности (после деплоя), фиксируется как ручной шаг.

- [ ] **Step 6: Коммит**

```bash
git add src/routes/api.tg-webhook.ts
git commit -m "feat(pause): команды бота /pause и /resume"
```

---

## Self-Review

**Spec coverage (Фаза 2 из спеки):**
- Колонка `paused_until` + сентинел без-срока -> Task 1. ✓
- Клиент синхронизирует через bjj_tg_report(+p_paused_until) -> Task 1 (SQL), Task 4 (клиент). ✓
- `decide()` молчит на паузе (remind/soft/recap) -> Task 3. ✓
- Авто-снятие по дате (todayIso > paused_until -> обычная логика) -> Task 3 (проверка `<=`). ✓
- `/pause` `/resume` в вебхуке -> Task 5. ✓
- Порядок деплоя: SQL до клиента -> Global Constraints + Task 1. ✓

**Placeholder scan:** заглушек нет; SQL и код приведены. Единственная «мягкая» инструкция — Task 5 Step 2 про скобочную структуру (вставка в существующую if-цепочку) и Task 3 Step 1 про дозаполнение `paused_until: null` в существующих тест-объектах — это точечные интеграционные указания, не заглушки.

**Type consistency:** `pausedUntilForBot(pauses, todayKey): string | null` (Task 2) вызывается в tgReport (Task 4). `TgChatRow.paused_until: string | null` (Task 3) читается в `decide` и приходит из SQL-колонки (Task 1). `bjj_tg_set_pause(p_tg, p_until)` (Task 1) зовётся `setPause(chatId, until)` (Task 5). `reportTgPlan(...,pauses?)` (Task 4) вызывается из AppShell с `profile.pauses`. ✓
