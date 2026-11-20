'use strict';
/* ============ طلاب «غير مصنفين» (بلا حلقة) ============
   الطالب لا يُحذف أبدًا بحذف حلقته أو مكانها: تُفرَّغ حلقته فيصير «غير مصنف» حتى يُتخذ فيه قرار.
   - «الأعضاء» ← «غير مصنف»: بطاقة «طلاب غير مصنفين (بلا حلقة)» لتعيين حلقة لكل طالب أو لعدة طلاب معًا،
     وعددهم يُضاف إلى عدد «غير مصنف» في القائمة.
   - رسالتا حذف الحلقة والمكان توضّحان ذلك. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./unassigned.js')) VFILES.push('./unassigned.js'); } catch (e) { /* ignore */ } }, 0);
  const noHal = () => db.students.filter(s => !s.halaqaId || !byId(db.halaqat, s.halaqaId)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  window.QLNoHalaqa = noHal;
  const pick = new Set();
  const short = h => { const t = byId(db.teachers, h.teacherId); return t ? 'حلقة ' + t.name : (h.name || 'حلقة بلا معلم'); };
  /* الحلقات مجمّعة تحت أماكنها (وما بلا مكان آخرًا) */
  function hOpts() {
    const g = new Map();
    db.halaqat.forEach(h => { const k = placeName(h) || 'بلا مكان'; if (!g.has(k)) g.set(k, []); g.get(k).push(h); });
    const keys = [...g.keys()].sort((a, b) => (a === 'بلا مكان') - (b === 'بلا مكان') || a.localeCompare(b, 'ar'));
    return keys.map(k => `<optgroup label="${esc(k)}">${g.get(k).sort((a, b) => short(a).localeCompare(short(b), 'ar')).map(h => `<option value="${esc(h.id)}">${esc(short(h))}</option>`).join('')}</optgroup>`).join('');
  }
  function card() {
    const L = noHal();
    [...pick].forEach(id => { if (!L.some(s => s.id === id)) pick.delete(id); });
    const rows = L.map((s, i) => `<tr><td><input type="checkbox" data-uasel="${esc(s.id)}" ${pick.has(s.id) ? 'checked' : ''} style="width:auto;margin:0" aria-label="تحديد ${esc(s.name)}"></td><td>${i + 1}</td><td>${esc(s.name)}${stOff(s) ? ' <span class="tag tag-no">منقطع</span>' : ''}</td><td>${CATS[s.cat || 'child']}</td>
      <td><select data-uah="${esc(s.id)}" aria-label="حلقة ${esc(s.name)}"><option value="">— اختر الحلقة —</option>${hOpts()}</select></td></tr>`).join('');
    return `<div class="card"><h2>طلاب غير مصنفين (بلا حلقة) <span class="muted" style="font-size:.9rem">(${L.length})</span></h2>
      <p class="muted" style="margin:0 0 .6rem;font-size:.88rem">طلاب حُذفت حلقاتهم أو لم تُحدَّد لهم حلقة بعد. لا يُحذف طالب بحذف حلقته أو مكانها، بل يبقى هنا حتى تختار له حلقة.</p>
      ${L.length ? `<div class="bar" style="margin:0 0 .5rem"><label class="chk" style="margin:0"><input type="checkbox" data-uaall ${L.every(s => pick.has(s.id)) ? 'checked' : ''}> تحديد الكل</label>
        <span class="grow"></span><select data-uato aria-label="نقل المحدد إلى"><option value="">— نقل المحدد إلى حلقة —</option>${hOpts()}</select>
        <button type="button" class="btn primary" data-uamove>نقل المحدد (${pick.size})</button></div>
        <div class="tbl"><table><tr><th></th><th>#</th><th>الطالب</th><th>الفئة</th><th>الحلقة</th></tr>${rows}</table></div>` : empty('لا يوجد طلاب بلا حلقة ✓')}</div>`;
  }
  const base = adminViews.members;
  adminViews.members = () => {
    let h = base();
    const n = noHal().length;
    /* عدد «غير مصنف» في القائمة يشمل الطلاب بلا حلقة */
    if (n) h = h.replace(/(<option value="unclassified"[^>]*>غير مصنف \()(\d+)(\))/, (m, a, k, c) => a + (+k + n) + c);
    if (ui.msub === 'unclassified') h = h.replace(/<\/div>\s*$/, card() + '</div>');
    return h;
  };
  const move = (ids, to) => {
    const hal = byId(db.halaqat, to); if (!hal || !ids.length) return;
    db.students.forEach(s => { if (ids.includes(s.id)) s.halaqaId = to; });
    ids.forEach(id => pick.delete(id)); save(); render();
    toast(`نُقل ${ids.length} طالب إلى ${short(hal)}${placeName(hal) ? ' — ' + placeName(hal) : ''}`);
  };
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset?.uah) { if (t.value) move([t.dataset.uah], t.value); return; }
    if (t.dataset?.uasel) { t.checked ? pick.add(t.dataset.uasel) : pick.delete(t.dataset.uasel); const b = document.querySelector('[data-uamove]'); if (b) b.textContent = `نقل المحدد (${pick.size})`; return; }
    if (t.matches?.('[data-uaall]')) { noHal().forEach(s => (t.checked ? pick.add(s.id) : pick.delete(s.id))); render(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-uamove]')) return;
    const to = document.querySelector('[data-uato]')?.value;
    if (!pick.size) { toast('حدّد الطلاب أولًا'); return; }
    if (!to) { toast('اختر الحلقة'); return; }
    move([...pick], to);
  });
  /* رسالتا الحذف: الطلاب لا يُحذفون (A يُعرَّف في app-actions.js الذي يُحمَّل بعد هذا الملف) */
  document.addEventListener('DOMContentLoaded', () => {
  A.delHalaqa = d => {
    const h = byId(db.halaqat, d.id), n = db.students.filter(s => s.halaqaId === d.id).length;
    /* قائمة تحصيل لم تُراجَع لهذه الحلقة (على الخادم): تُراجَع أولًا، وإلا بقيت بلا حلقة */
    if ((db.collections || []).some(c => c.status !== 'done' && c.halaqaId === d.id)) { toast('لهذه الحلقة قائمة تحصيل لم تُراجَع بعد — راجعها في «تحصيل المعلمين» ثم احذف الحلقة'); return; }
    ask(`حذف ${h ? short(h) : 'الحلقة'}؟${n ? ` ينتقل طلابها (${n}) إلى «الأعضاء» ← «غير مصنف» حتى تختار لهم حلقة.` : ''}`, () => {
      db.halaqat = db.halaqat.filter(x => x.id !== d.id); db.students.forEach(s => { if (s.halaqaId === d.id) s.halaqaId = ''; });
      save(); render(); if (n) toast(`انتقل ${n} طالب إلى «غير مصنف»`);
    });
  };
  A.delPlace = d => {
    const p = byId(db.places, d.id), n = db.halaqat.filter(h => h.placeId === d.id).length;
    ask(`حذف ${p ? '«' + p.name + '»' : 'المكان'}؟${n ? ` تبقى حلقاته (${n}) وطلابها، وتنتقل إلى «حلقات لم يُحدَّد مكانها».` : ''}`, () => {
      db.places = db.places.filter(x => x.id !== d.id); db.halaqat.forEach(h => { if (h.placeId === d.id) h.placeId = ''; });
      save(); render();
    });
  };
  });
})();
