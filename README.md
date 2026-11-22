# VBDLIS Điền Nhanh – tổng hợp dự án

Tài liệu này gom toàn bộ những gì đã làm và đã quyết trong đoạn chat với Claude, để làm tiếp ở chat mới, tài khoản khác hay máy khác. **Không có dữ liệu cá nhân**: không có tên, số CCCD hay địa chỉ của ai, chỉ ghi số TB.

> Cách dùng ở chat mới: mở thư mục này trong Claude Code và nói *“Đọc README.md rồi làm tiếp phần Việc còn dở”*.

---

## 1. Dự án là gì

Một cán bộ địa chính (phường Việt Yên, Bắc Ninh) nhập hồ sơ đăng ký đất đai vào **VBDLIS** (`https://bgi.mplis.gov.vn`). Mỗi hồ sơ là một **TB** (Thông báo xác nhận – TBXN) kèm đơn đăng ký (**DDK**). Dự án có hai phần:

| Phần | Ở đâu | Làm gì |
|---|---|---|
| Tiện ích Chrome **VBDLIS Điền Nhanh** | `vbdlis-dien-nhanh/` | Tự điền các ô trên VBDLIS từ dữ liệu JSON. **Không bao giờ tự bấm Lưu.** |
| Skill Claude **tao-du-lieu-vbdlis** | `C:\Users\Hoang\.claude\skills\tao-du-lieu-vbdlis\`; bản đóng gói `tao-du-lieu-vbdlis.skill` | Đọc bản scan (TBXN + DDK) trong các thư mục `TB xxxx` rồi tạo `data/du-lieu.json` và `data/TB_<số>.json` cho tiện ích |

Hướng dẫn chi tiết cho người dùng nằm ở [`vbdlis-dien-nhanh/HUONG-DAN.md`](vbdlis-dien-nhanh/HUONG-DAN.md).

---

## 2. Quy tắc nghiệp vụ người dùng đã chốt (bắt buộc giữ)

1. **Không bấm bất kỳ nút Lưu nào**: Lưu, Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Thực thi. Cũng không trả lời hộp hỏi của trang (vd. “Cập nhật địa chỉ tài sản”, “Giấy tờ tùy thân đã tồn tại”). Lý do: người dùng tự kiểm tra rồi mới bấm.
   - Được phép: mở cửa sổ nhập (“+ Thêm thửa đất”, “Thêm → Cá nhân”, “Thêm → Thửa đất”), điền, tô vàng nút, **đặt con trỏ vào nút Lưu** (người dùng tự nhấn Enter).
2. Chủ sử dụng: chỉ điền **Năm sinh**. **Không** điền Ngày sinh, Ngày cấp, Ngày hết hạn.
3. **Tên chủ theo thẻ CCCD / Căn cước**. Thẻ mờ quá không đọc được (hoặc không có thẻ) mới lấy theo TBXN. Có khác nhau thì ghi vào `ghiChu`.
4. **Thời hạn SD** = “50 năm”. **Nguồn gốc** = “Công nhận QSDĐ như giao đất không thu tiền sử dụng đất”.
5. **Diện tích**: PDF ghi `56,5` thì nhập `56.5`; `1.712,6` thì nhập `1712.6`.
6. **Mọi ô địa chỉ** (người nộp, chủ, thửa, địa chỉ tài sản) lấy theo **mục 1c của TBXN**.
7. **Số biên nhận** = `KH 2959.07777.` + các cặp `<tờ>.<thửa>` nối bằng `-`, đúng thứ tự STT trong danh sách thửa của TBXN.
8. Bước **tiếp nhận** chỉ thêm **thửa đầu tiên**. Các thửa còn lại thêm ở bước **Nhập đơn đăng ký**. Người dùng đã xác nhận: “Đúng, giữ vậy”. Muốn thêm hết ở bước tiếp nhận thì đổi tùy chọn trong tab Biên nhận.
9. TB có **nhiều chủ** (kể cả người dùng chung, vợ/chồng): thêm **tất cả**.
10. Thư mục có **2 cặp PDF** (tên file bị chia vì quá dài) vẫn là **một TB**, không tách thành -1/-2.
11. Phường/Xã mặc định: “Phường Việt Yên (Phường Bích Động - Thị xã Việt Yên cũ)”. Quy trình: `XA_KH2959`. Điều kiện cấp giấy: “Chưa đủ điều kiện cấp giấy”. Tích “Đăng ký lần đầu”.
12. **Dữ liệu cá nhân không lên git.** Máy khác tải repo về thì thư mục `data/` trống.

---

## 3. Quy trình thật trên VBDLIS (đã ghi lại từ thao tác thật)

**Bước 1 – Tiếp nhận hồ sơ**: Phường/Xã → quy trình `XA_KH2959` → Số biên nhận → “+ Thêm thửa đất” (thửa đầu) → Lưu. Trang hỏi “Cập nhật địa chỉ tài sản” → Đồng ý. Sau đó điền người nộp, số giấy tờ, địa chỉ → **Lưu hồ sơ**. Trang báo *“Thành công – Lưu hồ sơ thành công”*.

**Bước 2 – Xử lý hồ sơ → Quy trình xử lý → Xử lý tác vụ → cửa sổ “Nhập đơn đăng ký”**:
- Chọn Điều kiện cấp giấy, tích Đăng ký lần đầu.
- **Thêm → Cá nhân** cho từng chủ (trang có thể hỏi “Giấy tờ tùy thân đã tồn tại…”).
- **Thêm → Thửa đất** cho từng thửa.
- **Lưu thông tin đăng ký** → trang báo *“Cập nhật đơn đăng ký thành công”*.
- **Hoàn tất** → trang báo *“Lưu đơn đăng ký thành công”*.

Những điều đã biết về trang thật:
- Cửa sổ “Quy trình xử lý” (z-index 1050) **vẫn mở nằm dưới** “Nhập đơn đăng ký” (`#mdlRemoteForm`, z-index 1060). Cửa sổ trên cùng phải tìm bằng hit-test (`elementFromPoint`).
- Cây chủ `#treeChuSuDung` (jstree) có nút nhóm “Cá nhân -1790…_”. Mỗi người là một nút: `Bà: <Họ tên viết hoa thường> - Năm sinh:1957 - Địa chỉ: … - Số CCCD:027…`.
- Cây thửa `#treeTaiSan` có nút nhóm “Thửa đất lịch sử -1790…_”. Mỗi thửa là một nút `22 (231) - Diện tích: 78.1 m² - Địa chỉ: …`, nút con `LUC: - Số thứ tự:1 - Diện tích:78.1 m² - Thời hạn: …`.
- Thông báo dạng toastr (tiêu đề + nội dung). Thông báo nhiễu: “Bạn đã nhận được 1 yêu cầu xử lý hồ sơ có số biên nhận là …”.
- Hộp hỏi dạng jconfirm (`role=dialog`, không có ô nhập).
- Các ô có mặt nạ (`.number`, `.area`, `.datepicker`, inputmask, AutoNumeric) phải điền bằng chính thư viện của trang. Việc này chạy ở bước 2 qua `page-setter.js` (MAIN world).
- Id nút: `a#btnXuLyHoSo` (Xử lý hồ sơ), `btnThemChuSuDung` / `btnThemTaiSan` (Thêm), `btnLuuDangKyThongTinDangK` (Lưu thông tin đăng ký / Hoàn tất), `btnExecuteCommand` (Thực thi).

