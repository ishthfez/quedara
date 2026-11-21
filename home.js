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
  /* «المديرون العامون» جمهور مستقل، ويصلهم أيضًا ما يُرسل للمشرفين (supabase/gmanager.sql) */
  const isGM = () => session?.role === 'supervisor' && !!window.isGenSup?.(me());
  const pr = n => (PR[n.prio] ? n.prio : '');
  /* إعلانات الحساب السارية: العاجل ثم المهم ثم العادي، والأحدث أولًا */
  function listFor(aud) {
    return (db.news || []).map((n, i) => [n, i]).filter(([n]) => (n.audience === 'all' || n.audience === aud || (n.audience === 'gmanager' && isGM()) || mine(n)) && isOn(n))
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
  const AUDS = [{ v: 'all', l: 'الجميع' }, { v: 'gmanager', l: 'المديرون العامون' }, { v: 'supervisor', l: 'المشرفون (ومعهم المديرون العامون)' }, { v: 'teacher', l: 'المعلمون' }, { v: 'accountant', l: 'المحاسبون' }, { v: 'placeadmin', l: 'الإداريون' }, { v: 'student', l: 'الطلاب' }];
  /* أسماء الجمهور في قائمة إعلانات المدير (AUD في app.js) */
  try { if (typeof AUD === 'object' && AUD) { if (!AUD.placeadmin) AUD.placeadmin = 'الإداريون'; AUD.gmanager = 'المديرون العامون'; } } catch (e) { /* ignore */ }
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
  /* ===== مربع «اليوم»: يُختار منه يوم آخر للاطلاع، والقائمة أيام فيها تسجيل فعلًا (حضور أو تسميع) فقط ===== */
  let qday = '';
  const dataDays = () => { const s = new Set(); (db.attendance || []).forEach(a => a.date && s.add(a.date)); (db.records || []).forEach(r => r.date && s.add(r.date)); return [...s].filter(d => d <= today()).sort().reverse(); };
  const curDay = D => (qday && D.includes(qday) ? qday : D[0] || '');
  const shiftDay = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const dayLabel = d => d === today() ? 'اليوم' : d === shiftDay(today(), -1) ? 'أمس' : new Date(d + 'T12:00:00').toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  /* عنوان المربع هو قائمة الأيام نفسها (لا يتكرر التاريخ مرتين)، وإن لم يكن إلا يوم واحد فعنوان عادي */
  const dayHead = (D, cur) => D.length > 1
    ? `<div style="margin:0 0 .8rem"><select data-qday class="qdaysel" aria-label="اليوم المعروض">${D.slice(0, 120).map(d => `<option value="${d}" ${d === cur ? 'selected' : ''}>${esc(dayLabel(d))}</option>`).join('')}</select></div>`
    : `<h3 style="margin:0 0 .8rem">${esc(cur ? dayLabel(cur) : 'اليوم')}</h3>`;
  document.addEventListener('change', e => { if (e.target.matches?.('[data-qday]')) { qday = e.target.value; render(); } });
  /* حضور اليوم المختار (كما في لوحة المدير: الحاضر والمتأخر من المسجَّلين)، والتسجيلات منذ سبعة أيام قبله حتى نهايته (الحساب نفسه في app.js) */
  /* طلاب المؤسسة الحقيقيون: بلا الحسابات المؤقتة لطلاب الدورات الخارجيين (info.temp)، فهي ليست طلاب حلقات
     (كانت تُعدّ «منتظمين» ثم «منقطعين» بعد انتهاء كل دورة، وتدخل في الاشتراكات المتوقعة) */
  const realStu = () => (db.students || []).filter(s => !(s.info && s.info.temp));
  /* الحضور بقاعدة الغياب الضمني (attOnDay في app.js): من لم يُسجَّل في حلقة سجّلت يومها غائب */
  const dayStats = d => { const A = attOnDay(db.students, d), from = shiftDay(d, -6);   // سبعة أيام بما فيها اليوم
    return { pct: A.pct, week: (db.records || []).filter(r => r.date >= from && r.date <= d && !isPlan(r)).length }; };
  function scopeData(onDay) {
    const H = scopeHal(), ids = new Set(H.map(h => h.id));
    const S = db.students.filter(s => ids.has(s.halaqaId)), on = S.filter(s => !stOff(s)), onIds = new Set(on.map(s => s.id));
    const t = onDay || today(), mon = today().slice(0, 7);
    /* حضور اليوم: حالة واحدة لكل طالب (آخر ما سُجّل له) */
    const day = new Map(); (db.attendance || []).forEach(a => { if (a.date === t && onIds.has(a.studentId)) day.set(a.studentId, a); });
    const attT = [...day.values()];
    const here = attT.filter(a => a.status === 'present' || a.status === 'late').length;
    const halDone = H.filter(h => attT.some(a => byId(db.students, a.studentId)?.halaqaId === h.id)).length;
    const recT = (db.records || []).filter(r => r.date === t && onIds.has(r.studentId) && !isPlan(r)).length;
    /* غياب الشهر: المسجَّل غائبًا، ومن لم يُسجَّل في يوم سجّلت فيه حلقته (الغياب الضمني) */
    const absM = on.reduce((n, s) => n + [...attDaysOf(s, mon + '-01', mon + '-31').days.values()].filter(x => x === 'absent').length, 0);
    /* النسبة من طلاب الحلقات التي سجّلت اليوم؛ و«لم يُسجَّل بعد» من حلقات لم تسجّل اليوم */
    const AD = attOnDay(on, t);
    return { H, S, on, attT, here, pct: AD.pct, notYet: on.filter(s => !day.has(s.id) && !halRecorded(s.halaqaId, t)).length, halDone, recT, absM, mon };
  }
  const trs = () => (window.QLTransfers?.list?.() || []);
  /* كشوف التحصيل بانتظار المراجعة (للمحاسب): من الخادم كل دقيقة على الأكثر */
  const INB = { n: null, at: 0, busy: false };
  function inbox() {
    if (INB.busy || Date.now() - INB.at < 60000 || !window.QLCN?.api) return;
    INB.busy = true;
    window.QLCN.api.list('inbox').then(L => { INB.n = L.length; }, () => { INB.n = null; }).finally(() => { INB.at = Date.now(); INB.busy = false; if (ui.tab === 'home') render(); });
  }
  function counters(r) {
    if (r === 'student') {
      const me = session.id, t = today(), mon = t.slice(0, 7);
      const att = [...attDaysOf(byId(db.students, me) || { id: me }, mon + '-01', mon + '-31').days.values()];
      const ok = att.filter(a => a === 'present' || a === 'late').length, abs = att.filter(a => a === 'absent').length;
      const rec = (db.records || []).filter(x => x.studentId === me && String(x.date).startsWith(mon) && !isPlan(x)).length;
      let last = '—'; try { last = lastHifz(me) || '—'; } catch (e) { /* ignore */ }
      return card('هذا الشهر', [att.length ? pctRow('نسبة حضوري', Math.round(ok / att.length * 100)) : row('fr-plain', 'نسبة حضوري', '—'), row(abs ? 'fr-no' : 'fr-ok', 'أيام الغياب', abs), row('fr-info', 'تسميعاتي', rec)], [row('fr-plain', 'آخر حفظ', last)]);
    }
    if (r === 'accountant') {
      const on = realStu().filter(s => !stOff(s)).length;
      inbox();
      let fee = ''; try { fee = window.QLFeeSummary ? window.QLFeeSummary(realStu()) : ''; } catch (e) { fee = ''; }
      return card('الطلاب', [row('fr-plain', 'الطلاب المنتظمون', on),
        ...(window.QLStuPerm?.can?.('accbtn') === false ? [] : [row(INB.n ? 'fr-no' : 'fr-ok', 'كشوف بانتظار المراجعة', INB.n == null ? '…' : INB.n)])]) + fee;
    }
    const d = scopeData(), T = trs(), wait = T.filter(x => x.canDecide).length;
    /* قبل أن تسجّل أي حلقة حضور اليوم: «—» لا 0% */
    const att = d.on.length && d.pct != null ? pctRow('حضور اليوم', d.pct) : row('fr-plain', 'حضور اليوم', '—');
    if (r === 'teacher') {
      return card('حلقاتي', [row('fr-plain', 'الطلاب المنتظمون', d.on.length), att, row(d.notYet ? 'fr-no' : 'fr-ok', 'لم يُسجَّل حضورهم اليوم', d.notYet)],
        [row('fr-info', 'تسميع اليوم', d.recT), row('fr-plain', 'غياب هذا الشهر', d.absM), ...(T.length ? [row('fr-info', 'بانتظار موافقة النقل', T.length)] : [])]);
    }
    if (r === 'supervisor') {
      /* غياب المعلمين هذا الشهر: المشرف يرى غياب معلمي حلقاته وحدهم (بالاسم، فسجل الغياب لا يحمل معرّف العضو)،
         والمدير العام ومن نطاقه «الكل» يرى غياب الجميع. كان المشرف يرى عدد المؤسسة كلها */
      const allScope = isGM() || me()?.info?.scope === 'all';
      const myT = new Set(d.H.map(h => byId(db.teachers || [], h.teacherId)?.name).filter(Boolean).map(n => norm(n)));
      const ab = ((db.payroll || {}).absences || []).filter(a => String(a.date || '').startsWith(d.mon) && (allScope || myT.has(norm(a.name || '')))).length;
      /* المدير العام: مربعات كما عند Admin («الحلقات» و«الطلاب» و«اليوم») على نطاقه (كل الحلقات) */
      if (allScope) {
        const D = dataDays(), cur = curDay(D), g = cur ? scopeData(cur) : d;
        const gatt = g.pct != null ? pctRow('حضور اليوم', g.pct) : row('fr-plain', 'حضور اليوم', '—');
        const offN = d.S.length - d.on.length, ids = new Set(d.H.map(h => h.teacherId).filter(Boolean)), sups = new Set(d.H.map(h => h.supervisorId).filter(Boolean));
        const tN = (db.teachers || []).filter(x => ids.has(x.id) && (x.admin || {}).status !== 'موقوف').length || ids.size;
        const b = (title, rows) => `<div class="card qdashcard qhomecnt"><h3 style="margin:0 0 .8rem">${esc(title)}</h3><div class="qfrow">${rows.join('')}</div></div>`;
        return `<div class="qhgrid">${b('الحلقات', [row('fr-plain', 'المعلمون', tN), row('fr-plain', 'المشرفون', Math.max(sups.size, (db.supervisors || []).length)), row('fr-plain', 'الحلقات', d.H.length), row('fr-plain', 'الأماكن', new Set(d.H.map(h => h.placeId).filter(Boolean)).size)])}
          ${b('الطلاب', [row('fr-ok', 'منتظمون', d.on.length), row(offN ? 'fr-no' : 'fr-plain', 'منقطعون', offN), row('fr-plain qsoon', 'برنامج الإتقان', '—')])}
          <div class="card qdashcard qhomecnt">${dayHead(D, cur)}<div class="qfrow">${[gatt, row(g.halDone < g.H.length ? 'fr-no' : 'fr-ok', 'حلقات سُجّل حضورها اليوم', `${g.halDone} من ${g.H.length}`), row('fr-info', 'تسميع اليوم', g.recT), row('fr-plain', 'غياب المعلمين هذا الشهر', ab), row(wait ? 'fr-no' : 'fr-ok', 'طلبات نقل بانتظار موافقتك', wait)].join('')}</div></div></div>`;
      }
      return card('حلقاتي', [row('fr-plain', 'الحلقات', d.H.length), row('fr-plain', 'الطلاب المنتظمون', d.on.length), att],
        [row(d.halDone < d.H.length ? 'fr-no' : 'fr-ok', 'حلقات سُجّل حضورها اليوم', `${d.halDone} من ${d.H.length}`), row('fr-info', 'تسميع اليوم', d.recT), row('fr-plain', 'غياب المعلمين هذا الشهر', ab), row(wait ? 'fr-no' : 'fr-ok', 'طلبات نقل بانتظار موافقتك', wait)]);
    }
    /* الإداري */
    const pl = new Set(d.H.map(h => h.placeId).filter(Boolean)).size;
    return card('نطاقي', [row('fr-plain', 'الأماكن', pl), row('fr-plain', 'الحلقات', d.H.length), row('fr-plain', 'الطلاب المنتظمون', d.on.length)],
      [att, row(d.halDone < d.H.length ? 'fr-no' : 'fr-ok', 'حلقات سُجّل حضورها اليوم', `${d.halDone} من ${d.H.length}`), row('fr-info', 'تسميع اليوم', d.recT), ...(T.length ? [row(wait ? 'fr-no' : 'fr-info', 'طلبات النقل', T.length)] : [])]);
  }

  /* ===== «الرئيسية» ===== */
  /* بطاقة «الاشتراكات» للمعلم والمشرف والإداري: على طلاب حلقاته وحدها (كما في «الطلاب»)، وما يظهر منها بحسب جدول عناصر صفحة الطلاب.
     (المحاسب في مربعه أعلاه، والمدير العام من delreq.js) */
  const staffFee = r => {
    if (!['teacher', 'supervisor', 'placeadmin'].includes(r) || (r === 'supervisor' && me()?.info?.scope === 'all')) return '';
    if (!window.QLFeeSummary || window.QLStuPerm?.can?.('sum') === false) return '';
    const V = window.QLStuView;
    return V?.scoped ? V.scoped(() => window.QLFeeSummary(db.students)) : '';
  };
  const homeView = r => { let c = ''; try { c = counters(r); } catch (e) { console.error('home counters:', e); } try { c += staffFee(r); } catch (e) { console.error('home fees:', e); } let L = ''; try { L = links(); } catch (e) { console.error('home links:', e); } return box(r) + L + c; };
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
      const SET = { 'المعلمون': ['المعلمون العاملون', (db.teachers || []).filter(x => (x.admin || {}).status !== 'موقوف').length], 'الطلاب': ['الطلاب المنتظمون', realStu().filter(x => !stOff(x)).length] };
      t.content.querySelectorAll('.qdashcard .feerow').forEach(f => { const sp = f.querySelector('span'), b = f.querySelector('b'), v = sp && SET[sp.textContent.trim()]; if (v && b) { sp.textContent = v[0]; b.textContent = v[1]; } });
      /* كل مجموعة عدادات في مربع: «الحلقات» (المعلمون والمشرفون والحلقات والأماكن)، و«الطلاب» (منتظمون ومنقطعون وبرنامج الإتقان)،
         و«اليوم» (حضور اليوم وتسجيلات الأسبوع كما كانت) */
      const old = [...t.content.children].find(c => c.classList.contains('qdashcard'));
      if (old) {
        const keep = l => [...old.querySelectorAll('.feerow')].find(f => f.querySelector('span')?.textContent.trim() === l)?.outerHTML || '';
        const box3 = (title, rows) => `<div class="card qdashcard qhomecnt"><h3 style="margin:0 0 .8rem">${esc(title)}</h3><div class="qfrow">${rows.join('')}</div></div>`;
        const offN = realStu().filter(x => stOff(x)).length;
        const grid = document.createElement('div'); grid.className = 'qhgrid';
        grid.innerHTML = box3('الحلقات', [row('fr-plain', 'المعلمون', SET['المعلمون'][1]), row('fr-plain', 'المشرفون', (db.supervisors || []).length), row('fr-plain', 'الحلقات', db.halaqat.length), row('fr-plain', 'الأماكن', db.places.length)])
          + box3('الطلاب', [row('fr-ok', 'منتظمون', SET['الطلاب'][1]), row(offN ? 'fr-no' : 'fr-plain', 'منقطعون', offN), row('fr-plain qsoon', 'برنامج الإتقان', '—')])
          + (() => { const D = dataDays(), cur = curDay(D), s = cur ? dayStats(cur) : { pct: null, week: 0 };
            return `<div class="card qdashcard qhomecnt">${dayHead(D, cur)}<div class="qfrow">${s.pct == null ? row('fr-plain', 'حضور اليوم', '—') : pctRow('حضور اليوم', s.pct)}${row('fr-plain', 'تسجيلات الأسبوع', s.week)}</div></div>`; })();
        old.replaceWith(grid);
      }
      let L = ''; try { L = links(); } catch (e) { console.error('home links:', e); }
      return box('admin') + L + t.innerHTML;
    };
  });

  /* ===== أزرار «الرئيسية» تحت الإعلانات =====
     يحددها المدير من «الإعدادات ← أزرار الرئيسية»: لكل زر نصه، والقسم، وقسم داخلي فيه (اختياري)، والفئات التي يظهر لها.
     تُحفظ في db.settings.home_links فتصل لكل الأجهزة، ولا يظهر لفئة زرٌّ لقسم ليس من أقسامها. */
  const HL_ROLES = [['admin', 'المدير'], ['gmanager', 'المدير العام'], ['supervisor', 'المشرف'], ['teacher', 'المعلم'], ['accountant', 'المحاسب'], ['placeadmin', 'الإداري'], ['student', 'الطالب']];
  const hlRoleOf = () => { const r = session?.role; if (r === 'supervisor' && (isGM() || me()?.info?.scope === 'all')) return 'gmanager'; return r || ''; };
  const hlTabsOf = rk => (TABS[rk === 'gmanager' ? 'supervisor' : rk] || []).map(t => t[0]);
  const hlList = () => (Array.isArray(db.settings?.home_links) ? db.settings.home_links : []);
  /* كل أقسام التطبيق (من قوائم كل الفئات) واسم كل منها */
  const hlAllTabs = () => { const M = new Map(); Object.values(TABS || {}).forEach(L => (L || []).forEach(([k, l]) => { if (!M.has(k) && k !== 'home' && k !== 'dash') M.set(k, l); })); return M; };
  /* الأقسام الداخلية: تُلتقط أسماؤها حين يُفتح القسم (أزرار شريطه)، فتُقترح عند إضافة زر */
  const HL_SUBS_KEY = 'qhl_subs';
  const subsSeen = () => { try { return JSON.parse(localStorage.getItem(HL_SUBS_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const clean = s => String(s || '').replace(/[\d٠-٩()]+/g, '').replace(/\s+/g, ' ').trim();
  const subButtons = () => [...document.querySelectorAll('main .subnav button, main .subnav a, main [data-act="msub"], main [role="tab"]')];
  new MutationObserver(() => {
    try {
      if (!ui?.tab || ui.tab === 'home' || ui.tab === 'dash') return;
      const labels = [...new Set(subButtons().map(b => clean(b.textContent)).filter(x => x && x.length < 40))];
      if (!labels.length) return;
      const S = subsSeen(), cur = new Set(S[ui.tab] || []); let n = cur.size; labels.forEach(l => cur.add(l));
      if (cur.size !== n) { S[ui.tab] = [...cur].slice(0, 40); try { localStorage.setItem(HL_SUBS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
    } catch (e) { /* ignore */ }
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  function links() {
    const rk = hlRoleOf(), mine = hlTabsOf(rk);
    const L = hlList().filter(x => x && x.tab && (x.roles || []).includes(rk) && mine.includes(x.tab));
    if (!L.length) return '';
    return `<div class="card qhlinks"><div class="qhl-grid">${L.map(x => `<button type="button" class="btn qhl-b" data-qhl="${esc(x.id)}">${esc(x.label || hlAllTabs().get(x.tab) || x.tab)}</button>`).join('')}</div></div>`;
  }
  /* الضغط: يفتح القسم، ثم القسم الداخلي إن حُدد (يُبحث عن زره في شريط القسم بعد رسمه) */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-qhl]'); if (!b) return;
    const x = hlList().find(y => y.id === b.dataset.qhl); if (!x) return;
    A.tab({ v: x.tab });
    if (!x.sub) return;
    const want = clean(x.sub);
    let tries = 0;
    const go = () => {
      const t = subButtons().find(el => clean(el.textContent) === want) || subButtons().find(el => clean(el.textContent).startsWith(want));
      if (t) { if (!t.classList.contains('on')) t.click(); return; }
      if (++tries < 15) setTimeout(go, 100); else toast(`لم أجد «${x.sub}» داخل القسم؛ عدّل الزر من الإعدادات`);
    };
    setTimeout(go, 50);
  });

  /* ===== «الإعدادات»: بطاقة إدارة الأزرار (للمدير) ===== */
  function hlForm(x) {
    const T = hlAllTabs(), isNew = !x;
    x = x || { id: uid(), label: '', tab: '', sub: '', roles: [] };
    const ov = document.createElement('div'); ov.className = 'overlay';
    const tabOpts = [...T].map(([k, l]) => `<option value="${esc(k)}" ${k === x.tab ? 'selected' : ''}>${esc(l)}</option>`).join('');
    ov.innerHTML = `<div class="modal"><h2>${isNew ? 'زر جديد في الرئيسية' : 'تعديل زر'}</h2>
      <label>القسم<select data-hl="tab"><option value="">— اختر —</option>${tabOpts}</select></label>
      <label>القسم الداخلي (اختياري)<input data-hl="sub" list="qhl-subs" value="${esc(x.sub || '')}" placeholder="مثل: الطلاب، كشف الشهر…"><datalist id="qhl-subs"></datalist></label>
      <p class="muted" style="font-size:.82rem;margin:-.3rem 0 .6rem">تظهر هنا اقتراحات أقسام القسم الداخلية بعد أن تفتحه مرة. اكتب الاسم كما يظهر على زره.</p>
      <label>نص الزر<input data-hl="label" value="${esc(x.label || '')}" placeholder="يُترك فارغًا فيُكتب اسم القسم"></label>
      <div class="lbl-s" style="margin:.4rem 0 .3rem">يظهر لـ</div>
      <div data-hl="roles" style="display:flex;flex-wrap:wrap;gap:.3rem .9rem">${HL_ROLES.map(([k, l]) => `<label class="chk" style="margin:0"><input type="checkbox" value="${k}" ${(x.roles || []).includes(k) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div>
      <p class="muted" data-hl="warn" style="font-size:.82rem;margin:.5rem 0 0"></p>
      <div class="row"><button type="button" class="btn primary" data-hl="save">حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const $ = s => ov.querySelector(`[data-hl="${s}"]`);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    /* عند اختيار القسم: اقتراحات أقسامه الداخلية، والفئات التي لها هذا القسم (الأخرى لن يظهر لها الزر) */
    const upd = (first) => {
      const tab = $('tab').value, S = subsSeen()[tab] || [];
      ov.querySelector('#qhl-subs').innerHTML = S.map(s => `<option value="${esc(s)}">`).join('');
      const has = HL_ROLES.filter(([k]) => hlTabsOf(k).includes(tab)).map(([k]) => k);
      $('roles').querySelectorAll('input').forEach(c => { const ok = has.includes(c.value); c.disabled = !!tab && !ok; if (!ok) c.checked = false; else if (first && isNew) c.checked = true; c.closest('label').style.opacity = c.disabled ? '.45' : ''; });
      $('warn').textContent = tab ? (has.length ? 'الفئات الباهتة ليس لها هذا القسم، فلا يظهر لها الزر.' : 'لا توجد فئة لها هذا القسم.') : '';
    };
    $('tab').onchange = () => upd(true); upd(false);
    $('save').onclick = () => {
      const tab = $('tab').value, roles = [...$('roles').querySelectorAll('input:checked')].map(c => c.value);
      if (!tab) { toast('اختر القسم'); return; }
      if (!roles.length) { toast('اختر فئة واحدة على الأقل'); return; }
      const y = { id: x.id, tab, sub: $('sub').value.trim(), label: $('label').value.trim(), roles };
      const L = hlList().slice(), i = L.findIndex(z => z.id === y.id);
      if (i >= 0) L[i] = y; else L.push(y);
      db.settings.home_links = L; save(); ov.remove(); render(); toast('حُفظ الزر');
    };
  }
  document.addEventListener('DOMContentLoaded', () => {
    const baseSettings = adminViews.settings;
    adminViews.settings = function () {
      const h = baseSettings.apply(this, arguments), T = hlAllTabs(), L = hlList();
      const rl = k => (HL_ROLES.find(r => r[0] === k) || [, k])[1];
      const rows = L.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.label || T.get(x.tab) || x.tab)}</b></td><td>${esc(T.get(x.tab) || x.tab)}${x.sub ? ` ← ${esc(x.sub)}` : ''}</td><td>${(x.roles || []).map(k => `<span class="tag">${esc(rl(k))}</span>`).join(' ')}</td>
        <td style="white-space:nowrap"><button type="button" class="btn sm" data-hle="${esc(x.id)}">تعديل</button><button type="button" class="btn sm" data-hlu="${esc(x.id)}" ${i ? '' : 'disabled'} title="لأعلى">↑</button><button type="button" class="btn sm danger" data-hld="${esc(x.id)}">حذف</button></td></tr>`).join('');
      return h + `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">أزرار الرئيسية</h2><button type="button" class="btn primary" data-hla>+ زر</button></div>
        <p class="muted" style="margin:.3rem 0 .7rem">أزرار تظهر في «الرئيسية» تحت الإعلانات، تفتح قسمًا أو قسمًا داخليًا فيه، ولكل زر الفئات التي يظهر لها.</p>
        ${L.length ? `<div class="tbl"><table><tr><th>#</th><th>الزر</th><th>يفتح</th><th>يظهر لـ</th><th></th></tr>${rows}</table></div>` : empty('لا توجد أزرار بعد.')}</div>`;
    };
  });
  document.addEventListener('click', e => {
    if (session?.role !== 'admin') return;
    if (e.target.closest('[data-hla]')) { hlForm(null); return; }
    const ed = e.target.closest('[data-hle]'); if (ed) { hlForm(hlList().find(x => x.id === ed.dataset.hle)); return; }
    const up = e.target.closest('[data-hlu]'); if (up) { const L = hlList().slice(), i = L.findIndex(x => x.id === up.dataset.hlu); if (i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; db.settings.home_links = L; save(); render(); } return; }
    const del = e.target.closest('[data-hld]'); if (del) { const x = hlList().find(y => y.id === del.dataset.hld); if (x) ask(`حذف زر «${x.label || hlAllTabs().get(x.tab) || x.tab}»؟`, () => { db.settings.home_links = hlList().filter(y => y.id !== x.id); save(); render(); }); }
  });

  const css = document.createElement('style');
  css.textContent = `.qhlinks{padding:.8rem}.qhl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.5rem}
    .qhl-b{justify-content:center;text-align:center;min-height:48px;white-space:normal;line-height:1.35;font-weight:700}
    .qnews.qn-imp{border-inline-start:4px solid #d9822b;background:#fdf3e6}
    .qnews.qn-urg{border-inline-start:4px solid var(--red,#b3372f);background:#fbeceb}
    .qnews.qn-old{opacity:.55}.qnews.qn-on{outline:2px solid var(--navy,#13294b);outline-offset:2px}
    .qn-tag{font-size:.75rem;margin-inline-end:.35rem}.qn-tag.qn-imp{background:#d9822b;color:#fff}.qn-tag.qn-urg{background:var(--red,#b3372f);color:#fff}
    .qnl{display:flex;align-items:center;gap:.5rem;width:100%;border:0;border-radius:10px;padding:.55rem .75rem;margin:0 0 .35rem;font:inherit;color:inherit;text-align:start;cursor:pointer;
      background:var(--navy-l,#eef1f6);border-inline-start:4px solid #b9c3d3}
    .qnl:hover{filter:brightness(.97)}.qnl.qn-imp{background:#fdf3e6;border-inline-start-color:#d9822b}.qnl.qn-urg{background:#fbeceb;border-inline-start-color:var(--red,#b3372f)}
    .qnl .qn-tag{flex:none;margin:0}.qnl .tag-ok{flex:none}
    .qnl-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .qnl-d{flex:none;color:var(--muted,#777);font-size:.8rem}
    @media (max-width:600px){.qnl-d{display:none}}
    .qhgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0 1rem;margin:0 0 1rem}.qhgrid>.card{margin:0 0 1rem}
    .qhgrid .qfrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.5rem}
    .qhgrid .qfpct{grid-column:1/-1}.feerow.qsoon{opacity:.6}
    .qdaysel{width:auto;max-width:100%;margin:0;font-weight:800;font-size:1.05rem}`;
  document.head.appendChild(css);
})();
