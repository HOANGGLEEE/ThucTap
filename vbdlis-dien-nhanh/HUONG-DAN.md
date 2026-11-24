# VBDLIS Điền Nhanh – hướng dẫn

Tiện ích cho Chrome / Edge / Cốc Cốc. Nó điền sẵn các ô trên VBDLIS từ dữ liệu TBXN.
Mặc định **tiện ích không tự bấm “Lưu hồ sơ”, “Lưu thông tin đăng ký”, “Hoàn tất”, “Chuyển tiếp”, “Thực thi”, “Trả hồ sơ”**: bạn kiểm tra lại rồi tự bấm. Muốn tiện ích làm hết thì bật nút **🤖 Tự động** (xem dưới).

## 🤖 Tự động hết (bản 1.18)
Bấm nút **🤖 Tự động: TẮT** cạnh “▶ Chạy cả TB”, đọc hộp xác nhận rồi bấm OK, nút chuyển thành **🤖 Tự động: BẬT** (màu xanh). Khi **thu nhỏ bảng** (nút –), thanh nhỏ có nút **🤖** thay cho nút ● ghi thao tác: bấm một cái là bật và chạy luôn màn hình đang mở (lần đầu vẫn hỏi xác nhận). Từ đó bạn **không cần bấm ▶**: mở màn hình là tiện ích tự chạy, làm trọn mỗi TB như bạn làm tay (ảnh 22/11):

**Bước 1 – tiếp nhận và chuyển chuyên viên**
1. **Màn hình Tiếp nhận hồ sơ trống** → tiếp nhận TB đang chọn (TB đó đã làm thì tự chọn TB chưa làm tiếp theo): tự bấm Lưu cửa sổ thửa, Đồng ý “Cập nhật địa chỉ tài sản”, **Lưu hồ sơ** → hộp “**XÁC NHẬN THÊM MỚI HỒ SƠ**” → **Đồng ý**.
2. Trang ra **màn hình hồ sơ** (nút “Xử lý hồ sơ”) → **Xử lý hồ sơ** → Quy trình chỉ có “Tiếp nhận hồ sơ”: tích **Đã xử lý** → **Chuyển tiếp** → cửa sổ “Chọn người xử lý tác vụ tiếp theo” (bước *2. Chuyên viên (Tiếp theo)*): chọn đúng **tài khoản của bạn** → **Thực thi**.

**Bước 2 – nhập đơn và chuyển lãnh đạo**
3. Về lại màn hình hồ sơ → **Xử lý hồ sơ** → Quy trình “Nhập đăng ký” + “Giấy tờ đính kèm” → **Xử lý tác vụ** của Nhập đăng ký → thêm đủ chủ, thửa (tự Lưu từng cửa sổ, tự Đồng ý “Giấy tờ tùy thân đã tồn tại”), lập phiếu đối chiếu → **Lưu thông tin đăng ký** → **Hoàn tất** → **Đóng**.
4. Tích **Đã xử lý** cả “Nhập đăng ký” và “Giấy tờ đính kèm” → **Chuyển tiếp** → bước *3. Lãnh đạo UBND xã (Tiếp theo)*: chọn đúng **tài khoản lãnh đạo** → **Thực thi**. TB vẫn là **◐ Đã tiếp nhận** (ghi thêm giờ chuyển chuyên viên, chuyển lãnh đạo).
5. Bấm **Về trang tiếp nhận hồ sơ** và làm luôn **TB chưa làm tiếp theo** (tắt được: bỏ tích “Chuyển lãnh đạo xong thì tự sang TB…”). Tiện ích chỉ đi tiếp xuống dưới danh sách, không quay lại TB phía trước.

**Bước 3 – tìm hồ sơ lãnh đạo trả về (Xử lý công việc → Danh sách hồ sơ thụ lý)**
6. Làm hết TB chưa tiếp nhận thì tiện ích tự bấm **Xử lý công việc** (thanh bên trái) → **Danh sách hồ sơ thụ lý** – kể cả khi bạn vừa **bật 🤖** ở màn hình Tiếp nhận trống (hay màn hình không có việc) mà mọi TB đã tiếp nhận: không phải bấm ▶ (bản 1.18.6). Với từng TB **◐ Đã nhập nhưng chưa xong** (bản 1.21.4 – bạn yêu cầu 23/11: **chỉ TB ◐**; TB ○ đã tiếp nhận mà chưa chuyển lãnh đạo thì không tìm – muốn làm TB đó thì chọn TB rồi bấm ▶): gõ **Số biên nhận** vào ô tìm, bấm 🔍. **Không thấy** (lãnh đạo chưa trả về) thì **đổi sang số biên nhận khác** – khoảng 5 giây sau tìm TB ◐ kế tiếp. Ra hồ sơ → **bấm vào hồ sơ** → **Xử lý hồ sơ** → làm tiếp theo Quy trình của hồ sơ. **Một lượt – làm hết** (bản 1.21.5 – bạn yêu cầu 24/11): 🤖 tìm **mỗi TB ◐ không thấy hồ sơ đúng 1 lần** theo thứ tự (TB lãnh đạo đã trả về trước), nhớ cả khi trang tải lại; TB **thấy hồ sơ** thì mở làm luôn (trang tải lại sau Thực thi bước Trả kết quả thì tìm lại ngay để Trả hồ sơ); hồ sơ cũ mở từ danh sách vừa chuyển lãnh đạo mà lượt còn TB chưa tìm thì 🤖 quay về danh sách tìm tiếp; hết lượt mới sang tiếp nhận TB mới / bắt đầu lượt sau. Dòng báo ghi còn bao nhiêu TB chưa tìm và các TB lượt này (lượt trước) đã tích ✓. **Không thấy hồ sơ** của TB mà **lãnh đạo đã trả về** → **✓ Xong** ngay (xem mục “TB lãnh đạo đã trả về mà không còn hồ sơ” ở phần Trạng thái); TB mới chuyển lãnh đạo, chưa thấy trả về → bỏ qua, giữ ◐. **Lượt kiểm TB ✓** (bản 1.21.5 – bạn yêu cầu 24/11: kiểm xem có sót hồ sơ không): tìm hết lượt TB ◐ thì 🤖 tìm số biên nhận các TB **✓ Xong** chưa kiểm lần nào – mỗi TB ✓ kiểm **1 lần** (TB mới ✓ sau này cũng kiểm 1 lần). Hồ sơ **vẫn còn** trong danh sách (sót – chưa trả thật) → TB đổi về **◐**, 🤖 mở hồ sơ làm tiếp tới Trả hồ sơ (bảng Tiến độ ghi “đã ✓ mà kiểm lại vẫn còn hồ sơ”); không còn → ghi đã kiểm; lần tìm chưa chắc → 2 giờ sau kiểm lại. Kiểm xong mới sang tiếp nhận TB mới. Lần đầu có thể lâu (mỗi TB ✓ khoảng 10 giây) – bấm **■ Dừng** nếu cần dùng máy.
7. Quy trình 5 tác vụ: tiện ích làm tác vụ 2 *Cập nhật dữ liệu pháp lý* và 3 *Lưu kho hồ sơ quét* (file từ hàng chờ), tích “Đã xử lý”. **Bạn tự làm Kết ISO** và tích “Đã xử lý” – hoặc tích ô **Tự Kết ISO** (bản 1.19.5, xem dưới) để 🤖 tự làm. Tích đủ cả 5 tác vụ → tiện ích **Chuyển tiếp** → bước *5. Trả kết quả (Tiếp theo)* → chọn **tài khoản của bạn** → **Thực thi**.
8. Tiện ích **bấm vào hồ sơ** (danh sách còn lọc sẵn đúng hồ sơ đó thì bấm luôn, không thì gõ lại số biên nhận vào ô tìm; khung “Thông tin hồ sơ” bên phải còn giữ số của hồ sơ vừa làm cũng không sao – bản 1.18.9) → **Xử lý hồ sơ** → Quy trình “Kết ISO” + “Trả hồ sơ” → **Xử lý tác vụ** của Trả hồ sơ → **Thực hiện** → **Đồng ý** (hộp “Bạn có thật sự muốn trả hồ sơ hay không?”) → trang báo thành công → TB thành **✓ Xong** (bản 1.18.5: TB đi chuỗi chuyển tiếp chỉ Xong khi đã Trả hồ sơ). Trang hiện **“Đang xử lý...”** thì tiện ích **chờ trang xử lý xong** (tới 5 phút – bản 1.21.4, trước đây chỉ chờ 60 giây nên có TB trả xong mà không thành ✓) rồi mới ghi ✓ Xong; quá 5 phút → kêu ting, dòng báo có nút **“Đã trả – ✓ Xong”** (bạn xem trên VBDLIS đã trả) và nút làm lại → **làm tiếp TB khác**: còn TB chờ thì tìm tiếp ở Danh sách hồ sơ thụ lý; tìm hết một lượt mà chưa thấy hồ sơ nào và còn TB chưa tiếp nhận thì sang **Tiếp nhận hồ sơ** làm TB đó, làm hết lại về danh sách.
- Tìm **chậm, chắc** (bản 1.18.4): gõ số biên nhận, bấm 🔍, chờ trang tải xong; chỉ khi danh sách còn **đúng 1 hồ sơ** và ô thông tin hồ sơ của dòng đó có **đúng số biên nhận vừa gõ** (đọc lại lần nữa vẫn vậy) mới bấm vào hồ sơ – bấm vào ô chữ, không bấm link số biên nhận – chờ dòng được chọn rồi mới bấm **Xử lý hồ sơ**. Trang báo “chọn hồ sơ” thì bấm lại dòng một lần. Muốn chậm hơn nữa: tab Biên nhận → Tốc độ “Chậm” / “Rất chậm”.
- Bản 1.18.6: trang tìm theo “chứa chữ” nên có thể ra thêm hồ sơ số dài hơn (vd. …237.51 và …237.51-237.50) – tiện ích chỉ bấm dòng có **đúng** số. Sau khi bấm dòng, khung **Thông tin hồ sơ** bên phải phải hiện đúng Số biên nhận đó mới bấm **Xử lý hồ sơ** (chưa đúng thì bấm lại 1 lần, vẫn sai thì dừng); Quy trình mở ra không phải của hồ sơ đó → dừng, không làm gì. Danh sách trống → coi như chưa có, khoảng 5 giây sau tìm tiếp.
- Bạn đang bấm / gõ trên trang danh sách (15 giây gần nhất; ô tìm đang có chữ **bạn** gõ → 60 giây) hoặc đang dùng bảng điền (20 giây) thì tiện ích không gõ vào ô tìm.
- Bấm **■ Dừng** lúc tiện ích **đang tìm** ở danh sách → **tạm dừng tìm** (cả khi trang tải lại) tới khi bạn bấm **▶**, bấm nút trong dòng báo, hoặc tắt / bật lại 🤖 (bản 1.18.8: dừng việc khác – tiếp nhận, chuyển tiếp… – thì **không** tạm dừng tìm; tiện ích làm xong một TB rồi tự về danh sách thì cũng tìm lại).
- Màn hình **Tiếp nhận hồ sơ** mà bạn đã gõ (người nộp, số giấy tờ, điện thoại, email, nội dung hồ sơ) thì 🤖 **không rời trang**; bạn vừa thao tác trên trang thì chờ 20 giây (bản 1.18.8).
- Tiện ích đi trang (**Xử lý công việc**, **Tiếp nhận hồ sơ**, **Về trang tiếp nhận hồ sơ**) bằng **địa chỉ của link, ngay trong tab này** (bản 1.18.7 – trên trang thật, 🤖 bấm Xử lý công việc mà trang không chuyển). Trang không chuyển trong 15 giây → dừng, kêu ting, có dòng **“Để báo lỗi…”** (thẻ, địa chỉ link) – chụp gửi người hỗ trợ; tạm thời bạn tự bấm mục đó, 🤖 làm tiếp. Tiện ích nhớ địa chỉ trang Danh sách hồ sơ thụ lý mỗi khi bạn mở trang đó (có bảng điền) để đi thẳng tới khi cần.
- TB tiện ích đã mở mà chưa có gì mới (vd. đang chờ bạn Kết ISO, hàng chờ chưa có file quét) thì không mở lại nữa; bấm **▶ Chạy cả TB** để tìm lại từ đầu.
- Ở trang danh sách, bấm **▶**: danh sách đang lọc theo số trong ô tìm (kể cả khi trang ra thêm hồ sơ số dài hơn) thì làm luôn hồ sơ **đúng số** đó; không thì tìm ngay TB đang chọn / TB kế tiếp. 🤖 đang bật mà TB đang chọn chỉ đang chờ lãnh đạo trả về (vd. TB vừa chuyển lãnh đạo) → ▶ cho 🤖 tìm lần lượt **mọi** TB chờ, không chỉ TB đó (bản 1.18.8).
- Tìm hết **một lượt** (mọi TB chờ đã tìm 1 lần, chưa thấy hồ sơ nào) mà còn TB chưa tiếp nhận → 🤖 sang **Tiếp nhận hồ sơ** làm TB đó – nhiều TB chờ bao nhiêu cũng vậy (bản 1.18.8).
- Bạn có thể tự bấm **Xử lý công việc** bất cứ lúc nào (🤖 bật) để tiện ích bắt đầu tìm.
- Đang ở bước **Mở lại hồ sơ** mà chưa bấm được, dòng đó hiện ngay lý do đang chờ (cửa sổ chưa đóng, chưa thấy dòng đúng số…); hết 45 giây thì kêu ting, ghi ✗ kèm lý do – bạn bấm vào hồ sơ rồi **Xử lý hồ sơ**, 🤖 làm tiếp Trả hồ sơ. Chụp dòng “Để báo lỗi…” gửi người hỗ trợ.
- Tiện ích nhận ra trang danh sách nhờ: ô tìm có chữ mờ chứa “số biên nhận”, nút **Xử lý hồ sơ** (hoặc cột “Thông tin hồ sơ”), không có nhãn “Người nộp hồ sơ”. Không nhận ra → bảng điền có dòng **“Để báo lỗi…”** (ô nhập, cột, nút, số dòng hồ sơ thấy trên trang) – chụp dòng đó gửi người hỗ trợ.

