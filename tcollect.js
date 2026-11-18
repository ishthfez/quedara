'use strict';
/* ============ كشوف التحصيل: جانب المعلم والإداري ============
   زر «تحصيل» في صف أدوات صفحة «الطلاب» (بجانب «الحضور») يفتح نافذة فيها طلاب حلقات الجامع ومستحق كل منهم،
   وأمام كل طالب «تحصيل الاشتراك»: نافذة التحصيل نفسها التي عند المحاسب (المبلغ، الشهر، التاريخ، الملاحظة، وسبب المبلغ الأقل).
   ما يُحصَّل يدخل «الكشف الحالي» (مسودة على الخادم)، ثم «مراجعة وإرسال» يعرض الأسماء والمبالغ والإجمالي ويرسله للمحاسب.
   الزر أخضر إن كان للطالب تحصيل عن الشهر الحالي (في الكشف أو عند المحاسب أو مؤكَّد، أو دفعة مسجّلة)، وعادي إن كان لشهر سابق.
   ما أعاده المحاسب يعود إلى الكشف الحالي بالأحمر وملاحظته، فيُصحَّح ويُرسل من جديد.
   الضغط مرة أخرى على «تحصيل الاشتراك» لطالب في الكشف الحالي يسأل (نافذة تأكيد) ثم يلغي تحصيله منه؛
   وما أُرسل للمحاسب أو حصّله لا يُلغى من هنا (الزر عندئذ يفتح التحصيل لشهر آخر).
   - الخادم: supabase/cnotices.sql (cn_add / cn_remove / cn_send / cn_list). بلا خادم (نسخة العرض): القاعدة نفسها على الجهاز في db.cnotices.
   - المحاسب والمدير: زر «كشوف» في صف الأدوات نفسه، وعليه عدد الكشوف المنتظرة. يفتح نافذة بتبويبين:
     «الكشوف»: كل كشف رسالة (الجامع وتاريخه، ثم الأسماء والشهر والمبلغ والإجمالي)، وأمام كل اسم «تم التحصيل» فيصير أخضر باهتًا ✓
     أو «إعادة» بملاحظة (cn_mark، يُحفظ فورًا ويمكن التراجع عنه)، ثم «تم تحصيل المبلغ» حين تُراجع الأسماء كلها (cn_finish) فينتقل إلى السجل.
     «السجل»: الكشوف المنتهية، والقوائم القديمة (collect.js) ومنها ما ينتظر المراجعة.
   - حلّت هذه محل الصفحات القديمة: «التحصيل» عند المعلم والإداري، و«تحصيل المعلمين» عند المحاسب والمدير (تبويبها وشريط تبويبات «الطلاب»). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./tcollect.js')) VFILES.push('./tcollect.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const money = n => NF.format(Math.round((+n || 0) * 100) / 100);
  const ym = () => { const t = today(); return [+t.slice(0, 4), +t.slice(5, 7)]; };
  const myName = () => (typeof me === 'function' && me()?.name) || '';
  const ROLES = ['teacher', 'placeadmin'];
  const canCol = () => !!session && ROLES.includes(session.role) && (!window.QLStuPerm || window.QLStuPerm.can('colbtn'));

  /* ===== الخادم، أو القاعدة نفسها على الجهاز بلا خادم ===== */
  const L = () => (Array.isArray(db.cnotices) ? db.cnotices : (db.cnotices = []));
  const news = (aud, text) => db.news.push({ id: uid(), text, audience: aud, date: today(), author: myName(), authorId: session.id });
  const local = {
    list(kind) {
      const all = L().slice().sort((a, b) => String(b.reviewedAt || b.sentAt || b.createdAt).localeCompare(String(a.reviewedAt || a.sentAt || a.createdAt)));
      if (kind === 'mine') return all.filter(n => n.collectorId === session.id);
      if (kind === 'inbox') return all.filter(n => n.status === 'sent');
      if (kind === 'log') return all.filter(n => n.status === 'done');
      return [];
    },
    draft(create) {
      let d = L().find(n => n.collectorId === session.id && n.status === 'draft');
      if (!d && create) { d = { id: uid(), collectorId: session.id, collectorName: myName(), status: 'draft', lines: [], accNote: '', createdAt: new Date().toISOString() }; L().push(d); }
      return d;
    },
    add(sid, y, m, amount, date, note) {
      const s = byId(db.students, sid); if (!s) throw new Error('الطالب غير موجود');
      if (!(+amount > 0)) throw new Error('اكتب مبلغًا');
      const d = local.draft(true);
      d.lines = d.lines.filter(l => !(l.studentId === sid && l.y === y && l.m === m));
      d.lines.push({ id: uid(), studentId: sid, studentName: s.name, halaqaId: s.halaqaId, y, m, amount: Math.round(+amount * 100) / 100, date: date || today(), note: note || '', state: 'pending', accNote: '' });
    },
    remove(lid) { const d = local.draft(false); if (d) d.lines = d.lines.filter(l => l.id !== lid); },
    send() {
      const d = local.draft(false); if (!d || !d.lines.length) throw new Error('لا يوجد ما يُرسل');
      d.status = 'sent'; d.sentAt = new Date().toISOString(); d.lines = d.lines.map(l => ({ ...l, state: 'pending', accNote: '' }));
      news('accountant', `كشف تحصيل من ${d.collectorName}: عدد الطلاب ${d.lines.length}، والإجمالي ${money(d.lines.reduce((a, l) => a + l.amount, 0))} جنيه. راجعه من «الطلاب ← كشوف».`);
    },
    mark(nid, lid, ok, msg) {
      const n = L().find(x => x.id === nid && x.status === 'sent'); if (!n) throw new Error('الكشف غير موجود أو انتهت مراجعته');
      n.lines = n.lines.map(l => l.id === lid ? { ...l, state: ok == null ? 'pending' : ok ? 'ok' : 'issue', accNote: ok === false ? (msg || '') : '' } : l);
    },
    finish(nid, msg) {
      const n = L().find(x => x.id === nid && x.status === 'sent'); if (!n) throw new Error('الكشف غير موجود أو انتهت مراجعته');
      if (n.lines.some(l => l.state !== 'ok' && l.state !== 'issue')) throw new Error('راجع الأسماء كلها أولًا');
      if (!Array.isArray(db.fees)) db.fees = [];
      const ok = n.lines.filter(l => l.state === 'ok'), back = n.lines.filter(l => l.state === 'issue').map(l => ({ ...l, id: uid() }));
      ok.forEach(l => { if (byId(db.students, l.studentId)) db.fees.push({ id: uid(), studentId: l.studentId, y: l.y, m: l.m, amount: l.amount, date: l.date || today(), by: myName(), byMember: session.id, note: 'تحصيل ' + n.collectorName + (l.note ? ' — ' + l.note : '') }); });
      Object.assign(n, { status: 'done', reviewedAt: new Date().toISOString(), reviewedBy: myName(), accNote: msg || '' });
      if (back.length) {
        let d = L().find(x => x.collectorId === n.collectorId && x.status === 'draft');
        if (!d) { d = { id: uid(), collectorId: n.collectorId, collectorName: n.collectorName, status: 'draft', lines: [], accNote: '', createdAt: new Date().toISOString() }; L().push(d); }
        d.lines = d.lines.filter(x => !back.some(b => b.studentId === x.studentId && b.y === x.y && b.m === x.m)).concat(back);
      }
      news('m:' + n.collectorId, `تم تحصيل كشفك: عدد الطلاب ${ok.length}، والإجمالي ${money(ok.reduce((a, l) => a + l.amount, 0))} جنيه.${back.length ? ` وأُعيد إليك ${back.length} من الأسماء بملاحظة المحاسب، فصحّحها وأعد إرسالها من «تحصيل».` : ''}`);
      return back.length ? 'partial' : 'done';
    }
  };
  const fromRow = n => ({ id: n.id, collectorId: n.collector_id, collectorName: n.collector_name, status: n.status, accNote: n.acc_note || '', createdAt: n.created_at, sentAt: n.sent_at, reviewedAt: n.reviewed_at, reviewedBy: n.reviewed_by || '',
    lines: (n.lines || []).map(l => ({ ...l, y: +l.y, m: +l.m, amount: +l.amount })) });
  const rpc = (fn, args) => window.Cloud.rpc(fn, args);
  const api = {
    async list(kind) { return CLOUD ? ((await rpc('cn_list', { kind })) || []).map(fromRow) : local.list(kind); },
    async add(sid, y, m, amt, dt, nt) { if (CLOUD) await rpc('cn_add', { sid, yy: y, mm: m, amt, dt, nt }); else { local.add(sid, y, m, amt, dt, nt); save(); } },
    async remove(lid) { if (CLOUD) await rpc('cn_remove', { lid }); else { local.remove(lid); save(); } },
    async send() { if (CLOUD) await rpc('cn_send'); else { local.send(); save(); } },
    async mark(nid, lid, ok, msg) { if (CLOUD) await rpc('cn_mark', { nid, lid, ok, msg: msg || '' }); else { local.mark(nid, lid, ok, msg); save(); } },
    async finish(nid, msg) { if (CLOUD) return rpc('cn_finish', { nid, msg: msg || '' }); const r = local.finish(nid, msg); save(); return r; }
  };
  const errMsg = e => (navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : /cn_|PGRST202|404/.test(String(e?.message || e)) ? 'نفّذ ملف supabase/cnotices.sql على الخادم أولًا' : (e?.message || String(e)));
  window.QLCN = { api, money, MONTHS };

  /* ===== حالة النافذة ===== */
  const S = { mine: [], hid: '', loading: false };
  async function reload() {
    S.loading = true;
    try { S.mine = await api.list('mine'); } catch (e) { S.mine = []; toast(errMsg(e)); }
    S.loading = false; paint();
  }
  const halsOf = () => {
    if (session?.role === 'placeadmin' && window.placeHalaqatOf) return window.placeHalaqatOf(me());
    if (window.QLStuView?.scopeH) { const h = window.QLStuView.scopeH(); if (h) return h.filter(x => x.teacherId === session.id || session.role !== 'teacher'); }
    return db.halaqat.filter(h => h.teacherId === session.id);
  };
  const draft = () => S.mine.find(n => n.status === 'draft');
  const sent = () => S.mine.filter(n => n.status === 'sent');
  /* حالة الطالب: آخر ما يخصه في الكشوف، وهل حُصّل عن الشهر الحالي */
  function stuState(s) {
    const [y, m] = ym();
    const lines = S.mine.flatMap(n => n.lines.map(l => ({ ...l, ns: n.status }))).filter(l => l.studentId === s.id);
    const cur = lines.filter(l => l.y === y && l.m === m);
    const pick = st => cur.find(st);
    const inDraft = pick(l => l.ns === 'draft' && l.state !== 'issue'), atAcc = pick(l => l.ns === 'sent'), done = pick(l => l.ns === 'done' && l.state === 'ok');
    const issue = lines.find(l => l.ns === 'draft' && l.state === 'issue');   // المُعاد من أي شهر
    const paidFee = (db.fees || []).some(f => f.studentId === s.id && +f.y === y && +f.m === m);
    const green = !!(inDraft || atAcc || done || paidFee) && !issue;
    let txt = '';
    if (issue) txt = `<span class="tag tag-no">مُعاد${issue.y !== y || issue.m !== m ? ` (${MONTHS[issue.m - 1]})` : ''}: ${esc(issue.accNote || 'راجعه')}</span>`;
    else if (inDraft) txt = `<span class="tag">في الكشف: ${money(inDraft.amount)}</span>`;
    else if (atAcc) txt = `<span class="tag">عند المحاسب: ${money(atAcc.amount)}</span>`;
    else if (done || paidFee) txt = '<span class="tag tag-ok">مُسدَّد ✓</span>';
    else {
      const last = (db.fees || []).filter(f => f.studentId === s.id).sort((a, b) => (b.y * 100 + b.m) - (a.y * 100 + a.m))[0];
      if (last) txt = `<small class="muted">آخر دفعة: ${MONTHS[last.m - 1]} ${last.y}</small>`;
    }
    return { green, txt, issue: !!issue };
  }

  /* ===== النافذة ===== */
  let ov = null;
  const PAY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>';
  const css = document.createElement('style');
  css.textContent = `.qcol .qcolbar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .6rem}
    .qcol .qcolbar b{font-size:1.05rem}.qcol .qcolbar .grow{flex:1 1 12rem;min-width:0;font-size:.92rem}
    .qcol .qcolst{margin-top:.2rem;font-size:.85rem;white-space:normal}.qcol td.qnm{white-space:normal;min-width:9rem}
    .qcol .tbl:not(.paytbl){width:100%!important}.qcol .tbl:not(.paytbl) > table{width:100%!important}
    @media (max-width:600px){.qcol [data-colpay]{white-space:normal;line-height:1.25;max-width:6.5rem}.qcol td.qnm{min-width:0}.qcol td.qnm small{display:block}}
    .qcol .btn.qpaid{background:#e7f4ec!important;border-color:#8fc7a3!important;color:#1f6b3a!important}
    .qcol tr.qissue td{background:#fdecea}.qcol .qcolsent{margin:.4rem 0 0;font-size:.88rem}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-colopen]:is(.btn,button){order:4!important;flex:0 0 auto!important}
    [data-colopen] svg{width:18px;height:18px;vertical-align:-3px;margin-inline-end:.3rem}`;
  document.head.appendChild(css);
  function body() {
    const hs = halsOf().slice().sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
    if (!hs.length) return `<div class="modal wide"><h2>التحصيل</h2>${empty('لا توجد حلقات تحصّل لها.')}<div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    if (S.hid && !hs.some(h => h.id === S.hid)) S.hid = '';
    const ids = new Set(S.hid ? [S.hid] : hs.map(h => h.id)), d = draft();
    const inDraft = new Set((d?.lines || []).map(l => l.studentId));
    const list = db.students.filter(s => ids.has(s.halaqaId) && (!stOff(s) || inDraft.has(s.id))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const [y, m] = ym(), due = s => (window.QLFeeDue ? window.QLFeeDue(s, y) : null);
    const rows = list.map((s, i) => {
      const st = stuState(s), dv = due(s);
      return `<tr${st.issue ? ' class="qissue"' : ''}><td class="qnm"><b>${esc(s.name)}</b>${hs.length > 1 && !S.hid ? ` <small class="muted">${esc(halaqaLabel(byId(db.halaqat, s.halaqaId)).replace(/^\s*حلقة\s+/, '').split(' — ')[0])}</small>` : ''}${st.txt ? `<div class="qcolst">${st.txt}</div>` : ''}</td>
        <td>${dv == null ? '—' : money(dv)}</td>
        <td><button type="button" class="btn sm ${st.green ? 'qpaid' : ''}" data-colpay="${esc(s.id)}">${st.green ? '✓ ' : ''}تحصيل الاشتراك</button></td></tr>`;
    }).join('');
    const dn = d?.lines.length || 0, dt = (d?.lines || []).reduce((a, l) => a + l.amount, 0), di = (d?.lines || []).filter(l => l.state === 'issue').length;
    const sentTxt = sent().map(n => `<p class="muted qcolsent">كشف أُرسل ${esc(String(n.sentAt || '').slice(0, 10))} بانتظار المحاسب: ${n.lines.length} من الطلاب، ${money(n.lines.reduce((a, l) => a + l.amount, 0))} جنيه.</p>`).join('');
    return `<div class="modal wide"><h2>التحصيل — ${MONTHS[m - 1]} ${y}</h2>
      ${hs.length > 1 ? `<label style="max-width:28rem">الحلقة<select data-colhal><option value="">كل حلقاتي</option>${hs.map(h => `<option value="${esc(h.id)}" ${h.id === S.hid ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select></label>` : ''}
      <p class="muted" style="font-size:.86rem;margin:.2rem 0 .6rem">«تحصيل الاشتراك» يضيف الطالب إلى الكشف الحالي، ثم «مراجعة وإرسال» يرسله للمحاسب. الزر الأخضر: حُصّل عن الشهر الحالي.</p>
      ${S.loading && !S.mine.length ? '<p class="muted">جارٍ التحميل…</p>' : ''}
      ${sentTxt}
      ${list.length ? `<div class="tbl"><table><tr><th class="qnm">الطالب</th><th>المستحق</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد طلاب.')}
      <div class="row qcolbar"><span class="grow">${dn ? `الكشف الحالي: <b>${dn}</b> من الطلاب، والإجمالي <b>${money(dt)}</b> جنيه${di ? ` · <span style="color:var(--red,#b3372f)">${di} مُعاد للتصحيح</span>` : ''}` : '<span class="muted">الكشف الحالي فارغ.</span>'}</span>
        <button type="button" class="btn primary" data-colrev ${dn ? '' : 'disabled'}>مراجعة وإرسال</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
  }
  function paint() { if (ov && ov.isConnected) { const sc = ov.querySelector('.modal')?.scrollTop || 0; ov.innerHTML = body(); const m = ov.querySelector('.modal'); if (m) m.scrollTop = sc; } }
  function openWin() {
    if (ov && ov.isConnected) return;
    ov = document.createElement('div'); ov.className = 'overlay qcol'; ov.innerHTML = body();
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target.closest('[data-close]') && e.target.closest('.overlay') === ov) { ov.remove(); ov = null; } });
    ov.addEventListener('change', e => { if (e.target.matches('[data-colhal]')) { S.hid = e.target.value; paint(); } });
    reload();
  }

  /* ===== نافذة التحصيل لطالب: كنافذة المحاسب (fees في app-abs.js) ===== */
  function payDialog(s) {
    const [cy, cm] = ym(), fee = window.QLFeeDue ? window.QLFeeDue(s, cy) : null;
    const d = draft(), ex = (d?.lines || []).find(l => l.studentId === s.id && l.y === cy && l.m === cm);
    let mOpts = '';
    for (let k = -12; k <= 2; k++) { const dd = new Date(cy, cm - 1 + k, 1), y = dd.getFullYear(), m = dd.getMonth() + 1; mOpts += `<option value="${y}-${m}" ${y === cy && m === cm ? 'selected' : ''}>${MONTHS[m - 1]} ${y}</option>`; }
    const p = document.createElement('div'); p.className = 'overlay';
    p.innerHTML = `<div class="modal"><h2>تحصيل اشتراك: ${esc(s.name)}</h2>${fee ? `<p class="muted" style="margin:0 0 .6rem">المستحق: ${money(fee)} جنيه</p>` : ''}
      <label>المبلغ<input type="number" min="0" step="any" name="amount" value="${ex ? ex.amount : (fee || '')}" required></label>
      <label>عن شهر<select name="month">${mOpts}</select></label>
      <label>التاريخ<input type="date" name="date" value="${today()}"></label>
      <label>ملاحظة<input name="note" value="${esc(ex?.note || '')}"></label>
      <div data-rw hidden><label>سبب مبلغ أقل<select name="reason"><option value="">— اختر —</option><option value="متأخر">متأخر</option><option value="حالة خاصة">حالة خاصة</option></select></label></div>
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 0">يُضاف إلى الكشف الحالي، ولا يُسجَّل في الاشتراكات حتى يؤكده المحاسب.</p>
      <div class="row"><button type="button" class="btn primary" data-colsave>إضافة إلى الكشف</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(p);
    const ai = p.querySelector('[name=amount]'), rw = p.querySelector('[data-rw]');
    const need = () => { rw.hidden = !(fee && +ai.value > 0 && +ai.value < fee); };
    ai.addEventListener('input', need); need();
    p.querySelector('[data-close]').onclick = () => p.remove();
    p.querySelector('[data-colsave]').onclick = async e => {
      const amt = +ai.value; if (!(amt > 0)) { toast('اكتب مبلغًا'); return; }
      const reason = p.querySelector('[name=reason]').value;
      if (fee && amt < fee && !reason) { toast('اختر السبب'); return; }
      const [y, m] = p.querySelector('[name=month]').value.split('-').map(Number);
      const note = [(p.querySelector('[name=note]').value || '').trim(), reason].filter(Boolean).join(' — ');
      e.target.disabled = true;
      try { await api.add(s.id, y, m, amt, p.querySelector('[name=date]').value || today(), note); p.remove(); toast(`أُضيف «${s.name}» (${money(amt)} جنيه) إلى الكشف`); await reload(); }
      catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  }

  /* ===== إلغاء تحصيل طالب من الكشف الحالي (لم يصل المحاسب بعد) =====
     نافذة تأكيد صغيرة فوق نافذة التحصيل (لا .overlay: تلك تصير صفحة كاملة على الهاتف في pages.js) */
  const cssC = document.createElement('style');
  cssC.textContent = `.qinner{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(10,18,35,.45)}
    .qinner .qinbox{width:100%;max-width:24rem;background:var(--card,#fff);border-radius:16px;padding:1.1rem 1.1rem .9rem;box-shadow:0 14px 44px rgba(10,18,35,.3)}
    .qinner h3{margin:0 0 .5rem;font-size:1.05rem}.qinner p{margin:.2rem 0 .5rem;line-height:1.7}
    .qinner .row{display:flex;gap:.5rem;justify-content:flex-start;margin-top:.8rem}
    @media print{.qinner{display:none!important}}`;
  document.head.appendChild(cssC);
  function cancelDialog(s, ls) {
    const p = document.createElement('div'); p.className = 'qinner'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    const tot = ls.reduce((a, l) => a + l.amount, 0);
    p.innerHTML = `<div class="qinbox"><h3>إلغاء تحصيل «${esc(s.name)}»؟</h3>
      <p>${ls.length > 1 ? 'سيُحذف من الكشف الحالي:' : 'سيُحذف من الكشف الحالي'} ${ls.map(l => `<b>${money(l.amount)} جنيه</b> عن ${MONTHS[l.m - 1]} ${l.y}`).join('، و')}${ls.length > 1 ? ` (${money(tot)} جنيه)` : ''}.</p>
      <p class="muted" style="font-size:.85rem">لم يُرسل للمحاسب بعد، فلا يُسجَّل له شيء.</p>
      <div class="row"><button type="button" class="btn danger" data-colcancel>إلغاء التحصيل</button><button type="button" class="btn" data-close>رجوع</button></div></div>`;
    document.body.appendChild(p);
    const close = () => { p.remove(); document.removeEventListener('keydown', esc1, true); };
    const esc1 = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', esc1, true);
    p.addEventListener('click', e => { if (e.target === p || e.target.closest('[data-close]')) close(); });
    p.querySelector('[data-close]').focus({ preventScroll: true });
    p.querySelector('[data-colcancel]').onclick = async e => {
      e.target.disabled = true;
      try { for (const l of ls) await api.remove(l.id); close(); toast(`أُلغي تحصيل «${s.name}» من الكشف`); await reload(); }
      catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  }

  /* ===== مراجعة الكشف ثم إرساله ===== */
  function reviewDialog() {
    const d = draft(); if (!d || !d.lines.length) return;
    const p = document.createElement('div'); p.className = 'overlay';
    const draw = () => {
      const dd = draft(), ls = (dd?.lines || []).slice().sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
      if (!ls.length) { p.remove(); return; }
      const tot = ls.reduce((a, l) => a + l.amount, 0);
      p.innerHTML = `<div class="modal wide"><h2>مراجعة الكشف قبل الإرسال</h2>
        <div class="tbl"><table><tr><th>#</th><th class="qnm">الطالب</th><th>عن شهر</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr>
        ${ls.map((l, i) => `<tr${l.state === 'issue' ? ' style="background:#fdecea"' : ''}><td>${i + 1}</td><td class="qnm">${esc(l.studentName)}${l.state === 'issue' ? `<br><small style="color:var(--red,#b3372f)">أعاده المحاسب: ${esc(l.accNote || '')}</small>` : ''}</td><td>${MONTHS[l.m - 1]} ${l.y}</td><td>${money(l.amount)}</td><td>${esc(l.note || '')}</td>
          <td><button type="button" class="btn sm" data-coledit="${esc(l.studentId)}" title="تعديل">تعديل</button> <button type="button" class="btn sm danger" data-coldel="${esc(l.id)}" title="حذف من الكشف" aria-label="حذف">×</button></td></tr>`).join('')}
        <tr class="sum"><td colspan="3">الإجمالي</td><td>${money(tot)}</td><td colspan="2"></td></tr></table></div>
        <p class="muted" style="font-size:.85rem">بعد الإرسال لا يُعدَّل الكشف حتى يراجعه المحاسب؛ وما تحصّله بعده يدخل كشفًا جديدًا.</p>
        <div class="row"><button type="button" class="btn primary" data-colsend>إرسال للمحاسب (${ls.length}، ${money(tot)} جنيه)</button><button type="button" class="btn" data-close>رجوع</button></div></div>`;
    };
    draw(); document.body.appendChild(p);
    p.addEventListener('click', async e => {
      if (e.target.closest('[data-close]')) { p.remove(); return; }
      const del = e.target.closest('[data-coldel]');
      if (del) { try { await api.remove(del.dataset.coldel); await reload(); draw(); } catch (err) { toast(errMsg(err)); } return; }
      const ed = e.target.closest('[data-coledit]');
      if (ed) { const s = byId(db.students, ed.dataset.coledit); if (s) { p.remove(); payDialog(s); } return; }
      const sb = e.target.closest('[data-colsend]'); if (!sb) return;
      sb.disabled = true;
      try { await api.send(); p.remove(); toast('أُرسل الكشف للمحاسب'); await reload(); }
      catch (err) { sb.disabled = false; toast(errMsg(err)); }
    });
  }

  /* ===== الزر في صف أدوات «الطلاب» ===== */
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.students;
    adminViews.students = function () {
      const h = base.apply(this, arguments);
      if (typeof h !== 'string' || (ui.svw && ui.svw !== 'list') || !canCol()) return h;
      return h.replace(/(<div class="qseg" data-sstfseg|<select data-sstf)/, `<button type="button" class="btn" data-colopen>${PAY}تحصيل</button>$1`);
    };
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-colopen]')) { openWin(); return; }
    const b = e.target.closest('[data-colpay]'); if (b) { const s = byId(db.students, b.dataset.colpay); if (s) { const ls = (draft()?.lines || []).filter(l => l.studentId === s.id); ls.length ? cancelDialog(s, ls) : payDialog(s); } return; }
    if (e.target.closest('[data-colrev]') && !e.target.closest('[data-colrev]').disabled) reviewDialog();
  });

  /* ======================= المحاسب والمدير ======================= */
  const canAcc = () => !!session && (session.role === 'admin' || (session.role === 'accountant' && (!window.Perms || Perms.can('fees.collect')) && (!window.QLStuPerm || window.QLStuPerm.can('accbtn'))));
  const A = { inbox: [], log: [], at: 0, tab: 'inbox', open: new Set(), busy: false, who: '' };
  async function accLoad(force) {
    const who = session ? session.role + ':' + session.id : '';
    if (who !== A.who) { A.who = who; A.at = 0; A.inbox = []; A.log = []; }   // تبديل الحساب (والعمل بصفة) لا يُبقي كشوف غيره
    if (!canAcc() || A.busy || (!force && Date.now() - A.at < 60000)) return;
    A.busy = true;
    try { const [i, l] = await Promise.all([api.list('inbox'), api.list('log')]); A.inbox = i; A.log = l; }
    catch (e) { if (force) toast(errMsg(e)); }
    A.at = Date.now(); A.busy = false; accPaint(); badge();
  }
  const dt = s => String(s || '').slice(0, 10);
  const sumOf = ls => ls.reduce((a, l) => a + l.amount, 0);
  function noticeCard(n) {
    const ls = n.lines.slice().sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
    const done = ls.every(l => l.state === 'ok' || l.state === 'issue'), ok = ls.filter(l => l.state === 'ok'), pend = ls.filter(l => l.state !== 'ok' && l.state !== 'issue').length;
    return `<div class="card qnotice" data-nid="${esc(n.id)}"><div class="qnhead"><b>كشف تحصيل من ${esc(n.collectorName)}</b><small class="muted">${dt(n.sentAt)} · ${ls.length} من الطلاب · ${money(sumOf(ls))} جنيه</small></div>
      <div class="tbl"><table><tr><th class="qnm">الطالب</th><th>عن شهر</th><th>المبلغ</th><th></th></tr>
      ${ls.map(l => `<tr class="${l.state === 'ok' ? 'qok' : l.state === 'issue' ? 'qno' : ''}"><td class="qnm">${l.state === 'ok' ? '✓ ' : ''}${esc(l.studentName)}${l.note ? `<br><small class="muted">${esc(l.note)}</small>` : ''}${l.state === 'issue' && l.accNote ? `<br><small>أُعيد: ${esc(l.accNote)}</small>` : ''}</td><td>${MONTHS[l.m - 1]} ${l.y}</td><td>${money(l.amount)}</td>
        <td>${l.state === 'ok' || l.state === 'issue' ? `<button type="button" class="btn sm" data-acmark="${esc(l.id)}" data-v="">تراجع</button>` : `<button type="button" class="btn sm primary" data-acmark="${esc(l.id)}" data-v="1">تم التحصيل</button> <button type="button" class="btn sm" data-acmark="${esc(l.id)}" data-v="0">إعادة</button>`}</td></tr>`).join('')}
      <tr class="sum"><td colspan="2">الإجمالي (${ls.length})</td><td>${money(sumOf(ls))}</td><td></td></tr></table></div>
      <div class="row qnfoot">${pend ? `<button type="button" class="btn" data-acall>تم التحصيل للكل (${pend})</button>` : ''}
        <button type="button" class="btn primary" data-acfin ${done ? '' : 'disabled'}>تم تحصيل المبلغ${done ? ` (${ok.length}، ${money(sumOf(ok))} جنيه)` : ''}</button>
        ${done ? '' : '<small class="muted">راجع الأسماء كلها أولًا</small>'}</div></div>`;
  }
  function logView() {
    const rows = A.log.map(n => {
      const ok = n.lines.filter(l => l.state === 'ok'), iss = n.lines.filter(l => l.state === 'issue'), op = A.open.has(n.id);
      return `<div class="card qnotice qlog"><button type="button" class="qlogh" data-aclog="${esc(n.id)}" aria-expanded="${op}"><b>${esc(n.collectorName)}</b> <small class="muted">أُرسل ${dt(n.sentAt)} · حصّله ${esc(n.reviewedBy || '')} ${dt(n.reviewedAt)}</small>
        <span class="tag tag-ok">${ok.length} · ${money(sumOf(ok))} جنيه</span>${iss.length ? ` <span class="tag tag-no">أُعيد ${iss.length}</span>` : ''}</button>
        ${op ? `<div class="tbl"><table><tr><th class="qnm">الطالب</th><th>عن شهر</th><th>المبلغ</th><th>الحالة</th></tr>${n.lines.map(l => `<tr class="${l.state === 'ok' ? 'qok' : 'qno'}"><td class="qnm">${l.state === 'ok' ? '✓ ' : ''}${esc(l.studentName)}</td><td>${MONTHS[l.m - 1]} ${l.y}</td><td>${money(l.amount)}</td><td>${l.state === 'ok' ? 'حُصّل' : 'أُعيد' + (l.accNote ? ': ' + esc(l.accNote) : '')}</td></tr>`).join('')}</table></div>` : ''}</div>`;
    }).join('');
    /* القوائم القديمة (قائمة الشهر): تُراجع وتُعرض بأدواتها القديمة (collect.js) */
    const oldN = (db.collections || []).filter(c => c.status !== 'draft').length;
    let old = '';
    if (oldN && typeof adminViews.tcollect === 'function') { try { old = `<h3 class="sc-h" style="margin-top:1rem">القوائم القديمة (قبل الكشوف)</h3>${adminViews.tcollect()}`; } catch (e) { old = ''; } }
    return (rows || '<p class="muted">لا توجد كشوف منتهية بعد.</p>') + old;
  }
  let aov = null;
  function accBody() {
    const n = A.inbox.length, oldPend = (db.collections || []).filter(c => c.status === 'sent').length;
    return `<div class="modal wide"><h2>كشوف</h2>
      <div class="qseg" role="tablist" style="margin:0 0 .8rem"><button type="button" data-actab="inbox" class="${A.tab === 'inbox' ? 'on' : ''}" aria-selected="${A.tab === 'inbox'}">الكشوف${n ? ` <small>(${n})</small>` : ''}</button><button type="button" data-actab="log" class="${A.tab === 'log' ? 'on' : ''}" aria-selected="${A.tab === 'log'}">السجل${oldPend ? ` <small>(${oldPend} قديمة)</small>` : ''}</button></div>
      ${A.busy && !A.at ? '<p class="muted">جارٍ التحميل…</p>' : A.tab === 'inbox' ? (n ? A.inbox.map(noticeCard).join('') : `<p class="muted">لا توجد كشوف تنتظر المراجعة.${oldPend ? ' وفي «السجل» قوائم قديمة تنتظر المراجعة.' : ''}</p>`) : logView()}
      <div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
  }
  function accPaint() { if (aov && aov.isConnected) { const m0 = aov.querySelector('.modal'), sc = m0?.scrollTop || 0; aov.innerHTML = accBody(); const m = aov.querySelector('.modal'); if (m) m.scrollTop = sc; } }
  function accOpen() {
    if (aov && aov.isConnected) return;
    aov = document.createElement('div'); aov.className = 'overlay qcol qcacc'; aov.innerHTML = accBody();
    document.body.appendChild(aov);
    aov.addEventListener('click', accClick);
    accLoad(true);
  }
  async function accClick(e) {
    if (e.target.closest('[data-close]') && e.target.closest('.overlay') === aov) { aov.remove(); aov = null; return; }
    const tb = e.target.closest('[data-actab]'); if (tb) { A.tab = tb.dataset.actab; accPaint(); return; }
    const lg = e.target.closest('[data-aclog]'); if (lg) { const id = lg.dataset.aclog; A.open.has(id) ? A.open.delete(id) : A.open.add(id); accPaint(); return; }
    const card = e.target.closest('[data-nid]'), nid = card?.dataset.nid, n = A.inbox.find(x => x.id === nid); if (!n) return;
    const mk = e.target.closest('[data-acmark]');
    if (mk) {
      const lid = mk.dataset.acmark, v = mk.dataset.v, ok = v === '' ? null : v === '1';
      const go = async msg => {
        const l = n.lines.find(x => x.id === lid), prev = l && { state: l.state, accNote: l.accNote };
        if (l) { l.state = ok == null ? 'pending' : ok ? 'ok' : 'issue'; l.accNote = ok === false ? (msg || '') : ''; accPaint(); }   // فورًا، ثم الخادم
        try { await api.mark(nid, lid, ok, msg); } catch (err) { if (l) Object.assign(l, prev); accPaint(); toast(errMsg(err)); }
      };
      if (ok === false) {
        openForm('إعادة الاسم للمعلم', [{ name: 'msg', label: 'السبب (يصل المعلم)', type: 'textarea' }], vv => { setTimeout(() => go((vv.msg || '').trim()), 0); });
        const sv = [...document.querySelectorAll('.overlay')].pop()?.querySelector('[data-save]'); if (sv) sv.textContent = 'إعادة';
      } else go('');
      return;
    }
    if (e.target.closest('[data-acall]')) {
      const pend = n.lines.filter(l => l.state !== 'ok' && l.state !== 'issue');
      pend.forEach(l => { l.state = 'ok'; l.accNote = ''; }); accPaint();
      try { for (const l of pend) await api.mark(nid, l.id, true, ''); } catch (err) { toast(errMsg(err)); await accLoad(true); }
      return;
    }
    const fb = e.target.closest('[data-acfin]');
    if (fb && !fb.disabled) {
      fb.disabled = true;
      try {
        const r = await api.finish(nid, '');
        toast(r === 'partial' ? 'تم التحصيل، وأُعيد الباقي للمعلم' : 'تم تحصيل المبلغ وسُجّلت الدفعات');
        if (CLOUD && typeof cloudRefresh === 'function') cloudRefresh(true, false, true);   // الدفعات الجديدة في الاشتراكات
      } catch (err) { toast(errMsg(err)); }
      await accLoad(true);
    }
  }
  /* العدد على الزر وعلى «الطلاب» في القائمة الجانبية */
  function badge() {
    const n = canAcc() ? A.inbox.length : 0;
    document.querySelectorAll('main [data-acopen] .count').forEach(c => { if (!n) c.remove(); else c.textContent = n; });
    const b = document.querySelector('main [data-acopen]'); if (b && n && !b.querySelector('.count')) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
    const sb = document.querySelector('.side nav.tabs button[data-v="students"]');
    if (sb) { const c = sb.querySelector('.qcacc-c'); if (n && !c) sb.insertAdjacentHTML('beforeend', `<span class="count qcacc-c" title="كشوف تحصيل تنتظر المراجعة">${n}</span>`); else if (c && !n) c.remove(); else if (c) c.textContent = n; }
  }
  new MutationObserver(() => { try { badge(); } catch (e) { /* ignore */ } }).observe(document.getElementById('app') || document.body, { childList: true });
  setInterval(() => { if (session && !document.hidden && canAcc()) accLoad(false); }, 60000);

  /* ===== الزر، وإزالة الصفحات القديمة ===== */
  const css2 = document.createElement('style');
  css2.textContent = `.qcacc .qnotice{margin:0 0 1rem;padding:.9rem}.qcacc .qnhead{display:flex;flex-wrap:wrap;gap:.2rem .8rem;align-items:baseline;margin-bottom:.5rem}
    .qcacc tr.qok td{background:#eef7f1!important;color:#3d7a52}.qcacc tr.qok td.qnm{font-weight:700}
    .qcacc tr.qno td{background:#fdf0ee!important;color:#9a3b30}.qcacc .qnfoot{align-items:center}
    .qcacc .qlogh{display:flex;flex-wrap:wrap;gap:.3rem .6rem;align-items:center;width:100%;border:0;background:none;padding:0;font:inherit;text-align:start;cursor:pointer}
    .qcacc .qlog .tbl{margin-top:.6rem}
    .qcacc .modal,.qcacc .qnotice{min-width:0;max-width:100%;box-sizing:border-box}.qcacc .tbl:not(.paytbl){max-width:100%;overflow-x:auto}
    .qcacc td:not(:last-child){white-space:normal!important}.qcacc td.qnm{min-width:6rem}
    .qcacc .qnotice tr:not(.qok):not(.qno):not(.sum) td{background:var(--card,#fff)!important}
    @media (max-width:600px){.qcacc .qnotice{padding:.7rem .4rem}.qcacc .qnotice table{font-size:.86rem}.qcacc .qnotice th,.qcacc .qnotice td{padding:.4rem .3rem!important}
      .qcacc td [data-acmark]{display:block;width:100%;margin:.15rem 0;padding:.25rem .45rem!important;font-size:.8rem;min-height:0!important}.qcacc td.qnm{min-width:5rem}.qcacc .qnotice td:nth-child(2){max-width:4.2rem}}
    main .tblprint.qtb:has([data-sstfseg]) > .bar > [data-acopen]:is(.btn,button){order:4!important;flex:0 0 auto!important}
    [data-acopen] svg{width:18px;height:18px;vertical-align:-3px;margin-inline-end:.3rem}`;
  document.head.appendChild(css2);
  const OLD = { teacher: 'collect', placeadmin: 'collect', accountant: 'tcollect', admin: 'tcollect' };
  document.addEventListener('DOMContentLoaded', () => {
    Object.entries(OLD).forEach(([r, k]) => { const T = TABS[r]; if (!T) return; const i = T.findIndex(t => t[0] === k); if (i > -1) T.splice(i, 1); });
    const base = adminViews.students;
    adminViews.students = function () {
      if (ui.svw === 'tcollect') ui.svw = 'list';
      let h = base.apply(this, arguments);
      if (typeof h !== 'string') return h;
      /* شريط «الطلاب / تحصيل المعلمين»: لم يبق فيه إلا «الطلاب» */
      const i = h.indexOf('<div class="card subnav">'), e2 = i < 0 ? -1 : h.indexOf('</div></div>', i);
      if (e2 > -1) h = h.slice(0, i) + h.slice(e2 + 12);
      if ((ui.svw && ui.svw !== 'list') || !canAcc()) return h;
      const n = A.inbox.length;
      return h.replace(/(<div class="qseg" data-sstfseg|<select data-sstf)/, `<button type="button" class="btn" data-acopen>${PAY}كشوف${n ? ` <span class="count">${n}</span>` : ''}</button>$1`);
    };
    const baseR = render;
    render = function () {
      try { if (ui.tab === 'collect' || ui.tab === 'tcollect') ui.tab = 'students'; if (canAcc()) accLoad(false); } catch (e) { /* ignore */ }
      const r = baseR.apply(this, arguments);
      try { if (aov && aov.isConnected && A.tab === 'log') accPaint(); } catch (e) { /* ignore */ }   // بعد مراجعة قائمة قديمة
      return r;
    };
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-acopen]')) accOpen(); });
})();
