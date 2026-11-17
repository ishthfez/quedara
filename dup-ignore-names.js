/* ============ «تجاهل» في نافذة الأسماء المتشابهة: حفظ فوري وبالأسماء ============
   - يُحفظ التجاهل لحظة تحديد «تجاهل» (لا ينتظر «تنفيذ»)، ويُلغى إن أُلغي التحديد.
   - يُحفظ بالأسماء أيضًا (مع أزواج المعرفات التي يحفظها dups.js) في priv_dups المتزامن مع الخادم،
     فلا يعود الاقتراح إن أُعيد إنشاء أحد الطالبين بمعرف جديد (كإعادة استيراد). */
(function () {
  'use strict';
  var keyOf = function (k, names) { return 'n:' + k + ':' + names.map(function (n) { return norm(n); }).sort().join('|'); };
  var idPairs = function (ids) { var a = ids.slice().sort(), out = []; for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) out.push(a[i] + '|' + a[j]); return out; };
  var namePairs = function (k, names) { var out = []; for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) out.push(keyOf(k, [names[i], names[j]])); return out; };
  var store = function () { return Array.isArray(db.settings.priv_dups) ? db.settings.priv_dups.slice() : []; };

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof dupGroups !== 'function') return;
    var base = dupGroups;
    dupGroups = function () {
      var S = new Set(store());
      return base.apply(this, arguments).filter(function (g) {
        var names = g.items.map(function (m) { return m.name || ''; });
        return !namePairs(g.k, names).every(function (p) { return S.has(p); });
      });
    };
    /* المجموعات المعروضة الآن في النافذة: تُحفظ لحظة فتحها لنعرف نوع كل مجموعة وأعضاءها */
    var baseDlg = dupDialog;
    dupDialog = function () { window.__dupShown = dupGroups(); return baseDlg.apply(this, arguments); };
  });

  document.addEventListener('change', function (e) {
    var cb = e.target.closest && e.target.closest('#dupdlg [data-ignore]'); if (!cb) return;
    var box = cb.closest('.dupg'), g = (window.__dupShown || [])[+box.dataset.g]; if (!g) return;
    var ids = [].map.call(box.querySelectorAll('input[type=radio]'), function (r) { return r.value; });
    var keys = idPairs(ids).concat(namePairs(g.k, g.items.map(function (m) { return m.name || ''; })));
    var S = new Set(store());
    keys.forEach(function (k) { if (cb.checked) S.add(k); else S.delete(k); });
    db.settings.priv_dups = Array.from(S);
    save();
    toast(cb.checked ? 'حُفظ: لن تُقترح هذه المجموعة مرة أخرى' : 'أُلغي التجاهل');
  });
})();
