-- =====================================================================
--  «العمل بصفة»: المدير يعمل في التطبيق بصفة فئة أخرى (معلم، مشرف، محاسب، إداري، طالب).
--  الخادم يعرفه مديرًا فيقبل كل عمل، وكل ما يُسجَّل يُكتب باسم المدير لا باسم من يعمل بصفته.
--  save_collection_as: قائمة تحصيل حلقة باسم المدير نيابة عن معلمها (أو الإداري)، للمدير وحده.
--  يُنفَّذ بعد roles.sql، مرة واحدة في Supabase ← SQL Editor ← Run. آمن للتكرار.
-- =====================================================================

create or replace function public.save_collection_as(who uuid, hid uuid, yy int, mm int, lns jsonb, send boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me record; adm text; c record; keep jsonb; newl jsonb; cid uuid;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  /* صاحب القائمة: المعلم (أو الإداري) الذي يعمل المدير بصفته؛ والاسم المكتوب عليها اسم المدير حتى لا تختلط الأمور */
  select m.id, m.name, m.role into me from members m join halaqat h on h.id = hid
  where m.id = who
    and (h.teacher_id = m.id or (m.role = 'placeadmin' and h.place_id is not null and h.place_id::text in (select jsonb_array_elements_text(coalesce(m.info -> 'places', '[]')))));
  if me.id is null then raise exception 'هذه ليست حلقة من تعمل بصفته'; end if;
  select 'المدير ' || a.name || ' (بصفة ' || case me.role when 'placeadmin' then 'الإداري' else 'المعلم' end || ' ' || me.name || ')' into adm
    from members a where a.user_id = auth.uid() and a.role = 'admin' limit 1;
  me.name := coalesce(adm, me.name);
  if mm < 1 or mm > 12 then raise exception 'شهر غير صحيح'; end if;
  select * into c from collections where teacher_id = me.id and halaqa_id = hid and y = yy and m = mm for update;
  if c.id is not null and c.status = 'sent' then raise exception 'القائمة عند المحاسب للمراجعة'; end if;
  if c.id is not null and c.status = 'done' then raise exception 'أكّد المحاسب القائمة كاملة'; end if;
  keep := coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(c.lines, '[]')) x where x->>'state' = 'ok'), '[]');
  newl := coalesce((select jsonb_agg(jsonb_build_object('studentId', x->>'studentId', 'amount', greatest(0, coalesce(nullif(x->>'amount', '')::numeric, 0)),
                                                      'note', left(coalesce(x->>'note', ''), 300), 'state', 'pending', 'accNote', ''))
    from jsonb_array_elements(coalesce(lns, '[]')) x
    where exists (select 1 from members s where s.id::text = x->>'studentId' and s.role = 'student' and s.halaqa_id = hid)
      and not exists (select 1 from jsonb_array_elements(keep) k where k->>'studentId' = x->>'studentId')
      and (coalesce(nullif(x->>'amount', '')::numeric, 0) > 0 or coalesce(x->>'note', '') <> '')), '[]');
  if send and jsonb_array_length(newl) = 0 then raise exception 'لا توجد مبالغ جديدة للإرسال'; end if;
  if c.id is null then
    insert into collections (teacher_id, teacher_name, halaqa_id, y, m, status, lines, sent_at)
    values (me.id, me.name, hid, yy, mm, case when send then 'sent' else 'draft' end, keep || newl, case when send then now() end) returning id into cid;
  else
    update collections set lines = keep || newl, teacher_name = me.name, status = case when send then 'sent' else 'draft' end,
      sent_at = case when send then now() else sent_at end where id = c.id;
    cid := c.id;
  end if;
  return cid;
end $$;
revoke all on function public.save_collection_as(uuid, uuid, int, int, jsonb, boolean) from public, anon;
grant execute on function public.save_collection_as(uuid, uuid, int, int, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
