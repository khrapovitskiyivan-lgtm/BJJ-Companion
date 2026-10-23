-- 2026-10-23: лимиты частоты для анонимных RPC (аудит безопасности перед публичным запуском).
-- bjj_track и bjj_report_player открыты anon (нужны до входа). Защита от засорения:
-- с одного устройства и суммарно, без влияния на нормальную работу (у человека событий единицы в минуту).

create index if not exists bjj_events_device_time on public.bjj_events (device_id, created_at);
create index if not exists bjj_players_created on public.bjj_players (created_at);

-- Телеметрия: белый список как в 2026-08-01-telemetry-starter.sql
-- + не больше 60 событий/мин с устройства и 3000/мин всего (спам случайными id).
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
    'struggle_logged', 'starter_open'
  ) then
    return;
  end if;
  if (select count(*) from public.bjj_events
      where device_id = p_device and created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  if (select count(*) from public.bjj_events where created_at > now() - interval '1 minute') >= 3000 then
    return;
  end if;
  insert into public.bjj_events (device_id, event, detail)
  values (p_device, p_event, left(p_detail, 32));
end;
$$;

-- Статистика игроков: обновление своего пояса как раньше; новых устройств не больше 100/мин,
-- чтобы нельзя было накрутить «всего игроков» и распределение поясов потоком случайных id.
create or replace function public.bjj_report_player(p_device uuid, p_belt text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_belt not in ('white','blue','purple','brown','black') then
    return;
  end if;
  if not exists (select 1 from public.bjj_players where device_id = p_device)
     and (select count(*) from public.bjj_players where created_at > now() - interval '1 minute') >= 100 then
    return;
  end if;
  insert into public.bjj_players (device_id, belt)
  values (p_device, p_belt)
  on conflict (device_id) do update
    set belt = excluded.belt, updated_at = now();
end;
$$;
