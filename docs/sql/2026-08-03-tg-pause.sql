-- Пауза тренировок: бот молчит, пока paused_until в будущем.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
-- ВАЖНО: применить ДО деплоя клиента. Иначе клиент шлёт p_paused_until, а старая
-- 7-арг RPC его не примет — отчёты напоминаний молча встанут (fire-and-forget, catch).
-- Дополняет docs/sql/2026-07-22-tg-training-days.sql.

-- 1. Колонка (null = не на паузе; дата = молчим по неё включительно;
--    без-срочная пауза = сентинел 2099-12-31)
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