**Cài đặt** (tab **Biên nhận** → mục “🤖 Tự động hết – chuyển tiếp”):
- **Tài khoản**: ô *Chuyên viên* (tài khoản của bạn – dùng cho bước 2 và bước Trả kết quả) và ô *Lãnh đạo*. Trên máy này đã đặt sẵn từ file `cau-hinh.local.json` (file này không lên git). Tiện ích chỉ chọn dòng có **Tên tài khoản đúng y** như ô đó, và chỉ bấm Thực thi khi **chỉ dòng đó** có dấu chọn (✓ ở cột STT). Không thấy, thấy 2 dòng, bước nhận không đúng, không chắc đã chọn, hoặc bạn vừa bấm / gõ trên trang (2 giây) → **dừng, không bấm Thực thi**. Bạn tự bấm **Chuyển tiếp** để mở cửa sổ thì không sao – tiện ích vẫn bấm Thực thi; chỉ khi bạn vừa tự bấm **Thực thi** ở đúng bước đó (trong 1 phút) thì tiện ích không bấm thêm (tránh chuyển 2 lần).
- **Tốc độ**: Nhanh / Bình thường / Chậm / Rất chậm. Mạng hay VBDLIS chậm thì chọn Chậm; muốn nhìn từng bước thì chọn Rất chậm.
- **Chạy thử**: tiện ích làm hết, chọn sẵn đúng người, rồi **dừng ở Thực thi / Trả hồ sơ** cho bạn tự bấm. Bạn bấm Thực thi (Thực hiện) xong là tiện ích **tự làm tiếp**. Nên bật cho 1–2 hồ sơ đầu trên VBDLIS thật, thấy đúng rồi tắt.

**An toàn**
- Mỗi bước chỉ bấm **Thực thi một lần**. Đã bấm mà chưa thấy báo thành công (trang tải lại…) thì lần sau tiện ích **không bấm lại**: nó mở Quy trình xem hồ sơ đã sang bước mới chưa; vẫn ở bước cũ thì dừng và hiện nút **“Chưa chuyển – làm lại”** để bạn quyết.
- Chuyển lãnh đạo mà không thấy câu báo thành công: tiện ích mở lại **Xử lý hồ sơ** để xem. Trang báo rõ hồ sơ không còn của bạn → ghi đã chuyển, sang TB sau. Chưa rõ → dừng, hiện 2 nút **“Đã chuyển lãnh đạo – sang TB sau”** và **“Chưa chuyển – làm lại”**.
- Cửa sổ chọn người: tiện ích chỉ tính dấu ✓ **đang hiện** ở cột STT (dấu ẩn không tính). Vẫn dừng ở bước này thì trong bảng điền có dòng “Để báo lỗi…” – chụp gửi người hỗ trợ.
- Đã bấm Lưu hồ sơ / Hoàn tất mà chưa thấy báo thành công (trang tải lại…) → không tự tiếp nhận / hoàn tất lần nữa, hiện nút cho bạn xác nhận.
- **Trang tải lại** (sau Lưu hồ sơ, Thực thi…): bảng điền tự mở lại và làm tiếp, chỉ khi đang bật Tự động hết và bạn không ẩn bảng (×). Sau Thực thi bước Trả kết quả, trang về Danh sách hồ sơ thụ lý: tiện ích tự bấm lại dòng hồ sơ rồi Trả hồ sơ. Làm xong bước 3 của hồ sơ cũ, **TB đang chọn trong bảng trở về như trước** (không làm lệch “TB chưa làm tiếp theo”).
- Trả hồ sơ: tiện ích chỉ **Đồng ý một** hộp hỏi “Bạn có thật sự / chắc chắn muốn trả hồ sơ…”. Hộp khác / hộp báo lỗi → dừng chờ bạn.
- **Bấm Thực hiện (Trả hồ sơ) là TB thành ✓ Xong** (bản 1.19.3): tiện ích bấm Thực hiện → Đồng ý, cửa sổ đóng mà trang không báo lỗi → ✓ Xong. **Bạn tự bấm** Thực hiện → Đồng ý (kể cả khi 🤖 tắt) → trang báo thành công / cửa sổ đóng không lỗi → TB của hồ sơ đang chọn cũng ✓ Xong. Bạn bấm Không / Đóng / nút ×, nhấn Esc, bấm ra nền ngoài cửa sổ, hoặc trang báo lỗi (câu báo nổi hay hộp báo) → không đánh dấu (bản 1.19.4). Trang báo thành công bằng hộp (không có câu báo nổi) → vẫn ✓ Xong.
- Tiện ích không nhận ra cửa sổ Trả hồ sơ (trang đổi kiểu cửa sổ) → dừng, kêu ting, có dòng “Để báo lỗi…” – bạn tự bấm Thực hiện → Đồng ý (TB vẫn ✓ Xong), chụp dòng đó gửi người hỗ trợ.
- 🤖 chờ bạn **ngừng bấm / gõ trên trang 3 giây** rồi mới tự chạy (bản 1.18.6) – vd. bạn vừa Kết ISO xong thì 3 giây sau tiện ích mới chuyển tiếp, không còn dừng vì “bạn vừa bấm”.
- Trang tải lại giữa lúc 🤖 đang làm một TB mở từ Danh sách hồ sơ thụ lý (không phải TB đang chọn): bảng điền mới vẫn làm tiếp TB đó (30 phút), TB đang chọn không đổi.
- **Dừng, kêu ting chờ bạn** (kêu được cả khi trang vừa tải lại; dấu **!** đỏ trên biểu tượng tiện ích còn tới khi bạn bấm / gõ) khi: phiếu đối chiếu có ô lệch (✗), Số biên nhận trên trang không khớp đúng một TB, không thấy đúng người, trang hiện hộp hỏi lạ, hoặc trang báo lỗi. Dữ liệu TB thiếu ô (⚠) thì vẫn lưu đơn, ghi nhắc để bạn xem lại. Bạn sửa xong thì bấm “▶ Chạy cả TB” – tiện ích làm tiếp từ bước đang dở.
- **Dừng là giữ TB đó**: lần chạy dừng (lỗi, hỏi bạn, bạn bấm Dừng) thì 🤖 **không tự chạy lại TB đó ở màn hình nào**, kể cả sau khi trang tải lại. Thanh trạng thái ghi “🤖 Tự động hết đang chờ bạn ở TB …”. Bạn xem xong bấm **▶ Chạy cả TB** (hoặc nút trong dòng báo, hoặc tắt / bật lại 🤖) là chạy tiếp.
- Cửa sổ **Nhập đơn đăng ký** chỉ tự chạy khi đơn đó của **TB đang chọn**. Đơn của TB khác → bấm ▶.
- **Kết ISO: mặc định không bấm.** Muốn 🤖 tự Kết ISO: tab **Biên nhận** → mục *🤖 Tự động hết – chuyển tiếp hồ sơ* → tích ô **Tự Kết ISO** (bản 1.19.5; bỏ tích là về như cũ). Bật thì: Quy trình 5 tác vụ chỉ còn thiếu Kết ISO (hoặc Quy trình “Kết ISO” + “Trả hồ sơ” mà Kết ISO chưa tích) → 🤖 bấm **Xử lý tác vụ** của Kết ISO → **Thực hiện** → **Đồng ý** (chỉ hộp hỏi kết ISO) → chờ trang báo thành công / cửa sổ đóng không lỗi → tích “Đã xử lý” (trang chưa tự tích thì tiện ích tích) → Chuyển tiếp *5. Trả kết quả* → Trả hồ sơ → ✓ Xong.
  - Còn tác vụ khác chưa tích (vd. Lưu kho hồ sơ quét chờ file) → không Kết ISO. Trang báo lỗi / hộp hỏi lạ / không nhận ra cửa sổ Kết ISO → dừng, kêu ting, có dòng “Để báo lỗi…” (chụp gửi người hỗ trợ). Đã bấm Thực hiện mà trang tải lại trước khi thấy tích → không bấm lại, nhờ bạn kiểm tra trên VBDLIS. **Chạy thử** bật → chỉ tô vàng nút Xử lý tác vụ của Kết ISO cho bạn bấm.
