// =====================================================================
//  Edge Function: admin-users (منشورة باسم dynamic-worker)
//  إنشاء حسابات الدخول للأعضاء وتغيير كلمات مرورهم — للإداري فقط،
//  ولمنظم الدورة المكثفة: حسابات طلاب دورته المؤقتين فقط (temp_accounts.sql).
//  يحتاج المفتاح السري، وهو متاح هنا تلقائيًا كمتغير بيئة على خوادم Supabase
//  ولا يصل أبدًا إلى المتصفح. التحقق من JWT من البوابة مقفول، لأن الدالة تتحقق بنفسها.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

/* المتصفحات التي تُقبل طلباتها: موقع التطبيق ونسخه التجريبية على Vercel، والتطوير على الجهاز.
   كان «*» (أي موقع). موقع آخر للتطبيق يُضاف في متغير البيئة ALLOWED_ORIGINS (مفصولة بفواصل) دون تعديل الكود.
   (هذه طبقة إضافية: الحماية الأساسية هي التحقق من حساب الطالب أدناه) */
const EXTRA = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const okOrigin = (o: string) => EXTRA.includes(o)
  || /^https:\/\/(qumang|quedara)[a-z0-9-]*\.vercel\.app$/i.test(o)
  || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);
const corsFor = (req: Request) => {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': okOrigin(o) ? o : 'https://qumang.vercel.app',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};
let cors: Record<string, string> = corsFor(new Request('https://qumang.vercel.app'));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL_DOMAIN = 'qulearn.app';
/* أقل طول لكلمة المرور: 8 (كان 6، ولغير المدير أيضًا: منظم الدورة كان يضع أي كلمة من 6 أحرف) */
const MIN_PASS = 8;

Deno.serve(async (req) => {
  cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST فقط' }, 405);

  // المفاتيح الجديدة (publishable/secret) تأتي كقاموس JSON باسم default، والقديمة كنص مباشر
  const named = (v: string) => { try { return JSON.parse(Deno.env.get(v) ?? '{}').default as string | undefined; } catch { return undefined; } };
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = named('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = named('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'مفاتيح المشروع غير متاحة للدالة' }, 500);

  // التحقق من أن الطالب إداري، بصلاحياته هو لا بصلاحيات الخادم
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: isAdmin, error: e0 } = await caller.rpc('is_admin');
  if (e0) return json({ error: 'غير مصرح: هذه العملية للإداري فقط' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'طلب غير صالح' }, 400); }

  /* غير المدير: منظم الدورة المكثفة يُنشئ ويحذف حسابات الطلاب المؤقتين (الخارجيين) في دورته فقط.
     الحكم من الخادم بصلاحيات الطالب نفسه (prog_temp_ok في temp_accounts.sql)، ولا مشاركة حسابات هنا */
  if (!isAdmin) {
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    const ids: string[] = body?.action === 'provision' ? items.map((x) => String(x?.member_id ?? ''))
      : body?.action === 'remove' ? [String(body?.member_id ?? '')] : [];
    if (!ids.length || ids.length > 50 || ids.some((x) => !x)) return json({ error: 'غير مصرح: هذه العملية للإداري فقط' }, 403);
    if (body.action === 'provision' && items.some((x) => x?.share_with)) return json({ error: 'غير مصرح' }, 403);
    for (const id of ids) {
      const { data: ok, error: eT } = await caller.rpc('prog_temp_ok', { mid: id });
      if (eT || !ok) return json({ error: 'غير مصرح: هذه العملية للإداري فقط' }, 403);
    }
  }

  // provision: إنشاء حساب دخول لكل عضو (أو تحديث كلمة مروره إن كان له حساب)
  // body.items = [{ member_id, password, share_with? }]
  if (body.action === 'provision') {
    const items: { member_id: string; password: string; share_with?: string }[] = Array.isArray(body.items) ? body.items : [];
    if (items.length > 200) return json({ error: 'الحد الأقصى 200 عضو في الطلب الواحد' }, 400);
    const results: unknown[] = [];
    for (const it of items) {
      try {
        if (!it.password || String(it.password).length < MIN_PASS) throw new Error(`كلمة المرور ${MIN_PASS} أحرف أو أرقام على الأقل`);
        const { data: m, error } = await admin.from('members').select('id, name, role, user_id, login_email').eq('id', it.member_id).single();
        if (error || !m) throw new Error('العضو غير موجود');
        let userId = m.user_id as string | null, email = m.login_email as string | null;
        /* الحساب المشترك (شخص واحد بأكثر من صفة: معلم ومشرف مثلًا) يُتحقَّق منه هنا لا في المتصفح وحده:
           لا مشاركة مع حساب مدير أو مدير عام، ولا لطالب أو معه، ويجب أن يتطابق الاسم. كان يكفي تطابق الاسم في المتصفح،
           فطالب يُضاف باسم المدير نفسه يأخذ حسابه وتُغيَّر كلمة مرور المدير إلى كلمة الطالب */
        if (!userId && it.share_with) {
          const { data: o } = await admin.from('members').select('name, role, user_id, login_email').eq('id', it.share_with).single();
          const norm = (s: unknown) => String(s ?? '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
          const okShare = o?.user_id && m.role !== 'student' && o.role !== 'student' && o.role !== 'admin' && o.role !== 'gmanager'
            && m.role !== 'admin' && m.role !== 'gmanager' && norm(o.name) === norm(m.name);
          if (okShare) { userId = o!.user_id; email = o!.login_email; }
          // وإلا: حساب دخول مستقل جديد لهذا العضو (لا خطأ)
        }
        if (userId) {
          const { error: e1 } = await admin.auth.admin.updateUserById(userId, { password: String(it.password) });
          if (e1) throw e1;
        } else {
          email = `m-${m.id.replace(/-/g, '').slice(0, 16)}@${EMAIL_DOMAIN}`;
          const { data: u, error: e2 } = await admin.auth.admin.createUser({
            email, password: String(it.password), email_confirm: true, user_metadata: { name: m.name },
          });
          if (e2 || !u.user) throw e2 ?? new Error('تعذّر إنشاء الحساب');
          userId = u.user.id;
        }
        const { error: e3 } = await admin.from('members').update({ user_id: userId, login_email: email }).eq('id', m.id);
        if (e3) throw e3;
        results.push({ member_id: m.id, ok: true });
      } catch (err) {
        results.push({ member_id: it.member_id, ok: false, error: String((err as Error)?.message ?? err) });
      }
    }
    return json({ results });
  }

  // remove: حذف حساب الدخول لعضو (لا يُحذف إن كان مشتركًا مع عضو آخر بنفس الاسم)
  if (body.action === 'remove') {
    const { data: m } = await admin.from('members').select('id, role, user_id').eq('id', body.member_id).single();
    if (!m?.user_id) return json({ ok: true });
    /* لا يحذف المدير حساب دخوله هو، ولا حساب آخر مدير (فلا يبقى التطبيق بلا مدير) */
    const { data: me } = await caller.auth.getUser();
    if (me?.user?.id && me.user.id === m.user_id) return json({ error: 'لا يمكنك حذف حساب دخولك أنت' }, 400);
    if (m.role === 'admin') {
      const { count: admins } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('role', 'admin').not('user_id', 'is', null);
      if ((admins ?? 0) <= 1) return json({ error: 'هذا آخر حساب مدير له دخول' }, 400);
    }
    const { count } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id);
    const { error: e4 } = await admin.from('members').update({ user_id: null, login_email: null }).eq('id', m.id);
    if (e4) return json({ error: String(e4.message ?? e4) }, 500);
    if ((count ?? 0) <= 1) { const { error: e5 } = await admin.auth.admin.deleteUser(m.user_id); if (e5) return json({ error: String(e5.message ?? e5) }, 500); }
    return json({ ok: true });
  }

  return json({ error: 'إجراء غير معروف' }, 400);
});
