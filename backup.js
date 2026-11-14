'use strict';
/* ============ استرجاع نسخة احتياطية (للمدير) ============
   في «الإعدادات»: اختيار ملف نسخة (qulearn-….json من مجلد «نسخ قرآن احتياطية» على Drive) ← معاينة ← طريقة الاسترجاع
   ← تأكيد بكلمة مرور المدير ← الاسترجاع على الخادم دفعة واحدة (backup_restore في supabase/restore.sql). */
(() => {
  const LBL = { settings: 'الإعدادات', places: 'الأماكن', members: 'الأعضاء', member_admin: 'بيانات المعلمين الإدارية', halaqat: 'الحلقات', attendance: 'الحضور',
    records: 'التسميع', news: 'الإعلانات', custom_fields: 'الحقول المضافة', pending_columns: 'البيانات المعلّقة', pay_settings: 'إعدادات المرتبات',
    pay_employees: 'موظفو المرتبات', pay_rows: 'صفوف كشوف المرتبات', pay_closed: 'الشهور المغلقة', absences: 'غياب المعلمين', fees: 'الاشتراكات',
    collections: 'قوائم تحصيل المعلمين', exams: 'الاختبارات' };
  setTimeout(() => { try { if (!VFILES.includes('./backup.js')) VFILES.push('./backup.js'); } catch (e) { /* ignore */ } }, 0);
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }); };

  const baseSettings = adminViews.settings;
  adminViews.settings = () => baseSettings() + (!CLOUD ? '' : `<div class="card"><h2>استرجاع نسخة احتياطية</h2>
    <p class="muted" style="margin:0 0 .7rem">اختر ملف نسخة (يبدأ اسمه بـ <code dir="ltr">qulearn-</code>) نزّلته من مجلد «نسخ قرآن احتياطية» على Google Drive. تظهر لك محتوياته قبل أي تغيير.</p>
    <div class="bar" style="margin:0"><label class="btn" style="margin:0">اختيار ملف النسخة<input type="file" accept=".json,application/json" data-rsfile hidden></label></div></div>`);

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