---

## 4. Tiện ích – cấu trúc kỹ thuật

| File | Vai trò |
|---|---|
| `manifest.json` | MV3, bản **1.11.2**. Quyền: activeTab, scripting, storage, unlimitedStorage. Host: bgi.mplis.gov.vn. Content script: `recorder.js` |
| `background.js` | Service worker. Bấm biểu tượng / Alt+Q thì chèn `panel.js`. `execRaw` chèn `filler.js` vào mọi khung (frame). Bước 2 gọi `page-setter.js` trong MAIN world. Đọc `data/du-lieu.json`; thiếu file thì coi là `[]` |
| `panel.js` | Bảng điều khiển (shadow DOM, khung chính). `PANEL_VERSION = '1.11.2'`; bảng khác phiên bản sẽ bị thay |
| `filler.js` | Bộ điền, `VERSION = 17`. `SECTIONS` mô tả các ô theo **nhãn hiển thị**. Các lệnh `act`: `modalState`, `readThuaTable`, `donHas`, `donRead`, `dialogState`, `readField`, `hasCellText`, `selectHasOption`, `markSelect`, `probe`, `focusSave`, `highlight` |
| `page-setter.js` | Điền ô có mặt nạ bằng thư viện của trang (jQuery, AutoNumeric, datepicker, inputmask), có đường dự phòng khi trang không có jQuery |
| `recorder.js` | Ghi thao tác (nút ●) để gửi người hỗ trợ: che mật khẩu, che số ≥ 9 chữ số |
| `test/mock-vbdlis.html` | Trang giả lập VBDLIS để thử: cây jstree như thật, toastr, jconfirm, mặt nạ nhập |
| `HUONG-DAN.md` | Hướng dẫn cho người dùng |

