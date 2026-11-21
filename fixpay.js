'use strict';
/* ============ إصلاح استيراد ملف الدفعات في «الطلاب» بالخطأ ============
   ملف الدفعات (الشهر، المبلغ، التاريخ…) استُورد من «الأعضاء ← الطلاب ← استيراد» بدل «الاشتراكات ← استيراد دفعات»، فحدث:
     - كل اسم يطابق طالبًا في حلقة ذهب إلى «مكرر للمراجعة» (بيانات الدفعة في «بيانات إضافية»).
     - كل اسم لا يطابق أحدًا أُضيف طالبًا جديدًا «بلا حلقة»، وأعمدة الدفعة ذهبت إلى «بيانات معلّقة».
   هذا الملف:
     1) يمنع تكرار الخطأ: استيراد الطلاب يرفض ملفًا فيه «المبلغ» و«الشهر» ويدلّ على المكان الصحيح.
     2) أداة إصلاح للمدير (في «مكرر للمراجعة» وصفحة «الطلاب» حين يوجد أثر الخطأ):
        - تحذف من «مكرر للمراجعة» ما جاء من ملف الدفعات (وما تعارض مع الطلاب المحذوفين).
        - تحذف الطلاب الذين أُضيفوا «بلا حلقة» من ملف الدفعات، بعد نقل أي دفعة عليهم إلى الطالب الحقيقي بالاسم نفسه إن وُجد واحد فقط،
          ولا تحذف طالبًا عليه حضور أو تسميع أو دفعة لا تُستعاد بإعادة الاستيراد (تبقيه وتذكره).
        - تحذف أعمدة الدفعة من «بيانات معلّقة».
   يُحمَّل بعد dups.js و feesimport.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./fixpay.js')) VFILES.push('./fixpay.js'); } catch (e) { /* ignore */ } });
  const PAYH = ['معرف الطالب', 'المكان في الكشف', 'السنة', 'الشهر', 'المبلغ', 'التاريخ', 'الخصم', 'المطلوب'];
  const isPayHeader = h => PAYH.includes(String(h || '').trim());

  /* 1) منع استيراد ملف الدفعات طلابًا */
  if (typeof importRows === 'function') {
    const base = importRows;
    importRows = (table, kind) => {
      if (kind === 'students') {
        const heads = (table || []).slice(0, 5).flatMap(r => Array.from(r || [], c => String(c ?? '').trim()));
        if (heads.includes('المبلغ') && heads.includes('الشهر')) return { err: 'هذا ملف دفعات اشتراكات، لا ملف طلاب. استورده من «الاشتراكات» ← «استيراد دفعات».' };
      }
      return base(table, kind);
    };
  }

  /* 2) ما تركه الخطأ */
  function scan() {
    const pend = (db.pending || []).filter(p => p.kind === 'students' && isPayHeader(p.header));
    const fromPay = new Set(pend.flatMap(p => (p.values || []).map(v => v.mid)));
    const wrong = db.students.filter(s => !s.halaqaId && fromPay.has(s.id));
    const wrongNames = new Set(wrong.map(s => norm(s.name)));
    const list = db.payroll?.settings?.dup_students || [];
    const rev = list.filter(x => Object.keys(x.extra || {}).some(isPayHeader) || wrongNames.has(norm(x.name)));
    return { pend, wrong, rev };
  }
  /* النتيجة تُحفظ ما دامت البيانات لم تتغير (المراقب يستدعيها مع كل تغيير في الصفحة) */
  const dsig = () => `${db.students.length}|${(db.pending || []).length}|${(db.pending || []).reduce((a, p) => a + (p.values || []).length, 0)}|${(db.payroll?.settings?.dup_students || []).length}|${(db.fees || []).length}|${db.halaqat.length}`;
  let fCache = null, fSig = '';
  const found = () => { const g = dsig(); if (g !== fSig) { fSig = g; const r = scan(); fCache = r.wrong.length || r.rev.length || r.pend.length ? r : null; } return fCache; };

  function fix() {
    const { pend, wrong, rev } = scan();
    const withHal = new Map(); db.students.forEach(s => { if (s.halaqaId) { const k = norm(s.name); withHal.set(k, [...(withHal.get(k) || []), s]); } });
    const keep = [], del = new Set(); let moved = 0, dropped = 0;
    wrong.forEach(s => {
      const att = db.attendance.some(a => a.studentId === s.id) || db.records.some(r => r.studentId === s.id);
      const fs = (db.fees || []).filter(f => f.studentId === s.id);
      const twin = (withHal.get(norm(s.name)) || []);
      const target = twin.length === 1 ? twin[0] : null;
      /* له دفعات ولا طالب واحد بالاسم نفسه تُنقل إليه: يبقى كما هو (كانت دفعات «كشف الإيراد» تُحذف نهائيًا على أن إعادة
         الاستيراد تُرجعها، وإعادة الاستيراد تطابق بمعرّف الطالب أو كوده القديم، وهما للطالب المحذوف نفسه فلا ترجع) */
      const lost = fs.filter(f => !target);
      if (att || lost.length) { keep.push(s); return; }
      fs.forEach(f => { if (target) { f.studentId = target.id; moved++; } else dropped++; });
      del.add(s.id);
    });
    const dropIds = new Set((db.fees || []).filter(f => del.has(f.studentId)).map(f => f.id));
    db.fees = (db.fees || []).filter(f => !dropIds.has(f.id));
    db.students = db.students.filter(s => !del.has(s.id));
    const revIds = new Set(rev.map(x => x.id));
    db.payroll.settings.dup_students = (db.payroll.settings.dup_students || []).filter(x => !revIds.has(x.id));
    /* أعمدة الدفعة في «بيانات معلّقة»: تُحذف قيم المحذوفين، والعمود الفارغ يُحذف */
    const pendIds = new Set(pend.map(p => p.id));
    db.pending = db.pending.map(p => pendIds.has(p.id) ? { ...p, values: (p.values || []).filter(v => !del.has(v.mid)) } : p)
      .filter(p => !pendIds.has(p.id) || (p.values || []).length);
    save(); render();
    return { del: del.size, keep: keep.length, rev: revIds.size, moved, dropped, keepNames: keep.map(s => s.name) };
  }

  function dialog() {
    const r = scan();
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>إصلاح استيراد ملف الدفعات</h2>
      <p style="margin:0 0 .6rem">استُورد ملف الدفعات من «الطلاب» بدل «الاشتراكات»، فترك:</p>
      <ul style="margin:0 0 .6rem;padding-inline-start:1.2rem;line-height:1.9">
        <li><b>${r.rev.length}</b> اسمًا في «مكرر للمراجعة» ← تُحذف من القائمة.</li>
        <li><b>${r.wrong.length}</b> طالبًا أُضيفوا «بلا حلقة» ← يُحذفون (وتُنقل أي دفعة عليهم إلى الطالب الحقيقي بالاسم نفسه).</li>
        <li><b>${r.pend.length}</b> أعمدة دفعة في «بيانات معلّقة» ← تُحذف.</li></ul>
      <p class="note" style="margin:0 0 .6rem">لا يُمس أي طالب في حلقة. وكل طالب «بلا حلقة» عليه حضور أو تسميع أو دفعة مسجّلة يدويًا يبقى كما هو وأذكر اسمه لك.
      <b>احفظ نسخة احتياطية قبل التنفيذ</b> (الإعدادات ← النسخ الاحتياطية).</p>
      <div class="row"><button type="button" class="btn primary" data-fpok>إصلاح</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-fpok]').onclick = () => {
      const x = fix(); fSig = tSig = ''; ov.remove();
      const msg = `تم: حُذف ${x.del} طالبًا أُضيفوا بالخطأ، و${x.rev} من «مكرر للمراجعة»${x.moved ? `، ونُقلت ${x.moved} دفعة إلى أصحابها` : ''}${x.dropped ? `، وحُذفت ${x.dropped} دفعة مستوردة (تعود بإعادة استيراد ملف الدفعات)` : ''}.`;
      if (x.keep) openInfo('تم الإصلاح', `<p>${esc(msg)}</p><p class="note">بقي ${x.keep} طالبًا «بلا حلقة» لأن عليهم حضورًا أو تسميعًا أو دفعات مسجّلة يدويًا، راجعهم: ${x.keepNames.slice(0, 30).map(esc).join('، ')}${x.keep > 30 ? '…' : ''}</p>`);
      else toast(msg);
    };
  }
  window.QLFixPay = { scan, fix };

  /* شريط التنبيه في «مكرر للمراجعة» و«الطلاب» حين يوجد أثر الخطأ */
  new MutationObserver(() => {
    if (session?.role !== 'admin' || window.QL_DEMO) return;
    const main = document.querySelector('main'); if (!main || main.querySelector('[data-fixpay]')) return;
    if (!['members', 'dups', 'students'].includes((window.QLView ? window.QLView() : ui.tab))) return;
    const r = found(); if (!r) return;
    const card = main.querySelector('.card'); if (!card) return;
    card.insertAdjacentHTML('afterbegin', `<div class="note" data-fixpay style="border:1px solid var(--red,#b3372f);margin:0 0 .7rem">
      <b>يبدو أن ملف الدفعات استُورد هنا بالخطأ:</b> ${r.rev.length} في «مكرر للمراجعة»، و${r.wrong.length} طالبًا أُضيفوا بلا حلقة.
      <button type="button" class="btn sm primary" data-fixpay-go style="margin-inline-start:.4rem">إصلاح</button></div>`);
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => { if (e.target.closest('[data-fixpay-go]') && session?.role === 'admin') dialog(); });

  /* ===== 3) «مكرر للمراجعة»: دمج من في المكان نفسه أو الحلقة نفسها =====
     الاسم المطابق في الحلقة نفسها أو المسجد نفسه هو الطالب نفسه بالتأكيد: يُحذف من القائمة، ويُكمل الطالب الموجود
     بما ينقصه من بيانات الملف (الجوال، رقم الطالب القديم). ومن في مكان آخر يبقى للمراجعة.
     حلقة الملف: بمعرّفها إن وُجد، وإلا باسم الحلقة أو معلمها؛ وإن كان للمعلم حلقات في أكثر من مكان ولم تطابق الحلقة نفسها، يبقى للمراجعة. */
  const halsOf = x => {
    const hid = x.vals?.['core:halaqaId']; if (hid && byId(db.halaqat, hid)) return [byId(db.halaqat, hid)];
    const q = x.halaqa || x.vals?.['core:halaqa']; if (!q) return [];
    const ks = halaqaQKeys(q), direct = db.halaqat.filter(h => halaqaKeys(h).some(k => ks.includes(k)));
    if (direct.length) return direct;
    /* اسم المعلم في الملف أطول أو أقصر من اسمه في النظام (مثل «مازن حسين» و«مازن محمد حسين»):
       كلمات الأقصر كلها في الأطول بالترتيب، والاسم الأول واحد؛ ويُعتمد إن طابق معلمًا واحدًا فقط */
    const toks = t => norm(String(t).replace(/^\s*حلقة\s+/, '')).split(' ').filter(Boolean);
    const sub = (a, b) => { let i = 0; for (const w of b) if (w === a[i]) i++; return i === a.length; };
    const qt = toks(q); if (qt.length < 2) return [];
    const ts = db.teachers.filter(t => { const tt = toks(t.name); if (tt.length < 2 || tt[0] !== qt[0]) return false; return qt.length <= tt.length ? sub(qt, tt) : sub(tt, qt); });
    return ts.length === 1 ? db.halaqat.filter(h => h.teacherId === ts[0].id) : [];
  };
  function sameTriage() {
    const list = db.payroll?.settings?.dup_students || [];
    const byName = new Map(); db.students.forEach(s => { const k = norm(s.name); byName.set(k, [...(byName.get(k) || []), s]); });
    const merge = [], other = [], unknown = [];
    list.forEach(x => {
      if (Object.keys(x.extra || {}).some(isPayHeader)) return;   // من ملف الدفعات: يُصلَح بالأداة أعلاه
      const ex = byName.get(norm(x.name)) || []; if (!ex.length) { unknown.push(x); return; }
      const hs = halsOf(x), hids = new Set(hs.map(h => h.id)), pids = new Set(hs.map(h => h.placeId).filter(Boolean));
      const sameHal = ex.find(s => hids.has(s.halaqaId));
      const samePlace = pids.size === 1 ? ex.find(s => pids.has(byId(db.halaqat, s.halaqaId)?.placeId)) : null;
      const t = sameHal || samePlace;
      if (t) merge.push({ x, t }); else if (!hs.length || pids.size > 1) unknown.push(x); else other.push(x);
    });
    return { merge, other, unknown };
  }
  function doMerge() {
    const { merge } = sameTriage(); const ids = new Set();
    merge.forEach(({ x, t }) => {
      const ph = x.vals?.['core:phone']; if (ph && !t.phone) t.phone = ph;
      const oc = x.vals?.['info:oldCode'] || x.extra?.['الرقم القديم'] || x.extra?.['رقم الطالب القديم'];
      if (oc && !t.info?.oldCode) t.info = { ...(t.info || {}), oldCode: String(oc) };
      ids.add(x.id);
    });
    db.payroll.settings.dup_students = (db.payroll.settings.dup_students || []).filter(x => !ids.has(x.id));
    save(); render();
    return ids.size;
  }
  window.QLFixPay.triage = sameTriage; window.QLFixPay.halsOf = halsOf;
  let tCache = null, tSig = '';
  const triageCached = () => { const g = dsig(); if (g !== tSig) { tSig = g; tCache = sameTriage(); } return tCache; };
  new MutationObserver(() => {
    if (session?.role !== 'admin' || (window.QLView ? window.QLView() : ui.tab) !== 'dups' || ui.msub !== 'dups') return;
    const note = document.querySelector('main .card > .note:not([data-fixpay])'); if (!note || document.querySelector('[data-samego]')) return;
    const r = triageCached(); if (!r.merge.length) return;
    note.insertAdjacentHTML('afterend', `<div class="bar" style="margin:.2rem 0 .7rem"><span class="muted grow" style="font-size:.88rem">${r.merge.length} في الحلقة نفسها أو المسجد نفسه (الطالب نفسه)${r.other.length ? ` · ${r.other.length} في مكان آخر للمراجعة` : ''}${r.unknown.length ? ` · ${r.unknown.length} حلقتهم في الملف غير محددة` : ''}</span>
      <button type="button" class="btn sm primary" data-samego>دمج من في المكان نفسه (${r.merge.length})</button></div>`);
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-samego]') || session?.role !== 'admin') return;
    const r = sameTriage();
    ask(`دمج ${r.merge.length} اسمًا مع الطالب الموجود بالاسم نفسه في الحلقة نفسها أو المسجد نفسه؟ يُحذفون من القائمة ويُكمل الطالب الموجود بجواله ورقمه القديم إن نقصا. ويبقى ${r.other.length + r.unknown.length} للمراجعة.`, () => {
      const n = doMerge(); tSig = fSig = ''; toast(`دُمج ${n} — بقي ${(db.payroll.settings.dup_students || []).length} للمراجعة`);
    });
  });
})();
