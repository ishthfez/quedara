'use strict';
/* ============ تحسينات عامة في الواجهة ============
   1) أيقونة القسم بجانب اسم الصفحة في الشريط العلوي (الأيقونة نفسها التي في القائمة الجانبية).
   2) قوائم الأشهر (كل قائمة خياراتها «سنة-شهر»، أينما كانت): تبدأ من أول شهر فيه بيانات، وما قبله لا يُعرض.
   3) «عدادات الرئيسية» (في «الإعدادات»، للمدير): يختار لكل فئة العدادات التي تظهر لها في «الرئيسية».
      يُحفظ مع الصلاحيات (priv_perms.roles[الفئة]['ui.home.hide.اسم العداد'] = true)، فيصل كل مستخدم ما يخصه من الخادم
      عبر my_perms كبقية الصلاحيات، بلا تعديل على الخادم. للعرض فقط.
   4) جدول «الطلاب» على الهاتف: بطاقة لكل طالب (الاسم والأزرار، ثم الحلقة والحالة، ثم آخر حفظ).
   5) «الطلاب»: لا يتكرر اسم الصفحة عنوانًا للبطاقة، ولا تظهر فيها مربعات العدادات (بطاقة الاشتراكات) لأي عامل.
   6) مواعيد الحلقات مختصرة في كل التطبيق (timeText).
   7) «الإعلانات» تُسمّى «الإشعارات» في الواجهة.
   8) إعادة تحميل الصفحة لا تعيد المستخدم إلى «الرئيسية»، بل إلى صفحته.
   9) زر «تحصيل» بعلامة صح خضراء لمن سدّد اشتراك الشهر المعروض (ويبقى قابلًا للضغط).
   10) عدادات «الرئيسية» قابلة للضغط: نافذة بالتفاصيل أو الصفحة المعنية.
   11) «الطلاب»: المكان والحلقة لا يظهران لمن له مكان واحد أو حلقة واحدة.
   12) «السجل» (الحضور والتسميع) يُسمّى «سجل الإنجاز». */
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
    ['admin', 'Admin', ['المعلمون', 'المشرفون', 'الحلقات', 'الأماكن', 'منتظمون', 'منقطعون', 'حضور اليوم', 'تسجيلات الأسبوع', ...FEE]],
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
    /* «المشرفون والمديرون العامون»: يُحفظ للنوعين، فالمدير العام يقرأ من الخادم roles.gmanager (my_perms بنوعه الحقيقي) */
    const ks = k === 'supervisor' ? ['supervisor', 'gmanager'] : [k], next = { ...pp.roles };
    ks.forEach(kk => {
      const R = { ...(pp.roles[kk] || {}) };
      Object.keys(R).forEach(x => { if (x.startsWith('ui.home.hide.')) delete R[x]; });
      hidden.forEach(l => { R[HK(l)] = true; });
      next[kk] = R;
    });
    pp.roles = next;
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

  /* ===== 4) جدول «الطلاب» على الهاتف: بطاقة لكل طالب =====
     السطر الأول: الاسم وأزرار الصف بجانبه، ثم «الحلقة · الحالة»، ثم «آخر حفظ».
     تُبنى من صفوف الجدول نفسه بعد تطبيق «صلاحيات صفحة الطلاب» (stuperm.js): العمود المخفي لا يظهر، والزر المخفي لا يُنسخ،
     و«يظهر بلا ضغط» يبقى كذلك. الجدول يبقى للحاسوب وللطباعة والتنزيل. */
  /* الهاتف والتابلت: جدول «الطلاب» عريض (أعمدة وأزرار كثيرة) فكان يُمرَّر جانبيًا على التابلت ويخفي «آخر حفظ» والأزرار؛
     البطاقات حتى 1100px، وفي عمودين من 700px */
  const NARROW = () => window.matchMedia('(max-width:1100px)').matches;
  const KEBAB = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  /* قائمة «خيارات» في بطاقة الطالب: تبقى داخل الشاشة، وتُغلق بالاختيار منها أو بالضغط خارجها، وواحدة مفتوحة فقط */
  document.addEventListener('toggle', e => {
    const d = e.target; if (!d.matches?.('details.qsc-more') || !d.open) return;
    document.querySelectorAll('details.qsc-more[open]').forEach(x => { if (x !== d) x.open = false; });
    const m = d.querySelector('.qsc-menu'); m.style.transform = '';
    const r = m.getBoundingClientRect(), W = document.documentElement.clientWidth, H = window.innerHeight;
    const dx = r.right > W - 8 ? W - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    const dy = r.bottom > H - 8 ? -(r.height + d.offsetHeight + 8) : 0;
    if (dx || dy) m.style.transform = `translate(${dx}px,${dy}px)`;
  }, true);
  document.addEventListener('click', e => {
    if (e.target.closest?.('.qsc-menu > *')) { const d = e.target.closest('details.qsc-more'); if (d) setTimeout(() => { d.open = false; }, 0); return; }
    document.querySelectorAll('details.qsc-more[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
  });
  const hidden = el => !el || getComputedStyle(el).display === 'none' || el.style.display === 'none';
  const cloneLive = el => {   // نسخة تحمل حالة «يظهر بلا ضغط» كما هي في الجدول
    const c = el.cloneNode(true), cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none') c.style.cssText += ';pointer-events:none;cursor:not-allowed;opacity:' + cs.opacity + ';filter:' + cs.filter;
    return c;
  };
  function stuCards() {
    if (!session || ui.tab !== 'students') return;
    document.querySelectorAll('main .card .tbl > table').forEach(tbl => {
      const head = tbl.rows[0]; if (!head) return;
      const H = [...head.cells].map(c => c.textContent.trim()), ix = n => H.indexOf(n);
      if (ix('الاسم') < 0 || (ix('الحلقة') < 0 && ix('الحالة') < 0)) return;
      /* بصمة الجدول: تتغير متى أُضيف صف أو زر (بعض الملفات تحوّل الأزرار إلى أيقونات بعد العرض)، أو أُخفي عمود أو زر بالصلاحيات */
      const r1 = tbl.rows[1], rN = tbl.rows[tbl.rows.length - 1];
      const vis = r => (r ? [...r.querySelectorAll('td, td > *, button, select')].map(e => (hidden(e) ? 0 : 1)).join('') : '');
      /* محتوى الخلايا دون سماتها: تثبيت عمود الاسم (stk-c وموضعه) يغيّر سمات الخلية فقط، فلا يعيد بناء البطاقات */
      const inner = r => (r ? [...r.cells].reduce((a, c) => a + c.innerHTML.length, 0) : 0);
      const wrap = tbl.parentElement, sig = [tbl.rows.length, H.join(','), inner(r1), inner(rN), vis(r1), (r1?.textContent || '').slice(0, 30), tbl.querySelectorAll('tr.pgx').length].join('|');
      /* البطاقات بعد الجدول، وقد يفصل بينهما سطر «عرض المزيد» (pager.js): يُبحث في الإخوة التالية حتى الجدول التالي،
         وتُحذف أي نسخة زائدة (كانت تُبنى نسخة ثانية فتظهر القائمة مرتين) */
      const found = [];
      for (let n = wrap.nextElementSibling; n && !n.classList.contains('tbl'); n = n.nextElementSibling) if (n.classList.contains('qscards')) found.push(n);
      let box = found.shift() || null;
      found.forEach(x => x.remove());
      if (box && box.dataset.sig === sig) return;
      const cell = (r, n) => { const i = ix(n); const c = i > -1 ? r.cells[i] : null; return c && !hidden(c) ? c : null; };
      const act = H.length - 1;   // عمود الأزرار بلا عنوان في آخر الصف
      /* تُبنى البطاقات خارج الصفحة ثم تُضاف مرة واحدة: قراءة التنسيق (getComputedStyle) بعد كل إضافة
         كانت تعيد حساب تنسيق الصفحة كلها لكل طالب (ثوانٍ على الهاتف) */
      const frag = document.createDocumentFragment();
      [...tbl.rows].slice(1).forEach(r => {
        if (!r.cells.length || r.classList.contains('sum')) return;
        const nm = cell(r, 'الاسم'); if (!nm) return;
        const card = document.createElement('div'); card.className = r.classList.contains('pgx') ? 'qsc pgx' : 'qsc';   // ما أخفاه «المزيد» (pager.js) يُخفى من البطاقات أيضًا
        const top = document.createElement('div'); top.className = 'qsc-t';
        const name = document.createElement('div'); name.className = 'qsc-n'; [...nm.childNodes].forEach(n => name.appendChild(n.nodeType === 1 ? cloneLive(n) : n.cloneNode(true)));
        /* أزرار الصف كلها في زر «خيارات» واحد (⋮) يفتح قائمة بأسمائها، بدل صف أزرار بجانب الاسم */
        const btns = document.createElement('div'); btns.className = 'qsc-a';
        const all = H[act] === '' && r.cells[act] && !hidden(r.cells[act]) ? [...r.cells[act].children].filter(b => !hidden(b)).map(cloneLive) : [];
        /* «تحصيل» خارج القائمة، عن يمين زر الخيارات (أول الصف في الاتجاه من اليمين) */
        const pay = all.find(b => b.matches('[data-fee-pay2]')), list = all.filter(b => b !== pay);
        if (pay) btns.appendChild(pay);
        if (list.length) {
          const dt = document.createElement('details'); dt.className = 'qsc-more';
          dt.innerHTML = `<summary class="btn qsc-mbtn" title="خيارات" aria-label="خيارات">${KEBAB}</summary>`;
          const menu = document.createElement('div'); menu.className = 'qsc-menu';
          list.forEach(b => { const l = (b.getAttribute('title') || b.getAttribute('aria-label') || '').trim(); if (l && !b.textContent.trim()) b.insertAdjacentHTML('beforeend', `<span class="qsc-ml">${esc(l)}</span>`); menu.appendChild(b); });
          dt.appendChild(menu); btns.appendChild(dt);
        }
        top.append(name, btns); card.appendChild(top);
        const l2 = document.createElement('div'); l2.className = 'qsc-m';
        const hal = cell(r, 'الحلقة'), st = cell(r, 'الحالة');
        if (hal && hal.textContent.trim()) l2.append(document.createTextNode('حلقة ' + hal.textContent.trim().replace(/^حلقة\s+/, '')));
        if (st) { if (l2.childNodes.length) l2.append(document.createTextNode(' · ')); [...st.childNodes].forEach(n => { if (n.nodeType !== 1 || !hidden(n)) l2.appendChild(n.nodeType === 1 ? cloneLive(n) : n.cloneNode(true)); }); }
        if (l2.childNodes.length) card.appendChild(l2);
        const hf = cell(r, 'آخر حفظ');
        if (hf && hf.textContent.trim() && hf.textContent.trim() !== '—') { const l3 = document.createElement('div'); l3.className = 'qsc-m'; l3.textContent = 'آخر حفظ: ' + hf.textContent.trim().replace(/^سورة\s+/, ''); card.appendChild(l3); }
        frag.appendChild(card);
      });
      if (!box) { box = document.createElement('div'); box.className = 'qscards'; wrap.after(box); }
      box.dataset.sig = sig;
      box.replaceChildren(frag);
    });
  }

  /* ===== 5) «الطلاب»: عنوان البطاقة يكرر اسم الصفحة الذي في الشريط العلوي، فيُخفى على الشاشة (ويبقى في الطباعة) ===== */
  function dupTitle() {
    /* ولا مربعات عدادات (بطاقة الاشتراكات التي في «الرئيسية») داخل «الطلاب» لأي عامل */
    document.body.classList.toggle('qtab-stu', !!session && ui.tab === 'students');
    if (!session || ui.tab !== 'students') return;
    const t = (document.querySelector('.content .top .ttl')?.textContent || '').trim();
    if (!t) return;
    document.querySelectorAll('main .card .bar > h2:not(.qdupttl)').forEach(h => {
      const x = h.cloneNode(true); x.querySelectorAll('.muted').forEach(m => m.remove());   // بلا العدد «(…)»
      if (x.textContent.trim() === t) h.classList.add('qdupttl');
    });
  }

  /* ===== 6) مواعيد الحلقات مختصرة في كل التطبيق: «المغرب - العشاء»، «12:00 - 05:00» (بدل «من بعد صلاة … إلى صلاة …») ===== */
  const hh = t => { if (!t) return ''; const [H, M] = String(t).split(':').map(Number); return `${String(((H + 11) % 12) + 1).padStart(2, '0')}:${String(M || 0).padStart(2, '0')}`; };
  try {
    timeText = function (h) {
      const w = h?.time;
      if (!w) return h?.schedule || '';
      if (w.mode === 'clock') return w.from && w.to ? `${hh(w.from)} - ${hh(w.to)}` : '';
      const to = w.toKind === 'clock' ? hh(w.toTime) : (w.toPrayer || '');
      return w.fromPrayer ? (to ? `${w.fromPrayer} - ${to}` : `بعد ${w.fromPrayer}`) : '';
    };
  } catch (e) { /* ignore */ }

  /* ===== 7) «الإعلانات» تُسمّى «الإشعارات» (وكل «إعلان» «إشعار») في الواجهة كلها =====
     للعرض فقط: أسماء التبويبات والعناوين والأزرار والرسائل. نص الإعلان الذي كتبه صاحبه لا يُمسّ، ولا البيانات ولا الخادم. */
  const NW = 'إعلان', NW2 = 'إشعار';
  try { Object.values(TABS).forEach(l => (l || []).forEach(t => { if (t[0] === 'news') t[1] = 'الإشعارات'; })); } catch (e) { /* ignore */ }
  document.addEventListener('DOMContentLoaded', () => { try { Object.values(TABS).forEach(l => (l || []).forEach(t => { if (t[0] === 'news') t[1] = 'الإشعارات'; })); } catch (e) { /* ignore */ } });
  const userText = p => !p || p.closest('textarea,script,style,.qnl-t,[contenteditable]') || p.classList.contains('news');
  const relabel = root => {
    if (!root || (root.nodeType === 1 ? !root.textContent.includes(NW) && !root.querySelector?.(`[title*="${NW}"],[placeholder*="${NW}"],[aria-label*="${NW}"]`) : !String(root.nodeValue || '').includes(NW))) return;
    if (root.nodeType === 3) { if (!userText(root.parentElement)) root.nodeValue = root.nodeValue.replaceAll(NW, NW2); return; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.nodeValue.includes(NW) && !userText(n.parentElement)) n.nodeValue = n.nodeValue.replaceAll(NW, NW2);
    root.querySelectorAll?.(`[title*="${NW}"],[placeholder*="${NW}"],[aria-label*="${NW}"]`).forEach(e => ['title', 'placeholder', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v && v.includes(NW)) e.setAttribute(a, v.replaceAll(NW, NW2)); }));
  };
  new MutationObserver(ms => { try { ms.forEach(m => m.addedNodes.forEach(relabel)); } catch (e) { /* ignore */ } }).observe(document.documentElement, { childList: true, subtree: true });

  /* ===== 12) «السجل» (الحضور والتسميع) يُسمّى «سجل الإنجاز»: تبويب الطالب، وزر صف الطالب، ونافذته، وصلاحياته ===== */
  const HIST = 'سجل الإنجاز';
  const histTabs = () => { try { Object.values(TABS).forEach(l => (l || []).forEach(t => { if (t[0] === 'hist') t[1] = HIST; })); } catch (e) { /* ignore */ } };
  histTabs();
  document.addEventListener('DOMContentLoaded', () => {
    histTabs();
    try { A.hist = d => openInfo(HIST + ': ' + sName(d.id), historyTable(d.id)); } catch (e) { /* ignore */ }
    /* صفحة الطالب: اسمها في الشريط العلوي، فلا يتكرر عنوانًا للبطاقة */
    try { studentViews.hist = () => `<div class="card">${historyTable(session.id)}</div>`; } catch (e) { /* ignore */ }
    try { (window.QLStuPerm?.ITEMS || []).forEach(i => { if (i[0] === 'r_hist' || i[0] === 'a_hist') i[1] = HIST; }); } catch (e) { /* ignore */ }
  });
  function histLabels() {
    document.querySelectorAll('[data-act="hist"]').forEach(b => {
      ['title', 'aria-label'].forEach(a => { const v = b.getAttribute(a); if (v && /^السجل/.test(v)) b.setAttribute(a, HIST); });
      b.childNodes.forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim() === 'السجل') n.nodeValue = HIST; });
      b.querySelectorAll('.qsc-ml').forEach(s => { if (/^السجل/.test(s.textContent)) s.textContent = HIST; });
    });
  }

  const css = document.createElement('style');
  css.textContent = `@media screen{main .bar > h2.qdupttl{display:none}}
    body.qtab-stu main .card.feecard{display:none!important}
    /* العدادات: لا ينكسر اسم العداد أبدًا؛ ما لا يتسع في صفه ينزل إلى سطر وحده بعرض المربع */
    main .qfrow,main .qhgrid .qfrow{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--qmin,150px)),1fr))!important;gap:.5rem}main .qfrow>.feerow{min-width:0;margin:0}
    main .feerow>span,main .feerow>b{white-space:nowrap}main .qfrow>.feerow.qfpct{grid-column:1/-1}
    main .feerow.qstack{flex-direction:column;align-items:flex-start;gap:.2rem}main .feerow.qstack>*{max-width:100%}
    main .qscopeoff{display:none!important}
    main .feerow[data-qgo]{cursor:pointer;transition:filter .15s}main .feerow[data-qgo]:hover{filter:brightness(.96)}main .feerow[data-qgo]:focus-visible{outline:2px solid var(--navy);outline-offset:2px}
    main .btn.qpaid,main .btn.qpaid.primary{background:#e3f4e1!important;color:#1f7a2e!important;border-color:#9fd39a!important}
    html.qdark main .btn.qpaid,html.qdark main .btn.qpaid.primary{background:color-mix(in srgb,#2e9e45 28%,#0e141d)!important;color:#8fd18a!important;border-color:color-mix(in srgb,#2e9e45 55%,#0e141d)!important}
    .content .top .ttl{display:flex;align-items:center;gap:.5rem}.qttlico{display:inline-flex;flex:none}.qttlico svg{width:22px;height:22px}
    .qhcl{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.1rem .8rem}.qhcl label{margin:.15rem 0}
    .qscards{display:none}
    @media (min-width:700px) and (max-width:1100px){
      .qscards{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:1.4rem}
      .qscards .qsc{border-top:0!important;border-bottom:1px solid var(--line,#eee6d6)}
    }
    @media (max-width:1100px){
      main .card .tbl:has(~ .qscards){display:none!important}
      .qscards{display:block}
      .qsc.pgx{display:none}
      .qsc{padding:.6rem .15rem;border-top:1px solid var(--line,#eee6d6)}.qscards .qsc:first-child{border-top:0}
      .qsc-t{display:flex;align-items:flex-start;gap:.5rem}.qsc-n{flex:1;min-width:0;font-weight:700}.qsc-n .who{gap:.45rem}
      .qsc-a{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.3rem;max-width:58%}.qsc-a .btn{padding:.22rem .55rem!important;min-height:0!important;font-size:.8rem;margin:0!important}
      .qsc-a .btn.qri{display:inline-flex;align-items:center;justify-content:center;height:31px}.qsc-a .btn.qri svg{width:17px;height:17px;display:block;flex:none}
      .qsc-more{position:relative}.qsc-more>summary{list-style:none;cursor:pointer}.qsc-more>summary::-webkit-details-marker{display:none}
      .qsc-a .qsc-mbtn{width:38px;height:34px;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border-radius:10px}
      .qsc-a{flex-wrap:nowrap!important;align-items:center}.qsc-a>.btn[data-fee-pay2]{width:38px;height:34px;padding:0!important;border-radius:10px}
      .qsc-menu{position:absolute;z-index:30;inset-inline-end:0;top:calc(100% + 4px);min-width:12rem;display:flex;flex-direction:column;gap:.25rem;padding:.4rem;background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(10,18,35,.18)}
      .qsc-a .qsc-menu .btn{width:100%;justify-content:flex-start;gap:.55rem;display:flex!important;align-items:center;height:auto!important;padding:.5rem .65rem!important;font-size:.9rem!important;text-align:start}
      .qsc-a .qsc-menu .btn svg{flex:none}.qsc-ml{flex:1;white-space:nowrap}.qsc-menu{width:max-content;max-width:calc(100vw - 24px)}
      .qsc-m{font-size:.85rem;color:var(--muted);margin-top:.25rem;line-height:1.6}.qsc-m .btn{padding:.05rem .5rem!important;min-height:0!important;font-size:.78rem;margin:0!important}
    }`;
  document.head.appendChild(css);

  /* ===== 9) زر «تحصيل» لمن سدّد اشتراك الشهر المعروض: علامة صح خضراء، ويبقى قابلًا للضغط لإضافة شهر آخر ===== */
  const CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function markPaid() {
    if (!session || ui.tab !== 'students') return;
    const F = window.QLFees; if (!F || !Array.isArray(F.unpaid)) return;
    const un = new Set(F.unpaid);
    document.querySelectorAll('main .tbl [data-fee-pay2]:not([data-qpaid])').forEach(b => {
      const s = byId(db.students, b.dataset.feePay2);
      if (!s || b.disabled || un.has(s.id) || (typeof stOff === 'function' && stOff(s))) return;
      b.dataset.qpaid = '1'; b.classList.add('qpaid'); b.innerHTML = CHECK;
      b.title = 'مسدَّد — اضغط لتحصيل شهر آخر'; b.setAttribute('aria-label', b.title);
    });
  }
  /* ===== 10) عدادات «الرئيسية» قابلة للضغط: نافذة بالتفاصيل (المشرفون) أو الانتقال إلى الصفحة المعنية ===== */
  const STU = ['عدد الطلاب', 'تسميع اليوم', 'غياب هذا الشهر', 'تسجيلات الأسبوع', 'بانتظار موافقة النقل', 'طلبات نقل بانتظار موافقتك', 'طلبات النقل', ...FEE.slice(1)];
  const ATT = ['حضور اليوم', 'لم يُسجَّل حضورهم اليوم', 'حلقات سُجّل حضورها اليوم'];
  const hasTab = v => (TABS[session?.role] || []).some(t => t[0] === v);
  function target(l) {
    if (l === 'منقطعون') return { tab: 'students', sel: '[data-sstfv="off"]' };
    if (l === 'منتظمون' || l === 'الطلاب المنتظمون') return { tab: 'students', sel: '[data-sstfv="on"]' };
    if (ATT.includes(l)) return { tab: 'students', sel: 'main [data-attopen]' };
    if (STU.includes(l)) return { tab: 'students' };
    if (l === 'المعلمون' || l === 'المعلمون العاملون') return { tab: 'teachers', sel: '[data-subtab="teachers"]' };
    if (l === 'الحلقات' || l === 'الأماكن') return { tab: hasTab('halaqat') ? 'halaqat' : 'students' };
    if (l === 'المشرفون') return { modal: supModal };
    if (l === 'غياب المعلمين هذا الشهر') return hasTab('absence') ? { tab: 'absence' } : { tab: 'teachers', sel: '[data-subtab="absence"]' };   // «العاملون ← الغياب»
    if (l === 'كشوف بانتظار المراجعة') { const t = (TABS[session.role] || []).find(x => /تحصيل المعلمين/.test(x[1])); return t ? { tab: t[0] } : null; }
    if (['نسبة حضوري', 'أيام الغياب', 'تسميعاتي', 'آخر حفظ'].includes(l)) return { tab: hasTab('hist') ? 'hist' : 'me' };
    return null;
  }
  const usable = g => g && (g.modal || hasTab(g.tab) || (session.role === 'admin' && g.tab === 'teachers'));
  function supModal() {
    const S = (db.supervisors || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const rows = S.map(s => { const H = db.halaqat.filter(h => h.supervisorId === s.id), ids = new Set(H.map(h => h.id));
      return `<tr><td>${esc(s.name)}${s.info?.scope === 'all' ? ' <span class="tag tag-ok">مدير عام</span>' : ''}</td><td>${H.length}</td><td>${new Set(H.map(h => h.placeId).filter(Boolean)).size}</td><td>${db.students.filter(x => ids.has(x.halaqaId) && !stOff(x)).length}</td></tr>`; }).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>المشرفون (${S.length})</h2>${S.length ? `<div class="tbl"><table><tr><th>المشرف</th><th>الحلقات</th><th>الأماكن</th><th>الطلاب المنتظمون</th></tr>${rows}</table></div>` : empty('لا يوجد مشرفون.')}<div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }
  /* العدادات المتجاورة بعرض واحد: عرض العمود = عرض أعرض عداد في مجموعته (لا ينكسر اسمه)، وما لا يتسع ينزل إلى سطر وحده */
  function evenCounters() {
    document.querySelectorAll('main .qfrow').forEach(row => {
      const F = [...row.children].filter(f => f.classList.contains('feerow') && !f.classList.contains('qfpct') && f.style.display !== 'none');
      if (!F.length) return;
      let w = 0; const RW = row.clientWidth;
      F.forEach(f => { f.classList.remove('qstack'); const cs = getComputedStyle(f); let s = parseFloat(cs.paddingInlineStart || cs.paddingLeft) + parseFloat(cs.paddingInlineEnd || cs.paddingRight) + 2;
        [...f.children].forEach(c => { s += c.scrollWidth; }); s += (f.children.length - 1) * (parseFloat(cs.columnGap) || 8) + 12;
        /* عداد أطول من عرض المربع: الرقم تحت الاسم (لا يخرج عن المربع ولا ينكسر الاسم) */
        if (s > RW) { f.classList.add('qstack'); s = RW; }
        w = Math.max(w, s); });
      /* عدد الأعمدة صريحًا: ما يتسع من أعرض عداد (ولا يزيد على عدد العدادات)، فتمتلئ الأعمدة العرض كله */
      const gap = parseFloat(getComputedStyle(row).columnGap) || 8;
      const cols = Math.max(1, Math.min(F.length, Math.floor((row.clientWidth + gap) / (Math.ceil(w) + gap))));
      const tpl = `repeat(${cols},minmax(0,1fr))`; if (row.style.gridTemplateColumns !== tpl) row.style.setProperty('grid-template-columns', tpl, 'important');
      /* آخر عداد إن بقي وحده في سطره يمتد ليملأه؛ اثنان فأكثر يبقون بعرض واحد */
      F.forEach(f => { f.style.gridColumn = ''; });
      if (cols > 1 && F.length % cols === 1) F[F.length - 1].style.gridColumn = '1 / -1';
    });
  }
  /* مربعات «الرئيسية» (الحلقات، الطلاب، اليوم…): المربع الذي بقي وحده في سطره وبجانبه فراغ يمتد ليملأ السطر،
     ومتى جاءه مربع آخر في سطره عاد إلى حجمه بجانبه */
  function spanLone() {
    document.querySelectorAll('main .qhgrid').forEach(g => {
      const K = [...g.children].filter(c => c.style.display !== 'none' && c.offsetParent !== null);
      K.forEach(c => { c.style.gridColumn = ''; });
      const cols = (getComputedStyle(g).gridTemplateColumns || '').split(' ').filter(Boolean).length;
      if (cols > 1 && K.length % cols === 1) K[K.length - 1].style.gridColumn = '1 / -1';
    });
  }
  let evT = 0; window.addEventListener('resize', () => { clearTimeout(evT); evT = setTimeout(() => { try { spanLone(); evenCounters(); } catch (e) { /* ignore */ } }, 120); });
  function homeLinks() {
    if (!session || !['home', 'dash'].includes(ui.tab)) return;
    spanLone(); evenCounters();
    document.querySelectorAll('main .feerow:not([data-qgo])').forEach(f => {
      const l = (f.querySelector('span')?.textContent || '').trim();
      if (!usable(target(l))) return;
      f.dataset.qgo = l; f.setAttribute('role', 'button'); f.tabIndex = 0; f.title = 'عرض التفاصيل';
    });
  }
  const openGo = f => {
    const g = target(f.dataset.qgo); if (!usable(g)) return;
    if (g.modal) { g.modal(); return; }
    want = null; ui.tab = g.tab; ui.nav = false; try { saveTab(); } catch (e) { /* ignore */ }
    render(); window.scrollTo(0, 0);
    if (g.sel) setTimeout(() => { const b = document.querySelector(g.sel); if (b && !b.classList.contains('on')) b.click(); }, 80);
  };
  document.addEventListener('click', e => { const f = e.target.closest?.('main .feerow[data-qgo]'); if (f) openGo(f); });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('main .feerow[data-qgo]')) { e.preventDefault(); openGo(e.target); } });

  /* ===== 11) «الطلاب»: ما يفيد صاحبه فقط =====
     من حلقاته كلها في مكان واحد لا تظهر له قائمة «كل الأماكن» ولا عمود «المكان»، ومن له حلقة واحدة لا تظهر له قائمة «كل الحلقات»
     ولا عمود «الحلقة» (ولا «حلقة …» في بطاقات الهاتف). متى أُضيف له مكان أو حلقة أخرى ظهر ما يخصها. */
  function scopeTrim() {
    if (!session || ui.tab !== 'students') return;
    const H = window.QLStuView?.scopeH?.() || db.halaqat;
    const oneP = new Set(H.map(h => h.placeId || '')).size <= 1, oneH = H.length <= 1;
    const real = s => [...s.options].filter(o => o.value).length;
    const off = (s, on) => (s.closest('.qcombo') || s).classList.toggle('qscopeoff', on);   // القائمة المحسّنة (qcombo) تُخفى بغلافها
    document.querySelectorAll('main select[data-fplace]').forEach(s => off(s, !ui.fp && (oneP || real(s) <= 1)));
    document.querySelectorAll('main select[data-change="fh"]').forEach(s => off(s, !ui.fh && (oneH || real(s) <= 1)));
    if (!oneP && !oneH) return;
    document.querySelectorAll('main .card .tbl > table').forEach(tbl => {
      const head = tbl.rows[0]; if (!head) return;
      const H2 = [...head.cells].map(c => c.textContent.trim());
      const ix = [oneP ? H2.indexOf('المكان') : -1, oneH ? H2.indexOf('الحلقة') : -1].filter(i => i > -1);
      if (!ix.length) return;
      [...tbl.rows].forEach(r => ix.forEach(i => { const c = r.cells[i]; if (c && c.style.display !== 'none') c.style.display = 'none'; }));
    });
  }
  /* ===== الهاتف: الجدول الذي لا يتسع لعرض الشاشة يُعرض صفوفًا مكدّسة (كل صف بطاقة: «العنوان: القيمة») =====
     بدل التمرير الجانبي الذي يخفي أعمدة وأزرارًا (العاملون، حلقات المدير العام، السجل…). يُطبَّق فقط حين يفيض الجدول فعلًا،
     ما عدا كشف المرتبات (جدول إدخال)، وجدول «الطلاب» (له بطاقاته)، و«الدفتر» (attwin.js). العناوين من صف الرأس. */
  const PHONE = () => window.matchMedia('(max-width:640px)').matches;
  /* مربعات الإحصاء (.grid .stat: تقدمي، لوحة المدير…) بشكل عدادات «الرئيسية»: البيان يمينًا والقيمة يسارًا بالحجم نفسه */
  /* زر حالة الطالب: «منتظم» أخضر و«منقطع» أحمر (ولو كان للعرض فقط بلا ضغط) */
  function statColors() {
    document.querySelectorAll('[data-stat]').forEach(b => {
      const t = (b.textContent || '').trim(), on = /منتظم/.test(t), off = /منقطع/.test(t);
      b.classList.toggle('qst-on', on); b.classList.toggle('qst-off', off);
    });
  }
  function statRows() {
    try { statColors(); } catch (e) { /* ignore */ }
    document.querySelectorAll('main .grid:not(.qstatrow)').forEach(g => {
      const S = g.querySelectorAll(':scope > .stat'); if (!S.length) return;
      g.classList.add('qstatrow'); S.forEach(s => { s.classList.add('feerow', 'fr-plain'); if ((s.querySelector('b')?.textContent || '').trim().length > 9) s.classList.add('qstatwide'); });   // قيمة طويلة (آخر موضع حفظ): سطر كامل
    });
  }
  function stackTables() {
    try { statRows(); } catch (e) { /* ignore */ }
    const on = PHONE();
    document.querySelectorAll('main .tbl > table, .overlay .tbl > table').forEach(t => {
      if (!on) { t.classList.remove('qstack'); return; }
      if (t.closest('.qatt') || t.classList.contains('qstack-no') || t.closest('.paytbl') || t.parentElement.matches('.paytbl') || t.parentElement.nextElementSibling?.classList.contains('qscards')) return;
      const head = [...t.rows].find(r => r.querySelector('th') && !r.querySelector('td')); if (!head) return;
      const H = [...head.cells].map(c => (c.textContent || '').trim());
      [...t.rows].forEach(r => { if (r === head) return; [...r.cells].forEach((c, i) => { const l = c.colSpan > 1 ? '' : H[i] || ''; if (c.dataset.l !== l) c.dataset.l = l; }); });
      if (!t.classList.contains('qstack')) { const wrap = t.parentElement; if (t.scrollWidth > wrap.clientWidth + 4) t.classList.add('qstack'); }
    });
  }
  const scss = document.createElement('style');
  scss.textContent = `/* العدادات (الرئيسية وغيرها): القيمة بحجم خط البيان نفسه */
  .feerow:not(#qz0):not(#qz1) > b,.feerow:not(#qz0):not(#qz1) > span{font-size:inherit!important;line-height:1.5}
  .btn[data-stat].qst-on:not(#qz0){background:color-mix(in srgb,#2e9e45 16%,transparent)!important;color:#1f7a3a!important;border:1px solid color-mix(in srgb,#2e9e45 55%,transparent)!important;opacity:1!important;filter:none!important;font-weight:700}
  .btn[data-stat].qst-off:not(#qz0){background:color-mix(in srgb,#c0392b 16%,transparent)!important;color:#b8322a!important;border:1px solid color-mix(in srgb,#c0392b 55%,transparent)!important;opacity:1!important;filter:none!important;font-weight:700}
  html.qdark .btn[data-stat].qst-on:not(#qz0){color:#7fd18a!important}html.qdark .btn[data-stat].qst-off:not(#qz0){color:#ff8a7a!important}
  /* كبسولة «حلقة» بلون واضح */
  .hpill:not(#qz0){background:#c9a35a!important;color:#1f1606!important;font-weight:800!important;opacity:1!important}
  /* البيان بلون (هادئ) والقيمة بلون آخر بحسب نوع العداد */
  .feerow:not(#qz0):not(#qz1) > span:first-child,.grid.qstatrow > .stat.feerow:not(#qz0) > span{color:var(--muted,#6b7280)!important}
  .feerow.fr-ok:not(#qz0):not(#qz1) > b{color:#1f7a3a!important}.feerow.fr-no:not(#qz0):not(#qz1) > b{color:#b8322a!important}
  .feerow.fr-info:not(#qz0):not(#qz1) > b{color:#1f5fa8!important}.feerow.fr-plain:not(#qz0):not(#qz1) > b{color:#9a6a12!important}
  html.qdark .feerow.fr-ok:not(#qz0):not(#qz1) > b{color:#7fd18a!important}html.qdark .feerow.fr-no:not(#qz0):not(#qz1) > b{color:#ff8a7a!important}
  html.qdark .feerow.fr-info:not(#qz0):not(#qz1) > b{color:#8ab4f8!important}html.qdark .feerow.fr-plain:not(#qz0):not(#qz1) > b{color:#e6b96a!important}
  html.qdark .feerow:not(#qz0):not(#qz1) > span:first-child,html.qdark .grid.qstatrow > .stat.feerow:not(#qz0) > span{color:#a5aebb!important}
  .grid.qstatrow{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))!important;gap:.45rem!important}
  .grid.qstatrow > .stat.feerow:not(#qz0){display:flex!important;flex-direction:row-reverse;justify-content:space-between;align-items:center;gap:.4rem;text-align:start!important;border:0!important;border-radius:10px!important;padding:.5rem .65rem!important;margin:0!important;font-size:.82rem!important;min-height:0!important;box-shadow:none!important;background:var(--navy-l,#eef1f6)!important;color:var(--navy,#13294b)!important}
  html.qdark .grid.qstatrow > .stat.feerow:not(#qz0){background:color-mix(in srgb,var(--navy) 28%,#141c28)!important;color:#a5aebb!important}
  .grid.qstatrow > .stat.feerow > b{font-weight:900;margin:0!important;min-width:0;overflow-wrap:anywhere;text-align:end}
  .grid.qstatrow > .stat.feerow > span{font-weight:700;margin:0!important;white-space:nowrap}
  .grid.qstatrow > .stat.feerow.qstatwide{grid-column:1/-1}
  @media (max-width:640px){
    .tbl:has(> table.qstack){overflow:visible!important;max-height:none!important;border:0!important;width:auto!important;max-width:none!important;display:block!important}
    table.qstack,table.qstack > tbody{display:block;width:100%!important;min-width:0!important;border:0}
    .tbl > table.qstack:not(#qz0):not(#qz1){width:100%!important}   /* أقوى من «عرض الجدول بقدر محتواه» (active.js) */
    table.qstack tr:has(> th):not(:has(> td)){display:none}
    table.qstack tr:not(.pgx):not([hidden]):has(> td){display:block;padding:.55rem .25rem;border-bottom:1px solid var(--line,#eee6d6);background:transparent!important}
    table.qstack tr > td{display:flex;align-items:center;justify-content:space-between;gap:.4rem .8rem;flex-wrap:wrap;position:static!important;padding:.2rem 0!important;border:0!important;background:transparent!important;text-align:start!important;white-space:normal!important;min-width:0;box-shadow:none!important}
    table.qstack tr > td::before{content:attr(data-l);flex:0 0 auto;color:var(--muted);font-size:.82rem;font-weight:400}
    table.qstack tr > td[data-l=""]::before{content:none}
    table.qstack tr > td[data-l=""]{justify-content:flex-start}
    table.qstack tr > td:first-child{font-weight:700}
    table.qstack tr.sum > td{font-weight:800}
  }`;
  document.head.appendChild(scss);
  window.matchMedia('(max-width:640px)').addEventListener?.('change', () => { try { stackTables(); } catch (e) { /* ignore */ } });

  const after = () => { try { histLabels(); titleIcon(); applyHome(); trimMonths(); dupTitle(); markPaid(); homeLinks(); scopeTrim(); if (NARROW()) stuCards(); stackTables(); } catch (e) { /* ignore */ } };
  /* ===== 8) إعادة تحميل الصفحة تُبقي المستخدم في الصفحة نفسها =====
     التبويب محفوظ في المتصفح (halaqat_tab)، لكن أول عرض بعد التحميل يأتي قبل اكتمال قائمة الحساب (الصلاحيات، صفحة «الطلاب» للعاملين…)
     فيُعاد إلى «الرئيسية». يُحفظ هنا التبويب المطلوب ويُرجع إليه متى ظهر في القائمة، ما لم ينتقل المستخدم بنفسه أو تمضِ 20 ثانية. */
  let want = null; const wantUntil = Date.now() + 20000;
  try { want = JSON.parse(sessionStorage.getItem('halaqat_tab') || '{}').tab || null; } catch (e) { /* ignore */ }
  document.addEventListener('click', e => { if (e.target.closest?.('[data-act="tab"],[data-act="logout"],[data-act="switchMode"]')) want = null; }, true);
  const restoreTab = () => {
    if (!want || !session) return;
    if (Date.now() > wantUntil) { want = null; return; }
    if (ui.tab !== want && (TABS[session.role] || []).some(t => t[0] === want)) ui.tab = want;
  };
  const baseRender = render;
  render = function () {
    try { restoreTab(); } catch (e) { /* ignore */ }
    const r = baseRender.apply(this, arguments);
    if (want && session && ui.tab === want) { want = null; try { saveTab(); } catch (e) { /* ignore */ } }   // ثبت بعد العرض: انتهت الاستعادة
    after(); return r;
  };
  /* النوافذ والقوائم التي تُفتح بعد العرض (نموذج الدفعة، كشف التحصيل…) */
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; try { histLabels(); trimMonths(); titleIcon(); applyHome(); dupTitle(); markPaid(); homeLinks(); scopeTrim(); if (NARROW()) { stuCards(); setTimeout(() => { try { stuCards(); } catch (e) { /* ignore */ } }, 300); } stackTables(); } catch (e) { /* ignore */ } }); })
    .observe(document.body, { childList: true, subtree: true });
  /* تكبير الشاشة أو تدويرها إلى العرض الضيق */
  window.matchMedia('(max-width:1100px)').addEventListener?.('change', e => { if (e.matches) after(); });
  window.QLUix = { firstMonth, hiddenFor, CATS, stuCards };
})();
