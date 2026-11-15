-- =====================================================================
--  غياب المعلمين: الإثبات «خصم»، وصلاحية المشرف على الإثبات، ورصيد الإجازات
--  يُنفَّذ مرة واحدة في Supabase ← SQL Editor. آمن عند تكراره، ولا يغيّر أي بيانات موجودة.
-- =====================================================================

-- 1) الإثبات يقبل «خصم» (من المرتب) بجانب «رصيد» و«مثبت»
-- (يُحذف قيد الإثبات القديم أيًّا كان اسمه، ثم يُضاف الجديد)
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.absences'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%proof%'
  loop
    execute format('alter table public.absences drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.absences add constraint absences_proof_check
  check (proof is null or proof in ('', 'رصيد', 'مثبت', 'خصم'));

-- 2) من يسجّل الغياب (المدير والمشرف والمشرف العام) يضع الإثبات عند التسجيل ويعدّله بعده
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated with check (
  (public.is_admin() or public.has_role('supervisor'))
  and (by_member is null or by_member in (select public.my_ids())));
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using (public.is_admin() or public.has_role('supervisor'))
  with check (public.is_admin() or public.has_role('supervisor'));

-- 3) قائمة المعلمين لنموذج الغياب: ومعها نظام العمل (3 أو 6 أيام) لحساب الرصيد — بلا أي مبالغ
drop function if exists public.staff_list();
create function public.staff_list()
returns table (id uuid, code text, name text, place text, status text, sys text)
language sql stable security definer set search_path = public as $$
  select e.id, e.code, e.name, e.place, e.status, e.sys from pay_employees e
  where public.is_admin() or public.has_role('supervisor')
  order by e.name
$$;
revoke all on function public.staff_list() from public;
grant execute on function public.staff_list() to authenticated;

-- 4) عدد أيام رصيد الإجازات السنوي لكل نظام (من إعدادات المرتبات) — رقمان فقط، لمن يسجّل الغياب
create or replace function public.leave_rules()
returns table (lv3 int, lv6 int)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(s.data->>'lv3', '')::numeric::int, 10), coalesce(nullif(s.data->>'lv6', '')::numeric::int, 21)
  from (select 1) x left join pay_settings s on s.id = 1
  where public.is_admin() or public.has_role('supervisor')
$$;
revoke all on function public.leave_rules() from public;
grant execute on function public.leave_rules() to authenticated;
