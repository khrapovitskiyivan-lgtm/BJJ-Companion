-- Партнёры: флаг паузы в публичном профиле. Партнёр видит «на паузе», а не «отстаёт».
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
-- ВАЖНО: применить ДО деплоя клиента. Иначе новый p_paused отклонится 14-арг RPC,
-- публикация профилей партнёров молча встанет (как было с p_level, память п.29).
-- Дополняет docs/sql/2026-07-22-partners.sql и 2026-07-24-partners-level.sql.

-- 1. Колонка
alter table public.bjj_partner_profiles
  add column if not exists paused boolean not null default false;

-- 2. publish +p_paused (снять 14-арг, создать 15-арг)
drop function if exists public.bjj_partner_publish(
  bigint, uuid, text, text, text, boolean, boolean, text, jsonb, date, smallint, smallint, smallint, smallint
);
create or replace function public.bjj_partner_publish(
  p_tg bigint, p_device uuid, p_name text, p_photo text, p_belt text,
  p_gi boolean, p_nogi boolean, p_style text, p_stats jsonb, p_week_start date,
  p_week_done smallint, p_quota smallint, p_streak smallint, p_level smallint,
  p_paused boolean
) returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if p_tg is null or p_tg <= 0 then return null; end if;
  if p_belt is not null and p_belt not in ('white','blue','purple','brown','black') then p_belt := null; end if;
  select ref_code into v_code from public.bjj_partner_profiles where tg_user_id = p_tg;
  if v_code is null then
    loop
      v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
      exit when not exists (select 1 from public.bjj_partner_profiles where ref_code = v_code);
    end loop;
  end if;
  insert into public.bjj_partner_profiles (
    tg_user_id, ref_code, device_id, name, photo_url, belt, gi, nogi, style, stats,
    week_start, week_done, quota, week_streak, level, paused, consent_at
  ) values (
    p_tg, v_code, p_device, p_name, p_photo, p_belt,
    coalesce(p_gi, true), coalesce(p_nogi, true), p_style, coalesce(p_stats, '{}'::jsonb),
    p_week_start, least(greatest(coalesce(p_week_done, 0), 0), 14), p_quota, coalesce(p_streak, 0),
    greatest(coalesce(p_level, 1), 1), coalesce(p_paused, false), now()
  )
  on conflict (tg_user_id) do update set
    device_id=excluded.device_id, name=excluded.name, photo_url=excluded.photo_url,
    belt=excluded.belt, gi=excluded.gi, nogi=excluded.nogi, style=excluded.style,
    stats=excluded.stats, week_start=excluded.week_start, week_done=excluded.week_done,
    quota=excluded.quota, week_streak=excluded.week_streak, level=excluded.level,
    paused=excluded.paused, updated_at=now();
  return v_code;
end; $$;
revoke all on function public.bjj_partner_publish(bigint,uuid,text,text,text,boolean,boolean,text,jsonb,date,smallint,smallint,smallint,smallint,boolean) from public;
grant execute on function public.bjj_partner_publish(bigint,uuid,text,text,text,boolean,boolean,text,jsonb,date,smallint,smallint,smallint,smallint,boolean) to service_role;

-- 3. list возвращает paused (сигнатура не меняется — чистый replace)
create or replace function public.bjj_partner_list(p_tg bigint)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t.name), '[]'::json)
  from (
    select p.tg_user_id, p.name, p.photo_url, p.belt, p.gi, p.nogi, p.style, p.stats,
           p.week_start, p.week_done, p.quota, p.week_streak, p.level, p.paused
    from public.bjj_partners e
    join public.bjj_partner_profiles p
      on p.tg_user_id = case when e.a_tg = p_tg then e.b_tg else e.a_tg end
    where p_tg in (e.a_tg, e.b_tg)
  ) t;
$$;
