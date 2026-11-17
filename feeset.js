'use strict';
/* ============ «الإعدادات ← الاشتراكات» ============
   قسم فرعي في «الإعدادات» (للمدير) فيه:
     - «إعدادات الاشتراك»: يفتح الإعدادات نفسها (data-fee-cfg في fees.js).
     - «تعيين لمجموعة طلاب»: يختار المكان أو الحلقة والحالة، ثم يفتح نافذة التعيين نفسها (data-fee-bulk في fees.js)
       على هؤلاء الطلاب (بدل «تعيين لنتائج البحث» في الطلاب).
   والزرّان في «الطلاب» و«الاشتراكات» يُخفيان عن المدير (يبقيان للمحاسب الذي ليس له «الإعدادات»).
   شريط تبويبات «الإعدادات» يصنعه nav.js؛ هنا تُضاف إليه تبويبات إضافية (window.QLSetTabs: «الاشتراكات» هنا، وغيرها من ملفات أخرى
   مثل «صلاحيات صفحة الطلاب» في stuperm.js)، ويُعرض محتوى المختار منها.
   بطاقتا «استيراد» و«حالة الموقع» (app-import.js) كانتا فوق شريط التبويبات في كل تبويب: صار «الاستيراد» تبويبًا بعد «الاشتراكات»،
   و«حالة الموقع» داخل تبويب «الإعدادات» أول محتواه. وبطاقة «الاستيراد والمراجعة» القديمة في «الإعدادات» (nav.js) تُحذف:
   أزرارها كلها في تبويب «الاستيراد».
   «تعديل الخصومات» (disc-setup.js) و«مطابقة الاشتراكات مع كشف الإيراد» (fee-match.js) ليسا استيرادًا: يُخفيان من بطاقة الاستيراد
   ويظهران في تبويب «الاشتراكات» في بطاقة «أدوات الاشتراكات» (معالجاهما الأصليان يعملان من أي مكان).
   ملف الطالب (قسم «الاشتراك» الذي يضيفه app-abs.js): المستحق بعد الخصم وبجانبه قبله مشطوبًا، وصف «الخصم» بقائمة تعيّنه مباشرة
   (معالج data-fdisc في fees.js)، وزر «سجل الدفعات» (من حصّلها وملاحظتها والحذف، log في fees.js) بجانب «سجل الاشتراكات». */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./feeset.js')) VFILES.push('./feeset.js'); } catch (e) { /* ignore */ } });
  const KEY = 'qsettab';
  let cur = ''; try { cur = sessionStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
  const setCur = v => { cur = v || ''; try { sessionStorage.setItem(KEY, cur); } catch (e) { /* ignore */ } };
  /* تبويبات «الإعدادات» الإضافية: { key, label, after: نص التبويب الذي تأتي بعده، view } */
  const TABX = window.QLSetTabs = window.QLSetTabs || [];
  const st = { p: '', h: '', s: 'on' };
  const isAdm = () => typeof session !== 'undefined' && session?.role === 'admin';

  const css = document.createElement('style');
  css.textContent = `html.qfs-adm main [data-fee-cfg]:not(.qkeep),html.qfs-adm main [data-fee-bulk]:not(.qkeep){display:none!important}
    .qfs .bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.3rem 0 .6rem}
    .qfs .bar select{width:auto;max-width:18rem;margin:0}
    .qimp [data-disc-setup],.qimp [data-fee-match]{display:none!important}`;
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
        <div class="row"><button type="button" class="btn qkeep" data-fee-bulk data-qfsbulk ${n ? '' : 'disabled'}>تعيين لـ${n} طالب</button></div></div>
      <div class="card qfs"><h2>أدوات الاشتراكات</h2>
        <p class="muted" style="margin:0 0 .7rem;font-size:.9rem">«تعديل الخصومات» يراجع الطلاب الذين تنطبق عليهم الخصومات ويعيّنها لهم، و«مطابقة الاشتراكات» تقارن ما سُجّل في التطبيق بكشف الإيراد وتعرض الفروق.</p>
        <div class="row" style="flex-wrap:wrap;gap:.5rem"><button type="button" class="btn" data-disc-setup>تعديل الخصومات</button><button type="button" class="btn" data-fee-match>مطابقة الاشتراكات مع كشف الإيراد</button></div></div>`;
  }

  TABX.push({ key: 'fees', label: 'الاشتراكات', after: 'الإعدادات', view });
  let impHtml = '';
  TABX.push({ key: 'imp', label: 'الاستيراد', after: 'الاشتراكات', view: () => impHtml || `<div class="card">${empty('لا توجد أدوات استيراد.')}</div>` });
  /* التبويبات الإضافية في شريط «الإعدادات»: كل منها بعد التبويب الذي يحدده */
  const base = adminViews.settings;
  adminViews.settings = function () {
    const html = base.apply(this, arguments);
    if (!isAdm() || !TABX.length) return html;
    const i = html.indexOf('<div class="card subnav">'); if (i < 0) return html;
    const end = html.indexOf('</div></div>', i); if (end < 0) return html;
    const T = TABX.find(t => t.key === cur);
    if (cur && !T) setCur('');
    /* ما فوق الشريط (app-import.js): «استيراد» يصير تبويبًا، و«حالة الموقع» يدخل تبويب «الإعدادات» */
    const P = document.createElement('template'); P.innerHTML = html.slice(0, i);
    const cards = [...P.content.children], h2 = c => c.querySelector?.(':scope > h2')?.textContent.trim() || '';
    const imp = cards.find(c => h2(c) === 'استيراد'), maint = cards.find(c => h2(c) === 'حالة الموقع');
    impHtml = imp ? imp.outerHTML : '';
    const pre = cards.filter(c => c !== imp && c !== maint).map(c => c.outerHTML).join('');
    const t = document.createElement('template'); t.innerHTML = html.slice(i, end) + '</div></div>';
    const bar = t.content.querySelector('.bar') || t.content.firstElementChild;
    if (T) bar.querySelectorAll('.btn.on').forEach(b => b.classList.remove('on'));
    TABX.forEach(x => {
      const btns = [...bar.querySelectorAll('button')], after = btns.find(b => b.textContent.trim() === x.after) || btns[0];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (x.key === cur ? ' on' : ''); b.dataset.qset = x.key; b.textContent = x.label;
      if (after) after.after(b); else bar.appendChild(b);
    });
    const onSettings = !T && bar.querySelector('.btn.on[data-subtab="settings"]');
    let rest = html.slice(end + 12);
    if (onSettings) { const R = document.createElement('template'); R.innerHTML = rest; [...R.content.children].find(c => h2(c) === 'الاستيراد والمراجعة')?.remove(); rest = R.innerHTML; }
    return pre + t.innerHTML + (T ? T.view() : (onSettings && maint ? maint.outerHTML : '') + rest);
  };

  document.addEventListener('click', e => {
    const q = e.target.closest('[data-qset]');
    if (q) { setCur(q.dataset.qset); render(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-subtab][data-g="settings"]')) setCur('');
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

  /* ===== ملف الطالب: الخصم والمستحق قبل الخصم وسجل الدفعات ===== */
  let cardSid = null;
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof studentCard !== 'function') return;
    const base = studentCard;
    const w = function (st) { cardSid = st?.id || null; return base.apply(this, arguments); };
    window.studentCard = w; studentCard = w;
  });
  const canAmt = () => { try { return window.Perms ? Perms.can('fees.amount') : session?.role === 'admin'; } catch (e) { return false; } };
  const fmt = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const discsList = () => { const c = db.settings?.priv_fees || {}; let d = Array.isArray(c.discs) ? c.discs : []; if (!c.v) d = d.map(x => (x.id === 'd_special' ? { ...x, each: true } : x)); return d; };
  const discTxt = d => (d.each ? `${d.name} (يُحدَّد لكل طالب)` : `${d.name} (${d.type === 'amt' ? fmt(d.value) + ' جنيه' : (d.value ?? 0) + '%'})`);
  function dueHtml(s) {
    if (!window.QLFeeDue) return '';
    const I = s.info || {}, due = window.QLFeeDue(s); let base = due;
    if (I.feeDisc) { const k = I.feeDisc; I.feeDisc = ''; try { base = window.QLFeeDue(s); } finally { I.feeDisc = k; } }
    if (due == null) return 'غير محدد';
    return `<b>${fmt(due)}</b> جنيه${base != null && base > due ? ` <s class="muted" title="قبل الخصم">${fmt(base)}</s>` : ''}`;
  }
  /* جدول القسم: أول .tbl بعد عنوانه (قد يسبقه شريط الحجم .ztools) */
  const secTbl = h => { for (let e = h?.nextElementSibling; e && !e.matches('h3'); e = e.nextElementSibling) { const t = e.matches('.tbl') ? e.querySelector('table') : null; if (t) return t; } return null; };
  const subH = m => [...m.querySelectorAll('h3.sc-h')].find(h => h.textContent.trim() === 'الاشتراك');
  function enhance(modal) {
    const h3 = subH(modal); if (!h3 || modal.dataset.qfc) return;
    const sid = modal.querySelector('[data-fee-assign]')?.dataset.feeAssign || cardSid, s = byId(db.students, sid); if (!s) return;
    modal.dataset.qfc = sid;
    const tbl = secTbl(h3), td = tbl?.rows[0]?.cells[1];
    if (td) td.innerHTML = dueHtml(s);
    const D = discsList(), cur = (s.info || {}).feeDisc || '';
    if (tbl && (D.length || cur)) {
      const curD = D.find(d => d.id === cur);
      const cell = canAmt() && D.length
        ? `<select class="mini" data-fdisc="${esc(s.id)}" aria-label="الخصم أو الإعفاء" style="width:auto;margin:0"><option value="">بلا خصم</option>${D.map(d => `<option value="${esc(d.id)}" ${d.id === cur ? 'selected' : ''}>${esc(discTxt(d))}</option>`).join('')}</select>`
        : esc(curD ? discTxt(curD) : 'بلا خصم');
      tbl.insertAdjacentHTML('beforeend', `<tr data-qfdisc><th>الخصم</th><td>${cell}</td></tr>`);
    }
    const lh = [...modal.querySelectorAll('h3.sc-h')].find(h => h.textContent.trim() === 'سجل الاشتراكات');
    if (lh && (db.fees || []).some(f => f.studentId === s.id)) {
      lh.style.cssText += ';display:flex;align-items:center;gap:.6rem';
      lh.insertAdjacentHTML('beforeend', `<button type="button" class="btn sm noprint" data-fee-log="${esc(s.id)}" style="margin-inline-start:auto;font-size:.8rem">سجل الدفعات</button>`);
    }
  }
  let cardRaf = 0;
  new MutationObserver(() => { if (!cardRaf) cardRaf = requestAnimationFrame(() => { cardRaf = 0; document.querySelectorAll('.overlay .scard').forEach(m => { try { enhance(m); } catch (e) { console.error('feeset card:', e); } }); }); }).observe(document.body, { childList: true, subtree: true });
  /* بعد تغيير الخصم من الملف (يحفظه fees.js أولًا): المستحق في الملف يتحدّث */
  document.addEventListener('change', e => {
    const t = e.target; if (!t.matches?.('.scard [data-fdisc]')) return;
    setTimeout(() => { const m = t.closest('.scard'), s = byId(db.students, t.dataset.fdisc); const td = m && secTbl(subH(m))?.rows[0]?.cells[1]; if (s && td) td.innerHTML = dueHtml(s); }, 0);
  });
})();