- 🤖 **chỉ chạy ở tab bạn bật**. Tab VBDLIS khác hiện “🤖 Tự động: ở tab khác” và không tự bấm gì; muốn chạy ở tab đó thì bấm nút đó. Tắt 🤖 / đổi tài khoản, tốc độ… ở tab nào thì các tab khác nhận ngay.
- Bấm lại nút để **TẮT**. Khi tắt, tiện ích quay về cách cũ: tô vàng các nút cho bạn tự bấm (ở cửa sổ chọn người, bấm ▶ thì tiện ích chọn sẵn đúng người, bạn tự bấm Thực thi). Bật 🤖 không còn sửa 3 ô “tự động” của bạn (chủ / hồ sơ quét / Quy trình) – khi bật thì coi như bật, tắt thì theo lựa chọn cũ.
- Cửa sổ chọn người đang **mở sẵn** lúc bạn bấm ▶: tiện ích chỉ chọn đúng người và tô vàng Thực thi, **không tự bấm**.
- Bản 1.21: tiện ích nhận dòng đã chọn theo dấu của trang thật (dòng chọn có lớp `selectUser`, nền xanh – ô STT vẫn là số). Trước đây có lúc trang đã chọn đúng người mà tiện ích báo “không thấy dấu chọn rõ ràng” và không bấm Thực thi. Nếu vẫn gặp, chụp dòng **“Để báo lỗi…”** ngay dưới (có lớp của dòng và mã ô STT) gửi người hỗ trợ.

## 👔 Vai trò Lãnh đạo – ký duyệt, chuyển bước 4 (bản 1.21)
Dùng ở máy (hoặc Chrome) **đăng nhập tài khoản lãnh đạo UBND xã** – giống vai trò Lãnh đạo của tiện ích bản 0.9.3. Không cần dữ liệu TB.
1. Ở đầu bảng điền, ô **Vai trò** chọn **Lãnh đạo (ký duyệt → chuyển bước 4)**. Bảng ẩn các dòng TB và hiện bảng **👔 Lãnh đạo**.
2. Kiểm tra cài đặt:
   - **Người nhận bước 4**: để trống = tài khoản ở ô **Chuyên viên** (tab Biên nhận) – bạn chọn 23/11. Muốn chuyển cho tài khoản khác thì điền vào đây.
   - **Bước nhận phải có**: mặc định “Chuyên viên hoàn tất” (cửa sổ chọn người phải là bước “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)”).
   - Ô **Lãnh đạo** ở tab Biên nhận: điền tài khoản lãnh đạo – tiện ích **dừng hẳn** (⛔) nếu thấy đang đăng nhập tài khoản khác.
   - **Chạy liên tục** (mặc định bật): hết hồ sơ thì 🤖 tải lại danh sách sau N giây (mặc định 60, ít nhất 15) để nhận hồ sơ chuyên viên mới chuyển lên.
3. Mở **Xử lý công việc** (Danh sách hồ sơ thụ lý), bấm **Quét danh sách** để xem các hồ sơ đang chờ ký duyệt (chỉ đọc, không bấm gì trên trang).
4. Bật **🤖** (lần đầu đọc hộp xác nhận rồi bấm OK). Với **mỗi hồ sơ KH 2959… đang ở bước “… Lãnh đạo …”**, tiện ích:
   bấm vào hồ sơ → **Xử lý hồ sơ** → Quy trình chỉ có “Ký duyệt hồ sơ” → tích **Đã xử lý** → **Chuyển tiếp** → bước “4. Chuyên viên hoàn tất hồ sơ (Tiếp theo)”
   → chọn **đúng tài khoản** nhận bước 4 (tài khoản giống tên khác không chọn) → **Thực thi** → kiểm tra hồ sơ đã rời bước lãnh đạo (không rõ thì tìm đúng số biên nhận) → hồ sơ tiếp theo.
   Ký duyệt = chỉ tích ô “Đã xử lý” của “Ký duyệt hồ sơ” (không ký số – bạn xác nhận 23/11). Hồ sơ ở trang sau của danh sách: 🤖 tự sang trang sau.
5. **Hồ sơ lỗi** (không thấy tài khoản nhận, trang báo lạ…): kêu ting, ghi lỗi trong bảng Lãnh đạo, 20 giây sau (bạn không thao tác) 🤖 quay về danh sách **làm hồ sơ khác**, thử lại hồ sơ lỗi sau N giây – **tối đa 3 lần** rồi bỏ qua (⊘). Đã bấm Thực thi mà trang báo lỗi / không rõ đã chuyển chưa → **không tự làm lại** hồ sơ đó: bạn kiểm tra trên VBDLIS, chưa chuyển thì bấm nút **“Chưa chuyển – làm lại hồ sơ …”**. Nút **Xóa dấu lỗi** cho 🤖 thử lại mọi hồ sơ lỗi / bỏ qua.
6. **🤖 tắt**: ▶ chỉ mở hồ sơ đầu tiên đang chờ và **tô vàng** ô Đã xử lý + Chuyển tiếp – bạn tự tích, tự bấm; ở cửa sổ chọn người bấm ▶ thì tiện ích **chọn sẵn đúng người**, tô vàng Thực thi để bạn tự bấm (bạn bấm xong, trang báo thành công → bảng ghi “✓ đã chuyển bước 4”). Ô **Chạy thử** (tab Biên nhận) bật: 🤖 dừng ở Thực thi cho bạn bấm.
7. Bảng Lãnh đạo ghi từng hồ sơ: ○ chờ ký duyệt · ⏳ đã bấm Thực thi – chờ xác nhận · ⏸ chờ bạn bấm Thực thi (Chạy thử / cửa sổ bạn mở – 🤖 không mở lại hồ sơ đó, bấm ▶ để làm lại) · ✓ đã chuyển bước 4 (giờ) · ✗ lỗi n/3 · ⊘ bỏ qua; dòng trên cùng đếm số đã chuyển hôm nay. Máy này có dữ liệu TB của hồ sơ đó thì TB được ghi giờ “LĐ ký duyệt” (◐ Đã nhập nhưng chưa xong).
8. Bấm **■ Dừng** lúc 🤖 đang làm: 🤖 **tạm dừng hẳn** (kể cả khi cửa sổ Quy trình / chọn người còn mở – không tự tích, chuyển tiếp, Thực thi nữa) tới khi bạn bấm **▶** hoặc tắt / bật lại 🤖.
9. Đổi **Vai trò** về **Chuyên viên** là quay lại làm như trước (tiếp nhận, nhập đơn, chuyển lãnh đạo, trả hồ sơ). Đổi vai trò lúc 🤖 đang bật thì 🤖 **tự tắt** – bấm 🤖 bật lại (tiện ích hỏi xác nhận đúng vai trò mới).

## Tab “Trường” – lấy tất cả các trường, tích trường cần điền (bản 1.20)
1. Mở màn hình / cửa sổ / **hộp hỏi** cần điền trên VBDLIS (cửa sổ chủ, cửa sổ thửa, Nhập đơn đăng ký, chọn người, Trả hồ sơ, màn hình Tiếp nhận…).
2. Vào tab **Trường** → bấm **Lấy tất cả các trường trên màn hình đang mở**. Tiện ích liệt kê mọi ô kèm giá trị đang có: ô gõ chữ, ô chọn, **ô tích**, **nhóm ô tròn** (vd. “Cấp: Tất cả / Tỉnh/Tp / … / Cùng đơn vị” – một dòng, chọn một lựa chọn), ô **chỉ có chữ mờ** (vd. “Nhập tên cán bộ, tên user…”), ô trong bảng (vd. “Đã xử lý – Kết ISO”), ô không có nhãn (gọi theo vị trí, vd. “(ô chọn không nhãn thứ 1)”). Tên ô là nhãn của chính ô đó – không lấy tiêu đề cửa sổ, chữ trên nút, số hồ sơ. Chỉ lấy được ô đang hiện (tab đang mở).
3. **Tích ô cần điền**. Mỗi ô lấy từ:
   - **Dữ liệu TB**: ô tiện ích vốn biết (Họ tên, Giới tính, Số giấy tờ, Diện tích…) – điền theo TB của từng hồ sơ, đúng quy tắc như khi chạy (tên theo thẻ CCCD, đất ở ODT…). Tiện ích tự tích sẵn các ô này.
   - **Giá trị mẫu**: chữ cố định, **giống nhau mọi hồ sơ** (lấy sẵn giá trị đang có trên trang, sửa được). Để trống = không điền ô đó (như bỏ tích: ô bắt buộc để trống mà trên trang trống / khác dữ liệu TB thì 🤖 không tự Lưu – bản 1.21).
