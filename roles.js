'use strict';
/* ============ أنواع الحسابات المعتمدة ============
   - لا توجد «مسميات أخرى»: كل موظف في المرتبات يُصنَّف بنوع حساب معتمد:
     معلم، مشرف (ومنه «المشرف العام» الذي يرى كل الحلقات)، محاسب، إداري (في مكان)، مدير.
   - الإداري (placeadmin): يطّلع على حلقات أماكنه وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب (تبويب «التحصيل»).
   - النطاق يحدده المدير من «الأعضاء» بزر «النطاق»، ويُحفظ في info للعضو: scope = 'all' للمشرف العام، و places للإداري.
   - يحتاج على الخادم: supabase/roles.sql.
   يُحمَّل قبل app-actions.js؛ وما يستبدله من دوال app-actions يُطبَّق بعد تحميلها. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./roles.js')) VFILES.push('./roles.js'); } catch (e) { /* ignore */ } }, 0);
  /* النوع الجديد في ثوابت التطبيق */
  if (!ROLES.includes('placeadmin')) ROLES.splice(ROLES.indexOf('admin'), 0, 'placeadmin');
  ROLE_L.placeadmin = 'إداري'; COLL.placeadmin = 'placeadmins'; KIND_ONE.placeadmins = 'إداري'; AUD.placeadmin = 'الإداريون';
  ICONS.placeadmin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-5h6v5"/><path d="M10 11h4"/></svg>';
  if (!Array.isArray(db.placeadmins)) db.placeadmins = [];
  const baseMigrate = migrate;
  migrate = d => { const r = baseMigrate(d); if (!Array.isArray(r.placeadmins)) r.placeadmins = []; return r; };

  /* النطاق */
  const isGenSup = m => m?.info?.scope === 'all';
  const placesOf = m => (Array.isArray(m?.info?.places) ? m.info.places : []);
  window.isGenSup = isGenSup; window.placesOf = placesOf;
  const myHal = () => {
    if (session?.role === 'placeadmin') { const ps = new Set(placesOf(me())); return db.halaqat.filter(h => ps.has(h.placeId)); }
    if (session?.role === 'supervisor' && isGenSup(me())) return db.halaqat.slice();
    return myHalaqat();
  };
  window.QLMyHal = myHal;

  /* المشرف العام: الحضور والطلاب لكل الحلقات (نسخة صفحتي المعلم بنطاقه) */
  supervisorViews.att = () => {
    const hs = myHal();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد. تواصل مع الإدارة.')}</div>`;
    const picker = halaqaPicker(hs);
    const sts = db.students.filter(s => s.halaqaId === ui.hid);
    const rows = sts.map(s => {
      const cur = db.attendance.find(a => a.studentId === s.id && a.date === ui.date)?.status;
      return `<tr><td>${esc(s.name)}</td><td>${Object.entries(STATUS).map(([k, l]) => `<button class="btn sm ${cur === k ? 'on ' + k : ''}" data-act="att" data-sid="${s.id}" data-st="${k}">${l}</button>`).join(' ')}</td></tr>`;
    }).join('');
    return `<div class="card"><div class="bar">${picker}<input type="date" value="${ui.date}" data-change="date"></div>
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>الحالة</th></tr>${rows}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
  };
  supervisorViews.mine = () => {
    const hs = myHal();
    if (!hs.length) return `<div class="card">${empty('لم تُسنَد إليك حلقة بعد.')}</div>`;
    const sts = db.students.filter(s => s.halaqaId === ui.hid || (!hs.some(h => h.id === ui.hid) && s.halaqaId === hs[0].id));
    return `<div class="card"><div class="bar">${halaqaPicker(hs)}</div>
    ${sts.length ? `<div class="tbl"><table><tr><th>الطالب</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${sts.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td><td><button class="btn sm primary" data-act="rec" data-id="${s.id}">تسجيل تسميع</button><button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
  };

  /* ===== الإداري: الطلاب (اطلاع فقط) والتحصيل والإعلانات ===== */
  TABS.placeadmin = [['mine', 'الطلاب'], ['collect', 'التحصيل'], ['news', 'الإعلانات']];
  VIEWS.placeadmin = {
    mine() {
      const ps = placesOf(me()).map(id => byId(db.places, id)).filter(Boolean), hs = myHal();
      if (!ps.length) return `<div class="card">${empty('لم يُحدَّد لك مكان بعد. تواصل مع الإدارة.')}</div>`;
      if (!hs.length) return `<div class="card">${empty('لا توجد حلقات في ' + ps.map(p => p.name).join('، ') + ' بعد.')}</div>`;
      const picker = halaqaPicker(hs), h = byId(db.halaqat, ui.hid) || hs[0];
      const sts = db.students.filter(s => s.halaqaId === h.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const stats = [[ps.length, ps.length > 1 ? 'أماكن' : 'مكان'], [hs.length, 'حلقة'], [db.students.filter(s => hs.some(x => x.id === s.halaqaId)).length, 'طالب']];
      return `<div class="card"><h2 style="margin-top:0">${esc(ps.map(p => p.name).join('، '))}</h2><div class="grid">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div></div>
      <div class="card"><div class="bar">${picker}<span class="grow"></span><span class="muted">${esc(placeName(h))}${timeText(h) ? ' · ' + esc(timeText(h)) : ''}${h.supervisorId ? ' · المشرف: ' + esc(supName(h.supervisorId)) : ''}</span></div>
      ${sts.length ? `<div class="tbl"><table><tr><th>#</th><th>الطالب</th><th>آخر حفظ</th><th>الحضور</th><th></th></tr>${sts.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}${stOff(s) ? ' <span class="tag tag-no">منقطع</span>' : ''}</td><td>${esc(lastHifz(s.id))}</td><td>${attRate(s.id)}</td><td><button class="btn sm" data-act="hist" data-id="${s.id}">السجل</button><button class="btn sm" data-act="studentCard" data-id="${s.id}">الملف</button></td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب في هذه الحلقة.')}</div>`;
    },
    /* «التحصيل»: صفحة المعلم نفسها، على نسخ من حلقات أماكنه (بأسمائها كما هي) فتُرسل القائمة باسمه */
    collect: () => {
      if (!teacherViews.collect) return `<div class="card">${empty('ملف collect.js غير محمّل.')}</div>`;
      const real = db.halaqat, hs = myHal();
      if (!hs.length) return `<div class="card">${empty('لم يُحدَّد لك مكان فيه حلقات بعد. تواصل مع الإدارة.')}</div>`;
      db.halaqat = hs.map(h => ({ ...h, name: halaqaLabel(h), teacherId: session.id }));
      try { return teacherViews.collect(); } finally { db.halaqat = real; }
    },
    news: () => newsView('placeadmin')
  };

  /* ===== «الأعضاء»: فئة «الإداريون»، ونطاق المشرف والإداري، وقائمة «الموظفون» بالأنواع المعتمدة ===== */
  const css = document.createElement('style');
  css.textContent = '.memview .ttltag{display:none}'; // لا مسميات أخرى بجانب أسماء المحاسبين
  document.head.appendChild(css);
  const KINDS = [['teachers', 'المعلمون'], ['students', 'الطلاب'], ['supervisors', 'المشرفون'], ['accountants', 'المحاسبون'], ['placeadmins', 'الإداريون'], ['admins', 'المديرون']];
  const STAFF_KINDS = [['admins', 'مدير'], ['supervisors', 'مشرف'], ['teachers', 'معلم'], ['accountants', 'محاسب'], ['placeadmins', 'إداري']];
  const empOfMember = id => { const c = clsRead(); const eid = Object.keys(c).find(k => c[k]?.memberId === id); return eid ? payEmps().find(e => e.id === eid) : null; };
  const typeOf = (k, l, m) => k === 'supervisors' && isGenSup(m) ? 'مشرف عام' : l;
  const placeTxt = (k, m, emp) => k === 'placeadmins' ? (placesOf(m).map(id => byId(db.places, id)?.name).filter(Boolean).join('، ') || 'بلا مكان') : (emp?.place || '—');
  function staffList() {
    const out = [];
    STAFF_KINDS.forEach(([k, l], gi) => (db[k] || []).forEach(m => out.push({ m, k, gi, type: typeOf(k, l, m), emp: empOfMember(m.id) })));
    return out.sort((a, b) => a.gi - b.gi || String(a.type).localeCompare(String(b.type), 'ar') || a.m.name.localeCompare(b.m.name, 'ar'));
  }
  function picker(cur) {
    const opts = [['staff', 'الموظفون', staffList().length], ...KINDS.map(([k, l]) => [k, l, (db[k] || []).length]), ['unclassified', 'غير مصنف', unclassCount()]];
    const o = ([k, l, n]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(l)} (${n})</option>`;
    return `<select class="msubsel" data-msubsel aria-label="فئة الأعضاء">${opts.map(o).join('')}</select>`;
  }
  function staffBody() {
    const list = staffList();
    const acc = x => {
      if (!CLOUD) return '<span class="tag tag-ok">له حساب</span>';
      return x.m.hasLogin ? `<span class="tag tag-ok">متاح</span> <button type="button" class="btn sm" data-act="cloudPw" data-k="${x.k}" data-id="${esc(x.m.id)}">كلمة جديدة</button>`
        : `<span class="tag">بلا حساب</span> <button type="button" class="btn sm primary" data-act="cloudPw" data-k="${x.k}" data-id="${esc(x.m.id)}">إنشاء حساب</button>`;
    };
    const rows = list.map((x, i) => { const st = x.emp?.status === 'متوقف';
      return `<tr><td>${i + 1}</td><td>${esc(x.m.name)}${st ? ' <span class="tag tag-no">متوقف</span>' : ''}</td><td>${esc(x.type)}</td><td>${esc(x.emp?.role || '—')}</td><td>${esc(placeTxt(x.k, x.m, x.emp))}</td><td>${acc(x)}</td>
        <td>${x.k === 'supervisors' || x.k === 'placeadmins' ? `<button type="button" class="btn sm" data-act="memScope" data-id="${esc(x.m.id)}" data-k="${x.k}">النطاق</button>` : ''}<button type="button" class="btn sm" data-act="editName" data-id="${esc(x.m.id)}" data-k="${x.k}">الاسم</button></td></tr>`; }).join('');
    const cnt = k => list.filter(x => x.k === k).length;
    return `<div class="note">كل العاملين عدا الطلاب: ${cnt('admins')} مدير، ${cnt('supervisors')} مشرف، ${cnt('teachers')} معلم، ${cnt('accountants')} محاسب، ${cnt('placeadmins')} إداري. للإضافة والحذف والإجراءات الجماعية اختر الفئة من القائمة.</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الوظيفة في المرتبات</th><th>المكان</th><th>الحساب</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد موظفون بعد.')}`;
  }
  function withScope(h, kind) {
    if (kind !== 'supervisors' && kind !== 'placeadmins') return h;
    (db[kind] || []).forEach(m => {
      const tag = kind === 'supervisors' ? (isGenSup(m) ? ' <span class="tag tag-ok">مشرف عام</span>' : '') : ` <span class="tag ${placesOf(m).length ? '' : 'tag-no'}">${esc(placeTxt(kind, m))}</span>`;
      if (tag) h = h.replace(new RegExp(`(data-sel="${m.id}"[\\s\\S]*?<td>\\d+</td><td>[\\s\\S]*?)(</td>)`), (x, p1, p2) => p1 + tag + p2);
      const nb = `<button class="btn sm" data-act="editName" data-id="${m.id}" data-k="${kind}">`;
      h = h.split(nb).join(`<button class="btn sm" data-act="memScope" data-id="${m.id}" data-k="${kind}">النطاق</button>` + nb);
    });
    const tip = kind === 'supervisors' ? 'حدّد حلقات كل مشرف من «الأماكن والحلقات» ← تعديل ← المشرف، أو اجعله «مشرفًا عامًا» يرى كل الحلقات من زر «النطاق».' : 'حدّد مكان كل إداري من زر «النطاق»: يطّلع على حلقات المكان وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب.';
    return h.replace('<div class="note">', `<div class="note">${tip} `);
  }
  const SEL = /<select class="msubsel"[\s\S]*?<\/select>/;
  const baseMembers = adminViews.members;
  adminViews.members = () => {
    if (!ui.msub || ui.msub === 'titled' || String(ui.msub).startsWith('t:')) { ui.msub = 'staff'; saveTab(); }
    const cur = ui.msub;
    let h;
    if (cur === 'staff') {
      h = baseMembers();
      const i = h.indexOf('<div class="note">'), j = h.lastIndexOf('</div></div>');
      if (i > -1 && j > i) h = h.slice(0, i) + staffBody() + h.slice(j);
    } else if (cur === 'placeadmins') {
      /* قائمة الإداريين بقالب قائمة الأعضاء نفسه (أزرار الحساب والاسم والحذف والإضافة وإرسال بيانات الدخول) */
      const acc = db.accountants;
      db.accountants = db.placeadmins; ui.msub = 'accountants';
      try { h = baseMembers(); } finally { db.accountants = acc; ui.msub = 'placeadmins'; }
      h = h.split('data-k="accountants"').join('data-k="placeadmins"').split('>+ محاسب<').join('>+ إداري<');
    } else h = baseMembers();
    return withScope(h, cur).replace(SEL, picker(['unclassified', 'staff', ...KINDS.map(k => k[0])].includes(cur) ? cur : 'teachers'));
  };

  /* ===== ما يُستبدل في app-actions.js (يُطبَّق بعد تحميلها) ===== */
  setTimeout(() => {
    /* أنواع التصنيف بالترتيب، و«مدير» آخرها */
    delete CLS_ROLES.admin;
    Object.assign(CLS_ROLES, { accountant: 'محاسب', placeadmin: 'إداري', admin: 'مدير' });
    Object.assign(PASS_PREFIX, { placeadmin: 'padm', placeadmins: 'padm' });
    KIND_TITLE.placeadmins = 'الإداريون';

    /* التصنيف الفعّال: إن حُذف العضو المرتبط يعود الموظف «غير مصنف» */
    clsOf = function (e) {
      const c = clsRead()[e.id];
      if (c?.kind && CLS_ROLES[c.kind] && byId(db[COLL[c.kind]] || [], c.memberId)) return c;
      /* تصنيف قديم بمسمى (إداري، مشرف عام…) مربوط بعضو موجود: يُعدّ بنوع حساب ذلك العضو */
      if (c?.memberId) { const r = Object.keys(CLS_ROLES).find(k => byId(db[COLL[k]] || [], c.memberId)); if (r) return { kind: r, memberId: c.memberId }; }
      /* بلا تصنيف صالح: إن طابق اسمه عضوًا واحدًا من العاملين يُعدّ مصنَّفًا به */
      const hits = Object.keys(CLS_ROLES).flatMap(r => (db[COLL[r]] || []).filter(m => norm(m.name) === norm(e.name)).map(m => ({ kind: r, memberId: m.id, auto: true })));
      return hits.length === 1 ? hits[0] : null;
    };
    clsSuggest = function (e) {
      for (const r of Object.keys(CLS_ROLES)) if ((db[COLL[r]] || []).some(m => norm(m.name) === norm(e.name))) return { kind: r, existing: true };
      const role = e.role || '';
      if (/مشرف/.test(role)) return { kind: 'supervisor' };
      if (/معلم|مساعد/.test(role)) return { kind: 'teacher' };
      if (/محاسب/.test(role)) return { kind: 'accountant' };
      if (/إداري|اداري/.test(role)) return { kind: 'placeadmin' };
      return null;
    };
    unclassView = function (bar) {
      const emps = payEmps();
      if (!emps.length) return `<div class="card">${bar}${empty('لا يوجد موظفون في المرتبات بعد. استوردهم من «المرتبات ← الموظفون» أو «إعدادات المرتبات».')}</div>`;
      const un = emps.filter(e => !clsOf(e));
      const opts = () => `<option value="">— اختر التصنيف —</option>${Object.entries(CLS_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}`;
      const sug = un.map(e => [e, clsSuggest(e)]);
      const auto = sug.filter(([e, s]) => s && s.kind !== 'admin' && e.status !== 'متوقف').length;
      const rows = sug.map(([e, s], i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}${e.status === 'متوقف' ? ' <span class="tag">متوقف</span>' : ''}</td><td>${esc(e.role || '—')}</td><td class="muted" style="font-size:.85rem">${s ? (s.existing ? `يوجد ${CLS_ROLES[s.kind]} بنفس الاسم` : `المقترح: ${esc(CLS_ROLES[s.kind])}${s.kind === 'supervisor' && /عام/.test(e.role || '') ? ' عام' : ''}`) : ''}</td><td><select class="mini" data-cls="${esc(e.id)}" aria-label="تصنيف ${esc(e.name)}">${opts()}</select></td></tr>`).join('');
      return `<div class="card">${bar}
        <div class="note">موظفو المرتبات يظهرون هنا تلقائيًا. اختر نوع حساب كل واحد: <b>معلم</b> أو <b>مشرف</b> أو <b>محاسب</b> أو <b>إداري</b> (في مكان) فيُنشأ له عضو بهذا النوع (أو يُربط بالموجود بنفس الاسم)، و<b>مدير</b> يأخذ صلاحيات كاملة. الوظيفة في المرتبات «مشرف عام» تجعله مشرفًا عامًا يرى كل الحلقات.</div>
        ${un.length ? `<div class="bar"><span class="grow muted">${un.length} موظف بلا تصنيف</span><button class="btn" data-act="dupOpen">الأسماء المتشابهة</button>${auto ? `<button class="btn primary" data-act="clsAuto">تصنيف تلقائي حسب الوظيفة (${auto})</button>` : ''}</div>
        <div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الوظيفة في المرتبات</th><th></th><th>التصنيف</th></tr>${rows}</table></div>` : empty('كل موظفي المرتبات مصنّفون ✓')}</div>`;
    };
    classifyEmp = function (id, val, quiet) {
      const e = payEmps().find(x => x.id === id); if (!e || !val || !CLS_ROLES[val]) return false;
      const go = () => {
        const coll = COLL[val];
        db[coll] = db[coll] || [];
        let m = db[coll].find(x => norm(x.name) === norm(e.name));
        const isNew = !m;
        if (!m) { m = val === 'admin' ? { id: uid(), name: e.name, pin: genPassK('admin') } : { id: uid(), name: e.name, phone: '', pin: genPassK(val), info: {} }; db[coll].push(m); ui.shown[m.id] = true; }
        /* «مشرف عام» في المرتبات: يرى كل الحلقات والأماكن */
        if (val === 'supervisor' && /عام/.test(e.role || '') && !isGenSup(m)) m.info = { ...(m.info || {}), scope: 'all' };
        clsMap()[id] = { kind: val, memberId: m.id };
        if (!quiet) { save(); render(); toast(`«${e.name}» ${isNew ? 'أُضيف' : 'رُبط'} ${CLS_ROLES[val]}${CLOUD && !m.hasLogin ? ' — أنشئ له حساب الدخول من «' + KIND_TITLE[coll] + '»' : ''}${val === 'placeadmin' && !placesOf(m).length ? ' — وحدّد مكانه من زر «النطاق»' : ''}`); }
        return isNew;
      };
      if (val === 'admin') { render(); ask(`سيحصل «${e.name}» على صلاحيات المدير الكاملة، بما فيها المرتبات وإدارة الحسابات. متابعة؟`, go); return false; }
      return go();
    };
    clsAuto = function () {
      const list = payEmps().filter(e => !clsOf(e) && e.status !== 'متوقف').map(e => [e, clsSuggest(e)]).filter(([, s]) => s && s.kind !== 'admin');
      if (!list.length) { toast('لا يوجد تصنيف مقترح'); return; }
      const parts = Object.keys(CLS_ROLES).map(k => [list.filter(([, s]) => s.kind === k).length, CLS_ROLES[k]]).filter(([n]) => n).map(([n, l]) => `${n} ${l}`);
      ask(`تصنيف ${list.length} موظفًا حسب وظيفتهم في المرتبات: ${parts.join('، و')}؟ لن يُصنَّف أحد «مدير» تلقائيًا، ويبقى الموظفون المتوقفون لتصنّفهم بنفسك.`, () => {
        let n = 0;
        list.forEach(([e, s]) => { if (classifyEmp(e.id, s.kind, true)) n++; });
        save(); render(); toast(`تم تصنيف ${list.length} موظفًا${n ? ` (${n} عضو جديد)` : ''}${CLOUD && n ? ' — أنشئ حسابات الدخول من فئات الأعضاء' : ''}`);
      });
    };
    /* ============ نطاق الحساب ============
       المشرف: حلقات محددة (تُسند من تعديل الحلقة) أو «مشرف عام» يرى كل الحلقات والأماكن.
       الإداري: مكان أو أكثر، يطّلع على حلقاتها وطلابها ويجمع اشتراكاتهم ويرسلها للمحاسب. */
    function scopeDialog(k, m) {
      if (!m) return;
      if (k === 'supervisors') {
        openForm('نطاق المشرف «' + m.name + '»', [{ name: 'scope', label: 'يرى', type: 'select', value: isGenSup(m) ? 'all' : '', options: [{ v: '', l: 'الحلقات المسندة إليه فقط' }, { v: 'all', l: 'كل الحلقات والأماكن (مشرف عام)' }] },
          { type: 'note', label: 'الحلقات المسندة تُحدَّد من «الأماكن والحلقات» ← تعديل ← المشرف.' }], v => {
          const info = { ...(m.info || {}) };
          if (v.scope === 'all') info.scope = 'all'; else delete info.scope;
          m.info = info; toast(v.scope === 'all' ? `«${m.name}» مشرف عام` : `«${m.name}»: الحلقات المسندة فقط`);
        });
        return;
      }
      if (k !== 'placeadmins') return;
      const cur = new Set(placesOf(m)), list = (db.places || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const cnt = p => db.halaqat.filter(h => h.placeId === p.id).length;
      const ov = document.createElement('div'); ov.className = 'overlay';
      ov.innerHTML = `<div class="modal"><h2>أماكن الإداري «${esc(m.name)}»</h2>
        <p class="muted" style="margin-top:0">يطّلع على حلقات المكان المحدد وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب.</p>
        <div style="max-height:55vh;overflow:auto">${list.map(p => `<label class="chk"><input type="checkbox" value="${esc(p.id)}" ${cur.has(p.id) ? 'checked' : ''}> ${esc(p.name)} <span class="muted">(${cnt(p)} حلقة)</span></label>`).join('') || empty('لا توجد أماكن.')}</div>
        <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
      document.body.appendChild(ov);
      ov.querySelector('[data-close]').onclick = () => ov.remove();
      ov.querySelector('[data-save]').onclick = () => {
        const ids = [...ov.querySelectorAll('input[type=checkbox]:checked')].map(x => x.value);
        m.info = { ...(m.info || {}), places: ids };
        ov.remove(); save(); render();
        toast(ids.length ? `«${m.name}»: ${ids.map(id => byId(db.places, id)?.name).join('، ')}` : `«${m.name}» بلا مكان`);
      };
    }

    A.memScope = d => scopeDialog(d.k, byId(db[d.k] || [], d.id));
    /* جمهور الإعلانات: يضاف «الإداريون» */
    A.addNews = () => openForm('إعلان جديد', [{ name: 'text', label: 'النص', type: 'textarea' }, { name: 'audience', label: 'الجمهور', type: 'select', options: [{ v: 'all', l: 'الجميع' }, { v: 'teacher', l: 'المعلمون' }, { v: 'supervisor', l: 'المشرفون' }, { v: 'placeadmin', l: 'الإداريون' }, { v: 'student', l: 'الطلاب' }] }],
      v => { if (!v.text.trim()) return 'اكتب نص الإعلان'; db.news.push({ id: uid(), text: v.text.trim(), audience: v.audience, date: today() }); });
    /* الموظفون المتوقفون: نوع الحساب بالعربية */
    const baseStopped = stoppedList;
    stoppedList = (...a) => baseStopped(...a).map(x => ({ ...x, kind: CLS_ROLES[x.kind] || x.kind }));
    /* نموذج الموظف في المرتبات: «محاسب» بين الوظائف */
    const baseForm = window.QL.openForm;
    window.QL.openForm = (title, fields, onSave) => {
      (fields || []).forEach(f => {
        if (f.name === 'role' && f.type === 'select' && Array.isArray(f.options) && f.options.some(o => o.v === 'إداري') && !f.options.some(o => o.v === 'محاسب'))
          f.options.splice(f.options.findIndex(o => o.v === 'إداري'), 0, { v: 'محاسب', l: 'محاسب' });
      });
      return baseForm(title, fields, onSave);
    };
    if (session) render();
  }, 0);
})();
