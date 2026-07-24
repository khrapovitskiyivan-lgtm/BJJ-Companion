-- Расширение белого списка телеметрии: level_up (переход уровня XP-экономики).
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Только create or replace функции bjj_track (таблица bjj_events уже есть).
-- Список ниже — полный текущий whitelist (включая favorite_toggle из
-- docs/sql/2026-07-23-favorites.sql) + новое level_up. Приватность прежняя:
-- имя события + короткая метка (detail = новый уровень) + device_id.

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
    'favorite_toggle', 'level_up'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Распределение уровней игроков:
-- select detail as level, count(*) from public.bjj_events
-- where event = 'level_up' group by detail order by level::int;
