'use strict';
/* ============ لا يُسجَّل طالب باسم طالب موجود ============
   في استمارة الطالب (إضافة أو تعديل) وفي «طالب مستقل» من «مكرر للمراجعة»:
   - يُقارن الاسم بكل الطلاب بعد توحيد الحروف وحذف المسافات (فـ«عبدالله» = «عبد الله»، و«أحمد» = «احمد»).
   - إن وُجد طالب بالاسم نفسه في المكان نفسه يُرفض الحفظ، ويظهر تحت خانة الاسم: من هو، وفي أي حلقة ومكان، وكيف يُميَّز الاسم.
   - وفي مكان آخر يُسمح بالاسم نفسه (المكان يميّز بينهما) مع تنبيه بذلك.
   - «طالب مستقل» في «مكرر للمراجعة» لا يمر من هنا إن كان مكانه مختلفًا: يُضاف باسمه كما هو (dups.js).
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
  const allTwins = (name, self) => { const k = key(name); return k ? db.students.filter(s => s.id !== self && key(s.name) === k) : []; };
  /* المكان يميّز: يُرفض الاسم المطابق في المكان نفسه (أو إن لم يُعرف مكان أحدهما)، ويُسمح به في مكان آخر */
  const formHal = ov => ov?.querySelector('select[name="halaqaId"]')?.value || '';
  const twins = (name, self, ov) => allTwins(name, self).filter(s => !ov?.querySelector('.sform') || samePlaceHal(s.halaqaId, formHal(ov)));
  const where = s => { const h = byId(db.halaqat, s.halaqaId); return h ? `${halaqaLabel(h)}${placeName(h) ? ' — ' + placeName(h) : ''}` : 'بلا حلقة'; };
  function show(inp, list, others = []) {
    let m = inp.parentElement.querySelector('.uq-msg');
    if (!list.length && others.length) {
      if (!m) { m = document.createElement('div'); m.className = 'uq-msg'; inp.after(m); }
      m.style.cssText = 'margin-top:.35rem;padding:.45rem .6rem;border-radius:8px;background:var(--gold-l,#f4ead6);font-size:.85rem;line-height:1.6';
      m.innerHTML = `يوجد بالاسم نفسه في مكان آخر: ${others.slice(0, 3).map(s => `«${esc(s.name)}» (${esc(where(s))})`).join('، ')}. <b>المكان يميّز بينهما</b>، فيمكنك الحفظ.`;
      inp.style.borderColor = ''; return false;
    }
    if (!list.length) { m?.remove(); inp.style.borderColor = ''; return false; }
    if (!m) { m = document.createElement('div'); m.className = 'uq-msg'; m.setAttribute('role', 'alert'); inp.after(m); }
    m.style.cssText = 'margin-top:.35rem;padding:.45rem .6rem;border-radius:8px;background:#fdecea;color:var(--red,#b3372f);font-size:.85rem;line-height:1.6';
    m.innerHTML = `<b>يوجد طالب بهذا الاسم في المكان نفسه:</b> ${list.slice(0, 3).map(s => `«${esc(s.name)}» (${esc(where(s))}${stOff(s) ? '، منقطع' : ''})`).join('، ')}${list.length > 3 ? ` و${list.length - 3} غيره` : ''}.<br>ميّز الاسم الجديد عنه، مثلًا بإضافة اسم الجد أو اسم العائلة، ثم احفظ.`;
    inp.style.borderColor = 'var(--red,#b3372f)';
    return true;
  }
  /* أثناء الكتابة */
  let t = 0;
  document.addEventListener('input', e => {
    const inp = e.target; if (inp.name !== 'name') return;
    const ov = inp.closest('.overlay'); if (!isStudentForm(ov)) return;
    clearTimeout(t); t = setTimeout(() => check(inp, ov), 250);
  });
  const check = (inp, ov) => { const self = ov.querySelector('.sform') ? editing : null, bad = twins(inp.value, self, ov); return show(inp, bad, allTwins(inp.value, self).filter(s => !bad.includes(s))); };
  /* تغيير الحلقة في الاستمارة يعيد الفحص (المكان قد يتغير) */
  document.addEventListener('change', e => { if (e.target.matches?.('.sform select[name="halaqaId"], .sform select[name="placeId"]')) { const ov = e.target.closest('.overlay'), inp = ov?.querySelector('input[name="name"]'); if (inp?.value) setTimeout(() => check(inp, ov), 0); } });
  /* عند الحفظ: يُرفض قبل أن يصل إلى حفظ الاستمارة */
  document.addEventListener('click', e => {
    const b = e.target.closest('.overlay [data-save]'); if (!b) return;
    const ov = b.closest('.overlay'); if (!isStudentForm(ov)) return;
    const inp = ov.querySelector('input[name="name"]'); if (!inp) return;
    if (check(inp, ov)) {
      e.stopImmediatePropagation(); e.preventDefault();
      inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('الاسم مسجّل لطالب آخر في المكان نفسه — ميّزه أولًا');
    }
  }, true);
})();
