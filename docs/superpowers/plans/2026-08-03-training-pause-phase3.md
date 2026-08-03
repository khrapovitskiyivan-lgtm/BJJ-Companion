# Пауза тренировок — Фаза 3 (партнёры) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Партнёры по залу видят «на паузе» вместо «отстаёт по плану»; паузного партнёра не выносит наверх сортировка «отстающие сверху». Серия партнёра тоже заморожена.

**Architecture:** В публичный профиль партнёра (`bjj_partner_profiles`) добавляется `paused boolean`. `buildPublishInput` выводит `paused` из `activePause(profile.pauses)` и морозит показанную серию (`planStreak(..., profile.pauses)`). Публикация через существующий RPC `bjj_partner_publish` (+`p_paused`); `bjj_partner_list` возвращает `paused`. UI `PartnersBlock` рисует бейдж «на паузе» и исключает паузных из сортировки-отставания.

**Tech Stack:** TypeScript, Supabase RPC (SQL), React, vitest.

## Global Constraints

- Без эмодзи и em-dash. Комментарии на русском.
- SQL применяет ПОЛЬЗОВАТЕЛЬ вручную (нет DDL-доступа), постить ИНЛАЙНОМ готовым sql-блоком. Применить ДО деплоя клиента (иначе `p_paused` отклонится старой 14-арг RPC, публикация профилей молча встанет — как было с p_level, память п.29).
- Партнёры работают ТОЛЬКО в Telegram и облачном режиме; наружу только агрегаты (без дневника/заметок/техник) — не нарушать.
- Опирается на Фазу 1 (`pause.ts::activePause`, `profile.pauses`). Фазы 2 и 3 независимы (можно в любом порядке после Фазы 1).
- Тесты: `npx vitest run`. UI партнёров живьём проверяет владелец в Telegram (роут за подписью initData; рантайм-стаб не полноценен, память п.27.C).

---

### Task 1: SQL — `paused` в профиле партнёра, `bjj_partner_publish`(+param), `list`

**Files:**
- Create: `docs/sql/2026-08-03-partners-pause.sql` (история; применяет пользователь инлайном)

- [ ] **Step 1: Записать SQL в файл и выдать пользователю инлайном ```sql-блоком**

```sql
-- Партнёры: флаг паузы в публичном профиле. Применить ДО деплоя клиента
-- (иначе новый p_paused отклонится 14-арг RPC, публикация профилей встанет).

-- 1. Колонка
alter table public.bjj_partner_profiles
  add column if not exists paused boolean not null default false;

-- 2. publish +p_paused (снять 14-арг, создать 15-арг)
drop function if exists public.bjj_partner_publish(
  bigint, uuid, text, text, text, boolean, boolean, text, jsonb, date, smallint, smallint, smallint, smallint
);
create or replace function public.bjj_partner_publish(
  p_tg bigint, p_device uuid, p_name text, p_photo text, p_belt text,
  p_gi boolean, p_nogi boolean, p_style text, p_stats jsonb, p_week_start date,
  p_week_done smallint, p_quota smallint, p_streak smallint, p_level smallint,
  p_paused boolean
) returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if p_tg is null or p_tg <= 0 then return null; end if;
  if p_belt is not null and p_belt not in ('white','blue','purple','brown','black') then p_belt := null; end if;
  select ref_code into v_code from public.bjj_partner_profiles where tg_user_id = p_tg;
  if v_code is null then
    loop
      v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
      exit when not exists (select 1 from public.bjj_partner_profiles where ref_code = v_code);
    end loop;
  end if;
  insert into public.bjj_partner_profiles (
    tg_user_id, ref_code, device_id, name, photo_url, belt, gi, nogi, style, stats,
    week_start, week_done, quota, week_streak, level, paused, consent_at
  ) values (
    p_tg, v_code, p_device, p_name, p_photo, p_belt,
    coalesce(p_gi, true), coalesce(p_nogi, true), p_style, coalesce(p_stats, '{}'::jsonb),
    p_week_start, least(greatest(coalesce(p_week_done, 0), 0), 14), p_quota, coalesce(p_streak, 0),
    greatest(coalesce(p_level, 1), 1), coalesce(p_paused, false), now()
  )
  on conflict (tg_user_id) do update set
    device_id=excluded.device_id, name=excluded.name, photo_url=excluded.photo_url,
    belt=excluded.belt, gi=excluded.gi, nogi=excluded.nogi, style=excluded.style,
    stats=excluded.stats, week_start=excluded.week_start, week_done=excluded.week_done,
    quota=excluded.quota, week_streak=excluded.week_streak, level=excluded.level,
    paused=excluded.paused, updated_at=now();
  return v_code;
