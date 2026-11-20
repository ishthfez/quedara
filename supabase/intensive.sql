-- ============ البرامج — المرحلة الثانية: الدورة المكثفة (intensive.js) ============
-- النسخة العامة programs(kind='intensive', parent_id = null) يفتحها المدير أو المدير العام، ويُسند «المسؤول عن الإعدادات العامة»
-- (program_staff role organizer على النسخة). كل دورة programs(kind='intensive', parent_id = النسخة) يفتحها مشرف ويديرها
-- هو أو من يُسند إليه (organizer على الدورة)، ولا يرى غيرها. prog_is_org يشمل المدير والمدير العام ومنظم النسخة الجذر.
-- لا تسجيلات مالية؛ المرتبات اختيارية للمشرف (cfg.pay = true) ويدوية.
-- وفي آخره: prog_vis_get / prog_vis_set لإخفاء قسم البرامج عن فئات (settings.programs_vis).
-- آمن للتكرار. يُنفَّذ بعد programs.sql. (نُفِّذ على الخادم.)

create table if not exists public.course_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  teacher_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
-- الطلاب: status nominated → selected → passed | failed → accepted (دخل الدورة) | withdrawn
-- track: khatm (ختم: مراجعة) | review (مراجعة فقط) | new (حفظ جديد ومراجعة)
create table if not exists public.course_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.programs(id) on delete cascade,
  student_id uuid references public.members(id) on delete cascade,
  ext jsonb,
  status text not null default 'nominated' check (status in ('nominated', 'selected', 'passed', 'failed', 'accepted', 'withdrawn')),
  track text check (track in ('khatm', 'review', 'new')),
  group_id uuid references public.course_groups(id) on delete set null,
  target text, tasfiya jsonb, terms jsonb, final numeric, rank int,
  rank_manual boolean not null default false, prize numeric,
  data jsonb not null default '{}'::jsonb, nominated_by uuid,
  created_at timestamptz not null default now(),
  check (student_id is not null or ext ? 'name')
);
create unique index if not exists course_entries_once on public.course_entries (course_id, student_id) where student_id is not null;
-- الكراسة اليومية: لكل طالب في كل يوم دوام سطر واحد (وجوده = حضور، إلا present = false)
create table if not exists public.course_daily (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.course_entries(id) on delete cascade,
  dt date not null,
  present boolean not null default true,
  new_pages numeric, rev_pages numeric, course_grade numeric,
  home_pages numeric, home_grade numeric, note text,
  by_member uuid, by_name text, at timestamptz not null default now(),
  unique (entry_id, dt)
);
create table if not exists public.course_weekly (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.course_entries(id) on delete cascade,
  wk int not null, dt date, score numeric, absent boolean not null default false,
  by_member uuid, by_name text, at timestamptz not null default now(),
  unique (entry_id, wk)
);
create table if not exists public.course_points (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.course_entries(id) on delete cascade,
  pts numeric not null, reason text not null, dt date not null default current_date,
  by_member uuid, by_name text, at timestamptz not null default now()
);
create table if not exists public.course_teacher_att (
  course_id uuid not null references public.programs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  dt date not null, t_in time, t_out time,
  by_name text, edited boolean not null default false, at timestamptz not null default now(),
  primary key (course_id, member_id, dt)
);
create table if not exists public.course_pay (
  course_id uuid not null references public.programs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  basic numeric, incentive numeric, distinction numeric,
  primary key (course_id, member_id)
);
do $$ declare t text; begin
  foreach t in array array['course_groups', 'course_entries', 'course_daily', 'course_weekly', 'course_points', 'course_teacher_att', 'course_pay'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- الصلاحيات
create or replace function public.crs_course(eid uuid) returns uuid
language sql stable security definer set search_path = public as $$ select course_id from course_entries where id = eid $$;
-- معلم مجموعة الطالب
create or replace function public.crs_is_group_teacher(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_entries e join course_groups g on g.id = e.group_id
                 where e.id = eid and g.teacher_id in (select public.my_ids()))
$$;
-- يرصد الكراسة: المنظم ومعلم المجموعة
create or replace function public.crs_can_daily(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prog_is_org(public.crs_course(eid)) or public.crs_is_group_teacher(eid)
$$;
-- يرصد الاختبار الأسبوعي: المنظم، والمختبِر المسند (scope.groups)، ومعلم المجموعة إن سمحت الإعدادات (weekly_teacher، الافتراضي نعم)
create or replace function public.crs_can_weekly(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prog_is_org(public.crs_course(eid))
    or (coalesce(((select cfg from programs where id = public.crs_course(eid)) ->> 'weekly_teacher')::boolean, true) and public.crs_is_group_teacher(eid))
    or exists (select 1 from program_staff s join course_entries e on e.id = eid
               where s.program_id = e.course_id and s.role = 'tester' and s.member_id in (select public.my_ids())
                 and (coalesce(jsonb_array_length(s.scope -> 'groups'), 0) = 0 or coalesce(s.scope -> 'groups', '[]'::jsonb) ? coalesce(e.group_id::text, '-')))
$$;
-- يرى الدورة: المنظم، ومعلمو مجموعاتها، والمختبِرون فيها
create or replace function public.crs_can_see(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.prog_is_org(cid)
    or exists (select 1 from course_groups g where g.course_id = cid and g.teacher_id in (select public.my_ids()))
    or exists (select 1 from program_staff s where s.program_id = cid and s.member_id in (select public.my_ids()))
$$;

-- ---------------------------------------------------------------- النسخ والدورات
create or replace function public.crs_list(root uuid)
returns table (id uuid, name text, status text, cfg jsonb, is_org boolean, n_students bigint, owner text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status, p.cfg, public.prog_is_org(p.id),
         (select count(*) from course_entries e where e.course_id = p.id and e.status = 'accepted'),
         (select string_agg(m.name, '، ') from program_staff s join members m on m.id = s.member_id where s.program_id = p.id and s.role = 'organizer')
  from programs p
  where p.parent_id = root and p.kind = 'intensive' and public.crs_can_see(p.id)
  order by p.created_at
$$;
-- فتح دورة: أي مشرف (أو المدير والمدير العام) تحت نسخة مفتوحة؛ يصير الفاتح منظمها، وترث الدورة إعدادات النسخة
create or replace function public.crs_open(root uuid, nm text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r programs; me members := public.prog_me(); nid uuid;
begin
  select * into r from programs where id = root and kind = 'intensive' and parent_id is null;
  if not found or r.status <> 'open' then raise exception 'النسخة غير متاحة'; end if;
  if not (public.is_admin() or public.is_general_sup() or public.has_role('supervisor')) then raise exception 'فتح الدورة للمشرف'; end if;
  if coalesce(trim(nm), '') = '' then raise exception 'اكتب اسم الدورة'; end if;
  insert into programs (kind, parent_id, name, year, cfg, created_by) values ('intensive', root, trim(nm), r.year, r.cfg, me.id) returning id into nid;
  if me.role = 'supervisor' then
    insert into program_staff (program_id, member_id, role) values (nid, me.id, 'organizer');
  end if;
  perform public.prog_log_add(nid, null, 'create', jsonb_build_object('name', nm));
  return nid;
end $$;
create or replace function public.crs_group_save(gid uuid, cid uuid, nm text, tid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if not public.prog_is_org(coalesce(cid, (select course_id from course_groups where id = gid))) then raise exception 'غير مسموح'; end if;
  if gid is null then
    insert into course_groups (course_id, name, teacher_id) values (cid, trim(nm), tid) returning id into nid;
  else
    update course_groups set name = coalesce(nullif(trim(nm), ''), name), teacher_id = tid where id = gid returning id into nid;
  end if;
  return nid;
end $$;
create or replace function public.crs_group_del(gid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org((select course_id from course_groups where id = gid)) then raise exception 'غير مسموح'; end if;
  delete from course_groups where id = gid;
end $$;
create or replace function public.crs_groups(cid uuid)
returns table (id uuid, name text, teacher_id uuid, teacher text, n bigint)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.teacher_id, m.name, (select count(*) from course_entries e where e.group_id = g.id and e.status = 'accepted')
  from course_groups g left join members m on m.id = g.teacher_id
  where g.course_id = cid and public.crs_can_see(cid)
  order by g.created_at
$$;

-- ---------------------------------------------------------------- الطلاب: الترشيح والانتقاء والتصفية والشروط
-- الترشيح: معلم حلقة الطالب أو مشرفها أو منظم الدورة. الخارجي يضيفه المنظم مباشرة إلى التصفية
create or replace function public.crs_nominate(cid uuid, sid uuid, ex jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me(); nid uuid; c programs; other text;
begin
  select * into c from programs where id = cid and kind = 'intensive' and parent_id is not null;
  if not found or c.status <> 'open' then raise exception 'الدورة غير متاحة'; end if;
  if sid is not null then
    if not (public.prog_is_org(cid) or public.can_teach_student(sid)) then raise exception 'غير مسموح'; end if;
    select string_agg(p.name, '، ') into other from course_entries e join programs p on p.id = e.course_id
    where e.student_id = sid and p.parent_id = c.parent_id and p.id <> cid and e.status not in ('withdrawn', 'failed');
    insert into course_entries (course_id, student_id, status, nominated_by, data)
    values (cid, sid, 'nominated', me.id, case when other is not null then jsonb_build_object('other_course', true) else '{}'::jsonb end)
    on conflict do nothing returning id into nid;
    if nid is null then raise exception 'الطالب مرشح في هذه الدورة'; end if;
  else
    if not public.prog_is_org(cid) then raise exception 'إضافة الخارجي للمنظم'; end if;
    if ex is null or coalesce(trim(ex ->> 'name'), '') = '' then raise exception 'اكتب اسم الطالب'; end if;
    insert into course_entries (course_id, ext, status, nominated_by) values (cid, ex, 'selected', me.id) returning id into nid;
  end if;
  perform public.prog_log_add(cid, null, 'nominate', jsonb_build_object('student', sid, 'ext', ex ->> 'name', 'other_course', other is not null), other is not null);
  return nid;
end $$;
-- تغيير الحال (المنظم): select | unselect | withdraw | restore | accept (الموافقة على الشروط يدويًا)
create or replace function public.crs_set_status(eid uuid, act text) returns void
language plpgsql security definer set search_path = public as $$
declare e course_entries; me members := public.prog_me();
begin
  select * into e from course_entries where id = eid;
  if not found or not public.prog_is_org(e.course_id) then raise exception 'غير مسموح'; end if;
  if act = 'select' then update course_entries set status = 'selected' where id = eid and status = 'nominated';
  elsif act = 'unselect' then update course_entries set status = 'nominated' where id = eid and status = 'selected';
  elsif act = 'withdraw' then update course_entries set status = 'withdrawn' where id = eid;
  elsif act = 'restore' then update course_entries set status = case when terms ? 'at' then 'accepted' when tasfiya is not null then 'passed' else 'nominated' end where id = eid;
  elsif act = 'accept' then
    if e.status not in ('passed', 'accepted') then raise exception 'الموافقة على الشروط بعد اجتياز التصفية'; end if;
    update course_entries set status = 'accepted', terms = jsonb_build_object('at', now(), 'by', me.name, 'manual', true) where id = eid;
  else raise exception 'إجراء غير معروف'; end if;
  perform public.prog_log_add(e.course_id, null, 'status', jsonb_build_object('entry', eid, 'act', act));
end $$;
-- رصد التصفية (المنظم): النجاح من نسبة النجاح في إعدادات الدورة
create or replace function public.crs_tasfiya(eid uuid, v numeric, absent boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e course_entries; pass numeric; me members := public.prog_me(); ok boolean;
begin
  select * into e from course_entries where id = eid;
  if not found or not public.prog_is_org(e.course_id) then raise exception 'غير مسموح'; end if;
  if e.status not in ('selected', 'passed', 'failed') then raise exception 'التصفية للمنتقَين'; end if;
  pass := nullif((select cfg ->> 'tasfiya_pass' from programs where id = e.course_id), '')::numeric;
  if pass is null then raise exception 'حدد نسبة النجاح في الإعدادات'; end if;
  ok := not coalesce(absent, false) and v >= pass;
  update course_entries set tasfiya = jsonb_build_object('v', v, 'absent', coalesce(absent, false), 'by', me.name, 'at', now()),
    status = case when ok then 'passed' else 'failed' end where id = eid;
  perform public.prog_log_add(e.course_id, null, 'tasfiya', jsonb_build_object('entry', eid, 'v', v, 'absent', absent, 'pass', ok));
end $$;
-- إرسال الشروط من التطبيق لمن اجتاز (إن رأى المشرف ذلك؛ وإلا تكفي الموافقة اليدوية)
create or replace function public.crs_send_terms(cid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e course_entries; n int := 0; body text;
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  body := coalesce(nullif((select cfg ->> 'terms' from programs where id = cid), ''), (select cfg ->> 'terms' from programs where id = (select parent_id from programs where id = cid)));
  if coalesce(body, '') = '' then raise exception 'اكتب نص الشروط في الإعدادات'; end if;
  for e in select * from course_entries where course_id = cid and status = 'passed' and student_id is not null and not (coalesce(terms, '{}'::jsonb) ? 'sent') loop
    perform public.prog_notify(e.student_id, 'شروط ' || (select name from programs where id = cid) || ': ' || body || ' — للموافقة افتح «دورتي».');
    update course_entries set terms = coalesce(terms, '{}'::jsonb) || jsonb_build_object('sent', now()) where id = e.id;
    n := n + 1;
  end loop;
  perform public.prog_log_add(cid, null, 'terms_sent', jsonb_build_object('count', n));
  return n;
end $$;
-- الطالب يوافق على الشروط من حسابه
create or replace function public.crs_accept_terms(eid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e course_entries;
begin
  select * into e from course_entries where id = eid and student_id in (select public.my_ids());
  if not found or e.status <> 'passed' then raise exception 'غير متاح'; end if;
  update course_entries set status = 'accepted', terms = coalesce(terms, '{}'::jsonb) || jsonb_build_object('at', now(), 'by', 'الطالب', 'manual', false) where id = eid;
  perform public.prog_log_add(e.course_id, null, 'terms_accept', jsonb_build_object('entry', eid));
end $$;
-- إسناد المسار والمجموعة والهدف (المنظم)
create or replace function public.crs_assign(eid uuid, trk text, gid uuid, tgt text) returns void
language plpgsql security definer set search_path = public as $$
declare e course_entries;
begin
  select * into e from course_entries where id = eid;
  if not found or not public.prog_is_org(e.course_id) then raise exception 'غير مسموح'; end if;
  if trk is not null and trk not in ('khatm', 'review', 'new') then raise exception 'مسار غير معروف'; end if;
  if gid is not null and not exists (select 1 from course_groups where id = gid and course_id = e.course_id) then raise exception 'مجموعة غير صالحة'; end if;
  update course_entries set track = coalesce(trk, track), group_id = gid, target = nullif(trim(coalesce(tgt, '')), '') where id = eid;
end $$;
create or replace function public.crs_entries(cid uuid)
returns table (id uuid, student_id uuid, name text, halaqa_id uuid, ext boolean, status text, track text, group_id uuid, target text,
               tasfiya jsonb, terms jsonb, final numeric, rank int, rank_manual boolean, prize numeric, data jsonb, can_daily boolean, can_weekly boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.student_id, coalesce(s.name, e.ext ->> 'name'), s.halaqa_id, e.student_id is null, e.status, e.track, e.group_id, e.target,
         e.tasfiya, e.terms, e.final, e.rank, e.rank_manual, case when public.prog_is_org(cid) then e.prize end,
         e.data || case when e.student_id is null then jsonb_build_object('ext', e.ext) else '{}'::jsonb end,
         public.crs_can_daily(e.id), public.crs_can_weekly(e.id)
  from course_entries e left join members s on s.id = e.student_id
  where e.course_id = cid and (public.prog_is_org(cid) or public.crs_is_group_teacher(e.id) or public.crs_can_weekly(e.id)
        or (e.status = 'nominated' and e.nominated_by in (select public.my_ids())))
  order by 3
$$;

-- ---------------------------------------------------------------- الكراسة والاختبارات والنقاط
-- رصد يوم: rows = [{entry, present, new_pages, rev_pages, course_grade, home_pages, home_grade, note, clear}]
create or replace function public.crs_daily_save(cid uuid, d date, rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r jsonb; me members := public.prog_me(); n int := 0; eid uuid;
begin
  if d is null or d > current_date + 1 then raise exception 'تاريخ غير صالح'; end if;
  for r in select * from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) loop
    eid := (r ->> 'entry')::uuid;
    if public.crs_course(eid) <> cid or not public.crs_can_daily(eid) then continue; end if;
    if not exists (select 1 from course_entries where id = eid and status = 'accepted') then continue; end if;
    if coalesce((r ->> 'clear')::boolean, false) then delete from course_daily where entry_id = eid and dt = d; n := n + 1; continue; end if;
    insert into course_daily (entry_id, dt, present, new_pages, rev_pages, course_grade, home_pages, home_grade, note, by_member, by_name)
    values (eid, d, coalesce((r ->> 'present')::boolean, true), nullif(r ->> 'new_pages', '')::numeric, nullif(r ->> 'rev_pages', '')::numeric,
            nullif(r ->> 'course_grade', '')::numeric, nullif(r ->> 'home_pages', '')::numeric, nullif(r ->> 'home_grade', '')::numeric,
            nullif(r ->> 'note', ''), me.id, me.name)
    on conflict (entry_id, dt) do update set present = excluded.present, new_pages = excluded.new_pages, rev_pages = excluded.rev_pages,
      course_grade = excluded.course_grade, home_pages = excluded.home_pages, home_grade = excluded.home_grade, note = excluded.note,
      by_member = excluded.by_member, by_name = excluded.by_name, at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.crs_daily(cid uuid, d1 date, d2 date)
returns table (entry_id uuid, dt date, present boolean, new_pages numeric, rev_pages numeric, course_grade numeric, home_pages numeric, home_grade numeric, note text)
language sql stable security definer set search_path = public as $$
  select x.entry_id, x.dt, x.present, x.new_pages, x.rev_pages, x.course_grade, x.home_pages, x.home_grade, x.note
  from course_daily x join course_entries e on e.id = x.entry_id
  where e.course_id = cid and x.dt between coalesce(d1, '2000-01-01') and coalesce(d2, '2999-01-01')
    and (public.prog_is_org(cid) or public.crs_is_group_teacher(e.id))
  order by x.dt, x.entry_id
$$;
create or replace function public.crs_weekly_save(eid uuid, w int, d date, v numeric, absent boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me(); mx numeric;
begin
  if not public.crs_can_weekly(eid) then raise exception 'غير مسموح'; end if;
  mx := coalesce(nullif((select cfg ->> 'weekly_max' from programs where id = public.crs_course(eid)), '')::numeric, 30);
  if not coalesce(absent, false) and (v is null or v < 0 or v > mx) then raise exception 'الدرجة من 0 إلى %', mx; end if;
  insert into course_weekly (entry_id, wk, dt, score, absent, by_member, by_name)
  values (eid, w, d, case when coalesce(absent, false) then null else v end, coalesce(absent, false), me.id, me.name)
  on conflict (entry_id, wk) do update set dt = excluded.dt, score = excluded.score, absent = excluded.absent, by_member = excluded.by_member, by_name = excluded.by_name, at = now();
end $$;
create or replace function public.crs_weekly(cid uuid)
returns table (entry_id uuid, wk int, dt date, score numeric, absent boolean)
language sql stable security definer set search_path = public as $$
  select w.entry_id, w.wk, w.dt, w.score, w.absent from course_weekly w join course_entries e on e.id = w.entry_id
  where e.course_id = cid and (public.prog_is_org(cid) or public.crs_is_group_teacher(e.id) or public.crs_can_weekly(e.id))
$$;
-- النقاط: يمنحها المنظم لعدة طلاب مرة واحدة
create or replace function public.crs_points_add(cid uuid, entries uuid[], p numeric, why text) returns int
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me(); n int;
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  if coalesce(trim(why), '') = '' or p is null then raise exception 'اكتب النقاط وسببها'; end if;
  insert into course_points (entry_id, pts, reason, by_member, by_name)
  select e.id, p, trim(why), me.id, me.name from course_entries e where e.id = any(entries) and e.course_id = cid and e.status = 'accepted';
  get diagnostics n = row_count;
  perform public.prog_log_add(cid, null, 'points', jsonb_build_object('count', n, 'pts', p, 'reason', why));
  return n;
end $$;
create or replace function public.crs_points(cid uuid)
returns table (id uuid, entry_id uuid, pts numeric, reason text, dt date, by_name text)
language sql stable security definer set search_path = public as $$
  select x.id, x.entry_id, x.pts, x.reason, x.dt, x.by_name from course_points x join course_entries e on e.id = x.entry_id
  where e.course_id = cid and public.prog_is_org(cid) order by x.dt desc
$$;
create or replace function public.crs_points_del(pid_ uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org((select e.course_id from course_points x join course_entries e on e.id = x.entry_id where x.id = pid_)) then raise exception 'غير مسموح'; end if;
  delete from course_points where id = pid_;
end $$;
-- الاختبار النهائي (خارجي؛ تُسجَّل الدرجة فقط) — للمنظم
create or replace function public.crs_final_save(items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; eid uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    eid := (it ->> 'id')::uuid;
    if not public.prog_is_org(public.crs_course(eid)) then continue; end if;
    update course_entries set final = nullif(it ->> 'final', '')::numeric where id = eid;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- النتيجة والترتيب والجوائز
-- البنود من cfg.result = {attendance, points, weekly, final, daily} (الدرجات العظمى، 0 = لا يدخل)،
-- الانتظام = أيام الحضور ÷ أيام الدوام المسجلة في الدورة. الفئة: cfg.categories (الافتراضي: الخاتمون / غير الخاتمين)
create or replace function public.crs_results(cid uuid)
returns table (id uuid, name text, track text, category text, attendance numeric, points numeric, weekly numeric, final numeric, daily numeric,
               total numeric, pages numeric, rank int, rank_manual boolean, prize numeric)
language sql stable security definer set search_path = public as $$
  with c as (select cfg from programs where id = cid),
  rs as (select coalesce((select cfg -> 'result' from c), '{"attendance":120,"points":40,"weekly":90,"final":100}'::jsonb) r),
  days as (select count(distinct x.dt)::numeric n from course_daily x join course_entries e on e.id = x.entry_id where e.course_id = cid),
  wks as (select greatest(count(distinct w.wk), 1)::numeric n from course_weekly w join course_entries e on e.id = w.entry_id where e.course_id = cid),
  base as (
    select e.id, coalesce(s.name, e.ext ->> 'name') as name, e.track,
      coalesce((select cfg -> 'categories' ->> e.track from c), case when e.track = 'khatm' then 'الخاتمون' else 'غير الخاتمين' end) as category,
      (select count(*) from course_daily x where x.entry_id = e.id and x.present)::numeric as pres,
      (select coalesce(sum(pts), 0) from course_points x where x.entry_id = e.id) as pts,
      (select coalesce(sum(score), 0) from course_weekly x where x.entry_id = e.id) as wsum,
      (select avg(coalesce(course_grade, 0) + coalesce(home_grade, 0)) from course_daily x where x.entry_id = e.id and x.present) as davg,
      (select coalesce(sum(coalesce(new_pages, 0) + coalesce(rev_pages, 0) + coalesce(home_pages, 0)), 0) from course_daily x where x.entry_id = e.id) as pages,
      e.final as fin, e.rank, e.rank_manual, e.prize
    from course_entries e left join members s on s.id = e.student_id
    where e.course_id = cid and e.status = 'accepted' and public.prog_is_org(cid))
  select b.id, b.name, b.track, b.category,
    round(case when (select n from days) > 0 then b.pres / (select n from days) * coalesce((rs.r ->> 'attendance')::numeric, 0) else 0 end, 2),
    least(b.pts, coalesce((rs.r ->> 'points')::numeric, 0)),
    round(b.wsum / ((select n from wks) * coalesce(nullif((select cfg ->> 'weekly_max' from c), '')::numeric, 30)) * coalesce((rs.r ->> 'weekly')::numeric, 0), 2),
    round(coalesce(b.fin, 0) / coalesce(nullif((select cfg ->> 'final_max' from c), '')::numeric, 100) * coalesce((rs.r ->> 'final')::numeric, 0), 2),
    round(case when coalesce((rs.r ->> 'daily')::numeric, 0) > 0 then coalesce(b.davg, 0) / greatest(coalesce(nullif((select cfg ->> 'daily_max' from c), '')::numeric, 20), 1) * (rs.r ->> 'daily')::numeric else 0 end, 2),
    0::numeric, b.pages, b.rank, b.rank_manual, b.prize
  from base b, rs
$$;
-- اعتماد النتيجة: يحفظ الإجمالي ويرتب داخل كل فئة (التساوي = الترتيب نفسه)، ما لم يُعدَّل يدويًا
create or replace function public.crs_approve(cid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  with r as (select id, category, attendance + points + weekly + final + daily as tot from public.crs_results(cid)),
  k as (select id, tot, rank() over (partition by category order by tot desc) rk from r)
  update course_entries e set data = e.data || jsonb_build_object('total', k.tot), rank = case when e.rank_manual then e.rank else k.rk end
  from k where e.id = k.id;
  get diagnostics n = row_count;
  update programs set cfg = cfg || jsonb_build_object('approved', now()) where id = cid;
  perform public.prog_log_add(cid, null, 'approve', jsonb_build_object('count', n));
  return n;
end $$;
create or replace function public.crs_rank_prize(items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; eid uuid; e course_entries;
begin
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    eid := (it ->> 'id')::uuid;
    select * into e from course_entries where id = eid;
    if not found or not public.prog_is_org(e.course_id) then continue; end if;
    update course_entries set prize = nullif(it ->> 'prize', '')::numeric,
      rank = case when nullif(it ->> 'rank', '') is not null and (it ->> 'rank')::int is distinct from e.rank then (it ->> 'rank')::int else rank end,
      rank_manual = rank_manual or (nullif(it ->> 'rank', '') is not null and (it ->> 'rank')::int is distinct from e.rank)
    where id = eid;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- حضور المعلمين والمرتبات
create or replace function public.crs_tatt_save(cid uuid, mid uuid, d date, tin time, tout time) returns void
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me();
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  insert into course_teacher_att (course_id, member_id, dt, t_in, t_out, by_name) values (cid, mid, d, tin, tout, me.name)
  on conflict (course_id, member_id, dt) do update set t_in = excluded.t_in, t_out = excluded.t_out, by_name = excluded.by_name, edited = true, at = now();
  if found and exists (select 1 from course_teacher_att where course_id = cid and member_id = mid and dt = d and edited) then
    perform public.prog_log_add(cid, null, 'tatt_edit', jsonb_build_object('member', mid, 'dt', d, 'in', tin, 'out', tout));
  end if;
end $$;
-- كشف حضور المعلمين: المدة المطلوبة cfg.t_required (مثل '03:10')
create or replace function public.crs_tatt(cid uuid)
returns table (member_id uuid, name text, dt date, t_in time, t_out time, mins int, late int, edited boolean)
language sql stable security definer set search_path = public as $$
  select a.member_id, m.name, a.dt, a.t_in, a.t_out,
    case when a.t_in is not null and a.t_out is not null then (extract(epoch from (a.t_out - a.t_in)) / 60)::int end,
    case when a.t_in is not null and a.t_out is not null then
      greatest(0, (extract(epoch from coalesce(nullif((select cfg ->> 't_required' from programs where id = cid), '')::interval, '03:00'::interval)) / 60)::int
                  - (extract(epoch from (a.t_out - a.t_in)) / 60)::int) end,
    a.edited
  from course_teacher_att a join members m on m.id = a.member_id
  where a.course_id = cid and public.prog_is_org(cid)
  order by a.dt, m.name
$$;
create or replace function public.crs_pay_save(cid uuid, mid uuid, b numeric, i numeric, d numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  insert into course_pay (course_id, member_id, basic, incentive, distinction) values (cid, mid, b, i, d)
  on conflict (course_id, member_id) do update set basic = excluded.basic, incentive = excluded.incentive, distinction = excluded.distinction;
end $$;
-- المرتبات: أساسي + حافز + تميز − دقائق التأخير × قيمة الدقيقة (cfg.late_rate)
create or replace function public.crs_pay(cid uuid)
returns table (member_id uuid, name text, days bigint, late_mins bigint, basic numeric, incentive numeric, distinction numeric, deduction numeric, salary numeric)
language sql stable security definer set search_path = public as $$
  with t as (select * from public.crs_tatt(cid)),
  staff as (select distinct teacher_id as mid from course_groups where course_id = cid and teacher_id is not null
            union select member_id from course_teacher_att where course_id = cid
            union select member_id from course_pay where course_id = cid),
  rate as (select coalesce(nullif((select cfg ->> 'late_rate' from programs where id = cid), '')::numeric, 0) r)
  select s.mid, m.name, (select count(*) from t where t.member_id = s.mid), (select coalesce(sum(late), 0) from t where t.member_id = s.mid),
    p.basic, p.incentive, p.distinction,
    (select coalesce(sum(late), 0) from t where t.member_id = s.mid) * (select r from rate),
    coalesce(p.basic, 0) + coalesce(p.incentive, 0) + coalesce(p.distinction, 0) - (select coalesce(sum(late), 0) from t where t.member_id = s.mid) * (select r from rate)
  from staff s join members m on m.id = s.mid left join course_pay p on p.course_id = cid and p.member_id = s.mid
  where public.prog_is_org(cid)
  order by m.name
$$;

-- ---------------------------------------------------------------- الطالب: «دورتي» (الكراسة والأسبوعي، لا النهائي ولا النتيجة)
create or replace function public.crs_my()
returns table (entry_id uuid, course text, status text, track text, terms jsonb, terms_text text, daily jsonb, weekly jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, p.name, e.status, e.track, e.terms,
    case when e.status = 'passed' and e.terms ? 'sent' then coalesce(nullif(p.cfg ->> 'terms', ''), (select cfg ->> 'terms' from programs where id = p.parent_id)) end,
    coalesce((select jsonb_agg(jsonb_build_object('dt', x.dt, 'present', x.present, 'new', x.new_pages, 'rev', x.rev_pages, 'cg', x.course_grade, 'home', x.home_pages, 'hg', x.home_grade) order by x.dt)
              from course_daily x where x.entry_id = e.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('wk', w.wk, 'score', w.score, 'absent', w.absent) order by w.wk) from course_weekly w where w.entry_id = e.id), '[]'::jsonb)
  from course_entries e join programs p on p.id = e.course_id
  where e.student_id in (select public.my_ids()) and e.status in ('passed', 'accepted') and p.status = 'open'
  order by p.created_at desc
$$;

-- ---------------------------------------------------------------- التقرير الإجمالي (المدير والمدير العام ومنظم النسخة)
create or replace function public.crs_overview(root uuid)
returns table (course_id uuid, name text, owner text, groups bigint, teachers bigint, students bigint, khatm bigint, pages numeric, days bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name,
    (select string_agg(m.name, '، ') from program_staff s join members m on m.id = s.member_id where s.program_id = p.id and s.role = 'organizer'),
    (select count(*) from course_groups g where g.course_id = p.id),
    (select count(distinct teacher_id) from course_groups g where g.course_id = p.id),
    (select count(*) from course_entries e where e.course_id = p.id and e.status = 'accepted'),
    (select count(*) from course_entries e where e.course_id = p.id and e.status = 'accepted' and e.track = 'khatm'),
    (select coalesce(sum(coalesce(x.new_pages, 0) + coalesce(x.rev_pages, 0) + coalesce(x.home_pages, 0)), 0) from course_daily x join course_entries e on e.id = x.entry_id where e.course_id = p.id),
    (select count(distinct x.dt) from course_daily x join course_entries e on e.id = x.entry_id where e.course_id = p.id)
  from programs p
  where p.parent_id = root and p.kind = 'intensive' and public.prog_is_org(root)
  order by p.created_at
$$;

-- ---------------------------------------------------------------- إظهار قسم البرامج لكل فئة (المدير يرى القسم دائمًا)
-- settings.programs_vis = {hidden: ['gmanager' | 'supervisor' | 'teacher' | 'placeadmin' | 'student']}
create or replace function public.prog_vis_get() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from settings where key = 'programs_vis'), '{}'::jsonb)
$$;
create or replace function public.prog_vis_set(v jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  insert into settings (key, value) values ('programs_vis', coalesce(v, '{}'::jsonb))
  on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.prog_vis_get(), public.prog_vis_set(jsonb) from public, anon;
grant execute on function public.prog_vis_get(), public.prog_vis_set(jsonb) to authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'crs\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
