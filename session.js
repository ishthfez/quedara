'use strict';
/* ============ مدة بقاء تسجيل الدخول ============
   لكل فئة قاعدة يضبطها المدير من «الإعدادات» (settings.session_policy):
     idle  = يُطلب الدخول بعد عدم استخدام التطبيق مدة (بالدقائق)   — افتراضيًا للمدير والمحاسبين والإداريين
     month = مرة في بداية كل شهر                                     — افتراضيًا للمشرفين والمعلمين والطلاب
     days  = كل عدد من الأيام، none = لا يُطلب
   عند انتهاء المدة تظهر شاشة قفل تطلب كلمة المرور (بدل الخروج الكامل) حتى لا يضيع ما سُجّل دون إنترنت ولم يُرسل بعد.
   وفيها «تسجيل الخروج» لتبديل المستخدم.
   + واجهة الجوال: مربعات العدادات مربعان في كل صف.
   + مزامنة أسرع (كل 30 ثانية) والتطبيق أمام المستخدم. */
(() => {
  const css = document.createElement('style');
  css.textContent = `
    @media (max-width:640px){ .grid{grid-template-columns:repeat(2,minmax(0,1fr))} .grid .stat{padding:.7rem .5rem} .grid .stat b{font-size:1.35rem} }
    #qlock{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;background:var(--bg,#f5f1e8)}
    #qlock .box{width:100%;max-width:380px;background:#fff;border:1px solid var(--line,#ddd);border-radius:16px;padding:1.4rem;text-align:center;box-shadow:0 12px 40px rgba(19,41,75,.12)}
    #qlock img{width:64px;height:64px;object-fit:contain;margin-bottom:.4rem}
    #qlock h2{margin:.2rem 0 .3rem;font-size:1.15rem}
    #qlock p{margin:.2rem 0 .8rem;color:var(--muted,#666);font-size:.9rem}
    #qlock input{width:100%;margin:.3rem 0 .7rem;text-align:center}
    #qlock .btn{width:100%;justify-content:center;margin-top:.4rem}
    #qlock .warn{background:#fdf1f0;border:1px solid #e8c4c0;color:var(--red,#b3372f);border-radius:10px;padding:.5rem .6rem;font-size:.85rem;margin-top:.7rem}
    .spol td{vertical-align:middle} .spol select{width:auto} .spol input{width:5.5rem}`;
  document.head.appendChild(css);
  setTimeout(() => { try { if (!VFILES.includes('./session.js')) VFILES.push('./session.js'); } catch (e) { /* ignore */ } }, 0);

  const GROUPS = [['admin', 'المدير'], ['accountant', 'المحاسبون والإداريون'], ['supervisor', 'المشرفون'], ['teacher', 'المعلمون'], ['student', 'الطلاب']];
  const DEF = { admin: { mode: 'idle', val: 30 }, accountant: { mode: 'idle', val: 60 }, supervisor: { mode: 'month' }, teacher: { mode: 'month' }, student: { mode: 'month' } };
  const MODES = [['idle', 'عند عدم الاستخدام لمدة', 'دقيقة'], ['days', 'كل عدد من الأيام', 'يوم'], ['month', 'بداية كل شهر', ''], ['none', 'لا يُطلب', '']];
  const policy = () => ({ ...DEF, ...(db?.settings?.session_policy || {}) });
  const C = () => window.Cloud;
  const uidKey = k => k + (C()?.auth?.uid || 'x');
  const getN = k => { try { return +localStorage.getItem(uidKey(k)) || 0; } catch (e) { return 0; } };
  const setN = (k, v) => { try { localStorage.setItem(uidKey(k), String(v)); } catch (e) { /* ignore */ } };
  const ACT = 'qact_', LOGIN = 'qlogin_';
  let locked = false, lastWrite = 0;

  /* بداية الجلسة: وقت الدخول وآخر نشاط */
  const markLogin = () => { const n = Date.now(); setN(LOGIN, n); setN(ACT, n); };
  if (C()) {
    const orig = C().signIn.bind(C());
    C().signIn = async (...a) => { const r = await orig(...a); markLogin(); return r; };
  }
  /* أي استخدام للتطبيق يُحسب نشاطًا (يُكتب كل 15 ثانية على الأكثر، ويشترك فيه كل ما فُتح من التطبيق على الجهاز) */
  const touch = () => { if (locked || !C()?.auth) return; const n = Date.now(); if (n - lastWrite > 15000) { lastWrite = n; setN(ACT, n); } };
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, touch, { passive: true, capture: true }));

  function reason() {
    if (!CLOUD || !session || !C()?.auth) return '';
    const P = policy()[session.role] || { mode: 'none' }, now = Date.now();
    let act = getN(ACT), li = getN(LOGIN);
    if (!act) { setN(ACT, now); act = now; }
    if (!li) { setN(LOGIN, now); li = now; }
    if (P.mode === 'idle' && +P.val > 0 && now - act > P.val * 60000) return `لم يُستخدم التطبيق منذ أكثر من ${P.val} دقيقة.`;
    if (P.mode === 'days' && +P.val > 0 && now - li > P.val * 864e5) return `مرّ أكثر من ${P.val} ${+P.val === 1 ? 'يوم' : 'أيام'} على آخر تسجيل دخول.`;
    if (P.mode === 'month') { const a = new Date(li), b = new Date(now); if (a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth()) return 'بداية شهر جديد: سجّل الدخول من جديد.'; }
    return '';
  }
  function lock(why) {
    if (locked || document.getElementById('qlock')) return;
    locked = true;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    const n = (() => { try { return C().pendingCount(db); } catch (e) { return 0; } })();
    const el = document.createElement('div'); el.id = 'qlock';
    el.innerHTML = `<div class="box"><img src="${esc(db?.settings?.logo || 'logo.png')}" alt="">
      <h2>${esc(db?.settings?.org || 'إدارة الحلقات القرآنية')}</h2>
      <p>${esc(why)}<br>أدخل كلمة المرور للمتابعة يا <b>${esc(me()?.name || '')}</b>.</p>
      <input type="password" data-lockpw autocomplete="current-password" aria-label="كلمة المرور" placeholder="كلمة المرور">
      <button type="button" class="btn primary" data-unlock>دخول</button>
      <button type="button" class="btn" data-lockout>تسجيل الخروج (مستخدم آخر)</button>
      ${n ? `<div class="warn">على هذا الجهاز ${n} تغيير لم يُرسل إلى الخادم بعد. سجّل الدخول ليُرسل، ولا تسجّل الخروج قبل ذلك.</div>` : ''}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.querySelector('[data-lockpw]')?.focus(), 50);
  }
  async function unlock(btn) {
    const el = document.getElementById('qlock'), pw = el?.querySelector('[data-lockpw]')?.value || '';
    if (!pw) { toast('اكتب كلمة المرور'); return; }
    if (navigator.onLine === false) { toast('لا يوجد اتصال بالإنترنت: اتصل ثم أعد المحاولة'); return; }
    try { await C().testSignIn(C().auth.email, pw); } catch (e) { toast(/fetch|network/i.test(e.message || '') ? 'تعذّر الاتصال بالخادم، أعد المحاولة' : 'كلمة المرور غير صحيحة'); return; }
    markLogin(); locked = false; el.remove(); toast('مرحبًا بعودتك');
    try { cloudRefresh(true); } catch (e) { /* ignore */ }
  }
  document.addEventListener('click', e => {
    const u = e.target.closest('[data-unlock]'); if (u) { withBusy(u, unlock(u)); return; }
    if (e.target.closest('[data-lockout]')) {
      const n = (() => { try { return C().pendingCount(db); } catch (err) { return 0; } })();
      const go = () => { locked = false; document.getElementById('qlock')?.remove(); A.logout?.(); };
      if (n) ask(`على هذا الجهاز ${n} تغيير لم يُرسل بعد، وسيضيع إن خرجت الآن. الخروج رغم ذلك؟`, go); else go();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-lockpw]')) document.querySelector('[data-unlock]')?.click(); });
  const check = () => { const r = reason(); if (r) lock(r); };
  setInterval(check, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
  /* بعد كل عرض للصفحة (ومنه أول فتح للتطبيق) */
  new MutationObserver(() => { if (!locked && document.querySelector('.shell')) check(); }).observe(document.getElementById('app') || document.body, { childList: true });

  /* ===== «الإعدادات» (للمدير): بطاقة «مدة بقاء تسجيل الدخول» ===== */
  const baseSettings = adminViews.settings;
  adminViews.settings = () => {
    const h = baseSettings();
    if (!CLOUD) return h;
    const P = policy();
    const rows = GROUPS.map(([k, l]) => {
      const p = P[k], unit = (MODES.find(m => m[0] === p.mode) || [])[2];
      return `<tr data-spol="${k}"><td><b>${l}</b></td><td><select data-spm>${MODES.map(([v, t]) => `<option value="${v}" ${p.mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td>${unit ? `<input type="number" min="1" step="1" data-spv value="${esc(p.val || (p.mode === 'idle' ? 30 : 30))}"> <span class="muted" data-spu>${unit}</span>` : '<span class="muted">—</span>'}</td></tr>`;
    }).join('');
    return h + `<div class="card"><h2>مدة بقاء تسجيل الدخول</h2>
      <p class="muted" style="margin:0 0 .7rem">متى يُطلب من كل فئة إدخال كلمة المرور من جديد. تظهر عندها شاشة قفل، ويبقى ما على الجهاز كما هو (حتى ما سُجّل دون إنترنت).</p>
      <div class="tbl spol" data-pr="1" data-zm="1"><table><tr><th>الفئة</th><th>يُطلب الدخول</th><th>المدة</th></tr>${rows}</table></div>
      <div class="bar" style="margin:.8rem 0 0"><button type="button" class="btn primary" data-spsave>حفظ</button><button type="button" class="btn" data-spdef>القيم الافتراضية</button></div></div>`;
  };
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-spm]'); if (!s) return;
    const td = s.closest('tr').cells[2], unit = (MODES.find(m => m[0] === s.value) || [])[2];
    const def = s.value === 'idle' ? 30 : 30;
    td.innerHTML = unit ? `<input type="number" min="1" step="1" data-spv value="${def}"> <span class="muted" data-spu>${unit}</span>` : '<span class="muted">—</span>';
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-spdef]')) { db.settings.session_policy = { ...DEF }; save(); render(); toast('عادت القيم الافتراضية'); return; }
    if (!e.target.closest('[data-spsave]')) return;
    const out = {};
    for (const tr of document.querySelectorAll('[data-spol]')) {
      const mode = tr.querySelector('[data-spm]').value, v = tr.querySelector('[data-spv]');
      if (v && !(+v.value >= 1)) { toast('المدة رقم أكبر من صفر'); v.focus(); return; }
      out[tr.dataset.spol] = v ? { mode, val: Math.round(+v.value) } : { mode };
    }
    db.settings.session_policy = out; save(); render(); toast('حُفظت مدة بقاء تسجيل الدخول');
  });
  /* ===== مزامنة أسرع: كل 30 ثانية والتطبيق أمام المستخدم (بدل دقيقتين) =====
     فما يضيفه المدير (حلقة، مكان، طالب…) يظهر عند الآخرين خلال نصف دقيقة تقريبًا.
     لا تحدث أثناء الكتابة أو مع نافذة مفتوحة حتى لا تُعاد رسم الصفحة، والسؤال عن التغييرات طلب صغير جدًا. */
  setInterval(() => {
    if (!CLOUD || document.hidden || locked || !session || ui.refreshing || document.querySelector('.overlay')) return;
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('main')) return;
    if (Date.now() - (ui.syncedAt || 0) < 25000) return;
    try { cloudRefresh(true); } catch (e) { /* ignore */ }
  }, 30000);
  /* للاختبار والتشخيص */
  window.QLSession = { reason, lock, policy, markLogin };
})();
