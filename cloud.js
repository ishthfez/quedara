/* ============ المزامنة مع قاعدة البيانات (Supabase) ============
   - التطبيق يعمل على نسخة محلية من البيانات (db) كما كان، فيعمل بدون إنترنت.
   - كل حفظ يقارن البيانات بآخر نسخة مؤكدة من الخادم ويرسل الفروق فقط.
   - التغييرات التي تحدث بدون إنترنت تبقى محفوظة وتُرسل عند عودة الاتصال.
   - الصلاحيات الحقيقية مطبّقة على الخادم (RLS)، لا في المتصفح. */
(() => {
'use strict';
const DEF = {
  url: 'https://vjmlrajxcfxiooprzfjw.supabase.co',
  key: 'sb_publishable_IM-942KoPf_iH_FvPBnBag_hxJQCKrJ',
  fn: 'dynamic-worker'
};
let CFG = DEF;
/* تغيير عنوان الخادم من التخزين المحلي للتطوير على الجهاز وحده: على الموقع المنشور كان أي كود محقون يستطيع
   تحويل كل عمليات الدخول القادمة (ومعها كلمات المرور) إلى خادم آخر بسطر واحد في localStorage */
const DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/i.test(location.hostname);
try { const o = DEV_HOST ? JSON.parse(localStorage.getItem('qcloud_cfg') || 'null') : null; if (o && o.url && o.key) CFG = { ...DEF, ...o }; } catch (e) { /* ignore */ }
if (/[?&]local=1/.test(location.search)) CFG = { ...CFG, url: '' };

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
const AKEY = 'qcloud_auth';
let auth = LS.get(AKEY);              // { access_token, refresh_token, expires_at, uid, email, member:{role,id} }
let snap = null, pushing = false, again = false, timer = null, lastError = '', lastSync = null;
const listeners = new Set();
const emit = () => listeners.forEach(f => { try { f(); } catch (e) { /* ignore */ } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = v => typeof v === 'string' && UUID_RE.test(v);
const uuid = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/* ---------------- الطلبات ---------------- */
class HttpError extends Error { constructor(status, msg, body) { super(msg); this.status = status; this.body = body; } }
/* تبويب آخر (أو التطبيق المثبّت) جدّد الجلسة وحفظها: نأخذ الأحدث بدل تجديد الرمز القديم،
   فتجديد رمز سبق استعماله يجعل الخادم يُلغي الجلسة كلها (خروج كامل) */
function syncAuth() {
  const s = LS.get(AKEY);
  if (s && auth && s.uid === auth.uid && s.refresh_token && s.refresh_token !== auth.refresh_token && (s.expires_at || 0) >= (auth.expires_at || 0))
    auth = { ...auth, ...s, member: auth.member || s.member };
}
async function token() {
  if (!auth) return null;
  syncAuth();
  if (auth.expires_at && Date.now() / 1000 > auth.expires_at - 60) await refresh();
  return auth?.access_token || null;
}
/* تجديد واحد في الوقت نفسه: الطلبات المتزامنة تنتظره ولا تجدّد الرمز نفسه مرتين */
let refreshing = null;
function refresh() { return refreshing || (refreshing = doRefresh().finally(() => { refreshing = null; })); }
async function doRefresh() {
  const old = auth?.access_token;
  syncAuth();
  if (auth?.access_token !== old) return;   // جُدِّدت في تبويب آخر: نستعمل رمزه
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.refresh_token })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 400 || r.status === 401) { auth = null; LS.del(AKEY); emit(); } throw new HttpError(r.status, j.error_description || j.msg || 'انتهت الجلسة'); }
  storeAuth(j);
}
function storeAuth(j) {
  auth = { ...(auth || {}), access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), uid: j.user?.id || auth?.uid, email: j.user?.email || auth?.email };
  LS.set(AKEY, auth);
}
async function req(path, { method = 'GET', body, headers = {}, anon = false, retry = true, withCount = false } = {}) {
  const h = { apikey: CFG.key, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (!anon) { const t = await token(); if (t) h.Authorization = 'Bearer ' + t; }
  const r = await fetch(CFG.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401 && !anon && retry && auth) { await refresh(); return req(path, { method, body, headers, anon, retry: false, withCount }); }
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
  if (!r.ok) throw new HttpError(r.status, (j && (j.message || j.error_description || j.error || j.msg)) || `HTTP ${r.status}`, j);
  if (withCount) { const t = +String(r.headers.get('content-range') || '').split('/')[1]; return { j, total: Number.isFinite(t) ? t : null }; }
  return j;
}
const rpc = (fn, args = {}, anon = false) => req(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args, anon });
/* الجداول الكبيرة (مثل الاشتراكات: آلاف الدفعات) تُجلب صفحاتها معًا (4 طلبات في الوقت نفسه) بعد معرفة عددها من الصفحة الأولى،
   بدل صفحة بعد صفحة: 10 صفحات كانت تستغرق نحو 12 ثانية */
async function selectAll(table, order = 'id', extra = '', cols = '*') {
  const q = off => `/rest/v1/${table}?select=${cols}&order=${order}&limit=1000&offset=${off}${extra}`;
  const first = await req(q(0), { headers: { Prefer: 'count=exact' }, withCount: true });
  const out = [...(first.j || [])];
  if (out.length < 1000) return out;
  let off = 1000;
  if (first.total > 1000) {
    const offs = []; for (let o = 1000; o < first.total; o += 1000) offs.push(o);
    const pages = new Array(offs.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(4, offs.length) }, async () => { while (i < offs.length) { const k = i++; pages[k] = (await req(q(offs[k]))) || []; } }));
    pages.forEach(p => out.push(...p));
    off = 1000 + offs.length * 1000;
    if (pages[pages.length - 1].length < 1000) return out;   // اكتمل الجدول
  }
  /* بلا عدد (أو أُضيفت صفوف أثناء الجلب): ما بقي صفحةً بعد صفحة كما كان */
  for (; ; off += 1000) { const page = await req(q(off)); out.push(...(page || [])); if (!page || page.length < 1000) break; }
  return out;
}

/* ---------------- الدخول ---------------- */
async function signIn(email, password) {
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, /invalid/i.test(j.error_description || j.msg || '') ? 'كلمة المرور غير صحيحة' : (j.error_description || j.msg || 'تعذّر الدخول'));
  auth = null; storeAuth(j); resetSync();
  snap = LS.get(snapKey());
  emit();
  return auth;
}
/* فتح شاشة القفل: دخول بكلمة المرور يجدّد الجلسة نفسها دون مسح حالة المزامنة (المستخدم نفسه) */
async function reauth(email, password) {
  const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, /invalid/i.test(j.error_description || j.msg || '') ? 'كلمة المرور غير صحيحة' : (j.error_description || j.msg || 'تعذّر الدخول'));
  const same = auth && j.user?.id && auth.uid === j.user.id;
  if (!same) { auth = null; resetSync(); }
  storeAuth(j);
  if (!same) snap = LS.get(snapKey());
  emit();
  return auth;
}
/* wipe: الخروج بزر «خروج» يمسح نسخة هذا الحساب من الجهاز (البيانات كاملة كانت تبقى في المتصفح بعد الخروج،
   فيقرؤها أي أحد على جهاز مشترك: الرواتب والأرقام القومية والهواتف). انتهاء الجلسة وحده لا يمسح شيئًا */
async function signOut(opts = {}) {
  const uid = auth?.uid;
  try { if (auth) await req('/auth/v1/logout', { method: 'POST', retry: false }); } catch (e) { /* ignore */ }
  auth = null; snap = null; LS.del(AKEY); resetSync();
  if (opts.wipe && uid) {
    ['qcloud_db_', 'qcloud_snap_', 'qcloud_raw_'].forEach(p => { const k = p + uid; pendingW.delete(k); LS.del(k); IDB.del(k).catch(() => null); });
    LS.del('qcloud_legacy_pins');
  }
  emit();
}
/* «المدير العام»: على الخادم نوع حساب مستقل (role = 'gmanager'، supabase/gmanager_role.sql)، وفي واجهة التطبيق
   «مشرف نطاقه الكل» كما كان (info.scope = 'all') فتبقى كل صفحات المشرف وفحوصه كما هي. الترجمة بينهما هنا وحدها:
   الواجهة ترى 'supervisor'، والمزامنة تعمل بنوعه الحقيقي (srvRole) فتجلب ما يخصه وترسل ما يحق له. */
