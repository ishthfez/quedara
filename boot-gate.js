/* ============ رسم واحد عند فتح الصفحة ============
   كان app-actions.js يرسم الواجهة أثناء قراءة الملفات، قبل أن يركّب nav.js شكل «الطلاب» الجديد (عند DOMContentLoaded)،
   فيظهر الشكل القديم لحظةً ثم يتبدّل. هنا يُؤجَّل كل رسم حتى تكتمل قراءة الملفات وتنتهي كل معالجات DOMContentLoaded
   (فيها تركّب ملفات أخرى إضافاتها، مثل تبويبات الحالة وزر «الحضور» في active.js وattwin.js)، فيُرسم مرة واحدة بشكله النهائي.
   ما طُلب من رسم أثناء الانتظار يُنفَّذ مرة واحدة بعده.
   يُحمَّل بعد nav.js وقبل app-actions.js. */
(function () {
  'use strict';
  if (typeof render !== 'function') return;
  var base = render, ready = false, pending = false;
  render = function () { if (!ready) { pending = true; return; } return base.apply(this, arguments); };
  document.addEventListener('DOMContentLoaded', function () {
    /* بعد آخر معالج DOMContentLoaded (المؤقّت يعمل بعدها كلها) */
    setTimeout(function () {
      ready = true;
      var app = document.getElementById('app');
      if (pending || (app && !app.innerHTML.trim())) render();
    }, 0);
  });
})();
