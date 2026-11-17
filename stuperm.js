'use strict';
/* ============ «الإعدادات ← صلاحيات صفحة الطلاب» ============
   جدول بكل عنصر وكل زر في صفحة «الطلاب» (ونافذة الحضور منها) أمام فئات العاملين: المعلمون، المشرفون، المحاسبون، الإداريون.
   المدير يرى كل شيء دائمًا. الاختيار يُحفظ مع الصلاحيات (db.settings.priv_perms.roles[الفئة]['ui.stu.…'])، فيصل كل عامل
   ما يخصه من الخادم عبر my_perms كبقية الصلاحيات، بلا تعديل على الخادم.
   هذا للعرض فقط: إظهار العنصر أو إخفاؤه. ما يغيّر البيانات (التحصيل، الحالة، النقل...) يبقى الخادم يتحقق من صلاحيته الأصلية.
   التطبيق على صفحة الطلاب لغير المدير يعمل متى عُرضت لهم (أسفل الملف): العنصر غير المسموح يُخفى، وما لا يُخفى (اسم الطالب،
   زر الحالة، تسجيل الحضور، التاريخ) يبقى ظاهرًا بلا ضغط. وقبل أول حفظ تسري الاختيارات الافتراضية في ITEMS. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./stuperm.js')) VFILES.push('./stuperm.js'); } catch (e) { /* ignore */ } });
  const ROLES4 = [['teacher', 'المعلمون'], ['supervisor', 'المشرفون'], ['accountant', 'المحاسبون'], ['placeadmin', 'الإداريون']];
  const T = 'teacher', S = 'supervisor', A = 'accountant', P = 'placeadmin', ALL = [T, S, A, P];
  /* [المفتاح، العنصر، المجموعة، الفئات المسموح لها افتراضيًا، المحدِّد، النوع: hide (يُخفى) | lock (يظهر بلا ضغط) | col (عمود بعنوانه)] */
  const ITEMS = [
    ['sum', 'بطاقة الاشتراكات كلها', 'بطاقة الاشتراكات', [A], 'main .feecard', 'hide'],
    ['sumstu', 'عدادات الطلاب (العدد، مسدّد، لم يسدّد، معفى)', 'بطاقة الاشتراكات', [A], 'main .feecard .qfstu', 'hide'],
    ['summon', 'عدادات المبالغ ونسبة التحصيل', 'بطاقة الاشتراكات', [A], 'main .feecard .qfmon', 'hide'],
    ['month', 'اختيار شهر الاشتراكات', 'بطاقة الاشتراكات', [A], 'main .feecard [data-fmonth]', 'hide'],
    ['tfees', 'تبويب «الاشتراكات»', 'تبويبات الصفحة', [A], 'main .subnav [data-svw="fees"]', 'hide'],
    ['tcol', 'تبويب «تحصيل المعلمين»', 'تبويبات الصفحة', [A], 'main .subnav [data-svw="tcollect"]', 'hide'],
    ['search', 'البحث باسم الطالب', 'أدوات الجدول', ALL, 'main input[data-sq]', 'hide'],
    ['place', 'قائمة المكان', 'أدوات الجدول', [S, A, P], 'main .qcombo:has([data-fplace]),main select[data-fplace]', 'hide'],
    ['halaqa', 'قائمة الحلقة', 'أدوات الجدول', [S, A, P], 'main .qcombo:has([data-change="fh"]),main select[data-change="fh"]', 'hide'],
    ['att', 'زر «الحضور» (نافذة تسجيل الحضور)', 'أدوات الجدول', [T, S, P], 'main [data-attopen]', 'hide'],
    ['seg', 'تبويبات الحالة (الكل / منتظم / منقطع)', 'أدوات الجدول', ALL, 'main [data-sstfseg]', 'hide'],
    ['zoom', 'حجم الخط', 'أدوات الجدول', ALL, 'main .qzoom', 'hide'],
    ['save', 'حفظ الجدول (Excel / PDF)', 'أدوات الجدول', [A], 'main .qsave', 'hide'],
    ['print', 'الطباعة', 'أدوات الجدول', ALL, 'main [data-print]', 'hide'],
    ['remindall', 'تذكير غير المسددين (الجرس)', 'أدوات الجدول', [A], 'main [data-remind-all]', 'hide'],
    ['add', 'إضافة طالب', 'أدوات الجدول', [], 'main [data-qadd],main [data-act="addStudent"]', 'hide'],
    ['c_age', 'عمود «السن»', 'أعمدة الجدول', [T, S, P], 'السن', 'col'],
    ['c_sys', 'عمود «الحضور» (نظام 6 / 3 أيام)', 'أعمدة الجدول', [S, A, P], 'الحضور', 'col'],
    ['c_hal', 'عمود «الحلقة»', 'أعمدة الجدول', ALL, 'الحلقة', 'col'],
    ['c_place', 'عمود «المكان»', 'أعمدة الجدول', ALL, 'المكان', 'col'],
    ['c_hifz', 'عمود «آخر حفظ»', 'أعمدة الجدول', [T, S, P], 'آخر حفظ', 'col'],
    ['c_stat', 'عمود «الحالة»', 'أعمدة الجدول', ALL, 'الحالة', 'col'],
    ['c_abs', 'عمود «غياب الشهر»', 'أعمدة الجدول', [T, S, P], 'غياب الشهر', 'col'],
    ['c_due', 'عمود «المستحق»', 'أعمدة الجدول', [A], 'المستحق', 'col'],
    ['r_file', 'فتح ملف الطالب (الضغط على اسمه)', 'أزرار صف الطالب', ALL, 'main .tbl [data-act="studentCard"]', 'lock'],
    ['r_hist', 'السجل', 'أزرار صف الطالب', [T, S, P], 'main .tbl td [data-act="hist"]', 'hide'],
    ['r_msg', 'رسالة', 'أزرار صف الطالب', [T, S, P], 'main .tbl td [data-mnote]:not([data-mnote="*"])', 'hide'],
    ['r_pay', 'تحصيل', 'أزرار صف الطالب', [A], 'main .tbl td [data-fee-pay2]', 'hide'],
    ['r_edit', 'تعديل بيانات الطالب', 'أزرار صف الطالب', [], 'main .tbl td [data-act="editStudent"]', 'hide'],
    ['r_extra', 'البيانات الإضافية', 'أزرار صف الطالب', [], 'main .tbl td [data-act="editExtra"]', 'hide'],
    ['r_remind', 'تذكير فردي بالسداد', 'أزرار صف الطالب', [A], 'main .tbl td [data-remind]', 'hide'],
    ['r_stat', 'تغيير الحالة (منتظم / منقطع)', 'أزرار صف الطالب', [], 'main .tbl [data-stat]', 'lock'],
    ['r_sys', 'تغيير نظام الحضور (6 / 3 أيام)', 'أزرار صف الطالب', [], 'main .tbl select[data-fsys]', 'lock'],
    ['a_mark', 'تسجيل الحضور (حاضر / غائب / متأخر)', 'نافذة الحضور', [T, S, P], '.qatt [data-act="att"]', 'lock'],
    ['a_date', 'تغيير تاريخ الحضور', 'نافذة الحضور', [S, P], '.qatt input[data-change="date"]', 'lock'],
    ['a_rec', 'تسجيل التسميع', 'نافذة الحضور', [T, S, P], '.qatt [data-act="rec"]', 'hide'],
    ['a_move', 'نقل الطالب إلى حلقة أخرى', 'نافذة الحضور', [S, P], '.qatt [data-move]', 'hide'],
    ['a_all', 'إشعار للطلاب (جماعي)', 'نافذة الحضور', [T, S, P], '.qatt [data-mnote="*"]', 'hide'],
    ['a_add', 'إضافة طالب من نافذة الحضور', 'نافذة الحضور', [], '.qatt [data-attadd]', 'hide']
  ];
  const PK = k => 'ui.stu.' + k, SET = 'ui.stu._set';
  const conf = () => (db.settings.priv_perms = db.settings.priv_perms || {}, db.settings.priv_perms.roles = db.settings.priv_perms.roles || {}, db.settings.priv_perms);
  const saved = r => (conf().roles[r] || {})[SET] === true;
  /* للمدير في الجدول: اختيار الفئة إن حُفظ، وإلا الافتراضي */
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
    const allRow = `<tr><td class="qnm muted">لكل الفئة</td>${ROLES4.map(([r]) => `<td><button type="button" class="btn sm" data-supall="${r}|1">الكل</button> <button type="button" class="btn sm" data-supall="${r}|0">لا شيء</button></td>`).join('')}</tr>`;
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">صلاحيات صفحة «الطلاب»</h2><button type="button" class="btn" data-supreset>الاختيارات الافتراضية</button></div>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">ما يظهر لكل فئة من العاملين في صفحة «الطلاب» ونافذة الحضور. المدير يرى كل شيء دائمًا. الإخفاء هنا للعرض فقط: ما يغيّر البيانات يتحقق منه الخادم بصلاحيته في «الصلاحيات».</p>
      <div class="tbl"><table><tr><th class="qnm">العنصر</th>${colAll}</tr>${allRow}${rows}</table></div></div>`;
  }
  (window.QLSetTabs = window.QLSetTabs || []).push({ key: 'stuperm', label: 'صلاحيات صفحة الطلاب', after: 'الصلاحيات', view });

  document.addEventListener('change', e => {
    const t = e.target; if (!t.matches?.('[data-sup]') || session?.role !== 'admin') return;
    const [r, k] = t.dataset.sup.split('|');
    persist({ [r]: { [PK(k)]: t.checked } });
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
    if (!CLOUD) return roleOn(session.role, it);
    const mp = db.myPerms || [];
    return mp.includes(SET) ? mp.includes(PK(it[0])) : it[3].includes(session.role);
  };
  const css = document.createElement('style'); document.head.appendChild(css);
  let lastSig = '';
  function apply() {
    const off = session && session.role !== 'admin' ? ITEMS.filter(it => !myOn(it)) : [];
    const sig = (session?.role || '') + '|' + off.map(i => i[0]).join(',');
    if (sig !== lastSig) {
      lastSig = sig;
      css.textContent = off.filter(i => i[5] !== 'col').map(i => `${i[4].split(',').map(x => x.trim()).join(',')}{${i[5] === 'lock' ? 'pointer-events:none!important;cursor:default!important' : 'display:none!important'}}`).join('\n')
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
