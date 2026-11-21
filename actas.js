'use strict';
/* ============ «العمل بصفة»: المدير يعمل في التطبيق كأنه فئة أخرى ============
   - يختار المدير الفئة (محاسب، معلم، مدير عام، مشرف، إداري، طالب) ثم الشخص، فيتحول التطبيق إلى واجهته كما يراها هو:
     قائمته وصفحة بدايته وأزراره وصلاحياته (المحددة له في «الصلاحيات»)، ويعمل أعماله كاملة.
   - الخادم يعرفه مديرًا فيقبل كل عمل؛ وكل ما يُسجَّل يُكتب باسم المدير لا باسم من يعمل بصفته
     (الدفعات وإيصالاتها، وغياب المعلمين، وقوائم التحصيل، والإشعارات)، حتى لا تختلط الأمور.
   - شريط ثابت أعلى الشاشة يذكّر بالوضع، وفيه «رجوع إلى المدير». إعادة تحميل الصفحة تعيد المدير أيضًا.
     وفي الشريط نفسه قائمتا الفئة والشخص: التبديل منهما إلى غيره مباشرة، دون الرجوع إلى المدير أولًا.
   - العرض على الأجهزة (بدل قسم «المعاينة» الذي أُزيل): في الشريط «الحاسوب · التابلت · الجوال». التابلت والجوال يفتحان التطبيق نفسه
     في إطار بمقاس الجهاز (تعمل فيه تنسيقات الشاشات الصغيرة كما على الجهاز)، يعمل فيه المدير بصفة الشخص نفسه عملًا كاملًا.
     الإطار نسخة من التطبيق بالعنوان نفسه ومعه «#qframe=الفئة:المعرّف»، فيبدأ فيها العمل بصفته تلقائيًا ويُخفي شريطه؛
     وعند الرجوع إلى «الحاسوب» أو إلى Admin تُحدَّث بيانات الصفحة الأصلية بما سُجّل في الإطار.
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
  /* الأجهزة: [المفتاح، الاسم، العرض، الارتفاع] */
  const DEVS = [['desk', 'الحاسوب'], ['tab', 'التابلت', 820, 1180], ['mob', 'الجوال', 390, 844]];
  let dev = 'desk';
  const FRAMED = window.top !== window && /^#qframe=/.test(location.hash);
  if (FRAMED) document.documentElement.classList.add('qframe');

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
    render(); bar(); window.scrollTo(0, 0); frame();
    if (!FRAMED) toast(`تعمل الآن بصفة ${roleL(cat)} «${m.name}»`);
  }
  function exit() {
    if (!act) return;
    fixBy();
    session = { role: 'admin', id: act.adminId };
    act = null; ui.tab = null; ui.hid = ''; ui.nav = false;
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    dev = 'desk'; frame();
    render(); bar(); window.scrollTo(0, 0);
    toast('رجعت إلى حساب Admin');
  }

  /* ===== العرض على الأجهزة: إطار بمقاس التابلت أو الجوال فيه التطبيق بصفة الشخص نفسه ===== */
  function frame() {
    if (FRAMED) return;
    let f = document.getElementById('asframe');
    const d = DEVS.find(x => x[0] === dev);
    if (!act || !d || dev === 'desk') {
      if (f) { f.remove(); document.documentElement.classList.remove('asframe-on'); syncBack(); }
      return;
    }
    const src = location.pathname + location.search + '#qframe=' + encodeURIComponent(act.cat + ':' + act.id);
    if (!f) {
      f = document.createElement('div'); f.id = 'asframe';
      f.innerHTML = '<div class="asfw"><iframe title="العرض على الجهاز"></iframe></div><p class="asfcap"></p>';
      document.body.appendChild(f); document.documentElement.classList.add('asframe-on');
    }
    const ifr = f.querySelector('iframe');
    ifr.width = d[2]; ifr.height = d[3];
    if (ifr.dataset.src !== src) { ifr.dataset.src = src; ifr.src = src; }
    f.querySelector('.asfcap').textContent = `${d[1]} (${d[2]}×${d[3]}) · ${roleL(act.cat)} «${act.name}» · ما تسجّله هنا يُكتب باسمك`;
    fitFrame();
  }
  /* الإطار بمقاس الجهاز الحقيقي، مصغّرًا ليتسع في الشاشة */
  function fitFrame() {
    const f = document.getElementById('asframe'); if (!f) return;
    const ifr = f.querySelector('iframe'), W = +ifr.width + 20, H = +ifr.height + 20;
    const k = Math.min(1, (f.clientWidth - 24) / W, (f.clientHeight - 56) / H);
    ifr.style.transform = `scale(${k})`;
    const w = f.querySelector('.asfw'); w.style.width = W * k + 'px'; w.style.height = H * k + 'px';
  }
  window.addEventListener('resize', fitFrame);
  /* بعد إغلاق الإطار: بيانات الصفحة الأصلية بما سُجّل فيه (الخادم، أو نسخة الجهاز في الوضع المحلي) */
  function syncBack() {
    try {
      if (typeof CLOUD !== 'undefined' && CLOUD) { if (typeof cloudRefresh === 'function') cloudRefresh(true).then(() => render()).catch(() => { /* ignore */ }); }
      else if (typeof load === 'function') { db = load(); render(); }
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#actasbar [data-asdev]'); if (!b || !act) return;
    dev = b.dataset.asdev; bar(); frame();
  });
  /* داخل الإطار: العمل بصفة الشخص المذكور في العنوان تلقائيًا (والتبديل من الشريط في الصفحة الأصلية يغيّر العنوان) */
  if (FRAMED) {
    const go = async () => {
      const [cat, id] = decodeURIComponent(location.hash.replace(/^#qframe=/, '')).split(':');
      for (let i = 0; i < 120; i++) {
        if (act && act.cat === cat && act.id === id) return;
        const ok = people(cat).some(m => m.id === id);
        if (ok && act) { swap(cat, id); return; }
        if (ok && session?.role === 'admin') { enter(cat, id); return; }
        await new Promise(r => setTimeout(r, 150));
      }
    };
    document.addEventListener('DOMContentLoaded', () => setTimeout(go, 300));
    window.addEventListener('hashchange', go);
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
    /* ما يصل من الخادم بالمزامنة سجّله صاحبه الحقيقي من جهازه: يُعلَّم «مُراجَعًا» فلا يُنسب للمدير.
       (كان fixBy يعيد نسبة أي دفعة أو غياب جديد باسم الشخص، ولو سجّله الشخص نفسه في الوقت ذاته، فيُفسد سجل من سجّل) */
    if (typeof cloudRefresh === 'function') {
      const baseRefresh = cloudRefresh;
      cloudRefresh = async (...a) => {
        const r = await baseRefresh(...a);
        if (act) { (db.fees || []).forEach(f => act.feeIds.add(f.id)); (db.payroll?.absences || []).forEach(x => act.absIds.add(x.id)); }
        return r;
      };
    }
  });

  /* ===== الشريط الثابت أعلى الشاشة ===== */
  const css = document.createElement('style');
  css.textContent = `#actasbar{position:fixed;top:0;inset-inline:0;z-index:60;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:center;
      padding:max(.45rem,env(safe-area-inset-top)) .8rem .45rem;background:#8a4b0f;color:#fff;font-weight:700;font-size:.92rem;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    #actasbar small{font-weight:400;opacity:.9}#actasbar .btn{background:#fff;color:#8a4b0f;border:0;min-height:32px;padding:0 .8rem}
    #actasbar select,#actasbar .qcombo-in{width:auto;max-width:15rem;min-height:32px;margin:0;padding:0 .5rem;border:0;border-radius:8px;background:#fff;color:#8a4b0f;font:inherit;font-weight:700}
    #actasbar .qcombo{width:auto;max-width:15rem;margin:0}
    html.actas body{padding-top:var(--actas-h,44px)}html.actas .content .top{top:var(--actas-h,44px)}
    .side .actas-btn{display:block;width:100%;margin:.45rem 0 0;font-size:.82rem}
    #actasbar .asdev{display:inline-flex;gap:.2rem;padding:.15rem;border-radius:10px;background:rgba(255,255,255,.18)}
    #actasbar .asdev .btn{background:transparent!important;color:#fff!important;min-height:28px;padding:0 .6rem}#actasbar .asdev .btn.on{background:#fff!important;color:#8a4b0f!important}
    #asframe{position:fixed;top:var(--actas-h,44px);inset-inline:0;bottom:0;z-index:58;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;padding:12px;background:#0b111a}
    #asframe .asfw{position:relative;flex:none;direction:ltr}
    #asframe iframe{position:absolute;top:0;left:0;transform-origin:top left;border:10px solid #1f2733;border-radius:26px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.4)}
    #asframe .asfcap{margin:0;color:#cfd6e0;font-size:.82rem;text-align:center}
    html.asframe-on body{overflow:hidden}
    html.qframe #actasbar,html.qframe #demobar{display:none!important}
    html.qframe body{padding-top:0!important}html.qframe .content .top{top:0!important}
    /* نسخة العرض (demo.js): نافذة الترحيب لا تظهر داخل الإطار، وشريط العمل بصفة تحت شريط نسخة العرض */
    html.qframe .overlay:has(.demo-pick){display:none!important}
    html.demo #actasbar{top:var(--demo-h,44px)}html.demo.actas body{padding-top:calc(var(--demo-h,44px) + var(--actas-h,44px))}
    html.demo.actas .content .top{top:calc(var(--demo-h,44px) + var(--actas-h,44px))}html.demo #asframe{top:calc(var(--demo-h,44px) + var(--actas-h,44px))}`;
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
      <span class="asdev" role="group" aria-label="العرض على">${DEVS.map(([k, l]) => `<button type="button" class="btn sm ${k === dev ? 'on' : ''}" data-asdev="${k}">${l}</button>`).join('')}</span>
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
