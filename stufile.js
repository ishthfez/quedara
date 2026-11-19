'use strict';
/* ============ ملف الطالب (التصميم الجديد) ============
   - الرأس: الصورة والاسم (بلا كبسولة «صغير / كبير»)، وأعلى يسار الملف زرّا «طباعة» و«تنزيل» (PDF أو Excel).
   - «البيانات»: ما سُجّل في استمارة التقديم فقط (الخانات الفارغة لا تظهر).
   - «الحلقة»: معلمها (بلا كبسولة «حلقة») ومكانها ووقتها ومشرفها، و«ملاحظات خاصة» يكتبها مشرف الحلقة (أو المدير العام) وحده،
     ويقرؤها العاملون على الحلقة دون الطالب (supabase/sup_notes.sql).
   - «الاشتراكات»: قيمة الاشتراك (ومعها الخصم وسببه إن وُجد)، والدفع «منتظم» أو «غير منتظم» (سقط منه أكثر من شهر)،
     وزر «سجل الاشتراكات» يفتح السجل في نافذة داخلية.
   - بلا أزرار تكبير وتصغير (لا جداول في الملف).
   أقسامه مُعلَّمة لـ«صلاحيات صفحة الطلاب» (stuperm.js) بالمفاتيح نفسها: own (البيانات) و dec (الحلقة) و fee (الاشتراكات)،
   وأزراره بالخصائص نفسها (data-fee-log، data-fee-assign، data-act=editStudent / delMember / printCard).
   يُحمَّل آخر الملفات ويحل محل studentCard كاملًا (app-forms.js وما أضافته app-abs.js و people.js و feeset.js). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./stufile.js')) VFILES.push('./stufile.js'); } catch (e) { /* ignore */ } });
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const fmt = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const can = p => { try { return window.Perms ? Perms.can(p) : session?.role === 'admin'; } catch (e) { return false; } };
  const isAdm = () => session?.role === 'admin';
  /* «صلاحيات صفحة الطلاب» (stuperm.js) تُطبَّق على الملف أينما فُتح، لا في صفحة «الطلاب» وحدها */
  const allow = k => isAdm() || !window.QLStuPerm?.can || window.QLStuPerm.can(k) !== false;
  const ICON_PRINT = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';
  const ICON_DL = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>';

  /* ===== «البيانات»: خانات الاستمارة المملوءة فقط ===== */
  function dataRows(st) {
    const I = st.info || {}, T = I.test || {}, child = st.cat !== 'adult', a = ageOf(st);
    const tel = (p, w) => (p || w ? `<span dir="ltr">${esc(p || '—')}</span>${w && w !== p ? ` — واتساب <a href="https://wa.me/2${esc(w)}" target="_blank" rel="noopener" dir="ltr">${esc(w)}</a>` : ''}` : '');
    const R = [];
    const add = (l, v, html) => { if (v === '' || v == null || v === false) return; R.push([l, html ? v : esc(v)]); };
    add('الرقم القومي', I.nid);
    if (child) { add('تاريخ الميلاد', I.birth ? `${I.birth}${a === '' ? '' : ' (' + a + ' سنة)'}` : ''); add('الدراسة', I.study); add('الصف الدراسي', I.grade); }
    else { add('السن', a === '' ? '' : a + ' سنة'); add('المؤهل الدراسي', [I.qual, I.qualStatus].filter(Boolean).join(' — ')); add('الحالة الاجتماعية', I.marital); add('الوظيفة', I.job); add('الوقت المتاح للحضور', I.avail); }
    add('العنوان', I.address);
    add('رقم الهاتف', tel(I.phone, I.whatsapp), true);
    if (child) {
      add('ولي الأمر', I.gName);
      add('هاتف ولي الأمر', tel(I.gPhone, I.gWhatsapp), true);
      add('وظيفة ولي الأمر', I.gJob);
      add('صلة القرابة', I.gRel === 'شخص آخر' ? (I.gRelOther || 'شخص آخر') : I.gRel);
    }
    add('اختبار المستوى', [T.read && 'قراءة: ' + T.read, T.tajweed && 'تجويد: ' + T.tajweed, T.hifz && 'حفظ: ' + T.hifz].filter(Boolean).join(' · '));
    add('تاريخ التقديم', I.joinDate);
    if (I.pledge) add('التوقيع على التنبيهات', child ? 'وقّع ولي الأمر' : 'وقّع المتقدم');
    (db.fields?.students || []).forEach(f => add(f.label, (st.extra || {})[f.key]));
    return R;
  }

  /* ===== «الاشتراكات»: القيمة والخصم، وانتظام الدفع ===== */
  const discsList = () => { const c = db.settings?.priv_fees || {}; return Array.isArray(c.discs) ? c.discs : []; };
  function feeInfo(st) {
    const I = st.info || {}, due = window.QLFeeDue ? window.QLFeeDue(st) : null;
    let base = due;
    if (I.feeDisc && window.QLFeeDue) { const k = I.feeDisc; I.feeDisc = ''; try { base = window.QLFeeDue(st); } finally { I.feeDisc = k; } }
    const d = I.feeDisc ? discsList().find(x => x.id === I.feeDisc) : null;
    const disc = I.feeDisc ? { name: d?.name || 'خصم', amt: base != null && due != null && base > due ? base - due : null } : null;
    return { due, base, disc };
  }
  /* منتظم: دفع كل شهر من أول دفعة له حتى الشهر الماضي؛ غير منتظم: سقط منه أكثر من شهر.
     البداية أول دفعة لا تاريخ التقديم: الدفعات القديمة قد لا تكون أُدخلت كلها في التطبيق */
  function regularity(st, due) {
    if (due === 0) return { cls: 'tag-ok', txt: 'معفى' };
    const paid = new Set((db.fees || []).filter(f => f.studentId === st.id && +f.amount > 0).map(f => +f.y * 12 + +f.m - 1));
    if (!paid.size) return { cls: 'tag-no', txt: 'لم تُسجَّل له دفعات' };
    const now = new Date(), end = now.getFullYear() * 12 + now.getMonth() - 1;   // حتى الشهر الماضي (الجاري قد لا يكون موعده انتهى)
    const start = Math.min(...paid);
    const miss = []; for (let k = start; k <= end; k++) if (!paid.has(k)) miss.push(k);
    const nM = n => (n === 2 ? 'شهرين' : n <= 10 ? n + ' أشهر' : n + ' شهرًا');
    if (miss.length > 1) return { cls: 'tag-no', txt: `غير منتظم — لم يدفع ${nM(miss.length)}`, title: miss.map(k => `${MONTHS[k % 12]} ${Math.floor(k / 12)}`).join('، ') };
    return { cls: 'tag-ok', txt: 'منتظم', title: miss.length ? `لم يدفع ${MONTHS[miss[0] % 12]} ${Math.floor(miss[0] / 12)}` : '' };
  }

  /* ===== الملاحظات الخاصة ===== */
  const canSeeNote = () => !!session && session.role !== 'student';
  const localNote = st => (st.info || {}).supNote || '';
  const isMySup = st => { const h = byId(db.halaqat, st.halaqaId); return session?.role === 'supervisor' && (h?.supervisorId === session.id || !!window.isGenSup?.(me())); };

  function html(st) {
    const h = byId(db.halaqat, st.halaqaId), D = dataRows(st), F = feeInfo(st), Rg = regularity(st, F.due);
    const row = ([l, v]) => `<div class="sfr"><span>${esc(l)}</span><b>${v}</b></div>`;
    const anyFee = (db.fees || []).some(f => f.studentId === st.id);
    const feeVal = F.due == null ? '<span class="muted">غير محدد</span>'
      : `${fmt(F.due)} جنيه${F.base != null && F.base > F.due ? ` <s class="muted">${fmt(F.base)}</s>` : ''}`;
    const discNote = F.disc ? `<div class="sfdisc">خصم «${esc(F.disc.name)}»${F.disc.amt ? ` بقيمة ${fmt(F.disc.amt)} جنيه` : ''}${(st.info || {}).feeDiscNote ? ` — ${esc(st.info.feeDiscNote)}` : ''}</div>` : '';
    return `<div class="scard sfile" data-sfile="${esc(st.id)}">
      <div class="sfhead">${avatar(st, 84)}<div class="sfname"><h2>${esc(st.name)}</h2>${stOff(st) ? '<span class="tag tag-no">منقطع</span>' : ''}</div>
        ${allow('s_print') ? `<div class="sftools noprint"><button type="button" class="btn icon-only" data-act="printCard" title="طباعة" aria-label="طباعة">${ICON_PRINT}</button>
          <span class="sfdl"><button type="button" class="btn icon-only" data-sfdl title="تنزيل" aria-label="تنزيل" aria-haspopup="true">${ICON_DL}</button>
            <span class="sfmenu" hidden><button type="button" data-sfdlv="pdf">ملف PDF</button><button type="button" data-sfdlv="xls">ملف Excel</button></span></span></div>` : ''}</div>
      ${allow('s_own') ? `<section class="sfsec" data-sk="own"><h3 class="sf-h">البيانات</h3>${D.length ? `<div class="sfgrid">${D.map(row).join('')}</div>` : '<p class="muted">لم تُسجَّل بيانات في الاستمارة.</p>'}</section>` : ''}
      ${allow('s_dec') ? `<section class="sfsec" data-sk="dec"><h3 class="sf-h">الحلقة</h3>${h ? `<div class="sfgrid">${[['المعلم', esc((h.teacherId && byId(db.teachers, h.teacherId)?.name) || String(halaqaLabel(h)).split(' — ')[0].replace(/^\s*حلقة\s+/, ''))], ['المكان', esc(placeName(h) || '—')], ['الوقت', esc(timeText(h) || '—')], ['المشرف', esc(h.supervisorId ? supName(h.supervisorId) : '—')]].map(row).join('')}</div>` : '<p class="muted">لم تُحدَّد حلقته بعد.</p>'}
        ${canSeeNote() && h ? `<div class="sfnote noprint" data-sfnote><div class="sfnote-h"><b>ملاحظات خاصة</b><span class="muted">يكتبها المشرف، ولا يراها الطالب</span></div><div class="sfnote-b muted">…</div></div>` : ''}</section>` : ''}
      ${allow('s_fee') ? `<section class="sfsec" data-sk="fee"><h3 class="sf-h">الاشتراكات</h3>
        <div class="sfgrid">${row(['قيمة الاشتراك', feeVal + discNote])}${row(['الدفع', `<span class="tag ${Rg.cls}" ${Rg.title ? `title="${esc(Rg.title)}"` : ''}>${esc(Rg.txt)}</span>`])}</div>
        <div class="row noprint sfrow">${anyFee && allow('s_feelog') ? `<button type="button" class="btn sm" data-fee-log="${esc(st.id)}">سجل الاشتراكات</button>` : ''}${can('fees.amount') && allow('s_assign') ? `<button type="button" class="btn sm" data-fee-assign="${esc(st.id)}">تعديل الفئة والخصم</button>` : ''}</div></section>` : ''}
      <div class="row noprint sfacts">${isAdm() ? `<button type="button" class="btn sm" data-act="editStudent" data-id="${esc(st.id)}">تعديل البيانات</button>${CLOUD && (st.hasLogin || !stOff(st)) ? `<button type="button" class="btn sm" data-act="cloudPw" data-id="${esc(st.id)}" data-k="students">${st.hasLogin ? 'كلمة مرور جديدة' : 'إنشاء حساب دخول'}</button>` : ''}<button type="button" class="btn sm danger" data-act="delMember" data-k="students" data-id="${esc(st.id)}">حذف الطالب</button>` : ''}</div>
    </div>`;
  }

  /* الملاحظات: من الخادم (أو محليًا في وضع بلا خادم) */
  async function loadNote(box, st) {
    const el = box.querySelector('[data-sfnote]'); if (!el) return;
    const body = el.querySelector('.sfnote-b');
    let note = '', by = '', at = '', edit = isMySup(st);
    if (CLOUD) {
      try { const r = await window.Cloud.rpc('sup_note_get', { sid: st.id }); const x = Array.isArray(r) ? r[0] : r; if (!x) { el.remove(); return; } note = x.note || ''; by = x.by_name || ''; at = x.updated_at || ''; edit = edit && !!x.can_edit; }
      catch (e) { body.textContent = /sup_note_get|PGRST202|404/i.test(String(e.message || e)) ? 'تحتاج الملاحظات إلى تنفيذ supabase/sup_notes.sql على الخادم.' : 'تعذّر تحميل الملاحظات.'; return; }
    } else note = localNote(st);
    const show = () => {
      body.className = 'sfnote-b' + (note ? '' : ' muted');
      body.innerHTML = (note ? esc(note).replace(/\n/g, '<br>') : 'لا توجد ملاحظات.') + (by && note ? `<small class="muted sfnote-by">— ${esc(by)}${at ? ' · ' + esc(String(at).slice(0, 10)) : ''}</small>` : '')
        + (edit ? `<div><button type="button" class="btn sm" data-sfnote-edit>${note ? 'تعديل' : 'إضافة ملاحظة'}</button></div>` : '');
    };
    show();
    el.addEventListener('click', async e => {
      if (e.target.closest('[data-sfnote-edit]')) {
        body.className = 'sfnote-b';
        body.innerHTML = `<textarea rows="3" maxlength="2000" data-sfnote-t>${esc(note)}</textarea><div class="row" style="margin-top:.4rem"><button type="button" class="btn sm primary" data-sfnote-save>حفظ</button><button type="button" class="btn sm" data-sfnote-cancel>إلغاء</button></div>`;
        body.querySelector('textarea').focus();
      } else if (e.target.closest('[data-sfnote-cancel]')) show();
      else if (e.target.closest('[data-sfnote-save]')) {
        const v = body.querySelector('[data-sfnote-t]').value.trim(), b = e.target.closest('button');
        const run = async () => {
          if (CLOUD) await window.Cloud.rpc('sup_note_set', { sid: st.id, txt: v });
          else { st.info = { ...(st.info || {}), supNote: v }; save(); }
          note = v; by = me()?.name || ''; at = new Date().toISOString(); show(); toast('حُفظت الملاحظة');
        };
        try { await (typeof withBusy === 'function' ? withBusy(b, run()) : run()); } catch (err) { toast('تعذّر الحفظ: ' + (err.message || err)); }
      }
    });
  }

  /* التنزيل: PDF (نافذة الطباعة نفسها: «حفظ بتنسيق PDF») أو Excel (البيانات صفوفًا: القسم، الخانة، القيمة) */
  function toXls(box, st) {
    const rows = [['القسم', 'الخانة', 'القيمة']];
    box.querySelectorAll('.sfsec').forEach(s => {
      if (getComputedStyle(s).display === 'none') return;
      const t = s.querySelector('.sf-h')?.textContent.trim() || '';
      s.querySelectorAll('.sfr').forEach(r => rows.push([t, r.children[0].textContent.trim(), r.children[1].textContent.replace(/\s+/g, ' ').trim()]));
      const n = s.querySelector('[data-sfnote] .sfnote-b'); if (n && !n.querySelector('textarea')) rows.push([t, 'ملاحظات خاصة', n.textContent.replace(/(تعديل|إضافة ملاحظة)$/, '').trim()]);
    });
    const csv = '﻿' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ملف ${st.name.replace(/[\\/:*?"<>|]/g, ' ')} ${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('حُفظ «' + a.download + '» (يفتح في Excel)');
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-sfdl]');
    document.querySelectorAll('.sfmenu').forEach(m => { if (!t || !m.parentNode.contains(t)) m.hidden = true; });
    if (t) { const m = t.parentNode.querySelector('.sfmenu'); m.hidden = !m.hidden; return; }
    const v = e.target.closest('[data-sfdlv]'); if (!v) return;
    v.closest('.sfmenu').hidden = true;
    const box = v.closest('.sfile'), st = byId(db.students, box?.dataset.sfile); if (!st) return;
    if (v.dataset.sfdlv === 'xls') toXls(box, st);
    else { toast('اختر «حفظ بتنسيق PDF» في نافذة الطباعة'); setTimeout(() => box.querySelector('[data-act="printCard"]')?.click(), 300); }
  });

  function card(st) {
    if (!st) return;
    openInfo('ملف الطالب', html(st));
    const box = [...document.querySelectorAll('.overlay .sfile')].pop(); if (!box) return;
    box.closest('.modal')?.classList.add('sfmodal');
    box.dataset.qfc = st.id;   // لا يعيد feeset.js بناء قسم الاشتراك
    loadNote(box, st);
  }
  document.addEventListener('DOMContentLoaded', () => { window.studentCard = card; try { studentCard = card; } catch (e) { /* ignore */ } });
  window.QLStuFile = { regularity, feeInfo, dataRows };

  const css = document.createElement('style');
  css.textContent = `.sfmodal{max-width:760px}
    .sfhead{display:flex;align-items:center;gap:.9rem;margin:0 0 .4rem}.sfhead .av{border-radius:18px;flex:none}
    .sfname{flex:1;min-width:0}.sfname h2{margin:0 0 .2rem;font-size:1.3rem;line-height:1.35}
    .sftools{display:flex;gap:.35rem;align-self:flex-start;margin-inline-start:auto}
    .sfdl{position:relative}.sfmenu{position:absolute;inset-inline-end:0;top:110%;z-index:5;display:flex;flex-direction:column;min-width:9rem;padding:.3rem;border:1px solid var(--line);border-radius:10px;background:var(--card,#fff);box-shadow:0 8px 24px rgba(10,18,35,.15)}
    .sfmenu[hidden]{display:none}.sfmenu button{font:inherit;text-align:start;padding:.45rem .6rem;border:0;border-radius:8px;background:none;color:var(--text);cursor:pointer}.sfmenu button:hover{background:var(--navy-l)}
    .sf-h{margin:1.1rem 0 .5rem;padding:.25rem .9rem;display:inline-block;border-radius:10px;color:#fff;font-size:.95rem;background:linear-gradient(135deg,var(--gold),var(--gold-d))}
    .sfgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:0 1.2rem}
    .sfr{display:flex;gap:.6rem;padding:.45rem .1rem;border-bottom:1px solid var(--line)}.sfr span{flex:0 0 8.5rem;color:var(--muted);font-size:.9rem}.sfr b{flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere}
    .sfdisc{font-size:.85rem;font-weight:500;color:var(--amber);margin-top:.15rem}
    .sfnote{margin:.7rem 0 0;padding:.6rem .75rem;border:1px dashed var(--line);border-radius:12px;background:color-mix(in srgb,var(--gold) 6%,transparent)}
    .sfnote-h{display:flex;flex-wrap:wrap;gap:.2rem .6rem;align-items:baseline;margin-bottom:.3rem}.sfnote-h .muted{font-size:.8rem}
    .sfnote-b{line-height:1.7}.sfnote-b textarea{width:100%}.sfnote-by{display:block;margin-top:.2rem}
    .sfrow,.sfacts{margin:.5rem 0 0;flex-wrap:wrap}.sfacts:empty{display:none}
    @media (max-width:600px){.sfr{flex-direction:column;gap:.05rem}.sfr span{flex:none}.sfhead .av{width:64px!important;height:64px!important}}
    @media print{.sfile .sf-h{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  document.head.appendChild(css);
})();
