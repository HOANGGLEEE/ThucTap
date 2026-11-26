// VBDLIS Điền Nhanh – service worker
// Bấm biểu tượng (hoặc Alt+Q) để mở/ẩn bảng điền trên tab đang xem.
// Tiện ích chỉ chạm vào trang khi bạn bấm biểu tượng / các nút trong bảng điền, hoặc khi bạn bật “🤖 Tự động hết”
// (khi đó trang tải lại thì bảng tự mở lại để làm tiếp).

importScripts('page-setter.js'); // định nghĩa vbdlisPageSetter, vbdlisFireSelect2 (chạy trong trang)

// Dữ liệu TB chỉ nạp bằng file CSV trong bảng điền (Dữ liệu → Mở file CSV…) – tiện ích không tự đọc thư mục data nữa (1.21.20)

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['panel.js'] });
  } catch (e) {
    console.warn('Không mở được bảng điền trên trang này:', e);
  }
});

// Cấu hình riêng trên máy (không đưa lên git): cau-hinh.local.json, vd. { "ctCV": "<tài khoản chuyên viên>", "ctLD": "<tài khoản lãnh đạo>" }
// – tài khoản nhận khi Tự động hết chuyển tiếp hồ sơ. Không có file → {}
const CONFIG_FILE = 'cau-hinh.local.json';
async function loadConfig() {
  try {
    const res = await fetch(chrome.runtime.getURL(CONFIG_FILE));
    if (!res.ok) return {};
    const o = JSON.parse((await res.text()).replace(/^﻿/, '') || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

// “Tự động hết”: VBDLIS tải lại trang / chuyển trang (sau Lưu hồ sơ, Thực thi, Về trang tiếp nhận…) làm mất bảng điền →
// mở lại bảng để làm tiếp. Chỉ ở ĐÚNG tab bạn bật Tự động hết (tbAutoTab – tab khác mở VBDLIS không tự chạy),
// khi Tự động hết còn bật và bạn không tự đóng bảng (×).
const reopening = new Set(); // tab đang được mở lại bảng (tránh mở 2 bảng cùng lúc)
// mở lại bảng điền trên tab VBDLIS sau khi trang chuyển / tải lại – khi 🤖 bật ở đúng tab đó (hoặc bạn vừa cho chạy tiếp)
async function reopenPanel(tabId) {
  if (reopening.has(tabId)) return;
  reopening.add(tabId);
  try {
    const { tbOpts, tbShownTabs, tbAutoTab, tbGoList, tbGoRecv } = await chrome.storage.local.get(['tbOpts', 'tbShownTabs', 'tbAutoTab', 'tbGoList', 'tbGoRecv']);
    // bạn vừa bấm ▶ cho TB “Đã tiếp nhận” ở tab này (tiện ích bấm “Xử lý công việc”) → mở lại bảng để tìm tiếp, kể cả khi 🤖 tắt;
    // (25/11) bấm ▶ ở danh sách cho TB chưa tiếp nhận (tiện ích bấm Tiếp nhận hồ sơ) → mở lại bảng để tiếp nhận TB đó
    const fresh = (g) => !!g && g.tabId === tabId && Date.now() - (g.at || 0) < 2 * 60 * 1000;
    const goList = fresh(tbGoList) || fresh(tbGoRecv);
    if (!((tbOpts && tbOpts.tuDong === true && tbAutoTab === tabId) || goList) || (tbShownTabs || {})[tabId] === false) return;
    // bảng đang có trên trang → không đụng (chạy lại panel.js sẽ ẩn / hiện bảng)
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!document.getElementById('vbdlis-dien-nhanh-host') });
    if (r && r.result) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['panel.js'] });
  } catch (e) {
    console.warn('Không mở lại được bảng điền:', e);
  } finally {
    reopening.delete(tabId);
  }
}
// trang tải xong hẳn (dự phòng – boot.js thường đã mở bảng sớm hơn)
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab || !/^https:\/\/bgi\.mplis\.gov\.vn\//.test(tab.url || '')) return;
  reopenPanel(tabId);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  reopening.delete(tabId);
  try {
    const { tbShownTabs } = await chrome.storage.local.get('tbShownTabs');
    if (tbShownTabs && tabId in tbShownTabs) {
      delete tbShownTabs[tabId];
      await chrome.storage.local.set({ tbShownTabs });
    }
  } catch (e) {}
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

// tiếng “ting” khi bảng điền dừng chờ bạn mà trang chưa cho phát tiếng (trang vừa tải lại): trang ẩn offscreen.html phát
let offscreenReady = null;
async function beepOffscreen(kind) {
  if (!chrome.offscreen) return { ok: false, error: 'trình duyệt chưa hỗ trợ trang ẩn (offscreen)' };
  // Chrome tự đóng trang ẩn phát tiếng sau một lúc im lặng → lần gửi sau lỗi / không ai trả lời → tạo lại trang ẩn rồi gửi lại 1 lần
  let err = '';
  for (let lan = 0; lan < 2; lan++) {
    try {
      if (!offscreenReady)
        offscreenReady = chrome.offscreen
          .createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Kêu “ting” khi tiện ích dừng chờ bạn' })
          .catch((e) => {
            // đã có sẵn (service worker vừa khởi động lại) → dùng luôn
            if (!/single offscreen|already|only one/i.test(String((e && e.message) || e))) throw e;
          });
      await offscreenReady;
      const r = await chrome.runtime.sendMessage({ type: 'vbdlis-offscreen-beep', kind: kind === 'bad' ? 'bad' : 'ok' });
      if (r && r.ok) return r;
      err = (r && r.error) || 'trang ẩn không trả lời';
    } catch (e) {
      err = String((e && e.message) || e);
    }
    offscreenReady = null;
  }
  return { ok: false, error: err };
}

