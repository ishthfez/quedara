'use strict';
/* ============ إخطارات التحصيل: جانب المعلم والإداري ============
   زر «تحصيل» في صف أدوات صفحة «الطلاب» (بجانب «الحضور») يفتح نافذة فيها طلاب حلقات الجامع ومستحق كل منهم،
   وأمام كل طالب «تحصيل الاشتراك»: نافذة التحصيل نفسها التي عند المحاسب (المبلغ، الشهر، التاريخ، الملاحظة، وسبب المبلغ الأقل).
   ما يُحصَّل يدخل «الإخطار الحالي» (مسودة على الخادم)، ثم «مراجعة وإرسال» يعرض الأسماء والمبالغ والإجمالي ويرسله للمحاسب.
   الزر أخضر إن كان للطالب تحصيل عن الشهر الحالي (في الإخطار أو عند المحاسب أو مؤكَّد، أو دفعة مسجّلة)، وعادي إن كان لشهر سابق.
   ما أعاده المحاسب يعود إلى الإخطار الحالي بالأحمر وملاحظته، فيُصحَّح ويُرسل من جديد.
   - الخادم: supabase/cnotices.sql (cn_add / cn_remove / cn_send / cn_list). بلا خادم (نسخة العرض): القاعدة نفسها على الجهاز في db.cnotices.
   - جانب المحاسب (cn_mark / cn_finish) في المرحلة التالية؛ والدوال المحلية لها هنا (window.QLCN) ليستعملها. */
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
      news('accountant', `إخطار تحصيل من ${d.collectorName}: عدد الطلاب ${d.lines.length}، والإجمالي ${money(d.lines.reduce((a, l) => a + l.amount, 0))} جنيه. راجعه من «الطلاب ← تحصيل المعلمين».`);
    },
    mark(nid, lid, ok, msg) {
      const n = L().find(x => x.id === nid && x.status === 'sent'); if (!n) throw new Error('الإخطار غير موجود أو انتهت مراجعته');
      n.lines = n.lines.map(l => l.id === lid ? { ...l, state: ok == null ? 'pending' : ok ? 'ok' : 'issue', accNote: ok === false ? (msg || '') : '' } : l);
    },
    finish(nid, msg) {
      const n = L().find(x => x.id === nid && x.status === 'sent'); if (!n) throw new Error('الإخطار غير موجود أو انتهت مراجعته');
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
      news('m:' + n.collectorId, `تم تحصيل إخطارك: عدد الطلاب ${ok.length}، والإجمالي ${money(ok.reduce((a, l) => a + l.amount, 0))} جنيه.${back.length ? ` وأُعيد إليك ${back.length} من الأسماء بملاحظة المحاسب، فصحّحها وأعد إرسالها من «تحصيل».` : ''}`);
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
  /* حالة الطالب: آخر ما يخصه في الإخطارات، وهل حُصّل عن الشهر الحالي */
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
    else if (inDraft) txt = `<span class="tag">في الإخطار: ${money(inDraft.amount)}</span>`;
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
    const sentTxt = sent().map(n => `<p class="muted qcolsent">إخطار أُرسل ${esc(String(n.sentAt || '').slice(0, 10))} بانتظار المحاسب: ${n.lines.length} من الطلاب، ${money(n.lines.reduce((a, l) => a + l.amount, 0))} جنيه.</p>`).join('');
    return `<div class="modal wide"><h2>التحصيل — ${MONTHS[m - 1]} ${y}</h2>
      ${hs.length > 1 ? `<label style="max-width:28rem">الحلقة<select data-colhal><option value="">كل حلقاتي</option>${hs.map(h => `<option value="${esc(h.id)}" ${h.id === S.hid ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select></label>` : ''}
      <p class="muted" style="font-size:.86rem;margin:.2rem 0 .6rem">«تحصيل الاشتراك» يضيف الطالب إلى الإخطار الحالي، ثم «مراجعة وإرسال» يرسله للمحاسب. الزر الأخضر: حُصّل عن الشهر الحالي.</p>
      ${S.loading && !S.mine.length ? '<p class="muted">جارٍ التحميل…</p>' : ''}
      ${sentTxt}
      ${list.length ? `<div class="tbl"><table><tr><th class="qnm">الطالب</th><th>المستحق</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد طلاب.')}
      <div class="row qcolbar"><span class="grow">${dn ? `الإخطار الحالي: <b>${dn}</b> من الطلاب، والإجمالي <b>${money(dt)}</b> جنيه${di ? ` · <span style="color:var(--red,#b3372f)">${di} مُعاد للتصحيح</span>` : ''}` : '<span class="muted">الإخطار الحالي فارغ.</span>'}</span>
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
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 0">يُضاف إلى الإخطار الحالي، ولا يُسجَّل في الاشتراكات حتى يؤكده المحاسب.</p>
      <div class="row"><button type="button" class="btn primary" data-colsave>إضافة إلى الإخطار</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
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
      try { await api.add(s.id, y, m, amt, p.querySelector('[name=date]').value || today(), note); p.remove(); toast(`أُضيف «${s.name}» (${money(amt)} جنيه) إلى الإخطار`); await reload(); }
      catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  }

  /* ===== مراجعة الإخطار ثم إرساله ===== */
  function reviewDialog() {
    const d = draft(); if (!d || !d.lines.length) return;
    const p = document.createElement('div'); p.className = 'overlay';
    const draw = () => {
      const dd = draft(), ls = (dd?.lines || []).slice().sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
      if (!ls.length) { p.remove(); return; }
      const tot = ls.reduce((a, l) => a + l.amount, 0);
      p.innerHTML = `<div class="modal wide"><h2>مراجعة الإخطار قبل الإرسال</h2>
        <div class="tbl"><table><tr><th>#</th><th class="qnm">الطالب</th><th>عن شهر</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr>
        ${ls.map((l, i) => `<tr${l.state === 'issue' ? ' style="background:#fdecea"' : ''}><td>${i + 1}</td><td class="qnm">${esc(l.studentName)}${l.state === 'issue' ? `<br><small style="color:var(--red,#b3372f)">أعاده المحاسب: ${esc(l.accNote || '')}</small>` : ''}</td><td>${MONTHS[l.m - 1]} ${l.y}</td><td>${money(l.amount)}</td><td>${esc(l.note || '')}</td>
          <td><button type="button" class="btn sm" data-coledit="${esc(l.studentId)}" title="تعديل">تعديل</button> <button type="button" class="btn sm danger" data-coldel="${esc(l.id)}" title="حذف من الإخطار" aria-label="حذف">×</button></td></tr>`).join('')}
        <tr class="sum"><td colspan="3">الإجمالي</td><td>${money(tot)}</td><td colspan="2"></td></tr></table></div>
        <p class="muted" style="font-size:.85rem">بعد الإرسال لا يُعدَّل الإخطار حتى يراجعه المحاسب؛ وما تحصّله بعده يدخل إخطارًا جديدًا.</p>
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
      try { await api.send(); p.remove(); toast('أُرسل الإخطار للمحاسب'); await reload(); }
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
    const b = e.target.closest('[data-colpay]'); if (b) { const s = byId(db.students, b.dataset.colpay); if (s) payDialog(s); return; }
    if (e.target.closest('[data-colrev]') && !e.target.closest('[data-colrev]').disabled) reviewDialog();
  });
})();
