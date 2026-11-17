'use strict';
/* ============ «الإعدادات ← الاشتراكات» ============
   قسم فرعي في «الإعدادات» (للمدير) فيه:
     - «إعدادات الاشتراك»: يفتح الإعدادات نفسها (data-fee-cfg في fees.js).
     - «تعيين لمجموعة طلاب»: يختار المكان أو الحلقة والحالة، ثم يفتح نافذة التعيين نفسها (data-fee-bulk في fees.js)
       على هؤلاء الطلاب (بدل «تعيين لنتائج البحث» في الطلاب).
   والزرّان في «الطلاب» و«الاشتراكات» يُخفيان عن المدير (يبقيان للمحاسب الذي ليس له «الإعدادات»).
   شريط تبويبات «الإعدادات» يصنعه nav.js؛ هنا يُضاف إليه تبويب «الاشتراكات» ويُعرض محتواه حين يُختار. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./feeset.js')) VFILES.push('./feeset.js'); } catch (e) { /* ignore */ } });
  const KEY = 'qfeeset';
  let on = false; try { on = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }
  const setOn = v => { on = v; try { sessionStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const st = { p: '', h: '', s: 'on' };
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';

  const css = document.createElement('style');
  css.textContent = `html.qfs-adm main [data-fee-cfg]:not(.qkeep),html.qfs-adm main [data-fee-bulk]:not(.qkeep){display:none!important}
    .qfs .bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.3rem 0 .6rem}
    .qfs .bar select{width:auto;max-width:18rem;margin:0}`;
  document.head.appendChild(css);
  new MutationObserver(() => document.documentElement.classList.toggle('qfs-adm', isAdm())).observe(document.getElementById('app') || document.body, { childList: true });

  const placeOf = s => byId(db.halaqat, s.halaqaId)?.placeId || '';
  const pick = () => db.students.filter(s => (st.h ? s.halaqaId === st.h : !st.p || placeOf(s) === st.p)
    && (st.s === 'on' ? !stOff(s) : st.s === 'off' ? stOff(s) : true));
  function view() {
    const places = db.places.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const hs = db.halaqat.filter(h => !st.p || h.placeId === st.p).sort((a, b) => halaqaLabel(a).localeCompare(halaqaLabel(b), 'ar'));
    if (st.h && !hs.some(h => h.id === st.h)) st.h = '';
    const n = pick().length;
    return `<div class="card qfs"><h2>إعدادات الاشتراك</h2>
        <p class="muted" style="margin:0 0 .7rem;font-size:.9rem">مبالغ الاشتراك العام لكل سنة بنظامي الحضور، والمبالغ التي تختلف حسب المكان، والخصومات والإعفاءات، والفئات.</p>
        <div class="row"><button type="button" class="btn primary qkeep" data-fee-cfg>فتح إعدادات الاشتراك</button></div></div>
      <div class="card qfs"><h2>تعيين لمجموعة طلاب</h2>
        <p class="muted" style="margin:0 0 .3rem;font-size:.9rem">اختر المكان أو الحلقة، ثم عيّن لطلابها الفئة أو نظام الحضور أو الخصم دفعة واحدة.</p>
        <div class="bar">
          <select data-qfsp aria-label="المكان"><option value="">كل الأماكن</option>${places.map(p => `<option value="${esc(p.id)}" ${p.id === st.p ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          <select data-qfsh aria-label="الحلقة"><option value="">كل الحلقات</option>${hs.map(h => `<option value="${esc(h.id)}" ${h.id === st.h ? 'selected' : ''}>${esc(halaqaLabel(h))}</option>`).join('')}</select>
          <select data-qfss aria-label="الحالة">${[['on', 'المنتظمون'], ['', 'كل الحالات'], ['off', 'المنقطعون']].map(([v, l]) => `<option value="${v}" ${st.s === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="row"><button type="button" class="btn qkeep" data-fee-bulk data-qfsbulk ${n ? '' : 'disabled'}>تعيين لـ${n} طالب</button></div></div>`;
  }

  /* تبويب «الاشتراكات» في شريط «الإعدادات» (بعد «الإعدادات» مباشرة) */
  const base = adminViews.settings;
  adminViews.settings = function () {
    const html = base.apply(this, arguments);
    if (!isAdm()) return html;
    const i = html.indexOf('<div class="card subnav">'); if (i < 0) return html;
    const end = html.indexOf('</div></div>', i); if (end < 0) return html;
    let bar = html.slice(i, end);
    if (on) bar = bar.replace(/class="btn on"/g, 'class="btn"');
    const btn = `<button type="button" class="btn ${on ? 'on' : ''}" data-qfeeset>الاشتراكات</button>`;
    const fb = bar.indexOf('</button>');
    bar = fb > -1 ? bar.slice(0, fb + 9) + btn + bar.slice(fb + 9) : bar + btn;
    return html.slice(0, i) + bar + '</div></div>' + (on ? view() : html.slice(end + 12));
  };

  document.addEventListener('click', e => {
    if (e.target.closest('[data-qfeeset]')) { setOn(true); render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-subtab][data-g="settings"]')) setOn(false);
    /* نافذة التعيين (fees.js) تأخذ طلابها من هذه القائمة */
    if (e.target.closest('[data-qfsbulk]')) window._QLFeesVisibleList = pick();
  }, true);
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest?.('.qfs')) return;
    if (t.matches('[data-qfsp]')) { st.p = t.value; st.h = ''; }
    else if (t.matches('[data-qfsh]')) st.h = t.value;
    else if (t.matches('[data-qfss]')) st.s = t.value;
    else return;
    render();
  });
})();
