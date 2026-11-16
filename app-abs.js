/* app-abs.js — safe wrapper */
(function() {
'use strict';
try {
  var MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  var css = document.createElement('style');
  css.textContent = 'tr.tr-off td{color:var(--red,#b3372f)!important;opacity:.75} tr.tr-off .tag,tr.tr-off .btn{opacity:.85} body,table,input,select,textarea,.card,.stat,.feerow,.feebar-label,.tbl,.tag,.btn,.modal{font-feature-settings:"tnum";-webkit-locale:"en"} .feerow b,.feebar-label span,.tag,.stat b,.stat .num{unicode-bidi:plaintext;direction:ltr}';
  document.head.appendChild(css);

  /* اسم الحلقة: نزيل كبسولة «حلقة» وكبسولة المكان فقط، نبقي اسم المحفظ */
  function cleanHName(hid) {
    try {
      var raw = hName(hid);
      var tmp = document.createElement('div');
      tmp.innerHTML = raw;
      /* نحذف عناصر .tag (كبسولة «حلقة») و small (اسم المكان) */
      var tags = tmp.querySelectorAll('.tag, small');
      for (var i = 0; i < tags.length; i++) tags[i].remove();
      var text = (tmp.textContent || '').trim();
      return text ? esc(text) : '\u2014';
    } catch(e) { return esc(hName(hid)); }
  }
