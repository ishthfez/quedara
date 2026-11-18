'use strict';
/* ============ صفحة «الطلاب» للعاملين (المعلم والمشرف والمحاسب والإداري) ============
   متى سمح المدير لفئة بها (أول صف في «الإعدادات ← صلاحيات صفحة الطلاب»): تظهر لها صفحة «الطلاب» نفسها التي عند المدير،
   في أول قائمتها، بدل صفحاتها القديمة للطلاب والحضور (المعلم والمشرف: «الحضور» و«طلابي»؛ الإداري: «الطلاب»؛ المحاسب: «الطلاب»).
   «التحصيل» عند المعلم والإداري و«الاشتراكات» و«تحصيل المعلمين» عند المحاسب تبقى كما هي حتى يُبنى التحصيل الجديد في الصفحة.
   - ما يظهر فيها لكل فئة من الجدول نفسه (stuperm.js).
   - الطلاب والحلقات: المعلم حلقاته، والمشرف حلقاته (والمشرف العام كلها)، والإداري حلقات نطاقه (أماكنه، أو حلقات بعينها فيها)، والمحاسب الكل.
     الخادم لا يرسل لكل حساب إلا ما يخصه أصلًا؛ والتضييق هنا على الجهاز أيضًا (لـ«العمل بصفة» حيث تصل المدير كل البيانات).
   - الاشتراكات لحلقاته فقط: المعلم والمشرف والإداري لا يصلهم جدول الدفعات ولا إعدادات الاشتراك، فتأتيهم مستحقات طلابهم
     ودفعاتهم من دالة الخادم staff_fees (supabase/fees_staff.sql) كل دقيقتين ومع تغيير سنة الشهر المختار. */
(() => {
  document.addEventListener('DOMContentLoaded', () => { try { if (!VFILES.includes('./stuview.js')) VFILES.push('./stuview.js'); } catch (e) { /* ignore */ } });
  const R4 = ['teacher', 'supervisor', 'accountant', 'placeadmin'];
  const OLD = { teacher: ['att', 'mine'], supervisor: ['att', 'mine'], placeadmin: ['mine'], accountant: [] };
  const role = () => (typeof session !== 'undefined' && session ? session.role : '');
  const on = () => R4.includes(role()) && !!window.QLStuPerm?.can('page');
  /* حلقات الحساب (null = الكل) */
  function scopeH() {
    const r = role(), m = typeof me === 'function' ? me() : null;
    if (!R4.includes(r) || r === 'accountant') return null;
    if (r === 'supervisor' && m?.info?.scope === 'all') return null;
    if (r === 'placeadmin') { if (window.placeHalaqatOf) return window.placeHalaqatOf(m); const P = new Set(Array.isArray(m?.info?.places) ? m.info.places : []); return db.halaqat.filter(h => P.has(h.placeId)); }
    return db.halaqat.filter(h => h.teacherId === session.id || h.supervisorId === session.id);
  }

  /* ===== القائمة والصفحة ===== */
  const saved = {};
  function tabs() {
    R4.forEach(r => {
      const T = TABS[r]; if (!T) return;
      if (!saved[r]) saved[r] = T.slice();
      const want = r === role() && on();
      const base = saved[r].filter(t => !(want && (OLD[r].includes(t[0]) || t[0] === 'students')));
      T.splice(0, T.length, ...(want ? [['students', 'الطلاب'], ...base] : saved[r]));
    });
    if (on() && (!ui.tab || OLD[role()].includes(ui.tab))) ui.tab = 'students';
  }
  /* يُشغَّل fn وطلاب الحساب وحلقاته وحدها في db (ثم تعود كما كانت) */
  function scoped(fn) {
    const H = on() ? scopeH() : null; if (!H) return fn();
    const ids = new Set(H.map(h => h.id)), S = db.students, Hs = db.halaqat;
    db.students = S.filter(s => ids.has(s.halaqaId)); db.halaqat = H;
    if (!ids.has(ui.hid)) ui.hid = H[0]?.id || '';
    if (ui.fh && !ids.has(ui.fh)) ui.fh = '';
    try { return fn(); } finally { db.students = S; db.halaqat = Hs; }
  }
  const view = () => scoped(() => adminViews.students());
  const baseViews = {};
  document.addEventListener('DOMContentLoaded', () => {
    R4.forEach(r => { const V = VIEWS[r]; if (!V) return; baseViews[r] = V.students; V.students = function () { return on() ? view() : (baseViews[r] ? baseViews[r].apply(this, arguments) : ''); }; });
    const base = render;
    render = function () { try { tabs(); staffFees(); } catch (e) { console.error('stuview:', e); } return base.apply(this, arguments); };
  });

  /* ===== الاشتراكات لحلقاته (المعلم والمشرف والإداري على الخادم) ===== */
  const FS = { y: 0, at: 0, loading: false, dues: new Map(), fees: null, ok: false };
  const needFees = () => CLOUD && on() && ['teacher', 'supervisor', 'placeadmin'].includes(role()) && !window.QLActAs?.();
  async function load(y) {
    if (FS.loading) return; FS.loading = true;
    try {
      const r = await window.Cloud.rpc('staff_fees', { yy: y });
      FS.dues = new Map((r?.dues || []).map(x => [x.s, x.d == null ? null : +x.d]));
      FS.fees = (r?.fees || []).map(f => ({ id: f.id, studentId: f.s, y: +f.y, m: +f.m, amount: +f.a || 0, date: f.dt || '', by: f.by || '', note: f.n || '' }));
      FS.y = y; FS.at = Date.now(); FS.ok = true;
    } catch (e) { FS.ok = false; FS.at = Date.now(); console.warn('staff_fees:', e?.message || e); }
    FS.loading = false;
    if (on() && ui.tab === 'students') render();
  }
  function staffFees() {
    if (!needFees()) return;
    const y = (window.QLFees && window.QLFees.y) || new Date().getFullYear();
    if (FS.fees && db.fees !== FS.fees) db.fees = FS.fees;   // كل سحب من الخادم يعيد db.fees فارغة لهذه الفئات
    if (y !== FS.y || Date.now() - FS.at > 120000) load(y);
  }
  /* المستحق: من الخادم لهذه الفئات (لا تصلهم إعدادات الاشتراك) */
  document.addEventListener('DOMContentLoaded', () => {
    const baseDue = window.QLFeeDue;
    if (typeof baseDue !== 'function') return;
    window.QLFeeDue = function (s, y) { if (needFees()) return FS.dues.has(s?.id) ? FS.dues.get(s.id) : null; return baseDue.apply(this, arguments); };
  });
  /* هل تُعرض الاشتراكات لهذا الحساب في الصفحة (app-abs.js)؛ ما يظهر منها يحدده الجدول */
  window.QLStaffFees = { ok: () => on() && (needFees() ? FS.ok : !!window.QLStuPerm?.can('c_due') || !!window.QLStuPerm?.can('sum')) };
  window.QLStuView = { on, scopeH, scoped };
})();
