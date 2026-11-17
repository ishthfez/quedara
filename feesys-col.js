/* عمود «الحضور» (6 أو 3 أيام) في جدول الطلاب، بعد «السن»؛ وخانة «الحلقة» باسم المعلم فقط.
   يُضاف على الجدول بعد رسمه (أيًّا كان الملف الذي رسمه)، دون تعديل الملفات الكبيرة.
   القيمة في info.feeSys، ويحفظها معالج data-fsys الموجود في fees.js (فيتغير المستحق فورًا). */
(function () {
  'use strict';
  var canAmt = function () {
    try { return window.Perms ? window.Perms.can('fees.amount') : !!(session && session.role === 'admin'); } catch (e) { return false; }
  };
  var sel = function (s) {
    var three = (s.info || {}).feeSys === '3';
    return canAmt()
      ? '<select class="mini" data-fsys="' + esc(s.id) + '" aria-label="نظام حضور ' + esc(s.name) + '"><option value="6"' + (three ? '' : ' selected') + '>(6) أيام</option><option value="3"' + (three ? ' selected' : '') + '>(3) أيام</option></select>'
      : (three ? '(3) أيام' : '(6) أيام');
  };
  var sidOf = function (r) { var el = r.querySelector('[data-act="studentCard"],[data-act="hist"],[data-stat]'); return el && (el.dataset.id || el.dataset.stat); };
  /* خانة «الحلقة»: اسم المعلم فقط، بلا كبسولة «حلقة» ولا كبسولة المكان (للمكان عمود مستقل بجانبها).
     لا يُعاد الكتابة إلا إن وُجدت كبسولة أو نص «حلقة … — المكان»، حتى لا يتكرر التعديل بلا نهاية. */
  function cleanHal(tbl, H) {
    var iH = H.indexOf('الحلقة'); if (iH < 0) return;
    [].forEach.call(tbl.rows, function (r, ri) {
      if (!ri) return;
      var c = r.cells[iH]; if (!c) return;
      var t = c.textContent;
      if (!c.querySelector('.hpill') && !/^\s*حلقة\s/.test(t) && t.indexOf(' — ') < 0) return;
      var s = byId(db.students, sidOf(r)), h = s && byId(db.halaqat, s.halaqaId);
      var v = h ? halaqaLabel(h).replace(/^\s*حلقة\s+/, '').split(' — ')[0].trim() : t.replace(/^\s*حلقة\s+/, '').split(' — ')[0].trim();
      if (v && c.textContent !== v) c.textContent = v;
    });
  }
  function patch() {
    try {
      if (typeof session === 'undefined' || !session || typeof ui === 'undefined' || ui.tab !== 'students') return;
      document.querySelectorAll('main .tbl table').forEach(function (tbl) {
        if (!tbl.rows.length || tbl.__fsc === tbl.rows.length) return;   /* عولج بعدد صفوفه الحالي: لا يُعاد الفحص مع كل تغيير في الصفحة */
        var H = [].map.call(tbl.rows[0].cells, function (c) { return c.textContent.trim(); });
        if (!tbl.querySelector('[data-act="studentCard"],[data-stat]')) return;   /* ليس جدول طلاب */
        cleanHal(tbl, H);
        var iAtt = H.indexOf('الحضور');
        if (iAtt >= 0) {   /* مضاف من قبل: لا تكرار، إلا لصفوف أُضيفت إلى الجدول بعده فتنقصها الخانة */
          var nH = tbl.rows[0].cells.length;
          [].forEach.call(tbl.rows, function (r, ri) {
            if (!ri || r.cells.length >= nH || !r.cells[iAtt - 1]) return;
            var s = byId(db.students, sidOf(r)); r.cells[iAtt - 1].insertAdjacentHTML('afterend', '<td>' + (s ? sel(s) : '') + '</td>');
          });
          tbl.__fsc = tbl.rows.length; return;
        }
        var iAge = H.indexOf('السن'); if (iAge < 0) return;
        [].forEach.call(tbl.rows, function (r, ri) {
          var c = r.cells[iAge]; if (!c) return;
          if (ri === 0) { c.insertAdjacentHTML('afterend', '<th>الحضور</th>'); return; }
          var id = sidOf(r), s = id && byId(db.students, id);
          c.insertAdjacentHTML('afterend', '<td>' + (s ? sel(s) : '') + '</td>');
        });
        tbl.__fsc = tbl.rows.length;
      });
    } catch (e) { console.error('feesys-col:', e); }
  }
  var root = document.getElementById('app') || document.body;
  new MutationObserver(patch).observe(root, { childList: true, subtree: true });
  patch();
})();
