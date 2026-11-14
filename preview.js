'use strict';
/* ============ «المعاينة»: يرى المدير التطبيق كما يراه أي حساب ============
   اختر النوع (طالب، معلم، مشرف، مشرف عام، إداري، محاسب) ثم الشخص، فتظهر تبويباته وصفحاته كما تظهر له.
   - للاطلاع فقط: الأزرار والخانات معطّلة (عدا اختيار الحلقة والشهر والتاريخ، وفتح «السجل» و«الملف»)، فلا يُسجَّل شيء باسمه.
   - الصلاحيات (كصلاحيات المحاسب) تُحسب من «الصلاحيات» كما يحسبها الخادم.
   - ما يراه فعليًا على جهازه يعتمد أيضًا على أوامر الخادم (مثل roles.sql للإداري والمشرف العام) وعلى وجود حساب دخول له.
   يُحمَّل قبل nav.js (ليظهر القسم تحت «النظام») وقبل app-actions.js. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./preview.js')) VFILES.push('./preview.js'); } catch (e) { /* ignore */ } }, 0);
  TABS.admin.push(['preview', 'المعاينة']);
  TAB_ICONS.preview = svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  const gen = m => m?.info?.scope === 'all';
  const KINDS = [
    ['student', 'طالب', () => db.students],
    ['teacher', 'معلم', () => db.teachers],
    ['supervisor', 'مشرف', () => (db.supervisors || []).filter(m => !gen(m))],
    ['gsup', 'مشرف عام', () => (db.supervisors || []).filter(gen)],
    ['placeadmin', 'إداري', () => db.placeadmins || []],
    ['accountant', 'محاسب', () => db.accountants || []]
  ];
  const roleOf = k => (k === 'gsup' ? 'supervisor' : k);
  const pv = { k: 'teacher', id: '', tab: '', hid: '' };
  const listOf = k => (KINDS.find(x => x[0] === k)?.[2]() || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  /* اسم يسهّل التمييز: الطالب بحلقته، والمعلم بمكان حلقاته */
  const optLabel = (k, m) => {
    if (k === 'student') return m.name + (m.halaqaId ? ' — ' + hName(m.halaqaId) : '');
    if (k === 'teacher') { const ps = [...new Set(db.halaqat.filter(h => h.teacherId === m.id).map(h => placeName(h)).filter(Boolean))]; return m.name + (ps.length ? ' — ' + ps.join('، ') : ''); }
    return m.name;
  };
  /* صلاحيات الشخص كما يحسبها الخادم: استثناؤه، ثم اختيار فئته، ثم الافتراضي */
  function permsOf(role, id) {
    const c = db.settings.priv_perms || {}, R = (c.roles || {})[role] || {}, M = (c.members || {})[id] || {};
    const defs = window.Perms?.list || [];
    const keys = new Set([...defs.map(d => d.key), ...Object.keys(R), ...Object.keys(M)]);
    return [...keys].filter(k => (M[k] !== undefined ? !!M[k] : R[k] !== undefined ? !!R[k] : !!defs.find(d => d.key === k)?.defaults?.includes(role)));
  }
  function blockedNote(role, m) {
    if (role === 'student' && (m.info || {}).status === 'منقطع') return 'هذا الطالب «منقطع»: عند دخوله يرى رسالة الإيقاف بدل هذه الصفحات.';
    if (role === 'teacher' && (m.admin || {}).status === 'موقوف') return 'هذا المعلم «متوقف»: عند دخوله يرى رسالة الإيقاف ولا يستطيع التسجيل.';
    return '';
  }

  /* يُرسم محتوى التبويب بهوية الشخص، ثم تعود هوية المدير فورًا */
  function asPerson(role, m, tab) {
    const keep = { session, tab: ui.tab, hid: ui.hid, perms: db.myPerms };
    try {
      session = { role, id: m.id };
      ui.tab = tab; ui.hid = pv.hid;
      db.myPerms = permsOf(role, m.id);
      const fn = VIEWS[role]?.[tab];
      const h = fn ? fn() : empty('هذه الصفحة غير متاحة.');
      pv.hid = ui.hid;
      return h;
    } catch (err) {
      return `<div class="card">${empty('تعذّر عرض هذه الصفحة: ' + (err.message || err))}</div>`;
    } finally {
      session = keep.session; ui.tab = keep.tab; ui.hid = keep.hid; db.myPerms = keep.perms;
    }
  }

  function view() {
    const list = listOf(pv.k);
    if (!list.some(m => m.id === pv.id)) { pv.id = list[0]?.id || ''; pv.tab = ''; pv.hid = ''; }
    const m = list.find(x => x.id === pv.id), role = roleOf(pv.k), tabs = TABS[role] || [];
    if (!tabs.some(t => t[0] === pv.tab)) pv.tab = tabs[0]?.[0] || '';
    const kindL = KINDS.find(x => x[0] === pv.k)[1];
    const head = `<div class="card"><div class="bar" style="margin:0">
        <label style="margin:0">النوع<select data-pvk style="width:auto">${KINDS.map(([k, l, f]) => `<option value="${k}" ${k === pv.k ? 'selected' : ''}>${l} (${f().length})</option>`).join('')}</select></label>
        <label style="margin:0;flex:1 1 16rem">الشخص<select data-pvid>${list.map(x => `<option value="${esc(x.id)}" ${x.id === pv.id ? 'selected' : ''}>${esc(optLabel(pv.k, x))}</option>`).join('')}</select></label></div>
      <p class="muted" style="font-size:.85rem;margin:.6rem 0 0">للاطلاع فقط: الأزرار معطّلة فلا يُسجَّل شيء باسمه. ما يظهر هنا هو ما تعرضه له صفحات التطبيق من البيانات المتاحة له.</p></div>`;
    if (!m) return head + `<div class="card">${empty(`لا يوجد ${kindL} بعد.${pv.k === 'gsup' ? ' اجعل مشرفًا «مشرفًا عامًا» من زر «النطاق».' : pv.k === 'placeadmin' ? ' أنشئه من «الأعضاء ← الإداريون» أو صنّفه من «غير مصنف».' : ''}`)}</div>`;
    const warn = blockedNote(role, m) || (pv.k === 'placeadmin' && !(m.info?.places || []).length ? 'لم يُحدَّد لهذا الإداري مكان بعد، فلن يرى حلقات.' : '') || (CLOUD && !m.hasLogin ? 'ليس له حساب دخول بعد، فلا يستطيع الدخول حتى يُنشأ له.' : '');
    const bar = `<div class="pvtabs">${tabs.map(([k, l]) => `<button type="button" class="${k === pv.tab ? 'on' : ''}" data-pvtab="${k}"><span class="ti">${tabIcon(k)}</span>${esc(l)}</button>`).join('')}</div>`;
    return head + `<div class="pvframe"><div class="pvtop"><b>${esc(m.name)}</b><span class="tag">${esc(kindL)}</span><span class="grow"></span><small>${esc(db.settings.org || '')}</small></div>
      ${warn ? `<div class="note" style="margin:.6rem .8rem 0;color:var(--red)">${esc(warn)}</div>` : ''}${bar}<div class="pvbody">${asPerson(role, m, pv.tab)}</div></div>`;
  }
  adminViews.preview = view;

  /* إطار المعاينة، والتعطيل: كل الأزرار والخانات لا تستجيب عدا ما يُعرض فقط */
  const css = document.createElement('style');
  css.textContent = `.pvframe{border:2px solid var(--navy);border-radius:18px;overflow:hidden;background:var(--bg);margin-bottom:1rem}
    .pvtop{display:flex;align-items:center;gap:.5rem;background:var(--navy);color:var(--on-navy);padding:.6rem .9rem}.pvtop .tag{background:rgba(255,255,255,.18);color:var(--on-navy)}
    .pvtabs{display:flex;gap:.3rem;flex-wrap:wrap;padding:.6rem .8rem 0}
    .pvtabs button{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--line);background:#fff;border-radius:10px;padding:.4rem .7rem;font:inherit;cursor:pointer;color:var(--navy-d)}
    .pvtabs button.on{background:var(--navy);color:var(--on-navy);border-color:var(--navy)}.pvtabs .ti svg{width:16px;height:16px}
    .pvbody{padding:.8rem}
    .pvbody button,.pvbody input,.pvbody textarea,.pvbody label.btn{pointer-events:none}
    .pvbody .btn:not([data-act="hist"]):not([data-act="studentCard"]):not([data-hstu]){opacity:.6}
    .pvbody [data-act="hist"],.pvbody [data-act="studentCard"],.pvbody [data-hstu],.pvbody input[type="date"],.pvbody select{pointer-events:auto}`;
  document.head.appendChild(css);

  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset || {};
    if ('pvk' in d) { pv.k = t.value; pv.id = ''; render(); return; }
    if ('pvid' in d) { pv.id = t.value; pv.tab = ''; pv.hid = ''; render(); return; }
    /* اختيار الحلقة داخل المعاينة يخص المعاينة وحدها */
    if (d.change === 'hid' && t.closest('.pvbody')) { e.stopImmediatePropagation(); pv.hid = t.value; render(); }
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pvtab]'); if (b) { pv.tab = b.dataset.pvtab; render(); }
  });
})();
