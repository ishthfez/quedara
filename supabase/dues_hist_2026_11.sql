-- =====================================================================
--  تثبيت مستحق الأشهر الماضية (مراجعة 2026-11)
--  كان مستحق أي شهر يُحسب بمكان الطالب وفئته وخصمه ومبلغه الخاص «الحاليين»: نقله لمكان أغلى كان يُظهر متأخرات
--  وهمية عن أشهر سدّدها، وإعفاؤه كان يمحو متأخراته السابقة.
--  الآن: كلما تغيّر شيء من ذلك يُحفظ ما كان عليه قبله في info.feeHist = [{ to: 'YYYY-MM' (آخر شهر كان عليه)، pid، cat، fee… }]
--  (يكتبه الخادم وحده، ويصل للأجهزة مع بيانات الطالب)، ويُحسب مستحق كل شهر بحاله في ذلك الشهر.
--  التغيير يسري من الشهر الجاري؛ وما قبل هذا الملف لا تاريخ له فيبقى محسوبًا بالحال الحالية كما كان.
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى (بعد security_fix_2026_11.sql)، وهو آمن للتكرار.
--  إن أعدت تنفيذ fee_periods.sql أو security_fix_2026_11.sql لاحقًا فأعد تنفيذ هذا الملف بعدها.
-- =====================================================================

-- 1) حفظ الحال السابقة عند تغيّرها (بعد حارس التعديل: الاسم يبدأ بـ zz فيعمل بعده)
create or replace function public.members_fee_hist() returns trigger
language plpgsql security definer set search_path = public as $$
declare hist jsonb; prev text; k text; changed boolean := false; jd text; e jsonb;
begin
  if new.role <> 'student' or old.role <> 'student' then return new; end if;
  if coalesce(current_setting('qulearn.restoring', true), '') = 'on' then return new; end if;   -- الاسترجاع يكتب ما في النسخة كما هو
  hist := case when jsonb_typeof(old.info -> 'feeHist') = 'array' then old.info -> 'feeHist' else '[]'::jsonb end;
  if new.halaqa_id is distinct from old.halaqa_id or new.cat is distinct from old.cat then changed := true; end if;
  foreach k in array array['fee', 'feeCat', 'feeSys', 'feeDisc', 'feeDiscVal', 'feeDiscType'] loop
    if (old.info -> k) is distinct from (new.info -> k) then changed := true; end if;
  end loop;
  prev := to_char(((now() at time zone 'Africa/Cairo')::date - interval '1 month')::date, 'YYYY-MM');
  jd := case when coalesce(old.info ->> 'joinDate', '') ~ '^[0-9]{4}-[0-9]{2}' then left(old.info ->> 'joinDate', 7) end;
  /* يُحفظ مرة واحدة لكل شهر (أول تغيير فيه يحفظ ما كان عليه قبله)، ولمن كان طالبًا قبل الشهر الجاري */
  if changed and (jd is null or jd <= prev) and not exists (select 1 from jsonb_array_elements(hist) x where x ->> 'to' = prev) then
    e := jsonb_strip_nulls(jsonb_build_object('to', prev, 'pid', (select h.place_id::text from halaqat h where h.id = old.halaqa_id), 'cat', old.cat,
      'fee', old.info -> 'fee', 'feeCat', old.info -> 'feeCat', 'feeSys', old.info -> 'feeSys',
      'feeDisc', old.info -> 'feeDisc', 'feeDiscVal', old.info -> 'feeDiscVal', 'feeDiscType', old.info -> 'feeDiscType'));
    hist := hist || jsonb_build_array(e);
  end if;
  /* السجل يكتبه الخادم وحده: ما يرسله الجهاز (وقد تكون نسخته أقدم) لا يغيّره */
  new.info := case when jsonb_array_length(hist) = 0 then coalesce(new.info, '{}'::jsonb) - 'feeHist'
                   else jsonb_set(coalesce(new.info, '{}'::jsonb), '{feeHist}', hist) end;
  return new;
end $$;
drop trigger if exists zz_members_fee_hist on public.members;
create trigger zz_members_fee_hist before update on public.members for each row execute function public.members_fee_hist();

