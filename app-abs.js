/* app-abs.js — safe wrapper */
(function() {
'use strict';
try {
  var MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  var css = document.createElement('style');
  css.textContent = 'tr.tr-off td{color:var(--red,#b3372f)!important;opacity:.75} tr.tr-off .tag,tr.tr-off .btn{opacity:.85} body,table,input,select,textarea,.card,.stat,.feerow,.feebar-label,.tbl,.tag,.btn,.modal{font-feature-settings:"tnum";-webkit-locale:"en"} .feerow b,.feebar-label span,.tag,.stat b,.stat .num{unicode-bidi:plaintext;direction:ltr}';
  document.head.appendChild(css);

  function cleanHName(hid) {
    try { var h = byId(db.halaqat, hid); if (!h) return '\u2014'; var t = byId(db.members, h.teacherId); return t ? t.name : (h.name || '\u2014'); } catch(e) { return '\u2014'; }
  }

  var _absCache = { key: '', absMap: {}, activeH: {} };
  function buildAbsIndex() {
    try {
      var fy = (window.QLFees && window.QLFees.y) || new Date().getFullYear();
      var fm = (window.QLFees && window.QLFees.m) || (new Date().getMonth() + 1);
      var key = fy + '-' + fm;
      if (_absCache.key === key) return _absCache;
      var prefix = fy + '-' + pad(fm);
      var absMap = {}, activeH = {};
      var stuH = {};
      var sts = db && db.students ? db.students : [];
      sts.forEach(function(s) { stuH[s.id] = s.halaqaId; });
      var att = db && db.attendance ? db.attendance : [];
      att.forEach(function(a) {
        if (!a.date || a.date.indexOf(prefix) !== 0) return;
        var hid = stuH[a.studentId];
        if (hid) activeH[hid] = true;
        if (a.status === 'absent' || a.status === 'excused') absMap[a.studentId] = (absMap[a.studentId] || 0) + 1;
      });
      _absCache = { key: key, absMap: absMap, activeH: activeH };
    } catch(e) { _absCache = { key: '', absMap: {}, activeH: {} }; }
    return _absCache;
  }

  function absMonthCell(st) {
    try {
      var idx = buildAbsIndex();
      var myAbs = idx.absMap[st.id] || 0;
      if (myAbs > 0) return '<button type="button" class="lnk" data-abs-log="' + st.id + '">' + myAbs + '</button>';
      if (idx.activeH[st.halaqaId]) return '<button type="button" class="lnk" data-abs-log="' + st.id + '">0</button>';
      return '<span class="muted" style="font-size:.8rem">غير مفعل</span>';
    } catch(e) { return '\u2014'; }
  }

  function absLog(sid) {
    try {
      var s = byId(db.students, sid); if (!s) return;
      var all = db.attendance.filter(function(a) { return a.studentId === sid; }).sort(function(a, b) { return b.date.localeCompare(a.date); });
      var months = {};
      all.forEach(function(a) { var ym = a.date ? a.date.slice(0, 7) : ''; if (!ym) return; if (!months[ym]) months[ym] = []; months[ym].push(a); });
      var stL = { present: 'حاضر', late: 'متأخر', excused: 'معتذر', absent: 'غائب' };
      var stC = { present: 'tag-ok', late: '', excused: '', absent: 'tag-no' };
      var html = '';
      Object.keys(months).sort().reverse().forEach(function(ym) {
        var list = months[ym]; var parts = ym.split('-'); var yy = +parts[0]; var mm = +parts[1];
        var abs = list.filter(function(a) { return a.status === 'absent' || a.status === 'excused'; }).length;
        var pres = list.filter(function(a) { return a.status === 'present' || a.status === 'late'; }).length;
        html += '<h3 style="font-size:1rem;margin:1rem 0 .4rem">' + MONTH_NAMES[mm - 1] + ' ' + yy + ' <small class="muted">(حضور ' + pres + ' · غياب ' + abs + ')</small></h3>';
        html += '<div class="tbl"><table><tr><th>التاريخ</th><th>الحالة</th></tr>' + list.map(function(a) { return '<tr><td dir="ltr" style="text-align:right">' + esc(a.date) + '</td><td><span class="tag ' + (stC[a.status] || '') + '">' + (stL[a.status] || a.status) + '</span></td></tr>'; }).join('') + '</table></div>';
      });
      if (!html) html = empty('لا يوجد سجل حضور بعد.');
      openInfo('سجل الحضور والغياب: ' + s.name, html);
    } catch(e) { console.error('absLog error:', e); }
  }
  document.addEventListener('click', function(e) { var b = e.target.closest('[data-abs-log]'); if (b) absLog(b.dataset.absLog); });

  function can(p) { try { return window.Perms ? Perms.can(p) : session && session.role === 'admin'; } catch(e) { return false; } }
  function money(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'); }
  function feeRow(cls, v, l) { return '<div class="feerow ' + cls + '"><span>' + esc(l) + '</span><b>' + v + '</b></div>'; }
  function getPaid(sid, y, m) { try { var fees = Array.isArray(db.fees) ? db.fees : []; var p = 0; fees.forEach(function(f) { if (f.studentId === sid && +f.y === y && +f.m === m) p += +f.amount || 0; }); return p; } catch(e) { return 0; } }

  function buildSummary(list) {
    try {
      if (!can('fees.collect') && !can('fees.amount')) return '';
      var F = window.QLFeesEmbed; if (!F) return '';
      F.summary(list);
      _absCache.key = '';
      var fy = (window.QLFees && window.QLFees.y) || new Date().getFullYear();
      var fm = (window.QLFees && window.QLFees.m) || (new Date().getMonth() + 1);
      var feeOf = window.QLFeeDue;
      var expected = 0, got = 0, paidN = 0, noneN = 0, freeN = 0, activeN = 0;
      var unpaid = [];
      list.forEach(function(s) {
        var fee = feeOf(s), paid = getPaid(s.id, fy, fm); got += paid;
        if (stOff(s)) return;
        activeN++;
        if (fee === 0) { freeN++; return; }
        if (fee) expected += fee;
        if (paid > 0) paidN++;
        else if (fee) { noneN++; unpaid.push(s.id); }
      });
      window.QLFees = { unpaid: unpaid, y: fy, m: fm };
      window._QLFeesVisibleList = list;
      var remaining = Math.max(0, expected - got);
      var pct = expected > 0 ? Math.round(got / expected * 100) : 0;
      var mOpts = '';
      for (var k = -12; k <= 2; k++) {
        var d = new Date(fy, fm - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1;
        mOpts += '<option value="' + yy + '-' + mm + '"' + (yy === fy && mm === fm ? ' selected' : '') + '>' + MONTH_NAMES[mm - 1] + ' ' + yy + '</option>';
      }
      return '<div class="card feecard" style="margin:0 0 1rem"><div style="display:flex;align-items:center;gap:.7rem;margin:0 0 .8rem;flex-wrap:wrap"><h3 style="margin:0;flex:1">الاشتراكات</h3><select data-fmonth style="width:auto">' + mOpts + '</select></div><div class="feecards" style="margin:0"><div>' + feeRow('fr-plain', activeN, 'عدد الطلاب') + feeRow('fr-ok', paidN, 'مسدَّد') + feeRow('fr-no', noneN, 'لم يسدّد') + feeRow('fr-info', freeN, 'معفى') + '</div><div>' + feeRow('fr-plain', money(expected), 'المتوقع') + feeRow('fr-ok', money(got), 'المحصّل') + feeRow('fr-no', money(remaining), 'الباقي') + '<div class="feebar"><span style="width:' + Math.min(pct, 100) + '%"></span></div><div class="feebar-label"><span>' + pct + '%</span><span>نسبة التحصيل</span></div></div></div></div>' + (unpaid.length && can('fees.collect') ? '<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">' + unpaid.length + ' طالب لم يسدّد اشتراك ' + MONTH_NAMES[fm - 1] + '.</span><button type="button" class="btn sm" data-remind-all="fees">تذكير غير المسددين (' + unpaid.length + ')</button></div>' : '');
    } catch(e) { console.error('buildSummary error:', e); return ''; }
  }

  if (window.QLFeesEmbed) {
    window.QLFeesEmbed.cells = function(s) {
      try {
        if (!can('fees.collect') && !can('fees.amount')) return '';
        var fee = window.QLFeeDue ? window.QLFeeDue(s) : null;
        var fy = (window.QLFees && window.QLFees.y) || new Date().getFullYear();
        var fm = (window.QLFees && window.QLFees.m) || (new Date().getMonth() + 1);
        var paid = getPaid(s.id, fy, fm);
        if (stOff(s)) return '<td><span class="muted">\u2014</span></td>';
        if (fee === 0) return '<td><span class="tag tag-ok">معفى</span></td>';
        if (fee == null) return '<td><span class="muted">\u2014</span></td>';
        if (paid > 0) return '<td><b style="color:var(--leaf,#4e7d45)">' + money(fee) + '</b><br><span class="tag tag-ok">مسدّد</span></td>';
        return '<td>' + money(fee) + '<br><span class="tag tag-no">مستحق</span></td>';
      } catch(e) { return '<td>\u2014</td>'; }
    };
    window.QLFeesEmbed.actions = function(s) {
      try {
        if (!can('fees.collect') && !can('fees.amount')) return '';
        var fee = window.QLFeeDue ? window.QLFeeDue(s) : null;
        var paid = getPaid(s.id, window.QLFees && window.QLFees.y, window.QLFees && window.QLFees.m);
        var needRemind = can('fees.collect') && !stOff(s) && fee !== 0 && fee && paid <= 0;
        return (can('fees.collect') ? '<button type="button" class="btn sm primary" data-fee-pay2="' + esc(s.id) + '"' + (fee === 0 ? ' disabled' : '') + '>تحصيل</button>' : '') + (needRemind ? '<button type="button" class="btn sm" data-remind="' + esc(s.id) + '" title="تذكير">تذكير</button>' : '');
      } catch(e) { return ''; }
    };
  }

  /* نافذة تحصيل */
  document.addEventListener('click', function(e) {
    try {
      var b = e.target.closest('[data-fee-pay2]'); if (!b || !can('fees.collect')) return;
      e.stopPropagation();
      var sid = b.dataset.feePay2, s = byId(db.students, sid); if (!s) return;
      var feeOf = window.QLFeeDue, fee = feeOf ? feeOf(s) : null;
      var fy = (window.QLFees && window.QLFees.y) || new Date().getFullYear(), fm = (window.QLFees && window.QLFees.m) || (new Date().getMonth() + 1);
      var mOpts = '';
      for (var k = -12; k <= 2; k++) { var d = new Date(fy, fm - 1 + k, 1), yy = d.getFullYear(), mm = d.getMonth() + 1; mOpts += '<option value="' + yy + '-' + mm + '"' + (yy === fy && mm === fm ? ' selected' : '') + '>' + MONTH_NAMES[mm - 1] + ' ' + yy + '</option>'; }
      var ov = document.createElement('div'); ov.className = 'overlay';
      ov.innerHTML = '<div class="modal"><h2>تحصيل اشتراك: ' + esc(s.name) + '</h2>' + (fee ? '<p class="muted" style="margin:0 0 .6rem">المستحق: ' + money(fee) + ' جنيه</p>' : '') + '<label>المبلغ<input type="number" min="0" name="amount" value="' + (fee || '') + '" required></label><label>عن شهر<select name="month">' + mOpts + '</select></label><label>تاريخ<input type="date" name="date" value="' + today() + '"></label><label>ملاحظة<input name="note"></label><div data-reason-wrap hidden><label>سبب مبلغ أقل<select name="reason"><option value="">— اختر —</option><option value="متأخر">متأخر</option><option value="حالة خاصة">حالة خاصة</option></select></label></div><div class="row"><button type="button" class="btn primary" data-dosave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('[data-close]').onclick = function() { ov.remove(); };
      var ai = ov.querySelector('[name=amount]'), rw = ov.querySelector('[data-reason-wrap]');
      ai.addEventListener('input', function() { var need = fee && +ai.value > 0 && +ai.value < fee; rw.hidden = !need; });
      ov.querySelector('[data-dosave]').onclick = function() {
        var amt = +ai.value; if (!(amt > 0)) { toast('اكتب مبلغاً'); return; }
        if (fee && amt < fee && !ov.querySelector('[name=reason]').value) { toast('اختر السبب'); return; }
        var parts = ov.querySelector('[name=month]').value.split('-'), sy = +parts[0], sm = +parts[1];
        var reason = ov.querySelector('[name=reason]').value;
        var note = [(ov.querySelector('[name=note]').value || '').trim(), reason].filter(Boolean).join(' — ');
        var f = { id: uid(), studentId: sid, y: sy, m: sm, amount: amt, date: ov.querySelector('[name=date]').value || today(), by: (typeof me === 'function' && me()) ? me().name : '', byMember: session ? session.id : '', note: note };
        if (!Array.isArray(db.fees)) db.fees = [];
        db.fees.push(f);
        ov.remove();
        toast('تم تسجيل ' + money(amt) + ' جنيه لـ«' + s.name + '»');
        save(); render();
      };
    } catch(e) { console.error('pay2 error:', e); }
  }, true);

  /* ملف الطالب */
  var _origCard = typeof studentCard === 'function' ? studentCard : null;
  if (_origCard) {
    window.studentCard = function(st) {
      try { if (!st) return _origCard(st); } catch(e) { return; }
      _origCard(st);
      setTimeout(function() {
        try {
          var modal = document.querySelector('.overlay:last-child .scard'); if (!modal) return;
          var fees = (Array.isArray(db.fees) ? db.fees : []).filter(function(f) { return f.studentId === st.id; }).sort(function(a, b) { return (b.y * 100 + b.m) - (a.y * 100 + a.m); });
          var total = fees.reduce(function(a, f) { return a + (+f.amount || 0); }, 0);
          var due = window.QLFeeDue ? window.QLFeeDue(st) : null;
          var I = st.info || {};
          var catHtml = '<h3 class="sc-h">الاشتراك</h3><div class="tbl"><table><tr><th>المستحق</th><td>' + (due != null ? money(due) + ' جنيه' : 'غير محدد') + '</td></tr></table></div>';
          if (can('fees.amount')) catHtml += '<div class="row noprint" style="margin:.4rem 0"><button class="btn sm" data-fee-assign="' + esc(st.id) + '">تعديل الفئة</button></div>';
          var logHtml = '<h3 class="sc-h">سجل الاشتراكات</h3>';
          if (fees.length) {
            logHtml += '<div class="tbl"><table><tr><th>الشهر</th><th>المبلغ</th><th>التاريخ</th></tr>';
            fees.slice(0, 20).forEach(function(f) { logHtml += '<tr><td>' + MONTH_NAMES[(f.m||1)-1] + ' ' + f.y + '</td><td>' + money(f.amount) + '</td><td dir="ltr" style="text-align:right">' + esc(f.date||'') + '</td></tr>'; });
            logHtml += '<tr class="sum"><td>الإجمالي</td><td>' + money(total) + '</td><td></td></tr></table></div>';
          } else logHtml += empty('لا توجد دفعات.');
          var btns = modal.querySelector('.row.noprint:last-child');
          if (btns) btns.insertAdjacentHTML('beforebegin', catHtml + logHtml);
          else modal.insertAdjacentHTML('beforeend', catHtml + logHtml);
        } catch(e) { console.error('studentCard ext error:', e); }
      }, 80);
    };
    studentCard = window.studentCard;
  }

  /* جدول الطلاب */
  adminViews.students = function() {
    try {
      var list = db.students.filter(function(st) { return (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat); });
      var F = window.QLFeesEmbed, hasFees = !!F;
      var feeH = hasFees ? '<th>المستحق</th>' : '';
      var toolbar = hasFees && (can('fees.collect') || can('fees.amount'))
        ? (can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>إعدادات الاشتراك</button>' : '') + (can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>تعيين لنتائج البحث</button>' : '') : '';
      var rows = list.map(function(st) {
        var off = stOff(st);
        return '<tr' + (off ? ' class="tr-off"' : '') + '><td><span class="who">' + avatar(st) + '<span>' + esc(st.name) + '</span></span></td><td>' + (ageOf(st) === '' ? '\u2014' : ageOf(st)) + '</td><td>' + esc(cleanHName(st.halaqaId)) + '</td><td>' + esc(placeName(byId(db.halaqat, st.halaqaId)) || '\u2014') + '</td><td>' + esc(lastHifz(st.id)) + '</td><td><button type="button" class="btn sm' + (off ? ' danger' : '') + '" data-stat="' + st.id + '">' + (off ? 'منقطع' : 'منتظم') + '</button></td><td>' + absMonthCell(st) + '</td>' + (hasFees ? F.cells(st) : '') + '<td><button class="btn sm primary" data-act="studentCard" data-id="' + st.id + '">الملف</button><button class="btn sm" data-act="hist" data-id="' + st.id + '">السجل</button><button class="btn sm" data-act="editStudent" data-id="' + st.id + '">تعديل</button>' + (db.fields.students.length ? '<button class="btn sm" data-act="editExtra" data-k="students" data-id="' + st.id + '">إضافية</button>' : '') + (hasFees ? F.actions(st) : '') + '</td></tr>';
      }).join('');
      return buildSummary(list) + '<div class="card"><div class="bar"><h2 class="grow" style="margin:0">الطلاب</h2>' + toolbar + '<select data-change="fcat"><option value="">الصغار والكبار</option>' + Object.keys(CATS).map(function(k) { return '<option value="' + k + '"' + (ui.fcat === k ? ' selected' : '') + '>' + (k === 'child' ? 'الصغار' : 'الكبار') + '</option>'; }).join('') + '</select><select data-change="fh"><option value="">كل الحلقات</option>' + db.halaqat.map(function(h) { return '<option value="' + esc(h.id) + '"' + (h.id === ui.fh ? ' selected' : '') + '>' + esc(halaqaLabel(h)) + '</option>'; }).join('') + '</select><button class="btn primary" data-act="addStudent">+ استمارة طالب</button></div>' + (list.length ? '<div class="tbl"><table><tr><th>الاسم</th><th>السن</th><th>الحلقة</th><th>المكان</th><th>آخر حفظ</th><th>الحالة</th><th>غياب الشهر</th>' + feeH + '<th></th></tr>' + rows + '</table></div>' : empty('لا يوجد طلاب.')) + '</div>';
    } catch(e) {
      console.error('adminViews.students error:', e);
      return '<div class="card"><p style="color:red">خطأ في عرض الطلاب: ' + String(e.message || e) + '</p></div>';
    }
  };

} catch(e) {
  console.error('app-abs.js FATAL:', e);
}
})();
