'use strict';
/* ============ تنظيم أقسام المدير: لكل شيء بيت واحد (المرحلة الأولى) ============
   - أقسام متقاربة صارت تبويبات داخل قسم واحد، دون حذف أي وظيفة:
       «الاشتراكات»: التحصيل + تحصيل المعلمين
       «المرتبات»: المرتبات + غياب المعلمين
       «الإعدادات»: الإعدادات + الصلاحيات + النسخ الاحتياطية + البيانات المعلّقة
   - الشريط الجانبي مجمّع بعناوين: التعليم، المالية، التواصل، النظام.
   - أي زر قديم يفتح قسمًا صار تبويبًا (مثل «+ تسجيل غياب» أو «النسخ الاحتياطية…») يفتح القسم الجامع على تبويبه.
   يُحمَّل بعد كل الملفات التي تضيف أقسامًا، وقبل app-actions.js. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./nav.js')) VFILES.push('./nav.js'); } catch (e) { /* ignore */ } }, 0);
  const label = k => (TABS.admin.find(t => t[0] === k) || [k, k])[1];
  const GROUPS = {
    fees: [['fees', 'التحصيل'], ['tcollect', 'تحصيل المعلمين']],
    payroll: [['payroll', 'المرتبات'], ['absence', 'غياب المعلمين']],
    settings: [['settings', 'الإعدادات'], ['perms', 'الصلاحيات'], ['backup', 'النسخ الاحتياطية'], ['pending', 'بيانات معلّقة']]
  };
  /* ترتيب الشريط الجانبي وعناوين مجموعاته */
  const ORDER = [['dash'], ['members'], ['students', 'التعليم'], ['teachers'], ['halaqat'], ['fees', 'المالية'], ['payroll'], ['news', 'التواصل'], ['settings', 'النظام']];
  const OWNER = {}; Object.entries(GROUPS).forEach(([g, subs]) => subs.forEach(([k]) => { OWNER[k] = g; }));
  const sub = {}; try { Object.assign(sub, JSON.parse(sessionStorage.getItem('halaqat_sub') || '{}')); } catch (e) { /* ignore */ }
  const saveSub = () => { try { sessionStorage.setItem('halaqat_sub', JSON.stringify(sub)); } catch (e) { /* ignore */ } };

  /* «الاشتراكات» بلا بحث تعرض حتى 300 طالب دفعة واحدة؛ على الهاتف تكفي 60 حتى يُطلب المزيد (البحث يضيّقها) */
  const feesBase = adminViews.fees;
  let feesAll = false, feesN = -1;
  if (feesBase) adminViews.fees = () => {
    const h = feesBase(), cap = matchMedia('(max-width:860px)').matches ? 60 : 300;
    const i = h.indexOf('<div class="tbl"><table>'), end = i < 0 ? -1 : h.indexOf('</table>', i);
    if (end < 0 || h.indexOf('<div class="tbl"><table>', end) > -1) return h; // العرض المجمّع بالحلقات يبقى كما هو
    const parts = h.slice(i, end).split('<tr>'), N = parts.length - 2;
    if (N !== feesN) { feesAll = false; feesN = N; }
    if (feesAll || N <= cap) return h;
    return h.slice(0, i) + parts.slice(0, 2 + cap).join('<tr>') + '</table></div>'
      + `<p class="muted" style="margin:.6rem 0 0">يظهر أول ${cap} طالبًا. اكتب في مربعات البحث للتضييق، أو <button type="button" class="btn sm" data-feesall>عرض المزيد</button></p>`
      + h.slice(h.indexOf('</div>', end) + 6);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-feesall]')) { feesAll = true; render(); } });
  /* القسم الجامع يعرض شريط تبويباته ثم محتوى التبويب المختار (بالدالة الأصلية لكل قسم) */
  const ORIG = {};
  Object.entries(GROUPS).forEach(([g, subs]) => {
    subs.forEach(([k]) => { ORIG[k] = adminViews[k]; });
    adminViews[g] = () => {
      const cur = subs.some(([k]) => k === sub[g]) ? sub[g] : subs[0][0];
      const cnt = k => k === 'pending' ? (db.pending || []).length : k === 'tcollect' ? (db.collections || []).filter(c => c.status === 'sent').length : 0;
      const bar = `<div class="card subnav"><div class="bar" style="margin:0">${subs.map(([k, l]) => `<button type="button" class="btn ${k === cur ? 'on' : ''}" data-subtab="${k}" data-g="${g}">${l}${cnt(k) ? ` <span class="count">${cnt(k)}</span>` : ''}</button>`).join('')}</div></div>`;
      const fn = ORIG[cur] || adminViews[cur];
      return bar + (fn ? fn() : empty('هذا القسم غير محمّل.'));
    };
  });
  /* أقسام الشريط الجانبي الجديدة */
  const keep = new Map(TABS.admin.map(t => [t[0], t[1]]));
  keep.set('fees', 'الاشتراكات'); keep.set('payroll', 'المرتبات'); keep.set('settings', 'الإعدادات');
  TABS.admin.splice(0, TABS.admin.length, ...ORDER.filter(([k]) => keep.has(k)).map(([k]) => [k, keep.get(k)]),
    /* أي قسم أضافه ملف آخر ولم يُذكر هنا يبقى في آخر القائمة */
    ...[...keep.keys()].filter(k => !ORDER.some(o => o[0] === k) && !OWNER[k]).map(k => [k, keep.get(k)]));

  /* «تحصيل المعلمين» لا عمود فيه للمكان، فاسم الحلقة فيه بمكانها (كما كان قسمًا مستقلًا) */
  const baseLabel = halaqaLabel;
  halaqaLabel = function (h) {
    if (ui.tab !== 'fees' || sub.fees !== 'tcollect') return baseLabel(h);
    ui.tab = 'tcollect'; try { return baseLabel(h); } finally { ui.tab = 'fees'; }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-subtab]'); if (!b) return;
    sub[b.dataset.g] = b.dataset.subtab; saveSub(); render(); window.scrollTo(0, 0);
  });

  /* عناوين المجموعات في الشريط الجانبي، وعدّاد البيانات المعلّقة والتحصيل على القسم الجامع */
  const css = document.createElement('style');
  css.textContent = `.side .navgrp{font-size:.72rem;font-weight:700;letter-spacing:.02em;opacity:.55;padding:.7rem .8rem .15rem;color:var(--on-navy)}
    .shell.collapsed .side .navgrp{font-size:0;padding:.35rem 0;border-top:1px solid rgba(255,255,255,.14);margin:0 .6rem}
    .subnav{padding:.55rem .7rem;margin-bottom:.8rem}.subnav .btn{white-space:nowrap}`;
  document.head.appendChild(css);
  function decorate() {
    if (session?.role !== 'admin') return;
    const nav = document.querySelector('.side nav.tabs'); if (!nav || nav.querySelector('.navgrp')) return;
    ORDER.filter(o => o[1]).forEach(([k, t]) => { const b = nav.querySelector(`button[data-v="${k}"]`); if (b) b.insertAdjacentHTML('beforebegin', `<div class="navgrp">${t}</div>`); });
    const badge = (k, n) => { const b = nav.querySelector(`button[data-v="${k}"]`); if (b && n && !b.querySelector('.count')) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`); };
    badge('settings', (db.pending || []).length);
    badge('fees', (db.collections || []).filter(c => c.status === 'sent').length);
  }

  /* ===== سرعة الانتقال بين الأقسام =====
     تثبيت رؤوس الجداول كان يقيس كل جدول ثم يعدّله واحدًا بعد الآخر، فيعيد المتصفح حساب الصفحة كلها مرة لكل جدول
     (في «الأماكن والحلقات» 22 جدولًا ← أكثر من ثانية على الهاتف). صار: كل القياسات أولًا ثم كل التعديلات،
     والجداول القصيرة (أقل من 12 صفًا) لا تحتاج تثبيتًا أصلًا. */
  const LEAD = new Set(['', '#', 'م', 'الكود', 'مسلسل']);
  function fastFreeze() {
    const jobs = [];
    document.querySelectorAll('main .tbl table').forEach(tbl => {
      if (tbl.rows.length < 12) return;
      const { rows, grid, H } = tableGrid(tbl);
      if (!H || H >= rows.length || !grid[H]) return;
      jobs.push({ tbl, rows, grid, H });
    });
    /* القياس: مرة واحدة لكل الجداول */
    jobs.forEach(j => {
      j.w = j.grid[j.H].map(x => x?.td.offsetWidth || 0);
      j.h = j.rows.slice(0, j.H).map(r => r.offsetHeight);
      j.sig = j.rows.length + ':' + j.w.join(',') + ':' + j.h.join(',');
    });
    /* التعديل: بلا أي قياس بينها */
    jobs.forEach(({ tbl, rows, grid, H, w, h, sig }) => {
      if (tbl._frz === sig) return;
      tbl._frz = sig; tbl.classList.add('frz');
      let n = 0; while (n < 3 && grid[0][n] && LEAD.has(grid[0][n].td.textContent.trim())) n++;
      n = Math.min(n + 1, grid[H].length - 1);
      const off = [0]; for (let c = 0; c < n; c++) off.push(off[c] + (grid[H][c]?.cs === 1 ? w[c] : 0));
      let top = 0;
      rows.forEach((tr, ri) => {
        [...tr.cells].forEach(td => { td.classList.remove('stk-h', 'stk-hl', 'stk-c'); td.style.top = td.style.right = ''; });
        if (ri < H) { [...tr.cells].forEach(td => { td.classList.add('stk-h'); td.style.top = top + 'px'; if (ri + (td.rowSpan || 1) >= H) td.classList.add('stk-hl'); }); top += h[ri]; }
      });
      grid.forEach(r => r.forEach(x => { if (x?.first && x.c0 + x.cs <= n) { x.td.classList.add('stk-c'); x.td.style.right = off[x.c0] + 'px'; } }));
    });
  }
  /* ===== كلمة «حلقة» قبل اسم الحلقة في كبسولة، في كل التطبيق =====
     تُلفّ الكلمة فقط حين يليها اسم معلم (أو «بلا معلم»)، فلا تتأثر الجمل مثل «15 حلقة» أو «الحلقة».
     النص نفسه لا يتغير (البحث والتصدير والطباعة كما هي)، والقوائم المنسدلة الأصلية تبقى نصًا. */
  const pcss = document.createElement('style');
  pcss.textContent = `.hpill{display:inline-block;font-size:.78em;line-height:1.55;padding:0 .5em;border-radius:999px;background:color-mix(in srgb,var(--navy,#13294b) 11%,transparent);color:var(--navy,#13294b);font-weight:700;vertical-align:.06em;white-space:nowrap}
    .side .hpill,.pvtop .hpill{background:rgba(255,255,255,.18);color:inherit}`;
  document.head.appendChild(pcss);
  let pillRe = null, pillKey = '';
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function pillRegex() {
    const names = [...new Set((db.teachers || []).map(t => (t.name || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const key = names.join('|');
    if (key !== pillKey) { pillKey = key; pillRe = new RegExp(`(^|[^\\u0600-\\u06FF])(حلقة)(?= (?:${names.map(escRe).join('|')}${names.length ? '|' : ''}بلا معلم))`, 'g'); }
    return pillRe;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'SELECT', 'INPUT', 'TITLE']);
  function pillify(root) {
    if (!root || !session) return;
    const re = pillRegex(), nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.includes('حلقة') && n.parentNode && !SKIP.has(n.parentNode.nodeName) && !n.parentNode.closest?.('.hpill,svg') ? 1 : 2) });
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      re.lastIndex = 0; if (!re.test(n.data)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(n.data))) {
        const at = m.index + m[1].length;
        frag.append(n.data.slice(last, at));
        const sp = document.createElement('span'); sp.className = 'hpill'; sp.textContent = 'حلقة'; frag.append(sp);
        last = at + 4;
      }
      frag.append(n.data.slice(last)); n.replaceWith(frag);
    });
  }
  window.QLPill = pillify;
  let pillQ = new Set(), pillRaf = 0;
  new MutationObserver(ms => {
    ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList?.contains('hpill')) pillQ.add(n); else if (n.nodeType === 3 && n.parentNode) pillQ.add(n.parentNode); }));
    if (pillQ.size && !pillRaf) pillRaf = requestAnimationFrame(() => { const q = [...pillQ]; pillQ = new Set(); pillRaf = 0; q.forEach(el => { if (el.isConnected) pillify(el); }); });
  }).observe(document.body, { childList: true, subtree: true });
  /* المعاينة: الإطار صفحة مستقلة، فتُلفّ كلماته بعد تحميله */
  document.addEventListener('load', e => { const f = e.target; if (f?.classList?.contains('pvif')) try { pillify(f.contentDocument.body); } catch (err) { /* ignore */ } }, true);
  setTimeout(() => {
    if (typeof freezeTables === 'function' && typeof tableGrid === 'function') freezeTables = fastFreeze;
    const base = render;
    render = function () {
      /* قسم صار تبويبًا: يُفتح القسم الجامع على هذا التبويب */
      if (session?.role === 'admin' && OWNER[ui.tab] && OWNER[ui.tab] !== ui.tab) { sub[OWNER[ui.tab]] = ui.tab; saveSub(); ui.tab = OWNER[ui.tab]; }
      const r = base.apply(this, arguments);
      try { decorate(); } catch (err) { /* لا يعطّل العرض */ }
      return r;
    };
    if (session) render();
  }, 0);
})();