**Khóa lưu trong `chrome.storage.local`**:
- `tbData`: danh sách TB.
- `tbDone`: dấu ✓ từng mục, khóa `"<tb>|<mục>"`; `…|pending` là dấu an toàn.
- `tbCur`, `tbTab`, `tbBox`: TB đang chọn, tab đang mở, cỡ và vị trí bảng.
- `tbOpts`: tùy chọn (`thuaTN`, `amBao`, `enterLuu`).
- `tbFile`, `tbDeleted`: đồng bộ với thư mục data.
- `tbStage`: tiến độ `{tb: {tn, tnBy, don, donBy, lech, hoan:{at,lyDo}, ack}}`.
- `tbBakAt`: lần sao lưu tiến độ gần nhất.
- `recState`, `recEv:*`: bản ghi thao tác.

**Các khối chính trong `panel.js`**:
- **`runAll`** (“▶ Chạy cả TB”) tự biết đang ở bước nào. Bước tiếp nhận: Phường → quy trình → Số biên nhận → thửa đầu (chờ người dùng Lưu) → người nộp → đọc lại → đối chiếu bảng thửa → tô vàng “Lưu hồ sơ”. Bước đơn (`runDon`): `identifyDon` → `gateTb` → Điều kiện cấp giấy → từng chủ, từng thửa (mở cửa sổ, điền, chờ Lưu, thấy đã vào đơn) → đối chiếu có mặt → **phiếu đối chiếu số liệu** (`buildSheet`) → tô vàng “Lưu thông tin đăng ký”.
- **`identifyDon` / `parseDon` / `matchTb`**: đọc cây chủ và thửa của đơn để biết hồ sơ của TB nào. Đơn có thửa thì phải trùng ít nhất một thửa. Nhiều TB khớp như nhau thì hỏi bằng nút. Khớp rõ một TB khác thì tự chọn TB đó.
- **`gateTb`**: TB tạm hoãn → dừng, nút “Bỏ tạm hoãn”. TB có ghi chú, dữ liệu thiếu hoặc trùng thửa → **không dừng**, chỉ hiện một dòng “⚠ Ghi chú: …” rồi chạy tiếp (người dùng yêu cầu ở bản 1.11.1: “cho chạy liên tục”). Riêng ở bước tiếp nhận: TB đã tiếp nhận hoặc trùng thửa với TB đã tiếp nhận → nút “Vẫn tiếp nhận…”. Xác nhận là token dùng một lần (`consume`), `#runAll` bỏ qua bấm đúp.
- **Tự ghi nhận tiến độ**: `MutationObserver` đọc toast “Lưu hồ sơ thành công” / “Lưu đơn đăng ký thành công”. `S.armed` được đặt khi chạy xong. Chỉ đánh dấu khi kiểm chắc (ô Số biên nhận đúng; cây đơn đúng TB). Không chắc thì hiện nút “Đánh dấu…”.
- **`buildSheet`**: so họ tên (dùng `toneFold`: Thủy = Thuỷ nhưng Hà ≠ Hả), năm sinh (nhãn trống tính là ✗), giới tính (“Ông/Bà” = chưa chọn = ✗), số giấy tờ, diện tích, mục đích, thời hạn, chủ/thửa bị thêm 2 lần, mục không có trong dữ liệu.
- **`quickLine` + `focusSave`**: dòng tóm tắt; mọi ô khớp thì đặt con trỏ vào nút Lưu.
- **`needYou` / `beep`**: tiếng “ting” (WebAudio) và nháy tên tab khi chờ người dùng.
- **Bảng Tiến độ**: lọc, thống kê theo ngày, sao chép bảng, tải file Excel (UTF-16 + Tab), sao lưu / nạp tiến độ.
- **`doScan` (“Kiểm tra trang”)**: lệnh `probe` kiểm tra còn đủ ô và nút trên màn hình đang mở.

