-- =====================================================================
--  إخطارات التحصيل (بدل قائمة الشهر الواحدة في collections.sql)
--   - المعلم (أو الإداري لحلقات نطاقه) يحصّل اشتراك طالب من صفحة «الطلاب»، فيدخل سطرًا في إخطاره المفتوح (مسودة):
--     الطالب والمبلغ والشهر الذي دفع عنه والتاريخ والملاحظة. لكل جامع مسودة واحدة يضيف إليها ويحذف منها.
--   - «إرسال» يجعل المسودة إخطارًا عند المحاسب، ويبدأ الجامع مسودة جديدة متى حصّل بعده (لا قيد بالشهر:
--     يرسل ما شاء متى شاء، ولكل سطر شهره، فيُقبل التحصيل المتأخر عن شهر سابق).
--   - المحاسب (صلاحية «تحصيل الاشتراكات») يضغط «تم التحصيل» أمام كل اسم، أو «إعادة» بملاحظة. وحين يراجع الأسماء كلها
--     يضغط «تم تحصيل المبلغ»: تُسجَّل دفعات المؤكَّد في الاشتراكات باسمه، ويعود المُعاد إلى مسودة الجامع بملاحظة المحاسب
--     ليصححه ويعيد إرساله، وينتقل الإخطار إلى سجل التحصيل.
--   - إشعارات في «الإعلانات»: للمحاسبين عند الإرسال، وللجامع عند الانتهاء.
--   - قوائم collections القديمة تبقى كما هي (تُعرض في السجل)، ودوالها تعمل حتى تُحذف صفحاتها.
--  يُنفَّذ بعد transfers.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) الإخطارات (لا تُقرأ ولا تُكتب مباشرة: الدوال أدناه وحدها)
create table if not exists public.cnotices (
  id             uuid primary key default gen_random_uuid(),
  collector_id   uuid not null references public.members(id) on delete cascade,
  collector_name text not null default '',
  status         text not null default 'draft' check (status in ('draft', 'sent', 'done')),
  lines          jsonb not null default '[]',
  acc_note       text not null default '',
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    text not null default ''
);
create unique index if not exists cnotices_one_draft on public.cnotices (collector_id) where status = 'draft';
create index if not exists cnotices_status_idx on public.cnotices (status, sent_at);
alter table public.cnotices enable row level security;
revoke all on public.cnotices from anon, authenticated;

