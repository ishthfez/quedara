'use strict';
/* ============ تنظيم أقسام المدير: لكل شيء بيت واحد (المرحلة الأولى) ============
   - أقسام متقاربة صارت تبويبات داخل قسم واحد، دون حذف أي وظيفة:
       «الاشتراكات»: التحصيل + تحصيل المعلمين
       «المرتبات»: المرتبات + غياب المعلمين
       «الإعدادات»: الإعدادات + الصلاحيات + النسخ الاحتياطية + البيانات المعلّقة
   - الشريط الجانبي مجمّع بعناوين: التعليم، المالية، التواصل، النظام.
   - أي زر قديم يفتح قسمًا صار تبويبًا (مثل «+ تسجيل غياب» أو «النسخ الاحتياطية…») يفتح القسم الجامع على تبويبه.
   يُحمَّل بعد كل الملفات التي تضيف أقسامًا، وقبل app-actions.js. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./nav.js')) VFILES.push('./nav.js'); } catch (e) { /* ignore */ } }, 0);
  const label = k => (TABS.admin.find(t => t[0] === k) || [k, k])[1];
  const GROUPS = {
    fees: [['fees', 'التحصيل'], ['tcollect', 'تحصيل المعلمين']],
    payroll: [['payroll', 'المرتبات'], ['absence', 'غياب المعلمين']],
    settings: [['settings', 'الإعدادات'], ['perms', 'الصلاحيات'], ['backup', 'النسخ الاحتياطية'], ['pending', 'بيانات معلّقة']]
  };
  /* ترتيب الشريط الجانبي وعناوين مجموعاته */
  const ORDER = [['dash'], ['members'], ['students', 'التعليم'], ['teachers'], ['halaqat'], ['fees', 'المالية'], ['payroll'], ['news', 'التواصل'], ['settings', 'النظام']];
  const OWNER = {}; Object.entries(GROUPS).forEach(([g, subs]) => subs.forEach(([k]) => { OWNER[k] = g; }));
  const sub = {}; try { Object.assign(sub, JSON.parse(sessionStorage.getItem('halaqat_sub') || '{}')); } catch (e) { /* ignore */ }
  const saveSub = () => { try { sessionStorage.setItem('halaqat_sub', JSON.stringify(sub)); } catch (e) { /* ignore */ } };

  /* القسم الجامع يعرض شريط تبويباته ثم محتوى التبويب المختار (بالدالة الأصلية لكل قسم) */
  const ORIG = {};
  Object.entries(GROUPS).forEach(([g, subs]) => {
    subs.forEach(([k]) => { ORIG[k] = adminViews[k]; });
    adminViews[g] = () => {
      const cur = subs.some(([k]) => k === sub[g]) ? sub[g] : subs[0][0];
      const cnt = k => k === 'pending' ? (db.pending || []).length : k === 'tcollect' ? (db.collections || []).filter(c => c.status === 'sent').length : 0;
      const bar = `<div class="card subnav"><div class="bar" style="margin:0">${subs.map(([k, l]) => `<button type="button" class="btn ${k === cur ? 'on' : ''}" data-subtab="${k}" data-g="${g}">${l}${cnt(k) ? ` <span class="count">${cnt(k)}</span>` : ''}</button>`).join('')}</div></div>`;
      const fn = ORIG[cur] || adminViews[cur];
      return bar + (fn ? fn() : empty('هذا القسم غير محمّل.'));
    };
  });
  /* أقسام الشريط الجانبي الجديدة */
  const keep = new Map(TABS.admin.map(t => [t[0], t[1]]));
  keep.set('fees', 'الاشتراكات'); keep.set('payroll', 'المرتبات'); keep.set('settings', 'الإعدادات');
  TABS.admin.splice(0, TABS.admin.length, ...ORDER.filter(([k]) => keep.has(k)).map(([k]) => [k, keep.get(k)]),
    /* أي قسم أضافه ملف آخر ولم يُذكر هنا يبقى في آخر القائمة */
    ...[...keep.keys()].filter(k => !ORDER.some(o => o[0] === k) && !OWNER[k]).map(k => [k, keep.get(k)]));

  /* «تحصيل المعلمين» لا عمود فيه للمكان، فاسم الحلقة فيه بمكانها (كما كان قسمًا مستقلًا) */
  const baseLabel = halaqaLabel;
  halaqaLabel = function (h) {
    if (ui.tab !== 'fees' || sub.fees !== 'tcollect') return baseLabel(h);
    ui.tab = 'tcollect'; try { return baseLabel(h); } finally { ui.tab = 'fees'; }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-subtab]'); if (!b) return;
    sub[b.dataset.g] = b.dataset.subtab; saveSub(); render(); window.scrollTo(0, 0);
  });

  /* عناوين المجموعات في الشريط الجانبي، وعدّاد البيانات المعلّقة والتحصيل على القسم الجامع */
  const css = document.createElement('style');
  css.textContent = `.side .navgrp{font-size:.72rem;font-weight:700;letter-spacing:.02em;opacity:.55;padding:.7rem .8rem .15rem;color:var(--on-navy)}
    .shell.collapsed .side .navgrp{font-size:0;padding:.35rem 0;border-top:1px solid rgba(255,255,255,.14);margin:0 .6rem}
    .subnav{padding:.55rem .7rem;margin-bottom:.8rem}.subnav .btn{white-space:nowrap}`;
  document.head.appendChild(css);
  function decorate() {
    if (session?.role !== 'admin') return;
    const nav = document.querySelector('.side nav.tabs'); if (!nav || nav.querySelector('.navgrp')) return;
    ORDER.filter(o => o[1]).forEach(([k, t]) => { const b = nav.querySelector(`button[data-v="${k}"]`); if (b) b.insertAdjacentHTML('beforebegin', `<div class="navgrp">${t}</div>`); });
    const badge = (k, n) => { const b = nav.querySelector(`button[data-v="${k}"]`); if (b && n && !b.querySelector('.count')) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`); };
    badge('settings', (db.pending || []).length);
    badge('fees', (db.collections || []).filter(c => c.status === 'sent').length);
  }

  setTimeout(() => {
    const base = render;
    render = function () {
      /* قسم صار تبويبًا: يُفتح القسم الجامع على هذا التبويب */
      if (session?.role === 'admin' && OWNER[ui.tab] && OWNER[ui.tab] !== ui.tab) { sub[OWNER[ui.tab]] = ui.tab; saveSub(); ui.tab = OWNER[ui.tab]; }
      const r = base.apply(this, arguments);
      try { decorate(); } catch (err) { /* لا يعطّل العرض */ }
      return r;
    };
    if (session) render();
  }, 0);
})();
