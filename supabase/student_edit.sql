-- =====================================================================
--  صلاحية «تعديل استمارة الطالب» (students.edit): للمحاسب افتراضيًا، ويمنحها المدير لغيره أو يسحبها
--  من «الإعدادات ← الصلاحيات». صاحبها يعدّل كل ما في استمارة الطالب: الاسم والهاتف والفئة
--  (صغير/كبير) والبيانات كلها والصورة والحلقة. لا يمسّ أبدًا حساب الدخول ولا نوع العضو.
--  يُنفَّذ بعد accountant.sql و perms.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) الصلاحيات الافتراضية للمحاسب (ومعها الجديدة)
create or replace function public.perm_default(r text, p text) returns boolean
language sql immutable as $$
  select r = 'accountant' and p in ('students.add', 'students.status', 'students.move', 'students.edit', 'fees.collect', 'fees.amount', 'notes.send')
$$;
-- التحقق: استثناء الفرد ← اختيار الفئة ← الافتراضي (كما في accountant.sql، فلا يهم ترتيب تنفيذ perms.sql)
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from members m
    cross join (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v) c
    where m.user_id = auth.uid()
      and coalesce((c.v -> 'members' -> (m.id::text) ->> p)::boolean,
                   (c.v -> 'roles' -> m.role ->> p)::boolean,
                   public.perm_default(m.role, p))
  )
$$;
create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  with c as (select coalesce((select value from settings where key = 'priv_perms'), '{}'::jsonb) v),
  keys as (
    select k from members m, c,
      lateral jsonb_object_keys(coalesce(c.v -> 'roles' -> m.role, '{}'::jsonb) || coalesce(c.v -> 'members' -> (m.id::text), '{}'::jsonb)) k
    where m.user_id = auth.uid()
    union select unnest(array['students.add', 'students.status', 'students.move', 'students.edit', 'fees.collect', 'fees.amount', 'notes.send'])
  )
  select coalesce(array_agg(distinct k order by k), '{}') from keys where public.has_perm(k)
$$;
create or replace function public.can_manage_students() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm('students.add') or public.has_perm('students.status') or public.has_perm('students.move')
      or public.has_perm('students.edit') or public.has_perm('fees.collect') or public.has_perm('fees.amount')
$$;

-- 2) حارس بيانات الطالب: صاحب «تعديل الاستمارة» يعدّل كل بياناتها؛ وغيره بحسب صلاحياته كما كان
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
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

notify pgrst, 'reload schema';
