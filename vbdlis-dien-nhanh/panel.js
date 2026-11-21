// VBDLIS Điền Nhanh – bảng điều khiển nổi (khung chính của trang)
(() => {
  const HOST_ID = 'vbdlis-dien-nhanh-host';
  const isAlive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };
  // Giá trị tự điền khi thửa chưa ghi riêng
  const DEFAULT_THOI_HAN = '50 năm';
  const DEFAULT_PHUONG = 'Phường Việt Yên (Phường Bích Động - Thị xã Việt Yên cũ)';
  const DEFAULT_QUY_TRINH = 'XA_KH2959';
  const DEFAULT_NGUON_GOC = 'Công nhận QSDĐ như giao đất không thu tiền sử dụng đất';
  // cửa sổ "Nhập đơn đăng ký" (bước xử lý hồ sơ)
  const DEFAULT_DIEU_KIEN = 'Chưa đủ điều kiện cấp giấy';
  const KHONG_DOI = '(không đổi)';
  const DEAD_MSG = 'Tiện ích vừa được tải lại nên bảng này đã mất kết nối. Bấm biểu tượng tiện ích (Alt+Q) để mở bảng mới – dữ liệu vẫn còn nguyên.';
  const PANEL_VERSION = '1.9.3'; // tăng mỗi lần sửa bảng – bảng khác phiên bản sẽ bị thay bằng bảng mới
  const old = document.getElementById(HOST_ID);
  if (old) {
    // Bảng đang mở cùng phiên bản và còn kết nối → bấm biểu tượng là ẩn/hiện; ngược lại thay bảng mới
    old.removeAttribute('data-alive');
    document.dispatchEvent(new CustomEvent('vbdlis-ping'));
    if (old.getAttribute('data-alive') === '1' && old.getAttribute('data-ver') === PANEL_VERSION) {
      old.style.display = old.style.display === 'none' ? '' : 'none';
      return;
    }
    old.remove();
  }

  // ---------- tiện ích ----------
  const norm = (s) =>
    String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const setPath = (obj, path, v) => {
    const ks = path.split('.');
    let o = obj;
    ks.slice(0, -1).forEach((k, i) => {
      if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[k];
    });
    o[ks[ks.length - 1]] = v;
  };
  const byTb = (a, b) => (parseInt(a.tb, 10) || 0) - (parseInt(b.tb, 10) || 0) || String(a.tb).localeCompare(String(b.tb));

  // ---------- trạng thái ----------
  const store = chrome.storage.local;
  const S = { data: [], cur: null, tab: 'bn', done: {}, lastScan: '', busy: false, running: false, pendingData: null, opts: {} };
  const safeSet = (obj) => {
    try {
      const p = store.set(obj);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  };
  // Lưu theo từng TB vừa sửa (đọc bản mới nhất trong bộ nhớ rồi chỉ thay TB đó) – không ghi đè dữ liệu tab khác vừa nạp
  const dirtyTbs = new Set();
  const deletedTbs = new Set(); // TB vừa xóa – lần lưu đang chờ không được thêm lại
  const saveData = debounce(async () => {
    if (!dirtyTbs.size) return;
    const ids = [...dirtyTbs];
    dirtyTbs.clear();
    try {
      const r = await store.get('tbData');
      const arr = r.tbData || [];
      ids.forEach((id) => {
        const mine = S.data.find((x) => String(x.tb) === id);
        if (!mine) return;
        const k = arr.findIndex((x) => String(x.tb) === id);
        if (k >= 0) arr[k] = mine;
        else arr.push(mine);
      });
      const keep = arr.filter((x) => !deletedTbs.has(String(x.tb)));
      keep.sort(byTb);
      await store.set({ tbData: keep });
    } catch (e) {}
  }, 300);
  const markDirty = (tb) => {
    dirtyTbs.add(String(tb.tb));
    saveData();
  };
  const saveUi = () => safeSet({ tbCur: S.cur, tbTab: S.tab, tbDone: S.done });
  const curTB = () => S.data.find((x) => String(x.tb) === String(S.cur)) || S.data[0] || null;
  const isDone = (tb, key) => !!S.done[`${tb.tb}|${key}`];

  const friendly = (e) => {
    const m = String((e && e.message) || e);
    return /invalidated|receiving end/i.test(m) ? DEAD_MSG : m;
  };

  async function send(msg) {
    if (!isAlive()) return { ok: false, error: DEAD_MSG };
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      return { ok: false, error: friendly(e) };
    }
  }

  // ---------- giao diện ----------
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:"Segoe UI",system-ui,Arial,sans-serif}
.pn{position:relative;width:var(--w,420px);height:var(--h,auto);max-height:var(--mh,calc(100vh - 90px));display:flex;flex-direction:column;background:#fff;color:#1f2937;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.28);font-size:12.5px;line-height:1.35;overflow:hidden}
.hd{display:flex;align-items:center;gap:6px;padding:7px 10px;background:#0f766e;color:#fff;cursor:move;user-select:none}
.hd b{font-size:13px;flex:1}
.hd button{background:rgba(255,255,255,.18);border:0;color:#fff;width:24px;height:22px;border-radius:5px;cursor:pointer;font-size:14px;line-height:1}
.hd button:hover{background:rgba(255,255,255,.3)}
.hd button:disabled{opacity:.5;cursor:wait}.hd button#rec{color:#fecaca}.hd button#rec.on{background:#dc2626;color:#fff;animation:blink 1s infinite}@keyframes blink{50%{opacity:.45}}
.bd{padding:8px 10px;overflow:auto;flex:1}
.pn.min .bd{display:none}
.pn.min{width:220px !important;height:auto !important}
.row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.sp{flex:1}
select,input{font:inherit;border:1px solid #cbd5e1;border-radius:6px;padding:4px 6px;background:#fff;color:#111827;min-width:0;width:100%}
input:focus,select:focus{outline:2px solid #99f6e4;border-color:#0f766e}
.btn{font:inherit;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:4px 9px;cursor:pointer;white-space:nowrap;color:#0f172a;width:auto}
.btn:hover{background:#eef2f7}
.btn.pri{background:#0f766e;border-color:#0f766e;color:#fff;font-weight:600}
.btn.pri:hover{background:#115e59}
.btn.full{width:100%;margin-top:4px}
.note{background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:6px 8px;margin-bottom:6px;white-space:pre-wrap}
.tabs{display:flex;border-bottom:1px solid #e2e8f0;margin:2px 0 8px}
.tabs button{flex:1;border:0;background:none;padding:6px 2px;cursor:pointer;font:inherit;color:#475569;border-bottom:2px solid transparent}
.tabs button.on{color:#0f766e;border-bottom-color:#0f766e;font-weight:600}
.card{border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:8px}
.card.done{border-color:#86efac;background:#f0fdf4}
.ct{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:600}
.f{display:grid;grid-template-columns:92px 1fr 22px;gap:4px;align-items:center;margin-bottom:4px}
.f label{color:#475569}
.cp{border:0;background:none;cursor:pointer;color:#64748b;font-size:13px;padding:0;width:auto}
.cp:hover{color:#0f766e}
.tr{display:grid;grid-template-columns:18px 1fr 1fr 1.3fr 1fr 58px;gap:4px;align-items:center}
.th{color:#64748b;font-size:11.5px;margin-bottom:3px}
.tr2{margin-top:4px;display:grid;grid-template-columns:1fr 78px;gap:4px}
.tr3{margin-top:4px}
.tr3 input{font-size:11.5px;color:#334155}
.ok{color:#15803d}.bad{color:#b91c1c}.muted{color:#64748b}.warn{color:#b45309;font-weight:600}
.btn.run{background:#1d4ed8;border-color:#1d4ed8;color:#fff;font-weight:600}.btn.run.stop{background:#b91c1c;border-color:#b91c1c}
.tag{font-size:11px;font-weight:500;background:#e0f2fe;color:#075985;border-radius:10px;padding:1px 7px}
.chk{color:#15803d;font-weight:700}
.status{flex:none;font-size:11.5px;padding:3px 10px;color:#0f766e;border-top:1px solid #e2e8f0}.status:empty{display:none}.status.bad{color:#b91c1c}
.btn:disabled,select:disabled{opacity:.5;cursor:not-allowed}
.result{flex:none;max-height:38vh;overflow:auto;border-top:2px solid #e2e8f0;background:#f8fafc;padding:7px 10px}
.result:empty{display:none}
.pn.min .result{display:none}
.ln{padding:1px 0;word-break:break-word}
.sum{font-weight:600;margin-bottom:4px}
.hint{color:#64748b;font-size:11.5px;margin:2px 0 6px}
pre{white-space:pre-wrap;font:11.5px/1.4 Consolas,monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;max-height:240px;overflow:auto;margin:4px 0}
.dlg{position:absolute;left:0;right:0;bottom:0;top:37px;background:#fff;display:flex;flex-direction:column;padding:10px;gap:6px;z-index:2;overflow:auto}
.dlg textarea{flex:1;min-height:140px;font:11.5px Consolas,monospace;border:1px solid #cbd5e1;border-radius:6px;padding:6px;resize:none}
.dlg .row{flex-wrap:wrap}
.dh{display:flex;align-items:center;gap:6px}.dh b{font-size:13px}
.btn.x{color:#b91c1c;border-color:#fecaca;background:#fff5f5;font-weight:600}
.rz{position:absolute;bottom:0;width:18px;height:18px;z-index:5;color:#94a3b8;font-size:13px;line-height:18px;text-align:center;user-select:none}
.rz:hover{color:#0f766e}.rz.l{left:0;cursor:nesw-resize}.rz.r{right:0;cursor:nwse-resize}
.pn.min .rz{display:none}
.pn.drop{outline:3px dashed #0f766e;outline-offset:-3px}
.btn.del{color:#b91c1c;border-color:#fecaca}.btn.del:hover{background:#fff1f2}
.pn.dlgopen{min-height:min(460px,calc(100vh - 90px))}
.pn.min .dlg{display:none}.pn.min.dlgopen{min-height:0}
`;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-ver', PANEL_VERSION);
  host.style.cssText = 'all:initial;position:fixed;top:72px;right:16px;z-index:2147483647;';
  (document.body || document.documentElement).appendChild(host);
  // trả lời "còn sống" khi lần bấm biểu tượng sau hỏi tới
  document.addEventListener('vbdlis-ping', () => {
    if (isAlive() && host.isConnected) host.setAttribute('data-alive', '1');
  });
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
<div class="pn">
  <div class="hd"><b>VBDLIS Điền Nhanh <small style="font-weight:400;opacity:.8">v${PANEL_VERSION}</small></b><button id="rec" title="Ghi thao tác: ghi lại những gì bạn làm trên VBDLIS rồi xuất ra file để gửi người hỗ trợ">●</button><button id="min" title="Thu nhỏ">–</button><button id="close" title="Ẩn (Alt+Q để mở lại)">×</button></div>
  <div class="bd">
    <div class="row"><button class="btn" id="prev" title="TB trước">‹</button><select id="tbSel"></select><button class="btn" id="next" title="TB sau">›</button></div>
    <div class="row"><button class="btn" id="scan" title="Liệt kê các nhãn/ô tìm thấy trên màn hình đang mở">Quét trường</button><button class="btn" id="dataBtn">Dữ liệu</button><button class="btn run" id="runAll" title="Màn hình Tiếp nhận hồ sơ: chọn Phường/Xã, quy trình, Số biên nhận, thêm thửa đầu, điền người nộp. Cửa sổ Nhập đơn đăng ký: chọn Điều kiện cấp giấy, tích Đăng ký lần đầu, rồi lần lượt tự bấm Thêm → Cá nhân / Thửa đất và điền từng chủ, từng thửa. Bạn tự bấm mọi nút Lưu.">▶ Chạy cả TB</button><span class="sp"></span><button class="btn" id="resetDone" title="Xóa dấu ✓ của TB này">Xóa dấu ✓</button></div>
    <div class="note" id="note" style="display:none"></div>
    <div class="tabs">
      <button data-tab="bn">Biên nhận</button><button data-tab="chu">Chủ SD</button><button data-tab="thua">Thửa đất</button><button data-tab="gt">Giấy tờ</button>
    </div>
    <div id="content"></div>
  </div>
  <div id="status" class="status"></div>
  <div id="result" class="result"></div>
  <div class="rz l" title="Kéo để phóng to / thu nhỏ bảng (bấm đúp: về cỡ mặc định)">◣</div><div class="rz r" title="Kéo để phóng to / thu nhỏ bảng (bấm đúp: về cỡ mặc định)">◢</div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const pn = $('.pn');

  // Không để phím/tiêu điểm trong bảng lọt ra trang (tránh cửa sổ VBDLIS giành lại con trỏ)
  ['keydown', 'keyup', 'keypress', 'focusin', 'focusout', 'input', 'change', 'paste', 'copy', 'cut'].forEach((t) =>
    root.addEventListener(t, (e) => e.stopPropagation())
  );

  const fld = (label, path, tb, opts = {}) => {
    const v = getPath(tb, path) ?? '';
    const input = opts.options
      ? `<select data-path="${path}">${opts.options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input data-path="${path}" value="${esc(v)}" placeholder="${esc(opts.ph || '')}">`;
    return `<div class="f"><label>${esc(label)}</label>${input}<button class="cp" title="Sao chép" data-copy="${path}">⧉</button></div>`;
  };

  const TABS = {
    bn: (tb) => `
      <div class="card ${isDone(tb, 'bn') ? 'done' : ''}">
        <div class="ct">Biên nhận & người nộp<span class="sp"></span>${isDone(tb, 'bn') ? '<span class="chk">✓ đã điền</span>' : ''}</div>
        ${fld('Phường/Xã', 'phuongXa', tb, { ph: DEFAULT_PHUONG })}
        ${fld('Quy trình', 'quyTrinh', tb, { ph: DEFAULT_QUY_TRINH })}
        ${fld('Số biên nhận', 'soBienNhan', tb)}
        ${fld('Địa chỉ tài sản', 'diaChiTaiSan', tb, { ph: 'trống = lấy địa chỉ người nộp' })}
        ${fld('Người nộp', 'nguoiNop.hoTen', tb)}
        ${fld('Số giấy tờ', 'nguoiNop.soGiayTo', tb)}
        ${fld('Địa chỉ', 'nguoiNop.diaChi', tb)}
        <div class="hint">Đóng hết cửa sổ con, đứng ở màn hình tiếp nhận hồ sơ rồi bấm.</div>
        <button class="btn pri full" data-fill="bienNhan">Điền vào màn hình tiếp nhận</button>
      </div>
      <div class="card">
        <div class="ct">“▶ Chạy cả TB” thêm thửa nào ở bước tiếp nhận</div>
        <select id="optThuaTN">
          <option value="dau"${S.opts.thuaTN !== 'tatca' ? ' selected' : ''}>Chỉ thửa đầu tiên – đủ để lưu hồ sơ (các thửa nhập ở Nhập đơn đăng ký)</option>
          <option value="tatca"${S.opts.thuaTN === 'tatca' ? ' selected' : ''}>Tất cả các thửa của TB</option>
        </select>
      </div>`,
    chu: (tb) =>
      `<div class="card">
        <div class="ct">Cửa sổ “Nhập đơn đăng ký”</div>
        ${fld('Điều kiện cấp giấy', 'dieuKienCapGiay', tb, { options: [DEFAULT_DIEU_KIEN, 'Đủ điều kiện cấp giấy', 'Không đủ điều kiện cấp giấy', 'Không có nhu cầu cấp giấy', KHONG_DOI] })}
        ${fld('Đăng ký lần đầu', 'dangKyLanDau', tb, { options: ['Tích', KHONG_DOI] })}
        <div class="hint">Mở cửa sổ “Nhập đơn đăng ký” rồi bấm “Điền” ở chủ bên dưới: tiện ích chọn 2 ô trên, tự bấm “Thêm → Cá nhân” rồi điền “Thông tin cá nhân”. Bạn kiểm tra rồi tự bấm Lưu. (Cửa sổ “Thông tin cá nhân” đang mở thì điền thẳng vào đó.)</div>
      </div>` +
      ((tb.chu || [])
        .map(
          (p, i) => `
      <div class="card ${isDone(tb, 'chu' + i) ? 'done' : ''}">
        <div class="ct">Chủ ${i + 1}: ${esc(p.hoTen)} ${p.tuyChon ? '<span class="tag">tùy chọn</span>' : ''}<span class="sp"></span>${isDone(tb, 'chu' + i) ? '<span class="chk">✓</span>' : ''}</div>
        ${fld('Họ tên', `chu.${i}.hoTen`, tb)}
        ${fld('Năm sinh', `chu.${i}.namSinh`, tb)}
        ${fld('Giới tính', `chu.${i}.gioiTinh`, tb, { options: ['Nam', 'Nữ'] })}
        ${fld('Số CCCD', `chu.${i}.soGiayTo`, tb)}
        ${fld('Nơi cấp', `chu.${i}.noiCap`, tb)}
        ${fld('Địa chỉ', `chu.${i}.diaChi`, tb)}
        <button class="btn pri full" data-fill="chu" data-i="${i}">Điền chủ ${i + 1} (tự bấm “Thêm → Cá nhân”)</button>
      </div>`
        )
        .join('') || '<p class="muted">TB này chưa có chủ sử dụng.</p>'),
    thua: (tb) => `
      <div class="row"><input id="dcChung" placeholder="Địa chỉ chung cho mọi thửa" value="${esc((tb.thua && tb.thua[0] && tb.thua[0].diaChi) || '')}"><input id="thChung" style="width:78px;flex:none" placeholder="${DEFAULT_THOI_HAN}" title="Thời hạn SD chung" value="${esc((tb.thua && tb.thua[0] && tb.thua[0].thoiHan) || '')}"></div>
      <div class="row"><input id="ngChung" placeholder="${esc(DEFAULT_NGUON_GOC)}" title="Nguồn gốc đất chung" value="${esc((tb.thua && tb.thua[0] && tb.thua[0].nguonGoc) || '')}"><button class="btn" id="dcApply" title="Ghi địa chỉ, thời hạn, nguồn gốc này cho mọi thửa của TB">Áp dụng</button></div>
      <div class="hint">Bấm Điền: ở màn hình tiếp nhận tiện ích tự bấm “Thêm thửa đất”; trong cửa sổ “Nhập đơn đăng ký” tự bấm “Thêm → Thửa đất” (thửa đã có trong đơn thì không thêm nữa); cửa sổ thửa đất đang mở thì điền thẳng. Kiểm tra xong bạn tự bấm Lưu, rồi Điền thửa tiếp theo.</div>
      <div class="tr th"><span>#</span><span>Thửa</span><span>Tờ</span><span>Diện tích</span><span>MĐSD</span><span></span></div>
      ${(tb.thua || [])
        .map(
          (t, i) => `
      <div class="card ${isDone(tb, 'thua' + i) ? 'done' : ''}">
        <div class="tr"><b>${i + 1}</b>
          <input data-path="thua.${i}.soThua" value="${esc(t.soThua)}" title="Số thửa">
          <input data-path="thua.${i}.soTo" value="${esc(t.soTo)}" title="Số tờ">
          <input data-path="thua.${i}.dienTich" value="${esc(t.dienTich)}" title="Diện tích (m²)">
          <input data-path="thua.${i}.mdsd" value="${esc(t.mdsd)}" title="Mục đích sử dụng (LUC, BHK, NTS…)">
          <button class="btn pri" data-fill="thua" data-i="${i}">${isDone(tb, 'thua' + i) ? '✓ Điền' : 'Điền'}</button>
        </div>
        <div class="tr2"><input data-path="thua.${i}.diaChi" value="${esc(t.diaChi)}" title="Địa chỉ chi tiết" placeholder="Địa chỉ chi tiết"><input data-path="thua.${i}.thoiHan" value="${esc(t.thoiHan)}" title="Thời hạn SD (trống = ${DEFAULT_THOI_HAN})" placeholder="${DEFAULT_THOI_HAN}"></div>
        <div class="tr3"><input data-path="thua.${i}.nguonGoc" value="${esc(t.nguonGoc)}" title="Nguồn gốc đất (trống = ${esc(DEFAULT_NGUON_GOC)})" placeholder="${esc(DEFAULT_NGUON_GOC)}"></div>
      </div>`
        )
        .join('')}`,
    gt: (tb) => `
      <div class="hint">Ở màn hình chính: điền vào ô “Tên tài liệu muốn thêm”, rồi bạn tự bấm nút + xanh. Nếu đang mở cửa sổ “Thông tin hồ sơ quét” thì điền vào cửa sổ đó.</div>
      ${(tb.giayTo || [])
        .map(
          (g, i) =>
            `<div class="row"><input data-path="giayTo.${i}" value="${esc(g)}"><button class="btn pri" data-fill="gt" data-i="${i}">${isDone(tb, 'gt' + i) ? '✓ Điền' : 'Điền'}</button></div>`
        )
        .join('')}
      <button class="btn" id="gtAdd">+ Thêm giấy tờ</button>`,
  };

  function render() {
    const bd = $('.bd');
    const scroll = bd.scrollTop;
    const tb = curTB();
    const sel = $('#tbSel');
    sel.innerHTML = S.data.length
      ? S.data
          .map((x) => {
            const who = (x.nguoiNop && x.nguoiNop.hoTen) || (x.chu && x.chu[0] && x.chu[0].hoTen) || '';
            return `<option value="${esc(x.tb)}">TB ${esc(x.tb)} – ${esc(who)} (${(x.thua || []).length} thửa)</option>`;
          })
          .join('')
      : '<option>(chưa có dữ liệu)</option>';
    if (tb) sel.value = String(tb.tb);
    const note = $('#note');
    note.style.display = tb && tb.ghiChu ? '' : 'none';
    note.textContent = tb && tb.ghiChu ? '⚠ ' + tb.ghiChu : '';
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
    $('#content').innerHTML = tb ? TABS[S.tab](tb) : '<p class="muted">Chưa có dữ liệu. Bấm “Dữ liệu” để dán dữ liệu TB.</p>';
    bd.scrollTop = scroll;
    if (S.running) applyRunLock();
  }

  function setResult(html) {
    $('#result').innerHTML = html;
  }
  // dòng thông báo ngắn (không xóa nhật ký đang chạy)
  let statusTimer = null;
  function setStatus(text, bad) {
    const s = $('#status');
    s.textContent = text || '';
    s.className = 'status' + (bad ? ' bad' : '');
    clearTimeout(statusTimer);
    if (text) statusTimer = setTimeout(() => (s.textContent = ''), 5000);
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    pn.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    return ok;
  }

  // ---------- điền ----------
  // Diện tích: PDF ghi "56,5" → nhập "56.5". Không đoán khi không chắc (vd "1.225": nghìn hay thập phân?)
  function normArea(s) {
    const raw = String(s ?? '').trim();
    const t = raw.replace(/\s+/g, '').replace(/(m²|m2)$/i, '');
    if (!t) return { err: 'chưa có diện tích' };
    if (/^\d{1,3}\.\d{3}$/.test(t) || /^\d{1,3}(\.\d{3})+$/.test(t)) return { err: `diện tích “${raw}” – không rõ dấu chấm là hàng nghìn hay thập phân, sửa lại (vd 1225 hoặc 1.2)` };
    if (/^\d+(\.\d+)?$/.test(t)) return { v: t };
    if (/^\d+,\d{1,2}$/.test(t)) return { v: t.replace(',', '.') }; // 56,5 → 56.5
    if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t)) return { v: t.replace(/\./g, '').replace(',', '.') }; // 1.712,6 → 1712.6
    if (/^\d+,\d{3}$/.test(t)) return { err: `diện tích “${raw}” – không rõ dấu phẩy là hàng nghìn hay thập phân, sửa lại` };
    return { err: `diện tích “${raw}” không phải số` };
  }
  // số trên trang kiểu "1,225 m²" / "56.5 m²"
  const pageNum = (s) => {
    const t = String(s ?? '').trim().replace(/\s*(m²|m2)$/i, '');
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(t)) return NaN;
    return parseFloat(t.replace(/,/g, ''));
  };

  function buildValues(section, tb, i) {
    if (section === 'bienNhan') {
      const n = tb.nguoiNop || {};
      return {
        soBienNhan: tb.soBienNhan,
        diaChiTaiSan: tb.diaChiTaiSan || n.diaChi,
        nguoiNop: n.hoTen,
        soGiayTo: n.soGiayTo,
        diaChi: n.diaChi,
      };
    }
    if (section === 'chu') {
      const p = tb.chu[i];
      return {
        loaiDoiTuong: p.loaiDoiTuong || 'Cá nhân trong nước',
        hoTen: p.hoTen,
        // Ngày sinh: không điền (VBDLIS chỉ cần Năm sinh)
        namSinh: p.namSinh || (/(\d{4})$/.exec(p.ngaySinh || '') || [])[1],
        danToc: p.danToc || 'Kinh',
        gioiTinhNam: p.gioiTinh ? norm(p.gioiTinh) === 'nam' : undefined,
        quocTich: p.quocTich || 'Việt Nam',
        loaiGiayTo: p.loaiGiayTo || 'Căn cước công dân',
        soGiayTo: p.soGiayTo,
        // Ngày cấp, Ngày hết hạn: không điền (không cần)
        noiCap: p.noiCap,
        diaChi: p.diaChi,
      };
    }
    if (section === 'thua') {
      const t = tb.thua[i];
      const a = normArea(t.dienTich);
      const pl = t.dienTichPL ? normArea(t.dienTichPL) : a;
      return {
        mdsd: t.mdsd,
        soThua: t.soThua,
        soTo: t.soTo,
        dienTich: a.v || '✗' + String(t.dienTich ?? ''), // sai dạng → bộ điền chắc chắn từ chối, báo ✗
        dienTichPL: pl.v || '✗' + String(t.dienTichPL ?? t.dienTich ?? ''),
        nguonGoc: t.nguonGoc || DEFAULT_NGUON_GOC,
        thoiHan: t.thoiHan || DEFAULT_THOI_HAN,
        diaChi: t.diaChi || (tb.nguoiNop && tb.nguoiNop.diaChi),
      };
    }
    if (section === 'donDK') {
      const dk = tb.dieuKienCapGiay || DEFAULT_DIEU_KIEN;
      const lan = tb.dangKyLanDau || 'Tích';
      return {
        dieuKienCapGiay: dk === KHONG_DOI ? undefined : dk,
        dangKyLanDau: lan === KHONG_DOI ? undefined : true,
      };
    }
    if (section === 'giayTo') {
      const g = tb.giayTo[i];
      return { loai: g, moTa: g, ten: g };
    }
    return {};
  }

  const TITLES = {
    bienNhan: 'màn hình tiếp nhận hồ sơ',
    chu: 'cửa sổ “Thông tin cá nhân” (hoặc “Nhập đơn đăng ký”)',
    thua: 'cửa sổ thửa đất',
    donDK: 'cửa sổ “Nhập đơn đăng ký”',
    giayTo: 'ô “Tên tài liệu muốn thêm” hoặc cửa sổ “Thông tin hồ sơ quét”',
  };

  function thuaErrors(t, tb, who) {
    const errs = [];
    if (!String(t.soThua || '').trim()) errs.push(`${who}: thiếu số thửa`);
    if (!String(t.soTo || '').trim()) errs.push(`${who}: thiếu số tờ`);
    const a = normArea(t.dienTich);
    if (a.err) errs.push(`${who}: ${a.err}`);
    if (t.dienTichPL) {
      const b = normArea(t.dienTichPL);
      if (b.err) errs.push(`${who} (diện tích PL): ${b.err}`);
    }
    if (!String(t.diaChi || (tb.nguoiNop && tb.nguoiNop.diaChi) || '').trim()) errs.push(`${who}: thiếu địa chỉ`);
    return errs;
  }

  // Chọn kết quả tốt nhất trong các khung; báo rõ khi cửa sổ sai / không mở được
  function pickFrame(resp, section) {
    const all = (resp.frames || []).filter(Boolean);
    const good = all.filter((f) => !f.noScope && !f.wrongScope);
    if (good.length) {
      const score = (f) => f.results.filter((x) => x.ok).length;
      good.sort((a, b) => score(b) - score(a));
      return { f: good[0] };
    }
    const d = all.find((f) => f.dup);
    if (d) return { dup: true, err: d.dup };
    const late = all.find((f) => f.noScope && f.opened);
    if (late)
      return {
        late: true,
        err: `Đã bấm “${late.opened}” nhưng sau 15 giây cửa sổ chưa hiện (máy chủ chậm?) – chờ cửa sổ hiện ra rồi bấm Điền lại, hoặc Hủy bỏ rồi chạy lại.`,
      };
    const w = all.find((f) => f.wrongScope);
    if (w) return { err: `Đang mở ${w.wrongScope}, không phải ${TITLES[section] || 'cửa sổ cần điền'} – đóng cửa sổ đó rồi bấm lại.` };
    const o = all.find((f) => f.openerErr);
    if (o) return { err: o.openerErr };
    const extra = section === 'thua' ? ', cũng không thấy nút “Thêm thửa đất” trên trang' : '';
    return { err: `Không thấy ${TITLES[section] || 'màn hình cần điền'} đang mở${extra}. Mở nó trên VBDLIS rồi bấm lại.` };
  }

  async function doFill(section, i, doneKey) {
    const tb = curTB();
    if (!tb || S.busy) return;
    if (section === 'thua') {
      const errs = thuaErrors(tb.thua[i], tb, `Thửa ${tb.thua[i].soThua || i + 1}`);
      if (errs.length) return setResult(`<div class="bad">✗ ${esc(errs.join('; '))}</div>`);
    }
    S.busy = true;
    const lineOf = (r) =>
      `<div class="ln ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} <b>${esc(r.name)}</b>${r.value !== undefined ? ` = ${esc(r.value)}` : ''}${r.msg ? ` <span class="muted">(${esc(r.msg)})</span>` : ''}</div>`;
    try {
      setResult('<div class="muted">Đang điền…</div>');
      // cửa sổ “Nhập đơn đăng ký” đang mở → chọn Điều kiện cấp giấy / tích Đăng ký lần đầu trước,
      // rồi bộ điền tự bấm “Thêm → Cá nhân” và điền cửa sổ “Thông tin cá nhân”
      let preHtml = '';
      let preBad = false;
      if (section === 'chu') {
        const st = await send({ type: 'vbdlis-act', action: 'modalState' });
        const inDon = !!(st && st.ok && (st.frames || []).some((x) => x && x.open && DON_MODAL.test(modalKey(x))));
        const dv = buildValues('donDK', tb);
        if (inDon && (dv.dieuKienCapGiay || dv.dangKyLanDau)) {
          const r0 = await send({ type: 'vbdlis-fill', section: 'donDK', values: dv });
          const p0 = r0 && r0.ok ? pickFrame(r0, 'donDK') : { err: friendly((r0 && r0.error) || 'Không chạy được') };
          const res0 = p0.f ? p0.f.results : [{ name: 'Nhập đơn đăng ký', ok: false, msg: p0.err }];
          preBad = res0.some((x) => !x.ok);
          preHtml = `<div class="sum">Cửa sổ “Nhập đơn đăng ký”</div>${res0.map(lineOf).join('')}`;
          if (res0.some((x) => x.changed)) await sleep(800); // trang tự điền Mã đơn… sau khi tích Đăng ký lần đầu
        }
      }
      const resp = await send({ type: 'vbdlis-fill', section, values: buildValues(section, tb, i) });
      if (!resp || !resp.ok) {
        setResult(preHtml + `<div class="bad">✗ ${esc(friendly((resp && resp.error) || 'Không chạy được – bấm lại biểu tượng tiện ích.'))}</div>`);
        return;
      }
      const p = pickFrame(resp, section);
      if (p.dup) {
        // đã có trong đơn → không thêm nữa, coi như đã làm
        S.done[`${tb.tb}|${doneKey}`] = true;
        saveUi();
        render();
        return setResult(preHtml + `<div class="ok">• ${esc(p.err)}</div>`);
      }
      if (!p.f) return setResult(preHtml + `<div class="bad">✗ ${esc(p.err)}</div>`);
      const f = p.f;
      const ok = f.results.filter((r) => r.ok).length;
      const lines = f.results.map(lineOf).join('');
      setResult(
        preHtml +
          `<div class="sum">${ok}/${f.results.length} ô đã điền – ${esc(f.scopeName)}${f.opened ? ` <span class="muted">(đã tự bấm “${esc(f.opened)}”)</span>` : ''}</div>${lines}<div class="hint">Kiểm tra lại trên VBDLIS rồi tự bấm “Lưu”. Ô báo ✗ thì dùng nút ⧉ để sao chép và dán tay.</div>`
      );
      if (f.results.length && ok === f.results.length && !preBad) {
        S.done[`${tb.tb}|${doneKey}`] = true;
        saveUi();
        render();
      }
    } finally {
      S.busy = false;
    }
  }

  async function doScan() {
    if (S.busy) return;
    S.busy = true;
    try {
      setResult('<div class="muted">Đang quét…</div>');
      const resp = await send({ type: 'vbdlis-scan' });
      if (!resp || !resp.ok) {
        setResult(`<div class="bad">✗ ${esc(friendly((resp && resp.error) || 'Không quét được.'))}</div>`);
        return;
      }
      const text = (resp.frames || [])
        .filter((f) => f && f.items && f.items.length)
        .map(
          (f) =>
            `[${f.scopeName}] ${f.frame}\n` +
            f.items.map((it) => `${it.label} → ${it.control}${it.value ? ` = "${it.value}"` : ''}`).join('\n')
        )
        .join('\n\n');
      S.lastScan = text || '(không thấy ô nhập nào)';
      setResult(
        `<div class="sum">Kết quả quét trường</div><div class="hint">Nhãn → ô nhập mà tiện ích sẽ dùng. Nếu ô nào ghép sai, sao chép kết quả này gửi lại để chỉnh.</div><pre>${esc(S.lastScan)}</pre><button class="btn" id="copyScan">Sao chép kết quả</button>`
      );
    } finally {
      S.busy = false;
    }
  }

  // ---------- Chạy cả TB ----------
  // Thứ tự giống thao tác tay trên màn hình Tiếp nhận hồ sơ. Tiện ích KHÔNG bấm nút Lưu nào:
  // mỗi thửa được mở + điền sẵn rồi chờ bạn kiểm tra và tự bấm Lưu; cuối cùng chỉ tô vàng nút "Lưu hồ sơ"
  // khi mọi thứ khớp với dữ liệu.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const normVal = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  // số thửa / số tờ: bỏ khoảng trắng, bỏ số 0 ở đầu ("05" = "5")
  const idNorm = (s) => {
    const t = String(s ?? '').replace(/\s+/g, '');
    return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t.toLowerCase();
  };
  const sameThua = (row, t) => idNorm(row.soThua) === idNorm(t.soThua) && idNorm(row.soTo) === idNorm(t.soTo);
  const THUA_MODAL = /^((them|moi|thong tin|chi tiet|cap nhat|sua) )*thua dat\b/;
  const THUA_ADD = /^them( moi)? thua dat\b/; // chỉ cửa sổ THÊM mới được tận dụng khi chạy cả TB
  const DON_MODAL = /^nhap don dang ky\b/;
  const CHU_MODAL = /^((thong tin|them|moi|cap nhat|sua|chi tiet) )*(ca nhan|chu su dung|nguoi su dung|chu so huu)\b/;
  const modalKey = (x) => x.key || norm(x.title || '').replace(/^[^a-z0-9]+/, '');
  const WAIT_MAX_MS = 20 * 60 * 1000; // chờ bạn bấm Lưu tối đa 20 phút

  async function act(action, extra = {}) {
    const r = await send({ type: 'vbdlis-act', action, ...extra });
    if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được lệnh trên trang'));
    return (r.frames || []).filter(Boolean);
  }
  const anyOk = (frames) => frames.some((f) => f.ok);
  async function readTable() {
    const f = (await act('readThuaTable')).find((x) => x.found);
    return f ? f.rows : null;
  }
  async function readTableFull() {
    return (await act('readThuaTable')).find((x) => x.found) || null;
  }
  async function readField(label) {
    const f = (await act('readField', { label })).find((x) => x.ok);
    return f ? f.value : null;
  }
  async function fillSec(section, values) {
    const r = await send({ type: 'vbdlis-fill', section, values });
    if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
    const p = pickFrame(r, section);
    if (!p.f) throw new Error(p.err);
    return p.f;
  }
  // Báo lỗi nếu có ô chưa điền được
  function mustFill(f) {
    const bad = f.results.filter((x) => !x.ok);
    if (bad.length) throw new Error(bad.map((x) => `${x.name}: ${x.msg}`).join('; '));
    return f;
  }
  // Dữ liệu TB phải đủ trước khi đụng vào trang
  // thuaCan: các thửa bước này sẽ thêm (bước tiếp nhận mặc định chỉ thửa đầu → thửa khác thiếu diện tích không chặn)
  function checkData(tb, thuaCan) {
    const n = tb.nguoiNop || {};
    const errs = [];
    if (!String(tb.soBienNhan || '').trim()) errs.push('thiếu Số biên nhận');
    if (!String(n.hoTen || '').trim()) errs.push('thiếu tên người nộp');
    if (!String(n.diaChi || '').trim()) errs.push('thiếu địa chỉ người nộp');
    const thua = tb.thua || [];
    if (!thua.length) errs.push('chưa có thửa nào');
    (thuaCan || thua).forEach((t) => errs.push(...thuaErrors(t, tb, `thửa ${thua.indexOf(t) + 1} (${t.soThua}/${t.soTo})`)));
    return errs;
  }
  // dữ liệu thửa còn thiếu (để nhắc bạn điền tay khi tới thửa đó)
  function thuaGaps(t, tb) {
    const g = [];
    if (normArea(t.dienTich).err) g.push('diện tích');
    if (!String(t.mdsd || '').trim()) g.push('mục đích sử dụng');
    if (!String(t.diaChi || (tb.nguoiNop && tb.nguoiNop.diaChi) || '').trim()) g.push('địa chỉ');
    return g;
  }

  function updateRunBtn() {
    const b = $('#runAll');
    if (!b) return;
    b.textContent = S.running ? '■ Dừng' : '▶ Chạy cả TB';
    b.classList.toggle('stop', !!S.running);
    root.querySelectorAll('#tbSel, #prev, #next, #scan, #dataBtn, #resetDone').forEach((x) => (x.disabled = !!S.running));
    applyRunLock();
  }
  // khi đang "Chạy cả TB": không cho sửa dữ liệu / điền lẻ (dữ liệu đã kiểm tra lúc bắt đầu)
  function applyRunLock() {
    root
      .querySelectorAll('#content input, #content select, #content [data-fill], #content #dcApply, #content #gtAdd')
      .forEach((x) => (x.disabled = !!S.running));
  }

  async function runAll() {
    const tb = curTB();
    if (!tb || S.running || S.busy) return;
    S.running = true;
    S.stopReq = false;
    updateRunBtn();
    const log = [];
    let title = `Chạy cả TB ${tb.tb} – ${(tb.nguoiNop && tb.nguoiNop.hoTen) || ''}`;
    let tail = '';
    let tailOk = '';
    const show = () =>
      setResult(`<div class="sum">${esc(title)}</div>` + log.map((l) => `<div class="ln ${l.cls}">${l.icon} ${l.html}</div>`).join('') + tail);
    const step = (text) => {
      const l = { icon: '⏳', cls: 'muted', html: esc(text) };
      log.push(l);
      show();
      const set = (icon, cls, extra) => {
        l.icon = icon;
        l.cls = cls;
        l.html = esc(text) + (extra ? ` <span class="muted">– ${esc(extra)}</span>` : '');
        show();
      };
      return { l, ok: (m) => set('✓', 'ok', m), bad: (m) => set('✗', 'bad', m), skip: (m) => set('•', 'muted', m), wait: (m) => set('⏸', 'warn', m) };
    };
    const stopIf = () => {
      if (!host.isConnected || host.style.display === 'none') S.stopReq = true; // bảng bị ẩn/đóng → dừng
      if (S.stopReq) throw new Error('Đã dừng theo yêu cầu');
    };
    // trang hỏi thêm (vd. “Cập nhật địa chỉ tài sản: Đồng ý / Không”) → chờ BẠN trả lời, tiện ích không bấm
    const waitDialogs = async (c) => {
      const t0 = Date.now();
      let shown = false;
      for (;;) {
        stopIf();
        const d = (await act('dialogState')).find((x) => x.open);
        if (!d) return shown;
        if (!shown) {
          c.wait(`trang đang hỏi “${d.titles[0]}” – bạn tự trả lời (thường là bấm “Đồng ý”), tiện ích chờ rồi làm tiếp`);
          shown = true;
        }
        if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ trả lời hộp hỏi của trang quá 20 phút – đã dừng');
        await sleep(800);
      }
    };
    const qt = tb.quyTrinh || DEFAULT_QUY_TRINH;
    const thua = tb.thua || [];
    const allMode = S.opts.thuaTN === 'tatca';
    let cur = null;

    // ---------- Bước “Nhập đơn đăng ký” (Xử lý hồ sơ → Xử lý tác vụ) ----------
    // Giống bạn làm tay: chọn Điều kiện cấp giấy + tích Đăng ký lần đầu; rồi với từng chủ, từng thửa:
    // tự bấm “Thêm → Cá nhân / Thửa đất”, điền, CHỜ bạn kiểm tra và tự bấm Lưu, thấy đã vào đơn mới làm mục sau.
    const topNow = async () => (await act('modalState')).find((x) => x.open) || null;
    const donHas = async (it) => {
      const f = (await act('donHas', { kind: it.kind, values: it.values })).find((x) => x.ok);
      return f ? !!f.has : null; // null = cửa sổ “Nhập đơn đăng ký” không nằm trên cùng
    };
    const runDon = async () => {
      title = `${title} · Nhập đơn đăng ký`;
      cur = step('Kiểm tra dữ liệu (bước Nhập đơn đăng ký)');
      const chuList = (tb.chu || []).map((p, i) => ({ p, i })).filter((x) => !x.p.tuyChon);
      const optional = (tb.chu || []).filter((p) => p.tuyChon);
      const errs = [];
      if (!chuList.length) errs.push('chưa có chủ sử dụng');
      chuList.forEach(({ p, i }) => {
        if (!String(p.hoTen || '').trim()) errs.push(`chủ ${i + 1}: thiếu họ tên`);
      });
      if (!thua.length) errs.push('chưa có thửa nào');
      if (errs.length) throw new Error('dữ liệu TB chưa đủ/chưa đúng: ' + errs.join('; '));
      // thửa thiếu số thửa / số tờ: không thêm được → bỏ qua; thiếu diện tích / mục đích: vẫn mở, bạn điền tay
      const noId = thua.filter((t) => !String(t.soThua || '').trim() || !String(t.soTo || '').trim());
      const gapNote = thua
        .map((t, i) => ({ t, i, g: thuaGaps(t, tb) }))
        .filter((x) => x.g.length && !noId.includes(x.t))
        .map((x) => `${x.t.soThua}/${x.t.soTo}: ${x.g.join(', ')}`);
      const dlg = (await act('dialogState')).find((x) => x.open);
      if (dlg) throw new Error(`trang đang hiện hộp “${dlg.titles[0]}” – trả lời hộp đó trước rồi bấm “Chạy cả TB” lại`);
      cur.ok(
        `${chuList.length} chủ, ${thua.length} thửa` +
          (optional.length ? ` (bỏ qua chủ tùy chọn ${optional.map((p) => p.hoTen).join(', ')} – cần thì bấm Điền ở tab Chủ SD)` : '') +
          (noId.length ? ` · bỏ qua ${noId.length} thửa thiếu số thửa/số tờ trong dữ liệu` : '') +
          (gapNote.length ? ` · dữ liệu còn thiếu (điền tay khi tới thửa đó): ${gapNote.join('; ')}` : '')
      );
      stopIf();

      // 1. Điều kiện cấp giấy, Đăng ký lần đầu
      const dv = buildValues('donDK', tb);
      if (dv.dieuKienCapGiay || dv.dangKyLanDau) {
        cur = step('Điều kiện cấp giấy, Đăng ký lần đầu');
        const f = mustFill(await fillSec('donDK', dv));
        cur.ok(f.results.map((x) => `${x.name}: ${x.value}`).join(', '));
        if (f.results.some((x) => x.changed)) await sleep(800); // trang tự điền Mã đơn sau khi tích Đăng ký lần đầu
      }

      // 2–3. Từng chủ, rồi từng thửa
      const items = [
        ...chuList.map(({ p, i }) => ({ kind: 'chu', key: `chu${i}`, label: `Chủ ${i + 1}: ${p.hoTen}`, values: buildValues('chu', tb, i), win: CHU_MODAL })),
        ...thua
          .map((t, i) => ({
            kind: 'thua',
            key: `thua${i}`,
            label: `Thửa ${t.soThua} tờ ${t.soTo} (${i + 1}/${thua.length})`,
            values: buildValues('thua', tb, i),
            win: THUA_MODAL,
            gaps: thuaGaps(t, tb),
            t,
          }))
          .filter((it) => !noId.includes(it.t)),
      ];
      for (const it of items) {
        stopIf();
        cur = step(it.label);
        const pendKey = `${tb.tb}|don-${it.key}|pending`;
        const finish = (msg, skip) => {
          delete S.done[pendKey];
          S.done[`${tb.tb}|${it.key}`] = true;
          saveUi();
          if (skip) cur.skip(msg);
          else cur.ok(msg);
        };
        await waitDialogs(cur);
        const top = await topNow();
        if (!top) throw new Error('cửa sổ “Nhập đơn đăng ký” đã đóng – mở lại (Xử lý tác vụ) rồi bấm “Chạy cả TB” để làm tiếp');
        if (!DON_MODAL.test(modalKey(top)))
          throw new Error(`đang mở ${top.name} – bấm Lưu hoặc Đóng cửa sổ đó để về “Nhập đơn đăng ký”, rồi bấm “Chạy cả TB” lại`);
        if ((await donHas(it)) === true) {
          finish('đã có trong đơn', true);
          continue;
        }
        // lần trước đã mở cửa sổ cho mục này mà đơn vẫn chưa có → hỏi lại trước khi mở lại (tránh nhập trùng)
        if (S.done[pendKey] === true) {
          S.done[pendKey] = 'confirm';
          saveUi();
          throw new Error(
            'lần trước cửa sổ đã đóng nhưng đơn chưa có mục này. Nếu bạn đã bấm Đóng thì bấm “▶ Chạy cả TB” lần nữa để mở lại; nếu đã bấm Lưu mà trong đơn không hiện thì kiểm tra tay'
          );
        }
        // tự bấm “Thêm → Cá nhân / Thửa đất” rồi điền
        let r = await send({ type: 'vbdlis-fill', section: it.kind, values: it.values });
        if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
        let pf = pickFrame(r, it.kind);
        if (pf.dup) {
          finish('đã có trong đơn', true);
          continue;
        }
        if (!pf.f && pf.late) {
          // đã bấm “Thêm” nhưng cửa sổ hiện chậm → chờ thêm tối đa 30 giây rồi điền vào cửa sổ đó (không bấm Thêm lần 2)
          cur.wait('đã bấm “Thêm”, đang chờ cửa sổ hiện…');
          let seen = false;
          for (let k = 0; k < 30 && !seen; k++) {
            stopIf();
            await sleep(1000);
            const tp = await topNow();
            seen = !!tp && it.win.test(modalKey(tp));
          }
          if (!seen) throw new Error(pf.err);
          r = await send({ type: 'vbdlis-fill', section: it.kind, values: it.values });
          if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
          pf = pickFrame(r, it.kind);
        }
        if (!pf.f) throw new Error(pf.err);
        const bad = pf.f.results.filter((x) => !x.ok);
        S.done[pendKey] = true; // đang chờ bạn bấm Lưu cho mục này
        saveUi();
        const waitMsg =
          (it.gaps && it.gaps.length ? `dữ liệu chưa có ${it.gaps.join(', ')} – bạn điền tay; ` : '') +
          (bad.length && !(it.gaps && it.gaps.length) ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; ` : '') +
          (!bad.length && !(it.gaps && it.gaps.length) ? 'đã điền – ' : '') +
          'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ (bấm “■ Dừng” để thôi)';
        cur.wait(waitMsg);
        // chờ bạn bấm Lưu: trang có thể hỏi (vd. “Giấy tờ tùy thân đã tồn tại…”) → bạn trả lời; xong thì về lại cửa sổ đơn
        const t0 = Date.now();
        let asked = '';
        for (;;) {
          stopIf();
          const tp = await topNow();
          const d = (await act('dialogState')).find((x) => x.open);
          if (!tp) throw new Error('cửa sổ “Nhập đơn đăng ký” đã đóng – mở lại rồi bấm “Chạy cả TB” để làm tiếp');
          if (DON_MODAL.test(modalKey(tp)) && !d) break;
          if (d && asked !== d.titles[0]) {
            asked = d.titles[0];
            cur.wait(`trang đang hỏi “${asked}” – bạn tự trả lời, tiện ích chờ rồi làm tiếp`);
          } else if (!d && asked) {
            asked = '';
            cur.wait(waitMsg);
          }
          if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bấm Lưu quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
          await sleep(1000);
        }
        // đã vào đơn chưa (cây Chủ sử dụng / Thửa đất và tài sản – trang có thể nạp lại chậm)
        let ok = false;
        for (let k = 0; k < 16 && !ok; k++) {
          await sleep(500);
          ok = await donHas(it);
          if (ok === null) {
            const tp = await topNow();
            if (!tp) throw new Error('cửa sổ “Nhập đơn đăng ký” đã đóng – mở lại (Xử lý tác vụ) rồi bấm “Chạy cả TB” để làm tiếp');
            if (!DON_MODAL.test(modalKey(tp))) throw new Error(`đang mở ${tp.name} – xong cửa sổ đó rồi bấm “Chạy cả TB” để làm tiếp`);
          }
        }
        if (!ok)
          throw new Error(
            'cửa sổ đã đóng nhưng đơn chưa có mục này (bấm Đóng?) – bấm “▶ Chạy cả TB” để làm tiếp (tiện ích sẽ hỏi lại trước khi mở lại)'
          );
        finish('đã vào đơn');
      }

      // 4. Đối chiếu: mọi chủ, mọi thửa đã có trong đơn
      cur = step('Đối chiếu đơn với dữ liệu');
      const miss = [];
      for (const it of items) if ((await donHas(it)) !== true) miss.push(it.label);
      if (miss.length) throw new Error('đơn còn thiếu: ' + miss.join('; '));
      cur.ok(
        `${chuList.length} chủ, ${items.length - chuList.length} thửa đã có trong đơn` +
          (noId.length ? ` · còn ${noId.length} thửa dữ liệu thiếu số thửa/số tờ – bạn tự thêm` : '')
      );

      // 5. Chỉ chỗ nút “Lưu thông tin đăng ký” (không bấm)
      cur = step('Nút “Lưu thông tin đăng ký”');
      if (anyOk(await act('highlight', { texts: ['Lưu thông tin đăng ký'], inModal: true })))
        cur.ok('đã tô vàng – bạn kiểm tra rồi tự bấm, sau đó bấm “Hoàn tất” (1 lần là đủ)');
      else cur.skip('không thấy nút – bạn tự bấm “Lưu thông tin đăng ký” rồi “Hoàn tất”');
      cur = null;
      tailOk =
        '<div class="hint">Xong bước Nhập đơn đăng ký: bạn kiểm tra rồi tự bấm <b>Lưu thông tin đăng ký</b>, sau đó <b>Hoàn tất</b> (bấm 1 lần, thấy “Lưu đơn đăng ký thành công” là xong).</div>';
    };

    try {
      // Cửa sổ nào đang mở → chọn bước: “Nhập đơn đăng ký” hay màn hình Tiếp nhận hồ sơ
      const top0 = (await act('modalState')).find((x) => x.open);
      const k0 = top0 ? modalKey(top0) : '';
      if (top0 && DON_MODAL.test(k0)) {
        await runDon();
        return;
      }
      if (top0 && (CHU_MODAL.test(k0) || (THUA_MODAL.test(k0) && !THUA_ADD.test(k0))))
        throw new Error(`đang mở ${top0.name} – kiểm tra rồi bấm Lưu (hoặc Đóng) để về cửa sổ trước, rồi bấm “Chạy cả TB” lại`);
      if (top0 && /^quy trinh xu ly\b/.test(k0))
        throw new Error(
          'đang mở cửa sổ “Quy trình xử lý” – muốn chạy bước Nhập đơn đăng ký thì bấm “Xử lý tác vụ” để mở cửa sổ đó rồi bấm “Chạy cả TB”'
        );
      // 0. Kiểm tra trước – không ghi gì lên trang nếu có vấn đề
      cur = step('Kiểm tra dữ liệu và màn hình');
      const errs = checkData(tb, allMode ? thua : thua.slice(0, 1));
      if (errs.length) throw new Error('dữ liệu TB chưa đủ/chưa đúng: ' + errs.join('; '));
      const thieuGT = !String((tb.nguoiNop && tb.nguoiNop.soGiayTo) || '').trim();
      const open0 = (await act('modalState')).find((x) => x.open);
      if (open0 && !THUA_ADD.test(modalKey(open0)))
        throw new Error(`đang mở ${open0.name} – đóng cửa sổ đó rồi bấm “Chạy cả TB” lại`);
      const dlg0 = (await act('dialogState')).find((x) => x.open);
      if (dlg0) throw new Error(`trang đang hiện hộp “${dlg0.titles[0]}” – trả lời hộp đó trước rồi bấm “Chạy cả TB” lại`);
      const rows0 = await readTable();
      if (!rows0) throw new Error('không thấy bảng thửa (mục “Thông tin tài sản”) – mở đúng màn hình Tiếp nhận hồ sơ');
      const foreign = rows0.filter((r) => !thua.some((t) => sameThua(r, t)));
      if (foreign.length)
        throw new Error(
          `bảng thửa trên trang đang có thửa không thuộc TB này (${foreign.map((r) => `${r.soThua}/${r.soTo}`).join(', ')}) – mở hồ sơ mới hoặc xóa các thửa đó`
        );
      for (const [label, want] of [
        ['Số biên nhận', tb.soBienNhan],
        ['Người nộp hồ sơ', tb.nguoiNop && tb.nguoiNop.hoTen],
      ]) {
        const have = await readField(label);
        if (have && normVal(have) !== normVal(want))
          throw new Error(`ô “${label}” trên trang đang là “${have}” (không phải TB ${tb.tb}) – mở hồ sơ mới hoặc xóa ô đó`);
      }
      cur.ok(thieuGT ? 'dữ liệu chưa có số giấy tờ người nộp – bạn điền tay ô đó' : '');
      stopIf();

      // 1. Phường/Xã (đã có quy trình trong bảng thì coi như đã chọn)
      cur = step('Chọn Phường/Xã');
      if (anyOk(await act('hasCellText', { text: qt }))) cur.skip('đã chọn từ trước');
      else {
        const f = mustFill(await fillSec('donVi', { phuongXa: tb.phuongXa || DEFAULT_PHUONG }));
        cur.ok(f.results[0] && f.results[0].msg);
        if (f.results.some((x) => x.changed)) await sleep(1500); // trang tự điền địa chỉ mặc định sau khi đổi Phường/Xã
      }
      stopIf();

      // 2. Quy trình XA_KH2959 → trang thêm 1 dòng vào bảng quy trình
      cur = step('Chọn quy trình ' + qt);
      if (anyOk(await act('hasCellText', { text: qt }))) cur.skip('đã có trong bảng quy trình');
      else {
        for (let i = 0; i < 25; i++) {
          // chờ trang nạp danh sách quy trình sau khi chọn Phường/Xã
          if (anyOk(await act('selectHasOption', { label: 'Quy trình/Thủ tục', text: qt }))) break;
          await sleep(300);
        }
        mustFill(await fillSec('quyTrinh', { quyTrinh: qt }));
        const added = async () => {
          for (let i = 0; i < 8; i++) {
            await sleep(250);
            if (anyOk(await act('hasCellText', { text: qt }))) return true;
          }
          return false;
        };
        let ok = await added();
        if (!ok) {
          await send({ type: 'vbdlis-select2', label: 'Quy trình/Thủ tục' });
          ok = await added();
        }
        if (!ok) throw new Error('đã chọn nhưng trang chưa thêm quy trình vào bảng – chọn tay rồi bấm “Chạy cả TB” lại');
        cur.ok();
      }
      stopIf();

      // 3. Số biên nhận
      cur = step('Số biên nhận');
      mustFill(await fillSec('soBN', { soBienNhan: tb.soBienNhan }));
      cur.ok(tb.soBienNhan);

      // 4. Thửa: mở “Thêm thửa đất”, điền, chờ bạn bấm Lưu.
      //    Mặc định chỉ THỬA ĐẦU (đủ để lưu hồ sơ; các thửa nhập đầy đủ ở bước “Nhập đơn đăng ký”).
      let runList = thua.map((t, i) => ({ t, i }));
      if (!allMode) {
        const rowsA = await readTable();
        if (!rowsA) throw new Error('không đọc được bảng thửa trên trang');
        const have = thua.find((t) => rowsA.some((r) => sameThua(r, t)));
        if (have) {
          runList = [];
          step('Thửa đất').skip(`bảng đã có thửa ${have.soThua}/${have.soTo} – bước tiếp nhận chỉ cần 1 thửa`);
        } else runList = runList.slice(0, 1);
      }
      for (const { t, i } of runList) {
        stopIf();
        const pendKey = `${tb.tb}|thua${i}|pending`;
        cur = step(
          allMode || thua.length === 1
            ? `Thửa ${t.soThua} tờ ${t.soTo} (${i + 1}/${thua.length})`
            : `Thửa đầu ${t.soThua} tờ ${t.soTo} (tiếp nhận chỉ cần 1 thửa; ${thua.length} thửa nhập ở “Nhập đơn đăng ký”)`
        );
        let rows = await readTable();
        if (!rows) throw new Error('không đọc được bảng thửa trên trang');
        if (rows.some((r) => sameThua(r, t))) {
          delete S.done[pendKey];
          S.done[`${tb.tb}|tn${i}`] = true;
          saveUi();
          cur.skip('đã có trong bảng');
          continue;
        }
        // lần trước cửa sổ đã đóng mà không thấy thửa trong bảng → hỏi lại trước khi mở lại (tránh nhập trùng)
        if (S.done[pendKey] === true) {
          S.done[pendKey] = 'confirm';
          saveUi();
          throw new Error(
            'lần trước cửa sổ đã đóng nhưng bảng không có thửa này. Nếu bạn đã bấm Hủy bỏ thì bấm “▶ Chạy cả TB” lần nữa để mở lại thửa này; nếu đã bấm Lưu mà bảng không hiện thì kiểm tra tay trên trang'
          );
        }
        const terr = thuaErrors(t, tb, `thửa ${t.soThua}/${t.soTo}`);
        if (terr.length) throw new Error('dữ liệu chưa đúng: ' + terr.join('; '));
        await waitDialogs(cur);
        const open = (await act('modalState')).find((x) => x.open);
        if (open && !THUA_ADD.test(modalKey(open)))
          throw new Error(`đang mở ${open.name} – đóng cửa sổ đó rồi bấm “Chạy cả TB” lại`);
        let f;
        {
          const r = await send({ type: 'vbdlis-fill', section: 'thua', values: buildValues('thua', tb, i) });
          if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
          let pf = pickFrame(r, 'thua');
          if (!pf.f && pf.late) {
            // đã bấm "Thêm thửa đất" nhưng cửa sổ hiện chậm → chờ thêm tối đa 30 giây rồi điền vào cửa sổ đó
            cur.wait('đã bấm “Thêm thửa đất”, đang chờ cửa sổ hiện…');
            let seen = false;
            for (let k = 0; k < 30 && !seen; k++) {
              stopIf();
              await sleep(1000);
              seen = (await act('modalState')).some((x) => x.open && THUA_ADD.test(modalKey(x)));
            }
            if (!seen) throw new Error(pf.err);
            const r2 = await send({ type: 'vbdlis-fill', section: 'thua', values: buildValues('thua', tb, i) });
            if (!r2 || !r2.ok) throw new Error(friendly((r2 && r2.error) || 'Không chạy được'));
            pf = pickFrame(r2, 'thua');
          }
          if (!pf.f) throw new Error(pf.err);
          f = pf.f;
        }
        const bad = f.results.filter((x) => !x.ok);
        S.done[pendKey] = true; // đang chờ bạn bấm Lưu cho thửa này
        saveUi();
        cur.wait(
          (bad.length ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; ` : 'đã điền – ') +
            'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ (bấm “■ Dừng” để thôi)'
        );
        const t0 = Date.now();
        for (;;) {
          stopIf();
          const st = await act('modalState');
          if (!st.some((x) => x.open)) break;
          if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bấm Lưu quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
          await sleep(1000);
        }
        // trang có thể hỏi tiếp ~1 giây sau khi cửa sổ đóng (vd. “Cập nhật địa chỉ tài sản”) → chờ bạn trả lời
        for (let k = 0; k < 5; k++) {
          await sleep(500);
          if (await waitDialogs(cur)) break;
        }
        // chờ bảng cập nhật (trang có thể nạp lại bảng chậm)
        let inTable = false;
        for (let k = 0; k < 16 && !inTable; k++) {
          await sleep(500);
          rows = await readTable();
          inTable = !!rows && rows.some((r) => sameThua(r, t));
        }
        if (!inTable)
          throw new Error('cửa sổ đã đóng nhưng bảng chưa có thửa này (bấm Hủy bỏ?) – bấm “▶ Chạy cả TB” để làm tiếp (tiện ích sẽ hỏi lại trước khi mở lại thửa này)');
        delete S.done[pendKey];
        S.done[`${tb.tb}|tn${i}`] = true;
        saveUi();
        cur.ok('đã vào bảng');
      }
      stopIf();

      // 5. Người nộp hồ sơ (địa chỉ theo mục 1c của TBXN)
      cur = step('Người nộp hồ sơ, số giấy tờ, địa chỉ');
      await waitDialogs(cur);
      const v = buildValues('bienNhan', tb);
      mustFill(await fillSec('nguoiNop', { diaChiTaiSan: v.diaChiTaiSan, nguoiNop: v.nguoiNop, soGiayTo: v.soGiayTo, diaChi: v.diaChi }));
      cur.ok(v.nguoiNop);

      // 5b. Đọc lại các ô đầu hồ sơ sau khi trang "lắng" (trang có thể tự đổi lại giá trị)
      cur = step('Kiểm tra lại số biên nhận và người nộp');
      await sleep(1200);
      for (const [label, want, required] of [
        ['Số biên nhận', tb.soBienNhan, true],
        ['Người nộp hồ sơ', v.nguoiNop, true],
        ['Số giấy tờ', v.soGiayTo, true],
        ['Địa chỉ', v.diaChi, true],
        ['Địa chỉ tài sản', v.diaChiTaiSan, false],
      ]) {
        if (!String(want || '').trim()) continue; // dữ liệu trống → bạn điền tay, không so
        const have = await readField(label);
        if (have === null) {
          if (required) throw new Error(`không đọc lại được ô “${label}” trên trang`);
          continue;
        }
        if (normVal(have) !== normVal(want)) throw new Error(`ô “${label}” trên trang đang là “${have}”, khác dữ liệu “${want}” – sửa trước khi Lưu hồ sơ`);
      }
      cur.ok();

      // 6. Đối chiếu bảng thửa trên trang với dữ liệu – lệch thì DỪNG, không tô nút Lưu hồ sơ
      cur = step('Đối chiếu bảng thửa với dữ liệu');
      {
        const full = await readTableFull();
        if (!full) throw new Error('không đọc được bảng thửa để đối chiếu');
        const rows = full.rows;
        if (full.hasArea === false)
          throw new Error('bảng thửa trên trang không có cột Diện tích – tự đối chiếu diện tích từng thửa rồi mới Lưu hồ sơ');
        // chế độ “chỉ thửa đầu”: bảng có ít nhất 1 thửa của TB là đủ
        const need = allMode ? thua : rows.some((r) => thua.some((t) => sameThua(r, t))) ? [] : thua.slice(0, 1);
        const miss = need.filter((t) => !rows.some((r) => sameThua(r, t)));
        const extra = rows.filter((r) => !thua.some((t) => sameThua(r, t)));
        const dup = rows.filter((r, k) => rows.findIndex((x) => sameThua(x, r)) !== k);
        const noArea = [];
        const badData = [];
        const area = thua.filter((t) => {
          const r = rows.find((x) => sameThua(x, t));
          if (!r) return false;
          const a = normArea(t.dienTich);
          if (a.err) {
            badData.push(t);
            return false;
          }
          if (!r.dienTich || isNaN(pageNum(r.dienTich))) {
            noArea.push(t);
            return false;
          }
          return pageNum(r.dienTich) !== parseFloat(a.v);
        });
        const fmt = (a) => a.map((x) => `${x.soThua}/${x.soTo}`).join(', ');
        const issues = [
          miss.length && `thiếu ${fmt(miss)}`,
          extra.length && `thừa ${fmt(extra)}`,
          dup.length && `trùng ${fmt(dup)}`,
          area.length && `diện tích trên trang khác dữ liệu ${fmt(area)}`,
          noArea.length && `không đọc được diện tích trên bảng cho ${fmt(noArea)} – tự đối chiếu`,
          badData.length && `diện tích trong dữ liệu không hợp lệ ${fmt(badData)}`,
        ].filter(Boolean);
        if (issues.length) throw new Error('bảng thửa KHÔNG khớp: ' + issues.join('; ') + ' – sửa trên trang trước khi Lưu hồ sơ');
        cur.ok(allMode ? `${rows.length}/${thua.length} thửa khớp` : `${rows.length} thửa trên bảng khớp dữ liệu (tiếp nhận chỉ cần 1 thửa)`);
      }

      // 7. Chỉ chỗ nút “Lưu hồ sơ” (không bấm)
      cur = step('Nút “Lưu hồ sơ”');
      if (anyOk(await act('highlight', { texts: ['Lưu hồ sơ'] }))) cur.ok('đã tô vàng – bạn kiểm tra toàn bộ rồi tự bấm');
      else cur.skip('không thấy nút trên trang');
      S.done[`${tb.tb}|bn`] = true;
      saveUi();
      cur = null;
      tailOk =
        '<div class="hint">Bước sau (Xử lý hồ sơ → <b>Nhập đơn đăng ký</b>): tab <b>Chủ SD</b> bấm “Điền chủ” (tự chọn Điều kiện cấp giấy, tích Đăng ký lần đầu, bấm “Thêm → Cá nhân”); tab <b>Thửa đất</b> bấm “Điền” từng thửa (tự bấm “Thêm → Thửa đất”). Bạn chỉ kiểm tra và bấm Lưu.</div>';
    } catch (e) {
      const m = String((e && e.message) || e);
      if (cur && (cur.l.icon === '⏳' || cur.l.icon === '⏸')) cur.bad(m);
      else log.push({ icon: '✗', cls: 'bad', html: esc(m) });
    } finally {
      S.running = false;
      updateRunBtn();
      render();
      tail =
        tailOk +
        '<div class="hint">Tiện ích không bấm nút Lưu nào. Bấm “Chạy cả TB” lại bất cứ lúc nào – bước/thửa đã xong sẽ được bỏ qua.</div>';
      show();
      if (S.pendingData) adoptData(S.pendingData);
    }
  }

  // ---------- dữ liệu ----------
  // Đọc JSON dán vào; diện tích kiểu PDF "56,5" được đổi sang "56.5"
  // JSON dán tay / sửa tay hay có lỗi nhỏ → tự sửa các lỗi thường gặp; vẫn sai thì chỉ rõ dòng, cột
  function explainJsonError(e, src) {
    const m = String((e && e.message) || e);
    let line = 0;
    let col = 0;
    let mm = /line (\d+) column (\d+)/.exec(m);
    if (mm) {
      line = +mm[1];
      col = +mm[2];
    } else if ((mm = /position (\d+)/.exec(m))) {
      const before = src.slice(0, +mm[1]);
      line = before.split('\n').length;
      col = before.length - before.lastIndexOf('\n');
    } else if ((mm = /\.\.\."([\s\S]+?)"\.\.\./.exec(m) || /"([\s\S]{1,80}?)" is not valid JSON/.exec(m))) {
      // Chrome chỉ trích một đoạn quanh chỗ sai (vd. …"ienNhan": KH 2959.07"…) → tìm đoạn đó trong dữ liệu
      const k = src.indexOf(mm[1]);
      if (k >= 0) {
        const tok = /Unexpected token '(.)'/.exec(m);
        const off = tok ? Math.max(0, mm[1].indexOf(tok[1])) : 0;
        const before = src.slice(0, k + off);
        line = before.split('\n').length;
        col = before.length - before.lastIndexOf('\n');
      }
    } else if (/end of JSON input/i.test(m)) {
      line = src.split('\n').length;
      col = (src.split('\n').pop() || '').length;
      return `JSON bị cụt ở cuối (dòng ${line}) – thiếu ngoặc đóng } hoặc ] (có thể chưa sao chép hết). Dán lại đủ nội dung rồi bấm lại.`;
    }
    if (!line) return 'JSON sai: ' + m;
    const lines = src.split('\n');
    const show = (n) => (lines[n - 1] || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return (
      `JSON sai ở dòng ${line}, cột ${col}: «${show(line)}»` +
      (line > 1 ? ` (dòng trước: «${show(line - 1)}»)` : '') +
      ' – thường do thiếu dấu phẩy cuối dòng trước, thiếu dấu ngoặc kép " hoặc thiếu ngoặc } ]. Sửa chỗ đó rồi bấm lại, hoặc kéo thả file .json do Claude gửi.'
    );
  }
  function parseJsonLoose(txt) {
    const src = String(txt ?? '').replace(/^\uFEFF/, '').trim();
    if (!src) throw new Error('Chưa có dữ liệu.');
    try {
      return { j: JSON.parse(src), fixes: [] };
    } catch (e0) {
      const fixes = [];
      let t = src;
      const fix = (re, to, what) => {
        const n = (t.match(re) || []).length;
        if (n) {
          t = t.replace(re, to);
          fixes.push(`${what} (${n} chỗ)`);
        }
      };
      fix(/,(\s*[}\]])/g, '$1', 'bỏ dấu phẩy thừa trước } ]');
      fix(/("\s*:\s*)(\d+),(\d{1,3})(?=\s*[,}\r\n])/g, '$1"$2.$3"', 'số thập phân viết dấu phẩy 56,5 → "56.5"');
      fix(/("|\d|true|false|null|[}\]])([ \t]*\r?\n\s*)(?=["{\[])/g, '$1,$2', 'thêm dấu phẩy còn thiếu cuối dòng');
      try {
        return { j: JSON.parse(t), fixes };
      } catch (e1) {}
      fix(/[“”„‟]/g, '"', 'đổi ngoặc kép kiểu Word “ ” thành "');
      try {
        return { j: JSON.parse(t), fixes };
      } catch (e2) {
        throw new Error(explainJsonError(e0, src));
      }
    }
  }
  function parseData(txt) {
    const pj = parseJsonLoose(txt);
    let j = pj.j;
    if (!Array.isArray(j)) j = Array.isArray(j.tb) ? j.tb : Array.isArray(j.data) ? j.data : [j];
    let fixed = 0;
    const bad = [];
    j.forEach((x, k) => {
      if (!x || x.tb == null || x.tb === '') throw new Error(`Mục thứ ${k + 1} thiếu trường "tb" (số thông báo)`);
      x.tb = String(x.tb);
      (x.thua || []).forEach((t) => {
        for (const key of ['dienTich', 'dienTichPL']) {
          if (t[key] == null || t[key] === '') continue;
          const a = normArea(t[key]);
          if (a.v && a.v !== String(t[key])) {
            t[key] = a.v;
            fixed++;
          } else if (a.err) bad.push(`TB ${x.tb} thửa ${t.soThua || '?'}/${t.soTo || '?'}: ${a.err}`);
        }
      });
    });
    j.fixed = fixed;
    j.bad = bad;
    j.autofix = pj.fixes;
    return j;
  }
  function adoptData(nv) {
    S.pendingData = null;
    S.data = (nv || []).slice().sort(byTb);
    render();
    setStatus('Dữ liệu vừa được cập nhật (từ tab khác).');
  }
  // tab khác sửa / nạp dữ liệu → cập nhật bảng này (chờ khi đang chạy hoặc đang gõ)
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.tbData) return;
      const nv = ch.tbData.newValue || [];
      if (JSON.stringify(nv) === JSON.stringify(S.data)) return;
      if (S.running || dirtyTbs.size || root.activeElement) S.pendingData = nv;
      else adoptData(nv);
    });
  } catch (e) {}
  root.addEventListener('focusout', () =>
    setTimeout(() => {
      if (S.pendingData && !S.running && !dirtyTbs.size && !root.activeElement) adoptData(S.pendingData);
    }, 400)
  );

  async function removeTbs(ids) {
    const all = ids === null;
    const gone = all ? S.data.map((x) => String(x.tb)) : ids;
    const k0 = S.data.findIndex((x) => String(x.tb) === String(S.cur));
    gone.forEach((id) => {
      deletedTbs.add(id);
      dirtyTbs.delete(id);
      Object.keys(S.done)
        .filter((k) => k.startsWith(id + '|'))
        .forEach((k) => delete S.done[k]);
    });
    const latest = (await store.get('tbData')).tbData || S.data; // xóa trên bản mới nhất (tab khác có thể vừa nạp thêm)
    S.data = all ? [] : latest.filter((x) => !gone.includes(String(x.tb))).sort(byTb);
    if (!S.data.some((x) => String(x.tb) === String(S.cur))) {
      const next = S.data[Math.min(Math.max(k0, 0), S.data.length - 1)];
      S.cur = next ? next.tb : null;
    }
    const del = (await store.get('tbDeleted')).tbDeleted || {};
    gone.forEach((id) => (del[id] = Date.now()));
    await store.set({ tbData: S.data, tbDeleted: del });
    saveUi();
    setResult('');
    render();
  }

  // Gộp / thay dữ liệu TB (từ ô dán, file chọn hoặc file kéo thả). Trả về câu báo kết quả.
  async function applyItems(items, replace) {
    const fixed = items.fixed;
    let arr;
    const st = await store.get(['tbData', 'tbDeleted']);
    const del = st.tbDeleted || {};
    if (replace) {
      arr = items.slice();
      (st.tbData || S.data).forEach((x) => {
        if (!items.some((y) => String(y.tb) === String(x.tb))) del[String(x.tb)] = Date.now(); // TB bị thay mất → coi như đã xóa
      });
    } else {
      arr = (st.tbData || S.data).slice(); // gộp vào bản mới nhất
      items.forEach((x) => {
        const k = arr.findIndex((y) => String(y.tb) === x.tb);
        if (k >= 0) arr[k] = x;
        else arr.push(x);
      });
    }
    arr.sort(byTb);
    items.forEach((x) => {
      deletedTbs.delete(String(x.tb)); // nạp lại TB đã xóa → cho lưu bình thường
      delete del[String(x.tb)];
    });
    S.data = arr;
    S.cur = items[0].tb;
    await store.set({ tbData: S.data, tbDeleted: del });
    saveUi();
    render();
    return {
      text:
        `Đã nạp ${items.length} TB (${items.map((x) => x.tb).join(', ')}). Tổng cộng ${S.data.length} TB.` +
        (fixed ? ` Đã đổi ${fixed} diện tích từ dấu phẩy sang dấu chấm (56,5 → 56.5).` : '') +
        (items.autofix && items.autofix.length ? ` Đã tự sửa JSON: ${items.autofix.join('; ')}.` : '') +
        (items.bad.length ? ` ⚠ Diện tích cần sửa: ${items.bad.join('; ')}` : ''),
      bad: items.bad.length > 0,
    };
  }
  // đọc các file .json (chọn bằng nút “Mở file…” hoặc kéo thả) → gộp vào
  async function importFiles(files) {
    const list = [...(files || [])].filter((f) => /\.json$/i.test(f.name) || /json/.test(f.type));
    if (!list.length) return { text: 'Không có file .json nào (chỉ nhận file dữ liệu TB dạng .json).', bad: true };
    const all = [];
    const errs = [];
    for (const f of list) {
      try {
        const items = parseData(await f.text());
        items.forEach((x) => {
          const k = all.findIndex((y) => y.tb === x.tb);
          if (k >= 0) all[k] = x;
          else all.push(x);
        });
        all.fixed = (all.fixed || 0) + items.fixed;
        all.bad = (all.bad || []).concat(items.bad);
        all.autofix = (all.autofix || []).concat(items.autofix.map((x) => `${f.name}: ${x}`));
      } catch (e) {
        errs.push(`${f.name}: ${e.message}`);
      }
    }
    if (!all.length) return { text: 'Không đọc được file: ' + errs.join('; '), bad: true };
    all.fixed = all.fixed || 0;
    all.bad = all.bad || [];
    all.autofix = all.autofix || [];
    const r = await applyItems(all, false);
    return { text: `${r.text} (từ ${list.length - errs.length} file)` + (errs.length ? ` ✗ Lỗi: ${errs.join('; ')}` : ''), bad: r.bad || errs.length > 0 };
  }

  // Thư mục data: mỗi lần mở bảng tự đọc data/du-lieu.json – TB mới được thêm, TB bạn chưa sửa được cập nhật,
  // TB bạn đã sửa trong bảng được giữ nguyên, TB bạn đã xóa không tự thêm lại
  async function syncFromFolder() {
    const s = await send({ type: 'vbdlis-sample' });
    if (!s) return null;
    if (!s.ok) return { err: 'Thư mục data: ' + friendly(s.error || 'không đọc được file data/du-lieu.json') };
    let file;
    try {
      file = parseData(s.text != null ? s.text : JSON.stringify(s.data));
    } catch (e) {
      return { err: 'File data/du-lieu.json bị lỗi – ' + e.message };
    }
    const st = await store.get(['tbData', 'tbFile', 'tbDeleted']);
    const first = st.tbData === undefined;
    const arr = (st.tbData || []).slice();
    const snap = { ...(st.tbFile || {}) }; // TB → bản đã đọc từ file lần trước
    const del = st.tbDeleted || {};
    const res = { added: [], updated: [], kept: [] };
    for (const x of file) {
      const id = String(x.tb);
      const js = JSON.stringify(x);
      if (!first && snap[id] === js) continue; // file không đổi so với lần trước
      const k = arr.findIndex((y) => String(y.tb) === id);
      if (k < 0) {
        if (!del[id]) {
          arr.push(x);
          res.added.push(id);
        }
      } else {
        const mine = JSON.stringify(arr[k]);
        if (mine !== js) {
          if (snap[id] !== undefined && mine === snap[id]) {
            arr[k] = x; // bạn chưa sửa TB này trong bảng → lấy bản mới của file
            res.updated.push(id);
          } else res.kept.push(id); // bạn đã sửa trong bảng → giữ bản của bạn
        }
      }
      snap[id] = js;
    }
    const set = { tbFile: snap };
    if (first || res.added.length || res.updated.length) {
      arr.sort(byTb);
      set.tbData = arr;
    }
    await store.set(set);
    return { ...res, data: arr };
  }

  function openData() {
    const old = pn.querySelector('.dlg');
    if (old) {
      old.querySelector('#dlgTxt').focus();
      return;
    }
    const d = document.createElement('div');
    d.className = 'dlg';
    d.innerHTML = `<div class="dh"><b>Dữ liệu TB (JSON)</b><span class="sp"></span><button class="btn x" id="dlgClose" title="Đóng hộp này (phím Esc)">✕ Đóng</button></div>
      <div class="hint">Dán dữ liệu một TB hoặc danh sách TB rồi bấm “Gộp vào” (thay TB trùng số, giữ các TB khác). Có file .json thì <b>kéo thả file vào bảng này</b> hoặc bấm “Mở file…”. File <b>data/du-lieu.json</b> của tiện ích được tự đọc mỗi lần mở bảng.</div>
      <input type="file" id="dlgFile" accept=".json,application/json" multiple style="display:none">
      <textarea id="dlgTxt" spellcheck="false"></textarea>
      <div class="row"><button class="btn pri" id="dlgMerge">Gộp vào</button><button class="btn" id="dlgReplace">Thay toàn bộ</button><button class="btn" id="dlgCopy">Sao chép hiện có</button><button class="btn" id="dlgOpen" title="Chọn file .json dữ liệu TB (chọn được nhiều file)">Mở file…</button><button class="btn" id="dlgSample" title="Đưa nội dung file data/du-lieu.json của tiện ích vào ô để Gộp vào / Thay toàn bộ">Lấy từ thư mục data</button><button class="btn" id="dlgRec" title="Xuất lại file của lần ghi thao tác gần nhất">Xuất bản ghi</button><span class="sp"></span><button class="btn" id="dlgClose2">Đóng</button></div>
      <div class="row"><span class="muted">Xóa:</span><button class="btn del" id="dlgDelOne" title="Xóa TB đang chọn ở ô trên cùng của bảng điền">TB đang chọn</button><button class="btn del" id="dlgDelAll" title="Xóa mọi TB trong tiện ích">Tất cả TB</button><button class="btn del" id="dlgDelRec" title="Xóa bản ghi thao tác đã ghi">Bản ghi thao tác</button></div>
      <div class="hint">Xóa chỉ xóa dữ liệu trong tiện ích (trên máy này), không đụng gì trên VBDLIS. Muốn có lại: dán JSON rồi “Gộp vào”, hoặc “Lấy từ thư mục data” rồi “Gộp vào”.</div>
      <div id="dlgMsg" class="hint"></div>`;
    d.style.top = ($('.hd').offsetHeight || 37) + 'px'; // không che thanh tiêu đề (nút –, × vẫn bấm được)
    pn.classList.add('dlgopen');
    pn.appendChild(d);
    // đang mở hộp này mà thả file lệch ra ngoài bảng → không để trình duyệt mở file (mất trang VBDLIS)
    const guard = (e) => {
      if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault();
    };
    document.addEventListener('dragover', guard, true);
    document.addEventListener('drop', guard, true);
    const closeDlg = () => {
      d.remove();
      pn.classList.remove('dlgopen');
      document.removeEventListener('dragover', guard, true);
      document.removeEventListener('drop', guard, true);
    };
    const fileInp = d.querySelector('#dlgFile');
    fileInp.addEventListener('change', async () => {
      if (S.running) {
        fileInp.value = '';
        return msg('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi nạp dữ liệu.', true);
      }
      try {
        const r = await importFiles(fileInp.files);
        msg(r.text, r.bad);
      } catch (err) {
        msg('Lỗi: ' + friendly(err), true);
      } finally {
        fileInp.value = ''; // chọn lại cùng file vẫn nạp được
      }
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDlg();
      }
    });
    setTimeout(() => d.querySelector('#dlgTxt').focus(), 0);
    const msg = (t, bad) => {
      const m = d.querySelector('#dlgMsg');
      m.textContent = t;
      m.className = 'hint ' + (bad ? 'bad' : 'ok');
    };
    d.addEventListener('click', async (e) => {
      const id = e.target.id;
      const txt = d.querySelector('#dlgTxt').value.trim();
      if (['dlgMerge', 'dlgReplace', 'dlgDelOne', 'dlgDelAll'].includes(id) && S.running) {
        msg('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi nạp / xóa dữ liệu.', true);
        return;
      }
      if (['dlgMerge', 'dlgReplace', 'dlgSample', 'dlgDelOne', 'dlgDelAll', 'dlgDelRec'].includes(id) && !isAlive()) {
        msg('Chưa lưu được: ' + DEAD_MSG + ' (Nội dung đã dán vẫn còn trong ô – sao chép lại trước khi mở bảng mới.)', true);
        return;
      }
      try {
        if (id === 'dlgClose' || id === 'dlgClose2') closeDlg();
        else if (id === 'dlgCopy') msg((await copyText(JSON.stringify(S.data, null, 2))) ? `Đã sao chép ${S.data.length} TB.` : 'Không sao chép được.');
        else if (id === 'dlgMerge' || id === 'dlgReplace') {
          if (!txt) return msg('Chưa dán dữ liệu.', true);
          const items = parseData(txt);
          if (id === 'dlgReplace' && !confirm(`Xóa toàn bộ ${S.data.length} TB hiện có và thay bằng ${items.length} TB vừa dán?`)) return;
          const r = await applyItems(items, id === 'dlgReplace');
          msg(r.text, r.bad);
        } else if (id === 'dlgOpen') {
          d.querySelector('#dlgFile').click();
        } else if (id === 'dlgRec') {
          const R = await recorder();
          if (!R) return msg('Không bật được bộ ghi thao tác trên trang này.', true);
          const i = await R.info();
          if (!i.has) return msg('Chưa có bản ghi thao tác nào – bấm nút ● trên thanh tiêu đề để ghi.', true);
          const res = await R.exportFile();
          msg(`Đã xuất “${res.name}” (${res.events} bước) vào thư mục Tải xuống.`);
        } else if (id === 'dlgDelOne') {
          const tb = curTB();
          if (!tb) return msg('Không còn TB nào.', true);
          const who = (tb.nguoiNop && tb.nguoiNop.hoTen) || (tb.chu && tb.chu[0] && tb.chu[0].hoTen) || '';
          if (!confirm(`Xóa TB ${tb.tb}${who ? ' – ' + who : ''} khỏi tiện ích?\n\nChỉ xóa trong tiện ích, không đụng gì trên VBDLIS.`)) return;
          await removeTbs([String(tb.tb)]);
          msg(`Đã xóa TB ${tb.tb}. Còn ${S.data.length} TB.`);
        } else if (id === 'dlgDelAll') {
          if (!S.data.length) return msg('Không còn TB nào.', true);
          if (!confirm(`Xóa TẤT CẢ ${S.data.length} TB khỏi tiện ích?\n\nChỉ xóa trong tiện ích, không đụng gì trên VBDLIS. Muốn có lại thì dán JSON hoặc bấm “Nạp mẫu”.`)) return;
          await removeTbs(null);
          msg('Đã xóa hết dữ liệu TB. Dán JSON rồi bấm “Gộp vào” (hoặc “Nạp mẫu”) để có dữ liệu mới.');
        } else if (id === 'dlgDelRec') {
          const R = await recorder();
          if (!R) return msg('Không mở được bộ ghi thao tác trên trang này.', true);
          const i = await R.info();
          if (i.on) return msg('Đang ghi thao tác – bấm nút ● để dừng (và xuất file) trước khi xóa.', true);
          if (!i.has) return msg('Không có bản ghi thao tác nào.', true);
          if (!confirm(i.exported ? 'Xóa bản ghi thao tác?' : 'Bản ghi thao tác CHƯA được xuất file. Vẫn xóa?')) return;
          await R.clear();
          msg('Đã xóa bản ghi thao tác.');
        } else if (id === 'dlgSample') {
          const r = await send({ type: 'vbdlis-sample' });
          if (!r || !r.ok) return msg('Thư mục data: ' + friendly((r && r.error) || 'không đọc được file data/du-lieu.json'), true);
          const raw = r.text != null ? r.text : JSON.stringify(r.data);
          let items;
          try {
            items = parseData(raw);
          } catch (e) {
            d.querySelector('#dlgTxt').value = raw; // để bạn thấy chỗ sai
            return msg('File data/du-lieu.json bị lỗi – ' + e.message, true);
          }
          d.querySelector('#dlgTxt').value = JSON.stringify(items, null, 2);
          if (!items.length) return msg('Thư mục data chưa có dữ liệu (chưa có file data/du-lieu.json). Kéo thả file .json vào bảng, bấm “Mở file…” hoặc dán JSON.', true);
          msg(`Đã đưa ${items.length} TB của file data/du-lieu.json vào ô. Bấm “Gộp vào” (hoặc “Thay toàn bộ”).`);
        }
      } catch (err) {
        msg('Lỗi: ' + friendly(err), true);
      }
    });
  }

  // ---------- ghi thao tác ----------
  // Bộ ghi (recorder.js) chạy cùng "thế giới" với bảng này → gọi thẳng window.__vbdlisRec
  async function recorder() {
    if (!window.__vbdlisRec) await send({ type: 'vbdlis-rec-inject' });
    return window.__vbdlisRec || null;
  }
  function updateRecBtn(on) {
    const b = $('#rec');
    if (!b) return;
    b.classList.toggle('on', !!on);
    b.title = on
      ? 'Đang ghi thao tác – bấm để DỪNG và xuất file'
      : 'Ghi thao tác: ghi lại những gì bạn làm trên VBDLIS rồi xuất ra file để gửi người hỗ trợ';
  }
  async function toggleRec() {
    const R = await recorder();
    if (!R) return setStatus('✗ Không bật được bộ ghi thao tác trên trang này (bấm Alt+Q mở lại bảng rồi thử lại).', true);
    const i = await R.info();
    if (i.on) {
      // đang ghi (ở tab này hoặc tab VBDLIS khác) → dừng hết rồi xuất file
      const res = await R.stopAndExport();
      updateRecBtn(false);
      setResult(
        `<div class="ok">✓ Đã dừng ghi và xuất file <b>${esc(res.name)}</b> (${res.events} bước, ${res.snapshots} ảnh chụp cấu trúc) vào thư mục <b>Tải xuống</b>.</div>` +
          (res.lost ? `<div class="warn">⚠ Có ${res.lost} bước không lưu được (bộ nhớ đầy?).</div>` : '') +
          `<div class="hint">Gửi file này cho người hỗ trợ. Không có mật khẩu; số CCCD/điện thoại đã được che bớt; file vẫn có tên, địa chỉ – chỉ gửi cho người cần.</div>`
      );
      return;
    }
    if (i.has && !i.exported && !confirm('Có bản ghi thao tác cũ chưa xuất file. Ghi mới sẽ xóa bản cũ – tiếp tục?')) return;
    await R.start();
    updateRecBtn(true);
    setResult(
      '<div class="warn">● Đang ghi thao tác.</div><div class="hint">Cứ làm việc bình thường trên VBDLIS (kể cả dùng nút của bảng này). Thấy chỗ nào sai thì bấm “+ Ghi chú” ở góc dưới trái để ghi lại. Xong bấm “■ Dừng &amp; xuất file” (góc dưới trái) hoặc bấm lại nút ● trên thanh tiêu đề.</div>'
    );
  }
  document.addEventListener('vbdlis-rec', (e) => updateRecBtn(e.detail && e.detail.on));

  // ---------- sự kiện ----------
  root.addEventListener('input', (e) => {
    const el = e.target;
    const p = el && el.dataset && el.dataset.path;
    const tb = curTB();
    if (p && tb) {
      setPath(tb, p, el.value);
      markDirty(tb);
    }
  });

  root.addEventListener('change', (e) => {
    // diện tích kiểu PDF "56,5" → "56.5" ngay khi rời ô
    const p = e.target.dataset && e.target.dataset.path;
    if (p && /\.dienTich(PL)?$/.test(p)) {
      const tb = curTB();
      const a = normArea(e.target.value);
      if (a.v && tb) {
        if (a.v !== e.target.value) setStatus(`Đã đổi diện tích “${e.target.value}” → ${a.v}`);
        e.target.value = a.v;
        setPath(tb, p, a.v);
        markDirty(tb);
      } else if (a.err) setStatus('✗ ' + a.err, true);
      return;
    }
    if (e.target.id === 'optThuaTN') {
      S.opts = { ...S.opts, thuaTN: e.target.value };
      safeSet({ tbOpts: S.opts });
      setStatus(e.target.value === 'tatca' ? '“Chạy cả TB” sẽ thêm TẤT CẢ các thửa ở bước tiếp nhận.' : '“Chạy cả TB” chỉ thêm thửa đầu ở bước tiếp nhận.');
      return;
    }
    if (e.target.id === 'tbSel') {
      if (S.running) return;
      S.cur = e.target.value;
      saveUi();
      setResult('');
      render();
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('.dlg')) return;
    if (b.id === 'runAll') {
      if (S.running && e.detail > 1) return; // lần bấm thứ 2 của bấm đúp → bỏ qua (không tự dừng)
      if (S.running) {
        S.stopReq = true;
        b.textContent = '… đang dừng';
      } else if (!isAlive()) setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      else runAll();
      return;
    }
    if (S.running && (b.dataset.fill || ['prev', 'next', 'scan', 'dataBtn', 'resetDone', 'dcApply', 'gtAdd'].includes(b.id))) {
      setStatus('Đang “Chạy cả TB” – bấm “■ Dừng” trước.', true);
      return;
    }
    if (S.busy && (b.dataset.fill || b.id === 'scan')) {
      setStatus('Đang điền – chờ xong đã.', true);
      return;
    }
    if (!isAlive() && b.id !== 'min' && b.id !== 'close') {
      setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      return;
    }
    const tb = curTB();
    if (b.dataset.tab) {
      S.tab = b.dataset.tab;
      saveUi();
      render();
    } else if (b.dataset.fill) {
      const map = { bienNhan: ['bienNhan', 'bn'], chu: ['chu', 'chu'], thua: ['thua', 'thua'], gt: ['giayTo', 'gt'] };
      const [section, prefix] = map[b.dataset.fill];
      const i = b.dataset.i != null ? parseInt(b.dataset.i, 10) : undefined;
      await doFill(section, i, i != null ? prefix + i : prefix);
    } else if (b.dataset.copy && tb) {
      const v = String(getPath(tb, b.dataset.copy) ?? '');
      const ok = await copyText(v);
      setStatus(ok ? `⧉ Đã sao chép: ${v}` : '✗ Không sao chép được', !ok);
    } else if (b.id === 'prev' || b.id === 'next') {
      const k = S.data.indexOf(tb) + (b.id === 'next' ? 1 : -1);
      if (S.data[k]) {
        S.cur = S.data[k].tb;
        saveUi();
        setResult('');
        render();
      }
    } else if (b.id === 'scan') await doScan();
    else if (b.id === 'copyScan') setResult(((await copyText(S.lastScan)) ? '<div class="ok">Đã sao chép kết quả quét.</div>' : '<div class="bad">Không sao chép được.</div>') + `<pre>${esc(S.lastScan)}</pre>`);
    else if (b.id === 'dataBtn') openData();
    else if (b.id === 'resetDone' && tb) {
      Object.keys(S.done).filter((k) => k.startsWith(tb.tb + '|')).forEach((k) => delete S.done[k]);
      saveUi();
      render();
    } else if (b.id === 'dcApply' && tb) {
      const v = $('#dcChung').value.trim();
      const th = $('#thChung').value.trim();
      const ng = $('#ngChung').value.trim();
      (tb.thua || []).forEach((t) => {
        if (v) t.diaChi = v;
        if (th) t.thoiHan = th;
        if (ng) t.nguonGoc = ng;
      });
      markDirty(tb);
      render();
      const what = [v && 'địa chỉ', th && 'thời hạn “' + esc(th) + '”', ng && 'nguồn gốc'].filter(Boolean).join(', ');
      setResult(`<div class="ok">Đã đặt ${what || 'gì (các ô đều trống)'} cho ${(tb.thua || []).length} thửa.</div>`);
    } else if (b.id === 'gtAdd' && tb) {
      (tb.giayTo = tb.giayTo || []).push('');
      markDirty(tb);
      render();
    } else if (b.id === 'rec') {
      if (e.detail > 1 || S.recBusy) return; // bấm đúp / đang bật-tắt → bỏ qua
      S.recBusy = true;
      b.disabled = true;
      try {
        await toggleRec();
      } catch (err) {
        setResult(`<div class="bad">✗ Ghi thao tác: ${esc(friendly(err))}</div>`);
      } finally {
        S.recBusy = false;
        b.disabled = false;
      }
    } else if (b.id === 'min') {
      pn.classList.toggle('min');
      b.textContent = pn.classList.contains('min') ? '+' : '–';
    } else if (b.id === 'close') {
      if (S.running) S.stopReq = true; // ẩn bảng khi đang chạy → dừng luôn
      host.style.display = 'none';
    }
  });

  // kéo bảng bằng thanh tiêu đề
  $('.hd').addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    const r = host.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const mv = (ev) => {
      host.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + 'px';
      host.style.right = 'auto';
    };
    const up = () => {
      removeEventListener('mousemove', mv, true);
      removeEventListener('mouseup', up, true);
      saveBox();
    };
    addEventListener('mousemove', mv, true);
    addEventListener('mouseup', up, true);
    e.preventDefault();
  });

  // ---------- kéo góc dưới để phóng to / thu nhỏ bảng (nhớ cỡ và vị trí) ----------
  function applyBox(b) {
    if (!b) return;
    if (b.w) pn.style.setProperty('--w', b.w + 'px');
    if (b.h) {
      pn.style.setProperty('--h', b.h + 'px');
      pn.style.setProperty('--mh', 'calc(100vh - 8px)');
    }
    if (b.left != null && b.top != null) {
      host.style.left = Math.max(0, Math.min(innerWidth - 120, b.left)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - 40, b.top)) + 'px';
      host.style.right = 'auto';
    }
  }
  function saveBox() {
    const r = host.getBoundingClientRect();
    const b = { left: Math.round(r.left), top: Math.round(r.top) };
    const w = parseInt(pn.style.getPropertyValue('--w'), 10);
    const h = parseInt(pn.style.getPropertyValue('--h'), 10);
    if (w) b.w = w;
    if (h) b.h = h;
    safeSet({ tbBox: b });
  }
  root.querySelectorAll('.rz').forEach((g) => {
    g.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fromLeft = g.classList.contains('l');
      const r0 = host.getBoundingClientRect();
      const p0 = pn.getBoundingClientRect();
      host.style.left = r0.left + 'px';
      host.style.top = r0.top + 'px';
      host.style.right = 'auto';
      const x0 = e.clientX;
      const y0 = e.clientY;
      const mv = (ev) => {
        const dx = ev.clientX - x0;
        const dy = ev.clientY - y0;
        const maxW = fromLeft ? r0.left + p0.width - 4 : innerWidth - r0.left - 4;
        const w = Math.round(Math.max(300, Math.min(maxW, fromLeft ? p0.width - dx : p0.width + dx)));
        const h = Math.round(Math.max(200, Math.min(innerHeight - r0.top - 4, p0.height + dy)));
        pn.style.setProperty('--w', w + 'px');
        pn.style.setProperty('--h', h + 'px');
        pn.style.setProperty('--mh', 'calc(100vh - 8px)');
        if (fromLeft) host.style.left = Math.max(0, r0.left + (p0.width - w)) + 'px';
      };
      const up = () => {
        removeEventListener('mousemove', mv, true);
        removeEventListener('mouseup', up, true);
        saveBox();
      };
      addEventListener('mousemove', mv, true);
      addEventListener('mouseup', up, true);
    });
    // bấm đúp → về cỡ mặc định
    g.addEventListener('dblclick', () => {
      ['--w', '--h', '--mh'].forEach((p) => pn.style.removeProperty(p));
      saveBox();
    });
  });

  // ---------- thả file .json vào bảng → nạp dữ liệu TB ----------
  const hasFiles = (e) => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  pn.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    pn.classList.add('drop');
  });
  pn.addEventListener('dragleave', (e) => {
    if (!pn.contains(e.relatedTarget)) pn.classList.remove('drop');
  });
  pn.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    pn.classList.remove('drop');
    if (S.running) return setStatus('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi nạp dữ liệu.', true);
    if (!isAlive()) return setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
    try {
      const r = await importFiles(e.dataTransfer.files);
      setResult(`<div class="${r.bad ? 'bad' : 'ok'}">${r.bad ? '✗' : '✓'} ${esc(r.text)}</div>`);
    } catch (err) {
      setResult(`<div class="bad">✗ ${esc(friendly(err))}</div>`);
    }
  });

  // ---------- khởi động ----------
  (async () => {
    const r = await store.get(['tbData', 'tbDone', 'tbCur', 'tbTab', 'tbOpts', 'tbBox']);
    S.opts = r.tbOpts || {};
    applyBox(r.tbBox);
    S.data = (r.tbData || []).sort(byTb);
    S.done = r.tbDone || {};
    S.cur = r.tbCur;
    S.tab = TABS[r.tbTab] ? r.tbTab : 'bn';
    let sync = null;
    try {
      sync = await syncFromFolder();
    } catch (e) {}
    if (sync && sync.data) S.data = sync.data.slice().sort(byTb);
    if (!S.data.some((x) => String(x.tb) === String(S.cur)) && S.data.length) S.cur = S.data[S.data.length - 1].tb;
    render();
    if (sync && sync.err) setResult(`<div class="bad">✗ ${esc(sync.err)}</div>`);
    else if (sync && r.tbData !== undefined && (sync.added.length || sync.updated.length || sync.kept.length)) {
      setResult(
        '<div class="sum">Thư mục data (du-lieu.json)</div>' +
          (sync.added.length ? `<div class="ok">✓ Thêm mới: TB ${esc(sync.added.join(', '))}</div>` : '') +
          (sync.updated.length ? `<div class="ok">✓ Cập nhật: TB ${esc(sync.updated.join(', '))}</div>` : '') +
          (sync.kept.length
            ? `<div class="warn">• Giữ bản bạn đã sửa trong bảng: TB ${esc(sync.kept.join(', '))} (muốn lấy bản của file: Dữ liệu → Lấy từ thư mục data → Gộp vào)</div>`
            : '')
      );
    }
    try {
      if (window.__vbdlisRec) updateRecBtn((await window.__vbdlisRec.info()).on);
    } catch (e) {}
  })();
})();
