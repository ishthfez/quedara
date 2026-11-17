/* loader متزامن — يحمّل app.js الأصلي قبل أي ملف آخر */
var _x=new XMLHttpRequest();
_x.open('GET','https://raw.githubusercontent.com/ishthfez/quedara/60839154ad897237e3ef1133aba061cafba677ee/app.js',false);
try{_x.send();if(_x.status===200)eval(_x.responseText);else throw new Error(_x.status);}catch(e){document.getElementById('app').innerHTML='<div style="text-align:center;padding:3rem;direction:rtl"><h2>خطأ في تحميل التطبيق</h2><p>'+e.message+'</p><button onclick="location.reload()">إعادة المحاولة</button></div>';}
