/* ============ مطابقة الاشتراكات مع كشف الإيراد (للمدير) ============
   يقرأ ملف «مرجع مطابقة الاشتراكات» (معرف الطالب أو رقمه القديم، نظام الحضور، المقرر) ويقارن كل طالب بما في التطبيق.
   ثلاث خطوات بالترتيب، كل منها بزر وتأكيد:
   1) نظام الحضور (info.feeSys) لكل طالب.
   2) سعرا كل مكان (6 أيام و3 أيام) = المقرر الأكثر شيوعًا بين طلابه المطابَقين في الكشف.
   3) «مبلغ خاص» (info.fee) لمن بقي مقرره مختلفًا (كالمستويات العليا في المكان نفسه).
   يعرض الفروق أولًا، ولا يغيّر شيئًا إلا بزر صريح. المنقطعون لا يُقارنون. */
(function () {
  'use strict';
  var dg = function (s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/\.0+$/, '').trim(); };
  var SYS6_FROM = 100;   /* المقرر أقل من 100 = نظام 3 أيام، و100 فأكثر = نظام 6 أيام */
  var money = function (n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'); };
  var baseOf = function (s, sys) {
    if (typeof window.QLFeeDue !== 'function') return null;
    var info = Object.assign({}, s.info || {}, { feeSys: sys, feeDisc: '', feeDiscVal: '' });
    /* بالشهر الحالي، كالأسعار المقترحة وsetPrices (الفترة السارية الآن)؛ بلا شهر كان يأخذ الشهر المعروض في «الاشتراكات»
       فتظهر فروق غير حقيقية إن كان في فترة مبالغ أخرى */
    var d = new Date();
    return window.QLFeeDue(Object.assign({}, s, { info: info }), d.getFullYear(), d.getMonth() + 1);
  };

  /* أسعار الأماكن الفعلية: من مبالغ السنة الحالية إن وُجدت (كما يحسبها fees.js)، وإلا من الإعدادات العامة */
  /* فترة المبالغ السارية الآن: مفتاح «2026» (من يناير) أو «2026-09» (من سبتمبر)، كما في fees.js */
  var yearKey = function (cfg) {
    var Y = cfg && cfg.years; if (!Y || typeof Y !== 'object') return null;
    var ord = function (k) { return /^\d{4}$/.test(k) ? +k * 100 + 1 : /^\d{4}-(0[1-9]|1[0-2])$/.test(k) ? +k.slice(0, 4) * 100 + +k.slice(5) : null; };
    var d = new Date(), now = d.getFullYear() * 100 + d.getMonth() + 1;
    var ks = Object.keys(Y).filter(function (k) { return ord(k) != null; }).sort(function (a, b) { return ord(a) - ord(b); });
    if (!ks.length) return null;
    var k = ks.slice().reverse().find(function (x) { return ord(x) <= now; }); return k != null ? k : ks[0];
  };
  var curPlaces = function (cfg) { var k = yearKey(cfg); return ((k ? (cfg.years[k] || {}).places : cfg.places) || {}); };
  /* علامة fee-setup.js «تم الضبط»: حتى لا يعمل تلقائيًا لاحقًا فيفرض نظامًا واحدًا على كل طلاب المكان فوق المطابقة */
  var markDone = function () { db.settings.priv_fees = Object.assign({}, db.settings.priv_fees || {}, { _feeSetupApplied: true }); };
  function setPrices(list) {
    var cfg = JSON.parse(JSON.stringify(db.settings.priv_fees || {})), k = yearKey(cfg);
    /* السعر يُكتب في الفترة الحالية وحدها إن وُجدت فترات (كان يُكتب في الأسعار الأساسية أيضًا، فتتغيّر مستحقات
       السنوات السابقة التي لا فترة خاصة لها، ومعها المتأخرات) */
    var targets;
    if (k) { cfg.years[k] = cfg.years[k] || {}; targets = [cfg.years[k].places = cfg.years[k].places || {}]; }
    else targets = [cfg.places = (cfg.places && typeof cfg.places === 'object') ? cfg.places : {}];
    list.forEach(function (x) { targets.forEach(function (P) { var o = P[x.pid] || { general: null, general3: null }; o[x.sys === '3' ? 'general3' : 'general'] = x.best; P[x.pid] = o; }); });
    db.settings.priv_fees = cfg;
  }

  function analyse(table) {
    var grid = table.map(function (r) { return Array.from(r || [], function (c) { return String(c == null ? '' : c).trim(); }); });
    var hi = grid.slice(0, 5).findIndex(function (r) { return r.indexOf('رقم الطالب القديم') >= 0; });
    if (hi < 0) return { err: 'لم أجد عمود «رقم الطالب القديم». استخدم ملف «مرجع مطابقة الاشتراكات».' };
    var H = grid[hi], C = { id: H.indexOf('معرف الطالب'), code: H.indexOf('رقم الطالب القديم'), name: H.indexOf('اسم الطالب'), lv: H.indexOf('المكان والمستوى'), sys: H.indexOf('نظام الحضور'), fee: H.indexOf('المقرر') };
    if (C.sys < 0 || C.fee < 0) return { err: 'لم أجد عمودي «نظام الحضور» و«المقرر».' };
    /* الكود القديم: «007» = «7»، والكود المكرر لأكثر من طالب لا يُطابَق (كان يذهب لآخرهم) */
    var code0 = function (v) { var c = dg(v); return /^\d+$/.test(c) ? String(+c) : c; };
    var byOld = new Map(), oldDup = new Set();
    db.students.forEach(function (s) { var c = code0((s.info || {}).oldCode); if (!c) return; if (byOld.has(c) && byOld.get(c).id !== s.id) oldDup.add(c); byOld.set(c, s); });
    oldDup.forEach(function (c) { byOld.delete(c); });
    var out = { total: 0, matched: 0, off: 0, none: [], sys: [], fee: [], noPrice: 0, groups: {}, prices: [] };
    var rows = [], votes = {};
    grid.slice(hi + 1).forEach(function (r) {
      var code = code0(r[C.code]), sid = C.id >= 0 ? dg(r[C.id]) : ''; if (!code && !sid) return;
      out.total++;
      var s = (sid && byId(db.students, sid)) || (code && byOld.get(code)) || null;
      if (!s) { out.none.push(r[C.name] || code); return; }
      if (stOff(s)) { out.off++; return; }
      out.matched++;
      var fSys = dg(r[C.sys]) === '3' ? '3' : '6', aSys = (s.info || {}).feeSys === '3' ? '3' : '6', fFee = +dg(r[C.fee]);
      /* النظام من المقرر نفسه: أقل من 100 = 3 أيام، و100 فأكثر = 6 أيام (أيًّا كان عمود النظام أو المستوى) */
      if (fFee > 0) fSys = fFee < SYS6_FROM ? '3' : '6';
      if (aSys !== fSys) out.sys.push({ s: s, a: aSys, f: fSys, lv: r[C.lv] || '' });
      var h0 = byId(db.halaqat, s.halaqaId), pid = h0 && h0.placeId;
      /* المقرر الفارغ أو الصفر لا يُصوَّت به: كان يجعل السعر المقترح للمكان صفرًا، والصفر سعر حقيقي (إعفاء الجميع) */
      if (pid && fFee > 0) { var vk = pid + '|' + fSys; votes[vk] = votes[vk] || {}; votes[vk][fFee] = (votes[vk][fFee] || 0) + 1; }
      rows.push({ s: s, r: r, fSys: fSys, fFee: fFee });
    });
    /* السعر المقترح لكل مكان ونظام: المقرر الأكثر شيوعًا بين طلابه */
    var cfg0 = (db.settings.priv_fees || {}), cur = curPlaces(cfg0);
    Object.keys(votes).forEach(function (vk) {
      var p = vk.split('|'), best = null, n = -1;
      Object.keys(votes[vk]).forEach(function (fee) { if (votes[vk][fee] > n) { n = votes[vk][fee]; best = +fee; } });
      var now = (cur[p[0]] || {})[p[1] === '3' ? 'general3' : 'general'];
      if (now == null || +now !== best) out.prices.push({ pid: p[0], sys: p[1], now: now, best: best, n: n });
    });
    rows.forEach(function (x) {
      var s = x.s, r = x.r, fSys = x.fSys, fFee = x.fFee;
      var b = baseOf(s, fSys);
      if (b == null) { out.noPrice++; return; }
      if (Math.abs(b - fFee) > 0.001) {
        out.fee.push({ s: s, a: b, f: fFee, lv: r[C.lv] || '', sys: fSys });
        var h = byId(db.halaqat, s.halaqaId), k = (placeName(h) || 'بلا مكان') + '|' + (r[C.lv] || '') + '|' + fSys + '|' + b + '|' + fFee;
        out.groups[k] = (out.groups[k] || 0) + 1;
      }
    });
    return out;
  }

  function report(R) {
    var stat = function (n, l) { return '<div class="stat"><b>' + n + '</b><span>' + l + '</span></div>'; };
    var g = Object.keys(R.groups).sort(function (a, b) { return R.groups[b] - R.groups[a]; }).map(function (k) {
      var p = k.split('|');
      return '<tr><td>' + esc(p[0]) + '</td><td>' + esc(p[1]) + '</td><td>' + p[2] + ' أيام</td><td>' + money(p[3]) + '</td><td><b>' + money(p[4]) + '</b></td><td>' + R.groups[k] + '</td></tr>';
    }).join('');
    var sysRows = R.sys.slice(0, 200).map(function (x) { return '<tr><td>' + esc(x.s.name) + '</td><td>' + esc(x.lv) + '</td><td>' + x.a + ' أيام</td><td><b>' + x.f + ' أيام</b></td></tr>'; }).join('');
    var pl = function (id) { return (byId(db.places || [], id) || {}).name || '—'; };
    var priceRows = R.prices.slice().sort(function (a, b) { return b.n - a.n; }).map(function (x) { return '<tr><td>' + esc(pl(x.pid)) + '</td><td>' + x.sys + ' أيام</td><td>' + (x.now == null ? '<span class="muted">غير محدد</span>' : money(x.now)) + '</td><td><b>' + money(x.best) + '</b></td><td>' + x.n + '</td></tr>'; }).join('');
    var step = R.sys.length ? 1 : R.prices.length ? 2 : R.fee.length ? 3 : 0;
    if (step && step < 3) g = '';
    return '<div class="grid">' + stat(R.total, 'طالب في الكشف') + stat(R.matched, 'مطابَق ومنتظم') + stat(R.sys.length, 'نظام حضور مختلف') + stat(R.prices.length, 'سعر مكان يحتاج ضبطًا') + stat(step === 3 || !step ? R.fee.length : '…', 'مقرر مختلف')
      + (R.off ? stat(R.off, 'منقطع (لا يُقارن)') : '') + (R.none.length ? stat(R.none.length, 'غير موجود في التطبيق') : '') + (R.noPrice ? stat(R.noPrice, 'بلا سعر محدد') : '') + '</div>'
      + (R.sys.length ? '<h3 class="sc-h">نظام الحضور المختلف</h3><div class="tbl" style="max-height:35vh;overflow:auto"><table><tr><th>الطالب</th><th>المستوى في الكشف</th><th>في التطبيق</th><th>في الكشف</th></tr>' + sysRows + '</table></div>' + (R.sys.length > 200 ? '<p class="muted">يظهر أول 200 فقط.</p>' : '') : '')
      + (priceRows && step === 2 ? '<h3 class="sc-h">أسعار الأماكن المقترحة</h3><p class="muted" style="font-size:.85rem;margin:0 0 .4rem">السعر المقترح هو المقرر الأكثر شيوعًا بين طلاب المكان في الكشف لكل نظام.</p><div class="tbl" style="max-height:35vh;overflow:auto"><table><tr><th>المكان</th><th>النظام</th><th>الحالي</th><th>المقترح</th><th>طلابه في الكشف</th></tr>' + priceRows + '</table></div>' : '')
      + (step && step < 3 ? '<p class="muted" style="font-size:.85rem">' + (step === 1 ? 'الخطوة 1 من 3: ضبط نظام الحضور. بعدها تظهر أسعار الأماكن، ثم المبالغ الخاصة.' : 'الخطوة 2 من 3: ضبط أسعار الأماكن. بعدها تظهر المبالغ الخاصة.') + '</p>' : '')
      + (g ? '<h3 class="sc-h">الخطوة 3 من 3: المقرر المختلف (بعد ضبط نظام الحضور، وقبل أي خصم)</h3><p class="muted" style="font-size:.85rem;margin:0 0 .4rem">إن كان الفرق في مجموعة كاملة من مكان واحد، فالأفضل تصحيح سعر المكان من «إعدادات الاشتراك». أما زر «مبلغ خاص» فيضع مقرر الكشف لكل طالب مختلف، ويبقى ثابتًا له حتى لو تغيّر سعر المكان لاحقًا.</p><div class="tbl" style="max-height:35vh;overflow:auto"><table><tr><th>المكان في التطبيق</th><th>المستوى في الكشف</th><th>النظام</th><th>التطبيق</th><th>الكشف</th><th>عدد الطلاب</th></tr>' + g + '</table></div>' : '')
      + (R.none.length ? '<div class="note" style="margin-top:.6rem">غير موجودين في التطبيق برقمهم القديم (' + R.none.length + '): <small>' + R.none.slice(0, 25).map(esc).join('، ') + (R.none.length > 25 ? '…' : '') + '</small></div>' : '')
      + (!step ? '<p class="note ok">كل الطلاب المطابَقين متوافقون مع الكشف.</p>' : '');
  }

  function dialog() {
    /* فتح الأداة يوقف الضبط التلقائي القديم (fee-setup.js) نهائيًا، حتى لا يعمل والنافذة مفتوحة فيغيّر ما تقارنه */
    if (!(db.settings.priv_fees || {})._feeSetupApplied) { markDone(); save(); }
    var ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="modal wide"><h2>مطابقة الاشتراكات مع كشف الإيراد</h2>'
      + '<p class="muted" style="font-size:.88rem;margin:0 0 .6rem">اختر ملف «مرجع مطابقة الاشتراكات». تظهر الفروق أولًا، ولا يتغيّر شيء إلا بالأزرار أسفل التقرير.</p>'
      + '<div class="bar"><label class="btn primary" style="margin:0">اختيار الملف<input type="file" accept=".xlsx" data-fmf hidden></label></div>'
      + '<div data-fmprev></div>'
      + '<div class="row"><button type="button" class="btn primary" data-fmsys hidden></button><button type="button" class="btn primary" data-fmprice hidden></button><button type="button" class="btn" data-fmfee hidden></button><button type="button" class="btn" data-close>إغلاق</button></div></div>';
    document.body.appendChild(ov);
    var table = null, R = null;
    var box = ov.querySelector('[data-fmprev]'), bSys = ov.querySelector('[data-fmsys]'), bPrice = ov.querySelector('[data-fmprice]'), bFee = ov.querySelector('[data-fmfee]');
    var draw = function () {
      R = analyse(table);
      if (R.err) { box.innerHTML = '<p class="note" style="color:var(--red)">' + esc(R.err) + '</p>'; bSys.hidden = bPrice.hidden = bFee.hidden = true; return; }
      box.innerHTML = report(R);
      bSys.hidden = !R.sys.length; bSys.textContent = 'ضبط نظام الحضور لـ ' + R.sys.length + ' طالب';
      bPrice.hidden = !R.prices.length || !!R.sys.length; bPrice.textContent = 'ضبط أسعار ' + R.prices.length + ' (مكان × نظام)';
      /* المبلغ الخاص بعد ضبط النظام والأسعار فقط، حتى لا يُثبَّت مبلغ بسبب نظام أو سعر خاطئ */
      bFee.hidden = !R.fee.length || !!R.sys.length || !!R.prices.length; bFee.textContent = 'وضع مبلغ خاص لـ ' + R.fee.length + ' طالب';
    };
    ov.querySelector('[data-close]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-fmf]').onchange = async function (e) {
      var f = e.target.files[0]; if (!f) return;
      box.innerHTML = '<p class="muted">جارٍ قراءة الملف…</p>';
      try { table = await parseXLSX(await f.arrayBuffer()); draw(); } catch (err) { box.innerHTML = '<p class="note" style="color:var(--red)">تعذّرت قراءة الملف.</p>'; }
    };
    bSys.onclick = function () {
      ask('ضبط نظام الحضور لـ ' + R.sys.length + ' طالب كما في الكشف؟', function () {
        R = analyse(table); if (R.err) return;   /* إعادة الحساب لحظة التنفيذ: لا يُطبَّق تقرير قديم */
        R.sys.forEach(function (x) { x.s.info = Object.assign({}, x.s.info || {}, { feeSys: x.f }); });
        markDone(); save(); render(); toast('ضُبط نظام الحضور لـ ' + R.sys.length + ' طالب'); draw();
      });
    };
    bPrice.onclick = function () {
      ask('ضبط أسعار الأماكن كما في الجدول (' + R.prices.length + ')؟', function () {
        R = analyse(table); if (R.err) return;   /* إعادة الحساب لحظة التنفيذ: لا يُطبَّق تقرير قديم */
        setPrices(R.prices); markDone(); save(); render(); toast('ضُبطت أسعار الأماكن'); draw();
      });
    };
    bFee.onclick = function () {
      ask('وضع مقرر الكشف «مبلغًا خاصًا» لـ ' + R.fee.length + ' طالب؟ (يبقى ثابتًا لهم حتى لو تغيّر سعر المكان)', function () {
        R = analyse(table); if (R.err) return;   /* إعادة الحساب لحظة التنفيذ: لا يُطبَّق تقرير قديم */
        R.fee.forEach(function (x) { x.s.info = Object.assign({}, x.s.info || {}, { fee: x.f }); });
        markDone(); save(); render(); toast('وُضع مبلغ خاص لـ ' + R.fee.length + ' طالب'); draw();
      });
    };
  }

  /* زر fee-setup.js القديم يفرض نظامًا واحدًا على كل طلاب المكان فيُفسد المطابقة لكل طالب: يُخفى */
  try { var st0 = document.createElement('style'); st0.textContent = '[data-fee-setup]{display:none!important}'; document.head.appendChild(st0); } catch (e) { /* ignore */ }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-fee-match]') && session && session.role === 'admin') dialog(); });
  new MutationObserver(function () {
    try {
      var q = document.querySelector('.qimp');
      if (q && !q.querySelector('[data-fee-match]') && session && session.role === 'admin') q.insertAdjacentHTML('beforeend', '<button type="button" class="btn primary" data-fee-match>مطابقة الاشتراكات مع كشف الإيراد</button>');
    } catch (e) { /* لا يعطّل العرض */ }
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
})();
