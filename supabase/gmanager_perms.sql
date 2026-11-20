-- =====================================================================
--  نقل صلاحيات «المدير العام» إلى نوعه الجديد
--   قبل gmanager_role.sql كان المدير العام «مشرفًا نطاقه الكل»، فكانت صلاحياته في priv_perms.roles.supervisor
--   (ومنها إخفاء عدادات الرئيسية ui.home.hide.*). بعده يحسبها الخادم من roles.gmanager، فتفقدها دون أن يلاحظ أحد.
--   هذا الملف ينسخ صلاحيات المشرفين إلى المديرين العامين، وما ضُبط للمديرين العامين بعد ذلك يبقى ويغلب.
--  يُنفَّذ بعد gmanager_role.sql، مرة واحدة في Supabase ← SQL Editor ← Run.
-- =====================================================================

update public.settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{roles,gmanager}',
  coalesce(value -> 'roles' -> 'supervisor', '{}'::jsonb) || coalesce(value -> 'roles' -> 'gmanager', '{}'::jsonb),
  true)
where key = 'priv_perms'
  and jsonb_typeof(value -> 'roles') = 'object'
  and jsonb_typeof(value -> 'roles' -> 'supervisor') = 'object';

-- للتأكد: صلاحيات الفئتين بعد النسخ
select value -> 'roles' -> 'supervisor' as supervisor, value -> 'roles' -> 'gmanager' as gmanager
from public.settings where key = 'priv_perms';
