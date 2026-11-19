'use strict';
/* ============ الوضع الداكن ============
   يتبع إعداد الجهاز تلقائيًا، ولكل مستخدم أن يغيّره على جهازه (زر في أسفل القائمة الجانبية)، ويُحفظ اختياره في المتصفح (qdark).
   يبقى اللون الأساسي ولون التمييز من «المظهر» كما اختارهما المدير، وتُستبدل الألوان المحايدة
   (الخلفية والكروت والنص والإطارات) بدرجات داكنة. الطباعة تبقى فاتحة دائمًا. */
(() => {
  /* يتبع إعداد الجهاز (فاتح/داكن) ما لم يختر المستخدم بنفسه من الزر؛ واختيار ما يطابق الجهاز يعيده إلى المتابعة التلقائية */
  const KEY = 'qdark';
  const MQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const sysDark = () => !!MQ?.matches;
  const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const isDark = () => { const v = stored(); return v === '1' ? true : v === '0' ? false : sysDark(); };
  const root = document.documentElement;
  /* متغيرات لا يضعها applyTheme: تُزال عند العودة للفاتح */
  const EXTRA = ['card', 'glass', 'glass-strong', 'glass-line', 'glass-shadow', 'grid', 'qnt'];

  const baseApply = applyTheme;
  applyTheme = function () {
    const r = baseApply.apply(this, arguments);
    const st = root.style;
    if (!isDark()) { EXTRA.forEach(k => st.removeProperty('--' + k)); return r; }
    const T = theme(), set = (k, v) => st.setProperty('--' + k, v, 'important');
    const BG = '#0e141d';
    set('bg', BG); set('card', '#172030'); set('text', '#e4e8ee'); set('muted', '#9aa4b3'); set('line', '#2b3546');
    /* الأساسي أفتح قليلًا ليُرى على الخلفية الداكنة، والكتابة عليه بيضاء */
    const nv = lum(T.navy) > .3 ? T.navy : mix(T.navy, '#ffffff', .2);
    set('navy', nv); set('navy-d', mix(T.navy, '#000000', .45)); set('navy-l', mix(T.navy, '#141c28', .55));
    set('on-navy', lum(nv) > .45 ? '#14181f' : '#ffffff'); set('tab-text', '#c3ccda');
    set('qnt', mix(T.navy, '#ffffff', .62));   // «الأساسي» حين يكون لون نص
    set('gold-l', mix(T.gold, BG, .74)); set('gold-d', mix(T.gold, '#ffffff', .35));
    set('stripe', mix(T.leaf, BG, .86));
    /* ألوان الحالات أفتح قليلًا لتُقرأ كنص على الخلفية الداكنة */
    set('red', mix(T.red, '#ffffff', .28)); set('leaf', mix(T.leaf, '#ffffff', .25)); set('amber', mix(T.amber, '#ffffff', .2));
    set('glass', 'rgba(23,32,48,.78)'); set('glass-strong', 'rgba(25,34,50,.96)'); set('glass-line', 'rgba(255,255,255,.08)');
    set('glass-shadow', '0 8px 32px rgba(0,0,0,.35)'); set('grid', 'rgba(255,255,255,.1)');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', mix(T.navy, '#000000', .45));
    return r;
  };

  const css = document.createElement('style');
  const D = 'html.qdark';
  css.textContent = `@media screen{
  ${D}{color-scheme:dark}
  ${D} body{background:var(--bg)}
  ${D} #splash{background:var(--bg)}
  ${D} .side{background:linear-gradient(180deg,var(--navy-d),color-mix(in srgb,var(--navy-d) 75%,#000))}
  ${D} .btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:var(--text)}
  ${D} .btn:not(.on):not(.primary):hover{background:rgba(255,255,255,.12)}
  ${D} main .btn:not(.primary):not(.on):not(.danger),${D} .modal .btn:not(.primary):not(.on):not(.danger),${D} .mode:not(.on){border-color:rgba(255,255,255,.18)}
  ${D} .btn.danger{color:#f08a80}
  ${D} select,${D} input,${D} textarea,${D} option{background:#111924;border-color:rgba(255,255,255,.14);color:var(--text)}
  ${D} input.picked{background:var(--gold-l)}
  ${D} .card:has(.tbl){background:#141c29}
  ${D} .content .top{background:rgba(14,20,29,.82)}
  ${D} .content .iconbtn{background:rgba(255,255,255,.06);color:var(--qnt)}
  ${D} .content .iconbtn:hover{background:rgba(255,255,255,.12)}
  ${D} .modal,${D} .results,${D} .opt,${D} .tile,${D} .mode,${D} .chip,${D} .logo-prev,${D} label.sw,${D} .ipop{background:var(--glass-strong)}
  ${D} .tile,${D} .mode{color:var(--text)}
  ${D} .note{background:color-mix(in srgb,var(--gold) 9%,#151d2a)}
  ${D} .news{background:color-mix(in srgb,var(--gold) 7%,#151d2a)}
  ${D} th{background:var(--navy-l);color:var(--text)}
  ${D} th,${D} td,${D} table{border-color:var(--grid)}
  ${D} tr:first-child th,${D} tr.sum td{border-color:rgba(255,255,255,.28)}
  ${D} tr.sum td{color:var(--text)}
  ${D} table.frz .stk-h{background:var(--navy-l)}
  ${D} table.frz .stk-c{background:#141c29}
  ${D} table.frz tr:nth-child(odd):not(:first-child):not(.sum) td.stk-c{background:var(--stripe)}
  ${D} .scard th{background:transparent;color:var(--muted)}
  ${D} .ttl{color:var(--text)}
  ${D} .stat b,${D} .info b,${D} td.net,${D} .lnk,${D} .ph .ph0,${D} .tag.tag-a,${D} .eye:hover,${D} .tprev,${D} code.pw{color:var(--qnt)}
  ${D} .feerow.fr-plain,${D} .feerow.fr-info,${D} .aplace h3,${D} .qseg button:not(.on),${D} .ztools::before,${D} .qactchip b,${D} .qactday,${D} .qatt .attbar .qatt-one,${D} .qatt .attbar label,${D} .qatt .qatt-disp,${D} .login .appname,${D} .modal .mclose,${D} .hpill,${D} .qpage .qpback,${D} .qzpop b,${D} .chip-t input:checked+span{color:var(--qnt)}
  ${D} .feerow.fr-plain{background:color-mix(in srgb,var(--navy) 28%,#141c28)}
  ${D} .feerow.fr-info{background:color-mix(in srgb,var(--navy) 22%,#141c28)}
  ${D} .feerow.fr-ok{background:color-mix(in srgb,var(--leaf) 20%,#141c28)}
  ${D} .feerow.fr-no{background:color-mix(in srgb,var(--red) 20%,#141c28)}
  ${D} .tfs legend,${D} .sc-h{color:#fff}
  ${D} .tfs,${D} .dupg,${D} .prrows{background:rgba(255,255,255,.03)}
  ${D} .seg,${D} .chip-r span,${D} .prchip,${D} .ipx{background:rgba(255,255,255,.06);color:var(--text)}
  ${D} .dupi:hover{background:rgba(255,255,255,.07)}
  ${D} .ph img,${D} .ph .ph0{background:var(--navy-l)}
  ${D} .av{border-color:#2b3546}
  ${D} .tag{background:var(--gold-l);color:var(--gold-d)}
  ${D} .tag.tag-ok{background:color-mix(in srgb,var(--leaf) 26%,#0e141d);color:#8fd18a}
  ${D} .tag.tag-no{background:color-mix(in srgb,var(--red) 26%,#0e141d);color:#f3a097}
  ${D} .ahal{background:var(--card)}
  ${D} #actasbar .btn,${D} #demobar .btn,${D} #actasbar select{background:#fff}
  ${D} #qclist{background:var(--glass-strong);color:var(--text)}
  ${D} #qlock .box{background:var(--card)}
  ${D} #qlock .warn,${D} .note[style*="#fdf1f0"]{background:color-mix(in srgb,var(--red) 18%,#0e141d)!important;border-color:color-mix(in srgb,var(--red) 40%,#0e141d)!important;color:#f3a097!important}
  ${D} [style*="background:#fdecea"],${D} .qcol tr.qissue td,${D} .qcacc tr.qno td{background:color-mix(in srgb,var(--red) 20%,#0e141d)!important;color:var(--text)!important}
  ${D} .tag[style*="#fbeceb"]{background:color-mix(in srgb,var(--red) 26%,#0e141d)!important;color:#f3a097!important}
  ${D} .qnews.qn-imp,${D} .qnl.qn-imp{background:color-mix(in srgb,#d9822b 18%,#0e141d)}
  ${D} .qnews.qn-urg,${D} .qnl.qn-urg{background:color-mix(in srgb,var(--red) 18%,#0e141d)}
  ${D} .tag.qtrtag{background:color-mix(in srgb,#d9822b 22%,#0e141d);color:#f0c27a;border-color:color-mix(in srgb,#d9822b 45%,#0e141d)}
  ${D} .qzthumb{background:var(--text)}
  ${D} [data-qdark] svg{width:18px;height:18px}
  /* المحدَّد والأزرار الأساسية: أبيض ونصه أسود بدل اللون المضيء (أزرار الحضور الملوّنة تبقى بألوانها) */
  ${D} .side .tabs button.on{background:#fff;color:#14181f;box-shadow:inset -3px 0 0 var(--gold)}
  ${D} .btn.primary,${D} .btn.on:not(.present):not(.absent):not(.late):not(.excused):not(.qoff),${D} .tile.on,${D} .mode.on,${D} .chip-r input:checked+span,${D} .seg input:checked+span,${D} .qseg button.on,${D} .tag.lock{background:#fff!important;color:#14181f!important;border-color:#fff!important;box-shadow:none}
  ${D} main [data-qadd],${D} main [data-act="addStudent"]{background:#fff!important;color:#14181f!important;border-color:#fff!important}
  ${D} .btn.primary:hover,${D} .btn.on:not(.present):not(.absent):not(.late):not(.excused):not(.qoff):hover{background:#e4e8ee!important}
  }
  @media screen and (max-width:860px),screen and (hover:none) and (pointer:coarse){
    ${D} .card,${D} .stat{background:#172030!important;box-shadow:0 1px 4px rgba(0,0,0,.3)!important}
    ${D} .modal{background:#172030!important}
    ${D} .content .top{background:rgba(14,20,29,.97)!important}
    ${D} .overlay{background:rgba(0,0,0,.6)!important}
  }`;
  document.head.appendChild(css);

  /* بعض النوافذ تكتب خلفيات بيضاء في style مباشرة */
  const fixInline = () => {
    if (!isDark()) return;
    document.querySelectorAll('#app [style*="background:#fff"]:not([data-qdk]),body > div[style*="background:#fff"]:not([data-qdk])').forEach(n => { n.dataset.qdk = '1'; n.style.background = 'var(--card)'; });
  };

  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const btn = () => { const d = isDark(), t = d ? 'الوضع الفاتح' : 'الوضع الداكن';
    return `<button type="button" class="btn" data-qdark title="${t}" aria-label="${t}" aria-pressed="${d}">${d ? ICON_SUN : ICON_MOON}<span class="lbl">${d ? 'فاتح' : 'داكن'}</span></button>`; };

  const set = on => {
    try { if (on === sysDark()) localStorage.removeItem(KEY); else localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    root.classList.toggle('qdark', on);
    applyTheme(); render();
  };
  /* تغيّر وضع الجهاز (مثلًا تلقائيًا ليلًا): يُتبع إن لم يختر المستخدم بنفسه */
  const onSys = () => { if (stored() !== null) return; root.classList.toggle('qdark', isDark()); applyTheme(); if (typeof session !== 'undefined' && session) render(); };
  try { MQ?.addEventListener ? MQ.addEventListener('change', onSys) : MQ?.addListener?.(onSys); } catch (e) { /* ignore */ }

  const baseRender = render;
  render = function () {
    const r = baseRender.apply(this, arguments);
    try {
      const f = document.querySelector('.side-foot');
      if (f && !f.querySelector('[data-qdark]')) { const t = f.querySelector('.side-toggle'); t ? t.insertAdjacentHTML('beforebegin', btn()) : f.insertAdjacentHTML('beforeend', btn()); }
      fixInline();
    } catch (e) { /* ignore */ }
    return r;
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-qdark]')) { e.preventDefault(); e.stopPropagation(); set(!isDark()); } }, true);
  new MutationObserver(fixInline).observe(document.body, { childList: true });

  root.classList.toggle('qdark', isDark());
  if (isDark()) applyTheme();
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./darkmode.js')) VFILES.push('./darkmode.js'); } catch (e) { /* ignore */ } if (session) render(); });
})();
