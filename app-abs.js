'use strict';
/* ============ غياب الشهر: يستبدل عمود الحضور بعدد الغياب + المكان ============ */
(() => {
  const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function absMonth(sid) {
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
    const prefix = `${fy}-${pad(fm)}`;
    return db.attendance.filter(a => a.studentId === sid && a.date?.startsWith(prefix) && (a.status === 'absent' || a.status === 'excused')).length;
  }
  function absLog(sid) {
    const s = byId(db.students, sid); if (!s) return;
    const all = db.attendance.filter(a => a.studentId === sid).sort((a, b) => b.date.localeCompare(a.date));
    const months = new Map();
    all.forEach(a => { const ym = a.date?.slice(0, 7); if (!ym) return; if (!months.has(ym)) months.set(ym, []); months.get(ym).push(a); });
    const stL = { present: 'حاضر', late: 'متأخر', excused: 'معتذر', absent: 'غائب' };
    const stC = { present: 'tag-ok', late: '', excused: '', absent: 'tag-no' };
    let html = '';
    for (const [ym, list] of months) {
      const [yy, mm] = ym.split('-').map(Number);
      const abs = list.filter(a => a.status === 'absent' || a.status === 'excused').length;
      const pres = list.filter(a => a.status === 'present' || a.status === 'late').length;
      html += `<h3 style="font-size:1rem;margin:1rem 0 .4rem">${MONTH_NAMES[mm - 1]} ${yy} <small class="muted">(حضور ${pres} \u00b7 غياب ${abs})</small></h3>`;
      html += `<div class="tbl"><table><tr><th>التاريخ</th><th>الحالة</th></tr>${list.map(a => `<tr><td dir="ltr" style="text-align:right">${esc(a.date)}</td><td><span class="tag ${stC[a.status] || ''}">${stL[a.status] || a.status}</span></td></tr>`).join('')}</table></div>`;
    }
    if (!html) html = empty('لا يوجد سجل حضور بعد.');
    openInfo('سجل الحضور والغياب: ' + s.name, html);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-abs-log]'); if (b) absLog(b.dataset.absLog); });

  /* استبدال دالة عرض الطلاب: المكان + غياب الشهر بدل الحضور */
  const _orig = adminViews.students;
  adminViews.students = function() {
    const list = db.students.filter(st => (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat));
    const F = window.QLFeesEmbed;
    const hasFees = !!F;
    const feeH = hasFees ? '<th>المستحق</th><th>المدفوع</th><th>الحالة</th>' : '';
    /* بطاقات الملخص مع إضافة اسم الشهر لبطاقة الإيرادات */
    let summaryHtml = hasFees ? F.summary(list) : '';
    if (summaryHtml) {
      const mn = MONTH_NAMES[(window.QLFees?.m || 1) - 1] + ' ' + (window.QLFees?.y || '');
      summaryHtml = summaryHtml.replace('<h3>الإيرادات</h3>', `<h3>الإيرادات \u2014 ${mn}</h3>`);
    }
    return `${summaryHtml}
    <div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب <span class="muted" style="font-size:.9rem">(${list.length})</span></h2>
    ${hasFees ? F.toolbar() : ''}
    <select data-change="fcat"><option value="">الصغار والكبار</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${ui.fcat === k ? 'selected' : ''}>${k === 'child' ? 'الصغار' : 'الكبار'}</option>`).join('')}</select>
    <select data-change="fh"><option value="">كل الحلقات</option>${db.halaqat.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>
    <button class="btn primary" data-act="addStudent">+ استمارة طالب</button></div>
    ${list.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الفئة</th><th>السن</th><th>الحلقة</th><th>المكان</th><th>آخر حفظ</th><th>غياب الشهر</th>${feeH}<th></th></tr>${list.map(st => `<tr><td><span class="who">${avatar(st)}<span>${esc(st.name)}${stOff(st) ? ' <span class="tag tag-no">منقطع</span>' : ''}</span></span></td><td><span class="tag ${st.cat === 'adult' ? 'tag-a' : ''}">${CATS[st.cat || 'child']}</span></td><td>${ageOf(st) === '' ? '\u2014' : ageOf(st)}</td><td>${esc(hName(st.halaqaId))}</td><td>${esc(placeName(byId(db.halaqat, st.halaqaId)) || '\u2014')}</td><td>${esc(lastHifz(st.id))}</td><td><button type="button" class="lnk" data-abs-log="${st.id}">${absMonth(st.id) || '\u0660'}</button></td>${hasFees ? F.cells(st) : ''}<td><button class="btn sm primary" data-act="studentCard" data-id="${st.id}">الملف</button><button class="btn sm" data-act="hist" data-id="${st.id}">السجل</button><button class="btn sm" data-act="editStudent" data-id="${st.id}">تعديل</button><button class="btn sm" data-stat="${st.id}">${stOff(st) ? 'منتظم' : 'منقطع'}</button>${db.fields.students.length ? `<button class="btn sm" data-act="editExtra" data-k="students" data-id="${st.id}">إضافية</button>` : ''}${hasFees ? F.actions(st) : ''}</td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب.')}</div>`;
  };
})();
