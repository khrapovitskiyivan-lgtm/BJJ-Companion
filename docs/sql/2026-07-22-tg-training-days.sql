-- Напоминания бота под кастомные тренировочные дни (profile.trainingDays).
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
-- До применения: клиент шлёт p_training_days, старая 6-арг RPC его не примет и отчёт
-- будет молча пропущен (fire-and-forget, catch) — данные напоминаний перестанут
-- обновляться, пока не применишь. Поэтому применяй ДО деплоя клиента.

-- 1. Колонка тренировочных дней (0=Пн..6=Вс). Дефолт Пн-Сб — как было зашито.
alter table public.bjj_tg_chats
  add column if not exists training_days int[] not null default '{0,1,2,3,4,5}';

-- 2. RPC с новым параметром. Старую 6-арг версию убираем, чтобы не было перегрузки.
drop function if exists public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date);

create or replace function public.bjj_tg_report(
  p_tg bigint,
  p_device uuid,
  p_frequency smallint,
  p_week_start date,
  p_week_done smallint,
  p_last_entry date,
  p_training_days int[] default '{0,1,2,3,4,5}'
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
  insert into public.bjj_tg_chats
    (tg_user_id, device_id, frequency, week_start, week_done, last_entry, training_days)
  values
    (p_tg, p_device, p_frequency, p_week_start,
     least(greatest(coalesce(p_week_done, 0), 0), 14), p_last_entry,
     coalesce(p_training_days, '{0,1,2,3,4,5}'))
  on conflict (tg_user_id) do update
    set device_id = excluded.device_id,
        frequency = excluded.frequency,
        week_start = excluded.week_start,
        week_done = excluded.week_done,
        last_entry = excluded.last_entry,
        training_days = excluded.training_days,
        updated_at = now();
end;
$$;

revoke all on function public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date, int[]) from public;
grant execute on function public.bjj_tg_report(bigint, uuid, smallint, date, smallint, date, int[]) to anon, authenticated;
