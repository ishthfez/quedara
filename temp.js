/* ============ الحساب المؤقت للطالب الخارجي في الدورة المكثفة ============
   زر «حساب مؤقت» في صفوف الطلاب الخارجيين (للمنظم) بعد اجتياز التصفية: يُنشئ سجل طالب «(مؤقت)» (crs_temp_member)
   ثم حساب دخول بكلمة مرور تُعرض مرة واحدة (admin-users). وعند فتح قسم البرامج (مرة في الجلسة)
   يُوقف المنتهين (نهاية الدورة + 7 أيام) ويحذف حسابات دخولهم (crs_temp_expire). الخادم: supabase/temp_accounts.sql */
(function () {
  'use strict';
  const CLOUD = () => !!(window.Cloud && window.Cloud.enabled);
  const role = () => (typeof session !== 'undefined' && session && session.role) || '';
  const onPrograms = () => typeof ui !== 'undefined' && ui && ui.tab === 'programs';
  const errMsg = (e) => {
    let m = String((e && e.message) || e || '');
    try { const b = e && e.body && (typeof e.body === 'string' ? JSON.parse(e.body) : e.body); if (b && (b.message || b.error)) m = b.message || b.error; } catch (x) { /* ignore */ }
    return m.replace(/^.*?:\s*/, '') || 'تعذّر التنفيذ';
  };
  const newPass = () => 'temp' + String(Math.floor(100000 + Math.random() * 900000));

  function decorate() {
    if (!onPrograms()) return;
    document.querySelectorAll('main table tbody tr').forEach((tr) => {
      if (tr.querySelector('[data-tmp]')) return;
      const ext = [...tr.querySelectorAll('.pg-tag')].some((t) => t.textContent.trim() === 'خارجي');
      const st = tr.children[2] && tr.children[2].textContent.trim();
      const btn = tr.querySelector('[data-ie][data-id]');
      if (!ext || !btn || !['اجتاز التصفية', 'في الدورة'].includes(st)) return;
      btn.parentElement.insertAdjacentHTML('beforeend', ` <button class="btn sm" data-tmp="${btn.dataset.id}">حساب مؤقت</button>`);
    });
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('main [data-tmp]'); if (!b) return;
    const cell = b.closest('tr').children[0];
    const name = (cell.childNodes[0] && cell.childNodes[0].textContent || cell.textContent).trim();
    ask(`إنشاء حساب دخول مؤقت لـ${name}؟ يتوقف بعد أسبوع من نهاية الدورة.`, async () => {
      try {
        const p = Cloud.rpc('crs_temp_member', { eid: b.dataset.tmp });
        const mid = await (window.withBusy ? withBusy(b, p) : p);
        const pw = newPass();
        const r = await Cloud.fn({ action: 'provision', items: [{ member_id: mid, password: pw }] });
        const res = r && r.results && r.results[0];
        if (!res || !res.ok) throw new Error((res && res.error) || 'تعذّر إنشاء حساب الدخول');
        openInfo('الحساب المؤقت', `<p>الاسم في صفحة الدخول: <b>${esc(name)} (مؤقت)</b></p>
          <p>كلمة المرور: <b dir="ltr" style="font-size:1.3rem;letter-spacing:.05em">${pw}</b></p>
          <p class="muted">سلّمها للطالب الآن؛ لا تُعرض مرة أخرى. يرى بها «دورتي» حتى أسبوع بعد نهاية الدورة، ثم يتوقف حسابه تلقائيًا.</p>`);
        const rl = document.querySelector('main [data-ia="reload"]'); if (rl) rl.click();
      } catch (e) { toast(errMsg(e)); }
    });
  });

  let expired = false;
  async function expire() {
    if (expired || !CLOUD() || !['admin', 'supervisor'].includes(role())) return;
    expired = true;
    try {
      const L = await Cloud.rpc('crs_temp_expire');
      for (const x of L || []) if (x.has_login) { try { await Cloud.fn({ action: 'remove', member_id: x.member_id }); } catch (e) { /* ignore */ } }
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { if (!VFILES.includes('./temp.js')) VFILES.push('./temp.js'); } catch (e) { /* ignore */ }
    let raf = 0;
    const schedule = () => { if (raf || !onPrograms()) return; raf = requestAnimationFrame(() => { raf = 0; decorate(); }); };
    try {
      const base = render;
      render = function () { const r = base.apply(this, arguments); try { if (onPrograms()) { expire(); schedule(); } } catch (e) { /* ignore */ } return r; };
    } catch (e) { /* ignore */ }
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  });
})();
