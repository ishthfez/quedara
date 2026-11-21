-- =====================================================================
--  الاسترجاع بثلاث طرق يختارها المدير (مراجعة 2026-11)
--  يُنفَّذ في Supabase ← SQL Editor بعد كل الملفات الأخرى (بعد security_guards.sql)، وهو آمن للتكرار.
--  إن أعدت تنفيذ restore.sql أو security_guards.sql لاحقًا فأعد تنفيذ هذا الملف بعدها.
--
--   mode = 'add'     : إضافة الناقص فقط — يُرجع ما ليس موجودًا (طالب أو دفعة حُذفا خطأً) ولا يلمس أي سجل موجود.
--   mode = 'merge'   : دمج — يُرجع المحذوف ويعيد المعدَّل إلى حاله في النسخة، ويُبقي ما أُضيف بعدها (كما كان).
--   mode = 'replace' : استبدال كامل — كما كان، و«المدير العام» لا يُحذف الآن كالمدير (كان يُحذف إن لم يكن في الملف).
-- =====================================================================

-- إدراج ما ليس موجودًا فقط: أي تعارض (المفتاح أو مفتاح طبيعي كحضور الطالب في اليوم نفسه) يُترك السجل الموجود كما هو
create or replace function public.restore_insert_missing(t text, rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare cols text[]; keys text[]; lst text; n int;
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then return 0; end if;
  select array_agg(k) into keys from (select distinct jsonb_object_keys(r) k from jsonb_array_elements(rows) r) q;
  select array_agg(column_name::text order by ordinal_position) into cols from information_schema.columns
    where table_schema = 'public' and table_name = t and is_generated = 'NEVER' and column_name = any(keys) and column_name <> 'photo';
  lst := (select string_agg(quote_ident(c), ',') from unnest(cols) c);
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing', t, lst, lst, t) using rows;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.restore_insert_missing(text, jsonb) from public, anon, authenticated;

-- الاسترجاع: كما في security_guards.sql (حفظ نوع الأعضاء الموجودين وربطهم بالدخول) + طريقة «إضافة الناقص فقط»
create or replace function public.backup_restore(data jsonb, mode text default 'merge') returns jsonb
language plpgsql security definer set search_path = public as $$
declare tb jsonb := data -> 'tables'; t text; n int; res jsonb := '{}'; del jsonb := '{}'; mem jsonb; addonly boolean := (mode = 'add');
  parents text[] := array['settings', 'places'];
  children text[] := array['member_admin', 'attendance', 'records', 'news', 'custom_fields', 'pending_columns', 'pay_settings', 'pay_employees',
                           'pay_rows', 'pay_closed', 'absences', 'fees', 'collections', 'exams'];
begin
  if not public.is_admin() then raise exception 'استرجاع النسخ الاحتياطية للمدير فقط' using errcode = '42501'; end if;
  if coalesce(data ->> 'app', '') <> 'qulearn' or jsonb_typeof(tb) is distinct from 'object' then raise exception 'الملف ليس نسخة احتياطية لهذا التطبيق'; end if;
  if mode not in ('add', 'merge', 'replace') then raise exception 'طريقة استرجاع غير معروفة'; end if;
  perform set_config('qulearn.restoring', 'on', true);

  if mode = 'replace' then
    foreach t in array array['exams', 'collections', 'fees', 'absences', 'pay_rows', 'pay_closed', 'pay_employees', 'pending_columns', 'custom_fields',
                             'news', 'records', 'attendance', 'member_admin', 'halaqat', 'members', 'places'] loop
      if tb ? t and to_regclass('public.' || t) is not null then
        n := public.restore_prune(t, tb -> t, case when t = 'members' then ' and x.role not in (''admin'', ''gmanager'')' else '' end);
        if n > 0 then del := del || jsonb_build_object(t, n); end if;
      end if;
    end loop;
  end if;

  foreach t in array parents loop
    if tb ? t and to_regclass('public.' || t) is not null then
      res := res || jsonb_build_object(t, case when addonly then public.restore_insert_missing(t, tb -> t) else public.restore_table(t, tb -> t) end);
    end if;
  end loop;
  if tb ? 'members' then
    select jsonb_agg(
             r || jsonb_build_object('halaqa_id', null)
               || case
                    -- عضو موجود: نوعه وربطه بحساب الدخول كما هما على الخادم، لا كما في الملف
                    when ex.id is not null then jsonb_build_object('role', ex.role, 'user_id', to_jsonb(ex.user_id), 'login_email', to_jsonb(ex.login_email))
                    -- عضو جديد مدير أو مدير عام: بلا حساب دخول (يُنشأ له من «الأعضاء»)
                    when (r ->> 'role') in ('admin', 'gmanager') then jsonb_build_object('user_id', null, 'login_email', null)
                    -- غيره: يُربط بحسابه إن وُجد وليس حساب مدير أو مدير عام
                    else jsonb_build_object('user_id',
                      case when exists (select 1 from auth.users au where au.id::text = r ->> 'user_id')
                             and not exists (select 1 from members x where x.user_id::text = r ->> 'user_id' and x.role in ('admin', 'gmanager'))
                           then r -> 'user_id' else 'null'::jsonb end)
                  end)
      into mem
      from jsonb_array_elements(tb -> 'members') r
      left join members ex on ex.id::text = r ->> 'id'
      where not addonly or ex.id is null;   -- «إضافة الناقص»: الأعضاء غير الموجودين وحدهم
    res := res || jsonb_build_object('members', case when addonly then public.restore_insert_missing('members', mem) else public.restore_table('members', mem) end);
  end if;
  if tb ? 'halaqat' then
    res := res || jsonb_build_object('halaqat', case when addonly then public.restore_insert_missing('halaqat', tb -> 'halaqat') else public.restore_table('halaqat', tb -> 'halaqat') end);
  end if;
  if tb ? 'members' then
    /* «إضافة الناقص»: الحلقة لمن لا حلقة له فقط (ومنهم من أُضيف الآن)، ولا يُنقل طالب موجود من حلقته */
    update members m set halaqa_id = (b ->> 'halaqa_id')::uuid
      from jsonb_array_elements(tb -> 'members') b
      where m.id = (b ->> 'id')::uuid and m.halaqa_id is distinct from (b ->> 'halaqa_id')::uuid
        and (not addonly or m.halaqa_id is null)
        and (b ->> 'halaqa_id' is null or exists (select 1 from halaqat h where h.id = (b ->> 'halaqa_id')::uuid));
  end if;
  foreach t in array children loop
    if tb ? t and to_regclass('public.' || t) is not null then
      res := res || jsonb_build_object(t, case when addonly then public.restore_insert_missing(t, tb -> t) else public.restore_table(t, tb -> t) end);
    end if;
  end loop;
  return jsonb_build_object('mode', mode, 'restored', res, 'deleted', del, 'backup_at', data -> 'at');
end $$;
revoke all on function public.backup_restore(jsonb, text) from public, anon;
grant execute on function public.backup_restore(jsonb, text) to authenticated;

notify pgrst, 'reload schema';
