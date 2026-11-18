'use strict';
/* ============ «الإعدادات ← صلاحيات صفحة الطلاب» ============
   جدول بكل عنصر وكل زر في صفحة «الطلاب» (ونافذة الحضور منها) أمام فئات العاملين: المعلمون، المشرفون، المحاسبون، الإداريون.
   المدير يرى كل شيء دائمًا. الاختيار يُحفظ مع الصلاحيات (db.settings.priv_perms.roles[الفئة]['ui.stu.…'])، فيصل كل عامل
   ما يخصه من الخادم عبر my_perms كبقية الصلاحيات، بلا تعديل على الخادم.
   هذا للعرض فقط: إظهار العنصر أو إخفاؤه. ما يغيّر البيانات (التحصيل، الحالة، النقل...) يبقى الخادم يتحقق من صلاحيته الأصلية.
   التطبيق على صفحة الطلاب لغير المدير يعمل متى عُرضت لهم (أسفل الملف): العنصر غير المسموح يُخفى، وما لا يُخفى (اسم الطالب،
   زر الحالة، تسجيل الحضور، التاريخ) يبقى ظاهرًا بلا ضغط. وقبل أول حفظ تسري الاختيارات الافتراضية في ITEMS.
   أول صف «عرض صفحة الطلاب» يقرر هل تظهر الصفحة للفئة أصلًا (stuview.js)، وهو مطفأ لكل الفئات حتى يفعّله المدير.
   العناصر كلها، كل عداد وكل زر وكل تبويب على حدة، في الصفحة ونافذة الحضور ونافذة الرسالة؛ وأزرار صف الطالب في جدول الصفحة
   (main > .card) منفصلة عن أزرار صفه في نافذة الحضور (.qatt).
   ملف الطالب: أقسامه (تُعلَّم بـ data-sk من عناوينها) وأزراره، أينما فُتح (من الجدول أو نافذة الحضور).
   مكانه: تبويب «الصلاحيات» نفسه، بقسمين متلاصقين أعلاه: «مهام التطبيق والأفراد» (perms.js كما هو) و«صفحة الطلاب» (هذا الجدول).
   استثناءات لأفراد: لشخص بعينه أن يظهر له عنصر أو يُخفى عنه خلافًا لفئته؛ تُحفظ في priv_perms.members[معرّفه]['ui.stu.…']
   (الموضع نفسه لاستثناءات «الصلاحيات»، فيصل الشخص من الخادم بالدالة نفسها has_perm التي تقدّم استثناء الفرد على فئته). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./stuperm.js')) VFILES.push('./stuperm.js'); } catch (e) { /* ignore */ } });
  const ROLES4 = [['teacher', 'المعلمون'], ['supervisor', 'المشرفون'], ['accountant', 'المحاسبون'], ['placeadmin', 'الإداريون']];
  const T = 'teacher', S = 'supervisor', A = 'accountant', P = 'placeadmin', ALL = [T, S, A, P];
  /* [المفتاح، العنصر، المجموعة، الفئات المسموح لها افتراضيًا، المحدِّد، النوع: hide (يُخفى) | lock (يظهر بلا ضغط) | col (عمود بعنوانه)] */
  const ST = 'main > .card .tbl td ', W = '.qatt ';
  const ITEMS = [
    ['page', 'عرض صفحة «الطلاب» لهذه الفئة (بدل صفحاتها للطلاب والحضور)', 'الصفحة', [], '', 'flag'],
    ['subnav', 'شريط تبويبات الصفحة (الطلاب / الحضور / تحصيل المعلمين)', 'الصفحة', [A], 'main .subnav', 'hide'],
    ['tcol', 'تبويب «تحصيل المعلمين»', 'الصفحة', [A], 'main .subnav [data-svw="tcollect"]', 'hide'],
    ['sum', 'بطاقة الاشتراكات كلها', 'بطاقة الاشتراكات', [A], 'main .feecard', 'hide'],
    ['month', 'اختيار شهر الاشتراكات', 'بطاقة الاشتراكات', [A], 'main .feecard [data-fmonth]', 'hide'],
    ['sumstu', 'صف عدادات الطلاب كله', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu', 'hide'],
    ['k_n', 'عداد «عدد الطلاب»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu > .feerow:nth-child(1)', 'hide'],
    ['k_paid', 'عداد «مسدَّد»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu > .feerow:nth-child(2)', 'hide'],
    ['k_unpaid', 'عداد «لم يسدّد»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu > .feerow:nth-child(3)', 'hide'],
    ['k_free', 'عداد «معفى»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu > .feerow:nth-child(4)', 'hide'],
    ['k_none', 'عداد «بلا اشتراك محدد»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu > .feerow:nth-child(5)', 'hide'],
    ['summon', 'صف عدادات المبالغ كله', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon', 'hide'],
    ['k_exp', 'عداد «المتوقع»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon > .feerow:nth-child(1)', 'hide'],
    ['k_got', 'عداد «المحصّل»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon > .feerow:nth-child(2)', 'hide'],
    ['k_rest', 'عداد «الباقي»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon > .feerow:nth-child(3)', 'hide'],
    ['k_pct', 'عداد «نسبة التحصيل»', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon > .qfpct', 'hide'],
    ['k_note', 'سطر «وصل أيضًا … من منقطعين أو معفيين»', 'بطاقة الاشتراكات', [A], 'main .feecard > p.muted', 'hide'],
    ['search', 'البحث باسم الطالب', 'أدوات الجدول', ALL, 'main input[data-sq]', 'hide'],
    ['place', 'قائمة المكان', 'أدوات الجدول', [S, A, P], 'main > .card .qcombo:has([data-fplace]),main > .card select[data-fplace]', 'hide'],
    ['halaqa', 'قائمة الحلقة', 'أدوات الجدول', [S, A, P], 'main .qcombo:has([data-change="fh"]),main select[data-change="fh"]', 'hide'],
    ['att', 'زر «الحضور» (نافذة تسجيل الحضور)', 'أدوات الجدول', [T, S, P], 'main [data-attopen]', 'hide'],
    ['seg', 'تبويبا الحالة كلاهما (منتظم / منقطع)', 'أدوات الجدول', ALL, 'main [data-sstfseg]', 'hide'],
    ['seg_on', 'تبويب «منتظم»', 'أدوات الجدول', ALL, 'main [data-sstfv="on"]', 'hide'],
    ['seg_off', 'تبويب «منقطع»', 'أدوات الجدول', ALL, 'main [data-sstfv="off"]', 'hide'],
    ['zoom', 'حجم الخط', 'أدوات الجدول', ALL, 'main > .card .qzoom', 'hide'],
    ['save', 'حفظ الجدول (Excel / PDF)', 'أدوات الجدول', [A], 'main > .card .qsave', 'hide'],
    ['print', 'الطباعة', 'أدوات الجدول', ALL, 'main > .card [data-print]', 'hide'],
    ['remindall', 'تذكير غير المسددين (الجرس)', 'أدوات الجدول', [A], 'main [data-remind-all]', 'hide'],
    ['add', 'إضافة طالب', 'أدوات الجدول', [], 'main > .card [data-qadd],main [data-act="addStudent"]', 'hide'],
    ['heads', 'تعديل رؤوس الأعمدة (القلم فوق الجدول)', 'أدوات الجدول', [], 'main [data-heads]', 'hide'],
    ['more', '«عرض المزيد» و«عرض الكل» أسفل الجدول', 'أدوات الجدول', ALL, 'main > .card .pgmore', 'hide'],
    ['c_age', 'عمود «السن»', 'أعمدة الجدول', [T, S, P], 'السن', 'col'],
    ['c_sys', 'عمود «الحضور» (نظام 6 / 3 أيام)', 'أعمدة الجدول', [S, A, P], 'الحضور', 'col'],
    ['c_hal', 'عمود «الحلقة»', 'أعمدة الجدول', ALL, 'الحلقة', 'col'],
    ['c_place', 'عمود «المكان»', 'أعمدة الجدول', ALL, 'المكان', 'col'],
    ['c_hifz', 'عمود «آخر حفظ»', 'أعمدة الجدول', [T, S, P], 'آخر حفظ', 'col'],
    ['c_stat', 'عمود «الحالة»', 'أعمدة الجدول', ALL, 'الحالة', 'col'],
    ['c_abs', 'عمود «غياب الشهر»', 'أعمدة الجدول', [T, S, P], 'غياب الشهر', 'col'],
    ['c_due', 'عمود «المستحق»', 'أعمدة الجدول', [A], 'المستحق', 'col'],
    ['r_file', 'فتح ملف الطالب (الضغط على اسمه)', 'أزرار صف الطالب', ALL, 'main .tbl [data-act="studentCard"]', 'lock'],
    ['r_hist', 'السجل', 'أزرار صف الطالب', [T, S, P], ST + '[data-act="hist"]', 'hide'],
    ['r_msg', 'رسالة', 'أزرار صف الطالب', [T, S, P], ST + '[data-mnote]:not([data-mnote="*"])', 'hide'],
    ['r_pay', 'تحصيل', 'أزرار صف الطالب', [A], ST + '[data-fee-pay2]', 'hide'],
    ['r_edit', 'تعديل بيانات الطالب', 'أزرار صف الطالب', [], ST + '[data-act="editStudent"]', 'hide'],
    ['r_extra', 'البيانات الإضافية', 'أزرار صف الطالب', [], ST + '[data-act="editExtra"]', 'hide'],
    ['r_stat', 'تغيير الحالة (منتظم / منقطع)', 'أزرار صف الطالب', [], ST + '[data-stat]', 'lock'],
    ['r_sys', 'تغيير نظام الحضور (6 / 3 أيام)', 'أزرار صف الطالب', [], ST + 'select[data-fsys]', 'lock'],
    ['r_abs', 'فتح سجل الغياب (رقم «غياب الشهر»)', 'أزرار صف الطالب', [T, S, P], ST + '[data-abs-log]', 'lock'],
    ['m_msg', 'تبويب «رسالة للطالب»', 'نافذة الرسالة', ALL, '[data-msgtab="msg"]', 'hide'],
    ['m_rem', 'تبويب «تذكير بالاشتراك»', 'نافذة الرسالة', [T, A, P], '[data-msgtab="rem"]', 'hide'],
    ['a_hal', 'قائمة «الحلقة — المكان»', 'نافذة الحضور', [S, P], W + '.qatt-hw', 'lock'],
    ['a_date', 'تغيير تاريخ الحضور', 'نافذة الحضور', [S, P], W + 'input[data-change="date"]', 'lock'],
    ['a_tabs', 'تبويبا «منتظم / منقطع»', 'نافذة الحضور', [T, S, P], W + '.mtabs', 'hide'],
    ['a_search', 'البحث باسم الطالب', 'نافذة الحضور', [T, S, P], W + 'input[data-mq]', 'hide'],
    ['a_zoom', 'حجم الخط', 'نافذة الحضور', [T, S, P], W + '.qzoom', 'hide'],
    ['a_all', 'إشعار للطلاب (جماعي)', 'نافذة الحضور', [T, S, P], W + '[data-mnote="*"]', 'hide'],
    ['a_add', 'إضافة طالب', 'نافذة الحضور', [], W + '[data-attadd]', 'hide'],
    ['a_mark', 'تسجيل الحضور (حاضر / غائب / متأخر)', 'نافذة الحضور', [T, S, P], W + '[data-act="att"]', 'lock'],
    ['a_rec', 'تسجيل التسميع', 'نافذة الحضور', [T, S, P], W + '[data-act="rec"]', 'hide'],
    ['a_hist', 'السجل', 'نافذة الحضور', [T, S, P], W + 'td [data-act="hist"]', 'hide'],
    ['a_msg', 'رسالة', 'نافذة الحضور', [T, S, P], W + 'td [data-mnote]:not([data-mnote="*"])', 'hide'],
    ['a_move', 'نقل الطالب إلى حلقة أخرى', 'نافذة الحضور', [S, P], W + '[data-move]', 'hide'],
    ['a_stat', 'تغيير الحالة (منتظم / منقطع)', 'نافذة الحضور', [], W + '[data-stat]', 'lock'],
    ['s_own', 'قسم «خاص بالطالب» (بياناته)', 'ملف الطالب', ALL, '.scard [data-sk="own"]', 'hide'],
    ['s_dec', 'قسم «قرار المسؤول» (الحلقة والمكان والوقت)', 'ملف الطالب', ALL, '.scard [data-sk="dec"]', 'hide'],
    ['s_fees', 'قسم «الاشتراكات» (عدد الدفعات وإجماليها)', 'ملف الطالب', [A], '.scard [data-sk="fees"]', 'hide'],
    ['s_login', 'قسم «حساب الدخول»', 'ملف الطالب', [], '.scard [data-sk="login"]', 'hide'],
    ['s_fee', 'قسم «الاشتراك» (المستحق والخصم)', 'ملف الطالب', [A], '.scard [data-sk="fee"]', 'hide'],
    ['s_log', 'قسم «سجل الاشتراكات»', 'ملف الطالب', [A], '.scard [data-sk="log"]', 'hide'],
    ['s_disc', 'قائمة الخصم في الملف', 'ملف الطالب', [A], '.scard select[data-fdisc]', 'hide'],
    ['s_assign', 'زر «تعديل الفئة»', 'ملف الطالب', [A], '.scard [data-fee-assign]', 'hide'],
    ['s_feelog', 'زر «سجل الدفعات»', 'ملف الطالب', [A], '.scard [data-fee-log]', 'hide'],
    ['s_del', 'زر «حذف الطالب»', 'ملف الطالب', [], '.scard [data-act="delMember"]', 'hide'],
    ['s_edit', 'زر «تعديل»', 'ملف الطالب', [], '.scard [data-act="editStudent"]', 'hide'],
    ['s_print', 'زر «طباعة»', 'ملف الطالب', ALL, '.scard [data-act="printCard"]', 'hide'],
    ['s_zoom', 'حجم الخط في جداول الملف', 'ملف الطالب', ALL, '.scard .ztools', 'hide']
  ];
  /* أقسام ملف الطالب: كل عنوان (h3.sc-h) وما بعده حتى العنوان التالي يُعلَّم بمفتاح قسمه */
  const SECS = { 'خاص بالطالب': 'own', 'قرار المسؤول': 'dec', 'الاشتراكات': 'fees', 'حساب الدخول': 'login', 'الاشتراك': 'fee', 'سجل الاشتراكات': 'log' };
  function markCard(m) {
    m.querySelectorAll('h3.sc-h').forEach(h => {
      const k = SECS[(h.childNodes[0]?.textContent || h.textContent).trim()]; if (!k) return;
      for (let e = h; e && (e === h || !e.matches('h3.sc-h')); e = e.nextElementSibling) {
        if (e.matches('.row') && e.querySelector('[data-close],[data-act="printCard"]')) break;   // صف أزرار الملف الأخير ليس من القسم
        if (e.dataset.sk !== k) e.dataset.sk = k;
      }
    });
  }
  const PK = k => 'ui.stu.' + k, SET = 'ui.stu._set';
  const conf = () => (db.settings.priv_perms = db.settings.priv_perms || {}, db.settings.priv_perms.roles = db.settings.priv_perms.roles || {}, db.settings.priv_perms);
  const saved = r => (conf().roles[r] || {})[SET] === true;
  /* للمدير في الجدول: اختيار الفئة إن حُفظ، وإلا الافتراضي */
  /* استثناء الشخص لعنصر: true / false، أو undefined (حسب فئته) */
  const personOv = (id, it) => { const v = ((conf().members || {})[id] || {})[PK(it[0])]; return v === undefined ? undefined : !!v; };
  const roleOn = (r, it) => { const v = (conf().roles[r] || {})[PK(it[0])]; return saved(r) && v !== undefined ? !!v : it[3].includes(r); };
  /* تُحفظ كل الخانات صراحة (الخادم يُرسل للعامل ما حُفظ له فقط) */
  function persist(changes) {
    const c = conf();
    ROLES4.forEach(([r]) => {
      const R = c.roles[r] = c.roles[r] || {};
      ITEMS.forEach(it => { const k = PK(it[0]); R[k] = changes && changes[r] && k in changes[r] ? changes[r][k] : roleOn(r, it); });
      R[SET] = true;
    });
    save();
  }

  /* ===== الجدول في «الإعدادات» ===== */
  function view() {
    const groups = [...new Set(ITEMS.map(i => i[2]))];
    const rows = groups.map(g => `<tr class="sum"><td colspan="${ROLES4.length + 1}">${esc(g)}</td></tr>` + ITEMS.filter(i => i[2] === g).map(it =>
      `<tr><td class="qnm">${esc(it[1])}${it[5] === 'lock' ? ' <small class="muted">(إن لم يُسمح يظهر بلا ضغط)</small>' : ''}</td>${ROLES4.map(([r, l]) => `<td><input type="checkbox" data-sup="${r}|${it[0]}" ${roleOn(r, it) ? 'checked' : ''} aria-label="${esc(it[1])} — ${l}"></td>`).join('')}</tr>`).join('')).join('');
    const colAll = ROLES4.map(([, l]) => `<th>${l}</th>`).join('');
    /* «الكل» أو «لا شيء» يظهر مفعّلًا (كحليًا) حين تكون كل خانات الفئة كذلك فعلًا */
    const state = r => { const n = ITEMS.filter(it => roleOn(r, it)).length; return n === ITEMS.length ? 'all' : n === 0 ? 'none' : ''; };
    const allRow = `<tr><td class="qnm muted">لكل الفئة</td>${ROLES4.map(([r]) => { const k = state(r); return `<td><button type="button" class="btn sm${k === 'all' ? ' primary' : ''}" data-supall="${r}|1" aria-pressed="${k === 'all'}">الكل</button> <button type="button" class="btn sm${k === 'none' ? ' primary' : ''}" data-supall="${r}|0" aria-pressed="${k === 'none'}">لا شيء</button></td>`; }).join('')}</tr>`;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">صلاحيات صفحة «الطلاب»</h2><button type="button" class="btn" data-supreset>الاختيارات الافتراضية</button></div>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">ما يظهر لكل فئة من العاملين في صفحة «الطلاب» ونافذة الحضور. المدير يرى كل شيء دائمًا. الإخفاء هنا للعرض فقط: ما يغيّر البيانات يتحقق منه الخادم بصلاحيته في «الصلاحيات».</p>
      <div class="qsuptbl"><table><tr><th class="qnm">العنصر</th>${colAll}</tr>${allRow}${rows}</table></div></div>` + exView();
  }
  /* ===== استثناءات لأفراد ===== */
  const COLL = { teacher: 'teachers', supervisor: 'supervisors', accountant: 'accountants', placeadmin: 'placeadmins' };
  const RL = { teacher: 'معلم', supervisor: 'مشرف', accountant: 'محاسب', placeadmin: 'إداري' };
  const staff = () => ROLES4.flatMap(([r]) => (db[COLL[r]] || []).map(m => ({ m, r })));
  const exOf = id => Object.entries((conf().members || {})[id] || {}).filter(([k]) => k.startsWith('ui.stu.') && k !== SET);
  function exView() {
    const people = staff().filter(p => exOf(p.m.id).length);
    const lab = k => ITEMS.find(i => PK(i[0]) === k)?.[1] || k;
    const rows = people.map(({ m, r }) => `<tr><td class="qnm"><b>${esc(m.name)}</b><br><small class="muted">${RL[r]}</small></td>
      <td class="qnm">${exOf(m.id).map(([k, v]) => `<span class="tag ${v ? 'tag-ok' : 'tag-no'}" style="margin:.1rem">${v ? '+' : '−'} ${esc(lab(k))}</span>`).join(' ')}</td>
      <td><button type="button" class="btn sm" data-supex="${esc(m.id)}">تعديل</button> <button type="button" class="btn sm danger" data-supexdel="${esc(m.id)}">إلغاء الاستثناء</button></td></tr>`).join('');
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">استثناءات لأفراد</h2><button type="button" class="btn primary" data-supex="">+ إضافة استثناء</button></div>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">تتقدّم على اختيار فئة الشخص: «+» يظهر له العنصر وإن كان مخفيًا عن فئته، و«−» يُخفى عنه وإن كان ظاهرًا لها.</p>
      ${rows ? `<div class="qsuptbl"><table><tr><th class="qnm">الشخص</th><th class="qnm">الاستثناءات</th><th></th></tr>${rows}</table></div>` : '<p class="muted">لا توجد استثناءات لأفراد.</p>'}</div>`;
  }
  function exDialog(id0) {
    const people = staff().sort((a, b) => ROLES4.findIndex(x => x[0] === a.r) - ROLES4.findIndex(x => x[0] === b.r) || a.m.name.localeCompare(b.m.name, 'ar'));
    if (!people.length) { toast('لا يوجد عاملون'); return; }
    let id = id0 || people[0].m.id;
    const ov = document.createElement('div'); ov.className = 'overlay';
    const body = () => {
      const p = people.find(x => x.m.id === id), r = p?.r;
      const groups = [...new Set(ITEMS.map(i => i[2]))];
      const rows = groups.map(g => `<tr class="sum"><td colspan="3">${esc(g)}</td></tr>` + ITEMS.filter(i => i[2] === g).map(it => {
        const o = personOv(id, it), def = r ? roleOn(r, it) : false;
        return `<tr><td class="qnm">${esc(it[1])}</td><td><small class="muted">${def ? 'ظاهر' : 'مخفي'}</small></td>
          <td><select data-exk="${esc(it[0])}" style="width:auto;margin:0"><option value="">حسب فئته</option><option value="1" ${o === true ? 'selected' : ''}>يظهر له</option><option value="0" ${o === false ? 'selected' : ''}>لا يظهر له</option></select></td></tr>`;
      }).join('')).join('');
      return `<div class="modal wide"><h2>استثناء لصفحة الطلاب</h2>
        <label>الشخص<select data-exp>${ROLES4.map(([rr, l]) => { const ps = people.filter(x => x.r === rr); return ps.length ? `<optgroup label="${l}">${ps.map(x => `<option value="${esc(x.m.id)}" ${x.m.id === id ? 'selected' : ''}>${esc(x.m.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
        <p class="muted" style="font-size:.85rem;margin:.2rem 0 .6rem">«لفئته» ما تراه فئته الآن (${esc(RL[r] || '')}). غيّر ما تريد استثناءه فقط، واترك الباقي «حسب فئته».</p>
        <div class="qsuptbl"><table><tr><th class="qnm">العنصر</th><th>لفئته</th><th>لهذا الشخص</th></tr>${rows}</table></div>
        <div class="row"><button type="button" class="btn primary" data-exsave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    ov.innerHTML = body();
    document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-exp]')) { id = e.target.value; ov.innerHTML = body(); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (!e.target.closest('[data-exsave]')) return;
      const c = conf(); c.members = c.members || {};
      const M = { ...(c.members[id] || {}) };
      Object.keys(M).forEach(k => { if (k.startsWith('ui.stu.')) delete M[k]; });
      ov.querySelectorAll('[data-exk]').forEach(s => { if (s.value !== '') M[PK(s.dataset.exk)] = s.value === '1'; });
      if (Object.keys(M).length) c.members[id] = M; else delete c.members[id];
      save(); ov.remove(); render(); toast('حُفظ الاستثناء');
    });
  }
  document.addEventListener('click', e => {
    if (session?.role !== 'admin') return;
    const a = e.target.closest('[data-supex]'); if (a) { exDialog(a.dataset.supex); return; }
    const d = e.target.closest('[data-supexdel]');
    if (d) ask('إلغاء استثناءات هذا الشخص في صفحة الطلاب؟ يعود إلى اختيارات فئته.', () => {
      const c = conf(), M = { ...((c.members || {})[d.dataset.supexdel] || {}) };
      Object.keys(M).forEach(k => { if (k.startsWith('ui.stu.')) delete M[k]; });
      if (Object.keys(M).length) c.members[d.dataset.supexdel] = M; else delete c.members[d.dataset.supexdel];
      save(); render(); toast('أُلغي الاستثناء');
    });
  });
  /* ===== قسما تبويب «الصلاحيات» ===== */
  const SEGK = 'qpermseg';
  let seg = 'app'; try { seg = sessionStorage.getItem(SEGK) || 'app'; } catch (e) { /* ignore */ }
  const baseSet = adminViews.settings;
  adminViews.settings = function () {
    const html = baseSet.apply(this, arguments);
    if (session?.role !== 'admin' || !/class="btn on" data-subtab="perms"/.test(html)) return html;
    const i = html.indexOf('<div class="card subnav">'), e = i < 0 ? -1 : html.indexOf('</div></div>', i); if (e < 0) return html;
    const bar = `<div class="qseg" role="tablist" style="margin:0 0 1rem"><button type="button" data-permseg="app" class="${seg === 'app' ? 'on' : ''}" aria-selected="${seg === 'app'}">مهام التطبيق والأفراد</button><button type="button" data-permseg="stu" class="${seg === 'stu' ? 'on' : ''}" aria-selected="${seg === 'stu'}">صفحة الطلاب</button></div>`;
    /* قسم «مهام التطبيق والأفراد» (perms.js) لا يعرف استثناءات صفحة الطلاب: لا تظهر فيه مفاتيحها، فمكانها القسم الآخر */
    const app = () => html.slice(e + 12).replace(/<span class="tag[^"]*">[+−] ui\.stu\.[^<]*<\/span>\s*/g, '');
    return html.slice(0, e + 12) + bar + (seg === 'stu' ? view() : app());
  };
  document.addEventListener('click', ev => { const b = ev.target.closest?.('[data-permseg]'); if (!b) return; seg = b.dataset.permseg; try { sessionStorage.setItem(SEGK, seg); } catch (e) { /* ignore */ } render(); });

  document.addEventListener('change', e => {
    const t = e.target; if (!t.matches?.('[data-sup]') || session?.role !== 'admin') return;
    const [r, k] = t.dataset.sup.split('|');
    persist({ [r]: { [PK(k)]: t.checked } });
    /* «الكل» و«لا شيء» لهذه الفئة يتحدّثان في مكانهما (بلا إعادة رسم، فيبقى الجدول على موضع تمريره) */
    const n = ITEMS.filter(it => roleOn(r, it)).length, st = n === ITEMS.length ? '1' : n === 0 ? '0' : '';
    document.querySelectorAll(`[data-supall^="${r}|"]`).forEach(b => { const on = b.dataset.supall === `${r}|${st}`; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on); });
    toast('حُفظ');
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-supall]');
    if (a && session?.role === 'admin') { const [r, v] = a.dataset.supall.split('|'); persist({ [r]: Object.fromEntries(ITEMS.map(it => [PK(it[0]), v === '1'])) }); render(); toast('حُفظ'); return; }
    if (e.target.closest('[data-supreset]') && session?.role === 'admin') {
      ask('إعادة كل الاختيارات إلى الافتراضي؟', () => {
        persist(Object.fromEntries(ROLES4.map(([r]) => [r, Object.fromEntries(ITEMS.map(it => [PK(it[0]), it[3].includes(r)]))])));
        render(); toast('أُعيدت الاختيارات الافتراضية');
      });
    }
  });

  /* ===== التطبيق على صفحة «الطلاب» لغير المدير ===== */
  const myOn = it => {
    if (!session || session.role === 'admin') return true;
    if (!CLOUD || window.QLActAs?.()) { const o = personOv(session.id, it); return o !== undefined ? o : roleOn(session.role, it); }   // «العمل بصفة»: المدير يقرأ الاختيارات كلها
    const mp = db.myPerms || [];
    return mp.includes(SET) ? mp.includes(PK(it[0])) : it[3].includes(session.role);
  };
  const css = document.createElement('style'); document.head.appendChild(css);
  /* الجدول بلا غلاف .tbl: فلا يقطعه «عرض المزيد» عند الخمسين صفًا (pager.js) ولا تُضاف إليه أدوات الطباعة والحفظ */
  const css0 = document.createElement('style');
  css0.textContent = `.qsuptbl{overflow-x:auto;max-width:100%}.qsuptbl table{width:auto;min-width:0}
    .qsuptbl th,.qsuptbl td{text-align:center;white-space:nowrap}.qsuptbl .qnm{text-align:right;white-space:normal}`;
  document.head.appendChild(css0);
  let lastSig = '';
  function apply() {
    document.querySelectorAll('.overlay .scard').forEach(markCard);
    /* القواعد لصفحة «الطلاب» (ونوافذها) وحدها: لا تمسّ صفحات العامل الأخرى مثل «التحصيل» */
    const off = session && session.role !== 'admin' && ui.tab === 'students' ? ITEMS.filter(it => !myOn(it)) : [];
    const sig = (session?.role || '') + '|' + off.map(i => i[0]).join(',');
    if (sig !== lastSig) {
      lastSig = sig;
      /* «يظهر بلا ضغط»: باهت ورمادي حتى لا يبدو معطّلًا بلا سبب (اسم الطالب يبقى بلونه نصًا عاديًا).
         :not(#qz0) يرفع أولوية القاعدة فوق قواعد الملفات الأخرى (مثل إظهار «رسالة» في نافذة الحضور في attwin.js) */
      css.textContent = off.filter(i => i[5] === 'hide' || i[5] === 'lock').map(i => `${i[4].split(',').map(x => x.trim() + ':not(#qz0)').join(',')}{${i[5] === 'lock' ? 'pointer-events:none!important;cursor:not-allowed!important' + (i[0] === 'r_file' ? '' : ';opacity:.45!important;filter:grayscale(1)!important') : 'display:none!important'}}`).join('\n')
        + (off.some(i => i[0] === 'r_file') ? '\nmain .tbl [data-act="studentCard"]{color:inherit!important;text-decoration:none!important}' : '');
    }
    /* الأعمدة: بعنوانها في جداول صفحة الطلاب */
    const cols = off.filter(i => i[5] === 'col').map(i => i[4]);
    if (!cols.length || ui.tab !== 'students') return;
    document.querySelectorAll('main .tbl > table').forEach(tbl => {
      const head = [...tbl.rows].find(r => r.querySelector('th')); if (!head || [...head.cells].some(c => c.colSpan > 1)) return;
      const idx = [...head.cells].map((c, i) => cols.includes(c.textContent.trim()) ? i : -1).filter(i => i > -1);
      if (idx.length) [...tbl.rows].forEach(r => idx.forEach(i => { if (r.cells[i]) r.cells[i].style.display = 'none'; }));
    });
  }
  let raf = 0;
  new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { apply(); } catch (e) { /* ignore */ } }); }).observe(document.body, { childList: true, subtree: true });
  window.QLStuPerm = { ITEMS, can: k => { const it = ITEMS.find(i => i[0] === k); return it ? myOn(it) : true; } };
})();
