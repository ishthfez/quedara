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
  const canP = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
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
      <td class="noprint">${st.tab === 'on' && canRec ? `<button class="btn sm primary" data-act="rec" data-id="${s.id}">تسجيل تسميع</button>` : ''}<button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button><button class="btn sm" data-mnote="${s.id}" title="إشعار لهذا الطالب">إشعار</button>${canP('students.move') ? `<button class="btn sm" data-move="${s.id}">نقل</button>` : ''}${canP('students.status') ? `<button class="btn sm" data-stat="${s.id}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>` : ''}</td></tr>`).join('');
    return `<div class="card"><div class="bar" style="margin:0 0 .4rem">${head}<span class="muted">${all.length} طالب</span><button type="button" class="btn sm primary" data-mnote="*">إشعار للطلاب</button></div>
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
  /* ===== إشعار للطلاب: رسالة حرة تصل الطالب في «الإعلانات» على حسابه (notify_students على الخادم) ===== */
  function noteDialog(one) {
    const h = byId(db.halaqat, ui.hid); if (!h) return;
    const all = db.students.filter(s => s.halaqaId === h.id), on = all.filter(s => !stOff(s)), off = all.filter(stOff);
    const s1 = one && byId(db.students, one);
    const groups = s1 ? null : [['on', `المنتظمون (${on.length})`, on], ['off', `المنقطعون (${off.length})`, off], ['all', `الكل (${all.length})`, all]].filter(g => g[2].length);
    openForm(s1 ? 'إشعار: ' + s1.name : 'إشعار لطلاب ' + halaqaLabel(h), [
      ...(groups ? [{ name: 'to', label: 'إلى', type: 'select', value: 'on', options: groups.map(([v, l]) => ({ v, l })) }] : []),
      { name: 'body', label: 'نص الإشعار', type: 'textarea', required: true },
      { type: 'note', label: 'يصل كل طالب في «الإعلانات» على حسابه، باسمك.' }
    ], v => {
      const body = (v.body || '').trim();
      if (body.length < 2) return 'اكتب نص الإشعار';
      if (body.length > 1000) return 'النص طويل (1000 حرف على الأكثر)';
      const ids = s1 ? [s1.id] : (groups.find(g => g[0] === v.to) || groups[0])[2].map(s => s.id);
      send(ids, body);
    });
  }
  async function send(ids, body) {
    if (!CLOUD) {
      ids.forEach(id => db.news.push({ id: uid(), text: body, audience: 'm:' + id, date: today(), author: (ROLE_L[session.role] || '') + ' ' + (me()?.name || ''), authorId: session.id }));
      save(); render(); toast(`أُرسل الإشعار إلى ${ids.length} طالب`); return;
    }
    try {
      toast('جارٍ الإرسال…');
      const n = await window.Cloud.rpc('notify_students', { students: ids, body });
      toast(n ? `أُرسل الإشعار إلى ${n} طالب` : 'لم يُرسل شيء: أُرسل النص نفسه اليوم، أو ليس لك صلاحية على هؤلاء الطلاب');
    } catch (e) {
      toast(/notify_students|PGRST202|404/i.test(String(e.message || e)) ? 'نفّذ ملف supabase/notify.sql على الخادم أولًا' : 'تعذّر الإرسال: ' + (e.message || e));
    }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-mnote]'); if (b) noteDialog(b.dataset.mnote === '*' ? '' : b.dataset.mnote); });
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
  if (!TABS.admin.some(t => t[0] === 'att')) TABS.admin.push(['att', 'الحضور']);
  /* «طلاب الحلقات» للمدير ليس صفحة مستقلة (كان تكرارًا لـ«الطلاب»): صار عرضًا داخل «الطلاب» بزرّين
     «كل الطلاب» و«حسب الحلقة»، والثاني هو جدول طلاب الحلقة نفسه الذي يراه المعلم */
  const svwBar = () => `<div class="bar" style="margin:0 0 .6rem"><div class="plseg mtabs">
      <button type="button" class="btn ${ui.svw !== 'hal' ? 'on' : ''}" data-svw="all">كل الطلاب</button>
      <button type="button" class="btn ${ui.svw === 'hal' ? 'on' : ''}" data-svw="hal">حسب الحلقة</button></div></div>`;
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.students;
    adminViews.students = () => svwBar() + (ui.svw === 'hal' ? view() : base());
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-svw]'); if (b) { ui.svw = b.dataset.svw; render(); } });
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
  /* ===== نقل الطالب وتغيير حالته من كل جدول طلاب، للمدير (ولمن له الصلاحية) =====
     جدول «الطلاب» عند المدير وجدول «الاشتراكات» فيهما «تعديل» أو «الفئة» بلا «نقل»: يُضاف بجانبهما زرّا «نقل» و«منقطع/منتظم»
     (يعملان بنافذة النقل نفسها التي يستعملها المحاسب، والخادم يتحقق من الصلاحية). */
  let qRaf = 0;
  const addMoveButtons = () => {
    qRaf = 0;
    if (!session || !canP('students.move')) return;
    document.querySelectorAll('main td button[data-fee-assign]:not([data-mvdone]), main td button[data-act="editStudent"]:not([data-mvdone])').forEach(b => {
      b.dataset.mvdone = '1';
      const td = b.closest('td'), id = b.dataset.feeAssign || b.dataset.id; if (!td || !id || td.querySelector('[data-move]')) return;
      const s = byId(db.students, id); if (!s) return;
      let h = `<button type="button" class="btn sm" data-move="${esc(id)}">نقل</button>`;
      if (canP('students.status') && !td.querySelector('[data-stat]')) h += `<button type="button" class="btn sm" data-stat="${esc(id)}">${stOff(s) ? 'منتظم' : 'منقطع'}</button>`;
      b.insertAdjacentHTML('afterend', h);
    });
  };
  new MutationObserver(() => { if (!qRaf) qRaf = requestAnimationFrame(addMoveButtons); }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  /* ===== نافذة نقل الطالب: قائمتان بالبحث، المكان (الافتراضي مكانه الحالي) ثم حلقات ذلك المكان =====
     تحل محل نافذة النقل القديمة (قائمة واحدة بكل الحلقات) لكل من يملك صلاحية النقل، والخادم يتحقق من الصلاحية. */
  function moveDialog(s) {
    const cur = byId(db.halaqat, s.halaqaId);
    let pid = cur?.placeId || '';
    const places = db.places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const noPlace = db.halaqat.some(h => !h.placeId);
    const halOpts = () => db.halaqat.filter(h => (h.placeId || '') === pid).sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'))
      .map(h => `<option value="${esc(h.id)}" ${h.id === s.halaqaId ? 'selected' : ''}>${esc(halaqaLabel(h))}${timeText(h) ? ' · ' + esc(timeText(h)) : ''} (${db.students.filter(x => x.halaqaId === h.id && !stOff(x)).length} طالب)</option>`).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    const halBox = () => { const o = halOpts(); return o ? `<label>الحلقة<select data-mvh><option value="">— اختر الحلقة —</option>${o}</select></label>` : '<p class="muted">لا توجد حلقات في هذا المكان.</p>'; };
    ov.innerHTML = `<div class="modal"><h2>نقل الطالب: ${esc(s.name)}</h2>
      <p class="muted" style="margin:0 0 .6rem">الحالية: ${cur ? `${esc(halaqaLabel(cur))} — ${esc(placeName(cur) || 'بلا مكان')}` : 'بلا حلقة'}</p>
      <label>المكان<select data-mvp>${places.map(p => `<option value="${esc(p.id)}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}${noPlace ? `<option value="" ${!pid ? 'selected' : ''}>بلا مكان</option>` : ''}</select></label>
      <div data-mvhw>${halBox()}</div>
      <div class="row"><button type="button" class="btn primary" data-mvok>نقل</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-mvp]')) { pid = e.target.value; ov.querySelector('[data-mvhw]').innerHTML = halBox(); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (!e.target.closest('[data-mvok]')) return;
      const hid = ov.querySelector('[data-mvh]')?.value;
      if (!hid) { toast('اختر الحلقة'); return; }
      if (hid === s.halaqaId) { toast('اختر حلقة مختلفة'); return; }
      s.halaqaId = hid; ov.remove(); save(); render();
      toast(`نُقل «${s.name}» إلى ${halaqaLabel(byId(db.halaqat, hid))}`);
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-move]'); if (!b || e.target.closest('.overlay [data-mvok]')) return;
    const s = byId(db.students, b.dataset.move); if (!s || !canP('students.move')) return;
    e.stopImmediatePropagation(); e.preventDefault(); moveDialog(s);
  }, true);
})();
