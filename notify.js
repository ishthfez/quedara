'use strict';
/* ============ إشعارات الطلاب بالاشتراكات ============
   - تأكيد الدفع يصل الطالبَ تلقائيًا من الخادم عند تسجيل اشتراكه (supabase/notify.sql).
   - «تذكير»: المحاسب (ومن له صلاحية التحصيل) والمدير من «الاشتراكات»، والمعلم والإداري من «التحصيل»،
     يرسلون للطالب (أو لكل من لم يسدّد) تذكيرًا بسداد اشتراك شهر يختارونه، مع ملاحظة اختيارية.
   - الرسائل تظهر للطالب في «الإعلانات» بعلامة «خاصة بك»، ولا تُزحم بها قائمة إعلانات المدير.
   يُحمَّل بعد nav.js وقبل app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./notify.js')) VFILES.push('./notify.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const canFees = () => session?.role === 'admin' || !!window.Perms?.can('fees.collect');
  const ymOf = (h, attr) => { const m = h.match(new RegExp(`<select data-${attr}[^>]*>[\\s\\S]*?<option value="(\\d{4})-(\\d{1,2})" selected`)); return m ? [+m[1], +m[2]] : null; };
  const now = () => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1]; };
  let pending = { ids: [], ym: null };

  /* ===== نافذة التذكير ===== */
  function remindDialog(ids, ym) {
    ids = [...new Set(ids)].filter(id => byId(db.students, id)); if (!ids.length) { toast('لا يوجد طلاب للتذكير'); return; }
    const [y0, m0] = ym || now(), opts = [];
    for (let k = -6; k <= 1; k++) { const d = new Date(y0, m0 - 1 + k, 1); opts.push({ v: `${d.getFullYear()}-${d.getMonth() + 1}`, l: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }); }
    const who = ids.length === 1 ? `«${byId(db.students, ids[0]).name}»` : `${ids.length} طالبًا`;
    openForm('تذكير بسداد الاشتراك', [
      { type: 'note', label: `يصل ${who} في «الإعلانات» على حسابه: «تذكير: نرجو سداد اشتراك شهر …».` },
      { name: 'ym', label: 'عن شهر', type: 'select', value: `${y0}-${m0}`, options: opts },
      { name: 'note', label: 'ملاحظة (اختياري)', type: 'textarea' }
    ], v => {
      const [y, m] = String(v.ym).split('-').map(Number);
      if ((v.note || '').length > 500) return 'الملاحظة طويلة';
      send(ids, y, m, (v.note || '').trim());
    });
  }
  async function send(ids, y, m, note) {
    const txt = `تذكير: نرجو سداد اشتراك شهر ${MONTHS[m - 1]} ${y}.${note ? ' ' + note : ''}`;
    if (!CLOUD) {
      ids.forEach(id => db.news.push({ id: uid(), text: txt, audience: 'm:' + id, date: today(), author: (ROLE_L[session.role] || '') + ' ' + (me()?.name || ''), authorId: session.id }));
      save(); render(); toast(`أُرسل التذكير إلى ${ids.length} طالب`); return;
    }
    try {
      toast('جارٍ الإرسال…');
      const n = await window.Cloud.rpc('notify_dues', { students: ids, y, m, note });
      toast(n ? `أُرسل التذكير إلى ${n} طالب` : 'لم يُرسل شيء: أُرسل التذكير نفسه اليوم، أو ليس لك صلاحية على هؤلاء الطلاب');
    } catch (e) {
      toast(/notify_dues|PGRST202|404/i.test(String(e.message || e)) ? 'نفّذ ملف supabase/notify.sql على الخادم أولًا' : 'تعذّر الإرسال: ' + (e.message || e));
    }
  }

  /* ===== «الاشتراكات» (المدير والمحاسب): زر «تذكير» لكل من لم يسدّد، وزر لكل من في القائمة ===== */
  function decorateFees(h) {
    if (!canFees()) return h;
    const ids = [];
    h = h.replace(/<tr>((?:(?!<\/tr>)[\s\S])*?data-fee-(?:pay|log|assign)="([^"]+)"(?:(?!<\/tr>)[\s\S])*?)<\/td><\/tr>/g, (all, body, id) => {
      /* لم يسدّد هذا الشهر: «لم يُسدَّد» أو «جزئي»، أو بلا قيمة محددة ولم يدفع شيئًا؛ لا المنقطع ولا المعفى ولا من دفع */
      if (/منقطع|معفى/.test(body) || !/لم يُسدَّد|جزئي|بلا اشتراك محدد/.test(body)) return all;
      ids.push(id);
      return `<tr>${body}<button type="button" class="btn sm" data-remind="${esc(id)}" title="تذكير بالسداد">تذكير</button></td></tr>`;
    });
    pending = { ids, ym: ymOf(h, 'fmonth') };
    if (!ids.length) return h;
    const i = h.indexOf('<div class="tbl"><table>');
    return i < 0 ? h : h.slice(0, i) + `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${ids.length} طالب في القائمة لم يسدّد هذا الشهر.</span><button type="button" class="btn sm" data-remind-all>تذكير غير المسددين (${ids.length})</button></div>` + h.slice(i);
  }
  if (adminViews.fees) { const b = adminViews.fees; adminViews.fees = () => decorateFees(b()); }
  if (VIEWS.accountant?.fees) { const b = VIEWS.accountant.fees; VIEWS.accountant.fees = () => decorateFees(b()); }

  /* ===== «التحصيل» (المعلم والإداري): تذكير من لم يُحصَّل منه هذا الشهر ===== */
  if (teacherViews.collect) {
    const b = teacherViews.collect;
    teacherViews.collect = () => {
      const h = b();
      const ids = [...h.matchAll(/data-camt="([^"]+)" value="([^"]*)"/g)].filter(x => !x[2]).map(x => x[1]);
      pending = { ids, ym: ymOf(h, 'cmon') };
      if (!ids.length) return h;
      const i = h.indexOf('<div class="tbl"><table>');
      return i < 0 ? h : h.slice(0, i) + `<div class="bar noprint" style="margin:.2rem 0 .5rem"><span class="muted grow" style="font-size:.85rem">${ids.length} طالب لم يُسجَّل تحصيله لهذا الشهر.</span><button type="button" class="btn sm" data-remind-all>تذكير بالسداد (${ids.length})</button></div>` + h.slice(i);
    };
  }
  document.addEventListener('click', e => {
    const one = e.target.closest('[data-remind]'); if (one) { remindDialog([one.dataset.remind], pending.ym); return; }
    if (e.target.closest('[data-remind-all]')) remindDialog(pending.ids, pending.ym);
  });

  /* ===== إعلانات المدير: رسائل الطلاب (تأكيد الدفع والتذكير) في بطاقة مختصرة بدل أن تزحم القائمة ===== */
  const toStudent = n => /^m:/.test(n.audience || '') && !!byId(db.students, n.audience.slice(2));
  if (adminViews.news) {
    const b = adminViews.news;
    adminViews.news = () => {
      const all = db.news, st = all.filter(toStudent);
      if (!st.length) return b();
      let h; db.news = all.filter(n => !toStudent(n));
      try { h = b(); } finally { db.news = all; }
      const month = today().slice(0, 7), thisMonth = st.filter(n => String(n.date || '').startsWith(month));
      const pay = thisMonth.filter(n => /^تأكيد دفع/.test(n.text)).length, rem = thisMonth.length - pay;
      const last = st.slice(-6).reverse().map(n => `<div class="news">${byLine(n)}<b>إلى ${esc(byId(db.students, n.audience.slice(2))?.name || '')}:</b> ${esc(n.text)}<br><small>${esc(n.date)}</small></div>`).join('');
      return h + `<div class="card"><div class="bar" style="margin:0"><h2 class="grow" style="margin:0">رسائل الطلاب</h2><span class="muted">هذا الشهر: ${pay} تأكيد دفع · ${rem} تذكير</span></div>
        <p class="muted" style="font-size:.85rem">تصل كل طالب في «الإعلانات» على حسابه، ولا تظهر في القائمة أعلاه حتى لا تزدحم. آخرها:</p>${last}</div>`;
    };
  }
})();
