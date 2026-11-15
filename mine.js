'use strict';
/* ============ «طلابي»: جدول طلاب الحلقة للمعلم (والمشرف) ============
   - يفتح حساب المعلم عليه مباشرة: جدول طلاب حلقته.
   - إن كان له أكثر من حلقة: قائمة منسدلة يختار منها الحلقة.
   - تبويبان لكل حلقة: «المنتظمون» و«المنقطعون» بعددهم.
   - مربع بحث حي بالاسم (يضيّق الجدول أثناء الكتابة)، والتكبير والتصغير والطباعة من شريط الجدول المعتاد.
   يُحمَّل بعد roles.js (يحل محل عرض المشرف أيضًا) وقبل nav.js (حتى تكون «طلابي» صفحة بداية المعلم). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./mine.js')) VFILES.push('./mine.js'); } catch (e) { /* ignore */ } });
  const st = { tab: 'on', q: '' };
  /* حلقات صاحب الحساب: المدير والمشرف العام يريان كل الحلقات */
  const halaqatOf = () => {
    if (session?.role === 'admin' || session?.role === 'supervisor' && byId(db.supervisors, session.id)?.info?.scope === 'all') return db.halaqat.slice().sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
    return myHalaqat();
  };
  const match = (s, q) => !q || norm(s.name).includes(norm(q));
  function view() {
    const hs = halaqatOf();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد. تواصل مع الإدارة.')}</div>`;
    if (!hs.some(h => h.id === ui.hid)) ui.hid = hs[0].id;
    const h = byId(db.halaqat, ui.hid);
    const all = db.students.filter(s => s.halaqaId === h.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const on = all.filter(s => !stOff(s)), off = all.filter(stOff);
    if (st.tab === 'off' && !off.length) st.tab = 'on';
    const list = st.tab === 'off' ? off : on, canRec = session.role !== 'placeadmin';
    const shown = list.filter(s => match(s, st.q)).length;
    const head = hs.length > 1
      ? `<label style="margin:0;flex:1 1 16rem;max-width:28rem">الحلقة${halaqaPicker(hs)}</label>`
      : `<h2 class="grow" style="margin:0">${esc(halaqaLabel(h))}</h2>`;
    const meta = [placeName(h), timeText(h)].filter(Boolean).join(' · ');
    const rows = list.map((s, i) => `<tr data-mn="${esc(norm(s.name))}"${match(s, st.q) ? '' : ' style="display:none"'}><td>${i + 1}</td><td>${esc(s.name)}</td>
      ${st.tab === 'off' ? `<td>${esc(s.info?.statusDate || '—')}</td>` : `<td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td>`}
      <td class="noprint">${st.tab === 'on' && canRec ? `<button class="btn sm primary" data-act="rec" data-id="${s.id}">تسجيل تسميع</button>` : ''}<button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button></td></tr>`).join('');
    return `<div class="card"><div class="bar" style="margin:0 0 .4rem">${head}<span class="muted">${all.length} طالب</span></div>
      ${meta ? `<p class="muted" style="margin:0 0 .6rem;font-size:.88rem">${esc(meta)}</p>` : ''}
      <div class="bar" style="margin:0 0 .6rem"><div class="plseg mtabs">
        <button type="button" class="btn ${st.tab === 'on' ? 'on' : ''}" data-mtab="on">المنتظمون <span class="count">${on.length}</span></button>
        <button type="button" class="btn ${st.tab === 'off' ? 'on' : ''}" data-mtab="off">المنقطعون <span class="count">${off.length}</span></button></div>
        <input type="search" data-mq value="${esc(st.q)}" placeholder="ابحث باسم الطالب" aria-label="بحث في طلاب الحلقة" style="flex:1 1 14rem;max-width:24rem"></div>
      <p class="muted" data-mcount style="margin:0 0 .5rem;font-size:.85rem">${st.q ? `${shown} من ${list.length}` : `${list.length} ${st.tab === 'off' ? 'منقطع' : 'منتظم'}`}</p>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th>${st.tab === 'off' ? '<th>منقطع منذ</th>' : '<th>آخر حفظ</th><th>الحضور</th>'}<th class="noprint"></th></tr>${rows}</table></div>`
        : empty(st.tab === 'off' ? 'لا يوجد طلاب منقطعون في هذه الحلقة.' : 'لا يوجد طلاب منتظمون في هذه الحلقة.')}</div>`;
  }
  teacherViews.mine = view;
  supervisorViews.mine = view;
  /* الحضور: للمنتظمين فقط (المنقطع لا يُسجَّل حضوره) */
  function attView() {
    const hs = halaqatOf();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد. تواصل مع الإدارة.')}</div>`;
    const picker = halaqaPicker(hs);
    const all = db.students.filter(s => s.halaqaId === ui.hid), sts = all.filter(s => !stOff(s)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const rows = sts.map(s => {
      const cur = db.attendance.find(a => a.studentId === s.id && a.date === ui.date)?.status;
      return `<tr><td>${esc(s.name)}</td><td>${Object.entries(STATUS).map(([k, l]) => `<button class="btn sm ${cur === k ? 'on ' + k : ''}" data-act="att" data-sid="${s.id}" data-st="${k}">${l}</button>`).join(' ')}</td></tr>`;
    }).join('');
    const offN = all.length - sts.length;
    return `<div class="card"><div class="bar">${picker}<input type="date" value="${ui.date}" data-change="date"></div>
    ${offN ? `<p class="muted" style="margin:0 0 .5rem;font-size:.85rem">${offN} منقطع لا يظهرون في الحضور.</p>` : ''}
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>الحالة</th></tr>${rows}</table></div>` : empty('لا يوجد طلاب منتظمون في هذه الحلقة.')}</div>`;
  }
  teacherViews.att = attView;
  supervisorViews.att = attView;
  /* المدير يملك كل ما تملكه الفئات الأخرى: حضور أي حلقة وتسميع طلابها، بالصفحتين نفسيهما */
  adminViews.att = attView;
  adminViews.mine = view;
  if (!TABS.admin.some(t => t[0] === 'mine')) TABS.admin.push(['mine', 'طلاب الحلقات'], ['att', 'الحضور']);
  /* صفحة بداية المعلم: «طلابي» (أول قائمته قبل أن يوحّد nav.js الترتيب) */
  { const i = TABS.teacher.findIndex(t => t[0] === 'mine'); if (i > 0) TABS.teacher.unshift(...TABS.teacher.splice(i, 1)); }

  const css = document.createElement('style');
  css.textContent = `.mtabs{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.mtabs .btn{border:0;border-radius:0;margin:0}.mtabs .btn+.btn{border-inline-start:1px solid var(--line)}`;
  document.head.appendChild(css);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mtab]'); if (!b) return;
    st.tab = b.dataset.mtab; render();
  });
  /* البحث الحي: يخفي الصفوف غير المطابقة دون إعادة رسم الصفحة (يبقى المؤشر في المربع) */
  document.addEventListener('input', e => {
    if (!('mq' in (e.target.dataset || {}))) return;
    st.q = e.target.value; const q = norm(st.q);
    const rows = [...document.querySelectorAll('main tr[data-mn]')];
    let n = 0; rows.forEach(r => { const ok = !q || r.dataset.mn.includes(q); r.style.display = ok ? '' : 'none'; if (ok) n++; });
    const c = document.querySelector('[data-mcount]'); if (c) c.textContent = q ? `${n} من ${rows.length}` : `${rows.length} ${st.tab === 'off' ? 'منقطع' : 'منتظم'}`;
  });
})();
