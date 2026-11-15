'use strict';
/* ============ «مكرر للمراجعة» في الأعضاء ============
   عند استيراد الطلاب، من يتجاهله الاستيراد لأن اسمه يطابق طالبًا موجودًا (أو طالبًا سبقه في الملف) في حلقة أخرى
   يُحفظ هنا بكل بياناته بدل أن يضيع، ليقرر المدير لكل واحد:
     «طالب مستقل» بعد تمييز اسمه، أو «نفس الطالب» فيُحذف من القائمة.
   من يتكرر بالاسم نفسه في الحلقة نفسها يُعدّ الطالب نفسه (إعادة استيراد) فلا يُضاف للقائمة.
   القائمة محفوظة في إعدادات المرتبات (للمدير وحده على الخادم) فلا تحتاج أي تغيير في الخادم. */
(() => {
  setTimeout(() => { try { if (!VFILES.includes('./dups.js')) VFILES.push('./dups.js'); } catch (e) { /* ignore */ } }, 0);
  const store = () => { db.payroll = db.payroll || { settings: {}, employees: [], rows: [], closed: [], absences: [] }; const s = (db.payroll.settings = db.payroll.settings || {}); return (s.dup_students = s.dup_students || []); };
  const list = () => db.payroll?.settings?.dup_students || [];
  const hKeysOf = s => { const h = byId(db.halaqat, s.halaqaId); return h ? halaqaKeys(h) : []; };
  const findHalaqa = q => q ? db.halaqat.find(h => halaqaKeys(h).some(k => halaqaQKeys(q).includes(k))) : null;

  /* التقاط نتيجة قراءة ملف الاستيراد، ثم نقل المكرر إلى القائمة عند الضغط على «استيراد» */
  let last = null;
  if (typeof importRows === 'function') {
    const base = importRows;
    importRows = (table, kind) => { const r = base(table, kind); last = r && !r.err ? { kind, ...r } : null; return r; };
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#imok') || !last || last.kind !== 'students' || session?.role !== 'admin') return;
    const { rows, cols, loose } = last; last = null;
    /* أين يوجد كل اسم: حلقات الطلاب الحاليين + حلقات الصفوف غير المكررة في الملف نفسه */
    const where = new Map();
    const note = (n, keys) => { const k = norm(n); where.set(k, [...(where.get(k) || []), ...keys]); };
    db.students.forEach(s => note(s.name, hKeysOf(s)));
    rows.filter(r => !r.dup).forEach(r => note(r.name, halaqaQKeys(r.halaqa || '')));
    const Q = store(), have = new Set(Q.map(x => norm(x.name) + '|' + norm(x.halaqa)));
    let n = 0;
    rows.filter(r => r.dup).forEach(r => {
      const same = (where.get(norm(r.name)) || []).some(k => r.halaqa && halaqaQKeys(r.halaqa).includes(k));
      const key = norm(r.name) + '|' + norm(r.halaqa || '');
      if (same || have.has(key)) return;
      have.add(key);
      const vals = {}; cols.forEach(c => { if (c.id !== 'core:pin' && r.vals[c.id]) vals[c.id] = r.vals[c.id]; });
      const extra = {}; loose.forEach((l, i) => { if (r.loose[i]) extra[l.header] = r.loose[i]; });
      Q.push({ id: uid(), name: r.name, halaqa: r.halaqa || '', vals, extra, at: today() });
      n++;
    });
    if (n) setTimeout(() => { save(); render(); toast(`${n} طالبًا باسم مكرر نُقلوا إلى «الأعضاء» ← «مكرر للمراجعة»`); }, 300);
  }, true);

  /* ===== الواجهة: اختيار «مكرر للمراجعة» قبل «غير مصنف» في قائمة الأعضاء ===== */
  const base = adminViews.members;
  const opt = sel => `<option value="dups" ${sel ? 'selected' : ''}>مكرر للمراجعة (${list().length})</option>`;
  adminViews.members = () => {
    if (ui.msub !== 'dups') {
      const h = base();
      return list().length ? h.replace(/<option value="unclassified"/, opt(false) + '<option value="unclassified"') : h;
    }
    ui.msub = 'staff'; let h = base(); ui.msub = 'dups';
    const pick = ((h.match(/<select class="msubsel"[\s\S]*?<\/select>/) || [''])[0])
      .replace(/ selected(?=[ >])/g, '').replace(/<option value="unclassified"/, opt(true) + '<option value="unclassified"');
    return `<div class="memview">${view(pick)}</div>`;
  };
  function view(pick) {
    const L = list();
    /* فهرس الأسماء مرة واحدة (بدل البحث في كل الطلاب لكل اسم في القائمة) */
    const idx = new Map(); db.students.forEach(s => { const k = norm(s.name); (idx.get(k) || idx.set(k, []).get(k)).push(s); });
    const existing = x => (idx.get(norm(x.name)) || []).map(s => `${esc(s.name)}<br><small class="muted">${esc(hName(s.halaqaId) || 'بلا حلقة')}</small>`).join('<hr style="margin:.25rem 0;border:0;border-top:1px solid var(--line)">') || '<span class="muted">لم يعد موجودًا</span>';
    const extra = x => [x.vals?.['core:phone'] ? `الجوال: <span dir="ltr">${esc(x.vals['core:phone'])}</span>` : '', ...Object.entries(x.extra || {}).map(([k, v]) => `${esc(k)}: ${esc(v)}`)].filter(Boolean).join('<br>') || '—';
    const rows = L.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.name)}</b><br><small class="muted">${esc(x.halaqa || 'بلا حلقة')}</small></td><td style="font-size:.9em">${extra(x)}</td><td>${existing(x)}</td>
      <td><button type="button" class="btn sm primary" data-dupadd="${x.id}" title="إضافته طالبًا مستقلًا بعد تمييز اسمه">طالب مستقل</button> <button type="button" class="btn sm" data-dupsame="${x.id}" title="هو الطالب الموجود نفسه: يُحذف من القائمة">نفس الطالب</button></td></tr>`).join('');
    return `<div class="card"><div class="bar">${pick}</div>
      <div class="note">طلاب لم يُستوردوا لأن أسماءهم تطابق طلابًا موجودين <b>في حلقة أخرى</b>. لكل واحد: <b>«طالب مستقل»</b> إن كان شخصًا آخر (ميّز اسمه، مثلًا باسم الجد) فيُضاف إلى حلقته، أو <b>«نفس الطالب»</b> فيُحذف من هذه القائمة.</div>
      ${L.length ? `<div class="tbl"><table><tr><th>#</th><th>الاسم وحلقته في الملف</th><th>بيانات إضافية</th><th>الطالب الموجود بالاسم نفسه</th><th></th></tr>${rows}</table></div>` : empty('لا يوجد طلاب مكررون للمراجعة ✓')}</div>`;
  }

  /* إضافة المكرر طالبًا مستقلًا: بالاسم المميَّز، في حلقته، ومعه جواله وبياناته الإضافية (في «بيانات معلّقة» كبقية الاستيراد) */
  function addAsNew(x) {
    openForm('إضافة طالب مستقل', [
      { type: 'note', label: `الاسم «${x.name}» مطابق لطالب موجود. عدّله ليتميز عنه (مثلًا بإضافة اسم الجد)، ثم احفظ.` },
      { name: 'name', label: 'اسم الطالب', value: x.name, required: true }
    ], v => {
      const name = String(v.name || '').trim().replace(/\s+/g, ' ');
      if (!name) return 'اكتب الاسم';
      if (db.students.some(s => norm(s.name) === norm(name))) return 'الاسم ما زال مطابقًا لطالب موجود — أضف ما يميزه';
      let h = findHalaqa(x.halaqa);
      if (!h && x.halaqa) {
        const t = db.teachers.find(tt => halaqaQKeys(x.halaqa).includes(norm(tt.name)));
        h = { id: uid(), name: t ? '' : (/^\s*حلقة/.test(x.halaqa) ? x.halaqa : 'حلقة ' + x.halaqa), teacherId: t ? t.id : '', supervisorId: '', placeId: '' };
        db.halaqat.push(h);
      }
      const m = { id: uid(), name, halaqaId: h ? h.id : '', phone: '', pin: genPass() };
      Object.entries(x.vals || {}).forEach(([k, val]) => { if (k !== 'core:halaqa') setField(m, k, val); });
      db.students.push(m); ui.shown[m.id] = true;
      Object.entries(x.extra || {}).forEach(([header, val]) => {
        const p = db.pending.find(pp => pp.kind === 'students' && pp.header === header);
        if (p) p.values.push({ mid: m.id, v: val }); else db.pending.push({ id: uid(), kind: 'students', header, values: [{ mid: m.id, v: val }], date: today() });
      });
      db.payroll.settings.dup_students = list().filter(y => y.id !== x.id);
      setTimeout(() => toast(`أُضيف «${name}»${h ? ' إلى ' + hName(h.id) : ''}`), 50);
    });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-dupadd]');
    if (a) { const x = list().find(y => y.id === a.dataset.dupadd); if (x) addAsNew(x); return; }
    const s = e.target.closest('[data-dupsame]');
    if (s) {
      const x = list().find(y => y.id === s.dataset.dupsame); if (!x) return;
      ask(`«${x.name}» (${x.halaqa || 'بلا حلقة'}) هو نفس الطالب الموجود؟ سيُحذف من قائمة المراجعة ولن يُضاف.`, () => {
        db.payroll.settings.dup_students = list().filter(y => y.id !== x.id); save(); render(); toast('حُذف من قائمة المراجعة');
      });
    }
  });

  /* ===== «تجاهل» في نافذة الأسماء المتشابهة: لا تُقترح المجموعة مرة أخرى أبدًا =====
     يُحفظ كل زوج تجاهلتَه (عضو|عضو) في إعداد خاص بالمدير (priv_dups) يُزامَن مع الخادم،
     فلا يعود الاقتراح بعد التحديث أو على جهاز آخر، ولا إن تغيّر عدد أفراد المجموعة. */
  const pairsOf = ids => { const a = [...new Set(ids)].sort(), out = []; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push(a[i] + '|' + a[j]); return out; };
  const ignoredPairs = () => {
    const S = new Set(Array.isArray(db.settings.priv_dups) ? db.settings.priv_dups : []);
    /* ما تجاهلتَه قبل هذا التحديث (محفوظ على هذا الجهاز فقط) */
    (db.settings.dupIgnore || []).forEach(k => pairsOf(String(k).replace(/^[^:]*:/, '').split(',')).forEach(p => S.add(p)));
    return S;
  };
  /* البحث عن الأسماء المتشابهة بسرعة: نفس قواعد التطبيق (dupLike)، لكن كل اسم يُوحَّد مرة واحدة، ولا يُقارن الاسم
     إلا بالأسماء التي تبدأ بالكلمة نفسها أو تطابقه بلا مسافات — بدل مقارنة كل اسم بكل اسم (كانت ثوانيَ مع آلاف الطلاب) */
  function fastGroups() {
    const out = [], ign = new Set(typeof dupIgnored === 'function' ? dupIgnored() : []);
    DUP_KINDS.forEach(([k, lbl]) => {
      const list = k === 'payroll' ? payEmps() : (db[k] || []);
      const P = list.map(m => { const n = norm(m.name || ''); const t = n.split(' ').filter(Boolean); return { m, ns: n.replace(/\s/g, ''), t }; });
      const byFirst = new Map(), byNs = new Map();
      P.forEach((x, i) => { const f = x.t[0] || ''; (byFirst.get(f) || byFirst.set(f, []).get(f)).push(i); (byNs.get(x.ns) || byNs.set(x.ns, []).get(x.ns)).push(i); });
      const like = (x, y) => {
        if (x.ns === y.ns) return true;
        const [s2, l2] = x.t.length <= y.t.length ? [x.t, y.t] : [y.t, x.t];
        return s2.length >= 2 && s2.length < l2.length && s2[0] === l2[0] && s2[s2.length - 1] === l2[l2.length - 1] && s2.every(w => l2.includes(w));
      };
      const months = new Map();
      const pm = id => { if (!months.has(id)) months.set(id, new Set((db.payroll?.rows || []).filter(r => r.eid === id).map(r => r.y * 100 + r.m))); return months.get(id); };
      const seen = new Set();
      P.forEach((x, i) => {
        const a = x.m; if (seen.has(a.id)) return;
        const cand = [...new Set([...(byFirst.get(x.t[0] || '') || []), ...(byNs.get(x.ns) || [])])].filter(j => j > i).sort((p, q) => p - q);
        let g = [a];
        cand.forEach(j => {
          const y = P[j], b = y.m;
          if (seen.has(b.id)) return;
          if (k === 'students' && a.halaqaId && b.halaqaId && a.halaqaId !== b.halaqaId) return;
          if (k === 'payroll' && x.ns !== y.ns) { const A = pm(a.id); if ([...pm(b.id)].some(v => A.has(v))) return; }
          if (like(x, y)) g.push(b);
        });
        if (k === 'payroll') g = g.slice().sort((p, q) => (clsOf(q) ? 1 : 0) - (clsOf(p) ? 1 : 0) || pm(q.id).size - pm(p.id).size);
        if (g.length < 2) return;
        g.forEach(m => seen.add(m.id));
        const key = k + ':' + g.map(m => m.id).sort().join(',');
        if (!ign.has(key)) out.push({ k, lbl, key, items: g });
      });
    });
    return out;
  }
  window.QLDupFast = fastGroups;
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof dupGroups !== 'function') return;
    const base = (() => { try { return DUP_KINDS && payEmps && clsOf ? fastGroups : dupGroups; } catch (e) { return dupGroups; } })();
    dupGroups = function () {
      const S = ignoredPairs();
      return base.apply(this, arguments).filter(g => !pairsOf(g.items.map(m => m.id)).every(p => S.has(p)));
    };
  });
  /* قبل «تنفيذ»: كل مجموعة عليها «تجاهل» تُحفظ أزواجها (ثم يحفظ التنفيذ نفسه ويزامن) */
  document.addEventListener('click', e => {
    if (!e.target.closest('#dupdlg [data-dupok]')) return;
    const S = ignoredPairs(); let n = 0;
    document.querySelectorAll('#dupdlg .dupg').forEach(box => {
      if (!box.querySelector('[data-ignore]')?.checked) return;
      pairsOf([...box.querySelectorAll('input[type=radio]')].map(r => r.value)).forEach(p => { if (!S.has(p)) { S.add(p); n++; } });
    });
    if (n) db.settings.priv_dups = [...S];
  }, true);
})();
