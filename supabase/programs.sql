-- ============ قسم «البرامج» (programs.js) — المرحلة الأولى: مسابقة رمضان ============
-- جداول عامة لكل البرامج (مسابقة رمضان، الدورة المكثفة، البرامج التربوية)، بلا قواعد قراءة مباشرة،
-- والوصول بالدوال فقط (كما في tests.sql). لا تغيير في sync_check: البيانات تُجلب عند فتح القسم.
-- المنظم: المدير والمدير العام دائمًا، والمشرف المسند إليه التنظيم في نسخته (program_staff role = 'organizer').
-- الأهلية من اختبارات «إتقان» (student_tests): لكل بند (جزء أو مجموعة) آخر محاولة هي المعتبرة،
--   وللأهلية تُحسب الأجزاء المفردة المتصلة من الأول أو من الآخر، والمجموعة لا تُحتسب إلا بإقرار المشرف (program_group_ok).
-- آمن للتكرار. يُنفَّذ بعد tests.sql.

-- ---------------------------------------------------------------- الجداول
create table if not exists public.programs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('ramadan', 'intensive', 'tarbawi')),
  parent_id  uuid references public.programs(id) on delete cascade,
  name       text not null,
  year       int,
  status     text not null default 'open' check (status in ('open', 'closed')),
  cfg        jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists programs_kind on public.programs (kind, year desc);

-- طاقم النسخة: المنظمون (يسندهم المدير والمدير العام)، والمحكّمون والمختبِرون (يسندهم المنظم)
-- member_id فارغ = شخص من الخارج باسمه فقط (ext_name)، بلا حساب. scope = {halaqat:[...], entries:[...]}، والفارغ = الكل
create table if not exists public.program_staff (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  member_id  uuid references public.members(id) on delete cascade,
  ext_name   text,
  role       text not null check (role in ('organizer', 'judge', 'tester')),
  scope      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (member_id is not null or coalesce(ext_name, '') <> '')
);
create index if not exists program_staff_prog on public.program_staff (program_id);

-- المتسابقون: طالب مسجل (student_id) أو خارجي (ext = {name, phone, guardian, age, halaqa_id})
-- track: general | halaqat — stage: tasfiya | general | halaqat | done — status: active | pending | rejected
-- level: m1..m8 — amount (لـ م8): {from, to, pages} — scores: {tasfiya|general|halaqat: {v, absent, notes, judge, by, at, carried}}
-- result: winner | honor | below | out — tags: نصوص قصيرة توضّح سبب الحال (from_tasfiya, absent_general, carried, exempt, warn)
create table if not exists public.program_entries (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  student_id  uuid references public.members(id) on delete cascade,
  ext         jsonb,
  track       text not null default 'general' check (track in ('general', 'halaqat')),
  stage       text not null default 'tasfiya' check (stage in ('tasfiya', 'general', 'halaqat', 'done')),
  status      text not null default 'active' check (status in ('active', 'pending', 'rejected')),
  level       text check (level in ('m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8')),
  amount      jsonb,
  scores      jsonb not null default '{}'::jsonb,
  result      text check (result in ('winner', 'honor', 'below', 'out')),
  rank        int,
  rank_manual boolean not null default false,
  prize       numeric,
  tags        text[] not null default '{}',
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (student_id is not null or ext ? 'name')
);
create unique index if not exists program_entries_once on public.program_entries (program_id, student_id) where student_id is not null;
create index if not exists program_entries_prog on public.program_entries (program_id, stage);
create index if not exists program_entries_student on public.program_entries (student_id);

-- إقرار المشرف باحتساب مجموعة إتقان (مثل «(28 - 30) العشر») لأجزائها في الأهلية
create table if not exists public.program_group_ok (
  program_id uuid not null references public.programs(id) on delete cascade,
  student_id uuid not null references public.members(id) on delete cascade,
  label      text not null,
  by_member  uuid,
  by_name    text,
  at         timestamptz not null default now(),
  primary key (program_id, student_id, label)
);

create table if not exists public.program_log (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  entry_id   uuid,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  warn       boolean not null default false,
  by_member  uuid,
  by_name    text,
  at         timestamptz not null default now()
);
create index if not exists program_log_prog on public.program_log (program_id, at desc);

alter table public.programs         enable row level security;
alter table public.program_staff    enable row level security;
alter table public.program_entries  enable row level security;
alter table public.program_group_ok enable row level security;
alter table public.program_log      enable row level security;
revoke all on public.programs, public.program_staff, public.program_entries, public.program_group_ok, public.program_log from anon, authenticated;

-- ---------------------------------------------------------------- أدوات داخلية
create or replace function public.prog_me() returns members
language sql stable security definer set search_path = public as $$
  select * from members where user_id = auth.uid()
  order by case role when 'admin' then 0 when 'gmanager' then 1 when 'supervisor' then 2 when 'teacher' then 3 else 9 end
  limit 1
$$;

