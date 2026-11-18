-- =====================================================================
--  نقل الطالب بموافقة المشرف
--   - من ينقل طالبًا من حلقة إلى أخرى (المعلم أو الإداري أو المحاسب، أو مشرف إلى حلقة مشرف آخر) ينقله فورًا،
--     فيظهر في الحلقة الجديدة بعلامة «بانتظار موافقة النقل»، ويُسجَّل طلب نقل فيه الحلقة القديمة.
--   - يوافق مشرف الحلقة القديمة ومشرف الحلقة الجديدة، والاثنان إن اختلفا (مرة واحدة إن كان المشرف نفسه).
--     الحلقة التي لا مشرف لها لا تحتاج موافقة، فإن لم يكن لأي من الحلقتين مشرف صار النقل نهائيًا مباشرة.
--     والمشرف الذي ينقل بنفسه تُحسب موافقته، ونقل المدير نهائي دائمًا (ويلغي أي طلب منتظر للطالب نفسه).
--   - يصل كل مشرف مطلوبة موافقته إشعار في «الإعلانات»، ويرى الطلب في صفحة «الطلاب» (my_transfers).
--     الموافقة من كل المطلوبين تجعل النقل نهائيًا، والرفض من أحدهم يعيد الطالب إلى حلقته القديمة (review_transfer)،
--     ويصل من نقله إشعار بالنتيجة. والمدير يستطيع الموافقة أو الرفض عن الجميع.
--   - نقل الطالب مرة أخرى قبل الموافقة يستبدل الطلب، والحلقة القديمة تبقى التي كان فيها قبل الطلب الأول،
--     وإعادته إليها تلغي الطلب.
--  يُنفَّذ بعد place_halaqat.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) طلبات النقل (لا تُقرأ ولا تُكتب مباشرة: الدوال أدناه وحدها)
create table if not exists public.transfers (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.members(id) on delete cascade,
  from_halaqa uuid,
  to_halaqa   uuid,
  by_member   uuid,
  by_name     text not null default '',
  needed      uuid[] not null default '{}',   -- المشرفون المطلوبة موافقتهم
  approved    uuid[] not null default '{}',   -- من وافق منهم
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'replaced', 'cancelled')),
  decided_by  text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists transfers_pending_idx on public.transfers (student_id) where status = 'pending';
alter table public.transfers enable row level security;
revoke all on public.transfers from anon, authenticated;

-- 2) اسم الحلقة كما في التطبيق: «حلقة المعلم — المكان»
create or replace function public.halaqa_title(h uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select 'حلقة ' || coalesce(nullif(x.name, ''), t.name, 'بلا معلم') || coalesce(' — ' || p.name, '')
                   from halaqat x left join members t on t.id = x.teacher_id left join places p on p.id = x.place_id where x.id = h), 'بلا حلقة')
$$;
revoke all on function public.halaqa_title(uuid) from public, anon, authenticated;

-- 3) حارس تعديل الأعضاء (نسخة fees_systems.sql) ومعه استثناء واحد: إعادة الطالب لحلقته عند رفض النقل،
--    وهي تجري داخل review_transfer وحدها (app.qtr)، لأن المشرف الرافض قد لا يملك صلاحية «نقل طالب»
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if coalesce(current_setting('app.qtr', true), '') = '1' then return new; end if;
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

-- 4) كل نقل يمر بالخادم (من أي نافذة أو نموذج): يُسجَّل طلبه إن احتاج موافقة
create or replace function public.members_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record; mine uuid[]; pend record; orig uuid; sups uuid[]; need uuid[]; lbl text;
begin
  if new.role <> 'student' or new.halaqa_id is not distinct from old.halaqa_id then return null; end if;
  if coalesce(current_setting('app.qtr', true), '') = '1' then return null; end if;   -- إعادة بعد رفض
  if auth.uid() is null or public.is_admin() then
    update transfers set status = 'cancelled', decided_at = now(), decided_by = 'نقل المدير' where student_id = new.id and status = 'pending';
    return null;
  end if;
  mine := array(select id from members where user_id = auth.uid());
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student'
    order by case role when 'supervisor' then 0 when 'teacher' then 1 when 'placeadmin' then 2 else 3 end limit 1;
  select * into pend from transfers where student_id = new.id and status = 'pending' order by created_at desc limit 1;
  orig := case when pend.id is not null then pend.from_halaqa else old.halaqa_id end;
  if pend.id is not null then update transfers set status = 'replaced', decided_at = now() where id = pend.id; end if;
  if new.halaqa_id is not distinct from orig then return null; end if;   -- أُعيد إلى حلقته قبل الموافقة
  sups := array(select distinct s from (select supervisor_id s from halaqat where id = orig union all select supervisor_id from halaqat where id = new.halaqa_id) x where s is not null);
  need := array(select s from unnest(sups) s where not (s = any(mine)));
  if cardinality(need) = 0 then return null; end if;   -- لا مشرف غيره: نقل نهائي
  insert into transfers (student_id, from_halaqa, to_halaqa, by_member, by_name, needed, approved)
  values (new.id, orig, new.halaqa_id, me.id, coalesce(me.name, ''), need, array(select s from unnest(sups) s where s = any(mine)));
  lbl := case me.role when 'teacher' then 'المعلم' when 'supervisor' then 'المشرف' when 'placeadmin' then 'الإداري' when 'accountant' then 'المحاسب' else '' end;
  insert into news (id, text, audience, date, author_id, author)
  select gen_random_uuid(), 'طلب نقل الطالب «' || new.name || '» من ' || public.halaqa_title(orig) || ' إلى ' || public.halaqa_title(new.halaqa_id)
         || '، بانتظار موافقتك من صفحة «الطلاب».', 'm:' || s::text, current_date, me.id, trim(lbl || ' ' || coalesce(me.name, ''))
  from unnest(need) s;
  return null;
