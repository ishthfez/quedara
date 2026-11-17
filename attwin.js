'use strict';
/* ============ «الحضور» نافذة داخل «الطلاب» ============
   كان تبويبًا في شريط «الطلاب» (الطلاب · الحضور · الاشتراكات · تحصيل المعلمين)؛ صار زر «الحضور» في صف أدوات جدول الطلاب
   (يسار البحث والقوائم)، يفتح نافذة فيها مساحة عمل الحضور نفسها (attWork في nav.js): المكان والحلقة والتاريخ، وجدول الحلقة
   بزرّي حاضر/غائب ومتأخر وأدوات الحلقة. كل ما فيها يعمل بمعالجاته الأصلية، وتُعاد بعد كل رسم بمحتواها الجديد ومكان التمرير نفسه.
   النافذة داخل <main> (لتعمل فيها معالجات الصفحة كما كانت في التبويب)، وتُغلق بسهم الرجوع أو Esc أو زر رجوع الهاتف. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./attwin.js')) VFILES.push('./attwin.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main .subnav [data-svw="att"]{display:none!important}
    main > .overlay.qatt{z-index:65}
    main:has(> .overlay.qatt){transform:none!important;animation:none!important}
    /* قاعدة قديمة (app-abs.js) تخفي «إشعار» الفردي حين توجد قائمة حلقة الحضور في الصفحة: تخص النافذة وحدها لا جدول الطلاب خلفها */
    main:has(> .overlay.qatt) > :not(.qatt) .tbl td [data-mnote]:not([data-mnote="*"]){display:inline-flex!important}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-attopen]:is(.btn,button){order:4!important;flex:0 0 auto!important}
    [data-attopen]{display:inline-flex;align-items:center;gap:.35rem}
    [data-attopen] svg{width:18px;height:18px}`;
  document.head.appendChild(css);
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M9 15l2 2 4-4"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  let open = false, top = 0;
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';
  const onStu = () => { try { return ui.tab === 'students' && isAdm(); } catch (e) { return false; } };

  /* محتوى تبويب «الحضور» القديم نفسه، بلا شريط تبويبات «الطلاب» */
  function attHtml() {
    const keep = ui.svw; let h = '';
    try { ui.svw = 'att'; h = adminViews.students(); } finally { ui.svw = keep; }
    const i = h.indexOf('<div class="card subnav">');
    if (i > -1) { const e = h.indexOf('</div></div>', i); if (e > -1) h = h.slice(0, i) + h.slice(e + 12); }
    return h;
  }
  function place() {
    const main = document.querySelector('main'); if (!main) return;
    main.querySelector(':scope > .qatt')?.remove();
    if (!open || !onStu()) return;
    main.insertAdjacentHTML('beforeend', `<div class="overlay qpage qatt"><div class="modal qaddw"><div class="mhead"><button type="button" class="qpback" data-attclose aria-label="رجوع" title="رجوع">${BACK}</button><h2>الحضور</h2></div>${attHtml()}</div></div>`);
    const m = main.querySelector(':scope > .qatt > .modal'); if (m && top) m.scrollTop = top;
  }
  function close() {
    if (!open) return;
    /* خطوة السجل التي أضافها الفتح: الرجوع إليها يُغلقها (popstate أدناه) */
    if (history.state?.qatt) { history.back(); return; }
    open = false; top = 0; document.querySelector('main > .qatt')?.remove(); render();
  }
  /* كل رسم يستبدل <main> (وقد يتأخر الرسم إلى الإطار التالي)، فتُعاد النافذة متى خلت منها الصفحة وهي مفتوحة */
  const watch = () => {
    if (!open) return;
    if (!onStu()) { open = false; top = 0; return; }
    if (document.querySelector('main') && !document.querySelector('main > .qatt')) place();
  };
  document.addEventListener('scroll', e => { if (e.target.matches?.('main > .qatt > .modal')) top = e.target.scrollTop; }, true);

  document.addEventListener('DOMContentLoaded', () => {
    try { if (ui.svw === 'att') ui.svw = 'list'; } catch (e) { /* ignore */ }
    /* زر «الحضور» في صف أدوات الطلاب (بعد قائمة الحلقة) */
    const baseStu = adminViews.students;
    adminViews.students = function () {
      /* والنافذة مفتوحة: جدول الطلاب خلفها مختصر (app-abs.js)، فيخف كل رسم أثناء التحضير */
      window.QLStuLite = open && ui.svw !== 'att';
      let h; try { h = baseStu.apply(this, arguments); } finally { window.QLStuLite = false; }
      if (typeof h !== 'string' || ui.svw === 'att' || !isAdm()) return h;
      return h.replace(/(<div class="qseg" data-sstfseg|<select data-sstf)/, `<button type="button" class="btn" data-attopen>${ICON}الحضور</button>$1`);
    };
    new MutationObserver(() => { try { watch(); } catch (e) { console.error('attwin:', e); } }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-attopen]') && onStu()) {
      open = true; top = 0;
      /* خطوة في السجل ليغلقها الرجوع (لا «layer»: nav.js يمحوها عند الرسم إن لم يجد نافذة في body) */
      history.pushState({ ...(history.state || {}), qatt: 1 }, '');
      place();
      return;
    }
    if (e.target.closest('.qatt [data-attclose]')) { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !open) return;
    const ovs = document.querySelectorAll('.overlay');
    if (ovs[ovs.length - 1]?.classList.contains('qatt')) { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  }, true);
  /* رجوع الهاتف أو المتصفح من خطوة النافذة: تُغلق هنا (قبل معالج nav.js، فلا يعيد رسم الصفحة).
     وإن كانت فوقها نافذة أخرى (ملف طالب مثلًا) فالرجوع لها أولًا كما في nav.js */
  window.addEventListener('popstate', e => {
    if (!open || e.state?.qatt || document.querySelector('body > .overlay')) return;
    e.stopImmediatePropagation();
    open = false; top = 0; document.querySelector('main > .qatt')?.remove();
    render();   /* جدول الطلاب كاملًا من جديد بعد أن كان مختصرًا خلف النافذة */
  }, true);
})();
