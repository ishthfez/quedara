/* Service Worker v5 */
const CACHE = 'halaqat-v5';
const CORE = ['./', './style.css', './app.js', './app-forms.js', './app-actions.js', './payroll.js', './fees.js', './app-abs.js', './app-import.js', './fee-setup.js', './disc-setup.js', './perms.js', './accountant.js', './collect.js', './tables.js', './backup.js', './session.js', './dups.js', './selects.js', './links.js', './distribute.js', './split.js', './cleanup.js', './unassigned.js', './cascade.js', './places.js', './notes.js', './roles.js', './mine.js', './staff.js', './preview.js', './nav.js', './people.js', './notify.js', './receipt.js', './importx.js', './feesimport.js', './actas.js', './feeedit.js', './demo.js', './fixpay.js', './dupsall.js', './pager.js', './toolbar.js', './uniqname.js', './cloud.js', './logo.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); no(err); }); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    timeout(fetch(req), 4000)
      .then(res => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './' : req, copy)); }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./')))
  );
});
