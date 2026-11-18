'use strict';
/* ============ سجل الأنشطة (للمدير وحده) ============
   ما يفعله العاملون والطلاب يُسجَّل على الخادم تلقائيًا (supabase/activity.sql)، وهنا يُعرض:
   - بطاقة «سجل الأنشطة» في الصفحة الرئيسية للمدير: عدد أنشطة اليوم لكل فئة، وآخر الأنشطة، وزر «فتح السجل».
   - نافذة السجل كاملًا: تبويبات بالفئة (الكل، المعلمون، المشرفون، الإداريون، المحاسبون، الطلاب)، وتصفية بنوع النشاط،
     وبحث باسم الفاعل أو الطالب، والأنشطة مجمّعة بالأيام، و«عرض المزيد» للأقدم. يُحفظ السجل سنة.
   - الدخول وفتح التطبيق: يُبلَّغ الخادم مرة عند الدخول ومرة عند فتح التطبيق (act_open)، لغير المدير.
   الوصف بالعربية يُكتب هنا من تفاصيل كل نشاط (أسماء الحلقات والسور من بيانات التطبيق).
   بلا خادم (نسخة العرض) لا يوجد سجل. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./activity.js')) VFILES.push('./activity.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const ROLES = [['', 'الكل'], ['teacher', 'المعلمون'], ['supervisor', 'المشرفون'], ['placeadmin', 'الإداريون'], ['accountant', 'المحاسبون'], ['student', 'الطلاب']];
  const ROLE1 = { teacher: 'معلم', supervisor: 'مشرف', placeadmin: 'إداري', accountant: 'محاسب', student: 'طالب' };
  const KINDS = [['', 'كل الأنشطة'], ['att', 'الحضور'], ['rec', 'التسميع'], ['fees', 'التحصيل والاشتراكات'], ['stu', 'الطلاب: إضافة وحالة ونقل'], ['msg', 'الرسائل والإعلانات'], ['abs', 'غياب المعلمين'], ['data', 'الحلقات والأماكن'], ['set', 'الإعدادات'], ['login', 'الدخول']];
  const ICON = { att: '🗓️', rec: '📖', fees: '💰', stu: '👤', msg: '✉️', abs: '⏰', data: '🏫', set: '⚙️', login: '🔑' };
  const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const money = n => NF.format(Math.round((+n || 0) * 100) / 100);
  const isAdm = () => session?.role === 'admin' && !window.QLActAs?.();
  /* المصدر: الخادم؛ ويمكن أن يُستبدل به مصدر آخر (window.QLAct.source = { act_list, act_summary }) للمعاينة والتجربة */
  const live = () => CLOUD || !!window.QLAct?.source;
  const rpc = (fn, args) => (window.QLAct?.source?.[fn] ? Promise.resolve(window.QLAct.source[fn](args || {})) : window.Cloud.rpc(fn, args));
  const errMsg = e => (navigator.onLine === false ? 'لا يوجد اتصال بالإنترنت' : /act_|PGRST202|404/.test(String(e?.message || e)) ? 'نفّذ ملف supabase/activity.sql على الخادم أولًا' : (e?.message || String(e)));

  /* ===== الوصف ===== */
  const q = s => `«${esc(s || '—')}»`;
  const hal = id => { const h = id && byId(db.halaqat, id); return h ? esc(halaqaLabel(h)) : 'بلا حلقة'; };
  const ym = (y, m) => (m ? `${MONTHS[+m - 1]} ${y}` : '');
  const ATT = { present: 'حاضر', late: 'متأخر', absent: 'غائب' };
  const FIELDS = { name: 'الاسم', phone: 'الهاتف', cat: 'الفئة', extra: 'البيانات الإضافية', photo: 'الصورة', info: 'بيانات الاشتراك' };
  const lines = ls => (ls || []).map(l => `${q(l.studentName)} ${money(l.amount)} (${ym(l.y, l.m)})`).join('، ');
  const sum = ls => money((ls || []).reduce((a, l) => a + (+l.amount || 0), 0));
  function desc(e) {
    const d = e.details || {}, t = e.target_name;
    switch (e.kind) {
      case 'att':
        if (e.act === 'delete') return `ألغى حضور ${q(t)} يوم ${esc(d.date || '')}`;
        if (e.act === 'update') return `غيّر حضور ${q(t)} يوم ${esc(d.date || '')} من «${ATT[d.old] || d.old || '—'}» إلى «${ATT[d.status] || d.status}»`;
        return `سجّل حضور ${q(t)}: ${ATT[d.status] || d.status} · ${esc(d.date || '')}`;
      case 'rec': {
        const s = typeof SURAHS !== 'undefined' && SURAHS[+d.surah - 1] ? SURAHS[+d.surah - 1][0] : d.surah;
        const what = `${esc(d.type || 'تسميع')}: سورة ${esc(s || '')} (${esc(d.from || '')}–${esc(d.to || '')})${d.grade ? '، ' + esc(d.grade) : ''}`;
        return e.act === 'delete' ? `حذف تسميع ${q(t)}: ${what}` : e.act === 'update' ? `عدّل تسميع ${q(t)}: ${what}` : `سجّل تسميع ${q(t)}: ${what}`;
      }
      case 'fees':
        if (e.act === 'cn_edit') return [d.added?.length ? `أضاف إلى كشف التحصيل: ${lines(d.added)}` : '', d.removed?.length ? `ألغى من الكشف: ${lines(d.removed)}` : ''].filter(Boolean).join('، و');
        if (e.act === 'cn_send') return `أرسل كشف تحصيل للمحاسب: ${(d.lines || []).length} من الطلاب، ${sum(d.lines)} جنيه`;
        if (e.act === 'cn_finish') { const ok = (d.lines || []).filter(l => l.state === 'ok'), no = (d.lines || []).filter(l => l.state === 'issue'); return `حصّل كشف ${q(t)}: ${ok.length} من الطلاب، ${sum(ok)} جنيه${no.length ? `، وأعاد ${no.length}` : ''}`; }
        if (e.act.startsWith('coll_')) return `${e.act === 'coll_done' ? 'أكّد' : e.act === 'coll_returned' ? 'أعاد' : e.act === 'coll_sent' ? 'أرسل' : 'غيّر'} قائمة تحصيل ${q(t)} (${ym(d.y, d.m)})`;
        if (e.act === 'delete') return `حذف دفعة ${q(t)} عن ${ym(d.y, d.m)}`;
        if (e.act === 'update') return `عدّل دفعة ${q(t)} عن ${ym(d.y, d.m)}: ${money(d.old)} ← ${money(d.amount)} جنيه`;
        return `سجّل دفعة ${q(t)}: ${money(d.amount)} جنيه عن ${ym(d.y, d.m)}`;
      case 'stu':
        if (e.act === 'insert') return `أضاف الطالب ${q(t)}`;
        if (e.act === 'delete') return `حذف الطالب ${q(t)}`;
        if (e.act === 'move') return `نقل ${q(t)} من ${hal(d.from)} إلى ${hal(d.to)}`;
        if (e.act === 'revert') return `أعاد ${q(t)} إلى ${hal(d.to)} بعد رفض نقله`;
        if (e.act === 'status') return `جعل ${q(t)} ${d.status === 'منقطع' ? 'منقطعًا' : 'منتظمًا'}`;
        if (e.act === 'tr_approved') return `وافق على نقل ${q(t)} إلى ${hal(d.to)}`;
        if (e.act === 'approve1') return `وافق على نقل ${q(t)} إلى ${hal(d.to)} (بانتظار المشرف الآخر)`;
        if (e.act === 'tr_rejected') return `رفض نقل ${q(t)} إلى ${hal(d.to)}${d.note ? `: ${esc(d.note)}` : ''}`;
        return `عدّل بيانات ${q(t)}${d.fields?.length ? ` (${d.fields.map(f => FIELDS[f] || f).join('، ')})` : ''}${d.oldName ? ` · الاسم السابق ${q(d.oldName)}` : ''}`;
      case 'msg': {
        const aud = d.audience || '', to = aud.startsWith('m:') ? `إلى ${q(t)}` : aud === 'all' ? 'للجميع' : aud === 'teacher' ? 'للمعلمين' : aud === 'supervisor' ? 'للمشرفين' : aud === 'student' ? 'للطلاب' : aud === 'accountant' ? 'للمحاسبين' : aud ? `(${esc(aud)})` : '';
        return `${e.act === 'delete' ? 'حذف رسالة' : 'أرسل رسالة'} ${to}: «${esc(d.text || '')}»`;
      }
      case 'abs':
        if (e.act === 'update') return `عدّل إثبات غياب ${q(t)} يوم ${esc(d.date || '')}: ${esc(d.oldProof || '—')} ← ${esc(d.proof || '—')}`;
        return `${e.act === 'delete' ? 'حذف غياب' : 'سجّل غياب'} ${q(t)} يوم ${esc(d.date || '')}${d.perm ? ` (${esc(d.perm)}${d.reason ? '، ' + esc(d.reason) : ''})` : ''}`;
      case 'data': return `${e.act === 'insert' ? 'أضاف' : e.act === 'delete' ? 'حذف' : 'عدّل'} ${e.tbl === 'places' ? 'مكانًا' : 'حلقة'}${t ? ' ' + q(t) : e.tbl === 'halaqat' ? ' ' + hal(e.target_id) : ''}`;
      case 'set': return `عدّل الإعدادات${e.target_id === 'priv_fees' ? ' (مبالغ الاشتراك والخصومات)' : ''}`;
      case 'login': return e.act === 'login' ? 'دخل إلى التطبيق' : 'فتح التطبيق';
      default: return esc(e.act);
    }
  }
  const time = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); };
  const day = at => { const d = new Date(at); if (isNaN(d)) return ''; const t = new Date(); const y = new Date(Date.now() - 864e5); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, t) ? 'اليوم' : same(d, y) ? 'أمس' : d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
  const row = e => `<li class="qactrow"><span class="qacti" aria-hidden="true">${ICON[e.kind] || '•'}</span><div class="qactb"><div><b>${esc(e.actor_name || '—')}</b> <small class="muted">${ROLE1[e.actor_role] || ''}</small></div><div>${desc(e)}</div></div><time>${time(e.at)}</time></li>`;
  const grouped = list => { let last = '', h = ''; list.forEach(e => { const d0 = day(e.at); if (d0 !== last) { if (last) h += '</ul>'; h += `<h4 class="qactday">${d0}</h4><ul class="qactlist">`; last = d0; } h += row(e); }); return h ? h + '</ul>' : ''; };

  /* ===== بطاقة الصفحة الرئيسية ===== */
  const SUM = { data: null, at: 0, busy: false, err: '' };
  async function loadSum(force) {
    if (!isAdm() || SUM.busy || (!force && Date.now() - SUM.at < 60000)) return;
    if (!live()) { SUM.err = 'local'; SUM.at = Date.now(); return; }
    SUM.busy = true;
    try { SUM.data = await rpc('act_summary'); SUM.err = ''; } catch (e) { SUM.err = errMsg(e); }
    SUM.at = Date.now(); SUM.busy = false;
    if (ui.tab === 'dash' && !document.querySelector('.overlay')) render();
  }
  function card() {
    const d = SUM.data, today = d?.today || {}, nToday = Object.values(today).reduce((a, b) => a + (+b || 0), 0);
    const chips = ROLES.slice(1).map(([r, l]) => `<button type="button" class="qactchip" data-actopen="${r}"><span>${l}</span><b>${today[r] || 0}</b></button>`).join('');
    const body = SUM.err === 'local' ? '<p class="muted" style="margin:0">السجل يعمل مع الخادم فقط.</p>'
      : SUM.err ? `<p class="muted" style="margin:0">${esc(SUM.err)}</p>`
      : !d ? '<p class="muted" style="margin:0">جارٍ التحميل…</p>'
      : `<div class="qactchips">${chips}</div>${(d.last || []).length ? `<ul class="qactlist qactmini">${d.last.map(row).join('')}</ul>` : '<p class="muted" style="margin:.4rem 0 0">لا أنشطة مسجلة بعد.</p>'}`;
    return `<div class="card qactcard"><div class="bar" style="margin:0 0 .6rem"><h3 class="grow" style="margin:0">سجل الأنشطة <small class="muted" style="font-weight:400">· اليوم ${nToday}${d ? ` · الأسبوع ${d.week || 0}` : ''}</small></h3><button type="button" class="btn sm primary" data-actopen="">فتح السجل</button></div>${body}</div>`;
  }

  /* ===== نافذة السجل ===== */
  const W = { role: '', kind: '', q: '', list: [], more: false, busy: false, err: '' };
  let ov = null, qt = 0;
  async function load(append) {
    if (!live()) { W.err = 'السجل يعمل مع الخادم فقط.'; paint(); return; }
    W.busy = true; paint();
    try {
      const until = append && W.list.length ? W.list[W.list.length - 1].at : null;
      const r = (await rpc('act_list', { who: W.role, what: W.kind, q: W.q.trim(), until_at: until, lim: 100 })) || [];
      W.list = append ? W.list.concat(r) : r; W.more = r.length === 100; W.err = '';
    } catch (e) { W.err = errMsg(e); }
    W.busy = false; paint();
  }
  function body() {
    return `<div class="modal wide qactw"><h2>سجل الأنشطة</h2>
      <div class="qseg qacttabs" role="tablist">${ROLES.map(([r, l]) => `<button type="button" role="tab" data-actrole="${r}" class="${r === W.role ? 'on' : ''}" aria-selected="${r === W.role}">${l}</button>`).join('')}</div>
      <div class="bar qactbar"><select data-actkind aria-label="نوع النشاط">${KINDS.map(([k, l]) => `<option value="${k}" ${k === W.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="search" data-actq value="${esc(W.q)}" placeholder="بحث باسم العامل أو الطالب…" aria-label="بحث"></div>
      ${W.err ? `<p class="muted">${esc(W.err)}</p>` : W.busy && !W.list.length ? '<p class="muted">جارٍ التحميل…</p>' : W.list.length ? grouped(W.list) : '<p class="muted">لا أنشطة هنا.</p>'}
      ${W.more ? `<div class="row" style="justify-content:center"><button type="button" class="btn" data-actmore ${W.busy ? 'disabled' : ''}>عرض المزيد</button></div>` : ''}
      <p class="muted" style="font-size:.8rem;margin:.6rem 0 0">يُحفظ السجل سنة. أفعال المدير نفسه لا تُسجَّل.</p>
      <div class="row"><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
  }
  function paint() {
    if (!ov || !ov.isConnected) return;
    const m0 = ov.querySelector('.modal'), sc = m0?.scrollTop || 0, f = document.activeElement?.matches?.('[data-actq]'), pos = f ? document.activeElement.selectionStart : 0;
    ov.innerHTML = body();
    const m = ov.querySelector('.modal'); if (m) m.scrollTop = sc;
    if (f) { const i = ov.querySelector('[data-actq]'); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }
  function open(role) {
    W.role = role || ''; W.list = []; W.more = false; W.err = '';
    if (!ov || !ov.isConnected) {
      ov = document.createElement('div'); ov.className = 'overlay qactov'; ov.innerHTML = body(); document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        if (e.target.closest('[data-close]') && e.target.closest('.overlay') === ov) { ov.remove(); ov = null; return; }
        const t = e.target.closest('[data-actrole]'); if (t) { W.role = t.dataset.actrole; load(false); return; }
        if (e.target.closest('[data-actmore]')) load(true);
      });
      ov.addEventListener('change', e => { if (e.target.matches('[data-actkind]')) { W.kind = e.target.value; load(false); } });
      ov.addEventListener('input', e => { if (e.target.matches('[data-actq]')) { W.q = e.target.value; clearTimeout(qt); qt = setTimeout(() => load(false), 350); } });
    }
    load(false);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-actopen]'); if (b && isAdm()) open(b.dataset.actopen); });

  const css = document.createElement('style');
  css.textContent = `.qactchips{display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:.45rem;margin-bottom:.6rem}
    .qactchip{display:flex;justify-content:space-between;align-items:center;gap:.4rem;padding:.45rem .7rem;border-radius:10px;border:1px solid var(--line,#e6dfcf);background:var(--card,#fff);font:inherit;cursor:pointer;color:inherit}
    .qactchip b{font-size:1.05rem;color:var(--navy,#13294b)}.qactchip:hover{border-color:var(--navy,#13294b)}
    .qactlist{list-style:none;margin:0;padding:0}.qactrow{display:flex;gap:.6rem;align-items:flex-start;padding:.5rem 0;border-top:1px solid var(--line,#eee6d6)}
    .qactlist .qactrow:first-child{border-top:0}.qacti{flex:none;width:1.6rem;text-align:center;line-height:1.6}
    .qactb{flex:1;min-width:0;line-height:1.6;overflow-wrap:anywhere}.qactrow time{flex:none;font-size:.8rem;color:var(--muted,#777);white-space:nowrap;padding-top:.15rem}
    .qactmini .qactrow{padding:.4rem 0;font-size:.92rem}
    .qactday{margin:.9rem 0 .2rem;font-size:.9rem;color:var(--navy,#13294b)}
    .qacttabs{display:flex;flex-wrap:wrap;margin:0 0 .6rem}.qacttabs button{flex:1 1 auto}
    .qactbar{gap:.5rem;flex-wrap:wrap}.qactbar select{width:auto;flex:0 1 15rem;margin:0}.qactbar input{flex:1 1 12rem;margin:0}`;
  document.head.appendChild(css);

  /* ===== البطاقة في الصفحة الرئيسية (بعد بطاقة «الحلقات والطلاب» والاشتراكات) ===== */
  document.addEventListener('DOMContentLoaded', () => {
    const base = adminViews.dash; if (typeof base !== 'function') return;
    adminViews.dash = function () {
      const h = base.apply(this, arguments);
      if (!isAdm() || typeof h !== 'string') return h;
      loadSum(false);
      /* بعد بطاقتي «الحلقات والطلاب» و«الاشتراكات» إن وُجدتا، وإلا في الأعلى */
      const t = document.createElement('template'); t.innerHTML = h;
      const kids = [...t.content.children], fee = kids.find(k => k.classList?.contains('feecard') || k.querySelector?.(':scope > .feecard')), dc = kids.find(k => k.classList?.contains('qdashcard'));
      const at = fee || dc;
      if (!at) return card() + h;
      at.insertAdjacentHTML('afterend', card());
      return t.innerHTML;
    };
  });

  /* ===== الدخول وفتح التطبيق (لغير المدير) ===== */
  let how = 'open', sent = false;
  document.addEventListener('DOMContentLoaded', () => {
    const C = window.Cloud; if (C && typeof C.signIn === 'function') { const si = C.signIn; C.signIn = async function () { const r = await si.apply(this, arguments); how = 'login'; sent = false; return r; }; }
    const base = render;
    render = function () {
      try {
        if (CLOUD && session && session.role !== 'admin' && !sent && window.Cloud?.signedIn) { sent = true; rpc('act_open', { how }).catch(() => {}); how = 'open'; }
        if (!session) sent = false;
      } catch (e) { /* ignore */ }
      return base.apply(this, arguments);
    };
  });
  window.QLAct = Object.assign(window.QLAct || {}, { desc, open, refresh: () => { SUM.at = 0; loadSum(true); } });
})();
