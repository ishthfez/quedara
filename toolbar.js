'use strict';
/* ============ صف أدوات واحد فوق كل جدول، بأيقونات ============
   في كل بطاقة فيها شريط أدوات (تصفية، بحث، أزرار) وجدول واحد:
     - ينتقل شريط البطاقة إلى صف أدوات الجدول نفسه (التكبير وExcel وPDF والطباعة)، فيصيران صفًا واحدًا.
       (شريط البطاقة هو الذي ينتقل لا العكس: أزرار الجدول تجد جدولها بأنه العنصر الذي يلي صفها مباشرة)
     - الأزرار المعروفة تصير أيقونات، واسمها يظهر عند الوقوف عليها (وعند الضغط المطوّل على الجوال)، والعدد في رقم صغير.
     - Excel وPDF أيقونتان ملوّنتان (جدول أخضر، ومستند أحمر مكتوب عليه PDF) بدل الكلمة.
     - ملاحظة الإرشاد تحت الشريط تُخفى، ما عدا التنبيهات المهمة (شريط «إصلاح» وما فيه أزرار).
     - زر «إضافة» آخر الصف (على اليسار)، والأزرار متجاورة بعد التصفية والبحث.
     - اسم الطالب المنقطع والعامل المتوقف بالأحمر في كل الجداول (يُعرف من علامة «منقطع/متوقف» في صفه أو خانة حالته).
     - المحاذاة في كل الأقسام: العنوان والقوائم المنسدلة والبحث على اليمين في سطر واحد، والأزرار وحدها على اليسار
       (في الصف المدموج وفي كل شريط آخر، عدا شرائط التبويبات).
     - التكبير والتصغير زر واحد يفتح شريطًا رأسيًا يُسحب بالإصبع أو الفأرة (يسري على كل الجداول كما كان).
     - زر «تعديل رؤوس الأعمدة» (القلم) مخفي إلا إن شُغّل من «الإعدادات».
     - «استيراد» و«الأسماء المتشابهة» في «الإعدادات» وحدها.
     - «استمارة طالب» صارت التبويب الأخير في نافذة «إضافة طالب» (بعد «طالب واحد» و«عدة طلاب»)، فلا زر مستقل لها.
     - اسم الطالب في أي جدول يفتح ملفه (بدل زر «الملف»).
     - أزرار صف الطالب (السجل، تعديل، نقل) أيقونات صغيرة، واسمها يظهر عند الوقوف عليها.
   عرض فقط: لا يغيّر أي وظيفة ولا بيانات. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./toolbar.js')) VFILES.push('./toolbar.js'); } catch (e) { /* ignore */ } });
  const S = p => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const PERSON_ADD = S('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M19 8v6M16 11h6"/>');
  const ICONS = {
    addTeacher: PERSON_ADD, addMember: PERSON_ADD, addStudent: PERSON_ADD,
    importMembers: S('<path d="M14 3H7a1 1 0 0 0-1 1v4M6 16v4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M2 12h10M9 9l3 3-3 3"/>'),
    dupOpen: S('<circle cx="6" cy="8" r="2.5"/><path d="M2 18.5v-.5a4 4 0 0 1 8 0v.5"/><circle cx="18" cy="8" r="2.5"/><path d="M14 18.5v-.5a4 4 0 0 1 8 0v.5"/><path d="M10.5 10.5h3M10.5 13h3"/>'),
    credsOpen: S('<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.5-5A8.5 8.5 0 1 1 21 11.5z"/><circle cx="9" cy="11.5" r="2.2"/><path d="M11.2 11.5H17M15 11.5v2.2"/>'),
    clsAuto: S('<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/>'),
    cloudPwAll: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    wmk: S('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    delSel: S('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    /* الاشتراكات */
    feeCfg: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    feeBulk: S('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
    feeImport: S('<path d="M14 3H7a1 1 0 0 0-1 1v4M6 16v4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M2 12h10M9 9l3 3-3 3"/>'),
    sdel: S('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    remindAll: S('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')
  };
  /* أيقونات أزرار الصفوف: [الأيقونة، الاسم الظاهر عند الوقوف] */
  const ROW_ICONS = {
    hist: [S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'), 'السجل (الحضور والتسميع)'],
    editStudent: [S('<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>'), 'تعديل البيانات'],
    move: [S('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'), 'نقل إلى حلقة أخرى']
  };
  /* مفتاح الأيقونة: data-act، أو إحدى السمات المعروفة */
  const keyOf = b => b.dataset.act || ['wmk', 'feeCfg', 'feeBulk', 'feeImport', 'remindAll', 'sdel'].find(k => k in b.dataset) || '';
  /* أيقونتا التصدير: جدول أخضر، ومستند أحمر عليه PDF (أشكال عامة لا شعارات الشركات) */
  const XLS = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#1d6f42"/><path d="M3 9h18M3 15h18M9.5 9v12M15 9v12" stroke="#fff" stroke-width="1.4" opacity=".9"/><rect x="3" y="3" width="18" height="6" rx="3.5" fill="#185c37"/></svg>';
  const PDF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 2.5h8.5L19 7v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z" fill="#b3372f"/><path d="M14.5 2.5V7H19" fill="#e07d74"/><text x="12" y="17.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.2" font-weight="700" fill="#fff">PDF</text></svg>';

  const css = document.createElement('style');
  css.textContent = `.tblprint.qtb{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-bottom:.6rem}
    .tblprint.qtb > .bar{display:contents}
    .tblprint.qtb > .bar > .grow{flex:0 1 auto}
    .tblprint.qtb > .bar > h2{margin:0!important;font-size:1.05rem}
    .tblprint.qtb .qsp{flex:1 1 0;min-width:.2rem;order:1}
    .tblprint.qtb > *{order:3}
    .tblprint.qtb > .bar > *{order:0}
    .tblprint.qtb > .bar > .btn,.tblprint.qtb > .bar > button{order:2}
    .tblprint.qtb .qadd{order:9!important}
    .tblprint .tzoom{display:none!important}
    html:not(.qheads-on) [data-heads]{display:none!important}
    main .bar [data-act="importMembers"],main .bar [data-act="dupOpen"],main .tblprint [data-act="importMembers"],main .tblprint [data-act="dupOpen"]{display:none!important}
    .qzoom{position:relative;display:inline-flex}
    .qzoom > .btn{width:auto;min-width:38px;height:36px;padding:0 .45rem;gap:.2rem;font:700 .8rem Arial,sans-serif}
    .qzpop{position:fixed;z-index:90;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;box-shadow:0 10px 28px rgba(15,25,50,.22);padding:.6rem .7rem;display:flex;flex-direction:column;align-items:center;gap:.4rem;user-select:none;-webkit-user-select:none}
    .qzpop small{font:700 .78rem Arial,sans-serif;color:var(--muted,#777)}
    .qzpop b{font:700 .85rem Arial,sans-serif;color:var(--navy,#13294b)}
    .qztrack{position:relative;display:block;width:40px;height:180px;touch-action:none;cursor:ns-resize;outline:none}
    .qztrack::before{content:'';position:absolute;inset:0 auto 0 50%;width:6px;margin-left:-3px;border-radius:3px;background:var(--line,#e5e7eb)}
    .qzfill{position:absolute;bottom:0;left:50%;width:6px;margin-left:-3px;border-radius:3px;background:var(--navy,#13294b)}
    .qzthumb{position:absolute;left:50%;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#fff;border:3px solid var(--navy,#13294b);box-shadow:0 1px 4px rgba(0,0,0,.25)}
    .qztrack:focus-visible .qzthumb{outline:3px solid var(--gold,#b08a3e);outline-offset:2px}
    .tblprint.qtb .tzoom{margin-inline-end:0}
    .tblprint.qtb .btn.texp{width:38px;height:36px;padding:0;justify-content:center}
    .tblprint.qtb .btn.texp svg{width:22px;height:22px}
    .tblprint.qtb .msearch{flex:1 1 13rem;max-width:22rem;margin:0}
    .tblprint.qtb > .bar > select,.qbar > select{flex:0 1 auto;width:auto;max-width:16rem;margin:0}
    .tblprint.qtb > .bar > .qcombo,.qbar > .qcombo{flex:0 1 13rem;width:auto;min-width:9rem;max-width:16rem;margin:0}
    .tblprint.qtb > .bar > .qcombo .qcombo-in,.qbar > .qcombo .qcombo-in{width:100%;min-width:0;text-overflow:ellipsis}
    .tblprint.qtb > .bar > label,.qbar > label:not(.btn){margin:0}
    .qbar{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
    .qbar > *{order:0}
    .qbar > .grow{flex:0 1 auto}
    .qbar > .qsp{order:1;flex:1 1 0;min-width:.2rem}
    .qbar > .btn,.qbar > button,.qbar > label.btn,.qbar > details:has(> summary.btn){order:2}
    .tblprint.qtb > .bar > details:has(> summary.btn){order:2}
    .tblprint.qtb input[type=search]{flex:1 1 13rem;max-width:22rem;min-width:9rem}
    .btn.icon-only.primary svg{stroke:currentColor}
    .qnote-hidden{display:none!important}
    main .tbl td .btn.qri{width:32px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}
    main .tbl td .btn.qri svg{width:17px;height:17px}
    .lnk.sname{text-decoration:none;text-align:start;font:inherit;color:inherit}.lnk.sname:hover{text-decoration:underline;text-decoration-color:var(--gold,#b08a3e)}
    main [data-act="addStudent"]:has(~ [data-qadd]),main [data-qadd] ~ [data-act="addStudent"]{display:none!important}
    main .tbl td.qoffn,main .tbl td.qoffn b,main .tbl td.qoffn .lnk,main .tbl td.qoffn span:not(.tag):not(.av){color:var(--red,#b3372f)!important}
    @media (max-width:600px){.tblprint.qtb .qsp{flex-basis:100%;height:0}}`;
  document.head.appendChild(css);

  const label = b => b.textContent.trim().replace(/\s+/g, ' ').replace(/^\+\s*/, 'إضافة ');
  function iconize(scope) {
    scope.querySelectorAll('.btn:not(.icon-only):not(.texp)').forEach(b => {
      const ic = ICONS[keyOf(b)]; if (!ic) return;
      const t = label(b), n = (t.match(/\((\d+)\)/) || [])[1];
      b.title = t; b.setAttribute('aria-label', t); b.classList.add('icon-only');
      b.innerHTML = ic + (n ? `<span class="cnt">${n}</span>` : '');
    });
    scope.querySelectorAll('.btn.texp:not([data-qi])').forEach(b => { b.dataset.qi = '1'; b.innerHTML = 'xls' in b.dataset ? XLS : PDF; });
  }
  /* ===== الحجم: زر واحد يفتح شريطًا رأسيًا يُسحب بالإصبع أو الفأرة (1% لكل حركة) =====
     يضبط متغير الحجم نفسه الذي تقرؤه كل الجداول (--tz) ويحفظه في المكان نفسه (qtable_zoom)، فيبقى بعد إعادة الفتح.
     لا يُغلق إلا بالضغط خارجه. أزرار أ−/أ+ القديمة مخفية في كل الجداول. */
  const ZMIN = 70, ZMAX = 180, ZK = 'qtable_zoom';
  const curZ = () => Math.round((+getComputedStyle(document.documentElement).getPropertyValue('--tz') || 1) * 100);
  const AA = S('<path d="M3 19l5-13 5 13M4.8 14.5h6.4"/><path d="M14 19l3.3-8.5L20.6 19M15.1 16.2h4.4"/>');
  const zoomBtn = () => `<span class="qzoom noprint"><button type="button" class="btn" data-qz title="حجم خط الجدول" aria-label="حجم خط الجدول" aria-expanded="false">${AA}<span data-qzv>${curZ()}%</span></button></span>`;
  let pop = null, dragging = false;
  function paint(v) {
    if (!pop) return;
    const f = (v - ZMIN) / (ZMAX - ZMIN);
    pop.querySelector('.qzfill').style.height = (f * 100) + '%';
    pop.querySelector('.qzthumb').style.bottom = `calc(${f * 100}% - 11px)`;
    const tr = pop.querySelector('[data-qztrack]'); tr.setAttribute('aria-valuenow', v); tr.setAttribute('aria-valuetext', v + '%');
    pop.querySelector('[data-qzn]').textContent = v + '%';
  }
  function setZ(v, settle) {
    v = Math.max(ZMIN, Math.min(ZMAX, Math.round(v)));
    document.documentElement.style.setProperty('--tz', v / 100);
    try { localStorage.setItem(ZK, String(v / 100)); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-qzv],[data-tzv]').forEach(x => { x.textContent = v + '%'; });
    paint(v);
    if (settle) window.dispatchEvent(new Event('resize'));   // إعادة حساب الأعمدة الثابتة مرة واحدة عند الإفلات
  }
  function openPop(btn) {
    closePop();
    pop = document.createElement('div'); pop.className = 'qzpop noprint';
    pop.innerHTML = `<small>كبير</small><span class="qztrack" data-qztrack role="slider" tabindex="0" aria-orientation="vertical" aria-label="حجم خط الجدول" aria-valuemin="${ZMIN}" aria-valuemax="${ZMAX}"><span class="qzfill"></span><span class="qzthumb"></span></span><small>صغير</small><b data-qzn></b><button type="button" class="btn sm" data-qz0>100%</button>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.top = top + 'px'; pop.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
    btn.setAttribute('aria-expanded', 'true'); pop._btn = btn;
    paint(curZ()); pop.querySelector('[data-qztrack]').focus({ preventScroll: true });
  }
  function closePop() { if (!pop) return; pop._btn?.setAttribute('aria-expanded', 'false'); pop.remove(); pop = null; dragging = false; }
  const fromY = (track, y) => { const r = track.getBoundingClientRect(); return ZMIN + (1 - Math.max(0, Math.min(1, (y - r.top) / r.height))) * (ZMAX - ZMIN); };
  document.addEventListener('pointerdown', e => {
    const tr = e.target.closest('[data-qztrack]');
    if (tr) { e.preventDefault(); dragging = true; try { tr.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } setZ(fromY(tr, e.clientY)); return; }
    if (pop && !e.target.closest('.qzpop') && !e.target.closest('[data-qz]')) closePop();
  });
  document.addEventListener('pointermove', e => { if (!dragging || !pop) return; const tr = pop.querySelector('[data-qztrack]'); e.preventDefault(); setZ(fromY(tr, e.clientY)); }, { passive: false });
  document.addEventListener('pointerup', () => { if (dragging) { dragging = false; setZ(curZ(), true); } });
  document.addEventListener('pointercancel', () => { if (dragging) { dragging = false; setZ(curZ(), true); } });
  document.addEventListener('keydown', e => {
    if (!e.target.closest?.('[data-qztrack]')) { if (e.key === 'Escape' && pop) closePop(); return; }
    const d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 10, PageDown: -10 }[e.key];
    if (d) { e.preventDefault(); setZ(curZ() + d, true); } else if (e.key === 'Home') setZ(ZMIN, true); else if (e.key === 'End') setZ(ZMAX, true); else if (e.key === 'Escape') closePop();
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-qz0]')) { setZ(100, true); return; }
    const b = e.target.closest('[data-qz]'); if (!b) return;
    if (pop && pop._btn === b) closePop(); else openPop(b);
  });
  window.addEventListener('resize', () => { if (pop && !dragging && pop._btn && !pop._btn.isConnected) closePop(); });
  /* ===== زر «تعديل رؤوس الأعمدة» (القلم): يظهر فقط حين يُشغَّل من «الإعدادات» ===== */
  const HK = 'qheads_on';
  const headsOn = () => { try { return localStorage.getItem(HK) === '1'; } catch (e) { return false; } };
  document.documentElement.classList.toggle('qheads-on', headsOn());
  window.QLHeads = { on: headsOn, set: v => { try { localStorage.setItem(HK, v ? '1' : '0'); } catch (e) { /* ignore */ } document.documentElement.classList.toggle('qheads-on', !!v); } };
  function merge() {
    raf = 0;
    if (!session) return;
    document.querySelectorAll('main .tblprint:not(.qtb)').forEach(tp => {
      const card = tp.parentElement; if (!card || card.matches('main, body')) return;
      if (card.querySelectorAll(':scope > .tblprint').length !== 1) return;   // حاوية فيها أكثر من جدول: تبقى كما هي
      const bar = card.querySelector(':scope > .bar');
      if (!bar || !(bar.compareDocumentPosition(tp) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      /* ملاحظة الإرشاد بين الشريط والجدول: تُطوى خلف ⓘ (لا التنبيهات التي فيها أزرار أو شريط «إصلاح») */
      const notes = [...card.querySelectorAll(':scope > .note')].filter(n => !n.matches('[data-fixpay]') && !n.querySelector('button,input,select,a')
        && (bar.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && (n.compareDocumentPosition(tp) & Node.DOCUMENT_POSITION_FOLLOWING));
      tp.classList.add('qtb');
      tp.prepend(bar);
      bar.insertAdjacentHTML('afterend', '<span class="qsp"></span>');
      notes.forEach(n => n.classList.add('qnote-hidden'));   // الإرشاد لا حاجة له في الصف
      iconize(tp);
    });
    /* المحاذاة في كل شريط آخر (غير المدموج): العناوين والقوائم يمينًا والأزرار يسارًا. شرائط التبويبات تبقى كما هي */
    document.querySelectorAll('main .bar:not(.qbar)').forEach(bar => {
      if (bar.closest('.subnav, .tblprint, .plseg, .mtabs') || bar.classList.contains('plseg')) return;
      const kids = [...bar.children], btns = kids.filter(k => k.matches('.btn, button, details:has(> summary.btn)'));
      if (!btns.length || btns.length === kids.length && !bar.querySelector('select,input,h2,h3')) return;   // أزرار فقط: تبقى كما هي
      bar.classList.add('qbar'); bar.insertAdjacentHTML('beforeend', '<span class="qsp"></span>');
    });
    /* اسم المنقطع والمتوقف بالأحمر: الصف فيه علامة «منقطع» أو «متوقف»، أو خانة حالة على «متوقف»، أو هو تبويب «المنقطعون» */
    document.querySelectorAll('main .tbl table').forEach(tbl => {
      const head = [...tbl.rows].find(r => r.querySelector('th')); if (!head || [...head.cells].some(c => c.colSpan > 1)) return;
      const ni = [...head.cells].findIndex(c => ['الاسم', 'الطالب', 'العامل', 'الموظف'].includes(c.textContent.trim()));
      if (ni < 0) return;
      const offTab = !!tbl.closest('.card')?.querySelector('[data-mtab="off"].on');
      [...tbl.rows].forEach(r => {
        if (r === head || !r.cells[ni]) return;
        const off = offTab || !!r.querySelector('select.qoff') || [...r.querySelectorAll('.tag')].some(t => /^(منقطع|متوقف)$/.test(t.textContent.trim()));
        r.cells[ni].classList.toggle('qoffn', off);
      });
    });
    /* اسم الطالب يفتح ملفه، ويُحذف زر «الملف» من صفه */
    document.querySelectorAll('main .tbl table').forEach(tbl => {
      const head = [...tbl.rows].find(r => r.querySelector('th')); if (!head) return;
      const ni = [...head.cells].findIndex(c => ['الاسم', 'الطالب'].includes(c.textContent.trim())); if (ni < 0) return;
      [...tbl.rows].forEach(r => {
        if (r === head || r.dataset.snm) return;
        const fb = [...r.querySelectorAll('[data-act="studentCard"]')].find(b => b.textContent.trim() === 'الملف'), td = r.cells[ni];
        if (!fb || !td) return;
        const host = td.querySelector('.who > span:not(.av)') || td;
        const tn = [...host.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
        if (!tn) return;
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lnk sname'; btn.dataset.act = 'studentCard'; btn.dataset.id = fb.dataset.id; btn.title = 'فتح الملف';
        btn.textContent = tn.textContent.trim(); tn.replaceWith(btn);
        fb.remove(); r.dataset.snm = '1';
      });
    });
    /* أزرار الصفوف المعروفة أيقونات */
    document.querySelectorAll('main .tbl td .btn:is([data-act],[data-move]):not(.qri)').forEach(b => {
      const ic = ROW_ICONS[b.dataset.act || ('move' in b.dataset ? 'move' : '')]; if (!ic) return;
      b.classList.add('qri'); b.title = ic[1]; b.setAttribute('aria-label', ic[1]); b.innerHTML = ic[0];
    });
    /* زر الحجم الواحد في كل صف أدوات (مدموجًا أو لا) بدل أ−/أ+ */
    document.querySelectorAll('main .tblprint').forEach(tp => { const tz = tp.querySelector('.tzoom'); if (tz && !tp.querySelector('.qzoom')) tz.insertAdjacentHTML('afterend', zoomBtn()); });
    /* أيقونتا Excel وPDF في كل مكان (حتى في البطاقات التي لم تُدمج) */
    document.querySelectorAll('main .bar, main .tblprint').forEach(iconize);
    /* أزرار الإضافة آخر الصف (ومنها «إضافة طالب» السريعة التي تُضاف بعد الرسم) */
    document.querySelectorAll('main .tblprint.qtb :is([data-act="addTeacher"],[data-act="addMember"],[data-act="addStudent"],[data-qadd]):not(.qadd)').forEach(b => b.classList.add('qadd'));
  }
  let raf = 0;
  new MutationObserver(ms => { if (!raf && ms.some(m => m.addedNodes.length)) raf = requestAnimationFrame(merge); }).observe(document.body, { childList: true, subtree: true });
  /* ===== «استمارة طالب» تبويبًا أخيرًا في نافذة «إضافة طالب» =====
     يظهر لمن كان يرى زر الاستمارة في الصفحة؛ والضغط عليه يفتح الاستمارة الكاملة نفسها مكان النافذة. */
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(ov => {
    if (ov.nodeType !== 1 || !ov.classList?.contains('overlay')) return;
    const bar = ov.querySelector('[data-qm="many"]')?.parentElement;
    if (!bar || bar.querySelector('[data-qm="form"]') || !document.querySelector('main [data-act="addStudent"]')) return;
    bar.insertAdjacentHTML('beforeend', '<button type="button" class="btn" data-qm="form">استمارة طالب</button>');
  }))).observe(document.body, { childList: true });
  document.addEventListener('click', e => {
    if (!e.target.closest('.overlay [data-qm="form"]')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    e.target.closest('.overlay').remove();
    if (typeof A !== 'undefined' && A.addStudent) A.addStudent();
  }, true);
})();
