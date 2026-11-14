'use strict';
/* ============ قسم «النسخ الاحتياطية» (للمدير) ============
   حالة النسخ التلقائي إلى Drive، وتنزيل نسخة فورية، واسترجاع نسخة: اختيار ملف نسخة (qulearn-….json من مجلد «نسخ قرآن احتياطية» على Drive) ← معاينة ← طريقة الاسترجاع
   ← تأكيد بكلمة مرور المدير ← الاسترجاع على الخادم دفعة واحدة (backup_restore في supabase/restore.sql). */
(() => {
  const LBL = { settings: 'الإعدادات', places: 'الأماكن', members: 'الأعضاء', member_admin: 'بيانات المعلمين الإدارية', halaqat: 'الحلقات', attendance: 'الحضور',
    records: 'التسميع', news: 'الإعلانات', custom_fields: 'الحقول المضافة', pending_columns: 'البيانات المعلّقة', pay_settings: 'إعدادات المرتبات',
    pay_employees: 'موظفو المرتبات', pay_rows: 'صفوف كشوف المرتبات', pay_closed: 'الشهور المغلقة', absences: 'غياب المعلمين', fees: 'الاشتراكات',
    collections: 'قوائم تحصيل المعلمين', exams: 'الاختبارات' };
  setTimeout(() => { try { if (!VFILES.includes('./backup.js')) VFILES.push('./backup.js'); } catch (e) { /* ignore */ } }, 0);
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }); };

  /* ===== قسم «النسخ الاحتياطية» في لوحة المدير (قبل «الإعدادات») ===== */
  TABS.admin.splice(Math.max(0, TABS.admin.findIndex(t => t[0] === 'settings')), 0, ['backup', 'النسخ الاحتياطية']);
  TAB_ICONS.backup = svg('<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><path d="M7 7a8 8 0 0 1 10 0"/>');
  const st = { status: null, loading: false, at: 0 };
  async function loadStatus(force) {
    if (!CLOUD || st.loading || (!force && st.status && Date.now() - st.at < 60000)) return;
    st.loading = true;
    try { st.status = await window.Cloud.rpc('backup_status'); } catch (e) { st.status = { error: e.message || String(e) }; }
    st.loading = false; st.at = Date.now();
    if (ui.tab === 'backup' && !document.querySelector('.overlay')) render();
  }
  const ago = ms => { const h = ms / 36e5; return h < 1 ? `منذ ${Math.max(1, Math.round(ms / 6e4))} دقيقة` : h < 48 ? `منذ ${Math.round(h)} ساعة` : `منذ ${Math.round(h / 24)} يومًا`; };
  function statusCard() {
    const S = st.status;
    let body;
    if (!S) body = '<p class="muted" style="margin:0">جارٍ التحقق من حالة النسخ…</p>';
    else if (S.error) body = /backup_status|function/i.test(S.error) && /not find|does not exist|schema cache/i.test(S.error)
      ? '<div class="note">نفّذ أمر الخادم <code dir="ltr">supabase/backup_status.sql</code> في Supabase لتظهر هنا حالة النسخ التلقائي.</div>'
      : `<div class="note">تعذّر التحقق: ${esc(S.error)}</div>`;
    else if (!S.configured) body = '<div class="note">النسخ التلقائي غير مُعدّ بعد: نفّذ <code dir="ltr">supabase/backup.sql</code> ثم أنشئ المفتاح وضعه في برنامج Google (ملف <code dir="ltr">backup/drive-backup.gs</code>).</div>';
    else {
      const last = S.last_export_at ? new Date(S.last_export_at) : null, gap = last ? new Date(S.now) - last : Infinity, ok = gap <= 36 * 36e5;
      body = `<div class="grid" style="margin:0">
          <div class="stat"><b style="font-size:1.05rem;color:${ok ? 'var(--leaf)' : 'var(--red)'}">${ok ? '✓ يعمل' : last ? '⚠ متوقف' : '⚠ لم تصل نسخة'}</b><span>الحالة</span></div>
          <div class="stat"><b style="font-size:1.05rem">${last ? esc(ago(gap)) : '—'}</b><span>آخر نسخة تلقائية${last ? `<br><small>${esc(last.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }))}</small>` : ''}</span></div>
          <div class="stat"><b>${S.export_count}</b><span>نسخة وصلت إلى Drive</span></div></div>
        ${ok ? '' : `<div class="note" style="margin-top:.8rem;background:#fdf1f0;border-color:#e8c4c0;color:var(--red)">${last ? 'مرّ أكثر من يوم ونصف بلا نسخة تلقائية.' : 'لم تصل أي نسخة تلقائية بعد.'} افتح <b dir="ltr">script.google.com</b> ← مشروع «نسخ احتياطي الحلقات» ← شغّل <b dir="ltr">backupNow</b> وانظر سبب الخطأ، وتأكد من الجدولة بتشغيل <b dir="ltr">setupDaily</b>.</div>`}`;
    }
    return `<div class="card"><div class="bar"><h2 class="grow" style="margin:0">النسخ التلقائي إلى Google Drive</h2><button type="button" class="btn sm" data-bkre>تحديث</button></div>
      ${body}<p class="muted" style="font-size:.85rem;margin:.8rem 0 0">نسخة كل ليلة الساعة 3 فجرًا في مجلد «نسخ قرآن احتياطية» على Drive، وتُحفظ آخر 30 نسخة.</p></div>`;
  }
  adminViews.backup = () => {
    if (!CLOUD) return `<div class="card">${empty('النسخ الاحتياطية من الخادم تعمل عند الاتصال بقاعدة البيانات. في الوضع المحلي استخدم «تصدير نسخة احتياطية» في الإعدادات.')}</div>`;
    loadStatus();
    return statusCard() + `<div class="card"><h2>نسخة فورية</h2>
        <p class="muted" style="margin:0 0 .7rem">نسخة كاملة من الخادم الآن (دون صور الطلاب)، بنفس صيغة نسخ Drive فتصلح للاسترجاع. مفيدة قبل أي تعديل كبير.</p>
        <button type="button" class="btn primary" data-bknow>تنزيل نسخة كاملة الآن</button>
        <p class="muted" style="font-size:.82rem;margin:.9rem 0 .4rem">لحالة خاصة فقط: جهاز سُجّلت عليه بيانات دون إنترنت ولم تصل إلى الخادم بعد — «تصدير بيانات هذا الجهاز فقط» يحفظ ما عليه في ملف، و«دمج نسخة احتياطية» يضيف من ذلك الملف إلى قاعدة البيانات ما ليس فيها (دون حذف أو تعديل شيء).</p>
        <div class="bar" style="margin:0"><button type="button" class="btn sm" data-act="export">تصدير بيانات هذا الجهاز فقط</button><button type="button" class="btn sm" data-act="cloudMerge">دمج نسخة احتياطية</button></div></div>
      <div class="card"><h2>استرجاع نسخة احتياطية</h2>
        <p class="muted" style="margin:0 0 .7rem">اختر ملف نسخة (يبدأ اسمه بـ <code dir="ltr">qulearn-</code>) نزّلته من مجلد «نسخ قرآن احتياطية» على Google Drive أو من «تنزيل نسخة كاملة الآن». تظهر لك محتوياته قبل أي تغيير.</p>
        <div class="bar" style="margin:0"><label class="btn" style="margin:0">اختيار ملف النسخة<input type="file" accept=".json,application/json" data-rsfile hidden></label></div></div>`;
  };
  /* الإعدادات (وضع الخادم):
     - التصدير القديم (من الجهاز) و«دمج نسخة احتياطية» انتقلا إلى قسم «النسخ الاحتياطية»، ومكانهما زر يفتحه.
     - جدول حالة قاعدة البيانات بلا أدوات الجداول (طباعة/Excel/PDF/تكبير)، و«آخر مزامنة» و«تغييرات بانتظار الإرسال» تتحدّث مباشرة.
     - ملاحظة «رفع بيانات هذا الجهاز» لا تظهر إلا مع زرها. */
  const baseSettings = adminViews.settings;
  adminViews.settings = () => {
    let h = baseSettings();
    if (!CLOUD) return h;
    h = h.replace('<button class="btn" data-act="export">تصدير نسخة احتياطية</button>', '<button class="btn" data-act="tab" data-v="backup">النسخ الاحتياطية…</button>')
      .replace('النسخة الاحتياطية مفيدة للأرشفة.', 'النسخ الاحتياطية (التلقائية إلى Drive، والفورية، والاسترجاع) في قسم «النسخ الاحتياطية».')
      .replace('<button class="btn" data-act="cloudMerge">دمج نسخة احتياطية</button>', '')
      .replace(/<div class="tbl"><table>(\s*<tr><th style="width:38%">الحالة<\/th>)/, '<div class="tbl" data-pr="1" data-zm="1"><table>$1')
      .replace('<tr><th>آخر مزامنة</th><td dir="ltr" style="text-align:right">', '<tr><th>آخر مزامنة</th><td dir="ltr" style="text-align:right" data-lastsync>')
      .replace('<tr><th>تغييرات بانتظار الإرسال</th><td>', '<tr><th>تغييرات بانتظار الإرسال</th><td data-pendingn>');
    if (!h.includes('data-act="cloudUpload"')) h = h.replace(/<p class="muted" style="font-size:\.85rem;margin:0">«رفع بيانات هذا الجهاز»[^<]*<\/p>/, '');
    return h;
  };
  const liveDb = () => {
    const ls = document.querySelector('[data-lastsync]'), pn = document.querySelector('[data-pendingn]');
    if (ls && window.Cloud.lastSync) ls.textContent = window.Cloud.lastSync.toLocaleString('en-GB');
    if (pn) { try { pn.textContent = window.Cloud.pendingCount(db); } catch (e) { /* ignore */ } }
  };
  if (window.Cloud) window.Cloud.on(liveDb);
  new MutationObserver(() => { if (document.querySelector('[data-lastsync]')) liveDb(); }).observe(document.getElementById('app') || document.body, { childList: true });
  /* تحذير «مسح كل البيانات»: يدل على النسخة الكاملة من الخادم بدل التصدير القديم */
  document.addEventListener('click', e => {
    if (!CLOUD || !e.target.closest('[data-act="wipeAll"]')) return;
    setTimeout(() => {
      const n = [...document.querySelectorAll('.overlay .note')].pop();
      if (n) n.innerHTML = n.innerHTML.replace('خذ «تصدير نسخة احتياطية» أولًا.', 'خذ أولًا «تنزيل نسخة كاملة الآن» من قسم «النسخ الاحتياطية».');
    }, 0);
  }, true);
  async function downloadNow(btn) {
    try {
      const data = await window.Cloud.rpc('backup_export_admin');
      const d = new Date(), p2 = n => String(n).padStart(2, '0');
      const name = `qulearn-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      const n = Object.values(data.tables || {}).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
      toast(`حُفظت «${name}» — ${n} سجلًا`);
    } catch (e) {
      toast(/backup_export_admin|function/i.test(e.message || '') && /not find|does not exist|schema cache/i.test(e.message || '') ? 'نفّذ أمر الخادم supabase/backup_status.sql أولًا' : 'تعذّر تنزيل النسخة: ' + (e.message || e));
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-bknow]'); if (b && !b.classList.contains('loading')) { withBusy(b, downloadNow(b)); return; }
    if (e.target.closest('[data-bkre]')) { st.status = null; render(); loadStatus(true); }
  });

  async function open(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast('تعذّرت قراءة الملف'); return; }
    if (!data || data.app !== 'qulearn' || typeof data.tables !== 'object') { toast('هذا الملف ليس نسخة احتياطية لهذا التطبيق'); return; }
    const rows = Object.entries(data.tables).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `<tr><td>${esc(LBL[k] || k)}</td><td>${v.length}</td></tr>`).join('');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>استرجاع نسخة احتياطية</h2>
      <p style="margin:0 0 .6rem">تاريخ النسخة: <b>${esc(fmtDate(data.at))}</b></p>
      <div class="tbl" style="max-height:260px;overflow-y:auto"><table><tr><th>الجدول</th><th>السجلات في النسخة</th></tr>${rows}</table></div>
      <div class="lbl-s" style="margin-top:.8rem">طريقة الاسترجاع</div>
      <label class="chk"><input type="radio" name="rsmode" value="merge" checked><span><b>دمج</b> (الأكثر أمانًا): يُرجع المحذوف ويعيد المعدَّل إلى حاله في النسخة، ويُبقي ما أُضيف بعدها.</span></label>
      <label class="chk"><input type="radio" name="rsmode" value="replace"><span><b>استبدال كامل</b>: تعود البيانات كما كانت يوم النسخة تمامًا، <b style="color:var(--red)">ويُحذف كل ما أُضيف بعدها</b>.</span></label>
      <p class="muted" style="font-size:.85rem">صور الطلاب الحالية وحسابات الدخول وكلمات المرور لا تتأثر. خذ نسخة احتياطية من البيانات الحالية أولًا إن كنت قد تحتاجها.</p>
      <label>كلمة مرور المدير للتأكيد<input type="password" name="rspw" autocomplete="current-password"></label>
      <div class="row"><button type="button" class="btn danger" data-rsgo>استرجاع</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    const $ = q => ov.querySelector(q);
    $('[data-close]').onclick = () => ov.remove();
    $('[name=rspw]').focus();
    $('[data-rsgo]').onclick = () => withBusy($('[data-rsgo]'), (async () => {
      const mode = ov.querySelector('[name=rsmode]:checked').value, pw = $('[name=rspw]').value;
      if (!pw) { toast('اكتب كلمة مرور المدير'); return; }
      try { await window.Cloud.testSignIn(window.Cloud.auth.email, pw); } catch (e) { toast('كلمة المرور غير صحيحة'); return; }
      try {
        const r = await window.Cloud.rpc('backup_restore', { data, mode });
        const n = Object.values(r.restored || {}).reduce((a, b) => a + (+b || 0), 0), d = Object.values(r.deleted || {}).reduce((a, b) => a + (+b || 0), 0);
        ov.remove();
        toast(`تم الاسترجاع: ${n} سجلًا${d ? ` — وحُذف ${d} لم يكن في النسخة` : ''}`);
        await cloudRefresh(true); render();
      } catch (e) {
        toast(/backup_restore|function/i.test(e.message || '') && /not find|does not exist|schema cache/i.test(e.message || '') ? 'نفّذ أمر الخادم supabase/restore.sql أولًا' : 'تعذّر الاسترجاع (لم يتغير شيء): ' + (e.message || e));
      }
    })());
  }
  document.addEventListener('change', e => {
    if (!('rsfile' in (e.target.dataset || {}))) return;
    const f = e.target.files[0]; e.target.value = '';
    if (f) open(f);
  });
})();
