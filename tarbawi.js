/* ============ البرامج — المرحلة الثالثة: البرامج التربوية ============
   تبويب «برامج تربوية» في قسم «البرامج»، وللطالب قسم «برامجي». الخادم: supabase/tarbawi.sql (دوال tar_*).
   البرنامج منهج (كتاب أو ورقة أو درس) بمدة واختبار ونتيجة، وقد يُقسَّم إلى حلقات مستقلة النتيجة والترتيب والجوائز. */
(function () {
  'use strict';
  const KEY = 'programs', MY = 'myprog';
  const CLOUD = () => !!(window.Cloud && window.Cloud.enabled);
  const rpc = (fn, args) => window.Cloud.rpc(fn, args || {});
  const role = () => (typeof session !== 'undefined' && session && session.role) || '';
  const onTab = (k) => typeof ui !== 'undefined' && ui && ui.tab === k;
  const rerender = () => { try { if (onTab(KEY) || onTab(MY)) render(); } catch (e) { /* ignore */ } };
  const errMsg = (e) => {
    let m = String((e && e.message) || e || '');
    try { const b = e && e.body && (typeof e.body === 'string' ? JSON.parse(e.body) : e.body); if (b && b.message) m = b.message; } catch (x) { /* ignore */ }
    if (/PGRST202|tar_|404/.test(m) && !/[؀-ۿ]/.test(m)) return 'يحتاج القسم إلى تنفيذ supabase/tarbawi.sql على الخادم.';
    return m.replace(/^.*?:\s*/, '') || 'تعذّر التنفيذ';
  };
  const run = async (btn, p, okMsg) => {
    try { const r = await (window.withBusy && btn ? withBusy(btn, p) : p); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(errMsg(e)); throw e; }
  };
  const num = (v) => (v === null || v === undefined || v === '' ? '' : String(+v));
  const today = () => new Date().toISOString().slice(0, 10);
  const halName = (hid) => { const h = hid && (db.halaqat || []).find((x) => x.id === hid); if (!h) return '—'; try { return halaqaLabel(h); } catch (e) { return h.name || '—'; } };
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
  const T = { on: false, list: null, p: null, units: [], entries: null, unit: null, tab: 'students', att: null, res: null, log: null, date: today(), err: '' };
  const unitId = () => T.unit || (T.units.length ? T.units[0].id : T.p.id);
  const unitName = () => { const u = T.units.find((x) => x.id === unitId()); return u ? u.name : T.p.name; };

  async function loadList() { T.err = ''; try { T.list = await rpc('tar_list'); } catch (e) { T.err = errMsg(e); T.list = []; } rerender(); }
  async function openP(id) { T.p = (T.list || []).find((x) => x.id === id) || { id }; T.entries = null; T.unit = null; T.tab = 'students'; rerender(); await reloadP(); }
  async function reloadP() {
    const pid = T.p.id;
    try {
      const [list, units, entries] = await Promise.all([rpc('tar_list'), rpc('tar_units', { pid }), rpc('tar_entries', { pid })]);
      T.list = list; T.p = list.find((x) => x.id === pid) || T.p; T.units = units || []; T.entries = entries || [];
      if (T.unit && !T.units.some((u) => u.id === T.unit)) T.unit = null;
      await loadTab();
    } catch (e) { T.err = errMsg(e); T.entries = T.entries || []; }
    rerender();
  }
  async function loadTab() {
    const pid = T.p.id, uid = unitId();
    if (T.tab === 'att') T.att = await rpc('tar_att', { pid, uid });
    if (T.tab === 'results') T.res = await rpc('tar_results', { pid, uid });
    if (T.tab === 'log') T.log = await rpc('prog_log_list', { pid, only_warn: false });
  }

  // ---------------------------------------------------------------- الواجهة
  const topBar = () => `<div class="card subnav"><div class="bar" style="margin:0"><button type="button" class="btn" data-tq="off">برامج قرآنية</button><button type="button" class="btn on">برامج تربوية</button></div></div>`;
  function tarView() {
    if (T.p) return programView();
    if (T.list === null) { setTimeout(loadList, 0); return topBar() + '<div class="card"><p class="muted">جارٍ التحميل…</p></div>'; }
    const canOpen = role() === 'admin' || role() === 'supervisor';
    const cards = T.list.map((p) => `<button class="card pg-card" data-ta="open" data-id="${p.id}"><b>${esc(p.name)}</b>
      <span class="muted">${esc((p.cfg || {}).book || '')}${p.owner ? ' · ' + esc(p.owner) : ''} · ${p.n_accepted} طالب${p.n_applied ? ` · ${p.n_applied} طلب جديد` : ''}${p.n_units ? ` · ${p.n_units} حلقات` : ''}</span></button>`).join('');
    return topBar() + `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">البرامج التربوية</h2>
      ${canOpen ? '<button class="btn" data-ta="new">+ فتح برنامج</button>' : ''}</div>${T.err ? `<p class="pg-err">${esc(T.err)}</p>` : ''}
      <div class="pg-grid">${cards || empty('لا توجد برامج تراها بعد.')}</div></div>`;
  }

  function programView() {
    const p = T.p, cfg = p.cfg || {};
    const tabs = [['students', 'الطلاب']].concat(cfg.attendance || +cfg.att_weight ? [['att', 'الحضور']] : []).concat([['results', 'الاختبار والنتيجة'], ['log', 'السجل']]);
    const unitSel = T.units.length && T.tab !== 'students' && T.tab !== 'log' ? `<label>الحلقة <select data-tf="unit" data-nosearch>${T.units.map((u) => `<option value="${u.id}" ${unitId() === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>` : '';
    const head = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <div><button class="btn ghost" data-ta="back">→ البرامج</button> <h2 style="display:inline;margin:0 .5rem">${esc(p.name || '')}</h2><span class="muted">${esc(cfg.book || '')}</span></div>
      <div class="row" style="gap:.4rem"><button class="btn ghost" data-ta="settings">الإعدادات والحلقات</button><button class="btn ghost" data-ta="reload">تحديث</button></div></div>
      ${T.err ? `<p class="pg-err">${esc(T.err)}</p>` : ''}</div>` + bar(tabs, T.tab, 'data-tt') + (unitSel ? `<div class="card">${unitSel}</div>` : '');
    if (T.entries === null) return head + '<div class="card"><p class="muted">جارٍ التحميل…</p></div>';
    const body = { students: studentsView, att: attView, results: resultsView, log: logView }[T.tab] || studentsView;
    return head + body();
  }

  function studentsView() {
    const E = T.entries || [];
    const ap = E.filter((e) => e.status === 'applied'), ac = E.filter((e) => e.status === 'accepted'), rj = E.filter((e) => e.status === 'rejected');
    const row = (e, acts) => `<tr><td>${esc(e.name)}${e.ext ? ' <span class="pg-tag">خارجي</span>' : ''}</td><td>${esc(halName(e.halaqa_id))}</td><td class="pg-acts">${acts}</td></tr>`;
    const tbl = (title, rows) => `<div class="card"><h3>${title}</h3></div><div class="card tbl"><table><thead><tr><th>الاسم</th><th>الحلقة</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="3">${empty('لا أحد.')}</td></tr>`}</tbody></table></div>`;
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <button class="btn" data-ta="add">+ إضافة طلاب</button><button class="btn ghost" data-ta="ext">+ طالب خارجي</button>
      <span class="muted">${(T.p.cfg || {}).apply_open === false ? 'التقدم من حسابات الطلاب مغلق' : 'الطلاب يتقدمون من حساباتهم («برامجي»)'}</span></div></div>`
      + (ap.length ? tbl(`طلبات جديدة (${ap.length})`, ap.map((e) => row(e, `<button class="btn sm" data-td="accepted" data-id="${e.id}">قبول</button> <button class="btn sm ghost" data-td="rejected" data-id="${e.id}">رفض</button>`)).join('')) : '')
      + tbl(`المقبولون (${ac.length})`, ac.map((e) => row(e, `<button class="btn sm ghost" data-td="rejected" data-id="${e.id}">إخراج</button>`)).join(''))
      + (rj.length ? tbl(`مرفوضون (${rj.length})`, rj.map((e) => row(e, `<button class="btn sm ghost" data-td="accepted" data-id="${e.id}">قبول</button>`)).join('')) : '');
  }

  function attView() {
    const A = T.att || [], E = (T.entries || []).filter((e) => e.status === 'accepted');
    const dates = [...new Set(A.map((a) => a.dt))].sort();
    const on = {}; A.forEach((a) => { on[a.entry_id + ':' + a.dt] = a.present; });
    const cur = (id) => on[id + ':' + T.date];
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <label>اليوم <input type="date" data-tf="date" value="${T.date}"></label><button class="btn" data-ta="saveatt">حفظ الحضور</button><span class="muted">${esc(unitName())}</span></div></div>
      <div class="card tbl"><table><thead><tr><th>الطالب</th><th>حاضر (${T.date})</th>${dates.map((d) => `<th>${d.slice(5)}</th>`).join('')}<th>النسبة</th></tr></thead><tbody>
      ${E.map((e) => { const pres = dates.filter((d) => on[e.id + ':' + d]).length; return `<tr data-eid="${e.id}"><td>${esc(e.name)}</td><td><input type="checkbox" data-a="p" ${cur(e.id) === false ? '' : 'checked'}></td>
        ${dates.map((d) => `<td>${on[e.id + ':' + d] === undefined ? '' : on[e.id + ':' + d] ? '✓' : '✗'}</td>`).join('')}<td>${dates.length ? Math.round(pres / dates.length * 100) + '%' : ''}</td></tr>`; }).join('') || `<tr><td colspan="3">${empty('لا يوجد طلاب مقبولون.')}</td></tr>`}
      </tbody></table></div>`;
  }

  function resultsView() {
    const R = (T.res || []).slice().sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.total - a.total);
    const cfg = Object.assign({}, T.p.cfg || {}, ((T.units.find((u) => u.id === unitId()) || {}).cfg) || {});
    const approved = !!cfg.approved;
    return `<div class="card"><div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
      <button class="btn" data-ta="savescores">حفظ الدرجات</button><button class="btn" data-ta="approve">اعتماد النتيجة والترتيب</button><button class="btn ghost" data-ta="saveprizes">حفظ الترتيب والجوائز</button>
      <span class="muted">${esc(unitName())} · الاختبار من ${num(cfg.test_max) || 100}${+cfg.att_weight ? ` + الحضور ${num(cfg.att_weight)}` : ''}${cfg.pass ? ` · النجاح ${num(cfg.pass)}%` : ''} · ${approved ? 'اعتُمدت' : 'لم تُعتمد بعد'}</span></div></div>
      <div class="card tbl"><table data-print="نتيجة ${esc(T.p.name)} — ${esc(unitName())}"><thead><tr><th>الترتيب</th><th>الطالب</th><th>الدرجة</th><th>غائب</th>${+cfg.att_weight ? '<th>الحضور</th>' : ''}<th>الإجمالي</th>${cfg.pass ? '<th>النتيجة</th>' : ''}<th>الجائزة</th></tr></thead><tbody>
      ${R.map((r) => `<tr data-eid="${r.entry_id}"><td><input type="number" min="1" data-r="rank" value="${r.rank || ''}" style="width:3.6rem">${r.rank_manual ? ' <small>يدوي</small>' : ''}</td><td>${esc(r.name)}</td>
        <td><input type="number" min="0" step="0.25" data-r="score" value="${num(r.score)}" style="width:5rem"></td><td><input type="checkbox" data-r="absent" ${r.absent ? 'checked' : ''}></td>
        ${+cfg.att_weight ? `<td>${r.att_pct === null ? '' : num(r.att_pct) + '% → ' + num(r.att_pts)}</td>` : ''}<td><b>${num(r.total)}</b></td>
        ${cfg.pass ? `<td>${r.passed === null ? '' : r.passed ? 'ناجح' : 'لم ينجح'}</td>` : ''}<td><input type="number" min="0" step="5" data-r="prize" value="${num(r.prize)}" style="width:5.5rem"></td></tr>`).join('') || `<tr><td colspan="8">${empty('لا يوجد طلاب مقبولون.')}</td></tr>`}
      </tbody></table></div>`;
  }

  function logView() {
    const L = T.log || [];
    return `<div class="card tbl"><table><thead><tr><th>الوقت</th><th>بواسطة</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>
      ${L.map((l) => `<tr><td>${new Date(l.at).toLocaleString('ar-EG')}</td><td>${esc(l.by_name || '')}</td><td>${esc(l.action)}</td><td><small>${esc(JSON.stringify(l.detail))}</small></td></tr>`).join('') || `<tr><td colspan="4">${empty('لا شيء بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- النوافذ
  function openNew() {
    openForm('فتح برنامج تربوي', [{ name: 'name', label: 'اسم البرنامج', value: '' }], (v) => {
      if (!v.name) return 'اكتب اسم البرنامج';
      rpc('tar_open', { nm: v.name }).then(async (id) => { await loadList(); openP(id); }).catch((e) => toast(errMsg(e)));
      return '';
    });
  }

  function openSettings() {
    const p = T.p, c = p.cfg || {};
    const f = (k, l, v, t) => `<label>${l}<input data-k="${k}" ${t ? `type="${t}"` : ''} value="${esc(v == null ? '' : String(v))}"></label>`;
    const units = T.units.map((u) => `<tr data-uid="${u.id}"><td><input data-u="name" value="${esc(u.name)}"></td><td><input type="date" data-u="start" value="${esc((u.cfg || {}).start || '')}"></td>
      <td><input type="date" data-u="end" value="${esc((u.cfg || {}).end || '')}"></td><td><input type="date" data-u="test_date" value="${esc((u.cfg || {}).test_date || '')}"></td>
      <td><input data-u="schedule" value="${esc((u.cfg || {}).schedule || '')}" placeholder="مثل: السبت بعد العصر"></td>
      <td><button class="btn sm" data-u="save">حفظ</button> <button class="btn sm ghost" data-u="del">حذف</button></td></tr>`).join('');
    const o = modal('الإعدادات والحلقات', `
      <p class="muted">لا يلزم ملء كل الإعدادات مرة واحدة، ويمكن تعديلها في أي وقت.</p>
      <details open><summary><b>البرنامج</b></summary>${f('name', 'الاسم', p.name)}${f('book', 'المنهج (كتاب أو ورقة أو درس)', c.book)}
        <label>وصف أو مرجع<textarea data-k="desc" rows="2">${esc(c.desc || '')}</textarea></label>${f('audience', 'الفئة المستهدفة', c.audience)}
        ${T.units.length ? '' : f('start', 'البداية', c.start, 'date') + f('end', 'النهاية', c.end, 'date') + f('test_date', 'موعد الاختبار', c.test_date, 'date') + f('schedule', 'المواعيد', c.schedule)}
        <label style="display:flex;align-items:center;gap:.4rem"><input style="width:auto;margin:0" type="checkbox" data-k="apply_open" ${c.apply_open === false ? '' : 'checked'}> يتقدم الطلاب من حساباتهم</label>
        <label style="display:flex;align-items:center;gap:.4rem"><input style="width:auto;margin:0" type="checkbox" data-k="attendance" ${c.attendance ? 'checked' : ''}> برنامج بحضور (يُرصد الحضور)</label></details>
      <details open><summary><b>النتيجة</b></summary>${f('test_max', 'درجة الاختبار العظمى', c.test_max || 100, 'number')}${f('att_weight', 'درجة الحضور (0 = لا يدخل)', c.att_weight || 0, 'number')}${f('pass', 'نسبة النجاح % (اختياري)', c.pass, 'number')}</details>
      <div class="row"><button class="btn" data-k="save">حفظ الإعدادات</button></div>
      <hr><h3>حلقات البرنامج</h3><p class="muted">اختيارية. لكل حلقة مدتها واختبارها ونتيجتها وترتيبها وجوائزها، ولا يُشترط النجاح في حلقة لدخول التالية.</p>
      <div class="tbl"><table><thead><tr><th>الاسم</th><th>البداية</th><th>النهاية</th><th>الاختبار</th><th>المواعيد</th><th></th></tr></thead><tbody>${units}
      <tr data-uid=""><td><input data-u="name" placeholder="مثل: الحلقة ${T.units.length + 1}"></td><td><input type="date" data-u="start"></td><td><input type="date" data-u="end"></td><td><input type="date" data-u="test_date"></td><td><input data-u="schedule"></td><td><button class="btn sm" data-u="save">إضافة</button></td></tr>
      </tbody></table></div>`, true);
    const g = (k) => o.querySelector(`[data-k=${k}]`);
    const val = (k) => (g(k) ? g(k).value.trim() : undefined);
    o.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-k], button[data-u]'); if (!b) return;
      if (b.dataset.k === 'save') {
        const n = (k) => (val(k) === '' || val(k) === undefined ? null : +val(k));
        const cf = { book: val('book'), desc: val('desc'), audience: val('audience'), apply_open: g('apply_open').checked, attendance: g('attendance').checked, test_max: n('test_max'), att_weight: n('att_weight') || 0, pass: n('pass') };
        if (!T.units.length) Object.assign(cf, { start: val('start') || null, end: val('end') || null, test_date: val('test_date') || null, schedule: val('schedule') });
        try { await run(b, rpc('prog_save', { pid: p.id, knd: 'tarbawi', nm: val('name'), yr: null, cf }), 'حُفظت الإعدادات'); o.remove(); reloadP(); } catch (x) { /* toast */ }
        return;
      }
      const tr = b.closest('tr'), uid = tr.dataset.uid || null, u = (k) => tr.querySelector(`[data-u=${k}]`).value.trim();
      try {
        if (b.dataset.u === 'del') await run(b, rpc('tar_unit_del', { uid }), 'حُذفت');
        else { if (!u('name')) return toast('اكتب اسم الحلقة'); await run(b, rpc('tar_unit_save', { uid, pid: p.id, nm: u('name'), cf: { start: u('start') || null, end: u('end') || null, test_date: u('test_date') || null, schedule: u('schedule') } }), 'حُفظت'); }
        o.remove(); await reloadP(); openSettings();
      } catch (x) { /* toast */ }
    });
  }

  function openAdd() {
    const taken = new Set((T.entries || []).map((e) => e.student_id));
    const pool = (db.students || []).filter((s) => !taken.has(s.id) && !(s.info && s.info.status === 'منقطع'));
    const o = modal('إضافة طلاب', `<input data-n="q" placeholder="بحث بالاسم" style="max-width:14rem">
      <div class="tbl" style="max-height:55vh;overflow:auto"><table><thead><tr><th></th><th>الاسم</th><th>الحلقة</th></tr></thead><tbody>
      ${pool.slice(0, 3000).map((s) => `<tr data-sid="${s.id}"><td><input type="checkbox" value="${s.id}"></td><td>${esc(s.name)}</td><td>${esc(halName(s.halaqaId))}</td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn" data-n="go">إضافة المحددين</button></div>`, true);
    o.querySelector('[data-n=q]').addEventListener('input', (ev) => { const q = ev.target.value.trim(); o.querySelectorAll('tr[data-sid]').forEach((tr) => { tr.hidden = q && !tr.children[1].textContent.includes(q); }); });
    o.querySelector('[data-n=go]').addEventListener('click', async () => {
      const ids = [...o.querySelectorAll('tr[data-sid] input:checked')].map((x) => x.value);
      if (!ids.length) return toast('حدد طالبًا على الأقل');
      let ok = 0; for (const sid of ids) { try { await rpc('tar_add', { pid: T.p.id, sid, ex: null }); ok++; } catch (e) { toast(errMsg(e)); } }
      toast(`أُضيف ${ok}`); o.remove(); reloadP();
    });
  }

  function openExt() {
    const o = modal('إضافة طالب خارجي', `<label>الاسم<input data-x="name"></label><label>الجوال<input data-x="phone" type="tel"></label>
      <label>ولي الأمر<input data-x="guardian"></label><label>السن<input data-x="age"></label><div class="row"><button class="btn" data-x="save">إضافة</button></div>`);
    o.querySelector('[data-x=save]').addEventListener('click', async (ev) => {
      const g = (k) => o.querySelector(`[data-x=${k}]`).value.trim();
      try { await run(ev.target, rpc('tar_add', { pid: T.p.id, sid: null, ex: { name: g('name'), phone: g('phone'), guardian: g('guardian'), age: g('age') } }), 'أُضيف'); o.remove(); reloadP(); } catch (x) { /* toast */ }
    });
  }

  // ---------------------------------------------------------------- «برامجي» للطالب
  let MYD = null, OPEN = null;
  function myView() {
    if (!CLOUD()) return `<div class="card">${empty('يعمل مع الخادم فقط.')}</div>`;
    if (MYD === null) { setTimeout(async () => { try { [MYD, OPEN] = await Promise.all([rpc('tar_my'), rpc('tar_open_list')]); } catch (e) { MYD = []; OPEN = []; } rerender(); }, 0); return '<div class="card"><p class="muted">جارٍ التحميل…</p></div>'; }
    const mine = MYD.map((m) => {
      const c = m.cfg || {};
      const units = (m.units || []).map((u) => { const uc = u.cfg || {}; return `<tr><td>${esc(u.name)}</td><td>${esc([uc.start || c.start, uc.end || c.end].filter(Boolean).join(' – '))}</td><td>${esc(uc.schedule || c.schedule || '')}</td><td>${esc(uc.test_date || c.test_date || '')}</td>
        ${c.attendance ? `<td>${u.days ? `${u.present}/${u.days}` : ''}</td>` : ''}<td>${u.absent ? 'غائب' : num(u.score)}</td><td>${u.rank || ''}</td></tr>`; }).join('');
      return `<div class="card"><h2>${esc(m.program)}</h2><p class="muted">${esc(c.book || '')}${m.status === 'applied' ? ' · طلبك قيد المراجعة' : ''}</p>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}</div>
        ${m.status === 'accepted' ? `<div class="card tbl"><table><thead><tr><th>الحلقة</th><th>المدة</th><th>المواعيد</th><th>الاختبار</th>${c.attendance ? '<th>الحضور</th>' : ''}<th>الدرجة</th><th>الترتيب</th></tr></thead><tbody>${units}</tbody></table></div>` : ''}`;
    }).join('');
    const avail = (OPEN || []).filter((p) => !p.my_status).map((p) => `<div class="card"><b>${esc(p.name)}</b> <span class="muted">${esc((p.cfg || {}).book || '')}${(p.cfg || {}).audience ? ' · ' + esc(p.cfg.audience) : ''}</span>
      ${(p.cfg || {}).desc ? `<p>${esc(p.cfg.desc)}</p>` : ''}<button class="btn" data-tm="apply" data-id="${p.id}">أرغب في الالتحاق</button></div>`).join('');
    return `<div class="card"><h2>برامجي</h2></div>${mine || `<div class="card">${empty('لست في برنامج تربوي حاليًا.')}</div>`}${avail ? '<div class="card"><h3>برامج متاحة للتقدم</h3></div>' + avail : ''}`;
  }

  // ---------------------------------------------------------------- الأحداث
  document.addEventListener('click', async (ev) => {
    if (onTab(MY)) {
      const b = ev.target.closest('main [data-tm]'); if (!b) return;
      try { await run(b, rpc('tar_apply', { pid: b.dataset.id }), 'أُرسل طلبك'); MYD = null; render(); } catch (x) { /* toast */ }
      return;
    }
    if (!onTab(KEY)) return;
    const q = ev.target.closest('main [data-tq]');
    if (q) { T.on = q.dataset.tq === 'on'; return render(); }
    if (!T.on) return;
    const t = ev.target.closest('main [data-tt]');
    if (t) { T.tab = t.dataset.tt; try { await loadTab(); } catch (e) { toast(errMsg(e)); } return render(); }
    const d = ev.target.closest('main [data-td]');
    if (d) { try { await run(d, rpc('tar_decide', { eid: d.dataset.id, st: d.dataset.td }), 'تم'); reloadP(); } catch (x) { /* toast */ } return; }
    const b = ev.target.closest('main [data-ta]'); if (!b) return;
    const a = b.dataset.ta, pid = T.p && T.p.id;
    if (a === 'new') return openNew();
    if (a === 'open') return openP(b.dataset.id);
    if (a === 'back') { T.p = null; T.list = null; return render(); }
    if (a === 'reload') { T.err = ''; return reloadP(); }
    if (a === 'settings') return openSettings();
    if (a === 'add') return openAdd();
    if (a === 'ext') return openExt();
    const rows = () => [...document.querySelectorAll('main tr[data-eid]')];
    if (a === 'saveatt') {
      const r = rows().map((tr) => ({ entry: tr.dataset.eid, present: tr.querySelector('[data-a=p]').checked }));
      try { const n = await run(b, rpc('tar_att_save', { pid, uid: unitId(), d: T.date, rows: r })); toast(`حُفظ ${n}`); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'savescores') {
      const items = rows().map((tr) => ({ entry: tr.dataset.eid, score: tr.querySelector('[data-r=score]').value, absent: tr.querySelector('[data-r=absent]').checked }));
      try { await run(b, rpc('tar_score_save', { pid, uid: unitId(), items }), 'حُفظت الدرجات'); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'saveprizes') {
      const items = rows().map((tr) => ({ entry: tr.dataset.eid, rank: tr.querySelector('[data-r=rank]').value, prize: tr.querySelector('[data-r=prize]').value }));
      try { await run(b, rpc('tar_rank_prize', { pid, uid: unitId(), items }), 'حُفظ'); await loadTab(); render(); } catch (x) { /* toast */ }
      return;
    }
    if (a === 'approve') return ask(`اعتماد نتيجة «${unitName()}»؟ يُرتَّب الطلاب بالإجمالي (يبقى الترتيب اليدوي)، ويرى الطلاب ترتيبهم.`, async () => { try { await run(b, rpc('tar_approve', { pid, uid: unitId() }), 'اعتُمدت'); await reloadP(); } catch (x) { /* toast */ } });
  });
  document.addEventListener('change', async (ev) => {
    if (!onTab(KEY) || !T.on) return;
    const f = ev.target.closest('main [data-tf]'); if (!f) return;
    if (f.dataset.tf === 'unit') T.unit = f.value;
    if (f.dataset.tf === 'date') T.date = f.value || today();
    try { await loadTab(); } catch (e) { toast(errMsg(e)); }
    render();
  });

  // ---------------------------------------------------------------- التركيب
  let hideStudent = false;
  function install() {
    try { if (!VFILES.includes('./tarbawi.js')) VFILES.push('./tarbawi.js'); } catch (e) { /* ignore */ }
    const wrap = (V) => {
      if (!V || !V[KEY] || V[KEY]._tar) return;
      const base = V[KEY];
      const f = function () {
        if (!CLOUD()) return base();
        if (T.on) return tarView();
        const h = base();
        return typeof h === 'string' ? h.replace('<button type="button" class="btn" disabled title="قريبًا">برامج تربوية</button>', '<button type="button" class="btn" data-tq="on">برامج تربوية</button>') : h;
      };
      f._tar = true; V[KEY] = f;
    };
    try { ['admin', 'supervisor', 'teacher', 'placeadmin'].forEach((r) => wrap(VIEWS[r])); wrap(adminViews); wrap(supervisorViews); wrap(teacherViews); } catch (e) { /* ignore */ }
    try {
      if (TABS.student && !TABS.student.some((t) => t[0] === MY)) {
        const i = TABS.student.findIndex((t) => t[0] === 'news');
        TABS.student.splice(i < 0 ? TABS.student.length : i, 0, [MY, 'برامجي']);
      }
      if (VIEWS.student) VIEWS.student[MY] = myView;
      if (typeof studentViews === 'object') studentViews[MY] = myView;
      if (typeof TAB_ICONS === 'object' && typeof svg === 'function') TAB_ICONS[MY] = svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');
    } catch (e) { /* ignore */ }
    // إخفاء «برامجي» إن أخفى المدير قسم البرامج عن الطلاب (إعداد «إظهار القسم»)
    if (CLOUD() && role() === 'student') rpc('prog_vis_get').then((v) => { hideStudent = !!(v && (v.hidden || []).includes('student')); try { render(); } catch (e) { /* ignore */ } }).catch(() => {});
    try {
      const baseRender = render;
      render = function () {
        if (hideStudent && onTab(MY)) { try { ui.tab = (TABS.student || [['me']])[0][0]; } catch (e) { /* ignore */ } }
        const r = baseRender.apply(this, arguments);
        if (hideStudent) document.querySelectorAll(`.side nav.tabs > button[data-v="${MY}"]`).forEach((x) => x.remove());
        return r;
      };
    } catch (e) { /* ignore */ }
    try { if (typeof session !== 'undefined' && session) render(); } catch (e) { /* ignore */ }
  }
  document.addEventListener('DOMContentLoaded', install);
})();
