-- Расширение белого списка телеметрии: glossary_open (тап по термину словаря в
-- описании техники, detail = термин). Выполнить один раз в Supabase:
-- Dashboard -> SQL Editor -> New query -> Run. Полный текущий whitelist + новое событие.

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
    'favorite_toggle', 'level_up', 'glossary_open'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Спрос на объяснение терминов (какие термины непонятны чаще):
-- select detail as term, count(*) from public.bjj_events
-- where event = 'glossary_open' group by detail order by count(*) desc;
