-- ============ ملاحظات المشرف الخاصة على الطالب (ملف الطالب) ============
-- يكتبها مشرف حلقة الطالب (أو المدير العام، أو المدير وهو يعمل بصفة مشرف)، ويقرؤها العاملون على الحلقة:
-- المدير، ومشرفها، والمدير العام، ومعلمها. لا يقرؤها الطالب (جدول منفصل بلا قواعد قراءة مباشرة، والوصول بالدالتين فقط).
-- آمن للتكرار. يُنفَّذ بعد roles.sql.

create table if not exists public.student_notes (
  student_id uuid primary key references public.members(id) on delete cascade,
  note text not null default '',
  by_member uuid,
  by_name text,
  updated_at timestamptz not null default now()
);
alter table public.student_notes enable row level security;
revoke all on public.student_notes from anon, authenticated;

-- من يكتب: مشرف حلقة الطالب، أو المدير العام، أو المدير
create or replace function public.sup_note_can_edit(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_general_sup() or exists (
    select 1 from members s join halaqat h on h.id = s.halaqa_id join members me on me.id = h.supervisor_id
    where s.id = sid and s.role = 'student' and me.user_id = auth.uid())
$$;
-- من يقرأ: من يكتب، ومعلم حلقة الطالب
create or replace function public.sup_note_can_read(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.sup_note_can_edit(sid) or exists (
    select 1 from members s join halaqat h on h.id = s.halaqa_id join members me on me.id = h.teacher_id
    where s.id = sid and s.role = 'student' and me.user_id = auth.uid())
$$;

create or replace function public.sup_note_get(sid uuid)
returns table (note text, by_name text, updated_at timestamptz, can_edit boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(n.note, ''), n.by_name, n.updated_at, public.sup_note_can_edit(sid)
  from (select 1) x left join student_notes n on n.student_id = sid
  where public.sup_note_can_read(sid)
$$;

create or replace function public.sup_note_set(sid uuid, txt text) returns void
language plpgsql security definer set search_path = public as $$
declare me members;
begin
  if not public.sup_note_can_edit(sid) then raise exception 'غير مسموح'; end if;
  select * into me from members where user_id = auth.uid() limit 1;
  insert into student_notes (student_id, note, by_member, by_name, updated_at)
  values (sid, left(coalesce(txt, ''), 2000), me.id, me.name, now())
  on conflict (student_id) do update set note = excluded.note, by_member = excluded.by_member, by_name = excluded.by_name, updated_at = now();
end $$;

revoke all on function public.sup_note_can_edit(uuid), public.sup_note_can_read(uuid), public.sup_note_get(uuid), public.sup_note_set(uuid, text) from public, anon;
grant execute on function public.sup_note_get(uuid), public.sup_note_set(uuid, text) to authenticated;

notify pgrst, 'reload schema';
