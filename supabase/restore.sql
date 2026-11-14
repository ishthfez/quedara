-- =====================================================================
-- استرجاع نسخة احتياطية (من ملفات Google Drive التي يصنعها backup.sql)
--   backup_restore(data, mode): للمدير فقط، في عملية واحدة (تنجح كاملة أو لا يتغير شيء).
--     mode = 'merge'   : يُرجع المحذوف ويعيد المعدَّل إلى حاله في النسخة، ويُبقي ما أُضيف بعدها.
--     mode = 'replace' : تعود الجداول كما كانت يوم النسخة تمامًا (يُحذف ما أُضيف بعدها)، عدا حسابات المديرين.
--   - صور الطلاب الحالية تبقى (النسخة لا تحويها)، وحسابات الدخول لا تتأثر.
--   - اسم من سجّل كل دفعة يبقى كما في النسخة.
-- يُنفَّذ بعد backup.sql، مرة واحدة، وآمن للتكرار.
-- =====================================================================

-- أعمدة المفتاح الأساسي لجدول
create or replace function public.restore_pk(t text) returns text[]
language sql stable security definer set search_path = public as $$
  select array_agg(a.attname::text order by array_position(i.indkey::int2[], a.attnum))
  from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
  where i.indrelid = ('public.' || t)::regclass and i.indisprimary
$$;

-- إدراج صفوف جدول من النسخة أو تحديثها (بالأعمدة الموجودة في النسخة فقط، ودون الأعمدة المحسوبة والصور)
create or replace function public.restore_table(t text, rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare cols text[]; pk text[] := public.restore_pk(t); keys text[]; u record; upd text; n int;
  lst text; x text; b text;
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then return 0; end if;
  select array_agg(k) into keys from (select distinct jsonb_object_keys(r) k from jsonb_array_elements(rows) r) q;
  select array_agg(column_name::text order by ordinal_position) into cols from information_schema.columns
    where table_schema = 'public' and table_name = t and is_generated = 'NEVER' and column_name = any(keys) and column_name <> 'photo';
  lst := (select string_agg(quote_ident(c), ',') from unnest(cols) c);
  -- صف حالي يشارك صفًا من النسخة في مفتاح طبيعي (مثل حضور الطالب في اليوم نفسه) لكن بمعرّف آخر: يُحذف لتحل محله نسخة الملف
  for u in select array_agg(a.attname::text order by array_position(c.conkey, a.attnum)) cs
           from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
           where c.conrelid = ('public.' || t)::regclass and c.contype = 'u' group by c.oid loop
    x := (select string_agg('x.' || quote_ident(c), ',') from unnest(u.cs) c);
    b := (select string_agg('b.' || quote_ident(c), ',') from unnest(u.cs) c);
    execute format('delete from public.%I x using jsonb_populate_recordset(null::public.%I, $1) b where (%s) = (%s) and (%s) is distinct from (%s)', t, t, x, b,
      (select string_agg('x.' || quote_ident(c), ',') from unnest(pk) c), (select string_agg('b.' || quote_ident(c), ',') from unnest(pk) c)) using rows;
  end loop;
  upd := (select string_agg(format('%I = excluded.%I', c, c), ', ') from unnest(cols) c where not c = any(pk));
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
    t, lst, lst, t, (select string_agg(quote_ident(c), ',') from unnest(pk) c),
    case when upd is null then 'nothing' else 'update set ' || upd end) using rows;
  get diagnostics n = row_count;
  return n;
end $$;

-- حذف ما ليس في النسخة (لطريقة «استبدال كامل»)
create or replace function public.restore_prune(t text, rows jsonb, extra text default '') returns int
language plpgsql security definer set search_path = public as $$
declare pk text[] := public.restore_pk(t); n int;
begin
  execute format('delete from public.%I x where not exists (select 1 from jsonb_populate_recordset(null::public.%I, $1) b where (%s) = (%s))%s', t, t,
    (select string_agg('x.' || quote_ident(c), ',') from unnest(pk) c), (select string_agg('b.' || quote_ident(c), ',') from unnest(pk) c), extra)
    using coalesce(rows, '[]'::jsonb);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.backup_restore(data jsonb, mode text default 'merge') returns jsonb
