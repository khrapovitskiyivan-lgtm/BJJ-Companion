-- Телеметрия событий: анонимные счётчики использования по device_id.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
-- Приватность: никакого содержимого (ни техник, ни заметок, ни записей дневника) —
-- только имя события, короткая метка detail и device_id (тот же, что в bjj_players).

create table if not exists public.bjj_events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  event text not null check (char_length(event) <= 32),
  detail text check (detail is null or char_length(detail) <= 32),
  created_at timestamptz not null default now()
);
create index if not exists bjj_events_event_time on public.bjj_events (event, created_at);
create index if not exists bjj_events_time on public.bjj_events (created_at);
alter table public.bjj_events enable row level security;
-- Прямого доступа к таблице нет ни у кого: только функция ниже (security definer).

-- Запись события. Белый список — мусор с anon-ключа не пишем.
create or replace function public.bjj_track(p_device uuid, p_event text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in (
    'app_open', 'onboarding_done', 'entry_saved', 'caught_logged', 'workout_run',
    'workout_filter', 'scenario_run', 'section_open', 'reco_click', 'note_saved'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

revoke all on function public.bjj_track(uuid, text, text) from public;
grant execute on function public.bjj_track(uuid, text, text) to anon, authenticated;

-- ГОТОВЫЕ ЗАПРОСЫ ДЛЯ ЧТЕНИЯ (SQL Editor видит таблицу напрямую):

-- События по неделям: сколько раз и сколько устройств
-- select date_trunc('week', created_at)::date as week, event, coalesce(detail, '') as detail,
--        count(*) as cnt, count(distinct device_id) as devices
-- from bjj_events group by 1, 2, 3 order by 1 desc, 4 desc;

-- Активные устройства по дням (по событию app_open)
-- select created_at::date as day, count(distinct device_id) as devices
-- from bjj_events where event = 'app_open' group by 1 order by 1 desc;

-- Конверсия онбординга: устройства с app_open vs с onboarding_done
-- select count(distinct device_id) filter (where event = 'app_open') as opened,
--        count(distinct device_id) filter (where event = 'onboarding_done') as onboarded
-- from bjj_events;

-- Популярность разделов (уникальные устройства за 30 дней)
-- select detail as section, count(distinct device_id) as devices
-- from bjj_events where event = 'section_open' and created_at > now() - interval '30 days'
-- group by 1 order by 2 desc;
