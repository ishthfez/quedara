-- =====================================================================
--  «المدير العام» نوع حساب مستقل (role = 'gmanager')
--   - يطّلع على كل شيء: الحلقات والطلاب والأعضاء وحضورهم وتسميعهم، والاشتراكات والتحصيل والمرتبات،
--     وغياب العاملين، وطلبات الحذف. ولا يعدّل شيئًا من ذلك.
--   - يكتب: الإشعارات (لأي جمهور، ولطلاب بعينهم)، والملاحظات الخاصة على الطلاب (sup_notes.sql)، وغياب أي شخص.
--   - إن أُسندت إليه حلقات (halaqat.supervisor_id) فله فيها صلاحيات المشرف كاملة (الحضور والتسميع والنقل…)،
--     لأن تلك الصلاحيات مربوطة بمشرف الحلقة نفسه لا بنوع الحساب.
--   - لا إعدادات ولا صلاحيات ولا حسابات (كما كان: للمدير وحده).
--   - يُنقل إليه تلقائيًا كل «مشرف نطاقه الكل» (info.scope = 'all').
--   - التطبيق يعرض المدير العام كما كان (cloud.js يترجم النوع)، فيجب رفع النسخة الجديدة من cloud.js قبل التنفيذ.
--  التراجع: gmanager_role_undo.sql ثم إعادة تنفيذ gmanager.sql.
--  يُنفَّذ بعد sup_notes.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) نوع الحساب، ونقل المديرين العامين إليه
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('admin', 'gmanager', 'supervisor', 'teacher', 'student', 'accountant', 'placeadmin'));
update public.members set role = 'gmanager' where role = 'supervisor' and info ->> 'scope' = 'all';

-- علامة يفحصها التطبيق: الخادم يعرف النوع الجديد
create or replace function public.gmanager_ready() returns boolean language sql stable as $$ select true $$;
revoke all on function public.gmanager_ready() from public, anon;
grant execute on function public.gmanager_ready() to authenticated;

-- 2) «المدير العام» الحالي (الاسم القديم للدالة باقٍ لأن دوال كثيرة تستعملها: staff_fees و sup_notes و الإعلانات…)
create or replace function public.is_general_sup() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role = 'gmanager')
$$;

-- 3) من الطاقم (يرى أسماء العاملين)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role in ('admin', 'gmanager', 'supervisor', 'teacher', 'placeadmin'))
$$;

-- 4) الكتابة في الحلقة (الحضور والتسميع): المدير، أو معلم الحلقة أو مشرفها. لم يعد «المشرف العام» يكتب في كل الحلقات؛
--    والمدير العام يكتب في الحلقات المسندة إليه وحدها (هو مشرفها)
create or replace function public.can_manage_halaqa(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from halaqat x
    where x.id = h and (x.teacher_id in (select public.my_ids()) or x.supervisor_id in (select public.my_ids())))
$$;

-- 5) القراءة: المدير العام يرى كل الطلاب وحضورهم وتسميعهم
create or replace function public.can_see_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s in (select public.my_ids()) or public.can_teach_student(s) or public.is_general_sup() or exists (
    select 1 from members st
    where st.id = s and st.role = 'student' and st.halaqa_id in (select public.my_place_halaqat()))
$$;
drop policy if exists members_read_gm on public.members;
create policy members_read_gm on public.members for select to authenticated using (public.is_general_sup());
drop policy if exists member_admin_read_gm on public.member_admin;
create policy member_admin_read_gm on public.member_admin for select to authenticated using (public.is_general_sup());

-- 6) المالية للاطلاع: الاشتراكات وإعداداتها، وقوائم التحصيل، والمرتبات
drop policy if exists fees_gm_read on public.fees;
create policy fees_gm_read on public.fees for select to authenticated using ((select public.is_general_sup()));
drop policy if exists settings_read_gm on public.settings;
create policy settings_read_gm on public.settings for select to authenticated using (key = 'priv_fees' and public.is_general_sup());
drop policy if exists coll_gm_read on public.collections;
create policy coll_gm_read on public.collections for select to authenticated using (public.is_general_sup());
drop policy if exists pay_settings_gm_read on public.pay_settings;
create policy pay_settings_gm_read on public.pay_settings for select to authenticated using (public.is_general_sup());
drop policy if exists pay_employees_gm_read on public.pay_employees;
create policy pay_employees_gm_read on public.pay_employees for select to authenticated using (public.is_general_sup());
drop policy if exists pay_rows_gm_read on public.pay_rows;
create policy pay_rows_gm_read on public.pay_rows for select to authenticated using (public.is_general_sup());
drop policy if exists pay_closed_gm_read on public.pay_closed;
create policy pay_closed_gm_read on public.pay_closed for select to authenticated using (public.is_general_sup());

