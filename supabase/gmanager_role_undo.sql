-- =====================================================================
--  التراجع عن gmanager_role.sql: يعود «المدير العام» مشرفًا نطاقه الكل كما كان، وتعود القواعد والدوال كما كانت.
--  يُنفَّذ في Supabase ← SQL Editor ← Run، ثم يُعاد تنفيذ gmanager.sql (يعيد دالة المزامنة sync_check كما كانت).
--  آمن للتكرار.
-- =====================================================================

-- 1) الحسابات: «مدير عام» ← مشرف نطاقه الكل، ثم نوع الحساب بلا gmanager
update public.members set role = 'supervisor', info = coalesce(info, '{}'::jsonb) || '{"scope":"all"}'::jsonb where role = 'gmanager';
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('admin', 'supervisor', 'teacher', 'student', 'accountant', 'placeadmin'));
drop function if exists public.gmanager_ready();

-- 2) القواعد المضافة
drop policy if exists members_read_gm on public.members;
drop policy if exists member_admin_read_gm on public.member_admin;
drop policy if exists fees_gm_read on public.fees;
drop policy if exists settings_read_gm on public.settings;
drop policy if exists coll_gm_read on public.collections;
drop policy if exists pay_settings_gm_read on public.pay_settings;
drop policy if exists pay_employees_gm_read on public.pay_employees;
drop policy if exists pay_rows_gm_read on public.pay_rows;
drop policy if exists pay_closed_gm_read on public.pay_closed;
drop policy if exists absences_read_gm on public.absences;
drop policy if exists absences_insert_gm on public.absences;
drop policy if exists absences_update_gm on public.absences;
drop policy if exists news_gm_insert on public.news;
drop policy if exists news_read_gm on public.news;

-- 3) الدوال كما كانت
create or replace function public.is_general_sup() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role = 'supervisor' and info ->> 'scope' = 'all')
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role in ('admin', 'supervisor', 'teacher', 'placeadmin'))
$$;
create or replace function public.can_manage_halaqa(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_general_sup() or exists (
    select 1 from halaqat x
    where x.id = h and (x.teacher_id in (select public.my_ids()) or x.supervisor_id in (select public.my_ids())))
$$;
create or replace function public.can_see_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s in (select public.my_ids()) or public.can_teach_student(s) or exists (
    select 1 from members st
    where st.id = s and st.role = 'student' and st.halaqa_id in (select public.my_place_halaqat()))
$$;
create or replace function public.staff_list()
returns table (id uuid, code text, name text, place text, status text, sys text)
language sql stable security definer set search_path = public as $$
  select e.id, e.code, e.name, e.place, e.status, e.sys from pay_employees e
  where public.is_admin() or public.has_role('supervisor')
  order by e.name
$$;
create or replace function public.leave_rules()
returns table (lv3 int, lv6 int)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(s.data->>'lv3', '')::numeric::int, 10), coalesce(nullif(s.data->>'lv6', '')::numeric::int, 21)
  from (select 1) x left join pay_settings s on s.id = 1
  where public.is_admin() or public.has_role('supervisor')
$$;
create or replace function public.leave_adj() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_object_agg(y.key, (
      select coalesce(jsonb_object_agg(e.key, jsonb_strip_nulls(jsonb_build_object(
        'b', case when (e.value->>'b') ~ '^-?[0-9]+(\.[0-9]+)?$' then to_jsonb((e.value->>'b')::numeric) end,
        'u', case when (e.value->>'u') ~ '^-?[0-9]+(\.[0-9]+)?$' then to_jsonb((e.value->>'u')::numeric) end))), '{}')
      from jsonb_each(case when jsonb_typeof(y.value) = 'object' then y.value else '{}' end) e
      where jsonb_typeof(e.value) = 'object'))
    from pay_settings s,
         jsonb_each(case when jsonb_typeof(s.data->'lvAdj') = 'object' then s.data->'lvAdj' else '{}' end) y
    where s.id = 1 and y.key ~ '^[0-9]{4}$'), '{}'::jsonb)
  where public.is_admin() or public.has_role('supervisor')
$$;
create or replace function public.notify_students(students uuid[], body text)
returns int language plpgsql security definer set search_path = public as $$
declare me record; s uuid; n int := 0; txt text := trim(coalesce(body, '')); ok boolean;
begin
  if length(txt) < 2 or length(txt) > 1000 then raise exception 'نص الإشعار غير صالح'; end if;
  if coalesce(array_length(students, 1), 0) = 0 or array_length(students, 1) > 2000 then raise exception 'عدد الطلاب غير صالح'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student'
    order by (role = 'admin') desc, (role = 'teacher') desc limit 1;
  if me.id is null then raise exception 'غير مصرح'; end if;
  foreach s in array students loop
    ok := public.is_admin() or public.has_perm('fees.collect') or public.can_teach_student(s)
          or (public.has_role('placeadmin') and exists (select 1 from members x where x.id = s and x.halaqa_id in (select public.my_place_halaqat())));
    if not ok or not exists (select 1 from members where id = s and role = 'student') then continue; end if;
    if exists (select 1 from news where audience = 'm:' || s::text and text = txt and date = current_date) then continue; end if;
    insert into news (text, audience, date, author_id, author)
    values (txt, 'm:' || s::text, current_date, me.id,
            (case me.role when 'accountant' then 'المحاسب' when 'teacher' then 'المعلم' when 'placeadmin' then 'الإداري'
                          when 'supervisor' then 'المشرف' else 'الإدارة' end) || ' ' || me.name);
    n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.del_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]') from (
    select id, kind, target_id, target_name, reason, requested_by, requested_name, created_at, status
    from del_requests
    where status = 'pending' and (public.is_admin() or requested_by in (select public.my_ids()))
  ) r
$$;

notify pgrst, 'reload schema';
-- بعد هذا: أعد تنفيذ gmanager.sql.
