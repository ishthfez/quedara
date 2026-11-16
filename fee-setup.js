'use strict';
/* ============ أداة ضبط اشتراكات الأماكن (مرة واحدة) ============
   يقرأ الأماكن الموجودة في النظام ويطابقها بخريطة الاشتراكات من ملف الإيرادات.
   يعرض معاينة ولا يحفظ إلا بتأكيد المدير.
   يُحذف بعد الاستخدام من index.html. */
(() => {
  /* خريطة الاشتراكات من ملف الإيرادات: اسم المكان+المستوى → المبلغ ونظام الحضور */
  const FEE_MAP = [
    {n: 'اكرم الاكرمين', sys: '6', fee: 70},
    {n: 'الأنصار', sys: '6', fee: 80},
    {n: 'الإمام مستوى ثاني', sys: '3', fee: 80},
    {n: 'البساتين مستوى اول', sys: '3', fee: 75},
    {n: 'البساتين مستوى ثاني', sys: '3', fee: 100},
    {n: 'التوحيد مستوى اول', sys: '3', fee: 80},
    {n: 'التوحيد مستوى ثالث', sys: '6', fee: 130},
    {n: 'التوحيد مستوى ثاني', sys: '3', fee: 90},
    {n: 'التوحيد مستوى رابع', sys: '6', fee: 140},
    {n: 'الحسني', sys: '6', fee: 70},
    {n: 'الحسني المستوي الثاني', sys: '3', fee: 125},
    {n: 'الخشينه', sys: '6', fee: 80},
    {n: 'الشباب مستوى اول', sys: '3', fee: 70},
    {n: 'الصفا والمروة مستوى اول', sys: '3', fee: 80},
    {n: 'الصفتي', sys: '6', fee: 120},
    {n: 'الصفتي1', sys: '6', fee: 75},
    {n: 'الطاهرات', sys: '6', fee: 75},
    {n: 'العسلي مستوى اول', sys: '3', fee: 70},
    {n: 'العسلي مستوى ثاني', sys: '3', fee: 120},
    {n: 'بلال مستوى اول', sys: '3', fee: 80},
    {n: 'بني عليم مستوى ثاني', sys: '3', fee: 70},
    {n: 'دار بن عباس', sys: '6', fee: 80},
    {n: 'عباد الرحمن مستوى اول', sys: '3', fee: 80},
    {n: 'عباد الرحمن مستوى ثاني', sys: '3', fee: 150},
    {n: 'عبد العزيز امين مستوى اول', sys: '3', fee: 70},
    {n: 'مسجد البارئ مستوى اول', sys: '3', fee: 75},
    {n: 'مسجد الكردي', sys: '6', fee: 65},
    {n: 'مسجد رب العالمين مستوى اول', sys: '3', fee: 70},
    {n: 'مسجد رب العالمين مستوى ثاني', sys: '3', fee: 130},
    {n: 'مكة المكرمه مستوى اول', sys: '3', fee: 70}
  ];

  /* تطبيع للمطابقة: بدون تشكيل وهمزات موحدة */
  const n0 = t => String(t||'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();

  function run() {
    if (session?.role !== 'admin') { toast('للمدير فقط'); return; }
    const places = db.places || [];
    if (!places.length) { toast('لا توجد أماكن في النظام'); return; }

    /* مطابقة كل مكان في النظام بخريطة الإيرادات */
    const results = places.map(p => {
      const pn = n0(p.name);
      /* مطابقة دقيقة أولاً، ثم جزئية */
      let match = FEE_MAP.find(f => n0(f.n) === pn);
      if (!match) match = FEE_MAP.find(f => pn.includes(n0(f.n)) || n0(f.n).includes(pn));
      const halCount = db.halaqat.filter(h => h.placeId === p.id).length;
      const stuCount = db.students.filter(s => { const h = db.halaqat.find(x => x.id === s.halaqaId); return h && h.placeId === p.id; }).length;
      return { place: p, match, halCount, stuCount };
    }).sort((a, b) => a.place.name.localeCompare(b.place.name, 'ar'));

    const matched = results.filter(r => r.match);
    const unmatched = results.filter(r => !r.match);

    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>\u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0627\u0644\u0623\u0645\u0627\u0643\u0646</h2>
      <p class="note">\u0647\u0630\u0647 \u0645\u0639\u0627\u064a\u0646\u0629 \u2014 \u0644\u0646 \u064a\u064f\u062d\u0641\u0638 \u0634\u064a\u0621 \u0625\u0644\u0627 \u0628\u0639\u062f \u0636\u063a\u0637 \u00ab\u062a\u0637\u0628\u064a\u0642\u00bb. \u0633\u064a\u064f\u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643 \u0643\u0644 \u0645\u0643\u0627\u0646 \u062d\u0633\u0628 \u0646\u0638\u0627\u0645\u0647 (3 \u0623\u064a\u0627\u0645 \u0623\u0648 6 \u0623\u064a\u0627\u0645).</p>
      <h3 style="color:var(--leaf);margin:.8rem 0 .3rem">\u2705 \u062a\u0637\u0627\u0628\u0642 (${matched.length} \u0645\u0643\u0627\u0646)</h3>
      <div class="tbl"><table><tr><th>\u0627\u0644\u0645\u0643\u0627\u0646 \u0641\u064a \u0627\u0644\u0646\u0638\u0627\u0645</th><th>\u0637\u0648\u0628\u0642 \u0645\u0639</th><th>\u0627\u0644\u0646\u0638\u0627\u0645</th><th>\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643</th><th>\u0627\u0644\u062d\u0644\u0642\u0627\u062a</th><th>\u0627\u0644\u0637\u0644\u0627\u0628</th></tr>
      ${matched.map(r => `<tr><td>${esc(r.place.name)}</td><td>${esc(r.match.n)}</td><td>${r.match.sys === '3' ? '3 \u0623\u064a\u0627\u0645' : '6 \u0623\u064a\u0627\u0645'}</td><td><b>${r.match.fee}</b> \u062c\u0646\u064a\u0647</td><td>${r.halCount}</td><td>${r.stuCount}</td></tr>`).join('')}</table></div>
      ${unmatched.length ? `<h3 style="color:var(--red);margin:.8rem 0 .3rem">\u274c \u0644\u0645 \u064a\u064f\u0637\u0627\u0628\u064e\u0642 (${unmatched.length} \u0645\u0643\u0627\u0646) \u2014 \u0644\u0646 \u064a\u062a\u063a\u064a\u0631</h3>
      <div class="tbl"><table><tr><th>\u0627\u0644\u0645\u0643\u0627\u0646</th><th>\u0627\u0644\u062d\u0644\u0642\u0627\u062a</th><th>\u0627\u0644\u0637\u0644\u0627\u0628</th></tr>
      ${unmatched.map(r => `<tr><td>${esc(r.place.name)}</td><td>${r.halCount}</td><td>${r.stuCount}</td></tr>`).join('')}</table></div>` : ''}
      <div class="row" style="margin-top:1rem"><button type="button" class="btn primary" data-fsapply>\u062a\u0637\u0628\u064a\u0642 (${matched.length} \u0645\u0643\u0627\u0646)</button><button type="button" class="btn" data-close>\u0625\u0644\u063a\u0627\u0621</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-fsapply]').onclick = () => {
      const cfg = db.settings.priv_fees || {};
      const years = cfg.years && typeof cfg.years === 'object' ? cfg.years : {};
      const pFees = cfg.places && typeof cfg.places === 'object' ? { ...cfg.places } : {};

      matched.forEach(r => {
        const pid = r.place.id;
        const cur = pFees[pid] || {};
        if (r.match.sys === '3') {
          pFees[pid] = { general: cur.general ?? null, general3: r.match.fee };
        } else {
          pFees[pid] = { general: r.match.fee, general3: cur.general3 ?? null };
        }
      });

      db.settings.priv_fees = { ...cfg, places: pFees };
      /* ضبط نظام الحضور لكل طالب حسب مكانه */
      let sysCount = 0;
      matched.forEach(r => {
        db.students.forEach(s => {
          const h = db.halaqat.find(x => x.id === s.halaqaId);
          if (!h || h.placeId !== r.place.id) return;
          const curSys = (s.info || {}).feeSys;
          if (r.match.sys === '3' && curSys !== '3') {
            s.info = { ...(s.info || {}), feeSys: '3' }; sysCount++;
          } else if (r.match.sys === '6' && curSys === '3') {
            s.info = { ...(s.info || {}), feeSys: '6' }; sysCount++;
          }
        });
      });

      ov.remove(); save(); render();
      toast(`\u062a\u0645: \u0636\u064f\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643 ${matched.length} \u0645\u0643\u0627\u0646${sysCount ? ` \u0648\u0646\u0638\u0627\u0645 ${sysCount} \u0637\u0627\u0644\u0628` : ''}`);
    };
  }

  /* \u0632\u0631 \u0641\u064a \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a */
  document.addEventListener('click', e => { if (e.target.closest('[data-fee-setup]')) run(); });
  /* \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0632\u0631 \u0644\u0642\u0633\u0645 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f */
  const obs = new MutationObserver(() => {
    const q = document.querySelector('.qimp');
    if (q && !q.querySelector('[data-fee-setup]')) {
      q.insertAdjacentHTML('beforeend', '<button type="button" class="btn primary" data-fee-setup>\u0636\u0628\u0637 \u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u0645\u0646 \u0645\u0644\u0641 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</button>');
    }
  });
  obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
})();
