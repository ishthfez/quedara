/* عمود «الحضور» (6 أو 3 أيام) في جدول الطلاب، بعد «السن».
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
  function patch() {
    try {
      if (typeof session === 'undefined' || !session || typeof ui === 'undefined' || ui.tab !== 'students') return;
      document.querySelectorAll('main .tbl table').forEach(function (tbl) {
        if (!tbl.rows.length) return;
        var H = [].map.call(tbl.rows[0].cells, function (c) { return c.textContent.trim(); });
        if (H.indexOf('الحضور') >= 0) return;                 /* مضاف من قبل: لا تكرار */
        var iAge = H.indexOf('السن'); if (iAge < 0) return;
        if (!tbl.querySelector('[data-act="studentCard"],[data-stat]')) return;   /* ليس جدول طلاب */
        [].forEach.call(tbl.rows, function (r, ri) {
          var c = r.cells[iAge]; if (!c) return;
          if (ri === 0) { c.insertAdjacentHTML('afterend', '<th>الحضور</th>'); return; }
          var el = r.querySelector('[data-act="studentCard"],[data-act="hist"],[data-stat]');
          var id = el && (el.dataset.id || el.dataset.stat), s = id && byId(db.students, id);
          c.insertAdjacentHTML('afterend', '<td>' + (s ? sel(s) : '') + '</td>');
        });
      });
    } catch (e) { console.error('feesys-col:', e); }
  }
  var root = document.getElementById('app') || document.body;
  new MutationObserver(patch).observe(root, { childList: true, subtree: true });
  patch();
})();
