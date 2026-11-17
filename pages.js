'use strict';
/* ============ صفحة داخل التطبيق بدل النافذة المنبثقة (للنماذج الطويلة) ============
   النافذة نفسها (.overlay > .modal) تُعرض صفحةً تملأ الشاشة (بلا خلفية معتمة ولا صندوق عائم)، والمحتوى في عمود بعرض مريح في الوسط.
   في أعلاها سهم رجوع والعنوان (وما يخص الصفحة كاختيار السنة)، و«حفظ/إلغاء» ثابتان أسفلها.
   سهم الرجوع يضغط «إلغاء» الأصلي، وزر رجوع الهاتف يغلقها كما يغلق أي نافذة (nav.js).
   عرض فقط: النموذج ومعالجاته وحساباته كما هي. القائمة PAGES تحدد النوافذ التي تصير صفحات (بعنوانها). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./pages.js')) VFILES.push('./pages.js'); } catch (e) { /* ignore */ } });
  const PAGES = [/^\s*إعدادات الاشتراك\s*$/];
  const BACK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const css = document.createElement('style');
  css.textContent = `.overlay.qpage{background:var(--bg,#f8f5ee)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding:0;align-items:stretch;justify-content:center}
    .overlay.qpage>.modal{--qpw:max(1rem,calc((100% - 680px) / 2));display:flex;flex-direction:column;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;background:var(--card,#fff)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;overflow:auto;animation:none}
    .overlay.qpage>.modal>*{flex:none}
    .qpage>.modal>h2{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:.6rem;margin:0!important;padding:.7rem var(--qpw);background:var(--card,#fff);border-bottom:1px solid var(--line,#e6dfcf);font-size:1.05rem}
    .qpage .qptitle{flex:1;min-width:0}
    .qpage .qpback{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid var(--line,#e6dfcf);border-radius:10px;background:transparent;color:var(--navy,#13294b);cursor:pointer}
    .qpage .qpback:hover{background:var(--navy-l,#eaeef5)}
    .qpage .qpback:focus-visible{outline:2px solid var(--gold,#b8904f);outline-offset:2px}
    .qpage>.modal>h2 select{width:auto;margin:0;font-size:.95rem}
    .qpage>.modal>:not(h2):not(.row:last-child){margin-inline:var(--qpw)!important}
    .qpage>.modal>h2+*{margin-top:1rem!important}
    .qpage>.modal>.row:last-child{position:sticky;bottom:0;z-index:3;margin:auto 0 0!important;padding:.7rem var(--qpw) calc(.7rem + env(safe-area-inset-bottom,0px));background:var(--card,#fff);border-top:1px solid var(--line,#e6dfcf)}`;
  document.head.appendChild(css);

  const isPage = ov => { const h = ov.querySelector(':scope > .modal > h2'); return !!h && PAGES.some(r => r.test(h.textContent)); };
  /* يُعاد بعد كل إعادة رسم للنافذة (بعضها يعيد كتابة محتواها كله، مثل تغيير السنة) */
  function decorate(ov) {
    if (!ov.isConnected) return;
    if (!ov.classList.contains('qpage')) { if (!isPage(ov)) return; ov.classList.add('qpage'); }
    const m = ov.querySelector(':scope > .modal'), h = m && m.querySelector(':scope > h2');
    if (!h || h.querySelector('.qpback')) return;
    [...h.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { const s = document.createElement('span'); s.className = 'qptitle'; s.textContent = n.textContent.trim(); n.replaceWith(s); });
    h.insertAdjacentHTML('afterbegin', `<button type="button" class="qpback" aria-label="رجوع" title="رجوع">${BACK}</button>`);
    /* اختيار السنة (إعدادات الاشتراك) بجانب العنوان */
    const y = m.querySelector('[data-cfgy]');
    if (y) { const lab = y.closest('label'); y.setAttribute('aria-label', 'مبالغ سنة'); h.appendChild(y); if (lab && !lab.querySelector('select,input,textarea')) lab.remove(); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.qpage .qpback'); if (!b) return;
    b.closest('.modal')?.querySelector('[data-close]')?.click();
  });
  const watch = ov => { decorate(ov); if (ov.classList.contains('qpage') && !ov._qpw) { ov._qpw = new MutationObserver(() => decorate(ov)); ov._qpw.observe(ov, { childList: true }); } };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay')) watch(n); }))).observe(document.body, { childList: true });
})();
