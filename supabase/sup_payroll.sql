-- =====================================================================
--  كشوف المرتبات النهائية للمشرفين (للاطلاع): «العاملون ← المرتبات»
--  المشرف يقرأ كشوف الأشهر المغلقة وحدها، ولا يعدّل شيئًا (لا قواعد إضافة أو تعديل له على هذه الجداول).
--  الشهر المفتوح لا يصله، ويظهر له بعد إغلاقه. إعادة فتح الشهر تخفيه عنه حتى يُغلق ثانية.
--  يُنفَّذ في Supabase ← SQL Editor ← Run. آمن للتكرار.
--  للتراجع: drop policy if exists pay_rows_sup_read on public.pay_rows; drop policy if exists pay_closed_sup_read on public.pay_closed;
-- =====================================================================

drop policy if exists pay_closed_sup_read on public.pay_closed;
create policy pay_closed_sup_read on public.pay_closed for select to authenticated
  using (public.has_role('supervisor'));

drop policy if exists pay_rows_sup_read on public.pay_rows;
create policy pay_rows_sup_read on public.pay_rows for select to authenticated
  using (public.has_role('supervisor') and exists (select 1 from public.pay_closed c where c.y = pay_rows.y and c.m = pay_rows.m));

notify pgrst, 'reload schema';
