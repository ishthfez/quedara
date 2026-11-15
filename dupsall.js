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

  /* الزر في «مكرر للمراجعة»، تحت الملاحظة (وبعد شريط «دمج من في المكان نفسه» إن وُجد) */
  let cache = null, csig = '';
  const sig = () => `${list().length}|${db.students.length}|${db.halaqat.length}`;
  new MutationObserver(() => {
    if (session?.role !== 'admin' || (window.QLView ? window.QLView() : ui.tab) !== 'dups' || ui.msub !== 'dups') return;
    if (document.querySelector('[data-dupsall]')) return;
    const note = document.querySelector('main .card > .note:not([data-fixpay])'); if (!note) return;
    const g = sig(); if (g !== csig) { csig = g; cache = plan(); }
    if (!cache.add.length) return;
    const at = note.nextElementSibling?.querySelector?.('[data-samego]') ? note.nextElementSibling : note;
    at.insertAdjacentHTML('afterend', `<div class="bar" style="margin:.2rem 0 .7rem"><span class="muted grow" style="font-size:.88rem">${cache.add.length} اسمًا صاحبُ اسمهم في مكان آخر فقط: يُضافون بأسمائهم كما هي، والمكان يميّز</span>
      <button type="button" class="btn sm primary" data-dupsall>إضافة الباقين مستقلين (${cache.add.length})</button></div>`);
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => { if (e.target.closest('[data-dupsall]') && session?.role === 'admin') dialog(); });
})();