end; $$;
revoke all on function public.bjj_partner_publish(bigint,uuid,text,text,text,boolean,boolean,text,jsonb,date,smallint,smallint,smallint,smallint,boolean) from public;
grant execute on function public.bjj_partner_publish(bigint,uuid,text,text,text,boolean,boolean,text,jsonb,date,smallint,smallint,smallint,smallint,boolean) to service_role;

-- 3. list возвращает paused (сигнатура не меняется — чистый replace)
create or replace function public.bjj_partner_list(p_tg bigint)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.name), '[]'::json)
  from (
    select p.tg_user_id, p.name, p.photo_url, p.belt, p.gi, p.nogi, p.style, p.stats,
           p.week_start, p.week_done, p.quota, p.week_streak, p.level, p.paused
    from public.bjj_partners e
    join public.bjj_partner_profiles p
      on p.tg_user_id = case when e.a_tg = p_tg then e.b_tg else e.a_tg end
    where p_tg in (e.a_tg, e.b_tg)
  ) t;
$$;
```

- [ ] **Step 2: После подтверждения применения — коммит файла**

```bash
git add docs/sql/2026-08-03-partners-pause.sql
git commit -m "docs(sql): пауза в профиле партнёра (paused + publish param + list)"
```

---

### Task 2: `paused` в публикуемом профиле (типы + buildPublishInput + роут)

**Files:**
- Modify: `src/lib/bjj/partners.ts` (`PublishInput.paused`, `PartnerProfile.paused?`)
- Modify: `src/lib/bjj/partnersProfile.ts` (`buildPublishInput` — paused + заморозка серии)
- Modify: `src/routes/api.partners.ts` (publish -> `p_paused`)
- Test: `src/lib/bjj/partnersProfile.test.ts` (дописать)

**Interfaces:**
- Consumes: `activePause` (Фаза 1), `dayKey`/`planStreak` с pauses.
- Produces: `PublishInput.paused: boolean`, `PartnerProfile.paused?: boolean`, RPC-параметр `p_paused`.

- [ ] **Step 1: Типы в partners.ts**

В `PublishInput` добавить (после `level: number;`):

```ts
  paused: boolean;
```

В `PartnerProfile` добавить (после `level?: number;`):

```ts
  paused?: boolean; // партнёр на паузе (может отсутствовать до применения SQL)
```

- [ ] **Step 2: Падающий тест в partnersProfile.test.ts**

Дописать кейс (образец args взять из существующего теста файла; добавить `profile.pauses`):

```ts
it("активная пауза -> paused:true, серия заморожена", () => {
  const base = /* существующие args из соседнего теста */;
  const out = buildPublishInput({
    ...base,
    profile: { ...base.profile, frequency: 3, pauses: [{ from: "2020-01-01" }] },
    today: new Date(2026, 7, 3),
  });
  expect(out.paused).toBe(true);
});
```

(Если в тесте нет удобного `base` — собрать минимальные args по сигнатуре `buildPublishInput`: device, profile, progress:{}, practiceCount:{}, entries:[], reviewed:{}, today.)

- [ ] **Step 3: Запустить — падает**

Run: `npx vitest run src/lib/bjj/partnersProfile.test.ts`
Expected: FAIL (`out.paused` undefined).

- [ ] **Step 4: Обновить buildPublishInput**

Дополнить импорты:

```ts
import { trainedByDate, planStreak, dayKey } from "./plan";
import { activePause } from "./pause";
```

Заменить вычисление серии и вернуть paused:

```ts
  const todayKey = dayKey(today);
  const paused = activePause(profile.pauses, todayKey) != null;
  const wr = weekReport(entries, today);
  const quota = profile.frequency ?? null;
  const streak = quota ? planStreak(trainedByDate(entries), quota, today, profile.pauses) : 0;
```

В возвращаемом объекте добавить (после `level`):

```ts
    level,
    paused,
  };
```

- [ ] **Step 5: Проброс в роуте `api.partners.ts`**

В ветке `case "publish"`, в объект `callRpc("bjj_partner_publish", {...})` добавить (после `p_level`):

```ts
              p_level: (p.level as number) ?? 1,
              p_paused: (p.paused as boolean) ?? false,
```

- [ ] **Step 6: Запустить — проходит + полный прогон**

Run: `npx vitest run src/lib/bjj/partnersProfile.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: все зелёные.

- [ ] **Step 7: Коммит**

