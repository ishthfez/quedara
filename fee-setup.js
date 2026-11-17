'use strict';
/* ============ ضبط اشتراكات الأماكن + نظام الحضور (تلقائي + يدوي) ============ */
(function() {
try {
  var FEE_MAP = [
    {n: 'اكرم الاكرمين', sys: '6', fee: 70},
    {n: 'الأنصار', sys: '6', fee: 80},
    {n: 'الإمام مستوى ثاني', sys: '3', fee: 80},
    {n: 'البساتين مستوى اول', sys: '3', fee: 75},
    {n: 'البساتين مستوى ثاني', sys: '3', fee: 100},
    {n: 'التوحيد مستوى اول', sys: '3', fee: 80},
    {n: 'التوحيد مستوى ثالث', sys: '6', fee: 130},
    {n: 'التوحيد مستوى ثاني', sys: '3', fee: 90},
    {n: 'التوحيد مستوى رابع', sys: '6', fee: 140},
    {n: 'الحسني', sys: '6', fee: 70},
    {n: 'الحسني المستوي الثاني', sys: '3', fee: 125},
    {n: 'الخشينه', sys: '6', fee: 80},
    {n: 'الشباب مستوى اول', sys: '3', fee: 70},
    {n: 'الصفا والمروة مستوى اول', sys: '3', fee: 80},
    {n: 'الصفتي', sys: '6', fee: 120},
    {n: 'الصفتي1', sys: '6', fee: 75},
    {n: 'الطاهرات', sys: '6', fee: 75},
    {n: 'العسلي مستوى اول', sys: '3', fee: 70},
    {n: 'العسلي مستوى ثاني', sys: '3', fee: 120},
    {n: 'بلال مستوى اول', sys: '3', fee: 80},
    {n: 'بني عليم مستوى ثاني', sys: '3', fee: 70},
    {n: 'دار بن عباس', sys: '6', fee: 80},
    {n: 'عباد الرحمن مستوى اول', sys: '3', fee: 80},
    {n: 'عباد الرحمن مستوى ثاني', sys: '3', fee: 150},
    {n: 'عبد العزيز امين مستوى اول', sys: '3', fee: 70},
    {n: 'مسجد البارئ مستوى اول', sys: '3', fee: 75},
    {n: 'مسجد الكردي', sys: '6', fee: 65},
    {n: 'مسجد رب العالمين مستوى اول', sys: '3', fee: 70},
    {n: 'مسجد رب العالمين مستوى ثاني', sys: '3', fee: 130},
    {n: 'مكة المكرمه مستوى اول', sys: '3', fee: 70}
  ];

  /* ربط يدوي للأماكن التي أسماؤها مختلفة بين النظام والملف */
  var ALIASES = {
    'ابن عباس': 'دار بن عباس',
    'الخشاينة': 'الخشينه',
    'الخشاينه': 'الخشينه',
    'بلال بن رباح': 'بلال مستوى اول',
    'بلال': 'بلال مستوى اول',
    'دار الرحمن (عبد العزيز أمين)': 'عبد العزيز امين مستوى اول',
    'دار الرحمن': 'عبد العزيز امين مستوى اول',
    'التوحيد (بني عليم)': 'بني عليم مستوى ثاني',
    'التوحيد بني عليم': 'بني عليم مستوى ثاني'
  };
  /* التوحيد (بلبيس) = مختلط 4 مستويات — الغالبية 3 أيام، نضبط 3 أيام و 80 كافتراضي */
  ALIASES['التوحيد (بلبيس)'] = 'التوحيد مستوى اول';
  ALIASES['التوحيد بلبيس'] = 'التوحيد مستوى اول';

  var n0 = function(t) { return String(t||'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[\u0623\u0625\u0622]/g,'\u0627').replace(/\u0629/g,'\u0647').replace(/\u0649/g,'\u064a').replace(/\s+/g,' ').trim().toLowerCase(); };

  function matchPlace(p) {
    var pn = n0(p.name);
    /* مطابقة مباشرة */
    for (var i = 0; i < FEE_MAP.length; i++) {
      if (n0(FEE_MAP[i].n) === pn) return FEE_MAP[i];
    }
    /* مطابقة عبر الأسماء البديلة */
    var aliasKeys = Object.keys(ALIASES);
    for (var a = 0; a < aliasKeys.length; a++) {
      if (n0(aliasKeys[a]) === pn || pn.indexOf(n0(aliasKeys[a])) !== -1) {
        var target = n0(ALIASES[aliasKeys[a]]);
        for (var j = 0; j < FEE_MAP.length; j++) {
          if (n0(FEE_MAP[j].n) === target) return FEE_MAP[j];
        }
      }
    }
    /* مطابقة جزئية */
    for (var k = 0; k < FEE_MAP.length; k++) {
      if (pn.indexOf(n0(FEE_MAP[k].n)) !== -1 || n0(FEE_MAP[k].n).indexOf(pn) !== -1) return FEE_MAP[k];
    }
    return null;
  }

  /* ---- تطبيق تلقائي ---- */
  function autoApply() {
    try {
      if (!session || session.role !== 'admin') return;
      if (!db || !db.places || !db.places.length || !db.students) return;
      if (!db.settings) return;
      var cfg = db.settings.priv_fees || {};
      if (cfg._feeSetupApplied) return;

      var pFees = cfg.places && typeof cfg.places === 'object' ? JSON.parse(JSON.stringify(cfg.places)) : {};
      var matchCount = 0, sysCount = 0;

      db.places.forEach(function(p) {
        var m = matchPlace(p);
        if (!m) return;
        matchCount++;
        var cur = pFees[p.id] || {};
        if (m.sys === '3') pFees[p.id] = { general: cur.general || null, general3: m.fee };
        else pFees[p.id] = { general: m.fee, general3: cur.general3 || null };
        db.students.forEach(function(s) {
          try {
            var h = db.halaqat.find(function(x) { return x.id === s.halaqaId; });
            if (!h || h.placeId !== p.id) return;
            var curSys = (s.info || {}).feeSys || '';
            if (m.sys === '3' && curSys !== '3') { s.info = Object.assign({}, s.info || {}, { feeSys: '3' }); sysCount++; }
            else if (m.sys === '6' && curSys === '3') { s.info = Object.assign({}, s.info || {}, { feeSys: '6' }); sysCount++; }
          } catch(e) {}
        });
      });

      db.settings.priv_fees = Object.assign({}, cfg, { places: pFees, _feeSetupApplied: true });
      if (matchCount > 0) {
        save();
        toast('\u062a\u0645 \u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a ' + matchCount + ' \u0645\u0643\u0627\u0646 \u0648\u0646\u0638\u0627\u0645 ' + sysCount + ' \u0637\u0627\u0644\u0628 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b');
      }
    } catch(e) { console.warn('fee-setup autoApply error:', e); }
  }

  var tryAuto = function() {
    try {
      if (db && db.places && db.places.length && db.students && db.students.length && document.querySelector('.side')) autoApply();
      else setTimeout(tryAuto, 1500);
    } catch(e) {}
  };
  setTimeout(tryAuto, 3000);

  /* ---- نافذة يدوية ---- */
  function run() {
    try {
      if (session && session.role !== 'admin') { toast('\u0644\u0644\u0645\u062f\u064a\u0631 \u0641\u0642\u0637'); return; }
      var places = db.places || [];
      if (!places.length) { toast('\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0645\u0627\u0643\u0646'); return; }
      var matched = [], unmatched = [];
      places.forEach(function(p) {
        var m = matchPlace(p);
        var stuCount = db.students.filter(function(s) { var h = db.halaqat.find(function(x) { return x.id === s.halaqaId; }); return h && h.placeId === p.id; }).length;
        if (m) matched.push({ place: p, match: m, stuCount: stuCount });
        else unmatched.push({ place: p, stuCount: stuCount });
      });
      var ov = document.createElement('div'); ov.className = 'overlay';
      var html = '<div class="modal wide"><h2>\u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0627\u0644\u0623\u0645\u0627\u0643\u0646</h2>';
      html += '<h3 style="color:var(--leaf);margin:.8rem 0 .3rem">\u2705 \u062a\u0637\u0627\u0628\u0642 (' + matched.length + ')</h3>';
      html += '<div class="tbl"><table><tr><th>\u0627\u0644\u0645\u0643\u0627\u0646</th><th>\u0637\u0648\u0628\u0642 \u0645\u0639</th><th>\u0627\u0644\u0646\u0638\u0627\u0645</th><th>\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643</th><th>\u0627\u0644\u0637\u0644\u0627\u0628</th></tr>';
      matched.forEach(function(r) { html += '<tr><td>' + esc(r.place.name) + '</td><td>' + esc(r.match.n) + '</td><td>' + (r.match.sys === '3' ? '3 \u0623\u064a\u0627\u0645' : '6 \u0623\u064a\u0627\u0645') + '</td><td><b>' + r.match.fee + '</b></td><td>' + r.stuCount + '</td></tr>'; });
      html += '</table></div>';
      if (unmatched.length) {
        html += '<h3 style="color:var(--red);margin:.8rem 0 .3rem">\u274c \u0644\u0645 \u064a\u064f\u0637\u0627\u0628\u064e\u0642 (' + unmatched.length + ')</h3>';
        html += '<div class="tbl"><table><tr><th>\u0627\u0644\u0645\u0643\u0627\u0646</th><th>\u0627\u0644\u0637\u0644\u0627\u0628</th></tr>';
        unmatched.forEach(function(r) { html += '<tr><td>' + esc(r.place.name) + '</td><td>' + r.stuCount + '</td></tr>'; });
        html += '</table></div>';
      }
      html += '<div class="row" style="margin-top:1rem"><button type="button" class="btn primary" data-fsapply>\u062a\u0637\u0628\u064a\u0642</button><button type="button" class="btn danger" data-fsreset>\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0636\u0628\u0637</button><button type="button" class="btn" data-close>\u0625\u0644\u063a\u0627\u0621</button></div></div>';
      ov.innerHTML = html;
      document.body.appendChild(ov);
      ov.querySelector('[data-close]').onclick = function() { ov.remove(); };
      ov.querySelector('[data-fsapply]').onclick = function() {
        var cfg = db.settings.priv_fees || {};
        var pFees = cfg.places && typeof cfg.places === 'object' ? JSON.parse(JSON.stringify(cfg.places)) : {};
        var sysCount = 0;
        matched.forEach(function(r) {
          var cur = pFees[r.place.id] || {};
          if (r.match.sys === '3') pFees[r.place.id] = { general: cur.general || null, general3: r.match.fee };
          else pFees[r.place.id] = { general: r.match.fee, general3: cur.general3 || null };
          db.students.forEach(function(s) {
            var h = db.halaqat.find(function(x) { return x.id === s.halaqaId; });
            if (!h || h.placeId !== r.place.id) return;
            var curSys = (s.info || {}).feeSys || '';
            if (r.match.sys === '3' && curSys !== '3') { s.info = Object.assign({}, s.info || {}, { feeSys: '3' }); sysCount++; }
            else if (r.match.sys === '6' && curSys === '3') { s.info = Object.assign({}, s.info || {}, { feeSys: '6' }); sysCount++; }
          });
        });
        db.settings.priv_fees = Object.assign({}, cfg, { places: pFees, _feeSetupApplied: true });
        ov.remove(); save(); render();
        toast('\u062a\u0645: ' + matched.length + ' \u0645\u0643\u0627\u0646' + (sysCount ? ' \u0648\u0646\u0638\u0627\u0645 ' + sysCount + ' \u0637\u0627\u0644\u0628' : ''));
      };
      ov.querySelector('[data-fsreset]').onclick = function() {
        var cfg = db.settings.priv_fees || {};
        db.settings.priv_fees = Object.assign({}, cfg, { _feeSetupApplied: false });
        ov.remove(); save();
        toast('\u062a\u0645 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0636\u0628\u0637 \u2014 \u0633\u064a\u064f\u0637\u0628\u0651\u0642 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0639\u0646\u062f \u0627\u0644\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0642\u0627\u062f\u0645');
      };
    } catch(e) { console.error('fee-setup run error:', e); }
  }

  document.addEventListener('click', function(e) { if (e.target.closest('[data-fee-setup]')) run(); });
  var obs = new MutationObserver(function() {
    try {
      var q = document.querySelector('.qimp');
      if (q && !q.querySelector('[data-fee-setup]')) {
        q.insertAdjacentHTML('beforeend', '<button type="button" class="btn primary" data-fee-setup>\u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0627\u0644\u0623\u0645\u0627\u0643\u0646</button>');
      }
    } catch(e) {}
  });
  obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

} catch(e) { console.error('fee-setup FATAL:', e); }
})();
