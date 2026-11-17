'use strict';
/* ============ صفحة داخل التطبيق بدل النافذة المنبثقة (للنماذج الطويلة) ============
   النافذة نفسها (.overlay > .modal) تُعرض صفحةً تملأ الشاشة (بلا خلفية معتمة ولا صندوق عائم)، والمحتوى في عمود بعرض مريح في الوسط.
   في أعلاها سهم رجوع والعنوان (وما يخص الصفحة كاختيار السنة)، و«حفظ/إلغاء» ثابتان أسفلها.
   ترويسة النافذة (.mhead وفيها العنوان و×) يصنعها nav.js؛ هنا تصير شريط الصفحة: سهم رجوع بدل ×.
   وإن أعادت النافذة كتابة محتواها (مثل تغيير السنة) فزالت الترويسة، تُصنع من جديد بالشكل نفسه.
   سهم الرجوع يضغط «إلغاء» الأصلي، وزر رجوع الهاتف يغلقها كما يغلق أي نافذة (nav.js).
   عرض فقط: النموذج ومعالجاته وحساباته كما هي. القائمة PAGES تحدد النوافذ التي تصير صفحات (بعنوانها). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./pages.js')) VFILES.push('./pages.js'); } catch (e) { /* ignore */ } });
  const PAGES = [/^\s*إعدادات الاشتراك\s*$/];
  const BACK = '<button type="button" class="qpback" aria-label="رجوع" title="رجوع"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
  const css = document.createElement('style');
  css.textContent = `.overlay.qpage{background:var(--bg,#f8f5ee)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding:0!important;align-items:stretch!important;justify-content:center}
    .overlay.qpage>.modal{--qpw:max(1rem,calc((100% - 680px) / 2));display:flex;flex-direction:column;width:100%;max-width:none!important;height:100%;max-height:none!important;margin:0;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:var(--card,#fff)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;overflow-y:auto;animation:none!important}
    .overlay.qpage>.modal>*{flex:none}
    .qpage>.modal>.mhead{position:sticky;top:0!important;z-index:3;display:flex;align-items:center;gap:.6rem;margin:0!important;padding:.7rem var(--qpw)!important;border-radius:0!important;background:var(--card,#fff)!important;border-bottom:1px solid var(--line,#e6dfcf)}
    .qpage>.modal>.mhead h2{margin:0;flex:1;min-width:0;font-size:1.05rem}
    .qpage>.modal>.mhead .mclose{display:none!important}
    .qpage .qpback{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid var(--line,#e6dfcf);border-radius:10px;background:transparent;color:var(--navy,#13294b);cursor:pointer}
    .qpage .qpback:hover{background:var(--navy-l,#eaeef5)}
    .qpage .qpback:focus-visible{outline:2px solid var(--gold,#b8904f);outline-offset:2px}
    .qpage>.modal>.mhead select{width:auto;margin:0;font-size:.95rem}
    .qpage>.modal>:not(.mhead):not(.row:last-child){margin-inline:var(--qpw)!important}
    .qpage>.modal>.mhead+*{margin-top:1rem!important}
    .qpage>.modal>.row:last-child{position:sticky;bottom:0!important;z-index:3;margin:auto 0 0!important;padding:.7rem var(--qpw) calc(.7rem + env(safe-area-inset-bottom,0px))!important;border-radius:0!important;background:var(--card,#fff)!important;border-top:1px solid var(--line,#e6dfcf)}`;
  document.head.appendChild(css);

  /* يُعاد بعد كل إعادة رسم للنافذة */
  function decorate(ov) {
    if (!ov.isConnected) return;
    const m = ov.querySelector(':scope > .modal'); if (!m) return;
    let head = m.querySelector(':scope > .mhead');
    const h = head ? head.querySelector('h2') : m.querySelector(':scope > h2');
    if (!ov.classList.contains('qpage')) { if (!h || !PAGES.some(r => r.test(h.textContent))) return; ov.classList.add('qpage'); }
    if (!h) return;
    if (!head) { head = document.createElement('div'); head.className = 'mhead'; m.prepend(head); head.appendChild(h); }
    if (head.querySelector('.qpback')) return;
    head.insertAdjacentHTML('afterbegin', BACK);
    /* اختيار السنة (إعدادات الاشتراك) بجانب العنوان */
    const y = m.querySelector('[data-cfgy]');
    if (y) { const lab = y.closest('label'); y.setAttribute('aria-label', 'مبالغ سنة'); head.appendChild(y); if (lab && !lab.querySelector('select,input,textarea')) lab.remove(); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.qpage .qpback'); if (!b) return;
    b.closest('.modal')?.querySelector('[data-close]')?.click();
  });
  const watch = ov => { decorate(ov); if (ov.classList.contains('qpage') && !ov._qpw) { ov._qpw = new MutationObserver(() => decorate(ov)); ov._qpw.observe(ov, { childList: true }); } };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay')) watch(n); }))).observe(document.body, { childList: true });
})();
