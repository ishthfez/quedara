-- ============ سرعة قراءة الاشتراكات (fees) ============
-- قواعد القراءة كانت تستدعي is_admin() و has_perm('fees.collect') مع كل صف (آلاف الدفعات)، فكانت صفحة الألف دفعة
-- تستغرق نحو ثانية ونصف على الخادم. بلفّها في (select ...) يحسبها الخادم مرة واحدة لكل طلب، والقواعد نفسها كما هي تمامًا.
-- آمن للتكرار. يُنفَّذ بعد accountant.sql (وبعد fees.sql).

drop policy if exists fees_admin on public.fees;
create policy fees_admin on public.fees for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists fees_mgr_read on public.fees;
create policy fees_mgr_read on public.fees for select to authenticated
  using ((select public.has_perm('fees.collect')));

notify pgrst, 'reload schema';
