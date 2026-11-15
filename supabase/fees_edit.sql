-- =====================================================================
--  تعديل دفعة اشتراك بعد تسجيلها (خطأ في التسجيل أو تراجع الطالب عن الدفع):
--  - المدير يعدّل أي دفعة (كما كان).
--  - من له صلاحية التحصيل (المحاسب) يعدّل الدفعات التي سجّلها هو فقط.
--  - لا يتغير عند التعديل طالب الدفعة ولا من سجّلها؛ والمبلغ صفر أو أكثر (صفر = تراجع كامل).
--  يُنفَّذ بعد accountant.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

drop policy if exists fees_mgr_upd on public.fees;
create policy fees_mgr_upd on public.fees for update to authenticated
  using (public.has_perm('fees.collect') and by_member in (select public.my_ids()))
  with check (public.has_perm('fees.collect') and by_member in (select public.my_ids()));

create or replace function public.fees_edit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.student_id is distinct from old.student_id or new.by_member is distinct from old.by_member
     or new.by_name is distinct from old.by_name then
    raise exception 'لا يُغيَّر طالب الدفعة ولا من سجّلها';
  end if;
  return new;
end $$;
drop trigger if exists fees_edit_guard on public.fees;
create trigger fees_edit_guard before update on public.fees for each row execute function public.fees_edit_guard();

notify pgrst, 'reload schema';