4. **Tích / sửa là tự lưu ngay** (nút **Lưu mẫu** chỉ để đóng bảng tích). Lần sau **không phải tích lại**. Lấy lại trường lần nữa thì **tích cũ vẫn giữ**; ô lần đó không thấy (ở tab khác, đang ẩn…) vẫn giữ, ghi “không thấy lần lấy này”, có nút ✕ để bỏ.
   - **Mỗi cửa sổ một mẫu**: “Thêm thửa đất” (Tiếp nhận) và “Thông tin thửa đất” (đơn) là hai mẫu riêng. Tên cửa sổ có số hồ sơ → mẫu bỏ số đó, **dùng lại cho mọi hồ sơ**.
   - **Tích hết**: chỉ tích ô lấy từ dữ liệu TB và ô bạn đã đặt giá trị mẫu; ô giá trị mẫu khác (giá trị đọc lúc lấy trường) bạn tự tích – tiện ích liệt kê các ô đó.
   - **Sửa** / **Xóa** mẫu ở danh sách. Xóa mẫu thì tiện ích điền như cũ (mọi ô có dữ liệu).
   - **Đã có mẫu thì tiện ích CHỈ điền ô đã tích** (“chỉ nhập chỗ ý” – bạn yêu cầu 23/11): ô bỏ tích **và ô không có trong mẫu** đều không điền (nhật ký ghi “không có trong mẫu”); cửa sổ chưa có mẫu thì điền như cũ. Ô bắt buộc mà tiện ích không điền (cửa sổ chủ / thửa: Họ tên, Số giấy tờ, Số thửa, Diện tích…; màn hình Tiếp nhận: Phường/Xã, Quy trình/Thủ tục, Số biên nhận, Người nộp hồ sơ): tiện ích không điền, nhưng trước khi **tự bấm Lưu / Lưu hồ sơ** nó đọc lại ô đó – **trống hoặc khác dữ liệu TB → dừng, kêu ting** chờ bạn điền.
5. **Nút**: bảng thứ hai liệt kê **mọi nút** – cả nút chỉ có ký hiệu (×, 🔍, +, ➜), đường link, nút “Xử lý tác vụ” của từng tác vụ (vd. “Xử lý tác vụ – Kết ISO”). **Nút nào cũng tích được.** Ô số bên cạnh là **thứ tự bấm** (tích là tự đánh số tiếp, sửa được). Tiện ích điền các ô đã tích rồi **bấm lần lượt các nút đã tích**:
   - chỉ bấm khi thấy đúng một nút đó, đúng cửa sổ của mẫu; nút đang mờ thì dừng; có ô chưa điền được thì **không bấm nút nào**;
   - trang hỏi giữa chừng → 🤖 bật thì trả lời hộp đã biết / đã dạy, không thì dừng chờ bạn; **sau nút cuối trang còn hỏi** → báo ✗ (🤖: kêu ting);
   - nút là đường link sang trang khác: bấm là trang chuyển, các nút sau không bấm nữa;
   - bấm theo mẫu thì tiện ích **không kiểm tra thêm** (vd. Thực thi theo mẫu không kiểm người nhận) – bạn tự chọn đúng trước.
6. **Khi nào mẫu được dùng**
   - Bấm **Điền** ở danh sách mẫu (mọi lúc; mẫu chủ / thửa / giấy tờ: chọn số ở ô bên cạnh). Hồ sơ đang mở là của TB khác TB đang chọn → không điền.
   - **🤖 Tự động hết**, cửa sổ / hộp hỏi tiện ích **không tự làm** → tự điền + bấm theo mẫu **mỗi lần cửa sổ mở một lần** (đóng rồi mở lại là lần mới; cửa sổ con đóng không làm mẫu chạy lại). Bảng tích của mẫu đó đang mở → 🤖 chờ bạn đóng bảng tích.
   - **🤖**, cửa sổ tiện ích **tự làm** (chủ, thửa, Nhập đơn đăng ký, chọn người, Trả hồ sơ, Kết ISO khi bật “Tự Kết ISO”, Thông tin hồ sơ quét, Hồ sơ quét): 🤖 làm như cũ, đủ kiểm tra; **trước nút chốt** (Lưu / Lưu thông tin đăng ký / Thực thi / Thực hiện / Cập nhật) điền thêm ô giá trị mẫu và bấm thêm nút bạn đã tích, theo thứ tự bạn đặt. Nút trùng nút chốt chỉ bấm một lần (🤖 tự bấm); nút Đóng / × không bấm. **Quy trình xử lý**: 🤖 làm theo bước riêng (mẫu chỉ dùng khi bấm Điền).
   - **🤖**, **màn hình chính** tiện ích không tự làm (không phải Tiếp nhận, màn hình hồ sơ, Danh sách hồ sơ thụ lý): tự chạy mẫu **một lần mỗi lần vào** màn hình đó.
   - Mẫu có nút vừa tự chạy mà cửa sổ lại mở ngay (không do bạn) → 🤖 không chạy lại lần mở đó (chống lặp – cả khi trang tự tải lại, bản 1.21), kêu ting báo bạn. Bạn bấm **Điền** bằng tay cũng tính là mẫu đã chạy ở lần mở / lần vào đó (bật 🤖 sau đó không chạy lại).
   - Cửa sổ chuỗi (chủ, thửa, đơn, chọn người, Trả hồ sơ, Kết ISO, hồ sơ quét): 🤖 làm phần đã tích **sau** các kiểm tra của chuỗi (đúng bước, đúng hồ sơ, người bạn đang chọn…) và **trước** nút chốt; nút Đóng / Hủy / × không bấm; bấm nút theo mẫu xong mà trang hiện hộp hỏi, hay cửa sổ đổi / đóng → dừng trước nút chốt (không ghi “bỏ qua” thửa). Chuỗi dừng mà cửa sổ còn mở → mẫu không tự chạy lại trên cùng lần mở (bản 1.21).
   - **▶ Chạy cả TB**: màn hình Tiếp nhận, cửa sổ chủ / thửa / đơn điền theo tích của mẫu.
7. **Dạy 🤖 trả lời hộp hỏi lạ**: lúc hộp đang hiện, bấm **Lấy tất cả các trường…** (lấy được cả hộp chỉ có nút), tích nút trả lời (vd. “Đồng ý” / “Không”). Từ đó 🤖 bật mà **đúng câu hỏi đó** hiện ra (cùng tiêu đề + câu hỏi; số hồ sơ khác nhau vẫn nhận) thì 🤖 tự bấm nút đó – ở mọi bước. Hộp báo lỗi (vui lòng…, không thể…, có lỗi…) thì không bao giờ tự trả lời.
   - Hộp báo tiện ích cần ĐỌC (sau “Xử lý hồ sơ”, hộp báo thành công của Trả hồ sơ / Kết ISO, hộp “số biên nhận đã dùng cho hồ sơ khác”) thì tiện ích đọc trước, **không** bấm theo hộp đã dạy (bản 1.21 – tránh ghi nhầm ✓ Xong).
- Ngày sinh, Ngày cấp, Ngày hết hạn không tích được, không bao giờ điền (quy tắc).
8. **Cấu hình cho nơi khác** (mỗi nơi làm một kiểu): cuối tab Trường bấm **⬇ Xuất cấu hình** → file `cau-hinh-truong-vbdlis-….json` (mọi mẫu: cửa sổ, ô đã tích, lấy từ đâu, giá trị mẫu bạn đặt, thứ tự nút – không có dữ liệu hồ sơ, tên tài khoản). Nơi khác bấm **⬆ Nạp cấu hình…**, chọn file đó: tiện ích cho xem mẫu nào **thêm mới**, mẫu nào **máy đã có**; bấm “Thêm … mẫu mới, giữ mẫu đang có” hoặc “… thay … mẫu đang có” (thay thì mất tích / giá trị của mẫu đang có), hoặc Hủy.
- **Sao lưu tiến độ** (hộp Tiến độ) kèm các mẫu tab Trường (tích, thứ tự nút, giá trị mẫu bạn đặt – giá trị có thể là dữ liệu cá nhân thì không đưa vào file). Bản 1.21: file sao lưu / file cấu hình giữ đủ dấu “không thấy lần lấy này”, ô khóa, nút là đường link; **bỏ** mẫu hộp hỏi / nút có tên người trong dữ liệu TB, tên tài khoản (bgi.…, tài khoản trong cài đặt) hoặc dãy số dài (báo số mẫu bị bỏ) – vẫn nên mở file xem trước khi gửi nơi khác. Nạp lại chỉ **thêm** mẫu máy này chưa có, mẫu đang có giữ nguyên.

## Chọn thư mục file quét (TB 18xx)
Bấm **Chọn thư mục…** ở tab Giấy tờ, hoặc kéo cả thư mục (vd. `18 TH`) thả vào bảng. Trong thư mục có các thư mục **TB 1846**, **TB 1847**…, mỗi thư mục chứa PDF của TB đó.
- File **DDK** vào dòng *Đơn đăng ký*, file **TBXN** vào dòng *Thông báo xác nhận kết quả đăng ký*.
- Số biên nhận trong tên file **phải khớp** số biên nhận của TB có số trên tên thư mục. Không khớp thì tiện ích **bỏ file đó** và ghi rõ lý do.
- Tên file không có số biên nhận (vd. `TB 1847/TBXN.pdf`) thì lấy số biên nhận của TB 1847 trong dữ liệu.
- File không có chữ DDK / TBXN trong tên thì bỏ qua. Thư mục TB thiếu DDK hoặc TBXN thì có dòng ⚠ nhắc.
- File cùng tên ở các thư mục TB khác nhau (vd. `TB 1846/DDK.pdf`, `TB 1847/DDK.pdf`) là 2 file khác nhau – không đè nhau.

## Cài đặt (một lần)
1. Mở trình duyệt, gõ vào thanh địa chỉ: `chrome://extensions` (Edge: `edge://extensions`, Cốc Cốc: `coccoc://extensions`).
2. Bật **Chế độ dành cho nhà phát triển** (Developer mode), ở góc trên bên phải.
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) rồi chọn thư mục `vbdlis-dien-nhanh` này.
4. Bấm biểu tượng 🧩 rồi ghim “VBDLIS Điền Nhanh” lên thanh công cụ.

