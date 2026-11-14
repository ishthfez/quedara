'use strict';
/* ============ تتابع المكان ← الحلقة ← الطلاب في صفحة «الطلاب» (للمدير) ============
   قائمة «كل الأماكن» قبل «كل الحلقات»: بعد اختيار مكان لا تظهر في قائمة الحلقات إلا حلقاته،
   ولا يظهر في الجدول إلا طلابه (ومع الحلقة: طلابها). الحلقة المختارة من مكان آخر تُلغى تلقائيًا.
   (مربعات البحث في «الاشتراكات» تتتابع بالطريقة نفسها من fees.js وaccountant.js) */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./cascade.js')) VFILES.push('./cascade.js'); } catch (e) { /* ignore */ } }, 0);
  const inPl = h => !ui.fp || (!!h && h.placeId === ui.fp);
  const base = adminViews.students;
  adminViews.students = () => {
    if (ui.fp && !byId(db.places, ui.fp)) ui.fp = '';
    if (ui.fh && !inPl(byId(db.halaqat, ui.fh))) ui.fh = '';
    const all = db.students;
    let html;
    if (ui.fp) db.students = all.filter(s => inPl(byId(db.halaqat, s.halaqaId)));
    try { html = base(); } finally { db.students = all; }
    if (ui.fp) html = html.replace(/<select data-change="fh">[\s\S]*?<\/select>/, sel => sel.replace(/<option value="([^"]+)"[^>]*>[^<]*<\/option>/g, (m, id) => (inPl(byId(db.halaqat, id)) ? m : '')));
    const places = db.places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const pSel = `<select data-fplace aria-label="المكان"><option value="">كل الأماكن</option>${places.map(p => `<option value="${esc(p.id)}" ${p.id === ui.fp ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
    return html.replace('<select data-change="fh">', pSel + '<select data-change="fh">');
  };
  document.addEventListener('change', e => {
    if (!e.target.matches?.('[data-fplace]')) return;
    ui.fp = e.target.value; if (ui.fh && !inPl(byId(db.halaqat, ui.fh))) ui.fh = ''; render();
  });
})();
