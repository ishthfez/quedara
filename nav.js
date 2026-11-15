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
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./nav.js')) VFILES.push('./nav.js'); } catch (e) { /* ignore */ } });
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

  /* «الاشتراكات» بلا بحث تعرض حتى 300 طالب دفعة واحدة؛ على الهاتف تكفي 60 حتى يُطلب المزيد (البحث يضيّقها) */
  let feesAll = false, feesN = -1;
  const capFees = feesBase => () => {
    const h = feesBase(), cap = matchMedia('(max-width:860px)').matches ? 60 : 300;
    const i = h.indexOf('<div class="tbl"><table>'), end = i < 0 ? -1 : h.indexOf('</table>', i);
    if (end < 0 || h.indexOf('<div class="tbl"><table>', end) > -1) return h; // العرض المجمّع بالحلقات يبقى كما هو
    const parts = h.slice(i, end).split('<tr>'), N = parts.length - 2;
    if (N !== feesN) { feesAll = false; feesN = N; }
    if (feesAll || N <= cap) return h;
    return h.slice(0, i) + parts.slice(0, 2 + cap).join('<tr>') + '</table></div>'
      + `<p class="muted" style="margin:.6rem 0 0">يظهر أول ${cap} طالبًا. اكتب في مربعات البحث للتضييق، أو <button type="button" class="btn sm" data-feesall>عرض المزيد</button></p>`
      + h.slice(h.indexOf('</div>', end) + 6);
  };
  if (adminViews.fees) adminViews.fees = capFees(adminViews.fees);
  /* والمحاسب كذلك: «الاشتراكات» صفحته الأولى */
  if (VIEWS.accountant?.fees) VIEWS.accountant.fees = capFees(VIEWS.accountant.fees);
  document.addEventListener('click', e => { if (e.target.closest('[data-feesall]')) { feesAll = true; render(); } });
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

  /* ===== سرعة الانتقال بين الأقسام =====
     تثبيت رؤوس الجداول كان يقيس كل جدول ثم يعدّله واحدًا بعد الآخر، فيعيد المتصفح حساب الصفحة كلها مرة لكل جدول
     (في «الأماكن والحلقات» 22 جدولًا ← أكثر من ثانية على الهاتف). صار: كل القياسات أولًا ثم كل التعديلات،
     والجداول القصيرة (أقل من 12 صفًا) لا تحتاج تثبيتًا أصلًا. */
  const LEAD = new Set(['', '#', 'م', 'الكود', 'مسلسل']);
  function fastFreeze() {
    const jobs = [];
    document.querySelectorAll('main .tbl table').forEach(tbl => {
      if (tbl.rows.length < 12) return;
      const { rows, grid, H } = tableGrid(tbl);
      if (!H || H >= rows.length || !grid[H]) return;
      jobs.push({ tbl, rows, grid, H });
    });
    /* القياس: مرة واحدة لكل الجداول */
    jobs.forEach(j => {
      j.w = j.grid[j.H].map(x => x?.td.offsetWidth || 0);
      j.h = j.rows.slice(0, j.H).map(r => r.offsetHeight);
      j.sig = j.rows.length + ':' + j.w.join(',') + ':' + j.h.join(',');
    });
    /* التعديل: بلا أي قياس بينها */
    jobs.forEach(({ tbl, rows, grid, H, w, h, sig }) => {
      if (tbl._frz === sig) return;
      tbl._frz = sig; tbl.classList.add('frz');
      let n = 0; while (n < 3 && grid[0][n] && LEAD.has(grid[0][n].td.textContent.trim())) n++;
      n = Math.min(n + 1, grid[H].length - 1);
      const off = [0]; for (let c = 0; c < n; c++) off.push(off[c] + (grid[H][c]?.cs === 1 ? w[c] : 0));
      let top = 0;
      rows.forEach((tr, ri) => {
        [...tr.cells].forEach(td => { td.classList.remove('stk-h', 'stk-hl', 'stk-c'); td.style.top = td.style.right = ''; });
        if (ri < H) { [...tr.cells].forEach(td => { td.classList.add('stk-h'); td.style.top = top + 'px'; if (ri + (td.rowSpan || 1) >= H) td.classList.add('stk-hl'); }); top += h[ri]; }
      });
      grid.forEach(r => r.forEach(x => { if (x?.first && x.c0 + x.cs <= n) { x.td.classList.add('stk-c'); x.td.style.right = off[x.c0] + 'px'; } }));
    });
  }
  /* ===== كلمة «حلقة» قبل اسم الحلقة في كبسولة، في كل التطبيق =====
     تُلفّ الكلمة فقط حين يليها اسم معلم (أو «بلا معلم»)، فلا تتأثر الجمل مثل «15 حلقة» أو «الحلقة».
     النص نفسه لا يتغير (البحث والتصدير والطباعة كما هي)، والقوائم المنسدلة الأصلية تبقى نصًا. */
  const pcss = document.createElement('style');
  pcss.textContent = `.hpill{display:inline-block;font-size:.78em;line-height:1.55;padding:0 .5em;border-radius:999px;background:color-mix(in srgb,var(--navy,#13294b) 11%,transparent);color:var(--navy,#13294b);font-weight:700;vertical-align:.06em;white-space:nowrap}
    .side .hpill,.pvtop .hpill{background:rgba(255,255,255,.18);color:inherit}`;
  document.head.appendChild(pcss);
  let pillRe = null, pillKey = null; // null: لم يُبنَ بعد (حتى لو لم يوجد معلمون)
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function pillRegex() {
    const names = [...new Set((db.teachers || []).map(t => (t.name || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const key = names.join('|');
    if (key !== pillKey) { pillKey = key; pillRe = new RegExp(`(^|[^\\u0600-\\u06FF])(حلقة)(?= (?:${names.map(escRe).join('|')}${names.length ? '|' : ''}بلا معلم))`, 'g'); }
    return pillRe;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT', 'INPUT', 'TITLE']);
  function pillify(root) {
    if (!root || !session) return;
    const re = pillRegex(), nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.includes('حلقة') && n.parentNode && !SKIP.has(n.parentNode.nodeName) && !n.parentNode.closest?.('.hpill,svg') ? 1 : 2) });
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      re.lastIndex = 0; if (!re.test(n.data)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(n.data))) {
        const at = m.index + m[1].length;
        frag.append(n.data.slice(last, at));
        const sp = document.createElement('span'); sp.className = 'hpill'; sp.textContent = 'حلقة'; frag.append(sp);
        last = at + 4;
      }
      frag.append(n.data.slice(last)); n.replaceWith(frag);
    });
  }
  window.QLPill = pillify;
  let pillQ = new Set(), pillRaf = 0;
  new MutationObserver(ms => {
    ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList?.contains('hpill')) pillQ.add(n); else if (n.nodeType === 3 && n.parentNode) pillQ.add(n.parentNode); }));
    if (pillQ.size && !pillRaf) pillRaf = requestAnimationFrame(() => { const q = [...pillQ]; pillQ = new Set(); pillRaf = 0; q.forEach(el => { if (el.isConnected) pillify(el); }); });
  }).observe(document.body, { childList: true, subtree: true });
  /* ===== اسم التطبيق تحت الشعار في صفحة الدخول (من «الإعدادات ← اسم المؤسسة») ===== */
  const baseLogin = loginView;
  loginView = function () {
    const name = (db.settings?.org || '').trim() || 'إدارة الحلقات القرآنية';
    return baseLogin.apply(this, arguments).replace('<div class="card loginform">', `<h1 class="appname">${esc(name)}</h1><div class="card loginform">`);
  };
  /* «الطلاب»: قائمتا «المكان» و«الحلقة» (البحث المتتابع) بجانب بعضهما في سطر واحد، على الحاسوب والجوال */
  const fcss = document.createElement('style');
  fcss.textContent = `main .card > .bar:has(> .qcombo > [data-fplace])::after{content:'';flex-basis:100%;height:0;order:2}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .btn,main .card > .bar:has(> .qcombo > [data-fplace]) > button{order:1}
    main .card > .bar:has(> .qcombo > [data-fplace]) > select,main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo{order:3}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo{flex:1 1 0;min-width:0;width:auto;max-width:none;margin:0}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo .qcombo-in{min-width:0;width:100%;text-overflow:ellipsis}
    main .card > .bar:has(> .qcombo > [data-fplace]) > select{flex:none;width:auto}
    @media (max-width:600px){main .card > .bar:has(> .qcombo > [data-fplace])::before{content:'';flex-basis:100%;height:0;order:4}
      main .card > .bar:has(> .qcombo > [data-fplace]) > select{order:5}}`;
  document.head.appendChild(fcss);
  const lcss = document.createElement('style');
  lcss.textContent = `.login .logo-wrap{margin-bottom:.6rem}.login .appname{text-align:center;margin:0 0 1.1rem;font-size:clamp(1.25rem,5vw,1.6rem);font-weight:800;color:var(--navy,#13294b);letter-spacing:.01em}`;
  document.head.appendChild(lcss);
  /* ===== التكبير والتصغير في كل جدول، لكل الفئات =====
     جداول الصفحات لها أزرار الحجم من قبل (tables.js)؛ وهنا تُضاف لجداول النوافذ المنبثقة (طلاب الحلقة، بطاقة الموظف، السجل…)
     ولجداول «المعاينة». الحجم واحد لكل الجداول ويُحفظ على الجهاز. */
  const zcss = document.createElement('style');
  zcss.textContent = `.overlay .tbl table{font-size:calc(.95rem * var(--tz,1))}.ztools{display:flex;justify-content:flex-end;gap:.3rem;margin:.2rem 0 .35rem}
    .ztools .btn{width:auto;min-width:34px;padding:0 .45rem;font-weight:700;font-size:.85rem}
    .tzoom .btn,.ztools .btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    @media (max-width:860px),(pointer:coarse){.tblprint .tzoom .btn,.ztools .btn{min-width:44px;min-height:40px;font-size:1rem}}`;
  document.head.appendChild(zcss);
  const zBar = (attr, label) => `<div class="ztools noprint"><button type="button" class="btn sm" ${attr}="-1" title="تصغير النص" aria-label="تصغير النص">أ−</button><button type="button" class="btn sm" ${attr}="0" ${attr === 'data-tz' ? 'data-tzv' : 'data-pvtzv'} title="الحجم الأصلي" aria-label="الحجم الأصلي">${label}</button><button type="button" class="btn sm" ${attr}="1" title="تكبير النص" aria-label="تكبير النص">أ+</button></div>`;
  const zPct = () => Math.round((+getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1) * 100) + '%';
  function zoomify(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('.overlay .tbl:not([data-zm])').forEach(t => {
      if (!t.querySelector('table td')) return;
      t.dataset.zm = '1'; t.insertAdjacentHTML('beforebegin', zBar('data-tz', zPct()));
    });
  }
  new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.classList?.contains('overlay') || n.closest?.('.overlay'))))) requestAnimationFrame(() => zoomify(document)); })
    .observe(document.body, { childList: true, subtree: true });
  /* المعاينة: الإطار صفحة مستقلة؛ تُلفّ كلماته، وتوضع أزرار الحجم فوق جداوله (تكبير داخل الإطار وحده) */
  document.addEventListener('load', e => {
    const f = e.target; if (!f?.classList?.contains('pvif')) return;
    try {
      const d = f.contentDocument; pillify(d.body);
      const cur = () => +d.documentElement.style.getPropertyValue('--tz') || 1;
      d.querySelectorAll('main .tbl').forEach(t => { if (t.querySelector('table td')) t.insertAdjacentHTML('beforebegin', zBar('data-pvtz', Math.round(cur() * 100) + '%')); });
      d.addEventListener('click', ev => {
        const b = ev.target.closest('[data-pvtz]'); if (!b) return;
        const k = +b.dataset.pvtz, z = k ? Math.min(1.8, Math.max(0.7, Math.round((cur() + k * 0.1) * 10) / 10)) : 1;
        d.documentElement.style.setProperty('--tz', z); d.querySelectorAll('[data-pvtzv]').forEach(x => { x.textContent = Math.round(z * 100) + '%'; });
      });
      d.head.insertAdjacentHTML('beforeend', '<style>main [data-pvtz]{pointer-events:auto!important;opacity:1!important}</style>');
    } catch (err) { /* ignore */ }
  }, true);
  /* ===== النوافذ المنبثقة: تمرير لطيف داخل النافذة، ورأس ثابت فيه زر إغلاق ×، وأزرار الحفظ ثابتة أسفلها =====
     - التمرير داخل النافذة وحدها (لا تتحرك الصفحة خلفها ولا «يهرب» التمرير إليها)، والجدول العريض يُمرَّر أفقيًا داخل إطاره.
     - لا تمرير داخل تمرير: الجداول داخل النافذة تأخذ طولها كاملًا وتتمرر مع النافذة.
     - × يغلق النافذة (بزر «إلغاء/إغلاق» نفسه إن وُجد)، ومفتاح Esc كذلك على الحاسوب. */
  const mcss = document.createElement('style');
  mcss.textContent = `html.ql-modal,html.ql-modal body{overflow:hidden}
    .overlay{overscroll-behavior:contain;padding:max(.75rem,env(safe-area-inset-top)) .75rem max(.75rem,env(safe-area-inset-bottom))}
    .modal{max-height:88vh;max-height:88dvh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scroll-padding-top:4rem}
    .modal .tbl{max-height:none!important;overflow-x:auto;overflow-y:visible!important;max-width:100%;border-radius:10px}
    .modal .tbl table{width:max-content;min-width:100%}.modal .tbl th,.modal .tbl td{white-space:nowrap}
    .modal .mhead{position:sticky;top:-1.1rem;z-index:3;display:flex;align-items:center;gap:.6rem;margin:-1.1rem -1.1rem .7rem;padding:.75rem 1.1rem .65rem;background:#fff;border-bottom:1px solid var(--line,#e5e7eb);border-radius:20px 20px 0 0}
    .modal .mhead h2{margin:0;flex:1;min-width:0;font-size:1.12rem;line-height:1.4}
    .modal .mclose{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);color:var(--navy,#13294b);font-size:1.45rem;line-height:1;display:grid;place-items:center;cursor:pointer;padding:0;touch-action:manipulation}
    .modal .mclose:hover{background:var(--navy-l,#eaeef5)}
    .modal > .row:last-child{position:sticky;bottom:-1.1rem;z-index:3;margin:.9rem -1.1rem -1.1rem;padding:.7rem 1.1rem;background:#fff;border-top:1px solid var(--line,#e5e7eb);border-radius:0 0 20px 20px}
    @media (max-width:600px){.overlay{align-items:flex-end;padding-bottom:0}.modal{max-width:100%!important;border-radius:20px 20px 0 0;max-height:92dvh}.modal > .row:last-child{border-radius:0;padding-bottom:max(.7rem,env(safe-area-inset-bottom))}}
    @media print{.modal .mclose{display:none}.modal .mhead,.modal > .row:last-child{position:static;border:0;background:none}}`;
  document.head.appendChild(mcss);
  function dressModal(ov) {
    const m = ov.querySelector(':scope > .modal'); if (!m || m.querySelector(':scope > .mhead')) return;
    const head = document.createElement('div'); head.className = 'mhead';
    const h = m.firstElementChild?.tagName === 'H2' ? m.firstElementChild : null;
    if (h) head.appendChild(h);
    else head.style.cssText = 'justify-content:flex-end;border-bottom:0;padding-bottom:0;margin-bottom:.2rem';
    head.insertAdjacentHTML('beforeend', '<button type="button" class="mclose noprint" aria-label="إغلاق" title="إغلاق">×</button>');
    m.prepend(head);
  }
  const closeTop = () => {
    const ov = [...document.querySelectorAll('.overlay')].pop(); if (!ov) return false;
    const c = ov.querySelector('.modal > .row:last-child [data-close], .modal [data-close]');
    if (c) c.click(); else ov.remove();
    return true;
  };
  document.addEventListener('click', e => { if (e.target.closest('.mclose')) { e.preventDefault(); closeTop(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.overlay')) { e.preventDefault(); closeTop(); } });
  new MutationObserver(() => {
    const ovs = document.querySelectorAll('.overlay');
    document.documentElement.classList.toggle('ql-modal', ovs.length > 0);
    ovs.forEach(dressModal);
  }).observe(document.body, { childList: true });
  /* ===== زر الرجوع (في الجوال والمتصفح) يرجع للسابق بدل الخروج من التطبيق =====
     - كل انتقال بين الأقسام (والتبويبات الداخلية وفئات الأعضاء) يُسجَّل خطوةً في سجل المتصفح.
     - النافذة المنبثقة والقائمة الجانبية على الجوال «طبقة»: الرجوع يغلقها أولًا.
     - في الصفحة الأولى: «اضغط رجوع مرة أخرى للخروج»، والضغطة الثانية خلال ثانيتين تخرج. */
  const NAV = { restoring: false, closing: false, skip: 0, lastBack: 0, booted: false };
  const navKey = () => JSON.stringify({ t: ui.tab, m: ui.msub || '', s: sub });
  const navState = extra => ({ ql: 1, k: navKey(), tab: ui.tab, msub: ui.msub, sub: { ...sub }, ...extra });
  const layerOpen = () => !!(document.querySelector('.overlay') || document.querySelector('.shell.open'));
  const popLayer = () => { if (history.state?.layer) { NAV.skip++; history.back(); } };
  function afterRender() {
    if (!session) return;
    if (!NAV.booted) { NAV.booted = true; history.replaceState(navState({ guard: true }), ''); history.pushState(navState(), ''); return; }
    if (NAV.restoring) { NAV.restoring = false; return; }
    const st = history.state;
    if (st?.layer && !layerOpen()) { history.replaceState(navState(), ''); return; } // طبقة أُغلقت بالانتقال نفسه
    if (st?.ql && !st.layer && !st.guard && st.k !== navKey()) history.pushState(navState(), '');
  }
  window.addEventListener('popstate', e => {
    if (!session) return;
    if (NAV.skip) { NAV.skip--; return; }
    const shell = document.querySelector('.shell.open');
    if (shell) { ui.nav = false; shell.classList.remove('open'); return; }
    const ovs = document.querySelectorAll('.overlay');
    if (ovs.length) { NAV.closing = true; ovs[ovs.length - 1].remove(); setTimeout(() => { NAV.closing = false; }, 0); return; }
    const s = e.state; if (!s?.ql) return;
    if (s.guard) {
      if (Date.now() - NAV.lastBack < 2000) { history.back(); return; }
      NAV.lastBack = Date.now(); toast('اضغط رجوع مرة أخرى للخروج'); history.pushState(navState(), ''); return;
    }
    NAV.restoring = true;
    ui.tab = s.tab; ui.msub = s.msub; ui.nav = false;
    Object.keys(sub).forEach(k => delete sub[k]); Object.assign(sub, s.sub || {}); saveSub(); saveTab();
    render(); window.scrollTo(0, 0);
  });
  /* فتح نافذة منبثقة يضيف طبقة؛ وإغلاقها بزرّها (لا بالرجوع) يسحب طبقتها من السجل */
  new MutationObserver(ms => {
    if (!session || !NAV.booted) return;
    ms.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay') && !NAV.closing) history.pushState(navState({ layer: true }), ''); });
      m.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay') && !NAV.closing) popLayer(); });
    });
  }).observe(document.body, { childList: true });

  /* بعد تحميل كل الملفات (ومنها app-actions.js)، لا بمؤقّت: على الشبكات البطيئة قد يسبق المؤقّتُ تحميلَ الملف التالي */
  document.addEventListener('DOMContentLoaded', () => {
    /* القائمة الجانبية على الجوال طبقة كذلك */
    const baseToggle = A.navToggle, baseClose = A.navClose;
    if (baseToggle) A.navToggle = d => { const was = ui.nav; baseToggle(d); if (!was && ui.nav) history.pushState(navState({ layer: true }), ''); else if (was && !ui.nav) popLayer(); };
    if (baseClose) A.navClose = d => { const was = ui.nav; baseClose(d); if (was) popLayer(); };
    if (typeof freezeTables === 'function' && typeof tableGrid === 'function') freezeTables = fastFreeze;
    const base = render;
    render = function () {
      /* قسم صار تبويبًا: يُفتح القسم الجامع على هذا التبويب */
      if (session?.role === 'admin' && OWNER[ui.tab] && OWNER[ui.tab] !== ui.tab) { sub[OWNER[ui.tab]] = ui.tab; saveSub(); ui.tab = OWNER[ui.tab]; }
      const r = base.apply(this, arguments);
      try { decorate(); } catch (err) { /* لا يعطّل العرض */ }
      try { afterRender(); } catch (err) { /* لا يعطّل العرض */ }
      return r;
    };
    if (session) render();
  });
})();
