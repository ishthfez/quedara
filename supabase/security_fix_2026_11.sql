-- =====================================================================
--  إصلاحات أمنية (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى (آخر شيء)، وهو آمن للتكرار.
--  مهم: إن أعدت تنفيذ programs.sql أو intensive.sql أو tarbawi.sql أو temp_accounts.sql أو transfers.sql
--  أو absence_proof.sql أو gmanager_role.sql أو schema.sql لاحقًا فأعد تنفيذ هذا الملف بعدها، لأنها تعيد النسخ القديمة.
-- =====================================================================

-- 1) حقل الصورة: صور مضمّنة فقط (data:image/...;base64)، فلا يمكن حقن كود عبره.
--    NOT VALID: يُطبَّق على كل كتابة جديدة دون فحص الصفوف الموجودة الآن.
alter table public.members drop constraint if exists members_photo_safe;
alter table public.members add constraint members_photo_safe
  check (photo is null or photo = '' or photo ~ '^data:image/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$') not valid;

-- 2) الدوال الداخلية للبرامج: لا تُستدعى من الواجهة، وكانت متاحة لأي مستخدم مسجَّل
--    (إرسال إشعار لأي عضو، تزوير سجل البرنامج، قراءة نتائج طالب آخر).
--    تبقى تعمل داخل الدوال الأخرى لأنها SECURITY DEFINER تعمل بصلاحية مالكها.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'prog_me', 'prog_root', 'prog_is_org', 'prog_can_decide', 'prog_can_see_student', 'prog_log_add',
             'prog_itqan_latest', 'prog_juz_count', 'prog_prev_best', 'prog_msg', 'prog_notify',
             'prog_entry_halaqa', 'prog_can_score',
             'crs_course', 'crs_is_group_teacher', 'crs_can_daily', 'crs_can_weekly', 'crs_can_see',
             'tar_unit_ok') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 3) الحساب المؤقت: علامة temp/course/temp_until لا يضعها إلا المدير أو دالة crs_temp_member نفسها.
--    كان من يملك «تعديل الطالب» ويكون منظم دورة يستطيع وسم طالب حقيقي بها ثم تغيير كلمة مروره من admin-users.

-- 3أ) حارس تعديل الأعضاء: نسخة transfers.sql كما هي + منع تعديل مفاتيح الحساب المؤقت
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if coalesce(current_setting('app.qtr', true), '') = '1' then return new; end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  /* مفاتيح الحساب المؤقت: من crs_temp_member وحدها */
  if coalesce(current_setting('app.qtemp', true), '') <> '1' then
    if tg_op = 'INSERT' then
      if new.info ?| array['temp', 'course', 'temp_until'] then raise exception 'غير مصرح بإنشاء حساب مؤقت من هنا'; end if;
    else
      foreach k in array array['temp', 'course', 'temp_until'] loop
        if (old.info -> k) is distinct from (new.info -> k) then raise exception 'غير مصرح بتعديل %', k; end if;
      end loop;
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'student' and (new.user_id is not null or new.login_email is not null) then raise exception 'غير مصرح'; end if;
    return new;
  end if;
  if old.role <> 'student' and new.role <> 'student' then return new; end if;   -- مثل تعديل المعلم ملفه
  /* حساب الدخول ونوع العضو: للمدير وحده دائمًا */
  if new.role is distinct from old.role or new.user_id is distinct from old.user_id or new.login_email is distinct from old.login_email then
    raise exception 'غير مصرح بتعديل حساب الطالب';
  end if;
  /* كل ما في الاستمارة (الاسم والهاتف والفئة والبيانات والصورة والحلقة) */
  if public.has_perm('students.edit') then return new; end if;
  if replace(coalesce(new.name, ''), ' ', '') <> replace(coalesce(old.name, ''), ' ', '')
     or coalesce(new.phone, '') <> coalesce(old.phone, '') or coalesce(new.cat, 'child') <> coalesce(old.cat, 'child')
     or coalesce(new.extra, '{}'::jsonb) <> coalesce(old.extra, '{}'::jsonb) or new.photo is distinct from old.photo then
    raise exception 'غير مصرح بتعديل بيانات الطالب';
  end if;
  if new.halaqa_id is distinct from old.halaqa_id and not public.has_perm('students.move') then raise exception 'غير مصرح بنقل الطالب'; end if;
  for k in select jsonb_object_keys(coalesce(old.info, '{}'::jsonb) || coalesce(new.info, '{}'::jsonb)) loop
    if (old.info -> k) is distinct from (new.info -> k) then
      if k in ('status', 'statusDate') and public.has_perm('students.status') then continue; end if;
      if k in ('fee', 'feeCat', 'feeSys', 'feeDisc', 'feeDiscVal', 'feeDiscType') and public.has_perm('fees.amount') then continue; end if;
      raise exception 'غير مصرح بتعديل %', k;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members for each row execute function public.members_guard();