**Thử trên trang giả lập**:
- Cấu hình `.claude/launch.json` tên `vbdlis-test`: `python -m http.server 8765 --directory vbdlis-dien-nhanh`. Mở `http://localhost:8765/test/mock-vbdlis.html`.
- Hàm giúp thử: `window.__sampleOverride` (dữ liệu thử), `window.__mem` (bộ nhớ giả), `openDon()`, `mockDonCo(chu, thua)`, `mockLuuHoSo()`, `mockLuuDK()`, `mockHoanTat()`.
- Nút Lưu thật trên trang giả lập là **bẫy**: tiện ích lỡ bấm thì nhật ký ghi “!!!”.

---

## 5. Lịch sử phiên bản (các bản trong đoạn chat)

| Bản | Thay đổi |
|---|---|
| 1.9.x | “Chạy cả TB” chạy được ở cả bước Nhập đơn đăng ký. Nút xóa dữ liệu. Kéo góc để đổi cỡ bảng. Tự đọc `data/du-lieu.json` (thiếu file → dữ liệu trống). Bỏ Ngày cấp, Ngày hết hạn. Hộp Dữ liệu có ✕ Đóng / Esc. Tự sửa lỗi JSON nhỏ |
| 1.9.4 | Thêm **tất cả chủ** của TB (kể cả người dùng chung). *(Commit gần nhất trên git: `4d8b011`)* |
| 1.10.0 | **Tự nhận đúng TB** của hồ sơ đang mở. **Sổ tiến độ** ○ ◐ ✓ tự đánh dấu theo toast. **Phiếu đối chiếu số liệu**. Cảnh báo **trùng thửa**. Chặn **tiếp nhận lại**. Bảng ☰ Tiến độ + xuất Excel. Xóa dấu ✓ cũ khi dữ liệu TB đổi |
| 1.10.1 | Bỏ nút “Đóng” thừa ở dưới hộp Dữ liệu / Tiến độ |
| 1.11.0 | Sửa 15 lỗi do đợt soát code tìm ra. **⏸ Tạm hoãn** kèm lý do. **Chốt ghi chú** (xem một lần). **Tóm tắt + con trỏ ở nút Lưu (Enter)**. **Tiếng báo + nháy tên tab**. **Sao lưu / nạp tiến độ**, thống kê hôm nay. Nút **Kiểm tra trang** |
| 1.11.1 | Bỏ bước dừng “Đã xem” ghi chú. Ghi chú chỉ hiện một dòng nhắc, tiện ích chạy liên tục (người dùng thử trên VBDLIS thật với TB 1530 và yêu cầu) |
| 1.11.2 | **Thanh ngăn “•••”** kéo lên / xuống để đổi chiều cao phần nhật ký (nhớ cỡ trong `tbBox.rh`, bấm đúp: về mặc định) |

