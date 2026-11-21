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

  /* بطاقتا ملخص «الاشتراكات»: صف واحد لكل بيان، والقيمة والبيان في السطر نفسه */
  const feecss = document.createElement('style');
  feecss.textContent = `.feecards{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:0 0 1rem}
    @media (max-width:700px){.feecards{grid-template-columns:1fr}}
    .feecard h3{margin:0 0 .7rem;font-size:1rem}
    .feerow{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.6rem .9rem;border-radius:10px;margin-bottom:.5rem;font-weight:700}
    .feerow b{font-size:1.2rem}
    .feerow.fr-ok{background:color-mix(in srgb,var(--leaf,#4e7d45) 16%,transparent);color:var(--leaf,#4e7d45)}
    .feerow.fr-no{background:color-mix(in srgb,var(--red,#b3372f) 14%,transparent);color:var(--red,#b3372f)}
    .feerow.fr-info{background:color-mix(in srgb,var(--navy,#13294b) 10%,transparent);color:var(--navy,#13294b)}
    .feerow.fr-plain{background:var(--navy-l,#eef1f6);color:var(--navy,#13294b)}
    .feebar{background:var(--line,#e5e7eb);border-radius:999px;height:10px;overflow:hidden;margin:.5rem 0 .3rem}
    .feebar>span{display:block;height:100%;background:var(--leaf,#4e7d45);border-radius:999px}
    .feebar-label{display:flex;justify-content:space-between;font-size:.85rem;color:var(--muted,#6b7280)}`;
  document.head.appendChild(feecss);
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
      /* مبالغ فئات المكان { معرف الفئة: المبلغ } (من «اشتراك المكان» في «الأماكن والحلقات») */
      const cats = {}; Object.entries(v?.cats && typeof v.cats === 'object' ? v.cats : {}).forEach(([id, a]) => { if (isNum(a)) cats[id] = +a; });
      if (g != null || g3 != null || Object.keys(cats).length) places[k] = { general: g, general3: g3, ...(Object.keys(cats).length ? { cats } : {}) };
    });
    return { cats: Array.isArray(c?.cats) ? c.cats : [], general: isNum(c?.general) ? +c.general : null, general3: isNum(c?.general3) ? +c.general3 : null, places };
  };
  /* مبالغ الاشتراك تتغير ابتداءً من شهر بعينه (years): مفتاح «2026» = من يناير 2026، و«2026-09» = من سبتمبر 2026.
     مستحق شهر = مبالغ آخر تغيير بدأ فيه أو قبله (وإلا أول تغيير)، فلا يتغير مستحق ما قبله. الخصومات واحدة للكل.
     (على الخادم بالقاعدة نفسها: fee_due_ym في supabase/fee_periods.sql) */
  const yearsOf = () => { const Y = db.settings.priv_fees?.years; return Y && typeof Y === 'object' ? Y : {}; };
  const pOrd = k => (/^\d{4}$/.test(k) ? +k * 100 + 1 : /^\d{4}-(0[1-9]|1[0-2])$/.test(k) ? +k.slice(0, 4) * 100 + +k.slice(5) : null);
  const pKeys = Y => Object.keys(Y).filter(k => pOrd(k) != null).sort((a, b) => pOrd(a) - pOrd(b));
  const pickKey = (Y, y, m) => { const ks = pKeys(Y); if (!ks.length) return null; const o = y * 100 + (m || 1); return [...ks].reverse().find(k => pOrd(k) <= o) ?? ks[0]; };
  const pickYear = (Y, y, m) => { const k = pickKey(Y, y, m); return k == null ? null : Y[k]; };
  const pLabel = k => { const o = pOrd(k); return o == null ? k : `من ${MONTHS[o % 100 - 1]} ${Math.floor(o / 100)}`; };
  /* بلا سنة: الشهر المعروض في «الاشتراكات». وبالسنة وحدها: الشهر الجاري للسنة الحالية، وديسمبر لما قبلها، ويناير لما بعدها */
  const defM = y => { const t = today(), cy = +t.slice(0, 4); return y === cy ? +t.slice(5, 7) : y < cy ? 12 : 1; };
  const cfg = (y, m) => { if (y == null) { y = st.y; m = m ?? st.m; } const A = cfgBase(), Y = pickYear(yearsOf(), +y, m ?? defM(+y)); return Y ? { ...A, ...amountsOf(Y) } : A; };
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
    /* placeDiscs: قيم خصومات تختلف حسب المكان { معرف المكان: { معرف الخصم: القيمة } }، والفارغ يأخذ قيمة الخصم العامة */
    const placeDiscs = c.placeDiscs && typeof c.placeDiscs === 'object' ? c.placeDiscs : {};
    return { ...amountsOf(c), discs, placeDiscs };
  };
  const discTxt = (d, v, t) => ((t || d.type) === 'amt' ? money(v) + ' جنيه' : v + '%');
  const discLabel = d => (d.each ? `${d.name} (يُحدَّد لكل طالب)` : `${d.name} (${discTxt(d, d.value)})`);
  /* المستحق = (المبلغ الخاص للطالب، أو مبلغ فئته، أو الفئة الافتراضية لسنّه، أو «الاشتراك العام») − الخصم أو الإعفاء */
  /* حال الطالب في شهر بعينه: من سجل تغيّراته (info.feeHist يكتبه الخادم: supabase/dues_hist_2026_11.sql) أقرب سجل ينتهي
     في ذلك الشهر أو بعده، وإلا حاله الآن. فنقله لمكان أغلى أو إعفاؤه لا يغيّر مستحق ما قبله */
  const FEE_KEYS = ['fee', 'feeCat', 'feeSys', 'feeDisc', 'feeDiscVal', 'feeDiscType'];
  const ymOrd = t => /^\d{4}-\d{2}$/.test(t || '') ? +t.slice(0, 4) * 100 + +t.slice(5, 7) : null;
  function stateAt(s, y, m) {
    const H = Array.isArray(s?.info?.feeHist) ? s.info.feeHist : null;
    if (!H || !H.length) return null;
    const o = +y * 100 + +m, e = H.filter(x => ymOrd(x.to) != null && ymOrd(x.to) >= o).sort((a, b) => ymOrd(a.to) - ymOrd(b.to))[0];
    if (!e) return null;
    const info = { ...s.info }; FEE_KEYS.forEach(k => { if (e[k] == null) delete info[k]; else info[k] = e[k]; });
    return { info, pid: e.pid || '', cat: e.cat || s.cat };
  }
  function dueOf(s, y, m) {
    const yy = y == null ? st.y : +y, mm = y == null ? st.m : (m ?? defM(+y));
    const C = cfg(yy, mm), H = stateAt(s, yy, mm);
    const I = H ? H.info : (s?.info || {});
    if (H) s = { ...s, cat: H.cat, info: I };
    let base = null, src = '';
    const pid = H ? H.pid : halOf(s)?.placeId, P = (pid && C.places[pid]) || {}, PD = (pid && C.placeDiscs?.[pid]) || {};
    if (isNum(I.fee) && +I.fee > 0) { base = +I.fee; src = 'مبلغ خاص'; }
    else {
      const c = C.cats.find(x => x.id === I.feeCat) || C.cats.find(x => x.def === (s.cat === 'adult' ? 'adult' : 'child'));
      /* مبلغ الفئة: مبلغ مكان الطالب لها إن حُدّد، وإلا مبلغها العام */
      if (c) { const own = isNum(P.cats?.[c.id]); base = own ? +P.cats[c.id] : (+c.amount || 0); src = c.name + (own ? ` (${placeName(halOf(s)) || 'المكان'})` : ''); }
      else {
        /* الاشتراك العام: مبلغ مكان الطالب إن حُدّد له مبلغ خاص، وإلا المبلغ العام */
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
      /* القيمة: الخاصة بالطالب، وإلا قيمة المكان لهذا الخصم، وإلا القيمة العامة («لكل طالب» لا قيمة عامة له) */
      const own = isNum(I.feeDiscVal), v = own ? +I.feeDiscVal : (d.each ? 0 : isNum(PD[d.id]) ? +PD[d.id] : +d.value || 0), t = own ? (I.feeDiscType || d.type) : d.type;
      off = Math.min(base, Math.max(0, t === 'amt' ? v : base * v / 100));
      dl = d.each && !own ? `${d.name} (لم تُحدَّد قيمته)` : `${d.name} (${discTxt(d, v, t)})`;
    }
    return { base, src, off, dl, due: Math.round((base - off) * 100) / 100 };
  }
  const feeOf = (s, y, m) => dueOf(s, y, m)?.due ?? null;
  const hasThree = C => C.general3 != null || Object.values(C.places).some(p => p.general3 != null);
  const anyGeneral = C => C.general != null || C.general3 != null || Object.keys(C.places).length > 0;
  window.QLFeeDue = feeOf; // مستحق الطالب: (طالب، سنة، شهر)؛ بلا سنة = شهر العرض
  const halOf = s => byId(db.halaqat, s.halaqaId);
  /* فهرس المدفوع (طالب|سنة|شهر) يُبنى مرة كلما تغيّرت قائمة الدفعات: آلاف الدفعات × آلاف الطلاب تبقى سريعة */
  let pIdx = new Map(), pAny = new Set(), pRef = null, pLen = -1;
  const pIndex = () => {
    const F = fees(); if (F === pRef && F.length === pLen) return;
    pIdx = new Map(); pAny = new Set(); pRef = F; pLen = F.length;
    F.forEach(f => { const k = f.studentId + '|' + (+f.y) + '|' + (+f.m); pIdx.set(k, (pIdx.get(k) || 0) + (+f.amount || 0)); pAny.add(f.studentId); });
  };
  /* المجموع مقرَّب للقرش: 3 × 10.1 = 30.299999… كانت تظهر «جزئي» لمستحق 30.3 */
  const paidFor = (sid, y, m) => { pIndex(); return Math.round((pIdx.get(sid + '|' + (+y) + '|' + (+m)) || 0) * 100) / 100; };
  /* تعريف واحد لـ«مسدَّد» في كل الصفحات (كما في الرئيسية app-abs.js): من دفع أي مبلغ عن الشهر فهو مسدَّد،
     لأن المبلغ الأقل لا يُقبل عند التحصيل إلا بسببه («متأخر» أو «حالة خاصة»).
     المتوقع = مستحقات المنتظمين، والمحصَّل = ما دفعوه، والباقي = مستحقات من لم يدفع شيئًا.
     ما دفعه منقطع أو معفى أو بلا اشتراك محدد يُعرض وحده ولا يدخل في المحصَّل ولا في النسبة. */
  const tally = (list, y, m) => {
    let expected = 0, got = 0, extra = 0, remaining = 0, paidN = 0, noneN = 0, freeN = 0, offN = 0;
    const unpaid = [];
    list.forEach(s => {
      const fee = feeOf(s, y, m), paid = paidFor(s.id, y, m);
      if (stOff(s)) { offN++; extra += paid; return; }
      if (fee === 0) { freeN++; extra += paid; return; }
      if (!fee) { extra += paid; return; }
      expected += fee;
      if (paid > 0) { paidN++; got += paid; return; }
      noneN++; remaining += fee; unpaid.push(s.id);
    });
    const r2 = n => Math.round(n * 100) / 100;
    return { expected: r2(expected), got: r2(got), extra: r2(extra), remaining: r2(remaining), paidN, noneN, freeN, offN, unpaid,
             pct: expected > 0 ? Math.round(got / expected * 100) : 0 };
  };
  /* حالة الطالب عن الشهر بالتعريف نفسه؛ ومن دفع أقل من المستحق يظهر «مسدَّد» ومعه ما دفعه */
  const payState = (fee, paid, off, noFee) => off ? `<span class="tag tag-no">منقطع</span>${paid ? ' <small class="muted">دفع ' + money(paid) + '</small>' : ''}`
    : fee === 0 ? '<span class="tag tag-ok">معفى</span>'
    : fee ? (paid > 0 ? `<span class="tag tag-ok">مسدَّد ✓</span>${paid < fee ? ` <small class="muted">${money(paid)} من ${money(fee)}</small>` : ''}` : '<span class="tag tag-no">لم يُسدَّد</span>')
    : (paid > 0 ? '<span class="tag tag-ok">مدفوع</span>' : noFee);
  const needsRemind = (fee, paid, off) => !off && fee > 0 && !(paid > 0);
  const extraNote = T => T.extra ? `<p class="muted" style="font-size:.8rem;margin:.4rem 0 0">وصل أيضًا ${money(T.extra)} من منقطعين أو معفيين أو بلا اشتراك محدد (خارج الإيرادات الفعلية والنسبة).</p>` : '';
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
    const grouped = !!(st.qh.trim() || st.qp.trim());
    const row = (s, i) => {
      const D = dueOf(s), fee = D?.due ?? null, paid = paidFor(s.id, st.y, st.m), h = halOf(s), off = stOff(s);
      const state = payState(fee, paid, off, '<span class="muted">بلا اشتراك محدد</span>');
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
      const remind = can('fees.collect') && needsRemind(fee, paid, off) ? `<button type="button" class="btn sm" data-remind="${esc(s.id)}" title="تذكير بالسداد">تذكير</button>` : '';
      return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td>${grouped ? '' : `<td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>`}
        <td>${catCell}</td><td>${dueCell}</td><td>${paid ? money(paid) : '—'}</td><td>${state}</td>
        <td class="noprint">${can('fees.collect') ? `<button type="button" class="btn sm primary" data-fee-pay="${esc(s.id)}" ${cloudMissing() || fee === 0 ? 'disabled' : ''}>تحصيل</button>` : ''}${any ? `<button type="button" class="btn sm" data-fee-log="${esc(s.id)}">السجل</button>` : ''}${can('fees.amount') ? `<button type="button" class="btn sm" data-fee-assign="${esc(s.id)}">الفئة</button>` : ''}${remind}${accActs(s)}</td></tr>`;
    };
    const table = (arr, withMore) => `<div class="tbl"><table><tr><th>#</th><th>الطالب</th>${grouped ? '' : '<th>الحلقة</th><th>المكان</th>'}<th>الفئة / الخصم</th><th>المستحق</th><th>المدفوع</th><th>الحالة</th><th class="noprint"></th></tr>${arr.slice(0, MAX_ROWS).map(row).join('')}</table></div>
        ${withMore && arr.length > MAX_ROWS ? `<p class="muted">يظهر أول ${MAX_ROWS} من ${arr.length} طالبًا؛ اكتب في مربعات البحث للتضييق.</p>` : ''}`;
    /* من لم يسدّد في كل نتائج البحث، لا في الصفوف الظاهرة فقط: لزر «تذكير غير المسددين» */
    const T = tally(list, st.y, st.m);
    window.QLFees = { unpaid: T.unpaid, y: st.y, m: st.m };
    /* بطاقتان: «الطلاب» (مسددون/غير مسددين/معفون) و«الإيرادات» (متوقعة/فعلية/باقي المستحق) مع شريط نسبة التحصيل.
       كل صف: البيان والقيمة في السطر نفسه. */
    const feeRow = (cls, v, l) => `<div class="feerow ${cls}"><span>${esc(l)}</span><b>${v}</b></div>`;
    const feeCards = `<div class="feecards">
      <div class="card feecard"><h3>الطلاب</h3>
        ${feeRow('fr-ok', T.paidN, 'عدد المسددين')}
        ${feeRow('fr-no', T.noneN, 'عدد غير المسددين')}
        ${feeRow('fr-info', T.freeN, 'عدد المعفيين')}
      </div>
      <div class="card feecard"><h3>الإيرادات</h3>
        ${feeRow('fr-plain', money(T.expected), 'الإيرادات المتوقعة')}
        ${feeRow('fr-ok', money(T.got), 'الإيرادات الفعلية')}
        ${feeRow('fr-no', money(T.remaining), 'باقي المستحق')}
        <div class="feebar"><span style="width:${Math.min(T.pct, 100)}%"></span></div>
        <div class="feebar-label"><span>${T.pct}%</span><span>نسبة التحصيل</span></div>
        ${extraNote(T)}
      </div>
    </div>`;
    return `${feeCards}
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
    const fee = feeOf(s), paid0 = paidFor(sid, st.y, st.m), rest = fee ? Math.max(0, fee - paid0) : '';
    /* شهر دُفع عنه من قبل: يُقال ذلك صراحة في النافذة ولا يُقترح مبلغ (كان يُقترح المستحق كاملًا فتُسجَّل دفعة مكررة) */
    openForm('تحصيل اشتراك: ' + s.name, [
      { name: 'amount', label: paid0 > 0 ? `المبلغ (جنيه) — دُفع عن ${MONTHS[st.m - 1]} من قبل ${money(paid0)} جنيه، وما تكتبه يُضاف إليه` : 'المبلغ (جنيه)', type: 'number', min: 0, value: paid0 > 0 ? '' : (rest || fee || ''), required: true },
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
    /* الفترات: كل تغيير في المبالغ يبدأ من شهر (مفتاح «2026» أو «2026-09»)، والمعروضة أولًا فترة شهر العرض */
    const yNow = +today().slice(0, 4), mNow = +today().slice(5, 7);
    const origYears = JSON.parse(JSON.stringify(yearsOf())), baseNow = JSON.parse(JSON.stringify(amountsOf(db.settings.priv_fees || {})));
    const stash = {}, dropped = new Set();   // مبالغ كل فترة عُدّلت أو أُنشئت في هذه النافذة، وما حُذف منها
    let curK = pickKey(origYears, st.y, st.m) || String(yNow), newOpen = false;
    const C = JSON.parse(JSON.stringify(cfg(st.y, st.m)));
    const live = () => { const Y = {}; Object.entries(origYears).forEach(([k, v]) => { if (!dropped.has(k)) Y[k] = v; }); Object.entries(stash).forEach(([k, v]) => { if (!dropped.has(k)) Y[k] = v; }); if (!pKeys(Y).length) Y[String(yNow)] = baseNow; return Y; };
    const periodKeys = () => pKeys(live());
    const takeYear = () => { stash[curK] = { general: C.general, general3: C.general3, places: C.places, cats: C.cats }; };
    const loadYear = k => { const v = JSON.parse(JSON.stringify(amountsOf(live()[k] || {}))); C.general = v.general; C.general3 = v.general3; C.places = v.places || {}; C.cats = v.cats || []; };
    const ov = document.createElement('div'); ov.className = 'overlay';
    const catRow = (c, i) => `<tr><td><input data-c="name" data-i="${i}" value="${esc(c.name)}" placeholder="مثال: الصغار"></td><td><input type="number" min="0" data-c="amount" data-i="${i}" value="${esc(c.amount ?? '')}" style="width:7rem"></td>
      <td><select data-c="def" data-i="${i}"><option value="">—</option><option value="child" ${c.def === 'child' ? 'selected' : ''}>الصغار</option><option value="adult" ${c.def === 'adult' ? 'selected' : ''}>الكبار</option></select></td><td><button type="button" class="btn sm danger" data-cdel="${i}">حذف</button></td></tr>`;
    const discRow = (d, i) => `<tr><td><input data-d="name" data-i="${i}" value="${esc(d.name)}"></td><td><select data-d="type" data-i="${i}"><option value="pct" ${d.type !== 'amt' ? 'selected' : ''}>نسبة %</option><option value="amt" ${d.type === 'amt' ? 'selected' : ''}>مبلغ ثابت (جنيه)</option></select></td>
      <td><input type="number" min="0" data-d="value" data-i="${i}" value="${d.each ? '' : esc(d.value ?? '')}" style="width:7rem" ${d.each ? 'disabled placeholder="لكل طالب"' : ''}></td>
      <td style="text-align:center"><input type="checkbox" data-each="${i}" ${d.each ? 'checked' : ''} aria-label="تُحدَّد القيمة لكل طالب"></td><td><button type="button" class="btn sm danger" data-ddel="${i}">حذف</button></td></tr>`;
    const used = (k, id) => db.students.filter(x => (x.info || {})[k] === id).length;
    const draw = () => {
      ov.innerHTML = `<div class="modal wide"><h2>إعدادات الاشتراك</h2>
        <div class="bar" style="margin:0 0 .4rem;flex-wrap:wrap"><label style="margin:0">المبالغ<select data-cfgy style="width:auto">${periodKeys().map(k => `<option value="${k}" ${k === curK ? 'selected' : ''}>${pLabel(k)}</option>`).join('')}</select></label>
          <button type="button" class="btn sm" data-cfgnew>+ تغيير المبلغ ابتداءً من شهر…</button>
          ${periodKeys().length > 1 && curK !== periodKeys()[0] ? '<button type="button" class="btn sm danger" data-cfgdel>حذف هذا التغيير</button>' : ''}</div>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">كل تغيير في المبلغ يسري من الشهر الذي تختاره وما بعده، ولا يغيّر مستحقات ما قبله. الخصومات واحدة للكل.</p>
        ${newOpen ? `<div class="note" style="display:flex;flex-wrap:wrap;gap:.4rem .6rem;align-items:center;margin:0 0 .8rem"><b>المبلغ الجديد يبدأ من</b>
          <select data-newm style="width:auto;margin:0">${MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === (mNow % 12) + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select data-newy style="width:auto;margin:0">${[yNow - 1, yNow, yNow + 1].map(y => `<option value="${y}" ${y === (mNow === 12 ? yNow + 1 : yNow) ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <button type="button" class="btn sm primary" data-cfgnewok>إنشاء</button><button type="button" class="btn sm" data-cfgnewx>إلغاء</button>
          <span class="muted" style="font-size:.82rem;flex-basis:100%">تُنسخ إليه المبالغ السارية في ذلك الشهر، فتعدّل منها ما تغيّر ثم «حفظ».</span></div>` : ''}
        <h3 style="font-size:1rem;margin:.4rem 0">الاشتراك العام ${pLabel(curK)} (المبلغ الشهري بحسب نظام الحضور)</h3>
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
        const prev = C.places || {}; C.places = {};
        ov.querySelectorAll('[data-pg]').forEach(x => {
          const id = x.dataset.pg, y = ov.querySelector(`[data-pg3="${id}"]`), pc = prev[id]?.cats;   // مبالغ فئات المكان تبقى كما هي
          const a = x.value === '' ? null : +x.value, b = !y || y.value === '' ? null : +y.value;
          if (a != null || b != null || pc) C.places[id] = { general: a, general3: b, ...(pc ? { cats: pc } : {}) };
        });
      }
      ov.querySelectorAll('[data-c]').forEach(x => { C.cats[+x.dataset.i][x.dataset.c] = x.dataset.c === 'amount' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-d]').forEach(x => { C.discs[+x.dataset.i][x.dataset.d] = x.dataset.d === 'value' ? (x.value === '' ? '' : +x.value) : x.value.trim(); });
      ov.querySelectorAll('[data-each]').forEach(x => { const d = C.discs[+x.dataset.each]; d.each = x.checked; if (d.each) d.value = 0; });
    };
    ov.addEventListener('change', e => {
      if (e.target.matches('[data-each]')) { read(); draw(); }
      if (e.target.matches('[data-cfgy]')) { read(); takeYear(); curK = e.target.value; loadYear(curK); draw(); }
    });
    ov.addEventListener('input', e => {
      if (!e.target.matches('[data-cfgpq]')) return;
      const q = norm(e.target.value); ov.querySelectorAll('[data-cfgpn]').forEach(r => { r.style.display = !q || r.dataset.cfgpn.includes(q) ? '' : 'none'; });
    });
    draw(); document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      const t = e.target;
      if (t.matches('[data-close]')) { ov.remove(); return; }
      if (t.matches('[data-cfgnew]')) { read(); newOpen = true; draw(); return; }
      if (t.matches('[data-cfgnewx]')) { read(); newOpen = false; draw(); return; }
      if (t.matches('[data-cfgnewok]')) {
        const m = +ov.querySelector('[data-newm]').value, y = +ov.querySelector('[data-newy]').value, k = m === 1 ? String(y) : `${y}-${String(m).padStart(2, '0')}`;
        read(); takeYear(); newOpen = false;
        if (!live()[k]) { dropped.delete(k); stash[k] = JSON.parse(JSON.stringify(amountsOf(pickYear(live(), y, m) || {}))); }
        curK = k; loadYear(k); draw(); toast(`عدّل مبالغ «${pLabel(k)}» ثم «حفظ»`); return;
      }
      if (t.matches('[data-cfgdel]')) {
        read(); const ks = periodKeys(), i = ks.indexOf(curK);
        dropped.add(curK); delete stash[curK]; curK = ks[Math.max(0, i - 1)]; loadYear(curK); draw(); toast('سيُحذف التغيير عند «حفظ»، فتعود شهوره إلى المبالغ التي قبله'); return;
      }
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
        for (const [y, V] of Object.entries(stash).filter(([k]) => !dropped.has(k))) {
          if ([V.general, V.general3].some(x => x != null && (!isNum(x) || x < 0))) { toast(`مبلغ الاشتراك العام (${pLabel(y)}) غير صحيح`); return; }
          if (Object.values(V.places || {}).some(p => [p.general, p.general3].some(x => x != null && (!isNum(x) || x < 0)))) { toast(`مبلغ أحد الأماكن (${pLabel(y)}) غير صحيح`); return; }
          if ((V.cats || []).some(c => !c.name || !isNum(c.amount) || +c.amount < 0)) { toast(`أكمل اسم كل فئة ومبلغها (${pLabel(y)})`); return; }
          if (['child', 'adult'].some(k => (V.cats || []).filter(c => c.def === k).length > 1)) { toast('فئة افتراضية واحدة فقط للصغار وواحدة للكبار'); return; }
        }
        if (C.discs.some(d => !d.name || (!d.each && (!isNum(d.value) || +d.value < 0)))) { toast('أكمل اسم كل خصم وقيمته'); return; }
        if (C.discs.some(d => d.type !== 'amt' && +d.value > 100)) { toast('نسبة الخصم لا تزيد على 100%'); return; }
        /* الفترات: ما عُدّل أو أُنشئ هنا، وما حُذف، وما قبل ذلك كما هو. أول مرة تُثبَّت مبالغ هذه السنة كما كانت حتى لا تتغير مستحقاتها */
        const years = { ...origYears };
        if (!pKeys(origYears).length && !stash[yNow]) years[yNow] = baseNow;
        dropped.forEach(k => { delete years[k]; });
        Object.entries(stash).filter(([k]) => !dropped.has(k)).forEach(([y, V]) => { years[y] = { general: V.general, general3: V.general3, places: V.places || {}, cats: (V.cats || []).map(c => ({ ...c, amount: +c.amount })) }; });
        if (!pKeys(years).length) years[yNow] = baseNow;
        const cur = amountsOf(pickYear(years, yNow, mNow) || {});
        const keepPD = (db.settings.priv_fees || {}).placeDiscs;   // قيم خصومات الأماكن («اشتراك المكان»)
        db.settings.priv_fees = { v: 3, general: cur.general, general3: cur.general3, places: cur.places, cats: cur.cats, years, discs: C.discs.map(d => ({ ...d, value: d.each ? 0 : +d.value, each: !!d.each })), ...(keepPD ? { placeDiscs: keepPD } : {}) };
        ov.remove(); save(); render(); toast('حُفظت إعدادات الاشتراك');
      }
    });
  }
  /* ===== «اشتراك المكان» (من المكان في «الأماكن والحلقات»): مبالغ المكان لكل الفئات وقيم الخصومات =====
     القائمة نفسها لكل الأماكن (الاشتراك العام بنظاميه، والفئات، والخصومات)، ولكل مكان مبلغه أو قيمته، والفارغ يأخذ العام.
     المبالغ لكل فترة (تغيير المبلغ ابتداءً من شهر، كما في «إعدادات الاشتراك»)، وقيم الخصومات واحدة لكل الفترات. */
  function placeDialog(pid) {
    const pl = byId(db.places, pid); if (!pl) return;
    const yNow = +today().slice(0, 4), mNow = +today().slice(5, 7);
    const F0 = db.settings.priv_fees || {}, years0 = JSON.parse(JSON.stringify(yearsOf())), baseNow = JSON.parse(JSON.stringify(amountsOf(F0)));
    const live = () => (pKeys(years0).length ? years0 : { [String(yNow)]: baseNow });
    const keys = pKeys(live());
    let curK = pickKey(live(), yNow, mNow) || keys[0];
    const stash = {};   // مبالغ المكان لكل فترة عُدّلت هنا
    const discs = cfgBase().discs.filter(d => !d.each);
    const PD = { ...((F0.placeDiscs || {})[pid] || {}) };
    const per = k => amountsOf(live()[k] || {});
    const mine = k => { if (stash[k]) return stash[k]; const P = per(k).places[pid] || {}; return { general: P.general ?? null, general3: P.general3 ?? null, cats: { ...(P.cats || {}) } }; };
    const num = v => (v == null || v === '' ? '' : esc(v));
    const ov = document.createElement('div'); ov.className = 'overlay';
    const draw = () => {
      const A = per(curK), M = mine(curK);
      ov.innerHTML = `<div class="modal wide"><h2>اشتراك المكان: ${esc(pl.name)}</h2>
        <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">اكتب ما يختلف في هذا المكان فقط، واترك الباقي فارغًا فيأخذ المبلغ أو القيمة العامة (الظاهرة باهتة في الخانة). ينطبق على كل طلاب حلقات المكان، ومبلغ الطالب الخاص أو قيمة خصمه الخاصة تتقدّم عليه.</p>
        ${keys.length > 1 ? `<label style="max-width:20rem">المبالغ<select data-plpk>${keys.map(k => `<option value="${k}" ${k === curK ? 'selected' : ''}>${pLabel(k)}</option>`).join('')}</select></label>` : ''}
        <h3 style="font-size:1rem;margin:.4rem 0">الاشتراك العام ${keys.length > 1 ? pLabel(curK) : ''}</h3>
        <div class="two" style="max-width:30rem"><label style="margin:0 0 .3rem">نظام 6 أيام (جنيه)<input type="number" min="0" step="any" data-plg value="${num(M.general)}" placeholder="${num(A.general)}"></label>
          <label style="margin:0 0 .3rem">نظام 3 أيام (جنيه)<input type="number" min="0" step="any" data-plg3 value="${num(M.general3)}" placeholder="${num(A.general3)}"></label></div>
        ${A.cats.length ? `<h3 style="font-size:1rem;margin:.8rem 0 .4rem">الفئات</h3><div class="tbl"><table><tr><th class="qnm">الفئة</th><th>العام</th><th>لهذا المكان (جنيه)</th></tr>
          ${A.cats.map(c => `<tr><td class="qnm">${esc(c.name)}</td><td>${money(c.amount)}</td><td><input type="number" min="0" step="any" data-plc="${esc(c.id)}" value="${num(M.cats[c.id])}" placeholder="${num(c.amount)}" style="width:7rem"></td></tr>`).join('')}</table></div>` : ''}
        ${discs.length ? `<h3 style="font-size:1rem;margin:.8rem 0 .4rem">الخصومات والإعفاءات</h3><div class="tbl"><table><tr><th class="qnm">الخصم</th><th>العام</th><th>لهذا المكان</th></tr>
          ${discs.map(d => `<tr><td class="qnm">${esc(d.name)}</td><td>${discTxt(d, d.value)}</td><td><input type="number" min="0" step="any" data-pld="${esc(d.id)}" value="${num(PD[d.id])}" placeholder="${num(d.value)}" style="width:6rem"> ${d.type === 'amt' ? 'جنيه' : '%'}</td></tr>`).join('')}</table></div>
          <p class="muted" style="font-size:.82rem;margin:.3rem 0 0">قيم الخصومات واحدة لكل الفترات. الخصم الذي «يُحدَّد لكل طالب» لا يظهر هنا.</p>` : ''}
        <p class="muted" style="font-size:.82rem;margin:.6rem 0 0">لتغيير المبالغ ابتداءً من شهر بعينه: «إعدادات الاشتراك» ← «+ تغيير المبلغ ابتداءً من شهر…»، ثم تعود هنا لمبالغ المكان في الفترة الجديدة.</p>
        <div class="row"><button type="button" class="btn primary" data-plsave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    const val = x => (x.value === '' ? null : +x.value);
    const read = () => {
      const M = { general: val(ov.querySelector('[data-plg]')), general3: val(ov.querySelector('[data-plg3]')), cats: {} };
      ov.querySelectorAll('[data-plc]').forEach(x => { if (x.value !== '') M.cats[x.dataset.plc] = +x.value; });
      stash[curK] = M;
      ov.querySelectorAll('[data-pld]').forEach(x => { if (x.value === '') delete PD[x.dataset.pld]; else PD[x.dataset.pld] = +x.value; });
    };
    draw(); document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-plpk]')) { read(); curK = e.target.value; draw(); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (!e.target.closest('[data-plsave]')) return;
      read();
      const bad = x => x != null && (!isNum(x) || x < 0);
      for (const [k, M] of Object.entries(stash)) if ([M.general, M.general3, ...Object.values(M.cats)].some(bad)) { toast(`مبلغ غير صحيح (${pLabel(k)})`); return; }
      if (Object.values(PD).some(bad)) { toast('قيمة خصم غير صحيحة'); return; }
      if (discs.some(d => d.type !== 'amt' && +PD[d.id] > 100)) { toast('نسبة الخصم لا تزيد على 100%'); return; }
      /* المبالغ في كل فترة عُدّلت؛ وأول مرة تُثبَّت مبالغ هذه السنة كما كانت حتى لا تتغير مستحقاتها */
      const years = JSON.parse(JSON.stringify(live()));
      Object.entries(stash).forEach(([k, M]) => {
        const Y = years[k] = years[k] || {}; Y.places = Y.places && typeof Y.places === 'object' ? Y.places : {};
        const has = M.general != null || M.general3 != null || Object.keys(M.cats).length;
        if (has) Y.places[pid] = { general: M.general, general3: M.general3, ...(Object.keys(M.cats).length ? { cats: M.cats } : {}) }; else delete Y.places[pid];
      });
      const cur = amountsOf(pickYear(years, yNow, mNow) || {});
      const pds = { ...(F0.placeDiscs || {}) }; if (Object.keys(PD).length) pds[pid] = PD; else delete pds[pid];
      db.settings.priv_fees = { ...F0, v: 3, general: cur.general, general3: cur.general3, places: cur.places, cats: cur.cats, years, placeDiscs: pds };
      ov.remove(); save(); render(); toast(`حُفظ اشتراك «${pl.name}»`);
    });
  }
  /* هل للمكان مبالغ أو قيم خاصة (في الفترة السارية الآن أو أي فترة) */
  const placeHas = pid => { const F = db.settings.priv_fees || {}; return !!(F.placeDiscs?.[pid] && Object.keys(F.placeDiscs[pid]).length) || Object.values(yearsOf()).some(Y => Y?.places?.[pid]) || !!F.places?.[pid]; };
  window.QLFeePlace = { open: placeDialog, has: placeHas, can: () => can('fees.amount') };
  document.addEventListener('click', e => { const b = e.target.closest('[data-fee-place]'); if (b && can('fees.amount')) placeDialog(b.dataset.feePlace); });

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
    const [y, m] = e.target.value.split('-').map(Number); st.y = y; st.m = m;
    /* الشهر المختار يُقرأ من QLFees في بطاقة الاشتراكات (app-abs.js) وفي مستحقات العاملين (stuview.js)؛
       ومن بلا صلاحيات الاشتراك (المعلم والمشرف) لا تصل summary إلى ضبطه، فكانت القائمة لا تغيّر شيئًا */
    window.QLFees = { ...(window.QLFees || {}), y, m };
    render();
  });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-fee-pay]'); if (p) { if (can('fees.collect')) pay(p.dataset.feePay); return; }
    const l = e.target.closest('[data-fee-log]'); if (l) { log(l.dataset.feeLog); return; }
    const d = e.target.closest('[data-fee-del]'); if (d) { del(d.dataset.feeDel); return; }
    const g = e.target.closest('[data-fee-assign]'); if (g && can('fees.amount')) { assignDialog([byId(db.students, g.dataset.feeAssign)].filter(Boolean)); return; }
    if (e.target.closest('[data-fee-cfg]')) { if (can('fees.amount')) cfgDialog(); return; }   // المدير ومن له «قيمة الاشتراك» (المحاسب)
    if (e.target.closest('[data-fee-bulk]') && can('fees.amount')) {
      const visible = window._QLFeesVisibleList || filtered();
      assignDialog(visible);
    }
  });

  /* ===== واجهة الدمج: تُضمّن أعمدة الاشتراك في جدول الطلاب ===== */
  window.QLFeesEmbed = {
    summary(list) {
      if (!can('fees.collect') && !can('fees.amount')) { window.QLFees = { ...(window.QLFees || {}), y: st.y, m: st.m }; return ''; }
      const T = tally(list, st.y, st.m), unpaid = T.unpaid;
      const { expected, got, paidN, noneN, freeN, remaining, pct } = T;
      window.QLFees = { unpaid, y: st.y, m: st.m };
      window._QLFeesVisibleList = list;
      const feeRow = (cls, v, l) => `<div class="feerow ${cls}"><span>${esc(l)}</span><b>${v}</b></div>`;
      return `<div class="feecards">
        <div class="card feecard"><h3>الاشتراكات \u2014 ${MONTHS[st.m - 1]} ${st.y}</h3>
          ${feeRow('fr-ok', paidN, 'عدد المسددين')}
          ${feeRow('fr-no', noneN, 'عدد غير المسددين')}
          ${feeRow('fr-info', freeN, 'عدد المعفيين')}
        </div>
        <div class="card feecard"><h3>الإيرادات</h3>
          ${feeRow('fr-plain', money(expected), 'الإيرادات المتوقعة')}
          ${feeRow('fr-ok', money(got), 'الإيرادات الفعلية')}
          ${feeRow('fr-no', money(remaining), 'باقي المستحق')}
          <div class="feebar"><span style="width:${Math.min(pct, 100)}%"></span></div>
          <div class="feebar-label"><span>${pct}%</span><span>نسبة التحصيل</span></div>
          ${extraNote(T)}
        </div>
      </div>
      ${unpaid.length && can('fees.collect') ? `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${unpaid.length} طالب لم يسدّد اشتراك ${MONTHS[st.m - 1]}.</span><button type="button" class="btn sm" data-remind-all="fees">تذكير غير المسددين (${unpaid.length})</button></div>` : ''}`;
    },
    toolbar() {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      return `<label style="margin:0">الشهر <select data-fmonth style="width:auto">${monthOpts(st.y, st.m).map(o => `<option value="${o.v}" ${o.sel ? 'selected' : ''}>${o.l}</option>`).join('')}</select></label>
      ${can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>إعدادات الاشتراك</button>' : ''}
      ${can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : ''}
      ${isAdmin() && window.QLFeeImport ? '<button type="button" class="btn" data-fee-import>استيراد دفعات</button>' : ''}`;
    },
    cells(s) {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      const D = dueOf(s), fee = D?.due ?? null, paid = paidFor(s.id, st.y, st.m), off = stOff(s);
      const dueCell = D ? (D.off ? `<span title="${money(D.base)} \u2212 ${money(D.off)}">${money(D.due)}</span> <small class="muted"><s>${money(D.base)}</s></small>` : money(D.due)) : '\u2014';
      const state = payState(fee, paid, off, '<span class="muted">\u2014</span>');
      return `<td>${dueCell}</td><td>${paid ? money(paid) : '\u2014'}</td><td>${state}</td>`;
    },
    actions(s) {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      const D = dueOf(s), fee = D?.due ?? null, paid = paidFor(s.id, st.y, st.m), off = stOff(s);
      const any = (pIndex(), pAny.has(s.id));
      const remind = can('fees.collect') && needsRemind(fee, paid, off) ? `<button type="button" class="btn sm" data-remind="${esc(s.id)}" title="تذكير بالسداد">تذكير</button>` : '';
      return `${can('fees.collect') ? `<button type="button" class="btn sm primary" data-fee-pay="${esc(s.id)}" ${cloudMissing() || fee === 0 ? 'disabled' : ''}>تحصيل</button>` : ''}${any ? `<button type="button" class="btn sm" data-fee-log="${esc(s.id)}">سجل الدفع</button>` : ''}${can('fees.amount') ? `<button type="button" class="btn sm" data-fee-assign="${esc(s.id)}">الفئة</button>` : ''}${remind}`;
    }
  };

  /* إعدادات اشتراك قديمة (بلا discs أو بلا v): الجهاز يكمّلها بالخصومات الافتراضية (ومنها «أيتام» 100%)، والخادم يقرأ المحفوظ وحده
     (fee_due_ym في supabase/fee_periods.sql)، فكان اليتيم معفى عند المدير ومطالبًا بالاشتراك عند المعلم. تُحفظ مكمّلة مرة واحدة عند المدير */
  function saveDefaultDiscs() {
    if (session?.role !== 'admin') return;
    const c = db.settings?.priv_fees;
    if (!c || typeof c !== 'object' || (Array.isArray(c.discs) && c.v)) return;
    db.settings.priv_fees = { ...c, discs: cfgBase().discs, v: c.v || 3 };
    save();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const base = render;
    render = function () { try { saveDefaultDiscs(); } catch (e) { console.error('fees discs:', e); } return base.apply(this, arguments); };
  });
})();