## Cách nhanh nhất: nút “▶ Chạy cả TB”
Nút này tự biết bạn đang ở bước nào:
- đang ở màn hình **Tiếp nhận hồ sơ** (không mở cửa sổ con) → làm bước tiếp nhận (dưới đây);
- đang mở cửa sổ **Nhập đơn đăng ký** → làm bước đơn đăng ký (xem mục “Bước Nhập đơn đăng ký”);
- **TB đang chọn đã tiếp nhận mà chưa xong** (bản 1.18.2) → **không tiếp nhận lại**: tiện ích bấm **Xử lý công việc** (thanh bên trái) → Danh sách hồ sơ thụ lý → gõ **Số biên nhận** của TB đó vào ô tìm, bấm 🔍. **Không thấy** → **đổi số biên nhận khác** (bản 1.21.4 – bạn yêu cầu 23/11): tìm lần lượt các TB **◐ Đã nhập nhưng chưa xong** khác, ra hồ sơ của TB nào thì làm TB đó (TB đổi sang mà có 2 hồ sơ trùng số thì bỏ qua TB đó – tạm giữ, ghi trong bảng – tìm số khác); tìm hết một lượt chưa thấy hồ sơ nào → 5 giây sau tìm lại từ TB bạn chọn (tối đa 30 phút, bấm **■ Dừng** để thôi). Ra hồ sơ → **bấm vào hồ sơ** → **Xử lý hồ sơ** → làm tiếp theo Quy trình (tác vụ 2–3, chờ bạn Kết ISO…). Trang tải lại khi bấm Xử lý công việc thì bảng điền tự mở lại và tìm tiếp (kể cả khi 🤖 tắt). Đang ở Danh sách hồ sơ thụ lý thì bấm ▶ là tìm ngay TB đang chọn. Muốn tiếp nhận lại TB đó thật (hiếm): đổi ô **Trạng thái** của TB về “Chưa xong”, chọn **xóa hết dấu** khi tiện ích hỏi, rồi bấm ▶. Màn hình Tiếp nhận đang có dữ liệu chưa lưu, hoặc thanh trái không có mục Xử lý công việc → tiện ích không rời trang, hiện nút **“Vẫn tiếp nhận TB …”**.

Mở màn hình **Tiếp nhận hồ sơ** mới, bấm Alt+Q, chọn TB, bấm **▶ Chạy cả TB**. Tiện ích làm lần lượt:
1. Chọn Phường/Xã “Phường Việt Yên (Phường Bích Động - Thị xã Việt Yên cũ)”.
2. Chọn quy trình “XA_KH2959…”.
3. Điền Số biên nhận.
4. Thửa đầu tiên: tự bấm “+ Thêm thửa đất”, điền Số thứ tự thửa, Số hiệu tờ bản đồ, Diện tích, Địa chỉ → **dừng chờ bạn kiểm tra và tự bấm “Lưu”**. Trang hỏi “Cập nhật địa chỉ tài sản” thì **bạn bấm “Đồng ý”** – tiện ích chờ bạn trả lời rồi mới làm tiếp.
   Mặc định chỉ thêm **thửa đầu** (đủ để lưu hồ sơ; các thửa nhập đầy đủ ở bước Nhập đơn đăng ký). Muốn thêm tất cả các thửa ở bước này: tab Biên nhận → ô “Chạy cả TB thêm thửa nào…” → “Tất cả các thửa của TB”.
5. Điền Người nộp hồ sơ, Số giấy tờ, Địa chỉ (theo mục 1c của TBXN), Địa chỉ tài sản.
6. Đối chiếu bảng thửa trên trang với dữ liệu (thiếu / thừa / trùng / sai diện tích).
7. Tô vàng nút **“Lưu hồ sơ”** – bạn kiểm tra toàn bộ rồi tự bấm. Khi trang báo **“Lưu hồ sơ thành công”**, tiện ích tự ghi nhận TB đó **đã tiếp nhận** (trạng thái vẫn **○ Chưa xong** tới khi chuyển lãnh đạo) và gợi ý TB chưa làm tiếp theo (bấm **Chọn**).

Ở màn hình tiếp nhận tiện ích **không bấm nút Lưu nào**. Bấm “■ Dừng” để thôi giữa chừng; bấm “▶ Chạy cả TB” lại thì bước nào/thửa nào đã xong sẽ được bỏ qua. Phường/Xã và quy trình có thể đổi trong tab Biên nhận.

**Tiện ích tự dừng (không ghi gì lên trang) khi:**
- dữ liệu TB thiếu (Số biên nhận, người nộp, thửa…) hoặc diện tích viết không rõ;
- trang đang còn hồ sơ khác (bảng thửa có thửa không thuộc TB này, hoặc Số biên nhận / Người nộp đang là của TB khác) → mở màn hình Tiếp nhận hồ sơ mới;
- đang mở một cửa sổ khác (vd. Thông tin cá nhân) hoặc một hộp hỏi của trang → đóng / trả lời nó trước;
- cuối cùng bảng thửa trên trang **không khớp** dữ liệu (thiếu / thừa / trùng / sai diện tích) → **không** tô nút Lưu hồ sơ, sửa trên trang trước;
- TB này **đã tiếp nhận rồi** → tiện ích báo rõ và chỉ làm khi bạn bấm nút **“Vẫn tiếp nhận TB …”** hiện ngay dưới dòng báo (tránh tạo hồ sơ trùng; bấm đúp nút Chạy không lọt qua được). Đánh dấu nhầm thì đổi ô **Trạng thái** về “Chưa làm”. (Thửa trùng thì **không** dừng – xem mục “Thửa trùng – tự bỏ qua”);
- TB đang **⏸ Tạm hoãn** → dừng, có nút **“Bỏ tạm hoãn, chạy TB …”**;
- TB có **ghi chú** (tên TBXN khác CCCD, thửa thiếu mục đích, trùng thửa với TB khác…) → **không dừng**: tiện ích chỉ hiện một dòng “⚠ Ghi chú: …” trong nhật ký rồi chạy tiếp (ghi chú vẫn hiện ở khung vàng đầu bảng).

Nếu bấm Hủy bỏ ở một thửa rồi chạy lại, tiện ích sẽ hỏi lại một lần (bấm “▶ Chạy cả TB” thêm lần nữa) trước khi mở lại thửa đó – để tránh nhập trùng.

**Diện tích:** PDF ghi “56,5” thì VBDLIS nhập “56.5”. Gõ/dán “56,5” hay “1.712,6” vào bảng điền sẽ tự đổi thành 56.5 / 1712.6; giá trị không rõ (vd “1.225”) sẽ bị báo ✗ để bạn sửa.

## Bước Nhập đơn đăng ký (Xử lý hồ sơ → Xử lý tác vụ)
**Tự động:** mở cửa sổ **Nhập đơn đăng ký** (Quy trình xử lý → Xử lý tác vụ), bấm **▶ Chạy cả TB**. Tiện ích làm lần lượt:
0. **Nhận hồ sơ đang mở là của TB nào** – không dừng hỏi nữa (theo ý bạn):
   - Đọc ô **Mã đơn** (VBDLIS điền sẵn số biên nhận, vd. KH 2959.07777.255.47-245.142…): đúng TB đang chọn → chạy luôn; là của TB khác → **tự chọn TB đó** (báo “đã tự chọn TB …”); khác một chút nhưng chung thửa → vẫn chạy, ghi ⚠ để bạn xem lại.
   - Ô Mã đơn trống thì xem chủ / thửa đã có trên cây của đơn; cây trống (đơn mới mở thường “Không có dữ liệu”) hay khớp nhiều TB thì **làm theo TB đang chọn**.
   - Chỉ dừng khi chắc chắn mở **nhầm hồ sơ**: Mã đơn không chung thửa nào với TB nào trong dữ liệu, hoặc cây của đơn có thửa của TB khác. Chắc chắn đúng thì bấm nút “Đúng là hồ sơ của TB … – làm tiếp”.
1. Chọn **Điều kiện cấp giấy**, tích **Đăng ký lần đầu**.
2. Với từng chủ (**nhập chủ tự động**): tự bấm **Thêm → Cá nhân**, điền; **mọi ô khớp dữ liệu và chắc chắn đúng hồ sơ** (Mã đơn khớp hẳn số biên nhận của TB, hoặc cây của đơn khớp riêng TB này) thì tiện ích tự bấm **“Lưu”** của cửa sổ chủ rồi sang chủ sau – không dừng chờ bạn xem. Chưa chắc (vd. Mã đơn chỉ chung một phần thửa, đơn trống không đọc được Mã đơn) thì vẫn chạy nhưng **không tự Lưu chủ** – con trỏ ở nút Lưu, bạn nhấn Enter. Ngay trước khi bấm, tiện ích đọc lại các ô: trang tự xóa / đổi ô nào thì **không bấm**, dừng cho bạn xem. Dữ liệu thiếu (vd. chưa có số CCCD, năm sinh) hoặc ô chưa điền được → **dừng chờ bạn** điền rồi tự bấm Lưu như cũ. Trang hỏi “Giấy tờ tùy thân đã tồn tại…” → tiện ích **không trả lời**, chờ bạn bấm Đồng ý / Bỏ qua rồi làm tiếp. Tắt được ở tab **Biên nhận** → “Tự động”.
3. Với từng thửa: tự bấm **Thêm → Thửa đất**, điền → **chờ bạn tự bấm Lưu** → thấy thửa đã vào đơn thì sang thửa sau.
4. Đối chiếu: mọi chủ, mọi thửa đã có trong đơn.
5. **Phiếu đối chiếu số liệu**: đọc lại những gì VBDLIS đã lưu trong đơn và so từng ô với dữ liệu – chủ: họ tên, năm sinh, giới tính (Ông/Bà), số giấy tờ; thửa: diện tích, mục đích sử dụng, thời hạn. Mỗi ô có dấu: ✓ khớp, ✗ lệch, ⚠ dữ liệu thiếu (bạn tự điền), • trang không hiện để so. Có ô ✗ thì **dừng, không tô nút** – sửa trên VBDLIS (chọn mục → Sửa) rồi chạy lại; cố ý để khác thì cứ tự bấm Lưu.
   Phiếu còn bắt: ô **Năm sinh / Số CCCD để trống**, giới tính **chưa chọn** (trang ghi “Ông/Bà”), **chủ hoặc thửa bị thêm 2 lần** vào đơn, mục có trong đơn mà dữ liệu TB không có. Tên chỉ khác chỗ đặt dấu (Thủy / Thuỷ, Hòa / Hoà) coi là khớp; khác dấu thật (Cừ / Cử) là lệch.
