-- =====================================================================
--  إشعارات الطلاب بالاشتراكات
--  1) تأكيد الدفع: كلما سُجّل اشتراك لطالب (من المحاسب أو المدير أو باعتماد قائمة تحصيل)
--     تصل الطالبَ رسالة في «الإعلانات» عنده: «استلمنا اشتراك شهر … بمبلغ …».
--     لا تُرسل للدفعات القديمة (المؤرخة قبل 3 أيام) حتى لا يُغرق الاستيراد أو الاسترجاع الطلاب برسائل،
--     ولكل دفعة رسالة واحدة فقط، ولا يمنع أي خطأ هنا تسجيل الدفع نفسه.
--  2) notify_dues(students, y, m, note): تذكير بسداد اشتراك شهر معيّن لطالب أو أكثر.
--     يرسله المدير، ومن له صلاحية التحصيل (المحاسب)، ومعلم الطالب، والإداري في مكان الطالب.
--     التذكير نفسه للطالب نفسه لا يتكرر في اليوم نفسه.
--  يُنفَّذ بعد notes.sql و roles.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

create or replace function public.month_ar(m int) returns text
language sql immutable as $$
  select (array['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'])[m]
$$;

-- 1) تأكيد الدفع
create or replace function public.fees_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.amount is null or new.amount <= 0 or new.date is null or new.date < current_date - 3 then return new; end if;
  if not exists (select 1 from members where id = new.student_id and role = 'student') then return new; end if;
  insert into news (id, text, audience, date, author_id, author)
  values (new.id,
          'تأكيد دفع: استلمنا اشتراك شهر ' || month_ar(new.m) || ' ' || new.y || ' بمبلغ '
            || trim(to_char(new.amount, 'FM999999990.##')) || ' جنيه. جزاكم الله خيرًا.',
          'm:' || new.student_id::text, current_date, new.by_member, coalesce(nullif(new.by_name, ''), 'الإدارة'))
  on conflict (id) do nothing;
  return new;
exception when others then
  return new; -- الإشعار لا يمنع تسجيل الدفع أبدًا
end $$;
drop trigger if exists fees_notify on public.fees;
create trigger fees_notify after insert on public.fees for each row execute function public.fees_notify();

-- 2) التذكير بالسداد
create or replace function public.notify_dues(students uuid[], y int, m int, note text default '')
returns int language plpgsql security definer set search_path = public as $$
declare me record; s uuid; n int := 0; txt text; ok boolean;
begin
  if y is null or y < 2000 or m is null or m < 1 or m > 12 then raise exception 'الشهر غير صالح'; end if;
  if coalesce(array_length(students, 1), 0) = 0 or array_length(students, 1) > 2000 then raise exception 'عدد الطلاب غير صالح'; end if;
  if length(coalesce(note, '')) > 500 then raise exception 'الملاحظة طويلة'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student'
    order by (role = 'admin') desc, (role = 'accountant') desc limit 1;
  if me.id is null then raise exception 'غير مصرح'; end if;
  txt := 'تذكير: نرجو سداد اشتراك شهر ' || month_ar(m) || ' ' || y || '.'
         || case when trim(coalesce(note, '')) <> '' then ' ' || trim(note) else '' end;
  foreach s in array students loop
    ok := public.is_admin() or public.has_perm('fees.collect') or public.can_teach_student(s)
          or (public.has_role('placeadmin') and exists (select 1 from members x where x.id = s and x.halaqa_id in (select public.my_place_halaqat())));
    if not ok or not exists (select 1 from members where id = s and role = 'student') then continue; end if;
    if exists (select 1 from news where audience = 'm:' || s::text and text = txt and date = current_date) then continue; end if;
    insert into news (text, audience, date, author_id, author)
    values (txt, 'm:' || s::text, current_date, me.id,
            (case me.role when 'accountant' then 'المحاسب' when 'teacher' then 'المعلم' when 'placeadmin' then 'الإداري'
                          when 'supervisor' then 'المشرف' else 'الإدارة' end) || ' ' || me.name);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_dues(uuid[], int, int, text) from public, anon;
grant execute on function public.notify_dues(uuid[], int, int, text) to authenticated;

notify pgrst, 'reload schema';
