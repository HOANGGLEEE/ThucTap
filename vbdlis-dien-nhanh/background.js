// VBDLIS Điền Nhanh – service worker
// Bấm biểu tượng (hoặc Alt+Q) để mở/ẩn bảng điền trên tab đang xem.
// Tiện ích chỉ chạm vào trang khi bạn bấm biểu tượng / các nút trong bảng điền. Không bấm nút Lưu nào.

const DATA_FILE = 'data/du-lieu.json';
importScripts('page-setter.js'); // định nghĩa vbdlisPageSetter, vbdlisFireSelect2 (chạy trong trang)

// Đọc file dữ liệu TB trong thư mục data của tiện ích (đọc thẳng từ đĩa – sửa file là lần mở bảng sau thấy ngay)
async function loadDataText() {
  // Chưa có file (máy mới tải tiện ích từ git – dữ liệu không đưa lên git) → coi như dữ liệu trống
  let res;
  try {
    res = await fetch(chrome.runtime.getURL(DATA_FILE));
  } catch (e) {
    return '[]';
  }
  if (!res.ok) return '[]';
  return (await res.text()).replace(/^﻿/, '').trim() || '[]'; // bỏ BOM (file lưu từ Notepad / Excel)
}
async function loadSample() {
  return JSON.parse(await loadDataText());
}

chrome.runtime.onInstalled.addListener(async () => {
  const { tbData } = await chrome.storage.local.get('tbData');
  if (tbData === undefined) { // chỉ khi chưa có dữ liệu bao giờ (bạn đã xóa hết thì để trống)
    try {
      await chrome.storage.local.set({ tbData: await loadSample() });
    } catch (e) {
      console.warn('Không nạp được dữ liệu mẫu', e);
    }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['panel.js'] });
  } catch (e) {
    console.warn('Không mở được bảng điền trên trang này:', e);
  }
});

// Lỗi của Chrome → câu tiếng Việt dễ hiểu
function friendlyError(e) {
  const m = String((e && e.message) || e);
  if (/Cannot access|must request permission|Missing host permission|cannot be scripted/i.test(m))
    return 'Tiện ích mất quyền truy cập trang này (trang vừa chuyển đi rồi quay lại?). Bấm biểu tượng tiện ích (Alt+Q) để cấp lại quyền – nếu bảng bị ẩn thì bấm thêm lần nữa.';
  if (/No tab with id|Frame with ID|was removed|No frame/i.test(m))
    return 'Trang vừa tải lại hoặc đã đóng – mở lại màn hình VBDLIS rồi bấm biểu tượng tiện ích.';
  return m;
}

// Chạy bộ điền trong các khung (frame) của tab, trả kết quả thô (kèm frameId).
// allFrames tự bỏ qua khung không có quyền; chỉ khi chèn file thất bại mới chạy riêng khung chính.
// Lệnh đã bắt đầu chạy thì KHÔNG chạy lại (tránh bấm "Thêm thửa đất" hai lần).
async function execRaw(tabId, msg) {
  let allFrames = true;
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['filler.js'] });
  } catch (e) {
    allFrames = false;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['filler.js'] });
  }
  return chrome.scripting.executeScript({
    target: { tabId, allFrames },
    func: (m) => (window.__vbdlis ? window.__vbdlis.run(m) : null),
    args: [msg],
  });
}

// Ô chọn select2 mà trang chỉ nghe sự kiện "select2:select" → bắn sự kiện đó trong trang
async function fireSelect2(tabId, label) {
  const res = await execRaw(tabId, { type: 'vbdlis-act', action: 'markSelect', label });
  const hits = res.filter((r) => r && r.result && r.result.ok);
  if (hits.length !== 1) return [{ ok: false, why: hits.length ? 'thấy nhiều ô ' + label : 'không thấy ô ' + label }];
  const hit = hits[0];
  const [p] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [hit.frameId] },
    world: 'MAIN',
    func: vbdlisFireSelect2,
    args: [hit.result.id],
  });
  return [p && p.result];
}

// Chạy trong các khung, kèm bước 2 cho lệnh điền.
async function runInFrames(tabId, msg) {
  const res = await execRaw(tabId, msg);
  // Bước 2: ô ngày / ô số "m²" / ô trang không giữ giá trị → điền bằng thư viện của trang rồi kiểm tra lại
  if (msg.type === 'vbdlis-fill') {
    for (const r of res) {
      const out = r && r.result;
      if (!out || !out.retry || !out.retry.length) continue;
      try {
        const [p] = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [r.frameId] },
          world: 'MAIN',
          func: vbdlisPageSetter,
          args: [out.retry],
        });
        const [v] = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [r.frameId] },
          func: (t, m) => (window.__vbdlis ? window.__vbdlis.verify(t, m) : null),
          args: [out.token, (p && p.result) || []],
        });
        if (v && v.result) r.result = v.result;
      } catch (e) {
        console.warn('Bước 2 lỗi:', e);
        // không kiểm tra được → các ô của bước 2 coi như CHƯA chắc chắn
        for (const it of out.retry) {
          const x = out.results[it.idx];
          if (x) {
            x.ok = false;
            x.msg = 'chưa kiểm tra được (' + friendlyError(e) + ')';
          }
        }
      }
    }
  }
  return res.map((r) => r && r.result).filter(Boolean);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('vbdlis-')) return;
  (async () => {
    try {
      if (msg.type === 'vbdlis-sample') {
        // gửi nguyên chữ của file: bảng điền tự đọc JSON (tự sửa lỗi nhỏ, báo rõ dòng sai)
        sendResponse({ ok: true, text: await loadDataText() });
        return;
      }
      if (msg.type === 'vbdlis-fill' || msg.type === 'vbdlis-scan' || msg.type === 'vbdlis-act') {
        sendResponse({ ok: true, frames: await runInFrames(sender.tab.id, msg) });
        return;
      }
      if (msg.type === 'vbdlis-rec-inject') {
        // bật bộ ghi thao tác trên trang (khung chính) nếu chưa có
        await chrome.scripting.executeScript({ target: { tabId: sender.tab.id }, files: ['recorder.js'] });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-select2') {
        sendResponse({ ok: true, frames: await fireSelect2(sender.tab.id, msg.label) });
        return;
      }
      sendResponse({ ok: false, error: 'Lệnh không hợp lệ' });
    } catch (e) {
      sendResponse({ ok: false, error: friendlyError(e) });
    }
  })();
  return true; // trả lời bất đồng bộ
});
