/* ============ البرامج — المرحلة الثانية: الدورة المكثفة ============
   يضيف إلى قسم «البرامج» (programs.js) تبويب «الدورة المكثفة»، وللطالب قسم «دورتي».
   الخادم: supabase/intensive.sql (دوال crs_*). نسخة عامة لكل عام، وتحتها دورات مستقلة يفتحها المشرفون.
   ويضيف للمدير «إظهار القسم»: إخفاء قسم البرامج عن فئات بعينها (prog_vis_get / prog_vis_set). */
(function () {
  'use strict';
  const KEY = 'programs', MY = 'mycourse';
  const CLOUD = () => !!(window.Cloud && window.Cloud.enabled);
  const rpc = (fn, args) => window.Cloud.rpc(fn, args || {});
  const role = () => (typeof session !== 'undefined' && session && session.role) || '';
  const isAdminLike = () => role() === 'admin' || (role() === 'supervisor' && !!(window.isGenSup && typeof me === 'function' && window.isGenSup(me())));
  const onTab = (k) => typeof ui !== 'undefined' && ui && ui.tab === k;
  const rerender = () => { try { if (onTab(KEY) || onTab(MY)) render(); } catch (e) { /* ignore */ } };
  const errMsg = (e) => {
    let m = String((e && e.message) || e || '');
    try { const b = e && e.body && (typeof e.body === 'string' ? JSON.parse(e.body) : e.body); if (b && b.message) m = b.message; } catch (x) { /* ignore */ }
    if (/PGRST202|crs_|404/.test(m) && !/[؀-ۿ]/.test(m)) return 'يحتاج القسم إلى تنفيذ supabase/intensive.sql على الخادم.';
    return m.replace(/^.*?:\s*/, '') || 'تعذّر التنفيذ';
  };
  const run = async (btn, p, okMsg) => {
    try { const r = await (window.withBusy && btn ? withBusy(btn, p) : p); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(errMsg(e)); throw e; }
  };
  const num = (v) => (v === null || v === undefined || v === '' ? '' : String(+v));
  const halName = (hid) => { const h = hid && (db.halaqat || []).find((x) => x.id === hid); if (!h) return '—'; try { return halaqaLabel(h); } catch (e) { return h.name || '—'; } };
  /* التاريخ بتوقيت الجهاز (كان بتوقيت UTC: بعد منتصف الليل بتوقيت مصر يُسجَّل حضور المعلم والاختبار الأسبوعي على «أمس») */
  const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const TRACK = { khatm: 'ختم: مراجعة', review: 'مراجعة فقط', new: 'حفظ جديد ومراجعة' };
  const STATUS = { nominated: 'مرشح', selected: 'منتقى للتصفية', passed: 'اجتاز التصفية', failed: 'لم يجتز', accepted: 'في الدورة', withdrawn: 'منسحب' };
  const bar = (items, cur, attr) => `<div class="card subnav"><div class="bar" style="margin:0">${items.map(([k, l]) => `<button type="button" class="btn ${cur === k ? 'on' : ''}" ${attr}="${k}">${l}</button>`).join('')}</div></div>`;
  function modal(title, html, wide) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><h2>${title}</h2>${html}<div class="row" style="margin-top:1rem"><button class="btn ghost" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (ev) => { if (ev.target === o || ev.target.closest('[data-close]')) o.remove(); });
    return o;
  }

  // ---------------------------------------------------------------- الحالة
  const S = { kind: 'ramadan', roots: null, root: null, courses: null, overview: null, course: null, c: null, tab: 'students', date: today(), group: '', wk: 1, err: '' };

  async function loadRoots() {
    S.err = '';
    try { S.roots = (await rpc('prog_list', { knd: 'intensive' })).filter((p) => !p.parent_id); } catch (e) { S.err = errMsg(e); S.roots = []; }
    rerender();
  }
  async function openRoot(id) {
    S.root = (S.roots || []).find((r) => r.id === id) || { id }; S.courses = null; S.overview = null; S.course = null; rerender();
    try {
      S.courses = await rpc('crs_list', { root: id });
      S.overview = S.root.is_org ? await rpc('crs_overview', { root: id }) : null;
    } catch (e) { S.err = errMsg(e); S.courses = []; }
    rerender();
  }
  async function openCourse(id) {
    S.course = (S.courses || []).find((c) => c.id === id) || { id }; S.c = null; S.tab = 'students'; rerender();
    await reloadCourse();
  }
  async function reloadCourse() {
    const cid = S.course && S.course.id; if (!cid) return;
    try {
      const [courses, entries, groups, staff] = await Promise.all([rpc('crs_list', { root: S.root.id }), rpc('crs_entries', { cid }), rpc('crs_groups', { cid }), rpc('prog_staff_list', { pid: cid })]);
      S.courses = courses; S.course = courses.find((c) => c.id === cid) || S.course;
      S.c = Object.assign(S.c || {}, { entries, groups, staff });
      await loadTab();
    } catch (e) { S.err = errMsg(e); S.c = S.c || { entries: [], groups: [], staff: [] }; }
    rerender();
  }
  async function loadTab() {
    const cid = S.course.id, C = S.c;
    if (S.tab === 'daily') C.daily = await rpc('crs_daily', { cid, d1: S.date, d2: S.date });
    if (S.tab === 'weekly') C.weekly = await rpc('crs_weekly', { cid });
    if (S.tab === 'points' && S.course.is_org) C.points = await rpc('crs_points', { cid });
    if (S.tab === 'results' && S.course.is_org) C.results = await rpc('crs_results', { cid });
    if (S.tab === 'teachers' && S.course.is_org) { C.tatt = await rpc('crs_tatt', { cid }); C.pay = await rpc('crs_pay', { cid }); }
    if (S.tab === 'log' && S.course.is_org) C.log = await rpc('prog_log_list', { pid: cid, only_warn: false });
  }

  // ---------------------------------------------------------------- واجهة الدورة المكثفة
  function kindBar() { return bar([['ramadan', 'مسابقة رمضان'], ['intensive', 'الدورة المكثفة']], S.kind, 'data-ik'); }

  function intensiveView() {
    if (S.course) return courseView();
    if (S.root) return rootView();
    if (S.roots === null) { setTimeout(loadRoots, 0); return kindBar() + '<div class="card"><p class="muted">جارٍ التحميل…</p></div>'; }
    const add = isAdminLike() ? '<button class="btn" data-ia="newroot">+ نسخة جديدة</button>' : '';
    const cards = S.roots.map((p) => `<button class="card pg-card" data-ia="root" data-id="${p.id}"><b>${esc(p.name)}</b><span class="muted">${p.year || ''} · ${p.status === 'closed' ? 'مغلقة' : 'مفتوحة'}</span></button>`).join('');
    return kindBar() + `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">الدورة المكثفة</h2>${add}</div>
      ${S.err ? `<p class="pg-err">${esc(S.err)}</p>` : ''}<div class="pg-grid">${cards || empty('لا توجد نسخ بعد.')}</div></div>`;
  }

  function rootView() {
    const r = S.root;
    const canOpen = r.status !== 'closed' && (role() === 'supervisor' || isAdminLike());
    const head = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <div><button class="btn ghost" data-ia="back">→ النسخ</button> <h2 style="display:inline;margin:0 .5rem">${esc(r.name || '')}</h2></div>
      <div class="row" style="gap:.4rem">${r.is_org ? '<button class="btn ghost" data-ia="rootset">الإعدادات العامة</button>' : ''}${canOpen ? '<button class="btn" data-ia="opencourse">+ فتح دورة</button>' : ''}</div></div>
      ${S.err ? `<p class="pg-err">${esc(S.err)}</p>` : ''}</div>`;
    if (S.courses === null) return head + '<div class="card"><p class="muted">جارٍ التحميل…</p></div>';
    const cards = S.courses.map((c) => `<button class="card pg-card" data-ia="course" data-id="${c.id}"><b>${esc(c.name)}</b>
      <span class="muted">${esc(c.owner || '')} · ${c.n_students} طالب${c.status === 'closed' ? ' · مغلقة' : ''}</span></button>`).join('');
    const ov = S.overview && S.overview.length ? `<div class="card"><h3>التقرير الإجمالي</h3></div><div class="card tbl"><table data-print="التقرير الإجمالي ${esc(r.name)}">
      <thead><tr><th>الدورة</th><th>المسؤول</th><th>المجموعات</th><th>المعلمون</th><th>الطلاب</th><th>الخاتمون</th><th>أيام الدوام</th><th>الصفحات</th></tr></thead>
      <tbody>${S.overview.map((o) => `<tr><td>${esc(o.name)}</td><td>${esc(o.owner || '')}</td><td>${o.groups}</td><td>${o.teachers}</td><td>${o.students}</td><td>${o.khatm}</td><td>${o.days}</td><td>${num(o.pages)}</td></tr>`).join('')}</tbody></table></div>` : '';
    return head + `<div class="card"><h3>الدورات</h3><div class="pg-grid">${cards || empty('لا توجد دورات تراها بعد.')}</div></div>` + ov;
  }

  function courseView() {
    const c = S.course, org = !!c.is_org;
    const tabs = [['students', 'الطلاب'], ['daily', 'الكراسة'], ['weekly', 'الاختبار الأسبوعي']].concat(org ? [['points', 'النقاط'], ['results', 'النتيجة'], ['teachers', 'المعلمون'], ['log', 'السجل']] : []);
    const head = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <div><button class="btn ghost" data-ia="backroot">→ الدورات</button> <h2 style="display:inline;margin:0 .5rem">${esc(c.name || '')}</h2><span class="muted">${esc(c.owner || '')}</span></div>
      <div class="row" style="gap:.4rem">${org ? '<button class="btn ghost" data-ia="courseset">الإعدادات</button>' : ''}<button class="btn ghost" data-ia="reload">تحديث</button></div></div>
      ${S.err ? `<p class="pg-err">${esc(S.err)}</p>` : ''}</div>` + bar(tabs, S.tab, 'data-it');
    if (!S.c) return head + '<div class="card"><p class="muted">جارٍ التحميل…</p></div>';
    const body = { students: studentsView, daily: dailyView, weekly: weeklyView, points: pointsView, results: resultsView, teachers: teachersView, log: logView }[S.tab] || studentsView;
    return head + body();
  }

  const grpName = (gid) => ((S.c.groups || []).find((g) => g.id === gid) || {}).name || '—';
  function studentsView() {
    const org = !!S.course.is_org, E = S.c.entries || [];
    const cnt = (st) => E.filter((e) => e.status === st).length;
    const acts = (e) => {
      if (!org) return '';
      const b = [];
      if (e.status === 'nominated') b.push(`<button class="btn sm" data-ie="select" data-id="${e.id}">انتقاء</button>`);
      if (e.status === 'selected') b.push(`<button class="btn sm ghost" data-ie="unselect" data-id="${e.id}">إلغاء الانتقاء</button>`);
      if (['selected', 'passed', 'failed'].includes(e.status)) b.push(`<button class="btn sm" data-ie="tasfiya" data-id="${e.id}">التصفية</button>`);
      if (e.status === 'passed') b.push(`<button class="btn sm" data-ie="accept" data-id="${e.id}">وافق على الشروط</button>`);
      if (e.status === 'accepted') b.push(`<button class="btn sm" data-ie="assign" data-id="${e.id}">المسار والمجموعة</button>`);
      b.push(e.status === 'withdrawn' ? `<button class="btn sm ghost" data-ie="restore" data-id="${e.id}">استعادة</button>` : `<button class="btn sm ghost" data-ie="withdraw" data-id="${e.id}">انسحاب</button>`);
      return b.join(' ');
    };
    const rows = E.map((e) => `<tr><td>${esc(e.name)}${e.ext ? ' <span class="pg-tag">خارجي</span>' : ''}${e.data && e.data.other_course ? ' <span class="pg-tag w">في دورة أخرى</span>' : ''}</td>
      <td>${esc(halName(e.halaqa_id))}</td><td>${STATUS[e.status] || ''}</td><td>${e.tasfiya ? (e.tasfiya.absent ? 'غائب' : num(e.tasfiya.v)) : ''}</td>
      <td>${e.terms && e.terms.at ? '✓' : e.terms && e.terms.sent ? 'أُرسلت' : ''}</td><td>${TRACK[e.track] || ''}</td><td>${e.group_id ? esc(grpName(e.group_id)) : ''}</td>
      <td>${esc(e.target || '')}</td><td class="pg-acts">${acts(e)}</td></tr>`).join('');
    const open = S.course.status !== 'closed';
    const canNom = open && ['admin', 'supervisor', 'teacher'].includes(role());
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      ${canNom ? '<button class="btn" data-ia="nominate">ترشيح طلاب</button>' : ''}
      ${open && org ? '<button class="btn ghost" data-ia="ext">+ طالب خارجي</button><button class="btn ghost" data-ia="terms">إرسال الشروط لمن اجتاز</button><button class="btn ghost" data-ia="groups">المجموعات</button>' : ''}
      <span class="muted">مرشح ${cnt('nominated')} · منتقى ${cnt('selected')} · اجتاز ${cnt('passed')} · في الدورة ${cnt('accepted')}</span></div></div>
      <div class="card tbl"><table data-print="طلاب ${esc(S.course.name)}"><thead><tr><th>الاسم</th><th>الحلقة</th><th>الحال</th><th>التصفية</th><th>الشروط</th><th>المسار</th><th>المجموعة</th><th>الهدف</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9">${empty('لا يوجد طلاب بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  const visibleAccepted = () => (S.c.entries || []).filter((e) => e.status === 'accepted' && (!S.group || e.group_id === S.group));
  const groupFilter = () => `<select data-if="group" data-nosearch><option value="">كل المجموعات</option>${(S.c.groups || []).map((g) => `<option value="${g.id}" ${S.group === g.id ? 'selected' : ''}>${esc(g.name)}${g.teacher ? ' — ' + esc(g.teacher) : ''}</option>`).join('')}</select>`;

  function dailyView() {
    const D = {}; (S.c.daily || []).forEach((d) => { D[d.entry_id] = d; });
    const E = visibleAccepted().filter((e) => e.can_daily);
    const inp = (e, k, d) => `<input type="number" min="0" step="0.5" data-d="${k}" value="${d ? num(d[k]) : ''}" style="width:4.2rem">`;
    const rows = E.map((e) => { const d = D[e.id]; return `<tr data-eid="${e.id}"><td>${esc(e.name)}</td><td>${TRACK[e.track] || ''}</td>
      <td><input type="checkbox" data-d="present" ${!d || d.present ? 'checked' : ''}></td>
      <td>${e.track === 'new' ? inp(e, 'new_pages', d) : '—'}</td><td>${inp(e, 'rev_pages', d)}</td><td>${inp(e, 'course_grade', d)}</td>
      <td>${inp(e, 'home_pages', d)}</td><td>${inp(e, 'home_grade', d)}</td><td>${d ? '<small class="muted">مسجّل</small>' : ''}</td></tr>`; }).join('');
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <label>اليوم <input type="date" data-if="date" value="${S.date}"></label>${groupFilter()}
      <button class="btn" data-ia="savedaily">حفظ الكراسة</button><span class="muted">من سُجِّل له يُعدّ حاضرًا؛ أزل العلامة للغائب.</span></div></div>
      <div class="card tbl"><table><thead><tr><th>الطالب</th><th>المسار</th><th>حاضر</th><th>جديد (ص)</th><th>مراجعة (ص)</th><th>درجة الدورة</th><th>المنزلي (ص)</th><th>درجة المنزلي</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9">${empty('لا يوجد طلاب في مجموعاتك.')}</td></tr>`}</tbody></table></div>`;
  }

  function weeklyView() {
    const W = {}; (S.c.weekly || []).forEach((w) => { W[w.entry_id + ':' + w.wk] = w; });
    const weeks = Math.max(1, ...((S.c.weekly || []).map((w) => w.wk)), S.wk);
    const E = visibleAccepted().filter((e) => e.can_weekly);
    const mx = (S.course.cfg || {}).weekly_max || 30;
    const rows = E.map((e) => { const w = W[e.id + ':' + S.wk]; return `<tr data-eid="${e.id}"><td>${esc(e.name)}</td>
      <td><input type="number" min="0" max="${mx}" step="0.25" data-w="score" value="${w && !w.absent ? num(w.score) : ''}" style="width:5rem"></td>
      <td><input type="checkbox" data-w="absent" ${w && w.absent ? 'checked' : ''}></td>
      <td>${Array.from({ length: weeks }, (_, i) => { const x = W[e.id + ':' + (i + 1)]; return x ? (x.absent ? 'غ' : num(x.score)) : '·'; }).join(' | ')}</td></tr>`; }).join('');
    const opts = Array.from({ length: weeks + 1 }, (_, i) => `<option value="${i + 1}" ${S.wk === i + 1 ? 'selected' : ''}>الأسبوع ${i + 1}</option>`).join('');
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <select data-if="wk" data-nosearch>${opts}</select>${groupFilter()}<button class="btn" data-ia="saveweekly">حفظ الدرجات</button>
      <span class="muted">الدرجة من ${mx}${(S.course.cfg || {}).weekly_day ? ' · يوم الاختبار: ' + esc(S.course.cfg.weekly_day) : ''}</span></div></div>
      <div class="card tbl"><table><thead><tr><th>الطالب</th><th>الدرجة</th><th>غائب</th><th>كل الأسابيع</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">${empty('لا يوجد طلاب.')}</td></tr>`}</tbody></table></div>`;
  }

  function pointsView() {
    const P = S.c.points || [], E = (S.c.entries || []).filter((e) => e.status === 'accepted');
    const tot = {}; P.forEach((p) => { tot[p.entry_id] = (tot[p.entry_id] || 0) + +p.pts; });
    const nm = (id) => (E.find((e) => e.id === id) || {}).name || '';
    return `<div class="card"><h3>منح نقاط</h3><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:end">
      <label>النقاط<input type="number" step="1" data-p="pts" value="1" style="width:5rem"></label><label style="flex:1">السبب<input data-p="why" placeholder="مثل: حفظ دعاء الختم"></label>
      <button class="btn" data-ia="addpoints">منح للمحددين</button></div>
      <div class="pg-notes">${E.map((e) => `<label class="pg-chip"><input type="checkbox" data-p="e" value="${e.id}"> ${esc(e.name)} (${tot[e.id] || 0})</label>`).join('')}</div>
      <label><input type="checkbox" data-p="all"> تحديد الكل</label></div>
      <div class="card tbl"><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>النقاط</th><th>السبب</th><th>بواسطة</th><th></th></tr></thead>
      <tbody>${P.map((p) => `<tr><td>${p.dt}</td><td>${esc(nm(p.entry_id))}</td><td>${num(p.pts)}</td><td>${esc(p.reason)}</td><td>${esc(p.by_name || '')}</td><td><button class="btn sm ghost" data-ip="${p.id}">حذف</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('لا نقاط بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  function resultsView() {
    const R = (S.c.results || []).map((r) => Object.assign({}, r, { total: +(r.attendance + r.points + r.weekly + r.final + r.daily).toFixed(2) }));
    const cats = [...new Set(R.map((r) => r.category))];
    const E = {}; (S.c.entries || []).forEach((e) => { E[e.id] = e; });
    const cfg = S.course.cfg || {}, rs = cfg.result || { attendance: 120, points: 40, weekly: 90, final: 100 };
    const tables = cats.map((cat) => {
      const rows = R.filter((r) => r.category === cat).sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.total - a.total);
      return `<div class="card"><h3>${esc(cat)} (${rows.length})</h3></div><div class="card tbl"><table data-print="نتيجة ${esc(S.course.name)} — ${esc(cat)}">
        <thead><tr><th>الترتيب</th><th>الاسم</th><th>الصفحات</th><th>الانتظام (${rs.attendance || 0})</th><th>النقاط (${rs.points || 0})</th><th>الأسبوعي (${rs.weekly || 0})</th><th>النهائي (${rs.final || 0})</th>${rs.daily ? `<th>الكراسة (${rs.daily})</th>` : ''}<th>الإجمالي</th><th>درجة النهائي</th><th>الجائزة</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-rid="${r.id}"><td><input type="number" min="1" data-r="rank" value="${r.rank || ''}" style="width:3.6rem">${r.rank_manual ? ' <small>يدوي</small>' : ''}</td>
          <td>${esc(r.name)}</td><td>${num(r.pages)}</td><td>${num(r.attendance)}</td><td>${num(r.points)}</td><td>${num(r.weekly)}</td><td>${num(r.final)}</td>${rs.daily ? `<td>${num(r.daily)}</td>` : ''}
          <td><b>${r.total}</b></td><td><input type="number" min="0" data-r="final" value="${num((E[r.id] || {}).final)}" style="width:4.5rem"></td>
          <td><input type="number" min="0" step="5" data-r="prize" value="${num(r.prize)}" style="width:5.5rem"></td></tr>`).join('')}</tbody></table></div>`;
    }).join('');
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <button class="btn" data-ia="savefinal">حفظ درجات النهائي</button><button class="btn" data-ia="approve">اعتماد النتيجة والترتيب</button>
      <button class="btn ghost" data-ia="saveprizes">حفظ الترتيب والجوائز</button>
      <span class="muted">${cfg.approved ? 'اعتُمدت ' + new Date(cfg.approved).toLocaleDateString('ar-EG') : 'لم تُعتمد بعد'} · الترتيب داخل كل فئة · الإجمالي يُحسب من البنود في الإعدادات</span></div></div>` + (tables || `<div class="card">${empty('لا يوجد طلاب في الدورة.')}</div>`);
  }

  function teachersView() {
    const cfg = S.course.cfg || {}, T = S.c.tatt || [], P = S.c.pay || [];
    const opts = [...(db.teachers || []), ...(db.supervisors || [])].map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    const pay = cfg.pay ? `<div class="card"><h3>المرتبات</h3><p class="muted">أساسي + حافز + تميز − دقائق التأخير × ${num(cfg.late_rate) || 0}</p></div>
      <div class="card tbl"><table data-print="مرتبات ${esc(S.course.name)}"><thead><tr><th>المعلم</th><th>أيام</th><th>دقائق التأخير</th><th>أساسي</th><th>حافز</th><th>تميز</th><th>الخصم</th><th>الراتب</th><th></th></tr></thead>
      <tbody>${P.map((p) => `<tr data-mid="${p.member_id}"><td>${esc(p.name)}</td><td>${p.days}</td><td>${p.late_mins}</td>
        <td><input type="number" data-y="b" value="${num(p.basic)}" style="width:5rem"></td><td><input type="number" data-y="i" value="${num(p.incentive)}" style="width:5rem"></td>
        <td><input type="number" data-y="d" value="${num(p.distinction)}" style="width:5rem"></td><td>${num(p.deduction)}</td><td><b>${num(p.salary)}</b></td>
        <td><button class="btn sm" data-ia="savepay">حفظ</button></td></tr>`).join('') || `<tr><td colspan="9">${empty('أضف معلمين للمجموعات أو سجّل حضورهم.')}</td></tr>`}</tbody></table></div>`
      : '<div class="card"><p class="muted">المرتبات غير مفعّلة لهذه الدورة (من الإعدادات).</p></div>';
    return `<div class="card"><h3>حضور المعلمين</h3><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:end">
      <label>اليوم<input type="date" data-t="dt" value="${today()}"></label><label>المعلم<select data-t="mid">${opts}</select></label>
      <label>الحضور<input type="time" data-t="in"></label><label>الانصراف<input type="time" data-t="out"></label><button class="btn" data-ia="savetatt">حفظ</button></div>
      <p class="muted">المدة المطلوبة: ${esc(cfg.t_required || '03:00')} · تعديل يوم مسجّل يُكتب في السجل.</p></div>
      <div class="card tbl"><table data-print="حضور معلمي ${esc(S.course.name)}"><thead><tr><th>اليوم</th><th>المعلم</th><th>الحضور</th><th>الانصراف</th><th>المدة (د)</th><th>التأخير (د)</th></tr></thead>
      <tbody>${T.map((t) => `<tr><td>${t.dt}</td><td>${esc(t.name)}</td><td>${(t.t_in || '').slice(0, 5)}</td><td>${(t.t_out || '').slice(0, 5)}</td><td>${t.mins ?? ''}</td><td>${t.late ? `<b>${t.late}</b>` : ''}${t.edited ? ' <small>معدّل</small>' : ''}</td></tr>`).join('') || `<tr><td colspan="6">${empty('لا تسجيلات بعد.')}</td></tr>`}</tbody></table></div>` + pay;
  }

  function logView() {
    const L = S.c.log || [];
    return `<div class="card tbl"><table><thead><tr><th>الوقت</th><th>بواسطة</th><th>الإجراء</th><th>التفاصيل</th></tr></thead>
      <tbody>${L.map((l) => `<tr class="${l.warn ? 'pg-warnrow' : ''}"><td>${new Date(l.at).toLocaleString('ar-EG')}</td><td>${esc(l.by_name || '')}</td><td>${esc(l.action)}${l.warn ? ' ⚠' : ''}</td><td><small>${esc(JSON.stringify(l.detail))}</small></td></tr>`).join('') || `<tr><td colspan="4">${empty('لا شيء بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- النوافذ
  function openNewRoot() {
    let y; try { y = +new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }).format(new Date()).replace(/\D/g, ''); } catch (e) { y = new Date().getFullYear() - 578; }
    openForm('نسخة جديدة من الدورة المكثفة', [{ name: 'name', label: 'الاسم', value: 'الدورة المكثفة ' + y }, { name: 'year', label: 'السنة الهجرية', value: String(y) }], (v) => {
      if (!v.name || !+v.year) return 'اكتب الاسم والسنة';
      rpc('prog_save', { pid: null, knd: 'intensive', nm: v.name, yr: +v.year, cf: { tasfiya_pass: 80, weekly_max: 30, result: { attendance: 120, points: 40, weekly: 90, final: 100 } } })
        .then(async (id) => { await loadRoots(); openRoot(id); }).catch((e) => toast(errMsg(e)));
      return '';
    });
  }
  function openNewCourse() {
    openForm('فتح دورة', [{ name: 'name', label: 'اسم الدورة (مثل: دورة التوحيد)', value: '' }], (v) => {
      if (!v.name) return 'اكتب اسم الدورة';
      rpc('crs_open', { root: S.root.id, nm: v.name }).then(async (id) => { await openRoot(S.root.id); openCourse(id); }).catch((e) => toast(errMsg(e)));
      return '';
    });
  }

  // إعدادات (للنسخة العامة أو للدورة): نفس الحقول؛ الدورة ترث قيم النسخة عند فتحها
  function openSettings(p, isRoot) {
    const c = p.cfg || {}, rs = c.result || {}, cat = c.categories || {};
    const sups = (db.supervisors || []).filter((s) => !(window.isGenSup && window.isGenSup(s)));
    const staff = isRoot ? (S.rootStaff || []) : (S.c.staff || []);
    const f = (k, l, v, t) => `<label>${l}<input data-k="${k}" ${t ? `type="${t}"` : ''} value="${esc(v == null ? '' : String(v))}"></label>`;
    const o = modal(isRoot ? 'الإعدادات العامة للنسخة' : 'إعدادات الدورة', `
      <p class="muted">لا يلزم ملء كل الإعدادات مرة واحدة، ويمكن تعديلها في أي وقت.${isRoot ? ' القيم هنا افتراضية تُنسخ إلى كل دورة جديدة.' : ''}</p>
      <details open><summary><b>عام</b></summary>${f('name', 'الاسم', p.name)}
        ${isRoot ? '' : f('place', 'المكان', c.place) + f('time', 'الوقت (مثل 12 - 3)', c.time) + f('start', 'البداية', c.start, 'date') + f('end', 'النهاية', c.end, 'date') + f('days', 'أيام الدوام', c.days)}
        ${f('tasfiya_pass', 'نسبة النجاح في التصفية', c.tasfiya_pass, 'number')}
        <label>نص الشروط<textarea data-k="terms" rows="3">${esc(c.terms || '')}</textarea></label></details>
      <details><summary><b>الاختبارات والكراسة</b></summary>
        ${f('weekly_day', 'يوم الاختبار الأسبوعي', c.weekly_day || 'الجمعة')}${f('weekly_max', 'درجة الاختبار الأسبوعي العظمى', c.weekly_max || 30, 'number')}
        ${f('final_max', 'درجة الاختبار النهائي العظمى', c.final_max || 100, 'number')}${f('daily_max', 'درجة الكراسة اليومية العظمى (الدورة + المنزلي)', c.daily_max || 20, 'number')}
        <label><input type="checkbox" data-k="weekly_teacher" ${c.weekly_teacher === false ? '' : 'checked'}> معلم المجموعة يرصد الاختبار الأسبوعي</label></details>
      <details><summary><b>بنود النتيجة</b> (الدرجة العظمى لكل بند، 0 = لا يدخل)</summary>
        ${f('r_attendance', 'الانتظام', rs.attendance ?? 120, 'number')}${f('r_points', 'النقاط / الأدب', rs.points ?? 40, 'number')}${f('r_weekly', 'الاختبارات الأسبوعية', rs.weekly ?? 90, 'number')}
        ${f('r_final', 'الاختبار النهائي', rs.final ?? 100, 'number')}${f('r_daily', 'درجات الكراسة', rs.daily ?? 0, 'number')}
        ${f('c_khatm', 'فئة «ختم: مراجعة»', cat.khatm || 'الخاتمون')}${f('c_review', 'فئة «مراجعة فقط»', cat.review || 'غير الخاتمين')}${f('c_new', 'فئة «حفظ جديد ومراجعة»', cat.new || 'غير الخاتمين')}</details>
      ${isRoot ? '' : `<details><summary><b>المعلمون والمرتبات</b></summary>${f('t_required', 'المدة اليومية المطلوبة للمعلم (س:د)', c.t_required || '03:00')}
        <label><input type="checkbox" data-k="pay" ${c.pay ? 'checked' : ''}> حساب المرتبات في هذه الدورة</label>${f('late_rate', 'خصم دقيقة التأخير', c.late_rate || 0, 'number')}</details>`}
      <div class="row"><button class="btn" data-k="save">حفظ</button></div>
      <hr><h3>${isRoot ? 'المسؤول عن الإعدادات العامة' : 'الطاقم'}</h3>
      <ul class="pg-staff">${staff.map((s) => `<li>${esc(s.name)} <small class="muted">${{ organizer: 'منظم', tester: 'مختبِر', judge: 'محكّم' }[s.role]}</small> <button class="btn sm ghost" data-sdel="${s.id}">حذف</button></li>`).join('') || '<li class="muted">لا أحد</li>'}</ul>
      ${isAdminLike() ? `<div class="row" style="gap:.4rem"><select data-k="org"><option value="">مشرف…</option>${sups.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn sm" data-k="addorg">${isRoot ? 'إسناد الإعدادات العامة' : 'إضافة منظم'}</button></div>` : ''}
      ${isRoot ? '' : `<div class="row" style="gap:.4rem;margin-top:.4rem"><select data-k="tester">${[...(db.teachers || []), ...(db.supervisors || [])].map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
        <select data-k="tgroups" multiple size="3" title="المجموعات (فارغ = الكل)">${(S.c.groups || []).map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
        <button class="btn sm" data-k="addtester">إضافة مختبِر للأسبوعي</button></div>`}`, true);
    const g = (k) => o.querySelector(`[data-k=${k}]`);
    const val = (k) => (g(k) ? g(k).value.trim() : undefined);
    const n = (k) => (val(k) === '' || val(k) === undefined ? null : +val(k));
    o.addEventListener('click', async (ev) => {
      const del = ev.target.closest('[data-sdel]');
      if (del) { try { await run(del, rpc('prog_staff_del', { stid: del.dataset.sdel }), 'حُذف'); o.remove(); await afterSettings(isRoot); } catch (x) { /* toast */ } return; }
      const b = ev.target.closest('button[data-k]'); if (!b) return;
      if (b.dataset.k === 'save') {
        const cf = {
          tasfiya_pass: n('tasfiya_pass'), terms: val('terms'), weekly_day: val('weekly_day'), weekly_max: n('weekly_max'), final_max: n('final_max'), daily_max: n('daily_max'),
          weekly_teacher: g('weekly_teacher').checked,
          result: { attendance: n('r_attendance') || 0, points: n('r_points') || 0, weekly: n('r_weekly') || 0, final: n('r_final') || 0, daily: n('r_daily') || 0 },
          categories: { khatm: val('c_khatm'), review: val('c_review'), new: val('c_new') },
        };
        if (!isRoot) Object.assign(cf, { place: val('place'), time: val('time'), start: val('start') || null, end: val('end') || null, days: val('days'), t_required: val('t_required'), pay: g('pay').checked, late_rate: n('late_rate') });
        try { await run(b, rpc('prog_save', { pid: p.id, knd: 'intensive', nm: val('name'), yr: null, cf }), 'حُفظت الإعدادات'); o.remove(); await afterSettings(isRoot); } catch (x) { /* toast */ }
      } else if (b.dataset.k === 'addorg') {
        if (!val('org')) return toast('اختر المشرف');
        try { await run(b, rpc('prog_staff_add', { pid: p.id, mid: val('org'), ename: null, rl: 'organizer', sc: {} }), 'أُضيف'); o.remove(); await afterSettings(isRoot); } catch (x) { /* toast */ }
      } else if (b.dataset.k === 'addtester') {
        const gs = [...g('tgroups').selectedOptions].map((x) => x.value);
        try { await run(b, rpc('prog_staff_add', { pid: p.id, mid: val('tester'), ename: null, rl: 'tester', sc: gs.length ? { groups: gs } : {} }), 'أُضيف'); o.remove(); await afterSettings(isRoot); } catch (x) { /* toast */ }
      }
    });
  }
  async function afterSettings(isRoot) {
    if (isRoot) { await loadRoots(); S.root = (S.roots || []).find((r) => r.id === S.root.id) || S.root; S.rootStaff = await rpc('prog_staff_list', { pid: S.root.id }); openRoot(S.root.id); }
    else await reloadCourse();
  }

  function openGroups() {
    const G = S.c.groups || [];
    const opts = (sel) => `<option value="">— المعلم —</option>` + [...(db.teachers || []), ...(db.supervisors || [])].map((t) => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const o = modal('مجموعات الدورة', `<div class="tbl"><table><thead><tr><th>الاسم</th><th>المعلم</th><th>الطلاب</th><th></th></tr></thead><tbody>
      ${G.map((g) => `<tr data-gid="${g.id}"><td><input data-g="name" value="${esc(g.name)}"></td><td><select data-g="tid">${opts(g.teacher_id)}</select></td><td>${g.n}</td>
        <td><button class="btn sm" data-g="save">حفظ</button> <button class="btn sm ghost" data-g="del">حذف</button></td></tr>`).join('')}
      <tr data-gid=""><td><input data-g="name" placeholder="مجموعة جديدة"></td><td><select data-g="tid">${opts('')}</select></td><td></td><td><button class="btn sm" data-g="save">إضافة</button></td></tr>
      </tbody></table></div>`, true);
    o.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-g]'); if (!b) return;
      const tr = b.closest('tr'), gid = tr.dataset.gid || null;
      try {
        if (b.dataset.g === 'del') await run(b, rpc('crs_group_del', { gid }), 'حُذفت');
        else { const nm = tr.querySelector('[data-g=name]').value.trim(); if (!nm) return toast('اكتب اسم المجموعة'); await run(b, rpc('crs_group_save', { gid, cid: S.course.id, nm, tid: tr.querySelector('[data-g=tid]').value || null }), 'حُفظت'); }
        o.remove(); await reloadCourse(); openGroups();
      } catch (x) { /* toast */ }
    });
  }

  function openNominate() {
    const taken = new Set((S.c.entries || []).map((e) => e.student_id));
    const mine = typeof window.QLMyHal === 'function' ? new Set((window.QLMyHal() || []).map((h) => h.id || h)) : null;
    const pool = (db.students || []).filter((s) => !taken.has(s.id) && !(s.info && s.info.status === 'منقطع') && (S.course.is_org || !mine || mine.has(s.halaqaId)));
    const o = modal('ترشيح طلاب', `<input data-n="q" placeholder="بحث بالاسم" style="max-width:14rem">
      <div class="tbl" style="max-height:55vh;overflow:auto"><table><thead><tr><th></th><th>الاسم</th><th>الحلقة</th></tr></thead><tbody>
      ${pool.slice(0, 3000).map((s) => `<tr data-sid="${s.id}"><td><input type="checkbox" value="${s.id}"></td><td>${esc(s.name)}</td><td>${esc(halName(s.halaqaId))}</td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn" data-n="go">ترشيح المحددين</button></div>`, true);
    o.querySelector('[data-n=q]').addEventListener('input', (ev) => { const q = ev.target.value.trim(); o.querySelectorAll('tr[data-sid]').forEach((tr) => { tr.hidden = q && !tr.children[1].textContent.includes(q); }); });
    o.querySelector('[data-n=go]').addEventListener('click', async (ev) => {
      const ids = [...o.querySelectorAll('tr[data-sid] input:checked')].map((x) => x.value);
      if (!ids.length) return toast('حدد طالبًا على الأقل');
      let ok = 0; for (const sid of ids) { try { await rpc('crs_nominate', { cid: S.course.id, sid, ex: null }); ok++; } catch (e) { toast(errMsg(e)); } }
      toast(`رُشِّح ${ok}`); o.remove(); reloadCourse();
    });
  }

  function openExt() {
    const o = modal('إضافة طالب خارجي', `<label>الاسم<input data-x="name"></label><label>الجوال<input data-x="phone" type="tel"></label>
      <label>ولي الأمر<input data-x="guardian"></label><label>السن<input data-x="age"></label>
      <p class="muted">يُضاف مباشرة إلى التصفية. الحساب المؤقت للخارجي يُضاف في تحديث لاحق.</p><div class="row"><button class="btn" data-x="save">إضافة</button></div>`);
    o.querySelector('[data-x=save]').addEventListener('click', async (ev) => {
      const g = (k) => o.querySelector(`[data-x=${k}]`).value.trim();
      try { await run(ev.target, rpc('crs_nominate', { cid: S.course.id, sid: null, ex: { name: g('name'), phone: g('phone'), guardian: g('guardian'), age: g('age') } }), 'أُضيف'); o.remove(); reloadCourse(); } catch (x) { /* toast */ }
    });
  }

  function openTasfiya(e) {
    const o = modal(`التصفية — ${esc(e.name)}`, `<label>الدرجة<input type="number" min="0" max="100" step="0.25" data-t="v" value="${e.tasfiya && !e.tasfiya.absent ? num(e.tasfiya.v) : ''}"></label>
      <label><input type="checkbox" data-t="absent" ${e.tasfiya && e.tasfiya.absent ? 'checked' : ''}> غائب</label>
      <p class="muted">نسبة النجاح: ${num((S.course.cfg || {}).tasfiya_pass) || 'غير محددة'}</p><div class="row"><button class="btn" data-t="save">حفظ</button></div>`);
    o.querySelector('[data-t=save]').addEventListener('click', async (ev) => {
      const absent = o.querySelector('[data-t=absent]').checked, v = o.querySelector('[data-t=v]').value;
      if (!absent && v === '') return toast('اكتب الدرجة أو علّم «غائب»');
      try { await run(ev.target, rpc('crs_tasfiya', { eid: e.id, v: absent ? null : +v, absent }), 'حُفظت'); o.remove(); reloadCourse(); } catch (x) { /* toast */ }
    });
  }

  function openAssign(e) {
    const o = modal(`المسار والمجموعة — ${esc(e.name)}`, `
      <label>المسار<select data-a="trk" data-nosearch><option value="">—</option>${Object.entries(TRACK).map(([k, l]) => `<option value="${k}" ${e.track === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>المجموعة<select data-a="gid" data-nosearch><option value="">—</option>${(S.c.groups || []).map((g) => `<option value="${g.id}" ${e.group_id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label>الهدف الاسترشادي (اختياري)<input data-a="tgt" value="${esc(e.target || '')}" placeholder="مثل: 10 أجزاء، أو من البقرة إلى التوبة"></label>
      <div class="row"><button class="btn" data-a="save">حفظ</button></div>`);
    o.querySelector('[data-a=save]').addEventListener('click', async (ev) => {
      const g = (k) => o.querySelector(`[data-a=${k}]`).value;
      try { await run(ev.target, rpc('crs_assign', { eid: e.id, trk: g('trk') || null, gid: g('gid') || null, tgt: g('tgt') }), 'حُفظ'); o.remove(); reloadCourse(); } catch (x) { /* toast */ }
    });
  }

  // ---------------------------------------------------------------- «دورتي» للطالب
  let MYD = null;
  function myView() {
    if (!CLOUD()) return `<div class="card">${empty('يعمل مع الخادم فقط.')}</div>`;
    if (MYD === null) { setTimeout(async () => { try { MYD = await rpc('crs_my'); } catch (e) { MYD = []; } rerender(); }, 0); return '<div class="card"><p class="muted">جارٍ التحميل…</p></div>'; }
    if (!MYD.length) return `<div class="card"><h2>دورتي</h2>${empty('لست مسجلًا في دورة حالية.')}</div>`;
    return MYD.map((m) => {
      const terms = m.status === 'passed' && m.terms_text ? `<div class="card"><h3>شروط الدورة</h3><p>${esc(m.terms_text)}</p><button class="btn" data-my="accept" data-id="${m.entry_id}">أوافق على الشروط</button></div>` : '';
      const d = (m.daily || []).map((x) => `<tr><td>${x.dt}</td><td>${x.present ? 'حاضر' : 'غائب'}</td><td>${num(x.new)}</td><td>${num(x.rev)}</td><td>${num(x.cg)}</td><td>${num(x.home)}</td><td>${num(x.hg)}</td></tr>`).join('');
      const tot = (m.daily || []).reduce((t, x) => t + (+x.new || 0) + (+x.rev || 0) + (+x.home || 0), 0);
      const w = (m.weekly || []).map((x) => `<tr><td>الأسبوع ${x.wk}</td><td>${x.absent ? 'غائب' : num(x.score)}</td></tr>`).join('');
      return `<div class="card"><h2>${esc(m.course)}</h2><p class="muted">${TRACK[m.track] || ''}${m.status === 'accepted' ? ` · مجموع الصفحات: ${tot}` : ''}</p></div>${terms}
        ${m.status === 'accepted' ? `<div class="card tbl"><table><thead><tr><th>اليوم</th><th>الحضور</th><th>جديد</th><th>مراجعة</th><th>درجة الدورة</th><th>المنزلي</th><th>درجة المنزلي</th></tr></thead><tbody>${d || `<tr><td colspan="7">${empty('لا تسجيلات بعد.')}</td></tr>`}</tbody></table></div>
        <div class="card tbl"><table><thead><tr><th>الاختبار الأسبوعي</th><th>الدرجة</th></tr></thead><tbody>${w || `<tr><td colspan="2">${empty('لا اختبارات بعد.')}</td></tr>`}</tbody></table></div>` : ''}`;
    }).join('');
  }

  // ---------------------------------------------------------------- الأحداث
  const byE = (id) => (S.c.entries || []).find((e) => e.id === id);
  document.addEventListener('click', async (ev) => {
    if (onTab(MY)) {
      const b = ev.target.closest('main [data-my]'); if (!b) return;
      try { await run(b, rpc('crs_accept_terms', { eid: b.dataset.id }), 'تمت الموافقة'); MYD = null; render(); } catch (x) { /* toast */ }
      return;
    }
    if (!onTab(KEY)) return;
    const k = ev.target.closest('main [data-ik]');
    if (k) { S.kind = k.dataset.ik; return render(); }
    if (S.kind !== 'intensive') return;
    const t = ev.target.closest('main [data-it]');
    if (t) { S.tab = t.dataset.it; try { await loadTab(); } catch (e) { toast(errMsg(e)); } return render(); }
    const pd = ev.target.closest('main [data-ip]');
    if (pd) { try { await run(pd, rpc('crs_points_del', { pid_: pd.dataset.ip }), 'حُذفت'); await loadTab(); render(); } catch (x) { /* toast */ } return; }
    const be = ev.target.closest('main [data-ie]');
    if (be) {
      const e = byE(be.dataset.id), a = be.dataset.ie;
      if (a === 'tasfiya') return openTasfiya(e);
      if (a === 'assign') return openAssign(e);
      try { await run(be, rpc('crs_set_status', { eid: e.id, act: a }), 'تم'); reloadCourse(); } catch (x) { /* toast */ }
      return;
    }
    const b = ev.target.closest('main [data-ia]'); if (!b) return;
    const a = b.dataset.ia, cid = S.course && S.course.id;
    if (a === 'newroot') return openNewRoot();
    if (a === 'root') { try { S.rootStaff = await rpc('prog_staff_list', { pid: b.dataset.id }); } catch (e) { S.rootStaff = []; } return openRoot(b.dataset.id); }
    if (a === 'back') { S.root = null; S.roots = null; return render(); }
    if (a === 'backroot') { S.course = null; S.c = null; return openRoot(S.root.id); }
    if (a === 'opencourse') return openNewCourse();
    if (a === 'course') return openCourse(b.dataset.id);
    if (a === 'reload') { S.err = ''; return reloadCourse(); }
    if (a === 'rootset') return openSettings(S.root, true);
    if (a === 'courseset') return openSettings(S.course, false);
    if (a === 'nominate') return openNominate();
    if (a === 'ext') return openExt();
    if (a === 'groups') return openGroups();
    if (a === 'terms') return ask('إرسال الشروط إلى كل من اجتاز التصفية ولم تُرسل له؟', async () => { try { const n = await run(b, rpc('crs_send_terms', { cid })); toast(`أُرسلت إلى ${n}`); reloadCourse(); } catch (x) { /* toast */ } });
    if (a === 'savedaily') {
      const rows = [...document.querySelectorAll('main tr[data-eid]')].map((tr) => {
        const g = (k2) => { const x = tr.querySelector(`[data-d=${k2}]`); return x ? x.value : ''; };
        const present = tr.querySelector('[data-d=present]').checked;
        const r = { entry: tr.dataset.eid, present, new_pages: g('new_pages'), rev_pages: g('rev_pages'), course_grade: g('course_grade'), home_pages: g('home_pages'), home_grade: g('home_grade') };
        const filled = ['new_pages', 'rev_pages', 'course_grade', 'home_pages', 'home_grade'].some((k2) => r[k2] !== '');
        return present && !filled ? null : r;
      }).filter(Boolean);
      if (!rows.length) return toast('لا يوجد ما يُحفظ');
      try { const n = await run(b, rpc('crs_daily_save', { cid, d: S.date, rows })); toast(`حُفظ ${n}`); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'saveweekly') {
      let n = 0;
      for (const tr of document.querySelectorAll('main tr[data-eid]')) {
        const v = tr.querySelector('[data-w=score]').value, ab = tr.querySelector('[data-w=absent]').checked;
        if (v === '' && !ab) continue;
        try { await rpc('crs_weekly_save', { eid: tr.dataset.eid, w: S.wk, d: today(), v: ab ? null : +v, absent: ab }); n++; } catch (e) { toast(errMsg(e)); }
      }
      toast(`حُفظ ${n}`); await loadTab(); return render();
    }
    if (a === 'addpoints') {
      const ids = [...document.querySelectorAll('main [data-p=e]:checked')].map((x) => x.value);
      const pts = +document.querySelector('main [data-p=pts]').value, why = document.querySelector('main [data-p=why]').value.trim();
      if (!ids.length || !why) return toast('حدد الطلاب واكتب السبب');
      try { const n = await run(b, rpc('crs_points_add', { cid, entries: ids, p: pts, why })); toast(`مُنحت لـ ${n}`); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'savefinal' || a === 'saveprizes') {
      const trs = [...document.querySelectorAll('main tr[data-rid]')];
      try {
        if (a === 'savefinal') await run(b, rpc('crs_final_save', { items: trs.map((tr) => ({ id: tr.dataset.rid, final: tr.querySelector('[data-r=final]').value })) }), 'حُفظت درجات النهائي');
        else await run(b, rpc('crs_rank_prize', { items: trs.map((tr) => ({ id: tr.dataset.rid, rank: tr.querySelector('[data-r=rank]').value, prize: tr.querySelector('[data-r=prize]').value })) }), 'حُفظ الترتيب والجوائز');
        await reloadCourse();
      } catch (x) { /* toast */ }
      return;
    }
    if (a === 'approve') return ask('اعتماد النتيجة؟ يُحسب الإجمالي ويُرتَّب الطلاب داخل كل فئة (يبقى الترتيب اليدوي كما هو).', async () => { try { await run(b, rpc('crs_approve', { cid }), 'اعتُمدت'); reloadCourse(); } catch (x) { /* toast */ } });
    if (a === 'savetatt') {
      const g = (k2) => document.querySelector(`main [data-t=${k2}]`).value;
      if (!g('mid') || !g('dt')) return toast('اختر المعلم واليوم');
      try { await run(b, rpc('crs_tatt_save', { cid, mid: g('mid'), d: g('dt'), tin: g('in') || null, tout: g('out') || null }), 'حُفظ'); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'savepay') {
      const tr = b.closest('tr'), g = (k2) => { const v = tr.querySelector(`[data-y=${k2}]`).value; return v === '' ? null : +v; };
      try { await run(b, rpc('crs_pay_save', { cid, mid: tr.dataset.mid, b: g('b'), i: g('i'), d: g('d') }), 'حُفظ'); await loadTab(); render(); } catch (x) { /* toast */ }
    }
  });
  document.addEventListener('change', async (ev) => {
    if (!onTab(KEY) || S.kind !== 'intensive') return;
    const f = ev.target.closest('main [data-if]');
    if (f) {
      if (f.dataset.if === 'date') S.date = f.value || today();
      if (f.dataset.if === 'group') S.group = f.value;
      if (f.dataset.if === 'wk') S.wk = +f.value || 1;
      try { await loadTab(); } catch (e) { toast(errMsg(e)); }
      return render();
    }
    if (ev.target.matches('main [data-p=all]')) document.querySelectorAll('main [data-p=e]').forEach((x) => { x.checked = ev.target.checked; });
  });

  // ---------------------------------------------------------------- إظهار القسم لكل فئة (يحدده المدير)
  const VIS_ROLES = [['gmanager', 'المدير العام'], ['supervisor', 'المشرفون'], ['teacher', 'المعلمون'], ['placeadmin', 'الإداريون'], ['student', 'الطلاب («دورتي»)']];
  let VIS = null; // {hidden: ['teacher', ...]}
  const myCat = () => role() === 'supervisor' && window.isGenSup && typeof me === 'function' && window.isGenSup(me()) ? 'gmanager' : role();
  const hiddenForMe = () => role() !== 'admin' && !!(VIS && (VIS.hidden || []).includes(myCat()));
  const rerenderAny = () => { try { if (typeof session !== 'undefined' && session) render(); } catch (e) { /* ignore */ } };
  async function loadVis() { try { VIS = (await rpc('prog_vis_get')) || {}; } catch (e) { VIS = {}; } rerenderAny(); }
  function openVis() {
    const h = (VIS && VIS.hidden) || [];
    const o = modal('إظهار قسم البرامج', `<p class="muted">الـ Admin يرى القسم دائمًا. أزل العلامة لإخفاء القسم عن الفئة.</p>
      ${VIS_ROLES.map(([k, l]) => `<label style="display:block"><input type="checkbox" data-v="${k}" ${h.includes(k) ? '' : 'checked'}> ${l}</label>`).join('')}
      <div class="row"><button class="btn" data-v="save">حفظ</button></div>`);
    o.querySelector('button[data-v=save]').addEventListener('click', async (ev) => {
      const hidden = [...o.querySelectorAll('input[data-v]')].filter((x) => !x.checked).map((x) => x.dataset.v);
      try { await run(ev.target, rpc('prog_vis_set', { v: { hidden } }), 'حُفظ'); VIS = { hidden }; o.remove(); } catch (x) { /* toast */ }
    });
  }
  document.addEventListener('click', (ev) => { if (onTab(KEY) && ev.target.closest('main [data-ia="vis"]')) openVis(); });

  // ---------------------------------------------------------------- التركيب
  function install() {
    try { if (!VFILES.includes('./intensive.js')) VFILES.push('./intensive.js'); } catch (e) { /* ignore */ }
    if (CLOUD()) loadVis();
    // تبويب «مسابقة رمضان / الدورة المكثفة» فوق قائمة البرامج
    const wrap = (V) => {
      if (!V || !V[KEY] || V[KEY]._crs) return;
      const base = V[KEY];
      const f = function () {
        if (!CLOUD()) return base();
        if (S.kind === 'intensive') return intensiveView();
        const h = base();
        return typeof h === 'string' && h.includes('pg-grid') && !h.includes('data-pg="back"') ? kindBar() + h : h;
      };
      f._crs = true; V[KEY] = f;
    };
    try { ['admin', 'supervisor', 'teacher', 'placeadmin'].forEach((r) => wrap(VIEWS[r])); wrap(adminViews); wrap(supervisorViews); wrap(teacherViews); } catch (e) { /* ignore */ }
    // «دورتي» للطالب
    try {
      if (TABS.student && !TABS.student.some((t) => t[0] === MY)) {
        const i = TABS.student.findIndex((t) => t[0] === 'news');
        TABS.student.splice(i < 0 ? TABS.student.length : i, 0, [MY, 'دورتي']);
      }
      if (VIEWS.student) VIEWS.student[MY] = myView;
      if (typeof studentViews === 'object') studentViews[MY] = myView;
      if (typeof TAB_ICONS === 'object' && typeof svg === 'function') TAB_ICONS[MY] = svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
    } catch (e) { /* ignore */ }
    // الإخفاء حسب الفئة، وزر «إظهار القسم» للمدير
    try {
      const baseRender = render;
      render = function () {
        if (hiddenForMe() && (onTab(KEY) || onTab(MY))) { try { ui.tab = (TABS[role()] || [['dash']])[0][0]; } catch (e) { /* ignore */ } }
        const r = baseRender.apply(this, arguments);
        try {
          if (hiddenForMe()) document.querySelectorAll(`.side nav.tabs > button[data-v="${KEY}"], .side nav.tabs > button[data-v="${MY}"]`).forEach((x) => x.remove());
          else if (role() === 'admin' && onTab(KEY) && !S.root && !S.course && !document.querySelector('main [data-pg="back"]')) {
            const h = document.querySelector('main .card .row h2');
            if (h && !document.querySelector('main [data-ia="vis"]')) h.insertAdjacentHTML('afterend', '<button class="btn ghost" data-ia="vis">إظهار القسم</button>');
          }
        } catch (e) { /* ignore */ }
        return r;
      };
    } catch (e) { /* ignore */ }
    try { if (typeof session !== 'undefined' && session) render(); } catch (e) { /* ignore */ }
  }
  document.addEventListener('DOMContentLoaded', install);
})();