// xóa thông báo nổi (không lỗi dù Chrome trả về promise hay không)
const nClear = (id) => {
  try {
    const p = chrome.notifications.clear(id);
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
};
// bấm vào thông báo nổi → đưa cửa sổ + tab VBDLIS đang chờ lên trước
chrome.notifications.onClicked.addListener(async (id) => {
  if (!String(id).startsWith('vbdlis-')) return;
  try {
    const m = (await chrome.storage.session.get(id))[id];
    const tabId = m ? m.tabId : parseInt(String(id).slice(7), 10);
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tab.id, { active: true });
  } catch (e) {}
  nClear(id);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  nClear('vbdlis-' + tabId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('vbdlis-')) return;
  (async () => {
    try {
      if (msg.type === 'vbdlis-shown') {
        // bảng điền của tab này vừa hiện / ẩn (×) – nhớ theo TỪNG tab: tab ẩn bảng thì sau khi trang tải lại không tự mở lại bảng ở tab đó
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId != null) {
          const { tbShownTabs } = await chrome.storage.local.get('tbShownTabs');
          await chrome.storage.local.set({ tbShownTabs: { ...(tbShownTabs || {}), [tabId]: !!msg.on } });
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-whoami') {
        // bảng điền hỏi nó đang ở tab nào (để biết có phải tab chạy Tự động hết không)
        sendResponse({ ok: true, tabId: sender.tab ? sender.tab.id : null });
        return;
      }
      if (msg.type === 'vbdlis-claim') {
        // bật Tự động hết ở tab này → chỉ tab này tự chạy và được mở lại bảng sau khi trang tải lại
        const tabId = sender.tab ? sender.tab.id : null;
        await chrome.storage.local.set({ tbAutoTab: tabId });
        sendResponse({ ok: true, tabId });
        return;
      }
      if (msg.type === 'vbdlis-beep') {
        // trang VBDLIS vừa tải lại (bạn chưa bấm gì) → trang không phát được tiếng → tiện ích phát “ting” qua trang ẩn (offscreen.html)
        sendResponse(await beepOffscreen(msg.kind));
        return;
      }
      if (msg.type === 'vbdlis-boot') {
        // (26/11) boot.js: trang VBDLIS vừa dựng xong khung → mở lại bảng điền ngay (không chờ trang tải hết)
        if (sender.tab && sender.tab.id != null && sender.frameId === 0) reopenPanel(sender.tab.id);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-notify') {
        // (25/11 – bạn: “thêm thông báo nổi khi cần bạn xác nhận”) thông báo nổi của Windows; bấm vào → về đúng tab VBDLIS đang chờ
        const tab = sender.tab;
        if (!tab || tab.id == null) return sendResponse({ ok: false });
        const id = 'vbdlis-' + tab.id;
        nClear(id);
        await chrome.notifications.create(id, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: String(msg.title || 'VBDLIS Điền Nhanh – cần bạn').slice(0, 80),
          message: String(msg.text || '').slice(0, 220),
          contextMessage: 'Bấm vào đây để mở trang VBDLIS',
          priority: 2,
          requireInteraction: !!msg.sticky,
        });
        await chrome.storage.session.set({ [id]: { tabId: tab.id, windowId: tab.windowId } }).catch(() => {});
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-notify-clear') {
        const tabId = sender.tab && sender.tab.id;
        if (tabId != null) {
          nClear('vbdlis-' + tabId);
          await chrome.storage.session.remove('vbdlis-' + tabId).catch(() => {});
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-badge') {
        // tiện ích đang chờ bạn → dấu “!” đỏ trên biểu tượng của tab đó (thấy cả khi tiếng báo chưa bật được)
        const tabId = sender.tab && sender.tab.id;
        if (tabId != null) {
          await chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' });
          await chrome.action.setBadgeText({ tabId, text: String(msg.text || '').slice(0, 3) });
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'vbdlis-config') {
        sendResponse({ ok: true, config: await loadConfig() });
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
      if (msg.type === 'vbdlis-arm-file') {
        // đính kèm file quét: cài móc trong trang (world MAIN) để nút “Tải lên” dùng file tiện ích đã đặt sẵn
        const [r] = await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
          world: 'MAIN',
          func: vbdlisArmFile,
        });
        sendResponse({ ok: true, result: r && r.result });
        return;
      }
      sendResponse({ ok: false, error: 'Lệnh không hợp lệ' });
    } catch (e) {
      sendResponse({ ok: false, error: friendlyError(e) });
    }
  })();
  return true; // trả lời bất đồng bộ
});
