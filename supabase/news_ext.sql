-- =====================================================================
--  أهمية الإعلان ومدته
--   prio: '' عادي، 'imp' مهم، 'urgent' عاجل (لونه في التطبيق بحسبها).
--   until: آخر يوم يظهر فيه الإعلان (فارغ = بلا مدة). بعده يختفي من «الرئيسية» و«الإعلانات» عند الجميع،
--   ويبقى عند المدير في «الإعلانات» بعلامة «انتهى».
--  يُنفَّذ مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار، ولا يغيّر الإعلانات الموجودة (تبقى «عادي» بلا مدة).
-- =====================================================================
alter table public.news add column if not exists prio text not null default '';
alter table public.news add column if not exists until date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'news_prio_chk') then
    alter table public.news add constraint news_prio_chk check (prio in ('', 'imp', 'urgent'));
  end if;
end $$;

notify pgrst, 'reload schema';
