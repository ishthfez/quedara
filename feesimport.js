'use strict';
/* ============ استيراد دفعات الاشتراكات من ملف Excel (للمدير) ============
   الأعمدة (الصف الأول): معرف الطالب، رقم الطالب القديم، الاسم، السنة، الشهر، المبلغ، التاريخ، ملاحظة.
   - الطالب: بـ«معرف الطالب» إن وُجد في النظام، وإلا بـ«رقم الطالب القديم» (المحفوظ عند استيراد الطلاب).
   - كل صف دفعة عن شهرها وسنتها، بتاريخ تحصيلها الأصلي؛ فلا تصل الطلابَ رسائل تأكيد دفع عن دفعات قديمة.
   - إعادة استيراد الملف نفسه لا تكرر شيئًا: الدفعة الموجودة (الطالب والشهر والمبلغ والتاريخ نفسها) تُتجاهل.
   يُحمَّل بعد fees.js و app-forms.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./feesimport.js')) VFILES.push('./feesimport.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const MN = { 'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'إبريل': 4, 'مايو': 5, 'يونيو': 6, 'يونيه': 6, 'يوليو': 7, 'يوليه': 7, 'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12 };
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  /* الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى لاتينية */
  const dg = s => String(s ?? '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 1776).trim();
  /* المبلغ: «1,500» و«١٬٥٠٠» و«150 جنيه» و«12٫5» كانت تُسقط بصمت */
  const amt = v => { const s = dg(v).replace(/[,٬\s]/g, '').replace('٫', '.').replace(/[^\d.]/g, ''); return s && /^\d+(\.\d+)?$/.test(s) ? +s : NaN; };
  /* الكود القديم: «007» = «7» */
  const code = v => { const s = dg(v); return /^\d+$/.test(s) ? String(+s) : s; };
  const col = (head, names) => head.findIndex(h => names.some(n => norm(h) === norm(n)));
  const okDate = (y, m, d) => { const t = new Date(Date.UTC(+y, +m - 1, +d)); return +m >= 1 && +m <= 12 && t.getUTCMonth() === +m - 1 && t.getUTCDate() === +d; };
  /* التاريخ: نص 2026-01-04 أو 4/1/2026 (يوم/شهر/سنة) أو رقم تاريخ Excel. التاريخ غير الصالح (شهر 13 مثلًا) يُرفض */
  const toDate = v => {
    const s = dg(v); if (!s) return '';
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return okDate(iso[1], iso[2], iso[3]) ? `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}` : null;
    const a = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (a) return okDate(a[3], a[2], a[1]) ? `${a[3]}-${a[2].padStart(2, '0')}-${a[1].padStart(2, '0')}` : null;
    if (/^\d{5}(\.\d+)?$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5); return d.toISOString().slice(0, 10); }
    return null;
  };

  function analyse(table) {
    const grid = table.map(r => Array.from(r || [], c => String(c ?? '').trim()));
    const hi = grid.slice(0, 5).findIndex(r => r.some(c => ['المبلغ', 'المدفوع'].includes(c)));
    if (hi < 0) return { err: 'لم أجد عمود «المبلغ» في الصف الأول.' };
    const H = grid[hi];
    const C = { id: col(H, ['معرف الطالب']), old: col(H, ['رقم الطالب القديم', 'المعرف', 'الكود']), name: col(H, ['الاسم', 'اسم الطالب']),
      y: col(H, ['السنة']), m: col(H, ['الشهر', 'عن شهر']), amt: col(H, ['المبلغ', 'المدفوع']), date: col(H, ['التاريخ', 'تاريخ التحصيل', 'دفع']), note: col(H, ['ملاحظة']) };
    if (C.m < 0) return { err: 'لم أجد عمود «الشهر».' };
    if (C.id < 0 && C.old < 0) return { err: 'لم أجد عمود «معرف الطالب» ولا «رقم الطالب القديم».' };
    /* كود قديم مكرر لأكثر من طالب (ترقيم كل مسجد على حدة مثلًا) لا يُطابَق: كانت كل دفعاته تذهب لأحدهم */
    const byOld = new Map(), oldDup = new Set();
    db.students.forEach(s => { const c = code(s.info?.oldCode); if (!c) return; if (byOld.has(c) && byOld.get(c).id !== s.id) oldDup.add(c); byOld.set(c, s); });
    const have = new Set((db.fees || []).map(f => `${f.studentId}|${+f.y}|${+f.m}|${+f.amount}|${f.date || ''}`));
    /* صف بلا تاريخ يُطابَق بالطالب والشهر والمبلغ وحدها: كان يُحفظ بتاريخ يوم الاستيراد، فإعادة استيراد الملف في يوم آخر تكرر كل دفعة */
    const haveNoDate = new Set((db.fees || []).map(f => `${f.studentId}|${+f.y}|${+f.m}|${+f.amount}`));
    const out = { ok: [], dup: 0, none: [], bad: [] };
    grid.slice(hi + 1).forEach((r, ri) => {
      const rowNo = hi + ri + 2, who = (C.name >= 0 && r[C.name]) || (C.old >= 0 && r[C.old]) || '';
      const bad = why => out.bad.push({ row: rowNo, who, why });
      const raw = String(r[C.amt] ?? '').trim();
      if (!raw && !r.some(c => String(c ?? '').trim())) return;   // صف فارغ
      const amount = amt(raw);
      /* بلا مبلغ أو صفر: لم يدفع (يُتخطى كما كان)؛ ومبلغ مكتوب لا يُفهم يُعرض في المعاينة بدل إسقاطه بصمت */
      if (!(amount > 0)) { if (raw && Number.isNaN(amount)) bad(`مبلغ غير مفهوم «${raw}»`); return; }
      const mv = norm(dg(r[C.m])), m = MN[mv] || Object.entries(MN).find(([k]) => norm(k) === mv)?.[1] || (+mv >= 1 && +mv <= 12 ? +mv : 0);
      if (!m) { bad(`شهر غير مفهوم «${String(r[C.m] ?? '')}»`); return; }
      const date = C.date >= 0 ? toDate(r[C.date]) : '';
      if (date === null) { bad(`تاريخ غير صالح «${String(r[C.date] ?? '')}»`); return; }
      /* السنة: من عمودها، وإلا من تاريخ الدفع مع مراعاة تغيّر السنة (ديسمبر يُدفع في يناير التالي، ويناير يُدفع مقدّمًا في ديسمبر) */
      let y = C.y >= 0 && +dg(r[C.y]) > 2000 ? +dg(r[C.y]) : 0;
      if (!y) {
        if (!date) { bad('بلا سنة ولا تاريخ'); return; }
        const dy = +date.slice(0, 4), dm = +date.slice(5, 7);
        y = m - dm > 6 ? dy - 1 : dm - m > 6 ? dy + 1 : dy;
      }
      const oc = C.old >= 0 ? code(r[C.old]) : '';
      if (oc && oldDup.has(oc) && !(C.id >= 0 && byId(db.students, dg(r[C.id])))) { bad(`الكود القديم «${oc}» لأكثر من طالب`); return; }
      const s = (C.id >= 0 && byId(db.students, dg(r[C.id]))) || (oc && byOld.get(oc)) || null;
      if (!s) { out.none.push({ name: C.name >= 0 ? r[C.name] : '', old: oc, m, y, amount }); return; }
      const k = `${s.id}|${y}|${m}|${amount}|${date}`, k0 = `${s.id}|${y}|${m}|${amount}`;
      if (have.has(k) || (!date && haveNoDate.has(k0))) { out.dup++; return; }
      have.add(k); haveNoDate.add(k0);
      /* بلا تاريخ في الملف: أول الشهر المدفوع عنه، لا تاريخ اليوم (تاريخ اليوم كان يُرسل للطلاب «تأكيد دفع» عن دفعات قديمة) */
      out.ok.push({ id: uid(), studentId: s.id, y, m, amount, date: date || `${y}-${String(m).padStart(2, '0')}-01`, by: 'كشف الإيراد', byMember: session?.id || '', note: (C.note >= 0 ? r[C.note] : '') || 'استيراد من كشف الإيراد' });
    });
    return out;
  }

  function dialog() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>استيراد دفعات الاشتراكات</h2>
      <p class="muted" style="font-size:.88rem;margin:0 0 .6rem">ملف Excel فيه: معرف الطالب أو رقم الطالب القديم، والشهر، والسنة، والمبلغ، والتاريخ. كل صف يُسجَّل دفعةً عن شهره بتاريخ تحصيله، والدفعات الموجودة من قبل لا تتكرر.</p>
      <div class="bar"><label class="btn primary" style="margin:0">اختيار ملف Excel<input type="file" accept=".xlsx" data-fimf hidden></label></div>
      <div data-fiprev></div>
      <div class="row"><button type="button" class="btn primary" data-fiok disabled>استيراد</button><button type="button" class="btn" data-close>إغلاق</button></div></div>`;
    document.body.appendChild(ov);
    let R = null;
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-fimf]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const box = ov.querySelector('[data-fiprev]'); box.innerHTML = '<p class="muted">جارٍ قراءة الملف…</p>';
      try { R = analyse(await parseXLSX(await f.arrayBuffer())); } catch (err) { R = { err: 'تعذّرت قراءة الملف. احفظه بصيغة xlsx ثم أعد المحاولة.' }; }
      if (R.err) { box.innerHTML = `<p class="note" style="color:var(--red)">${esc(R.err)}</p>`; return; }
      const byM = {}; R.ok.forEach(f => { const k = f.y * 100 + f.m; byM[k] = byM[k] || { n: 0, s: 0, y: f.y, m: f.m }; byM[k].n++; byM[k].s += f.amount; });
      const sum = R.ok.reduce((a, f) => a + f.amount, 0);
      const noneNames = [...new Map(R.none.map(x => [x.old + x.name, x])).values()];
      box.innerHTML = `<div class="grid"><div class="stat"><b>${R.ok.length}</b><span>دفعة جاهزة</span></div><div class="stat"><b>${money(sum)}</b><span>جنيه</span></div>
        ${R.dup ? `<div class="stat"><b>${R.dup}</b><span>موجودة من قبل (تُتجاهل)</span></div>` : ''}${R.none.length ? `<div class="stat"><b>${R.none.length}</b><span>بلا طالب في النظام</span></div>` : ''}${R.bad.length ? `<div class="stat"><b>${R.bad.length}</b><span>صف لم يُفهم (لن يُستورد)</span></div>` : ''}</div>
        ${R.bad.length ? `<div class="note" style="margin:.6rem 0;color:var(--red,#b3372f)">${R.bad.length} صف لن يُستورد؛ صحّحها في الملف ثم أعد الاستيراد (الدفعات الموجودة لا تتكرر):<br><small>${R.bad.slice(0, 15).map(b => `صف ${b.row}${b.who ? ' (' + esc(b.who) + ')' : ''}: ${esc(b.why)}`).join('<br>')}${R.bad.length > 15 ? '<br>…' : ''}</small></div>` : ''}
        ${Object.keys(byM).length ? `<div class="tbl"><table><tr><th>الشهر</th><th>الدفعات</th><th>المبلغ</th></tr>${Object.keys(byM).sort().map(k => `<tr><td>${MONTHS[byM[k].m - 1]} ${byM[k].y}</td><td>${byM[k].n}</td><td>${money(byM[k].s)}</td></tr>`).join('')}</table></div>` : ''}
        ${R.none.length ? `<div class="note" style="margin-top:.6rem">${R.none.length} دفعة لـ${noneNames.length} طالبًا غير موجودين في النظام فلن تُستورد${noneNames.length > 50 ? ' — <b>إن كانوا المنقطعين فاستورد ملف المنقطعين أولًا ثم أعد هذا الاستيراد</b>' : ''}:<br><small>${noneNames.slice(0, 20).map(x => esc(x.name || x.old)).join('، ')}${noneNames.length > 20 ? '…' : ''}</small></div>` : ''}`;
      ov.querySelector('[data-fiok]').disabled = !R.ok.length;
    };
    ov.querySelector('[data-fiok]').onclick = () => {
      if (!R?.ok?.length) return;
      db.fees = (Array.isArray(db.fees) ? db.fees : []).concat(R.ok);
      const n = R.ok.length, s = R.ok.reduce((a, f) => a + f.amount, 0);
      ov.remove(); save(); render(); toast(`استُوردت ${n} دفعة (${money(s)} جنيه)`);
    };
  }
  window.QLFeeImport = dialog;
  document.addEventListener('click', e => { if (e.target.closest('[data-fee-import]') && session?.role === 'admin') dialog(); });
})();