end $$;
drop trigger if exists members_transfer on public.members;
create trigger members_transfer after update on public.members for each row execute function public.members_transfer();

-- 5) الطلبات المنتظرة التي تخص الحساب: ما ينتظر موافقته، وما نقله هو، وطلاب يراهم (لعلامة الانتظار)؛ والمدير كلها
create or replace function public.my_transfers()
returns table (id uuid, student_id uuid, student_name text, from_halaqa uuid, to_halaqa uuid, from_title text, to_title text,
               by_name text, created_at timestamptz, waiting text, can_decide boolean)
language sql stable security definer set search_path = public as $$
  with mine as (select array(select m.id from members m where m.user_id = auth.uid()) ids)
  select t.id, t.student_id, s.name, t.from_halaqa, t.to_halaqa, public.halaqa_title(t.from_halaqa), public.halaqa_title(t.to_halaqa),
         t.by_name, t.created_at,
         coalesce((select string_agg(u.name, '، ') from members u where u.id = any(t.needed) and not (u.id = any(t.approved))), ''),
         public.is_admin() or (t.needed && mine.ids and not (t.approved @> array(select x from unnest(t.needed) x where x = any(mine.ids))))
  from transfers t join members s on s.id = t.student_id, mine
  where t.status = 'pending'
    and (public.is_admin() or t.needed && mine.ids or t.by_member = any(mine.ids) or public.has_perm('students.move') or public.can_see_student(t.student_id))
  order by t.created_at
$$;

-- 6) الموافقة أو الرفض
create or replace function public.review_transfer(tid uuid, ok boolean, msg text default '') returns text
language plpgsql security definer set search_path = public as $$
declare t record; mine uuid[]; adm boolean := public.is_admin(); me record; appr uuid[]; st text; sname text;
begin
  select * into t from transfers where id = tid for update;
  if t.id is null or t.status <> 'pending' then raise exception 'الطلب غير موجود أو قُرّر من قبل'; end if;
  mine := array(select id from members where user_id = auth.uid());
  if not adm and not (t.needed && mine) then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'admin') desc, (role = 'supervisor') desc limit 1;
  select name into sname from members where id = t.student_id;
  if not coalesce(ok, false) then
    perform set_config('app.qtr', '1', true);
    update members set halaqa_id = t.from_halaqa where id = t.student_id and halaqa_id is not distinct from t.to_halaqa;
    perform set_config('app.qtr', '', true);
    update transfers set status = 'rejected', decided_at = now(), decided_by = coalesce(me.name, ''), note = left(coalesce(msg, ''), 300) where id = tid;
    st := 'rejected';
  else
    appr := array(select distinct x from unnest(t.approved || case when adm then t.needed else array(select y from unnest(t.needed) y where y = any(mine)) end) x);
    st := case when t.needed <@ appr then 'approved' else 'pending' end;
    update transfers set approved = appr, status = st, decided_at = case when st = 'approved' then now() end,
      decided_by = case when st = 'approved' then coalesce(me.name, '') else decided_by end where id = tid;
  end if;
  if st <> 'pending' and t.by_member is not null and not (t.by_member = any(mine)) then
    insert into news (id, text, audience, date, author_id, author)
    values (gen_random_uuid(), case when st = 'approved'
             then 'وُوفق على نقل الطالب «' || coalesce(sname, '') || '» إلى ' || public.halaqa_title(t.to_halaqa) || '.'
             else 'رُفض نقل الطالب «' || coalesce(sname, '') || '» إلى ' || public.halaqa_title(t.to_halaqa) || '، وعاد إلى ' || public.halaqa_title(t.from_halaqa)
                  || '.' || coalesce(' السبب: ' || nullif(trim(msg), ''), '') end,
            'm:' || t.by_member::text, current_date, me.id, coalesce(me.name, ''));
  end if;
  return st;
end $$;

revoke all on function public.members_transfer(), public.my_transfers(), public.review_transfer(uuid, boolean, text) from public, anon;
grant execute on function public.my_transfers(), public.review_transfer(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