-- 3ب) crs_temp_member: نسخة temp_accounts.sql كما هي + إذن للحارس داخل هذه العملية وحدها
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
  perform set_config('app.qtemp', '1', true);
  insert into members (role, name, phone, info)
  values ('student', trim(e.ext ->> 'name') || ' (مؤقت)', coalesce(e.ext ->> 'phone', ''),
          jsonb_build_object('temp', true, 'course', e.course_id, 'temp_until', (till + 7)::text, 'status', '', 'guardian', e.ext ->> 'guardian', 'age', e.ext ->> 'age'))
  returning id into nid;
  perform set_config('app.qtemp', '', true);
  update course_entries set student_id = nid, data = data || jsonb_build_object('temp_member', true, 'temp_until', (till + 7)::text) where id = eid;
  perform public.prog_log_add(e.course_id, null, 'temp_member', jsonb_build_object('entry', eid, 'until', till + 7));
  return nid;
end $$;

-- 3ج) prog_temp_ok: يشترط أيضًا أن الحساب أنشأته crs_temp_member فعلًا (مسجَّل في course_entries)
--     فلا يكفي وسم طالب حقيقي بالعلامة حتى لو وُسم قبل هذا الإصلاح.
create or replace function public.prog_temp_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.id = mid and m.role = 'student' and coalesce((m.info ->> 'temp')::boolean, false)
                 and (public.is_admin() or public.prog_is_org(nullif(m.info ->> 'course', '')::uuid))
                 and exists (select 1 from course_entries e where e.student_id = m.id
                             and e.course_id = nullif(m.info ->> 'course', '')::uuid
                             and coalesce((e.data ->> 'temp_member')::boolean, false)))
$$;
revoke all on function public.prog_temp_ok(uuid), public.crs_temp_member(uuid) from public, anon;
grant execute on function public.prog_temp_ok(uuid), public.crs_temp_member(uuid) to authenticated;

-- 4) غياب المعلمين: المشرف والمدير العام لا يسجّلون ولا يعدّلون ولا يحذفون غيابهم هم،
--    ولا يلمسون غياب شهر مرتبات مغلق. (المدير كما هو.)
create or replace function public.abs_is_mine(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pay_employees e where e.id = eid and e.member_id in (select public.my_ids()))
$$;
create or replace function public.abs_month_closed(yy int, mm int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pay_closed c where c.y = yy and c.m = mm)
$$;
revoke all on function public.abs_is_mine(uuid), public.abs_month_closed(int, int) from public, anon;
grant execute on function public.abs_is_mine(uuid), public.abs_month_closed(int, int) to authenticated;

drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated with check (
  (public.is_admin() or (public.has_role('supervisor') and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m)))
  and (by_member is null or by_member in (select public.my_ids())));
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using (public.is_admin() or (public.has_role('supervisor') and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m)))
  with check (public.is_admin() or (public.has_role('supervisor') and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m)));
drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences for delete to authenticated
  using (public.is_admin() or (by_member in (select public.my_ids()) and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m)));

drop policy if exists absences_insert_gm on public.absences;
create policy absences_insert_gm on public.absences for insert to authenticated with check (
  public.is_general_sup() and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m)
  and (by_member is null or by_member in (select public.my_ids())));
drop policy if exists absences_update_gm on public.absences;
create policy absences_update_gm on public.absences for update to authenticated
  using (public.is_general_sup() and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m))
  with check (public.is_general_sup() and not public.abs_is_mine(emp_id) and not public.abs_month_closed(y, m));

-- 5) البحث في صفحة الدخول: % و _ تُعامَل حروفًا عادية (كان «%%» يطابق كل الحسابات).
--    الأعمدة كما هي لأن الدخول يحتاج البريد؛ لإيقاف البحث كليًا: إعداد public_name_search = false.
create or replace function public.login_lookup(q text)
returns table (member_id uuid, name text, role text, login_email text)
language plpgsql stable security definer set search_path = public as $$
declare nq text := public.norm_ar(q); lq text;
begin
  if coalesce((select value #>> '{}' from settings where key = 'public_name_search'), 'true') = 'false' then return; end if;
  if length(replace(replace(coalesce(nq, ''), '%', ''), '_', '')) < 2 then return; end if;
  lq := replace(replace(replace(nq, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select m.id, m.name, m.role, m.login_email
    from members m
    where m.login_email is not null and public.norm_ar(m.name) like '%' || lq || '%'
    order by (public.norm_ar(m.name) like lq || '%') desc, m.name
    limit 8;
end $$;
revoke all on function public.login_lookup(text) from public;
grant execute on function public.login_lookup(text) to anon, authenticated;

notify pgrst, 'reload schema';
