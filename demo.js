'use strict';
/* ============ نسخة العرض (?demo=1) ============
   للعرض على مسؤولين من خارج الجمعية: التطبيق كاملًا ببيانات وهمية، يُجرَّب ولا يُحفظ شيء.
   الحواجز (كلها في هذا الملف، ويُحمَّل قبل كل ملفات التطبيق):
     1) وضع «بلا خادم» (local=1): لا تسجيل دخول ولا مزامنة.
     2) منع أي اتصال بغير ملفات التطبيق نفسه (fetch و XHR و sendBeacon و WebSocket)، فلا يخرج طلب إلى Supabase أو غيره.
     3) تخزين المتصفح كله في الذاكرة فقط (localStorage و sessionStorage)، وقاعدة بيانات المتصفح (IndexedDB) معطّلة:
        لا يُقرأ شيء من بيانات صاحب الجهاز ولا يُكتب، وكل شيء يعود كما كان بإعادة فتح الرابط.
   بدون ?demo=1 لا يفعل هذا الملف شيئًا. */
(() => {
  if (!/[?&]demo=1\b/.test(location.search)) return;
  window.QL_DEMO = true;

  /* 1) وضع بلا خادم: يُقرأ في cloud.js من الرابط */
  if (!/[?&]local=1\b/.test(location.search)) history.replaceState(null, '', location.pathname + (location.search ? location.search + '&' : '?') + 'local=1' + location.hash);

  /* 2) منع كل اتصال خارجي */
  const sameOrigin = u => { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; } };
  const blocked = [];
  const note = u => { blocked.push(String(u)); setTimeout(() => window.toast?.('غير متاح في نسخة العرض'), 0); };
  const ofetch = window.fetch.bind(window);
  window.fetch = (input, init) => { const u = typeof input === 'string' ? input : input?.url; if (!sameOrigin(u)) { note(u); return Promise.reject(new TypeError('نسخة العرض: لا اتصال خارجي')); } return ofetch(input, init); };
  const oopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { if (!sameOrigin(u)) { note(u); throw new Error('نسخة العرض: لا اتصال خارجي'); } return oopen.call(this, m, u, ...r); };
  if (navigator.sendBeacon) navigator.sendBeacon = u => { note(u); return false; };
  window.WebSocket = function () { throw new Error('نسخة العرض: لا اتصال خارجي'); };
  window.QLDemoBlocked = () => blocked.slice();

  /* 3) تخزين في الذاكرة فقط */
  class Mem {
    constructor() { this.m = new Map(); }
    get length() { return this.m.size; }
    key(i) { return [...this.m.keys()][i] ?? null; }
    getItem(k) { return this.m.has(String(k)) ? this.m.get(String(k)) : null; }
    setItem(k, v) { this.m.set(String(k), String(v)); }
    removeItem(k) { this.m.delete(String(k)); }
    clear() { this.m.clear(); }
  }
  const LS = new Mem(), SS = new Mem();
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => LS });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => SS });
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
  } catch (e) { /* متصفح لا يسمح: نوقف العرض بدل أن نلمس تخزين الجهاز */ document.documentElement.innerHTML = '<p style="padding:2rem;font:1.2rem Tahoma">هذا المتصفح لا يدعم نسخة العرض. جرّب Chrome أو Edge.</p>'; throw e; }

  /* ===== البيانات الوهمية (ثابتة في كل مرة) ===== */
  let seed = 20261115;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  let n = 0; const id = p => `demo-${p}-${(++n).toString(36)}`;
  const FIRST = ['محمد', 'أحمد', 'عبد الله', 'يوسف', 'عمر', 'علي', 'حسن', 'حسين', 'إبراهيم', 'مصطفى', 'محمود', 'خالد', 'زياد', 'مالك', 'آدم', 'ياسين', 'حمزة', 'معاذ', 'أنس', 'بلال', 'سيف', 'كريم', 'طارق', 'عمرو', 'إياد', 'تميم', 'سليم', 'نور الدين', 'عبد الرحمن', 'صهيب', 'أسامة', 'هشام', 'فارس', 'مازن', 'رامي', 'وليد', 'جمال', 'ماهر', 'سامح', 'شريف'];
  const FATHER = ['سعيد', 'عادل', 'كمال', 'رضا', 'جمال', 'فتحي', 'نبيل', 'هاني', 'صلاح', 'عصام', 'أشرف', 'ماجد', 'حسام', 'وائل', 'طه', 'ربيع', 'مجدي', 'سمير', 'فؤاد', 'رفعت', 'شوقي', 'ناصر', 'منير', 'رأفت', 'عاطف'];
  const LAST = ['السيد', 'عبد الحميد', 'الشافعي', 'النجار', 'عبد الغني', 'حسانين', 'سليمان', 'الجزار', 'مرسي', 'عبد العال', 'المصري', 'البنا', 'عثمان', 'الصاوي', 'زيدان', 'رمضان', 'شحاتة', 'عيسى', 'خليل', 'منصور'];
  const used = new Set();
  const person = (three = true) => { for (;;) { const nm = three ? `${pick(FIRST)} ${pick(FATHER)} ${pick(LAST)}` : `${pick(FIRST)} ${pick(FATHER)}`; if (!used.has(nm)) { used.add(nm); return nm; } } };
  const pad = x => String(x).padStart(2, '0'), iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const PLACES = ['مسجد الرحمة', 'مسجد النور', 'مسجد التقوى', 'مسجد السلام', 'مسجد الهدى', 'مسجد الفتح', 'دار الأرقم', 'مسجد الإيمان'];
  const places = PLACES.map(name => ({ id: id('p'), name, type: /دار/.test(name) ? 'دار' : 'مسجد', address: '' }));
  const admins = [{ id: id('a'), name: 'مدير العرض', phone: '', pin: '000000', extra: {}, info: {} }];
  const supervisors = Array.from({ length: 3 }, () => ({ id: id('s'), name: person(), phone: '', pin: '000000', extra: {}, info: {} }));
  const teachers = Array.from({ length: 20 }, () => ({ id: id('t'), name: person(), phone: '01' + Math.floor(rnd() * 9e8 + 1e8), pin: '000000', extra: {}, personal: {}, tech: {}, admin: {} }));
  const accountants = [{ id: id('c'), name: person(), phone: '', pin: '000000', extra: {}, info: { title: 'محاسب' } }];
  const placeadmins = [{ id: id('x'), name: person(), phone: '', pin: '000000', extra: {}, info: { places: [places[0].id, places[1].id] } }];
  const PR = ['الفجر', 'العصر', 'المغرب', 'العشاء'];
  const halaqat = [];
  teachers.forEach((t, i) => {
    const cnt = i < 4 ? 2 : 1;
    for (let k = 0; k < cnt; k++) {
      const fi = Math.floor(rnd() * 3);
      halaqat.push({ id: id('h'), name: '', teacherId: t.id, supervisorId: supervisors[i % 3].id, placeId: places[(i + k * 3) % places.length].id,
        time: { mode: 'prayer', fromPrayer: PR[fi], toKind: 'prayer', toPrayer: PR[fi + 1] } });
    }
  });
  const students = [];
  halaqat.forEach(h => {
    const cnt = 12 + Math.floor(rnd() * 8);
    for (let k = 0; k < cnt; k++) {
      const off = rnd() < 0.08, adult = rnd() < 0.1;
      const by = now.getFullYear() - (adult ? 18 + Math.floor(rnd() * 20) : 6 + Math.floor(rnd() * 9));
      students.push({ id: id('st'), name: person(), halaqaId: h.id, phone: '01' + Math.floor(rnd() * 9e8 + 1e8), pin: '000000', cat: adult ? 'adult' : 'child', extra: {},
        info: { birth: `${by}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`, ...(off ? { status: 'منقطع', statusDate: iso(new Date(now - 40 * 864e5)) } : {}), ...(rnd() < 0.15 ? { feeSys: '3' } : {}), ...(rnd() < 0.05 ? { feeDisc: 'd_orphan' } : {}) } });
    }
  });
  const active = students.filter(s => s.info.status !== 'منقطع');
  /* الحضور والتسميع: آخر 4 أسابيع، أيام الحلقات (بلا الجمعة) */
  const attendance = [], records = [];
  /* عدد آيات سور جزء عمّ (78–114)، فالتسميع فيها */
  const AYAT = [40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
  const pos = new Map(active.map(s => [s.id, { su: 78 + Math.floor(rnd() * 30), ay: 1 }]));
  for (let d = 28; d >= 0; d--) {
    const day = new Date(now - d * 864e5); if (day.getDay() === 5) continue;
    const ds = iso(day);
    active.forEach(s => {
      const r = rnd(), st = r < 0.82 ? 'present' : r < 0.9 ? 'late' : r < 0.95 ? 'excused' : 'absent';
      attendance.push({ id: id('at'), studentId: s.id, date: ds, status: st });
      if ((st === 'present' || st === 'late') && rnd() < 0.5) {
        const p = pos.get(s.id), len = AYAT[p.su - 78], to = Math.min(len, p.ay + 3 + Math.floor(rnd() * 6));
        records.push({ id: id('r'), studentId: s.id, date: ds, type: rnd() < 0.7 ? 'حفظ' : 'مراجعة', surah: p.su, from: p.ay, to, grade: pick(['ممتاز', 'ممتاز', 'جيد جدًا', 'جيد جدًا', 'جيد', 'مقبول']), note: '' });
        if (to >= len) { p.su = Math.min(114, p.su + 1); p.ay = 1; } else p.ay = to + 1;
      }
    });
  }
  /* الاشتراكات: 60 جنيهًا (3 أيام 40)، ومبلغ مختلف لمكانين؛ دفعات آخر ثلاثة أشهر */
  const yNow = now.getFullYear();
  const amounts = { general: 60, general3: 40, places: { [places[2].id]: { general: 70, general3: 45 }, [places[6].id]: { general: 80, general3: null } }, cats: [] };
  const priv_fees = { v: 3, ...amounts, years: { [yNow]: amounts }, discs: [{ id: 'd_tahfeez', name: 'أبناء موظفي التحفيظ', type: 'pct', value: 50 }, { id: 'd_assoc', name: 'أبناء موظفي الجمعية', type: 'pct', value: 25 }, { id: 'd_orphan', name: 'أيتام', type: 'pct', value: 100 }, { id: 'd_special', name: 'حالات خاصة', type: 'pct', value: 0, each: true }] };
  const fees = [];
  const hal = new Map(halaqat.map(h => [h.id, h]));
  const dueOf = s => { if (s.info.feeDisc === 'd_orphan') return 0; const P = amounts.places[hal.get(s.halaqaId).placeId] || {}; const three = s.info.feeSys === '3'; return three ? (P.general3 ?? amounts.general3) : (P.general ?? amounts.general); };
  for (let k = 2; k >= 0; k--) {
    const md = new Date(now.getFullYear(), now.getMonth() - k, 1), y = md.getFullYear(), m = md.getMonth() + 1;
    const share = k === 0 ? 0.45 : k === 1 ? 0.85 : 0.93;
    active.forEach(s => {
      const due = dueOf(s); if (!due || rnd() > share) return;
      const day = k === 0 ? 1 + Math.floor(rnd() * Math.max(1, now.getDate() - 1)) : 1 + Math.floor(rnd() * 20);
      const amt = rnd() < 0.08 ? Math.round(due / 2) : due;
      fees.push({ id: id('f'), studentId: s.id, y, m, amount: amt, date: `${y}-${pad(m)}-${pad(day)}`, by: accountants[0].name, byMember: accountants[0].id, note: '' });
    });
  }
  /* مدير عام: مشرف نطاقه «الكل» يرى كل الحلقات والأماكن (roles.js)، ولا تُسند إليه حلقات بعينها.
     باسم ثابت (لا يستهلك من المولّد العشوائي) فتبقى بقية الأسماء والمبالغ كما كانت */
  const GMN = 'عبد الرحمن سعيد الشافعي';
  const gm = { id: id('s'), name: used.has(GMN) ? GMN + ' (مدير عام)' : GMN, phone: '', pin: '000000', extra: {}, info: { scope: 'all' } };
  supervisors.push(gm);
  /* المرتبات: موظفون من المعلمين والمشرفين وموظف إداري */
  const employees = [...teachers, ...supervisors].map((t, i) => ({ id: id('e'), code: 'م' + String(i + 1).padStart(3, '0'), name: t.name, role: i < teachers.length ? 'معلم' : t === gm ? 'مدير عام' : 'مشرف', sys: rnd() < 0.3 ? '(3) أيام' : '(6) أيام', status: 'نشط', basic: 2400 + Math.floor(rnd() * 8) * 100, rate: 26, incentive: 200 + Math.floor(rnd() * 5) * 50, transport: 150 + Math.floor(rnd() * 3) * 50, hours: 26, place: '', note: '' }));
  const cls = {}; employees.forEach((e, i) => { const t = i < teachers.length ? teachers[i] : supervisors[i - teachers.length]; cls[e.id] = { kind: i < teachers.length ? 'teacher' : 'supervisor', memberId: t.id }; });
  const news = [
    { id: id('n'), text: 'يبدأ الاختبار الشهري للحلقات يوم السبت القادم بإذن الله، ويُرجى من المعلمين تجهيز كشوف الحفظ.', audience: 'all', date: iso(new Date(now - 3 * 864e5)), author: 'مدير العرض', authorId: admins[0].id },
    { id: id('n'), text: 'تذكير: آخر موعد لسداد اشتراك الشهر نهاية الأسبوع.', audience: 'students', date: iso(new Date(now - 864e5)), author: 'المحاسب ' + accountants[0].name, authorId: accountants[0].id }
  ];
  const db = {
    settings: { org: 'جمعية النور لتحفيظ القرآن (نسخة عرض)', priv_fees, priv_dups: [] },
    admins, supervisors, teachers, accountants, placeadmins, places, halaqat, students, attendance, records, news, fees,
    fields: { students: [], teachers: [] }, pending: [], collections: [],
    payroll: { settings: { cls }, employees, rows: [], closed: [], absences: [] }
  };
  LS.setItem('halaqat_v1', JSON.stringify(db));
  SS.setItem('halaqat_session', JSON.stringify({ role: 'admin', id: admins[0].id }));

  /* ===== الواجهة: شريط ثابت، واختيار الفئة ===== */
  const ROLES = [['admin', 'المدير', 'admins'], ['accountant', 'المحاسب', 'accountants'], ['teacher', 'المعلم', 'teachers'], ['gmanager', 'المدير العام', 'supervisors'], ['supervisor', 'المشرف', 'supervisors'], ['placeadmin', 'الإداري', 'placeadmins'], ['student', 'الطالب', 'students']];
  const pickMember = role => {
    if (role === 'teacher') return teachers[0].id;            // معلم له حلقتان
    if (role === 'student') return active[0].id;
    if (role === 'gmanager') return gm.id;
    return (window.db || db)[ROLES.find(r => r[0] === role)[2]][0]?.id;
  };
  /* الواجهة المعروضة الآن: «المدير العام» مشرف نطاقه «الكل» */
  const curView = () => (session?.role === 'supervisor' && session.id === gm.id ? 'gmanager' : session?.role);
  const go = role => {
    session = { role: role === 'gmanager' ? 'supervisor' : role, id: pickMember(role) };
    SS.setItem('halaqat_session', JSON.stringify(session));
    ui.tab = null; ui.hid = ''; ui.nav = false;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    render(); bar(); window.scrollTo(0, 0);
  };
  const css = document.createElement('style');
  css.textContent = `#demobar{position:fixed;top:0;inset-inline:0;z-index:70;display:flex;align-items:center;gap:.5rem .8rem;flex-wrap:wrap;justify-content:center;
      padding:max(.4rem,env(safe-area-inset-top)) .8rem .4rem;background:#1f5a3a;color:#fff;font-size:.9rem;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    #demobar b{font-weight:800}#demobar select{width:auto;min-height:32px;padding:0 .5rem;border-radius:8px;border:0;font:inherit}
    #demobar .btn{background:#fff;color:#1f5a3a;border:0;min-height:32px;padding:0 .7rem}
    html.demo body{padding-top:var(--demo-h,44px)}html.demo .content .top{top:var(--demo-h,44px)}
    .demo-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.6rem;margin:.6rem 0}
    .demo-pick .btn{display:flex!important;flex-direction:column!important;align-items:center;justify-content:center;gap:.4rem;min-height:76px;padding:.55rem .5rem;white-space:normal;text-align:center}
    .demo-pick .dt{display:block;font-size:1.05rem;font-weight:800;line-height:1.2}
    .demo-pick .dd{display:inline-block;font-size:.76rem;font-weight:500;line-height:1.3;padding:.15rem .65rem;border-radius:999px;background:rgba(19,41,75,.08);color:inherit}
    .demo-pick .btn.primary .dd{background:rgba(255,255,255,.18)}
    .demo-intro{margin:0 0 .3rem;line-height:1.75}.demo-intro li{margin:.1rem 0}`;
  function bar() {
    let b = document.getElementById('demobar');
    if (!b) { b = document.createElement('div'); b.id = 'demobar'; document.body.appendChild(b); document.documentElement.classList.add('demo'); }
    b.innerHTML = `<span><b>نسخة عرض</b> — البيانات وهمية، وما تجرّبه لا يُحفظ</span>
      <label style="margin:0;display:flex;gap:.4rem;align-items:center;color:#fff">الواجهة<select data-demorole aria-label="الواجهة المعروضة">${ROLES.map(([k, l]) => `<option value="${k}" ${curView() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button type="button" class="btn sm" data-demoreset>البدء من جديد</button>`;
    requestAnimationFrame(() => document.documentElement.style.setProperty('--demo-h', b.offsetHeight + 'px'));
  }
  function chooser() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    const DESC = { admin: 'اللوحة كاملة', accountant: 'الاشتراكات والتحصيل', teacher: 'الحضور والتسميع', gmanager: 'كل الحلقات والأماكن', supervisor: 'متابعة حلقاته', placeadmin: 'حلقات مكانه', student: 'حفظه وحضوره' };
    ov.innerHTML = `<div class="modal"><h2>مرحبًا بك في نسخة العرض</h2>
      <div class="demo-intro muted"><p style="margin:0 0 .3rem">تصفّح التطبيق كما يعمل فعلًا في جمعية افتراضية، <b>بأسماء ومبالغ وهمية</b>.</p>
        <ul style="margin:0;padding-inline-start:1.2rem"><li>جرّب ما تشاء: سجّل حضورًا، أو حصّل اشتراكًا، أو اطبع إيصالًا.</li><li>لا يُحفظ شيء، ولا يتصل هذا العرض بأي خادم.</li><li>اختر الواجهة الآن، وبدّل بينها متى شئت من الشريط أعلى الشاشة.</li></ul></div>
      <div class="demo-pick">${ROLES.map(([k, l]) => `<button type="button" class="btn ${k === 'admin' ? 'primary' : ''}" data-demogo="${k}"><span class="dt">${l}</span><span class="dd">${DESC[k]}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(css);
    try { window.dupOnce = () => {}; } catch (e) { /* ignore */ }   // لا نافذة «أسماء متشابهة» في العرض
    document.title = 'نسخة عرض — إدارة الحلقات القرآنية';
    setTimeout(() => { bar(); chooser(); }, 1300);
  });
  document.addEventListener('change', e => { if (e.target.matches?.('[data-demorole]')) go(e.target.value); });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-demogo]'); if (g) { go(g.dataset.demogo); return; }
    if (e.target.closest('[data-demoreset]')) location.reload();
    /* الخروج في العرض يعيد اختيار الواجهة بدل شاشة الدخول */
    if (e.target.closest('[data-act="logout"]')) { e.stopImmediatePropagation(); e.preventDefault(); chooser(); }
  }, true);
})();
