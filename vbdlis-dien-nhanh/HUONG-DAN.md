# VBDLIS Điền Nhanh – hướng dẫn

Tiện ích cho Chrome / Edge / Cốc Cốc. Nó điền sẵn các ô trên VBDLIS từ dữ liệu TBXN.
**Tiện ích không bao giờ tự bấm “Lưu”**: bạn kiểm tra lại rồi tự bấm.

## Cài đặt (một lần)
1. Mở trình duyệt, gõ vào thanh địa chỉ: `chrome://extensions` (Edge: `edge://extensions`, Cốc Cốc: `coccoc://extensions`).
2. Bật **Chế độ dành cho nhà phát triển** (Developer mode), ở góc trên bên phải.
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) rồi chọn thư mục `vbdlis-dien-nhanh` này.
4. Bấm biểu tượng 🧩 rồi ghim “VBDLIS Điền Nhanh” lên thanh công cụ.

## Cách nhanh nhất: nút “▶ Chạy cả TB”
Nút này tự biết bạn đang ở bước nào:
- đang ở màn hình **Tiếp nhận hồ sơ** (không mở cửa sổ con) → làm bước tiếp nhận (dưới đây);
- đang mở cửa sổ **Nhập đơn đăng ký** → làm bước đơn đăng ký (xem mục “Bước Nhập đơn đăng ký”).

Mở màn hình **Tiếp nhận hồ sơ** mới, bấm Alt+Q, chọn TB, bấm **▶ Chạy cả TB**. Tiện ích làm lần lượt:
1. Chọn Phường/Xã “Phường Việt Yên (Phường Bích Động - Thị xã Việt Yên cũ)”.
2. Chọn quy trình “XA_KH2959…”.
3. Điền Số biên nhận.
4. Thửa đầu tiên: tự bấm “+ Thêm thửa đất”, điền Số thứ tự thửa, Số hiệu tờ bản đồ, Diện tích, Địa chỉ → **dừng chờ bạn kiểm tra và tự bấm “Lưu”**. Trang hỏi “Cập nhật địa chỉ tài sản” thì **bạn bấm “Đồng ý”** – tiện ích chờ bạn trả lời rồi mới làm tiếp.
   Mặc định chỉ thêm **thửa đầu** (đủ để lưu hồ sơ; các thửa nhập đầy đủ ở bước Nhập đơn đăng ký). Muốn thêm tất cả các thửa ở bước này: tab Biên nhận → ô “Chạy cả TB thêm thửa nào…” → “Tất cả các thửa của TB”.
5. Điền Người nộp hồ sơ, Số giấy tờ, Địa chỉ (theo mục 1c của TBXN), Địa chỉ tài sản.
6. Đối chiếu bảng thửa trên trang với dữ liệu (thiếu / thừa / trùng / sai diện tích).
7. Tô vàng nút **“Lưu hồ sơ”** – bạn kiểm tra toàn bộ rồi tự bấm. Khi trang báo **“Lưu hồ sơ thành công”**, tiện ích tự đánh dấu TB đó **◐ đã tiếp nhận** và gợi ý TB chưa làm tiếp theo (bấm **Chọn**).

Tiện ích **không bấm nút Lưu nào**. Bấm “■ Dừng” để thôi giữa chừng; bấm “▶ Chạy cả TB” lại thì bước nào/thửa nào đã xong sẽ được bỏ qua. Phường/Xã và quy trình có thể đổi trong tab Biên nhận.

