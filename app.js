'use strict';
/* ملفات التطبيق ثلاثة تُحمَّل بالترتيب ويتشارك بعضها تعريفات بعض:
   app.js (الأساس والواجهات) ← app-forms.js (الاستيراد والنماذج) ← app-actions.js (الإجراءات والمزامنة والتشغيل) */
/* وضع قاعدة البيانات: يعمل تلقائيًا عند وجود cloud.js مضبوطًا، وإلا يبقى التطبيق محليًا كما كان */
const CLOUD = !!(window.Cloud && window.Cloud.enabled);
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},del:k=>{try{sessionStorage.removeItem(k)}catch(e){}}};