```bash
git add src/lib/bjj/partners.ts src/lib/bjj/partnersProfile.ts src/routes/api.partners.ts src/lib/bjj/partnersProfile.test.ts
git commit -m "feat(pause): paused в публикуемом профиле партнёра + заморозка серии"
```

---

### Task 3: UI партнёров — бейдж «на паузе» + сортировка

**Files:**
- Modify: `src/components/bjj/PartnersBlock.tsx` (строка партнёра ~98-132, карточка ~147-185, сортировка ~285-289)

**Interfaces:**
- Consumes: `PartnerProfile.paused` (Task 2).

- [ ] **Step 1: Прочитать регионы PartnerRow, карточки и сортировки**

Прочитать `src/components/bjj/PartnersBlock.tsx`: функцию строки партнёра (~98-132, где `{quota != null ? \`${done} из ${quota}\` : ...}` и `<WeekSegments>`), карточку партнёра (~147-185, «Эта неделя: N из Q» + серия) и `sortedPartners` (~285-289).

- [ ] **Step 2: Бейдж «на паузе» в строке партнёра**

В строке партнёра, где рисуется недельный статус (`{done} из {quota}` + `WeekSegments`), обернуть в проверку паузы: если `p.paused` — вместо статуса показать спокойный бейдж, иначе прежнее. Пример замены блока статуса:

```tsx
{p.paused ? (
  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
    на паузе
  </span>
) : (
  <>
    <span
      className="text-[11px] font-medium"
      style={{ color: met ? "var(--status-done)" : "var(--color-muted-foreground)" }}
    >
      {quota != null ? `${done} из ${quota}` : `${done} трен.`}
    </span>
    {/* ...прежний блок серии/сегментов... */}
  </>
)}
```

(Точную обёртку согласовать с фактической разметкой строки: недельный статус и `WeekSegments` спрятать при `p.paused`.)

- [ ] **Step 3: Бейдж «на паузе» в карточке партнёра**

В карточке (блок «Эта неделя: N из Q» + серия ~171-185) аналогично: при `p.paused` показать строку «На паузе» вместо «Эта неделя», скрыть серию/дефицит.

- [ ] **Step 4: Сортировка не выносит паузных наверх**

В `sortedPartners` (~285-289) в функции `met` учесть паузу (паузный считается «не отстающим», уходит вниз, как выполнивший):

```ts
        const met = (p: PartnerProfile) => (p.paused || (p.quota != null && p.week_done >= p.quota) ? 1 : 0);
```

- [ ] **Step 5: Проверка сборкой + прогон тестов**

Run: `npx vitest run`
Expected: зелёные (UI без юнитов, тесты не должны сломаться).

Поднять превью (`preview_start` `bjj-companion`, порт по `preview_logs`) — убедиться, что dev-сервер собрал PartnersBlock без ошибок компиляции (`preview_logs`). Живой вид «на паузе» проверяет владелец в Telegram (блок партнёров за `isTelegram()`), с партнёром на паузе.

- [ ] **Step 6: Коммит**

```bash
git add src/components/bjj/PartnersBlock.tsx
git commit -m "feat(pause): партнёр «на паузе» — бейдж + сортировка не как отстающий"
```

---

## Self-Review

**Spec coverage (Фаза 3 из спеки):**
- `paused` в bjj_partner_profiles + publish(+p_paused) + list -> Task 1. ✓
- buildPublishInput выводит paused + морозит серию -> Task 2. ✓
- Бейдж «на паузе» вместо недельного статуса (строка + карточка) -> Task 3. ✓
- Сортировка исключает паузных из «отстающих сверху» -> Task 3 Step 4. ✓
- Приватность (только агрегаты) не нарушена: добавлен один boolean-флаг. ✓

**Placeholder scan:** SQL и код приведены. «Мягкие» указания (Task 2 Step 2 про `base`-args, Task 3 про точную обёртку разметки) — интеграционные, требуют чтения фактического файла, не заглушки-код.

**Type consistency:** `PublishInput.paused: boolean` (Task 2) <- buildPublishInput <- api.partners `p_paused`. `PartnerProfile.paused?` читается в PartnersBlock (Task 3). RPC 15-арг сигнатура (Task 1) совпадает с проброшенными полями api.partners (Task 2 Step 5). ✓

---

## Фаза 4 (полировка, опционально — отдельным циклом)
- Контекстная кнопка «Не можешь сейчас? Поставь паузу» в блоке «Сегодня»/при «плане горит» (самое заметное в момент нужды).
- Необязательный лейбл причины (травма/отпуск/перерыв) — влияет ТОЛЬКО на тон копирайта, без медсоветов.
Не блокер; спека это уже допускает. План писать по запросу.
