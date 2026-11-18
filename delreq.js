'use strict';
/* ============ الحذف بموافقة المدير ============
   - المحاسب يضيف المكان والحلقة ويعدّلهما، لكن «حذف» عنده يصير «طلب حذف»: يكتب السبب (إلزامي) فيُرسل للمدير.
     وكذلك الطالب: زر «طلب حذف الطالب» في ملفه.
   - المدير: بطاقة «طلبات حذف بانتظار موافقتك» في الرئيسية (تظهر حين توجد طلبات)، لكل طلب «موافقة وحذف» و«رفض».
     الموافقة تفتح نافذة الحذف المعتادة، وبعد الحذف يُسجَّل القرار؛ والرفض بملاحظة اختيارية.
   - يصل المحاسبَ القرار في «الإعلانات». الخادم: supabase/del_requests.sql (والحذف المباشر فيه للمدير وحده).
   يُحمَّل بعد home.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./delreq.js')) VFILES.push('./delreq.js'); } catch (e) { /* ignore */ } });
  const KIND = { place: 'المكان', halaqa: 'الحلقة', student: 'الطالب' };
  const isReq = () => session?.role === 'accountant';
  const isAdm = () => session?.role === 'admin' && !window.QLActAs?.();
  const L = () => (Array.isArray(db.delreqs) ? db.delreqs : (db.delreqs = []));
  const findT = (k, id) => (k === 'place' ? byId(db.places, id) : k === 'halaqa' ? byId(db.halaqat, id) : byId(db.students, id));
  const nameOf = (k, id) => { const t = findT(k, id); return !t ? '' : k === 'halaqa' ? halaqaLabel(t) : t.name; };
  const errMsg = e => (navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : /del_|PGRST202|404/.test(String(e?.message || e)) ? 'نفّذ ملف supabase/del_requests.sql على الخادم أولًا' : (e?.message || String(e)));
  const fromRow = r => ({ id: r.id, kind: r.kind, targetId: r.target_id, targetName: r.target_name, reason: r.reason, requestedBy: r.requested_by, requestedName: r.requested_name, createdAt: r.created_at });
  /* الخادم، أو القاعدة نفسها على الجهاز بلا خادم (نسخة العرض) */
  const api = {
    async send(kind, tid, reason) {
      if (CLOUD) return window.Cloud.rpc('del_request', { k: kind, tid, why: reason });
      if (L().some(r => r.kind === kind && r.targetId === tid && r.status === 'pending')) throw new Error('أُرسل طلب حذف له من قبل وينتظر المدير');
      L().push({ id: uid(), kind, targetId: tid, targetName: nameOf(kind, tid), reason, requestedBy: session.id, requestedName: me()?.name || '', createdAt: new Date().toISOString(), status: 'pending' });
      save();
    },
    async list() {
      if (CLOUD) return ((await window.Cloud.rpc('del_list', {})) || []).map(fromRow);
      return L().filter(r => r.status === 'pending');
    },
    async decide(id, ok, msg) {
      if (CLOUD) return window.Cloud.rpc('del_decide', { rid: id, ok, msg: msg || '' });
      const r = L().find(x => x.id === id); if (!r || r.status !== 'pending') return;
      r.status = ok ? 'approved' : 'rejected';
      db.news.push({ id: uid(), text: ok ? `وُوفق على حذف ${KIND[r.kind]} «${r.targetName}».` : `رُفض طلب حذف ${KIND[r.kind]} «${r.targetName}»${msg ? ': ' + msg : ''}.`, audience: 'm:' + r.requestedBy, date: today(), author: me()?.name || 'المدير', authorId: session.id });
      save();
    }
  };

  /* نافذة صغيرة فوق ما هو مفتوح (.qinner: تنسيقها في tcollect.js) */
  function small(html, onOk) {
    const p = document.createElement('div'); p.className = 'qinner'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    p.innerHTML = `<div class="qinbox">${html}</div>`;
    document.body.appendChild(p);
    const close = () => { p.remove(); document.removeEventListener('keydown', k, true); };
    const k = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', k, true);
    p.addEventListener('click', e => { if (e.target === p || e.target.closest('[data-close]')) close(); });
    p.querySelector('[data-ok]').onclick = async e => { e.target.disabled = true; try { if (await onOk(p) !== false) close(); else e.target.disabled = false; } catch (err) { e.target.disabled = false; toast(errMsg(err)); } };
    (p.querySelector('textarea') || p.querySelector('[data-close]')).focus({ preventScroll: true });
  }

  /* ===== المحاسب: طلب الحذف ===== */
  function requestDialog(kind, id) {
    const nm = nameOf(kind, id); if (!nm) return;
    small(`<h3>طلب حذف ${KIND[kind]} «${esc(nm)}»</h3>
      <p class="muted" style="font-size:.88rem">يُرسل للمدير ليوافق عليه أو يرفضه، ولا يُحذف شيء الآن.</p>
      <label>سبب الحذف<textarea data-why rows="3" maxlength="500" required></textarea></label>
      <div class="row"><button type="button" class="btn danger" data-ok>إرسال الطلب</button><button type="button" class="btn" data-close>رجوع</button></div>`,
    async p => {
      const why = (p.querySelector('[data-why]').value || '').trim();
      if (!why) { toast('اكتب سبب الحذف'); p.querySelector('[data-why]').focus(); return false; }
      await api.send(kind, id, why);
      toast('أُرسل طلب الحذف للمدير');
    });
  }
  /* «حذف» المكان والحلقة عند المحاسب = طلب حذف */
  document.addEventListener('click', e => {
    if (!isReq()) return;
    const b = e.target.closest('[data-act="delPlace"],[data-act="delHalaqa"]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    b.closest('details')?.removeAttribute('open');
    requestDialog(b.dataset.act === 'delPlace' ? 'place' : 'halaqa', b.dataset.id);
  }, true);
  /* الطالب: زر في ملفه */
  let lastStu = '';
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="studentCard"]'); if (b) lastStu = b.dataset.id || ''; }, true);
  document.addEventListener('click', e => { const b = e.target.closest('[data-delreq-stu]'); if (b && isReq()) requestDialog('student', b.dataset.delreqStu); });
  new MutationObserver(() => {
    if (!isReq() || !lastStu || !byId(db.students, lastStu)) return;
    document.querySelectorAll('.overlay .scard').forEach(c => {
      if (c.querySelector('[data-delreq-stu]')) return;
      const row = [...c.querySelectorAll('.row.noprint')].pop() || [...(c.closest('.overlay')?.querySelectorAll('.row') || [])].pop(); if (!row) return;
      row.insertAdjacentHTML('beforeend', `<button type="button" class="btn danger" data-delreq-stu="${esc(lastStu)}">طلب حذف الطالب</button>`);
    });
  }).observe(document.body, { childList: true, subtree: true });

  /* ===== المدير: بطاقة الطلبات في الرئيسية ===== */
  const R = { list: [], at: 0, busy: false, approving: new Set(), who: '' };
  async function load(force) {
    const who = session ? session.role + ':' + session.id : '';
    if (who !== R.who) { R.who = who; R.at = 0; R.list = []; }   // تبديل الحساب يعيد التحميل
    if (!isAdm() || R.busy || (!force && Date.now() - R.at < 60000)) return;
    R.busy = true;
    try { R.list = await api.list(); } catch (e) { R.list = []; }
    R.at = Date.now(); R.busy = false;
    if (ui.tab === 'dash' && !document.querySelector('.overlay,.qinner')) render();
  }
  /* بعد الموافقة: إذا حُذف العنصر فعلًا يُسجَّل القرار */
  async function settle() {
    for (const r of R.list) {
      if (!R.approving.has(r.id) || findT(r.kind, r.targetId)) continue;
      R.approving.delete(r.id);
      try { await api.decide(r.id, true, ''); toast(`${r.kind === 'halaqa' ? 'حُذفت' : 'حُذف'} ${KIND[r.kind]} «${r.targetName}» وأُبلغ ${r.requestedName || 'صاحب الطلب'}`); } catch (e) { toast(errMsg(e)); }
      await load(true);
    }
  }
  const dt = s => String(s || '').slice(0, 10);
  function card() {
    if (!R.list.length) return '';
    return `<div class="card qdelreq"><h3 style="margin:0 0 .6rem">طلبات حذف بانتظار موافقتك <span class="count">${R.list.length}</span></h3>
      ${R.list.map(r => { const gone = !findT(r.kind, r.targetId);
        return `<div class="qdr"><div class="qdr-b"><b>${KIND[r.kind]} «${esc(r.targetName)}»</b>${gone ? ' <span class="tag">لم يعد موجودًا</span>' : ''}
          <div class="qdr-why">${esc(r.reason)}</div><small class="muted">من ${esc(r.requestedName || '—')} · ${dt(r.createdAt)}</small></div>
          <div class="qdr-a"><button type="button" class="btn sm danger" data-drok="${esc(r.id)}">${gone ? 'إغلاق الطلب' : 'موافقة وحذف'}</button><button type="button" class="btn sm" data-drno="${esc(r.id)}">رفض</button></div></div>`; }).join('')}</div>`;
  }
  document.addEventListener('click', e => {
    if (!isAdm()) return;
    const ok = e.target.closest('[data-drok]'), no = e.target.closest('[data-drno]');
    const r = R.list.find(x => x.id === (ok || no)?.dataset[ok ? 'drok' : 'drno']); if (!r) return;
    if (ok) {
      R.approving.add(r.id);
      if (!findT(r.kind, r.targetId)) { settle(); return; }
      if (r.kind === 'place') A.delPlace({ id: r.targetId });
      else if (r.kind === 'halaqa') A.delHalaqa({ id: r.targetId });
      else delMembersDialog('students', [r.targetId]);
      return;
    }
    small(`<h3>رفض طلب حذف ${KIND[r.kind]} «${esc(r.targetName)}»</h3>
      <label>ملاحظة لصاحب الطلب (اختياري)<textarea data-why rows="2" maxlength="500"></textarea></label>
      <div class="row"><button type="button" class="btn primary" data-ok>رفض الطلب</button><button type="button" class="btn" data-close>رجوع</button></div>`,
    async p => { await api.decide(r.id, false, (p.querySelector('[data-why]').value || '').trim()); toast('رُفض الطلب وأُبلغ صاحبه'); await load(true); render(); });
  });
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.dash; if (typeof base !== 'function') return;
    adminViews.dash = function () {
      const h = base.apply(this, arguments);
      if (!isAdm() || typeof h !== 'string') return h;
      load(R.prevTab !== 'admin:dash'); setTimeout(settle, 0);   // عند فتح الرئيسية من صفحة أخرى: من الخادم مباشرة
      const c = card(); if (!c) return h;
      /* بعد مربع الإعلانات */
      const i = h.indexOf('<div class="card qnhome">');
      const end = i < 0 ? -1 : (() => { let d = 0, m; const re = /<div\b|<\/div>/g; re.lastIndex = i; while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (!d) return m.index + 6; } return -1; })();
      return end > -1 ? h.slice(0, end) + c + h.slice(end) : c + h;
    };
    /* المحاسب: «حذف» تُقرأ «طلب حذف» في «الأماكن والحلقات» */
    const acc = VIEWS.accountant?.halaqat;
    if (acc) VIEWS.accountant.halaqat = function () {
      const h = acc.apply(this, arguments);
      return typeof h !== 'string' ? h : h.replace(/(data-act="delHalaqa"[^>]*>)حذف</g, '$1طلب حذف<').replace(/(data-act="delPlace"[^>]*>)حذف المكان</g, '$1طلب حذف المكان<');
    };
  });
  /* بعد كل رسم: إن حُذف عنصر طلبٍ وافق عليه المدير يُسجَّل القرار */
  document.addEventListener('DOMContentLoaded', () => {
    const baseR = render;
    render = function () { const r = baseR.apply(this, arguments); R.prevTab = session ? session.role + ':' + ui.tab : ''; if (R.approving.size) setTimeout(settle, 0); return r; };
  });

  const css = document.createElement('style');
  css.textContent = `.qdelreq{border:2px solid var(--red,#b3372f)}
    .qdr{display:flex;gap:.6rem;align-items:flex-start;padding:.55rem 0;border-top:1px solid var(--line,#eee6d6)}.qdelreq .qdr:first-of-type{border-top:0}
    .qdr-b{flex:1;min-width:0;line-height:1.6}.qdr-why{white-space:pre-wrap;overflow-wrap:anywhere}.qdr-a{display:flex;flex-direction:column;gap:.3rem;flex:none}
    .qinner textarea{width:100%;box-sizing:border-box}`;
  document.head.appendChild(css);
  window.QLDelReq = { api, refresh: () => load(true) };
})();
