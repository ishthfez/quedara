-- =====================================================================
--  مستحقات طلاب حلقة عن شهر بعينه (قوائم التحصيل: collect.js)
--   student_dues_y كانت تحسب المستحق بسعر الشهر الجاري من السنة، فبعد تغيير المبلغ ابتداءً من شهر
--   (fee_periods.sql) كانت قائمة تحصيل شهر سابق تُحسب بالسعر الجديد.
--   الصلاحيات كما هي في student_dues_y.
--  يُنفَّذ بعد fee_periods.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
--  قبل تنفيذه يعمل التطبيق كما كان (student_dues_y).
-- =====================================================================

create or replace function public.student_dues_ym(hid uuid, yy int, mm int) returns table (student_id uuid, due numeric)
language sql stable security definer set search_path = public as $$
  select m.id, public.fee_due_ym(m, yy, mm) from members m
  where m.role = 'student' and m.halaqa_id = hid
    and (public.is_admin() or public.has_perm('fees.collect') or hid in (select public.my_place_halaqat())
         or exists (select 1 from halaqat h where h.id = hid and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))))
$$;
revoke all on function public.student_dues_ym(uuid, int, int) from public, anon;
grant execute on function public.student_dues_ym(uuid, int, int) to authenticated;

notify pgrst, 'reload schema';
