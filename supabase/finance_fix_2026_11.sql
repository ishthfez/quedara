-- =====================================================================
--  إصلاحات مالية (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى، وهو آمن للتكرار.
--  إن أعدت تنفيذ fees.sql أو collections.sql أو cnotices.sql لاحقًا فأعد تنفيذ هذا الملف بعدها.
-- =====================================================================

-- 1) حذف طالب لا يمسح مدفوعاته: كان حذف الطالب يحذف كل اشتراكاته من الإيرادات (on delete cascade).
--    الآن يرفض الخادم حذف طالب له مدفوعات؛ يُجعل «منقطع» بدلًا من ذلك.
--    (الدمج والاسترجاع يعملان كما هما: الدمج ينقل المدفوعات أولًا، والاسترجاع يحذف الاشتراكات قبل الأعضاء.)
do $$
declare c record;
begin
  for c in select con.conname from pg_constraint con
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
           where con.conrelid = 'public.fees'::regclass and con.contype = 'f' and a.attname = 'student_id'
  loop
    execute format('alter table public.fees drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.fees add constraint fees_student_id_fkey
  foreign key (student_id) references public.members(id) on delete restrict;

-- 2) حذف معلم لا يمسح قوائم التحصيل القديمة (سجل ما سُلِّم من نقود): تبقى القائمة بلا معلم.
do $$
declare c record;
begin
  for c in select con.conname from pg_constraint con
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
           where con.conrelid = 'public.collections'::regclass and con.contype = 'f' and a.attname = 'teacher_id'
  loop
    execute format('alter table public.collections drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.collections add constraint collections_teacher_id_fkey
  foreign key (teacher_id) references public.members(id) on delete set null;

-- 3) لا يُحذف عضو معه كشف تحصيل لم يُراجَع (نقود في يده لم يستلمها المحاسب)
create or replace function public.members_del_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qulearn.restoring', true), '') = 'on' then return old; end if;
  if exists (select 1 from cnotices n where n.collector_id = old.id
             and (n.status = 'sent' or (n.status = 'draft' and jsonb_array_length(coalesce(n.lines, '[]'::jsonb)) > 0))) then
    raise exception 'لا يمكن حذف «%»: معه كشف تحصيل لم يراجعه المحاسب بعد', old.name;
  end if;
  return old;
end $$;
drop trigger if exists members_del_guard on public.members;
create trigger members_del_guard before delete on public.members for each row execute function public.members_del_guard();

-- 4) cn_finish: الأسطر التي يعيدها المحاسب تُضاف إلى مسودة الجامع دون حذف ما فيها
--    (كان يحذف من المسودة أي سطر للطالب والشهر نفسيهما، ولو كان تحصيلًا جديدًا).
--    باقي الدالة كما في cnotices.sql.
create or replace function public.cn_finish(nid uuid, msg text default '') returns text
language plpgsql security definer set search_path = public as $$
declare me record; n record; ln jsonb; okn int := 0; okt numeric := 0; isn int := 0; back jsonb := '[]'; d record;
begin
  if not public.has_perm('fees.collect') then raise exception 'غير مصرح'; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'accountant') desc limit 1;
  select * into n from cnotices where id = nid for update;
  if n.id is null or n.status <> 'sent' then raise exception 'الكشف غير موجود أو انتهت مراجعته'; end if;
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
  /* المُعاد يعود إلى مسودة الجامع ليصححه ويعيد إرساله، بجانب ما في المسودة لا بدلًا منه */
  if isn > 0 then
    select * into d from cnotices where collector_id = n.collector_id and status = 'draft' for update;
    if d.id is null then insert into cnotices (collector_id, collector_name, status, lines) values (n.collector_id, n.collector_name, 'draft', back);
    else update cnotices set lines = coalesce(d.lines, '[]'::jsonb) || back where id = d.id; end if;
  end if;
  insert into news (id, text, audience, date, author_id, author)
  values (gen_random_uuid(), 'تم تحصيل كشفك: عدد الطلاب ' || okn || '، والإجمالي ' || trim_scale(okt) || ' جنيه.'
          || case when isn > 0 then ' وأُعيد إليك ' || isn || ' من الأسماء بملاحظة المحاسب، فصحّحها وأعد إرسالها من «تحصيل».' else '' end,
          'm:' || n.collector_id::text, current_date, me.id, coalesce(me.name, ''));
  return case when isn > 0 then 'partial' else 'done' end;
end $$;
revoke all on function public.cn_finish(uuid, text) from public, anon;
grant execute on function public.cn_finish(uuid, text) to authenticated;

notify pgrst, 'reload schema';
