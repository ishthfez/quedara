'use strict';
/* ============ «الحضور» نافذة داخل «الطلاب» ============
   كان تبويبًا في شريط «الطلاب» (الطلاب · الحضور · الاشتراكات · تحصيل المعلمين)؛ صار زر «الحضور» في صف أدوات جدول الطلاب
   (يسار البحث والقوائم)، يفتح نافذة فيها مساحة عمل الحضور نفسها (attWork في nav.js): المكان والحلقة والتاريخ، وجدول الحلقة
   بزرّي حاضر/غائب ومتأخر وأدوات الحلقة. كل ما فيها يعمل بمعالجاته الأصلية، وتُعاد بعد كل رسم بمحتواها الجديد ومكان التمرير نفسه.
   النافذة داخل <main> (لتعمل فيها معالجات الصفحة كما كانت في التبويب)، وتُغلق بسهم الرجوع أو Esc أو زر رجوع الهاتف.
   ترتيبها: قائمة واحدة «الحلقة — المكان» (بدل قائمتي المكان والحلقة؛ وإن كانت حلقة واحدة يظهر اسمها ومكانها نصًا) و«اليوم»،
   ثم البحث باسم الطالب وتبويبا المنتظمين والمنقطعين في صف، ثم زر «إشعار للطلاب» أيقونةً وحجم الخط، ثم الجدول.
   (بلا سطر المكان والوقت ولا العدد ولا عنوان الحلقة، وبلا الطباعة والحفظ) */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./attwin.js')) VFILES.push('./attwin.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main .subnav [data-svw="att"]{display:none!important}
    main > .overlay.qatt{z-index:65}
    main:has(> .overlay.qatt){transform:none!important;animation:none!important}
    /* قاعدة قديمة (app-abs.js) تخفي «إشعار» الفردي حين توجد قائمة حلقة الحضور في الصفحة: تخص النافذة وحدها لا جدول الطلاب خلفها */
    main:has(> .overlay.qatt) > :not(.qatt) .tbl td [data-mnote]:not([data-mnote="*"]){display:inline-flex!important}
    .qatt .tblprint [data-print],.qatt .tblprint .qsave,.qatt .tblprint .texp,.qatt .tblprint [data-heads],.qatt .tblprint > .qsp{display:none!important}
    .qatt .tblprint.qtb{justify-content:flex-start!important}
    .qatt .attbar{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:0}
    .qatt .attbar > select,.qatt .attbar > .qcombo{flex:1 1 16rem;max-width:30rem;margin:0}
    .qatt .attbar .qatt-one{flex:1 1 auto;font-weight:700;color:var(--navy,#13294b)}
    .qatt .attbar label{display:flex;align-items:center;gap:.5rem;margin:0;font-weight:700;color:var(--navy,#13294b)}
    .qatt .attbar label input{width:auto;margin:0}
    .qatt [data-mnote="*"].icon-only{width:40px;height:38px;padding:0;display:inline-flex;align-items:center;justify-content:center}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-attopen]:is(.btn,button){order:4!important;flex:0 0 auto!important}
    [data-attopen]{display:inline-flex;align-items:center;gap:.35rem}
    [data-attopen] svg{width:18px;height:18px}`;
  document.head.appendChild(css);
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M9 15l2 2 4-4"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  let open = false, top = 0;
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';
  const onStu = () => { try { return ui.tab === 'students' && isAdm(); } catch (e) { return false; } };

  const NOTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 21l1.95-5.6A8.5 8.5 0 1 1 21 11.5z"/></svg>';
  /* محتوى تبويب «الحضور» القديم نفسه (attWork في nav.js)، بلا شريط تبويبات «الطلاب»، ثم يُرتَّب كما في أول الملف */
  function attHtml() {
    const keep = ui.svw, keepP = ui.fp; let h = '';
    /* تصفية المكان في «الطلاب» لا تخص النافذة: قائمتها كل الحلقات بأماكنها */
    try { ui.svw = 'att'; ui.fp = ''; h = adminViews.students(); } finally { ui.svw = keep; ui.fp = keepP; }
    const i = h.indexOf('<div class="card subnav">');
    if (i > -1) { const e = h.indexOf('</div></div>', i); if (e > -1) h = h.slice(0, i) + h.slice(e + 12); }
    try { return tidy(h); } catch (e) { console.error('attwin tidy:', e); return h; }
  }
  function tidy(h) {
    const t = document.createElement('template'); t.innerHTML = h; const C = t.content;
    /* الصف الأول: «الحلقة — المكان» واليوم */
    const sel = C.querySelector('select[data-atth]');
    if (sel) {
      const bar = sel.closest('.bar') || sel.parentElement; bar.classList.add('attbar');
      C.querySelector('select[data-fplace]')?.closest('.qcombo, label')?.remove(); C.querySelector('select[data-fplace]')?.remove();
      const cur = sel.value || sel.querySelector('option[selected]')?.value || ui.hid;
      const pl = h0 => (typeof placeName === 'function' && placeName(h0)) || '';
      const hs = (db.halaqat || []).slice().sort((a, b) => (pl(a)).localeCompare(pl(b), 'ar') || halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
      const lab = h0 => `${halaqaLabel(h0)}${pl(h0) ? ' — ' + pl(h0) : ''}`;
      if (hs.length === 1) {
        const one = document.createElement('span'); one.className = 'qatt-one'; one.textContent = lab(hs[0]);
        (sel.closest('.qcombo') || sel).replaceWith(one);
      } else {
        sel.setAttribute('aria-label', 'الحلقة والمكان');
        sel.innerHTML = hs.map(h0 => `<option value="${esc(h0.id)}"${h0.id === cur ? ' selected' : ''}>${esc(lab(h0))}</option>`).join('');
      }
      const date = C.querySelector('input[data-change="date"]'), dl = date?.closest('label');
      if (dl) { [...dl.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); dl.prepend(date.value === today() ? 'اليوم' : 'التاريخ'); }
    }
    /* البطاقة الثانية: بلا سطر المكان والوقت ولا العدد؛ البحث ثم التبويبان في صف */
    const q = C.querySelector('input[data-mq]'), tabs = C.querySelector('.mtabs');
    if (q && tabs) { const card = q.closest('.card'); card?.querySelector(':scope > p.muted:not([data-mcount])')?.remove(); tabs.before(q); }
    C.querySelector('p[data-mcount]')?.remove();
    /* صف الأزرار: «إشعار للطلاب» أيقونة (بلا عنوان الحلقة وعدد طلابها)، ثم حجم الخط */
    const all = C.querySelector('[data-mnote="*"]');
    if (all) {
      const b = all.closest('.bar');
      b?.querySelectorAll(':scope > h2, :scope > .muted').forEach(x => x.remove());
      all.className = 'btn icon-only'; all.title = 'إشعار للطلاب'; all.setAttribute('aria-label', 'إشعار للطلاب'); all.innerHTML = NOTE;
    }
    return t.innerHTML;
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