Bản 1.10.x–1.11.2 **chưa commit**. Đã thử hết trên trang giả lập. Trên **VBDLIS thật**, người dùng đã chạy bước tiếp nhận TB 1530 bằng bản 1.11.0: chạy hết tới bước tô vàng “Lưu hồ sơ”. Bước Nhập đơn đăng ký chưa thử trên trang thật.

---

## 6. Dữ liệu hiện có

- `vbdlis-dien-nhanh/data/du-lieu.json` + `TB_<số>.json`: đợt **Đông Lương** gồm **80 TB (1527–1606), 374 thửa, 88 chủ**. Nằm trong `.gitignore`, chỉ có trên máy.
- Nguồn scan: `Thông báo 1527- 1606 (Đông Lương) 21.11.zip`, nằm ở thư mục LocalSend của người dùng.

**Các TB cần lưu ý** (ghi chú chi tiết nằm trong `ghiChu` của từng TB):

| TB | Vấn đề | Đề xuất |
|---|---|---|
| 1532, 1563, 1571, 1572, 1574, 1597, 1598 | Tên trên TBXN **khác** thẻ CCCD; dữ liệu đang theo TBXN | Đổi theo CCCD (quy tắc 3), đọc lại thẻ để chắc |
| 1594 | TBXN khác CCCD | Đã theo CCCD |
| 1528, 1551, 1554, 1558, 1559, 1565, 1569, 1576, 1580, 1581, 1582, 1585, 1586, 1602 | Tên trong đơn khác TBXN (sửa tay, con cháu đứng tên…); ghi chú chưa nói rõ thẻ ghi gì; 1565 có người dùng chung với thẻ hơi mờ | Đọc thẻ CCCD để chắc tên |
| 1583 | **Chủ chưa rõ**: số CCCD trên TBXN sai quy tắc, không khớp thẻ nào; đơn thêm tay 2 thửa không có trên TBXN | ⏸ Tạm hoãn, hỏi lại |
| 1582 | **Trùng hoàn toàn** TB 1527 (cùng chủ, cùng thửa 55/117) | Chỉ nhập 1 lần |
| 1561 | Thửa 56/110 **không có mục đích** sử dụng | Chọn tay |
| 1552, 1585, 1593 | Đơn ghi số thửa nhiều hơn TBXN (ghi tay “còn thiếu”) | Nhập theo TBXN |
| 1556 | Số CCCD trên TBXN khác thẻ | Đã dùng số trên thẻ |
| 1539, 1559 | Thẻ **Căn cước** mẫu mới | Loại giấy tờ “Căn cước” |
| 1565, 1577, 1578, 1585, 1586, 1602 | Có người dùng chung / nhiều chủ | Tiện ích thêm đủ |
| 1552 & 1554, 1573 & 1575, 1585 & 1586 | Cùng chủ, khác thửa | Bình thường, không trùng |

**Quy tắc kiểm số CCCD**: 12 chữ số. Chữ số thứ 4 = giới tính và thế kỷ (0 nam 19xx, 1 nữ 19xx, 2 nam 20xx, 3 nữ 20xx). Chữ số 5–6 = hai số cuối năm sinh.

---

## 7. Skill `tao-du-lieu-vbdlis`

- `SKILL.md`, `references/mau-json.md` (mẫu JSON, dữ liệu giả).
- `scripts/khung_tb.py`: dựng khung TB; so trang PDF bằng hash ảnh để gộp thư mục 2 cặp PDF thành 1 TB.
- `scripts/xem_pdf.py`: xuất trang PDF ra ảnh (pypdfium2; **không** chạy `python -I`).
- `scripts/gop_du_lieu.py`: gộp `TB_*.json` thành `du-lieu.json`; chuẩn hóa; suy năm sinh và giới tính từ CCCD; dựng Số biên nhận; tạo `.bak`.
- Đóng gói: `tao-du-lieu-vbdlis.skill` (zip, mọi mục nằm dưới `tao-du-lieu-vbdlis/`). **Không** được chứa dữ liệu thật.

