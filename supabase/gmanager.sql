-- =====================================================================
--  «مدير عام»: فئة مستقلة أعلى من المشرفين، ويمكن أن تضم أكثر من شخص
--   - على الخادم هو «المشرف العام» نفسه: حساب مشرف عليه scope = 'all' (roles.sql)، بصلاحياته كما هي،
--     فمن كان مشرفًا عامًا صار مديرًا عامًا تلقائيًا بلا نقل بيانات.
--   - جمهور إعلانات جديد 'gmanager' (المديرون العامون) يقرؤه المدير العام وحده (ومعه المدير)،
--     ويبقى يصله ما يُرسل لـ«المشرفون» كما كان.
--   - sync_check: نسخة roles.sql نفسها، ويُضاف إليها إعلانات المديرين العامين في كشف التغييرات.
--  يُنفَّذ بعد halaqat_perm.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) جمهور الإعلانات
alter table public.news drop constraint if exists news_audience_check;
alter table public.news add constraint news_audience_check check (audience in ('all', 'teacher', 'supervisor', 'student', 'admin', 'accountant', 'placeadmin', 'gmanager') or audience ~ '^m:[0-9a-f-]{36}$');

-- 2) من يقرأ الإعلان: كما في notes.sql، ويُضاف المدير العام لجمهور «المديرون العامون»
drop policy if exists news_read on public.news;
create policy news_read on public.news for select to authenticated
  using (audience = 'all' or public.is_admin() or public.has_role(audience)
         or (audience = 'gmanager' and public.is_general_sup())
         or author_id in (select public.my_ids())
         or audience in (select 'm:' || x::text from public.my_ids() x));

-- 3) المزامنة
create or replace function public.sync_check(since timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me    uuid[] := array(select id from members where user_id = auth.uid());
  roles text[] := array(select role from members where user_id = auth.uid());
  adm   boolean := 'admin' = any(roles);
  sup   boolean := 'supervisor' = any(roles);
  staff boolean := 'teacher' = any(roles) or sup;
  acc   boolean := 'accountant' = any(roles);
  gsup  boolean := exists (select 1 from members where user_id = auth.uid() and role = 'supervisor' and info ->> 'scope' = 'all');
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

  -- المشرف العام والإداري: بلا قائمة نطاق؛ قواعد الأمان تحدد ما يصل لكل منهما
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
