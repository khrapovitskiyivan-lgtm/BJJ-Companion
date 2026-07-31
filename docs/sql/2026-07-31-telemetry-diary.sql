-- Расширение белого списка телеметрии: struggle_logged
-- (диагностика дневника «Что не получилось?»; detail = grip|base|timing|reaction|unsure).
-- Выполнить один раз в Supabase -> SQL Editor. Полный текущий whitelist + новое событие.

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
    'favorite_toggle', 'level_up', 'glossary_open',
    'insight_shown', 'insight_click',
    'reverse_search', 'workout_theme', 'gap_shown', 'coach_shown',
    'struggle_logged'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Что не получилось (распределение по тегам):
-- select detail, count(*) from public.bjj_events
-- where event = 'struggle_logged' group by detail order by count(*) desc;
