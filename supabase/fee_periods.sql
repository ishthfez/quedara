-- =====================================================================
--  تغيير مبلغ الاشتراك ابتداءً من شهر بعينه (لا بأثر رجعي)
--   كانت مبالغ الاشتراك لكل سنة (years في إعدادات الاشتراك بمفتاح السنة «2026»)، فلا يبدأ التغيير إلا أول السنة.
--   الآن يُقبل مع مفتاح السنة مفتاح الشهر «2026-09» (من سبتمبر 2026). مفتاح السنة وحده يعني «من يناير».
--   مستحق شهر بعينه = مبالغ آخر تغيير بدأ في ذلك الشهر أو قبله (وإلا أول تغيير)، فلا يتغير مستحق ما قبله.
--   - fee_due_ym(طالب، سنة، شهر): المستحق عن شهر بعينه.
--   - fee_due_y(طالب، سنة) كما كانت لمن يستدعيها: شهر السنة الحالية الجاري، وديسمبر لما قبلها، ويناير لما بعدها.
--   - staff_fees(سنة، شهر): مستحقات طلاب حلقات العامل عن الشهر المختار (stuview.js).
--  يُنفَّذ بعد fees_staff.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

-- ترتيب المفتاح: «2026» = 202601، «2026-09» = 202609
create or replace function public.fee_period_ord(k text) returns int
language sql immutable as $$
  select case when k ~ '^[0-9]{4}$' then k::int * 100 + 1
              when k ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then left(k, 4)::int * 100 + substr(k, 6, 2)::int end
$$;

create or replace function public.fee_due_ym(s public.members, yy int, mm int) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := coalesce((select value from settings where key = 'priv_fees'), '{}'); i jsonb := coalesce(s.info, '{}');
        yc jsonb; base numeric; c jsonb; d jsonb; v numeric; t text; off numeric := 0; g text; p jsonb; o int;
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
  if coalesce(i->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$' and (i->>'fee')::numeric > 0 then base := (i->>'fee')::numeric;
  else
    select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'id' = i->>'feeCat' limit 1;
    if c is null then select x into c from jsonb_array_elements(coalesce(yc->'cats', '[]')) x where x->>'def' = (case when s.cat = 'adult' then 'adult' else 'child' end) limit 1; end if;
    if c is not null then base := coalesce(nullif(c->>'amount', '')::numeric, 0);
    else
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

-- بالسنة وحدها (لمن يستدعيها كما كانت): الشهر الجاري للسنة الحالية، وديسمبر لما قبلها، ويناير لما بعدها
create or replace function public.fee_due_y(s public.members, yy int) returns numeric
language sql stable security definer set search_path = public as $$
  select public.fee_due_ym(s, yy, case when coalesce(yy, extract(year from current_date)::int) = extract(year from current_date)::int then extract(month from current_date)::int
                                       when yy < extract(year from current_date)::int then 12 else 1 end)
$$;
revoke all on function public.fee_due_ym(public.members, int, int), public.fee_due_y(public.members, int) from public, anon;

-- مستحقات حلقات العامل عن شهر بعينه (بدل السنة وحدها)
drop function if exists public.staff_fees(int);
create or replace function public.staff_fees(yy int, mm int default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with hs as (
    select h.id from halaqat h
    where public.is_admin() or public.has_perm('fees.collect') or public.is_general_sup()
       or h.teacher_id in (select public.my_ids()) or h.supervisor_id in (select public.my_ids())
       or h.id in (select public.my_place_halaqat())
  ), st as (
    select m.id, case when mm is null then public.fee_due_y(m, yy) else public.fee_due_ym(m, yy, mm) end as due from members m
    where m.role = 'student' and m.halaqa_id in (select id from hs)
  )
  select jsonb_build_object(
    'dues', coalesce((select jsonb_agg(jsonb_build_object('s', st.id, 'd', st.due)) from st), '[]'::jsonb),
    'fees', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 's', f.student_id, 'y', f.y, 'm', f.m, 'a', f.amount, 'dt', f.date, 'by', f.by_name, 'n', f.note))
                      from fees f where f.student_id in (select id from st) and f.y between yy - 1 and yy + 1), '[]'::jsonb))
$$;
revoke all on function public.staff_fees(int, int) from public, anon;
grant execute on function public.staff_fees(int, int) to authenticated;

notify pgrst, 'reload schema';
