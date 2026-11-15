'use strict';
/* ============ «مكرر للمراجعة»: إضافة الباقين مستقلين بضغطة واحدة ============
   كل اسم في القائمة حلقتُه في الملف معروفة ولها مكان، وكل من يحمل اسمه في مكان آخر،
   يُضاف طالبًا مستقلًا في حلقته باسمه كما هو: المكان يميّز بينهما (القاعدة نفسها في استمارة الطالب).
   يبقى في القائمة (ويُذكر عددهم وسببهم):
     - من حلقته في الملف غير محددة أو بلا مكان: لا مكان يميّزه.
     - من يوجد باسمه طالب في المكان نفسه، أو طالب بلا حلقة: يحتاج قرارك (دمج أو تمييز الاسم).
     - اسمان في القائمة نفسها بالمكان نفسه: يُضاف الأول ويبقى الثاني.
     - ما جاء من ملف الدفعات: يُصلَح بزر «إصلاح».
   لا يغيّر شيئًا إلا بضغطة المدير وتأكيده. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./dupsall.js')) VFILES.push('./dupsall.js'); } catch (e) { /* ignore */ } });
  const PAYH = ['معرف الطالب', 'المكان في الكشف', 'السنة', 'الشهر', 'المبلغ', 'التاريخ', 'الخصم', 'المطلوب'];
  const list = () => db.payroll?.settings?.dup_students || [];
  const placeOfS = s => byId(db.halaqat, s.halaqaId)?.placeId || '';
  const halsOf = x => (window.QLFixPay?.halsOf ? window.QLFixPay.halsOf(x) : []);

  /* الفرز: من يُضاف ومن يبقى ولماذا */
  function plan() {
    const byName = new Map(); db.students.forEach(s => { const k = norm(s.name); byName.set(k, [...(byName.get(k) || []), s]); });
    const taken = new Set();   // اسم|مكان أُضيف في هذه الدفعة
    const add = [], noPlace = [], samePlace = [], pay = [];
    list().forEach(x => {
      if (Object.keys(x.extra || {}).some(h => PAYH.includes(String(h).trim()))) { pay.push(x); return; }
      const hs = halsOf(x), h0 = hs.length === 1 ? hs[0] : null;
      if (!h0?.placeId) { noPlace.push(x); return; }
      const k = norm(x.name), key = k + '|' + h0.placeId;
      const twins = byName.get(k) || [];
      if (taken.has(key) || twins.some(s => !placeOfS(s) || placeOfS(s) === h0.placeId)) { samePlace.push(x); return; }
      taken.add(key); add.push({ x, h: h0 });
    });
    return { add, noPlace, samePlace, pay };
  }

  /* إنشاء الطالب: في حلقته، ومعه جواله وبياناته (والأعمدة الإضافية في «بيانات معلّقة» كبقية الاستيراد) */
  function create(x, h) {
    const m = { id: uid(), name: x.name, halaqaId: h.id, phone: '', pin: genPass() };
    Object.entries(x.vals || {}).forEach(([k, val]) => { if (k !== 'core:halaqa' && k !== 'core:halaqaId') setField(m, k, val); });
    db.students.push(m);
    Object.entries(x.extra || {}).forEach(([header, val]) => {
      const p = db.pending.find(pp => pp.kind === 'students' && pp.header === header);
      if (p) p.values.push({ mid: m.id, v: val }); else db.pending.push({ id: uid(), kind: 'students', header, values: [{ mid: m.id, v: val }], date: today() });
    });
  }
  function run() {
    const r = plan(); if (!r.add.length) { toast('لا يوجد من يُضاف: الباقون لا يميّزهم المكان'); return; }
    const ids = new Set(r.add.map(a => a.x.id));
    r.add.forEach(({ x, h }) => create(x, h));
    db.payroll.settings.dup_students = list().filter(x => !ids.has(x.id));
    save(); render();
    const left = list().length;
    toast(`أُضيف ${r.add.length} طالبًا مستقلًا بأسمائهم${left ? ` — بقي ${left} للمراجعة` : ' — القائمة فارغة ✓'}`);
  }

  function dialog() {
    const r = plan();
    const ov = document.createElement('div'); ov.className = 'overlay';
    const li = (n, t) => n ? `<li><b>${n}</b> ${t}</li>` : '';
    ov.innerHTML = `<div class="modal"><h2>إضافة الباقين طلابًا مستقلين</h2>
      <p style="margin:0 0 .6rem">يُضاف كل واحد في حلقته من الملف <b>باسمه كما هو</b>، والمكان يميّز بينه وبين صاحب الاسم نفسه.</p>
      <ul style="margin:0 0 .6rem;padding-inline-start:1.2rem;line-height:1.9">
        ${li(r.add.length, 'يُضافون الآن (الاسم نفسه موجود في مكان آخر فقط).')}
        ${li(r.noPlace.length, 'يبقون: حلقتهم في الملف غير محددة أو بلا مكان، فلا مكان يميّزهم.')}
        ${li(r.samePlace.length, 'يبقون: بالاسم نفسه طالب في المكان نفسه أو بلا حلقة، فيحتاجون قرارك.')}
        ${li(r.pay.length, 'يبقون: من ملف الدفعات، يُصلَحون بزر «إصلاح».')}</ul>
      <p class="note" style="margin:0 0 .6rem"><b>احفظ نسخة احتياطية قبل التنفيذ</b> (الإعدادات ← النسخ الاحتياطية).</p>
      <div class="row"><button type="button" class="btn primary" data-dallok ${r.add.length ? '' : 'disabled'}>إضافة ${r.add.length}</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-dallok]').onclick = () => { ov.remove(); run(); };
  }
  window.QLDupsAll = { plan };

  /* ===== «إضافة الكل مستقلين»: قرار المدير لكل الباقين، بلا فرز =====
     جدول بكل الباقين: الاسم (يُعدَّل إن شئت) والحلقة (من الملف، أو تختارها لمن حلقته غير محددة)،
     وتنبيه أصفر لمن بالاسم نفسه طالب في المكان نفسه أو بلا حلقة — للعلم فقط، لا يمنع الإضافة.
     ما جاء من ملف الدفعات لا يُضاف هنا (يُصلَح بزر «إصلاح»). */
  const isPay = x => Object.keys(x.extra || {}).some(h => PAYH.includes(String(h).trim()));
  function allDialog() {
    const L = list().filter(x => !isPay(x)), payN = list().length - L.length;
    if (!L.length) { toast('لا يوجد من يُضاف'); return; }
    const hals = db.halaqat.slice().sort((a, b) => (placeName(a) || '').localeCompare(placeName(b) || '', 'ar') || halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
    const hlbl = h => { const l = halaqaLabel(h), pn = placeName(h); return pn && !l.includes(pn) ? `${l} — ${pn}` : l; };
    const twinsTxt = (name, hid) => {
      const pid = byId(db.halaqat, hid)?.placeId || '';
      const tw = db.students.filter(s => norm(s.name) === norm(name));
      if (!pid) return tw.length ? `بلا حلقة، وبالاسم نفسه ${tw.length > 1 ? tw.length + ' طلاب' : 'طالب'} موجود` : '';
      const same = tw.filter(s => !placeOfS(s) || !pid || placeOfS(s) === pid);
      return same.length ? `بالاسم نفسه ${same.length > 1 ? same.length + ' طلاب' : 'طالب'} ${same.some(s => !placeOfS(s)) ? 'بلا حلقة أو ' : ''}في المكان نفسه` : '';
    };
    const rows = L.map((x, i) => {
      const hs = halsOf(x), h0 = hs.length === 1 ? hs[0] : null;
      const opts = `<option value="">بلا حلقة</option>${hals.map(h => `<option value="${esc(h.id)}" ${h0?.id === h.id ? 'selected' : ''}>${esc(hlbl(h))}</option>`).join('')}`;
      const w = twinsTxt(x.name, h0?.id || '');
      return `<div class="darow" data-darow="${esc(x.id)}"><b class="dan">${i + 1}</b><div class="dab">
        <input data-daname value="${esc(x.name)}" aria-label="اسم الطالب ${i + 1}">
        <select data-dahal data-nosearch aria-label="حلقة الطالب ${i + 1}">${opts}</select>
        <small class="muted">في الملف: ${esc(x.halaqa || 'بلا حلقة')}</small><small data-dawarn class="daw">${w ? '⚠ ' + esc(w) : ''}</small></div></div>`;
    }).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>إضافة الكل طلابًا مستقلين (${L.length})</h2>
      <p style="margin:0 0 .6rem">كل واحد يُضاف طالبًا جديدًا مستقلًا. عدّل الاسم أو الحلقة إن شئت، ثم «إضافة الكل». التنبيه الأصفر للعلم فقط ولا يمنع الإضافة.${payN ? ` <b>${payN}</b> من ملف الدفعات لا يُضافون هنا (زر «إصلاح»).` : ''}</p>
      <style>.darow{display:flex;gap:.6rem;align-items:flex-start;padding:.6rem 0;border-top:1px solid var(--line,#e5e7eb)}.darow .dan{min-width:1.6rem;padding-top:.5rem;color:var(--muted,#777)}
        .darow .dab{flex:1;min-width:0;display:grid;gap:.35rem}.darow input,.darow select{width:100%;max-width:100%}.darow .daw{color:#8a6d0b;font-weight:700}.darow .daw:empty{display:none}</style>
      <div>${rows}</div>
      <p class="note" style="margin:.6rem 0">احفظ نسخة احتياطية قبل التنفيذ (الإعدادات ← النسخ الاحتياطية).</p>
      <div class="row"><button type="button" class="btn primary" data-daok>إضافة الكل (${L.length})</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const upd = tr => { const n = tr.querySelector('[data-daname]').value.trim(), w = twinsTxt(n, tr.querySelector('[data-dahal]').value); tr.querySelector('[data-dawarn]').textContent = w ? '⚠ ' + w : ''; };
    ov.addEventListener('input', e => { const tr = e.target.closest('[data-darow]'); if (tr) upd(tr); });
    ov.addEventListener('change', e => { const tr = e.target.closest('[data-darow]'); if (tr) upd(tr); });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-daok]').onclick = () => {
      const picks = [...ov.querySelectorAll('[data-darow]')].map(tr => ({ x: L.find(y => y.id === tr.dataset.darow), name: tr.querySelector('[data-daname]').value.trim().replace(/\s+/g, ' '), h: byId(db.halaqat, tr.querySelector('[data-dahal]').value) }));
      const bad = picks.find(p => !p.name); if (bad) { toast('اكتب اسم كل طالب'); return; }
      const ids = new Set();
      picks.forEach(({ x, name, h }) => { if (!x) return; create({ ...x, name }, h || { id: '' }); ids.add(x.id); });
      db.payroll.settings.dup_students = list().filter(x => !ids.has(x.id));
      ov.remove(); save(); render();
      const left = list().length;
      toast(`أُضيف ${ids.size} طالبًا مستقلًا${left ? ` — بقي ${left} (من ملف الدفعات)` : ' — القائمة فارغة ✓'}`);
    };
  }

  /* الزر في «مكرر للمراجعة»، تحت الملاحظة (وبعد شريط «دمج من في المكان نفسه» إن وُجد) */
  let cache = null, csig = '';
  const sig = () => `${list().length}|${db.students.length}|${db.halaqat.length}`;
  new MutationObserver(() => {
    if (session?.role !== 'admin' || (window.QLView ? window.QLView() : ui.tab) !== 'dups' || ui.msub !== 'dups') return;
    if (document.querySelector('[data-dupsall]')) return;
    const note = document.querySelector('main .card > .note:not([data-fixpay])'); if (!note) return;
    const g = sig(); if (g !== csig) { csig = g; cache = plan(); }
    const allN = list().filter(x => !isPay(x)).length;
    if (!cache.add.length && !allN) return;
    const at = note.nextElementSibling?.querySelector?.('[data-samego]') ? note.nextElementSibling : note;
    at.insertAdjacentHTML('afterend', `<div class="bar" data-dupsall style="margin:.2rem 0 .7rem"><span class="muted grow" style="font-size:.88rem">${cache.add.length ? `${cache.add.length} اسمًا صاحبُ اسمهم في مكان آخر فقط: يُضافون بأسمائهم كما هي، والمكان يميّز` : 'اعتبار الباقين كلهم طلابًا مستقلين (تراجع الاسم والحلقة لكل واحد قبل الإضافة)'}</span>
      ${cache.add.length ? `<button type="button" class="btn sm primary" data-dupsgo>إضافة الباقين مستقلين (${cache.add.length})</button>` : ''}${allN ? `<button type="button" class="btn sm" data-dupsevery>إضافة الكل مستقلين (${allN})</button>` : ''}</div>`);
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    if (session?.role !== 'admin') return;
    if (e.target.closest('[data-dupsgo]')) dialog();
    else if (e.target.closest('[data-dupsevery]')) allDialog();
  });
})();
