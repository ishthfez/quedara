'use strict';
/* ============ صفحة داخل التطبيق بدل النافذة المنبثقة (للنماذج الطويلة) ============
   النافذة نفسها (.overlay > .modal) تُعرض صفحةً: على الجوال تملأ الشاشة، وعلى الحاسوب صندوق في الوسط بعرض 680
   وبقية الصفحة ظاهرة حوله كما هي (بتظليل خفيف جدًا وبلا ضبابية)، والصندوق بظل يفصله عنها.
   في أعلاها سهم رجوع والعنوان (وما يخص الصفحة كاختيار السنة)، و«حفظ/إلغاء» ثابتان أسفلها.
   ترويسة النافذة (.mhead وفيها العنوان و×) يصنعها nav.js؛ هنا تصير شريط الصفحة: سهم رجوع بدل ×.
   وإن أعادت النافذة كتابة محتواها (مثل تغيير السنة) فزالت الترويسة، تُصنع من جديد بالشكل نفسه.
   سهم الرجوع يضغط «إلغاء» الأصلي، وزر رجوع الهاتف يغلقها كما يغلق أي نافذة (nav.js).
   يسري على كل النوافذ في التطبيق، عدا نافذة «تثبيت التطبيق» (.overlay.install). النوافذ العريضة (.wide و.sform) أعرض على الحاسوب.
   عرض فقط: النماذج ومعالجاتها وحساباتها كما هي.
   «استمارة طالب» تفتح داخل نافذة «إضافة طلاب» نفسها: تبويب ثالث بجانب «طالب واحد» و«عدة طلاب» (آخر الملف).
   «إشعار» لطالب واحد (mine.js) صار «رسالة»: عنوان النافذة «رسالة للطالب/ الاسم» وخانتها «النص»، وزر الصف عنوانه «رسالة». */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./pages.js')) VFILES.push('./pages.js'); } catch (e) { /* ignore */ } });
  const SKIP = '.install';
  const BACK = '<button type="button" class="qpback" aria-label="رجوع" title="رجوع"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
  const css = document.createElement('style');
  css.textContent = `.overlay.qpage{background:var(--bg,#f8f5ee)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding:0!important;align-items:stretch!important;justify-content:center}
    .overlay.qpage>.modal{--qpw:max(1rem,calc((100% - 680px) / 2));display:flex;flex-direction:column;width:100%;max-width:none!important;height:100%;max-height:none!important;margin:0;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:var(--card,#fff)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;overflow-y:auto;animation:none!important}
    .overlay.qpage>.modal>*{flex:none}
    .qpage>.modal>.mhead{position:sticky;top:0!important;z-index:3;display:flex;align-items:center;justify-content:flex-start!important;gap:.6rem;margin:0!important;padding:.7rem var(--qpw)!important;border-radius:0!important;background:var(--card,#fff)!important;border-bottom:1px solid var(--line,#e6dfcf)}
    .qpage>.modal>.mhead h2{margin:0;flex:1;min-width:0;font-size:1.05rem}
    .qpage>.modal>.mhead .mclose{display:none!important}
    .qpage .qpback{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0;border:1px solid var(--line,#e6dfcf);border-radius:10px;background:transparent;color:var(--navy,#13294b);cursor:pointer}
    .qpage .qpback:hover{background:var(--navy-l,#eaeef5)}
    .qpage .qpback:focus-visible{outline:2px solid var(--gold,#b8904f);outline-offset:2px}
    .qpage>.modal>.mhead select{width:auto;margin:0;font-size:.95rem}
    .qpage>.modal>:not(.mhead):not(.row:last-child){margin-inline:var(--qpw)!important}
    .qpage>.modal>.mhead+*{margin-top:1rem!important}
    .qpage>.modal>.row:last-child{position:sticky;bottom:0!important;z-index:3;margin:auto 0 0!important;padding:.7rem var(--qpw) calc(.7rem + env(safe-area-inset-bottom,0px))!important;border-radius:0!important;background:var(--card,#fff)!important;border-top:1px solid var(--line,#e6dfcf)}
    @media (min-width:861px){.overlay.qpage{background:rgba(10,18,35,.1)!important;padding:1.5rem 1rem!important;align-items:flex-start!important}
      .overlay.qpage>.modal{--qpw:1.25rem;max-width:680px!important;height:auto;max-height:calc(100vh - 3rem)!important;border:1px solid var(--line,#e6dfcf)!important;border-radius:16px!important;box-shadow:0 14px 44px rgba(10,18,35,.2)!important}
      .overlay.qpage>.modal.wide{max-width:800px!important}.overlay.qpage>.modal.sform,.overlay.qpage>.modal.qaddw{max-width:860px!important}
      .qpage>.modal>.mhead{border-radius:16px 16px 0 0!important}.qpage>.modal>.row:last-child{border-radius:0 0 16px 16px!important}}
    .overlay.qhide{display:none!important}
    @media print{.qpage .qpback{display:none!important}.qpage>.modal>.mhead,.qpage>.modal>.row:last-child{position:static!important;border:0!important;box-shadow:none!important}.overlay.qpage>.modal{box-shadow:none!important;border:0!important}}`;
  document.head.appendChild(css);

  /* يُعاد بعد كل إعادة رسم للنافذة (بعضها يعيد كتابة محتواها كله، فتزول الترويسة) */
  function decorate(ov) {
    if (!ov.isConnected || ov.matches(SKIP)) return;
    const m = ov.querySelector(':scope > .modal'); if (!m) return;
    msgWords(m);
    ov.classList.add('qpage');
    let head = m.querySelector(':scope > .mhead');
    if (!head) {
      head = document.createElement('div'); head.className = 'mhead';
      const h = m.firstElementChild?.tagName === 'H2' ? m.firstElementChild : null;
      m.prepend(head); if (h) head.appendChild(h);
    }
    if (head.querySelector('.qpback')) return;
    head.insertAdjacentHTML('afterbegin', BACK);
    /* اختيار السنة (إعدادات الاشتراك) بجانب العنوان */
    const y = m.querySelector('[data-cfgy]');
    if (y) { const lab = y.closest('label'); y.setAttribute('aria-label', 'مبالغ سنة'); head.appendChild(y); if (lab && !lab.querySelector('select,input,textarea')) lab.remove(); }
  }
  /* نافذة الإشعار (noteDialog في mine.js): لطالب واحد «رسالة للطالب/ الاسم»، وخانة النص «النص» */
  function msgWords(m) {
    const h = m.querySelector('h2');
    const one = h && /^\s*إشعار:\s*/.test(h.textContent);
    if (one) h.textContent = 'رسالة للطالب/ ' + h.textContent.replace(/^\s*إشعار:\s*/, '');
    if (!one && !/^\s*(رسالة للطالب|إشعار لطلاب)/.test(h?.textContent || '')) return;
    m.querySelectorAll('label').forEach(l => { const t = [...l.childNodes].find(n => n.nodeType === 3 && n.textContent.trim() === 'نص الإشعار'); if (t) t.textContent = 'النص'; });
    if (one) m.querySelectorAll('.note, p, small, div').forEach(x => { if (x.children.length === 0 && /^يصل كل طالب في «الإعلانات»/.test(x.textContent.trim())) x.textContent = 'تصل الرسالة إلى الطالب في «الإعلانات» على حسابه، باسمك.'; });
  }
  /* زر الصف لطالب واحد: «رسالة» (toolbar.js يضع عنوانه عند تحويله أيقونة، فيُعاد بعده) */
  let msgT = 0;
  const msgBtns = () => { msgT = 0; document.querySelectorAll('[data-mnote]:not([data-mnote="*"])').forEach(b => { if (b.title !== 'رسالة') { b.title = 'رسالة'; b.setAttribute('aria-label', 'رسالة'); } }); };
  new MutationObserver(() => { if (!msgT) msgT = requestAnimationFrame(msgBtns); }).observe(document.body, { childList: true, subtree: true });

  /* الرجوع: كما يغلق × في nav.js («إلغاء/إغلاق» النافذة نفسها إن وُجد)، وإلا تُزال النافذة */
  document.addEventListener('click', e => {
    const b = e.target.closest('.qpage .qpback'); if (!b) return;
    const ov = b.closest('.overlay'), m = b.closest('.modal');
    const x = m?.querySelector(':scope > .mhead .mclose');
    if (x && ov === [...document.querySelectorAll('.overlay')].pop()) { x.click(); return; }
    const c = m?.querySelector(':scope > .row:last-child [data-close], [data-close]');
    if (c) c.click(); else ov?.remove();
  });
  const watch = ov => { decorate(ov); if (ov.classList.contains('qpage') && !ov._qpw) { ov._qpw = new MutationObserver(() => decorate(ov)); ov._qpw.observe(ov, { childList: true }); } };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('overlay')) watch(n); }))).observe(document.body, { childList: true });

  /* ===== «استمارة طالب» داخل نافذة «إضافة طلاب» =====
     نافذة «إضافة طلاب» (quickAdd في app-forms.js) تُخفى ولا تُغلق (فيبقى ما كُتب فيها)، وتُفتح الاستمارة الكاملة (studentForm)
     بالعنوان نفسه وشريط التبويبات نفسه وبالعرض نفسه، فتبدو نافذة واحدة يتغيّر محتواها.
     «طالب واحد» أو «عدة طلاب» من الاستمارة: تُغلق الاستمارة وتعود «إضافة طلاب» على التبويب المختار.
     إغلاق الاستمارة أو حفظها يُغلق «إضافة طلاب» معها. (يسبق معالج toolbar.js القديم الذي كان يغلق ويفتح نافذة أخرى) */
  window.addEventListener('click', e => {
    const t = e.target.closest?.('.overlay [data-qm]'); if (!t) return;
    const ov = t.closest('.overlay'), mode = t.dataset.qm;
    if (mode === 'form' && ov.querySelector('[data-qp]')) {
      if (typeof A === 'undefined' || !A.addStudent) return;
      e.stopImmediatePropagation(); e.preventDefault();
      const quick = ov;
      quick.classList.add('qhide');
      A.addStudent();
      const f = [...document.querySelectorAll('.overlay')].pop();
      if (!f || f === quick) { quick.classList.remove('qhide'); return; }
      f._quick = quick; f.classList.add('qaddform');
      const m = f.querySelector(':scope > .modal'), qm = quick.querySelector(':scope > .modal');
      m?.classList.add('qaddw'); qm?.classList.add('qaddw');
      const tabs = t.parentElement.cloneNode(true);
      tabs.querySelectorAll('[data-qm]').forEach(b => b.classList.toggle('on', b.dataset.qm === 'form'));
      const h = m?.querySelector(':scope > .mhead h2, :scope > h2'), qh = quick.querySelector('h2');
      if (h && qh) h.textContent = qh.textContent;
      const after = m?.querySelector(':scope > .mhead') || h;
      if (after) after.after(tabs); else m?.prepend(tabs);
      return;
    }
    if (ov.classList.contains('qaddform') && mode !== 'form') {
      e.stopImmediatePropagation(); e.preventDefault();
      const quick = ov._quick;
      ov._qsw = true;   // انتقال بين التبويبات: لا تُغلق «إضافة طلاب» معها
      const c = ov.querySelector('[data-close]'); if (c) c.click(); else ov.remove();
      if (quick?.isConnected) { quick.classList.remove('qhide'); quick.querySelector(`[data-qm="${mode}"]`)?.click(); }
    }
  }, true);
  new MutationObserver(ms => ms.forEach(m => m.removedNodes.forEach(n => {
    if (n.nodeType === 1 && n._quick && !n._qsw && n._quick.isConnected) n._quick.remove();
  }))).observe(document.body, { childList: true });
})();
