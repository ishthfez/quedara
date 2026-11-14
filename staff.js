'use strict';
/* ============ «الموظفون»: صفحة موحّدة لكل العاملين، والاسم الواحد ============
   - تبويب «المعلمون» صار «الموظفون»: صف لكل شخص (مدير، مشرف، معلم، محاسب، إداري، وموظفو المرتبات غير المصنفين)
     بصفته ووظيفته في المرتبات وحلقاته أو نطاقه وعدد طلابه وحالته، وزر «الملف» يفتح بطاقته الكاملة:
     البيانات، والحلقات، والمرتب، والغياب، والحساب، مع أزرار التعديل.
   - الاسم الواحد: تعديل اسم الشخص في «الأعضاء» أو «الموظفون» أو «المرتبات» يسري على الآخر تلقائيًا
     (وعلى كشوف الشهور المفتوحة؛ والشهور المغلقة تبقى كما هي).
   - الحلقة تُسمّى باسم معلمها دائمًا: الأسماء القديمة الثابتة تُمسح من الحلقات التي لها معلم،
     وفي «الاشتراكات» يظهر اسمها كما في «الأماكن والحلقات» («حلقة + المعلم») والمكان في عموده.
   يُحمَّل قبل app-actions.js، وما يعتمد عليها يُطبَّق بعد تحميلها. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./staff.js')) VFILES.push('./staff.js'); } catch (e) { /* ignore */ } }, 0);
  const tab = TABS.admin.find(t => t[0] === 'teachers'); if (tab) tab[1] = 'الموظفون';
  const KINDS = [['admins', 'مدير'], ['supervisors', 'مشرف'], ['teachers', 'معلم'], ['accountants', 'محاسب'], ['placeadmins', 'إداري']];
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const st = { k: '', q: '' };
  const gen = m => window.isGenSup ? window.isGenSup(m) : m?.info?.scope === 'all';
  const plc = m => window.placesOf ? window.placesOf(m) : (m?.info?.places || []);
  const emps = () => db.payroll?.employees || [];
  const empOf = m => emps().find(e => clsOf(e)?.memberId === m.id) || null;
  const fmt = n => (n === null || n === undefined || n === '' ? '—' : (+n).toLocaleString('en-US'));

  /* حلقات الشخص بحسب نوعه */
  function halsOf(x) {
    if (!x.m) return [];
    if (x.k === 'teachers') return db.halaqat.filter(h => h.teacherId === x.m.id);
    if (x.k === 'supervisors') return gen(x.m) ? db.halaqat.slice() : db.halaqat.filter(h => h.supervisorId === x.m.id);
    if (x.k === 'placeadmins') { const ps = new Set(plc(x.m)); return db.halaqat.filter(h => ps.has(h.placeId)); }
    return [];
  }
  const stuIn = hs => { const s = new Set(hs.map(h => h.id)); return db.students.filter(x => s.has(x.halaqaId) && !stOff(x)).length; };
  function scopeTxt(x) {
    if (x.k === 'supervisors' && gen(x.m)) return 'كل الحلقات (مشرف عام)';
    if (x.k === 'placeadmins') return plc(x.m).map(id => byId(db.places, id)?.name).filter(Boolean).join('، ') || 'بلا مكان';
    const hs = halsOf(x);
    if (!hs.length) return x.k === 'teachers' || x.k === 'supervisors' ? 'بلا حلقة' : '—';
    if (x.k === 'teachers') return hs.map(h => placeName(h) || 'بلا مكان').join('، ');
    return hs.length + ' حلقة';
  }
  const stopped = x => x.k === 'teachers' ? (x.m.admin || {}).status === 'موقوف' || x.e?.status === 'متوقف' : x.e?.status === 'متوقف';
  function people() {
    const out = [];
    KINDS.forEach(([k, l], gi) => (db[k] || []).forEach(m => out.push({ m, k, gi, e: empOf(m), type: k === 'supervisors' && gen(m) ? 'مشرف عام' : l })));
    /* موظفو المرتبات الذين لم يُصنَّفوا بعد */
    emps().filter(e => !clsOf(e)).forEach(e => out.push({ m: null, k: '', gi: 9, e, type: 'غير مصنف' }));
    return out.sort((a, b) => a.gi - b.gi || ((a.m || a.e).name).localeCompare((b.m || b.e).name, 'ar'));
  }
  const nameOf = x => (x.m || x.e).name;
  const keyOf = x => (x.m ? x.k + ':' + x.m.id : 'e:' + x.e.id);
  function statusCell(x) {
    const off = stopped(x), opt = `<option value="on" ${off ? '' : 'selected'}>عامل</option><option value="off" ${off ? 'selected' : ''}>متوقف</option>`;
    if (x.k === 'teachers') return `<select class="mini" data-tstat="${x.m.id}" aria-label="حالة ${esc(nameOf(x))}">${opt}</select>`;
    if (x.e) return `<select class="mini" data-pstat="${x.e.id}" aria-label="حالة ${esc(nameOf(x))}">${opt}</select>`;
    return '<span class="muted">—</span>';
  }

  /* ===== الصفحة ===== */
  function view() {
    const all = people();
    const F = [['', 'الكل'], ...KINDS.map(([k, l]) => [k, l === 'مدير' ? 'المديرون' : l === 'مشرف' ? 'المشرفون' : l === 'معلم' ? 'المعلمون' : l === 'محاسب' ? 'المحاسبون' : 'الإداريون']), ['un', 'غير مصنف'], ['off', 'المتوقفون']];
    const list = all.filter(x => !st.k || (st.k === 'un' ? !x.m : st.k === 'off' ? stopped(x) : x.k === st.k));
    const cnt = k => all.filter(x => k === 'un' ? !x.m : k === 'off' ? stopped(x) : !k || x.k === k).length;
    const rows = list.map((x, i) => {
      const hs = halsOf(x);
      return `<tr data-stk="${esc(keyOf(x))}"><td>${i + 1}</td><td><b>${esc(nameOf(x))}</b>${stopped(x) ? ' <span class="tag tag-no">متوقف</span>' : ''}</td>
        <td>${x.m ? esc(x.type) : '<span class="tag">غير مصنف</span>'}</td><td>${esc(x.e?.role || '—')}</td><td>${esc(scopeTxt(x))}</td>
        <td>${hs.length ? stuIn(hs) : '—'}</td><td>${statusCell(x)}</td>
        <td><button type="button" class="btn sm primary" data-staff="${esc(keyOf(x))}">الملف</button></td></tr>`;
    }).join('');
    return `<div class="card"><div class="bar"><select data-stfk style="width:auto;font-weight:700" aria-label="الفئة">${F.map(([k, l]) => `<option value="${k}" ${k === st.k ? 'selected' : ''}>${l} (${cnt(k)})</option>`).join('')}</select>
        <input type="search" data-stfq value="${esc(st.q)}" placeholder="بحث بالاسم أو المكان…" style="flex:1 1 14rem;max-width:22rem" aria-label="بحث في الموظفين">
        <span class="grow"></span><button class="btn" data-act="tab" data-v="members">الأعضاء والحسابات</button><button class="btn primary" data-act="addTeacher">+ معلم</button></div>
      <div class="note">كل العاملين في مكان واحد: الصفة ونوع الحساب، والوظيفة في المرتبات، والحلقات أو النطاق، والحالة. «الملف» يعرض البيانات والحلقات والمرتب والغياب والحساب. تعديل الاسم من أي مكان يسري على الحساب والمرتبات معًا.</div>
      ${list.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الوظيفة في المرتبات</th><th>الحلقات / النطاق</th><th>الطلاب</th><th>الحالة</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد أحد في هذه الفئة.')}</div>`;
  }
  const filterRows = () => {
    const q = norm(st.q);
    document.querySelectorAll('main tr[data-stk]').forEach(r => { r.hidden = !!q && !norm(r.textContent).includes(q); });
  };
  adminViews.teachers = () => { setTimeout(filterRows, 0); return view(); };
  document.addEventListener('input', e => { if ('stfq' in (e.target.dataset || {})) { st.q = e.target.value; filterRows(); } });
  document.addEventListener('change', e => { if ('stfk' in (e.target.dataset || {})) { st.k = e.target.value; render(); } });

  /* ===== بطاقة الشخص ===== */
  function card(key) {
    const x = people().find(p => keyOf(p) === key); if (!x) return;
    const m = x.m, e = x.e, hs = halsOf(x);
    const kv = rows => `<div class="tbl" style="margin-bottom:.8rem"><table>${rows.filter(Boolean).map(([l, v]) => `<tr><th style="width:34%">${l}</th><td>${v}</td></tr>`).join('')}</table></div>`;
    const h3 = t => `<h3 style="font-size:1rem;margin:.9rem 0 .4rem">${t}</h3>`;
    const info = kv([
      ['الصفة', esc(m ? x.type : 'غير مصنف (من المرتبات فقط)')],
      ['الحالة', stopped(x) ? '<span class="tag tag-no">متوقف</span>' : '<span class="tag tag-ok">عامل</span>'],
      m && ['الجوال', esc(m.phone || m.personal?.phone || '—')],
      e && ['الوظيفة في المرتبات', esc(e.role || '—')], e && ['الكود', esc(e.code || '—')], e && ['مكان العمل (المرتبات)', esc(e.place || '—')],
      m && ['حساب الدخول', CLOUD ? (m.hasLogin ? '<span class="tag tag-ok">متاح</span>' : '<span class="tag">بلا حساب</span>') : 'محلي']
    ]);
    let hal = '';
    if (x.k === 'teachers' || x.k === 'supervisors' || x.k === 'placeadmins') {
      const title = x.k === 'teachers' ? 'حلقاته' : x.k === 'placeadmins' ? 'حلقات أماكنه' : gen(m) ? 'كل الحلقات (مشرف عام)' : 'الحلقات المسندة إليه';
      hal = h3(`${title} (${hs.length}) — ${stuIn(hs)} طالب منتظم`) + (hs.length ? `<div class="tbl" style="margin-bottom:.8rem;max-height:40vh;overflow:auto"><table><tr><th>الحلقة</th><th>المكان</th><th>الوقت</th><th>${x.k === 'teachers' ? 'المشرف' : 'المعلم'}</th><th>الطلاب</th></tr>${hs.map(h => `<tr><td><button type="button" class="lnk" data-hstu="${h.id}">${esc(halaqaLabel(h))}</button></td><td>${esc(placeName(h) || '—')}</td><td>${esc(timeText(h) || '—')}</td><td>${esc(x.k === 'teachers' ? supName(h.supervisorId) : tName(h.teacherId))}</td><td>${stuIn([h])}</td></tr>`).join('')}</table></div>` : empty(x.k === 'placeadmins' ? 'لم يُحدَّد له مكان بعد (زر «النطاق»).' : 'لا توجد حلقات.'));
    }
    let pay = '';
    if (e) {
      const rows = (db.payroll.rows || []).filter(r => r.eid === e.id).sort((a, b) => b.y * 100 + b.m - (a.y * 100 + a.m));
      const lastR = rows[0];
      pay = h3('المرتب') + kv([['نظام العمل', esc(e.sys || '—')], ['الأساسي', fmt(e.basic)], ['سعر ساعة الإضافي', fmt(e.rate)], ['الحافز', fmt(e.incentive)], ['بدل الانتقال', fmt(e.transport)], ['الساعات الأساسية', fmt(e.hours)],
        ['الشهور المسجلة', rows.length ? `${rows.length} شهرًا، آخرها ${MONTHS[lastR.m - 1]} ${lastR.y}` : 'لا يوجد']]);
      const y = new Date().getFullYear(), ab = (db.payroll.absences || []).filter(a => a.eid === e.id && +a.y === y).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const n = p => ab.filter(a => a.perm === p).length;
      pay += h3(`الغياب في ${y} (${ab.length})`) + (ab.length ? `<p class="muted" style="margin:0 0 .4rem">بإذن: ${n('بإذن')} · بغير إذن: ${n('بغير إذن')}</p><div class="tbl" style="max-height:30vh;overflow:auto"><table><tr><th>التاريخ</th><th>الإذن</th><th>السبب</th><th>الإثبات</th></tr>${ab.map(a => `<tr><td>${esc(a.date)}</td><td>${esc(a.perm || '—')}</td><td>${esc(a.reason || '—')}</td><td>${esc(a.proof || '—')}</td></tr>`).join('')}</table></div>` : empty('لا غياب مسجّل هذا العام.'));
    } else if (m) pay = h3('المرتب') + empty('غير مرتبط بموظف في المرتبات.');
    const btn = (attrs, l, cls = '') => `<button type="button" class="btn ${cls}" ${attrs}>${l}</button>`;
    const acts = [
      x.k === 'teachers' && btn(`data-tedit="${m.id}"`, 'تعديل البيانات', 'primary'),
      m && x.k !== 'teachers' && btn(`data-act="editName" data-id="${m.id}" data-k="${x.k}"`, 'تعديل الاسم'),
      (x.k === 'supervisors' || x.k === 'placeadmins') && btn(`data-act="memScope" data-id="${m.id}" data-k="${x.k}"`, 'النطاق'),
      e && btn(`data-act="payEditEmp" data-id="${e.id}"`, 'تعديل المرتب'),
      m && CLOUD && btn(`data-act="cloudPw" data-id="${m.id}" data-k="${x.k}"`, m.hasLogin ? 'كلمة مرور جديدة' : 'إنشاء حساب دخول'),
      !m && btn('data-act="tab" data-v="members" data-stun="1"', 'تصنيفه من «الأعضاء ← غير مصنف»', 'primary')
    ].filter(Boolean).join('');
    openInfo(nameOf(x), info + hal + pay + `<div class="row" style="margin-top:.8rem">${acts}</div>`);
    const ov = [...document.querySelectorAll('.overlay')].pop(); if (ov) ov.dataset.staffcard = '1';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-staff]'); if (b) { card(b.dataset.staff); return; }
    if (e.target.closest('[data-stun]')) ui.msub = 'unclassified';
    /* زر تعديل داخل البطاقة: تُغلق البطاقة ويُفتح نموذج التعديل */
    const a = e.target.closest('.overlay[data-staffcard] .row button:not([data-close])');
    if (a) { const ov = a.closest('.overlay'); setTimeout(() => ov.remove(), 0); }
  }, true);

  /* ===== الاسم الواحد =====
     يُقارَن اسم كل عضو باسم موظف المرتبات المرتبط به عند كل عرض: الطرف الذي تغيّر يُنقل إلى الآخر. */
  const last = new Map();
  function syncNames() {
    if (session?.role !== 'admin' || !db.payroll) return false;
    let ch = false;
    const isClosed = (y, m) => (window.Payroll?.isClosed ? window.Payroll.isClosed(y, m) : (db.payroll.closed || []).includes(y + '-' + m));
    const rename = (e, n) => { e.name = n; (db.payroll.rows || []).forEach(r => { if (r.eid === e.id && r.name !== n && !isClosed(r.y, r.m)) r.name = n; }); };
    for (const e of emps()) {
      const c = clsOf(e); if (!c?.memberId) continue;
      const m = byId(db[COLL[c.kind]] || [], c.memberId); if (!m) continue;
      /* الربط بالاسم وحده يُثبَّت، حتى لا ينقطع إن تغيّر الاسم */
      if (c.auto) { clsMap()[e.id] = { kind: c.kind, memberId: m.id }; ch = true; }
      const km = 'm:' + m.id, ke = 'e:' + e.id;
      if (m.name !== e.name) {
        const mc = last.has(km) && last.get(km) !== m.name, ec = last.has(ke) && last.get(ke) !== e.name;
        if (mc && !ec) { rename(e, m.name); ch = true; } else if (ec && !mc) { m.name = e.name; ch = true; }
      }
      last.set(km, m.name); last.set(ke, e.name);
    }
    /* الحلقة تُسمّى باسم معلمها: لا اسم ثابت قديم */
    (db.halaqat || []).forEach(h => { if (h.name && byId(db.teachers, h.teacherId)) { h.name = ''; ch = true; } });
    return ch;
  }
  /* اسم الحلقة في «الاشتراكات» كما في «الأماكن والحلقات»: «حلقة + المعلم» فقط، لأن المكان يظهر بجانبه في عمود أو كبسولة مستقلة.
     (إن كان للمعلم حلقتان في المكان نفسه يُضاف وقت الحلقة للتمييز) */
  const baseLabel = halaqaLabel;
  halaqaLabel = function (h) {
    if (ui.tab !== 'fees' || !h) return baseLabel(h);
    const t = byId(db.teachers, h.teacherId); if (!t) return baseLabel(h);
    const same = db.halaqat.filter(x => x.teacherId === h.teacherId && x.placeId === h.placeId);
    return 'حلقة ' + t.name + (same.length > 1 ? ' — ' + (timeText(h) || '#' + (same.indexOf(h) + 1)) : '');
  };
  /* ===== «الطلاب»: أول 200 طالب فقط حتى يُطلب الكل (جدول 1,680 طالبًا يجمّد الهاتف) ===== */
  const LIMIT = 200; let showAll = false, lastN = -1;
  const baseStudents = adminViews.students;
  adminViews.students = () => {
    let h = baseStudents();
    const i = h.indexOf('<div class="tbl"><table>'), end = i < 0 ? -1 : h.indexOf('</table>', i);
    if (end < 0) return h;
    const parts = h.slice(i, end).split('<tr>'), N = parts.length - 2;
    if (N !== lastN) { showAll = false; lastN = N; }
    if (showAll || N <= LIMIT) return h;
    return h.slice(0, i) + parts.slice(0, 2 + LIMIT).join('<tr>') + '</table></div>'
      + `<p class="muted" style="margin:.6rem 0 0">يظهر أول ${LIMIT} من ${N} طالبًا. اختر المكان أو الحلقة للتضييق، أو <button type="button" class="btn sm" data-stall>عرض الكل</button></p>`
      + h.slice(h.indexOf('</div>', end) + 6);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-stall]')) { showAll = true; render(); } });
  setTimeout(() => {
    const base = render;
    render = function () {
      try { if (syncNames()) save(); } catch (err) { /* لا يعطّل العرض */ }
      return base.apply(this, arguments);
    };
  }, 0);
})();