**Tiện ích tự dừng (không ghi gì lên trang) khi:**
- dữ liệu TB thiếu (Số biên nhận, người nộp, thửa…) hoặc diện tích viết không rõ;
- trang đang còn hồ sơ khác (bảng thửa có thửa không thuộc TB này, hoặc Số biên nhận / Người nộp đang là của TB khác) → mở màn hình Tiếp nhận hồ sơ mới;
- đang mở một cửa sổ khác (vd. Thông tin cá nhân) hoặc một hộp hỏi của trang → đóng / trả lời nó trước;
- cuối cùng bảng thửa trên trang **không khớp** dữ liệu (thiếu / thừa / trùng / sai diện tích) → **không** tô nút Lưu hồ sơ, sửa trên trang trước;
- TB này **đã tiếp nhận rồi**, hoặc **trùng thửa** với một TB đã tiếp nhận → tiện ích báo rõ và chỉ làm khi bạn bấm nút **“Vẫn tiếp nhận TB …”** hiện ngay dưới dòng báo (tránh tạo hồ sơ trùng; bấm đúp nút Chạy không lọt qua được). Đánh dấu nhầm thì đổi ô **Trạng thái** về “Chưa làm”;
- TB đang **⏸ Tạm hoãn** → dừng, có nút **“Bỏ tạm hoãn, chạy TB …”**;
- TB có **ghi chú** (tên TBXN khác CCCD, thửa thiếu mục đích, trùng thửa với TB khác…) mà bạn chưa xem → dừng, hiện khung vàng ghi chú và nút **“Đã xem – chạy tiếp”**. Mỗi ghi chú chỉ hỏi **một lần** (ghi chú đổi thì hỏi lại).

Nếu bấm Hủy bỏ ở một thửa rồi chạy lại, tiện ích sẽ hỏi lại một lần (bấm “▶ Chạy cả TB” thêm lần nữa) trước khi mở lại thửa đó – để tránh nhập trùng.

**Diện tích:** PDF ghi “56,5” thì VBDLIS nhập “56.5”. Gõ/dán “56,5” hay “1.712,6” vào bảng điền sẽ tự đổi thành 56.5 / 1712.6; giá trị không rõ (vd “1.225”) sẽ bị báo ✗ để bạn sửa.

## Bước Nhập đơn đăng ký (Xử lý hồ sơ → Xử lý tác vụ)
**Tự động:** mở cửa sổ **Nhập đơn đăng ký** (Quy trình xử lý → Xử lý tác vụ), bấm **▶ Chạy cả TB**. Tiện ích làm lần lượt:
0. **Nhận hồ sơ đang mở là của TB nào**: đọc chủ và thửa đã có sẵn trong đơn (mang từ bước tiếp nhận) rồi so với dữ liệu.
   - Đúng TB đang chọn → làm tiếp.
   - Khớp rõ một TB khác → **tự chọn TB đó** (báo “đã tự chọn TB …”).
   - Không khớp TB nào → **dừng**. Đơn có thửa thì phải trùng ít nhất một thửa mới tính (một người có thể đứng tên nhiều TB, trùng chủ thôi chưa đủ).
   - Khớp nhiều TB như nhau (vd. cùng chủ đứng tên 2 TB mà đơn chưa có thửa), hoặc cây của đơn chưa đọc được (đang tải) → **dừng**, hiện nút **“Đúng là hồ sơ của TB … – làm tiếp”** để bạn xác nhận. Nhờ vậy không điền nhầm dữ liệu TB này vào hồ sơ TB khác.
1. Chọn **Điều kiện cấp giấy**, tích **Đăng ký lần đầu**.
2. Với từng chủ: tự bấm **Thêm → Cá nhân**, điền → **dừng chờ bạn kiểm tra và tự bấm Lưu** (trang hỏi “Giấy tờ tùy thân đã tồn tại…” thì bạn tự trả lời) → thấy chủ đã vào đơn thì làm tiếp.
3. Với từng thửa: tự bấm **Thêm → Thửa đất**, điền → **chờ bạn tự bấm Lưu** → thấy thửa đã vào đơn thì sang thửa sau.
4. Đối chiếu: mọi chủ, mọi thửa đã có trong đơn.
5. **Phiếu đối chiếu số liệu**: đọc lại những gì VBDLIS đã lưu trong đơn và so từng ô với dữ liệu – chủ: họ tên, năm sinh, giới tính (Ông/Bà), số giấy tờ; thửa: diện tích, mục đích sử dụng, thời hạn. Mỗi ô có dấu: ✓ khớp, ✗ lệch, ⚠ dữ liệu thiếu (bạn tự điền), • trang không hiện để so. Có ô ✗ thì **dừng, không tô nút** – sửa trên VBDLIS (chọn mục → Sửa) rồi chạy lại; cố ý để khác thì cứ tự bấm Lưu.
   Phiếu còn bắt: ô **Năm sinh / Số CCCD để trống**, giới tính **chưa chọn** (trang ghi “Ông/Bà”), **chủ hoặc thửa bị thêm 2 lần** vào đơn, mục có trong đơn mà dữ liệu TB không có. Tên chỉ khác chỗ đặt dấu (Thủy / Thuỷ, Hòa / Hoà) coi là khớp; khác dấu thật (Cừ / Cử) là lệch.
