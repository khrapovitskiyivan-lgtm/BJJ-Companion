-- Партнёры по залу: профиль для друзей + связи + приглашения по коду.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.
--
-- Модель безопасности (вариант «надёжный»): RPC вызывает ТОЛЬКО доверенный
-- серверный роут /api/partners (Vercel), который заранее проверил подпись
-- Telegram initData ботовым токеном и передаёт сюда УЖЕ проверенный tg id.
-- Поэтому функции доступны только service_role: клиент напрямую их не зовёт,
-- подделать чужой tg id нельзя. Токен бота в этот файл НЕ попадает.
--
-- Личность партнёра = Telegram-аккаунт (tg_user_id). Недельный статус
-- (сделано/план/серия) приложение само считает локально и присылает в профиле.

-- 1. Профиль для друзей: что видят партнёры. Публикуется приложением при заходе
--    ПОСЛЕ согласия на партнёров. Содержимого дневника/заметок тут нет.
create table if not exists public.bjj_partner_profiles (
  tg_user_id  bigint primary key,
  ref_code    text unique not null,               -- короткий код для ссылки-приглашения
  device_id   uuid,                                -- связка с остальным приложением
  name        text,                                -- отображаемое имя из Telegram
  photo_url   text,                                -- аватар из Telegram (может отсутствовать)
  belt        text check (belt in ('white','blue','purple','brown','black')),
  gi          boolean not null default true,
  nogi        boolean not null default true,
  style       text,                                -- ведущий архетип (ключ стиля)
  stats       jsonb  not null default '{}'::jsonb, -- 6 характеристик: {"control":..,"guard":..,...}
  week_start  date,                                -- понедельник текущей недели
  week_done   smallint not null default 0 check (week_done between 0 and 14),
  quota       smallint,                            -- план тренировок на неделю
  week_streak smallint not null default 0,         -- серия недель в плане (planStreak, счёт приложения)
  consent_at  timestamptz,                         -- когда согласился делиться как партнёр
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.bjj_partner_profiles enable row level security;
-- Политик нет: прямого доступа ни у anon, ни у authenticated. Только функции ниже.

-- 2. Связи партнёров: неориентированная пара, канонически a_tg < b_tg (без дублей).
create table if not exists public.bjj_partners (
  a_tg       bigint not null,
  b_tg       bigint not null,
  created_at timestamptz not null default now(),
  primary key (a_tg, b_tg),
  check (a_tg < b_tg)
);
alter table public.bjj_partners enable row level security;
create index if not exists bjj_partners_b_idx on public.bjj_partners (b_tg);

-- 3. Опубликовать/обновить свой профиль, вернуть код-приглашение.
--    Вызывает /api/partners после проверки подписи и согласия.
create or replace function public.bjj_partner_publish(
  p_tg bigint,
  p_device uuid,
  p_name text,
  p_photo text,
  p_belt text,
  p_gi boolean,
  p_nogi boolean,
  p_style text,
  p_stats jsonb,
  p_week_start date,
  p_week_done smallint,
  p_quota smallint,
  p_streak smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_tg is null or p_tg <= 0 then
    return null;
  end if;
  if p_belt is not null and p_belt not in ('white','blue','purple','brown','black') then
    p_belt := null;
  end if;

  -- код генерируем один раз при первой публикации, дальше не меняем.
  -- md5(random()) достаточно: это код-приглашение, не секрет; уникальность
  -- гарантируют цикл + unique-constraint. pgcrypto не нужен (на Supabase он в
  -- схеме extensions и при search_path=public не виден).
  select ref_code into v_code from public.bjj_partner_profiles where tg_user_id = p_tg;
  if v_code is null then
    loop
      v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
      exit when not exists (select 1 from public.bjj_partner_profiles where ref_code = v_code);
    end loop;
  end if;

  insert into public.bjj_partner_profiles (
    tg_user_id, ref_code, device_id, name, photo_url, belt, gi, nogi, style, stats,
    week_start, week_done, quota, week_streak, consent_at
  ) values (
    p_tg, v_code, p_device, p_name, p_photo, p_belt,
    coalesce(p_gi, true), coalesce(p_nogi, true), p_style, coalesce(p_stats, '{}'::jsonb),
    p_week_start, least(greatest(coalesce(p_week_done, 0), 0), 14), p_quota, coalesce(p_streak, 0), now()
  )
  on conflict (tg_user_id) do update set
    device_id = excluded.device_id,
    name = excluded.name,
    photo_url = excluded.photo_url,
    belt = excluded.belt,
    gi = excluded.gi,
    nogi = excluded.nogi,
    style = excluded.style,
    stats = excluded.stats,
    week_start = excluded.week_start,
    week_done = excluded.week_done,
    quota = excluded.quota,
    week_streak = excluded.week_streak,
    updated_at = now();

  return v_code;
end;
$$;

-- 4. Принять приглашение по коду. Защита: сам себя нельзя, дважды нельзя, лимит 10.
--    Возврат: 'ok' | 'self' | 'not_found' | 'exists' | 'limit' | 'bad'.
create or replace function public.bjj_partner_accept(p_tg bigint, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target bigint;
  v_a bigint;
  v_b bigint;
  v_count_me int;
  v_count_target int;
begin
  if p_tg is null or p_tg <= 0 or p_ref is null then
    return 'bad';
  end if;

  select tg_user_id into v_target
  from public.bjj_partner_profiles
  where ref_code = upper(p_ref);

  if v_target is null then
    return 'not_found';
  end if;
  if v_target = p_tg then
    return 'self';
  end if;

  v_a := least(p_tg, v_target);
  v_b := greatest(p_tg, v_target);

  if exists (select 1 from public.bjj_partners where a_tg = v_a and b_tg = v_b) then
    return 'exists';
  end if;

  select count(*) into v_count_me from public.bjj_partners where p_tg in (a_tg, b_tg);
  select count(*) into v_count_target from public.bjj_partners where v_target in (a_tg, b_tg);
  if v_count_me >= 10 or v_count_target >= 10 then
    return 'limit';
  end if;

  insert into public.bjj_partners (a_tg, b_tg) values (v_a, v_b);
  return 'ok';
end;
$$;

-- 5. Список моих партнёров с их профилем и статусом недели.
create or replace function public.bjj_partner_list(p_tg bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(t order by t.name), '[]'::json)
  from (
    select
      p.tg_user_id, p.name, p.photo_url, p.belt, p.gi, p.nogi, p.style, p.stats,
      p.week_start, p.week_done, p.quota, p.week_streak
    from public.bjj_partners e
    join public.bjj_partner_profiles p
      on p.tg_user_id = case when e.a_tg = p_tg then e.b_tg else e.a_tg end
    where p_tg in (e.a_tg, e.b_tg)
  ) t;
$$;

-- 6. Удалить партнёра (у обоих связь одна, канонической парой).
create or replace function public.bjj_partner_remove(p_tg bigint, p_other bigint)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bjj_partners
  where a_tg = least(p_tg, p_other) and b_tg = greatest(p_tg, p_other);
$$;

-- Доступ: только service_role (вызов из доверенного роута /api/partners).
-- Ни anon, ни authenticated напрямую эти функции не зовут.
revoke all on function public.bjj_partner_publish(bigint, uuid, text, text, text, boolean, boolean, text, jsonb, date, smallint, smallint, smallint) from public;
revoke all on function public.bjj_partner_accept(bigint, text) from public;
revoke all on function public.bjj_partner_list(bigint) from public;
revoke all on function public.bjj_partner_remove(bigint, bigint) from public;
grant execute on function public.bjj_partner_publish(bigint, uuid, text, text, text, boolean, boolean, text, jsonb, date, smallint, smallint, smallint) to service_role;
grant execute on function public.bjj_partner_accept(bigint, text) to service_role;
grant execute on function public.bjj_partner_list(bigint) to service_role;
grant execute on function public.bjj_partner_remove(bigint, bigint) to service_role;
