'use strict';
/* ============ «تراجع» بدل نوافذ التأكيد للتغييرات القابلة للعكس ============
   - منتظم/منقطع (data-stat): يُنفَّذ فورًا بلا سؤال، وتظهر أسفل الشاشة رسالة فيها «تراجع» لبضع ثوانٍ.
   - نقل الطالب: نافذة النقل باقية (لاختيار المكان والحلقة)، وبعد النقل رسالة فيها «تراجع» تعيده إلى حلقته السابقة.
   التراجع يعيد ما تغيّر وحده (الحالة وتاريخها، أو الحلقة) ثم يحفظ ويرسم. الحذف وما لا يُعكس يبقى بنافذة التأكيد.
   يعمل في مرحلة الالتقاط، فيسبق معالج التأكيد القديم (toggleStatus في accountant.js) أيًّا كان ترتيب التحميل.
   الشريط بعرض نصه في وسط أسفل الشاشة، وعلى الهاتف بعرض الشاشة (كان left:50% يحصر عرضه في نصف الشاشة فينكسر نصه أسطرًا). */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./undo.js')) VFILES.push('./undo.js'); } catch (e) { /* ignore */ } });
  const css = document.createElement('style');
  css.textContent = `.qundo{position:fixed;bottom:max(1rem,env(safe-area-inset-bottom));left:0;right:0;margin-inline:auto;width:max-content;z-index:75;display:flex;align-items:center;gap:.8rem;max-width:min(calc(100vw - 1.5rem),34rem);box-sizing:border-box;padding:.5rem 1.1rem .5rem .5rem;border-radius:99px;background:var(--navy-d,#0d1d36);color:var(--on-navy,#fff);box-shadow:0 8px 24px rgba(10,18,35,.3);font-weight:700}
    .qundo span{flex:1 1 auto;min-width:0}
    .qundo button{flex:none;border:0;border-radius:99px;padding:.35rem .95rem;background:var(--gold,#b08a3e);color:#fff;font:inherit;font-weight:700;cursor:pointer}
    .qundo button:focus-visible{outline:3px solid #fff;outline-offset:2px}
    @media (max-width:600px){.qundo{width:auto;left:.75rem;right:.75rem;max-width:none;border-radius:14px;padding:.55rem .6rem .55rem 1rem;font-size:.95rem;line-height:1.5}}
    @media print{.qundo{display:none!important}}`;
  document.head.appendChild(css);

  let box = null, timer = 0;
  const hide = () => { clearTimeout(timer); if (box) box.remove(); box = null; };
  /* رسالة بزر «تراجع»: رسالة جديدة تحل محل السابقة (فيبقى التراجع لآخر تغيير فقط) */
  function undoToast(msg, undo, ms = 7000) {
    hide();
    const t = document.getElementById('toast'); if (t) t.hidden = true;
    const el = document.createElement('div'); el.className = 'qundo'; el.setAttribute('role', 'status');
    el.innerHTML = '<span></span><button type="button">تراجع</button>';
    el.querySelector('span').textContent = msg;
    el.querySelector('button').onclick = () => {
      if (box !== el) return;
      hide();
      try { undo(); } catch (e) { console.error('undo:', e); toast('تعذّر التراجع'); }
    };
    document.body.appendChild(el); box = el;
    timer = setTimeout(hide, ms);
  }
  window.QLUndo = undoToast;

  const can = p => { try { return window.Perms ? Perms.can(p) : session?.role === 'admin'; } catch (e) { return false; } };
  const commit = () => { save(); render(); };
  const halName = id => { const h = byId(db.halaqat, id); return h ? halaqaLabel(h) : 'بلا حلقة'; };

  /* ===== منتظم/منقطع: فورًا، مع «تراجع» ===== */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-stat]'); if (!b || b.closest('.overlay')) return;
    const s = byId(db.students, b.dataset.stat); if (!s || !can('students.status')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const prev = { status: s.info?.status, statusDate: s.info?.statusDate }, wasOff = stOff(s), id = s.id, name = s.name;
    s.info = { ...(s.info || {}), status: wasOff ? '' : 'منقطع', statusDate: today() };
    commit();
    undoToast(wasOff ? `أصبح «${name}» منتظمًا` : `سُجّل «${name}» منقطعًا`, () => {
      const cur = byId(db.students, id); if (!cur) return;
      const info = { ...(cur.info || {}) };
      ['status', 'statusDate'].forEach(k => { if (prev[k] === undefined) delete info[k]; else info[k] = prev[k]; });
      cur.info = info;
      commit(); toast('تم التراجع');
    });
  }, true);

  /* ===== نقل الطالب: لقطة الحلقات لحظة الضغط على «نقل» أو «حفظ» في نافذة النقل، ثم المقارنة بعد التنفيذ ===== */
  document.addEventListener('click', e => {
    const ov = e.target.closest('.overlay'); if (!ov || !e.target.closest('[data-mvok],[data-save]')) return;
    if (!/^\s*نقل الطالب/.test(ov.querySelector('h2')?.textContent || '')) return;
    const snap = new Map(db.students.map(s => [s.id, s.halaqaId || '']));
    setTimeout(() => {
      const moved = db.students.filter(s => snap.has(s.id) && (s.halaqaId || '') !== snap.get(s.id));
      if (moved.length !== 1) return;
      const s = moved[0], id = s.id, name = s.name, from = snap.get(id), to = s.halaqaId || '';
      undoToast(`نُقل «${name}» إلى ${halName(to)}`, () => {
        const cur = byId(db.students, id); if (!cur || (cur.halaqaId || '') !== to) return;
        cur.halaqaId = from; commit(); toast(`أُعيد «${name}» إلى ${halName(from)}`);
      });
    }, 0);
  }, true);
})();
