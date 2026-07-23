-- Вечерний soft-пинг: счётчик мягких нуджей на неделе (кап 2/нед) в bjj_tg_chats.
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- ДО деплоя серверной части (крон читает/пишет эти колонки).

alter table public.bjj_tg_chats
  add column if not exists soft_ping_week date,
  add column if not exists soft_ping_count int not null default 0;
