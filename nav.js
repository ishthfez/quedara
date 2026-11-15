'use strict';
/* ============ تنظيم أقسام المدير: لكل شيء بيت واحد (المرحلة الأولى) ============
   - أقسام متقاربة صارت تبويبات داخل قسم واحد، دون حذف أي وظيفة:
       «الاشتراكات»: التحصيل + تحصيل المعلمين
       «المرتبات»: المرتبات + غياب المعلمين
       «الإعدادات»: الإعدادات + الصلاحيات + النسخ الاحتياطية + البيانات المعلّقة
   - الشريط الجانبي مجمّع بعناوين: التعليم، المالية، التواصل، النظام.
   - أي زر قديم يفتح قسمًا صار تبويبًا (مثل «+ تسجيل غياب» أو «النسخ الاحتياطية…») يفتح القسم الجامع على تبويبه.
   يُحمَّل بعد كل الملفات التي تضيف أقسامًا، وقبل app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./nav.js')) VFILES.push('./nav.js'); } catch (e) { /* ignore */ } });
  /* إعادة التنظيم (المرحلة الأولى، الشكل فقط): العناصر الأساسية طالب وعامل وحلقة ومكان.
     - «الأعضاء» لم يعد قسمًا: صار «حسابات الدخول» في «الإعدادات»، و«مكرر للمراجعة» تبويبًا مستقلًا بجانبه (يظهر حين يوجد فيه أسماء).
     - «العاملون»: القائمة الموحدة + الغياب + المرتبات (الغياب يُخصم من المرتب، فدورة الشهر كلها في مكان واحد).
     - الاشتراكات صارت مع الطلاب كما المرتبات مع العاملين: «الطلاب ← الاشتراكات» و«الطلاب ← تحصيل المعلمين»
       (والمحاسب كما هو: «الاشتراكات» قسمه الأول).
     - حسابات الدخول بحسب أصحابها (القائمة نفسها بفئات مختلفة):
       العاملون ← عمود «الحساب» في «العاملون» وأدواته في شريطه (وغير المصنفين بتصفية «غير مصنف»)؛ الطلاب ← «الطلاب ← الحسابات»؛
       «طلاب بلا حلقة» ← «الطلاب ← بلا حلقة»؛ والمديرون وحدهم ← «الإعدادات ← حسابات المديرين».
     - «الطلاب»: الطلاب · الحضور · الاشتراكات · تحصيل المعلمين · الحسابات (حضور الطلاب معهم كغياب العاملين معهم؛
       والمعلم والمشرف: «الحضور» قسمهما الأول كما هو). في «الطلاب» التصفية تحدد ما يظهر:
       كل الحلقات ← الجدول العام؛ حلقة معينة ← أدوات الحلقة (المنتظمون/المنقطعون، التسميع، الإشعار)؛
       «بلا حلقة» ← أداة تعيين الحلقات. (كان: كل الطلاب · حسب الحلقة · بلا حلقة — ثلاثة عروض للشيء نفسه)
     الدوال الأصلية لكل قسم كما هي؛ والأزرار القديمة (data-v="members" أو "payroll"…) تفتح القسم الجامع على تبويبها. */
  const dupsN = () => (db.payroll?.settings?.dup_students || []).length;
  const GROUPS = {
    teachers: [['teachers', 'العاملون'], ['absence', 'الغياب'], ['payroll', 'المرتبات']],
    settings: [['settings', 'الإعدادات'], ['members', 'حسابات المديرين'], ['dups', 'مكرر للمراجعة', () => dupsN() > 0], ['perms', 'الصلاحيات'], ['backup', 'النسخ الاحتياطية'], ['pending', 'بيانات معلّقة']]
  };
  /* «مكرر للمراجعة» تبويب مستقل: هو فئة «dups» من قائمة الأعضاء نفسها، بلا قائمة الفئات */
  const baseMem = adminViews.members;
  const MSEL = /<select class="msubsel"[\s\S]*?<\/select>/;
  adminViews.dups = () => {
    ui.msub = 'dups';
    return baseMem().replace(MSEL, '<h2 class="grow" style="margin:0">مكرر للمراجعة</h2>');
  };
  /* الفئات: للعاملين (staff، المعلمون…، المسميات الأخرى، غير مصنف)، وللطلاب (الطلاب، بلا حلقة)، وللإعدادات (المديرون) */
  const STU_K = ['students', 'nohal'];
  const isStu = k => STU_K.includes(k), isSet = k => k === 'admins', isStaff = k => !!k && !isSet(k) && !isStu(k) && k !== 'dups';
  const noHalN = () => (window.QLNoHalaqa ? window.QLNoHalaqa().length : 0);
  const keepOpts = (h, ok) => h.replace(MSEL, sel => sel.replace(/<option value="([^"]*)"[^>]*>[^<]*<\/option>/g, (o, v) => ok(v) ? o : '')
    .replace(/<optgroup[^>]*>\s*<\/optgroup>/g, ''));
  const NOHAL = '<div class="card"><h2>طلاب غير مصنفين (بلا حلقة)';
  /* «العاملون ← الحسابات» */
  adminViews.accounts = () => {
    if (!isStaff(ui.msub)) { ui.msub = 'staff'; saveTab(); }
    let h = keepOpts(baseMem(), v => isStaff(v));
    /* «غير مصنف» هنا للعاملين وحدهم: بلا بطاقة الطلاب بلا حلقة، والعدد للعاملين فقط */
    h = h.replace(/(<option value="unclassified"[^>]*>غير مصنف \()(\d+)(\))/, (m, a, k, c) => a + (typeof unclassCount === 'function' ? unclassCount() : k) + c);
    const i = h.indexOf(NOHAL);
    if (i > -1) { const end = h.lastIndexOf('</div>'); h = h.slice(0, i) + h.slice(end); }
    return slimAcc(h);
  };
  /* جداول «الحسابات» للحساب وحده: الوظيفة في المرتبات والمكان في «العاملون»، وزرّا «النطاق» و«الاسم» في ملف العامل
     (فيه: تعديل الاسم أو البيانات، والنطاق، وكلمة المرور). يُحذف العمود بعنوانه، والعمود الذي يفرغ بعدها يُحذف كذلك. */
  const DROP_COLS = ['الوظيفة في المرتبات', 'المكان'];
  function slimAcc(h) {
    const t = document.createElement('template'); t.innerHTML = h;
    t.content.querySelectorAll('[data-act="memScope"],[data-act="editName"]').forEach(b => b.remove());
    t.content.querySelectorAll('.tbl table').forEach(tbl => {
      const head = [...tbl.rows].find(r => r.querySelector('th')); if (!head) return;
      if ([...tbl.rows].some(r => [...r.cells].some(c => c.colSpan > 1 || c.rowSpan > 1))) return;   // جدول مركّب: يبقى كما هو
      const n = head.cells.length, drop = [];
      for (let c = 0; c < n; c++) {
        const title = head.cells[c].textContent.trim();
        const emptyCol = !title && [...tbl.rows].every(r => r === head || !r.cells[c] || (!r.cells[c].textContent.trim() && !r.cells[c].querySelector('button,select,input')));
        if (DROP_COLS.includes(title) || emptyCol) drop.push(c);
      }
      drop.reverse().forEach(c => [...tbl.rows].forEach(r => r.cells[c]?.remove()));
    });
    return t.innerHTML;
  }
  /* ===== «العاملون»: قائمة واحدة فيها الحساب، وأدوات الحسابات في شريطها (لم يعد تبويب «الحسابات») =====
     - يُحذف عمود «الوظيفة في المرتبات» (نص من ملف المرتبات لا يُحدَّث؛ القيمة باقية في بيانات المرتب)، ويُضاف عمود «الحساب».
     - الشريط: إنشاء الحسابات الناقصة، إرسال بيانات الدخول، الاستيراد، الأسماء المتشابهة، والإضافة بحسب التصفية.
     - تصفية «غير مصنف»: أداة التصنيف (ومعها المصنفون بمسميات أخرى) بدل الجدول، كـ«بلا حلقة» في الطلاب.
     - الحذف من ملف العامل («حذف»)، والاسم والنطاق فيه من قبل. */
  const W_KINDS = ['supervisors', 'teachers', 'accountants', 'placeadmins'];
  const baseWorkers = adminViews.teachers;
  let wPendK = null;   // تصفية تُطبَّق بعد الرسم (staff.js يحفظ تصفيته داخله)
  const splitKey = key => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
  function wAccCell(key) {
    const [k, id] = splitKey(key);
    if (k === 'e') {
      const e = (db.payroll?.employees || []).find(x => x.id === id);
      if (!e || !clsOf(e)) return '<span class="muted">يُصنَّف أولًا</span>';
      return e.status === 'متوقف' ? '<span class="muted">—</span>' : `<span class="tag">بلا حساب</span> <button type="button" class="btn sm primary" data-ttlacc="${esc(id)}">إنشاء حساب</button>`;
    }
    const m = byId(db[k] || [], id); if (!m) return '—';
    if (!CLOUD) return '<span class="tag tag-ok">له حساب</span>';
    return m.hasLogin ? `<span class="tag tag-ok">متاح</span> <button type="button" class="btn sm" data-act="cloudPw" data-k="${k}" data-id="${esc(id)}">كلمة جديدة</button>`
      : `<span class="tag">بلا حساب</span> <button type="button" class="btn sm primary" data-act="cloudPw" data-k="${k}" data-id="${esc(id)}">إنشاء حساب</button>`;
  }
  const needLogin = k => CLOUD ? (W_KINDS.includes(k) ? [k] : W_KINDS).flatMap(x => (db[x] || []).filter(m => !m.hasLogin)) : [];
  const ADD = { supervisors: ['addMember', 'مشرف'], placeadmins: ['addMember', 'إداري'], accountants: ['addMember', 'محاسب'] };
  function workersView() {
    const t = document.createElement('template'); t.innerHTML = baseWorkers();
    const C = t.content, sel = C.querySelector('select[data-stfk]');
    const k = sel?.querySelector('option[selected]')?.value || '';
    const bar = C.querySelector('.card > .bar');
    if (bar) {
      bar.querySelector('[data-act="tab"][data-v="members"]')?.remove();
      const add = bar.querySelector('[data-act="addTeacher"]');
      if (add && ADD[k]) { add.dataset.act = ADD[k][0]; add.dataset.k = k; add.textContent = '+ ' + ADD[k][1]; }
      const need = needLogin(k).length;
      const tools = (need ? `<button type="button" class="btn" data-wmk="${esc(k)}">إنشاء الحسابات الناقصة (${need})</button>` : '')
        + (CLOUD && W_KINDS.includes(k) ? `<button type="button" class="btn" data-act="credsOpen" data-k="${k}">إرسال بيانات الدخول</button>` : '')
        + (!k || k === 'teachers' ? '<button type="button" class="btn" data-act="importMembers" data-k="teachers">استيراد</button>' : '')
        + '<button type="button" class="btn" data-act="dupOpen">الأسماء المتشابهة</button>';
      if (add) add.insertAdjacentHTML('beforebegin', tools); else bar.insertAdjacentHTML('beforeend', tools);
    }
    if (k === 'un') {
      /* «غير مصنف»: أداة التصنيف من القائمة نفسها، ومعها المصنفون بمسميات أخرى (من لا حساب له منهم لا يظهر في الجدول) */
      const keepM = ui.msub; let u = '', ti = '';
      try { ui.msub = 'unclassified'; u = baseMem(); ui.msub = 'titled'; ti = baseMem(); } finally { ui.msub = keepM; }
      u = u.replace(MSEL, ''); const i = u.indexOf(NOHAL); if (i > -1) u = u.slice(0, i) + u.slice(u.lastIndexOf('</div>'));
      ti = ti.includes('موظفو المرتبات المصنفون بمسميات') ? ti.replace(MSEL, '<h2 class="grow" style="margin:0">مصنّفون بمسميات أخرى</h2>') : '';
      return `<div class="card">${bar ? bar.outerHTML : ''}</div>` + u + ti;
    }
    const tbl = C.querySelector('.tbl table');
    if (tbl) {
      const head = tbl.rows[0], ths = [...head.cells];
      const drop = ths.findIndex(c => c.textContent.trim() === 'الوظيفة في المرتبات');
      if (drop > -1) [...tbl.rows].forEach(r => r.cells[drop]?.remove());
      const lastTh = head.cells[head.cells.length - 1]; lastTh.insertAdjacentHTML('beforebegin', '<th>الحساب</th>');
      tbl.querySelectorAll('tr[data-stk]').forEach(r => r.cells[r.cells.length - 1].insertAdjacentHTML('beforebegin', `<td>${wAccCell(r.dataset.stk)}</td>`));
    }
    const note = C.querySelector('.card > .note');
    if (note) note.textContent = 'كل العاملين في مكان واحد: الصفة، والحلقات أو النطاق، والحالة، وحساب الدخول. «الملف» يعرض البيانات والمرتب والغياب، وفيه تعديل الاسم والنطاق والحذف. تعديل الاسم من أي مكان يسري على الحساب والمرتبات معًا.';
    return t.innerHTML;
  }
  adminViews.teachers = workersView;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wmk]'); if (!b || session?.role !== 'admin') return;
    const list = needLogin(b.dataset.wmk);
    if (!list.length) { toast('كل العاملين لهم حسابات'); return; }
    ask(`إنشاء حسابات دخول لـ ${list.length} من العاملين؟ ستظهر كلمات المرور مرة واحدة لتسليمها.`, () => { if (typeof cloudMakeLogins === 'function') cloudMakeLogins(list); });
  });
  /* «حذف» في ملف العامل (كان حذفًا جماعيًا في «الحسابات») */
  let wCardKey = '';
  document.addEventListener('click', e => { const b = e.target.closest('[data-staff]'); if (b) wCardKey = b.dataset.staff; }, true);
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-staff]') || session?.role !== 'admin') return;
    const [k, id] = splitKey(wCardKey); if (!W_KINDS.includes(k) && k !== 'admins') return;
    const row = [...document.querySelectorAll('.overlay[data-staffcard] .row')].pop();
    if (row && !row.querySelector('[data-act="delMember"]')) row.insertAdjacentHTML('beforeend', `<button type="button" class="btn danger" data-act="delMember" data-id="${esc(id)}" data-k="${k}">حذف</button>`);
  });
  /* «الإعدادات ← حسابات المديرين» */
  adminViews.members = () => {
    if (!isSet(ui.msub)) { ui.msub = 'admins'; saveTab(); }
    return baseMem().replace(MSEL, '<h2 class="grow" style="margin:0">حسابات المديرين</h2>');
  };
  /* «الطلاب ← الحسابات» و«الطلاب ← بلا حلقة»: من قائمة الأعضاء نفسها */
  const stuAccView = () => { ui.msub = 'students'; return baseMem().replace(MSEL, '<h2 class="grow" style="margin:0">حسابات الطلاب</h2>'); };
  const noHalView = () => {
    const keepM = ui.msub; ui.msub = 'unclassified';
    let h; try { h = baseMem(); } finally { ui.msub = keepM; }
    const i = h.indexOf(NOHAL);
    return i > -1 ? '<div class="memview">' + h.slice(i) : `<div class="card">${empty('لا يوجد طلاب بلا حلقة ✓')}</div>`;
  };
  const stuBase = adminViews.students;   // «كل الطلاب» (بعد staff.js وcascade.js، وقبل شريط mine.js)
  /* زر «حسابات الدخول» في صفحة العاملين (data-v="members") يفتح حسابات العاملين */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="tab"][data-v="members"]');
    if (b && session?.role === 'admin' && ui.tab === 'teachers' && !isStaff(ui.msub)) ui.msub = 'staff';
  }, true);
  /* ترتيب الشريط الجانبي وعناوين مجموعاته */
  const ORDER = [['dash'], ['students', 'التعليم'], ['teachers'], ['halaqat'], ['news', 'التواصل'], ['settings', 'النظام']];
  /* أقسام صارت تبويبات في «الطلاب» (data-svw): لا تظهر في الشريط الجانبي، وأزرارها القديمة تفتح «الطلاب» عليها */
  const STU_TABS = ['att', 'fees', 'tcollect'];
  const tcollectN = () => (db.collections || []).filter(c => c.status === 'sent').length;
  const OWNER = {}; Object.entries(GROUPS).forEach(([g, subs]) => subs.forEach(([k]) => { OWNER[k] = g; }));
  const sub = {}; try { Object.assign(sub, JSON.parse(sessionStorage.getItem('halaqat_sub') || '{}')); } catch (e) { /* ignore */ }
  const saveSub = () => { try { sessionStorage.setItem('halaqat_sub', JSON.stringify(sub)); } catch (e) { /* ignore */ } };

  /* «الاشتراكات» بلا بحث تعرض حتى 300 طالب دفعة واحدة؛ على الهاتف تكفي 60 حتى يُطلب المزيد (البحث يضيّقها) */
  let feesAll = false, feesN = -1;
  const capFees = feesBase => () => {
    const h = feesBase(), cap = matchMedia('(max-width:860px)').matches ? 60 : 300;
    const i = h.indexOf('<div class="tbl"><table>'), end = i < 0 ? -1 : h.indexOf('</table>', i);
    if (end < 0 || h.indexOf('<div class="tbl"><table>', end) > -1) return h; // العرض المجمّع بالحلقات يبقى كما هو
    const parts = h.slice(i, end).split('<tr>'), N = parts.length - 2;
    if (N !== feesN) { feesAll = false; feesN = N; }
    if (feesAll || N <= cap) return h;
    return h.slice(0, i) + parts.slice(0, 2 + cap).join('<tr>') + '</table></div>'
      + `<p class="muted" style="margin:.6rem 0 0">يظهر أول ${cap} طالبًا. اكتب في مربعات البحث للتضييق، أو <button type="button" class="btn sm" data-feesall>عرض المزيد</button></p>`
      + h.slice(h.indexOf('</div>', end) + 6);
  };
  if (adminViews.fees) adminViews.fees = capFees(adminViews.fees);
  /* والمحاسب كذلك: «الاشتراكات» صفحته الأولى */
  if (VIEWS.accountant?.fees) VIEWS.accountant.fees = capFees(VIEWS.accountant.fees);
  document.addEventListener('click', e => { if (e.target.closest('[data-feesall]')) { feesAll = true; render(); } });
  /* القسم الجامع يعرض شريط تبويباته ثم محتوى التبويب المختار (بالدالة الأصلية لكل قسم) */
  const ORIG = {};
  Object.entries(GROUPS).forEach(([g, subs]) => {
    subs.forEach(([k]) => { ORIG[k] = adminViews[k]; });
    adminViews[g] = () => {
      const vis = subs.filter(([, , show]) => !show || show());
      const cur = vis.some(([k]) => k === sub[g]) ? sub[g] : vis[0][0];
      const cnt = k => k === 'pending' ? (db.pending || []).length : k === 'tcollect' ? (db.collections || []).filter(c => c.status === 'sent').length : k === 'dups' ? dupsN() : 0;
      const bar = `<div class="card subnav"><div class="bar" style="margin:0">${vis.map(([k, l]) => `<button type="button" class="btn ${k === cur ? 'on' : ''}" data-subtab="${k}" data-g="${g}">${l}${cnt(k) ? ` <span class="count">${cnt(k)}</span>` : ''}</button>`).join('')}</div></div>`;
      const fn = ORIG[cur] || adminViews[cur];
      return bar + (fn ? fn() : empty('هذا القسم غير محمّل.'));
    };
  });
  /* أقسام الشريط الجانبي الجديدة */
  const keep = new Map(TABS.admin.map(t => [t[0], t[1]]));
  keep.set('teachers', 'العاملون'); keep.set('settings', 'الإعدادات');
  /* التبويب الفعلي المعروض الآن (داخل القسم الجامع)، لمن يحتاج معرفته: pager.js وfixpay.js… */
  const curSub = g => { const subs = GROUPS[g]; if (!subs) return g; const vis = subs.filter(([, , show]) => !show || show()); return vis.some(([k]) => k === sub[g]) ? sub[g] : vis[0][0]; };
  window.QLView = () => (session?.role !== 'admin' ? ui.tab : GROUPS[ui.tab] ? curSub(ui.tab) : ui.tab === 'students' && STU_TABS.includes(ui.svw) ? ui.svw : ui.tab);
  TABS.admin.splice(0, TABS.admin.length, ...ORDER.filter(([k]) => keep.has(k)).map(([k]) => [k, keep.get(k)]),
    /* أي قسم أضافه ملف آخر ولم يُذكر هنا يبقى في آخر القائمة */
    ...[...keep.keys()].filter(k => !ORDER.some(o => o[0] === k) && !OWNER[k] && !STU_TABS.includes(k)).map(k => [k, keep.get(k)]));

  /* «تحصيل المعلمين» لا عمود فيه للمكان، فاسم الحلقة فيه بمكانها (كما كان قسمًا مستقلًا) */
  const baseLabel = halaqaLabel;
  /* (وعمومًا: داخل قسم جامع تُسمّى الحلقات كما في تبويبها الأصلي) */
  halaqaLabel = function (h) {
    const g = ui.tab, v = session?.role === 'admin' ? window.QLView() : g;
    if (v === g) return baseLabel(h);
    ui.tab = v; try { return baseLabel(h); } finally { ui.tab = g; }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-subtab]'); if (!b) return;
    sub[b.dataset.g] = b.dataset.subtab; saveSub(); render(); window.scrollTo(0, 0);
  });

  /* عناوين المجموعات في الشريط الجانبي، وعدّاد البيانات المعلّقة والتحصيل على القسم الجامع */
  const css = document.createElement('style');
  css.textContent = `.side .navgrp{font-size:.72rem;font-weight:700;letter-spacing:.02em;opacity:.55;padding:.7rem .8rem .15rem;color:var(--on-navy)}
    .shell.collapsed .side .navgrp{font-size:0;padding:.35rem 0;border-top:1px solid rgba(255,255,255,.14);margin:0 .6rem}
    .subnav{padding:.55rem .7rem;margin-bottom:.8rem}.subnav .btn{white-space:nowrap}`;
  document.head.appendChild(css);
  /* ===== القائمة الجانبية: ترتيب واحد وعناوين واحدة لكل الفئات، وكل فئة ترى المتاح لها فقط =====
     الأقسام المتقابلة متجاورة (طلاب المدير وطلاب المعلم، التحصيل وتحصيل المعلمين…)، والصفحة التي
     تفتح عند الدخول تبقى كما هي لكل فئة (الحضور للمعلم والمشرف، والاشتراكات للمحاسب…). */
  const MASTER = [['dash'], ['me'], ['members'],
    ['students', 'التعليم'], ['mine', 'التعليم'], ['teachers', 'التعليم'], ['halaqat', 'التعليم'], ['att', 'التعليم'], ['hist', 'التعليم'], ['absence', 'التعليم'],
    ['fees', 'المالية'], ['tcollect', 'المالية'], ['collect', 'المالية'], ['payroll', 'المالية'],
    ['news', 'التواصل'], ['notes', 'التواصل'],
    ['settings', 'النظام'], ['preview', 'النظام'],
    ['profile', 'حسابي']];
  const MI = new Map(MASTER.map(([k], i) => [k, i])), GRP = new Map(MASTER.map(([k, g]) => [k, g || '']));
  const HOME = {};
  function unifyTabs() {
    Object.entries(TABS).forEach(([role, list]) => {
      if (!HOME[role] && list[0]) HOME[role] = list[0][0];
      const pos = new Map(list.map((t, i) => [t, i]));
      list.sort((a, b) => (MI.has(a[0]) ? MI.get(a[0]) : 900 + pos.get(a)) - (MI.has(b[0]) ? MI.get(b[0]) : 900 + pos.get(b)));
    });
  }
  function decorate() {
    if (!session) return;
    const nav = document.querySelector('.side nav.tabs'); if (!nav || nav.querySelector('.navgrp')) return;
    let last = '';
    const btns = [...nav.querySelectorAll(':scope > button[data-v]')];
    btns.forEach((b, i) => {
      const g = GRP.get(b.dataset.v) || '';
      /* عنوان المجموعة لا يُكرَّر إن كان قسمها الوحيد بالاسم نفسه («المالية») */
      const alone = (GRP.get(btns[i + 1]?.dataset.v) || '') !== g && b.textContent.trim().startsWith(g);
      if (g && g !== last && !alone) b.insertAdjacentHTML('beforebegin', `<div class="navgrp">${g}</div>`);
      else if (g && g !== last && alone && i) b.insertAdjacentHTML('beforebegin', '<div class="navgrp" aria-hidden="true"></div>');
      last = g;
    });
    if (session.role !== 'admin') return;
    const badge = (k, n) => { const b = nav.querySelector(`button[data-v="${k}"]`); if (b && n && !b.querySelector('.count')) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`); };
    badge('settings', (db.pending || []).length + dupsN());
    badge('students', tcollectN());
  }

  /* ===== سرعة الانتقال بين الأقسام =====
     تثبيت رؤوس الجداول كان يقيس كل جدول ثم يعدّله واحدًا بعد الآخر، فيعيد المتصفح حساب الصفحة كلها مرة لكل جدول
     (في «الأماكن والحلقات» 22 جدولًا ← أكثر من ثانية على الهاتف). صار: كل القياسات أولًا ثم كل التعديلات،
     والجداول القصيرة (أقل من 12 صفًا) لا تحتاج تثبيتًا أصلًا. */
  const LEAD = new Set(['', '#', 'م', 'الكود', 'مسلسل']);
  function fastFreeze() {
    const jobs = [];
    document.querySelectorAll('main .tbl table').forEach(tbl => {
      if (tbl.rows.length < 12) return;
      const { rows, grid, H } = tableGrid(tbl);
      if (!H || H >= rows.length || !grid[H]) return;
      jobs.push({ tbl, rows, grid, H });
    });
    /* القياس: مرة واحدة لكل الجداول */
    jobs.forEach(j => {
      j.w = j.grid[j.H].map(x => x?.td.offsetWidth || 0);
      j.h = j.rows.slice(0, j.H).map(r => r.offsetHeight);
      j.sig = j.rows.length + ':' + j.w.join(',') + ':' + j.h.join(',');
    });
    /* التعديل: بلا أي قياس بينها */
    jobs.forEach(({ tbl, rows, grid, H, w, h, sig }) => {
      if (tbl._frz === sig) return;
      tbl._frz = sig; tbl.classList.add('frz');
      let n = 0; while (n < 3 && grid[0][n] && LEAD.has(grid[0][n].td.textContent.trim())) n++;
      n = Math.min(n + 1, grid[H].length - 1);
      const off = [0]; for (let c = 0; c < n; c++) off.push(off[c] + (grid[H][c]?.cs === 1 ? w[c] : 0));
      let top = 0;
      rows.forEach((tr, ri) => {
        [...tr.cells].forEach(td => { td.classList.remove('stk-h', 'stk-hl', 'stk-c'); td.style.top = td.style.right = ''; });
        if (ri < H) { [...tr.cells].forEach(td => { td.classList.add('stk-h'); td.style.top = top + 'px'; if (ri + (td.rowSpan || 1) >= H) td.classList.add('stk-hl'); }); top += h[ri]; }
      });
      grid.forEach(r => r.forEach(x => { if (x?.first && x.c0 + x.cs <= n) { x.td.classList.add('stk-c'); x.td.style.right = off[x.c0] + 'px'; } }));
    });
  }
  /* ===== كلمة «حلقة» قبل اسم الحلقة في كبسولة، في كل التطبيق =====
     تُلفّ الكلمة فقط حين يليها اسم معلم (أو «بلا معلم»)، فلا تتأثر الجمل مثل «15 حلقة» أو «الحلقة».
     النص نفسه لا يتغير (البحث والتصدير والطباعة كما هي)، والقوائم المنسدلة الأصلية تبقى نصًا. */
  const pcss = document.createElement('style');
  pcss.textContent = `.hpill{display:inline-block;font-size:.78em;line-height:1.55;padding:0 .5em;border-radius:999px;background:color-mix(in srgb,var(--navy,#13294b) 11%,transparent);color:var(--navy,#13294b);font-weight:700;vertical-align:.06em;white-space:nowrap}
    .side .hpill,.pvtop .hpill{background:rgba(255,255,255,.18);color:inherit}
    .hpill.ppill{background:color-mix(in srgb,var(--gold,#b08a3e) 20%,transparent);color:#6b4f12;margin-inline-start:.15em}`;
  document.head.appendChild(pcss);
  let pillRe = null, pillKey = null; // null: لم يُبنَ بعد (حتى لو لم يوجد معلمون)
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function pillRegex() {
    const names = [...new Set((db.teachers || []).map(t => (t.name || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const key = names.join('|');
    if (key !== pillKey) { pillKey = key; pillRe = new RegExp(`(^|[^\\u0600-\\u06FF])(حلقة)(?= (?:${names.map(escRe).join('|')}${names.length ? '|' : ''}بلا معلم))`, 'g'); }
    return pillRe;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT', 'INPUT', 'TITLE']);
  function pillify(root) {
    if (!root || !session) return;
    const re = pillRegex(), nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.includes('حلقة') && n.parentNode && !SKIP.has(n.parentNode.nodeName) && !n.parentNode.closest?.('.hpill,svg') ? 1 : 2) });
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      re.lastIndex = 0; if (!re.test(n.data)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(n.data))) {
        const at = m.index + m[1].length;
        frag.append(n.data.slice(last, at));
        const sp = document.createElement('span'); sp.className = 'hpill'; sp.textContent = 'حلقة'; frag.append(sp);
        last = at + 4;
      }
      frag.append(n.data.slice(last)); n.replaceWith(frag);
    });
    placeify(root);
  }
  /* للمعلم أكثر من حلقة في أماكن مختلفة: «حلقة فلان — المكان» ← اسم المكان في كبسولة بجانب الاسم */
  let plRe = null, plKey = null;
  function placeRegex() {
    const names = [...new Set((db.places || []).map(p => (p.name || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const key = names.join('|');
    if (key !== plKey) { plKey = key; plRe = names.length ? new RegExp(`^([^—]*?) — (${names.map(escRe).join('|')})(?=$| ·|[^\\u0600-\\u06FF])`) : null; }
    return plRe;
  }
  function placeify(root) {
    const re = placeRegex(); if (!re || !root.querySelectorAll) return;
    root.querySelectorAll('.hpill').forEach(p => {
      const n = p.nextSibling; if (!n || n.nodeType !== 3 || !n.data.includes(' — ')) return;
      const m = re.exec(n.data); if (!m) return;
      const sp = document.createElement('span'); sp.className = 'hpill ppill'; sp.textContent = m[2];
      const rest = n.data.slice(m[0].length);
      n.replaceWith(document.createTextNode(m[1] + ' '), sp, ...(rest ? [document.createTextNode(rest)] : []));
    });
  }
  window.QLPill = pillify;
  let pillQ = new Set(), pillRaf = 0;
  new MutationObserver(ms => {
    ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList?.contains('hpill')) pillQ.add(n); else if (n.nodeType === 3 && n.parentNode) pillQ.add(n.parentNode); }));
    if (pillQ.size && !pillRaf) pillRaf = requestAnimationFrame(() => { const q = [...pillQ]; pillQ = new Set(); pillRaf = 0; q.forEach(el => { if (el.isConnected) pillify(el); }); });
  }).observe(document.body, { childList: true, subtree: true });
  /* ===== اسم التطبيق تحت الشعار في صفحة الدخول (من «الإعدادات ← اسم المؤسسة») ===== */
  const baseLogin = loginView;
  loginView = function () {
    const name = (db.settings?.org || '').trim() || 'إدارة الحلقات القرآنية';
    return baseLogin.apply(this, arguments).replace('<div class="card loginform">', `<h1 class="appname">${esc(name)}</h1><div class="card loginform">`);
  };
  /* «الطلاب»: قائمتا «المكان» و«الحلقة» (البحث المتتابع) بجانب بعضهما في سطر واحد، على الحاسوب والجوال */
  const fcss = document.createElement('style');
  fcss.textContent = `main .card > .bar:has(> .qcombo > [data-fplace])::after{content:'';flex-basis:100%;height:0;order:2}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .btn,main .card > .bar:has(> .qcombo > [data-fplace]) > button{order:1}
    main .card > .bar:has(> .qcombo > [data-fplace]) > select,main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo{order:3}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo{flex:1 1 0;min-width:0;width:auto;max-width:none;margin:0}
    main .card > .bar:has(> .qcombo > [data-fplace]) > .qcombo .qcombo-in{min-width:0;width:100%;text-overflow:ellipsis}
    main .card > .bar:has(> .qcombo > [data-fplace]) > select{flex:none;width:auto}
    @media (max-width:600px){main .card > .bar:has(> .qcombo > [data-fplace])::before{content:'';flex-basis:100%;height:0;order:4}
      main .card > .bar:has(> .qcombo > [data-fplace]) > select{order:5}}`;
  document.head.appendChild(fcss);
  const lcss = document.createElement('style');
  lcss.textContent = `.login .logo-wrap{margin-bottom:.6rem}.login .appname{text-align:center;margin:0 0 1.1rem;font-size:clamp(1.25rem,5vw,1.6rem);font-weight:800;color:var(--navy,#13294b);letter-spacing:.01em}`;
  document.head.appendChild(lcss);
  /* ===== التكبير والتصغير في كل جدول، لكل الفئات =====
     جداول الصفحات لها أزرار الحجم من قبل (tables.js)؛ وهنا تُضاف لجداول النوافذ المنبثقة (طلاب الحلقة، بطاقة الموظف، السجل…)
     ولجداول «المعاينة». الحجم واحد لكل الجداول ويُحفظ على الجهاز. */
  const zcss = document.createElement('style');
  zcss.textContent = `.overlay .tbl table{font-size:calc(.95rem * var(--tz,1))}.ztools{display:flex;justify-content:flex-end;gap:.3rem;margin:.2rem 0 .35rem}
    .ztools .btn{width:auto;min-width:34px;padding:0 .45rem;font-weight:700;font-size:.85rem}
    .tzoom .btn,.ztools .btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
    @media (max-width:860px),(pointer:coarse){.tblprint .tzoom .btn,.ztools .btn{min-width:44px;min-height:40px;font-size:1rem}}`;
  document.head.appendChild(zcss);
  const zBar = (attr, label) => `<div class="ztools noprint"><button type="button" class="btn sm" ${attr}="-1" title="تصغير النص" aria-label="تصغير النص">أ−</button><button type="button" class="btn sm" ${attr}="0" ${attr === 'data-tz' ? 'data-tzv' : 'data-pvtzv'} title="الحجم الأصلي" aria-label="الحجم الأصلي">${label}</button><button type="button" class="btn sm" ${attr}="1" title="تكبير النص" aria-label="تكبير النص">أ+</button></div>`;
  const zPct = () => Math.round((+getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1) * 100) + '%';
  function zoomify(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('.overlay .tbl:not([data-zm])').forEach(t => {
      if (!t.querySelector('table td')) return;
      t.dataset.zm = '1'; t.insertAdjacentHTML('beforebegin', zBar('data-tz', zPct()));
    });
  }
  new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.classList?.contains('overlay') || n.closest?.('.overlay'))))) requestAnimationFrame(() => zoomify(document)); })
    .observe(document.body, { childList: true, subtree: true });
  /* المعاينة: الإطار صفحة مستقلة؛ تُلفّ كلماته، وتوضع أزرار الحجم فوق جداوله (تكبير داخل الإطار وحده) */
  document.addEventListener('load', e => {
    const f = e.target; if (!f?.classList?.contains('pvif')) return;
    try {
      const d = f.contentDocument; pillify(d.body);
      const cur = () => +d.documentElement.style.getPropertyValue('--tz') || 1;
      d.querySelectorAll('main .tbl').forEach(t => { if (t.querySelector('table td')) t.insertAdjacentHTML('beforebegin', zBar('data-pvtz', Math.round(cur() * 100) + '%')); });
      d.addEventListener('click', ev => {
        const b = ev.target.closest('[data-pvtz]'); if (!b) return;
        const k = +b.dataset.pvtz, z = k ? Math.min(1.8, Math.max(0.7, Math.round((cur() + k * 0.1) * 10) / 10)) : 1;
        d.documentElement.style.setProperty('--tz', z); d.querySelectorAll('[data-pvtzv]').forEach(x => { x.textContent = Math.round(z * 100) + '%'; });
      });
      d.head.insertAdjacentHTML('beforeend', '<style>main [data-pvtz]{pointer-events:auto!important;opacity:1!important}</style>');
    } catch (err) { /* ignore */ }
  }, true);
  /* ===== النوافذ المنبثقة: تمرير لطيف داخل النافذة، ورأس ثابت فيه زر إغلاق ×، وأزرار الحفظ ثابتة أسفلها =====
     - التمرير داخل النافذة وحدها (لا تتحرك الصفحة خلفها ولا «يهرب» التمرير إليها)، والجدول العريض يُمرَّر أفقيًا داخل إطاره.
     - لا تمرير داخل تمرير: الجداول داخل النافذة تأخذ طولها كاملًا وتتمرر مع النافذة.
     - × يغلق النافذة (بزر «إلغاء/إغلاق» نفسه إن وُجد)، ومفتاح Esc كذلك على الحاسوب. */
  const mcss = document.createElement('style');
  mcss.textContent = `html.ql-modal,html.ql-modal body{overflow:hidden}
    .overlay{overscroll-behavior:contain;padding:max(.75rem,env(safe-area-inset-top)) .75rem max(.75rem,env(safe-area-inset-bottom))}
    .modal{max-height:88vh;max-height:88dvh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scroll-padding-top:4rem}
    .modal .tbl{max-height:none!important;overflow-x:auto;overflow-y:visible!important;max-width:100%;border-radius:10px}
    .modal .tbl table{width:max-content;min-width:100%}.modal .tbl th,.modal .tbl td{white-space:nowrap}
    .modal .mhead{position:sticky;top:-1.1rem;z-index:3;display:flex;align-items:center;gap:.6rem;margin:-1.1rem -1.1rem .7rem;padding:.75rem 1.1rem .65rem;background:#fff;border-bottom:1px solid var(--line,#e5e7eb);border-radius:20px 20px 0 0}
    .modal .mhead h2{margin:0;flex:1;min-width:0;font-size:1.12rem;line-height:1.4}
    .modal .mclose{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);color:var(--navy,#13294b);font-size:1.45rem;line-height:1;display:grid;place-items:center;cursor:pointer;padding:0;touch-action:manipulation}
    .modal .mclose:hover{background:var(--navy-l,#eaeef5)}
    .modal > .row:last-child{position:sticky;bottom:-1.1rem;z-index:3;margin:.9rem -1.1rem -1.1rem;padding:.7rem 1.1rem;background:#fff;border-top:1px solid var(--line,#e5e7eb);border-radius:0 0 20px 20px}
    @media (max-width:600px){.overlay{align-items:flex-end;padding-bottom:0}.modal{max-width:100%!important;border-radius:20px 20px 0 0;max-height:92dvh}.modal > .row:last-child{border-radius:0;padding-bottom:max(.7rem,env(safe-area-inset-bottom))}}
    @media print{.modal .mclose{display:none}.modal .mhead,.modal > .row:last-child{position:static;border:0;background:none}}`;
  document.head.appendChild(mcss);
  function dressModal(ov) {
    const m = ov.querySelector(':scope > .modal'); if (!m || m.querySelector(':scope > .mhead')) return;
    const head = document.createElement('div'); head.className = 'mhead';
    const h = m.firstElementChild?.tagName === 'H2' ? m.firstElementChild : null;
    if (h) head.appendChild(h);
    else head.style.cssText = 'justify-content:flex-end;border-bottom:0;padding-bottom:0;margin-bottom:.2rem';
    head.insertAdjacentHTML('beforeend', '<button type="button" class="mclose noprint" aria-label="إغلاق" title="إغلاق">×</button>');
    m.prepend(head);
  }
  const closeTop = () => {
    const ov = [...document.querySelectorAll('.overlay')].pop(); if (!ov) return false;
    const c = ov.querySelector('.modal > .row:last-child [data-close], .modal [data-close]');
    if (c) c.click(); else ov.remove();
    return true;
  };
  document.addEventListener('click', e => { if (e.target.closest('.mclose')) { e.preventDefault(); closeTop(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.overlay')) { e.preventDefault(); closeTop(); } });
  new MutationObserver(() => {
    const ovs = document.querySelectorAll('.overlay');
    document.documentElement.classList.toggle('ql-modal', ovs.length > 0);
    ovs.forEach(dressModal);
  }).observe(document.body, { childList: true });
  /* ===== زر الرجوع (في الجوال والمتصفح) يرجع للسابق بدل الخروج من التطبيق =====
     - كل انتقال بين الأقسام (والتبويبات الداخلية وفئات الأعضاء) يُسجَّل خطوةً في سجل المتصفح.
     - النافذة المنبثقة والقائمة الجانبية على الجوال «طبقة»: الرجوع يغلقها أولًا.
     - في الصفحة الأولى: «اضغط رجوع مرة أخرى للخروج»، والضغطة الثانية خلال ثانيتين تخرج. */
  const NAV = { restoring: false, closing: false, skip: 0, lastBack: 0, booted: false };
  const navKey = () => JSON.stringify({ t: ui.tab, m: ui.msub || '', s: sub });
  const navState = extra => ({ ql: 1, k: navKey(), tab: ui.tab, msub: ui.msub, sub: { ...sub }, ...extra });
  const layerOpen = () => !!(document.querySelector('.overlay') || document.querySelector('.shell.open'));
  const popLayer = () => { if (history.state?.layer) { NAV.skip++; history.back(); } };
  function afterRender() {
    if (!session) return;
    if (!NAV.booted) { NAV.booted = true; history.replaceState(navState({ guard: true }), ''); history.pushState(navState(), ''); return; }
    if (NAV.restoring) { NAV.restoring = false; return; }
    const st = history.state;
    if (st?.layer && !layerOpen()) { history.replaceState(navState(), ''); return; } // طبقة أُغلقت بالانتقال نفسه
    if (st?.ql && !st.layer && !st.guard && st.k !== navKey()) history.pushState(navState(), '');
  }
  window.addEventListener('popstate', e => {
    if (!session) return;
    if (NAV.skip) { NAV.skip--; return; }
    const shell = document.querySelector('.shell.open');
    if (shell) { ui.nav = false; shell.classList.remove('open'); return; }
    const ovs = document.querySelectorAll('.overlay');
    if (ovs.length) { NAV.closing = true; ovs[ovs.length - 1].remove(); setTimeout(() => { NAV.closing = false; }, 0); return; }
    const s = e.state; if (!s?.ql) return;
    if (s.guard) {
      if (Date.now() - NAV.lastBack < 2000) { history.back(); return; }
      NAV.lastBack = Date.now(); toast('اضغط رجوع مرة أخرى للخروج'); history.pushState(navState(), ''); return;
    }
    NAV.restoring = true;
    ui.tab = s.tab; ui.msub = s.msub; ui.nav = false;
    Object.keys(sub).forEach(k => delete sub[k]); Object.assign(sub, s.sub || {}); saveSub(); saveTab();
    render(); window.scrollTo(0, 0);
  });
  /* فتح نافذة منبثقة يضيف طبقة؛ وإغلاقها بزرّها (لا بالرجوع) يسحب طبقتها من السجل */
  new MutationObserver(ms => {
    if (!session || !NAV.booted) return;
    ms.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay') && !NAV.closing) history.pushState(navState({ layer: true }), ''); });
      m.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay') && !NAV.closing) popLayer(); });
    });
  }).observe(document.body, { childList: true });

  /* بعد تحميل كل الملفات (ومنها app-actions.js)، لا بمؤقّت: على الشبكات البطيئة قد يسبق المؤقّتُ تحميلَ الملف التالي */
  document.addEventListener('DOMContentLoaded', () => {
    /* القائمة الجانبية على الجوال طبقة كذلك */
    const baseToggle = A.navToggle, baseClose = A.navClose;
    if (baseToggle) A.navToggle = d => { const was = ui.nav; baseToggle(d); if (!was && ui.nav) history.pushState(navState({ layer: true }), ''); else if (was && !ui.nav) popLayer(); };
    if (baseClose) A.navClose = d => { const was = ui.nav; baseClose(d); if (was) popLayer(); };
    if (typeof freezeTables === 'function' && typeof tableGrid === 'function') freezeTables = fastFreeze;
    /* «الطلاب»: الطلاب · الاشتراكات · تحصيل المعلمين · الحسابات (أزرارها data-svw يعالجها mine.js)، والتصفية تحدد عرض «الطلاب» */
    const stuFees = adminViews.fees, stuTcol = adminViews.tcollect, stuAtt = adminViews.att;
    const inPl = h => !ui.fp || (!!h && h.placeId === ui.fp);
    /* شريط التصفية نفسه (المكان ← الحلقة) لعرضي الحلقة و«بلا حلقة»، بالأسماء نفسها التي يعالجها cascade.js وapp-actions.js */
    const filters = () => {
      const places = db.places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const hs = db.halaqat.filter(inPl).sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
      const pSel = `<select data-fplace aria-label="المكان"><option value="">كل الأماكن</option>${places.map(p => `<option value="${esc(p.id)}" ${p.id === ui.fp ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
      const hSel = `<select data-change="fh" aria-label="الحلقة"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}${noHalN() ? `<option value="__none" ${ui.fh === '__none' ? 'selected' : ''}>بلا حلقة (${noHalN()})</option>` : ''}</select>`;
      return `<div class="card"><div class="bar" style="margin:0">${pSel}${hSel}</div></div>`;
    };
    const listView = () => {
      if (ui.fh === '__none') return noHalN() ? filters() + noHalView() : (ui.fh = '', stuBase());
      const h = ui.fh && byId(db.halaqat, ui.fh);
      if (h && adminViews.mine) {
        /* حلقة معينة: جدول الحلقة بأدواته، وعنوانه اسمها بدل قائمة اختيار الحلقة (فالتصفية فوقه تكفي) */
        ui.hid = h.id;
        const v = adminViews.mine().replace(/<label style="margin:0;flex:1 1 16rem;max-width:28rem">الحلقة[\s\S]*?<\/label>/, `<h2 class="grow" style="margin:0">${esc(halaqaLabel(h))}</h2>`);
        return filters() + v;
      }
      if (ui.fh) ui.fh = '';
      let html = stuBase().replace(/غير مصنف \(بلا حلقة\)/g, 'بلا حلقة');
      /* تنبيه بالطلاب بلا حلقة (وكانوا تبويبًا مستقلًا) */
      const n = noHalN();
      if (n) html = `<div class="note" style="margin:0 0 .8rem">${n} طالب بلا حلقة. <button type="button" class="btn sm" data-fhnone>عرضهم وتعيين حلقاتهم</button></div>` + html;
      return html;
    };
    adminViews.students = () => {
      /* الحضور يفتح على الحلقة نفسها المختارة في «الطلاب» (ui.hid مشترك بينهما) */
      const T = [['list', 'الطلاب'], ['att', 'الحضور'], ['fees', 'الاشتراكات'], ['tcollect', 'تحصيل المعلمين'], ['acc', 'الحسابات']];
      const cur = T.some(([k]) => k === ui.svw) ? ui.svw : 'list';
      const bar = `<div class="card subnav"><div class="bar" style="margin:0">${T.map(([k, l]) => `<button type="button" class="btn ${k === cur ? 'on' : ''}" data-svw="${k}">${l}${k === 'tcollect' && tcollectN() ? ` <span class="count">${tcollectN()}</span>` : ''}</button>`).join('')}</div></div>`;
      const fn = cur === 'acc' ? stuAccView : cur === 'att' ? stuAtt : cur === 'fees' ? stuFees : cur === 'tcollect' ? stuTcol : listView;
      return bar + (fn ? fn() : empty('هذا القسم غير محمّل.'));
    };
    document.addEventListener('click', e => { if (e.target.closest('[data-fhnone]')) { ui.svw = 'list'; ui.fh = '__none'; render(); window.scrollTo(0, 0); } });
    unifyTabs();
    const base = render;
    render = function () {
      /* «الأعضاء» القديم: فئات العاملين تفتح «العاملون ← الحسابات»، والطلاب «الطلاب ← الحسابات» أو «بلا حلقة» */
      if (session?.role === 'admin' && (ui.tab === 'accounts' || ui.tab === 'members' && isStaff(ui.msub))) {
        /* «الحسابات» القديم: «العاملون» على الفئة نفسها (وغير المصنفين بتصفية «غير مصنف») */
        wPendK = ui.msub === 'unclassified' || String(ui.msub).startsWith('t:') || ui.msub === 'titled' ? 'un' : W_KINDS.includes(ui.msub) ? ui.msub : null;
        sub.teachers = 'teachers'; saveSub(); ui.tab = 'teachers'; saveTab();
      }
      if (session?.role === 'admin' && ui.tab === 'members' && isStu(ui.msub)) { if (ui.msub === 'nohal') { ui.svw = 'list'; ui.fh = '__none'; } else ui.svw = 'acc'; ui.tab = 'students'; saveTab(); }
      /* «الحضور» و«الاشتراكات» و«تحصيل المعلمين» صارت تبويبات في «الطلاب» */
      if (session?.role === 'admin' && STU_TABS.includes(ui.tab)) { ui.svw = ui.tab; ui.tab = 'students'; saveTab(); }
      /* قسم صار تبويبًا: يُفتح القسم الجامع على هذا التبويب (قبل فحص صفحة البداية، وإلا أعاده إليها) */
      if (session?.role === 'admin' && OWNER[ui.tab] && OWNER[ui.tab] !== ui.tab) { sub[OWNER[ui.tab]] = ui.tab; saveSub(); ui.tab = OWNER[ui.tab]; saveTab(); }
      /* صفحة البداية لكل فئة كما كانت (لا أول القائمة بعد توحيد الترتيب) */
      if (session && TABS[session.role] && !TABS[session.role].some(t => t[0] === ui.tab) && HOME[session.role]) ui.tab = HOME[session.role];
      const r = base.apply(this, arguments);
      if (wPendK !== null) {
        const s = document.querySelector('main select[data-stfk]'), v = wPendK; wPendK = null;
        if (s && s.value !== v && [...s.options].some(o => o.value === v)) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      try { decorate(); } catch (err) { /* لا يعطّل العرض */ }
      try { afterRender(); } catch (err) { /* لا يعطّل العرض */ }
      return r;
    };
    if (session) render();
  });
})();
