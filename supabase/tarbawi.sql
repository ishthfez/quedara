-- ============ البرامج — المرحلة الثالثة: البرامج التربوية (tarbawi.js) ============
-- البرنامج programs(kind='tarbawi', parent_id = null) يفتحه مشرف (فيصير منظمه) أو المدير أو المدير العام.
-- حلقات البرنامج = programs(kind='tarbawi', parent_id = البرنامج)، لكل حلقة مدتها واختبارها ونتيجتها وترتيبها وجوائزها.
-- البرنامج بلا حلقات يُعامَل كحلقة واحدة (الوحدة = البرنامج نفسه). الدخول بطلب من الطالب أو بإضافة المنظم.
-- آمن للتكرار. يُنفَّذ بعد programs.sql.
create table if not exists public.tar_entries (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  student_id uuid references public.members(id) on delete cascade,
  ext jsonb,
  status text not null default 'applied' check (status in ('applied', 'accepted', 'rejected')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (student_id is not null or ext ? 'name')
);
create unique index if not exists tar_entries_once on public.tar_entries (program_id, student_id) where student_id is not null;
create table if not exists public.tar_scores (
  entry_id uuid not null references public.tar_entries(id) on delete cascade,
  unit_id uuid not null references public.programs(id) on delete cascade,
  score numeric, absent boolean not null default false,
  rank int, rank_manual boolean not null default false, prize numeric,
  by_name text, at timestamptz not null default now(),
  primary key (entry_id, unit_id)
);
create table if not exists public.tar_att (
  entry_id uuid not null references public.tar_entries(id) on delete cascade,
  unit_id uuid not null references public.programs(id) on delete cascade,
  dt date not null, present boolean not null default true,
  primary key (entry_id, unit_id, dt)
);
do $$ declare t text; begin
  foreach t in array array['tar_entries', 'tar_scores', 'tar_att'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- الوحدة تتبع برنامجها (للتحقق من الصلاحية والانتماء)
create or replace function public.tar_unit_ok(pid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from programs u where u.id = uid and u.kind = 'tarbawi' and (u.id = pid or u.parent_id = pid))
$$;

-- البرامج التي يراها المستخدم: المدير والمدير العام الكل، والمنظم برامجه
create or replace function public.tar_list()
returns table (id uuid, name text, status text, cfg jsonb, is_org boolean, owner text, n_units bigint, n_accepted bigint, n_applied bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.status, p.cfg, public.prog_is_org(p.id),
    (select string_agg(m.name, '، ') from program_staff s join members m on m.id = s.member_id where s.program_id = p.id and s.role = 'organizer'),
    (select count(*) from programs u where u.parent_id = p.id),
    (select count(*) from tar_entries e where e.program_id = p.id and e.status = 'accepted'),
    (select count(*) from tar_entries e where e.program_id = p.id and e.status = 'applied')
  from programs p
  where p.kind = 'tarbawi' and p.parent_id is null and public.prog_is_org(p.id)
  order by p.created_at desc
$$;

create or replace function public.tar_open(nm text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members := public.prog_me(); nid uuid;
begin
  if not (public.is_admin() or public.is_general_sup() or public.has_role('supervisor')) then raise exception 'فتح البرنامج للمشرف'; end if;
  if coalesce(trim(nm), '') = '' then raise exception 'اكتب اسم البرنامج'; end if;
  insert into programs (kind, name, cfg, created_by) values ('tarbawi', trim(nm), '{"test_max":100,"att_weight":0,"apply_open":true}'::jsonb, me.id) returning id into nid;
  if me.role = 'supervisor' then insert into program_staff (program_id, member_id, role) values (nid, me.id, 'organizer'); end if;
  perform public.prog_log_add(nid, null, 'create', jsonb_build_object('name', nm));
  return nid;
end $$;

-- حلقة البرنامج: إضافة أو تعديل (الاسم والإعدادات: البداية والنهاية والمواعيد وموعد الاختبار)
create or replace function public.tar_unit_save(uid uuid, pid uuid, nm text, cf jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if not public.prog_is_org(coalesce(pid, public.prog_root(uid))) then raise exception 'غير مسموح'; end if;
  if uid is null then
    insert into programs (kind, parent_id, name, cfg, created_by) values ('tarbawi', pid, trim(nm), coalesce(cf, '{}'::jsonb), (public.prog_me()).id) returning id into nid;
  else
    update programs set name = coalesce(nullif(trim(nm), ''), name), cfg = cfg || coalesce(cf, '{}'::jsonb) where id = uid and kind = 'tarbawi' and parent_id is not null returning id into nid;
  end if;
  return nid;
end $$;

create or replace function public.tar_unit_del(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org(public.prog_root(uid)) then raise exception 'غير مسموح'; end if;
  delete from programs where id = uid and kind = 'tarbawi' and parent_id is not null;
end $$;

create or replace function public.tar_units(pid uuid)
returns table (id uuid, name text, cfg jsonb)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.cfg from programs u where u.parent_id = pid and u.kind = 'tarbawi' and public.prog_is_org(pid) order by u.created_at
$$;

-- الطالب: البرامج المفتوحة للتقدم، وحاله فيها
create or replace function public.tar_open_list()
returns table (id uuid, name text, cfg jsonb, my_status text, entry_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.cfg, e.status, e.id
  from programs p left join tar_entries e on e.program_id = p.id and e.student_id in (select public.my_ids())
  where p.kind = 'tarbawi' and p.parent_id is null and p.status = 'open'
    and (coalesce((p.cfg ->> 'apply_open')::boolean, true) or e.id is not null)
    and exists (select 1 from members where user_id = auth.uid() and role = 'student')
  order by p.created_at desc
$$;

create or replace function public.tar_apply(pid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; nid uuid;
begin
  select id into sid from members where user_id = auth.uid() and role = 'student' limit 1;
  if sid is null or public.is_blocked() then raise exception 'التقدم للطلاب'; end if;
  if not exists (select 1 from programs where id = pid and kind = 'tarbawi' and parent_id is null and status = 'open' and coalesce((cfg ->> 'apply_open')::boolean, true)) then
    raise exception 'التقدم مغلق';
  end if;
  insert into tar_entries (program_id, student_id) values (pid, sid) on conflict do nothing returning id into nid;
  if nid is null then raise exception 'تقدمت لهذا البرنامج من قبل'; end if;
  perform public.prog_log_add(pid, null, 'apply', jsonb_build_object('student', sid));
  return nid;
end $$;

-- المنظم يضيف طالبًا مسجلًا أو خارجيًا (مقبولًا مباشرة)
create or replace function public.tar_add(pid uuid, sid uuid, ex jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  if sid is null and (ex is null or coalesce(trim(ex ->> 'name'), '') = '') then raise exception 'اكتب اسم الطالب'; end if;
  insert into tar_entries (program_id, student_id, ext, status) values (pid, sid, case when sid is null then ex end, 'accepted')
  on conflict do nothing returning id into nid;
  if nid is null then raise exception 'الطالب في البرنامج'; end if;
  return nid;
end $$;

create or replace function public.tar_decide(eid uuid, st text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; sid uuid;
begin
  select program_id, student_id into pid, sid from tar_entries where id = eid;
  if pid is null or not public.prog_is_org(pid) then raise exception 'غير مسموح'; end if;
  if st not in ('accepted', 'rejected', 'applied') then raise exception 'حال غير معروفة'; end if;
  update tar_entries set status = st where id = eid;
  if st <> 'applied' then
    perform public.prog_notify(sid, case when st = 'accepted' then 'قُبل طلبك في ' else 'لم يُقبل طلبك في ' end || (select name from programs where id = pid));
  end if;
  perform public.prog_log_add(pid, null, 'decide', jsonb_build_object('entry', eid, 'status', st));
end $$;

create or replace function public.tar_entries(pid uuid)
returns table (id uuid, student_id uuid, name text, halaqa_id uuid, ext boolean, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.student_id, coalesce(s.name, e.ext ->> 'name'), s.halaqa_id, e.student_id is null, e.status, e.created_at
  from tar_entries e left join members s on s.id = e.student_id
  where e.program_id = pid and public.prog_is_org(pid)
  order by e.status, 3
$$;

-- الحضور لوحدة في يوم: rows = [{entry, present}]
create or replace function public.tar_att_save(pid uuid, uid uuid, d date, rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  if not public.prog_is_org(pid) or not public.tar_unit_ok(pid, uid) then raise exception 'غير مسموح'; end if;
  for r in select * from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) loop
    if not exists (select 1 from tar_entries where id = (r ->> 'entry')::uuid and program_id = pid and status = 'accepted') then continue; end if;
    insert into tar_att (entry_id, unit_id, dt, present) values ((r ->> 'entry')::uuid, uid, d, coalesce((r ->> 'present')::boolean, true))
    on conflict (entry_id, unit_id, dt) do update set present = excluded.present;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.tar_att(pid uuid, uid uuid)
returns table (entry_id uuid, dt date, present boolean)
language sql stable security definer set search_path = public as $$
  select a.entry_id, a.dt, a.present from tar_att a join tar_entries e on e.id = a.entry_id
  where a.unit_id = uid and e.program_id = pid and public.prog_is_org(pid) order by a.dt
$$;

-- درجات الاختبار لوحدة: items = [{entry, score, absent}]
create or replace function public.tar_score_save(pid uuid, uid uuid, items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; me members := public.prog_me();
begin
  if not public.prog_is_org(pid) or not public.tar_unit_ok(pid, uid) then raise exception 'غير مسموح'; end if;
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    if not exists (select 1 from tar_entries where id = (it ->> 'entry')::uuid and program_id = pid and status = 'accepted') then continue; end if;
    insert into tar_scores (entry_id, unit_id, score, absent, by_name)
    values ((it ->> 'entry')::uuid, uid, nullif(it ->> 'score', '')::numeric, coalesce((it ->> 'absent')::boolean, false), me.name)
    on conflict (entry_id, unit_id) do update set score = excluded.score, absent = excluded.absent, by_name = excluded.by_name, at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- النتيجة لوحدة: الاختبار (من test_max) + الحضور (att_weight × نسبة الحضور) — من إعدادات البرنامج، وتعلوها إعدادات الحلقة
create or replace function public.tar_results(pid uuid, uid uuid)
returns table (entry_id uuid, name text, att_pct numeric, att_pts numeric, score numeric, absent boolean, total numeric, passed boolean, rank int, rank_manual boolean, prize numeric)
language sql stable security definer set search_path = public as $$
  with c as (select (select cfg from programs where id = pid) || coalesce((select cfg from programs where id = uid and id <> pid), '{}'::jsonb) cfg),
  days as (select count(distinct a.dt)::numeric n from tar_att a join tar_entries e on e.id = a.entry_id where a.unit_id = uid and e.program_id = pid),
  b as (
    select e.id, coalesce(s.name, e.ext ->> 'name') nm,
      case when (select n from days) > 0 then round((select count(*) from tar_att a where a.entry_id = e.id and a.unit_id = uid and a.present)::numeric / (select n from days) * 100, 1) end pct,
      t.score, coalesce(t.absent, false) ab, t.rank, coalesce(t.rank_manual, false) rm, t.prize
    from tar_entries e left join members s on s.id = e.student_id left join tar_scores t on t.entry_id = e.id and t.unit_id = uid
    where e.program_id = pid and e.status = 'accepted' and public.prog_is_org(pid) and public.tar_unit_ok(pid, uid))
  select b.id, b.nm, b.pct,
    round(coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0), 2),
    b.score, b.ab,
    round(coalesce(b.score, 0) + coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0), 2),
    case when nullif((select cfg ->> 'pass' from c), '') is null then null
         else coalesce(b.score, 0) + coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0)
              >= ((select cfg ->> 'pass' from c)::numeric / 100) * (coalesce(nullif((select cfg ->> 'test_max' from c), '')::numeric, 100) + coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0)) end,
    b.rank, b.rm, b.prize
  from b
$$;

-- اعتماد نتيجة وحدة: الترتيب بالإجمالي (التساوي = الترتيب نفسه)، ويبقى اليدوي
create or replace function public.tar_approve(pid uuid, uid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.prog_is_org(pid) or not public.tar_unit_ok(pid, uid) then raise exception 'غير مسموح'; end if;
  insert into tar_scores (entry_id, unit_id) select r.entry_id, uid from public.tar_results(pid, uid) r on conflict do nothing;
  with k as (select r.entry_id, rank() over (order by r.total desc) rk from public.tar_results(pid, uid) r where not r.absent)
  update tar_scores t set rank = case when t.rank_manual then t.rank else k.rk end from k where t.entry_id = k.entry_id and t.unit_id = uid;
  get diagnostics n = row_count;
  update programs set cfg = cfg || jsonb_build_object('approved', now()) where id = uid;
  perform public.prog_log_add(pid, null, 'approve', jsonb_build_object('unit', uid, 'count', n));
  return n;
end $$;

create or replace function public.tar_rank_prize(pid uuid, uid uuid, items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; cur int;
begin
  if not public.prog_is_org(pid) or not public.tar_unit_ok(pid, uid) then raise exception 'غير مسموح'; end if;
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    insert into tar_scores (entry_id, unit_id) values ((it ->> 'entry')::uuid, uid) on conflict do nothing;
    select rank into cur from tar_scores where entry_id = (it ->> 'entry')::uuid and unit_id = uid;
    update tar_scores set prize = nullif(it ->> 'prize', '')::numeric,
      rank = coalesce(nullif(it ->> 'rank', '')::int, rank),
      rank_manual = rank_manual or (nullif(it ->> 'rank', '') is not null and (it ->> 'rank')::int is distinct from cur)
    where entry_id = (it ->> 'entry')::uuid and unit_id = uid;
    n := n + 1;
  end loop;
  return n;
end $$;

-- الطالب: برامجه وحلقاتها ومواعيدها وحضوره ودرجته ونتيجته وترتيبه (بلا الجائزة)
create or replace function public.tar_my()
returns table (program_id uuid, program text, cfg jsonb, status text, units jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.cfg, e.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'cfg', u.cfg,
        'present', (select count(*) from tar_att a where a.entry_id = e.id and a.unit_id = u.id and a.present),
        'days', (select count(distinct a.dt) from tar_att a join tar_entries x on x.id = a.entry_id where a.unit_id = u.id and x.program_id = p.id),
        'score', t.score, 'absent', t.absent, 'rank', case when u.cfg ? 'approved' then t.rank end) order by u.created_at)
      from programs u left join tar_scores t on t.entry_id = e.id and t.unit_id = u.id
      where (u.parent_id = p.id) or (u.id = p.id and not exists (select 1 from programs z where z.parent_id = p.id))), '[]'::jsonb)
  from tar_entries e join programs p on p.id = e.program_id
  where e.student_id in (select public.my_ids()) and e.status in ('applied', 'accepted')
  order by p.created_at desc
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'tar\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
notify pgrst, 'reload schema';