6. Tô vàng nút **Lưu thông tin đăng ký**. Bạn tự bấm nút đó rồi **Hoàn tất** (1 lần). Khi trang báo **“Lưu đơn đăng ký thành công”**, tiện ích tự đánh dấu TB **✓ Xong**.
Chủ / thửa đã có trong đơn thì được bỏ qua (chạy lại không thêm trùng). TB có nhiều chủ (kể cả người dùng chung, vợ/chồng) thì tiện ích thêm **lần lượt tất cả** các chủ: mở Thêm → Cá nhân, điền, chờ bạn bấm Lưu rồi mới sang chủ tiếp theo. Nếu bấm Đóng thay vì Lưu, tiện ích dừng và hỏi lại trước khi mở lại mục đó.

**Từng phần (bấm tay từng mục):**
1. Mở cửa sổ **Nhập đơn đăng ký**, chọn đúng TB trong bảng điền.
2. Tab **Chủ SD** → bấm **“Điền chủ 1 (tự bấm “Thêm → Cá nhân”)”**. Tiện ích:
   - chọn **Điều kiện cấp giấy** = “Chưa đủ điều kiện cấp giấy” và tích **Đăng ký lần đầu** (đổi được ở ô đầu tab Chủ SD; chọn “(không đổi)” để tiện ích không đụng vào);
   - tự bấm **Thêm → Cá nhân** rồi điền Họ tên, Năm sinh, Giới tính, Dân tộc, Quốc tịch, Loại giấy tờ, Số giấy tờ, Nơi cấp, Địa chỉ chi tiết. **Không điền Ngày cấp, Ngày hết hạn.**
   Bạn kiểm tra rồi tự bấm **Lưu** (trang hỏi “Giấy tờ tùy thân đã tồn tại…” thì bạn tự chọn).
3. Tab **Thửa đất** → bấm **Điền** từng thửa: tiện ích tự bấm **Thêm → Thửa đất** rồi điền Số thửa, Số tờ, Diện tích (cả 3 ô), Diện tích PL, MĐSD, Nguồn gốc, Thời hạn SD 50 năm, Địa chỉ chi tiết. Bạn kiểm tra rồi tự bấm **Lưu**, rồi Điền thửa tiếp theo.
4. Chủ / thửa **đã có trong đơn** (đã hiện ở cây Chủ sử dụng / Thửa đất) thì bấm Điền lần nữa tiện ích chỉ báo “đã có trong đơn”, **không thêm trùng**.
5. Cuối cùng bạn tự bấm **Lưu thông tin đăng ký** / **Hoàn tất** (bấm một lần là đủ – thấy “Lưu đơn đăng ký thành công” là xong).

