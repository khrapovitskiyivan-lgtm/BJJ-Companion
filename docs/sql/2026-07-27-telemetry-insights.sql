-- Расширение белого списка телеметрии: insight_shown / insight_click
-- (блок «3 минуты сегодня»: detail = kind инсайта — cold-start / catcher-defense /
-- review-shown / repeat-stale / plan / learn-next). Выполнить один раз в Supabase:
-- Dashboard -> SQL Editor -> New query -> Run. Полный текущий whitelist + новые события.

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
    'insight_shown', 'insight_click'
  ) then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Что показывает/по чему кликают в «3 минуты сегодня» (какой kind — primary):
-- select detail as kind, event, count(*) from public.bjj_events
-- where event in ('insight_shown','insight_click') group by detail, event order by count(*) desc;
