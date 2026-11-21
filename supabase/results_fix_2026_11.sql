-- =====================================================================
--  إصلاح نتائج الدورات والبرامج التربوية ومراجعة قوائم التحصيل (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى، وهو آمن للتكرار.
--  إن أعدت تنفيذ intensive.sql أو tarbawi.sql أو roles.sql لاحقًا فأعد تنفيذ هذا الملف بعدها.
-- =====================================================================

-- 1) نتيجة الدورة المكثفة: نسبة الانتظام لكل طالب من أيام دوام مجموعته وحدها، ومنذ قبوله في الدورة.
--    كان المقام أيام الدورة كلها (كل المجموعات): في مجموعتين تتناوبان الأيام كان من حضر كل أيامه يأخذ نصف درجة الانتظام،
--    ومن قُبل متأخرًا يُحسب عليه ما قبل قبوله؛ فيتغيّر الترتيب والجوائز. والاختبارات الأسبوعية كذلك من أسابيع مجموعته.
--    باقي الدالة كما في intensive.sql.
create or replace function public.crs_results(cid uuid)
returns table (id uuid, name text, track text, category text, attendance numeric, points numeric, weekly numeric, final numeric, daily numeric,
               total numeric, pages numeric, rank int, rank_manual boolean, prize numeric)
language sql stable security definer set search_path = public as $$
  with c as (select cfg from programs where id = cid),
  rs as (select coalesce((select cfg -> 'result' from c), '{"attendance":120,"points":40,"weekly":90,"final":100}'::jsonb) r),
  base as (
    select e.id, coalesce(s.name, e.ext ->> 'name') as name, e.track,
      coalesce((select cfg -> 'categories' ->> e.track from c), case when e.track = 'khatm' then 'الخاتمون' else 'غير الخاتمين' end) as category,
      /* أول يوم يُحسب: يوم قبوله (terms.at)، وإن لم يُعرف فكل أيام مجموعته */
      coalesce((nullif(e.terms ->> 'at', ''))::timestamptz::date, '-infinity'::date) as d0,
      e.group_id,
      e.final as fin, e.rank, e.rank_manual, e.prize
    from course_entries e left join members s on s.id = e.student_id
    where e.course_id = cid and e.status = 'accepted' and public.prog_is_org(cid)),
  b2 as (
    select b.*,
      (select count(*) from course_daily x where x.entry_id = b.id and x.present and x.dt >= b.d0)::numeric as pres,
      /* أيام الدوام: الأيام المسجلة لمجموعته (أو للدورة إن لم تكن له مجموعة) منذ قبوله */
      (select count(distinct x.dt) from course_daily x join course_entries g on g.id = x.entry_id
         where g.course_id = cid and (b.group_id is null or g.group_id = b.group_id) and x.dt >= b.d0)::numeric as dn,
      (select greatest(count(distinct w.wk), 1) from course_weekly w join course_entries g on g.id = w.entry_id
         where g.course_id = cid and (b.group_id is null or g.group_id = b.group_id))::numeric as wn,
      (select coalesce(sum(pts), 0) from course_points x where x.entry_id = b.id) as pts,
      (select coalesce(sum(score), 0) from course_weekly x where x.entry_id = b.id) as wsum,
      (select avg(coalesce(course_grade, 0) + coalesce(home_grade, 0)) from course_daily x where x.entry_id = b.id and x.present) as davg,
      (select coalesce(sum(coalesce(new_pages, 0) + coalesce(rev_pages, 0) + coalesce(home_pages, 0)), 0) from course_daily x where x.entry_id = b.id) as pages
    from base b)
  select b.id, b.name, b.track, b.category,
    round(case when b.dn > 0 then least(b.pres, b.dn) / b.dn * coalesce((rs.r ->> 'attendance')::numeric, 0) else 0 end, 2),
    least(b.pts, coalesce((rs.r ->> 'points')::numeric, 0)),
    round(b.wsum / (b.wn * coalesce(nullif((select cfg ->> 'weekly_max' from c), '')::numeric, 30)) * coalesce((rs.r ->> 'weekly')::numeric, 0), 2),
    round(coalesce(b.fin, 0) / coalesce(nullif((select cfg ->> 'final_max' from c), '')::numeric, 100) * coalesce((rs.r ->> 'final')::numeric, 0), 2),
    round(case when coalesce((rs.r ->> 'daily')::numeric, 0) > 0 then coalesce(b.davg, 0) / greatest(coalesce(nullif((select cfg ->> 'daily_max' from c), '')::numeric, 20), 1) * (rs.r ->> 'daily')::numeric else 0 end, 2),
    0::numeric, b.pages, b.rank, b.rank_manual, b.prize
  from b2 b, rs
$$;

