'use strict';
/* ============ المحاسب ============
   أقسامه: الطلاب (إضافة، منقطع/منتظم، نقل بين الحلقات والأماكن)، والاشتراكات (من fees.js)، وملاحظات للإدارة، والإعلانات.
   كل عمل مربوط بصلاحية يملكها المحاسب افتراضيًا، ويمكن للمدير سحبها منه أو منحها لغيره من قسم «الصلاحيات».
   الخادم يتحقق من كل صلاحية، ولا يسمح لغير المدير بتعديل بيانات الطالب الأخرى. */
(() => {
  const P = [
    ['students.add', 'إضافة طالب', 'استمارة طالب جديد'],
    ['students.status', 'حالة الطالب', 'منقطع أو منتظم'],
    ['students.move', 'نقل طالب', 'من حلقة إلى أخرى أو من مكان لآخر'],
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
  const has = (txt, q) => !q || norm(txt).includes(norm(q));
  const nameOk = s => has(s.name, st.qn);
  const studentsOf = h => db.students.filter(s => s.halaqaId === h.id && statusOk(s)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const chip = h => { const pn = placeName(h); return pn ? `<span class="tag" role="button" tabindex="0" data-apl="${esc(pn)}" title="عرض حلقات هذا المكان" style="cursor:pointer">${esc(pn)}</span>` : '<span class="tag">بلا مكان</span>'; };
  const actions = s => `${can('students.move') ? `<button type="button" class="btn sm" data-move="${esc(s.id)}">نقل</button>` : ''}${can('students.status') ? `<button type="button" class="btn sm" data-stat="${esc(s.id)}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>` : ''}`;
  const statusCell = s => stOff(s) ? `<span class="tag tag-no">منقطع</span>${s.info?.statusDate ? ` <small class="muted">${esc(s.info.statusDate)}</small>` : ''}` : '<span class="tag tag-ok">منتظم</span>';
  /* جدول طلاب (بأعمدة الحلقة والمكان أو بدونها) */
  function studentTable(list, withHal) {
    const shown = list.slice(0, 300);
    return `<div class="tbl"><table><tr><th>#</th><th>الطالب</th>${withHal ? '<th>الحلقة</th><th>المكان</th>' : ''}<th>الحالة</th><th class="noprint"></th></tr>
      ${shown.map((s, i) => { const h = halOf(s); return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td>${withHal ? `<td>${h ? esc(halaqaLabel(h)) : '<span class="muted">—</span>'}</td><td>${h ? esc(placeName(h) || '—') : '<span class="muted">—</span>'}</td>` : ''}<td>${statusCell(s)}</td><td class="noprint">${actions(s)}</td></tr>`; }).join('')}</table></div>
      ${list.length > 300 ? `<p class="muted" style="margin:.4rem 0 0">يظهر أول 300 من ${list.length} — اكتب للتضييق</p>` : ''}`;
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
  const box = (k, label, ph) => `<label style="margin:0">${label}<input type="search" data-aq="${k}" value="${esc(st[k])}" placeholder="${ph}" autocomplete="off"></label>`;
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

  TAB_ICONS.notes = svg('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>');
  VIEWS.accountant = { students: studentsView, fees: () => window.FeesView(), notes: notesView, news: () => newsView('accountant') };

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
