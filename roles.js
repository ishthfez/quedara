'use strict';
/* ============ أنواع الحسابات المعتمدة ============
   - لا توجد «مسميات أخرى»: كل موظف في المرتبات يُصنَّف بنوع حساب معتمد:
     مدير عام (يرى كل الحلقات، وهو على الخادم مشرف نطاقه «الكل»)، مشرف، معلم، محاسب، إداري (في مكان)، مدير.
   - الإداري (placeadmin): يطّلع على حلقات أماكنه وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب (تبويب «التحصيل»).
   - النطاق يحدده المدير من «الأعضاء» بزر «النطاق»، ويُحفظ في info للعضو: scope = 'all' للمشرف العام، و places للإداري.
   - يحتاج على الخادم: supabase/roles.sql.
   يُحمَّل قبل app-actions.js؛ وما يستبدله من دوال app-actions يُطبَّق بعد تحميلها. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./roles.js')) VFILES.push('./roles.js'); } catch (e) { /* ignore */ } });
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
  /* حلقات الإداري: حلقات أماكنه، وإن اختيرت له في مكانٍ حلقاتٌ بعينها (info.halaqat) فتلك وحدها في ذلك المكان
     (القاعدة نفسها في الخادم: place_scope_halaqat في supabase/place_halaqat.sql) */
  const selHalOf = m => new Set(Array.isArray(m?.info?.halaqat) ? m.info.halaqat : []);
  const placeHalaqatOf = m => {
    const ps = new Set(placesOf(m)), sel = selHalOf(m), inP = db.halaqat.filter(h => ps.has(h.placeId));
    const narrowed = new Set(inP.filter(h => sel.has(h.id)).map(h => h.placeId));
    return inP.filter(h => !narrowed.has(h.placeId) || sel.has(h.id));
  };
  /* العدد مع «حلقة» بالعربية الصحيحة */
  const hN = n => n === 1 ? 'حلقة واحدة' : n === 2 ? 'حلقتان' : `${n} ${n >= 3 && n <= 10 ? 'حلقات' : 'حلقة'}`;
  const ofN = (n, all) => `${n} من ${all} ${all >= 3 && all <= 10 ? 'حلقات' : 'حلقة'}`;
  /* وصف النطاق: «المكان» أو «المكان (3 من 5 حلقات)» */
  const placeScopeTxt = m => {
    const mine = new Set(placeHalaqatOf(m).map(h => h.id));
    return placesOf(m).map(id => { const p = byId(db.places, id); if (!p) return ''; const all = db.halaqat.filter(h => h.placeId === id), n = all.filter(h => mine.has(h.id)).length;
      return n < all.length ? `${p.name} (${ofN(n, all.length)})` : p.name; }).filter(Boolean).join('، ');
  };
  window.isGenSup = isGenSup; window.placesOf = placesOf; window.placeHalaqatOf = placeHalaqatOf; window.placeScopeTxt = placeScopeTxt;
  const myHal = () => {
    if (session?.role === 'placeadmin') return placeHalaqatOf(me());
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

  /* ===== المدير العام: صفحات الاطلاع (يرى كل شيء ولا يعدّل؛ الخادم يفرض ذلك بعد supabase/gmanager_role.sql) =====
     تُضاف إلى قائمته بعد صفحات المشرف (stuview.js). ويرسل الإشعارات متى أمكن إرسالها فعلًا. */
  const isGM = () => session?.role === 'supervisor' && isGenSup(me());
  window.QLGMTabs = [['gm_halaqat', 'الحلقات'], ['gm_staff', 'العاملون']];
  /* الحلقات للاطلاع: قسم المدير نفسه بلا أزرار الإضافة والتعديل والحذف (كما عند المحاسب) */
  const gmHalaqat = () => adminViews.halaqat()
    .replace(/<button class="btn[^"]*" data-act="(addPlace|addHalaqa|editPlace|delPlace|editHalaqa|delHalaqa)"[^>]*>[^<]*<\/button>/g, '')
    .replace(/<details class="pltools (pladd|plmore)">[\s\S]*?<\/details>/g, '')
    .replace(/<button[^>]*data-fee-place[^>]*>[\s\S]*?<\/button>/g, '')
    .replace(/<input type="checkbox" data-pl(sel|all)[^>]*>/g, '');
  /* العاملون للاطلاع: الاسم والصفة والوظيفة والمكان (بلا أزرار الحساب والنطاق والاسم) */
  const gmStaff = () => {
    const list = staffList();
    return `<div class="card"><p class="muted" style="margin-top:0">${list.length} من العاملين (للاطلاع).</p>${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الوظيفة في المرتبات</th><th>المكان</th></tr>${list.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.m.name)}${x.emp?.status === 'متوقف' ? ' <span class="tag tag-no">متوقف</span>' : ''}</td><td>${esc(x.type)}</td><td>${esc(x.emp?.role || '—')}</td><td>${esc(placeTxt(x.k, x.m, x.emp))}</td></tr>`).join('')}</table></div>` : empty('لا يوجد عاملون بعد.')}</div>`;
  };
  Object.assign(supervisorViews, { gm_halaqat: gmHalaqat, gm_staff: gmStaff });
  /* الإشعارات: زر «+ إشعار» للمدير العام متى أمكن الإرسال فعلًا (بلا خادم، أو بعد gmanager_role.sql) */
  const gmCanSend = () => !CLOUD || window.Cloud?.gmReady === true;
  document.addEventListener('DOMContentLoaded', () => {
    try { TAB_ICONS.gm_halaqat = TAB_ICONS.gm_halaqat || TAB_ICONS.halaqat; TAB_ICONS.gm_staff = TAB_ICONS.gm_staff || TAB_ICONS.members || TAB_ICONS.teachers; } catch (e) { /* ignore */ }
    const baseNews = supervisorViews.news;
    if (typeof baseNews !== 'function') return;
    supervisorViews.news = function () {
      const h = baseNews.apply(this, arguments);
      if (!isGM() || !gmCanSend() || typeof h !== 'string') return h;
      return `<div class="bar" style="margin:0 0 .6rem"><span class="grow"></span><button class="btn primary" data-act="addNews">+ إشعار</button></div>` + h;
    };
  });

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
      return `<div class="card"><h2 style="margin-top:0">${esc(placeScopeTxt(me()) || ps.map(p => p.name).join('، '))}</h2><div class="grid">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div></div>
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
  const KINDS = [['teachers', 'المعلمون'], ['students', 'الطلاب'], ['supervisors', 'المشرفون'], ['accountants', 'المحاسبون'], ['placeadmins', 'الإداريون'], ['admins', 'Admin']];
  const STAFF_KINDS = [['admins', 'Admin'], ['supervisors', 'مشرف'], ['teachers', 'معلم'], ['accountants', 'محاسب'], ['placeadmins', 'إداري']];
  const empOfMember = id => { const c = clsRead(); const eid = Object.keys(c).find(k => c[k]?.memberId === id); return eid ? payEmps().find(e => e.id === eid) : null; };
  const typeOf = (k, l, m) => k === 'supervisors' && isGenSup(m) ? 'مدير عام' : l;
  /* «مدير عام»: فئة مستقلة أعلى من المشرفين (على الخادم: مشرف نطاقه «الكل»، فصلاحياته صلاحيات المشرف العام نفسها) */
  const gms = () => (db.supervisors || []).filter(isGenSup);
  const sups = () => (db.supervisors || []).filter(m => !isGenSup(m));
  const placeTxt = (k, m, emp) => k === 'placeadmins' ? (placeScopeTxt(m) || 'بلا مكان') : (emp?.place || '—');
  function staffList() {
    const out = [];
    /* حساب المدير حساب إداري للنظام وليس موظفًا: لا يظهر إلا إن رُبط بموظف في المرتبات (ويبقى في «المديرون») */
    STAFF_KINDS.forEach(([k, l], gi) => (db[k] || []).forEach(m => { const emp = empOfMember(m.id); if (k !== 'admins' || emp) out.push({ m, k, gi: k === 'supervisors' && isGenSup(m) ? gi - 0.5 : gi, type: typeOf(k, l, m), emp }); }));
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
    const gmN = list.filter(x => x.k === 'supervisors' && isGenSup(x.m)).length;
    return `<div class="note">كل العاملين عدا الطلاب${cnt('admins') ? `: ${cnt('admins')} Admin،` : ':'} ${gmN ? `${gmN} مدير عام، ` : ''}${cnt('supervisors') - gmN} مشرف، ${cnt('teachers')} معلم، ${cnt('accountants')} محاسب، ${cnt('placeadmins')} إداري. للإضافة والحذف والإجراءات الجماعية اختر الفئة من القائمة. حساب Admin (حساب النظام) في «Admin».</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الوظيفة في المرتبات</th><th>المكان</th><th>الحساب</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد موظفون بعد.')}`;
  }
  function withScope(h, kind0) {
    const kind = kind0 === 'gmanagers' ? 'supervisors' : kind0;
    if (kind !== 'supervisors' && kind !== 'placeadmins') return h;
    (db[kind] || []).forEach(m => {
      const tag = kind === 'supervisors' ? '' : ` <span class="tag ${placesOf(m).length ? '' : 'tag-no'}">${esc(placeTxt(kind, m))}</span>`;
      if (tag) h = h.replace(new RegExp(`(data-sel="${m.id}"[\\s\\S]*?<td>\\d+</td><td>[\\s\\S]*?)(</td>)`), (x, p1, p2) => p1 + tag + p2);
      const nb = `<button class="btn sm" data-act="editName" data-id="${m.id}" data-k="${kind}">`;
      h = h.split(nb).join(`<button class="btn sm" data-act="memScope" data-id="${m.id}" data-k="${kind}">النطاق</button>` + nb);
    });
    const tip = kind0 === 'gmanagers' ? 'المدير العام يرى كل الحلقات والأماكن ويعمل فيها كما يعمل المشرف في حلقاته (الحضور والتسميع وغياب المعلمين). لإرجاعه مشرفًا عاديًا: زر «النطاق».'
      : kind === 'supervisors' ? 'حدّد حلقات كل مشرف من «الحلقات» ← تعديل ← المشرف، أو اجعله «مديرًا عامًا» يرى كل الحلقات من زر «النطاق».' : 'حدّد مكان كل إداري من زر «النطاق» (وحلقات بعينها فيه إن شئت): يطّلع على حلقاته وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب.';
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
    } else if (cur === 'gmanagers' || cur === 'supervisors') {
      /* «المديرون العامون» و«المشرفون» قائمتان منفصلتان من قالب قائمة المشرفين نفسه */
      const all = db.supervisors;
      db.supervisors = cur === 'gmanagers' ? gms() : sups(); ui.msub = 'supervisors';
      try { h = baseMembers(); } finally { db.supervisors = all; ui.msub = cur; }
      if (cur === 'gmanagers') h = h.split('data-act="addMember" data-k="supervisors">+ مشرف<').join('data-act="addGM">+ مدير عام<');
    } else if (cur === 'students') {
      /* سرعة: قالب القائمة يقارن اسم كل طالب بكل الحسابات (1,680 × 1,750 مقارنة) فيتجمد الهاتف؛
         تُقارن أسماء الطلاب بحسابات العاملين فقط (الطلاب المكررون لهم «مكرر للمراجعة» و«الأسماء المتشابهة») */
      const keep = ROLES.slice();
      ROLES.splice(ROLES.indexOf('student'), 1);
      try { h = baseMembers(); } finally { ROLES.splice(0, ROLES.length, ...keep); }
    } else h = baseMembers();
    return withScope(h, cur).replace(SEL, fixPicker);
  };
  /* قائمة الفئات كما بنتها الملفات الأخرى (ومعها «مكرر للمراجعة» وعدد «غير مصنف»)، مع «الإداريون» والأعداد الصحيحة */
  function fixPicker(sel) {
    const n = k => (db[k] || []).length;
    let s = sel.replace(/(<option value="staff"[^>]*>الموظفون \()\d+/, (x, a) => a + staffList().length)
      .replace(/(<option value="accountants"[^>]*>المحاسبون \()\d+/, (x, a) => a + n('accountants'));
    if (!/value="placeadmins"/.test(s)) s = s.replace(/<option value="admins"/, `<option value="placeadmins">الإداريون (${n('placeadmins')})</option><option value="admins"`);
    else s = s.replace(/(<option value="placeadmins"[^>]*>الإداريون \()\d+/, (x, a) => a + n('placeadmins'));
    if (ui.msub === 'placeadmins') s = s.replace(/ selected(?=[ >])/g, '').replace('<option value="placeadmins"', '<option value="placeadmins" selected');
    /* «المديرون العامون» قبل «المشرفون»، وعدد المشرفين بدونهم */
    s = s.replace(/(<option value="supervisors"[^>]*>المشرفون \()\d+/, (x, a) => a + sups().length);
    if (!/value="gmanagers"/.test(s)) s = s.replace(/<option value="supervisors"/, `<option value="gmanagers">المديرون العامون (${gms().length})</option><option value="supervisors"`);
    if (ui.msub === 'gmanagers') s = s.replace(/ selected(?=[ >])/g, '').replace('<option value="gmanagers"', '<option value="gmanagers" selected');
    return s;
  }

  /* ===== ما يُستبدل في app-actions.js (يُطبَّق بعد تحميلها) ===== */
  /* بعد تحميل كل الملفات (ومنها app-actions.js)، لا بمؤقّت: على الشبكات البطيئة قد يسبق المؤقّتُ تحميلَ الملف التالي */
  document.addEventListener('DOMContentLoaded', () => {
    /* أنواع التصنيف بالترتيب، و«مدير» آخرها */
    delete CLS_ROLES.admin;
    Object.assign(CLS_ROLES, { accountant: 'محاسب', placeadmin: 'إداري', admin: 'Admin' });
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
      const rows = sug.map(([e, s], i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}${e.status === 'متوقف' ? ' <span class="tag">متوقف</span>' : ''}</td><td>${esc(e.role || '—')}</td><td class="muted" style="font-size:.85rem">${s ? (s.existing ? `يوجد ${CLS_ROLES[s.kind]} بنفس الاسم` : `المقترح: ${s.kind === 'supervisor' && /عام/.test(e.role || '') ? 'مدير عام' : esc(CLS_ROLES[s.kind])}`) : ''}</td><td><select class="mini" data-cls="${esc(e.id)}" aria-label="تصنيف ${esc(e.name)}">${opts()}</select></td></tr>`).join('');
      return `<div class="card">${bar}
        <div class="note">موظفو المرتبات يظهرون هنا تلقائيًا. اختر نوع حساب كل واحد: <b>معلم</b> أو <b>مشرف</b> أو <b>محاسب</b> أو <b>إداري</b> (في مكان) فيُنشأ له عضو بهذا النوع (أو يُربط بالموجود بنفس الاسم)، و<b>Admin</b> يأخذ صلاحيات كاملة. الوظيفة في المرتبات «مشرف عام» أو «مدير عام» تجعله مديرًا عامًا يرى كل الحلقات.</div>
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
      ask(`تصنيف ${list.length} موظفًا حسب وظيفتهم في المرتبات: ${parts.join('، و')}؟ لن يُصنَّف أحد «Admin» تلقائيًا، ويبقى الموظفون المتوقفون لتصنّفهم بنفسك.`, () => {
        let n = 0;
        list.forEach(([e, s]) => { if (classifyEmp(e.id, s.kind, true)) n++; });
        save(); render(); toast(`تم تصنيف ${list.length} موظفًا${n ? ` (${n} عضو جديد)` : ''}${CLOUD && n ? ' — أنشئ حسابات الدخول من فئات الأعضاء' : ''}`);
      });
    };
    /* ============ نطاق الحساب ============
       المشرف: حلقات محددة (تُسند من تعديل الحلقة) أو «مشرف عام» يرى كل الحلقات والأماكن.
       الإداري: مكان أو أكثر (وفي المكان حلقات بعينها إن شاء المدير)، يطّلع على حلقاته وطلابها ويجمع اشتراكاتهم ويرسلها للمحاسب. */
    function scopeDialog(k, m) {
      if (!m) return;
      if (k === 'supervisors') {
        openForm('نطاق «' + m.name + '»', [{ name: 'scope', label: 'الفئة', type: 'select', value: isGenSup(m) ? 'all' : '', options: [{ v: '', l: 'مشرف: الحلقات المسندة إليه فقط' }, { v: 'all', l: 'مدير عام: كل الحلقات والأماكن' }] },
          { type: 'note', label: 'الحلقات المسندة تُحدَّد من «الحلقات» ← تعديل ← المشرف.' }], v => {
          const info = { ...(m.info || {}) };
          if (v.scope === 'all') info.scope = 'all'; else delete info.scope;
          m.info = info; toast(v.scope === 'all' ? `«${m.name}» مدير عام` : `«${m.name}» مشرف: الحلقات المسندة فقط`);
        });
        return;
      }
      if (k !== 'placeadmins') return;
      /* المكان، ثم حلقاته تحته: كلها محددة حين يُختار المكان (يتابع المكان كله، وما يُضاف إليه من حلقات لاحقًا)،
         وإلغاء بعضها يجعله يتابع المحددة وحدها. إلغاء كل حلقات المكان يلغي المكان نفسه. */
      const cur = new Set(placesOf(m)), mine = new Set(placeHalaqatOf(m).map(h => h.id));
      const list = (db.places || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const halsIn = p => db.halaqat.filter(h => h.placeId === p.id).sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
      const hName = h => halaqaLabel(h).replace(/^\s*حلقة\s+/, '').split(' — ')[0].trim();
      const nStu = h => db.students.filter(s => s.halaqaId === h.id && !stOff(s)).length;
      const ov = document.createElement('div'); ov.className = 'overlay';
      ov.innerHTML = `<div class="modal"><h2>نطاق الإداري «${esc(m.name)}»</h2>
        <p class="muted" style="margin-top:0">يطّلع على الحلقات المحددة وطلابها، ويجمع اشتراكاتهم ويرسلها للمحاسب. اختر المكان، ثم ألغِ من حلقاته ما لا يتابعه إن شئت.</p>
        <div style="max-height:55vh;overflow:auto">${list.map(p => { const hs = halsIn(p), on = cur.has(p.id);
          return `<div class="qpsc" data-qpsc="${esc(p.id)}" style="margin:0 0 .5rem"><label class="chk"><input type="checkbox" data-qpl value="${esc(p.id)}" ${on ? 'checked' : ''}> <b>${esc(p.name)}</b> <span class="muted" data-qpn>(${hs.length ? hN(hs.length) : 'بلا حلقات'})</span></label>
            ${hs.length ? `<div data-qphs style="margin:.15rem 1.6rem 0 0;${on ? '' : 'display:none'}">${hs.map(h => `<label class="chk" style="font-size:.92rem"><input type="checkbox" data-qph value="${esc(h.id)}" ${!on || mine.has(h.id) ? 'checked' : ''}> ${esc(hName(h))} <span class="muted">(${nStu(h)} طالب)</span></label>`).join('')}</div>` : ''}</div>`; }).join('') || empty('لا توجد أماكن.')}</div>
        <div class="row"><button type="button" class="btn primary" data-save>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
      document.body.appendChild(ov);
      const paint = box => { const all = [...box.querySelectorAll('[data-qph]')], n = all.filter(x => x.checked).length, c = box.querySelector('[data-qpn]');
        if (c) c.textContent = all.length ? (n < all.length ? `(${ofN(n, all.length)})` : `(${all.length === 1 ? 'حلقته الوحيدة' : 'كل حلقاته: ' + all.length})`) : '(بلا حلقات)'; };
      ov.querySelectorAll('[data-qpsc]').forEach(b => { if (b.querySelector('[data-qpl]').checked) paint(b); });
      ov.addEventListener('change', e => {
        const box = e.target.closest('[data-qpsc]'); if (!box) return;
        const pl = box.querySelector('[data-qpl]'), hs = box.querySelector('[data-qphs]'), all = [...box.querySelectorAll('[data-qph]')];
        if (e.target.matches('[data-qpl]')) { if (hs) hs.style.display = pl.checked ? '' : 'none'; if (pl.checked) all.forEach(x => { x.checked = true; }); }
        else if (e.target.matches('[data-qph]') && !all.some(x => x.checked)) { pl.checked = false; if (hs) hs.style.display = 'none'; all.forEach(x => { x.checked = true; }); }
        if (pl.checked) paint(box); else { const c = box.querySelector('[data-qpn]'); if (c) c.textContent = `(${all.length ? hN(all.length) : 'بلا حلقات'})`; }
      });
      ov.querySelector('[data-close]').onclick = () => ov.remove();
      ov.querySelector('[data-save]').onclick = () => {
        const ids = [], hal = [];
        ov.querySelectorAll('[data-qpsc]').forEach(b => {
          if (!b.querySelector('[data-qpl]').checked) return;
          ids.push(b.dataset.qpsc);
          const all = [...b.querySelectorAll('[data-qph]')], on = all.filter(x => x.checked);
          if (on.length && on.length < all.length) on.forEach(x => hal.push(x.value));   // بعض حلقات المكان: تُحفظ بعينها
        });
        const info = { ...(m.info || {}), places: ids };
        if (hal.length) info.halaqat = hal; else delete info.halaqat;
        m.info = info;
        ov.remove(); save(); render();
        toast(ids.length ? `«${m.name}»: ${placeScopeTxt(m)}` : `«${m.name}» بلا مكان`);
      };
    }

    A.memScope = d => scopeDialog(d.k, byId(db[d.k] || [], d.id));
    /* إضافة مدير عام: حساب مشرف نطاقه «الكل» */
    A.addGM = () => openForm('إضافة مدير عام', [{ name: 'name', label: 'الاسم', required: true }, { type: 'note', label: 'ستُنشأ كلمة المرور تلقائيًا. يرى كل الحلقات والأماكن.' }], v => {
      const name = v.name.trim(), id = uid(), pin = genPassK('supervisors');
      if (db.supervisors.some(m => norm(m.name) === norm(name))) return 'يوجد مشرف أو مدير عام بالاسم نفسه';
      db.supervisors.push({ id, name, phone: '', pin, info: { scope: 'all' } });
      ui.shown[id] = true;
      if (CLOUD) setTimeout(() => cloudMakeLogins([byId(db.supervisors, id)].filter(Boolean)), 0);
      else toast('تم إنشاء الحساب — كلمة المرور: ' + pin);
    });
    /* اسم الفئة تحت اسم المستخدم في القائمة الجانبية: «مدير عام» لا «مشرف» */
    const baseRender = render;
    render = function () {
      const r = baseRender.apply(this, arguments);
      try {
        if (session?.role === 'supervisor' && isGenSup(me())) {
          const sm = document.querySelector('.side .brand small');
          if (sm && sm.textContent.startsWith(ROLE_L.supervisor + ':')) sm.textContent = 'مدير عام' + sm.textContent.slice(ROLE_L.supervisor.length);
        }
      } catch (e) { /* ignore */ }
      return r;
    };
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
  });
})();