-- 7) غياب العاملين: يقرؤه ويسجّله لأي شخص (كالمشرف)
drop policy if exists absences_read_gm on public.absences;
create policy absences_read_gm on public.absences for select to authenticated using (public.is_general_sup());
drop policy if exists absences_insert_gm on public.absences;
create policy absences_insert_gm on public.absences for insert to authenticated with check (
  public.is_general_sup() and (by_member is null or by_member in (select public.my_ids())));
drop policy if exists absences_update_gm on public.absences;
create policy absences_update_gm on public.absences for update to authenticated using (public.is_general_sup()) with check (public.is_general_sup());

create or replace function public.staff_list()
returns table (id uuid, code text, name text, place text, status text, sys text)
language sql stable security definer set search_path = public as $$
  select e.id, e.code, e.name, e.place, e.status, e.sys from pay_employees e
  where public.is_admin() or public.has_role('supervisor') or public.is_general_sup()
  order by e.name
$$;
create or replace function public.leave_rules()
returns table (lv3 int, lv6 int)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(s.data->>'lv3', '')::numeric::int, 10), coalesce(nullif(s.data->>'lv6', '')::numeric::int, 21)
  from (select 1) x left join pay_settings s on s.id = 1
  where public.is_admin() or public.has_role('supervisor') or public.is_general_sup()
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
  where public.is_admin() or public.has_role('supervisor') or public.is_general_sup()
$$;

-- 8) الإشعارات: يرسلها لأي جمهور، ويقرأ ما يُرسل للمشرفين وللمديرين العامين
drop policy if exists news_gm_insert on public.news;
create policy news_gm_insert on public.news for insert to authenticated with check (public.is_general_sup());
drop policy if exists news_read_gm on public.news;
create policy news_read_gm on public.news for select to authenticated using (public.is_general_sup() and audience in ('supervisor', 'gmanager'));

-- إشعار لطلاب بعينهم: المدير العام لأي طالب
create or replace function public.notify_students(students uuid[], body text)
returns int language plpgsql security definer set search_path = public as $$
declare me record; s uuid; n int := 0; txt text := trim(coalesce(body, '')); ok boolean;
begin
  if length(txt) < 2 or length(txt) > 1000 then raise exception 'نص الإشعار غير صالح'; end if;
  if coalesce(array_length(students, 1), 0) = 0 or array_length(students, 1) > 2000 then raise exception 'عدد الطلاب غير صالح'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student'
    order by (role = 'admin') desc, (role = 'gmanager') desc, (role = 'teacher') desc limit 1;
  if me.id is null then raise exception 'غير مصرح'; end if;
  foreach s in array students loop
    ok := public.is_admin() or public.is_general_sup() or public.has_perm('fees.collect') or public.can_teach_student(s)
          or (public.has_role('placeadmin') and exists (select 1 from members x where x.id = s and x.halaqa_id in (select public.my_place_halaqat())));
    if not ok or not exists (select 1 from members where id = s and role = 'student') then continue; end if;
    if exists (select 1 from news where audience = 'm:' || s::text and text = txt and date = current_date) then continue; end if;
    insert into news (text, audience, date, author_id, author)
    values (txt, 'm:' || s::text, current_date, me.id,
            (case me.role when 'accountant' then 'المحاسب' when 'teacher' then 'المعلم' when 'placeadmin' then 'الإداري'
                          when 'supervisor' then 'المشرف' when 'gmanager' then 'المدير العام' else 'الإدارة' end) || ' ' || me.name);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_students(uuid[], text) from public, anon;
grant execute on function public.notify_students(uuid[], text) to authenticated;

-- 9) طلبات الحذف: يراها كلها (والقرار للمدير وحده كما كان)
create or replace function public.del_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]') from (
    select id, kind, target_id, target_name, reason, requested_by, requested_name, created_at, status
    from del_requests
    where status = 'pending' and (public.is_admin() or public.is_general_sup() or requested_by in (select public.my_ids()))
  ) r
$$;

