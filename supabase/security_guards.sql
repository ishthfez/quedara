-- =====================================================================
--  حمايات على الخادم (مراجعة الأمان)
--   1) الحلقات: من له «الحلقات» (المحاسب افتراضيًا) لا يُسند حلقة إلى نفسه، ولا يجعل معلمها إلا معلمًا ومشرفها إلا مشرفًا أو مديرًا عامًا.
--      كان المحاسب يستطيع أن يجعل نفسه مشرف حلقات فيقرأ ويكتب حضورها وتسميعها وملاحظات المشرف الخاصة، ويراجع تحصيلًا أرسله هو.
--   2) الإعلانات: المدير العام لا يستطيع نشر إعلان باسم غيره (كان يحدد author و author_id بنفسه).
--   3) الاسترجاع من نسخة احتياطية: لا يغيّر نوع حساب عضو موجود ولا ربطه بحساب الدخول، ولا يربط عضوًا جديدًا مديرًا أو مديرًا عامًا بحساب دخول.
--      كانت نسخة معدّلة تستطيع أن تجعل حساب طالب مديرًا عند استرجاعها.
--  يُنفَّذ بعد restore.sql و gmanager_role.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) الحلقات
create or replace function public.halaqat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or current_setting('qulearn.restoring', true) = 'on' then return new; end if;
  if new.teacher_id is not null and (tg_op = 'INSERT' or new.teacher_id is distinct from old.teacher_id) then
    if not exists (select 1 from members where id = new.teacher_id and role = 'teacher') then raise exception 'معلم الحلقة يجب أن يكون معلمًا' using errcode = '42501'; end if;
    if new.teacher_id in (select public.my_ids()) then raise exception 'لا يمكنك إسناد حلقة إلى نفسك' using errcode = '42501'; end if;
  end if;
  if new.supervisor_id is not null and (tg_op = 'INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    if not exists (select 1 from members where id = new.supervisor_id and role in ('supervisor', 'gmanager')) then raise exception 'مشرف الحلقة يجب أن يكون مشرفًا' using errcode = '42501'; end if;
    if new.supervisor_id in (select public.my_ids()) then raise exception 'لا يمكنك إسناد حلقة إلى نفسك' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists halaqat_guard on public.halaqat;
create trigger halaqat_guard before insert or update on public.halaqat for each row execute function public.halaqat_guard();

-- 2) إعلانات المدير العام باسمه هو
create or replace function public.news_author_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  if public.is_admin() or not public.is_general_sup() or current_setting('qulearn.restoring', true) = 'on' then return new; end if;
  select id, name into me from members where user_id = auth.uid() and role = 'gmanager' limit 1;
  if me.id is not null then
    new.author_id := me.id;
    new.author := 'المدير العام ' || me.name;
  end if;
  return new;
end $$;
drop trigger if exists news_author_guard on public.news;
create trigger news_author_guard before insert or update on public.news for each row execute function public.news_author_guard();

-- 3) الاسترجاع: كما في restore.sql، مع حفظ نوع الأعضاء الموجودين وربطهم بالدخول
create or replace function public.backup_restore(data jsonb, mode text default 'merge') returns jsonb
language plpgsql security definer set search_path = public as $$
declare tb jsonb := data -> 'tables'; t text; n int; res jsonb := '{}'; del jsonb := '{}'; mem jsonb;
  parents text[] := array['settings', 'places'];
  children text[] := array['member_admin', 'attendance', 'records', 'news', 'custom_fields', 'pending_columns', 'pay_settings', 'pay_employees',
                           'pay_rows', 'pay_closed', 'absences', 'fees', 'collections', 'exams'];
begin
  if not public.is_admin() then raise exception 'استرجاع النسخ الاحتياطية للمدير فقط' using errcode = '42501'; end if;
  if coalesce(data ->> 'app', '') <> 'qulearn' or jsonb_typeof(tb) is distinct from 'object' then raise exception 'الملف ليس نسخة احتياطية لهذا التطبيق'; end if;
  if mode not in ('merge', 'replace') then raise exception 'طريقة استرجاع غير معروفة'; end if;
  perform set_config('qulearn.restoring', 'on', true);

  if mode = 'replace' then
    foreach t in array array['exams', 'collections', 'fees', 'absences', 'pay_rows', 'pay_closed', 'pay_employees', 'pending_columns', 'custom_fields',
                             'news', 'records', 'attendance', 'member_admin', 'halaqat', 'members', 'places'] loop
      if tb ? t and to_regclass('public.' || t) is not null then
        n := public.restore_prune(t, tb -> t, case when t = 'members' then ' and x.role <> ''admin''' else '' end);
        if n > 0 then del := del || jsonb_build_object(t, n); end if;
      end if;
    end loop;
  end if;

  foreach t in array parents loop
    if tb ? t and to_regclass('public.' || t) is not null then res := res || jsonb_build_object(t, public.restore_table(t, tb -> t)); end if;
  end loop;
  if tb ? 'members' then
    select jsonb_agg(
             r || jsonb_build_object('halaqa_id', null)
               || case
                    -- عضو موجود: نوعه وربطه بحساب الدخول كما هما على الخادم، لا كما في الملف
                    when ex.id is not null then jsonb_build_object('role', ex.role, 'user_id', to_jsonb(ex.user_id), 'login_email', to_jsonb(ex.login_email))
                    -- عضو جديد مدير أو مدير عام: بلا حساب دخول (يُنشأ له من «الأعضاء»)
                    when (r ->> 'role') in ('admin', 'gmanager') then jsonb_build_object('user_id', null, 'login_email', null)
                    -- غيره: يُربط بحسابه إن وُجد وليس حساب مدير أو مدير عام
                    else jsonb_build_object('user_id',
                      case when exists (select 1 from auth.users au where au.id::text = r ->> 'user_id')
                             and not exists (select 1 from members x where x.user_id::text = r ->> 'user_id' and x.role in ('admin', 'gmanager'))
                           then r -> 'user_id' else 'null'::jsonb end)
                  end)
      into mem
      from jsonb_array_elements(tb -> 'members') r
      left join members ex on ex.id::text = r ->> 'id';
    res := res || jsonb_build_object('members', public.restore_table('members', mem));
  end if;
  if tb ? 'halaqat' then res := res || jsonb_build_object('halaqat', public.restore_table('halaqat', tb -> 'halaqat')); end if;
  if tb ? 'members' then
    update members m set halaqa_id = (b ->> 'halaqa_id')::uuid
      from jsonb_array_elements(tb -> 'members') b
      where m.id = (b ->> 'id')::uuid and m.halaqa_id is distinct from (b ->> 'halaqa_id')::uuid
        and (b ->> 'halaqa_id' is null or exists (select 1 from halaqat h where h.id = (b ->> 'halaqa_id')::uuid));
  end if;
  foreach t in array children loop
    if tb ? t and to_regclass('public.' || t) is not null then res := res || jsonb_build_object(t, public.restore_table(t, tb -> t)); end if;
  end loop;
  return jsonb_build_object('mode', mode, 'restored', res, 'deleted', del, 'backup_at', data -> 'at');
end $$;
revoke all on function public.backup_restore(jsonb, text) from public, anon;
grant execute on function public.backup_restore(jsonb, text) to authenticated;

notify pgrst, 'reload schema';
