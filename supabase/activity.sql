-- =====================================================================
--  سجل الأنشطة (للمدير وحده)
--   كل ما يفعله العاملون والطلاب ويمر بقاعدة البيانات يُسجَّل تلقائيًا بمشغّلات على الجداول، أيًّا كان الجهاز أو الصفحة:
--   الحضور، والتسميع، والدفعات وإخطارات التحصيل، وإضافة الطلاب وحالتهم ونقلهم وتعديل بياناتهم وقرارات النقل،
--   والرسائل والإعلانات، وغياب المعلمين، والإعدادات، والحلقات والأماكن. ويُضاف إليه الدخول وفتح التطبيق (act_open).
--   أفعال المدير نفسه (ومنها «العمل بصفة») لا تُسجَّل. والتسجيل لا يعطّل أي حفظ: أي خطأ فيه يُتجاهل.
--   يحفظ السجل الفاعل وفئته، ونوع النشاط، والهدف (طالبًا أو معلمًا)، وتفاصيل يكتب منها التطبيق الوصف بالعربية.
--   يُقرأ بـ act_list (مبوبًا بالفئة، مع تصفية بالنوع والاسم) و act_summary (بطاقة الصفحة الرئيسية)، للمدير وحده،
--   ويُحذف منه ما مضى عليه أكثر من سنة.
--  يُنفَّذ بعد cnotices.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

create table if not exists public.activity_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_name  text not null default '',
  actor_role  text not null default '',
  kind        text not null,
  act         text not null,
  tbl         text not null default '',
  target_id   text,
  target_name text not null default '',
  details     jsonb not null default '{}'
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);
create index if not exists activity_log_role_idx on public.activity_log (actor_role, at desc);
alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon, authenticated;
revoke all on sequence public.activity_log_id_seq from anon, authenticated;

