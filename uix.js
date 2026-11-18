'use strict';
/* ============ تحسينات عامة في الواجهة ============
   1) أيقونة القسم بجانب اسم الصفحة في الشريط العلوي (الأيقونة نفسها التي في القائمة الجانبية).
   2) قوائم الأشهر (كل قائمة خياراتها «سنة-شهر»، أينما كانت): تبدأ من أول شهر فيه بيانات، وما قبله لا يُعرض.
   3) «عدادات الرئيسية» (في «الإعدادات»، للمدير): يختار لكل فئة العدادات التي تظهر لها في «الرئيسية».
      يُحفظ مع الصلاحيات (priv_perms.roles[الفئة]['ui.home.hide.اسم العداد'] = true)، فيصل كل مستخدم ما يخصه من الخادم
      عبر my_perms كبقية الصلاحيات، بلا تعديل على الخادم. للعرض فقط. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./uix.js')) VFILES.push('./uix.js'); } catch (e) { /* ignore */ } });

  /* ===== 1) أيقونة بجانب اسم الصفحة ===== */
  const titleIcon = () => {
    const t = document.querySelector('.content .top .ttl'), ic = document.querySelector('.side .tabs button.on .ti');
    if (!t || !ic || t.querySelector('.qttlico')) return;
    t.insertAdjacentHTML('afterbegin', `<span class="qttlico" aria-hidden="true">${ic.innerHTML}</span>`);
  };

  /* ===== 2) قوائم الأشهر من أول شهر فيه بيانات ===== */
  const YM = /^(\d{4})-(\d{1,2})$/;
  let firstAt = 0, firstV = null;
  function firstMonth() {
    if (Date.now() - firstAt < 5000 && firstV !== null) return firstV;
    let min = Infinity;
    const ym = (y, m) => { y = +y; m = +m; if (y > 1990 && m >= 1 && m <= 12) min = Math.min(min, y * 12 + m - 1); };
    const dt = d => { const x = YM.exec(String(d || '').slice(0, 7)); if (x) ym(x[1], x[2]); };
    (db.fees || []).forEach(f => ym(f.y, f.m));
    (db.collections || []).forEach(c => ym(c.y, c.m));
    (db.attendance || []).forEach(a => dt(a.date));
    (db.records || []).forEach(r => dt(r.date));
    const P = db.payroll || {};
    (P.rows || []).forEach(r => ym(r.y, r.m));
    (P.absences || []).forEach(a => ym(a.y, a.m));
    if (min === Infinity) { const n = new Date(); min = n.getFullYear() * 12 + n.getMonth(); }
    firstAt = Date.now(); firstV = min;
    return min;
  }
  function trimMonths(root) {
    if (!session) return;
    (root || document).querySelectorAll('select').forEach(s => {
      const o = [...s.options];
      if (o.length < 2 || !o.every(x => YM.test(x.value))) return;
      const min = firstMonth();
      o.forEach(x => { const [, y, m] = YM.exec(x.value); if (+y * 12 + +m - 1 < min && !x.selected) x.remove(); });
    });
  }

  /* ===== 3) عدادات الرئيسية لكل فئة ===== */
  const FEE = ['عدد الطلاب', 'مسدَّد', 'لم يسدّد', 'معفى', 'بلا اشتراك محدد', 'المتوقع', 'المحصّل', 'الباقي', 'نسبة التحصيل'];
  const CATS = [
    ['admin', 'المدير', ['المعلمون العاملون', 'المشرفون', 'الأماكن', 'الحلقات', 'الطلاب المنتظمون', 'حضور اليوم', 'تسجيلات الأسبوع', ...FEE]],
    ['supervisor', 'المشرفون والمديرون العامون', ['الحلقات', 'الطلاب المنتظمون', 'حضور اليوم', 'حلقات سُجّل حضورها اليوم', 'تسميع اليوم', 'غياب المعلمين هذا الشهر', 'طلبات نقل بانتظار موافقتك']],
    ['teacher', 'المعلمون', ['الطلاب المنتظمون', 'حضور اليوم', 'لم يُسجَّل حضورهم اليوم', 'تسميع اليوم', 'غياب هذا الشهر', 'بانتظار موافقة النقل']],
    ['accountant', 'المحاسبون', ['الطلاب المنتظمون', 'كشوف بانتظار المراجعة', ...FEE]],
    ['placeadmin', 'الإداريون', ['الأماكن', 'الحلقات', 'الطلاب المنتظمون', 'حضور اليوم', 'حلقات سُجّل حضورها اليوم', 'تسميع اليوم', 'طلبات النقل']],
    ['student', 'الطلاب', ['نسبة حضوري', 'أيام الغياب', 'تسميعاتي', 'آخر حفظ']]
  ];
  const HK = l => 'ui.home.hide.' + l;
  const rolesCfg = () => db.settings?.priv_perms?.roles;
  /* المخفي عن المستخدم الحالي: المدير (ومن يرى الإعدادات الخاصة كما في وضع التجربة) من الإعدادات مباشرة، وغيره مما أرسله الخادم */
  const hiddenFor = r => {
    const R = rolesCfg();
    if (R) return new Set(Object.keys(R[r] || {}).filter(k => k.startsWith('ui.home.hide.') && R[r][k] === true).map(k => k.slice(13)));
    return new Set((db.myPerms || []).filter(k => k.startsWith('ui.home.hide.')).map(k => k.slice(13)));
  };
  function applyHome() {
    if (!session || !['home', 'dash'].includes(ui.tab)) return;
    const main = document.querySelector('.content main'); if (!main) return;
    const H = hiddenFor(session.role);
    main.querySelectorAll('.feerow').forEach(f => {
      const l = (f.querySelector('span')?.textContent || '').trim();
      const off = H.has(l);
      if (off !== f.hasAttribute('data-qhid')) { f.toggleAttribute('data-qhid', off); f.style.display = off ? 'none' : ''; }
    });
    /* صف أو بطاقة اختفت كل عداداتها: تختفي */
    main.querySelectorAll('.qfrow').forEach(r => { const all = r.querySelectorAll('.feerow'); r.style.display = all.length && [...all].every(f => f.hasAttribute('data-qhid')) ? 'none' : ''; });
    main.querySelectorAll('.qdashcard,.feecard').forEach(c => { const all = c.querySelectorAll('.feerow'); c.style.display = all.length && [...all].every(f => f.hasAttribute('data-qhid')) ? 'none' : ''; });
  }
  /* بطاقة الإعدادات */
  let cat = 'admin';
  const homeCard = () => {
    const [k, , labels] = CATS.find(c => c[0] === cat) || CATS[0], H = hiddenFor(k);
    return `<div class="card" data-qhc><h2>عدادات الرئيسية</h2>
      <p class="muted" style="margin:0 0 .7rem">اختر لكل فئة العدادات التي تظهر لها في «الرئيسية». ما يُلغى تحديده يُخفى عنها (للعرض فقط).</p>
      <div class="bar" style="margin:0 0 .6rem"><label style="margin:0">الفئة <select data-qhcat style="width:auto">${CATS.map(([v, l]) => `<option value="${v}" ${v === cat ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="qhcl">${labels.map(l => `<label class="chk"><input type="checkbox" data-qhl="${esc(l)}" ${H.has(l) ? '' : 'checked'}> ${esc(l)}</label>`).join('')}</div>
      <div class="bar" style="margin:.8rem 0 0"><button type="button" class="btn primary" data-qhsave>حفظ</button><button type="button" class="btn" data-qhall>إظهار الكل</button></div></div>`;
  };
  function saveCat(k, hidden) {
    const pp = db.settings.priv_perms = db.settings.priv_perms || {};
    pp.roles = pp.roles || {};
    const R = { ...(pp.roles[k] || {}) };
    Object.keys(R).forEach(x => { if (x.startsWith('ui.home.hide.')) delete R[x]; });
    hidden.forEach(l => { R[HK(l)] = true; });
    pp.roles = { ...pp.roles, [k]: R };
    save(); render(); toast('حُفظت عدادات الرئيسية لـ«' + CATS.find(c => c[0] === k)[1] + '»');
  }
  document.addEventListener('change', e => { if (e.target.matches?.('[data-qhcat]')) { cat = e.target.value; render(); } });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-qhsave]')) { const box = e.target.closest('[data-qhc]'); saveCat(cat, [...box.querySelectorAll('[data-qhl]')].filter(x => !x.checked).map(x => x.dataset.qhl)); }
    else if (e.target.closest('[data-qhall]')) saveCat(cat, []);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.settings;
    if (typeof base !== 'function') return;
    adminViews.settings = function () {
      const h = base.apply(this, arguments);
      if (session?.role !== 'admin' || typeof h !== 'string') return h;
      /* في تبويب «الإعدادات» نفسه فقط (القسم الجامع في nav.js يعرض شريط تبويباته ثم التبويب المختار) */
      return /class="btn on" data-subtab="settings"/.test(h) ? h + homeCard() : h;
    };
  });

  const css = document.createElement('style');
  css.textContent = `.content .top .ttl{display:flex;align-items:center;gap:.5rem}.qttlico{display:inline-flex;flex:none}.qttlico svg{width:22px;height:22px}
    .qhcl{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.1rem .8rem}.qhcl label{margin:.15rem 0}`;
  document.head.appendChild(css);

  const after = () => { try { titleIcon(); applyHome(); trimMonths(); } catch (e) { /* ignore */ } };
  const baseRender = render;
  render = function () { const r = baseRender.apply(this, arguments); after(); return r; };
  /* النوافذ والقوائم التي تُفتح بعد العرض (نموذج الدفعة، كشف التحصيل…) */
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; try { trimMonths(); titleIcon(); applyHome(); } catch (e) { /* ignore */ } }); })
    .observe(document.body, { childList: true, subtree: true });
  window.QLUix = { firstMonth, hiddenFor, CATS };
})();
