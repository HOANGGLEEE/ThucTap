// Trang ẩn (offscreen) của tiện ích: phát tiếng “ting” khi bảng điền dừng chờ bạn.
// Trang VBDLIS vừa tải lại (bạn chưa bấm gì trên trang mới) thì trình duyệt không cho trang phát tiếng → bảng điền nhờ tiện ích phát ở đây.
// Không đọc, không gửi dữ liệu gì – chỉ nhận lệnh { type: 'vbdlis-offscreen-beep', kind } từ background.js.
let ctx = null;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'vbdlis-offscreen-beep') return;
  try {
    ctx = ctx || new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    // giống tiếng của bảng điền: 'bad' = 2 nốt trầm (dừng / lỗi), còn lại = 2 nốt cao (xong, tới lượt bạn)
    (msg.kind === 'bad' ? [523, 392] : [880, 1175]).forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = hz;
      const s = t0 + i * 0.17;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.22, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 0.16);
    });
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: String((e && e.message) || e) });
  }
});
