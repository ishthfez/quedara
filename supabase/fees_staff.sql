-- =====================================================================
--  اشتراكات حلقات العامل في صفحة «الطلاب» (stuview.js)
--  المعلم والمشرف والإداري لا يصلهم جدول الدفعات ولا إعدادات الاشتراك (priv_fees). هذه الدالة تعيد لكل منهم
--  مستحقات طلاب حلقاته عن سنة بعينها، ودفعاتهم في تلك السنة وما قبلها وما بعدها (للاطلاع فقط؛ لا كتابة).
--  الحلقات: المعلم والمشرف حلقاتهما، والمشرف العام كلها، والإداري حلقات أماكنه، والمدير ومن له التحصيل كلها.
--  يُنفَّذ بعد roles.sql و fees_systems.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار، ولا يغيّر أي بيانات.
-- =====================================================================
create or replace function public.staff_fees(yy int) returns jsonb
language sql stable security definer set search_path = public as $$
  with hs as (
    select h.id from halaqat h
    where public.is_admin() or public.has_perm('fees.collect') or public.is_general_sup()
       or h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids())
       or h.id in (select public.my_place_halaqat())
  ), st as (
    select m.id, public.fee_due_y(m, yy) as due from members m
    where m.role = 'student' and m.halaqa_id in (select id from hs)
  )
  select jsonb_build_object(
    'dues', coalesce((select jsonb_agg(jsonb_build_object('s', st.id, 'd', st.due)) from st), '[]'::jsonb),
    'fees', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 's', f.student_id, 'y', f.y, 'm', f.m, 'a', f.amount, 'dt', f.date, 'by', f.by_name, 'n', f.note))
                      from fees f where f.student_id in (select id from st) and f.y between yy - 1 and yy + 1), '[]'::jsonb))
$$;
revoke all on function public.staff_fees(int) from public, anon;
grant execute on function public.staff_fees(int) to authenticated;

notify pgrst, 'reload schema';
