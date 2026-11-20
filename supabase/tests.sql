-- ============ اختبارات الطلاب (tests.js) ============
-- المدير والمدير العام: أي طالب في الأنواع الثلاثة. المشرف: طلاب حلقاته.
-- «متابعة» (follow) و«إتقان» (itqan): والمعلم بصلاحيتهما (tests.follow / tests.itqan) في نطاقه: حلقاته، وما يحدده له المدير
--   في «إدارة الاختبارات ← نطاق المعلمين المختبِرين» (settings.tests_cfg.scopes). كل محاولة إتقان سجل مستقل،
--   ومن لم يجتز يُحفظ اختباره في «متابعة» (kind follow ومعه data.itqan = true) بحق تسجيل الإتقان نفسه.
-- «الفصول» (term): ومعلم حلقة الطالب بلا صلاحية؛ وتُعدَّل نتيجتها (test_upd).
-- القراءة: من يسجّل، ومعلم الحلقة، والمحاسب بصلاحية tests.view، والإداري لطلاب نطاق عمله، والطالب اختباراته هو (في «سجل الإنجاز»).
-- الدرجات العظمى ونسبة النجاح من settings.tests_cfg (يكتبها المدير).
-- جدول بلا قواعد قراءة مباشرة، والوصول بالدوال فقط (كما في sup_notes.sql).
-- آمن للتكرار. يُنفَّذ بعد gmanager_role.sql.

create table if not exists public.student_tests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.members(id) on delete cascade,
  kind text not null default 'follow',
  dt date not null default current_date,
  data jsonb not null default '{}'::jsonb,
  by_member uuid,
  by_name text,
  created_at timestamptz not null default now()
);
create index if not exists student_tests_student on public.student_tests (student_id, dt desc);
alter table public.student_tests enable row level security;
revoke all on public.student_tests from anon, authenticated;

-- نطاق المعلم المختبِر: حلقاته، وما حدده له المدير في settings.tests_cfg.scopes[معرّفه] = { places: [...], halaqat: [...] }
create or replace function public.test_in_scope(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from members s join halaqat h on h.id = s.halaqa_id
    join members me on me.user_id = auth.uid() and me.role = 'teacher'
    cross join (select coalesce((select value from settings where key = 'tests_cfg') -> 'scopes', '{}'::jsonb) v) c
    where s.id = sid and s.role = 'student'
      and (h.teacher_id = me.id
           or coalesce(c.v -> (me.id::text) -> 'halaqat', '[]'::jsonb) ? (h.id::text)
           or (h.place_id is not null and coalesce(c.v -> (me.id::text) -> 'places', '[]'::jsonb) ? (h.place_id::text))))
$$;

