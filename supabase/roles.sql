-- =====================================================================
-- أنواع الحسابات المعتمدة: «مشرف عام» و«إداري» (في مكان)
--   - المشرف العام: حساب «مشرف» عليه scope = 'all' (في members.info) يرى كل الحلقات والأماكن،
--     ويعمل فيها كما يعمل المشرف في حلقاته (حضور وتسميع وغياب المعلمين).
--   - الإداري: نوع حساب جديد placeadmin، أماكنه في members.info.places (قائمة معرّفات أماكن).
--     يطّلع فقط على حلقات أماكنه وطلابها وحضورهم وتسميعهم (لا يسجّل شيئًا)،
--     ويجمع اشتراكاتهم ويرسلها للمحاسب بقوائم «التحصيل» نفسها التي يرسلها المعلم.
--   - المدير وحده يحدد النطاق (تعديل الأعضاء للمدير فقط كما في schema.sql).
-- يُنفَّذ بعد notes.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- 1) نوع الحساب وجمهور الإعلانات
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('admin', 'supervisor', 'teacher', 'student', 'accountant', 'placeadmin'));
alter table public.news drop constraint if exists news_audience_check;
alter table public.news add constraint news_audience_check check (audience in ('all', 'teacher', 'supervisor', 'student', 'admin', 'accountant', 'placeadmin') or audience ~ '^m:[0-9a-f-]{36}$');

-- 2) النطاق
create or replace function public.is_general_sup() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role = 'supervisor' and info ->> 'scope' = 'all')
$$;
-- أماكن الإداري الحالي
create or replace function public.my_places() returns setof uuid
language sql stable security definer set search_path = public as $$
  select x::uuid from members m, jsonb_array_elements_text(case when jsonb_typeof(m.info -> 'places') = 'array' then m.info -> 'places' else '[]'::jsonb end) x
  where m.user_id = auth.uid() and m.role = 'placeadmin'
    and x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;
-- حلقات أماكن الإداري الحالي
create or replace function public.my_place_halaqat() returns setof uuid
language sql stable security definer set search_path = public as $$
  select h.id from halaqat h where h.place_id in (select public.my_places())
$$;

-- 3) الطاقم يشمل الإداري (يرى أسماء المعلمين والمشرفين كما يراها المعلم)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and role in ('admin', 'supervisor', 'teacher', 'placeadmin'))
$$;

-- 4) المشرف العام يدير كل الحلقات (الحضور والتسميع)؛ والإداري لا يدير شيئًا
create or replace function public.can_manage_halaqa(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_general_sup() or exists (
    select 1 from halaqat x
    where x.id = h and (x.teacher_id in (select public.my_ids()) or x.supervisor_id in (select public.my_ids())))
$$;

-- 5) من يرى بيانات الطالب: من يعلّمه، أو الطالب نفسه، أو إداري مكان حلقته (اطلاع فقط)
create or replace function public.can_see_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select s in (select public.my_ids()) or public.can_teach_student(s) or exists (
    select 1 from members st
    where st.id = s and st.role = 'student' and st.halaqa_id in (select public.my_place_halaqat()))
$$;
drop policy if exists members_read_place on public.members;
create policy members_read_place on public.members for select to authenticated
  using (role = 'student' and halaqa_id in (select public.my_place_halaqat()));

grant execute on function public.is_general_sup(), public.my_places(), public.my_place_halaqat() to authenticated;
revoke all on function public.is_general_sup(), public.my_places(), public.my_place_halaqat() from anon;

-- 6) مستحقات طلاب حلقة: يضاف الإداري لحلقات أماكنه
create or replace function public.student_dues(hid uuid) returns table (student_id uuid, due numeric)
language sql stable security definer set search_path = public as $$
  select m.id, public.fee_due(m) from members m
  where m.role = 'student' and m.halaqa_id = hid
    and (public.is_admin() or public.has_perm('fees.collect') or hid in (select public.my_place_halaqat())
         or exists (select 1 from halaqat h where h.id = hid and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))))
$$;

