-- Глобальная статистика игроков + облачный прогресс.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> вставить -> Run.

-- 1. Облачная синхронизация прогресса (таблица, которую уже ждёт store.ts)
create table if not exists public.bjj_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bjj_progress enable row level security;
drop policy if exists "bjj_progress_own" on public.bjj_progress;
create policy "bjj_progress_own" on public.bjj_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Игроки для глобальной статистики: одна строка на устройство (device_id из приложения)
create table if not exists public.bjj_players (
  device_id uuid primary key,
  belt text not null check (belt in ('white','blue','purple','brown','black')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bjj_players enable row level security;
-- Прямого доступа к таблице нет ни у кого: только функции ниже (security definer).

-- 3. Регистрация/обновление игрока (приложение вызывает при загрузке и смене пояса)
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
  insert into public.bjj_players (device_id, belt)
  values (p_device, p_belt)
  on conflict (device_id) do update
    set belt = excluded.belt, updated_at = now();
end;
$$;

-- 4. Глобальная статистика: всего игроков + распределение по поясам
create or replace function public.bjj_global_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'players', (select count(*) from public.bjj_players),
    'belts', (
      select coalesce(json_object_agg(belt, cnt), '{}'::json)
      from (select belt, count(*) as cnt from public.bjj_players group by belt) b
    )
  );
$$;

revoke all on function public.bjj_report_player(uuid, text) from public;
revoke all on function public.bjj_global_stats() from public;
grant execute on function public.bjj_report_player(uuid, text) to anon, authenticated;
grant execute on function public.bjj_global_stats() to anon, authenticated;
