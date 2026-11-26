// VBDLIS Điền Nhanh – báo tiện ích trang VBDLIS vừa dựng xong khung (document_end), để mở lại bảng điền ngay
// (26/11 – bạn: “cái tự động nó vẫn khá là lâu mới phản ứng”): trước đây chỉ mở lại khi trang tải XONG HẾT (hình, script…).
// Tiện ích chỉ mở bảng khi 🤖 Tự động hết đang bật ở đúng tab này (hoặc bạn vừa cho chạy tiếp sau khi trang chuyển) – còn lại không làm gì.
try {
  if (window.top === window) chrome.runtime.sendMessage({ type: 'vbdlis-boot' }).catch(() => {});
} catch (e) {}
