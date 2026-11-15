-- =====================================================================
-- فئات الاشتراكات وخصوماتها: تُحفظ في جدول الإعدادات بمفتاح يبدأ بـ priv_
-- هذا الأمر يجعل هذه المفاتيح خاصة (بقية الإعدادات كاسم المؤسسة والشعار
-- تبقى ظاهرة في صفحة الدخول كما هي). يُنفَّذ مرة واحدة، وآمن للتكرار.
-- لا يهم ترتيبه مع accountant.sql: إن كانت الصلاحيات (has_perm) موجودة يبقى
-- للمحاسب ومن له صلاحية التحصيل أو تحديد القيم قراءة priv_fees، وإلا فللمدير وحده.
-- =====================================================================
drop policy if exists settings_read on public.settings;
do $$
begin
  if to_regprocedure('public.has_perm(text)') is not null then
    create policy settings_read on public.settings for select to anon, authenticated
      using (key not like 'priv\_%' or public.is_admin()
             or (key = 'priv_fees' and (public.has_perm('fees.collect') or public.has_perm('fees.amount'))));
  else
    create policy settings_read on public.settings for select to anon, authenticated
      using (key not like 'priv\_%' or public.is_admin());
  end if;
end $$;

notify pgrst, 'reload schema';
