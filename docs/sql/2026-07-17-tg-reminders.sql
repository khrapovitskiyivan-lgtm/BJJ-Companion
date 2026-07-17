-- Напоминания бота: связка Telegram-чата с планом тренировок устройства.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
-- Паттерн тот же, что у bjj_players: прямого доступа к таблице нет,
-- запись только через security definer функции; чтение — только cron
-- с service role ключом (в бандл не попадает, живёт в env Vercel).

-- 1. Чаты Telegram: одна строка на пользователя бота.
--    Данные самодекларируемые из приложения: частота и счётчик недели,
--    без содержимого дневника (какие техники — не уходит).
create table if not exists public.bjj_tg_chats (
  tg_user_id bigint primary key,          -- в личке = chat_id
  device_id uuid,                          -- связка с bjj_players
  frequency smallint check (frequency between 1 and 7),
  week_start date,                         -- понедельник недели, к которой относится week_done
  week_done smallint not null default 0 check (week_done between 0 and 14),
  last_entry date,                         -- дата последней записи дневника
  muted boolean not null default false,    -- /mute выключает напоминания
  last_ping date,                          -- когда последний раз слали напоминание (дедуп)
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bjj_tg_chats enable row level security;
-- Политик нет: anon и authenticated в таблицу напрямую не ходят.

-- 2. Отчёт приложения (вызывается из Mini App при открытии и после записи дневника)
create or replace function public.bjj_tg_report(
  p_tg bigint,
  p_device uuid,
  p_frequency smallint,
  p_week_start date,
  p_week_done smallint,
  p_last_entry date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tg is null or p_tg <= 0 then
    return;
  end if;
  insert into public.bjj_tg_chats (tg_user_id, device_id, frequency, week_start, week_done, last_entry)
  values (p_tg, p_device, p_frequency, p_week_start, least(greatest(coalesce(p_week_done, 0), 0), 14), p_last_entry)
  on conflict (tg_user_id) do update
    set device_id = excluded.device_id,
        frequency = excluded.frequency,
        week_start = excluded.week_start,
        week_done = excluded.week_done,
        last_entry = excluded.last_entry,
        updated_at = now();
end;
$$;

-- 3. /mute и /unmute из вебхука бота (upsert: могли замьютить до первого открытия приложения)
create or replace function public.bjj_tg_set_muted(p_tg bigint, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tg is null or p_tg <= 0 then
    return;
  end if;
  insert into public.bjj_tg_chats (tg_user_id, muted)
  values (p_tg, p_muted)
  on conflict (tg_user_id) do update
    set muted = excluded.muted, updated_at = now();
end;
$$;

revoke all on function public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date) from public;
revoke all on function public.bjj_tg_set_muted(bigint, boolean) from public;
grant execute on function public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date) to anon, authenticated;
grant execute on function public.bjj_tg_set_muted(bigint, boolean) to anon, authenticated;
