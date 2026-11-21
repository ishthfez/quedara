-- =====================================================================
--  إصلاح حضور معلمي الدورة المكثفة ومرتباتهم (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى، وهو آمن للتكرار.
--  إن أعدت تنفيذ intensive.sql لاحقًا فأعد تنفيذ هذا الملف بعدها.
-- =====================================================================

-- 1) مدة الحضور: الانصراف بعد منتصف الليل (حصة تمتد لما بعد 12) كانت مدة سالبة فيتضخم «التأخير» ويُخصم من الراتب.
--    الآن الانصراف قبل الحضور = في اليوم التالي. باقي الدالة كما في intensive.sql.
create or replace function public.crs_tatt(cid uuid)
returns table (member_id uuid, name text, dt date, t_in time, t_out time, mins int, late int, edited boolean)
language sql stable security definer set search_path = public as $$
  select a.member_id, m.name, a.dt, a.t_in, a.t_out,
    case when a.t_in is not null and a.t_out is not null then mod((extract(epoch from (a.t_out - a.t_in)) / 60)::int + 1440, 1440) end,
    case when a.t_in is not null and a.t_out is not null then
      greatest(0, (extract(epoch from coalesce(nullif((select cfg ->> 't_required' from programs where id = cid), '')::interval, '03:00'::interval)) / 60)::int
                  - mod((extract(epoch from (a.t_out - a.t_in)) / 60)::int + 1440, 1440)) end,
    a.edited
  from course_teacher_att a join members m on m.id = a.member_id
  where a.course_id = cid and public.prog_is_org(cid)
  order by a.dt, m.name
$$;

-- 2) عناصر المرتب لا تكون سالبة (كان «-500» في الحافز يُقبل)
create or replace function public.crs_pay_save(cid uuid, mid uuid, b numeric, i numeric, d numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.prog_is_org(cid) then raise exception 'غير مسموح'; end if;
  if coalesce(b, 0) < 0 or coalesce(i, 0) < 0 or coalesce(d, 0) < 0 then raise exception 'عناصر المرتب لا تكون سالبة'; end if;
  insert into course_pay (course_id, member_id, basic, incentive, distinction) values (cid, mid, b, i, d)
  on conflict (course_id, member_id) do update set basic = excluded.basic, incentive = excluded.incentive, distinction = excluded.distinction;
end $$;

-- 3) المرتب لا ينزل عن صفر (خصم التأخير أكبر من المرتب كان يُظهر مرتبًا سالبًا). باقي الدالة كما في intensive.sql.
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
    greatest(0, coalesce(p.basic, 0) + coalesce(p.incentive, 0) + coalesce(p.distinction, 0) - (select coalesce(sum(late), 0) from t where t.member_id = s.mid) * (select r from rate))
  from staff s join members m on m.id = s.mid left join course_pay p on p.course_id = cid and p.member_id = s.mid
  where public.prog_is_org(cid)
  order by m.name
$$;

notify pgrst, 'reload schema';
