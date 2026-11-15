'use strict';
/* ============ تعديل دفعة اشتراك بعد تسجيلها (خطأ في التسجيل أو تراجع الطالب عن الدفع) ============
   - في «السجل» بجانب كل دفعة زر «تعديل» لمن يملك ذلك: المدير لكل الدفعات، ومن له صلاحية التحصيل لما سجّله هو.
   - يُعدَّل المبلغ والشهر وتاريخ التحصيل، مع سبب التعديل؛ و«تراجع الطالب عن الدفع» يجعل المبلغ صفرًا
     (أو ما بقي إن رُدّ جزء منه)، وتبقى الدفعة في السجل ولا تُحذف.
   - تُضاف إلى ملاحظة الدفعة تلقائيًا سطر بما تغيّر: التاريخ، ومن عدّل، والقديم ← الجديد، والسبب.
   - على الخادم (supabase/fees_edit.sql): التعديل للمدير، ولمن سجّل الدفعة إن كان يملك صلاحية التحصيل، ولا يتغير صاحبها ولا طالبها.
   يُحمَّل بعد fees.js و receipt.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./feeedit.js')) VFILES.push('./feeedit.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  const asAdmin = n => (/^المدير/.test(n || '') ? n : 'المدير ' + (n || ''));
  const actor = () => window.QLActAs?.() ? asAdmin(window.QLActAs().adminName) : session?.role === 'admin' ? asAdmin(me()?.name) : (me()?.name || '');
  const mayEdit = f => session?.role === 'admin' || window.QLActAs?.() || (can('fees.collect') && f.byMember === session?.id);
  const REASONS = [['fix', 'تصحيح خطأ في التسجيل'], ['refund', 'تراجع الطالب عن الدفع (استرداد)'], ['other', 'سبب آخر']];

  function edit(f) {
    const s = byId(db.students, f.studentId);
    const months = []; for (let k = -12; k <= 2; k++) { const d = new Date(+f.y, +f.m - 1 + k, 1); months.push({ v: `${d.getFullYear()}-${d.getMonth() + 1}`, l: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }); }
    openForm('تعديل دفعة: ' + (s?.name || ''), [
      { type: 'note', label: `الدفعة الحالية: ${money(f.amount)} جنيه عن ${MONTHS[f.m - 1]} ${f.y}، بتاريخ ${f.date || '—'}${f.by ? '، حصّلها ' + f.by : ''}.` },
      { name: 'reason', label: 'سبب التعديل', type: 'select', value: 'fix', options: REASONS.map(([v, l]) => ({ v, l })) },
      { name: 'amount', label: 'المبلغ بعد التعديل (جنيه) — في التراجع الكامل اكتب 0', type: 'number', min: 0, value: f.amount },
      { name: 'month', label: 'عن شهر', type: 'select', value: `${f.y}-${f.m}`, options: months },
      { name: 'date', label: 'تاريخ التحصيل', type: 'date', value: f.date || today() },
      { name: 'details', label: 'تفاصيل (اختياري)', type: 'textarea' },
      { type: 'note', label: 'تُضاف إلى ملاحظة الدفعة تلقائيًا سطرٌ بما تغيّر وتاريخه واسمك، وتبقى الدفعة في السجل.' }
    ], v => {
      let amount = v.amount === '' ? NaN : +v.amount;
      /* «تراجع الطالب» دون تغيير المبلغ = استرداد كامل */
      if (v.reason === 'refund' && amount === +f.amount) amount = 0;
      if (!(amount >= 0)) return 'اكتب مبلغًا صحيحًا (0 أو أكثر)';
      const [y, m] = String(v.month).split('-').map(Number), date = v.date || f.date;
      const ch = [];
      if (amount !== +f.amount) ch.push(`المبلغ ${money(f.amount)} ← ${money(amount)}`);
      if (y !== +f.y || m !== +f.m) ch.push(`الشهر ${MONTHS[f.m - 1]} ${f.y} ← ${MONTHS[m - 1]} ${y}`);
      if (date !== f.date) ch.push(`التاريخ ${f.date || '—'} ← ${date}`);
      if (!ch.length) return 'لم يتغير شيء';
      const why = REASONS.find(r => r[0] === v.reason)[1] + ((v.details || '').trim() ? ': ' + v.details.trim() : '');
      const line = `[عُدّلت ${today()} بواسطة ${actor()} — ${ch.join('، ')} — ${why}]`;
      f.amount = amount; f.y = y; f.m = m; f.date = date;
      f.note = [String(f.note || '').trim(), line].filter(Boolean).join(' ').slice(0, 2000);
      f.edited = true;
      db.fees = db.fees.slice();   // قائمة جديدة: يُعاد حساب المدفوع في «الاشتراكات» فورًا
      setTimeout(() => { toast(amount === 0 ? 'سُجّل التراجع عن الدفعة' : 'عُدّلت الدفعة'); document.querySelector(`[data-fee-log="${f.studentId}"]`)?.click(); }, 80);
    });
  }

  /* زر «تعديل» بجانب كل دفعة في نافذة «السجل»، و«مسترد» للدفعة التي صارت صفرًا */
  new MutationObserver(() => {
    document.querySelectorAll('.overlay [data-fee-rcpt]').forEach(b => {
      const td = b.parentElement; if (td.querySelector('[data-fee-edit]')) return;
      const f = (db.fees || []).find(x => x.id === b.dataset.feeRcpt); if (!f) return;
      if (mayEdit(f)) b.insertAdjacentHTML('afterend', `<button type="button" class="btn sm" data-fee-edit="${esc(f.id)}">تعديل</button>`);
      if (+f.amount === 0) { const c = td.parentElement.children[1]; if (c && !c.querySelector('.tag')) c.insertAdjacentHTML('beforeend', ' <span class="tag tag-no">مسترد</span>'); }
    });
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fee-edit]'); if (!b) return;
    const f = (db.fees || []).find(x => x.id === b.dataset.feeEdit); if (!f || !mayEdit(f)) return;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    edit(f);
  });
})();