-- الفاعل: صاحب الجلسة (غير المدير)
create or replace function public.act_me() returns table (id uuid, name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.role from members m where m.user_id = auth.uid()
  order by case m.role when 'teacher' then 0 when 'supervisor' then 1 when 'placeadmin' then 2 when 'accountant' then 3 when 'student' then 4 else 5 end limit 1
$$;
revoke all on function public.act_me() from public, anon, authenticated;

create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record; r jsonb; o jsonb; x jsonb; k text; a text; tgt text; tn text := ''; det jsonb := '{}'; ch text[] := '{}';
        added jsonb; removed jsonb;
begin
  if auth.uid() is null or public.is_admin() then return null; end if;
  select * into me from public.act_me();
  if me.id is null then return null; end if;
  r := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  /* حفظ بلا تغيير حقيقي (المزامنة تعيد إرسال الصف كما هو) */
  if tg_op = 'UPDATE' and (r - 'sync_ts' - 'updated_at' - 'has_photo') = (o - 'sync_ts' - 'updated_at' - 'has_photo') then return null; end if;
  x := coalesce(r, o);
  a := lower(tg_op);
  case tg_table_name
  when 'attendance' then
    k := 'att'; tgt := x->>'student_id';
    det := jsonb_build_object('date', x->>'date', 'status', r->>'status', 'old', o->>'status');
  when 'records' then
    k := 'rec'; tgt := x->>'student_id';
    det := jsonb_build_object('date', x->>'date', 'type', x->>'type', 'surah', x->>'surah', 'from', x->>'from_ayah', 'to', x->>'to_ayah', 'grade', x->>'grade');
  when 'fees' then
    /* دفعات «تم تحصيل المبلغ» يكفيها سطر الإخطار نفسه */
    if tg_op = 'INSERT' and coalesce(x->>'note', '') like 'تحصيل %' then return null; end if;
    k := 'fees'; tgt := x->>'student_id';
    det := jsonb_build_object('y', x->>'y', 'm', x->>'m', 'amount', r->>'amount', 'old', o->>'amount');
  when 'members' then
    if x->>'role' <> 'student' then return null; end if;
    k := 'stu'; tgt := x->>'id'; tn := coalesce(x->>'name', '');
    if tg_op = 'UPDATE' then
      if (r->>'halaqa_id') is distinct from (o->>'halaqa_id') then
        a := case when coalesce(current_setting('app.qtr', true), '') = '1' then 'revert' else 'move' end;
        det := jsonb_build_object('from', o->>'halaqa_id', 'to', r->>'halaqa_id');
      elsif (r->'info'->>'status') is distinct from (o->'info'->>'status') then
        a := 'status'; det := jsonb_build_object('status', coalesce(r->'info'->>'status', ''));
      else
        a := 'edit';
        if (r->>'name') is distinct from (o->>'name') then ch := ch || 'name'; end if;
        if (r->>'phone') is distinct from (o->>'phone') then ch := ch || 'phone'; end if;
        if (r->>'cat') is distinct from (o->>'cat') then ch := ch || 'cat'; end if;
        if (r->'extra') is distinct from (o->'extra') then ch := ch || 'extra'; end if;
        if (r->>'photo') is distinct from (o->>'photo') then ch := ch || 'photo'; end if;
        if (r->'info') is distinct from (o->'info') then ch := ch || 'info'; end if;
        if cardinality(ch) = 0 then return null; end if;
        det := jsonb_build_object('fields', to_jsonb(ch), 'oldName', case when (r->>'name') is distinct from (o->>'name') then o->>'name' end);
      end if;
    end if;
  when 'transfers' then
    if tg_op <> 'UPDATE' or (r->>'status') is not distinct from (o->>'status') or (r->>'status') not in ('approved', 'rejected') then
      if tg_op = 'UPDATE' and (r->>'status') = 'pending' and (r->'approved') is distinct from (o->'approved') then a := 'approve1';
      else return null; end if;
    else a := 'tr_' || (r->>'status'); end if;
    k := 'stu'; tgt := x->>'student_id';
    det := jsonb_build_object('from', x->>'from_halaqa', 'to', x->>'to_halaqa', 'note', r->>'note');
  when 'cnotices' then
    k := 'fees'; tgt := x->>'collector_id'; tn := coalesce(x->>'collector_name', '');
    if tg_op = 'UPDATE' and (r->>'status') is distinct from (o->>'status') then
      a := case r->>'status' when 'sent' then 'cn_send' when 'done' then 'cn_finish' else 'cn_status' end;
      det := jsonb_build_object('lines', r->'lines');
    elsif coalesce(x->>'status', '') = 'draft' and (x->>'collector_id') = me.id::text then
      added := coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(r->'lines', '[]')) e
                         where not exists (select 1 from jsonb_array_elements(coalesce(o->'lines', '[]')) f where f->>'id' = e->>'id')), '[]');
      removed := coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(o->'lines', '[]')) e
                           where not exists (select 1 from jsonb_array_elements(coalesce(r->'lines', '[]')) f where f->>'id' = e->>'id')), '[]');
      if jsonb_array_length(added) = 0 and jsonb_array_length(removed) = 0 then return null; end if;
      a := 'cn_edit'; det := jsonb_build_object('added', added, 'removed', removed);
    else return null; end if;
  when 'collections' then
    if tg_op <> 'UPDATE' or (r->>'status') is not distinct from (o->>'status') then return null; end if;
    k := 'fees'; a := 'coll_' || (r->>'status'); tgt := x->>'teacher_id'; tn := coalesce(x->>'teacher_name', '');
    det := jsonb_build_object('y', x->>'y', 'm', x->>'m', 'n', jsonb_array_length(coalesce(x->'lines', '[]')));
  when 'news' then
    /* الإشعارات التلقائية (من مشغّلات أو من دوال التحصيل والنقل) يكفيها سطر الفعل نفسه */
    if pg_trigger_depth() > 1 or coalesce(x->>'text', '') ~ '^(إخطار تحصيل من |تم تحصيل إخطارك|رُفض نقل الطالب|وُوفق على نقل الطالب|طلب نقل الطالب)' then return null; end if;
    k := 'msg'; tgt := case when (x->>'audience') like 'm:%' then substr(x->>'audience', 3) end;
    det := jsonb_build_object('audience', x->>'audience', 'text', left(coalesce(x->>'text', ''), 240));
  when 'absences' then
    k := 'abs'; tgt := x->>'emp_id'; tn := coalesce(x->>'name', '');
    det := jsonb_build_object('date', x->>'date', 'perm', x->>'perm', 'reason', x->>'reason', 'proof', r->>'proof', 'oldProof', o->>'proof');
  when 'settings' then
    k := 'set'; tgt := x->>'key';
  when 'halaqat' then
    k := 'data'; tgt := x->>'id';
  when 'places' then
    k := 'data'; tgt := x->>'id'; tn := coalesce(x->>'name', '');
  else return null;
  end case;
  if tn = '' and tgt ~ '^[0-9a-f-]{36}$' then select coalesce(name, '') into tn from members where id = tgt::uuid; end if;
  insert into activity_log (actor_id, actor_name, actor_role, kind, act, tbl, target_id, target_name, details)
  values (me.id, coalesce(me.name, ''), me.role, k, a, tg_table_name, tgt, coalesce(tn, ''), det);
  return null;
