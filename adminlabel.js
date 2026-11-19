'use strict';
/* ============ «Admin»: اسم حسابات إدارة التطبيق ============
   حتى لا تلتبس بـ«المدير العام»، تُسمّى فئة حسابات إدارة التطبيق «Admin» حيث يظهر اسم الفئة نفسه:
   أسفل الاسم في القائمة الجانبية («Admin: فلان»)، وتبويب «الإعدادات ← حسابات Admin» وعنوانه، وفئة «Admin» في قوائم الأعضاء،
   وتصنيف موظفي المرتبات، وجمهور الملاحظات. (والملفات الصغيرة الأخرى غُيّرت في مكانها: roles.js و staff.js و session.js
   و notes.js و uix.js و demo.js و actas.js.)
   هذا الملف للأسماء المعرّفة في الملفات الكبيرة (app.js و app-actions.js و nav.js و tables.js) دون تعديلها.
   الجمل والرسائل التي تذكر «المدير» تبقى كما هي، ولا يُمسّ «المدير العام». */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./adminlabel.js')) VFILES.push('./adminlabel.js'); } catch (e) { /* ignore */ } });
  const L = 'Admin';
  try { ROLE_L.admin = L; KIND_ONE.admins = L; AUD.admin = L; } catch (e) { /* ignore */ }
  /* بعد roles.js الذي يعيد ضبط تصنيفات المرتبات عند DOMContentLoaded */
  document.addEventListener('DOMContentLoaded', () => {
    try { KIND_TITLE.admins = L; } catch (e) { /* ignore */ }
    try { CLS_ROLES.admin = L; } catch (e) { /* ignore */ }
    if (typeof session !== 'undefined' && session) try { render(); } catch (e) { /* ignore */ }
  });
  /* نصوص تبنيها ملفات كبيرة: التبويب وعنوانه، وخيار الفئة في قوائم الأعضاء */
  const fix = () => {
    document.querySelectorAll('[data-subtab="members"]').forEach(b => { if (b.textContent.includes('حسابات المديرين')) b.textContent = b.textContent.replace('حسابات المديرين', 'حسابات ' + L); });
    document.querySelectorAll('main h2').forEach(h => { if (h.textContent.trim() === 'حسابات المديرين') h.textContent = 'حسابات ' + L; });
    document.querySelectorAll('select option[value="admins"]').forEach(o => { if (/^المديرون/.test(o.textContent)) o.textContent = o.textContent.replace(/^المديرون/, L); });
  };
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; try { fix(); } catch (e) { /* ignore */ } }); }).observe(document.body, { childList: true, subtree: true });
})();
