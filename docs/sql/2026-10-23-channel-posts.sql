-- 2026-10-23: посты Telegram-канала тренера (@myownbjj) для карточек техник.
-- Пишет только вебхук бота (сервисный ключ); приложение читает альбомы по технике.
-- Видео, размеченные до запуска фичи, лежат в data/channel-videos.json (статично).

create table if not exists public.bjj_channel_posts (
  msg_id         bigint primary key,
  media_group_id text,
  caption        text,
  has_video      boolean not null default false,
  techniques     int[]   not null default '{}',
  posted_at      timestamptz,
  updated_at     timestamptz not null default now()
);
create index if not exists bjj_channel_posts_group on public.bjj_channel_posts (media_group_id);
alter table public.bjj_channel_posts enable row level security; -- прямого доступа нет, только RPC

create or replace function public.bjj_channel_upsert(
  p_msg bigint, p_group text, p_caption text, p_has_video boolean, p_techniques int[], p_posted_at timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into bjj_channel_posts (msg_id, media_group_id, caption, has_video, techniques, posted_at)
  values (p_msg, p_group, p_caption, coalesce(p_has_video, false), coalesce(p_techniques, '{}'), p_posted_at)
  on conflict (msg_id) do update set
    media_group_id = coalesce(excluded.media_group_id, bjj_channel_posts.media_group_id),
    caption        = excluded.caption,
    has_video      = bjj_channel_posts.has_video or excluded.has_video,
    techniques     = excluded.techniques,
    updated_at     = now();
end $$;

revoke execute on function public.bjj_channel_upsert(bigint, text, text, boolean, int[], timestamptz) from public, anon, authenticated;
grant  execute on function public.bjj_channel_upsert(bigint, text, text, boolean, int[], timestamptz) to service_role;

-- Альбомы по технике: группировка по media_group_id, ссылка на первое сообщение
create or replace function public.bjj_channel_videos(p_tech int)
returns table (post bigint, videos int, posted_at timestamptz, caption text)
language sql stable security definer set search_path = public as $$
  with g as (
    select coalesce(media_group_id, msg_id::text)             as k,
           min(msg_id)                                         as post,
           (count(*) filter (where has_video))::int            as videos,
           min(posted_at)                                      as posted_at,
           max(caption)                                        as caption,
           bool_or(p_tech = any (techniques))                  as hit
    from bjj_channel_posts
    group by 1
  )
  select post, videos, posted_at, caption from g
  where hit and videos > 0
  order by post desc
  limit 50;
$$;

revoke execute on function public.bjj_channel_videos(int) from public;
grant  execute on function public.bjj_channel_videos(int) to anon, authenticated, service_role;