-- من يسجّل: المدير، والمدير العام (أي طالب)، ومشرف حلقة الطالب؛ والمعلم: «الفصول» لطلاب حلقاته،
-- و«متابعة» و«إتقان» بصلاحيتهما (tests.follow / tests.itqan) في نطاقه
create or replace function public.test_can_edit(sid uuid, knd text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_general_sup()
    or exists (
      select 1 from members s join halaqat h on h.id = s.halaqa_id
      where s.id = sid and s.role = 'student'
        and (h.supervisor_id in (select public.my_ids())
             or (knd = 'term' and h.teacher_id in (select public.my_ids()))))
    or (knd = 'follow' and public.has_perm('tests.follow') and public.test_in_scope(sid))
    or (knd = 'itqan' and public.has_perm('tests.itqan') and public.test_in_scope(sid))
$$;
-- من يقرأ: من يسجّل أي نوع، ومعلم حلقة الطالب، والمعلم المختبِر في نطاقه،
-- والمحاسب بصلاحية tests.view، والإداري لطلاب نطاق عمله
create or replace function public.test_can_read(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.test_can_edit(sid, 'follow') or public.test_can_edit(sid, 'itqan') or public.test_can_edit(sid, 'term')
    or ((public.has_perm('tests.follow') or public.has_perm('tests.itqan')) and public.test_in_scope(sid))
    or (exists (select 1 from members where user_id = auth.uid() and role = 'accountant') and public.has_perm('tests.view'))
    or exists (select 1 from members s where s.id = sid and s.role = 'student' and s.halaqa_id in (select public.my_place_halaqat()))
    or exists (select 1 from members s where s.id = sid and s.role = 'student' and s.user_id = auth.uid())   -- الطالب يرى اختباراته في «سجل الإنجاز»
$$;

-- «سجل الاختبارات» في الصفحة الرئيسية: أحدث اختبارات نوع واحد مما يحق للمستخدم قراءته، مع العدد الكلي
create or replace function public.test_recent(knd text, lim int default 5, off int default 0)
returns table (id uuid, student_id uuid, student_name text, kind text, dt date, data jsonb, by_name text, created_at timestamptz, total_count bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.student_id, s.name, t.kind, t.dt, t.data, t.by_name, t.created_at, count(*) over ()
  from student_tests t join members s on s.id = t.student_id
  where t.kind = knd and public.test_can_read(t.student_id)
  order by t.dt desc, t.created_at desc
  limit least(greatest(coalesce(lim, 5), 1), 200) offset greatest(coalesce(off, 0), 0)
$$;

-- طلاب نطاق المعلم المختبِر من حلقات غيره (لا يصلون إليه مع بيانات حلقاته)
create or replace function public.test_scope_students()
returns table (id uuid, name text, halaqa_id uuid, h_label text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.halaqa_id,
         'حلقة ' || coalesce(t.name, h.name, '') || coalesce(' — ' || p.name, '')
  from members s
  join halaqat h on h.id = s.halaqa_id
  left join members t on t.id = h.teacher_id
  left join places p on p.id = h.place_id
  where s.role = 'student' and coalesce(s.info ->> 'status', '') <> 'منقطع'
    and (public.has_perm('tests.follow') or public.has_perm('tests.itqan'))
    and (h.teacher_id is null or h.teacher_id not in (select public.my_ids()))
    and public.test_in_scope(s.id)
  order by 4, 2
$$;

create or replace function public.test_list(sid uuid)
returns table (id uuid, kind text, dt date, data jsonb, by_name text, created_at timestamptz, can_del boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.kind, t.dt, t.data, t.by_name, t.created_at,
         public.is_admin() or t.by_member in (select public.my_ids())
  from student_tests t
  where t.student_id = sid and public.test_can_read(sid)
  order by t.dt desc, t.created_at desc
$$;

create or replace function public.test_add(sid uuid, knd text, dt date, dat jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members; nid uuid;
begin
  if knd not in ('follow', 'term', 'itqan') then raise exception 'نوع اختبار غير معروف'; end if;
  -- إتقان لم يجتز يُحفظ في «متابعة» (data.itqan = true): يكفيه حق تسجيل الإتقان
  if public.is_blocked() or not public.test_can_edit(sid, case when knd = 'follow' and coalesce((dat ->> 'itqan')::boolean, false) then 'itqan' else knd end) then
    raise exception 'غير مسموح';
  end if;
  if jsonb_typeof(dat) <> 'object' or length(dat::text) > 8000 then raise exception 'بيانات غير صالحة'; end if;
  if dt is null or dt > current_date + 1 then raise exception 'تاريخ غير صالح'; end if;
  select * into me from members where user_id = auth.uid() limit 1;
  insert into student_tests (student_id, kind, dt, data, by_member, by_name)
  values (sid, knd, dt, dat, me.id, me.name)
  returning id into nid;
  return nid;
end $$;

-- تعديل نتيجة «الفصول»: من يحق له تسجيلها لهذا الطالب
create or replace function public.test_upd(tid uuid, dt date, dat jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare t student_tests; me members;
begin
  select * into t from student_tests where id = tid;
  if not found or t.kind <> 'term' or public.is_blocked() or not public.test_can_edit(t.student_id, t.kind) then raise exception 'غير مسموح'; end if;
  if jsonb_typeof(dat) <> 'object' or length(dat::text) > 8000 then raise exception 'بيانات غير صالحة'; end if;
  if dt is null or dt > current_date + 1 then raise exception 'تاريخ غير صالح'; end if;
  select * into me from members where user_id = auth.uid() limit 1;
  update student_tests set dt = test_upd.dt, data = dat, by_member = me.id, by_name = me.name where id = tid;
end $$;

-- الحذف: المدير، أو من سجّل الاختبار
create or replace function public.test_del(tid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from student_tests where id = tid and (public.is_admin() or by_member in (select public.my_ids()));
  if not found then raise exception 'غير مسموح'; end if;
end $$;

revoke all on function public.test_in_scope(uuid), public.test_can_edit(uuid, text), public.test_can_read(uuid), public.test_list(uuid),
  public.test_add(uuid, text, date, jsonb), public.test_upd(uuid, date, jsonb), public.test_del(uuid), public.test_scope_students(),
  public.test_recent(text, int, int) from public, anon;
grant execute on function public.test_list(uuid), public.test_add(uuid, text, date, jsonb), public.test_upd(uuid, date, jsonb), public.test_del(uuid),
  public.test_scope_students(), public.test_recent(text, int, int) to authenticated;

notify pgrst, 'reload schema';
