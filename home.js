'use strict';
/* ============ «الرئيسية» والإعلانات ============
   - «الرئيسية» أول صفحة لكل الفئات (المعلم والمشرف والمحاسب والإداري والطالب كما للمدير)، وأولها مربع «الإعلانات».
   - المربع: كل إعلان سطر واحد، وأربعة أسطر على الأكثر (العاجل ثم المهم ثم العادي، والأحدث أولًا)، و«عرض كل الإعلانات»
     يفتح نافذة داخلية بالنصوص كاملة؛ والضغط على سطر يفتحها عند إعلانه.
   - أهمية الإعلان بلونه: عادي (هادئ)، مهم (برتقالي)، عاجل (أحمر).
   - مدة الإعلان: يختار المدير مدة (أو تاريخًا) يختفي بعدها الإعلان من «الرئيسية» و«الإعلانات» عند الجميع؛
     ويبقى في «الإعلانات» عند المدير بعلامة «انتهى»، وله فيها «تعديل» لكل إعلان (النص والجمهور والأهمية والمدة).
   - الحفظ على الخادم: عمودا prio و until (supabase/news_ext.sql)؛ وقبل تنفيذه يعمل الإعلان كما كان بلا أهمية ولا مدة.
   - تحت الإعلانات عدّادات بحسب اختصاص كل فئة (بطاقة «الحلقات والطلاب» نفسها التي عند المدير)، كلٌّ في نطاقه:
     المعلم حلقاته، والمشرف حلقاته، والإداري حلقات أماكنه، والمحاسب الطلاب و«الاشتراكات»، والطالب حضوره وتسميعه.
     الطلاب في العدّادات كلها المنتظمون وحدهم، والمعلمون العاملون وحدهم (لا الموقوفون)، عند المدير وغيره. */
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

  /* ===== العدّادات تحت الإعلانات: بحسب اختصاص كل فئة ===== */
  const row = (cls, l, v) => `<div class="feerow ${cls}"><span>${esc(l)}</span><b>${esc(String(v))}</b></div>`;
  const pctRow = (l, p) => `<div class="feerow fr-ok qfpct"><span>${esc(l)}</span><span class="qfbar" aria-hidden="true"><span style="width:${Math.min(p, 100)}%"></span></span><b>${p}%</b></div>`;
  const card = (title, r1, r2) => `<div class="card qdashcard qhomecnt" style="margin:0 0 1rem"><h3 style="margin:0 0 .8rem">${esc(title)}</h3>
    <div class="qfrow">${r1.join('')}</div>${r2 && r2.length ? `<div class="qfrow">${r2.join('')}</div>` : ''}</div>`;
  /* حلقات الحساب وطلابها (نطاقه كما في «الطلاب») */
  const scopeHal = () => { const H = window.QLStuView?.scopeH?.(); return H || db.halaqat; };
  function scopeData() {
    const H = scopeHal(), ids = new Set(H.map(h => h.id));
    const S = db.students.filter(s => ids.has(s.halaqaId)), on = S.filter(s => !stOff(s)), onIds = new Set(on.map(s => s.id));
    const t = today(), mon = t.slice(0, 7);
    /* حضور اليوم: حالة واحدة لكل طالب (آخر ما سُجّل له) */
    const day = new Map(); (db.attendance || []).forEach(a => { if (a.date === t && onIds.has(a.studentId)) day.set(a.studentId, a); });
    const attT = [...day.values()];
    const here = attT.filter(a => a.status === 'present' || a.status === 'late').length;
    const halDone = H.filter(h => attT.some(a => byId(db.students, a.studentId)?.halaqaId === h.id)).length;
    const recT = (db.records || []).filter(r => r.date === t && onIds.has(r.studentId)).length;
    const absM = (db.attendance || []).filter(a => a.status === 'absent' && String(a.date).startsWith(mon) && onIds.has(a.studentId)).length;
    return { H, S, on, attT, here, pct: on.length ? Math.round(here / on.length * 100) : 0, notYet: on.filter(s => !day.has(s.id)).length, halDone, recT, absM, mon };
  }
  const trs = () => (window.QLTransfers?.list?.() || []);
  /* إخطارات التحصيل بانتظار المراجعة (للمحاسب): من الخادم كل دقيقة على الأكثر */
  const INB = { n: null, at: 0, busy: false };
  function inbox() {
    if (INB.busy || Date.now() - INB.at < 60000 || !window.QLCN?.api) return;
    INB.busy = true;
    window.QLCN.api.list('inbox').then(L => { INB.n = L.length; }, () => { INB.n = null; }).finally(() => { INB.at = Date.now(); INB.busy = false; if (ui.tab === 'home') render(); });
  }
  function counters(r) {
    if (r === 'student') {
      const me = session.id, t = today(), mon = t.slice(0, 7);
      const byDay = new Map(); (db.attendance || []).forEach(a => { if (a.studentId === me && String(a.date).startsWith(mon)) byDay.set(a.date, a); });
      const att = [...byDay.values()];
      const ok = att.filter(a => a.status === 'present' || a.status === 'late').length, abs = att.filter(a => a.status === 'absent').length;
      const rec = (db.records || []).filter(x => x.studentId === me && String(x.date).startsWith(mon)).length;
      let last = '—'; try { last = lastHifz(me) || '—'; } catch (e) { /* ignore */ }
      return card('هذا الشهر', [att.length ? pctRow('نسبة حضوري', Math.round(ok / att.length * 100)) : row('fr-plain', 'نسبة حضوري', '—'), row(abs ? 'fr-no' : 'fr-ok', 'أيام الغياب', abs), row('fr-info', 'تسميعاتي', rec)], [row('fr-plain', 'آخر حفظ', last)]);
    }
    if (r === 'accountant') {
      const on = db.students.filter(s => !stOff(s)).length;
      inbox();
      let fee = ''; try { fee = window.QLFeeSummary ? window.QLFeeSummary(db.students) : ''; } catch (e) { fee = ''; }
      return card('الطلاب', [row('fr-plain', 'الطلاب المنتظمون', on),
        ...(window.QLStuPerm?.can?.('accbtn') === false ? [] : [row(INB.n ? 'fr-no' : 'fr-ok', 'إخطارات بانتظار المراجعة', INB.n == null ? '…' : INB.n)])]) + fee;
    }
    const d = scopeData(), T = trs(), wait = T.filter(x => x.canDecide).length;
    const att = d.on.length ? pctRow('حضور اليوم', d.pct) : row('fr-plain', 'حضور اليوم', '—');
    if (r === 'teacher') {
      return card('حلقاتي', [row('fr-plain', 'الطلاب المنتظمون', d.on.length), att, row(d.notYet ? 'fr-no' : 'fr-ok', 'لم يُسجَّل حضورهم اليوم', d.notYet)],
        [row('fr-info', 'تسميع اليوم', d.recT), row('fr-plain', 'غياب هذا الشهر', d.absM), ...(T.length ? [row('fr-info', 'بانتظار موافقة النقل', T.length)] : [])]);
    }
    if (r === 'supervisor') {
      const ab = ((db.payroll || {}).absences || []).filter(a => String(a.date || '').startsWith(d.mon)).length;
      return card('حلقاتي', [row('fr-plain', 'الحلقات', d.H.length), row('fr-plain', 'الطلاب المنتظمون', d.on.length), att],
        [row(d.halDone < d.H.length ? 'fr-no' : 'fr-ok', 'حلقات سُجّل حضورها اليوم', `${d.halDone} من ${d.H.length}`), row('fr-info', 'تسميع اليوم', d.recT), row('fr-plain', 'غياب المعلمين هذا الشهر', ab), row(wait ? 'fr-no' : 'fr-ok', 'طلبات نقل بانتظار موافقتك', wait)]);
    }
    /* الإداري */
    const pl = new Set(d.H.map(h => h.placeId).filter(Boolean)).size;
    return card('نطاقي', [row('fr-plain', 'الأماكن', pl), row('fr-plain', 'الحلقات', d.H.length), row('fr-plain', 'الطلاب المنتظمون', d.on.length)],
      [att, row(d.halDone < d.H.length ? 'fr-no' : 'fr-ok', 'حلقات سُجّل حضورها اليوم', `${d.halDone} من ${d.H.length}`), row('fr-info', 'تسميع اليوم', d.recT), ...(T.length ? [row(wait ? 'fr-no' : 'fr-info', 'طلبات النقل', T.length)] : [])]);
  }

  /* ===== «الرئيسية» ===== */
  const homeView = r => { let c = ''; try { c = counters(r); } catch (e) { console.error('home counters:', e); } return box(r) + c; };
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
      /* «الحلقات والطلاب»: الطلاب المنتظمون وحدهم، والمعلمون العاملون وحدهم */
      const SET = { 'المعلمون': ['المعلمون العاملون', (db.teachers || []).filter(x => (x.admin || {}).status !== 'موقوف').length], 'الطلاب': ['الطلاب المنتظمون', db.students.filter(x => !stOff(x)).length] };
      t.content.querySelectorAll('.qdashcard .feerow').forEach(f => { const sp = f.querySelector('span'), b = f.querySelector('b'), v = sp && SET[sp.textContent.trim()]; if (v && b) { sp.textContent = v[0]; b.textContent = v[1]; } });
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
