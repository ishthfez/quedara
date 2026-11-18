-- =====================================================================
--  الحذف بموافقة المدير
--   - المحاسب (ومن له صلاحية «الأماكن والحلقات») يضيف المكان والحلقة ويعدّلهما، لكن لا يحذفهما بنفسه:
--     يضغط «حذف» فيكتب السبب (إلزامي) ويُرسل طلبًا، والمدير يوافق (فيُحذف) أو يرفض.
--   - وكذلك الطالب: المحاسب يطلب حذفه من ملفه، والمدير يقرر.
--   - يصل المحاسبَ قرارُ المدير في «الإعلانات».
--   - الحذف المباشر للأماكن والحلقات صار للمدير وحده (الإضافة والتعديل كما كانا بالصلاحية).
--  يُنفَّذ بعد gmanager.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) الحذف المباشر للمدير وحده؛ الإضافة والتعديل للمدير ولمن له halaqat.manage (كما في halaqat_perm.sql)
drop policy if exists places_write on public.places;
drop policy if exists places_ins on public.places;
drop policy if exists places_upd on public.places;
drop policy if exists places_del on public.places;
create policy places_ins on public.places for insert to authenticated with check (public.is_admin() or public.has_perm('halaqat.manage'));
create policy places_upd on public.places for update to authenticated
  using (public.is_admin() or public.has_perm('halaqat.manage')) with check (public.is_admin() or public.has_perm('halaqat.manage'));
create policy places_del on public.places for delete to authenticated using (public.is_admin());

drop policy if exists halaqat_write on public.halaqat;
drop policy if exists halaqat_ins on public.halaqat;
drop policy if exists halaqat_upd on public.halaqat;
drop policy if exists halaqat_del on public.halaqat;
create policy halaqat_ins on public.halaqat for insert to authenticated with check (public.is_admin() or public.has_perm('halaqat.manage'));
create policy halaqat_upd on public.halaqat for update to authenticated
  using (public.is_admin() or public.has_perm('halaqat.manage')) with check (public.is_admin() or public.has_perm('halaqat.manage'));
create policy halaqat_del on public.halaqat for delete to authenticated using (public.is_admin());

-- 2) الطلبات (لا تُقرأ ولا تُكتب مباشرة: الدوال أدناه وحدها)
create table if not exists public.del_requests (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('place', 'halaqa', 'student')),
  target_id      uuid not null,
  target_name    text not null default '',
  reason         text not null,
  requested_by   uuid,
  requested_name text not null default '',
  created_at     timestamptz not null default now(),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at     timestamptz,
  decided_by     text not null default '',
  note           text not null default ''
);
create unique index if not exists del_requests_one_pending on public.del_requests (kind, target_id) where status = 'pending';
alter table public.del_requests enable row level security;
revoke all on public.del_requests from anon, authenticated;

-- 3) طلب الحذف (المحاسب): المكان والحلقة بصلاحية «الأماكن والحلقات»، والطالب للمحاسب. السبب إلزامي.
create or replace function public.del_request(k text, tid uuid, why text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; nm text; rid uuid;
begin
  if public.is_admin() then raise exception 'المدير يحذف مباشرة'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  if me.id is null then raise exception 'غير مصرح'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  if coalesce(trim(why), '') = '' then raise exception 'اكتب سبب الحذف'; end if;
  if k in ('place', 'halaqa') and not public.has_perm('halaqat.manage') then raise exception 'غير مصرح'; end if;
  if k = 'student' and me.role <> 'accountant' then raise exception 'غير مصرح'; end if;
  nm := case k
    when 'place' then (select name from places where id = tid)
    when 'halaqa' then (select coalesce(nullif(h.name, ''), 'حلقة ' || coalesce(t.name, '')) from halaqat h left join members t on t.id = h.teacher_id where h.id = tid)
    when 'student' then (select name from members where id = tid and role = 'student')
  end;
  if nm is null then raise exception 'غير موجود'; end if;
  insert into del_requests (kind, target_id, target_name, reason, requested_by, requested_name)
  values (k, tid, nm, left(trim(why), 500), me.id, coalesce(me.name, ''))
  on conflict (kind, target_id) where status = 'pending' do nothing
  returning id into rid;
  if rid is null then raise exception 'أُرسل طلب حذف له من قبل وينتظر المدير'; end if;
  return rid;
end $$;

-- 4) القراءة: للمدير الطلبات المنتظرة، ولغيره طلباته المنتظرة
create or replace function public.del_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]') from (
    select id, kind, target_id, target_name, reason, requested_by, requested_name, created_at, status
    from del_requests
    where status = 'pending' and (public.is_admin() or requested_by in (select public.my_ids()))
  ) r
$$;

-- 5) قرار المدير: الموافقة (بعد أن يحذف العنصر من التطبيق) أو الرفض، ويصل الطالبَ للحذف قرارُه في «الإعلانات»
create or replace function public.del_decide(rid uuid, ok boolean, msg text default '') returns void
language plpgsql security definer set search_path = public as $$
declare r record; me text; what text;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  select coalesce(name, '') into me from members where user_id = auth.uid() and role = 'admin' limit 1;
  update del_requests set status = case when ok then 'approved' else 'rejected' end, decided_at = now(), decided_by = coalesce(me, ''), note = left(coalesce(msg, ''), 500)
  where id = rid and status = 'pending' returning * into r;
  if r.id is null then return; end if;
  what := case r.kind when 'place' then 'المكان' when 'halaqa' then 'الحلقة' else 'الطالب' end;
  if r.requested_by is not null then
    insert into news (id, text, audience, date, author_id, author)
    values (gen_random_uuid(),
            case when ok then 'وُوفق على حذف ' || what || ' «' || r.target_name || '».'
                 else 'رُفض طلب حذف ' || what || ' «' || r.target_name || '»' || case when coalesce(trim(msg), '') <> '' then ': ' || trim(msg) else '' end || '.' end,
            'm:' || r.requested_by::text, current_date, null, coalesce(me, 'المدير'));
  end if;
end $$;

revoke all on function public.del_request(text, uuid, text), public.del_list(), public.del_decide(uuid, boolean, text) from public, anon;
grant execute on function public.del_request(text, uuid, text), public.del_list(), public.del_decide(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