-- 10) المزامنة: المدير العام تصله كل الجداول التي يطّلع عليها (كالمدير؛ وقواعد الأمان أعلاه تحدد ما يُقرأ فعلًا)
create or replace function public.sync_check(since timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me    uuid[] := array(select id from members where user_id = auth.uid());
  roles text[] := array(select role from members where user_id = auth.uid());
  adm   boolean := 'admin' = any(roles) or 'gmanager' = any(roles);
  sup   boolean := 'supervisor' = any(roles);
  staff boolean := 'teacher' = any(roles) or sup;
  acc   boolean := 'accountant' = any(roles);
  gsup  boolean := 'gmanager' = any(roles);
  padm  boolean := 'placeadmin' = any(roles);
  hal uuid[]; stu uuid[]; ids uuid[]; pl uuid[]; allids uuid[]; t text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if adm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'attendance' where exists (select 1 from attendance where sync_ts > since)
      union all select 'records' where exists (select 1 from records where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since)
      union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
      union all select 'pending_columns' where exists (select 1 from pending_columns where sync_ts > since)
      union all select 'pay_settings' where exists (select 1 from pay_settings where sync_ts > since)
      union all select 'pay_employees' where exists (select 1 from pay_employees where sync_ts > since)
      union all select 'pay_rows' where exists (select 1 from pay_rows where sync_ts > since)
      union all select 'pay_closed' where exists (select 1 from pay_closed where sync_ts > since)
      union all select 'absences' where exists (select 1 from absences where sync_ts > since)
      union all select 'fees' where exists (select 1 from fees where sync_ts > since)
      union all select 'collections' where exists (select 1 from collections where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- المحاسب: كل الطلاب والحلقات والأماكن واشتراكاته وملاحظاته (بلا تقييد بنطاق حلقات)
  if acc and not staff and not padm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since and (audience in ('all', 'accountant') or author_id = any(me) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
      union all select 'fees' where public.has_perm('fees.collect') and exists (select 1 from fees where sync_ts > since)
      union all select 'collections' where public.has_perm('fees.collect') and exists (select 1 from collections where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- الإداري: بلا قائمة نطاق؛ قواعد الأمان تحدد ما يصل له
  if gsup or padm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since and member_id = any(me))
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'attendance' where exists (select 1 from attendance where sync_ts > since)
      union all select 'records' where exists (select 1 from records where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since and (audience = 'all' or audience = any(roles) or (gsup and audience = 'gmanager') or author_id = any(me) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
      union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
      union all select 'collections' where exists (select 1 from collections where sync_ts > since and teacher_id = any(me))
      union all select 'absences' where sup and exists (select 1 from absences where sync_ts > since)
      union all select 'staff' where sup and exists (select 1 from pay_employees where sync_ts > since union all select 1 from pay_closed where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')), 'me', to_jsonb(me), 'sup', sup);
  end if;

  -- نطاق المستخدم: حلقاته (أو حلقته إن كان طالبًا)، وطلابها، وأسماء معلميها ومشرفيها
  hal := array(select id from halaqat where teacher_id = any(me) or supervisor_id = any(me)
               or id in (select halaqa_id from members where id = any(me) and halaqa_id is not null));
  stu := case when staff then array(select id from members where role = 'student' and halaqa_id = any(hal)) else '{}' end
         || array(select id from members where id = any(me) and role = 'student');
  ids := me || array(select x from halaqat h, unnest(array[h.teacher_id, h.supervisor_id]) x where h.id = any(hal) and x is not null);
  pl  := array(select place_id from halaqat where id = any(hal) and place_id is not null);
  allids := ids || stu || hal || pl;

  select array_agg(x) into t from (
    select 'settings' x where exists (select 1 from settings where sync_ts > since)
    union all select 'places' where exists (select 1 from places where sync_ts > since and (sup or id = any(pl)))
    union all select 'members' where exists (select 1 from members where sync_ts > since and (id = any(ids) or id = any(stu)))
    union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since and member_id = any(me))
    union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since and id = any(hal))
    union all select 'attendance' where exists (select 1 from attendance where sync_ts > since and student_id = any(stu))
    union all select 'records' where exists (select 1 from records where sync_ts > since and student_id = any(stu))
    union all select 'news' where exists (select 1 from news where sync_ts > since and (audience = 'all' or audience = any(roles) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
    union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
    union all select 'collections' where exists (select 1 from collections where sync_ts > since and teacher_id = any(me))
    -- غياب المعلمين عمل مشترك بين المشرفين (حتى لا يُسجَّل الغياب نفسه مرتين)
    union all select 'absences' where sup and exists (select 1 from absences where sync_ts > since)
    union all select 'staff' where sup and exists (select 1 from pay_employees where sync_ts > since union all select 1 from pay_closed where sync_ts > since)
    union all select 'deleted' where exists (select 1 from sync_deleted where at > since and (
      tbl in ('settings', 'news', 'custom_fields') or (sup and tbl in ('places', 'absences')) or scope && allids))
  ) q;
  return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')),
    'hal', to_jsonb(hal), 'stu', to_jsonb(stu), 'ids', to_jsonb(ids), 'pl', to_jsonb(pl), 'me', to_jsonb(me), 'sup', sup);
end $$;
revoke all on function public.sync_check(timestamptz) from public, anon;
grant execute on function public.sync_check(timestamptz) to authenticated;

notify pgrst, 'reload schema';
