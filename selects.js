'use strict';
/* ============ قوائم الأسماء: ترتيب هجائي وكتابة للبحث ============
   كل قائمة منسدلة عناصرها أشخاص أو حلقات أو أماكن (تُعرف من قيمها: معرّفات الأعضاء والحلقات والأماكن وموظفي المرتبات):
     - تُرتّب من الألف إلى الياء (أحمد = احمد)، وتبقى «— اختر —» وما يشبهها أولًا و«غير ذلك…» آخرًا.
     - يصير فوقها مربع تُكتب فيه أي كلمة من الاسم فتظهر المطابقة فورًا (بالنقر أو الأسهم ثم Enter).
     - الضغط على المربع يفتح القائمة دائمًا. ومربعات البحث التي لها مصدر (data-suggest) تفتح قائمة اقتراحات بالطريقة نفسها.
   القائمة الأصلية تبقى في الصفحة مخفية وتتلقى الاختيار، فكل ما يعتمد عليها في التطبيق يعمل كما هو.
   القوائم ذات الترتيب المقصود (الشهور، الصفوف، الأجزاء، الفئات، الحالة…) لا تُمس. للاستثناء: data-nosearch. */
(() => {
  const css = document.createElement('style');
  css.textContent = `
    .qcombo{position:relative;display:inline-block;width:100%;vertical-align:middle}
    .qcombo>select.qcombo-sel{position:absolute!important;inset:0;opacity:0;pointer-events:none;width:100%!important;height:100%!important}
    .qcombo>input.qcombo-in{width:100%;cursor:text;padding-inline-start:.65rem;padding-inline-end:1.9rem}
    .qcombo::after{content:'';position:absolute;inset-inline-end:.75rem;top:50%;width:.45rem;height:.45rem;border:solid currentColor;border-width:0 2px 2px 0;transform:translateY(-70%) rotate(45deg);opacity:.55;pointer-events:none}
    .qcombo.mini-w{width:auto;min-width:11rem}
    #qclist{position:fixed;z-index:10001;background:#fff;border:1px solid var(--line,#d9dde5);border-radius:10px;box-shadow:0 10px 30px rgba(19,41,75,.16);max-height:300px;overflow-y:auto;padding:.25rem;direction:rtl}
    #qclist div{padding:.45rem .6rem;border-radius:7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #qclist div.on,#qclist div:hover{background:var(--gold-l,#f4ead6)}
    #qclist div.sel{font-weight:700}
    #qclist .grp{font-size:.78rem;color:var(--muted,#777);cursor:default;padding:.35rem .6rem .15rem;background:none!important}
    #qclist .none{color:var(--muted,#777);cursor:default;background:none!important}
    #qclist mark{background:rgba(201,162,39,.35);color:inherit;border-radius:3px}`;
  document.head.appendChild(css);
  setTimeout(() => { try { if (!VFILES.includes('./selects.js')) VFILES.push('./selects.js'); } catch (e) { /* ignore */ } }, 0);

  const MAXSHOW = 200;
  const N = s => { try { return norm(String(s || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632)); } catch (e) { return String(s || '').toLowerCase(); } };
  const sortKey = t => N(String(t || '').replace(/^\s*حلقة\s+/, ''));
  const coll = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });
  /* معرّفات كل ما هو «اسم»: الأعضاء والحلقات والأماكن وموظفو المرتبات */
  function nameIds() {
    const s = new Set();
    try {
      ['students', 'teachers', 'supervisors', 'accountants', 'admins', 'halaqat', 'places'].forEach(k => (db[k] || []).forEach(x => x?.id && s.add(String(x.id))));
      (db.payroll?.employees || []).forEach(x => x?.id && s.add(String(x.id)));
    } catch (e) { /* ignore */ }
    return s;
  }
  const fixedTop = o => !o.value || /^\s*[—–-]/.test(o.text) || /^(بلا|بدون|الكل|كل )/.test(o.text.trim());
  const fixedEnd = o => /^__/.test(o.value) || /^غير ذلك/.test(o.text.trim());
  function isNameSelect(sel, ids) {
    if (sel.multiple || sel.dataset.nosearch !== undefined || sel.classList.contains('msubsel')) return false;
    const vals = [...sel.options].filter(o => !fixedTop(o) && !fixedEnd(o)).map(o => o.value);
    if (vals.length < 2) return false;
    return vals.filter(v => ids.has(v)).length / vals.length >= 0.6;
  }
  /* ترتيب هجائي داخل القائمة (وداخل كل مجموعة)؛ لا يُعاد الترتيب إن كان مرتبًا أصلًا */
  function sortSel(sel) {
    const v = sel.value;
    const groups = [sel, ...sel.querySelectorAll('optgroup')];
    groups.forEach(g => {
      const opts = [...g.children].filter(x => x.tagName === 'OPTION');
      const top = opts.filter(fixedTop), end = opts.filter(o => !fixedTop(o) && fixedEnd(o)), mid = opts.filter(o => !fixedTop(o) && !fixedEnd(o));
      const sorted = mid.slice().sort((a, b) => coll.compare(sortKey(a.text), sortKey(b.text)));
      const want = [...top, ...sorted, ...end];
      if (want.every((o, i) => o === opts[i])) return;
      const anchor = g === sel ? sel.querySelector('optgroup') : null;
      want.forEach(o => (anchor ? g.insertBefore(o, anchor) : g.appendChild(o)));
    });
    if (sel.value !== v) sel.value = v;
  }

  /* ===== المربع القابل للكتابة ===== */
  let open = null, list = null, items = [], hi = -1;
  const labelOf = sel => { const o = sel.options[sel.selectedIndex]; return o && o.value ? o.text : ''; };
  const phOf = sel => { const o = [...sel.options].find(x => !x.value); return o ? o.text.replace(/^[\s—–-]+|[\s—–-]+$/g, '') : 'اكتب للبحث…'; };
  function sync(sel) {
    const inp = sel._qc; if (!inp) return;
    inp.disabled = sel.disabled;
    if (document.activeElement !== inp) inp.value = labelOf(sel);
    inp.placeholder = phOf(sel);
  }
  function enhance(sel) {
    if (sel._qc) return;
    const wrap = document.createElement('span'); wrap.className = 'qcombo';
    if (sel.classList.contains('mini') || /width\s*:\s*auto/.test(sel.getAttribute('style') || '')) wrap.classList.add('mini-w');
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'qcombo-in'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-label', sel.getAttribute('aria-label') || sel.closest('label')?.firstChild?.textContent?.trim() || 'بحث');
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(inp); wrap.appendChild(sel); /* المربع أولًا: النقر على عنوان الخانة يذهب إليه */
    sel.classList.add('qcombo-sel'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel._qc = inp; inp._sel = sel;
    sync(sel);
  }
  /* عناصر القائمة: من خيارات القائمة الأصلية، أو من مصدر مسمّى لمربعات البحث (data-suggest) */
  const SOURCES = (window.QLSuggest = window.QLSuggest || {});
  function itemsOf(inp) {
    if (inp._sel) return [...inp._sel.options].filter(o => !(o.disabled && o.value)).map(o => ({ v: o.value, t: o.text, g: o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : null }));
    const src = SOURCES[inp.dataset.suggest];
    try { return src ? src() : []; } catch (e) { return []; }
  }
  function build(inp, q) {
    const qs = N(q).split(' ').filter(Boolean);
    const out = [];
    let gLabel = null;
    for (const it of itemsOf(inp)) {
      if (qs.length && (!it.v || !qs.every(k => N(it.t).includes(k)))) continue;
      if (it.g !== gLabel) { gLabel = it.g; if (it.g) out.push({ grp: it.g }); }
      out.push({ o: it });
    }
    return out;
  }
  const isBox = el => !!el && (el.classList?.contains('qcombo-in') || (el.tagName === 'INPUT' && el.dataset?.suggest !== undefined));
  const mark = (t, q) => { const ws = q.trim().split(/\s+/).filter(Boolean); let h = esc(t); ws.forEach(w => { const i = h.indexOf(esc(w)); if (i > -1) h = h.slice(0, i) + '<mark>' + h.slice(i, i + esc(w).length) + '</mark>' + h.slice(i + esc(w).length); }); return h; };
  function show(inp, q) {
    const cur = inp._sel ? inp._sel.value : null; open = inp;
    if (!list) { list = document.createElement('div'); list.id = 'qclist'; list.setAttribute('role', 'listbox'); document.body.appendChild(list); list.addEventListener('mousedown', e => e.preventDefault()); list.addEventListener('click', e => { const d = e.target.closest('[data-i]'); if (d) pick(+d.dataset.i); }); }
    const all = build(inp, q), shown = [];
    let n = 0;
    for (const x of all) { if (x.o) { if (n >= MAXSHOW) break; n++; } shown.push(x); }
    items = shown.map(x => x.o || null);
    hi = items.findIndex(o => o && cur !== null && o.v === cur && !q);
    if (hi < 0) hi = inp._sel || q ? items.findIndex(o => o && (q ? o.v : true)) : -1;
    list.innerHTML = shown.length ? shown.map((x, i) => x.grp ? `<div class="grp">${esc(x.grp)}</div>` : `<div data-i="${i}" role="option" class="${i === hi ? 'on' : ''} ${cur !== null && x.o.v === cur ? 'sel' : ''}">${q ? mark(x.o.t, q) : esc(x.o.t)}</div>`).join('')
      + (all.filter(x => x.o).length > n ? `<div class="none">… و${all.filter(x => x.o).length - n} غيرها — اكتب لتضييق البحث</div>` : '')
      : '<div class="none">لا نتائج</div>';
    place();
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }
  function place() {
    if (!open || !list) return;
    const r = open.getBoundingClientRect(), below = window.innerHeight - r.bottom, h = Math.min(300, list.scrollHeight);
    list.style.minWidth = r.width + 'px'; list.style.maxWidth = Math.max(r.width, 340) + 'px';
    list.style.right = (window.innerWidth - r.right) + 'px'; list.style.left = 'auto';
    if (below < h + 10 && r.top > below) { list.style.top = 'auto'; list.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    else { list.style.bottom = 'auto'; list.style.top = (r.bottom + 4) + 'px'; }
  }
  function close(restore = true) {
    if (list) list.remove(); list = null;
    if (open && restore && open._sel) open.value = labelOf(open._sel);
    open = null; items = []; hi = -1;
  }
  function pick(i) {
    const o = items[i], inp = open; if (!o || !inp) return;
    if (inp._sel) {
      const sel = inp._sel, changed = sel.value !== o.v;
      sel.value = o.v; inp.value = o.t; close(false);
      if (changed) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    } else {
      /* مربع بحث: يُكتب الاختيار فيه ويُبلَّغ به (qpick) */
      inp.value = o.t; close(false);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new CustomEvent('qpick', { bubbles: true, detail: { value: o.v, text: o.t } }));
      close(false);
    }
  }
  const move = d => {
    if (!items.length) return;
    let i = hi; do { i = (i + d + items.length) % items.length; } while (!items[i] && i !== hi);
    hi = i; list.querySelectorAll('[data-i]').forEach(x => x.classList.toggle('on', +x.dataset.i === hi)); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  /* الضغط على المربع يفتح القائمة دائمًا (حتى لو كان المؤشر فيه من قبل)، والكتابة تصفّيها */
  const openFor = inp => { if (inp._sel) { inp.select(); show(inp, ''); } else show(inp, inp.value); };
  document.addEventListener('focusin', e => { if (isBox(e.target)) openFor(e.target); });
  document.addEventListener('click', e => { if (isBox(e.target) && !(list && open === e.target)) openFor(e.target); });
  document.addEventListener('focusout', e => { if (e.target === open) setTimeout(() => { if (document.activeElement !== open) close(); }, 120); });
  document.addEventListener('input', e => { if (isBox(e.target) && document.activeElement === e.target) show(e.target, e.target.value); });
  document.addEventListener('keydown', e => {
    const inp = e.target; if (!isBox(inp)) return;
    if (!list && (e.key === 'ArrowDown' || (e.key === 'Enter' && inp._sel))) { openFor(inp); e.preventDefault(); return; }
    if (!list) return;
    if (e.key === 'ArrowDown') { move(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { move(-1); e.preventDefault(); }
    else if (e.key === 'Enter') { if (hi > -1) { pick(hi); e.preventDefault(); e.stopPropagation(); } else if (inp._sel) e.preventDefault(); else close(false); }
    else if (e.key === 'Escape') { close(); inp.blur(); e.stopPropagation(); }
  }, true);
  document.addEventListener('mousedown', e => { if (list && !e.target.closest('#qclist') && e.target !== open) close(); });
  window.addEventListener('resize', place); document.addEventListener('scroll', place, true);
  document.addEventListener('change', e => { if (e.target._qc) sync(e.target); });

  /* ===== تطبيق الترتيب والبحث على كل قائمة أسماء تظهر أو تتغير ===== */
  let pending = false;
  function scan() {
    pending = false;
    const ids = nameIds();
    document.querySelectorAll('select').forEach(sel => {
      if (sel._qc) { sortSel(sel); sync(sel); return; }
      if (!isNameSelect(sel, ids)) return;
      sortSel(sel);
      if (sel.options.length >= 5 && !sel.closest('#qlock')) enhance(sel);
    });
  }
  const later = () => { if (!pending) { pending = true; requestAnimationFrame(scan); } };
  new MutationObserver(ms => { if (ms.some(m => m.type === 'childList' && m.target.id !== 'qclist' && !m.target.closest?.('#qclist') && (m.addedNodes.length || m.target.tagName === 'SELECT' || m.target.tagName === 'OPTGROUP'))) later(); })
    .observe(document.body, { childList: true, subtree: true });
  /* قيمة تُضبط برمجيًا دون حدث «change»: يُحدَّث النص المعروض */
  setInterval(() => document.querySelectorAll('select.qcombo-sel').forEach(sync), 700);
  window.QLSelects = { scan, isNameSelect, nameIds, sources: SOURCES };
})();
