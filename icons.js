'use strict';
/* ============ «أيقونات الأزرار»: المدير يغيّر أيقونة أي زر من مكتبة كبيرة ============
   - في «الإعدادات ← الإعدادات» بطاقة فيها الأزرار مجموعات: أقسام القائمة الجانبية، وأزرار صف الطالب، وأزرار أدوات الجداول.
     لكل زر: أيقونته الحالية، و«تغيير» (يفتح المكتبة)، و«الأصلية» (يعيد أيقونته الأصلية).
   - المكتبة: Lucide (مفتوحة المصدر، نحو 1600 أيقونة)، تُحمَّل من الإنترنت عند فتحها فقط (عند المدير)،
     والبحث فيها بالاسم الإنجليزي (مثل book أو user أو calendar).
   - الأيقونة المختارة تُحفظ في الإعدادات (settings.icons = { المفتاح: { n: اسمها، c: أشكالها } })، فتصل كل المستخدمين
     مع المزامنة دون أي تحميل خارجي. تُرسم من قائمة أشكال وخصائص محددة فقط (لا يُدرج نص HTML محفوظ كما هو).
   - التطبيق: بعد كل رسم تُستبدل أيقونة كل زر له أيقونة مختارة، أينما ظهر. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./icons.js')) VFILES.push('./icons.js'); } catch (e) { /* ignore */ } });
  const LIB = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js';
  /* [المفتاح، الاسم، المجموعة، المحدِّد] — الأقسام تُضاف من قوائم الفئات نفسها */
  const ROW = [
    ['r:hist', 'سجل الإنجاز', '[data-act="hist"]'],
    ['r:rec', 'تسجيل تسميع', '[data-act="rec"]'],
    ['r:mnote', 'رسالة / إشعار للطالب', '[data-mnote]:not([data-mnote="*"])'],
    ['r:pay', 'تحصيل', '[data-fee-pay2]:not(.qpaid)'],
    ['r:edit', 'تعديل البيانات', '[data-act="editStudent"]'],
    ['r:move', 'نقل إلى حلقة أخرى', '[data-move]'],
    ['r:more', 'الخيارات (⋮) على الهاتف', '.qsc-mbtn']
  ];
  const TOOLS = [
    ['t:add', 'إضافة (طالب، معلم، عضو)', '.qadd,[data-act="addTeacher"],[data-act="addMember"]'],
    ['t:att', 'الدفتر', '[data-attopen]'],
    ['t:acopen', 'كشوف التحصيل', '[data-acopen]'],
    ['t:feeCfg', 'إعدادات الاشتراك', '[data-fee-cfg],[data-feecfg]'],
    ['t:feeBulk', 'تعيين لنتائج البحث', '[data-fee-bulk],[data-feebulk]'],
    ['t:remind', 'تذكير غير المسددين', '[data-remind-all]'],
    ['t:acc', 'حسابات الدخول', '[data-qacc]'],
    ['t:zoom', 'حجم خط الجدول', '[data-qz]'],
    ['t:save', 'حفظ الجدول (Excel / PDF)', '[data-qsave]'],
    ['t:print', 'الطباعة', '[data-print]'],
    ['t:heads', 'تعديل رؤوس الأعمدة', '[data-heads]'],
    ['t:import', 'استيراد', '[data-act="importMembers"]'],
    ['t:dup', 'الأسماء المتشابهة', '[data-act="dupOpen"]']
  ];
  /* «الرئيسية» عند المدير (dash) وعند غيره (home) زر واحد */
  const TAB_ALIAS = { home: 'dash' };
  function tabList() {
    const seen = new Map();
    Object.values(TABS).forEach(L => (L || []).forEach(([k, l]) => { const key = TAB_ALIAS[k] || k; if (!seen.has(key)) seen.set(key, l); }));
    return [...seen].map(([k, l]) => ['s:' + k, l, null, k]);
  }
  const GROUPS = () => [['أقسام القائمة الجانبية', tabList()], ['أزرار صف الطالب', ROW], ['أزرار أدوات الجداول', TOOLS]];

  /* ===== رسم الأيقونة المحفوظة: أشكال وخصائص محددة فقط ===== */
  const TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
  const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points']);
  const attrEsc = v => String(v).replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);
  const inner = c => (Array.isArray(c) ? c : []).filter(x => Array.isArray(x) && TAGS.has(x[0])).map(([t, a]) =>
    `<${t}${Object.entries(a || {}).filter(([k, v]) => ATTRS.has(k) && /^[-0-9a-zA-Z.,\s]*$/.test(String(v))).map(([k, v]) => ` ${k}="${attrEsc(v)}"`).join('')}/>`).join('');
  const svgOf = (ic, w, h) => `<svg viewBox="0 0 24 24"${w ? ` width="${attrEsc(w)}"` : ''}${h ? ` height="${attrEsc(h)}"` : ''} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-qico>${inner(ic.c)}</svg>`;
  const chosen = () => { const v = db.settings?.icons; return v && typeof v === 'object' ? v : {}; };

  /* الأيقونة الأصلية لكل زر (للعرض في البطاقة): الأقسام من التطبيق نفسه، والأزرار كما رُئيت في الصفحة على هذا الجهاز */
  const ORIG = new Map();
  try { Object.entries(JSON.parse(localStorage.getItem('qico_orig') || '{}')).forEach(([k, v]) => ORIG.set(k, v)); } catch (e) { /* ignore */ }
  let origDirty = false;
  const keepOrig = (key, svg) => { if (!ORIG.has(key) && svg && !svg.hasAttribute('data-qico')) { ORIG.set(key, svg.outerHTML); origDirty = true; } };
  const origOf = key => key.startsWith('s:') ? (typeof tabIcon === 'function' ? tabIcon(key.slice(2)) : '') : (ORIG.get(key) || '');

  /* ===== التطبيق على الصفحة ===== */
  function apply() {
    if (!session) return;
    const C = chosen();
    const put = (key, svg) => {
      if (!svg) return;
      keepOrig(key, svg);
      const ic = C[key];
      if (!ic) { if (svg.hasAttribute('data-qico') && svg.dataset.qk === key) { const o = origOf(key); if (o) svg.outerHTML = o; } return; }
      if (svg.dataset.qk === key && svg.dataset.qn === ic.n) return;
      const t = document.createElement('template'); t.innerHTML = svgOf(ic, svg.getAttribute('width'), svg.getAttribute('height'));
      const n = t.content.firstChild; n.dataset.qk = key; n.dataset.qn = ic.n || '';
      svg.replaceWith(n);
    };
    document.querySelectorAll('nav.tabs button[data-v] .ti').forEach(ti => { const k = ti.closest('button').dataset.v; put('s:' + (TAB_ALIAS[k] || k), ti.querySelector('svg')); });
    /* أيقونة عنوان الصفحة (نسخة من أيقونة القسم المفتوح) */
    const ttl = document.querySelector('.content .top .ttl .qttlico svg');
    if (ttl && ui?.tab) put('s:' + (TAB_ALIAS[ui.tab] || ui.tab), ttl);
    [...ROW, ...TOOLS].forEach(([key, , sel]) => document.querySelectorAll(sel).forEach(b => put(key, b.querySelector(':scope > svg'))));
    if (origDirty) { origDirty = false; try { localStorage.setItem('qico_orig', JSON.stringify(Object.fromEntries(ORIG))); } catch (e) { /* ignore */ } }
  }
  let raf = 0;
  new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; try { apply(); } catch (e) { /* ignore */ } }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* ===== بطاقة «أيقونات الأزرار» في «الإعدادات» ===== */
  const card = () => {
    const C = chosen();
    const prev = (key) => C[key] ? svgOf(C[key], 22, 22) : (origOf(key) || '<small class="muted" title="تظهر هنا بعد أن يُفتح الزر مرة على هذا الجهاز">أصلية</small>');
    return `<div class="card" data-qicocard><h2>أيقونات الأزرار</h2>
      <p class="muted" style="margin:0 0 .7rem">غيّر أيقونة أي زر من مكتبة فيها نحو 1600 أيقونة. التغيير يظهر لكل المستخدمين بعد المزامنة.</p>
      ${GROUPS().map(([g, list]) => `<h3 class="qico-g">${esc(g)}</h3><div class="qico-list">${list.map(([key, label]) => `<div class="qico-row">
        <span class="qico-prev">${prev(key)}</span><span class="qico-l">${esc(label)}</span>
        <button type="button" class="btn sm" data-qico-pick="${esc(key)}">تغيير</button>${C[key] ? `<button type="button" class="btn sm" data-qico-reset="${esc(key)}">الأصلية</button>` : ''}</div>`).join('')}</div>`).join('')}</div>`;
  };
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.settings;
    if (typeof base !== 'function') return;
    adminViews.settings = function () {
      const h = base.apply(this, arguments);
      if (session?.role !== 'admin' || typeof h !== 'string') return h;
      return /class="btn on" data-subtab="settings"/.test(h) ? h + card() : h;
    };
  });
  const setIcon = (key, ic) => {
    const s = db.settings; const all = { ...(s.icons && typeof s.icons === 'object' ? s.icons : {}) };
    if (ic) all[key] = ic; else delete all[key];
    s.icons = all; save(); render();
  };
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-qico-reset]');
    if (r && session?.role === 'admin') { setIcon(r.dataset.qicoReset, null); toast('عادت الأيقونة الأصلية'); return; }
    const p = e.target.closest('[data-qico-pick]');
    if (p && session?.role === 'admin') picker(p.dataset.qicoPick);
  });

  /* ===== المكتبة ===== */
  let libP = null, LIST = null;
  const loadLib = () => libP || (libP = new Promise((ok, no) => {
    if (window.lucide?.icons) { ok(); return; }
    const s = document.createElement('script'); s.src = LIB; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = ok; s.onerror = () => { libP = null; no(new Error('تعذّر تحميل مكتبة الأيقونات (تحقق من الاتصال بالإنترنت)')); };
    document.head.appendChild(s);
  }).then(() => {
    /* بلا تكرار: بعض الأسماء أسماء بديلة لأيقونة واحدة */
    const seen = new Set(); LIST = [];
    Object.entries(window.lucide.icons).forEach(([name, node]) => {
      const c = Array.isArray(node) && Array.isArray(node[2]) ? node[2] : Array.isArray(node) ? node : [];
      const sig = JSON.stringify(c); if (!c.length || seen.has(sig)) return; seen.add(sig);
      LIST.push({ n: name, c, q: name.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase() });
    });
  }));
  const STEP = 240;
  function picker(key) {
    const label = GROUPS().flatMap(g => g[1]).find(x => x[0] === key)?.[1] || key;
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qico-modal"><h2>أيقونة «${esc(label)}»</h2>
      <div class="bar" style="margin:0 0 .5rem"><input type="search" data-qico-q placeholder="ابحث بالاسم الإنجليزي: book, user, calendar…" style="flex:1" dir="ltr" disabled></div>
      <div class="qico-grid" data-qico-grid><p class="muted">جارٍ تحميل المكتبة…</p></div>
      <div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('[data-close]').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    const grid = ov.querySelector('[data-qico-grid]'), q = ov.querySelector('[data-qico-q]');
    let shown = STEP, found = [];
    const draw = () => {
      const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      found = words.length ? LIST.filter(x => words.every(w => x.q.includes(w))) : LIST;
      grid.innerHTML = found.length ? found.slice(0, shown).map((x, i) => `<button type="button" class="qico-cell" data-qico-i="${i}" title="${esc(x.n)}">${svgOf(x, 24, 24)}</button>`).join('')
        + (found.length > shown ? `<button type="button" class="btn sm qico-more" data-qico-more>عرض المزيد (${found.length - shown})</button>` : '')
        : '<p class="muted">لا توجد أيقونة بهذا الاسم.</p>';
    };
    loadLib().then(() => { q.disabled = false; q.focus(); draw(); }, err => { grid.innerHTML = `<p class="muted">${esc(err.message)}</p>`; });
    q.addEventListener('input', () => { shown = STEP; draw(); });
    grid.addEventListener('click', e => {
      if (e.target.closest('[data-qico-more]')) { shown += STEP; draw(); return; }
      const b = e.target.closest('[data-qico-i]'); if (!b) return;
      const x = found[+b.dataset.qicoI]; if (!x) return;
      close(); setIcon(key, { n: x.n, c: x.c }); toast(`تغيّرت أيقونة «${label}»`);
    });
  }

  const css = document.createElement('style');
  css.textContent = `.qico-g{margin:.9rem 0 .4rem;font-size:.95rem}
    .qico-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.35rem .8rem}
    .qico-row{display:flex;align-items:center;gap:.5rem;padding:.3rem .2rem;border-bottom:1px solid var(--line)}
    .qico-prev{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;flex:none}.qico-prev svg{width:22px;height:22px}
    .qico-l{flex:1;min-width:0}
    .qico-modal{max-width:760px}
    .qico-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:.35rem;max-height:55vh;overflow:auto;padding:.2rem}
    .qico-cell{display:flex;align-items:center;justify-content:center;height:52px;border:1px solid var(--line);border-radius:10px;background:var(--card,#fff);color:var(--text);cursor:pointer}
    .qico-cell:hover,.qico-cell:focus-visible{border-color:var(--gold);background:var(--navy-l)}
    .qico-more{grid-column:1/-1;justify-self:center}`;
  document.head.appendChild(css);
  window.QLIcons = { apply, chosen };
})();
