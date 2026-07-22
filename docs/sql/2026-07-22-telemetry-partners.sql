-- Расширение белого списка телеметрии: события гейта согласия и партнёров.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Только create or replace функции bjj_track — таблица bjj_events уже есть
-- (docs/sql/2026-07-18-telemetry.sql). Приватность прежняя: имя события +
-- короткая метка + device_id, без содержимого.
--
-- Новые события: consent (detail 'accept'; локальный режим ничего не шлёт,
-- поэтому 'local'/отказ серверно не измеряются — это плата за уважение к согласию),
-- invite_created / invite_accepted / partner_opened (воронка партнёров).

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
    'consent', 'invite_created', 'invite_accepted', 'partner_opened'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;
