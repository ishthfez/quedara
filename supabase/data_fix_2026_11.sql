-- =====================================================================
--  إصلاحات أدوات البيانات (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى، وهو آمن للتكرار.
-- =====================================================================

-- 1) دمج الأسماء المكررة: نقل ما لا يصل للجهاز بالمزامنة من العضو المحذوف إلى الباقي، قبل حذفه.
--    كان الدمج ينقل الحضور والتسميع والاشتراكات فقط، فتُحذف مع العضو المحذوف اختباراته وبرامجه ودوراته
--    وتحويلاته وملاحظات المشرف عليه، وقوائم التحصيل التي جمعها (إن كان معلمًا).
--    ما يتعارض مع سجل موجود للباقي (البرنامج نفسه مثلًا) يبقى للباقي ويُترك سجل المحذوف.
--    تستدعيها نافذة «أسماء متشابهة» (app-actions.js) قبل الدمج على الجهاز. للمدير فقط.
create or replace function public.merge_members_extra(keep_id uuid, drop_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; res jsonb := '{}';
begin
  if not public.is_admin() then raise exception 'الدمج للمدير فقط' using errcode = '42501'; end if;
  if keep_id is null or drop_id is null or keep_id = drop_id then raise exception 'عضوان غير صالحين للدمج'; end if;
  if not exists (select 1 from members where id = keep_id) then raise exception 'العضو الباقي غير موجود'; end if;
  if not exists (select 1 from members where id = drop_id) then return res; end if;   -- حُذف من قبل: لا شيء يُنقل

  if to_regclass('public.student_tests') is not null then
    update student_tests set student_id = keep_id where student_id = drop_id;
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('student_tests', n); end if;
  end if;
  if to_regclass('public.program_entries') is not null then
    update program_entries e set student_id = keep_id where e.student_id = drop_id
      and not exists (select 1 from program_entries k where k.program_id = e.program_id and k.student_id = keep_id);
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('program_entries', n); end if;
  end if;
  if to_regclass('public.program_group_ok') is not null then
    update program_group_ok e set student_id = keep_id where e.student_id = drop_id
      and not exists (select 1 from program_group_ok k where k.program_id = e.program_id and k.student_id = keep_id and k.label = e.label);
  end if;
  if to_regclass('public.program_staff') is not null then
    update program_staff e set member_id = keep_id where e.member_id = drop_id
      and not exists (select 1 from program_staff k where k.program_id = e.program_id and k.member_id = keep_id and k.role = e.role);
  end if;
  if to_regclass('public.course_entries') is not null then
    update course_entries e set student_id = keep_id where e.student_id = drop_id
      and not exists (select 1 from course_entries k where k.course_id = e.course_id and k.student_id = keep_id);
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('course_entries', n); end if;
  end if;
  if to_regclass('public.course_teacher_att') is not null then
    update course_teacher_att e set member_id = keep_id where e.member_id = drop_id
      and not exists (select 1 from course_teacher_att k where k.course_id = e.course_id and k.member_id = keep_id and k.dt = e.dt);
  end if;
  if to_regclass('public.course_pay') is not null then
    update course_pay e set member_id = keep_id where e.member_id = drop_id
      and not exists (select 1 from course_pay k where k.course_id = e.course_id and k.member_id = keep_id);
  end if;
  if to_regclass('public.tar_entries') is not null then
    update tar_entries e set student_id = keep_id where e.student_id = drop_id
      and not exists (select 1 from tar_entries k where k.program_id = e.program_id and k.student_id = keep_id);
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('tar_entries', n); end if;
  end if;
  if to_regclass('public.transfers') is not null then
    update transfers set student_id = keep_id where student_id = drop_id;
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('transfers', n); end if;
  end if;
  if to_regclass('public.student_notes') is not null then
    if exists (select 1 from student_notes where student_id = keep_id) then
      update student_notes k set note = trim(both E'\n' from k.note || E'\n' || d.note), updated_at = now()
        from student_notes d where k.student_id = keep_id and d.student_id = drop_id and coalesce(d.note, '') <> '';
    else
      update student_notes set student_id = keep_id where student_id = drop_id;
    end if;
  end if;
  if to_regclass('public.collections') is not null then
    update collections c set teacher_id = keep_id where c.teacher_id = drop_id
      and not exists (select 1 from collections k where k.teacher_id = keep_id and k.halaqa_id is not distinct from c.halaqa_id and k.y = c.y and k.m = c.m);
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('collections', n); end if;
  end if;
  if to_regclass('public.cnotices') is not null then
    /* الكشوف كلها تُنقل؛ وإن كان لكليهما مسودة (مسودة واحدة لكل جامع) تُضاف أسطر مسودة المحذوف إلى مسودة الباقي */
    if exists (select 1 from cnotices where collector_id = keep_id and status = 'draft') then
      update cnotices k set lines = coalesce(k.lines, '[]'::jsonb) || coalesce(d.lines, '[]'::jsonb)
        from cnotices d where k.collector_id = keep_id and k.status = 'draft' and d.collector_id = drop_id and d.status = 'draft';
      delete from cnotices where collector_id = drop_id and status = 'draft';
    end if;
    update cnotices c set collector_id = keep_id where c.collector_id = drop_id
      and (c.status <> 'draft' or not exists (select 1 from cnotices k where k.collector_id = keep_id and k.status = 'draft'));
    get diagnostics n = row_count; if n > 0 then res := res || jsonb_build_object('cnotices', n); end if;
  end if;
  update pay_employees set member_id = keep_id where member_id = drop_id;
  return res;
end $$;
revoke all on function public.merge_members_extra(uuid, uuid) from public, anon;
grant execute on function public.merge_members_extra(uuid, uuid) to authenticated;

-- 2) علامة «خطة» على تسجيل التسميع: منهج اليوم الذي يكتبه المعلم في الكرّاسة قبل أن يُسمَّع (kurrasa.js).
--    العدادات (تسميع اليوم، آخر حفظ، الآيات المحفوظة...) تستبعده حتى توضع له درجة.
--    يجب تنفيذه قبل رفع cloud.js الجديد (يرسل هذا العمود).
alter table public.records add column if not exists plan boolean not null default false;

notify pgrst, 'reload schema';