-- 7) قائمة التحصيل: يحفظها ويرسلها معلم الحلقة، أو الإداري لحلقات أماكنه (باسمه هو)
create or replace function public.save_collection(hid uuid, yy int, mm int, lns jsonb, send boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; c record; keep jsonb; newl jsonb; cid uuid;
begin
  select m.id, m.name into me from members m join halaqat h on h.id = hid
  where m.user_id = auth.uid()
    and (h.teacher_id = m.id or (m.role = 'placeadmin' and h.place_id is not null and h.place_id in (select public.my_places())))
  order by (h.teacher_id = m.id) desc limit 1;
  if me.id is null then raise exception 'غير مصرح: هذه ليست حلقتك'; end if;
  if public.is_blocked() then raise exception 'حسابك موقوف'; end if;
  if mm < 1 or mm > 12 then raise exception 'شهر غير صحيح'; end if;
  select * into c from collections where teacher_id = me.id and halaqa_id = hid and y = yy and m = mm for update;
  if c.id is not null and c.status = 'sent' then raise exception 'القائمة عند المحاسب للمراجعة'; end if;
  if c.id is not null and c.status = 'done' then raise exception 'أكّد المحاسب القائمة كاملة'; end if;
  keep := coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(c.lines, '[]')) x where x->>'state' = 'ok'), '[]');
  newl := coalesce((select jsonb_agg(jsonb_build_object('studentId', x->>'studentId', 'amount', greatest(0, coalesce(nullif(x->>'amount', '')::numeric, 0)),
                                                      'note', left(coalesce(x->>'note', ''), 300), 'state', 'pending', 'accNote', ''))
    from jsonb_array_elements(coalesce(lns, '[]')) x
    where exists (select 1 from members s where s.id::text = x->>'studentId' and s.role = 'student' and s.halaqa_id = hid)
      and not exists (select 1 from jsonb_array_elements(keep) k where k->>'studentId' = x->>'studentId')
      and (coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 or coalesce(x->>'note', '') <> '')), '[]');
  if send and jsonb_array_length(newl) = 0 then raise exception 'لا توجد مبالغ جديدة للإرسال'; end if;
  if c.id is null then
    insert into collections (teacher_id, teacher_name, halaqa_id, y, m, status, lines, sent_at)
    values (me.id, me.name, hid, yy, mm, case when send then 'sent' else 'draft' end, keep || newl, case when send then now() end) returning id into cid;
  else
    update collections set lines = keep || newl, teacher_name = me.name, status = case when send then 'sent' else 'draft' end,
      sent_at = case when send then now() else sent_at end where id = c.id;
    cid := c.id;
  end if;
  return cid;
end $$;

-- 8) مراجعة المحاسب: كما في collections.sql، والدفعة تُكتب «تحصيل الإداري …» إن كان المحصِّل إداريًا
create or replace function public.review_collection(cid uuid, decisions jsonb, note text) returns text
language plpgsql security definer set search_path = public as $$
declare me record; c record; L jsonb := '[]'; x jsonb; d jsonb; pend int := 0; iss int := 0; st text; who text;
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  select * into c from collections where id = cid for update;
  if c.id is null then raise exception 'القائمة غير موجودة'; end if;
  if c.status <> 'sent' then raise exception 'القائمة ليست بانتظار المراجعة'; end if;
  who := case when exists (select 1 from members where id = c.teacher_id and role = 'placeadmin') then 'تحصيل الإداري ' else 'تحصيل المعلم ' end;
  for x in select e from jsonb_array_elements(c.lines) e loop
    if x->>'state' = 'pending' then
      d := (select e from jsonb_array_elements(coalesce(decisions, '[]')) e where e->>'studentId' = x->>'studentId' limit 1);
      if d is null then pend := pend + 1;
      elsif coalesce((d->>'ok')::boolean, false) then
        if coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 then
          insert into fees (id, student_id, y, m, amount, date, by_name, by_member, note)
          values (gen_random_uuid(), (x->>'studentId')::uuid, c.y, c.m, (x->>'amount')::numeric, current_date, me.name, me.id,
                  who || coalesce(c.teacher_name, '') || coalesce(' — ' || nullif(x->>'note', ''), ''));
        end if;
        x := x || jsonb_build_object('state', 'ok', 'accNote', coalesce(d->>'note', ''));
      else
        x := x || jsonb_build_object('state', 'issue', 'accNote', coalesce(d->>'note', '')); iss := iss + 1;
      end if;
    end if;
    L := L || jsonb_build_array(x);
  end loop;
  st := case when iss > 0 then 'returned' when pend > 0 then 'sent' else 'done' end;
  update collections set lines = L, acc_note = coalesce(note, ''), reviewed_at = now(), reviewed_by = me.name, status = st where id = cid;
  return st;
