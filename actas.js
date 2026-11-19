'use strict';
/* ============ «العمل بصفة»: المدير يعمل في التطبيق كأنه فئة أخرى ============
   - يختار المدير الفئة (محاسب، معلم، مدير عام، مشرف، إداري، طالب) ثم الشخص، فيتحول التطبيق إلى واجهته كما يراها هو:
     قائمته وصفحة بدايته وأزراره وصلاحياته (المحددة له في «الصلاحيات»)، ويعمل أعماله كاملة.
   - الخادم يعرفه مديرًا فيقبل كل عمل؛ وكل ما يُسجَّل يُكتب باسم المدير لا باسم من يعمل بصفته
     (الدفعات وإيصالاتها، وغياب المعلمين، وقوائم التحصيل، والإشعارات)، حتى لا تختلط الأمور.
   - شريط ثابت أعلى الشاشة يذكّر بالوضع، وفيه «رجوع إلى المدير». إعادة تحميل الصفحة تعيد المدير أيضًا.
     وفي الشريط نفسه قائمتا الفئة والشخص: التبديل منهما إلى غيره مباشرة، دون الرجوع إلى المدير أولًا.
   يُحمَّل بعد perms.js و fees.js وقبل app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./actas.js')) VFILES.push('./actas.js'); } catch (e) { /* ignore */ } });
  /* «المدير العام» فئة مستقلة في القائمة، وهو على الخادم مشرف نطاقه «الكل» (roles.js) فيعمل بواجهة المشرف وصلاحياته */
  const ROLES = [['accountant', 'المحاسب', 'accountants'], ['teacher', 'المعلم', 'teachers'], ['gmanager', 'المدير العام', 'supervisors'], ['supervisor', 'المشرف', 'supervisors'], ['placeadmin', 'الإداري', 'placeadmins'], ['student', 'الطالب', 'students']];
  const roleL = r => (ROLES.find(x => x[0] === r) || [, r])[1];
  const gen = m => !!window.isGenSup?.(m);
  const people = k => { const c = ROLES.find(x => x[0] === k)?.[2], L = db[c] || []; return k === 'gmanager' ? L.filter(gen) : k === 'supervisor' ? L.filter(m => !gen(m)) : L; };
  const sessRole = k => (k === 'gmanager' ? 'supervisor' : k);
  let act = null;   // { role (فئة الجلسة), cat (الفئة المختارة في القائمة), id, name, adminId, adminName, feeIds, absIds }
  window.QLActAs = () => act;

  /* ===== الصلاحيات بصفة الشخص: استثناؤه ← اختيار فئته ← الافتراضي (كما يحسبها الخادم له) ===== */
  if (window.Perms) {
    const baseCan = Perms.can;
    Perms.can = p => {
      if (!act) return baseCan(p);
      const c = db.settings.priv_perms || {}, o = (c.members || {})[act.id]?.[p];
      if (o !== undefined) return !!o;
      /* المدير العام: صلاحياته على الخادم في roles.gmanager (has_perm بنوعه الحقيقي)، لا في roles.supervisor؛
         وقبل gmanager_role.sql (الخادم لا يعرف النوع) تبقى بصلاحيات المشرف كما كان */
      const pr = act.cat === 'gmanager' && window.Cloud?.gmReady !== false ? 'gmanager' : act.role;
      const r = (c.roles || {})[pr]?.[p];
      if (r !== undefined) return !!r;
      return !!Perms.list.find(d => d.key === p)?.defaults?.includes(pr);
    };
  }

  /* ===== الدخول والخروج ===== */
  function enter(cat, id) {
    const role = sessRole(cat), m = byId(people(cat), id);
    if (!m || session?.role !== 'admin') return;
    const admin = me();
    act = { role, cat, id, name: m.name, adminId: session.id, adminName: admin?.name || 'المدير',
      feeIds: new Set((db.fees || []).map(f => f.id)), absIds: new Set((db.payroll?.absences || []).map(a => a.id)) };
    session = { role, id };
    ui.tab = null; ui.hid = ''; ui.nav = false;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    render(); bar(); window.scrollTo(0, 0);
    toast(`تعمل الآن بصفة ${roleL(cat)} «${m.name}»`);
  }
  function exit() {
    if (!act) return;
    fixBy();
    session = { role: 'admin', id: act.adminId };
    act = null; ui.tab = null; ui.hid = ''; ui.nav = false;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    render(); bar(); window.scrollTo(0, 0);
    toast('رجعت إلى حساب Admin');
  }
  window.QLActExit = exit;

  /* ===== كل ما يُسجَّل أثناء العمل بصفة غيره يُكتب باسم المدير ===== */
  const asLabel = () => `${/^المدير/.test(act.adminName) ? act.adminName : 'المدير ' + act.adminName} (بصفة ${roleL(act.cat)})`;
  function fixBy() {
    if (!act) return false;
    let n = 0;
    (db.fees || []).forEach(f => {
      if (act.feeIds.has(f.id)) return; act.feeIds.add(f.id);
      if (f.byMember === act.id || f.by === act.name) { f.by = asLabel(); f.byMember = act.adminId; n++; }
    });
    (db.payroll?.absences || []).forEach(a => {
      if (act.absIds.has(a.id)) return; act.absIds.add(a.id);
      if (a.byMember === act.id || a.by === act.name) { a.by = asLabel(); a.byMember = act.adminId; n++; }
    });
    if (n) save();
    return n > 0;
  }
  /* بعد كل ضغطة أو تغيير (حفظ دفعة أو غياب): التصحيح قبل الإيصال (يظهر بعد 60 ملي ثانية) وقبل الإرسال للخادم */
  ['click', 'change'].forEach(t => document.addEventListener(t, () => { if (act) setTimeout(fixBy, 0); }, true));

  /* قائمة تحصيل المعلم أو الإداري: يرسلها المدير نيابة عنه باسمه هو (supabase/actas.sql) */
  document.addEventListener('DOMContentLoaded', () => {
    const C = window.Cloud; if (!C?.rpc) return;
    const baseRpc = C.rpc;
    C.rpc = (fn, args = {}, anon) => {
      if (act && fn === 'save_collection') return baseRpc('save_collection_as', { who: act.id, ...args }, anon).catch(e => {
        if (/save_collection_as|PGRST202|404/i.test(String(e.message || e))) throw new Error('نفّذ ملف supabase/actas.sql على الخادم أولًا');
        throw e;
      });
      return baseRpc(fn, args, anon);
    };
    /* الخروج من الحساب يُنهي العمل بصفة غيره */
    if (A?.logout) { const lo = A.logout; A.logout = d => { act = null; bar(); return lo(d); }; }
  });

  /* ===== الشريط الثابت أعلى الشاشة ===== */
  const css = document.createElement('style');
  css.textContent = `#actasbar{position:fixed;top:0;inset-inline:0;z-index:60;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:center;
      padding:max(.45rem,env(safe-area-inset-top)) .8rem .45rem;background:#8a4b0f;color:#fff;font-weight:700;font-size:.92rem;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    #actasbar small{font-weight:400;opacity:.9}#actasbar .btn{background:#fff;color:#8a4b0f;border:0;min-height:32px;padding:0 .8rem}
    #actasbar select,#actasbar .qcombo-in{width:auto;max-width:15rem;min-height:32px;margin:0;padding:0 .5rem;border:0;border-radius:8px;background:#fff;color:#8a4b0f;font:inherit;font-weight:700}
    #actasbar .qcombo{width:auto;max-width:15rem;margin:0}
    html.actas body{padding-top:var(--actas-h,44px)}html.actas .content .top{top:var(--actas-h,44px)}
    .side .actas-btn{display:block;width:100%;margin:.45rem 0 0;font-size:.82rem}`;
  document.head.appendChild(css);
  function bar() {
    let b = document.getElementById('actasbar');
    document.documentElement.classList.toggle('actas', !!act);
    if (!act) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'actasbar'; document.body.appendChild(b); }
    /* التبديل من الشريط نفسه: الفئة ثم الشخص، فيتحول التطبيق إليه مباشرة دون الرجوع إلى المدير */
    const ppl = people(act.cat).slice().sort((a, c) => a.name.localeCompare(c.name, 'ar'));
    b.innerHTML = `<span>تعمل الآن بصفة</span>
      <select data-asbr aria-label="الفئة">${ROLES.map(([k, l]) => `<option value="${k}" ${k === act.cat ? 'selected' : ''} ${people(k).length ? '' : 'disabled'}>${l}</option>`).join('')}</select>
      <select data-asbp aria-label="الشخص">${ppl.map(m => `<option value="${esc(m.id)}" ${m.id === act.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <small>كل ما تسجّله يُكتب باسمك</small><button type="button" class="btn sm" data-actas-exit>رجوع إلى Admin</button>`;
    requestAnimationFrame(() => document.documentElement.style.setProperty('--actas-h', b.offsetHeight + 'px'));
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-actas-exit]')) exit(); });
  /* تبديل الشخص أو الفئة من الشريط: يُغلق العمل بصفة الحالي بهدوء ثم يبدأ بالجديد */
  function swap(cat, id) {
    if (!act || !id || (cat === act.cat && id === act.id)) return;
    fixBy();
    session = { role: 'admin', id: act.adminId };
    act = null;
    enter(cat, id);
  }
  document.addEventListener('change', e => {
    const t = e.target; if (!act || !t.closest?.('#actasbar')) return;
    if (t.matches('[data-asbr]')) {
      const first = people(t.value).slice().sort((a, c) => a.name.localeCompare(c.name, 'ar'))[0];
      if (first) swap(t.value, first.id);
    } else if (t.matches('[data-asbp]')) swap(act.cat, t.value);
  });

  /* ===== زر «العمل بصفة…» في القائمة الجانبية للمدير ===== */
  new MutationObserver(() => {
    if (session?.role !== 'admin' || act) return;
    const brand = document.querySelector('.side .brand > div'); if (!brand || brand.querySelector('[data-actas]')) return;
    brand.insertAdjacentHTML('beforeend', '<button type="button" class="btn sm actas-btn" data-actas>العمل بصفة…</button>');
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => { if (e.target.closest('[data-actas]') && session?.role === 'admin') dialog(); });

  function dialog() {
    let role = 'accountant';
    const ov = document.createElement('div'); ov.className = 'overlay';
    const opts0 = () => {
      return people(role).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(m => {
        const extra = role === 'student' ? hName(m.halaqaId) : role === 'gmanager' ? 'كل الحلقات' : role === 'teacher' || role === 'supervisor' ? db.halaqat.filter(h => (role === 'teacher' ? h.teacherId : h.supervisorId) === m.id).length + ' حلقة' : '';
        return `<option value="${esc(m.id)}">${esc(m.name)}${extra ? ' — ' + esc(extra) : ''}</option>`;
      }).join('');
    };
    const draw = () => {
      const opts = opts0();
      ov.innerHTML = `<div class="modal"><h2>العمل بصفة…</h2>
        <p class="muted" style="margin:0 0 .6rem;font-size:.88rem">يتحول التطبيق إلى واجهة من تختاره كما يراها هو، بصلاحياته، وتعمل أعماله كاملة. كل ما تسجّله يُكتب باسمك أنت لا باسمه، وترجع إلى حساب Admin من الشريط أعلى الشاشة.</p>
        <label>الفئة<select data-asr>${ROLES.map(([k, l]) => `<option value="${k}" ${k === role ? 'selected' : ''}>${l} (${people(k).length})</option>`).join('')}</select></label>
        <label>الشخص${opts ? `<select data-asp>${opts}</select>` : '<p class="muted">لا يوجد أحد في هذه الفئة.</p>'}</label>
        <div class="row"><button type="button" class="btn primary" data-asgo ${opts ? '' : 'disabled'}>ابدأ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    };
    draw(); document.body.appendChild(ov);
    ov.addEventListener('change', e => { if (e.target.matches('[data-asr]')) { role = e.target.value; draw(); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { ov.remove(); return; }
      if (e.target.closest('[data-asgo]')) { const id = ov.querySelector('[data-asp]')?.value; ov.remove(); if (id) enter(role, id); }
    });
  }
})();
