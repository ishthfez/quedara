'use strict';
/* ============ «توزيع بالنص» في الأماكن والحلقات (للمدير) ============
   يُلصق نص بهذا الشكل:
       التوحيد بلبيس فيه حلقات
       هيثم
       أحمد رضا
       ومشرفهم عبد الرحمن الزهار
       (سطر فارغ ثم المكان التالي…)
   فيُعرف المكان (موجود أو يُنشأ)، ومعلم كل سطر بالاسم المختصر، والمشرف،
   ثم تُعرض معاينة: كل حلقة بمكانها الحالي ← الجديد، وما لم يُعرف أو احتمل أكثر من شخص يُختار يدويًا.
   لا يُنفَّذ شيء قبل «تنفيذ التوزيع». */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./distribute.js')) VFILES.push('./distribute.js'); } catch (e) { /* ignore */ } }, 0);
  const toks = s => norm(String(s || '')).replace(/[0-9٠-٩]+/g, ' ').split(' ').filter(Boolean);
  const STOP = new Set(['مسجد', 'دار', 'تحفيظ', 'جمعيه', 'الجمعيه']);
  const ptoks = s => toks(s).filter(w => !STOP.has(w));
  const subseq = (a, b) => { let i = 0; for (const w of b) if (w === a[i]) i++; return i === a.length; };
  /* أقرب شخص للاسم: تام 5، أحد الاسمين بداية متصلة للآخر 4، يبدآن بالكلمة نفسها وكلمات الأقصر بالترتيب في الأطول 3،
     كلمات الأقصر بالترتيب 2، كلمة واحدة هي الاسم الأول 1. المطابقة في الاتجاهين: الاسم في النص قد يكون أقصر من اسمه في التطبيق أو أطول.
     ولا يُعتمد إلا مرشح وحيد بأعلى درجة. */
  function matchPerson(q, list) {
    const Q0 = toks(q); if (!Q0.length) return { cands: [] };
    const sc = list.map(p => {
      const T0 = toks(p.name);
      if (!T0.length) return { p, s: 0 };
      const [Q, T] = Q0.length <= T0.length ? [Q0, T0] : [T0, Q0]; /* Q الأقصر */
      let s = 0;
      if (Q.join(' ') === T.join(' ')) s = 5;
      else if (Q.length >= 2 && Q.every((w, i) => T[i] === w)) s = 4;
      else if (Q.length >= 2 && Q[0] === T[0] && subseq(Q, T)) s = 3;
      else if (Q.length >= 2 && subseq(Q, T)) s = 2;
      else if (Q0.length === 1 && T0[0] === Q0[0]) s = 1;
      return { p, s };
    }).filter(x => x.s);
    if (!sc.length) return { cands: [] };
    const top = Math.max(...sc.map(x => x.s)), best = sc.filter(x => x.s === top);
    return best.length === 1 ? { p: best[0].p } : { cands: best.map(x => x.p) };
  }
  function matchPlace(q) {
    const Q = ptoks(q); if (!Q.length) return null;
    const sc = db.places.map(p => {
      const T = ptoks(p.name);
      const s = Q.join(' ') === T.join(' ') ? 3 : (T.length && (T.every(w => Q.includes(w)) || Q.every(w => T.includes(w)))) ? 2 : 0;
      return { p, s };
    }).filter(x => x.s);
    if (!sc.length) return null;
    const top = Math.max(...sc.map(x => x.s)), best = sc.filter(x => x.s === top);
    return best.length === 1 ? best[0].p : null;
  }
  /* قراءة النص: سطر «… فيه حلقات» يبدأ مكانًا، و«ومشرفهم …» مشرفه، وما سواهما أسماء معلمين */
  function parse(txt) {
    const groups = []; let g = null;
    String(txt || '').split(/\r?\n/).map(l => l.trim()).forEach(l => {
      if (!l) return;
      let m = l.match(/^(.+?)\s+(?:فيه|فيها|به|بها)\s+(?:ال)?حلق(?:ات|ة|ه)\s*[:.،]?\s*$/);
      if (m) { g = { place: m[1].trim(), teachers: [], sup: '' }; groups.push(g); return; }
      m = l.match(/^و?\s*(?:مشرفهم|مشرفها|مشرفه|المشرف|مشرف)\s*[:：]?\s*(.+)$/);
      if (m && g) { g.sup = m[1].trim(); return; }
      if (!g) { g = { place: '', teachers: [], sup: '' }; groups.push(g); }
      g.teachers.push(l.replace(/^[\s\-–•*.)0-9٠-٩]+/, '').trim());
    });
    return groups.filter(x => x.teachers.length || x.place);
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'ar');
  const opt = (p, sel) => `<option value="${esc(p.id)}" ${sel ? 'selected' : ''}>${esc(p.name)}</option>`;
  function personSel(attr, list, m, chosen, empty) {
    const first = m.p ? [m.p] : (m.cands || []);
    const rest = list.slice().sort(byName).filter(p => !first.includes(p));
    const o = p => opt(p, p.id === chosen);
    return `<select ${attr}><option value="">${empty}</option>${first.length ? `<optgroup label="المحتملون">${first.map(o).join('')}</optgroup><optgroup label="الكل">${rest.map(o).join('')}</optgroup>` : rest.map(o).join('')}</select>`;
  }

  let M = null; /* نموذج المعاينة */
  function build(txt) {
    M = parse(txt).map(g => {
      const pl = g.place ? matchPlace(g.place) : null;
      const sm = g.sup ? matchPerson(g.sup, db.supervisors || []) : { cands: [] };
      return {
        place: g.place, placeSel: pl ? pl.id : (g.place ? 'new' : ''), sup: g.sup, supM: sm, supSel: sm.p ? sm.p.id : '',
        rows: g.teachers.map(q => { const m = matchPerson(q, db.teachers); return { q, m, tid: m.p ? m.p.id : '', off: new Set() }; })
      };
    });
  }
  function previewHtml() {
    if (!M.length) return empty('لم أجد في النص مكانًا أو أسماء. اكتب: «اسم المكان فيه حلقات» ثم أسماء المعلمين كل اسم في سطر، ثم «ومشرفهم …».');
    return M.map((g, gi) => {
      const pOpts = `${g.place && !matchPlace(g.place) ? `<option value="new" ${g.placeSel === 'new' ? 'selected' : ''}>إنشاء مكان جديد: ${esc(g.place)}</option>` : ''}<option value="" ${!g.placeSel ? 'selected' : ''}>— بلا تغيير للمكان —</option>${db.places.slice().sort(byName).map(p => opt(p, p.id === g.placeSel)).join('')}`;
      const rows = g.rows.map((r, ri) => {
        const t = byId(db.teachers, r.tid), hs = t ? db.halaqat.filter(h => h.teacherId === t.id) : [];
        const tag = r.m.p ? '' : r.m.cands?.length ? `<span class="tag">${r.m.cands.length} محتملون</span>` : '<span class="tag tag-no">غير موجود</span>';
        const hcell = !t ? '<span class="muted">— اختر المعلم —</span>' : hs.length ? hs.map((h, hi) => `<label style="display:flex;gap:.4rem;align-items:center;margin:0"><input type="checkbox" style="width:auto;margin:0" data-dsh="${gi}:${ri}:${esc(h.id)}" ${r.off.has(h.id) ? '' : 'checked'}> ${esc(halaqaLabel(h))} <small class="muted">(${esc(placeName(h) || 'بلا مكان')}${h.supervisorId ? ' · ' + esc(supName(h.supervisorId)) : ''})</small></label>`).join('')
          : `<label style="display:flex;gap:.4rem;align-items:center;margin:0"><input type="checkbox" style="width:auto;margin:0" data-dsh="${gi}:${ri}:new" ${r.off.has('new') ? '' : 'checked'}> ليس له حلقة: <b>تُنشأ له حلقة</b></label>`;
        return `<tr><td>${esc(r.q)} ${tag}</td><td>${personSel(`data-dst="${gi}:${ri}"`, db.teachers, r.m, r.tid, '— اختر المعلم —')}</td><td>${hcell}</td></tr>`;
      }).join('');
      return `<div class="card" style="margin:0 0 .8rem"><div class="two">
          <label>المكان${g.place ? ` <small class="muted">(في النص: ${esc(g.place)})</small>` : ''}<select data-dsp="${gi}">${pOpts}</select></label>
          <label>المشرف${g.sup ? ` <small class="muted">(في النص: ${esc(g.sup)})</small>` : ''}${personSel(`data-dss="${gi}"`, db.supervisors || [], g.supM, g.supSel, '— بلا تغيير للمشرف —')}</label></div>
        ${g.sup && !g.supM.p ? `<p class="muted" style="margin:-.2rem 0 .5rem;font-size:.85rem">${g.supM.cands?.length ? 'المشرف يحتمل أكثر من شخص: اختره من القائمة.' : 'لم أجد مشرفًا بهذا الاسم: أضفه في «الأعضاء» ← «المشرفون» أو اختر من القائمة.'}</p>` : ''}
        <div class="tbl"><table><tr><th>في النص</th><th>المعلم</th><th>الحلقات (تُنقل إلى المكان والمشرف أعلاه)</th></tr>${rows}</table></div></div>`;
    }).join('');
  }
  function open() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>توزيع الحلقات على الأماكن والمشرفين</h2>
      <p class="note">الصق النص: سطر <b>«اسم المكان فيه حلقات»</b>، ثم اسم كل معلم في سطر (يكفي الاسم المختصر)، ثم <b>«ومشرفهم …»</b>. واترك سطرًا فارغًا بين كل مكان والذي بعده.</p>
      <textarea data-dstxt rows="8" placeholder="التوحيد بلبيس فيه حلقات&#10;هيثم&#10;أحمد رضا&#10;ومشرفهم عبد الرحمن الزهار"></textarea>
      <div class="row" style="margin:.5rem 0"><button type="button" class="btn" data-dsprev>معاينة</button></div>
      <div data-dsout></div>
      <div class="row"><button type="button" class="btn primary" data-dsgo disabled>تنفيذ التوزيع</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const out = ov.querySelector('[data-dsout]'), go = ov.querySelector('[data-dsgo]');
    const redraw = () => { out.innerHTML = previewHtml(); go.disabled = !M.some(g => g.rows.some(r => r.tid)); };
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (e.target.closest('[data-dsprev]')) { build(ov.querySelector('[data-dstxt]').value); redraw(); return; }
      if (e.target.closest('[data-dsgo]')) { apply(ov); }
    });
    ov.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.dst) { const [gi, ri] = t.dataset.dst.split(':').map(Number); M[gi].rows[ri].tid = t.value; M[gi].rows[ri].off = new Set(); redraw(); return; }
      if (t.dataset.dsp !== undefined) { M[+t.dataset.dsp].placeSel = t.value; return; }
      if (t.dataset.dss !== undefined) { M[+t.dataset.dss].supSel = t.value; return; }
      if (t.dataset.dsh) { const [gi, ri, hid] = t.dataset.dsh.split(':'); const off = M[+gi].rows[+ri].off; t.checked ? off.delete(hid) : off.add(hid); }
    });
    setTimeout(() => ov.querySelector('[data-dstxt]').focus(), 50);
  }
  function apply(ov) {
    let moved = 0, made = 0, places = 0;
    const missing = [], newPl = new Map(); /* المكان الجديد يُنشأ مرة واحدة ولو تكرر في النص */
    M.forEach(g => {
      let place = null;
      if (g.placeSel === 'new') {
        const k = norm(g.place);
        place = newPl.get(k);
        if (!place) { place = { id: uid(), name: g.place, type: 'مسجد', address: '' }; db.places.push(place); places++; newPl.set(k, place); }
        g.placeSel = place.id;
      }
      else if (g.placeSel) place = byId(db.places, g.placeSel);
      const sup = g.supSel ? byId(db.supervisors, g.supSel) : null;
      g.rows.forEach(r => {
        const t = byId(db.teachers, r.tid);
        if (!t) { missing.push(r.q); return; }
        const hs = db.halaqat.filter(h => h.teacherId === t.id);
        if (!hs.length) {
          if (r.off.has('new')) return;
          db.halaqat.push({ id: uid(), name: '', teacherId: t.id, supervisorId: sup ? sup.id : '', placeId: place ? place.id : '' }); made++; return;
        }
        hs.filter(h => !r.off.has(h.id)).forEach(h => { if (place) h.placeId = place.id; if (sup) h.supervisorId = sup.id; moved++; });
      });
    });
    ov.remove(); save(); render();
    const msg = [`نُقلت ${moved} حلقة`, made ? `وأُنشئت ${made} حلقة` : '', places ? `وأُنشئ ${places} مكان` : ''].filter(Boolean).join(' ');
    if (missing.length) openInfo('تم التوزيع — بقيت أسماء للمراجعة', `<p>${esc(msg)}.</p><p>لم يُحدَّد معلم لهذه الأسماء فلم يُغيَّر لها شيء:</p><ul>${missing.map(n => `<li>${esc(n)}</li>`).join('')}</ul><p class="muted">أضف المعلم في «المعلمون» إن لم يكن موجودًا، ثم أعد التوزيع لهذه الأسماء.</p>`);
    else toast(msg);
  }
  /* زر «توزيع بالنص» في رأس «الأماكن والحلقات» (للمدير) */
  const base = adminViews.halaqat;
  adminViews.halaqat = () => {
    const h = base();
    return session?.role === 'admin' ? h.replace('<button class="btn" data-act="addPlace">', '<button class="btn" data-dsopen>توزيع بالنص</button><button class="btn" data-act="addPlace">') : h;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-dsopen]')) open(); });
  window.QLDistribute = { parse, matchPerson, matchPlace };
})();