## Theo dõi tiến độ – không sót TB nào
- Danh sách TB ở ô trên cùng có dấu: **○** chưa làm, **◐** đã tiếp nhận (chưa nhập đơn), **✓** xong (đã nhập đơn). TB nào trùng thửa với TB khác có thêm **⚠ trùng thửa** (khung vàng ghi rõ trùng với TB nào – kiểm tra kẻo nhập 2 lần).
- Dòng dưới cho biết số TB xong / đã tiếp nhận / chưa làm. Nút **→ TB chưa làm** chọn TB chưa tiếp nhận tiếp theo.
- Tiện ích **tự đánh dấu** khi trang báo “Lưu hồ sơ thành công” (◐) hoặc “Lưu đơn đăng ký thành công” (✓) sau khi bạn chạy “▶ Chạy cả TB” cho TB đó – và chỉ khi **chắc đúng hồ sơ** (ô Số biên nhận đúng của TB đó / cây của đơn đúng là đơn TB đó). Không chắc thì dòng báo hiện nút **“Đánh dấu TB … đã tiếp nhận / xong”** để bạn bấm. Nó chỉ đọc thông báo, không bấm gì. Làm tay không qua “Chạy cả TB” (hoặc lúc bảng điền chưa mở) thì đổi ô **Trạng thái** bằng tay. Ô này cũng dùng để sửa khi đánh dấu sai.
- **⏸ Tạm hoãn**: TB chưa nhập được (chưa rõ chủ, trùng TB khác, chờ hỏi lại…) → ô **Trạng thái** chọn “⏸ Tạm hoãn” và ghi lý do. TB hoãn không lẫn vào “chưa làm”, nút “→ TB chưa làm” bỏ qua nó, bảng Tiến độ có bộ lọc riêng; chạy TB đó thì tiện ích nhắc lý do và hỏi “Bỏ tạm hoãn”.
- Nút **☰ Tiến độ**: số TB tiếp nhận / xong **hôm nay** và 7 ngày gần nhất; bảng tất cả TB kèm giờ tiếp nhận, giờ nhập đơn, điều cần xem (tạm hoãn, trùng thửa, lệch số liệu, ghi chú). Lọc **○ Chưa làm / ◐ Đã tiếp nhận / ✓ Xong / ⏸ Tạm hoãn / ⚠ Cần xem**. Bấm một dòng để chọn TB đó. **⧉ Sao chép bảng** rồi dán vào Excel, hoặc **⬇ Tải file Excel** (file `tien-do-vbdlis-….csv` vào thư mục Tải xuống).
- **Sao lưu tiến độ** (trong ☰ Tiến độ): **⬇ Sao lưu tiến độ** lưu file `tien-do-vbdlis-….json` (chỉ có số TB, giờ, trạng thái – không có tên, số giấy tờ). Gỡ / cài lại tiện ích, đổi máy hay xóa dữ liệu trình duyệt thì tiến độ mất → **⬆ Nạp tiến độ…** chọn file đó là có lại (gộp với tiến độ đang có). Nên sao lưu cuối mỗi ngày; bảng có ghi “Sao lưu gần nhất”.
- Tiến độ nằm trong trình duyệt của máy này, dùng chung cho mọi tab VBDLIS. Xóa TB khỏi tiện ích không xóa tiến độ của nó (nạp lại TB đó vẫn thấy dấu cũ).

## Kiểm tra nhanh rồi Enter, tiếng báo
- Khi tiện ích điền xong một cửa sổ (chủ, thửa) mà **mọi ô đều khớp dữ liệu**, dòng chờ ghi tóm tắt, vd. “đã điền: thửa 5/111 · 100.5 m² · LUC · 50 năm (10/10 ô ✓)”, và **con trỏ nằm sẵn ở nút “Lưu”** của cửa sổ (viền vàng). Bạn liếc thấy đúng thì chỉ cần **nhấn Enter**. Tiện ích vẫn **không tự bấm**; có ô chưa điền được hay dữ liệu thiếu thì không đặt con trỏ, bạn tự điền rồi bấm Lưu. Tắt ở tab **Biên nhận** → “Khi Chạy cả TB dừng chờ bạn”.
- **Tiếng báo**: mỗi khi tiện ích dừng chờ bạn (bấm Lưu, trả lời hộp hỏi của trang, xong cả TB, hoặc dừng vì lỗi) sẽ kêu “ting”, và nếu bạn đang ở cửa sổ / tab khác thì **tên tab nháy** “⏸ …” cho tới khi bạn quay lại. Nhờ vậy trong lúc VBDLIS chạy chậm bạn làm việc khác được. Tắt cũng ở chỗ trên.

