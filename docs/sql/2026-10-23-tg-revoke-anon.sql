-- 2026-10-23: аудит, закрываем IDOR напоминаний бота.
-- bjj_tg_report / bjj_tg_set_muted / bjj_tg_set_pause принимали p_tg от кого угодно с anon-ключом.
-- Теперь их зовут только сервер: /api/tg-report (tg id из подписи initData) и вебхук (сервисный ключ).
-- Функции в public по умолчанию исполняемы для PUBLIC, поэтому отзываем и у него.

revoke execute on function public.bjj_tg_report(bigint,uuid,smallint,date,smallint,date,int[],date) from public, anon, authenticated;
revoke execute on function public.bjj_tg_set_muted(bigint,boolean) from public, anon, authenticated;
revoke execute on function public.bjj_tg_set_pause(bigint,date) from public, anon, authenticated;

grant execute on function public.bjj_tg_report(bigint,uuid,smallint,date,smallint,date,int[],date) to service_role;
grant execute on function public.bjj_tg_set_muted(bigint,boolean) to service_role;
grant execute on function public.bjj_tg_set_pause(bigint,date) to service_role;

-- проверка: anon и authenticated должны получить false во всех строках
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_exec
from pg_proc p cross join (values ('anon'),('authenticated'),('service_role')) as r(rolname)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('bjj_tg_report','bjj_tg_set_muted','bjj_tg_set_pause')
order by 1, 2;
