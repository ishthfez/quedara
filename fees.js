'use strict';
/* ============ الاشتراكات: تحصيل اشتراكات الطلاب (للمدير) ============
   بحث حيّ في ثلاثة مربعات: اسم الطالب، أو بداية اسم الحلقة، أو بداية اسم المكان.
   تظهر النتائج أولًا بأول ومعها الحلقة والمكان والاشتراك الشهري وما دُفع عن الشهر المختار.
   كل دفعة سجلّ مستقل: الطالب، والشهر الذي تُدفع عنه، والمبلغ، والتاريخ، ومن حصّلها. */
(() => {
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const t0 = today();
  const st = { y: +t0.slice(0, 4), m: +t0.slice(5, 7), qs: '', qh: '', qp: '', open: new Set() };
  const MAX_ROWS = 300;

  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'payroll') + 1, 0, ['fees', 'الاشتراكات']);
  TAB_ICONS.fees = svg('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6 9.5v6M18 9.5v6"/>');
  adminViews.fees = () => view();
  window.FeesView = () => view();
  /* يُضاف هذا الملف لفحص التحديث التلقائي (القائمة تُعرَّف في app-actions.js الذي يُحمَّل بعده) */
  setTimeout(() => { try { if (!VFILES.includes('./fees.js')) VFILES.push('./fees.js'); } catch (e) { /* ignore */ } }, 0);

  const fees = () => (Array.isArray(db.fees) ? db.fees : (db.fees = []));
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  /* الفئات والخصومات: تُحفظ في الإعدادات بمفتاح خاص لا يقرؤه إلا المدير */
  /* «أيتام» معفى كامل، و«حالات خاصة» تُحدَّد قيمتها لكل طالب على حدة (each) */
  const ORPHAN = { id: 'd_orphan', name: 'أيتام', type: 'pct', value: 100 };
  const DEF_DISCS = [{ id: 'd_tahfeez', name: 'أبناء موظفي التحفيظ', type: 'pct', value: 0 }, { id: 'd_assoc', name: 'أبناء موظفي الجمعية', type: 'pct', value: 0 }, ORPHAN, { id: 'd_special', name: 'حالات خاصة', type: 'pct', value: 0, each: true }];
  const isNum = v => v !== '' && v != null && !isNaN(+v);
  /* المبالغ (العام بنظاميه، والأماكن، والفئات) من كائن إعدادات أو من مبالغ سنة */
  const amountsOf = c => {
    const places = {};
    Object.entries(c?.places && typeof c.places === 'object' ? c.places : {}).forEach(([k, v]) => {
      const g = isNum(v?.general) ? +v.general : null, g3 = isNum(v?.general3) ? +v.general3 : null;
      if (g != null || g3 != null) places[k] = { general: g, general3: g3 };
    });
    return { cats: Array.isArray(c?.cats) ? c.cats : [], general: isNum(c?.general) ? +c.general : null, general3: isNum(c?.general3) ? +c.general3 : null, places };
  };
  /* لكل سنة مبالغها (years): مبالغ السنة المحفوظة لها، وإلا لأقرب سنة قبلها، وإلا لأقرب سنة بعدها، وإلا العامة.
     فتغيير الاشتراك في سنة جديدة لا يغيّر مستحقات ما قبلها. الخصومات واحدة لكل السنوات. */
  const yearsOf = () => { const Y = db.settings.priv_fees?.years; return Y && typeof Y === 'object' ? Y : {}; };
  const pickYear = (Y, y) => {
    const ks = Object.keys(Y).filter(k => /^\d{4}$/.test(k)).map(Number).sort((a, b) => a - b);
    if (!ks.length) return null;
    const k = [...ks].reverse().find(x => x <= y) ?? ks[0];
    return Y[k];
  };
  const cfg = (y = st.y) => { const A = cfgBase(), Y = pickYear(yearsOf(), +y); return Y ? { ...A, ...amountsOf(Y) } : A; };
  const cfgBase = () => {
    const c = db.settings.priv_fees || {};
    let discs = Array.isArray(c.discs) ? c.discs : DEF_DISCS;
    /* إعدادات حُفظت قبل إضافة «أيتام»: يُضاف، و«حالات خاصة» تصبح لكل طالب على حدة */
    if (Array.isArray(c.discs) && !c.v) {
      discs = discs.map(d => (d.id === 'd_special' ? { ...d, each: true } : d));
      if (!discs.some(d => d.id === ORPHAN.id)) discs = [...discs.filter(d => d.id !== 'd_special'), ORPHAN, ...discs.filter(d => d.id === 'd_special')];
    }
    /* الاشتراك العام بنظامي الحضور: general = نظام 6 أيام (الافتراضي)، general3 = نظام 3 أيام */
    /* places: مبالغ تختلف حسب المكان { معرف المكان: { general, general3 } }، والفارغ يأخذ العام */
    return { ...amountsOf(c), discs };
  };
  const discTxt = (d, v, t) => ((t || d.type) === 'amt' ? money(v) + ' جنيه' : v + '%');
  const discLabel = d => (d.each ? `${d.name} (يُحدَّد لكل طالب)` : `${d.name} (${discTxt(d, d.value)})`);
  /* المستحق = (المبلغ الخاص للطالب، أو مبلغ فئته، أو الفئة الافتراضية لسنّه، أو «الاشتراك العام») − الخصم أو الإعفاء */
  function dueOf(s, y) {
    const I = s?.info || {}, C = cfg(y ?? st.y);
    let base = null, src = '';
    if (isNum(I.fee) && +I.fee > 0) { base = +I.fee; src = 'مبلغ خاص'; }
    else {
      const c = C.cats.find(x => x.id === I.feeCat) || C.cats.find(x => x.def === (s.cat === 'adult' ? 'adult' : 'child'));
      if (c) { base = +c.amount || 0; src = c.name; }
      else {
        /* الاشتراك العام: مبلغ مكان الطالب إن حُدّد له مبلغ خاص، وإلا المبلغ العام */
        const pid = halOf(s)?.placeId, P = (pid && C.places[pid]) || {};
        const g6 = P.general ?? C.general, g3 = P.general3 ?? C.general3, three = I.feeSys === '3';
        if (g6 != null || g3 != null) {
          base = three ? (g3 ?? g6) : g6;
          src = (g3 == null && !hasThree(C) ? 'الاشتراك العام' : three ? 'نظام 3 أيام' : 'نظام 6 أيام') + (P.general != null || P.general3 != null ? ` (${placeName(halOf(s)) || 'المكان'})` : '');
          if (base == null) return null;
        }
      }
    }
    if (base == null) return null;
    const d = C.discs.find(x => x.id === I.feeDisc);
    let off = 0, dl = '';
    if (d) {
      const own = isNum(I.feeDiscVal), v = own ? +I.feeDiscVal : (d.each ? 0 : +d.value || 0), t = own ? (I.feeDiscType || d.type) : d.type;
      off = Math.min(base, Math.max(0, t === 'amt' ? v : base * v / 100));
      dl = d.each && !own ? `${d.name} (لم تُحدَّد قيمته)` : `${d.name} (${discTxt(d, v, t)})`;
    }
    return { base, src, off, dl, due: Math.round((base - off) * 100) / 100 };
  }
  const feeOf = (s, y) => dueOf(s, y)?.due ?? null;
  const hasThree = C => C.general3 != null || Object.values(C.places).some(p => p.general3 != null);
  const anyGeneral = C => C.general != null || C.general3 != null || Object.keys(C.places).length > 0;
  window.QLFeeDue = feeOf; // للإيصال: مستحق الطالب للشهر
  const halOf = s => byId(db.halaqat, s.halaqaId);
  /* فهرس المدفوع (طالب|سنة|شهر) يُبنى مرة كلما تغيّرت قائمة الدفعات: آلاف الدفعات × آلاف الطلاب تبقى سريعة */
  let pIdx = new Map(), pAny = new Set(), pRef = null, pLen = -1;
  const pIndex = () => {
    const F = fees(); if (F === pRef && F.length === pLen) return;
    pIdx = new Map(); pAny = new Set(); pRef = F; pLen = F.length;
    F.forEach(f => { const k = f.studentId + '|' + (+f.y) + '|' + (+f.m); pIdx.set(k, (pIdx.get(k) || 0) + (+f.amount || 0)); pAny.add(f.studentId); });
  };
  const paidFor = (sid, y, m) => { pIndex(); return pIdx.get(sid + '|' + (+y) + '|' + (+m)) || 0; };
  /* «بداية الاسم»: يطابق أول الاسم أو أول أي كلمة فيه */
  const starts = (text, q) => norm(text).startsWith(q) || String(text || '').split(/\s+/).some(w => norm(w).startsWith(q));
  const monthOpts = (y, m) => {
    const out = [];
    for (let k = -12; k <= 2; k++) { const d = new Date(st.y, st.m - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1; out.push({ v: `${yy}-${mm}`, l: `${MONTHS[mm - 1]} ${yy}`, sel: yy === y && mm === m }); }
    return out;
  };
  const cloudMissing = () => CLOUD && window.Cloud?.feesReady === false;
  /* الأزرار بحسب الصلاحية: المدير كل شيء، والمحاسب (أو من مُنح) بحسب صلاحياته */
  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  const isAdmin = () => session?.role === 'admin';

  /* كل كلمات البحث موجودة في النص (بأي ترتيب) — كما في قوائم الاقتراحات */
  const has = (txt, q) => { if (!q || !q.trim()) return true; const t = norm(txt); return norm(q).split(' ').filter(Boolean).every(w => t.includes(w)); };
  const halOk = h => (has(halaqaLabel(h), st.qh) || has(h.name, st.qh)) && has(placeName(h), st.qp);
  function filtered() {
    return db.students.filter(s => {
      if (!has(s.name, st.qs)) return false;
      if (!st.qh.trim() && !st.qp.trim()) return true;
      const h = halOf(s); return !!h && halOk(h);
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }
  function results() {
    const list = filtered();
    let expected = 0, got = 0, paidN = 0, partN = 0, noneN = 0, freeN = 0, offN = 0;
    const grouped = !!(st.qh.trim() || st.qp.trim());
    const row = (s, i) => {
      const D = dueOf(s), fee = D?.due ?? null, paid = paidFor(s.id, st.y, st.m), h = halOf(s), off = stOff(s);
      const state = off ? `<span class="tag tag-no">منقطع</span>${paid ? ' <small class="muted">دفع ' + money(paid) + '</small>' : ''}` : fee === 0 ? '<span class="tag tag-ok">معفى</span>'
        : fee ? (paid >= fee ? '<span class="tag tag-ok">مسدَّد ✓</span>' : paid > 0 ? `<span class="tag">جزئي: باقٍ ${money(fee - paid)}</span>` : '<span class="tag tag-no">لم يُسدَّد</span>')
        : (paid > 0 ? '<span class="tag tag-ok">مدفوع</span>' : '<span class="muted">بلا اشتراك محدد</span>');
      const C0 = cfg(), I0 = s.info || {};
      const anyGen = anyGeneral(C0), fromGen = !D || /^(نظام|الاشتراك العام)/.test(D.src);
      /* نظام الحضور (6 أو 3 أيام) بجانب الطالب، حين يكون له مبلغان مختلفان ويُحسب اشتراكه منه */
      const sysSel = can('fees.amount') && hasThree(C0) && fromGen ? `<select class="mini" data-fsys="${esc(s.id)}" aria-label="نظام الحضور لـ ${esc(s.name)}"><option value="6" ${I0.feeSys !== '3' ? 'selected' : ''}>نظام 6 أيام</option><option value="3" ${I0.feeSys === '3' ? 'selected' : ''}>نظام 3 أيام</option></select>` : '';
      const catCell = can('fees.amount') && C0.discs.length && (D || anyGen)
        ? `${sysSel || `<small class="muted">${esc(D ? D.src : 'الاشتراك العام')}</small>`}<br><select class="mini" data-fdisc="${esc(s.id)}" aria-label="الخصم أو الإعفاء لـ ${esc(s.name)}"><option value="">بلا خصم</option>${C0.discs.map(d => `<option value="${esc(d.id)}" ${I0.feeDisc === d.id ? 'selected' : ''}>${esc(+d.value === 100 && d.type !== 'amt' ? d.name + (/إعفاء|معفى/.test(d.name) ? '' : ' (إعفاء)') : discLabel(d))}</option>`).join('')}</select>${D?.dl && I0.feeDisc && C0.discs.find(d => d.id === I0.feeDisc)?.each ? `<br><small class="tag">${esc(D.dl)}</small>` : ''}`
        : D ? `${esc(D.src)}${D.dl ? `<br><small class="tag">${esc(D.dl)}</small>` : ''}` : '<span class="muted">—</span>';
      const dueCell = D ? (D.off ? `<span title="${money(D.base)} − ${money(D.off)}">${money(D.due)}</span> <small class="muted"><s>${money(D.base)}</s></small>` : money(D.due)) : '—';
      const any = (pIndex(), pAny.has(s.id));
      /* «تذكير» بالسداد لمن لم يسدّد (notify.js) */
      const remind = can('fees.collect') && !off && fee !== 0 && (fee ? paid < fee : !paid) ? `<button type="button" class="btn sm" data-remind="${esc(s.id)}" title="تذكير بالسداد">تذكير</button>` : '';
      return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td>${grouped ? '' : `<td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>`}
        <td>${catCell}</td><td>${dueCell}</td><td>${paid ? money(paid) : '—'}</td><td>${state}</td>
        <td class="noprint">${can('fees.collect') ? `<button type="button" class="btn sm primary" data-fee-pay="${esc(s.id)}" ${cloudMissing() || fee === 0 ? 'disabled' : ''}>تحصيل</button>` : ''}${any ? `<button type="button" class="btn sm" data-fee-log="${esc(s.id)}">السجل</button>` : ''}${can('fees.amount') ? `<button type="button" class="btn sm" data-fee-assign="${esc(s.id)}">الفئة</button>` : ''}${remind}${accActs(s)}</td></tr>`;
    };
    const table = (arr, withMore) => `<div class="tbl"><table><tr><th>#</th><th>الطالب</th>${grouped ? '' : '<th>الحلقة</th><th>المكان</th>'}<th>الفئة / الخصم</th><th>المستحق</th><th>المدفوع</th><th>الحالة</th><th class="noprint"></th></tr>${arr.slice(0, MAX_ROWS).map(row).join('')}</table></div>
        ${withMore && arr.length > MAX_ROWS ? `<p class="muted">يظهر أول ${MAX_ROWS} من ${arr.length} طالبًا؛ اكتب في مربعات البحث للتضييق.</p>` : ''}`;
    const unpaid = [];
    list.forEach(s => {
      const fee = feeOf(s), paid = paidFor(s.id, st.y, st.m); got += paid;
      if (!stOff(s) && fee !== 0 && (fee ? paid < fee : !paid)) unpaid.push(s.id);
      if (stOff(s)) offN++;
      else if (fee === 0) freeN++;
      else if (fee) { expected += fee; if (paid >= fee) paidN++; else if (paid > 0) partN++; else noneN++; } else if (paid > 0) paidN++;
    });
    /* من لم يسدّد (كليًا أو جزئيًا) في كل نتائج البحث، لا في الصفوف الظاهرة فقط: لزر «تذكير غير المسددين» */
    window.QLFees = { unpaid, y: st.y, m: st.m };
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    return `<div class="grid">${stat(money(got), 'المحصَّل في ' + MONTHS[st.m - 1])}${stat(money(expected), 'المتوقع')}${stat(paidN, 'مسدَّد')}${stat(partN, 'جزئي')}${stat(noneN, 'لم يُسدَّد')}${freeN ? stat(freeN, 'معفى') : ''}${offN ? stat(offN, 'منقطع') : ''}</div>
      ${unpaid.length && can('fees.collect') ? `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${unpaid.length} طالب لم يسدّد اشتراك ${MONTHS[st.m - 1]} (في نتائج البحث).</span><button type="button" class="btn sm" data-remind-all="fees">تذكير غير المسددين (${unpaid.length})</button></div>` : ''}
      ${grouped ? groupedView(list, table) : list.length ? table(list, true) : empty(st.qs || st.qh || st.qp ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد.')}`;
  }
  /* بالمكان: الأماكن المطابقة وتحت كل منها حلقاتها؛ بالحلقة: الحلقات المطابقة مع كبسولة المكان.
     كل حلقة سطر يُفتح بالضغط فيظهر جدول اشتراكات طلابها تحته (ومع البحث بالاسم تُفتح التي فيها مطابقون) */
  function groupedView(list, table) {
    const byH = new Map(); list.forEach(s => { const id = s.halaqaId; if (!byH.has(id)) byH.set(id, []); byH.get(id).push(s); });
    const hs = db.halaqat.filter(h => halOk(h) && (!st.qs.trim() || byH.has(h.id))).sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
    const chip = h => { const pn = placeName(h); return pn ? `<span class="tag" role="button" tabindex="0" data-fpl="${esc(pn)}" title="عرض حلقات هذا المكان" style="cursor:pointer">${esc(pn)}</span>` : '<span class="tag">بلا مكان</span>'; };
    const block = (h, withChip) => {
      const arr = byH.get(h.id) || [], isOpen = st.open.has(h.id) || (!!st.qs.trim() && arr.length > 0);
      const done = arr.filter(s => { const f = feeOf(s); return f && paidFor(s.id, st.y, st.m) >= f; }).length;
      return `<div class="ahal${isOpen ? ' open' : ''}"><div class="ahal-h" role="button" tabindex="0" data-fhal="${esc(h.id)}" aria-expanded="${isOpen}"><span class="ahal-ar">${isOpen ? '▾' : '◂'}</span><b>${esc(halaqaLabel(h))}</b>${withChip ? ' ' + chip(h) : ''}<span class="muted ahal-n">${arr.length} طالب · مسدَّد ${done}</span></div>
        ${isOpen ? `<div class="ahal-b">${arr.length ? table(arr, false) : empty('لا يوجد طلاب في هذه الحلقة.')}</div>` : ''}</div>`;
    };
    if (st.qp.trim()) {
      const places = db.places.filter(p => has(p.name, st.qp)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      if (!places.length) return empty('لا يوجد مكان مطابق.');
      return places.map(p => { const ph = hs.filter(h => h.placeId === p.id);
        return `<div class="aplace"><h3>${esc(p.name)} <span class="muted" style="font-size:.85rem;font-weight:400">${ph.length} حلقة</span></h3>${ph.length ? ph.map(h => block(h, false)).join('') : '<p class="muted" style="margin:.2rem 0 .6rem">لا توجد حلقات مطابقة في هذا المكان.</p>'}</div>`; }).join('');
    }
    return hs.length ? `<p class="muted" style="margin:.2rem 0 .6rem">${hs.length} حلقة — اضغط على الحلقة لعرض طلابها</p>${hs.map(h => block(h, true)).join('')}` : empty('لا توجد حلقة مطابقة.');
  }
  /* أعمال المحاسب على الطالب (بعد إخفاء قسم «الطلاب» عنه): نقل، منقطع/منتظم — بحسب صلاحيته */
  const accActs = s => session?.role === 'accountant' ? `${can('students.move') ? `<button type="button" class="btn sm" data-move="${esc(s.id)}">نقل</button>` : ''}${can('students.status') ? `<button type="button" class="btn sm" data-stat="${esc(s.id)}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>` : ''}` : '';
  function view() {
    const SUG = { qs: 'fee-students', qh: 'fee-halaqat', qp: 'fee-places' };
    const box = (k, l, ph) => `<label style="margin:0">${l}<input type="search" data-fq="${k}" data-suggest="${SUG[k]}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off"></label>`;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">تحصيل اشتراكات الطلاب</h2>
        ${can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>إعدادات الاشتراك</button>' : ''}${can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : ''}${session?.role === 'accountant' && can('students.add') ? '<button type="button" class="btn" data-act="addStudent">+ استمارة طالب</button>' : ''}${isAdmin() && window.QLFeeImport ? '<button type="button" class="btn" data-fee-import>استيراد دفعات</button>' : ''}
        <label style="margin:0">الشهر <select data-fmonth style="width:auto">${monthOpts(st.y, st.m).map(o => `<option value="${o.v}" ${o.sel ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label></div>
      ${cloudMissing() ? '<div class="note" style="color:var(--red)">جدول الاشتراكات غير موجود على الخادم بعد: نفّذ الملف <b>supabase/fees.sql</b> في Supabase ← SQL Editor ثم حدّث الصفحة.</div>' : ''}
      <div class="three">${box('qs', 'اسم الطالب', 'اكتب أو اختر الطالب')}${box('qh', 'الحلقة', 'اسم الحلقة أو المعلم')}${box('qp', 'المكان', 'اكتب أو اختر المكان')}</div>
      <div data-fclearw style="margin:.1rem 0 .4rem">${st.qs || st.qh || st.qp ? '<button type="button" class="btn sm" data-fclear>مسح البحث</button>' : ''}</div>
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 .8rem">المستحق = «الاشتراك العام» (أو فئة الطالب أو مبلغه الخاص إن وُجد) مطروحًا منه خصمه أو إعفاؤه، ويُختار من القائمة بجانب كل طالب.${anyGeneral(cfg()) || cfg().cats.length ? '' : ' <b>ابدأ بتحديد «الاشتراك العام» من زر «إعدادات الاشتراك».</b>'}</p>
      <div data-fres>${results()}</div></div>`;
  }
  /* تحديث النتائج وحدها أثناء الكتابة (يبقى المؤشر في المربع) */
  const refresh = () => {
    const r = document.querySelector('[data-fres]'); if (r) r.innerHTML = results();
    const w = document.querySelector('[data-fclearw]'); if (w) w.innerHTML = st.qs || st.qh || st.qp ? '<button type="button" class="btn sm" data-fclear>مسح البحث</button>' : '';
  };
  /* قوائم الاقتراحات لمربعات البحث (تعرضها selects.js): الحلقات مجمّعة تحت أماكنها */
  const byAr = (a, b) => a.t.localeCompare(b.t, 'ar');
  window.QLSuggest = Object.assign(window.QLSuggest || {}, {
    'fee-places': () => db.places.map(p => ({ v: p.id, t: p.name })).sort(byAr),
    /* تتابع: بعد تحديد المكان لا تظهر إلا حلقاته، وبعد تحديد الحلقة أو المكان لا يظهر إلا طلابهما */
    'fee-halaqat': () => db.halaqat.filter(h => has(placeName(h), st.qp)).map(h => ({ v: h.id, t: halaqaLabel(h), g: placeName(h) || 'بلا مكان' }))
      .sort((a, b) => (a.g === 'بلا مكان') - (b.g === 'بلا مكان') || a.g.localeCompare(b.g, 'ar') || byAr(a, b)),
    'fee-students': () => db.students.filter(s => { if (!st.qh.trim() && !st.qp.trim()) return true; const h = halOf(s); return !!h && halOk(h); }).map(s => ({ v: s.id, t: s.name })).sort(byAr)
  });
  /* اختيار حلقة من القائمة يفتح طلابها مباشرة */
  document.addEventListener('qpick', e => { if (e.target.dataset?.fq === 'qh') { st.open.add(e.detail.value); refresh(); } });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-fhal],[data-fpl]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('click', e => {
    const hb = e.target.closest('[data-fhal]');
    if (hb && !e.target.closest('[data-fpl]')) { const id = hb.dataset.fhal; st.open.has(id) ? st.open.delete(id) : st.open.add(id); refresh(); return; }
    const pl = e.target.closest('[data-fpl]');
    if (pl) { st.qp = pl.dataset.fpl; const i = document.querySelector('[data-fq="qp"]'); if (i) i.value = st.qp; refresh(); return; }
    if (e.target.closest('[data-fclear]')) { st.qs = st.qh = st.qp = ''; st.open.clear(); document.querySelectorAll('[data-fq]').forEach(i => { i.value = ''; }); refresh(); }
  });

  function pay(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const fee = feeOf(s), rest = fee ? Math.max(0, fee - paidFor(sid, st.y, st.m)) : '';
    openForm('تحصيل اشتراك: ' + s.name, [
      { name: 'amount', label: 'المبلغ (جنيه)', type: 'number', min: 0, value: rest || fee || '', required: true },
      { name: 'month', label: 'عن شهر', type: 'select', value: `${st.y}-${st.m}`, options: monthOpts(st.y, st.m).map(o => ({ v: o.v, l: o.l })) },
      { name: 'date', label: 'تاريخ التحصيل', type: 'date', value: today() },
      { name: 'note', label: 'ملاحظة (اختياري)' }
    ], v => {
      const amount = +v.amount;
      if (!(amount > 0)) return 'اكتب مبلغًا صحيحًا';
      const [y, m] = v.month.split('-').map(Number);
      const f = { id: uid(), studentId: sid, y, m, amount, date: v.date || today(), by: me()?.name || '', byMember: session?.id || '', note: (v.note || '').trim() };
      fees().push(f);
      /* إيصال للطابعة الصغيرة (receipt.js) بعد إغلاق النافذة وحفظ الدفعة */
      if (window.QLReceipt) setTimeout(() => window.QLReceipt.offer(f), 60);
      else toast(`سُجّل ${money(amount)} جنيه لـ«${s.name}» عن ${MONTHS[m - 1]} ${y}`);
    });
  }
  function log(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const list = fees().filter(f => f.studentId === sid).sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m) || String(b.date).localeCompare(String(a.date)));
    const total = list.reduce((a, f) => a + (+f.amount || 0), 0);
    openInfo('سجل اشتراكات: ' + s.name, `<div class="tbl"><table><tr><th>عن شهر</th><th>المبلغ</th><th>التاريخ</th><th>حصّلها</th><th>ملاحظة</th><th class="noprint"></th></tr>
      ${list.map(f => `<tr><td>${MONTHS[f.m - 1]} ${f.y}</td><td>${money(f.amount)}</td><td dir="ltr" style="text-align:right">${esc(f.date || '')}</td><td>${esc(f.by || '')}</td><td>${esc(f.note || '')}</td><td class="noprint"><button type="button" class="btn sm" data-fee-rcpt="${esc(f.id)}">إيصال</button>${isAdmin() || (can('fees.collect') && f.byMember === session?.id) ? `<button type="button" class="btn sm danger" data-fee-del="${esc(f.id)}">حذف</button>` : ''}</td></tr>`).join('')}
      <tr class="sum"><td>الإجمالي</td><td>${money(total)}</td><td colspan="4"></td></tr></table></div>`);
  }
  function del(id) {
    const f = fees().find(x => x.id === id); if (!f) return;
    ask(`حذف دفعة ${money(f.amount)} جنيه عن ${MONTHS[f.m - 1]} ${f.y}؟`, () => {
      db.fees = fees().filter(x => x.id !== id);
      document.querySelectorAll('.overlay').forEach(o => o.remove());
      save(); render(); toast('حُذفت الدفعة');
    });
  }

  /* ===== نافذة الفئات والخصومات ===== */
  function cfgDialog() {
    let curY = st.y;
    const C = JSON.parse(JSON.stringify(cfg(curY)));
    const origYears = JSON.parse(JSON.stringify(yearsOf())), baseNow = JSON.parse(JSON.stringify(amountsOf(db.settings.priv_fees || {})));
    const stash = {};   // مبالغ كل سنة عُدّلت في هذه النافذة
    const yNow = +today().slice(0, 4);
    const yearOpts = () => [...new Set([yNow - 1, yNow, yNow + 1, st.y, curY, ...Object.keys(origYears).map(Number)])].filter(Boolean).sort((a, b) => a - b);
    const takeYear = () => { stash[curY] = { general: C.general, general3: C.general3, places: C.places, cats: C.cats }; };
    const loadYear = y => { const v = stash[y] ? JSON.parse(JSON.stringify(stash[y])) : JSON.parse(JSON.stringify(cfg(y))); C.general = v.general; C.general3 = v.general3; C.places = v.places || {}; C.cats = v.cats || []; };
    const ov = document.createElement('div'); ov.className = 'overlay';
    const catRow = (c, i) => `<tr><td><input data-c="name" data-i="${i}" value="${esc(c.name)}" placeholder="مثال: الصغار"></td><td><input type="number" min="0" data-c="amount" data-i="${i}" value="${esc(c.amount ?? '')}" style="width:7rem"></td>
      <td><select data-c="def" data-i="${i}"><option value="">—</option><option value="child" ${c.def === 'child' ? 'selected' : ''}>الصغار</option><option value="adult" ${c.def === 'adult' ? 'selected' : ''}>الكبار</option></select></td><td><button type="button" class="btn sm danger" data-cdel="${i}">حذف</button></td></tr>`;
    const discRow = (d, i) => `<tr><td><input data-d="name" data-i="${i}" value="${esc(d.name)}"></td><td><select data-d="type" data-i="${i}"><option value="pct" ${d.type !== 'amt' ? 'selected' : ''}>نسبة %</option><option value="amt" ${d.type === 'amt' ? 'selected' : ''}>مبلغ ثابت (جنيه)</option></select></td>
      <td><input type="number" min="0" data-d="value" data-i="${i}" value="${d.each ? '' : esc(d.value ?? '')}" style="width:7rem" ${d.each ? 'disabled placeholder="لكل طالب"' : ''}></td>
      <td style="text-align:center"><input type="checkbox" data-each="${i}" ${d.each ? 'checked' : ''} aria-label="تُحدَّد القيمة لكل طالب"></td><td><button type="button" class="btn sm danger" data-ddel="${i}">حذف</button></td></tr>`;
    const used = (k, id) => db.students.filter(x => (x.info || {})[k] === id).length;
    const draw = () => {
      ov.innerHTML = `<div class="modal wide"><h2>إعدادات الاشتراك</h2>
        <div class="bar" style="margin:0 0 .6rem"><label style="margin:0">مبالغ سنة<select data-cfgy style="width:auto">${yearOpts().map(y => `<option value="${y}" ${y === curY ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
          <span class="muted" style="font-size:.85rem">لكل سنة مبالغها: تغيير مبالغ سنة لا يغيّر مستحقات السنوات الأخرى. السنة التي لم تُحدَّد مبالغها تأخذ مبالغ السنة التي قبلها.</span></div>
        <h3 style="font-size:1rem;margin:.4rem 0">الاشتراك العام لسنة ${curY} (المبلغ الشهري بحسب نظام الحضور)</h3>
        <div class="two" style="max-width:30rem"><label style="margin:0 0 .3rem">نظام 6 أيام (جنيه)<input type="number" min="0" step="any" data-general value="${C.general ?? ''}" placeholder="مثال: 60"></label>
          <label style="margin:0 0 .3rem">نظام 3 أيام (جنيه)<input type="number" min="0" step="any" data-general3 value="${C.general3 ?? ''}" placeholder="مثال: 40"></label></div>
        <p class="muted" style="font-size:.85rem;margin:0 0 1rem">كل طالب على «نظام 6 أيام» ما لم يُختر له «نظام 3 أيام» من القائمة بجانب اسمه في «الاشتراكات» (أو من «تعيين لنتائج البحث» لحلقة كاملة). ثم يُطرح من المبلغ خصمه أو إعفاؤه. اترك «3 أيام» فارغًا إن كان الاشتراك واحدًا للجميع.</p>
        <details ${Object.keys(C.places).length ? 'open' : ''} style="margin:0 0 1rem"><summary style="cursor:pointer;font-weight:700">مبالغ تختلف حسب المكان${Object.keys(C.places).length ? ` (${Object.keys(C.places).length})` : ''}</summary>
        <p class="muted" style="font-size:.85rem;margin:.4rem 0">اكتب مبلغ المكان الذي يختلف اشتراكه، واترك غيره فارغًا فيأخذ المبلغ العام أعلاه. ينطبق على كل طلاب حلقات المكان.</p>
        <input type="search" data-cfgpq placeholder="ابحث باسم المكان" style="max-width:20rem;margin:0 0 .4rem">
        <div class="tbl"><table><tr><th>المكان</th><th>الحلقات</th><th>نظام 6 أيام</th><th>نظام 3 أيام</th></tr>${db.places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(p => `<tr data-cfgpn="${esc(norm(p.name))}"><td>${esc(p.name)}</td><td>${db.halaqat.filter(h => h.placeId === p.id).length}</td>
          <td><input type="number" min="0" step="any" data-pg="${esc(p.id)}" value="${C.places[p.id]?.general ?? ''}" placeholder="${C.general ?? ''}" style="width:6.5rem"></td>
          <td><input type="number" min="0" step="any" data-pg3="${esc(p.id)}" value="${C.places[p.id]?.general3 ?? ''}" placeholder="${C.general3 ?? ''}" style="width:6.5rem"></td></tr>`).join('')}</table></div></details>
        <h3 style="font-size:1rem;margin:.4rem 0">الخصومات والإعفاءات</h3>
        <div class="tbl"><table><tr><th>الاسم</th><th>النوع</th><th>القيمة</th><th>لكل طالب</th><th></th></tr>${C.discs.map(discRow).join('') || '<tr><td colspan="5" class="muted">لا توجد خصومات.</td></tr>'}</table></div>
        <p class="muted" style="font-size:.85rem;margin:.3rem 0 0">الإعفاء = خصم 100%. «لكل طالب»: تُحدَّد قيمة الخصم ونوعه لكل طالب على حدة (مثل الحالات الخاصة).</p>
        <div class="row" style="margin:.4rem 0 1rem"><button type="button" class="btn sm" data-dadd>+ خصم</button><button type="button" class="btn sm" data-dexempt>+ إعفاء</button></div>
        <details ${C.cats.length ? 'open' : ''} style="margin:0 0 1rem"><summary style="cursor:pointer;font-weight:700">فئات بمبالغ مختلفة (اختياري)</summary>
        <p class="muted" style="font-size:.85rem;margin:.4rem 0">لمن يختلف اشتراكه عن العام. «الافتراضية لـ» تطبّق الفئة على كل الصغار أو كل الكبار بدل الاشتراك العام.</p>
        <div class="tbl"><table><tr><th>اسم الفئة</th><th>المبلغ (جنيه)</th><th>الافتراضية لـ</th><th></th></tr>${C.cats.map(catRow).join('') || '<tr><td colspan="4" class="muted">لا توجد فئات.</td></tr>'}</table></div>
        <div class="row" style="margin:.4rem 0 0"><button type="button" class="btn sm" data-cadd>+ فئة</button></div></details>
        <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    const read = () => {
      const g = ov.querySelector('[data-general]'); if (g) C.general = g.value === '' ? null : +g.value;
      const g3 = ov.querySelector('[data-general3]'); if (g3) C.general3 = g3.value === '' ? null : +g3.value;
      if (ov.querySelector('[data-pg]')) {
        C.places = {};
        ov.querySelectorAll('[data-pg]').forEach(x => {
          const id = x.dataset.pg, y = ov.querySelector(`[data-pg3="${id}"]`);
          const a = x.value === '' ? null : +x.value, b = !y || y.value === '' ? null : +y.value;
          if (a != null || b != null) C.places[id] = { general: a, general3: b };
        });
      }
      ov.querySelectorAll('[data-c]').forEach(x => { C.cats[+x.dataset.i][x.dataset.c] = x.dataset.c === 'amount' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-d]').forEach(x => { C.discs[+x.dataset.i][x.dataset.d] = x.dataset.d === 'value' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-each]').forEach(x => { const d = C.discs[+x.dataset.each]; d.each = x.checked; if (d.each) d.value = 0; });
    };
    ov.addEventListener('change', e => {
      if (e.target.matches('[data-each]')) { read(); draw(); }
      if (e.target.matches('[data-cfgy]')) { read(); takeYear(); curY = +e.target.value; loadYear(curY); draw(); }
    });
    ov.addEventListener('input', e => {
      if (!e.target.matches('[data-cfgpq]')) return;
      const q = norm(e.target.value); ov.querySelectorAll('[data-cfgpn]').forEach(r => { r.style.display = !q || r.dataset.cfgpn.includes(q) ? '' : 'none'; });
    });
    draw(); document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const t = e.target;
      if (t.matches('[data-close]')) { ov.remove(); return; }
      if (t.matches('[data-cadd]')) { read(); C.cats.push({ id: uid(), name: '', amount: '', def: '' }); draw(); return; }
      if (t.matches('[data-dadd]')) { read(); C.discs.push({ id: uid(), name: '', type: 'pct', value: '' }); draw(); return; }
      if (t.matches('[data-dexempt]')) { read(); C.discs.push({ id: uid(), name: 'إعفاء كامل', type: 'pct', value: 100 }); draw(); return; }
      if (t.matches('[data-cdel],[data-ddel]')) {
        read();
        const isC = t.matches('[data-cdel]'), i = +(isC ? t.dataset.cdel : t.dataset.ddel), item = (isC ? C.cats : C.discs)[i];
        const n = used(isC ? 'feeCat' : 'feeDisc', item.id);
        if (n && !t.dataset.sure) { t.dataset.sure = '1'; t.textContent = `مستخدم لـ${n} طالب — اضغط للتأكيد`; return; }
        (isC ? C.cats : C.discs).splice(i, 1); draw(); return;
      }
      if (t.matches('[data-save]')) {
        read(); takeYear();
        for (const [y, V] of Object.entries(stash)) {
          if ([V.general, V.general3].some(x => x != null && (!isNum(x) || x < 0))) { toast(`مبلغ الاشتراك العام لسنة ${y} غير صحيح`); return; }
          if (Object.values(V.places || {}).some(p => [p.general, p.general3].some(x => x != null && (!isNum(x) || x < 0)))) { toast(`مبلغ أحد الأماكن لسنة ${y} غير صحيح`); return; }
          if ((V.cats || []).some(c => !c.name || !isNum(c.amount) || +c.amount < 0)) { toast(`أكمل اسم كل فئة ومبلغها لسنة ${y}`); return; }
          if (['child', 'adult'].some(k => (V.cats || []).filter(c => c.def === k).length > 1)) { toast('فئة افتراضية واحدة فقط للصغار وواحدة للكبار'); return; }
        }
        if (C.discs.some(d => !d.name || (!d.each && (!isNum(d.value) || +d.value < 0)))) { toast('أكمل اسم كل خصم وقيمته'); return; }
        if (C.discs.some(d => d.type !== 'amt' && +d.value > 100)) { toast('نسبة الخصم لا تزيد على 100%'); return; }
        /* مبالغ السنوات: ما عُدّل هنا، وما قبل ذلك كما هو. أول مرة تُثبَّت مبالغ هذه السنة كما كانت حتى لا تتغير مستحقاتها */
        const years = { ...origYears };
        if (!Object.keys(origYears).length && !stash[yNow]) years[yNow] = baseNow;
        Object.entries(stash).forEach(([y, V]) => { years[y] = { general: V.general, general3: V.general3, places: V.places || {}, cats: (V.cats || []).map(c => ({ ...c, amount: +c.amount })) }; });
        const cur = amountsOf(pickYear(years, yNow) || {});
        db.settings.priv_fees = { v: 3, general: cur.general, general3: cur.general3, places: cur.places, cats: cur.cats, years, discs: C.discs.map(d => ({ ...d, value: d.each ? 0 : +d.value, each: !!d.each })) };
        ov.remove(); save(); render(); toast('حُفظت إعدادات الاشتراك');
      }
    });
  }
  /* ===== تعيين الفئة والخصم لطالب أو لكل نتائج البحث ===== */
  function assignDialog(list) {
    if (!list.length) { toast('لا يوجد طلاب في النتائج'); return; }
    const C = cfg(), one = list.length === 1, I = one ? (list[0].info || {}) : {};
    const keep = one ? '' : '<option value="__keep">— بلا تغيير —</option>';
    const sel = (cur, opts) => opts.map(([v, l]) => `<option value="${esc(v)}" ${!one ? '' : String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>${one ? 'فئة واشتراك: ' + esc(list[0].name) : `تعيين لـ${list.length} طالبًا من نتائج البحث`}</h2>
      <label>الفئة<select name="cat">${keep}${sel(I.feeCat || '', [['', anyGeneral(C) ? 'الاشتراك العام (بحسب نظام الحضور والمكان)' : 'حسب الافتراضي لسنّه'], ...C.cats.map(c => [c.id, `${c.name} — ${money(c.amount)} جنيه`])])}</select></label>
      ${hasThree(C) ? `<label>نظام الحضور<select name="sys">${keep}${sel(I.feeSys === '3' ? '3' : '6', Object.keys(C.places).length ? [['6', 'نظام 6 أيام'], ['3', 'نظام 3 أيام']] : [['6', `نظام 6 أيام — ${money(C.general ?? 0)} جنيه`], ['3', `نظام 3 أيام — ${money(C.general3)} جنيه`]])}</select></label>` : ''}
      <label>الخصم<select name="disc">${keep}${sel(I.feeDisc || '', [['', 'بلا خصم'], ...C.discs.map(d => [d.id, discLabel(d)])])}</select></label>
      <div class="two"><label>قيمة خصم خاصة بـ${one ? 'هذا الطالب' : 'هؤلاء الطلاب'}<input type="number" min="0" name="dval" value="${one && isNum(I.feeDiscVal) ? esc(I.feeDiscVal) : ''}" placeholder="${one ? 'فارغ = قيمة الخصم العامة' : 'فارغ = بلا تغيير'}"></label>
      <label>نوعها<select name="dtype"><option value="pct" ${I.feeDiscType !== 'amt' ? 'selected' : ''}>نسبة %</option><option value="amt" ${I.feeDiscType === 'amt' ? 'selected' : ''}>مبلغ (جنيه)</option></select></label></div>
      <p class="muted" style="font-size:.82rem;margin:-.3rem 0 .6rem">مطلوبة لـ«حالات خاصة» وكل خصم يُحدَّد لكل طالب؛ واختيارية لغيرها.</p>
      ${one ? `<label>مبلغ خاص يتجاوز الفئة (اختياري)<input type="number" min="0" name="fee" value="${isNum(I.fee) ? esc(I.fee) : ''}" placeholder="فارغ = مبلغ الفئة"></label>` : ''}
      ${!C.cats.length && !anyGeneral(C) ? '<p class="note">حدّد «الاشتراك العام» أولًا من «إعدادات الاشتراك».</p>' : ''}
      <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-save]').onclick = () => {
      const v = n => ov.querySelector(`[name=${n}]`)?.value ?? '';
      const disc = C.discs.find(d => d.id === v('disc')), dval = v('dval'), dtype = v('dtype');
      if (disc?.each && dval === '') { toast(`حدّد قيمة خصم «${disc.name}» ونوعه لـ${one ? 'هذا الطالب' : 'هؤلاء الطلاب'}`); return; }
      if (dval !== '' && (+dval < 0 || (dtype === 'pct' && +dval > 100))) { toast('قيمة الخصم غير صحيحة'); return; }
      list.forEach(s => {
        s.info = s.info || {};
        if (v('cat') !== '__keep') s.info.feeCat = v('cat');
        if (v('sys') && v('sys') !== '__keep') s.info.feeSys = v('sys');
        if (v('disc') !== '__keep') { s.info.feeDisc = v('disc'); if (!v('disc')) s.info.feeDiscVal = ''; }
        if (one || dval !== '') { s.info.feeDiscVal = dval === '' ? '' : +dval; s.info.feeDiscType = dval === '' ? '' : dtype; }
        if (one) s.info.fee = v('fee') === '' ? '' : +v('fee');
      });
      ov.remove(); save(); render(); toast(one ? 'حُفظ' : `عُيّن لـ${list.length} طالبًا`);
    };
  }

  document.addEventListener('input', e => { const k = e.target.dataset?.fq; if (k) { st[k] = e.target.value; refresh(); } });
  /* القائمة المنسدلة بجانب الطالب: خصمه أو إعفاؤه مباشرة؛ والخصم الذي يُحدَّد لكل طالب يفتح نافذة قيمته */
  document.addEventListener('change', e => {
    const t = e.target; if (!('fdisc' in (t.dataset || {})) || !can('fees.amount')) return;
    const s = byId(db.students, t.dataset.fdisc); if (!s) return;
    const d = cfg().discs.find(x => x.id === t.value);
    s.info = s.info || {};
    s.info.feeDisc = t.value;
    if (!t.value) { s.info.feeDiscVal = ''; s.info.feeDiscType = ''; }
    if (d?.each && !isNum(s.info.feeDiscVal)) { assignDialog([s]); return; }
    save(); render(); toast(d ? `«${s.name}»: ${d.name}` : `«${s.name}»: بلا خصم`);
  });
  /* نظام الحضور بجانب الطالب: يُحفظ فورًا ويتغير المستحق */
  document.addEventListener('change', e => {
    const t = e.target; if (!('fsys' in (t.dataset || {})) || !can('fees.amount')) return;
    const s = byId(db.students, t.dataset.fsys); if (!s) return;
    s.info = { ...(s.info || {}), feeSys: t.value === '3' ? '3' : '6' };
    save(); render(); toast(`«${s.name}»: نظام ${t.value === '3' ? '3' : '6'} أيام`);
  });
  document.addEventListener('change', e => {
    if (!('fmonth' in (e.target.dataset || {}))) return;
    const [y, m] = e.target.value.split('-').map(Number); st.y = y; st.m = m; render();
  });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-fee-pay]'); if (p) { if (can('fees.collect')) pay(p.dataset.feePay); return; }
    const l = e.target.closest('[data-fee-log]'); if (l) { log(l.dataset.feeLog); return; }
    const d = e.target.closest('[data-fee-del]'); if (d) { del(d.dataset.feeDel); return; }
    const g = e.target.closest('[data-fee-assign]'); if (g && can('fees.amount')) { assignDialog([byId(db.students, g.dataset.feeAssign)].filter(Boolean)); return; }
    if (e.target.closest('[data-fee-cfg]')) { if (can('fees.amount')) cfgDialog(); return; }   // المدير ومن له «قيمة الاشتراك» (المحاسب)
    if (e.target.closest('[data-fee-bulk]') && can('fees.amount')) assignDialog(filtered());
  });
})();