## Ghi thao tác (để gửi cho người hỗ trợ chỉnh tiện ích)
Khi tiện ích điền sai/thiếu trên VBDLIS thật, ghi lại thao tác rồi gửi file:
1. Bấm nút **●** trên thanh tiêu đề bảng điền → góc dưới trái hiện “● Đang ghi thao tác”.
2. Làm việc bình thường trên VBDLIS (tự làm tay hoặc dùng nút của bảng điền). Trang tải lại giữa chừng vẫn ghi tiếp; mở thêm tab VBDLIS thì tab đó cũng ghi chung vào bản ghi này (góc dưới trái mỗi tab đều hiện “● Đang ghi”).
3. Thấy chỗ sai thì bấm **“+ Ghi chú”** (góc dưới trái) và gõ vài chữ mô tả.
4. Xong bấm **“■ Dừng & xuất file”** (hoặc bấm lại nút ●) ở **bất kỳ tab nào** → mọi tab cùng dừng, file `vbdlis-ghi-thao-tac-….json` vào thư mục **Tải xuống**. Gửi file đó.
   Cần xuất lại: bảng điền → **Dữ liệu** → **Xuất bản ghi**.

File ghi: nút bạn bấm, ô nào được nhập/chọn gì (kèm nhãn ô, tên cửa sổ), cửa sổ nào mở/đóng (kèm cấu trúc các ô), trang báo lỗi gì, và đánh dấu “(tiện ích)” cho những gì tiện ích tự điền.
Không ghi: thông báo “Bạn đã nhận được … yêu cầu xử lý hồ sơ …” (của hồ sơ khác), đồng hồ Ngày tiếp nhận tự chạy, các lần bấm lặp lại vào cùng một ô.
**Không bao giờ ghi mật khẩu** (kể cả khi trang đăng nhập / đổi mật khẩu hiện ra lúc đang ghi). Số từ 9 chữ số trở lên (CCCD, điện thoại, kể cả viết cách như “0912 345 678”) được che bớt (vd 024•••••••25); số biên nhận, ngày, diện tích giữ nguyên. File vẫn có tên, địa chỉ – chỉ gửi cho người hỗ trợ. Dữ liệu ghi chỉ nằm trong trình duyệt của bạn cho tới khi bạn xuất file.
Nếu bạn vừa tải lại / cập nhật tiện ích khi đang ghi, góc dưới trái báo “Tiện ích vừa được tải lại…” → bấm F5; phần đã ghi vẫn còn và xuất được ở **Dữ liệu → Xuất bản ghi**.

## Điền từng phần
1. Mở VBDLIS, vào màn hình tiếp nhận hồ sơ.
2. Bấm biểu tượng tiện ích (hoặc **Alt+Q**). Bảng điền hiện ở góc phải. Kéo thanh tiêu đề để di chuyển bảng.
3. Chọn TB ở ô trên cùng (dùng ‹ › để chuyển TB trước/sau).
4. Điền theo từng tab:

| Tab | Mở gì trên VBDLIS trước | Điền những ô |
|---|---|---|
| Biên nhận | Không mở cửa sổ con nào | Số biên nhận, Người nộp hồ sơ, Số giấy tờ, Địa chỉ |
| Chủ SD | Cửa sổ “Nhập đơn đăng ký” (tiện ích tự bấm “Thêm → Cá nhân”) hoặc cửa sổ “Thông tin cá nhân” | Họ tên, Năm sinh (không điền Ngày sinh, Ngày cấp, Ngày hết hạn), Giới tính, Dân tộc, Quốc tịch, Loại giấy tờ, Số giấy tờ, Nơi cấp, Địa chỉ chi tiết |
| Thửa đất | Màn hình tiếp nhận (tự bấm “+ Thêm thửa đất”), cửa sổ “Nhập đơn đăng ký” (tự bấm “Thêm → Thửa đất”) hoặc cửa sổ thửa đất đang mở | Số thửa, Số tờ, Diện tích, Địa chỉ; ở cửa sổ đầy đủ thêm MĐSD, Nguồn gốc, Thời hạn SD |
| Giấy tờ | Cửa sổ “Thông tin hồ sơ quét” | Loại giấy tờ, Mô tả, Tên giấy tờ |