-- 2) الجامع: من يحصّل لهذا الطالب (معلم حلقته، أو إداري حلقة في نطاقه، أو المدير)
create or replace function public.cn_collector(sid uuid) returns table (id uuid, name text, role text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.role from members m, members s left join halaqat h on h.id = s.halaqa_id
  where s.id = sid and s.role = 'student' and m.user_id = auth.uid()
    and (m.role = 'admin'
         or (h.id is not null and h.teacher_id = m.id)
         or (m.role = 'placeadmin' and h.id is not null and h.id in (select public.place_scope_halaqat(m.info))))
  order by case when m.role = 'admin' then 2 when h.teacher_id = m.id then 0 else 1 end limit 1
$$;
revoke all on function public.cn_collector(uuid) from public, anon, authenticated;

-- 3) إضافة سطر إلى المسودة (أو استبداله: الطالب نفسه عن الشهر نفسه)
create or replace function public.cn_add(sid uuid, yy int, mm int, amt numeric, dt date default current_date, nt text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; s record; d record; ln jsonb;
begin
  select * into me from public.cn_collector(sid);
  if me.id is null then raise exception 'غير مصرح: هذا الطالب ليس في حلقاتك'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  if mm < 1 or mm > 12 or yy < 2000 or yy > 2100 then raise exception 'شهر غير صحيح'; end if;
  if coalesce(amt, 0) <= 0 then raise exception 'اكتب مبلغًا'; end if;
  select id, name, halaqa_id into s from members where id = sid;
  select * into d from cnotices where collector_id = me.id and status = 'draft' for update;
  if d.id is null then
    insert into cnotices (collector_id, collector_name, status) values (me.id, coalesce(me.name, ''), 'draft') returning * into d;
  end if;
  ln := jsonb_build_object('id', gen_random_uuid(), 'studentId', sid, 'studentName', s.name, 'halaqaId', s.halaqa_id, 'y', yy, 'm', mm,
                           'amount', round(amt, 2), 'date', coalesce(dt, current_date), 'note', left(coalesce(nt, ''), 300), 'state', 'pending', 'accNote', '');
  update cnotices set collector_name = coalesce(me.name, ''),
    lines = coalesce((select jsonb_agg(x) from jsonb_array_elements(lines) x
                      where not (x->>'studentId' = sid::text and (x->>'y')::int = yy and (x->>'m')::int = mm)), '[]') || jsonb_build_array(ln)
  where id = d.id;
  return d.id;
end $$;

-- 4) حذف سطر من المسودة
create or replace function public.cn_remove(lid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update cnotices set lines = coalesce((select jsonb_agg(x) from jsonb_array_elements(lines) x where x->>'id' <> lid::text), '[]')
  where status = 'draft' and collector_id in (select public.my_ids());
end $$;

-- 5) إرسال المسودة إخطارًا للمحاسب
create or replace function public.cn_send() returns uuid
language plpgsql security definer set search_path = public as $$
declare d record; n int; tot numeric;
begin
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  select * into d from cnotices where status = 'draft' and collector_id in (select public.my_ids()) for update;
  if d.id is null or jsonb_array_length(d.lines) = 0 then raise exception 'لا يوجد ما يُرسل'; end if;
  /* المُعاد السابق يُرسل من جديد بلا ملاحظته القديمة */
  update cnotices set status = 'sent', sent_at = now(),
    lines = (select jsonb_agg(x || jsonb_build_object('state', 'pending', 'accNote', '')) from jsonb_array_elements(lines) x)
  where id = d.id;
  select jsonb_array_length(d.lines), coalesce(sum((x->>'amount')::numeric), 0) into n, tot from jsonb_array_elements(d.lines) x;
  insert into news (id, text, audience, date, author_id, author)
  values (gen_random_uuid(), 'إخطار تحصيل من ' || d.collector_name || ': عدد الطلاب ' || n || '، والإجمالي ' || trim_scale(tot) || ' جنيه. راجعه من «الطلاب ← إخطارات».',
          'accountant', current_date, d.collector_id, d.collector_name);
  return d.id;
end $$;