-- 2) حارس تعديل الأعضاء: نسخة security_fix_2026_11.sql كما هي + تجاهل feeHist (يكتبه الخادم وحده، فلا يُرفض تعديل طالب
--    لأن نسخة الجهاز من سجله أقدم)
create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if coalesce(current_setting('app.qtr', true), '') = '1' then return new; end if;
  if auth.uid() is null or public.is_admin() then return new; end if;
  if coalesce(current_setting('app.qtemp', true), '') <> '1' then
    if tg_op = 'INSERT' then
      if new.info ?| array['temp', 'course', 'temp_until'] then raise exception 'غير مصرح بإنشاء حساب مؤقت من هنا'; end if;
    else
      foreach k in array array['temp', 'course', 'temp_until'] loop
        if (old.info -> k) is distinct from (new.info -> k) then raise exception 'غير مصرح بتعديل %', k; end if;
      end loop;
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'student' and (new.user_id is not null or new.login_email is not null) then raise exception 'غير مصرح'; end if;
    return new;
  end if;
  if old.role <> 'student' and new.role <> 'student' then return new; end if;
  if new.role is distinct from old.role or new.user_id is distinct from old.user_id or new.login_email is distinct from old.login_email then
    raise exception 'غير مصرح بتعديل حساب الطالب';
  end if;
  if public.has_perm('students.edit') then return new; end if;
  if replace(coalesce(new.name, ''), ' ', '') <> replace(coalesce(old.name, ''), ' ', '')
     or coalesce(new.phone, '') <> coalesce(old.phone, '') or coalesce(new.cat, 'child') <> coalesce(old.cat, 'child')
     or coalesce(new.extra, '{}'::jsonb) <> coalesce(old.extra, '{}'::jsonb) or new.photo is distinct from old.photo then
    raise exception 'غير مصرح بتعديل بيانات الطالب';
  end if;
  if new.halaqa_id is distinct from old.halaqa_id and not public.has_perm('students.move') then raise exception 'غير مصرح بنقل الطالب'; end if;
  for k in select jsonb_object_keys(coalesce(old.info, '{}'::jsonb) || coalesce(new.info, '{}'::jsonb)) loop
    if (old.info -> k) is distinct from (new.info -> k) then
      if k = 'feeHist' then continue; end if;
      if k in ('status', 'statusDate') and public.has_perm('students.status') then continue; end if;
      if k in ('fee', 'feeCat', 'feeSys', 'feeDisc', 'feeDiscVal', 'feeDiscType') and public.has_perm('fees.amount') then continue; end if;
      raise exception 'غير مصرح بتعديل %', k;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members for each row execute function public.members_guard();

-- 3) المستحق عن شهر: كما في fee_periods.sql، لكن بحال الطالب في ذلك الشهر (من feeHist) لا حاله الآن
create or replace function public.fee_due_ym(s public.members, yy int, mm int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := coalesce((select value from settings where key = 'priv_fees'), '{}'); i jsonb := coalesce(s.info, '{}');
        yc jsonb; base numeric; c jsonb; d jsonb; v numeric; t text; off numeric := 0; g text; p jsonb; o int; pid text; hs jsonb; scat text := s.cat;
begin
  yy := coalesce(yy, extract(year from current_date)::int);
  mm := least(12, greatest(1, coalesce(mm, extract(month from current_date)::int)));
  o := yy * 100 + mm;
  if jsonb_typeof(cfg->'years') = 'object' then
    select value into yc from jsonb_each(cfg->'years') where public.fee_period_ord(key) is not null and public.fee_period_ord(key) <= o
      order by public.fee_period_ord(key) desc limit 1;
    if yc is null then select value into yc from jsonb_each(cfg->'years') where public.fee_period_ord(key) is not null order by public.fee_period_ord(key) limit 1; end if;
  end if;
  yc := coalesce(yc, cfg);
  pid := (select h.place_id::text from halaqat h where h.id = s.halaqa_id);
  /* حال الطالب في الشهر المطلوب: أقرب سجل ينتهي فيه أو بعده */
  if jsonb_typeof(i -> 'feeHist') = 'array' then
    select x into hs from jsonb_array_elements(i -> 'feeHist') x
      where public.fee_period_ord(x ->> 'to') >= o order by public.fee_period_ord(x ->> 'to') limit 1;
  end if;
  if hs is not null then
    i := (i - 'fee' - 'feeCat' - 'feeSys' - 'feeDisc' - 'feeDiscVal' - 'feeDiscType')
         || jsonb_strip_nulls(jsonb_build_object('fee', hs -> 'fee', 'feeCat', hs -> 'feeCat', 'feeSys', hs -> 'feeSys',
                                                 'feeDisc', hs -> 'feeDisc', 'feeDiscVal', hs -> 'feeDiscVal', 'feeDiscType', hs -> 'feeDiscType'));
    pid := hs ->> 'pid'; scat := coalesce(hs ->> 'cat', s.cat);
  end if;
  p := yc -> 'places' -> pid;
  if coalesce(i->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$' and (i->>'fee')::numeric > 0 then base := (i->>'fee')::numeric;
  else
    select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'id' = i->>'feeCat' limit 1;
    if c is null then select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'def' = (case when scat = 'adult' then 'adult' else 'child' end) limit 1; end if;
    if c is not null then
      if coalesce(p->'cats'->>(c->>'id'), '') ~ '^[0-9]+(\.[0-9]+)?$' then base := (p->'cats'->>(c->>'id'))::numeric;
      else base := coalesce(nullif(c->>'amount', '')::numeric, 0); end if;
    else
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
    elsif coalesce((d->>'each')::boolean, false) then v := 0; t := d->>'type';
    elsif coalesce(cfg->'placeDiscs'->pid->>(d->>'id'), '') ~ '^[0-9]+(\.[0-9]+)?$' then v := (cfg->'placeDiscs'->pid->>(d->>'id'))::numeric; t := d->>'type';
    else v := coalesce(nullif(d->>'value', '')::numeric, 0); t := d->>'type'; end if;
    off := least(base, greatest(0, case when t = 'amt' then v else base * v / 100 end));
  end if;
  return round(base - off, 2);
end $$;
revoke all on function public.fee_due_ym(public.members, int, int) from public, anon;

notify pgrst, 'reload schema';
