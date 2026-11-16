'use strict';
/* ============ غياب الشهر + اشتراكات موحّدة + ملف الطالب + عمود المستحق المدمج ============ */
(() => {
  const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const css = document.createElement('style');
  css.textContent = `
    tr.tr-off td{color:var(--red,#b3372f)!important;opacity:.75} tr.tr-off .tag,tr.tr-off .btn{opacity:.85}
    /* أرقام إنجليزية في كل التطبيق */
    body,table,input,select,textarea,.card,.stat,.feerow,.feebar-label,.tbl,.tag,.btn,.modal{font-feature-settings:"tnum";-webkit-locale:"en"}
    .feerow b,.feebar-label span,.tag,.stat b,.stat .num{unicode-bidi:plaintext;direction:ltr}
  `;
  document.head.appendChild(css);

  const cleanHName = (hid) => {
    const h = byId(db.halaqat, hid); if (!h) return '\u2014';
    const teacher = byId(db.members, h.teacherId);
    return teacher ? teacher.name : (h.name || '\u2014');
  };

  /* ---- غياب الشهر: تمييز «غير مفعل» عن «صفر حقيقي» ---- */
  function absMonthCell(st) {
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
    const prefix = `${fy}-${pad(fm)}`;
    const myAbs = db.attendance.filter(a => a.studentId === st.id && a.date?.startsWith(prefix) && (a.status === 'absent' || a.status === 'excused')).length;
    if (myAbs > 0) return `<button type="button" class="lnk" data-abs-log="${st.id}">${myAbs}</button>`;
    /* صفر — هل الحلقة فيها تسجيل حضور هذا الشهر أصلاً؟ */
    const peers = db.students.filter(s => s.halaqaId === st.halaqaId).map(s => s.id);
    const halaqaHasAtt = db.attendance.some(a => peers.includes(a.studentId) && a.date?.startsWith(prefix));
    if (halaqaHasAtt) return `<button type="button" class="lnk" data-abs-log="${st.id}">0</button>`;
    return `<span class="muted" style="font-size:.8rem">غير مفعل</span>`;
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

  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const feeRow = (cls, v, l) => `<div class="feerow ${cls}"><span>${esc(l)}</span><b>${v}</b></div>`;
  const getPaid = (sid, y, m) => { const fees = Array.isArray(db.fees) ? db.fees : []; let p = 0; fees.forEach(f => { if (f.studentId === sid && +f.y === y && +f.m === m) p += +f.amount || 0; }); return p; };

  function buildSummary(list) {
    if (!can('fees.collect') && !can('fees.amount')) return '';
    const F = window.QLFeesEmbed; if (!F) return '';
    F.summary(list);
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
    const feeOf = window.QLFeeDue;
    let expected = 0, got = 0, paidN = 0, noneN = 0, freeN = 0, activeN = 0;
    const unpaid = [];
    list.forEach(s => {
      const fee = feeOf(s), paid = getPaid(s.id, fy, fm); got += paid;
      if (stOff(s)) return;
      activeN++;
      if (fee === 0) { freeN++; return; }
      if (fee) expected += fee;
      if (paid > 0) { paidN++; }
      else if (fee) { noneN++; unpaid.push(s.id); }
    });
    window.QLFees = { unpaid, y: fy, m: fm };
    window._QLFeesVisibleList = list;
    const remaining = Math.max(0, expected - got);
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
        <div>${feeRow('fr-plain', activeN, 'عدد الطلاب')}${feeRow('fr-ok', paidN, 'مسدَّد')}${feeRow('fr-no', noneN, 'لم يسدّد')}${feeRow('fr-info', freeN, 'معفى')}</div>
        <div>${feeRow('fr-plain', money(expected), 'المتوقع')}${feeRow('fr-ok', money(got), 'المحصّل')}${feeRow('fr-no', money(remaining), 'الباقي')}
          <div class="feebar"><span style="width:${Math.min(pct, 100)}%"></span></div>
          <div class="feebar-label"><span>${pct}%</span><span>نسبة التحصيل</span></div></div>
      </div>
    </div>
    ${unpaid.length && can('fees.collect') ? `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${unpaid.length} طالب لم يسدّد اشتراك ${MONTH_NAMES[fm - 1]}.</span><button type="button" class="btn sm" data-remind-all="fees">تذكير غير المسددين (${unpaid.length})</button></div>` : ''}`;
  }

  if (window.QLFeesEmbed) {
    window.QLFeesEmbed.cells = function(s) {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      const fee = window.QLFeeDue?.(s) ?? null;
      const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
      const paid = getPaid(s.id, fy, fm), off = stOff(s);
      if (off) return '<td><span class="muted">\u2014</span></td>';
      if (fee === 0) return '<td><span class="tag tag-ok">معفى</span></td>';
      if (fee == null) return '<td><span class="muted">\u2014</span></td>';
      if (paid > 0) return `<td><b style="color:var(--leaf,#4e7d45)">${money(fee)}</b><br><span class="tag tag-ok">مسدّد</span></td>`;
      return `<td>${money(fee)}<br><span class="tag tag-no">مستحق</span></td>`;
    };
    window.QLFeesEmbed.actions = function(s) {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      const fee = window.QLFeeDue?.(s) ?? null, off = stOff(s);
      const cloudMissing = typeof CLOUD !== 'undefined' && CLOUD && window.Cloud?.feesReady === false;
      const paid = getPaid(s.id, window.QLFees?.y, window.QLFees?.m);
      const needRemind = can('fees.collect') && !off && fee !== 0 && fee && paid <= 0;
      return `${can('fees.collect') ? `<button type="button" class="btn sm primary" data-fee-pay2="${esc(s.id)}" ${cloudMissing || fee === 0 ? 'disabled' : ''}>تحصيل</button>` : ''}${needRemind ? `<button type="button" class="btn sm" data-remind="${esc(s.id)}" title="تذكير">تذكير</button>` : ''}`;
    };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fee-pay2]'); if (!b || !can('fees.collect')) return;
    e.stopPropagation();
    const sid = b.dataset.feePay2;
    const s = byId(db.students, sid); if (!s) return;
    const feeOf = window.QLFeeDue;
    const fee = feeOf ? feeOf(s) : null;
    const fy = window.QLFees?.y || new Date().getFullYear(), fm = window.QLFees?.m || (new Date().getMonth() + 1);
    const monthOpts = [];
    for (let k = -12; k <= 2; k++) {
      const d = new Date(fy, fm - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1;
      monthOpts.push(`<option value="${yy}-${mm}" ${yy === fy && mm === fm ? 'selected' : ''}>${MONTH_NAMES[mm - 1]} ${yy}</option>`);
    }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>تحصيل اشتراك: ${esc(s.name)}</h2>
      ${fee ? `<p class="muted" style="margin:0 0 .6rem">المستحق: ${money(fee)} جنيه</p>` : ''}
      <label>المبلغ (جنيه)<input type="number" min="0" name="amount" value="${fee || ''}" required></label>
      <label>عن شهر<select name="month">${monthOpts.join('')}</select></label>
      <label>تاريخ التحصيل<input type="date" name="date" value="${today()}"></label>
      <label>ملاحظة (اختياري)<input name="note"></label>
      <div data-reason-wrap hidden style="margin:.5rem 0">
        <label>سبب دفع مبلغ أقل<select name="reason" required><option value="">— اختر السبب —</option><option value="متأخر">متأخر</option><option value="حالة خاصة">حالة خاصة</option></select></label>
      </div>
      <div class="row"><button type="button" class="btn primary" data-dosave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    const amtInput = ov.querySelector('[name=amount]');
    const reasonWrap = ov.querySelector('[data-reason-wrap]');
    const checkReason = () => { const amt = +amtInput.value || 0; const need = fee && amt > 0 && amt < fee; reasonWrap.hidden = !need; if (!need) ov.querySelector('[name=reason]').value = ''; };
    amtInput.addEventListener('input', checkReason);
    ov.querySelector('[data-dosave]').onclick = () => {
      const amt = +amtInput.value;
      if (!(amt > 0)) { toast('اكتب مبلغاً صحيحاً'); return; }
      if (fee && amt < fee && !ov.querySelector('[name=reason]').value) { toast('اختر سبب دفع مبلغ أقل من المستحق'); return; }
      const [sy, sm] = ov.querySelector('[name=month]').value.split('-').map(Number);
      const reason = ov.querySelector('[name=reason]').value;
      const note = [(ov.querySelector('[name=note]').value || '').trim(), reason].filter(Boolean).join(' — ');
      const f = { id: uid(), studentId: sid, y: sy, m: sm, amount: amt, date: ov.querySelector('[name=date]').value || today(), by: me()?.name || '', byMember: session?.id || '', note };
      (Array.isArray(db.fees) ? db.fees : (db.fees = [])).push(f);
      ov.remove();
      if (window.QLReceipt) setTimeout(() => window.QLReceipt.offer(f), 60);
      else toast(`تم تسجيل ${money(amt)} جنيه لـ«${s.name}» عن ${MONTH_NAMES[sm - 1]} ${sy}`);
      save(); render();
    };
  }, true);

  const _origCard = typeof studentCard === 'function' ? studentCard : null;
  if (_origCard) {
    window.studentCard = function(st) {
      if (!st) return _origCard(st);
      _origCard(st);
      setTimeout(() => {
        const modal = document.querySelector('.overlay:last-child .scard');
        if (!modal) return;
        const fees = (Array.isArray(db.fees) ? db.fees : []).filter(f => f.studentId === st.id).sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m) || String(b.date).localeCompare(String(a.date)));
        const total = fees.reduce((a, f) => a + (+f.amount || 0), 0);
        const due = window.QLFeeDue ? window.QLFeeDue(st) : null;
        const I = st.info || {};
        let catHtml = '<h3 class="sc-h">الاشتراك</h3><div class="tbl"><table>';
        catHtml += `<tr><th>المستحق الشهري</th><td>${due != null ? money(due) + ' جنيه' : 'غير محدد'}</td></tr>`;
        if (I.fee) catHtml += `<tr><th>مبلغ خاص</th><td>${money(I.fee)} جنيه</td></tr>`;
        if (I.feeDisc) {
          const discs = Array.isArray((db.settings.priv_fees || {}).discs) ? db.settings.priv_fees.discs : [];
          const d = discs.find(x => x.id === I.feeDisc);
          if (d) catHtml += `<tr><th>الخصم</th><td>${esc(d.name)} (${d.value}%)</td></tr>`;
        }
        catHtml += '</table></div>';
        if (can('fees.amount')) catHtml += `<div class="row noprint" style="margin:.4rem 0"><button class="btn sm" data-fee-assign="${esc(st.id)}">تعديل الفئة والخصم</button></div>`;
        let logHtml = '<h3 class="sc-h">سجل الاشتراكات</h3>';
        if (fees.length) {
          logHtml += '<div class="tbl"><table><tr><th>الشهر</th><th>المبلغ</th><th>التاريخ</th><th>حصّلها</th><th>ملاحظة</th></tr>';
          fees.slice(0, 24).forEach(f => { logHtml += `<tr><td>${MONTH_NAMES[(f.m||1)-1]} ${f.y}</td><td>${money(f.amount)}</td><td dir="ltr" style="text-align:right">${esc(f.date||'')}</td><td>${esc(f.by||'')}</td><td>${esc(f.note||'')}</td></tr>`; });
          logHtml += `<tr class="sum"><td>الإجمالي</td><td>${money(total)}</td><td colspan="3"></td></tr></table></div>`;
          if (fees.length > 24) logHtml += `<p class="muted">آخر 24 دفعة من ${fees.length}.</p>`;
        } else logHtml += empty('لا توجد دفعات مسجّلة.');
        const btns = modal.querySelector('.row.noprint:last-child');
        if (btns) btns.insertAdjacentHTML('beforebegin', catHtml + logHtml);
        else modal.insertAdjacentHTML('beforeend', catHtml + logHtml);
      }, 50);
    };
    studentCard = window.studentCard;
  }

  adminViews.students = function() {
    const list = db.students.filter(st => (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat));
    const F = window.QLFeesEmbed;
    const hasFees = !!F;
    const feeH = hasFees ? '<th>المستحق</th>' : '';
    const toolbar = hasFees && (can('fees.collect') || can('fees.amount'))
      ? `${can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>إعدادات الاشتراك</button>' : ''}${can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : ''}` : '';
    return `${buildSummary(list)}
    <div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب</h2>
    ${toolbar}
    <select data-change="fcat"><option value="">الصغار والكبار</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${ui.fcat === k ? 'selected' : ''}>${k === 'child' ? 'الصغار' : 'الكبار'}</option>`).join('')}</select>
    <select data-change="fh"><option value="">كل الحلقات</option>${db.halaqat.map(h => `<option value="${esc(h.id)}" ${h.id === ui.fh ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>
    <button class="btn primary" data-act="addStudent">+ استمارة طالب</button></div>
    ${list.length ? `<div class="tbl"><table><tr><th>الاسم</th><th>السن</th><th>الحلقة</th><th>المكان</th><th>آخر حفظ</th><th>الحالة</th><th>غياب الشهر</th>${feeH}<th></th></tr>${list.map(st => {
      const off = stOff(st);
      return `<tr${off ? ' class="tr-off"' : ''}><td><span class="who">${avatar(st)}<span>${esc(st.name)}</span></span></td><td>${ageOf(st) === '' ? '\u2014' : ageOf(st)}</td><td>${esc(cleanHName(st.halaqaId))}</td><td>${esc(placeName(byId(db.halaqat, st.halaqaId)) || '\u2014')}</td><td>${esc(lastHifz(st.id))}</td><td><button type="button" class="btn sm${off ? ' danger' : ''}" data-stat="${st.id}">${off ? 'منقطع' : 'منتظم'}</button></td><td>${absMonthCell(st)}</td>${hasFees ? F.cells(st) : ''}<td><button class="btn sm primary" data-act="studentCard" data-id="${st.id}">الملف</button><button class="btn sm" data-act="hist" data-id="${st.id}">السجل</button><button class="btn sm" data-act="editStudent" data-id="${st.id}">تعديل</button>${db.fields.students.length ? `<button class="btn sm" data-act="editExtra" data-k="students" data-id="${st.id}">إضافية</button>` : ''}${hasFees ? F.actions(st) : ''}</td></tr>`;
    }).join('')}</table></div>` : empty('لا يوجد طلاب.')}</div>`;
  };
})();
