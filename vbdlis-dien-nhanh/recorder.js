// VBDLIS Điền Nhanh – GHI THAO TÁC
// Ghi lại thao tác của bạn trên VBDLIS để gửi cho người hỗ trợ chỉnh tiện ích cho khớp trang thật:
//  - bấm nút / chọn trong danh sách / nhập vào ô (kèm nhãn ô, tên cửa sổ)
//  - cửa sổ mở / đóng (kèm cấu trúc các ô, nút, bảng trong cửa sổ)
//  - thông báo / lỗi trang hiện ra
// Dữ liệu chỉ lưu trong trình duyệt của bạn; chỉ thành file khi bạn bấm "Dừng & xuất".
// KHÔNG ghi mật khẩu. Số dài (CCCD, điện thoại… từ 9 chữ số, kể cả viết cách "0912 345 678") được che bớt.
// Đang ghi mà trang tải lại / mở thêm tab VBDLIS → các tab cùng ghi vào MỘT bản ghi; bấm Dừng ở tab nào cũng dừng hết.
// Mỗi lần lưu là một khóa mới (chỉ ghi thêm, không đọc-sửa-ghi) → nhiều tab không đè nhau, chuyển trang không mất bước.
(() => {
  const V = 3;
  if (window.top !== window) return; // chỉ ghi khung chính
  if (window.__vbdlisRec && window.__vbdlisRec.v === V) return;
  try {
    if (window.__vbdlisRec && window.__vbdlisRec.retire) window.__vbdlisRec.retire(); // bản cũ trong cùng thế giới
  } catch (e) {}
  const store = chrome.storage.local;
  const K_STATE = 'recState'; // { on, id, start, ver, ua, stopped?, exported? } – chỉ start / stop / xuất file ghi khóa này
  const K_CHUNK = 'recEv:'; // recEv:<mã bản ghi>:<mã tab>:<số thứ tự> = { ev: [...], sn: [...] }
  const K_LOST = 'recLost:'; // recLost:<mã bản ghi>:<mã tab> = số bước không lưu được
  const OLD_KEYS = ['recEvents', 'recSnaps']; // bản ghi kiểu cũ (phiên bản 1, 2)
  const MAX_EVENTS = 4000; // mỗi tab
  const MAX_HTML = 250000; // mỗi ảnh chụp HTML
  const MAX_HTML_TOTAL = 3000000; // tổng HTML mỗi tab
  const MAX_BYTES = 4500000; // tổng dữ liệu mỗi tab (bước + ảnh chụp)
  const PANEL_HOST = 'vbdlis-dien-nhanh-host';
  const BADGE_HOST = 'vbdlis-rec-host';
  const OWN = `#${PANEL_HOST}, #${BADGE_HOST}`;
  const INST = Math.random().toString(36).slice(2, 7); // mã của tab (lần nạp trang) này

  const CTRL =
    'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]), select, textarea';
  const MODAL_SEL = '.modal, [role="dialog"], .ui-dialog, .k-window, .bootbox, .swal2-popup, .layui-layer';
  // thông báo hệ thống về hồ sơ KHÁC (không phải thao tác, lại có số biên nhận của người khác) → không ghi
  const NOISE_MSG = /(đã nhận được \d+ yêu cầu xử lý|da nhan duoc \d+ yeu cau xu ly)/i;
  const MSG_SEL =
    '.toast, .toast-message, .alert, .swal2-popup, .bootbox-body, .noty_body, .jq-toast-single, .ui-pnotify-text, .notifyjs-container, .field-validation-error, .validation-summary-errors, .help-block, .text-danger, .error-message, label.error, .invalid-feedback';
  const PASS_RE = /current-password|new-password|one-time-code/i;

  // ---------- tiện ích ----------
  const norm = (s) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const clip = (s, n) => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // che số dài: liền nhau từ 9 chữ số, hoặc viết cách kiểu điện thoại / CCCD ("0912 345 678", "024.054.005.425")
  const hideMid = (d) => d.slice(0, 3) + d.slice(3, -2).replace(/\d/g, '•') + d.slice(-2);
  const mask = (s) =>
    String(s ?? '')
      .replace(/\d{9,}/g, hideMid)
      .replace(/\b0\d{2,3}(?:[ .-]\d{3,4}){2,3}\b/g, (d) => (d.replace(/\D/g, '').length >= 9 ? hideMid(d) : d));
  // che MỌI chuỗi trong file xuất (nút, lựa chọn, tiêu đề, ghi chú, đường dẫn…), trừ dòng trình duyệt
  const deepMask = (o) => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && k !== 'userAgent' ? mask(v) : v));
  const isAlive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };
  const isVisible = (el) => {
    if (!el || !el.isConnected || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const usable = (c) => isVisible(c) || (c.tagName === 'SELECT' && isVisible(c.parentElement));
  const own = (el) => !!(el && el.closest && el.closest(OWN));
  const hasLetters = (s, n) => (norm(s).match(/[a-z]/g) || []).length >= n;
  // ô mật khẩu / mã một lần → không bao giờ ghi giá trị
  const isSecret = (el) =>
    !!el &&
    el.tagName === 'INPUT' &&
    ((el.type || '').toLowerCase() === 'password' || PASS_RE.test(el.getAttribute('autocomplete') || ''));

  function modalTitle(m) {
    if (!m) return '';
    const cands = m.querySelectorAll(
      '.modal-title, .modal-header, .ui-dialog-title, .k-window-title, [class*="title"], [class*="header"], h1, h2, h3, h4, h5'
    );
    for (const t of cands) {
      const s = clip(t.textContent, 80);
      if (s && s.length <= 80) return s;
    }
    return '';
  }
  const modalOf = (el) => (el && el.closest ? el.closest(MODAL_SEL) : null);

  function cssPath(el) {
    const parts = [];
    for (let e = el, d = 0; e && e.nodeType === 1 && e !== document.body && d < 6; e = e.parentElement, d++) {
      let p = e.tagName.toLowerCase();
      if (e.id) {
        parts.unshift(p + '#' + e.id);
        break;
      }
      const cls = [...e.classList].filter((c) => !/^(ng-|active|in|show|open|focus|hover)/.test(c)).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      const sib = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
      if (sib.length > 1) p += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  }

  function widgetHints(el) {
    const h = [];
    if (el.classList.contains('select2-hidden-accessible') || (el.nextElementSibling && /select2/.test(el.nextElementSibling.className || '')))
      h.push('select2');
    if (el.nextElementSibling && /chosen-container/.test(el.nextElementSibling.className || '')) h.push('chosen');
    if (
      el.classList.contains('hasDatepicker') ||
      /date/i.test(el.className || '') ||
      el.getAttribute('data-provide') === 'datepicker' ||
      el.closest('.date, .input-group.date')
    )
      h.push('date?');
    if (el.closest('.k-widget')) h.push('kendo');
    if (el.hasAttribute('data-inputmask') || el.hasAttribute('im-insert')) h.push('inputmask');
    if (el.hasAttribute('data-a-sign') || el.hasAttribute('data-an-default') || /autonumeric|numeric|money/i.test(el.className || ''))
      h.push('so?');
    if (isSecret(el)) h.push('mật khẩu');
    return h;
  }

  function describe(el) {
    if (!el || el.nodeType !== 1) return null;
    const d = { tag: el.tagName.toLowerCase() };
    if (el.type && el.tagName === 'INPUT') d.type = el.type;
    if (el.id) d.id = el.id;
    if (el.name) d.name = el.name;
    const cls = [...el.classList].slice(0, 5).join(' ');
    if (cls) d.cls = cls;
    if (el.placeholder) d.ph = clip(el.placeholder, 60);
    if (el.getAttribute('role')) d.role = el.getAttribute('role');
    if (el.readOnly) d.ro = true;
    if (el.disabled) d.dis = true;
    if (/^(button|a|label|span|li|td|th|div|i)$/.test(d.tag) || d.type === 'button' || d.type === 'submit') {
      const t = clip(el.value && d.tag === 'input' ? el.value : el.textContent, 80);
      if (t) d.text = mask(t);
    }
    if (el.tagName === 'A') d.href = clip(el.getAttribute('href') || '', 80);
    if (el.matches && el.matches(CTRL)) {
      const w = widgetHints(el);
      if (w.length) d.widget = w;
    }
    d.path = cssPath(el);
    return d;
  }

  // Nhãn của ô: label[for], label bọc ngoài, hoặc chữ đứng trước ô trong cùng khối (bỏ qua đường link / nút)
  function labelFor(el) {
    if (!el || !el.closest) return '';
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && clip(l.textContent, 80)) return clip(l.textContent, 80);
    }
    const wrap = el.closest('label');
    if (wrap && clip(wrap.textContent, 80)) return clip(wrap.textContent, 80);
    let node = el;
    for (let depth = 0; depth < 4 && node && node !== document.body; depth++) {
      for (let s = node.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.matches && s.matches(CTRL)) break;
        if (s.matches && s.matches('a, button, .btn, [role="button"]')) continue;
        const lab = s.matches('label') ? s : [...s.querySelectorAll('label, span, b, strong, td, th, p')].pop();
        const t = clip((lab || s).textContent, 80);
        if (t && hasLetters(t, 2)) return t;
      }
      node = node.parentElement;
    }
    return clip(el.placeholder || el.getAttribute('aria-label') || el.title || '', 80);
  }

  const valueOf = (el) => {
    if (isSecret(el)) return el.value ? '(mật khẩu – không ghi)' : '';
    if (el.tagName === 'SELECT') return el.selectedIndex >= 0 ? clip(el.options[el.selectedIndex].text, 120) : '';
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '☑' : '☐';
    return clip(el.value, 300);
  };
  const ctx = (el) => ({
    el: describe(el),
    label: el && el.matches && el.matches(CTRL) ? mask(labelFor(el)) : undefined,
    modal: modalTitle(modalOf(el)) || undefined,
  });

  function sanitizeHtml(h) {
    return mask(
      h
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '<svg/>')
        .replace(/<!--[\s\S]*?-->/g, '')
        // ô mật khẩu: bỏ thuộc tính value (nếu trang có ghi vào)
        .replace(/<input\b[^>]*>/gi, (t) =>
          /type\s*=\s*["']?password/i.test(t) || PASS_RE.test(t) ? t.replace(/\svalue\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') : t
        )
        .replace(/(src|href)="data:[^"]{60,}"/gi, '$1="data:…"')
        .replace(/="([^"]{200})[^"]+"/g, '="$1…"')
        .replace(/\s{2,}/g, ' ')
    );
  }

  // ---------- trạng thái ghi của tab này ----------
  let rec = null; // { on, id, start, n, bytes, htmlBytes, full }
  let buf = [];
  let snapBuf = [];
  let timer = null;
  let flushTimer = null;
  let attached = false;
  let dead = false; // tiện ích đã được tải lại → bản này không lưu được nữa
  let retired = false;
  let seq = 0;
  let lost = 0;
  let lastUrl = '';
  let openSet = new Set();
  let seenMsg = new Set();
  let lastSelect = null;
  let lastFocus = { el: null, at: 0 };
  let lastPick = { text: '', at: 0 };
  const lastVals = new WeakMap();
  const lastRec = new WeakMap();

  // tiện ích đang điền (bộ điền đặt window.__vbdlisActive; cùng "thế giới" với bộ ghi)
  function byExt() {
    const a = window.__vbdlisActive;
    return !!a && Date.now() - a < 20000;
  }

  // e: sự kiện gốc (nếu có). Thao tác THẬT của bạn (isTrusted) không bao giờ bị ghi là "tiện ích".
  function push(ev, e) {
    if (!rec || !rec.on || dead || retired) return;
    if (!isAlive()) return onDead();
    if (rec.n >= MAX_EVENTS || rec.bytes >= MAX_BYTES) {
      if (!rec.full) {
        rec.full = true;
        buf.push({ t: Date.now() - rec.start, type: 'note', text: `đã đủ ${rec.n} bước ở tab này – ngừng ghi thêm` });
        writeNow();
      }
      return;
    }
    ev.t = Date.now() - rec.start;
    if (e ? !e.isTrusted && byExt() : byExt()) ev.by = 'tiện ích';
    else if (e && !e.isTrusted && ev.type === 'click') ev.auto = 'trang tự bấm';
    buf.push(ev);
    rec.n++;
    rec.bytes += JSON.stringify(ev).length;
    updateBadge();
    // thao tác có thể làm chuyển trang → lưu ngay; còn lại gom 1,5 giây rồi lưu
    if (/^(click|key|submit|pick|stop|note|start|resume)$/.test(ev.type)) writeNow();
    else scheduleFlush();
  }

  function scheduleFlush() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(writeNow, 1500);
  }
  // Lưu phần đang chờ thành MỘT khóa mới (chỉ ghi, không đọc) – lệnh lưu được gửi ngay, kể cả khi trang đang đóng
  function writeNow() {
    clearTimeout(flushTimer);
    if (!rec || (!buf.length && !snapBuf.length)) return Promise.resolve();
    if (!isAlive()) {
      onDead();
      return Promise.resolve();
    }
    const ev = buf;
    const sn = snapBuf;
    buf = [];
    snapBuf = [];
    const id = rec.id;
    const key = `${K_CHUNK}${id}:${INST}:${String(++seq).padStart(5, '0')}`;
    let p;
    try {
      p = store.set({ [key]: { ev, sn } });
    } catch (e) {
      p = Promise.reject(e);
    }
    return Promise.resolve(p).catch(() => {
      // không lưu được (bộ nhớ đầy / tiện ích vừa tải lại) → đếm lại để báo trong file và trên huy hiệu
      lost += ev.length + sn.length;
      updateBadge();
      try {
        const q = store.set({ [`${K_LOST}${id}:${INST}`]: lost });
        if (q && q.catch) q.catch(() => {});
      } catch (e2) {}
      if (!isAlive()) onDead();
    });
  }

  // ---------- chụp cấu trúc ----------
  function snapshot(root, kind, title) {
    if (!rec || !rec.on || rec.full || rec.bytes >= MAX_BYTES || dead) return null;
    const fields = [...root.querySelectorAll(CTRL)]
      .filter((c) => usable(c) && !own(c))
      .slice(0, 250)
      .map((c) => {
        const f = { label: mask(labelFor(c)), el: describe(c), value: mask(valueOf(c)) };
        if (c.tagName === 'SELECT') f.options = [...c.options].slice(0, 40).map((o) => mask(clip(o.text, 100)));
        return f;
      });
    const buttons = [...root.querySelectorAll('button, a.btn, a[onclick], [role="button"], input[type="button"], input[type="submit"]')]
      .filter((b) => isVisible(b) && !own(b))
      .slice(0, 80)
      .map((b) => ({ text: mask(clip(b.value || b.textContent, 60)), el: describe(b) }));
    const tables = [...root.querySelectorAll('table')]
      .filter((t) => isVisible(t) && !own(t))
      .slice(0, 10)
      .map((t) => ({
        el: describe(t),
        heads: [...t.querySelectorAll('thead th, thead td')].map((h) => mask(clip(h.textContent, 50))),
        rows: [...t.querySelectorAll('tbody tr')].slice(0, 6).map((tr) => [...tr.children].map((td) => mask(clip(td.textContent, 80)))),
      }));
    let html = '';
    if (rec.htmlBytes < MAX_HTML_TOTAL) {
      html = sanitizeHtml(root.outerHTML);
      if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML) + ' …[cắt bớt]';
      rec.htmlBytes += html.length;
    } else html = '(đã đủ dung lượng HTML – chỉ ghi cấu trúc)';
    const id = `${kind}-${rec.n}-${Date.now() % 100000}`;
    const s = { id, t: Date.now() - rec.start, kind, title: title || '', url: location.pathname, fields, buttons, tables, html };
    rec.bytes += JSON.stringify(s).length;
    snapBuf.push(s);
    scheduleFlush();
    return id;
  }
  function snapLater(root, kind, title, ms, label) {
    setTimeout(() => {
      if (!rec || !rec.on || (kind === 'modal' && !isVisible(root))) return;
      const id = snapshot(kind === 'page' ? mainRoot() : root, kind, title);
      if (id) push({ type: 'snapshot', title: label || title, snap: id });
    }, ms);
  }

  function mainRoot() {
    return document.querySelector('form') || document.querySelector('.page-content, .content-wrapper, #main, main, .main-content') || document.body;
  }

  // ---------- nghe thao tác ----------
  function recordValue(el, how, v, e) {
    const val = v === undefined ? valueOf(el) : v;
    const last = lastRec.get(el);
    if (last && last.v === val && Date.now() - last.at < 3000) return; // vừa ghi rồi
    lastRec.set(el, { v: val, at: Date.now() });
    lastVals.set(el, val);
    push({ type: 'value', how, ...ctx(el), value: mask(val) }, e);
  }

  function selectOfContainer(c) {
    const box = c.closest('.select2-container, .chosen-container');
    const prev = box && box.previousElementSibling;
    return prev && prev.tagName === 'SELECT' ? prev : null;
  }

  // chọn trong danh sách: select2/chosen → gán cho ô chọn vừa mở; danh sách thả xuống của NÚT (vd. "Thêm" → "Cá nhân") → gán cho nút đó
  function recordPick(opt, e) {
    const text = mask(clip(opt.textContent, 150));
    if (lastPick.text === text && Date.now() - lastPick.at < 1500) return;
    lastPick = { text, at: Date.now() };
    const menu = opt.closest('.dropdown-menu, [role="menu"]');
    if (menu && !opt.closest('.select2-results__option, .chosen-results li')) {
      const box = menu.closest('.dropdown, .btn-group') || menu.parentElement;
      const toggle = box && box.querySelector('[data-toggle="dropdown"], [data-bs-toggle="dropdown"], .dropdown-toggle');
      push({ type: 'pick', text, menu: toggle ? ctx(toggle) : null }, e);
      return;
    }
    push({ type: 'pick', text, list: lastSelect ? ctx(lastSelect) : null }, e);
    lastSelect = null; // đã chọn xong → không gán cho lần chọn sau
  }
  function onMouseUp(e) {
    if (!rec || !rec.on) return;
    const el = e.target;
    if (!el || el.nodeType !== 1 || own(el)) return;
    const opt = el.closest('.select2-results__option, .chosen-results li');
    if (opt) recordPick(opt, e);
  }
  function onClick(e) {
    if (!rec || !rec.on) return;
    const el = e.target;
    if (!el || el.nodeType !== 1 || own(el)) return;
    const opt = el.closest('.select2-results__option, .chosen-results li, .ui-menu-item, .dropdown-menu li');
    if (opt) {
      recordPick(opt, e);
      return;
    }
    const box = el.closest('.select2-selection, .select2-container, .chosen-container');
    if (box) {
      lastSelect = selectOfContainer(box);
      push({ type: 'open-list', ...(lastSelect ? ctx(lastSelect) : ctx(box)) }, e);
      return;
    }
    const t = el.closest(
      'button, a, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], .btn, [onclick]'
    );
    if (t) {
      push({ type: 'click', ...ctx(t) }, e);
      return;
    }
    if (el.matches(CTRL)) {
      if (lastFocus.el === el && Date.now() - lastFocus.at < 5000) return; // bấm lại vào ô đang gõ
      lastFocus = { el, at: Date.now() };
      push({ type: 'focus', ...ctx(el) }, e);
    }
  }

  function onChange(e) {
    if (!rec || !rec.on) return;
    const el = e.target;
    if (!el || !el.matches || !el.matches(CTRL) || own(el)) return;
    recordValue(el, 'change', undefined, e);
  }

  function onKey(e) {
    if (!rec || !rec.on || own(e.target)) return;
    if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches(CTRL))
      push({ type: 'key', key: 'Enter', ...ctx(e.target) }, e);
  }
  function onSubmit(e) {
    if (!rec || !rec.on || own(e.target)) return;
    push({ type: 'submit', ...ctx(e.target) }, e);
  }
  // trang sắp ẩn / chuyển trang → lưu ngay phần đang chờ
  function onHide() {
    if (rec && (buf.length || snapBuf.length)) writeNow();
  }
  function onVis() {
    if (document.visibilityState === 'hidden') onHide();
  }
  // bộ điền xong 1 lần điền (trước khi tắt cờ "tiện ích") → ghi ngay các ô vừa đổi, để gán đúng là "tiện ích"
  function onFillEnd() {
    if (rec && rec.on) {
      try {
        checkValues();
      } catch (e) {}
    }
  }

  function checkModals() {
    const all = [...document.querySelectorAll(MODAL_SEL)].filter((m) => isVisible(m) && !own(m));
    const now = new Set(all.filter((m) => !all.some((o) => o !== m && o.contains(m))));
    for (const m of now) {
      if (openSet.has(m)) continue;
      const title = modalTitle(m);
      m.__vbdlisTitle = title;
      push({ type: 'modal-open', title });
      snapLater(m, 'modal', title, 900); // chờ cửa sổ dựng xong các ô rồi mới chụp
    }
    for (const m of openSet) if (!now.has(m)) push({ type: 'modal-close', title: m.__vbdlisTitle || modalTitle(m) });
    openSet = now;
  }

  function visibleMsgs() {
    const out = [];
    for (const m of document.querySelectorAll(MSG_SEL)) {
      if (!isVisible(m) || own(m)) continue;
      const txt = clip(m.textContent, 300);
      if (!txt || !hasLetters(txt, 3) || NOISE_MSG.test(txt)) continue;
      out.push({ m, txt, key: txt + '|' + (m.className || '') });
    }
    return out;
  }
  function checkMessages() {
    const visible = new Set();
    for (const x of visibleMsgs()) {
      visible.add(x.key);
      if (seenMsg.has(x.key)) continue;
      push({ type: 'message', text: mask(x.txt), el: describe(x.m), modal: modalTitle(modalOf(x.m)) || undefined });
    }
    seenMsg = visible;
  }

  function checkValues() {
    for (const c of document.querySelectorAll(CTRL)) {
      if (!usable(c) || c.disabled) continue; // ô bị khóa (vd. đồng hồ "Ngày tiếp nhận" tự chạy) → bỏ qua
      const v = valueOf(c);
      if (!lastVals.has(c)) {
        lastVals.set(c, v); // lần đầu thấy ô → chỉ ghi nhớ, không tính là thao tác
        continue;
      }
      if (c === document.activeElement && c.tagName !== 'SELECT') continue; // đang gõ → chờ rời ô
      if (lastVals.get(c) !== v) recordValue(c, 'poll', v);
    }
  }

  function checkUrl() {
    const u = location.pathname + location.hash;
    if (u === lastUrl) return;
    lastUrl = u;
    push({ type: 'page', url: location.pathname, title: clip(document.title, 80) });
    snapLater(null, 'page', document.title, 1200, 'màn hình chính');
  }

  function tick() {
    if (!rec || !rec.on) return;
    if (!isAlive()) return onDead();
    try {
      checkUrl();
      checkModals();
      checkValues();
      checkMessages();
    } catch (e) {}
  }

  // fresh = lần ghi mới (thông báo đang hiện coi như có sẵn); không fresh = trang vừa tải lại khi đang ghi
  // (thông báo đang hiện có thể là kết quả của thao tác vừa rồi → ghi lại)
  function attach(fresh) {
    if (attached) return;
    attached = true;
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('vbdlis-fill-end', onFillEnd);
    addEventListener('pagehide', onHide);
    clearInterval(timer);
    timer = setInterval(tick, 800);
    // ghi nhớ giá trị đang có, không tính là thao tác
    for (const c of document.querySelectorAll(CTRL)) if (usable(c)) lastVals.set(c, valueOf(c));
    seenMsg = fresh ? new Set(visibleMsgs().map((x) => x.key)) : new Set();
    openSet = new Set();
    showBadge();
    tick();
  }
  function detach() {
    if (!attached) return;
    attached = false;
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('submit', onSubmit, true);
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('vbdlis-fill-end', onFillEnd);
    removeEventListener('pagehide', onHide);
    clearInterval(timer);
    clearTimeout(flushTimer);
    hideBadge();
  }

  // ---------- điều khiển ----------
  async function allKeys() {
    if (store.getKeys) {
      try {
        return await store.getKeys();
      } catch (e) {}
    }
    return Object.keys(await store.get(null));
  }
  const getState = async () => (await store.get(K_STATE))[K_STATE] || null;

  // tab này bắt đầu ghi theo trạng thái chung st
  function join(st, fresh) {
    if (dead || retired) return;
    if (rec && rec.on && rec.id === st.id) return;
    if (rec && rec.on) localStop(); // đang ghi bản khác → dừng bản đó trước
    rec = { on: true, id: st.id, start: st.start, n: 0, bytes: 0, htmlBytes: 0, full: false };
    buf = [];
    snapBuf = [];
    lastUrl = '';
    push({ type: fresh ? 'start' : 'resume', url: location.pathname });
    attach(fresh);
    notify();
  }
  // tab này thôi ghi (không đụng trạng thái chung)
  function localStop() {
    if (!rec) return;
    rec.on = false;
    detach();
    writeNow();
  }

  let starting = null;
  let startingId = null;
  function start() {
    if (starting) return starting;
    starting = (async () => {
      if (dead || retired) throw new Error('Tiện ích vừa được tải lại – bấm F5 (tải lại trang) rồi bật ghi lại');
      const st = await getState();
      if (st && st.on && st.id) {
        join(st, false); // đang ghi (ở tab khác) → ghi chung, không xóa
        return;
      }
      await removeAll(); // xóa bản ghi cũ
      const state = { on: true, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: Date.now(), ver: V, ua: navigator.userAgent };
      startingId = state.id;
      await store.set({ [K_STATE]: state });
      join(state, true);
    })().finally(() => {
      starting = null;
      startingId = null;
    });
    return starting;
  }

  let stopping = null;
  function stop() {
    if (stopping) return stopping;
    stopping = (async () => {
      if (starting) await starting.catch(() => {});
      if (rec && rec.on) push({ type: 'stop' });
      localStop();
      await writeNow();
      const st = await getState();
      if (st && st.on) await store.set({ [K_STATE]: { ...st, on: false, stopped: Date.now() } });
      await sleep(500); // các tab khác cùng ghi lưu nốt phần còn lại
      notify();
    })().finally(() => {
      stopping = null;
    });
    return stopping;
  }

  async function note(text) {
    if (!text) return;
    push({ type: 'note', text: mask(clip(text, 500)) });
    await writeNow();
  }

  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (ms) => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}`;
  function line(e) {
    const where = [e.modal && `[${e.modal}]`, e.label && `“${e.label}”`].filter(Boolean).join(' ');
    const who = e.by ? ` (${e.by})` : e.auto ? ` (${e.auto})` : '';
    switch (e.type) {
      case 'click':
        return `bấm ${e.el && e.el.text ? `“${e.el.text}”` : e.el ? e.el.tag : ''} ${where}${who}`;
      case 'value':
        return e.how === 'change' || e.by ? `nhập ${where} = “${e.value}”${who}` : `ô ${where} đổi thành “${e.value}”`;
      case 'pick':
        if (e.menu) return `chọn “${e.text}” trong nút “${(e.menu.el && e.menu.el.text) || ''}”${e.menu.modal ? ` [${e.menu.modal}]` : ''}${who}`;
        return `chọn “${e.text}”${e.list && e.list.label ? ` cho “${e.list.label}”` : ''}${who}`;
      case 'open-list':
        return `mở danh sách ${where}${who}`;
      case 'focus':
        return `bấm vào ô ${where}`;
      case 'key':
        return `nhấn Enter ở ${where}`;
      case 'submit':
        return `gửi biểu mẫu ${where}${who}`;
      case 'modal-open':
        return `cửa sổ mở: ${e.title || '(không tên)'}${who}`;
      case 'modal-close':
        return `cửa sổ đóng: ${e.title || '(không tên)'}`;
      case 'snapshot':
        return `(chụp cấu trúc: ${e.title} → ${e.snap})`;
      case 'message':
        return `trang báo: “${e.text}”${e.modal ? ` [${e.modal}]` : ''}`;
      case 'page':
        return `trang: ${e.url}`;
      case 'note':
        return `GHI CHÚ: ${e.text}`;
      case 'start':
        return 'BẮT ĐẦU GHI';
      case 'resume':
        return 'TRANG MỞ / TẢI LẠI – GHI TIẾP';
      case 'stop':
        return 'DỪNG GHI';
      default:
        return e.type;
    }
  }

  async function build() {
    await writeNow();
    const st = (await getState()) || {};
    let events = [];
    let snaps = [];
    const tabs = new Set();
    let lostTotal = 0;
    if (st.id) {
      const pre = `${K_CHUNK}${st.id}:`;
      const preLost = `${K_LOST}${st.id}:`;
      const keys = (await allKeys()).filter((k) => k.startsWith(pre) || k.startsWith(preLost)).sort();
      const data = keys.length ? await store.get(keys) : {};
      for (const k of keys) {
        if (k.startsWith(preLost)) {
          lostTotal += +data[k] || 0;
          continue;
        }
        const tab = k.slice(pre.length).split(':')[0];
        const c = data[k] || {};
        tabs.add(tab);
        (c.ev || []).forEach((x) => events.push({ ...x, tab }));
        (c.sn || []).forEach((x) => snaps.push({ ...x, tab }));
      }
    } else {
      const old = await store.get(OLD_KEYS); // bản ghi kiểu cũ
      events = old.recEvents || [];
      snaps = old.recSnaps || [];
    }
    events.sort((a, b) => (a.t || 0) - (b.t || 0));
    snaps.sort((a, b) => (a.t || 0) - (b.t || 0));
    const multi = tabs.size > 1;
    if (!multi) {
      events.forEach((x) => delete x.tab);
      snaps.forEach((x) => delete x.tab);
    }
    let panelVer = '';
    const host = document.getElementById(PANEL_HOST);
    if (host) panelVer = host.getAttribute('data-ver') || '';
    return {
      tool: 'VBDLIS Điền Nhanh – ghi thao tác',
      recorderVersion: V,
      panelVersion: panelVer,
      started: st.start ? new Date(st.start).toISOString() : '',
      stopped: st.stopped ? new Date(st.stopped).toISOString() : '',
      site: location.host,
      userAgent: st.ua || navigator.userAgent,
      note: 'Không ghi mật khẩu. Số từ 9 chữ số trở lên (kể cả viết cách) đã được che bớt. File có thể chứa tên, địa chỉ người dân – chỉ gửi cho người hỗ trợ.',
      tabs: multi ? [...tabs] : undefined,
      lostSteps: lostTotal || undefined,
      timeline: events.map((x) => `${mmss(x.t || 0)}${multi ? ` [tab ${x.tab}]` : ''} ${line(x)}`),
      events,
      snapshots: snaps,
    };
  }
  async function exportFile() {
    if (dead) throw new Error('Tiện ích vừa được tải lại – bấm F5 (tải lại trang), mở bảng điền → Dữ liệu → Xuất bản ghi');
    const obj = deepMask(await build());
    try {
      const st = await getState();
      if (st) await store.set({ [K_STATE]: { ...st, exported: true } });
    } catch (e) {}
    const d = new Date();
    const name = `vbdlis-ghi-thao-tac-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); // không gắn vào trang → trang không chặn được
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return { name, events: obj.events.length, snapshots: obj.snapshots.length, lost: obj.lostSteps || 0 };
  }
  async function stopAndExport() {
    await stop();
    return exportFile();
  }
  async function info() {
    const st = await getState();
    let has = false;
    if (st && st.id) {
      const pre = `${K_CHUNK}${st.id}:`;
      has = (await allKeys()).some((k) => k.startsWith(pre)) || buf.length > 0;
    } else {
      const o = await store.get(OLD_KEYS);
      has = !!(o.recEvents && o.recEvents.length);
    }
    return {
      on: !!(st && st.on), // đang ghi (ở bất kỳ tab nào)
      here: !!(rec && rec.on), // tab này đang ghi
      has,
      exported: !!(st && st.exported),
      n: rec ? rec.n : 0,
      started: st && st.start,
    };
  }
  async function removeAll() {
    const keys = (await allKeys()).filter((k) => k.startsWith(K_CHUNK) || k.startsWith(K_LOST));
    await store.remove([...keys, ...OLD_KEYS, K_STATE]);
  }
  async function clear() {
    await stop();
    await removeAll();
    rec = null;
    notify();
  }
  function notify() {
    document.dispatchEvent(new CustomEvent('vbdlis-rec', { detail: { on: !!(rec && rec.on), n: rec ? rec.n : 0 } }));
  }

  // tiện ích vừa được tải lại / cập nhật → bản này không lưu được nữa: thôi ghi, báo rõ (không im lặng)
  function onDead() {
    if (dead) return;
    dead = true;
    try {
      detach();
    } catch (e) {}
    if (rec) rec.on = false;
    showDeadBadge();
  }
  // bị thay bằng bản mới
  function retire() {
    retired = true;
    try {
      detach();
    } catch (e) {}
    if (rec) rec.on = false;
    hideBadge();
  }

  // ---------- huy hiệu "Đang ghi" ----------
  let badge = null;
  const BADGE_CSS = `
      *{box-sizing:border-box;font-family:"Segoe UI",system-ui,Arial,sans-serif;font-size:12.5px}
      .b{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid #dc2626;border-radius:20px;padding:5px 8px 5px 10px;box-shadow:0 6px 20px rgba(0,0,0,.25);color:#111;max-width:560px}
      .dot{width:10px;height:10px;border-radius:50%;background:#dc2626;animation:p 1s infinite;flex:none}
      @keyframes p{50%{opacity:.25}}
      button{font:inherit;border:1px solid #cbd5e1;background:#f8fafc;border-radius:12px;padding:3px 9px;cursor:pointer;flex:none}
      button.s{background:#dc2626;border-color:#dc2626;color:#fff;font-weight:600}
      .w{color:#b45309;font-weight:600}`;
  function makeBadge(html) {
    document.querySelectorAll('#' + BADGE_HOST).forEach((b) => b.remove()); // huy hiệu của bản cũ (sau khi tải lại tiện ích)
    badge = document.createElement('div');
    badge.id = BADGE_HOST;
    badge.style.cssText = 'all:initial;position:fixed;left:12px;bottom:12px;z-index:2147483647;';
    const r = badge.attachShadow({ mode: 'open' });
    r.innerHTML = `<style>${BADGE_CSS}</style>${html}`;
    ['keydown', 'keyup', 'keypress', 'focusin', 'focusout', 'input', 'change'].forEach((t) => r.addEventListener(t, (e) => e.stopPropagation()));
    (document.body || document.documentElement).appendChild(badge);
    return r;
  }
  function showBadge() {
    if (badge && badge.isConnected && badge.__kind === 'rec') return updateBadge();
    const r = makeBadge(
      `<div class="b"><span class="dot"></span><span id="t">Đang ghi thao tác</span><button id="n" title="Thêm ghi chú (vd: chỗ này bị lỗi)">+ Ghi chú</button><button class="s" id="x">■ Dừng &amp; xuất file</button></div>`
    );
    badge.__kind = 'rec';
    r.getElementById('n').addEventListener('click', () => note(prompt('Ghi chú cho người hỗ trợ (vd: chỗ này trang báo lỗi / tiện ích điền sai):') || ''));
    const x = r.getElementById('x');
    x.addEventListener('click', async (e) => {
      if (e.detail > 1 || x.disabled) return; // bấm đúp → chỉ tính 1 lần
      x.disabled = true;
      try {
        const res = await stopAndExport();
        alert(
          `Đã xuất file “${res.name}” (${res.events} bước). File nằm trong thư mục Tải xuống – gửi file này cho người hỗ trợ.` +
            (res.lost ? `\n⚠ Có ${res.lost} bước không lưu được (bộ nhớ đầy?).` : '')
        );
      } catch (err) {
        alert('Không xuất được file: ' + ((err && err.message) || err));
      } finally {
        x.disabled = false;
      }
    });
    updateBadge();
  }
  function updateBadge() {
    if (!badge || !badge.shadowRoot || badge.__kind !== 'rec') return;
    const t = badge.shadowRoot.getElementById('t');
    if (t) t.innerHTML = `Đang ghi thao tác · ${rec ? rec.n : 0} bước` + (lost ? ` <span class="w">· ⚠ ${lost} bước không lưu được</span>` : '');
  }
  function showDeadBadge() {
    const r = makeBadge(
      `<div class="b"><span class="w">⚠ Tiện ích vừa được tải lại nên ngừng ghi thao tác ở trang này. Bấm F5 (tải lại trang) để ghi tiếp; phần đã ghi vẫn còn (bảng điền → Dữ liệu → Xuất bản ghi).</span><button id="c" title="Ẩn">×</button></div>`
    );
    badge.__kind = 'dead';
    r.getElementById('c').addEventListener('click', hideBadge);
  }
  function hideBadge() {
    if (badge) badge.remove();
    badge = null;
  }

  window.__vbdlisRec = { v: V, start, stop, stopAndExport, exportFile, build, info, clear, note, retire };

  // bản cũ của tiện ích (trước khi tải lại) đang chạy trong trang → báo nó thôi ghi
  document.addEventListener('vbdlis-rec-new', (e) => {
    if (e.detail && e.detail.inst !== INST && !isAlive()) retire();
  });
  try {
    document.dispatchEvent(new CustomEvent('vbdlis-rec-new', { detail: { inst: INST, v: V } }));
  } catch (e) {}

  // bắt đầu / dừng ở tab khác → tab này làm theo (bấm Dừng ở tab nào cũng dừng hết)
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch[K_STATE] || dead || retired) return;
      const nv = ch[K_STATE].newValue;
      if (rec && rec.on && (!nv || !nv.on || nv.id !== rec.id)) {
        localStop();
        notify();
      }
      if (nv && nv.on && nv.id && nv.id !== startingId && !(rec && rec.on && rec.id === nv.id)) join(nv, false);
    });
  } catch (e) {}

  // trang vừa mở / tải lại khi đang ghi → ghi tiếp
  (async () => {
    try {
      const st = await getState();
      if (st && st.on && st.id && !(rec && rec.on)) join(st, false);
    } catch (e) {}
  })();
})();