---

## 8. Git và dữ liệu cá nhân

- Remote: GitHub `HOANGGLEEE/ThucTap`. `.gitignore` loại: `.claude/`, `vbdlis-dien-nhanh/data/*` (giữ `.gitkeep`), `TB */`, `*.pdf`, `*.zip`, `*.xlsx`, `*.skill`.
- ⚠ **Ba commit cũ đầu tiên đã đưa dữ liệu cá nhân lên git** trước khi có `.gitignore`. Nên để repo ở chế độ **Private**, hoặc nhờ Claude viết lại lịch sử git để xóa hẳn.
- README này **không** có dữ liệu cá nhân nên đưa lên git được.

---

## 9. Việc còn dở (làm tiếp từ đây)

1. **Ý 3 – đổi tên theo CCCD trong dữ liệu Đông Lương**: đọc thẻ CCCD của các TB ở bảng mục 6 (mỗi người đọc hai lần độc lập), chỉ đổi khi hai lần đọc khớp nhau và thẻ đọc rõ. Sửa cả `TB_<số>.json` lẫn `du-lieu.json` (giữ định dạng, sao lưu trước), cập nhật `ghiChu`. *Lần chạy trước bị dừng giữa chừng (lỗi mạng / phiên kết thúc); **chưa sửa tên nào**.*
2. **Ý 11 – `scripts/kiem_tra.py` trong skill** (“phiếu kiểm tra dữ liệu”, chạy ngay sau khi tạo JSON):
   - So tên file PDF với danh sách thửa.
   - Kiểm Số biên nhận đúng thứ tự thửa.
   - Kiểm CCCD theo năm sinh và giới tính.
   - Tìm thửa trùng giữa các TB, TB trùng hoàn toàn.
   - Kiểm diện tích đúng dạng, mục đích không thiếu.
   - So `du-lieu.json` với `TB_*.json`; liệt kê mọi `ghiChu`.
   - In báo cáo theo LỖI / CẢNH BÁO / GHI CHÚ, ghi ra `data/phieu-kiem-tra.txt`.
   - `gop_du_lieu.py` gọi nó ở cuối. Đóng gói lại `.skill`.
   - *Chưa làm.*
3. **Soát code bản 1.11.0** (hai hướng: luồng / trạng thái; trang thật / quy tắc), kiểm chứng từng lỗi rồi sửa. *Lần chạy trước bị dừng, chưa có kết quả.*
4. **Thử trên VBDLIS thật**: `chrome://extensions` → ⟳ “VBDLIS Điền Nhanh” → F5 VBDLIS (bảng phải hiện v1.11.2). Bấm **Kiểm tra trang** ở từng màn hình.
5. **Commit / push** các thay đổi 1.10–1.11 (người dùng tự quyết).

**Ý tưởng chưa làm** (người dùng chưa chọn):
- (1) Đối soát cuối đợt với danh sách hồ sơ trên VBDLIS.
- (4) Tự tìm hồ sơ ở bước 2 theo số biên nhận.
- (7) Phím tắt Alt+R / Alt+N.
- (8) Đính kèm file quét theo tên file.
- (9) Hỗ trợ bước chuyển tiếp (“Chọn người xử lý tác vụ tiếp theo” → tô vàng “Thực thi”).

Các ý 1, 4, 8, 9 cần người dùng **ghi thao tác** (nút ●) một lần trên VBDLIS thật.

---

## 10. Cài tiện ích (tóm tắt)

1. `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `vbdlis-dien-nhanh`.
2. Mở VBDLIS → bấm biểu tượng tiện ích hoặc **Alt+Q**.
3. Dữ liệu: đặt `data/du-lieu.json` (tiện ích tự đọc), hoặc kéo thả file `.json` vào bảng, hoặc **Dữ liệu → Mở file…**.
4. Sửa file của tiện ích xong thì bấm ⟳ ở trang tiện ích rồi F5 trang VBDLIS.
