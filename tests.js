'use strict';
/* ============ اختبارات الطلاب ============
   - زر «الاختبارات» في صف كل طالب (بجانب «سجل الإنجاز») يفتح قائمة خياراتها:
     «متابعة»: اختبار يتابع به المشرف مستوى الطالب (الأساسيات، والحفظ الجديد، والمراجعة (1) و(2)، وملاحظات التجويد).
     «الفصول»: الفصل الأول والثاني والثالث، في كل فصل اختبار نصفي ونهائي: سؤال في الجديد وسؤال أو اثنان في المراجعة،
       ودرجات تكميلية (الجهد)، والإجمالي يُحسب فورًا. يسجّلها معلم الحلقة أو مشرفها، ودرجاتها من «الإعدادات ← إدارة الاختبارات».
     «إتقان»: أربعة أسئلة في جزء، والنجاح بنسبة لا تقل عن حد «إدارة الاختبارات» (مبدئيًا 95%). للمشرف، وللمعلم بصلاحية «اختبار الإتقان».
     «سجل الاختبارات»: ما سُجّل للطالب، بثلاثة تبويبات (متابعة · الفصول · إتقان)، وهو أيضًا قسم في ملف الطالب.
     الطالب والحلقة يُعرفان من الصف نفسه، فلا يُسألان في الاستمارة.
   - من يختبر: المدير، والمدير العام، ومشرف حلقة الطالب، ومعلم الحلقة إذا مُنح صلاحية «اختبار المتابعة» (tests.follow)
     من «الصلاحيات» (لفئة المعلمين كلها أو لمعلم بعينه).
   - الحفظ على الخادم في جدول student_tests بالدوال test_list / test_add / test_del (supabase/tests.sql)،
     وفي الوضع المحلي (?local=1) في db.tests على الجهاز. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./tests.js')) VFILES.push('./tests.js'); } catch (e) { /* ignore */ } });
  try { Perms.define({ key: 'tests.follow', label: 'اختبار المتابعة', desc: 'اختبار «متابعة» لطلاب حلقاته كما يفعل مشرف الحلقة', group: 'الحلقات والطلاب', defaults: [], roles: ['teacher'] }); } catch (e) { /* ignore */ }
  try { Perms.define({ key: 'tests.view', label: 'الاطلاع على سجلات الاختبارات', desc: 'يرى «سجل الاختبارات» للطلاب (متابعة والفصول والإتقان) دون أن يختبر', group: 'الحلقات والطلاب', defaults: [], roles: ['accountant'] }); } catch (e) { /* ignore */ }
  try { Perms.define({ key: 'tests.itqan', label: 'اختبار الإتقان', desc: 'اختبار «إتقان» (أربعة أسئلة في جزء) لطلاب حلقاته كما يفعل مشرف الحلقة', group: 'الحلقات والطلاب', defaults: [], roles: ['teacher'] }); } catch (e) { /* ignore */ }

  const BASICS = ['مصحف مناسب', 'كراسة', 'ملابس لائقة', 'شعر لائق'];
  /* المراجعة مربع واحد فيه سؤال (1) و(2)؛ المفاتيح r1 و r2 كما هي */
  const PARTS = [['new', 'الحفظ الجديد'], ['r1', 'المراجعة: سؤال (1)'], ['r2', 'المراجعة: سؤال (2)']];
  const ROWS = [['err', 'أخطاء'], ['tsh', 'تشكيل'], ['trd', 'تردد']];
  const LEVELS = ['1', '2', '3', '4', 'تأكيد'];
  const TAJ = ['متقن', 'تأسيس', 'غنن', 'مد واجب', 'قلقلة', 'لثوية', 'مد منفصل', 'إدغام', 'مخارج'];
  const KINDS = { follow: 'متابعة', term: 'الفصول', itqan: 'إتقان' };
  /* «إتقان»: أربعة أسئلة في جزء (أو أجزاء)، والنجاح ألا تقل الدرجة عن نسبة (مبدئيًا 95%) من «إدارة الاختبارات» */
  const JUZ = ['(30) عم', '(29) تبارك', '(28) قد سمع', '(28 - 30) العشر', '(27) الذاريات', '(26) الأحقاف', '(25) الشورى', '(25 - 27) الشورى : الذاريات',
    '(24) الزمر : فصلت', '(23) يس : ص', '(22) الأحزاب : فاطر', '(22 - 24) الأحزاب : فصلت', '(21) العنكبوت : السجدة', '(20) النمل - القصص', '(19) الفرقان - الشعراء',
    '(19 - 21) الفرقان : العنكبوت', '(18) المؤمنون - النور', '(17) الأنبياء - الحج', '(16) مريم - طه', '(16 - 18) مريم : النور', '(15) الإسراء - الكهف', '(14) الحجر - النحل',
    '(13) يوسف : إبراهيم', '(13 - 15) يوسف : الكهف', '(12) هود - يوسف', '(11) التوبة - يونس', '(10) الأنفال 2 - التوبة', '(10 - 12) الأنفال 2 : هود',
    '(9) الأعراف 2 - الأنفال 1', '(8) الأنعام 2 - الأعراف 1', '(7) المائدة 2 - الأنعام 1', '(7 - 9) المائدة 2 : الأنفال', '(6) النساء 3 - المائدة 1', '(5) النساء 2',
    '(4) آل عمران 2 - النساء 1', '(4 - 6) آل عمران 2 : المائدة 1', '(3) البقرة 3 - آل عمران 1', '(2) البقرة (2)', '(1) البقرة (1)', '(1 - 3) البقرة - آل عمران'];
  /* failMsg: رسالة التنبيه حين تقل الدرجة عن النجاح؛ بالموافقة يُحفظ الاختبار في «متابعة» (kind follow و data.itqan) */
  const IQ_N = 4, ICFG_DEF = { qMax: 25, pass: 95, failMsg: 'هذا الاختبار سينتقل إلى المتابعة، ويلزم الطالب إعادة اختبار الإتقان.' };
  const icfg = () => ({ ...ICFG_DEF, ...(db.settings?.tests_cfg?.itqan || {}) });
  /* «الفصول»: ثلاثة فصول، في كل فصل اختبار نصفي ونهائي. الدرجات من «الإعدادات ← إدارة الاختبارات» (db.settings.tests_cfg) */
  /* [الرقم، الاسم، المدة كما تظهر في القائمة، أول شهر، آخر شهر] */
  const TERMS = [[1, 'الفصل الأول', '1 / 1 - 30 / 4', 1, 4], [2, 'الفصل الثاني', '1 / 5 - 31 / 8', 5, 8], [3, 'الفصل الثالث', '1 / 9 - 31 / 12', 9, 12]];
  const termOfDate = d => { const m = +String(d || '').slice(5, 7) || new Date().getMonth() + 1; return (TERMS.find(t => m >= t[3] && m <= t[4]) || TERMS[0])[0]; };
  const EXAMS = [['mid', 'نصفي'], ['final', 'نهائي']];
  const CFG_DEF = { newMax: 40, revN: 2, revMax: 20, effortMax: 20 };
  const cfg = () => { const c = db.settings?.tests_cfg || {}; return Object.fromEntries(EXAMS.map(([k]) => [k, { ...CFG_DEF, ...(c[k] || {}) }])); };
  const qsOf = c => [{ k: 'new', l: 'سؤال الجديد', max: +c.newMax || 0 }, ...Array.from({ length: +c.revN === 1 ? 1 : 2 }, (_, i) => ({ k: 'r' + (i + 1), l: +c.revN === 1 ? 'سؤال المراجعة' : `سؤال المراجعة (${i + 1})`, max: +c.revMax || 0 }))];
  const examMax = c => qsOf(c).reduce((a, q) => a + q.max, 0) + (+c.effortMax || 0);
  const termName = n => (TERMS.find(t => t[0] === +n) || [])[1] || '';
  const examName = k => (EXAMS.find(t => t[0] === k) || [])[1] || '';
  const num = v => { const n = parseFloat(String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) ? n : null; };
  const fmtN = n => String(Math.round(n * 100) / 100);
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/><path d="M9 17h6"/></svg>';

  /* ===== من يختبر ومن يرى =====
     - المدير والمدير العام: أي طالب في الاختبارات الثلاثة، ويريان كل السجلات.
     - المشرف: طلاب حلقاته، ويرى كل سجلاتهم.
     - المعلم: «الفصول» لطلاب حلقاته. و«متابعة» و«إتقان» بصلاحيتهما (tests.follow / tests.itqan) في نطاقه:
       حلقاته، وما يحدده له المدير في «إدارة الاختبارات ← نطاق المعلمين» (أماكن أو حلقات). ويرى سجلات نطاقه.
     - المحاسب: لا يرى السجلات إلا بصلاحية «الاطلاع على سجلات الاختبارات» (tests.view)، ولا يختبر.
     - الإداري: يرى سجلات طلاب نطاق عمله (ما يصله من الطلاب هو نطاقه)، ولا يختبر. */
  const halaqaOf = st => st && byId(db.halaqat || [], st.halaqaId);
  const hLabel = st => { const h = halaqaOf(st); return h ? String(halaqaLabel(h)) : st?.hLabel || 'بلا حلقة'; };
  const isGM = () => session?.role === 'supervisor' && !!window.isGenSup?.(me());
  const scopeOf = id => { const s = ((db.settings?.tests_cfg || {}).scopes || {})[id] || {}; return { places: Array.isArray(s.places) ? s.places : [], halaqat: Array.isArray(s.halaqat) ? s.halaqat : [] }; };
  const ownHalaqa = st => { const h = halaqaOf(st); return !!h && h.teacherId === session?.id; };
  /* نطاق المعلم المختبِر: حلقاته، والأماكن والحلقات المحددة له؛ وطالب جاء من قائمة النطاق (st.scoped) حدده الخادم */
  function inScope(st) {
    if (!st) return false;
    if (st.scoped || ownHalaqa(st)) return true;
    const h = halaqaOf(st), sc = scopeOf(session?.id); if (!h) return false;
    return sc.halaqat.includes(h.id) || (!!h.placeId && sc.places.includes(h.placeId));
  }
  const supOf = st => { const h = halaqaOf(st); return isGM() || (session?.role === 'supervisor' && !!h && h.supervisorId === session.id); };
  function canBy(st, perm) {
    if (!session || !st) return false;
    const r = session.role;
    if (r === 'admin') return true;
    if (r === 'supervisor') return supOf(st);
    if (r === 'teacher') return !!window.Perms?.can(perm) && inScope(st);
    return false;
  }
  const canTest = st => canBy(st, 'tests.follow');
  const canItqan = st => canBy(st, 'tests.itqan');
  /* «الفصول»: معلم الحلقة أو مشرفها (والمدير والمدير العام) بلا صلاحية إضافية */
  function canTerm(st) {
    if (!session || !st) return false;
    const r = session.role;
    if (r === 'admin') return true;
    if (r === 'supervisor') return supOf(st);
    if (r === 'teacher') return ownHalaqa(st);
    return false;
  }
  function canSee(st) {
    if (!session || !st) return false;
    const r = session.role;
    if (r === 'accountant') return !!window.Perms?.can('tests.view');
    if (r === 'placeadmin') return true;
    return canTest(st) || canTerm(st) || canItqan(st);
  }
  /* طلاب النطاق الذين لا يصلون إلى المعلم مع بياناته (من حلقات غيره): يجلبهم الخادم (test_scope_students) */
  const EXTRA = new Map();
  const stOf = id => byId(db.students || [], id) || EXTRA.get(id);

  /* ===== الزر في صفوف الطلاب ===== */
  let raf = 0;
  function paint() {
    raf = 0;
    document.querySelectorAll('main [data-act="hist"][data-id]').forEach(b => {
      const cell = b.parentElement; if (!cell || cell.querySelector('[data-qtest]')) return;
      const st = byId(db.students || [], b.dataset.id); if (!canSee(st)) return;
      b.insertAdjacentHTML('beforebegin', `<button type="button" class="btn sm qri" data-qtest="${esc(st.id)}" title="الاختبارات" aria-label="الاختبارات" aria-haspopup="true">${ICON}</button>`);
    });
  }
  new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(paint); }).observe(document.body, { childList: true, subtree: true });

  /* ===== قائمة الخيارات ===== */
  const closeMenu = () => document.querySelector('.qtmenu')?.remove();
  function openMenu(btn, st) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'qtmenu'; m.setAttribute('role', 'menu');
    m.innerHTML = `${canTest(st) ? '<button type="button" role="menuitem" data-qtgo="follow"><b>متابعة</b><small>الحفظ والمراجعة والتجويد</small></button>' : ''}
      ${canTerm(st) ? '<button type="button" role="menuitem" data-qtgo="term"><b>الفصول</b><small>اختبار نصفي ونهائي لكل فصل</small></button>' : ''}
      ${canItqan(st) ? '<button type="button" role="menuitem" data-qtgo="itqan"><b>إتقان</b><small>أربعة أسئلة في جزء</small></button>' : ''}
      <button type="button" role="menuitem" data-qtgo="log"><b>سجل الاختبارات</b><small>ما سُجّل لهذا الطالب</small></button>`;
    m.dataset.sid = st.id;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    m.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-qtest]');
    if (b) { e.preventDefault(); const open = document.querySelector('.qtmenu')?.dataset.sid === b.dataset.qtest; if (open) closeMenu(); else { const st = stOf(b.dataset.qtest); if (st) openMenu(b, st); } return; }
    const go = e.target.closest('[data-qtgo]');
    if (go) { const st = stOf(go.closest('.qtmenu').dataset.sid); closeMenu(); if (!st) return; if (go.dataset.qtgo === 'follow') followForm(st); else if (go.dataset.qtgo === 'term') termForm(st); else if (go.dataset.qtgo === 'itqan') itqanForm(st); else logView(st); return; }
    if (!e.target.closest('.qtmenu')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);

  /* ===== «طلاب نطاق الاختبار» للمعلم المختبِر: زر أعلى «الطلاب» يفتح قائمة طلاب نطاقه من حلقات غيره ===== */
  const examiner = () => session?.role === 'teacher' && (!!window.Perms?.can('tests.follow') || !!window.Perms?.can('tests.itqan'));
  const hasScope = () => { const s = scopeOf(session?.id); return s.places.length + s.halaqat.length > 0; };
  async function scopeStudents() {
    if (!CLOUD) return (db.students || []).filter(s => !ownHalaqa(s) && inScope(s) && !stOff(s)).map(s => ({ ...s, hLabel: hLabel(s) }));
    const r = (await window.Cloud.rpc('test_scope_students')) || [];
    return r.map(x => ({ id: x.id, name: x.name, halaqaId: x.halaqa_id || '', hLabel: x.h_label || '', scoped: true }));
  }
  async function scopeView() {
    openInfo('طلاب نطاق الاختبار', '<input type="search" class="qtsq" placeholder="ابحث باسم الطالب أو الحلقة…" aria-label="بحث"><div class="qtslist muted">…</div>');
    const ov = [...document.querySelectorAll('.overlay')].pop(), box = ov?.querySelector('.qtslist'), q = ov?.querySelector('.qtsq'); if (!box) return;
    let L = [];
    try { L = await scopeStudents(); } catch (e) { box.textContent = /test_scope|PGRST202|404/i.test(String(e.message || e)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر تحميل الطلاب.'; return; }
    L.forEach(s => { if (!byId(db.students || [], s.id)) EXTRA.set(s.id, s); });
    L.sort((a, b) => String(a.hLabel).localeCompare(String(b.hLabel), 'ar') || a.name.localeCompare(b.name, 'ar'));
    const draw = () => {
      const k = norm(q.value || ''), list = L.filter(s => !k || norm(s.name).includes(k) || norm(s.hLabel || '').includes(k));
      box.className = 'qtslist';
      box.innerHTML = list.length ? list.slice(0, 300).map(s => `<div class="qtsrow"><div><b>${esc(s.name)}</b><small class="muted">${esc(s.hLabel || '')}</small></div><button type="button" class="btn sm qri" data-qtest="${esc(s.id)}" title="الاختبارات" aria-label="الاختبارات" aria-haspopup="true">${ICON}</button></div>`).join('')
        : `<p class="muted">${L.length ? 'لا يوجد اسم مطابق.' : 'لا يوجد طلاب في نطاقك خارج حلقاتك.'}</p>`;
    };
    q.addEventListener('input', draw); draw();
  }
  function scopeBar() {
    if (!examiner() || ui.tab !== 'students' || !hasScope() || document.querySelector('main [data-qtscope]')) return;
    const first = document.querySelector('main > .card, main .card'); if (!first) return;
    first.insertAdjacentHTML('beforebegin', `<div class="qtscopebar"><button type="button" class="btn" data-qtscope>${ICON}<span>طلاب نطاق الاختبار</span></button></div>`);
  }
  new MutationObserver(() => { try { scopeBar(); } catch (e) { /* ignore */ } }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => { if (e.target.closest('[data-qtscope]')) scopeView(); });

  /* ===== «آخر المحفوظ» في «سجل الإنجاز» =====
     الخادم يقبل التسميع من المدير ومعلم الحلقة ومشرفها (records_write / can_teach_student)، فلا يُضاف لغيرهم
     (المدير العام في غير حلقاته، والمعلم المختبِر خارج حلقاته) حتى لا ترفضه المزامنة. */
  function canRecord(st) {
    if (!session || !st || !byId(db.students || [], st.id)) return false;   // طالب نطاق من خارج البيانات المحمّلة
    if (session.role === 'admin') return true;
    const h = halaqaOf(st);
    return !!h && (h.teacherId === session.id || h.supervisorId === session.id);
  }
  function addHifz(st, last, dt) {
    if (!canRecord(st) || !Array.isArray(db.records)) return false;
    const i = SURAHS.findIndex(s => s[0] === last.surah); if (i < 0) return false;
    const to = last.ayah || SURAHS[i][1];
    db.records.push({ id: uid(), studentId: st.id, date: dt, type: 'حفظ', surah: i + 1, from: to, to, grade: '', note: 'آخر المحفوظ (اختبار متابعة)' });
    save(); try { render(); } catch (e) { /* ignore */ }
    return true;
  }

  /* ===== استمارة «متابعة» ===== */
  const chip = (type, name, v, on) => `<label class="chip-r chip-t"><input type="${type}" name="${name}" value="${esc(v)}" ${on ? 'checked' : ''}><span>${esc(v)}</span></label>`;
  const surahSel = name => `<select name="${name}" aria-label="السورة"><option value="">— اختر السورة —</option>${SURAHS.map(([n]) => `<option>${esc(n)}</option>`).join('')}</select>`;
  const partBody = k => `<label>السورة${surahSel(k + '_s')}</label>
      <div class="qtgrid">${ROWS.map(([rk, rl]) => `<div class="qtrow"><span class="qtrl">${rl}</span><div class="chips">${LEVELS.map(v => chip('radio', `${k}_${rk}`, v)).join('')}</div></div>`).join('')}</div>`;
  const partHTML = ([k, l]) => `<fieldset class="tfs qtpart"><legend>${l}</legend>${partBody(k)}</fieldset>`;
  /* المراجعة: مربع واحد، وفيه سؤال (1) و(2) */
  const reviewHTML = () => `<fieldset class="tfs qtpart"><legend>المراجعة</legend>
      <div class="qtsubq"><b class="qtsubh">سؤال (1)</b>${partBody('r1')}</div>
      <div class="qtsubq"><b class="qtsubh">سؤال (2)</b>${partBody('r2')}</div></fieldset>`;
  function followForm(st) {
    const h = halaqaOf(st);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qtform"><h2>متابعة: ${esc(st.name)}</h2>
      <p class="muted qtsub">${esc(hLabel(st))}</p>
      <label class="qtdate">التاريخ<input type="date" name="dt" value="${today()}" max="${today()}"></label>
      <fieldset class="tfs"><legend>الأساسيات ينقصها</legend>
        <div class="chips">${BASICS.map(v => chip('checkbox', 'basics', v)).join('')}${chip('checkbox', 'basics', 'أخرى')}</div>
        <label data-other="basics" hidden>اكتب ما ينقصه<input name="basicsOther" maxlength="200"></label>
      </fieldset>
      <fieldset class="tfs"><legend>آخر المحفوظ <span class="muted">(اختياري)</span></legend>
        <div class="two"><label>السورة${surahSel('last_s')}</label><label>الآية<input type="number" inputmode="numeric" name="last_a" min="1" step="1" aria-label="رقم الآية"></label></div>
      </fieldset>
      ${partHTML(PARTS[0])}${reviewHTML()}
      <fieldset class="tfs"><legend>ملاحظات التجويد <b class="req">*</b></legend>
        <div class="chips">${TAJ.map(v => chip('checkbox', 'taj', v)).join('')}${chip('checkbox', 'taj', 'أخرى')}</div>
        <label data-other="taj" hidden>اكتب الملاحظة<input name="tajOther" maxlength="200"></label>
      </fieldset>
      <label>ملاحظات <span class="muted">(اختياري)</span><textarea name="note" rows="2" maxlength="1000"></textarea></label>
      <div class="row"><button type="button" class="btn primary" data-qtsave>حفظ الاختبار</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const M = ov.querySelector('.modal');
    const vals = n => [...M.querySelectorAll(`[name="${n}"]:checked`)].map(i => i.value);
    const val = n => (M.querySelector(`[name="${n}"]`)?.value || '').trim();
    ov.addEventListener('change', e => {
      const n = e.target.name; if (n === 'basics' || n === 'taj') M.querySelector(`[data-other="${n}"]`).hidden = !vals(n).includes('أخرى');
    });
    /* الاختيار المحدد في صفوف الدرجات: ضغطة أخرى تلغيه */
    ov.addEventListener('click', e => {
      if (e.target.matches?.('input')) return;
      const lab = e.target.closest('.qtgrid label.chip-t'); if (!lab) return;
      const inp = lab.querySelector('input'); if (inp?.checked) { e.preventDefault(); inp.checked = false; }
    });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-qtsave]').onclick = async ev => {
      const dt = val('dt'), basics = vals('basics'), taj = vals('taj');
      const data = { basics: basics.filter(x => x !== 'أخرى'), basicsOther: basics.includes('أخرى') ? val('basicsOther') : '', parts: {}, taj: taj.filter(x => x !== 'أخرى'), tajOther: taj.includes('أخرى') ? val('tajOther') : '', note: val('note') };
      if (!dt) { toast('حدّد التاريخ'); return; }
      /* آخر المحفوظ (اختياري): السورة، والآية إن كُتبت في حدود السورة */
      const ls = val('last_s'), la = val('last_a');
      if (la && !ls) { toast('اختر سورة آخر المحفوظ'); M.querySelector('[name="last_s"]').focus(); return; }
      if (ls) {
        const n = (SURAHS.find(s => s[0] === ls) || [])[1] || 0, a = la ? Math.round(+la) : null;
        if (a != null && !(a >= 1 && a <= n)) { toast(`آية «${ls}» من 1 إلى ${n}`); M.querySelector('[name="last_a"]').focus(); return; }
        data.last = { surah: ls, ayah: a };
      }
      for (const [k, l] of PARTS) {
        const p = { surah: val(k + '_s') }; ROWS.forEach(([rk]) => { p[rk] = vals(`${k}_${rk}`)[0] || ''; });
        if (!p.surah && ROWS.some(([rk]) => p[rk])) { toast(`اختر سورة «${l}»`); M.querySelector(`[name="${k}_s"]`).focus(); return; }
        if (p.surah) data.parts[k] = p;
      }
      if (!data.taj.length && !data.tajOther) { toast(taj.includes('أخرى') ? 'اكتب ملاحظة التجويد' : 'اختر ملاحظات التجويد'); return; }
      const run = async () => {
        if (CLOUD) await window.Cloud.rpc('test_add', { sid: st.id, knd: 'follow', dt, dat: data });
        else { (db.tests = db.tests || []).push({ id: uid(), studentId: st.id, kind: 'follow', date: dt, data, by: me()?.name || '', byMember: session?.id || '', ts: new Date().toISOString() }); save(); }
      };
      try {
        await withBusy(ev.currentTarget, run()); ov.remove();
        /* «آخر المحفوظ» يُسجَّل أيضًا في «سجل الإنجاز» تسميعَ «حفظ» فيتحدّث «آخر حفظ» (الآية فارغة = السورة كلها) */
        let rec = '';
        if (data.last) rec = addHifz(st, data.last, dt) ? '، وأُضيف «آخر المحفوظ» إلى سجل الإنجاز' : ' (لم يُضف «آخر المحفوظ» إلى سجل الإنجاز: يسجّله معلم الحلقة أو مشرفها)';
        toast('حُفظ اختبار ' + st.name + rec);
      }
      catch (err) { toast(/test_add|PGRST202|404/i.test(String(err.message || err)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر الحفظ: ' + (err.message || err)); }
    };
  }

  /* ===== استمارة «الفصول»: الفصل والاختبار، ثم الأسئلة ودرجة الجهد، والإجمالي يُحسب فورًا =====
     الاختبار المسجّل من قبل (الفصل والنوع نفسهما) يُفتح بدرجاته ويُعدَّل، بأسئلته ودرجاته العظمى كما سُجّل،
     فتغيير «إدارة الاختبارات» لا يغيّر ما سُجّل. */
  async function termForm(st) {
    let L = [];
    try { L = (await listOf(st)).filter(t => t.kind === 'term'); } catch (e) { /* قبل تنفيذ tests.sql: يظهر الخطأ عند الحفظ */ }
    const h = halaqaOf(st), C = cfg();
    const found = (tm, ex) => L.find(t => +t.data?.term === +tm && t.data?.exam === ex);
    /* الفصل الذي فيه تاريخ اليوم، وأول اختبار فيه لم يُسجَّل بعد */
    const tm0 = termOfDate(today()), pick = [tm0, (EXAMS.find(([ex]) => !found(tm0, ex)) || EXAMS[0])[0]];
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qtform"><h2>الفصول: ${esc(st.name)}</h2>
      <p class="muted qtsub">${esc(hLabel(st))}</p>
      <label class="qtterm">الفصل <b class="req">*</b><select name="term">${TERMS.map(([v, l, r]) => `<option value="${v}" ${pick[0] === v ? 'selected' : ''}>${l} (${r})${found(v, 'mid') && found(v, 'final') ? ' ✓' : ''}</option>`).join('')}</select></label>
      <div class="lbl-s">الاختبار <b class="req">*</b></div><div class="chips">${EXAMS.map(([v, l]) => `<label class="chip-r chip-t"><input type="radio" name="exam" value="${v}" ${pick?.[1] === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <p class="qtexist" data-qtexist hidden></p>
      <label class="qtdate">التاريخ<input type="date" name="dt" value="${today()}" max="${today()}"></label>
      <div data-qtqs></div>
      <label>ملاحظات <span class="muted">(اختياري)</span><textarea name="note" rows="2" maxlength="1000"></textarea></label>
      <div class="qttotal" data-qttot></div>
      <div class="row"><button type="button" class="btn primary" data-qtsave>حفظ النتيجة</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const M = ov.querySelector('.modal'), box = M.querySelector('[data-qtqs]'), tot = M.querySelector('[data-qttot]'), ex = M.querySelector('[data-qtexist]');
    const sel = n => (n === 'term' ? M.querySelector('[name="term"]')?.value : M.querySelector(`[name="${n}"]:checked`)?.value) || '';
    let cur = null;   // { old, qs, effortMax }
    const draw = () => {
      const tm = sel('term'), xk = sel('exam');
      if (!tm || !xk) { cur = null; box.innerHTML = '<p class="muted">اختر الفصل والاختبار.</p>'; ex.hidden = true; calc(); return; }
      const old = found(tm, xk), d = old?.data || {};
      const qs = old && Array.isArray(d.qs) && d.qs.length ? d.qs.map(q => ({ k: q.k, l: q.l, max: +q.max || 0 })) : qsOf(C[xk]);
      const effortMax = old ? +d.effortMax || 0 : +C[xk].effortMax || 0;
      cur = { old, qs, effortMax };
      ex.hidden = !old;
      if (old) ex.textContent = `سُجّل هذا الاختبار من قبل (${String(old.date || '').slice(0, 10)}${old.by ? ' — ' + old.by : ''}): الحفظ يعدّل نتيجته.`;
      const v = k => (d.qs || []).find(q => q.k === k) || {};
      box.innerHTML = `<fieldset class="tfs"><legend>الأسئلة</legend>
        ${qs.map(q => `<div class="qtq"><b class="qtql">${esc(q.l)}</b>
          <span class="qtman"><span class="muted">المنهج: من</span><input name="${q.k}_f" maxlength="80" value="${esc(v(q.k).from ?? v(q.k).surah ?? '')}" placeholder="مثال: الملك" aria-label="المنهج من — ${esc(q.l)}"><span class="muted">إلى</span><input name="${q.k}_t" maxlength="80" value="${esc(v(q.k).to ?? '')}" placeholder="مثال: نوح" aria-label="المنهج إلى — ${esc(q.l)}"></span>
          <span class="qtg"><input type="number" inputmode="decimal" name="${q.k}_g" min="0" max="${q.max}" step="0.5" value="${v(q.k).grade ?? ''}" aria-label="درجة ${esc(q.l)}"><span class="muted">/ ${fmtN(q.max)}</span></span></div>`).join('')}
        </fieldset>
        ${effortMax ? `<fieldset class="tfs"><legend>درجات تكميلية</legend><div class="qtq"><b class="qtql">الجهد</b><span class="qtg"><input type="number" inputmode="decimal" name="effort" min="0" max="${effortMax}" step="0.5" value="${d.effort ?? ''}" aria-label="درجة الجهد"><span class="muted">/ ${fmtN(effortMax)}</span></span></div></fieldset>` : ''}`;
      if (old) { M.querySelector('[name="dt"]').value = String(old.date || today()).slice(0, 10); M.querySelector('[name="note"]').value = d.note || ''; }
      calc();
    };
    const read = () => {
      if (!cur) return null;
      const g = n => num(M.querySelector(`[name="${n}"]`)?.value ?? '');
      const tx = n => (M.querySelector(`[name="${n}"]`)?.value || '').trim();
      const qs = cur.qs.map(q => ({ ...q, from: tx(q.k + '_f'), to: tx(q.k + '_t'), grade: g(q.k + '_g') }));
      const effort = cur.effortMax ? g('effort') : null;
      const max = qs.reduce((a, q) => a + q.max, 0) + cur.effortMax;
      const total = qs.reduce((a, q) => a + (q.grade || 0), 0) + (effort || 0);
      return { qs, effort, max, total };
    };
    function calc() {
      const r = read(); if (!r) { tot.innerHTML = ''; return; }
      const pct = r.max ? Math.round((r.total / r.max) * 100) : 0;
      tot.innerHTML = `الإجمالي: <b>${fmtN(r.total)}</b> من ${fmtN(r.max)} <span class="muted">(<bdi>${pct}%</bdi>)</span>`;
    }
    ov.addEventListener('change', e => { if (e.target.name === 'term' || e.target.name === 'exam') draw(); });
    ov.addEventListener('input', e => { if (/_g$|^effort$/.test(e.target.name || '')) calc(); });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-qtsave]').onclick = async evt => {
      const tm = +sel('term'), xk = sel('exam'), dt = M.querySelector('[name="dt"]').value, r = read();
      if (!tm) { toast('اختر الفصل'); return; }
      if (!xk || !r) { toast('اختر الاختبار'); return; }
      if (!dt) { toast('حدّد التاريخ'); return; }
      for (const q of r.qs) {
        if (q.grade == null) { toast(`اكتب درجة «${q.l}»`); M.querySelector(`[name="${q.k}_g"]`).focus(); return; }
        if (q.grade < 0 || q.grade > q.max) { toast(`درجة «${q.l}» من 0 إلى ${fmtN(q.max)}`); M.querySelector(`[name="${q.k}_g"]`).focus(); return; }
      }
      if (r.effort != null && (r.effort < 0 || r.effort > cur.effortMax)) { toast(`درجة الجهد من 0 إلى ${fmtN(cur.effortMax)}`); M.querySelector('[name="effort"]').focus(); return; }
      const data = { term: tm, exam: xk, qs: r.qs.map(q => ({ k: q.k, l: q.l, from: q.from, to: q.to, grade: q.grade, max: q.max })), effort: r.effort || 0, effortMax: cur.effortMax, total: r.total, max: r.max, note: (M.querySelector('[name="note"]').value || '').trim() };
      const old = cur.old;
      const run = async () => {
        if (CLOUD) {
          if (old) await window.Cloud.rpc('test_upd', { tid: old.id, dt, dat: data });
          else await window.Cloud.rpc('test_add', { sid: st.id, knd: 'term', dt, dat: data });
        } else {
          const T = (db.tests = db.tests || []), o = old && T.find(t => t.id === old.id);
          if (o) Object.assign(o, { date: dt, data });
          else T.push({ id: uid(), studentId: st.id, kind: 'term', date: dt, data, by: me()?.name || '', byMember: session?.id || '', ts: new Date().toISOString() });
          save();
        }
      };
      try { await withBusy(evt.currentTarget, run()); ov.remove(); toast(`حُفظت نتيجة ${termName(tm)} (${examName(xk)}) لـ ${st.name}`); }
      catch (err) { toast(/test_(add|upd)|PGRST202|404/i.test(String(err.message || err)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر الحفظ: ' + (err.message || err)); }
    };
    draw();
  }

  /* ===== استمارة «إتقان»: الجزء، وأربعة أسئلة، والإجمالي والنتيجة (ناجح / لم يجتز) تُحسب فورًا =====
     كل محاولة تُسجَّل وحدها (الإعادة بعد عدم الاجتياز محاولة جديدة)، ومعها درجتها العظمى ونسبة النجاح وقتها. */
  function itqanForm(st) {
    const h = halaqaOf(st), C = icfg(), qMax = +C.qMax || 0, max = qMax * IQ_N, pass = +C.pass || 0;
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qtform"><h2>إتقان: ${esc(st.name)}</h2>
      <p class="muted qtsub">${esc(hLabel(st))}</p>
      <div class="two"><label>الجزء <b class="req">*</b><select name="juz"><option value="">— اختر —</option>${JUZ.map(j => `<option>${esc(j)}</option>`).join('')}</select></label>
        <label>التاريخ<input type="date" name="dt" value="${today()}" max="${today()}"></label></div>
      <fieldset class="tfs"><legend>الدرجة</legend>
        <div class="chips qtmode"><label class="chip-r chip-t"><input type="radio" name="mode" value="qs" checked><span>درجة لكل سؤال</span></label><label class="chip-r chip-t"><input type="radio" name="mode" value="total"><span>الدرجة الإجمالية مرة واحدة</span></label></div>
        <div data-mode="qs">${Array.from({ length: IQ_N }, (_, i) => `<div class="qtq"><b class="qtql">السؤال ${['الأول', 'الثاني', 'الثالث', 'الرابع'][i]}</b>
          <span class="qtg"><input type="number" inputmode="decimal" name="q${i + 1}" min="0" max="${qMax}" step="0.25" aria-label="درجة السؤال ${i + 1}"><span class="muted">/ ${fmtN(qMax)}</span></span></div>`).join('')}</div>
        <div data-mode="total" hidden><div class="qtq"><b class="qtql">الدرجة الإجمالية</b>
          <span class="qtg"><input type="number" inputmode="decimal" name="tot" min="0" max="${max}" step="0.25" aria-label="الدرجة الإجمالية"><span class="muted">/ ${fmtN(max)}</span></span></div></div>
      </fieldset>
      <label>ملاحظات <span class="muted">(اختياري)</span><textarea name="note" rows="2" maxlength="1000"></textarea></label>
      <div class="qttotal" data-qttot></div>
      <div class="row"><button type="button" class="btn primary" data-qtsave>حفظ النتيجة</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const M = ov.querySelector('.modal'), tot = M.querySelector('[data-qttot]');
    /* «الدرجة الإجمالية مرة واحدة»: خانة واحدة بدل الأسئلة الأربعة */
    const mode = () => M.querySelector('[name="mode"]:checked')?.value || 'qs';
    const grades = () => (mode() === 'total' ? [num(M.querySelector('[name="tot"]').value)] : Array.from({ length: IQ_N }, (_, i) => num(M.querySelector(`[name="q${i + 1}"]`).value)));
    const result = gs => { const total = gs.reduce((a, g) => a + (g || 0), 0), pct = max ? (total / max) * 100 : 0; return { total, pct, passed: pct >= pass }; };
    ov.addEventListener('change', e => { if (e.target.name === 'mode') { M.querySelectorAll('[data-mode]').forEach(d => { d.hidden = d.dataset.mode !== mode(); }); calc(); } });
    const calc = () => {
      const gs = grades(), r = result(gs), all = gs.every(g => g != null);
      tot.innerHTML = `الإجمالي: <b>${fmtN(r.total)}</b> من ${fmtN(max)} <span class="muted">(<bdi>${fmtN(r.pct)}%</bdi>)</span>`
        + (all ? ` <span class="tag ${r.passed ? 'tag-ok' : 'tag-no'}">${r.passed ? 'ناجح' : 'لم يجتز'}</span>` : '')
        + `<small class="muted qtpass">شرط النجاح: <bdi>${fmtN(pass)}%</bdi> فأكثر</small>`;
    };
    ov.addEventListener('input', e => { if (/^(q\d|tot)$/.test(e.target.name || '')) calc(); });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-qtsave]').onclick = async evt => {
      const juz = M.querySelector('[name="juz"]').value, dt = M.querySelector('[name="dt"]').value, gs = grades();
      if (!juz) { toast('اختر الجزء'); M.querySelector('[name="juz"]').focus(); return; }
      if (!dt) { toast('حدّد التاريخ'); return; }
      if (mode() === 'total') {
        const el = M.querySelector('[name="tot"]');
        if (gs[0] == null) { toast('اكتب الدرجة الإجمالية'); el.focus(); return; }
        if (gs[0] < 0 || gs[0] > max) { toast(`الدرجة الإجمالية من 0 إلى ${fmtN(max)}`); el.focus(); return; }
      } else for (let i = 0; i < IQ_N; i++) {
        const el = M.querySelector(`[name="q${i + 1}"]`);
        if (gs[i] == null) { toast(`اكتب درجة السؤال ${i + 1}`); el.focus(); return; }
        if (gs[i] < 0 || gs[i] > qMax) { toast(`درجة السؤال ${i + 1} من 0 إلى ${fmtN(qMax)}`); el.focus(); return; }
      }
      const r = result(gs), btn = evt.currentTarget;
      const data = { juz, qs: mode() === 'total' ? null : gs, qMax, total: r.total, max, pct: Math.round(r.pct * 100) / 100, pass, passed: r.passed, note: (M.querySelector('[name="note"]').value || '').trim() };
      /* لم يجتز: تنبيه (رسالته من «إدارة الاختبارات»)، وبالموافقة يُحفظ في «متابعة» بدل «إتقان» */
      const kind = r.passed ? 'itqan' : 'follow';
      if (!r.passed) data.itqan = true;
      const commit = async () => {
        const run = async () => {
          if (CLOUD) await window.Cloud.rpc('test_add', { sid: st.id, knd: kind, dt, dat: data });
          else { (db.tests = db.tests || []).push({ id: uid(), studentId: st.id, kind, date: dt, data, by: me()?.name || '', byMember: session?.id || '', ts: new Date().toISOString() }); save(); }
        };
        try { await withBusy(btn, run()); ov.remove(); toast(r.passed ? `حُفظ إتقان ${juz} لـ ${st.name}: ناجح` : `لم يجتز ${st.name} إتقان ${juz}: نُقل الاختبار إلى «متابعة»`); }
        catch (err) { toast(/test_add|PGRST202|404/i.test(String(err.message || err)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر الحفظ: ' + (err.message || err)); }
      };
      if (r.passed) { commit(); return; }
      const cf = document.createElement('div'); cf.className = 'overlay';
      cf.innerHTML = `<div class="modal qtfail"><h2>لم يجتز الإتقان</h2>
        <p class="qtfailr">الإجمالي ${fmtN(r.total)} من ${fmtN(max)} (<bdi>${fmtN(r.pct)}%</bdi>)، وشرط النجاح <bdi>${fmtN(pass)}%</bdi>.</p>
        <p class="qtfailm">${esc(icfg().failMsg || ICFG_DEF.failMsg).replace(/\n/g, '<br>')}</p>
        <div class="row"><button type="button" class="btn primary" data-qtok>موافق</button><button type="button" class="btn" data-close>رجوع</button></div></div>`;
      document.body.appendChild(cf);
      cf.querySelector('[data-close]').onclick = () => cf.remove();
      cf.querySelector('[data-qtok]').onclick = () => { cf.remove(); commit(); };
      cf.querySelector('[data-qtok]').focus({ preventScroll: true });
    };
    calc();
  }
  /* ===== بطاقة الاختبار في السجل: الاختبار، ثم التاريخ والمختبر (إن وُجدا)، ثم الدرجة ونسبتها في كبسولة، ثم التفاصيل ===== */
  const line = (l, v) => `<div class="sfr"><span>${esc(l)}</span><b>${v}</b></div>`;
  const pctTag = (pct, cls) => `<span class="tag qtpct ${cls || ''}"><bdi>${fmtN(pct)}%</bdi></span>`;
  function card(t, title, grade, body) {
    return `<div class="qtitem">${t.canDel ? `<button type="button" class="btn sm danger qtdelb" data-qtdel="${esc(t.id)}">حذف</button>` : ''}
      ${line('الاختبار', title)}
      ${t.date ? line('التاريخ', `<bdi>${esc(String(t.date).slice(0, 10))}</bdi>`) : ''}
      ${t.by ? line('المختبر', esc(t.by)) : ''}
      ${grade ? line('الدرجة', grade) : ''}
      ${body}</div>`;
  }
  function itqanItem(t) {
    const d = t.data || {}, cls = d.passed ? 'tag-ok' : 'tag-no';
    const title = `إتقان ${esc(d.juz || '')} <span class="tag ${cls}">${d.passed ? 'ناجح' : d.itqan ? 'لم يجتز — يعيد الإتقان' : 'لم يجتز'}</span>`;
    const grade = `<span class="qtsum">${fmtN(+d.total || 0)} / ${fmtN(+d.max || 0)}</span> ${pctTag(+d.pct || 0, cls)} <span class="muted qtneed">النجاح <bdi>${fmtN(+d.pass || 0)}%</bdi></span>`;
    return card(t, title, grade, d.note ? line('ملاحظات', esc(d.note)) : '');   // بلا تفاصيل درجات الأسئلة
  }

  /* ===== سجل الاختبارات ===== */
  async function listOf(st) {
    if (!CLOUD) return (db.tests || []).filter(t => t.studentId === st.id).map(t => ({ ...t, canDel: session?.role === 'admin' || t.byMember === session?.id }));
    const r = (await window.Cloud.rpc('test_list', { sid: st.id })) || [];
    return r.map(x => ({ id: x.id, kind: x.kind, date: x.dt, data: x.data || {}, by: x.by_name || '', ts: x.created_at, canDel: !!x.can_del }));
  }
  function termItem(t) {
    const d = t.data || {}, pct = d.max ? Math.round((d.total / d.max) * 10000) / 100 : 0;
    const grade = `<span class="qtsum">${fmtN(+d.total || 0)} / ${fmtN(+d.max || 0)}</span> ${pctTag(pct)}`;
    return card(t, `${esc(termName(d.term))} — ${esc(examName(d.exam))}`, grade, d.note ? line('ملاحظات', esc(d.note)) : '');   // بلا تفاصيل درجات الأسئلة
  }
  function itemHTML(t) {
    if (t.kind === 'term') return termItem(t);
    if (t.kind === 'itqan' || t.data?.itqan) return itqanItem(t);   // إتقان لم يجتز ونُقل إلى «متابعة»
    /* «متابعة» بلا درجة: الاختبار والتاريخ والمختبر، ثم ما سُجّل */
    const d = t.data || {}, opt = (l, v) => (v ? line(l, v) : '');
    /* الأخطاء كبسولات: «أخطاء (2)» «تردد (تأكيد)» */
    const grades = p => ROWS.filter(([rk]) => p[rk]).map(([rk, rl]) => `<span class="tag qterr">${rl} (${esc(p[rk])})</span>`).join('');
    const parts = PARTS.filter(([k]) => d.parts?.[k]).map(([k, l]) => { const p = d.parts[k]; return line(l, `${esc(p.surah)}${grades(p)}`); }).join('');
    const last = d.last?.surah ? `${esc(d.last.surah)}${d.last.ayah ? ` – آية ${esc(d.last.ayah)}` : ''}` : '';
    return card(t, esc(KINDS[t.kind] || t.kind), '',
      opt('آخر المحفوظ', last) +
      opt('الأساسيات ينقصها', esc([...(d.basics || []), d.basicsOther].filter(Boolean).join('، '))) + parts
      + opt('ملاحظات التجويد', esc([...(d.taj || []), d.tajOther].filter(Boolean).join('، '))) + opt('ملاحظات', esc(d.note || '')));
  }
  /* السجل بثلاثة تبويبات (متابعة · الفصول · إتقان) وعدد كل نوع. يُستعمل في ملف الطالب وفي «سجل الاختبارات» من زر الصف */
  const TABS = [['follow', 'متابعة'], ['term', 'الفصول'], ['itqan', 'إتقان']];
  async function mountLog(root, st) {
    root.innerHTML = '<div class="qttabs" role="tablist"></div><div class="qtlog muted">…</div>';
    const tabs = root.querySelector('.qttabs'), box = root.querySelector('.qtlog');
    let L = [], cur = '';
    const paint = () => {
      tabs.innerHTML = TABS.map(([k, l]) => { const n = L.filter(t => t.kind === k).length; return `<button type="button" role="tab" class="btn sm ${k === cur ? 'on' : ''}" aria-selected="${k === cur}" data-qttab="${k}">${l}${n ? ` <span class="qtn">${n}</span>` : ''}</button>`; }).join('');
      const list = L.filter(t => t.kind === cur);
      box.className = 'qtlog'; box.innerHTML = list.length ? list.map(itemHTML).join('') : `<p class="muted">لم يُسجَّل له اختبار «${esc(KINDS[cur])}» بعد.</p>`;
    };
    const load = async () => {
      try { L = await listOf(st); }
      catch (e) { tabs.innerHTML = ''; box.textContent = /test_list|PGRST202|404/i.test(String(e.message || e)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر تحميل السجل.'; return; }
      L.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.ts || '').localeCompare(String(a.ts || '')));
      if (!cur) cur = (TABS.find(([k]) => L.some(t => t.kind === k)) || TABS[0])[0];   // أول نوع فيه اختبارات
      paint();
    };
    root.addEventListener('click', e => {
      const tb = e.target.closest('[data-qttab]'); if (tb) { cur = tb.dataset.qttab; paint(); return; }
      const b = e.target.closest('[data-qtdel]'); if (!b) return;
      ask('حذف هذا الاختبار؟', async () => {
        try {
          if (CLOUD) await window.Cloud.rpc('test_del', { tid: b.dataset.qtdel });
          else { db.tests = (db.tests || []).filter(t => t.id !== b.dataset.qtdel); save(); }
          toast('حُذف الاختبار'); await load();
        } catch (err) { toast('تعذّر الحذف: ' + (err.message || err)); }
      });
    });
    await load();
  }
  function logView(st) {
    openInfo('سجل الاختبارات: ' + st.name, '<div class="qtlogwrap"></div>');
    const root = [...document.querySelectorAll('.overlay')].pop()?.querySelector('.qtlogwrap');
    if (root) mountLog(root, st);
  }
  /* ===== «سجل الاختبارات» في ملف الطالب (stufile.js) لمن يرى اختباراته، قبل أزرار الملف ===== */
  let fraf = 0;
  function fileLog() {
    fraf = 0;
    document.querySelectorAll('.sfile[data-sfile]:not([data-qtf])').forEach(box => {   // ملف الطالب أينما فُتح (ومنه نافذة الحضور: attwin.js)
      box.dataset.qtf = '1';
      const st = stOf(box.dataset.sfile); if (!canSee(st)) return;
      const sec = document.createElement('section'); sec.className = 'sfsec qtfile noprint'; sec.dataset.sk = 'tests';
      sec.innerHTML = '<h3 class="sf-h">سجل الاختبارات</h3><div class="qtlogwrap"></div>';
      const acts = box.querySelector(':scope > .sfacts'); if (acts) box.insertBefore(sec, acts); else box.appendChild(sec);
      mountLog(sec.querySelector('.qtlogwrap'), st);
    });
  }
  new MutationObserver(() => { if (!fraf) fraf = requestAnimationFrame(fileLog); }).observe(document.body, { childList: true, subtree: true });

  /* ===== «الإعدادات ← إدارة الاختبارات» (للمدير): درجات اختبارات الفصول =====
     تبويب بجانب تبويبات الإعدادات، على طريقة «أدوات الحلقات» (places.js). يُحفظ في db.settings.tests_cfg
     ({ mid: {...}, final: {...} } لكل منهما: درجة سؤال الجديد، وعدد أسئلة المراجعة وسؤالها، والجهد). */
  let cfgOn = false;
  const FIELDS = [['newMax', 'درجة سؤال الجديد'], ['revMax', 'درجة سؤال المراجعة (للسؤال الواحد)'], ['effortMax', 'درجات تكميلية (الجهد)']];
  const cfgView = () => {
    const C = cfg();
    return `<div class="card"><h2 style="margin-top:0">إدارة الاختبارات</h2>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">درجات اختبارات «الفصول» (الفصل الأول والثاني والثالث) و«الإتقان». التغيير يسري على ما يُسجَّل بعده؛ النتائج المسجلة تبقى بدرجاتها.</p>
      <div class="qtcfg">${EXAMS.map(([k, l]) => `<fieldset class="tfs" data-qtcfg="${k}"><legend>الاختبار ال${l}</legend>
        <label>${FIELDS[0][1]}<input type="number" min="0" step="0.5" data-f="newMax" value="${C[k].newMax}"></label>
        <label>عدد أسئلة المراجعة<select data-f="revN"><option value="1" ${+C[k].revN === 1 ? 'selected' : ''}>سؤال واحد</option><option value="2" ${+C[k].revN !== 1 ? 'selected' : ''}>سؤالان</option></select></label>
        <label>${FIELDS[1][1]}<input type="number" min="0" step="0.5" data-f="revMax" value="${C[k].revMax}"></label>
        <label>${FIELDS[2][1]}<input type="number" min="0" step="0.5" data-f="effortMax" value="${C[k].effortMax}"></label>
        <p class="qtcfgsum">الدرجة الكلية: <b data-qtcfgsum>${fmtN(examMax(C[k]))}</b></p></fieldset>`).join('')}
        <fieldset class="tfs" data-qtcfgi><legend>اختبار الإتقان</legend>
          <label>درجة السؤال (أربعة أسئلة)<input type="number" min="0" step="0.25" data-i="qMax" value="${icfg().qMax}"></label>
          <label>شرط النجاح: نسبة لا تقل عن (%)<input type="number" min="0" max="100" step="0.25" data-i="pass" value="${icfg().pass}"></label>
          <p class="qtcfgsum">الدرجة الكلية: <b data-qtcfgisum>${fmtN(icfg().qMax * IQ_N)}</b></p>
          <label>رسالة التنبيه حين لا يجتاز <span class="muted">(بالموافقة عليها ينتقل الاختبار إلى «متابعة»)</span><textarea data-i="failMsg" rows="3" maxlength="400">${esc(icfg().failMsg)}</textarea></label></fieldset></div>
      <div class="row"><button type="button" class="btn primary" data-qtcfgsave>حفظ الدرجات</button></div></div>` + scopeCard();
  };
  /* ===== «نطاق المعلمين المختبِرين»: المعلم صاحب صلاحية «اختبار المتابعة» أو «اختبار الإتقان» يختبر طلاب حلقاته،
     ومعها ما يُحدد له هنا من أماكن (كل حلقاتها) أو حلقات بعينها. يُحفظ في tests_cfg.scopes[معرّف المعلم] ===== */
  const placeNm = id => byId(db.places || [], id)?.name || '—';
  function scopeCard() {
    const S = (db.settings?.tests_cfg || {}).scopes || {};
    const rows = Object.keys(S).map(id => {
      const t = byId(db.teachers || [], id); if (!t) return '';
      const sc = scopeOf(id), parts = [...sc.places.map(placeNm), ...sc.halaqat.map(h => { const x = byId(db.halaqat || [], h); return x ? String(halaqaLabel(x)) : ''; }).filter(Boolean)];
      return `<tr><td class="nm">${esc(t.name)}</td><td>${parts.length ? parts.map(p => `<span class="tag">${esc(p)}</span>`).join(' ') : '<span class="muted">حلقاته فقط</span>'}</td>
        <td><button type="button" class="btn sm" data-qtsced="${esc(id)}">تعديل</button><button type="button" class="btn sm danger" data-qtscdel="${esc(id)}">حذف</button></td></tr>`;
    }).join('');
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">نطاق المعلمين المختبِرين</h2><button type="button" class="btn primary" data-qtsced="">+ نطاق لمعلم</button></div>
      <p class="muted" style="font-size:.85rem;margin:0 0 .6rem">المعلم الذي له صلاحية «اختبار المتابعة» أو «اختبار الإتقان» (من «الصلاحيات») يختبر طلاب حلقاته، وطلاب ما يُحدد له هنا من أماكن أو حلقات، ويرى سجلاتهم. ويظهر له في «الطلاب» زر «طلاب نطاق الاختبار».</p>
      ${rows ? `<div class="tbl"><table><tr><th>المعلم</th><th>النطاق</th><th></th></tr>${rows}</table></div>` : '<p class="muted">لم يُحدد نطاق لأي معلم بعد.</p>'}</div>`;
  }
  function scopeEditor(id) {
    const T = (db.teachers || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const sc = id ? scopeOf(id) : { places: [], halaqat: [] };
    const P = (db.places || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const H = db.halaqat || [];
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qtform"><h2>${id ? 'نطاق: ' + esc(byId(T, id)?.name || '') : 'نطاق لمعلم'}</h2>
      ${id ? '' : `<label>المعلم<select name="tid"><option value="">— اختر —</option>${T.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`}
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 .5rem">اختيار المكان يشمل كل حلقاته، أو اختر حلقات بعينها.</p>
      <div class="qtscp">${P.map(p => { const hs = H.filter(h => h.placeId === p.id); return `<fieldset class="tfs"><legend><label class="chk"><input type="checkbox" data-scp="${esc(p.id)}" ${sc.places.includes(p.id) ? 'checked' : ''}> ${esc(p.name)} <small class="muted">(كل حلقاته)</small></label></legend>
        ${hs.map(h => `<label class="chk"><input type="checkbox" data-sch="${esc(h.id)}" ${sc.halaqat.includes(h.id) ? 'checked' : ''} ${sc.places.includes(p.id) ? 'disabled' : ''}> ${esc(String(halaqaLabel(h)).split(' — ')[0])}</label>`).join('') || '<p class="muted">لا حلقات</p>'}</fieldset>`; }).join('')}</div>
      <div class="row"><button type="button" class="btn primary" data-qtscsave>حفظ</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.addEventListener('change', e => { const p = e.target.closest('[data-scp]'); if (p) p.closest('fieldset').querySelectorAll('[data-sch]').forEach(c => { c.disabled = p.checked; }); });
    ov.querySelector('[data-qtscsave]').onclick = () => {
      const tid = id || ov.querySelector('[name="tid"]').value; if (!tid) { toast('اختر المعلم'); return; }
      const places = [...ov.querySelectorAll('[data-scp]:checked')].map(c => c.dataset.scp);
      const halaqat = [...ov.querySelectorAll('[data-sch]:checked:not(:disabled)')].map(c => c.dataset.sch);
      const c = (db.settings.tests_cfg = { ...(db.settings.tests_cfg || {}) }), S = { ...(c.scopes || {}) };
      if (places.length || halaqat.length) S[tid] = { places, halaqat }; else delete S[tid];
      c.scopes = S; save(); ov.remove(); render(); toast('حُفظ النطاق');
    };
  }
  document.addEventListener('click', e => {
    if (session?.role !== 'admin') return;
    const ed = e.target.closest('[data-qtsced]'); if (ed) { scopeEditor(ed.dataset.qtsced); return; }
    const del = e.target.closest('[data-qtscdel]'); if (!del) return;
    ask('حذف نطاق هذا المعلم؟ يبقى يختبر طلاب حلقاته فقط.', () => { const c = (db.settings.tests_cfg = { ...(db.settings.tests_cfg || {}) }), S = { ...(c.scopes || {}) }; delete S[del.dataset.qtscdel]; c.scopes = S; save(); render(); toast('حُذف النطاق'); });
  });
  const cfgRead = fs => { const o = {}; fs.querySelectorAll('[data-f]').forEach(i => { o[i.dataset.f] = num(i.value); }); return o; };
  document.addEventListener('DOMContentLoaded', () => {
    const baseSet = adminViews.settings;
    if (typeof baseSet !== 'function') return;
    adminViews.settings = function () {
      const h = baseSet.apply(this, arguments);
      if (session?.role !== 'admin' || typeof h !== 'string') return h;
      const btn = `<button type="button" class="btn ${cfgOn ? 'on' : ''}" data-qtcfgopen>إدارة الاختبارات</button>`;
      let out = h.replace(/(<button type="button" class="btn[^"]*" data-subtab="perms")/, btn + '$1');
      if (!out.includes('data-qtcfgopen')) out = out.replace(/(<div class="card subnav"><div class="bar" style="margin:0">[\s\S]*?)(<\/div><\/div>)/, `$1${btn}$2`);
      if (!cfgOn) return out;
      const i = out.indexOf('<div class="card subnav">'), e = i < 0 ? -1 : out.indexOf('</div></div>', i);
      if (e < 0) return out;
      return out.slice(0, e + 12).replace(/class="btn on" data-(subtab|qtools)/g, 'class="btn " data-$1') + cfgView();
    };
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-qtcfgopen]')) { cfgOn = true; render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-subtab], [data-qtools]')) cfgOn = false;
    if (!e.target.closest('[data-qtcfgsave]') || session?.role !== 'admin') return;
    const out = {};
    for (const fs of document.querySelectorAll('[data-qtcfg]')) {
      const v = cfgRead(fs), l = examName(fs.dataset.qtcfg);
      for (const [f, fl] of FIELDS) if (v[f] == null || v[f] < 0) { toast(`«${fl}» في الاختبار ال${l}: اكتب رقمًا`); fs.querySelector(`[data-f="${f}"]`).focus(); return; }
      if (!v.newMax) { toast(`درجة سؤال الجديد في الاختبار ال${l} لا تكون صفرًا`); return; }
      v.revN = v.revN === 1 ? 1 : 2;
      out[fs.dataset.qtcfg] = v;
    }
    const fi = document.querySelector('[data-qtcfgi]');
    if (fi) {
      const qMax = num(fi.querySelector('[data-i="qMax"]').value), pass = num(fi.querySelector('[data-i="pass"]').value);
      if (!(qMax > 0)) { toast('درجة سؤال الإتقان: اكتب رقمًا أكبر من صفر'); fi.querySelector('[data-i="qMax"]').focus(); return; }
      if (pass == null || pass < 0 || pass > 100) { toast('شرط نجاح الإتقان: نسبة من 0 إلى 100'); fi.querySelector('[data-i="pass"]').focus(); return; }
      out.itqan = { qMax, pass, failMsg: fi.querySelector('[data-i="failMsg"]').value.trim() || ICFG_DEF.failMsg };
    }
    db.settings.tests_cfg = { ...(db.settings.tests_cfg || {}), ...out }; save(); render(); toast('حُفظت درجات الاختبارات');   // يبقى «نطاق المعلمين» كما هو
  }, true);
  document.addEventListener('input', e => {
    const fi = e.target.closest?.('[data-qtcfgi]');
    if (fi) { const q = num(fi.querySelector('[data-i="qMax"]').value) || 0; fi.querySelector('[data-qtcfgisum]').textContent = fmtN(q * IQ_N); return; }
    const fs = e.target.closest?.('[data-qtcfg]'); if (!fs) return;
    const s = fs.querySelector('[data-qtcfgsum]'), v = cfgRead(fs);
    if (s) s.textContent = fmtN(examMax({ ...CFG_DEF, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? 0])) }));
  });
  document.addEventListener('change', e => { if (e.target.closest?.('[data-qtcfg]') && e.target.matches('select')) e.target.dispatchEvent(new Event('input', { bubbles: true })); });

  /* ===== «سجل الاختبارات» في الصفحة الرئيسية: تبويب لكل نوع، وفيه آخر خمسة طلاب اختُبروا (الاسم والتاريخ والدرجة)
     في قائمة تُمرَّر، و«المزيد» يفتح البقية في نافذة خمسين خمسين. ما يظهر: ما يحق للمستخدم رؤيته (test_recent / canSee) ===== */
  const HOME_N = 5, POP_N = 50;
  const homeRole = () => !!session && (['admin', 'supervisor', 'teacher', 'placeadmin'].includes(session.role) || (session.role === 'accountant' && !!window.Perms?.can('tests.view')));
  async function recent(kind, off, lim) {
    if (!CLOUD) {
      const L = (db.tests || []).filter(t => t.kind === kind && canSee(stOf(t.studentId)))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.ts || '').localeCompare(String(a.ts || '')));
      return { total: L.length, rows: L.slice(off, off + lim).map(t => ({ id: t.id, sid: t.studentId, name: stOf(t.studentId)?.name || '—', date: t.date, data: t.data || {}, kind: t.kind })) };
    }
    const r = (await window.Cloud.rpc('test_recent', { knd: kind, lim, off })) || [];
    return { total: +(r[0]?.total_count || 0), rows: r.map(x => ({ id: x.id, sid: x.student_id, name: x.student_name || '—', date: x.dt, data: x.data || {}, kind: x.kind })) };
  }
  function gradeOf(x) {
    const d = x.data || {};
    if (!d.max) return '<span class="muted">—</span>';
    const pct = d.pct != null ? +d.pct : Math.round((d.total / d.max) * 10000) / 100;
    const cls = x.kind === 'itqan' || d.itqan ? (d.passed ? 'tag-ok' : 'tag-no') : '';
    return `<span class="qtsum">${fmtN(+d.total || 0)} / ${fmtN(+d.max)}</span> ${pctTag(pct, cls)}`;
  }
  const rowHTML = x => `<div class="qthrow"><button type="button" class="lnk qthn" data-qtlogst="${esc(x.sid)}" data-nm="${esc(x.name)}">${esc(x.name)}</button>
    <span class="muted qthd"><bdi>${esc(String(x.date || '').slice(0, 10))}</bdi></span><span class="qthg">${gradeOf(x)}</span></div>`;
  const home = { tab: 'follow', cache: {} };
  async function homeFill(card) {
    const k = home.tab, box = card.querySelector('.qthlist'), more = card.querySelector('.qthmore');
    card.querySelectorAll('[data-qthtab]').forEach(b => { b.classList.toggle('on', b.dataset.qthtab === k); b.setAttribute('aria-selected', b.dataset.qthtab === k); });
    let c = home.cache[k];
    if (!c || Date.now() - c.at > 60000) {
      box.innerHTML = '<p class="muted">…</p>';
      try { c = home.cache[k] = { ...(await recent(k, 0, HOME_N)), at: Date.now() }; }
      catch (e) { box.innerHTML = `<p class="muted">${/test_recent|PGRST202|404/i.test(String(e.message || e)) ? 'تحتاج الاختبارات إلى تنفيذ supabase/tests.sql على الخادم.' : 'تعذّر تحميل السجل.'}</p>`; more.hidden = true; return; }
    }
    if (!card.isConnected || home.tab !== k) return;
    box.innerHTML = c.rows.length ? c.rows.map(rowHTML).join('') : `<p class="muted">لم يُسجَّل اختبار «${esc(KINDS[k])}» بعد.</p>`;
    more.hidden = c.total <= HOME_N;
    more.textContent = `المزيد (${c.total - HOME_N})`;
  }
  function homeCard() {
    if (!homeRole()) return;
    const v = window.QLView ? window.QLView() : ui.tab;
    if (v !== 'home' && v !== 'dash') return;
    const main = document.querySelector('main'); if (!main || main.querySelector('.qthome')) return;
    const card = document.createElement('div'); card.className = 'card qthome';
    card.innerHTML = `<div class="bar"><h2 class="grow" style="margin:0">سجل الاختبارات</h2>${canBulk() ? '<button type="button" class="btn sm primary" data-qtbulk>إضافة متعددة</button>' : ''}</div>
      <div class="qttabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="btn sm" data-qthtab="${k}">${l}</button>`).join('')}</div>
      <div class="qthlist"></div><div class="row qthrowb"><button type="button" class="btn sm qthmore" data-qthmore hidden></button></div>`;
    main.appendChild(card);
    homeFill(card);
  }
  new MutationObserver(() => { try { homeCard(); } catch (e) { /* ignore */ } }).observe(document.body, { childList: true, subtree: true });
  /* نافذة «المزيد»: خمسون في كل مرة، و«المزيد (n)» و«الكل (N)» */
  async function homePopup(kind) {
    openInfo(`سجل الاختبارات — ${KINDS[kind]}`, '<div class="qthlist qthpop muted">…</div><div class="row qthpg"></div>');
    const ov = [...document.querySelectorAll('.overlay')].pop(), box = ov?.querySelector('.qthpop'), pg = ov?.querySelector('.qthpg'); if (!box) return;
    let rows = [], total = 0;
    const draw = () => {
      box.className = 'qthlist qthpop'; box.innerHTML = rows.length ? rows.map(rowHTML).join('') : '<p class="muted">لا يوجد.</p>';
      const left = total - rows.length;
      pg.innerHTML = left > 0 ? `<button type="button" class="btn sm primary" data-qthp="more">المزيد (${Math.min(POP_N, left)})</button><button type="button" class="btn sm" data-qthp="all">الكل (${total})</button>` : '';
    };
    const load = async n => {
      while (n > 0) { const r = await recent(kind, rows.length, Math.min(n, 200)); total = r.total; rows = rows.concat(r.rows); n -= r.rows.length; if (!r.rows.length) break; }
      draw();
    };
    pg.addEventListener('click', async e => {
      const b = e.target.closest('[data-qthp]'); if (!b) return;
      try { await withBusy(b, load(b.dataset.qthp === 'all' ? total - rows.length : POP_N)); } catch (err) { toast('تعذّر التحميل'); }
    });
    try { await load(POP_N); } catch (e) { box.textContent = 'تعذّر تحميل السجل.'; }
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-qthtab]'); if (t) { home.tab = t.dataset.qthtab; homeFill(t.closest('.qthome')); return; }
    if (e.target.closest('[data-qthmore]')) { homePopup(home.tab); return; }
    const n = e.target.closest('[data-qtlogst]');
    if (n) { const st = stOf(n.dataset.qtlogst) || { id: n.dataset.qtlogst, name: n.dataset.nm || '', scoped: true }; logView(st); }
  });
  /* ===== «إضافة متعددة» (من بطاقة الرئيسية): نوع الاختبار (الإتقان حاليًا) ومنهجه، ثم صف لكل طالب:
     البحث باسمه واختياره من المقترحات، والتاريخ، والدرجة الإجمالية؛ و«+» لصف آخر. «حفظ» يرسل كل اختبار إلى سجل طالبه.
     من لم يجتز: تنبيه واحد بأسمائهم (رسالة «إدارة الاختبارات»)، وبالموافقة يُحفظ اختباره في «متابعة» كما في الاستمارة المفردة. ===== */
  const canBulk = () => !!session && (session.role === 'admin' || session.role === 'supervisor' || (session.role === 'teacher' && !!window.Perms?.can('tests.itqan')));
  async function bulkCands() {
    const L = (db.students || []).filter(s => !stOff(s) && canItqan(s));
    if (CLOUD && examiner() && hasScope()) {
      try { (await scopeStudents()).forEach(s => { if (!byId(db.students || [], s.id)) { EXTRA.set(s.id, s); L.push(s); } }); } catch (e) { /* طلاب حلقاته وحدهم */ }
    }
    return L;
  }
  async function bulkForm() {
    const C = icfg(), max = (+C.qMax || 0) * IQ_N, pass = +C.pass || 0;
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide qtform qtbulk"><h2>إضافة متعددة</h2>
      <div class="two"><label>نوع الاختبار<select name="kind"><option value="itqan">إتقان</option><option disabled>متابعة (قريبًا)</option><option disabled>الفصول (قريبًا)</option></select></label>
        <label>المنهج <b class="req">*</b><select name="juz"><option value="">— اختر الجزء —</option>${JUZ.map(j => `<option>${esc(j)}</option>`).join('')}</select></label></div>
      <p class="muted qtpass">الدرجة من ${fmtN(max)}، وشرط النجاح <bdi>${fmtN(pass)}%</bdi> فأكثر.</p>
      <div class="qtbrows" data-rows></div>
      <div class="row qtbadd"><button type="button" class="btn" data-badd>+ طالب آخر</button><span class="muted" data-bcount></span></div>
      <div class="row"><button type="button" class="btn primary" data-qtbsave>حفظ الكل</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const M = ov.querySelector('.modal'), rowsBox = M.querySelector('[data-rows]'), cnt = M.querySelector('[data-bcount]');
    let cands = [];
    const rowEls = () => [...rowsBox.querySelectorAll('.qtbrow')];
    const taken = except => new Set(rowEls().filter(r => r !== except).map(r => r.dataset.sid).filter(Boolean));
    const count = () => { const n = rowEls().filter(r => r.dataset.sid).length; cnt.textContent = n ? `${n} طالب` : ''; };
    const status = r => {
      const g = num(r.querySelector('[data-bg]').value), out = r.querySelector('[data-bres]');
      if (g == null || !max) { out.innerHTML = ''; return; }
      const pct = (g / max) * 100; out.innerHTML = `<span class="tag ${pct >= pass ? 'tag-ok' : 'tag-no'}"><bdi>${fmtN(pct)}%</bdi> ${pct >= pass ? 'ناجح' : 'لم يجتز'}</span>`;
    };
    const addRow = () => {
      const r = document.createElement('div'); r.className = 'qtbrow';
      r.innerHTML = `<div class="combo qtbname"><input type="search" data-bq placeholder="اكتب اسم الطالب واختر من المقترحات" autocomplete="off" aria-label="اسم الطالب"><small class="muted" data-bh></small><div class="results" hidden></div></div>
        <input type="date" data-bd value="${today()}" max="${today()}" aria-label="تاريخ الاختبار">
        <span class="qtg"><input type="number" inputmode="decimal" data-bg min="0" max="${max}" step="0.25" aria-label="الدرجة"><span class="muted">/ ${fmtN(max)}</span></span>
        <span data-bres></span>
        <button type="button" class="btn sm qtbx" data-bdel title="حذف الصف" aria-label="حذف الصف">×</button>`;
      rowsBox.appendChild(r); r.querySelector('[data-bq]').focus(); return r;
    };
    const suggest = r => {
      const q = r.querySelector('[data-bq]'), box = r.querySelector('.results'), k = norm(q.value || ''), used = taken(r);
      const rank = n => (n.startsWith(k) ? 0 : n.split(' ').some(w => w.startsWith(k)) ? 1 : 2);
      const list = k ? cands.filter(s => !used.has(s.id) && norm(s.name).includes(k)).sort((a, b) => rank(norm(a.name)) - rank(norm(b.name)) || a.name.localeCompare(b.name, 'ar')).slice(0, 30) : [];
      box.innerHTML = list.length ? list.map(s => `<button type="button" class="opt" data-bpick="${esc(s.id)}"><span>${esc(s.name)}</span><small class="muted">&nbsp;— ${esc(hLabel(s))}</small></button>`).join('') : (k ? '<div class="muted" style="padding:.6rem .8rem">لا يوجد اسم مطابق</div>' : '');
      box.hidden = !k;
    };
    const pick = (r, id) => {
      const s = cands.find(x => x.id === id); if (!s) return;
      r.dataset.sid = s.id; r.querySelector('[data-bq]').value = s.name; r.querySelector('[data-bh]').textContent = hLabel(s);
      r.querySelector('.results').hidden = true; r.querySelector('[data-bg]').focus(); count();
    };
    ov.addEventListener('input', e => {
      const r = e.target.closest('.qtbrow'); if (!r) return;
      if (e.target.matches('[data-bq]')) { delete r.dataset.sid; r.querySelector('[data-bh]').textContent = ''; suggest(r); count(); }
      if (e.target.matches('[data-bg]')) status(r);
    });
    ov.addEventListener('keydown', e => {
      const r = e.target.closest?.('.qtbrow'); if (!r || e.key !== 'Enter') return;
      e.preventDefault();
      if (e.target.matches('[data-bq]')) { const f = r.querySelector('[data-bpick]'); if (f) pick(r, f.dataset.bpick); }
      else if (e.target.matches('[data-bg]')) addRow();   // Enter بعد الدرجة: صف جديد
    });
    ov.addEventListener('click', e => {
      const p = e.target.closest('[data-bpick]'); if (p) { pick(p.closest('.qtbrow'), p.dataset.bpick); return; }
      const d = e.target.closest('[data-bdel]'); if (d) { d.closest('.qtbrow').remove(); if (!rowEls().length) addRow(); count(); return; }
      if (e.target.closest('[data-badd]')) { addRow(); return; }
      if (!e.target.closest('.qtbname')) rowsBox.querySelectorAll('.results').forEach(b => { b.hidden = true; });
    });
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    addRow();
    try { cands = await bulkCands(); } catch (e) { cands = []; }

    ov.querySelector('[data-qtbsave]').onclick = async evt => {
      const juz = M.querySelector('[name="juz"]').value, btn = evt.currentTarget;
      if (!juz) { toast('اختر المنهج (الجزء)'); M.querySelector('[name="juz"]').focus(); return; }
      const items = [];
      for (const r of rowEls()) {
        const q = r.querySelector('[data-bq]').value.trim(), g = num(r.querySelector('[data-bg]').value), dt = r.querySelector('[data-bd]').value;
        if (!r.dataset.sid && !q && g == null) continue;   // صف فارغ
        if (!r.dataset.sid) { toast(q ? `اختر «${q}» من المقترحات` : 'اختر اسم الطالب'); r.querySelector('[data-bq]').focus(); return; }
        if (!dt) { toast('حدّد تاريخ الاختبار'); r.querySelector('[data-bd]').focus(); return; }
        if (g == null) { toast(`اكتب درجة ${q}`); r.querySelector('[data-bg]').focus(); return; }
        if (g < 0 || g > max) { toast(`درجة ${q} من 0 إلى ${fmtN(max)}`); r.querySelector('[data-bg]').focus(); return; }
        const pct = max ? (g / max) * 100 : 0, passed = pct >= pass;
        items.push({ r, st: cands.find(s => s.id === r.dataset.sid), dt, data: { juz, qs: null, qMax: +C.qMax || 0, total: g, max, pct: Math.round(pct * 100) / 100, pass, passed, note: '', ...(passed ? {} : { itqan: true }) } });
      }
      if (!items.length) { toast('أضف طالبًا واحدًا على الأقل'); return; }
      const commit = async () => {
        let ok = 0; const bad = [];
        const run = async () => {
          for (const it of items) {
            const kind = it.data.passed ? 'itqan' : 'follow';
            try {
              if (CLOUD) await window.Cloud.rpc('test_add', { sid: it.st.id, knd: kind, dt: it.dt, dat: it.data });
              else { (db.tests = db.tests || []).push({ id: uid(), studentId: it.st.id, kind, date: it.dt, data: it.data, by: me()?.name || '', byMember: session?.id || '', ts: new Date().toISOString() }); }
              ok++; it.r.remove();
            } catch (err) { bad.push(it); it.r.classList.add('qtbbad'); it.r.querySelector('[data-bres]').innerHTML = `<span class="tag tag-no">${esc(/test_add|PGRST202|404/i.test(String(err.message || err)) ? 'يحتاج tests.sql' : 'تعذّر الحفظ')}</span>`; }
          }
          if (!CLOUD && ok) save();
        };
        await withBusy(btn, run());
        dropCache(); const hc = document.querySelector('main .qthome'); if (hc) { home.tab = 'itqan'; homeFill(hc); }
        if (!bad.length) { ov.remove(); toast(`حُفظ ${ok} اختبار إتقان ${juz}`); }
        else { if (!rowEls().length) addRow(); count(); toast(`حُفظ ${ok}، وتعذّر ${bad.length} (ما زال في النافذة)`); }
      };
      const failed = items.filter(it => !it.data.passed);
      if (!failed.length) { commit(); return; }
      const cf = document.createElement('div'); cf.className = 'overlay';
      cf.innerHTML = `<div class="modal qtfail"><h2>لم يجتز الإتقان: ${failed.length}</h2>
        <p class="qtfailr">${failed.map(it => `${esc(it.st.name)} (<bdi>${fmtN(it.data.pct)}%</bdi>)`).join('، ')}</p>
        <p class="qtfailm">${esc(C.failMsg || ICFG_DEF.failMsg).replace(/\n/g, '<br>')}</p>
        <div class="row"><button type="button" class="btn primary" data-qtok>موافق</button><button type="button" class="btn" data-close>رجوع</button></div></div>`;
      document.body.appendChild(cf);
      cf.querySelector('[data-close]').onclick = () => cf.remove();
      cf.querySelector('[data-qtok]').onclick = () => { cf.remove(); commit(); };
      cf.querySelector('[data-qtok]').focus({ preventScroll: true });
    };
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-qtbulk]')) bulkForm(); });

  /* اختبار جديد أو حذف: تُحدَّث القائمة في الرئيسية عند العودة إليها */
  const dropCache = () => { home.cache = {}; };
  document.addEventListener('click', e => { if (e.target.closest('[data-qtsave], [data-qtok], .overlay [data-yes]')) setTimeout(dropCache, 0); }, true);

  window.QLTests = { canTest, canTerm, followForm, termForm, logView };

  const css = document.createElement('style');
  css.textContent = `.qtmenu{position:fixed;z-index:65;display:flex;flex-direction:column;min-width:12rem;padding:.3rem;border:1px solid var(--line);border-radius:12px;background:var(--card,#fff);box-shadow:0 10px 28px rgba(10,18,35,.18)}
    .qtmenu button{font:inherit;text-align:start;display:flex;flex-direction:column;gap:.05rem;padding:.5rem .7rem;border:0;border-radius:8px;background:none;color:var(--text);cursor:pointer}
    .qtmenu button:hover,.qtmenu button:focus-visible{background:var(--navy-l)}.qtmenu small{color:var(--muted);font-size:.78rem}
    .qtform{max-width:640px}.qtsub{margin:-.3rem 0 .6rem;font-size:.88rem}.qtdate{max-width:14rem}
    .qtgrid{display:flex;flex-direction:column;gap:.35rem}.qtrow{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
    .qtrl{flex:0 0 3.6rem;font-weight:700;font-size:.9rem}.qtrow .chips{margin:0}
    .qtlog{display:flex;flex-direction:column;gap:.7rem}
    .qttabs{display:flex;gap:.35rem;flex-wrap:wrap;margin:0 0 .6rem}.qttabs:empty{display:none}
    .qtn{display:inline-block;min-width:1.3rem;padding:0 .3rem;border-radius:999px;font-size:.75rem;line-height:1.3rem;background:var(--navy-l,#eaeef5);color:var(--navy,#13294b)}
    .qtpass{display:block;margin-top:.2rem;font-size:.8rem}
    .qtitem{position:relative;padding:.6rem .75rem;border:1px solid var(--line);border-radius:12px}
    .qtdelb{position:absolute;inset-inline-end:.6rem;top:.55rem;z-index:1}.qtitem:has(.qtdelb) > .sfr:first-of-type{padding-inline-end:4.5rem}
    .qtpct{font-weight:800}.qtpct:not(.tag-ok):not(.tag-no){background:var(--navy-l,#eaeef5);color:var(--navy,#13294b)}.qtneed{font-size:.8rem}
    .qtih{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem}.qtih .grow{flex:1}
    .qtitem .sfr{display:flex;gap:.6rem;padding:.35rem .1rem;border-bottom:1px solid var(--line)}.qtitem .sfr:last-child{border-bottom:0}
    .qtitem .sfr span{flex:0 0 8.5rem;color:var(--muted);font-size:.9rem}.qtitem .sfr b{flex:1;min-width:0;font-weight:600}
    .qtterm{max-width:22rem}
    .qtsubq + .qtsubq{margin-top:.6rem;padding-top:.6rem;border-top:1px dashed var(--line)}.qtsubh{display:block;margin:0 0 .3rem;font-size:.92rem}
    .qtscopebar{display:flex;justify-content:flex-end;margin:0 0 .8rem}.qtscopebar .btn{display:inline-flex;align-items:center;gap:.4rem}
    .qtsq{width:100%;margin:0 0 .6rem}.qtslist{display:flex;flex-direction:column}
    .qtsrow{display:flex;align-items:center;gap:.6rem;padding:.45rem .1rem;border-bottom:1px solid var(--line)}.qtsrow>div{flex:1;min-width:0;display:flex;flex-direction:column}
    .qtscp{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:0 1rem}.qtscp .chk{display:flex;gap:.4rem;align-items:center;margin:.15rem 0}
    .qterr{margin-inline-start:.25rem;font-weight:600}
    .qtbulk{max-width:820px}.qtbrows{display:flex;flex-direction:column;gap:.1rem}
    .qtbrow{display:flex;align-items:flex-start;gap:.45rem .6rem;flex-wrap:wrap;padding:.5rem 0;border-bottom:1px solid var(--line)}
    .qtbrow .qtbname{flex:1 1 15rem;min-width:0;margin:0}.qtbrow .qtbname input{margin:0}.qtbrow [data-bh]{display:block;margin-top:.15rem;font-size:.78rem}
    .qtbrow > input[type=date]{width:auto;flex:0 0 auto;margin:0}.qtbrow .qtg{padding-top:.2rem}.qtbrow [data-bres]{padding-top:.45rem}
    .qtbrow .qtbx{margin-inline-start:auto}.qtbrow.qtbbad{background:color-mix(in srgb,#e6b0aa 18%,transparent)}
    .qtbadd{align-items:center;margin:.5rem 0}.qtbrow .opt small{font-size:.78rem}
    .qthome .qthlist{max-height:15.5rem;overflow-y:auto;overscroll-behavior:contain}
    .qthlist{display:flex;flex-direction:column}.qthrowb{justify-content:center;margin:.5rem 0 0}.qthpg{justify-content:center;margin:.6rem 0 0}
    .qthrow{display:flex;align-items:center;gap:.4rem .8rem;flex-wrap:wrap;padding:.5rem .1rem;border-bottom:1px solid var(--line)}.qthrow:last-child{border-bottom:0}
    .qthn{flex:1 1 9rem;min-width:0;text-align:start;font-weight:700}.qthd{font-size:.85rem}.qthg{display:inline-flex;align-items:center;gap:.35rem}
    .qtfail{max-width:440px}.qtfailr{margin:.2rem 0 .5rem;font-weight:700;color:var(--danger,#b3261e)}.qtfailm{margin:0 0 .4rem;line-height:1.8}
    .qtexist{margin:.2rem 0 .6rem;padding:.4rem .6rem;border:1px solid var(--line);border-radius:8px;font-size:.86rem;font-weight:700;color:var(--amber,#9a6a12)}
    .qtq{display:flex;align-items:center;gap:.5rem .7rem;flex-wrap:wrap;padding:.35rem 0}.qtq + .qtq{border-top:1px solid var(--line)}
    .qtql{flex:0 0 9.5rem;font-size:.92rem}.qtq select{flex:1 1 10rem;width:auto;margin:0}
    .qtman{flex:1 1 16rem;display:flex;align-items:center;gap:.35rem;min-width:0}.qtman input{flex:1 1 5rem;min-width:0;width:auto;margin:0}.qtman .muted{flex:none;font-size:.85rem}
    .qtg{display:inline-flex;align-items:center;gap:.35rem;flex:none}.qtg input{width:5.5rem;margin:0;text-align:center}
    .qttotal{margin:.4rem 0 0;padding:.55rem .8rem;border-radius:10px;border:1.5px solid var(--navy,#13294b);font-size:1.02rem}
    .qttotal:empty{display:none}.qtsum{font-weight:800}
    .qtcfg{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:0 1rem}.qtcfgsum{margin:.3rem 0 0}
    @media (max-width:600px){.qtql{flex-basis:100%}.qtitem .sfr{flex-direction:column;gap:.05rem}.qtitem .sfr span{flex:none}}`;
  document.head.appendChild(css);
})();
