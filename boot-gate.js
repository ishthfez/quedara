/* ============ رسم واحد عند فتح الصفحة ============
   كان app-actions.js يرسم الواجهة أثناء قراءة الملفات، قبل أن يركّب nav.js شكل «الطلاب» الجديد (عند DOMContentLoaded)،
   فيظهر الشكل القديم لحظةً ثم يتبدّل. هنا يُؤجَّل كل رسم حتى تكتمل قراءة الملفات، فيُرسم مرة واحدة بشكله النهائي.
   يُحمَّل بعد nav.js وقبل app-actions.js. */
(function () {
  'use strict';
  if (typeof render !== 'function') return;
  var base = render;
  render = function () { if (document.readyState === 'loading') return; return base.apply(this, arguments); };
  /* بعد اكتمال القراءة: إن لم يرسم أحد (كصفحة الدخول) يُرسم الآن */
  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('app');
    if (app && !app.innerHTML.trim()) render();
  });
})();
