'use strict';
/* ============ تحصيل المعلمين ============
   المعلم (تبويب «التحصيل»): يختار الحلقة والشهر، فيرى طلابه بمستحق كل منهم، ويكتب ما حصّله وملاحظته، ثم «إرسال للمحاسب».
   المحاسب والمدير (تبويب «تحصيل المعلمين»): يراجع القوائم المرسلة، فيؤكد الأسماء السليمة (تُسجَّل دفعات في الاشتراكات)
   أو يعيد ما فيه مشكلة بملاحظة، فتعود للمعلم ليصححها ويرسلها مرة أخرى. المؤكد لا يتغير.
   كل حفظ ومراجعة عبر دوال الخادم (save_collection / review_collection) التي تتحقق من الصلاحيات. */
(() => {
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const t0 = today();
  const st = { y: +t0.slice(0, 4), m: +t0.slice(5, 7), hid: '', dues: {}, duesFor: '', duesAt: 0, loading: false, draft: {}, filter: 'sent' };
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const STATUS = { draft: ['مسودة لم تُرسل', 'tag'], sent: ['بانتظار المحاسب', 'tag'], returned: ['مُعادة للتصحيح', 'tag tag-no'], done: ['مؤكدة', 'tag tag-ok'] };
  const LINE = { pending: ['بانتظار المراجعة', 'tag'], ok: ['مؤكد ✓', 'tag tag-ok'], issue: ['مُعاد', 'tag tag-no'] };
  const tag = ([l, c]) => `<span class="${c}">${l}</span>`;
  const colls = () => db.collections || [];
  const sName = id => byId(db.students, id)?.name || 'طالب محذوف';
  const monthOpts = () => { const o = []; for (let k = -6; k <= 1; k++) { const d = new Date(+t0.slice(0, 4), +t0.slice(5, 7) - 1 + k, 1); o.push([d.getFullYear(), d.getMonth() + 1]); } return o; };
  /* تأكيد ينتظر الجواب (نعم أو إلغاء) */
  const confirmP = (msg, yes) => new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>${esc(msg)}</h2><div class="row"><button type="button" class="btn primary" data-y>${esc(yes)}</button><button type="button" class="btn" data-n>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-y]').onclick = () => { ov.remove(); res(true); };
    ov.querySelector('[data-n]').onclick = () => { ov.remove(); res(false); };
  });
  const isCollector = () => session?.role === 'admin' || (window.Perms ? Perms.can('fees.collect') : false);

  /* التبويبات */
  TABS.teacher.splice(TABS.teacher.findIndex(t => t[0] === 'mine') + 1, 0, ['collect', 'التحصيل']);
  TABS.accountant.splice(TABS.accountant.findIndex(t => t[0] === 'fees') + 1, 0, ['tcollect', 'تحصيل المعلمين']);
  TABS.admin.splice(TABS.admin.findIndex(t => t[0] === 'fees') + 1, 0, ['tcollect', 'تحصيل المعلمين']);
  TAB_ICONS.collect = TAB_ICONS.tcollect = svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/><path d="M16 3l2 3M8 3L6 6"/>');
  setTimeout(() => { try { if (!VFILES.includes('./collect.js')) VFILES.push('./collect.js'); } catch (e) { /* ignore */ } }, 0);

  /* مستحقات الطلاب من الخادم (الرقم فقط) */
  /* مستحقات طلاب الحلقة عن سنة الشهر المختار (لكل سنة مبالغها)؛ وقبل تنفيذ fees_systems.sql: بالسنة الحالية */
  const duesRpc = async (hid, yy) => { try { return await window.Cloud.rpc('student_dues_y', { hid, yy }); } catch (e) { return window.Cloud.rpc('student_dues', { hid }); } };
  async function loadDues(hid, force) {
    const key = hid + '|' + st.y;
    /* بلا خادم: المستحق محسوبًا على الجهاز من إعدادات الاشتراك (fees.js) */
    if (!CLOUD && hid && window.QLFeeDue && st.duesFor !== key) { st.dues = Object.fromEntries(db.students.filter(s => s.halaqaId === hid).map(s => [s.id, window.QLFeeDue(s, st.y)])); st.duesFor = key; st.duesAt = Date.now(); return; }
    if (!CLOUD || !hid || st.loading || (!force && st.duesFor === key && Date.now() - st.duesAt < 60000)) return;
    st.loading = true;
    try {
      const r = await duesRpc(hid, st.y);
      st.dues = Object.fromEntries((r || []).map(x => [x.student_id, x.due])); st.duesFor = key; st.duesAt = Date.now();
    } catch (e) { st.dues = {}; st.duesFor = key; st.duesAt = Date.now(); }
    st.loading = false;
    if (['collect'].includes(ui.tab) && !document.querySelector('.overlay')) render();
  }
  const dueTxt = sid => (st.duesFor !== st.hid + '|' + st.y ? '…' : st.dues[sid] == null ? '—' : money(st.dues[sid]));

  /* ===== المعلم ===== */
  const myColl = (hid, y, m) => colls().find(c => c.teacherId === session.id && c.halaqaId === hid && +c.y === y && +c.m === m);
  const dkey = () => `${st.hid}|${st.y}|${st.m}`;
  function teacherView() {
    const hs = myHalaqat();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد.')}</div>`;
    if (!hs.some(h => h.id === st.hid)) st.hid = hs[0].id;
    loadDues(st.hid);
    const c = myColl(st.hid, st.y, st.m), locked = c && (c.status === 'sent' || c.status === 'done');
    const lineOf = sid => c?.lines.find(l => l.studentId === sid);
    const D = st.draft[dkey()] || {};
    const list = db.students.filter(s => s.halaqaId === st.hid && (!stOff(s) || lineOf(s.id))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    let total = 0;
    const rows = list.map((s, i) => {
      const L = lineOf(s.id), d = D[s.id] || {}, fixed = locked || L?.state === 'ok';
      const amount = d.amount ?? (L ? L.amount : ''), note = d.note ?? (L?.note || '');
      total += +amount || 0;
      return `<tr${L?.state === 'issue' ? ' style="background:#fdecea"' : ''}><td>${i + 1}</td><td>${esc(s.name)}</td><td>${dueTxt(s.id)}</td>
        <td${fixed ? ` data-famt="${+amount || 0}"` : ''}>${fixed ? money(amount) : `<input type="number" min="0" step="any" data-camt="${s.id}" value="${esc(amount)}" style="width:7rem">`}</td>
        <td>${fixed ? esc(note) : `<input data-cnote="${s.id}" value="${esc(note)}" placeholder="اختياري" style="min-width:10rem">`}</td>
        <td>${L ? tag(LINE[L.state] || LINE.pending) : ''}${L?.accNote ? `<br><small style="color:var(--red)">${esc(L.accNote)}</small>` : ''}</td></tr>`;
    }).join('');
    /* عدّادات الشهر: المستحق على المنتظمين، وما أكّده المحاسب، وما عنده للمراجعة، والباقي */
    const act = list.filter(s => !stOff(s)), duesOk = st.duesFor === st.hid + '|' + st.y;
    const expected = duesOk ? act.reduce((a, s) => a + (+st.dues[s.id] || 0), 0) : null;
    const sumBy = f => (c?.lines || []).filter(f).reduce((a, l) => a + (+l.amount || 0), 0);
    const okSum = sumBy(l => l.state === 'ok'), pendSum = c?.status === 'sent' || c?.status === 'returned' ? sumBy(l => l.state === 'pending') : 0;
    const issueSum = sumBy(l => l.state === 'issue');
    const paidN = act.filter(s => lineOf(s.id)?.state === 'ok' && (!duesOk || +lineOf(s.id).amount >= (+st.dues[s.id] || 0))).length;
    const rest = expected == null ? null : Math.max(0, expected - okSum - pendSum);
    const stat = (v, l, cls) => `<div class="stat${cls ? ' ' + cls : ''}"><b>${v}</b><span>${l}</span></div>`;
    const stats = `<div class="grid cstats">${stat(expected == null ? '…' : money(expected), 'المستحق على طلابي')}${stat(money(okSum), 'سلّمته (أكّده المحاسب)')}${stat(money(pendSum), 'عند المحاسب للمراجعة')}${issueSum ? stat(money(issueSum), 'مُعاد للتصحيح') : ''}${stat(rest == null ? '…' : money(rest), 'الباقي لم يُسلَّم')}${stat(`${paidN} / ${act.length}`, 'طلاب سدّدوا')}</div>`;
    const banner = !c ? '' : c.status === 'sent' ? `أُرسلت للمحاسب — بانتظار المراجعة.` : c.status === 'done' ? `أكّد المحاسب القائمة كاملة${c.reviewedBy ? ' (' + esc(c.reviewedBy) + ')' : ''}.` :
      c.status === 'returned' ? `أعاد المحاسب ${c.lines.filter(l => l.state === 'issue').length} اسمًا (بالأحمر): صحّحها ثم «إرسال للمحاسب».${c.accNote ? '<br>ملاحظة المحاسب: ' + esc(c.accNote) : ''}` : 'مسودة محفوظة لم تُرسل بعد.';
    return `<div class="card"><div class="bar">${hs.length > 1 ? `<select data-chal style="width:auto">${hs.map(h => `<option value="${h.id}" ${h.id === st.hid ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>` : `<b>${esc(halaqaLabel(hs[0]))}</b>`}
        <select data-cmon style="width:auto">${monthOpts().map(([y, m]) => `<option value="${y}-${m}" ${y === st.y && m === st.m ? 'selected' : ''}>${MONTHS[m - 1]} ${y}</option>`).join('')}</select>
        <span class="grow"></span>${c ? tag(STATUS[c.status]) : ''}</div>
      ${stats}
      ${banner ? `<div class="note">${banner}</div>` : '<p class="muted" style="font-size:.85rem;margin:0 0 .6rem">اكتب ما حصّلته من كل طالب هذا الشهر (والملاحظة إن وُجدت)، ثم «إرسال للمحاسب». الطالب الذي لم يدفع اترك خانته فارغة.</p>'}
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>المستحق</th><th>المحصَّل</th><th>ملاحظة</th><th>الحالة</th></tr>${rows}
        <tr class="sum"><td colspan="3">الإجمالي</td><td>${money(total)}</td><td colspan="2"></td></tr></table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}
      ${locked || !list.length ? '' : `<div class="row"><button type="button" class="btn primary" data-csend="1">إرسال للمحاسب</button><button type="button" class="btn" data-csend="0">حفظ مسودة</button></div>`}</div>`;
  }
  async function teacherSave(send) {
    if (!CLOUD) { toast('التحصيل يحتاج الاتصال بقاعدة البيانات'); return; }
    const D = st.draft[dkey()] || {}, c = myColl(st.hid, st.y, st.m), lines = {};
    (c?.lines || []).filter(l => l.state !== 'ok').forEach(l => { lines[l.studentId] = { studentId: l.studentId, amount: l.amount, note: l.note }; });
    Object.entries(D).forEach(([sid, d]) => { lines[sid] = { ...(lines[sid] || { studentId: sid }), ...(d.amount !== undefined ? { amount: d.amount } : {}), ...(d.note !== undefined ? { note: d.note } : {}) }; });
    const lns = Object.values(lines).filter(l => (+l.amount || 0) > 0 || (l.note || '').trim());
    if (send && !lns.length) { toast('اكتب ما حصّلته أولًا'); return; }
    if (send && !(await confirmP(`إرسال قائمة ${MONTHS[st.m - 1]} (${lns.length} طالبًا، ${money(lns.reduce((a, l) => a + (+l.amount || 0), 0))} جنيه) للمحاسب؟ لن يمكن تعديلها حتى يراجعها.`, 'إرسال'))) return;
    try {
      await window.Cloud.rpc('save_collection', { hid: st.hid, yy: st.y, mm: st.m, lns, send: !!send });
      delete st.draft[dkey()]; toast(send ? 'أُرسلت القائمة للمحاسب' : 'حُفظت المسودة');
      await cloudRefresh(true); render();
    } catch (e) { toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الحفظ: ' + (e.message || e)); }
  }

  /* ===== المحاسب والمدير ===== */
  function reviewView() {
    if (!isCollector()) return `<div class="card">${empty('لا تملك صلاحية مراجعة التحصيل.')}</div>`;
    const F = { sent: ['بانتظار المراجعة', c => c.status === 'sent'], returned: ['مُعادة للمعلمين', c => c.status === 'returned'], done: ['مؤكدة', c => c.status === 'done'], all: ['الكل', c => c.status !== 'draft'] };
    const list = colls().filter(F[st.filter][1]).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
    const rows = list.map((c, i) => {
      const h = byId(db.halaqat, c.halaqaId), sum = c.lines.reduce((a, l) => a + (+l.amount || 0), 0);
      /* أسماء الطلاب الذين حدّد المعلم دفعهم، ولكل منهم المبلغ وحالة مراجعته */
      const names = c.lines.map(l => `<div style="font-size:.86em;line-height:1.7">${esc(sName(l.studentId))} <span class="muted">${money(l.amount)}</span>${l.state === 'ok' ? ' <span class="tag tag-ok" style="font-size:.75em">مؤكد</span>' : l.state === 'issue' ? ' <span class="tag tag-no" style="font-size:.75em">مُعاد</span>' : ''}</div>`).join('');
      return `<tr><td>${i + 1}</td><td>${esc(c.teacherName)}</td><td>${h ? esc(halaqaLabel(h)) : '—'}</td><td>${MONTHS[c.m - 1]} ${c.y}</td><td><b>${c.lines.length}</b>${names}</td><td>${money(sum)}</td><td>${tag(STATUS[c.status])}</td>
        <td><button type="button" class="btn sm ${c.status === 'sent' ? 'primary' : ''}" data-crev="${c.id}">${c.status === 'sent' ? 'مراجعة' : 'عرض'}</button></td></tr>`;
    }).join('');
    const n = colls().filter(c => c.status === 'sent').length;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">تحصيل المعلمين${n ? ` <span class="tag tag-no">${n} بانتظار المراجعة</span>` : ''}</h2>
        <select data-cfilter style="width:auto">${Object.entries(F).map(([k, [l]]) => `<option value="${k}" ${k === st.filter ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">«تأكيد» يسجّل المبلغ دفعةً في «الاشتراكات» باسمك، و«إرجاع» يعيد الاسم للمعلم بملاحظتك ليصححه.</p>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>المعلم</th><th>الحلقة</th><th>الشهر</th><th>الطلاب (المبلغ)</th><th>الإجمالي</th><th>الحالة</th><th></th></tr>${rows}</table></div>` : empty('لا توجد قوائم هنا.')}</div>`;
  }
  async function reviewDialog(c) {
    if (!c) return;
    let dues = {};
    if (CLOUD && c.halaqaId) { try { dues = Object.fromEntries(((await duesRpc(c.halaqaId, +c.y)) || []).map(x => [x.student_id, x.due])); } catch (e) { /* بلا مستحقات */ } }
    const open = c.status === 'sent' && isCollector();
    const rows = c.lines.map((l, i) => {
      const due = dues[l.studentId], diff = due == null ? '' : money((+l.amount || 0) - due);
      return `<tr><td>${i + 1}</td><td>${esc(sName(l.studentId))}</td><td>${due == null ? '—' : money(due)}</td><td>${money(l.amount)}</td><td>${diff && diff !== '0' ? `<b style="color:${(+l.amount || 0) < due ? 'var(--red)' : 'var(--leaf)'}">${diff}</b>` : diff ? '0' : '—'}</td><td>${esc(l.note || '')}</td>
        <td>${open && l.state === 'pending' ? `<select data-rdec="${l.studentId}" style="width:auto"><option value="ok">تأكيد</option><option value="issue">إرجاع</option></select>` : tag(LINE[l.state] || LINE.pending)}</td>
        <td>${open && l.state === 'pending' ? `<input data-rnote="${l.studentId}" placeholder="ملاحظة للمعلم (عند الإرجاع)" style="min-width:12rem">` : esc(l.accNote || '')}</td></tr>`;
    }).join('');
    const h = byId(db.halaqat, c.halaqaId), sum = c.lines.reduce((a, l) => a + (+l.amount || 0), 0);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>تحصيل ${esc(c.teacherName)} — ${MONTHS[c.m - 1]} ${c.y}</h2>
      <p class="muted" style="margin:0 0 .6rem">${h ? esc(halaqaLabel(h)) : ''} · ${c.lines.length} طالبًا · الإجمالي ${money(sum)} جنيه ${tag(STATUS[c.status])}</p>
      <div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>المستحق</th><th>المحصَّل</th><th>الفرق</th><th>ملاحظة المعلم</th><th>القرار</th><th>ملاحظة المحاسب</th></tr>${rows}</table></div>
      ${open ? '<label style="margin-top:.6rem">ملاحظة عامة للمعلم (اختيارية)<input data-rall></label>' : c.accNote ? `<p class="note">ملاحظة المحاسب: ${esc(c.accNote)}</p>` : ''}
      <div class="row">${open ? '<button type="button" class="btn primary" data-rsave>تنفيذ القرار</button>' : ''}<button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    const go = ov.querySelector('[data-rsave]');
    if (go) go.onclick = () => withBusy(go, (async () => {
      const dec = [...ov.querySelectorAll('[data-rdec]')].map(s => ({ studentId: s.dataset.rdec, ok: s.value === 'ok', note: (ov.querySelector(`[data-rnote="${s.dataset.rdec}"]`)?.value || '').trim() }));
      if (dec.some(d => !d.ok && !d.note)) { toast('اكتب ملاحظة لكل اسم تعيده للمعلم'); return; }
      try {
        const r = await window.Cloud.rpc('review_collection', { cid: c.id, decisions: dec, note: (ov.querySelector('[data-rall]')?.value || '').trim() });
        const ok = dec.filter(d => d.ok).length;
        ov.remove(); toast(`تم: تأكيد ${ok}${dec.length - ok ? ` وإرجاع ${dec.length - ok}` : ''}${r === 'done' ? ' — القائمة مؤكدة بالكامل' : ''}`);
        await cloudRefresh(true); render();
      } catch (e) { toast('تعذّر التنفيذ: ' + (e.message || e)); }
    })());
  }

  teacherViews.collect = teacherView;
  adminViews.tcollect = reviewView;
  VIEWS.accountant.tcollect = reviewView;

  /* عدّاد على التبويب: قوائم بانتظار المراجعة (للمحاسب والمدير) أو مُعادة (للمعلم) */
  new MutationObserver(() => {
    const b = document.querySelector('.tabs button[data-v="tcollect"], .tabs button[data-v="collect"]'); if (!b || b.querySelector('.count')) return;
    const n = b.dataset.v === 'tcollect' ? colls().filter(c => c.status === 'sent').length : colls().filter(c => c.teacherId === session?.id && c.status === 'returned').length;
    if (n) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('input', e => {
    const a = e.target.dataset?.camt, n = e.target.dataset?.cnote; if (!a && !n) return;
    const D = st.draft[dkey()] = st.draft[dkey()] || {}, sid = a || n;
    D[sid] = { ...(D[sid] || {}), [a ? 'amount' : 'note']: e.target.value };
    /* الإجمالي أثناء الكتابة: المكتوب + المؤكد */
    if (a) {
      const sum = [...document.querySelectorAll('[data-camt]')].reduce((t, x) => t + (+x.value || 0), 0) + [...document.querySelectorAll('[data-famt]')].reduce((t, x) => t + (+x.dataset.famt || 0), 0);
      const cell = document.querySelector('main .tbl tr.sum td:nth-child(2)'); if (cell) cell.textContent = money(sum);
    }
  });
  document.addEventListener('change', e => {
    const d = e.target.dataset || {};
    if ('chal' in d) { st.hid = e.target.value; render(); }
    else if ('cmon' in d) { [st.y, st.m] = e.target.value.split('-').map(Number); render(); }
    else if ('cfilter' in d) { st.filter = e.target.value; render(); }
  });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-csend]'); if (s && !s.classList.contains('loading')) { withBusy(s, teacherSave(s.dataset.csend === '1')); return; }
    const r = e.target.closest('[data-crev]'); if (r) reviewDialog(colls().find(c => c.id === r.dataset.crev));
  });
})();
