-- ============ الحساب المؤقت للطالب الخارجي في الدورة المكثفة (intensive.js) ============
-- يُنشئ المنظم للطالب الخارجي سجل طالب باسم «فلان (مؤقت)» (info.temp = true، info.course، info.temp_until = نهاية الدورة + 7 أيام)،
-- ثم يُنشئ له حساب دخول عبر دالة admin-users (التي تسمح لغير المدير بهذا النوع فقط بشرط prog_temp_ok).
-- بعد الانتهاء: crs_temp_expire يعلّمه «منقطع» (فيمنعه is_blocked) ويعيد من له حساب دخول، فتحذفه الواجهة (remove).
-- آمن للتكرار. يُنفَّذ بعد intensive.sql. (نُفِّذ على الخادم.)

create or replace function public.prog_temp_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.id = mid and m.role = 'student' and coalesce((m.info ->> 'temp')::boolean, false)
                 and (public.is_admin() or public.prog_is_org(nullif(m.info ->> 'course', '')::uuid)))
$$;

create or replace function public.crs_temp_member(eid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e course_entries; c programs; nid uuid; till date;
begin
  select * into e from course_entries where id = eid;
  if not found or not public.prog_is_org(e.course_id) then raise exception 'غير مسموح'; end if;
  if e.student_id is not null then raise exception 'للطالب الخارجي فقط'; end if;
  if e.status not in ('passed', 'accepted') then raise exception 'الحساب المؤقت بعد اجتياز التصفية'; end if;
  select * into c from programs where id = e.course_id;
  till := nullif(c.cfg ->> 'end', '')::date;
  if till is null then raise exception 'حدد تاريخ نهاية الدورة في الإعدادات أولًا'; end if;
  insert into members (role, name, phone, info)
  values ('student', trim(e.ext ->> 'name') || ' (مؤقت)', coalesce(e.ext ->> 'phone', ''),
          jsonb_build_object('temp', true, 'course', e.course_id, 'temp_until', (till + 7)::text, 'status', '', 'guardian', e.ext ->> 'guardian', 'age', e.ext ->> 'age'))
  returning id into nid;
  update course_entries set student_id = nid, data = data || jsonb_build_object('temp_member', true, 'temp_until', (till + 7)::text) where id = eid;
  perform public.prog_log_add(e.course_id, null, 'temp_member', jsonb_build_object('entry', eid, 'until', till + 7));
  return nid;
end $$;

create or replace function public.crs_temp_expire() returns table (member_id uuid, has_login boolean)
language plpgsql security definer set search_path = public as $$
begin
  update members m set info = m.info || jsonb_build_object('status', 'منقطع')
  where m.role = 'student' and coalesce((m.info ->> 'temp')::boolean, false) and nullif(m.info ->> 'temp_until', '')::date < current_date
    and coalesce(m.info ->> 'status', '') <> 'منقطع' and public.prog_temp_ok(m.id);
  return query select m.id, m.user_id is not null from members m
    where m.role = 'student' and coalesce((m.info ->> 'temp')::boolean, false) and nullif(m.info ->> 'temp_until', '')::date < current_date
      and m.user_id is not null and public.prog_temp_ok(m.id);
end $$;

revoke all on function public.prog_temp_ok(uuid), public.crs_temp_member(uuid), public.crs_temp_expire() from public, anon;
grant execute on function public.prog_temp_ok(uuid), public.crs_temp_member(uuid), public.crs_temp_expire() to authenticated;
notify pgrst, 'reload schema';
