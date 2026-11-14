'use strict';
/* ============ ربط الحلقات بمعلميها بالاسم ============
   في «الأماكن والحلقات» (للمدير):
   - «ربط المعلمين تلقائيًا»: كل حلقة بلا معلم يُقارن اسمها بقائمة المعلمين:
       تام: الاسم نفسه (أحمد = احمد، عبد الله = عبدالله، ويُتجاهل «حلقة» والأرقام في آخره)
       جزئي: أحد الاسمين بداية للآخر (كلمتان على الأقل) — بشرط ألا يحتمل غير معلم واحد.
     تُعرض معاينة قبل التنفيذ، ويمكن إلغاء أي سطر.
   - بطاقة «حلقات بلا معلم — للمراجعة»: ما لم يُربط، ولكل حلقة قائمة معلمين (المحتملون أولًا) للربط اليدوي. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./links.js')) VFILES.push('./links.js'); } catch (e) { /* ignore */ } }, 0);
  const toks = s => norm(String(s || '')).replace(/^\s*حلقه\s+/, '').replace(/[0-9٠-٩]+/g, ' ').split(' ').filter(Boolean);
  const orphans = () => db.halaqat.filter(h => !h.teacherId || !byId(db.teachers, h.teacherId));
  const hName = h => (h.name || '').replace(/^\s*حلقة\s+/, '').trim();
  /* أفضل معلم لاسم الحلقة: { t, kind: 'تام'|'جزئي' } أو { cands: [...] } إن احتمل أكثر من واحد */
  function bestTeacher(h) {
    const H = toks(h.name); if (!H.length) return { cands: [] };
    const scored = db.teachers.map(t => {
      const T = toks(t.name);
      if (!T.length) return { t, s: 0 };
      if (H.join(' ') === T.join(' ')) return { t, s: 3 };
      const [a, b] = H.length <= T.length ? [H, T] : [T, H];
      if (a.length >= 2 && a.every((w, i) => b[i] === w)) return { t, s: 2 };
      return { t, s: 0 };
    }).filter(x => x.s > 0);
    if (!scored.length) return { cands: [] };
    const top = Math.max(...scored.map(x => x.s)), best = scored.filter(x => x.s === top);
    return best.length === 1 ? { t: best[0].t, kind: top === 3 ? 'تام' : 'جزئي' } : { cands: best.map(x => x.t) };
  }
  const nStu = h => db.students.filter(s => s.halaqaId === h.id).length;
  const link = (h, t) => { h.teacherId = t.id; h.name = ''; };

  /* ===== المعاينة والتنفيذ ===== */
  function autoLink() {
    const list = orphans().filter(h => hName(h));
    const found = [], review = [];
    list.forEach(h => { const r = bestTeacher(h); (r.t ? found : review).push({ h, ...r }); });
    if (!found.length) { toast(list.length ? 'لم أجد تطابقًا مؤكدًا — راجع بطاقة «حلقات بلا معلم»' : 'كل الحلقات مربوطة بمعلميها ✓'); return; }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>ربط المعلمين تلقائيًا</h2>
      <p class="note">وُجد معلم لـ <b>${found.length}</b> حلقة${review.length ? `، وتبقى <b>${review.length}</b> للمراجعة اليدوية` : ''}. ألغِ تحديد أي سطر لا تريده، ثم «ربط المحدد».</p>
      <div class="tbl"><table><tr><th><input type="checkbox" data-lkall checked aria-label="تحديد الكل"></th><th>اسم الحلقة</th><th>المعلم</th><th>التطابق</th><th>الطلاب</th></tr>
      ${found.map((x, i) => `<tr><td><input type="checkbox" data-lk="${i}" checked></td><td>${esc(x.h.name)}</td><td><b>${esc(x.t.name)}</b></td><td><span class="tag ${x.kind === 'تام' ? 'tag-ok' : ''}">${x.kind}</span></td><td>${nStu(x.h)}</td></tr>`).join('')}</table></div>
      ${review.length ? `<details style="margin-top:.6rem"><summary>للمراجعة اليدوية (${review.length})</summary><ul style="margin:.4rem 0">${review.map(x => `<li>${esc(x.h.name)}${x.cands.length ? ` <span class="muted">— محتمل: ${x.cands.map(t => esc(t.name)).join('، ')}</span>` : ' <span class="muted">— لا يوجد معلم بهذا الاسم</span>'}</li>`).join('')}</ul></details>` : ''}
      <div class="row"><button type="button" class="btn primary" data-lkgo>ربط المحدد</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-lkall]')) ov.querySelectorAll('[data-lk]').forEach(c => { c.checked = e.target.checked; }); });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (!e.target.closest('[data-lkgo]')) return;
      const pick = [...ov.querySelectorAll('[data-lk]:checked')].map(c => found[+c.dataset.lk]);
      if (!pick.length) { toast('لم تحدد شيئًا'); return; }
      pick.forEach(x => link(x.h, x.t));
      ov.remove(); save(); render();
      const left = orphans().length;
      toast(`رُبطت ${pick.length} حلقة بمعلميها${left ? ` — بقيت ${left} للمراجعة` : ''}`);
    });
  }

  /* ===== بطاقة المراجعة أعلى «الأماكن والحلقات» ===== */
  function reviewCard() {
    const list = orphans(); if (!list.length) return '';
    const sorted = db.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const rows = list.map(h => {
      const r = bestTeacher(h), first = r.t ? [r.t] : (r.cands || []);
      const o = t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`;
      const opts = first.length ? `<optgroup label="المحتملون">${first.map(o).join('')}</optgroup><optgroup label="كل المعلمين">${sorted.filter(t => !first.includes(t)).map(o).join('')}</optgroup>` : sorted.map(o).join('');
      return `<tr><td><b>${esc(h.name || 'حلقة بلا اسم')}</b>${r.t ? ` <span class="tag tag-ok" title="يمكن ربطها تلقائيًا">مقترح: ${esc(r.t.name)}</span>` : r.cands?.length ? ` <span class="tag">${r.cands.length} محتملون</span>` : ''}</td>
        <td>${esc(placeName(h) || '—')}</td><td>${nStu(h)}</td>
        <td><select data-lkh="${esc(h.id)}" aria-label="معلم ${esc(h.name)}"><option value="">— اختر المعلم —</option>${opts}</select></td></tr>`;
    }).join('');
    const auto = list.filter(h => hName(h) && bestTeacher(h).t).length;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">حلقات بلا معلم — للمراجعة <span class="muted" style="font-size:.9rem">(${list.length})</span></h2>
      ${auto ? `<button type="button" class="btn primary" data-lkauto>ربط المعلمين تلقائيًا (${auto})</button>` : ''}</div>
      <p class="muted" style="margin:.2rem 0 .7rem;font-size:.88rem">اختر معلم كل حلقة من القائمة (يمكنك الكتابة فيها للبحث)، ويُحفظ الربط فورًا. ${auto ? 'أو اضغط «ربط المعلمين تلقائيًا» لربط ما تطابقت أسماؤه مع معاينة قبل التنفيذ.' : ''}</p>
      <div class="tbl"><table><tr><th>الحلقة</th><th>المكان</th><th>الطلاب</th><th>المعلم</th></tr>${rows}</table></div></div>`;
  }
  /* داخل جداول «الأماكن والحلقات»: اسم الحلقة «حلقة + المعلم» فقط، بلا المكان والوقت
     (الجدول تحت مكانه وفيه عمود للوقت)؛ ويبقى الاسم المميِّز في القوائم والصفحات الأخرى */
  const shortLabel = h => { const t = byId(db.teachers, h.teacherId); return t ? 'حلقة ' + t.name : (h.name || 'حلقة بلا معلم'); };
  const shorten = html => html.replace(/(data-hstu="([^"]+)"[^>]*><b>)([^<]*)(<\/b>)/g, (m, a, id, lbl, c) => { const h = byId(db.halaqat, id); return h ? a + esc(shortLabel(h)) + c : m; });
  const base = adminViews.halaqat;
  adminViews.halaqat = () => {
    const h = shorten(base());
    if (session?.role !== 'admin') return h; /* قسم المحاسب مبني على قسم المدير: بلا بطاقة المراجعة */
    const c = reviewCard();
    return c ? h.replace(/(<\/p><\/div>)/, '$1' + c) : h;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-lkauto]')) autoLink(); });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-lkh]'); if (!s || !s.value) return;
    const h = byId(db.halaqat, s.dataset.lkh), t = byId(db.teachers, s.value); if (!h || !t) return;
    const old = h.name;
    link(h, t); save(); render(); toast(`رُبطت «${old || 'الحلقة'}» بالمعلم ${t.name}`);
  });
  window.QLLinks = { bestTeacher, orphans };
})();