const GM_IDS = new Set();
let gmReady = null;   // هل يعرف الخادم النوع 'gmanager'؟ (بعد gmanager_role.sql) — يُفحص مرة في كل تشغيل قبل أي إرسال
const lookup = q => rpc('login_lookup', { q }, true).then(rows => (rows || []).map(r => (r.role === 'gmanager' ? (GM_IDS.add(r.member_id), { ...r, role: 'supervisor' }) : r)));
const setMember = m => {
  if (!auth) return;
  if (m && m.role === 'supervisor' && GM_IDS.has(m.id)) m = { ...m, srvRole: 'gmanager' };
  if (auth.member?.id !== m?.id) raw = null;
  auth.member = m; LS.set(AKEY, auth);
};
/* نوع الحساب كما هو على الخادم (للمزامنة)، ونوعه في الواجهة */
const srvRole = () => auth?.member?.srvRole || auth?.member?.role;
/* بدء مزامنة جديدة من الصفر (حساب آخر أو خروج): لا تُخلط بيانات جلستين */
/* ويُعاد فحص المزامنة بالتغييرات (inc): فشلٌ عابر عند فتح التطبيق (جلسة منتهية مثلًا) لا يبقى جلبًا كاملًا طوال الجلسة التالية */
function resetSync() { raw = null; since = null; lastFull = 0; inc = null; scoped = false; photoCache.clear(); photoSent.clear(); }

/* ---------------- الوظيفة السحابية لإدارة الحسابات ---------------- */
async function fn(body) {
  const t = await token();
  const r = await fetch(`${CFG.url}/functions/v1/${CFG.fn}`, {
    method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, j.error || j.message || `HTTP ${r.status}`, j);
  return j;
}
async function provision(items, onProgress) {
  const res = [];
  for (let i = 0; i < items.length; i += 40) {
    const part = await fn({ action: 'provision', items: items.slice(i, i + 40) });
    res.push(...(part.results || []));
    onProgress?.(Math.min(i + 40, items.length), items.length);
  }
  return res;
}

/* ---------------- التحويل بين بيانات التطبيق وجداول الخادم ---------------- */
const nz = v => (v === '' || v === undefined ? null : v);
const num = v => (v === '' || v === undefined || v === null || isNaN(+v) ? null : +v);
const ROLE_COLL = { admin: 'admins', supervisor: 'supervisors', gmanager: 'supervisors', teacher: 'teachers', student: 'students', accountant: 'accountants', placeadmin: 'placeadmins' };
/* المدير العام في مجموعة المشرفين بالتطبيق: يُرسل بنوعه 'gmanager' متى عرفه الخادم، وإلا 'supervisor' كما كان */
/* قبل أن يُعرف جواب الخادم (أول لحظات بعد فتح التطبيق) لا يُرجَع المدير العام مشرفًا: يبقى بنوعه كما في آخر نسخة مؤكدة من الخادم */
const snapRole = id => { try { return JSON.parse(snap?.staff?.[id] || 'null')?.role || null; } catch (e) { return null; } };
const staffRole = (m, r) => {
  if (r !== 'supervisor' || m?.info?.scope !== 'all') return r;
  if (gmReady === true) return 'gmanager';
  if (gmReady === false) return r;
  return snapRole(m.id) === 'gmanager' || GM_IDS.has(m.id) ? 'gmanager' : r;
};
/* يُسأل الخادم مرة قبل أي إرسال أو سحب */
const probeGM = async () => { if (gmReady === null) { try { await rpc('gmanager_ready'); gmReady = true; } catch (e) { if (e instanceof HttpError) gmReady = false; } } };

function memberRow(m, role) {
  return {
    id: m.id, role, name: m.name || '', phone: m.phone || '',
    halaqa_id: role === 'student' ? nz(m.halaqaId) : null,
    cat: role === 'student' ? (m.cat === 'adult' ? 'adult' : 'child') : null,
    info: role === 'teacher' ? { personal: m.personal || {}, tech: m.tech || {} } : (m.info || {}),
    extra: m.extra || {}
  };
}
/* كل مجموعة: [اسم المجموعة، الجدول، المفتاح، الصفوف] بترتيب يحترم العلاقات بين الجداول */
function groups(db) {
  const P = db.payroll || {};
  const g = [];
  const add = (name, table, pk, rows, conflict) => g.push({ name, table, pk, rows, conflict });
  /* priv_*: إعدادات خاصة بالمدير (مثل فئات الاشتراكات وخصوماتها) لا يقرؤها غيره على الخادم */
  add('settings', 'settings', ['key'], ['org', 'theme', 'logo', 'block_msgs', 'col_labels', 'session_policy', 'priv_fees', 'priv_perms', 'priv_dups', 'icons', 'tests_cfg'].filter(k => db.settings?.[k] !== undefined).map(k => ({ key: k, value: db.settings[k] ?? null })));
  add('places', 'places', ['id'], (db.places || []).map(p => ({ id: p.id, name: p.name, type: p.type || 'مسجد', address: p.address || '' })));
  add('staff', 'members', ['id'], ['admin', 'supervisor', 'teacher', 'accountant', 'placeadmin'].flatMap(r => (db[ROLE_COLL[r]] || []).map(m => memberRow(m, staffRole(m, r)))));
  add('halaqat', 'halaqat', ['id'], (db.halaqat || []).map(h => ({ id: h.id, name: h.name || '', teacher_id: nz(h.teacherId), supervisor_id: nz(h.supervisorId), place_id: nz(h.placeId), time: h.time || null })));
  add('students', 'members', ['id'], (db.students || []).map(m => memberRow(m, 'student')));
  add('member_admin', 'member_admin', ['member_id'], (db.teachers || []).filter(t => t.admin && Object.keys(t.admin).length).map(t => ({ member_id: t.id, data: t.admin })));
  add('attendance', 'attendance', ['id'], (db.attendance || []).map(a => ({ id: a.id, student_id: a.studentId, date: a.date, status: a.status })), 'student_id,date');
  add('records', 'records', ['id'], (db.records || []).map(r => ({ id: r.id, student_id: r.studentId, date: r.date, type: r.type, surah: +r.surah, from_ayah: +r.from, to_ayah: +r.to, grade: r.grade || null, note: r.note || '', ...(r.plan != null ? { plan: !!r.plan } : {}) })));   // plan: منهج الكرّاسة قبل تسميعه (يُرسل فقط إن عُرف، فلا تُعاد كل التسجيلات القديمة)
  /* أهمية الإعلان ومدته تُرسل متى وُجد عموداها على الخادم (supabase/news_ext.sql)، وقبل ذلك يُرسل الإعلان كما كان */
  add('news', 'news', ['id'], (db.news || []).map(n => ({ id: n.id, text: n.text, audience: n.audience || 'all', date: n.date, ...(newsExt ? { prio: n.prio || '', until: n.until || null } : {}) })));
  /* اشتراكات الطلاب (للمدير)؛ لا تُرسل إن لم يُنشأ جدولها على الخادم بعد */
  if (Array.isArray(db.fees) && feesOk !== false) add('fees', 'fees', ['id'], db.fees.map(f => ({ id: f.id, student_id: f.studentId, y: +f.y, m: +f.m, amount: num(f.amount) ?? 0, date: f.date || null, by_name: nz(f.by), note: f.note || '' })));
  add('custom_fields', 'custom_fields', ['kind', 'key'], ['students', 'teachers'].flatMap(k => (db.fields?.[k] || []).map(f => ({ kind: k, key: f.key, label: f.label, type: f.type || 'text' }))));
  add('pending', 'pending_columns', ['id'], (db.pending || []).map(p => ({ id: p.id, kind: p.kind, header: p.header, values: p.values || [], date: p.date })));
  if (db.payroll) {
    add('pay_settings', 'pay_settings', ['id'], [{ id: 1, data: P.settings || {} }]);
    add('pay_employees', 'pay_employees', ['id'], (P.employees || []).map(e => ({ id: e.id, code: nz(e.code), name: e.name, role: nz(e.role), sys: nz(e.sys), status: e.status === 'متوقف' ? 'متوقف' : 'نشط', basic: num(e.basic), rate: num(e.rate), incentive: num(e.incentive), transport: num(e.transport), hours: num(e.hours), place: nz(e.place), note: nz(e.note) })));
    /* صف المرتب يُعرَّف بالموظف والشهر: لو أنشأ جهازان الشهر نفسه يُحدَّث الصف الموجود بدل رفضه */
    add('pay_rows', 'pay_rows', ['id'], lastByKey(P.rows || [], r => r.y + '|' + r.m + '|' + r.eid).map(r => ({ id: r.id, y: +r.y, m: +r.m, emp_id: r.eid, name: nz(r.name), role: nz(r.role), base: num(r.base), extra: num(r.extra), exc: num(r.exc), abs_p: num(r.absP), abs_n: num(r.absN), mtg_p: num(r.mtgP), mtg_n: num(r.mtgN), d_test: num(r.dTest), d_rec: num(r.dRec), d_books: num(r.dBooks), basic: num(r.basic), rate: num(r.rate), incentive: num(r.incentive), transport: num(r.transport), note: r.note || '' })), 'y,m,emp_id');
    add('pay_closed', 'pay_closed', ['y', 'm'], (P.closed || []).map(k => { const [y, m] = String(k).split('-').map(Number); return { y, m }; }).filter(x => x.y && x.m));
    add('absences', 'absences', ['id'], lastByKey(P.absences || [], a => (a.date ? a.eid + '|' + a.date : a.id)).map(a => ({ id: a.id, y: +a.y, m: +a.m, date: a.date || null, emp_id: a.eid, name: nz(a.name), place: nz(a.place), perm: a.perm || '', reason: nz(a.reason), proof: a.proof || '', note: nz(a.note), by_member: isUuid(a.byMember) ? a.byMember : null, by_name: nz(a.by) })), 'emp_id,date');
  }
  return g;
}
const rowKey = (pk, r) => pk.map(k => r[k]).join('|');
/* آخر نسخة لكل مفتاح طبيعي (يمنع إرسال صفين لنفس الموظف والشهر في دفعة واحدة) */
function lastByKey(list, key) { const m = new Map(); list.forEach(x => m.set(key(x), x)); return [...m.values()]; }
function snapshotOf(db) {
  const s = {};
  for (const gr of groups(db)) { const m = {}; gr.rows.forEach(r => { m[rowKey(gr.pk, r)] = JSON.stringify(r); }); s[gr.name] = m; }
  return s;
}

/* المعرّفات القديمة (غير UUID) تُستبدل بمعرّفات جديدة مع تحديث كل الإشارات إليها */
/* معرّف ثابت للمعرّفات القديمة: نفس المعرّف القديم يعطي دائمًا نفس الرمز، فاستيراد الملف نفسه مرة ثانية يحدّث السجلات بدل تكرارها */
function stableUuid(s) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  const str = 'qulearn:' + s;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  const x = [h1, h2, h3, h4].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-5${x.slice(13, 16)}-${(8 | (parseInt(x[16], 16) & 3)).toString(16)}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}
function ensureUuids(db) {
  const map = new Map(), fix = o => { if (o && !isUuid(o.id)) { const n = o.id ? stableUuid(o.id) : uuid(); map.set(o.id, n); o.id = n; } };
  ['admins', 'supervisors', 'teachers', 'accountants', 'placeadmins', 'students', 'places', 'halaqat', 'attendance', 'records', 'news', 'pending', 'fees'].forEach(k => (db[k] || []).forEach(fix));
  const P = db.payroll;
  if (P) ['employees', 'rows', 'absences'].forEach(k => (P[k] || []).forEach(fix));
  if (!map.size) return false;
  const re = v => (map.has(v) ? map.get(v) : v);
  (db.halaqat || []).forEach(h => { h.teacherId = re(h.teacherId); h.supervisorId = re(h.supervisorId); h.placeId = re(h.placeId); });
  (db.students || []).forEach(s => { s.halaqaId = re(s.halaqaId); });
  (db.attendance || []).forEach(a => { a.studentId = re(a.studentId); });
  (db.records || []).forEach(r => { r.studentId = re(r.studentId); });
  (db.fees || []).forEach(f => { f.studentId = re(f.studentId); });
  (db.pending || []).forEach(p => (p.values || []).forEach(v => { v.mid = re(v.mid); }));
  if (P) { (P.rows || []).forEach(r => { r.eid = re(r.eid); }); (P.absences || []).forEach(a => { a.eid = re(a.eid); a.byMember = re(a.byMember); }); }
  return map;
}

