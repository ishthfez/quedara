/* ============ قسم «البرامج» — المرحلة الأولى: مسابقة رمضان ============
   البيانات على الخادم وحده (supabase/programs.sql)، تُجلب عند فتح القسم بدوال prog_*، ولا تمر بالمزامنة.
   الصلاحيات الحقيقية على الخادم؛ الواجهة تعرض ما تعيده الدوال لكل مستخدم.
   يظهر القسم للمدير والمدير العام والمشرف والمعلم والإداري، تحت «التعليم». */
(function () {
  'use strict';
  const KEY = 'programs';
  const CLOUD = () => !!(window.Cloud && window.Cloud.enabled);

  const LV = { m1: 'م1 / القرآن كاملًا', m2: 'م2 / (20) جزء', m3: 'م3 / (15) جزء', m4: 'م4 / (10) أجزاء', m5: 'م5 / ربع القرآن', m6: 'م6 / (5) أجزاء', m7: 'م7 / (3) أجزاء', m8: 'م8 / أقل من 3 أجزاء' };
  const LVS = (l) => (LV[l] || '').split(' / ')[0] || '—';
  const STAGE = { tasfiya: 'التصفية', general: 'العامة', halaqat: 'الحلقات', done: 'انتهى' };
  const RESULT = { winner: 'فائز', honor: 'مكرَّم', below: 'لم يبلغ الحد', out: 'خرج' };
  const TAG = { warn: 'تنبيه مستوى', outside: 'خارج المستويين', exempt: 'معفى من التصفية', from_tasfiya: 'من التصفية', absent_general: 'غاب عن العام', carried: 'درجته منقولة' };
  const NOTES_DEF = ['قلقلة', 'مدود', 'غنة', 'لثوية', 'إخفاء', 'المخارج', 'الوقف', 'ضبط النفَس', 'التأني', 'تردد', 'تشكيل'];
  const SUR = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];
  // صفحة بداية كل سورة في مصحف المدينة (604 صفحات) — لحساب حجم مقدار م8 والمقارنة بالأعوام
  const PG = [1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604];
  const pagesOf = (a, b) => {
    a = +a; b = +b; if (!a || !b) return 0;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const end = hi >= 114 ? 604 : Math.max(PG[hi] - 1, PG[hi - 1]);
    return end - PG[lo - 1] + 1;
  };
  const amountTxt = (am) => am && am.from ? `${SUR[am.from - 1] || ''} – ${SUR[am.to - 1] || ''} (${am.pages || pagesOf(am.from, am.to)} ص)` : '';

  // ---------------------------------------------------------------- الحالة
  const S = { list: null, loadingList: false, cur: null, entries: null, staff: [], cands: null, log: null, tab: 'entries', f: { q: '', stage: '', level: '', track: '' }, err: '' };

  const role = () => (typeof session !== 'undefined' && session && session.role) || '';
  const isAdminLike = () => role() === 'admin' || (role() === 'supervisor' && !!(window.isGenSup && typeof me === 'function' && window.isGenSup(me())));
  const errMsg = (e) => {
    let m = String((e && e.message) || e || '');
    try { const b = e && e.body && (typeof e.body === 'string' ? JSON.parse(e.body) : e.body); if (b && b.message) m = b.message; } catch (x) { /* ignore */ }
    if (/PGRST202|prog_|404/.test(m) && !/[؀-ۿ]/.test(m)) return 'يحتاج القسم إلى تنفيذ supabase/programs.sql على الخادم.';
    return m.replace(/^.*?:\s*/, '') || 'تعذّر التنفيذ';
  };
  const rpc = (fn, args) => window.Cloud.rpc(fn, args || {});
  const run = async (btn, p, okMsg) => {
    try { const r = await (window.withBusy && btn ? withBusy(btn, p) : p); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(errMsg(e)); throw e; }
  };
  const halName = (hid) => {
    const h = hid && (db.halaqat || []).find((x) => x.id === hid);
    if (!h) return '—';
    try { return typeof halaqaLabel === 'function' ? halaqaLabel(h) : (h.name || '—'); } catch (e) { return h.name || '—'; }
  };
  const placeName = (pid) => ((db.places || []).find((x) => x.id === pid) || {}).name || '';
  const num = (v) => (v === null || v === undefined || v === '' ? '' : String(+v));
  const scoreTxt = (sc) => !sc ? '' : sc.absent ? 'غائب' : num(sc.v) + (sc.carried ? ' (منقولة)' : '');

  // ---------------------------------------------------------------- التحميل
  async function loadList() {
    if (S.loadingList) return; S.loadingList = true; S.err = '';
    try { S.list = await rpc('prog_list', { knd: 'ramadan' }); } catch (e) { S.err = errMsg(e); S.list = []; }
    S.loadingList = false; rerender();
  }
  async function openProgram(id) {
    S.cur = (S.list || []).find((p) => p.id === id) || { id }; S.entries = null; S.cands = null; S.log = null; S.tab = 'entries'; rerender();
    await reloadCur();
  }
  async function reloadCur() {
    if (!S.cur) return;
    try {
      const [list, entries, staff] = await Promise.all([rpc('prog_list', { knd: 'ramadan' }), rpc('prog_entries', { pid: S.cur.id }), rpc('prog_staff_list', { pid: S.cur.id })]);
      S.list = list; S.cur = list.find((p) => p.id === S.cur.id) || S.cur; S.entries = entries; S.staff = staff;
      if (S.tab === 'log') S.log = await rpc('prog_log_list', { pid: S.cur.id, only_warn: !!S.logWarn });
    } catch (e) { S.err = errMsg(e); S.entries = S.entries || []; }
    rerender();
  }
  const rerender = () => { try { if (typeof ui !== 'undefined' && ui && ui.tab === KEY) render(); } catch (e) { /* ignore */ } };

  // ---------------------------------------------------------------- الواجهة
  function view() {
    if (!CLOUD()) return `<div class="card"><h2>البرامج</h2>${empty('قسم البرامج يعمل مع الخادم فقط.')}</div>`;
    if (!S.cur) {
      if (S.list === null) { setTimeout(loadList, 0); return `<div class="card"><h2>البرامج</h2><p class="muted">جارٍ التحميل…</p></div>`; }
      return listView();
    }
    return programView();
  }

  function listView() {
    const add = isAdminLike() ? `<button class="btn" data-pg="new">+ نسخة جديدة</button>` : '';
    const cards = (S.list || []).filter((p) => !p.parent_id).map((p) => `
      <button class="card pg-card" data-pg="open" data-id="${p.id}">
        <b>${esc(p.name)}</b>
        <span class="muted">${p.year || ''} · ${p.status === 'closed' ? 'مغلقة' : 'مفتوحة'} · ${p.n_entries} متسابق</span>
      </button>`).join('');
    return `<div class="card subnav"><button class="on" data-pg="noop">برامج قرآنية</button><button disabled title="قريبًا">برامج تربوية</button></div>
      <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">مسابقة رمضان</h2>${add}</div>
      ${S.err ? `<p class="pg-err">${esc(S.err)}</p>` : ''}
      <div class="pg-grid">${cards || empty('لا توجد نسخ بعد.')}</div>
      <p class="muted" style="margin-top:.8rem">الدورة المكثفة والبرامج التربوية تُضاف في المرحلتين التاليتين.</p></div>`;
  }

  function programView() {
    const p = S.cur, org = !!p.is_org;
    const tabs = [['entries', 'المتسابقون'], ['pending', 'القرارات'], ['results', 'النتائج'], ['summary', 'الخلاصة']].concat(org ? [['log', 'السجل']] : []);
    const pend = (S.entries || []).filter((e) => e.status === 'pending').length;
    const head = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
        <div><button class="btn ghost" data-pg="back">→ النسخ</button> <h2 style="display:inline;margin:0 .5rem">${esc(p.name || '')}</h2>
        <span class="muted">${p.year || ''}${p.status === 'closed' ? ' · مغلقة' : ''}</span></div>
        <div class="row" style="gap:.4rem">${org ? `<button class="btn ghost" data-pg="settings">الإعدادات</button>` : ''}
        <button class="btn ghost" data-pg="reload">تحديث</button></div></div>
        ${S.err ? `<p class="pg-err">${esc(S.err)}</p>` : ''}</div>
      <div class="card subnav">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-pg="tab" data-t="${k}">${l}${k === 'pending' && pend ? ` (${pend})` : ''}</button>`).join('')}</div>`;
    if (S.entries === null) return head + `<div class="card"><p class="muted">جارٍ التحميل…</p></div>`;
    const body = { entries: entriesView, pending: pendingView, results: resultsView, summary: summaryView, log: logView }[S.tab] || entriesView;
    return head + body();
  }

  const tagsHtml = (e) => (e.tags || []).filter((t) => TAG[t]).map((t) => `<span class="pg-tag ${t === 'warn' || t === 'outside' ? 'w' : ''}">${TAG[t]}</span>`).join('')
    + (e.ext ? '<span class="pg-tag">خارجي</span>' : '') + (e.status === 'pending' ? '<span class="pg-tag w">بانتظار القرار</span>' : '') + (e.status === 'rejected' ? '<span class="pg-tag">مرفوض</span>' : '');
  const prevTxt = (e) => {
    const pv = e.data && e.data.prev; if (!pv) return '';
    const best = `${LVS(pv.level)} (${pv.year})`;
    return pv.last_year && pv.last_year !== pv.year ? `${best} · ${LVS(pv.last_level)} (${pv.last_year})` : best;
  };

  function entriesView() {
    const p = S.cur, org = !!p.is_org, f = S.f;
    const can = role() === 'admin' || role() === 'supervisor' || role() === 'teacher';
    const rows = (S.entries || []).filter((e) => (!f.stage || e.stage === f.stage) && (!f.level || e.level === f.level) && (!f.track || e.track === f.track)
      && (!f.q || (e.name || '').includes(f.q)) && e.status !== 'rejected');
    const opt = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
    const tr = rows.map((e) => {
      const acts = [];
      if (e.can_score && e.stage !== 'done') acts.push(`<button class="btn sm" data-pg="score" data-id="${e.id}">رصد</button>`);
      if (e.can_decide && e.stage === 'tasfiya' && e.status === 'active') acts.push(`<button class="btn sm ghost" data-pg="exempt" data-id="${e.id}">${(e.tags || []).includes('exempt') ? 'إلغاء الإعفاء' : 'إعفاء'}</button>`);
      if (e.can_decide && e.status === 'pending') acts.push(`<button class="btn sm" data-pg="decide" data-id="${e.id}">قرار</button>`);
      if (org) acts.push(`<button class="btn sm ghost" data-pg="edit" data-id="${e.id}">تعديل</button>`);
      const sc = e.scores || {};
      return `<tr><td>${esc(e.name || '')}</td><td>${esc(halName(e.halaqa_id))}</td><td>${esc(placeName(e.place_id))}</td>
        <td title="${esc(LV[e.level] || '')}">${LVS(e.level)}${e.level === 'm8' ? `<br><small>${esc(amountTxt(e.amount))}</small>` : ''}</td>
        <td>${e.track === 'general' ? 'العام' : 'الحلقات'} · ${STAGE[e.stage] || ''}</td>
        <td>${scoreTxt(sc.tasfiya)}</td><td>${scoreTxt(sc.general)}</td><td>${scoreTxt(sc.halaqat)}</td>
        <td>${e.result ? RESULT[e.result] : ''}${e.rank ? ` · ${e.rank}` : ''}</td>
        <td>${tagsHtml(e)}${prevTxt(e) ? `<br><small class="muted">⚠ ${esc(prevTxt(e))}</small>` : ''}</td>
        <td class="pg-acts">${acts.join(' ')}</td></tr>`;
    }).join('');
    const open = p.status !== 'closed';
    return `<div class="card">
      <div class="row" style="gap:.4rem;flex-wrap:wrap;align-items:center">
        ${open && can ? `<button class="btn" data-pg="cands">تسجيل متسابقين</button>` : ''}
        ${open && org ? `<button class="btn ghost" data-pg="ext">+ طالب خارجي</button>` : ''}
        <input data-pgf="q" placeholder="بحث بالاسم" value="${esc(f.q)}" style="max-width:12rem">
        <select data-pgf="track" data-nosearch><option value="">كل المسارات</option>${opt({ general: 'العام', halaqat: 'الحلقات' }, f.track)}</select>
        <select data-pgf="stage" data-nosearch><option value="">كل المراحل</option>${opt(STAGE, f.stage)}</select>
        <select data-pgf="level" data-nosearch><option value="">كل المستويات</option>${opt(LV, f.level)}</select>
        <span class="muted">${rows.length} متسابق</span>
      </div></div>
      <div class="card tbl"><table><thead><tr><th>الاسم</th><th>الحلقة</th><th>المكان</th><th>المستوى</th><th>المسار</th><th>التصفية</th><th>العامة</th><th>الحلقات</th><th>النتيجة</th><th>ملاحظات</th><th></th></tr></thead>
      <tbody>${tr || `<tr><td colspan="11">${empty('لا يوجد متسابقون بهذه التصفية.')}</td></tr>`}</tbody></table></div>`;
  }

  function pendingView() {
    const rows = (S.entries || []).filter((e) => e.status === 'pending');
    const tr = rows.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(halName(e.halaqa_id))}</td><td>${LVS(e.level)}</td>
      <td>${(e.data && e.data.juz) || 0}</td><td>${tagsHtml(e)}</td><td>${esc(prevTxt(e))}</td>
      <td>${e.can_decide ? `<button class="btn sm" data-pg="decide" data-id="${e.id}">قرار</button>` : '<span class="muted">للمشرف</span>'}</td></tr>`).join('');
    return `<div class="card"><h3>تسجيلات تحتاج قرارًا</h3>
      <p class="muted">مستوى خارج المستويين المباشرين، أو مماثل لأعلى مستوى سابق أو أقل، في المسار العام.</p></div>
      <div class="card tbl"><table><thead><tr><th>الاسم</th><th>الحلقة</th><th>المستوى المقترح</th><th>أجزاء الإتقان</th><th>السبب</th><th>المستوى السابق</th><th></th></tr></thead>
      <tbody>${tr || `<tr><td colspan="7">${empty('لا توجد تسجيلات بانتظار القرار.')}</td></tr>`}</tbody></table></div>`;
  }

  function resultsView() {
    const p = S.cur, org = !!p.is_org, cfg = p.cfg || {}, E = (S.entries || []).filter((e) => e.status === 'active');
    const cnt = (st) => E.filter((e) => e.stage === st).length;
    const steps = `<div class="card"><h3>الاعتماد</h3><div class="row" style="gap:.5rem;flex-wrap:wrap">
      ${org ? `<button class="btn" data-pg="approve" data-s="tasfiya" ${cnt('tasfiya') ? '' : 'disabled'}>اعتماد نتيجة التصفية (${cnt('tasfiya')})</button>
      <button class="btn" data-pg="approve" data-s="general" ${cnt('general') ? '' : 'disabled'}>اعتماد نتيجة العامة (${cnt('general')})</button>
      <button class="btn ghost" data-pg="announce" data-s="general" ${cfg.general_done ? '' : 'disabled'}>إعلان الفائزين${cfg.general_announced ? ' ✓' : ''}</button>
      <button class="btn ghost" data-pg="remind" data-s="tasfiya">تنبيه التصفية</button><button class="btn ghost" data-pg="remind" data-s="general">تنبيه العامة</button>
      <button class="btn ghost" data-pg="remind" data-s="halaqat">تنبيه الحلقات</button>` : '<span class="muted">الاعتماد للمنظم.</span>'}
      </div><p class="muted">حد التصفية: ${num(cfg.tasfiya_pass) || '—'} · حد الفوز: ${num(cfg.win) || '—'} · حد التكريم: ${num(cfg.honor_min) || 'الكل'}</p></div>`;
    // الفائزون
    const win = (S.entries || []).filter((e) => e.result === 'winner').sort((a, b) => (a.level > b.level ? 1 : a.level < b.level ? -1 : (a.rank || 99) - (b.rank || 99)));
    const prizeCell = (e) => org ? `<input type="number" min="0" step="5" data-prize="${e.id}" value="${num(e.prize)}" style="width:6rem">` : '';
    const rankCell = (e) => org && !(e.data && e.data.announced) ? `<input type="number" min="1" data-rank="${e.id}" value="${e.rank || ''}" style="width:4rem">${e.rank_manual ? ' <small>يدوي</small>' : ''}` : (e.rank || '');
    const winT = win.map((e) => `<tr><td>${LVS(e.level)}</td><td>${rankCell(e)}</td><td>${esc(e.name)}</td><td>${esc(halName(e.halaqa_id))}</td><td>${esc(placeName(e.place_id))}</td><td>${scoreTxt(e.scores.general)}</td>${org ? `<td>${prizeCell(e)}</td>` : ''}</tr>`).join('');
    const sum = (arr) => arr.reduce((t, e) => t + (+e.prize || 0), 0);
    // الحلقات
    const H = {};
    (S.entries || []).filter((e) => e.track === 'halaqat' && e.status === 'active').forEach((e) => { const k = e.halaqa_id || '-'; (H[k] = H[k] || []).push(e); });
    const st = cfg.halaqat_state || {};
    const halT = Object.entries(H).map(([hid, arr]) => {
      const left = arr.filter((e) => e.stage === 'halaqat').length, scored = arr.filter((e) => e.stage === 'halaqat' && e.scores && e.scores.halaqat).length;
      const state = st[hid] === 'announced' ? 'أُعلنت' : st[hid] === 'approved' ? 'اعتُمدت' : left && scored === left ? 'اختُبرت' : 'لم تُختبر';
      const canAp = hid !== '-' && left && (org || role() === 'supervisor');
      return `<tr><td>${esc(halName(hid))}</td><td>${arr.length}</td><td>${scored}/${left}</td><td>${state}</td>
        <td>${canAp ? `<button class="btn sm" data-pg="approveh" data-h="${hid}">اعتماد</button>` : ''}
        ${st[hid] === 'approved' ? `<button class="btn sm ghost" data-pg="announceh" data-h="${hid}">إعلان</button>` : ''}
        <button class="btn sm ghost" data-pg="honor" data-h="${hid}">المكرّمون</button></td></tr>`;
    }).join('');
    const locked = !!cfg.prizes_locked;
    return steps + `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">فائزو المسابقة العامة (${win.length})</h3>
      ${org ? `<div class="row" style="gap:.4rem"><button class="btn sm" data-pg="saveprizes">حفظ الجوائز والترتيب</button>
      <button class="btn sm ghost" data-pg="lock">${locked ? 'إلغاء اعتماد الجوائز' : 'اعتماد الجوائز'}</button></div>` : ''}</div>
      ${org ? `<p class="muted">إجمالي جوائز العامة: <b>${sum(win)}</b>${locked ? ' · الجوائز معتمدة (أي تعديل يُسجَّل في السجل)' : ''}</p>` : ''}</div>
      <div class="card tbl"><table data-print="فائزو المسابقة العامة"><thead><tr><th>المستوى</th><th>الترتيب</th><th>الاسم</th><th>الحلقة</th><th>المكان</th><th>الدرجة</th>${org ? '<th>الجائزة</th>' : ''}</tr></thead>
      <tbody>${winT || `<tr><td colspan="7">${empty('لم تُعتمد نتيجة العامة بعد.')}</td></tr>`}</tbody></table></div>
      <div class="card"><h3>مسابقة الحلقات</h3></div>
      <div class="card tbl"><table><thead><tr><th>الحلقة</th><th>المتسابقون</th><th>المرصود</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${halT || `<tr><td colspan="5">${empty('لا يوجد متسابقون في مسار الحلقات بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  function summaryView() {
    const E = (S.entries || []).filter((e) => e.status === 'active');
    const places = [...new Set(E.map((e) => e.place_id || '-'))];
    const lv = Object.keys(LV);
    const c = (f) => E.filter(f).length;
    const head = `<tr><th>المستوى</th>${places.map((p) => `<th>${esc(placeName(p) || '—')}</th>`).join('')}<th>إجمالي</th><th>فائز</th><th>مكرَّم</th><th>لم يبلغ</th><th>غائب/خرج</th></tr>`;
    const rows = lv.map((l) => {
      const L = (e) => e.level === l;
      if (!c(L)) return '';
      return `<tr><td>${LV[l]}</td>${places.map((p) => `<td>${c((e) => L(e) && (e.place_id || '-') === p)}</td>`).join('')}<td><b>${c(L)}</b></td>
        <td>${c((e) => L(e) && e.result === 'winner')}</td><td>${c((e) => L(e) && e.result === 'honor')}</td><td>${c((e) => L(e) && e.result === 'below')}</td>
        <td>${c((e) => L(e) && (e.result === 'out' || (e.scores && ((e.scores.general || {}).absent || (e.scores.tasfiya || {}).absent))))}</td></tr>`;
    }).join('');
    const prizes = E.reduce((t, e) => t + (+e.prize || 0), 0);
    return `<div class="card"><h3>الخلاصة</h3>${S.cur.is_org ? `<p>إجمالي الجوائز: <b>${prizes}</b></p>` : ''}</div>
      <div class="card tbl"><table data-print="خلاصة ${esc(S.cur.name)}"><thead>${head}</thead><tbody>${rows || `<tr><td>${empty('لا بيانات بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  const ACT = { create: 'إنشاء النسخة', settings: 'تعديل الإعدادات', staff_add: 'إضافة للطاقم', staff_del: 'حذف من الطاقم', register: 'تسجيل', decide: 'قرار', edit: 'تعديل', exempt: 'إعفاء من التصفية', exempt_undo: 'إلغاء الإعفاء', score: 'رصد', approve_tasfiya: 'اعتماد التصفية', approve_general: 'اعتماد العامة', approve_halaqa: 'اعتماد حلقة', rank_manual: 'تعديل الترتيب', prizes: 'الجوائز', prizes_after_lock: 'تعديل الجوائز بعد اعتمادها', prizes_lock: 'اعتماد الجوائز', prizes_unlock: 'إلغاء اعتماد الجوائز', announce: 'إعلان', remind: 'تنبيه بالموعد', group_ok: 'احتساب مجموعة إتقان', group_undo: 'إلغاء احتساب مجموعة', close: 'إغلاق', reopen: 'إعادة فتح', import: 'استيراد' };
  function logView() {
    if (S.log === null) { setTimeout(async () => { try { S.log = await rpc('prog_log_list', { pid: S.cur.id, only_warn: !!S.logWarn }); } catch (e) { S.log = []; toast(errMsg(e)); } rerender(); }, 0); return '<div class="card"><p class="muted">جارٍ التحميل…</p></div>'; }
    const det = (d) => Object.entries(d || {}).filter(([k, v]) => v !== null && v !== '' && !['student', 'member', 'prev'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
    const tr = S.log.map((l) => `<tr class="${l.warn ? 'pg-warnrow' : ''}"><td>${new Date(l.at).toLocaleString('ar-EG')}</td><td>${esc(l.by_name || '')}</td><td>${ACT[l.action] || esc(l.action)}${l.warn ? ' ⚠' : ''}</td><td>${esc(l.name || '')}</td><td><small>${esc(det(l.detail))}</small></td></tr>`).join('');
    return `<div class="card"><label><input type="checkbox" data-pg="logwarn" ${S.logWarn ? 'checked' : ''}> التنبيهات فقط</label></div>
      <div class="card tbl"><table><thead><tr><th>الوقت</th><th>بواسطة</th><th>الإجراء</th><th>الطالب</th><th>التفاصيل</th></tr></thead><tbody>${tr || `<tr><td colspan="5">${empty('لا شيء بعد.')}</td></tr>`}</tbody></table></div>`;
  }

  // ---------------------------------------------------------------- النوافذ
  function modal(title, html, wide) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><h2>${title}</h2>${html}<div class="row" style="margin-top:1rem"><button class="btn ghost" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (ev) => { if (ev.target === o || ev.target.closest('[data-close]')) o.remove(); });
    return o;
  }
  const lvOptions = (sel, allowM8) => Object.entries(LV).filter(([k]) => allowM8 || k !== 'm8').map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');
  const surOptions = (sel) => SUR.map((n, i) => `<option value="${i + 1}" ${+sel === i + 1 ? 'selected' : ''}>${i + 1}. ${n}</option>`).join('');

  async function openCands() {
    const o = modal('تسجيل متسابقين', '<p class="muted">جارٍ حساب الأجزاء المتقنة…</p>', true);
    let C;
    try { C = await rpc('prog_candidates', { pid: S.cur.id }); } catch (e) { o.querySelector('.modal p').textContent = errMsg(e); return; }
    S.cands = C;
    const box = o.querySelector('.modal p');
    const rows = C.filter((c) => !c.entered).map((c) => {
      const gen = c.juz >= 3, def = gen ? c.allowed[0] : 'm7';
      const pv = c.prev ? `${LVS(c.prev.level)} (${c.prev.year})${c.prev.last_year && c.prev.last_year !== c.prev.year ? ` · ${LVS(c.prev.last_level)} (${c.prev.last_year})` : ''}` : '';
      const groups = (c.groups || []).map((g) => `<button class="btn sm ghost" data-pg="grp" data-sid="${c.student_id}" data-l="${esc(g)}" title="اجتاز المجموعة — غير محتسبة للأهلية">احتساب ${esc(g)}</button>`).join(' ');
      return `<tr data-sid="${c.student_id}"><td>${esc(c.name)}</td><td>${esc(halName(c.halaqa_id))}</td><td>${c.juz}</td>
        <td>${gen ? c.allowed.map(LVS).join(' / ') : '<span class="muted">غير مؤهل للعام</span>'}${groups ? '<br>' + groups : ''}</td>
        <td>${pv ? `<small class="pg-tag w">⚠ ${esc(pv)}</small>` : ''}</td>
        <td><select data-c="trk" data-nosearch><option value="general" ${gen ? 'selected' : ''}>العام</option><option value="halaqat" ${gen ? '' : 'selected'}>الحلقات</option></select></td>
        <td><select data-c="lvl" data-nosearch>${lvOptions(def, true)}</select>
          <span data-c="amt" hidden><select data-c="from" data-nosearch>${surOptions(78)}</select> – <select data-c="to" data-nosearch>${surOptions(114)}</select></span></td>
        <td><button class="btn sm" data-pg="reg">تسجيل</button></td></tr>`;
    }).join('');
    box.outerHTML = `<p class="muted">الأجزاء = الأجزاء المفردة المتصلة من الأول أو من الآخر (آخر محاولة إتقان في كل جزء). الافتراضي أول المستويين.</p>
      <input data-c="q" placeholder="بحث بالاسم" style="max-width:14rem;margin-bottom:.5rem">
      <div class="tbl"><table><thead><tr><th>الاسم</th><th>الحلقة</th><th>أجزاء</th><th>المستويان</th><th>السابق</th><th>المسار</th><th>المستوى</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8">${empty('كل طلاب نطاقك مسجلون أو لا يوجد طلاب.')}</td></tr>`}</tbody></table></div>`;
    const sync = (tr) => {
      const lvl = tr.querySelector('[data-c=lvl]'), trk = tr.querySelector('[data-c=trk]').value;
      [...lvl.options].forEach((op) => { if (op.value === 'm8') op.disabled = trk !== 'halaqat'; });
      if (trk !== 'halaqat' && lvl.value === 'm8') lvl.value = 'm7';
      tr.querySelector('[data-c=amt]').hidden = lvl.value !== 'm8';
    };
    o.querySelectorAll('tr[data-sid]').forEach(sync);
    o.addEventListener('change', (ev) => { const tr = ev.target.closest('tr[data-sid]'); if (tr) sync(tr); });
    o.querySelector('[data-c=q]').addEventListener('input', (ev) => {
      const q = ev.target.value.trim(); o.querySelectorAll('tr[data-sid]').forEach((tr) => { tr.hidden = q && !tr.firstElementChild.textContent.includes(q); });
    });
    o.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-pg]'); if (!b) return;
      const tr = b.closest('tr[data-sid]'); const sid = tr && tr.dataset.sid;
      if (b.dataset.pg === 'grp') {
        await run(b, rpc('prog_group_approve', { pid: S.cur.id, sid: b.dataset.sid, lbl: b.dataset.l, ok: true }), 'احتُسبت المجموعة');
        o.remove(); openCands(); return;
      }
      if (b.dataset.pg !== 'reg') return;
      const lvl = tr.querySelector('[data-c=lvl]').value, trk = tr.querySelector('[data-c=trk]').value;
      let amt = null;
      if (lvl === 'm8') { const a = +tr.querySelector('[data-c=from]').value, z = +tr.querySelector('[data-c=to]').value; amt = { from: a, to: z, pages: pagesOf(a, z) }; }
      try {
        await run(b, rpc('prog_register', { pid: S.cur.id, sid, ex: null, trk, lvl, amt }));
        tr.innerHTML = `<td colspan="8" class="muted">سُجِّل ${esc(tr.firstElementChild.textContent)} ✓</td>`;
        S.dirty = true;
      } catch (e) { /* toast shown */ }
    });
    o.addEventListener('click', (ev) => { if (ev.target === o || ev.target.closest('[data-close]')) { if (S.dirty) { S.dirty = false; reloadCur(); } } }, true);
  }

  function openExt() {
    const hals = (db.halaqat || []).map((h) => `<option value="${h.id}">${esc(halName(h.id))}</option>`).join('');
    const o = modal('إضافة طالب خارجي', `
      <label>الاسم<input data-x="name"></label><label>الجوال<input data-x="phone" type="tel"></label>
      <label>ولي الأمر<input data-x="guardian"></label><label>العمر<input data-x="age" type="number" min="3" max="99"></label>
      <label>الحلقة التي يُختبر فيها (لمسار الحلقات)<select data-x="halaqa_id"><option value="">—</option>${hals}</select></label>
      <label>المسار<select data-x="trk" data-nosearch><option value="halaqat">الحلقات</option><option value="general">العام (بقرار المنظم)</option></select></label>
      <label>المستوى<select data-x="lvl" data-nosearch>${lvOptions('m7', true)}</select></label>
      <span data-x="amt"><label>من سورة<select data-x="from" data-nosearch>${surOptions(78)}</select></label><label>إلى سورة<select data-x="to" data-nosearch>${surOptions(114)}</select></label></span>
      <div class="row"><button class="btn" data-x="save">إضافة</button></div>`);
    const g = (k) => o.querySelector(`[data-x=${k}]`);
    const sync = () => { g('amt').hidden = g('lvl').value !== 'm8'; };
    sync(); o.addEventListener('change', sync);
    g('save').addEventListener('click', async (ev) => {
      const lvl = g('lvl').value, trk = g('trk').value;
      if (lvl === 'm8' && trk !== 'halaqat') return toast('م8 لمسار الحلقات فقط');
      const ex = { name: g('name').value.trim(), phone: g('phone').value.trim(), guardian: g('guardian').value.trim(), age: g('age').value, halaqa_id: g('halaqa_id').value || null };
      const amt = lvl === 'm8' ? { from: +g('from').value, to: +g('to').value, pages: pagesOf(g('from').value, g('to').value) } : null;
      try { await run(ev.target, rpc('prog_register', { pid: S.cur.id, sid: null, ex, trk, lvl, amt }), 'أُضيف الطالب'); o.remove(); reloadCur(); } catch (e) { /* toast */ }
    });
  }

  function openScore(e) {
    const stg = e.stage, cfg = S.cur.cfg || {}, notes = (cfg.notes && cfg.notes.length ? cfg.notes : NOTES_DEF);
    const sc = (e.scores || {})[stg] || {};
    const judges = S.staff.filter((s) => s.ext && s.role === (stg === 'halaqat' ? 'tester' : 'judge'));
    const o = modal(`رصد ${STAGE[stg]} — ${esc(e.name)}`, `
      <p class="muted">${LV[e.level] || ''}${e.level === 'm8' ? ' · ' + esc(amountTxt(e.amount)) : ''}</p>
      <label>الدرجة (من 100)<input data-s="v" type="number" min="0" max="100" step="0.25" value="${sc.absent ? '' : num(sc.v)}"></label>
      <label><input type="checkbox" data-s="absent" ${sc.absent ? 'checked' : ''}> غائب</label>
      ${stg !== 'halaqat' ? `<div class="pg-notes">${notes.map((n) => `<label class="pg-chip"><input type="checkbox" value="${esc(n)}" ${(sc.notes || []).includes(n) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>` : ''}
      ${S.cur.is_org && judges.length ? `<label>نيابة عن محكّم خارجي<select data-s="judge" data-nosearch><option value="">—</option>${judges.map((j) => `<option ${sc.judge === j.name ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</select></label>` : ''}
      <div class="row"><button class="btn" data-s="save">حفظ</button></div>`);
    const g = (k) => o.querySelector(`[data-s=${k}]`);
    g('save').addEventListener('click', async (ev) => {
      const absent = g('absent').checked, v = g('v').value;
      if (!absent && (v === '' || +v < 0 || +v > 100)) return toast('اكتب الدرجة من 0 إلى 100 أو علّم «غائب»');
      const nt = [...o.querySelectorAll('.pg-notes input:checked')].map((x) => x.value);
      try { await run(ev.target, rpc('prog_score', { eid: e.id, stg, v: absent ? null : +v, absent, notes: nt, judge: g('judge') ? g('judge').value : null }), 'حُفظ الرصد'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
  }

  function openDecide(e) {
    const o = modal(`قرار — ${esc(e.name)}`, `
      <p>المستوى المقترح: <b>${LV[e.level]}</b> · أجزاء الإتقان: ${(e.data && e.data.juz) || 0}</p>
      <p>${tagsHtml(e)}</p>${prevTxt(e) ? `<p class="muted">أعلى مستوى سابق: ${esc(prevTxt(e))}</p>` : ''}
      <label>تعديل المستوى إلى<select data-d="lvl" data-nosearch>${lvOptions(e.level, e.track === 'halaqat')}</select></label>
      <div class="row" style="gap:.4rem"><button class="btn" data-d="approve">موافقة</button><button class="btn ghost" data-d="edit">اعتماد المستوى المعدّل</button><button class="btn ghost" data-d="reject">رفض</button></div>`);
    o.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-d]'); if (!b || b.tagName !== 'BUTTON') return;
      const dcs = b.dataset.d;
      try { await run(b, rpc('prog_decide', { eid: e.id, dcs, lvl: dcs === 'edit' ? o.querySelector('[data-d=lvl]').value : null }), 'حُفظ القرار'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
  }

  function openEdit(e) {
    const am = e.amount || {};
    const hals = (db.halaqat || []).map((h) => `<option value="${h.id}" ${e.data && e.data.ext && e.data.ext.halaqa_id === h.id ? 'selected' : ''}>${esc(halName(h.id))}</option>`).join('');
    const o = modal(`تعديل — ${esc(e.name)}`, `
      <label>المستوى<select data-e="lvl" data-nosearch>${lvOptions(e.level, e.track === 'halaqat')}</select></label>
      <span data-e="amt"><label>من سورة<select data-e="from" data-nosearch>${surOptions(am.from || 78)}</select></label><label>إلى سورة<select data-e="to" data-nosearch>${surOptions(am.to || 114)}</select></label></span>
      ${e.ext ? `<label>حلقة الاختبار<select data-e="hal"><option value="">—</option>${hals}</select></label>` : ''}
      <div class="row"><button class="btn" data-e="save">حفظ</button></div>`);
    const g = (k) => o.querySelector(`[data-e=${k}]`);
    const sync = () => { g('amt').hidden = g('lvl').value !== 'm8'; };
    sync(); o.addEventListener('change', sync);
    g('save').addEventListener('click', async (ev) => {
      const lvl = g('lvl').value;
      const amt = lvl === 'm8' ? { from: +g('from').value, to: +g('to').value, pages: pagesOf(g('from').value, g('to').value) } : null;
      const ex = e.ext && g('hal') ? { halaqa_id: g('hal').value || null } : null;
      try { await run(ev.target, rpc('prog_entry_edit', { eid: e.id, lvl, amt, ex }), 'حُفظ التعديل'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
  }

  function openExempt(e) {
    const on = !(e.tags || []).includes('exempt');
    if (!on) {
      ask(`إلغاء إعفاء ${e.name} من التصفية؟`, async () => { try { await run(null, rpc('prog_exempt', { eid: e.id, reason: null, on_: false }), 'أُلغي الإعفاء'); reloadCur(); } catch (x) { /* toast */ } });
      return;
    }
    const o = modal(`إعفاء ${esc(e.name)} من التصفية`, `<p class="muted">يصل إشعار بالإعفاء وسببه إلى المديرين العامين والمشرفين المنظمين.</p>
      <label>السبب (إلزامي)<textarea data-r="t" rows="3"></textarea></label><div class="row"><button class="btn" data-r="ok">إعفاء</button></div>`);
    o.querySelector('[data-r=ok]').addEventListener('click', async (ev) => {
      const reason = o.querySelector('[data-r=t]').value.trim();
      if (!reason) return toast('سبب الإعفاء إلزامي');
      try { await run(ev.target, rpc('prog_exempt', { eid: e.id, reason, on_: true }), 'تم الإعفاء'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
  }

  function openHonor(hid) {
    const org = !!S.cur.is_org;
    const arr = (S.entries || []).filter((e) => e.track === 'halaqat' && (e.halaqa_id || '-') === hid && e.status === 'active')
      .sort((a, b) => (a.level > b.level ? 1 : a.level < b.level ? -1 : (a.rank || 99) - (b.rank || 99)));
    const tr = arr.map((e) => `<tr><td>${LVS(e.level)}${e.level === 'm8' ? `<br><small>${esc(amountTxt(e.amount))}</small>` : ''}</td><td>${e.result === 'honor' ? (e.rank || '') : ''}</td><td>${esc(e.name)}</td>
      <td>${scoreTxt((e.scores || {}).halaqat)}</td><td>${e.result ? RESULT[e.result] : STAGE[e.stage]}</td>
      ${org ? `<td>${e.result === 'honor' ? `<input type="number" min="0" step="5" data-prize="${e.id}" value="${num(e.prize)}" style="width:6rem">` : ''}</td>` : ''}</tr>`).join('');
    const o = modal(`مسابقة الحلقات — ${esc(halName(hid))}`, `<div class="tbl"><table data-print="مكرّمو ${esc(halName(hid))}"><thead><tr><th>المستوى</th><th>الترتيب</th><th>الاسم</th><th>الدرجة</th><th>النتيجة</th>${org ? '<th>الجائزة</th>' : ''}</tr></thead><tbody>${tr}</tbody></table></div>
      ${org ? `<div class="row"><button class="btn" data-h="save">حفظ الجوائز</button></div>` : ''}`, true);
    const sv = o.querySelector('[data-h=save]');
    if (sv) sv.addEventListener('click', async (ev) => {
      const items = [...o.querySelectorAll('[data-prize]')].map((i) => ({ id: i.dataset.prize, prize: i.value }));
      try { await run(ev.target, rpc('prog_prizes', { pid: S.cur.id, items }), 'حُفظت الجوائز'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
  }

  async function openNew() {
    const y = new Date().getFullYear() - 579; // تقريب للسنة الهجرية، يعدّلها المنظم
    openForm('نسخة جديدة من مسابقة رمضان', [{ name: 'name', label: 'الاسم', value: 'مسابقة رمضان ' + y }, { name: 'year', label: 'السنة الهجرية', value: String(y) }], async (v) => {
      if (!v.name || !+v.year) return 'اكتب الاسم والسنة';
      try { const id = await rpc('prog_save', { pid: null, knd: 'ramadan', nm: v.name, yr: +v.year, cf: { neutral: true, win: 94 } }); S.list = null; await loadList(); openProgram(id); }
      catch (e) { toast(errMsg(e)); }
    });
  }

  function openSettings() {
    const p = S.cur, c = p.cfg || {}, d = c.dates || {}, m = c.msgs || {};
    const admin = isAdminLike();
    const sups = (db.supervisors || []).filter((s) => !(window.isGenSup && window.isGenSup(s)));
    const staffRow = (s) => `<li>${esc(s.name)}${s.ext ? ' <small>(خارجي)</small>' : ''} <small class="muted">${{ organizer: 'منظم', judge: 'محكّم', tester: 'مختبِر' }[s.role]}${s.scope && s.scope.halaqat && s.scope.halaqat.length ? ' · ' + s.scope.halaqat.map(halName).join('، ') : ''}</small>
      ${(s.role !== 'organizer' || admin) ? `<button class="btn sm ghost" data-st-del="${s.id}">حذف</button>` : ''}</li>`;
    const staff = S.staff.map(staffRow).join('');
    const teachers = [...(db.teachers || []), ...(db.supervisors || [])].map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    const hals = (db.halaqat || []).map((h) => `<option value="${h.id}">${esc(halName(h.id))}</option>`).join('');
    const o = modal('إعدادات النسخة', `
      <p class="muted">لا يلزم ملء كل الإعدادات مرة واحدة؛ يُطلب كل إعداد قبل المرحلة التي تحتاجه.</p>
      <details open><summary><b>عام</b></summary>
        <label>الاسم<input data-k="name" value="${esc(p.name || '')}"></label>
        <label>السنة الهجرية<input data-k="year" type="number" value="${p.year || ''}"></label>
        <label>بداية برنامج المسابقة<input data-k="start" type="date" value="${esc(c.start || '')}"></label>
        <label>مقر الاختبار العام<input data-k="venue" value="${esc(c.venue || '')}"></label>
      </details>
      <details open><summary><b>الحدود</b></summary>
        <label>حد اجتياز التصفية<input data-k="tasfiya_pass" type="number" step="0.25" value="${num(c.tasfiya_pass)}"></label>
        <label>حد الفوز في العامة<input data-k="win" type="number" step="0.25" value="${num(c.win)}"></label>
        <label>الحد الأدنى للتكريم العادي (فارغ = كل من اختُبر)<input data-k="honor_min" type="number" step="0.25" value="${num(c.honor_min)}"></label>
        <label><input type="checkbox" data-k="neutral" ${c.neutral === false ? '' : 'checked'}> منع المعلم من اختبار طلاب حلقته</label>
      </details>
      <details><summary><b>المواعيد</b> (تظهر في التنبيهات)</summary>
        <label>موعد التصفية<input data-k="d_tasfiya" value="${esc(d.tasfiya || '')}" placeholder="مثل: يوم الجمعة 1 رمضان بعد العصر"></label>
        <label>موعد المسابقة العامة<input data-k="d_general" value="${esc(d.general || '')}"></label>
        <label>موعد اختبار الحلقات (موحّد)<input data-k="d_halaqat" value="${esc(d.halaqat || '')}"></label>
      </details>
      <details><summary><b>نصوص الرسائل</b> — المتغيرات: {الاسم} {النسخة} {المقر} {الموعد}</summary>
        <label>تنبيه التصفية<textarea data-k="m_tasfiya" rows="2" placeholder="يُرجى حضور اختبار التصفية لـ{النسخة} في {المقر} {الموعد}">${esc(m.tasfiya || '')}</textarea></label>
        <label>تنبيه العامة<textarea data-k="m_general" rows="2" placeholder="يُرجى حضور اختبار {النسخة} في {المقر} {الموعد}">${esc(m.general || '')}</textarea></label>
        <label>تنبيه الحلقات<textarea data-k="m_halaqat" rows="2" placeholder="يُرجى حضور اختبار {النسخة} في حلقتك {الموعد}">${esc(m.halaqat || '')}</textarea></label>
        <label>التهنئة<textarea data-k="m_congrats" rows="2" placeholder="مبارك! نجحت في {النسخة}">${esc(m.congrats || '')}</textarea></label>
      </details>
      <details><summary><b>ملاحظات التجويد الجاهزة</b></summary>
        <label>مفصولة بفاصلة<input data-k="notes" value="${esc((c.notes && c.notes.length ? c.notes : NOTES_DEF).join('، '))}"></label>
      </details>
      <div class="row"><button class="btn" data-k="save">حفظ الإعدادات</button></div>
      <hr><h3>الطاقم</h3><ul class="pg-staff">${staff || '<li class="muted">لا أحد بعد</li>'}</ul>
      ${admin ? `<div class="row" style="gap:.4rem;flex-wrap:wrap"><select data-k="org_id"><option value="">مشرف منظم…</option>${sups.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn sm" data-k="add_org">إضافة منظم</button></div>` : ''}
      <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-top:.4rem">
        <select data-k="st_role" data-nosearch><option value="judge">محكّم (التصفية والعامة)</option><option value="tester">مختبِر (الحلقات)</option></select>
        <select data-k="st_id"><option value="">من المعلمين…</option>${teachers}</select>
        <input data-k="st_ext" placeholder="أو اسم شخص من الخارج" style="max-width:12rem">
        <select data-k="st_hal" multiple size="3" title="الحلقات المسندة (فارغ = الكل)">${hals}</select>
        <button class="btn sm" data-k="add_st">إضافة</button></div>
      ${admin ? `<hr><button class="btn ghost" data-k="close">${p.status === 'closed' ? 'إعادة فتح النسخة' : 'إغلاق النسخة'}</button>` : ''}`, true);
    const g = (k) => o.querySelector(`[data-k=${k}]`);
    g('save').addEventListener('click', async (ev) => {
      const cf = {
        start: g('start').value || null, venue: g('venue').value.trim(), tasfiya_pass: g('tasfiya_pass').value === '' ? null : +g('tasfiya_pass').value,
        win: g('win').value === '' ? null : +g('win').value, honor_min: g('honor_min').value === '' ? null : +g('honor_min').value, neutral: g('neutral').checked,
        dates: { tasfiya: g('d_tasfiya').value.trim(), general: g('d_general').value.trim(), halaqat: g('d_halaqat').value.trim() },
        msgs: { tasfiya: g('m_tasfiya').value.trim(), general: g('m_general').value.trim(), halaqat: g('m_halaqat').value.trim(), congrats: g('m_congrats').value.trim() },
        notes: g('notes').value.split(/[،,]/).map((x) => x.trim()).filter(Boolean),
      };
      try { await run(ev.target, rpc('prog_save', { pid: p.id, knd: 'ramadan', nm: g('name').value, yr: +g('year').value || null, cf }), 'حُفظت الإعدادات'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
    });
    o.addEventListener('click', async (ev) => {
      const del = ev.target.closest('[data-st-del]');
      if (del) { try { await run(del, rpc('prog_staff_del', { stid: del.dataset.stDel }), 'حُذف'); o.remove(); await reloadCur(); openSettings(); } catch (x) { /* toast */ } return; }
      const b = ev.target.closest('button[data-k]'); if (!b) return;
      if (b.dataset.k === 'add_org') {
        if (!g('org_id').value) return toast('اختر المشرف');
        try { await run(b, rpc('prog_staff_add', { pid: p.id, mid: g('org_id').value, ename: null, rl: 'organizer', sc: {} }), 'أُضيف المنظم'); o.remove(); await reloadCur(); openSettings(); } catch (x) { /* toast */ }
      } else if (b.dataset.k === 'add_st') {
        const mid = g('st_id').value || null, ename = g('st_ext').value.trim();
        if (!mid && !ename) return toast('اختر معلمًا أو اكتب اسمًا');
        const hal = [...g('st_hal').selectedOptions].map((x) => x.value);
        try { await run(b, rpc('prog_staff_add', { pid: p.id, mid, ename: mid ? null : ename, rl: g('st_role').value, sc: hal.length ? { halaqat: hal } : {} }), 'أُضيف'); o.remove(); await reloadCur(); openSettings(); } catch (x) { /* toast */ }
      } else if (b.dataset.k === 'close') {
        try { await run(b, rpc('prog_close', { pid: p.id, cls: p.status !== 'closed' }), 'تم'); o.remove(); reloadCur(); } catch (x) { /* toast */ }
      }
    });
  }

  // ---------------------------------------------------------------- الأحداث
  const byEntry = (id) => (S.entries || []).find((e) => e.id === id);
  document.addEventListener('click', async (ev) => {
    if (typeof ui === 'undefined' || !ui || ui.tab !== KEY) return;
    const b = ev.target.closest('main [data-pg]'); if (!b) return;
    const a = b.dataset.pg, id = b.dataset.id;
    if (a === 'open') return openProgram(id);
    if (a === 'back') { S.cur = null; S.entries = null; S.err = ''; return loadList(); }
    if (a === 'new') return openNew();
    if (a === 'reload') { S.err = ''; return reloadCur(); }
    if (a === 'tab') { S.tab = b.dataset.t; if (S.tab === 'log') S.log = null; return render(); }
    if (a === 'settings') return openSettings();
    if (a === 'cands') return openCands();
    if (a === 'ext') return openExt();
    if (a === 'score') return openScore(byEntry(id));
    if (a === 'decide') return openDecide(byEntry(id));
    if (a === 'edit') return openEdit(byEntry(id));
    if (a === 'exempt') return openExempt(byEntry(id));
    if (a === 'honor') return openHonor(b.dataset.h);
    if (a === 'logwarn') { S.logWarn = b.checked; S.log = null; return render(); }
    const pid = S.cur && S.cur.id;
    if (a === 'approve') {
      const s = b.dataset.s, txt = s === 'tasfiya' ? 'اعتماد نتيجة التصفية؟ ينتقل من بلغ الحد والمعفون إلى العامة، والباقون إلى مسار الحلقات مع تنبيههم.' : 'اعتماد نتيجة العامة؟ يُحدد الفائزون وترتيبهم، ومن لم يبلغ الحد تُنقل درجته إلى الحلقات، والغائب يُنبَّه لاختبار الحلقات.';
      return ask(txt, async () => { try { const n = await run(b, rpc(s === 'tasfiya' ? 'prog_approve_tasfiya' : 'prog_approve_general', { pid })); toast(`اعتُمد ${n}`); reloadCur(); } catch (x) { /* toast */ } });
    }
    if (a === 'approveh') return ask(`اعتماد نتيجة ${halName(b.dataset.h)}؟`, async () => { try { const n = await run(b, rpc('prog_approve_halaqa', { pid, hid: b.dataset.h })); toast(`اعتُمد ${n}`); reloadCur(); } catch (x) { /* toast */ } });
    if (a === 'announce') return ask('إرسال التهنئة لفائزي العامة؟', async () => { try { const n = await run(b, rpc('prog_announce', { pid, scp: 'general', hid: null })); toast(`أُرسلت ${n} تهنئة`); reloadCur(); } catch (x) { /* toast */ } });
    if (a === 'announceh') return ask(`إرسال التهنئة لمكرّمي ${halName(b.dataset.h)}؟`, async () => { try { const n = await run(b, rpc('prog_announce', { pid, scp: 'halaqa', hid: b.dataset.h })); toast(`أُرسلت ${n} تهنئة`); reloadCur(); } catch (x) { /* toast */ } });
    if (a === 'remind') return ask(`إرسال تنبيه ${STAGE[b.dataset.s]} بالموعد لكل من في هذه المرحلة؟`, async () => { try { const n = await run(b, rpc('prog_remind', { pid, key: b.dataset.s })); toast(`أُرسل ${n} تنبيه`); } catch (x) { /* toast */ } });
    if (a === 'saveprizes') {
      const items = [...document.querySelectorAll('main [data-prize]')].map((i) => ({ id: i.dataset.prize, prize: i.value }));
      const ranks = [...document.querySelectorAll('main [data-rank]')].filter((i) => { const e = byEntry(i.dataset.rank); return e && String(e.rank || '') !== i.value && i.value; });
      try {
        await run(b, rpc('prog_prizes', { pid, items }));
        for (const i of ranks) await rpc('prog_rank_set', { eid: i.dataset.rank, rk: +i.value });
        toast('حُفظت الجوائز والترتيب'); reloadCur();
      } catch (x) { /* toast */ }
      return;
    }
    if (a === 'lock') { try { await run(b, rpc('prog_prizes_lock', { pid, lck: !(S.cur.cfg || {}).prizes_locked }), 'تم'); reloadCur(); } catch (x) { /* toast */ } }
  });
  document.addEventListener('input', (ev) => {
    if (typeof ui === 'undefined' || !ui || ui.tab !== KEY) return;
    const t = ev.target.closest('main [data-pgf]'); if (!t) return;
    S.f[t.dataset.pgf] = t.value.trim();
    clearTimeout(S._ft); S._ft = setTimeout(() => { const pos = t.selectionStart; render(); const n = document.querySelector(`main [data-pgf="${t.dataset.pgf}"]`); if (n && t.tagName === 'INPUT') { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }, t.tagName === 'INPUT' ? 250 : 0);
  });

  // ---------------------------------------------------------------- التسجيل في التطبيق
  const css = document.createElement('style');
  css.textContent = `.pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.7rem}
    .pg-card{display:flex;flex-direction:column;gap:.3rem;text-align:start;cursor:pointer;border:1px solid var(--line,#ddd)}
    .pg-tag{display:inline-block;font-size:.72rem;padding:.05rem .4rem;border-radius:.6rem;background:rgba(19,41,75,.08);margin:.1rem}
    .pg-tag.w{background:rgba(179,55,47,.12);color:var(--red,#b3372f)}
    .pg-err{color:var(--red,#b3372f);font-weight:700}
    .pg-acts{white-space:nowrap}.pg-notes{display:flex;flex-wrap:wrap;gap:.3rem;margin:.5rem 0}
    .pg-chip{border:1px solid var(--line,#ccc);border-radius:1rem;padding:.1rem .5rem;font-size:.85rem}
    .pg-staff li{margin:.25rem 0}.pg-warnrow td{background:rgba(179,55,47,.06)}
    html.qdark .pg-tag{background:rgba(255,255,255,.08)}`;
  document.head.appendChild(css);

  function install() {
    try {
      if (!VFILES.includes('./programs.js')) VFILES.push('./programs.js');
    } catch (e) { /* ignore */ }
    try {
      const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
      if (typeof TAB_ICONS === 'object') TAB_ICONS[KEY] = typeof svg === 'function' ? svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>') : ICON;
    } catch (e) { /* ignore */ }
    const add = (role) => {
      try {
        if (!TABS[role]) return;
        if (!TABS[role].some((t) => t[0] === KEY)) {
          const i = TABS[role].findIndex((t) => t[0] === 'news');
          TABS[role].splice(i < 0 ? TABS[role].length : i, 0, [KEY, 'البرامج']);
        }
        const V = (VIEWS && VIEWS[role]) || null;
        if (V) V[KEY] = view;
      } catch (e) { /* ignore */ }
    };
    ['admin', 'supervisor', 'teacher', 'placeadmin'].forEach(add);
    try { adminViews[KEY] = view; supervisorViews[KEY] = view; teacherViews[KEY] = view; } catch (e) { /* ignore */ }
    // قائمة المدير العام تُبنى من roles.js (QLGMTabs)
    try {
      if (typeof window.QLGMTabs === 'function' && !window.QLGMTabs._pg) {
        const base = window.QLGMTabs;
        window.QLGMTabs = function () { const t = base.apply(this, arguments) || []; return t.some((x) => x[0] === KEY) ? t : t.concat([[KEY, 'البرامج']]); };
        window.QLGMTabs._pg = true;
      }
    } catch (e) { /* ignore */ }
    // موضع الزر في الشريط الجانبي: بعد آخر أقسام «التعليم»
    try {
      const baseRender = render;
      render = function () {
        const r = baseRender.apply(this, arguments);
        try {
          const nav = document.querySelector('.side nav.tabs'), btn = nav && nav.querySelector(`:scope > button[data-v="${KEY}"]`);
          if (btn) {
            const edu = ['absence', 'hist', 'att', 'halaqat', 'teachers', 'mine', 'students'].map((k) => nav.querySelector(`:scope > button[data-v="${k}"]`)).find(Boolean);
            if (edu && edu.nextElementSibling !== btn) edu.after(btn);
          }
        } catch (e) { /* ignore */ }
        return r;
      };
    } catch (e) { /* ignore */ }
    try { if (typeof session !== 'undefined' && session) render(); } catch (e) { /* ignore */ }
  }
  document.addEventListener('DOMContentLoaded', install);
})();
