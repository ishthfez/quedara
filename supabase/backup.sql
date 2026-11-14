-- =====================================================================
-- النسخ الاحتياطي التلقائي إلى Google Drive
--   - backup_export(tok): تُرجع نسخة كاملة من كل الجداول (دون صور الطلاب)، ولا تعمل إلا بالمفتاح السري.
--   - الخادم يحفظ بصمة المفتاح فقط (sha256)، لا المفتاح نفسه.
--   - backup_new_token(): تُنشئ مفتاحًا جديدًا وتُبطل القديم؛ تُشغَّل من SQL Editor فقط.
-- بعد تنفيذ هذا الملف شغّل في SQL Editor:   select public.backup_new_token();
-- وانسخ المفتاح الذي يظهر إلى برنامج Google Apps Script (BACKUP_TOKEN).
-- آمن للتكرار.
-- =====================================================================
create table if not exists public.backup_secret (
  id         int primary key default 1 check (id = 1),
  token_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.backup_secret enable row level security;
revoke all on public.backup_secret from public, anon, authenticated;

-- مفتاح جديد (64 حرفًا عشوائيًا) يظهر مرة واحدة، ويُحفظ على الخادم كبصمة فقط
create or replace function public.backup_new_token() returns text
language plpgsql security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into backup_secret (id, token_hash, created_at) values (1, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), now())
  on conflict (id) do update set token_hash = excluded.token_hash, created_at = now();
  return tok;
end $$;
revoke all on function public.backup_new_token() from public, anon, authenticated;

-- النسخة الكاملة: كل جدول موجود مصفوفةً من صفوفه (الجداول غير المنشأة بعد تُتخطّى)
create or replace function public.backup_export(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  h text := (select token_hash from backup_secret where id = 1);
  t text; j jsonb; out jsonb := '{}';
  tabs text[] := array['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields',
                       'pending_columns', 'pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'fees', 'collections', 'exams'];
begin
  if h is null or tok is null or encode(sha256(convert_to(tok, 'UTF8')), 'hex') <> h then
    raise exception 'مفتاح النسخ الاحتياطي غير صحيح' using errcode = '28000';
  end if;
  foreach t in array tabs loop
    if to_regclass('public.' || t) is not null then
      execute format('select coalesce(jsonb_agg(to_jsonb(x)%s), ''[]'') from public.%I x', case when t = 'members' then ' - ''photo''' else '' end, t) into j;
      out := out || jsonb_build_object(t, j);
    end if;
  end loop;
  return jsonb_build_object('app', 'qulearn', 'version', 1, 'at', now(), 'tables', out);
end $$;
revoke all on function public.backup_export(text) from public;
grant execute on function public.backup_export(text) to anon, authenticated;

notify pgrst, 'reload schema';
