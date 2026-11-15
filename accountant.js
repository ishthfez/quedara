'use strict';
/* ============ المحاسب ============
   أقسامه الظاهرة: الاشتراكات (الرئيسية، ومعها أعمال الطلاب: إضافة، منقطع/منتظم، نقل)، والطلاب (في حدود صلاحياته)، وتحصيل المعلمين، وملاحظات للإدارة، والإعلانات.
   كل عمل مربوط بصلاحية يملكها المحاسب افتراضيًا، ويمكن للمدير سحبها منه أو منحها لغيره من قسم «الصلاحيات».
   الخادم يتحقق من كل صلاحية، ولا يسمح لغير المدير بتعديل بيانات الطالب الأخرى. */
(() => {
  const P = [
    ['students.add', 'إضافة طالب', 'استمارة طالب جديد'],
    ['students.status', 'حالة الطالب', 'منقطع أو منتظم'],
    ['students.move', 'نقل طالب', 'من حلقة إلى أخرى أو من مكان لآخر'],
    ['students.edit', 'تعديل استمارة الطالب', 'كل ما في الاستمارة: الاسم والهاتف والبيانات والصورة والحلقة'],
    ['fees.collect', 'تحصيل الاشتراكات', 'تسجيل ما يُدفع وحذف ما سجّله بنفسه'],
    ['fees.amount', 'قيمة الاشتراك', 'تحديد فئة الطالب وخصمه ومبلغه وتغييرها'],
    ['notes.send', 'ملاحظات للإدارة', 'تظهر في إعلانات المدير أو المشرفين باسم صاحبها']
  ];
  const G = { students: 'الحلقات والطلاب', fees: 'الاشتراكات', notes: 'الحسابات والإدارة' };
  P.forEach(([key, label, desc]) => Perms.define({ key, label, desc, group: G[key.split('.')[0]], defaults: ['accountant'] }));
  const can = p => Perms.can(p);
  const st = { qn: '', qh: '', qp: '', f: '', open: new Set() };

  /* ===== الطلاب: ثلاثة مربعات بحث (الاسم، الحلقة، المكان) =====
     - المكان: الأماكن المطابقة وتحت كل منها حلقاته؛ الضغط على حلقة يفتح طلابها تحتها.
     - الحلقة: الحلقات المطابقة وبجانب كل منها كبسولة باسم مكانها؛ الضغط عليها يفتح طلابها.
     - الاسم: الطلاب المطابقون (ومع الحلقة أو المكان: داخلها فقط، والحلقات التي فيها مطابقون تُفتح تلقائيًا). */
  const halOf = s => byId(db.halaqat, s.halaqaId);
  const statusOk = s => !(st.f === 'off' && !stOff(s)) && !(st.f === 'on' && stOff(s));
  /* كل كلمات البحث موجودة في النص (بأي ترتيب)، كما في قائمة الاقتراحات */
  const has = (txt, q) => { if (!q) return true; const t = norm(txt); return norm(q).split(' ').filter(Boolean).every(w => t.includes(w)); };
  const nameOk = s => has(s.name, st.qn);
  const studentsOf = h => db.students.filter(s => s.halaqaId === h.id && statusOk(s)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const chip = h => { const pn = placeName(h); return pn ? `<span class="tag" role="button" tabindex="0" data-apl="${esc(pn)}" title="عرض حلقات هذا المكان" style="cursor:pointer">${esc(pn)}</span>` : '<span class="tag">بلا مكان</span>'; };
  const actions = s => `${can('students.edit') ? `<button type="button" class="btn sm primary" data-act="editStudent" data-id="${esc(s.id)}">تعديل</button>` : ''}${can('students.move') ? `<button type="button" class="btn sm" data-move="${esc(s.id)}">نقل</button>` : ''}${can('students.status') ? `<button type="button" class="btn sm" data-stat="${esc(s.id)}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>` : ''}`;
  const statusCell = s => stOff(s) ? `<span class="tag tag-no">منقطع</span>${s.info?.statusDate ? ` <small class="muted">${esc(s.info.statusDate)}</small>` : ''}` : '<span class="tag tag-ok">منتظم</span>';
  /* جدول طلاب (بأعمدة الحلقة والمكان أو بدونها) */
  function studentTable(list, withHal) {
    const lim = matchMedia('(max-width:860px)').matches ? 60 : 300, shown = list.slice(0, lim); // على الهاتف 60 صفًا يكفي (البحث يضيّق)
    return `<div class="tbl"><table><tr><th>#</th><th>الطالب</th>${withHal ? '<th>الحلقة</th><th>المكان</th>' : ''}<th>الحالة</th><th class="noprint"></th></tr>
      ${shown.map((s, i) => { const h = halOf(s); return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td>${withHal ? `<td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>` : ''}<td>${statusCell(s)}</td><td class="noprint">${actions(s)}</td></tr>`; }).join('')}</table></div>
      ${list.length > lim ? `<p class="muted" style="margin:.4rem 0 0">يظهر أول ${lim} من ${list.length} — اكتب للتضييق</p>` : ''}`;
  }
  /* سطر حلقة قابل للفتح، وتحته طلابها إن فُتحت */
  function halaqaBlock(h, withChip) {
    const all = studentsOf(h), match = st.qn ? all.filter(nameOk) : all;
    const isOpen = st.open.has(h.id) || (!!st.qn && match.length > 0);
    return `<div class="ahal${isOpen ? ' open' : ''}">
      <div class="ahal-h" role="button" tabindex="0" data-ahal="${esc(h.id)}" aria-expanded="${isOpen}"><span class="ahal-ar">${isOpen ? '▾' : '◂'}</span><b>${esc(halaqaLabel(h))}</b>${withChip ? ' ' + chip(h) : ''}<span class="muted ahal-n">${st.qn ? `${match.length} من ${all.length}` : all.length} طالب</span></div>
      ${isOpen ? `<div class="ahal-b">${match.length ? studentTable(match, false) : empty('لا يوجد طلاب' + (st.qn ? ' مطابقون' : '') + ' في هذه الحلقة.')}</div>` : ''}</div>`;
  }
  function results() {
    const qh = st.qh.trim(), qp = st.qp.trim();
    /* بالمكان (ومعه الحلقة إن كُتبت): الأماكن المطابقة وتحت كل منها حلقاتها */
    if (qp) {
      const places = db.places.filter(p => has(p.name, qp)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      if (!places.length) return empty('لا يوجد مكان مطابق.');
      return places.map(p => {
        let hs = db.halaqat.filter(h => h.placeId === p.id && (has(halaqaLabel(h), qh) || has(h.name, qh)));
        if (st.qn) hs = hs.filter(h => studentsOf(h).some(nameOk));
        hs.sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
        return `<div class="aplace"><h3>${esc(p.name)} <span class="muted" style="font-size:.85rem;font-weight:400">${hs.length} حلقة</span></h3>${hs.length ? hs.map(h => halaqaBlock(h, false)).join('') : '<p class="muted" style="margin:.2rem 0 .6rem">لا توجد حلقات مطابقة في هذا المكان.</p>'}</div>`;
      }).join('');
    }
    /* بالحلقة: الحلقات المطابقة وبجانب كل منها كبسولة المكان */
    if (qh) {
      let hs = db.halaqat.filter(h => has(halaqaLabel(h), qh) || has(h.name, qh));
      if (st.qn) hs = hs.filter(h => studentsOf(h).some(nameOk));
      hs.sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
      return hs.length ? `<p class="muted" style="margin:.2rem 0 .6rem">${hs.length} حلقة — اضغط على الحلقة لعرض طلابها</p>${hs.map(h => halaqaBlock(h, true)).join('')}` : empty('لا توجد حلقة مطابقة.');
    }
    /* بالاسم (أو دون بحث): جدول الطلاب */
    const list = db.students.filter(s => statusOk(s) && nameOk(s)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (!list.length) return empty(st.qn || st.f ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد.');
    return `<p class="muted" style="margin:.2rem 0 .6rem">${list.length} طالبًا</p>${studentTable(list, true)}`;
  }
  const SUG = { qn: 'acc-students', qh: 'acc-halaqat', qp: 'acc-places' };
  const box = (k, label, ph) => `<label style="margin:0">${label}<input type="search" data-aq="${k}" data-suggest="${SUG[k]}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off"></label>`;
  /* قوائم الاقتراحات عند الضغط على مربعات البحث (تعرضها selects.js) */
  const byAr = (a, b) => a.t.localeCompare(b.t, 'ar');
  window.QLSuggest = Object.assign(window.QLSuggest || {}, {
    'acc-places': () => db.places.map(p => ({ v: p.id, t: p.name })).sort(byAr),
    /* تتابع: بعد تحديد المكان لا تظهر إلا حلقاته، وبعد تحديد الحلقة أو المكان لا يظهر إلا طلابهما */
    'acc-halaqat': () => db.halaqat.filter(h => has(placeName(h), st.qp)).map(h => ({ v: h.id, t: halaqaLabel(h), g: placeName(h) || 'بلا مكان' }))
      .sort((a, b) => (a.g === 'بلا مكان') - (b.g === 'بلا مكان') || a.g.localeCompare(b.g, 'ar') || byAr(a, b)),
    'acc-students': () => db.students.filter(s => { if (!statusOk(s)) return false; if (!st.qh.trim() && !st.qp.trim()) return true; const h = halOf(s); return !!h && (has(halaqaLabel(h), st.qh) || has(h.name, st.qh)) && has(placeName(h), st.qp); }).map(s => ({ v: s.id, t: s.name })).sort(byAr)
  });
  /* اختيار حلقة من القائمة يفتح طلابها مباشرة */
  document.addEventListener('qpick', e => { if (e.target.dataset?.aq === 'qh') { st.open.add(e.detail.value); refresh(); } });
  function studentsView() {
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب</h2>
        <select data-af style="width:auto"><option value="">الكل</option><option value="on" ${st.f === 'on' ? 'selected' : ''}>المنتظمون</option><option value="off" ${st.f === 'off' ? 'selected' : ''}>المنقطعون</option></select>
        ${can('students.add') ? '<button class="btn primary" data-act="addStudent">+ استمارة طالب</button>' : ''}</div>
      <div class="asearch">${box('qn', 'اسم الطالب', 'اكتب اسم الطالب')}${box('qh', 'الحلقة', 'اسم الحلقة أو المعلم')}${box('qp', 'المكان', 'اسم المكان')}</div>
      ${st.qn || st.qh || st.qp ? '<div style="margin:.1rem 0 .5rem"><button type="button" class="btn sm" data-aclear>مسح البحث</button></div>' : ''}
      <div data-ares>${results()}</div></div>`;
  }
  const css = document.createElement('style');
  css.textContent = `
    .asearch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6rem;margin:0 0 .6rem}
    @media (max-width:640px){.asearch{grid-template-columns:1fr}}
    .aplace{margin:0 0 .8rem}.aplace h3{margin:.4rem 0 .5rem;font-size:1.05rem;color:var(--navy)}
    .ahal{border:1px solid var(--line);border-radius:10px;margin:0 0 .45rem;background:#fff;overflow:hidden}
    .ahal-h{display:flex;align-items:center;gap:.5rem;width:100%;padding:.6rem .8rem;background:none;border:0;cursor:pointer;text-align:start;font:inherit;color:inherit}
    .ahal-h:hover{background:var(--gold-l)}.ahal.open>.ahal-h{background:var(--gold-l)}
    .ahal-n{margin-inline-start:auto;font-size:.85rem}.ahal-ar{width:1rem;color:var(--muted)}
    .ahal-b{padding:.4rem .6rem .6rem}`;
  document.head.appendChild(css);

  /* ===== ملاحظات للإدارة ===== */
  function notesView() {
    const mine = (db.news || []).filter(n => n.authorId && n.authorId === session.id).slice().reverse();
    return `<div class="card"><h2>ملاحظة جديدة</h2>
        ${can('notes.send') ? `<label>إلى<select data-nto><option value="admin">المدير</option><option value="supervisor">المشرفين</option></select></label>
        <label>الملاحظة<textarea data-ntext rows="4" placeholder="اكتب ملاحظتك بخصوص العمل"></textarea></label>
        <div class="row"><button type="button" class="btn primary" data-nsend>إرسال</button></div>
        <p class="muted" style="font-size:.85rem;margin:.4rem 0 0">تظهر في إعلانات من أرسلتها إليه، موقّعة باسمك: «${esc(ROLE_L[session.role] === 'محاسب' ? 'المحاسب' : ROLE_L[session.role])} ${esc(me()?.name || '')}». تحتاج اتصالًا بالإنترنت.</p>`
        : '<p class="muted">لا تملك صلاحية إرسال الملاحظات.</p>'}</div>
      <div class="card"><h2>ملاحظاتي المرسلة</h2>${mine.length ? mine.map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)} — إلى ${esc(AUD[n.audience] || '')}</small></div>`).join('') : empty('لم ترسل ملاحظات بعد.')}</div>`;
  }

  /* ===== الأماكن والحلقات (للاطلاع): قسم المدير نفسه دون أزرار الإضافة والتعديل والحذف (الخادم لا يسمح بها للمحاسب) ===== */
  function placesView() {
    return adminViews.halaqat()
      .replace(/<button class="btn[^"]*" data-act="(addPlace|addHalaqa|editPlace|delPlace)"[^>]*>[^<]*<\/button>/g, '')
      .replace(/<td><button class="btn sm" data-act="editHalaqa"[\s\S]*?<\/td>/g, '')
      .replace(/<th>الطلاب<\/th><th><\/th>/g, '<th>الطلاب</th>')
      .replace(/data-hstu=/g, 'data-ahstu=')
      .replace('ابدأ بإضافة مكان، ثم أضف حلقاته.', 'لا توجد أماكن أو حلقات بعد.');
  }
  /* طلاب الحلقة للمحاسب: الاسم والفئة والسن والحالة (بلا الحضور والحفظ وملف الطالب) */
  function halaqaStudentsAcc(h) {
    if (!h) return;
    const list = db.students.filter(s => s.halaqaId === h.id).sort((a, b) => (stOff(a) - stOff(b)) || a.name.localeCompare(b.name, 'ar'));
    const off = list.filter(stOff).length;
    const info = [['المعلم', tName(h.teacherId)], ['المشرف', supName(h.supervisorId)], ['المكان', placeName(h) || '—'], ['الوقت', timeText(h) || '—'], ['الطلاب', `${list.length - off} منتظم${off ? ` و${off} منقطع` : ''}`]];
    openInfo(halaqaLabel(h), `<div class="tbl" style="margin-bottom:.8rem"><table>${info.map(([l, v]) => `<tr><th style="width:30%">${l}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>الفئة</th><th>السن</th><th>الحالة</th></tr>${list.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${CATS[s.cat || 'child']}</td><td>${ageOf(s) === '' ? '—' : ageOf(s)}</td><td>${statusCell(s)}</td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة بعد.')}`);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-ahstu]'); if (b) halaqaStudentsAcc(byId(db.halaqat, b.dataset.ahstu)); });
  /* واجهة المحاسب: «الاشتراكات» هي الرئيسية (أول قسم)، ثم «الطلاب» في حدود صلاحياته:
     يطّلع على الطلاب وحلقاتهم وأماكنهم وحالتهم، ولا يظهر له من الأعمال إلا ما مُنح (استمارة طالب، تعديل الاستمارة، نقل، منقطع/منتظم).
     الخادم لا يسمح له بغير ذلك أصلًا. («الأماكن والحلقات» يبقى مخفيًا) */
  { const i = TABS.accountant.findIndex(t => t[0] === 'students'); if (i > -1) { const [t] = TABS.accountant.splice(i, 1); TABS.accountant.splice(TABS.accountant.findIndex(x => x[0] === 'fees') + 1, 0, t); } }

  TAB_ICONS.notes = svg('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>');
  VIEWS.accountant = { students: studentsView, halaqat: placesView, fees: () => window.FeesView(), notes: notesView, news: () => newsView('accountant') };

  /* ===== الإجراءات ===== */
  function move(s) {
    const opts = db.halaqat.map(h => ({ v: h.id, l: `${placeName(h) ? placeName(h) + ' — ' : ''}${halaqaLabel(h)}` })).sort((a, b) => a.l.localeCompare(b.l, 'ar'));
    if (!opts.length) { toast('لا توجد حلقات'); return; }
    openForm('نقل الطالب: ' + s.name, [
      { type: 'note', label: 'الحالية: ' + (halOf(s) ? `${placeName(halOf(s)) || '—'} — ${halaqaLabel(halOf(s))}` : 'بلا حلقة') },
      { name: 'h', label: 'إلى (المكان — الحلقة)', type: 'select', value: s.halaqaId || '', options: opts }
    ], v => {
      if (v.h === s.halaqaId) return 'اختر حلقة مختلفة';
      s.halaqaId = v.h; toast(`نُقل «${s.name}» إلى ${halaqaLabel(byId(db.halaqat, v.h))}`);
    });
  }
  function toggleStatus(s) {
    const off = stOff(s);
    ask(off ? `إعادة «${s.name}» منتظمًا؟` : `تسجيل «${s.name}» منقطعًا؟ لن يُحسب في الاشتراكات المتوقعة.`, () => {
      s.info = { ...(s.info || {}), status: off ? '' : 'منقطع', statusDate: today() };
      save(); render(); toast(off ? 'أصبح منتظمًا' : 'سُجّل منقطعًا');
    });
  }
  async function sendNote(btn) {
    const text = document.querySelector('[data-ntext]')?.value.trim(), aud = document.querySelector('[data-nto]')?.value;
    if (!text || text.length < 2) { toast('اكتب الملاحظة'); return; }
    if (!CLOUD) { db.news.push({ id: uid(), text, audience: aud, date: today(), author: 'المحاسب ' + (me()?.name || ''), authorId: session.id }); save(); render(); toast('أُرسلت'); return; }
    try { await window.Cloud.rpc('send_note', { aud, body: text }); toast('أُرسلت الملاحظة'); document.querySelector('[data-ntext]').value = ''; await cloudRefresh(true); render(); }
    catch (e) { toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الإرسال: ' + (e.message || e)); }
  }

  const refresh = () => {
    const r = document.querySelector('[data-ares]'); if (r) r.innerHTML = results();
    const c = document.querySelector('[data-aclear]'), any = st.qn || st.qh || st.qp;
    if (any && !c) document.querySelector('.asearch')?.insertAdjacentHTML('afterend', '<div style="margin:.1rem 0 .5rem"><button type="button" class="btn sm" data-aclear>مسح البحث</button></div>');
    if (!any && c) c.parentElement.remove();
  };
  document.addEventListener('input', e => { const k = e.target.dataset?.aq; if (k) { st[k] = e.target.value; refresh(); } });
  document.addEventListener('change', e => { if ('af' in (e.target.dataset || {})) { st.f = e.target.value; refresh(); } });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-ahal],[data-apl]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('click', e => {
    const hb = e.target.closest('[data-ahal]');
    if (hb && !e.target.closest('[data-apl]')) { const id = hb.dataset.ahal; st.open.has(id) ? st.open.delete(id) : st.open.add(id); refresh(); return; }
    const pl = e.target.closest('[data-apl]');
    if (pl) { st.qp = pl.dataset.apl; const i = document.querySelector('[data-aq="qp"]'); if (i) i.value = st.qp; refresh(); return; }
    if (e.target.closest('[data-aclear]')) { st.qn = st.qh = st.qp = ''; st.open.clear(); document.querySelectorAll('[data-aq]').forEach(i => { i.value = ''; }); refresh(); return; }
    const m = e.target.closest('[data-move]'); if (m) { const s = byId(db.students, m.dataset.move); if (s && can('students.move')) move(s); return; }
    const t = e.target.closest('[data-stat]'); if (t) { const s = byId(db.students, t.dataset.stat); if (s && can('students.status')) toggleStatus(s); return; }
    const n = e.target.closest('[data-nsend]'); if (n && !n.classList.contains('loading')) withBusy(n, sendNote(n));
  });
})();