6. Tô vàng nút **Lưu thông tin đăng ký**. Bạn tự bấm nút đó rồi **Hoàn tất** (1 lần). Khi trang báo **“Lưu đơn đăng ký thành công”**, tiện ích ghi **giờ nhập đơn** – trạng thái TB vẫn là **○ Chưa xong** (◐ khi đã chuyển lãnh đạo; ✓ Xong khi Trả hồ sơ xong).
Chủ / thửa đã có trong đơn thì được bỏ qua (chạy lại không thêm trùng). TB có nhiều chủ (kể cả người dùng chung, vợ/chồng) thì tiện ích thêm **lần lượt tất cả** các chủ: mở Thêm → Cá nhân, điền, chờ bạn bấm Lưu rồi mới sang chủ tiếp theo. Ở cửa sổ **chủ**, nếu bấm Đóng thay vì Lưu, tiện ích dừng và hỏi lại trước khi mở lại. Ở cửa sổ **thửa**, bấm Đóng (vd. VBDLIS báo thửa đã có) thì tiện ích **bỏ qua thửa đó và làm tiếp thửa sau** – xem mục “Thửa trùng – tự bỏ qua”.

**Từng phần (bấm tay từng mục):**
1. Mở cửa sổ **Nhập đơn đăng ký**, chọn đúng TB trong bảng điền.
2. Tab **Chủ SD** → bấm **“Điền chủ 1 (tự bấm “Thêm → Cá nhân”)”**. Tiện ích:
   - chọn **Điều kiện cấp giấy** = “Chưa đủ điều kiện cấp giấy” và tích **Đăng ký lần đầu** (đổi được ở ô đầu tab Chủ SD; chọn “(không đổi)” để tiện ích không đụng vào);
   - tự bấm **Thêm → Cá nhân** rồi điền Họ tên, Năm sinh, Giới tính, Dân tộc, Quốc tịch, Loại giấy tờ, Số giấy tờ, Nơi cấp, Địa chỉ chi tiết. **Không điền Ngày cấp, Ngày hết hạn.**
   Bạn kiểm tra rồi tự bấm **Lưu** (trang hỏi “Giấy tờ tùy thân đã tồn tại…” thì bạn tự chọn).
3. Tab **Thửa đất** → bấm **Điền** từng thửa: tiện ích tự bấm **Thêm → Thửa đất** rồi điền Số thửa, Số tờ, Diện tích (cả 3 ô), Diện tích PL, MĐSD, Nguồn gốc, Thời hạn SD 50 năm, Địa chỉ chi tiết. Bạn kiểm tra rồi tự bấm **Lưu**, rồi Điền thửa tiếp theo.
4. Chủ / thửa **đã có trong đơn** (đã hiện ở cây Chủ sử dụng / Thửa đất) thì bấm Điền lần nữa tiện ích chỉ báo “đã có trong đơn”, **không thêm trùng**.
5. Cuối cùng bạn tự bấm **Lưu thông tin đăng ký** / **Hoàn tất** (bấm một lần là đủ – thấy “Lưu đơn đăng ký thành công” là xong).

## Quy trình xử lý tự động (tác vụ 2 và 3 – thả sẵn file, bấm ▶)
Giống hệt các bước bạn ghi thao tác / hướng dẫn, tiện ích làm thay:
1. **Thả sẵn file quét** của nhiều hồ sơ vào bảng điền – được cả **thả nguyên thư mục** (vd. `18 TH`, tiện ích tự lấy file trong các thư mục TB con), hoặc tab **Giấy tờ** → **“Thêm file quét…”** / **“Chọn thư mục…”**. Tên file theo quy định 25.10: `KH 2959.07777.<tờ>.<thửa>[-<tờ>.<thửa>…].DDK.pdf` / `.TBXN.pdf`. File tên sai bị từ chối ngay.
2. File vào **hàng chờ** (nút **📎 số file** ở đầu bảng; tab **Giấy tờ** liệt kê theo TB, ✕ bỏ từng file, **Xóa hàng chờ** bỏ hết). Hàng chờ nằm trong bộ nhớ tiện ích **trên máy này** (F5 vẫn còn), không gửi đi đâu.
3. Trên VBDLIS: chọn hồ sơ → **Xử lý hồ sơ** → cửa sổ **Quy trình xử lý** → bấm **▶ Chạy cả TB**. Tiện ích làm lần lượt:
   - **Tác vụ 2 – Cập nhật dữ liệu pháp lý** (nếu chưa tích “Đã xử lý”): bấm “Xử lý tác vụ” → tab thứ 3 **“Thông tin sau biến động”** (Thông tin giấy SBD) → bấm dòng **“Đơn đăng ký”** (chuyển xanh – tiện ích đọc Mã đơn trên dòng đó, tự chọn đúng TB) → **Thực hiện** → hộp hỏi xác nhận: **Đồng ý** (chỉ đúng hộp hỏi của bước này; trang báo lỗi / hỏi lạ thì dừng chờ bạn) → chờ “Cập nhật dữ liệu pháp lý thành công” → **tích “Đã xử lý”** (trang thường tự tích; chưa tích thì tiện ích tích).
   - **Tác vụ 3 – Lưu kho hồ sơ quét** (nếu chưa tích): bấm “Xử lý tác vụ” → chờ cửa sổ tải **xong hẳn** → đọc **Mã đơn**, lấy đúng **file DDK + TBXN cùng số biên nhận** trong hàng chờ → **+** → Thêm tập tin (Loại giấy tờ, Mô tả, Tên giấy tờ) → **Lưu** nhỏ, 2 lần → **Tải lên** đúng file vào từng dòng (không mở hộp chọn file; **file nào đính kèm xong tự mất khỏi hàng chờ**) → **Cập nhật** → chờ trang lưu xong → **Đóng** → **tích “Đã xử lý”**.
   - Không làm Kết ISO, Chuyển tiếp – bạn tự làm (🤖 Tự động hết bật thì tự chuyển tiếp; Kết ISO chỉ khi bạn tích thêm ô **Tự Kết ISO**).
4. Tác vụ “Nhập đăng ký” chưa tích “Đã xử lý” → tiện ích dừng (nhập đơn xong rồi chạy). Cửa sổ khác đang che Quy trình xử lý → dừng, nhắc đóng cửa sổ đó.

Chạy được cả khi đang mở sẵn cửa sổ **Cập nhật dữ liệu pháp lý**, **Lưu kho hồ sơ quét** hoặc **Hồ sơ quét** (dòng nào đã có thì không thêm lại; dòng đã có tập tin thì không cần file trong hàng chờ). Tiện ích tự kiểm tra:
- Hàng chờ **chưa có đủ** DDK + TBXN của hồ sơ đó → dừng, **chưa bấm “+”**.
- Chỉ lấy file có **đúng bộ tờ.thửa** của hồ sơ. Tên dài bị chia đôi → các nửa phải **giống hệt nhau** (cùng dung lượng) mới coi là một; file của TB khác chỉ trùng thửa → **không lấy**. Hai file cùng hồ sơ cùng loại mà **khác nhau** (vd. bản quét lại “(1)”) → dừng, bạn bỏ (✕) bản sai.
- Cửa sổ Lưu kho phải tải xong (Mã đơn, thửa, danh sách hồ sơ quét) mới quyết định. Hồ sơ **đã có hồ sơ quét** đủ 2 tập tin → không thêm nữa (không tạo hồ sơ quét trùng), bỏ file của hồ sơ đó khỏi hàng chờ, Đóng và tích “Đã xử lý”. Có hồ sơ quét nhưng thiếu → dừng để bạn tự bổ sung.
- Trang không nhận file (⏸ “trang chưa nhận file”, nút “Tải lên” tô vàng, có tiếng báo) → bạn bấm **Tải lên** ở dòng đó, file vẫn tự vào.
- Bấm **■ Dừng** giữa chừng: file tạm bỏ ngay, file chưa tải lên **vẫn còn** trong hàng chờ – bấm ▶ lại là làm tiếp.

Tắt ở tab **Biên nhận** → “Tự động”: “Quy trình xử lý tự động” (Thực hiện, Đồng ý, Cập nhật, tích Đã xử lý) – tắt thì tiện ích dừng ở các nút đó cho bạn bấm; “Lưu kho hồ sơ quét tự động” (thêm dòng, tải lên). Khi 🤖 Tự động hết **tắt**, tiện ích **không** bấm Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Kết ISO, Chuyển tiếp, Thực thi. Kết ISO chỉ khi 🤖 bật **và** bạn tích ô **Tự Kết ISO**.

