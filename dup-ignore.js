'use strict';
/* حفظ قرار تجاهل الدمج — يمنع تكرار نفس الاقتراح */
(function() {
try {
  var STORE_KEY = 'quedara_dup_ignored';
  function getIgnored() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e) { return []; }
  }
  function addIgnored(key) {
    var list = getIgnored();
    if (list.indexOf(key) === -1) { list.push(key); localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
  }
  function makeKey(a, b) {
    var arr = [String(a).trim(), String(b).trim()].sort();
    return arr[0] + '||' + arr[1];
  }

  /* اعتراض زر التجاهل في نوافذ الدمج */
  document.addEventListener('click', function(e) {
    /* زر تجاهل في نافذة الدمج: data-dup-dismiss أو الزر الذي نصه تجاهل داخل overlay */
    var btn = e.target.closest('[data-dup-dismiss]');
    if (btn) {
      var id1 = btn.dataset.dupDismiss;
      var id2 = btn.dataset.dupDismiss2 || '';
      if (id1 && id2) addIgnored(makeKey(id1, id2));
      return;
    }
    /* الطريقة العامة: أي زر نصه تجاهل داخل نافذة الدمج */
    var btn2 = e.target.closest('.overlay .modal button, .overlay .modal [data-close]');
    if (!btn2) return;
    var txt = (btn2.textContent || '').trim();
    if (txt !== '\u062a\u062c\u0627\u0647\u0644' && txt !== '\u062a\u062e\u0637\u064a') return;
    /* نبحث عن اس\u0645\u064a ا\u0644\u0637\u0627\u0644\u0628\u064a\u0646 \u0641\u064a \u0627\u0644\u0646\u0627\u0641\u0630\u0629 */
    var modal = btn2.closest('.modal') || btn2.closest('.overlay');
    if (!modal) return;
    var ids = [];
    modal.querySelectorAll('[data-id]').forEach(function(el) {
      if (ids.indexOf(el.dataset.id) === -1) ids.push(el.dataset.id);
    });
    if (ids.length === 2) addIgnored(makeKey(ids[0], ids[1]));
    /* أيضاً نحفظ ب\u0627\u0644\u0623\u0633\u0645\u0627\u0621 \u0644\u0644\u0627\u062d\u062a\u064a\u0627\u0637 */
    var names = [];
    modal.querySelectorAll('.who span, h2, h3').forEach(function(el) {
      var n = (el.textContent || '').trim().replace(/[\u00ab\u00bb“”"]/g, '').trim();
      if (n && n.length > 3 && n.length < 60 && names.indexOf(n) === -1) names.push(n);
    });
    if (names.length >= 2) addIgnored(makeKey(names[0], names[1]));
  });

  /* إخفاء اقتراحات الدمج ال\u0645\u062a\u062c\u0627\u0647\u0644\u0629 ع\u0646\u062f \u0639\u0631\u0636\u0647\u0627 */
  if (typeof window.dupCheck === 'function') {
    var _origDupCheck = window.dupCheck;
    window.dupCheck = function() {
      var result = _origDupCheck.apply(this, arguments);
      if (Array.isArray(result)) {
        var ignored = getIgnored();
        result = result.filter(function(pair) {
          if (!pair || !pair[0] || !pair[1]) return true;
          var k1 = makeKey(pair[0].id || pair[0], pair[1].id || pair[1]);
          var k2 = pair[0].name && pair[1].name ? makeKey(pair[0].name, pair[1].name) : '';
          return ignored.indexOf(k1) === -1 && (!k2 || ignored.indexOf(k2) === -1);
        });
      }
      return result;
    };
    dupCheck = window.dupCheck;
  }

  /* إضافة زر مسح التجاهل\u0627\u062a \u0641\u064a \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a */
  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-clear-dup-ignore]')) {
      localStorage.removeItem(STORE_KEY);
      toast('\u062a\u0645 \u0645\u0633\u062d \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062a\u062c\u0627\u0647\u0644 \u2014 \u0633\u062a\u0638\u0647\u0631 \u0627\u0644\u0627\u0642\u062a\u0631\u0627\u062d\u0627\u062a \u0645\u062c\u062f\u062f\u0627\u064b');
      render();
    }
  });
  var obs = new MutationObserver(function() {
    try {
      var q = document.querySelector('.qimp');
      if (q && !q.querySelector('[data-clear-dup-ignore]')) {
        var n = getIgnored().length;
        if (n > 0) q.insertAdjacentHTML('beforeend', '<button type="button" class="btn" data-clear-dup-ignore>\u0645\u0633\u062d \u062a\u062c\u0627\u0647\u0644 \u0627\u0644\u062f\u0645\u062c (' + n + ')</button>');
      }
    } catch(e) {}
  });
  obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

} catch(e) { console.error('dup-ignore error:', e); }
})();
