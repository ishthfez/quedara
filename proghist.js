/* ============ البرامج — سجل الطالب في المسابقات، واستيراد السنوات السابقة ============
   1) قسم «المسابقات» في ملف الطالب: مشاركاته في مسابقة رمضان عبر السنين (prog_student_history) للطاقم الذي يرى الطالب.
   2) زر «استيراد سنة سابقة» في قائمة نسخ مسابقة رمضان (المدير والمدير العام): لصق من Excel ثم prog_import_year. */
(function () {
  'use strict';
  const CLOUD = () => !!(window.Cloud && window.Cloud.enabled);
  const rpc = (fn, args) => window.Cloud.rpc(fn, args || {});
  const role = () => (typeof session !== 'undefined' && session && session.role) || '';
  const LV = { m1: 'م1', m2: 'م2', m3: 'م3', m4: 'م4', m5: 'م5', m6: 'م6', m7: 'م7', m8: 'م8' };
  const RESULT = { winner: 'فائز', honor: 'مكرَّم', below: 'لم يبلغ الحد', out: 'خرج' };
  const TRACK = { general: 'العام', halaqat: 'الحلقات' };
  const num = (v) => (v === null || v === undefined || v === '' ? '' : String(+v));
  const errMsg = (e) => String((e && e.message) || e || '').replace(/^.*?:\s*/, '') || 'تعذّر التنفيذ';

  // ---------------------------------------------------------------- 1) ملف الطالب
  let fraf = 0;
  function fileHist() {
    fraf = 0;
    if (!CLOUD() || role() === 'student') return;
    document.querySelectorAll('.sfile[data-sfile]:not([data-pgh])').forEach((box) => {
      box.dataset.pgh = '1';
      const sid = box.dataset.sfile;
      rpc('prog_student_history', { sid }).then((rows) => {
        if (!rows || !rows.length || !box.isConnected) return;
        const sec = document.createElement('section');
        sec.className = 'sfsec noprint'; sec.dataset.sk = 'programs';
        sec.innerHTML = `<h3 class="sf-h">المسابقات</h3><div class="tbl"><table><thead><tr><th>السنة</th><th>المستوى</th><th>المسار</th><th>الدرجة</th><th>النتيجة</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${esc(String(r.year || ''))}</td><td>${esc(LV[r.level] || r.level || '')}${r.level === 'm8' && r.amount && r.amount.from ? ` <small>(${esc(String(r.amount.from))}–${esc(String(r.amount.to))})</small>` : ''}</td>
            <td>${esc(TRACK[r.track] || '')}</td><td>${num(r.score)}</td><td>${esc(RESULT[r.result] || r.result || '')}</td></tr>`).join('')}</tbody></table></div>`;
        const acts = box.querySelector(':scope > .sfacts');
        if (acts) box.insertBefore(sec, acts); else box.appendChild(sec);
      }).catch(() => { /* بلا صلاحية أو بلا الدالة: لا يظهر القسم */ });
    });
  }
  new MutationObserver(() => { if (!fraf) fraf = setTimeout(fileHist, 60); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------------------------------------------------------------- 2) استيراد سنة سابقة
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْـ]/g, '');
  const toDigits = (s) => String(s || '').replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632);
  function lvlOf(s) {
    const t = toDigits(s).trim().toLowerCase();
    const m = t.match(/^(?:م|m)?\s*([1-8])\b/);
    return m ? 'm' + m[1] : null;
  }
  function resOf(s) {
    const t = norm(s);
    if (!t) return '';
    if (/فائز|فاز/.test(t)) return 'winner';
    if (/مكرم|تكريم/.test(t)) return 'honor';
    if (/خرج|غائب|غاب/.test(t)) return 'out';
    if (/لم|دون/.test(t)) return 'below';
    return '';
  }
  function parse(text) {
    const idx = new Map();
    (db.students || []).forEach((s) => { const k = norm(s.name); idx.set(k, idx.has(k) ? null : s.id); });   // null = اسم مكرر
    return String(text || '').split(/\r?\n/).map((ln) => ln.split('\t').map((x) => x.trim())).filter((c) => c.some(Boolean))
      .filter((c) => !/الاسم|المستوى/.test(c.join(' ')))   // سطر العناوين
      .map((c) => {
        const [name, level, score, result, prize, place, teacher] = c;
        const lv = lvlOf(level), k = norm(name), sid = idx.get(k);
        return { name, level: lv, levelRaw: level, score: toDigits(score) === '' ? null : +toDigits(score), result: resOf(result), resultRaw: result,
          prize: toDigits(prize), place: place || '', teacher: teacher || '', student_id: sid || null, dup: idx.has(k) && sid === null };
      });
  }
  function openImport() {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="modal wide"><h2>استيراد سنة سابقة</h2>
      <p class="muted">انسخ الصفوف من Excel والصقها هنا، بهذا الترتيب: <b>الاسم · المستوى (م1–م8) · الدرجة · النتيجة (فائز / مكرم / لم يبلغ / خرج) · الجائزة · المكان · المحفظ</b>. الأعمدة بعد المستوى اختيارية.
      تُنشأ نسخة مغلقة للسنة إن لم توجد، والطالب الموجود في النسخة لا يُكرَّر.</p>
      <label>السنة (هجري) <input type="number" data-i="yr" min="1400" max="1600" style="max-width:8rem" lang="en"></label>
      <label>الصفوف <textarea data-i="txt" rows="7" placeholder="الاسم	المستوى	الدرجة	النتيجة"></textarea></label>
      <div class="row" style="gap:.4rem"><button class="btn ghost" data-i="prev">معاينة</button><button class="btn" data-i="go" disabled>استيراد</button><button class="btn ghost" data-close>إغلاق</button></div>
      <div data-i="out" style="margin-top:.6rem"></div></div>`;
    document.body.appendChild(o);
    const g = (k) => o.querySelector(`[data-i=${k}]`);
    let rows = [];
    o.addEventListener('click', async (ev) => {
      if (ev.target === o || ev.target.closest('[data-close]')) return o.remove();
      const b = ev.target.closest('button[data-i]'); if (!b) return;
      if (b.dataset.i === 'prev') {
        rows = parse(g('txt').value);
        const ok = rows.filter((r) => r.level), linked = ok.filter((r) => r.student_id).length;
        g('out').innerHTML = rows.length ? `<p><b>${ok.length}</b> صف صالح · مرتبط بطالب مسجّل: <b>${linked}</b> · يُضاف بالاسم فقط: <b>${ok.length - linked}</b>${rows.length - ok.length ? ` · يُتجاهل لعدم وضوح المستوى: <b>${rows.length - ok.length}</b>` : ''}</p>
          <div class="tbl" style="max-height:45vh;overflow:auto"><table><thead><tr><th>الاسم</th><th>المستوى</th><th>الدرجة</th><th>النتيجة</th><th>الجائزة</th><th>الربط</th></tr></thead><tbody>
          ${rows.map((r) => `<tr${r.level ? '' : ' style="opacity:.5"'}><td>${esc(r.name)}</td><td>${r.level ? LV[r.level] : `<span class="pg-tag w">${esc(r.levelRaw || '؟')}</span>`}</td><td>${num(r.score)}</td>
            <td>${r.result ? RESULT[r.result] : esc(r.resultRaw || '')}</td><td>${esc(r.prize)}</td><td>${r.student_id ? 'مسجّل' : r.dup ? '<span class="pg-tag w">اسم مكرر — بالاسم</span>' : 'بالاسم'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">لا صفوف.</p>';
        g('go').disabled = !ok.length;
        return;
      }
      if (b.dataset.i === 'go') {
        const yr = +toDigits(g('yr').value);
        if (!(yr >= 1400 && yr <= 1600)) { toast('اكتب السنة الهجرية'); g('yr').focus(); return; }
        const ok = rows.filter((r) => r.level).map((r) => ({ student_id: r.student_id, name: r.name, level: r.level, score: r.score, result: r.result, prize: r.prize, place: r.place, teacher: r.teacher }));
        b.disabled = true;
        let n = 0;
        try {
          for (let i = 0; i < ok.length; i += 300) n += (await rpc('prog_import_year', { yr, rows: ok.slice(i, i + 300) })) || 0;
          toast(`استُورد ${n} من ${ok.length} لسنة ${yr}`);
          o.remove();
          try { document.querySelector('main [data-pg="back"]') || render(); } catch (e) { /* ignore */ }
        } catch (e) { toast(errMsg(e)); b.disabled = false; }
      }
    });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('main [data-ph="import"]');
    if (b) openImport();
  });

  // ---------------------------------------------------------------- التركيب
  function install() {
    try { if (!VFILES.includes('./proghist.js')) VFILES.push('./proghist.js'); } catch (e) { /* ignore */ }
    const NEW = '<button class="btn" data-pg="new">+ نسخة جديدة</button>';
    const OLD_NOTE = '<p class="muted" style="margin-top:.8rem">الدورة المكثفة والبرامج التربوية تُضاف في المرحلتين التاليتين.</p>';
    const wrap = (V) => {
      if (!V || !V.programs || V.programs._ph) return;
      const base = V.programs;
      const f = function () {
        const h = base();
        if (typeof h !== 'string') return h;
        return h.replace(OLD_NOTE, '').replace(NEW, `<span class="row" style="gap:.4rem">${CLOUD() ? '<button class="btn ghost" data-ph="import">استيراد سنة سابقة</button>' : ''}${NEW}</span>`);
      };
      f._ph = true; V.programs = f;
    };
    try { ['admin', 'supervisor'].forEach((r) => wrap(VIEWS[r])); wrap(adminViews); wrap(supervisorViews); } catch (e) { /* ignore */ }
  }
  document.addEventListener('DOMContentLoaded', install);
})();
