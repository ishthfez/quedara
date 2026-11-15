'use strict';
/* ============ ملف الطالب: اشتراكاته وحساب دخوله (إعادة التنظيم، المرحلة الأولى) ============
   «الأعضاء» لم يعد قسمًا، فما يخص الطالب يظهر في ملفه (للمدير):
     - الاشتراكات: الاشتراك الشهري، وعدد الدفعات وإجماليها وآخرها، وزر «سجل الدفعات».
     - حساب الدخول: متاح أو لا، وزر «إنشاء حساب دخول» أو «كلمة مرور جديدة».
   عرض فقط: لا يغيّر أي بيانات إلا بضغطة المدير على زر الحساب (والتأكيد). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./people.js')) VFILES.push('./people.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');

  /* ===== النصوص القديمة التي تشير إلى «الأعضاء» (لم يعد قسمًا) =====
     تُصحَّح في مكان واحد بدل تعديل كل ملف: رسائل التنبيه، والأزرار والملاحظات في الصفحات والنوافذ. */
  const FIX = [
    ['«الأعضاء» ← «مكرر للمراجعة»', '«الإعدادات» ← «مكرر للمراجعة»'],
    ['تبويب «الأعضاء» ← الإداريون', '«العاملون ← الحسابات ← الإداريون»'],
    ['من «الأعضاء ← الإداريون»', 'من «العاملون ← الحسابات ← الإداريون»'],
    ['«الأعضاء ← غير مصنف»', '«العاملون ← الحسابات ← غير مصنف»'],
    ['«الأعضاء» ← «غير مصنف»', '«الطلاب» (التصفية: «بلا حلقة»)'],
    ['«الأعضاء» ← «المشرفون»', '«العاملون ← الحسابات» ← «المشرفون»'],
    ['من تبويبات الأعضاء', 'من «العاملون ← الحسابات»'],
    ['من فئات الأعضاء', 'من «العاملون ← الحسابات»'],
    ['من «الأعضاء»', 'من «العاملون ← الحسابات» و«الطلاب ← الحسابات»'],
    ['الأعضاء والحسابات', 'الحسابات']
  ];
  const fixText = t => { if (typeof t !== 'string' || !t.includes('الأعضاء')) return t; FIX.forEach(([a, b]) => { t = t.split(a).join(b); }); return t; };
  if (typeof toast === 'function') { const baseToast = toast; toast = function (m, ...r) { return baseToast.call(this, fixText(m), ...r); }; }
  if (typeof ask === 'function') { const baseAsk = ask; ask = function (m, ...r) { return baseAsk.call(this, fixText(m), ...r); }; }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
  function fixNodes(root) {
    if (!root || root.nodeType !== 1 || !root.textContent.includes('الأعضاء')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.includes('الأعضاء') && !SKIP.has(n.parentNode?.nodeName) ? 1 : 2) });
    const ns = []; while (w.nextNode()) ns.push(w.currentNode);
    ns.forEach(n => { const v = fixText(n.data); if (v !== n.data) n.data = v; });
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => fixNodes(n.nodeType === 3 ? n.parentNode : n))))
    .observe(document.body, { childList: true, subtree: true });

  if (typeof studentCard !== 'function') return;
  const base = studentCard;
  studentCard = function (st) {
    base.apply(this, arguments);
    if (!st || session?.role !== 'admin') return;
    const box = [...document.querySelectorAll('.overlay .scard')].pop(); if (!box) return;
    const fees = (Array.isArray(db.fees) ? db.fees : []).filter(f => f.studentId === st.id);
    const total = fees.reduce((a, f) => a + (+f.amount || 0), 0);
    const last = fees.slice().sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m))[0];
    const fee = st.info?.fee;
    const row = (l, v) => `<tr><th>${l}</th><td>${v}</td></tr>`;
    const feesRows = (fee === '' || fee == null ? '' : row('الاشتراك الشهري', esc(money(fee)) + ' جنيه'))
      + row('الدفعات', fees.length ? `${fees.length} دفعة، إجماليها ${money(total)} جنيه` : 'لا دفعات مسجّلة')
      + (last ? row('آخر دفعة', `عن ${MONTHS[last.m - 1] || last.m} ${esc(last.y)}${last.date ? ` <span class="muted" dir="ltr">(${esc(last.date)})</span>` : ''}`) : '');
    const acc = CLOUD ? (st.hasLogin ? '<span class="tag tag-ok">متاح</span>' : '<span class="tag">بلا حساب</span>') : '<span class="muted">على هذا الجهاز</span>';
    const html = `<h3 class="sc-h">الاشتراكات</h3><div class="tbl"><table>${feesRows}</table></div>
      ${fees.length ? `<div class="row noprint" style="margin:.4rem 0 0"><button type="button" class="btn sm" data-fee-log="${esc(st.id)}">سجل الدفعات</button></div>` : ''}
      <h3 class="sc-h">حساب الدخول</h3><div class="tbl"><table>${row('الحالة', acc)}</table></div>
      ${CLOUD ? `<div class="row noprint" style="margin:.4rem 0 0"><button type="button" class="btn sm" data-act="cloudPw" data-id="${esc(st.id)}" data-k="students">${st.hasLogin ? 'كلمة مرور جديدة' : 'إنشاء حساب دخول'}</button></div>` : ''}`;
    const actions = box.querySelector(':scope > .row.noprint:last-child');
    if (actions) actions.insertAdjacentHTML('beforebegin', html); else box.insertAdjacentHTML('beforeend', html);
  };
})();
