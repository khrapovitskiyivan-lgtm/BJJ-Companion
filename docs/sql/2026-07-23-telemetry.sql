-- Расширение белого списка телеметрии: разбор показанного и холодный старт партнёров.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Только create or replace функции bjj_track (таблица bjj_events уже есть,
-- docs/sql/2026-07-18-telemetry.sql). Приватность прежняя: имя события +
-- короткая метка + device_id, без содержимого записей/заметок.
--
-- Новые события: review_opened (detail = technique_id, открыл показанное из блока),
-- review_drill (тап «В отработку»), partner_nudge (клик momentum-кнопки холодного старта).

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
    'pro_video_interest', 'review_opened', 'review_drill', 'partner_nudge'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Чтение спроса на разбор (что курировать видео первым):
-- select detail as technique_id, count(*) as opens
-- from public.bjj_events where event = 'review_opened'
-- group by detail order by opens desc;
