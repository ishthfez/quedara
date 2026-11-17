/* ============ مطابقة الاشتراكات مع كشف الإيراد (للمدير) ============
   يقرأ ملف «مرجع مطابقة الاشتراكات» (رقم الطالب القديم، نظام الحضور، المقرر) ويقارن كل طالب بما في التطبيق:
   - نظام الحضور (info.feeSys).
   - المقرر قبل أي خصم (كما يحسبه التطبيق من سعر المكان أو الفئة أو المبلغ الخاص) بعد ضبط النظام.
   يعرض الفروق أولًا، ولا يغيّر شيئًا إلا بزر صريح. المنقطعون لا يُقارنون. */
(function () {
  'use strict';
  var dg = function (s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }).replace(/\.0+$/, '').trim(); };
  var money = function (n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'); };
  var baseOf = function (s, sys) {
    if (typeof window.QLFeeDue !== 'function') return null;
    var info = Object.assign({}, s.info || {}, { feeSys: sys, feeDisc: '', feeDiscVal: '' });
    return window.QLFeeDue(Object.assign({}, s, { info: info }));
  };

  function analyse(table) {
    var grid = table.map(function (r) { return Array.from(r || [], function (c) { return String(c == null ? '' : c).trim(); }); });
    var hi = grid.slice(0, 5).findIndex(function (r) { return r.indexOf('رقم الطالب القديم') >= 0; });
    if (hi < 0) return { err: 'لم أجد عمود «رقم الطالب القديم». استخدم ملف «مرجع مطابقة الاشتراكات».' };
    var H = grid[hi], C = { code: H.indexOf('رقم الطالب القديم'), name: H.indexOf('اسم الطالب'), lv: H.indexOf('المكان والمستوى'), sys: H.indexOf('نظام الحضور'), fee: H.indexOf('المقرر') };
    if (C.sys < 0 || C.fee < 0) return { err: 'لم أجد عمودي «نظام الحضور» و«المقرر».' };
    var byOld = new Map();
    db.students.forEach(function (s) { var c = dg((s.info || {}).oldCode); if (c) byOld.set(c, s); });
    var out = { total: 0, matched: 0, off: 0, none: [], sys: [], fee: [], noPrice: 0, groups: {} };
    grid.slice(hi + 1).forEach(function (r) {
      var code = dg(r[C.code]); if (!code) return;
      out.total++;
      var s = byOld.get(code);
      if (!s) { out.none.push(r[C.name] || code); return; }
      if (stOff(s)) { out.off++; return; }
      out.matched++;
      var fSys = dg(r[C.sys]) === '3' ? '3' : '6', aSys = (s.info || {}).feeSys === '3' ? '3' : '6', fFee = +dg(r[C.fee]);
      if (aSys !== fSys) out.sys.push({ s: s, a: aSys, f: fSys, lv: r[C.lv] || '' });
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
    return '<div class="grid">' + stat(R.total, 'طالب في الكشف') + stat(R.matched, 'مطابَق ومنتظم') + stat(R.sys.length, 'نظام حضور مختلف') + stat(R.fee.length, 'مقرر مختلف')
      + (R.off ? stat(R.off, 'منقطع (لا يُقارن)') : '') + (R.none.length ? stat(R.none.length, 'غير موجود في التطبيق') : '') + (R.noPrice ? stat(R.noPrice, 'بلا سعر محدد') : '') + '</div>'
      + (R.sys.length ? '<h3 class="sc-h">نظام الحضور المختلف</h3><div class="tbl" style="max-height:35vh;overflow:auto"><table><tr><th>الطالب</th><th>المستوى في الكشف</th><th>في التطبيق</th><th>في الكشف</th></tr>' + sysRows + '</table></div>' + (R.sys.length > 200 ? '<p class="muted">يظهر أول 200 فقط.</p>' : '') : '')
      + (g ? '<h3 class="sc-h">المقرر المختلف (بعد ضبط نظام الحضور، وقبل أي خصم)</h3><p class="muted" style="font-size:.85rem;margin:0 0 .4rem">إن كان الفرق في مجموعة كاملة من مكان واحد، فالأفضل تصحيح سعر المكان من «إعدادات الاشتراك». أما زر «مبلغ خاص» فيضع مقرر الكشف لكل طالب مختلف، ويبقى ثابتًا له حتى لو تغيّر سعر المكان لاحقًا.</p><div class="tbl" style="max-height:35vh;overflow:auto"><table><tr><th>المكان في التطبيق</th><th>المستوى في الكشف</th><th>النظام</th><th>التطبيق</th><th>الكشف</th><th>عدد الطلاب</th></tr>' + g + '</table></div>' : '')
      + (R.none.length ? '<div class="note" style="margin-top:.6rem">غير موجودين في التطبيق برقمهم القديم (' + R.none.length + '): <small>' + R.none.slice(0, 25).map(esc).join('، ') + (R.none.length > 25 ? '…' : '') + '</small></div>' : '')
      + (!R.sys.length && !R.fee.length ? '<p class="note ok">كل الطلاب المطابَقين متوافقون مع الكشف.</p>' : '');
  }

  function dialog() {
    var ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="modal wide"><h2>مطابقة الاشتراكات مع كشف الإيراد</h2>'
      + '<p class="muted" style="font-size:.88rem;margin:0 0 .6rem">اختر ملف «مرجع مطابقة الاشتراكات». تظهر الفروق أولًا، ولا يتغيّر شيء إلا بالأزرار أسفل التقرير.</p>'
      + '<div class="bar"><label class="btn primary" style="margin:0">اختيار الملف<input type="file" accept=".xlsx" data-fmf hidden></label></div>'
      + '<div data-fmprev></div>'
      + '<div class="row"><button type="button" class="btn primary" data-fmsys hidden></button><button type="button" class="btn" data-fmfee hidden></button><button type="button" class="btn" data-close>إغلاق</button></div></div>';
    document.body.appendChild(ov);
    var table = null, R = null;
    var box = ov.querySelector('[data-fmprev]'), bSys = ov.querySelector('[data-fmsys]'), bFee = ov.querySelector('[data-fmfee]');
    var draw = function () {
      R = analyse(table);
      if (R.err) { box.innerHTML = '<p class="note" style="color:var(--red)">' + esc(R.err) + '</p>'; bSys.hidden = bFee.hidden = true; return; }
      box.innerHTML = report(R);
      bSys.hidden = !R.sys.length; bSys.textContent = 'ضبط نظام الحضور لـ ' + R.sys.length + ' طالب';
      /* المبلغ الخاص بعد ضبط النظام فقط، حتى لا يُثبَّت مبلغ بسبب نظام خاطئ */
      bFee.hidden = !R.fee.length || !!R.sys.length; bFee.textContent = 'وضع مبلغ خاص لـ ' + R.fee.length + ' طالب';
    };
    ov.querySelector('[data-close]').onclick = function () { ov.remove(); };
    ov.querySelector('[data-fmf]').onchange = async function (e) {
      var f = e.target.files[0]; if (!f) return;
      box.innerHTML = '<p class="muted">جارٍ قراءة الملف…</p>';
      try { table = await parseXLSX(await f.arrayBuffer()); draw(); } catch (err) { box.innerHTML = '<p class="note" style="color:var(--red)">تعذّرت قراءة الملف.</p>'; }
    };
    bSys.onclick = function () {
      ask('ضبط نظام الحضور لـ ' + R.sys.length + ' طالب كما في الكشف؟', function () {
        R.sys.forEach(function (x) { x.s.info = Object.assign({}, x.s.info || {}, { feeSys: x.f }); });
        save(); render(); toast('ضُبط نظام الحضور لـ ' + R.sys.length + ' طالب'); draw();
      });
    };
    bFee.onclick = function () {
      ask('وضع مقرر الكشف «مبلغًا خاصًا» لـ ' + R.fee.length + ' طالب؟ (يبقى ثابتًا لهم حتى لو تغيّر سعر المكان)', function () {
        R.fee.forEach(function (x) { x.s.info = Object.assign({}, x.s.info || {}, { fee: x.f }); });
        save(); render(); toast('وُضع مبلغ خاص لـ ' + R.fee.length + ' طالب'); draw();
      });
    };
  }

  document.addEventListener('click', function (e) { if (e.target.closest('[data-fee-match]') && session && session.role === 'admin') dialog(); });
  new MutationObserver(function () {
    try {
      var q = document.querySelector('.qimp');
      if (q && !q.querySelector('[data-fee-match]') && session && session.role === 'admin') q.insertAdjacentHTML('beforeend', '<button type="button" class="btn primary" data-fee-match>مطابقة الاشتراكات مع كشف الإيراد</button>');
    } catch (e) { /* لا يعطّل العرض */ }
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
})();
