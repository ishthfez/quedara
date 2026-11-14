-- =====================================================================
-- قسم «النسخ الاحتياطية» في لوحة المدير
--   - يسجّل الخادم وقت كل نسخة تلقائية يأخذها برنامج Google Drive وعددها.
--   - backup_status(): حالة النسخ التلقائي (للمدير).
--   - backup_export_admin(): نسخة كاملة فورية للمدير (بنفس صيغة نسخ Drive، فتصلح للاسترجاع).
-- يُنفَّذ بعد backup.sql، مرة واحدة، وآمن للتكرار.
-- =====================================================================
alter table public.backup_secret add column if not exists last_export_at timestamptz;
alter table public.backup_secret add column if not exists export_count int not null default 0;

-- محتوى النسخة (داخلي): كل جدول موجود مصفوفةً من صفوفه، دون صور الطلاب
create or replace function public.backup_dump() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; j jsonb; out jsonb := '{}';
  tabs text[] := array['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields',
                       'pending_columns', 'pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'fees', 'collections', 'exams'];
begin
  foreach t in array tabs loop
    if to_regclass('public.' || t) is not null then
      execute format('select coalesce(jsonb_agg(to_jsonb(x)%s), ''[]'') from public.%I x', case when t = 'members' then ' - ''photo''' else '' end, t) into j;
      out := out || jsonb_build_object(t, j);
    end if;
  end loop;
  return jsonb_build_object('app', 'qulearn', 'version', 1, 'at', now(), 'tables', out);
end $$;
revoke all on function public.backup_dump() from public, anon, authenticated;

-- النسخة التلقائية (برنامج Google): بالمفتاح السري، مع تسجيل وقتها
create or replace function public.backup_export(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h text := (select token_hash from backup_secret where id = 1);
begin
  if h is null or tok is null or encode(sha256(convert_to(tok, 'UTF8')), 'hex') <> h then
    raise exception 'مفتاح النسخ الاحتياطي غير صحيح' using errcode = '28000';
  end if;
  update backup_secret set last_export_at = now(), export_count = export_count + 1 where id = 1;
  return public.backup_dump();
end $$;
revoke all on function public.backup_export(text) from public;
grant execute on function public.backup_export(text) to anon, authenticated;

-- نسخة فورية للمدير من داخل التطبيق
create or replace function public.backup_export_admin() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'النسخ الاحتياطية للمدير فقط' using errcode = '42501'; end if;
  return public.backup_dump();
end $$;
revoke all on function public.backup_export_admin() from public, anon;
grant execute on function public.backup_export_admin() to authenticated;

-- حالة النسخ التلقائي
create or replace function public.backup_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s record;
begin
  if not public.is_admin() then raise exception 'النسخ الاحتياطية للمدير فقط' using errcode = '42501'; end if;
  select * into s from backup_secret where id = 1;
  return jsonb_build_object('configured', s.id is not null, 'key_created_at', s.created_at, 'last_export_at', s.last_export_at,
                            'export_count', coalesce(s.export_count, 0), 'now', now());
end $$;
revoke all on function public.backup_status() from public, anon;
grant execute on function public.backup_status() to authenticated;

notify pgrst, 'reload schema';
