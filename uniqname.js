'use strict';
/* ============ لا يُسجَّل طالب باسم طالب موجود ============
   في استمارة الطالب (إضافة أو تعديل) وفي «طالب مستقل» من «مكرر للمراجعة»:
   - يُقارن الاسم بكل الطلاب بعد توحيد الحروف وحذف المسافات (فـ«عبدالله» = «عبد الله»، و«أحمد» = «احمد»).
   - إن وُجد طالب بالاسم نفسه يُرفض الحفظ، ويظهر تحت خانة الاسم: من هو، وفي أي حلقة ومكان، وكيف يُميَّز الاسم.
   - ويظهر التنبيه أثناء الكتابة أيضًا، قبل الضغط على «حفظ».
   يُحمَّل قبل app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./uniqname.js')) VFILES.push('./uniqname.js'); } catch (e) { /* ignore */ } });
  const key = n => norm(String(n || '')).replace(/\s+/g, '');
  let editing = null;   // معرّف الطالب المفتوح للتعديل (فلا يُعدّ اسمه مكررًا لنفسه)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="editStudent"]'); if (b) editing = b.dataset.id || null;
    else if (e.target.closest('[data-act="addStudent"]')) editing = null;
  }, true);
  const isStudentForm = ov => !!ov && (ov.querySelector('.sform') || /إضافة طالب مستقل/.test(ov.querySelector('h2')?.textContent || ''));
  const twins = (name, self) => { const k = key(name); return k ? db.students.filter(s => s.id !== self && key(s.name) === k) : []; };
  const where = s => { const h = byId(db.halaqat, s.halaqaId); return h ? `${halaqaLabel(h)}${placeName(h) ? ' — ' + placeName(h) : ''}` : 'بلا حلقة'; };
  function show(inp, list) {
    let m = inp.parentElement.querySelector('.uq-msg');
    if (!list.length) { m?.remove(); inp.style.borderColor = ''; return false; }
    if (!m) { m = document.createElement('div'); m.className = 'uq-msg'; m.setAttribute('role', 'alert'); inp.after(m); }
    m.style.cssText = 'margin-top:.35rem;padding:.45rem .6rem;border-radius:8px;background:#fdecea;color:var(--red,#b3372f);font-size:.85rem;line-height:1.6';
    m.innerHTML = `<b>يوجد طالب بهذا الاسم:</b> ${list.slice(0, 3).map(s => `«${esc(s.name)}» (${esc(where(s))}${stOff(s) ? '، منقطع' : ''})`).join('، ')}${list.length > 3 ? ` و${list.length - 3} غيره` : ''}.<br>ميّز الاسم الجديد عنه، مثلًا بإضافة اسم الجد أو اسم العائلة، ثم احفظ.`;
    inp.style.borderColor = 'var(--red,#b3372f)';
    return true;
  }
  /* أثناء الكتابة */
  let t = 0;
  document.addEventListener('input', e => {
    const inp = e.target; if (inp.name !== 'name') return;
    const ov = inp.closest('.overlay'); if (!isStudentForm(ov)) return;
    clearTimeout(t); t = setTimeout(() => show(inp, twins(inp.value, ov.querySelector('.sform') ? editing : null)), 250);
  });
  /* عند الحفظ: يُرفض قبل أن يصل إلى حفظ الاستمارة */
  document.addEventListener('click', e => {
    const b = e.target.closest('.overlay [data-save]'); if (!b) return;
    const ov = b.closest('.overlay'); if (!isStudentForm(ov)) return;
    const inp = ov.querySelector('input[name="name"]'); if (!inp) return;
    if (show(inp, twins(inp.value, ov.querySelector('.sform') ? editing : null))) {
      e.stopImmediatePropagation(); e.preventDefault();
      inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('الاسم مسجّل لطالب آخر — ميّزه أولًا');
    }
  }, true);
})();