end $$;

-- 9) الملاحظات: الإداري يستقبلها (ويرسلها إن مُنح صلاحية «ملاحظات»)
create or replace function public.note_targets()
returns table (id uuid, name text, role text, title text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('notes.send') then raise exception 'غير مصرح'; end if;
  return query
    select m.id, m.name, m.role, ''::text
    from members m
    where m.role in ('admin', 'supervisor', 'teacher', 'accountant', 'placeadmin')
      and m.id not in (select public.my_ids())
    order by m.name;
end $$;
create or replace function public.send_note_to(target uuid, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; nid uuid := gen_random_uuid();
begin
  if not public.has_perm('notes.send') then raise exception 'غير مصرح'; end if;
  if not exists (select 1 from members where id = target and role in ('admin', 'supervisor', 'teacher', 'accountant', 'placeadmin')) then raise exception 'الموظف غير موجود'; end if;
  if length(trim(coalesce(body, ''))) < 2 or length(body) > 2000 then raise exception 'نص الملاحظة غير صالح'; end if;
  select id, name, role into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  insert into news (id, text, audience, date, author_id, author)
  values (nid, trim(body), 'm:' || target::text, current_date, me.id,
          (case me.role when 'accountant' then 'المحاسب' when 'teacher' then 'المعلم' when 'supervisor' then 'المشرف' when 'placeadmin' then 'الإداري' else 'المدير' end) || ' ' || me.name);
  return nid;
end $$;
revoke all on function public.note_targets(), public.send_note_to(uuid, text), public.student_dues(uuid),
  public.save_collection(uuid, int, int, jsonb, boolean), public.review_collection(uuid, jsonb, text) from public, anon;
grant execute on function public.note_targets(), public.send_note_to(uuid, text), public.student_dues(uuid),
  public.save_collection(uuid, int, int, jsonb, boolean), public.review_collection(uuid, jsonb, text) to authenticated;

-- 10) المزامنة: نسخة notes.sql نفسها، ويضاف إليها المشرف العام والإداري.
--     هذان لا يُقيَّدان بقائمة حلقات (قد تكون مئات الطلاب)، بل يُجلب لهما ما تسمح به قواعد الأمان أعلاه.
create or replace function public.sync_check(since timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me    uuid[] := array(select id from members where user_id = auth.uid());
  roles text[] := array(select role from members where user_id = auth.uid());
  adm   boolean := 'admin' = any(roles);
  sup   boolean := 'supervisor' = any(roles);
  staff boolean := 'teacher' = any(roles) or sup;
  acc   boolean := 'accountant' = any(roles);
  gsup  boolean := exists (select 1 from members where user_id = auth.uid() and role = 'supervisor' and info ->> 'scope' = 'all');
  padm  boolean := 'placeadmin' = any(roles);
  hal uuid[]; stu uuid[]; ids uuid[]; pl uuid[]; allids uuid[]; t text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if adm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'attendance' where exists (select 1 from attendance where sync_ts > since)
      union all select 'records' where exists (select 1 from records where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since)
      union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
      union all select 'pending_columns' where exists (select 1 from pending_columns where sync_ts > since)
      union all select 'pay_settings' where exists (select 1 from pay_settings where sync_ts > since)
      union all select 'pay_employees' where exists (select 1 from pay_employees where sync_ts > since)
      union all select 'pay_rows' where exists (select 1 from pay_rows where sync_ts > since)
      union all select 'pay_closed' where exists (select 1 from pay_closed where sync_ts > since)
      union all select 'absences' where exists (select 1 from absences where sync_ts > since)
      union all select 'fees' where exists (select 1 from fees where sync_ts > since)
      union all select 'collections' where exists (select 1 from collections where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- المحاسب: كل الطلاب والحلقات والأماكن واشتراكاته وملاحظاته (بلا تقييد بنطاق حلقات)
  if acc and not staff and not padm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since and (audience in ('all', 'accountant') or author_id = any(me) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
      union all select 'fees' where public.has_perm('fees.collect') and exists (select 1 from fees where sync_ts > since)
      union all select 'collections' where public.has_perm('fees.collect') and exists (select 1 from collections where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')));
  end if;

  -- المشرف العام والإداري: بلا قائمة نطاق؛ قواعد الأمان تحدد ما يصل لكل منهما
  if gsup or padm then
    select array_agg(x) into t from (
      select 'settings' x where exists (select 1 from settings where sync_ts > since)
      union all select 'places' where exists (select 1 from places where sync_ts > since)
      union all select 'members' where exists (select 1 from members where sync_ts > since)
      union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since and member_id = any(me))
      union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since)
      union all select 'attendance' where exists (select 1 from attendance where sync_ts > since)
      union all select 'records' where exists (select 1 from records where sync_ts > since)
      union all select 'news' where exists (select 1 from news where sync_ts > since and (audience = 'all' or audience = any(roles) or author_id = any(me) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
      union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
      union all select 'collections' where exists (select 1 from collections where sync_ts > since and teacher_id = any(me))
      union all select 'absences' where sup and exists (select 1 from absences where sync_ts > since)
      union all select 'staff' where sup and exists (select 1 from pay_employees where sync_ts > since union all select 1 from pay_closed where sync_ts > since)
      union all select 'deleted' where exists (select 1 from sync_deleted where at > since)
    ) q;
    return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')), 'me', to_jsonb(me), 'sup', sup);
  end if;

  -- نطاق المستخدم: حلقاته (أو حلقته إن كان طالبًا)، وطلابها، وأسماء معلميها ومشرفيها
  hal := array(select id from halaqat where teacher_id = any(me) or supervisor_id = any(me)
               or id in (select halaqa_id from members where id = any(me) and halaqa_id is not null));
  stu := case when staff then array(select id from members where role = 'student' and halaqa_id = any(hal)) else '{}' end
         || array(select id from members where id = any(me) and role = 'student');
  ids := me || array(select x from halaqat h, unnest(array[h.teacher_id, h.supervisor_id]) x where h.id = any(hal) and x is not null);
  pl  := array(select place_id from halaqat where id = any(hal) and place_id is not null);
  allids := ids || stu || hal || pl;

  select array_agg(x) into t from (
    select 'settings' x where exists (select 1 from settings where sync_ts > since)
    union all select 'places' where exists (select 1 from places where sync_ts > since and (sup or id = any(pl)))
    union all select 'members' where exists (select 1 from members where sync_ts > since and (id = any(ids) or id = any(stu)))
    union all select 'member_admin' where exists (select 1 from member_admin where sync_ts > since and member_id = any(me))
    union all select 'halaqat' where exists (select 1 from halaqat where sync_ts > since and id = any(hal))
    union all select 'attendance' where exists (select 1 from attendance where sync_ts > since and student_id = any(stu))
    union all select 'records' where exists (select 1 from records where sync_ts > since and student_id = any(stu))
    union all select 'news' where exists (select 1 from news where sync_ts > since and (audience = 'all' or audience = any(roles) or audience = any(array(select 'm:' || x::text from unnest(me) x))))
    union all select 'custom_fields' where exists (select 1 from custom_fields where sync_ts > since)
    union all select 'collections' where exists (select 1 from collections where sync_ts > since and teacher_id = any(me))
    -- غياب المعلمين عمل مشترك بين المشرفين (حتى لا يُسجَّل الغياب نفسه مرتين)
    union all select 'absences' where sup and exists (select 1 from absences where sync_ts > since)
    union all select 'staff' where sup and exists (select 1 from pay_employees where sync_ts > since union all select 1 from pay_closed where sync_ts > since)
    union all select 'deleted' where exists (select 1 from sync_deleted where at > since and (
      tbl in ('settings', 'news', 'custom_fields') or (sup and tbl in ('places', 'absences')) or scope && allids))
  ) q;
  return jsonb_build_object('now', clock_timestamp(), 'tables', to_jsonb(coalesce(t, '{}')),
    'hal', to_jsonb(hal), 'stu', to_jsonb(stu), 'ids', to_jsonb(ids), 'pl', to_jsonb(pl), 'me', to_jsonb(me), 'sup', sup);
end $$;
revoke all on function public.sync_check(timestamptz) from public, anon;
grant execute on function public.sync_check(timestamptz) to authenticated;

notify pgrst, 'reload schema';
