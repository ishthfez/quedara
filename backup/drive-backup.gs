/* =====================================================================
   نسخ احتياطي يومي لبيانات التطبيق إلى Google Drive (يعمل داخل حسابك على script.google.com)
   - يطلب نسخة كاملة من الخادم بالمفتاح السري، ويحفظها ملف JSON في مجلد «نسخ قرآن احتياطية».
   - يُبقي آخر 30 نسخة ويحذف الأقدم، ويرسل لك بريدًا إن فشلت أي نسخة.
   الإعداد مرة واحدة:
     1) الصق هذا الملف كاملًا في المحرر واحفظه.
     2) إعدادات المشروع (⚙) ← Script properties ← أضف: BACKUP_TOKEN = المفتاح السري.
     3) اختر الدالة setupDaily ثم «تشغيل» (Run) ووافق على الأذونات — تُجدول نسخة كل ليلة الساعة 3.
     4) للتجربة الفورية: اختر backupNow ثم «تشغيل».
   ===================================================================== */
const SUPABASE_URL = 'https://vjmlrajxcfxiooprzfjw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IM-942KoPf_iH_FvPBnBag_hxJQCKrJ'; // المفتاح العام نفسه الموجود في التطبيق
const FOLDER_NAME = 'نسخ قرآن احتياطية';
const KEEP = 30;           // عدد النسخ المحفوظة
const HOUR = 3;            // ساعة النسخ اليومي (بتوقيت القاهرة)
const TZ = 'Africa/Cairo';

function backupNow() {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
    if (!token) throw new Error('لم يُضبط المفتاح السري: إعدادات المشروع ← Script properties ← BACKUP_TOKEN');
    const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/backup_export', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: SUPABASE_KEY },
      payload: JSON.stringify({ tok: token }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode(), body = res.getContentText();
    if (code !== 200) throw new Error('رفض الخادم الطلب (' + code + '): ' + body.slice(0, 300));
    const data = JSON.parse(body);
    if (!data || data.app !== 'qulearn' || !data.tables) throw new Error('الرد ليس نسخة احتياطية صحيحة');
    const counts = Object.keys(data.tables).map(function (k) { return k + ': ' + data.tables[k].length; }).join('، ');
    const folder = getFolder_();
    const name = 'qulearn-' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HH-mm') + '.json';
    folder.createFile(Utilities.newBlob(body, 'application/json', name)).setDescription(counts);
    cleanup_(folder);
    console.log('تم حفظ ' + name + ' — ' + counts);
  } catch (e) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'فشل النسخ الاحتياطي لتطبيق الحلقات',
      'لم تُحفظ نسخة اليوم.\n\nالسبب: ' + e.message + '\n\nافتح script.google.com وشغّل backupNow للتجربة.');
    throw e;
  }
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function cleanup_(folder) {
  const files = [], it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^qulearn-.*\.json$/.test(f.getName())) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(KEEP).forEach(function (f) { f.setTrashed(true); });
}

/* تُشغَّل مرة واحدة: تجدول backupNow كل يوم (وتحذف أي جدولة سابقة حتى لا تتكرر) */
function setupDaily() {
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'backupNow'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(HOUR).inTimezone(TZ).create();
  console.log('تمت الجدولة: نسخة كل يوم الساعة ' + HOUR);
}