-- النسخة الجذر (للدورات والحلقات التابعة)
create or replace function public.prog_root(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(p.parent_id, p.id) from programs p where p.id = pid
$$;

-- المنظم: المدير، والمدير العام، والمسند إليه تنظيم النسخة (أو نسختها الجذر)
create or replace function public.prog_is_org(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_general_sup() or exists (
    select 1 from program_staff s
    where s.role = 'organizer' and s.member_id in (select public.my_ids())
      and s.program_id in (pid, public.prog_root(pid)))
$$;

-- صاحب القرار في طالب: المنظم، أو مشرف حلقة الطالب
create or replace function public.prog_can_decide(pid uuid, sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prog_is_org(pid) or (sid is not null and exists (
    select 1 from members s join halaqat h on h.id = s.halaqa_id
    where s.id = sid and h.supervisor_id in (select public.my_ids())))
$$;

-- يرى الطالب في النسخة: صاحب القرار، ومعلم حلقته، والإداري في نطاق عمله
create or replace function public.prog_can_see_student(pid uuid, sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prog_can_decide(pid, sid) or (sid is not null and exists (
    select 1 from members s join halaqat h on h.id = s.halaqa_id
    where s.id = sid and (h.teacher_id in (select public.my_ids()) or h.id in (select public.my_place_halaqat()))))
$$;

create or replace function public.prog_log_add(pid uuid, eid uuid, act text, det jsonb, w boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me();
begin
  insert into program_log (program_id, entry_id, action, detail, warn, by_member, by_name)
  values (pid, eid, act, coalesce(det, '{}'::jsonb), coalesce(w, false), me.id, me.name);
end $$;

create or replace function public.prog_lvl_ord(l text) returns int
language sql immutable as $$
  select case l when 'm1' then 1 when 'm2' then 2 when 'm3' then 3 when 'm4' then 4
                when 'm5' then 5 when 'm6' then 6 when 'm7' then 7 when 'm8' then 8 end
$$;

-- المستويان المباشران لعدد الأجزاء المتقنة المتصلة: [الافتراضي، البديل]. بين مستويين = الأعلى ثم الأدنى؛
-- مساوٍ لمستوى = نفسه ثم الذي فوقه؛ ربع القرآن يساويه 7 أو 8؛ أقل من 3 = غير مؤهل
create or replace function public.prog_allowed(cnt int) returns text[]
language sql immutable as $$
  select case
    when cnt >= 30 then array['m1']
    when cnt > 20  then array['m1', 'm2']
    when cnt = 20  then array['m2', 'm1']
    when cnt > 15  then array['m2', 'm3']
    when cnt = 15  then array['m3', 'm2']
    when cnt > 10  then array['m3', 'm4']
    when cnt = 10  then array['m4', 'm3']
    when cnt = 9   then array['m4', 'm5']
    when cnt in (7, 8) then array['m5', 'm4']
    when cnt = 6   then array['m5', 'm6']
    when cnt = 5   then array['m6', 'm5']
    when cnt = 4   then array['m6', 'm7']
    when cnt = 3   then array['m7', 'm6']
    else array[]::text[] end
$$;

-- آخر محاولة إتقان لكل بند عند الطالب (الناجحة kind = itqan، والراسبة kind = follow مع data.itqan)
create or replace function public.prog_itqan_latest(sid uuid)
returns table (label text, passed boolean, dt date, a int, b int)
language sql stable security definer set search_path = public as $$
  with t as (
    select distinct on (data ->> 'juz') data ->> 'juz' as label,
           coalesce((data ->> 'passed')::boolean, false) as passed, dt
    from student_tests
    where student_id = sid and coalesce(data ->> 'juz', '') <> ''
      and (kind = 'itqan' or (kind = 'follow' and coalesce((data ->> 'itqan')::boolean, false)))
    order by data ->> 'juz', dt desc, created_at desc)
  select t.label, t.passed, t.dt,
         coalesce((regexp_match(t.label, '^\s*\((\d+)\s*-\s*(\d+)\)'))[1], (regexp_match(t.label, '^\s*\((\d+)\)'))[1])::int,
         coalesce((regexp_match(t.label, '^\s*\((\d+)\s*-\s*(\d+)\)'))[2], (regexp_match(t.label, '^\s*\((\d+)\)'))[1])::int
  from t
$$;

-- عدد الأجزاء المتقنة المتصلة (الأكبر من العدّ من الأول والعدّ من الآخر)، مع المجموعات المُقرّة في النسخة
create or replace function public.prog_juz_count(pid uuid, sid uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare ok int[]; n1 int := 0; n2 int := 0;
begin
  select coalesce(array_agg(distinct j), '{}') into ok from (
    select l.a as j from public.prog_itqan_latest(sid) l where l.passed and l.a = l.b
    union all
    select generate_series(least(l.a, l.b), greatest(l.a, l.b)) from public.prog_itqan_latest(sid) l
    where l.passed and l.a <> l.b
      and exists (select 1 from program_group_ok g where g.program_id = pid and g.student_id = sid and g.label = l.label)
  ) q where j between 1 and 30;
  while n1 < 30 and (n1 + 1) = any(ok) loop n1 := n1 + 1; end loop;
  while n2 < 30 and (30 - n2) = any(ok) loop n2 := n2 + 1; end loop;
  return greatest(n1, n2);
end $$;

-- أعلى مستوى سابق للطالب في نسخ مسابقة رمضان الأقدم: {ord, level, year, pages, last_level, last_year}
create or replace function public.prog_prev_best(pid uuid, sid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with cur as (select year from programs where id = pid),
  h as (
    select e.level, p.year, coalesce((e.amount ->> 'pages')::numeric, 0) as pages
    from program_entries e join programs p on p.id = e.program_id
    where e.student_id = sid and p.kind = 'ramadan' and p.parent_id is null and p.id <> pid
      and p.year < coalesce((select year from cur), 99999) and e.level is not null and e.status <> 'rejected')
  select case when not exists (select 1 from h) then null else jsonb_build_object(
    'level', (select level from h order by public.prog_lvl_ord(level), pages desc, year desc limit 1),
    'year',  (select year  from h order by public.prog_lvl_ord(level), pages desc, year desc limit 1),
    'pages', (select pages from h order by public.prog_lvl_ord(level), pages desc, year desc limit 1),
    'last_level', (select level from h order by year desc, public.prog_lvl_ord(level) limit 1),
    'last_year',  (select year  from h order by year desc limit 1)) end
$$;

-- هل المستوى المختار مماثل لأعلى مستوى سابق أو أقل؟
create or replace function public.prog_is_warn(prev jsonb, lvl text, pages numeric) returns boolean
language sql immutable as $$
  select prev is not null and lvl is not null and (
    public.prog_lvl_ord(lvl) > public.prog_lvl_ord(prev ->> 'level')
    or (lvl = prev ->> 'level' and (lvl <> 'm8' or coalesce(pages, 0) <= coalesce((prev ->> 'pages')::numeric, 0))))
$$;

-- نص رسالة من إعدادات النسخة مع تعويض {الاسم} {النسخة} {المقر} {الموعد}
create or replace function public.prog_msg(pid uuid, key text, def text, sname text) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(
    coalesce(nullif(p.cfg -> 'msgs' ->> key, ''), def),
    '{الاسم}', coalesce(sname, '')), '{النسخة}', p.name),
    '{المقر}', coalesce(p.cfg ->> 'venue', '')),
    '{الموعد}', coalesce(p.cfg -> 'dates' ->> key, ''))
  from programs p where p.id = pid
$$;

create or replace function public.prog_notify(sid uuid, body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if sid is null or coalesce(body, '') = '' then return; end if;
  insert into news (text, audience, date, author_id) values (body, 'm:' || sid::text, current_date, (public.prog_me()).id);
end $$;

-- ---------------------------------------------------------------- النسخ والإعدادات والطاقم
-- من يرى قائمة البرامج: الطاقم والإداريون (كل منهم يرى داخلها ما يخصه فقط)
create or replace function public.is_staff_or_more() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role in ('admin', 'gmanager', 'supervisor', 'teacher', 'placeadmin'))
$$;

create or replace function public.prog_list(knd text)
returns table (id uuid, kind text, parent_id uuid, name text, year int, status text, cfg jsonb, is_org boolean, created_at timestamptz,
               n_entries bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.kind, p.parent_id, p.name, p.year, p.status, p.cfg, public.prog_is_org(p.id), p.created_at,
         (select count(*) from program_entries e where e.program_id = p.id and e.status <> 'rejected')
  from programs p
  where p.kind = knd and public.is_staff_or_more()
  order by p.year desc nulls last, p.created_at desc
$$;

-- إنشاء نسخة (المدير والمدير العام) أو تعديل اسمها وإعداداتها (المنظم). cfg يُدمج مع الحالي
create or replace function public.prog_save(pid uuid, knd text, nm text, yr int, cf jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid; me members := public.prog_me();
begin
  if public.is_blocked() then raise exception 'غير مسموح'; end if;
  if cf is not null and (jsonb_typeof(cf) <> 'object' or length(cf::text) > 30000) then raise exception 'إعدادات غير صالحة'; end if;
  if pid is null then
    if not (public.is_admin() or public.is_general_sup()) then raise exception 'غير مسموح'; end if;
    if coalesce(trim(nm), '') = '' then raise exception 'اكتب اسم النسخة'; end if;
    insert into programs (kind, name, year, cfg, created_by) values (knd, trim(nm), yr, coalesce(cf, '{}'::jsonb), me.id) returning id into nid;
    perform public.prog_log_add(nid, null, 'create', jsonb_build_object('name', nm, 'year', yr));
    return nid;
  end if;
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  update programs set name = coalesce(nullif(trim(nm), ''), name), year = coalesce(yr, year),
         cfg = case when cf is null then cfg else cfg || cf end
  where id = pid;
  perform public.prog_log_add(pid, null, 'settings', jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(coalesce(cf, '{}'::jsonb)) k)));
  return pid;
end $$;

create or replace function public.prog_close(pid uuid, cls boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_general_sup()) then raise exception 'غير مسموح'; end if;
  update programs set status = case when cls then 'closed' else 'open' end where id = pid;
  perform public.prog_log_add(pid, null, case when cls then 'close' else 'reopen' end, '{}');
end $$;

-- الطاقم: المنظمون يسندهم المدير والمدير العام؛ المحكّمون والمختبِرون يسندهم المنظم
create or replace function public.prog_staff_add(pid uuid, mid uuid, ename text, rl text, sc jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if rl = 'organizer' then
    if not (public.is_admin() or public.is_general_sup()) then raise exception 'غير مسموح'; end if;
    if mid is null or not exists (select 1 from members where id = mid and role = 'supervisor') then raise exception 'المنظم يكون مشرفًا'; end if;
  elsif rl in ('judge', 'tester') then
    if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
    if mid is not null and not exists (select 1 from members where id = mid and role in ('teacher', 'supervisor', 'gmanager')) then
      raise exception 'المحكّم يكون من المعلمين أو المشرفين، أو من الخارج باسمه';
    end if;
  else raise exception 'دور غير معروف'; end if;
  if mid is not null then
    select id into nid from program_staff where program_id = pid and member_id = mid and role = rl;
    if nid is not null then
      update program_staff set scope = coalesce(sc, scope) where id = nid;
      return nid;
    end if;
  end if;
  insert into program_staff (program_id, member_id, ext_name, role, scope)
  values (pid, mid, case when mid is null then trim(ename) end, rl, coalesce(sc, '{}'::jsonb)) returning id into nid;
  perform public.prog_log_add(pid, null, 'staff_add', jsonb_build_object('role', rl, 'member', mid, 'ext', ename));
  return nid;
end $$;

create or replace function public.prog_staff_del(stid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s program_staff;
begin
  select * into s from program_staff where id = stid;
  if not found then return; end if;
  if s.role = 'organizer' and not (public.is_admin() or public.is_general_sup()) then raise exception 'غير مسموح'; end if;
  if s.role <> 'organizer' and not public.prog_is_org(s.program_id) then raise exception 'غير مسموح'; end if;
  delete from program_staff where id = stid;
  perform public.prog_log_add(s.program_id, null, 'staff_del', jsonb_build_object('role', s.role, 'member', s.member_id, 'ext', s.ext_name));
end $$;

create or replace function public.prog_staff_list(pid uuid)
returns table (id uuid, member_id uuid, name text, ext boolean, role text, scope jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.member_id, coalesce(m.name, s.ext_name), s.member_id is null, s.role, s.scope
  from program_staff s left join members m on m.id = s.member_id
  where s.program_id = pid and (public.prog_is_org(pid) or s.member_id in (select public.my_ids()))
  order by s.role, 3
$$;

-- ---------------------------------------------------------------- المرشحون والتسجيل
-- الطلاب الذين يحق للمستخدم تسجيلهم، مع عدد أجزائهم ومستوييهم المباشرين وأعلى مستوى سابق ومجموعاتهم الناجحة غير المُقرّة
-- off: الخادم يعيد 1000 صف على الأكثر، فتُطلب القائمة على دفعات
drop function if exists public.prog_candidates(uuid);
create or replace function public.prog_candidates(pid uuid, off int default 0)
returns table (student_id uuid, name text, halaqa_id uuid, juz int, allowed text[], prev jsonb, groups text[], entered boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.halaqa_id, public.prog_juz_count(pid, s.id), public.prog_allowed(public.prog_juz_count(pid, s.id)),
         public.prog_prev_best(pid, s.id),
         array(select l.label from public.prog_itqan_latest(s.id) l where l.passed and l.a <> l.b
               and not exists (select 1 from program_group_ok g where g.program_id = pid and g.student_id = s.id and g.label = l.label)),
         exists (select 1 from program_entries e where e.program_id = pid and e.student_id = s.id)
  from members s left join halaqat h on h.id = s.halaqa_id
  where s.role = 'student' and coalesce(s.info ->> 'status', '') <> 'منقطع'
    and (public.prog_is_org(pid) or h.supervisor_id in (select public.my_ids()) or h.teacher_id in (select public.my_ids()))
  order by s.name, s.id
  limit 1000 offset greatest(coalesce(off, 0), 0)
$$;

-- إقرار احتساب مجموعة إتقان لأجزائها (المشرف أو من هو أعلى)
create or replace function public.prog_group_approve(pid uuid, sid uuid, lbl text, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me();
begin
  if not public.prog_can_decide(pid, sid) then raise exception 'غير مسموح'; end if;
  if ok then
    insert into program_group_ok (program_id, student_id, label, by_member, by_name) values (pid, sid, lbl, me.id, me.name)
    on conflict do nothing;
  else
    delete from program_group_ok where program_id = pid and student_id = sid and label = lbl;
  end if;
  perform public.prog_log_add(pid, (select id from program_entries where program_id = pid and student_id = sid),
    case when ok then 'group_ok' else 'group_undo' end, jsonb_build_object('student', sid, 'label', lbl));
end $$;

-- التسجيل: طالب مسجل (sid) أو خارجي (ext). يتحقق الخادم من المستوى:
--  المسار العام: خارج المستويين المباشرين، أو مماثل لأعلى مستوى سابق أو أقل → «بانتظار القرار» إلا لصاحب القرار
--  مسار الحلقات: تنبيه فقط ويُكتب في السجل
create or replace function public.prog_register(pid uuid, sid uuid, ex jsonb, trk text, lvl text, amt jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p programs; me members := public.prog_me(); cnt int := 0; al text[]; prev jsonb; w boolean; outside boolean;
  dec boolean; st text := 'active'; tg text[] := '{}'; nid uuid; hid uuid;
begin
  select * into p from programs where id = pid;
  if not found or p.kind <> 'ramadan' or p.status <> 'open' then raise exception 'النسخة غير متاحة'; end if;
  if public.is_blocked() then raise exception 'غير مسموح'; end if;
  if trk not in ('general', 'halaqat') then raise exception 'مسار غير معروف'; end if;
  if lvl is null or public.prog_lvl_ord(lvl) is null then raise exception 'اختر المستوى'; end if;
  if lvl = 'm8' and trk <> 'halaqat' then raise exception 'م8 لمسار الحلقات فقط'; end if;
  if lvl = 'm8' and (amt is null or coalesce(amt ->> 'from', '') = '' or coalesce(amt ->> 'to', '') = '') then raise exception 'حدد المقدار من سورة إلى سورة'; end if;
  if sid is not null then
    select halaqa_id into hid from members where id = sid and role = 'student';
    if not found then raise exception 'الطالب غير موجود'; end if;
    if not (public.prog_is_org(pid) or exists (select 1 from halaqat h where h.id = hid
            and (h.supervisor_id in (select public.my_ids()) or h.teacher_id in (select public.my_ids())))) then
      raise exception 'غير مسموح';
    end if;
    if exists (select 1 from program_entries where program_id = pid and student_id = sid) then raise exception 'الطالب مسجل في هذه النسخة'; end if;
    cnt := public.prog_juz_count(pid, sid);
    prev := public.prog_prev_best(pid, sid);
  else
    if not public.prog_is_org(pid) then raise exception 'إضافة الطالب الخارجي للمنظم'; end if;
    if ex is null or coalesce(trim(ex ->> 'name'), '') = '' then raise exception 'اكتب اسم الطالب'; end if;
  end if;
  dec := public.prog_can_decide(pid, sid);
  w := public.prog_is_warn(prev, lvl, (amt ->> 'pages')::numeric);
  if trk = 'general' then
    al := public.prog_allowed(cnt);
    outside := not (lvl = any(al));
    if (outside or w) then
      tg := tg || case when outside then array['outside'] else '{}' end || case when w then array['warn'] else '{}' end;
      if not dec then st := 'pending'; end if;
    end if;
  elsif w then
    tg := tg || array['warn'];
  end if;
  insert into program_entries (program_id, student_id, ext, track, stage, status, level, amount, tags, created_by, data)
  values (pid, sid, case when sid is null then ex end, trk, case when trk = 'general' then 'tasfiya' else 'halaqat' end,
          st, lvl, case when lvl = 'm8' then amt end, tg, me.id,
          jsonb_build_object('juz', cnt, 'prev', prev))
  returning id into nid;
  perform public.prog_log_add(pid, nid, 'register',
    jsonb_build_object('student', sid, 'ext', ex ->> 'name', 'track', trk, 'level', lvl, 'juz', cnt, 'prev', prev, 'status', st, 'tags', tg),
    w or 'outside' = any(tg));
  return nid;
end $$;

-- قرار المشرف أو من هو أعلى في تسجيل بانتظار القرار: approve | edit (بمستوى جديد) | reject
create or replace function public.prog_decide(eid uuid, dcs text, lvl text) returns void
language plpgsql security definer set search_path = public as $$
declare e program_entries;
begin
  select * into e from program_entries where id = eid;
  if not found then raise exception 'غير موجود'; end if;
  if not public.prog_can_decide(e.program_id, e.student_id) then raise exception 'غير مسموح'; end if;
  if dcs = 'approve' then
    update program_entries set status = 'active', updated_at = now() where id = eid;
  elsif dcs = 'edit' then
    if public.prog_lvl_ord(lvl) is null or (lvl = 'm8' and e.track <> 'halaqat') then raise exception 'مستوى غير صالح'; end if;
    update program_entries set status = 'active', level = lvl, updated_at = now() where id = eid;
  elsif dcs = 'reject' then
    update program_entries set status = 'rejected', updated_at = now() where id = eid;
  else raise exception 'قرار غير معروف'; end if;
  perform public.prog_log_add(e.program_id, eid, 'decide', jsonb_build_object('decision', dcs, 'from', e.level, 'to', coalesce(lvl, e.level)));
end $$;

-- تعديل بيانات التسجيل (المنظم): المستوى، المقدار، المسار، حلقة الخارجي
create or replace function public.prog_entry_edit(eid uuid, lvl text, amt jsonb, ex jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e program_entries; w boolean;
begin
  select * into e from program_entries where id = eid;
  if not found then raise exception 'غير موجود'; end if;
  if not (public.prog_is_org(e.program_id) or (e.track = 'halaqat' and e.stage = 'halaqat' and public.prog_can_see_student(e.program_id, e.student_id)
          and exists (select 1 from members s join halaqat h on h.id = s.halaqa_id where s.id = e.student_id
                      and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))))) then
    raise exception 'غير مسموح';
  end if;
  if lvl is not null and (public.prog_lvl_ord(lvl) is null or (lvl = 'm8' and e.track <> 'halaqat')) then raise exception 'مستوى غير صالح'; end if;
  w := public.prog_is_warn(e.data -> 'prev', coalesce(lvl, e.level), coalesce((amt ->> 'pages')::numeric, (e.amount ->> 'pages')::numeric));
  update program_entries set
    level = coalesce(lvl, level),
    amount = case when coalesce(lvl, level) = 'm8' then coalesce(amt, amount) else null end,
    ext = case when student_id is null and ex is not null then ext || ex else ext end,
    tags = case when w then (select array(select distinct unnest(tags || array['warn']))) else array_remove(tags, 'warn') end,
    updated_at = now()
  where id = eid;
  perform public.prog_log_add(e.program_id, eid, 'edit', jsonb_build_object('level', lvl, 'amount', amt), w);
end $$;

-- الإعفاء من التصفية (السبب إلزامي) — للمشرف في طلاب حلقاته ولمن هو أعلى. يصل إشعار للمديرين العامين والمشرفين المنظمين
create or replace function public.prog_exempt(eid uuid, reason text, on_ boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e program_entries; me members := public.prog_me(); sname text; body text; o uuid;
begin
  select * into e from program_entries where id = eid;
  if not found then raise exception 'غير موجود'; end if;
  if not public.prog_can_decide(e.program_id, e.student_id) then raise exception 'غير مسموح'; end if;
  if e.stage <> 'tasfiya' then raise exception 'التصفية اعتُمدت لهذا الطالب'; end if;
  if on_ and coalesce(trim(reason), '') = '' then raise exception 'سبب الإعفاء إلزامي'; end if;
  update program_entries set
    tags = case when on_ then (select array(select distinct unnest(tags || array['exempt']))) else array_remove(tags, 'exempt') end,
    data = case when on_ then data || jsonb_build_object('exempt', jsonb_build_object('reason', trim(reason), 'by', me.name, 'at', now()))
                else data - 'exempt' end,
    updated_at = now()
  where id = eid;
  perform public.prog_log_add(e.program_id, eid, case when on_ then 'exempt' else 'exempt_undo' end, jsonb_build_object('reason', reason));
  if on_ then
    sname := coalesce((select name from members where id = e.student_id), e.ext ->> 'name');
    body := 'أعفى ' || coalesce(me.name, '') || ' الطالب ' || coalesce(sname, '') || ' (' || upper(replace(e.level, 'm', 'م')) || ') من تصفية '
            || (select name from programs where id = e.program_id) || ' — السبب: ' || trim(reason);
    insert into news (text, audience, date, author_id) values (body, 'gmanager', current_date, me.id);
    for o in select member_id from program_staff where program_id = public.prog_root(e.program_id) and role = 'organizer' and member_id is not null loop
      insert into news (text, audience, date, author_id) values (body, 'm:' || o::text, current_date, me.id);
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------- الرصد
-- من يرصد: المنظم دائمًا؛ المحكّم (tasfiya/general) والمختبِر (halaqat) في نطاقه؛ والحياد يمنع المعلم من طلاب حلقته
create or replace function public.prog_can_score(eid uuid, stg text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e program_entries; p programs; hid uuid; tch uuid;
begin
  select * into e from program_entries where id = eid;
  if not found or e.status <> 'active' or e.stage <> stg then return false; end if;
  if public.prog_is_org(e.program_id) then return true; end if;
  select * into p from programs where id = e.program_id;
  hid := coalesce((select halaqa_id from members where id = e.student_id), nullif(e.ext ->> 'halaqa_id', '')::uuid);
  select teacher_id into tch from halaqat where id = hid;
  if coalesce((p.cfg ->> 'neutral')::boolean, true) and tch in (select public.my_ids()) then return false; end if;
  return exists (
    select 1 from program_staff s
    where s.program_id = e.program_id and s.member_id in (select public.my_ids())
      and s.role = case when stg = 'halaqat' then 'tester' else 'judge' end
      and (coalesce(jsonb_array_length(s.scope -> 'halaqat'), 0) + coalesce(jsonb_array_length(s.scope -> 'entries'), 0) = 0
           or coalesce(s.scope -> 'halaqat', '[]'::jsonb) ? coalesce(hid::text, '-')
           or coalesce(s.scope -> 'entries', '[]'::jsonb) ? eid::text));
end $$;

-- رصد درجة (0..100) أو غياب، مع ملاحظات التجويد، واسم المحكّم الخارجي إن أدخلها المنظم نيابة عنه
create or replace function public.prog_score(eid uuid, stg text, v numeric, absent boolean, notes text[], judge text) returns void
language plpgsql security definer set search_path = public as $$
declare e program_entries; me members := public.prog_me();
begin
  if stg not in ('tasfiya', 'general', 'halaqat') then raise exception 'مرحلة غير معروفة'; end if;
  if public.is_blocked() or not public.prog_can_score(eid, stg) then raise exception 'غير مسموح'; end if;
  if not coalesce(absent, false) and (v is null or v < 0 or v > 100) then raise exception 'الدرجة من 0 إلى 100'; end if;
  select * into e from program_entries where id = eid;
  if e.scores -> stg ? 'approved' then raise exception 'النتيجة معتمدة'; end if;
  update program_entries set scores = scores || jsonb_build_object(stg, jsonb_build_object(
      'v', case when coalesce(absent, false) then null else v end, 'absent', coalesce(absent, false),
      'notes', to_jsonb(coalesce(notes, '{}')), 'judge', nullif(trim(coalesce(judge, '')), ''),
      'by', me.name, 'at', now())),
    updated_at = now()
  where id = eid;
  perform public.prog_log_add(e.program_id, eid, 'score',
    jsonb_build_object('stage', stg, 'v', v, 'absent', absent, 'judge', judge, 'proxy', nullif(trim(coalesce(judge, '')), '') is not null));
end $$;

-- ---------------------------------------------------------------- الاعتماد والانتقال بين المسارين
-- اعتماد التصفية: المعفى ومن بلغ الحد → العامة؛ من لم يبلغه أو غاب → مسار الحلقات (يُختبر في حلقته) مع تنبيه
create or replace function public.prog_approve_tasfiya(pid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare p programs; e program_entries; pass numeric; n int := 0; missing int; sname text;
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  select * into p from programs where id = pid;
  pass := nullif(p.cfg ->> 'tasfiya_pass', '')::numeric;
  if pass is null then raise exception 'حدد حد اجتياز التصفية في الإعدادات'; end if;
  select count(*) into missing from program_entries
  where program_id = pid and status = 'active' and stage = 'tasfiya' and not ('exempt' = any(tags)) and not (scores ? 'tasfiya');
  if missing > 0 then raise exception 'لم تُرصد التصفية لـ % متسابق', missing; end if;
  for e in select * from program_entries where program_id = pid and status = 'active' and stage = 'tasfiya' loop
    if 'exempt' = any(e.tags) or (not coalesce((e.scores -> 'tasfiya' ->> 'absent')::boolean, false) and (e.scores -> 'tasfiya' ->> 'v')::numeric >= pass) then
      update program_entries set stage = 'general', updated_at = now() where id = e.id;
    else
      update program_entries set track = 'halaqat', stage = 'halaqat',
        tags = tags || case when coalesce((e.scores -> 'tasfiya' ->> 'absent')::boolean, false) then array['absent_general'] else array['from_tasfiya'] end,
        updated_at = now() where id = e.id;
      sname := (select name from members where id = e.student_id);
      perform public.prog_notify(e.student_id, public.prog_msg(pid, 'halaqat', 'يُرجى حضور اختبار {النسخة} في حلقتك {الموعد}', sname));
    end if;
    n := n + 1;
  end loop;
  update programs set cfg = cfg || jsonb_build_object('tasfiya_done', now()) where id = pid;
  perform public.prog_log_add(pid, null, 'approve_tasfiya', jsonb_build_object('count', n, 'pass', pass));
  return n;
end $$;

-- اعتماد العامة: من بلغ حد الفوز → فائز (ترتيب داخل المستوى)؛ من لم يبلغه → الحلقات وتثبت درجته؛ الغائب → الحلقات مع تنبيه
create or replace function public.prog_approve_general(pid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare p programs; e program_entries; win numeric; n int := 0; missing int; sname text;
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  select * into p from programs where id = pid;
  win := nullif(p.cfg ->> 'win', '')::numeric;
  if win is null then raise exception 'حدد حد الفوز في الإعدادات'; end if;
  select count(*) into missing from program_entries where program_id = pid and status = 'active' and stage = 'general' and not (scores ? 'general');
  if missing > 0 then raise exception 'لم تُرصد العامة لـ % متسابق', missing; end if;
  for e in select * from program_entries where program_id = pid and status = 'active' and stage = 'general' loop
    if coalesce((e.scores -> 'general' ->> 'absent')::boolean, false) then
      update program_entries set track = 'halaqat', stage = 'halaqat', tags = tags || array['absent_general'], updated_at = now() where id = e.id;
      sname := (select name from members where id = e.student_id);
      perform public.prog_notify(e.student_id, public.prog_msg(pid, 'halaqat', 'يُرجى حضور اختبار {النسخة} في حلقتك {الموعد}', sname));
    elsif (e.scores -> 'general' ->> 'v')::numeric >= win then
      update program_entries set stage = 'done', result = 'winner', updated_at = now() where id = e.id;
    else
      update program_entries set track = 'halaqat', stage = 'halaqat', tags = tags || array['carried'],
        scores = scores || jsonb_build_object('halaqat', (e.scores -> 'general') || jsonb_build_object('carried', true)),
        updated_at = now() where id = e.id;
    end if;
    n := n + 1;
  end loop;
  -- الترتيب داخل كل مستوى بين الفائزين (التساوي = الترتيب نفسه)
  update program_entries x set rank = r.rk, rank_manual = false from (
    select id, rank() over (partition by level order by (scores -> 'general' ->> 'v')::numeric desc) rk
    from program_entries where program_id = pid and result = 'winner') r
  where x.id = r.id and not x.rank_manual;
  update programs set cfg = cfg || jsonb_build_object('general_done', now()) where id = pid;
  perform public.prog_log_add(pid, null, 'approve_general', jsonb_build_object('count', n, 'win', win));
  return n;
end $$;

-- حلقة المتسابق في مسار الحلقات (المسجل: حلقته؛ الخارجي: ما يحدده المنظم)
create or replace function public.prog_entry_halaqa(e program_entries) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select halaqa_id from members where id = e.student_id), nullif(e.ext ->> 'halaqa_id', '')::uuid)
$$;

-- اعتماد نتيجة حلقة: الغائب → خرج؛ من بلغ حد التكريم (أو الكل إن لم يُحدد) → تكريم؛ وإلا لم يبلغ. الترتيب داخل الحلقة والمستوى
create or replace function public.prog_approve_halaqa(pid uuid, hid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare p programs; e program_entries; hon numeric; n int := 0; missing int;
begin
  select * into p from programs where id = pid;
  if not (public.prog_is_org(pid) or exists (select 1 from halaqat where id = hid and supervisor_id in (select public.my_ids()))) then
    raise exception 'غير مسموح';
  end if;
  hon := nullif(p.cfg ->> 'honor_min', '')::numeric;
  select count(*) into missing from program_entries x
  where x.program_id = pid and x.status = 'active' and x.stage = 'halaqat' and public.prog_entry_halaqa(x) = hid and not (x.scores ? 'halaqat');
  if missing > 0 then raise exception 'لم يُرصد اختبار الحلقة لـ % متسابق', missing; end if;
  for e in select * from program_entries x where x.program_id = pid and x.status = 'active' and x.stage = 'halaqat' and public.prog_entry_halaqa(x) = hid loop
    update program_entries set stage = 'done', updated_at = now(),
      result = case when coalesce((e.scores -> 'halaqat' ->> 'absent')::boolean, false) then 'out'
                    when hon is null or (e.scores -> 'halaqat' ->> 'v')::numeric >= hon then 'honor' else 'below' end
    where id = e.id;
    n := n + 1;
  end loop;
  update program_entries x set rank = r.rk, rank_manual = false from (
    select id, rank() over (partition by level order by (scores -> 'halaqat' ->> 'v')::numeric desc) rk
    from program_entries y where y.program_id = pid and y.result = 'honor' and public.prog_entry_halaqa(y) = hid) r
  where x.id = r.id and not x.rank_manual;
  update programs set cfg = jsonb_set(cfg, '{halaqat_state}', coalesce(cfg -> 'halaqat_state', '{}'::jsonb) || jsonb_build_object(hid::text, 'approved'))
  where id = pid;
  perform public.prog_log_add(pid, null, 'approve_halaqa', jsonb_build_object('halaqa', hid, 'count', n, 'honor_min', hon));
  return n;
end $$;

-- تعديل الترتيب يدويًا (المنظم) قبل الإعلان
create or replace function public.prog_rank_set(eid uuid, rk int) returns void
language plpgsql security definer set search_path = public as $$
declare e program_entries;
begin
  select * into e from program_entries where id = eid;
  if not found or not public.prog_is_org(e.program_id) then raise exception 'غير مسموح'; end if;
  if e.result not in ('winner', 'honor') then raise exception 'الترتيب للفائزين والمكرّمين'; end if;
  if e.data ? 'announced' then raise exception 'أُعلنت النتيجة'; end if;
  update program_entries set rank = rk, rank_manual = true, updated_at = now() where id = eid;
  perform public.prog_log_add(e.program_id, eid, 'rank_manual', jsonb_build_object('from', e.rank, 'to', rk));
end $$;

-- الجوائز (يدوية): items = [{id, prize}]. بعد «اعتماد الجوائز» يُسجَّل كل تعديل في السجل
create or replace function public.prog_prizes(pid uuid, items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb; locked boolean;
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  locked := (select cfg ? 'prizes_locked' from programs where id = pid);
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    update program_entries set prize = nullif(it ->> 'prize', '')::numeric, updated_at = now()
    where id = (it ->> 'id')::uuid and program_id = pid and result in ('winner', 'honor');
  end loop;
  perform public.prog_log_add(pid, null, case when locked then 'prizes_after_lock' else 'prizes' end,
    jsonb_build_object('count', jsonb_array_length(coalesce(items, '[]'::jsonb))), locked);
end $$;

create or replace function public.prog_prizes_lock(pid uuid, lck boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  update programs set cfg = case when lck then cfg || jsonb_build_object('prizes_locked', now()) else cfg - 'prizes_locked' end where id = pid;
  perform public.prog_log_add(pid, null, case when lck then 'prizes_lock' else 'prizes_unlock' end, '{}');
end $$;

-- الإعلان: scope = 'general' (الفائزون) أو 'halaqa' (المكرّمون في حلقة hid). الطالب يصله التهنئة فقط
create or replace function public.prog_announce(pid uuid, scp text, hid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e program_entries; n int := 0; sname text;
begin
  if not (public.prog_is_org(pid) or (scp = 'halaqa' and exists (select 1 from halaqat where id = hid and supervisor_id in (select public.my_ids())))) then
    raise exception 'غير مسموح';
  end if;
  if scp = 'halaqa' and coalesce((select cfg -> 'halaqat_state' ->> hid::text from programs where id = pid), '') <> 'approved' then
    raise exception 'اعتمد نتيجة الحلقة أولًا';
  end if;
  for e in select * from program_entries x where x.program_id = pid and not (x.data ? 'announced')
           and ((scp = 'general' and x.result = 'winner') or (scp = 'halaqa' and x.result = 'honor' and public.prog_entry_halaqa(x) = hid)) loop
    sname := (select name from members where id = e.student_id);
    perform public.prog_notify(e.student_id, public.prog_msg(pid, 'congrats', 'مبارك! نجحت في {النسخة}', sname));
    update program_entries set data = data || jsonb_build_object('announced', now()) where id = e.id;
    n := n + 1;
  end loop;
  if scp = 'halaqa' then
    update programs set cfg = jsonb_set(cfg, '{halaqat_state}', cfg -> 'halaqat_state' || jsonb_build_object(hid::text, 'announced')) where id = pid;
  else
    update programs set cfg = cfg || jsonb_build_object('general_announced', now()) where id = pid;
  end if;
  perform public.prog_log_add(pid, null, 'announce', jsonb_build_object('scope', scp, 'halaqa', hid, 'count', n));
  return n;
end $$;

-- تنبيه بالموعد (للمؤهلين إلى التصفية، أو إعادة إرسال بعد تغيير الموعد): key = tasfiya | general | halaqat
create or replace function public.prog_remind(pid uuid, key text) returns int
language plpgsql security definer set search_path = public as $$
declare e program_entries; n int := 0; def text; sname text;
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  def := case key when 'tasfiya' then 'يُرجى حضور اختبار التصفية لـ{النسخة} في {المقر} {الموعد}'
                  when 'general' then 'يُرجى حضور اختبار {النسخة} في {المقر} {الموعد}'
                  else 'يُرجى حضور اختبار {النسخة} في حلقتك {الموعد}' end;
  for e in select * from program_entries where program_id = pid and status = 'active' and stage = key
           and not (key = 'halaqat' and 'carried' = any(tags)) loop
    sname := (select name from members where id = e.student_id);
    perform public.prog_notify(e.student_id, public.prog_msg(pid, key, def, sname));
    n := n + 1;
  end loop;
  perform public.prog_log_add(pid, null, 'remind', jsonb_build_object('key', key, 'count', n));
  return n;
end $$;

-- ---------------------------------------------------------------- القراءة
-- متسابقو النسخة كما يحق للمستخدم رؤيتهم (المنظم الكل؛ المشرف والمعلم والإداري طلاب نطاقهم؛ المختبِر المسندون إليه)
create or replace function public.prog_entries(pid uuid)
returns table (id uuid, student_id uuid, name text, halaqa_id uuid, place_id uuid, ext boolean, track text, stage text, status text,
               level text, amount jsonb, scores jsonb, result text, rank int, rank_manual boolean, prize numeric, tags text[], data jsonb,
               can_score boolean, can_decide boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.student_id, coalesce(s.name, e.ext ->> 'name'), public.prog_entry_halaqa(e), h.place_id, e.student_id is null,
         e.track, e.stage, e.status, e.level, e.amount, e.scores, e.result, e.rank, e.rank_manual,
         case when public.prog_is_org(pid) then e.prize end, e.tags,
         e.data || case when e.student_id is null then jsonb_build_object('ext', e.ext) else '{}'::jsonb end,
         public.prog_can_score(e.id, e.stage), public.prog_can_decide(pid, e.student_id)
  from program_entries e
  left join members s on s.id = e.student_id
  left join halaqat h on h.id = public.prog_entry_halaqa(e)
  where e.program_id = pid and (public.prog_is_org(pid) or public.prog_can_see_student(pid, e.student_id) or public.prog_can_score(e.id, e.stage))
  order by e.level, 3
$$;

create or replace function public.prog_log_list(pid uuid, only_warn boolean default false, lim int default 200, off int default 0)
returns table (id uuid, entry_id uuid, name text, action text, detail jsonb, warn boolean, by_name text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.entry_id, coalesce(s.name, e.ext ->> 'name'), l.action, l.detail, l.warn, l.by_name, l.at
  from program_log l
  left join program_entries e on e.id = l.entry_id
  left join members s on s.id = e.student_id
  where l.program_id = pid and public.prog_is_org(pid) and (not coalesce(only_warn, false) or l.warn)
  order by l.at desc
  limit least(greatest(coalesce(lim, 200), 1), 1000) offset greatest(coalesce(off, 0), 0)
$$;

-- سجل الطالب في المسابقات عبر السنين (ملف الطالب): للطاقم الذي يرى الطالب، لا للطالب
create or replace function public.prog_student_history(sid uuid)
returns table (year int, name text, track text, level text, amount jsonb, score numeric, result text)
language sql stable security definer set search_path = public as $$
  select p.year, p.name, e.track, e.level, e.amount,
         coalesce((e.scores -> 'general' ->> 'v')::numeric, (e.scores -> 'halaqat' ->> 'v')::numeric, (e.data ->> 'score')::numeric),
         e.result
  from program_entries e join programs p on p.id = e.program_id
  where e.student_id = sid and p.kind = 'ramadan' and e.status <> 'rejected'
    and (public.is_admin() or public.is_general_sup() or public.can_teach_student(sid)
         or exists (select 1 from members s where s.id = sid and s.halaqa_id in (select public.my_place_halaqat())))
  order by p.year desc
$$;

-- ---------------------------------------------------------------- استيراد السنوات السابقة (المدير والمدير العام)
-- rows = [{student_id | name, level, score, result, prize, place, teacher}] — تُنشأ نسخة مغلقة للسنة إن لم توجد
create or replace function public.prog_import_year(yr int, rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare pid uuid; r jsonb; n int := 0; sid uuid;
begin
  if not (public.is_admin() or public.is_general_sup()) then raise exception 'غير مسموح'; end if;
  if yr is null or jsonb_typeof(rows) <> 'array' then raise exception 'بيانات غير صالحة'; end if;
  select id into pid from programs where kind = 'ramadan' and parent_id is null and year = yr order by created_at limit 1;
  if pid is null then
    insert into programs (kind, name, year, status, created_by) values ('ramadan', 'مسابقة رمضان ' || yr, yr, 'closed', (public.prog_me()).id)
    returning id into pid;
  end if;
  for r in select * from jsonb_array_elements(rows) loop
    sid := nullif(r ->> 'student_id', '')::uuid;
    if sid is not null and not exists (select 1 from members where id = sid and role = 'student') then sid := null; end if;
    if sid is null and coalesce(trim(r ->> 'name'), '') = '' then continue; end if;
    if sid is not null and exists (select 1 from program_entries where program_id = pid and student_id = sid) then continue; end if;
    if public.prog_lvl_ord(r ->> 'level') is null then continue; end if;
    insert into program_entries (program_id, student_id, ext, track, stage, level, result, prize, data, created_by)
    values (pid, sid, case when sid is null then jsonb_build_object('name', trim(r ->> 'name')) end,
            case when r ->> 'level' = 'm8' then 'halaqat' else 'general' end, 'done', r ->> 'level',
            nullif(r ->> 'result', ''), nullif(r ->> 'prize', '')::numeric,
            jsonb_build_object('imported', true, 'score', r -> 'score', 'place', r ->> 'place', 'teacher', r ->> 'teacher'),
            (public.prog_me()).id);
    n := n + 1;
  end loop;
  perform public.prog_log_add(pid, null, 'import', jsonb_build_object('year', yr, 'count', n));
  return n;
end $$;

-- ---------------------------------------------------------------- الصلاحيات على الدوال
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'prog\_%' or p.proname = 'is_staff_or_more') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
