-- =====================================================================
--  تعديلات رصيد الإجازات لكل موظف، لمن يسجّل الغياب (المشرف)
--   المدير يعدّل في «الغياب ← رصيد الإجازات» الرصيد أو المخصوم لموظف بعينه، فيُحفظ في إعدادات المرتبات
--   (pay_settings.data.lvAdj[السنة][الموظف] = { b: الرصيد، u: فرق المخصوم }). والمشرف لا تصله إعدادات المرتبات،
--   فكانت استمارة الغياب عنده تحسب الرصيد من القاعدة العامة وحدها (leave_rules في absence_proof.sql).
--   هذه الدالة ترسل له هذين الرقمين لكل موظف فقط، بلا شيء آخر من الإعدادات ولا أي مبالغ.
--  يُنفَّذ بعد absence_proof.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================
create or replace function public.leave_adj() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_object_agg(y.key, (
      select coalesce(jsonb_object_agg(e.key, jsonb_strip_nulls(jsonb_build_object(
        'b', case when (e.value->>'b') ~ '^-?[0-9]+(\.[0-9]+)?$' then to_jsonb((e.value->>'b')::numeric) end,
        'u', case when (e.value->>'u') ~ '^-?[0-9]+(\.[0-9]+)?$' then to_jsonb((e.value->>'u')::numeric) end))), '{}')
      from jsonb_each(case when jsonb_typeof(y.value) = 'object' then y.value else '{}' end) e
      where jsonb_typeof(e.value) = 'object'))
    from pay_settings s,
         jsonb_each(case when jsonb_typeof(s.data->'lvAdj') = 'object' then s.data->'lvAdj' else '{}' end) y
    where s.id = 1 and y.key ~ '^[0-9]{4}$'), '{}'::jsonb)
  where public.is_admin() or public.has_role('supervisor')
$$;
revoke all on function public.leave_adj() from public, anon;
grant execute on function public.leave_adj() to authenticated;

notify pgrst, 'reload schema';
