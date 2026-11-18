-- =====================================================================
--  «الأماكن والحلقات» بكل إعداداتها لمن له صلاحية halaqat.manage (المحاسبون افتراضيًا)
--   - إضافة الأماكن والحلقات وتعديلها وحذفها: للمدير، ولمن مُنح الصلاحية من «الصلاحيات».
--   - تُمنح للمحاسبين مرة واحدة إن لم تكن محددة لهم بعد؛ ويسحبها المدير أو يمنحها لغيرهم من «الصلاحيات».
--  يُنفَّذ بعد perms.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار، ولا يغيّر اختيارًا حدّده المدير.
-- =====================================================================
drop policy if exists places_write on public.places;
create policy places_write on public.places for all to authenticated
  using (public.is_admin() or public.has_perm('halaqat.manage')) with check (public.is_admin() or public.has_perm('halaqat.manage'));

drop policy if exists halaqat_write on public.halaqat;
create policy halaqat_write on public.halaqat for all to authenticated
  using (public.is_admin() or public.has_perm('halaqat.manage')) with check (public.is_admin() or public.has_perm('halaqat.manage'));

-- المحاسبون: الصلاحية مفعّلة افتراضيًا (ما لم يحدد المدير غير ذلك)
insert into public.settings (key, value) values ('priv_perms', '{}'::jsonb) on conflict (key) do nothing;
update public.settings
   set value = value || jsonb_build_object('roles',
         coalesce(value -> 'roles', '{}'::jsonb) || jsonb_build_object('accountant',
           coalesce(value -> 'roles' -> 'accountant', '{}'::jsonb) || '{"halaqat.manage": true}'::jsonb))
 where key = 'priv_perms' and (value -> 'roles' -> 'accountant' -> 'halaqat.manage') is null;

notify pgrst, 'reload schema';
