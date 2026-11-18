'use strict';
/* ============ نقل الطالب بموافقة المشرف ============
   النقل يتم فورًا، فيظهر الطالب في الحلقة الجديدة بعلامة «بانتظار موافقة النقل»، ويُسجَّل طلب يوافق عليه مشرف الحلقة القديمة
   ومشرف الجديدة (والاثنان إن اختلفا). الموافقة من كل المطلوبين تجعل النقل نهائيًا، والرفض يعيد الطالب إلى حلقته القديمة.
   الحلقة التي لا مشرف لها لا تحتاج موافقة، ونقل المدير نهائي، وموافقة المشرف الذي ينقل بنفسه تُحسب.
   - الخادم (supabase/transfers.sql) يسجّل الطلب عند كل نقل ويرسل الإشعارات؛ وهنا تُجلب الطلبات المنتظرة (my_transfers)
     كل دقيقة في صفحة «الطلاب»، وبعد كل نقل، ويُقرَّر فيها (review_transfer).
   - بلا خادم (نسخة العرض والعمل المحلي): القاعدة نفسها على الجهاز، في db.transfers.
   - في صفحة «الطلاب»: بطاقة «طلبات نقل بانتظار موافقتك» (.qtrbox) لمن يوافق، وعلامة الانتظار بجانب اسم الطالب (.qtrtag)،
     وعدد الطلبات على «الطلاب» في القائمة الجانبية. كلاهما صف في صلاحيات صفحة الطلاب (stuperm.js). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./transfers.js')) VFILES.push('./transfers.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `.qtrbox h3{margin:0 0 .6rem;font-size:1rem}.qtrbox .qtrrow{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .8rem;padding:.55rem 0;border-top:1px solid var(--line,#e6dfcf)}
    .qtrbox .qtrrow:first-of-type{border-top:0}.qtrbox .qtrtxt{flex:1 1 18rem;min-width:0;line-height:1.6}.qtrbox .qtrtxt small{color:var(--muted,#6b6b6b)}
    .qtrbox .qtrbtns{display:flex;gap:.4rem}.tag.qtrtag{background:#fdf3dc;color:#8a5a00;border-color:#efd59a;font-size:.72rem;margin-inline-start:.35rem;white-space:nowrap}`;
  document.head.appendChild(css);

  const T = { list: [], at: 0, loading: false };
  const isAdm = () => session?.role === 'admin';
  const label = id => { const h = byId(db.halaqat, id); return h ? halaqaLabel(h) + (placeName(h) && !halaqaLabel(h).includes(' — ') ? ' — ' + placeName(h) : '') : 'بلا حلقة'; };
  const myName = () => (typeof me === 'function' && me()?.name) || '';

  /* ===== بلا خادم: قاعدة الخادم نفسها على الجهاز ===== */
  const L = () => (Array.isArray(db.transfers) ? db.transfers : (db.transfers = []));
  const supsOf = hids => [...new Set(hids.map(id => byId(db.halaqat, id)?.supervisorId).filter(Boolean))];
  const ROLEW = { teacher: 'المعلم', supervisor: 'المشرف', placeadmin: 'الإداري', accountant: 'المحاسب' };
  const note = (to, text) => db.news.push({ id: uid(), text, audience: 'm:' + to, date: today(), author: ((ROLEW[session.role] || '') + ' ' + myName()).trim(), authorId: session.id });
  let skip = null;   // إعادة الطالب بعد الرفض لا تُعدّ نقلًا جديدًا
  function localMove(s, old) {
    const pend = L().find(t => t.studentId === s.id && t.status === 'pending');
    if (isAdm()) { if (pend) { pend.status = 'cancelled'; pend.decidedBy = 'نقل المدير'; } return; }
    const orig = pend ? pend.from : old;
    if (pend) pend.status = 'replaced';
    if ((s.halaqaId || '') === (orig || '')) return;
    const sups = supsOf([orig, s.halaqaId]), need = sups.filter(x => x !== session.id);
    if (!need.length) return;
    L().push({ id: uid(), studentId: s.id, from: orig, to: s.halaqaId, byId: session.id, byName: myName(), needed: need, approved: sups.filter(x => x === session.id), status: 'pending', at: new Date().toISOString() });
    need.forEach(x => note(x, `طلب نقل الطالب «${s.name}» من ${label(orig)} إلى ${label(s.halaqaId)}، بانتظار موافقتك من صفحة «الطلاب».`));
  }
  function localList() {
    const visible = new Set(db.students.map(s => s.id));
    return L().filter(t => t.status === 'pending' && (isAdm() || t.needed.includes(session.id) || t.byId === session.id || visible.has(t.studentId))).map(t => ({
      id: t.id, studentId: t.studentId, studentName: byId(db.students, t.studentId)?.name || '', fromTitle: label(t.from), toTitle: label(t.to), byName: t.byName, at: t.at,
      waiting: t.needed.filter(x => !t.approved.includes(x)).map(x => byId(db.supervisors, x)?.name || '').filter(Boolean).join('، '),
      canDecide: isAdm() || (t.needed.includes(session.id) && !t.approved.includes(session.id))
    }));
  }
  function localReview(id, ok, msg) {
    const t = L().find(x => x.id === id && x.status === 'pending'); if (!t) return 'الطلب غير موجود أو قُرّر من قبل';
    const s = byId(db.students, t.studentId), sname = s?.name || '';
    if (!ok) {
      if (s && s.halaqaId === t.to) { skip = s.id; s.halaqaId = t.from; }
      t.status = 'rejected'; t.decidedBy = myName(); t.note = msg || '';
    } else {
      t.approved = [...new Set([...t.approved, ...(isAdm() ? t.needed : t.needed.filter(x => x === session.id))])];
      if (t.needed.every(x => t.approved.includes(x))) { t.status = 'approved'; t.decidedBy = myName(); }
    }
    if (t.status !== 'pending' && t.byId && t.byId !== session.id) note(t.byId, t.status === 'approved' ? `وُوفق على نقل الطالب «${sname}» إلى ${label(t.to)}.` : `رُفض نقل الطالب «${sname}» إلى ${label(t.to)}، وعاد إلى ${label(t.from)}.${msg ? ' السبب: ' + msg : ''}`);
    return '';
  }

  /* ===== المتابعة: كل نقل (من أي نافذة) يُلحظ بمقارنة حلقة كل طالب بين رسم وآخر ===== */
  const snap = new Map(); let snapRole = '';
  function track() {
    if (!session || !Array.isArray(db.students)) return;
    const key = session.role + ':' + session.id;
    if (key !== snapRole) { snap.clear(); snapRole = key; }   // تبديل الحساب: البيانات كلها تتغير
    let moved = false;
    db.students.forEach(s => {
      const prev = snap.get(s.id);
      if (prev !== undefined && prev !== (s.halaqaId || '')) {
        if (skip === s.id) skip = null;
        else { moved = true; if (!CLOUD) localMove(s, prev || ''); }
      }
      snap.set(s.id, s.halaqaId || '');
    });
    if (moved && !CLOUD) save();
    if (moved && CLOUD) setTimeout(() => load(true), 4000);   // بعد إرسال النقل إلى الخادم
  }
  async function load(force) {
    if (!CLOUD) { T.list = localList(); return; }
    if (T.loading || (!force && Date.now() - T.at < 60000) || !window.Cloud?.signedIn) return;
    T.loading = true;
    try {
      const r = await window.Cloud.rpc('my_transfers');
      T.list = (r || []).map(x => ({ id: x.id, studentId: x.student_id, studentName: x.student_name, fromTitle: x.from_title, toTitle: x.to_title, byName: x.by_name, at: x.created_at, waiting: x.waiting, canDecide: !!x.can_decide }));
    } catch (e) { console.warn('my_transfers:', e?.message || e); }   // قبل تشغيل transfers.sql على الخادم: لا شيء
    T.at = Date.now(); T.loading = false;
    if (ui.tab === 'students' && !document.querySelector('.overlay')) render();
  }

  /* ===== صفحة «الطلاب»: بطاقة الطلبات ===== */
  const ago = at => { const d = Math.floor((Date.now() - new Date(at)) / 86400000); return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : `منذ ${d} أيام`; };
  function box() {
    const mine = T.list.filter(t => t.canDecide); if (!mine.length) return '';
    return `<div class="card qtrbox"><h3>طلبات نقل بانتظار موافقتك (${mine.length})</h3>${mine.map(t => `<div class="qtrrow"><div class="qtrtxt"><b>${esc(t.studentName)}</b>: من ${esc(t.fromTitle)} إلى ${esc(t.toTitle)}<br>
      <small>نقله ${esc(t.byName || '—')}، ${ago(t.at)}${t.waiting ? ` · بانتظار: ${esc(t.waiting)}` : ''}</small></div>
      <div class="qtrbtns"><button type="button" class="btn sm primary" data-trok="${esc(t.id)}">موافقة</button><button type="button" class="btn sm danger" data-trno="${esc(t.id)}">رفض</button></div></div>`).join('')}</div>`;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.students;
    adminViews.students = function () {
      const h = base.apply(this, arguments);
      if (typeof h !== 'string' || (ui.svw && ui.svw !== 'list')) return h;
      const b = box(); if (!b) return h;
      const i = h.indexOf('<div class="card subnav">'), e = i < 0 ? -1 : h.indexOf('</div></div>', i);
      return e < 0 ? b + h : h.slice(0, e + 12) + b + h.slice(e + 12);
    };
    const baseRender = render;
    render = function () { try { track(); if (ui.tab === 'students' || !CLOUD) load(false); } catch (err) { console.error('transfers:', err); } return baseRender.apply(this, arguments); };
    setInterval(() => { if (session && !document.hidden) load(false); }, 60000);
  });

  /* ===== القرار ===== */
  async function decide(id, ok, msg) {
    const t = T.list.find(x => x.id === id); if (!t) return;
    if (!CLOUD) { const err = localReview(id, ok, msg); if (err) { toast(err); return; } save(); T.list = localList(); render(); toast(ok ? 'تمت الموافقة' : `رُفض النقل وعاد «${t.studentName}» إلى حلقته`); return; }
    try {
      const st = await window.Cloud.rpc('review_transfer', { tid: id, ok, msg: msg || '' });
      toast(st === 'approved' ? 'تمت الموافقة، والنقل نهائي' : st === 'pending' ? 'سُجّلت موافقتك، وبقيت موافقة المشرف الآخر' : `رُفض النقل وعاد «${t.studentName}» إلى حلقته`);
    } catch (e) { toast('تعذّر: ' + (e.message || e)); }
    await load(true);
    if (typeof cloudRefresh === 'function') cloudRefresh(true, false, true);   // عودة الطالب لحلقته بعد الرفض
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-trok]'); if (a) { decide(a.dataset.trok, true); return; }
    const r = e.target.closest('[data-trno]'); if (!r) return;
    const t = T.list.find(x => x.id === r.dataset.trno); if (!t) return;
    openForm(`رفض نقل «${t.studentName}»`, [{ type: 'note', label: `يعود الطالب إلى ${t.fromTitle}، ويصل من نقله إشعار بالرفض.` }, { name: 'msg', label: 'السبب (اختياري)', type: 'textarea' }],
      v => { if ((v.msg || '').length > 300) return 'السبب طويل'; setTimeout(() => decide(t.id, false, (v.msg || '').trim()), 0); });
    const sv = [...document.querySelectorAll('.overlay')].pop()?.querySelector('[data-save]'); if (sv) { sv.textContent = 'رفض النقل'; sv.classList.remove('primary'); sv.classList.add('danger'); }
  });

  /* ===== علامة الانتظار بجانب اسم الطالب، والعدد على «الطلاب» في القائمة الجانبية ===== */
  let raf = 0;
  function paint() {
    raf = 0;
    const ids = new Set(T.list.map(t => t.studentId));
    document.querySelectorAll('main [data-act="studentCard"][data-id]').forEach(b => {
      const cell = b.closest('td') || b.parentElement, has = cell?.querySelector('.qtrtag');
      if (ids.has(b.dataset.id) && cell && !has) b.insertAdjacentHTML('afterend', '<span class="tag qtrtag" title="نُقل وينتظر موافقة المشرف">بانتظار موافقة النقل</span>');
      else if (!ids.has(b.dataset.id) && has) has.remove();
    });
    const n = T.list.filter(t => t.canDecide).length, btn = document.querySelector('.side nav.tabs button[data-v="students"]');
    if (btn) { let c = btn.querySelector('.qtrc'); if (n && !c) btn.insertAdjacentHTML('beforeend', `<span class="count qtrc" title="طلبات نقل بانتظار موافقتك">${n}</span>`); else if (c && !n) c.remove(); else if (c && c.textContent !== String(n)) c.textContent = n; }
  }
  new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(paint); }).observe(document.body, { childList: true, subtree: true });
  window.QLTransfers = { list: () => T.list.slice(), load };
})();
