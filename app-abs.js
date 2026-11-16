'use strict';
/* ============ غياب الشهر + بطاقة اشتراكات موحّدة ============ */
(() => {
  const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  /* ---- غياب الشهر ---- */
  function absMonth(sid) {
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
    return db.attendance.filter(a => a.studentId === sid && a.date?.startsWith(`${fy}-${pad(fm)}`) && (a.status === 'absent' || a.status === 'excused')).length;
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

  /* ---- بطاقة اشتراكات موحّدة ---- */
  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const feeRow = (cls, v, l) => `<div class="feerow ${cls}"><span>${esc(l)}</span><b>${v}</b></div>`;

  function buildSummary(list) {
    if (!can('fees.collect') && !can('fees.amount')) return '';
    const F = window.QLFeesEmbed;
    if (!F) return '';
    F.summary(list);
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);

    const fees = Array.isArray(db.fees) ? db.fees : [];
    const pIdx = new Map();
    fees.forEach(f => { const k = f.studentId + '|' + (+f.y) + '|' + (+f.m); pIdx.set(k, (pIdx.get(k) || 0) + (+f.amount || 0)); });
    const paidFor = sid => pIdx.get(sid + '|' + fy + '|' + fm) || 0;
    const feeOf = window.QLFeeDue;
    let expected = 0, got = 0, paidN = 0, partN = 0, noneN = 0, freeN = 0, remaining = 0;
    const unpaid = [];
    list.forEach(s => {
      const fee = feeOf(s), paid = paidFor(s.id); got += paid;
      if (!stOff(s) && fee !== 0 && (fee ? paid < fee : !paid)) unpaid.push(s.id);
      if (stOff(s)) { /* skip */ }
      else if (fee === 0) freeN++;
      else if (fee) { expected += fee; if (paid >= fee) paidN++; else { remaining += fee - paid; if (paid > 0) partN++; else noneN++; } }
      else if (paid > 0) paidN++;
    });
    window.QLFees = { unpaid, y: fy, m: fm };
    window._QLFeesVisibleList = list;
    const pct = expected > 0 ? Math.round(got / expected * 100) : 0;

    const mOpts = [];
    for (let k = -12; k <= 2; k++) {
      const d = new Date(fy, fm - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1;
      mOpts.push(`<option value="${yy}-${mm}" ${yy === fy && mm === fm ? 'selected' : ''}>${MONTH_NAMES[mm - 1]} ${yy}</option>`);
    }

    return `<div class="card feecard" style="margin:0 0 1rem">
      <div style="display:flex;align-items:center;gap:.7rem;margin:0 0 .8rem;flex-wrap:wrap">
        <h3 style="margin:0;flex:1">\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a</h3>
        <select data-fmonth style="width:auto">${mOpts.join('')}</select>
      </div>
      <div class="feecards" style="margin:0">
        <div>
          ${feeRow('fr-ok', paidN, 'مسدَّد بالكامل')}
          ${feeRow('fr-no', noneN, 'لم يسدّد')}
          ${partN ? feeRow('', partN, 'سدّد جزئياً') : ''}
          ${feeRow('fr-info', freeN, 'معفى')}
        </div>
        <div>
          ${feeRow('fr-plain', money(expected), 'المتوقع')}
          ${feeRow('fr-ok', money(got), 'المحصّل')}
          ${feeRow('fr-no', money(remaining), 'الباقي')}
          <div class="feebar"><span style="width:${Math.min(pct, 100)}%"></span></div>
          <div class="feebar-label"><span>${pct}%</span><span>نسبة التحصيل</span></div>
        </div>
      </div>
    </div>
    ${unpaid.length && can('fees.collect') ? `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${unpaid.length} طالب لم يسدّد اشتراك ${MONTH_NAMES[fm - 1]}.</span><button type="button" class="btn sm" data-remind-all="fees">تذكير غير المسددين (${unpaid.length})</button></div>` : ''}`;
  }

  /* ---- استبدال دالة عرض الطلاب ---- */
  adminViews.students = function() {
    const list = db.students.filter(st => (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat));
    const F = window.QLFeesEmbed;
    const hasFees = !!F;
    const feeH = hasFees ? '<th>المستحق</th><th>المدفوع</th><th>الحالة</th>' : '';
    const toolbar = hasFees && (can('fees.collect') || can('fees.amount'))
      ? `${can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>إعدادات الاشتراك</button>' : ''}${can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : ''}`
      : '';
    return `${buildSummary(list)}
    <div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب <span class="muted" style="font-size:.9rem">(${list.length})</span></h2>
    ${toolbar}
    <select data-change="fcat"><option value="">الصغار والكبار</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${ui.fcat === k ? 'selected' : ''}>${k === 'child' ? 'الصغار' : 'الكبار'}</option>`).join('')}</select>
    <select data-change="fh"><option value="">كل الحلقات</option>${db.halaqat.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>
    <button class="btn primary" data-act="addStudent">+ استمارة طالب</button></div>
    ${list.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>الفئة</th><th>السن</th><th>الحلقة</th><th>المكان</th><th>آخر حفظ</th><th>غياب الشهر</th>${feeH}<th></th></tr>${list.map(st => `<tr><td><span class="who">${avatar(st)}<span>${esc(st.name)}${stOff(st) ? ' <span class="tag tag-no">منقطع</span>' : ''}</span></span></td><td><span class="tag ${st.cat === 'adult' ? 'tag-a' : ''}">${CATS[st.cat || 'child']}</span></td><td>${ageOf(st) === '' ? '\u2014' : ageOf(st)}</td><td>${esc(hName(st.halaqaId))}</td><td>${esc(placeName(byId(db.halaqat, st.halaqaId)) || '\u2014')}</td><td>${esc(lastHifz(st.id))}</td><td><button type="button" class="lnk" data-abs-log="${st.id}">${absMonth(st.id) || '\u0660'}</button></td>${hasFees ? F.cells(st) : ''}<td><button class="btn sm primary" data-act="studentCard" data-id="${st.id}">الملف</button><button class="btn sm" data-act="hist" data-id="${st.id}">السجل</button><button class="btn sm" data-act="editStudent" data-id="${st.id}">تعديل</button><button class="btn sm" data-stat="${st.id}">${stOff(st) ? 'منتظم' : 'منقطع'}</button>${db.fields.students.length ? `<button class="btn sm" data-act="editExtra" data-k="students" data-id="${st.id}">إضافية</button>` : ''}${hasFees ? F.actions(st) : ''}</td></tr>`).join('')}</table></div>` : empty('لا يوجد طلاب.')}</div>`;
  };
})();