language plpgsql security definer set search_path = public as $$
declare tb jsonb := data -> 'tables'; t text; n int; res jsonb := '{}'; del jsonb := '{}'; mem jsonb;
  parents text[] := array['settings', 'places'];
  children text[] := array['member_admin', 'attendance', 'records', 'news', 'custom_fields', 'pending_columns', 'pay_settings', 'pay_employees',
                           'pay_rows', 'pay_closed', 'absences', 'fees', 'collections', 'exams'];
begin
  if not public.is_admin() then raise exception 'استرجاع النسخ الاحتياطية للمدير فقط' using errcode = '42501'; end if;
  if coalesce(data ->> 'app', '') <> 'qulearn' or jsonb_typeof(tb) is distinct from 'object' then raise exception 'الملف ليس نسخة احتياطية لهذا التطبيق'; end if;
  if mode not in ('merge', 'replace') then raise exception 'طريقة استرجاع غير معروفة'; end if;
  perform set_config('qulearn.restoring', 'on', true);

  -- «استبدال كامل»: حذف ما ليس في النسخة، من الأبناء إلى الآباء (حسابات المديرين لا تُحذف أبدًا)
  if mode = 'replace' then
    foreach t in array array['exams', 'collections', 'fees', 'absences', 'pay_rows', 'pay_closed', 'pay_employees', 'pending_columns', 'custom_fields',
                             'news', 'records', 'attendance', 'member_admin', 'halaqat', 'members', 'places'] loop
      if tb ? t and to_regclass('public.' || t) is not null then
        n := public.restore_prune(t, tb -> t, case when t = 'members' then ' and x.role <> ''admin''' else '' end);
        if n > 0 then del := del || jsonb_build_object(t, n); end if;
      end if;
    end loop;
  end if;

  foreach t in array parents loop
    if tb ? t and to_regclass('public.' || t) is not null then res := res || jsonb_build_object(t, public.restore_table(t, tb -> t)); end if;
  end loop;
  -- الأعضاء أولًا بلا حلقة (لأن الحلقة تشير إلى معلمها)، ثم الحلقات، ثم حلقة كل طالب
  if tb ? 'members' then
    select jsonb_agg(r || jsonb_build_object('halaqa_id', null,
             'user_id', case when exists (select 1 from auth.users au where au.id::text = r ->> 'user_id') then r -> 'user_id' else 'null'::jsonb end))
      into mem from jsonb_array_elements(tb -> 'members') r;
    res := res || jsonb_build_object('members', public.restore_table('members', mem));
  end if;
  if tb ? 'halaqat' then res := res || jsonb_build_object('halaqat', public.restore_table('halaqat', tb -> 'halaqat')); end if;
  if tb ? 'members' then
    update members m set halaqa_id = (b ->> 'halaqa_id')::uuid
      from jsonb_array_elements(tb -> 'members') b
      where m.id = (b ->> 'id')::uuid and m.halaqa_id is distinct from (b ->> 'halaqa_id')::uuid
        and (b ->> 'halaqa_id' is null or exists (select 1 from halaqat h where h.id = (b ->> 'halaqa_id')::uuid));
  end if;
  foreach t in array children loop
    if tb ? t and to_regclass('public.' || t) is not null then res := res || jsonb_build_object(t, public.restore_table(t, tb -> t)); end if;
  end loop;
  return jsonb_build_object('mode', mode, 'restored', res, 'deleted', del, 'backup_at', data -> 'at');
end $$;

revoke all on function public.restore_pk(text), public.restore_table(text, jsonb), public.restore_prune(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.backup_restore(jsonb, text) from public, anon;
grant execute on function public.backup_restore(jsonb, text) to authenticated;

-- تسجيل الدفعة باسم من سجّلها: أثناء الاسترجاع يبقى الاسم كما في النسخة
create or replace function public.fees_by() returns trigger
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  if current_setting('qulearn.restoring', true) = 'on' then return new; end if;
  if auth.uid() is null then return new; end if;
  select id, name into me from members where user_id = auth.uid() and role <> 'student' order by (role = 'admin') desc limit 1;
  if me.id is not null then new.by_member := me.id; if not public.is_admin() or new.by_name is null then new.by_name := me.name; end if; end if;
  return new;
end $$;

notify pgrst, 'reload schema';