## Theo dõi tiến độ – không sót TB nào
- Danh sách TB ở ô trên cùng có dấu (4 mức – bạn chọn 23/11): **○ Chưa xong** (chưa làm, hoặc đã tiếp nhận / đã nhập đơn mà **chưa chuyển lãnh đạo**), **◐ Đã nhập nhưng chưa xong** (đã **Thực thi chuyển lãnh đạo** – vd. tài khoản lãnh đạo trong cài đặt), **✓ Xong** (đã **Trả hồ sơ xong** – bản 1.21.4, bạn chốt 23/11: chỉ Trả hồ sơ mới ✓; hồ sơ đã ở bước Trả kết quả / đang Trả hồ sơ mà chưa trả xong vẫn ◐; nhập đơn, lưu kho hồ sơ quét chỉ ghi giờ), **⏸ Tạm hoãn**. TB nào trùng thửa với TB khác có thêm **⚠ trùng thửa** (khung vàng ghi rõ trùng với TB nào – kiểm tra kẻo nhập 2 lần).
- Dòng dưới cho biết số TB xong / đã nhập chưa xong / chưa xong (trong đó bao nhiêu TB đã tiếp nhận); cạnh ô Trạng thái ghi giờ từng bước (tiếp nhận, chuyển CV, nhập đơn, chuyển LĐ, trả hồ sơ, xong). Nút **→ TB chưa làm** chọn TB chưa tiếp nhận tiếp theo.
- **Số biên nhận đã được dùng cho hồ sơ khác** (bản 1.20.0): 🤖 bấm Lưu hồ sơ mà trang báo “Số biên nhận … đã được sử dụng cho hồ sơ khác” (đúng số của TB đang làm) → hồ sơ của TB đó đã có trên VBDLIS: tiện ích ghi TB đó **◐ Đã nhập nhưng chưa xong** (coi như đã tiếp nhận – không tiếp nhận lại; bảng Tiến độ ghi “nên kiểm tra”), bấm **Đồng ý** hộp báo, chọn TB chưa làm tiếp theo, **tải lại trang** rồi 🤖 tự tiếp nhận TB đó.
- Tiện ích **tự ghi giờ từng bước** sau khi bạn chạy “▶ Chạy cả TB” / 🤖 cho TB đó: “Lưu hồ sơ thành công” → giờ tiếp nhận; “Lưu đơn đăng ký thành công” → giờ nhập đơn; Thực thi chuyển lãnh đạo xong → **◐ Đã nhập nhưng chưa xong**; Trả hồ sơ thành công → **✓ Xong** (trang “Đang xử lý...” thì chờ xử lý xong; bạn tự Trả hồ sơ cũng vậy) – chỉ khi **chắc đúng hồ sơ** (ô Số biên nhận / cây của đơn / Mã đơn đúng của TB đó). Không chắc thì dòng báo hiện nút **“Đánh dấu TB …”** để bạn bấm. Nó chỉ đọc thông báo, không bấm gì. Làm tay thì đổi ô **Trạng thái** bằng tay: “◐ Đã nhập nhưng chưa xong” = ghi đã chuyển lãnh đạo; “○ Chưa xong” cho TB đã tiếp nhận → tiện ích hỏi: **giữ dấu đã tiếp nhận** (mặc định – không tiếp nhận lại) hay **xóa hết dấu** (chỉ khi đánh dấu nhầm – tiện ích sẽ tiếp nhận lại TB đó).
- **TB lãnh đạo đã trả về mà không còn hồ sơ trong danh sách** (bản 1.21.5 – bạn yêu cầu 24/11: “tìm không thấy thông tin hồ sơ thì bỏ qua và tích TB đó là đã xong”, chọn: chỉ TB lãnh đạo đã trả về – tiện ích đã thấy hồ sơ ở bước 4 (Quy trình 5 tác vụ), đã chuyển bước Trả kết quả, đã bấm Trả hồ sơ (🤖 hoặc bạn), hoặc máy này đã ký duyệt ở vai trò Lãnh đạo): 🤖 tìm số biên nhận ở Danh sách hồ sơ thụ lý, **1 lần tìm chắc chắn** – bảng danh sách vừa tải lại cho đúng số đó và hiện dòng **“Không tìm thấy hồ sơ nào”** (hoặc “Không có dữ liệu”) ngay trong bảng, ô tìm còn đúng số đó, thanh lọc đang ở **“Tất cả”**, trang không báo lỗi (cả hộp báo lỗi), đang đăng nhập đúng **tài khoản Chuyên viên** trong cài đặt → hồ sơ đã trả → **✓ Xong** (ghi “suy ra: không còn trong Danh sách hồ sơ thụ lý”, bảng Tiến độ ghi “Xong suy ra”); lượt kiểm TB ✓ sau đó **tìm lại TB này 1 lần nữa** – còn hồ sơ thì đổi về ◐ làm tiếp. **Chưa chắc** (thanh lọc ở mục khác “Tất cả” – bạn bấm “Tất cả”; tiện ích không nhận ra mục đang chọn; bảng chưa tải lại; trang báo lỗi; đăng nhập tài khoản khác) → chưa tích, lượt sau tìm lại; hồ sơ **vừa đổi bước** (2 phút – vừa chuyển bước Trả kết quả, lãnh đạo vừa trả về / ký duyệt) → chờ lượt sau. **Không tích** (giữ ◐): TB **chỉ mới chuyển lãnh đạo** (tiện ích chưa thấy trả về – TB cũ bạn đã tự trả mà tiện ích không biết thì đổi hàng loạt ở **☰ Tiến độ**); TB mà **bạn tự bấm Thực thi chuyển sang bước khác** “Trả kết quả” (trả về lãnh đạo, bước trước, người khác…); TB **bạn đã đổi tay từ ✓ về ◐** sau lần tiện ích tự tích (tới khi tiện ích thấy lại hồ sơ / hồ sơ đổi bước); TB chỉ có dấu ký duyệt của vai trò Lãnh đạo mà **người nhận bước 4** khác tài khoản Chuyên viên. Khi 🤖 chạy, **đừng để bộ lọc nâng cao** (nút phễu cạnh ô tìm) đang lọc – hồ sơ bị lọc mất sẽ bị coi là đã trả. Tích nhầm (hiếm) → đổi ô **Trạng thái** của TB về ◐ (tiện ích bỏ dấu đã trả, không tự tích lại; 🤖 làm lại chặng cuối khi thấy hồ sơ).
- **Bạn tự bấm** (bản 1.21.4, cả khi 🤖 tắt): **Thực thi** chuyển lãnh đạo ở bước “… Lãnh đạo … (Tiếp theo)” → TB thành **◐** (trang báo chuyển xong / cửa sổ chọn người đóng mà không báo lỗi thì ghi mốc chuyển lãnh đạo); **Thực hiện → Đồng ý** của Trả hồ sơ → chờ trang hết “Đang xử lý...” rồi **✓ Xong** (trang tải lại giữa chừng thì lần tìm sau kết luận như trên). Bạn bấm Đóng / Hủy / Không / Esc lúc cửa sổ còn mở thì thôi; trang báo lỗi thì không ghi. Trang hiện **hộp lạ** (không phải câu hỏi, không phải báo thành công – vd. “Hồ sơ chưa được ký số”) thì tiện ích **không** ghi ✓ / ◐, dòng báo trên bảng ghi chữ của hộp để bạn xem.
- **⏸ Tạm hoãn**: TB chưa nhập được (chưa rõ chủ, trùng TB khác, chờ hỏi lại…) → ô **Trạng thái** chọn “⏸ Tạm hoãn” và ghi lý do. TB hoãn không lẫn vào “chưa làm”, nút “→ TB chưa làm” bỏ qua nó, bảng Tiến độ có bộ lọc riêng; chạy TB đó thì tiện ích nhắc lý do và hỏi “Bỏ tạm hoãn”.
- Nút **☰ Tiến độ**: số TB tiếp nhận / nhập đơn / xong **hôm nay** và 7 ngày gần nhất; bảng tất cả TB kèm giờ tiếp nhận, giờ nhập đơn, giờ xong, điều cần xem (tạm hoãn, trùng thửa, lệch số liệu, ghi chú). Lọc **○ Chưa xong / ◐ Đã nhập chưa xong / ✓ Xong / ⏸ Tạm hoãn / ⚠ Cần xem**. Bấm một dòng để chọn TB đó. **⧉ Sao chép bảng** rồi dán vào Excel, hoặc **⬇ Tải file Excel** (file `tien-do-vbdlis-….csv` vào thư mục Tải xuống).
- **Đổi trạng thái hàng loạt** (bản 1.21, trong ☰ Tiến độ): tích ô đầu dòng các TB cần đổi – **Shift + bấm** chọn liền một đoạn; ô trên cùng chọn / bỏ chọn **mọi TB đang hiện theo bộ lọc** (vd. bấm lọc “⏸ Tạm hoãn” rồi tích ô trên cùng); hoặc gõ số TB / khoảng vào ô bên phải (vd. `1640-1660, 1665`) rồi bấm **Chọn**. Chọn trạng thái ở ô “Đổi trạng thái các TB đã chọn sang…” rồi bấm **Đổi** – tiện ích hỏi lại một lần (kèm danh sách TB) rồi đổi giống hệt khi đổi ô Trạng thái từng TB: ◐ = ghi đã chuyển lãnh đạo; ✓ Xong; ⏸ Tạm hoãn hỏi **một** lý do cho cả nhóm; ○ Chưa xong cho các TB đã tiếp nhận thì hỏi **giữ dấu đã tiếp nhận** (mặc định – tiện ích không tiếp nhận lại) hay **xóa hết** (chỉ khi đánh dấu nhầm). Bấm **Bỏ chọn** để bỏ tích hết.
- **Sao lưu tiến độ** (trong ☰ Tiến độ): **⬇ Sao lưu tiến độ** lưu file `tien-do-vbdlis-….json` (chỉ có số TB, giờ, trạng thái – không có tên, số giấy tờ). Gỡ / cài lại tiện ích, đổi máy hay xóa dữ liệu trình duyệt thì tiến độ mất → **⬆ Nạp tiến độ…** chọn file đó là có lại (gộp với tiến độ đang có). Nên sao lưu cuối mỗi ngày; bảng có ghi “Sao lưu gần nhất”.
- **Nạp tiến độ bằng Excel** (bản 1.21.1): trong ☰ Tiến độ bấm **⬇ Tải file Excel** → mở file `tien-do-vbdlis-….csv` bằng Excel → sửa cột **Trạng thái** (Chưa xong / Đã nhập nhưng chưa xong / Xong / Tạm hoãn; để trống = không đổi) → lưu lại (giữ kiểu CSV, hoặc “Lưu thành” Excel Workbook .xlsx) → bấm **⬆ Nạp tiến độ…**, chọn file đó. Tiện ích tìm cột **TB** và **Trạng thái**, hiện bảng **xem trước** (TB nào đổi, từ gì sang gì; dòng không có trong dữ liệu / chữ trạng thái không hiểu thì báo riêng, không đổi) – bấm **“Đổi … TB theo Excel”** mới đổi, **Hủy** thì thôi. Đổi giống hệt đổi ô Trạng thái từng TB: ◐ = ghi đã chuyển lãnh đạo; TB đã tiếp nhận mà Excel ghi “Chưa xong” vẫn **giữ dấu đã tiếp nhận** (tiện ích không tiếp nhận lại); Tạm hoãn lấy lý do ở cột “Cần xem” nếu có. Chữ mất dấu khi Excel lưu CSV (vd. “Ch?a xong”) vẫn nhận được. File Excel đời cũ (.xls) thì “Lưu thành” .xlsx hoặc CSV trước. TB có tiến độ **mới hơn lúc lưu file Excel** (vd. 🤖 vừa trả hồ sơ sau khi bạn xuất file) thì **giữ nguyên**, không bị file cũ kéo lùi – bảng xem trước ghi rõ các TB đó (bản 1.21.4). File sao lưu `.json` vẫn nạp như cũ (gộp).
- Tiến độ nằm trong trình duyệt của máy này, dùng chung cho mọi tab VBDLIS. Xóa TB khỏi tiện ích không xóa tiến độ của nó (nạp lại TB đó vẫn thấy dấu cũ).