/* ---------------- السحب من الخادم ---------------- */
function emptyDb() {
  return { settings: { org: 'إدارة الحلقات القرآنية' }, admins: [], supervisors: [], teachers: [], accountants: [], placeadmins: [], students: [], places: [], halaqat: [], attendance: [], records: [], news: [], fields: { students: [], teachers: [] }, pending: [] };
}
/* ---------------- المزامنة بالتغييرات فقط ----------------
   أول جلب في الجلسة (وكل 30 دقيقة) كامل، وما بينهما يُجلب فقط ما تغيّر منذ آخر مرة (عمود sync_ts)
   مع سجل المحذوفات (sync_deleted). الصور لا تُنزَّل مع المزامنة، بل عند الحاجة فقط.
   إن لم يُنفَّذ ملف sync_incremental.sql على الخادم بعد، يعمل التطبيق بالجلب الكامل كما كان. */
const SYNC_TABLES = {
  settings: ['key'], places: ['id'], members: ['id'], member_admin: ['member_id'], halaqat: ['id'], attendance: ['id'],
  records: ['id'], news: ['id'], custom_fields: ['kind', 'key'], pay_settings: ['id'], pay_employees: ['id'],
  pay_rows: ['id'], pay_closed: ['y', 'm'], absences: ['id'], pending_columns: ['id'], fees: ['id'], collections: ['id']
};
let feesOk = null; // هل جدول الاشتراكات موجود على الخادم؟
let newsExt = null; // هل للإعلانات عمودا الأهمية والمدة على الخادم (news_ext.sql)؟ يُفحص مرة في كل تشغيل
const probeNews = () => req('/rest/v1/news?select=prio&limit=1').then(() => { newsExt = true; }, e => { if (e instanceof HttpError) newsExt = false; });   // انقطاع الاتصال لا يُحسب رفضًا
const MEMBER_COLS = 'id,user_id,login_email,role,name,phone,halaqa_id,cat,info,extra,has_photo';
const FULL_EVERY = 30 * 60000;
let raw = null, since = null, lastFull = 0, inc = null, scoped = false, lastChanged = true, leaveTried = false;
const photoCache = new Map();   // معرّف العضو ← الصورة ('' = بلا صورة)
const photoSent = new Map();    // معرّف العضو ← بصمة الصورة كما هي على الخادم (للصور المعروفة فقط)
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
const pkOf = (t, r) => SYNC_TABLES[t].map(k => r[k]).join('|');
function tablesFor(role) {
  /* المحاسب: الطلاب والحلقات والأماكن والاشتراكات والإعلانات فقط */
  if (role === 'accountant') return ['settings', 'places', 'members', 'halaqat', 'news', 'fees', 'collections'];
  /* الإداري: حلقات أماكنه وطلابها (للاطلاع) وقوائم التحصيل التي يرسلها */
  if (role === 'placeadmin') return ['settings', 'places', 'members', 'halaqat', 'attendance', 'records', 'news', 'custom_fields', 'collections'];
  const t = ['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields'];
  if (role === 'admin') t.push('pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'pending_columns', 'fees', 'collections');
  /* المدير العام: يطّلع على كل شيء (والخادم يمنحه القراءة فقط إلا الغياب والإشعارات وحلقاته) */
  else if (role === 'gmanager') t.push('pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'fees', 'collections');
  else if (role === 'supervisor') t.push('absences');
  else if (role === 'teacher') t.push('collections');
  return t;
}
function notePhoto(r, incremental) {
  if (!inc) { photoCache.set(r.id, r.photo || ''); photoSent.set(r.id, hashStr(r.photo || '')); return; }
  if (!r.has_photo) { photoCache.set(r.id, ''); photoSent.set(r.id, hashStr('')); }
  else if (incremental || photoCache.get(r.id) === '') { photoCache.delete(r.id); photoSent.delete(r.id); }
}
/* غير المدير لا يُنزّل إلا نطاقه: حلقاته وطلابها وأسماء العاملين معه (والمشرف كل الأماكن لنموذج الغياب) */
/* نطاق الجدول: [العمود، المعرّفات] أو null (بلا تقييد) */
function scopeOf(t, chk) {
  if (!chk?.hal) return null;
  if (t === 'members') return ['id', [...new Set([...(chk.ids || []), ...(chk.stu || [])])]];
  if (t === 'halaqat') return ['id', chk.hal];
  if (t === 'places' && !chk.sup) return ['id', chk.pl];
  if (t === 'member_admin') return ['member_id', chk.me];
  return null;
}
/* المعرّفات تُرسل في الرابط: مشرف له مئات الطلاب كان رابطه يتجاوز حد الخادم فتفشل مزامنته كلها.
   تُقسَّم إلى دفعات (150 معرّفًا ≈ 5.6 كيلوبايت في الرابط) وتُجمع نتائجها */
const SCOPE_CHUNK = 150;
function selectScoped(t, order, filter, cols, sc) {
  if (!sc) return selectAll(t, order, filter, cols);
  const [col, ids] = sc, list = [...new Set(ids || [])];
  if (!list.length) return selectAll(t, order, filter + `&${col}=in.()`, cols);
  const parts = []; for (let i = 0; i < list.length; i += SCOPE_CHUNK) parts.push(list.slice(i, i + SCOPE_CHUNK));
  return Promise.all(parts.map(p => selectAll(t, order, filter + `&${col}=in.(${p.join(',')})`, cols))).then(r => r.flat());
}
const sameSet = (a, b) => { a = a || []; b = b || []; if (a.length !== b.length) return false; const s = new Set(a); return b.every(x => s.has(x)); };
async function fetchTables(tables, filter = '', chk = null) {
  const got = await Promise.all(tables.map(t => {
    const p = selectScoped(t, SYNC_TABLES[t].join(','), filter, t === 'members' && inc ? MEMBER_COLS : '*', scopeOf(t, chk));
    /* جدول الاشتراكات قد لا يكون أُنشئ بعد: لا يعطّل ذلك بقية المزامنة */
    if (t === 'fees') return p.then(r => { feesOk = true; return r; }, () => { feesOk = false; return []; });
    if (t === 'news') { if (newsExt === null) probeNews(); return p.then(r => { if (r.length) newsExt = 'prio' in r[0]; return r; }); }
    /* قوائم تحصيل المعلمين: قبل تنفيذ collections.sql لا يوجد الجدول، فتبقى فارغة دون تعطيل المزامنة */
    return t === 'collections' ? p.catch(() => []) : p;
  }));
  return Object.fromEntries(tables.map((t, i) => [t, got[i]]));
}
const backMinute = ts => new Date(new Date(ts).getTime() - 60000).toISOString();
/* السحب والإرسال لا يتداخلان: سحبٌ جلب صفوف الخادم قبل وصول إرسالٍ جارٍ كان يعيد البيانات القديمة إلى الجهاز،
   ثم يرسلها الحفظ التالي فوق الجديدة على الخادم (هكذا ضاعت إعدادات الاشتراك). السحب ينتظر الإرسال الجاري،
   والإرسال الذي يبدأ أثناء السحب يُؤجَّل حتى ينتهي، ثم يُرسل بيانات الجهاز الحالية لا نسخة قديمة منها. */
let pulling = false;
const curDb = d => { try { return typeof db !== 'undefined' && db ? db : d; } catch (e) { return d; } };
/* الحفاظ على ما لم يُرسل بعد: من يستدعي السحب يضع نتيجته مكان بيانات الجهاز، فتُعاد بيانات الجهاز نفسها بدل نسخة الخادم
   - إن بقيت تغييرات لم تُرسل (انقطاع أو خطأ مؤقت في الخادم) لا يُسحب شيء؛ وبعد رفض صريح من الخادم يُسحب كالعادة.
   - وإن سُجّل تعديل أثناء السحب تبقى بيانات الجهاز وآخر نسخة مؤكدة (snap) كما كانت، فيُرسل التعديل ويأتي الجديد في السحب التالي. */
let editSeq = 0, localNewer = false, rejected = false, pushFails = 0;
async function pull() {
  for (let i = 0; pushing && i < 600; i++) await new Promise(r => setTimeout(r, 50));
  localNewer = false;
  const cur0 = curDb(null);
  if (cur0 && auth && snap && !rejected && diff(cur0).length) { localNewer = true; later(cur0, 5000); return cur0; }
  pulling = true;
  const seq = editSeq, prevSnap = snap;
  try {
    const d = await pullInner();
    rejected = false;
    const cur = curDb(null);
    if (editSeq !== seq && prevSnap && cur) {
      localNewer = true; snap = prevSnap; saveLocal(cur); later(cur, 300);
      /* نسخة صفوف الخادم (raw) ووقتها (since) صارت أحدث من snap المُعاد: لو بقيتا لبُنيت البيانات منهما في سحب «لا تغيير»
         التالي فظهرت تغييرات الآخرين فروقًا محلية وأُرسلت باسم هذا المستخدم. تُنسى فيكون السحب التالي كاملًا */
      raw = null; since = null; persist(rawKey(), null);
      return cur;
    }
    return d;
  } finally { pulling = false; }
}
async function pullInner() {
  /* هل يعرف الخادم نوع «المدير العام»؟ يُفحص مرة قبل أول إرسال (حتى لا يُرجَع المدير العام مشرفًا على الخادم ولا يُرسل نوع لا يقبله) */
  await probeGM();
  const role = srvRole(), tables = tablesFor(role);
  if (inc === null) {
    /* لا يُحكم بغياب الدالة على الخادم إلا برفض صريح منه؛ انقطاع الاتصال أو انتهاء الجلسة يُعاد فحصه في المزامنة التالية */
    const gone = e => e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 401;
    try { await rpc('sync_check', { since: new Date().toISOString() }); inc = true; scoped = true; }
    catch (e) {
      if (!gone(e)) throw e;
      scoped = false;
      try { await rpc('sync_now'); inc = true; } catch (e2) { if (!gone(e2)) throw e2; inc = false; }
    }
  }
  /* عند فتح التطبيق: تُستعاد آخر مزامنة محفوظة على هذا الجهاز، فيُجلب ما تغيّر منذها فقط بدل كل البيانات */
  if (!raw && inc && scoped) await restoreRaw(role, tables);
  /* سؤال واحد صغير للخادم: هل تغيّر شيء يخص هذا المستخدم؟ إن لم يتغير شيء لا تحدث مزامنة أصلًا */
  const chk = scoped ? await rpc('sync_check', { since: since || new Date().toISOString() }) : null;
  let mode = 'full';
  if (inc && raw && raw.role === role && since) {
    if (!scoped) mode = Date.now() - lastFull < FULL_EVERY ? 'inc' : 'full';
    else if (chk.hal && (!sameSet(chk.hal, raw.hal) || !sameSet(chk.stu, raw.stu))) mode = 'full'; // تغيّر نطاقه: حلقة جديدة أو طالب انتقل
    else if (!chk.tables.length) mode = 'none';
    /* من لا يعيد له الخادم نطاقه (hal/stu، مثل الإداري) لا يعرف أن طالبًا خرج من نطاقه، فيبقى عنده ويُعدّ:
       يُجلب له كل نطاقه مرة كل ساعتين على الأكثر حين يتغيّر شيء (المدير كل نصف ساعة كما كان) */
    else mode = Date.now() - lastFull >= FULL_EVERY && (role === 'admin' || (!chk.hal && Date.now() - lastFull >= 4 * FULL_EVERY)) ? 'full' : 'inc';
  }
  if (mode === 'none') { lastChanged = false; since = backMinute(chk.now); }
  else if (mode === 'inc') {
    const now = scoped ? chk.now : await rpc('sync_now'), f = '&sync_ts=gt.' + encodeURIComponent(since);
    const want = scoped ? tables.filter(t => chk.tables.includes(t)) : tables;
    /* المحذوفات منذ آخر مزامنة بلا قائمة معرّفات في الرابط (كانت تتجاوز حده للمشرف كثير الطلاب):
       حذف ما ليس عند المستخدم أصلًا لا أثر له، فلا حاجة لتصفيتها بنطاقه */
    const tombF = '&at=gt.' + encodeURIComponent(since);
    const [got, tomb] = await Promise.all([fetchTables(want, f, chk), !scoped || chk.tables.includes('deleted') ? selectAll('sync_deleted', 'rev', tombF, 'tbl,pk') : []]);
    lastChanged = false;
    /* المحذوفات أولًا ثم الصفوف: ما يُرجعه الخادم الآن موجود فعلًا (ولو حُذف ثم أُعيد في الدقيقة نفسها، كما في الاسترجاع) */
    for (const d of tomb) { const m = raw[d.tbl]; if (m && m.delete(SYNC_TABLES[d.tbl].map(c => d.pk[c]).join('|'))) lastChanged = true; }
    for (const t of want) for (const r of got[t]) { raw[t].set(pkOf(t, r), r); lastChanged = true; if (t === 'members') notePhoto(r, true); }
    since = backMinute(now);
  } else {
    const now = scoped ? chk.now : inc ? await rpc('sync_now') : null;
    const got = await fetchTables(tables, '', chk);
    raw = { role, hal: chk?.hal, stu: chk?.stu };
    for (const t of tables) { raw[t] = new Map(got[t].map(r => [pkOf(t, r), r])); if (t === 'members') got[t].forEach(r => notePhoto(r, false)); }
    since = now ? backMinute(now) : null;
    lastFull = Date.now(); lastChanged = true;
  }
  const rows = t => (raw[t] ? [...raw[t].values()] : []);
  const [settings, places, members, madm, halaqat, attendance, records, news, fields] = ['settings', 'places', 'members', 'member_admin', 'halaqat', 'attendance', 'records', 'news', 'custom_fields'].map(rows);
  const db = emptyDb();
  settings.forEach(s => { db.settings[s.key] = s.value; });
  db.places = places.map(p => ({ id: p.id, name: p.name, type: p.type, address: p.address || '' }));
  const adm = new Map(madm.map(a => [a.member_id, a.data]));
  members.forEach(m => {
    const base = { id: m.id, name: m.name, phone: m.phone || '', userId: m.user_id || null, hasLogin: !!m.login_email, extra: m.extra || {} };
    if (m.role === 'teacher') db.teachers.push({ ...base, personal: m.info?.personal || {}, tech: m.info?.tech || {}, admin: adm.get(m.id) || {} });
    else if (m.role === 'student') db.students.push({ ...base, halaqaId: m.halaqa_id || '', cat: m.cat || 'child', info: m.info || {}, hasPhoto: inc ? !!m.has_photo : !!m.photo, photo: photoCache.get(m.id) });
    /* المدير العام: في مجموعة المشرفين بنطاق «الكل» */
    else if (m.role === 'gmanager') { db.supervisors.push({ ...base, info: { ...(m.info || {}), scope: 'all' } }); GM_IDS.add(m.id); }
    else if (db[ROLE_COLL[m.role]]) db[ROLE_COLL[m.role]].push({ ...base, info: m.info || {} }); // المدير والمشرف والمحاسب: بياناتهم الإضافية (مثل مسمى الموظف) تبقى ولا تُمسح عند التعديل
  });
  /* حساب محفوظ من قبل أن يصير صاحبه «مديرًا عامًا» على الخادم: يُعرف نوعه الحقيقي فتجلب المزامنة التالية ما يخصه */
  /* تُصفَّر نسخة الصفوف في آخر هذه الدالة لا هنا: ما بعدها يقرأ raw (كان تصفيرها هنا يعطّل هذه المزامنة كلها) */
  const becameGM = !!(auth?.member && auth.member.role === 'supervisor' && !auth.member.srvRole && GM_IDS.has(auth.member.id));
  if (becameGM) { auth.member = { ...auth.member, srvRole: 'gmanager' }; LS.set(AKEY, auth); }
  db.halaqat = halaqat.map(h => ({ id: h.id, name: h.name || '', teacherId: h.teacher_id || '', supervisorId: h.supervisor_id || '', placeId: h.place_id || '', time: h.time || undefined }));
  db.attendance = attendance.map(a => ({ id: a.id, studentId: a.student_id, date: a.date, status: a.status }));
  db.records = records.map(r => ({ id: r.id, studentId: r.student_id, date: r.date, type: r.type, surah: r.surah, from: r.from_ayah, to: r.to_ayah, grade: r.grade || '', note: r.note || '', ...(r.plan ? { plan: true } : {}) }));
  /* الإعلانات بترتيب إنشائها (الأقدم أولًا، وتعرضها الواجهة معكوسة فيظهر الأحدث أولًا) */
  db.news = news.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).map(n => ({ id: n.id, text: n.text, audience: n.audience, date: n.date, author: n.author || '', authorId: n.author_id || '', prio: n.prio || '', until: n.until || '' }));
  fields.forEach(f => { (db.fields[f.kind] = db.fields[f.kind] || []).push({ key: f.key, label: f.label, type: f.type }); });
  db.collections = rows('collections').map(c => ({ id: c.id, teacherId: c.teacher_id, teacherName: c.teacher_name || '', halaqaId: c.halaqa_id || '', y: c.y, m: c.m, status: c.status, lines: c.lines || [], accNote: c.acc_note || '', sentAt: c.sent_at || '', reviewedBy: c.reviewed_by || '' }));
  if (role === 'admin' || role === 'gmanager') {
    const [ps, emps, prow, closed, abs, pend] = ['pay_settings', 'pay_employees', 'pay_rows', 'pay_closed', 'absences', 'pending_columns'].map(rows);
    if (role === 'admin') db.pending = pend.map(p => ({ id: p.id, kind: p.kind, header: p.header, values: p.values || [], date: p.date }));
    db.fees = feeRows(rows('fees'));
    db.payroll = {
      settings: ps[0]?.data || {},
      employees: emps.map(e => ({ id: e.id, code: e.code || '', name: e.name, role: e.role || '', sys: e.sys || '', status: e.status, basic: e.basic, rate: e.rate, incentive: e.incentive, transport: e.transport, hours: e.hours, place: e.place || '', note: e.note || '' })),
      rows: prow.map(r => ({ id: r.id, y: r.y, m: r.m, eid: r.emp_id, name: r.name || '', role: r.role || '', base: r.base, extra: r.extra, exc: r.exc, absP: r.abs_p, absN: r.abs_n, mtgP: r.mtg_p, mtgN: r.mtg_n, dTest: r.d_test, dRec: r.d_rec, dBooks: r.d_books, basic: r.basic, rate: r.rate, incentive: r.incentive, transport: r.transport, note: r.note || '' })),
      closed: closed.map(c => c.y + '-' + c.m),
      absences: abs.map(absFromRow)
    };
    /* هل نُفّذ supabase/absence_proof.sql؟ (الإثبات «خصم» لا يُرسل قبله فيرفضه الخادم) */
    if (mode === 'full' || raw.leaveOK === undefined) { try { await rpc('leave_rules'); raw.leaveOK = true; } catch (e) { raw.leaveOK = false; } }
    db.payroll.leaveOK = !!raw.leaveOK;
    /* المدير العام يطّلع على المرتبات ولا يعدّلها (يسجّل الغياب وحده) */
    if (role === 'gmanager') { db.payroll.readOnly = true; const n = new Date(); db.payroll.curMonth = { y: n.getFullYear(), m: n.getMonth() + 1 }; }
  } else if (role === 'accountant') {
    db.fees = feeRows(rows('fees'));
    /* أسماء المعلمين والمشرفين لتسمية الحلقات فقط: تُجلب عند الجلب الكامل أو تغيّر الأعضاء */
    if (mode === 'full' || !raw.staffNames || !scoped || chk.tables.includes('members')) {
      try { raw.staffNames = (await rpc('staff_names')) || []; lastChanged = true; } catch (e) { raw.staffNames = raw.staffNames || []; }
    }
    raw.staffNames.forEach(m => { const c = db[ROLE_COLL[m.role]]; if (c && !c.some(x => x.id === m.id)) c.push({ id: m.id, name: m.name, phone: '', extra: {} }); });
  } else if (role === 'supervisor') {
    /* قائمة العاملين وشهر المرتبات الحالي: تُجلب عند الجلب الكامل أو إن تغيّرت فقط */
    /* معلومات الرصيد (بعد absence_proof.sql) تُطلب كذلك إن لم تكن في النسخة المحفوظة، مرة في كل فتح للتطبيق */
    /* وكشوف الأشهر المغلقة (بعد supabase/sup_payroll.sql؛ قبله تصل فارغة): إغلاق شهر أو إعادة فتحه يغيّر pay_closed فيُعاد جلبها */
    const needRules = !raw.extras || raw.extras.length < 5 || (raw.extras[2] == null && !leaveTried);
    if (mode === 'full' || needRules || !scoped || chk.tables.includes('staff')) { leaveTried = true; raw.extras = await Promise.all([rpc('staff_list'), rpc('current_pay_month').catch(() => null), rpc('leave_rules').catch(() => null), selectAll('pay_closed', 'y,m').catch(() => []), selectAll('pay_rows', 'id').catch(() => [])]); lastChanged = true; }
    const abs = rows('absences'), [staff, cur, rules, pclosed, prows] = raw.extras;
    const c = Array.isArray(cur) ? cur[0] : cur, lv = Array.isArray(rules) ? rules[0] : rules;
    /* بعد supabase/absence_proof.sql: نظام العمل وأيام الرصيد لحساب رصيد الإجازات، والإثبات (بلا أي مبالغ) */
    db.payroll = { settings: lv ? { lv3: lv.lv3, lv6: lv.lv6 } : {}, employees: (staff || []).map(e => ({ id: e.id, code: e.code || '', name: e.name, place: e.place || '', status: e.status, sys: e.sys || '' })),
      rows: (prows || []).map(r => ({ id: r.id, y: r.y, m: r.m, eid: r.emp_id, name: r.name || '', role: r.role || '', base: r.base, extra: r.extra, exc: r.exc, absP: r.abs_p, absN: r.abs_n, mtgP: r.mtg_p, mtgN: r.mtg_n, dTest: r.d_test, dRec: r.d_rec, dBooks: r.d_books, basic: r.basic, rate: r.rate, incentive: r.incentive, transport: r.transport, note: r.note || '' })),
      closed: (pclosed || []).map(x => x.y + '-' + x.m), absences: abs.map(absFromRow), curMonth: c && c.y ? { y: c.y, m: c.m } : null, readOnly: true, leaveOK: !!lv };
  }
  /* صلاحيات المستخدم (غير المدير) كما يحسبها الخادم: تُجلب عند الجلب الكامل أو تغيّر الإعدادات فقط */
  if (role !== 'admin') {
    if (mode === 'full' || !raw.perms || !scoped || chk.tables.includes('settings')) {
      let p = raw.perms || [];
      try { p = (await rpc('my_perms')) || []; } catch (e) { /* قبل تنفيذ perms.sql: بلا صلاحيات إضافية */ }
      if (JSON.stringify(p) !== JSON.stringify(raw.perms)) lastChanged = true;
      raw.perms = p;
    }
    db.myPerms = raw.perms;
  }
  if (mode !== 'none' || !snap) { snap = snapshotOf(db); saveLocal(db); }
  if (becameGM) raw = null;   // المزامنة التالية جلب كامل بنوعه الحقيقي
  else if (inc && scoped) { if (mode !== 'none' || lastChanged) saveRaw(); else saveRawMeta(); }
  lastSync = new Date(); lastError = ''; emit();
  return db;
}
/* ---------------- حفظ آخر مزامنة على الجهاز ----------------
   صفوف الخادم كما وصلت (raw) مع وقت آخر مزامنة تُحفظ في قاعدة بيانات المتصفح؛ وعند فتح التطبيق
   تُستعاد ويُطلب من الخادم ما تغيّر بعدها فقط. سجل المحذوفات على الخادم يُحفظ يومين، فالنسخة
   الأقدم من 36 ساعة لا تُستعمل ويُجلب كل شيء كالعادة. لكل حساب نسخته (بمعرّف المستخدم والعضو). */
const rawKey = () => 'qcloud_raw_' + (auth?.uid || 'x');
const RAW_MAX_AGE = 36 * 3600 * 1000;
let rawVer = 0;
function rawMeta() { return { mid: auth?.member?.id || '', role: raw.role, since, savedAt: Date.now(), ver: rawVer }; }
function saveRaw() {
  if (!raw || !since) return;
  const tables = {};
  for (const t of Object.keys(SYNC_TABLES)) if (raw[t]) tables[t] = [...raw[t].values()];
  rawVer++;
  persist(rawKey(), { v: 1, ...rawMeta(), hal: raw.hal, stu: raw.stu, staffNames: raw.staffNames, extras: raw.extras, perms: raw.perms, tables });
  persist(rawKey() + '_m', rawMeta());
}
/* لم يتغير شيء: يكفي تحديث وقت آخر مزامنة (صغير) دون إعادة كتابة الصفوف */
function saveRawMeta() { if (raw && since && rawVer) persist(rawKey() + '_m', rawMeta()); }
async function restoreRaw(role, tables) {
  try {
    const [r, m] = await Promise.all([IDB.get(rawKey()), IDB.get(rawKey() + '_m')]);
    if (!r || r.v !== 1 || r.role !== role || r.mid !== (auth?.member?.id || '') || !r.since) return;
    if (!tables.every(t => Array.isArray(r.tables?.[t]))) return;
    const meta = m && m.mid === r.mid && m.ver === r.ver && m.since ? m : r;
    if (Date.now() - meta.savedAt > RAW_MAX_AGE) return;
    const R = { role, hal: r.hal, stu: r.stu, staffNames: r.staffNames, extras: r.extras, perms: r.perms };
    for (const t of tables) R[t] = new Map(r.tables[t].map(x => [pkOf(t, x), x]));
    raw = R; since = meta.since; rawVer = r.ver; lastFull = Date.now();
  } catch (e) { /* بلا نسخة محفوظة صالحة: جلب كامل كالعادة */ }
}
const feeRows = list => list.map(f => ({ id: f.id, studentId: f.student_id, y: f.y, m: f.m, amount: +f.amount, date: f.date || '', by: f.by_name || '', byMember: f.by_member || '', note: f.note || '' }));
const absFromRow = a => ({ id: a.id, y: a.y, m: a.m, date: a.date || '', eid: a.emp_id, name: a.name || '', place: a.place || '', perm: a.perm || '', reason: a.reason || '', proof: a.proof || '', note: a.note || '', by: a.by_name || '', byMember: a.by_member || '', ts: a.created_at });

/* ---------------- الإرسال: الفروق فقط ---------------- */
const ALLOWED = {
  admin: null, // الكل
  teacher: ['attendance', 'records'],
  supervisor: ['attendance', 'records', 'absences'],
  gmanager: ['attendance', 'records', 'absences', 'news'], // حضور حلقاته وتسميعها، وغياب أي شخص، والإشعارات
  accountant: ['students', 'fees'],
  placeadmin: [], // يطّلع فقط؛ والتحصيل عبر دالة الخادم
  student: []
};
/* مجموعات يرسلها غير المدير متى مُنح صلاحيتها (والخادم يتحقق منها): الأماكن والحلقات (supabase/halaqat_perm.sql) */
const PERM_GROUPS = { places: 'halaqat.manage', halaqat: 'halaqat.manage' };
/* صفوف بعينها من مجموعة يرسلها غير المدير متى مُنح صلاحيتها: إعدادات الاشتراك (priv_fees) لمن له «تعديل مبالغ الاشتراك»
   (supabase/fees_systems.sql: settings_write_fees). قبل هذا كان المحاسب يعدّلها فتظهر عنده ثم ترجع مع المزامنة */
const PERM_ROWS = { settings: { perm: 'fees.amount', keys: ['priv_fees'] } };
/* مقارنة لا تتأثر بترتيب الحقول: قاعدة البيانات تعيد ترتيب حقول JSON (مثل إعدادات المرتبات)،
   فلولا هذا لظنّ التطبيق أنها تغيّرت وأعاد إرسالها مع كل مزامنة. تُستخدم فقط حين يختلف النص الظاهر. */
const canon = v => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
const sameRow = (prevJ, r) => { try { return canon(JSON.parse(prevJ)) === canon(JSON.parse(JSON.stringify(r))); } catch (e) { return false; } };
function diff(db) {
  const role = srvRole(), allow = ALLOWED[role];
  const out = [];
  const perms = db.myPerms || [];
  for (const gr of groups(db)) {
    let only = null;   // null = كل صفوف المجموعة، وإلا قائمة المفاتيح المسموح بإرسالها
    if (allow && !allow.includes(gr.name) && !(PERM_GROUPS[gr.name] && perms.includes(PERM_GROUPS[gr.name]))) {
      const pr = PERM_ROWS[gr.name];
      if (!pr || !perms.includes(pr.perm)) continue;
      only = pr.keys;
    }
    const prev = snap?.[gr.name] || {}, cur = {};
    const up = [];
    gr.rows.forEach(r => { const k = rowKey(gr.pk, r), j = JSON.stringify(r); cur[k] = j; if (only && !only.includes(k)) return; if (prev[k] !== j && !(prev[k] && sameRow(prev[k], r))) up.push(r); });
    const del = Object.keys(prev).filter(k => !(k in cur) && (!only || only.includes(k)));
    if (up.length || del.length) out.push({ ...gr, up, del, cur });
  }
  return out;
}
const pendingCount = db => (auth && snap && db ? diff(db).reduce((a, g) => a + g.up.length + g.del.length, 0) : 0);
function enc(v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
/* رفض من الخادم لسطر بعينه (صلاحية أو قيد) لا انقطاع اتصال */
const isReject = e => e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 401;
async function delKeys(gr, part) {
  if (gr.pk.length === 1) return req(`/rest/v1/${gr.table}?${gr.pk[0]}=in.(${part.map(enc).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  const cond = part.map(k => { const vs = k.split('|'); return 'and(' + gr.pk.map((p, j) => `${p}.eq.${enc(vs[j])}`).join(',') + ')'; }).join(',');
  return req(`/rest/v1/${gr.table}?or=(${encodeURIComponent(cond)})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}
/* يعيد المفاتيح التي رفض الخادم حذفها؛ الدفعة المرفوضة تُعاد سطرًا سطرًا فيُحذف ما يقبله الخادم منها */
async function doDelete(gr, keys) {
  const bad = [];
  for (let i = 0; i < keys.length; i += 100) {
    const part = keys.slice(i, i + 100);
    try { await delKeys(gr, part); }
    catch (e) {
      if (!isReject(e)) throw e;
      for (const k of part) { try { await delKeys(gr, [k]); } catch (e2) { if (!isReject(e2)) throw e2; bad.push({ k, e: e2 }); } }
    }
  }
  return bad;
}
/* يرسل الصفوف دفعات؛ الدفعة المرفوضة تُعاد سطرًا سطرًا: يُحفظ ما يقبله الخادم، ويُعاد ما يرفضه وحده.
   كان سطر واحد مرفوض (اسم بلا صلاحية تعديله مثلًا) يُسقط الدفعة كلها وما بعدها، ثم يستبدل السحبُ بيانات الجهاز
   فتضيع كل التعديلات التي لم تُرسل (حضور ودفعات سُجّلت دون إنترنت) */
async function upsertRows(gr, list, conflict) {
  const bad = [];
  const send = rows => req(`/rest/v1/${gr.table}?on_conflict=${conflict}`, { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    try { await send(chunk); }
    catch (e) {
      if (!isReject(e) || chunk.length === 1) { if (isReject(e)) { bad.push({ r: chunk[0], e }); continue; } throw e; }
      for (const r of chunk) { try { await send([r]); } catch (e2) { if (!isReject(e2)) throw e2; bad.push({ r, e: e2 }); } }
    }
  }
  return bad;
}
/* ما أُرسل بنجاح يُسجَّل في نسخة صفوف الخادم على الجهاز (raw)، فلا يعيد السحب التالي بناء البيانات من النسخة السابقة له */
function patchRaw(gr, rows, dels) {
  const m = raw?.[gr.table]; if (!m || !SYNC_TABLES[gr.table]) return;
  rows.forEach(r => { const k = pkOf(gr.table, r); m.set(k, { ...(m.get(k) || {}), ...r }); });
  dels.forEach(k => m.delete(k));
}
async function push(db) {
  if (!auth || !snap) return;
  if (pulling) { later(db, 400); return; }
  if (pushing) { again = true; return; }
  pushing = true; emit();
  try {
    await probeGM();
    const role = auth.member?.role;
    const ds = diff(db), refused = [];
    for (const gr of ds) {
      /* صف يعرفه الخادم يُحدَّث بمعرّفه (ولو تغيّر صاحبه بالدمج)، والصف الجديد بمفتاحه الطبيعي (الموظف والشهر) */
      const prev = snap[gr.name] || {}, pk = gr.pk.join(',');
      const parts = [[gr.up.filter(r => rowKey(gr.pk, r) in prev), pk], [gr.up.filter(r => !(rowKey(gr.pk, r) in prev)), gr.conflict || pk]];
      const badRows = new Set();
      for (const [list, conflict] of parts) (await upsertRows(gr, list, conflict)).forEach(b => { badRows.add(b.r); refused.push(b.e); });
      /* المقبول وحده يُسجَّل «مُرسلًا»؛ المرفوض يبقى فرقًا فيُعاد من الخادم بالسحب التالي */
      const ok = gr.up.filter(r => !badRows.has(r));
      ok.forEach(r => { snap[gr.name] = snap[gr.name] || {}; snap[gr.name][rowKey(gr.pk, r)] = JSON.stringify(r); });
      patchRaw(gr, ok, []);
    }
    /* الصور تُرسل وحدها وفقط إن تغيّرت فعلًا؛ وصورة لم تُحمَّل بعد لا تُمسح أبدًا */
    if (role === 'admin' || (db.myPerms || []).includes('students.edit')) for (const m of db.students || []) {
      if (m.photo === undefined) continue;
      const cur = m.photo || '', hv = hashStr(cur), known = photoSent.get(m.id);
      if (known === hv || (!cur && known === undefined)) continue;
      await req(`/rest/v1/members?id=eq.${m.id}`, { method: 'PATCH', body: { photo: cur || null }, headers: { Prefer: 'return=minimal' } });
      photoSent.set(m.id, hv); photoCache.set(m.id, cur);
    }
    for (const gr of ds.slice().reverse()) {
      const bad = gr.del.length ? await doDelete(gr, gr.del) : [], badK = new Set(bad.map(b => b.k));
      bad.forEach(b => refused.push(b.e));
      const done = gr.del.filter(k => !badK.has(k));
      done.forEach(k => { delete snap[gr.name][k]; });
      patchRaw(gr, [], done);
    }
    // المعلم يعدّل بياناته الشخصية والفنية عبر دالة مخصّصة (لا يملك تعديل جدول الأعضاء)
    if (role === 'teacher') {
      const me = (db.teachers || []).find(t => t.id === auth.member.id);
      if (me) {
        const r = memberRow(me, 'teacher'), k = r.id, j = JSON.stringify(r);
        if (snap.staff && snap.staff[k] !== j) {
          await rpc('update_my_profile', { member: me.id, personal: me.personal || {}, tech: me.tech || {}, new_phone: me.phone || '' });
          snap.staff[k] = j;
        }
      }
    }
    persist(snapKey(), snap);
    lastSync = new Date(); lastError = ''; pushFails = 0;
    /* ما رفضه الخادم: يُبلَّغ كما كان (فيُعاد سحب حقيقة الخادم لتلك الصفوف وحدها، بعد أن وصل كل ما قُبل) */
    if (refused.length) throw refused[0];
  } catch (e) {
    lastError = e.message || String(e);
    if (e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 401) {
      // رفض من الخادم (صلاحية أو قيد): نعيد تحميل الحقيقة من الخادم حتى لا تبقى نسخة متعارضة
      rejected = true; emit(); throw e;
    }
    /* خطأ من الخادم يتكرر (5xx، أو خطأ في الكود) لا انقطاع اتصال: بعد 5 مرات متتالية يُعامَل كرفض، وإلا بقي الجهاز
       لا يسحب جديد الخادم أبدًا (السحب ينتظر إرسال ما لم يُرسل). انقطاع الاتصال (فشل fetch) لا يُحسب: ما سُجّل بدون إنترنت يبقى */
    const offline = !(e instanceof HttpError) && (e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false));
    if (!offline && ++pushFails >= 5) { pushFails = 0; rejected = true; }
  } finally {
    pushing = false; emit();
    if (again) { again = false; later(db, 300); }
  }
}
function later(db, ms = 800) { clearTimeout(timer); timer = setTimeout(() => push(curDb(db)).catch(err => onReject?.(err)), ms); }
/* من خارج هذا الملف: كل حفظ في التطبيق يمر من هنا، فيُعرف أن البيانات تغيّرت على الجهاز (ولو أثناء سحب) */
function schedule(db, ms = 800) { editSeq++; later(db, ms); }
function pushExt(db) { if (pulling) editSeq++; return push(db); }
let onReject = null;

/* ---------------- النسخة المحلية ---------------- */
const dbKey = () => 'qcloud_db_' + (auth?.uid || 'x');
const snapKey = () => 'qcloud_snap_' + (auth?.uid || 'x');
/* النسخة المحلية في «قاعدة بيانات المتصفح» (IndexedDB): سعتها مئات الميغابايت بدل 5 في التخزين العادي.
   إن لم تتوفر (بعض المتصفحات في الوضع الخاص) يُستخدم التخزين العادي كما كان.
   بعد أول حفظ ناجح تُحذف النسخة القديمة من التخزين العادي حتى لا تبقى نسختان متعارضتان. */
const IDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    if (!window.indexedDB) { no(new Error('no indexedDB')); return; }
    const r = indexedDB.open('qulearn', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = (mode, fn) => open().then(d => new Promise((ok, no) => {
    const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
    t.oncomplete = () => ok(q.result); t.onerror = t.onabort = () => no(t.error);
  }));
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
})();
/* الكتابة بالترتيب، وكل مفتاح يُكتب بأحدث قيمة له (الضغطات المتتالية تُجمع في كتابة واحدة) */
const pendingW = new Map(); let writing = false;
function persist(k, v) { pendingW.set(k, v); if (!writing) flushW(); }
async function flushW() {
  writing = true;
  while (pendingW.size) {
    const [k, v] = pendingW.entries().next().value; pendingW.delete(k);
    try { await IDB.set(k, v); LS.del(k); } catch (e) { LS.set(k, v); }
  }
  writing = false;
}
function saveLocal(db) { persist(dbKey(), db); if (snap) persist(snapKey(), snap); }
/* قراءة فورية (للنسخ القديمة المحفوظة في التخزين العادي فقط) */
function cached() { if (!auth) return null; snap = LS.get(snapKey()); return LS.get(dbKey()); }
/* قراءة النسخة المحفوظة: من قاعدة بيانات المتصفح أولًا، ثم التخزين العادي */
async function loadLocal() {
  if (!auth) return null;
  try { const [d, s] = await Promise.all([IDB.get(dbKey()), IDB.get(snapKey())]); if (d) { snap = s || null; return d; } } catch (e) { /* يكمل بالتخزين العادي */ }
  return cached();
}
/* تكتمل قراءة النسخة المحفوظة قبل أي مزامنة، حتى لا يُستبدل ما سُجّل بدون إنترنت قبل إرساله */
const ready = loadLocal().catch(() => null);
async function publicSettings() {
  const rows = await req('/rest/v1/settings?select=key,value', { anon: true });
  const s = {}; (rows || []).forEach(r => { s[r.key] = r.value; }); return s;
}

window.Cloud = {
  get enabled() { return !!CFG.url; },
  get signedIn() { return !!auth; },
  get auth() { return auth; },
  get busy() { return pushing; },
  get lastError() { return lastError; },
  get lastSync() { return lastSync; },
  cfg: CFG, uuid, isUuid, ensureUuids, emptyDb, snapshotOf,
  signIn, reauth, signOut, lookup, setMember, pull, push: pushExt, schedule, pendingCount, cached, saveLocal, loadLocal, ready, publicSettings,
  provision, fn, rpc, req, selectAll,
  get lastChanged() { return lastChanged; },
  /* آخر سحب جاء وبيانات الجهاز فيها تعديل لم يُرسل بعد: تبقى بيانات الجهاز */
  get localNewer() { return localNewer; },
  get gmReady() { return gmReady; },
  get incremental() { return inc; },
  get feesReady() { return feesOk; },
  get newsExt() { return newsExt; },
  photoOf: id => photoCache.get(id),
  /* تنزيل صور أعضاء محددين عند الحاجة (40 صورة في الطلب) */
  async loadPhotos(ids) {
    const need = [...new Set(ids)].filter(id => isUuid(id) && !photoCache.has(id));
    for (let i = 0; i < need.length; i += 40) {
      const part = need.slice(i, i + 40);
      const got = await req(`/rest/v1/members?select=id,photo&id=in.(${part.join(',')})`);
      (got || []).forEach(r => { photoCache.set(r.id, r.photo || ''); photoSent.set(r.id, hashStr(r.photo || '')); });
      part.forEach(id => { if (!photoCache.has(id)) { photoCache.set(id, ''); photoSent.set(id, hashStr('')); } });
    }
  },
  set onReject(f) { onReject = f; },
  on: f => { listeners.add(f); return () => listeners.delete(f); },
  /* لاختبار ربط حساب جديد بالدخول دون المساس بجلسة الإداري */
  async testSignIn(email, password) {
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(r.status, j.error_description || j.msg || 'تعذّر الدخول');
    return j;
  }
};
})();
