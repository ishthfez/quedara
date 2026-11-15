-- =====================================================================
--  نظاما الحضور في الاشتراك العام: نظام 6 أيام (general) ونظام 3 أيام (general3) في إعدادات الاشتراك،
--  ونظام كل طالب في بياناته (feeSys = '3' أو '6'، والافتراضي 6).
--  1) fee_due: المستحق على الخادم (لقوائم تحصيل المعلم والإداري) يعرف الاشتراك العام بنظاميه.
--  2) حارس بيانات الطالب: من له صلاحية «قيمة الاشتراك» يغيّر نظام الطالب أيضًا.
--  3) من له صلاحية «قيمة الاشتراك» (المحاسب) يحفظ «إعدادات الاشتراك» أيضًا، لا المدير وحده.
--  4) مبالغ تختلف حسب المكان (places في إعدادات الاشتراك): طالب المكان يأخذ مبلغه، والفارغ يأخذ العام.
--  5) لكل سنة مبالغها (years): مستحقات سنة لا تتغير إن تغيّر الاشتراك في سنة بعدها.
--  يُنفَّذ بعد roles.sql أيضًا.
--  يُنفَّذ بعد collections.sql و student_edit.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- المستحق عن سنة بعينها: لكل سنة مبالغها (years في إعدادات الاشتراك)، فتغيير الاشتراك في سنة جديدة لا يغيّر مستحقات ما قبلها.
-- مبالغ السنة: المحفوظة لها، وإلا لأقرب سنة قبلها، وإلا لأقرب سنة بعدها، وإلا المبالغ العامة. الخصومات واحدة لكل السنوات.
create or replace function public.fee_due_y(s public.members, yy int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := coalesce((select value from settings where key = 'priv_fees'), '{}'); i jsonb := coalesce(s.info, '{}');
        yc jsonb; base numeric; c jsonb; d jsonb; v numeric; t text; off numeric := 0; g text; p jsonb;
begin
  yy := coalesce(yy, extract(year from current_date)::int);
  if jsonb_typeof(cfg->'years') = 'object' then
    select value into yc from jsonb_each(cfg->'years') where key ~ '^[0-9]{4}$' and key::int <= yy order by key::int desc limit 1;
    if yc is null then select value into yc from jsonb_each(cfg->'years') where key ~ '^[0-9]{4}$' order by key::int limit 1; end if;
  end if;
  yc := coalesce(yc, cfg);
  if coalesce(i->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$' and (i->>'fee')::numeric > 0 then base := (i->>'fee')::numeric;
  else
    select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'id' = i->>'feeCat' limit 1;
    if c is null then select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'def' = (case when s.cat = 'adult' then 'adult' else 'child' end) limit 1; end if;
    if c is not null then base := coalesce(nullif(c->>'amount', '')::numeric, 0);
    else
      /* الاشتراك العام: مبلغ مكان الطالب إن حُدّد له مبلغ خاص (places)، وإلا المبلغ العام؛
         ونظام 3 أيام إن اختير للطالب وحُدّد مبلغه، وإلا نظام 6 أيام */
      p := yc -> 'places' -> (select h.place_id::text from halaqat h where h.id = s.halaqa_id);
      g := case when i->>'feeSys' = '3'
                then coalesce(p->>'general3', yc->>'general3', p->>'general', yc->>'general')
                else coalesce(p->>'general', yc->>'general') end;
      if coalesce(g, '') !~ '^[0-9]+(\.[0-9]+)?$' then return null; end if;
      base := g::numeric;
    end if;
  end if;
  select x into d from jsonb_array_elements(coalesce(cfg->'discs', '[]')) x where x->>'id' = i->>'feeDisc' limit 1;
  if d is not null then
    if coalesce(i->>'feeDiscVal', '') ~ '^[0-9]+(\.[0-9]+)?$' then v := (i->>'feeDiscVal')::numeric; t := coalesce(nullif(i->>'feeDiscType', ''), d->>'type');
    else v := case when coalesce((d->>'each')::boolean, false) then 0 else coalesce(nullif(d->>'value', '')::numeric, 0) end; t := d->>'type'; end if;
    off := least(base, greatest(0, case when t = 'amt' then v else base * v / 100 end));
  end if;
  return round(base - off, 2);
end $$;
-- المستحق بالسنة الحالية (لما يستدعيه بلا سنة)
create or replace function public.fee_due(s public.members) returns numeric
language sql stable security definer set search_path = public as $$ select public.fee_due_y(s, extract(year from current_date)::int) $$;
revoke all on function public.fee_due(public.members), public.fee_due_y(public.members, int) from public, anon;

-- مستحقات طلاب حلقة عن سنة بعينها (لقائمة تحصيل شهر من تلك السنة)
create or replace function public.student_dues_y(hid uuid, yy int) returns table (student_id uuid, due numeric)
language sql stable security definer set search_path = public as $$
  select m.id, public.fee_due_y(m, yy) from members m
  where m.role = 'student' and m.halaqa_id = hid
    and (public.is_admin() or public.has_perm('fees.collect') or hid in (select public.my_place_halaqat())
         or exists (select 1 from halaqat h where h.id = hid and (h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids()))))
$$;
revoke all on function public.student_dues_y(uuid, int) from public, anon;
grant execute on function public.student_dues_y(uuid, int) to authenticated;

-- حارس بيانات الطالب (كما في student_edit.sql، ومعه نظام الحضور feeSys)
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'student' and (new.user_id is not null or new.login_email is not null) then raise exception 'غير مصرح'; end if;
    return new;
  end if;
  if old.role <> 'student' and new.role <> 'student' then return new; end if;   -- مثل تعديل المعلم ملفه
  /* حساب الدخول ونوع العضو: للمدير وحده دائمًا */
  if new.role is distinct from old.role or new.user_id is distinct from old.user_id or new.login_email is distinct from old.login_email then
    raise exception 'غير مصرح بتعديل حساب الطالب';
  end if;
  /* كل ما في الاستمارة (الاسم والهاتف والفئة والبيانات والصورة والحلقة) */
  if public.has_perm('students.edit') then return new; end if;
  if replace(coalesce(new.name, ''), ' ', '') <> replace(coalesce(old.name, ''), ' ', '')
     or coalesce(new.phone, '') <> coalesce(old.phone, '') or coalesce(new.cat, 'child') <> coalesce(old.cat, 'child')
     or coalesce(new.extra, '{}'::jsonb) <> coalesce(old.extra, '{}'::jsonb) or new.photo is distinct from old.photo then
    raise exception 'غير مصرح بتعديل بيانات الطالب';
  end if;
  if new.halaqa_id is distinct from old.halaqa_id and not public.has_perm('students.move') then raise exception 'غير مصرح بنقل الطالب'; end if;
  for k in select jsonb_object_keys(coalesce(old.info, '{}'::jsonb) || coalesce(new.info, '{}'::jsonb)) loop
    if (old.info -> k) is distinct from (new.info -> k) then
      if k in ('status', 'statusDate') and public.has_perm('students.status') then continue; end if;
      if k in ('fee', 'feeCat', 'feeSys', 'feeDisc', 'feeDiscVal', 'feeDiscType') and public.has_perm('fees.amount') then continue; end if;
      raise exception 'غير مصرح بتعديل %', k;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members for each row execute function public.members_guard();

-- 3) إعدادات الاشتراك (المبلغ العام بنظاميه والخصومات والفئات): يحفظها المدير ومن له صلاحية «قيمة الاشتراك» (المحاسب)
drop policy if exists settings_write_fees on public.settings;
create policy settings_write_fees on public.settings for all to authenticated
  using (key = 'priv_fees' and public.has_perm('fees.amount')) with check (key = 'priv_fees' and public.has_perm('fees.amount'));

notify pgrst, 'reload schema';
