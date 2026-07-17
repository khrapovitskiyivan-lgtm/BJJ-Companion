-- Заметки к техникам: отдельная колонка в bjj_progress (вариант «б» — не толкается
-- с progress_data при синхронизации с двух устройств).
-- Выполнить один раз в Supabase: Dashboard -> SQL Editor -> New query -> Run.

alter table public.bjj_progress
  add column if not exists notes_data jsonb not null default '{}'::jsonb;