-- 6) المحاسب: «تم التحصيل» أو «إعادة» لاسم واحد (يُحفظ فورًا، ويمكن تغييره حتى الانتهاء)
create or replace function public.cn_mark(nid uuid, lid uuid, ok boolean, msg text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  update cnotices set lines = (select jsonb_agg(case when x->>'id' = lid::text
                                 then x || jsonb_build_object('state', case when ok is null then 'pending' when ok then 'ok' else 'issue' end,
                                                              'accNote', case when ok is false then left(coalesce(msg, ''), 300) else '' end)
                                 else x end) from jsonb_array_elements(lines) x)
  where id = nid and status = 'sent';
  if not found then raise exception 'الإخطار غير موجود أو انتهت مراجعته'; end if;
end $$;

-- 7) المحاسب: «تم تحصيل المبلغ» بعد مراجعة الأسماء كلها
create or replace function public.cn_finish(nid uuid, msg text default '') returns text
language plpgsql security definer set search_path = public as $$
declare me record; n record; ln jsonb; okn int := 0; okt numeric := 0; isn int := 0; back jsonb := '[]'; d record;
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  select * into n from cnotices where id = nid for update;
  if n.id is null or n.status <> 'sent' then raise exception 'الإخطار غير موجود أو انتهت مراجعته'; end if;
  if exists (select 1 from jsonb_array_elements(n.lines) e where e->>'state' not in ('ok', 'issue')) then raise exception 'راجع الأسماء كلها أولًا'; end if;
  for ln in select e from jsonb_array_elements(n.lines) e loop
    if ln->>'state' = 'ok' then
      if exists (select 1 from members where id = (ln->>'studentId')::uuid) then
        insert into fees (id, student_id, y, m, amount, date, by_name, by_member, note)
        values (gen_random_uuid(), (ln->>'studentId')::uuid, (ln->>'y')::int, (ln->>'m')::int, (ln->>'amount')::numeric,
                coalesce(nullif(ln->>'date', '')::date, current_date), coalesce(me.name, ''), me.id,
                'تحصيل ' || n.collector_name || coalesce(' — ' || nullif(ln->>'note', ''), ''));
      end if;
      okn := okn + 1; okt := okt + (ln->>'amount')::numeric;
    else
      isn := isn + 1; back := back || jsonb_build_array(ln || jsonb_build_object('id', gen_random_uuid(), 'state', 'issue'));
    end if;
  end loop;
  update cnotices set status = 'done', reviewed_at = now(), reviewed_by = coalesce(me.name, ''), acc_note = left(coalesce(msg, ''), 300) where id = nid;
  /* المُعاد يعود إلى مسودة الجامع ليصححه ويعيد إرساله */
  if isn > 0 then
    select * into d from cnotices where collector_id = n.collector_id and status = 'draft' for update;
    if d.id is null then insert into cnotices (collector_id, collector_name, status, lines) values (n.collector_id, n.collector_name, 'draft', back);
    else update cnotices set lines = (select coalesce(jsonb_agg(y), '[]') from jsonb_array_elements(d.lines) y
                                      where not exists (select 1 from jsonb_array_elements(back) b where b->>'studentId' = y->>'studentId' and b->>'y' = y->>'y' and b->>'m' = y->>'m')) || back
         where id = d.id; end if;
  end if;
  insert into news (id, text, audience, date, author_id, author)
  values (gen_random_uuid(), 'تم تحصيل إخطارك: عدد الطلاب ' || okn || '، والإجمالي ' || trim_scale(okt) || ' جنيه.'
          || case when isn > 0 then ' وأُعيد إليك ' || isn || ' من الأسماء بملاحظة المحاسب، فصحّحها وأعد إرسالها من «تحصيل».' else '' end,
          'm:' || n.collector_id::text, current_date, me.id, coalesce(me.name, ''));
  return case when isn > 0 then 'partial' else 'done' end;
end $$;

-- 8) القراءة: للجامع إخطاراته (المسودة والمرسَلة وآخر ما انتهى)، وللمحاسب المرسَلة وسجل ما انتهى
create or replace function public.cn_list(kind text default 'mine', lim int default 100) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.ord desc), '[]') from (
    select n.id, n.collector_id, n.collector_name, n.status, n.lines, n.acc_note, n.created_at, n.sent_at, n.reviewed_at, n.reviewed_by,
           coalesce(n.reviewed_at, n.sent_at, n.created_at) ord
    from cnotices n
    where case kind
      when 'mine'  then n.collector_id in (select public.my_ids()) and (n.status <> 'done' or n.reviewed_at > now() - interval '60 days')
      when 'inbox' then public.has_perm('fees.collect') and n.status = 'sent'
      when 'log'   then public.has_perm('fees.collect') and n.status = 'done'
      else false end
    order by coalesce(n.reviewed_at, n.sent_at, n.created_at) desc
    limit greatest(1, least(coalesce(lim, 100), 500))
  ) q
$$;

revoke all on function public.cn_add(uuid, int, int, numeric, date, text), public.cn_remove(uuid), public.cn_send(),
  public.cn_mark(uuid, uuid, boolean, text), public.cn_finish(uuid, text), public.cn_list(text, int) from public, anon;
grant execute on function public.cn_add(uuid, int, int, numeric, date, text), public.cn_remove(uuid), public.cn_send(),
  public.cn_mark(uuid, uuid, boolean, text), public.cn_finish(uuid, text), public.cn_list(text, int) to authenticated;

notify pgrst, 'reload schema';