-- 2) نتيجة البرنامج التربوي: نسبة الحضور من لقاءات الحلقة منذ انضمام الطالب، لا من كل لقاءاتها.
--    كان من انضم بعد اللقاء السادس وحضر 4 من 4 يأخذ 40% فقد يرسب. باقي الدالة كما في tarbawi.sql.
create or replace function public.tar_results(pid uuid, uid uuid)
returns table (entry_id uuid, name text, att_pct numeric, att_pts numeric, score numeric, absent boolean, total numeric, passed boolean, rank int, rank_manual boolean, prize numeric)
language sql stable security definer set search_path = public as $$
  with c as (select (select cfg from programs where id = pid) || coalesce((select cfg from programs where id = uid and id <> pid), '{}'::jsonb) cfg),
  alld as (select distinct a.dt from tar_att a join tar_entries e on e.id = a.entry_id where a.unit_id = uid and e.program_id = pid),
  b0 as (
    select e.id, coalesce(s.name, e.ext ->> 'name') nm, e.created_at::date d0,
      t.score, coalesce(t.absent, false) ab, t.rank, coalesce(t.rank_manual, false) rm, t.prize
    from tar_entries e left join members s on s.id = e.student_id left join tar_scores t on t.entry_id = e.id and t.unit_id = uid
    where e.program_id = pid and e.status = 'accepted' and public.prog_is_org(pid) and public.tar_unit_ok(pid, uid)),
  b as (
    select b0.*,
      /* لقاءاته: لقاءات الحلقة منذ انضمامه، ومعها أي يوم سُجّل له قبله (فلا تزيد النسبة على 100%) */
      (select count(*) from alld where alld.dt >= b0.d0 or exists (select 1 from tar_att a where a.entry_id = b0.id and a.unit_id = uid and a.dt = alld.dt))::numeric dn,
      (select count(*) from tar_att a where a.entry_id = b0.id and a.unit_id = uid and a.present)::numeric pn
    from b0),
  b2 as (select b.*, case when b.dn > 0 then round(least(b.pn, b.dn) / b.dn * 100, 1) end pct from b)
  select b.id, b.nm, b.pct,
    round(coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0), 2),
    b.score, b.ab,
    round(coalesce(b.score, 0) + coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0), 2),
    case when nullif((select cfg ->> 'pass' from c), '') is null then null
         else coalesce(b.score, 0) + coalesce(b.pct, 0) / 100 * coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0)
              >= ((select cfg ->> 'pass' from c)::numeric / 100) * (coalesce(nullif((select cfg ->> 'test_max' from c), '')::numeric, 100) + coalesce(nullif((select cfg ->> 'att_weight' from c), '')::numeric, 0)) end,
    b.rank, b.rm, b.prize
  from b2 b
$$;

-- 3) مراجعة قائمة تحصيل فيها طالب حُذف: كانت تفشل المراجعة كلها (الدفعة لطالب غير موجود)،
--    الآن يُعاد سطره للمعلم بملاحظة «الطالب لم يعد موجودًا» وتكمل بقية القائمة. باقي الدالة كما في roles.sql.
create or replace function public.review_collection(cid uuid, decisions jsonb, note text) returns text
language plpgsql security definer set search_path = public as $$
declare me record; c record; L jsonb := '[]'; x jsonb; d jsonb; pend int := 0; iss int := 0; st text; who text;
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  select * into c from collections where id = cid for update;
  if c.id is null then raise exception 'القائمة غير موجودة'; end if;
  if c.status <> 'sent' then raise exception 'القائمة ليست بانتظار المراجعة'; end if;
  who := case when exists (select 1 from members where id = c.teacher_id and role = 'placeadmin') then 'تحصيل الإداري ' else 'تحصيل المعلم ' end;
  for x in select e from jsonb_array_elements(c.lines) e loop
    if x->>'state' = 'pending' then
      d := (select e from jsonb_array_elements(coalesce(decisions, '[]')) e where e->>'studentId' = x->>'studentId' limit 1);
      if d is null then pend := pend + 1;
      elsif coalesce((d->>'ok')::boolean, false) and not exists (select 1 from members where id = nullif(x->>'studentId', '')::uuid) then
        x := x || jsonb_build_object('state', 'issue', 'accNote', 'الطالب لم يعد موجودًا في النظام'); iss := iss + 1;
      elsif coalesce((d->>'ok')::boolean, false) then
        if coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 then
          insert into fees (id, student_id, y, m, amount, date, by_name, by_member, note)
          values (gen_random_uuid(), (x->>'studentId')::uuid, c.y, c.m, (x->>'amount')::numeric, current_date, me.name, me.id,
                  who || coalesce(c.teacher_name, '') || coalesce(' — ' || nullif(x->>'note', ''), ''));
        end if;
        x := x || jsonb_build_object('state', 'ok', 'accNote', coalesce(d->>'note', ''));
      else
        x := x || jsonb_build_object('state', 'issue', 'accNote', coalesce(d->>'note', '')); iss := iss + 1;
      end if;
    end if;
    L := L || jsonb_build_array(x);
  end loop;
  st := case when iss > 0 then 'returned' when pend > 0 then 'sent' else 'done' end;
  update collections set lines = L, acc_note = coalesce(note, ''), reviewed_at = now(), reviewed_by = me.name, status = st where id = cid;
  return st;
end $$;

notify pgrst, 'reload schema';
