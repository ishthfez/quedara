'use strict';
/* ============ ضبط الخصومات من ملف الإيرادات ============ */
(() => {
  const HALF = ["امان الله سامح محمد","انس سامح محمد","صهيب محمد سلامة","عطاء سامح محمد","ممدوح مدحت عبد اللطيف","ياسين مدحت عبد اللطيف"];
  const QUARTER = ["احمد اشرف مهدي","احمد امين احمد امين","احمد عبد الرحمن دسوقي","احمد كريم ناصر","احمد محمد إسماعيل سلام","ادم اكرم البطريق","ادم عمرو عبد الكريم","ادم محمد مصطفي","ادم محمود الحصري","اكرم تامر","اياد محمد رضا سالم","حذيفه محمد عبد المقصود","حمزة ناجي كمال زقزوق","حمزه محمد عبد المقصود","حمزه مصطفي محمود العتيق","زياد محمد عبد المعبود","عبد الرحمن عمرو رجب نواره","عبد الرحمن محمد صلاح","عبد الله احمد صابر","عبد الملك احمد صابر","علي هيثم كامل هنون","عمر تامر محمود عبد السلام غزالي","عمر ياسر علي","كريم حسن","محمد عبد الحكيم الحماره","محمد مصطفي محمود العتيق","مصطفي سامح مصطفي","مصطفي محمود سليمان الجيار"];
  const ORPHANS = ["إبراهيم السيد إبراهيم إمام","احمد سامح محمد محمد","احمد طه جمعه","احمد عبد العاطي السيد عبد العاطي","احمد عبد الله زكريا","احمد علاء عبد الحميد السيد","احمد عماد","احمد محمد داود","احمد محمد مصطفي","احمد محمد منصور","ادم علاء عبد الحميد","بلال فرج دسوقي","تميم مختار رشدي","حسن عطية عبد الوهاب","حسن محمد السيد","حمزة محمد محمد بزان","حمزه السيد علي","رياض إبراهيم الزهار","زين عمر القداح","زين مسعد سيد هاشم","عبد الرحمن اسلام عبد الرحمن","عبد الرحمن مجدي عبد الفتاح","عبد الله عمر حسن محمد","علي احمد علي","علي محمد علي الخيال","عمار رضا حسن امام","عمار محمد عبد الرحمن","عمار محمود جمال","عمار ياسر فتحي","عمر احمد سالم","عمر بيومي صبحي","عمر عطية عبد الوهاب","عمر محمد عبد الرحمن حفني","عمر محمود فتحي","فريد عمر القداح","كريم عادل محمد التليني","مؤمن محمود العربي","محمد احمد أبو زغل","محمد ايمن الشوربجي","محمد بهاء محمد البهنساوي","محمد سعيد عبد المغني","محمد محروس","محمود ايمن محمد فتحي","محمود عاطف السيد عبد العاطي","محمود محمد السيد علي","مروان حامد محمود","مصطفي محمود نبيل","يحيي احمد محمود","يوسف إبراهيم نصر الله","يوسف اشرف محمد عاشور","يوسف رضوان جمعه رضوان","يوسف محمد السيد علي","يوسف محمد حربي"];

  const DISC_IDS = { half: 'd_tahfeez', quarter: 'd_assoc', orphan: 'd_orphan' };
  const DISC_VALUES = { 'd_tahfeez': 50, 'd_assoc': 25, 'd_orphan': 100 };
  const GROUPS = [
    { id: DISC_IDS.half, names: HALF, label: 'أبناء المحفظين (50%)' },
    { id: DISC_IDS.quarter, names: QUARTER, label: 'أبناء العاملين (25%)' },
    { id: DISC_IDS.orphan, names: ORPHANS, label: 'أيتام / معفون (100%)' }
  ];

  const n0 = t => String(t||'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[\u0623\u0625\u0622]/g,'\u0627').replace(/\u0629/g,'\u0647').replace(/\u0649/g,'\u064a').replace(/\s+/g,' ').trim().toLowerCase();
  const findStudent = name => db.students.find(s => n0(s.name) === n0(name));

  /* ---- تطبيق تلقائي عند أول تحميل ---- */
  function autoApply() {
    if (session?.role !== 'admin') return;
    const cfg = db.settings.priv_fees || {};
    /* تحقق: هل سبق التطبيق؟ */
    if (cfg._discApplied) return;

    let discs = Array.isArray(cfg.discs) ? cfg.discs : [];
    Object.entries(DISC_VALUES).forEach(([id, val]) => {
      const d = discs.find(x => x.id === id);
      if (d) d.value = val;
    });

    let count = 0;
    GROUPS.forEach(g => {
      g.names.forEach(name => {
        const s = findStudent(name);
        if (!s) return;
        if ((s.info || {}).feeDisc === g.id) return; /* معيّن بالفعل */
        s.info = { ...(s.info || {}), feeDisc: g.id };
        count++;
      });
    });

    db.settings.priv_fees = { ...cfg, discs, _discApplied: true };
    if (count > 0) {
      save(); render();
      toast(`تم ضبط الخصومات تلقائياً لـ ${count} طالب (6 أبناء محفظين + 28 أبناء عاملين + 53 يتيم/معفى)`);
    }
  }

  /* ننتظر حتى يكتمل تحميل البيانات */
  const tryAuto = () => { if (db?.students?.length) autoApply(); else setTimeout(tryAuto, 500); };
  setTimeout(tryAuto, 1000);

  /* ---- نافذة يدوية للتعديل لاحقاً ---- */
  function run() {
    if (session?.role !== 'admin') { toast('للمدير فقط'); return; }
    const groups = GROUPS;
    let html = '<p class="note">يمكنك تعديل الخصومات — أزل ✔ لاستثناء طالب ثم اضغط «تطبيق». أو اضغط «إزالة كل الخصومات» للتراجع.</p>';
    let totalMatched = 0;
    groups.forEach(g => {
      const matched = [], missing = [];
      g.names.forEach(name => { const s = findStudent(name); if (s) matched.push(s); else missing.push(name); });
      totalMatched += matched.length;
      html += `<h3 style="margin:1rem 0 .3rem">${g.label} — ${matched.length} طالب</h3>`;
      if (matched.length) {
        html += '<div class="tbl"><table>';
        matched.forEach(s => {
          const cur = (s.info || {}).feeDisc;
          html += `<tr><td><label style="margin:0;display:flex;align-items:center;gap:.4rem"><input type="checkbox" data-dset="${esc(s.id)}" data-did="${g.id}" ${cur === g.id ? 'checked disabled' : 'checked'}> ${esc(s.name)}</label></td><td class="muted">${esc(hName(s.halaqaId))}</td>${cur === g.id ? '<td><span class="tag tag-ok">معيّن</span></td>' : '<td></td>'}</tr>`;
        });
        html += '</table></div>';
      }
      if (missing.length) html += `<p class="muted" style="font-size:.85rem">لم يُطابَق: ${missing.map(n => esc(n)).join('، ')}</p>`;
    });
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal wide"><h2>تعديل الخصومات (${totalMatched} طالب)</h2>${html}
      <div class="row" style="margin-top:1rem"><button type="button" class="btn primary" data-dapply>تطبيق</button><button type="button" class="btn danger" data-dclear>إزالة كل الخصومات</button><button type="button" class="btn" data-close>إلغاء</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-dapply]').onclick = () => {
      const cfg = db.settings.priv_fees || {};
      let discs = Array.isArray(cfg.discs) ? cfg.discs : [];
      Object.entries(DISC_VALUES).forEach(([id, val]) => { const d = discs.find(x => x.id === id); if (d) d.value = val; });
      db.settings.priv_fees = { ...cfg, discs };
      let count = 0;
      ov.querySelectorAll('[data-dset]:checked:not(:disabled)').forEach(cb => {
        const s = byId(db.students, cb.dataset.dset); if (!s) return;
        s.info = { ...(s.info || {}), feeDisc: cb.dataset.did }; count++;
      });
      ov.remove(); save(); render();
      toast(`تم: عُيّن الخصم لـ ${count} طالب`);
    };
    ov.querySelector('[data-dclear]').onclick = () => {
      ask('إزالة كل الخصومات المعيّنة من كل الطلاب؟', () => {
        let n = 0;
        db.students.forEach(s => { if ((s.info || {}).feeDisc) { s.info.feeDisc = ''; s.info.feeDiscVal = ''; n++; } });
        const cfg = db.settings.priv_fees || {};
        db.settings.priv_fees = { ...cfg, _discApplied: false };
        ov.remove(); save(); render();
        toast(`تم: أُزيلت الخصومات من ${n} طالب`);
      });
    };
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-disc-setup]')) run(); });
  const obs = new MutationObserver(() => {
    const q = document.querySelector('.qimp');
    if (q && !q.querySelector('[data-disc-setup]')) {
      q.insertAdjacentHTML('beforeend', '<button type="button" class="btn" data-disc-setup>تعديل الخصومات</button>');
    }
  });
  obs.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
})();