## Thửa trùng – tự bỏ qua
Tiện ích **không mở cửa sổ** cho thửa trùng, chỉ ghi một dòng “• Thửa … – … – bỏ qua” rồi làm tiếp:
- thửa **ghi 2 lần** trong danh sách của cùng một TB (lần 2 bỏ qua);
- thửa **đã nhập ở TB khác** (cùng số tờ, số thửa – vd. TB 1582 trùng TB 1527, TB 1592 trùng thửa 344/111 với TB 1534): TB kia đã tiếp nhận / nhập đơn có thửa đó thì TB này bỏ qua;
- thửa mà lần trước **bạn bấm Đóng / Hủy bỏ** ở cửa sổ thửa (thường vì VBDLIS báo thửa đã có): tiện ích ghi nhớ “bỏ qua” và chạy tiếp thửa sau, không dừng nữa.
- **Trang báo thửa “đã tồn tại”** (bản 1.21 – bạn yêu cầu 23/11), ở cửa sổ “Thêm thửa đất” (Tiếp nhận) và cửa sổ thửa của Nhập đơn đăng ký – cả khi 🤖 bật lẫn tắt: tiện ích bấm nút có chữ **“Bỏ qua”** của hộp (vd. “Bỏ qua”, “Bỏ qua thửa này”); hộp chỉ báo (không hỏi) thì bấm **Đóng / OK** của hộp, hoặc **Đồng ý** khi đó là nút **duy nhất** của hộp và trang chỉ có hộp đó – trang thật (bản 1.21.2, ảnh của bạn 23/11) báo “**THÔNG BÁO – Thửa đất đã tồn tại**” chỉ với một nút **ĐỒNG Ý** → tiện ích bấm **Đồng ý**; rồi đóng cửa sổ thửa (**Hủy bỏ / Đóng / ×**, không lưu), ghi **bỏ qua** thửa đó (lần sau không nhập lại) và làm tiếp thửa sau. Không đóng được cửa sổ thửa (không thấy nút Hủy bỏ / Đóng / ×) → kêu ting, nhờ bạn bấm Đóng / Hủy bỏ (**không bấm Lưu**), bạn đóng xong tiện ích ghi bỏ qua rồi làm tiếp. Hộp **hỏi** mà không có nút bỏ qua (vd. “… đã tồn tại. Bạn có muốn cập nhật?” Đồng ý / Không), hộp có thêm nút khác (vd. Đồng ý + Hủy), hoặc đang có nhiều hộp chồng nhau → tiện ích **không bấm gì**, kêu ting, dòng báo ghi rõ chữ của hộp – bạn tự trả lời / đóng cửa sổ thửa, tiện ích ghi bỏ qua rồi làm tiếp. Ở hộp hỏi / hộp nhiều nút, tiện ích **không bao giờ** bấm Đồng ý / Tiếp tục / Lưu. Hộp này **không cần** dạy ở tab Trường: lúc robot đang chạy, mẫu hộp hỏi không được dùng cho hộp “thửa đã tồn tại” – tiện ích tự trả lời để còn đóng cửa sổ thửa và ghi bỏ qua. (Hộp “Giấy tờ tùy thân đã tồn tại” của cửa sổ chủ vẫn trả lời Đồng ý như cũ.)

Cuối nhật ký có dòng **“Thửa đang bỏ qua: …”** kèm nút **“Mở lại để thêm”** – bấm nếu bạn lỡ tay đóng, tiện ích chạy lại và mở thửa đó. Ở bước tiếp nhận (chỉ cần 1 thửa), thửa đầu bị bỏ qua thì tiện ích dùng thửa kế tiếp; nếu **mọi thửa** của TB đều trùng thì dừng, có nút **“⏸ Tạm hoãn TB …”**. Bảng **☰ Tiến độ** ghi “bỏ qua thửa …” ở cột Cần xem.

## Kiểm tra nhanh rồi Enter, tiếng báo
- Khi tiện ích điền xong một cửa sổ **thửa** (cửa sổ chủ thì tiện ích tự Lưu – xem trên) mà **mọi ô đều khớp dữ liệu**, dòng chờ ghi tóm tắt, vd. “đã điền: thửa 5/111 · 100.5 m² · LUC · 50 năm (10/10 ô ✓)”, và **con trỏ nằm sẵn ở nút “Lưu”** của cửa sổ (viền vàng). Bạn liếc thấy đúng thì chỉ cần **nhấn Enter**. Tiện ích vẫn **không tự bấm**. Không đặt con trỏ khi: có ô chưa điền được, dữ liệu thiếu (vd. chủ chưa có số CCCD, giới tính, năm sinh), hoặc bạn đang gõ / vừa bấm vào một ô trên trang (khỏi giành con trỏ của bạn) – khi đó bạn tự điền rồi bấm Lưu. Tắt ở tab **Biên nhận** → “Khi Chạy cả TB dừng chờ bạn”.
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

**Thời hạn SD** tự điền “50 năm”, **Nguồn gốc đất** tự chọn “Công nhận QSDĐ như giao đất không thu tiền sử dụng đất”. MĐSD **ONT** hoặc **ONT+CLN** điền thành **ODT** (đất ở tại đô thị – bản 1.19.1). **Thửa đất ở** (MĐSD **ODT**, bản 1.19.0): Nguồn gốc “**Công nhận QSDĐ như giao đất có thu tiền sử dụng đất**”, Thời hạn “**Lâu dài**” (khi dữ liệu để trống hoặc để mặc định của đất nông nghiệp; dữ liệu ghi riêng giá trị khác thì theo dữ liệu). Muốn khác thì sửa ở ô của từng thửa, hoặc dùng các ô chung + “Áp dụng” cho cả TB.

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
  "tb": "1000",
  "soBienNhan": "KH 2959.07777.1.1",
  "nguoiNop": { "hoTen": "NGUYỄN VĂN A", "soGiayTo": "012345678901", "diaChi": "Tổ dân phố 1, phường Việt Yên, TP Bắc Ninh" },
  "chu": [
    { "hoTen": "NGUYỄN VĂN A", "ngaySinh": "01/01/1960", "namSinh": "1960", "gioiTinh": "Nam",
      "loaiGiayTo": "Căn cước công dân", "soGiayTo": "012345678901", "ngayCap": "01/01/2023", "ngayHetHan": "",
      "noiCap": "Cục Cảnh sát Quản lý hành chính về TTXH", "diaChi": "Tổ dân phố 1, phường Việt Yên, TP Bắc Ninh" }
  ],
  "thua": [
    { "soThua": "1", "soTo": "1", "dienTich": "1712.6", "mdsd": "LUC", "diaChi": "Tổ dân phố 2, phường Việt Yên, TP Bắc Ninh" }
  ],
  "giayTo": ["Đơn đăng ký", "Căn cước công dân"],
  "ghiChu": "Ghi chú hiện ở khung vàng (không bắt buộc)"
}
```

Dữ liệu TB 1810–1817 đã có sẵn trong `data/du-lieu.json` và được nạp khi cài.

## Phóng to / thu nhỏ bảng điền
Kéo **góc dưới bên trái (◣)** hoặc **góc dưới bên phải (◢)** của bảng để đổi chiều rộng, chiều cao. Kéo thanh tiêu đề để di chuyển. Tiện ích nhớ cỡ và vị trí cho lần mở sau. Bấm đúp vào góc để về cỡ mặc định.

**📌 Gắn sát cạnh phải** (bản 1.19.6): bấm nút **📌** trên thanh tiêu đề → bảng dính sát mép phải, cao hết màn hình; trang VBDLIS dồn sang trái nhường chỗ (cửa sổ, hộp hỏi, thông báo của trang hiện ở phần còn lại, không bị bảng che). Kéo **mép trái** của bảng để đổi bề rộng (bấm đúp: về mặc định). Thu nhỏ (–) hoặc ẩn (×) bảng → trang về như cũ. Bấm **📌** lần nữa → bảng nổi như trước. Tiện ích nhớ lựa chọn cho lần mở sau. Nút này chỉ đổi cách hiện bảng, không đổi việc điền / bấm của tiện ích. Màn hình nhỏ mà cửa sổ của trang rộng hơn phần còn lại → kéo ngang trong cửa sổ đó để thấy hết.

**Phần nhật ký** (kết quả “Chạy cả TB”, “Kiểm tra trang”… ở dưới bảng): kéo **thanh ngăn “•••”** nằm giữa phần điền và phần nhật ký – kéo **xuống** để nhật ký thấp lại, phần điền phía trên rộng ra; kéo **lên** để xem nhật ký dài hơn. Tiện ích nhớ chiều cao này; bấm đúp vào thanh ngăn để về mặc định.

## Xóa dữ liệu
Bấm **Dữ liệu** → hàng **Xóa:**
- **TB đang chọn** – xóa TB đang chọn ở ô trên cùng của bảng điền (kèm các dấu ✓ của TB đó);
- **Tất cả TB** – xóa hết danh sách TB (mở lại bảng cũng không tự nạp lại dữ liệu mẫu);
- **Bản ghi thao tác** – xóa bản ghi thao tác đã ghi (đang ghi thì phải bấm ● dừng trước).

Mỗi lần xóa tiện ích đều hỏi lại. Xóa chỉ xóa dữ liệu trong tiện ích trên máy này, **không đụng gì trên VBDLIS**. Muốn có lại dữ liệu: dán JSON rồi **Gộp vào**, hoặc bấm **Nạp mẫu** rồi **Gộp vào**. Chỉ muốn bỏ các dấu ✓ thì dùng nút **Xóa dấu ✓**.

## Lưu ý
- Dữ liệu chỉ nằm trong trình duyệt của máy này, không gửi đi đâu.
- File quét bạn thả vào nằm trong hàng chờ (bộ nhớ tiện ích trên máy này) tới khi đính kèm xong thì tự xóa; chỉ được đưa lên VBDLIS ở đúng dòng của đúng hồ sơ (giống bạn tự bấm “Tải lên”).
- Tiện ích chỉ chạy trên tab khi bạn bấm biểu tượng hoặc Alt+Q. Nếu trang VBDLIS tải lại mà bảng biến mất, bấm biểu tượng lần nữa.
- Sau khi sửa file của tiện ích, vào trang tiện ích bấm ⟳ (Tải lại), rồi bấm F5 trang VBDLIS.
- Thư mục `test/` chỉ dùng để thử trên trang giả lập, không ảnh hưởng tiện ích.
