'use strict';
/* ============ «تنظيف الحلقات» في الأماكن والحلقات (للمدير) ============
   يفحص البيانات ويعرض معاينة، ولا ينفّذ إلا المحدد:
   1) حلقات مكررة: المعلم نفسه في المكان نفسه بأكثر من حلقة ← تُدمج في الأكبر (ما ليس له مكان بعد لا يُعدّ مكررًا).
   2) حلقات قليلة العدد (حتى حدّ يُختار): تُنقل طلابها إلى حلقة يختارها المدير ثم تُحذف.
   3) حلقات فارغة ← تُحذف.   4) أماكن بلا حلقات ← تُحذف.
   الطلاب لا يُحذفون أبدًا: يُنقلون فقط، ومعهم حضورهم وتسميعهم. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./cleanup.js')) VFILES.push('./cleanup.js'); } catch (e) { /* ignore */ } }, 0);
  let LIM = 3;
  const cnt = () => { const m = new Map(); db.students.forEach(s => { if (s.halaqaId) m.set(s.halaqaId, (m.get(s.halaqaId) || 0) + 1); }); return m; };
  const lbl = h => { const t = byId(db.teachers, h.teacherId); return `${t ? 'حلقة ' + t.name : (h.name || 'حلقة بلا معلم')}${placeName(h) ? ' — ' + placeName(h) : ''}`; };
  function scan() {
    const n = cnt(), N = h => n.get(h.id) || 0;
    /* 1) المكررة */
    const groups = new Map();
    /* بلا مكان لا تُعدّ مكررة (قد تكون لمكانين لم يُحدَّدا بعد) */
    db.halaqat.filter(h => h.teacherId && h.placeId).forEach(h => { const k = h.teacherId + '|' + h.placeId; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); });
    const dups = [...groups.values()].filter(g => g.length > 1).map(g => { const s = g.slice().sort((a, b) => N(b) - N(a)); return { keep: s[0], drop: s.slice(1) }; });
    const dropIds = new Set(dups.flatMap(d => d.drop.map(h => h.id)));
    /* 2) القليلة  3) الفارغة */
    const small = db.halaqat.filter(h => !dropIds.has(h.id) && N(h) > 0 && N(h) <= LIM).sort((a, b) => N(a) - N(b));
    const emptyH = db.halaqat.filter(h => !dropIds.has(h.id) && N(h) === 0);
    /* 4) الأماكن الفارغة (بلا أي حلقة الآن) */
    /* ما عدا مكانًا مسندًا لإداري (info.places): مكان جديد لم تُنشأ حلقاته بعد كان يُحذف فيفقده الإداري */
    const ofAdmin = p => (db.placeadmins || []).some(a => Array.isArray(a.info?.places) && a.info.places.includes(p.id));
    const emptyP = db.places.filter(p => !db.halaqat.some(h => h.placeId === p.id) && !ofAdmin(p));
    return { n, N, dups, small, emptyH, emptyP };
  }
  /* الحلقات المقترحة لنقل طلاب حلقة صغيرة: حلقات المكان نفسه، ثم حلقات المعلم نفسه، ثم البقية */
  function targetsFor(h) {
    const others = db.halaqat.filter(x => x.id !== h.id);
    const same = others.filter(x => h.placeId && x.placeId === h.placeId), mine = others.filter(x => x.teacherId && x.teacherId === h.teacherId && !same.includes(x));
    const rest = others.filter(x => !same.includes(x) && !mine.includes(x)).sort((a, b) => lbl(a).localeCompare(lbl(b), 'ar'));
    const o = x => `<option value="${esc(x.id)}">${esc(lbl(x))}</option>`;
    return `<option value="">— اتركها كما هي —</option>${same.length ? `<optgroup label="في المكان نفسه">${same.map(o).join('')}</optgroup>` : ''}${mine.length ? `<optgroup label="للمعلم نفسه">${mine.map(o).join('')}</optgroup>` : ''}<optgroup label="كل الحلقات">${rest.map(o).join('')}</optgroup>`;
  }
  function body(S) {
    const sec = (title, hint, inner, n) => `<div class="card" style="margin:0 0 .8rem"><h3 style="margin:.1rem 0 .3rem">${title} <span class="muted" style="font-weight:400">(${n})</span></h3><p class="muted" style="margin:0 0 .5rem;font-size:.85rem">${hint}</p>${n ? inner : '<p class="muted" style="margin:0">لا يوجد ✓</p>'}</div>`;
    const dupRows = S.dups.map((d, i) => `<tr><td><input type="checkbox" data-cu="dup:${i}" checked style="width:auto;margin:0"></td><td><b>${esc(lbl(d.keep))}</b> <small class="muted">(${S.N(d.keep)} طالب) تبقى</small></td><td>${d.drop.map(h => `${esc(lbl(h))} <small class="muted">(${S.N(h)} طالب)</small>`).join('<br>')}</td></tr>`).join('');
    const smallRows = S.small.map(h => `<tr><td>${esc(lbl(h))}</td><td>${S.N(h)}</td><td><select data-cut="${esc(h.id)}">${targetsFor(h)}</select></td></tr>`).join('');
    const ehRows = S.emptyH.map(h => `<tr><td><input type="checkbox" data-cu="eh:${esc(h.id)}" checked style="width:auto;margin:0"></td><td>${esc(lbl(h))}</td></tr>`).join('');
    const epRows = S.emptyP.map(p => `<tr><td><input type="checkbox" data-cu="ep:${esc(p.id)}" checked style="width:auto;margin:0"></td><td>${esc(p.name)}</td></tr>`).join('');
    return sec('حلقات مكررة', 'المعلم نفسه في المكان نفسه بأكثر من حلقة: يُنقل طلاب الحلقات الأخرى إلى الحلقة الأكبر ثم تُحذف.', `<div class="tbl"><table><tr><th></th><th>الحلقة التي تبقى</th><th>تُدمج فيها ثم تُحذف</th></tr>${dupRows}</table></div>`, S.dups.length)
      + sec(`حلقات قليلة العدد (حتى <input type="number" min="1" max="20" data-culim value="${LIM}" style="width:4rem;display:inline-block"> طلاب)`, 'اختر لكل حلقة الحلقة التي ينتقل إليها طلابها (فتُحذف بعدها)، أو اتركها كما هي.', `<div class="tbl"><table><tr><th>الحلقة</th><th>الطلاب</th><th>ينتقل طلابها إلى</th></tr>${smallRows}</table></div>`, S.small.length)
      + sec('حلقات فارغة', 'بلا أي طالب: تُحذف.', `<div class="tbl"><table><tr><th></th><th>الحلقة</th></tr>${ehRows}</table></div>`, S.emptyH.length)
      + sec('أماكن فارغة', 'بلا أي حلقة: تُحذف. (والأماكن التي تفرغ بعد التنفيذ تظهر عند فتح الأداة مرة أخرى.)', `<div class="tbl"><table><tr><th></th><th>المكان</th></tr>${epRows}</table></div>`, S.emptyP.length);
  }
  function open() {
    let S = scan();
    const ov = document.createElement('div'); ov.className = 'overlay';
    const draw = () => {
      S = scan();
      ov.innerHTML = `<div class="modal wide"><h2>تنظيف الحلقات</h2>
        <p class="note">خذ نسخة احتياطية أولًا («النسخ الاحتياطية» ← «تنزيل نسخة كاملة الآن»). الطلاب لا يُحذفون: يُنقلون فقط ومعهم حضورهم وتسميعهم.</p>
        <div data-cub>${body(S)}</div>
        <div class="row"><button type="button" class="btn primary" data-cugo>تنفيذ المحدد</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    };
    draw(); document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-culim]')) { LIM = Math.max(1, Math.min(20, +e.target.value || 3)); draw(); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (!e.target.closest('[data-cugo]')) return;
      const on = k => ov.querySelector(`[data-cu="${k}"]`)?.checked;
      let merged = 0, moved = 0, delH = 0, delP = 0;
      const del = new Set();
      /* 1) الدمج */
      S.dups.forEach((d, i) => { if (!on('dup:' + i)) return; d.drop.forEach(h => { db.students.forEach(s => { if (s.halaqaId === h.id) { s.halaqaId = d.keep.id; moved++; } }); if (!d.keep.supervisorId && h.supervisorId) d.keep.supervisorId = h.supervisorId; del.add(h.id); merged++; }); });
      /* 2) نقل طلاب الحلقات القليلة */
      ov.querySelectorAll('[data-cut]').forEach(sel => { const to = sel.value, from = sel.dataset.cut; if (!to || del.has(to)) return; db.students.forEach(s => { if (s.halaqaId === from) { s.halaqaId = to; moved++; } }); del.add(from); });
      /* 3) الفارغة */
      S.emptyH.forEach(h => { if (on('eh:' + h.id)) del.add(h.id); });
      const before = db.halaqat.length;
      /* حلقة لها قائمة تحصيل لم تُؤكَّد (تُحفظ على الخادم بدوالها، فلا ينقلها الدمج) تبقى حتى تُراجَع القائمة، وإلا بقيت القائمة بلا حلقة */
      const openColl = id => (db.collections || []).some(c => c.status !== 'done' && c.halaqaId === id);
      const keptForColl = [...del].filter(openColl).length;
      db.halaqat = db.halaqat.filter(h => !(del.has(h.id) && !db.students.some(s => s.halaqaId === h.id) && !openColl(h.id)));
      if (keptForColl) setTimeout(() => toast(`بقيت ${keptForColl} حلقة لها قائمة تحصيل لم تُراجَع — احذفها بعد مراجعتها`), 1500);
      delH = before - db.halaqat.length;
      /* 4) الأماكن الفارغة (المحددة وما زالت بلا حلقات) */
      const pb = db.places.length;
      db.places = db.places.filter(p => !(on('ep:' + p.id) && !db.halaqat.some(h => h.placeId === p.id)));
      delP = pb - db.places.length;
      ov.remove(); save(); render();
      toast([merged ? `دُمجت ${merged} حلقة` : '', moved ? `نُقل ${moved} طالب` : '', delH ? `حُذفت ${delH} حلقة` : '', delP ? `حُذف ${delP} مكان` : ''].filter(Boolean).join('، ') || 'لم يُحدَّد شيء');
    });
  }
  const base = adminViews.halaqat;
  adminViews.halaqat = () => {
    const h = base();
    return session?.role === 'admin' ? h.replace('<button class="btn" data-spopen>', '<button class="btn" data-cuopen>تنظيف الحلقات</button><button class="btn" data-spopen>') : h;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-cuopen]')) open(); });
  window.QLCleanup = { scan };
})();
