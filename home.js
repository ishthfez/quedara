'use strict';
/* ============ «الرئيسية» والإعلانات ============
   - «الرئيسية» أول صفحة لكل الفئات (المعلم والمشرف والمحاسب والإداري والطالب كما للمدير)، وأولها مربع «الإعلانات».
   - المربع: كل إعلان سطر واحد، وأربعة أسطر على الأكثر (العاجل ثم المهم ثم العادي، والأحدث أولًا)، و«عرض كل الإعلانات»
     يفتح نافذة داخلية بالنصوص كاملة؛ والضغط على سطر يفتحها عند إعلانه.
   - أهمية الإعلان بلونه: عادي (هادئ)، مهم (برتقالي)، عاجل (أحمر).
   - مدة الإعلان: يختار المدير مدة (أو تاريخًا) يختفي بعدها الإعلان من «الرئيسية» و«الإعلانات» عند الجميع؛
     ويبقى في «الإعلانات» عند المدير بعلامة «انتهى»، وله فيها «تعديل» لكل إعلان (النص والجمهور والأهمية والمدة).
   - الحفظ على الخادم: عمودا prio و until (supabase/news_ext.sql)؛ وقبل تنفيذه يعمل الإعلان كما كان بلا أهمية ولا مدة. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./home.js')) VFILES.push('./home.js'); } catch (e) { /* ignore */ } });
  const PR = { '': ['عادي', 'qn-n'], imp: ['مهم', 'qn-imp'], urgent: ['عاجل', 'qn-urg'] };
  const RANK = { urgent: 0, imp: 1, '': 2 };
  const MAX = 4;
  const ROLES = ['teacher', 'supervisor', 'accountant', 'placeadmin', 'student'];
  const isOn = n => !n.until || String(n.until) >= today();
  const mine = n => !!session && n.audience === 'm:' + session.id;
  const pr = n => (PR[n.prio] ? n.prio : '');
  /* إعلانات الحساب السارية: العاجل ثم المهم ثم العادي، والأحدث أولًا */
  function listFor(aud) {
    return (db.news || []).map((n, i) => [n, i]).filter(([n]) => (n.audience === 'all' || n.audience === aud || mine(n)) && isOn(n))
      .sort((a, b) => RANK[pr(a[0])] - RANK[pr(b[0])] || b[1] - a[1]).map(x => x[0]);
  }
  const tag = n => (pr(n) ? `<span class="tag qn-tag ${PR[pr(n)][1]}">${PR[pr(n)][0]}</span> ` : '');
  const own = n => (mine(n) ? '<span class="tag tag-ok" style="font-size:.78rem">خاصة بك</span> ' : '');
  const full = n => `<div class="news qnews ${PR[pr(n)][1]}" data-qnid="${esc(n.id)}">${byLine(n)}${own(n)}${tag(n)}${esc(n.text)}<br><small>${esc(n.date)}${n.until ? ` · حتى ${esc(n.until)}` : ''}</small></div>`;

  /* ===== مربع «الإعلانات» في «الرئيسية» ===== */
  function box(aud) {
    const L = listFor(aud), top = L.slice(0, MAX);
    const line = n => `<button type="button" class="qnl ${PR[pr(n)][1]}" data-qnall="${esc(aud)}" data-qn="${esc(n.id)}">${tag(n)}${own(n)}<span class="qnl-t">${esc(n.text)}</span><small class="qnl-d">${esc(n.date)}</small></button>`;
    return `<div class="card qnhome"><div class="bar" style="margin:0 0 .5rem"><h2 class="grow" style="margin:0">الإعلانات</h2>${L.length > MAX ? `<button type="button" class="btn sm" data-qnall="${esc(aud)}">عرض كل الإعلانات (${L.length})</button>` : ''}</div>
      ${top.length ? top.map(line).join('') : empty('لا توجد إعلانات.')}</div>`;
  }
  /* النافذة: كل الإعلانات بنصوصها كاملة */
  function openAll(aud, id) {
    const L = listFor(aud);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>الإعلانات</h2>${L.length ? L.map(full).join('') : empty('لا توجد إعلانات.')}<div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    if (id) setTimeout(() => { const e = ov.querySelector(`[data-qnid="${CSS.escape(id)}"]`); if (e) { e.classList.add('qn-on'); e.scrollIntoView({ block: 'center' }); } }, 60);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-qnall]'); if (b) openAll(b.dataset.qnall, b.dataset.qn || ''); });

  /* ===== نموذج الإعلان (جديد وتعديل): الأهمية والمدة ===== */
  const AUDS = [{ v: 'all', l: 'الجميع' }, { v: 'teacher', l: 'المعلمون' }, { v: 'supervisor', l: 'المشرفون' }, { v: 'placeadmin', l: 'الإداريون' }, { v: 'student', l: 'الطلاب' }];
  const addDays = d => { const t = new Date(today() + 'T12:00:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
  const DUR = [['', 'بلا مدة'], ['0', 'اليوم فقط'], ['2', '3 أيام'], ['6', 'أسبوع'], ['13', 'أسبوعان'], ['29', 'شهر']];
  function newsForm(n) {
    const noExt = typeof CLOUD !== 'undefined' && CLOUD && window.Cloud?.newsExt === false;
    openForm(n ? 'تعديل الإعلان' : 'إعلان جديد', [
      { name: 'text', label: 'النص', type: 'textarea', value: n?.text || '' },
      { name: 'audience', label: 'الجمهور', type: 'select', value: n?.audience || 'all', options: n && /^m:/.test(n.audience) ? [{ v: n.audience, l: 'شخص بعينه' }] : AUDS },
      { name: 'prio', label: 'الأهمية', type: 'select', value: pr(n || {}), options: [{ v: '', l: 'عادي' }, { v: 'imp', l: 'مهم (برتقالي)' }, { v: 'urgent', l: 'عاجل (أحمر)' }] },
      { name: 'dur', label: 'يظهر لمدة', type: 'select', value: n && n.until ? 'keep' : '', options: [...(n && n.until ? [{ v: 'keep', l: `كما هو (حتى ${n.until})` }] : []), ...DUR.map(([v, l]) => ({ v, l }))] },
      { name: 'until', label: 'أو حتى تاريخ (اختياري)', type: 'date', value: '' },
      ...(noExt ? [{ type: 'note', label: 'الأهمية والمدة تحتاجان تنفيذ supabase/news_ext.sql على الخادم؛ وقبله يُحفظ الإعلان بلا أهمية ولا مدة.' }] : [])
    ], v => {
      if (!v.text.trim()) return 'اكتب نص الإعلان';
      const until = v.until || (v.dur === 'keep' ? n.until : v.dur !== '' ? addDays(+v.dur) : '');
      if (until && until < today()) return 'تاريخ الانتهاء قبل اليوم';
      if (n) Object.assign(n, { text: v.text.trim(), audience: v.audience, prio: v.prio, until });
      else db.news.push({ id: uid(), text: v.text.trim(), audience: v.audience, date: today(), prio: v.prio, until });
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    A.addNews = () => newsForm(null);
    A.editNews = d => { const n = (db.news || []).find(x => x.id === d.id); if (n) newsForm(n); };
  });

  /* ===== صفحة «الإعلانات» لكل فئة: الألوان، والمنتهي لا يظهر ===== */
  document.addEventListener('DOMContentLoaded', () => {
    newsView = function (aud) {
      const L = listFor(aud);
      return `<div class="card"><h2>الإعلانات</h2>${L.length ? L.map(full).join('') : empty('لا توجد إعلانات.')}</div>`;
    };
    /* إعلانات المدير: لون كل إعلان وأهميته ومدته، و«انتهى» للمنتهي، و«تعديل» بجانب «حذف» */
    const baseNews = adminViews.news;
    adminViews.news = function () {
      const h = baseNews.apply(this, arguments);
      if (typeof h !== 'string') return h;
      const t = document.createElement('template'); t.innerHTML = h;
      t.content.querySelectorAll('.news').forEach(el => {
        const del = el.querySelector('[data-act="delNews"]'), n = del && (db.news || []).find(x => x.id === del.dataset.id); if (!n) return;
        el.classList.add('qnews', PR[pr(n)][1]); if (!isOn(n)) el.classList.add('qn-old');
        if (pr(n)) el.insertAdjacentHTML('afterbegin', tag(n));
        const sm = el.querySelector('small'); if (sm && n.until) sm.insertAdjacentHTML('beforeend', isOn(n) ? ` · حتى ${esc(n.until)}` : ` · <span class="tag tag-no">انتهى ${esc(n.until)}</span>`);
        del.insertAdjacentHTML('beforebegin', `<button class="btn sm" data-act="editNews" data-id="${esc(n.id)}">تعديل</button> `);
      });
      return t.innerHTML;
    };
  });

  /* ===== «الرئيسية» ===== */
  const homeView = r => box(r);
  /* الطالب: تُضاف قبل أن يرتّب nav.js القوائم (فيحفظها صفحة البداية)، ثم تُعاد أول القائمة بعد ترتيبه.
     (العاملون يضعها stuview.js أول قائمتهم) */
  try { if (TABS.student && !TABS.student.some(t => t[0] === 'home')) TABS.student.unshift(['home', 'الرئيسية']); } catch (e) { /* ignore */ }
  document.addEventListener('DOMContentLoaded', () => {
    ROLES.forEach(r => { if (VIEWS[r]) VIEWS[r].home = () => homeView(r); });
    const T = TABS.student, i = T ? T.findIndex(t => t[0] === 'home') : -1; if (i > 0) T.unshift(...T.splice(i, 1));
    /* المدير: الإعلانات أول «الرئيسية» بدل آخرها */
    const baseDash = adminViews.dash;
    adminViews.dash = function () {
      const h = baseDash.apply(this, arguments);
      if (typeof h !== 'string') return h;
      const t = document.createElement('template'); t.innerHTML = h;
      [...t.content.children].filter(c => c.classList.contains('card') && !c.classList.contains('qnhome') && [...c.children].some(x => x.tagName === 'H2' && x.textContent.trim() === 'الإعلانات')).forEach(c => c.remove());
      return box('admin') + t.innerHTML;
    };
  });

  const css = document.createElement('style');
  css.textContent = `.qnews.qn-imp{border-inline-start:4px solid #d9822b;background:#fdf3e6}
    .qnews.qn-urg{border-inline-start:4px solid var(--red,#b3372f);background:#fbeceb}
    .qnews.qn-old{opacity:.55}.qnews.qn-on{outline:2px solid var(--navy,#13294b);outline-offset:2px}
    .qn-tag{font-size:.75rem;margin-inline-end:.35rem}.qn-tag.qn-imp{background:#d9822b;color:#fff}.qn-tag.qn-urg{background:var(--red,#b3372f);color:#fff}
    .qnl{display:flex;align-items:center;gap:.5rem;width:100%;border:0;border-radius:10px;padding:.55rem .75rem;margin:0 0 .35rem;font:inherit;color:inherit;text-align:start;cursor:pointer;
      background:var(--navy-l,#eef1f6);border-inline-start:4px solid #b9c3d3}
    .qnl:hover{filter:brightness(.97)}.qnl.qn-imp{background:#fdf3e6;border-inline-start-color:#d9822b}.qnl.qn-urg{background:#fbeceb;border-inline-start-color:var(--red,#b3372f)}
    .qnl .qn-tag{flex:none;margin:0}.qnl .tag-ok{flex:none}
    .qnl-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .qnl-d{flex:none;color:var(--muted,#777);font-size:.8rem}
    @media (max-width:600px){.qnl-d{display:none}}`;
  document.head.appendChild(css);
})();
