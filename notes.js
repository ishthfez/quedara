'use strict';
/* ============ «ملاحظات» إلى موظف بعينه ============
   (بدل «ملاحظات للإدارة») يختار المرسل الموظف من قائمة مرتبة هجائيًا يُكتب فيها للبحث، مجمّعة حسب التصنيف
   (المدير، المشرفون، المعلمون، المحاسبون، ثم كل مسمى آخر كـ«إداري»)، فتصل الملاحظة إليه وحده في «الإعلانات».
   يحتاج supabase/notes.sql (note_targets و send_note_to)؛ والمدير يرى كل الملاحظات كالعادة. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./notes.js')) VFILES.push('./notes.js'); } catch (e) { /* ignore */ } }, 0);
  const t = TABS.accountant.find(x => x[0] === 'notes'); if (t) t[1] = 'ملاحظات';
  const can = p => (window.Perms ? Perms.can(p) : session?.role === 'admin');
  let targets = null, loading = false, missing = false;
  const GROUP = { admin: 'المدير', supervisor: 'المشرفون', teacher: 'المعلمون', accountant: 'المحاسبون' };
  const groupOf = x => (x.role === 'accountant' && x.title ? x.title : GROUP[x.role] || 'آخرون');
  async function loadTargets(force) {
    if ((targets && !force) || loading) return;
    if (!CLOUD) { targets = ['admins', 'supervisors', 'teachers', 'accountants'].flatMap(k => (db[k] || []).filter(m => m.id !== session?.id).map(m => ({ id: m.id, name: m.name, role: { admins: 'admin', supervisors: 'supervisor', teachers: 'teacher', accountants: 'accountant' }[k], title: m.info?.title || '' }))); return; }
    loading = true;
    try { targets = (await window.Cloud.rpc('note_targets')) || []; missing = false; }
    catch (e) { missing = /note_targets|function|404|PGRST202/i.test(String(e.message || e)); targets = targets || []; }
    loading = false; if (ui.tab === 'notes') render();
  }
  const nameOf = id => (targets || []).find(x => x.id === id)?.name || '';
  /* الإعلانات: الملاحظة الخاصة تظهر لصاحبها وحده (إضافةً إلى ما يخص الجميع ودوره) */
  const mine = n => !!session && n.audience === 'm:' + session.id;
  newsView = function (aud) {
    const list = db.news.filter(n => n.audience === 'all' || n.audience === aud || mine(n)).slice().reverse();
    return `<div class="card"><h2>الإعلانات</h2>${list.length ? list.map(n => `<div class="news">${byLine(n)}${mine(n) ? '<span class="tag tag-ok" style="font-size:.78rem">خاصة بك</span> ' : ''}${esc(n.text)}<br><small>${esc(n.date)}</small></div>`).join('') : empty('لا توجد إعلانات.')}</div>`;
  };
  /* إعلانات المدير: الملاحظة الخاصة تُكتب «إلى فلان» بدل الجمهور */
  const baseNews = adminViews.news;
  adminViews.news = () => {
    const h = baseNews(), byId2 = id => ['admins', 'supervisors', 'teachers', 'accountants'].map(k => byId(db[k] || [], id)).find(Boolean)?.name;
    return h.replace(/<small>([^<]*) — —<\/small>(\s*<button class="btn sm danger" data-act="delNews" data-id="([^"]+)")/g, (m0, d, rest, id) => {
        const n = db.news.find(x => x.id === id); const to = n && /^m:/.test(n.audience) ? byId2(n.audience.slice(2)) : null;
        return `<small>${d} — ${to ? 'إلى ' + esc(to) : '—'}</small>${rest}`;
      });
  };
  /* صفحة «ملاحظات» */
  function view() {
    loadTargets();
    const mineSent = (db.news || []).filter(n => n.authorId && n.authorId === session.id).slice().reverse();
    const toLabel = n => (/^m:/.test(n.audience) ? nameOf(n.audience.slice(2)) || 'موظف' : AUD[n.audience] || '');
    let form;
    if (!can('notes.send')) form = '<p class="muted">لا تملك صلاحية إرسال الملاحظات.</p>';
    else if (missing) form = '<div class="note" style="color:var(--red)">يلزم تنفيذ أمر الخادم <b>supabase/notes.sql</b> في Supabase ← SQL Editor ثم تحديث الصفحة.</div>';
    else if (!targets) form = '<p class="muted">جارٍ تحميل أسماء الموظفين…</p>';
    else {
      const groups = new Map();
      targets.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(x => { const g = groupOf(x); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); });
      const order = ['المدير', 'المشرفون', 'المعلمون', 'المحاسبون'];
      const keys = [...groups.keys()].sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || a.localeCompare(b, 'ar'));
      form = `<label>إلى<select data-nto2 aria-label="الموظف"><option value="">— اختر الموظف —</option>${keys.map(g => `<optgroup label="${esc(g)}">${groups.get(g).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label>الملاحظة<textarea data-ntext2 rows="4" placeholder="اكتب ملاحظتك"></textarea></label>
        <div class="row"><button type="button" class="btn primary" data-nsend2>إرسال</button></div>
        <p class="muted" style="font-size:.85rem;margin:.4rem 0 0">تصل إلى الموظف المختار وحده في «الإعلانات»، موقّعة باسمك. تحتاج اتصالًا بالإنترنت.</p>`;
    }
    return `<div class="card"><h2>ملاحظة جديدة</h2>${form}</div>
      <div class="card"><h2>ملاحظاتي المرسلة</h2>${mineSent.length ? mineSent.map(n => `<div class="news">${esc(n.text)}<br><small>${esc(n.date)} — إلى ${esc(toLabel(n))}</small></div>`).join('') : empty('لم ترسل ملاحظات بعد.')}</div>`;
  }
  VIEWS.accountant.notes = view;
  async function send(btn) {
    const to = document.querySelector('[data-nto2]')?.value, text = document.querySelector('[data-ntext2]')?.value.trim();
    if (!to) { toast('اختر الموظف'); return; }
    if (!text || text.length < 2) { toast('اكتب الملاحظة'); return; }
    if (!CLOUD) { db.news.push({ id: uid(), text, audience: 'm:' + to, date: today(), author: (ROLE_L[session.role] || '') + ' ' + (me()?.name || ''), authorId: session.id }); save(); render(); toast('أُرسلت'); return; }
    try { await window.Cloud.rpc('send_note_to', { target: to, body: text }); toast(`أُرسلت الملاحظة إلى ${nameOf(to)}`); await cloudRefresh(true); render(); }
    catch (e) { toast(navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : 'تعذّر الإرسال: ' + (e.message || e)); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-nsend2]'); if (b && !b.classList.contains('loading')) withBusy(b, send(b)); });
  window.QLNotes = { loadTargets: () => loadTargets(true) };
})();
