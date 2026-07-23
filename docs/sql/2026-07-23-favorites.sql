-- Избранные техники: колонка favorites_data в bjj_progress + событие телеметрии.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Приватность прежняя: favorites_data — только id техник по user_id (как notes_data);
-- событие favorite_toggle — имя + technique_id + device_id, без содержимого.

alter table public.bjj_progress
  add column if not exists favorites_data jsonb;

-- Whitelist телеметрии: добавлено favorite_toggle (detail = technique_id)
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
    'favorite_toggle'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;
