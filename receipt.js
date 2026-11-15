'use strict';
/* ============ إيصال استلام الاشتراك (طابعة الإيصالات الصغيرة) ============
   - بعد تسجيل دفعة في «الاشتراكات» تظهر نافذة صغيرة: «طباعة إيصال» أو «لاحقًا».
   - ويُعاد طبع إيصال أي دفعة من «السجل» (زر «إيصال» بجانبها).
   - مقاس الورق 58 أو 80 ملم، يُختار مرة ويتذكره الجهاز (الطابعة خاصة بكل جهاز).
   - الطباعة من إطار مخفي بصفحة مستقلة بمقاس الإيصال، فلا تخرج صفحة التطبيق كلها.
   يُحمَّل بعد fees.js وقبل app-actions.js. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./receipt.js')) VFILES.push('./receipt.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const WKEY = 'qrcpt_w';
  const width = () => { try { return localStorage.getItem(WKEY) === '80' ? 80 : 58; } catch (e) { return 58; } };
  const setWidth = w => { try { localStorage.setItem(WKEY, String(w)); } catch (e) { /* ignore */ } };
  const money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const no = f => String(f.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const paidFor = (sid, y, m) => (db.fees || []).filter(x => x.studentId === sid && +x.y === +y && +x.m === +m).reduce((a, x) => a + (+x.amount || 0), 0);

  function receiptHtml(f) {
    const s = byId(db.students, f.studentId) || { name: '—' }, h = byId(db.halaqat, s.halaqaId);
    const due = window.QLFeeDue ? window.QLFeeDue(s, +f.y) : null, paid = paidFor(f.studentId, f.y, f.m);
    const rest = due != null && due > paid ? due - paid : 0;
    const w = width(), fs = w === 80 ? 13 : 11.5;
    const now = new Date(), time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const row = (l, v) => v ? `<tr><th>${l}</th><td>${esc(v)}</td></tr>` : '';
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال ${no(f)}</title><style>
      @page{size:${w}mm auto;margin:0}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#000}
      body{width:${w}mm;padding:3mm ${w === 80 ? 4 : 2.5}mm 6mm;font-family:Tahoma,'Segoe UI',Arial,sans-serif;font-size:${fs}px;line-height:1.45}
      .c{text-align:center}.logo{width:${w === 80 ? 22 : 17}mm;height:auto;display:block;margin:0 auto 1.5mm;filter:grayscale(1)}
      h1{font-size:${fs + 3}px;margin:0 0 .5mm}.sub{font-size:${fs}px;font-weight:700;margin:1mm 0}
      .hr{border-top:1px dashed #000;margin:2mm 0}
      table{width:100%;border-collapse:collapse}th{text-align:right;font-weight:400;white-space:nowrap;padding:.4mm 0;vertical-align:top;width:1%;padding-left:2mm}
      td{text-align:left;font-weight:700;padding:.4mm 0;word-break:break-word}
      .amt{font-size:${fs + 7}px;font-weight:800;text-align:center;margin:1.5mm 0;border:1.5px solid #000;border-radius:2mm;padding:1.2mm 0}
      .muted{font-size:${fs - 1.5}px}.sig{margin-top:5mm;font-size:${fs - 1}px}
    </style></head><body>
      <img class="logo" src="${logoSrc()}" alt="">
      <div class="c"><h1>${esc(db.settings?.org || 'إدارة الحلقات القرآنية')}</h1><div class="sub">إيصال استلام اشتراك</div>
      <div class="muted">رقم ${no(f)} · ${esc(f.date || today())} · ${time}</div></div>
      <div class="hr"></div>
      <table>${row('الطالب', s.name)}${row('الحلقة', h ? halaqaLabel(h) : '')}${row('المكان', h ? placeName(h) : '')}${row('عن شهر', `${MONTHS[(+f.m || 1) - 1]} ${f.y}`)}</table>
      <div class="amt">${money(f.amount)} جنيه</div>
      <table>${due != null ? row('المستحق للشهر', money(due) + ' جنيه') : ''}${rest ? row('الباقي', money(rest) + ' جنيه') : due != null && paid >= due ? row('الحالة', 'مسدَّد بالكامل') : ''}${row('ملاحظة', f.note || '')}${row('المستلم', f.by || me()?.name || '')}</table>
      <div class="hr"></div>
      <div class="sig">التوقيع: ............................</div>
      <div class="c muted" style="margin-top:3mm">جزاكم الله خيرًا</div>
    </body></html>`;
  }
  /* الطباعة من إطار مخفي: صفحة بمقاس الإيصال وحده */
  function print(f) {
    if (!f) return;
    document.querySelector('iframe.qrcpt')?.remove();
    const fr = document.createElement('iframe'); fr.className = 'qrcpt'; fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:-9999px;bottom:0';
    document.body.appendChild(fr);
    const d = fr.contentDocument; d.open(); d.write(receiptHtml(f)); d.close();
    let done = false;
    const go = () => { if (done) return; done = true; try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast('تعذّرت الطباعة'); } setTimeout(() => fr.remove(), 60000); };
    const img = d.querySelector('img'); // الشعار: تنتظر الطباعة تحميله (ثانية ونصف على الأكثر)
    if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(go, 1500); } else go();
  }
  /* بعد تسجيل الدفعة: نافذة صغيرة فيها «طباعة إيصال» ومقاس الورق */
  function offer(f) {
    const s = byId(db.students, f.studentId);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal"><h2>سُجّلت الدفعة</h2>
      <p style="margin:.2rem 0 .8rem"><b>${money(f.amount)} جنيه</b> لـ«${esc(s?.name || '')}» عن ${MONTHS[(+f.m || 1) - 1]} ${f.y}.</p>
      <label>مقاس ورق الطابعة<select data-rw><option value="58" ${width() === 58 ? 'selected' : ''}>58 ملم (صغير)</option><option value="80" ${width() === 80 ? 'selected' : ''}>80 ملم</option></select></label>
      <div class="row"><button type="button" class="btn primary" data-rprint>طباعة إيصال</button><button type="button" class="btn" data-close>لاحقًا</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-rw]').onchange = e => setWidth(e.target.value);
    ov.querySelector('[data-rprint]').onclick = () => { setWidth(ov.querySelector('[data-rw]').value); print(f); ov.remove(); };
    ov.querySelector('[data-rprint]').focus();
  }
  window.QLReceipt = { offer, print, html: receiptHtml };
  /* إعادة طبع إيصال دفعة من «السجل» */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fee-rcpt]'); if (!b) return;
    print((db.fees || []).find(x => x.id === b.dataset.feeRcpt));
  });
})();
