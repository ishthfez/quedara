'use strict';
/* ============ «تقسيم بملف» في الأماكن والحلقات (للمدير) ============
   ملف (Excel أو CSV أو خلايا ملصوقة) أعمدته: المعلم، المكان، الطالب.
   لكل معلم ومكان: تُختار حلقة المعلم التي فيها أغلب طلاب ذلك المكان فتأخذ المكان، وإلا تُنشأ له حلقة جديدة فيه
   (بمشرف حلقته الأساسية)، ثم يُنقل كل طالب إلى حلقة مكانه. معاينة قبل التنفيذ، ويمكن إلغاء أي مجموعة. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./split.js')) VFILES.push('./split.js'); } catch (e) { /* ignore */ } }, 0);
  const D = () => window.QLDistribute;
  const col = (head, re) => head.findIndex(h => re.test(norm(String(h || ''))));
  function readRows(table) {
    const head = table[0] || [];
    const ti = col(head, /معلم/), pi = col(head, /مكان/), si = col(head, /طالب|الاسم/);
    if (ti < 0 || pi < 0 || si < 0) return { err: 'لم أجد أعمدة «المعلم» و«المكان» و«الطالب» في أول صف.' };
    return { rows: table.slice(1).map(r => ({ t: String(r[ti] || '').trim(), p: String(r[pi] || '').trim(), s: String(r[si] || '').trim() })).filter(r => r.t && r.p && r.s) };
  }
  let G = null; /* المجموعات: معلم × مكان */
  function plan(rows) {
    const byT = new Map();
    rows.forEach(r => { const k = norm(r.t).replace(/[0-9٠-٩]+/g, '').trim(); /* «الشبيني» و«الشبيني1» معلم واحد */ if (!byT.has(k)) byT.set(k, { name: r.t, places: new Map() }); const T = byT.get(k); if (!T.places.has(norm(r.p))) T.places.set(norm(r.p), { name: r.p, students: [] }); T.places.get(norm(r.p)).students.push(r.s); });
    const out = [];
    byT.forEach(T => {
      const m = D().matchPerson(T.name, db.teachers), t = m.p || null;
      const hs = t ? db.halaqat.filter(h => h.teacherId === t.id) : [];
      const claimed = new Set();
      const groups = [...T.places.values()].sort((a, b) => b.students.length - a.students.length);
      groups.forEach(g => {
        const place = D().matchPlace(g.name);
        /* الطلاب: بالاسم داخل حلقات هذا المعلم فقط (فلا يُنقل طالب معلم آخر يحمل الاسم نفسه) */
        const found = [], missing = [];
        g.students.forEach(n => {
          const k = norm(n), c = db.students.filter(s => norm(s.name) === k && hs.some(h => h.id === s.halaqaId));
          if (c.length === 1) found.push(c[0]); else missing.push(n + (c.length > 1 ? ' (مكرر في حلقاته)' : ''));
        });
        const counts = new Map(); found.forEach(s => counts.set(s.halaqaId, (counts.get(s.halaqaId) || 0) + 1));
        const cand = hs.filter(h => !claimed.has(h.id) && (!h.placeId || (place && h.placeId === place.id))).sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
        const target = cand[0] && (counts.get(cand[0].id) || 0) > 0 ? cand[0] : (cand.find(h => place && h.placeId === place.id) || null);
        if (target) claimed.add(target.id);
        out.push({ tname: T.name, t, tm: m, pname: g.name, place, target, found, missing, sup: (hs[0] || {}).supervisorId || '', on: !!t && found.length > 0 });
      });
    });
    G = out;
  }
  function previewHtml() {
    if (!G.length) return empty('لا توجد صفوف في الملف.');
    const rows = G.map((g, i) => `<tr><td><input type="checkbox" data-spg="${i}" ${g.on ? 'checked' : ''} ${g.t && g.found.length ? '' : 'disabled'} style="width:auto;margin:0"></td>
      <td>${g.t ? esc(g.t.name) : `<span class="tag tag-no">لم أجد المعلم</span> ${esc(g.tname)}`}</td>
      <td>${g.place ? esc(g.place.name) : `<span class="tag">مكان جديد</span> ${esc(g.pname)}`}</td>
      <td>${!g.t ? '<span class="muted">— لن يُنفَّذ شيء —</span>' : g.target ? `${esc(halaqaLabel(g.target))}${g.target.placeId ? '' : ' <small class="muted">(ستأخذ المكان)</small>'}` : '<span class="tag">حلقة ثانية جديدة للمعلم في هذا المكان</span>'}</td>
      <td>${g.found.length}${g.missing.length ? ` <small class="muted">· لم يُعثر على ${g.missing.length}</small>` : ''}</td></tr>`).join('');
    const miss = G.filter(g => g.missing.length);
    return `<div class="tbl"><table><tr><th></th><th>المعلم</th><th>المكان</th><th>الحلقة</th><th>الطلاب</th></tr>${rows}</table></div>
      ${miss.length ? `<details style="margin-top:.5rem"><summary>طلاب لم يُعثر عليهم (${miss.reduce((a, g) => a + g.missing.length, 0)})</summary>${miss.map(g => `<p style="margin:.3rem 0"><b>${esc(g.tname)} — ${esc(g.pname)}:</b> ${g.missing.map(esc).join('، ')}</p>`).join('')}</details>` : ''}`;
  }
  function apply(ov) {
    let moved = 0, madeH = 0, madeP = 0;
    const newPlaces = new Map();
    G.filter(g => g.on && g.t).forEach(g => {
      let place = g.place;
      if (!place) { place = newPlaces.get(norm(g.pname)); if (!place) { place = { id: uid(), name: g.pname, type: 'مسجد', address: '' }; db.places.push(place); newPlaces.set(norm(g.pname), place); madeP++; } }
      let h = g.target;
      if (!h) { h = { id: uid(), name: '', teacherId: g.t.id, supervisorId: g.sup, placeId: place.id }; db.halaqat.push(h); madeH++; }
      else h.placeId = place.id;
      g.found.forEach(s => { if (s.halaqaId !== h.id) { s.halaqaId = h.id; moved++; } });
    });
    ov.remove(); save(); render();
    toast([`نُقل ${moved} طالب`, madeH ? `وأُنشئت ${madeH} حلقة` : '', madeP ? `وأُنشئ ${madeP} مكان` : ''].filter(Boolean).join(' '));
  }
  function open() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>تقسيم الحلقات على الأماكن بملف</h2>
      <p class="note">ملف أعمدته: <b>المعلم</b>، <b>المكان</b>، <b>الطالب</b>. لكل معلم ومكان تأخذ حلقته التي فيها أغلب طلاب ذلك المكان المكانَ، وإن كان طلابه في مكانين وليس له إلا حلقة واحدة تُنشأ له <b>حلقة ثانية</b> في المكان الآخر ويُنقل إليها طلابه. ألغِ تحديد أي سطر لا تريده (مثل أقلية صغيرة تبقى في حلقتها). المشرف لا يتغير.</p>
      <div class="bar"><label class="btn" style="margin:0">اختيار ملف Excel أو CSV<input type="file" data-spf accept=".xlsx,.csv,.tsv,.txt" hidden></label></div>
      <div data-spout></div>
      <div class="row"><button type="button" class="btn primary" data-spgo disabled>تنفيذ التقسيم</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    const out = ov.querySelector('[data-spout]'), go = ov.querySelector('[data-spgo]');
    const redraw = () => { out.innerHTML = previewHtml(); go.disabled = !G.some(g => g.on); };
    ov.querySelector('[data-spf]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      out.innerHTML = '<p class="muted">جارٍ قراءة الملف…</p>';
      try {
        const buf = await f.arrayBuffer(), u8 = new Uint8Array(buf);
        const table = /\.xlsx$/i.test(f.name) || (u8[0] === 0x50 && u8[1] === 0x4b) ? await parseXLSX(buf) : parseCSV(decodeText(buf));
        const r = readRows(table); if (r.err) { out.innerHTML = `<p class="note">${esc(r.err)}</p>`; return; }
        plan(r.rows); redraw();
      } catch (err) { out.innerHTML = '<p class="note">تعذّرت قراءة الملف. احفظه بصيغة xlsx أو CSV.</p>'; }
      e.target.value = '';
    };
    ov.addEventListener('change', e => { const c = e.target.dataset?.spg; if (c !== undefined) { G[+c].on = e.target.checked; go.disabled = !G.some(g => g.on); } });
    ov.addEventListener('click', e => { if (e.target.closest('[data-close]')) ov.remove(); else if (e.target.closest('[data-spgo]')) apply(ov); });
  }
  const base = adminViews.halaqat;
  adminViews.halaqat = () => {
    const h = base();
    return session?.role === 'admin' ? h.replace('<button class="btn" data-dsopen>', '<button class="btn" data-spopen>تقسيم بملف</button><button class="btn" data-dsopen>') : h;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-spopen]')) open(); });
  window.QLSplit = { readRows, plan: rows => (plan(rows), G) };
})();