exception when others then
  return null;   -- السجل لا يعطّل أي حفظ
end $$;
revoke all on function public.log_activity() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['attendance', 'records', 'fees', 'members', 'transfers', 'cnotices', 'collections', 'news', 'absences', 'settings', 'halaqat', 'places'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists zz_activity on public.%I', t);
      execute format('create trigger zz_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t);
    end if;
  end loop;
end $$;

-- الدخول وفتح التطبيق (من التطبيق نفسه): «فتح» مرة كل 6 ساعات على الأكثر لكل شخص
create or replace function public.act_open(how text default 'open') returns void
language plpgsql security definer set search_path = public as $$
declare me record; a text := case when how = 'login' then 'login' else 'open' end;
begin
  if auth.uid() is null or public.is_admin() then return; end if;
  select * into me from public.act_me();
  if me.id is null then return; end if;
  if a = 'open' and exists (select 1 from activity_log where actor_id = me.id and kind = 'login' and at > now() - interval '6 hours') then return; end if;
  insert into activity_log (actor_id, actor_name, actor_role, kind, act) values (me.id, coalesce(me.name, ''), me.role, 'login', a);
end $$;

-- القراءة للمدير: who = الفئة أو '' للكل، what = النوع أو ''، q = جزء من اسم الفاعل أو الهدف، until_at للصفحة التالية
create or replace function public.act_list(who text default '', what text default '', q text default '', until_at timestamptz default null, lim int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  delete from activity_log where at < now() - interval '1 year';
  select coalesce(jsonb_agg(to_jsonb(z) order by z.at desc, z.id desc), '[]') into res from (
    select l.id, l.at, l.actor_id, l.actor_name, l.actor_role, l.kind, l.act, l.tbl, l.target_id, l.target_name, l.details
    from activity_log l
    where (coalesce(who, '') = '' or l.actor_role = who)
      and (coalesce(what, '') = '' or l.kind = what)
      and (coalesce(q, '') = '' or l.actor_name ilike '%' || q || '%' or l.target_name ilike '%' || q || '%')
      and (until_at is null or l.at < until_at)
    order by l.at desc, l.id desc
    limit greatest(1, least(coalesce(lim, 100), 300))) z;
  return res;
end $$;

-- بطاقة الصفحة الرئيسية: عدد أنشطة اليوم (بتوقيت القاهرة) لكل فئة، وآخر الأنشطة
create or replace function public.act_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'today', coalesce((select jsonb_object_agg(actor_role, n) from (select actor_role, count(*) n from activity_log where at >= (date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo') group by 1) t), '{}'),
    'week', (select count(*) from activity_log where at >= now() - interval '7 days'),
    'last', coalesce((select jsonb_agg(to_jsonb(z) order by z.at desc) from (select id, at, actor_id, actor_name, actor_role, kind, act, tbl, target_id, target_name, details from activity_log order by at desc, id desc limit 6) z), '[]')
  ) end
$$;

revoke all on function public.act_open(text), public.act_list(text, text, text, timestamptz, int), public.act_summary() from public, anon;
grant execute on function public.act_open(text), public.act_list(text, text, text, timestamptz, int), public.act_summary() to authenticated;

notify pgrst, 'reload schema';