5. Xem kết quả ở chân bảng. ✓ là đã điền, ✗ là chưa điền được. Ô ✗ thì bấm ⧉ cạnh giá trị để sao chép rồi dán tay. Ô vừa điền trên trang được viền xanh trong 2 giây.
6. Mục nào đã điền sẽ có dấu ✓, để biết thửa nào làm rồi. Nút “Xóa dấu ✓” xóa các dấu này.

Có thể sửa trực tiếp giá trị trong bảng trước khi bấm Điền, bảng sẽ tự lưu lại. Ô “Địa chỉ chung” rồi “Áp dụng” trong tab Thửa đất đổi địa chỉ cho mọi thửa của TB, ví dụ khi cần ghi “Tổ dân phố Thiết Nham…”.

**Thời hạn SD** tự điền “50 năm”, **Nguồn gốc đất** tự chọn “Công nhận QSDĐ như giao đất không thu tiền sử dụng đất”. Muốn khác thì sửa ở ô của từng thửa, hoặc dùng các ô chung + “Áp dụng” cho cả TB.

**Giấy tờ** mặc định có 2 loại: “Đơn đăng ký” và “Thông báo xác nhận kết quả đăng ký” (đúng 2 file quét DDK và TBXN).

Ô số (Năm sinh, Số thửa, Số tờ) và ô diện tích (“56.5 m²”) được điền **một lần** qua mặt nạ nhập / ô định dạng số của chính trang VBDLIS, nên trang nhận đúng giá trị (không còn cảnh hiện “2” rồi mới thành “22”).

**Không tự điền:** Tổ dân phố/Đường (ô chọn có tìm kiếm), Nguồn gốc. Những ô này bạn chọn tay như cũ.

## Nếu có ô không điền được – nút “Kiểm tra trang”
Mở đúng màn hình hoặc cửa sổ đó (Tiếp nhận hồ sơ, Nhập đơn đăng ký, cửa sổ thửa đất, cá nhân…) rồi bấm **Kiểm tra trang**. Tiện ích kiểm (không điền, không bấm gì) xem còn tìm thấy **đủ ô và nút** nó cần không, vd. “✓ Tìm thấy 10/10 ô, nút tiện ích cần”. Ô nào ✗ là VBDLIS vừa đổi giao diện chỗ đó – tiện ích sẽ không điền được ô ấy. Bấm **Sao chép kết quả** (kèm danh sách “nhãn → ô nhập”) và gửi cho Claude để chỉnh cho khớp với trang thật. Nên bấm thử mỗi khi thấy VBDLIS có thay đổi.

## Thêm dữ liệu TB mới
**Cách 1 – thư mục `data`:** tiện ích tự đọc file **`data/du-lieu.json`** mỗi lần mở bảng (Alt+Q): TB mới được thêm, TB bạn chưa sửa được cập nhật, TB bạn đã sửa trong bảng được giữ nguyên, TB bạn đã xóa không tự thêm lại. Khi nhờ Claude làm dữ liệu TB mới, file này luôn được cập nhật kèm theo.
**Cách 2 – file .json lẻ** (vd `tb-1896.json`): **kéo thả file vào bảng điền**, hoặc bấm **Dữ liệu → Mở file…** (chọn được nhiều file). Lưu ý: trình duyệt không cho tiện ích tự xem các file lẻ trong thư mục `data`, nên file lẻ phải kéo thả / Mở file (hoặc gộp vào `du-lieu.json`).
**Gộp file lẻ vào du-lieu.json bằng Claude:** skill **tao-du-lieu-vbdlis** (đã cài trong Claude) – nói “cập nhật du-lieu.json” (gộp mọi file `TB_xxxx.json` trong `data`) hoặc “làm json TB 1896” (đọc thư mục scan `TB 1896` rồi tạo `TB_1896.json` và gộp vào). Thư mục `data` mà thiếu `du-lieu.json` thì bảng điền báo “Thư mục data: không đọc được file data/du-lieu.json”.
**Cách 3 – dán:** bấm **Dữ liệu**, dán JSON vào, rồi bấm **Gộp vào**. Lỗi nhỏ khi gõ/sửa tay (thiếu dấu phẩy cuối dòng, dấu phẩy thừa, diện tích viết 56,5 không có ngoặc kép, ngoặc kép kiểu Word “ ”) được tự sửa; lỗi khác thì tiện ích báo đúng dòng, cột sai. TB trùng số sẽ được thay, các TB khác giữ nguyên. Đóng hộp này bằng nút **✕ Đóng** ở góc trên (hoặc phím Esc). Cách nhanh nhất là gửi thư mục scan cho Claude và nhờ “xuất JSON cho tiện ích VBDLIS”. Mẫu một TB:

```json
{
  "tb": "1817",
  "soBienNhan": "KH 2959.07777.270.90-270.119",
  "nguoiNop": { "hoTen": "THÂN VĂN BÁT", "soGiayTo": "024054005425", "diaChi": "Tổ dân phố Minh Đức, phường Việt Yên, TP Bắc Ninh" },
  "chu": [
    { "hoTen": "THÂN VĂN BÁT", "ngaySinh": "01/01/1954", "namSinh": "1954", "gioiTinh": "Nam",
      "loaiGiayTo": "Căn cước công dân", "soGiayTo": "024054005425", "ngayCap": "04/06/2023", "ngayHetHan": "",
      "noiCap": "Cục Cảnh sát Quản lý hành chính về TTXH", "diaChi": "Tổ dân phố Minh Đức, phường Việt Yên, TP Bắc Ninh" }
  ],
  "thua": [
    { "soThua": "90", "soTo": "270", "dienTich": "1712.6", "mdsd": "LUC", "diaChi": "Tổ dân phố Bình Minh, phường Việt Yên, TP Bắc Ninh" }
  ],
  "giayTo": ["Đơn đăng ký", "Căn cước công dân"],
  "ghiChu": "Ghi chú hiện ở khung vàng (không bắt buộc)"
}
```

Dữ liệu TB 1810–1817 đã có sẵn trong `data/du-lieu.json` và được nạp khi cài.

## Phóng to / thu nhỏ bảng điền
Kéo **góc dưới bên trái (◣)** hoặc **góc dưới bên phải (◢)** của bảng để đổi chiều rộng, chiều cao. Kéo thanh tiêu đề để di chuyển. Tiện ích nhớ cỡ và vị trí cho lần mở sau. Bấm đúp vào góc để về cỡ mặc định.

## Xóa dữ liệu
Bấm **Dữ liệu** → hàng **Xóa:**
- **TB đang chọn** – xóa TB đang chọn ở ô trên cùng của bảng điền (kèm các dấu ✓ của TB đó);
- **Tất cả TB** – xóa hết danh sách TB (mở lại bảng cũng không tự nạp lại dữ liệu mẫu);
- **Bản ghi thao tác** – xóa bản ghi thao tác đã ghi (đang ghi thì phải bấm ● dừng trước).

Mỗi lần xóa tiện ích đều hỏi lại. Xóa chỉ xóa dữ liệu trong tiện ích trên máy này, **không đụng gì trên VBDLIS**. Muốn có lại dữ liệu: dán JSON rồi **Gộp vào**, hoặc bấm **Nạp mẫu** rồi **Gộp vào**. Chỉ muốn bỏ các dấu ✓ thì dùng nút **Xóa dấu ✓**.

## Lưu ý
- Dữ liệu chỉ nằm trong trình duyệt của máy này, không gửi đi đâu.
- Tiện ích chỉ chạy trên tab khi bạn bấm biểu tượng hoặc Alt+Q. Nếu trang VBDLIS tải lại mà bảng biến mất, bấm biểu tượng lần nữa.
- Sau khi sửa file của tiện ích, vào trang tiện ích bấm ⟳ (Tải lại), rồi bấm F5 trang VBDLIS.
- Thư mục `test/` chỉ dùng để thử trên trang giả lập, không ảnh hưởng tiện ích.
