'use strict';
/* ============ «الكراسة» و«سجل الإنجاز» ============
   - «سجل الإنجاز» (data-act="hist"): تسجيلات الطالب (historyTable)، والدرجة أو «تأكيد» بجانب كل حفظ ومراجعة.
   - «الكراسة»: زر مستقل في صف الطالب (قبل «الاختبارات») يفتح نافذتها،
     لمن يسجّل التسميع: المدير ومعلم الحلقة ومشرفها (كقاعدة الخادم records_write):
       1) تقدير الحصة السابقة: آخر حفظ وآخر مراجعة قبل اليوم، يُختار لكل منهما تقديره فيظهر في «السجل» بجانبه.
       2) منهج الحصة الحالية: الحفظ والمراجعة (السورة، ومن آية إلى آية؛ «من» فارغة = 1، و«إلى» فارغة = آخر السورة)،
          يُسجَّلان تسميعَي «حفظ» و«مراجعة» بتاريخ اليوم بلا تقدير، حتى يُقدَّرا في الحصة التالية. ومنهج اليوم المسجّل يُفتح للتعديل.
       3) ملاحظات (اختياري) تُحفظ مع منهج اليوم.
   الحفظ في db.records نفسه (المزامنة كالتسميع). يُحمَّل بعد uix.js (يحل محل نافذة السجل البسيطة).
   والكراسة بديل زر «تسجيل تسميع»: الزر مخفي في كل مكان، واستدعاؤه يفتح الكراسة. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./kurrasa.js')) VFILES.push('./kurrasa.js'); } catch (e) { /* ignore */ } });
  const HIST = 'سجل الإنجاز';
  const KT = [['حفظ', 'الحفظ'], ['مراجعة', 'المراجعة']];

  const stOf = id => byId(db.students || [], id);
  const halOf = st => st && byId(db.halaqat || [], st.halaqaId);
  /* من يكتب في الكراسة: كقاعدة الخادم لتسجيل التسميع (المدير، ومعلم الحلقة، ومشرفها) */
  function canWrite(st) {
    if (!session || !st) return false;
    if (session.role === 'admin') return true;
    const h = halOf(st);
    return !!h && (h.teacherId === session.id || h.supervisorId === session.id);
  }
  const recs = sid => (db.records || []).filter(r => r.studentId === sid);
  /* الحصة السابقة: آخر تاريخ قبل اليوم فيه حفظ أو مراجعة، وآخر تسجيل من كل نوع فيه */
  function prevSession(sid) {
    const t = today(), R = recs(sid).filter(r => r.date < t && (r.type === 'حفظ' || r.type === 'مراجعة'));
    if (!R.length) return null;
    const d = R.reduce((a, r) => (r.date > a ? r.date : a), '');
    const out = { date: d };
    KT.forEach(([k]) => { const L = R.filter(r => r.date === d && r.type === k); if (L.length) out[k] = L[L.length - 1]; });
    return out;
  }
  const todayRec = (sid, k) => { const L = recs(sid).filter(r => r.date === today() && r.type === k); return L[L.length - 1] || null; };
  const place = r => `سورة ${SURAHS[r.surah - 1]?.[0] || ''} (${r.from}–${r.to})`;

  /* ===== النوافذ: «سجل الإنجاز» (السجل وحده)، و«الكراسة» نافذة مستقلة من زرها في صف الطالب ===== */
  const nameOf = sid => stOf(sid)?.name || (typeof sName === 'function' ? sName(sid) : '');
  function open(sid) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qkwin"><h2>${HIST}: ${esc(nameOf(sid))}</h2><div class="qkpane">${historyTable(sid)}</div></div>`;
    document.body.appendChild(ov);
  }
  function openBook(sid) {
    const st = stOf(sid); if (!canWrite(st)) { open(sid); return; }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qkwin"><h2>الكراسة: ${esc(nameOf(sid))}</h2><div class="qkpane"></div></div>`;
    document.body.appendChild(ov);
    book(ov.querySelector('.qkpane'), st, () => ov.remove());
  }
  /* زر «الكراسة» في صف الطالب (قبل «الاختبارات»، وإلا قبل «سجل الإنجاز») لمن يكتب فيها */
  const BOOK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3"/><path d="M9 7.5h6M9 11h6"/></svg>';
  let raf = 0;
  function paint() {
    raf = 0;
    document.querySelectorAll('main [data-act="hist"][data-id]').forEach(h => {
      const st = stOf(h.dataset.id), btn = `<button type="button" class="btn sm qri" data-qkbook="${esc(st?.id || '')}" title="الكراسة" aria-label="الكراسة">${BOOK}</button>`;
      /* «الدفتر» على الهاتف: الأزرار في «خيارات» (⋮)، والكراسة خارجها على يمينه */
      const acts = h.closest('.qatt-acts');
      if (acts) { if (!acts.querySelector('[data-qkbook]') && canWrite(st)) acts.insertAdjacentHTML('afterbegin', btn); return; }
      const box = h.parentElement; if (!box || box.querySelector('[data-qkbook]') || !canWrite(st)) return;
      (box.querySelector(':scope > [data-qtest]') || h).insertAdjacentHTML('beforebegin', btn);
    });
    /* «الاختبارات» أُضيف بعد «الكراسة» في صفوف الجداول: تبقى الكراسة قبله */
    document.querySelectorAll('main [data-qkbook]').forEach(b => { if (b.parentElement.classList.contains('qatt-acts')) return; const t = b.parentElement.querySelector(':scope > [data-qtest]'); if (t && b.nextElementSibling !== t) t.before(b); });
  }
  new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(paint); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => { const b = e.target.closest('[data-qkbook]'); if (b) { e.preventDefault(); openBook(b.dataset.qkbook); } });

  /* ===== «الكراسة» ===== */
  /* الدرجة رقمًا (من 0 إلى GMAX) بدل التقديرات؛ والتقدير القديم المكتوب كلمة يبقى ظاهرًا في السجل كما هو */
  const GMAX = 10;
  /* أو «تأكيد» (بدل «يعاد»): يحتاج الطالب تثبيت ما حفظ؛ اختيارها يُفرغ خانة الدرجة، وكتابة درجة تلغيها */
  const CONF = 'تأكيد';
  const gradeBox = (name, cur) => {
    const conf = cur === CONF || cur === 'يعاد', n = cur !== '' && cur != null && !isNaN(+cur) ? +cur : '';
    return `<span class="qkg"><input type="number" inputmode="decimal" name="${name}" min="0" max="${GMAX}" step="0.25" value="${n}" placeholder="الدرجة" aria-label="الدرجة"><span class="muted">/ ${GMAX}</span>
      <span class="muted qkor">أو</span><label class="chip-r chip-t qkconf"><input type="checkbox" name="c_${name}" ${conf ? 'checked' : ''}><span>${CONF}</span></label>
      ${cur && isNaN(+cur) && !conf ? `<small class="muted">(كانت: ${esc(cur)})</small>` : ''}</span>`;
  };
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayDate = d => { const x = new Date(String(d) + 'T00:00:00'); return `${isNaN(x) ? '' : DAYS[x.getDay()] + ' '}<bdi>${esc(d)}</bdi>`; };
  const surOpts = cur => `<option value="">— السورة —</option>${SURAHS.map(([n, c], i) => `<option value="${i + 1}" ${+cur === i + 1 ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
  function book(pane, st, done) {
    const sid = st.id, P = prevSession(sid);
    const prevHTML = !P ? '<p class="muted">لا توجد حصة سابقة فيها حفظ أو مراجعة.</p>'
      : `<p class="muted qkdate">الحصة السابقة: ${dayDate(P.date)}</p>` + KT.map(([k, l]) => P[k]
        ? `<div class="qkprev"><div class="qkh"><b>${l}</b><span class="muted">${esc(place(P[k]))}</span>${gradeBox('g_' + k, P[k].grade || '')}</div></div>`
        : `<div class="qkprev"><div class="qkh"><b>${l}</b><span class="muted">لم يُسجَّل في تلك الحصة</span></div></div>`).join('');
    const curHTML = KT.map(([k, l]) => {
      const r = todayRec(sid, k) || {};
      return `<div class="qkman" data-k="${k}"><b class="qkml">${l}</b>
        <div class="qkmrow"><select name="s_${k}" aria-label="سورة ${l}">${surOpts(r.surah)}</select>
          <span class="qkay"><span class="muted">من</span><input type="number" inputmode="numeric" name="f_${k}" min="1" step="1" placeholder="1" value="${r.from ?? ''}" aria-label="${l}: من آية"></span>
          <span class="qkay"><span class="muted">إلى</span><input type="number" inputmode="numeric" name="t_${k}" min="1" step="1" placeholder="آخر" value="${r.to ?? ''}" aria-label="${l}: إلى آية"></span></div></div>`;
    }).join('');
    const note0 = (todayRec(sid, 'حفظ') || todayRec(sid, 'مراجعة') || {}).note || '';
    pane.innerHTML = `<div class="qkbook">
      <fieldset class="tfs"><legend>تقدير الحصة السابقة</legend>${prevHTML}</fieldset>
      <fieldset class="tfs"><legend>منهج الحصة الحالية</legend><p class="muted qkdate">حصة اليوم: ${dayDate(today())}</p>${curHTML}
        <p class="muted qkhint">«من» فارغة = الآية 1، و«إلى» فارغة = آخر السورة.</p></fieldset>
      <label>ملاحظات <span class="muted">(اختياري)</span><textarea name="note" rows="2" maxlength="500">${esc(note0)}</textarea></label>
      <div class="row"><button type="button" class="btn primary" data-qksave>حفظ الكراسة</button></div></div>`;
    const B = pane.querySelector('.qkbook');
    /* الدرجة و«تأكيد» لا يجتمعان */
    B.addEventListener('change', e => {
      const t = e.target, g = t.closest('.qkg'); if (!g) return;
      if (t.type === 'checkbox' && t.checked) g.querySelector('input[type=number]').value = '';
    });
    B.addEventListener('input', e => { const t = e.target, g = t.closest('.qkg'); if (g && t.type === 'number' && t.value !== '') { const c = g.querySelector('input[type=checkbox]'); if (c) c.checked = false; } });
    B.querySelector('[data-qksave]').onclick = () => {
      const v = n => (B.querySelector(`[name="${n}"]`)?.value || '').trim();
      const conf = k => !!B.querySelector(`[name="c_g_${k}"]`)?.checked;
      /* درجات الحصة السابقة: رقم من 0 إلى GMAX أو «تأكيد»، والفارغ لا يغيّر شيئًا */
      for (const [k, l] of KT) {
        const g = v('g_' + k); if (!g || conf(k)) continue;
        const x = +g; if (!Number.isFinite(x) || x < 0 || x > GMAX) { toast(`درجة ${l} من 0 إلى ${GMAX}`); B.querySelector(`[name="g_${k}"]`).focus(); return; }
      }
      /* منهج اليوم: يُتحقق منه كله قبل أي حفظ */
      const plan = [];
      for (const [k, l] of KT) {
        const s = +v('s_' + k), f0 = v('f_' + k), t0 = v('t_' + k);
        if (!s) { if (f0 || t0) { toast(`اختر سورة ${l}`); B.querySelector(`[name="s_${k}"]`).focus(); return; } plan.push([k, null]); continue; }
        const n = SURAHS[s - 1][1], f = f0 ? Math.round(+f0) : 1, t = t0 ? Math.round(+t0) : n;
        if (!(f >= 1 && f <= n) || !(t >= 1 && t <= n)) { toast(`${l}: سورة ${SURAHS[s - 1][0]} آياتها من 1 إلى ${n}`); return; }
        if (f > t) { toast(`${l}: آية «من» قبل آية «إلى»`); B.querySelector(`[name="f_${k}"]`).focus(); return; }
        plan.push([k, { surah: s, from: f, to: t }]);
      }
      const note = v('note');
      if (note && plan.every(([, p]) => !p) && !todayRec(sid, 'حفظ') && !todayRec(sid, 'مراجعة')) { toast('اكتب منهج الحصة لتُحفظ معه الملاحظات'); return; }
      let n = 0;
      /* 1) تقدير الحصة السابقة */
      if (P) KT.forEach(([k]) => {
        if (!P[k]) return;
        const g0 = v('g_' + k);
        let g;
        if (conf(k)) g = CONF;
        else if (g0) g = String(Math.round(+g0 * 100) / 100);
        else if (P[k].grade === CONF || P[k].grade === 'يعاد') g = '';   // أُلغي «تأكيد» بلا درجة
        else return;   // فارغ: تبقى درجته كما هي
        if ((P[k].grade || '') !== g) { P[k].grade = g; n++; }
      });
      /* 2) منهج اليوم (ومعه الملاحظات على أول تسجيل منه) */
      let noted = false;
      plan.forEach(([k, p]) => {
        const r = todayRec(sid, k);
        if (!p) { if (r && !r.grade) { db.records = db.records.filter(x => x !== r); n++; } return; }   // مُسح منهج اليوم: يُحذف تسجيله غير المقدَّر
        const nt = noted ? (r?.note || '') : note; noted = true;
        if (r) { if (r.surah !== p.surah || r.from !== p.from || r.to !== p.to || (r.note || '') !== nt) { Object.assign(r, p, { note: nt }); n++; } }
        else { db.records.push({ id: uid(), studentId: sid, date: today(), type: k, surah: p.surah, from: p.from, to: p.to, grade: '', note: nt }); n++; }
      });
      if (!n) { toast('لا تغيير'); return; }
      save(); done(); try { render(); } catch (e) { /* ignore */ }
      toast('حُفظت الكراسة');
    };
  }

  /* زر «سجل الإنجاز» في كل مكان يفتح هذه النافذة (uix.js كان يضع النافذة البسيطة) */
  /* «الكراسة» بديل «تسجيل تسميع»: زره (data-act="rec") مخفي في كل مكان، وما يستدعيه يفتح الكراسة */
  document.addEventListener('DOMContentLoaded', () => {
    try { A.hist = d => open(d.id); } catch (e) { /* ignore */ }
    try { A.rec = d => openBook(d.id); } catch (e) { /* ignore */ }
  });
  window.QLKurrasa = { open, openBook, canWrite };

  /* ===== «سجل الإنجاز» الموحّد: تسجيلات الكراسة والتسميع، والاختبارات المتنوعة (متابعة · إتقان · الفصول)، بترتيب الأيام =====
     التسميع يظهر فورًا، والاختبارات تُجلب بعده (test_list؛ والطالب يقرأ اختباراته بعد tests.sql) ثم يُعاد ترتيب الكل */
  const TC = new Map();   // معرّف الطالب ← { at, list }
  const recEntry = r => ({ date: r.date, ts: r.ts || '', type: r.type, place: `سورة ${SURAHS[r.surah - 1]?.[0] || ''} (${r.from}–${r.to})`, grade: r.grade || '', note: r.note || '', test: false });
  const testEntry = t => { const s = window.QLTests?.summary?.(t) || {}; return { date: String(t.date || '').slice(0, 10), ts: t.ts || '', type: s.type || 'اختبار', place: s.place || '', grade: s.grade || '', note: s.note || '', test: true, ok: s.ok, bad: s.bad }; };
  function entries(sid) {
    /* الوضع المحلي: الاختبارات من الجهاز مباشرة (بلا انتظار)؛ ومع الخادم من آخر جلب */
    const src = typeof CLOUD !== 'undefined' && CLOUD ? (TC.get(sid)?.list || []) : (db.tests || []).filter(t => t.studentId === sid);
    const T = src.map(testEntry);
    return [...recs(sid).map(recEntry), ...T].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (a.test === b.test ? 0 : a.test ? -1 : 1));
  }
  async function loadTests(sid) {
    if (!(typeof CLOUD !== 'undefined' && CLOUD)) return false;   // محلي: entries يقرؤها مباشرة
    const c = TC.get(sid); if (c && Date.now() - c.at < 60000) return false;
    let list = [];
    try {
      const st = stOf(sid) || { id: sid, name: '' };
      list = window.QLTests?.listOf ? await window.QLTests.listOf(st) : [];
    } catch (e) { list = c?.list || []; }
    TC.set(sid, { at: Date.now(), list });
    return true;
  }
  const typeTag = e => `<span class="tag ${e.test ? 'qktest' : ''} ${e.ok ? 'tag-ok' : e.bad ? 'tag-no' : ''}">${esc(e.type)}</span>`;
  function logTable(sid) {
    const E = entries(sid);
    if (!E.length) return empty('لا توجد تسجيلات بعد.');
    return `<div class="tbl"><table><tr><th>التاريخ</th><th>النوع</th><th>الموضع</th><th>الدرجة</th><th>ملاحظة</th></tr>${E.map(e => `<tr><td>${esc(typeof dayOf === 'function' ? dayOf(e.date) : '')} <bdi>${esc(e.date)}</bdi></td><td>${typeTag(e)}</td><td>${esc(e.place)}</td><td>${esc(e.grade)}</td><td>${esc(e.note)}</td></tr>`).join('')}</table></div>`;
  }
  /* يحل محل historyTable (app.js) في كل مكان: نافذة «سجل الإنجاز» وصفحة الطالب */
  try { historyTable = sid => `<div class="qklog" data-qklog="${esc(sid)}">${logTable(sid)}</div>`; } catch (e) { /* ignore */ }
  let lraf = 0;
  function fillLogs() {
    lraf = 0;
    document.querySelectorAll('[data-qklog]:not([data-qkdone])').forEach(async box => {
      box.dataset.qkdone = '1';
      const sid = box.dataset.qklog;
      if (await loadTests(sid) && box.isConnected) { box.innerHTML = logTable(sid); }
      document.querySelectorAll(`[data-qklast="${CSS.escape(sid)}"]`).forEach(x => { x.outerHTML = lastHTML(sid); });
    });
    document.querySelectorAll('[data-qklast]:not([data-qkdone])').forEach(async box => {
      box.dataset.qkdone = '1';
      const sid = box.dataset.qklast;
      if (await loadTests(sid) && box.isConnected) box.outerHTML = lastHTML(sid);
    });
  }
  new MutationObserver(() => { if (!lraf) lraf = requestAnimationFrame(fillLogs); }).observe(document.body, { childList: true, subtree: true });
  /* آخر محتويات السجل (للرئيسية): خمسة أسطر مختصرة */
  function lastHTML(sid) {
    const E = entries(sid).slice(0, 5);
    return `<div class="qklast" data-qklast="${esc(sid)}" data-qkdone="1">${E.length ? E.map(e => `<div class="qkli"><span class="qklid">${esc(typeof dayOf === 'function' ? dayOf(e.date) : '')} <bdi>${esc(e.date)}</bdi></span>${typeTag(e)}<span class="qklip">${esc(e.place)}</span>${e.grade ? `<b class="qklig">${esc(e.grade)}</b>` : ''}</div>`).join('') : empty('لا توجد تسجيلات بعد.')}</div>`;
  }

  /* ===== «الرئيسية» للطالب (ومحتويات «تقدمي» فيها؛ والتبويب أُزيل): البيانات، ثم الإشعارات، ثم العدادات، ثم آخر السجل ===== */
  try { const i = TABS.student.findIndex(t => t[0] === 'me'); if (i > -1) TABS.student.splice(i, 1); } catch (e) { /* ignore */ }
  function stuHome(baseHtml) {
    const s = stOf(session.id); if (!s) return baseHtml;
    const h = byId(db.halaqat || [], s.halaqaId);
    const info = `<div class="card qshome"><h2>أهلًا ${esc(s.name)}</h2><div class="qsinfo">
      ${h ? `<span><small>الحلقة</small><b>${esc(hName(s.halaqaId))}</b></span><span><small>المكان</small><b>${esc(placeName(h) || '—')}</b></span>${timeText(h) ? `<span><small>الوقت</small><b>${esc(timeText(h))}</b></span>` : ''}<span><small>المعلم</small><b>${esc(tName(h.teacherId))}</b></span>` : '<span class="muted">لم تُحدَّد حلقتك بعد.</span>'}</div>
      ${(db.fields?.students || []).filter(f => (s.extra || {})[f.key]).map(f => `<div class="qsinfo"><span><small>${esc(f.label)}</small><b>${esc(s.extra[f.key])}</b></span></div>`).join('')}</div>`;
    /* الإشعارات من «الرئيسية» الأصلية (home.js، وفيها سطر «الحصة» أولًا)، بلا مربع عداداتها القديم */
    const t = document.createElement('template'); t.innerHTML = baseHtml; t.content.querySelectorAll('.qhomecnt').forEach(x => x.remove());
    /* العدادات: حضور الشهر وغيابه، وآخر حفظ (طويل فيأخذ سطرًا وحده) */
    const mon = today().slice(0, 7), att = new Map(); (db.attendance || []).forEach(a => { if (a.studentId === s.id && String(a.date).startsWith(mon)) att.set(a.date, a); });
    const A = [...att.values()], ok = A.filter(a => a.status === 'present' || a.status === 'late').length, abs = A.filter(a => a.status === 'absent').length;
    let last = '—'; try { last = lastHifz(s.id) || '—'; } catch (e) { /* ignore */ }
    const pct = A.length ? Math.round(ok / A.length * 100) : null;
    const cnt = `<div class="card qscnt"><h3>هذا الشهر</h3><div class="qfrow">
      <div class="feerow fr-ok qfpct"><span>نسبة الحضور</span>${pct == null ? '<b>—</b>' : `<span class="qfbar" aria-hidden="true"><span style="width:${pct}%"></span></span><b>${pct}%</b>`}</div>
      <div class="feerow ${abs ? 'fr-no' : 'fr-ok'}"><span>أيام الغياب</span><b>${abs}</b></div>
      <div class="feerow fr-info qfwide"><span>آخر حفظ</span><b>${esc(last)}</b></div></div></div>`;
    const recent = `<div class="card"><div class="bar" style="margin:0 0 .5rem"><h3 class="grow" style="margin:0">آخر الإنجاز</h3><button type="button" class="btn sm" data-qkallhist>السجل كاملًا</button></div>${lastHTML(s.id).replace('data-qkdone="1"', '')}</div>`;
    return info + t.innerHTML + cnt + recent;
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-qkallhist]') && session?.role === 'student') { ui.tab = 'hist'; render(); window.scrollTo(0, 0); } });

  /* ===== الطالب: «منهج اليوم» بلون أحمر في «الإشعارات» وأعلى «سجل الإنجاز» =====
     آخر منهج كتبه المعلم ولم يُقدَّر بعد (حفظ ومراجعة بلا درجة، بتاريخ اليوم أو قبله)، ومعه ملاحظته */
  const dueOf = sid => {
    const t = today(), R = recs(sid).filter(r => (r.type === 'حفظ' || r.type === 'مراجعة') && !r.grade && r.date <= t);
    if (!R.length) return null;
    const d = R.reduce((a, r) => (r.date > a ? r.date : a), '');
    return { d, t, L: R.filter(r => r.date === d) };
  };
  const short = r => `${esc(SURAHS[r.surah - 1]?.[0] || '')} <span class="qkrng" dir="ltr">(${r.from} - ${r.to})</span>`;
  /* سطر أول في مربع الإشعارات في «الرئيسية»: «منهج اليوم: الحفظ: الملك (1 - 10) · المراجعة: …»؛ والضغط يفتح «سجل الإنجاز» */
  function dueLine(sid) {
    const D = dueOf(sid); if (!D) return '';
    const parts = KT.map(([k, l]) => { const r = D.L.filter(x => x.type === k).pop(); return r ? `<b>${l}:</b> ${short(r)}` : ''; }).filter(Boolean).join(' · ');
    return `<button type="button" class="qnl qkdueline" data-qkdue><span class="qkdt">الحصة</span><span class="qnl-t">${parts}</span></button>`;
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-qkdue]') && session?.role === 'student') { ui.tab = 'hist'; render(); window.scrollTo(0, 0); } });
  function dueCard(sid) {
    const D = dueOf(sid); if (!D) return '';
    const { d, t, L } = D;
    /* مختصر: «الحفظ: الملك (1 - 10)» */
    const line = ([k, l]) => { const r = L.filter(x => x.type === k).pop(); return r ? `<div class="qkdl"><b>${l}:</b><span>${short(r)}</span></div>` : ''; };
    const note = L.map(r => r.note).filter(Boolean)[0] || '';
    return `<div class="card qkdue"><h2>${d === t ? 'منهج اليوم' : 'المنهج المطلوب'} <small>${dayDate(d)}</small></h2>
      ${KT.map(line).join('')}${note ? `<div class="qkdl qkdn"><b>ملاحظات:</b><span>${esc(note)}</span></div>` : ''}</div>`;
  }
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const wrap = k => { const base = studentViews[k]; if (typeof base !== 'function') return; studentViews[k] = function () { const h = base.apply(this, arguments); return session?.role === 'student' ? dueCard(session.id) + h : h; }; };
      wrap('news'); wrap('hist');
      /* «الرئيسية» (home.js): منهج اليوم أول سطر في مربع الإشعارات */
      const baseHome = studentViews.home;
      if (typeof baseHome === 'function') studentViews.home = function () {
        const h = baseHome.apply(this, arguments); if (session?.role !== 'student' || typeof h !== 'string') return h;
        const l = dueLine(session.id);
        let out = !l ? h : h.replace(/(<div class="card qnhome"><div class="bar"[^>]*>[\s\S]*?<\/div>)/, `$1${l}`);
        if (l && out === h) out = `<div class="card qnhome">${l}</div>` + h;
        try { return stuHome(out); } catch (e) { console.error('stuHome:', e); return out; }
      };
    } catch (e) { /* ignore */ }
  });

  const css = document.createElement('style');
  css.textContent = `[data-act="rec"]:not(#qz0):not(#qz1):not(#qz2):not(#qz3){display:none!important}
    .qkwin{max-width:720px}
    .qktabs{display:flex;gap:.35rem;margin:0 0 .7rem}
    .qkbook .tfs{margin-bottom:.8rem}.qkdate{font-size:.85rem;margin:0 0 .4rem}
    .qkprev{padding:.4rem 0}.qkprev + .qkprev{border-top:1px dashed var(--line)}
    .qkh{display:flex;align-items:baseline;gap:.4rem .7rem;flex-wrap:wrap;margin:0 0 .35rem}.qkh .muted{font-size:.88rem}
    .qkg{display:inline-flex;align-items:center;flex-wrap:wrap;gap:.35rem .45rem;margin-inline-start:auto}.qkg input[type=number]{width:5.5rem;margin:0;text-align:center;font-weight:700}.qkg small{font-size:.75rem}
    .qkor{font-size:.82rem}.qkconf{margin:0}.qkconf span{padding:.25rem .8rem}
    .qkconf input:checked + span{border-color:var(--amber,#c9822b)!important;color:var(--amber,#c9822b)!important}
    .qkman{padding:.35rem 0}.qkman + .qkman{border-top:1px dashed var(--line)}.qkml{display:block;margin:0 0 .3rem}
    /* السورة ومن وإلى في سطر واحد كلما اتسع، وإلا تنزل الآيتان معًا تحتها */
    .qkmrow{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.qkmrow select{flex:1 1 7.5rem;min-width:7.5rem;width:auto;margin:0}
    .qkay{display:inline-flex;align-items:center;gap:.3rem;flex:0 0 auto}.qkay .muted{font-size:.82rem;white-space:nowrap}
    .qkay input{width:3.8rem;min-width:0;margin:0;padding-inline:.3rem!important;text-align:center}
    .qkhint{font-size:.8rem;margin:.3rem 0 0}
    .qkdue{border:2px solid #c0392b!important;background:color-mix(in srgb,#c0392b 10%,var(--card,#fff))!important}
    .qkdue h2{color:#c0392b;margin:0 0 .5rem;display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}.qkdue h2 small{font-size:.85rem;font-weight:600;color:inherit;opacity:.85}
    html.qdark .qkdue h2{color:#ff8a7a}html.qdark .qkdue{border-color:#e06a5b!important}
    .qkdl{display:flex;gap:.7rem;padding:.35rem 0;border-top:1px solid color-mix(in srgb,#c0392b 25%,transparent);line-height:1.6}.qkdl:first-of-type{border-top:0}
    .qkdueline:not(#qz0){border:1.5px solid #c0392b!important;background:color-mix(in srgb,#c0392b 10%,transparent)!important;color:var(--text)!important;display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;text-align:start}
    .qkdueline .qkdt{flex:none;font-weight:800;font-size:.82rem;color:#fff;background:#c0392b;border-radius:999px;padding:.1rem .7rem;line-height:1.6}html.qdark .qkdueline b{color:#ff8a7a}
    .qkdueline .qnl-t{font-weight:600;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;-webkit-line-clamp:unset!important;display:block!important;line-height:1.7}.qkdueline b{color:#c0392b;font-weight:800}
    .qkrng{display:inline-block;direction:ltr!important;unicode-bidi:isolate!important}
    /* رئيسية الطالب */
    .qshome h2{margin:0 0 .6rem}.qsinfo{display:flex;flex-wrap:wrap;gap:.5rem}.qsinfo + .qsinfo{margin-top:.5rem}
    .qsinfo > span{display:flex;flex-direction:column;gap:.1rem;padding:.4rem .7rem;border-radius:10px;background:var(--navy-l,#eef1f6);min-width:0}
    html.qdark .qsinfo > span{background:color-mix(in srgb,var(--navy) 28%,#141c28)}
    .qsinfo small{color:var(--muted);font-size:.75rem}.qsinfo b{font-size:.9rem}
    .qscnt h3{margin:0 0 .7rem}.qscnt .qfrow{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))!important;gap:.5rem!important}
    .qscnt .feerow.qfwide,.qscnt .feerow.qfpct{grid-column:1/-1}
    .qklast{display:flex;flex-direction:column}
    .qkli{display:flex;align-items:center;gap:.35rem .6rem;flex-wrap:wrap;padding:.45rem 0;border-top:1px solid var(--line)}.qkli:first-child{border-top:0}
    .qklid{font-size:.8rem;color:var(--muted);flex:0 0 auto}.qklip{flex:1 1 8rem;min-width:0;font-weight:600}.qklig{flex:none;font-size:.85rem}
    .tag.qktest:not(.tag-ok):not(.tag-no){background:color-mix(in srgb,#7b5cc4 18%,transparent);color:#7b5cc4}html.qdark .tag.qktest:not(.tag-ok):not(.tag-no){color:#b9a3f0}
    .qkdl b{flex:0 0 auto;color:#c0392b}html.qdark .qkdl b{color:#ff8a7a}.qkdl span{flex:1;min-width:0;font-weight:700}.qkdn span{font-weight:500}
`;
  document.head.appendChild(css);
})();
