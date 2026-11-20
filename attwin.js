'use strict';
/* ============ «الدفتر» (نافذة الحضور) داخل «الطلاب» ============
   الزر والنافذة اسمهما «الدفتر». على الهاتف يُعرض كل طالب بطاقةً (الاسم، ثم حاضر/غائب ومتأخر وآخر حفظ، ثم الأزرار)
   بتنسيق صفوف الجدول نفسه (CSS)، فتبقى كل الأزرار ومعالجاتها كما هي. */
/* ============ «الحضور» نافذة داخل «الطلاب» ============
   كان تبويبًا في شريط «الطلاب» (الطلاب · الحضور · الاشتراكات · تحصيل المعلمين)؛ صار زر «الحضور» في صف أدوات جدول الطلاب
   (يسار البحث والقوائم)، يفتح نافذة فيها مساحة عمل الحضور نفسها (attWork في nav.js): المكان والحلقة والتاريخ، وجدول الحلقة
   بزرّي حاضر/غائب ومتأخر وأدوات الحلقة. كل ما فيها يعمل بمعالجاته الأصلية، وتُعاد بعد كل رسم بمحتواها الجديد ومكان التمرير نفسه.
   النافذة داخل <main> (لتعمل فيها معالجات الصفحة كما كانت في التبويب)، وتُغلق بسهم الرجوع أو Esc أو زر رجوع الهاتف.
   ترتيبها: قائمة واحدة «الحلقة — المكان» (بدل قائمتي المكان والحلقة؛ وإن كانت حلقة واحدة يظهر اسمها ومكانها نصًا) و«اليوم»،
   ثم صف واحد (من اليمين): تبويبا المنتظمين والمنقطعين، البحث باسم الطالب، حجم الخط، «إشعار للطلاب» أيقونةً،
   «إضافة طالب» (كزر الطلاب، والحلقة مختارة مسبقًا في نافذته)؛ ثم الجدول.
   (بلا سطر المكان والوقت ولا العدد ولا عنوان الحلقة، وبلا الطباعة والحفظ)
   «متأخر»: الضغط عليه وهو مفعّل كان يحفظ حالة فارغة يرفضها الخادم (الحالات المقبولة: حاضر/متأخر/معتذر/غائب)، فيعود «متأخر».
   صار يعيد الحالة التي كانت قبل «متأخر» (وإلا «حاضر»)، وما حُفظ فارغًا من قبل يُصحَّح إلى «غائب» (كما كان يظهر).
   نافذة واحدة: ما يُفتح من داخل نافذة الحضور (السجل، الملف، التسميع، النقل، الرسالة...) يظهر في صندوقها نفسه وبحجمه
   بدل نافذة فوق نافذة: تختفي محتويات الحضور ما دام غيرها مفتوحًا، ولا يظهر إلا الأعلى، وسهم الرجوع يعود خطوة. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./attwin.js')) VFILES.push('./attwin.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `main .subnav [data-svw="att"]{display:none!important}
    main > .overlay.qatt{z-index:65}
    main:has(> .overlay.qatt){transform:none!important;animation:none!important}
    /* قاعدة قديمة (app-abs.js) تخفي «رسالة» الطالب حين توجد قائمة حلقة الحضور في الصفحة: الزر ظاهر في كل مكان (جدول الطلاب ونافذة الحضور) */
    main:has(select[data-atth]) .tbl td [data-mnote]:not([data-mnote="*"]):is(.btn,button){display:inline-flex!important}
    .qatt .tblprint [data-print],.qatt .tblprint .qsave,.qatt .tblprint .texp,.qatt .tblprint [data-heads],.qatt .tblprint > .qsp{display:none!important}
    .qatt .tblprint.qtb{justify-content:flex-start!important}
    .qatt .attbar{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:0}
    .qatt .attbar > select,.qatt .attbar > .qcombo,.qatt .attbar > .qatt-hw{flex:1 1 16rem;max-width:30rem;margin:0}
    .qatt .qatt-hw{position:relative;min-width:0}
    .qatt .qatt-hw > .qcombo,.qatt .qatt-hw > select{width:100%;max-width:none;margin:0}
    .qatt .qatt-hw:not(:focus-within) .qcombo-in{color:transparent!important}
    .qatt .qatt-disp{position:absolute;top:0;bottom:0;inset-inline-start:0;inset-inline-end:2.4rem;display:flex;align-items:center;gap:.25rem;padding-inline-start:.8rem;pointer-events:none;white-space:nowrap;overflow:hidden;font-weight:700;color:var(--navy,#13294b)}
    .qatt .qatt-hw:focus-within .qatt-disp,.qatt .qatt-hw:not(:has(.qcombo)) .qatt-disp{display:none}
    .qatt .attbar .qatt-one{flex:1 1 auto;font-weight:700;color:var(--navy,#13294b)}
    .qatt .attbar label{display:flex;align-items:center;gap:.5rem;margin:0;font-weight:700;color:var(--navy,#13294b)}
    .qatt .attbar label input{width:auto;margin:0}
    .qatt [data-mnote="*"].icon-only{width:40px;height:38px;padding:0;display:inline-flex;align-items:center;justify-content:center}
    .qatt .tblprint.qtb > .bar > .mtabs{order:1!important;flex:0 0 auto!important}
    .qatt .tblprint.qtb > .bar > input[data-mq]{order:2!important;flex:1 1 12rem!important;max-width:24rem!important;min-width:9rem;margin:0}
    .qatt .tblprint.qtb > .qzoom:not(.bar){order:3!important}
    .qatt .tblprint.qtb > .bar > [data-mnote="*"]:is(.btn,button){order:4!important}
    .qatt .tblprint.qtb > .bar > [data-attadd]:is(.btn,button){order:5!important}
    @media (max-width:600px){.qatt .tblprint.qtb > .bar > input[data-mq]{flex-basis:6rem!important;min-width:6rem!important}}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-attopen]:is(.btn,button){order:4!important;flex:0 0 auto!important}
    [data-attopen]{display:inline-flex;align-items:center;gap:.35rem}
    body:has(main > .qatt) > .overlay.qpage{background:transparent!important}
    body:has(main > .qatt):has(> .overlay.qpage) main > .qatt > .modal{visibility:hidden}
    body:has(main > .qatt) > .overlay.qpage:has(~ .overlay.qpage) > .modal{visibility:hidden}
    @media (min-width:861px){body:has(main > .qatt) > .overlay.qpage > .modal{max-width:860px!important;min-height:var(--qattH,0px)}}
    [data-attopen] svg{width:18px;height:18px}
    /* الهاتف: كل صف بطاقة (# والاسم، ثم الحضور، ثم آخر حفظ، ثم الأزرار)؛ الصفوف المخفية بالبحث أو «المزيد» تبقى مخفية */
    /* أزرار صف الطالب في «خيارات» (⋮): على الهاتف قائمة بأسماء الأزرار، وعلى الشاشة الواسعة تبقى أيقونات في الصف */
    .qatt-acts{position:relative;display:inline-flex;align-items:center}
    .qatt-kebab{display:none!important}
    .qatt-menu{display:contents}
    @media (max-width:640px){
      .qatt .tbl:not(#qz0){overflow:visible!important;max-height:none!important;border:0!important;width:auto!important;max-width:none!important;display:block!important}
      .qatt .tbl > table:not(#qz0):not(#qz1){display:block;width:100%!important;min-width:0!important;border:0}
      .qatt .tbl tbody{display:block}
      .qatt .tbl tr:has(> th){display:none}
      /* صف الطالب: الرقم والاسم، ثم الحضور بجانبه إن اتسع المكان (وإلا تحته)، ثم الكراسة و«خيارات»؛ و«آخر حفظ» سطر تحتها */
      .qatt .tbl tr:not(.pgx):not([hidden]):has(> td){display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .5rem;padding:.6rem .2rem;border-bottom:1px solid var(--line);background:transparent!important}
      .qatt-kebab{display:inline-flex!important;width:40px;height:36px;padding:0!important;align-items:center;justify-content:center;border-radius:10px}
      .qatt-menu{display:none;position:absolute;z-index:30;inset-inline-end:0;top:calc(100% + 4px);flex-direction:column;gap:.2rem;padding:.4rem;min-width:12.5rem;width:max-content;max-width:calc(100vw - 2rem);background:var(--bg,#fff);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.35)}
      .qatt-acts.open .qatt-menu{display:flex}
      .qatt-menu > .btn:not(#qz0):not(#qz1){display:flex!important;width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;justify-content:flex-start;align-items:center;gap:.6rem;padding:.55rem .7rem!important;margin:0!important;font-size:.92rem!important;text-align:start;background:transparent!important;color:var(--text)!important;border:0!important;border-radius:8px!important;box-shadow:none!important}
      .qatt-menu > .btn:not(#qz0):not(#qz1):hover{background:var(--navy-l,#eaeef5)!important}
      .qatt-menu > .btn::after{content:attr(title);flex:1;white-space:nowrap}
      .qatt-menu > .btn svg{flex:none;width:18px!important;height:18px!important}
      .qatt .tbl tr > td{display:block;position:static!important;padding:0!important;border:0!important;background:transparent!important;min-width:0;white-space:normal!important;box-shadow:none!important}
      /* الأحجام مضروبة في حجم خط الجدول (--tz) ليعمل زر التكبير والتصغير على البطاقات أيضًا */
      .qatt .tbl tr > td:first-child{order:0;flex:0 0 1.6rem;color:var(--muted);font-size:calc(.85rem * var(--tz,1));text-align:center}
      .qatt .tbl tr > td.qnm{order:1;flex:1 1 8rem;font-weight:700;font-size:calc(1.02rem * var(--tz,1))}
      .qatt .tbl tr > td.qnm .sname{font-size:inherit!important}
      .qatt .tbl tr > td.attcell{order:2;flex:0 0 auto;display:flex;gap:.35rem}
      .qatt .tbl tr > td.attcell .btn:not(#qz0){width:auto!important;min-width:0!important;padding:.25rem .7rem!important;justify-content:center}
      .qatt .tbl tr > td.noprint{order:3;flex:0 0 auto;display:flex;justify-content:flex-end}
      .qatt .tbl tr > td.noprint .qatt-acts{gap:.35rem}.qatt .tbl tr > td.noprint [data-qkbook]{width:40px;height:36px;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border-radius:10px}
      .qatt .tbl tr > td:not(:first-child):not(.qnm):not(.attcell):not(.noprint){order:4;flex:1 1 100%;padding-inline-start:2.1rem!important;font-size:calc(.85rem * var(--tz,1));color:var(--muted)}
      /* الهاتف الضيق: الاسم ومعه الكراسة و«خيارات» في السطر الأول، والحضور تحته */
      @media (max-width:440px){.qatt .tbl tr > td.noprint{order:2}.qatt .tbl tr > td.attcell{order:3;flex-basis:100%;padding-inline-start:2.1rem!important}}
      .qatt .tbl tr > td:not(:first-child):not(.qnm):not(.attcell):not(.noprint)::before{content:'آخر حفظ: '}
      /* «آخر حفظ» يبدأ من اليمين مع الاسم لا في الوسط */
      .qatt .tbl tr > td:not(:first-child):not(.qnm):not(.attcell):not(.noprint):not(#qz0){text-align:start!important}
      /* الشريط: «منتظم/منقطع» ثم حجم الخط والإشعار في سطر واحد، ومربع البحث في السطر التالي بعرضه كاملًا */
      .qatt .tblprint.qtb:not(#qz0){flex-wrap:wrap!important;align-items:center;gap:.45rem!important}
      .qatt .tblprint.qtb > .bar > .mtabs:not(#qz0){order:1!important}
      .qatt .tblprint.qtb > .qzoom:not(.bar):not(#qz0){order:2!important}
      .qatt .tblprint.qtb > .bar > [data-mnote="*"]:is(.btn,button):not(#qz0){order:3!important}
      .qatt .tblprint.qtb > .bar > [data-attadd]:is(.btn,button):not(#qz0){order:4!important}
      .qatt .tblprint.qtb > .bar > input[data-mq]:not(#qz0){order:9!important;flex:1 1 100%!important;max-width:none!important;min-width:0!important;width:100%!important}
    }`;
  document.head.appendChild(css);
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M9 15l2 2 4-4"/></svg>';
  const KEBAB = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  let open = false, top = 0;
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';
  /* المدير، ومن تظهر له صفحة «الطلاب» ومعها زر «الحضور» (stuview.js وstuperm.js) */
  const canAtt = () => isAdm() || (!!window.QLStuView?.on() && !!window.QLStuPerm?.can('att'));
  const onStu = () => { try { return ui.tab === 'students' && canAtt(); } catch (e) { return false; } };

  const NOTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 21l1.95-5.6A8.5 8.5 0 1 1 21 11.5z"/></svg>';
  /* محتوى تبويب «الحضور» القديم نفسه (attWork في nav.js)، بلا شريط تبويبات «الطلاب»، ثم يُرتَّب كما في أول الملف */
  function attHtml() {
    const keep = ui.svw, keepP = ui.fp; let h = '';
    /* تصفية المكان في «الطلاب» لا تخص النافذة: قائمتها كل الحلقات بأماكنها */
    const run = window.QLStuView?.scoped || (f => f());
    try { ui.svw = 'att'; ui.fp = ''; h = run(() => adminViews.students()); } finally { ui.svw = keep; ui.fp = keepP; }
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
      const hs = ((window.QLStuView?.on() && window.QLStuView.scopeH()) || db.halaqat || []).slice().sort((a, b) => (pl(a)).localeCompare(pl(b), 'ar') || halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
      /* halaqaLabel يذكر المكان أحيانًا (معلم له حلقات في أكثر من مكان): لا يتكرر */
      const lab = h0 => { const l = halaqaLabel(h0), p = pl(h0); return p && !l.includes(p) ? `${l} — ${p}` : l; };
      if (hs.length === 1) {
        const one = document.createElement('span'); one.className = 'qatt-one'; one.textContent = lab(hs[0]);
        (sel.closest('.qcombo') || sel).replaceWith(one);
      } else {
        sel.setAttribute('aria-label', 'الحلقة والمكان');
        sel.innerHTML = hs.map(h0 => `<option value="${esc(h0.id)}"${h0.id === cur ? ' selected' : ''}>${esc(lab(h0))}</option>`).join('');
        /* المختارة تُعرض «حلقة فلان» ومكانها في كبسولة (nav.js يحوّل «… — المكان» إلى كبسولة)، وعند الكتابة للبحث يظهر النص العادي */
        const hw = document.createElement('div'); hw.className = 'qatt-hw'; sel.replaceWith(hw); hw.appendChild(sel);
        const ch = hs.find(h0 => h0.id === cur);
        if (ch) { const d = document.createElement('span'); d.className = 'qatt-disp'; d.setAttribute('aria-hidden', 'true'); d.textContent = lab(ch); hw.appendChild(d); }
      }
      const date = C.querySelector('input[data-change="date"]'), dl = date?.closest('label');
      if (dl) { [...dl.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); dl.prepend(date.value === today() ? 'اليوم' : 'التاريخ'); }
    }
    /* البطاقة الثانية: بلا سطر المكان والوقت ولا العدد ولا عنوان الحلقة؛ التبويبان والبحث والأزرار في صف واحد
       (شريط الأزرار يدمجه toolbar.js مع حجم الخط، والترتيب من CSS أعلاه) */
    const q = C.querySelector('input[data-mq]'), tabs = C.querySelector('.mtabs'), all = C.querySelector('[data-mnote="*"]');
    q?.closest('.card')?.querySelector(':scope > p.muted:not([data-mcount])')?.remove();
    C.querySelector('p[data-mcount]')?.remove();
    if (all) {
      const b = all.closest('.bar');
      b?.querySelectorAll(':scope > h2, :scope > .muted').forEach(x => x.remove());
      all.className = 'btn icon-only'; all.title = 'إشعار للطلاب'; all.setAttribute('aria-label', 'إشعار للطلاب'); all.innerHTML = NOTE;
      if (b && q && tabs) { const old = tabs.closest('.bar'); b.prepend(tabs, q); if (old && old !== b && !old.children.length) old.remove(); }
      const ADD = (typeof ADD_ICONS !== 'undefined' && ADD_ICONS.quick) || '+';
      if (session?.role === 'admin' || window.Perms?.can?.('students.add')) all.insertAdjacentHTML('afterend', `<button type="button" class="btn icon-only" data-qadd data-attadd title="إضافة طالب" aria-label="إضافة طالب">${ADD}</button>`);
    }
    /* أزرار كل صف داخل «خيارات» (⋮): تبقى الأزرار نفسها بمعالجاتها، وتُعرض قائمةً على الهاتف (CSS أعلاه) */
    C.querySelectorAll('tr > td.noprint').forEach(td => {
      if (td.querySelector('.qatt-acts') || !td.querySelector('button')) return;
      const box = document.createElement('div'); box.className = 'qatt-acts';
      box.innerHTML = `<button type="button" class="btn qatt-kebab" data-qattmore aria-label="خيارات" title="خيارات" aria-haspopup="menu" aria-expanded="false">${KEBAB}</button><div class="qatt-menu" role="menu"></div>`;
      const menu = box.querySelector('.qatt-menu'); [...td.childNodes].forEach(n => menu.appendChild(n));
      td.appendChild(box);
    });
    return t.innerHTML;
  }
  /* فتح «خيارات» وإغلاقها: قائمة واحدة مفتوحة، وتُغلق بالاختيار منها أو بالضغط خارجها */
  const closeMenus = except => document.querySelectorAll('.qatt-acts.open').forEach(b => { if (b !== except) { b.classList.remove('open'); b.querySelector('[data-qattmore]')?.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-qattmore]');
    if (k) { const box = k.closest('.qatt-acts'), on = !box.classList.contains('open'); closeMenus(box); box.classList.toggle('open', on); k.setAttribute('aria-expanded', on); return; }
    const inMenu = e.target.closest('.qatt-menu > *');
    if (inMenu || !e.target.closest('.qatt-acts')) closeMenus();
  });
  function place() {
    const main = document.querySelector('main'); if (!main) return;
    main.querySelector(':scope > .qatt')?.remove();
    if (!open || !onStu()) return;
    main.insertAdjacentHTML('beforeend', `<div class="overlay qpage qatt"><div class="modal qaddw"><div class="mhead"><button type="button" class="qpback" data-attclose aria-label="رجوع" title="رجوع">${BACK}</button><h2>الدفتر</h2></div>${attHtml()}</div></div>`);
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
      if (typeof h !== 'string' || ui.svw === 'att' || !canAtt()) return h;
      return h.replace(/(<div class="qseg" data-sstfseg|<select data-sstf)/, `<button type="button" class="btn" data-attopen>${ICON}الدفتر</button>$1`);
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

  /* نافذة واحدة: ما يُفتح فوق نافذة الحضور يأخذ ارتفاع صندوقها (العرض والمكان من CSS أعلاه) */
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1 || !n.classList?.contains('overlay')) return;
    const qm = document.querySelector('main > .qatt > .modal'); if (!qm) return;
    const h = Math.min(qm.offsetHeight, window.innerHeight - 48);
    if (h) n.style.setProperty('--qattH', h + 'px');
  }))).observe(document.body, { childList: true });

  /* «إضافة طالب» من النافذة: نافذة الإضافة نفسها (quickAdd في app-forms.js) والحلقة المعروضة مختارة فيها مسبقًا */
  document.addEventListener('click', e => {
    if (!e.target.closest('.qatt [data-attadd]')) return;
    const ov = [...document.querySelectorAll('body > .overlay')].pop(), h = byId(db.halaqat, ui.hid); if (!ov || !h) return;
    const set = (n, v) => { const el = ov.querySelector(`[name=${n}]`); if (el && v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('qPlace1', h.placeId); set('qHal1', h.id); set('qPlace2', h.placeId); set('qHal2', h.id);
  });

  /* ===== «متأخر» يلغى تفعيله (A.att في app-actions.js؛ زرّاه من nav.js) ===== */
  const VALID = ['present', 'late', 'excused', 'absent'];
  const fixBad = () => { let n = 0; (db.attendance || []).forEach(a => { if (!VALID.includes(a.status)) { a.status = 'absent'; n++; } }); return n; };
  document.addEventListener('DOMContentLoaded', () => {
    try { if (fixBad()) save(); } catch (e) { /* ignore */ }
    if (typeof A === 'undefined' || typeof A.att !== 'function') return;
    const base = A.att;
    A.att = d => {
      fixBad();
      const ex = db.attendance.find(a => a.studentId === d.sid && a.date === ui.date);
      let st = d.st;
      if (!VALID.includes(st)) st = ex && VALID.includes(ex._pre) && ex._pre !== 'late' ? ex._pre : 'present';
      const prev = ex ? ex.status : 'absent';
      const r = base({ ...d, st });
      /* الحالة قبل «متأخر» تُذكر محليًا (لا تُرسل للخادم) ليعود إليها الإلغاء */
      if (st === 'late' && prev !== 'late') { const rec = db.attendance.find(a => a.studentId === d.sid && a.date === ui.date); if (rec) rec._pre = prev; }
      return r;
    };
  });
})();
