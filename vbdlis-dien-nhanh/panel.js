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
  // thửa ĐẤT Ở (MĐSD ONT / ODT – bạn yêu cầu 23/11): nguồn gốc “có thu tiền”, thời hạn “Lâu dài”
  const DAT_O_NGUON_GOC = 'Công nhận QSDĐ như giao đất có thu tiền sử dụng đất';
  const DAT_O_THOI_HAN = 'Lâu dài';
  // cửa sổ "Nhập đơn đăng ký" (bước xử lý hồ sơ)
  const DEFAULT_DIEU_KIEN = 'Chưa đủ điều kiện cấp giấy';
  const KHONG_DOI = '(không đổi)';
  const DEAD_MSG = 'Tiện ích vừa được tải lại nên bảng này đã mất kết nối. Bấm biểu tượng tiện ích (Alt+Q) để mở bảng mới – dữ liệu vẫn còn nguyên.';
  const PANEL_VERSION = '1.21.17'; // tăng mỗi lần sửa bảng – bảng khác phiên bản sẽ bị thay bằng bảng mới
  // bảng đang hiện hay bạn đã ẩn (×) – trang tải lại khi bật Tự động hết thì chỉ mở lại bảng nếu bạn không ẩn
  const noteShown = (on) => {
    try {
      const p = chrome.runtime.sendMessage({ type: 'vbdlis-shown', on: !!on });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  };
  const old = document.getElementById(HOST_ID);
  if (old) {
    // Bảng đang mở cùng phiên bản và còn kết nối → bấm biểu tượng là ẩn/hiện; ngược lại thay bảng mới
    old.removeAttribute('data-alive');
    document.dispatchEvent(new CustomEvent('vbdlis-ping'));
    if (old.getAttribute('data-alive') === '1' && old.getAttribute('data-ver') === PANEL_VERSION) {
      // 🤖 đang bật (24/11): bấm biểu tượng chỉ thu nhỏ / mở lại bảng – 🤖 vẫn chạy
      if (old.getAttribute('data-auto') === '1' && old.style.display !== 'none') {
        old.dispatchEvent(new CustomEvent('vbdlis-min'));
        return;
      }
      old.style.display = old.style.display === 'none' ? '' : 'none';
      noteShown(old.style.display !== 'none');
      return;
    }
    old.remove();
  }
  noteShown(true);

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
  // stage: tiến độ từng TB trên VBDLIS { "<tb>": { tn: lúc tiếp nhận, tnBy, don: lúc nhập đơn xong, donBy, lech: số ô lệch,
  //   xong: lúc xong hẳn (đã Trả hồ sơ – bạn chốt 23/11), xongBy } } – nhập đơn / lưu kho xong vẫn chưa Xong
  // armed: TB vừa chạy xong, đang chờ trang báo “Lưu … thành công” để tự đánh dấu
  const S = { data: [], cur: null, tab: 'bn', done: {}, stage: {}, armed: null, lastScan: '', busy: false, running: false, pendingData: null, opts: {}, tpl: {}, tplDraft: null, autoSig: '', lastMsg: {}, toasts: [], autoFail: new Set(), autoPend: '', autoHold: new Map(), holdNote: '', tabId: undefined, autoTab: null, tplRan: new Set(), tplLast: {}, tplIdx: {}, resumeN: {}, stk: null, ld: { items: {}, cur: null, idleAt: 0, block: '', tt: null, pages: 0, refAt: 0 } };
  const safeSet = (obj) => {
    try {
      const p = store.set(obj);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  };
  const safeRemove = (k) => {
    try {
      const p = store.remove(k);
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
  // dấu ✓ từng mục (tbDone): chỉ ghi những khóa tab này đã đổi, lên bản mới nhất trong bộ nhớ
  // (tab VBDLIS khác có thể vừa ghi khóa của nó – không ghi đè cả bảng)
  let doneBase = {}; // tbDone như lần cuối tab này đọc / ghi
  let doneChain = Promise.resolve();
  const doneChanged = () =>
    [...new Set([...Object.keys(S.done), ...Object.keys(doneBase)])].filter((k) => S.done[k] !== doneBase[k]);
  const saveDone = () => {
    doneChain = doneChain
      .then(async () => {
        const ch = doneChanged();
        if (!ch.length) return;
        const all = (await store.get('tbDone')).tbDone || {};
        ch.forEach((k) => {
          if (k in S.done) all[k] = S.done[k];
          else delete all[k];
        });
        doneBase = { ...all };
        await store.set({ tbDone: all });
      })
      .catch(() => {});
  };
  const saveUi = () => {
    safeSet({ tbCur: S.cur, tbRecv: S.recv, tbCurBy: S.curBy || '', tbTab: S.tab });
    saveDone();
  };
  // TB đang hiện ở trên (bảng điền, nút ▶ của bạn). (25/11) chạy theo TB 🤖 / lần chạy đang làm (tìm, kiểm, mở hồ sơ cũ…)
  const curTB = () => S.data.find((x) => String(x.tb) === String(S.cur)) || S.data[0] || null;
  // (25/11) con trỏ tiếp nhận: TB chưa tiếp nhận tiếp theo của 🤖 tính từ đây (trước đây chính là TB đang hiện). Chỉ đổi khi BẠN chọn TB
  // (danh sách TB, ‹ ›, → TB chưa làm, nút của TB) hoặc 🤖 sang tiếp nhận TB sau – 🤖 làm hồ sơ cũ thì TB ở trên chạy theo, con trỏ giữ nguyên
  const recvTB = () => S.data.find((x) => String(x.tb) === String(S.recv)) || (S.recv != null ? S.data[0] || null : curTB());
  // chọn TB làm TB đang hiện VÀ con trỏ tiếp nhận (như trước 25/11)
  const setPtr = (id) => {
    S.cur = id == null ? null : String(id);
    S.recv = S.cur;
    S.curBy = '';
    S.viewWant = null;
  };
  // (25/11) TB ở trên chạy theo TB lần chạy đang làm – CHỈ đổi TB đang hiện. Bạn đang gõ / chọn trong bảng → chưa đổi (khỏi ghi chữ bạn gõ
  // sang TB khác), bạn rời ô là đổi
  function viewTb(x) {
    if (!x) return;
    const id = String(x.tb);
    if (String(S.cur) === id) {
      S.viewWant = null;
      return;
    }
    const a = root.activeElement;
    const typing =
      !!a &&
      !a.disabled &&
      (a.tagName === 'TEXTAREA' ||
        a.isContentEditable ||
        (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|file|range|color|image)$/i.test(a.type || '')) ||
        (a.tagName === 'SELECT' && a.id !== 'tbSel' && a.id !== 'tbStage'));
    if (typing) {
      S.viewWant = id;
      return;
    }
    S.viewWant = null;
    S.cur = id;
    S.curBy = id === String(S.recv) ? '' : 'auto';
    saveUi();
    render();
  }
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
  // Trạng thái của chuỗi: ○ chưa tiếp nhận → ◐ đã tiếp nhận (nhập đơn xong VẪN là đây) → ✓ Xong. Chữ hiện cho bạn: showStage (4 mức)
  const stageOf = (tb) => {
    const s = tb && S.stage[String(tb.tb)];
    return s && s.xong ? 'xong' : s && s.hoan ? 'hoan' : s && (s.tn || s.don) ? 'tn' : 'chua';
  };
  const STAGE_ICON = { chua: '○', tn: '◐', xong: '✓', hoan: '⏸' };
  // Trạng thái HIỆN cho bạn (bạn yêu cầu 23/11 – 4 mức): ○ Chưa xong (cả TB đã tiếp nhận / đã nhập đơn mà chưa chuyển lãnh đạo) →
  // ◐ Đã nhập nhưng chưa xong (đã Thực thi chuyển lãnh đạo) → ✓ Xong; ⏸ Tạm hoãn. Chỉ để hiện: chuỗi tự động vẫn dùng stageOf
  // (TB đã tiếp nhận chưa – không tiếp nhận lại TB đã tiếp nhận)
  const STAGE_TEXT = { chua: 'Chưa xong', tn: 'Đã nhập nhưng chưa xong', xong: 'Xong', hoan: 'Tạm hoãn' };
  const showStage = (tb) => {
    const st = stageOf(tb);
    if (st === 'xong' || st === 'hoan') return st;
    const s = tb && S.stage[String(tb.tb)];
    // ◐ cả khi hồ sơ đã ở chặng cuối (lãnh đạo trả về, sang bước Trả kết quả, đang Trả hồ sơ) mà chưa Trả hồ sơ xong (bạn chốt 23/11:
    // “xong cái bước này (Trả hồ sơ) thì được tích là đã xong – chưa xong bước này thì phải ở trạng thái đã nhập nhưng chưa xong”)
    // (rà lại 1.21.4) cả khi đã bấm Thực thi chuyển lãnh đạo mà chưa xác nhận – dấu đang chuyển, không có dấu lỗi (kể cả BẠN tự bấm)
    // (24/11) cả TB đang ✓ mà lượt kiểm lại thấy hồ sơ vẫn còn trong Danh sách hồ sơ thụ lý (dấu sot – đã bỏ ✓)
    return s && (s.ld || s.daDung || s.kd || s.kq || s.trk || s.sot || (s.fwd && (/^(trk|tra)$/.test(s.fwd.k) || (s.fwd.k === 'ld' && !s.fwd.bad && !s.fwd.tt)))) ? 'tn' : 'chua';
  };
  const BY_TEXT = {
    auto: 'tự ghi nhận',
    tay: 'đánh dấu tay',
    don: 'suy ra từ bước nhập đơn',
    suy: 'suy ra từ trang VBDLIS',
    ds: 'suy ra: không còn trong Danh sách hồ sơ thụ lý',
    qt: 'theo ô “Đã xử lý” của Quy trình',
    kq: 'suy ra từ Quy trình 5 tác vụ (lãnh đạo đã trả về)',
  };
  // dấu “đang chuyển” (fwd.k) → chữ ngắn (dòng tiến độ) / chữ đủ (cảnh báo)
  const FWD_TEXT = { cv: 'chuyển CV', ld: 'chuyển LĐ', trk: 'chuyển bước Trả KQ', tra: 'Trả hồ sơ', iso: 'Kết ISO', oth: 'chuyển bước khác' };
  const FWD_LONG = { cv: 'Thực thi chuyển chuyên viên', ld: 'Thực thi chuyển lãnh đạo', trk: 'Thực thi chuyển bước Trả kết quả', tra: 'Thực hiện Trả hồ sơ', iso: 'Thực hiện Kết ISO', oth: 'Thực thi chuyển sang bước khác' };
  // ghi dấu “đang chuyển tiếp” TRƯỚC khi bấm Thực thi (trang có thể tải lại ngay) – lần sau nhìn Quy trình là biết đã chuyển chưa
  // dấu phụ của một TB (không đổi trạng thái): tnClick (đã bấm Lưu hồ sơ), htClick (đã bấm Hoàn tất), fwd (đang chuyển tiếp)…
  // – ghi TRƯỚC khi bấm nút không làm lại được (trang có thể tải lại ngay); v = null → xóa dấu
  const setMark = (id, k, v) => {
    id = String(id);
    const s = { ...(S.stage[id] || {}) };
    if (v == null) delete s[k];
    else s[k] = v;
    if (Object.keys(s).length) S.stage[id] = s;
    else delete S.stage[id];
    return saveStage(id);
  };
  const setFwd = (id, k) => {
    const s0 = S.stage[String(id)];
    if (s0 && s0.traMiss) delete s0.traMiss; // lần bấm mới – dấu “không thấy khi tìm” của lần trước không còn giá trị
    return setMark(id, 'fwd', { k, at: Date.now() });
  };
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
  // stage: 'chua' | 'tn' | 'don' (mốc nhập đơn xong) | 'quet' (mốc lưu kho hồ sơ quét) | 'xong' | 'hoan'; by: 'auto' | 'tay' | 'don'
  // Tự động: ✓ Xong CHỈ khi Trả hồ sơ xong (mốc 'tra' – bạn chốt 23/11); nhập đơn / lưu kho chỉ ghi mốc. Đánh dấu tay 'xong' thì Xong luôn.
  // 'hoan' (tạm hoãn) giữ dấu tiếp nhận / nhập đơn nếu có, bỏ dấu Xong; đánh dấu khác thì bỏ hoãn. “Đã xem ghi chú” (ack) luôn được giữ.
  // đổi tay về ◐: bỏ dấu Xong VÀ dấu đã Trả hồ sơ (cả dấu đang Trả hồ sơ / không thấy khi tìm) – 🤖 sẽ làm lại chặng cuối của TB đó
  const unXong = (s0) => {
    const s = { ...(s0 || {}) };
    ['xong', 'xongBy', 'tra', 'traBy', 'traMiss', 'ldUnk'].forEach((k) => delete s[k]);
    if (s.fwd && s.fwd.k === 'tra') delete s.fwd;
    return s;
  };
  // BẠN đổi về ◐ (ô Trạng thái / hàng loạt / Excel): TB đang ✓ do tiện ích tự suy ra (không còn trong danh sách) → ghi dsNo – lượt tìm không tự tích lại
  const unXongTay = (s0) => {
    const s = unXong(s0);
    if (s0 && (s0.xongBy === 'ds' || s0.traBy === 'ds')) s.dsNo = Date.now();
    return s;
  };
  function markStage(id, stage, by, extra) {
    id = String(id);
    const now = Date.now();
    const wasHoan = !!(S.stage[id] || {}).hoan;
    const before = JSON.stringify(S.stage[id] || {});
    const s = { ...(S.stage[id] || {}) };
    if (stage === 'chua') {
      [
        'tn', 'tnBy', 'don', 'donBy', 'lech', 'quet', 'quetBy', 'xong', 'xongBy', 'hoan', 'nhap', 'boQua',
        'cv', 'cvBy', 'ld', 'ldBy', 'trk', 'trkBy', 'tra', 'traBy', 'fwd', 'tnClick', 'htClick', 'kq', 'daDung', 'kd', 'traMiss', 'sot', 'chk', 'chkTry', 'dsNo', 'sotN', 'chkN', 'ldUnk',
      ].forEach((k) => delete s[k]);
    } else if (stage === 'hoan') {
      delete s.xong;
      delete s.xongBy;
      s.hoan = { at: now, lyDo: (extra && extra.lyDo) || '', ...(extra && extra.ask ? { ask: 1 } : {}) };
    } else {
      delete s.hoan;
      delete s.tnClick; // đã có mốc tiếp nhận → bỏ dấu “đã bấm Lưu hồ sơ, chưa thấy báo”
      if (!s.tn) {
        s.tn = now;
        s.tnBy = by;
      }
      if (stage === 'don') delete s.htClick;
      if (stage === 'don' || stage === 'quet') {
        // nhập đơn xong / lưu kho hồ sơ quét xong: chỉ ghi mốc giờ (✓ Xong khi Trả hồ sơ xong)
        if (!s[stage]) {
          s[stage] = now;
          s[stage + 'By'] = by;
        }
        if (stage === 'don' && extra && 'lech' in extra) s.lech = extra.lech;
        // (bản cũ: đủ nhập đơn + lưu kho → Xong. Đã bỏ – bạn chốt 23/11: chỉ Trả hồ sơ xong mới ✓ Xong, chưa thì ◐ Đã nhập nhưng chưa xong)
      } else if (stage === 'cv' || stage === 'ld' || stage === 'trk' || stage === 'tra') {
        // đã chuyển tiếp cho chuyên viên / lãnh đạo / bước Trả kết quả, đã Trả hồ sơ (Tự động hết): chỉ ghi mốc giờ, không đổi trạng thái
        if (!s[stage]) {
          s[stage] = now;
          s[stage + 'By'] = by;
        }
        if (stage === 'ld' && !s.cv) {
          s.cv = now;
          s.cvBy = 'suy';
        }
        // Trả hồ sơ thành công → TB ✓ Xong (bạn yêu cầu 22/11: “khi hiện thành công thì đánh TB ý đã xong”)
        if (stage === 'tra' && !s.xong) {
          s.xong = now;
          s.xongBy = by;
          delete s.chkN; // ✓ mới – lượt kiểm đếm lại số lần chưa chắc
        }
        if (stage === 'tra') {
          if (by !== 'ds') delete s.ldUnk; // Trả hồ sơ thật (🤖 / bạn) → hết “chưa rõ lãnh đạo trả chưa”
          if (by === 'tay' && s.sot) s.chk = now; // bạn tự xác nhận đã trả → lượt kiểm thôi kiểm lại TB này
          delete s.sot; // đã trả xong → hết sót
          delete s.dsNo;
        }
        if (s.fwd && (s.fwd.k === stage || (stage === 'ld' && s.fwd.k === 'cv'))) delete s.fwd;
      } else if (stage === 'xong') {
        if (!s.xong) {
          s.xong = now;
          s.xongBy = by;
          delete s.chkN;
        }
        if (by === 'tay' && s.sot) s.chk = now; // bạn tích ✓ lại bằng tay sau khi lượt kiểm đổi về ◐ → quyết định của bạn, thôi kiểm lại
        if (by === 'tay') delete s.ldUnk; // bạn tích ✓ tay → thôi kiểm lại định kỳ
        delete s.sot;
      } else {
        // về “Đã tiếp nhận”: bỏ dấu Xong, giữ mốc nhập đơn (nếu có)
        delete s.xong;
        delete s.xongBy;
      }
    }
    if (Object.keys(s).length) S.stage[id] = s;
    else delete S.stage[id];
    if (by !== 'tay' && /^(ld|trk|tra|xong)$/.test(stage)) S.nsRun = 0; // 🤖 chạy liên tục: có TB đi được tới chuyển lãnh đạo / trả → đếm lại
    const changed = JSON.stringify(s) !== before; // (soát 24/11) ghi lại dấu đã có (vd. lưu kho lần 2) không phải tiến triển
    if (changed && by !== 'tay' && stage !== 'hoan' && stage !== 'chua') S.progN = (S.progN || 0) + 1; // số bước tiện ích ghi được (bộ ngắt 5 TB)
    if (changed && stage !== 'hoan' && S.resumeN) delete S.resumeN[id]; // TB đi tiếp được / bạn đổi trạng thái → đếm lại số lần 🤖 tự làm tiếp
    // (24/11) bạn bỏ tạm hoãn TB đang ở chặng trước lãnh đạo (○ đã tiếp nhận) → 🤖 tìm ở danh sách làm lại TB đó (lượt tìm thường chỉ tìm TB ◐)
    if (wasHoan && stage !== 'hoan' && by === 'tay' && s.tn && !s.ld) redoSet(id, true);
    else if (/^(ld|hoan|tra|xong|chua)$/.test(stage)) redoSet(id, false);
    if (S.armed && S.armed.tb === id && by === 'tay') S.armed = null; // bạn tự đổi → bỏ chờ tự ghi nhận
    if (S.armedScan && S.armedScan.tb === id && by === 'tay') S.armedScan = null;
    // TB 🤖 làm dở (mở từ Danh sách hồ sơ thụ lý) đã chuyển lãnh đạo / đã trả hồ sơ / bạn đổi trạng thái → thôi nhớ
    if (/^(ld|tra|chua|hoan)$/.test(stage) && S.chainTb && String(S.chainTb.tb) === id) setChainTb(null);
    saveStage(id);
    renderTop();
  }
  // ---------- thửa bỏ qua ----------
  // S.stage[tb].nhap: thửa (khóa “tờ|thửa”) đã thấy vào bảng tiếp nhận / vào đơn của TB đó
  // S.stage[tb].boQua: thửa bạn đóng cửa sổ mà không lưu (VBDLIS báo trùng…) → lần chạy sau không mở lại
  const stageList = (id, k) => (S.stage[String(id)] || {})[k] || [];
  function setStageList(id, k, key, on) {
    id = String(id);
    const s = { ...(S.stage[id] || {}) };
    const set = new Set(s[k] || []);
    if (on === set.has(key)) return;
    if (on) set.add(key);
    else set.delete(key);
    if (set.size) s[k] = [...set];
    else delete s[k];
    if (Object.keys(s).length) S.stage[id] = s;
    else delete S.stage[id];
    saveStage(id);
  }
  const thuaOk = (t) => !!String(t.soThua || '').trim() && !!String(t.soTo || '').trim();
  // thửa này đã nhập ở TB khác chưa (cùng số tờ, số thửa) → trả về số TB đó
  function enteredElsewhere(tb, key) {
    for (const x of S.data) {
      if (String(x.tb) === String(tb.tb)) continue;
      const list = (x.thua || []).filter(thuaOk);
      if (!list.some((t) => thuaKey(t) === key)) continue;
      const s = S.stage[String(x.tb)] || {};
      // có danh sách thửa đã nhập thì theo đó; TB đánh dấu tay (không có danh sách): ✓ xong → mọi thửa, ◐ → thửa đầu
      const hit = s.nhap ? s.nhap.includes(key) : s.don || s.xong ? true : s.tn ? thuaKey(list[0]) === key : false;
      if (hit) return String(x.tb);
    }
    return null;
  }
  // thửa của TB sẽ bỏ qua (chỉ số → lý do): ghi 2 lần trong danh sách, đã nhập ở TB khác, hoặc lần trước bạn đóng không lưu
  function skipMap(tb) {
    const out = new Map();
    const seen = new Set();
    const bq = new Set(stageList(tb.tb, 'boQua'));
    (tb.thua || []).forEach((t, i) => {
      if (!thuaOk(t)) return;
      const k = thuaKey(t);
      if (seen.has(k)) return out.set(i, { why: 'trùng với thửa ở trên trong danh sách của TB này', kind: 'list' });
      seen.add(k);
      const other = enteredElsewhere(tb, k);
      if (other) return out.set(i, { why: `trùng với TB ${other} (đã nhập ở TB đó)`, kind: 'other' });
      if (bq.has(k)) out.set(i, { why: 'lần trước bạn đóng cửa sổ không lưu (thửa trùng?)', kind: 'boQua' });
    });
    return out;
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
      return await chrome.runtime.sendMessage({ ...msg, speed: SPEEDS[S.opts.tocDo] || 1 });
    } catch (e) {
      return { ok: false, error: friendly(e) };
    }
  }

  // ---------- giao diện ----------
  const CSS = `
.ldt{width:100%;border-collapse:collapse;margin:4px 0;font-size:12px}.ldt td{padding:2px 4px;border-top:1px solid #e2e8f0;vertical-align:top}.ldt td:first-child{white-space:nowrap}.ldblock{color:#b91c1c;font-weight:600;margin:4px 0}
:host{all:initial}
*{box-sizing:border-box;font-family:"Segoe UI",system-ui,Arial,sans-serif}
.pn{position:relative;width:var(--w,420px);height:var(--h,auto);max-height:var(--mh,calc(100vh - 90px));display:flex;flex-direction:column;background:#fff;color:#1f2937;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.28);font-size:12.5px;line-height:1.35;overflow:hidden}
.hd{display:flex;align-items:center;gap:6px;padding:7px 10px;background:#0f766e;color:#fff;cursor:move;user-select:none}
.hd b{font-size:13px;flex:1}
.hd button{background:rgba(255,255,255,.18);border:0;color:#fff;width:24px;height:22px;border-radius:5px;cursor:pointer;font-size:14px;line-height:1}
.hd button:hover{background:rgba(255,255,255,.3)}
.hd button#miniAuto{display:none;width:auto;padding:0 6px;font-size:13px}.pn.min .hd button#miniAuto{display:inline-block}.pn.min .hd button#rec{display:none}.hd button#miniAuto.on{background:#16a34a;box-shadow:0 0 0 2px #bbf7d0}
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
.sqlist{max-height:180px;overflow:auto;margin:6px 0;font-size:12px}
.sq{padding:3px 0;border-bottom:1px dashed #e2e8f0}.sq:last-child{border-bottom:0}
.chip{display:inline-flex;align-items:center;gap:2px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;padding:0 2px 0 7px;margin:1px 2px;font-size:11px;color:#155e75}
.btn.auto{font-weight:600}.btn.auto.on{background:#16a34a;border-color:#16a34a;color:#fff}.btn.bulk.on{background:#7c3aed;border-color:#7c3aed;color:#fff}
.tpl td input,.tpl td select{font-size:11.5px;padding:2px 4px}.tpl td:first-child{width:20px;text-align:center}.tpl tr.ban td{color:#94a3b8}.tpl td textarea{font-size:11.5px;padding:2px 4px;width:100%;resize:vertical;box-sizing:border-box}.tpl tr.vang td{opacity:.6}.tpl .btn.del{padding:0 5px;font-size:11px}
.chip .x{border:0;background:none;color:#64748b;cursor:pointer;padding:0 4px;font-size:11px;line-height:16px}.chip .x:hover{color:#b91c1c}
.hd button#dock{font-size:12px}.hd button#dock.on{background:#f59e0b}
.pn.dock{width:var(--dw,420px) !important;height:100vh !important;max-height:100vh !important;border-radius:0;border-width:0 0 0 1px;box-shadow:-6px 0 18px rgba(15,23,42,.18)}
.pn.dock .hd{cursor:default}.pn.dock .rz{display:none}
.pn.dock.min{width:220px !important;height:auto !important;max-height:none !important;border-radius:10px;border-width:1px;box-shadow:0 12px 32px rgba(15,23,42,.28)}
.dz{display:none;position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:6}
.pn.dock .dz{display:block}.pn.dock.min .dz{display:none}.dz:hover,.dz.drag{background:rgba(15,118,110,.3)}
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
  <div class="hd"><b>VBDLIS Điền Nhanh <small style="font-weight:400;opacity:.8">v${PANEL_VERSION}</small></b><button id="miniAuto" title="🤖 Tự động hết: bấm để bật (tự chạy luôn màn hình đang mở) / tắt">🤖</button><button id="rec" title="Ghi thao tác: ghi lại những gì bạn làm trên VBDLIS rồi xuất ra file để gửi người hỗ trợ">●</button><button id="dock" title="Gắn bảng sát cạnh phải, cao hết màn hình (trang VBDLIS dồn sang trái nhường chỗ)">📌</button><button id="min" title="Thu nhỏ">–</button><button id="close" title="Ẩn (Alt+Q để mở lại)">×</button></div>
  <div class="bd">
    <div class="row" id="roleRow"><span class="muted" style="flex:none">Vai trò:</span><select id="optVaiTro" title="Chuyên viên: tiếp nhận → nhập đơn → chuyển lãnh đạo → trả hồ sơ (như trước). Lãnh đạo: máy đăng nhập tài khoản lãnh đạo – 🤖 ký duyệt hồ sơ, chuyển bước 4 (như bản 0.9.3)."><option value="cv">Chuyên viên (tiếp nhận → nhập đơn → trả hồ sơ)</option><option value="ld">Lãnh đạo (ký duyệt → chuyển bước 4)</option></select></div>
    <div class="row" id="tbRow"><button class="btn" id="prev" title="TB trước">‹</button><select id="tbSel"></select><button class="btn" id="next" title="TB sau">›</button></div>
    <div class="row" id="stageRow"><span class="muted" style="flex:none">Trạng thái:</span><select id="tbStage" title="Tiện ích tự đánh dấu: ○ Chưa xong tới khi Thực thi chuyển lãnh đạo (đã tiếp nhận, đã nhập đơn vẫn là Chưa xong – dòng bên cạnh ghi giờ từng bước); ◐ Đã nhập nhưng chưa xong khi đã chuyển lãnh đạo; ✓ Xong khi Trả hồ sơ xong (đã ở bước Trả kết quả mà chưa trả xong vẫn là ◐). Sai thì sửa tay ở đây."><option value="chua">○ Chưa xong</option><option value="tn">◐ Đã nhập nhưng chưa xong (đã chuyển lãnh đạo)</option><option value="xong">✓ Xong</option><option value="hoan">⏸ Tạm hoãn</option></select><span id="stageInfo" class="muted"></span></div>
    <div class="row prog" id="progRow"><span id="progTxt" class="muted"></span><span class="sp"></span><button class="btn" id="scanQBtn" style="display:none" title="Hàng chờ file quét (DDK, TBXN) – bấm để xem">📎 0</button><button class="btn bulk" id="bulkBtn" title="Soát hàng loạt">⚡ Soát loạt</button><button class="btn" id="nextTodo" title="Chọn TB chưa tiếp nhận tiếp theo">→ TB chưa làm</button><button class="btn" id="progList" title="Bảng tiến độ tất cả TB – lọc TB chưa xong, xuất ra Excel">☰ Tiến độ</button></div>
    <div class="evt" id="evt" style="display:none"></div>
    <div class="row"><button class="btn" id="scan" title="Kiểm tra tiện ích còn tìm thấy đủ ô, nút cần dùng trên màn hình đang mở (khi VBDLIS đổi giao diện) – kèm danh sách nhãn → ô">Kiểm tra trang</button><button class="btn" id="dataBtn">Dữ liệu</button><button class="btn run" id="runAll" title="Màn hình Tiếp nhận hồ sơ: chọn Phường/Xã, quy trình, Số biên nhận, thêm thửa đầu, điền người nộp. Cửa sổ Nhập đơn đăng ký: chọn Điều kiện cấp giấy, tích Đăng ký lần đầu, rồi lần lượt tự bấm Thêm → Cá nhân / Thửa đất và điền từng chủ (tự Lưu chủ khi khớp), từng thửa (bạn bấm Lưu). Cửa sổ Quy trình xử lý: tự làm tác vụ Cập nhật dữ liệu pháp lý (Thực hiện, Đồng ý) và Lưu kho hồ sơ quét từ hàng chờ file (Cập nhật), tích Đã xử lý.">▶ Chạy cả TB</button><button class="btn auto" id="autoBtn" title="Tự động hết: bật lên thì tiện ích tự chạy khi bạn mở màn hình Tiếp nhận (trống), cửa sổ Nhập đơn đăng ký, Quy trình xử lý – tự bấm Lưu, Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, tác vụ 2–3, Chuyển tiếp / Thực thi (đúng tài khoản trong cài đặt), Trả hồ sơ. Ô lệch / hộp hỏi lạ / lỗi thì dừng, kêu ting chờ bạn. Kết ISO: chỉ khi bạn bật “Tự Kết ISO” (tab Biên nhận).">🤖 Tự động: TẮT</button><span class="sp"></span><button class="btn" id="resetDone" title="Xóa dấu ✓ của TB này">Xóa dấu ✓</button></div>
    <div class="note" id="note" style="display:none"></div>
    <div id="ldBox" style="display:none"></div>
    <div class="tabs">
      <button data-tab="bn">Biên nhận</button><button data-tab="chu">Chủ SD</button><button data-tab="thua">Thửa đất</button><button data-tab="gt">Giấy tờ</button><button data-tab="tr" title="Lấy tất cả các trường trên màn hình đang mở, tích trường cần điền">Trường</button>
    </div>
    <div id="content"></div>
  </div>
  <div id="split" class="split" title="Kéo lên / xuống để đổi chiều cao phần nhật ký bên dưới (bấm đúp: về mặc định)" style="display:none">•••</div>
  <div id="status" class="status"></div>
  <div id="result" class="result"></div>
  <div class="rz l" title="Kéo để phóng to / thu nhỏ bảng (bấm đúp: về cỡ mặc định)">◣</div><div class="rz r" title="Kéo để phóng to / thu nhỏ bảng (bấm đúp: về cỡ mặc định)">◢</div><div class="dz" title="Kéo để đổi bề rộng bảng (bấm đúp: về mặc định)"></div>
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
    bn: (tb) =>
      (tb
        ? `<div class="card ${isDone(tb, 'bn') ? 'done' : ''}">
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
      </div>`
        : '<div class="hint">Chưa có dữ liệu TB (vai trò Lãnh đạo không cần dữ liệu) – các ô cài đặt dưới vẫn dùng được: tài khoản Lãnh đạo / Chuyên viên, Chạy thử, Tốc độ, tiếng báo.</div>') +
      `<div class="card">
        <div class="ct">“▶ Chạy cả TB” thêm thửa nào ở bước tiếp nhận</div>
        <select id="optThuaTN">
          <option value="dau"${S.opts.thuaTN !== 'tatca' ? ' selected' : ''}>Chỉ thửa đầu tiên – đủ để lưu hồ sơ (các thửa nhập ở Nhập đơn đăng ký)</option>
          <option value="tatca"${S.opts.thuaTN === 'tatca' ? ' selected' : ''}>Tất cả các thửa của TB</option>
        </select>
      </div>
      <div class="card">
        <div class="ct">Khi “▶ Chạy cả TB” dừng chờ bạn</div>
        <label class="opt"><input type="checkbox" id="optAmBao"${S.opts.amBao !== false ? ' checked' : ''}> Kêu “ting” và nháy tên tab (để bạn làm việc khác trong lúc VBDLIS chạy chậm)</label>
        <label class="opt"><input type="checkbox" id="optEnter"${S.opts.enterLuu !== false ? ' checked' : ''}> Mọi ô đã điền khớp dữ liệu thì đặt sẵn con trỏ ở nút “Lưu” (thửa đất, “Cập nhật” hồ sơ quét…): kiểm tra xong chỉ cần nhấn Enter</label>
      </div>
      <div class="card">
        <div class="ct">Tự động (bạn cho phép)</div>
        <label class="opt"><input type="checkbox" id="optTuChu"${S.opts.tuLuuChu !== false ? ' checked' : ''}> Nhập chủ sử dụng tự động: mọi ô khớp dữ liệu thì tiện ích tự bấm “Lưu” cửa sổ chủ rồi sang chủ sau (thiếu dữ liệu, hoặc trang hỏi “Giấy tờ tùy thân đã tồn tại…” thì vẫn dừng chờ bạn)</label>
        <label class="opt"><input type="checkbox" id="optTuHsq"${S.opts.tuHsq !== false ? ' checked' : ''}> Lưu kho hồ sơ quét tự động: tự thêm dòng (bấm “Lưu” ở cửa sổ nhỏ “Thông tin hồ sơ quét”) và tự “Tải lên” file từ hàng chờ</label>
        <label class="opt"><input type="checkbox" id="optTuQT"${S.opts.tuQT !== false ? ' checked' : ''}> Quy trình xử lý tự động: tác vụ Cập nhật dữ liệu pháp lý (bấm “Thực hiện”, “Đồng ý”), Lưu kho hồ sơ quét (bấm “Cập nhật”, “Đóng”), tích “Đã xử lý”</label>
        <div class="hint">Nút <b>🤖 Tự động</b> (cạnh ▶): bật thì tiện ích làm hết – tự bấm cả Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Chuyển tiếp, Thực thi (chỉ chuyển cho đúng 2 tài khoản dưới). Tắt thì tiện ích không bấm các nút đó. Trả hồ sơ: 🤖 bấm Thực hiện, Đồng ý. Kết ISO: chỉ khi bạn bật “Tự Kết ISO” (mục dưới).</div>
      </div>
      <div class="card">
        <div class="ct">🤖 Tự động hết – chuyển tiếp hồ sơ</div>
        <div class="f"><label>Chuyên viên</label><input id="optCtCV" value="${esc(S.opts.ctCV || '')}" placeholder="tài khoản, vd. bgi.abc123_vy" spellcheck="false"><span></span></div>
        <div class="f"><label>Lãnh đạo</label><input id="optCtLD" value="${esc(S.opts.ctLD || '')}" placeholder="tài khoản, vd. bgi.xyz456_vy" spellcheck="false"><span></span></div>
        <div class="hint">Lưu hồ sơ → Xử lý hồ sơ → tích “Tiếp nhận hồ sơ” → Chuyển tiếp cho <b>Chuyên viên</b> (bước “2. Chuyên viên”) → Xử lý hồ sơ → nhập đơn (Lưu thông tin đăng ký, Hoàn tất, Đóng) → tích “Nhập đăng ký”, “Giấy tờ đính kèm” → Chuyển tiếp cho <b>Lãnh đạo</b> (bước “3. Lãnh đạo UBND xã”). Tiện ích chỉ chọn dòng có <b>Tên tài khoản</b> đúng y như trên; không thấy, thấy 2 dòng, hoặc bước nhận khác → dừng, kêu ting.</div>
        <div class="f"><label>Tốc độ</label><select id="optTocDo">${[
          ['nhanh', 'Nhanh – chờ ít giữa các bước'],
          ['vua', 'Bình thường'],
          ['cham', 'Chậm – mạng / VBDLIS chậm'],
          ['ratcham', 'Rất chậm – để nhìn từng bước'],
        ]
          .map(([v, t]) => `<option value="${v}"${(S.opts.tocDo || 'vua') === v ? ' selected' : ''}>${t}</option>`)
          .join('')}</select><span></span></div>
        <label class="opt"><input type="checkbox" id="optThuTT"${S.opts.thuThucThi ? ' checked' : ''}> Chạy thử: chọn sẵn đúng người rồi DỪNG ở “Thực thi” / “Trả hồ sơ” để tôi tự bấm (nên bật cho 1–2 hồ sơ đầu trên VBDLIS thật)</label>
        <label class="opt"><input type="checkbox" id="optTuISO"${S.opts.tuISO === true ? ' checked' : ''}> <b>Tự Kết ISO</b> (mặc định tắt): hồ sơ lãnh đạo trả về, Quy trình chỉ còn thiếu “Kết ISO” → 🤖 tự bấm Xử lý tác vụ → Thực hiện → Đồng ý, tích “Đã xử lý”, rồi chuyển bước Trả kết quả, Trả hồ sơ. Tắt: bạn tự Kết ISO như cũ</label>
        <label class="opt"><input type="checkbox" id="optSangTB"${S.opts.tuSangTB !== false ? ' checked' : ''}> Chuyển lãnh đạo xong thì tự sang TB chưa làm tiếp theo (bấm “Về trang tiếp nhận hồ sơ”, tiếp nhận luôn)</label>
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
          <input data-path="thua.${i}.mdsd" value="${esc(thuaMdsd(t))}" title="Mục đích sử dụng (LUC, BHK, NTS…; ONT / ONT+CLN điền thành ODT)">
          <button class="btn pri" data-fill="thua" data-i="${i}">${isDone(tb, 'thua' + i) ? '✓ Điền' : 'Điền'}</button>
        </div>
        <div class="tr2"><input data-path="thua.${i}.diaChi" value="${esc(t.diaChi)}" title="Địa chỉ chi tiết" placeholder="Địa chỉ chi tiết"><input data-path="thua.${i}.thoiHan" value="${esc(isDatO(t) ? thuaThoiHan(t) : t.thoiHan)}" title="Thời hạn SD (trống = ${isDatO(t) ? DAT_O_THOI_HAN + ' – đất ở' : DEFAULT_THOI_HAN})" placeholder="${isDatO(t) ? DAT_O_THOI_HAN : DEFAULT_THOI_HAN}"></div>
        <div class="tr3"><input data-path="thua.${i}.nguonGoc" value="${esc(isDatO(t) ? thuaNguonGoc(t) : t.nguonGoc)}" title="Nguồn gốc đất (trống = ${esc(isDatO(t) ? DAT_O_NGUON_GOC + ' – đất ở' : DEFAULT_NGUON_GOC)})" placeholder="${esc(isDatO(t) ? DAT_O_NGUON_GOC : DEFAULT_NGUON_GOC)}"></div>
      </div>`
        )
        .join('')}`,
    tr: () => tplTabHtml(),
    gt: (tb) => `
      ${scanCardHtml()}
      <div class="hint">Ở màn hình chính: điền vào ô “Tên tài liệu muốn thêm”, rồi bạn tự bấm nút + xanh. Nếu đang mở cửa sổ “Thông tin hồ sơ quét” thì điền vào cửa sổ đó.</div>
      ${(tb.giayTo || [])
        .map(
          (g, i) =>
            `<div class="row"><input data-path="giayTo.${i}" value="${esc(g)}"><button class="btn pri" data-fill="gt" data-i="${i}">${isDone(tb, 'gt' + i) ? '✓ Điền' : 'Điền'}</button></div>`
        )
        .join('')}
      <button class="btn" id="gtAdd">+ Thêm giấy tờ</button>`,
  };

  // ---------- tab “Trường”: lấy tất cả các trường của màn hình đang mở, tích trường cần điền ----------
  // Ô không được điền (quy tắc của bạn): Ngày sinh, Ngày cấp, Ngày hết hạn – xét trên nhãn đã bỏ *, :, (, ) và ký hiệu đầu dòng
  const TPL_BAN = /^(ngay sinh|ngay cap|ngay het han)\b/;
  const banNorm = (s) => norm(s).replace(/[*:：?()（）[\]]/g, ' ').replace(/^[^a-z0-9]+/, '').replace(/\s+/g, ' ').trim();
  const tplBan = (label) => TPL_BAN.test(banNorm(label));
  const TPL_NAME = { chu: 'Cửa sổ chủ sử dụng', thua: 'Cửa sổ thửa đất', donDK: 'Cửa sổ Nhập đơn đăng ký', bienNhan: 'Màn hình Tiếp nhận hồ sơ', giayTo: 'Cửa sổ hồ sơ quét / giấy tờ' };
  // khóa cửa sổ (giống winKey của bộ điền): số hồ sơ / mã / ngày (đổi theo hồ sơ) → '#'; số ngắn là phần tên (vd. “tác vụ 2”) – giữ
  const winKey = (k) =>
    String(k || '')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/kh\s*\d+(?:\s*[.\-]\s*\d+)+[.\-]*/g, '#')
      .replace(/\d+(?:\s*[.\-\/]\s*\d+){2,}/g, '#')
      .replace(/\d{4,}/g, '#')
      .replace(/\(\s*\d+\s*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  // cách đặt khóa của bản trước 1.20 (phần trước chữ số đầu tiên) – mẫu cũ vẫn dùng được
  const tplStem = (tk) => {
    const k = String(tk || '');
    const st = k.split(/\d/)[0].replace(/(\s|-|–|:|\||\(|kh)+$/g, '').trim();
    return st.length >= 6 ? st : k;
  };
  // mẫu t có phải của cửa sổ (tên đã bỏ dấu k): 2 = khóa bản 1.20, 1 = khóa bản cũ, 0 = không
  const tplMatch = (k, t) => {
    const tk = t && t.titleKey;
    if (!tk || !k || /^d:/.test(tk)) return 0;
    if (winKey(k) === tk) return 2;
    return k === tk || tplStem(k) === tk ? 1 : 0;
  };
  // khóa mẫu: hộp hỏi = khóa hộp (d:…); cửa sổ chính của tiện ích = phần + tên cửa sổ (mỗi cửa sổ một mẫu, vd. “thua|them thua dat”);
  // màn hình Tiếp nhận = bienNhan; cửa sổ khác = w:tên cửa sổ; màn hình chính khác = w:path:địa chỉ trang
  const tplKeyOf = (fr) =>
    fr.dlg
      ? fr.titleKey
      : fr.secKey
        ? fr.scope === 'modal'
          ? `${fr.secKey}|${fr.winKey || winKey(fr.titleKey)}`
          : fr.secKey
        : 'w:' + ((fr.scope === 'modal' ? fr.winKey || winKey(fr.titleKey) : fr.titleKey) || 'trang');
  // tên hiện cho bạn: bỏ số hồ sơ, không lồng ngoặc kép
  const cleanTitle = (s) =>
    String(s || '')
      .replace(/KH\s*2959[\d.\-\s]*/gi, '…')
      .replace(/\d{4,}/g, '…')
      .replace(/[“”"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const qn = (s) => (/[“”]/.test(String(s)) ? String(s) : `“${s}”`);
  function tplNameOf(fr) {
    if (fr.dlg) return `Hộp hỏi ${cleanTitle(fr.title) || 'của trang'}: ${cleanTitle(fr.dlgText).slice(0, 60)}`;
    if (fr.secKey === 'bienNhan') return TPL_NAME.bienNhan;
    if (fr.secKey) return `${TPL_NAME[fr.secKey] || 'Cửa sổ'} – ${cleanTitle(fr.title) || 'không tên'}`;
    if (fr.scope === 'modal') return `Cửa sổ ${cleanTitle(fr.title) || 'không tên'}`;
    return `Màn hình ${cleanTitle(fr.heading) || 'chính'}`;
  }
  // mẫu được dùng thế nào (đúng như tiện ích chạy) – hiện cạnh mẫu và trong bảng tích
  const T_CHO = /^chon nguoi xu ly\b/;
  const T_QT = /^quy trinh xu ly\b/;
  const T_TRA = /^tra ho so\b/;
  const T_ISO = /^ket iso\b/;
  function tplUse(t) {
    if (!t) return '';
    const base = t.base != null ? t.base : t.secKey || '';
    const k = String(t.titleKey || '');
    if (/^d:/.test(t.key || k)) return '🤖 bật: tự trả lời đúng hộp hỏi này bằng nút đã tích (hộp báo lỗi thì không)';
    if (base === 'bienNhan')
      return '▶ / 🤖 CHỈ điền ô đã tích (ô bỏ tích / không có trong mẫu không điền); ô bắt buộc (Phường/Xã, Quy trình, Số biên nhận, Người nộp) không điền mà trống / khác dữ liệu TB → dừng trước Lưu hồ sơ';
    if (base === 'chu' || base === 'thua' || base === 'donDK')
      return '▶ / 🤖 CHỈ điền ô đã tích (ô bỏ tích / không có trong mẫu không điền); 🤖 bấm thêm nút đã tích trước nút Lưu; ô bắt buộc không điền mà trống / khác dữ liệu TB → không tự Lưu';
    if (base === 'giayTo') return '🤖 (tác vụ lưu kho): điền thêm ô / bấm thêm nút đã tích trước nút Lưu / Cập nhật';
    if (t.scope === 'page') return '🤖 bật: tự chạy mẫu mỗi lần vào màn hình này (màn hình tiện ích tự làm thì không)';
    if (T_CHO.test(k)) return '🤖: tích “Thực thi” = tự chọn đúng tài khoản trong cài đặt rồi Thực thi (đủ kiểm tra); ô / nút khác đã tích 🤖 làm thêm trước Thực thi';
    if (T_QT.test(k)) return 'Quy trình xử lý: 🤖 làm theo bước riêng – mẫu chỉ dùng khi bạn bấm “Điền”';
    if (T_TRA.test(k) || T_ISO.test(k)) return '🤖 (khi tự Trả hồ sơ / Kết ISO): điền thêm ô / bấm thêm nút đã tích trước “Thực hiện”; cửa sổ bạn tự mở: Kết ISO → 🤖 chạy mẫu';
    return '🤖 bật: tự điền + bấm theo mẫu mỗi lần cửa sổ mở';
  }
  // tên dòng: bỏ * : ở cuối (mẫu vẫn giữ nhãn gốc để tìm lại đúng ô)
  const tplLabel = (x) => String(x.label || '').replace(/[\s*:：]+$/, '') + (x.nth && x.by !== 'idx' ? ` (${x.nth + 1})` : '');
  // tên nút: chữ (+ chú thích khi nút chỉ có ký hiệu / nhiều nút cùng chữ) + tác vụ của dòng
  function tplBtnName(x) {
    if (x.key === 'sym:close') return '× – đóng cửa sổ';
    const sym = !/[a-z0-9]/.test(norm(x.text || ''));
    let s = x.text || x.key;
    if (x.tip && (sym || x.nth > 0)) s += ` – ${x.tip}`;
    else if (x.nth > 0) s += ` (${x.nth + 1})`;
    if (x.ctx) s += ` – ${x.ctx}`;
    return s;
  }
  function tplRows(d, editable) {
    return d.items
      .map((x, i) => {
        const ban = !!x.ban;
        const src = x.src === 'tb' && x.key ? 'tb' : 'fix';
        const dis = ban ? ' disabled' : '';
        const srcSel = x.key
          ? `<select data-tpl-src="${i}"${dis}><option value="tb"${src === 'tb' ? ' selected' : ''}>Dữ liệu TB (${esc(x.kname)})</option><option value="fix"${src === 'fix' ? ' selected' : ''}>Giá trị mẫu</option></select>`
          : '<span class="muted">Giá trị mẫu</span>';
        let val;
        if (src === 'tb') val = '<span class="muted">theo TB từng hồ sơ</span>';
        else if (x.kind === 'checkbox')
          val = `<select data-tpl-val="${i}"${dis}><option value="true"${x.val === true || x.val === 'true' ? ' selected' : ''}>☑ tích</option><option value="false"${x.val === true || x.val === 'true' ? '' : ' selected'}>☐ bỏ tích</option></select>`;
        else if ((x.kind === 'select' || x.kind === 'radio') && x.opts && x.opts.length) {
          const cur = x.val == null ? '' : String(x.val);
          const list = cur && !x.opts.includes(cur) ? [cur, ...x.opts] : x.opts;
          val = `<select data-tpl-val="${i}"${dis}>${cur ? '' : '<option value="" selected>(trống – không điền)</option>'}${list
            .map((o) => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`)
            .join('')}</select>`;
        } else if (x.multi || /[\r\n]/.test(String(x.val ?? '')))
          val = `<textarea data-tpl-val="${i}" rows="2" placeholder="(trống – không điền)"${dis}>\n${esc(x.val ?? '')}</textarea>`;
        else val = `<input data-tpl-val="${i}" value="${esc(x.val ?? '')}" placeholder="(trống – không điền)"${dis}>`;
        const notes = [
          ban && 'không điền (quy tắc)',
          !ban && x.locked && 'ô đang khóa – chỉ đúng khi trang đã có sẵn giá trị này',
          x.vang && 'không thấy lần lấy này',
          !ban && src === 'fix' && x.on && 'giống nhau mọi hồ sơ',
          x.lostTb && 'trước lấy từ TB, nay không có dữ liệu TB – đã bỏ tích',
          x.amb && 'nhãn trùng – tìm theo id / tên ô',
        ].filter(Boolean);
        const rm = x.vang ? ` <button class="btn del" data-tpl-rm="${i}" title="Bỏ dòng này khỏi mẫu">✕</button>` : '';
        return `<tr class="${ban ? 'ban' : ''}${x.vang ? ' vang' : ''}"><td><input type="checkbox" data-tpl-on="${i}"${x.on && !ban ? ' checked' : ''}${
          ban || !editable ? ' disabled' : ''
        } style="width:auto"></td><td>${esc(tplLabel(x))}${notes.length ? ` <span class="muted">– ${esc(notes.join('; '))}</span>` : ''}${rm}</td><td>${srcSel}</td><td>${val}</td></tr>`;
      })
      .join('');
  }
  // nút của màn hình (tab Trường): tích nút cần bấm, ô số = thứ tự bấm. Mọi nút đều tích được (bạn yêu cầu 22/11)
  function tplBtnRows(d) {
    return (d.btns || [])
      .map((x, i) => {
        const notes = [x.lock === 'link' && 'đường link – bấm là sang trang khác', x.off && 'đang mờ', x.pos && 'theo vị trí dòng', x.vang && 'không thấy lần lấy này'].filter(Boolean);
        const rm = x.vang ? ` <button class="btn del" data-tplb-rm="${i}" title="Bỏ nút này khỏi mẫu">✕</button>` : '';
        return `<tr class="${x.vang ? 'vang' : ''}"><td><input type="checkbox" data-tplb-on="${i}"${x.on ? ' checked' : ''} style="width:auto"></td><td>${esc(tplBtnName(x))}${
          notes.length ? ` <span class="muted">– ${esc(notes.join('; '))}</span>` : ''
        }${rm}</td><td><input data-tplb-ord="${i}" value="${esc(x.on ? x.ord || '' : '')}" placeholder="–" style="width:44px"${x.on ? '' : ' disabled'}></td></tr>`;
      })
      .join('');
  }
  // số chủ / thửa / giấy tờ của mẫu (ô cạnh nút Điền) – nhớ theo từng mẫu
  const tplIdxOf = (key) => Math.max(1, parseInt((S.tplIdx || {})[key], 10) || 1);
  function tplTabHtml() {
    const d = S.tplDraft;
    const saved = Object.values(S.tpl || {})
      .filter((t) => t && t.items)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const idxBox = (base, key) =>
      base === 'chu' || base === 'thua' || base === 'giayTo'
        ? `<label class="muted" style="flex:none">${base === 'chu' ? 'chủ' : base === 'thua' ? 'thửa' : 'giấy tờ'} số</label><input data-tplidx="${esc(key)}" type="number" min="1" value="${tplIdxOf(
            key
          )}" style="width:48px;flex:none">`
        : '';
    const savedRow = (t) => {
      const nOn = t.items.filter((x) => x.on && !x.ban).length;
      const nB = (t.btns || []).filter((b) => b.on).length;
      const nE = t.items.filter((x) => x.on && !x.ban && x.src !== 'tb' && x.kind !== 'checkbox' && String(x.val ?? '') === '').length;
      return `<div class="row" style="flex-wrap:wrap"><span style="flex:1">${esc(t.name)} · ${nOn}/${t.items.length} ô được tích${nB ? ` · bấm ${nB} nút` : ''}${
        nE ? ` · ${nE} ô giá trị mẫu trống` : ''
      }<br><span class="muted">${esc(tplUse(t))}</span></span>${idxBox(t.base, t.key)}<button class="btn" data-tplfill="${esc(t.key)}">Điền</button><button class="btn" data-tpledit="${esc(
        t.key
      )}">Sửa</button><button class="btn del" data-tpldel="${esc(t.key)}">Xóa</button></div>`;
    };
    const wait = d && S.autoWaitNote && S.autoWaitNote.key === d.key && AUTO() ? `<div class="hint ok">${esc(S.autoWaitNote.text)}</div>` : '';
    return (
      `<div class="card"><div class="ct">Lấy tất cả các trường</div>
        <div class="hint">Mở màn hình / cửa sổ / hộp hỏi cần điền trên VBDLIS rồi bấm. Tiện ích liệt kê mọi ô (cả ô tròn, ô chỉ có chữ mờ, ô trong bảng) và mọi <b>nút</b>. <b>Tích ô cần điền</b>: ô tiện ích biết lấy từ <b>dữ liệu TB</b> từng hồ sơ; ô khác điền <b>giá trị mẫu</b> (giống nhau mọi hồ sơ, sửa được). Tích nút cần bấm (ô số = thứ tự bấm). <b>Tích / sửa là tự lưu</b> – lần sau không phải tích lại; lấy lại trường lần nữa vẫn giữ tích cũ (ô lần đó không thấy cũng giữ, có ✕ để bỏ).<br>
        Dùng: bấm <b>Điền</b> ở mẫu (mọi lúc). <b>🤖 Tự động hết</b>: cửa sổ / màn hình tiện ích không tự làm → tự điền + bấm theo mẫu mỗi lần mở; cửa sổ tiện ích tự làm (chủ, thửa, đơn, chọn người, Trả hồ sơ, hồ sơ quét) → 🤖 làm như cũ, đủ kiểm tra, rồi điền thêm ô / bấm thêm nút đã tích <b>trước</b> nút chốt (Lưu / Thực thi / Thực hiện); Quy trình xử lý → 🤖 theo bước riêng. <b>Hộp hỏi lạ</b>: lấy hộp đó lúc đang hiện, tích nút trả lời – từ đó 🤖 tự trả lời đúng hộp đó. Đã có mẫu thì tiện ích <b>chỉ điền ô đã tích</b> (ô bỏ tích / không có trong mẫu không điền); ô bắt buộc không điền mà trống / khác dữ liệu TB thì 🤖 dừng trước Lưu. Không bao giờ điền Ngày sinh, Ngày cấp, Ngày hết hạn.</div>
        <button class="btn pri full" id="tplScan">Lấy tất cả các trường trên màn hình đang mở</button></div>` +
      (d
        ? `<div class="card"><div class="ct">${esc(d.name)} – ${d.items.length} ô · ${(d.btns || []).length} nút<span class="sp"></span><button class="btn" id="tplAll" title="Tích các ô lấy từ dữ liệu TB và ô bạn đã gõ giá trị mẫu (ô giá trị mẫu khác: tích tay)">Tích hết</button><button class="btn" id="tplNone">Bỏ hết</button></div>
            <div class="hint">${esc(tplUse(d))}</div>${wait}
            ${
              d.items.length
                ? `<div id="tplItemsBox" data-key="${esc(d.key)}" style="overflow:auto;max-height:40vh"><table class="sh tpl"><tr><th>✓</th><th>Trường</th><th>Lấy từ</th><th>Giá trị</th></tr>${tplRows(d, true)}</table></div>`
                : '<div class="muted">Không có ô nhập.</div>'
            }
            ${
              (d.btns || []).length
                ? `<div class="ct" style="margin-top:8px">Nút – ${(d.btns || []).length} nút <span class="muted" style="font-weight:400">· tích nút cần bấm, ô số = thứ tự bấm</span></div>
            <div id="tplBtnsBox" data-key="${esc(d.key)}" style="overflow:auto;max-height:32vh"><table class="sh tpl"><tr><th>✓</th><th>Nút</th><th>Thứ tự</th></tr>${tplBtnRows(d)}</table></div>`
                : ''
            }
            ${d.cut ? `<div class="muted">… còn ${d.cut} ô / nút nữa không hiện (màn hình quá nhiều).</div>` : ''}
            <div class="row" style="margin-top:6px;flex-wrap:wrap">${idxBox(d.secKey, d.key)}<button class="btn pri" id="tplSave" title="Tích / sửa đã tự lưu – nút này lưu rồi đóng bảng tích">Lưu mẫu</button><button class="btn" id="tplFillNow">Điền ngay</button><button class="btn" id="tplCancel" title="Đóng bảng tích (đã tự lưu)">Đóng</button></div></div>`
        : '') +
      `<div class="card"><div class="ct">Mẫu đã lưu (${saved.length})</div>` +
      (saved.length ? saved.map(savedRow).join('') : '<div class="muted">Chưa có mẫu. Không có mẫu thì tiện ích điền như cũ (mọi ô có dữ liệu).</div>') +
      '</div>' +
      `<div class="card"><div class="ct">Cấu hình tab Trường – dùng cho nơi khác</div>
        <div class="hint">Mỗi nơi làm một kiểu: lấy trường, tích xong thì <b>Xuất cấu hình</b> – một file gồm mọi mẫu (cửa sổ, ô đã tích, lấy từ đâu, giá trị mẫu bạn đặt, thứ tự nút; tiện ích lọc bỏ giá trị / nút / mẫu hộp hỏi có tên người trong dữ liệu TB, tên tài khoản, dãy số dài – vẫn nên mở file xem trước khi gửi). Nơi khác bấm <b>Nạp cấu hình</b>, chọn file đó: tiện ích cho xem mẫu nào thêm mới, mẫu nào đã có, hỏi trước khi thay.</div>
        <div class="row"><button class="btn" id="cfgExp">⬇ Xuất cấu hình</button><button class="btn" id="cfgImpBtn">⬆ Nạp cấu hình…</button><input type="file" id="cfgFile" accept=".json,application/json" style="display:none"></div></div>`
    );
  }
  // gộp dòng mới lấy với dòng của mẫu cũ: giữ tích / nguồn / giá trị; dòng cũ lần này không thấy → GIỮ, ghi “không thấy lần lấy này”
  function tplMergeItems(oldItems, scanItems) {
    const used = new Set();
    const nl = (s) => norm(s).replace(/[*:：?]/g, ' ').replace(/\s+/g, ' ').trim();
    const ctlOf = (x) => (x.ctl && (x.ctl.id || x.ctl.name) ? `${x.ctl.id || ''}|${x.ctl.name || ''}` : '');
    const out = scanItems.map((x) => {
      const ban = tplBan(x.label);
      let prev = null;
      const tryM = (test, one) => {
        if (prev) return;
        const c = oldItems.map((o, i) => [o, i]).filter(([o, i]) => !used.has(i) && (o.kind || 'text') === x.kind && test(o));
        if (c.length === 1 || (c.length > 1 && !one)) {
          prev = c[0][0];
          used.add(c[0][1]);
        }
      };
      const xc = ctlOf(x);
      if (xc) tryM((o) => ctlOf(o) === xc && JSON.stringify(o.loc || null) === JSON.stringify(x.loc || null), true);
      tryM((o) => o.label === x.label && (o.nth || 0) === (x.nth || 0));
      if (x.loc) tryM((o) => !!o.loc && o.loc.col === x.loc.col && o.loc.row === x.loc.row && (!!x.loc.row || o.loc.idx === x.loc.idx), true);
      tryM((o) => nl(o.label) === nl(x.label) && (o.nth || 0) === (x.nth || 0), true);
      // ô Giới tính của mẫu bản cũ (“Giới tính:Nam”, ô tích không có dữ liệu TB) → ô Giới tính lấy từ dữ liệu TB
      if (x.key === 'gioiTinhNam') tryM((o) => (!o.key || o.key === 'gioiTinhNam') && /^gioi tinh/.test(nl(o.label)), true);
      let on = prev ? !!prev.on && !ban : !!x.key && !ban;
      let src = prev ? prev.src || 'fix' : x.key ? 'tb' : 'fix';
      let lostTb = false;
      if (prev && x.key === 'gioiTinhNam' && !prev.key) src = 'tb'; // ô giới tính cũ → theo TB
      if (src === 'tb' && !x.key) {
        // trước lấy từ dữ liệu TB, nay ô này không có dữ liệu TB → bỏ tích (không tự điền giá trị đọc trên trang)
        src = 'fix';
        on = false;
        lostTb = true;
      }
      const sameKind = prev && (prev.kind || 'text') === x.kind;
      return {
        label: x.label,
        nth: x.nth || 0,
        kind: x.kind,
        key: x.key || '',
        kname: x.kname || '',
        opts: x.opts,
        multi: !!x.multi,
        locked: !!x.locked,
        by: x.by || '',
        loc: x.loc || null,
        ctl: x.ctl || null,
        amb: !!x.amb,
        ban,
        on,
        src,
        val: sameKind && prev.src !== 'tb' && prev.val !== undefined && !lostTb ? prev.val : x.full,
        uv: !!(prev && prev.uv),
        lostTb,
      };
    });
    oldItems.forEach((o, i) => {
      if (used.has(i)) return;
      const ban = tplBan(o.label);
      out.push({ ...o, vang: true, ban, on: !!o.on && !ban });
    });
    return out;
  }
  // nút: nhận lại theo id, theo dòng bảng (mã / tác vụ), theo chữ + thứ tự; nút đã tích lần này không thấy → giữ
  function tplMergeBtns(oldBtns, scanBtns) {
    const used = new Set();
    const out = scanBtns.map((x) => {
      let pi = -1;
      const find = (test) => {
        if (pi < 0) pi = oldBtns.findIndex((o, i) => !used.has(i) && test(o));
      };
      if (x.row) find((o) => o.key === x.key && o.row === x.row && (o.rnth || 0) === (x.rnth || 0));
      if (x.id) find((o) => o.id && o.id === x.id && o.key === x.key && (!o.row || o.row === x.row));
      if (x.nth >= 0) find((o) => !o.row && o.key === x.key && (o.nth || 0) === x.nth);
      // khóa kiểu cũ (trước 1.18.6 / 1.20: số trong chữ nút) → theo đúng chữ của nút
      find((o) => !o.row && o.text && legacyBtnKey(o) && norm(o.text) === norm(x.text) && !scanBtns.some((y) => y.key === o.key && (y.nth || 0) === (o.nth || 0)));
      const prev = pi >= 0 ? oldBtns[pi] : null;
      if (pi >= 0) used.add(pi);
      const on = !!(prev && prev.on);
      return {
        text: x.text,
        key: x.key,
        nth: x.nth,
        id: x.id || '',
        tip: x.tip || '',
        row: x.row || '',
        rnth: x.rnth || 0,
        ctx: x.ctx || '',
        pos: !!x.pos,
        lock: x.lock || '',
        off: !!x.off,
        on,
        ord: on ? prev.ord || '' : '',
      };
    });
    oldBtns.forEach((o, i) => {
      if (!used.has(i) && o.on) out.push({ ...o, vang: true });
    });
    return out;
  }
  // lấy các ô của màn hình đang mở: khung có cửa sổ / hộp hỏi đang mở trước khung màn hình phía sau, rồi khung nhiều ô nhất
  async function tplScan() {
    const resp = await send({ type: 'vbdlis-scan' });
    if (!resp || !resp.ok) throw new Error(friendly((resp && resp.error) || 'Không quét được.'));
    const cnt = (f) => (f.items || []).length;
    const rank = (f) => (f.dlg || (f.scope === 'modal' && cnt(f)) ? 2 : f.scope === 'modal' ? 1 : 0);
    const fr = (resp.frames || [])
      .filter((f) => f && (cnt(f) || (f.buttons || []).length))
      .sort((a, b) => rank(b) - rank(a) || cnt(b) - cnt(a) || (b.buttons || []).length - (a.buttons || []).length)[0];
    if (!fr) throw new Error('không thấy ô nhập / nút nào trên màn hình đang mở');
    const key = tplKeyOf(fr);
    const tk = fr.dlg ? fr.titleKey : fr.scope === 'modal' ? fr.winKey || winKey(fr.titleKey) : fr.titleKey;
    // mẫu cũ của cửa sổ này: khóa bản 1.20, không thì khóa bản trước (phần chưa tách cửa sổ; tên cắt ở chữ số đầu; tên đầy đủ)
    let old = S.tpl[key] || null;
    let oldKey = old ? key : '';
    if (!old && !fr.dlg) {
      const legacy = fr.secKey
        ? fr.scope === 'modal' && S.tpl[fr.secKey] && (!S.tpl[fr.secKey].titleKey || tplMatch(fr.titleKey, S.tpl[fr.secKey]))
          ? [fr.secKey]
          : []
        : fr.scope === 'modal'
          ? ['w:' + tplStem(fr.titleKey), 'w:' + fr.titleKey]
          : [];
      for (const k of legacy)
        if (S.tpl[k] && k !== key) {
          old = S.tpl[k];
          oldKey = k === 'w:' + fr.titleKey || (fr.secKey && k === fr.secKey && !!S.tpl[k].titleKey) ? k : '';
          break;
        }
    }
    const items = tplMergeItems(old ? old.items || [] : [], fr.items || []);
    const btns = tplMergeBtns(old ? old.btns || [] : [], fr.buttons || []);
    S.tplDraft = {
      key,
      oldKey: oldKey && oldKey !== key ? oldKey : '',
      name: tplNameOf(fr),
      secKey: fr.secKey || '',
      scope: fr.scope,
      titleKey: tk,
      dlg: !!fr.dlg,
      items,
      btns,
      cut: (fr.cutItems || 0) + (fr.cutBtns || 0),
      merged: !!old,
    };
  }
  // khóa nút đã bỏ dấu: mã hồ sơ / số từ 4 chữ số → '#' (giống bộ điền)
  const numKeyP = (k) =>
    String(k || '')
      .replace(/\bkh( \d+)+/g, 'kh #')
      .replace(/\d{4,}/g, '#')
      .replace(/(# )+#/g, '#')
      .replace(/\s+/g, ' ')
      .trim();
  // nút đã tích lưu với khóa kiểu cũ (trước 1.18.6: bỏ cả số không trong ngoặc; trước 1.20: giữ số dài trong chữ nút)
  function legacyBtnKey(o) {
    const k = String(o.key || '');
    if (/^(icon|sym):/.test(k)) return false;
    const nb = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const t = String(o.text || '');
    if (!nb(t)) return false;
    const kn = numKeyP(/\(\s*\d+\s*\)\s*$/.test(t) ? nb(t).replace(/(\s\d+)+$/, '') : nb(t));
    return k !== kn && k !== 'title:' + kn;
  }
  // mẫu đã lưu: sửa cờ “không điền” (Ngày sinh / Ngày cấp / Ngày hết hạn) theo cách xét mới; mẫu chủ bản cũ có ô “Giới tính:Nam”
  // đã tích giá trị mẫu → ô Giới tính theo dữ liệu TB. Trả về true nếu có đổi
  function tplFix(t) {
    if (!t || !Array.isArray(t.items)) return false;
    let ch = false;
    t.items.forEach((x) => {
      const ban = tplBan(x.label);
      if (!!x.ban !== ban) {
        x.ban = ban;
        ch = true;
      }
      if (ban && x.on) {
        x.on = false;
        ch = true;
      }
    });
    if (t.base === 'chu' && !t.items.some((x) => x.key === 'gioiTinhNam')) {
      const g = t.items.find((x) => !x.key && x.kind === 'checkbox' && /^gioi tinh/.test(norm(x.label)));
      if (g && g.on) {
        Object.assign(g, { key: 'gioiTinhNam', kname: 'Giới tính (ô Nam)', src: 'tb' });
        ch = true;
      }
    }
    return ch;
  }
  // chuyển mẫu đã lưu sang khóa bản 1.20 (mỗi cửa sổ một mẫu; tên cửa sổ bỏ số hồ sơ). Trùng khóa → gộp: lấy bản mới nhất, cộng tích
  function tplMigrateAll(all) {
    let ch = false;
    const put = (k, t) => {
      const o = all[k];
      if (!o) {
        all[k] = t;
        return;
      }
      const [a, b] = (o.at || 0) >= (t.at || 0) ? [o, t] : [t, o];
      a.items = (a.items || []).map((x) => {
        const y = (b.items || []).find((z) => z.label === x.label && (z.nth || 0) === (x.nth || 0));
        return y && y.on && !x.on ? { ...x, on: true, src: y.src, val: y.val } : x;
      });
      a.btns = (a.btns || []).map((x) => {
        const y = (b.btns || []).find((z) => z.key === x.key && (z.nth || 0) === (x.nth || 0) && (z.row || '') === (x.row || ''));
        return y && y.on && !x.on ? { ...x, on: true, ord: y.ord } : x;
      });
      all[k] = { ...a, key: k };
    };
    for (const [k, t] of Object.entries(all)) {
      if (!t || !Array.isArray(t.items)) continue;
      if (tplFix(t)) ch = true;
      let nk = k;
      let ntk = t.titleKey || '';
      if (['chu', 'thua', 'donDK', 'giayTo'].includes(k) && t.titleKey) {
        ntk = winKey(t.titleKey);
        nk = `${k}|${ntk}`;
      } else if (/^w:/.test(k) && t.scope === 'modal' && /\d/.test(t.titleKey || '')) {
        // đã có mẫu “gốc” (tên cắt ở chữ số) mới hơn → mẫu tên đầy đủ cũ để nguyên khóa cũ (chỉ dùng cho đúng hồ sơ đó như bản 1.19),
        // không đổi sang khóa 1.20 (khóa mới thắng mẫu gốc → 🤖 chạy tích / giá trị cũ cho mọi hồ sơ)
        const sk = 'w:' + tplStem(t.titleKey);
        if (sk !== k && all[sk]) continue; // (không so giờ: nạp cấu hình / Sửa ghi lại giờ mới cho mẫu cũ)
        ntk = winKey(t.titleKey);
        nk = 'w:' + ntk;
      }
      if (nk !== k) {
        delete all[k];
        put(nk, { ...t, key: nk, titleKey: ntk, name: cleanTitle(t.name) || t.name });
        ch = true;
      }
    }
    return ch;
  }
  function tplRec(d) {
    return { key: d.key, name: d.name, base: d.secKey || '', scope: d.scope, titleKey: d.titleKey, dlg: !!d.dlg, items: d.items, btns: d.btns || [], at: Date.now(), kv: 2 };
  }
  // tab Trường: bạn tích / sửa là LƯU MẪU LUÔN – 🤖 / ▶ dùng ngay, lần sau mở lại không phải tích lại.
  // Lưu vào bộ nhớ bảng ngay; ghi kho → true / false (tiện ích vừa tải lại thì false)
  function tplSaveDraft() {
    const d = S.tplDraft;
    if (!d) return Promise.resolve(true);
    const n = { ...S.tpl, [d.key]: tplRec(d) };
    if (d.oldKey && d.oldKey !== d.key) delete n[d.oldKey]; // mẫu khóa cũ của cửa sổ này → sang khóa mới
    d.oldKey = '';
    S.tpl = n;
    S.tplWrote = { key: d.key, at: n[d.key].at };
    try {
      return Promise.resolve(store.set({ tbTpl: n })).then(
        () => true,
        () => false
      );
    } catch (e) {
      return Promise.resolve(false);
    }
  }
  // tiện ích vừa được tải lại → bảng này không lưu được nữa: báo rõ, không làm như đã lưu
  const tplDead = () => {
    if (isAlive()) return false;
    setResult(
      '<div class="bad">✗ Chưa lưu được mẫu: tiện ích vừa được tải lại nên bảng này đã mất kết nối – tích / thứ tự / giá trị vừa đổi CHƯA được lưu. Bấm biểu tượng tiện ích (Alt+Q) mở bảng mới, vào tab Trường bấm “Sửa” ở mẫu (hoặc lấy lại các trường) rồi tích lại.</div>'
    );
    setStatus('✗ Chưa lưu được mẫu – xem dòng đỏ.', true);
    return true;
  };
  // lưu ngay phần đang chờ (trước khi đóng, mở mẫu khác, lấy lại trường, rời trang…)
  function tplFlush() {
    if (!S.tplSaveT) return;
    clearTimeout(S.tplSaveT);
    S.tplSaveT = null;
    if (S.tplDraft && isAlive()) tplSaveDraft();
  }
  // tích / đổi nguồn / thứ tự: lưu ngay (now); gõ giá trị: lưu 0,5 giây sau lần gõ cuối
  function tplAutoSave(now) {
    clearTimeout(S.tplSaveT);
    const go = async () => {
      S.tplSaveT = null;
      const d = S.tplDraft;
      if (!d || tplDead()) return;
      const ok = await tplSaveDraft();
      if (!ok) {
        if (!tplDead()) setStatus('✗ Chưa lưu được mẫu – tích lại hoặc bấm “Lưu mẫu”.', true);
        return;
      }
      setStatus(`✓ Đã lưu mẫu ${qn(d.name)} – lần sau không phải tích lại.`);
      const a = root.activeElement;
      if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.type === 'checkbox') render(); // đang gõ thì không vẽ lại
    };
    if (now) go();
    else S.tplSaveT = setTimeout(go, 500);
  }
  // số thứ tự bấm của nút (không có số → cuối, theo thứ tự trên màn hình)
  const tplOrd = (b) => (String(b.ord || '').trim() === '' || isNaN(+b.ord) ? 1e9 : +b.ord);
  // điền theo mẫu vào màn hình đang mở (“Điền” / “Điền ngay”, 🤖 chạy mẫu, 🤖 làm thêm ở cửa sổ tiện ích tự làm):
  // các ô đã tích, rồi bấm lần lượt các nút đã tích. Có ô chưa điền được → không bấm nút nào (tránh lưu thiếu).
  // o: { auto (🤖), only (lọc nút), noTail (không xem hộp hỏi sau cùng) }
  async function tplFill(t, idx, o = {}) {
    const anyField = (t.items || []).some((x) => x.on && !x.ban);
    const anyBtn = (t.btns || []).some((b) => b.on && (!o.only || o.only(b)));
    if (!anyField && !anyBtn) throw new Error('mẫu chưa có ô / nút nào được tích');
    const f = anyField ? await tplFillFields(t, idx, o) : { results: [], notes: [], empty: [] };
    if (!anyBtn) f.clicks = [];
    else if (f.wrongWin) f.clicks = [{ ok: false, name: 'các nút đã tích', why: 'cửa sổ vừa mở không phải cửa sổ của mẫu – tiện ích không bấm nút' }];
    else if (f.results.some((r) => !r.ok)) f.clicks = [{ ok: false, name: 'các nút đã tích', why: 'có ô chưa điền được – tiện ích không bấm nút; bạn kiểm tra rồi tự bấm' }];
    else if ((f.missing || []).length)
      f.clicks = [{ ok: false, name: 'các nút đã tích', why: `ô ${f.missing.join(', ')} chưa có dữ liệu TB – tiện ích không bấm nút; bạn điền rồi tự bấm` }];
    else f.clicks = await tplClicks(t, o);
    // trang còn hỏi sau ô / nút cuối → báo (🤖: hộp đã biết / đã dạy thì trả lời; hộp lạ → ✗, kêu ting chờ bạn)
    const last = f.clicks[f.clicks.length - 1];
    f.answered = [];
    if (!o.noTail && !(last && (!last.ok || last.link)) && !(o.auto && S.stopReq) && host.isConnected && host.style.display !== 'none') {
      const q = await tplTailDialog(t, f.answered, anyBtn);
      if (q) f.clicks.push(q);
    }
    return f;
  }
  // sau ô / nút cuối của mẫu: chờ ~3 giây xem trang có hỏi gì không (hộp hỏi chính của mẫu hộp hỏi thì không tính)
  async function tplTailDialog(t, answered, clicked) {
    const until = Date.now() + (clicked ? 3000 : 1200) * slowK();
    const skip = /^d:/.test(t.key || '') ? t.key : '';
    while (Date.now() < until) {
      const rs = await act('answerDialog', { rules: AUTO() ? AUTO_DIALOGS : [], skip });
      const hit = rs.find((x) => x.ok);
      if (hit && hit.learned && hit.err)
        return { ok: false, q: true, name: 'câu hỏi của trang', why: `trang báo lỗi “${String(hit.title || '').slice(0, 60)}” – đã bấm “${hit.btn}” theo hộp bạn dạy` };
      if (hit) {
        answered.push(`Trang hỏi “${hit.title}” – tiện ích bấm “${hit.btn}”${hit.learned ? ' (hộp bạn đã dạy)' : ''}`);
        await sleep(900);
        continue;
      }
      const op = rs.find((x) => x.open && !x.own);
      if (op)
        return {
          ok: false,
          q: true,
          name: 'câu hỏi của trang',
          why: `trang đang hỏi “${String(op.text || op.title || '').slice(0, 120)}” – tiện ích không tự trả lời hộp này, bạn trả lời (muốn 🤖 tự trả lời: lấy hộp này ở tab Trường, tích nút trả lời)`,
        };
      await sleep(300);
    }
    return null;
  }
  // bấm lần lượt các nút đã tích của mẫu (theo số thứ tự bạn đặt; không có số thì theo thứ tự trên màn hình).
  // Trước mỗi nút: trang đang hỏi → 🤖 bật thì trả lời hộp đã biết / đã dạy rồi xem lại, không thì dừng. Chỉ bấm khi thấy đúng MỘT nút ở đúng MỘT khung.
  async function tplClicks(t, o = {}) {
    const list = (t.btns || []).map((b, i) => ({ ...b, i })).filter((b) => b.on && (!o.only || o.only(b)));
    list.sort((a, b) => tplOrd(a) - tplOrd(b) || a.i - b.i);
    const out = [];
    const skip = /^d:/.test(t.key || '') ? t.key : ''; // mẫu hộp hỏi: hộp đó do chính mẫu này trả lời
    for (const b of list) {
      const name = tplBtnName(b);
      const panelGone = !host.isConnected || host.style.display === 'none';
      // ■ Dừng chỉ chặn lần 🤖 chạy mẫu (Điền / Điền ngay bạn bấm tay không bị dấu Dừng của lần chạy trước chặn)
      const stopped = !!o.auto && S.stopReq;
      if (stopped || panelGone || (o.auto && !AUTO())) {
        out.push({
          ok: false,
          name,
          why: stopped ? 'bạn bấm Dừng – các nút sau không bấm' : panelGone ? 'bảng điền vừa ẩn – các nút sau không bấm' : '🤖 vừa tắt / chuyển sang tab khác – các nút sau không bấm',
        });
        break;
      }
      let open = null;
      let errHit = null;
      for (let k = 0; k < 4; k++) {
        const dl = await act('answerDialog', { rules: AUTO() ? AUTO_DIALOGS : [], skip });
        const hit = dl.find((x) => x.ok);
        if (hit) {
          if (hit.learned && hit.err) {
            errHit = hit; // hộp LỖI bạn đã dạy: đã bấm theo mẫu – bước này chưa xong
            break;
          }
          await sleep(900);
          continue;
        }
        open = dl.find((x) => x.open && !x.own) || null;
        break;
      }
      if (errHit) {
        out.push({ ok: false, name, why: `trang báo lỗi “${String(errHit.title || '').slice(0, 60)}” – đã bấm “${errHit.btn}” theo hộp bạn dạy; các nút sau không bấm` });
        break;
      }
      if (open) {
        out.push({ ok: false, name, why: `trang đang hỏi “${open.title}” – bạn trả lời rồi bấm Điền lại (các nút sau chưa bấm)` });
        break;
      }
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const fs = await act('tplClick', {
        dry: true,
        token,
        scope: t.scope,
        titleKey: t.titleKey,
        base: t.base || '',
        btn: { key: b.key, nth: b.nth, id: b.id, text: b.text, tip: b.tip || '', row: b.row || '', rnth: b.rnth || 0, ctx: b.ctx || '' },
      });
      const okF = fs.filter((x) => x.ok);
      if (okF.length !== 1 || fs.some((x) => (x.found || 0) > 1)) {
        // nút lần lấy trường gần nhất không thấy (cửa sổ ở trạng thái khác): không có thì bỏ qua, bấm tiếp nút sau
        if (b.vang && !okF.length && !fs.some((x) => (x.found || 0) > 0)) {
          out.push({ ok: true, skip: true, name, why: 'không có trên cửa sổ lúc này – bỏ qua' });
          continue;
        }
        const w = fs.find((x) => x.why && x.found) || fs.find((x) => x.why);
        out.push({ ok: false, name, why: okF.length > 1 ? `thấy nút ở ${okF.length} khung – không bấm` : (w && w.why) || 'không thấy nút' });
        break;
      }
      const r = (await act('tplClick', { token }))[0];
      out.push(r && r.ok ? { ok: true, name, link: !!r.link, why: r.link ? 'đường link – trang chuyển, các nút sau (nếu có) không bấm' : '' } : { ok: false, name, why: (r && r.why) || 'không bấm được' });
      if (!(r && r.ok) || r.link) break;
      await sleep(1000); // chờ trang xử lý nút vừa bấm
    }
    return out;
  }
  // mẫu → lệnh điền cho bộ điền. ts: các mẫu cùng phần (bộ điền chọn đúng mẫu của cửa sổ mở ra – mỗi cửa sổ một mẫu).
  // rows: ô dữ liệu TB của mẫu (tb = điền từ TB, fix = giá trị mẫu, off = bỏ tích); extra: ô giá trị mẫu đã tích (giá trị trống → không điền)
  function tplMsgOf(ts, kind, values, o = {}) {
    const v = { ...values };
    const empty = [];
    let anyField = false;
    const per = ts.map((t, j) => {
      const rows = (t.items || [])
        .filter((x) => x.key)
        .map((x) => {
          // “Giá trị mẫu” để trống (ô chữ / ô chọn) = không điền ô đó – như bỏ tích (giống bước tiếp nhận – recepPlan)
          const fixEmpty = x.src !== 'tb' && x.kind !== 'checkbox' && String(x.val ?? '') === '';
          return { key: x.key, label: x.label, nth: x.nth || 0, use: !x.on || x.ban || tplBan(x.label) || fixEmpty ? 'off' : x.src === 'tb' ? 'tb' : 'fix', vang: !!x.vang };
        });
      const extra = [];
      (t.items || []).forEach((x, i) => {
        if (!x.on || x.ban || tplBan(x.label)) return;
        anyField = true;
        if (x.src === 'tb' && x.key) return;
        if (o.noExtra) return;
        const val = x.kind === 'checkbox' ? x.val === true || x.val === 'true' : String(x.val ?? '');
        if (x.kind !== 'checkbox' && val === '') {
          empty.push(tplLabel(x));
          return;
        }
        const k = `x${j}_${i}`;
        v[k] = val;
        extra.push({ key: k, label: x.label, nth: x.nth || 0, kind: x.kind, by: x.by || '', loc: x.loc || null, ctl: x.ctl || null, vang: !!x.vang });
      });
      return { titleKey: t.key === t.base ? '' : t.titleKey || '', rows, extra };
    });
    const t0 = ts[0] || {};
    return { msg: { section: { tpl: true, base: kind, per, scope: t0.scope, titleKey: t0.titleKey || '', strict: !!o.strict }, values: v }, empty, anyField };
  }
  // hồ sơ đang mở là của TB nào (Số biên nhận trên trang; cửa sổ Nhập đơn đăng ký: ô Mã đơn) – để không điền dữ liệu TB khác vào hồ sơ
  async function openDossierTbs() {
    let so = '';
    try {
      so = await dossierSo();
    } catch (e) {}
    if (!so)
      try {
        const f = (await act('donRead')).find((x) => x.ok);
        so = (f && f.maDon) || '';
      } catch (e) {}
    return so ? tbOfSo(so).list : [];
  }
  async function tplFillFields(t, idx, o = {}) {
    const tb = curTB();
    const base = t.base || '';
    if (base && !tb) throw new Error('chưa chọn TB');
    if (base) {
      // mẫu lấy dữ liệu TB: hồ sơ đang mở phải là của TB đang chọn (rõ là TB khác → không điền)
      const l = await openDossierTbs();
      if (l.length === 1 && String(l[0].tb) !== String(tb.tb))
        throw new Error(`hồ sơ đang mở là của TB ${l[0].tb}, không phải TB ${tb.tb} đang chọn – chọn TB ${l[0].tb} rồi bấm Điền (tiện ích không điền dữ liệu TB khác vào hồ sơ này)`);
    }
    let values = {};
    if (base === 'chu' || base === 'thua' || base === 'giayTo') {
      const arr = (tb && (base === 'chu' ? tb.chu : base === 'thua' ? tb.thua : tb.giayTo)) || [];
      if (!arr[idx]) throw new Error(`TB ${tb.tb} không có ${base === 'chu' ? 'chủ' : base === 'thua' ? 'thửa' : 'giấy tờ'} số ${idx + 1}`);
      values = buildValues(base, tb, idx);
    } else if (base === 'bienNhan') values = { ...buildValues('bienNhan', tb), phuongXa: tb.phuongXa || DEFAULT_PHUONG, quyTrinh: tb.quyTrinh || DEFAULT_QUY_TRINH };
    else if (base === 'donDK') values = buildValues('donDK', tb);
    const m = tplMsgOf([t], base, values, { strict: true });
    if (!m.anyField) throw new Error('mẫu chưa có ô nào được tích');
    const r = await send({ type: 'vbdlis-fill', ...m.msg });
    if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
    const p = pickFrame(r, base || 'mẫu', t.name);
    if (!p.f) throw new Error(p.err);
    // ô đã tích lấy từ dữ liệu TB mà TB không có giá trị (bộ điền bỏ qua, không báo lỗi) → ghi lại để không bấm nút của mẫu
    p.f.missing = (t.items || [])
      .filter((x) => x.on && !x.ban && x.src === 'tb' && x.key && (values[x.key] == null || String(values[x.key]).trim() === ''))
      .map((x) => tplLabel(x));
    p.f.empty = m.empty; // ô giá trị mẫu trống: không điền (ô giữ nguyên), không chặn nút
    p.f.notes = p.f.notes || [];
    return p.f;
  }
  // mẫu của cửa sổ đang mở (tên k): khóa bản 1.20 trước, rồi khóa cũ; base: phần của tiện ích ('' = cửa sổ khác).
  // Mẫu phần cũ chưa tách theo cửa sổ (không có tên cửa sổ): dùng khi không có mẫu đúng tên
  function tplForWin(k, base) {
    let best = null;
    let bs = 0;
    for (const t of Object.values(S.tpl || {})) {
      if (!t || !t.items || (t.base || '') !== (base || '') || t.scope !== 'modal' || /^d:/.test(t.key || '')) continue;
      const s = t.titleKey && t.key !== t.base ? tplMatch(k, t) : base ? 0.5 : 0;
      if (s > bs || (s && s === bs && String(t.titleKey || '').length > String(best.titleKey || '').length)) {
        best = t;
        bs = s;
      }
    }
    return bs > 0 ? best : null;
  }
  const tplOn = (t) => !!t && ((t.items || []).some((x) => x.on && !x.ban) || (t.btns || []).some((b) => b.on));

  // ---- mẫu tab Trường trong file sao lưu tiến độ: tích, thứ tự nút, giá trị mẫu bạn đặt ----
  // Không đưa vào file: giá trị có thể là dữ liệu cá nhân (dãy số dài, ô họ tên / giấy tờ / địa chỉ / điện thoại / email…)
  const PII_LAB = /(ho ten|ho va ten|so giay to|dinh danh|cccd|cmnd|can cuoc|dien thoai|email|dia chi|ngay sinh|nam sinh)/;
  const TAI_KHOAN = /\b[a-z]{2,8}\.[a-z0-9_]{3,}\b/i; // tên tài khoản (vd. bgi.xxx_vy) – không đưa vào file
  function tplForBackup(all) {
    let dropped = 0;
    let droppedTpl = 0;
    const out = {};
    // tên người trong dữ liệu TB (người nộp, chủ – từ 2 chữ trở lên), tên tài khoản (bgi.…, tài khoản trong cài đặt), dãy số dài:
    // không đưa vào file (hộp hỏi đã dạy có khóa / tên lấy từ chữ của hộp – có thể có tên người)
    const names = [
      ...new Set(
        S.data
          .flatMap((x) => [x && x.nguoiNop && x.nguoiNop.hoTen, ...((x && x.chu) || []).map((c) => c && c.hoTen)])
          .filter(Boolean)
          .map((n) => norm(n))
          .filter((n) => n.split(' ').length >= 2)
      ),
    ];
    const accs = [S.opts.ctCV, S.opts.ctLD, S.opts.ctB4].filter(Boolean).map((a) => norm(a));
    const badS = (s) => {
      const raw = String(s || '');
      const v = norm(raw);
      return /\d{9,}/.test(raw) || /\bbgi\.[\w.]+/i.test(raw) || accs.some((a) => v.includes(a)) || names.some((n) => v.includes(n));
    };
    for (const [k, t] of Object.entries(all || {})) {
      if (!t || !Array.isArray(t.items)) continue;
      const isDlg = /^d:/.test(k) || /^d:/.test(t.titleKey || '');
      // mẫu tên đầy đủ cũ (có số hồ sơ, bản ≤ 1.17.1 – giữ nguyên khóa cũ theo S1) chỉ dùng cho đúng hồ sơ đó → không đưa vào file
      const legacyFull = /^w:/.test(k) && t.scope === 'modal' && /\d/.test(t.titleKey || '') && winKey(t.titleKey) !== t.titleKey;
      if (legacyFull || (isDlg && (badS(k) || badS(t.titleKey) || badS(t.name))) || badS(t.titleKey)) {
        droppedTpl++;
        continue;
      }
      // dòng chưa tích, không phải ô tiện ích biết, mà tên dòng có tên người / tài khoản → không đưa vào file
      const items = t.items
        .filter((x) => {
          if (!x.on && !x.key && badS(x.label)) {
            dropped++;
            return false;
          }
          return true;
        })
        .map((x) => {
        const y = {
          label: x.label,
          nth: x.nth || 0,
          kind: x.kind,
          key: x.key || '',
          kname: x.kname || '',
          ban: !!x.ban,
          on: !!x.on,
          src: x.src,
          by: x.by || '',
          loc: x.loc || null,
          ctl: x.ctl || null,
          multi: !!x.multi,
          vang: !!x.vang,
          locked: !!x.locked,
          uv: !!x.uv,
          amb: !!x.amb,
          lostTb: !!x.lostTb,
        };
        if (x.on && !x.ban && x.src !== 'tb' && x.val !== undefined) {
          const v = String(x.val);
          const acc = [S.opts.ctCV, S.opts.ctLD, S.opts.ctB4].filter(Boolean).some((a) => norm(v).includes(norm(a)));
          if (/\d{9,}/.test(v) || PII_LAB.test(norm(x.label)) || TAI_KHOAN.test(v) || acc || badS(v)) dropped++;
          else y.val = x.val;
        }
        return y;
      });
      const btns = (t.btns || [])
        .filter((b) => {
          if (!b.on) return false;
          if (/\d{9,}/.test(String(b.text || '') + String(b.key || '')) || [b.text, b.tip, b.ctx, b.row].some(badS)) {
            dropped++;
            return false;
          }
          return true;
        })
        .map((b) => ({
          text: b.text,
          key: b.key,
          nth: b.nth,
          id: b.id || '',
          tip: b.tip || '',
          row: b.row || '',
          rnth: b.rnth || 0,
          ctx: b.ctx || '',
          on: true,
          ord: b.ord || '',
          vang: !!b.vang,
          lock: b.lock === 'link' ? 'link' : '',
          off: !!b.off,
          pos: !!b.pos,
        }));
      // tên mẫu (chỉ để hiện) có tên người / tài khoản → tên trung tính theo cửa sổ / màn hình
      const name = badS(t.name) ? (t.scope === 'page' ? 'Màn hình (tên đã ẩn)' : 'Cửa sổ (tên đã ẩn)') : t.name;
      out[k] = { key: t.key, name, base: t.base || '', scope: t.scope, titleKey: t.titleKey || '', dlg: !!t.dlg, items, btns, at: t.at || 0, kv: t.kv || 1 };
    }
    return { out, dropped, droppedTpl };
  }
  // nạp file sao lưu: chỉ THÊM mẫu máy này chưa có (mẫu đang có giữ nguyên; mẫu bạn đã xóa sau lúc sao lưu không sống lại)
  async function tplRestore(inc) {
    if (!inc || typeof inc !== 'object' || Array.isArray(inc)) return { tplAdd: 0, tplKeep: 0 };
    const r = await store.get(['tbTpl', 'tbTplDel']);
    const cur = { ...(r.tbTpl || {}) };
    const del = r.tbTplDel || {};
    let tplAdd = 0;
    let tplKeep = 0;
    for (const [k, t] of Object.entries(inc)) {
      if (/^(__proto__|constructor|prototype)$/.test(k) || !t || typeof t !== 'object' || t.key !== k || !Array.isArray(t.items) || !Array.isArray(t.btns || [])) continue;
      if (!/^(w:|d:|chu|thua|donDK|giayTo|bienNhan)/.test(k)) continue;
      if (cur[k]) {
        tplKeep++;
        continue;
      }
      if (del[k] && del[k] >= (t.at || 0)) continue;
      cur[k] = { ...t, btns: t.btns || [] };
      tplAdd++;
    }
    if (tplAdd) {
      tplMigrateAll(cur);
      S.tpl = cur;
      await store.set({ tbTpl: cur });
    }
    return { tplAdd, tplKeep };
  }
  // ---- cấu hình tab Trường (bạn yêu cầu 23/11: “mỗi nơi làm 1 khác … lưu lại cấu hình để cho các nơi có thể dùng”) ----
  // Xuất: một file JSON gồm mọi mẫu (đã lọc như file sao lưu). Nạp: cho xem mẫu thêm mới / đã có, hỏi trước khi thay mẫu đang có
  function tplExport() {
    const mt = tplForBackup(S.tpl);
    const obj = { loai: 'vbdlis-cau-hinh-truong', phienBan: PANEL_VERSION, luc: new Date().toISOString(), soMau: Object.keys(mt.out).length, mauTruong: mt.out };
    const name = saveFile(`cau-hinh-truong-vbdlis-${stamp()}.json`, new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
    return { name, n: obj.soMau, dropped: mt.dropped, droppedTpl: mt.droppedTpl };
  }
  // mẫu hợp lệ trong file cấu hình (hoặc file sao lưu tiến độ có mẫu), đã chuyển sang khóa bản 1.20
  function tplParseImport(j) {
    const inc = j && (j.loai === 'vbdlis-cau-hinh-truong' || j.loai === 'vbdlis-tien-do') ? j.mauTruong : null;
    if (!inc || typeof inc !== 'object' || Array.isArray(inc)) throw new Error('không phải file cấu hình tab Trường của tiện ích (cau-hinh-truong-vbdlis-….json)');
    const map = {};
    for (const [k, t] of Object.entries(inc)) {
      if (/^(__proto__|constructor|prototype)$/.test(k) || !t || typeof t !== 'object' || t.key !== k || !Array.isArray(t.items) || !Array.isArray(t.btns || [])) continue;
      if (!/^(w:|d:|chu|thua|donDK|giayTo|bienNhan)/.test(k)) continue;
      map[k] = { ...t, btns: (t.btns || []).map((b) => ({ ...b })), items: t.items.map((x) => ({ ...x })) };
    }
    tplMigrateAll(map);
    return map;
  }
  async function tplImportFile(file) {
    let j;
    try {
      j = JSON.parse(await file.text());
    } catch (e) {
      throw new Error('file không đọc được (không phải file JSON)');
    }
    const map = tplParseImport(j);
    const keys = Object.keys(map);
    if (!keys.length) throw new Error('file không có mẫu nào');
    const add = keys.filter((k) => !S.tpl[k]);
    const repl = keys.filter((k) => S.tpl[k]);
    S.cfgImp = { map, add, repl };
    const nm = (ks) => ks.map((k) => esc(map[k].name || k)).join(', ');
    const luc = j.luc ? Date.parse(j.luc) : 0;
    setResult(
      `<div class="sum">Nạp cấu hình “${esc(file.name)}”${luc ? ` (xuất lúc ${esc(fmtTime(luc))})` : ''}: ${keys.length} mẫu</div>` +
        (add.length ? `<div class="ln ok">+ Thêm mới ${add.length}: ${nm(add)}</div>` : '') +
        (repl.length ? `<div class="ln muted">↻ Máy này đã có ${repl.length}: ${nm(repl)} – thay bằng bản trong file thì mất tích / giá trị của mẫu đang có</div>` : '') +
        `<div class="row">${add.length ? `<button class="btn pri" id="cfgAdd">Thêm ${add.length} mẫu mới${repl.length ? ', giữ mẫu đang có' : ''}</button>` : ''}${
          repl.length ? `<button class="btn" id="cfgAll">${add.length ? 'Thêm + ' : ''}thay ${repl.length} mẫu đang có</button>` : ''
        }<button class="btn" id="cfgCancel">Hủy</button></div>`
    );
  }
  async function tplImportApply(all) {
    const c = S.cfgImp;
    if (!c) return;
    const put = all ? [...c.add, ...c.repl] : c.add;
    const n = { ...S.tpl };
    put.forEach((k) => (n[k] = { ...c.map[k], at: Date.now() }));
    // đang mở bảng tích của mẫu vừa thay → đóng (không để lần tích sau ghi đè bản vừa nạp)
    if (S.tplDraft && put.includes(S.tplDraft.key)) {
      clearTimeout(S.tplSaveT);
      S.tplSaveT = null;
      S.tplDraft = null;
    }
    S.tpl = n;
    S.cfgImp = null;
    await store.set({ tbTpl: n });
    setResult(
      `<div class="ok">✓ Đã nạp cấu hình: thêm ${c.add.length} mẫu${all && c.repl.length ? `, thay ${c.repl.length} mẫu` : c.repl.length ? `, giữ nguyên ${c.repl.length} mẫu đang có` : ''}.</div>`
    );
  }
  // ghi chú của lần điền theo mẫu: ô bỏ tích (không điền), ô bắt buộc bỏ tích mà trang trống / khác, ô mẫu không thấy lúc này
  const tplNoteHtml = (f) =>
    [
      (f.off || []).length && `• Không điền theo mẫu tab Trường (ô bỏ tích / không có trong mẫu): ${f.off.join(', ')}`,
      (f.tplSkip || []).length && `⚠ Ô bắt buộc bỏ tích mà trên trang đang trống / khác dữ liệu TB: ${f.tplSkip.join(', ')} – bạn điền tay`,
      ...(f.notes || []).map((n) => `• ${n}`),
    ]
      .filter(Boolean)
      .map((s) => `<div class="ln muted">${esc(s)}</div>`)
      .join('');
  // dòng nhật ký của một lần chạy mẫu (ô, ô trống, ghi chú, nút, hộp hỏi đã trả lời)
  function tplLogInto(log, f) {
    (f.results || []).forEach((r) =>
      log.push({ icon: r.ok ? '✓' : '✗', cls: r.ok ? 'ok' : 'bad', html: `<b>${esc(r.name)}</b> = ${esc(r.value)}${r.msg ? ` <span class="muted">(${esc(r.msg)})</span>` : ''}` })
    );
    (f.empty || []).forEach((n) => log.push({ icon: '•', cls: 'muted', html: `${esc(n)} – giá trị mẫu trống, không điền (ô giữ nguyên)` }));
    (f.notes || []).forEach((n) => log.push({ icon: '•', cls: 'muted', html: esc(n) }));
    (f.clicks || []).forEach((c) =>
      log.push(
        c.q
          ? { icon: '✗', cls: 'bad', html: `Trang còn hỏi sau khi làm theo mẫu <span class="muted">(${esc(c.why)})</span>` }
          : {
              icon: c.skip ? '•' : c.ok ? '✓' : '✗',
              cls: c.skip ? 'muted' : c.ok ? 'ok' : 'bad',
              html: `${c.skip ? 'Bỏ qua' : c.ok ? 'Đã bấm' : 'Chưa bấm'} <b>“${esc(c.name)}”</b>${c.why ? ` <span class="muted">(${esc(c.why)})</span>` : ''}`,
            }
      )
    );
    (f.answered || []).forEach((n) => log.push({ icon: '•', cls: 'muted', html: esc(n) }));
  }
  // hộp hỏi bạn đã dạy (mẫu hộp hỏi ở tab Trường): khóa hộp → nút trả lời (nút đã tích, số thứ tự nhỏ nhất)
  function learnedDialogs() {
    const out = [];
    for (const t of Object.values(S.tpl || {})) {
      if (!t || !/^d:/.test(t.key || '')) continue;
      const b = (t.btns || []).filter((x) => x.on).sort((a, c) => tplOrd(a) - tplOrd(c))[0];
      if (b) out.push({ key: t.key, btn: { key: b.key, nth: b.nth, id: b.id || '' } });
    }
    return out;
  }
  // màn hình Tiếp nhận + mẫu “Màn hình Tiếp nhận hồ sơ” (tab Trường): mỗi ô chính lấy gì –
  // tb (dữ liệu TB), fix (giá trị mẫu), off (bỏ tích: tiện ích không điền; ô bắt buộc vẫn phải đúng dữ liệu TB trước khi Lưu hồ sơ)
  const RECEP_REQ = ['phuongXa', 'quyTrinh', 'soBienNhan', 'nguoiNop'];
  const RECEP_NAME = { phuongXa: 'Phường/Xã', quyTrinh: 'Quy trình/Thủ tục', soBienNhan: 'Số biên nhận', diaChiTaiSan: 'Địa chỉ tài sản', nguoiNop: 'Người nộp hồ sơ', soGiayTo: 'Số giấy tờ', diaChi: 'Địa chỉ' };
  function recepPlan() {
    const t = S.tpl && S.tpl.bienNhan;
    const plan = {};
    for (const k of ['phuongXa', 'quyTrinh', 'soBienNhan', 'diaChiTaiSan', 'nguoiNop', 'soGiayTo', 'diaChi']) {
      const x = t && (t.items || []).find((y) => y.key === k);
      // “chỉ nhập chỗ ý” (bạn yêu cầu 23/11): đã có mẫu màn hình Tiếp nhận mà mẫu không có ô này → không điền
      if (!x) plan[k] = t && t.items ? { use: 'off', label: `${RECEP_NAME[k]} (không có trong mẫu)` } : { use: 'tb' };
      else if (!x.on || x.ban) plan[k] = { use: 'off', label: tplLabel(x) };
      else if (x.src === 'tb') plan[k] = { use: 'tb' };
      else {
        const v = String(x.val ?? '');
        plan[k] = v === '' ? { use: 'off', label: tplLabel(x) } : { use: 'fix', value: v };
      }
    }
    return plan;
  }
  // 🤖 + cửa sổ tiện ích tự làm (bạn chọn 23/11): làm thêm phần bạn đã tích trong mẫu của cửa sổ đó, TRƯỚC nút chốt.
  // o: { base: phần ('' = cửa sổ khác), decide: [khóa nút chốt – chuỗi tự bấm một lần, không bấm theo mẫu], fields: điền thêm ô giá trị mẫu
  //      đã tích (ô dữ liệu TB chuỗi tự điền), skipKeys: ô chuỗi tự điền, step: (tên) → dòng nhật ký }
  // Nút đóng cửa sổ (Đóng, ×, Hủy…) và đường link không bấm. Trả về '' (xong / không có gì) hoặc lý do (chuỗi dừng trước nút chốt)
  // nút đóng / hủy cửa sổ (khóa nút của tab Trường): chữ (cả “Hủy bỏ”, “Đóng lại”…), chữ gợi ý “title:…”, biểu tượng ×, fa-times…
  // – không bấm trong chuỗi (bạn chọn 23/11: Đóng / × bỏ qua). So CẢ CHUỖI (không lấy “dong y”, “dong bo”, “huy ho so”…)
  const CLOSE_KEY = /^(dong|dong lai|dong cua so|huy|huy bo|thoat|bo qua|close|cancel|x)$/;
  const isCloseKey = (k) =>
    k === 'sym:close' || /^sym:[×✕✖✗╳⨯]$/.test(k) || /^icon:(fa|glyphicon|icon)-(times|close|remove|xmark)\b/.test(k) || CLOSE_KEY.test(k.replace(/^title:/, ''));
  async function tplChainExtras(o) {
    if (!AUTO()) return '';
    const top = (await act('modalState')).find((x) => x.open);
    if (!top) return '';
    const t = tplForWin(modalKey(top), o.base || '');
    if (!t) return '';
    // chuỗi đã làm cửa sổ này ở lần mở này → bộ theo dõi không chạy mẫu lại trên cùng lần mở (kể cả khi chuỗi dừng, cửa sổ còn mở)
    if (top.oid) S.tplRan.add(`${t.key}|${top.oid}`);
    const decide = new Set(o.decide || []);
    const only = (b) => !decide.has(b.key) && !isCloseKey(String(b.key || '')) && b.lock !== 'link';
    const items = (t.items || []).map((x) =>
      o.fields && x.on && !x.ban && !x.locked && (x.src !== 'tb' || !x.key) && !(o.skipKeys || []).includes(x.key) ? x : { ...x, on: false }
    );
    const anyF = items.some((x) => x.on);
    const anyB = (t.btns || []).some((b) => b.on && only(b));
    if (!anyF && !anyB) return '';
    const c = o.step(`Theo mẫu tab Trường – ${t.name}`);
    let f;
    try {
      f = await tplFill({ ...t, base: '', items }, 0, { auto: true, only, noTail: true });
    } catch (e) {
      c.bad(friendly(e));
      return `mẫu tab Trường chưa làm được (${friendly(e)})`;
    }
    const lines = [
      ...(f.results || []).map((r) => `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` (${r.msg})`}`),
      ...(f.empty || []).map((n) => `• ${n}: giá trị mẫu trống`),
      ...(f.clicks || []).map((x) => `${x.skip ? '• bỏ qua' : x.ok ? '✓ bấm' : '✗ chưa bấm'} “${x.name}”${x.why ? ` (${x.why})` : ''}`),
    ];
    if ((f.results || []).some((r) => !r.ok) || (f.clicks || []).some((x) => !x.ok)) {
      c.bad(lines.join('; '));
      return 'mẫu tab Trường chưa làm trọn: ' + lines.filter((l) => /^✗/.test(l)).join('; ');
    }
    // đã bấm nút theo mẫu → chờ chút xem trang có hiện hộp hỏi / báo không (chỉ xem, không trả lời) – có thì dừng trước nút chốt
    if ((f.clicks || []).some((x) => x.ok && !x.skip && !x.q)) {
      for (let i = 0; i < 3; i++) {
        await sleep(400);
        if (S.stopReq) {
          c.bad(lines.join('; ') + ' – bạn bấm ■ Dừng');
          return 'bạn bấm ■ Dừng';
        }
        const dd = (await act('dialogState')).find((x) => x.open);
        if (dd) {
          if (o.dlgOk && !(dd.errs || [])[0]) break; // cửa sổ đơn: hộp hỏi để bước Lưu thông tin đăng ký trả lời / chờ bạn (như bản 1.20)
          c.bad(lines.join('; '));
          return `trang đang hiện hộp “${String((dd.titles && dd.titles[0]) || '').slice(0, 80)}” sau nút theo mẫu tab Trường`;
        }
      }
    }
    c.ok(lines.join('; '));
    return '';
  }
  // “Điền” / “Điền ngay”: lần mở cửa sổ (oid) / lần vào màn hình của mẫu – chụp TRƯỚC khi điền (nút theo mẫu có thể mở cửa sổ con)
  async function tplRunId(t) {
    try {
      if (t.scope === 'page') return pageVisitId();
      if (/^d:/.test(t.key || '')) return '';
      const top = (await act('modalState')).find((x) => x.open);
      return top && top.oid && tplMatch(modalKey(top), t) > 0 ? top.oid : '';
    } catch (e) {
      return '';
    }
  }
  // bạn đã tự chạy mẫu (Điền) → coi như mẫu đã chạy ở lần mở / lần vào này (bật 🤖 sau đó không chạy lại), kể cả khi 🤖 đang tắt
  function tplMarkRan(t, rid) {
    if (rid) S.tplRan.add(`${t.key}|${rid}`);
    S.tplLast[t.key] = { at: Date.now() };
    saveTplLast();
  }
  // khóa màn hình chính (giống bộ điền): địa chỉ trang; mỗi lần vào màn hình = một lần (địa chỉ + lúc trang tải)
  const pageTplKey = () => 'path:' + (location.pathname.replace(/\/+$/, '') + (location.hash || '').split('?')[0]).toLowerCase();
  const pageVisitId = () => {
    let h = 5381;
    const s = location.href;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'v' + (h >>> 0).toString(36) + '.' + Math.round(performance.timeOrigin % 1e9).toString(36);
  };
  // chữ ký 🤖 chạy mẫu: 'tpl:<số lần mở>:<khóa mẫu>' | 'ptpl:<lần vào màn hình>:<khóa mẫu>'
  const tplSigKey = (sig) => {
    const a = sig.indexOf(':');
    return sig.slice(sig.indexOf(':', a + 1) + 1);
  };
  // 🤖 chạy mẫu (tab Trường): mỗi lần cửa sổ / hộp hỏi mở (màn hình chính: mỗi lần vào) đúng MỘT lần.
  // null = giữ nguyên (đang chờ bạn / đã chạy lần mở này), còn lại = chữ ký để chạy
  function tplSigOf(t, id, kind) {
    const ran = `${t.key}|${id}`;
    if (!id || S.tplRan.has(ran)) return null;
    // bảng tích của mẫu này đang mở ở tab Trường (bạn đang tích) → chờ bạn đóng bảng tích
    if (S.tplDraft && S.tplDraft.key === t.key && S.tab === 'tr' && !pn.classList.contains('min')) {
      autoWaitNote(t, `🤖 sẽ điền + bấm theo mẫu ${qn(t.name)} khi bạn đóng bảng tích (Lưu mẫu / Đóng)`);
      return null;
    }
    // chống lặp: mẫu có nút đã tích vừa tự chạy (20 giây) mà bạn chưa đụng vào trang → không chạy lại, báo bạn
    const last = S.tplLast[t.key];
    const near =
      !!last && (Date.now() - last.at < 20000 || (kind === 'ptpl' && performance.timeOrigin >= last.at - 1000 && performance.timeOrigin - last.at < 20000));
    if (last && near && (t.btns || []).some((b) => b.on) && Math.max(USER.at, S.userAtSaved || 0) < last.at) {
      S.tplRan.add(ran); // lần mở / lần vào này không tự chạy nữa (bạn vẫn bấm “Điền” được)
      if (S.holdNote !== 'loop|' + ran) {
        S.holdNote = 'loop|' + ran;
        setStatus(`🤖 Mẫu ${qn(t.name)} vừa tự chạy mà cửa sổ lại mở ngay (không do bạn) – không chạy lại để tránh lặp; cần thì bấm “Điền” ở tab Trường.`, true);
        needYou('Mẫu vừa chạy – cửa sổ lại mở', 'bad');
      }
      return null;
    }
    return `${kind}:${id}:${t.key}`;
  }
  // 🤖 đang chờ bạn đóng bảng tích → ghi một dòng (một lần) và hiện trong bảng tích
  function autoWaitNote(t, text) {
    const was = S.autoWaitNote && S.autoWaitNote.key === t.key && S.autoWaitNote.text === text;
    S.autoWaitNote = { key: t.key, text };
    if (was) return;
    setStatus(text);
    if (S.tab === 'tr') {
      const a = root.activeElement;
      if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.type === 'checkbox') render();
    }
  }
  // tab khác vừa sửa mẫu đang mở bảng tích → lấy tích / nguồn / giá trị / thứ tự của bản đó (giữ dòng của lần lấy trường này)
  // trả true khi bộ dòng / nút của hai bản giống nhau (khác → bảng tích đang mở đã cũ)
  function tplAdopt(d, t) {
    const sameI = (a, b) => a.label === b.label && (a.nth || 0) === (b.nth || 0) && (a.kind || 'text') === (b.kind || 'text');
    let same = d.items.length === (t.items || []).length && (d.btns || []).length === (t.btns || []).length;
    d.items.forEach((x) => {
      const y = (t.items || []).find((z) => sameI(x, z));
      if (y) Object.assign(x, { on: y.on, src: y.src, val: y.val, uv: y.uv });
      else same = false;
    });
    const sameB = (a, b) => a.key === b.key && (a.nth || 0) === (b.nth || 0) && (a.row || '') === (b.row || '') && (a.rnth || 0) === (b.rnth || 0);
    (d.btns || []).forEach((x) => {
      const y = (t.btns || []).find((z) => sameB(x, z));
      if (y) Object.assign(x, { on: y.on, ord: y.ord });
      else same = false;
    });
    return same;
  }

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
              `<option value="${esc(x.tb)}">${STAGE_ICON[showStage(x)]} TB ${esc(x.tb)} – ${esc(whoOf(x))} (${(x.thua || []).length} thửa)${dups.has(String(x.tb)) ? ' ⚠ trùng thửa' : ''}</option>`
          )
          .join('')
      : '<option>(chưa có dữ liệu)</option>';
    if (tb) sel.value = String(tb.tb);
    const cnt = { chua: 0, tn: 0, xong: 0, hoan: 0 };
    S.data.forEach((x) => cnt[showStage(x)]++);
    // trong số “Chưa xong”: bao nhiêu TB đã tiếp nhận trên VBDLIS (chưa chuyển lãnh đạo)
    const nTn = S.data.filter((x) => showStage(x) === 'chua' && stageOf(x) === 'tn').length;
    $('#progTxt').textContent = S.data.length
      ? `✓ ${cnt.xong} xong · ◐ ${cnt.tn} đã nhập chưa xong` +
        (cnt.hoan ? ` · ⏸ ${cnt.hoan} hoãn` : '') +
        ` · ○ ${cnt.chua} chưa xong${nTn ? ` (${nTn} đã tiếp nhận)` : ''}` +
        (S.curBy === 'auto' && recvTB() && String(recvTB().tb) !== String((tb || {}).tb) ? ` · con trỏ tiếp nhận: TB ${recvTB().tb}` : '')
      : '';
    const ss = $('#tbStage');
    ss.value = tb ? showStage(tb) : 'chua';
    ss.disabled = !tb || !!S.running;
    const s = tb && S.stage[String(tb.tb)];
    const info = s
      ? [
          s.hoan && `hoãn: ${s.hoan.lyDo || 'không ghi lý do'}`,
          s.tn && `tiếp nhận ${fmtTime(s.tn)}`,
          s.cv && `chuyển CV ${fmtTime(s.cv)}`,
          s.don && `nhập đơn ${fmtTime(s.don)}`,
          s.ld && `chuyển LĐ ${fmtTime(s.ld)}${s.ldBy === 'suy' ? ' (suy ra)' : ''}`,
          s.daDung && `số biên nhận đã dùng cho hồ sơ khác ${fmtTime(s.daDung)}`,
          s.kd && `LĐ ký duyệt ${fmtTime(s.kd)}`,
          s.kq && !s.trk && `LĐ trả về ${fmtTime(s.kq)}`,
          s.trk && `sang Trả KQ ${fmtTime(s.trk)}`,
          s.tra && `trả hồ sơ ${fmtTime(s.tra)}`,
          s.fwd && !s[s.fwd.k] && `⏳ đang ${FWD_TEXT[s.fwd.k] || 'chuyển'}${s.fwd.bad ? ' (chưa rõ)' : ''}`,
          s.tnClick && !s.tn && '⚠ đã bấm Lưu hồ sơ, chưa thấy báo',
          s.htClick && !s.don && '⚠ đã bấm Hoàn tất, chưa thấy báo',
          s.quet && !s.xong && `lưu kho HSQ ${fmtTime(s.quet)}`,
          s.xong && `xong ${fmtTime(s.xong)}`,
          s.lech ? `⚠ lệch ${s.lech} ô` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
    // TB đang tạm giữ (🤖 dừng chờ bạn) → ghi luôn ở dòng này (thanh trạng thái chỉ hiện 5 giây)
    const HOLD_TXT = { err: 'đã dừng – 🤖 tự chạy lại sau ít giây (bạn không thao tác), hoặc bấm “▶ Chạy cả TB”', tt: 'chờ bạn tự bấm Thực thi / Thực hiện', don: 'chờ bạn Lưu thông tin đăng ký, Hoàn tất' };
    const holdOne = (h) =>
      h.kind !== 'err'
        ? HOLD_TXT[h.kind] || 'chờ bạn'
        : h.stop || h.hard || h.noted || S.userStopAt
          ? 'đã dừng – xem bảng điền, xong bấm “▶ Chạy cả TB”'
          : h.dlg
            ? 'chờ bạn trả lời hộp hỏi – trả lời xong 🤖 làm tiếp'
            : HOLD_TXT.err;
    const holdTxt = AUTO() ? [...S.autoHold.entries()].map(([id, h]) => `⏸ 🤖 TB ${id}: ${holdOne(h)}`).join(' · ') : '';
    $('#stageInfo').textContent = [holdTxt, info].filter(Boolean).join(' · ');
    const ab = $('#autoBtn');
    const khac = S.opts.tuDong === true && !AUTO() && S.tabId !== undefined && S.autoTab != null; // đang bật ở tab VBDLIS khác
    if (ab) {
      ab.textContent = AUTO() ? '🤖 Tự động: BẬT' : khac ? '🤖 Tự động: ở tab khác' : '🤖 Tự động: TẮT';
      host.setAttribute('data-auto', AUTO() ? '1' : ''); // biểu tượng tiện ích lúc 🤖 bật: thu nhỏ thay vì ẩn bảng
      ab.classList.toggle('on', AUTO());
      if (khac) ab.title = 'Tự động hết đang chạy ở một tab VBDLIS khác – tab này không tự bấm gì. Bấm để chuyển sang chạy ở tab này.';
    }
    const bb = $('#bulkBtn');
    if (bb) {
      const on = bulkOn();
      const lb = bulkLoad();
      bb.textContent = on ? '⚡ Soát loạt: BẬT' : '⚡ Soát loạt';
      bb.classList.toggle('on', on);
      bb.style.display = isLd() ? 'none' : '';
      bb.title =
        (on ? 'Soát hàng loạt đang BẬT – bấm để tắt (🤖 tìm từng TB như cũ).' : 'Soát hàng loạt đang TẮT – bấm để bật.') +
        ' Bật: ở Danh sách hồ sơ thụ lý, 🤖 tải lại cả danh sách MỘT lần (ô tìm trống, thanh lọc “Tất cả”), lật hết các trang, gom số biên nhận rồi đối chiếu cùng lúc mọi TB ◐ và TB ✓ chờ kiểm:' +
        ' TB ◐ không còn hồ sơ → ✓ Xong (như lần tìm không thấy), TB ✓ không còn hồ sơ → đã kiểm; chỉ TB còn hồ sơ mới tìm từng số để mở làm. Đọc không trọn danh sách → lượt đó tìm từng TB như cũ.' +
        (lb && lb.at ? ` Lần soát gần nhất ${fmtTime(lb.at)}: ${lb.bad ? `không đọc trọn (${lb.bad})` : `${lb.n || 0} hồ sơ / ${lb.pages || 0} trang · ✓ ${lb.xong || 0} TB · còn hồ sơ ${lb.co || 0} TB`}.` : '');
    }
    const mb = $('#miniAuto');
    if (mb) {
      mb.classList.toggle('on', AUTO());
      mb.textContent = AUTO() ? '🤖 BẬT' : '🤖';
      mb.title = AUTO()
        ? '🤖 Tự động hết đang BẬT – bấm để tắt'
        : khac
          ? '🤖 Tự động hết đang chạy ở tab VBDLIS khác – bấm để chuyển sang tab này'
          : '🤖 Tự động hết đang tắt – bấm để bật (tự chạy luôn màn hình đang mở)';
    }
    $('#stageInfo').title = s
      ? [
          s.hoan && `Tạm hoãn từ ${fmtIso(s.hoan.at)}: ${s.hoan.lyDo || ''}`,
          s.tn && `Tiếp nhận: ${fmtIso(s.tn)} (${BY_TEXT[s.tnBy] || s.tnBy || ''})`,
          s.cv && `Chuyển tiếp chuyên viên: ${fmtIso(s.cv)} (${BY_TEXT[s.cvBy] || s.cvBy || ''})`,
          s.don && `Nhập đơn xong: ${fmtIso(s.don)} (${BY_TEXT[s.donBy] || s.donBy || ''})`,
          s.ld && `Chuyển tiếp lãnh đạo: ${fmtIso(s.ld)} (${BY_TEXT[s.ldBy] || s.ldBy || ''})`,
          s.quet && `Lưu kho hồ sơ quét: ${fmtIso(s.quet)} (${BY_TEXT[s.quetBy] || s.quetBy || ''})`,
          s.xong && `Xong: ${fmtIso(s.xong)} (${BY_TEXT[s.xongBy] || s.xongBy || ''})`,
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
    if (S.opts.amBao === false) return;
    // trang vừa tải lại / bạn chưa bấm gì trên trang → trình duyệt chặn tiếng của trang → tiện ích phát “ting” qua trang ẩn của nó
    if (!ATT.ctx || ATT.ctx.state !== 'running') {
      send({ type: 'vbdlis-beep', kind });
      return;
    }
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
  // thôi nháy tên tab (dấu “!” trên biểu tượng vẫn còn)
  function stopFlash() {
    clearInterval(ATT.timer);
    ATT.timer = null;
    if (ATT.title != null) {
      // chỉ trả lại tên cũ khi tên tab vẫn là tên nháy của tiện ích (trang có thể đã tự đổi tên tab)
      if (/^⏸ /.test(document.title)) document.title = ATT.title;
      ATT.title = null;
    }
  }
  function stopNeed() {
    stopFlash();
    if (ATT.badge) {
      ATT.badge = false;
      send({ type: 'vbdlis-badge', text: '' });
    }
  }
  // bắt đầu chờ bạn: kêu 1 lần; bạn đang ở tab / cửa sổ khác thì tên tab nháy cho tới khi bạn quay lại hoặc hết chờ
  function needYou(text, kind) {
    if (!ATT.badge) {
      ATT.badge = true;
      send({ type: 'vbdlis-badge', text: '!' });
    }
    if (S.opts.amBao === false) return;
    beep(kind);
    clearInterval(ATT.timer);
    if (ATT.title == null) ATT.title = document.title;
    let on = false;
    const t0 = Date.now();
    ATT.timer = setInterval(() => {
      if (!host.isConnected || Date.now() - t0 > 30 * 60 * 1000) return stopNeed();
      if (document.visibilityState === 'visible' && document.hasFocus()) return stopFlash(); // bạn đã quay lại → thôi nháy (dấu ! còn tới khi bạn bấm)
      on = !on;
      document.title = on ? `⏸ ${text}` : ATT.title;
    }, 1000);
  }

  // TB chưa tiếp nhận tiếp theo (sau con trỏ tiếp nhận, hết danh sách thì quay lại đầu)
  function nextTodo(noWrap, fromIdx) {
    const r0 = recvTB();
    const k0 = fromIdx != null && fromIdx >= 0 ? fromIdx : S.data.indexOf(r0);
    for (let j = 1; j <= S.data.length; j++) {
      if (noWrap && k0 + j >= S.data.length) break; // Tự động hết: không quay lại các TB phía trước
      const x = S.data[(k0 + j) % S.data.length];
      if (x && stageOf(x) === 'chua' && !(S.stage[String(x.tb)] || {}).tnClick && x !== r0 && !(AUTO() && S.autoHold.has(String(x.tb)))) return x;
    }
    return null;
  }

  function render() {
    const bd = $('.bd');
    const scroll = bd.scrollTop;
    const tb = curTB();
    renderTop();
    renderLd();
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
    // tab Trường: danh sách ô / nút cuộn riêng – tích xong vẫn ở chỗ cũ (cùng mẫu)
    const keep =
      S.tab === 'tr' && S.tplDraft
        ? ['#tplItemsBox', '#tplBtnsBox'].map((s) => {
            const e = $(s);
            return e && e.dataset.key === S.tplDraft.key ? e.scrollTop : 0;
          })
        : null;
    $('#content').innerHTML = tb || S.tab === 'tr' || (S.tab === 'bn' && isLd())
      ? TABS[S.tab](tb)
      : '<p class="muted">Chưa có dữ liệu. Bấm “Dữ liệu” để dán dữ liệu TB.</p>' + (S.tab === 'gt' ? scanCardHtml() : '');
    if (keep)
      ['#tplItemsBox', '#tplBtnsBox'].forEach((s, i) => {
        const e = $(s);
        if (e) e.scrollTop = keep[i];
      });
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
        mdsd: thuaMdsd(t),
        soThua: t.soThua,
        soTo: t.soTo,
        dienTich: a.v || '✗' + String(t.dienTich ?? ''), // sai dạng → bộ điền chắc chắn từ chối, báo ✗
        dienTichPL: pl.v || '✗' + String(t.dienTichPL ?? t.dienTich ?? ''),
        nguonGoc: thuaNguonGoc(t),
        thoiHan: thuaThoiHan(t),
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

  // MĐSD sẽ điền / đối chiếu: phường (đô thị) – đất ở là ODT: “ONT”, “ONT+CLN” (cả “ONT + CLN”, “CLN+ONT”, “ONT/CLN”…) → “ODT”
  // (bạn yêu cầu 23/11: “ont+cln, ont thì thành odt hết”)
  function thuaMdsd(t) {
    const m = String((t && t.mdsd) || '').trim();
    if (/^(ONT|ONT\s*[+,\/;&]\s*CLN|CLN\s*[+,\/;&]\s*ONT)$/i.test(m)) return 'ODT';
    return m;
  }
  // thửa đất ở (mục đích ODT – đất ở tại đô thị; ONT / ONT+CLN đã đổi thành ODT)
  function isDatO(t) {
    const m = thuaMdsd(t);
    return /^(ONT|ODT)\b/i.test(m) || /^dat o\b/.test(norm(m));
  }
  // nguồn gốc / thời hạn sẽ điền cho thửa. Đất ở mà dữ liệu để trống hoặc để mặc định của đất nông nghiệp
  // (“… không thu tiền …”, “50 năm”) → “Công nhận QSDĐ như giao đất có thu tiền sử dụng đất”, “Lâu dài”.
  // Dữ liệu ghi riêng giá trị khác (theo TBXN) thì giữ nguyên
  function thuaNguonGoc(t) {
    const v = String((t && t.nguonGoc) || '').trim();
    if (isDatO(t) && (!v || norm(v) === norm(DEFAULT_NGUON_GOC))) return DAT_O_NGUON_GOC;
    return v || DEFAULT_NGUON_GOC;
  }
  function thuaThoiHan(t) {
    const v = String((t && t.thoiHan) || '').trim();
    const k = (s) => norm(s).replace(/\s+/g, '');
    if (isDatO(t) && (!v || k(v) === k(DEFAULT_THOI_HAN))) return DAT_O_THOI_HAN;
    return v || DEFAULT_THOI_HAN;
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
  function pickFrame(resp, section, tplName) {
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
    if (w) return { err: `Đang mở ${w.wrongScope}, không phải ${TITLES[section] || (tplName ? 'cửa sổ của mẫu ' + qn(tplName) : 'cửa sổ cần điền')} – đóng cửa sổ đó rồi bấm lại.` };
    const o = all.find((f) => f.openerErr);
    if (o) return { err: o.openerErr };
    const extra = section === 'thua' ? ', cũng không thấy nút “Thêm thửa đất” trên trang' : '';
    return { err: `Không thấy ${TITLES[section] || (tplName ? 'cửa sổ / màn hình của mẫu ' + qn(tplName) : 'màn hình cần điền')} đang mở${extra}. Mở nó trên VBDLIS rồi bấm lại.` };
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
          const r0 = await send({ type: 'vbdlis-fill', ...tplMsg('donDK', dv) });
          const p0 = r0 && r0.ok ? pickFrame(r0, 'donDK') : { err: friendly((r0 && r0.error) || 'Không chạy được') };
          const res0 = p0.f ? p0.f.results : [{ name: 'Nhập đơn đăng ký', ok: false, msg: p0.err }];
          preBad = res0.some((x) => !x.ok);
          preHtml = `<div class="sum">Cửa sổ “Nhập đơn đăng ký”</div>${res0.map(lineOf).join('')}${p0.f ? tplNoteHtml(p0.f) : ''}`;
          if (res0.some((x) => x.changed)) await sleep(800); // trang tự điền Mã đơn… sau khi tích Đăng ký lần đầu
        }
      }
      const resp = await send({ type: 'vbdlis-fill', ...tplMsg(section, buildValues(section, tb, i)) });
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
          `<div class="sum">${ok}/${f.results.length} ô đã điền – ${esc(f.scopeName)}${f.opened ? ` <span class="muted">(đã tự bấm “${esc(f.opened)}”)</span>` : ''}</div>${lines}${tplNoteHtml(f)}<div class="hint">Kiểm tra lại trên VBDLIS rồi tự bấm “Lưu”. Ô báo ✗ thì dùng nút ⧉ để sao chép và dán tay.</div>`
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
      // khung nhận ra màn hình và tìm thấy nhiều thứ nhất
      const okCount = (f) => f.items.filter((x) => x.ok).length;
      const p = frames.filter((f) => f.known).sort((a, b) => okCount(b) - okCount(a) || b.items.length - a.items.length)[0] || null;
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
  // tốc độ tự động (tab Biên nhận → Tự động hết): nhân thời gian chờ giữa các bước; thời hạn chờ trang chỉ dài ra, không ngắn đi
  const SPEEDS = { nhanh: 0.6, vua: 1, cham: 1.8, ratcham: 3 };
  const speedK = () => SPEEDS[S.opts.tocDo] || 1;
  const slowK = () => Math.max(1, speedK());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speedK()));
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

  // ---------- “🤖 Tự động hết” (bạn bật, 22/11) ----------
  // Bật: tiện ích tự chạy khi mở màn hình Tiếp nhận (trống) / Nhập đơn đăng ký / Quy trình xử lý, và TỰ BẤM Lưu thửa, Lưu chủ,
  // Đồng ý các hộp hỏi đã biết, Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, tác vụ 2–3. Ô lệch / hộp hỏi lạ / lỗi → dừng, kêu ting chờ bạn.
  // Kết ISO: chuỗi tự động chỉ làm khi bạn bật “Tự Kết ISO” (S.opts.tuISO, mặc định tắt – bạn yêu cầu 23/11).
  // chỉ ở ĐÚNG tab bạn bật (tbAutoTab) – tab VBDLIS khác coi như tắt (không tự chạy, không tự bấm).
  // S.tabId: undefined = đang hỏi tiện ích (chưa tự chạy), null = không biết tab (trang thử nghiệm) → coi là đúng tab
  const AUTO = () => S.opts.tuDong === true && S.tabId !== undefined && (S.tabId === null || String(S.autoTab) === String(S.tabId));
  // 🤖 bật thì coi như bật cả 3 ô “Nhập chủ / Lưu kho hồ sơ quét / Quy trình xử lý tự động” (không sửa lựa chọn của bạn – tắt 🤖 là về như cũ)
  const optOn = (k) => AUTO() || S.opts[k] !== false;
  // bạn bật “Tự Kết ISO” (23/11) và 🤖 đang bật ở tab này → 🤖 tự Kết ISO khi Quy trình chỉ còn thiếu Kết ISO
  const isoAuto = () => AUTO() && S.opts.tuISO === true;
  // vừa chuyển lãnh đạo (15 phút) – không tính mốc suy ra từ Quy trình 5 tác vụ (hồ sơ lãnh đạo đã trả về)
  const ldRecent = (s) => !!(s && s.ld && s.ldBy !== 'kq' && Date.now() - s.ld < 15 * 60 * 1000);
  // hồ sơ đang ở chặng cuối: lãnh đạo đã trả về / đã sang bước Trả kết quả / đang Trả hồ sơ – chưa trả hồ sơ
  const traPhase = (s) => !!s && !s.tra && !!(s.kq || s.trk || (s.fwd && /^(trk|tra)$/.test(s.fwd.k)));
  // trang báo hồ sơ không còn ở chỗ bạn (đã chuyển đi) / hồ sơ đã trả kết quả – chữ đã bỏ dấu
  const LD_MOVED = /khong (co quyen|phai (nguoi|can bo)|con quyen|con thuoc|thuoc)|nguoi khac|da (duoc )?chuyen|da duoc xu ly/;
  const TRA_DONE = /da (duoc )?tra (ho so|ket qua)/;
  // trang báo thửa đất ĐÃ TỒN TẠI (cửa sổ thửa – bạn yêu cầu 23/11: trả lời hộp, đóng cửa sổ thửa, bỏ qua thửa đó không nhập lại)
  const THUA_EXISTS = /da ton tai|da co trong (he thong|co so du lieu|csdl)/;
  // hộp được bấm “Đồng ý” (bạn dặn 23/11, ảnh trang thật: “chỗ đất là đồng ý chứ không phải là bỏ qua”): chữ của hộp có “thửa” (chữ các phần
  // của hộp kiểu jconfirm dính liền nhau – “thong baothua dat…” – nên không đòi dấu cách trước “thửa”; “thuận” không khớp) và
  // “đã tồn tại”, không phải hộp giấy tờ tùy thân – còn phải là hộp chỉ báo một nút, không hỏi (xem thuaTonTai)
  const THUA_DONG_Y = '^(?!.*giay to tuy than)(?=.*thua( |$))(?=.*(da ton tai|da co trong (he thong|co so du lieu|csdl)))';
  // ---- tạm giữ TB (S.autoHold: TB → { kind, at, k, btn }) – bộ theo dõi không tự chạy TB đó (ở mọi màn hình) cho tới khi bạn
  // bấm ▶ / bật lại 🤖 / bấm nút của TB đó trong bảng điền:
  //   'err' lần chạy dừng vì lỗi / hỏi bạn (giữ cả khi trang tải lại – cùng tab)
  //   'tt'  Chạy thử / cửa sổ mở sẵn: chờ bạn tự bấm Thực thi / Thực hiện – bạn bấm (hoặc trang báo thành công) là tự thả, làm tiếp
  //   'don' dừng trước Lưu thông tin đăng ký – trang báo lưu đơn là tự thả
  const HOLD_KEY = 'vbdlis-dien-nhanh-hold';
  // chống lặp mẫu tab Trường qua tải lại trang (cùng tab): giờ mẫu tự chạy gần nhất + giờ bạn thao tác trên trang gần nhất
  const TPLLAST_KEY = 'vbdlis-dien-nhanh-tpllast';
  function saveTplLast() {
    try {
      const now = Date.now();
      const last = {};
      for (const [k, v] of Object.entries(S.tplLast || {})) if (v && now - (v.at || 0) < 60000) last[k] = v;
      sessionStorage.setItem(TPLLAST_KEY, JSON.stringify({ last, user: Math.max(USER.at || 0, S.userAtSaved || 0) }));
    } catch (e) {}
  }
  function saveHold() {
    try {
      const keep = [...S.autoHold.entries()];
      if (keep.length) sessionStorage.setItem(HOLD_KEY, JSON.stringify(keep));
      else sessionStorage.removeItem(HOLD_KEY);
    } catch (e) {}
  }
  function setHold(id, h) {
    S.autoHold.set(String(id), { at: Date.now(), ...h });
    saveHold();
    try {
      renderTop();
    } catch (e) {}
  }
  function dropHold(id) {
    if (id == null) S.autoHold.clear();
    else S.autoHold.delete(String(id));
    saveHold();
    try {
      renderTop();
    } catch (e) {}
  }
  // TB của chữ ký màn hình (bộ theo dõi): 'tn:1850', 'don:1850:…', 'qt:cv:1850:…', 'kq:1850:…', 'hs:1850:…', 'dsl:1850'…
  const sigTb = (sig) => {
    const m = /^(?:tn|don|kq|tra|ldx|next|hs|dsl|cho|resume|qt:(?:tn|cv)):(\d+)/.exec(sig || '');
    return m ? m[1] : '';
  };
  // ---------- 🤖 chạy liên tục (bạn yêu cầu 24/11: “tự động liên tục không được dừng; popup lỗi chưa dạy thì mới dừng; lỗi đã dạy thì làm đúng
  // quy trình”) – vai trò Chuyên viên, lần chạy do 🤖 tự bắt đầu: vướng ở MỘT TB → ⏸ tạm hoãn TB đó (lý do chung), đóng cửa sổ của TB đó, làm TB khác
  // lỗi CHUNG (mọi TB đều vướng) → vẫn dừng: chưa có dữ liệu, sai / chưa đặt tài khoản, trang không trả lời lệnh, tiện ích vừa tải lại,
  // không thấy ô tìm của danh sách, không cài được phần đưa file vào trang, bấm chuyển trang mà trang không chuyển
  const NS_GLOBAL = /chua co du lieu tb|tai khoan dang dang nhap|chua dat tai khoan|chua co tai khoan|khong chay duoc lenh|tien ich vua duoc tai lai|mat ket noi|khong thay o tim|khong cai duoc|ma trang khong chuyen/;
  // dừng vì BẠN (bấm ■ Dừng / tắt 🤖, vừa bấm – gõ trên trang, bạn chọn người khác ở cửa sổ chọn người, Chạy thử…) → không tạm hoãn TB
  const NS_USER = /^da dung theo yeu cau|ban vua bam|ban dang (thao tac|bam|go|tat|chon)|ban da chon|chay thu|trong cua so dang chon/;
  // lỗi chung không tự hết (tài khoản đăng nhập, chưa có dữ liệu / tài khoản trong cài đặt, tiện ích vừa tải lại) → 🤖 không tự chạy lại TB đó
  const NS_HARD = /chua co du lieu tb|tai khoan dang dang nhap|chua dat tai khoan|chua co tai khoan|khong chay duoc lenh|tien ich vua duoc tai lai/;
  // dừng do BẠN chủ ý (■ Dừng, Chạy thử, tắt 🤖, bạn chọn người khác ở cửa sổ chọn người) → 🤖 không tự chạy lại TB đó
  const NS_STOP = /^da dung theo yeu cau|chay thu|trong cua so dang chon|ban da chon|ban dang (tat|chon)/;
  // chữ hộp (bạn dạy) hiện sau Thực hiện Trả hồ sơ cho biết CHƯA xong
  const TAUGHT_BAD = /loi|that bai|khong thanh cong|chua thanh cong|khong the|khong duoc|chua duoc|vui long|de nghi|kiem tra lai|khong hop le|chua ky so/;
  const NS_MAX = 5; // 5 TB liên tiếp bị tạm hoãn vì vướng (không TB nào làm được bước nào ở giữa) → có thể trang đổi / mạng lỗi: tắt 🤖, kêu
  // lý do tạm hoãn CHUNG: tên bước đang làm (không chép chữ lỗi / tên người – lý do được lưu cả trong file sao lưu)
  const nsReason = (c) => {
    let t = String((c && c.l && c.l.text) || '').replace(/\s+/g, ' ').trim();
    // chỉ tên bước: bỏ phần sau “ – ” (tên tài khoản nhận…), tên file quét, tên chủ, dãy số dài
    t = t.split(' – ')[0].replace(/^Tải lên .+$/, 'Tải lên file quét').replace(/^(Chủ \d+):.*$/, '$1').replace(/\d{9,}/g, '…');
    if (t.length > 80) t = t.slice(0, 80) + '…';
    return `🤖 vướng ở bước “${t || 'tự động'}” – xem dòng báo của lần chạy; sửa xong bỏ tạm hoãn để 🤖 làm lại`;
  };
  // hộp báo LỖI bạn đã dạy (tab Trường) vừa được bấm theo mẫu → bước đang làm chưa xong (không coi là đã qua): báo lỗi để TB này tạm hoãn
  const taughtErr = (hit) => new Error(`trang báo lỗi “${String(hit.title || '').slice(0, 60)}” – tiện ích đã bấm “${hit.btn}” theo hộp bạn dạy; bước này chưa xong`);
  // dấu tạm giữ đã được thả chưa (bạn đã tự làm bước tiện ích chờ)
  function holdFree(id, h) {
    if (h.kind === 'tt') {
      // chỉ khi BẠN bấm đúng nút của bước đó (Thực thi ở đúng bước / Thực hiện, Đồng ý của Trả hồ sơ) CHO ĐÚNG hồ sơ của TB này
      // (số biên nhận của hồ sơ lúc bạn bấm → đúng TB này); câu báo thành công chỉ tính khi đến SAU cú bấm đó
      // (không lấy câu báo của hồ sơ khác bạn vừa tự làm)
      const okRe = h.k === 'tra' ? /tra ho so/ : h.k === 'iso' ? /ket iso/ : /chuyen tiep|chuyen ho so|thuc thi/;
      const ul = USER.btnSo ? tbOfSo(USER.btnSo).list : [];
      const mine = USER.btnAt > h.at && ul.length === 1 && String(ul[0].tb) === String(id);
      const me = mine && (h.k === 'tra' || h.k === 'iso' ? /^(thuc hien|dong y)$/.test(USER.btn) : USER.btn === 'thuc thi' && (!h.st || USER.btnStep === h.st));
      if (!me) return false;
      const ok = toastsSince(USER.btnAt - 500).some((t) => toastOk(t) && okRe.test(t.text || ''));
      // bạn tự bấm: có câu báo thành công → ghi xong bước đó; chưa có → ghi “đang chuyển” (bước sau kiểm lại, không bấm lại). Kết ISO: chỉ thả dấu
      if (h.k && h.k !== 'iso') {
        const f0 = (S.stage[String(id)] || {}).fwd;
        if (ok) markStage(id, h.k, 'auto');
        // dấu do bộ theo dõi cú bấm của bạn ghi (user) → để bộ theo dõi đó kết luận (Hủy / lỗi / xong), không ghi đè
        else if (!(f0 && f0.k === h.k && f0.user))
          setMark(id, 'fwd', { k: h.k, at: USER.btnAt || Date.now(), ...(toastsSince(USER.btnAt - 500).some(toastBad) ? { bad: 'err' } : {}) });
      }
      return true;
    }
    if (h.kind === 'don') return (S.lastMsg.don || 0) > h.at || (S.lastMsg.lt || 0) > h.at;
    return false;
  }
  // hộp CẢNH BÁO “HỒ SƠ CHƯA ĐÁP ỨNG LIÊN KẾT 3 KHỐI LIÊN KẾT KHÔNG GIAN – Thửa đất … không tồn tại dữ liệu không gian. Bạn có thật sự muốn
  // tiếp tục thực hiện kết ISO hay không?” (ĐỒNG Ý / KHÔNG) – bạn yêu cầu 24/11 (ảnh trang thật ở Kết ISO): “đồng ý và làm các bước bình thường”
  const LK3_DIALOGS = [{ re: 'lien ket 3 khoi.*tiep tuc', btn: ['Đồng ý', 'Có', 'OK'] }];
  // hộp hỏi của trang tiện ích được tự trả lời khi bật Tự động hết (chữ đã bỏ dấu)
  const AUTO_DIALOGS = [
    { re: 'cap nhat (lai )?dia chi tai san', btn: 'Đồng ý' },
    { re: 'giay to tuy than da ton tai', btn: 'Đồng ý' },
    ...LK3_DIALOGS,
  ];
  const DON_WIN_SRC = '^nhap don dang ky\\b';
  // hộp xác nhận ngay sau khi tiện ích bấm “Lưu hồ sơ” (VBDLIS thật, ảnh 22/11):
  // “XÁC NHẬN THÊM MỚI HỒ SƠ – Bạn có thật sự muốn thêm mới hồ sơ hay không?  ĐỒNG Ý / KHÔNG” → Đồng ý
  const LHS_DIALOGS = [...AUTO_DIALOGS, { re: '(xac nhan them moi ho so|that su muon them moi ho so)', btn: ['Đồng ý'] }];
  // hộp báo sau Lưu hồ sơ: số biên nhận đã được dùng cho hồ sơ khác (trang thật 23/11 – hồ sơ của số này đã có trên VBDLIS)
  const SBN_USED = /da (duoc )?su dung cho ho so khac/;
  // hộp hỏi ngay sau khi tiện ích bấm “Thực hiện” ở cửa sổ “Trả hồ sơ” → Đồng ý (bạn yêu cầu “bấm thực hiện rồi đồng ý”);
  // hộp báo lỗi (vui lòng…, không thể…, thất bại…) thì không
  // chỉ hộp HỎI xác nhận việc trả hồ sơ (vd. “Bạn có chắc chắn muốn trả hồ sơ này?”), chỉ 1 lần; hộp báo lỗi / hộp khác → dừng chờ bạn
  // (chữ của hộp gồm cả chữ trên nút, vd. “Đồng ý Hủy” – không loại chữ “hủy”)
  const TRA_DIALOGS = [
    {
      re: '^(?!.*(vui long|khong the|khong duoc|that bai|khong thanh cong|(co|bi|gap|xay ra) loi|chua nhap|chua chon|bat buoc|khong co quyen|xoa)).*(xac nhan|ban co|co chac|chac chan|that su|co muon).*(tra ho so|tra ket qua|thuc hien)',
      btn: ['Đồng ý', 'Có', 'OK', 'Xác nhận'],
    },
  ];
  // hộp báo trả hồ sơ thành công (nếu trang báo bằng hộp thay vì thông báo nổi) → Đóng
  const TRA_DONE_DIALOGS = [
    { re: '^(?!.*(vui long|khong the|khong duoc|that bai|khong thanh cong|(co|bi|gap|xay ra) loi)).*(thanh cong|da (duoc )?tra (ho so|ket qua))', btn: ['Đóng', 'OK', 'Đồng ý'] },
  ];
  const TRA_DONE_RE = new RegExp(TRA_DONE_DIALOGS[0].re);
  const TRA_Q_RE = new RegExp(TRA_DIALOGS[0].re); // hộp HỎI xác nhận trả hồ sơ (“Bạn có thật sự muốn trả hồ sơ…?”)
  const FWD_Q_RE = /(xac nhan|ban co|co chac|chac chan|that su|co muon).*(chuyen|thuc thi)/; // hộp hỏi xác nhận chuyển tiếp
  // hộp hỏi ngay sau khi tiện ích bấm “Thực hiện” ở cửa sổ “Kết ISO” (bạn bật “Tự Kết ISO”) → Đồng ý, chỉ 1 lần;
  // hộp báo lỗi / hộp khác → dừng chờ bạn
  const ISO_DIALOGS = [
    {
      re: '^(?!.*(vui long|khong the|khong duoc|that bai|khong thanh cong|(co|bi|gap|xay ra) loi|chua nhap|chua chon|bat buoc|khong co quyen|xoa)).*(xac nhan|ban co|co chac|chac chan|that su|co muon).*(ket iso|thuc hien)',
      btn: ['Đồng ý', 'Có', 'OK', 'Xác nhận'],
    },
  ];
  // hộp báo Kết ISO thành công (nếu trang báo bằng hộp) → Đóng
  const ISO_DONE_DIALOGS = [
    { re: '^(?!.*(vui long|khong the|khong duoc|that bai|khong thanh cong|(co|bi|gap|xay ra) loi)).*(thanh cong|da ket iso)', btn: ['Đóng', 'OK', 'Đồng ý'] },
  ];
  // hộp xác nhận khi tích “Đã xử lý” / Chuyển tiếp / Thực thi (bước chuyển tiếp bạn cho phép): chỉ hộp HỎI xác nhận việc đó
  const FWD_DIALOGS = [
    ...AUTO_DIALOGS,
    { re: '(ban co chac|co chac chan|xac nhan|co muon).*(chuyen tiep|thuc thi|da xu ly|xu ly xong|hoan thanh|chuyen ho so)', btn: ['Đồng ý', 'Có', 'OK', 'Xác nhận'] },
  ];
  // chuỗi tự điền (▶ / 🤖) phần kind → mọi mẫu tab Trường của phần đó (bộ điền chọn mẫu của đúng cửa sổ mở ra – mỗi cửa sổ một mẫu).
  // Màn hình Tiếp nhận: các bước Phường/Xã, Quy trình, Số biên nhận, Người nộp điền theo recepPlan (đã tính mẫu) – không qua đây
  function tplMsg(kind, values) {
    const ts = Object.values(S.tpl || {}).filter((t) => t && t.items && kind && (t.base || '') === kind);
    if (!ts.length) return { section: kind, values };
    return tplMsgOf(ts, kind, values).msg;
  }

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
  // VBDLIS thật (ảnh 22/11) có khi ghi tên nhóm ngay trước mục trên cùng một dòng:
  //   “Cá nhân -1795335545562_:Bà: Đỗ Thị Mai - Năm sinh:1975 - …”, “Thửa đất lịch sử -1795335551979_ 52 (255) - Diện tích: …”
  // → bỏ phần tên nhóm + mã ở đầu trước khi đọc
  const CHU_GROUP = /^[^\p{L}]*(?:cá nhân|hộ gia đình|vợ chồng|tổ chức|cộng đồng(?: dân cư)?|nhóm người|người sử dụng)[^:\n]*?-\s*\d+\s*_?\s*:\s*/iu;
  const THUA_GROUP = /^[^\p{L}\d]*(?:thửa đất|tài sản|nhà|căn hộ|công trình)(?:\s+lịch sử)?\s*-\s*\d+\s*_?\s*:?\s*/iu;
  function parseDon(f) {
    const chu = [];
    for (const n of (f && f.chu) || []) {
      const t = String(n.text || '')
        .normalize('NFC')
        .replace(CHU_GROUP, '');
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
      const t = String(n.text || '')
        .normalize('NFC')
        .replace(THUA_GROUP, '') // “Thửa đất lịch sử -1795…_ 52 (255) - …” → “52 (255) - …”
        .replace(/^[^\p{L}\d]+/u, ''); // bỏ dấu / ký tự lạ ở đầu
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
      const pgt = node.gender === 'unset' ? '(chưa chọn – trang ghi “Ông/Bà”)' : node.gender ? `${node.gender} (${node.gender === 'Nam' ? 'Ông' : 'Bà'})` : '';
      if (!gt) add(item, 'Giới tính', pgt, '(dữ liệu thiếu – chọn tay)', 'gap');
      else if (node.gender === 'unset') add(item, 'Giới tính', pgt, gt, 'bad');
      else add(item, 'Giới tính', pgt, gt, !node.gender ? 'na' : node.gender === gt ? 'ok' : 'bad');
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
      const want = thuaMdsd(t).toUpperCase(); // ONT / ONT+CLN → ODT (như lúc điền)
      const wants = want.split(/[\s+,;/]+/).filter(Boolean); // “ONT+CLN” → cả 2 mã phải có
      if (!want) add(item, 'Mục đích', codes.join(', '), '(dữ liệu thiếu – chọn tay)', 'gap');
      else add(item, 'Mục đích', codes.join(', '), want, !codes.length ? 'na' : wants.every((w) => have.includes(w)) ? 'ok' : 'bad');
      // thời hạn: chỉ so khi trang ghi kiểu “50 năm” / “Lâu dài” (cách ghi khác thì không đoán)
      const th = thuaThoiHan(t);
      // nhiều mục đích mà mỗi mục một thời hạn → không so (dữ liệu chỉ có một thời hạn cho cả thửa)
      const terms = [...new Set(node.purposes.map((x) => x.thoiHan).filter(Boolean).map((x) => norm(x).replace(/\s+/g, '')))];
      const pth = terms.length === 1 ? (node.purposes.find((x) => x.thoiHan) || {}).thoiHan || '' : terms.length > 1 ? '(nhiều thời hạn)' : '';
      const comparable = terms.length === 1 && /^(\d+\s*năm|lâu dài)$/i.test(pth.trim()) && /^(\d+\s*năm|lâu dài)$/i.test(th.trim());
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
    const msg = { type: 'vbdlis-act', action, ...extra };
    // 🤖 bật: hộp hỏi bạn đã dạy (lấy hộp ở tab Trường, tích nút trả lời) được tự trả lời ở các chỗ tiện ích chờ / trả lời hộp hỏi.
    // Chỗ chỉ XEM hộp để biết trang báo gì (sau Xử lý hồ sơ, hộp thành công của Trả hồ sơ / Kết ISO…) gửi learned: [] → không bấm hộp đã dạy
    if (action === 'answerDialog' && AUTO() && !msg.learned) msg.learned = learnedDialogs();
    const r = await send(msg);
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
  async function fillSec(section, values, plain) {
    // cửa sổ “Nhập đơn đăng ký” có mẫu trường (tab Trường) → điền theo mẫu; plain: các bước màn hình Tiếp nhận (đã tính mẫu ở recepPlan)
    const r = await send({ type: 'vbdlis-fill', ...(plain ? { section, values } : tplMsg(section, values)) });
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

  // dữ liệu chủ còn thiếu (bạn điền tay; khi thiếu thì không đặt sẵn con trỏ ở nút Lưu)
  function chuGaps(p) {
    const g = [];
    if (!digitsOf(p.soGiayTo)) g.push('số giấy tờ');
    if (!String(p.gioiTinh || '').trim()) g.push('giới tính');
    if (!String(p.namSinh || '').trim() && !/(\d{4})$/.test(String(p.ngaySinh || ''))) g.push('năm sinh');
    if (!String(p.diaChi || '').trim()) g.push('địa chỉ');
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

  // fromAuto: chữ ký màn hình khi bộ theo dõi Tự động hết tự chạy (chạy dừng giữa chừng → không tự chạy lại màn hình đó)
  async function runAll(fromAuto) {
    // 🤖, và ▶ khi TB ở trên là TB 🤖 dời tới: TB theo con trỏ tiếp nhận (như trước 25/11 – TB cụ thể đọc từ màn hình / chữ ký); bạn đã chọn TB:
    // TB đó (cũng là con trỏ)
    let tb = fromAuto || S.curBy === 'auto' ? recvTB() : curTB();
    const tplSig = !!fromAuto && /^p?tpl:/.test(fromAuto); // 🤖 chạy mẫu tab Trường (cửa sổ / màn hình / hộp hỏi): không cần TB
    if (S.running || S.busy || (!tb && !S.scanQ.length && !tplSig && !isLd())) return;
    S.running = true;
    S.stopReq = false;
    S.viewWant = null; // lần chạy mới: lần “chạy theo” đang hoãn (lần trước) không còn đúng
    if (!fromAuto) S.cvLeave = null; // bạn bấm ▶ → 🤖 không tự đóng cửa sổ / rời trang vì lần tạm hoãn trước
    // 🤖 chạy mẫu tab Trường (hộp hỏi / cửa sổ có mẫu) lúc chuỗi đang dừng chờ bạn: GIỮ dấu chờ tự ghi nhận (S.armed), dòng báo, dấu “!”,
    // và lời dừng + nút hỏi của lần chạy trước (nhật ký mẫu hiện bên dưới)
    const keepPrev = tplSig && /data-act=|data-ldredo=/.test($('#result').innerHTML) ? $('#result').innerHTML + '<hr>' : '';
    if (!tplSig) {
      S.armed = null; // lần chạy trước bỏ dở → không còn chờ tự ghi nhận cho TB đó
      stopNeed();
      setEvt('');
    }
    updateRunBtn();
    const log = [];
    let title = tb ? `Chạy cả TB ${tb.tb} – ${(tb.nguoiNop && tb.nguoiNop.hoTen) || ''}` : 'Lưu kho hồ sơ quét';
    let tail = '';
    let tailOk = '';
    let tailNeed = ''; // câu nháy tên tab khi xong (mặc định: tới lượt bạn bấm Lưu; '-' = không báo)
    let sheet = ''; // phiếu đối chiếu số liệu (bước Nhập đơn đăng ký)
    let actHtml = ''; // nút xác nhận khi tiện ích dừng để hỏi bạn
    let failMsg = '';
    let dlgAtFail = false; // lúc lỗi có hộp hỏi / báo THẬT đang mở (không tính cửa sổ Lưu kho / Hồ sơ quét) – dấu “đã dừng” loại hộp
    let noFail = false; // lỗi không phải của màn hình này (hộp hỏi / bạn vừa thao tác – vai trò Lãnh đạo): không chặn chữ ký màn hình
    let noRetry = false; // lỗi chờ BẠN quyết (đã bấm nút quyết định, hộp hỏi sau cú bấm…): 🤖 không tự chạy lại TB đó
    const recvAtStart = S.recv; // con trỏ tiếp nhận lúc bắt đầu chạy
    let stage3 = false; // lần chạy làm hồ sơ cũ (chặng cuối / tìm ở danh sách / cửa sổ bạn mở) → KHÔNG đổi con trỏ tiếp nhận (TB ở trên vẫn chạy theo)
    // 🤖 làm tiếp TB đã mở từ Danh sách hồ sơ thụ lý (không phải con trỏ tiếp nhận), vd. sau khi trang tải lại → không đổi con trỏ
    if (fromAuto && chainTbId() && sigTb(fromAuto) === chainTbId() && chainTbId() !== String(S.recv)) stage3 = true;
    // 🤖 tự làm tiếp (resume:<TB>): làm đúng TB của hồ sơ đang mở (đọc số biên nhận lúc quyết định) – không đổi TB đang chọn
    if (fromAuto && fromAuto.startsWith('resume:')) {
      const rx = S.data.find((y) => String(y.tb) === sigTb(fromAuto));
      if (rx) {
        tb = rx;
        stage3 = true;
        viewTb(rx); // TB ở trên chạy theo
      }
    }
    let tbKnown = false; // đã biết chắc lần chạy này làm TB nào (dừng thì chỉ tạm giữ TB đó)
    // 🤖 tự làm tiếp: hồ sơ đang mở đọc được số biên nhận đúng TB này (lúc quyết định) – vướng thì ⏸ + làm TB khác ngay (không kêu, không thử lại mù)
    if (fromAuto && fromAuto.startsWith('resume:') && tb && sigTb(fromAuto) === String(tb.tb)) tbKnown = true;
    const prog0 = S.progN || 0; // số bước đã ghi lúc bắt đầu – lần chạy 🤖 ghi thêm được bước mà TB không bị tạm hoãn → bộ ngắt 5 TB đếm lại
    const show = () =>
      setResult(
        keepPrev +
          `<div class="sum">${esc(title)}</div>` +
          log.map((l) => `<div class="ln ${l.cls}">${l.icon} ${l.html}</div>`).join('') +
          (actHtml ? `<div class="row" style="margin-top:4px;flex-wrap:wrap">${actHtml}</div>` : '') +
          sheet +
          tail
      );
    const step = (text) => {
      const l = { icon: '⏳', cls: 'muted', html: esc(text), text: String(text || '') };
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
    // “Tự động hết”: hộp hỏi đã biết (Cập nhật địa chỉ tài sản, Giấy tờ tùy thân đã tồn tại) → tiện ích bấm “Đồng ý”.
    // Trả về 'answered' | 'unknown' (hộp lạ – để bạn trả lời) | null (không có hộp / đang tắt Tự động hết)
    const autoDlg = async () => {
      if (!AUTO()) return null;
      const rs = await act('answerDialog', { rules: AUTO_DIALOGS });
      const hit = rs.find((x) => x.ok);
      if (hit) {
        log.push({ icon: '•', cls: 'muted', html: esc(`Trang hỏi “${hit.title}” – tiện ích bấm “${hit.btn}” (${hit.learned ? 'theo hộp bạn đã dạy ở tab Trường' : 'Tự động hết'})`) });
        show();
        await sleep(900);
        if (hit.learned && hit.err) throw taughtErr(hit); // hộp LỖI đã dạy: bấm theo mẫu, bước này chưa xong (24/11)
        return 'answered';
      }
      return rs.some((x) => x.open) ? 'unknown' : null;
    };
    // trang hỏi thêm (vd. “Cập nhật địa chỉ tài sản: Đồng ý / Không”) → chờ BẠN trả lời (Tự động hết: hộp đã biết thì tiện ích bấm)
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
        if (AUTO() && (await autoDlg()) === 'answered') continue;
        if (!shown) {
          c.wait(`trang đang hỏi “${d.titles[0]}” – bạn tự trả lời (thường là bấm “Đồng ý”), tiện ích chờ rồi làm tiếp`);
          needYou('Trang đang hỏi – bạn trả lời');
          shown = true;
        }
        if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ trả lời hộp hỏi của trang quá 20 phút – đã dừng');
        await sleep(800);
      }
    };
    let qt = (tb && tb.quyTrinh) || DEFAULT_QUY_TRINH;
    let thua = (tb && tb.thua) || [];
    const allMode = S.opts.thuaTN === 'tatca';
    let cur = null;
    let donCertain = false; // bước đơn: hồ sơ đang mở CHẮC CHẮN của TB này (Mã đơn khớp hẳn / cây khớp riêng TB này / bạn xác nhận)
    // 🤖 vẫn lưu đơn khi chưa chắc hồ sơ (bạn yêu cầu 24/11: “lưu hết cho tôi không cần phải dừng lại”) – ghi dòng ⚠ để bạn biết, mỗi loại 1 lần mỗi lần chạy:
    // 'muc' lúc tự Lưu cửa sổ chủ / thửa đầu tiên; 'don' ngay trước khi bấm Lưu thông tin đăng ký (sau mọi kiểm tra khác)
    const unsureNote = (kind) => {
      if (donCertain || log.some((l) => l.unsure === kind)) return;
      log.push({
        icon: '⚠',
        cls: 'warn',
        html: esc(
          kind === 'don'
            ? `Chưa chắc chắn hồ sơ đang mở là của TB ${tb.tb} – 🤖 vẫn bấm Lưu thông tin đăng ký, Hoàn tất (bạn yêu cầu 24/11: lưu hết, không dừng)`
            : `Chưa chắc chắn hồ sơ đang mở là của TB ${tb.tb} (lý do ở dòng “Nhận hồ sơ đang mở”) – 🤖 không dừng vì lý do này, vẫn tự Lưu chủ / thửa (bạn yêu cầu 24/11)`
        ),
        unsure: kind,
      });
      show();
    };
    // TB mà đơn vừa được nhập theo khi CHƯA chắc hồ sơ (🤖) – chuyển tiếp sau đó trong cùng lần chạy phải là hồ sơ của đúng TB này (soát 1.21.7)
    let donGuess = null;
    // đổi sang TB khớp hồ sơ đang mở (chỉ trước khi ghi gì lên trang)
    const setTb = (x) => {
      tb = x;
      qt = tb.quyTrinh || DEFAULT_QUY_TRINH;
      thua = tb.thua || [];
      // hồ sơ cũ (chặng 3, tìm ở danh sách…): không đổi con trỏ tiếp nhận – trang tải lại giữa chừng thì vẫn đúng TB tiếp nhận;
      // (25/11) TB ở trên vẫn chạy theo TB đang làm
      if (!stage3) {
        setPtr(tb.tb);
        saveUi();
        render();
      } else viewTb(tb);
      title = `Chạy cả TB ${tb.tb} – ${(tb.nguoiNop && tb.nguoiNop.hoTen) || ''}`;
      show();
    };

    // ---------- Hồ sơ đang mở là của TB nào (cửa sổ “Nhập đơn đăng ký”) ----------
    // Đơn đã có sẵn chủ + thửa mang từ bước tiếp nhận → so với dữ liệu: đúng TB đang chọn thì làm tiếp;
    // khớp rõ TB khác thì tự chọn TB đó; không khớp / khớp nhiều TB thì DỪNG (không điền nhầm hồ sơ)
    // known: lần chạy đã biết chắc hồ sơ là TB này TRƯỚC khi mở đơn (Số biên nhận của hồ sơ ở Quy trình khớp đúng 1 TB – chuỗi “Nhập đăng ký”):
    // đơn không đọc được Mã đơn / cây trống / khớp nhiều TB như nhau (không có gì trái ngược) → coi là chắc chắn (trước đây: “chưa chắc”, không tự Lưu)
    const identifyDon = async (known) => {
      cur = step('Nhận hồ sơ đang mở');
      donCertain = false;
      // đọc đơn: ô Mã đơn (trang điền sẵn số biên nhận) + cây Chủ sử dụng / Thửa đất (cây có thể đang tải → chờ tối đa ~5 giây)
      let f = null;
      let page = { chu: [], thua: [] };
      for (let k = 0; k < (known ? 30 : 10); k++) {
        stopIf();
        f = (await act('donRead')).find((x) => x.ok) || null;
        page = f ? parseDon(f) : { chu: [], thua: [] };
        if (f && !f.loading && (page.thua.length || (khPairs(f.maDon) || []).length)) break;
        if (k >= 9 && !(f && f.loading)) break; // (known) chỉ chờ thêm khi cây còn đang tải
        await sleep(500);
      }
      const confirmBtn = actBtn('confirmDon', tb.tb, `Đúng là hồ sơ của TB ${tb.tb} – làm tiếp`);
      // chắc chắn đúng hồ sơ → được tự Lưu chủ, ghi “đã tiếp nhận”
      const sure = () => {
        donCertain = true;
        if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'don');
      };
      const switchTo = (x, why) => {
        const from = tb.tb;
        setTb(x);
        cur.ok(`${why} là của TB ${tb.tb}, không phải TB ${from} – đã tự chọn TB ${tb.tb}`);
      };
      // bạn đã bấm “Đúng là hồ sơ của TB … – làm tiếp”
      if (consume('confirmDon', tb.tb)) {
        cur.ok(`bạn xác nhận đây là hồ sơ TB ${tb.tb}`);
        return sure();
      }
      // 🤖 bật: chưa chắc vẫn tự Lưu (bạn yêu cầu 24/11 – lưu hết, không dừng); 🤖 tắt: không tự Lưu chủ, bạn nhấn Enter
      const NOAUTO = AUTO() ? ' – chưa chắc chắn, 🤖 vẫn tự Lưu (bạn yêu cầu 24/11)' : ' – chưa chắc chắn nên tiện ích KHÔNG tự Lưu chủ (bạn xem rồi nhấn Enter)';
      // 1) Mã đơn = số biên nhận của hồ sơ → TB có đúng bộ tờ.thửa đó (đơn mới mở thường chưa có chủ / thửa trên cây)
      const maDon = (f && f.maDon) || '';
      const maPairs = uniq(khPairs(maDon) || []);
      if (maPairs.length) {
        const exact = S.data.filter((x) => sameSet(tbPairs(x), maPairs));
        if (exact.includes(tb)) {
          cur.ok(`đúng TB ${tb.tb} (Mã đơn ${maDon})`);
          return sure();
        }
        if (exact.length === 1) {
          if (known) throw ask(`Mã đơn ${maDon} là của TB ${exact[0].tb}, khác hồ sơ đang mở (theo số biên nhận là TB ${tb.tb}) – tiện ích dừng, không thêm / lưu gì`, '');
          switchTo(exact[0], `Mã đơn ${maDon}`);
          return sure();
        }
        if (exact.length > 1)
          throw ask(`Mã đơn ${maDon} khớp cả TB ${exact.map((x) => x.tb).join(', ')} (dữ liệu trùng số biên nhận) – chọn đúng TB rồi bấm “▶ Chạy cả TB”`, '');
        // không khớp hẳn TB nào: TB chung NHIỀU thửa nhất (chỉ một TB như vậy) → làm theo TB đó nhưng không chắc chắn
        const ov = (x) => tbPairs(x).filter((k) => maPairs.includes(k)).length;
        const ranked = S.data.map((x) => ({ x, n: ov(x) })).filter((o) => o.n).sort((a, b) => b.n - a.n);
        const top = ranked.filter((o) => o.n === (ranked[0] || {}).n).map((o) => o.x);
        if (top.includes(tb) && top.length === 1) {
          cur.ok(`TB ${tb.tb} – ⚠ Mã đơn ${maDon} khác số biên nhận trong dữ liệu (${tb.soBienNhan || 'trống'}), chung ${ov(tb)} thửa${NOAUTO}`);
          return;
        }
        if (top.length === 1) {
          if (known) throw ask(`Mã đơn ${maDon} chung thửa với TB ${top[0].tb}, khác hồ sơ đang mở (theo số biên nhận là TB ${tb.tb}) – tiện ích dừng, không thêm / lưu gì`, '');
          switchTo(top[0], `Mã đơn ${maDon} (chung ${ov(top[0])} thửa, không khớp hẳn)`);
          cur.ok(`TB ${tb.tb} – ⚠ Mã đơn ${maDon} khác số biên nhận trong dữ liệu (${tb.soBienNhan || 'trống'})${NOAUTO}`);
          return;
        }
        // không TB nào chung thửa, hoặc nhiều TB chung như nhau → không đoán: mở đúng hồ sơ / chọn đúng TB
        throw ask(
          top.length
            ? `Mã đơn của hồ sơ đang mở là ${maDon} – chung thửa với cả TB ${top.map((x) => x.tb).join(', ')}, không khớp hẳn TB nào. Chọn đúng TB rồi bấm “▶ Chạy cả TB”; chắc chắn là TB ${tb.tb} thì bấm nút dưới`
            : `Mã đơn của hồ sơ đang mở là ${maDon} – không chung thửa nào với TB ${tb.tb} (${tb.soBienNhan || 'chưa có số biên nhận'}) và không khớp TB nào trong dữ liệu. Mở đúng hồ sơ hoặc chọn đúng TB rồi bấm “▶ Chạy cả TB”; chắc chắn đúng thì bấm nút dưới`,
          confirmBtn
        );
      }
      // 2) không đọc được Mã đơn: theo cây chủ / thửa. Cây trống / đang tải → làm theo TB đang chọn, không dừng hỏi (theo ý bạn)
      if ((!page.chu.length && !page.thua.length) || (f && f.loading)) {
        if (known) {
          cur.ok(`đúng TB ${tb.tb} (số biên nhận của hồ sơ; đơn chưa có chủ / thửa${f && f.loading ? ' – cây đang tải' : ''}, không đọc được Mã đơn)`);
          return sure();
        }
        cur.ok(`làm theo TB ${tb.tb} đang chọn (đơn chưa có chủ / thửa${f && f.loading ? ' – cây đang tải' : ''}, không đọc được Mã đơn)${NOAUTO}`);
        return;
      }
      const r = matchTb(page, tb);
      if (r.err) throw new Error(r.err); // đơn có thửa của TB khác / không khớp TB nào → nhập là nhầm hồ sơ
      const extra = [...r.s.forT.map((t) => `thửa ${t.soThua}/${t.soTo}`), ...r.s.forC.map((c) => `chủ ${c.name}`)];
      const extraTxt = extra.length ? ` · đơn có thêm mục không có trong dữ liệu TB: ${extra.join(', ')}` : '';
      const why = pageDesc(page);
      if (r.tie) {
        // nhiều TB khớp như nhau (vd. cùng chủ, đơn chưa có thửa) → làm theo TB đang chọn (không dừng hỏi), không chắc chắn –
        // trừ khi số biên nhận của hồ sơ đã chỉ đúng TB này (known)
        if (known) {
          cur.ok(`đúng TB ${tb.tb} (số biên nhận của hồ sơ; đơn (${why}) khớp như nhau cả TB ${r.tie.join(', ')})${extraTxt}`);
          return sure();
        }
        cur.ok(`làm theo TB ${tb.tb} đang chọn – đơn (${why}) khớp cả TB ${r.tie.join(', ')}${extraTxt}${NOAUTO}`);
        return;
      }
      if (r.switched && !page.thua.length) {
        // đơn chưa hiện thửa, chỉ trùng chủ với TB khác → không đổi TB (một người có thể đứng tên nhiều TB)
        cur.ok(`làm theo TB ${tb.tb} đang chọn – đơn chưa có thửa, chủ trùng với TB ${r.tb.tb}${extraTxt}${NOAUTO}`);
        return;
      }
      if (r.switched) {
        if (known) throw ask(`đơn đang mở (${why}) khớp TB ${r.tb.tb}, khác hồ sơ đang mở (theo số biên nhận là TB ${tb.tb}) – tiện ích dừng, không thêm / lưu gì`, '');
        switchTo(r.tb, `đơn đang mở (${why})`);
        return sure();
      }
      cur.ok(`đúng TB ${tb.tb} (${why})${extraTxt}`);
      sure();
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
    // ngữ cảnh cho các bước Quy trình xử lý (runQuyTrinh / runScan)
    const qtCtx = {
      step: (t) => (cur = step(t)),
      stopIf,
      setTitle: (t) => {
        title = t;
        show();
      },
      setTail: (h, need) => {
        tailOk = h;
        tailNeed = need || '-';
      },
      curTb: () => tb,
      known: () => stage3 || tbKnown, // đã biết chắc hồ sơ đang mở là TB nào (đơn của tác vụ phải cùng TB)
      setTb: (x) => {
        const t = title;
        tbKnown = true;
        setTb(x);
        title = `${t.replace(/ – TB .*$/, '')} – TB ${x.tb}`;
        show();
      },
    };
    // “Đóng” cửa sổ đơn (ảnh 5: sau thông báo hoàn tất thì bấm Đóng) → về Quy trình xử lý (nằm dưới) → (không chained) làm tiếp Quy trình
    const closeDonBack = async (chained) => {
      cur = step('Bấm “Đóng” cửa sổ đơn');
      {
        const tp = await topNow();
        if (tp && DON_MODAL.test(modalKey(tp))) {
          await waitDialogs(cur);
          const rs = await act('clickBtn', { texts: ['Đóng'], inModal: true, win: DON_WIN_SRC });
          if (!rs.some((x) => x.ok)) {
            const w = rs.find((x) => x.why && !x.none) || rs.find((x) => x.why);
            throw new Error(`không bấm được “Đóng” của cửa sổ đơn (${(w && w.why) || 'không thấy nút'}) – bạn tự bấm Đóng rồi bấm “▶ Chạy cả TB”`);
          }
        }
      }
      let qtTop = false;
      for (let k = 0; k < 40 && !qtTop; k++) {
        stopIf();
        await sleep(500);
        const tp = await topNow();
        qtTop = !!tp && /^quy trinh xu ly\b/.test(modalKey(tp)) && !!qtModal();
      }
      if (!qtTop) {
        cur.skip('chưa thấy cửa sổ Quy trình xử lý – mở “Xử lý hồ sơ” của hồ sơ này, tiện ích tự làm tiếp');
        tailOk = '<div class="hint">Xong nhập đơn (đã Lưu thông tin đăng ký, Hoàn tất). Mở <b>Xử lý hồ sơ</b> của hồ sơ – Tự động hết sẽ tự tích “Đã xử lý” và chuyển tiếp.</div>';
        cur = null;
        return true;
      }
      cur.ok('về cửa sổ Quy trình xử lý');
      cur = null;
      if (!chained) await runQt();
      return true;
    };
    // chained: gọi từ Quy trình (runForward) – xong đơn thì trả về, không tự chạy tiếp Quy trình. Trả về true khi đơn đã xong (Hoàn tất, Đóng)
    const runDon = async (chained) => {
      title = `${title} · Nhập đơn đăng ký`;
      {
        const sd = S.stage[String(tb.tb)] || {};
        if (AUTO() && sd.don) {
          step('Nhập đơn đăng ký').skip(`đơn TB ${tb.tb} đã Hoàn tất lúc ${fmtTime(sd.don)} – không nhập lại, chỉ Đóng cửa sổ đơn`);
          return closeDonBack(chained);
        }
      }
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
      const gapNote = [
        ...chuList.filter(({ p }) => chuGaps(p).length).map(({ p, i }) => `chủ ${i + 1}: ${chuGaps(p).join(', ')}`),
        ...thua
          .map((t, i) => ({ t, i, g: thuaGaps(t, tb) }))
          .filter((x) => x.g.length && !noId.includes(x.t))
          .map((x) => `${x.t.soThua}/${x.t.soTo}: ${x.g.join(', ')}`),
      ];
      const dlg = (await act('dialogState')).find((x) => x.open);
      if (dlg) throw new Error(`trang đang hiện hộp “${dlg.titles[0]}” – trả lời hộp đó trước rồi bấm “Chạy cả TB” lại`);
      cur.ok(
        `${chuList.length} chủ, ${thua.length} thửa` +
          (optional.length ? ` (bỏ qua chủ tùy chọn ${optional.map((p) => p.hoTen).join(', ')} – cần thì bấm Điền ở tab Chủ SD)` : '') +
          (noId.length ? ` · bỏ qua ${noId.length} thửa thiếu số thửa/số tờ trong dữ liệu` : '') +
          (gapNote.length ? ` · dữ liệu còn thiếu (điền tay khi tới mục đó): ${gapNote.join('; ')}` : '')
      );
      stopIf();

      // 1. Điều kiện cấp giấy, Đăng ký lần đầu
      const dv = buildValues('donDK', tb);
      if (dv.dieuKienCapGiay || dv.dangKyLanDau) {
        cur = step('Điều kiện cấp giấy, Đăng ký lần đầu');
        const f = mustFill(await fillSec('donDK', dv));
        const skD = f.tplSkip || [];
        cur.ok(
          f.results.map((x) => `${x.name}: ${x.value}`).join(', ') +
            (skD.length ? ` · ⚠ ô bắt buộc không điền theo mẫu mà trên trang trống / khác dữ liệu TB: ${skD.join(', ')} – bạn điền tay` : '')
        );
        if (f.results.some((x) => x.changed)) await sleep(800); // trang tự điền Mã đơn sau khi tích Đăng ký lần đầu
      }
      // chưa chắc hồ sơ: đọc lại Mã đơn (trang điền khi tích Đăng ký lần đầu) – đúng TB này → chắc chắn; là của TB khác → dừng TRƯỚC khi thêm / lưu
      // chủ, thửa (soát 1.21.7: ▶ ở đơn của hồ sơ khác TB đang chọn). Không đọc được / chỉ chung một phần thửa → làm tiếp như trước
      if (!donCertain) {
        const f2 = (await act('donRead')).find((x) => x.ok);
        const ma2 = (f2 && f2.maDon) || '';
        const l2 = ma2 ? tbOfSo(ma2).list : [];
        if (l2.length === 1 && l2[0] === tb) {
          donCertain = true;
          if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'don');
          step('Mã đơn trang vừa điền').ok(`${ma2} – đúng TB ${tb.tb}, chắc chắn`);
        } else if (l2.length && !l2.includes(tb))
          throw ask(
            `Mã đơn trang vừa điền (${ma2}) là của TB ${l2.map((x) => x.tb).join(', ')}, không phải TB ${tb.tb} – tiện ích chưa thêm / lưu chủ, thửa nào; chọn đúng TB rồi bấm “▶ Chạy cả TB”`,
            ''
          );
      }

      // 2–3. Từng chủ, rồi từng thửa. Thửa trùng (ghi 2 lần, đã nhập ở TB khác, lần trước bạn đóng không lưu) → bỏ qua
      const skip = skipMap(tb);
      const skippedNow = new Set(); // thửa bạn đóng cửa sổ không lưu trong lần chạy này
      const items = [
        ...chuList.map(({ p, i }) => ({ kind: 'chu', key: `chu${i}`, label: `Chủ ${i + 1}: ${p.hoTen}`, values: buildValues('chu', tb, i), win: CHU_MODAL, gaps: chuGaps(p) })),
        ...thua
          .map((t, i) => ({
            kind: 'thua',
            key: `thua${i}`,
            label: `Thửa ${t.soThua} tờ ${t.soTo} (${i + 1}/${thua.length})`,
            values: buildValues('thua', tb, i),
            win: THUA_MODAL,
            gaps: thuaGaps(t, tb),
            t,
            tk: thuaKey(t),
            sk: skip.get(i) || null,
          }))
          .filter((it) => !noId.includes(it.t)),
      ];
      const skippedThua = () => items.filter((it) => it.kind === 'thua' && (it.sk || skippedNow.has(it.key)));
      for (const it of items) {
        stopIf();
        cur = step(it.label);
        const pendKey = `${tb.tb}|don-${it.key}|pending`;
        const finish = (msg, skip) => {
          delete S.done[pendKey];
          S.done[`${tb.tb}|${it.key}`] = true;
          saveUi();
          if (it.kind === 'thua') {
            setStageList(tb.tb, 'nhap', it.tk, true); // thửa đã có trong đơn của TB này
            setStageList(tb.tb, 'boQua', it.tk, false);
          }
          if (skip) cur.skip(msg);
          else cur.ok(msg);
        };
        if (it.sk) {
          // lần trước bạn đóng không lưu mà nay đơn đã có (bạn tự thêm) → coi như đã có; còn lại bỏ qua, không mở cửa sổ
          if (it.sk.kind === 'boQua' && (await donHas(it)) === true) {
            it.sk = null;
            finish('đã có trong đơn', true);
            continue;
          }
          cur.skip(`${it.sk.why} – bỏ qua`);
          continue;
        }
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
        if (S.done[pendKey] === true || (fromAuto && S.done[pendKey] === 'confirm')) {
          S.done[pendKey] = 'confirm';
          saveUi();
          const eC = new Error(
            'lần trước cửa sổ đã đóng nhưng đơn chưa có mục này. Nếu bạn đã bấm Đóng thì bấm “▶ Chạy cả TB” lần nữa để mở lại; nếu đã bấm Lưu mà trong đơn không hiện thì kiểm tra tay'
          );
          eC.noRetry = true; // bạn quyết (có thể đã lưu) – 🤖 không tự mở lại mục này
          throw eC;
        }
        // tự bấm “Thêm → Cá nhân / Thửa đất” rồi điền
        let r = await send({ type: 'vbdlis-fill', ...tplMsg(it.kind, it.values) });
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
          r = await send({ type: 'vbdlis-fill', ...tplMsg(it.kind, it.values) });
          if (!r || !r.ok) throw new Error(friendly((r && r.error) || 'Không chạy được'));
          pf = pickFrame(r, it.kind);
        }
        if (!pf.f) throw new Error(pf.err);
        const bad = pf.f.results.filter((x) => !x.ok);
        // mẫu tab Trường bỏ tích ô bắt buộc mà trên trang ô đó trống / khác dữ liệu TB → không tự Lưu, chờ bạn
        const skipT = pf.f.tplSkip || [];
        S.done[pendKey] = true; // đang chờ bạn bấm Lưu cho mục này
        saveUi();
        const gapsHere = !!(it.gaps && it.gaps.length);
        const allOk = !bad.length && !gapsHere && !skipT.length;
        // CHỦ SỬ DỤNG, mọi ô đã khớp dữ liệu → tiện ích tự bấm “Lưu” của cửa sổ chủ (bạn yêu cầu “nhập chủ tự động”).
        // Thiếu dữ liệu / ô chưa điền được / trang đang hỏi → không bấm, dừng chờ bạn như cũ.
        let autoSaved = false;
        let noAuto = ''; // vì sao không tự Lưu được (để bạn biết)
        // Tự động hết: cả cửa sổ THỬA cũng tự Lưu (cùng điều kiện như chủ)
        const canAuto = allOk && (it.kind === 'chu' ? S.opts.tuLuuChu !== false || AUTO() : AUTO());
        // chưa chắc hồ sơ: 🤖 bật → vẫn tự Lưu (bạn yêu cầu 24/11: “lưu hết cho tôi không cần phải dừng lại”); 🤖 tắt → không tự Lưu chủ (bạn nhấn Enter)
        // bấm Lưu của cửa sổ chủ / thửa (đủ kiểm tra): '' = đã bấm, khác = vì sao không bấm – gọi lại được khi hộp hỏi đã đóng (soát 24/11)
        const tryAutoSave = async () => {
          const d0 = (await act('dialogState')).find((x) => x.open);
          const tp0 = await topNow();
          if (d0) return 'trang đang hỏi';
          if (!tp0 || !it.win.test(modalKey(tp0))) return `cửa sổ ${it.kind === 'chu' ? 'chủ' : 'thửa'} không nằm trên cùng`;
          // 🤖: nút bạn tích thêm trong mẫu cửa sổ này (tab Trường) – bấm trước nút Lưu
          const ex = await tplChainExtras({ base: it.kind, decide: ['luu'], step });
          if (ex) return ex;
          const tp1 = await topNow();
          if (!tp1 || !it.win.test(modalKey(tp1)))
            throw new Error(
              `sau nút theo mẫu tab Trường, cửa sổ ${it.kind === 'chu' ? 'chủ' : 'thửa'} không còn nằm trên cùng (${tp1 ? tp1.name : 'đã đóng'}) – tiện ích dừng, không ghi bỏ qua; bạn xem rồi bấm “▶ Chạy cả TB”`
            );
          if ((await act('dialogState')).some((x) => x.open)) return 'trang đang hỏi (sau nút theo mẫu tab Trường)';
          stopIf(); // bạn bấm ■ Dừng / tắt 🤖 lúc chờ sau nút theo mẫu → không bấm Lưu
          const ms = await act('markSave', { win: it.kind });
          const marks = ms.filter((x) => x.ok);
          if (marks.length === 1) return anyOk(await act('clickMark', { id: marks[0].id })) ? '' : 'không bấm được nút Lưu';
          return marks.length ? 'thấy nút Lưu ở nhiều khung' : (ms.find((x) => x.why) || {}).why || 'không thấy nút Lưu';
        };
        if (canAuto && !donCertain && !AUTO()) noAuto = 'chưa chắc hồ sơ của TB này';
        else if (canAuto) {
          if (!donCertain) unsureNote('muc');
          await sleep(600); // trang xử lý xong các ô vừa điền (tra số giấy tờ, định dạng…)
          stopIf();
          const why0 = await tryAutoSave();
          if (why0) noAuto = why0;
          else autoSaved = true;
        }
        // 🤖: lúc định tự Lưu trang đang hỏi → hộp đóng rồi (🤖 / bạn trả lời) thì tự Lưu lại 1 lần, không đứng chờ 20 phút (soát 24/11)
        let retrySave = !autoSaved && canAuto && AUTO() && /^trang dang hoi/.test(norm(noAuto));
        let retryN = 0;
        // còn lại: mọi ô đã khớp → con trỏ nằm sẵn ở nút “Lưu” (không bấm): bạn liếc dòng tóm tắt rồi nhấn Enter
        const robotRetry = retrySave && fromAuto; // 🤖 tự bấm Lưu lại khi hộp đóng – bạn chỉ trả lời hộp
        const focused = !autoSaved && !robotRetry && allOk && S.opts.enterLuu !== false && anyOk(await act('focusSave', {}));
        const waitMsg =
          (noAuto ? `không tự Lưu (${noAuto}); ` : '') +
          (skipT.length ? `mẫu tab Trường bỏ tích ô bắt buộc ${skipT.join(', ')} mà trên trang đang trống / khác dữ liệu TB – bạn điền tay; ` : '') +
          (gapsHere ? `dữ liệu chưa có ${it.gaps.join(', ')} – bạn điền tay; ` : '') +
          (bad.length && !gapsHere ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; ` : '') +
          (allOk ? `đã điền: ${quickLine(it.kind, it.values, pf.f.results)} – ` : '') +
          (autoSaved
            ? 'tiện ích đã tự bấm “Lưu”, chờ trang lưu…'
            : robotRetry
              ? 'hộp hỏi đóng thì 🤖 tự bấm “Lưu” – bạn chỉ trả lời hộp, KHÔNG bấm Lưu'
              : focused
                ? 'kiểm tra rồi nhấn Enter (con trỏ đang ở nút “Lưu”) hoặc tự bấm “Lưu”'
                : 'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ') +
          ' (bấm “■ Dừng” để thôi)';
        cur.wait(waitMsg);
        // 🤖 chạy liên tục (24/11): lần chạy tự động không tự Lưu được (không phải vì trang đang hỏi) → không đứng chờ bạn: TB này tạm hoãn, làm TB khác
        if (!autoSaved && fromAuto && AUTO() && !/^trang dang hoi/.test(norm(noAuto)) && !(await act('dialogState')).some((x) => x.open)) {
          delete S.done[pendKey]; // 🤖 sẽ đóng cửa sổ này không lưu – lần sau mở lại mục này như mới
          saveUi();
          throw new Error(
            `không tự Lưu được ${it.kind === 'chu' ? 'cửa sổ chủ' : 'cửa sổ thửa'} (${noAuto || (gapsHere ? 'dữ liệu TB còn thiếu' : bad.length ? 'có ô chưa điền được' : 'mẫu tab Trường bỏ tích ô bắt buộc')}) – 🤖 không đứng chờ bạn`
          );
        }
        if (!autoSaved && !robotRetry) needYou(`Bấm Lưu – ${it.label}`);
        // chờ cửa sổ lưu xong: trang có thể hỏi (vd. “Giấy tờ tùy thân đã tồn tại…”) → BẠN trả lời; xong thì về lại cửa sổ đơn
        const t0 = Date.now();
        let tAct = t0; // lần cuối trang có động tĩnh (hộp được trả lời / đang hỏi / “Đang xử lý…”) – “cửa sổ kẹt” tính từ đây (soát 24/11)
        let asked = '';
        let stuck = false;
        let tonTai = null; // trang báo thửa đã tồn tại → đã trả lời hộp (Bỏ qua / Đồng ý…), đóng cửa sổ
        let tonAsk = '';
        for (;;) {
          stopIf();
          if (it.kind === 'thua') {
            const ex = await thuaTonTai(it.win);
            if (ex && ex.stuck) {
              if (tonAsk !== ex.text) {
                tonAsk = ex.text;
                cur.wait(`trang báo “${ex.text}” – tiện ích không tự trả lời hộp này (chỉ bấm “Bỏ qua”, hoặc “Đồng ý” / “Đóng” / “OK” của hộp chỉ báo một nút, không hỏi) – bạn tự trả lời / đóng cửa sổ thửa`);
                needYou('Thửa đã tồn tại – bạn xem', 'bad');
              }
              if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bạn trả lời hộp “thửa đã tồn tại” quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
              await sleep(1000);
              continue;
            } else if (ex) {
              tonTai = ex;
              tAct = Date.now();
              if (!ex.closed) {
                stuck = true; // giữ lời nhắc này (không bị câu “tự bấm Lưu” sau 8 giây đè)
                cur.wait(`trang báo “${ex.text}” – đã bấm “${ex.btn}” nhưng không đóng được cửa sổ thửa – bạn bấm Đóng / Hủy bỏ (không bấm Lưu)`);
                needYou('Đóng cửa sổ thửa', 'bad');
              }
              continue;
            }
          }
          const tp = await topNow();
          const d = (await act('dialogState')).find((x) => x.open);
          if (!tp) throw new Error('cửa sổ “Nhập đơn đăng ký” đã đóng – mở lại rồi bấm “Chạy cả TB” để làm tiếp');
          if (DON_MODAL.test(modalKey(tp)) && !d) break;
          if (d && AUTO() && (await autoDlg()) === 'answered') {
            tAct = Date.now();
            continue;
          }
          if (d || pageWorking()) tAct = Date.now(); // trang đang hỏi / đang xử lý → chưa tính là kẹt
          if (retrySave && USER.btnAt > t0 && USER.btn === 'luu') retrySave = false; // bạn đã tự bấm Lưu → không bấm thêm
          if (retrySave && !d && !tonTai && !tonAsk && !stuck && fromAuto && AUTO() && Date.now() - USER.at > 2000 && !pageWorking()) {
            retrySave = false;
            await sleep(600);
            const why1 = await tryAutoSave();
            if (!why1) {
              autoSaved = true;
              asked = '';
              tAct = Date.now();
              cur.wait('tiện ích đã tự bấm “Lưu” (hộp hỏi đã đóng), chờ trang lưu…');
              stopNeed();
              continue;
            }
            if (/^trang dang hoi/.test(norm(why1)) && ++retryN < 3) retrySave = true; // lại có hộp hỏi → chờ hộp đóng rồi thử lại
            else throw new Error(`không tự Lưu được ${it.kind === 'chu' ? 'cửa sổ chủ' : 'cửa sổ thửa'} (${why1}) – 🤖 không đứng chờ bạn`);
          }
          if (d && asked !== d.titles[0]) {
            asked = d.titles[0];
            cur.wait(`trang đang hỏi “${asked}” – bạn tự trả lời, tiện ích chờ rồi làm tiếp`);
            needYou('Trang đang hỏi – bạn trả lời');
          } else if (!d && asked) {
            asked = '';
            tAct = Date.now();
            cur.wait(waitMsg);
          } else if (autoSaved && !d && !stuck && Date.now() - tAct > 8000 * slowK()) {
            // đã tự bấm Lưu mà cửa sổ chủ vẫn mở (trang báo thiếu ô?) → không bấm lần 2, nhờ bạn xem
            stuck = true;
            if (tonTai) {
              // đã trả lời hộp “thửa đã tồn tại” mà cửa sổ thửa còn mở → nhờ bạn đóng, KHÔNG bảo bấm Lưu thửa đã tồn tại
              cur.wait(`trang báo “${tonTai.text}” – đã bấm “${tonTai.btn}”, cửa sổ thửa vẫn mở – bạn bấm Đóng / Hủy bỏ (không bấm Lưu)`);
              needYou('Đóng cửa sổ thửa', 'bad');
            } else {
              cur.wait('tiện ích đã bấm “Lưu” nhưng cửa sổ chưa đóng (trang báo lỗi / thiếu ô?) – bạn xem rồi tự bấm “Lưu” (bấm “■ Dừng” để thôi)');
              needYou(`Xem cửa sổ – ${it.label}`, 'bad');
            }
          }
          // 🤖 chạy liên tục (soát 24/11): đã bấm Lưu mà cửa sổ vẫn mở 30 giây sau động tĩnh cuối của trang (không hộp, không “Đang xử lý…”)
          // → không đứng chờ bạn 20 phút: TB này tạm hoãn, 🤖 đóng cửa sổ (không lưu), làm TB khác. GIỮ dấu “đã bấm Lưu” (lần sau đơn chưa có
          // mục này thì hỏi bạn, không thêm lần 2); thửa đã tồn tại (không lưu) thì bỏ dấu
          if (autoSaved && stuck && !d && fromAuto && AUTO() && Date.now() - tAct > 30000 * slowK()) {
            if (tonTai) {
              delete S.done[pendKey];
              saveUi();
            }
            throw new Error(`đã bấm “Lưu” nhưng cửa sổ ${it.kind === 'chu' ? 'chủ' : 'thửa'} chưa đóng (trang báo lỗi / thiếu ô?) – 🤖 không đứng chờ bạn`);
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
        if (!ok) {
          if (it.kind !== 'thua')
            throw new Error(
              'cửa sổ đã đóng nhưng đơn chưa có mục này (bấm Đóng?) – bấm “▶ Chạy cả TB” để làm tiếp (tiện ích sẽ hỏi lại trước khi mở lại)'
            );
          // thửa: bạn đóng cửa sổ không lưu (VBDLIS báo thửa trùng / bạn bỏ) → bỏ qua thửa này, làm tiếp thửa sau
          delete S.done[pendKey];
          saveUi();
          setStageList(tb.tb, 'boQua', it.tk, true);
          skippedNow.add(it.key);
          cur.skip(
            tonTai
              ? `trang báo “${tonTai.text}” – đã bấm “${tonTai.btn}”${tonTai.how ? ', ' + tonTai.how : ''} – bỏ qua thửa này (không nhập lại), làm tiếp thửa sau`
              : 'cửa sổ đóng mà không lưu (thửa trùng / bạn bỏ) – bỏ qua, làm tiếp thửa sau'
          );
          continue;
        }
        finish('đã vào đơn');
      }

      // 4. Đối chiếu: mọi chủ, mọi thửa (trừ thửa bỏ qua) đã có trong đơn
      cur = step('Đối chiếu đơn với dữ liệu');
      const miss = [];
      for (const it of items) if (!it.sk && !skippedNow.has(it.key) && (await donHas(it)) !== true) miss.push(it.label);
      if (miss.length) throw new Error('đơn còn thiếu: ' + miss.join('; '));
      const skipped = skippedThua();
      cur.ok(
        `${chuList.length} chủ, ${items.length - chuList.length - skipped.length} thửa đã có trong đơn` +
          (skipped.length ? ` · bỏ qua ${skipped.length} thửa trùng: ${skipped.map((it) => `${it.t.soThua}/${it.t.soTo}`).join(', ')}` : '') +
          (noId.length ? ` · còn ${noId.length} thửa dữ liệu thiếu số thửa/số tờ – bạn tự thêm` : '')
      );

      let lastSheet = null;
      // 4b. Phiếu đối chiếu: đọc lại cây của đơn (những gì VBDLIS đã lưu) và so từng ô với dữ liệu
      cur = step('Phiếu đối chiếu số liệu');
      {
        const f = (await act('donRead')).find((x) => x.ok);
        const page = f ? parseDon(f) : { chu: [], thua: [] };
        const skippedKeys = new Set(skippedThua().map((it) => it.key));
        const thuaList = thua.map((t, i) => ({ t, i })).filter((x) => !noId.includes(x.t) && !skippedKeys.has(`thua${x.i}`));
        const sh = buildSheet(tb, page, chuList, thuaList);
        lastSheet = sh;
        sheet = sh.n.ok || sh.n.bad ? sheetHtml(sh) : '';
        // từ giờ chờ trang báo “Lưu đơn đăng ký thành công” (sau khi BẠN bấm Hoàn tất) → tự ghi giờ nhập đơn (trạng thái vẫn Đã tiếp nhận)
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

      // 5 (Tự động hết). Mọi ô khớp, không thiếu dữ liệu → tự bấm “Lưu thông tin đăng ký”, “Hoàn tất”, rồi sang Quy trình xử lý làm tác vụ 2–3.
      //    Hồ sơ chưa chắc chắn mà không có gì trái ngược → vẫn bấm (bạn yêu cầu 24/11); thửa không thêm được / trang không hiện số liệu → dừng, kêu ting.
      if (AUTO()) {
        // dừng khi: có thửa không thêm được, trang không hiện số liệu để so. Ô lệch (✗) đã dừng ở phiếu đối chiếu.
        // Chưa chắc hồ sơ (tiện ích làm theo TB đoán được) → vẫn lưu (bạn yêu cầu 24/11: “lưu hết cho tôi không cần phải dừng lại”). Đã dừng trước đó:
        // Mã đơn đúng của TB khác / khớp nhiều TB / không chung thửa, đơn có thửa của TB khác (bước nhận hồ sơ); Mã đơn trang vừa điền là của TB khác (sau bước 1)
        // Dữ liệu TB thiếu ô (⚠ – bạn đã điền tay ở cửa sổ chủ / thửa) → vẫn lưu (bạn yêu cầu: điền xong thì Lưu thông tin, Hoàn tất, Đóng)
        const why = noId.length
          ? `${noId.length} thửa dữ liệu thiếu số thửa / số tờ – bạn tự thêm`
          : lastSheet && !lastSheet.n.ok
            ? 'trang không hiện số liệu để đối chiếu'
            : '';
        if (!why && (gapNote.length || (lastSheet && lastSheet.n.gap))) {
          log.push({
            icon: '⚠',
            cls: 'warn',
            html: esc(`Dữ liệu TB còn thiếu ${lastSheet && lastSheet.n.gap ? lastSheet.n.gap + ' ô' : 'ô'} (xem phiếu đối chiếu) – vẫn lưu đơn; bạn xem lại sau`),
          });
          show();
        }
        if (why && fromAuto) throw new Error(`${why} – 🤖 không bấm “Lưu thông tin đăng ký”, không đứng chờ bạn`); // chạy liên tục (soát 24/11)
        if (why) {
          cur = step('Tự động hết: dừng trước “Lưu thông tin đăng ký”');
          cur.wait(`${why} – bạn kiểm tra rồi tự bấm “Lưu thông tin đăng ký”, “Hoàn tất”`);
          await act('highlight', { texts: ['Lưu thông tin đăng ký'], inModal: true });
          tailNeed = 'Tự động dừng – bạn xem';
          tailOk = `<div class="hint">Tự động hết dừng lại: ${esc(why)}. Bạn kiểm tra rồi tự bấm <b>Lưu thông tin đăng ký</b> và <b>Hoàn tất</b>.</div>`;
          setHold(tb.tb, { kind: 'don' });
          cur = null;
          return false;
        }
        // bấm một nút của cửa sổ đơn rồi chờ trang báo câu thành công (hộp hỏi đã biết → tiện ích trả lời; hộp lạ → chờ bạn)
        const pressDon = async (label, stage, okSay, mark) => {
          cur = step(`Bấm “${label}” (tự động)`);
          await waitDialogs(cur);
          if (mark) await setMark(tb.tb, mark, Date.now()); // ghi ngay trước khi bấm (trang có thể tải lại)
          const t0 = Date.now();
          const rs = await act('clickBtn', { texts: [label], inModal: true, win: DON_WIN_SRC });
          const r = rs.find((x) => x.ok);
          if (!r) {
            if (mark) await setMark(tb.tb, mark, null); // chưa bấm được → bỏ dấu
            const w = rs.find((x) => x.why && !x.none) || rs.find((x) => x.why);
            throw new Error(`không bấm được “${label}” (${(w && w.why) || 'không thấy nút'}) – bạn tự bấm`);
          }
          cur.wait('đã bấm, chờ trang lưu…');
          let asked = '';
          for (;;) {
            stopIf();
            if ((S.lastMsg[stage] || 0) > t0) break;
            const d = (await act('dialogState')).find((x) => x.open);
            if (d) {
              const a = await autoDlg();
              if (a !== 'answered' && asked !== d.titles[0]) {
                asked = d.titles[0];
                cur.wait(`trang hỏi “${asked}” – tiện ích không tự trả lời hộp này, bạn xem rồi trả lời`);
                needYou('Trang đang hỏi – bạn trả lời', 'bad');
              }
            }
            const lim = asked ? WAIT_MAX_MS : 90000;
            if (Date.now() - t0 > lim) throw new Error(`đã bấm “${label}” nhưng ${Math.round(lim / 1000)} giây chưa thấy “${okSay}” – xem lại trang`);
            await sleep(500);
          }
          stopNeed();
          cur.ok(`trang báo “${okSay}”`);
        };
        const s1 = S.stage[String(tb.tb)] || {};
        if (s1.htClick && !s1.don)
          // lần trước đã bấm Hoàn tất mà chưa thấy báo thành công (trang tải lại?) → không bấm lại, nhờ bạn xem
          throw ask(
            `đã bấm “Hoàn tất” lúc ${fmtTime(s1.htClick)} mà chưa thấy “Lưu đơn đăng ký thành công” – bạn xem lại đơn; đơn đã xong thì bấm nút dưới`,
            actBtn('markDon', tb.tb, `Đơn TB ${tb.tb} đã xong – làm tiếp`)
          );
        if (s1.don) step('Lưu thông tin đăng ký, Hoàn tất').skip(`đơn đã hoàn tất lúc ${fmtTime(s1.don)} – không bấm lại`);
        else {
          // “chỉ nhập chỗ ý”: mẫu tab Trường của cửa sổ đơn không điền ô bắt buộc (bỏ tích / không có trong mẫu) → ô đó trên trang
          // phải đúng dữ liệu TB, không thì dừng trước “Lưu thông tin đăng ký”
          {
            const md = tplMsg('donDK', buildValues('donDK', tb));
            if (md.section && typeof md.section === 'object') {
              const ck = (await act('tplCheck', md)).find((x) => x.ok);
              if (ck && ck.skip.length) {
                needYou('Ô bắt buộc chưa đúng – bạn xem', 'bad');
                throw new Error(
                  `mẫu tab Trường không điền ô bắt buộc ${ck.skip.join(', ')} mà trên trang ô đó đang trống / khác dữ liệu TB – bạn điền đúng rồi bấm “▶ Chạy cả TB” (tiện ích dừng trước “Lưu thông tin đăng ký”)`
                );
              }
            }
          }
          // 🤖 (bạn chọn 23/11): nút bạn tích thêm trong mẫu cửa sổ Nhập đơn đăng ký (tab Trường) – bấm trước “Lưu thông tin đăng ký”
          const exD = await tplChainExtras({ base: 'donDK', decide: ['luu thong tin dang ky', 'hoan tat'], step, dlgOk: true });
          if (exD) throw new Error(`${exD} – tiện ích dừng trước “Lưu thông tin đăng ký”, bạn xem rồi bấm “▶ Chạy cả TB”`);
          if (!donCertain) {
            unsureNote('don');
            donGuess = tb; // chuyển tiếp sau đó (cùng lần chạy) phải là hồ sơ của đúng TB này
          }
          await pressDon('Lưu thông tin đăng ký', 'lt', 'Cập nhật đơn đăng ký thành công');
          S.armed = { tb: String(tb.tb), stage: 'don', at: Date.now(), lech: 0 };
          await pressDon('Hoàn tất', 'don', 'Lưu đơn đăng ký thành công', 'htClick');
          // ghi mốc nhập đơn (phiếu đối chiếu khớp; đơn chắc chắn của TB này – hoặc 🤖 lưu theo TB đoán được, bạn yêu cầu 24/11) – cửa sổ đơn có thể đóng trước khi kịp đọc lại
          await sleep(1500);
          if (!(S.stage[String(tb.tb)] || {}).don) {
            markStage(tb.tb, 'don', 'auto', { lech: 0 });
            setEvt(`✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: <b>đã nhập đơn</b> (Tự động hết – trang báo “Lưu đơn đăng ký thành công”).`);
          }
        }
        return closeDonBack(chained);
      }

      // 5. Chỉ chỗ nút “Lưu thông tin đăng ký” (không bấm)
      cur = step('Nút “Lưu thông tin đăng ký”');
      if (anyOk(await act('highlight', { texts: ['Lưu thông tin đăng ký'], inModal: true })))
        cur.ok('đã tô vàng – bạn kiểm tra rồi tự bấm, sau đó bấm “Hoàn tất” (1 lần là đủ)');
      else cur.skip('không thấy nút – bạn tự bấm “Lưu thông tin đăng ký” rồi “Hoàn tất”');
      cur = null;
      tailOk =
        '<div class="hint">Xong bước Nhập đơn đăng ký: bạn kiểm tra rồi tự bấm <b>Lưu thông tin đăng ký</b>, sau đó <b>Hoàn tất</b> (bấm 1 lần, thấy “Lưu đơn đăng ký thành công” là xong). Khi trang báo câu đó, tiện ích ghi giờ nhập đơn – ' +
        'trạng thái TB vẫn là <b>○ Chưa xong</b> – <b>◐</b> khi chuyển lãnh đạo, <b>✓ Xong</b> khi Trả hồ sơ.</div>';
    };

    // ---------- Chuyển tiếp hồ sơ, Trả hồ sơ (Tự động hết – ảnh 1–10 của bạn) ----------
    // hộp hỏi / thông báo của trang (không có ô nhập). Tự động hết: tự trả lời hộp đã biết (rules). Trả về null | { answered, title, text }
    // cửa sổ thửa (Tiếp nhận “Thêm thửa đất” / đơn “Thông tin thửa đất”), trang báo thửa ĐÃ TỒN TẠI (bạn yêu cầu 23/11): trả lời hộp →
    // đóng cửa sổ thửa không lưu (Hủy bỏ / Đóng / ×) → chỗ gọi ghi bỏ qua thửa đó (không nhập lại). Trả lời hộp: nút có chữ “bỏ qua”;
    // hộp chỉ báo (không hỏi): Đóng / OK / Đã hiểu / Thoát, hoặc “Đồng ý” khi đó là nút DUY NHẤT của hộp – trang thật (ảnh 23/11):
    // “THÔNG BÁO – Thửa đất đã tồn tại” chỉ có nút “ĐỒNG Ý” (bạn: “chỗ đất là đồng ý chứ không phải là bỏ qua”).
    // Hộp hỏi (“?”, “có muốn”, “xác nhận”…, hoặc có thêm nút Hủy / Không…) mà không có nút bỏ qua → chờ bạn (không bấm Đồng ý / Lưu ở hộp hỏi).
    // Trả null (không có hộp đó) | { text, stuck: true } | { text, btn, closed, how }
    const thuaTonTai = async (winRe) => {
      const ds = (await act('dialogState')).filter((x) => x.open);
      const d = ds[0];
      if (!d) return null;
      const titles = d.titles || [];
      const i = (d.texts || titles).findIndex((t, j) => {
        const s = norm(`${titles[j] || ''} ${(d.texts || [])[j] || ''}`);
        return THUA_EXISTS.test(s) && !/giay to tuy than/.test(s);
      });
      if (i < 0) return null;
      const text = `${titles[i] ? titles[i] + ': ' : ''}${(d.texts || [])[i] || ''}`.replace(/\s+/g, ' ').trim().slice(0, 160);
      const re = THUA_EXISTS.source;
      const hoi = /\?|co muon|co chac|ban muon|that su muon|hay khong|xac nhan/.test(norm(text)); // hộp hỏi – không bấm nút đồng ý / đóng của hộp này
      const one = ds.length === 1 && titles.length === 1; // cả trang (mọi khung) chỉ có hộp này – hộp vừa xét cũng là hộp sẽ bấm
      let r = (await act('answerDialog', { rules: [{ re, btnRe: '(^| )bo qua( |$)' }], learned: [] })).find((x) => x.ok);
      if (!r && !hoi) r = (await act('answerDialog', { rules: [{ re, btn: ['Đóng', 'OK', 'Đã hiểu', 'Thoát'] }], learned: [] })).find((x) => x.ok);
      // trang thật: “THÔNG BÁO – Thửa đất đã tồn tại” chỉ có nút “ĐỒNG Ý” → bấm Đồng ý (sole: cả hộp đúng MỘT nút có chữ)
      if (!r && !hoi && one) r = (await act('answerDialog', { rules: [{ re: THUA_DONG_Y, btn: ['Đồng ý'], sole: true }], learned: [] })).find((x) => x.ok);
      if (!r) return { text, stuck: true };
      await sleep(1200);
      const tp = await topNow();
      if (!tp || !winRe.test(modalKey(tp))) return { text, btn: r.btn || '', closed: true, how: 'trang tự đóng cửa sổ thửa' };
      const c = (await act('closeTop', { win: winRe.source })).find((x) => x.ok);
      if (c) await sleep(900);
      return { text, btn: r.btn || '', closed: !!c, how: c ? `bấm “${c.btn}” cửa sổ thửa` : '' };
    };
    // noLearn: chỉ trả lời theo rules (không bấm hộp bạn đã dạy ở tab Trường) – dùng ở chỗ phải ĐỌC hộp để biết trang báo gì
    const dlgNow = async (rules, noLearn) => {
      const rs = await act('answerDialog', { rules: AUTO() ? rules || AUTO_DIALOGS : [], ...(noLearn ? { learned: [] } : {}) });
      const hit = rs.find((x) => x.ok);
      if (hit) {
        log.push({ icon: '•', cls: 'muted', html: esc(`Trang hỏi “${hit.title}” – tiện ích bấm “${hit.btn}” (${hit.learned ? 'theo hộp bạn đã dạy ở tab Trường' : 'Tự động hết'})`) });
        show();
        await sleep(900);
        if (hit.learned && hit.err) throw taughtErr(hit); // hộp LỖI đã dạy: bấm theo mẫu, bước này chưa xong (24/11)
        return { answered: true, learned: !!hit.learned, title: hit.title, text: hit.text || hit.title || '' };
      }
      const o = rs.find((x) => x.open);
      return o ? { answered: false, title: o.title || '', text: o.text || o.title || '' } : null;
    };
    const alive = () => {
      stopIf();
      return true;
    };
    // hồ sơ đang mở là của TB nào: Số biên nhận (ô / nhãn “Số biên nhận”) ↔ số biên nhận trong dữ liệu – phải đúng MỘT TB
    // (không chuyển nhầm hồ sơ). sure: vừa Lưu hồ sơ của chính TB này trong lần chạy này (trang chưa hiện số thì vẫn là TB đó)
    const dossierTb = async (sure) => {
      const so = await dossierSo();
      noteQtSo(so, true);
      const m = tbOfSo(so);
      let x = m.list.length === 1 ? m.list[0] : null;
      if (!x && !so && sure && tb) x = tb;
      if (!x && !so) {
        log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): ${listDiag()}`) });
        show();
      }
      if (!x)
        throw ask(
          so
            ? `Số biên nhận của hồ sơ đang mở là ${so} – ${m.list.length ? 'khớp nhiều TB (' + m.list.map((y) => y.tb).join(', ') + ')' : 'không khớp TB nào trong dữ liệu'} – tiện ích không xử lý hồ sơ này`
            : 'không đọc được Số biên nhận của hồ sơ đang mở – tiện ích không xử lý (tránh chuyển nhầm hồ sơ)',
          ''
        );
      // màn hình hồ sơ có ô “Người nộp hồ sơ” → phải đúng người nộp của TB đó
      let nn = null;
      try {
        nn = await readField('Người nộp hồ sơ');
      } catch (e) {}
      const want = x.nguoiNop && x.nguoiNop.hoTen;
      if (nn && want && normVal(nn) !== normVal(want) && toneFold(nn) !== toneFold(want))
        throw ask(`hồ sơ đang mở có người nộp “${nn}”, khác TB ${x.tb} (“${want}”) – tiện ích không xử lý`, '');
      tbKnown = true; // (soát 24/11) chỉ khi đã kiểm xong người nộp – lỗi trước đó không tạm hoãn nhầm TB đang chọn
      return { x, so: so || x.soBienNhan || '' };
    };
    // đã bấm nút chuyển / trả (k) trong 30 phút mà chưa xác nhận
    const pending = (s, k) => !!(s && s.fwd && s.fwd.k === k && Date.now() - s.fwd.at < 30 * 60 * 1000);
    const redoBtn = (k) => actBtn('clearFwd', tb.tb, `Chưa chuyển – làm lại TB ${tb.tb}`, k ? ` data-k="${k}"` : '');
    // Trả hồ sơ: “Chưa trả – làm lại” (bỏ dấu đang Trả hồ sơ), “Đã trả – ✓ Xong” (bạn xem trên VBDLIS đã trả)
    const redoTra = () => actBtn('clearFwd', tb.tb, `Chưa trả – làm lại TB ${tb.tb}`, ' data-k="tra"');
    const traBtns = () => actBtn('markTra', tb.tb, `Đã trả – ✓ Xong TB ${tb.tb}`) + ' ' + redoTra();
    const ldDoneBtn = () => actBtn('markLd', tb.tb, `Đã chuyển lãnh đạo – sang TB sau`);
    // màn hình hồ sơ (ảnh 1) hoặc danh sách hồ sơ thụ lý đang chọn hồ sơ (ảnh 7, 8): đúng TB → “Xử lý hồ sơ” → làm theo Quy trình hiện ra
    const runHoso = async (sure) => {
      cur = step('Hồ sơ đang mở');
      const { x, so } = await dossierTb(sure);
      if (traPhase(S.stage[String(x.tb)] || {})) stage3 = true;
      if (x !== tb) setTb(x);
      const s = S.stage[String(tb.tb)] || {};
      if (s.hoan) throw ask(`TB ${tb.tb} đang tạm hoãn – tiện ích không xử lý tiếp`, actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`));
      if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'auto'); // hồ sơ đã có trên VBDLIS → đã tiếp nhận
      cur.ok(`${so} – TB ${tb.tb}`);
      if (s.tra) {
        step('Hồ sơ').skip(`TB ${tb.tb} đã trả hồ sơ lúc ${fmtTime(s.tra)} – không còn việc`);
        tailNeed = '-';
        return;
      }
      // lãnh đạo đã trả về / đang ở bước Trả kết quả → làm tiếp Trả hồ sơ (không sang TB sau)
      if (traPhase(s)) {
        stage3 = true;
        return openQt();
      }
      // vừa chuyển lãnh đạo (15 phút) → hồ sơ đã sang người khác → sang TB sau
      if (ldRecent(s)) return goNext(true);
      return openQt();
    };
    // bấm “Xử lý hồ sơ” → chờ Quy trình (hoặc thông báo) → làm theo Quy trình
    const openQt = async (wantSo) => {
      const s = S.stage[String(tb.tb)] || {};
      {
        const t0m = await topNow();
        if (t0m && (realModals().length || (t0m.frame && t0m.frame !== location.href)))
          throw new Error(`đang có cửa sổ mở trên trang (${t0m.frame && t0m.frame !== location.href ? t0m.name || 'khung con' : modalDiag()}) – tiện ích không bấm “Xử lý hồ sơ”`);
      }
      {
        // hộp đang mở sẵn không được coi là câu trả lời của “Xử lý hồ sơ”
        const d0 = await dlgNow([], true);
        if (d0) throw ask(`trang đang hiện hộp “${(d0.text || d0.title || '').slice(0, 120)}” – bạn trả lời hộp đó trước rồi bấm “▶ Chạy cả TB”`, '');
      }
      cur = step('Bấm “Xử lý hồ sơ”');
      const b = btnXuLyHoSo();
      if (!b) throw new Error('không thấy nút “Xử lý hồ sơ”');
      const tq = Date.now();
      clickPage(b);
      let got = '';
      let d = null;
      for (let i = 0; i < 60 && !got; i++) {
        stopIf();
        await sleep(400);
        const m = qtModal();
        if (m && qtRows(m).length) got = 'qt';
        else if ((d = await dlgNow([], true))) got = 'dlg';
        else {
          const bad = toastsSince(tq).find(toastBad);
          if (bad) {
            // vd. “Vui lòng chọn hồ sơ” – trang chưa nhận dòng vừa bấm
            const e = new Error(`bấm “Xử lý hồ sơ”, trang báo “${bad.raw.slice(0, 150)}”`);
            e.chonHoSo = /chon ho so|chua chon/.test(norm(bad.text || bad.raw || ''));
            throw e;
          }
        }
      }
      if (got === 'dlg') {
        const dt = norm(d.text || d.title || '');
        if (wantSo) {
          // trang trả lời về hồ sơ ĐANG CHỌN – khác hồ sơ vừa tìm (khung bên phải / dòng chọn) thì không ghi tiến độ cho TB này
          const so3 = await dossierSo();
          if (so3 && soKey(so3) !== soKey(wantSo)) {
            needYou('Trang báo – bạn xem', 'bad');
            throw ask(`bấm “Xử lý hồ sơ”, trang báo “${(d.text || d.title || '').slice(0, 160)}” – nhưng hồ sơ đang chọn là ${so3}, không phải ${wantSo}; tiện ích không ghi gì`, '');
          }
        }
        // đã bấm Thực thi chuyển lãnh đạo (hoặc bạn tự chuyển sau khi nhập đơn) mà trang báo hồ sơ không còn của bạn → đã chuyển lãnh đạo
        if ((pending(s, 'ld') || (s.cv && s.don && !s.ld && !s.fwd)) && !(s.fwd && s.fwd.bad) && LD_MOVED.test(dt)) {
          markStage(tb.tb, 'ld', 'suy');
          await act('answerDialog', { rules: [{ re: '.', btn: ['Đóng', 'OK'] }] });
          cur.ok(`hồ sơ đã chuyển lãnh đạo (trang báo “${(d.text || d.title || '').slice(0, 80)}”)`);
          return goNext(true);
        }
        // đã bấm Trả hồ sơ / đang chặng cuối mà trang báo hồ sơ đã trả kết quả → xong
        if ((pending(s, 'tra') || traPhase(s)) && TRA_DONE.test(dt)) {
          markStage(tb.tb, 'tra', 'suy');
          await act('answerDialog', { rules: [{ re: '.', btn: ['Đóng', 'OK'] }] });
          cur.ok(`hồ sơ đã trả kết quả (trang báo “${(d.text || d.title || '').slice(0, 80)}”)`);
          tailNeed = '-';
          return;
        }
        needYou('Trang báo – bạn xem', 'bad');
        throw ask(`bấm “Xử lý hồ sơ”, trang báo: “${(d.text || d.title || '').slice(0, 200)}” – tiện ích dừng`, '');
      }
      if (!got) throw new Error('bấm “Xử lý hồ sơ” rồi mà chưa thấy cửa sổ “Quy trình xử lý”');
      if (wantSo) {
        // mở từ Danh sách hồ sơ thụ lý: hồ sơ đang chọn trên trang phải đúng hồ sơ vừa tìm – khác thì không làm gì trên Quy trình này
        const so2 = await dossierSo();
        if (so2 && soKey(so2) !== soKey(wantSo))
          throw new Error(`Quy trình vừa mở là của hồ sơ ${so2}, không phải ${wantSo} – tiện ích dừng, không làm gì trên Quy trình này`);
      }
      cur.ok();
      return runQt();
    };
    // cửa sổ Quy trình xử lý đang mở: đọc khi đã ổn định rồi làm theo loại
    const runQt = async () => {
      const q = await qtSettled(alive);
      if (!q) throw new Error('cửa sổ Quy trình xử lý chưa tải xong (hoặc còn đang thay đổi)');
      const ft = qtFilterText(q.m);
      if (ft) throw ask(`ô “Nhập tên tác vụ cần tìm…” đang có chữ “${ft}” (một số tác vụ bị ẩn) – xóa chữ đó rồi bấm “▶ Chạy cả TB”`, '');
      if (q.v === 'tn' || q.v === 'cv') return runForward(q);
      if (q.v === 'kq') return runKq(q);
      if (q.v === 'tra') return runTra(q);
      throw ask(`Quy trình xử lý có tác vụ ${q.rows.map((r) => `“${r.name}”`).join(', ') || '(trống)'} – tiện ích chưa biết làm bước này`, '');
    };
    // tích “Đã xử lý” của một tác vụ (đọc lại sau khi tích; trang hỏi xác nhận đã biết → Đồng ý; hộp lạ / lỗi → dừng)
    const tickQt = async (r0) => {
      // đọc lại dòng ngay trước khi tích (bảng có thể vừa vẽ lại)
      const m0 = qtModal();
      const r = m0 ? qtRows(m0).find((y) => y.key === r0.key) : null;
      if (!r || !r.chk) throw new Error(`không thấy lại dòng “${r0.name}” trong cửa sổ Quy trình xử lý`);
      if (r.chk.checked) return 'đã tích sẵn';
      if (r.chk.disabled) throw new Error(`ô “Đã xử lý” của “${r.name}” đang bị khóa`);
      const t0 = Date.now();
      stopIf();
      r.chk.click(); // ô tích: bấm thường
      for (let i = 0; i < 25; i++) {
        await sleep(300);
        stopIf();
        const d = await dlgNow(FWD_DIALOGS);
        if (d && !d.answered) {
          needYou('Trang báo – bạn xem', 'bad');
          throw ask(`tích “Đã xử lý” – ${r.name}: trang báo “${d.text.slice(0, 200)}” – tiện ích dừng`, '');
        }
        const bad = toastsSince(t0).find(toastBad);
        if (bad) throw ask(`tích “Đã xử lý” – ${r.name}: trang báo “${bad.raw.slice(0, 150)}” – tiện ích dừng`, '');
        const now = qtRows(qtModal()).find((y) => y.key === r.key);
        if (now && now.chk && now.chk.checked) return 'đã tích';
      }
      throw new Error(`chưa tích được “Đã xử lý” – ${r.name}`);
    };
    // 🤖 chạy liên tục (bạn chọn 24/11): hồ sơ chỉ còn việc của BẠN (Kết ISO khi chưa bật “Tự Kết ISO”, chưa có file quét) → đóng Quy trình
    // (không lưu gì), lượt tìm 10 phút sau mới mở lại hồ sơ này (thả file của nó thì mở lại ngay); không ở danh sách thì về Danh sách hồ sơ thụ lý
    // – 🤖 làm TB khác. true = đã đóng
    const qtLeave = async (x, why) => {
      if (!fromAuto || !AUTO() || !x) return false;
      const tp = await topNow();
      if (!tp || !/^quy trinh xu ly\b/.test(modalKey(tp))) return false;
      if (!(await act('closeTop', { win: '^quy trinh xu ly' })).some((y) => y.ok)) return false;
      S.sweepSeen = { ...(S.sweepSeen || {}), [String(x.tb)]: { snap: stageSnap(x.tb), at: Date.now(), wait: 1, why: /file/.test(norm(why)) ? 'scan' : 'iso' } };
      saveSweepSeen();
      step('Đóng Quy trình – làm TB khác').ok(`hồ sơ chờ bạn ${why} – 🤖 đóng Quy trình (không lưu gì), 10 phút sau mới mở lại hồ sơ này`);
      tailOk = '';
      await sleep(900);
      if (onListPage()) return true;
      const nav = navXuLyCongViec() || listUrlLink();
      if (!nav) return true;
      cur = step('Về Danh sách hồ sơ thụ lý – TB khác');
      await goAndWait(nav, 'Xử lý công việc', () => onListPage() && !qtModal(), listUrlLink());
      cur.ok();
      return true;
    };
    // Quy trình 5 tác vụ (ảnh 7): tác vụ 2–3 chưa xong → làm như cũ; tích đủ cả 5 (bạn đã Kết ISO) → Chuyển tiếp bước “Trả kết quả”
    const runKq = async (q) => {
      let kqTb = null; // TB đọc được từ số biên nhận của hồ sơ (đúng 1 TB)
      {
        // hồ sơ lãnh đạo trả về là của TB nào (đọc được thì chọn TB đó; chạy xong trả lại TB đang chọn)
        const l = tbOfSo(await dossierSo()).list;
        if (l.length === 1) {
          kqTb = l[0];
          stage3 = true;
          tbKnown = true; // hồ sơ đọc được số biên nhận đúng 1 TB
          if (l[0] !== tb) setTb(l[0]);
          // Quy trình 5 tác vụ = lãnh đạo đã trả về → ghi mốc kq NGAY (trước đây chỉ ghi lúc chuyển bước Trả kết quả: dừng giữa chừng – chưa có file
          // quét, chờ bạn Kết ISO… – thì TB chưa có dấu, sau này bạn tự trả xong mà tìm không thấy hồ sơ thì không tích ✓ được)
          const s0 = S.stage[String(l[0].tb)] || {};
          // (TB tạm hoãn: không ghi – markStage sẽ bỏ hoãn; bước sau vẫn hỏi “Bỏ tạm hoãn”)
          if (!s0.kq && !s0.tra && !s0.hoan) {
            await setMark(l[0].tb, 'kq', Date.now());
            if (!(S.stage[String(l[0].tb)] || {}).ld) markStage(l[0].tb, 'ld', 'kq');
            // dấu mới không làm hồ sơ này được mở lại ngay ở danh sách (giữ nhịp 3 phút của TB vừa mở)
            const sw = S.sweepSeen && S.sweepSeen[String(l[0].tb)];
            if (sw && typeof sw === 'object') {
              S.sweepSeen[String(l[0].tb)] = { ...sw, snap: stageSnap(l[0].tb) };
              saveSweepSeen();
            }
          }
        }
      }
      // hồ sơ chỉ còn việc của BẠN → đóng Quy trình, làm TB khác (qtLeave)
      const qtWaitClose = (why) => qtLeave(kqTb, why);
      await loadScanQ(); // hàng chờ file quét mới nhất (xét file CỦA hồ sơ này)
      const scanOk = scanReady(kqTb);
      const r23 = q.rows.filter((r) => ['pl', 'lk'].includes(qtKindOf(r)));
      if (r23.some((r) => !r.chk.checked)) {
        // TB tạm hoãn (vd. trang đã báo không cập nhật được dữ liệu pháp lý) → không làm tác vụ 2–3 – nút “Bỏ tạm hoãn”
        if (kqTb && (S.stage[String(kqTb.tb)] || {}).hoan)
          throw ask(`TB ${kqTb.tb} đang tạm hoãn – tiện ích không làm tác vụ 2–3`, actBtn('unHoan', kqTb.tb, `Bỏ tạm hoãn, chạy TB ${kqTb.tb}`));
        // (soát 24/11) chỉ còn Lưu kho mà hàng chờ chưa có file quét CỦA hồ sơ này → 🤖 đóng Quy trình (không mở Lưu kho), làm TB khác
        if (!r23.some((r) => qtKindOf(r) === 'pl' && !r.chk.checked) && !scanOk && (await qtWaitClose('thả file quét (DDK + TBXN) của hồ sơ này vào bảng điền'))) return;
        await runQuyTrinh('quytrinh', qtCtx);
        const q2 = await qtSettled(alive);
        if (!q2 || q2.v !== 'kq') return;
        // tác vụ 2–3 chưa xong (vd. hàng chờ chưa có file quét) → giữ lời nhắc của bước đó (🤖: chưa có file quét → đóng Quy trình, làm TB khác)
        if (q2.rows.some((r) => ['pl', 'lk'].includes(qtKindOf(r)) && !r.chk.checked)) {
          if (q2.rows.some((r) => qtKindOf(r) === 'lk' && !r.chk.checked) && !q2.rows.some((r) => qtKindOf(r) === 'pl' && !r.chk.checked) && !scanOk)
            await qtWaitClose('thả file quét (DDK + TBXN) vào bảng điền');
          return;
        }
        q = q2;
      }
      const left = q.rows.filter((r) => !r.chk.checked);
      if (left.length && isoAuto() && left.every((r) => qtKindOf(r) === 'iso')) {
        const q3 = await runIso(q);
        if (!q3) return;
        q = q3;
      }
      if (q.rows.some((r) => !r.chk.checked)) {
        const other = q.rows.filter((r) => !r.chk.checked && qtKindOf(r) !== 'iso');
        if (isoAuto() && other.length) {
          step('Kết ISO').skip(`còn tác vụ chưa tích “Đã xử lý”: ${other.map((r) => r.name).join(', ')} – tiện ích chưa Kết ISO`);
          tailOk = '<div class="hint">Bạn xem các tác vụ chưa tích “Đã xử lý”. Chỉ còn thiếu <b>Kết ISO</b> là 🤖 tự Kết ISO, chuyển bước “Trả kết quả” rồi Trả hồ sơ.</div>';
          tailNeed = '-';
          if (other.every((r) => qtKindOf(r) === 'lk') && !scanOk) await qtWaitClose('thả file quét (DDK + TBXN) vào bảng điền');
          return;
        }
        step('Kết ISO').skip('chưa tích đủ “Đã xử lý” (Kết ISO bạn tự làm) – tích đủ 5 tác vụ là tiện ích tự chuyển bước Trả kết quả');
        tailOk =
          '<div class="hint">Bạn làm <b>Kết ISO</b> (Thực hiện, Đồng ý) và tích “Đã xử lý”. Tích đủ 5 tác vụ là 🤖 Tự động hết tự <b>Chuyển tiếp</b> bước “Trả kết quả” rồi <b>Trả hồ sơ</b>.' +
          (AUTO() ? ' Muốn 🤖 tự Kết ISO: tích ô <b>Tự Kết ISO</b> ở tab Biên nhận (mục 🤖 Tự động hết – chuyển tiếp).' : '') +
          '</div>';
        tailNeed = '-';
        if (!isoAuto() && q.rows.filter((r) => !r.chk.checked).every((r) => qtKindOf(r) === 'iso')) await qtWaitClose('Kết ISO');
        return;
      }
      return runForward(q);
    };
    // Kết ISO (bạn bật “Tự Kết ISO”, 23/11): Quy trình chỉ còn thiếu “Kết ISO” → Xử lý tác vụ → cửa sổ “Kết ISO” → Thực hiện → Đồng ý (1 lần)
    // → trang tích “Đã xử lý” (chưa tích thì tiện ích tích) → đọc lại Quy trình: trả về Quy trình mới; null = dừng chờ bạn (Chạy thử / chưa tích được).
    // Hộp hỏi lạ / trang báo lỗi / bạn đang thao tác → dừng, kêu ting. Đã bấm Thực hiện mà chưa xác nhận (trang tải lại…) → không bấm lại.
    const runIso = async (q) => {
      cur = step('Hồ sơ của Quy trình (Kết ISO)');
      const { x, so } = await dossierTb(false);
      stage3 = true;
      if (x !== tb) setTb(x);
      title = `TB ${tb.tb} – Kết ISO`;
      const s = S.stage[String(tb.tb)] || {};
      if (s.hoan) throw ask(`TB ${tb.tb} đang tạm hoãn – tiện ích không Kết ISO`, actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`));
      cur.ok(`${so} – TB ${tb.tb}`);
      const iso = q.rows.find((r) => qtKindOf(r) === 'iso');
      if (!iso || !iso.chk) throw new Error('không thấy tác vụ “Kết ISO” trong Quy trình');
      if (iso.chk.checked) return q;
      if (pending(s, 'iso'))
        throw ask(`đã bấm “Thực hiện” Kết ISO lúc ${fmtTime(s.fwd.at)} mà “Kết ISO” chưa tích “Đã xử lý” – kiểm tra trên VBDLIS; chưa Kết ISO thì bấm nút dưới`, redoBtn());
      if (S.opts.thuThucThi) {
        if (iso.link) ringFor(iso.link, 60000);
        step('Kết ISO').ok('Chạy thử: đã tô vàng – bạn tự bấm Xử lý tác vụ → Thực hiện → Đồng ý');
        if (AUTO()) setHold(tb.tb, { kind: 'tt', k: 'iso', btn: '^(thuc hien|dong y)$' }); // 🤖 chờ bạn (không tự làm tiếp / tạm hoãn)
        tailNeed = '-';
        return null;
      }
      cur = step('Mở “Kết ISO” (Xử lý tác vụ)');
      if (!iso.link) throw new Error('không thấy “Xử lý tác vụ” của Kết ISO');
      S.isoClickAt = Date.now(); // cửa sổ Kết ISO sắp mở là của chuỗi (bộ theo dõi không chạy mẫu trên lần mở này)
      clickPage(iso.link);
      let im = null;
      for (let i = 0; i < 50 && !im; i++) {
        stopIf();
        await sleep(400);
        im = isoModal();
      }
      if (im) S.isoClickAt = 0;
      if (!im) {
        log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): cửa sổ: ${modalDiag()}; khối có nút Thực hiện: ${traDiag()}`) });
        needYou('Chưa thấy cửa sổ Kết ISO – bạn xem', 'bad');
        throw new Error('bấm “Xử lý tác vụ” rồi mà chưa nhận ra cửa sổ “Kết ISO” – bạn tự Kết ISO (Thực hiện → Đồng ý), 🤖 làm tiếp; chụp dòng “Để báo lỗi” gửi người hỗ trợ');
      }
      cur.ok();
      // 🤖 (bạn chọn 23/11): ô / nút bạn tích thêm trong mẫu cửa sổ Kết ISO (tab Trường) – làm trước “Thực hiện”
      {
        const ex = await tplChainExtras({ base: '', decide: ['thuc hien'], fields: true, step });
        if (ex) throw ask(`${ex} – tiện ích không bấm “Thực hiện” Kết ISO; bạn xem rồi bấm “▶ Chạy cả TB”`, '');
      }
      cur = step('Bấm “Thực hiện”, “Đồng ý” (Kết ISO)');
      const go = [...im.querySelectorAll('button, a, input[type="button"], input[type="submit"]')].find((b) => shownEl(b) && btnText(b) === 'thuc hien');
      if (!go) throw new Error('không thấy nút “Thực hiện” của cửa sổ Kết ISO');
      await setFwd(tb.tb, 'iso'); // ghi dấu trước khi bấm
      stopIf();
      // kiểm tra ngay trước khi bấm: đúng cửa sổ “Kết ISO”, không có hộp hỏi, bạn không vừa thao tác
      if (isoModal() !== im || pageDialog() || Date.now() - USER.at < 2000) {
        await setMark(tb.tb, 'fwd', null);
        throw ask('cửa sổ Kết ISO vừa đổi / bạn đang thao tác – bấm “▶ Chạy cả TB” lại', '');
      }
      const t0 = Date.now();
      clickPage(go);
      let good = null;
      let closedAt = 0;
      let confirmed = 0;
      let lk3 = 0; // đã bấm Đồng ý hộp cảnh báo “liên kết 3 khối” (24/11)
      let taught = null; // hộp bạn dạy đã được bấm sau Thực hiện (không phải câu báo thành công)
      for (;;) {
        stopIf();
        const ts = toastsSince(t0);
        const bad = ts.find(toastBad);
        if (bad) {
          needYou('Kết ISO chưa xong – bạn xem', 'bad');
          throw ask(`bấm “Thực hiện” Kết ISO, trang báo “${bad.raw.slice(0, 150)}”`, redoBtn());
        }
        const dd = await dlgNow(ISO_DONE_DIALOGS, true);
        if (dd && dd.answered) good = good || { raw: dd.title || 'Kết ISO thành công' };
        else if (dd) {
          // cảnh báo “hồ sơ chưa đáp ứng liên kết 3 khối liên kết không gian … tiếp tục thực hiện kết ISO?” → Đồng ý, làm tiếp (1 lần) – trước hộp
          // xác nhận (hộp này cũng có chữ “bạn có thật sự muốn … thực hiện kết ISO”)
          if (!lk3) {
            const a = await dlgNow(LK3_DIALOGS, true);
            if (a && a.answered) {
              lk3 = 1;
              continue;
            }
          }
          const canAsk = !confirmed && Date.now() - t0 < 15000 * slowK();
          const d = await dlgNow(canAsk ? ISO_DIALOGS : [], !canAsk);
          if (d && d.answered) confirmed++;
          else if (d) {
            // hộp bạn đã dạy ở tab Trường → bấm theo mẫu (hộp LỖI đã dạy: bước này chưa xong – TB tạm hoãn)
            const tl = canAsk ? null : await dlgNow([]);
            if (tl && tl.answered) {
              // (soát 24/11) hộp bạn dạy không phải câu báo thành công – trừ khi chữ hộp ghi rõ “thành công”; không thì bước này chưa chắc xong
              const tt = norm(`${tl.title || ''} ${tl.text || ''}`);
              if (/thanh cong/.test(tt) && !/(khong|chua) thanh cong/.test(tt)) good = good || { raw: tl.title || tl.text || 'thành công' };
              else taught = taught || tl;
              continue;
            }
            needYou('Trang hỏi – bạn xem', 'bad');
            throw ask(`trang hỏi / báo “${(d.text || d.title || '').slice(0, 150)}” – tiện ích dừng`, redoBtn());
          }
        }
        good = good || ts.find(toastOk) || null;
        if (!(im.isConnected && shownEl(im))) {
          if (!closedAt) closedAt = Date.now();
          if (good) break;
          if (USER.at > t0) {
            needYou('Kết ISO – bạn kiểm tra', 'bad');
            throw ask('cửa sổ Kết ISO đóng lúc bạn đang bấm / gõ trên trang (chưa thấy câu báo thành công) – bạn kiểm tra trên VBDLIS', redoBtn());
          }
          if (Date.now() - closedAt > 2000) break;
        }
        if (Date.now() - t0 > 60000 * slowK()) throw new Error('60 giây cửa sổ Kết ISO chưa đóng – xem lại trang');
        await sleep(300);
      }
      if (!good && taught) throw new Error(`trang báo “${String(taught.title || taught.text || '').slice(0, 60)}” sau khi bấm Thực hiện Kết ISO – đã bấm theo hộp bạn dạy, chưa thấy báo thành công`);
      cur.ok(good ? `trang báo “${good.raw.slice(0, 80)}”` : `cửa sổ Kết ISO đã đóng sau khi bấm ${confirmed ? 'Đồng ý' : 'Thực hiện'}, không có câu báo lỗi`);
      // trang mở lại Quy trình và tự tích “Đã xử lý” của Kết ISO; chưa tích thì tiện ích tích
      cur = step('Tích “Đã xử lý” – Kết ISO');
      const tk = await tickTask(iso.code || 'KetISO', alive);
      if (!/da tich|duoc tich/.test(norm(tk))) {
        cur.skip(tk);
        needYou('Kết ISO – bạn xem', 'bad');
        tailOk = '<div class="hint">Kết ISO đã bấm xong. Bạn tích “Đã xử lý” của Kết ISO (Quy trình xử lý) rồi bấm “▶ Chạy cả TB” – tiện ích không Kết ISO lại.</div>';
        tailNeed = '-';
        return null;
      }
      cur.ok(tk);
      await setMark(tb.tb, 'fwd', null);
      const q2 = await qtSettled(alive);
      if (!q2 || q2.v !== q.v) throw ask('Kết ISO xong mà Quy trình xử lý chưa hiện lại đúng – bạn xem trên VBDLIS, rồi bấm “▶ Chạy cả TB”', '');
      return q2;
    };
    // chuyển tiếp: Quy trình → bước nhận → tài khoản
    const FWD = {
      tn: { k: 'cv', who: 'chuyên viên', acc: () => S.opts.ctCV },
      cv: { k: 'ld', who: 'lãnh đạo', acc: () => S.opts.ctLD },
      kq: { k: 'trk', who: 'bước Trả kết quả', acc: () => S.opts.ctCV },
    };
    const STEP_OF = { cv: /chuyen vien/, ld: /lanh dao/, trk: /tra ket qua/ };
    const WHO_OF = { cv: 'chuyên viên', ld: 'lãnh đạo', trk: 'bước Trả kết quả' };
    const accOf = (k) => String((k === 'ld' ? S.opts.ctLD : S.opts.ctCV) || '').trim();
    const noAccMsg = (k) =>
      `chưa đặt tài khoản ${k === 'ld' ? 'lãnh đạo' : 'của bạn (chuyên viên)'} nhận hồ sơ – điền ở tab Biên nhận (mục “Tự động hết – chuyển tiếp”) rồi bấm “▶ Chạy cả TB”`;
    // tài khoản của bạn (chuyển chuyên viên / Trả kết quả) phải đúng tài khoản đang đăng nhập – thấy rõ tài khoản đăng nhập thì so
    const checkMe = (k, acc) => {
      if (k === 'ld') return;
      const me = loginName();
      if (me && me !== accNorm(acc)) throw ask(`tài khoản đang đăng nhập là “${me}”, khác tài khoản chuyên viên trong cài đặt (“${acc}”) – sửa ở tab Biên nhận`, '');
    };
    // Quy trình 'tn' / 'cv' / 'kq' (đã tích đủ): (cv: nhập đơn nếu chưa) → tích “Đã xử lý” → Chuyển tiếp → chọn đúng người → Thực thi
    const runForward = async (q) => {
      const v = q.v;
      const F = FWD[v];
      if (v === 'kq') stage3 = true; // hồ sơ lãnh đạo trả về – không đổi TB đang chọn
      cur = step('Hồ sơ của Quy trình xử lý');
      const { x, so } = await dossierTb(false);
      // đơn vừa nhập trong lần chạy này theo TB đoán được (chưa chắc hồ sơ) mà hồ sơ là của TB khác → không chuyển tiếp (soát 1.21.7)
      if (donGuess && x !== donGuess)
        throw ask(`hồ sơ đang mở là của TB ${x.tb} nhưng đơn vừa nhập theo TB ${donGuess.tb} (chưa chắc hồ sơ) – tiện ích không chuyển tiếp, bạn kiểm tra đơn trên VBDLIS`, '');
      if (x !== tb) setTb(x);
      title = `TB ${tb.tb} – Quy trình xử lý: chuyển tiếp ${F.who}`;
      let s = S.stage[String(tb.tb)] || {};
      if (s.hoan) throw ask(`TB ${tb.tb} đang tạm hoãn – tiện ích không chuyển tiếp`, actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`));
      // mỗi bước chỉ bấm Thực thi MỘT lần: đã bấm mà Quy trình vẫn ở bước cũ → không bấm lại, nhờ bạn xem
      if (pending(s, F.k)) {
        // Quy trình vẫn ở bước cũ = chưa chuyển lãnh đạo: dấu đang chuyển ghi 'old' (không hiện ◐); trong 30 phút vẫn không bấm lại
        if (F.k === 'ld' && !s.fwd.bad) await setMark(tb.tb, 'fwd', { ...s.fwd, bad: 'old' });
        throw ask(
          `${s.fwd.tt ? 'lúc chờ bạn tự bấm “Thực thi” (Chạy thử) chuyển' : 'đã bấm “Thực thi” chuyển'} ${F.who} lúc ${fmtTime(s.fwd.at)} trang tải lại, mà Quy trình vẫn ở bước cũ – có thể CHƯA chuyển. Kiểm tra trên VBDLIS; chưa chuyển thì bấm nút dưới để tiện ích làm lại`,
          redoBtn()
        );
      }
      if ((v === 'tn' && s.cv) || (v === 'cv' && s.ld) || (v === 'kq' && s.trk))
        throw ask(`TB ${tb.tb} đã ghi nhận chuyển ${F.who} lúc ${fmtTime(s[F.k])} mà Quy trình vẫn hiện bước cũ – bạn kiểm tra trên VBDLIS`, redoBtn(F.k));
      if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'auto');
      if (v === 'cv' && !s.cv) markStage(tb.tb, 'cv', 'suy'); // Quy trình “Nhập đăng ký” hiện ra = hồ sơ đã sang chuyên viên
      if (v === 'kq') {
        // 5 tác vụ = lãnh đạo đã trả về cho bạn – mốc riêng 'kq' (không coi là “vừa chuyển lãnh đạo”)
        stage3 = true;
        if (!s.kq) await setMark(tb.tb, 'kq', Date.now());
        if (!(S.stage[String(tb.tb)] || {}).ld) markStage(tb.tb, 'ld', 'kq');
      }
      cur.ok(`${so} – TB ${tb.tb}`);
      // (cv) đơn chưa xong → “Xử lý tác vụ” của Nhập đăng ký → nhập đơn (Lưu thông tin đăng ký, Hoàn tất, Đóng)
      if (v === 'cv') {
        s = S.stage[String(tb.tb)] || {};
        const nhap = q.rows.find((r) => qtKindOf(r) === 'nhap');
        if (!s.don && nhap.chk.checked) {
          markStage(tb.tb, 'don', 'qt');
          step('Nhập đơn đăng ký').skip('ô “Đã xử lý” của Nhập đăng ký đã tích – coi như đơn đã xong');
        } else if (!s.don) {
          cur = step('Mở “Nhập đăng ký” (Xử lý tác vụ)');
          if (!nhap.link) throw new Error('không thấy nút “Xử lý tác vụ” của Nhập đăng ký');
          clickPage(nhap.link);
          let open = false;
          for (let i = 0; i < 50 && !open; i++) {
            stopIf();
            await sleep(400);
            const tp = await topNow();
            open = !!tp && DON_MODAL.test(modalKey(tp));
          }
          if (!open) throw new Error('bấm “Xử lý tác vụ” rồi mà chưa thấy cửa sổ “Nhập đơn đăng ký”');
          cur.ok();
          const mine = tb;
          await identifyDon(true); // số biên nhận của hồ sơ đã khớp đúng TB này (dossierTb)
          if (tb !== mine) throw ask(`Mã đơn của cửa sổ đơn là của TB ${tb.tb}, khác hồ sơ đang mở (TB ${mine.tb}) – tiện ích dừng`, '');
          gateTb();
          const done = await runDon(true);
          if (!done || !(S.stage[String(tb.tb)] || {}).don) return; // đơn dừng giữa chừng (lệch, thiếu…) – lý do đã ghi ở trên
          if (!qtModal()) return; // chưa về cửa sổ Quy trình xử lý – lời nhắc đã ghi ở trên
        }
      }
      if (!AUTO()) {
        // chưa bật Tự động hết: chỉ tô vàng, bạn tự tích và chuyển tiếp
        cur = step('Tích “Đã xử lý”, “Chuyển tiếp”');
        const m = qtModal();
        const marks = qtRows(m)
          .filter((r) => r.chk && !r.chk.checked)
          .map((r) => r.chk);
        const fb = m && [...m.querySelectorAll('button, a')].find((b) => shownEl(b) && btnText(b) === 'chuyen tiep');
        if (fb) marks.push(fb);
        marks.forEach((el) => ringScan(el, true));
        setTimeout(() => marks.forEach((el) => ringScan(el, false)), 60000);
        cur.ok('đã tô vàng – bạn tự tích “Đã xử lý” rồi bấm “Chuyển tiếp”; ở cửa sổ chọn người bấm “▶ Chạy cả TB” để tiện ích chọn sẵn đúng người');
        tailOk = '<div class="hint">Bật <b>🤖 Tự động</b> để tiện ích tự tích “Đã xử lý” và chuyển tiếp đúng người.</div>';
        tailNeed = '-';
        return;
      }
      const acc = accOf(F.k);
      if (!acc) throw ask(noAccMsg(F.k), '');
      checkMe(F.k, acc);
      // tích “Đã xử lý” (tn: Tiếp nhận hồ sơ; cv: Nhập đăng ký + Giấy tờ đính kèm; kq: bạn đã tích đủ) – trang có thể tự tích sau Hoàn tất
      if (v !== 'kq') {
        if (v === 'cv') await sleep(1500);
        const qa = await qtSettled(alive);
        if (!qa || qa.v !== v) throw new Error('cửa sổ Quy trình xử lý vừa đổi – bấm “▶ Chạy cả TB” lại');
        for (const r0 of qa.rows) {
          cur = step(`Tích “Đã xử lý” – ${r0.name}`);
          cur.ok(await tickQt(r0));
        }
      }
      const q3 = await qtSettled(alive);
      if (!q3 || q3.v !== v) throw new Error('cửa sổ Quy trình xử lý vừa đổi – bấm “▶ Chạy cả TB” lại');
      const left = q3.rows.filter((r) => !r.chk.checked);
      if (left.length) throw new Error(`còn tác vụ chưa tích “Đã xử lý”: ${left.map((r) => r.name).join(', ')}`);
      // Chuyển tiếp – Quy trình phải nằm trên cùng (không bị cửa sổ đơn / cửa sổ khác che)
      cur = step('Bấm “Chuyển tiếp”');
      const tp = await topNow();
      if (!tp || !/^quy trinh xu ly\b/.test(modalKey(tp))) throw new Error(`cửa sổ trên cùng là ${tp ? tp.name : 'màn hình chính'}, không phải Quy trình xử lý`);
      const fb = [...q3.m.querySelectorAll('button, a')].find((b) => shownEl(b) && btnText(b) === 'chuyen tiep');
      if (!fb) throw new Error('không thấy nút “Chuyển tiếp” của cửa sổ Quy trình xử lý');
      if (Date.now() - USER.at < 2000) throw ask('bạn vừa bấm / gõ trên trang – tiện ích không bấm “Chuyển tiếp”; bấm “▶ Chạy cả TB” khi xong', '');
      const t0 = Date.now();
      clickPage(fb);
      let ch = null;
      for (let i = 0; i < 60 && !ch; i++) {
        stopIf();
        await sleep(400);
        ch = chooserModal();
        if (ch) break;
        // trang chuyển luôn mà không hiện cửa sổ chọn người → không kiểm được người nhận → dừng, báo bạn
        if (toastsSince(t0).some(toastOk)) {
          needYou('Đã chuyển tiếp – bạn kiểm tra', 'bad');
          throw ask('bấm “Chuyển tiếp” xong trang báo thành công luôn, KHÔNG hiện cửa sổ chọn người – tiện ích không kiểm được người nhận, bạn kiểm tra trên VBDLIS', '');
        }
        const d = await dlgNow(FWD_DIALOGS);
        if (d && !d.answered) {
          needYou('Trang báo – bạn xem', 'bad');
          throw ask(`bấm “Chuyển tiếp”, trang báo: “${d.text.slice(0, 200)}” – tiện ích dừng`, '');
        }
      }
      if (!ch) throw new Error('bấm “Chuyển tiếp” rồi mà chưa thấy cửa sổ “Chọn người xử lý tác vụ tiếp theo”');
      cur.ok();
      return runChooser(F.k);
    };
    // sau khi bấm Thực thi: cửa sổ chọn người đóng, không có báo lỗi → xong. sure: có câu báo thành công (toast) – không có thì
    // kiểm lại ở bước sau (mở lại Quy trình xem đã sang bước mới chưa)
    const waitThucThi = async (m, t0) => {
      let closedAt = 0;
      for (;;) {
        stopIf();
        const ts = toastsSince(t0);
        const bad = ts.find(toastBad);
        if (bad) return { ok: false, kind: 'err', why: `trang báo “${bad.raw.slice(0, 150)}”` };
        const d = await dlgNow(FWD_DIALOGS);
        if (d && !d.answered) return { ok: false, kind: 'dlg', why: `trang hỏi / báo “${d.text.slice(0, 150)}”` };
        const good = ts.find(toastOk);
        if (!(m.isConnected && shownEl(m))) {
          if (!closedAt) closedAt = Date.now();
          if (good) return { ok: true, sure: true, say: good.raw };
          // cửa sổ đóng mà chưa có câu báo, lúc đó bạn có bấm / gõ trên trang → không biết ai đóng → không coi là đã chuyển
          if (USER.at > t0) return { ok: false, kind: 'user', why: 'cửa sổ chọn người đóng lúc bạn đang bấm / gõ trên trang (chưa thấy câu báo thành công)' };
          if (Date.now() - closedAt > 2000) return { ok: true, sure: false, say: '' };
        }
        if (Date.now() - t0 > 60000 * slowK()) return { ok: false, kind: 'slow', why: '60 giây cửa sổ chọn người chưa đóng' };
        await sleep(300);
      }
    };
    // cửa sổ “Chọn người xử lý tác vụ tiếp theo”: đúng bước (… (Tiếp theo)), đúng hồ sơ, chọn ĐÚNG tài khoản → Thực thi.
    // k: 'cv' | 'ld' | 'trk' ('' = theo ô bước nhận – khi bấm ▶ lúc cửa sổ này đang mở)
    const runChooser = async (k0, byTpl) => {
      const m = chooserModal();
      if (!m) throw new Error('không thấy cửa sổ “Chọn người xử lý tác vụ tiếp theo”');
      cur = step('Chọn người nhận');
      const info0 = await chooserSettled(m, alive);
      if (!info0) throw new Error('danh sách người nhận chưa tải xong (hoặc còn đang thay đổi)');
      const st = norm(info0.step);
      const k = k0 || Object.keys(STEP_OF).find((key) => STEP_OF[key].test(st)) || '';
      if (!k || !STEP_OF[k].test(st) || !/\(tiep theo\)/.test(st) || /tra ve|\(truoc\)/.test(st))
        throw ask(`ô bước nhận đang là “${info0.step || '(trống)'}”${k ? `, không phải bước ${WHO_OF[k]} (Tiếp theo)` : ''} – tiện ích không chuyển`, '');
      const { x } = await dossierTb(false);
      // bước Trả kết quả, hoặc cửa sổ bạn mở cho hồ sơ khác TB đang chọn → không đổi TB đang chọn
      if (k === 'trk' || (!k0 && String(x.tb) !== String(recvAtStart))) stage3 = true;
      if (x !== tb) setTb(x);
      const s = S.stage[String(tb.tb)] || {};
      if (pending(s, k)) {
        // cửa sổ chọn người lãnh đạo lại mở cho hồ sơ này = chưa chuyển: dấu đang chuyển ghi 'old' (không hiện ◐)
        if (k === 'ld' && !s.fwd.bad) await setMark(tb.tb, 'fwd', { ...s.fwd, bad: 'old' });
        throw ask(
          `${s.fwd.tt ? 'lúc chờ bạn tự bấm “Thực thi” (Chạy thử) chuyển' : 'đã bấm “Thực thi” chuyển'} ${WHO_OF[k]} lúc ${fmtTime(s.fwd.at)} mà chưa xác nhận – kiểm tra trên VBDLIS; chưa chuyển thì bấm nút dưới`,
          redoBtn()
        );
      }
      const acc = accOf(k);
      if (!acc) throw ask(noAccMsg(k), '');
      checkMe(k, acc);
      if (!k0) {
        // cửa sổ mở sẵn: bạn đang chọn người KHÁC tài khoản trong cài đặt → không đổi người, không bấm Thực thi
        const mk0 = markedRows(info0.rows);
        if (mk0.length === 1 && accNorm(mk0[0].acc) !== accNorm(acc))
          throw ask(`trong cửa sổ đang chọn “${mk0[0].acc}”, khác tài khoản ${WHO_OF[k]} trong cài đặt (“${acc}”) – tiện ích không đổi người, không bấm Thực thi`, '');
      }
      // 🤖 sẽ tự bấm Thực thi (bạn chọn 23/11): trước đó điền thêm ô / bấm thêm nút bạn tích trong mẫu cửa sổ này (tab Trường) – SAU các
      // kiểm tra trên (đọc lúc chưa đụng gì); đọc lại: bước nhận phải giữ nguyên, không có người KHÁC được chọn
      if (AUTO() && !S.opts.thuThucThi && (k0 || byTpl)) {
        const ex = await tplChainExtras({ base: '', decide: ['thuc thi'], fields: true, step });
        if (ex) throw ask(`${ex} – tiện ích không bấm Thực thi; bạn xem rồi bấm “▶ Chạy cả TB”`, '');
        if (!(m.isConnected && shownEl(m))) throw new Error('cửa sổ chọn người vừa đóng sau khi làm theo mẫu tab Trường');
        const info1 = await chooserSettled(m, alive);
        if (!info1) throw new Error('danh sách người nhận chưa tải xong (hoặc còn đang thay đổi)');
        if (norm(info1.step) !== st) throw ask(`mẫu tab Trường vừa đổi ô bước nhận thành “${info1.step}” – tiện ích không bấm Thực thi; bạn xem rồi bấm “▶ Chạy cả TB”`, '');
        const mk1 = markedRows(info1.rows);
        if (!k0 && mk1.length === 1 && accNorm(mk1[0].acc) !== accNorm(acc))
          throw ask(`trong cửa sổ đang chọn “${mk1[0].acc}”, khác tài khoản ${WHO_OF[k]} trong cài đặt (“${acc}”) – tiện ích không đổi người, không bấm Thực thi`, '');
      }
      const p = await pickAccount(m, acc, alive);
      if (!p.ok) {
        if (p.diag) {
          log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): ${p.diag}`) });
          show();
        }
        needYou('Chọn người nhận – bạn xem', 'bad');
        throw ask(`${p.why} – bạn tự chọn đúng người (${acc}) rồi bấm “Thực thi”`, '');
      }
      cur.ok(`${p.row.acc} – ${p.row.name}${p.row.unit ? ' – ' + p.row.unit : ''} · bước “${p.step}”`);
      const go = [...m.querySelectorAll('button, a')].find((b) => shownEl(b) && (b.id === 'btnExecuteCommand' || btnText(b) === 'thuc thi'));
      if (!go) throw new Error('không thấy nút “Thực thi”');
      // chưa bật Tự động hết / đang “Chạy thử” / cửa sổ này mở sẵn lúc bạn bấm ▶ (không qua bước Chuyển tiếp của tiện ích)
      // → chọn sẵn đúng người, tô vàng Thực thi, bạn tự bấm (bấm xong tiện ích làm tiếp)
      if (!AUTO() || S.opts.thuThucThi || (!k0 && !byTpl)) {
        ringFor(go, 60000);
        cur = step('Nút “Thực thi”');
        cur.ok(
          `đã chọn đúng người, tô vàng – bạn kiểm tra rồi tự bấm${
            AUTO()
              ? S.opts.thuThucThi
                ? ' (đang bật “Chạy thử”)'
                : ' (cửa sổ chọn người mở sẵn – muốn 🤖 tự bấm Thực thi ở đây thì tích nút “Thực thi” trong mẫu cửa sổ này ở tab Trường)'
              : ''
          }`
        );
        if (AUTO()) setHold(tb.tb, { kind: 'tt', k, btn: '^thuc thi$', st });
        tailOk = `<div class="hint">Đã chọn sẵn <b>${esc(p.row.acc)}</b> (bước “${esc(p.step)}”). Bạn kiểm tra rồi tự bấm <b>Thực thi</b>; bấm xong tiện ích tự làm tiếp.</div>`;
        tailNeed = 'Bấm “Thực thi”';
        return;
      }
      cur = step(`Bấm “Thực thi” – chuyển cho ${p.row.acc}`);
      await setFwd(tb.tb, k); // ghi dấu “đang chuyển” TRƯỚC (trang có thể tải lại ngay sau khi bấm)
      stopIf();
      const t0 = Date.now();
      const why = chooserFinalClick(m, acc, st); // kiểm tra lần cuối + bấm, không có await ở giữa
      if (why) {
        await setMark(tb.tb, 'fwd', null);
        needYou('Chưa bấm Thực thi – bạn xem', 'bad');
        throw ask(`không bấm “Thực thi”: ${why} – bạn xem lại rồi bấm “▶ Chạy cả TB”`, '');
      }
      const r = await waitThucThi(m, t0);
      if (!r.ok) {
        // giữ dấu “đang chuyển” (không bấm lại) + ghi lý do: từ giờ không suy ra “đã chuyển” từ dấu này nữa
        await setMark(tb.tb, 'fwd', { ...((S.stage[String(tb.tb)] || {}).fwd || { k, at: t0 }), bad: r.kind || 'err' });
        needYou('Chuyển tiếp chưa xong – bạn xem', 'bad');
        throw ask(`đã bấm “Thực thi” nhưng ${r.why} – bạn xem lại trang rồi bấm một nút dưới`, redoBtn() + (k === 'ld' ? ' ' + ldDoneBtn() : ''));
      }
      if (r.sure) markStage(tb.tb, k, 'auto');
      cur.ok(r.sure ? `trang báo “${r.say.slice(0, 80)}”` : 'cửa sổ chọn người đã đóng (chưa thấy câu báo thành công – kiểm lại ở bước sau)');
      if (k === 'ld') {
        if (!r.sure) return verifyLd();
        setEvt(`✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: đã chuyển lãnh đạo (${esc(p.row.acc)}) – <b>◐ Đã nhập nhưng chưa xong</b>.`);
        return goNext(false);
      }
      // cv: về màn hình hồ sơ (ảnh 1); trk: về danh sách hồ sơ thụ lý (ảnh 8) → bấm lại dòng hồ sơ → “Xử lý hồ sơ” lần nữa
      if (k === 'trk') stage3 = true;
      return reopenAfterFwd();
    };
    // sau Thực thi (chuyển chuyên viên / bước Trả kết quả): chờ trang về màn hình hồ sơ hoặc danh sách hồ sơ thụ lý,
    // (danh sách: bấm lại dòng hồ sơ – bạn yêu cầu) → đúng hồ sơ → “Xử lý hồ sơ”. Trang tải lại → bảng điền mở lại tự làm tiếp
    const reopenAfterFwd = async () => {
      cur = step('Mở lại hồ sơ');
      const t0 = Date.now();
      const want = soKey(tb.soBienNhan);
      let tries = 0;
      let diag = false;
      let why = '';
      let shownWhy = '';
      let ghost = 0;
      while (Date.now() - t0 < 45000 * slowK()) {
        stopIf();
        await sleep(500);
        // đang chờ gì → hiện ngay ở dòng “Mở lại hồ sơ” (chụp bảng điền là thấy)
        if (why && why !== shownWhy) {
          shownWhy = why;
          cur.wait(why);
        }
        // 12 giây chưa bấm được vào hồ sơ → 1 dòng “Để báo lỗi” (trang thật khác chỗ nào)
        if (!diag && Date.now() - t0 > 12000) {
          diag = true;
          log.push({
            icon: '•',
            cls: 'muted',
            html: esc(
              `Để báo lỗi (gửi người hỗ trợ): mở lại hồ sơ ${tb.soBienNhan} – ${why || 'chưa rõ'}; ${listDiag()}; cửa sổ: ${modalDiag()}; đang tải: ${
                listLoading() ? 'có' : 'không'
              }; số đọc được ở các dòng: ${
                listDataRows()
                  .slice(0, 3)
                  .map((r) => rowSo(r) || '(không đọc được)')
                  .join(' | ') || '(không có dòng)'
              }; chữ lạ trong dòng 1: ${(() => {
                const r1 = listDataRows()[0];
                const odd = r1 ? [...new Set((r1.textContent || '').match(/[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF\s]/gu) || [])] : [];
                return odd.length ? odd.slice(0, 8).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ') : 'không';
              })()}`
            ),
          });
          show();
        }
        const top = await topNow();
        if (top) {
          // bộ điền báo có cửa sổ mở: trên trang thật sự còn cửa sổ (hoặc cửa sổ ở khung con) → chờ;
          // không thấy cửa sổ thật nào (cửa sổ ma) 3 lần liền → bỏ qua
          if (realModals().length || (top.frame && top.frame !== location.href) || ++ghost < 3) {
            why = `chờ ${top.name || 'cửa sổ'} đóng`;
            continue;
          }
        } else ghost = 0;
        // Danh sách hồ sơ thụ lý (bạn yêu cầu: chuyển tiếp xong ra danh sách thì BẤM VÀO HỒ SƠ rồi mới bấm Xử lý hồ sơ)
        if (onListPage() || (sbnSearch() && listDataRows().length)) {
          // danh sách đang lọc sẵn đúng hồ sơ này (ô tìm còn số biên nhận, danh sách vừa tải lại sau Thực thi) → bấm vào hồ sơ luôn
          const exact = () => (listBusy() ? [] : exactRows(want));
          const e1 = exact();
          if (e1.length === 1) {
            await sleep(800);
            const e2 = exact();
            if (e2.length === 1 && e2[0] === e1[0]) {
              cur.ok(`hồ sơ ${tb.soBienNhan} có trong danh sách`);
              return openFromList(tb, e2[0]);
            }
          }
          // chưa có → gõ Số biên nhận vào ô tìm → đúng 1 hồ sơ → bấm vào hồ sơ
          tries++;
          S.listRun = true; // đang tìm ở danh sách (■ Dừng lúc này → tạm dừng tìm)
          let r;
          try {
            r = await searchList(tb, alive);
          } finally {
            S.listRun = false;
          }
          if (r.err) throw new Error(r.err);
          if (r.row) {
            cur.ok(`tìm thấy hồ sơ ${tb.soBienNhan}${tries > 1 ? ` (lần tìm thứ ${tries})` : ''}`);
            return openFromList(tb, r.row);
          }
          const dup = exactRows(want).length;
          why =
            dup > 1
              ? `có ${dup} hồ sơ cùng số ${tb.soBienNhan} (ngày tiếp nhận khác nhau – trùng?) – tiện ích không chọn`
              : `tìm ${tries} lần chưa thấy dòng đúng số (${listDataRows().length} dòng có số KH)`;
          await sleep(4500); // chưa ra → 5 giây tìm lại
          continue;
        }
        // màn hình hồ sơ (ảnh 1) – không phải trang danh sách (không có ô tìm số biên nhận)
        if (btnXuLyHoSo() && !sbnSearch()) {
          const m = tbOfSo(await dossierSo());
          if (m.list.length === 1 && m.list[0] === tb) {
            cur.ok();
            return openQt();
          }
          why = 'màn hình hồ sơ đang mở không phải của TB này';
        } else why = `chưa nhận ra trang (trang danh sách: ${onListPage() ? 'có' : 'không'}, ô tìm số biên nhận: ${sbnSearch() ? 'có' : 'không'}, nút Xử lý hồ sơ: ${btnXuLyHoSo() ? 'có' : 'không'})`;
      }
      needYou('Chưa mở lại được hồ sơ – bạn xem', 'bad');
      tbKnown = true; // giữ TB này (🤖 không tự tìm / mở lại cho tới khi bạn bấm ▶)
      throw new Error(`chưa bấm được vào hồ sơ (${why || 'chưa thấy đúng hồ sơ'}) – bạn bấm vào hồ sơ rồi “Xử lý hồ sơ”, Tự động hết làm tiếp (Trả hồ sơ)`);
    };
    // trang Danh sách hồ sơ thụ lý (bạn yêu cầu 22/11, ảnh 15–17): mỗi lần tìm MỘT TB còn chờ (lần lượt): gõ Số biên nhận vào ô tìm, bấm 🔍.
    // Chưa ra kết quả (lãnh đạo chưa trả về…) → thôi, 5 giây sau 🤖 tìm TB kế tiếp. Ra đúng 1 hồ sơ → bấm vào hồ sơ → Xử lý hồ sơ → làm tiếp
    // theo Quy trình (tác vụ 2–3, chờ bạn Kết ISO, chuyển Trả kết quả, Trả hồ sơ / nhập đơn, chuyển lãnh đạo…).
    // manual (▶): danh sách đang lọc còn đúng 1 hồ sơ của dữ liệu → làm luôn hồ sơ đó
    // ở Danh sách hồ sơ thụ lý: bấm vào dòng hồ sơ CHẬM, CHẮC – cuộn tới dòng, chờ, bấm vào ô chữ, chờ trang đánh dấu dòng (lớp selected / active…,
    // dấu ✓, nền đổi màu) tối đa 3 giây; dòng bị vẽ lại thì lấy dòng mới. Trả { row, marked }
    const pickListRow = async (x, row0) => {
      const want = soKey(x.soBienNhan);
      const exactRow = () => exactRows(want)[0] || null;
      let row = row0 && row0.isConnected ? row0 : exactRow();
      if (!row) throw new Error(`không còn thấy dòng hồ sơ ${x.soBienNhan} trong danh sách`);
      if (soKey(rowSo(row)) !== want) throw new Error(`dòng trong danh sách là hồ sơ ${rowSo(row)}, không phải ${x.soBienNhan} – tiện ích không bấm`);
      try {
        row.scrollIntoView({ block: 'center' });
      } catch (e) {}
      await sleep(700);
      // khung “Thông tin hồ sơ” bên phải (trang thật, ảnh 22/11): hiện Số biên nhận của hồ sơ đang chọn
      const panelSo = () => {
        const n = labelDossierNumbers();
        return n.length === 1 ? n[0] : n.length ? '?' : '';
      };
      // trạng thái của dòng (lớp, aria-selected, màu nền / chữ của dòng và 2 ô đầu) – ĐỔI sau cú bấm = trang đã nhận cú bấm.
      // (trang thật: dòng được chọn thêm lớp “selected”, nền xanh đậm; ô đầu luôn có ▶ nên không dùng biểu tượng làm dấu chọn)
      const rowState = (r) => {
        if (!r || !r.isConnected) return '';
        const cs = getComputedStyle(r);
        const cells = [...r.children].slice(0, 2).map((c) => {
          const s = getComputedStyle(c);
          return s.backgroundColor + '/' + s.color;
        });
        return [r.className, r.getAttribute('aria-selected') || '', cs.backgroundColor, cs.color, ...cells].join('|');
      };
      const p0 = panelSo(); // khung bên phải TRƯỚC khi bấm (số cũ còn sót – kể cả đúng số này – không tính là bằng chứng)
      // dòng ĐÃ được chọn sẵn (lớp selected) và khung bên phải không hiện hồ sơ khác → không bấm nữa (bấm lại có thể bỏ chọn)
      if (rowSelected(row) && !(p0 && p0 !== '?' && soKey(p0) !== want)) {
        S.listPick = { so: x.soBienNhan, at: Date.now() };
        const n0 = listDataRows().filter((r) => soKey(rowSo(r)) !== want).length + 1;
        return { row, marked: true, panOk: !!p0 && p0 !== '?' && soKey(p0) === want, n: n0, already: true };
      }
      const s0 = rowState(row);
      let changed = false;
      let pan = '';
      // bấm ô chữ; trang chưa nhận (dòng không đổi, khung bên phải không đổi) → bấm ô đầu dòng → bấm cả dòng
      for (const how of ['plain', 'first', 'row']) {
        clickRowCell(row, how);
        await waitUntil(
          () => {
            if (!row.isConnected) {
              const r2 = exactRow();
              if (r2) row = r2;
            }
            changed = rowState(row) !== s0;
            pan = panelSo();
            return changed || (!!pan && pan !== '?' && pan !== p0);
          },
          (how === 'plain' ? 3500 : 2500) * slowK(),
          alive
        );
        if (changed || (pan && pan !== '?' && pan !== p0)) break;
      }
      // khung bên phải ĐỔI sang hồ sơ khác sau cú bấm → chọn nhầm
      if (pan && pan !== '?' && pan !== p0 && soKey(pan) !== want) {
        const e = new Error(`đã bấm vào hồ sơ ${x.soBienNhan} mà khung “Thông tin hồ sơ” hiện hồ sơ ${pan} – tiện ích không bấm Xử lý hồ sơ`);
        e.repick = true;
        throw e;
      }
      // bằng chứng cú bấm đã ăn: dòng đổi, hoặc khung bên phải đổi sang đúng số này (khung cũ còn sót đúng số không tính)
      const marked = changed;
      const panOk = !!pan && pan !== '?' && soKey(pan) === want && (pan !== p0 || changed);
      const others = listDataRows().filter((r) => soKey(rowSo(r)) !== want); // dòng của hồ sơ KHÁC (bản lặp của hồ sơ này không tính)
      const n = others.length + 1;
      const othersMarked = others.some(rowSelected);
      if (n > 1 && !panOk && (!marked || othersMarked)) {
        const e = new Error(`danh sách có ${n} hồ sơ, đã bấm vào hồ sơ ${x.soBienNhan} mà chưa thấy dòng đó được chọn – tiện ích không bấm Xử lý hồ sơ`);
        e.repick = true;
        throw e;
      }
      S.listPick = { so: x.soBienNhan, at: Date.now() };
      return { row, marked, panOk, n };
    };
    // bấm vào hồ sơ rồi “Xử lý hồ sơ” (chậm: chờ 1,2 giây giữa 2 bước). Trang báo “chọn hồ sơ” (chưa nhận dòng) / chưa thấy đúng hồ sơ được chọn
    // → bấm lại dòng 1 lần. Quy trình mở ra phải là của đúng hồ sơ vừa tìm (khung Thông tin hồ sơ / dòng đã chọn)
    const openFromList = async (x, row) => {
      const sx = S.stage[String(x.tb)] || {};
      if (sx.hoan) throw ask(`TB ${x.tb} đang tạm hoãn – tiện ích không mở hồ sơ này`, actBtn('unHoan', x.tb, `Bỏ tạm hoãn, chạy TB ${x.tb}`));
      for (let lan = 1; lan <= 2; lan++) {
        cur = step(lan === 1 ? `Bấm vào hồ sơ ${x.soBienNhan}` : `Bấm lại vào hồ sơ ${x.soBienNhan}`);
        let pr;
        try {
          pr = await pickListRow(x, row);
        } catch (e) {
          if (!(e && e.repick) || lan === 2) throw e;
          cur.skip(e.message);
          row = null;
          await sleep(1000);
          continue;
        }
        row = pr.row;
        cur.ok(
          pr.already
            ? 'dòng đã được chọn sẵn'
            : pr.panOk
            ? 'khung “Thông tin hồ sơ” đã hiện đúng hồ sơ này'
            : pr.marked
            ? 'dòng đã được chọn'
            : 'đã bấm (chưa thấy dấu chọn rõ – danh sách chỉ còn 1 hồ sơ)'
        );
        await sleep(1200);
        try {
          return await openQt(x.soBienNhan);
        } catch (e) {
          if (!(e && e.chonHoSo) || lan === 2) throw e;
          row = null;
          await sleep(1000);
        }
      }
    };
    // bạn chọn TB rồi bấm ▶ (bạn yêu cầu 22/11): ở Danh sách hồ sơ thụ lý gõ Số biên nhận của TB đó vào ô tìm, bấm 🔍; ra hồ sơ → bấm vào hồ sơ →
    // Xử lý hồ sơ → làm tiếp. KHÔNG thấy (bạn yêu cầu 23/11: “nếu không tìm thấy kết quả thì đổi số biên nhận khác”) → tìm lần lượt các TB
    // “◐ Đã nhập nhưng chưa xong” khác; hết lượt mà chưa thấy hồ sơ nào → 5 giây sau tìm lại từ TB bạn chọn – tối đa 30 phút, “■ Dừng” để thôi
    const runGoList = async (x0) => {
      S.listRun = true; // đang tìm ở danh sách (■ Dừng lúc này → tạm dừng tìm)
      stage3 = true;
      if (x0 !== tb) setTb(x0);
      tbKnown = true;
      title = `TB ${x0.tb} – tìm ở Danh sách hồ sơ thụ lý`;
      const t0 = Date.now();
      const look = step('Tìm hồ sơ ở Danh sách hồ sơ thụ lý (không thấy thì đổi số biên nhận khác)');
      cur = look;
      let x = x0;
      let row = null;
      let tried = new Set();
      const dupSkip = []; // TB đổi sang mà có nhiều hồ sơ cùng số – đã bỏ qua
      let lan = 1;
      for (;;) {
        stopIf();
        look.wait(`đang tìm ${x.soBienNhan} (TB ${x.tb})${lan > 1 ? ` · lượt ${lan}` : ''}${tried.size ? ` · ${tried.size} số chưa thấy` : ''}`);
        viewTb(x); // (25/11) TB ở trên chạy theo TB đang tìm
        const r = await searchList(x, alive);
        if (r.err) throw new Error(r.err);
        if (!r.row && !r.dup) roundAdd(x.tb); // không thấy hồ sơ – 🤖 tìm tiếp các TB còn lại, lượt này không tìm lại TB này
        if (r.dup && x === x0) {
          if (x !== tb) setTb(x);
          throw new Error(`có ${r.dup} hồ sơ cùng số biên nhận ${x.soBienNhan} (ngày tiếp nhận khác nhau – trùng?) – tiện ích không chọn; bạn xem rồi bấm ▶`);
        }
        if (r.dup) {
          // TB đổi sang (không phải TB bạn chọn) có nhiều hồ sơ cùng số → bỏ qua TB đó (tạm giữ – bạn xem), tìm số khác
          step(`TB ${x.tb}`).bad(`có ${r.dup} hồ sơ cùng số biên nhận ${x.soBienNhan} (ngày tiếp nhận khác nhau – trùng?) – bỏ qua, bạn xem`);
          const dupWhy = 'có nhiều hồ sơ cùng số biên nhận (trùng?) – bạn xem trên VBDLIS, xong bỏ tạm hoãn';
          if (AUTO()) markStage(x.tb, 'hoan', 'auto', { lyDo: dupWhy });
          else setHold(x.tb, { kind: 'err', hard: 1, why: dupWhy });
          dupSkip.push(String(x.tb));
        } else {
          const g = traGone(x, r);
          if (r.row) {
            row = r.row;
            look.ok(
              `có hồ sơ ${x.soBienNhan} (TB ${x.tb})${x !== x0 ? ` – TB ${x0.tb} không thấy, đã đổi sang số biên nhận khác` : lan > 1 ? ` (lượt tìm thứ ${lan})` : ''}${
                dupSkip.length ? ` · bỏ qua TB có hồ sơ trùng số: ${dupSkip.join(', ')}` : ''
              }`
            );
            break;
          }
          if (g.k === 'xong') {
            step(`TB ${x.tb}`).ok(g.text);
            roundXongEvt(x, g.text);
          } else if (g.k === 'wait') step(`TB ${x.tb}`).skip(g.text);
        }
        tried.add(String(x.tb));
        // đổi số biên nhận khác: TB ◐ chưa tìm ở lượt này
        const nx = sweepList().find((y) => !tried.has(String(y.tb)));
        if (nx) {
          x = nx;
          continue;
        }
        if (Date.now() - t0 > 30 * 60 * 1000)
          throw new Error(`30 phút vẫn chưa thấy hồ sơ nào trong Danh sách hồ sơ thụ lý (lượt cuối tìm ${tried.size} TB) – bấm “▶ Chạy cả TB” để tìm tiếp`);
        look.wait(`lượt ${lan}: đã tìm ${tried.size} TB, chưa thấy hồ sơ nào trong danh sách (lãnh đạo chưa trả về?) – 5 giây sau tìm lại · bấm “■ Dừng” để thôi`);
        for (let k = 0; k < 10; k++) {
          stopIf();
          await sleep(500);
        }
        lan++;
        tried = new Set();
        x = needsList(x0) ? x0 : sweepList()[0] || null;
        if (!x) {
          look.skip('không còn TB “◐ Đã nhập nhưng chưa xong” nào chờ tìm');
          tailNeed = '-';
          S.listRun = false;
          return;
        }
      }
      if (x !== tb) setTb(x);
      S.sweepSeen = { ...(S.sweepSeen || {}), [String(x.tb)]: { snap: stageSnap(x.tb), at: Date.now() } };
      saveSweepSeen();
      if (String(x.tb) !== String(S.recv)) setChainTb(x.tb); // trang tải lại giữa chừng → 🤖 vẫn làm tiếp TB này
      S.listRun = false; // xong phần tìm – từ đây là mở / làm hồ sơ
      return openFromList(tb, row);
    };
    // 🤖 kiểm lại một TB ✓ Xong (lượt kiểm sau khi tìm hết lượt TB ◐ – bạn yêu cầu 24/11; xem chkList): tìm số biên nhận ở Danh sách hồ sơ thụ lý.
    // Hồ sơ VẪN CÒN (sót – chưa trả thật) → bạn chọn: đổi về ◐ (bỏ dấu Xong / đã trả, ghi dấu sot, dấu chặng theo bước của dòng) rồi 🤖 mở hồ sơ làm
    // tiếp → trả dòng hồ sơ. KHÔNG đổi (giữ ✓, ghi đã kiểm, cảnh báo + tiếng + nút bỏ cảnh báo): dòng khớp nhiều TB / tiếp nhận SAU ngày TB này tiếp nhận
    // (hồ sơ khác cùng số), nhiều hồ sơ cùng số, TB đã bị đổi về ◐ một lần mà ✓ lại vẫn còn hồ sơ (không đổi đi đổi lại). Không còn (chắc) → ghi đã kiểm
    // (chk); chưa chắc → 2 giờ sau kiểm lại (chkTry), 3 lần chưa chắc thì thôi (ghi chk, bảng Tiến độ ghi rõ). Trả null
    const runChk = async (x) => {
      const id = String(x.tb);
      title = '🤖 Kiểm lại TB ✓ Xong – còn sót hồ sơ trong Danh sách hồ sơ thụ lý không';
      cur = step(`Kiểm TB ${x.tb} (✓ Xong) – tìm số biên nhận ${x.soBienNhan}`);
      viewTb(x); // (25/11) TB ở trên chạy theo TB đang kiểm
      const r = await searchList(x, alive);
      if (r.err) throw new Error(r.err);
      S.sweepNext = Date.now() + 5000;
      const left = () => {
        const n = chkList().length;
        if (n) return ` · còn ${n} TB ✓ chưa kiểm`;
        const w = S.data.filter((y) => {
          const sy = S.stage[String(y.tb)] || {};
          return y.soBienNhan && sy.xong && !sy.hoan && !(sy.chk && sy.chk >= sy.xong) && Date.now() - sy.xong < CHK_MIN_MS;
        }).length;
        return w ? ` · còn ${w} TB vừa ✓ (dưới 15 phút) – kiểm sau` : ' · đã kiểm hết TB ✓';
      };
      const s0 = S.stage[id] || {};
      const now = Date.now();
      // giữ ✓, ghi đã kiểm, cảnh báo (tiếng + dòng báo có nút “Đã xem – bỏ cảnh báo”)
      const warnKeep = async (why, mark) => {
        await setMark(id, 'sot', { at: now, ...mark });
        await setMark(id, 'chk', now);
        cur.bad(`${why} – giữ ✓, bạn xem trên VBDLIS${left()}`);
        setEvt(`⚠ TB ${esc(x.tb)} – ${esc(whoOf(x))}: ${esc(why)} – tiện ích giữ ✓, bạn xem trên VBDLIS. ${actBtn('unSot', x.tb, 'Đã xem – bỏ cảnh báo')}`, true);
        // tiếng + nháy tên tab sau khi lần chạy kết thúc (cuối lần chạy tắt dấu cũ rồi báo lại); 60 giây sau mới tìm tiếp – dòng báo còn để bạn đọc
        // (sau đó vẫn xem / bỏ cảnh báo được ở ☰ Tiến độ – cột Cần xem)
        tailNeed = 'Kiểm TB ✓ – bạn xem';
        tailOk = `<div class="hint">⚠ TB <b>${esc(x.tb)}</b>: ${esc(why)} – tiện ích giữ ✓. Bạn xem trên VBDLIS rồi bấm “Đã xem – bỏ cảnh báo” (ở dòng báo hoặc ☰ Tiến độ).</div>`;
        S.sweepNext = Date.now() + 60000;
        return null;
      };
      if (r.row) {
        const stp = rowStepText(r.row);
        // dòng phải là hồ sơ của ĐÚNG TB này (khớp đúng 1 TB trong dữ liệu)
        const own = tbOfSo(rowSo(r.row)).list;
        if (!(own.length === 1 && own[0] === x))
          return warnKeep(`còn hồ sơ cùng số trong danh sách${stp ? ` (${stp})` : ''} nhưng khớp ${own.length} TB trong dữ liệu`, { khac: 1 });
        // ngày tiếp nhận của dòng SAU ngày tiện ích ghi TB này tiếp nhận → hồ sơ khác cùng số (tiếp nhận lần 2?) – không đổi
        const mm = /tiep nhan:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(norm(r.row.textContent || ''));
        if (mm && s0.tn && s0.tnBy !== 'suy') {
          const t = new Date(s0.tn);
          if (new Date(+mm[3], +mm[2] - 1, +mm[1]).getTime() > new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime())
            return warnKeep(`còn hồ sơ cùng số tiếp nhận ngày ${mm[1]}/${mm[2]}/${mm[3]} – sau ngày TB này tiếp nhận (hồ sơ khác / tiếp nhận lần 2?)`, { khac: 1 });
        }
        // đã đổi về ◐ một lần rồi mà ✓ lại vẫn còn hồ sơ → không đổi đi đổi lại
        if (s0.sotN && !s0.ldUnk) return warnKeep(`hồ sơ vẫn còn trong danh sách${stp ? ` (${stp})` : ''} dù đã đổi về ◐ làm lại một lần`, { lai: 1 });
        const s = { ...unXong(s0), sot: { at: now }, sotN: 1 };
        ['dsNo', 'chkN', 'chkTry'].forEach((k) => delete s[k]); // thấy hồ sơ = kết quả chắc: bỏ dấu “bạn đã đổi về ◐” và số lần kiểm chưa chắc
        // hồ sơ có trên VBDLIS = đã tiếp nhận → ghi mốc tiếp nhận nếu thiếu (✓ đánh tay / nạp Excel) – 🤖 KHÔNG tiếp nhận lại (tránh hồ sơ trùng)
        if (!s.tn && !s.don) {
          s.tn = now;
          s.tnBy = 'suy';
        }
        // dấu chặng theo bước của dòng: bước 4 / 5 = lãnh đạo đã trả về (bước 4: chưa sang Trả kết quả); bước 1–3 = lãnh đạo CHƯA trả về
        const n = (/^\s*(\d)\s*\./.exec(stp) || [])[1] || '';
        const st4 = n === '4' || (!n && /hoan tat ho so/.test(norm(stp)));
        const st5 = n === '5' || (!n && /tra ket qua/.test(norm(stp)));
        if (st4 || st5) {
          if (!s.kq) {
            s.kq = now;
            if (!s.ld) {
              s.ld = now;
              s.ldBy = 'kq';
            }
          }
          if (st4) {
            delete s.trk;
            delete s.trkBy;
          }
        } else if (/^[123]$/.test(n)) ['kq', 'trk', 'trkBy', 'kd'].forEach((k) => delete s[k]);
        if (s.fwd && (s.fwd.k === 'oth' || (s.fwd.k === 'trk' && !st5))) delete s.fwd;
        S.stage[id] = s;
        saveStage(id);
        cur.bad(
          `hồ sơ VẪN CÒN trong danh sách${stp ? ` (${stp})` : ''} mà TB đang ✓ Xong${
            s0.xongBy ? ` (${BY_TEXT[s0.xongBy] || s0.xongBy})` : ''
          } – sót → đổi về ◐ Đã nhập nhưng chưa xong, 🤖 mở hồ sơ làm tiếp (bạn tích ✓ lại bằng tay thì tiện ích thôi kiểm TB này)`
        );
        setEvt(`⚠ TB ${esc(x.tb)} – ${esc(whoOf(x))}: đang ✓ Xong mà hồ sơ vẫn còn trong Danh sách hồ sơ thụ lý → đã đổi về <b>◐ Đã nhập nhưng chưa xong</b>, 🤖 làm tiếp.`, true);
        return r.row;
      }
      tailNeed = '-';
      if (r.dup) return warnKeep(`còn ${r.dup} hồ sơ cùng số biên nhận trong danh sách (tiện ích không chọn hồ sơ nào)`, { dup: r.dup });
      const why = goneWhy(r, true);
      if (!why) {
        await setMark(id, 'chk', now);
        if (s0.chkN) await setMark(id, 'chkN', null);
        cur.ok(
          s0.ldUnk && now - s0.xong < LDUNK_DAYS_MS
            ? `không còn hồ sơ trong danh sách – giữ ✓ (chưa rõ lãnh đạo trả chưa: 30 phút sau tìm lại)${left()}`
            : `không còn hồ sơ trong danh sách – đúng là đã xong${left()}`
        );
        return null;
      }
      const nTry = (s0.chkN || 0) + 1;
      await setMark(id, 'chkN', nTry);
      if (nTry >= 3) {
        await setMark(id, 'chk', now); // 3 lần chưa chắc → thôi kiểm TB này (bảng Tiến độ ghi rõ)
        cur.skip(`không thấy hồ sơ nhưng chưa chắc (${why}) – đã thử 3 lần, thôi kiểm TB này${left()}`);
      } else {
        await setMark(id, 'chkTry', now);
        cur.skip(`không thấy hồ sơ nhưng chưa chắc (${why}) – 2 giờ sau kiểm lại (lần ${nTry}/3)${left()}`);
      }
      return null;
    };
    // ⚡ soát hàng loạt (bulkRead → đối chiếu mọi TB ◐ / TB ✓ chờ kiểm cùng lúc). Đọc không trọn → lượt này tìm từng TB như cũ (bulkFail)
    const runBulk = async () => {
      S.listRun = true;
      S.bulkNow = 0;
      stage3 = true; // không đổi TB đang chọn
      title = '⚡ Soát hàng loạt – Danh sách hồ sơ thụ lý';
      const tA = Date.now();
      // TB ◐ (cả TB vừa mở – dấu “vừa mở” chỉ để không mở lại liền) và TB ✓ chờ kiểm
      const tn = S.data.filter((x) => {
        const id = String(x.tb);
        const st = S.stage[id] || {};
        return !!x.soBienNhan && !st.hoan && !st.tra && !S.autoHold.has(id) && showStage(x) === 'tn';
      });
      const ck = chkList();
      const look = step(`⚡ Soát hàng loạt: đọc cả danh sách, lật hết các trang (${tn.length} TB ◐ · ${ck.length} TB ✓ chờ kiểm)`);
      cur = look;
      bulkSave({ at: tA });
      const res = await bulkRead(alive, (t) => look.wait(t));
      stopIf();
      if (!res.full) {
        roundBulk([], true);
        bulkSave({ at: tA, bad: res.why });
        look.skip(`không đọc trọn danh sách (${res.why}) – lượt này 🤖 tìm từng TB như cũ`);
        S.sweepNext = Date.now() + 3000;
        tailNeed = '-';
        S.listRun = false;
        return;
      }
      look.ok(`đã đọc ${res.pages} trang · ${res.keys.size} hồ sơ trong danh sách (${Math.max(1, Math.round((Date.now() - tA) / 1000))} giây)`);
      const kl = [...res.keys].filter((k) => k.length > 13);
      const has = (x) => {
        const k = soKey(x.soBienNhan);
        return res.keys.has(k) || kl.some((K) => k.startsWith(K)); // số trong danh sách là phần đầu số của TB (bị cắt?) → tìm đúng số như cũ
      };
      // như một lần tìm CHẮC CHẮN không thấy (danh sách vừa tải lại, trống, đúng tài khoản, thanh lọc “Tất cả”) – luật ✓ / giữ ◐ như cũ (traGone)
      const R = { row: null, none: true, fresh: true, emptyShown: true, typed: true };
      const now = Date.now();
      const xong = [];
      const giu = [];
      const co = [];
      const ckOk = [];
      const ckCo = [];
      for (const x of tn) {
        const id = String(x.tb);
        if (has(x)) {
          co.push(id);
          continue;
        }
        const g = traGone(x, R);
        roundAdd(id, g.k === 'xong');
        (g.k === 'xong' ? xong : giu).push(id);
      }
      for (const x of ck) {
        const id = String(x.tb);
        if (has(x)) {
          ckCo.push(id);
          continue;
        }
        const s0 = S.stage[id] || {};
        await setMark(id, 'chk', now);
        if (s0.chkN) await setMark(id, 'chkN', null);
        ckOk.push(id);
      }
      roundBulk([...tn, ...ck].map((x) => String(x.tb)));
      const few = (a, n) => `${a.slice(0, n).join(', ')}${a.length > n ? '…' : ''}`;
      if (tn.length) {
        step('TB ◐ không còn hồ sơ → ✓ Xong')[xong.length ? 'ok' : 'skip'](xong.length ? `${xong.length} TB: ${few(xong, 20)}` : 'không có');
        if (giu.length) step('TB vừa chuyển lãnh đạo / chuyển đi (chưa đủ 1 ngày) – chưa xong, giữ ◐').skip(`${giu.length} TB: ${few(giu, 20)}`);
        step('TB ◐ còn hồ sơ')[co.length ? 'ok' : 'skip'](co.length ? `${co.length} TB – 🤖 tìm từng số để mở làm tiếp: ${few(co, 20)}` : 'không có');
      }
      if (ck.length)
        step('TB ✓ chờ kiểm').ok(`${ckOk.length} TB đúng là đã xong${ckCo.length ? ` · ${ckCo.length} TB vẫn còn hồ sơ – 🤖 kiểm từng TB: ${few(ckCo, 20)}` : ''}`);
      setEvt(
        `⚡ Soát hàng loạt lúc ${esc(fmtTime(now))}: ${res.keys.size} hồ sơ trong danh sách (${res.pages} trang) · <b>✓ Xong ${xong.length} TB</b>${
          xong.length ? ` (${esc(few(xong, 15))})` : ''
        } · vừa chuyển lãnh đạo (giữ ◐) ${giu.length} · còn hồ sơ ${co.length}${co.length ? ` (${esc(few(co, 15))})` : ''}${ck.length ? ` · kiểm ✓: ${ckOk.length} đúng xong, ${ckCo.length} còn hồ sơ` : ''}.`
      );
      bulkSave({ at: now, n: res.keys.size, pages: res.pages, xong: xong.length, co: co.length + ckCo.length });
      S.sweepNext = Date.now() + 1500;
      tailNeed = '-';
      S.listRun = false;
    };
    // ⚡ TB sắp tìm chưa được lần soát hàng loạt của lượt này xét → soát hàng loạt (🤖: cách lần trước ≥ 1 phút – chưa đủ thì chờ, không tìm từng TB)
    const bulkOrWait = async (manual) => {
      const last = bulkLoad();
      const left = last && last.at ? last.at + BULK_GAP_MS - Date.now() : 0;
      if (left > 0 && !manual) {
        S.sweepNext = Date.now() + Math.min(left, BULK_GAP_MS);
        step('⚡ Soát hàng loạt').skip(`vừa soát lúc ${fmtTime(last.at)} – ${Math.ceil(left / 1000)} giây sau soát lại cả danh sách`);
        tailNeed = '-';
        S.listRun = false;
        return;
      }
      return runBulk();
    };
    const runSweep = async (manual) => {
      S.listRun = true; // đang tìm ở danh sách (■ Dừng lúc này → tạm dừng tìm)
      // (25/11) bạn vừa bật ⚡ Soát loạt → soát ngay một lượt (cả khi đang chọn TB phải tìm)
      if (bulkOn() && S.bulkNow && Date.now() - S.bulkNow < 3 * 60 * 1000) return runBulk();
      const all = listDataRows();
      // danh sách đang lọc theo ô tìm (bạn / tiện ích gõ số biên nhận): dòng có ĐÚNG số trong ô tìm – trang tìm “chứa chữ” có thể ra thêm dòng
      // số dài hơn; không có số trong ô tìm thì danh sách còn đúng 1 dòng
      const sb0 = sbnSearch();
      const q0 = sb0 ? soKey(sb0.input.value) : '';
      const ex0 = q0 ? groupSame(all.filter((r) => soKey(rowSo(r)) === q0)) : [];
      const one = groupSame(all); // mọi dòng là bản lặp của cùng 1 hồ sơ → 1 dòng
      const fRow = ex0.length === 1 ? ex0[0] : one.length === 1 && new Set(all.map((r) => soKey(rowSo(r)))).size === 1 ? one[0] : null;
      // TB chỉ đang chờ lãnh đạo trả về (đã chuyển lãnh đạo, chưa tới bước Trả kết quả)
      const leaderOnly = (y) => {
        const s = S.stage[String(y.tb)] || {};
        return !!s.ld && !traPhase(s);
      };
      // ▶ ở trang danh sách: TB đang chọn còn phải tìm → tìm đúng TB đó (trừ khi danh sách đang lọc đúng hồ sơ của TB khác).
      // 🤖 đang bật mà TB đang chọn chỉ đang chờ lãnh đạo (vd. TB vừa chuyển lãnh đạo) → 🤖 tìm lần lượt MỌI TB chờ, không chỉ TB đó
      if (manual && tb && needsList(tb) && !(AUTO() && leaderOnly(tb))) {
        const l0 = fRow ? tbOfSo(rowSo(fRow)).list : [];
        if (!(l0.length === 1 && l0[0] !== tb)) return runGoList(tb);
      }
      stage3 = true; // hồ sơ cũ – không đổi TB đang chọn
      title = '🤖 Danh sách hồ sơ thụ lý – tìm hồ sơ';
      const ps = sweepList();
      let x = null;
      let row = null;
      if (fRow) {
        const l = tbOfSo(rowSo(fRow)).list;
        if (l.length === 1 && (manual || ps.includes(l[0]))) {
          x = l[0];
          row = fRow;
          cur = step(`Hồ sơ đang lọc: ${rowSo(fRow)} – TB ${x.tb}`);
          cur.ok();
        }
      }
      if (!x && !manual && !roundNext(ps)) {
        // 🤖 đã tìm hết lượt TB ◐ → lượt kiểm TB ✓ Xong chưa kiểm (mỗi TB 1 lần); TB còn sót hồ sơ → đã đổi về ◐ → mở hồ sơ làm tiếp
        // (thanh lọc đang ở mục khác “Tất cả” → không kiểm – mọi lần kiểm đều chưa chắc)
        const ck = listTabState() !== 'other' ? chkList()[0] : null;
        if (ck && bulkOn() && !bulkCovered(ck)) return bulkOrWait(manual); // ⚡ TB ✓ này chưa được soát hàng loạt xét
        if (ck) {
          const c = await runChk(ck);
          if (!c) return;
          x = ck;
          row = c;
        }
      }
      if (!x) {
        if (!ps.length) {
          step('Tìm hồ sơ').skip('không còn TB “◐ Đã nhập nhưng chưa xong” nào chờ xử lý');
          tailNeed = '-';
          return;
        }
        // TB ◐ đầu tiên chưa tìm trong lượt này (chặng cuối trước); cả lượt đã tìm hết → lượt mới từ đầu
        x = roundNext(ps);
        if (!x) {
          roundReset(true);
          x = ps[0];
        }
        if (bulkOn() && !bulkCovered(x)) return bulkOrWait(manual); // ⚡ lượt mới / TB chưa được soát hàng loạt xét → soát cả danh sách
        cur = step(`Tìm số biên nhận ${x.soBienNhan} (TB ${x.tb})`);
        viewTb(x); // (25/11) TB ở trên chạy theo TB đang tìm
        const r = await searchList(x, alive);
        if (r.err) throw new Error(r.err);
        if (!r.row && r.dup) {
          // có nhiều hồ sơ cùng số (ngày tiếp nhận khác nhau) → không chọn, giữ TB chờ bạn xem
          S.sweepNext = Date.now() + 5000;
          tbKnown = true;
          if (x !== tb) setTb(x);
          throw new Error(`có ${r.dup} hồ sơ cùng số biên nhận ${x.soBienNhan} (ngày tiếp nhận khác nhau – trùng?) – tiện ích không chọn; bạn xem rồi bấm ▶`);
        }
        const g = traGone(x, r); // TB chặng cuối (lãnh đạo đã trả về) mà không còn hồ sơ trong danh sách → ✓ Xong
        if (!r.row) {
          S.sweepNext = Date.now() + 5000; // 5 giây sau mới tìm TB kế tiếp (giữa 2 lần tìm, bảng điền rảnh cho bạn dùng)
          roundAdd(x.tb); // đã tìm trong lượt này mà không thấy hồ sơ (TB thấy hồ sơ thì không tính – mở làm, chặng sau làm luôn)
          if (g.k === 'xong') roundXongEvt(x, g.text);
          const dn = roundDone();
          const rest = sweepList().filter((y) => !dn.has(String(y.tb)));
          // dòng báo của lần chạy trước bị xóa khi 🤖 tìm số kế tiếp → ghi luôn các TB lượt này đã tích ✓ Xong vào dòng này
          const xs = (S.sweepRound && Array.isArray(S.sweepRound.xong) && S.sweepRound.xong) || [];
          const pv = (!xs.length && S.sweepRound && Array.isArray(S.sweepRound.prev) && S.sweepRound.prev) || [];
          const few = (a, n) => `${a.slice(0, n).join(', ')}${a.length > n ? '…' : ''}`;
          const msg =
            g.text +
            (!AUTO()
              ? ''
              : rest.length
              ? ` – 🤖 5 giây sau đổi số biên nhận khác · lượt này còn ${rest.length} TB ◐ chưa tìm: ${few(
                  rest.map((y) => y.tb),
                  12
                )}`
              : chkList().length && listTabState() !== 'other'
              ? ` – hết lượt TB ◐: 🤖 kiểm ${chkList().length} TB ✓ chưa kiểm, rồi sang tiếp nhận TB mới / bắt đầu lượt sau`
              : ' – hết lượt TB ◐: 🤖 sang tiếp nhận TB mới / bắt đầu lượt sau') +
            (xs.length ? ` · lượt này đã tích ✓ Xong ${xs.length} TB: ${few(xs, 15)}` : '') +
            (pv.length ? ` · lượt trước đã tích ✓ Xong ${pv.length} TB: ${few(pv, 15)}` : '');
          if (g.k === 'xong') cur.ok(msg);
          else cur.skip(msg);
          tailNeed = '-';
          return;
        }
        row = r.row;
        cur.ok('có hồ sơ');
      }
      if (x !== tb) setTb(x);
      tbKnown = true;
      title = `TB ${tb.tb} – mở từ Danh sách hồ sơ thụ lý`;
      // TB tạm hoãn → không mở, không nhớ là TB đang làm dở
      if ((S.stage[String(tb.tb)] || {}).hoan) throw ask(`TB ${tb.tb} đang tạm hoãn – tiện ích không mở hồ sơ này`, actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`));
      // nhớ: đã mở TB này với tiến độ này – lần sau chỉ mở lại khi tiến độ đổi (tránh mở đi mở lại khi đang chờ bạn)
      S.sweepSeen = { ...(S.sweepSeen || {}), [String(tb.tb)]: { snap: stageSnap(tb.tb), at: Date.now() } };
      saveSweepSeen();
      if (String(tb.tb) !== String(S.recv)) setChainTb(tb.tb); // trang tải lại giữa chừng → 🤖 vẫn làm tiếp TB này
      S.listRun = false; // xong phần tìm – từ đây là mở / làm hồ sơ
      return openFromList(tb, row);
    };
    // chưa thấy câu báo sau khi chuyển lãnh đạo → mở lại “Xử lý hồ sơ” một lần để xem. Chỉ ghi “đã chuyển” khi trang báo rõ hồ sơ
    // không còn của bạn; còn Quy trình “Nhập đăng ký” = CHƯA chuyển; chưa rõ → dừng, hỏi bạn (nút “Đã chuyển” / “Chưa chuyển – làm lại”)
    const verifyLd = async () => {
      cur = step('Kiểm tra đã chuyển lãnh đạo chưa');
      const both = () => ldDoneBtn() + ' ' + redoBtn();
      let back = false;
      for (let i = 0; i < 40 && !back; i++) {
        stopIf();
        await sleep(500);
        back = !!btnXuLyHoSo() && !(await topNow()) && !(await dlgNow([], true));
      }
      if (!back) {
        // (soát 24/11) màn hình hồ sơ đã hiện lại nhưng KHÔNG còn nút “Xử lý hồ sơ” (có “Về trang tiếp nhận hồ sơ”), đúng TB này, 2 lần đọc liền
        // = hồ sơ đã sang lãnh đạo (cùng dấu hiệu nhánh ldx dùng sau khi trang tải lại) → ghi nhận, sang TB sau
        const gone = async () => !btnXuLyHoSo() && !!linkVeTiepNhan() && !(await topNow()) && !pageWorking() && tbOfSo(await dossierSo()).list[0] === tb;
        if ((await gone()) && (await sleep(1200), await gone())) {
          markStage(tb.tb, 'ld', 'suy');
          cur.ok('màn hình hồ sơ không còn nút “Xử lý hồ sơ” – hồ sơ đã sang lãnh đạo');
          setEvt(`✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: đã chuyển lãnh đạo – <b>◐ Đã nhập nhưng chưa xong</b>.`);
          return goNext(true);
        }
        needYou('Chưa chắc đã chuyển – bạn xem', 'bad');
        throw ask('đã bấm “Thực thi” chuyển lãnh đạo, chưa thấy câu báo thành công và chưa thấy lại màn hình hồ sơ – bạn kiểm tra trên VBDLIS rồi bấm một nút dưới', both());
      }
      clickPage(btnXuLyHoSo());
      let got = '';
      let d = null;
      for (let i = 0; i < 40 && !got; i++) {
        stopIf();
        await sleep(500);
        const m = qtModal();
        if (m && qtRows(m).length) got = 'qt';
        else if ((d = await dlgNow([], true))) got = 'dlg';
      }
      if (got === 'dlg' && LD_MOVED.test(norm(d.text || d.title || ''))) {
        await act('answerDialog', { rules: [{ re: '.', btn: ['Đóng', 'OK'] }] });
        markStage(tb.tb, 'ld', 'suy');
        cur.ok(`trang báo “${(d.text || d.title || '').slice(0, 80)}” → đã chuyển lãnh đạo`);
        setEvt(`✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: đã chuyển lãnh đạo – <b>◐ Đã nhập nhưng chưa xong</b>.`);
        return goNext(true);
      }
      needYou('Chưa chắc đã chuyển – bạn xem', 'bad');
      if (got === 'qt') {
        const q = await qtSettled(alive);
        const still = q && q.v === 'cv';
        if (still) {
          // Quy trình vẫn còn Nhập đăng ký = chưa chuyển: dấu đang chuyển ghi 'old' (không hiện ◐)
          const f = (S.stage[String(tb.tb)] || {}).fwd;
          if (f && f.k === 'ld' && !f.bad) await setMark(tb.tb, 'fwd', { ...f, bad: 'old' });
        }
        throw ask(
          still
            ? 'Quy trình vẫn còn “Nhập đăng ký + Giấy tờ đính kèm” – có thể CHƯA chuyển lãnh đạo; bạn kiểm tra trên VBDLIS'
            : 'không chắc đã chuyển lãnh đạo – bạn kiểm tra trên VBDLIS',
          still ? redoBtn() : both()
        );
      }
      throw ask(
        got === 'dlg'
          ? `bấm lại “Xử lý hồ sơ”, trang báo “${(d.text || d.title || '').slice(0, 160)}” – bạn kiểm tra trên VBDLIS`
          : 'bấm lại “Xử lý hồ sơ” mà chưa thấy Quy trình / câu báo – bạn kiểm tra trên VBDLIS',
        both()
      );
    };
    // Quy trình “Kết ISO” + “Trả hồ sơ” (ảnh 9): Xử lý tác vụ (Trả hồ sơ) → cửa sổ “Trả hồ sơ” (ảnh 10) → Thực hiện → Đồng ý (bạn yêu cầu)
    const runTra = async (q) => {
      cur = step('Hồ sơ của Quy trình (Trả hồ sơ)');
      const { x, so } = await dossierTb(false);
      stage3 = true;
      if (x !== tb) setTb(x);
      title = `TB ${tb.tb} – Trả hồ sơ`;
      const s = S.stage[String(tb.tb)] || {};
      if (s.hoan) throw ask(`TB ${tb.tb} đang tạm hoãn – tiện ích không trả hồ sơ`, actBtn('unHoan', tb.tb, `Bỏ tạm hoãn, chạy TB ${tb.tb}`));
      if (!s.trk) markStage(tb.tb, 'trk', 'suy'); // Quy trình “Trả hồ sơ” hiện ra = đã sang bước Trả kết quả
      cur.ok(`${so} – TB ${tb.tb}`);
      let iso = q.rows.find((r) => qtKindOf(r) === 'iso');
      let tra = q.rows.find((r) => qtKindOf(r) === 'tra');
      if (!iso.chk.checked && isoAuto() && !s.tra && !tra.chk.checked) {
        const q3 = await runIso(q);
        if (!q3) return;
        q = q3;
        iso = q.rows.find((r) => qtKindOf(r) === 'iso');
        tra = q.rows.find((r) => qtKindOf(r) === 'tra');
      }
      if (!iso.chk.checked) {
        // (24/11) 🤖, “Tự Kết ISO” tắt: Kết ISO là việc của bạn → đóng Quy trình, làm TB khác (10 phút sau mở lại hồ sơ này) – không tạm hoãn
        if (!isoAuto() && (await qtLeave(tb, 'Kết ISO'))) return;
        throw ask('“Kết ISO” chưa tích “Đã xử lý” – tiện ích không Trả hồ sơ' + (AUTO() && !isoAuto() ? ' (muốn 🤖 tự Kết ISO: tích ô “Tự Kết ISO” ở tab Biên nhận)' : ''), '');
      }
      if (s.tra || tra.chk.checked) {
        if (!s.tra) markStage(tb.tb, 'tra', 'qt');
        step('Trả hồ sơ').skip('đã trả hồ sơ');
        tailNeed = '-';
        return;
      }
      if (pending(s, 'tra'))
        throw ask(`đã bấm “Thực hiện” Trả hồ sơ lúc ${fmtTime(s.fwd.at)} mà chưa xác nhận – kiểm tra trên VBDLIS: đã trả thì bấm “Đã trả – ✓ Xong”, chưa trả thì bấm “Chưa trả – làm lại”`, traBtns());
      if (!AUTO() || S.opts.thuThucThi) {
        if (tra.link) {
          ringFor(tra.link, 60000);
        }
        step('Trả hồ sơ').ok('đã tô vàng – bạn tự bấm Xử lý tác vụ → Thực hiện → Đồng ý');
        if (AUTO()) setHold(tb.tb, { kind: 'tt', k: 'tra', btn: '^(thuc hien|dong y)$' });
        tailNeed = '-';
        return;
      }
      cur = step('Mở “Trả hồ sơ” (Xử lý tác vụ)');
      if (!tra.link) throw new Error('không thấy “Xử lý tác vụ” của Trả hồ sơ');
      clickPage(tra.link);
      let tm = null;
      for (let i = 0; i < 50 && !tm; i++) {
        stopIf();
        await sleep(400);
        tm = traModal();
      }
      if (!tm) {
        log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): cửa sổ: ${modalDiag()}; khối có nút Thực hiện: ${traDiag()}`) });
        needYou('Chưa thấy cửa sổ Trả hồ sơ – bạn xem', 'bad');
        throw ask(
          'bấm “Xử lý tác vụ” rồi mà chưa nhận ra cửa sổ “Trả hồ sơ” – bạn tự bấm Thực hiện → Đồng ý; trang trả xong thì bấm “Đã trả – ✓ Xong” (tiện ích không chắc tự ghi được); chụp dòng “Để báo lỗi” gửi người hỗ trợ',
          actBtn('markTra', tb.tb, `Đã trả – ✓ Xong TB ${tb.tb}`)
        );
      }
      cur.ok();
      // 🤖 (bạn chọn 23/11): ô / nút bạn tích thêm trong mẫu cửa sổ Trả hồ sơ (tab Trường) – làm trước “Thực hiện”
      {
        const ex = await tplChainExtras({ base: '', decide: ['thuc hien'], fields: true, step });
        if (ex) throw ask(`${ex} – tiện ích không bấm “Thực hiện” Trả hồ sơ; bạn xem rồi bấm “▶ Chạy cả TB”`, '');
      }
      cur = step('Bấm “Thực hiện”, “Đồng ý” (Trả hồ sơ)');
      const go = [...tm.querySelectorAll('button, a, input[type="button"], input[type="submit"]')].find((b) => shownEl(b) && btnText(b) === 'thuc hien');
      if (!go) throw new Error('không thấy nút “Thực hiện” của cửa sổ Trả hồ sơ');
      stopIf();
      await setFwd(tb.tb, 'tra'); // ghi dấu trước khi bấm
      try {
        stopIf();
      } catch (e) {
        await setMark(tb.tb, 'fwd', null); // bạn bấm ■ Dừng lúc đang ghi dấu → chưa bấm Thực hiện, bỏ dấu
        throw e;
      }
      // kiểm tra ngay trước khi bấm (không await ở giữa): đúng cửa sổ “Trả hồ sơ”, không có hộp hỏi, bạn không vừa thao tác
      if (traModal() !== tm || pageDialog() || Date.now() - USER.at < 2000) {
        await setMark(tb.tb, 'fwd', null);
        throw ask('cửa sổ Trả hồ sơ vừa đổi / bạn đang thao tác – bấm “▶ Chạy cả TB” lại', '');
      }
      const t0 = Date.now();
      clickPage(go);
      let good = null;
      let closedAt = 0;
      let confirmed = 0; // hộp “Bạn có chắc chắn muốn trả hồ sơ này?” – chỉ trả lời 1 lần
      let traLk3 = 0; // đã bấm Đồng ý hộp cảnh báo “liên kết 3 khối” (24/11)
      let taught = null; // hộp bạn dạy đã được bấm sau Thực hiện (không phải câu báo thành công)
      let lastBusy = 0; // lúc gần nhất trang còn “Đang xử lý…”
      for (;;) {
        stopIf();
        const ts = toastsSince(t0);
        const bad = ts.find(toastBad);
        if (bad) {
          needYou('Trả hồ sơ chưa xong – bạn xem', 'bad');
          // trang báo lỗi → ghi dấu lỗi vào dấu “đang Trả hồ sơ” (không bao giờ suy ra đã trả từ dấu này)
          await setMark(tb.tb, 'fwd', { ...((S.stage[String(tb.tb)] || {}).fwd || { k: 'tra', at: t0 }), bad: 'err' });
          throw ask(`bấm “Thực hiện” Trả hồ sơ, trang báo “${bad.raw.slice(0, 150)}”`, redoTra());
        }
        // hộp báo thành công → Đóng; hộp hỏi trả hồ sơ → Đồng ý (1 lần, ngay sau khi bấm Thực hiện); hộp khác → dừng chờ bạn
        const dd = await dlgNow(TRA_DONE_DIALOGS, true);
        if (dd && dd.answered) good = good || { raw: dd.title || 'Trả hồ sơ thành công' };
        else if (dd) {
          // cảnh báo “chưa đáp ứng liên kết 3 khối … tiếp tục thực hiện …?” → Đồng ý, làm tiếp (1 lần, bạn yêu cầu 24/11)
          if (!traLk3) {
            const a = await dlgNow(LK3_DIALOGS, true);
            if (a && a.answered) {
              traLk3 = 1;
              continue;
            }
          }
          const canAsk = !confirmed && Date.now() - t0 < 15000 * slowK();
          const d = await dlgNow(canAsk ? TRA_DIALOGS : [], !canAsk);
          if (d && d.answered) confirmed++;
          else if (d) {
            // hộp bạn đã dạy ở tab Trường → bấm theo mẫu (hộp LỖI đã dạy: bước này chưa xong – TB tạm hoãn)
            const tl = canAsk ? null : await dlgNow([]);
            if (tl && tl.answered) {
              // (soát 24/11) hộp bạn dạy không phải câu báo thành công – trừ khi chữ hộp ghi rõ “thành công”; không thì bước này chưa chắc xong
              const tt = norm(`${tl.title || ''} ${tl.text || ''}`);
              if (/thanh cong/.test(tt) && !/(khong|chua) thanh cong/.test(tt)) good = good || { raw: tl.title || tl.text || 'thành công' };
              else if (TAUGHT_BAD.test(tt)) taught = taught || tl; // hộp báo lỗi / chưa được… → chưa trả
              continue;
            }
            needYou('Trang hỏi – bạn xem', 'bad');
            if (ERR_TOAST.test(norm(`${d.title || ''} ${d.text || ''}`)))
              await setMark(tb.tb, 'fwd', { ...((S.stage[String(tb.tb)] || {}).fwd || { k: 'tra', at: t0 }), bad: 'err' });
            throw ask(`trang hỏi / báo “${(d.text || d.title || '').slice(0, 150)}” – tiện ích dừng`, traBtns());
          }
        }
        good = good || toastsSince(t0).find(toastOk) || null; // đọc lại sau khi xem hộp (câu báo đến lúc đang chờ)
        // trang còn “Đang xử lý…” (trang thật 23/11: Trả hồ sơ có lúc xử lý lâu) → chờ trang xử lý xong mới kết luận
        const busy = pageWorking();
        if (busy) lastBusy = Date.now();
        if (!(tm.isConnected && shownEl(tm))) {
          if (!closedAt) closedAt = Date.now();
          if (good) break;
          // BẠN đóng cửa sổ (Đóng / Hủy / × / Esc / bấm ra nền) sau khi tiện ích bấm Thực hiện → không coi là đã trả, hỏi bạn
          // (bấm / gõ chỗ khác trên trang lúc chờ “Đang xử lý…” thì không tính)
          if ((S.traCloseAt || 0) > t0) {
            needYou('Trả hồ sơ – bạn kiểm tra', 'bad');
            throw ask(
              'cửa sổ Trả hồ sơ đóng sau khi bạn bấm đóng / hủy (chưa thấy câu báo thành công) – bạn kiểm tra trên VBDLIS: đã trả thì bấm “Đã trả – ✓ Xong”, chưa trả thì bấm “Chưa trả – làm lại”',
              traBtns()
            );
          }
          if (!busy && Date.now() - closedAt > 2000 && Date.now() - lastBusy > 2000) break;
        }
        // trang báo trả thành công (cửa sổ chưa đóng) và hết “Đang xử lý…” 2 giây → đã trả
        if (good && !busy && Date.now() - lastBusy > 2000) break;
        // chờ tối đa 60 giây; trang (vừa) còn “Đang xử lý…” thì tới 5 phút. Quá → bạn kiểm tra: nút “Đã trả – ✓ Xong” / làm lại
        const lim = (lastBusy ? 5 * 60000 : 60000) * slowK();
        if (Date.now() - t0 > lim) {
          needYou('Trả hồ sơ – bạn kiểm tra', 'bad');
          throw ask(
            `${Math.round(lim / 60000)} phút sau khi bấm “Thực hiện”${confirmed ? ', “Đồng ý”' : ''} Trả hồ sơ mà ${busy ? 'trang vẫn “Đang xử lý…”' : 'cửa sổ Trả hồ sơ chưa đóng'} – bạn kiểm tra trên VBDLIS: đã trả thì bấm “Đã trả – ✓ Xong”, chưa trả thì bấm nút làm lại`,
            traBtns()
          );
        }
        await sleep(300);
      }
      // bấm Thực hiện (và Đồng ý) xong, cửa sổ đóng mà trang không báo lỗi → coi như đã trả (bạn yêu cầu 23/11:
      // “khi bấm thực hiện thì TB ý phải là trạng thái đã xong”)
      if (!good && taught) throw new Error(`trang báo “${String(taught.title || taught.text || '').slice(0, 60)}” sau khi bấm Thực hiện Trả hồ sơ – đã bấm theo hộp bạn dạy, chưa thấy báo thành công`);
      if (!good) good = { raw: confirmed ? 'cửa sổ Trả hồ sơ đã đóng sau khi bấm Đồng ý, không có câu báo lỗi' : 'cửa sổ Trả hồ sơ đã đóng sau khi bấm Thực hiện, không có câu báo lỗi' };
      if (good) markStage(tb.tb, 'tra', 'auto'); // ghi mốc Trả hồ sơ + ✓ Xong
      cur.ok(good ? `trang báo “${good.raw.slice(0, 80)}”` : 'cửa sổ Trả hồ sơ đã đóng (chưa thấy câu báo thành công – bạn kiểm tra)');
      if (good) step(`TB ${tb.tb}`).ok('✓ Xong');
      setEvt(
        `✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: ${good ? 'đã <b>Trả hồ sơ</b> – <b>✓ Xong</b>' : 'đã bấm Trả hồ sơ – bạn kiểm tra trên VBDLIS'}.`,
        !good
      );
      tailOk = `<div class="hint">${good ? `✓ TB ${esc(tb.tb)} xong (đã Trả hồ sơ).` : 'Xong bước Trả hồ sơ của hồ sơ này.'}</div>`;
      tailNeed = '-';
      // làm tiếp TB khác (bạn yêu cầu 22/11): còn TB chờ ở Danh sách hồ sơ thụ lý → về Xử lý công việc tìm tiếp; không còn → TB chưa tiếp nhận
      if (good && AUTO()) {
        await sleep(1500);
        const ps = sweepList();
        if (ps.length) {
          const list12 = ps.slice(0, 12).map((y) => y.tb).join(', ');
          if (!onListPage() && !(await topNow())) {
            const nav = navXuLyCongViec();
            if (nav) {
              step('TB tiếp theo').ok(`còn ${ps.length} TB chờ (${list12}) – về Danh sách hồ sơ thụ lý tìm tiếp`);
              setSweepPause(false);
              await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
            } else step('TB tiếp theo').skip(`còn ${ps.length} TB chờ (${list12}) – bấm “Xử lý công việc”, 🤖 tìm tiếp`);
          } else step('TB tiếp theo').ok(`còn ${ps.length} TB chờ (${list12}) – 🤖 tìm tiếp ở Danh sách hồ sơ thụ lý`);
        } else {
          const i0 = S.data.findIndex((y) => String(y.tb) === String(recvAtStart));
          const c0 = i0 >= 0 ? S.data[i0] : null;
          // TB đang chọn (con trỏ tiếp nhận) còn “Chưa làm” → làm TB đó; không thì TB chưa làm phía sau
          const nx =
            S.opts.tuSangTB === false ? null : c0 && stageOf(c0) === 'chua' && !(S.stage[String(c0.tb)] || {}).tnClick ? c0 : nextTodo(true, i0);
          if (nx) {
            stage3 = false; // chuyển TB đang chọn sang TB chưa tiếp nhận (có chủ ý)
            setPtr(nx.tb);
            try {
              await stageChain;
              await store.set({ tbCur: S.cur, tbRecv: S.recv, tbCurBy: '' });
            } catch (e) {}
            render();
            const a = linkVeTiepNhan() || navTiepNhan();
            if (a) {
              step('TB tiếp theo').ok(`TB ${nx.tb} – ${whoOf(nx)}: sang màn hình Tiếp nhận hồ sơ`);
              S.autoSig = '';
              await goAndWait(a, a === linkVeTiepNhan() ? 'Về trang tiếp nhận hồ sơ' : 'Tiếp nhận hồ sơ', recvDone);
            } else step('TB tiếp theo').skip(`TB ${nx.tb} chưa tiếp nhận – mở màn hình Tiếp nhận hồ sơ (trống), 🤖 tự làm`);
          } else step('TB tiếp theo').ok('đã làm hết các TB trong dữ liệu');
        }
      }
    };
    // đi trang bằng đường link rồi CHỜ trang chuyển (≤ 15 giây: trang bắt đầu tải lại / đổi địa chỉ / đã thấy màn hình cần tới).
    // Không chuyển → thử địa chỉ đã nhớ (alt) → vẫn không → dừng, kêu, kèm dòng “Để báo lỗi” (bạn tự bấm mục đó, 🤖 làm tiếp)
    const goAndWait = async (el, what, done, alt) => {
      const tries = [el, alt && alt !== el ? alt : null].filter(Boolean);
      let how = '';
      for (const x of tries) {
        const href0 = location.href;
        const t0 = Date.now();
        how = goLink(x);
        if (await waitUntil(() => (S.leaving || 0) >= t0 || location.href !== href0 || (!!done && done()), 15000, alive)) return how;
      }
      log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): ${navDiag(el, how)}`) });
      needYou(`Bấm “${what}” mà trang không chuyển`, 'bad');
      throw new Error(`đã bấm “${what}” mà trang không chuyển (15 giây) – bạn tự bấm “${what}”, 🤖 làm tiếp; chụp dòng “Để báo lỗi” gửi người hỗ trợ`);
    };
    const recvDone = () => !!btnLuuHoSo() && !btnXuLyHoSo();
    // 🤖 chạy liên tục (bạn yêu cầu 24/11): TB vừa tạm hoãn vì vướng → đóng LẦN LƯỢT các cửa sổ của chuỗi còn mở (Hủy bỏ / Đóng / × – không lưu;
    // cửa sổ lạ, hộp hỏi / thông báo chưa dạy → dừng chờ bạn), rồi về Danh sách hồ sơ thụ lý (đang ở màn hình Tiếp nhận mà còn TB chưa tiếp nhận:
    // về Tiếp nhận hồ sơ trống) – 🤖 làm TB khác
    const cvGoBack = async () => {
      const lv = S.cvLeave || {};
      title = `🤖 Chạy liên tục – rời TB ${lv.tb || ''} (${lv.done ? 'không còn việc ở đây' : 'đã tạm hoãn'}), làm TB khác`;
      cur = step('Đóng cửa sổ của TB vừa tạm hoãn (không lưu)');
      // (soát 24/11) hồ sơ đang mở phải là của TB vừa tạm hoãn (đọc được số) – không thì không đóng gì
      try {
        const own = await openDossierTbs();
        if (own.length === 1 && String(own[0].tb) !== String(lv.tb)) {
          S.cvLeave = null;
          cur.skip(`hồ sơ đang mở là của TB ${own[0].tb}, không phải TB ${lv.tb} – không đóng gì`);
          tailNeed = '-';
          return;
        }
      } catch (e) {}
      // (24/11) trang còn “Đang xử lý…” (vd. sau Thực hiện Trả hồ sơ) → chưa đóng gì, 20 giây sau 🤖 xét lại
      if (pageWorking() && (lv.pw || 0) < 3) {
        S.cvLeave = { ...lv, at: Date.now(), now: 0, pw: (lv.pw || 0) + 1 };
        cur.skip('trang đang “Đang xử lý…” – 20 giây sau 🤖 đóng tiếp');
        tailNeed = '-';
        return;
      }
      const shut = [];
      for (let i = 0; i < 10; i++) {
        stopIf();
        if (pageDialog() || realDlgOpen(await act('dialogState'))) {
          // hộp đã biết / bạn đã dạy → bấm theo mẫu rồi đóng tiếp; hộp chưa dạy → chờ bạn (bạn trả lời xong 🤖 đóng tiếp)
          const a = (await act('answerDialog', { rules: AUTO_DIALOGS })).find((x) => x.ok);
          if (a) {
            await sleep(900);
            continue;
          }
          S.cvLeave = { ...lv, at: Date.now(), now: 1, box: 1 }; // box: bộ theo dõi đếm lại từ lúc hộp đóng (bạn trả lời hộp không tính là “bạn đang làm”)
          needYou('Trang đang hỏi – bạn xem', 'bad');
          throw ask('trang đang hiện hộp hỏi / thông báo chưa dạy – tiện ích chưa đóng tiếp; bạn trả lời hộp đó (hoặc dạy hộp này ở tab Trường), 🤖 đóng tiếp', '');
        }
        let tp = await topNow();
        if (!tp && shut.length) {
          // cửa sổ dưới (Quy trình…) có thể mở lại chậm sau khi đóng cửa sổ tác vụ
          await waitUntil(() => !!qtModal() || !!pageDialog(), 6000, alive);
          tp = await topNow();
        }
        if (!tp) break;
        const key = modalKey(tp);
        if (!CV_LEAVE_WIN.some((re) => re.test(key))) {
          S.cvLeave = null;
          throw ask(`đang mở ${tp.name} – tiện ích không tự đóng cửa sổ này; bạn đóng rồi 🤖 làm tiếp`, '');
        }
        if (Date.now() - USER.at < 2000) {
          // bạn vừa bấm / gõ trên trang → không đóng (bạn đang làm)
          S.cvLeave = null;
          cur.skip('bạn đang thao tác trên trang – tiện ích không đóng cửa sổ');
          tailNeed = '-';
          return;
        }
        const r = (await act('closeTop', { win: '^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })).find((y) => y.ok);
        if (!r) {
          S.cvLeave = null;
          throw ask(`không đóng được ${tp.name} – bạn đóng giúp rồi 🤖 làm tiếp`, '');
        }
        shut.push(tp.name);
        await sleep(1200);
      }
      cur.ok(shut.length ? `đã đóng ${shut.join(', ')}` : 'không còn cửa sổ mở');
      tailNeed = '-';
      S.cvLeave = null;
      if (onListPage()) return; // ở danh sách → 🤖 tìm tiếp TB khác
      const recv = !!btnLuuHoSo() && !btnXuLyHoSo() && S.opts.tuSangTB !== false && !!nextTodo(true);
      // màn hình Tiếp nhận: thanh trái có thể không có đường link thật → về danh sách (từ đó 🤖 sang Tiếp nhận); không có gì thì tải lại trang
      const nav = recv ? navTiepNhan() || navXuLyCongViec() || listUrlLink() : navXuLyCongViec() || listUrlLink();
      if (!nav) {
        if (btnLuuHoSo() && !btnXuLyHoSo()) {
          cur = step('Tải lại màn hình Tiếp nhận hồ sơ (trống) – TB sau');
          cur.ok();
          setTimeout(() => location.reload(), 1200);
          return;
        }
        throw new Error('không thấy mục “Xử lý công việc” ở thanh bên trái – bạn mở Danh sách hồ sơ thụ lý, 🤖 làm tiếp');
      }
      cur = step('Về Danh sách hồ sơ thụ lý / Tiếp nhận – TB khác');
      await goAndWait(nav, 'Xử lý công việc', () => onListPage() && !qtModal(), listUrlLink());
      cur.ok();
      tailNeed = '-';
    };
    // trang tải lại ngay sau khi bấm Thực thi chuyển lãnh đạo, hồ sơ không còn nút “Xử lý hồ sơ” → đã chuyển → sang TB sau
    const ldPending = (s) => pending(s, 'ld') && !s.ld && !s.fwd.bad && Date.now() - s.fwd.at < 10 * 60 * 1000;
    const runAfterLd = async () => {
      cur = step('Hồ sơ vừa bấm Thực thi chuyển lãnh đạo');
      const { x, so } = await dossierTb(false);
      if (!ldPending(S.stage[String(x.tb)] || {})) throw new Error(`hồ sơ ${so} không còn nút “Xử lý hồ sơ” – tiện ích không biết làm gì tiếp`);
      if (String(x.tb) !== String(S.recv) && String(x.tb) === chainTbId()) stage3 = true; // TB 🤖 mở từ danh sách – không đổi con trỏ tiếp nhận
      if (x !== tb) setTb(x);
      markStage(tb.tb, 'ld', 'suy');
      cur.ok(`${so} – TB ${tb.tb}: sau khi bấm Thực thi, hồ sơ không còn nút “Xử lý hồ sơ” → đã chuyển lãnh đạo`);
      setEvt(`✓ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: đã chuyển lãnh đạo – <b>◐ Đã nhập nhưng chưa xong</b>.`);
      return goNext(true);
    };
    // xong TB (đã chuyển lãnh đạo) → TB chưa làm tiếp theo: bấm “Về trang tiếp nhận hồ sơ”; màn hình tiếp nhận trống hiện ra là tự chạy TB đó
    // fromView: mở lại hồ sơ đã chuyển lãnh đạo – chỉ sang TB sau khi vừa chuyển xong (15 phút), không thì để yên
    const goNext = async (fromView) => {
      const s = S.stage[String(tb.tb)] || {};
      cur = step('TB tiếp theo');
      if (fromView && !ldRecent(s)) {
        cur.skip(`TB ${tb.tb} đã chuyển lãnh đạo lúc ${fmtTime(s.ld)} – hồ sơ này không còn việc của tiện ích lúc này`);
        tailNeed = '-';
        return;
      }
      if (!AUTO() || S.opts.tuSangTB === false) {
        cur.skip('đang tắt “Tự sang TB sau” – mở màn hình tiếp nhận mới khi muốn làm TB sau');
        tailNeed = '-';
        return;
      }
      // (24/11 – làm hết TB ◐ rồi mới tiếp nhận TB mới) hồ sơ cũ mở từ Danh sách hồ sơ thụ lý vừa chuyển lãnh đạo mà lượt tìm còn TB ◐ chưa tìm
      // → về Danh sách hồ sơ thụ lý tìm tiếp (cùng đường link “Xử lý công việc” 🤖 vẫn dùng); hết lượt thì bộ theo dõi mới sang tiếp nhận
      if (stage3 && roundNext(sweepList())) {
        const nav = navXuLyCongViec();
        if (nav) {
          cur.ok('còn TB ◐ chưa tìm trong lượt này – về Danh sách hồ sơ thụ lý tìm tiếp (hết lượt mới sang tiếp nhận TB mới)');
          tailNeed = '-';
          try {
            await stageChain;
          } catch (e) {}
          setSweepPause(false);
          await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
          return;
        }
      }
      // TB chưa làm tiếp theo – tính từ TB xa nhất đã tới (TB đang chọn lúc bắt đầu / TB vừa xong): không quay lại TB phía trước
      const iCur = S.data.findIndex((y) => String(y.tb) === String(recvAtStart));
      const i0 = Math.max(iCur, S.data.indexOf(tb));
      // TB đang chọn lúc bắt đầu (con trỏ tiếp nhận) còn “Chưa làm”, chưa bấm Lưu hồ sơ → vẫn là TB tiếp theo (không nhảy qua TB đó)
      const c0 = iCur >= 0 ? S.data[iCur] : null;
      const nx = c0 && c0 !== tb && stageOf(c0) === 'chua' && !(S.stage[String(c0.tb)] || {}).tnClick ? c0 : nextTodo(true, i0);
      if (!nx) {
        // hết TB chưa tiếp nhận → còn TB “Đã tiếp nhận” chưa xong → “Xử lý công việc” (thanh trái) → Danh sách hồ sơ thụ lý: tìm từng hồ sơ
        const ps = sweepList();
        const ckN = ps.length ? 0 : chkList().length; // (24/11) chỉ còn TB ✓ chưa kiểm lại → cũng sang danh sách
        const nav = ps.length || ckN ? navXuLyCongViec() : null;
        if (nav) {
          cur.ok(
            ps.length
              ? `hết TB chưa tiếp nhận – sang “Xử lý công việc” tìm ${ps.length} TB ◐ đang chờ: ${ps.slice(0, 12).map((y) => y.tb).join(', ')}`
              : `hết TB chưa tiếp nhận, hết TB ◐ – sang “Xử lý công việc” kiểm lại ${ckN} TB ✓ Xong chưa kiểm`
          );
          tailNeed = '-';
          tailOk = ps.length
            ? '<div class="hint">🤖 Sang <b>Danh sách hồ sơ thụ lý</b>: tiện ích gõ số biên nhận từng TB “◐ Đã nhập nhưng chưa xong” vào ô tìm – không thấy thì 5 giây sau đổi sang số biên nhận khác; ra hồ sơ thì bấm vào hồ sơ → <b>Xử lý hồ sơ</b> → làm tiếp.</div>'
            : '<div class="hint">🤖 Sang <b>Danh sách hồ sơ thụ lý</b>: tiện ích gõ số biên nhận từng TB ✓ Xong chưa kiểm lại – hồ sơ còn trong danh sách (sót) thì đổi TB đó về ◐ rồi làm tiếp.</div>';
          // giữ chữ ký màn hình hồ sơ này: trang chuyển chậm thì không bấm “Xử lý công việc” lần nữa
          try {
            await stageChain; // tiến độ TB vừa xong đã ghi hẳn rồi mới đi trang
          } catch (e) {}
          setSweepPause(false);
          await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
          return;
        }
        cur.ok(`hết TB chưa làm phía sau trong dữ liệu – hết lượt${ps.length ? ` (còn ${ps.length} TB “Đã tiếp nhận” chưa xong – không thấy “Xử lý công việc” ở thanh trái)` : ''}`);
        tailNeed = 'Hết lượt TB';
        tailOk = '<div class="hint">✓ Đã làm hết các TB chưa làm trong dữ liệu.</div>';
        return;
      }
      stage3 = false; // chuyển TB đang chọn sang TB sau (có chủ ý)
      setPtr(nx.tb);
      try {
        await stageChain; // tiến độ TB vừa xong đã ghi hẳn
        await store.set({ tbCur: S.cur, tbRecv: S.recv, tbCurBy: '' }); // ghi xong rồi mới đi trang
      } catch (e) {}
      const a = linkVeTiepNhan();
      if (!a) {
        cur.skip(`đã chọn TB ${nx.tb} – không thấy link “Về trang tiếp nhận hồ sơ”: mở màn hình tiếp nhận mới, tiện ích tự chạy`);
        tailNeed = '-';
        return;
      }
      cur.ok(`TB ${nx.tb} – ${whoOf(nx)}: bấm “Về trang tiếp nhận hồ sơ”`);
      tailNeed = '-';
      tailOk = `<div class="hint">🤖 Sang TB <b>${esc(nx.tb)}</b>: màn hình tiếp nhận trống hiện ra là tiện ích tự chạy.</div>`;
      S.autoSig = '';
      await goAndWait(a, 'Về trang tiếp nhận hồ sơ', recvDone);
    };

    // ---------- Vai trò Lãnh đạo: ký duyệt → chuyển bước 4 (bạn yêu cầu 23/11, như bản 0.9.3) ----------
    // hộp của trang lúc này – CHỈ xem (không trả lời, kể cả hộp bạn đã dạy ở tab Trường)
    const dlgPeek = async () => {
      const rs = await act('answerDialog', { rules: [], learned: [] });
      const o = rs.find((x) => x.open);
      return o ? { title: o.title || '', text: o.text || o.title || '' } : null;
    };
    // lỗi cài đặt / tài khoản: 🤖 vai trò Lãnh đạo dừng hẳn tới khi bạn sửa rồi bấm ▶ (hoặc tắt / bật lại 🤖)
    const ldBlockErr = (msg) => {
      S.ld.block = msg;
      ldSave();
      renderLd();
      needYou('Lãnh đạo – sửa cài đặt', 'bad');
      return ask(msg, '');
    };
    // tài khoản đăng nhập phải là tài khoản lãnh đạo (khi thấy rõ và đã đặt), có tài khoản nhận bước 4 (không phải tài khoản lãnh đạo)
    const ldPre = () => {
      const me = loginName();
      const lead = accNorm(S.opts.ctLD || '');
      if (me && lead && me !== lead)
        throw ldBlockErr(
          `tài khoản đang đăng nhập là “${me}”, khác tài khoản lãnh đạo trong cài đặt (“${S.opts.ctLD}”) – vai trò Lãnh đạo chỉ chạy bằng tài khoản lãnh đạo (sửa ô Lãnh đạo ở tab Biên nhận, hoặc đổi Vai trò về Chuyên viên)`
        );
      const acc = ldRecv();
      if (!acc) throw ldBlockErr('chưa có tài khoản nhận bước 4 (chuyên viên hoàn tất hồ sơ) – điền ô Chuyên viên ở tab Biên nhận (hoặc ô “Người nhận bước 4” ở bảng Lãnh đạo)');
      if ((me && accNorm(acc) === me) || (lead && accNorm(acc) === lead))
        throw ldBlockErr(`tài khoản nhận bước 4 (“${acc}”) là tài khoản lãnh đạo – điền tài khoản chuyên viên vào ô “Người nhận bước 4” (bảng Lãnh đạo)`);
      return acc;
    };
    // lỗi của một hồ sơ đã ghi dấu ngay tại chỗ (runLeader không đếm thêm lần lỗi)
    const ldDoneErr = (msg, html) => {
      const e = ask(msg, html || '');
      e.ldDone = true;
      return e;
    };
    const ldRedoBtn = (key, so) => `<button class="btn pri" data-ldredo="${esc(key)}">Chưa chuyển – làm lại hồ sơ ${esc(so)}</button>`;
    // sau Thực thi: chờ về Danh sách hồ sơ thụ lý – hồ sơ không còn (danh sách đủ) / đã sang bước khác = xong. KHÔNG tìm số biên nhận nữa
    // (bạn chọn 24/11: “Bỏ tìm, chỉ F5”): danh sách chưa cho biết chắc → trang đã báo chuyển thành công thì ghi ✓, chưa báo thì giữ dấu
    // “đã bấm Thực thi”; rồi TẢI LẠI TRANG (F5) – trang tải xong ldScanPage chốt (rời danh sách đủ / sang bước khác → ✓; vẫn ở bước lãnh đạo:
    // dấu ✓ → làm lại 1 lần, dấu “đã bấm Thực thi” 2 phút → lỗi, thử lại sau)
    const ldVerify = async (key, so, sure) => {
      cur = step('Kiểm tra hồ sơ đã rời bước lãnh đạo');
      const back = await waitUntil(() => onListPage() && !listBusy() && !qtModal() && !chooserModal(), 20000 * slowK(), alive);
      const done = (m) => {
        ldOk(key, so, m);
        cur.ok(m);
        tailNeed = '-';
        tailOk = `<div class="hint">✓ Hồ sơ <b>${esc(so)}</b> đã ký duyệt, chuyển bước 4.${AUTO() ? ' 🤖 làm hồ sơ tiếp theo.' : ''}</div>`;
      };
      let still = false; // danh sách (vừa vẽ lại) vẫn ghi hồ sơ ở bước lãnh đạo
      if (back) {
        await sleep(1500);
        const r1 = ldPageRows().find((x) => x.key === key);
        if (!r1 && ldFull()) return done('hồ sơ đã rời danh sách của bạn');
        if (r1 && r1.step && !LD_STEP.test(r1.step)) return done(`hồ sơ đang ở bước “${r1.stepText || r1.step}”`);
        still = !!(r1 && r1.step && LD_STEP.test(r1.step));
      }
      // trang báo thành công: ghi ✓ – trừ khi danh sách vẫn ghi bước lãnh đạo (giữ “đã bấm Thực thi”, tải lại trang rồi danh sách mới quyết định)
      if (sure && !still) done(`trang báo chuyển thành công${back ? ' – tải lại trang để danh sách mới' : ''}`);
      else {
        cur.skip(back ? `${sure ? 'trang báo chuyển thành công nhưng danh sách vẫn ghi bước lãnh đạo' : 'danh sách chưa cho biết chắc'} – tải lại trang (F5) để kiểm tra` : 'chưa thấy lại Danh sách hồ sơ thụ lý – lần đọc danh sách sau sẽ kiểm tra');
        S.ld.cur = null;
        ldSave();
        tailNeed = '-';
      }
      if (back && AUTO()) {
        ldReload();
        log.push({ icon: '•', cls: 'muted', html: esc('tải lại trang (như bấm F5) để danh sách mới – trang tải xong 🤖 làm tiếp') });
      }
    };
    // cửa sổ “Chọn người xử lý tác vụ tiếp theo” của hồ sơ lãnh đạo: đúng bước “… Chuyên viên hoàn tất … (Tiếp theo)”, đúng tài khoản nhận bước 4
    // → Thực thi. ours: cửa sổ do tiện ích vừa Chuyển tiếp (🤖); không thì chỉ chọn sẵn đúng người, tô vàng Thực thi cho bạn bấm
    const runLdChooser = async (ours, adopt) => {
      const m = chooserModal();
      if (!m) throw new Error('không thấy cửa sổ “Chọn người xử lý tác vụ tiếp theo”');
      const acc = ldPre();
      cur = step('Chọn người nhận bước 4');
      let info0 = await chooserSettled(m, alive);
      if (!info0) throw new Error('danh sách người nhận chưa tải xong (hoặc còn đang thay đổi)');
      const so = await dossierSo();
      const key = so ? soKey(so) : '';
      if (!key) throw ask('không đọc được Số biên nhận của hồ sơ – tiện ích không chọn người (tránh chuyển nhầm hồ sơ)', '');
      if (ours && (!S.ld.cur || S.ld.cur.key !== key)) throw new Error(`cửa sổ chọn người là của hồ sơ ${so}, không phải hồ sơ tiện ích vừa chuyển tiếp – tiện ích dừng`);
      if (!S.ld.cur || S.ld.cur.key !== key) S.ld.cur = { key, so, at: Date.now(), phase: 'ch' };
      ldSave();
      title = `👔 Lãnh đạo – hồ sơ ${so}`;
      show();
      const st = norm(info0.step);
      const want = ldBuocN();
      if (!want || !st.includes(want) || !/\(tiep theo\)/.test(st) || /tra ve|\(truoc\)/.test(st))
        throw ask(`ô bước nhận đang là “${info0.step || '(trống)'}”, không phải bước “… ${S.opts.ldBuoc || LD_BUOC_DEF} … (Tiếp theo)” – tiện ích không chuyển`, '');
      if (!ours || adopt) {
        // cửa sổ mở sẵn (cả khi 🤖 nhận làm tiếp): bạn đang chọn người KHÁC tài khoản nhận bước 4 → không đổi người, không bấm Thực thi
        const mk0 = markedRows(info0.rows);
        if (mk0.length === 1 && accNorm(mk0[0].acc) !== accNorm(acc))
          throw ask(`trong cửa sổ đang chọn “${mk0[0].acc}”, khác tài khoản nhận bước 4 (“${acc}”) – tiện ích không đổi người, không bấm Thực thi`, '');
      }
      const it = S.ld.items[key] || {};
      if (it.st === 'lam' && it.fwdAt && Date.now() - it.fwdAt < 10 * 60 * 1000)
        throw ask(`đã bấm “Thực thi” cho hồ sơ ${so} lúc ${fmtTime(it.fwdAt)} mà chưa xác nhận đã chuyển – kiểm tra trên VBDLIS; chưa chuyển thì bấm nút dưới`, ldRedoBtn(key, so));
      // ô / nút bạn tích trong mẫu cửa sổ này (tab Trường) – làm trước nút quyết định Thực thi (như chuỗi chuyên viên); bước nhận phải giữ nguyên
      if (AUTO() && !S.opts.thuThucThi && ours) {
        const ex = await tplChainExtras({ base: '', decide: ['thuc thi'], fields: true, step });
        if (ex) throw ask(`${ex} – tiện ích không bấm Thực thi; bạn xem rồi bấm “▶ Chạy cả TB”`, '');
        if (!(m.isConnected && shownEl(m))) throw new Error('cửa sổ chọn người vừa đóng sau khi làm theo mẫu tab Trường');
        const info1 = await chooserSettled(m, alive);
        if (!info1) throw new Error('danh sách người nhận chưa tải xong (hoặc còn đang thay đổi)');
        if (norm(info1.step) !== st) throw ask(`bước nhận đổi thành “${info1.step}” sau khi làm theo mẫu tab Trường – tiện ích không chuyển`, '');
        if (adopt) {
          const mk1 = markedRows(info1.rows);
          if (mk1.length === 1 && accNorm(mk1[0].acc) !== accNorm(acc))
            throw ask(`trong cửa sổ đang chọn “${mk1[0].acc}”, khác tài khoản nhận bước 4 (“${acc}”) – tiện ích không đổi người, không bấm Thực thi`, '');
        }
        info0 = info1;
      }
      const p = await pickAccount(m, acc, alive);
      if (!p.ok) {
        if (p.diag) {
          log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): ${p.diag}`) });
          show();
        }
        needYou('Chọn người nhận – bạn xem', 'bad');
        throw ask(`${p.why} – bạn tự chọn đúng người (${acc}) rồi bấm “Thực thi”`, '');
      }
      cur.ok(`${p.row.acc} – ${p.row.name}${p.row.unit ? ' – ' + p.row.unit : ''} · bước “${p.step}”`);
      const go = [...m.querySelectorAll('button, a')].find((x) => shownEl(x) && (x.id === 'btnExecuteCommand' || btnText(x) === 'thuc thi'));
      if (!go) throw new Error('không thấy nút “Thực thi”');
      if (!AUTO() || S.opts.thuThucThi || !ours) {
        ringFor(go, 60000);
        cur = step('Nút “Thực thi”');
        cur.ok(
          `đã chọn đúng người, tô vàng – bạn kiểm tra rồi tự bấm${
            AUTO() ? (S.opts.thuThucThi ? ' (đang bật “Chạy thử”)' : ' (cửa sổ này không do tiện ích chuyển tiếp)') : ''
          }`
        );
        S.ld.tt = { key, so, at: Date.now() };
        S.ld.cur = null;
        ldSet(key, { so, wait: Date.now() }); // 🤖 không mở lại hồ sơ này (bạn bấm Thực thi / ▶ / bật lại 🤖)
        tailOk = `<div class="hint">Đã chọn sẵn <b>${esc(p.row.acc)}</b> (bước “${esc(p.step)}”). Bạn kiểm tra rồi tự bấm <b>Thực thi</b>; hồ sơ rời bước lãnh đạo thì tiện ích ghi nhận${
          AUTO() ? ' và 🤖 làm hồ sơ tiếp theo' : ''
        }.</div>`;
        tailNeed = 'Bấm “Thực thi”';
        return;
      }
      cur = step(`Bấm “Thực thi” – chuyển bước 4 cho ${p.row.acc}`);
      stopIf();
      ldSet(key, { so, st: 'lam', fwdAt: Date.now(), msg: '', vN: 0 }); // ghi TRƯỚC khi bấm (trang có thể tải lại ngay)
      const t0 = Date.now();
      const why = chooserFinalClick(m, acc, st); // kiểm tra lần cuối + bấm, không có await ở giữa
      if (why) {
        ldSet(key, { st: it.st && it.st !== 'lam' ? it.st : 'cho', fwdAt: 0 });
        needYou('Chưa bấm Thực thi – bạn xem', 'bad');
        throw ask(`không bấm “Thực thi”: ${why} – bạn xem lại rồi bấm “▶ Chạy cả TB”`, '');
      }
      const r = await waitThucThi(m, t0);
      if (!r.ok && r.kind !== 'dlg' && AUTO()) {
        // (soát 24/11) chưa rõ đã chuyển chưa (bạn vừa thao tác / trang chậm / trang báo lỗi): không bỏ qua hẳn – giữ dấu “đã bấm Thực thi”, tải lại
        // trang (F5): danh sách mới cho biết (rời danh sách / sang bước khác → ✓; 2 phút vẫn ở bước lãnh đạo → lỗi, thử lại sau). 🤖 không bấm lại ngay
        ldSet(key, { so, st: 'lam', fwdAt: t0, vN: 0, msg: `đã bấm Thực thi nhưng ${r.why} – chờ danh sách mới (tải lại trang)` });
        cur.skip(`đã bấm Thực thi nhưng ${r.why} – tải lại trang (F5) để kiểm tra`);
        S.ld.cur = null;
        ldSave();
        tailNeed = '-';
        if (!chooserModal() && !qtModal()) ldReload();
        return;
      }
      if (!r.ok) {
        // không biết đã chuyển chưa → không tự thử lại (bạn kiểm tra)
        ldSet(key, { st: 'bo', n: LD_MAX, msg: `đã bấm Thực thi nhưng ${r.why} – bạn kiểm tra trên VBDLIS (🤖 không tự làm lại hồ sơ này)`, fwdAt: 0, retryAt: 0, failAt: Date.now() });
        needYou('Chuyển tiếp chưa rõ – bạn xem', 'bad');
        throw ldDoneErr(`đã bấm “Thực thi” nhưng ${r.why} – bạn kiểm tra trên VBDLIS (chưa chuyển thì bấm nút dưới)`, ldRedoBtn(key, so));
      }
      cur.ok(r.sure ? `trang báo “${r.say.slice(0, 80)}”` : 'cửa sổ chọn người đã đóng (chưa thấy câu báo thành công – kiểm tra tiếp)');
      return ldVerify(key, so, !!r.sure);
    };
    // Quy trình “Ký duyệt hồ sơ” đang mở (r: hồ sơ vừa mở từ danh sách; null: cửa sổ đang mở sẵn)
    const runLdQt = async (r) => {
      const q = await qtSettled(alive);
      if (!q) throw new Error('cửa sổ Quy trình xử lý chưa tải xong (hoặc còn đang thay đổi)');
      const ft = qtFilterText(q.m);
      if (ft) throw ask(`ô “Nhập tên tác vụ cần tìm…” đang có chữ “${ft}” (một số tác vụ bị ẩn) – xóa chữ đó rồi bấm “▶ Chạy cả TB”`, '');
      const so = await dossierSo();
      if (!so) throw ask('không đọc được Số biên nhận của hồ sơ đang mở – tiện ích không xử lý (tránh chuyển nhầm hồ sơ)', '');
      const key = soKey(so);
      if (r && key !== r.key) throw new Error(`Quy trình vừa mở là của hồ sơ ${so}, không phải ${r.so} – tiện ích dừng, không làm gì trên Quy trình này`);
      S.ld.cur = { key, so, at: Date.now(), phase: 'qt' };
      ldSave();
      title = `👔 Lãnh đạo – hồ sơ ${so}`;
      cur = step(`Quy trình xử lý – hồ sơ ${so}`);
      if (q.v !== 'kd')
        throw ask(
          `Quy trình xử lý có tác vụ ${q.rows.map((x) => `“${x.name}”`).join(', ') || '(trống)'} – không phải bước ký duyệt (chỉ có “Ký duyệt hồ sơ”); tiện ích không làm hồ sơ này`,
          ''
        );
      const it = S.ld.items[key] || {};
      if (it.st === 'lam' && it.fwdAt && Date.now() - it.fwdAt < 10 * 60 * 1000)
        throw ask(
          `đã bấm “Thực thi” cho hồ sơ ${so} lúc ${fmtTime(it.fwdAt)} mà Quy trình vẫn mở được ở bước ký duyệt – có thể CHƯA chuyển. Bạn kiểm tra trên VBDLIS; chưa chuyển thì bấm nút dưới`,
          ldRedoBtn(key, so)
        );
      cur.ok('Ký duyệt hồ sơ');
      if (!AUTO()) {
        // 🤖 tắt: chỉ tô vàng – bạn tự tích “Đã xử lý” và bấm Chuyển tiếp
        cur = step('Tích “Đã xử lý”, “Chuyển tiếp”');
        const marks = qtRows(q.m)
          .filter((x) => x.chk && !x.chk.checked)
          .map((x) => x.chk);
        const fb0 = [...q.m.querySelectorAll('button, a')].find((x) => shownEl(x) && btnText(x) === 'chuyen tiep');
        if (fb0) marks.push(fb0);
        marks.forEach((el) => ringScan(el, true));
        setTimeout(() => marks.forEach((el) => ringScan(el, false)), 60000);
        cur.ok('đã tô vàng – bạn tự tích “Đã xử lý” rồi bấm “Chuyển tiếp”; ở cửa sổ chọn người bấm “▶ Chạy cả TB” để tiện ích chọn sẵn đúng người');
        S.ld.cur = null;
        ldSave();
        tailOk = '<div class="hint">Bật <b>🤖 Tự động</b> để tiện ích tự tích “Ký duyệt hồ sơ”, chuyển bước 4 đúng người và làm lần lượt các hồ sơ.</div>';
        tailNeed = '-';
        return;
      }
      for (const r0 of q.rows) {
        cur = step(`Tích “Đã xử lý” – ${r0.name}`);
        cur.ok(await tickQt(r0));
      }
      const q3 = await qtSettled(alive);
      if (!q3 || q3.v !== 'kd') throw new Error('cửa sổ Quy trình xử lý vừa đổi – bấm “▶ Chạy cả TB” lại');
      const left = q3.rows.filter((x) => !x.chk.checked);
      if (left.length) throw new Error(`còn tác vụ chưa tích “Đã xử lý”: ${left.map((x) => x.name).join(', ')}`);
      cur = step('Bấm “Chuyển tiếp”');
      const tp = await topNow();
      if (!tp || !/^quy trinh xu ly\b/.test(modalKey(tp))) throw new Error(`cửa sổ trên cùng là ${tp ? tp.name : 'màn hình chính'}, không phải Quy trình xử lý`);
      const fb = [...q3.m.querySelectorAll('button, a')].find((x) => shownEl(x) && btnText(x) === 'chuyen tiep');
      if (!fb) throw new Error('không thấy nút “Chuyển tiếp” của cửa sổ Quy trình xử lý');
      if (Date.now() - USER.at < 2000) throw ask('bạn vừa bấm / gõ trên trang – tiện ích không bấm “Chuyển tiếp”; bấm “▶ Chạy cả TB” khi xong', '');
      const t0 = Date.now();
      clickPage(fb);
      let ch = null;
      for (let i = 0; i < 60 && !ch; i++) {
        stopIf();
        await sleep(400);
        ch = chooserModal();
        if (ch) break;
        if (toastsSince(t0).some(toastOk)) {
          needYou('Đã chuyển tiếp – bạn kiểm tra', 'bad');
          throw ask('bấm “Chuyển tiếp” xong trang báo thành công luôn, KHÔNG hiện cửa sổ chọn người – tiện ích không kiểm được người nhận, bạn kiểm tra trên VBDLIS', '');
        }
        const d = await dlgNow(FWD_DIALOGS);
        if (d && !d.answered) {
          needYou('Trang báo – bạn xem', 'bad');
          throw ask(`bấm “Chuyển tiếp”, trang báo: “${(d.text || d.title || '').slice(0, 200)}” – tiện ích dừng`, '');
        }
      }
      if (!ch) throw new Error('bấm “Chuyển tiếp” rồi mà chưa thấy cửa sổ “Chọn người xử lý tác vụ tiếp theo”');
      cur.ok();
      S.ld.cur = { key, so, at: Date.now(), phase: 'ct' };
      ldSave();
      return runLdChooser(true);
    };
    // bấm “Xử lý hồ sơ” (dòng đã chọn / màn hình hồ sơ) → Quy trình. Trang báo hồ sơ đã chuyển → xong; không thuộc bạn → bỏ qua
    const ldOpenQt = async (r) => {
      {
        const t0m = await topNow();
        if (t0m && (realModals().length || (t0m.frame && t0m.frame !== location.href)))
          throw new Error(`đang có cửa sổ mở trên trang (${t0m.frame && t0m.frame !== location.href ? t0m.name || 'khung con' : modalDiag()}) – tiện ích không bấm “Xử lý hồ sơ”`);
        let d0 = await dlgPeek();
        if (d0 && AUTO()) {
          const tl0 = await dlgNow([]); // hộp bạn đã dạy (tab Trường) → bấm theo mẫu (soát 24/11)
          if (tl0 && tl0.answered) d0 = await dlgPeek();
        }
        if (d0) throw ask(`trang đang hiện hộp “${(d0.text || d0.title || '').slice(0, 120)}” – bạn trả lời hộp đó trước rồi bấm “▶ Chạy cả TB”`, '');
      }
      cur = step('Bấm “Xử lý hồ sơ”');
      const b = btnXuLyHoSo();
      if (!b) throw new Error('không thấy nút “Xử lý hồ sơ”');
      const tq = Date.now();
      clickPage(b);
      let got = '';
      let d = null;
      let taughtN = 0;
      for (let i = 0; i < 60 && !got; i++) {
        stopIf();
        await sleep(400);
        const m = qtModal();
        if (m && qtRows(m).length) got = 'qt';
        else if ((d = await dlgPeek())) {
          // (soát 24/11) hộp bạn đã dạy (không phải hộp “hồ sơ đã chuyển / không còn của bạn”) → 🤖 bấm theo mẫu rồi chờ tiếp Quy trình (tối đa 3 hộp)
          if (AUTO() && taughtN < 3 && !LD_MOVED.test(norm(d.text || d.title || ''))) {
            const tl = await dlgNow([]);
            if (tl && tl.answered) {
              taughtN++;
              i = 0;
              continue;
            }
          }
          got = 'dlg';
        } else {
          const bad = toastsSince(tq).find(toastBad);
          if (bad) {
            const e = new Error(`bấm “Xử lý hồ sơ”, trang báo “${bad.raw.slice(0, 150)}”`);
            e.chonHoSo = /chon ho so|chua chon/.test(norm(bad.text || bad.raw || ''));
            throw e;
          }
        }
      }
      if (got === 'dlg') {
        const dt = norm(d.text || d.title || '');
        if (LD_MOVED.test(dt)) {
          const so3 = await dossierSo();
          if (so3 && soKey(so3) !== r.key) throw new Error(`bấm “Xử lý hồ sơ”, trang báo “${d.text.slice(0, 160)}” – nhưng hồ sơ đang chọn là ${so3}, không phải ${r.so}`);
          const okD = (await act('answerDialog', { rules: [{ re: '.', btn: ['Đóng', 'OK'] }], learned: [] })).some((x) => x.ok);
          if (!okD) {
            // hộp chỉ có “Đồng ý”: bấm khi là câu BÁO (không hỏi); hộp hỏi → để bạn trả lời
            if (/\?|co muon|co chac|xac nhan|ban co/.test(dt)) throw ask(`bấm “Xử lý hồ sơ”, trang hỏi: “${(d.text || '').slice(0, 200)}” – bạn tự trả lời`, '');
            await act('answerDialog', { rules: [{ re: '.', btn: ['Đồng ý'] }], learned: [] });
          }
          if (/khong (phai|thuoc|co quyen|con quyen)/.test(dt) && !/da (duoc )?chuyen|nguoi khac|da duoc xu ly/.test(dt)) {
            ldSet(r.key, { so: r.so, st: 'bo', msg: `trang báo “${d.text.slice(0, 120)}”`, fwdAt: 0 });
            cur.skip(`trang báo “${d.text.slice(0, 120)}” – bỏ qua hồ sơ này`);
          } else {
            ldOk(r.key, r.so, `trang báo “${d.text.slice(0, 120)}”`);
            cur.ok(`trang báo “${d.text.slice(0, 120)}” – hồ sơ đã rời bước lãnh đạo`);
          }
          S.ld.cur = null;
          ldSave();
          tailNeed = '-';
          return;
        }
        needYou('Trang báo – bạn xem', 'bad');
        throw ask(`bấm “Xử lý hồ sơ”, trang báo: “${d.text.slice(0, 200)}” – tiện ích dừng ở hồ sơ này`, '');
      }
      if (!got) throw new Error('bấm “Xử lý hồ sơ” rồi mà chưa thấy cửa sổ “Quy trình xử lý”');
      cur.ok();
      return runLdQt(r);
    };
    // bấm vào dòng hồ sơ (chậm, chắc – như chuỗi chuyên viên) → “Xử lý hồ sơ”. Trang chưa nhận dòng → bấm lại 1 lần
    const ldOpen = async (r) => {
      const x = { tb: '', soBienNhan: r.so };
      let row = r.tr;
      for (let lan = 1; lan <= 2; lan++) {
        cur = step(lan === 1 ? `Bấm vào hồ sơ ${r.so}` : `Bấm lại vào hồ sơ ${r.so}`);
        let pr;
        try {
          pr = await pickListRow(x, row);
        } catch (e) {
          if (!(e && e.repick) || lan === 2) throw e;
          cur.skip(e.message);
          row = null;
          await sleep(1000);
          continue;
        }
        row = pr.row;
        cur.ok(
          pr.already
            ? 'dòng đã được chọn sẵn'
            : pr.panOk
            ? 'khung “Thông tin hồ sơ” đã hiện đúng hồ sơ này'
            : pr.marked
            ? 'dòng đã được chọn'
            : 'đã bấm (chưa thấy dấu chọn rõ – danh sách chỉ còn 1 hồ sơ)'
        );
        await sleep(1200);
        try {
          return await ldOpenQt(r);
        } catch (e) {
          if (!(e && e.chonHoSo) || lan === 2) throw e;
          row = null;
          await sleep(1000);
        }
      }
    };
    // Danh sách hồ sơ thụ lý: hồ sơ đầu tiên đang chờ ký duyệt → mở, làm
    const runLdList = async () => {
      title = '👔 Lãnh đạo – Danh sách hồ sơ thụ lý';
      S.listRun = true; // ■ Dừng lúc này → 🤖 thôi tự tìm (tới khi bạn bấm ▶ / bật lại 🤖)
      cur = step('Đọc Danh sách hồ sơ thụ lý');
      const rows = ldScanPage();
      const nLd = rows.filter((x) => LD_STEP.test(x.step)).length;
      const cands = rows.filter(ldCand);
      if (!cands.length) {
        const pg = ldPager();
        cur.ok(`${rows.length} hồ sơ trên trang này, ${nLd} ở bước lãnh đạo – không còn hồ sơ nào phải ký duyệt${pg && pg.next ? ' (còn trang sau)' : ''}`);
        tailNeed = '-';
        tailOk = `<div class="hint">${
          AUTO()
            ? S.opts.ldLoop !== false
              ? `🤖 ${pg && pg.next ? 'xem trang sau của danh sách, rồi ' : ''}tải lại danh sách sau ${Math.round(ldWaitMs() / 1000)} giây để nhận hồ sơ mới.`
              : 'Bật “Chạy liên tục” (bảng Lãnh đạo) để 🤖 tự tải lại danh sách nhận hồ sơ mới.'
            : 'Bật 🤖 để tiện ích tự làm lần lượt các hồ sơ chờ ký duyệt.'
        }</div>`;
        S.listRun = false;
        return;
      }
      const r = cands[0];
      cur.ok(`${cands.length} hồ sơ chờ ký duyệt trên trang này – làm hồ sơ ${r.so}`);
      S.ld.idleAt = 0;
      S.ld.cur = { key: r.key, so: r.so, at: Date.now(), phase: 'open' };
      ldSet(r.key, { so: r.so, step: r.step, st: (S.ld.items[r.key] || {}).st === 'loi' ? 'loi' : 'cho' });
      title = `👔 Lãnh đạo – hồ sơ ${r.so}`;
      S.listRun = false;
      return ldOpen(r);
    };
    // tải lại danh sách (Chạy liên tục / danh sách cũ): ở Danh sách hồ sơ thụ lý → TẢI LẠI TRANG như bấm F5 (bạn yêu cầu 24/11 – không bấm 🔍);
    // đã sang màn hình khác → bấm “Xử lý công việc”
    const ldRefresh = async () => {
      title = '👔 Lãnh đạo – tải lại danh sách';
      cur = step('Tải lại trang Danh sách hồ sơ thụ lý (F5 – nhận hồ sơ mới)');
      S.ld.idleAt = 0;
      S.ld.pages = 0;
      ldSave();
      if (onListPage()) {
        ldReload();
        cur.ok('tải lại trang (như bấm F5) – trang tải xong 🤖 làm tiếp');
        tailNeed = '-';
        tailOk = `<div class="hint">🤖 Tải lại trang Danh sách hồ sơ thụ lý (như bấm F5) để nhận hồ sơ mới – trang tải xong 🤖 làm tiếp.</div>`;
        return;
      }
      const nav = navXuLyCongViec();
      if (!nav) throw new Error('không thấy Danh sách hồ sơ thụ lý lẫn mục “Xử lý công việc” để tải lại danh sách');
      await goAndWait(nav, 'Xử lý công việc', null, listUrlLink());
      S.ld.refAt = Date.now();
      cur.ok('đã bấm “Xử lý công việc”');
      tailNeed = '-';
    };
    // trang sau của danh sách (hồ sơ chờ ký duyệt có thể nằm ở trang 2, 3…)
    const ldNextPage = async () => {
      title = '👔 Lãnh đạo – trang sau của danh sách';
      cur = step('Sang trang sau của Danh sách hồ sơ thụ lý');
      const pg = ldPager();
      if (!pg || !pg.next) {
        cur.skip('không còn trang sau');
        tailNeed = '-';
        return;
      }
      const before = ldPageRows()
        .map((x) => x.key)
        .join(',');
      S.ld.pages = (S.ld.pages || 0) + 1;
      ldSave();
      clickPage(pg.next.tagName === 'LI' ? pg.next.querySelector('a, button') || pg.next : pg.next);
      S.busySince = 0;
      await sleep(1000);
      const moved = await waitUntil(
        () =>
          !listBusy() &&
          ldPageRows()
            .map((x) => x.key)
            .join(',') !== before,
        15000 * slowK(),
        alive
      );
      if (!moved) {
        // bấm “trang sau” mà danh sách không đổi → thôi sang trang tới lần tải lại danh sách sau (không kẹt ở đây)
        S.ld.pages = 20;
        ldSave();
      }
      cur.ok(moved ? `đã sang trang ${(ldPager() || {}).cur || 'sau'}` : 'danh sách chưa đổi – thôi sang trang tới lần tải lại sau');
      tailNeed = '-';
    };
    // về Danh sách hồ sơ thụ lý: sau hồ sơ lỗi (cửa sổ còn mở – Chạy liên tục) / đang ở màn hình khác
    const ldGoList = async (afterErr) => {
      title = afterErr ? '👔 Lãnh đạo – để hồ sơ lỗi lại, làm hồ sơ khác' : '👔 Lãnh đạo – sang Xử lý công việc';
      cur = step('Về Danh sách hồ sơ thụ lý');
      const nav = navXuLyCongViec() || listUrlLink();
      if (!nav) throw new Error('không thấy mục “Xử lý công việc” ở thanh bên trái – bạn mở Danh sách hồ sơ thụ lý rồi bấm ▶');
      S.ld.cur = null;
      ldSave();
      await goAndWait(nav, 'Xử lý công việc', () => onListPage() && !qtModal() && !chooserModal(), listUrlLink());
      S.ld.refAt = Date.now();
      cur.ok(afterErr ? 'hồ sơ lỗi để lại (🤖 thử lại sau), làm hồ sơ khác' : 'đã bấm “Xử lý công việc”');
      tailNeed = '-';
    };
    const runLeader = async (fromAuto) => {
      const sig = fromAuto || '';
      title = '👔 Lãnh đạo – ký duyệt, chuyển bước 4';
      show();
      // hồ sơ đang làm dở chỉ giữ khi 🤖 làm tiếp đúng cửa sổ của nó (chọn người / Quy trình)
      const sk = sig.split(':')[1] || '';
      if (/^ldc:[^:]*:adopt:/.test(sig)) {
        // cửa sổ chọn người mở sẵn – 🤖 nhận làm tiếp (đủ kiểm tra ở runLdChooser): coi như vừa Chuyển tiếp hồ sơ này
        S.ld.cur = { key: sk, so: (S.ld.items[sk] || {}).so || '', at: Date.now(), phase: 'ct' };
        if ((S.ld.items[sk] || {}).wait) ldSet(sk, { wait: 0 });
        ldSave();
      } else if (!/^ld[cq]:/.test(sig) || !S.ld.cur || S.ld.cur.key !== sk || Date.now() - S.ld.cur.at > 10 * 60 * 1000) S.ld.cur = null;
      try {
        if (sig.startsWith('ldr:')) return await ldRefresh();
        if (sig.startsWith('ldp:')) return await ldNextPage();
        if (sig.startsWith('ldv:')) {
          // hồ sơ đã bấm Thực thi (trang tải lại trước khi kiểm tra xong) → tìm đúng số biên nhận để chốt đã chuyển chưa
          const key = sig.split(':')[1];
          const it = S.ld.items[key];
          if (!it || it.st !== 'lam' || !onListPage()) return;
          title = `👔 Lãnh đạo – kiểm tra hồ sơ ${it.so}`;
          S.ld.cur = { key, so: it.so, at: Date.now(), phase: 'kt' };
          ldSave();
          return await ldVerify(key, it.so);
        }
        if (sig.startsWith('ldback:') || sig.startsWith('ldnav:')) return await ldGoList(sig.startsWith('ldback:'));
        ldPre();
        const top0 = (await act('modalState')).find((x) => x.open);
        const k0 = top0 ? modalKey(top0) : '';
        if (top0 && CHOOSER_MODAL.test(k0)) return await runLdChooser(sig.startsWith('ldc:'), /^ldc:[^:]*:adopt:/.test(sig));
        if (top0 && /^quy trinh xu ly\b/.test(k0) && qtModal()) return await runLdQt(null);
        if (top0) throw new Error(`đang mở ${top0.name} – vai trò Lãnh đạo chỉ làm ở Danh sách hồ sơ thụ lý, cửa sổ Quy trình xử lý (Ký duyệt hồ sơ) và cửa sổ chọn người`);
        if (onListPage()) return await runLdList();
        // màn hình một hồ sơ (nút “Xử lý hồ sơ”) → mở Quy trình của hồ sơ đó
        if (btnXuLyHoSo()) {
          const so = await dossierSo();
          if (!so) throw ask('không đọc được Số biên nhận của hồ sơ đang mở – tiện ích không xử lý (tránh chuyển nhầm hồ sơ)', '');
          const r = { so, key: soKey(so), tr: null, step: '' };
          S.ld.cur = { key: r.key, so, at: Date.now(), phase: 'open' };
          ldSave();
          return await ldOpenQt(r);
        }
        return await ldGoList(false);
      } catch (e) {
        // lỗi của MỘT hồ sơ (không phải lỗi cài đặt, không phải bạn bấm ■ Dừng): ghi số lần lỗi – 🤖 làm hồ sơ khác, thử lại sau
        const m = String((e && e.message) || e);
        const c = S.ld.cur;
        let soft = /ban vua bam|ban dang (thao tac|bam|go)/.test(norm(m));
        if (!soft && c && !(e && e.ldDone))
          try {
            soft = !!pageDialog() || realDlgOpen(await act('dialogState'));
          } catch (e2) {}
        if (c && soft && !S.ld.block && !(e && e.ldDone) && !/^Đã dừng theo yêu cầu/.test(m)) {
          // (soát 24/11) dừng vì hộp hỏi chưa dạy / bạn vừa bấm – gõ trên trang: KHÔNG tính là hồ sơ lỗi, không chặn màn hình; bạn trả lời hộp / ngưng tay
          // thì 🤖 làm tiếp hồ sơ này ở chỗ đang dở (Quy trình → ldq, cửa sổ chọn người → làm tiếp)
          S.ld.cur = { ...c, at: Date.now() };
          ldSave();
          if (e && typeof e === 'object') e.noFail = true;
          // cùng màn hình được chạy lại: hộp còn mở thì bộ theo dõi tự chờ; bạn vừa bấm / gõ → chờ 15 giây rồi mới chạy lại
          S.autoSig = '';
          if (/ban vua bam|ban dang (thao tac|bam|go)/.test(norm(m))) S.autoCool = Date.now() + 15000;
          log.push({ icon: '•', cls: 'muted', html: esc('🤖 chờ bạn trả lời hộp / ngưng thao tác – xong thì 🤖 làm tiếp hồ sơ này ở chỗ đang dở (không tính là lỗi)') });
        } else if (c && !S.ld.block && !(e && e.ldDone) && !/^Đã dừng theo yêu cầu/.test(m)) {
          const it = S.ld.items[c.key] || {};
          const n = (it.n || 0) + 1;
          ldSet(c.key, { so: c.so, st: n >= LD_MAX ? 'bo' : 'loi', n, msg: m.slice(0, 200), retryAt: Date.now() + ldWaitMs(), failAt: Date.now(), fwdAt: 0 });
          if (AUTO() && S.opts.ldLoop !== false)
            log.push({
              icon: '•',
              cls: 'muted',
              html: esc(n >= LD_MAX ? `hồ sơ ${c.so} lỗi ${n} lần – bỏ qua hồ sơ này; 🤖 làm hồ sơ khác` : `🤖 để hồ sơ ${c.so} lại (lỗi ${n}/${LD_MAX}), 20 giây sau làm hồ sơ khác, thử lại hồ sơ này sau ${Math.round(ldWaitMs() / 1000)} giây`),
            });
        } else if (c && e && e.ldDone && AUTO() && S.opts.ldLoop !== false)
          log.push({ icon: '•', cls: 'muted', html: esc(`🤖 để hồ sơ ${c.so} lại, 20 giây sau (bạn không thao tác) về danh sách làm hồ sơ khác`) });
        // bạn bấm ■ Dừng: thôi hồ sơ đang làm, 🤖 tạm dừng hẳn (không tự làm tiếp hồ sơ đó ở lần theo dõi sau)
        if (/^Đã dừng theo yêu cầu/.test(m)) {
          S.ld.cur = null;
          ldSave();
          setSweepPause(true);
        }
        throw e;
      }
    };

    try {
      // 🤖 + cửa sổ / màn hình / hộp hỏi có mẫu đã lưu (tab Trường) → điền ô đã tích, bấm nút đã tích theo thứ tự
      if (tplSig) {
        const t = S.tpl[tplSigKey(fromAuto)];
        if (!t) return;
        title = `🤖 Theo mẫu – ${t.name}`;
        cur = step(`Điền theo mẫu ${qn(t.name)}`);
        const f = await tplFill(t, 0, { auto: true });
        tplLogInto(log, f);
        show();
        const cl = f.clicks || [];
        if (f.results.some((r) => !r.ok) || cl.some((c) => !c.ok)) throw new Error('mẫu chưa chạy trọn – xem các dòng ✗ (sửa mẫu ở tab Trường, hoặc tự làm tiếp)');
        cur.ok(`${f.results.length} ô, bấm ${cl.filter((c) => !c.skip && !c.q).length} nút`);
        tailNeed = '-';
        return;
      }
      // vai trò Lãnh đạo (bảng chọn “Vai trò”): ký duyệt → chuyển bước 4
      if (isLd()) {
        await runLeader(fromAuto);
        return;
      }
      // Cửa sổ nào đang mở → chọn bước: “Nhập đơn đăng ký” / chọn người chuyển tiếp / Quy trình xử lý / hồ sơ đã lưu / Tiếp nhận hồ sơ
      const top0 = (await act('modalState')).find((x) => x.open);
      const k0 = top0 ? modalKey(top0) : '';
      // chữ ký 'sweep:' chỉ dành cho trang danh sách (không có cửa sổ nào mở) – trang đã đổi thì thôi
      if (fromAuto && fromAuto.startsWith('sweep:') && (top0 || !onListPage())) return;
      // 🤖 tự làm tiếp (resume:) chỉ dành cho cửa sổ của chuỗi / màn hình hồ sơ – trang đã đổi (danh sách, tiếp nhận…) thì thôi
      if (fromAuto && fromAuto.startsWith('resume:') && !top0 && !scanScreen() && !btnXuLyHoSo()) return;
      // 🤖 chạy liên tục: TB vừa tạm hoãn vì vướng → đóng cửa sổ của chuỗi còn mở, về danh sách / Tiếp nhận làm TB khác
      if (fromAuto && fromAuto.startsWith('cvback:')) {
        await cvGoBack();
        return;
      }
      // trang vừa chuyển sang Danh sách hồ sơ thụ lý sau khi bạn bấm ▶ cho TB “Đã tiếp nhận” → tìm tiếp TB đó
      if (fromAuto && fromAuto.startsWith('golist:')) {
        const x = S.data.find((y) => String(y.tb) === fromAuto.slice(7));
        // TB bạn bỏ tạm hoãn / đổi về ○: tìm như ▶ (mỗi TB tối đa 3 lần; TB đi tiếp được / tạm hoãn lại thì thôi – markStage)
        S.redoN = { ...(S.redoN || {}), [fromAuto.slice(7)]: ((S.redoN || {})[fromAuto.slice(7)] || 0) + 1 };
        // TB đã xong / tạm hoãn / đang tạm giữ (bạn bấm ■ Dừng…) → thôi
        if (!x || top0 || !onListPage() || !needsList(x) || S.autoHold.has(String(x.tb)) || S.sweepPause) return;
        await runGoList(x);
        return;
      }
      // 🤖 hết TB chưa tiếp nhận, còn TB “Đã tiếp nhận” chưa xong → bấm “Xử lý công việc” (thanh trái) → Danh sách hồ sơ thụ lý tìm tiếp
      if (fromAuto && fromAuto.startsWith('xlcv:')) {
        if (top0 || onListPage() || !AUTO()) return;
        const nav = navXuLyCongViec();
        const ps = sweepList();
        const ck = ps.length ? [] : chkList(); // (24/11) hết TB ◐ mà còn TB ✓ chưa kiểm lại → cũng sang danh sách
        if (!nav || (!ps.length && !ck.length)) return;
        title = '🤖 Sang Xử lý công việc';
        cur = step('Xử lý công việc');
        try {
          sessionStorage.setItem('vbdlis-dien-nhanh-xlcv', JSON.stringify({ at: Date.now() }));
        } catch (e) {}
        cur.ok(
          ps.length
            ? `hết TB chưa tiếp nhận – sang “Xử lý công việc” tìm ${ps.length} TB “◐ Đã nhập nhưng chưa xong”: ${ps
                .slice(0, 12)
                .map((y) => y.tb)
                .join(', ')}${ps.length > 12 ? '…' : ''}`
            : `hết TB chưa tiếp nhận, hết TB ◐ – sang “Xử lý công việc” kiểm lại ${ck.length} TB ✓ Xong chưa kiểm (còn sót hồ sơ không)`
        );
        tailNeed = '-';
        tailOk = ps.length
          ? '<div class="hint">🤖 Sang <b>Danh sách hồ sơ thụ lý</b>: tiện ích gõ số biên nhận từng TB “◐ Đã nhập nhưng chưa xong” vào ô tìm – không thấy thì 5 giây sau đổi sang số biên nhận khác; ra hồ sơ thì bấm vào hồ sơ → <b>Xử lý hồ sơ</b> → làm tiếp.</div>'
          : '<div class="hint">🤖 Sang <b>Danh sách hồ sơ thụ lý</b>: tiện ích gõ số biên nhận từng TB ✓ Xong chưa kiểm lại – hồ sơ còn trong danh sách (sót) thì đổi TB đó về ◐ rồi làm tiếp.</div>';
        await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
        return;
      }
      // 🤖 (24/11): màn hình không có việc của 🤖 (trang khác / hồ sơ không có trong dữ liệu), bạn không thao tác → về Danh sách hồ sơ thụ lý
      if (fromAuto && fromAuto.startsWith('cvnav:')) {
        if (top0 || onListPage() || !AUTO()) return;
        const nav = navXuLyCongViec() || listUrlLink();
        if (!nav) return;
        title = '🤖 Về Danh sách hồ sơ thụ lý – làm TB khác';
        cur = step('Xử lý công việc');
        cur.ok('màn hình này không có việc của 🤖 – về Danh sách hồ sơ thụ lý (tìm / tiếp nhận TB khác)');
        tailNeed = '-';
        await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
        return;
      }
      // 🤖 ở Danh sách hồ sơ thụ lý, không còn TB phải tìm lượt này, còn TB chưa tiếp nhận → sang màn hình Tiếp nhận hồ sơ làm TB đó
      if (fromAuto && fromAuto.startsWith('recv:')) {
        const x = S.data.find((y) => String(y.tb) === fromAuto.slice(5));
        if (!x || top0 || !onListPage() || stageOf(x) !== 'chua' || !AUTO()) return;
        const a = navTiepNhan();
        if (!a) return;
        title = `🤖 TB ${x.tb} – sang Tiếp nhận hồ sơ`;
        cur = step('TB tiếp theo');
        setPtr(x.tb);
        try {
          await stageChain;
          await store.set({ tbCur: S.cur, tbRecv: S.recv, tbCurBy: '' });
        } catch (e) {}
        render();
        try {
          sessionStorage.setItem('vbdlis-dien-nhanh-recv', JSON.stringify({ tb: String(x.tb), at: Date.now() }));
        } catch (e) {}
        cur.ok(`không còn TB phải tìm ở Danh sách hồ sơ thụ lý lúc này – TB ${x.tb} – ${whoOf(x)} chưa tiếp nhận: sang màn hình Tiếp nhận hồ sơ`);
        tailNeed = '-';
        await goAndWait(a, 'Tiếp nhận hồ sơ', recvDone);
        return;
      }
      if (top0 && DON_MODAL.test(k0)) {
        if (!tb) throw new Error('chưa có dữ liệu TB – bấm “Dữ liệu” để nạp');
        // số biên nhận của hồ sơ nằm dưới cửa sổ đơn (màn hình hồ sơ / danh sách; không đọc được thì Mã đơn): đúng 1 TB → theo TB đó (chưa ghi gì
        // lên trang), đơn không được chỉ sang TB khác (soát 1.21.7: ▶ ở đơn của hồ sơ khác TB đang chọn – trước đây 🤖 lưu theo TB đang chọn)
        const own = await openDossierTbs();
        if (own.length === 1 && own[0] !== tb) {
          log.push({ icon: '•', cls: 'muted', html: esc(`Hồ sơ đang mở (số biên nhận) là của TB ${own[0].tb}, không phải TB ${tb.tb} – đã tự chọn TB ${own[0].tb}`) });
          setTb(own[0]);
        }
        const mine = tb;
        await identifyDon(own.length === 1);
        if (own.length === 1 && tb !== mine) throw ask(`Mã đơn của cửa sổ đơn là của TB ${tb.tb}, khác hồ sơ đang mở (TB ${mine.tb}) – tiện ích dừng`, '');
        tbKnown = true;
        gateTb();
        await runDon(false);
        return;
      }
      if (top0 && CHOOSER_MODAL.test(k0)) {
        // cửa sổ chọn người mở sẵn: chỉ chọn sẵn đúng người + tô vàng Thực thi; được tự Thực thi (🤖 bật, sau đủ kiểm tra) khi
        // bạn đã tích “Thực thi” trong mẫu cửa sổ này (tab Trường)
        // 🤖 tự làm tiếp ở cửa sổ chọn người đang mở (bạn yêu cầu 24/11: làm tiếp các bước còn lại) → chọn đúng người, Thực thi (đủ kiểm tra)
        await runChooser('', !!(fromAuto && /^(cho|resume):/.test(fromAuto)) || chooserTplGo() || (!fromAuto && AUTO() && !S.opts.thuThucThi));
        return;
      }
      if (top0 && /^quy trinh xu ly\b/.test(k0) && qtModal()) {
        const v = qtVariant(qtRows(qtModal()));
        if (v === 'tn' || v === 'cv' || v === 'kq' || v === 'tra') {
          await runQt();
          return;
        }
      }
      // (soát 24/11) 🤖: cửa sổ Kết ISO / Trả hồ sơ còn mở mà lần chạy không đi từ Quy trình (lần trước dừng giữa chừng): chưa bấm Thực hiện ở đó (không có
      // dấu đang làm) → đóng cửa sổ (không lưu), bộ theo dõi làm tiếp từ Quy trình; đã bấm → để bước sau hỏi / tạm hoãn như cũ. Kết ISO khi tắt
      // “Tự Kết ISO” là việc của bạn → không đụng
      if (fromAuto && top0 && /^(ket iso|tra ho so)\b/.test(k0)) {
        const soW = await dossierSo();
        const lW = soW ? tbOfSo(soW).list : [];
        const sW = lW.length === 1 ? S.stage[String(lW[0].tb)] || {} : null;
        const kW = /^ket iso/.test(k0) ? 'iso' : 'tra';
        if (sW && !(sW.fwd && sW.fwd.k === kW) && !(kW === 'iso' && (!isoAuto() || S.opts.thuThucThi))) {
          const okC = (await act('closeTop', { win: '^' + k0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })).some((y) => y.ok);
          step(`Đóng cửa sổ “${top0.name}”`)[okC ? 'ok' : 'skip'](okC ? '🤖 chưa bấm gì ở cửa sổ này – đóng (không lưu), làm tiếp từ Quy trình' : 'không đóng được');
          tailNeed = '-';
          return;
        }
      }
      if (top0 && (CHU_MODAL.test(k0) || (THUA_MODAL.test(k0) && !THUA_ADD.test(k0))))
        throw new Error(`đang mở ${top0.name} – kiểm tra rồi bấm Lưu (hoặc Đóng) để về cửa sổ trước, rồi bấm “Chạy cả TB” lại`);
      // cửa sổ Quy trình xử lý / Cập nhật dữ liệu pháp lý → tự làm tác vụ 2 rồi 3; Lưu kho hồ sơ quét / Hồ sơ quét → tác vụ 3
      // (Quy trình phải nằm trên cùng – không bị cửa sổ chủ / thửa / tìm kiếm… của đơn che)
      const scr = scanScreen();
      if (scr === 'quytrinh' && !(top0 && /^quy trinh xu ly\b/.test(k0)))
        throw new Error(`đang mở ${top0 ? top0.name : 'cửa sổ khác'} che cửa sổ “Quy trình xử lý” – đóng cửa sổ đó rồi bấm “Chạy cả TB” lại`);
      if (scr) {
        await (scr === 'quytrinh' || scr === 'cndlpl' ? runQuyTrinh : runScan)(scr, qtCtx);
        cur = null;
        return;
      }
      // Danh sách hồ sơ thụ lý: tìm hồ sơ theo Số biên nhận → bấm vào hồ sơ → Xử lý hồ sơ (🤖: 5 giây tìm 1 lần; ▶: tìm ngay)
      if (!top0 && onListPage()) {
        await runSweep(!fromAuto);
        return;
      }
      // hồ sơ vừa bấm Thực thi chuyển lãnh đạo (trang tải lại, không còn nút “Xử lý hồ sơ”) → ghi nhận, sang TB sau
      // (trước nhánh tìm ở danh sách: TB vừa chuyển lãnh đạo không phải tìm; cả TB 🤖 mở từ danh sách)
      if (!top0 && !btnXuLyHoSo() && linkVeTiepNhan()) {
        const ids = [tb ? String(tb.tb) : '', chainTbId(), fromAuto && fromAuto.startsWith('ldx:') ? fromAuto.slice(4) : ''].filter(Boolean);
        if (ids.some((id) => ldPending(S.stage[id] || {}))) {
          await runAfterLd();
          return;
        }
      }
      // ▶ với TB đang chọn “◐ Đã tiếp nhận” chưa xong (bạn yêu cầu 22/11): không tiếp nhận lại – bấm “Xử lý công việc” (thanh trái) →
      // Danh sách hồ sơ thụ lý → tìm số biên nhận của TB này (5 giây tìm lại) → bấm vào hồ sơ → Xử lý hồ sơ → làm tiếp.
      // Bạn đã bấm “Vẫn tiếp nhận TB …” thì vẫn tiếp nhận như cũ
      if (
        !fromAuto &&
        !top0 &&
        tb &&
        needsList(tb) &&
        !(S.confirmTn && S.confirmTn.tb === String(tb.tb)) &&
        !(btnXuLyHoSo() && tbOfSo(await dossierSo()).list.length === 1) // màn hình hồ sơ đọc ra đúng 1 TB → làm hồ sơ đó (như cũ)
      ) {
        const nav = navXuLyCongViec();
        const tnBtn = actBtn('confirmTn', tb.tb, `Vẫn tiếp nhận TB ${tb.tb}`);
        if (!nav)
          throw ask(
            `TB ${tb.tb} đã tiếp nhận – cần sang “Xử lý công việc” để tìm hồ sơ, nhưng không thấy mục đó ở thanh bên trái (mở trang có thanh bên trái rồi bấm ▶ lại). Hồ sơ của TB này chưa có trên VBDLIS thì bấm nút dưới để tiếp nhận lại`,
            tnBtn
          );
        // màn hình Tiếp nhận đang có dữ liệu chưa lưu (Số biên nhận / thửa) → không rời trang (mất dữ liệu bạn nhập)
        if (btnLuuHoSo() && !btnXuLyHoSo()) {
          const rows0 = await readTable();
          const sbn0 = String((await readField('Số biên nhận')) || '').trim();
          if ((rows0 && rows0.length) || sbn0)
            throw ask(
              `TB ${tb.tb} đã tiếp nhận (cần tìm ở Xử lý công việc), nhưng màn hình Tiếp nhận đang có dữ liệu chưa lưu${
                sbn0 ? ` (Số biên nhận “${sbn0}”)` : ''
              } – tiện ích không rời trang. Lưu / xóa màn hình này rồi bấm ▶; muốn tiếp nhận lại TB ${tb.tb} thì bấm nút dưới`,
              tnBtn
            );
        }
        cur = step('Sang “Xử lý công việc”');
        tbKnown = true;
        // ghi trước khi bấm: trang tải lại thì bảng điền mới tìm tiếp TB này
        await store.set({ tbGoList: { tb: String(tb.tb), at: Date.now(), tabId: S.tabId == null ? null : S.tabId } });
        // trang tải lại → bảng điền mới tìm tiếp TB này; trang không tải lại (chỉ đổi phần giữa) → tìm luôn trong lần chạy này
        await goAndWait(nav, 'Xử lý công việc', onListPage, listUrlLink());
        if (await waitUntil(() => onListPage(), 10000, alive)) {
          try {
            await store.remove('tbGoList');
          } catch (e) {}
          S.goListPending = false;
          cur.ok(`TB ${tb.tb} đã tiếp nhận – sang Danh sách hồ sơ thụ lý`);
          await runGoList(tb);
          return;
        }
        // 10 giây vẫn chưa nhận ra trang danh sách (trang chưa tải xong, hoặc trang khác mẫu tiện ích biết) → báo kèm dòng “Để báo lỗi”
        log.push({ icon: '•', cls: 'muted', html: esc(`Để báo lỗi (gửi người hỗ trợ): ${listDiag()}`) });
        cur.ok(`TB ${tb.tb} đã tiếp nhận – đã bấm “Xử lý công việc”, chờ trang Danh sách hồ sơ thụ lý (ô tìm “Số biên nhận”) để tìm số biên nhận ${tb.soBienNhan}`);
        tailNeed = '-';
        return;
      }
      // màn hình hồ sơ đã lưu (nút “Xử lý hồ sơ”) → mở Quy trình, làm tiếp theo bước của hồ sơ
      if (!top0 && btnXuLyHoSo()) {
        await runHoso(false);
        return;
      }
      // ▶ lúc đang mở cửa sổ có mẫu ở tab Trường (cửa sổ tiện ích không tự làm) → nói rõ cách chạy mẫu
      if (!fromAuto && top0) {
        const tw = autoTplFor(k0);
        if (tw)
          throw new Error(
            `đang mở ${top0.name} – cửa sổ này có mẫu ở tab Trường (${tw.name}): 🤖 Tự động hết bật thì tự điền + bấm theo mẫu khi cửa sổ mở; 🤖 tắt thì bấm “Điền” ở mẫu đó (tab Trường)`
          );
      }
      if (!tb) throw new Error('chưa có dữ liệu TB – bấm “Dữ liệu” để nạp');
      if (top0 && /^quy trinh xu ly\b/.test(k0))
        throw new Error(
          'đang mở cửa sổ “Quy trình xử lý” – muốn chạy bước Nhập đơn đăng ký thì bấm “Xử lý tác vụ” để mở cửa sổ đó rồi bấm “Chạy cả TB”; muốn tự lưu kho hồ sơ quét thì thả file DDK + TBXN của hồ sơ vào bảng điền trước'
        );
      // (soát 24/11) chỉ chữ ký Tiếp nhận (tn:) của bộ theo dõi / bạn bấm ▶ mới vào bước tiếp nhận – chữ ký màn hình khác (cửa sổ vừa đóng, trang vừa
      // đổi…) thì thôi, không tiếp nhận nhầm
      if (fromAuto && !/^tn:/.test(fromAuto)) return;
      // 0. Kiểm tra trước – không ghi gì lên trang nếu có vấn đề
      cur = step('Kiểm tra dữ liệu và màn hình');
      viewTb(tb); // (25/11) TB ở trên = TB đang tiếp nhận
      // 🤖 đang tiếp nhận TB này (dừng giữa chừng → bộ theo dõi làm tiếp màn hình Tiếp nhận đã có dữ liệu – 30 phút)
      if (AUTO() && tb)
        try {
          sessionStorage.setItem('vbdlis-dien-nhanh-recvrun', JSON.stringify({ tb: String(tb.tb), at: Date.now() }));
        } catch (e) {}
      tbKnown = true; // tiếp nhận: lần chạy làm đúng TB đang chọn
      // thửa trùng (ghi 2 lần, đã nhập ở TB khác, lần trước bạn đóng không lưu) → bỏ qua; tiếp nhận dùng thửa còn lại
      const skip = skipMap(tb);
      const usable = thua.filter((t, i) => !skip.has(i));
      if (thua.length && !usable.some(thuaOk)) {
        const bq = stageList(tb.tb, 'boQua');
        throw ask(
          `mọi thửa của TB ${tb.tb} đều bị bỏ qua (${[...skip.values()].map((x) => x.why).filter((v, k, a) => a.indexOf(v) === k).join('; ')}) – không còn thửa nào để tiếp nhận`,
          actBtn('hoanDup', tb.tb, `⏸ Tạm hoãn TB ${tb.tb}`, ` data-ly="trùng thửa – không còn thửa để nhập"`) +
            (bq.length ? ' ' + actBtn('unskip', tb.tb, 'Mở lại thửa đã bỏ qua') : '')
        );
      }
      const errs = checkData(tb, allMode ? usable : usable.slice(0, 1));
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
      // mẫu “Màn hình Tiếp nhận hồ sơ” (tab Trường): mỗi ô chính điền gì (dữ liệu TB / giá trị mẫu / bỏ tích – không điền)
      const rp = recepPlan();
      for (const [label, want] of [
        ['Số biên nhận', tb.soBienNhan],
        ['Người nộp hồ sơ', rp.nguoiNop.use === 'off' ? '' : rp.nguoiNop.use === 'fix' ? rp.nguoiNop.value : tb.nguoiNop && tb.nguoiNop.hoTen],
      ]) {
        if (!String(want || '').trim()) continue; // ô bỏ tích ở mẫu: không so ở đây (kiểm trước khi Lưu hồ sơ)
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
      // TB tạm hoãn → dừng hỏi bạn (nút riêng); ghi chú → chỉ nhắc
      gateTb();
      // TB này đã tiếp nhận rồi → chỉ làm khi bạn bấm nút “Vẫn tiếp nhận…” (tránh tạo hồ sơ trùng).
      // (Thửa trùng với TB khác đã nhập thì không dừng – thửa đó được bỏ qua ở dưới.)
      {
        const s0 = S.stage[String(tb.tb)] || {};
        if ((s0.tn || s0.don) && !consume('confirmTn', tb.tb))
          throw ask(
            `TB ${tb.tb} đã ${s0.don ? 'nhập đơn xong' : 'tiếp nhận'} lúc ${fmtTime(s0.tn || s0.don)} (${BY_TEXT[s0.tnBy] || 'đã đánh dấu'}). Tiếp nhận lần nữa sẽ tạo hồ sơ TRÙNG trên VBDLIS. Đánh dấu nhầm thì đổi ô Trạng thái về “Chưa xong” và chọn xóa hết dấu.`,
            actBtn('confirmTn', tb.tb, `Vẫn tiếp nhận TB ${tb.tb}`)
          );
        if (s0.tnClick && !s0.tn && !consume('confirmTn', tb.tb))
          throw ask(
            `tiện ích đã bấm “Lưu hồ sơ” cho TB ${tb.tb} lúc ${fmtTime(s0.tnClick)} nhưng chưa thấy “Lưu hồ sơ thành công” (trang tải lại?). Kiểm tra trên VBDLIS xem hồ sơ đã có chưa – tiếp nhận lần nữa có thể tạo hồ sơ TRÙNG.`,
            actBtn('confirmTn', tb.tb, `Chưa có – vẫn tiếp nhận TB ${tb.tb}`)
          );
      }
      cur.ok(thieuGT ? 'dữ liệu chưa có số giấy tờ người nộp – bạn điền tay ô đó' : '');
      // thửa bỏ qua → ghi rõ trong nhật ký
      skip.forEach((x, i) => log.push({ icon: '•', cls: 'muted', html: esc(`Thửa ${thua[i].soThua} tờ ${thua[i].soTo} – ${x.why} – bỏ qua`) }));
      if (skip.size) show();
      stopIf();

      // 1. Phường/Xã (đã có quy trình trong bảng thì coi như đã chọn). Mẫu tab Trường: ô bỏ tích → tiện ích không chọn (bạn chọn tay;
      // trước khi 🤖 Lưu hồ sơ phải đúng dữ liệu TB); ô giá trị mẫu → chọn giá trị đó
      const qtR = rp.quyTrinh.use === 'fix' ? rp.quyTrinh.value : qt; // quy trình sẽ chọn
      cur = step('Chọn Phường/Xã');
      if (anyOk(await act('hasCellText', { text: qtR }))) cur.skip('đã chọn từ trước');
      else if (rp.phuongXa.use === 'off') cur.skip('bỏ tích ở mẫu tab Trường – tiện ích không chọn (bạn chọn tay)');
      else {
        const f = mustFill(await fillSec('donVi', { phuongXa: rp.phuongXa.use === 'fix' ? rp.phuongXa.value : tb.phuongXa || DEFAULT_PHUONG }, true));
        cur.ok(f.results[0] && f.results[0].msg);
        if (f.results.some((x) => x.changed)) await sleep(1500); // trang tự điền địa chỉ mặc định sau khi đổi Phường/Xã
      }
      stopIf();

      // 2. Quy trình XA_KH2959 → trang thêm 1 dòng vào bảng quy trình
      cur = step('Chọn quy trình ' + qtR);
      if (anyOk(await act('hasCellText', { text: qtR }))) cur.skip('đã có trong bảng quy trình');
      else if (rp.quyTrinh.use === 'off') cur.skip('bỏ tích ở mẫu tab Trường – tiện ích không chọn (bạn chọn tay)');
      else {
        for (let i = 0; i < 25; i++) {
          // chờ trang nạp danh sách quy trình sau khi chọn Phường/Xã
          if (anyOk(await act('selectHasOption', { label: 'Quy trình/Thủ tục', text: qtR }))) break;
          await sleep(300);
        }
        mustFill(await fillSec('quyTrinh', { quyTrinh: qtR }, true));
        const added = async () => {
          for (let i = 0; i < 8; i++) {
            await sleep(250);
            if (anyOk(await act('hasCellText', { text: qtR }))) return true;
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
      if (rp.soBienNhan.use === 'off') cur.skip('bỏ tích ở mẫu tab Trường – tiện ích không điền (trước khi Lưu hồ sơ ô phải đúng dữ liệu TB)');
      else {
        const sbn = rp.soBienNhan.use === 'fix' ? rp.soBienNhan.value : tb.soBienNhan;
        mustFill(await fillSec('soBN', { soBienNhan: sbn }, true));
        cur.ok(sbn);
      }

      // 4. Thửa: mở “Thêm thửa đất”, điền, chờ bạn bấm Lưu.
      //    Mặc định chỉ 1 THỬA (đủ để lưu hồ sơ; các thửa nhập đầy đủ ở bước “Nhập đơn đăng ký”).
      //    Thửa trùng không mở; bạn đóng cửa sổ không lưu (VBDLIS báo thửa trùng…) → bỏ qua thửa đó, thử thửa sau.
      const oneOnly = !allMode;
      let runList = thua.map((t, i) => ({ t, i })).filter((x) => !skip.has(x.i) && thuaOk(x.t));
      const skippedNow = new Set();
      let added = 0;
      if (oneOnly) {
        const rowsA = await readTable();
        if (!rowsA) throw new Error('không đọc được bảng thửa trên trang');
        const have = usable.find((t) => rowsA.some((r) => sameThua(r, t)));
        if (have) {
          runList = [];
          added = 1;
          setStageList(tb.tb, 'nhap', thuaKey(have), true);
          step('Thửa đất').skip(`bảng đã có thửa ${have.soThua}/${have.soTo} – bước tiếp nhận chỉ cần 1 thửa`);
        }
      }
      for (const { t, i } of runList) {
        if (oneOnly && added) break;
        stopIf();
        const pendKey = `${tb.tb}|thua${i}|pending`;
        cur = step(
          allMode || usable.length === 1
            ? `Thửa ${t.soThua} tờ ${t.soTo} (${i + 1}/${thua.length})`
            : `Thửa ${t.soThua} tờ ${t.soTo} (tiếp nhận chỉ cần 1 thửa; ${thua.length} thửa nhập ở “Nhập đơn đăng ký”)`
        );
        let rows = await readTable();
        if (!rows) throw new Error('không đọc được bảng thửa trên trang');
        if (rows.some((r) => sameThua(r, t))) {
          delete S.done[pendKey];
          S.done[`${tb.tb}|tn${i}`] = true;
          saveUi();
          setStageList(tb.tb, 'nhap', thuaKey(t), true);
          added++;
          cur.skip('đã có trong bảng');
          continue;
        }
        // lần trước cửa sổ đã đóng mà không thấy thửa trong bảng → hỏi lại trước khi mở lại (tránh nhập trùng)
        if (S.done[pendKey] === true || (fromAuto && S.done[pendKey] === 'confirm')) {
          S.done[pendKey] = 'confirm';
          saveUi();
          const eC = new Error(
            'lần trước cửa sổ đã đóng nhưng bảng không có thửa này. Nếu bạn đã bấm Hủy bỏ thì bấm “▶ Chạy cả TB” lần nữa để mở lại thửa này; nếu đã bấm Lưu mà bảng không hiện thì kiểm tra tay trên trang'
          );
          eC.noRetry = true;
          throw eC;
        }
        const terr = thuaErrors(t, tb, `thửa ${t.soThua}/${t.soTo}`);
        if (terr.length) throw new Error('dữ liệu chưa đúng: ' + terr.join('; '));
        await waitDialogs(cur);
        const open = (await act('modalState')).find((x) => x.open);
        if (open && !THUA_ADD.test(modalKey(open)))
          throw new Error(`đang mở ${open.name} – đóng cửa sổ đó rồi bấm “Chạy cả TB” lại`);
        let f;
        {
          const r = await send({ type: 'vbdlis-fill', ...tplMsg('thua', buildValues('thua', tb, i)) });
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
            const r2 = await send({ type: 'vbdlis-fill', ...tplMsg('thua', buildValues('thua', tb, i)) });
            if (!r2 || !r2.ok) throw new Error(friendly((r2 && r2.error) || 'Không chạy được'));
            pf = pickFrame(r2, 'thua');
          }
          if (!pf.f) throw new Error(pf.err);
          f = pf.f;
        }
        const bad = f.results.filter((x) => !x.ok);
        const skipT = f.tplSkip || []; // mẫu tab Trường bỏ tích ô bắt buộc mà ô trên trang trống / khác dữ liệu TB
        S.done[pendKey] = true; // đang chờ bạn bấm Lưu cho thửa này
        saveUi();
        // Tự động hết: mọi ô khớp → tiện ích tự bấm “Lưu” cửa sổ thửa
        let autoSavedT = false;
        let noAutoT = '';
        // bấm Lưu cửa sổ thêm thửa (đủ kiểm tra): '' = đã bấm, khác = vì sao không bấm – gọi lại được khi hộp hỏi đã đóng (soát 24/11)
        const tryAutoSaveT = async () => {
          if ((await act('dialogState')).some((x) => x.open)) return 'trang đang hỏi';
          const tp0 = await topNow();
          if (!tp0 || !THUA_ADD.test(modalKey(tp0))) return 'cửa sổ thêm thửa không nằm trên cùng';
          // 🤖: nút bạn tích thêm trong mẫu cửa sổ thửa (tab Trường) – bấm trước nút Lưu
          const ex = await tplChainExtras({ base: 'thua', decide: ['luu'], step });
          if (ex) return ex;
          const tp1 = await topNow();
          if (!tp1 || !THUA_ADD.test(modalKey(tp1)))
            throw new Error(
              `sau nút theo mẫu tab Trường, cửa sổ thêm thửa không còn nằm trên cùng (${tp1 ? tp1.name : 'đã đóng'}) – tiện ích dừng, không ghi bỏ qua; bạn xem rồi bấm “▶ Chạy cả TB”`
            );
          if ((await act('dialogState')).some((x) => x.open)) return 'trang đang hỏi (sau nút theo mẫu tab Trường)';
          stopIf(); // bạn bấm ■ Dừng / tắt 🤖 lúc chờ sau nút theo mẫu → không bấm Lưu
          const ms = await act('markSave', { win: 'thua' });
          const marks = ms.filter((x) => x.ok);
          if (marks.length === 1) return anyOk(await act('clickMark', { id: marks[0].id })) ? '' : 'không bấm được nút Lưu';
          return marks.length ? 'thấy nút Lưu ở nhiều khung' : (ms.find((x) => x.why) || {}).why || 'không thấy nút Lưu';
        };
        if (AUTO() && !bad.length && !skipT.length) {
          await sleep(600);
          stopIf();
          const why0 = await tryAutoSaveT();
          if (why0) noAutoT = why0;
          else autoSavedT = true;
        }
        let retrySaveT = !autoSavedT && AUTO() && !bad.length && !skipT.length && /^trang dang hoi/.test(norm(noAutoT));
        let retryNT = 0;
        const robotRetryT = retrySaveT && fromAuto; // 🤖 tự bấm Lưu lại khi hộp đóng – bạn chỉ trả lời hộp
        const focused = !autoSavedT && !robotRetryT && !bad.length && !skipT.length && S.opts.enterLuu !== false && anyOk(await act('focusSave', {}));
        cur.wait(
          (noAutoT ? `không tự Lưu (${noAutoT}); ` : '') +
            (skipT.length ? `mẫu tab Trường bỏ tích ô bắt buộc ${skipT.join(', ')} mà trên trang đang trống / khác dữ liệu TB – bạn điền tay; ` : '') +
            (bad.length
              ? `chưa điền được ${bad.map((x) => `${x.name} (${x.msg})`).join(', ')} – điền tay; `
              : `đã điền: ${quickLine('thua', buildValues('thua', tb, i), f.results)} – `) +
            (autoSavedT
              ? 'tiện ích đã tự bấm “Lưu”, chờ trang lưu…'
              : robotRetryT
                ? 'hộp hỏi đóng thì 🤖 tự bấm “Lưu” – bạn chỉ trả lời hộp, KHÔNG bấm Lưu'
                : focused
                  ? 'kiểm tra rồi nhấn Enter (con trỏ đang ở nút “Lưu”) hoặc tự bấm “Lưu”'
                  : 'bạn kiểm tra rồi tự bấm “Lưu” trong cửa sổ') +
            ' (bấm “■ Dừng” để thôi)'
        );
        // 🤖 chạy liên tục (24/11): lần chạy tự động không tự Lưu được thửa (không phải vì trang đang hỏi) → không đứng chờ bạn: TB này tạm hoãn
        if (!autoSavedT && fromAuto && AUTO() && !/^trang dang hoi/.test(norm(noAutoT)) && !(await act('dialogState')).some((x) => x.open)) {
          delete S.done[pendKey]; // 🤖 sẽ đóng cửa sổ này không lưu – lần sau mở lại thửa này như mới
          saveUi();
          throw new Error(
            `không tự Lưu được cửa sổ thửa ${t.soThua}/${t.soTo} (${noAutoT || (bad.length ? 'có ô chưa điền được' : skipT.length ? 'mẫu tab Trường bỏ tích ô bắt buộc' : 'chưa đủ điều kiện')}) – 🤖 không đứng chờ bạn`
          );
        }
        if (!autoSavedT && !robotRetryT) needYou(`Bấm Lưu – thửa ${t.soThua}/${t.soTo}`);
        const t0 = Date.now();
        let tActT = t0; // lần cuối trang có động tĩnh – “cửa sổ thửa kẹt” tính từ đây (soát 24/11)
        let stuckT = false;
        let tonTaiT = null; // trang báo thửa đã tồn tại → đã trả lời hộp (Bỏ qua / Đồng ý…), đóng cửa sổ
        let tonAskT = '';
        for (;;) {
          stopIf();
          const exT = await thuaTonTai(THUA_ADD);
          if (exT && exT.stuck) {
            if (tonAskT !== exT.text) {
              tonAskT = exT.text;
              cur.wait(`trang báo “${exT.text}” – tiện ích không tự trả lời hộp này (chỉ bấm “Bỏ qua”, hoặc “Đồng ý” / “Đóng” / “OK” của hộp chỉ báo một nút, không hỏi) – bạn tự trả lời / đóng cửa sổ thửa`);
              needYou('Thửa đã tồn tại – bạn xem', 'bad');
            }
            if (Date.now() - t0 > WAIT_MAX_MS) throw new Error('chờ bạn trả lời hộp “thửa đã tồn tại” quá 20 phút – đã dừng; bấm “Chạy cả TB” để làm tiếp');
            await sleep(1000);
            continue;
          } else if (exT) {
            tonTaiT = exT;
            tActT = Date.now();
            if (!exT.closed) {
              stuckT = true; // giữ lời nhắc này (không bị câu “tự bấm Lưu” sau 8 giây đè)
              cur.wait(`trang báo “${exT.text}” – đã bấm “${exT.btn}” nhưng không đóng được cửa sổ thửa – bạn bấm Hủy bỏ / Đóng (không bấm Lưu)`);
              needYou('Đóng cửa sổ thửa', 'bad');
            }
          }
          const st = await act('modalState');
          if (!st.some((x) => x.open)) break;
          // hộp đã biết / bạn đã dạy hiện lúc cửa sổ thửa còn mở → 🤖 bấm theo mẫu (soát 24/11: trước đây không ai trả lời)
          const dT = (await act('dialogState')).some((x) => x.open);
          if (dT && AUTO() && (await autoDlg()) === 'answered') {
            tActT = Date.now();
            continue;
          }
          if (dT || pageWorking()) tActT = Date.now(); // trang đang hỏi / đang xử lý → chưa tính là kẹt
          if (retrySaveT && USER.btnAt > t0 && USER.btn === 'luu') retrySaveT = false; // bạn đã tự bấm Lưu → không bấm thêm
          if (retrySaveT && !dT && !tonTaiT && !tonAskT && !stuckT && fromAuto && AUTO() && Date.now() - USER.at > 2000 && !pageWorking()) {
            retrySaveT = false;
            await sleep(600);
            const why1 = await tryAutoSaveT();
            if (!why1) {
              autoSavedT = true;
              tActT = Date.now();
              cur.wait('tiện ích đã tự bấm “Lưu” (hộp hỏi đã đóng), chờ trang lưu…');
              stopNeed();
              continue;
            }
            if (/^trang dang hoi/.test(norm(why1)) && ++retryNT < 3) retrySaveT = true;
            else throw new Error(`không tự Lưu được cửa sổ thửa ${t.soThua}/${t.soTo} (${why1}) – 🤖 không đứng chờ bạn`);
          }
          if (autoSavedT && !stuckT && !tonAskT && !dT && Date.now() - tActT > 8000 * slowK()) {
            // đã tự bấm Lưu mà cửa sổ thửa vẫn mở (trang báo lỗi / thiếu ô?) → không bấm lần 2, nhờ bạn xem
            stuckT = true;
            if (tonTaiT) {
              // đã trả lời hộp “thửa đã tồn tại” mà cửa sổ thửa còn mở → nhờ bạn đóng, KHÔNG bảo bấm Lưu thửa đã tồn tại
              cur.wait(`trang báo “${tonTaiT.text}” – đã bấm “${tonTaiT.btn}”, cửa sổ thửa vẫn mở – bạn bấm Hủy bỏ / Đóng (không bấm Lưu)`);
              needYou('Đóng cửa sổ thửa', 'bad');
            } else {
              cur.wait('tiện ích đã bấm “Lưu” nhưng cửa sổ chưa đóng (trang báo lỗi / thiếu ô?) – bạn xem rồi tự bấm “Lưu”');
              needYou(`Xem cửa sổ – thửa ${t.soThua}/${t.soTo}`, 'bad');
            }
          }
          // 🤖 chạy liên tục (soát 24/11): cửa sổ thửa vẫn mở 30 giây sau động tĩnh cuối → TB này tạm hoãn, làm TB khác; giữ dấu “đã bấm Lưu”
          if (autoSavedT && stuckT && !dT && fromAuto && AUTO() && Date.now() - tActT > 30000 * slowK()) {
            if (tonTaiT) {
              delete S.done[pendKey];
              saveUi();
            }
            throw new Error(`đã bấm “Lưu” nhưng cửa sổ thửa ${t.soThua}/${t.soTo} chưa đóng (trang báo lỗi / thiếu ô?) – 🤖 không đứng chờ bạn`);
          }
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
        if (!inTable) {
          // bạn đóng cửa sổ không lưu (VBDLIS báo thửa trùng / bạn bỏ) → bỏ qua thửa này, thử thửa sau
          delete S.done[pendKey];
          saveUi();
          setStageList(tb.tb, 'boQua', thuaKey(t), true);
          skippedNow.add(i);
          cur.skip(
            tonTaiT
              ? `trang báo “${tonTaiT.text}” – đã bấm “${tonTaiT.btn}”${tonTaiT.how ? ', ' + tonTaiT.how : ''} – bỏ qua thửa này (không nhập lại)${oneOnly ? ', thử thửa sau' : ''}`
              : `cửa sổ đóng mà không lưu (thửa trùng / bạn bỏ) – bỏ qua${oneOnly ? ', thử thửa sau' : ''}`
          );
          continue;
        }
        delete S.done[pendKey];
        S.done[`${tb.tb}|tn${i}`] = true;
        saveUi();
        setStageList(tb.tb, 'nhap', thuaKey(t), true);
        added++;
        cur.ok('đã vào bảng');
      }
      const usableNow = usable.filter((t) => !skippedNow.has(thua.indexOf(t)));
      if (!added) {
        const rowsB = (await readTable()) || [];
        if (!rowsB.some((r) => usableNow.some((t) => sameThua(r, t))))
          throw ask(
            'chưa thêm được thửa nào vào bảng (các thửa đều bị bỏ qua) – hồ sơ cần ít nhất 1 thửa: thêm tay một thửa, hoặc mở lại thửa đã bỏ qua',
            stageList(tb.tb, 'boQua').length ? actBtn('unskip', tb.tb, 'Mở lại thửa đã bỏ qua') : ''
          );
      }
      stopIf();

      // 5. Người nộp hồ sơ (địa chỉ theo mục 1c của TBXN) – theo mẫu tab Trường: ô bỏ tích không điền, ô giá trị mẫu điền giá trị mẫu
      cur = step('Người nộp hồ sơ, số giấy tờ, địa chỉ');
      await waitDialogs(cur);
      const v = buildValues('bienNhan', tb);
      const nv = {};
      const offR = [];
      for (const k of ['diaChiTaiSan', 'nguoiNop', 'soGiayTo', 'diaChi']) {
        const p = rp[k];
        if (p.use === 'off') offR.push(p.label || k);
        else nv[k] = p.use === 'fix' ? p.value : v[k];
      }
      mustFill(await fillSec('nguoiNop', nv, true));
      cur.ok((nv.nguoiNop || '') + (offR.length ? ` · bỏ tích ở mẫu (không điền): ${offR.join(', ')}` : ''));

      // 5a. ô giá trị mẫu khác của màn hình tiếp nhận (tab Trường) – điền TRƯỚC khi đọc lại các ô
      {
        const t0 = S.tpl.bienNhan;
        const exR = t0 && t0.items ? t0.items.filter((x) => x.on && !x.ban && !x.key && x.src !== 'tb') : [];
        if (exR.length) {
          cur = step('Ô theo mẫu (tab Trường)');
          const mm = tplMsgOf([{ ...t0, items: t0.items.map((x) => (x.key ? { ...x, on: false } : x)) }], 'bienNhan', {});
          const r = await send({ type: 'vbdlis-fill', ...mm.msg });
          const pf = r && r.ok ? pickFrame(r, 'bienNhan') : { err: friendly((r && r.error) || 'Không chạy được') };
          if (!pf.f) throw new Error(pf.err);
          const badT = pf.f.results.filter((x) => !x.ok);
          if (badT.length) throw new Error('ô theo mẫu chưa điền được: ' + badT.map((x) => `${x.name} (${x.msg})`).join(', '));
          cur.ok(pf.f.results.map((x) => `${x.name}: ${x.value}`).join(', ') + (mm.empty.length ? ` · giá trị mẫu trống, không điền: ${mm.empty.join(', ')}` : ''));
        }
      }

      // 5b. Đọc lại các ô đầu hồ sơ sau khi trang "lắng" (trang có thể tự đổi lại giá trị). Ô bắt buộc bỏ tích ở mẫu tab Trường:
      // tiện ích không điền nhưng ô đó vẫn phải đúng dữ liệu TB (trống / khác → dừng, không tô / bấm Lưu hồ sơ)
      cur = step('Kiểm tra lại các ô đầu hồ sơ');
      await sleep(1200);
      for (const [label, k, tbv, mustRead] of [
        ['Số biên nhận', 'soBienNhan', tb.soBienNhan, true],
        ['Người nộp hồ sơ', 'nguoiNop', v.nguoiNop, true],
        ['Số giấy tờ', 'soGiayTo', v.soGiayTo, true],
        ['Địa chỉ', 'diaChi', v.diaChi, true],
        ['Địa chỉ tài sản', 'diaChiTaiSan', v.diaChiTaiSan, false],
      ]) {
        const p = rp[k];
        if (p.use === 'off' && !RECEP_REQ.includes(k)) continue; // ô không bắt buộc bỏ tích: không so
        const want = p.use === 'fix' ? p.value : tbv;
        if (!String(want || '').trim()) continue; // dữ liệu trống → bạn điền tay, không so
        const have = await readField(label);
        if (have === null) {
          if (mustRead) throw new Error(`không đọc lại được ô “${label}” trên trang`);
          continue;
        }
        if (normVal(have) !== normVal(want))
          throw new Error(
            p.use === 'off'
              ? `ô “${label}” bỏ tích ở mẫu tab Trường (tiện ích không điền) mà trên trang đang ${String(have).trim() ? `là “${have}”` : 'trống'}, khác dữ liệu “${want}” – bạn điền đúng rồi bấm “▶ Chạy cả TB” lại`
              : `ô “${label}” trên trang đang là “${have}”, khác dữ liệu “${want}” – sửa trước khi Lưu hồ sơ`
          );
      }
      // Phường/Xã, Quy trình bỏ tích ở mẫu: trên trang phải đúng dữ liệu TB
      if (rp.phuongXa.use === 'off') {
        const want = tb.phuongXa || DEFAULT_PHUONG;
        let r = null;
        for (const label of ['Phường/Xã', 'Phường/Xã/Thị trấn']) {
          r = (await act('readSel', { label, want, exact: true })).find((x) => x.ok);
          if (r) break;
        }
        if (!r || !r.same)
          throw new Error(`ô “Phường/Xã” bỏ tích ở mẫu tab Trường mà trên trang đang ${r && r.value ? `là “${r.value}”` : 'trống'}, khác dữ liệu “${want}” – bạn chọn đúng rồi bấm “▶ Chạy cả TB” lại`);
      }
      if (rp.quyTrinh.use === 'off' && !anyOk(await act('hasCellText', { text: qtR })))
        throw new Error(`bảng quy trình chưa có “${qtR}” (ô Quy trình/Thủ tục bỏ tích ở mẫu tab Trường – tiện ích không chọn) – bạn chọn rồi bấm “▶ Chạy cả TB” lại`);
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
        // thửa bỏ qua (trùng) không đòi phải có trong bảng
        const need = allMode ? usableNow : rows.some((r) => usableNow.some((t) => sameThua(r, t))) ? [] : usableNow.slice(0, 1);
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

      // 7 (Tự động hết). Tự bấm “Lưu hồ sơ”, chờ “Lưu hồ sơ thành công”, chọn TB chưa làm tiếp theo
      if (AUTO()) {
        cur = step('Bấm “Lưu hồ sơ” (tự động)');
        await waitDialogs(cur);
        S.done[`${tb.tb}|bn`] = true;
        saveUi();
        S.armed = { tb: String(tb.tb), stage: 'tn', at: Date.now() };
        // ghi “đã bấm Lưu hồ sơ” TRƯỚC khi bấm: trang tải lại mà chưa kịp thấy báo thành công thì không tự tiếp nhận TB này lần nữa
        await setMark(tb.tb, 'tnClick', Date.now());
        const t0 = Date.now();
        const rs = await act('clickBtn', { texts: ['Lưu hồ sơ'] });
        if (!rs.some((x) => x.ok)) {
          await setMark(tb.tb, 'tnClick', null);
          const w = rs.find((x) => x.why && !x.none) || rs.find((x) => x.why);
          throw new Error(`không bấm được “Lưu hồ sơ” (${(w && w.why) || 'không thấy nút'}) – bạn tự bấm`);
        }
        cur.wait('đã bấm, chờ trang lưu…');
        let asked = '';
        for (;;) {
          stopIf();
          if ((S.lastMsg.tn || 0) > t0) break;
          // hộp “XÁC NHẬN THÊM MỚI HỒ SƠ – Bạn có thật sự muốn thêm mới hồ sơ hay không?” → Đồng ý (bạn yêu cầu); hộp lạ → chờ bạn
          let d = await dlgNow(LHS_DIALOGS, true);
          // “Số biên nhận … đã được sử dụng cho hồ sơ khác” (trang thật 23/11) – đúng số của TB này: hồ sơ đã có trên VBDLIS →
          // ghi ◐ Đã nhập nhưng chưa xong (đã tiếp nhận – không tiếp nhận lại), bấm Đồng ý, tải lại trang, 🤖 sang TB tiếp theo (bạn yêu cầu 23/11)
          if (d && !d.answered && SBN_USED.test(norm(d.text || '')) && digitsOf(tb.soBienNhan).length >= 8 && digitsOf(d.text || '').includes(digitsOf(tb.soBienNhan))) {
            S.armed = null;
            await setMark(tb.tb, 'tnClick', null);
            markStage(tb.tb, 'tn', 'suy');
            await setMark(tb.tb, 'daDung', Date.now());
            cur.ok(`trang báo “${d.text.slice(0, 160)}” – hồ sơ của TB ${tb.tb} đã có trên VBDLIS: ghi ◐ Đã nhập nhưng chưa xong`);
            const okD = (await act('answerDialog', { rules: [{ re: SBN_USED.source, btn: ['Đồng ý', 'OK', 'Đóng'] }] })).some((x) => x.ok);
            const nx = nextTodo(true);
            if (nx) {
              setPtr(nx.tb);
              saveUi();
            }
            try {
              await stageChain;
              await store.set({ tbCur: S.cur, tbRecv: S.recv, tbCurBy: S.curBy || '' });
            } catch (e) {}
            cur = step(nx ? `Tải lại trang, sang TB ${nx.tb} – ${whoOf(nx)}` : 'Tải lại trang');
            cur.ok(okD ? 'đã bấm Đồng ý hộp báo' : 'hộp báo đã đóng');
            cur = null;
            tailNeed = '-';
            tailOk = `<div class="hint">TB ${esc(tb.tb)}: số biên nhận đã được dùng cho hồ sơ khác – hồ sơ đã có trên VBDLIS, tiện ích ghi <b>◐ Đã nhập nhưng chưa xong</b> (bạn kiểm tra lại hồ sơ đó). ${
              nx ? `🤖 tải lại trang rồi tiếp nhận TB <b>${esc(nx.tb)}</b>.` : 'Hết TB chưa làm.'
            }</div>`;
            S.autoSig = '';
            setTimeout(() => {
              try {
                location.reload();
              } catch (e) {}
            }, 1500);
            return;
          }
          // hộp khác mà bạn đã dạy ở tab Trường → trả lời theo mẫu (sau khi đã xét hộp “số biên nhận đã dùng”)
          if (d && !d.answered && AUTO()) {
            const d2 = await dlgNow(LHS_DIALOGS);
            if (d2 && d2.answered) continue;
            d = d2 || d;
          }
          if (d && !d.answered && asked !== d.title) {
            asked = d.title;
            cur.wait(`trang hỏi “${(d.text || d.title || '').slice(0, 120)}” – tiện ích không tự trả lời hộp này, bạn xem rồi trả lời`);
            needYou('Trang đang hỏi – bạn trả lời', 'bad');
          }
          if (Date.now() - t0 > (asked ? WAIT_MAX_MS : 90000)) throw new Error('đã bấm “Lưu hồ sơ” nhưng chưa thấy “Lưu hồ sơ thành công” – xem lại trang');
          await sleep(500);
        }
        stopNeed();
        cur.ok('trang báo “Lưu hồ sơ thành công”');
        await sleep(1500); // onSaved đọc lại ô Số biên nhận rồi đánh dấu
        if (stageOf(tb) === 'chua') markStage(tb.tb, 'tn', 'auto');
        // trang chuyển sang màn hình hồ sơ (ảnh 1: nút “Xử lý hồ sơ”) → làm tiếp: Quy trình “Tiếp nhận hồ sơ” → chuyển chuyên viên…
        // (trang tải lại → bảng điền tự mở lại và làm tiếp)
        cur = step('Chờ màn hình hồ sơ (nút “Xử lý hồ sơ”)');
        let hv = false;
        for (let i = 0; i < 50 && !hv; i++) {
          stopIf();
          await sleep(400);
          hv = !!btnXuLyHoSo() && !(await topNow());
        }
        if (!hv) {
          cur.skip('chưa thấy nút “Xử lý hồ sơ” – mở hồ sơ vừa lưu, Tự động hết sẽ làm tiếp');
          tailNeed = '-';
          cur = null;
          return;
        }
        cur.ok();
        await runHoso(true);
        return;
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
        '<div class="hint">Bạn bấm <b>Lưu hồ sơ</b>; khi trang báo “Lưu hồ sơ thành công”, tiện ích tự ghi nhận TB này đã tiếp nhận (trạng thái vẫn <b>○ Chưa xong</b> tới khi chuyển lãnh đạo). Bước sau (Xử lý hồ sơ → <b>Nhập đơn đăng ký</b>): bấm “▶ Chạy cả TB” – tiện ích tự nhận hồ sơ đó là của TB nào, thêm đủ chủ và thửa, rồi lập phiếu đối chiếu.</div>';
    } catch (e) {
      const m = String((e && e.message) || e);
      if (e && e.hoanSkip) {
        // TB vừa được tạm hoãn vì trang báo lỗi không làm tiếp được (bạn yêu cầu 24/11) → không phải lỗi của lần chạy: không tạm giữ, không kêu,
        // 🤖 làm TB khác
        if (cur && (cur.l.icon === '⏳' || cur.l.icon === '⏸')) cur.wait(m);
        else log.push({ icon: '⏸', cls: 'warn', html: esc(m) });
        tailNeed = '-';
      } else {
        // 🤖 chạy liên tục (bạn yêu cầu 24/11): lần chạy do 🤖 tự bắt đầu vướng ở MỘT TB đã biết chắc – không phải popup / hộp hỏi chưa dạy đang
        // hiện, không phải lỗi chung, không phải do bạn → ⏸ tạm hoãn TB đó (lý do chung), không kêu; 20 giây sau 🤖 đóng cửa sổ của TB đó, làm TB khác
        let ns = false;
        try {
          dlgAtFail = !!pageDialog() || realDlgOpen(await act('dialogState')); // cửa sổ Lưu kho / Hồ sơ quét (chỉ có nút) không phải hộp hỏi
        } catch (e2) {
          dlgAtFail = true;
        }
        // (24/11) lỗi KÈM NÚT hỏi bạn (vd. đã bấm Thực thi / Thực hiện / Hoàn tất mà trang tải lại, chưa xác nhận được) cũng tạm hoãn TB đó, làm TB
        // khác (bạn: “không được có thời gian chờ chết”) – nút vẫn hiện ở dòng báo, dấu “đang chuyển / đã bấm” giữ nguyên (🤖 không bấm lại)
        if (fromAuto && AUTO() && !isLd() && !tplSig && tb && tbKnown && !S.stopReq) {
          const mn = norm(m);
          ns = !NS_USER.test(mn) && !NS_GLOBAL.test(mn) && !dlgAtFail;
        }
        if (cur && (cur.l.icon === '⏳' || cur.l.icon === '⏸')) cur.bad(m);
        else log.push({ icon: '✗', cls: 'bad', html: esc(m) });
        if (ns) {
          // TB đã tạm hoãn từ trước (vd. lỗi pháp lý / chưa ký số đã ghi lý do riêng) → giữ lý do đó, không đếm thêm
          if (!(S.stage[String(tb.tb)] || {}).hoan) {
            markStage(tb.tb, 'hoan', 'auto', {
              lyDo: e && e.actHtml ? nsReason(cur).replace(/ – xem dòng báo.*$/, ' – cần bạn xác nhận (đã bấm mà chưa rõ kết quả): chọn TB này, bấm ▶ để hiện nút trả lời') : nsReason(cur),
              ...(e && e.actHtml ? { ask: 1 } : {}),
            });
            if (!(e && e.actHtml)) S.nsRun = (S.nsRun || 0) + 1; // lỗi hỏi bạn xác nhận (kèm nút) không đếm vào bộ ngắt 5 TB
          }
          if (e && e.actHtml) actHtml = e.actHtml; // nút xác nhận vẫn hiện ở dòng báo
          if (fromAuto) {
            S.autoFail.add(fromAuto);
            S.autoFailAt = { ...(S.autoFailAt || {}), [fromAuto]: Date.now() };
          }
          safeRemove('tbGoList');
          if (S.nsRun >= NS_MAX) {
            // nhiều TB liền nhau đều vướng → có thể trang VBDLIS đổi / mạng lỗi: tắt 🤖 (khỏi tạm hoãn cả loạt TB), kêu bạn
            S.cvLeave = null;
            S.opts = { ...S.opts, tuDong: false };
            safeSet({ tbOpts: S.opts });
            failMsg = `${NS_MAX} TB liên tiếp bị tạm hoãn vì vướng (TB ${tb.tb} là TB thứ ${S.nsRun}) – có thể trang VBDLIS đổi / mạng lỗi: tiện ích TẮT 🤖. Bạn xem các TB ⏸ ở bảng Tiến độ rồi bật lại 🤖`;
            log.push({ icon: '✗', cls: 'bad', html: esc(failMsg) });
            S.nsRun = 0;
          } else {
            S.cvLeave = { tb: String(tb.tb), at: Date.now() };
            log.push({
              icon: '⏸',
              cls: 'warn',
              html: esc(`🤖 chạy liên tục: đã tạm hoãn TB ${tb.tb} – 20 giây sau (bạn không thao tác) 🤖 đóng cửa sổ của TB này (không lưu), làm TB khác`),
            });
            setEvt(`⏸ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: 🤖 vướng ở một bước → đã <b>tạm hoãn</b>, làm TB khác (lý do ở bảng Tiến độ).`, true);
            tailNeed = '-';
          }
        } else {
          if (e && e.actHtml) actHtml = e.actHtml; // tiện ích dừng để hỏi bạn → hiện nút xác nhận
          if (e && e.noFail) noFail = true;
          if (e && e.noRetry) noRetry = true;
          failMsg = m;
        }
      }
    } finally {
      S.running = false;
      S.listRun = false;
      S.stk = null;
      S.ldStk = null;
      if (fromAuto && !failMsg && (S.progN || 0) > prog0 && !(tb && (S.stage[String(tb.tb)] || {}).hoan)) S.nsRun = 0;
      if (fromAuto && failMsg && !tplSig && !noFail && isAlive()) {
        S.autoFail.add(fromAuto);
        S.autoFailAt = { ...(S.autoFailAt || {}), [fromAuto]: Date.now() };
      }
      if (failMsg) safeRemove('tbGoList'); // lần chạy dừng / lỗi → trang tải lại sau đó không tự tìm tiếp TB đó
      // 🤖 chạy mẫu: mỗi lần cửa sổ / hộp hỏi mở (màn hình: mỗi lần vào) chỉ chạy một lần – đã ghi ở S.tplRan lúc bắt đầu
      if (tplSig) S.autoSig = '';
      // dừng vì lỗi / hỏi bạn → bộ theo dõi không tự chạy lại TB này (ở mọi màn hình) cho tới khi bạn bấm ▶ / bật lại 🤖.
      // Chỉ tạm giữ TB đã biết chắc (lỗi trước khi nhận ra hồ sơ thì không giữ nhầm TB đang chọn)
      // (24/11) dấu “đã dừng” kèm loại lỗi: bạn bấm ■ Dừng / lỗi chung (tài khoản, dữ liệu…) → 🤖 không tự chạy lại; lỗi khác → 🤖 tự chạy lại sau
      // HOLD_RETRY_MS khi bạn không thao tác, tối đa RESUME_MAX lần rồi ⏸ tạm hoãn TB (holdRetry)
      if (failMsg && (!isAlive() || failMsg === DEAD_MSG)) noFail = true; // tiện ích vừa tải lại – không phải lỗi của TB
      if (failMsg && tb && tbKnown && !tplSig && !noFail) {
        const fm = norm(failMsg);
        setHold(tb.tb, {
          kind: 'err',
          stop: NS_STOP.test(fm) || noRetry ? 1 : 0, // bạn bấm ■ Dừng / Chạy thử / bạn chọn người khác / chờ bạn quyết → 🤖 không tự chạy lại
          hard: NS_HARD.test(fm) ? 1 : 0, // lỗi chung không tự hết
          user: NS_USER.test(fm) && !NS_STOP.test(fm) ? 1 : 0, // bạn vừa bấm / gõ trên trang → bạn ngưng 20 giây là 🤖 chạy lại
          dlg: dlgAtFail ? 1 : 0, // có hộp hỏi chưa dạy → hộp đóng (bạn trả lời) là 🤖 chạy lại
          nav: /ma trang khong chuyen/.test(fm) ? 1 : 0, // trang chậm, đi trang chưa được – không phải lỗi của TB
          glob: NS_GLOBAL.test(fm) && !NS_HARD.test(fm) ? 1 : 0, // lỗi chung (không cài được phần đưa file, không thấy ô tìm…) – không phải lỗi của TB
          why: nsReason(cur),
        });
      }
      S.runEndAt = Date.now();
      // chặng cuối (hồ sơ lãnh đạo trả về – TB cũ): trả lại con trỏ tiếp nhận như trước (không làm lệch “TB chưa làm tiếp theo”);
      // (25/11) TB ở trên giữ TB vừa làm
      if (stage3 && recvAtStart != null && String(S.recv) !== String(recvAtStart) && S.data.some((x) => String(x.tb) === String(recvAtStart))) {
        S.recv = String(recvAtStart);
        S.curBy = String(S.cur) === S.recv ? '' : 'auto';
        saveUi();
      }
      dropScanStash(); // dừng giữa chừng lúc đang tải file quét → bỏ file tạm
      if (!tplSig) stopNeed();
      updateRunBtn();
      render();
      // thửa đang bỏ qua vì bạn đóng cửa sổ không lưu → nhắc, kèm nút mở lại
      const bq = tb && !isLd() ? stageList(tb.tb, 'boQua') : [];
      const bqHtml = bq.length
        ? `<div class="hint">Thửa đang bỏ qua (bạn đóng cửa sổ không lưu – trùng?): <b>${esc(bq.map((k) => k.split('|').reverse().join('/')).join(', '))}</b> ${actBtn('unskip', tb.tb, 'Mở lại để thêm')}</div>`
        : '';
      tail =
        tailOk +
        bqHtml +
        (isLd()
          ? ldTailHint()
          : AUTO()
          ? `<div class="hint">🤖 Tự động hết đang BẬT: tiện ích tự bấm Lưu, Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Chuyển tiếp / Thực thi (đúng tài khoản trong cài đặt), Trả hồ sơ, tác vụ 2–3; ${
              isoAuto() ? 'tự Kết ISO (bạn bật “Tự Kết ISO”)' : 'không bấm Kết ISO (bật ô “Tự Kết ISO” ở tab Biên nhận để 🤖 tự làm)'
            } – nút bạn tích ở tab Trường thì bấm theo mẫu. Dừng giữa chừng thì sửa xong bấm “▶ Chạy cả TB”.</div>`
          : '<div class="hint">Tự động hết đang TẮT: tiện ích không bấm Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Chuyển tiếp, Thực thi, Trả hồ sơ, Kết ISO. Bấm “Chạy cả TB” lại bất cứ lúc nào – bước/thửa đã xong sẽ được bỏ qua.</div>');
      show();
      // báo bạn: xong (tới lượt bạn bấm Lưu) hoặc dừng để hỏi / báo lỗi; bạn tự bấm Dừng thì im lặng
      if (tailOk && tailNeed !== '-') needYou(tailNeed || 'Xong – tới lượt bạn bấm Lưu');
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
      if (ch.tbOpts || ch.tbAutoTab) {
        const wasAuto = AUTO();
        if (ch.tbOpts) S.opts = { ...(ch.tbOpts.newValue || {}) };
        if (ch.tbAutoTab) S.autoTab = ch.tbAutoTab.newValue;
        if (wasAuto && !AUTO() && S.running) S.stopReq = true; // Tự động hết vừa tắt / chuyển sang tab khác → dừng lượt đang chạy
        // vẽ lại cả bảng (ô tùy chọn đổi ở tab khác) – trừ khi bạn đang gõ trong bảng điền
        const a = root.activeElement;
        if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) render();
        else renderTop();
      }
      // mẫu tab Trường đổi (tab khác, hoặc chính tab này vừa ghi)
      if (ch.tbTpl) {
        const nv = { ...(ch.tbTpl.newValue || {}) };
        const ov = ch.tbTpl.oldValue || {};
        Object.values(nv).forEach(tplFix);
        S.tpl = nv;
        const d = S.tplDraft;
        if (d) {
          const t = nv[d.key];
          if (!t && ov[d.key]) {
            // mẫu đang mở bảng tích vừa bị xóa ở tab khác → đóng bảng tích (lần tích sau không tạo lại mẫu đã xóa)
            clearTimeout(S.tplSaveT);
            S.tplSaveT = null;
            S.tplDraft = null;
            setStatus(`Mẫu ${qn(d.name)} vừa bị xóa ở tab khác – đã đóng bảng tích.`, true);
            if (S.tab === 'tr') render();
          } else if (t && !(ov[d.key] && (ov[d.key].at || 0) === (t.at || 0)) && !(S.tplWrote && S.tplWrote.key === d.key && S.tplWrote.at >= (t.at || 0))) {
            // tab khác vừa sửa mẫu này → lấy tích / nguồn / giá trị / thứ tự của bản đó vào bảng đang mở; bộ dòng / nút khác (lấy lại
            // trường ở tab kia) → đóng bảng tích, không ghi đè bản mới
            if (!tplAdopt(d, t)) {
              clearTimeout(S.tplSaveT);
              S.tplSaveT = null;
              S.tplDraft = null;
              setStatus(`Mẫu ${qn(d.name)} vừa được lấy lại / sửa ở tab khác – đã đóng bảng tích, bấm “Sửa” để mở bản mới.`, true);
              if (S.tab === 'tr') render();
            } else {
              const a = root.activeElement;
              if (S.tab === 'tr' && (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.type === 'checkbox')) render();
            }
          }
        } else if (S.tab === 'tr') render();
      }
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
      // hàng chờ file quét đổi (tab này hoặc tab VBDLIS khác)
      if (ch.scanQ) {
        const q = ch.scanQ.newValue;
        S.scanQ = Array.isArray(q) ? q.filter((x) => x && x.id && Array.isArray(x.pairs)) : [];
        renderScanQ();
        // (24/11) TB 🤖 vừa để lại vì chưa có file quét: bạn thả đủ file của nó → lượt tìm mở lại ngay (không chờ 10 phút)
        try {
          let lifted = false;
          for (const [id, sn] of Object.entries(S.sweepSeen || {})) {
            if (!sn || sn.why !== 'scan') continue;
            const x = S.data.find((y) => String(y.tb) === id);
            if (x && hasScanFor(tbPairs(x))) {
              delete S.sweepSeen[id];
              lifted = true;
            }
          }
          if (lifted) {
            saveSweepSeen();
            S.sweepNext = 0;
          }
        } catch (e) {}
      }
      // dấu ✓ từng mục đổi ở tab khác → lấy bản mới, giữ những khóa tab này đã đổi mà chưa ghi xong
      if (ch.tbDone) {
        const nv = ch.tbDone.newValue || {};
        const merged = { ...nv };
        doneChanged().forEach((k) => {
          if (k in S.done) merged[k] = S.done[k];
          else delete merged[k];
        });
        doneBase = { ...nv };
        if (JSON.stringify(merged) !== JSON.stringify(S.done)) {
          S.done = merged;
          if (!S.running && !root.activeElement) render();
        }
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
      // (25/11) TB ở trên chưa chạy theo lúc bạn đang gõ → giờ chạy theo
      if (S.viewWant && !root.activeElement) {
        const w = S.data.find((x) => String(x.tb) === String(S.viewWant));
        S.viewWant = null;
        if (w) viewTb(w);
      }
    }, 400)
  );

  async function removeTbs(ids) {
    const all = ids === null;
    const gone = all ? S.data.map((x) => String(x.tb)) : ids;
    const k0 = S.data.findIndex((x) => String(x.tb) === String(S.cur));
    const kR = S.data.findIndex((x) => String(x.tb) === String(S.recv));
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
    if (!S.data.some((x) => String(x.tb) === String(S.recv))) {
      const nextR = S.data[Math.min(Math.max(kR, 0), S.data.length - 1)];
      S.recv = nextR ? String(nextR.tb) : null;
    }
    S.curBy = S.cur != null && String(S.cur) !== String(S.recv) ? S.curBy || 'auto' : '';
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
    setPtr(items[0].tb);
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

  // ---------- 🤖 Tự động hết: bật / tắt (nút cạnh ▶ và nút 🤖 trên thanh tiêu đề khi thu nhỏ bảng) ----------
  // Lần bật đầu tiên hỏi xác nhận (đọc kỹ những nút tiện ích sẽ tự bấm); các lần sau bấm là bật, chạy ngay màn hình đang mở
  function toggleAuto(fromMini) {
    if (!AUTO()) {
      // vai trò Lãnh đạo: hỏi riêng (việc 🤖 làm khác hẳn vai trò Chuyên viên)
      if (isLd() && (!S.opts.autoAckLd || !fromMini)) {
        const ok = confirm(
          [
            'Bật “Tự động hết” – vai trò LÃNH ĐẠO?',
            '',
            'Tiện ích TỰ CHẠY ở Danh sách hồ sơ thụ lý (đăng nhập tài khoản lãnh đạo) và TỰ BẤM:',
            '• bấm vào hồ sơ KH 2959… đang ở bước “… Lãnh đạo …” → Xử lý hồ sơ → tích “Đã xử lý” Ký duyệt hồ sơ → Chuyển tiếp',
            `• bước “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)” → chọn đúng tài khoản “${ldRecv() || '(chưa đặt)'}” → Thực thi → kiểm tra hồ sơ đã rời bước lãnh đạo`,
            `• hết hồ sơ (cả các trang sau): ${S.opts.ldLoop !== false ? `tải lại danh sách sau ${Math.round(ldWaitMs() / 1000)} giây để nhận hồ sơ mới` : 'dừng (Chạy liên tục đang tắt)'}`,
            '',
            `Hồ sơ lỗi → kêu ting, để lại, làm hồ sơ khác, thử lại sau (tối đa ${LD_MAX} lần rồi bỏ qua). Đăng nhập sai tài khoản / chưa có tài khoản nhận → dừng hẳn chờ bạn.`,
          ].join('\n')
        );
        if (!ok) return;
      } else if (!isLd() && (!S.opts.autoAck || !fromMini)) {
        const ok = confirm(
          [
            'Bật “Tự động hết”?',
            '',
            'Tiện ích sẽ TỰ CHẠY khi bạn mở: màn hình Tiếp nhận hồ sơ (trống), hồ sơ đã lưu, cửa sổ Nhập đơn đăng ký, cửa sổ Quy trình xử lý – và TỰ BẤM:',
            '• Lưu cửa sổ thửa, Đồng ý “Cập nhật địa chỉ tài sản”, Lưu hồ sơ, Đồng ý “Xác nhận thêm mới hồ sơ”',
            '• Xử lý hồ sơ → tích “Tiếp nhận hồ sơ” → Chuyển tiếp → chọn đúng tài khoản chuyên viên → Thực thi',
            '• Xử lý hồ sơ → Nhập đăng ký: Lưu chủ / thửa, Đồng ý “Giấy tờ tùy thân đã tồn tại”, Lưu thông tin đăng ký, Hoàn tất, Đóng',
            '• tích “Nhập đăng ký”, “Giấy tờ đính kèm” → Chuyển tiếp → chọn đúng tài khoản lãnh đạo → Thực thi → sang TB chưa làm tiếp theo',
            `• Quy trình 5 tác vụ: tác vụ 2 (Thực hiện, Đồng ý), 3 (Lưu kho hồ sơ quét, Cập nhật); ${
              S.opts.tuISO === true ? 'tự Kết ISO (Thực hiện, Đồng ý)' : 'bạn Kết ISO'
            }, tích đủ → Chuyển tiếp bước “Trả kết quả” (tài khoản của bạn) → Thực thi → Xử lý hồ sơ → Trả hồ sơ: Thực hiện, Đồng ý`,
            '',
            `Tài khoản nhận: chuyên viên (của bạn) “${S.opts.ctCV || '(chưa đặt)'}”, lãnh đạo “${S.opts.ctLD || '(chưa đặt)'}” (sửa ở tab Biên nhận).`,
            'Chạy liên tục: TB vướng (ô lệch / thiếu dữ liệu, không thấy đúng người, trang lỗi…) → ⏸ tạm hoãn TB đó, đóng cửa sổ của nó, làm TB khác; hồ sơ chờ bạn Kết ISO / file quét → đóng Quy trình, làm TB khác. Popup / hộp hỏi CHƯA dạy → dừng, kêu ting chờ bạn; popup bạn đã dạy ở tab Trường (cả hộp báo lỗi) → bấm theo mẫu. 5 TB liên tiếp bị tạm hoãn → 🤖 tự tắt.',
            S.opts.tuISO === true
              ? 'Kết ISO: tiện ích tự làm (bạn đã bật “Tự Kết ISO” – tắt ở tab Biên nhận).'
              : 'Không bấm Kết ISO (muốn 🤖 tự làm: bật ô “Tự Kết ISO” ở tab Biên nhận).',
          ].join('\n')
        );
        if (!ok) return;
      }
      S.opts = { ...S.opts, tuDong: true, ...(isLd() ? { autoAckLd: true } : { autoAck: true }) }; // 3 ô tự động (chủ / hồ sơ quét / Quy trình) coi như bật khi 🤖 bật (optOn)
      // vai trò Lãnh đạo: bỏ dấu dừng (lỗi cài đặt), dấu “chờ bạn” – làm ngay màn hình đang mở
      S.ld.block = '';
      S.ld.idleAt = 0;
      S.ld.pages = 0;
      Object.values(S.ld.items).forEach((x) => delete x.wait);
      ldSave();
      S.autoSig = '';
      S.autoFail.clear();
      S.resumeN = {};
      S.stk = null;
      userStopSet(false);
      dropHold();
      S.cvLeave = null;
      S.sweepSeen = {};
      saveSweepSeen();
      roundReset();
      setSweepPause(false);
      S.sweepNext = 0;
      S.autoOnAt = Date.now();
      if (S.tabId != null) S.autoTab = S.tabId;
      audioReady();
      setStatus('🤖 Tự động hết: BẬT – tiện ích tự chạy màn hình đang mở.');
      // nhận tab này là tab chạy TRƯỚC khi ghi tuDong – tab chạy cũ không tưởng mình vẫn là tab chạy dù chỉ chốc lát
      send({ type: 'vbdlis-claim' })
        .then((r) => {
          if (r && r.ok && r.tabId != null) S.autoTab = r.tabId;
        })
        .finally(() => {
          safeSet({ tbOpts: S.opts });
          renderTop();
        });
      render();
      setTimeout(autoTick, 300); // chạy ngay màn hình đang mở, không chờ nhịp sau
      return;
    }
    S.opts = { ...S.opts, tuDong: false };
    S.cvLeave = null;
    userStopSet(false);
    if (S.running) S.stopReq = true; // đang chạy → dừng luôn
    setStatus('🤖 Tự động hết: TẮT – tiện ích không tự bấm Lưu hồ sơ / Lưu thông tin đăng ký / Hoàn tất / Chuyển tiếp / Trả hồ sơ nữa.');
    safeSet({ tbOpts: S.opts });
    render();
  }

  // ---------- sự kiện ----------
  // tiện ích vừa được tải lại → bảng cũ không lưu được gì nữa: báo ngay thay vì làm như đã lưu
  const deadGuard = () => {
    if (isAlive()) return false;
    setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
    return true;
  };
  root.addEventListener('input', (e) => {
    const el = e.target;
    // tab Trường: số chủ / thửa / giấy tờ của mẫu (nhớ theo từng mẫu)
    if (el && el.dataset && el.dataset.tplidx != null) {
      S.tplIdx = { ...S.tplIdx, [el.dataset.tplidx]: Math.max(1, parseInt(el.value, 10) || 1) };
      return;
    }
    if (el && el.dataset && el.dataset.tplbOrd != null && S.tplDraft) {
      if (tplDead()) return;
      const x = (S.tplDraft.btns || [])[+el.dataset.tplbOrd];
      if (x) x.ord = String(el.value || '').replace(/[^\d.]/g, '');
      tplAutoSave();
      return;
    }
    if (el && el.dataset && el.dataset.tplVal != null && S.tplDraft) {
      if (tplDead()) return;
      const x = S.tplDraft.items[+el.dataset.tplVal];
      if (x) {
        x.val = el.value;
        x.uv = true; // giá trị mẫu do bạn gõ
      }
      tplAutoSave();
      return;
    }
    const p = el && el.dataset && el.dataset.path;
    const tb = curTB();
    if (p && tb) {
      if (deadGuard()) return;
      setPath(tb, p, el.value);
      markDirty(tb);
    }
  });

  root.addEventListener('change', (e) => {
    // tab Trường: chọn file cấu hình để nạp
    if (e.target.id === 'cfgFile') {
      const inp = e.target;
      const file = inp.files && inp.files[0];
      inp.value = '';
      if (file) tplImportFile(file).catch((err) => setResult(`<div class="bad">✗ Không nạp được cấu hình: ${esc(friendly(err))}</div>`));
      return;
    }
    if (e.target.closest && e.target.closest('.dlg')) return; // ô trong hộp Dữ liệu / Tiến độ: hộp tự xử lý
    {
      // tab Trường: tích ô / đổi nguồn / đổi giá trị mẫu / tích nút – lưu ngay
      const ds = e.target.dataset || {};
      const d = S.tplDraft;
      if (d && (ds.tplbOn != null || ds.tplbOrd != null || ds.tplOn != null || ds.tplSrc != null || ds.tplVal != null) && tplDead()) {
        render(); // bảng đã mất kết nối: ô trở về như đã lưu
        return;
      }
      if (d && (ds.tplbOn != null || ds.tplbOrd != null)) {
        // nút: tích → thứ tự bấm = sau nút cuối cùng đang tích; bỏ tích → bỏ số
        const x = (d.btns || [])[+(ds.tplbOn ?? ds.tplbOrd)];
        if (!x) return;
        if (ds.tplbOn != null) {
          x.on = e.target.checked;
          if (x.on && !String(x.ord || '').trim()) x.ord = String(Math.max(0, ...d.btns.filter((y) => y.on && y !== x).map((y) => +y.ord || 0)) + 1);
          if (!x.on) x.ord = '';
          render();
        } else x.ord = String(e.target.value || '').replace(/[^\d.]/g, '');
        tplAutoSave(true);
        return;
      }
      if (d && (ds.tplOn != null || ds.tplSrc != null || ds.tplVal != null)) {
        const x = d.items[+(ds.tplOn ?? ds.tplSrc ?? ds.tplVal)];
        if (!x) return;
        if (ds.tplOn != null) x.on = e.target.checked;
        else if (ds.tplSrc != null) {
          x.src = e.target.value;
          if (x.src === 'tb') x.on = true;
          else x.uv = true; // bạn chọn giá trị mẫu cho ô này
          render();
        } else {
          x.val = e.target.value;
          x.uv = true;
        }
        tplAutoSave(true);
        return;
      }
    }
    if (deadGuard()) {
      if (e.target.id === 'tbStage') renderTop();
      return;
    }
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
    if (e.target.id === 'scanDir') {
      // chọn cả thư mục → lấy hết file quét trong các thư mục con
      const files = [...(e.target.files || [])];
      e.target.value = '';
      if (files.length) queueScanFiles(files.filter(isScanFile));
      return;
    }
    if (e.target.id === 'scanFile') {
      // chọn file quét bằng nút → đính kèm như khi thả file vào bảng
      const files = [...(e.target.files || [])];
      e.target.value = '';
      if (files.length) queueScanFiles(files.filter(isScanFile));
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
    if (e.target.id === 'optCtCV' || e.target.id === 'optCtLD') {
      // tài khoản nhận khi Tự động hết chuyển tiếp (so cả chuỗi Tên tài khoản)
      const k = e.target.id === 'optCtCV' ? 'ctCV' : 'ctLD';
      const v = String(e.target.value || '').replace(/\s+/g, '');
      e.target.value = v;
      S.opts = { ...S.opts, [k]: v };
      safeSet({ tbOpts: S.opts });
      S.ld.block = '';
      ldSave();
      renderLd();
      setStatus(v ? `Chuyển tiếp ${k === 'ctCV' ? 'chuyên viên' : 'lãnh đạo'}: tài khoản ${v}.` : `Đã xóa tài khoản ${k === 'ctCV' ? 'chuyên viên' : 'lãnh đạo'} – Tự động hết sẽ dừng ở bước chọn người.`);
      return;
    }
    if (e.target.id === 'optVaiTro') {
      // vai trò: Chuyên viên (như trước) / Lãnh đạo (ký duyệt → chuyển bước 4)
      const v = e.target.value === 'ld' ? 'ld' : 'cv';
      const was = isLd() ? 'ld' : 'cv';
      // 🤖 đang bật mà đổi vai trò → tắt 🤖 (vai trò mới làm việc khác hẳn – bật lại thì tiện ích hỏi xác nhận đúng vai trò đó)
      const offAuto = v !== was && AUTO();
      S.opts = { ...S.opts, vaiTro: v, ...(offAuto ? { tuDong: false } : {}) };
      if (offAuto && S.running) S.stopReq = true;
      setSweepPause(false);
      safeSet({ tbOpts: S.opts });
      S.autoSig = '';
      S.autoFail.clear();
      S.ld.block = '';
      S.ld.idleAt = 0;
      ldSave();
      render();
      setStatus(
        (v === 'ld'
          ? 'Vai trò: LÃNH ĐẠO – mở “Xử lý công việc” bằng tài khoản lãnh đạo; 🤖 ký duyệt hồ sơ, chuyển bước 4 cho đúng tài khoản.'
          : 'Vai trò: CHUYÊN VIÊN – tiếp nhận, nhập đơn, chuyển lãnh đạo, trả hồ sơ như trước.') + (offAuto ? ' 🤖 đã TẮT – bấm 🤖 để bật lại cho vai trò này.' : ''),
        offAuto
      );
      return;
    }
    if (e.target.id === 'optCtB4' || e.target.id === 'optLdBuoc' || e.target.id === 'optLdLoop' || e.target.id === 'optLdWait') {
      const id = e.target.id;
      if (id === 'optCtB4') {
        const v = String(e.target.value || '').replace(/\s+/g, '');
        e.target.value = v;
        S.opts = { ...S.opts, ctB4: v };
        setStatus(v ? `Người nhận bước 4: ${v}.` : `Người nhận bước 4: dùng ô Chuyên viên (${S.opts.ctCV || 'chưa đặt'}).`);
      } else if (id === 'optLdBuoc') {
        const v = String(e.target.value || '').replace(/\s+/g, ' ').trim();
        S.opts = { ...S.opts, ldBuoc: v && norm(v) !== norm(LD_BUOC_DEF) ? v : '' };
        if (!v) e.target.value = LD_BUOC_DEF;
        setStatus(`Bước nhận phải có: “${S.opts.ldBuoc || LD_BUOC_DEF}”.`);
      } else if (id === 'optLdLoop') {
        S.opts = { ...S.opts, ldLoop: e.target.checked };
        setStatus(e.target.checked ? 'Chạy liên tục: hết hồ sơ thì 🤖 tải lại danh sách để nhận hồ sơ mới.' : 'Chạy liên tục: TẮT – hết hồ sơ thì 🤖 dừng.');
      } else {
        const n = Math.max(15, parseInt(e.target.value, 10) || 60);
        e.target.value = String(n);
        S.opts = { ...S.opts, ldWait: n };
        setStatus(`Tải lại danh sách / thử lại hồ sơ lỗi sau ${n} giây.`);
      }
      safeSet({ tbOpts: S.opts });
      S.ld.block = '';
      ldSave();
      renderLd();
      return;
    }
    if (e.target.id === 'optTocDo') {
      S.opts = { ...S.opts, tocDo: e.target.value };
      safeSet({ tbOpts: S.opts });
      setStatus(`Tốc độ tự động: ${e.target.options[e.target.selectedIndex].text}.`);
      return;
    }
    if (e.target.id === 'optThuTT') {
      S.opts = { ...S.opts, thuThucThi: e.target.checked };
      safeSet({ tbOpts: S.opts });
      setStatus(e.target.checked ? 'Chạy thử: tiện ích chọn sẵn đúng người rồi dừng ở Thực thi / Trả hồ sơ cho bạn bấm.' : 'Tự bấm Thực thi / Trả hồ sơ (Tự động hết).');
      return;
    }
    if (e.target.id === 'optTuISO') {
      S.opts = { ...S.opts, tuISO: e.target.checked };
      safeSet({ tbOpts: S.opts });
      if (e.target.checked) {
        // (24/11) TB 🤖 vừa để lại vì chờ bạn Kết ISO → mở lại ngay (không chờ 10 phút)
        let lifted = false;
        for (const [sid, sn] of Object.entries(S.sweepSeen || {}))
          if (sn && sn.why === 'iso') {
            delete S.sweepSeen[sid];
            lifted = true;
          }
        if (lifted) {
          saveSweepSeen();
          S.sweepNext = 0;
        }
      }
      setStatus(
        e.target.checked
          ? 'Tự Kết ISO: BẬT – khi 🤖 Tự động hết bật, Quy trình chỉ còn thiếu Kết ISO thì tiện ích tự Kết ISO (Thực hiện, Đồng ý) rồi chuyển bước Trả kết quả.'
          : 'Tự Kết ISO: TẮT – bạn tự làm Kết ISO, tiện ích chờ như cũ.'
      );
      return;
    }
    if (e.target.id === 'optSangTB') {
      S.opts = { ...S.opts, tuSangTB: e.target.checked };
      safeSet({ tbOpts: S.opts });
      setStatus(e.target.checked ? 'Xong TB thì tự sang TB chưa làm tiếp theo.' : 'Xong TB thì dừng, bạn tự mở TB sau.');
      return;
    }
    if (e.target.id === 'optTuChu' || e.target.id === 'optTuHsq' || e.target.id === 'optTuQT') {
      const k = { optTuChu: 'tuLuuChu', optTuHsq: 'tuHsq', optTuQT: 'tuQT' }[e.target.id];
      S.opts = { ...S.opts, [k]: e.target.checked };
      safeSet({ tbOpts: S.opts });
      setStatus(
        {
          tuLuuChu: e.target.checked ? 'Chủ sử dụng: mọi ô khớp thì tiện ích tự bấm Lưu.' : 'Chủ sử dụng: tiện ích điền rồi chờ bạn bấm Lưu.',
          tuHsq: e.target.checked ? 'Hồ sơ quét: tiện ích tự thêm dòng và tải file lên.' : 'Hồ sơ quét: tiện ích dừng để bạn tự thêm dòng.',
          tuQT: e.target.checked
            ? 'Quy trình xử lý: tiện ích tự Thực hiện / Đồng ý / Cập nhật và tích Đã xử lý.'
            : 'Quy trình xử lý: tiện ích dừng ở Thực hiện / Cập nhật cho bạn bấm, tô vàng Đã xử lý.',
        }[k]
      );
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
      const id = String(tb.tb);
      const s0 = S.stage[id] || {};
      if (v === 'hoan') {
        // tạm hoãn: ghi lý do (vd. “chưa rõ chủ”, “trùng TB 1527”) để cuối đợt xem lại
        const lyDo = prompt(`Lý do tạm hoãn TB ${tb.tb} (vd. chưa rõ chủ, chờ hỏi lại…) – lý do được lưu cả trong file sao lưu tiến độ, đừng ghi tên hay số CCCD:`, '');
        if (lyDo === null) return renderTop(); // bấm Hủy → giữ trạng thái cũ
        markStage(tb.tb, 'hoan', 'tay', { lyDo: lyDo.trim() });
      } else if (v === 'tn') {
        // ◐ Đã nhập nhưng chưa xong = đã chuyển lãnh đạo (ghi mốc chuyển lãnh đạo; bỏ dấu Xong / đã Trả hồ sơ nếu có – 🤖 làm lại chặng cuối)
        S.stage[id] = s0.xong || s0.tra ? unXongTay(s0) : { ...s0 }; // TB chưa trả: giữ dấu đang Trả hồ sơ / không thấy
        markStage(tb.tb, 'ld', 'tay');
      } else if (v === 'chua' && (s0.tn || s0.don || s0.tnClick)) {
        // ○ Chưa xong cho TB đã tiếp nhận: mặc định GIỮ dấu đã tiếp nhận / nhập đơn – tiện ích không tiếp nhận lại (tránh hồ sơ trùng)
        if (
          confirm(
            `TB ${tb.tb} đã tiếp nhận${s0.tn ? ' lúc ' + fmtTime(s0.tn) : ''}. Đổi về “Chưa xong”: bỏ dấu đã chuyển lãnh đạo / xong / tạm hoãn, GIỮ dấu đã tiếp nhận, nhập đơn (tiện ích không tiếp nhận lại TB này). Đồng ý?`
          )
        ) {
          const s = { ...s0 };
          ['ld', 'ldBy', 'kq', 'trk', 'trkBy', 'tra', 'traBy', 'xong', 'xongBy', 'hoan', 'fwd', 'daDung', 'kd', 'traMiss', 'sot', 'dsNo', 'sotN', 'chk', 'chkTry', 'chkN'].forEach((k) => delete s[k]);
          S.stage[id] = s;
          if (S.chainTb && String(S.chainTb.tb) === id) setChainTb(null);
          if (s.tn) redoSet(id, true); // (24/11) 🤖 tìm ở danh sách làm tiếp TB này (lượt tìm thường chỉ tìm TB ◐)
          saveStage(id);
          renderTop();
        } else if (
          confirm(
            `Xóa HẾT dấu của TB ${tb.tb}, kể cả dấu đã tiếp nhận? Chỉ làm khi đánh dấu nhầm – tiện ích sẽ TIẾP NHẬN LẠI TB này (dễ tạo hồ sơ TRÙNG trên VBDLIS nếu hồ sơ đã có).`
          )
        )
          markStage(tb.tb, 'chua', 'tay');
        else return renderTop();
      } else markStage(tb.tb, v, 'tay');
      S.confirmTn = null;
      S.confirmDon = null;
      setStatus(`TB ${tb.tb}: đã đánh dấu tay “${STAGE_TEXT[showStage(tb)]}”.`);
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('.dlg')) return;
    if (b.id === 'runAll') {
      if (e.detail > 1) return; // lần bấm thứ 2 của bấm đúp → bỏ qua (không tự dừng, không chạy lại)
      if (S.running) {
        S.stopReq = true;
        if (AUTO()) userStopSet(true); // (soát 24/11) 🤖 thôi tự làm tiếp / tự chạy lại tới khi bạn bấm ▶ / tắt – bật lại 🤖
        b.textContent = '… đang dừng';
        // ■ Dừng lúc tiện ích đang TÌM ở Danh sách hồ sơ thụ lý → 🤖 thôi tự tìm (tới khi bạn bấm ▶ / bật lại 🤖);
        // dừng các việc khác (tiếp nhận, chuyển tiếp…) thì không. Thôi tìm tiếp TB vừa bấm ▶ khi trang chuyển
        if (S.listRun || isLd()) setSweepPause(true); // vai trò Lãnh đạo: ■ Dừng = 🤖 thôi làm (cả Quy trình / cửa sổ chọn người đang mở)
        S.goListPending = false;
        safeRemove('tbGoList');
      } else if (!isAlive()) setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      else {
        audioReady();
        S.autoFail.clear(); // bạn đã xem / sửa → bộ theo dõi Tự động hết được chạy lại các màn hình đã dừng
        S.resumeN = {};
        S.stk = null;
        userStopSet(false);
        S.ld.block = '';
        S.ld.idleAt = 0;
        Object.values(S.ld.items).forEach((x) => delete x.wait);
        ldSave();
        dropHold();
        S.sweepSeen = {};
        saveSweepSeen();
        roundReset();
        setSweepPause(false);
        S.sweepNext = 0;
        if (S.holdNote === 'sweepPause') S.holdNote = '';
        runAll();
      }
      return;
    }
    // (25/11) ⚡ Soát hàng loạt: bật / tắt. Bật lúc đang ở Danh sách hồ sơ thụ lý mà 🤖 tắt, tiện ích rảnh → soát ngay một lượt; 🤖 bật → 🤖 soát
    // ở lần kiểm màn hình tới (không phải chờ 1 phút)
    if (b.id === 'bulkBtn') {
      if (e.detail > 1) return;
      const on = !bulkOn();
      S.opts = { ...S.opts, sotLoat: on };
      safeSet({ tbOpts: S.opts });
      bulkSave(null);
      S.bulkNow = on ? Date.now() : 0;
      if (on) S.sweepNext = 0;
      render();
      setStatus(
        on
          ? '⚡ Soát hàng loạt: BẬT – ở Danh sách hồ sơ thụ lý 🤖 đọc cả danh sách một lần (lật hết các trang) rồi đối chiếu mọi TB ◐ / ✓ cùng lúc; chỉ TB còn hồ sơ mới tìm từng số để mở làm.'
          : '⚡ Soát hàng loạt: TẮT – 🤖 tìm từng TB ở Danh sách hồ sơ thụ lý như cũ.'
      );
      if (on && !AUTO() && !S.running && isAlive() && onListPage()) runAll();
      return;
    }
    if (b.id === 'autoBtn' || b.id === 'miniAuto') {
      if (e.detail > 1) return;
      if (!isAlive()) return setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      toggleAuto(b.id === 'miniAuto');
      return;
    }
    // bảng Lãnh đạo: Quét danh sách (chỉ đọc), Xóa dấu lỗi, “Chưa chuyển – làm lại hồ sơ …”
    if (b.id === 'ldScanBtn') {
      if (!onListPage()) return setStatus('Mở “Xử lý công việc” (Danh sách hồ sơ thụ lý) rồi bấm “Quét danh sách”.', true);
      const rows = ldScanPage();
      const pg = ldPager();
      renderLd();
      setStatus(
        `Trang danh sách: ${rows.length} hồ sơ, ${rows.filter((x) => LD_STEP.test(x.step)).length} ở bước lãnh đạo, ${rows.filter(ldCand).length} chờ ký duyệt${
          pg && pg.next ? ' (còn trang sau – 🤖 tự xem)' : ''
        }.`
      );
      return;
    }
    if (b.id === 'ldClearBtn') {
      let n = 0;
      for (const [k, x] of Object.entries(S.ld.items))
        if (x.st === 'loi' || x.st === 'bo') {
          S.ld.items[k] = { so: x.so, st: 'cho', at: Date.now() };
          n++;
        }
      Object.values(S.ld.items).forEach((x) => delete x.wait);
      S.ld.block = '';
      S.autoFail.clear();
      ldSave();
      renderLd();
      setStatus(n ? `Đã xóa dấu lỗi của ${n} hồ sơ – 🤖 sẽ làm lại.` : 'Không có hồ sơ nào đang lỗi.');
      return;
    }
    if (b.dataset.ldredo) {
      if (e.detail > 1 || S.running || S.busy) return;
      const k = b.dataset.ldredo;
      const x = S.ld.items[k] || {};
      S.ld.items[k] = { so: x.so || k, st: 'cho', at: Date.now() };
      S.ld.block = '';
      S.autoFail.clear();
      setSweepPause(false);
      ldSave();
      renderLd();
      audioReady();
      runAll();
      return;
    }
    // nút trong dòng báo: bạn xác nhận rồi chạy tiếp / đánh dấu tiến độ bằng một bấm
    if (b.dataset.act) {
      if (e.detail > 1 || S.running || S.busy) return;
      if (!isAlive()) return setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      const id = String(b.dataset.tb || '');
      const a = b.dataset.act;
      if (!S.data.some((x) => String(x.tb) === id)) return setStatus(`Không còn TB ${id} trong dữ liệu.`, true);
      dropHold(id); // bạn đã xem TB này → bộ theo dõi được tự chạy TB đó lại
      if (a === 'markTn' || a === 'markDon' || a === 'markXong') {
        if (a === 'markXong') markStage(id, 'xong', 'tay');
        else markStage(id, a === 'markTn' ? 'tn' : 'don', 'tay', a === 'markDon' ? { lech: parseInt(b.dataset.lech || '0', 10) || 0 } : undefined);
        setEvt(
          `✓ Đã đánh dấu TB ${esc(id)} ${a === 'markTn' ? 'đã tiếp nhận (○ Chưa xong)' : a === 'markDon' ? (stageOf({ tb: id }) === 'xong' ? 'đã nhập đơn → ✓ xong (đã lưu kho hồ sơ quét từ trước)' : 'đã nhập đơn (vẫn ○ Chưa xong)') : '✓ xong'}.`
        );
        return;
      }
      if (a === 'markTra') {
        // bạn đã kiểm tra trên VBDLIS: hồ sơ đã trả → ghi mốc Trả hồ sơ + ✓ Xong (bỏ dấu “đang Trả hồ sơ”)
        markStage(id, 'tra', 'tay');
        setEvt(`✓ Đã ghi nhận TB ${esc(id)}: đã <b>Trả hồ sơ</b> – <b>✓ Xong</b>.`);
        return;
      }
      if (a === 'unSot') {
        // bạn đã xem cảnh báo của lượt kiểm TB ✓ (hồ sơ trùng số / của TB khác / vẫn còn sau khi làm lại) → bỏ cảnh báo, giữ ✓
        setMark(id, 'sot', null);
        setEvt(`✓ Đã bỏ cảnh báo kiểm lại của TB ${esc(id)}.`);
        return;
      }
      if (a === 'hoanDup') {
        // TB chỉ còn thửa trùng → tạm hoãn để cuối đợt xem lại
        markStage(id, 'hoan', 'tay', { lyDo: b.dataset.ly || 'trùng thửa' });
        setEvt(`⏸ Đã tạm hoãn TB ${esc(id)} (${esc(b.dataset.ly || 'trùng thửa')}).`);
        return;
      }
      if (a === 'markLd') {
        // bạn đã kiểm tra trên VBDLIS: hồ sơ đã sang lãnh đạo → ghi nhận rồi làm tiếp (sang TB sau)
        markStage(id, 'ld', 'tay');
        setEvt(`✓ Đã ghi nhận TB ${esc(id)}: đã chuyển lãnh đạo – <b>◐ Đã nhập nhưng chưa xong</b>.`);
      }
      if (a === 'clearFwd') {
        // bạn đã kiểm tra trên VBDLIS: chưa chuyển / chưa trả → bỏ dấu “đang chuyển” và mốc bước đó, chạy lại
        const s0 = { ...(S.stage[id] || {}) };
        const k = b.dataset.k || (s0.fwd && s0.fwd.k);
        delete s0.fwd;
        delete s0.traMiss;
        if (k && s0[k] && s0[k + 'By'] !== 'tay') {
          delete s0[k];
          delete s0[k + 'By'];
        }
        // chưa trả → bỏ cả dấu ✓ Xong tiện ích tự ghi (dấu bạn đánh tay thì giữ)
        if (k === 'tra' && s0.xong && s0.xongBy !== 'tay') {
          delete s0.xong;
          delete s0.xongBy;
        }
        if (Object.keys(s0).length) S.stage[id] = s0;
        else delete S.stage[id];
        await saveStage(id);
        renderTop();
      }
      if (a === 'unskip') {
        // mở lại các thửa đã bỏ qua của TB này rồi chạy lại
        const s = { ...(S.stage[id] || {}) };
        delete s.boQua;
        if (Object.keys(s).length) S.stage[id] = s;
        else delete S.stage[id];
        saveStage(id);
      }
      // (24/11) TB đang ⏸ vì 🤖 hỏi bạn (lỗi kèm nút) – bạn bấm nút trả lời → bỏ tạm hoãn đó, chạy tiếp
      if (['clearFwd', 'confirmTn', 'confirmDon', 'unskip'].includes(a) && ((S.stage[id] || {}).hoan || {}).ask) {
        const sa = { ...(S.stage[id] || {}) };
        delete sa.hoan;
        if (Object.keys(sa).length) S.stage[id] = sa;
        else delete S.stage[id];
        await saveStage(id);
        renderTop();
      }
      if (String((curTB() || {}).tb) !== id || String(S.recv) !== id) selectTb(id); // nút của TB khác → chọn TB đó trước (cả con trỏ – như trước)
      setSweepPause(false); // bạn bấm nút trong dòng báo → 🤖 làm tiếp như thường
      if (a === 'confirmTn' || a === 'confirmDon') S[a] = { tb: id, at: Date.now() };
      else if (a === 'unHoan') {
        // bỏ hoãn: chỉ xóa dấu hoãn, giữ tiến độ, thửa đã nhập, thửa bỏ qua
        const s0 = { ...(S.stage[id] || {}) };
        delete s0.hoan;
        if (Object.keys(s0).length) S.stage[id] = s0;
        else delete S.stage[id];
        saveStage(id);
        renderTop();
      }
      audioReady();
      runAll();
      return;
    }
    if (S.running && (b.dataset.tplfill || ['tplScan', 'tplFillNow'].includes(b.id))) {
      setStatus('Đang “Chạy cả TB” – bấm “■ Dừng” trước.', true);
      return;
    }
    if (S.running && (b.dataset.fill || ['prev', 'next', 'scan', 'dataBtn', 'resetDone', 'dcApply', 'gtAdd', 'nextTodo', 'goNext', 'scanPick', 'scanDirPick', 'scanClear'].includes(b.id) || b.dataset.scanrm)) {
      setStatus('Đang “Chạy cả TB” – bấm “■ Dừng” trước.', true);
      return;
    }
    if (S.busy && (b.dataset.fill || b.id === 'scan')) {
      setStatus('Đang điền – chờ xong đã.', true);
      return;
    }
    if (!isAlive() && b.id !== 'min' && b.id !== 'close' && b.id !== 'dock') {
      setResult(`<div class="bad">✗ ${esc(DEAD_MSG)}</div>`);
      return;
    }
    if (
      ['tplScan', 'tplAll', 'tplNone', 'tplSave', 'tplFillNow', 'tplCancel', 'cfgExp', 'cfgImpBtn', 'cfgAdd', 'cfgAll', 'cfgCancel'].includes(b.id) ||
      b.dataset.tplfill ||
      b.dataset.tpledit ||
      b.dataset.tpldel ||
      b.dataset.tplRm != null ||
      b.dataset.tplbRm != null
    ) {
      if (S.busy) return setStatus('Đang bận – chờ xong đã.', true);
      if (!b.dataset.tpldel) tplFlush();
      const d = S.tplDraft;
      const showFill = (f, name) => {
        const okN = f.results.filter((x) => x.ok).length;
        const cl = f.clicks || [];
        const lines = [];
        tplLogInto(lines, f);
        const nB = cl.filter((x) => !x.skip && !x.q);
        setResult(
          `<div class="sum">Điền theo mẫu – ${esc(name)}: ${okN}/${f.results.length} ô${nB.length ? ` · bấm ${nB.filter((x) => x.ok).length}/${nB.length} nút` : ''}</div>` +
            lines.map((l) => `<div class="ln ${l.cls}">${l.icon} ${l.html}</div>`).join('') +
            (cl.length ? '' : '<div class="hint">Mẫu không có nút đã tích – tiện ích chỉ điền; bạn kiểm tra rồi tự bấm.</div>')
        );
      };
      S.busy = true;
      try {
        if (b.id === 'cfgExp') {
          const r = tplExport();
          setResult(
            `<div class="ok">✓ Đã lưu “${esc(r.name)}” vào thư mục Tải xuống: ${r.n} mẫu${
              (r.dropped ? ` (${r.dropped} giá trị mẫu / nút có thể là dữ liệu cá nhân / tên tài khoản không đưa vào file)` : '') +
                (r.droppedTpl ? ` (${r.droppedTpl} mẫu hộp hỏi / cửa sổ có tên người, tên tài khoản hoặc dãy số dài – không đưa vào file, nơi khác dạy lại)` : '')
            }. Gửi file này cho nơi khác – nơi đó bấm “Nạp cấu hình”.</div>`
          );
        } else if (b.id === 'cfgImpBtn') {
          const f = $('#cfgFile');
          if (f) f.click();
        } else if (b.id === 'cfgAdd' || b.id === 'cfgAll') await tplImportApply(b.id === 'cfgAll');
        else if (b.id === 'cfgCancel') {
          S.cfgImp = null;
          setResult('<div class="muted">Đã hủy nạp cấu hình – mẫu trên máy này giữ nguyên.</div>');
        } else if (b.dataset.tplRm != null || b.dataset.tplbRm != null) {
          // ✕: bỏ dòng / nút “không thấy lần lấy này” khỏi mẫu
          if (d && !tplDead()) {
            if (b.dataset.tplRm != null) d.items.splice(+b.dataset.tplRm, 1);
            else (d.btns || []).splice(+b.dataset.tplbRm, 1);
            await tplSaveDraft();
          }
        } else if (b.id === 'tplScan') {
          setResult('<div class="muted">Đang lấy các trường…</div>');
          await tplScan();
          const dd = S.tplDraft;
          const nV = dd.items.filter((x) => x.vang).length + (dd.btns || []).filter((x) => x.vang).length;
          setResult(
            `<div class="ok">✓ Lấy được ${dd.items.filter((x) => !x.vang).length} trường và ${(dd.btns || []).filter((x) => !x.vang).length} nút của ${esc(dd.name)} – tích / sửa là tự lưu.${
              dd.merged ? ` Đã giữ tích của mẫu cũ${nV ? `; ${nV} dòng lần này không thấy vẫn giữ (✕ để bỏ)` : ''}.` : ''
            }</div><div class="hint">${esc(tplUse(dd))}</div>`
          );
        } else if (b.id === 'tplAll' || b.id === 'tplNone') {
          if (d && !tplDead()) {
            const skipped = [];
            if (b.id === 'tplAll') {
              // tích ô lấy từ dữ liệu TB và ô bạn đã đặt giá trị mẫu; ô giá trị mẫu khác (giá trị đọc lúc lấy trường) – bạn tích tay
              d.items.forEach((x) => {
                if (x.ban || x.vang) return;
                if ((x.key && x.src === 'tb') || x.uv) x.on = true;
                else if (!x.on) skipped.push(tplLabel(x) + (x.locked ? ' (ô khóa)' : ''));
              });
            } else {
              d.items.forEach((x) => (x.on = false));
              (d.btns || []).forEach((x) => ((x.on = false), (x.ord = '')));
            }
            await tplSaveDraft(); // lưu luôn
            if (skipped.length)
              setResult(
                `<div class="hint">Không tự tích ${skipped.length} ô giá trị mẫu – giá trị đọc lúc lấy trường sẽ điền y hệt cho mọi hồ sơ, cần thì tích tay: ${esc(
                  skipped.slice(0, 20).join(', ')
                )}${skipped.length > 20 ? '…' : ''}</div>`
              );
          }
        } else if (b.id === 'tplSave' && d) {
          if (!tplDead()) {
            if (!(await tplSaveDraft())) setResult('<div class="bad">✗ Chưa lưu được mẫu – thử lại.</div>');
            else {
              setResult(
                `<div class="ok">✓ Đã lưu mẫu ${esc(qn(d.name))}: ${d.items.filter((x) => x.on && !x.ban).length} ô được tích${
                  (d.btns || []).some((x) => x.on) ? `, ${(d.btns || []).filter((x) => x.on).length} nút` : ''
                }.</div><div class="hint">${esc(tplUse(d))}</div>`
              );
              S.tplDraft = null;
            }
          }
        } else if (b.id === 'tplFillNow' && d) {
          const t = tplRec(d);
          const rid = await tplRunId(t);
          tplMarkRan(t, rid); // ghi TRƯỚC khi điền: nút theo mẫu có thể tải lại trang (trang mới không tự chạy lại mẫu)
          showFill(await tplFill(t, tplIdxOf(d.key) - 1), d.name);
          tplMarkRan(t, rid);
        } else if (b.id === 'tplCancel') S.tplDraft = null;
        else if (b.dataset.tplfill) {
          const t = S.tpl[b.dataset.tplfill];
          if (t) {
            // chủ / thửa / giấy tờ: số thứ tự ở ô bên cạnh nút Điền (mặc định 1, nhớ theo mẫu)
            const i = tplIdxOf(t.key) - 1;
            const rid = await tplRunId(t);
            tplMarkRan(t, rid); // ghi TRƯỚC khi điền (nút theo mẫu có thể tải lại trang)
            showFill(await tplFill(t, i), ['chu', 'thua', 'giayTo'].includes(t.base) ? `${t.name} – số ${i + 1}` : t.name);
            tplMarkRan(t, rid);
          }
        } else if (b.dataset.tpledit) {
          const t = S.tpl[b.dataset.tpledit];
          if (t)
            S.tplDraft = {
              key: t.key,
              name: t.name,
              secKey: t.base || '',
              scope: t.scope,
              titleKey: t.titleKey,
              dlg: !!t.dlg,
              items: t.items.map((x) => ({ ...x })),
              btns: (t.btns || []).map((x) => ({ ...x })),
              cut: 0,
            };
        } else if (b.dataset.tpldel) {
          const t = S.tpl[b.dataset.tpldel];
          if (t && confirm(`Xóa mẫu ${qn(t.name)}? (tiện ích sẽ điền cửa sổ đó như cũ)`)) {
            // đang mở bảng tích của chính mẫu này → đóng luôn (không để lần tích sau lưu lại mẫu vừa xóa)
            if (S.tplDraft && S.tplDraft.key === t.key) {
              clearTimeout(S.tplSaveT);
              S.tplSaveT = null;
              S.tplDraft = null;
            }
            const n = { ...S.tpl };
            delete n[t.key];
            S.tpl = n;
            safeSet({ tbTpl: S.tpl });
            // ghi lúc xóa: nạp lại file sao lưu cũ không làm mẫu này sống lại
            try {
              const del = (await store.get('tbTplDel')).tbTplDel || {};
              del[t.key] = Date.now();
              await store.set({ tbTplDel: del });
            } catch (e) {}
          }
        }
      } catch (err) {
        setResult(`<div class="bad">✗ ${esc(friendly(err))}</div>`);
      } finally {
        S.busy = false;
      }
      render();
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
      // (25/11) TB ở trên đang chạy theo 🤖 mà con trỏ tiếp nhận còn “Chưa làm” → chính TB đó là TB chưa làm tiếp theo
      const rP = recvTB();
      const nx = rP && String(rP.tb) !== String(S.cur) && stageOf(rP) === 'chua' && !(S.stage[String(rP.tb)] || {}).tnClick ? rP : nextTodo();
      if (nx) {
        selectTb(nx.tb);
        setStatus(`Đã chọn TB ${nx.tb} – TB chưa làm tiếp theo.`);
      } else setStatus(S.data.length ? 'Mọi TB đã tiếp nhận ✓ – xem “☰ Tiến độ” để biết TB nào chưa nhập đơn.' : 'Chưa có dữ liệu TB.');
    } else if (b.id === 'goNext') {
      selectTb(b.dataset.tb);
    } else if (b.id === 'progList') openProgress();
    else if (b.id === 'scanPick') {
      const inp = $('#scanFile');
      if (inp) inp.click(); // hộp chọn file của trình duyệt (chọn được nhiều file DDK, TBXN một lúc)
    } else if (b.id === 'scanDirPick') {
      const inp = $('#scanDir');
      if (inp) inp.click();
    } else if (b.id === 'scanQBtn') {
      // xem hàng chờ file quét: sang tab Giấy tờ
      S.tab = 'gt';
      saveUi();
      render();
      renderScanQ();
    } else if (b.id === 'scanClear') {
      if (!S.scanQ.length) return setStatus('Hàng chờ file quét đang trống.');
      if (!confirm(`Xóa ${S.scanQ.length} file khỏi hàng chờ? (file gốc trên máy của bạn vẫn còn)`)) return;
      await clearScanQ();
      setStatus('Đã xóa hàng chờ file quét.');
    } else if (b.dataset.scanrm) {
      const x = S.scanQ.find((y) => y.id === b.dataset.scanrm);
      await unqueueScan([b.dataset.scanrm]);
      if (x) setStatus(`Đã bỏ ${x.name} khỏi hàng chờ.`);
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
      panelMin(!pn.classList.contains('min'));
    } else if (b.id === 'dock') {
      dockSet(!DOCK.on);
    } else if (b.id === 'close') {
      // (24/11) 🤖 đang bật: × chỉ THU NHỎ bảng – 🤖 vẫn chạy liên tục (bạn: “không được có thời gian chờ chết”); muốn dừng: tắt 🤖 / ■ Dừng rồi ×
      if (AUTO() && isAlive()) {
        panelMin(true);
        setStatus('🤖 đang bật – bảng chỉ thu nhỏ, 🤖 vẫn làm tiếp. Muốn dừng hẳn: tắt 🤖 rồi bấm × để ẩn bảng.');
        return;
      }
      if (S.running) S.stopReq = true; // ẩn bảng khi đang chạy → dừng luôn
      host.style.display = 'none';
      noteShown(false); // trang tải lại cũng không tự mở lại bảng
    }
  });

  // thu nhỏ / mở lại bảng (nút –, × khi 🤖 đang bật, biểu tượng tiện ích khi 🤖 đang bật)
  function panelMin(on) {
    pn.classList.toggle('min', !!on);
    const mb = $('#min');
    if (mb) mb.textContent = pn.classList.contains('min') ? '+' : '–';
    dockApply(true); // đang gắn phải: thu nhỏ → trang về như cũ, mở lại → trang dồn sang trái
  }
  host.addEventListener('vbdlis-min', () => panelMin(!pn.classList.contains('min')));
  // kéo bảng bằng thanh tiêu đề
  $('.hd').addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || DOCK.on) return; // đang gắn cạnh phải: không kéo (bấm 📌 để thả nổi)
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
  // tbBox: bảng nổi { left, top, w, h }, nhật ký { rh }, gắn cạnh phải { dock, dw }
  let BOX = {};
  function applyBox(b) {
    if (!b) return;
    BOX = { ...b };
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
    if (b.dock) dockSet(true, true);
  }
  function saveBox() {
    const b = { ...BOX };
    const rh = parseInt(pn.style.getPropertyValue('--rh'), 10);
    if (rh) b.rh = rh;
    else delete b.rh;
    if (DOCK.on) {
      // đang gắn phải: chỉ nhớ bề rộng khi gắn; chỗ và cỡ của bảng nổi giữ như lần trước
      b.dock = true;
      b.dw = DOCK.w;
    } else {
      const r = host.getBoundingClientRect();
      b.left = Math.round(r.left);
      b.top = Math.round(r.top);
      const w = parseInt(pn.style.getPropertyValue('--w'), 10);
      const h = parseInt(pn.style.getPropertyValue('--h'), 10);
      if (w) b.w = w;
      else delete b.w;
      if (h) b.h = h;
      else delete b.h;
      delete b.dock;
    }
    BOX = b;
    safeSet({ tbBox: b });
  }

  // ---------- 📌 gắn bảng sát cạnh phải (bạn yêu cầu 23/11: “dính thẳng bên cạnh phải”) ----------
  // Bảng cao hết màn hình, sát mép phải (bên trái thanh cuộn của trang); trang VBDLIS dồn sang trái nhường chỗ: phần trang và
  // thanh ngang cố định của trang hẹp lại, cửa sổ / hộp hỏi / thông báo của trang canh giữa phần còn lại. Thu nhỏ (–) hoặc ẩn (×)
  // bảng → trang về như cũ. Bấm 📌 lần nữa → bảng nổi như trước. Nhớ lựa chọn và bề rộng (tbBox.dock, tbBox.dw).
  // Chỉ đổi cách hiện bảng – không đụng việc điền / bấm của tiện ích.
  const DOCK = { on: false, w: 420, timer: null };
  const DOCK_CSS_ID = 'vbdlis-dien-nhanh-dock';
  const DOCK_ATTR = 'data-vbdlis-dock'; // thanh cố định của trang đã dời sang trái (giữ giá trị cũ để trả lại khi thôi gắn)
  const DOCK_OVERLAY = ['.modal', '.modal-backdrop', '.jconfirm', '.swal2-container', '.ui-widget-overlay', '.k-overlay', '.layui-layer-shade', '.bootbox'];
  const DOCK_TOAST = ['#toast-container', '.notifyjs-corner', '.jq-toast-wrap', '.ui-pnotify'];
  const dockCss = (w) =>
    `html.vbdlis-docked{margin-right:${w}px !important}` +
    DOCK_OVERLAY.map((x) => 'html.vbdlis-docked ' + x).join(',') +
    `{right:${w}px !important;max-width:calc(100% - ${w}px) !important}` +
    // cửa sổ rộng hơn phần trang còn lại (màn hình nhỏ) → kéo ngang trong cửa sổ để thấy hết, không bị bảng che
    'html.vbdlis-docked .modal{overflow-x:auto !important}' +
    DOCK_TOAST.map((x) => 'html.vbdlis-docked ' + x).join(',') +
    `{margin-right:${w}px !important}`;
  // thanh ngang cố định của trang chạm mép phải (vd. thanh trên cùng) → thu lại bên trái bảng. scan: tìm thêm thanh mới
  function dockFix(w, scan) {
    for (const el of document.querySelectorAll('[' + DOCK_ATTR + ']')) {
      el.style.setProperty('right', w + 'px', 'important');
      el.style.setProperty('max-width', `calc(100% - ${w}px)`, 'important');
    }
    if (!scan || !document.body) return;
    const vw = document.documentElement.clientWidth;
    const skip = [...DOCK_OVERLAY, ...DOCK_TOAST, '#' + HOST_ID, '#vbdlis-rec-host'].join(', ');
    for (const el of document.body.querySelectorAll('*')) {
      if (el.offsetParent !== null || el.hasAttribute(DOCK_ATTR) || el.matches(skip)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      // chỉ thanh ngang rộng chạm mép phải; không lấy lớp phủ cả màn hình, không lấy khung trượt hẹp (vd. bảng thông báo bên phải)
      if (r.width < vw * 0.4 || r.right < vw - 2 || r.height > innerHeight * 0.8) continue;
      const st = el.style;
      el.setAttribute(DOCK_ATTR, JSON.stringify([st.getPropertyValue('right'), st.getPropertyPriority('right'), st.getPropertyValue('max-width'), st.getPropertyPriority('max-width')]));
      st.setProperty('right', w + 'px', 'important');
      st.setProperty('max-width', `calc(100% - ${w}px)`, 'important');
    }
  }
  function dockUnfix() {
    for (const el of document.querySelectorAll('[' + DOCK_ATTR + ']')) {
      let v = [];
      try {
        v = JSON.parse(el.getAttribute(DOCK_ATTR)) || [];
      } catch (e) {}
      el.removeAttribute(DOCK_ATTR);
      if (v[0]) el.style.setProperty('right', v[0], v[1] || '');
      else el.style.removeProperty('right');
      if (v[2]) el.style.setProperty('max-width', v[2], v[3] || '');
      else el.style.removeProperty('max-width');
    }
  }
  // đặt bảng + dồn trang theo trạng thái hiện tại (gắn / nổi, hiện / ẩn / thu nhỏ, có thanh cuộn hay không)
  function dockApply(scan) {
    if (!host.isConnected) return;
    const full = DOCK.on && host.style.display !== 'none' && !pn.classList.contains('min');
    if (DOCK.on) {
      DOCK.w = Math.round(Math.max(300, Math.min(DOCK.w, innerWidth * 0.7)));
      pn.style.setProperty('--dw', DOCK.w + 'px');
      // right:0 của khung cố định = sát bên trái thanh cuộn của trang (thanh cuộn vẫn kéo được)
      const set = (k, v) => {
        if (host.style[k] !== v) host.style[k] = v;
      };
      set('left', 'auto');
      set('right', full ? '0px' : '16px');
      set('top', full ? '0px' : '72px');
    }
    let st = document.getElementById(DOCK_CSS_ID);
    if (full) {
      if (!st) {
        st = document.createElement('style');
        st.id = DOCK_CSS_ID;
        (document.head || document.documentElement).appendChild(st);
      }
      const css = dockCss(DOCK.w);
      if (st.textContent !== css) st.textContent = css;
      document.documentElement.classList.add('vbdlis-docked');
      dockFix(DOCK.w, scan);
    } else {
      document.documentElement.classList.remove('vbdlis-docked');
      if (st) st.remove();
      dockUnfix();
    }
  }
  function dockSet(on, initial) {
    DOCK.on = !!on;
    pn.classList.toggle('dock', DOCK.on);
    const btn = $('#dock');
    if (btn) {
      btn.classList.toggle('on', DOCK.on);
      btn.title = DOCK.on
        ? 'Đang gắn sát cạnh phải – bấm để thả bảng nổi như trước'
        : 'Gắn bảng sát cạnh phải, cao hết màn hình (trang VBDLIS dồn sang trái nhường chỗ)';
    }
    clearInterval(DOCK.timer);
    DOCK.timer = null;
    if (DOCK.on) {
      DOCK.w = BOX.dw || parseInt(pn.style.getPropertyValue('--w'), 10) || 420;
      let n = 0;
      DOCK.timer = setInterval(() => {
        if (!host.isConnected) return clearInterval(DOCK.timer); // bảng đã được thay bằng bảng mới – không đụng trang nữa
        dockApply(++n % 3 === 0); // 2 giây: giữ trang dồn trái (trang tự vẽ lại); 6 giây: tìm thêm thanh cố định mới của trang
      }, 2000);
    } else if (!initial) {
      // thả nổi: về chỗ bạn kéo bảng lần trước, không có thì chỗ mặc định
      if (BOX.left != null && BOX.top != null) {
        host.style.left = Math.max(0, Math.min(innerWidth - 120, BOX.left)) + 'px';
        host.style.top = Math.max(0, Math.min(innerHeight - 40, BOX.top)) + 'px';
        host.style.right = 'auto';
      } else {
        host.style.left = 'auto';
        host.style.top = '72px';
        host.style.right = '16px';
      }
    }
    dockApply(true);
    if (!initial) saveBox();
  }
  // bảng bị ẩn / hiện lại (×, Alt+Q, bấm biểu tượng) → trang dồn / trả lại theo
  {
    let pend = false;
    new MutationObserver(() => {
      if (pend || !DOCK.on) return;
      pend = true;
      setTimeout(() => {
        pend = false;
        dockApply(false);
      }, 50);
    }).observe(host, { attributes: true, attributeFilter: ['style'] });
  }
  addEventListener('resize', () => DOCK.on && dockApply(true));
  // kéo mép trái để đổi bề rộng bảng khi đang gắn phải (bấm đúp: về 420)
  {
    const dz = $('.dz');
    dz.addEventListener('mousedown', (e) => {
      if (!DOCK.on) return;
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX;
      const w0 = DOCK.w;
      let raf = 0;
      dz.classList.add('drag');
      const mv = (ev) => {
        DOCK.w = Math.round(Math.max(300, Math.min(innerWidth * 0.7, w0 - (ev.clientX - x0))));
        if (!raf)
          raf = requestAnimationFrame(() => {
            raf = 0;
            dockApply(false);
          });
      };
      const up = () => {
        dz.classList.remove('drag');
        removeEventListener('mousemove', mv, true);
        removeEventListener('mouseup', up, true);
        dockApply(true);
        saveBox();
      };
      addEventListener('mousemove', mv, true);
      addEventListener('mouseup', up, true);
    });
    dz.addEventListener('dblclick', () => {
      DOCK.w = 420;
      dockApply(true);
      saveBox();
    });
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
    // thư mục (vd. cả “18 TH”): lấy các mục NGAY (trước lần chờ đầu tiên), rồi đi hết thư mục con
    const entries = [...(e.dataTransfer.items || [])].map((i) => (i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    const hasDir = entries.some((x) => x && x.isDirectory);
    let all = [...(e.dataTransfer.files || [])];
    try {
      if (hasDir) {
        setStatus('Đang đọc thư mục…');
        all = await filesFromEntries(entries.filter(Boolean));
        setStatus('');
      }
      const scans = all.filter(isScanFile);
      // file PDF / ảnh scan → vào hàng chờ file quét; file .json → nạp dữ liệu TB như trước
      if (scans.length) return await queueScanFiles(scans);
      if (hasDir && !all.some((f) => /\.json$/i.test(f.name)))
        return setResult('<div class="bad">✗ Thư mục không có file quét nào (PDF tên “KH 2959.07777…DDK / TBXN”).</div>');
      const r = await importFiles(all);
      setResult(`<div class="${r.bad ? 'bad' : 'ok'}">${r.bad ? '✗' : '✓'} ${esc(r.text)}</div>`);
    } catch (err) {
      setResult(`<div class="bad">✗ ${esc(friendly(err))}</div>`);
    }
  });

  // ---------- đính kèm file quét: hàng chờ + tự làm tác vụ “Lưu kho hồ sơ quét” ----------
  // Bạn thả SẴN file quét (DDK + TBXN của nhiều hồ sơ) vào bảng điền → vào HÀNG CHỜ. Ở cửa sổ Quy trình xử lý của một hồ sơ,
  // bấm “▶ Chạy cả TB”: tiện ích làm như bản ghi thao tác của bạn – mở Lưu kho hồ sơ quét, bấm +, Thêm tập tin “Đơn đăng ký” /
  // “Thông báo xác nhận kết quả đăng ký” (tự bấm Lưu nhỏ), tự “Tải lên” đúng file (tên có DDK / TBXN). File đính kèm xong tự xóa
  // khỏi hàng chờ. KHÔNG bấm “Cập nhật” – tô vàng, đặt con trỏ cho bạn nhấn Enter.
  const isScanFile = (f) => /\.(pdf|jpe?g|png|tiff?)$/i.test(f.name) || /^(application\/pdf|image\/)/.test(f.type || '');
  const shownEl = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const SCAN_KIND = { don: 'Đơn đăng ký', tbxn: 'Thông báo xác nhận kết quả đăng ký' };
  const scanKindOf = (s) => {
    const n = ' ' + norm(s).replace(/[^a-z0-9]+/g, ' ') + ' ';
    if (/ ddk | don dang ky /.test(n)) return 'don';
    if (/ tbxn | thong bao xac nhan /.test(n)) return 'tbxn';
    return '';
  };
  // các cặp “tờ.thửa” trong số biên nhận / tên file: “KH 2959.07777.254.10-254.11…” → ["254|10", "254|11"]
  const khPairs = (s) => {
    const m = /kh\s*2959\.07777\.([\d.\-]+)/i.exec(String(s || ''));
    if (!m) return null;
    return m[1]
      .replace(/[.\-]+$/, '')
      .split('-')
      .map((p) => p.split('.').filter(Boolean))
      .filter((p) => p.length === 2)
      .map(([to, th]) => idNorm(to) + '|' + idNorm(th));
  };
  // số biên nhận của hồ sơ đang mở (ngoài cửa sổ con, ngoài thông báo, ngoài bảng điền):
  // 1) ô “Số biên nhận” của khung Thông tin hồ sơ (nhãn → giá trị ngay sau); 2) không có thì mọi chữ “KH 2959.07777…” đang hiện,
  //    trừ link “Lấy lại thông tin biên nhận: …” (số của biên nhận lần trước)
  function openDossierNumbers() {
    const SKIP = '.modal, [role="dialog"], .toast, #toast-container, .notifyjs-corner, .notifyjs-container, .jconfirm, #' + HOST_ID;
    const KH = /KH\s*2959\.07777\.[\d.\-]+/i;
    const clean = (s) => s.replace(/\s+/g, ' ').replace(/[.\-]+$/, '').toUpperCase();
    const ok = (el) => !!el && !el.closest(SKIP) && shownEl(el);
    const vals = new Set();
    for (const lab of document.querySelectorAll('label, span, div, td, th, b, strong, p, dt')) {
      if (lab.children.length > 1 || !/^so bien nhan$/.test(norm(lab.textContent).replace(/[:\s]+$/, '')) || !ok(lab)) continue;
      // chữ của một khối, bỏ link “Lấy lại thông tin biên nhận: …”
      const textOfBox = (el) => {
        const c = el.cloneNode(true);
        c.querySelectorAll('#btnBindInfoLastBienNhan, a, button').forEach((x) => /lay lai thong tin bien nhan/.test(norm(x.textContent)) && x.remove());
        return c.textContent || '';
      };
      let hit = null;
      for (let sib = lab.nextElementSibling, k = 0; sib && k < 3 && !hit; sib = sib.nextElementSibling, k++) hit = KH.exec(textOfBox(sib));
      if (!hit && lab.parentElement) hit = KH.exec(textOfBox(lab.parentElement));
      if (hit) vals.add(clean(hit[0]));
    }
    if (vals.size) return [...vals];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const v = n.nodeValue;
      if (!v || !/2959\.07777/.test(v)) continue;
      const el = n.parentElement;
      if (!ok(el) || /lay lai thong tin bien nhan/.test(norm(el.textContent)) || el.closest('#btnBindInfoLastBienNhan')) continue;
      const re = /KH\s*2959\.07777\.[\d.\-]+/gi;
      for (let m = re.exec(v); m; m = re.exec(v)) vals.add(clean(m[0]));
    }
    return [...vals];
  }
  // cửa sổ “Hồ sơ quét”: bảng “Danh sách tập tin” đang hiện (kể cả khi chưa có dòng nào)
  function hsqTable() {
    return (
      [...document.querySelectorAll('#tbDanhSachFile, table')].find(
        (t) => shownEl(t) && !t.closest('#' + HOST_ID) && (t.id === 'tbDanhSachFile' || t.querySelector('tbody tr input[type="file"]'))
      ) || null
    );
  }
  // các dòng của bảng “Danh sách tập tin” (null: cửa sổ “Hồ sơ quét” không mở)
  function scanRows() {
    const t = hsqTable();
    if (!t) return null;
    return [...t.querySelectorAll('tbody tr')]
      .map((tr) => {
        const input = tr.querySelector('input[type="file"]');
        if (!input) return null;
        const cells = [...tr.children].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim());
        const kind = scanKindOf(cells[2] || '') || scanKindOf(cells[0] || '');
        const btn = (re) => [...tr.querySelectorAll('a, button')].find((b) => re.test(b.id || '') || re.test(norm(b.textContent)));
        return {
          tr,
          input,
          id: input.getAttribute('data-id') || tr.getAttribute('data-id') || '',
          kind,
          label: cells[0] || cells[2] || '',
          upBtn: btn(/^btnUploadFile$|^tai len$/),
          uploaded: () => shownEl(btn(/^btnReviewFile|^xem tap tin$/)) || shownEl(btn(/^btnDeleteFile|^xoa tap tin$/)),
        };
      })
      .filter(Boolean);
  }
  let capRingTimer = 0;
  const ringScan = (el, on) => {
    if (el) el.style.boxShadow = on ? '0 0 0 4px #f59e0b' : '';
  };
  // tô vàng một nút trong ms rồi bỏ – hủy hẹn giờ cũ của cùng nút
  const ringFor = (el, ms) => {
    if (!el) return;
    ringScan(el, true);
    clearTimeout(el.__vbdlisRingOff);
    el.__vbdlisRingOff = setTimeout(() => ringScan(el, false), ms);
  };
  // chờ tới khi cond() đúng (xem lại mỗi 250 ms); hết giờ → false; alive() ném lỗi khi bạn bấm Dừng
  const waitUntil = async (cond, ms, alive) => {
    const t0 = Date.now();
    for (;;) {
      if (!alive()) return false;
      try {
        if (cond()) return true;
      } catch (e) {}
      if (Date.now() - t0 >= ms * slowK()) return false;
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  // bấm một nút / link của trang; nút là <a href=""> mà trang quên chặn thì không cho trang tải lại (chỉ cho đúng cú bấm này)
  const clickPage = (el) => {
    if (!(el instanceof HTMLAnchorElement)) return el.click();
    const noNav = (e) => {
      if (e.target === el || el.contains(e.target)) e.preventDefault();
    };
    window.addEventListener('click', noNav);
    try {
      el.click();
    } finally {
      window.removeEventListener('click', noNav);
    }
  };
  const visIn = (sel, scope = document) => [...scope.querySelectorAll(sel)].find((el) => shownEl(el) && !el.closest('#' + HOST_ID)) || null;
  const uniq = (a) => [...new Set(a || [])];
  const sameSet = (a, b) => {
    const x = uniq(a);
    const y = uniq(b);
    return x.length === y.length && x.every((v) => y.includes(v));
  };
  // bộ thửa (“tờ|thửa”) của một TB: theo số biên nhận (giống tên file quét), không có thì theo danh sách thửa
  const tbPairs = (x) => {
    const k = uniq(khPairs(x && x.soBienNhan) || []);
    return k.length ? k : uniq(((x && x.thua) || []).filter((t) => t && t.soTo && t.soThua).map(thuaKey));
  };

  // ----- HÀNG CHỜ file quét: lưu tạm trong bộ nhớ tiện ích trên máy này (còn sau khi F5), đính kèm xong file nào xóa file đó -----
  // scanQ: [{ id, name, size, type, kind: 'don' | 'tbxn', pairs: ['tờ|thửa', …], at }]; nội dung từng file: khóa 'scanF:<id>' = { t: kiểu, b: base64 }
  const SCANF = 'scanF:';
  S.scanQ = [];
  let scanQChain = Promise.resolve();
  async function loadScanQ() {
    try {
      const q = (await store.get('scanQ')).scanQ;
      S.scanQ = Array.isArray(q) ? q.filter((x) => x && x.id && Array.isArray(x.pairs)) : [];
    } catch (e) {}
    return S.scanQ;
  }
  // đổi hàng chờ: đọc bản mới nhất (tab VBDLIS khác có thể vừa đổi), sửa, ghi lại – các lần đổi nối đuôi nhau
  function editScanQ(fn) {
    const job = async () => {
      const cur = ((await store.get('scanQ')).scanQ || []).filter((x) => x && x.id && Array.isArray(x.pairs));
      const next = await fn(cur);
      if (next) {
        await store.set({ scanQ: next });
        S.scanQ = next;
      }
      renderScanQ();
    };
    // các tab VBDLIS dùng chung một khóa (cùng trang) → không ghi đè hàng chờ của nhau
    const p = scanQChain.then(() => (navigator.locks && navigator.locks.request ? navigator.locks.request('vbdlis-scanQ', job) : job()));
    scanQChain = p.catch(() => {});
    return p;
  }
  const readB64 = (file) =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result || '').replace(/^data:[^,]*,/, ''));
      r.onerror = () => no(r.error || new Error('không đọc được file'));
      r.readAsDataURL(file);
    });
  const newScanId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  // (25/11) tên rút gọn kiểu DOS của Windows (vd. “KH2959~1.PDF”) – trình duyệt đưa tên này khi đường dẫn đầy đủ dài quá 260 ký tự
  const SHORT83 = /^[^\s.~]{1,6}~\d{1,6}(\.[^.\s]{1,3})?$/i;
  const LONG_PATH = 'đường dẫn quá dài – Windows chỉ cho 260 ký tự (thư mục lồng nhiều tầng + tên file dài)';
  // file không mở được trên đĩa lúc đọc (NotFoundError: “A requested file or directory could not be found…”)
  const fileGone = (err) => !!err && (err.name === 'NotFoundError' || /could not be found|not found/i.test(String(err.message || '')));
  // thả / chọn file quét → vào hàng chờ (chưa đụng gì tới trang)
  async function queueScanFiles(files) {
    if (S.running) return setStatus('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi thêm file.', true);
    if (S.busy) return setStatus('Đang bận – chờ xong đã rồi thả file.', true);
    const bad = [];
    const good = [];
    // thư mục lớn (vd. “18 TH”) → các thư mục “TB 1846”… → file PDF. File nằm trong thư mục “TB <số>” thì đối chiếu với TB đó trong
    // dữ liệu: số biên nhận trong tên file phải KHỚP số biên nhận của TB (tên file không có số thì lấy số biên nhận của TB);
    // loại file theo tên: DDK → Đơn đăng ký, TBXN → Thông báo xác nhận. File không khớp → bỏ qua, liệt kê lý do.
    const byTbDir = new Map(); // TB → { don, tbxn } để báo thư mục TB nào còn thiếu file
    let longN = 0; // file vướng đường dẫn quá dài (tên rút gọn / không mở được)
    let longRel = ''; // đường dẫn trong thư mục bạn chọn của một file vướng (để báo độ dài)
    for (const f of files) {
      const path = String(f.__path || f.webkitRelativePath || '').replace(/\\/g, '/');
      const dirs = path.split('/').slice(0, -1);
      const dm = dirs.map((d) => /^\s*tb\s*0*(\d+)\b/i.exec(d)).filter(Boolean).pop();
      const dirTb = dm ? dm[1] : '';
      const tbx = dirTb ? S.data.find((x) => String(x.tb) === dirTb) : null;
      const where = dirTb ? `TB ${dirTb}/${f.name}` : f.name;
      const kind = scanKindOf(f.name);
      let pairs = uniq(khPairs(f.name) || []);
      if (!kind && SHORT83.test(f.name)) {
        // tên dài thật (KH 2959.07777…DDK.pdf) đã mất – không đoán DDK / TBXN (gắn nhầm còn tệ hơn)
        bad.push(`${where} – Windows chỉ đưa tên rút gọn “${f.name}” vì ${LONG_PATH}: không biết số biên nhận, DDK hay TBXN`);
        longN++; // (tên thật đã mất – không lấy làm ví dụ độ dài đường dẫn)
        continue;
      }
      if (!kind) {
        bad.push(`${where} – tên file không có chữ DDK hoặc TBXN (không biết là Đơn đăng ký hay Thông báo xác nhận)`);
        continue;
      }
      if (f.size > 80 * 1024 * 1024) {
        bad.push(`${where} – file quá lớn (${Math.round(f.size / 1048576)} MB)`);
        continue;
      }
      if (dirTb && !tbx) {
        if (!pairs.length) {
          bad.push(`${where} – thư mục TB ${dirTb} không có trong dữ liệu và tên file không có số biên nhận`);
          continue;
        }
      } else if (tbx) {
        const want = tbPairs(tbx);
        if (!pairs.length) {
          if (!want.length) {
            bad.push(`${where} – TB ${dirTb} chưa có số biên nhận trong dữ liệu, tên file cũng không có`);
            continue;
          }
          pairs = want; // tên file không có số → lấy số biên nhận của TB ở thư mục
        } else if (!pairs.every((p) => want.includes(p))) {
          bad.push(`${where} – số biên nhận trong tên file KHÔNG khớp số biên nhận của TB ${dirTb} (${tbx.soBienNhan || 'chưa có'}) – không lấy`);
          continue;
        }
      } else if (!pairs.length) {
        bad.push(`${f.name} – tên phải có số biên nhận (KH 2959.07777.tờ.thửa…) hoặc nằm trong thư mục “TB <số>”, vd. “TB 1846/KH 2959.07777.254.13.DDK.pdf”`);
        continue;
      }
      good.push({ f, kind, pairs, dirTb, path });
      if (dirTb) {
        const o = byTbDir.get(dirTb) || { don: 0, tbxn: 0 };
        o[kind]++;
        byTbDir.set(dirTb, o);
      }
    }
    let added = 0;
    let replaced = 0;
    let same = 0;
    S.busy = true;
    try {
      if (good.length) {
        setStatus(`Đang đưa ${good.length} file vào hàng chờ…`);
        // 1) lưu nội dung từng file (file đọc lỗi thì báo, file khác vẫn vào)
        const q0 = await loadScanQ();
        const stored = [];
        // một file trong hàng chờ = tên + bộ số biên nhận (vd. “DDK.pdf” của TB 1846 và của TB 1847 là 2 file khác nhau)
        const qKey = (name, pairs) => String(name || '').toLowerCase() + '|' + uniq(pairs || []).sort().join(',');
        for (const a of good) {
          if (q0.some((x) => qKey(x.name, x.pairs) === qKey(a.f.name, a.pairs) && x.size === a.f.size)) {
            same++;
            continue;
          }
          try {
            const id = newScanId();
            await store.set({ [SCANF + id]: { t: a.f.type || 'application/pdf', b: await readB64(a.f) } });
            stored.push({ a, id });
          } catch (err) {
            if (fileGone(err)) {
              bad.push(`${a.dirTb ? `TB ${a.dirTb}/` : ''}${a.f.name} – trình duyệt không mở được file: ${LONG_PATH}, hoặc file vừa bị chuyển / xóa / còn nằm trong file ZIP`);
              longN++;
              if (String(a.path || a.f.name).length > longRel.length) longRel = String(a.path || a.f.name); // ví dụ: đường dẫn dài nhất
            } else bad.push(`${a.f.name} – không đọc / lưu được (${friendly(err)})`);
            // file không vào hàng chờ → không tính thư mục TB đó là có file này
            const o = a.dirTb ? byTbDir.get(a.dirTb) : null;
            if (o) {
              o[a.kind]--;
              if (o.don <= 0 && o.tbxn <= 0) byTbDir.delete(a.dirTb);
            }
          }
        }
        // 2) ghi vào hàng chờ một lần; bản cũ cùng tên (quét lại) bị thay, xóa nội dung cũ sau khi ghi xong
        const dropIds = [];
        if (stored.length)
          await editScanQ(async (q) => {
            for (const { a, id } of stored) {
              const nm = qKey(a.f.name, a.pairs);
              if (q.some((x) => qKey(x.name, x.pairs) === nm && x.size === a.f.size)) {
                dropIds.push(id); // tab khác vừa thêm đúng file này
                same++;
                continue;
              }
              const old = q.filter((x) => qKey(x.name, x.pairs) === nm);
              if (old.length) {
                dropIds.push(...old.map((x) => x.id));
                q = q.filter((x) => !old.includes(x));
                replaced++;
              }
              q.push({ id, name: a.f.name, size: a.f.size, type: a.f.type || 'application/pdf', kind: a.kind, pairs: a.pairs, at: Date.now() });
              added++;
            }
            return q;
          });
        if (dropIds.length) await store.remove(dropIds.map((id) => SCANF + id));
      }
    } catch (e) {
      bad.push('không lưu được vào hàng chờ: ' + friendly(e));
    } finally {
      S.busy = false;
    }
    setStatus('');
    // thư mục TB thiếu một loại / có 2 file cùng loại khác nhau → nhắc (file vẫn vào hàng chờ)
    const dirNotes = [...byTbDir.entries()]
      .filter(([, o]) => !o.don || !o.tbxn)
      .map(([t, o]) => `TB ${t}: thiếu file ${!o.don ? 'DDK' : 'TBXN'}`);
    const longHint = longN
      ? `<div class="hint">⚠ <b>${longN} file vướng đường dẫn quá dài</b> (Windows chỉ cho 260 ký tự gồm cả thư mục lẫn tên file; tên file nhiều thửa đã dài ~100 ký tự). ` +
        `Cách sửa: đưa thư mục chứa các thư mục “TB …” ra sát ổ đĩa cho đường dẫn ngắn lại – vd. kéo thư mục đó ra thẳng <b>Downloads</b> rồi đổi tên ngắn (<b>HSQ</b>); ` +
        `giải nén file ZIP thì đừng để thư mục lồng trong thư mục cùng tên nhiều tầng. Xong bấm <b>Chọn thư mục…</b> lại (file đã vào hàng chờ không bị thêm trùng).` +
        (longRel ? ` <span class="muted">Đường dẫn trong thư mục bạn chọn: “${esc(longRel)}” (${longRel.length} ký tự) – cộng thêm phần đường dẫn phía trước thư mục đó.</span>` : '') +
        '</div>'
      : '';
    setResult(
      '<div class="sum">Hàng chờ file quét</div>' +
        (added ? `<div class="ln ok">✓ Đã thêm ${added} file${replaced ? ` (thay ${replaced} file cùng tên)` : ''}</div>` : '') +
        (same ? `<div class="ln muted">• ${same} file đã có sẵn trong hàng chờ – bỏ qua</div>` : '') +
        (byTbDir.size ? `<div class="ln ok">✓ ${byTbDir.size} thư mục TB khớp số biên nhận: ${esc([...byTbDir.keys()].join(', '))}</div>` : '') +
        dirNotes.map((b) => `<div class="ln warn">⚠ ${esc(b)}</div>`).join('') +
        (bad.length ? `<div class="ln bad">✗ Bỏ qua ${bad.length} file:</div>` : '') +
        bad.map((b) => `<div class="ln bad">&nbsp;&nbsp;• ${esc(b)}</div>`).join('') +
        longHint +
        `<div class="ln muted">• Hàng chờ có ${S.scanQ.length} file (${scanGroups().length} hồ sơ) – xem ở tab <b>Giấy tờ</b></div>` +
        '<div class="hint">Mở <b>Quy trình xử lý</b> của hồ sơ (Xử lý hồ sơ) rồi bấm <b>▶ Chạy cả TB</b>: tiện ích tự mở Lưu kho hồ sơ quét, bấm +, thêm 2 dòng, tải đúng file lên. Bạn chỉ bấm <b>Cập nhật</b>. File đính kèm xong tự mất khỏi hàng chờ.</div>'
    );
  }
  async function unqueueScan(ids) {
    ids = uniq(ids).filter(Boolean);
    if (!ids.length) return;
    await editScanQ(async (q) => {
      await store.remove(ids.map((id) => SCANF + id));
      return q.filter((x) => !ids.includes(x.id));
    });
  }
  const storeKeys = async () => (store.getKeys ? await store.getKeys() : Object.keys(await store.get(null)));
  async function clearScanQ() {
    await editScanQ(async () => {
      const rm = (await storeKeys()).filter((k) => k.startsWith(SCANF));
      if (rm.length) await store.remove(rm);
      return [];
    });
  }
  // nội dung file mồ côi (bảng bị đóng giữa chừng lúc đang thêm) – chỉ dọn bản đã cũ hơn 10 phút (tab khác có thể đang thêm)
  async function sweepScanOrphans() {
    try {
      const q = await loadScanQ();
      const keep = new Set(q.map((x) => SCANF + x.id));
      const rm = (await storeKeys()).filter((k) => {
        if (!k.startsWith(SCANF) || keep.has(k)) return false;
        const t = parseInt(k.slice(SCANF.length + 1, -5), 36);
        return !t || Date.now() - t > 10 * 60 * 1000;
      });
      if (rm.length) await store.remove(rm);
    } catch (e) {}
  }
  // nội dung đã lưu → File để đưa vào trang
  async function scanFileOf(item) {
    const k = SCANF + item.id;
    const v = (await store.get(k))[k];
    if (!v || typeof v.b !== 'string') return null;
    const bin = atob(v.b);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], item.name, { type: v.t || item.type || 'application/pdf' });
  }
  // file trong hàng chờ của hồ sơ có bộ thửa `pairs`, từng loại (don / tbxn):
  //  - tên file đúng đủ bộ thửa → lấy file đó (các file khác tên mà cùng bộ = bản trùng);
  //  - tên dài bị chia (quy định 25.10): vài file cùng loại, không trùng thửa nhau, gộp lại vừa đủ bộ → lấy 1 file, các phần kia là bản trùng;
  //  - chỉ khớp một phần (vd. thửa có ở cả TB khác) → KHÔNG lấy
  const hasScanFor = (pairs) => {
    const p = scanPick(pairs);
    return !!(p.don && p.tbxn) && !p.conflict.length;
  };
  // TB làm được Lưu kho: có file quét CỦA hồ sơ này trong hàng chờ, HOẶC tiện ích đã ghi trang lưu hồ sơ quét của TB này (soát 24/11 – mở Lưu
  // kho thì thấy hồ sơ quét đã có, chỉ tích “Đã xử lý”, không cần file)
  const scanReady = (x) => !!x && (hasScanFor(tbPairs(x)) || (!!(S.stage[String(x.tb)] || {}).quet && (S.stage[String(x.tb)] || {}).quetBy !== 'tay'));
  function scanPick(pairs, q = S.scanQ) {
    const want = uniq(pairs);
    const out = { don: null, tbxn: null, extra: [], partial: [], conflict: [] };
    for (const kind of ['don', 'tbxn']) {
      const cands = q.filter((x) => x.kind === kind && x.pairs.length && x.pairs.every((p) => want.includes(p)));
      const exact = cands.filter((x) => sameSet(x.pairs, want));
      if (exact.length) {
        // nhiều file cùng bộ thửa: phải là CÙNG một bản quét (cùng dung lượng) – khác nhau thì không đoán, để bạn bỏ bản sai
        if (new Set(exact.map((x) => x.size)).size > 1) {
          out.conflict.push(...exact);
          continue;
        }
        const newest = exact.slice().sort((a, b) => (b.at || 0) - (a.at || 0))[0];
        out[kind] = newest;
        out.extra.push(...exact.filter((x) => x !== newest));
        continue;
      }
      // tên dài bị chia: các phần là CÙNG một bản quét (cùng dung lượng), không trùng thửa nhau, gộp lại vừa đủ bộ
      const parts = cands.slice(0, 12);
      let best = null;
      for (let m = 1; m < 1 << parts.length; m++) {
        const sel = parts.filter((_, i) => m & (1 << i));
        if (sel.length < 2 || (best && sel.length >= best.length)) continue;
        if (new Set(sel.map((x) => x.size)).size > 1) continue;
        const all = sel.flatMap((x) => uniq(x.pairs));
        if (all.length === want.length && new Set(all).size === all.length) best = sel;
      }
      if (best) {
        const first = best.find((x) => x.pairs.includes(want[0])) || best[0];
        out[kind] = first;
        out.extra.push(...best.filter((x) => x !== first));
      } else out.partial.push(...cands);
    }
    return out;
  }
  // nhóm hàng chờ theo hồ sơ (TB trong dữ liệu nếu tìm được) – để hiện cho bạn
  function scanGroups() {
    const g = new Map();
    for (const x of S.scanQ) {
      const t = S.data.find((y) => {
        const tp = tbPairs(y);
        return tp.length && x.pairs.every((p) => tp.includes(p));
      });
      const key = t ? 'TB ' + t.tb : x.name.replace(/\.(ddk|tbxn)\.[a-z0-9]+$/i, '');
      if (!g.has(key)) g.set(key, { key, tb: t ? String(t.tb) : '', items: [] });
      g.get(key).items.push(x);
    }
    // hồ sơ có TB trong dữ liệu trước (theo số TB), hồ sơ lạ sau
    return [...g.values()].sort((a, b) => (a.tb ? 0 : 1) - (b.tb ? 0 : 1) || (a.tb && b.tb ? Number(a.tb) - Number(b.tb) : a.key < b.key ? -1 : 1));
  }
  function scanQHtml() {
    if (!S.scanQ.length) return '<div class="muted">Hàng chờ trống – thả file DDK + TBXN vào bảng điền (hoặc bấm “Thêm file quét…”).</div>';
    return scanGroups()
      .map(
        (gr) =>
          `<div class="sq"><b>${esc(gr.key)}</b> ` +
          gr.items
            .sort((a, b) => (a.kind === b.kind ? (a.name < b.name ? -1 : 1) : a.kind === 'don' ? -1 : 1))
            .map(
              (x) =>
                `<span class="chip" title="${esc(x.name)}">${x.kind === 'don' ? 'DDK' : 'TBXN'}<button class="x" data-scanrm="${esc(x.id)}" title="Bỏ file này khỏi hàng chờ (file gốc trên máy vẫn còn)">✕</button></span>`
            )
            .join(' ') +
          '</div>'
      )
      .join('');
  }
  // thẻ hàng chờ file quét (tab Giấy tờ)
  const scanCardHtml = () => `
      <div class="card">
        <div class="ct">📎 Hồ sơ quét – hàng chờ file (<span id="scanQCount">${S.scanQ.length}</span>)</div>
        <div class="hint">Thả <b>sẵn</b> file DDK + TBXN của nhiều hồ sơ vào bảng điền (tên theo số biên nhận, vd. <i>KH 2959.07777.254.13.DDK.pdf</i>). Mở <b>Quy trình xử lý</b> của một hồ sơ rồi bấm <b>▶ Chạy cả TB</b>: tiện ích tự mở Lưu kho hồ sơ quét, bấm +, thêm 2 dòng (Đơn đăng ký, Thông báo xác nhận), tải đúng file lên. Bạn chỉ bấm <b>Cập nhật</b>. File đính kèm xong tự mất khỏi hàng chờ.</div>
        <div id="scanQList" class="sqlist">${scanQHtml()}</div>
        <input type="file" id="scanFile" accept=".pdf,application/pdf,image/*" multiple style="display:none">
        <input type="file" id="scanDir" webkitdirectory multiple style="display:none">
        <div class="row"><button class="btn pri" id="scanPick">Thêm file quét…</button><button class="btn" id="scanDirPick" title="Chọn cả thư mục (vd. 18 TH) – lấy hết file DDK, TBXN trong các thư mục TB">Chọn thư mục…</button><button class="btn" id="scanClear">Xóa hàng chờ</button></div>
      </div>`;
  function renderScanQ() {
    const b = $('#scanQBtn');
    if (b) {
      b.textContent = `📎 ${S.scanQ.length}`;
      b.style.display = S.scanQ.length ? '' : 'none';
    }
    const l = $('#scanQList');
    if (l) l.innerHTML = scanQHtml();
    const c = $('#scanQCount');
    if (c) c.textContent = String(S.scanQ.length);
  }
  // file tạm (bản đặt sẵn cho nút “Tải lên”) chỉ nằm trong bảng điền lúc đang tải; không lưu vào máy
  const dropScanStash = () => root.querySelectorAll('input[data-vbdlis-for]').forEach((x) => x.remove());

  // ----- các cửa sổ của tác vụ “Lưu kho hồ sơ quét” (đều ở khung chính, như bản ghi thao tác của bạn) -----
  // nút “Xử lý tác vụ” của một tác vụ trong cửa sổ Quy trình xử lý (theo mã tác vụ; không có thì theo tên)
  function qtTaskLink(code, name) {
    const a = visIn(`a.btnXuLyTacVu[data-actioncode="${code}"], .btnXuLyTacVu[data-actioncode="${code}"]`);
    if (a) return a;
    for (const tr of document.querySelectorAll('tr')) {
      if (tr.closest('#' + HOST_ID) || !shownEl(tr)) continue;
      if (![...tr.children].some((td) => norm(td.textContent) === norm(name))) continue;
      const b = [...tr.querySelectorAll('a, button')].find((x) => norm(x.textContent) === 'xu ly tac vu' && shownEl(x));
      if (b) return b;
    }
    return null;
  }
  const qtTaskCheck = (code) => visIn(`input[type="checkbox"][data-actioncode="${code}"]`);
  // nút “+” của cửa sổ Lưu kho đang hiện
  const luuKhoPlus = () => [...document.querySelectorAll('#btnAddHoSoQuet')].find((x) => shownEl(x) && !x.closest('#' + HOST_ID)) || null;
  // cửa sổ nào đang hiện (cửa sổ con trước): 'tthsq' Thông tin hồ sơ quét | 'hsq' Hồ sơ quét | 'luukho' | 'cndlpl' Cập nhật dữ liệu pháp lý |
  // 'quytrinh' | ''
  function scanScreen() {
    if (visIn('select[name="loaiHoSoQuet"]') && visIn('#btnLuuHoSoQuet')) return 'tthsq';
    if (visIn('#btnAddFileHoSoQuet') || visIn('#tbDanhSachFile')) return 'hsq';
    if (luuKhoPlus()) return 'luukho';
    if (visIn('#btnCapNhatDuLieuPhapLy') || visIn('a[href="#paneGiayChungNhanSBD"]')) return 'cndlpl';
    if (qtTaskLink('LuuKhoHoSoQuet', 'Lưu kho hồ sơ quét') || qtTaskLink('CapNhatDuLieuPhapLy', 'Cập nhật dữ liệu pháp lý')) return 'quytrinh';
    return '';
  }
  // cửa sổ “Lưu kho hồ sơ quét”: Mã đơn của đơn đang chọn, các thửa trên cây “Thông tin đăng ký”, hồ sơ quét đã có
  // (hidden: đọc cả khi cửa sổ đang ẩn dưới cửa sổ “Hồ sơ quét”)
  function luuKhoInfo(hidden) {
    const plus = hidden ? [...document.querySelectorAll('#btnAddHoSoQuet')].filter((x) => !x.closest('#' + HOST_ID)).pop() : luuKhoPlus();
    if (!plus) return null;
    const box = plus.closest('.modal, [role="dialog"]') || plus.closest('[vmodule-name="luukhohosoquetv2"]') || document.body;
    const items = [...box.querySelectorAll('.dondangky-item')];
    const it = items.find((x) => x.classList.contains('selected')) || (items.length === 1 ? items[0] : null);
    let ma = '';
    if (it)
      for (const li of it.querySelectorAll('li')) {
        const nm = li.querySelector('.name');
        if (nm && /^ma don/.test(norm(nm.textContent))) ma = ((li.querySelector('.value') || li).textContent || '').replace(/\s+/g, ' ').trim();
      }
    const tree = box.querySelector('#treeThongTinDangKy');
    if (!ma) {
      const m = /KH\s*2959\.07777\.[\d.\-]+/i.exec(((it || tree || {}).textContent || '').replace(/\s+/g, ' '));
      if (m) ma = m[0];
    }
    ma = ma.replace(/[.\-]+$/, '');
    // thửa trên cây: “Thửa đất 3765471_0 13 (254) - Diện tích: …” → tờ 254, thửa 13
    const tp = [];
    if (tree)
      for (const a of tree.querySelectorAll('a')) {
        const m = /(?:^|\s)(\d+)\s*\((\d+)\)\s*-\s*dien tich/.exec(norm(a.textContent));
        if (m) tp.push(idNorm(m[2]) + '|' + idNorm(m[1]));
      }
    // hồ sơ quét đã có (danh sách “Thông tin hồ sơ quét” bên phải)
    const recs = [...box.querySelectorAll('.hosoquet-item')];
    const kinds = uniq(recs.flatMap((r) => [...r.querySelectorAll('.filehosoquet')].map((f) => scanKindOf(f.textContent)).filter(Boolean)));
    // tải xong: có Mã đơn, cây đã hiện thửa (không còn đang tải), danh sách hồ sơ quét đã hiện (trống hoặc có hồ sơ)
    const list = box.querySelector('#lstHoSoQuet');
    const loaded =
      !!it && !!ma && !!tree && !tree.querySelector('.jstree-loading') && tp.length > 0 && !!list && !!list.querySelector('.empty, .hosoquet-item');
    return { box, ma, maPairs: uniq(khPairs(ma) || []), treePairs: uniq(tp), nItems: items.length, picked: !!it, recs: recs.length, kinds, loaded };
  }
  const luuKhoSig = (info) => (info && info.loaded ? [info.ma, info.treePairs.join(' '), info.recs, info.kinds.join(' ')].join('#') : '');
  // chờ cửa sổ Lưu kho tải xong hẳn: đọc 2 lần cách 0,5 giây phải giống nhau (Mã đơn, thửa, hồ sơ quét).
  // oldSig: nội dung Lưu kho có sẵn trước khi bấm mở (có thể của hồ sơ trước) – chỉ nhận lại nội dung đó sau 3 giây
  async function luuKhoSettled(ms, alive, oldSig) {
    const t0 = Date.now();
    let prev = '';
    for (;;) {
      if (!alive()) return null;
      const info = luuKhoInfo(false);
      const sig = luuKhoSig(info);
      if (sig && sig === prev && (sig !== oldSig || Date.now() - t0 > 3000)) return info;
      prev = sig;
      if (Date.now() - t0 > ms) return null;
      await sleep(500);
    }
  }
  // bộ thửa của hồ sơ: theo Mã đơn (giống tên file quét); không đọc được thì theo cây
  const dosPairs = (info) => (info.maPairs.length ? info.maPairs : info.treePairs);
  const setNative = (el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // cửa sổ “Thông tin hồ sơ quét”: Loại giấy tờ, Mô tả, Tên giấy tờ = tên loại (như bạn làm tay trong bản ghi)
  async function fillTthsq(kind) {
    const label = SCAN_KIND[kind];
    const sel = visIn('select[name="loaiHoSoQuet"]');
    if (!sel) return 'không thấy ô “Loại giấy tờ”';
    const box = sel.closest('.modal, [role="dialog"]') || document;
    const opt = [...sel.options].find((o) => norm(o.text) === norm(label));
    if (!opt) return `ô “Loại giấy tờ” không có lựa chọn “${label}”`;
    if (sel.value !== opt.value) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await sleep(300); // trang có thể đổi các ô khác theo loại vừa chọn
    const texts = ['moTa', 'tenGiayTo'].map((n) => visIn(`input[name="${n}"], textarea[name="${n}"]`, box)).filter(Boolean);
    texts.forEach((el) => el.value !== label && setNative(el, label));
    await sleep(250);
    const bad = [];
    if (sel.value !== opt.value) bad.push('Loại giấy tờ');
    texts.forEach((el) => el.value !== label && bad.push(el.name === 'moTa' ? 'Mô tả' : 'Tên giấy tờ'));
    return bad.length ? `chưa điền được ${bad.join(', ')}` : '';
  }
  const tthsqSave = () => {
    const sel = visIn('select[name="loaiHoSoQuet"]');
    const box = (sel && sel.closest('.modal, [role="dialog"]')) || document;
    return visIn('#btnLuuHoSoQuet', box) || null;
  };
  // tải 1 file lên 1 dòng: đặt sẵn file trong bảng điền → bấm “Tải lên” của dòng → móc đưa file vào thay hộp chọn file
  // → chờ dòng hiện “Xem tập tin”. Trang không nhận → nhờ bạn bấm “Tải lên” (file vẫn tự vào). File tạm bỏ ngay sau đó.
  async function uploadScanRow(row, file, c, stopIf) {
    const alive = () => {
      stopIf();
      return true;
    };
    const dt = new DataTransfer();
    dt.items.add(file);
    let key = row.id;
    if (!key) {
      key = 'vb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      row.input.setAttribute('data-vbdlis-armed', key);
    }
    root.querySelectorAll('input[data-vbdlis-for]').forEach((x) => x.getAttribute('data-vbdlis-for') === key && x.remove());
    const stash = document.createElement('input');
    stash.type = 'file';
    stash.style.display = 'none';
    stash.setAttribute('data-vbdlis-for', key);
    stash.files = dt.files;
    pn.appendChild(stash);
    const rowNow = () => (row.id && (scanRows() || []).find((r) => r.id === row.id)) || row;
    let ringed = null;
    try {
      const btn = rowNow().upBtn;
      if (btn && shownEl(btn)) clickPage(btn); // nút “Tải lên” của dòng (không phải nút lưu)
      const kyErr = () => {
        const kd = kySoDlg();
        if (!kd) return;
        const e = new Error('trang báo tập tin chưa được ký số');
        e.kySoDlg = kd;
        throw e;
      };
      let took = await waitUntil(() => !stash.isConnected || rowNow().uploaded() || !!kySoDlg(), 5000, alive);
      kyErr();
      if (!took && AUTO() && !S.opts.thuThucThi) {
        // 🤖 (soát 24/11): trang chưa nhận file → bấm “Tải lên” thêm 1 lần, chờ 8 giây; vẫn chưa → dừng TB này (🤖 tạm hoãn, làm TB khác) – không chờ bạn 20 phút
        const b2 = rowNow().upBtn;
        if (b2 && shownEl(b2)) clickPage(b2);
        took = await waitUntil(() => !stash.isConnected || rowNow().uploaded() || !!kySoDlg(), 8000 * slowK(), alive);
        kyErr();
        if (!took) throw new Error('trang chưa nhận file quét (đã bấm “Tải lên” 2 lần) – 🤖 không đứng chờ bạn');
      }
      if (!took) {
        ringed = rowNow().upBtn;
        ringScan(ringed, true);
        c.wait('trang chưa nhận file: bạn bấm “Tải lên” ở dòng tô vàng – file tự vào, không phải chọn (hộp chọn file vẫn mở ra thì chọn đúng file này) · “■ Dừng” để thôi');
        needYou('Bấm “Tải lên”');
        took = await waitUntil(() => !stash.isConnected || rowNow().uploaded() || !!kySoDlg(), WAIT_MAX_MS, alive);
        stopNeed();
        kyErr();
        if (!took) throw new Error('chờ bấm “Tải lên” quá 20 phút – đã dừng');
      }
      c.wait('trang đang tải lên…');
      const up = await waitUntil(() => rowNow().uploaded() || !!kySoDlg(), 120000, alive);
      kyErr();
      if (!up)
        throw new Error('2 phút chưa thấy tải xong – xem lại dòng này trên trang (Xem tập tin), rồi bấm “▶ Chạy cả TB” lại');
    } finally {
      stash.remove(); // file tạm không giữ lại
      if (ringed) {
        ringScan(ringed, false);
        ringScan(rowNow().upBtn, false);
      }
    }
  }

  // ▶ Chạy cả TB ở cửa sổ Lưu kho hồ sơ quét / Hồ sơ quét (hoặc từ Quy trình xử lý qua runQuyTrinh): làm tác vụ “Lưu kho hồ sơ quét”
  // như bản ghi của bạn – mở tác vụ → “+” → Thêm tập tin (Đơn đăng ký, Thông báo xác nhận; tự bấm Lưu nhỏ) → Tải lên đúng file từ hàng chờ
  // → bấm “Cập nhật” (bạn cho phép) → chờ trang lưu → Đóng → tích “Đã xử lý”. Tắt “Quy trình tự động” thì dừng ở “Cập nhật” cho bạn bấm.
  // ctx (từ runAll): step, stopIf, setTitle, setTail, curTb, setTb
  async function runScan(scr0, ctx) {
    const { step, stopIf } = ctx;
    const alive = () => {
      stopIf();
      return true;
    };
    let c = null;
    await loadScanQ();
    renderScanQ();
    if (scr0 === 'tthsq') throw new Error('đang mở cửa sổ “Thông tin hồ sơ quét” – bấm Lưu hoặc Đóng cửa sổ đó rồi bấm “▶ Chạy cả TB” lại');
    let scr = scr0;
    let oldSig = '';
    // 1. Quy trình xử lý → “Xử lý tác vụ” của “Lưu kho hồ sơ quét” – Quy trình phải nằm trên cùng (không bị cửa sổ khác che), không có hộp hỏi
    if (scr === 'quytrinh') {
      c = step('Mở tác vụ “Lưu kho hồ sơ quét”');
      const top = (await act('modalState')).find((x) => x.open);
      if (!top || !/^quy trinh xu ly\b/.test(modalKey(top)))
        throw new Error(`cửa sổ trên cùng là ${top ? top.name : 'màn hình chính'}, không phải “Quy trình xử lý” – đóng cửa sổ đó rồi bấm lại`);
      if (pageDialog()) throw new Error('trang đang hiện hộp hỏi / thông báo – trả lời xong rồi bấm lại');
      const a = qtTaskLink('LuuKhoHoSoQuet', 'Lưu kho hồ sơ quét');
      if (!a) throw new Error('không thấy tác vụ “Lưu kho hồ sơ quét” trong Quy trình xử lý');
      // nội dung Lưu kho có sẵn (của hồ sơ trước, nếu trang dùng lại khung) → nhớ lại để không đọc nhầm
      oldSig = luuKhoSig(luuKhoInfo(true));
      clickPage(a);
      if (!(await waitUntil(() => ['luukho', 'hsq'].includes(scanScreen()), 20000, alive)))
        throw new Error('bấm “Xử lý tác vụ” rồi mà chưa thấy cửa sổ “Lưu kho hồ sơ quét” – mở tay rồi bấm lại');
      scr = scanScreen();
      c.ok();
    }
    // 2. hồ sơ nào: cửa sổ Lưu kho phải tải XONG (Mã đơn + thửa + danh sách hồ sơ quét, đọc 2 lần giống nhau) mới quyết định
    c = step('Hồ sơ đang mở');
    let info = null;
    if (scr === 'luukho') {
      info = await luuKhoSettled(30000, alive, oldSig);
      if (!info)
        throw new Error('cửa sổ “Lưu kho hồ sơ quét” chưa tải xong (Mã đơn, thửa, danh sách hồ sơ quét) – chờ trang tải xong rồi bấm “▶ Chạy cả TB” lại');
    } else info = luuKhoInfo(true);
    let pairs = info ? dosPairs(info) : [];
    let ma = (info && info.ma) || '';
    if (!pairs.length && scr === 'hsq') {
      const nums = openDossierNumbers();
      if (nums.length === 1) {
        pairs = uniq(khPairs(nums[0]) || []);
        ma = nums[0];
      }
    }
    if (!pairs.length)
      throw new Error(
        info && info.nItems > 1 && !info.picked
          ? 'danh sách có nhiều đơn – bấm chọn đơn của hồ sơ rồi bấm lại'
          : 'không đọc được Mã đơn / số biên nhận của hồ sơ – mở cửa sổ “Lưu kho hồ sơ quét” rồi bấm lại'
      );
    const treeNote =
      info && info.maPairs.length && info.treePairs.length && !sameSet(info.maPairs, info.treePairs)
        ? ` · ⚠ cây đơn có thửa khác Mã đơn (${info.treePairs.map((k) => k.split('|').reverse().join('/')).join(', ')}) – lấy theo Mã đơn`
        : '';
    // TB của hồ sơ: đúng bộ thửa; nhiều TB cùng bộ → TB đang chọn nếu có trong đó, không thì không ghi tiến độ
    const tbs = S.data.filter((x) => sameSet(tbPairs(x), pairs));
    const cur0 = ctx.curTb();
    const tbx = tbs.length === 1 ? tbs[0] : tbs.includes(cur0) ? cur0 : null;
    if (ctx.known && ctx.known() && tbx && cur0 && tbx !== cur0)
      throw new Error(`Mã đơn của Lưu kho là của TB ${tbx.tb}, khác hồ sơ đang mở (TB ${cur0.tb}) – tiện ích không lưu kho cho hồ sơ này`);
    if (tbx && cur0 !== tbx) ctx.setTb(tbx);
    // TB chắc chắn của hồ sơ (đơn khớp đúng TB, hoặc TB lần chạy đã biết chắc mà Mã đơn không chỉ TB khác) – chỉ TB này mới được tạm hoãn
    const hx = tbx || (ctx.known && ctx.known() && cur0 && !tbs.length ? cur0 : null);
    // hộp “chưa được ký số” (24/11): hộp chỉ báo + biết chắc TB → Đồng ý, Thoát, ⏸ tạm hoãn (kySoHoan); không thì dừng chờ bạn (không chép chữ hộp)
    const kySoBox = async (d, kind0) => {
      if (hx && plSole(d)) {
        // (soát 24/11) CHỈ file hộp nêu (DDK / TBXN; hộp không nêu → file đang tải lên) không dùng được nữa → bỏ khỏi hàng chờ, SAU khi đã ghi
        // tạm hoãn (bạn thả lại bản đã ký số); file kia giữ nguyên. Không rõ file nào → giữ hết (thả lại bản đã ký cùng tên là thay bản cũ)
        const t = norm(`${d.title || ''} ${d.text || ''}`);
        const k = /\.ddk\b/.test(t) ? 'don' : /tbxn/.test(t) ? 'tbxn' : kind0 || '';
        const drop = async () => {
          if (!k) return;
          try {
            const ids = [pick[k], ...pick.extra.filter((x) => x.kind === k)].filter(Boolean).map((x) => x.id);
            if (ids.length) await unqueueScan(ids);
          } catch (e) {}
        };
        await kySoHoan(d, ctx, hx, c, drop, k);
      }
      needYou('Trang báo – bạn xem', 'bad');
      throw ask(
        `trang báo tập tin chưa được ký số – ${hx ? 'hộp có câu hỏi / nhiều nút' : 'tiện ích chưa biết chắc hồ sơ này là TB nào'}: tiện ích không tự bấm, không tạm hoãn – bạn tự xử lý`,
        ''
      );
    };
    ctx.setTitle(`Lưu kho hồ sơ quét${tbx ? ` – TB ${tbx.tb}` : ''}${ma ? ` – ${ma}` : ''}`);
    c.ok(
      `${ma || pairs.join(', ')}` +
        (tbx
          ? ` – TB ${tbx.tb}`
          : tbs.length > 1
            ? ` – ⚠ khớp cả TB ${tbs.map((x) => x.tb).join(', ')}: vẫn đính kèm, không ghi tiến độ`
            : ' – không thấy TB nào trong dữ liệu có số này (vẫn đính kèm, không ghi tiến độ)') +
        treeNote
    );
    // Đóng cửa sổ Lưu kho (bạn cho phép) → về Quy trình xử lý → tích “Đã xử lý” của tác vụ
    const closeAndTick = async (box) => {
      if (!optOn('tuQT')) return 'bạn bấm Đóng và tích “Đã xử lý” của tác vụ';
      const close = box && [...box.querySelectorAll('a, button')].find((b) => norm(b.textContent) === 'dong' && shownEl(b));
      if (close) clickPage(close);
      return tickTask('LuuKhoHoSoQuet', alive);
    };
    // 3. hồ sơ đã lưu kho chưa; dòng nào đã có tập tin (chạy lại sau khi đã tải) – loại đó không cần file trong hàng chờ
    const rowsNow = () => scanRows() || [];
    const kindDone = (k) => {
      const rs = rowsNow().filter((r) => r.kind === k);
      return rs.length > 0 && rs.every((r) => r.uploaded());
    };
    c = step('File trong hàng chờ');
    const pick = scanPick(pairs);
    if (scr === 'luukho' && info.recs) {
      if (['don', 'tbxn'].every((k) => info.kinds.includes(k))) {
        const ids = [pick.don, pick.tbxn, ...pick.extra].filter(Boolean).map((x) => x.id);
        if (ids.length) await unqueueScan(ids);
        if (tbx) markStage(tbx.tb, 'quet', 'auto');
        c.ok(
          'hồ sơ đã có hồ sơ quét (Đơn đăng ký + Thông báo xác nhận) – không thêm nữa' +
            (ids.length ? `; bỏ ${ids.length} file của hồ sơ này khỏi hàng chờ` : '') +
            (tbx ? `; TB ${tbx.tb}: ${stageOf(tbx) === 'xong' ? '✓ Xong' : 'ghi nhận đã lưu kho (chưa ghi nhận nhập đơn xong nên vẫn chưa xong)'}` : '')
        );
        c = step('Đóng, tích “Đã xử lý” – Lưu kho hồ sơ quét');
        const tk = await closeAndTick(info.box);
        (/da tich|duoc tich/.test(norm(tk)) ? c.ok : c.skip)(tk);
        ctx.setTail('<div class="hint">Hồ sơ này đã lưu kho hồ sơ quét từ trước – tiện ích không thêm hồ sơ quét thứ hai.</div>', '-');
        return;
      }
      throw new Error(`hồ sơ đã có ${info.recs} hồ sơ quét nhưng chưa đủ Đơn đăng ký + Thông báo xác nhận – bạn tự bổ sung (chọn hồ sơ quét đó), tiện ích không thêm hồ sơ quét thứ hai`);
    }
    if (pick.conflict.length)
      throw new Error(
        `hàng chờ có ${pick.conflict.length} file cùng hồ sơ nhưng KHÁC nhau (${pick.conflict.map((x) => x.name).join(', ')}) – bỏ (✕) bản sai ở tab Giấy tờ rồi bấm lại`
      );
    const need = ['don', 'tbxn'].filter((k) => !(scr === 'hsq' && kindDone(k)));
    const miss = need.filter((k) => !pick[k]);
    if (miss.length)
      throw new Error(
        `hàng chờ chưa có file ${miss.map((k) => (k === 'don' ? 'DDK' : 'TBXN')).join(' + ')} của hồ sơ ${ma || pairs.join(', ')} – thả file vào bảng điền rồi bấm lại` +
          (pick.partial.length ? ` (có ${pick.partial.length} file chỉ trùng một phần thửa – không dùng)` : '')
      );
    c.ok(need.length ? need.map((k) => pick[k].name).join(' · ') : 'cả 2 dòng đã có tập tin');
    // 4. Lưu kho → “+” → cửa sổ “Hồ sơ quét” (đọc lại ngay trước khi bấm: đã có hồ sơ quét / đổi hồ sơ thì thôi)
    if (scr === 'luukho') {
      c = step('Bấm “+” thêm hồ sơ quét');
      const again = luuKhoInfo(false);
      if (!again || !again.loaded || again.recs || !sameSet(dosPairs(again), pairs))
        throw new Error('cửa sổ Lưu kho vừa đổi (đã có hồ sơ quét / khác hồ sơ / đang tải lại) – bấm “▶ Chạy cả TB” lại');
      const plus = luuKhoPlus();
      if (!plus) throw new Error('không thấy nút “+” của Lưu kho hồ sơ quét');
      clickPage(plus);
      if (!(await waitUntil(() => scanScreen() === 'hsq', 20000, alive))) throw new Error('bấm “+” rồi mà chưa thấy cửa sổ “Hồ sơ quét”');
      scr = 'hsq';
      c.ok();
    }
    // 5. thêm dòng còn thiếu: Thêm tập tin → chọn loại → Lưu (nút Lưu nhỏ – chỉ thêm dòng; bạn đã cho phép tự bấm)
    for (const kind of ['don', 'tbxn']) {
      stopIf();
      if (rowsNow().some((r) => r.kind === kind)) continue;
      c = step(`Thêm dòng “${SCAN_KIND[kind]}”`);
      if (!optOn('tuHsq'))
        throw new Error(`bạn đang tắt “Lưu kho hồ sơ quét tự động” – tự bấm “Thêm tập tin”, chọn “${SCAN_KIND[kind]}”, Lưu, rồi bấm “▶ Chạy cả TB” để tải file lên`);
      const add = visIn('#btnAddFileHoSoQuet');
      if (!add) throw new Error('không thấy nút “Thêm tập tin”');
      clickPage(add);
      if (!(await waitUntil(() => scanScreen() === 'tthsq', 15000, alive))) throw new Error('bấm “Thêm tập tin” rồi mà chưa thấy cửa sổ “Thông tin hồ sơ quét”');
      await sleep(300);
      const err = await fillTthsq(kind);
      if (err) throw new Error(`${err} – cửa sổ “Thông tin hồ sơ quét” vẫn mở: bạn tự điền rồi bấm Lưu, sau đó bấm “▶ Chạy cả TB” lại`);
      // 🤖: ô / nút bạn tích thêm trong mẫu cửa sổ này (tab Trường) – làm trước nút Lưu (Loại giấy tờ, Mô tả, Tên giấy tờ tiện ích tự điền)
      const exT = await tplChainExtras({ base: 'giayTo', decide: ['luu'], fields: true, skipKeys: ['loai', 'moTa', 'ten'], step });
      if (exT) throw new Error(`${exT} – cửa sổ “Thông tin hồ sơ quét” vẫn mở: bạn xem rồi tự bấm Lưu, sau đó bấm “▶ Chạy cả TB” lại`);
      if (scanScreen() !== 'tthsq' || pageDialog())
        throw new Error('cửa sổ “Thông tin hồ sơ quét” đã đổi / trang đang hỏi (sau nút theo mẫu tab Trường) – tiện ích không bấm Lưu; bạn xem rồi bấm “▶ Chạy cả TB” lại');
      const save = tthsqSave();
      if (!save) throw new Error('không thấy nút “Lưu” của cửa sổ “Thông tin hồ sơ quét”');
      stopIf();
      clickPage(save);
      if (!(await waitUntil(() => scanScreen() === 'hsq' && rowsNow().some((r) => r.kind === kind), 20000, alive)))
        throw new Error(
          scanScreen() === 'tthsq'
            ? 'đã bấm “Lưu” nhưng cửa sổ “Thông tin hồ sơ quét” chưa đóng (trang báo thiếu ô?) – bạn xem rồi tự Lưu, sau đó bấm “▶ Chạy cả TB” lại'
            : `chưa thấy dòng “${SCAN_KIND[kind]}” trong danh sách tập tin`
        );
      c.ok(`Loại giấy tờ, Mô tả, Tên giấy tờ = “${SCAN_KIND[kind]}”`);
    }
    // 6. tải lên từng file – dòng đã có tập tin thì bỏ qua; file nào đính kèm xong thì xóa file đó (và bản trùng của nó) khỏi hàng chờ
    //    (🤖 tự bấm Cập nhật: xóa khi trang LƯU XONG – dừng giữa chừng / 🤖 đóng cửa sổ thì file vẫn còn để làm lại)
    let hooked = false;
    const upIds = [];
    for (const kind of ['don', 'tbxn']) {
      stopIf();
      const item = pick[kind];
      const extraIds = pick.extra.filter((x) => x.kind === kind).map((x) => x.id);
      if (kindDone(kind)) {
        if (item) await unqueueScan([item.id, ...extraIds]);
        c = step(`Tải lên “${SCAN_KIND[kind]}”`);
        c.skip(`dòng đã có tập tin${item ? ' – bỏ file khỏi hàng chờ' : ''}`);
        continue;
      }
      c = step(`Tải lên ${item.name}`);
      const row = rowsNow().find((r) => r.kind === kind && !r.uploaded());
      if (!row) throw new Error(`không thấy dòng “${SCAN_KIND[kind]}” trong danh sách tập tin`);
      if (!hooked) {
        const armed = await send({ type: 'vbdlis-arm-file' });
        if (!armed || !armed.ok || !armed.result || !armed.result.ok)
          throw new Error(`không cài được phần đưa file vào trang (${(armed && armed.error) || 'lỗi không rõ'}) – bạn tự bấm “Tải lên” chọn file`);
        hooked = true;
      }
      const file = await scanFileOf(item);
      if (!file) throw new Error(`không đọc được nội dung file ${item.name} trong hàng chờ – thả lại file đó rồi bấm lại`);
      try {
        await uploadScanRow(row, file, c, stopIf);
      } catch (e) {
        if (e && e.kySoDlg) await kySoBox(e.kySoDlg, kind);
        throw e;
      }
      if (optOn('tuQT')) {
        upIds.push(item.id, ...extraIds);
        c.ok(`→ dòng “${SCAN_KIND[kind]}” – đã tải lên (xóa khỏi hàng chờ khi trang lưu xong)`);
      } else {
        await unqueueScan([item.id, ...extraIds]);
        c.ok(`→ dòng “${SCAN_KIND[kind]}” – đã tải lên, đã xóa khỏi hàng chờ`);
      }
    }
    // 7. “Cập nhật”
    c = step('Nút “Cập nhật”');
    const cap = visIn('#btnCapNhatHoSoQuet');
    if (!cap) throw new Error('không thấy nút “Cập nhật” – bạn tự bấm');
    if (!['don', 'tbxn'].every(kindDone)) throw new Error('chưa đủ 2 dòng có tập tin – không bấm “Cập nhật”');
    if (optOn('tuQT')) {
      // 🤖: ô / nút bạn tích thêm trong mẫu cửa sổ Hồ sơ quét (tab Trường) – làm trước “Cập nhật”
      const exH = await tplChainExtras({ base: 'giayTo', decide: ['cap nhat'], fields: true, step });
      if (exH) throw new Error(`${exH} – tiện ích không bấm “Cập nhật”; bạn xem rồi bấm “▶ Chạy cả TB” lại`);
      // nút theo mẫu không được làm đổi cửa sổ: vẫn Hồ sơ quét, đủ 2 dòng có tập tin, đúng nút Cập nhật, không có hộp hỏi
      if (scanScreen() !== 'hsq' || visIn('#btnCapNhatHoSoQuet') !== cap || !['don', 'tbxn'].every(kindDone) || pageDialog())
        throw new Error('cửa sổ Hồ sơ quét đã đổi (thiếu dòng / có hộp hỏi / nút Cập nhật khác) sau nút theo mẫu tab Trường – tiện ích không bấm “Cập nhật”; bạn xem rồi bấm “▶ Chạy cả TB” lại');
      // bạn cho phép tự bấm: đúng hồ sơ, đủ 2 dòng có tập tin → Cập nhật → chờ Lưu kho mở lại có hồ sơ quét đủ 2 loại
      const t0 = Date.now();
      S.armedScan = null;
      stopIf();
      cap.click();
      c.wait('đã bấm “Cập nhật”, chờ trang lưu…');
      let fin = null;
      for (;;) {
        stopIf();
        const d = pageDialog();
        if (d) {
          if (kySoDlg()) await kySoBox(d); // tập tin chưa được ký số (24/11)
          const tl = AUTO() ? (await act('answerDialog', { rules: [] })).find((x) => x.ok) : null; // hộp bạn đã dạy
          if (tl) {
            if (tl.learned && tl.err) throw taughtErr(tl);
            await sleep(900);
            continue;
          }
          needYou('Trang đang hỏi – bạn xem', 'bad');
          const eU = ask(`sau khi bấm “Cập nhật”, trang báo: “${d.text.slice(0, 200)}” – tiện ích dừng, bạn tự xử lý`, '');
          eU.noRetry = true; // đã bấm Cập nhật – 🤖 không tự bấm lại
          throw eU;
        }
        if (scanScreen() === 'luukho') {
          const inf = luuKhoInfo(false);
          if (inf && inf.loaded && sameSet(dosPairs(inf), pairs) && ['don', 'tbxn'].every((k) => inf.kinds.includes(k))) {
            fin = inf;
            break;
          }
        }
        if (Date.now() - t0 > 90000) throw new Error('90 giây chưa thấy hồ sơ quét được lưu (cửa sổ Lưu kho chưa mở lại có đủ 2 tập tin) – xem lại trang');
        await sleep(500);
      }
      if (upIds.length) await unqueueScan(upIds); // trang đã lưu hồ sơ quét → bỏ file đã đính kèm khỏi hàng chờ
      if (tbx) markStage(tbx.tb, 'quet', 'auto');
      const xong = !!tbx && stageOf(tbx) === 'xong';
      c.ok(
        'trang đã lưu hồ sơ quét' +
          (tbx ? (xong ? ` – TB ${tbx.tb}: ✓ Xong` : ` – TB ${tbx.tb}: đã lưu kho (chưa ghi nhận nhập đơn xong nên vẫn chưa xong)`) : '')
      );
      c = step('Đóng, tích “Đã xử lý” – Lưu kho hồ sơ quét');
      const tk = await closeAndTick(fin.box);
      (/da tich|duoc tich/.test(norm(tk)) ? c.ok : c.skip)(tk);
      ctx.setTail(
        '<div class="hint">Xong tác vụ Lưu kho hồ sơ quét. Bạn làm <b>Kết ISO</b> và tích “Đã xử lý”; tích đủ 5 tác vụ là 🤖 Tự động hết tự Chuyển tiếp bước “Trả kết quả” rồi Trả hồ sơ.</div>',
        'Xong lưu kho hồ sơ quét'
      );
      return;
    }
    // (tắt “Quy trình tự động”) tô vàng + con trỏ, chờ bạn bấm; trang báo “Cập nhật thành công” thì onScanSaved làm tiếp
    ringScan(cap, true);
    clearTimeout(capRingTimer);
    capRingTimer = setTimeout(() => ringScan(cap, false), 120000);
    let focused = false;
    if (S.opts.enterLuu !== false)
      try {
        cap.focus({ preventScroll: true });
        focused = document.activeElement === cap;
      } catch (e) {}
    c.ok(focused ? 'đã tô vàng, con trỏ ở nút – bạn xem lại 2 dòng (Xem tập tin) rồi nhấn Enter' : 'đã tô vàng – bạn xem lại 2 dòng rồi tự bấm');
    S.armedScan = { tb: tbx ? String(tbx.tb) : '', pairs, ma, at: Date.now() };
    ctx.setTail(
      '<div class="hint">Bạn bấm <b>Cập nhật</b> (Enter). Khi trang báo “Cập nhật thành công”, tiện ích ghi giờ lưu kho' +
        (tbx ? ` (TB ${esc(tbx.tb)} ${(S.stage[String(tbx.tb)] || {}).don ? 'thành <b>✓ Xong</b>' : 'vẫn chưa xong tới khi nhập đơn xong'})` : '') +
        '.</div>',
      'Bấm “Cập nhật”'
    );
  }
  // hộp hỏi / thông báo của trang đang hiện (jconfirm, bootbox, swal…): { box, title, text, buttons }
  function pageDialog() {
    const boxes = [...document.querySelectorAll('.jconfirm-box, .bootbox .modal-content, .swal2-popup')].filter((b) => shownEl(b) && !b.closest('#' + HOST_ID));
    const b = boxes[boxes.length - 1];
    if (!b) return null;
    const title = ((b.querySelector('.jconfirm-title, .modal-title, .swal2-title') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const text = (b.textContent || '').replace(/\s+/g, ' ').trim();
    const buttons = [...b.querySelectorAll('button, .btn')].filter(shownEl);
    return { box: b, title, text, buttons };
  }
  // chữ NỘI DUNG của hộp (không dính tiêu đề / nút – hộp jconfirm dính liền chữ: “thong baoco loi…”), đã bỏ dấu
  function dlgBody(pd) {
    if (!pd || !pd.box) return '';
    const c = pd.box.querySelector('.jconfirm-content, .bootbox-body, .modal-body, .swal2-html-container, .swal2-content');
    return norm(String((c && c.textContent) || pd.text || '').replace(/\s+/g, ' '));
  }
  // chữ hộp để hiện cho bạn: “Tiêu đề: nội dung” (không dính chữ trên nút)
  function dlgShow(pd) {
    if (!pd || !pd.box) return '';
    const c = pd.box.querySelector('.jconfirm-content, .bootbox-body, .modal-body, .swal2-html-container, .swal2-content');
    const body = String((c && c.textContent) || '').replace(/\s+/g, ' ').trim();
    return ((pd.title ? pd.title + ': ' : '') + (body || pd.text || '')).slice(0, 120);
  }
  // hộp báo lỗi (theo chữ nội dung, hoặc tiêu đề + nội dung cách nhau)
  const dlgIsErr = (pd) => !!pd && (ERR_TOAST.test(dlgBody(pd)) || ERR_TOAST.test(norm(`${pd.title || ''} ${dlgBody(pd)}`)));
  // tích ô “Đã xử lý” của một tác vụ (bạn cho phép): trang thường tự tích sau khi làm xong; chưa tích thì tiện ích tích
  async function tickTask(code, alive) {
    let chk = null;
    await waitUntil(() => (chk = qtTaskCheck(code)), 15000, alive);
    if (!chk) return 'chưa thấy ô “Đã xử lý” (cửa sổ Quy trình xử lý chưa mở lại) – bạn tự tích';
    await sleep(900); // trang có thể tự tích ngay sau khi mở lại
    chk = qtTaskCheck(code) || chk;
    if (chk.checked) return 'ô “Đã xử lý” đã được tích';
    if (!optOn('tuQT')) {
      ringScan(chk, true);
      setTimeout(() => ringScan(chk, false), 60000);
      return 'bạn tích ô “Đã xử lý” (tô vàng)';
    }
    chk.click(); // ô tích: bấm thường (không chặn hành động mặc định)
    await sleep(1200);
    const now = qtTaskCheck(code);
    if (now && now.checked) return 'đã tích “Đã xử lý”';
    const d = pageDialog();
    return d ? `trang hỏi “${(d.title || d.text).slice(0, 80)}” – bạn tự trả lời` : 'chưa tích được ô “Đã xử lý” – bạn tự tích';
  }
  // hộp lỗi của tác vụ Cập nhật dữ liệu pháp lý mà tiện ích tạm hoãn TB rồi làm TB khác (bạn yêu cầu 24/11)
  const PL_HOAN = /khong the cap nhat du lieu phap ly|chua dap ung nhom \d/;
  // lý do CHUNG đọc từ hộp: chỉ các cụm chữ cố định + số nhóm – KHÔNG chép tên / số giấy tờ của người dân trong hộp
  const plWhy = (d) => {
    // chữ hộp THEO DÒNG (innerText – “NHÓM 1” và “1. Đăng ký…” ở 2 dòng; textContent dính thành “NHÓM 11. Đăng ký…”)
    const cEl = d.box && d.box.querySelector('.jconfirm-content, .bootbox-body, .modal-body, .swal2-html-container, .swal2-content');
    const t = norm(`${d.title || ''} ${(cEl && cEl.innerText) || dlgBody(d)}`);
    const parts = [];
    const g = /chua dap ung nhom\s*(\d+?)(?=\d\.|\D|$)/.exec(t);
    if (g) parts.push(`thông tin đăng ký chưa đáp ứng nhóm ${g[1]}`);
    if (/khong co ma dinh danh ca nhan/.test(t)) parts.push('không có mã định danh cá nhân');
    return parts.join(' – ');
  };
  // hộp CHỈ BÁO như ảnh trang thật (một nút “ĐỒNG Ý”): đúng MỘT nút có chữ (Đồng ý / OK / Đóng), không có câu hỏi → được bấm.
  // Hộp hỏi (“?”, “có muốn”, “xác nhận”…) / nhiều nút → tiện ích không tự bấm (bấm Đồng ý ở hộp hỏi là đồng ý một việc bạn chưa cho)
  const plSole = (d) => {
    const btns = d.buttons.filter((b) => {
      const s = norm(b.value || b.textContent || '');
      return s && !/^[×x]$/.test(s);
    });
    const t = norm(`${d.title || ''} ${dlgBody(d)}`);
    return btns.length === 1 && /^(dong y|ok|dong)$/.test(norm(btns[0].value || btns[0].textContent || '')) && !/\?|co muon|co chac|ban muon|that su muon|hay khong|xac nhan/.test(t);
  };
  // trang báo không cập nhật được dữ liệu pháp lý (vd. “Thông tin đăng ký chưa đáp ứng nhóm 1 … không có mã định danh cá nhân”). x = TB đã BIẾT CHẮC
  // của hồ sơ, d = hộp chỉ báo (plSole):
  //  1) ⏸ tạm hoãn TB NGAY – trước mọi cú bấm (■ Dừng / trang tải lại giữa chừng vẫn còn dấu); lý do là LỖI (chữ chung – lý do được lưu cả trong file
  //     sao lưu); TB đã tạm hoãn vì lý do khác → giữ lý do đó, thêm lý do lỗi
  //  2) bấm Đồng ý của hộp, chờ hộp đóng; 3) đóng cửa sổ Cập nhật dữ liệu pháp lý (không lưu); 4) Quy trình xử lý mở lại (có khi chậm – chờ tới 15 giây
  //     như lúc tích “Đã xử lý”) thì đóng luôn; 5) hết hộp / cửa sổ → dừng TB này KHÔNG báo lỗi (hoanSkip) – 🤖 làm TB khác; còn hộp / cửa sổ chưa đóng
  //     được → dừng, báo bạn (tiếng) đóng giúp. Luôn ném lỗi (không trả về)
  async function plHoan(d, ctx, x, c) {
    const id = String(x.tb);
    const why = plWhy(d);
    const lyDo1 = `Lỗi Cập nhật dữ liệu pháp lý${why ? ': ' + why : ''}`;
    const old = ((S.stage[id] || {}).hoan || {}).lyDo || '';
    markStage(id, 'hoan', 'auto', { lyDo: old && !old.includes('Lỗi Cập nhật dữ liệu pháp lý') ? `${old} · ${lyDo1}` : lyDo1 });
    try {
      await stageChain;
    } catch (e) {}
    const head = `TB ${esc(x.tb)} – ${esc(whoOf(x))}: trang báo không cập nhật được dữ liệu pháp lý${why ? ` (${esc(why)})` : ''} → đã <b>tạm hoãn</b> (lý do: lỗi)`;
    setEvt(`⏸ ${head} – tiện ích bấm “Đồng ý”, đóng cửa sổ…`, true);
    c.wait(`trang báo “Không thể cập nhật dữ liệu pháp lý”${why ? ` (${why})` : ''} – đã tạm hoãn TB ${x.tb}; tiện ích bấm “Đồng ý”, đóng cửa sổ`);
    const alive = () => {
      ctx.stopIf();
      return true;
    };
    const shut = [];
    let clicked = false;
    let gone = false;
    let oops = '';
    try {
      // nút của hộp (hộp vừa vẽ lại → đọc lại hộp)
      let box = d;
      if (!box.buttons.some((b) => b.isConnected)) {
        const d1 = pageDialog();
        if (d1 && PL_HOAN.test(norm(`${d1.title} ${d1.text}`)) && plSole(d1)) box = d1;
      }
      const ok = box.buttons.find((b) => b.isConnected && /^(dong y|ok|dong)$/.test(norm(b.value || b.textContent || '')));
      if (ok) {
        ok.click();
        clicked = true;
      }
      gone = await waitUntil(() => !pageDialog(), 5000, alive);
      if (gone) {
        const topNow = async () => (await act('modalState')).find((m) => m.open) || null;
        // cửa sổ Cập nhật dữ liệu pháp lý: theo tên; tên khác thì theo tên của cửa sổ có nút “Thực hiện” của tác vụ (#btnCapNhatDuLieuPhapLy)
        if (scanScreen() === 'cndlpl') {
          const top = await topNow();
          const k = top ? modalKey(top) : '';
          const own = visIn('#btnCapNhatDuLieuPhapLy') || visIn('a[href="#paneGiayChungNhanSBD"]');
          const ownM = own && own.closest('.modal, [role="dialog"]');
          const win = /^cap nhat du lieu phap ly/.test(k)
            ? '^cap nhat du lieu phap ly'
            : k && ownM && titleOf(ownM) === k
            ? '^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : '';
          if (win && (await act('closeTop', { win })).some((y) => y.ok) && (await waitUntil(() => scanScreen() !== 'cndlpl', 5000, alive)))
            shut.push('Cập nhật dữ liệu pháp lý');
        }
        // Quy trình xử lý: trang mở lại sau khi đóng cửa sổ tác vụ (có khi chậm)
        if (scanScreen() !== 'cndlpl' && !pageDialog()) {
          await waitUntil(() => qtModal() || pageDialog(), 15000, alive);
          if (qtModal() && !pageDialog()) {
            await sleep(600); // trang vẽ xong cửa sổ
            const top = await topNow();
            if (
              top &&
              /^quy trinh xu ly\b/.test(modalKey(top)) &&
              (await act('closeTop', { win: '^quy trinh xu ly' })).some((y) => y.ok) &&
              (await waitUntil(() => !qtModal(), 5000, alive))
            )
              shut.push('Quy trình xử lý');
          }
        }
      }
    } catch (e) {
      if (S.stopReq) {
        // ■ Dừng / 🤖 tắt / bảng ẩn: dừng luôn – TB đã ghi tạm hoãn
        setEvt(`⏸ ${head} – lần chạy dừng giữa chừng: bạn xem hộp / cửa sổ còn mở trên VBDLIS.`, true);
        throw e;
      }
      oops = String((e && e.message) || e);
    }
    const still = [pageDialog() && 'hộp báo của trang', scanScreen() === 'cndlpl' && 'cửa sổ Cập nhật dữ liệu pháp lý', qtModal() && 'cửa sổ Quy trình xử lý'].filter(Boolean);
    const did = [clicked && gone ? 'đã bấm “Đồng ý”' : '', shut.length ? `đã đóng cửa sổ ${shut.join(', ')}` : ''].filter(Boolean).join(', ');
    const msg = `trang báo “Không thể cập nhật dữ liệu pháp lý”${why ? ` (${why})` : ''} → ⏸ đã tạm hoãn TB ${x.tb}${did ? ', ' + did : ''}`;
    if (still.length || oops) {
      // chưa đóng hết → 🤖 không làm tiếp được: dừng, cuối lần chạy kêu báo bạn
      const left = still.join(', ') || 'cửa sổ chưa đóng được';
      setEvt(`⏸ ${head} – còn ${esc(left)}: bạn đóng giúp${AUTO() ? ', rồi 🤖 làm TB khác' : ''}.`, true);
      throw ask(`${msg} – còn ${left}${oops ? ` (${oops})` : ''}: bạn đóng giúp${AUTO() ? ', rồi 🤖 làm TB khác' : ''}`, '');
    }
    setEvt(`⏸ ${head}${did ? ', ' + esc(did) : ''}${AUTO() ? ' – 🤖 sang TB khác' : ''}.`, true);
    const e = new Error(`${msg}${AUTO() ? ' – 🤖 sang TB khác' : ' – chọn TB khác rồi bấm ▶'}`);
    e.hoanSkip = true;
    throw e;
  }
  // hộp “Tập tin … chưa được ký số! Vui lòng ký số tập tin trước khi đính kèm!” ở cửa sổ Hồ sơ quét (bạn yêu cầu 24/11, ảnh trang thật):
  // bấm Đồng ý → Thoát cửa sổ Hồ sơ quét (không lưu) → ⏸ tạm hoãn TB, lý do là lỗi (chữ chung: loại tập tin DDK / TBXN – không chép tên tập tin)
  // → 🤖 đóng nốt cửa sổ (Lưu kho, Quy trình), về danh sách làm TB khác. Hộp có câu hỏi / nhiều nút, hoặc chưa biết chắc TB → dừng chờ bạn
  const KY_SO = /chua duoc ky so|ky so tap tin/;
  const kySoDlg = () => {
    const d = pageDialog();
    return d && KY_SO.test(norm(`${d.title || ''} ${d.text || ''}`)) ? d : null;
  };
  async function kySoHoan(d, ctx, x, c, after, kind0) {
    const t = norm(`${d.title || ''} ${d.text || ''}`);
    const k2 = /\.ddk\b/.test(t) ? 'don' : /tbxn/.test(t) ? 'tbxn' : kind0 || '';
    const which = k2 === 'don' ? 'DDK (đơn đăng ký)' : k2 === 'tbxn' ? 'TBXN' : '';
    const lyDo1 = `Lỗi Lưu kho hồ sơ quét: tập tin ${which ? which + ' ' : ''}chưa được ký số – ký số tập tin, thả lại file rồi bỏ tạm hoãn để 🤖 làm lại`;
    const id = String(x.tb);
    const old = ((S.stage[id] || {}).hoan || {}).lyDo || '';
    // ghi tạm hoãn TRƯỚC mọi cú bấm (■ Dừng / trang tải lại giữa chừng vẫn còn dấu)
    markStage(id, 'hoan', 'auto', { lyDo: old && !old.includes('chưa được ký số') ? `${old} · ${lyDo1}` : lyDo1 });
    try {
      await stageChain;
    } catch (e) {}
    if (after) await after(); // bỏ file chưa ký số khỏi hàng chờ – sau khi đã có dấu tạm hoãn
    c.wait(`trang báo tập tin ${which ? which + ' ' : ''}chưa được ký số – đã tạm hoãn TB ${x.tb}; tiện ích bấm “Đồng ý”, “Thoát”`);
    const alive = () => {
      ctx.stopIf();
      return true;
    };
    let clicked = false;
    let gone = false;
    let out = false;
    try {
      const ok = d.buttons.find((b) => b.isConnected && /^(dong y|ok|dong)$/.test(norm(b.value || b.textContent || '')));
      if (ok) {
        ok.click();
        clicked = true;
      }
      gone = await waitUntil(() => !pageDialog(), 5000, alive);
      if (gone) {
        const top = (await act('modalState')).find((m) => m.open);
        const k = top ? modalKey(top) : '';
        if (top && /^(thong tin )?ho so quet\b/.test(k) && (await act('closeTop', { win: '^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })).some((y) => y.ok))
          out = await waitUntil(() => scanScreen() !== 'hsq' && scanScreen() !== 'tthsq', 6000, alive);
        if (!out && scanScreen() === 'hsq') {
          // dự phòng: cửa sổ Hồ sơ quét không được nhận là cửa sổ trên cùng (vd. không có ô nhập) → bấm thẳng nút “Thoát” (đúng MỘT nút) của cửa sổ đó
          const own = visIn('#btnCapNhatHoSoQuet') || visIn('#tbDanhSachFile') || visIn('#btnAddFileHoSoQuet');
          const win = own && own.closest('.modal, [role="dialog"]');
          const bt = win ? [...win.querySelectorAll('button, a, .btn')].filter((b) => shownEl(b) && /^(thoat|dong)$/.test(btnText(b))) : [];
          if (bt.length === 1) {
            clickPage(bt[0]);
            out = await waitUntil(() => scanScreen() !== 'hsq' && scanScreen() !== 'tthsq', 6000, alive);
          }
        }
      }
    } catch (e) {
      if (S.stopReq) throw e; // ■ Dừng – TB đã ghi tạm hoãn
    }
    const did = [clicked && gone ? 'đã bấm “Đồng ý”' : '', out ? 'đã bấm “Thoát” cửa sổ Hồ sơ quét' : ''].filter(Boolean).join(', ');
    const head = `trang báo tập tin ${which ? which + ' ' : ''}chưa được ký số → ⏸ đã tạm hoãn TB ${x.tb}${did ? ', ' + did : ''}`;
    if (!gone || !out) throw ask(`${head} – ${!gone ? 'hộp báo chưa đóng' : 'cửa sổ Hồ sơ quét chưa đóng'}: bạn đóng giúp`, '');
    if (AUTO()) S.cvLeave = { tb: id, at: Date.now(), now: 1 }; // 🤖: đóng nốt Lưu kho / Quy trình (không chờ 20 giây), về danh sách làm TB khác
    setEvt(`⏸ TB ${esc(x.tb)} – ${esc(whoOf(x))}: tập tin ${esc(which)} chưa được ký số → ${esc(did)}, đã <b>tạm hoãn</b> (lý do: lỗi)${AUTO() ? ' – 🤖 đóng nốt cửa sổ, làm TB khác' : ''}.`, true);
    const e = new Error(`${head}${AUTO() ? ' – 🤖 đóng nốt cửa sổ, làm TB khác' : ' – chọn TB khác rồi bấm ▶'}`);
    e.hoanSkip = true;
    throw e;
  }
  // Tác vụ “Cập nhật dữ liệu pháp lý” (như bạn hướng dẫn 22/11): Xử lý tác vụ → tab thứ 3 “Thông tin sau biến động” (Thông tin giấy SBD)
  // → bấm dòng “Đơn đăng ký” (chuyển xanh) → Thực hiện → hộp hỏi xác nhận: Đồng ý (bạn cho phép) → chờ “Cập nhật dữ liệu pháp lý thành công”
  // → tích “Đã xử lý”. Hộp hỏi lạ / báo lỗi → dừng chờ bạn.
  async function runTask2(ctx) {
    const { step, stopIf } = ctx;
    const alive = () => {
      stopIf();
      return true;
    };
    let c = step('Tác vụ “Cập nhật dữ liệu pháp lý”');
    {
      // (soát 24/11) đã bấm “Thực hiện” cho đúng hồ sơ này và trang đã báo “Cập nhật dữ liệu pháp lý thành công” (Quy trình mở lại chậm nên chưa tích
      // được) → KHÔNG bấm lại – chỉ tích “Đã xử lý”
      const pc = S.plClick;
      const soNow = scanScreen() === 'quytrinh' && pc ? soKey((await dossierSo()) || '') : '';
      if (pc && soNow && pc.so && soNow === pc.so && (S.lastPl || 0) > pc.at && S.lastPl - pc.at < 120000 && Date.now() - pc.at < 15 * 60 * 1000) {
        c.skip(`đã cập nhật dữ liệu pháp lý lúc ${fmtTime(pc.at)} (trang đã báo thành công) – không bấm lại`);
        c = step('Tích “Đã xử lý” – Cập nhật dữ liệu pháp lý');
        const tk0 = await tickTask('CapNhatDuLieuPhapLy', alive);
        (/da tich|duoc tich/.test(norm(tk0)) ? c.ok : c.skip)(tk0);
        return;
      }
    }
    if (scanScreen() === 'quytrinh') {
      const top = (await act('modalState')).find((x) => x.open);
      if (!top || !/^quy trinh xu ly\b/.test(modalKey(top)))
        throw new Error(`cửa sổ trên cùng là ${top ? top.name : 'màn hình chính'}, không phải “Quy trình xử lý” – đóng cửa sổ đó rồi bấm lại`);
      if (pageDialog()) throw new Error('trang đang hiện hộp hỏi / thông báo – trả lời xong rồi bấm lại');
      const a = qtTaskLink('CapNhatDuLieuPhapLy', 'Cập nhật dữ liệu pháp lý');
      if (!a) throw new Error('không thấy tác vụ “Cập nhật dữ liệu pháp lý” trong Quy trình xử lý');
      clickPage(a);
      if (!(await waitUntil(() => scanScreen() === 'cndlpl', 20000, alive))) throw new Error('bấm “Xử lý tác vụ” rồi mà chưa thấy cửa sổ “Cập nhật dữ liệu pháp lý”');
    }
    // tab thứ 3 “Thông tin sau biến động” (chú thích “Thông tin giấy SBD”)
    const tab =
      visIn('a[href="#paneGiayChungNhanSBD"]') ||
      [...document.querySelectorAll('.nav-tabs a')].find(
        (x) => shownEl(x) && /thong tin sau bien dong|giay sbd/.test(norm(`${x.textContent} ${(x.closest('li') || x).getAttribute('title') || ''}`))
      );
    if (!tab) throw new Error('không thấy tab “Thông tin sau biến động” (Thông tin giấy SBD)');
    clickPage(tab);
    // dòng “Đơn đăng ký” trên cây (cây có thể tải chậm)
    const donNodes = () =>
      [...document.querySelectorAll('#treeGiayChungNhanSBD a.jstree-anchor, #paneGiayChungNhanSBD a.jstree-anchor')].filter(
        (x) => shownEl(x) && /^don dang ky\b/.test(norm(x.textContent))
      );
    if (!(await waitUntil(() => donNodes().length && !document.querySelector('#treeGiayChungNhanSBD .jstree-loading'), 20000, alive)))
      throw new Error('tab “Thông tin sau biến động” chưa hiện dòng “Đơn đăng ký” – chờ trang tải xong rồi bấm lại');
    const nodes = donNodes();
    const maOf = (x) => {
      const m = /KH\s*2959\.07777\.[\d.\-]+/i.exec(x.textContent || '');
      return m ? m[0].replace(/[.\-]+$/, '') : '';
    };
    const cur0 = ctx.curTb();
    let node = nodes[0];
    if (nodes.length > 1) {
      const i = cur0 ? nodes.findIndex((x) => sameSet(uniq(khPairs(maOf(x)) || []), tbPairs(cur0))) : -1;
      if (i < 0) throw new Error(`tab có ${nodes.length} dòng “Đơn đăng ký” – bạn bấm chọn đúng đơn rồi bấm “Thực hiện”`);
      node = nodes[i];
    }
    const ma = maOf(node);
    const pairs = uniq(khPairs(ma) || []);
    const exact = pairs.length ? S.data.filter((x) => sameSet(tbPairs(x), pairs)) : [];
    const tbx = exact.length === 1 ? exact[0] : exact.includes(cur0) ? cur0 : null;
    if (ctx.known && ctx.known() && tbx && cur0 && tbx !== cur0)
      throw new Error(`đơn trong tác vụ “Cập nhật dữ liệu pháp lý” là của TB ${tbx.tb}, khác hồ sơ đang mở (TB ${cur0.tb}) – tiện ích không làm tác vụ này`);
    if (tbx && tbx !== cur0) ctx.setTb(tbx);
    // TB CHẮC CHẮN của hồ sơ này: đơn khớp đúng TB, hoặc TB lần chạy đã biết chắc (hồ sơ mở từ danh sách / Quy trình 5 tác vụ đọc được số biên nhận)
    // mà đơn không chỉ sang TB khác. Không chắc → hộp lỗi pháp lý KHÔNG tạm hoãn TB nào (không tạm hoãn nhầm TB đang chọn ở màn hình Tiếp nhận)
    const hx = tbx || (ctx.known && ctx.known() && cur0 && !exact.length ? cur0 : null);
    // hộp “Không thể cập nhật dữ liệu pháp lý”: hộp chỉ báo + biết chắc TB → plHoan (tạm hoãn, đóng cửa sổ, 🤖 sang TB khác);
    // không thì dừng chờ bạn – KHÔNG chép chữ của hộp (có tên, số giấy tờ của người dân)
    const plBox = async (d) => {
      if (hx && plSole(d)) await plHoan(d, ctx, hx, c);
      const why = plWhy(d);
      throw ask(
        `trang báo “Không thể cập nhật dữ liệu pháp lý”${why ? ` (${why})` : ''} – ${
          hx ? 'hộp có câu hỏi / nhiều nút' : 'tiện ích chưa biết chắc hồ sơ này là TB nào'
        }: tiện ích không tự bấm, không tạm hoãn – bạn tự xử lý rồi bấm “▶ Chạy cả TB” lại`,
        ''
      );
    };
    // bấm dòng đơn (như bạn bấm – dòng chuyển xanh)
    const picked = () => node.classList.contains('jstree-clicked') || (node.closest('li') && node.closest('li').getAttribute('aria-selected') === 'true');
    if (!picked()) clickPage(node);
    if (!(await waitUntil(picked, 3000, alive))) {
      clickPage(node);
      if (!(await waitUntil(picked, 3000, alive))) throw new Error('chưa chọn được dòng “Đơn đăng ký” – bạn bấm vào dòng đó rồi bấm “▶ Chạy cả TB”');
    }
    c.ok(`đã chọn đơn ${ma}${tbx ? ` – TB ${tbx.tb}` : ''}`);
    // Thực hiện → hộp hỏi → Đồng ý
    c = step('Bấm “Thực hiện”, “Đồng ý”');
    const go = visIn('#btnCapNhatDuLieuPhapLy') || [...document.querySelectorAll('button, a.btn')].find((b) => shownEl(b) && norm(b.textContent) === 'thuc hien');
    if (!go) throw new Error('không thấy nút “Thực hiện”');
    // trang đang hiện hộp (vd. hộp lỗi của lần bấm trước – bạn bấm ▶ lúc hộp còn đó) → KHÔNG bấm “Thực hiện” lần nữa
    {
      const d0 = pageDialog();
      if (d0) {
        if (PL_HOAN.test(norm(`${d0.title} ${d0.text}`))) await plBox(d0);
        throw new Error('trang đang hiện hộp hỏi / thông báo – trả lời xong rồi bấm lại');
      }
    }
    // TB đang tạm hoãn → không gửi tác vụ lên trang (như các bước khác – nút “Bỏ tạm hoãn”)
    if (hx && (S.stage[String(hx.tb)] || {}).hoan)
      throw ask(`TB ${hx.tb} đang tạm hoãn – tiện ích không làm tác vụ “Cập nhật dữ liệu pháp lý”`, actBtn('unHoan', hx.tb, `Bỏ tạm hoãn, chạy TB ${hx.tb}`));
    if (!optOn('tuQT')) {
      ringScan(go, true);
      throw ask('bạn đang tắt “Quy trình tự động” – tự bấm “Thực hiện” rồi “Đồng ý”, sau đó bấm “▶ Chạy cả TB” để làm tác vụ sau', '');
    }
    const t0 = Date.now();
    const plSeen = () => (S.lastPl || 0) > t0;
    stopIf();
    S.plClick = { pairs, so: soKey(openDossierNumbers()[0] || ''), at: t0 }; // đã bấm Thực hiện cho hồ sơ này (lần chạy sau không bấm lại nếu trang đã báo thành công)
    go.click();
    let answered = false;
    for (;;) {
      stopIf();
      const d = pageDialog();
      if (d) {
        const yes = d.buttons.find((b) => norm(b.textContent) === 'dong y');
        const t = norm(`${d.title} ${d.text}`);
        const bad = /loi|khong thanh cong|that bai|vui long|chua chon|khong the|khong duoc|khong co/.test(t);
        // (24/11 – bạn yêu cầu, ảnh trang thật) “KHÔNG THỂ CẬP NHẬT DỮ LIỆU PHÁP LÝ – Thông tin đăng ký chưa đáp ứng nhóm 1 … không có mã định danh
        // cá nhân” → bấm Đồng ý, đóng cửa sổ, ⏸ tạm hoãn TB này (lý do = lỗi), 🤖 sang TB khác
        if (bad && PL_HOAN.test(t)) await plBox(d);
        if (!answered && yes && !bad && (/phap ly|cap nhat/.test(t) || d.text.includes('?'))) {
          c.wait(`trang hỏi “${(d.title || d.text).slice(0, 80)}” – tiện ích bấm “Đồng ý”`);
          yes.click();
          answered = true;
        } else if (!answered || bad) {
          const tl = AUTO() ? (await act('answerDialog', { rules: [] })).find((x) => x.ok) : null; // hộp bạn đã dạy ở tab Trường
          if (tl) {
            if (tl.learned && (tl.err || bad)) throw taughtErr(tl); // (soát 24/11) hộp báo lỗi theo chữ của tiện ích cũng là chưa xong
            await sleep(900);
            continue;
          }
          needYou('Trang đang hỏi – bạn xem', 'bad');
          const eP = ask(`sau khi bấm “Thực hiện”, trang báo: “${d.text.slice(0, 200)}” – tiện ích dừng, bạn tự xử lý rồi bấm “▶ Chạy cả TB” lại`, '');
          eP.noRetry = true; // đã bấm Thực hiện – 🤖 không tự bấm lại
          throw eP;
        }
      } else if (plSeen() || (scanScreen() === 'quytrinh' && Date.now() - t0 > 1500)) break; // xong: trang báo thành công / Quy trình mở lại
      if (Date.now() - t0 > 90000) throw new Error('90 giây chưa thấy “Cập nhật dữ liệu pháp lý thành công” – xem lại trang');
      await sleep(400);
    }
    await waitUntil(() => scanScreen() === 'quytrinh', 20000, alive);
    c.ok(plSeen() ? 'trang báo “Cập nhật dữ liệu pháp lý thành công”' : 'đã xong (cửa sổ Quy trình xử lý mở lại)');
    c = step('Tích “Đã xử lý” – Cập nhật dữ liệu pháp lý');
    const tk = await tickTask('CapNhatDuLieuPhapLy', alive);
    (/da tich|duoc tich/.test(norm(tk)) ? c.ok : c.skip)(tk);
    return tbx;
  }
  // ▶ ở cửa sổ Quy trình xử lý (hoặc Cập nhật dữ liệu pháp lý): tự làm tác vụ 2 rồi tác vụ 3, tích “Đã xử lý” từng tác vụ.
  // Không làm Kết ISO, Chuyển tiếp.
  async function runQuyTrinh(scr0, ctx) {
    const { step } = ctx;
    ctx.setTitle('Quy trình xử lý – tự động');
    let c = step('Kiểm tra cửa sổ Quy trình xử lý');
    if (scr0 === 'quytrinh') {
      let nd = qtTaskCheck('NhapDangKy');
      // Tự động hết: vừa Hoàn tất xong → trang có thể tích “Nhập đăng ký” chậm một chút
      if (nd && !nd.checked && AUTO())
        await waitUntil(() => (nd = qtTaskCheck('NhapDangKy') || nd).checked, 15000, () => {
          ctx.stopIf();
          return true;
        });
      if (nd && !nd.checked)
        throw new Error('tác vụ “Nhập đăng ký” chưa tích “Đã xử lý” – nhập đơn xong (Hoàn tất) rồi bấm lại; đơn đã xong thì tích ô đó rồi bấm “▶ Chạy cả TB”');
    }
    c.ok();
    // tác vụ 2
    const k2 = qtTaskCheck('CapNhatDuLieuPhapLy');
    if (scr0 === 'cndlpl' || (k2 && !k2.checked)) await runTask2(ctx);
    else {
      c = step('Tác vụ “Cập nhật dữ liệu pháp lý”');
      c.skip(k2 ? 'đã xử lý' : 'không có tác vụ này');
    }
    // tác vụ 3
    const k3 = qtTaskCheck('LuuKhoHoSoQuet');
    if (!k3 || k3.checked) {
      c = step('Tác vụ “Lưu kho hồ sơ quét”');
      c.skip(k3 ? 'đã xử lý' : 'không thấy tác vụ này');
      ctx.setTail('<div class="hint">Xong tác vụ 2–3. Bạn làm <b>Kết ISO</b> và tích “Đã xử lý”; tích đủ 5 tác vụ là 🤖 Tự động hết tự Chuyển tiếp bước “Trả kết quả” rồi Trả hồ sơ.</div>', '-');
      return;
    }
    const qq = await loadScanQ();
    const ktb = ctx.known && ctx.known() ? ctx.curTb() : null;
    // hàng chờ trống, hoặc có file của hồ sơ KHÁC mà chưa có file của hồ sơ này (soát 24/11) → không mở Lưu kho
    if (ktb ? !scanReady(ktb) : !qq.length) {
      c = step('Tác vụ “Lưu kho hồ sơ quét”');
      c.skip(`hàng chờ chưa có file quét${qq.length ? ' của hồ sơ này' : ''} – thả file DDK + TBXN vào bảng điền rồi bấm “▶ Chạy cả TB” lại`);
      ctx.setTail('<div class="hint">Tác vụ Lưu kho hồ sơ quét chưa làm: thả file DDK + TBXN của hồ sơ vào bảng điền rồi bấm “▶ Chạy cả TB” lại.</div>', '-');
      return;
    }
    await runScan('quytrinh', ctx);
  }
  // ---------- Chuyển tiếp hồ sơ (Tự động hết – theo 6 ảnh của bạn, 22/11) ----------
  // Lưu hồ sơ → “Xử lý hồ sơ” → Quy trình chỉ có “Tiếp nhận hồ sơ”: tích Đã xử lý → Chuyển tiếp → chọn ĐÚNG tài khoản chuyên viên → Thực thi
  // → “Xử lý hồ sơ” → Quy trình “Nhập đăng ký” + “Giấy tờ đính kèm”: nhập đơn (Lưu thông tin đăng ký, Hoàn tất, Đóng) → tích cả 2
  // → Chuyển tiếp → chọn ĐÚNG tài khoản lãnh đạo → Thực thi → TB ◐ Đã tiếp nhận → TB chưa làm tiếp theo.
  // Quy trình 5 tác vụ (có Kết ISO): KHÔNG tự chuyển tiếp (chỉ làm tác vụ 2–3 như cũ).
  const btnText = (b) => norm((b && (b.value || b.textContent)) || '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const titleOf = (m) => {
    if (!m) return '';
    // ưu tiên phần tử tiêu đề (theo thứ tự này, không theo thứ tự trên trang – thanh đầu cửa sổ đứng trước tiêu đề của nó)
    for (const sel of ['.modal-title', '.ui-dialog-title', '.jconfirm-title', '.k-window-title', '.modal-header h4', '.modal-header h3', '.panel-heading .panel-title']) {
      const t = m.querySelector(sel);
      if (t) return norm(t.textContent).replace(/^[^a-z0-9]+/, '');
    }
    // chỉ có thanh đầu cửa sổ: bỏ nút × và chữ ẩn của nó (“Đóng” / “Close”) – không thì tên thành “đóng trả hồ sơ”
    const h = m.querySelector('.modal-header, .panel-heading');
    if (!h) return '';
    const c = h.cloneNode(true);
    c.querySelectorAll('button, .close, .sr-only, [aria-hidden="true"]').forEach((x) => x.remove());
    return norm(c.textContent).replace(/^[^a-z0-9]+/, '');
  };
  // cửa sổ “ma”: Bootstrap đã bỏ lớp in / show (đang đóng) hoặc gần như trong suốt – trên màn hình không còn thấy
  function modalPhantom(m) {
    if (m.classList.contains('modal') && m.classList.contains('fade') && !m.classList.contains('in') && !m.classList.contains('show')) return true;
    let op = 1;
    for (let e = m.querySelector('.modal-dialog, .modal-content') || m; e && e !== document.documentElement; e = e.parentElement) {
      const v = parseFloat(getComputedStyle(e).opacity);
      if (!isNaN(v)) op *= v;
    }
    return op < 0.1;
  }
  const shownModals = () =>
    [...document.querySelectorAll('.modal, [role="dialog"], .ui-dialog')].filter((m) => shownEl(m) && !m.closest('#' + HOST_ID) && !modalPhantom(m));
  // cửa sổ con thật sự đang hiện và có ô nhập (như bộ điền tính “cửa sổ đang mở”)
  const realModals = () =>
    outer(
      [...document.querySelectorAll('.modal, [role="dialog"], .ui-dialog, .k-window, .bootbox, .swal2-popup, .layui-layer')].filter(
        (m) => shownEl(m) && !m.closest('#' + HOST_ID) && !modalPhantom(m)
      )
    ).filter((m) => [...m.querySelectorAll('input:not([type=hidden]), select, textarea')].some((c) => shownEl(c) || (c.parentElement && shownEl(c.parentElement))));
  // để báo lỗi: các cửa sổ con đang có trên trang (tên, lớp, độ mờ) – kể cả cửa sổ “ma”
  function modalDiag() {
    const all = [...document.querySelectorAll('.modal, [role="dialog"], .ui-dialog, .bootbox, .swal2-popup')].filter((m) => shownEl(m) && !m.closest('#' + HOST_ID));
    return (
      all
        .slice(0, 5)
        .map((m) => {
          const cls = typeof m.className === 'string' ? m.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
          return `“${(titleOf(m) || '?').slice(0, 30)}” .${cls} mờ=${getComputedStyle(m).opacity}${modalPhantom(m) ? ' (ma)' : ''}`;
        })
        .join(', ') || 'không có'
    );
  }
  const outer = (ms) => ms.filter((m) => !ms.some((o) => o !== m && o.contains(m)));
  // nút “Xử lý hồ sơ” của màn hình hồ sơ đã lưu (ảnh 1) – ngoài cửa sổ con
  function btnXuLyHoSo() {
    const ok = (b) => b && shownEl(b) && !b.closest('#' + HOST_ID) && !b.closest('.modal, [role="dialog"]');
    const byId = [...document.querySelectorAll('#btnXuLyHoSo')].find(ok);
    if (byId) return byId;
    const c = [...document.querySelectorAll('a, button')].filter((b) => ok(b) && btnText(b) === 'xu ly ho so');
    return c.length === 1 ? c[0] : null;
  }
  // nút “Lưu hồ sơ” của màn hình tiếp nhận (ngoài cửa sổ con)
  function btnLuuHoSo() {
    return (
      [...document.querySelectorAll('a, button')].find(
        (b) => shownEl(b) && !b.closest('#' + HOST_ID) && !b.closest('.modal, [role="dialog"]') && btnText(b) === 'luu ho so'
      ) || null
    );
  }
  // link “Về trang tiếp nhận hồ sơ” (ảnh 1, góc dưới trái)
  function linkVeTiepNhan() {
    const c = [...document.querySelectorAll('a, button')].filter(
      (b) => shownEl(b) && !b.closest('#' + HOST_ID) && !b.closest('.modal, [role="dialog"]') && btnText(b) === 've trang tiep nhan ho so'
    );
    return c.length === 1 ? c[0] : null;
  }
  // cửa sổ “Quy trình xử lý” đang hiện
  function qtModal() {
    const ms = outer(shownModals().filter((m) => /^quy trinh xu ly\b/.test(titleOf(m))));
    if (ms.length) return ms[ms.length - 1];
    const tb = visIn('#bindQuyTrinhXuLy');
    return tb ? tb.closest('.modal, [role="dialog"]') : null;
  }
  // MỌI tác vụ của Quy trình (kể cả dòng đang bị ô tìm tác vụ ẩn):
  // { tr, name (cột Công việc), key, code (data-actioncode), link (Xử lý tác vụ), chk (ô Đã xử lý), shown }
  function qtRows(m) {
    const tbody = (m && (m.querySelector('#bindQuyTrinhXuLy') || m.querySelector('table tbody'))) || null;
    if (!tbody) return [];
    const table = tbody.closest('table');
    const heads = table ? [...table.querySelectorAll('thead th, thead td')].map((h) => norm(h.textContent)) : [];
    let iName = heads.findIndex((h) => /^cong viec\b/.test(h));
    if (iName < 0) iName = 1;
    return [...tbody.querySelectorAll(':scope > tr')]
      .map((tr) => {
        const cells = [...tr.children];
        const name = cells[iName] ? cells[iName].textContent.replace(/\s+/g, ' ').trim() : '';
        const chk = tr.querySelector('input[type="checkbox"]');
        const link = [...tr.querySelectorAll('a, button')].find((b) => btnText(b) === 'xu ly tac vu') || null;
        const code = (chk && chk.getAttribute('data-actioncode')) || (link && link.getAttribute('data-actioncode')) || '';
        return { tr, name, key: norm(name), code, link, chk, shown: shownEl(tr) };
      })
      .filter((r) => r.key && !/^(khong co du lieu|dang tai|loading)/.test(r.key));
  }
  // ô “Nhập tên tác vụ cần tìm…” của Quy trình – có chữ thì một số tác vụ đang bị ẩn
  const qtFilterText = (m) => {
    const i = m && [...m.querySelectorAll('input')].find((x) => /tac vu/.test(norm(x.placeholder || '')));
    return i ? String(i.value || '').trim() : '';
  };
  // tên tác vụ phải khớp CẢ CHUỖI (bỏ dấu); có data-actioncode thì mã cũng phải hợp với tên
  const QT_KIND = [
    { k: 'tn', name: 'tiep nhan ho so', code: /^tiepnhan/i },
    { k: 'nhap', name: 'nhap dang ky', code: /^nhapdangky$/i },
    { k: 'gt', name: 'giay to dinh kem', code: /^giaytodinhkem$/i },
    { k: 'pl', name: 'cap nhat du lieu phap ly', code: /^capnhatdulieuphaply$/i },
    { k: 'lk', name: 'luu kho ho so quet', code: /^luukhohosoquet$/i },
    { k: 'iso', name: 'ket iso', code: /^ketiso$/i },
    { k: 'tra', name: 'tra ho so', code: /^tra/i },
    { k: 'kd', name: 'ky duyet ho so', code: /^kyduyet/i }, // bước lãnh đạo (vai trò Lãnh đạo, như bản 0.9.3: KyDuyetHoSo)
  ];
  const qtKindOf = (r) => {
    const x = QT_KIND.find((q) => q.name === r.key);
    if (!x && /^kyduyethoso$/i.test(r.code || '') && /^ky duyet\b/.test(r.key)) return 'kd'; // tên “Ký duyệt …” khác chữ, mã đúng KyDuyetHoSo
    return x && (!r.code || x.code.test(r.code)) ? x.k : '';
  };
  // loại Quy trình (ảnh 2, 4, 7, 9 của bạn):
  //  'tn'  đúng 1 tác vụ “Tiếp nhận hồ sơ” → tích Đã xử lý, chuyển chuyên viên
  //  'cv'  đúng 2 tác vụ “Nhập đăng ký” + “Giấy tờ đính kèm” → nhập đơn, tích, chuyển lãnh đạo
  //  'kq'  đúng 5 tác vụ (Giấy tờ đính kèm, Cập nhật dữ liệu pháp lý, Lưu kho hồ sơ quét, Kết ISO, Nhập đăng ký)
  //        → tác vụ 2–3; tích đủ cả 5 (bạn đã Kết ISO) → chuyển bước “Trả kết quả”
  //  'tra' đúng 2 tác vụ “Kết ISO” + “Trả hồ sơ” → Trả hồ sơ (Thực hiện, Đồng ý)
  //  'la'  có tác vụ lạ / dòng không có ô Đã xử lý → tiện ích không tự chuyển; '' chưa có dòng nào
  function qtVariant(rows) {
    if (!rows.length) return '';
    const ks = rows.map((r) => (r.chk ? qtKindOf(r) : ''));
    if (ks.includes('')) return 'la';
    const exactly = (a) => ks.length === a.length && a.every((k) => ks.includes(k));
    if (exactly(['tn'])) return 'tn';
    if (exactly(['nhap', 'gt'])) return 'cv';
    if (exactly(['iso', 'tra'])) return 'tra';
    if (exactly(['kd'])) return 'kd'; // đúng 1 tác vụ “Ký duyệt hồ sơ” – vai trò Lãnh đạo: tích, chuyển bước 4
    if (exactly(['gt', 'pl', 'lk', 'iso', 'nhap'])) return 'kq';
    return 'la';
  }
  const qtSig = (rows) => rows.map((r) => `${r.key}:${r.chk ? (r.chk.checked ? 1 : 0) : '-'}`).join('|');
  // đọc Quy trình khi đã ổn định: 2 lần đọc cách 0,7 giây giống hệt nhau (trang nạp bảng chậm / còn bảng cũ)
  async function qtSettled(alive, ms = 20000) {
    const t0 = Date.now();
    let prev = '';
    for (;;) {
      if (!alive()) return null;
      const m = qtModal();
      const rows = m ? qtRows(m) : [];
      const sig = m && rows.length ? qtSig(rows) : '';
      if (sig && sig === prev) return { m, rows, v: qtVariant(rows) };
      prev = sig;
      if (Date.now() - t0 > ms * slowK()) return null;
      await sleep(700);
    }
  }
  // cửa sổ “Chọn người xử lý tác vụ tiếp theo” (ảnh 3, 6)
  const CHOOSER_MODAL = /^chon nguoi xu ly\b/;
  function chooserModal() {
    const ms = outer(shownModals().filter((m) => CHOOSER_MODAL.test(titleOf(m))));
    return ms.length ? ms[ms.length - 1] : null;
  }
  // cửa sổ “Trả hồ sơ” (ảnh 10: Ghi chú, Thực hiện, Đóng)
  function traModal() {
    return taskWin(/^tra ho so\b/);
  }
  // cửa sổ “Kết ISO” (bạn bật “Tự Kết ISO”): nhận ra như cửa sổ Trả hồ sơ
  function isoModal() {
    return taskWin(/^ket iso\b/);
  }
  // cửa sổ tác vụ theo tiêu đề (re: chữ đã bỏ dấu)
  function taskWin(re) {
    const ms = outer(shownModals().filter((m) => re.test(titleOf(m))));
    if (ms.length) return ms[ms.length - 1];
    // dự phòng (trang thật 23/11: cửa sổ Trả hồ sơ hiện mà tiện ích không nhận ra theo khung chuẩn):
    // khối nhỏ nhất chứa nút “Thực hiện”, ô Ghi chú (textarea) và một tiêu đề khớp re (vd. bắt đầu bằng “Trả hồ sơ”)
    for (const b of document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')) {
      if (b.closest('#' + HOST_ID) || !shownEl(b) || btnText(b) !== 'thuc hien') continue;
      for (let e = b.parentElement, k = 0; e && e !== document.body && k < 10; e = e.parentElement, k++) {
        if (!e.querySelector('textarea')) continue;
        const head = [...e.querySelectorAll('h1, h2, h3, h4, h5, .modal-title, .panel-title, [class*="title"], [class*="header"], [class*="heading"]')].find(
          (hh) => shownEl(hh) && re.test(norm(hh.textContent || '').replace(/^[^a-z0-9]+/, ''))
        );
        if (head) return e;
        break; // khối nhỏ nhất có ô Ghi chú mà không có tiêu đề khớp → không phải cửa sổ này
      }
    }
    return null;
  }
  // để báo lỗi khi không nhận ra cửa sổ Trả hồ sơ: các cửa sổ / khối đang hiện có nút “Thực hiện” (thẻ, lớp, tiêu đề)
  function traDiag() {
    const out = [];
    for (const b of document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')) {
      if (b.closest('#' + HOST_ID) || !shownEl(b) || btnText(b) !== 'thuc hien') continue;
      const w = b.closest('.modal, [role="dialog"], .ui-dialog, .k-window, .bootbox, .swal2-popup, .layui-layer, .panel, form') || b.parentElement;
      const cls = w && typeof w.className === 'string' ? w.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
      const hd = w ? (w.querySelector('.modal-header, .modal-title, [class*="title"], [class*="header"], h4, h3') || {}).textContent || '' : '';
      out.push(`${w ? w.tagName.toLowerCase() : '?'}.${cls} tiêu đề “${String(hd).replace(/\s+/g, ' ').trim().slice(0, 40)}” ô Ghi chú: ${w && w.querySelector('textarea') ? 'có' : 'không'}`);
    }
    return out.slice(0, 3).join(' | ') || 'không thấy nút “Thực hiện” nào';
  }
  // tài khoản: so CẢ CHUỖI – bỏ dấu cách (cả NBSP), ký tự vô hình, không phân biệt hoa / thường
  const accNorm = (s) =>
    String(s || '')
      .normalize('NFC')
      .replace(/[​-‍﻿]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  // ô bước nhận (vd. “2. Chuyên viên (Tiếp theo)”) + các dòng người nhận { tr, acc, name, unit, accCell }
  function chooserInfo(m) {
    const sel = [...m.querySelectorAll('select')].find((s) => shownEl(s) || (s.parentElement && shownEl(s.parentElement))) || null;
    const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    const step = opt ? opt.text.replace(/\s+/g, ' ').trim() : '';
    const loading =
      [...m.querySelectorAll('td')].some((c) => (c.colSpan || 1) > 1 && /dang tai|loading/.test(norm(c.textContent))) ||
      [...m.querySelectorAll('.dataTables_processing')].some(shownEl);
    // cột theo tiêu đề bảng (bảng có thể tách phần tiêu đề / phần thân cuộn được thành 2 bảng)
    const head = [...m.querySelectorAll('thead tr, tr')].find((tr) => [...tr.children].some((h) => /^ten tai khoan\b/.test(norm(h.textContent))));
    if (!head) return { sel, step, rows: [], loading };
    const heads = [...head.children].map((h) => norm(h.textContent));
    const iAcc = heads.findIndex((h) => /^ten tai khoan\b/.test(h));
    const iName = heads.findIndex((h) => /^ho (& |va )?ten\b/.test(h));
    const iUnit = heads.findIndex((h) => /^don vi\b/.test(h));
    const txt = (c) => (c ? c.textContent.replace(/\s+/g, ' ').trim() : '');
    const rows = [...m.querySelectorAll('tbody tr')]
      .map((tr) => {
        const cells = [...tr.children].filter((c) => c.tagName === 'TD');
        // dòng “Đang tải…”, “Không có dữ liệu” (1 ô gộp cột) / dòng thiếu cột → bỏ
        if (cells.length <= Math.max(iAcc, iName, iUnit) || cells.some((c) => (c.colSpan || 1) > 1)) return null;
        return { tr, acc: txt(cells[iAcc]), name: iName >= 0 ? txt(cells[iName]) : '', unit: iUnit >= 0 ? txt(cells[iUnit]) : '', accCell: cells[iAcc] };
      })
      .filter((r) => r && r.acc);
    return { sel, step, rows, loading };
  }
  // dấu “dòng đang được chọn” RÕ RÀNG: ô STT mất số thứ tự, thay bằng biểu tượng ✓ (ảnh 3); lớp selected / active / success…;
  // aria-selected; ô radio / checkbox của dòng đã chọn; biểu tượng fa-check… (không dùng màu nền – dễ nhầm khi chuột đang trỏ)
  // phần tử ĐANG HIỆN (không bị ẩn bằng CSS): trang có thể để sẵn số thứ tự + dấu ✓ ở mọi dòng, chỉ hiện một trong hai
  const visEl = (el) => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return el.getClientRects().length > 0;
  };
  // chữ đang hiện của một ô (bỏ phần tử con bị ẩn)
  function visText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1 && visEl(n)) t += visText(n);
    }
    return t;
  }
  const sttIcon = (tr) => {
    const c = [...tr.children].find((x) => x.tagName === 'TD');
    return !!c && !/\d/.test(visText(c)) && [...c.querySelectorAll('i, svg, img, [class*="check"], [class*="icon"]')].some(visEl);
  };
  // trang thật (23/11): dòng đã chọn chỉ có lớp “selectUser” (ô STT vẫn là số, không có ✓) – bản 0.9.3 kiểm đúng lớp này.
  // Trang thật (24/11, ảnh bạn gửi): dòng bạn chọn có MÀU XANH và ô STT thành dấu ✓ – mà tiện ích đếm cả dòng khác chỉ còn lớp (selectUser /
  // active / success…) là “đang chọn” → báo 2 dòng được chọn, không bấm Thực thi, đứng im. Nay xếp MỨC của dấu chọn, dòng “đang được chọn” là
  // các dòng ở mức CAO NHẤT có trong bảng:
  //  3 – ô STT mất số thứ tự, hiện dấu tích (✓ / biểu tượng check / ok)
  //  2 – dấu tích ở chỗ khác trong dòng, ô radio / checkbox đã tích, aria-selected, nền dòng (hoặc ô STT) màu xanh lá
  //  1 – chỉ có lớp (selected / selectUser / success / active…), hoặc ô STT là một biểu tượng khác
  const CHECK_CLS = /(^|[\s_-])(check|checked|ok|tick)([\s_-]|$)|fa-check|glyphicon-ok|check-circle|checkmark/;
  const sttCell = (tr) => [...tr.children].find((x) => x.tagName === 'TD') || null;
  // nền màu xanh lá (vd. #dff0d8 của dòng “success”) – màu nền trong suốt / xám / trắng thì không
  const greenBg = (el) => {
    if (!el) return false;
    const mm = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(el).backgroundColor || '');
    if (!mm || (mm[4] != null && +mm[4] < 0.2)) return false;
    const r = +mm[1];
    const g = +mm[2];
    const b = +mm[3];
    return g >= 120 && g >= r + 10 && g >= b + 10;
  };
  function rowMarkTier(tr) {
    const c = sttCell(tr);
    const noNum = !!c && !/\d/.test(visText(c));
    const icons = c ? [...c.querySelectorAll('i, svg, img, span, [class*="check"], [class*="icon"]')].filter(visEl) : [];
    const isCheck = (el) => CHECK_CLS.test(String(el.getAttribute('class') || '').toLowerCase()) || /[✓✔☑]/.test(el.textContent || '');
    if (noNum && (icons.some(isCheck) || /[✓✔☑]/.test(visText(c)))) return 3;
    if (
      [...tr.querySelectorAll('.fa-check, .fa-check-circle, .fa-check-circle-o, .fa-check-square, .fa-check-square-o, .glyphicon-ok, .glyphicon-check')].some(visEl) ||
      !!tr.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked') ||
      tr.getAttribute('aria-selected') === 'true' ||
      greenBg(tr) ||
      greenBg(c)
    )
      return 2;
    if (/(^|\s)(selected|selectuser|select-user|is-selected|selected-row|row-selected|active|success|highlight|chosen)(\s|$)/i.test(tr.className || '') || (noNum && icons.length))
      return 1;
    return 0;
  }
  // các dòng “đang được chọn”: dòng có dấu ở mức cao nhất trong bảng (không dòng nào có dấu → [])
  const markedRows = (rows) => {
    const t = rows.map((r) => rowMarkTier(r.tr));
    const top = Math.max(0, ...t);
    return top ? rows.filter((r, i) => t[i] === top) : [];
  };
  const chooserSig = (info) => (info.loading || !info.rows.length ? '' : `${norm(info.step)}#${info.rows.map((r) => accNorm(r.acc)).join(',')}`);
  // danh sách người nhận đã ổn định: không còn “Đang tải…”, 2 lần đọc cách 0,7 giây giống hệt (bước + danh sách tài khoản)
  async function chooserSettled(m, alive, ms = 15000) {
    const t0 = Date.now();
    let prev = '';
    for (;;) {
      if (!alive()) return null;
      const info = chooserInfo(m);
      const sig = chooserSig(info);
      if (sig && sig === prev) return info;
      prev = sig;
      if (Date.now() - t0 > ms * slowK()) return null;
      await sleep(700);
    }
  }
  // chọn ĐÚNG MỘT dòng có Tên tài khoản = acc rồi kiểm tra CHỈ dòng đó có dấu chọn. Không gõ vào ô tìm kiếm (phím Enter có thể
  // làm trang chạy lệnh). Không thấy / thấy nhiều / không chắc đã chọn → { ok: false, why }
  async function pickAccount(m, acc, alive) {
    const want = accNorm(acc);
    let info = await chooserSettled(m, alive);
    if (!info) return { ok: false, why: 'danh sách người nhận chưa tải xong (hoặc còn đang thay đổi)' };
    const hits = info.rows.filter((r) => accNorm(r.acc) === want);
    if (hits.length !== 1)
      return {
        ok: false,
        why: hits.length ? `thấy ${hits.length} dòng tài khoản “${acc}”` : `không thấy tài khoản “${acc}” trong danh sách người nhận (${info.rows.length} dòng)`,
      };
    if (!shownEl(hits[0].tr)) return { ok: false, why: `dòng tài khoản “${acc}” đang bị ẩn (ô tìm kiếm đang lọc?)` };
    try {
      hits[0].tr.scrollIntoView({ block: 'nearest' });
    } catch (e) {}
    const onlyMine = () => {
      const mk = markedRows(info.rows);
      return mk.length === 1 && accNorm(mk[0].acc) === want;
    };
    // đã được chọn sẵn đúng dòng (vd. trang chọn sẵn tài khoản của bạn) → không bấm nữa (bấm lại có thể bỏ chọn)
    if (!onlyMine()) {
      (hits[0].accCell || hits[0].tr).click(); // bấm vào dòng như bạn bấm
      await waitUntil(() => {
        info = chooserInfo(m);
        return onlyMine();
      }, 5000, alive);
    }
    await sleep(500); // trang có thể vẽ lại bảng sau khi chọn
    info = chooserInfo(m);
    if (!onlyMine()) {
      const mk = markedRows(info.rows);
      const mine = info.rows.find((r) => accNorm(r.acc) === want);
      const td = mine && [...mine.tr.children].find((x) => x.tagName === 'TD');
      // dòng khác cũng có dấu chọn: lớp + mã ô STT của dòng đó (để chỉnh tiện ích)
      const other = mk.find((r) => accNorm(r.acc) !== want);
      const otd = other && [...other.tr.children].find((x) => x.tagName === 'TD');
      return {
        ok: false,
        why: `đã bấm vào dòng “${acc}” nhưng không thấy dấu chọn rõ ràng (✓ ở cột STT / màu xanh / lớp selectUser…) CHỈ ở dòng đó (${mk.length} dòng có dấu chọn${
          mk.length ? ': ' + mk.map((r) => `${r.acc} (mức ${rowMarkTier(r.tr)})`).join(', ') : ''
        }) – không bấm Thực thi`,
        // để báo lỗi / chỉnh tiện ích: lớp của dòng + mã ô STT (không có tên, số giấy tờ)
        diag:
          `dòng của bạn: mức ${mine ? rowMarkTier(mine.tr) : '-'}, lớp “${(mine && mine.tr.className) || ''}”, ô STT: ${td ? td.outerHTML.replace(/\s+/g, ' ').slice(0, 300) : '(không có)'}` +
          (other ? ` | dòng khác: lớp “${other.tr.className || ''}”, ô STT: ${otd ? otd.outerHTML.replace(/\s+/g, ' ').slice(0, 300) : '(không có)'}` : ''),
      };
    }
    return { ok: true, row: info.rows.find((r) => accNorm(r.acc) === want), step: info.step };
  }
  // lần cuối BẠN bấm / gõ trên trang (không tính bảng điền) – tiện ích không bấm nút quan trọng ngay lúc bạn đang thao tác
  const USER = { at: 0, btn: '', btnAt: 0, btnStep: '' };
  // nền ngoài cửa sổ (bấm vào đó là đóng cửa sổ ở nhiều trang)
  const OVERLAY_CLS = ['modal', 'modal-backdrop', 'ui-widget-overlay', 'k-overlay', 'swal2-container', 'layui-layer-shade'];
  // bạn tự Trả hồ sơ (Thực hiện / Đồng ý của cửa sổ Trả hồ sơ): nhớ để ghi ✓ Xong khi trang trả xong; ghi cả dấu “đang Trả hồ sơ” của TB đó
  // (trang tải lại giữa chừng thì lần tìm sau ở Danh sách hồ sơ thụ lý vẫn kết luận được – traGone)
  function userTraStart(so) {
    const l = so ? tbOfSo(so).list : [];
    const id = l.length === 1 ? String(l[0].tb) : '';
    S.userTra = { so, at: Date.now(), id };
    const s = id ? S.stage[id] || {} : null;
    if (s && !s.tra && !S.running) setMark(id, 'fwd', { k: 'tra', at: Date.now(), user: 1 });
  }
  // thôi chờ: 'cancel' (bạn bấm Không / Đóng / Esc) → bỏ dấu đang Trả hồ sơ của bạn; 'bad' (trang báo lỗi) → ghi dấu lỗi (không suy ra đã trả)
  function userTraEnd(how) {
    const u = S.userTra;
    S.userTra = null;
    const s = u && u.id ? S.stage[u.id] || {} : null;
    if (!s || !s.fwd || s.fwd.k !== 'tra' || !s.fwd.user) return;
    if (how === 'cancel') setMark(u.id, 'fwd', null);
    else if (how === 'bad') setMark(u.id, 'fwd', { ...s.fwd, bad: 'err' });
  }
  // bạn tự bấm “Thực thi” chuyển lãnh đạo (kể cả khi 🤖 tắt – rà lại 1.21.4): dấu “đang chuyển lãnh đạo” (◐) – trang chuyển xong thì ghi mốc
  function userLdStart(so) {
    const l = tbOfSo(so).list;
    if (l.length !== 1) return;
    const id = String(l[0].tb);
    if ((S.stage[id] || {}).ld) return;
    S.userLd = { id, at: Date.now() };
    setMark(id, 'fwd', { k: 'ld', at: Date.now(), user: 1 });
  }
  // (24/11) bạn tự bấm “Thực thi” chuyển hồ sơ mà lãnh đạo ĐÃ trả về sang bước khác “Trả kết quả (Tiếp theo)” (trả về lãnh đạo, bước trước, người
  // khác…) → dấu fwd 'oth': hồ sơ rời danh sách của bạn KHÔNG có nghĩa là đã trả – lượt tìm không tự tích ✓ TB đó (thấy lại hồ sơ thì bỏ dấu)
  function userOthStart(so) {
    const l = tbOfSo(so).list;
    if (l.length !== 1) return;
    const id = String(l[0].tb);
    const s = S.stage[id] || {};
    if (s.tra || !(traPhase(s) || s.kd)) return;
    setMark(id, 'fwd', { k: 'oth', at: Date.now(), user: 1 });
  }
  function userLdEnd(how) {
    const u = S.userLd;
    S.userLd = null;
    const s = u ? S.stage[u.id] || {} : null;
    if (!s || !s.fwd || s.fwd.k !== 'ld' || !s.fwd.user) return;
    if (how === 'cancel') setMark(u.id, 'fwd', null);
    else if (how === 'bad') setMark(u.id, 'fwd', { ...s.fwd, bad: 'err' });
  }
  const noteUserAct = (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (t === host || (t && t.closest && t.closest('#' + HOST_ID))) return;
    USER.at = Date.now();
    if (ATT.badge) stopNeed(); // bạn đã quay lại thao tác → tắt dấu “!” trên biểu tượng
    // phím: chỉ Enter / Space mới là bấm nút (Tab, Esc… lúc nút đang được chọn không tính là bấm)
    const key = e.type === 'keydown' ? String(e.key || '') : '';
    // Esc, hoặc bấm ra nền ngoài cửa sổ = đóng cửa sổ / hộp (tiện ích đang Trả hồ sơ: cửa sổ đóng vì bạn → không coi là đã trả)
    const closeAct = /^(Escape|Esc)$/.test(key) || (!key && t && t.classList && OVERLAY_CLS.some((c) => t.classList.contains(c)));
    if (closeAct) S.traCloseAt = Date.now();
    // bấm vào cửa sổ Trả hồ sơ (trừ nút Thực hiện / Đồng ý, ô Ghi chú) hoặc vào nút đóng kiểu khác (× / .close / data-dismiss…) → có thể bạn đóng cửa sổ
    if (!key && t && t.closest) {
      try {
        const tmC = traModal();
        const bt = t.closest('button, a, .btn');
        const inTra = !!tmC && tmC.contains(t) && !t.closest('textarea, input, select') && !(bt && /^(thuc hien|dong y|co|ok|xac nhan)$/.test(btnText(bt)));
        const closeEl = t.closest('.close, [data-dismiss], [data-bs-dismiss], [aria-label*="close" i], [aria-label*="đóng" i], .fa-times, .fa-close, .jconfirm-closeIcon');
        if (inTra || closeEl) S.traCloseAt = Date.now();
      } catch (e) {}
    }
    // đang chờ Trả hồ sơ / chuyển lãnh đạo bạn tự bấm: Esc / bấm ra nền → bạn thôi
    if (S.userTra && closeAct) userTraEnd('cancel');
    if (S.userLd && closeAct) userLdEnd('cancel');
    const b = key && !/^(Enter| |Spacebar)$/.test(key) ? null : t && t.closest && t.closest('button, a, .btn');
    if (b) {
      USER.btn = btnText(b);
      USER.btnAt = Date.now();
      if (/^(dong|khong|huy|thoat|bo qua|close|cancel|x|)$/.test(USER.btn)) S.traCloseAt = Date.now(); // nút đóng / hủy / ×
      // bạn tự bấm “Thực thi” ở cửa sổ chọn người → nhớ bước nhận của cửa sổ đó (tiện ích không bấm Thực thi lần nữa ở ĐÚNG bước này)
      USER.btnStep = '';
      if (USER.btn === 'thuc thi') {
        const cm = chooserModal();
        if (cm && cm.contains(b)) USER.btnStep = norm(chooserInfo(cm).step);
      }
      // Thực thi / Thực hiện / Đồng ý: nhớ số biên nhận của hồ sơ đang chọn lúc bấm (thả “chờ bạn bấm” đúng TB đó)
      // bạn tự bấm “Thực hiện” ở cửa sổ Trả hồ sơ → chờ trang xong để đánh dấu TB của hồ sơ đó ✓ Xong
      if (USER.btn === 'thuc hien') {
        const tmU = traModal();
        if (tmU && tmU.contains(b)) userTraStart(soSync() || (S.qtSeen && S.qtSeen.so) || '');
      }
      // Đồng ý ở hộp hỏi trả hồ sơ (cửa sổ Trả hồ sơ còn mở bên dưới) → cũng chờ để ghi ✓ Xong
      if (USER.btn === 'dong y' && traModal()) {
        const pd = pageDialog();
        // chỉ ĐÚNG hộp hỏi trả hồ sơ (“Bạn có thật sự muốn trả hồ sơ…?”) – hộp báo lỗi có chữ “trả hồ sơ” thì không
        if (pd && pd.box.contains(b) && TRA_Q_RE.test(norm(`${pd.title || ''} ${dlgBody(pd)}`)) && !dlgIsErr(pd))
          userTraStart((S.userTra && S.userTra.so) || soSync() || (S.qtSeen && S.qtSeen.so) || '');
      }
      USER.btnSo = '';
      if (/^(thuc thi|thuc hien|dong y)$/.test(USER.btn)) {
        const inWin = !!b.closest('.modal, [role="dialog"], .ui-dialog, .k-window, .bootbox, .swal2-popup, .jconfirm, .layui-layer');
        const qm = qtModal();
        const q = S.qtSeen && S.qtSeen.el && qm && S.qtSeen.el === qm && Date.now() - S.qtSeen.at < 30 * 60 * 1000 ? S.qtSeen.so : '';
        USER.btnSo = soSync() || (inWin ? q : '');
      }
      // bạn tự bấm “Thực thi” chuyển LÃNH ĐẠO (bước “… Lãnh đạo … (Tiếp theo)”) cho đúng 1 TB → dấu đang chuyển; trang chuyển xong → mốc ◐
      if (USER.btn === 'thuc thi' && !S.running && USER.btnSo && /lanh dao/.test(USER.btnStep) && /tiep theo/.test(USER.btnStep) && !/truoc|tra ve/.test(USER.btnStep))
        userLdStart(USER.btnSo);
      // hồ sơ lãnh đạo đã trả về mà bạn chuyển sang bước khác “Trả kết quả (Tiếp theo)” (kể cả chuyển lãnh đạo lần nữa) → dấu fwd 'oth'
      if (USER.btn === 'thuc thi' && !S.running && USER.btnSo && USER.btnStep && !(/tra ket qua/.test(USER.btnStep) && /tiep theo/.test(USER.btnStep)))
        userOthStart(USER.btnSo);
    }
    audioReady(); // tiếng “ting” dùng được sau khi bạn bấm (cả sau khi trang tải lại)
  };
  document.addEventListener('pointerdown', noteUserAct, true);
  document.addEventListener('keydown', noteUserAct, true);
  // (soát 24/11) lăn / rê chuột trên trang = bạn đang xem: chỉ dùng cho 🤖 tự làm tiếp / rời cửa sổ (không tính là bấm / gõ)
  const noteUserView = (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (t === host || (t && t.closest && t.closest('#' + HOST_ID))) return;
    USER.viewAt = Date.now();
  };
  document.addEventListener('wheel', noteUserView, { capture: true, passive: true });
  document.addEventListener('mousemove', noteUserView, { capture: true, passive: true });
  root.addEventListener('pointerdown', () => ATT.badge && stopNeed(), true);
  // bạn đang dùng bảng điền (bấm / gõ – trừ nút ▶ / 🤖) → 🤖 chưa tìm ở danh sách (20 giây): bảng điền không bị khóa lúc bạn đang dùng
  const notePanelAct = (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('#runAll, #autoBtn, #miniAuto')) return;
    S.panelAt = Date.now();
  };
  root.addEventListener('pointerdown', notePanelAct, true);
  root.addEventListener('keydown', notePanelAct, true);
  // ngay trước khi bấm Thực thi – KHÔNG có await giữa kiểm tra và bấm: đúng cửa sổ, đúng bước, CHỈ dòng tài khoản đó được chọn,
  // không có hộp hỏi, bạn không vừa thao tác / tự bấm Thực thi. Trả '' khi đã bấm, ngược lại là lý do không bấm
  function chooserFinalClick(m, acc, st) {
    if (!(m.isConnected && shownEl(m)) || chooserModal() !== m) return 'cửa sổ chọn người đã đổi / đã đóng';
    const info = chooserInfo(m);
    if (norm(info.step) !== st) return `bước nhận đã đổi thành “${info.step}”`;
    const mk = markedRows(info.rows);
    if (!(mk.length === 1 && accNorm(mk[0].acc) === accNorm(acc))) return 'dòng được chọn đã đổi';
    if (pageDialog()) return 'trang đang hiện hộp hỏi';
    if (Date.now() - USER.at < 2000) return 'bạn vừa bấm / gõ trên trang';
    // bạn đã tự bấm “Thực thi” ở cửa sổ chọn người của ĐÚNG bước này (60 giây) → không bấm lần nữa (tránh chuyển 2 lần).
    // Bạn tự bấm “Chuyển tiếp” để mở cửa sổ thì vẫn bấm Thực thi (ảnh 14: trước đây dừng “bạn vừa tự bấm Chuyển tiếp”)
    if (Date.now() - USER.btnAt < 60000 && USER.btn === 'thuc thi' && USER.btnStep && USER.btnStep === st) return 'bạn vừa tự bấm “Thực thi” ở bước này';
    const go = [...m.querySelectorAll('button, a')].find((b) => shownEl(b) && (b.id === 'btnExecuteCommand' || btnText(b) === 'thuc thi'));
    if (!go) return 'không thấy nút “Thực thi”';
    clickPage(go);
    return '';
  }
  // Số biên nhận ở nhãn “Số biên nhận” trên trang (ngoài cửa sổ con, ngoài bảng điền, bỏ link “Lấy lại thông tin biên nhận”).
  // Không lấy chữ “KH …” bất kỳ (danh sách thông báo, danh sách hồ sơ… có thể có số của hồ sơ khác)
  function labelDossierNumbers() {
    const SKIP = '.modal, [role="dialog"], .toast, #toast-container, .notifyjs-corner, .notifyjs-container, .jconfirm, .dropdown-menu, #' + HOST_ID;
    const KH = /KH\s*2959\.07777\.[\d.\-]+/i;
    const clean = (s) => s.replace(/\s+/g, ' ').replace(/[.\-]+$/, '').toUpperCase();
    const ok = (el) => !!el && !el.closest(SKIP) && shownEl(el);
    const textOfBox = (el) => {
      const c = el.cloneNode(true);
      c.querySelectorAll('#btnBindInfoLastBienNhan, a, button').forEach((x) => /lay lai thong tin bien nhan/.test(norm(x.textContent)) && x.remove());
      return (c.textContent || '').replace(/\s+/g, '');
    };
    const vals = new Set();
    for (const lab of document.querySelectorAll('label, span, div, td, th, b, strong, p, dt')) {
      if (lab.children.length > 1 || !/^so bien nhan$/.test(norm(lab.textContent).replace(/[:\s]+$/, '')) || !ok(lab)) continue;
      let hit = null;
      for (let sib = lab.nextElementSibling, k = 0; sib && k < 3 && !hit; sib = sib.nextElementSibling, k++)
        hit = KH.exec(khNorm(textOfBox(sib)).replace(/\s+/g, '').replace(/^KH/i, 'KH '));
      if (hit) vals.add(clean(hit[0]));
    }
    return [...vals];
  }
  // Số biên nhận của hồ sơ đang mở: ô “Số biên nhận” (màn hình hồ sơ) hoặc chữ ngay sau nhãn “Số biên nhận” (danh sách hồ sơ thụ lý)
  async function dossierSo() {
    let v = '';
    try {
      v = (await readField('Số biên nhận')) || '';
    } catch (e) {}
    if (!/KH\s*2959\.07777\.\d/i.test(v)) {
      const nums = labelDossierNumbers();
      v = nums.length === 1 ? nums[0] : '';
    }
    // Danh sách hồ sơ thụ lý (trang thật không có nhãn “Số biên nhận”): danh sách đang lọc còn ĐÚNG 1 hồ sơ → số của hồ sơ đó
    if (!v && onListPage()) {
      const rows = listDataRows();
      const nums = [...new Set(rows.map((r) => soKey(rowSo(r))).filter(Boolean))];
      if (rows.length === 1 || (rows.length > 1 && nums.length === 1)) v = rowSo(rows[0]);
      else if (S.listPick && Date.now() - S.listPick.at < 3 * 60 * 1000) {
        // danh sách có nhiều hồ sơ (trang tìm theo “chứa chữ”): CHỈ MỘT dòng đang được chọn và đó là dòng tiện ích vừa bấm (đúng số)
        const sel = rows.filter(rowSelected);
        if (sel.length === 1 && soKey(rowSo(sel[0])) === soKey(S.listPick.so)) v = rowSo(sel[0]);
      }
    }
    return String(v).replace(/\s+/g, ' ').replace(/[.\-]+$/, '').trim();
  }
  // TB có đúng bộ tờ.thửa của số biên nhận
  function tbOfSo(so) {
    const p = uniq(khPairs(so) || []);
    return { pairs: p, list: p.length ? S.data.filter((x) => sameSet(tbPairs(x), p)) : [] };
  }
  // dòng của hồ sơ trong “Danh sách hồ sơ thụ lý” (ảnh 7, 8): dòng bảng có số biên nhận đúng bộ tờ.thửa của TB
  // chữ của một dòng / khối để đọc số biên nhận: nối số bị xuống dòng sau dấu “-” / “.” (vd. “…255.198-⏎255.136”), gộp dấu cách
  function khText(el) {
    return khNorm((el && el.textContent) || '');
  }
  // bỏ ký tự ẩn (ngắt dòng mềm, khoảng trắng rộng 0…), đổi các loại gạch về “-”, nối số xuống dòng sau “-” / “.”, gộp dấu cách
  function khNorm(s) {
    return String(s || '')
      .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/([.\-])\s+(?=\d)/g, '$1')
      .replace(/\s+/g, ' ');
  }
  function listRowsOf(x) {
    const want = tbPairs(x);
    return listDataRows().filter((tr) => {
      const mm = /KH\s*2959\.07777\.[\d.\-]+/i.exec(khText(tr));
      return !!mm && sameSet(uniq(khPairs(mm[0]) || []), want);
    });
  }
  // TB đang ở chặng cuối (lãnh đạo trả về / bước Trả kết quả) có đúng MỘT dòng trên danh sách đang mở – chỉ khi đúng 1 TB như vậy
  function traListTb() {
    const c = S.data.filter((x) => {
      const st = S.stage[String(x.tb)];
      return traPhase(st) && !st.hoan && listRowsOf(x).length === 1;
    });
    return c.length === 1 ? c[0] : null;
  }
  // ---------- Danh sách hồ sơ thụ lý (thanh trái “Xử lý công việc”, ảnh 15–17): tìm hồ sơ theo Số biên nhận ----------
  // chữ gợi ý của ô nhập (chữ mờ / aria-label / title), đã bỏ dấu
  const inputHint = (i) => norm([i.placeholder, i.getAttribute('aria-label'), i.title].filter(Boolean).join(' '));
  // nút 🔍 cạnh ô tìm (trong 3 lớp khung bao quanh ô): biểu tượng search / tên “Tìm (kiếm)”
  function searchBtnNear(input) {
    for (let box = input.parentElement, k = 0; box && k < 3; box = box.parentElement, k++) {
      const b = [
        ...box.querySelectorAll('button, a, .btn, [role="button"], input[type="button"], input[type="submit"], .input-group-addon, .input-group-text'),
      ].find(
        (el) =>
          el !== input &&
          !el.contains(input) &&
          shownEl(el) &&
          (!!el.querySelector('.fa-search, .glyphicon-search, .icon-search, [class*="fa-search"]') ||
            /(^|\s)(fa-search|glyphicon-search)(\s|$)/.test(el.className || '') ||
            /^tim( kiem)?$/.test(norm(el.title || el.getAttribute('aria-label') || el.value || el.textContent || '')))
      );
      if (b) return b;
    }
    return null;
  }
  // ô tìm “Số biên nhận” của Danh sách hồ sơ thụ lý: chữ mờ CÓ “số biên nhận” (ngoài cửa sổ con, ngoài bảng điền).
  // Nhiều ô như vậy → ô có nút 🔍 bên cạnh (đúng 1 ô)
  function sbnSearch() {
    const ins = [...document.querySelectorAll('input')]
      .filter(
        (i) =>
          /^(text|search|)$/.test(i.type || '') &&
          !i.closest('#' + HOST_ID) &&
          !i.closest('.modal, [role="dialog"]') &&
          /so bien nhan/.test(inputHint(i)) &&
          shownEl(i)
      )
      .map((input) => ({ input, btn: searchBtnNear(input) }));
    if (ins.length === 1) return ins[0];
    const withBtn = ins.filter((x) => x.btn);
    if (withBtn.length === 1) return withBtn[0];
    if (ins.length) return null;
    // chữ gợi ý của ô tìm không có “số biên nhận” → ô chữ có nút 🔍 cạnh, nằm TRÊN bảng danh sách hồ sơ (không phải ô tìm ở thanh trên cùng)
    const box = listBox();
    if (!box) return null;
    const top = box.getBoundingClientRect().top;
    const near = [...document.querySelectorAll('input')]
      .filter(
        (i) =>
          /^(text|search|)$/.test(i.type || '') &&
          !i.closest('#' + HOST_ID) &&
          !i.closest('.modal, [role="dialog"], header, nav, .navbar, .main-header, aside, .sidebar, .main-sidebar, .left-side, [class*="sidebar"]') &&
          shownEl(i) &&
          i.getBoundingClientRect().bottom <= top + 5
      )
      .map((input) => ({ input, btn: searchBtnNear(input) }))
      .filter((x) => x.btn);
    return near.length === 1 ? near[0] : null;
  }
  // màn hình hồ sơ / tiếp nhận: có nhãn “Người nộp hồ sơ” đang hiện (trang danh sách thì không)
  const hasNguoiNopLabel = () =>
    [...document.querySelectorAll('label')].some(
      (l) => !l.closest('#' + HOST_ID) && !l.closest('.modal, [role="dialog"]') && /^nguoi nop ho so\b/.test(norm(l.textContent || '')) && shownEl(l)
    );
  // đang ở trang Danh sách hồ sơ thụ lý: có ô tìm “Số biên nhận”, KHÔNG có nhãn “Người nộp hồ sơ”, và có nút “Xử lý hồ sơ”
  // (hoặc cột “Thông tin hồ sơ” / tiêu đề “Danh sách hồ sơ thụ lý”)
  function onListPage() {
    if (hasNguoiNopLabel()) return false;
    // không có ô tìm nhận ra được → vẫn là trang danh sách nếu có bảng danh sách hồ sơ (cột Thông tin hồ sơ / biên nhận / luân chuyển) + nút Xử lý hồ sơ
    if (!sbnSearch()) return !!listBox() && !!btnXuLyHoSo();
    if (btnXuLyHoSo()) return true;
    return [...document.querySelectorAll('th, thead td, [role="columnheader"], h1, h2, h3, h4, .page-title, .content-header, header span, .navbar span')].some(
      (el) => !el.closest('#' + HOST_ID) && /^(thong tin ho so|danh sach ho so thu ly)$/.test(norm(el.textContent || '')) && shownEl(el)
    );
  }
  // bảng danh sách hồ sơ: hàng tiêu đề có cột “Thông tin hồ sơ” + “Thông tin biên nhận” / “Thông tin luân chuyển” (ảnh 22/11).
  // DataTables cuộn (tiêu đề, thân là 2 bảng riêng) → bảng thân. Không thấy → null (tìm dòng trên cả trang như trước)
  function listBox() {
    const c = S.listBoxCache;
    if (c && Date.now() - c.at < 1500 && (!c.el || c.el.isConnected)) return c.el;
    const el = findListBox();
    S.listBoxCache = { at: Date.now(), el };
    return el;
  }
  function findListBox() {
    // trang thật (bản ghi thao tác 22/11): bảng danh sách hồ sơ thụ lý là table#tblTraCuuHoSoTiepNhan (tiêu đề cột là thanh div riêng)
    const real = document.getElementById('tblTraCuuHoSoTiepNhan');
    if (real && shownEl(real) && !real.closest('#' + HOST_ID)) return real;
    const ok = (h) => !h.closest('#' + HOST_ID) && !h.closest('.modal, [role="dialog"]') && /^thong tin ho so$/.test(norm(h.textContent || '').trim()) && shownEl(h);
    const boxOf = (h) => {
      const hr = h.closest('tr, [role="row"]');
      if (!hr || !/thong tin (bien nhan|luan chuyen)/.test(norm(hr.textContent || ''))) return null;
      const t = h.closest('table, [role="grid"], [role="table"]');
      if (!t) return null;
      const w = t.closest('.dataTables_scrollHead') ? t.closest('.dataTables_scroll, .dataTables_wrapper') : null;
      const body = w && w.querySelector('.dataTables_scrollBody table');
      return body || t;
    };
    for (const h of document.querySelectorAll('th, thead td, [role="columnheader"]')) {
      const b = ok(h) && boxOf(h);
      if (b) return b;
    }
    // tiêu đề cột không phải th (vd. hàng tiêu đề là td trong tbody) → ô td có đúng chữ “Thông tin hồ sơ”
    for (const h of document.querySelectorAll('td')) {
      const b = h.children.length <= 1 && ok(h) && boxOf(h);
      if (b) return b;
    }
    return null;
  }
  // dòng nhãn – giá trị “Số biên nhận | KH …” (khung Thông tin hồ sơ bên phải), không phải dòng hồ sơ của danh sách.
  // (trang thật 23/11: nhãn và số dính liền “Số biên nhậnKH 2959…” → trước đây bị tính là dòng hồ sơ thứ 2)
  function isLabelRow(r) {
    if (/^so bien nhan/.test(norm(r.textContent || '').trim())) return true;
    return [...r.querySelectorAll('td, th, dt, dd, label, span, div, b, strong, p')].some(
      (e) => e.children.length <= 1 && /^so bien nhan\s*:?$/.test(norm(e.textContent || '').trim())
    );
  }
  // các dòng cùng ĐÚNG một số biên nhận: cùng MỘT hồ sơ hiện 2 lần (bảng cố định cột, dòng chi tiết…) → giữ dòng chính (nhiều ô nhất);
  // ngày giờ tiếp nhận khác nhau → 2 hồ sơ thật trùng số → giữ cả (tiện ích không chọn)
  function groupSame(ex) {
    if (ex.length <= 1) return ex;
    const tnOf = (r) => ((/tiep nhan:?\s*(\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2})?)/.exec(norm(r.textContent || '')) || [])[1] || '').trim();
    if (new Set(ex.map(tnOf).filter(Boolean)).size > 1) return ex;
    const cellsOf = (r) => r.querySelectorAll('td, [role="gridcell"], [role="cell"]').length;
    return [ex.slice().sort((a, b) => cellsOf(b) - cellsOf(a) || (b.textContent || '').length - (a.textContent || '').length)[0]];
  }
  // dòng của hồ sơ có ĐÚNG số biên nhận này (đã gộp bản lặp của cùng hồ sơ)
  const exactRows = (want) => groupSame(listDataRows().filter((r) => soKey(rowSo(r)) === want));
  // các dòng hồ sơ đang hiện của danh sách: dòng bảng (tr) / [role=row] (không thấy bảng danh sách thì cả li / khối item) có số biên nhận KH …
  // – lấy khối trong cùng; bỏ dòng nhãn “Số biên nhận …” (khung Thông tin hồ sơ bên phải), danh sách thông báo (menu thả xuống)
  function listDataRows() {
    const pick = (root, sel) => {
      const cand = [...root.querySelectorAll(sel)].filter(
        (r) =>
          !r.closest('#' + HOST_ID) &&
          !r.closest('.modal, [role="dialog"], thead, .toast, #toast-container, .dropdown-menu') &&
          /KH\s*2959\.07777\.\d/i.test(khText(r)) &&
          shownEl(r) &&
          !isLabelRow(r)
      );
      return cand.filter((r) => !cand.some((o) => o !== r && r.contains(o)));
    };
    const box = listBox();
    // bảng danh sách có dòng (kể cả dòng “Không có dữ liệu”) → chỉ lấy dòng của bảng đó
    if (box && box.querySelector('tbody tr')) return pick(box, 'tbody tr, [role="row"]');
    // không thấy bảng / bảng chỉ có tiêu đề (thân bảng nằm chỗ khác) → tìm trên cả trang như trước
    return pick(document, 'tbody tr, [role="row"], li, .list-group-item, .item');
  }
  // để báo lỗi khi tiện ích không nhận ra trang danh sách: ô nhập có chữ gợi ý, tên cột, nút Xử lý hồ sơ, số dòng có số KH (không có tên / giấy tờ)
  function listDiag() {
    const vis = (el) => !el.closest('#' + HOST_ID) && shownEl(el);
    const ins = [...document.querySelectorAll('input')]
      .filter((i) => vis(i) && /^(text|search|)$/.test(i.type || '') && inputHint(i))
      .slice(0, 6)
      .map((i) => `${i.id ? '#' + i.id : i.name ? '[' + i.name + ']' : 'ô'} “${(i.placeholder || i.getAttribute('aria-label') || i.title || '').slice(0, 30)}”${searchBtnNear(i) ? ' +🔍' : ''}`);
    const heads = [...document.querySelectorAll('th, thead td, [role="columnheader"]')]
      .filter(vis)
      .slice(0, 6)
      .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24));
    const rowsKH = listDataRows();
    const rowInfo = rowsKH
      .slice(0, 3)
      .map((r) => {
        const cls = typeof r.className === 'string' ? r.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
        return `${r.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${r.children.length} ô: ${rowSo(r) || '(không đọc được)'}`;
      })
      .join(' | ');
    return `dòng có số KH: ${rowsKH.length}${rowInfo ? ` (${rowInfo})` : ''}; ô nhập: ${ins.join(', ') || '(không có)'}; cột: ${heads.join(' | ') || '(không có)'}; nút Xử lý hồ sơ: ${btnXuLyHoSo() ? 'có' : 'không'}; nhãn Người nộp: ${
      hasNguoiNopLabel() ? 'có' : 'không'
    }; bảng danh sách: ${(() => {
      const b = listBox();
      return b ? `${b.tagName.toLowerCase()} ${b.querySelectorAll('tbody tr').length} dòng` : 'không thấy';
    })()}; trang: ${location.pathname}`;
  }
  const rowSo = (tr) => {
    const m = /KH\s*2959\.07777\.[\d.\-]+/i.exec(khText(tr));
    return m ? m[0].replace(/[.\-]+$/, '') : '';
  };
  // gõ vào ô của trang (như bạn gõ): giá trị + sự kiện input / change / keyup
  function typeInto(el, v) {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    try {
      el.focus();
    } catch (e) {}
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
  }
  function pressEnter(el) {
    for (const t of ['keydown', 'keypress', 'keyup'])
      el.dispatchEvent(new KeyboardEvent(t, { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
  }
  // gõ Số biên nhận của TB vào ô tìm → bấm 🔍 (không có nút thì Enter) → chờ ≤ 6 giây danh sách còn ĐÚNG 1 hồ sơ và đó là hồ sơ của TB
  // số biên nhận so CẢ CHUỖI (bỏ dấu cách, không phân biệt hoa / thường, bỏ dấu chấm / gạch cuối)
  const soKey = (v) => khNorm(v).replace(/\s+/g, '').replace(/[.\-]+$/, '').toUpperCase();
  // danh sách đang tải (DataTables “Đang xử lý…”, lớp phủ chờ, dòng “Đang tải…”)
  function listLoading() {
    const vis = (el) => !el.closest('#' + HOST_ID) && shownEl(el);
    if ([...document.querySelectorAll('.dataTables_processing, .blockUI, .blockOverlay, .loading-mask, .k-loading-mask')].some(vis)) return true;
    const b0 = listBox();
    const box = b0 && b0.querySelector('tbody tr') ? b0 : null; // bảng chỉ có tiêu đề (thân bảng nằm chỗ khác) → xét cả trang
    if (box && [...box.querySelectorAll('.loading, .loader, .spinner')].some(vis)) return true;
    // dòng chờ của bảng: dòng CHỈ có 1 ô “Đang tải… / Đang xử lý… / Loading…” (ô trạng thái của hồ sơ thì không tính)
    return [...(box || document).querySelectorAll('tbody tr')].some((tr) => {
      if (!vis(tr)) return false;
      const tds = [...tr.children].filter((c) => shownEl(c));
      return tds.length === 1 && /^(dang tai|dang xu ly|loading)/.test(norm(tds[0].textContent || '').trim());
    });
  }
  // danh sách đang tải – dấu chờ còn hiện liền quá 6 giây (trang quên tắt) thì coi như đã tải xong
  function listBusy() {
    if (!listLoading()) {
      S.busySince = 0;
      return false;
    }
    if (!S.busySince) S.busySince = Date.now();
    return Date.now() - S.busySince < 6000;
  }
  // trang đang xử lý: dấu tải của danh sách / lớp phủ chờ (blockUI…), hoặc chữ “Đang xử lý…” nổi giữa trang (khung cố định / tuyệt đối – trang thật
  // 23/11: bấm Thực hiện Trả hồ sơ, cửa sổ vẫn mở, giữa trang hiện “Đang xử lý...”). Chữ “Đang xử lý” trong bảng / nhãn / nút / tab thì không tính
  function pageWorking() {
    // dấu tải của danh sách / lớp phủ chờ: còn hiện liền quá 20 giây (trang quên tắt) thì thôi tính
    let ind = false;
    try {
      ind = listLoading();
    } catch (e) {}
    if (ind) {
      if (!S.pwSince) S.pwSince = Date.now();
      if (Date.now() - S.pwSince < 20000) return true;
    } else S.pwSince = 0;
    try {
      const xp = document.evaluate(
        "//body//text()[not(ancestor::td or ancestor::th or ancestor::tr or ancestor::script or ancestor::style or ancestor::option)][starts-with(normalize-space(.), 'Đang xử lý') or starts-with(normalize-space(.), 'ĐANG XỬ LÝ') or starts-with(normalize-space(.), 'đang xử lý')]",
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < Math.min(xp.snapshotLength, 40); i++) {
        const tn = xp.snapshotItem(i);
        const t = norm(tn.nodeValue || '');
        if (!/^dang xu ly\b/.test(t) || t.length > 30) continue;
        const el = tn.parentElement;
        if (!el || el.closest('#' + HOST_ID) || el.closest('td, th, tr, select, option, label, a, button, [role="tab"], .nav, .nav-tabs') || !seenEl(el)) continue;
        for (let p = el, k = 0; p && p !== document.body && k < 8; p = p.parentElement, k++) {
          const pos = getComputedStyle(p).position;
          if (pos === 'fixed' || pos === 'absolute') {
            // (soát 24/11) chữ “Đang xử lý…” hiện liền quá 60 giây (nhãn tĩnh của trang?) → thôi tính là trang đang xử lý
            if (!S.pwTextSince) S.pwTextSince = Date.now();
            return Date.now() - S.pwTextSince < 60000;
          }
        }
      }
    } catch (e) {}
    S.pwTextSince = 0;
    return false;
  }
  // phần tử nhìn thấy thật: có kích thước, nằm trong màn hình, không ẩn / trong suốt (cả khung cha)
  function seenEl(el) {
    if (!shownEl(el)) return false;
    const rc = el.getBoundingClientRect();
    if (rc.right <= 0 || rc.bottom <= 0 || rc.left >= innerWidth || rc.top >= innerHeight) return false;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }
  // thanh lọc của Danh sách hồ sơ thụ lý (Tất cả / Quá hạn xử lý / Đang chờ bổ sung…): 'all' – đang ở “Tất cả” (hoặc trang không có thanh lọc),
  // 'other' – đang lọc mục khác, '?' – không rõ mục nào đang chọn. Chỉ 'all' mới được coi “không thấy hồ sơ” là hồ sơ đã rời danh sách
  function listTabState() {
    const isAct = (el) =>
      !!el && el.nodeType === 1 && (/(^|\s)(active|selected|current|checked)(\s|$)/i.test(typeof el.className === 'string' ? el.className : '') || el.getAttribute('aria-selected') === 'true' || !!el.getAttribute('aria-current'));
    const alls = [...document.querySelectorAll('a, li, button, span, label')].filter(
      (el) => !el.closest('#' + HOST_ID) && /^tat ca$/.test(norm(el.textContent || '').replace(/\(\s*\d+\s*\)/g, '').trim()) && shownEl(el)
    );
    let best = null;
    for (const el of alls) {
      const item = el.closest('li') || el;
      const sib = [...(item.parentElement ? item.parentElement.children : [])].filter((c) => shownEl(c) && norm(c.textContent || '').trim());
      if (sib.length >= 3 && (!best || sib.length > best.sib.length)) best = { item, sib };
    }
    if (!best) return 'all';
    const act = best.sib.filter((c) => isAct(c) || [...c.querySelectorAll('a, button, span')].some(isAct));
    if (act.length === 1) return act[0] === best.item ? 'all' : 'other';
    if (act.length > 1) return '?';
    // không có lớp / thuộc tính chọn: mục có màu chữ / đậm / gạch chân (gạch chữ, viền dưới, bóng, vạch ::after) / nền KHÁC hẳn các mục còn lại
    // là mục đang chọn (trang thật 23/11: “Tất cả” đang chọn có gạch chân)
    const sig = (c) => {
      const a = c.querySelector('a, button') || c;
      const s1 = getComputedStyle(a);
      const s2 = getComputedStyle(c);
      let af = '';
      try {
        const p = getComputedStyle(a, '::after');
        if (p.content && p.content !== 'none') af = [p.borderBottomWidth, p.borderBottomColor, p.backgroundColor, p.height, p.width].join('/');
      } catch (e) {}
      return [
        s1.color, s1.fontWeight, s1.textDecorationLine, s1.borderBottomWidth, s1.borderBottomColor, s1.backgroundColor, s1.boxShadow,
        s2.borderBottomWidth, s2.borderBottomColor, s2.backgroundColor, s2.boxShadow, af,
      ].join('|');
    };
    const sigs = best.sib.map(sig);
    const uniq = best.sib.filter((c, i) => sigs.filter((x) => x === sigs[i]).length === 1);
    if (uniq.length === 1) return uniq[0] === best.item ? 'all' : 'other';
    return '?';
  }
  // gõ Số biên nhận của TB vào ô tìm → bấm 🔍 (không có nút thì Enter) → CHẬM: chờ trang tải xong, danh sách còn ĐÚNG 1 hồ sơ và ô thông tin hồ sơ
  // của dòng đó có ĐÚNG số biên nhận vừa gõ, đọc lại sau 0,8 giây vẫn vậy (danh sách đã ổn định) – mới trả dòng đó (bạn yêu cầu: chậm lại, ra đúng hồ sơ
  // giống số biên nhận rồi mới bấm)
  async function searchList(x, alive) {
    const sb = sbnSearch();
    if (!sb) return { err: 'không thấy ô tìm “Số biên nhận” của Danh sách hồ sơ thụ lý' };
    const want = String(x.soBienNhan || '').replace(/\s+/g, ' ').trim();
    if (!want) return { err: `TB ${x.tb} chưa có số biên nhận trong dữ liệu` };
    typeInto(sb.input, want);
    S.sweepTyped = sb.input.value; // chữ tiện ích gõ (ô tìm có chữ khác = bạn gõ → 🤖 chờ lâu hơn, không gõ đè ngay)
    await sleep(500);
    // danh sách có tải lại sau cú tìm này không (bảng đổi / có dấu đang tải) – bảng cũ còn nằm đó (trang chưa tìm / tìm lỗi) thì “trống” không có giá trị
    const box0 = listBox();
    let moved = false;
    let mo = null;
    try {
      if (box0) {
        mo = new MutationObserver(() => (moved = true));
        mo.observe(box0, { childList: true, subtree: true, characterData: true });
      }
    } catch (e) {}
    const d0 = pageDialog(); // hộp của trang đang mở trước cú tìm – hộp MỚI hiện sau cú tìm (trang báo lỗi jconfirm…) = lần tìm hỏng
    const clickAt = Date.now();
    if (sb.btn) clickPage(sb.btn);
    else pressEnter(sb.input);
    S.busySince = 0; // lần tìm mới – “đang tải” tính lại từ đầu
    try {
    await sleep(1500); // cho trang bắt đầu tải danh sách
    const t0 = Date.now();
    let prev = null;
    let none = 0;
    let dupN = 0;
    let sawBusy = false;
    while (Date.now() - t0 < 12000 * slowK()) {
      if (!alive()) return { row: null };
      const busy = listBusy();
      const working = pageWorking();
      if (busy || working) sawBusy = true;
      if (!moved && (listBox() !== box0 || (box0 && !box0.isConnected))) moved = true; // trang thay bảng mới
      // trang báo lỗi sau cú tìm → lần tìm này không có giá trị (không kết luận gì)
      if (toastsSince(clickAt).some(toastBad)) return { row: null, failed: true };
      const pd = pageDialog();
      if (pd && (!d0 || pd.box !== d0.box)) return { row: null, failed: true };
      const rows = busy ? [] : listDataRows();
      // dòng có ĐÚNG số biên nhận đã gõ (cả chuỗi). Trang tìm theo “chứa chữ” có thể ra thêm hồ sơ số dài hơn
      // (vd. …237.51 và …237.51-237.50): bỏ qua các dòng đó, chỉ nhận khi có đúng MỘT dòng đúng số
      const exact = groupSame(rows.filter((r) => soKey(rowSo(r)) === soKey(want)));
      const r = !busy && exact.length === 1 ? exact[0] : null;
      if (r && r === prev && r.isConnected) return { row: r, many: rows.length > 1 }; // 2 lần đọc liền nhau vẫn đúng dòng đó
      prev = r;
      // danh sách đã tải lại cho lần tìm này, hết dấu tải / “Đang xử lý”, trống 3 lần đọc liền (≈ 2,4 giây) → chưa có hồ sơ này
      none = (moved || sawBusy) && !listLoading() && !working && !rows.length ? none + 1 : 0;
      if (none >= 3) {
        const sb1 = sbnSearch();
        // fresh: BẢNG danh sách đổi / được thay sau cú tìm (dấu đang tải không thôi chưa đủ – dòng “Không tìm thấy” cũ của TB trước có thể còn nằm đó);
        // emptyShown: dòng một ô “Không tìm thấy hồ sơ nào” / “Không có dữ liệu” NGAY TRONG bảng (trang thật 24/11) – chữ ở chỗ khác không tính
        return { row: null, none: true, fresh: moved, emptyShown: listEmptyShown(), typed: !!sb1 && soKey(sb1.input.value) === soKey(want) };
      }
      // nhiều hồ sơ cùng ĐÚNG số (ngày tiếp nhận khác nhau – trùng hồ sơ thật), đọc 2 lần liền vẫn vậy → báo, không chọn
      dupN = !busy && exact.length > 1 ? dupN + 1 : 0;
      if (dupN >= 2) return { row: null, dup: exact.length };
      await sleep(800);
    }
    return { row: null };
    } finally {
      try {
        if (mo) mo.disconnect();
      } catch (e) {}
    }
  }
  // bấm vào một ô CHỮ của dòng (không bấm link số biên nhận / nút / ô nhập): như bạn bấm chuột (nhấn – nhả – bấm).
  // how: 'plain' (ô chữ dài nhất) | 'first' (ô đầu dòng – cột #) | 'row' (chính dòng)
  function clickRowCell(row, how = 'plain') {
    const cells = [...row.children].filter((c) => shownEl(c));
    const plain = cells.filter((c) => !c.querySelector('a, button, input, select, textarea'));
    const cell =
      how === 'row'
        ? row
        : how === 'first'
        ? cells[0] || row
        : plain.sort((a, b) => (b.textContent || '').trim().length - (a.textContent || '').trim().length)[0] || cells[cells.length - 1] || row;
    const rc = cell.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: rc.left + Math.min(12, rc.width / 2), clientY: rc.top + Math.min(12, rc.height / 2) };
    try {
      cell.dispatchEvent(new PointerEvent('pointerdown', o));
    } catch (e) {}
    cell.dispatchEvent(new MouseEvent('mousedown', o));
    try {
      cell.dispatchEvent(new PointerEvent('pointerup', o));
    } catch (e) {}
    cell.dispatchEvent(new MouseEvent('mouseup', o));
    cell.dispatchEvent(new MouseEvent('click', o));
  }
  // trang bắt đầu chuyển (link vừa bấm có tác dụng) – để biết cú bấm đường link có làm trang chuyển không
  window.addEventListener('beforeunload', () => {
    S.leaving = Date.now();
    tplFlush(); // tab Trường: tích / giá trị vừa đổi chưa kịp lưu → lưu ngay trước khi trang chuyển
  });
  window.addEventListener('pagehide', () => {
    tplFlush();
    saveTplLast(); // giờ bạn thao tác / mẫu tự chạy gần nhất – trang mới (cùng tab) vẫn chống lặp được
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') tplFlush();
  });
  // bấm đường link chuyển trang (Xử lý công việc, Tiếp nhận hồ sơ, Về trang tiếp nhận…). Link có địa chỉ thật (cùng trang web) → mở địa chỉ đó
  // NGAY TRONG TAB NÀY (location.assign): không bị trình duyệt chặn như mở tab mới khi không có người bấm (trang thật 22/11: 🤖 bấm
  // “Xử lý công việc” mà trang không chuyển, bạn bấm ▶ thì chuyển). Không có địa chỉ (javascript:, #) → bấm như chuột (nhấn – nhả – bấm).
  // Trả cách đã dùng: 'url' | 'href' | 'click'
  function goLink(el) {
    if (!el) return '';
    if (el.byUrl) {
      el.click();
      return 'url';
    }
    const a = el.tagName === 'A' ? el : (el.querySelector && el.querySelector('a[href]')) || (el.closest && el.closest('a[href]')) || null;
    const raw = a ? (a.getAttribute('href') || '').trim() : '';
    if (raw && !/^(#|javascript:)/i.test(raw)) {
      try {
        const u = new URL(raw, location.href);
        if (/^https?:$/.test(u.protocol) && u.origin === location.origin && u.href !== location.href) {
          location.assign(u.href);
          return 'href';
        }
      } catch (e) {}
    }
    const t = a || el;
    const rc = t.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: rc.left + Math.min(10, rc.width / 2), clientY: rc.top + Math.min(10, rc.height / 2) };
    try {
      t.dispatchEvent(new PointerEvent('pointerdown', o));
    } catch (e) {}
    t.dispatchEvent(new MouseEvent('mousedown', o));
    try {
      t.dispatchEvent(new PointerEvent('pointerup', o));
    } catch (e) {}
    t.dispatchEvent(new MouseEvent('mouseup', o));
    t.click();
    return 'click';
  }
  // để báo lỗi khi bấm đường link mà trang không chuyển: thẻ, địa chỉ link, target, onclick (không có tên, giấy tờ)
  function navDiag(el, how) {
    if (!el) return 'không có mục để bấm';
    if (el.byUrl) return `cách bấm: ${how} (địa chỉ đã nhớ); trang: ${location.pathname}`;
    const a = el.tagName === 'A' ? el : (el.querySelector && el.querySelector('a[href]')) || (el.closest && el.closest('a[href]')) || null;
    const at = (x, k) => String((x && x.getAttribute(k)) || '').slice(0, 90);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return `cách bấm: ${how}; thẻ ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}; ${
      a ? `link href="${at(a, 'href')}" target="${at(a, 'target')}" onclick: ${a.hasAttribute('onclick') ? 'có' : 'không'}; data-toggle="${at(a, 'data-toggle') || at(a, 'data-bs-toggle')}"` : 'không có thẻ a'
    }; trang: ${location.pathname}${(location.hash || '').slice(0, 40)}`;
  }
  // địa chỉ trang Danh sách hồ sơ thụ lý (tiện ích đã gặp) – đi thẳng tới khi link “Xử lý công việc” không chuyển được trang
  function noteListUrl() {
    const u = location.href;
    if (S.listUrl === u) return;
    S.listUrl = u;
    safeSet({ tbListUrl: u });
  }
  // thanh bên trái: mục “Tiếp nhận hồ sơ” là ĐƯỜNG LINK thật (có địa chỉ trang) – nút mở menu con (▾) thì không dùng
  function navTiepNhan() {
    const as = [...document.querySelectorAll('a')].filter(
      (a) =>
        !a.closest('#' + HOST_ID) &&
        !a.closest('.modal, [role="dialog"]') &&
        /^tiep nhan ho so$/.test(norm(a.textContent || '')) &&
        /^(https?:|\/)/i.test(a.getAttribute('href') || '') &&
        shownEl(a)
    );
    if (as.length === 1) return as[0];
    // mục thanh trái chỉ mở menu con (▾) → địa chỉ màn hình Tiếp nhận hồ sơ (trống) tiện ích đã gặp, cùng trang web
    try {
      const u = S.recvUrl ? new URL(S.recvUrl, location.href) : null;
      if (u && u.origin === location.origin && u.href !== location.href) return { click: () => location.assign(u.href), byUrl: true };
    } catch (e) {}
    return null;
  }
  // thanh bên trái: “Xử lý công việc” (ảnh 17) → trang Danh sách hồ sơ thụ lý
  function navXuLyCongViec() {
    const as = [...document.querySelectorAll('a, li, [role="menuitem"], [role="link"]')].filter(
      (a) =>
        !a.closest('#' + HOST_ID) &&
        !a.closest('.modal, [role="dialog"]') &&
        /^xu ly cong viec( \(?\d+\)?)?$/.test(norm(a.textContent || '')) &&
        shownEl(a)
    );
    // thẻ trong cùng (li chứa a cùng chữ → lấy a)
    const inner = as.filter((a) => !as.some((o) => o !== a && a.contains(o)));
    if (inner.length === 1) return inner[0];
    // nhiều chỗ có chữ này (menu + đường dẫn trang…) → chỗ ở thanh menu bên trái
    const side = inner.filter((a) => a.closest('nav, aside, .sidebar, .main-sidebar, .sidebar-menu, .page-sidebar, .left-side, [class*="sidebar"], [class*="menu"]'));
    if (side.length === 1) return side[0];
    return listUrlLink();
  }
  // địa chỉ Danh sách hồ sơ thụ lý đã nhớ (cùng trang web, khác trang đang mở) → “link” đi thẳng tới đó
  function listUrlLink() {
    try {
      const u = S.listUrl ? new URL(S.listUrl, location.href) : null;
      if (u && u.origin === location.origin && u.href !== location.href) return { click: () => location.assign(u.href), byUrl: true };
    } catch (e) {}
    return null;
  }
  // TB còn phải xử lý trên VBDLIS (bạn yêu cầu 22/11): “◐ Đã tiếp nhận” mà chưa xong (đang chờ lãnh đạo trả về, nhập đơn dở…)
  // + TB đang ở chặng cuối (lãnh đạo đã trả về / Trả kết quả) chưa trả hồ sơ. Bỏ TB tạm hoãn, TB đang tạm giữ, TB chưa có số biên nhận,
  // TB tìm đã mở mà chưa có gì mới (S.sweepSeen – tránh mở đi mở lại). Chặng cuối làm trước
  // TB 🤖 đang làm dở ngoài TB đang chọn (mở từ Danh sách hồ sơ thụ lý): trang tải lại giữa chừng vẫn nhận ra, làm tiếp TB đó (30 phút)
  function chainTbId() {
    const c = S.chainTb;
    return c && Date.now() - (c.at || 0) < 30 * 60 * 1000 ? String(c.tb) : '';
  }
  function setChainTb(id) {
    S.chainTb = id == null ? null : { tb: String(id), at: Date.now() };
    try {
      if (S.chainTb) sessionStorage.setItem('vbdlis-dien-nhanh-chain', JSON.stringify(S.chainTb));
      else sessionStorage.removeItem('vbdlis-dien-nhanh-chain');
    } catch (e) {}
  }
  // TB 🤖 được tự làm tiếp: TB đang chọn hoặc TB 🤖 mở từ danh sách đang làm dở
  function isWorkTb(id) {
    return String(id) === String(S.recv) || (!!chainTbId() && String(id) === chainTbId());
  }
  // ■ Dừng → 🤖 tạm dừng tìm ở danh sách (giữ qua tải lại trang) tới khi bạn bấm ▶ / bật lại 🤖
  function setSweepPause(on) {
    S.sweepPause = !!on;
    try {
      if (on) sessionStorage.setItem('vbdlis-dien-nhanh-sweeppause', '1');
      else sessionStorage.removeItem('vbdlis-dien-nhanh-sweeppause');
    } catch (e) {}
  }
  // địa chỉ màn hình Tiếp nhận hồ sơ (trống) – để 🤖 tự sang tiếp nhận TB sau khi thanh trái không có đường link thật
  function noteRecvUrl() {
    const u = location.href;
    if (S.recvUrl === u) return;
    S.recvUrl = u;
    safeSet({ tbRecvUrl: u });
  }
  // TB chưa tiếp nhận tiếp theo cho 🤖: TB đang chọn (con trỏ tiếp nhận) nếu còn “Chưa làm”, chưa bấm Lưu hồ sơ; không thì TB chưa làm phía sau
  function recvNext() {
    const ok = (x) => !!x && stageOf(x) === 'chua' && !(S.stage[String(x.tb)] || {}).tnClick && !S.autoHold.has(String(x.tb));
    const c = recvTB(); // (25/11) con trỏ tiếp nhận – không phải TB đang hiện (TB ở trên chạy theo 🤖)
    if (ok(c)) return c;
    for (let j = S.data.indexOf(c) + 1; j < S.data.length; j++) if (ok(S.data[j])) return S.data[j];
    return null;
  }
  // màn hình Tiếp nhận có chữ bạn đã gõ (người nộp, giấy tờ, điện thoại, email, nội dung) → trả tên ô đó (🤖 không rời trang).
  // Không xét “Địa chỉ tài sản” – trang tự điền sẵn theo Phường/Xã
  async function recvTyped() {
    for (const L of ['Người nộp hồ sơ', 'Số giấy tờ', 'Số điện thoại', 'Email', 'Nội dung hồ sơ']) {
      const v = await readField(L);
      if (v != null && String(v).trim()) return L;
    }
    return '';
  }
  // 🤖 hết TB chưa tiếp nhận, còn TB “Đã tiếp nhận” chưa xong → tự sang “Xử lý công việc” (thanh trái) tìm tiếp – không chờ bạn bấm ▶
  // (bạn yêu cầu 22/11). Vừa bấm mà trang chưa chuyển (2 phút) → không bấm lặp
  function goListSig() {
    // (24/11) cả khi chỉ còn TB ✓ Xong chưa kiểm lại (lượt kiểm TB ✓)
    if (S.opts.tuSangTB === false || S.sweepPause || (!sweepList().length && !chkList().length) || recvNext() || !navXuLyCongViec()) return '';
    let g = null;
    try {
      g = JSON.parse(sessionStorage.getItem('vbdlis-dien-nhanh-xlcv') || 'null');
    } catch (e) {}
    if (g && Date.now() - (g.at || 0) < 2 * 60 * 1000) return '';
    return `xlcv:${sweepList().length}:${chkList().length}`; // số TB đổi (vd. có TB ◐ mới) → chữ ký đổi → 🤖 đi lại được
  }
  // số biên nhận của hồ sơ đang chọn, đọc ngay trên trang (không qua bộ điền): khung “Thông tin hồ sơ” / nhãn Số biên nhận,
  // hoặc danh sách còn đúng 1 dòng
  function soSync() {
    try {
      // trang danh sách: chỉ dòng ĐANG ĐƯỢC CHỌN (khung bên phải có thể còn giữ hồ sơ cũ sau khi bỏ chọn – không tin)
      if (onListPage()) {
        const sel = listDataRows().filter(rowSelected);
        const nums = [...new Set(sel.map((r) => soKey(rowSo(r))).filter(Boolean))];
        return nums.length === 1 ? rowSo(sel[0]) : '';
      }
      const n = labelDossierNumbers();
      if (n.length === 1) return n[0];
      // màn hình hồ sơ: ô “Số biên nhận” cạnh nhãn của nó
      for (const lab of document.querySelectorAll('label')) {
        if (lab.closest('#' + HOST_ID) || lab.closest('.modal, [role="dialog"]') || !/^so bien nhan\s*:?$/.test(norm(lab.textContent || '').trim()) || !shownEl(lab)) continue;
        const f = lab.htmlFor ? document.getElementById(lab.htmlFor) : null;
        const box = lab.closest('.form-group, .row, .col, td, div');
        const inp = (f && f.tagName === 'INPUT' ? f : null) || (box && box.querySelector('input'));
        if (inp && /KH\s*2959\.07777\./i.test(khNorm(inp.value))) return khNorm(inp.value).trim();
      }
    } catch (e) {}
    return '';
  }
  // hồ sơ của Quy trình đang mở (tiện ích vừa đọc) – để biết cú bấm Thực thi / Thực hiện / Đồng ý của bạn là cho hồ sơ nào
  function noteQtSo(so, force) {
    const m = qtModal();
    if (so && (m || force)) S.qtSeen = { so, at: Date.now(), el: m || null };
  }
  // dòng danh sách đang được chọn: lớp selected / row-selected / active… hoặc aria-selected (KHÔNG theo biểu tượng – trang thật luôn có ▶ ở ô đầu)
  function rowSelected(r) {
    return !!r && (/(^|\s)(selected|row-selected|active|highlight|chosen)(\s|$)/i.test(r.className || '') || r.getAttribute('aria-selected') === 'true');
  }
  const SWEEP_KEY = 'vbdlis-dien-nhanh-sweep';
  // TB bạn vừa bỏ tạm hoãn ở chặng trước lãnh đạo – 🤖 tìm ở danh sách làm lại (giữ qua tải lại trang)
  const REDO_KEY = 'vbdlis-dien-nhanh-redo';
  function redoSet(id, on) {
    const cur0 = (S.redo || []).map(String);
    const nx = on ? [...new Set([...cur0, String(id)])] : cur0.filter((x) => x !== String(id));
    if (nx.length === cur0.length && nx.every((x, i) => x === cur0[i])) return;
    S.redo = nx;
    try {
      if (nx.length) sessionStorage.setItem(REDO_KEY, JSON.stringify(nx));
      else sessionStorage.removeItem(REDO_KEY);
    } catch (e) {}
  }
  const stageSnap = (id) => JSON.stringify(S.stage[String(id)] || {});
  // TB đã chuyển lãnh đạo mà chưa Trả hồ sơ (kể cả đã đủ nhập đơn + lưu kho) – trừ TB bạn tự đánh dấu Xong
  const waitsTra = (st) => !!st && !!st.ld && !st.tra && !(st.xong && st.xongBy === 'tay');
  // TB đã mở khi tìm mà chưa có gì mới (vd. đang chờ bạn Kết ISO): 3 phút sau mới mở lại
  const SWEEP_AGAIN_MS = 3 * 60 * 1000;
  const SWEEP_WAIT_MS = 10 * 60 * 1000; // 🤖 chạy liên tục: hồ sơ chờ bạn (Kết ISO / file quét) – 🤖 đã đóng Quy trình
  // Xử lý công việc chỉ tìm TB “◐ Đã nhập nhưng chưa xong” (bạn yêu cầu 23/11: “chạy cái xử lý công việc thì chạy cái ở trạng thái đã nhập
  // nhưng chưa xong thôi”) – TB ○ đã tiếp nhận mà chưa chuyển lãnh đạo thì không (bạn chọn TB đó rồi bấm ▶ thì vẫn tìm)
  function sweepList() {
    const seen = S.sweepSeen || {};
    const ok = (x) => {
      const id = String(x.tb);
      const st = S.stage[id] || {};
      if (!x.soBienNhan || st.hoan || st.tra || S.autoHold.has(id)) return false;
      if (showStage(x) !== 'tn') return false;
      const sn = seen[id];
      return !(sn && typeof sn === 'object' && sn.snap === stageSnap(id) && Date.now() - (sn.at || 0) < (sn.wait ? SWEEP_WAIT_MS : SWEEP_AGAIN_MS));
    };
    const list = S.data.filter(ok);
    return [...list.filter((x) => traPhase(S.stage[String(x.tb)])), ...list.filter((x) => !traPhase(S.stage[String(x.tb)]))];
  }
  // lượt tìm của 🤖 ở Danh sách hồ sơ thụ lý (bạn yêu cầu 24/11: “load lại 1 loạt danh sách – TB nào đã nhập nhưng chưa xong thì phải làm hết”):
  // các TB đã tìm trong lượt này (thấy → đã mở làm; không thấy → ✓ Xong / bỏ qua). Mỗi TB ◐ tìm đúng 1 lần mỗi lượt, theo thứ tự (chặng cuối trước);
  // hết lượt mới sang tiếp nhận TB mới / bắt đầu lượt sau. Giữ qua tải lại trang (sessionStorage của thẻ – trang tải lại sau mỗi hồ sơ làm xong,
  // trước đây lượt tìm bắt đầu lại từ đầu); 30 phút không tìm thêm TB nào thì bỏ lượt cũ
  const ROUND_KEY = 'vbdlis-dien-nhanh-sweepround';
  const ROUND_MS = 30 * 60 * 1000;
  function roundDone() {
    const r = S.sweepRound;
    return r && Array.isArray(r.ids) && Date.now() - (r.at || 0) < ROUND_MS ? new Set(r.ids.map(String)) : new Set();
  }
  function saveRound() {
    try {
      if (S.sweepRound) sessionStorage.setItem(ROUND_KEY, JSON.stringify(S.sweepRound));
      else sessionStorage.removeItem(ROUND_KEY);
    } catch (e) {}
  }
  // xong = TB vừa được tích ✓ Xong vì không còn hồ sơ (để báo tổng kết của lượt); prev = các TB lượt trước đã tích (báo tiếp ở lượt mới)
  function roundAdd(id, xong) {
    const r0 = S.sweepRound;
    const r = r0 && Date.now() - (r0.at || 0) < ROUND_MS ? r0 : null;
    // lượt cũ vừa hết hạn (≤ 60 phút): các TB nó đã tích ✓ thành “lượt trước”
    const old = !r && r0 && Date.now() - (r0.at || 0) < 2 * ROUND_MS && Array.isArray(r0.xong) && r0.xong.length ? r0.xong : null;
    const xs = (r && Array.isArray(r.xong) ? r.xong : []).map(String);
    if (xong && !xs.includes(String(id))) xs.push(String(id));
    S.sweepRound = {
      ids: [...new Set([...roundDone(), String(id)])],
      xong: xs,
      prev: old || (r && Array.isArray(r.prev) && r.prev) || [],
      at: Date.now(),
      ...(r && Array.isArray(r.bulkIds) ? { bulkIds: r.bulkIds } : {}),
      ...(r && r.bulkFail ? { bulkFail: 1 } : {}),
    };
    saveRound();
  }
  // câu báo khi tích ✓ Xong một TB không còn hồ sơ: kèm các TB khác đã tích trong lượt này
  function roundXongEvt(x, text) {
    roundAdd(x.tb, true);
    const xs = (S.sweepRound && S.sweepRound.xong) || [];
    setEvt(`✓ TB ${esc(x.tb)} – ${esc(whoOf(x))}: ${esc(text)}.${xs.length > 1 ? ` Lượt tìm này đã tích ✓ Xong ${xs.length} TB: ${esc(xs.join(', '))}.` : ''}`);
  }
  // hết lượt (keepPrev): nhớ các TB lượt vừa xong đã tích ✓ để lượt mới vẫn báo; bật 🤖 / bấm ▶ thì bỏ hết
  function roundReset(keepPrev) {
    // lượt mới chưa tìm TB nào (gọi lại ở các lần kiểm sau) → giữ nguyên, cả tổng kết lượt trước
    if (keepPrev && S.sweepRound && !(S.sweepRound.ids || []).length && Date.now() - (S.sweepRound.at || 0) < ROUND_MS) return;
    const r = keepPrev && S.sweepRound && Date.now() - (S.sweepRound.at || 0) < 2 * ROUND_MS ? S.sweepRound : null;
    const prev = r && Array.isArray(r.xong) ? r.xong : []; // chỉ lượt VỪA xong (kể cả vừa hết hạn)
    S.sweepRound = prev.length ? { ids: [], xong: [], prev, at: Date.now() } : null;
    saveRound();
    if (!keepPrev) bulkSave(null); // bật 🤖 / bấm ▶: lần soát hàng loạt tới không phải chờ 1 phút
  }
  // ---------- ⚡ Soát hàng loạt (bạn yêu cầu 25/11: “tôi muốn có 1 nút bấm soát hàng loạt – khi bật lên sẽ soát hàng loạt cho nhanh”) ----------
  // Nút ⚡ Soát loạt (S.opts.sotLoat, mặc định tắt). Bật: ở Danh sách hồ sơ thụ lý, mỗi lượt tìm 🤖 tải lại cả danh sách MỘT lần (ô tìm trống, thanh lọc
  // “Tất cả”, số dòng mỗi trang lớn nhất), lật hết các trang, gom số biên nhận mọi hồ sơ (bulkRead) rồi đối chiếu cùng lúc (runBulk): TB ◐ không có trong
  // danh sách → như lần tìm CHẮC CHẮN không thấy (traGone – ✓ Xong / giữ ◐ theo luật cũ); TB ✓ chờ kiểm không có → ghi đã kiểm; TB còn hồ sơ → 🤖 tìm
  // đúng số đó (như cũ) để mở làm / kiểm. Đọc không trọn danh sách → không kết luận gì, lượt đó tìm từng TB như cũ. 2 lần soát cách nhau ≥ 1 phút
  function bulkOn() {
    return S.opts.sotLoat === true && !isLd();
  }
  const BULK_GAP_MS = 60 * 1000;
  const BULK_MAX_PAGES = 80;
  // lần soát hàng loạt gần nhất của thẻ này { at, n, pages, xong, co, bad } (sessionStorage – giữ qua tải lại trang)
  function bulkLoad() {
    try {
      const v = JSON.parse(sessionStorage.getItem('vbdlis-dien-nhanh-bulk') || 'null');
      return v && typeof v === 'object' ? v : null;
    } catch (e) {
      return null;
    }
  }
  function bulkSave(v) {
    try {
      if (v) sessionStorage.setItem('vbdlis-dien-nhanh-bulk', JSON.stringify(v));
      else sessionStorage.removeItem('vbdlis-dien-nhanh-bulk');
    } catch (e) {}
  }
  // lượt tìm đang chạy (chưa hết hạn)
  function roundCur() {
    const r = S.sweepRound;
    return r && Date.now() - (r.at || 0) < ROUND_MS ? r : null;
  }
  // TB đã được lần soát hàng loạt của LƯỢT NÀY xét – hoặc lượt này soát không đọc trọn danh sách (bulkFail) → tìm từng TB như cũ
  function bulkCovered(x) {
    const r = roundCur();
    return !!r && (!!r.bulkFail || (Array.isArray(r.bulkIds) && r.bulkIds.includes(String(x.tb))));
  }
  function roundBulk(ids, fail) {
    const r = roundCur();
    S.sweepRound = {
      ...(r || { ids: [], xong: [], prev: [] }),
      bulkIds: [...new Set([...((r && Array.isArray(r.bulkIds) && r.bulkIds) || []), ...ids.map(String)])],
      at: Date.now(),
    };
    if (fail) S.sweepRound.bulkFail = 1;
    else delete S.sweepRound.bulkFail;
    saveRound();
  }
  // TB tìm tiếp theo của lượt: TB ◐ đầu tiên (sweepList – chặng cuối trước) chưa tìm trong lượt này; hết → null
  function roundNext(ps) {
    const dn = roundDone();
    return (ps || sweepList()).find((y) => !dn.has(String(y.tb))) || null;
  }
  // lần tìm KHÔNG thấy hồ sơ có chắc không: '' = chắc (danh sách VỪA tải lại cho đúng số này, trống hẳn – dòng “Không tìm thấy hồ sơ nào” / “Không có
  // dữ liệu” / “tổng số 0”, ô tìm còn đúng số đó, trang không báo lỗi, thanh lọc “Tất cả”); không thì lý do. anyTab: chấp nhận cả khi không nhận ra
  // mục đang chọn ở thanh lọc (chỉ để KIỂM LẠI TB ✓ – sai cũng chỉ là bỏ sót một lần kiểm, không đổi trạng thái TB)
  function goneWhy(r, anyTab) {
    if (accBad()) return 'đang đăng nhập tài khoản khác tài khoản Chuyên viên trong cài đặt';
    const tab = listTabState();
    return !r || r.failed
      ? 'trang báo lỗi / lần tìm chưa xong'
      : !(r.none && r.fresh)
      ? 'danh sách chưa tải lại xong'
      : !r.emptyShown
      ? 'không thấy dòng “Không tìm thấy hồ sơ nào”'
      : !r.typed
      ? 'ô tìm không còn đúng số này'
      : tab === 'other'
      ? 'thanh lọc đang ở mục khác “Tất cả” – bạn bấm “Tất cả”'
      : tab !== 'all' && !anyTab
      ? 'tiện ích không nhận ra mục đang chọn ở thanh lọc'
      : '';
  }
  // lượt kiểm TB ✓ Xong (bạn yêu cầu 24/11: “khi xong thì hãy chạy lại 1 lượt các tb đang ở trạng thái đã xong để check xem có sót hồ sơ không”; bạn chọn:
  // mỗi TB ✓ kiểm 1 lần – TB cũ kiểm 1 lần, TB mới ✓ sau này kiểm 1 lần). TB chờ kiểm: ✓ Xong, có số biên nhận, không tạm hoãn / tạm giữ, chưa kiểm từ lúc
  // ✓ (mốc chk); lần kiểm chưa chắc (chkTry) → 2 giờ sau mới kiểm lại
  const CHK_RETRY_MS = 2 * 3600 * 1000;
  // (25/11) TB ✓ vì không thấy hồ sơ mà chưa rõ lãnh đạo đã trả về chưa (ldUnk): kiểm lại mỗi 30 phút, trong 10 ngày
  const LDUNK_RECHK_MS = 30 * 60 * 1000;
  const LDUNK_DAYS_MS = 10 * 24 * 3600 * 1000;
  // TB 🤖 / bạn chuyển lãnh đạo QUA tiện ích chưa đủ 1 ngày: không thấy hồ sơ = lãnh đạo có thể chưa ký → giữ ◐
  const LD_FRESH_MS = 24 * 3600 * 1000;
  const CHK_MIN_MS = 15 * 60 * 1000;
  // tài khoản đang đăng nhập (góc trên phải) khác tài khoản Chuyên viên trong cài đặt (danh sách đang xem là của người khác) – không đọc được thì coi như đúng
  function accBad() {
    const me = loginName();
    const cv = accNorm(S.opts.ctCV || '');
    return !!(me && cv && me !== cv);
  }
  function chkList() {
    if (accBad()) return []; // danh sách của tài khoản khác – không kiểm TB ✓
    return S.data.filter((x) => {
      const id = String(x.tb);
      const s = S.stage[id] || {};
      if (!x.soBienNhan || !s.xong || s.hoan || S.autoHold.has(id)) return false;
      // (25/11) ✓ suy ra mà chưa rõ lãnh đạo đã trả về chưa → kiểm lại mỗi 30 phút (10 ngày): lãnh đạo trả về sau thì hồ sơ hiện lại → về ◐ làm tiếp
      const again = !!s.ldUnk && Date.now() - s.xong < LDUNK_DAYS_MS && Date.now() - (s.chk || 0) >= LDUNK_RECHK_MS;
      if (s.chk && s.chk >= s.xong && !again) return false;
      if (Date.now() - s.xong < CHK_MIN_MS) return false; // vừa ✓ (15 phút) – để danh sách kịp cập nhật
      return !(s.chkTry && s.chkTry >= s.xong && Date.now() - s.chkTry < CHK_RETRY_MS);
    });
  }
  // TB không thấy hồ sơ ở Danh sách hồ sơ thụ lý (bạn yêu cầu 24/11: “nếu tìm không thấy thông tin hồ sơ thì bỏ qua và tích tb đó là đã xong”;
  // bạn chọn: chỉ TB lãnh đạo ĐÃ trả về). TB chặng cuối (traPhase – tiện ích đã thấy hồ sơ lãnh đạo trả về: mốc kq, chuyển bước Trả kết quả, đã bấm
  // Trả hồ sơ) mà lần tìm này chắc chắn: danh sách VỪA tải lại cho đúng số này, trống hẳn (dòng “Không tìm thấy hồ sơ nào” / “Không có dữ liệu” /
  // “tổng số 0”), ô tìm còn đúng số đó, thanh lọc “Tất cả”, trang không báo lỗi → hồ sơ đã rời danh sách (đã trả) → ✓ Xong ngay (1 lần tìm; ghi
  // “suy ra: không còn trong Danh sách hồ sơ thụ lý”). TB mới chuyển lãnh đạo, chưa thấy trả về → bỏ qua, giữ ◐. Trả { k: '' | 'wait' | 'xong', text }
  function traGone(x, r) {
    const id = String(x.tb);
    const s = S.stage[id] || {};
    if (s.traMiss) setMark(id, 'traMiss', null); // dấu của bản trước (cần 2 lần tìm) – không dùng nữa
    if (r && r.row) {
      // hồ sơ còn trong danh sách của bạn → bỏ dấu “bạn đã đổi về ◐” / “bạn chuyển sang bước khác”
      if (s.dsNo) setMark(id, 'dsNo', null);
      if (s.fwd && s.fwd.k === 'oth') setMark(id, 'fwd', null);
      return { k: '', text: '' };
    }
    // lãnh đạo đã trả về: chặng cuối (mốc kq / chuyển bước Trả kết quả / đã bấm Trả hồ sơ), hoặc máy này (vai trò Lãnh đạo) đã ký duyệt chuyển bước 4
    // (kd) cho ĐÚNG tài khoản Chuyên viên này (người nhận bước 4 khác → hồ sơ không về danh sách của bạn)
    const back = traPhase(s) || (!!s.kd && !s.tra && (!S.opts.ctB4 || accNorm(S.opts.ctB4) === accNorm(S.opts.ctCV || '')));
    if (!back) {
      // (25/11 – bạn: “không tìm thấy hồ sơ rồi mà vẫn không tích đã xong”) TB ◐ tiện ích chưa thấy lãnh đạo trả về:
      // - chuyển lãnh đạo QUA tiện ích (🤖 / bạn bấm Thực thi, có mốc giờ) chưa đủ 1 ngày → lãnh đạo có thể chưa ký → giữ ◐ (như trước);
      // - còn lại (TB bạn đổi tay / nạp Excel về ◐, hoặc đã chuyển quá 1 ngày): lần tìm CHẮC CHẮN không thấy → ✓ Xong (suy ra), ghi ldUnk – lượt kiểm
      //   TB ✓ tìm lại TB này mỗi 30 phút (10 ngày): lãnh đạo trả về sau (hồ sơ hiện lại trong danh sách) → đổi về ◐, 🤖 làm tiếp Trả hồ sơ
      // (25/11 – bạn: “nếu TB của tôi mà không còn hồ sơ thì tích xong hết cho tôi; nếu TB vừa chuyển lãnh đạo thì tích chưa xong”): chỉ TB VỪA chuyển
      // đi (lãnh đạo qua tiện ích / bạn tự chuyển sang bước khác – chưa đủ 1 ngày) mới giữ ◐; TB bạn chuyển bước khác lâu hơn, TB bạn đã đổi tay về ◐
      // cũng ✓ (trước đây giữ ◐) – vẫn tìm lại mỗi 30 phút
      if (!(r && r.none && r.fresh)) return { k: '', text: `lần tìm chưa xong (${goneWhy(r) || 'chưa rõ'}) – lượt sau tìm lại` };
      const tOth = s.fwd && s.fwd.k === 'oth' ? s.fwd.at || 0 : 0;
      const tLd = Math.max(s.ld && s.ldBy !== 'tay' ? s.ld : 0, s.fwd && s.fwd.k === 'ld' && !s.fwd.bad ? s.fwd.at || 0 : 0, tOth);
      if (tLd && Date.now() - tLd < LD_FRESH_MS)
        return {
          k: '',
          text: `không có trong danh sách – vừa ${tOth && tOth === tLd ? 'chuyển hồ sơ sang bước khác' : 'chuyển lãnh đạo'} lúc ${fmtTime(tLd)} (chưa đủ 1 ngày) → chưa xong (giữ ◐)`,
        };
      const why0 = goneWhy(r);
      if (why0) return { k: 'wait', text: `không thấy hồ sơ nhưng chưa chắc (${why0}) – chưa tích Xong, lượt sau tìm lại` };
      markStage(id, 'tra', 'ds');
      setMark(id, 'ldUnk', Date.now());
      return {
        k: 'xong',
        text: 'không còn hồ sơ trong Danh sách hồ sơ thụ lý → ✓ Xong (chưa rõ lãnh đạo đã trả về chưa: 🤖 tìm lại mỗi 30 phút – hồ sơ hiện lại thì đổi về ◐ làm tiếp)',
      };
    }
    // bạn VỪA tự Thực thi chuyển hồ sơ sang bước khác “Trả kết quả” (trả về lãnh đạo, bước trước, người khác…), chưa đủ 1 ngày → chưa xong (giữ ◐).
    // (25/11 – bạn: “không còn hồ sơ thì tích xong hết”) lâu hơn 1 ngày, hoặc bạn đã đổi tay TB này về ◐ → ✓, tìm lại mỗi 30 phút (ldUnk)
    const tOthB = s.fwd && s.fwd.k === 'oth' ? s.fwd.at || 0 : 0;
    if (tOthB && Date.now() - tOthB < LD_FRESH_MS)
      return { k: '', text: `không có trong danh sách – vừa chuyển hồ sơ sang bước khác lúc ${fmtTime(tOthB)} (chưa đủ 1 ngày) → chưa xong (giữ ◐)` };
    const unsure = !!tOthB || !!(s.dsNo && Math.max(s.kq || 0, s.trk || 0, s.kd || 0, (s.fwd && s.fwd.at) || 0) < s.dsNo);
    // vừa đổi bước (2 phút: chuyển bước Trả kết quả – cả khi trang đã báo chuyển xong –, lãnh đạo trả về / ký duyệt): hồ sơ phải còn trong danh sách của
    // bạn – chưa thấy có thể do trang chưa cập nhật → lượt sau tìm lại
    const tNew = Math.max(s.trk || 0, s.kq || 0, s.kd || 0, s.fwd && s.fwd.k === 'trk' && !s.fwd.bad ? s.fwd.at || 0 : 0);
    if (tNew && Date.now() - tNew < 2 * 60 * 1000)
      return { k: 'wait', text: `không có trong danh sách – hồ sơ vừa đổi bước lúc ${fmtTime(tNew)}, chờ trang cập nhật (lượt sau tìm lại)` };
    const why = goneWhy(r);
    if (why) return { k: 'wait', text: `không thấy hồ sơ nhưng chưa chắc (${why}) – chưa tích Xong, lượt sau tìm lại` };
    const ev = s.fwd && s.fwd.k === 'tra' ? `đã bấm Trả hồ sơ lúc ${fmtTime(s.fwd.at)}` : `lãnh đạo đã trả về${s.kq || s.kd ? ` (thấy lúc ${fmtTime(s.kq || s.kd)})` : ''}`;
    // (không ghi chk: lượt kiểm TB ✓ tìm lại TB này 1 lần nữa – lần tìm độc lập thứ 2; còn hồ sơ thì đổi về ◐ làm tiếp)
    markStage(id, 'tra', 'ds');
    if (unsure) {
      setMark(id, 'ldUnk', Date.now()); // bạn đã chuyển hồ sơ đi / đã đổi tay về ◐: chưa chắc đã trả → tìm lại mỗi 30 phút (10 ngày)
      return { k: 'xong', text: 'không còn hồ sơ trong Danh sách hồ sơ thụ lý → ✓ Xong (🤖 tìm lại mỗi 30 phút – hồ sơ hiện lại thì đổi về ◐ làm tiếp)' };
    }
    return { k: 'xong', text: `không còn hồ sơ trong Danh sách hồ sơ thụ lý – ${ev} → coi như đã trả hồ sơ → ✓ Xong` };
  }
  // TB bạn chọn rồi bấm ▶ mà phải tìm ở Danh sách hồ sơ thụ lý (bạn yêu cầu 22/11): “◐ Đã tiếp nhận” chưa xong / chặng cuối
  // chưa trả hồ sơ, không tạm hoãn, có số biên nhận
  const needsList = (x) => {
    if (!x || !x.soBienNhan) return false;
    const st = S.stage[String(x.tb)] || {};
    return !st.tra && !st.hoan && (stageOf(x) === 'tn' || traPhase(st) || waitsTra(st));
  };
  // ▶ vừa bấm “Xử lý công việc” cho một TB (chrome.storage tbGoList {tb, at, tabId}): trang chuyển thì bảng điền mới tìm tiếp TB đó
  const GOLIST_MS = 2 * 60 * 1000;
  function saveSweepSeen() {
    try {
      sessionStorage.setItem(SWEEP_KEY, JSON.stringify(S.sweepSeen || {}));
    } catch (e) {}
  }
  // tài khoản đang đăng nhập (góc trên phải, vd. “bgi.xxx_vy”) – không thấy rõ một tài khoản thì ''
  function loginName() {
    const vals = new Set();
    for (const el of document.querySelectorAll('header *, nav *, .navbar *, .main-header *, .page-header *, .top-menu *, .user-info *, .dropdown-user *')) {
      if (el.children.length || el.closest('#' + HOST_ID) || el.closest('.modal, [role="dialog"], table, .dropdown-menu') || !shownEl(el)) continue;
      const t = (el.textContent || '').trim();
      if (/^bgi\.[\w.]+$/i.test(t)) vals.add(accNorm(t));
    }
    return vals.size === 1 ? [...vals][0] : '';
  }
  // ---------- Vai trò Lãnh đạo (bạn yêu cầu 23/11: “tôi cần cái vai trò lãnh đạo giống exten 0.9.3 kia”) ----------
  // Máy đăng nhập tài khoản lãnh đạo, Danh sách hồ sơ thụ lý: hồ sơ KH 2959.07777… đang ở bước “… Lãnh đạo …” → bấm vào hồ sơ → Xử lý hồ sơ
  // → Quy trình CHỈ có “Ký duyệt hồ sơ” → tích Đã xử lý → Chuyển tiếp → bước “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)” → đúng tài khoản
  // nhận bước 4 → Thực thi → kiểm tra hồ sơ đã rời bước lãnh đạo. Không cần dữ liệu TB. Bạn chọn 23/11: người nhận bước 4 = tài khoản
  // Chuyên viên (tab Biên nhận; ô riêng “Người nhận bước 4” để đổi); hồ sơ lỗi → kêu ting, làm hồ sơ khác, thử lại sau – tối đa 3 lần rồi
  // bỏ qua; ký duyệt = chỉ tích “Đã xử lý” rồi Chuyển tiếp (không ký số). Hết hồ sơ → 🤖 tải lại danh sách sau N giây (Chạy liên tục)
  const isLd = () => S.opts.vaiTro === 'ld';
  const LD_BUOC_DEF = 'Chuyên viên hoàn tất';
  const LD_MAX = 3; // một hồ sơ lỗi tối đa 3 lần rồi bỏ qua (như bản 0.9.3)
  const LD_KEY = 'vbdlis-dien-nhanh-ld'; // sessionStorage của thẻ: dấu từng hồ sơ (giữ qua tải lại trang)
  const LD_STEP = /lanh dao/; // Bước XL của hồ sơ chờ lãnh đạo (vd. “3. Lãnh đạo UBND xã”)
  const ldRecv = () => String(S.opts.ctB4 || S.opts.ctCV || '').replace(/\s+/g, '');
  const ldBuocN = () => norm(S.opts.ldBuoc || LD_BUOC_DEF);
  const ldWaitMs = () => Math.max(15, parseInt(S.opts.ldWait, 10) || 60) * 1000;
  const LD_ST = { cho: '○ chờ ký duyệt', lam: '⏳ đã bấm Thực thi – chờ xác nhận', ok: '✓ đã chuyển bước 4', loi: '✗ lỗi', bo: '⊘ bỏ qua' };
  function ldLoad() {
    try {
      const v = JSON.parse(sessionStorage.getItem(LD_KEY) || 'null');
      if (v && typeof v === 'object') S.ld = { ...S.ld, items: v.items || {}, cur: v.cur || null, idleAt: v.idleAt || 0, block: v.block || '', tt: v.tt || null, pages: v.pages || 0 };
    } catch (e) {}
    S.ld.refAt = Date.now(); // trang vừa tải → danh sách đang hiện là bản mới
    S.ld.loadAt = S.ld.refAt; // lúc trang tải (F5) – chỉ trong bộ nhớ
  }
  // danh sách đang hiện được lấy SAU lúc t (đã tải lại / trang tải lại sau lúc đó)
  const ldFresh = (t, min) => S.ld.refAt > (t || 0) + Math.max(5000, min || 0) || (S.ld.loadAt || 0) > (t || 0) + Math.max(1000, min || 0);
  // (24/11) điều kiện chạy vai trò Lãnh đạo đã đúng lại chưa (đăng nhập đúng tài khoản lãnh đạo, có tài khoản nhận bước 4) – không bấm gì
  function ldPreOk() {
    const me = loginName();
    const lead = accNorm(S.opts.ctLD || '');
    if (me && lead && me !== lead) return false;
    const acc = ldRecv();
    if (!acc) return false;
    return !((me && accNorm(acc) === me) || (lead && accNorm(acc) === lead));
  }
  function ldSave() {
    try {
      sessionStorage.setItem(LD_KEY, JSON.stringify({ items: S.ld.items, cur: S.ld.cur, idleAt: S.ld.idleAt, block: S.ld.block, tt: S.ld.tt, pages: S.ld.pages }));
    } catch (e) {}
  }
  // vai trò Lãnh đạo: tải lại trang như bạn bấm F5 (bạn yêu cầu 24/11) – danh sách lấy lại từ máy chủ (hồ sơ mới, trang 1, ô tìm trống).
  // Chờ lần chạy đang chạy xong + ghi tiến độ xong rồi mới tải; trong lúc chờ bạn bấm / gõ trên trang hoặc bảng điền, mở cửa sổ / hộp,
  // tắt 🤖 → thôi tải lại (🤖 xét lại sau). 🤖 không bắt đầu việc khác trong lúc chờ tải lại
  function ldReload() {
    const at = Date.now();
    S.autoCool = at + 25000;
    ldSave();
    setStatus('🤖 Lãnh đạo: tải lại trang (như bấm F5)…');
    setTimeout(async () => {
      const t0 = Date.now();
      while ((S.running || S.busy) && Date.now() - t0 < 15000) await sleep(300);
      try {
        await stageChain; // ghi tiến độ TB (◐ LĐ ký duyệt) xong rồi mới tải lại
      } catch (e) {}
      let ok = AUTO() && isLd() && !S.running && !S.busy && USER.at <= at && (S.panelAt || 0) <= at;
      if (ok) {
        try {
          ok = !(await act('modalState')).some((x) => x.open) && !(await act('dialogState')).some((x) => x.open);
        } catch (e) {
          ok = false;
        }
      }
      if (!ok || USER.at > at || (S.panelAt || 0) > at) {
        S.autoCool = 0;
        if (AUTO() && isLd()) setStatus('🤖 Lãnh đạo: thôi tải lại trang (bạn đang thao tác / có cửa sổ mở) – 🤖 xét lại sau.');
        return;
      }
      if (!AUTO() || !isLd() || S.running || S.busy || S.sweepPause || S.stopReq || USER.at > at || (S.panelAt || 0) > at) {
        S.autoCool = 0;
        return;
      }
      ldSave();
      try {
        location.reload();
      } catch (e) {
        S.autoCool = 0;
      }
    }, 1500);
  }
  // dấu của một hồ sơ (khóa: số biên nhận đã chuẩn hóa) – giữ tối đa 300 hồ sơ gần nhất
  function ldSet(key, patch) {
    const it = { ...(S.ld.items[key] || {}), ...patch, at: Date.now() };
    S.ld.items[key] = it;
    const ks = Object.keys(S.ld.items);
    if (ks.length > 300)
      ks.sort((a, b) => (S.ld.items[a].at || 0) - (S.ld.items[b].at || 0))
        .slice(0, ks.length - 300)
        .forEach((k) => delete S.ld.items[k]);
    ldSave();
    renderLd();
    return it;
  }
  // hồ sơ đã rời bước lãnh đạo (đã chuyển bước 4). Máy này có dữ liệu TB của hồ sơ đó → ghi mốc “LĐ ký duyệt” (◐ Đã nhập nhưng chưa xong)
  function ldOk(key, so, msg) {
    ldSet(key, { so, st: 'ok', okAt: Date.now(), fwdAt: 0, msg: msg || '', wait: 0, vN: 0 });
    if (S.ld.tt && S.ld.tt.key === key) S.ld.tt = null;
    if (S.ld.cur && S.ld.cur.key === key) S.ld.cur = null;
    S.ld.pages = 0;
    ldSave();
    const l = so ? tbOfSo(so).list : [];
    if (l.length === 1) {
      const id = String(l[0].tb);
      if (!(S.stage[id] || {}).ld) markStage(id, 'ld', 'suy');
      setMark(id, 'kd', Date.now());
    }
  }
  // Bước XL của dòng danh sách (“Bước XL: 3. Lãnh đạo UBND xã  CB chuyển: …”): chữ như trên trang (để hiện); rowStep = bản bỏ dấu (để so)
  const rowStepText = (tr) => {
    const t = khText(tr).normalize('NFC');
    const m = /Bước\s*XL\s*:?\s*(.+?)\s*(?:CB\s*chuyển|Vào\s*lúc|Ghi\s*chú|Người\s*nộp|Thửa\s*đất|$)/i.exec(t);
    if (m) return m[1].trim();
    const n = /buoc xl\s*:?\s*(.+?)\s*(?:cb chuyen|vao luc|ghi chu|nguoi nop|thua dat|$)/.exec(norm(t));
    return n ? n[1].trim() : '';
  };
  const rowStep = (tr) => norm(rowStepText(tr));
  // các hồ sơ trên trang danh sách đang hiện: { tr, so, key, step, dup } – bản lặp của cùng hồ sơ gộp lại; 2 hồ sơ thật trùng số → dup
  function ldPageRows() {
    const g = new Map();
    for (const tr of listDataRows()) {
      const so = rowSo(tr);
      if (!so) continue;
      const key = soKey(so);
      g.set(key, (g.get(key) || []).concat(tr));
    }
    return [...g].map(([key, trs]) => {
      const one = groupSame(trs);
      const st = rowStepText(one[0]);
      return { tr: one[0], so: rowSo(one[0]), key, step: norm(st), stepText: st, dup: one.length > 1 };
    });
  }
  // bảng danh sách đang hiện dòng “Không có dữ liệu / Không tìm thấy” (danh sách trống thật, không phải đang tải)
  function listEmptyShown() {
    const box = listBox();
    return [...((box && box.querySelectorAll('tbody tr')) || [])].some(
      (tr) => shownEl(tr) && tr.children.length === 1 && /^(khong co du lieu|khong tim thay)/.test(norm(tr.textContent || ''))
    );
  }
  // phân trang của bảng danh sách (DataTables / pagination): nút “trang sau” chưa bị khóa + số trang đang xem
  function ldPager() {
    let box = listBox();
    let w = null;
    if (box) {
      // DataTables: thanh phân trang id “<bảng>_paginate”, hoặc trong khung .dataTables_wrapper bao bảng
      const wr = box.closest('.dataTables_wrapper');
      w = (box.id && document.getElementById(box.id + '_paginate')) || (wr && wr.querySelector('.dataTables_paginate, .pagination')) || null;
    }
    for (let k = 0; box && k < 6 && !w; k++, box = box.parentElement) w = box.querySelector('.dataTables_paginate, .pagination');
    if (!w || !shownEl(w)) return null;
    const off = (el) =>
      !!el.disabled ||
      /(^|\s)disabled(\s|$)/.test(el.className || '') ||
      el.getAttribute('aria-disabled') === 'true' ||
      !!(el.parentElement && /(^|\s)disabled(\s|$)/.test(el.parentElement.className || ''));
    const nx =
      [...w.querySelectorAll('.next, .paginate_button.next, li.next > a, a[rel="next"]')].find((el) => shownEl(el)) ||
      [...w.querySelectorAll('a, button, li')].find((el) => shownEl(el) && /^(›|»|>|sau|tiep|trang sau|next)$/.test(norm(el.textContent || '')));
    const curEl = w.querySelector('.current, .active, [aria-current="page"]');
    // (25/11 – soát hàng loạt) nút “trang trước” (có / đang dùng được) và nút trang “1” / “đầu” – để về trang 1 trước khi đọc hết danh sách
    const pv =
      [...w.querySelectorAll('.previous, .paginate_button.previous, li.prev > a, li.previous > a, a[rel="prev"]')].find((el) => shownEl(el)) ||
      [...w.querySelectorAll('a, button, li')].find((el) => shownEl(el) && /^(‹|«|<|truoc|trang truoc|prev|previous)$/.test(norm(el.textContent || '')));
    const p1 =
      [...w.querySelectorAll('.first, .paginate_button.first, li.first > a')].find((el) => shownEl(el) && !off(el)) ||
      [...w.querySelectorAll('a, button')].find((el) => shownEl(el) && !off(el) && (el.textContent || '').trim() === '1' && el !== curEl && !el.contains(curEl));
    return { next: nx && !off(nx) ? nx : null, cur: curEl ? (curEl.textContent || '').trim() : '', prevAny: !!pv, prev: pv && !off(pv) ? pv : null, first: p1 || null };
  }
  // ⚡ các dòng của bảng danh sách đang hiện (cả dòng không có số KH – để đếm), bỏ dòng chờ / dòng “Không có dữ liệu”, dòng lồng trong dòng khác
  function bulkRows() {
    const box = listBox();
    if (!box || !box.querySelector('tbody tr')) return listDataRows();
    return [...box.querySelectorAll('tbody tr')].filter((tr) => {
      if (!shownEl(tr) || tr.closest('thead')) return false;
      const up = tr.parentElement && tr.parentElement.closest('tr');
      if (up && box.contains(up)) return false;
      const tds = [...tr.children].filter((c) => shownEl(c));
      return !(tds.length === 1 && /^(dang tai|dang xu ly|loading|khong co du lieu|khong tim thay)/.test(norm(tds[0].textContent || '').trim()));
    });
  }
  // ⚡ ô chọn số dòng mỗi trang của bảng danh sách (DataTables “Hiển thị 10 / 25 / 50 / 100”): { sel, best (giá trị nhiều dòng nhất), size (số dòng
  // đang chọn, -1 = tất cả) }. Chỉ ô chọn của bảng (DataTables) hoặc ô có chữ “hiển thị / dòng / bản ghi / mục…” cạnh bên, mọi lựa chọn là số nhỏ
  // (≤ 1000) / “Tất cả” – ô lọc khác (năm, phường…) không bao giờ bị đụng
  function lenSelect() {
    const box = listBox();
    if (!box) return null;
    const optN = (o) => {
      const v = String(o.value || '').trim();
      const t = norm(o.textContent || '').trim();
      if (v === '-1' || /^(tat ca|all)$/.test(t)) return -1;
      const n = /^\d{1,4}$/.test(v) ? +v : /^\d{1,4}$/.test(t) ? +t : NaN;
      return n > 0 && n <= 1000 ? n : NaN;
    };
    const okSel = (s, strict) => {
      if (!s || s.closest('#' + HOST_ID) || !shownEl(s) || s.options.length < 2 || [...s.options].some((o) => Number.isNaN(optN(o)))) return false;
      if (!strict) return true;
      const near = norm(((s.closest('label') || s.parentElement || {}).textContent || '').replace(/\d+/g, ' '));
      return /(hien thi|dong|ban ghi|muc|entries|show|so luong|\/ ?trang|moi trang)/.test(near);
    };
    const wr = box.closest('.dataTables_wrapper');
    let sel = [(box.id && document.getElementById(box.id + '_length')) || null, wr && wr.querySelector('.dataTables_length')]
      .filter(Boolean)
      .map((d) => d.querySelector('select'))
      .find((s) => okSel(s, false));
    for (let p = box.parentElement, k = 0; !sel && p && k < 6; p = p.parentElement, k++) sel = [...p.querySelectorAll('select')].find((s) => okSel(s, true)) || null;
    if (!sel) return null;
    const ns = [...sel.options].map(optN);
    const best = ns.includes(-1) ? -1 : Math.max(...ns);
    const opt = sel.options[sel.selectedIndex];
    return { sel, best, size: opt ? optN(opt) : NaN };
  }
  // ⚡ dòng tổng số của bảng danh sách: DataTables (“Hiển thị 1 đến 10 của 57 mục”) hoặc dòng dưới bảng như trang thật (“Hiển thị từ 1 đến 10 trong
  // tổng số 57 hồ sơ tiếp nhận”) – không thấy / không đọc được thì null
  function listTotal() {
    const box = listBox();
    if (!box) return null;
    const num = (s) => {
      const n = parseInt(String(s).replace(/[.,]/g, ''), 10);
      return Number.isNaN(n) ? null : n;
    };
    const wr = box.closest('.dataTables_wrapper');
    const el = (box.id && document.getElementById(box.id + '_info')) || (wr && wr.querySelector('.dataTables_info')) || null;
    if (el && shownEl(el)) {
      const m = /(?:cua|of|trong tong so|tong so|tong|\/)\s*:?\s*([\d.,]+)/.exec(norm(el.textContent || '').replace(/\(.*$/, ''));
      if (m) return num(m[1]);
    }
    const RX = /^hien thi (?:tu )?[\d.,]+ (?:den|-) [\d.,]+ (?:trong tong so|tren tong so|cua|tren|\/) ?([\d.,]+)(?!\d)/;
    for (let p = box.parentElement, k = 0; p && k < 4; p = p.parentElement, k++)
      for (const e of p.querySelectorAll('div, span, p, td, li, label')) {
        if (e.closest('#' + HOST_ID) || e.children.length > 3 || box.contains(e) || !shownEl(e)) continue;
        const m = RX.exec(norm(e.textContent || '').trim());
        if (m) return num(m[1]);
      }
    return null;
  }
  // ⚡ đọc HẾT Danh sách hồ sơ thụ lý: ô tìm trống → bấm 🔍 (danh sách tải lại), số dòng mỗi trang lớn nhất, về trang 1, đọc từng trang (đợi bảng ổn
  // định: 2 lần đọc liền giống nhau), bấm “trang sau” tới trang cuối. Trả { full, why, keys (soKey mọi hồ sơ), pages, rows }. full CHỈ khi: đúng tài khoản
  // Chuyên viên, thanh lọc “Tất cả”, danh sách vừa tải lại, mọi trang đọc được, trang không báo lỗi, bạn không thao tác trên trang giữa chừng, và chắc
  // đã hết trang (có thanh phân trang: hết nút trang sau; không thấy thanh phân trang: trang ít dòng hơn số dòng mỗi trang); có dòng tổng số thì phải đủ
  async function bulkRead(alive, note) {
    const keys = new Set();
    let pages = 0;
    let rows = 0;
    const res = (full, why) => ({ full, why: why || '', keys, pages, rows });
    if (accBad()) return res(false, 'đang đăng nhập tài khoản khác tài khoản Chuyên viên trong cài đặt');
    const tab0 = listTabState();
    if (tab0 !== 'all') return res(false, tab0 === 'other' ? 'thanh lọc đang ở mục khác “Tất cả” – bạn bấm “Tất cả”' : 'tiện ích không nhận ra mục đang chọn ở thanh lọc');
    const sb = sbnSearch();
    if (!sb) return res(false, 'không thấy ô tìm “Số biên nhận”');
    const t0 = Date.now();
    const d0 = pageDialog();
    const broke = () => {
      if (USER.at > t0) return 'bạn vừa thao tác trên trang';
      if (toastsSince(t0).some(toastBad)) return 'trang báo lỗi';
      const pd = pageDialog();
      return pd && (!d0 || pd.box !== d0.box) ? 'trang hiện hộp báo / hỏi' : '';
    };
    const sig = () => {
      const trs = bulkRows();
      return trs.map((tr) => soKey(rowSo(tr)) || norm(tr.textContent || '').slice(0, 40)).join('|') + '#' + trs.length + (listEmptyShown() ? '#0' : '');
    };
    // đợi bảng tải xong và ổn định (2 lần đọc liền giống nhau, cách 0,8 giây); moved(): bảng đã đổi sau cú bấm
    const settle = async (moved) => {
      const ts = Date.now();
      let prev = null;
      let busySeen = false;
      while (Date.now() - ts < 15000 * slowK()) {
        if (!alive()) return 'bạn bấm ■ Dừng';
        const bk = broke();
        if (bk) return bk;
        const busy = listBusy() || pageWorking();
        if (busy) busySeen = true;
        if (!busy && (busySeen || moved())) {
          if (bulkRows().length || listEmptyShown()) {
            const s = sig();
            if (s === prev) return '';
            prev = s;
          } else prev = null;
        }
        await sleep(800);
      }
      return 'danh sách tải quá lâu / bấm mà danh sách không đổi';
    };
    // bấm một nút của trang rồi đợi bảng đổi + ổn định
    const press = async (el) => {
      const before = sig();
      const box0 = listBox();
      let mv = false;
      let mo = null;
      try {
        if (box0) {
          mo = new MutationObserver(() => (mv = true));
          mo.observe(box0, { childList: true, subtree: true, characterData: true });
        }
      } catch (e) {}
      try {
        if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
        else clickPage(el.tagName === 'LI' ? el.querySelector('a, button') || el : el);
        S.busySince = 0;
        await sleep(700);
        return await settle(() => mv || sig() !== before || listBox() !== box0);
      } finally {
        try {
          if (mo) mo.disconnect();
        } catch (e) {}
      }
    };
    // 1. ô tìm trống → bấm 🔍: danh sách tải lại đủ hồ sơ (không lọc theo số biên nhận)
    note('tải lại danh sách (ô tìm trống)');
    typeInto(sb.input, '');
    S.sweepTyped = '';
    await sleep(300);
    let w = await (async () => {
      const box0 = listBox();
      let mv = false;
      let mo = null;
      try {
        if (box0) {
          mo = new MutationObserver(() => (mv = true));
          mo.observe(box0, { childList: true, subtree: true, characterData: true });
        }
      } catch (e) {}
      try {
        if (sb.btn) clickPage(sb.btn);
        else pressEnter(sb.input);
        S.busySince = 0;
        await sleep(1200);
        return await settle(() => mv || listBox() !== box0);
      } finally {
        try {
          if (mo) mo.disconnect();
        } catch (e) {}
      }
    })();
    if (w) return res(false, w);
    // 2. số dòng mỗi trang lớn nhất (ít trang hơn – nhanh hơn)
    let ls = lenSelect();
    if (ls && ls.size !== ls.best && ls.size !== -1) {
      note(`chọn ${ls.best === -1 ? 'hiện tất cả' : ls.best + ' dòng'} mỗi trang`);
      const opt = [...ls.sel.options].find((o) => {
        const v = String(o.value || '').trim();
        const t = norm(o.textContent || '').trim();
        return ls.best === -1 ? v === '-1' || /^(tat ca|all)$/.test(t) : v === String(ls.best) || t === String(ls.best);
      });
      if (opt) {
        ls.sel.value = opt.value;
        w = await press(ls.sel);
        if (w) return res(false, w);
      }
      ls = lenSelect();
    }
    // 3. về trang 1
    let pg = ldPager();
    const atFirst = (p) => !p || p.cur === '1' || (!p.cur && p.prevAny && !p.prev);
    for (let k = 0; pg && !atFirst(pg) && k < BULK_MAX_PAGES; k++) {
      const el = pg.first || pg.prev;
      if (!el) break;
      note('về trang 1');
      w = await press(el);
      if (w) return res(false, w);
      pg = ldPager();
    }
    if (pg && !atFirst(pg)) return res(false, pg.cur || pg.prevAny ? 'không về được trang 1 của danh sách' : 'không nhận ra trang đang xem của danh sách');
    // 4. đọc từng trang tới trang cuối
    for (;;) {
      const trs = bulkRows();
      pages++;
      rows += trs.length;
      for (const tr of trs) {
        const so = rowSo(tr);
        if (so) keys.add(soKey(so));
        else if (/2959\s*\.\s*07777/.test(khText(tr))) return res(false, `trang ${pages} có dòng hồ sơ không đọc ra số biên nhận`);
      }
      note(`đã đọc ${pages} trang · ${keys.size} hồ sơ`);
      pg = ldPager();
      if (!pg || !pg.next) break;
      if (pages >= BULK_MAX_PAGES) return res(false, `danh sách quá ${BULK_MAX_PAGES} trang`);
      const before = sig();
      w = await press(pg.next);
      if (w) return res(false, w);
      if (sig() === before) return res(false, 'bấm “trang sau” mà danh sách không đổi');
    }
    // 5. chắc đã đủ: không thấy thanh phân trang → trang phải ít dòng hơn số dòng mỗi trang (không biết thì 10); có dòng tổng số → phải đủ
    const tot = listTotal();
    if (tot != null && rows < tot) return res(false, `đọc được ${rows} dòng mà trang ghi tổng số ${tot}${pg ? '' : ' – tiện ích không nhận ra nút “trang sau”'}`);
    if (!pg && pages === 1 && tot == null) {
      const size = ls && !Number.isNaN(ls.size) ? ls.size : 10;
      if (size !== -1 && rows >= size)
        return res(false, `trang có ${rows} dòng mà tiện ích không thấy thanh phân trang / dòng tổng số – chưa chắc đã đủ hồ sơ`);
    }
    const bk = broke();
    if (bk) return res(false, bk);
    const sb1 = sbnSearch();
    if (sb1 && String(sb1.input.value || '').trim()) return res(false, 'ô tìm có chữ (bạn vừa gõ?)');
    const tab1 = listTabState();
    if (tab1 !== 'all') return res(false, 'thanh lọc đã đổi khỏi “Tất cả”');
    if (accBad()) return res(false, 'đang đăng nhập tài khoản khác tài khoản Chuyên viên trong cài đặt');
    return res(true);
  }
  // hồ sơ nên làm: đang ở bước lãnh đạo, không trùng số, chưa xong / chưa bỏ qua, lỗi thì chờ tới giờ thử lại
  function ldCand(r) {
    if (!r.step || !LD_STEP.test(r.step) || r.dup) return false;
    const it = S.ld.items[r.key];
    if (it && it.wait) return false; // đang chờ bạn tự bấm Thực thi (Chạy thử) – ▶ / bật lại 🤖 thì làm lại
    if (!it || it.st === 'cho') return true;
    if (it.st === 'loi') return (it.n || 0) < LD_MAX && Date.now() >= (it.retryAt || 0);
    return false; // ok (danh sách chưa tải lại – ldScanPage xét), lam (chờ xác nhận), bo (bỏ qua)
  }
  // đọc trang danh sách: chốt dấu hồ sơ đã bấm Thực thi / bạn tự bấm Thực thi (đã rời bước lãnh đạo → xong; 2 phút vẫn ở bước lãnh đạo →
  // lỗi, thử lại sau), hồ sơ đã chuyển mà sau khi tải lại danh sách vẫn ở bước lãnh đạo (→ làm lại 1 lần), ghi hồ sơ mới “chờ ký duyệt”
  // danh sách đang hiện là ĐỦ hồ sơ của bạn: đã tải xong, ô tìm trống, không có trang sau / không ở trang khác trang 1
  function ldFull(rows) {
    const sb = sbnSearch();
    const pg = ldPager();
    const loaded = !listBusy() && ((rows || ldPageRows()).length > 0 || listEmptyShown());
    return loaded && !(sb && String(sb.input.value || '').trim()) && !(pg && (pg.next || (pg.cur && pg.cur !== '1')));
  }
  function ldScanPage() {
    const rows = ldPageRows();
    const now = Date.now();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const full = ldFull(rows);
    // (soát 24/11) lượt xem các trang kể từ lần tải danh sách gần nhất: bắt đầu từ trang 1, gom số hồ sơ từng trang; tới trang cuối = đã xem đủ
    const loadMark = Math.max(S.ld.loadAt || 0, S.ld.refAt || 0);
    if (!S.ld.walk || S.ld.walk.at !== loadMark) S.ld.walk = { at: loadMark, keys: new Set(), from1: false };
    const W = S.ld.walk;
    const sbW = sbnSearch();
    const pgW = ldPager();
    if (!listBusy() && !(sbW && String(sbW.input.value || '').trim()) && (rows.length || listEmptyShown())) {
      if (!pgW || !pgW.cur || pgW.cur === '1') W.from1 = true;
      if (W.from1) rows.forEach((r) => W.keys.add(r.key));
    }
    // hồ sơ không có ở trang nào của lượt xem đủ (danh sách lấy SAU lúc t) – như đã rời danh sách
    const goneAll = (key, t) => full || (W.from1 && !!pgW && !pgW.next && !W.keys.has(key) && (t || 0) < W.at);
    let ch = false;
    for (const [key, it] of Object.entries(S.ld.items)) {
      const r = byKey.get(key);
      const tt = (S.ld.tt && S.ld.tt.key === key ? S.ld.tt : null) || (it.wait ? { at: it.wait } : null);
      if (it.st === 'lam' || tt) {
        const since = it.st === 'lam' ? it.fwdAt || it.at || 0 : tt.at;
        if (r && r.step && !LD_STEP.test(r.step)) ldOk(key, it.so || r.so, `${tt && it.st !== 'lam' ? 'bạn tự bấm Thực thi – ' : ''}danh sách ghi bước “${r.stepText || r.step}”`);
        else if (!r && goneAll(key, since)) ldOk(key, it.so, `${tt && it.st !== 'lam' ? 'bạn tự bấm Thực thi – ' : ''}hồ sơ đã rời danh sách của bạn`);
        else if (r && it.st === 'lam' && now - since > 120000 && ldFresh(since)) {
          const n = (it.n || 0) + 1;
          ldSet(key, { st: n >= LD_MAX ? 'bo' : 'loi', n, msg: `đã bấm Thực thi lúc ${fmtTime(since)} mà danh sách vẫn ghi bước “${r.stepText || r.step}”`, fwdAt: 0, retryAt: now + ldWaitMs(), failAt: now });
        }
      } else if (it.st === 'ok' && r && LD_STEP.test(r.step) && ldFresh(it.okAt, 120000)) {
        const nR = Math.max((it.n || 0) + 1, LD_MAX - 1); // (soát 24/11) làm lại đúng 1 lần – lần sau vẫn vậy thì bỏ qua (⊘)
        ldSet(key, { st: nR >= LD_MAX ? 'bo' : 'loi', n: nR, msg: `đã chuyển lúc ${fmtTime(it.okAt)} mà sau khi tải lại danh sách vẫn ghi bước “${r.stepText || r.step}”${nR >= LD_MAX ? ' – bạn kiểm tra trên VBDLIS' : ' – 🤖 làm lại 1 lần'}`, retryAt: now, failAt: now });
      } else if (!r && full && (it.st === 'cho' || it.st === 'loi' || it.st === 'bo')) {
        delete S.ld.items[key]; // hồ sơ đã rời danh sách (bạn / người khác đã làm) – không còn việc
        ch = true;
      } else if (r && r.step && !LD_STEP.test(r.step) && (it.st === 'cho' || it.st === 'loi' || it.st === 'bo')) {
        delete S.ld.items[key]; // hồ sơ đã sang bước khác (bạn / người khác đã chuyển) – không còn việc, không ghi ✓
        ch = true;
      }
    }
    const tt0 = S.ld.tt;
    if (tt0 && !chooserModal()) {
      // bạn tự bấm Thực thi ở cửa sổ chọn người tiện ích đã chọn sẵn (đúng hồ sơ đang chờ) và trang báo thành công sau cú bấm → xong
      if (USER.btn === 'thuc thi' && USER.btnAt > tt0.at && (!USER.btnSo || soKey(USER.btnSo) === tt0.key) && toastsSince(USER.btnAt).some(toastOk))
        ldOk(tt0.key, tt0.so, 'bạn tự bấm Thực thi – trang báo thành công');
      // cửa sổ chọn người đã đóng (8 giây) mà không có → thôi chờ câu báo; hồ sơ vẫn mang dấu “chờ bạn” (🤖 không mở lại – ▶ / bật lại 🤖 thì làm lại)
      else if (now - Math.max(tt0.at, USER.btnAt) > 8000) {
        S.ld.tt = null;
        ch = true;
      }
    }
    for (const r of rows)
      if (LD_STEP.test(r.step) && !r.dup && !S.ld.items[r.key]) {
        S.ld.items[r.key] = { so: r.so, st: 'cho', at: now };
        ch = true;
      }
    if (ch) {
      ldSave();
      renderLd();
    }
    return rows;
  }
  // bảng Lãnh đạo (thay các dòng TB khi vai trò là Lãnh đạo)
  const ldCardHtml = () => {
    const cv = S.opts.ctCV || '';
    const w = Math.round(ldWaitMs() / 1000);
    return `<div class="card">
        <div class="ct">👔 Lãnh đạo – ký duyệt, chuyển bước 4<span class="sp"></span><span class="muted" id="ldCount"></span></div>
        <div class="f"><label>Người nhận bước 4</label><input id="optCtB4" value="${esc(S.opts.ctB4 || '')}" placeholder="${esc(
      cv ? `trống = ${cv} (ô Chuyên viên, tab Biên nhận)` : 'tài khoản chuyên viên, vd. bgi.abc123_vy'
    )}" spellcheck="false"><span></span></div>
        <div class="f"><label>Bước nhận phải có</label><input id="optLdBuoc" value="${esc(S.opts.ldBuoc || LD_BUOC_DEF)}" spellcheck="false" title="Chữ phải có trong ô bước nhận của cửa sổ chọn người (vd. “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)”)"><span></span></div>
        <label class="opt"><input type="checkbox" id="optLdLoop"${S.opts.ldLoop !== false ? ' checked' : ''}> <b>Chạy liên tục</b>: hết hồ sơ thì 🤖 tải lại danh sách sau <input type="number" id="optLdWait" min="15" step="5" value="${w}" style="width:58px"> giây để nhận hồ sơ mới (tới khi tắt 🤖); hồ sơ lỗi thử lại sau chừng ấy giây</label>
        <div class="row"><button class="btn" id="ldScanBtn" title="Chỉ đọc trang Danh sách hồ sơ thụ lý đang mở – không bấm gì trên trang">Quét danh sách</button><button class="btn" id="ldClearBtn" title="Xóa dấu lỗi / bỏ qua để 🤖 thử lại các hồ sơ đó">Xóa dấu lỗi</button></div>
        <div id="ldBlock"></div>
        <div id="ldList"></div>
        <div class="hint">Máy đăng nhập <b>tài khoản lãnh đạo</b>${
          S.opts.ctLD ? ` (${esc(S.opts.ctLD)} – tiện ích dừng nếu thấy đăng nhập tài khoản khác)` : ' (điền ô Lãnh đạo ở tab Biên nhận để tiện ích kiểm tra đúng tài khoản)'
        }, mở <b>Xử lý công việc</b> rồi bật <b>🤖</b>: mỗi hồ sơ KH 2959… đang ở bước “… Lãnh đạo …” → bấm vào hồ sơ → Xử lý hồ sơ → tích “Đã xử lý” <b>Ký duyệt hồ sơ</b> → Chuyển tiếp → bước “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)” → đúng tài khoản trên → <b>Thực thi</b> → kiểm tra hồ sơ đã rời bước lãnh đạo. Hồ sơ lỗi: kêu ting, làm hồ sơ khác, thử lại tối đa ${LD_MAX} lần rồi bỏ qua. 🤖 tắt: ▶ chỉ mở hồ sơ và tô vàng – bạn tự tích, tự bấm. “Chạy thử” (tab Biên nhận) bật: dừng ở Thực thi cho bạn bấm.</div>
      </div>`;
  };
  function ldListHtml() {
    const its = Object.entries(S.ld.items).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    const today = new Date().toDateString();
    const nOk = its.filter(([, x]) => x.st === 'ok' && new Date(x.okAt || 0).toDateString() === today).length;
    const nWait = its.filter(([, x]) => x.st === 'cho' || (x.st === 'loi' && (x.n || 0) < LD_MAX)).length;
    const nBad = its.filter(([, x]) => x.st === 'bo' || x.st === 'loi').length;
    const rows = its.slice(0, 40).map(([k, x]) => {
      const waitU = !!x.wait && x.st !== 'ok';
      const cls = x.st === 'ok' ? 'ok' : x.st === 'loi' || x.st === 'bo' ? 'bad' : x.st === 'lam' || waitU ? 'warn' : 'muted';
      const extra =
        x.st === 'ok'
          ? ` ${fmtTime(x.okAt)}`
          : x.st === 'loi'
          ? ` ${x.n || 1}/${LD_MAX}${(x.retryAt || 0) > Date.now() ? ` – thử lại lúc ${fmtTime(x.retryAt)}` : ''}`
          : x.st === 'lam'
          ? ` ${fmtTime(x.fwdAt)}`
          : '';
      const why = x.msg ? `<div class="muted">${esc(x.msg)}</div>` : '';
      const stT = waitU ? '⏸ chờ bạn bấm Thực thi (đã chọn sẵn người) – bấm ▶ để làm lại' : LD_ST[x.st] || x.st;
      return `<tr><td>${esc(x.so || k)}</td><td class="${cls}">${esc(stT)}${esc(waitU ? '' : extra)}${why}</td></tr>`;
    });
    return {
      html: rows.length
        ? `<table class="ldt">${rows.join('')}</table>`
        : '<div class="muted">Chưa có hồ sơ – mở “Xử lý công việc” (Danh sách hồ sơ thụ lý) rồi bấm “Quét danh sách” hoặc bật 🤖.</div>',
      count: `✓ ${nOk} hôm nay · ○ ${nWait} chờ${nBad ? ` · ✗ ${nBad} lỗi` : ''}`,
    };
  }
  // vai trò Lãnh đạo: ẩn các dòng TB, hiện bảng Lãnh đạo (ô cài đặt vẽ lại khi cài đặt đổi và bạn không đang gõ trong bảng)
  function renderLd() {
    const box = $('#ldBox');
    if (!box) return;
    const on = isLd();
    const sel = $('#optVaiTro');
    if (sel && sel.value !== (on ? 'ld' : 'cv')) sel.value = on ? 'ld' : 'cv';
    ['#tbRow', '#stageRow', '#progRow', '#resetDone'].forEach((s) => {
      const e = $(s);
      if (e) e.style.display = on ? 'none' : '';
    });
    if (!on) {
      if (box.innerHTML) box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    const sig = JSON.stringify([S.opts.ctB4 || '', S.opts.ctCV || '', S.opts.ctLD || '', S.opts.ldBuoc || '', S.opts.ldLoop !== false, S.opts.ldWait || '']);
    if (!box.querySelector('#ldList') || (box.dataset.sig !== sig && !box.contains(root.activeElement))) {
      box.innerHTML = ldCardHtml();
      box.dataset.sig = sig;
    }
    const l = ldListHtml();
    box.querySelector('#ldList').innerHTML = l.html;
    box.querySelector('#ldCount').textContent = l.count;
    box.querySelector('#ldBlock').innerHTML = S.ld.block ? `<div class="ldblock">⛔ 🤖 dừng: ${esc(S.ld.block)} – sửa xong bấm “▶ Chạy cả TB”.</div>` : '';
  }
  const ldTailHint = () =>
    AUTO()
      ? `<div class="hint">👔 Vai trò <b>Lãnh đạo</b>, 🤖 đang BẬT: tiện ích tự tích “Ký duyệt hồ sơ”, Chuyển tiếp, chọn đúng tài khoản nhận bước 4 (${esc(
          ldRecv() || 'chưa đặt'
        )}), bấm Thực thi${S.opts.thuThucThi ? ' – đang bật “Chạy thử”: dừng ở Thực thi cho bạn bấm' : ''}; hồ sơ lỗi thì kêu ting, làm hồ sơ khác, thử lại sau (tối đa ${LD_MAX} lần).</div>`
      : '<div class="hint">👔 Vai trò <b>Lãnh đạo</b>, 🤖 đang TẮT: ▶ chỉ mở hồ sơ và tô vàng – bạn tự tích “Ký duyệt hồ sơ”, Chuyển tiếp, Thực thi (ở cửa sổ chọn người bấm ▶ để tiện ích chọn sẵn đúng người).</div>';
  // thông báo của trang (toastr…) – 30 câu gần nhất, để biết Thực thi / tích Đã xử lý / Trả hồ sơ thành công hay lỗi
  // (“loi” sau khi bỏ dấu có thể là “lời” → chỉ tính “Lỗi …” ở đầu thông báo, hoặc “có / bị / gặp / xảy ra lỗi”)
  const ERR_TOAST = /(khong thanh cong|that bai|^loi\b|\b(co|bi|gap|xay ra) loi\b|vui long|chua chon|khong the|khong duoc|khong co quyen|\berror\b)/;
  // chỉ thông báo nổi (toastr, swal, noty…) – không tính chữ cố định trong cửa sổ (.alert)
  const toastsSince = (t0) => S.toasts.filter((x) => x.t >= t0 && x.toast);
  const toastOk = (x) => !ERR_TOAST.test(x.text) && (/toast-success|swal2-success/.test(x.cls || '') || /thanh cong/.test(x.text));
  const toastBad = (x) => ERR_TOAST.test(x.text) || /toast-error|toast-warning|swal2-error/.test(x.cls || '');

  // thư mục thả vào (vd. cả “18 TH”): đi hết thư mục con, lấy mọi file
  async function filesFromEntries(entries) {
    const out = [];
    const walk = async (en, depth) => {
      if (!en || depth > 6) return;
      if (en.isFile) {
        try {
          const f = await new Promise((ok, no) => en.file(ok, no));
          try {
            f.__path = en.fullPath || ''; // đường dẫn trong thư mục thả vào (vd. “/18 TH/TB 1846/KH ….DDK.pdf”) – để biết file của thư mục TB nào
          } catch (e) {}
          out.push(f);
        } catch (err) {}
        return;
      }
      if (!en.isDirectory) return;
      const rd = en.createReader();
      for (;;) {
        const batch = await new Promise((ok, no) => rd.readEntries(ok, no)).catch(() => []);
        if (!batch.length) break;
        for (const x of batch) await walk(x, depth + 1);
      }
    };
    for (const en of entries) await walk(en, 0);
    return out;
  }
  // trang báo “Cập nhật thành công” sau lượt đính kèm → kiểm đúng hồ sơ + đủ 2 tập tin → TB ✓ Xong; Đóng cửa sổ Lưu kho (bạn cho phép),
  // tô vàng ô “Đã xử lý” của tác vụ (KHÔNG tích)
  async function onScanSaved() {
    const a = S.armedScan;
    if (!a || Date.now() - a.at > ARM_MS) return; // không phải ngay sau lượt đính kèm → không làm gì
    S.armedScan = null;
    stopNeed();
    if (!isAlive()) {
      msgObserver.disconnect();
      return setEvt(`${esc(DEAD_MSG)} Trang vừa báo “Cập nhật thành công” nhưng tiến độ CHƯA được ghi – mở bảng mới rồi đổi ô <b>Trạng thái</b> bằng tay.`, true);
    }
    let info = null;
    for (let k = 0; k < 24; k++) {
      info = luuKhoInfo(false);
      if (info && dosPairs(info).length && info.recs) break;
      await sleep(250);
    }
    const same = !!info && sameSet(dosPairs(info), a.pairs);
    const full = !!info && ['don', 'tbxn'].every((k) => info.kinds.includes(k));
    const x = a.tb ? S.data.find((y) => String(y.tb) === a.tb) : null;
    let msg;
    if (same && full) {
      // mốc “đã lưu kho hồ sơ quét” (chỉ ghi giờ – ✓ Xong khi Trả hồ sơ xong)
      if (x) markStage(x.tb, 'quet', 'auto');
      const xong = !!x && stageOf(x) === 'xong';
      msg = !x
        ? '✓ Đã lưu kho hồ sơ quét (hồ sơ không có trong dữ liệu TB – không ghi tiến độ).'
        : xong
          ? `✓ TB ${esc(x.tb)} – ${esc(whoOf(x))}: <b>xong</b> (đã lưu kho hồ sơ quét: Đơn đăng ký + Thông báo xác nhận).`
          : `✓ TB ${esc(x.tb)} – ${esc(whoOf(x))}: đã lưu kho hồ sơ quét – trạng thái chưa đổi (✓ Xong khi Trả hồ sơ xong).`;
      // Đóng cửa sổ Lưu kho hồ sơ quét → về Quy trình xử lý → tích (hoặc tô vàng) ô “Đã xử lý” của tác vụ
      const close = [...info.box.querySelectorAll('a, button')].find((b) => norm(b.textContent) === 'dong' && shownEl(b));
      if (close) {
        clickPage(close);
        msg += ' ' + esc(await tickTask('LuuKhoHoSoQuet', () => host.isConnected)) + '.';
      }
    } else
      msg =
        `• Trang báo “Cập nhật thành công” nhưng tiện ích không kiểm được ${same ? 'đủ 2 tập tin' : 'đúng hồ sơ'} trong cửa sổ Lưu kho hồ sơ quét` +
        (x ? ` – bạn xem trong cửa sổ Lưu kho đã đủ Đơn đăng ký + Thông báo xác nhận của TB ${esc(x.tb)} chưa (trạng thái chưa đổi – ✓ Xong khi Trả hồ sơ xong).` : '.');
    setEvt(msg, !(same && full));
  }

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
    // sau “Lưu thông tin đăng ký” (Tự động hết chờ câu này rồi mới bấm Hoàn tất)
    { stage: 'lt', re: /cap nhat don dang ky thanh cong/, say: 'Cập nhật đơn đăng ký thành công' },
    // sau khi BẠN bấm “Cập nhật” ở cửa sổ Hồ sơ quét (không nhầm “Cập nhật đơn đăng ký / dữ liệu pháp lý thành công”)
    { stage: 'quet', re: /cap nhat thanh cong/, say: 'Cập nhật thành công' },
    // tác vụ Cập nhật dữ liệu pháp lý xong (runTask2 chờ câu này)
    { stage: 'pl', re: /cap nhat du lieu phap ly thanh cong/, say: 'Cập nhật dữ liệu pháp lý thành công' },
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
      let tieWith = [];
      try {
        const f = (await act('donRead')).find((y) => y.ok);
        if (f && x) {
          const page = parseDon(f);
          if (page.chu.length || page.thua.length) {
            const r = matchTb(page, x);
            verdict = r.err || r.switched ? 'other' : r.tie ? 'tie' : 'ok';
            tieWith = r.tie || [];
          }
        }
      } catch (e) {}
      const markBtn = actBtn('markDon', a.tb, `Ghi nhận TB ${a.tb} đã nhập đơn`, ` data-lech="${a.lech || 0}"`);
      if (verdict === 'ok') {
        markStage(a.tb, 'don', 'auto', { lech: a.lech || 0 });
        setEvt(
          (stageOf({ tb: a.tb }) === 'xong'
            ? `✓ TB ${esc(a.tb)}${who}: <b>xong</b> (trang báo “${esc(ev.say)}”; hồ sơ quét đã lưu kho trước đó).`
            : `✓ TB ${esc(a.tb)}${who}: <b>đã nhập đơn</b> (trang báo “${esc(ev.say)}”) – trạng thái vẫn ○ Chưa xong; ◐ khi chuyển lãnh đạo, ✓ Xong khi Trả hồ sơ.`) +
            (a.lech ? ` ⚠ Lúc kiểm tra còn lệch ${a.lech} ô so với dữ liệu.` : ''),
          !!a.lech
        );
      } else if (verdict === 'other')
        setEvt(`• Trang báo “${esc(ev.say)}” nhưng đơn đang mở không phải của TB ${esc(a.tb)} – tiện ích không tự đánh dấu.`, true);
      else if (verdict === 'tie')
        setEvt(
          `• Trang báo “${esc(ev.say)}”; đơn đang mở khớp cả TB ${esc(tieWith.join(', '))} nên tiện ích không chắc là TB ${esc(a.tb)}${who}. Đúng thì bấm: ${markBtn}`,
          true
        );
      else
        setEvt(
          `• Trang báo “${esc(ev.say)}” nhưng cửa sổ đơn đã đóng nên tiện ích không kiểm được đó là đơn của TB ${esc(a.tb)}${who}. Đúng thì bấm: ${markBtn}`,
          true
        );
    })();
  }
  function onPageMessage(text, cls) {
    const t = norm(text);
    // nhớ mọi thông báo của trang (Thực thi / tích Đã xử lý thành công hay lỗi) kèm lớp của khung (toast-success, toast-error…)
    const c = String(cls || '');
    S.toasts.push({ t: Date.now(), text: t, raw: String(text || '').replace(/\s+/g, ' ').trim(), cls: c, toast: /toast|swal|noty|jq-toast|pnotify|notifyjs/.test(c) });
    if (S.toasts.length > 30) S.toasts.splice(0, S.toasts.length - 30);
    for (const ev of SAVE_EVENTS) {
      if (!ev.re.test(t)) continue;
      if (Date.now() - (lastEvt[ev.stage] || 0) < 4000) return; // tiêu đề + nội dung của cùng một thông báo
      lastEvt[ev.stage] = Date.now();
      S.lastMsg[ev.stage] = Date.now();
      if (ev.stage === 'lt') return;
      if (ev.stage === 'pl') S.lastPl = Date.now();
      else if (ev.stage === 'quet') onScanSaved();
      else onSaved(ev);
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
        onPageMessage(textOf(box), box.className);
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
      s.boQua && s.boQua.length && `bỏ qua thửa ${s.boQua.map((k) => k.split('|').reverse().join('/')).join(', ')}`,
      d && `trùng thửa với ${dupText(d)}`,
      s.lech ? `lệch ${s.lech} ô` : '',
      s.tnClick && !s.tn && `đã bấm Lưu hồ sơ lúc ${fmtTime(s.tnClick)}, chưa thấy “Lưu hồ sơ thành công” – kiểm tra trên VBDLIS (hồ sơ có thể đã có)`,
      s.htClick && !s.don && `đã bấm Hoàn tất lúc ${fmtTime(s.htClick)}, chưa thấy “Lưu đơn đăng ký thành công” – kiểm tra đơn trên VBDLIS`,
      s.fwd &&
        !s[s.fwd.k] &&
        `đã bấm ${FWD_LONG[s.fwd.k] || 'chuyển tiếp'} lúc ${fmtTime(s.fwd.at)} nhưng chưa xác nhận${s.fwd.bad ? ' (trang báo lỗi / chưa rõ)' : ''} – xem lại trên VBDLIS`,
      s.ld && s.ldBy === 'suy' && !s.kq && 'chuyển lãnh đạo: tiện ích suy ra (không thấy câu báo thành công) – nên kiểm tra trên VBDLIS',
      s.cv && !s.ld && !s.fwd && 'đã chuyển chuyên viên, chưa chuyển lãnh đạo',
      s.daDung && !s.ld && !s.xong && `lúc ${fmtTime(s.daDung)} trang báo số biên nhận đã được dùng cho hồ sơ khác – hồ sơ đã có trên VBDLIS, nên kiểm tra`,
      traPhase(s) && !s.fwd && 'lãnh đạo đã trả về – chưa Trả hồ sơ',
      s.xong &&
        s.xongBy === 'ds' &&
        (s.ldUnk
          ? 'Xong suy ra: không thấy hồ sơ trong Danh sách hồ sơ thụ lý (chưa chắc đã trả hồ sơ) – 🤖 tìm lại mỗi 30 phút, hồ sơ hiện lại thì đổi về ◐ làm tiếp'
          : 'Xong suy ra: không còn hồ sơ trong Danh sách hồ sơ thụ lý – sai thì đổi ô Trạng thái về ◐'),
      s.sot &&
        (s.sot.dup
          ? `lúc ${fmtTime(s.sot.at)} kiểm lại: còn ${s.sot.dup} hồ sơ cùng số biên nhận trong Danh sách hồ sơ thụ lý – bạn xem`
          : s.sot.khac
          ? `lúc ${fmtTime(s.sot.at)} kiểm lại: còn hồ sơ cùng số trong Danh sách hồ sơ thụ lý nhưng có thể của TB khác / tiếp nhận sau – bạn xem`
          : s.sot.lai
          ? `lúc ${fmtTime(s.sot.at)} kiểm lại: hồ sơ vẫn còn trong Danh sách hồ sơ thụ lý dù đã đổi về ◐ làm lại một lần – bạn xem`
          : !s.xong && `đã ✓ Xong mà lúc ${fmtTime(s.sot.at)} kiểm lại vẫn còn hồ sơ trong Danh sách hồ sơ thụ lý – đã đổi về ◐ để làm tiếp`),
      s.xong && s.chkN >= 3 && s.chk >= s.xong && 'kiểm lại 3 lần chưa chắc (danh sách chưa rõ) – tiện ích thôi kiểm TB này',
      x.ghiChu ? `ghi chú: ${x.ghiChu}` : '',
    ].filter(Boolean);
    return { st: showStage(x), s, warn };
  }
  // số TB tiếp nhận / nhập đơn / xong theo ngày (7 ngày gần nhất có làm)
  const dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  function dailyStats() {
    const m = new Map();
    const bump = (ts, k) => {
      const key = dayKey(ts);
      const v = m.get(key) || { tn: 0, don: 0, xong: 0 };
      v[k]++;
      m.set(key, v);
    };
    Object.values(S.stage).forEach((s) => {
      if (s.tn) bump(s.tn, 'tn');
      if (s.don) bump(s.don, 'don');
      if (s.xong) bump(s.xong, 'xong');
    });
    const today = dayKey(Date.now());
    const t = m.get(today) || { tn: 0, don: 0, xong: 0 };
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
    // kèm mẫu tab Trường (tích, thứ tự nút, giá trị mẫu bạn đặt – không lấy giá trị có thể là dữ liệu cá nhân)
    const mt = tplForBackup(S.tpl);
    S.bakTpl = { n: Object.keys(mt.out).length, dropped: mt.dropped, droppedTpl: mt.droppedTpl };
    const obj = { loai: 'vbdlis-tien-do', phienBan: PANEL_VERSION, luc: new Date().toISOString(), soTB: Object.keys(S.stage).length, tienDo: S.stage, soMau: S.bakTpl.n, mauTruong: mt.out };
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
      // (24/11) TB vừa bị lượt kiểm đổi về ◐ (sot) / bạn đổi tay về ◐ sau ✓ suy ra (dsNo): file sao lưu có ✓ CŨ HƠN thì không đưa ✓ trở lại
      const noX = (cur.sot && !cur.xong && +cur.sot.at) || +cur.dsNo || 0;
      ['tn', 'tnBy', 'don', 'donBy', 'lech', 'quet', 'quetBy', 'xong', 'xongBy', 'hoan', 'ack', 'boQua', 'cv', 'cvBy', 'ld', 'ldBy', 'kq', 'trk', 'trkBy', 'tra', 'traBy', 'daDung', 'kd'].forEach((k) => {
        if (noX && /^(xong|xongBy|tra|traBy)$/.test(k) && Math.max(+v.xong || 0, +v.tra || 0) < noX) return;
        // lượt kiểm đã bỏ dấu chặng theo bước của hồ sơ lúc đổi về ◐ → dấu cũ hơn trong file không quay lại
        if (cur.sot && !cur.xong && /^(kq|trk|trkBy|kd)$/.test(k) && (+v[k === 'trkBy' ? 'trk' : k] || 0) < (+cur.sot.at || 0)) return;
        if (m[k] == null && v[k] != null) m[k] = v[k];
      });
      if (m.fwd && m[m.fwd.k]) delete m.fwd; // bước đó đã xong → bỏ dấu “đang chuyển”
      // danh sách thửa đã nhập: gộp cả hai
      if (Array.isArray(v.nhap)) m.nhap = [...new Set([...(m.nhap || []), ...v.nhap])];
      // dấu hoãn cũ hơn mọi tiến độ ghi sau đó (tiếp nhận / nhập đơn / lưu kho / xong) → đã giải quyết, bỏ hoãn
      if (m.hoan && Math.max(m.tn || 0, m.don || 0, m.quet || 0, m.xong || 0) > (m.hoan.at || 0)) delete m.hoan;
      // “xong” và “tạm hoãn” không đi cùng nhau: giữ dấu mới hơn
      if (m.xong && m.hoan) {
        if ((m.hoan.at || 0) > m.xong) {
          delete m.xong;
          delete m.xongBy;
        } else delete m.hoan;
      }
      // ✓ Xong chỉ khi đã Trả hồ sơ (như markStage – bạn chốt 23/11)
      if (m.tra && !m.xong && !m.hoan) {
        m.xong = m.tra;
        m.xongBy = 'auto';
      }
      if (JSON.stringify(m) !== JSON.stringify(cur)) {
        latest[id] = m;
        upd++;
      }
    }
    S.stage = latest;
    await store.set({ tbStage: latest });
    renderTop();
    const mt = await tplRestore(j.mauTruong); // mẫu tab Trường: chỉ thêm mẫu máy này chưa có
    return { add, upd, luc: j.luc, ...mt };
  }
  // hộp đang mở che bảng → khóa phần bên dưới (Tab / Enter không tới được nút bị che)
  const coverPanel = (on) => {
    [$('.bd'), $('#result')].forEach((el) => {
      if (el) el.inert = !!on;
    });
  };
  // ---------- nạp tiến độ bằng Excel (bạn yêu cầu 23/11: “nạp tiến độ bằng exel nữa” – file tiện ích xuất ra, sửa cột Trạng thái) ----------
  // chữ của file CSV / TXT: UTF-16 (file tiện ích xuất / Excel “Unicode Text”), UTF-8 (có / không BOM – Excel “CSV UTF-8”), không thì mã Việt
  // của Windows (Excel “CSV”)
  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8);
    } catch (e) {}
    try {
      return new TextDecoder('windows-1258').decode(u8);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(u8);
    }
  }
  // bảng chữ: dấu Tab (file tiện ích xuất) / dấu chấm phẩy / dấu phẩy – đoán theo dòng đầu; ô trong ngoặc kép giữ nguyên dấu phân cách
  function parseDelimited(text) {
    const first = (String(text).split(/\r\n|\n|\r/).find((l) => l.trim()) || '');
    const count = (ch) => first.split(ch).length - 1;
    const delim = count('\t') ? '\t' : count(';') > count(',') ? ';' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else q = false;
        } else cell += c;
        continue;
      }
      if (c === '"' && cell === '') {
        q = true;
        continue;
      }
      if (c === delim) {
        row.push(cell);
        cell = '';
        continue;
      }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += c;
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
  // file .xlsx (Excel “Lưu thành Excel Workbook”): giải nén (DecompressionStream của trình duyệt), đọc trang tính đầu tiên
  async function xlsxRows(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--)
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    if (eocd < 0) throw new Error('file .xlsx hỏng (không đọc được)');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const ents = {};
    for (let k = 0; k < n && p + 46 <= u8.length; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const nlen = dv.getUint16(p + 28, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      ents[name] = { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), lho: dv.getUint32(p + 42, true) };
      p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    const read = async (name) => {
      const e = ents[name];
      if (!e) return null;
      const off = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true);
      const data = u8.subarray(off, off + e.csize);
      if (e.method === 0) return dec.decode(data);
      if (e.method !== 8) throw new Error('file .xlsx nén kiểu tiện ích không đọc được');
      return dec.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    };
    const xml = (s) => new DOMParser().parseFromString(s || '', 'application/xml');
    const tags = (doc, t) => [...doc.getElementsByTagNameNS('*', t)];
    let sheetPath = 'xl/worksheets/sheet1.xml';
    try {
      const wb = xml(await read('xl/workbook.xml'));
      const rel = xml(await read('xl/_rels/workbook.xml.rels'));
      const first = tags(wb, 'sheet')[0];
      const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const r = rid && tags(rel, 'Relationship').find((x) => x.getAttribute('Id') === rid);
      if (r) sheetPath = 'xl/' + String(r.getAttribute('Target') || '').replace(/^\/?(xl\/)?/, '');
    } catch (e) {}
    const sst = [];
    const ss = await read('xl/sharedStrings.xml');
    if (ss) tags(xml(ss), 'si').forEach((si) => sst.push(tags(si, 't').map((t) => t.textContent).join('')));
    const sx = await read(sheetPath);
    if (!sx) throw new Error('không thấy trang tính trong file .xlsx');
    const rows = [];
    for (const row of tags(xml(sx), 'row')) {
      const ri = (parseInt(row.getAttribute('r'), 10) || rows.length + 1) - 1;
      const arr = [];
      for (const c of tags(row, 'c')) {
        const ref = (c.getAttribute('r') || '').replace(/\d+/g, '');
        const col = ref ? ref.split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1 : arr.length;
        const t = c.getAttribute('t');
        const vEl = tags(c, 'v')[0];
        let val = '';
        if (t === 's') val = sst[+(vEl ? vEl.textContent : -1)] || '';
        else if (t === 'inlineStr') val = tags(c, 't').map((x) => x.textContent).join('');
        else val = vEl ? vEl.textContent : '';
        arr[col] = val;
      }
      rows[ri] = Array.from(arr, (x) => x || '');
    }
    return Array.from(rows, (r) => r || []);
  }
  // file bạn chọn → các hàng (mỗi hàng là danh sách ô chữ)
  async function readSheetRows(file) {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4b) return xlsxRows(buf); // “PK” – .xlsx
    if (u8[0] === 0xd0 && u8[1] === 0xcf) throw new Error('file Excel đời cũ (.xls) – mở bằng Excel, “Lưu thành” Excel Workbook (.xlsx) hoặc CSV rồi nạp lại');
    return parseDelimited(decodeText(buf));
  }
  // chữ ô Trạng thái → mức: ○ 'chua' · ◐ 'tn' · ✓ 'xong' · ⏸ 'hoan'; '' = ô trống (không đổi); null = không hiểu.
  // Nhận cả chữ mất dấu khi Excel lưu CSV bằng mã khác (vd. “Ch?a xong”) và chữ cũ (“Đã tiếp nhận” = ○, “Hoàn thành” = ✓)
  function stageFromText(v) {
    const raw = String(v ?? '').replace(/^\uFEFF/, '').trim();
    if (!raw) return '';
    if (/◐/.test(raw)) return 'tn';
    if (/⏸/.test(raw)) return 'hoan';
    if (/[✓✔]/.test(raw)) return 'xong';
    if (/○/.test(raw)) return 'chua';
    const t = norm(raw).replace(/[^a-z0-9? ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/ho.n th.nh/.test(t)) return 'xong';
    if (/t.m ho.n|^ho.n$/.test(t)) return 'hoan';
    if (/(^| ).a nh.p|nh.p nh.ng|chuy.n l.nh/.test(t)) return 'tn';
    if (/ch.a|ti.p nh.n/.test(t)) return 'chua';
    if (/^(da )?xong$|^xong |^x$/.test(t)) return 'xong';
    return null;
  }
  function progressTsv() {
    const head = ['TB', 'Trạng thái', 'Người nộp', 'Số thửa', 'Tiếp nhận lúc', 'Nhập đơn xong lúc', 'Chuyển lãnh đạo lúc', 'Xong lúc', 'Cần xem'];
    const rows = S.data.map((x) => {
      const p = progressInfo(x);
      return [x.tb, STAGE_TEXT[p.st], whoOf(x), (x.thua || []).length, fmtIso(p.s.tn), fmtIso(p.s.don), fmtIso(p.s.ld), fmtIso(p.s.xong), p.warn.join('; ')];
    });
    return [head, ...rows].map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n');
  }
  // UTF-16 (có BOM) + dấu Tab: Excel mở thẳng, đúng tiếng Việt, tách đúng cột với mọi cài đặt vùng
  function utf16Tsv(text) {
    const buf = new Uint8Array(2 + text.length * 2);
    buf[0] = 0xff;
    buf[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      buf[2 + 2 * i] = c & 255;
      buf[3 + 2 * i] = c >> 8;
    }
    return new Blob([buf], { type: 'text/csv' });
  }
  function downloadTsv() {
    return saveFile(`tien-do-vbdlis-${stamp()}.csv`, utf16Tsv(progressTsv()));
  }
  // ---------- TB LỖI (bạn yêu cầu 24/11: “khi chạy xong và soát lỗi 1 lượt xong thì xuất ra file excel các TB lỗi và tình trạng lỗi”) ----------
  // lỗi của một TB: ⏸ tạm hoãn (lý do), 🤖 dừng ở TB đó, đã bấm mà chưa xác nhận (Lưu hồ sơ / Hoàn tất / chuyển tiếp có lỗi), lệch ô,
  // số biên nhận đã dùng, kiểm lại TB ✓ còn hồ sơ, kiểm lại 3 lần chưa chắc
  function errInfo(x) {
    const s = S.stage[String(x.tb)] || {};
    const h = S.autoHold.get(String(x.tb));
    const errs = [
      s.hoan && `tạm hoãn: ${s.hoan.lyDo || 'không ghi lý do'}`,
      h && h.kind === 'err' && '🤖 dừng ở TB này (lần chạy trước lỗi) – chờ bạn bấm ▶',
      s.tnClick && !s.tn && 'đã bấm Lưu hồ sơ, chưa thấy “Lưu hồ sơ thành công” – kiểm tra trên VBDLIS',
      s.htClick && !s.don && 'đã bấm Hoàn tất, chưa thấy “Lưu đơn đăng ký thành công” – kiểm tra đơn',
      s.fwd && !s[s.fwd.k] && s.fwd.bad && `đã bấm ${FWD_LONG[s.fwd.k] || 'chuyển tiếp'} nhưng trang báo lỗi / chưa rõ – xem lại trên VBDLIS`,
      s.lech ? `lệch ${s.lech} ô so với dữ liệu` : '',
      s.daDung && !s.ld && !s.xong && 'số biên nhận đã được dùng cho hồ sơ khác',
      s.sot && (s.sot.dup || s.sot.khac || s.sot.lai) && 'kiểm lại TB ✓: còn hồ sơ trong Danh sách hồ sơ thụ lý – bạn xem',
      s.xong && s.chkN >= 3 && s.chk >= s.xong && 'kiểm lại 3 lần chưa chắc (danh sách chưa rõ)',
    ].filter(Boolean);
    return { s, errs };
  }
  function errRows() {
    return S.data.map((x) => ({ x, ...errInfo(x) })).filter((r) => r.errs.length);
  }
  function errTsv(rows) {
    const head = ['TB', 'Số biên nhận', 'Người nộp', 'Trạng thái', 'Lỗi / tình trạng', 'Tạm hoãn lúc'];
    const body = rows.map((r) => [r.x.tb, r.x.soBienNhan || '', whoOf(r.x), STAGE_TEXT[showStage(r.x)], r.errs.join('; '), r.s.hoan ? fmtIso(r.s.hoan.at) : '']);
    return [head, ...body].map((rr) => rr.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n');
  }
  function downloadErrTsv(rows) {
    return saveFile(`tb-loi-vbdlis-${stamp()}.csv`, utf16Tsv(errTsv(rows || errRows())));
  }
  // 🤖 tự xuất khi hết một lượt (tìm TB ◐ + kiểm TB ✓): chỉ khi danh sách TB lỗi khác lần xuất trước và cách lần trước ít nhất 10 phút (không tải
  // file liên tục khi 🤖 chạy vòng)
  const ERR_KEY = 'vbdlis-dien-nhanh-errexport';
  function autoErrExport() {
    const rows = errRows();
    if (!rows.length) return '';
    const sig = rows.map((r) => `${r.x.tb}:${r.errs.join('|')}`).join('#');
    let last = null;
    try {
      last = JSON.parse(sessionStorage.getItem(ERR_KEY) || 'null');
    } catch (e) {}
    if (last && (last.sig === sig || Date.now() - (last.at || 0) < 10 * 60 * 1000)) return '';
    let name = '';
    try {
      name = downloadErrTsv(rows);
    } catch (e) {
      return '';
    }
    try {
      sessionStorage.setItem(ERR_KEY, JSON.stringify({ sig, at: Date.now() }));
    } catch (e) {}
    setEvt(`📄 Hết một lượt chạy + soát: đã xuất file Excel <b>${esc(name)}</b> – ${rows.length} TB lỗi và tình trạng lỗi (thư mục Tải xuống).`);
    return name;
  }
  function selectTb(id) {
    if (S.running || !S.data.some((x) => String(x.tb) === String(id))) return false;
    setPtr(id);
    S.viewWant = null;
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
    // đổi trạng thái HÀNG LOẠT (bạn yêu cầu 23/11: “tôi muốn chọn hàng loạt tb để đổi hàng loạt trạng thái”)
    const sel = new Set(); // TB đã tích (giữ khi đổi bộ lọc)
    let lastIdx = -1; // dòng tích gần nhất (Shift + bấm = chọn liền một đoạn)
    let bulkV = ''; // trạng thái muốn đổi
    let imp = null; // nạp Excel: bảng xem trước { name, change: [{ id, from, to, lyDo }], same, miss, bad }
    const draw = () => {
      const pgl0 = d.querySelector('.pgl');
      const scrollTop0 = pgl0 ? pgl0.scrollTop : 0; // vẽ lại (tích / bỏ tích) không nhảy bảng về đầu
      const cur = curTB();
      const info = S.data.map((x) => ({ x, p: progressInfo(x) }));
      const cnt = { all: info.length, chua: 0, tn: 0, xong: 0, hoan: 0, warn: 0 };
      info.forEach(({ p }) => {
        cnt[p.st]++;
        if (p.warn.length) cnt.warn++;
      });
      const shown = info.filter(({ p }) => filter === 'all' || (filter === 'warn' ? p.warn.length : p.st === filter));
      [...sel].forEach((id) => S.data.some((x) => String(x.tb) === id) || sel.delete(id)); // TB đã bị xóa khỏi dữ liệu
      const hiddenSel = [...sel].filter((id) => !shown.some(({ x }) => String(x.tb) === id)).length;
      const allOn = shown.length > 0 && shown.every(({ x }) => sel.has(String(x.tb)));
      const stOpt = (v, t) => `<option value="${v}"${bulkV === v ? ' selected' : ''}>${t}</option>`;
      const fb = (f, label) => `<button class="btn${filter === f ? ' on' : ''}" data-f="${f}">${label} (${cnt[f]})</button>`;
      const ds = dailyStats();
      const days = ds.days.map(([k, v]) => `${k.slice(8, 10)}/${k.slice(5, 7)}: ${v.tn} tiếp nhận, ${v.don} nhập đơn, ${v.xong} xong`).join(' · ');
      d.innerHTML = `<div class="dh"><b>Tiến độ – ${S.data.length} TB</b><span class="sp"></span><button class="btn x" id="pgClose" title="Đóng (phím Esc)">✕ Đóng</button></div>
        <div class="days">Hôm nay: <b>${ds.today.tn}</b> TB tiếp nhận · <b>${ds.today.don}</b> TB nhập đơn · <b>${ds.today.xong}</b> TB xong${days ? `<br><span class="muted">${esc(days)}</span>` : ''}</div>
        ${
          imp
            ? `<div class="card pgimp"><div class="ct">Nạp từ Excel “${esc(imp.name)}” – xem trước</div>
              <div>${imp.change.length ? `Sẽ đổi <b>${imp.change.length}</b> TB theo Excel` : '<b>Không có TB nào khác</b> trạng thái tiện ích đang ghi'} · giống nhau ${imp.same.length} TB${
                imp.miss.length ? ` · ${imp.miss.length} dòng không có trong dữ liệu (bỏ qua): ${esc(imp.miss.slice(0, 12).join(', '))}${imp.miss.length > 12 ? '…' : ''}` : ''
              }${imp.bad.length ? ` · ${imp.bad.length} ô Trạng thái không hiểu (bỏ qua): ${esc(imp.bad.slice(0, 8).join('; '))}${imp.bad.length > 8 ? '…' : ''}` : ''}${
                imp.newer && imp.newer.length
                  ? ` · ${imp.newer.length} TB có tiến độ MỚI hơn lúc lưu file (giữ nguyên, không đổi theo file): ${esc(imp.newer.slice(0, 12).join(', '))}${imp.newer.length > 12 ? '…' : ''}`
                  : ''
              }</div>
              ${
                imp.change.length
                  ? `<div class="pgl" style="max-height:200px"><table class="sh"><tr><th>TB</th><th>Đang là</th><th>Theo Excel</th></tr>${imp.change
                      .slice(0, 300)
                      .map((c) => `<tr><td>${esc(c.id)}</td><td>${STAGE_ICON[c.from]} ${esc(STAGE_TEXT[c.from])}</td><td><b>${STAGE_ICON[c.to]} ${esc(STAGE_TEXT[c.to])}</b></td></tr>`)
                      .join('')}</table></div>`
                  : ''
              }
              <div class="row">${imp.change.length ? `<button class="btn pri" id="pgImpGo">Đổi ${imp.change.length} TB theo Excel</button>` : ''}<button class="btn" id="pgImpNo">${imp.change.length ? 'Hủy' : 'Đóng'}</button></div>
              <div class="hint">TB đã tiếp nhận mà Excel ghi “Chưa xong” vẫn giữ dấu đã tiếp nhận (tiện ích không tiếp nhận lại). Ô Trạng thái để trống thì không đổi. Tạm hoãn lấy lý do ở cột “Cần xem” nếu có.</div></div>`
            : ''
        }
        <div class="row pgf">${fb('all', 'Tất cả')}${fb('chua', '○ Chưa xong')}${fb('tn', '◐ Đã nhập chưa xong')}${fb('xong', '✓ Xong')}${cnt.hoan ? fb('hoan', '⏸ Tạm hoãn') : ''}${fb('warn', '⚠ Cần xem')}</div>
        <div class="row pgbulk"><span>Đã chọn <b>${sel.size}</b> TB${hiddenSel ? ` <span class="muted">(${hiddenSel} TB đang ẩn theo bộ lọc)</span>` : ''}</span><span class="sp"></span><input id="pgRange" placeholder="vd. 1640-1660, 1665" title="Chọn thêm theo số TB: một số, hoặc khoảng 1640-1660; cách nhau dấu phẩy / dấu cách" style="width:140px" spellcheck="false"><button class="btn" id="pgRangeBtn" title="Chọn thêm các TB có số này">Chọn</button></div>
        <div class="row pgbulk"><select id="pgBulkSt" style="width:auto">${stOpt('', 'Đổi trạng thái các TB đã chọn sang…')}${stOpt('chua', '○ Chưa xong')}${stOpt('tn', '◐ Đã nhập nhưng chưa xong')}${stOpt('xong', '✓ Xong')}${stOpt('hoan', '⏸ Tạm hoãn')}</select><button class="btn pri" id="pgBulkGo"${sel.size ? '' : ' disabled'} title="Đổi trạng thái mọi TB đã chọn (hỏi lại trước khi đổi)">Đổi</button><button class="btn" id="pgSelNone"${sel.size ? '' : ' disabled'}>Bỏ chọn</button></div>
        <div class="pgl"><table class="sh"><tr><th class="pgc"><input type="checkbox" id="pgSelAll" style="width:auto"${allOn ? ' checked' : ''} title="Chọn / bỏ chọn mọi TB đang hiện (theo bộ lọc)"></th><th></th><th>TB</th><th>Người nộp</th><th>Thửa</th><th>Tiếp nhận</th><th>Nhập đơn</th><th>Xong</th><th>Cần xem</th></tr>${
          shown
            .map(
              ({ x, p }) =>
                `<tr data-tb="${esc(x.tb)}" class="${x === cur ? 'cur' : ''} ${p.s.lech ? 'bad' : p.st === 'hoan' ? 'gap' : ''}"><td class="pgc"><input type="checkbox" data-pgsel="${esc(x.tb)}" style="width:auto"${
                  sel.has(String(x.tb)) ? ' checked' : ''
                }></td><td>${STAGE_ICON[p.st]}</td><td>${esc(x.tb)}</td><td>${esc(whoOf(x))}</td><td>${(x.thua || []).length}</td><td>${esc(fmtTime(p.s.tn))}</td><td>${esc(fmtTime(p.s.don))}</td><td>${esc(fmtTime(p.s.xong))}</td><td>${esc(p.warn.join('; '))}${
                  p.s.sot && p.s.xong ? ` <button class="btn" data-unsot="${esc(x.tb)}" title="Bạn đã xem trên VBDLIS – bỏ cảnh báo của lượt kiểm TB ✓">Bỏ cảnh báo</button>` : ''
                }</td></tr>`
            )
            .join('') || '<tr><td colspan="9" class="muted">Không có TB nào.</td></tr>'
        }</table></div>
        <div class="row"><button class="btn" id="pgCopy" title="Sao chép cả bảng – dán vào Excel là đúng cột">⧉ Sao chép bảng</button><button class="btn" id="pgCsv" title="Tải file mở bằng Excel">⬇ Tải file Excel</button><button class="btn" id="pgErr" title="Chỉ các TB lỗi (tạm hoãn, 🤖 dừng, đã bấm mà chưa xác nhận, lệch ô…) và tình trạng lỗi – 🤖 cũng tự xuất khi hết một lượt chạy + soát">⬇ TB lỗi (Excel)</button></div>
        <div class="row"><button class="btn" id="pgBak" title="Lưu tiến độ ra file: số TB, giờ, trạng thái, thửa đã nhập / bỏ qua và lý do tạm hoãn bạn gõ (không có tên, số giấy tờ trong dữ liệu); kèm các mẫu tab Trường (tích, thứ tự nút, giá trị mẫu bạn đặt – đã lọc tên người trong dữ liệu TB, tên tài khoản, dãy số dài)">⬇ Sao lưu tiến độ</button><button class="btn" id="pgRes" title="Nạp file sao lưu tiến độ (.json – gộp với tiến độ hiện có), hoặc file Excel tiện ích xuất ra (⬇ Tải file Excel, sửa cột Trạng thái – .csv / .xlsx): xem trước rồi đổi theo Excel">⬆ Nạp tiến độ…</button><input type="file" id="pgFile" accept=".json,.csv,.txt,.tsv,.xlsx,application/json,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none"><span class="muted" style="font-size:11px">${bakAt ? `Sao lưu gần nhất: ${esc(fmtTime(bakAt))}` : 'Chưa sao lưu lần nào'}</span></div>
        <div class="hint">Bấm một dòng để chọn TB đó. <b>Đổi hàng loạt</b>: tích ô đầu dòng (Shift + bấm = chọn liền một đoạn; ô trên cùng = mọi TB đang hiện theo bộ lọc; hoặc gõ số TB / khoảng rồi bấm “Chọn”), chọn trạng thái rồi bấm <b>Đổi</b>. Tiện ích tự ghi giờ từng bước (tiếp nhận, nhập đơn, lưu kho…); trạng thái: ○ Chưa xong tới khi Thực thi chuyển lãnh đạo → ◐ Đã nhập nhưng chưa xong → ✓ Xong khi Trả hồ sơ xong (chưa trả xong vẫn là ◐); sai thì đổi ô Trạng thái của TB đó. Gỡ / cài lại tiện ích hay đổi máy thì tiến độ mất – nên <b>Sao lưu tiến độ</b> cuối mỗi ngày. <b>Nạp tiến độ</b> nhận file sao lưu (.json) hoặc file Excel tiện ích xuất ra (sửa cột Trạng thái, lưu .csv / .xlsx) – xem trước rồi mới đổi.</div>
        <div id="pgMsg" class="hint"></div>`;
      const pgl1 = d.querySelector('.pgl');
      if (pgl1 && scrollTop0) pgl1.scrollTop = scrollTop0;
      if (d.isConnected) d.focus({ preventScroll: true }); // vẽ lại → giữ phím Esc đóng được hộp
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
      if (e.key === 'Enter' && e.target.id === 'pgRange') {
        e.preventDefault();
        const b = d.querySelector('#pgRangeBtn');
        if (b) b.click();
      }
    });
    // chọn thêm theo số TB: “1640-1660, 1665 1670” – khoảng so theo số, một số so cả chuỗi (hoặc theo số)
    const pickRange = (txt) => {
      const toks = String(txt || '')
        .replace(/\s*[-–]\s*/g, '-') // “1640 - 1660” = “1640-1660”
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      let n = 0;
      for (const t of toks) {
        const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(t);
        const hit = (x) => {
          const v = parseInt(x.tb, 10);
          if (m) {
            const a = Math.min(+m[1], +m[2]);
            const z = Math.max(+m[1], +m[2]);
            return v >= a && v <= z;
          }
          return String(x.tb) === t || (/^\d+$/.test(t) && v === +t);
        };
        S.data.forEach((x) => {
          const id = String(x.tb);
          if (hit(x) && !sel.has(id)) {
            sel.add(id);
            n++;
          }
        });
      }
      return n;
    };
    const applyStageTo = (id, v, o = {}) => {
      const s0 = S.stage[id] || {};
      if (v === 'hoan') markStage(id, 'hoan', 'tay', { lyDo: o.lyDo || '' });
      else if (v === 'tn') {
        // ◐ = đã chuyển lãnh đạo (ghi mốc; bỏ dấu Xong / đã Trả hồ sơ nếu có)
        S.stage[id] = s0.xong || s0.tra ? unXongTay(s0) : { ...s0 }; // TB chưa trả: giữ dấu đang Trả hồ sơ / không thấy
        markStage(id, 'ld', 'tay');
      } else if (v === 'chua' && (s0.tn || s0.don || s0.tnClick) && !o.wipeRecv) {
        // ○ cho TB đã tiếp nhận: GIỮ dấu đã tiếp nhận / nhập đơn (không tiếp nhận lại), bỏ dấu chuyển lãnh đạo / xong / hoãn
        const s = { ...s0 };
        ['ld', 'ldBy', 'kq', 'trk', 'trkBy', 'tra', 'traBy', 'xong', 'xongBy', 'hoan', 'fwd', 'daDung', 'kd', 'traMiss', 'sot', 'dsNo', 'sotN', 'chk', 'chkTry', 'chkN', 'ldUnk'].forEach((k) => delete s[k]);
        if (Object.keys(s).length) S.stage[id] = s;
        else delete S.stage[id];
        if (S.chainTb && String(S.chainTb.tb) === id) setChainTb(null);
        if (s.tn) redoSet(id, true); // (24/11) 🤖 tìm ở danh sách làm tiếp TB này
        saveStage(id);
      } else markStage(id, v, 'tay');
    };
    // bảng Excel → xem trước: hàng tiêu đề có cột “TB” + “Trạng thái” (10 hàng đầu); TB trong dữ liệu mà trạng thái Excel khác → đổi
    // mốc tiến độ mới nhất của một TB (để biết file Excel cũ hơn tiện ích)
    const stageLatest = (s) =>
      !s ? 0 : Math.max(0, ...['tn', 'don', 'quet', 'cv', 'ld', 'kq', 'trk', 'tra', 'xong', 'dsNo'].map((k) => +s[k] || 0), (s.hoan && +s.hoan.at) || 0, (s.sot && !s.xong && +s.sot.at) || 0);
    const excelPlan = (rows, name, fileAt) => {
      const clean = (s) => norm(String(s ?? '').replace(/^\uFEFF/, ''));
      let hi = -1;
      let cTb = -1;
      let cSt = -1;
      let cNote = -1;
      for (let i = 0; i < Math.min(10, rows.length) && hi < 0; i++) {
        const r = rows[i] || [];
        const a = r.findIndex((c) => /^(tb|so tb|tb so|so thong bao|thong bao)$/.test(clean(c)));
        const b = r.findIndex((c) => /^(trang thai|tinh trang)$/.test(clean(c)));
        if (a >= 0 && b >= 0) {
          hi = i;
          cTb = a;
          cSt = b;
          cNote = r.findIndex((c) => /^can xem$/.test(clean(c)));
        }
      }
      if (hi < 0) throw new Error('không thấy hàng tiêu đề có cột “TB” và cột “Trạng thái” – dùng file tiện ích xuất ra (nút “⬇ Tải file Excel”)');
      const byId = new Map(S.data.map((x) => [String(x.tb), x]));
      const want = new Map();
      const miss = [];
      const bad = [];
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const raw = String(r[cTb] ?? '').replace(/^\uFEFF/, '').trim();
        if (!raw) continue;
        const id = byId.has(raw) ? raw : /^\d+(\.0+)?$/.test(raw) ? String(parseInt(raw, 10)) : raw;
        if (!byId.has(id)) {
          miss.push(raw);
          continue;
        }
        const v = stageFromText(r[cSt]);
        if (v === '') continue;
        if (v === null) {
          bad.push(`TB ${id}: “${String(r[cSt]).slice(0, 30)}”`);
          continue;
        }
        const note = cNote >= 0 ? String(r[cNote] ?? '') : '';
        const m = /t[ạa]m ho[ãa]n:\s*([^;]*)/i.exec(note);
        want.set(id, { v, lyDo: m && !/không ghi lý do/i.test(m[1]) ? m[1].trim() : 'theo file Excel' });
      }
      const change = [];
      const same = [];
      const newer = []; // tiến độ của TB có mốc MỚI hơn lúc lưu file → file cũ hơn, giữ nguyên (không kéo lùi trạng thái)
      for (const x of S.data) {
        const id = String(x.tb);
        const w = want.get(id);
        if (!w) continue;
        const now = showStage(x);
        if (now === w.v) same.push({ id, from: now, to: w.v, lyDo: w.lyDo });
        else if (fileAt && stageLatest(S.stage[id]) > fileAt) newer.push(id);
        else change.push({ id, from: now, to: w.v, lyDo: w.lyDo });
      }
      return { name, change, same, miss, bad, newer };
    };
    const impApply = () => {
      if (!imp || !imp.change.length) return;
      if (S.running) return msg('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi đổi trạng thái.', true);
      if (deadGuard()) return;
      const list = imp.change;
      for (const c of list) applyStageTo(c.id, c.to, { lyDo: c.lyDo });
      S.confirmTn = null;
      S.confirmDon = null;
      renderTop();
      imp = null;
      draw();
      msg(`Đã đổi ${list.length} TB theo file Excel (đánh dấu tay).`);
      setStatus(`Đã đổi ${list.length} TB theo file Excel.`);
    };
    const bulkApply = async (v) => {
      if (S.running) return msg('Đang “Chạy cả TB” – bấm “■ Dừng” trước khi đổi trạng thái.', true);
      if (deadGuard()) return;
      const ids = S.data.map((x) => String(x.tb)).filter((id) => sel.has(id));
      if (!ids.length) return msg('Chưa chọn TB nào – tích ô đầu dòng (Shift + bấm để chọn liền một đoạn).', true);
      const list = ids.length > 30 ? `${ids.slice(0, 30).join(', ')} … (+${ids.length - 30} TB)` : ids.join(', ');
      if (!confirm(`Đổi ${ids.length} TB sang “${STAGE_TEXT[v]}” (đánh dấu tay)?\nTB: ${list}`)) return;
      let lyDo = '';
      if (v === 'hoan') {
        const r = prompt(`Lý do tạm hoãn ${ids.length} TB (vd. chưa rõ chủ, chờ hỏi lại…) – lý do được lưu cả trong file sao lưu tiến độ, đừng ghi tên hay số CCCD:`, '');
        if (r === null) return;
        lyDo = r.trim();
      }
      let wipeRecv = false;
      if (v === 'chua') {
        const rec = ids.filter((id) => {
          const s0 = S.stage[id] || {};
          return s0.tn || s0.don || s0.tnClick;
        });
        if (rec.length) {
          if (
            confirm(
              `${rec.length} TB trong số này đã tiếp nhận. Đổi về “Chưa xong”: bỏ dấu đã chuyển lãnh đạo / xong / tạm hoãn, GIỮ dấu đã tiếp nhận, nhập đơn (tiện ích không tiếp nhận lại các TB đó). Đồng ý?`
            )
          )
            wipeRecv = false;
          else if (
            confirm(
              `Xóa HẾT dấu của ${rec.length} TB đã tiếp nhận, kể cả dấu đã tiếp nhận? Chỉ làm khi đánh dấu nhầm – tiện ích sẽ TIẾP NHẬN LẠI các TB đó (dễ tạo hồ sơ TRÙNG trên VBDLIS nếu hồ sơ đã có).`
            )
          )
            wipeRecv = true;
          else return;
        }
      }
      for (const id of ids) applyStageTo(id, v, { lyDo, wipeRecv });
      S.confirmTn = null;
      S.confirmDon = null;
      renderTop();
      sel.clear();
      lastIdx = -1;
      draw();
      msg(`Đã đổi ${ids.length} TB sang “${STAGE_TEXT[v]}” (đánh dấu tay).`);
      setStatus(`Đã đổi ${ids.length} TB sang “${STAGE_TEXT[v]}”.`);
    };
    d.addEventListener('change', async (e) => {
      if (e.target.id === 'pgBulkSt') {
        bulkV = e.target.value;
        return;
      }
      if (e.target.id !== 'pgFile') return;
      const inp = e.target;
      const file = inp.files && inp.files[0];
      inp.value = '';
      if (!file) return;
      if (!/\.json$/i.test(file.name || '')) {
        try {
          imp = excelPlan(await readSheetRows(file), file.name || 'file Excel', file.lastModified || 0);
          draw();
          msg(imp.change.length ? `Xem trước: ${imp.change.length} TB sẽ đổi theo Excel – bấm “Đổi … TB theo Excel” để đổi.` : 'File Excel không có TB nào khác trạng thái tiện ích đang ghi.');
        } catch (err) {
          imp = null;
          draw();
          msg('Không nạp được file Excel: ' + friendly(err), true);
        }
        return;
      }
      try {
        const r = await restoreStage(file);
        draw();
        msg(`Đã nạp tiến độ (bản sao lưu ${r.luc ? fmtTime(Date.parse(r.luc)) : ''}): thêm ${r.add} TB, bổ sung ${r.upd} TB${r.tplAdd || r.tplKeep ? `; mẫu tab Trường: thêm ${r.tplAdd}, giữ ${r.tplKeep} mẫu đang có` : ''}.`);
      } catch (err) {
        msg('Không nạp được: ' + friendly(err), true);
      }
    });
    d.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      const row = e.target.closest('tr[data-tb]');
      if (b && b.dataset.unsot) {
        // bỏ cảnh báo giữ ✓ của lượt kiểm TB ✓ (bạn đã xem trên VBDLIS)
        await setMark(b.dataset.unsot, 'sot', null);
        draw();
        return msg(`Đã bỏ cảnh báo kiểm lại của TB ${b.dataset.unsot}.`);
      }
      // tích / bỏ tích: ô đầu dòng (bấm cả ô bao quanh cũng được); Shift + bấm = cả đoạn từ dòng tích gần nhất; ô tiêu đề = mọi TB đang hiện
      const cellSel = e.target.closest('.pgc');
      if (cellSel) {
        const cb = cellSel.querySelector('input[type="checkbox"]');
        if (!cb) return;
        if (e.target !== cb) cb.checked = !cb.checked; // bấm cạnh ô tích
        const rows = [...d.querySelectorAll('tr[data-tb]')];
        if (cb.id === 'pgSelAll') {
          rows.forEach((r) => (cb.checked ? sel.add(r.dataset.tb) : sel.delete(r.dataset.tb)));
          lastIdx = -1;
          return draw();
        }
        const id = cb.dataset.pgsel;
        const idx = rows.findIndex((r) => r.dataset.tb === id);
        if (e.shiftKey && lastIdx >= 0 && idx >= 0) {
          const a = Math.min(idx, lastIdx);
          const z = Math.max(idx, lastIdx);
          rows.slice(a, z + 1).forEach((r) => (cb.checked ? sel.add(r.dataset.tb) : sel.delete(r.dataset.tb)));
        } else if (cb.checked) sel.add(id);
        else sel.delete(id);
        lastIdx = idx;
        return draw();
      }
      if (b && b.id === 'pgImpGo') return impApply();
      if (b && b.id === 'pgImpNo') {
        imp = null;
        draw();
        return msg('Đã bỏ nạp file Excel – không đổi gì.');
      }
      if (b && b.id === 'pgRangeBtn') {
        const inp = d.querySelector('#pgRange');
        const n = pickRange(inp && inp.value);
        draw();
        return msg(n ? `Đã chọn thêm ${n} TB (đang chọn ${sel.size} TB).` : 'Không có TB nào khớp số / khoảng vừa gõ (vd. 1640-1660, 1665).', !n);
      }
      if (b && b.id === 'pgSelNone') {
        sel.clear();
        lastIdx = -1;
        return draw();
      }
      if (b && b.id === 'pgBulkGo') {
        const v = (d.querySelector('#pgBulkSt') || {}).value || bulkV;
        if (!v) return msg('Chọn trạng thái muốn đổi ở ô bên cạnh nút “Đổi”.', true);
        return bulkApply(v);
      }
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
      if (b && b.id === 'pgErr') {
        const er = errRows();
        if (!er.length) return msg('Không có TB lỗi nào.', false);
        try {
          return msg(`Đã tải “${downloadErrTsv(er)}” – ${er.length} TB lỗi – vào thư mục Tải xuống.`);
        } catch (err) {
          return msg('Không tải được file: ' + friendly(err), true);
        }
      }
      if (b && b.id === 'pgBak') {
        try {
          const name = backupStage();
          draw();
          return msg(`Đã lưu “${name}” vào thư mục Tải xuống (kèm ${(S.bakTpl || {}).n || 0} mẫu tab Trường${(S.bakTpl || {}).dropped ? `; ${S.bakTpl.dropped} giá trị mẫu / nút có thể là dữ liệu cá nhân không đưa vào file` : ''}${(S.bakTpl || {}).droppedTpl ? `; ${S.bakTpl.droppedTpl} mẫu có tên người / tài khoản không đưa vào file` : ''}) – cất file này cẩn thận (cài lại tiện ích thì Nạp tiến độ từ file này).`);
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

  // ---------- Tự động hết: tự chạy khi mở màn hình cần làm ----------
  // Mỗi 2,5 giây xem màn hình đang mở; màn hình MỚI (khác lần trước) cần làm thì tự bấm “▶ Chạy cả TB”.
  // Chạy dừng giữa chừng (lỗi / chờ bạn) thì không tự chạy lại trên cùng màn hình đó – bạn sửa xong bấm ▶, hoặc mở màn hình khác.
  let autoTicking = false;
  // bạn đã tích nút “Thực thi” trong mẫu của cửa sổ chọn người (tab Trường, ảnh 13) = cho 🤖 tự chuyển cả khi cửa sổ do bạn mở
  // (vẫn kiểm đủ: đúng bước “(Tiếp theo)”, đúng hồ sơ trong dữ liệu, đúng tài khoản trong cài đặt, chưa bấm Thực thi bước này)
  function chooserTplGo() {
    return Object.values(S.tpl || {}).some(
      (t) => t && t.scope === 'modal' && CHOOSER_MODAL.test(t.titleKey || '') && (t.btns || []).some((b) => b.on && b.key === 'thuc thi')
    );
  }
  // cửa sổ tiện ích tự làm theo cách riêng (🤖 không chạy mẫu thay chuỗi – phần bạn tích ở các cửa sổ này 🤖 làm thêm trước nút chốt):
  // đơn, chủ, thửa, chọn người, Quy trình, Trả hồ sơ
  const CHAIN_WIN = [DON_MODAL, CHU_MODAL, THUA_MODAL, CHOOSER_MODAL, /^quy trinh xu ly\b/, /^tra ho so\b/];
  // cửa sổ của chuỗi mà 🤖 được tự đóng (không lưu) khi rời TB vừa tạm hoãn (chạy liên tục, 24/11) – cửa sổ khác thì không đụng
  const CV_LEAVE_WIN = [...CHAIN_WIN, /^ket iso\b/, /^cap nhat du lieu phap ly\b/, /^luu kho ho so quet\b/, /^(thong tin )?ho so quet\b/];
  // cửa sổ của chuỗi chỉ có nút, KHÔNG có ô nhập (Lưu kho hồ sơ quét, Hồ sơ quét, Cập nhật dữ liệu pháp lý) – bộ điền (dialogState) đếm là “hộp”
  // nhưng không phải hộp hỏi / báo của trang (soát 24/11: 🤖 tưởng hộp chưa dạy → đứng im, hoặc dừng chờ bạn bấm ▶). Chỉ số các hộp THẬT của một
  // kết quả dialogState / có hộp thật đang mở không
  const BOX_WIN = [/^luu kho ho so quet\b/, /^(thong tin )?ho so quet\b/, /^cap nhat du lieu phap ly\b/];
  const realDlgIdx = (x) =>
    x && x.open
      ? pageDialog()
        ? (x.titles || []).map((t, i) => i)
        : (x.titles || []).map((t, i) => (BOX_WIN.some((re) => re.test(norm(t || '').replace(/^[^a-z0-9]+/, ''))) ? -1 : i)).filter((i) => i >= 0)
      : [];
  const realDlgOpen = (rs) => (rs || []).some((x) => realDlgIdx(x).length > 0);
  // mẫu đã lưu (tab Trường, có ô / nút đã tích) của cửa sổ đang mở trên cùng – chỉ cửa sổ tiện ích không tự làm.
  // Cửa sổ hồ sơ quét / lưu kho / cập nhật dữ liệu pháp lý: tiện ích tự làm; Quy trình xử lý nằm DƯỚI cửa sổ trên cùng thì không tính
  function autoTplFor(k) {
    if (!k || CHAIN_WIN.some((re) => re.test(k))) return null;
    const scr = scanScreen();
    if (scr && scr !== 'quytrinh') return null;
    const t = tplForWin(k, '');
    return tplOn(t) ? t : null;
  }
  // 🤖 vai trò Lãnh đạo: chữ ký màn hình – '' không làm gì. Danh sách: hồ sơ chờ ký duyệt → 'lds:'; trang sau → 'ldp:'; hết hồ sơ → chờ N giây
  // → 'ldr:' (tải lại danh sách). Quy trình “Ký duyệt hồ sơ” → 'ldq:'; cửa sổ chọn người do tiện ích vừa Chuyển tiếp → 'ldc:'. Hồ sơ vừa lỗi
  // mà cửa sổ còn mở (Chạy liên tục) → 20 giây sau (bạn không thao tác) 'ldback:' về danh sách làm hồ sơ khác
  async function ldScreen(top) {
    for (const s0 of [...S.autoFail]) if (/^ld/.test(s0) && Date.now() - ((S.autoFailAt || {})[s0] || 0) > 3 * 60 * 1000) S.autoFail.delete(s0);
    if (S.ld.block) {
      // (soát 24/11) bạn đã sửa (đăng nhập đúng tài khoản / điền người nhận bước 4) → tự làm tiếp, không phải bấm ▶
      if (ldPreOk()) {
        S.ld.block = '';
        ldSave();
        renderLd();
        for (const s0 of [...S.autoFail]) if (/^ld/.test(s0)) S.autoFail.delete(s0);
        S.autoSig = '';
        setStatus('🤖 Lãnh đạo: tài khoản / cài đặt đã đúng – làm tiếp.');
      } else {
        if (S.holdNote !== 'ldBlock') {
          S.holdNote = 'ldBlock';
          setStatus(`🤖 Lãnh đạo đang dừng: ${S.ld.block} – sửa xong là 🤖 tự làm tiếp (hoặc bấm “▶ Chạy cả TB”).`, true);
        }
        return '';
      }
    }
    // bạn bấm ■ Dừng → 🤖 không làm gì ở mọi màn hình (cả Quy trình / cửa sổ chọn người đang mở) tới khi bấm ▶ / bật lại 🤖
    if (S.sweepPause) {
      if (S.holdNote !== 'sweepPause') {
        S.holdNote = 'sweepPause';
        setStatus('🤖 Lãnh đạo: đã tạm dừng (bạn bấm ■ Dừng) – bấm “▶ Chạy cả TB” (hoặc tắt / bật lại 🤖) để làm tiếp.', true);
      }
      return '';
    }
    const k = top ? modalKey(top) : '';
    const c = S.ld.cur && Date.now() - S.ld.cur.at < 10 * 60 * 1000 ? S.ld.cur : null;
    const it = c ? S.ld.items[c.key] || {} : {};
    const backSig = () => {
      if (!c || !(it.st === 'loi' || it.st === 'bo')) return '';
      if (Date.now() - (it.failAt || 0) < 20000 || Date.now() - USER.at < 20000) return '';
      return `ldback:${c.key}:${it.n || 0}`;
    };
    // (soát 24/11) cửa sổ đứng yên mà 🤖 không có việc ở đó (hồ sơ đã ✓ / chờ xác nhận / bỏ qua / chưa tới giờ thử lại, cửa sổ lạ…), bạn không thao
    // tác 30 giây, trang không “Đang xử lý…” → về danh sách làm hồ sơ khác (không lưu gì)
    // (soát 24/11) cửa sổ không do 🤖 làm (cửa sổ lạ, Quy trình bước khác) → chờ lâu hơn (90 giây), và bạn đã thao tác sau lần chạy cuối của 🤖 → cửa sổ
    // của bạn: không rời
    const leaveSig = (why, ms) => {
      if (!top) return '';
      if (ms && Math.max(USER.at, USER.viewAt || 0) > (S.runEndAt || 0)) return '';
      const key2 = `${k}|${why}`;
      if (!S.ldStk || S.ldStk.key !== key2) {
        S.ldStk = { key: key2, at: Date.now() };
        return '';
      }
      if (Date.now() - S.ldStk.at < (ms || 30000) || !userQuiet(20000) || pageWorking()) return '';
      return `ldback:${why}:${Math.floor(Date.now() / 60000)}`;
    };
    if (top && CHOOSER_MODAL.test(k)) {
      const b = backSig();
      if (b) return b;
      const cm = chooserModal();
      const info = cm ? chooserInfo(cm) : null;
      if (c && c.phase === 'ct' && !(it.st === 'loi' || it.st === 'bo' || it.st === 'lam')) {
        if (!info || info.loading || !info.rows.length) return '';
        return `ldc:${c.key}:${c.at}`;
      }
      const soC = await dossierSo();
      const keyC = soC ? soKey(soC) : '';
      const xC = keyC ? S.ld.items[keyC] : null;
      // Chạy thử / tiện ích đã chọn sẵn đúng người cho BẠN bấm Thực thi → chờ bạn (không rời, không tự bấm)
      if (S.opts.thuThucThi || (S.ld.tt && S.ld.tt.key === keyC) || (xC && xC.wait)) return '';
      // (24/11) cửa sổ chọn người mở sẵn (bạn mở / lần chạy trước dừng): hồ sơ còn phải ký duyệt, bạn không thao tác 20 giây, trang không “Đang xử lý…”,
      // không ai khác được chọn → 🤖 làm tiếp: chọn đúng người nhận bước 4, Thực thi (đủ kiểm tra) – bạn yêu cầu “xem nó đang ở đâu thì làm tiếp”
      if (AUTO() && info && !info.loading && info.rows.length && userQuiet(20000) && !pageWorking()) {
        if (USER.btn === 'thuc thi' && Date.now() - USER.btnAt < 60000) return ''; // bạn vừa tự bấm Thực thi
        if (markedRows(info.rows).some((r) => accNorm(r.acc) !== accNorm(ldRecv()))) return ''; // bạn đang chọn người khác → chờ bạn
        if (keyC && (!xC || xC.st === 'cho' || (xC.st === 'loi' && (xC.n || 0) < LD_MAX && Date.now() >= (xC.retryAt || 0))))
          return `ldc:${keyC}:adopt:${Math.floor(Date.now() / 60000)}`;
      }
      return leaveSig('cho');
    }
    if (top && /^quy trinh xu ly\b/.test(k)) {
      const b = backSig();
      if (b) return b;
      const m = qtModal();
      const rows = m ? qtRows(m) : [];
      if (qtVariant(rows) !== 'kd' || qtFilterText(m)) return leaveSig('qt', 90000);
      const so = await dossierSo();
      const key = so ? soKey(so) : '';
      if (!key) return leaveSig('qt');
      const x = S.ld.items[key] || {};
      if (x.wait || x.st === 'ok' || x.st === 'bo' || x.st === 'lam' || (x.st === 'loi' && ((x.n || 0) >= LD_MAX || Date.now() < (x.retryAt || 0)))) return leaveSig(`qt-${x.st || ''}`);
      const sq = `ldq:${key}:${rows.map((r) => (r.chk && r.chk.checked ? 1 : 0)).join('')}`;
      if (S.autoFail.has(sq)) return leaveSig('qt-fail');
      return sq;
    }
    if (top) {
      const b = backSig();
      if (b) return b;
      // cửa sổ khác bạn đã lưu mẫu (tab Trường) → 🤖 điền / bấm theo mẫu (như vai trò Chuyên viên)
      const t = autoTplFor(k);
      return t ? tplSigOf(t, top.oid || '', 'tpl') : leaveSig('w', 90000);
    }
    S.ldStk = null;
    if (onListPage()) {
      noteListUrl();
      deadPageOk();
      // bạn vừa thao tác trên trang (15 giây; ô tìm đang có chữ BẠN gõ → 60 giây) hoặc trên bảng điền (20 giây) → chờ
      const sb = sbnSearch();
      const userQ = !!sb && !!sb.input.value.trim() && sb.input.value !== S.sweepTyped;
      const quiet = Date.now() - USER.at >= (userQ ? 60000 : 15000) || (!userQ && (S.autoOnAt || 0) > USER.at);
      if (!quiet || Date.now() - (S.panelAt || 0) < 20000) return '';
      const rows = ldScanPage();
      const r = rows.find(ldCand);
      if (r) return `lds:${r.key}:${(S.ld.items[r.key] || {}).n || 0}`;
      // hồ sơ đã chuyển mà danh sách (chưa tải lại) vẫn ghi bước lãnh đạo quá 2 phút → tải lại danh sách để chắc
      const stale = rows.some((x) => {
        const y = S.ld.items[x.key];
        return y && y.st === 'ok' && LD_STEP.test(x.step) && !ldFresh(y.okAt, 120000) && Date.now() - (y.okAt || 0) > 120000;
      });
      if (stale) return `ldr:${Math.floor(Date.now() / 60000)}`;
      // (soát 24/11) hồ sơ “đã bấm Thực thi” còn hiện ở bước lãnh đạo trên danh sách CŨ (chưa tải lại sau lúc bấm) → tải lại trang (mỗi phút tối đa 1 lần)
      const lamStale = rows.some((x) => {
        const y = S.ld.items[x.key];
        return y && y.st === 'lam' && LD_STEP.test(x.step) && !ldFresh(y.fwdAt || y.at) && Date.now() - (y.fwdAt || y.at || 0) > 10000;
      });
      if (lamStale) return `ldr:${Math.floor(Date.now() / 60000)}`;
      const lam = Object.entries(S.ld.items).find(
        ([kk, y]) => y.st === 'lam' && Date.now() - (y.fwdAt || y.at || 0) > 10000 && !rows.some((x) => x.key === kk) && (S.ld.refAt || 0) <= (y.fwdAt || y.at || 0)
      );
      if (lam) return `ldv:${lam[0]}:${lam[1].fwdAt || 0}:${Math.floor(Date.now() / 60000)}`;
      const pg = ldPager();
      if (pg && pg.next && (S.ld.pages || 0) < 20) return `ldp:${pg.cur || ''}:${rows.map((x) => x.key).join(',').slice(0, 80)}`;
      if (S.opts.ldLoop === false) return '';
      if (!S.ld.idleAt) {
        S.ld.idleAt = Date.now();
        ldSave();
      }
      const left = S.ld.idleAt + ldWaitMs() - Date.now();
      if (left > 0) {
        setStatus(`🤖 Lãnh đạo: hết hồ sơ chờ ký duyệt – tải lại danh sách sau ${Math.ceil(left / 1000)} giây.`);
        return '';
      }
      return `ldr:${S.ld.idleAt}`;
    }
    // màn hình khác, không có cửa sổ: bạn không thao tác 20 giây (vừa bật 🤖 thì đi ngay) → 🤖 sang “Xử lý công việc”
    if (Date.now() - USER.at < 20000 && !((S.autoOnAt || 0) > USER.at)) return '';
    if (btnLuuHoSo() && (await recvTyped())) return ''; // màn hình Tiếp nhận đang có chữ bạn gõ → không rời trang
    if (!navXuLyCongViec()) {
      if (!btnLuuHoSo() && !btnXuLyHoSo()) deadPageReload(); // trang lỗi (vd. sau khi tải lại) → tải lại, chờ tăng dần
      return '';
    }
    return `ldnav:${Math.floor(Date.now() / 60000)}`;
  }
  async function autoScreen() {
    const top = (await act('modalState')).find((x) => x.open);
    const dlg = (await act('dialogState')).find((x) => realDlgIdx(x).length > 0); // cửa sổ Lưu kho / Hồ sơ quét không phải hộp (soát 24/11)
    if (dlg) {
      // hộp hỏi bạn đã dạy (lấy hộp ở tab Trường, tích nút trả lời) → 🤖 trả lời bằng mẫu đó, mỗi lần hộp hiện một lần – cả hộp báo LỖI bạn đã dạy
      // (bạn yêu cầu 24/11: “các lỗi tôi đã dạy thì hãy làm đúng quy trình”); hộp chưa dạy → chờ bạn (giữ nguyên)
      const i = realDlgIdx(dlg).find((j) => {
        const kk = (dlg.keys || [])[j];
        return S.tpl[kk] && (S.tpl[kk].btns || []).some((b) => b.on);
      });
      if (i === undefined) return null;
      return tplSigOf(S.tpl[dlg.keys[i]], (dlg.oids || [])[i] || '', 'tpl');
    }
    // vai trò Lãnh đạo: bộ theo dõi riêng (không tiếp nhận, không nhập đơn)
    if (isLd()) return ldScreen(top);
    // 🤖 chạy liên tục: lần chạy vừa tạm hoãn một TB vì vướng – 20 giây sau (bạn không thao tác; bạn vừa bấm / gõ thì chờ tiếp) đóng cửa sổ của chuỗi,
    // về danh sách / Tiếp nhận làm TB khác. Đang ở danh sách, không còn cửa sổ → làm tiếp như thường
    {
      const lv = S.cvLeave && Date.now() - S.cvLeave.at < 15 * 60 * 1000 ? S.cvLeave : null;
      // hộp chưa dạy hiện lúc 🤖 đóng cửa sổ đã được trả lời (tới đây là không còn hộp) → đếm lại từ lúc này, 20 giây sau (bạn không thao tác) đóng tiếp
      if (lv && lv.box && ((S.stage[String(lv.tb)] || {}).hoan || lv.done)) {
        S.cvLeave = { ...lv, at: Date.now(), box: 0 };
        return '';
      }
      // (soát 24/11) bạn đã bỏ tạm hoãn TB đó, hoặc đã bấm / gõ trên trang sau lúc tạm hoãn (bạn đang tự xử lý) → thôi rời
      if (!lv || (!(S.stage[String(lv.tb)] || {}).hoan && !lv.done) || USER.at > lv.at + 1500) S.cvLeave = null;
      else if (!top && onListPage()) S.cvLeave = null;
      else
        return (!lv.now && Date.now() - lv.at < 20000) || Date.now() - USER.at < 20000 || Date.now() - (S.panelAt || 0) < 20000
          ? ''
          : `cvback:${lv.tb}:${lv.at}`;
    }
    const k = top ? modalKey(top) : '';
    if (top && DON_MODAL.test(k)) {
      // chỉ tự chạy đơn của TB đang làm (TB đang chọn): Mã đơn = số biên nhận của đúng TB đó. Đơn của TB khác → bạn bấm ▶
      const f = (await act('donRead')).find((x) => x.ok);
      if (!f || !f.maDon) return '';
      const l = tbOfSo(f.maDon).list;
      if (l.length !== 1 || !isWorkTb(l[0].tb) || (S.stage[String(l[0].tb)] || {}).hoan) return '';
      return `don:${l[0].tb}:${f.maDon}`;
    }
    // TB của hồ sơ đang mở (theo Số biên nhận) – chỉ tự chạy chuyển tiếp cho TB đang làm (TB đang chọn trong bảng)
    const curDossierTb = async () => {
      const soC = await dossierSo();
      noteQtSo(soC);
      const list = tbOfSo(soC).list;
      return list.length === 1 && isWorkTb(list[0].tb) ? list[0] : null;
    };
    if (top && CHOOSER_MODAL.test(k)) {
      // cửa sổ chọn người đang mở (bạn mở / lần chạy trước dừng ở đây) + bạn đã tích “Thực thi” trong mẫu cửa sổ này
      // → 🤖 tự chọn đúng tài khoản trong cài đặt rồi Thực thi (đủ kiểm tra như khi tiện ích tự chuyển tiếp)
      if (!chooserTplGo()) return '';
      const cm = chooserModal();
      const info = cm ? chooserInfo(cm) : null;
      if (!info || info.loading || !info.rows.length) return '';
      const l = tbOfSo(await dossierSo()).list;
      if (l.length !== 1 || (S.stage[String(l[0].tb)] || {}).hoan) return '';
      // bảng tích của mẫu cửa sổ chọn người đang mở (bạn đang tích) → chờ bạn đóng bảng tích
      if (S.tplDraft && S.tplDraft.scope === 'modal' && CHOOSER_MODAL.test(S.tplDraft.titleKey || '') && S.tab === 'tr' && !pn.classList.contains('min')) {
        autoWaitNote(S.tplDraft, '🤖 sẽ chọn tài khoản trong cài đặt rồi bấm Thực thi khi bạn đóng bảng tích (Lưu mẫu / Đóng)');
        return null;
      }
      return `cho:${l[0].tb}:${norm(info.step)}`;
    }
    if (top && /^quy trinh xu ly\b/.test(k)) {
      const m = qtModal();
      const rows = m ? qtRows(m) : [];
      const v = qtVariant(rows);
      if (qtFilterText(m)) return ''; // ô tìm tác vụ có chữ (tác vụ bị ẩn) → không tự chạy
      if (v === 'tn' || v === 'cv') {
        // Quy trình “Tiếp nhận hồ sơ” / “Nhập đăng ký + Giấy tờ đính kèm” → tích Đã xử lý, chuyển tiếp (chỉ TB đang làm)
        const x = await curDossierTb();
        if (!x || (S.stage[String(x.tb)] || {}).hoan) return '';
        return `qt:${v}:${x.tb}:${rows.map((r) => (r.chk.checked ? 1 : 0)).join('')}`;
      }
      if (v === 'kq' || v === 'tra') {
        // hồ sơ lãnh đạo đã trả về (bạn mở Quy trình): đúng MỘT TB trong dữ liệu
        const soQt = await dossierSo();
        noteQtSo(soQt);
        const list = tbOfSo(soQt).list;
        if (list.length !== 1) return '';
        const x = list[0];
        const st = S.stage[String(x.tb)] || {};
        if (st.hoan) return '';
        const kindRow = (q) => rows.find((r) => qtKindOf(r) === q);
        if (v === 'tra') {
          // Kết ISO đã tích, Trả hồ sơ chưa → Trả hồ sơ (Thực hiện, Đồng ý)
          const iso = kindRow('iso');
          const tra = kindRow('tra');
          return (iso.chk.checked || isoAuto()) && !tra.chk.checked && !st.tra ? `tra:${x.tb}` : '';
        }
        const nd = kindRow('nhap');
        if (nd && !nd.chk.checked) return '';
        const need2 = !kindRow('pl').chk.checked;
        const need3 = !kindRow('lk').chk.checked && scanReady(x); // có file quét CỦA hồ sơ này / trang đã lưu hồ sơ quét (soát 24/11)
        const all = rows.every((r) => r.chk.checked); // bạn đã Kết ISO, tích đủ → chuyển bước Trả kết quả
        // bạn bật “Tự Kết ISO”: chỉ còn thiếu Kết ISO → 🤖 tự Kết ISO rồi chuyển bước Trả kết quả
        const left = rows.filter((r) => !r.chk.checked);
        const needIso = isoAuto() && left.length > 0 && left.every((r) => qtKindOf(r) === 'iso');
        return need2 || need3 || all || needIso ? `kq:${x.tb}:${qtSig(rows)}:${S.scanQ.length}` : '';
      }
      if (scanScreen() !== 'quytrinh') return '';
      {
        // hồ sơ của TB đang tạm hoãn (vd. tiện ích vừa tạm hoãn vì trang báo không cập nhật được dữ liệu pháp lý) → 🤖 không làm lại tác vụ
        const l = tbOfSo(await dossierSo()).list;
        if (l.length === 1 && (S.stage[String(l[0].tb)] || {}).hoan) return '';
      }
      const nd = qtTaskCheck('NhapDangKy');
      const k2 = qtTaskCheck('CapNhatDuLieuPhapLy');
      const k3 = qtTaskCheck('LuuKhoHoSoQuet');
      if (nd && !nd.checked) return '';
      const need2 = k2 && !k2.checked;
      const need3 = k3 && !k3.checked && S.scanQ.length > 0;
      return need2 || need3 ? `qt:${need2}:${k3 && k3.checked}:${S.scanQ.length}:${openDossierNumbers().join(',')}` : '';
    }
    if (top) {
      // cửa sổ khác mà bạn đã lưu mẫu (tab Trường) → 🤖 điền các ô đã tích + bấm các nút đã tích (mỗi lần cửa sổ mở một lần).
      // Bạn vừa bấm / gõ trên trang: bộ theo dõi chờ 3 giây (mọi màn hình)
      const t = autoTplFor(k);
      if (!t) return '';
      // cửa sổ Kết ISO chuỗi vừa mở (runIso) mà chuỗi dừng trước khi nhận ra cửa sổ (■ Dừng…) → không chạy mẫu trên lần mở đó
      if (/^ket iso\b/.test(k) && Date.now() - (S.isoClickAt || 0) < 60000) {
        if (top.oid) S.tplRan.add(`${t.key}|${top.oid}`);
        S.isoClickAt = 0;
        return '';
      }
      return tplSigOf(t, top.oid || '', 'tpl');
    }
    // vừa bấm Thực thi chuyển lãnh đạo, trang tải lại, hồ sơ không còn nút “Xử lý hồ sơ” → ghi nhận đã chuyển, sang TB sau
    {
      const ids = [String(S.recv), chainTbId()].filter(Boolean).filter((id) => {
        const s0 = S.stage[id] || {};
        return s0.fwd && s0.fwd.k === 'ld' && !s0.fwd.bad && !s0.ld && Date.now() - s0.fwd.at < 10 * 60 * 1000;
      });
      if (ids.length && !btnXuLyHoSo() && linkVeTiepNhan()) {
        const x = await curDossierTb();
        return x && ids.includes(String(x.tb)) ? `ldx:${x.tb}` : '';
      }
    }
    // Danh sách hồ sơ thụ lý (thanh trái “Xử lý công việc”, ảnh 15–17): 🤖 gõ Số biên nhận từng TB “Đã tiếp nhận” chưa xong vào ô tìm,
    // 5 giây tìm 1 lần; thấy hồ sơ → bấm vào hồ sơ → Xử lý hồ sơ → làm tiếp. Bạn vừa thao tác trên trang (15 giây) → không gõ vào ô tìm
    if (onListPage()) {
      noteListUrl();
      if (S.sweepPause) {
        if (S.holdNote !== 'sweepPause') {
          S.holdNote = 'sweepPause';
          setStatus('🤖 Đã tạm dừng tìm ở Danh sách hồ sơ thụ lý (bạn bấm ■ Dừng) – bấm “▶ Chạy cả TB” (hoặc tắt / bật lại 🤖) để tìm tiếp.', true);
        }
        return '';
      }
      // bạn vừa thao tác trên trang (15 giây; ô tìm đang có chữ BẠN gõ → 60 giây) hoặc trên bảng điền (20 giây) → không gõ vào ô tìm
      const sb = sbnSearch();
      const userQ = !!sb && !!sb.input.value.trim() && sb.input.value !== S.sweepTyped;
      const quiet = Date.now() - USER.at >= (userQ ? 60000 : 15000) || (!userQ && (S.autoOnAt || 0) > USER.at);
      if (!quiet || Date.now() - (S.panelAt || 0) < 20000) return '';
      const ps = sweepList();
      const swSig = () => (Date.now() < (S.sweepNext || 0) ? '' : `sweep:${Math.floor(Date.now() / 5000)}`);
      // lượt tìm chưa xong (còn TB ◐ chưa tìm lần nào trong lượt này – lượt giữ qua tải lại trang) → tìm tiếp
      // TB bạn vừa bỏ tạm hoãn (chặng trước lãnh đạo) → tìm làm lại TB đó trước (bạn yêu cầu 24/11: không đứng chờ bạn bấm ▶)
      const rd = (S.redo || [])
        .map((id) => S.data.find((y) => String(y.tb) === id))
        .find((x) => x && needsList(x) && !S.autoHold.has(String(x.tb)) && ((S.redoN || {})[String(x.tb)] || 0) < 3);
      if (rd && Date.now() >= (S.sweepNext || 0)) return `golist:${rd.tb}`;
      if (roundNext(ps)) return swSig();
      // tìm hết TB ◐ → kiểm các TB ✓ Xong chưa kiểm (bạn yêu cầu 24/11), xong mới sang tiếp nhận / lượt mới. Thanh lọc đang ở mục khác “Tất cả” → bỏ
      // qua lượt kiểm (mọi lần kiểm đều chưa chắc), báo bạn 1 lần
      const ckN = chkList().length;
      if (ckN && listTabState() !== 'other') return swSig();
      if (ckN && S.holdNote !== 'chkTab') {
        S.holdNote = 'chkTab';
        setStatus(`🤖 Còn ${ckN} TB ✓ Xong chưa kiểm lại – thanh lọc của Danh sách hồ sơ thụ lý đang ở mục khác “Tất cả”: bấm “Tất cả” để 🤖 kiểm.`, true);
      }
      // hết một lượt chạy + soát (bạn yêu cầu 24/11) → xuất file Excel các TB lỗi và tình trạng lỗi (khi danh sách lỗi đổi, cách lần trước ≥ 10 phút)
      if (!ckN || listTabState() === 'other') autoErrExport();
      roundReset(true); // xong một lượt – lượt sau bắt đầu lại (vẫn nhớ các TB lượt vừa xong đã tích ✓)
      // lượt tìm xong (mọi TB đã tìm 1 lần, chưa thấy) / không còn TB phải tìm → còn TB chưa tiếp nhận thì sang màn hình Tiếp nhận hồ sơ
      // làm TB đó (bạn: “tiếp tục làm TB khác”); hết TB chưa tiếp nhận thì 🤖 quay lại Danh sách hồ sơ thụ lý tìm tiếp
      const nx = S.opts.tuSangTB === false ? null : recvNext();
      if (nx && navTiepNhan()) {
        let rt = null;
        try {
          rt = JSON.parse(sessionStorage.getItem('vbdlis-dien-nhanh-recv') || 'null');
        } catch (e) {}
        // vừa sang tiếp nhận TB này (10 phút) mà vẫn ở đây (trang không chuyển được) → không sang lại, tìm tiếp
        if (!(rt && rt.tb === String(nx.tb) && Date.now() - (rt.at || 0) < 10 * 60 * 1000)) return `recv:${nx.tb}`;
      }
      return ps.length ? swSig() : '';
    }
    // hồ sơ đã lưu (nút “Xử lý hồ sơ”, ảnh 1): TB đang làm chưa chuyển lãnh đạo → làm tiếp; vừa chuyển lãnh đạo xong → sang TB sau.
    // Hồ sơ ở chặng cuối (lãnh đạo đã trả về, bước Trả kết quả) → làm tiếp Trả hồ sơ dù không phải TB đang chọn
    // vừa bật 🤖 (15 giây) mà màn hình này không có việc: hết TB chưa tiếp nhận, còn TB “Đã tiếp nhận” chờ → sang Xử lý công việc ngay
    const justOn = () => (Date.now() - (S.autoOnAt || 0) < 15000 ? goListSig() : '');
    if (btnXuLyHoSo()) {
      const list = tbOfSo(await dossierSo()).list;
      const x = list.length === 1 ? list[0] : null;
      if (!x) return justOn();
      const s = S.stage[String(x.tb)] || {};
      if (s.hoan) return justOn();
      // chặng Trả kết quả / đang Trả hồ sơ → làm tiếp; chỉ có mốc kq (lãnh đạo trả về, chờ bạn Kết ISO / file quét) thì KHÔNG tự mở lại Quy trình
      if (!s.tra && (s.trk || (s.fwd && /^(trk|tra)$/.test(s.fwd.k)))) return `hs:${x.tb}:tra:${s.trk ? 1 : 0}${s.fwd ? s.fwd.k : ''}`;
      if (!isWorkTb(x.tb)) return justOn();
      if (s.ld) return ldRecent(s) && S.opts.tuSangTB !== false ? `next:${x.tb}` : justOn();
      return `hs:${x.tb}:${['tn', 'cv', 'don', 'ld'].map((q) => (s[q] ? 1 : 0)).join('')}`;
    }
    // màn hình chính khác (không phải Tiếp nhận / hồ sơ / Danh sách hồ sơ thụ lý – màn hình tiện ích tự làm) có mẫu ở tab Trường →
    // 🤖 chạy mẫu đó một lần mỗi lần vào màn hình (bạn chọn 23/11)
    if (!btnLuuHoSo() && !btnXuLyHoSo() && !linkVeTiepNhan()) {
      const pt = S.tpl['w:' + pageTplKey()];
      if (pt && pt.scope === 'page' && !pt.base && tplOn(pt)) return tplSigOf(pt, pageVisitId(), 'ptpl');
    }
    // màn hình Tiếp nhận hồ sơ TRỐNG (chưa có thửa, chưa có Số biên nhận) + TB đang chọn chưa làm
    const rows = await readTable();
    if (!rows) return ''; // không phải màn hình tiếp nhận
    const sbn = await readField('Số biên nhận');
    if (rows.length || (sbn !== null && String(sbn).trim())) {
      // (soát 24/11) đã có thửa / Số biên nhận: chính 🤖 đang tiếp nhận TB đang chọn (lần chạy dừng giữa chừng), chưa bấm Lưu hồ sơ, bạn không thao tác
      // 20 giây → 🤖 làm tiếp (bước kiểm tra đầu so dữ liệu trên trang với TB). Không thì không đụng (có thể là chữ bạn đang gõ)
      if (btnXuLyHoSo() || !btnLuuHoSo() || !AUTO()) return '';
      const tr = recvTB();
      let rr = null;
      try {
        rr = JSON.parse(sessionStorage.getItem('vbdlis-dien-nhanh-recvrun') || 'null');
      } catch (e) {}
      const sr = tr ? S.stage[String(tr.tb)] || {} : {};
      if (!tr || !rr || rr.tb !== String(tr.tb) || Date.now() - (rr.at || 0) > 30 * 60 * 1000 || sr.tnClick || sr.tn || sr.hoan || S.autoHold.has(String(tr.tb))) return '';
      if (sbn && String(sbn).trim() && soKey(sbn) !== soKey(tr.soBienNhan || '')) return '';
      return userQuiet(20000) ? `tn:${tr.tb}:r` : '';
    }
    if (sbn === null) return '';
    if (btnXuLyHoSo() || !btnLuuHoSo()) return ''; // màn hình tiếp nhận MỚI: có nút “Lưu hồ sơ”, chưa có “Xử lý hồ sơ”
    noteRecvUrl(); // nhớ địa chỉ màn hình Tiếp nhận hồ sơ (trống) – 🤖 tự sang đây tiếp nhận TB sau từ trang danh sách
    let tb = recvTB();
    if (AUTO() && tb && (S.stage[String(tb.tb)] || {}).tnClick && !(S.stage[String(tb.tb)] || {}).tn && !(S.stage[String(tb.tb)] || {}).hoan) {
      // 🤖 chạy liên tục (24/11): ⏸ tạm hoãn TB này (KHÔNG tiếp nhận lại – hồ sơ có thể đã có, tránh trùng), làm TB sau; bạn kiểm tra trên VBDLIS
      markStage(tb.tb, 'hoan', 'auto', { lyDo: 'đã bấm Lưu hồ sơ, chưa thấy “Lưu hồ sơ thành công” – kiểm tra trên VBDLIS (hồ sơ có thể đã có)' });
      setEvt(`⏸ TB ${esc(tb.tb)} – ${esc(whoOf(tb))}: đã bấm Lưu hồ sơ mà chưa thấy “Lưu hồ sơ thành công” → <b>tạm hoãn</b> (không tiếp nhận lại), 🤖 làm TB sau.`, true);
    }
    if (tb && (S.stage[String(tb.tb)] || {}).tnClick && !(S.stage[String(tb.tb)] || {}).hoan) {
      // đã bấm Lưu hồ sơ cho TB này mà chưa chắc đã lưu → chờ bạn (báo 1 lần)
      const note = `tn|${tb.tb}`;
      if (S.holdNote !== note) {
        S.holdNote = note;
        setStatus(
          `🤖 TB ${tb.tb}: đã bấm Lưu hồ sơ lúc ${fmtTime(S.stage[String(tb.tb)].tnClick)} mà chưa thấy “Lưu hồ sơ thành công” – kiểm tra trên VBDLIS rồi bấm “▶ Chạy cả TB”.`,
          true
        );
      }
      return '';
    }
    if (tb && stageOf(tb) !== 'chua') {
      const nx = nextTodo(true);
      // hết TB chưa tiếp nhận → còn TB “Đã tiếp nhận” chưa xong thì tự sang Xử lý công việc tìm tiếp (bạn không phải bấm ▶).
      // Không rời màn hình khi bạn đã gõ (người nộp, giấy tờ, điện thoại…) hoặc vừa thao tác (20 giây; vừa bật 🤖 thì đi ngay)
      if (!nx) {
        const g = goListSig();
        if (!g) return '';
        if (Date.now() - USER.at < 20000 && !((S.autoOnAt || 0) > USER.at)) return '';
        if (await recvTyped()) return '';
        return g;
      }
      setPtr(nx.tb);
      saveUi();
      render();
      tb = nx;
    }
    return tb ? 'tn:' + tb.tb : '';
  }
  // - màn hình “trống” phải 2 nhịp liền mới coi là đã rời màn hình (cửa sổ đang mờ dần / bảng đang tải không làm chạy lại)
  // - màn hình đã chạy mà DỪNG (lỗi / chờ bạn) thì không tự chạy lại nữa – bạn bấm ▶ hoặc bật lại Tự động
  // - màn hình tiếp nhận mới: đợi thêm 1 nhịp cho trang tải xong
  let autoBlank = 0;
  async function autoTick() {
    if (!host.isConnected) return clearInterval(autoTimer);
    if (Date.now() - (S.listUrlAt || 0) > 10000) {
      S.listUrlAt = Date.now();
      try {
        if (onListPage()) noteListUrl();
      } catch (e) {}
    }
    if (!AUTO() || S.running || S.busy || autoTicking || host.style.display === 'none' || !isAlive()) return;
    if (S.autoCool && Date.now() < S.autoCool) return;
    if (S.goListPending) return; // đang chờ tìm tiếp TB bạn bấm ▶ (trang vừa chuyển sang Xử lý công việc)
    autoTicking = true;
    try {
      // dấu tạm giữ “chờ bạn bấm Thực thi / Thực hiện” (Chạy thử): xét ở MỌI màn hình (cả trang danh sách, nơi trang quay về sau khi bạn bấm)
      // – chỉ khi CHÍNH BẠN đã bấm đúng nút của bước đó sau lúc giữ (không lấy câu báo của TB khác) → thả, 🤖 làm tiếp
      for (const [hid, hh] of [...S.autoHold]) {
        if (hh.kind === 'tt' && USER.btnAt > hh.at && holdFree(hid, hh)) {
          dropHold(hid);
          S.autoSig = '';
          S.autoCool = Date.now() + 4000;
          return;
        }
      }
      await holdRetry(); // TB “đã dừng” (lần chạy lỗi) → 🤖 tự chạy lại sau ít giây (bạn yêu cầu 24/11: không phải bấm ▶)
      const sig = await autoScreen();
      if (sig === null) {
        S.stk = null; // đang có hộp hỏi chưa dạy / bạn đang tích mẫu → chờ (hộp đóng rồi mới đếm lại)
        return;
      }
      if (!sig) {
        if (++autoBlank >= 2) S.autoSig = '';
        S.autoPend = '';
        await autoResume('');
        return;
      }
      autoBlank = 0;
      // bạn vừa bấm / gõ trên trang (3 giây) → chờ bạn xong rồi mới tự chạy, giữ nguyên màn hình (vd. vừa Kết ISO xong: không dừng vì
      // “bạn vừa bấm”; đang sửa ô trong cửa sổ có mẫu: mẫu không chạy lại)
      if (Date.now() - USER.at < 3000 && !sig.startsWith('sweep:')) return;
      // TB đang tạm giữ (lần chạy trước dừng chờ bạn) → không tự chạy; bạn đã tự làm bước đó (Chạy thử) → thả, chạy tiếp
      const htb = sigTb(sig);
      const h = htb ? S.autoHold.get(htb) : null;
      if (h) {
        if (holdFree(htb, h)) {
          dropHold(htb);
          S.autoSig = '';
          S.autoCool = Date.now() + 4000;
          return;
        } else {
          const note = `${htb}|${h.at}`;
          if (S.holdNote !== note) {
            S.holdNote = note;
            setStatus(
              h.kind === 'err' && !h.stop && !h.hard
                ? `🤖 TB ${htb}: lần chạy trước dừng – bạn không thao tác thì 🤖 tự chạy lại sau ít giây (hoặc bấm “▶ Chạy cả TB”).`
                : `🤖 Tự động hết đang chờ bạn ở TB ${htb} (lần chạy trước dừng) – xem bảng điền; làm xong bấm “▶ Chạy cả TB”.`,
              true
            );
          }
          await autoResume(sig);
          return;
        }
      }
      if (sig === S.autoSig || S.autoFail.has(sig) || S.running || S.busy) {
        if (!S.running && !S.busy) await autoResume(sig); // màn hình đã chạy mà vẫn đứng đó → 🤖 tự làm tiếp
        return;
      }
      // màn hình tiếp nhận mới / hồ sơ mất nút Xử lý hồ sơ sau khi chuyển lãnh đạo: phải thấy 2 nhịp liền mới chạy
      if ((sig.startsWith('tn:') || sig.startsWith('ldx:') || sig.startsWith('xlcv:') || /^ld(r|p|v|nav|back):/.test(sig)) && S.autoPend !== sig) {
        S.autoPend = sig;
        return;
      }
      S.autoPend = '';
      S.autoSig = sig;
      if (/^p?tpl:/.test(sig)) {
        // mẫu tab Trường: ghi “đã chạy lần mở này” TRƯỚC khi chạy (chạy lỗi cũng không chạy lại trên cùng lần mở)
        const key = tplSigKey(sig);
        S.tplRan.add(`${key}|${sig.split(':')[1]}`);
        if (S.tplRan.size > 200) S.tplRan = new Set([...S.tplRan].slice(-100));
        S.tplLast[key] = { at: Date.now() };
        saveTplLast();
      }
      setStatus('🤖 Tự động hết: bắt đầu chạy…');
      S.stk = null;
      runAll(sig);
    } catch (e) {
      // lỗi của bộ theo dõi (không làm dừng tiện ích) – ghi ra console để chẩn đoán
      try {
        console.warn('[VBDLIS Điền Nhanh] autoTick', e);
      } catch (e2) {}
    } finally {
      autoTicking = false;
    }
  }
  const autoTimer = setInterval(autoTick, 2500);
  // ---------- 🤖 tự làm tiếp (bạn yêu cầu 24/11: “khi đang ở tự động thì phải xem nó đang ở đâu thì bắt đầu làm tiếp các bước còn lại; nhiều lúc nó
  // dừng lại, tôi phải bấm chạy cả tb nó mới chạy tiếp; không được có thời gian chờ chết”) ----------
  // Màn hình hồ sơ / cửa sổ của chuỗi đứng yên RESUME_MS mà 🤖 không chạy gì (lần chạy trước dừng / bộ theo dõi không nhận ra việc), bạn không thao
  // tác, không có hộp hỏi chưa dạy → làm như bạn bấm ▶ cho màn hình đó (vẫn là 🤖: vướng thì tạm hoãn TB, làm TB khác). Mỗi TB tự làm tiếp tối đa
  // RESUME_MAX lần (đếm lại khi TB đi tiếp được); vẫn đứng → ⏸ tạm hoãn TB đó (lý do chung), 🤖 đóng cửa sổ của TB đó, làm TB khác.
  // Màn hình của TB đã xong / đã tạm hoãn / đang chờ lãnh đạo (không còn việc ở đây) → 🤖 đóng cửa sổ (không lưu), về danh sách làm TB khác.
  // Không tự làm tiếp: vai trò Lãnh đạo (bộ theo dõi riêng), đang “Chạy thử”, bạn bấm ■ Dừng, TB chờ bạn tự bấm Thực thi / Thực hiện
  const RESUME_MS = 30000;
  const RESUME_MAX = 2;
  const RESUME_WIN_MS = 15 * 60 * 1000;
  const HOLD_RETRY_MS = 45000; // TB “đã dừng” (lần chạy 🤖 lỗi) → 45 giây sau (bạn không thao tác) 🤖 tự chạy lại
  const userQuiet = (ms) => Date.now() - Math.max(USER.at, USER.viewAt || 0) >= ms && Date.now() - (S.panelAt || 0) >= ms;
  const resumeN = (id) => {
    const r = (S.resumeN || {})[id];
    return r && Date.now() - (r.at || 0) < RESUME_WIN_MS ? r.n || 0 : 0;
  };
  // 🤖 đứng ở đâu: cửa sổ của chuỗi (Nhập đơn, chủ / thửa, Quy trình, chọn người, Kết ISO, Trả hồ sơ, Lưu kho, Hồ sơ quét…) hoặc màn hình hồ sơ
  // (nút “Xử lý hồ sơ”) – kèm TB của hồ sơ (số biên nhận). Màn hình khác (danh sách, tiếp nhận…) → null: bộ theo dõi tự lo (tìm / tiếp nhận)
  async function stuckWhere() {
    const top = (await act('modalState')).find((x) => x.open);
    const k = top ? modalKey(top) : '';
    const scr = scanScreen();
    if (top && /^ket iso\b/.test(k) && (!isoAuto() || S.opts.thuThucThi)) return null; // bạn đang tự Kết ISO – 🤖 không đụng
    let userWork = false; // Quy trình chỉ còn việc của bạn (Kết ISO, chưa bật “Tự Kết ISO” / đang Chạy thử)
    if (top && /^quy trinh xu ly\b/.test(k) && (!isoAuto() || S.opts.thuThucThi)) {
      const m = qtModal();
      const left = (m ? qtRows(m) : []).filter((r) => r.chk && !r.chk.checked);
      userWork = left.length > 0 && left.every((r) => qtKindOf(r) === 'iso');
    }
    let kind = '';
    if (top && CV_LEAVE_WIN.some((re) => re.test(k))) kind = top.name || k;
    else if (!top && scr && scr !== 'quytrinh') kind = scr === 'luukho' ? 'Lưu kho hồ sơ quét' : scr === 'hsq' ? 'Hồ sơ quét' : scr === 'cndlpl' ? 'Cập nhật dữ liệu pháp lý' : scr;
    else if (!top && btnXuLyHoSo() && !onListPage()) kind = 'màn hình hồ sơ';
    else if (!top && !scr && !btnXuLyHoSo() && !btnLuuHoSo() && linkVeTiepNhan() && !onListPage()) kind = 'màn hình hồ sơ đã chuyển';
    // trang khác của VBDLIS (không phải danh sách / tiếp nhận / hồ sơ, không có cửa sổ) – có thanh trái “Xử lý công việc”
    else if (!top && !scr && !onListPage() && !btnLuuHoSo() && !btnXuLyHoSo() && !linkVeTiepNhan() && navXuLyCongViec()) return { kind: 'other', x: null, key: `other|${location.pathname}` };
    else if (!top && !scr && !onListPage() && !btnLuuHoSo() && !btnXuLyHoSo() && !linkVeTiepNhan()) return { dead: 1 };
    if (!kind) return null;
    let so = '';
    try {
      so = await dossierSo();
    } catch (e) {}
    const l = so ? tbOfSo(so).list : [];
    return { kind: String(kind).slice(0, 60), x: l.length === 1 ? l[0] : null, key: `${norm(String(kind)).slice(0, 40)}|${so ? soKey(so) : ''}`, userWork };
  }
  // 🤖 tự rời một màn hình (đóng cửa sổ / đi trang) tối đa 2 lần mỗi 15 phút – trang không chuyển được thì thôi, báo 1 lần (không lặp, không kêu mãi)
  function leaveCap(key) {
    const lk = 'leave|' + key;
    if (resumeN(lk) >= 2) {
      if (S.holdNote !== lk) {
        S.holdNote = lk;
        setStatus('🤖 đã thử rời màn hình này 2 lần mà chưa được – bạn chuyển trang giúp (Xử lý công việc / Tiếp nhận hồ sơ).', true);
      }
      return true;
    }
    S.resumeN = { ...(S.resumeN || {}), [lk]: { n: resumeN(lk) + 1, at: Date.now() } };
    return false;
  }
  // TB không còn việc ở màn hình này: đã trả hồ sơ / ✓ Xong / đang tạm hoãn / đã chuyển lãnh đạo mà lãnh đạo chưa trả về
  const noWorkHere = (st) => !!(st.hoan || st.tra || st.xong || (st.ld && !traPhase(st)));
  async function autoResume(sig) {
    if (!AUTO() || isLd() || S.sweepPause || S.cvLeave || S.running || S.busy) {
      S.stk = null;
      return;
    }
    if (S.userStopAt) {
      // bạn đã bấm ■ Dừng – 🤖 không tự làm tiếp tới khi bạn bấm ▶ / tắt – bật lại 🤖
      if (S.holdNote !== 'ustop') {
        S.holdNote = 'ustop';
        setStatus('🤖 Bạn đã bấm ■ Dừng – 🤖 không tự làm tiếp màn hình đang dừng; bấm “▶ Chạy cả TB” (hoặc tắt / bật lại 🤖) để làm tiếp.', true);
      }
      S.stk = null;
      return;
    }
    const w = await stuckWhere();
    if (!w || w.dead) {
      if (w && w.dead) deadPageReload(); // trang lỗi (không có thanh trái) → tải lại, chờ tăng dần
      else if (onListPage()) deadPageOk();
      S.stk = null;
      return;
    }
    deadPageOk();
    const now = Date.now();
    if (!S.stk || S.stk.key !== w.key) {
      S.stk = { key: w.key, at: now };
      return;
    }
    // đứng yên đủ lâu; bạn không thao tác (trang / bảng điền); lần chạy trước đã xong một lúc; không có hộp hỏi / báo thật đang mở. Bạn đã bấm / lăn
    // chuột trên trang SAU lần chạy cuối của 🤖 (màn hình có thể là việc của bạn) → chờ bạn ngưng 3 phút
    const touched = Math.max(USER.at, USER.viewAt || 0) > (S.runEndAt || 0);
    if (now - S.stk.at < RESUME_MS || !userQuiet(touched ? 180000 : w.userWork ? 90000 : 20000) || now - (S.runEndAt || 0) < 15000 || pageWorking()) return;
    if (pageDialog() || realDlgOpen(await act('dialogState'))) return;
    const id = w.x ? String(w.x.tb) : '';
    const st = id ? S.stage[id] || {} : {};
    const h = id ? S.autoHold.get(id) : null;
    if (h && (h.kind !== 'err' || h.stop || h.hard || h.noted)) return; // chờ bạn (Thực thi / Thực hiện, Lưu thông tin đăng ký…), ■ Dừng, lỗi chung
    S.stk = { key: w.key, at: now }; // lần xét sau tính lại từ đây
    if (w.kind === 'màn hình hồ sơ đã chuyển') {
      // hồ sơ đã sang người khác (không còn nút Xử lý hồ sơ) – TB đang chờ ghi nhận chuyển lãnh đạo thì bộ theo dõi lo (ldx:); còn lại: rời màn hình này
      if (id && st.fwd && st.fwd.k === 'ld' && !st.ld && !st.fwd.bad && Date.now() - st.fwd.at < 10 * 60 * 1000) return;
      if (id) {
        if (leaveCap(w.key)) return;
        S.cvLeave = { tb: id, at: now, now: 1, ...(st.hoan ? {} : { done: 1 }) };
        if (h) dropHold(id);
        return;
      }
      if (!(recvNext() || sweepList().length || chkList().length) || leaveCap(w.key)) return;
      S.autoSig = `cvnav:${Math.floor(now / 120000)}`;
      runAll(S.autoSig);
      return;
    }
    if (!id && (w.kind === 'other' || w.kind === 'màn hình hồ sơ')) {
      // trang không có việc của 🤖 (trang khác / hồ sơ không có trong dữ liệu, không có cửa sổ) → còn TB phải làm thì về Danh sách hồ sơ thụ lý
      if (!(recvNext() || sweepList().length || chkList().length) || leaveCap(w.key)) return;
      S.autoSig = `cvnav:${Math.floor(now / 120000)}`;
      runAll(S.autoSig);
      return;
    }
    if (!id) {
      // hồ sơ không có trong dữ liệu / không đọc được số biên nhận → không làm thay bạn
      if (S.holdNote !== 'stk|' + w.key) {
        S.holdNote = 'stk|' + w.key;
        setStatus(`🤖 Đang ở “${w.kind}” – hồ sơ không có trong dữ liệu TB (hoặc không đọc được số biên nhận): 🤖 không tự làm, bạn xem.`, true);
      }
      return;
    }
    if (noWorkHere(st)) {
      // TB không còn việc ở đây → đóng cửa sổ của TB đó (không lưu), về danh sách / tiếp nhận làm TB khác. Cửa sổ nhập liệu (đơn / chủ / thửa) – có thể
      // bạn đang sửa TB tạm hoãn / đã xong → KHÔNG đóng, chỉ báo
      if (/^(nhap don dang ky|.*(ca nhan|chu su dung|thua dat))/.test(norm(w.kind))) {
        if (S.holdNote !== 'nwin|' + w.key) {
          S.holdNote = 'nwin|' + w.key;
          setStatus(`🤖 “${w.kind}” của TB ${id} (đã xong / tạm hoãn / chờ lãnh đạo) đang mở – 🤖 không đóng cửa sổ nhập liệu; bạn xong thì đóng, 🤖 làm TB khác.`);
        }
        return;
      }
      if (leaveCap(w.key)) return;
      S.cvLeave = { tb: id, at: now, now: 1, ...(st.hoan ? {} : { done: 1 }) };
      if (h) dropHold(id);
      setStatus(`🤖 TB ${id} không còn việc ở “${w.kind}” – 🤖 đóng cửa sổ của TB này (không lưu), làm TB khác.`);
      return;
    }
    const n0 = resumeN(id);
    if (n0 >= RESUME_MAX) {
      // tự làm tiếp RESUME_MAX lần vẫn đứng ở TB này → ⏸ tạm hoãn (lý do chung), đóng cửa sổ của TB đó, làm TB khác
      markStage(id, 'hoan', 'auto', { lyDo: `🤖 đứng ở “${w.kind}” – đã tự làm tiếp ${RESUME_MAX} lần không xong; xem dòng báo của lần chạy, sửa xong bỏ tạm hoãn để 🤖 làm lại` });
      delete S.resumeN[id];
      if (h) dropHold(id);
      if (nsBump(id)) return;
      S.cvLeave = { tb: id, at: now, now: 1 };
      setEvt(`⏸ TB ${esc(id)} – ${esc(whoOf(w.x))}: 🤖 đứng ở <b>${esc(w.kind)}</b>, tự làm tiếp ${RESUME_MAX} lần không xong → <b>tạm hoãn</b>, làm TB khác (lý do ở bảng Tiến độ).`, true);
      return;
    }
    S.resumeN = { ...(S.resumeN || {}), [id]: { n: n0 + 1, at: now } };
    // như bạn bấm ▶ cho TB này: bỏ dấu “đã dừng” của TB đó và các màn hình đã dừng của nó (không bỏ ⏸ tạm hoãn, không bỏ ■ Dừng)
    if (h) dropHold(id);
    for (const s0 of [...S.autoFail]) if (sigTb(s0) === id || s0 === sig) S.autoFail.delete(s0);
    S.autoSig = '';
    log0(`🤖 tự làm tiếp ở “${w.kind}” – TB ${id} (lần ${n0 + 1}/${RESUME_MAX})`);
    // chữ ký của màn hình này có rồi (vừa bỏ chặn) → nhịp sau 🤖 chạy như thường; chưa có (bộ theo dõi chưa nhận ra việc) → chạy như bấm ▶
    if (sig && sigTb(sig) === id) return;
    S.autoSig = `resume:${id}:${n0 + 1}`;
    runAll(S.autoSig);
  }
  // TB “đã dừng” (lần chạy lỗi, KHÔNG phải ■ Dừng / Chạy thử / lỗi chung) → 🤖 tự chạy lại (bạn yêu cầu 24/11: không phải bấm ▶):
  //  - dừng vì bạn vừa bấm / gõ trên trang → bạn ngưng 20 giây là chạy lại (không tính là TB lỗi);
  //  - dừng vì hộp hỏi chưa dạy → hộp đã đóng (bạn trả lời), bạn ngưng 5 giây là chạy lại;
  //  - lỗi khác → HOLD_RETRY_MS sau (bạn không thao tác) chạy lại.
  // Đã chạy lại RESUME_MAX lần vẫn dừng → ⏸ tạm hoãn TB (lý do của lần dừng), 🤖 đóng cửa sổ của TB đó, làm TB khác.
  // Màn hình đã dừng không có số TB (vd. sang danh sách / tiếp nhận lỗi vì trang chậm) → 5 phút sau (bạn không thao tác) cho chạy lại
  async function holdRetry() {
    if (!AUTO() || isLd() || S.sweepPause || S.userStopAt) return;
    const now = Date.now();
    // màn hình đã dừng không có số TB: 5 phút sau (bạn không thao tác) cho chạy lại – mỗi chữ ký tối đa 2 lần
    if (userQuiet(20000))
      for (const s0 of [...S.autoFail]) {
        if (sigTb(s0) || now - ((S.autoFailAt || {})[s0] || 0) <= 5 * 60 * 1000) continue;
        const ne = ((S.autoFailN || {})[s0] || 0) + 1;
        if (ne > 2) continue;
        S.autoFailN = { ...(S.autoFailN || {}), [s0]: ne };
        S.autoFail.delete(s0);
        if (S.autoFailAt) delete S.autoFailAt[s0];
      }
    const due = [...S.autoHold].filter(([hid, h]) => {
      if (h.kind !== 'err' || h.stop || h.hard || h.noted) return false;
      if (h.user) return now - (h.at || 0) >= 5000 && userQuiet(20000);
      if (h.nav || h.glob) return now - (h.at || 0) >= 30000 && userQuiet(20000);
      if (h.dlg) return now - (h.at || 0) >= 3000 && userQuiet(5000);
      return now - (h.at || 0) >= HOLD_RETRY_MS && userQuiet(20000);
    });
    if (!due.length || pageDialog() || realDlgOpen(await act('dialogState'))) return;
    for (const [id, h] of due) {
      if (h.nav || h.glob) {
        // trang chậm / lỗi chung: chạy lại (đếm riêng, tối đa 4 lần, không tính là TB lỗi); vẫn vậy → báo bạn 1 lần, KHÔNG tạm hoãn hàng loạt TB
        const nk = 'glob:' + id;
        if (resumeN(nk) >= 4) {
          setHold(id, { ...h, noted: 1 });
          needYou('Trang VBDLIS / mạng có vấn đề – bạn xem', 'bad');
          log0(`🤖 TB ${id}: lỗi chung lặp lại (trang không chuyển / không đưa được file…) – 🤖 không tự chạy lại TB này nữa, bạn xem rồi bấm ▶`);
          continue;
        }
        S.resumeN = { ...(S.resumeN || {}), [nk]: { n: resumeN(nk) + 1, at: now } };
        dropHold(id);
        for (const s0 of [...S.autoFail]) if (sigTb(s0) === id) S.autoFail.delete(s0);
        S.autoSig = '';
        log0(`🤖 TB ${id}: lỗi chung (trang chậm / không đưa được file…) – tự chạy lại`);
        continue;
      }
      const n0 = h.user ? 0 : resumeN(id); // dừng vì bạn thao tác không tính là TB lỗi
      if (n0 >= RESUME_MAX) {
        if (!(S.stage[id] || {}).hoan) markStage(id, 'hoan', 'auto', { lyDo: h.why || `🤖 dừng ở TB này nhiều lần – sửa xong bỏ tạm hoãn để 🤖 làm lại` });
        delete S.resumeN[id];
        dropHold(id);
        if (nsBump(id)) return;
        S.cvLeave = { tb: id, at: now, now: 1 }; // cửa sổ của TB này còn mở thì 🤖 đóng (không lưu), làm TB khác
        log0(`⏸ TB ${id}: 🤖 đã tự chạy lại ${RESUME_MAX} lần vẫn dừng – tạm hoãn, làm TB khác`);
        continue;
      }
      if (!h.user) S.resumeN = { ...(S.resumeN || {}), [id]: { n: n0 + 1, at: now } };
      dropHold(id);
      for (const s0 of [...S.autoFail]) if (sigTb(s0) === id) S.autoFail.delete(s0);
      S.autoSig = '';
      log0(`🤖 TB ${id}: lần chạy trước dừng – tự chạy lại${h.user ? '' : ` (lần ${n0 + 1}/${RESUME_MAX})`}`);
    }
  }
  // (soát 24/11) ⏸ do 🤖 tự làm tiếp / tự chạy lại cũng đếm vào bộ ngắt 5 TB: nhiều TB liền nhau đều vướng → có thể trang đổi / mạng lỗi → tắt 🤖, kêu
  function nsBump(id) {
    S.nsRun = (S.nsRun || 0) + 1;
    if (S.nsRun < NS_MAX) return false;
    S.nsRun = 0;
    S.cvLeave = null;
    S.opts = { ...S.opts, tuDong: false };
    safeSet({ tbOpts: S.opts });
    setStatus(`${NS_MAX} TB liên tiếp bị tạm hoãn vì vướng (TB ${id} là TB thứ ${NS_MAX}) – có thể trang VBDLIS đổi / mạng lỗi: tiện ích TẮT 🤖. Bạn xem các TB ⏸ ở bảng Tiến độ rồi bật lại 🤖`, true);
    needYou('🤖 đã tắt – xem bảng điền', 'bad');
    try {
      renderTop();
    } catch (e) {}
    return true;
  }
  // ■ Dừng lúc 🤖 đang chạy → thôi tự làm tiếp / tự chạy lại (giữ qua tải lại trang) tới khi bạn bấm ▶ / tắt – bật lại 🤖
  const USTOP_KEY = 'vbdlis-dien-nhanh-ustop';
  function userStopSet(on) {
    S.userStopAt = on ? Date.now() : 0;
    try {
      if (on) sessionStorage.setItem(USTOP_KEY, String(S.userStopAt));
      else sessionStorage.removeItem(USTOP_KEY);
    } catch (e) {}
  }
  // (soát 24/11) trang không có thanh trái “Xử lý công việc”, không phải danh sách / tiếp nhận / hồ sơ, không có cửa sổ (vd. trang lỗi sau khi tải lại) –
  // bạn không thao tác → tải lại trang, chờ tăng dần (1, 2, 5, 10 phút); trang đăng nhập (có ô mật khẩu) → không tải lại
  const DEAD_KEY = 'vbdlis-dien-nhanh-dead';
  function deadPageReload() {
    if (!AUTO() || !userQuiet(20000) || document.querySelector('input[type="password"]')) return;
    const now = Date.now();
    let st = null;
    try {
      st = JSON.parse(sessionStorage.getItem(DEAD_KEY) || 'null');
    } catch (e) {}
    if (!st || now - (st.seen || 0) > 15 * 60 * 1000) st = { seen: now, n: 0, next: now + 60000 };
    if (now < (st.next || 0)) {
      try {
        sessionStorage.setItem(DEAD_KEY, JSON.stringify(st));
      } catch (e) {}
      return;
    }
    st.n = (st.n || 0) + 1;
    st.next = now + [60, 120, 300, 600][Math.min(3, st.n)] * 1000;
    st.seen = now;
    try {
      sessionStorage.setItem(DEAD_KEY, JSON.stringify(st));
    } catch (e) {}
    setStatus(`🤖 trang không có mục “Xử lý công việc” (trang lỗi?) – tải lại trang (lần ${st.n})…`);
    S.autoCool = now + 8000;
    setTimeout(() => {
      try {
        location.reload();
      } catch (e) {}
    }, 1500);
  }
  function deadPageOk() {
    try {
      sessionStorage.removeItem(DEAD_KEY);
    } catch (e) {}
  }
  // dòng báo ngắn của 🤖 (không xóa nhật ký lần chạy trước)
  function log0(t) {
    setStatus(t);
    try {
      console.info('[VBDLIS Điền Nhanh]', t);
    } catch (e) {}
  }
  // bạn tự Trả hồ sơ (bấm Thực hiện ở cửa sổ Trả hồ sơ, rồi Đồng ý nếu trang hỏi): trang báo thành công, hoặc cửa sổ đóng mà không báo lỗi
  // → TB của hồ sơ đó ✓ Xong (bạn yêu cầu 23/11) – kể cả khi 🤖 tắt. Bạn bấm Không / Đóng / Hủy, hoặc trang báo lỗi → thôi
  const userTraTimer = setInterval(() => {
    if (!host.isConnected) return clearInterval(userTraTimer);
    const u = S.userTra;
    if (!u || S.running) return;
    const now = Date.now();
    const busy = pageWorking();
    if (busy) u.busyAt = now;
    if (traModal()) u.openAt = now;
    const dlg = pageDialog();
    // trang báo lỗi (thông báo nổi / hộp báo lỗi – đọc chữ nội dung hộp) → thôi, ghi dấu lỗi (không suy ra đã trả)
    if (toastsSince(u.at).some(toastBad) || dlgIsErr(dlg)) return userTraEnd('bad');
    // trả xong: câu báo thành công (thông báo nổi / hộp), hoặc cửa sổ Trả hồ sơ đã đóng + hết “Đang xử lý…” 2 giây mà không báo lỗi
    const ok = toastsSince(u.at).some(toastOk) || (!!dlg && TRA_DONE_RE.test(dlgBody(dlg)));
    // hộp lạ (không phải hộp hỏi trả hồ sơ, không phải báo thành công) → không kết luận “đã trả” khi cửa sổ đóng
    if (dlg && !ok && !TRA_Q_RE.test(norm(`${dlg.title || ''} ${dlgBody(dlg)}`))) u.odd = u.odd || dlgShow(dlg);
    // bạn bấm Không / Đóng / Hủy / nút × LÚC cửa sổ Trả hồ sơ còn mở → bạn thôi
    const closeBtn = USER.btnAt > u.at && /^(dong|khong|huy|thoat|bo qua|close|cancel|x|)$/.test(USER.btn);
    if (!ok && closeBtn && USER.btnAt <= (u.openAt || u.at) + 1500) return userTraEnd('cancel');
    const gone = !traModal() && !dlg && !busy && now - (u.busyAt || 0) > 2000 && now - USER.btnAt > 2500;
    if (ok || (gone && !u.odd)) {
      S.userTra = null;
      let id = u.id;
      if (!id) {
        const l = u.so ? tbOfSo(u.so).list : [];
        id = l.length === 1 ? String(l[0].tb) : '';
      }
      if (!id || (S.stage[id] || {}).tra) return;
      markStage(id, 'tra', 'auto');
      setEvt(`✓ TB ${esc(id)} – ${esc(whoOf(S.data.find((y) => String(y.tb) === id)))}: bạn đã <b>Trả hồ sơ</b> – <b>✓ Xong</b>.`);
      return;
    }
    if (gone && u.odd) {
      // trang hiện hộp lạ rồi đóng: KHÔNG ghi ✓ – giữ dấu “đang Trả hồ sơ” (lần tìm sau ở Danh sách hồ sơ thụ lý / bạn kết luận)
      S.userTra = null;
      if (u.id)
        setEvt(
          `• TB ${esc(u.id)}: bạn bấm Trả hồ sơ, trang hiện “${esc(u.odd)}” – tiện ích chưa ghi ✓ Xong. Trả xong thật thì đổi ô Trạng thái sang ✓ (hoặc lần tìm sau ở Danh sách hồ sơ thụ lý tự kết luận).`,
          true
        );
      return;
    }
    // hết hạn: 2 phút sau lần cuối cửa sổ còn mở / trang còn “Đang xử lý…” (tối đa 10 phút) – giữ dấu “đang Trả hồ sơ”
    if (now - Math.max(u.at, u.busyAt || 0, u.openAt || 0) > 2 * 60 * 1000 || now - u.at > 10 * 60 * 1000) S.userTra = null;
  }, 1000);
  // bạn tự bấm Thực thi chuyển lãnh đạo (kể cả khi 🤖 tắt): trang báo chuyển xong, hoặc cửa sổ chọn người đóng (không phải do bạn bấm Đóng,
  // không có hộp lạ) mà không báo lỗi → ghi mốc chuyển lãnh đạo (◐ Đã nhập nhưng chưa xong – bạn chốt 23/11)
  const userLdTimer = setInterval(() => {
    if (!host.isConnected) return clearInterval(userLdTimer);
    const u = S.userLd;
    if (!u || S.running) return;
    const now = Date.now();
    if ((S.stage[u.id] || {}).ld) {
      S.userLd = null;
      return;
    }
    const busy = pageWorking();
    if (busy) u.busyAt = now;
    if (chooserModal()) u.openAt = now;
    const dlg = pageDialog();
    if (toastsSince(u.at).some(toastBad) || dlgIsErr(dlg)) return userLdEnd('bad');
    const body = dlg ? norm(`${dlg.title || ''} ${dlgBody(dlg)}`) : '';
    const ok =
      toastsSince(u.at).some((t) => toastOk(t) && /chuyen tiep|chuyen ho so|thuc thi|thanh cong/.test(t.text || '')) || (!!dlg && /thanh cong/.test(body) && /chuyen/.test(body));
    if (dlg && !ok && !FWD_Q_RE.test(body)) u.odd = u.odd || dlgShow(dlg);
    const closeBtn = USER.btnAt > u.at && /^(dong|khong|huy|thoat|bo qua|close|cancel|x|)$/.test(USER.btn);
    if (!ok && closeBtn && USER.btnAt <= (u.openAt || u.at) + 1500) return userLdEnd('cancel');
    const gone = !chooserModal() && !dlg && !busy && now - (u.busyAt || 0) > 2000 && now - USER.btnAt > 2500;
    if (ok || (gone && !u.odd)) {
      S.userLd = null;
      markStage(u.id, 'ld', ok ? 'auto' : 'suy');
      setEvt(`◐ TB ${esc(u.id)} – ${esc(whoOf(S.data.find((y) => String(y.tb) === u.id)))}: bạn đã <b>chuyển lãnh đạo</b> – <b>◐ Đã nhập nhưng chưa xong</b>.`);
      return;
    }
    if (gone && u.odd) {
      // trang hiện hộp lạ rồi đóng: không ghi ◐ (dấu đang chuyển ghi lỗi) – bạn xem
      const id = u.id;
      const odd = u.odd;
      userLdEnd('bad');
      setEvt(`• TB ${esc(id)}: bạn bấm Thực thi chuyển lãnh đạo, trang hiện “${esc(odd)}” – tiện ích chưa ghi ◐. Đã chuyển thật thì đổi ô Trạng thái sang ◐.`, true);
      return;
    }
    // hết hạn: 2 phút sau lần cuối cửa sổ chọn người còn mở / trang còn xử lý (tối đa 10 phút). Cửa sổ vẫn mở → coi như bạn thôi
    if (now - Math.max(u.at, u.busyAt || 0, u.openAt || 0) > 2 * 60 * 1000 || now - u.at > 10 * 60 * 1000) {
      if (chooserModal()) userLdEnd('cancel');
      else S.userLd = null; // giữ dấu “đang chuyển lãnh đạo” (◐) – 🤖 tìm TB đó khi lãnh đạo trả về
    }
  }, 1000);

  // ---------- khởi động ----------
  (async () => {
    const r = await store.get(['tbData', 'tbDone', 'tbCur', 'tbRecv', 'tbCurBy', 'tbTab', 'tbOpts', 'tbBox', 'tbStage', 'tbTpl', 'tbAutoTab', 'tbRecvUrl', 'tbListUrl', 'tbGoList']);
    // mẫu tab Trường: nhận ngay (trước các bước chờ – thay đổi từ tab khác đến sau đó không bị bản cũ đè); chuyển sang khóa bản 1.20
    S.tpl = r.tbTpl && typeof r.tbTpl === 'object' ? { ...r.tbTpl } : {};
    if (tplMigrateAll(S.tpl)) safeSet({ tbTpl: S.tpl });
    S.opts = r.tbOpts || {};
    S.autoTab = r.tbAutoTab == null ? null : r.tbAutoTab;
    S.recvUrl = r.tbRecvUrl || '';
    S.listUrl = r.tbListUrl || '';
    // TB vừa bấm ▶ “Đã tiếp nhận” → trang chuyển sang danh sách: 🤖 chưa tìm TB khác trước khi kịp xét tìm tiếp TB đó
    if (r.tbGoList && Date.now() - (r.tbGoList.at || 0) < 2 * 60 * 1000) S.goListPending = true;
    // số tab (tab nào là tab 🤖): hỏi lại tối đa 3 lần (bộ chạy nền vừa khởi động lại có thể chưa trả lời)
    for (let i = 0; i < 3; i++) {
      try {
        const w = await send({ type: 'vbdlis-whoami' });
        S.tabId = w && w.ok && w.tabId != null ? w.tabId : null;
      } catch (e) {
        S.tabId = null;
      }
      if (S.tabId != null) break;
      await new Promise((res) => setTimeout(res, 400));
    }

    try {
      const c = await send({ type: 'vbdlis-config' });
      const cfg = (c && c.ok && c.config) || {};
      const add = {};
      if (S.opts.ctCV === undefined && typeof cfg.ctCV === 'string' && cfg.ctCV.trim()) add.ctCV = cfg.ctCV.replace(/\s+/g, '');
      if (S.opts.ctLD === undefined && typeof cfg.ctLD === 'string' && cfg.ctLD.trim()) add.ctLD = cfg.ctLD.replace(/\s+/g, '');
      if (Object.keys(add).length) {
        S.opts = { ...S.opts, ...add };
        safeSet({ tbOpts: S.opts });
      }
    } catch (e) {}
    applyBox(r.tbBox);
    S.data = (r.tbData || []).sort(byTb);
    S.done = r.tbDone || {};
    doneBase = { ...S.done };
    S.stage = r.tbStage || {};
    S.cur = r.tbCur;
    // (25/11) con trỏ tiếp nhận – bản cũ chưa có: lấy TB đang chọn
    S.recv = r.tbRecv != null ? String(r.tbRecv) : r.tbCur != null ? String(r.tbCur) : null;
    S.curBy = r.tbCurBy === 'auto' && String(S.cur) !== String(S.recv) ? 'auto' : '';
    // tạm giữ của tab này (trang vừa tải lại). Đang chờ bạn bấm Thực thi / Thực hiện (Chạy thử): không biết bạn đã bấm chưa →
    // ghi “đang chuyển (chưa rõ)” để bước sau kiểm lại trên Quy trình, KHÔNG tự bấm lại; dừng trước Lưu thông tin đăng ký → giữ như dừng lỗi
    try {
      const hs = JSON.parse(sessionStorage.getItem(HOLD_KEY) || '[]');
      if (Array.isArray(hs))
        hs.forEach((e) => {
          if (!Array.isArray(e) || !e[1]) return;
          const id = String(e[0]);
          const h = e[1];
          if (h.kind === 'tt') {
            const st = S.stage[id] || {};
            if (h.k && !st[h.k] && !st.fwd) setMark(id, 'fwd', { k: h.k, at: Date.now(), tt: true }); // trang tải lại ngay sau khi bạn bấm → mốc là lúc này
            return;
          }
          S.autoHold.set(id, h.kind === 'don' ? { ...h, kind: 'err', stop: 1 } : h);
        });
      saveHold();
    } catch (e) {}
    try {
      ldLoad();
      try {
        const tl = JSON.parse(sessionStorage.getItem(TPLLAST_KEY) || 'null');
        if (tl && typeof tl === 'object') {
          S.tplLast = { ...(tl.last || {}), ...S.tplLast };
          S.userAtSaved = tl.user || 0;
        }
      } catch (e) {}
      S.sweepSeen = JSON.parse(sessionStorage.getItem(SWEEP_KEY) || '{}') || {};
      S.userStopAt = +sessionStorage.getItem('vbdlis-dien-nhanh-ustop') || 0;
      try {
        const rd = JSON.parse(sessionStorage.getItem(REDO_KEY) || '[]');
        S.redo = Array.isArray(rd) ? rd.map(String) : [];
      } catch (e2) {}
    } catch (e) {
      S.sweepSeen = {};
    }
    try {
      const rd = JSON.parse(sessionStorage.getItem(ROUND_KEY) || 'null');
      S.sweepRound = rd && typeof rd === 'object' && Array.isArray(rd.ids) ? rd : null;
    } catch (e) {
      S.sweepRound = null;
    }
    try {
      const c = JSON.parse(sessionStorage.getItem('vbdlis-dien-nhanh-chain') || 'null');
      S.chainTb = c && c.tb ? c : null;
      S.sweepPause = sessionStorage.getItem('vbdlis-dien-nhanh-sweeppause') === '1';
    } catch (e) {}
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
    if (!S.data.some((x) => String(x.tb) === String(S.recv)) && S.data.length) S.recv = String(S.cur);
    if (String(S.cur) === String(S.recv)) S.curBy = '';
    await loadScanQ();
    render();
    renderScanQ();
    sweepScanOrphans();
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
    // bạn vừa bấm ▶ cho TB “Đã tiếp nhận” → tiện ích bấm “Xử lý công việc” → trang chuyển → bảng điền mới tìm tiếp TB đó
    try {
      const g = (await store.get('tbGoList')).tbGoList;
      // chỉ tab đã ghi (số tab khớp; cả 2 chưa rõ số tab thì như cũ)
      const mine = !!g && (g.tabId == null ? S.tabId == null : S.tabId != null && String(g.tabId) === String(S.tabId));
      if (g && Date.now() - (g.at || 0) < GOLIST_MS && mine && !S.sweepPause) {
        S.goListPending = true;
        let tries = 0;
        const iv = setInterval(async () => {
          tries++;
          // bạn đã bấm ▶ / ■ Dừng trong lúc chờ → thôi tìm tiếp TB này
          if (S.running || S.sweepPause) {
            clearInterval(iv);
            S.goListPending = false;
            safeRemove('tbGoList');
            return;
          }
          if (S.busy && tries <= 20) return;
          // trang danh sách, không có cửa sổ nào mở → tìm tiếp (cửa sổ đang mở thì chờ)
          if (!S.busy && onListPage() && !(await act('modalState')).some((x) => x.open)) {
            clearInterval(iv);
            safeRemove('tbGoList');
            S.goListPending = false;
            runAll('golist:' + g.tb);
          } else if (tries > 20) {
            clearInterval(iv); // 20 giây chưa nhận ra trang danh sách → thôi, báo kèm dòng để báo lỗi
            S.goListPending = false;
            setResult(
              `<div class="bad">✗ TB ${esc(g.tb)}: đã bấm “Xử lý công việc” nhưng tiện ích chưa nhận ra trang Danh sách hồ sơ thụ lý (ô tìm “Số biên nhận”) – bấm “▶ Chạy cả TB” thử lại.</div><div class="muted">Để báo lỗi (gửi người hỗ trợ): ${esc(listDiag())}</div>`
            );
          }
        }, 1000);
      } else S.goListPending = false;
    } catch (e) {
      S.goListPending = false;
    }
  })();
})();
