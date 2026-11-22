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
  const PANEL_VERSION = '1.11.2'; // tăng mỗi lần sửa bảng – bảng khác phiên bản sẽ bị thay bằng bảng mới
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
  // stage: tiến độ từng TB trên VBDLIS { "<tb>": { tn: lúc tiếp nhận, tnBy, don: lúc nhập đơn xong, donBy, lech: số ô lệch } }
  // armed: TB vừa chạy xong, đang chờ trang báo “Lưu … thành công” để tự đánh dấu
  const S = { data: [], cur: null, tab: 'bn', done: {}, stage: {}, armed: null, lastScan: '', busy: false, running: false, pendingData: null, opts: {} };
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
  // dấu ✓ từng mục của một TB (không đụng tiến độ tiếp nhận / nhập đơn).
  // Giữ dấu “…|pending” (lần trước đã mở cửa sổ mà chưa thấy vào bảng/đơn → hỏi lại trước khi mở lại, tránh nhập trùng)
  const clearDone = (id) => {
    Object.keys(S.done)
      .filter((k) => k.startsWith(String(id) + '|') && !k.endsWith('|pending'))
      .forEach((k) => delete S.done[k]);
  };

  // ---------- tiến độ từng TB (chưa làm / đã tiếp nhận / xong) ----------
  // ghi tiến độ của MỘT TB lên bản mới nhất trong bộ nhớ (tab VBDLIS khác có thể vừa ghi TB khác);
  // các lần ghi nối đuôi nhau (không chồng lên nhau trong cùng tab)
  let stageChain = Promise.resolve();
  const stagePending = {}; // TB → số lần ghi đang chờ (onChanged không được ghi đè các TB này)
  const saveStage = (id) => {
    const k = id == null ? null : String(id);
    if (k) stagePending[k] = (stagePending[k] || 0) + 1;
    stageChain = stageChain
      .then(async () => {
        if (!k) return store.set({ tbStage: S.stage });
        const all = (await store.get('tbStage')).tbStage || {};
        if (S.stage[k]) all[k] = S.stage[k];
        else delete all[k];
        await store.set({ tbStage: all }); // onChanged đưa phần tab khác vừa ghi vào S.stage
      })
      .catch(() => {})
      .then(() => {
        if (k && !--stagePending[k]) delete stagePending[k];
      });
    return stageChain;
  };
  const stageOf = (tb) => {
    const s = tb && S.stage[String(tb.tb)];
    return s && s.don ? 'don' : s && s.hoan ? 'hoan' : s && s.tn ? 'tn' : 'chua';
  };
  const STAGE_ICON = { chua: '○', tn: '◐', don: '✓', hoan: '⏸' };
  const STAGE_TEXT = { chua: 'Chưa làm', tn: 'Đã tiếp nhận', don: 'Xong', hoan: 'Tạm hoãn' };
  const BY_TEXT = { auto: 'tự ghi nhận', tay: 'đánh dấu tay', don: 'suy ra từ bước nhập đơn' };
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const fmtIso = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  // stage: 'chua' | 'tn' | 'don' | 'hoan'; by: 'auto' | 'tay' | 'don'
  // 'hoan' (tạm hoãn) giữ dấu tiếp nhận nếu có; đánh dấu khác thì bỏ hoãn. “Đã xem ghi chú” (ack) luôn được giữ.
  function markStage(id, stage, by, extra) {
    id = String(id);
    const now = Date.now();
    const s = { ...(S.stage[id] || {}) };
    if (stage === 'chua') {
      ['tn', 'tnBy', 'don', 'donBy', 'lech', 'hoan'].forEach((k) => delete s[k]);
    } else if (stage === 'hoan') {
      delete s.don;
      delete s.donBy;
      delete s.lech;
      s.hoan = { at: now, lyDo: (extra && extra.lyDo) || '' };
    } else {
      delete s.hoan;
      if (!s.tn) {
        s.tn = now;
        s.tnBy = by;
      }
      if (stage === 'don') {
        if (!s.don) {
          s.don = now;
          s.donBy = by;
        }
        if (extra && 'lech' in extra) s.lech = extra.lech;
      } else {
        delete s.don;
        delete s.donBy;
        delete s.lech;
      }
    }
    if (Object.keys(s).length) S.stage[id] = s;
    else delete S.stage[id];
    if (S.armed && S.armed.tb === id && by === 'tay') S.armed = null; // bạn tự đổi → bỏ chờ tự ghi nhận
    saveStage(id);
    renderTop();
  }
  // các TB có chung thửa (cùng số tờ + số thửa) – dễ nhập trùng 2 lần
  function dupMap() {
    const by = new Map();
    S.data.forEach((x) =>
      (x.thua || []).forEach((t) => {
        if (!String(t.soThua || '').trim() || !String(t.soTo || '').trim()) return;
        const k = idNorm(t.soTo) + '|' + idNorm(t.soThua);
        const a = by.get(k) || [];
        if (!a.includes(String(x.tb))) a.push(String(x.tb));
        by.set(k, a);
      })
    );
    const out = new Map();
    for (const [k, ids] of by) {
      if (ids.length < 2) continue;
      const [to, th] = k.split('|');
      ids.forEach((id) => {
        const arr = out.get(id) || [];
        ids.filter((o) => o !== id).forEach((o) => arr.push({ tb: o, soThua: th, soTo: to }));
        out.set(id, arr);
      });
    }
    return out;
  }
  const dupText = (list) => {
    const g = new Map();
    list.forEach((d) => g.set(d.tb, (g.get(d.tb) || []).concat(`${d.soThua}/${d.soTo}`)));
    return [...g].map(([tb, ts]) => `TB ${tb} (thửa ${ts.join(', ')})`).join('; ');
  };

  // ---------- hỏi bạn trước khi làm tiếp (nút riêng – bấm đúp “Chạy cả TB” không lọt qua) ----------
  // lỗi kèm nút: “Chạy cả TB” dừng, dòng báo có nút để bạn chủ động xác nhận rồi chạy lại
  const ask = (msg, html) => {
    const e = new Error(msg);
    e.actHtml = html;
    return e;
  };
  const actBtn = (act, tb, label, extra = '') =>
    `<button class="btn pri" data-act="${act}" data-tb="${esc(tb)}"${extra}>${esc(label)}</button>`;
  // xác nhận dùng một lần, chỉ cho đúng TB, trong 2 phút
  const consume = (key, tb) => {
    const t = S[key];
    S[key] = null;
    return !!t && t.tb === String(tb) && Date.now() - t.at < 120000;
  };

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
.result{flex:none;height:var(--rh,auto);max-height:var(--rmh,38vh);overflow:auto;background:#f8fafc;padding:7px 10px}
.result:empty{display:none}
.pn.min .result{display:none}
.split{flex:none;height:11px;cursor:ns-resize;background:#e2e8f0;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:10px;line-height:1;letter-spacing:3px;user-select:none}
.split:hover,.split.drag{background:#99f6e4;color:#0f766e}
.pn.min .split{display:none}
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
.prog{font-size:11.5px}.prog .btn{padding:2px 7px}
#stageInfo{flex:none;font-size:11px;max-width:45%;text-align:right}
.evt{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:5px 8px;margin-bottom:6px}
.evt.warn{background:#fffbeb;border-color:#fde68a}
.evt .btn{padding:1px 7px;margin-left:4px}
.sh{width:100%;border-collapse:collapse;font-size:11.5px;margin:4px 0;background:#fff}
.sh td,.sh th{border:1px solid #e2e8f0;padding:2px 4px;text-align:left;vertical-align:top;word-break:break-word}
.sh th{background:#f1f5f9;color:#475569;font-weight:600;position:sticky;top:0}
.sh tr.bad td{background:#fef2f2;color:#b91c1c}.sh tr.gap td{background:#fffbeb;color:#92400e}.sh tr.na td{color:#64748b}
.sh tr[data-tb]{cursor:pointer}.sh tr[data-tb]:hover td{background:#f0fdfa}.sh tr.cur td{font-weight:600}
details>summary{cursor:pointer;color:#0f766e;margin:2px 0}
.pgf .btn.on{background:#0f766e;border-color:#0f766e;color:#fff}
.pgl{flex:1;overflow:auto;min-height:120px;border:1px solid #e2e8f0;border-radius:6px}
.opt{display:flex;gap:6px;align-items:flex-start;margin:4px 0;cursor:pointer;color:#334155}.opt input{width:auto;margin:2px 0 0;flex:none}
.days{font-size:11.5px;color:#475569}.days b{color:#0f766e}
.ck{width:100%}.ck td:last-child{width:22px;text-align:center}
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
    <div class="row"><span class="muted" style="flex:none">Trạng thái:</span><select id="tbStage" title="Tiện ích tự đánh dấu khi trang báo “Lưu hồ sơ thành công” / “Lưu đơn đăng ký thành công” sau khi bạn chạy “Chạy cả TB”. Sai thì sửa tay ở đây."><option value="chua">○ Chưa làm</option><option value="tn">◐ Đã tiếp nhận – chưa nhập đơn</option><option value="don">✓ Xong – đã nhập đơn</option><option value="hoan">⏸ Tạm hoãn (chưa nhập được)</option></select><span id="stageInfo" class="muted"></span></div>
    <div class="row prog"><span id="progTxt" class="muted"></span><span class="sp"></span><button class="btn" id="nextTodo" title="Chọn TB chưa tiếp nhận tiếp theo">→ TB chưa làm</button><button class="btn" id="progList" title="Bảng tiến độ tất cả TB – lọc TB chưa xong, xuất ra Excel">☰ Tiến độ</button></div>
    <div class="evt" id="evt" style="display:none"></div>
    <div class="row"><button class="btn" id="scan" title="Kiểm tra tiện ích còn tìm thấy đủ ô, nút cần dùng trên màn hình đang mở (khi VBDLIS đổi giao diện) – kèm danh sách nhãn → ô">Kiểm tra trang</button><button class="btn" id="dataBtn">Dữ liệu</button><button class="btn run" id="runAll" title="Màn hình Tiếp nhận hồ sơ: chọn Phường/Xã, quy trình, Số biên nhận, thêm thửa đầu, điền người nộp. Cửa sổ Nhập đơn đăng ký: chọn Điều kiện cấp giấy, tích Đăng ký lần đầu, rồi lần lượt tự bấm Thêm → Cá nhân / Thửa đất và điền từng chủ, từng thửa. Bạn tự bấm mọi nút Lưu.">▶ Chạy cả TB</button><span class="sp"></span><button class="btn" id="resetDone" title="Xóa dấu ✓ của TB này">Xóa dấu ✓</button></div>
    <div class="note" id="note" style="display:none"></div>
    <div class="tabs">
      <button data-tab="bn">Biên nhận</button><button data-tab="chu">Chủ SD</button><button data-tab="thua">Thửa đất</button><button data-tab="gt">Giấy tờ</button>
    </div>
    <div id="content"></div>
  </div>
  <div id="split" class="split" title="Kéo lên / xuống để đổi chiều cao phần nhật ký bên dưới (bấm đúp: về mặc định)" style="display:none">•••</div>
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
      </div>
      <div class="card">
        <div class="ct">Khi “▶ Chạy cả TB” dừng chờ bạn</div>
        <label class="opt"><input type="checkbox" id="optAmBao"${S.opts.amBao !== false ? ' checked' : ''}> Kêu “ting” và nháy tên tab (để bạn làm việc khác trong lúc VBDLIS chạy chậm)</label>
        <label class="opt"><input type="checkbox" id="optEnter"${S.opts.enterLuu !== false ? ' checked' : ''}> Mọi ô đã điền khớp dữ liệu thì đặt sẵn con trỏ ở nút “Lưu” của cửa sổ: kiểm tra xong chỉ cần nhấn Enter (tiện ích vẫn không tự bấm)</label>
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
        <div class="ct">Chủ ${i + 1}: ${esc(p.hoTen)} ${p.tuyChon ? '<span class="tag">người dùng chung</span>' : ''}<span class="sp"></span>${isDone(tb, 'chu' + i) ? '<span class="chk">✓</span>' : ''}</div>
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

  const whoOf = (x) => (x && ((x.nguoiNop && x.nguoiNop.hoTen) || (x.chu && x.chu[0] && x.chu[0].hoTen))) || '';
  // phần đầu bảng: danh sách TB (kèm ○ ◐ ✓), trạng thái TB đang chọn, số đếm tiến độ, ghi chú / cảnh báo trùng thửa
  function renderTop() {
    const tb = curTB();
    const dups = dupMap();
    const sel = $('#tbSel');
    sel.innerHTML = S.data.length
      ? S.data
          .map(
            (x) =>
              `<option value="${esc(x.tb)}">${STAGE_ICON[stageOf(x)]} TB ${esc(x.tb)} – ${esc(whoOf(x))} (${(x.thua || []).length} thửa)${dups.has(String(x.tb)) ? ' ⚠ trùng thửa' : ''}</option>`
          )
          .join('')
      : '<option>(chưa có dữ liệu)</option>';
    if (tb) sel.value = String(tb.tb);
    const cnt = { chua: 0, tn: 0, don: 0, hoan: 0 };
    S.data.forEach((x) => cnt[stageOf(x)]++);
    $('#progTxt').textContent = S.data.length
      ? `✓ ${cnt.don} xong · ◐ ${cnt.tn} tiếp nhận` + (cnt.hoan ? ` · ⏸ ${cnt.hoan} hoãn` : '') + ` · ○ ${cnt.chua} chưa làm`
      : '';
    const ss = $('#tbStage');
    ss.value = tb ? stageOf(tb) : 'chua';
    ss.disabled = !tb || !!S.running;
    const s = tb && S.stage[String(tb.tb)];
    const info = s
      ? [
          s.hoan && `hoãn: ${s.hoan.lyDo || 'không ghi lý do'}`,
          s.tn && `tiếp nhận ${fmtTime(s.tn)}`,
          s.don && `nhập đơn ${fmtTime(s.don)}`,
          s.lech ? `⚠ lệch ${s.lech} ô` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
    $('#stageInfo').textContent = info;
    $('#stageInfo').title = s
      ? [
          s.hoan && `Tạm hoãn từ ${fmtIso(s.hoan.at)}: ${s.hoan.lyDo || ''}`,
          s.tn && `Tiếp nhận: ${fmtIso(s.tn)} (${BY_TEXT[s.tnBy] || s.tnBy || ''})`,
          s.don && `Nhập đơn: ${fmtIso(s.don)} (${BY_TEXT[s.donBy] || s.donBy || ''})`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';
    const note = $('#note');
    const lines = [];
    if (tb && tb.ghiChu) lines.push('⚠ ' + tb.ghiChu);
    const d = tb && dups.get(String(tb.tb));
    if (d) lines.push(`⚠ Trùng thửa với ${dupText(d)} – có thể là TB trùng, kiểm tra kẻo nhập 2 lần.`);
    note.style.display = lines.length ? '' : 'none';
    note.textContent = lines.join('\n');
  }
  // dòng báo của tiện ích (vd. vừa tự ghi nhận TB đã tiếp nhận) – giữ tới khi đổi TB / chạy lại
  function setEvt(html, warn) {
    const e = $('#evt');
    e.innerHTML = html || '';
    e.className = 'evt' + (warn ? ' warn' : '');
    e.style.display = html ? '' : 'none';
  }
  // ---------- báo khi tiện ích cần bạn: tiếng “ting” + nháy tên tab (khi bạn đang ở cửa sổ khác) ----------
  const ATT = { ctx: null, timer: null, title: null };
  // trình duyệt chỉ cho phát tiếng sau khi bạn bấm → chuẩn bị ngay lúc bạn bấm “Chạy cả TB”
  function audioReady() {
    if (S.opts.amBao === false) return;
    try {
      ATT.ctx = ATT.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ATT.ctx.state === 'suspended') ATT.ctx.resume();
    } catch (e) {}
  }
  function beep(kind) {
    if (S.opts.amBao === false || !ATT.ctx) return;
    try {
      const c = ATT.ctx;
      const t0 = c.currentTime + 0.02;
      (kind === 'bad' ? [523, 392] : [880, 1175]).forEach((hz, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = hz;
        const s = t0 + i * 0.17;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.22, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.15);
        o.connect(g).connect(c.destination);
        o.start(s);
        o.stop(s + 0.16);
      });
    } catch (e) {}
  }
  function stopNeed() {
    clearInterval(ATT.timer);
    ATT.timer = null;
    if (ATT.title != null) {
      document.title = ATT.title;
      ATT.title = null;
    }
  }
  // bắt đầu chờ bạn: kêu 1 lần; bạn đang ở tab / cửa sổ khác thì tên tab nháy cho tới khi bạn quay lại hoặc hết chờ
  function needYou(text, kind) {
    if (S.opts.amBao === false) return;
    beep(kind);
    clearInterval(ATT.timer);
    if (ATT.title == null) ATT.title = document.title;
    let on = false;
    const t0 = Date.now();
    ATT.timer = setInterval(() => {
      if (!host.isConnected || Date.now() - t0 > 30 * 60 * 1000) return stopNeed();
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        if (on) document.title = ATT.title;
        on = false;
        return;
      }
      on = !on;
      document.title = on ? `⏸ ${text}` : ATT.title;
    }, 1000);
  }

  // TB chưa tiếp nhận tiếp theo (sau TB đang chọn, hết danh sách thì quay lại đầu)
  function nextTodo() {
    const k0 = S.data.indexOf(curTB());
    for (let j = 1; j <= S.data.length; j++) {
      const x = S.data[(k0 + j) % S.data.length];
      if (x && stageOf(x) === 'chua' && x !== curTB()) return x;
    }
    return null;
  }

  function render() {
    const bd = $('.bd');
    const scroll = bd.scrollTop;
    const tb = curTB();
    renderTop();
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
    $('#content').innerHTML = tb ? TABS[S.tab](tb) : '<p class="muted">Chưa có dữ liệu. Bấm “Dữ liệu” để dán dữ liệu TB.</p>';
    bd.scrollTop = scroll;
    if (S.running) applyRunLock();
  }

  function setResult(html) {
    $('#result').innerHTML = html;
    $('#split').style.display = html ? '' : 'none'; // thanh kéo chỉ hiện khi có nhật ký
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

  // “Kiểm tra trang”: tiện ích còn tìm thấy đủ ô / nút cần dùng trên màn hình đang mở không
  // (VBDLIS đổi giao diện → biết ngay, khỏi điền thiếu mà không hay). Kèm danh sách nhãn → ô để gửi người hỗ trợ.
  async function doScan() {
    if (S.busy) return;
    S.busy = true;
    try {
      setResult('<div class="muted">Đang kiểm tra màn hình…</div>');
      const pr = await send({ type: 'vbdlis-act', action: 'probe' });
      const resp = await send({ type: 'vbdlis-scan' });
      if (!resp || !resp.ok) {
        setResult(`<div class="bad">✗ ${esc(friendly((resp && resp.error) || 'Không quét được.'))}</div>`);
        return;
      }
      const scanText = (resp.frames || [])
        .filter((f) => f && f.items && f.items.length)
        .map(
          (f) =>
            `[${f.scopeName}] ${f.frame}\n` +
            f.items.map((it) => `${it.label} → ${it.control}${it.value ? ` = "${it.value}"` : ''}`).join('\n')
        )
        .join('\n\n');
      const frames = ((pr && pr.ok && pr.frames) || []).filter((f) => f && f.screen);
      const p = frames.filter((f) => f.known).sort((a, b) => b.items.length - a.items.length)[0] || null;
      let html = '';
      let probeText = '';
      if (p) {
        const need = p.items.filter((x) => !x.optional);
        const okN = need.filter((x) => x.ok).length;
        const opt = p.items.filter((x) => x.optional);
        const allOk = okN === need.length;
        html +=
          `<div class="sum">Kiểm tra tiện ích – ${esc(p.screen)}</div>` +
          `<div class="${allOk ? 'ok' : 'bad'}">${allOk ? '✓' : '✗'} Tìm thấy ${okN}/${need.length} ô, nút tiện ích cần` +
          (opt.length ? ` · ${opt.filter((x) => x.ok).length}/${opt.length} ô không bắt buộc` : '') +
          `</div><table class="sh ck">${p.items
            .map(
              (x) =>
                `<tr class="${x.ok ? '' : x.optional ? 'na' : 'bad'}"><td>${esc(x.name)}${x.optional ? ' <span class="muted">(không bắt buộc)</span>' : ''}${
                  x.ok ? '' : ` <span class="muted">– ${esc(x.why)}</span>`
                }</td><td>${x.ok ? '✓' : x.optional ? '•' : '✗'}</td></tr>`
            )
            .join('')}</table>` +
          (allOk
            ? '<div class="hint">Mọi thứ tiện ích cần trên màn hình này đều còn – điền được bình thường.</div>'
            : '<div class="hint">VBDLIS có thể vừa đổi giao diện: ô ✗ tiện ích sẽ không điền được (sẽ báo ✗ khi chạy). Bấm “Sao chép kết quả” rồi gửi cho Claude để chỉnh.</div>');
        probeText = `Kiểm tra tiện ích – ${p.screen}\n` + p.items.map((x) => `${x.ok ? '✓' : x.optional ? '•' : '✗'} ${x.name}${x.ok ? '' : ' – ' + x.why}`).join('\n');
      } else
        html +=
          '<div class="sum">Kiểm tra tiện ích</div><div class="muted">Màn hình đang mở không phải màn hình tiện ích điền. Mở màn hình Tiếp nhận hồ sơ, cửa sổ Nhập đơn đăng ký hoặc cửa sổ thửa đất / cá nhân rồi bấm lại.</div>';
      S.lastScan = [probeText, scanText || '(không thấy ô nhập nào)'].filter(Boolean).join('\n\n');
      setResult(
        html +
          `<details><summary>Nhãn → ô nhập tiện ích nhìn thấy (gửi người hỗ trợ khi cần chỉnh)</summary><pre>${esc(scanText || '(không thấy ô nhập nào)')}</pre></details><button class="btn" id="copyScan">Sao chép kết quả</button>`
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
  const ARM_MS = 60 * 60 * 1000; // chờ trang báo “Lưu … thành công” tối đa 1 giờ sau khi chạy xong

  // ---------- đọc cây Chủ sử dụng / Thửa đất của cửa sổ “Nhập đơn đăng ký” ----------
  // VBDLIS ghi: “Bà: Nguyễn Thị Loan - Năm sinh:1957 - Địa chỉ: … - Số CCCD:027…”
  //             “22 (231) - Diện tích: 78.1 m² - Địa chỉ: …” (con: “LUC: - Số thứ tự:1 - Diện tích:78.1 m² - Thời hạn: …”)
  const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');
  // so họ tên: không phân biệt hoa/thường, GIỮ dấu (Cừ ≠ Cử) nhưng không câu nệ chỗ đặt dấu thanh
  // (Thủy = Thuỷ, Hòa = Hoà, Thúy = Thuý): mỗi tiếng → chữ không dấu thanh + dấu thanh của tiếng đó
  const nameFold = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
  const TONE_MARKS = /[̣̀́̃̉]/g; // huyền, sắc, ngã, hỏi, nặng
  const toneFold = (s) =>
    nameFold(s)
      .normalize('NFD')
      .split(' ')
      .map((w) => w.replace(TONE_MARKS, '').normalize('NFC') + (w.match(TONE_MARKS) || []).sort().join(''))
      .join(' ');
  function parseDon(f) {
    const chu = [];
    for (const n of (f && f.chu) || []) {
      const t = String(n.text || '').normalize('NFC');
      // “Bà: …” ở đầu (có thể có dấu / ký tự lạ đứng trước, vd. “: Bà: …”); “Ông/Bà: …” = chưa chọn giới tính
      const hu = /^[^\p{L}]*(?:ông|bà)\s*\/\s*(?:ông|bà)\s*:\s*/iu.exec(t);
      const hm = hu ? null : /^[^\p{L}]*(ông|bà|anh|chị|cô|bác)\s*:\s*/iu.exec(t);
      const nsm = /năm sinh\s*:?\s*(\d{4})/i.exec(t);
      const nsLabel = /năm sinh\s*:/i.test(t); // có nhãn mà không có năm = ô Năm sinh bị bỏ trống
      if (!hu && !hm && !nsLabel) continue; // nút nhóm (“Cá nhân -…”), chữ của nút bấm…
      const hd = hu || hm;
      const rest = hd ? t.slice(hd.index + hd[0].length) : t.replace(/^[^\p{L}]+/u, '');
      const ID_LABEL = /số\s*(?:cccd|cmnd|cc|căn cước(?:\s+công dân)?|giấy tờ(?:\s+tùy thân)?|định danh(?:\s+cá nhân)?|hộ chiếu)\s*:/i;
      const idm =
        /số\s*(?:cccd|cmnd|cc|căn cước(?:\s+công dân)?|giấy tờ(?:\s+tùy thân)?|định danh(?:\s+cá nhân)?|hộ chiếu)\s*:?\s*(\d{9,12})(?!\d)/i.exec(t) ||
        /(?:^|\D)(\d{12}|\d{9})(?!\d)/.exec(t);
      const dcm = /địa chỉ\s*:\s*(.*?)(?:\s+-\s+số\s|$)/i.exec(t);
      const h = hm ? norm(hm[1]) : '';
      chu.push({
        text: t,
        name: rest.split(/\s+-\s+/)[0].trim(),
        namSinh: nsm ? nsm[1] : '',
        nsLabel,
        gender: hu ? 'unset' : h === 'ong' || h === 'anh' || h === 'bac' ? 'Nam' : h === 'ba' || h === 'chi' || h === 'co' ? 'Nữ' : '',
        id: idm ? idm[1] : '',
        idLabel: ID_LABEL.test(t),
        diaChi: dcm ? dcm[1].trim() : '',
      });
    }
    const thua = [];
    let last = null;
    for (const n of (f && f.thua) || []) {
      const t = String(n.text || '').normalize('NFC').replace(/^[^\p{L}\d]+/u, ''); // bỏ dấu / ký tự lạ ở đầu
      // dòng mục đích sử dụng của thửa ngay trên (con trong cây, hoặc dòng sau nếu cây phẳng)
      const pm = /^([A-ZĐ]{2,5}(?:\s*[+,]\s*[A-ZĐ]{2,5})*)\s*:\s*-?\s*(.*)$/.exec(t);
      if (pm && last && (n.level > last.level || /số thứ tự|diện tích|thời hạn/i.test(pm[2]))) {
        const am = /diện tích\s*:?\s*([\d.,]+)/i.exec(pm[2]);
        const thm = /thời hạn[^:]*:\s*(.+?)(?:\s+-\s+|$)/i.exec(pm[2]);
        last.purposes.push({ code: pm[1].replace(/\s+/g, ''), area: am ? am[1] : '', thoiHan: thm ? thm[1].trim() : '' });
        continue;
      }
      const m = /^(?:thửa(?:\s+đất)?(?:\s+số)?\s*)?([0-9A-Za-z/.-]+)\s*\(\s*([0-9A-Za-z/.-]+)\s*\)\s*(?:-|$)/i.exec(t);
      if (!m) continue;
      const am = /diện tích\s*:?\s*([\d.,]+)/i.exec(t);
      const dcm = /địa chỉ\s*:\s*(.*)$/i.exec(t);
      last = { text: t, level: n.level || 0, soThua: m[1], soTo: m[2], key: idNorm(m[2]) + '|' + idNorm(m[1]), area: am ? am[1] : '', diaChi: dcm ? dcm[1].trim() : '', purposes: [] };
      thua.push(last);
    }
    return { chu, thua };
  }
  const chuMatch = (node, p) => {
    const d = digitsOf(p.soGiayTo);
    if (node.id && d.length >= 9) return node.id === d;
    return !!node.name && norm(node.name) === norm(p.hoTen) && (!node.namSinh || !p.namSinh || String(p.namSinh) === node.namSinh);
  };
  const thuaKey = (t) => idNorm(t.soTo) + '|' + idNorm(t.soThua);
  // điểm khớp của một TB với đơn đang mở (thửa nặng gấp đôi chủ; mục lạ trừ điểm)
  function scoreTb(tb, page) {
    const keys = new Set((tb.thua || []).map(thuaKey));
    const chu = tb.chu || [];
    const forT = page.thua.filter((t) => !keys.has(t.key));
    const forC = page.chu.filter((c) => !chu.some((p) => chuMatch(c, p)));
    const hitT = page.thua.length - forT.length;
    const hitC = page.chu.length - forC.length;
    return { tb, hitT, hitC, forT, forC, hits: 2 * hitT + hitC, score: 2 * hitT + hitC - 2 * forT.length - forC.length };
  }
  const pageDesc = (page) =>
    [page.thua.length && `thửa ${page.thua.map((t) => `${t.soThua}/${t.soTo}`).join(', ')}`, page.chu.length && `chủ ${page.chu.map((c) => c.name).join(', ')}`]
      .filter(Boolean)
      .join('; ');
  // TB nào khớp đơn đang mở.
  // - Đơn có thửa → chỉ TB có ít nhất 1 thửa trùng mới tính (một người có thể đứng tên nhiều TB, trùng chủ thôi chưa đủ).
  // - Một TB khớp nhất → dùng TB đó (khác TB đang chọn thì tự chọn).
  // - Nhiều TB khớp như nhau → có TB đang chọn trong đó thì trả tie (hỏi bạn xác nhận), không thì báo lỗi.
  function matchTb(page, tbSel) {
    let all = S.data.map((x) => scoreTb(x, page)).filter((s) => s.hits > 0);
    if (page.thua.length) all = all.filter((s) => s.hitT > 0);
    if (!all.length)
      return { err: `đơn đang mở (${pageDesc(page)}) không khớp TB nào trong dữ liệu – kiểm tra đã mở đúng hồ sơ chưa (hoặc nạp dữ liệu TB đó)` };
    all.sort((a, b) => b.score - a.score || b.hits - a.hits);
    const best = all[0];
    const top = all.filter((s) => s.score === best.score && s.hits === best.hits);
    if (top.length === 1) return best.tb === tbSel ? { tb: tbSel, s: best } : { tb: best.tb, s: best, switched: true };
    const sel = top.find((s) => s.tb === tbSel);
    if (sel) return { tb: tbSel, s: sel, tie: top.filter((s) => s !== sel).map((s) => s.tb.tb) };
    return { err: `đơn đang mở (${pageDesc(page)}) khớp nhiều TB: ${top.map((s) => s.tb.tb).join(', ')} – chọn đúng TB trong danh sách rồi bấm “Chạy cả TB” lại` };
  }

  // ---------- phiếu đối chiếu số liệu trong đơn ----------
  // res: ok khớp · bad lệch · gap dữ liệu thiếu (bạn tự điền) · na trang không hiện / không đọc được
  function buildSheet(tb, page, chuList, thuaList) {
    const rows = [];
    const add = (item, field, pv, dv, res) => rows.push({ item, field, pv: pv ?? '', dv: dv ?? '', res });
    chuList.forEach(({ p, i }) => {
      const item = `Chủ ${i + 1}`;
      const node = page.chu.find((c) => chuMatch(c, p));
      if (!node) return add(item, 'Họ tên', '(không đọc được trên cây)', p.hoTen, 'na');
      add(item, 'Họ tên', node.name, p.hoTen, !node.name ? 'na' : toneFold(node.name) === toneFold(p.hoTen) ? 'ok' : 'bad');
      // trang có nhãn mà bỏ trống (“Năm sinh: -”) = ô chưa điền → lệch, không phải “không đọc được”
      const ns = String(p.namSinh || '');
      if (!ns) add(item, 'Năm sinh', node.namSinh, '(trống)', 'gap');
      else if (!node.namSinh) add(item, 'Năm sinh', node.nsLabel ? '(trống)' : '', ns, node.nsLabel ? 'bad' : 'na');
      else add(item, 'Năm sinh', node.namSinh, ns, node.namSinh === ns ? 'ok' : 'bad');
      const gt = norm(p.gioiTinh) === 'nam' ? 'Nam' : norm(p.gioiTinh) === 'nu' ? 'Nữ' : '';
      if (gt) {
        if (node.gender === 'unset') add(item, 'Giới tính', '(chưa chọn – trang ghi “Ông/Bà”)', gt, 'bad');
        else add(item, 'Giới tính', node.gender ? `${node.gender} (${node.gender === 'Nam' ? 'Ông' : 'Bà'})` : '', gt, !node.gender ? 'na' : node.gender === gt ? 'ok' : 'bad');
      }
      const d = digitsOf(p.soGiayTo);
      if (!d) add(item, 'Số giấy tờ', node.id, '(trống)', 'gap');
      else if (!node.id) add(item, 'Số giấy tờ', node.idLabel ? '(trống)' : '', d, node.idLabel ? 'bad' : 'na');
      else add(item, 'Số giấy tờ', node.id, d, node.id === d ? 'ok' : 'bad');
    });
    thuaList.forEach(({ t, i }) => {
      const item = `Thửa ${t.soThua}/${t.soTo}`;
      const node = page.thua.find((x) => x.key === thuaKey(t));
      if (!node) return add(item, 'Số thửa/tờ', '(không đọc được trên cây)', `${t.soThua}/${t.soTo}`, 'na');
      const a = normArea(t.dienTich);
      const pa = node.area ? pageNum(node.area) : NaN;
      if (a.err) add(item, 'Diện tích', node.area, String(t.dienTich ?? ''), 'gap');
      else add(item, 'Diện tích', node.area, a.v, isNaN(pa) ? 'na' : Math.abs(pa - parseFloat(a.v)) < 1e-6 ? 'ok' : 'bad');
      const codes = node.purposes.map((x) => x.code.toUpperCase());
      const have = codes.flatMap((c) => c.split(/[+,]/));
      const want = String(t.mdsd || '').trim().toUpperCase();
      const wants = want.split(/[\s+,;/]+/).filter(Boolean); // “ONT+CLN” → cả 2 mã phải có
      if (!want) add(item, 'Mục đích', codes.join(', '), '(dữ liệu thiếu – chọn tay)', 'gap');
      else add(item, 'Mục đích', codes.join(', '), want, !codes.length ? 'na' : wants.every((w) => have.includes(w)) ? 'ok' : 'bad');
      // thời hạn: chỉ so khi trang ghi kiểu “50 năm” / “Lâu dài” (cách ghi khác thì không đoán)
      const th = String(t.thoiHan || DEFAULT_THOI_HAN);
      const pth = (node.purposes.find((x) => x.thoiHan) || {}).thoiHan || '';
      const comparable = /^(\d+\s*năm|lâu dài)$/i.test(pth.trim()) && /^(\d+\s*năm|lâu dài)$/i.test(th.trim());
      add(item, 'Thời hạn', pth, th, !comparable ? 'na' : norm(pth).replace(/\s+/g, '') === norm(th).replace(/\s+/g, '') ? 'ok' : 'bad');
    });
    // mục bị thêm 2 lần vào đơn (vd. bấm Lưu 2 lần) – có mặt đủ vẫn là sai
    const twice = (arr, keyOf) => {
      const m = new Map();
      arr.forEach((x) => {
        const k = keyOf(x);
        if (k) m.set(k, (m.get(k) || []).concat(x));
      });
      return [...m.values()].filter((g) => g.length > 1);
    };
    twice(page.chu, (c) => (c.id ? 'id:' + c.id : c.name ? 'n:' + norm(c.name) + '|' + c.namSinh : '')).forEach((g) =>
      add(`Chủ ${g[0].name}`, 'Trùng trong đơn', `${g.length} lần`, '1 lần', 'bad')
    );
    twice(page.thua, (x) => x.key).forEach((g) => add(`Thửa ${g[0].soThua}/${g[0].soTo}`, 'Trùng trong đơn', `${g.length} lần`, '1 lần', 'bad'));
    // có trong đơn mà dữ liệu TB không có (vd. thửa bạn tự thêm) – nhắc để bạn chắc là cố ý
    const keys = new Set((tb.thua || []).map(thuaKey));
    page.thua.filter((x) => !keys.has(x.key)).forEach((x) => add(`Thửa ${x.soThua}/${x.soTo}`, 'Không có trong dữ liệu TB', 'có trong đơn', '—', 'gap'));
    page.chu
      .filter((c) => !(tb.chu || []).some((p) => chuMatch(c, p)))
      .forEach((c) => add(`Chủ ${c.name}`, 'Không có trong dữ liệu TB', 'có trong đơn', '—', 'gap'));
    const n = { ok: 0, bad: 0, gap: 0, na: 0 };
    rows.forEach((r) => n[r.res]++);
    return { rows, n };
  }
  function sheetHtml(sh) {
    const ICON = { ok: '✓', bad: '✗', gap: '⚠', na: '•' };
    const tr = (r) =>
      `<tr class="${r.res}"><td>${esc(r.item)}</td><td>${esc(r.field)}</td><td>${esc(r.pv)}</td><td>${esc(r.dv)}</td><td>${ICON[r.res]}</td></tr>`;
    const head = '<tr><th>Mục</th><th>Ô</th><th>Trên trang</th><th>Dữ liệu</th><th></th></tr>';
    const odd = sh.rows.filter((r) => r.res === 'bad' || r.res === 'gap');
    const sum =
      `✓ ${sh.n.ok} ô khớp` + (sh.n.bad ? ` · ✗ ${sh.n.bad} lệch` : '') + (sh.n.gap ? ` · ⚠ ${sh.n.gap} dữ liệu thiếu` : '') + (sh.n.na ? ` · • ${sh.n.na} không đọc được trên trang` : '');
    return (
      `<div class="sum" style="margin-top:6px">Phiếu đối chiếu (đơn trên VBDLIS ↔ dữ liệu TB)</div><div class="${sh.n.bad ? 'bad' : 'ok'}">${esc(sum)}</div>` +
      (odd.length ? `<table class="sh">${head}${odd.map(tr).join('')}</table>` : '') +
      `<details><summary>Xem đủ ${sh.rows.length} ô</summary><table class="sh">${head}${sh.rows.map(tr).join('')}</table></details>`
    );
  }

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

  // một dòng tóm tắt những gì vừa điền vào cửa sổ (liếc là kiểm xong)
  function quickLine(kind, v, results) {
    const okN = results.filter((x) => x.ok).length;
    // chỉ ghi những ô cửa sổ này có và đã điền được (vd. cửa sổ “Thêm thửa đất” ở bước tiếp nhận không có mục đích, thời hạn)
    const has = (k) => results.some((r) => r.key === k && r.ok);
    const parts =
      kind === 'chu'
        ? [has('hoTen') && v.hoTen, has('namSinh') && v.namSinh, has('gioiTinhNam') && (v.gioiTinhNam ? 'Nam' : 'Nữ'), has('soGiayTo') && v.soGiayTo]
        : [`thửa ${v.soThua}/${v.soTo}`, has('dienTich') && `${v.dienTich} m²`, has('mdsd') && v.mdsd, has('thoiHan') && v.thoiHan];
    return `${parts.filter(Boolean).join(' · ')} (${okN}/${results.length} ô ✓)`;
  }

  function updateRunBtn() {
    const b = $('#runAll');
    if (!b) return;
    b.textContent = S.running ? '■ Dừng' : '▶ Chạy cả TB';
    b.classList.toggle('stop', !!S.running);
    root.querySelectorAll('#tbSel, #prev, #next, #scan, #dataBtn, #resetDone, #tbStage, #nextTodo').forEach((x) => (x.disabled = !!S.running));
    applyRunLock();
  }
  // khi đang "Chạy cả TB": không cho sửa dữ liệu / điền lẻ (dữ liệu đã kiểm tra lúc bắt đầu)
  function applyRunLock() {
    root
      .querySelectorAll('#content input, #content select, #content [data-fill], #content #dcApply, #content #gtAdd')
      .forEach((x) => (x.disabled = !!S.running));
  }

  async function runAll() {
    let tb = curTB();
    if (!tb || S.running || S.busy) return;
    S.running = true;
    S.stopReq = false;
    S.armed = null; // lần chạy trước bỏ dở → không còn chờ tự ghi nhận cho TB đó
    stopNeed();
    updateRunBtn();
    setEvt('');
    const log = [];
    let title = `Chạy cả TB ${tb.tb} – ${(tb.nguoiNop && tb.nguoiNop.hoTen) || ''}`;
    let tail = '';
    let tailOk = '';
    let sheet = ''; // phiếu đối chiếu số liệu (bước Nhập đơn đăng ký)
    let actHtml = ''; // nút xác nhận khi tiện ích dừng để hỏi bạn
    let failMsg = '';
    const show = () =>
      setResult(
        `<div class="sum">${esc(title)}</div>` +
          log.map((l) => `<div class="ln ${l.cls}">${l.icon} ${l.html}</div>`).join('') +
          (actHtml ? `<div class="row" style="margin-top:4px;flex-wrap:wrap">${actHtml}</div>` : '') +
          sheet +
          tail
      );
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
        if (!d) {
          if (shown) stopNeed();
          return shown;
        }
        if (!shown) {
          c.wait(`trang đang hỏi “${d.titles[0]}” – bạn tự trả lời (thường là bấm “Đồng ý”), tiện ích chờ rồi làm tiếp`);
          needYou('Trang đang hỏi – bạn trả lời');
          shown = true;
        }
        if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ trả lời hộp hỏi của trang quá 20 phút – đã dừng');
        await sleep(800);
      }
    };
    let qt = tb.quyTrinh || DEFAULT_QUY_TRINH;
    let thua = tb.thua || [];
    const allMode = S.opts.thuaTN === 'tatca';
    let cur = null;
    // đổi sang TB khớp hồ sơ đang mở (chỉ trước khi ghi gì lên trang)
    const setTb = (x) => {
      tb = x;
      qt = tb.quyTrinh || DEFAULT_QUY_TRINH;
      thua = tb.thua || [];
      S.cur = tb.tb;
      saveUi();
      render();
      title = `Chạy cả TB ${tb.tb} – ${(tb.nguoiNop && tb.nguoiNop.hoTen) || ''}`;
      show();
    };

    // ---------- Hồ sơ đang mở là của TB nào (cửa sổ “Nhập đơn đăng ký”) ----------
    // Đơn đã có sẵn chủ + thửa mang từ bước tiếp nhận → so với dữ liệu: đúng TB đang chọn thì làm tiếp;
    // khớp rõ TB khác thì tự chọn TB đó; không khớp / khớp nhiều TB thì DỪNG (không điền nhầm hồ sơ)
    const identifyDon = async () => {
      cur = step('Nhận hồ sơ đang mở');
      // cây của đơn có thể đang tải (“Loading …”) → đọc lại tối đa ~5 giây
      let f = null;
      let page = { chu: [], thua: [] };
      for (let k = 0; k < 10; k++) {
        stopIf();
        f = (await act('donRead')).find((x) => x.ok) || null;
        page = f ? parseDon(f) : { chu: [], thua: [] };
        if (f && !f.loading && (page.chu.length || page.thua.length)) break;
        await sleep(500);
      }
      const confirmBtn = actBtn('confirmDon', tb.tb, `Đúng là hồ sơ của TB ${tb.tb} – làm tiếp`);
      if (!page.chu.length && !page.thua.length) {
        const hasNodes = !!f && ((f.chu || []).length > 0 || (f.thua || []).length > 0);
        // không đoán: bạn xác nhận hồ sơ này của TB đang chọn
        if (!consume('confirmDon', tb.tb))
          throw ask(
            `chưa đọc được chủ / thửa trong đơn ${hasNodes ? '(cây đang tải hoặc đang thu gọn – chờ trang tải xong / mở rộng cây)' : '(đơn chưa có chủ / thửa nào)'} nên không biết hồ sơ này của TB nào. Kiểm tra đúng hồ sơ TB ${tb.tb} rồi bấm nút dưới, hoặc chọn TB khác`,
            confirmBtn
          );
        cur.skip(`bạn xác nhận đây là hồ sơ TB ${tb.tb}`);
        return;
      }
      const r = matchTb(page, tb);
      if (r.err) throw new Error(r.err);
      const extra = [...r.s.forT.map((t) => `thửa ${t.soThua}/${t.soTo}`), ...r.s.forC.map((c) => `chủ ${c.name}`)];
      const extraTxt = extra.length ? ` · đơn có thêm mục không có trong dữ liệu TB: ${extra.join(', ')}` : '';
      const why = pageDesc(page);
      if (r.tie) {
        // nhiều TB khớp như nhau (vd. cùng chủ, đơn chưa có thửa) → bạn xác nhận; không tự đánh dấu tiến độ
        if (!consume('confirmDon', tb.tb))
          throw ask(`đơn đang mở (${why}) khớp cả TB ${r.tie.join(', ')} chứ không riêng TB ${tb.tb} đang chọn – kiểm tra đúng hồ sơ rồi bấm nút dưới, hoặc chọn TB khác`, confirmBtn);
        cur.ok(`bạn xác nhận TB ${tb.tb} (đơn khớp cả TB ${r.tie.join(', ')})${extraTxt}`);
        return;
      }
      if (r.switched) {
        const from = tb.tb;
        setTb(r.tb);
        cur.ok(`đơn đang mở là của TB ${tb.tb} (${why}), không phải TB ${from} – đã tự chọn TB ${tb.tb}${extraTxt}`);
      } else cur.ok(`đúng TB ${tb.tb} (${why})${extraTxt}`);
      // đã có hồ sơ trên VBDLIS → chắc chắn đã tiếp nhận
      if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'don');
    };

    // ---------- Chốt trước khi ghi lên trang ----------
    // TB tạm hoãn → dừng (nút “Bỏ tạm hoãn”). Ghi chú / dữ liệu thiếu / trùng thửa → chỉ hiện một dòng nhắc rồi chạy tiếp
    // (không dừng hỏi “Đã xem” – theo ý bạn, cho chạy liên tục).
    const gateTb = () => {
      const s0 = S.stage[String(tb.tb)] || {};
      if (s0.hoan)
        throw ask(
          `TB ${tb.tb} đang TẠM HOÃN${s0.hoan.lyDo ? ' (' + s0.hoan.lyDo + ')' : ''} – giải quyết xong thì bấm nút dưới để bỏ tạm hoãn và chạy`,
          actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`)
        );
      const notes = [];
      if (String(tb.ghiChu || '').trim()) notes.push(String(tb.ghiChu).trim());
      (tb.thua || []).forEach((t) => {
        const g = thuaGaps(t, tb);
        if (g.length) notes.push(`thửa ${t.soThua || '?'}/${t.soTo || '?'} thiếu ${g.join(', ')} – bạn điền tay`);
      });
      const dd = dupMap().get(String(tb.tb));
      if (dd) notes.push(`trùng thửa với ${dupText(dd)} – kiểm tra kẻo nhập 2 lần`);
      if (!notes.length || log.some((l) => l.note)) return; // mỗi lần chạy chỉ nhắc 1 lần
      log.push({ icon: '⚠', cls: 'warn', html: esc('Ghi chú: ' + notes.join(' · ')), note: true });
      show();
    };

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
      const chuList = (tb.chu || []).map((p, i) => ({ p, i })); // điền TẤT CẢ chủ (kể cả người dùng chung)
      const optional = [];
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
        const gapsHere = !!(it.gaps && it.gaps.length);
        const allOk = !bad.length && !gapsHere;
        // mọi ô đã khớp → con trỏ nằm sẵn ở nút “Lưu” (không bấm): bạn liếc dòng tóm tắt rồi nhấn Enter
        const focused = allOk && S.opts.enterLuu !== false && anyOk(await act('focusSave', {}));
        const waitMsg =
          (gapsHere ? `dữ liệu chưa có ${it.gaps.join(', ')} – bạn điền tay; ` : '') +
          (bad.length && !gapsHere ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; ` : '') +
          (allOk ? `đã điền: ${quickLine(it.kind, it.values, pf.f.results)} – ` : '') +
          (focused ? 'kiểm tra rồi nhấn Enter (con trỏ đang ở nút “Lưu”) hoặc tự bấm “Lưu”' : 'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ') +
          ' (bấm “■ Dừng” để thôi)';
        cur.wait(waitMsg);
        needYou(`Bấm Lưu – ${it.label}`);
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
            needYou('Trang đang hỏi – bạn trả lời');
          } else if (!d && asked) {
            asked = '';
            cur.wait(waitMsg);
          }
          if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bấm Lưu quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
          await sleep(1000);
        }
        stopNeed();
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

      // 4b. Phiếu đối chiếu: đọc lại cây của đơn (những gì VBDLIS đã lưu) và so từng ô với dữ liệu
      cur = step('Phiếu đối chiếu số liệu');
      {
        const f = (await act('donRead')).find((x) => x.ok);
        const page = f ? parseDon(f) : { chu: [], thua: [] };
        const thuaList = thua.map((t, i) => ({ t, i })).filter((x) => !noId.includes(x.t));
        const sh = buildSheet(tb, page, chuList, thuaList);
        sheet = sh.n.ok || sh.n.bad ? sheetHtml(sh) : '';
        // từ giờ chờ trang báo “Lưu đơn đăng ký thành công” (sau khi BẠN bấm Hoàn tất) → tự đánh dấu TB xong
        S.armed = { tb: String(tb.tb), stage: 'don', at: Date.now(), lech: sh.n.bad };
        const st = S.stage[String(tb.tb)];
        if (st && st.don && st.lech !== sh.n.bad) {
          st.lech = sh.n.bad;
          saveStage(tb.tb);
          renderTop();
        }
        if (sh.n.bad)
          throw new Error(
            `lệch ${sh.n.bad} ô so với dữ liệu (xem phiếu bên dưới) – sửa trên VBDLIS (chọn mục → Sửa) rồi bấm “▶ Chạy cả TB” lại để kiểm tra. Nếu bạn cố ý để khác thì cứ tự bấm “Lưu thông tin đăng ký” rồi “Hoàn tất”`
          );
        if (!sh.n.ok) cur.skip('trang không hiện số liệu trên cây để so – bạn tự kiểm tra từng chủ, từng thửa');
        else
          cur.ok(
            `${sh.n.ok} ô khớp` +
              (sh.n.gap ? ` · ⚠ ${sh.n.gap} ô dữ liệu thiếu – bạn tự điền / tự kiểm tra` : '') +
              (sh.n.na ? ` · ${sh.n.na} ô trang không hiện để so` : '')
          );
      }

      // 5. Chỉ chỗ nút “Lưu thông tin đăng ký” (không bấm)
      cur = step('Nút “Lưu thông tin đăng ký”');
      if (anyOk(await act('highlight', { texts: ['Lưu thông tin đăng ký'], inModal: true })))
        cur.ok('đã tô vàng – bạn kiểm tra rồi tự bấm, sau đó bấm “Hoàn tất” (1 lần là đủ)');
      else cur.skip('không thấy nút – bạn tự bấm “Lưu thông tin đăng ký” rồi “Hoàn tất”');
      cur = null;
      tailOk =
        '<div class="hint">Xong bước Nhập đơn đăng ký: bạn kiểm tra rồi tự bấm <b>Lưu thông tin đăng ký</b>, sau đó <b>Hoàn tất</b> (bấm 1 lần, thấy “Lưu đơn đăng ký thành công” là xong). Khi trang báo câu đó, tiện ích tự đánh dấu TB này <b>✓ Xong</b>.</div>';
    };

    try {
      // Cửa sổ nào đang mở → chọn bước: “Nhập đơn đăng ký” hay màn hình Tiếp nhận hồ sơ
      const top0 = (await act('modalState')).find((x) => x.open);
      const k0 = top0 ? modalKey(top0) : '';
      if (top0 && DON_MODAL.test(k0)) {
        await identifyDon();
        gateTb();
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
        if (have && normVal(have) !== normVal(want)) {
          // màn hình đang là hồ sơ của TB khác (chưa mở hồ sơ mới?) → nói rõ TB nào; KHÔNG tự đổi (tránh lưu hồ sơ đó 2 lần)
          const other = label === 'Số biên nhận' ? S.data.filter((x) => x !== tb && normVal(x.soBienNhan) === normVal(have)) : [];
          const whose = other.length === 1 ? ` – đây là hồ sơ của TB ${other[0].tb} (${stageOf(other[0]) === 'chua' ? 'chưa lưu' : 'đã tiếp nhận'})` : '';
          throw new Error(
            `ô “${label}” trên trang đang là “${have}” (không phải TB ${tb.tb})${whose}. Nếu hồ sơ đó đã lưu thì mở màn hình tiếp nhận mới; nếu chưa thì chọn đúng TB đó hoặc xóa ô`
          );
        }
      }
      // TB tạm hoãn / ghi chú chưa xem → dừng hỏi bạn (nút riêng)
      gateTb();
      // đã tiếp nhận rồi / trùng thửa với TB đã tiếp nhận → chỉ làm khi bạn bấm nút “Vẫn tiếp nhận…” (tránh tạo hồ sơ trùng)
      {
        const s0 = S.stage[String(tb.tb)] || {};
        const received = !!(s0.tn || s0.don);
        const dupDone = (dupMap().get(String(tb.tb)) || []).filter((d) => {
          const so = S.stage[d.tb] || {};
          return !!(so.tn || so.don);
        });
        if ((received || dupDone.length) && !consume('confirmTn', tb.tb)) {
          const why = received
            ? `TB ${tb.tb} đã ${s0.don ? 'nhập đơn xong' : 'tiếp nhận'} lúc ${fmtTime(s0.tn || s0.don)} (${BY_TEXT[s0.tnBy] || 'đã đánh dấu'})`
            : `TB này trùng thửa với ${dupText(dupDone)} – TB đó đã tiếp nhận`;
          throw ask(
            `${why}. Tiếp nhận lần nữa sẽ tạo hồ sơ TRÙNG trên VBDLIS. Đánh dấu nhầm thì đổi ô Trạng thái về “Chưa làm”.`,
            actBtn('confirmTn', tb.tb, `Vẫn tiếp nhận TB ${tb.tb}`)
          );
        }
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
        const focused = !bad.length && S.opts.enterLuu !== false && anyOk(await act('focusSave', {}));
        cur.wait(
          (bad.length
            ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; `
            : `đã điền: ${quickLine('thua', buildValues('thua', tb, i), f.results)} – `) +
            (focused ? 'kiểm tra rồi nhấn Enter (con trỏ đang ở nút “Lưu”) hoặc tự bấm “Lưu”' : 'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ') +
            ' (bấm “■ Dừng” để thôi)'
        );
        needYou(`Bấm Lưu – thửa ${t.soThua}/${t.soTo}`);
        const t0 = Date.now();
        for (;;) {
          stopIf();
          const st = await act('modalState');
          if (!st.some((x) => x.open)) break;
          if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bấm Lưu quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
          await sleep(1000);
        }
        stopNeed();
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
      // từ giờ chờ trang báo “Lưu hồ sơ thành công” (sau khi BẠN bấm Lưu hồ sơ) → tự đánh dấu TB đã tiếp nhận
      S.armed = { tb: String(tb.tb), stage: 'tn', at: Date.now() };
      cur = null;
      tailOk =
        '<div class="hint">Bạn bấm <b>Lưu hồ sơ</b>; khi trang báo “Lưu hồ sơ thành công”, tiện ích tự đánh dấu TB này <b>◐ đã tiếp nhận</b>. Bước sau (Xử lý hồ sơ → <b>Nhập đơn đăng ký</b>): bấm “▶ Chạy cả TB” – tiện ích tự nhận hồ sơ đó là của TB nào, thêm đủ chủ và thửa, rồi lập phiếu đối chiếu.</div>';
    } catch (e) {
      const m = String((e && e.message) || e);
      if (e && e.actHtml) actHtml = e.actHtml; // tiện ích dừng để hỏi bạn → hiện nút xác nhận
      if (cur && (cur.l.icon === '⏳' || cur.l.icon === '⏸')) cur.bad(m);
      else log.push({ icon: '✗', cls: 'bad', html: esc(m) });
      failMsg = m;
    } finally {
      S.running = false;
      stopNeed();
      updateRunBtn();
      render();
      tail =
        tailOk +
        '<div class="hint">Tiện ích không bấm nút Lưu nào. Bấm “Chạy cả TB” lại bất cứ lúc nào – bước/thửa đã xong sẽ được bỏ qua.</div>';
      show();
      // báo bạn: xong (tới lượt bạn bấm Lưu) hoặc dừng để hỏi / báo lỗi; bạn tự bấm Dừng thì im lặng
      if (tailOk) needYou('Xong – tới lượt bạn bấm Lưu');
      else if (failMsg && !/^Đã dừng theo yêu cầu/.test(failMsg)) needYou('Tiện ích dừng – xem bảng điền', 'bad');
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
      if (area !== 'local') return;
      // tiến độ đổi ở tab VBDLIS khác → cập nhật dấu ○ ◐ ✓ (không vẽ lại ô đang gõ)
      if (ch.tbStage) {
        const nv = { ...(ch.tbStage.newValue || {}) };
        Object.keys(stagePending).forEach((k) => {
          // TB vừa đổi ở tab này mà chưa ghi xong → giữ bản của tab này
          if (S.stage[k]) nv[k] = S.stage[k];
          else delete nv[k];
        });
        if (JSON.stringify(nv) !== JSON.stringify(S.stage)) {
          S.stage = nv;
          renderTop();
        }
      }
      // dấu ✓ từng mục đổi ở tab khác (vd. nạp lại dữ liệu) → lấy bản mới (không lấy khi đang chạy: lần chạy tự ghi dấu của nó)
      if (ch.tbDone && !S.running && JSON.stringify(ch.tbDone.newValue || {}) !== JSON.stringify(S.done)) {
        S.done = ch.tbDone.newValue || {};
        if (!root.activeElement) render();
      }
      if (!ch.tbData) return;
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
    // TB có nội dung khác bản cũ (chủ / thửa có thể đổi thứ tự) → bỏ dấu ✓ từng mục cũ; tiến độ tiếp nhận / nhập đơn giữ nguyên
    const before = st.tbData || S.data;
    items.forEach((x) => {
      const o = before.find((y) => String(y.tb) === String(x.tb));
      if (o && JSON.stringify(o) !== JSON.stringify(x)) clearDone(x.tb);
    });
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
      const t = old.querySelector('#dlgTxt');
      if (t) return t.focus(); // hộp Dữ liệu đang mở
      const c = old.querySelector('#pgClose'); // hộp Tiến độ đang mở → đóng rồi mở hộp Dữ liệu
      if (c) c.click();
      else old.remove();
    }
    const d = document.createElement('div');
    d.className = 'dlg';
    d.innerHTML = `<div class="dh"><b>Dữ liệu TB (JSON)</b><span class="sp"></span><button class="btn x" id="dlgClose" title="Đóng hộp này (phím Esc)">✕ Đóng</button></div>
      <div class="hint">Dán dữ liệu một TB hoặc danh sách TB rồi bấm “Gộp vào” (thay TB trùng số, giữ các TB khác). Có file .json thì <b>kéo thả file vào bảng này</b> hoặc bấm “Mở file…”. File <b>data/du-lieu.json</b> của tiện ích được tự đọc mỗi lần mở bảng.</div>
      <input type="file" id="dlgFile" accept=".json,application/json" multiple style="display:none">
      <textarea id="dlgTxt" spellcheck="false"></textarea>
      <div class="row"><button class="btn pri" id="dlgMerge">Gộp vào</button><button class="btn" id="dlgReplace">Thay toàn bộ</button><button class="btn" id="dlgCopy">Sao chép hiện có</button><button class="btn" id="dlgOpen" title="Chọn file .json dữ liệu TB (chọn được nhiều file)">Mở file…</button><button class="btn" id="dlgSample" title="Đưa nội dung file data/du-lieu.json của tiện ích vào ô để Gộp vào / Thay toàn bộ">Lấy từ thư mục data</button><button class="btn" id="dlgRec" title="Xuất lại file của lần ghi thao tác gần nhất">Xuất bản ghi</button></div>
      <div class="row"><span class="muted">Xóa:</span><button class="btn del" id="dlgDelOne" title="Xóa TB đang chọn ở ô trên cùng của bảng điền">TB đang chọn</button><button class="btn del" id="dlgDelAll" title="Xóa mọi TB trong tiện ích">Tất cả TB</button><button class="btn del" id="dlgDelRec" title="Xóa bản ghi thao tác đã ghi">Bản ghi thao tác</button></div>
      <div class="hint">Xóa chỉ xóa dữ liệu trong tiện ích (trên máy này), không đụng gì trên VBDLIS. Muốn có lại: dán JSON rồi “Gộp vào”, hoặc “Lấy từ thư mục data” rồi “Gộp vào”.</div>
      <div id="dlgMsg" class="hint"></div>`;
    d.style.top = ($('.hd').offsetHeight || 37) + 'px'; // không che thanh tiêu đề (nút –, × vẫn bấm được)
    pn.classList.add('dlgopen');
    pn.appendChild(d);
    coverPanel(true);
    // đang mở hộp này mà thả file lệch ra ngoài bảng → không để trình duyệt mở file (mất trang VBDLIS)
    const guard = (e) => {
      if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault();
    };
    document.addEventListener('dragover', guard, true);
    document.addEventListener('drop', guard, true);
    const closeDlg = () => {
      d.remove();
      pn.classList.remove('dlgopen');
      coverPanel(false);
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
        if (id === 'dlgClose') closeDlg();
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
      selectTb(e.target.value);
      return;
    }
    if (e.target.id === 'optAmBao' || e.target.id === 'optEnter') {
      const k = e.target.id === 'optAmBao' ? 'amBao' : 'enterLuu';
      S.opts = { ...S.opts, [k]: e.target.checked };
      safeSet({ tbOpts: S.opts });
      if (k === 'amBao' && e.target.checked) {
        audioReady();
        beep(); // nghe thử
      }
      setStatus(
        k === 'amBao'
          ? e.target.checked ? 'Sẽ kêu “ting” và nháy tên tab khi cần bạn.' : 'Đã tắt tiếng báo.'
          : e.target.checked ? 'Ô đã khớp hết thì con trỏ nằm sẵn ở nút Lưu – nhấn Enter để lưu.' : 'Đã tắt đặt sẵn con trỏ ở nút Lưu.'
      );
      return;
    }
    if (e.target.id === 'tbStage') {
      const tb = curTB();
      if (!tb || S.running) return renderTop();
      const v = e.target.value;
      if (v === 'hoan') {
        // tạm hoãn: ghi lý do (vd. “chưa rõ chủ”, “trùng TB 1527”) để cuối đợt xem lại
        const lyDo = prompt(`Lý do tạm hoãn TB ${tb.tb} (vd. chưa rõ chủ, chờ hỏi lại…):`, '');
        if (lyDo === null) return renderTop(); // bấm Hủy → giữ trạng thái cũ
        markStage(tb.tb, 'hoan', 'tay', { lyDo: lyDo.trim() });
      } else markStage(tb.tb, v, 'tay');
      S.confirmTn = null;
      S.confirmDon = null;
      setStatus(`TB ${tb.tb}: đã đánh dấu tay “${STAGE_TEXT[v]}”.`);
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('.dlg')) return;
    if (b.id === 'runAll') {
      if (e.detail > 1) return; // lần bấm thứ 2 của bấm đúp → bỏ qua (không tự dừng, không chạy lại)
      if (S.running) {
        S.stopReq = true;
        b.textContent = '… đang dừng';
      } else if (!isAlive()) setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      else {
        audioReady();
        runAll();
      }
      return;
    }
    // nút trong dòng báo: bạn xác nhận rồi chạy tiếp / đánh dấu tiến độ bằng một bấm
    if (b.dataset.act) {
      if (e.detail > 1 || S.running || S.busy) return;
      if (!isAlive()) return setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      const id = String(b.dataset.tb || '');
      const a = b.dataset.act;
      if (!S.data.some((x) => String(x.tb) === id)) return setStatus(`Không còn TB ${id} trong dữ liệu.`, true);
      if (a === 'markTn' || a === 'markDon') {
        markStage(id, a === 'markTn' ? 'tn' : 'don', 'tay', a === 'markDon' ? { lech: parseInt(b.dataset.lech || '0', 10) || 0 } : undefined);
        setEvt(`✓ Đã đánh dấu TB ${esc(id)} ${a === 'markTn' ? '◐ đã tiếp nhận' : '✓ xong'}.`);
        return;
      }
      if (String((curTB() || {}).tb) !== id) selectTb(id); // nút của TB khác → chọn TB đó trước
      if (a === 'confirmTn' || a === 'confirmDon') S[a] = { tb: id, at: Date.now() };
      else if (a === 'unHoan') markStage(id, (S.stage[id] || {}).tn ? 'tn' : 'chua', 'tay');
      audioReady();
      runAll();
      return;
    }
    if (S.running && (b.dataset.fill || ['prev', 'next', 'scan', 'dataBtn', 'resetDone', 'dcApply', 'gtAdd', 'nextTodo', 'goNext'].includes(b.id))) {
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
      if (S.data[k]) selectTb(S.data[k].tb);
    } else if (b.id === 'nextTodo') {
      const nx = nextTodo();
      if (nx) {
        selectTb(nx.tb);
        setStatus(`Đã chọn TB ${nx.tb} – TB chưa làm tiếp theo.`);
      } else setStatus(S.data.length ? 'Mọi TB đã tiếp nhận ✓ – xem “☰ Tiến độ” để biết TB nào chưa nhập đơn.' : 'Chưa có dữ liệu TB.');
    } else if (b.id === 'goNext') {
      selectTb(b.dataset.tb);
    } else if (b.id === 'progList') openProgress();
    else if (b.id === 'scan') await doScan();
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
    if (b.rh) {
      // chiều cao phần nhật ký bạn đã kéo lần trước (không quá cao so với cửa sổ hiện tại)
      pn.style.setProperty('--rh', Math.max(40, Math.min(b.rh, innerHeight - 220)) + 'px');
      pn.style.setProperty('--rmh', 'none');
    }
  }
  function saveBox() {
    const r = host.getBoundingClientRect();
    const b = { left: Math.round(r.left), top: Math.round(r.top) };
    const w = parseInt(pn.style.getPropertyValue('--w'), 10);
    const h = parseInt(pn.style.getPropertyValue('--h'), 10);
    const rh = parseInt(pn.style.getPropertyValue('--rh'), 10);
    if (w) b.w = w;
    if (h) b.h = h;
    if (rh) b.rh = rh;
    safeSet({ tbBox: b });
  }
  // ---------- thanh kéo giữa phần điền và phần nhật ký: kéo lên = nhật ký cao hơn, kéo xuống = thấp hơn ----------
  {
    const split = $('#split');
    split.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const y0 = e.clientY;
      const h0 = $('#result').getBoundingClientRect().height;
      const p0 = pn.getBoundingClientRect();
      const hd = $('.hd').getBoundingClientRect().height;
      // bảng có chiều cao cố định → nhật ký chiếm tối đa gần hết bảng; không thì bảng cao tới mép dưới cửa sổ
      const room = pn.style.getPropertyValue('--h') ? p0.height : Math.min(innerHeight - p0.top - 8, innerHeight - 90);
      const maxH = Math.max(60, room - hd - 80);
      split.classList.add('drag');
      const mv = (ev) => {
        const h = Math.round(Math.max(40, Math.min(maxH, h0 - (ev.clientY - y0))));
        pn.style.setProperty('--rh', h + 'px');
        pn.style.setProperty('--rmh', 'none');
      };
      const up = () => {
        split.classList.remove('drag');
        removeEventListener('mousemove', mv, true);
        removeEventListener('mouseup', up, true);
        saveBox();
      };
      addEventListener('mousemove', mv, true);
      addEventListener('mouseup', up, true);
    });
    // bấm đúp → về chiều cao mặc định
    split.addEventListener('dblclick', () => {
      pn.style.removeProperty('--rh');
      pn.style.removeProperty('--rmh');
      saveBox();
    });
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

  // ---------- tự ghi nhận tiến độ: nghe thông báo của trang ----------
  // Sau khi BẠN bấm Lưu hồ sơ / Hoàn tất, VBDLIS hiện “Thành công – Lưu hồ sơ thành công” / “… Lưu đơn đăng ký thành công”.
  // Tiện ích chỉ ĐỌC thông báo đó (không bấm gì) và đánh dấu TB vừa chạy “Chạy cả TB”.
  const MSG_SEL =
    '.toast, .toast-message, .toast-title, .alert, .swal2-popup, .bootbox-body, .noty_body, .jq-toast-single, .ui-pnotify-text, .notifyjs-container, .jconfirm-content';
  const MSG_BOX = '.toast, .alert, .swal2-popup, .bootbox, .noty_bar, .jq-toast-single, .ui-pnotify, .notifyjs-container, .jconfirm-box';
  // (trang ghép liền tiêu đề + nội dung: “Thành côngLưu hồ sơ thành công” → không đòi ranh giới từ ở đầu)
  const SAVE_EVENTS = [
    { stage: 'tn', re: /luu ho so thanh cong/, say: 'Lưu hồ sơ thành công' },
    { stage: 'don', re: /luu don dang ky thanh cong/, say: 'Lưu đơn đăng ký thành công' },
  ];
  // chữ của thông báo, các mẩu chữ cách nhau bằng dấu cách
  const textOf = (el) => {
    const parts = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n && parts.length < 200; n = w.nextNode()) parts.push(n.nodeValue);
    return parts.join(' ');
  };
  const lastEvt = {};
  // Chỉ tự đánh dấu khi CHẮC đúng hồ sơ của TB vừa chạy; không chắc → hiện nút để bạn tự đánh dấu bằng một bấm
  function onSaved(ev) {
    const a = S.armed;
    if (!isAlive()) {
      // tiện ích vừa được tải lại: bảng cũ không ghi được gì nữa
      msgObserver.disconnect();
      setEvt(
        `${esc(DEAD_MSG)} Trang vừa báo “${esc(ev.say)}”${a ? ` (TB ${esc(a.tb)})` : ''} nhưng tiến độ CHƯA được ghi – mở bảng mới rồi đổi ô <b>Trạng thái</b> bằng tay.`,
        true
      );
      return;
    }
    if (a && a.stage !== ev.stage) S.armed = null; // trang báo lưu ở bước khác → bạn đã sang việc khác
    if (!a || a.stage !== ev.stage || Date.now() - a.at > ARM_MS) {
      setEvt(
        `• Trang báo “${esc(ev.say)}” nhưng tiện ích không biết của TB nào (chưa chạy “▶ Chạy cả TB” cho hồ sơ này) – nếu cần, đổi ô <b>Trạng thái</b> bằng tay.`,
        true
      );
      return;
    }
    S.armed = null;
    stopNeed();
    const x = S.data.find((y) => String(y.tb) === a.tb);
    const who = x ? ' – ' + esc(whoOf(x)) : '';
    (async () => {
      if (ev.stage === 'tn') {
        // màn hình phải còn là hồ sơ của TB đó (ô Số biên nhận)
        let have = null;
        try {
          have = await readField('Số biên nhận');
        } catch (e) {}
        if (!x || !have || normVal(have) !== normVal(x.soBienNhan)) {
          setEvt(
            `• Trang báo “${esc(ev.say)}” nhưng ${have ? `ô Số biên nhận đang là “${esc(have)}”, không phải của TB ${esc(a.tb)}` : 'không đọc được ô Số biên nhận'} – tiện ích không tự đánh dấu. Đúng là hồ sơ TB ${esc(a.tb)}${who} thì bấm: ` +
              actBtn('markTn', a.tb, `Đánh dấu TB ${a.tb} đã tiếp nhận`),
            true
          );
          return;
        }
        if (stageOf({ tb: a.tb }) === 'chua') markStage(a.tb, 'tn', 'auto');
        const nx = nextTodo();
        setEvt(
          `✓ TB ${esc(a.tb)}: đã ghi nhận <b>tiếp nhận</b> (trang báo “${esc(ev.say)}”).` +
            (nx ? ` TB chưa làm tiếp theo: <b>${esc(nx.tb)}</b> – ${esc(whoOf(nx))}<button class="btn" id="goNext" data-tb="${esc(nx.tb)}">Chọn</button>` : ' Mọi TB đã tiếp nhận.')
        );
        return;
      }
      // bước nhập đơn: cửa sổ “Nhập đơn đăng ký” còn mở → đọc lại cây, phải đúng đơn của TB đó
      let verdict = 'unknown';
      try {
        const f = (await act('donRead')).find((y) => y.ok);
        if (f && x) {
          const page = parseDon(f);
          if (page.chu.length || page.thua.length) {
            const r = matchTb(page, x);
            verdict = r.err || r.switched ? 'other' : r.tie ? 'unknown' : 'ok';
          }
        }
      } catch (e) {}
      const markBtn = actBtn('markDon', a.tb, `Đánh dấu TB ${a.tb} xong`, ` data-lech="${a.lech || 0}"`);
      if (verdict === 'ok') {
        markStage(a.tb, 'don', 'auto', { lech: a.lech || 0 });
        setEvt(
          `✓ TB ${esc(a.tb)}${who}: <b>xong</b> (trang báo “${esc(ev.say)}”).` + (a.lech ? ` ⚠ Lúc kiểm tra còn lệch ${a.lech} ô so với dữ liệu.` : ''),
          !!a.lech
        );
      } else if (verdict === 'other')
        setEvt(`• Trang báo “${esc(ev.say)}” nhưng đơn đang mở không phải của TB ${esc(a.tb)} – tiện ích không tự đánh dấu.`, true);
      else
        setEvt(
          `• Trang báo “${esc(ev.say)}” nhưng cửa sổ đơn đã đóng nên tiện ích không kiểm được đó là đơn của TB ${esc(a.tb)}${who}. Đúng thì bấm: ${markBtn}`,
          true
        );
    })();
  }
  function onPageMessage(text) {
    const t = norm(text);
    for (const ev of SAVE_EVENTS) {
      if (!ev.re.test(t)) continue;
      if (Date.now() - (lastEvt[ev.stage] || 0) < 4000) return; // tiêu đề + nội dung của cùng một thông báo
      lastEvt[ev.stage] = Date.now();
      onSaved(ev);
      return;
    }
  }
  const msgObserver = new MutationObserver((muts) => {
    if (!host.isConnected) return msgObserver.disconnect(); // bảng đã được thay bằng bảng mới
    for (const m of muts)
      for (const n of m.addedNodes) {
        if (n === host) continue;
        let el = null;
        if (n.nodeType === 1) el = n.matches(MSG_SEL) ? n : n.querySelector(MSG_SEL);
        else if (n.nodeType === 3 && n.parentElement) el = n.parentElement.closest(MSG_SEL); // chữ được gắn vào thông báo sau
        if (!el) continue;
        const box = el.closest(MSG_BOX) || el;
        onPageMessage(textOf(box));
      }
  });
  try {
    msgObserver.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  // ---------- bảng tiến độ tất cả TB ----------
  function progressInfo(x) {
    const s = S.stage[String(x.tb)] || {};
    const d = dupMap().get(String(x.tb));
    const warn = [
      s.hoan && `tạm hoãn: ${s.hoan.lyDo || 'không ghi lý do'}`,
      d && `trùng thửa với ${dupText(d)}`,
      s.lech ? `lệch ${s.lech} ô` : '',
      x.ghiChu ? `ghi chú: ${x.ghiChu}` : '',
    ].filter(Boolean);
    return { st: stageOf(x), s, warn };
  }
  // số TB tiếp nhận / xong theo ngày (7 ngày gần nhất có làm)
  const dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  function dailyStats() {
    const m = new Map();
    Object.values(S.stage).forEach((s) => {
      if (s.tn) m.set(dayKey(s.tn), { ...(m.get(dayKey(s.tn)) || { tn: 0, don: 0 }), tn: ((m.get(dayKey(s.tn)) || {}).tn || 0) + 1 });
      if (s.don) m.set(dayKey(s.don), { ...(m.get(dayKey(s.don)) || { tn: 0, don: 0 }), don: ((m.get(dayKey(s.don)) || {}).don || 0) + 1 });
    });
    const today = dayKey(Date.now());
    const t = m.get(today) || { tn: 0, don: 0 };
    const days = [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
    return { today: t, days };
  }
  // tải một file do tiện ích tạo (không gắn vào trang → trang không chặn được)
  function saveFile(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return name;
  }
  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  };
  // sao lưu tiến độ: chỉ số TB + giờ + trạng thái (không có tên, số giấy tờ)
  function backupStage() {
    const obj = { loai: 'vbdlis-tien-do', phienBan: PANEL_VERSION, luc: new Date().toISOString(), soTB: Object.keys(S.stage).length, tienDo: S.stage };
    const name = saveFile(`tien-do-vbdlis-${stamp()}.json`, new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
    safeSet({ tbBakAt: Date.now() });
    return name;
  }
  // nạp file sao lưu: gộp vào tiến độ hiện có (TB đã có dấu thì giữ, chỉ bổ sung phần còn thiếu)
  async function restoreStage(file) {
    const j = JSON.parse(await file.text());
    const inc = j && j.loai === 'vbdlis-tien-do' ? j.tienDo : null;
    if (!inc || typeof inc !== 'object') throw new Error('không phải file sao lưu tiến độ của tiện ích (tien-do-vbdlis-….json)');
    const latest = (await store.get('tbStage')).tbStage || {};
    let add = 0;
    let upd = 0;
    for (const [id, v] of Object.entries(inc)) {
      if (!v || typeof v !== 'object') continue;
      const cur = latest[id];
      if (!cur) {
        latest[id] = v;
        add++;
        continue;
      }
      const m = { ...cur };
      ['tn', 'tnBy', 'don', 'donBy', 'lech', 'hoan', 'ack'].forEach((k) => {
        if (m[k] == null && v[k] != null) m[k] = v[k];
      });
      if (JSON.stringify(m) !== JSON.stringify(cur)) {
        latest[id] = m;
        upd++;
      }
    }
    S.stage = latest;
    await store.set({ tbStage: latest });
    renderTop();
    return { add, upd, luc: j.luc };
  }
  // hộp đang mở che bảng → khóa phần bên dưới (Tab / Enter không tới được nút bị che)
  const coverPanel = (on) => {
    [$('.bd'), $('#result')].forEach((el) => {
      if (el) el.inert = !!on;
    });
  };
  function progressTsv() {
    const head = ['TB', 'Trạng thái', 'Người nộp', 'Số thửa', 'Tiếp nhận lúc', 'Nhập đơn xong lúc', 'Cần xem'];
    const rows = S.data.map((x) => {
      const p = progressInfo(x);
      return [x.tb, STAGE_TEXT[p.st], whoOf(x), (x.thua || []).length, fmtIso(p.s.tn), fmtIso(p.s.don), p.warn.join('; ')];
    });
    return [head, ...rows].map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n');
  }
  function downloadTsv() {
    // UTF-16 (có BOM) + dấu Tab: Excel mở thẳng, đúng tiếng Việt, tách đúng cột với mọi cài đặt vùng
    const text = progressTsv();
    const buf = new Uint8Array(2 + text.length * 2);
    buf[0] = 0xff;
    buf[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      buf[2 + 2 * i] = c & 255;
      buf[3 + 2 * i] = c >> 8;
    }
    return saveFile(`tien-do-vbdlis-${stamp()}.csv`, new Blob([buf], { type: 'text/csv' }));
  }
  function selectTb(id) {
    if (S.running || !S.data.some((x) => String(x.tb) === String(id))) return false;
    S.cur = String(id);
    S.confirmTn = null;
    S.confirmDon = null;
    saveUi();
    setResult('');
    setEvt('');
    render();
    return true;
  }
  async function openProgress() {
    const oldDlg = pn.querySelector('.dlg');
    if (oldDlg) {
      const t = oldDlg.querySelector('#dlgTxt');
      if (t && t.value.trim()) {
        // hộp Dữ liệu còn chữ dán chưa “Gộp vào” → không tự đóng (khỏi mất chữ)
        setStatus('Hộp Dữ liệu đang có chữ chưa “Gộp vào” – gộp hoặc đóng hộp đó trước.', true);
        return t.focus();
      }
      const c = oldDlg.querySelector('#dlgClose, #pgClose');
      if (c) c.click();
      else oldDlg.remove();
    }
    const bakAt = (await store.get('tbBakAt')).tbBakAt;
    const d = document.createElement('div');
    d.className = 'dlg';
    d.tabIndex = -1;
    let filter = 'all';
    const draw = () => {
      const cur = curTB();
      const info = S.data.map((x) => ({ x, p: progressInfo(x) }));
      const cnt = { all: info.length, chua: 0, tn: 0, don: 0, hoan: 0, warn: 0 };
      info.forEach(({ p }) => {
        cnt[p.st]++;
        if (p.warn.length) cnt.warn++;
      });
      const shown = info.filter(({ p }) => filter === 'all' || (filter === 'warn' ? p.warn.length : p.st === filter));
      const fb = (f, label) => `<button class="btn${filter === f ? ' on' : ''}" data-f="${f}">${label} (${cnt[f]})</button>`;
      const ds = dailyStats();
      const days = ds.days.map(([k, v]) => `${k.slice(8, 10)}/${k.slice(5, 7)}: ${v.tn} tiếp nhận, ${v.don} xong`).join(' · ');
      d.innerHTML = `<div class="dh"><b>Tiến độ – ${S.data.length} TB</b><span class="sp"></span><button class="btn x" id="pgClose" title="Đóng (phím Esc)">✕ Đóng</button></div>
        <div class="days">Hôm nay: <b>${ds.today.tn}</b> TB tiếp nhận · <b>${ds.today.don}</b> TB xong${days ? `<br><span class="muted">${esc(days)}</span>` : ''}</div>
        <div class="row pgf">${fb('all', 'Tất cả')}${fb('chua', '○ Chưa làm')}${fb('tn', '◐ Đã tiếp nhận')}${fb('don', '✓ Xong')}${cnt.hoan ? fb('hoan', '⏸ Tạm hoãn') : ''}${fb('warn', '⚠ Cần xem')}</div>
        <div class="pgl"><table class="sh"><tr><th></th><th>TB</th><th>Người nộp</th><th>Thửa</th><th>Tiếp nhận</th><th>Nhập đơn</th><th>Cần xem</th></tr>${
          shown
            .map(
              ({ x, p }) =>
                `<tr data-tb="${esc(x.tb)}" class="${x === cur ? 'cur' : ''} ${p.s.lech ? 'bad' : p.st === 'hoan' ? 'gap' : ''}"><td>${STAGE_ICON[p.st]}</td><td>${esc(x.tb)}</td><td>${esc(whoOf(x))}</td><td>${(x.thua || []).length}</td><td>${esc(fmtTime(p.s.tn))}</td><td>${esc(fmtTime(p.s.don))}</td><td>${esc(p.warn.join('; '))}</td></tr>`
            )
            .join('') || '<tr><td colspan="7" class="muted">Không có TB nào.</td></tr>'
        }</table></div>
        <div class="row"><button class="btn" id="pgCopy" title="Sao chép cả bảng – dán vào Excel là đúng cột">⧉ Sao chép bảng</button><button class="btn" id="pgCsv" title="Tải file mở bằng Excel">⬇ Tải file Excel</button></div>
        <div class="row"><button class="btn" id="pgBak" title="Lưu tiến độ ra file (chỉ số TB, giờ, trạng thái – không có tên, số giấy tờ)">⬇ Sao lưu tiến độ</button><button class="btn" id="pgRes" title="Nạp lại tiến độ từ file sao lưu (gộp với tiến độ hiện có)">⬆ Nạp tiến độ…</button><input type="file" id="pgFile" accept=".json,application/json" style="display:none"><span class="muted" style="font-size:11px">${bakAt ? `Sao lưu gần nhất: ${esc(fmtTime(bakAt))}` : 'Chưa sao lưu lần nào'}</span></div>
        <div class="hint">Bấm một dòng để chọn TB đó. Tiện ích tự đánh dấu khi trang báo “Lưu hồ sơ thành công” (◐) / “Lưu đơn đăng ký thành công” (✓) sau khi bạn chạy “▶ Chạy cả TB”; sai thì đổi ô Trạng thái của TB đó. Gỡ / cài lại tiện ích hay đổi máy thì tiến độ mất – nên <b>Sao lưu tiến độ</b> cuối mỗi ngày.</div>
        <div id="pgMsg" class="hint"></div>`;
    };
    draw();
    d.style.top = ($('.hd').offsetHeight || 37) + 'px';
    pn.classList.add('dlgopen');
    pn.appendChild(d);
    coverPanel(true);
    setTimeout(() => {
      const c = d.querySelector('#pgClose');
      if (c) c.focus(); // để phím Esc đóng được hộp
    }, 0);
    const closeDlg = () => {
      d.remove();
      pn.classList.remove('dlgopen');
      coverPanel(false);
    };
    const msg = (t, bad) => {
      const m = d.querySelector('#pgMsg');
      if (!m) return;
      m.textContent = t;
      m.className = 'hint ' + (bad ? 'bad' : 'ok');
    };
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDlg();
      }
    });
    d.addEventListener('change', async (e) => {
      if (e.target.id !== 'pgFile') return;
      const inp = e.target;
      const file = inp.files && inp.files[0];
      inp.value = '';
      if (!file) return;
      try {
        const r = await restoreStage(file);
        draw();
        msg(`Đã nạp tiến độ (bản sao lưu ${r.luc ? fmtTime(Date.parse(r.luc)) : ''}): thêm ${r.add} TB, bổ sung ${r.upd} TB.`);
      } catch (err) {
        msg('Không nạp được: ' + friendly(err), true);
      }
    });
    d.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      const row = e.target.closest('tr[data-tb]');
      if (b && b.id === 'pgClose') return closeDlg();
      if (b && b.dataset.f) {
        filter = b.dataset.f;
        return draw();
      }
      if (b && b.id === 'pgCopy') return msg((await copyText(progressTsv())) ? `Đã sao chép ${S.data.length} TB – dán vào Excel.` : 'Không sao chép được.', false);
      if (b && b.id === 'pgCsv') {
        try {
          return msg(`Đã tải “${downloadTsv()}” vào thư mục Tải xuống.`);
        } catch (err) {
          return msg('Không tải được file: ' + friendly(err), true);
        }
      }
      if (b && b.id === 'pgBak') {
        try {
          const name = backupStage();
          draw();
          return msg(`Đã lưu “${name}” vào thư mục Tải xuống – cất file này cẩn thận (cài lại tiện ích thì Nạp tiến độ từ file này).`);
        } catch (err) {
          return msg('Không sao lưu được: ' + friendly(err), true);
        }
      }
      if (b && b.id === 'pgRes') return d.querySelector('#pgFile').click();
      if (row) {
        if (S.running) return msg('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi đổi TB.', true);
        if (selectTb(row.dataset.tb)) closeDlg();
      }
    });
  }

  // ---------- khởi động ----------
  (async () => {
    const r = await store.get(['tbData', 'tbDone', 'tbCur', 'tbTab', 'tbOpts', 'tbBox', 'tbStage']);
    S.opts = r.tbOpts || {};
    applyBox(r.tbBox);
    S.data = (r.tbData || []).sort(byTb);
    S.done = r.tbDone || {};
    S.stage = r.tbStage || {};
    S.cur = r.tbCur;
    S.tab = TABS[r.tbTab] ? r.tbTab : 'bn';
    let sync = null;
    try {
      sync = await syncFromFolder();
    } catch (e) {}
    if (sync && sync.data) S.data = sync.data.slice().sort(byTb);
    // TB vừa được cập nhật từ file (chủ / thửa có thể đổi thứ tự) → bỏ dấu ✓ từng mục cũ, giữ tiến độ tiếp nhận / nhập đơn
    if (sync && sync.updated && sync.updated.length) {
      sync.updated.forEach(clearDone);
      saveUi();
    }
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
