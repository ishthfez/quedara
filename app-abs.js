/* app-abs.js — safe wrapper */
(function() {
'use strict';
try {
  var MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  var css = document.createElement('style');
  css.textContent = 'tr.tr-off td{color:var(--red,#b3372f)!important;opacity:.75} tr.tr-off .tag,tr.tr-off .btn{opacity:.85} body,table,input,select,textarea,.card,.stat,.feerow,.feebar-label,.tbl,.tag,.btn,.modal{font-feature-settings:"tnum";-webkit-locale:"en"} .feerow b,.feebar-label span,.tag,.stat b,.stat .num{unicode-bidi:plaintext;direction:ltr} .tbl table tr td .hname .tag,.tbl table tr td .hname small{display:none!important}';
  document.head.appendChild(css);

  function cleanHName(hid) {
    try {
      return '<span class="hname">' + hName(hid) + '</span>';
    } catch(e) { return '\u2014'; }
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
      (db && db.students ? db.students : []).forEach(function(s) { stuH[s.id] = s.halaqaId; });
      (db && db.attendance ? db.attendance : []).forEach(function(a) {
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
      return '<span class="muted" style="font-size:.8rem">\u063a\u064a\u0631 \u0645\u0641\u0639\u0644</span>';
    } catch(e) { return '\u2014'; }
  }

  function absLog(sid) {
    try {
      var s = byId(db.students, sid); if (!s) return;
      var all = db.attendance.filter(function(a) { return a.studentId === sid; }).sort(function(a, b) { return b.date.localeCompare(a.date); });
      var months = {};
      all.forEach(function(a) { var ym = a.date ? a.date.slice(0, 7) : ''; if (!ym) return; if (!months[ym]) months[ym] = []; months[ym].push(a); });
      var stL = { present: '\u062d\u0627\u0636\u0631', late: '\u0645\u062a\u0623\u062e\u0631', excused: '\u0645\u0639\u062a\u0630\u0631', absent: '\u063a\u0627\u0626\u0628' };
      var stC = { present: 'tag-ok', late: '', excused: '', absent: 'tag-no' };
      var html = '';
      Object.keys(months).sort().reverse().forEach(function(ym) {
        var list = months[ym]; var parts = ym.split('-'); var yy = +parts[0]; var mm = +parts[1];
        var abs = list.filter(function(a) { return a.status === 'absent' || a.status === 'excused'; }).length;
        var pres = list.filter(function(a) { return a.status === 'present' || a.status === 'late'; }).length;
        html += '<h3 style="font-size:1rem;margin:1rem 0 .4rem">' + MONTH_NAMES[mm - 1] + ' ' + yy + ' <small class="muted">(\u062d\u0636\u0648\u0631 ' + pres + ' \u00b7 \u063a\u064a\u0627\u0628 ' + abs + ')</small></h3>';
        html += '<div class="tbl"><table><tr><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th></tr>' + list.map(function(a) { return '<tr><td dir="ltr" style="text-align:right">' + esc(a.date) + '</td><td><span class="tag ' + (stC[a.status] || '') + '">' + (stL[a.status] || a.status) + '</span></td></tr>'; }).join('') + '</table></div>';
      });
      if (!html) html = empty('\u0644\u0627 \u064a\u0648\u062c\u062f \u0633\u062c\u0644 \u062d\u0636\u0648\u0631 \u0628\u0639\u062f.');
      openInfo('\u0633\u062c\u0644 \u0627\u0644\u062d\u0636\u0648\u0631 \u0648\u0627\u0644\u063a\u064a\u0627\u0628: ' + s.name, html);
    } catch(e) { console.error('absLog error:', e); }
  }
  document.addEventListener('click', function(e) { var b = e.target.closest('[data-abs-log]'); if (b) absLog(b.dataset.absLog); });

  function can(p) { try { return window.Perms ? Perms.can(p) : session && session.role === 'admin'; } catch(e) { return false; } }
  function money(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'); }
  function feeRow(cls, v, l) { return '<div class="feerow ' + cls + '"><span>' + esc(l) + '</span><b>' + v + '</b></div>'; }
  /* المدفوع للطالب في شهر: من فهرس يُبنى مرة واحدة لكل رسم (كان يمر على كل الدفعات لكل طالب، فيبطئ قسم الطلاب كثيرًا).
     يُبنى من جديد إن تغيّرت مصفوفة الدفعات أو عددها، ويُلغى بعد انتهاء الرسم الحالي فيلتقط أي تعديل لاحق على مبلغ. */
  var _pIdx = null, _pRef = null, _pLen = -1;
  function getPaid(sid, y, m) { try { var fees = Array.isArray(db.fees) ? db.fees : []; if (!_pIdx || _pRef !== fees || _pLen !== fees.length) { var I = new Map(); fees.forEach(function(f) { var k = f.studentId + '|' + (+f.y) + '|' + (+f.m); I.set(k, (I.get(k) || 0) + (+f.amount || 0)); }); _pIdx = I; _pRef = fees; _pLen = fees.length; setTimeout(function() { _pIdx = null; }, 0); } return _pIdx.get(sid + '|' + (+y) + '|' + (+m)) || 0; } catch(e) { return 0; } }

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
      return '<div class="card feecard" style="margin:0 0 1rem"><div style="display:flex;align-items:center;gap:.7rem;margin:0 0 .8rem;flex-wrap:wrap"><h3 style="margin:0;flex:1">\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a</h3><select data-fmonth style="width:auto">' + mOpts + '</select></div><div class="feecards" style="margin:0"><div>' + feeRow('fr-plain', activeN, '\u0639\u062f\u062f \u0627\u0644\u0637\u0644\u0627\u0628') + feeRow('fr-ok', paidN, '\u0645\u0633\u062f\u064e\u0651\u062f') + feeRow('fr-no', noneN, '\u0644\u0645 \u064a\u0633\u062f\u0651\u062f') + feeRow('fr-info', freeN, '\u0645\u0639\u0641\u0649') + '</div><div>' + feeRow('fr-plain', money(expected), '\u0627\u0644\u0645\u062a\u0648\u0642\u0639') + feeRow('fr-ok', money(got), '\u0627\u0644\u0645\u062d\u0635\u0651\u0644') + feeRow('fr-no', money(remaining), '\u0627\u0644\u0628\u0627\u0642\u064a') + '<div class="feebar"><span style="width:' + Math.min(pct, 100) + '%"></span></div><div class="feebar-label"><span>' + pct + '%</span><span>\u0646\u0633\u0628\u0629 \u0627\u0644\u062a\u062d\u0635\u064a\u0644</span></div></div></div></div>' + (unpaid.length && can('fees.collect') ? '<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">' + unpaid.length + ' \u0637\u0627\u0644\u0628 \u0644\u0645 \u064a\u0633\u062f\u0651\u062f \u0627\u0634\u062a\u0631\u0627\u0643 ' + MONTH_NAMES[fm - 1] + '.</span><button type="button" class="btn sm" data-remind-all="fees">\u062a\u0630\u0643\u064a\u0631 \u063a\u064a\u0631 \u0627\u0644\u0645\u0633\u062f\u062f\u064a\u0646 (' + unpaid.length + ')</button></div>' : '');
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
        if (fee === 0) return '<td><span class="tag tag-ok">\u0645\u0639\u0641\u0649</span></td>';
        if (fee == null) return '<td><span class="muted">\u2014</span></td>';
        if (paid > 0) return '<td><b style="color:var(--leaf,#4e7d45)">' + money(fee) + '</b><br><span class="tag tag-ok">\u0645\u0633\u062f\u0651\u062f</span></td>';
        return '<td>' + money(fee) + '<br><span class="tag tag-no">\u0645\u0633\u062a\u062d\u0642</span></td>';
      } catch(e) { return '<td>\u2014</td>'; }
    };
    window.QLFeesEmbed.actions = function(s) {
      try {
        if (!can('fees.collect') && !can('fees.amount')) return '';
        var fee = window.QLFeeDue ? window.QLFeeDue(s) : null;
        var paid = getPaid(s.id, window.QLFees && window.QLFees.y, window.QLFees && window.QLFees.m);
        var needRemind = can('fees.collect') && !stOff(s) && fee !== 0 && fee && paid <= 0;
        return (can('fees.collect') ? '<button type="button" class="btn sm primary" data-fee-pay2="' + esc(s.id) + '"' + (fee === 0 ? ' disabled' : '') + '>\u062a\u062d\u0635\u064a\u0644</button>' : '') + (needRemind ? '<button type="button" class="btn sm" data-remind="' + esc(s.id) + '" title="\u062a\u0630\u0643\u064a\u0631">\u062a\u0630\u0643\u064a\u0631</button>' : '');
      } catch(e) { return ''; }
    };
  }

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
      ov.innerHTML = '<div class="modal"><h2>\u062a\u062d\u0635\u064a\u0644 \u0627\u0634\u062a\u0631\u0627\u0643: ' + esc(s.name) + '</h2>' + (fee ? '<p class="muted" style="margin:0 0 .6rem">\u0627\u0644\u0645\u0633\u062a\u062d\u0642: ' + money(fee) + ' \u062c\u0646\u064a\u0647</p>' : '') + '<label>\u0627\u0644\u0645\u0628\u0644\u063a<input type="number" min="0" name="amount" value="' + (fee || '') + '" required></label><label>\u0639\u0646 \u0634\u0647\u0631<select name="month">' + mOpts + '</select></label><label>\u062a\u0627\u0631\u064a\u062e<input type="date" name="date" value="' + today() + '"></label><label>\u0645\u0644\u0627\u062d\u0638\u0629<input name="note"></label><div data-reason-wrap hidden><label>\u0633\u0628\u0628 \u0645\u0628\u0644\u063a \u0623\u0642\u0644<select name="reason"><option value="">\u2014 \u0627\u062e\u062a\u0631 \u2014</option><option value="\u0645\u062a\u0623\u062e\u0631">\u0645\u062a\u0623\u062e\u0631</option><option value="\u062d\u0627\u0644\u0629 \u062e\u0627\u0635\u0629">\u062d\u0627\u0644\u0629 \u062e\u0627\u0635\u0629</option></select></label></div><div class="row"><button type="button" class="btn primary" data-dosave>\u062d\u0641\u0638</button><button type="button" class="btn" data-close>\u0625\u0644\u063a\u0627\u0621</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('[data-close]').onclick = function() { ov.remove(); };
      var ai = ov.querySelector('[name=amount]'), rw = ov.querySelector('[data-reason-wrap]');
      ai.addEventListener('input', function() { var need = fee && +ai.value > 0 && +ai.value < fee; rw.hidden = !need; });
      ov.querySelector('[data-dosave]').onclick = function() {
        var amt = +ai.value; if (!(amt > 0)) { toast('\u0627\u0643\u062a\u0628 \u0645\u0628\u0644\u063a\u0627\u064b'); return; }
        if (fee && amt < fee && !ov.querySelector('[name=reason]').value) { toast('\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0628\u0628'); return; }
        var parts = ov.querySelector('[name=month]').value.split('-'), sy = +parts[0], sm = +parts[1];
        var reason = ov.querySelector('[name=reason]').value;
        var note = [(ov.querySelector('[name=note]').value || '').trim(), reason].filter(Boolean).join(' \u2014 ');
        var f = { id: uid(), studentId: sid, y: sy, m: sm, amount: amt, date: ov.querySelector('[name=date]').value || today(), by: (typeof me === 'function' && me()) ? me().name : '', byMember: session ? session.id : '', note: note };
        if (!Array.isArray(db.fees)) db.fees = [];
        db.fees.push(f);
        ov.remove();
        toast('\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 ' + money(amt) + ' \u062c\u0646\u064a\u0647 \u0644\u0640\u00ab' + s.name + '\u00bb');
        save(); render();
      };
    } catch(e) { console.error('pay2 error:', e); }
  }, true);

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
          var catHtml = '<h3 class="sc-h">\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643</h3><div class="tbl"><table><tr><th>\u0627\u0644\u0645\u0633\u062a\u062d\u0642</th><td>' + (due != null ? money(due) + ' \u062c\u0646\u064a\u0647' : '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f') + '</td></tr></table></div>';
          if (can('fees.amount')) catHtml += '<div class="row noprint" style="margin:.4rem 0"><button class="btn sm" data-fee-assign="' + esc(st.id) + '">\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0641\u0626\u0629</button></div>';
          var logHtml = '<h3 class="sc-h">\u0633\u062c\u0644 \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a</h3>';
          if (fees.length) {
            logHtml += '<div class="tbl"><table><tr><th>\u0627\u0644\u0634\u0647\u0631</th><th>\u0627\u0644\u0645\u0628\u0644\u063a</th><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th></tr>';
            fees.slice(0, 20).forEach(function(f) { logHtml += '<tr><td>' + MONTH_NAMES[(f.m||1)-1] + ' ' + f.y + '</td><td>' + money(f.amount) + '</td><td dir="ltr" style="text-align:right">' + esc(f.date||'') + '</td></tr>'; });
            logHtml += '<tr class="sum"><td>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</td><td>' + money(total) + '</td><td></td></tr></table></div>';
          } else logHtml += empty('\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0641\u0639\u0627\u062a.');
          var btns = modal.querySelector('.row.noprint:last-child');
          if (btns) btns.insertAdjacentHTML('beforebegin', catHtml + logHtml);
          else modal.insertAdjacentHTML('beforeend', catHtml + logHtml);
        } catch(e) { console.error('studentCard ext error:', e); }
      }, 80);
    };
    studentCard = window.studentCard;
  }

  adminViews.students = function() {
    try {
      var list = db.students.filter(function(st) { return (!ui.fh || st.halaqaId === ui.fh) && (!ui.fcat || (st.cat || 'child') === ui.fcat); });
      var F = window.QLFeesEmbed, hasFees = !!F;
      var feeH = hasFees ? '<th>\u0627\u0644\u0645\u0633\u062a\u062d\u0642</th>' : '';
      var toolbar = hasFees && (can('fees.collect') || can('fees.amount'))
        ? (can('fees.amount') ? '<button type="button" class="btn" data-fee-cfg>\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643</button>' : '') + (can('fees.amount') ? '<button type="button" class="btn" data-fee-bulk>\u062a\u0639\u064a\u064a\u0646 \u0644\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0628\u062d\u062b</button>' : '') : '';
      var rows = list.map(function(st) {
        var off = stOff(st);
        return '<tr' + (off ? ' class="tr-off"' : '') + '><td><span class="who">' + avatar(st) + '<span>' + esc(st.name) + '</span></span></td><td>' + (ageOf(st) === '' ? '\u2014' : ageOf(st)) + '</td><td>' + cleanHName(st.halaqaId) + '</td><td>' + esc(placeName(byId(db.halaqat, st.halaqaId)) || '\u2014') + '</td><td>' + esc(lastHifz(st.id)) + '</td><td><button type="button" class="btn sm' + (off ? ' danger' : '') + '" data-stat="' + st.id + '">' + (off ? '\u0645\u0646\u0642\u0637\u0639' : '\u0645\u0646\u062a\u0638\u0645') + '</button></td><td>' + absMonthCell(st) + '</td>' + (hasFees ? F.cells(st) : '') + '<td><button class="btn sm primary" data-act="studentCard" data-id="' + st.id + '">\u0627\u0644\u0645\u0644\u0641</button><button class="btn sm" data-act="hist" data-id="' + st.id + '">\u0627\u0644\u0633\u062c\u0644</button><button class="btn sm" data-act="editStudent" data-id="' + st.id + '">\u062a\u0639\u062f\u064a\u0644</button>' + (db.fields.students.length ? '<button class="btn sm" data-act="editExtra" data-k="students" data-id="' + st.id + '">\u0625\u0636\u0627\u0641\u064a\u0629</button>' : '') + (hasFees ? F.actions(st) : '') + '</td></tr>';
      }).join('');
      return buildSummary(list) + '<div class="card"><div class="bar"><h2 class="grow" style="margin:0">\u0627\u0644\u0637\u0644\u0627\u0628</h2>' + toolbar + '<select data-change="fcat"><option value="">\u0627\u0644\u0635\u063a\u0627\u0631 \u0648\u0627\u0644\u0643\u0628\u0627\u0631</option>' + Object.keys(CATS).map(function(k) { return '<option value="' + k + '"' + (ui.fcat === k ? ' selected' : '') + '>' + (k === 'child' ? '\u0627\u0644\u0635\u063a\u0627\u0631' : '\u0627\u0644\u0643\u0628\u0627\u0631') + '</option>'; }).join('') + '</select><select data-change="fh"><option value="">\u0643\u0644 \u0627\u0644\u062d\u0644\u0642\u0627\u062a</option>' + db.halaqat.map(function(h) { return '<option value="' + esc(h.id) + '"' + (h.id === ui.fh ? ' selected' : '') + '>' + esc(halaqaLabel(h)) + '</option>'; }).join('') + '</select><button class="btn primary" data-act="addStudent">+ \u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0637\u0627\u0644\u0628</button></div>' + (list.length ? '<div class="tbl"><table><tr><th>\u0627\u0644\u0627\u0633\u0645</th><th>\u0627\u0644\u0633\u0646</th><th>\u0627\u0644\u062d\u0644\u0642\u0629</th><th>\u0627\u0644\u0645\u0643\u0627\u0646</th><th>\u0622\u062e\u0631 \u062d\u0641\u0638</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>\u063a\u064a\u0627\u0628 \u0627\u0644\u0634\u0647\u0631</th>' + feeH + '<th></th></tr>' + rows + '</table></div>' : empty('\u0644\u0627 \u064a\u0648\u062c\u062f \u0637\u0644\u0627\u0628.')) + '</div>';
    } catch(e) {
      console.error('adminViews.students error:', e);
      return '<div class="card"><p style="color:red">\u062e\u0637\u0623: ' + String(e.message || e) + '</p></div>';
    }
  };

} catch(e) {
  console.error('app-abs.js FATAL:', e);
}
})();
