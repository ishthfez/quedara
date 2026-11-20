/* Service Worker v7 — ملفات التطبيق من النسخة المحفوظة على الجهاز أولًا
   كانت الشبكة أولًا لكل ملف في كل فتح (نحو 75 طلبًا للخادم كل مرة يُفتح فيها التطبيق ولو لم يتغير شيء)،
   وهذا ما يستهلك «CDN Requests» في باقة Vercel. الآن: الملف المحفوظ يُقدَّم بلا أي طلب، ويُجلب من الشبكة إن لم يكن محفوظًا.
   الإصدار الجديد: الصفحة تفحص بصمة الملفات على الخادم مرة كل ساعة على الأكثر (app-actions.js)، فإن تغيّرت تمسح هذه النسخة
   وتعيد التحميل فتُجلب الملفات الجديدة مرة واحدة. والتحديث اليدوي (Ctrl+Shift+R) يتجاوز عامل الخدمة كما كان. */
const CACHE = 'halaqat-v7';
const CORE = ['./', './style.css', './app.js', './app-forms.js', './app-actions.js', './payroll.js', './fees.js', './app-abs.js', './app-import.js', './fee-setup.js', './disc-setup.js', './perms.js', './accountant.js', './collect.js', './tables.js', './backup.js', './session.js', './dups.js', './selects.js', './links.js', './distribute.js', './split.js', './cleanup.js', './unassigned.js', './cascade.js', './places.js', './notes.js', './roles.js', './mine.js', './staff.js', './nav.js', './people.js', './notify.js', './receipt.js', './importx.js', './feesimport.js', './actas.js', './feeedit.js', './demo.js', './fixpay.js', './dupsall.js', './pager.js', './toolbar.js', './uniqname.js', './cloud.js', './logo.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  /* كل ملف وحده: ملف واحد ناقص لا يُفشل التثبيت كله (كان addAll يفشل كله) */
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* ما يُحفظ: صفحة التطبيق وملفاته الثابتة فقط. طلبات البيانات وversion.txt وsw.js تذهب للشبكة دائمًا */
const ASSET = /\.(js|css|png|jpe?g|webp|svg|ico|gif|webmanifest|html|woff2?)$/i;
const NEVER = /\/(sw\.js|version\.txt)$/i;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname)) return;
  const nav = req.mode === 'navigate';
  if (!nav && !ASSET.test(url.pathname)) return;
  const key = nav ? './' : req;
  e.respondWith(caches.open(CACHE).then(c => c.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') c.put(key, res.clone());
    return res;
  }).catch(() => (nav ? c.match('./') : Response.error())))));
});

/* الصفحة تطلب مسح النسخة المحفوظة قبل إعادة التحميل عند صدور إصدار جديد */
self.addEventListener('message', e => {
  if (e.data === 'clear-cache') e.waitUntil(caches.delete(CACHE));
});
