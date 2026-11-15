'use strict';
/* ============ إضافات استيراد الطلاب ============
   - «معرف الحلقة»: يحدد الحلقة بدقة (من ملفات يجهّزها النظام)، حتى لو تشابهت أسماء الحلقات أو تغيّرت.
   - «الحالة»: «منقطع» يُسجَّل الطالب منقطعًا بتاريخ اليوم؛ وغيرها منتظم.
   - «رقم الطالب القديم»: يُحفظ في بياناته للرجوع إليه.
   - المكرر: إن حدد الملف «معرف الحلقة» فالمكرر هو الاسم نفسه في الحلقة نفسها فقط
     (فلا يُتجاهل طالب لمجرد تشابه اسمه مع طالب في حلقة أخرى).
   يُحمَّل بعد app-forms.js، ويغلّف دوال الاستيراد فيه دون تغييرها. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./importx.js')) VFILES.push('./importx.js'); } catch (e) { /* ignore */ } });
  const baseTargets = fieldTargets;
  fieldTargets = function (kind) {
    const L = baseTargets(kind);
    if (kind === 'students') L.push({ id: 'core:halaqaId', label: 'معرف الحلقة', syn: ['halaqa_id'] },
      { id: 'info:status', label: 'الحالة', syn: ['حالة الطالب'] }, { id: 'info:oldCode', label: 'رقم الطالب القديم', syn: ['المعرف', 'الكود'] });
    return L;
  };
  const baseRows = importRows;
  importRows = function (table, kind) {
    const r = baseRows(table, kind);
    if (r.err || kind !== 'students' || !r.cols.some(c => c.id === 'core:halaqaId')) return r;
    const seen = new Set(db.students.map(m => norm(m.name) + '|' + (m.halaqaId || '')));
    r.rows.forEach(x => {
      const h = byId(db.halaqat, x.vals['core:halaqaId']);
      if (h) x.halaqa = halaqaLabel(h);   // الحلقة بالمعرّف: اسمها الحالي، فيجدها الاستيراد بدقة
      const k = norm(x.name) + '|' + (h ? h.id : '');
      x.dup = seen.has(k); seen.add(k);
    });
    return r;
  };
  const baseSet = setField;
  setField = function (m, id, v) {
    if (id === 'core:halaqaId') return;
    if (id === 'info:status') { m.info = m.info || {}; if (/منقطع/.test(v)) { m.info.status = 'منقطع'; m.info.statusDate = m.info.statusDate || today(); } return; }
    return baseSet(m, id, v);
  };
})();
