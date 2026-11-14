'use strict';
/* ============ «المعاينة»: يرى المدير التطبيق كما يراه أي حساب ============
   اختر النوع (طالب، معلم، مشرف، مشرف عام، إداري، محاسب) ثم الشخص، فتظهر تبويباته وصفحاته كما تظهر له،
   على شاشة حاسوب أو تابلت أو جوال (إطار بمقاس الجهاز تعمل فيه تنسيقات الشاشات الصغيرة كما على الجهاز نفسه).
   - للاطلاع فقط: الأزرار والخانات معطّلة (عدا التبويبات والقائمة واختيار الحلقة والشهر والتاريخ، وفتح «السجل» و«الملف»)، فلا يُسجَّل شيء باسمه.
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
  const pv = { k: 'teacher', id: '', tab: '', hid: '', dev: 'mobile', doc: '' };
  const DEVS = { desktop: ['الحاسوب', 1366, 820], tablet: ['التابلت', 820, 1100], mobile: ['الجوال', 390, 780] };
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
    const devBar = `<div class="pvdevs">${Object.entries(DEVS).map(([k, [l]]) => `<button type="button" class="btn ${k === pv.dev ? 'on' : ''}" data-pvdev="${k}">${l}</button>`).join('')}</div>`;
    pv.doc = deviceDoc(role, m, tabs, kindL);
    const [, W, H] = DEVS[pv.dev];
    return head + `<div class="card">${devBar}${warn ? `<div class="note" style="margin:.6rem 0 0;color:var(--red)">${esc(warn)}</div>` : ''}
      <div class="pvwrap" data-w="${W}" data-h="${H}"><iframe class="pvif" title="معاينة ${esc(m.name)}" width="${W}" height="${H}"></iframe></div></div>`;
  }
  /* صفحة كاملة داخل الإطار: هيكل التطبيق نفسه (الشريط الجانبي والعلوي) بتنسيقاته، ومحتوى التبويب بهوية الشخص */
  function deviceDoc(role, m, tabs, kindL) {
    const title = (tabs.find(t => t[0] === pv.tab) || ['', ''])[1];
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('');
    const body = asPerson(role, m, pv.tab);
    return `<!doctype html><html lang="ar" dir="rtl" style="${esc(document.documentElement.getAttribute('style') || '')}"><head><meta charset="utf-8"><base href="${esc(location.href)}">${styles}
      <style>html,body{margin:0}main button,main input,main textarea,main label.btn{pointer-events:none}
        main .btn:not([data-act="hist"]):not([data-act="studentCard"]):not([data-hstu]){opacity:.6}
        main [data-act="hist"],main [data-act="studentCard"],main [data-hstu],main input[type="date"],main select{pointer-events:auto}</style></head>
      <body><div class="shell" style="--side-w:250px"><aside class="side"><div class="brand"><img class="hlogo" src="${esc(logoSrc())}" alt=""><div><h1>${esc(db.settings.org || '')}</h1><small>${esc(kindL)}: ${esc(m.name)}</small></div></div>
        <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === pv.tab ? 'on' : ''}" data-v="${k}" title="${esc(l)}"><span class="ti">${tabIcon(k)}</span><span class="tl">${esc(l)}</span></button>`).join('')}</nav></aside>
        <div class="scrim"></div><div class="content"><header class="top"><button type="button" class="iconbtn menu" data-pvmenu aria-label="القائمة">${TAB_ICONS.menu}</button><h2 class="ttl">${esc(title)}</h2></header><main>${body}</main></div></div>
      <script>
        const P = () => parent.QLPv, sh = () => document.querySelector('.shell');
        document.addEventListener('click', e => {
          if (e.target.closest('[data-pvmenu]')) { sh().classList.toggle('open'); return; }
          if (e.target.closest('.scrim')) { sh().classList.remove('open'); return; }
          const t = e.target.closest('nav.tabs [data-v]'); if (t) { P().tab(t.dataset.v); return; }
          const a = e.target.closest('[data-act="hist"],[data-act="studentCard"]'); if (a) { P().act(a.dataset.act, a.dataset.id); return; }
          const h = e.target.closest('[data-hstu]'); if (h) P().act('hstu', h.dataset.hstu);
        });
        document.addEventListener('change', e => { const s = e.target, d = s.dataset; P().change(d.change || ('chal' in d ? 'chal' : 'cmon' in d ? 'cmon' : ''), s.value); });
      <\/script></body></html>`;
  }
  adminViews.preview = view;

  /* إطار الجهاز (التعطيل داخل الإطار نفسه: كل الأزرار والخانات لا تستجيب عدا ما يُعرض فقط) */
  const css = document.createElement('style');
  css.textContent = `.pvdevs{display:flex;gap:.4rem;flex-wrap:wrap}
    .pvwrap{margin-top:.8rem;overflow:hidden;display:flex;justify-content:center}
    .pvif{flex:none;border:10px solid #1f2733;border-radius:22px;background:var(--bg);transform-origin:top center;box-shadow:0 10px 30px rgba(10,18,35,.25)}
`;
  document.head.appendChild(css);

  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset || {};
    if ('pvk' in d) { pv.k = t.value; pv.id = ''; render(); return; }
    if ('pvid' in d) { pv.id = t.value; pv.tab = ''; pv.hid = ''; render(); return; }
  }, true);
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-pvdev]'); if (d) { pv.dev = d.dataset.pvdev; render(); }
  });
  /* ما يُضغط داخل الإطار يصل إلى هنا */
  window.QLPv = {
    tab: k => { pv.tab = k; render(); },
    act: (a, id) => { if (a === 'hstu') halaqaStudents(byId(db.halaqat, id)); else A[a]?.({ id }); },
    change: (k, v) => {
      if (k === 'hid') pv.hid = v;
      else if (k === 'date') ui.date = v;
      else if (k === 'chal' || k === 'cmon') { const el = document.createElement('input'); el.dataset[k] = ''; el.value = v; el.hidden = true; document.body.appendChild(el); el.dispatchEvent(new Event('change', { bubbles: true })); el.remove(); return; }
      else return;
      render();
    }
  };
  /* الإطار بمقاس الجهاز الحقيقي، مصغّرًا ليتسع في الصفحة */
  function fit() {
    const w = document.querySelector('.pvwrap'), f = w?.querySelector('iframe'); if (!w || !f) return;
    if (f.srcdoc !== pv.doc) f.srcdoc = pv.doc;
    const W = +w.dataset.w, H = +w.dataset.h, k = Math.min(1, w.clientWidth / W);
    f.style.transform = `scale(${k})`; w.style.height = Math.ceil(H * k) + 'px';
  }
  window.addEventListener('resize', fit);
  new MutationObserver(() => { if (document.querySelector('.pvwrap iframe:not([srcdoc])')) fit(); }).observe(document.body, { childList: true, subtree: true });
})();
