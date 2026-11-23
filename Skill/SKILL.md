---
name: tao-du-lieu-vbdlis
description: Tạo / cập nhật file dữ liệu TB (data/du-lieu.json và các file TB_xxxx.json) cho tiện ích Chrome “VBDLIS Điền Nhanh” từ hồ sơ quét TBXN + đơn đăng ký (DDK) trong các thư mục “TB xxxx”, hoặc gộp các file JSON TB lẻ thành du-lieu.json. Dùng bất cứ khi nào người dùng nhờ “làm json TB 1896”, “làm dữ liệu cho tiện ích / cho extension”, “TB 1897 cho tôi”, “xuất JSON cho tiện ích VBDLIS”, “tạo / cập nhật du-lieu.json”, “gộp TB vào data”, “tiện ích không load dữ liệu / Failed to fetch thư mục data”, kể cả khi chỉ gửi thư mục scan TBXN+DDK mà không nói rõ là JSON. Cũng dùng khi nhờ “kiểm tra du-lieu.json / phiếu kiểm tra dữ liệu TB” trước khi nạp vào tiện ích.
---

# Tạo dữ liệu TB cho tiện ích VBDLIS Điền Nhanh

Người dùng là cán bộ nhập hồ sơ đăng ký đất đai (phường Việt Yên, TP Bắc Ninh) lên VBDLIS. Tiện ích Chrome
“VBDLIS Điền Nhanh” (thư mục `vbdlis-dien-nhanh`) điền sẵn VBDLIS từ file **`vbdlis-dien-nhanh/data/du-lieu.json`**.
Tiện ích **chỉ tự đọc đúng file du-lieu.json** (mỗi lần mở bảng điền bằng Alt+Q) – trình duyệt không cho tiện ích xem
các file khác trong thư mục, nên file lẻ `TB_1896.json` để trong `data` sẽ không lên tiện ích nếu chưa gộp vào
du-lieu.json. Nhiệm vụ của skill: làm ra dữ liệu **đúng** và **gộp vào du-lieu.json**.

Trả lời người dùng bằng tiếng Việt, ngắn gọn. Chính xác quan trọng hơn nhanh: dữ liệu sai sẽ được điền thẳng lên
VBDLIS. **Không đoán**: chữ số mờ, tên khó đọc → để trống hoặc ghi rõ trong `ghiChu` và báo người dùng.
Thông tin CCCD là dữ liệu cá nhân: chỉ ghi vào file trên máy, không đưa đi đâu.

Cấu trúc JSON và nguồn của từng trường: đọc `references/mau-json.md` trước khi điền lần đầu.

## Đầu vào thường gặp

- Thư mục `TB <số>` chứa cặp `KH 2959.07777.<tờ>.<thửa>-….TBXN.pdf` + `….DDK.pdf` (tên theo Quy định đặt tên
  HSQ 25.10, thứ tự tờ.thửa = thứ tự STT trên danh sách thửa của TBXN). Có thể là nhiều thư mục TB trong một thư mục cha.
- **Thư mục có 4 PDF (2 cặp)**: thường là MỘT TB mà tên file quá dài nên bị chia đôi danh sách thửa (2 cặp là bản sao
  cùng nội dung, có thể ký số lại nên khác vài byte). Đây là **1 TB**, Số biên nhận nối đủ mọi tờ.thửa. Đừng tách thành
  “1891-1”, “1891-2” – người dùng đã báo đó là sai. Chỉ khi 2 cặp có nội dung TBXN khác nhau mới là 2 hồ sơ.
- Các file JSON TB lẻ (do người dùng hoặc công cụ khác làm) để trong thư mục `data` → chỉ cần gộp (bước 4).

Thư mục data thường ở `C:\Users\Hoang\Downloads\Extension\vbdlis-dien-nhanh\data` – kiểm tra lại, người dùng hay đổi chỗ.

## Quy trình

Các script nằm trong thư mục `scripts/` của skill này (dùng đường dẫn đầy đủ khi chạy). Cần Python có
`pypdfium2`, `Pillow`.

### 1. Dựng khung từ tên file

```
python scripts/khung_tb.py "<thư mục TB 1896>" ["<TB 1897>" …] --ra "<thư mục data>"
python scripts/khung_tb.py "<thư mục cha chứa nhiều TB>" --ra "<thư mục data>"
```

Script đọc tên file (chưa đọc nội dung): số TB, Số biên nhận, danh sách tờ.thửa, số trang từng PDF; phát hiện thư mục
2 cặp cùng nội dung → gộp 1 TB; ghi khung `TB_<số>.json` (không ghi đè file đã có, thêm `--ghi-de` nếu cần làm lại).
Thửa trong khung đã có số tờ, số thửa, thời hạn 50 năm, nguồn gốc mặc định; các trường khác để trống.

### 2. Đọc TBXN và DDK bằng mắt

Bản scan không có lớp chữ, OCR tiếng Việt hay sai → **xem ảnh trang** rồi đọc:

```
python scripts/xem_pdf.py "<file.pdf>" "<thư mục ảnh tạm>" --luoi          # lưới thu nhỏ: trang nào là gì
python scripts/xem_pdf.py "<file.pdf>" "<thư mục ảnh tạm>" --trang 1,2      # trang cần đọc (scale 1.6)
python scripts/xem_pdf.py "<file.pdf>" "<tạm>" --trang 4 --cat 0.05,0.30,0.65,0.45 --scale 4   # phóng to vùng có số nhỏ
```

Mở ảnh bằng công cụ đọc ảnh (Read). Trang xoay ngang thì thêm `--xoay 90` (hoặc 270). Để ảnh tạm ở thư mục nháp,
không để trong thư mục của người dùng.

Cần đọc:
- **TBXN trang đầu**: số TB (khớp tên thư mục), họ tên người được xác nhận, **mục 1c – địa chỉ người sử dụng đất**
  (theo quy ước của người dùng, địa chỉ này dùng cho mọi ô địa chỉ), tổng số thửa.
- **Danh sách thửa kèm TBXN**: STT, thửa, tờ (mã 2 cấp), diện tích, mục đích, thời hạn, nguồn gốc. Số dòng phải bằng
  tổng số thửa và các cặp tờ.thửa phải trùng tên file / khung; lệch thì sắp lại theo STT của TBXN và báo người dùng.
- **DDK**: trang đơn (họ tên, năm sinh, người dùng chung – xem cả Mẫu 15a nếu có), **ảnh thẻ CCCD** – đếm có bao nhiêu
  thẻ, của những ai (số thẻ quyết định số chủ, xem **Ai là chủ** ở bước 3); với từng thẻ đọc (số 12 chữ số,
  họ tên, ngày sinh, giới tính; mặt sau: nơi cấp, dòng MRZ). Số CCCD viết tay trên đơn hay mờ → lấy số trên thẻ.
  **Họ tên chủ cũng lấy trên thẻ** – xem **Quy tắc tên** ở bước 3; đọc kỹ dấu (Ừ/Ử, Ì/Ĩ, À/Ạ) trên thẻ, phóng to nếu cần.
  Ảnh CCCD thường ở **trang cuối** của DDK, thẻ nằm giữa khoảng 1/3 trên của trang; scale 1.6 không đọc được số → phóng
  to, vd. mặt trước `--cat 0.33,0.10,0.67,0.28 --scale 5`, mặt sau `--cat 0.33,0.30,0.67,0.48 --scale 5` (vị trí mỗi
  bản scan một khác, xem lưới trước). Dòng MRZ mặt sau: dòng 1 `IDVNM<9 số><số kiểm tra><12 số CCCD>…`, dòng 2 bắt đầu
  bằng `YYMMDD` ngày sinh và `M`/`F` (nam/nữ) – dùng để đối chiếu số CCCD, năm sinh, giới tính.

Kiểm tra chéo số CCCD bằng quy tắc mã (xem `references/mau-json.md`): số thứ 4 = giới tính + thế kỷ, số 5–6 = năm sinh.
Không khớp với năm sinh / giới tính đọc trên thẻ → đã đọc nhầm một chữ số, phóng to đọc lại.

### 3. Điền `TB_<số>.json`

Điền vào khung (sửa file JSON). Những quy ước người dùng đã chốt – làm đúng vì tiện ích và VBDLIS dựa vào đó:
- Số tờ theo **TBXN (mã 2 cấp)**; đơn thường ghi tờ cũ (vd. 10/11/20) – không dùng tờ của đơn, ghi chú lại.
- Diện tích dấu **chấm**: `56,5` → `"56.5"`. Mục đích ghi **mã** (`LUC`, `BHK`…).
- Địa chỉ thửa, `diaChiTaiSan`, địa chỉ chủ và người nộp = **địa chỉ mục 1c của TBXN** (không lấy địa chỉ thường trú
  trên CCCD). Thẻ CCCD phần lớn còn ghi địa danh cũ trước sáp nhập 2025 (vd. xã …, huyện Việt Yên, Bắc Giang) – khác chỉ vì
  tên cũ/mới thì **không cần ghi chú**; chỉ ghi chú khi khác hẳn nơi (thôn / tổ dân phố khác).
- **Quy tắc tên (người dùng đã chốt)**: `chu[].hoTen` = họ tên **in trên thẻ CCCD / Căn cước của chính người đó**
  trong DDK (IN HOA, đủ dấu đúng như thẻ); `nguoiNop.hoTen` = chủ thứ nhất. **Chỉ khi** thẻ mờ không đọc được tên hoặc
  hồ sơ không có thẻ mới lấy tên trên TBXN. Tên thẻ khác TBXN (khác dấu, khác chữ đệm…) → vẫn nhập theo thẻ, và `ghiChu`
  ghi rõ khác ở đâu + đã nhập theo nguồn nào (tên dưới đây là tên giả):
  - `Tên: TBXN ghi LÊ VĂN AN, thẻ CCCD ghi LÊ VĂN ÂN – nhập theo CCCD.`
  - `Tên: thẻ CCCD mờ – nhập theo TBXN (LÊ VĂN AN).` / `Tên: hồ sơ không có thẻ – nhập theo TBXN.`

  “Thẻ của chính người đó”: số thẻ khớp số trên TBXN / đơn / Mẫu 15a, hoặc cùng năm sinh và tên chỉ lệch dấu / chữ đệm.
  Thẻ của người khác (vd. con nộp thay) → **không** đổi chủ theo thẻ; ghi chú và báo người dùng. Không viết ghi chú kiểu
  “đang nhập theo TBXN, kiểm tra lại” – đọc lại thẻ cho chắc rồi nhập theo quy tắc.
- **Ai là chủ – theo thẻ (người dùng đã chốt)**: danh sách `chu` = **đúng những người có thẻ CCCD / Căn cước trong
  DDK**, mỗi thẻ một chủ – có bao nhiêu thẻ thì bấy nhiêu chủ. Đếm thẻ trên trang ảnh trước (một trang có thể có 2–4 thẻ).
  - Chung chủ (TBXN / đơn / Mẫu 15a ghi nhiều người) mà chỉ có thẻ của **một số** người → chỉ nhập những người có thẻ;
    người không có thẻ **không** đưa vào `chu`, chỉ ghi chú: `Sử dụng chung với NGUYỄN VĂN B (không có thẻ trong hồ sơ) – không nhập.`
  - Người có thẻ nhưng chỉ ghi trong đơn / Mẫu 15a (TBXN không ghi tên) → vẫn nhập đủ như chủ khác, không cần `tuyChon`.
  - Thứ tự: theo thứ tự trên TBXN, rồi đơn / Mẫu 15a. `chu[0]` = người có thẻ đứng đầu (kể cả khi người đứng tên TBXN
    không có thẻ – khi đó ghi chú `Người đứng tên TBXN … không có thẻ – nhập chủ theo thẻ: …`); `nguoiNop` = `chu[0]`.
  - Không có thẻ nào → nhập người đứng tên TBXN (Quy tắc tên: “hồ sơ không có thẻ”).
  - Thẻ của người hoàn toàn không có tên trong TBXN / đơn / Mẫu 15a (vd. con nộp thay) → không tự thêm làm chủ; ghi chú và báo người dùng.
- Chủ **chỉ cần Năm sinh** (không cần Ngày sinh, Ngày cấp, Ngày hết hạn).
- Thời hạn `50 năm` (đất nông nghiệp), nguồn gốc `Công nhận QSDĐ như giao đất không thu tiền sử dụng đất`, trừ khi
  TBXN ghi khác.
- `ghiChu`: viết cho **người nhập** đọc ở khung vàng của bảng điền – mọi điều bất thường cần biết (tên sửa tay, tờ cũ/mới,
  số đọc không chắc, thửa viết tay thêm…). Ngắn gọn, tiếng Việt; không để lời nhắc kỹ thuật (“phải đối chiếu…”) – kiểm
  xong thì viết lại ghi chú cho đúng kết quả.

Lưu `TB_<số>.json` vào thư mục data (UTF-8). Mỗi TB một file, tên `TB_<số>.json`.

### 4. Gộp vào du-lieu.json

```
python scripts/gop_du_lieu.py "<thư mục data>" --kiem-tra    # xem báo cáo trước, chưa ghi
python scripts/gop_du_lieu.py "<thư mục data>" --nguon "<thư mục chứa các TB xxxx>"   # ghi du-lieu.json (bản cũ → .bak)
```

Ghi xong, script tự chạy **phiếu kiểm tra** (bước 5) và trả mã thoát 1 nếu phiếu còn LỖI. `--nguon` (không bắt buộc)
để phiếu đối chiếu cả tên file PDF trong các thư mục `TB xxxx`.

Script đọc **mọi** `*.json` trong data (trừ du-lieu.json) và gộp vào du-lieu.json đang có (TB trùng số: file sửa sau
cùng thắng; TB chỉ có trong du-lieu.json được giữ). Nó tự sửa lỗi JSON nhỏ, chuẩn hóa diện tích / mã mục đích / họ tên,
điền mặc định (thời hạn, nguồn gốc, giấy tờ, người nộp = chủ thứ nhất, địa chỉ trống = địa chỉ thửa), dựng Số biên nhận
từ danh sách thửa nếu trống, suy năm sinh / giới tính từ số CCCD nếu trống – các việc tự suy luận được ghi thêm vào
`ghiChu` của TB. Nó cảnh báo: thiếu diện tích / mục đích, Số biên nhận không khớp danh sách thửa, CCCD sai độ dài hoặc
lệch năm sinh / giới tính, họ “NGUYÊN” (thường là NGUYỄN đọc sai dấu), TB vừa có “1891” vừa có “1891-1”.
`--bo 1891-1 1891-2` bỏ TB khỏi du-lieu.json; `--lam-moi` dựng lại chỉ từ các file lẻ.

Xử lý hết cảnh báo nào sửa được bằng cách đọc lại PDF; cái nào không sửa được thì báo người dùng.

### 5. Phiếu kiểm tra dữ liệu (bắt buộc trước khi báo xong)

```
python scripts/kiem_tra.py "<thư mục data>" ["<thư mục nguồn chứa các thư mục TB xxxx>"]
```

Chỉ đọc, không sửa dữ liệu (gop_du_lieu.py đã tự chạy sau khi ghi; chạy riêng để kiểm lại sau khi sửa tay hoặc để
đối chiếu nguồn). In phiếu chia **LỖI / CẢNH BÁO / GHI CHÚ** theo số TB, ghi ra `<data>/phieu-kiem-tra.txt` (số giấy tờ
đã che), mã thoát 1 khi còn LỖI. Nó kiểm: JSON hợp lệ + trường bắt buộc; du-lieu.json khớp từng `TB_*.json`; TB trùng
số; Số biên nhận = `KH 2959.07777.` + các tờ.thửa đúng danh sách và thứ tự thửa; có nguồn: tờ.thửa trong tên PDF từng
thư mục `TB xxxx` (thiếu / thừa / thứ tự), đủ TBXN + DDK, thư mục chưa có JSON, JSON không có thư mục; quy tắc mã CCCD so
với năm sinh / giới tính (CMND 9 số được chấp nhận), một số giấy tờ mà nhiều tên; cùng tờ/thửa ở 2 TB, TB trùng toàn
bộ; diện tích dấu chấm; thiếu mục đích; quy tắc tên (ghi chú nói thẻ ghi tên khác tên đang nhập); ghi chú còn “kiểm tra
lại / cần hỏi lại…”; khung chưa điền; liệt kê mọi `ghiChu`.

- **LỖI**: sửa hết (đọc lại PDF), chạy lại gop_du_lieu.py, đến khi phiếu hết LỖI. Không sửa được (hồ sơ thiếu, thẻ
  mờ…) → không báo “xong”; nói rõ TB nào thiếu gì.
- **CẢNH BÁO**: xem từng cái; sai thì sửa; hồ sơ đúng là như vậy (vd. 2 TB cùng một thửa) thì ghi vào `ghiChu` và để
  người dùng quyết.
- **Cho người dùng xem danh sách TB cần xem lại** lấy từ phiếu: mỗi dòng “TB 1896 – vấn đề ngắn” (không chép số giấy
  tờ), kèm đường dẫn `phieu-kiem-tra.txt`.

### 6. Báo người dùng

- Kết quả chính trước: “Đã thêm TB 1896, 1897 vào du-lieu.json (tổng N TB)”.
- Mỗi TB một dòng: chủ, số thửa, Số biên nhận (rút gọn nếu dài).
- Mục **Cần anh/chị xem**: danh sách TB có LỖI / CẢNH BÁO trong phiếu kiểm tra (số TB + vấn đề ngắn), cộng những điều
  đọc không chắc: số / tên khó đọc, tên thẻ khác TBXN, thửa thiếu diện tích, tờ đơn khác tờ TBXN, tên sửa tay…
- Nhắc: mở bảng điền (Alt+Q) là tiện ích tự đọc du-lieu.json – không cần dán JSON, không cần tải lại tiện ích.
  TB đã sửa tay trong bảng điền được giữ nguyên; muốn lấy bản mới của file thì bảng điền → Dữ liệu → Lấy từ thư mục data → Gộp vào.

## Khi chỉ có JSON (không có PDF)

Người dùng để sẵn các file `TB_xxxx.json` (hoặc dán JSON) và tiện ích báo “Failed to fetch” / không thấy dữ liệu:
nguyên nhân là thiếu hoặc hỏng `data/du-lieu.json`. Chạy bước 4 để tạo lại, rồi báo các TB còn thiếu gì
(diện tích, mục đích, số giấy tờ…) để người dùng bổ sung hoặc gửi PDF cho đọc lại.

## Lưu ý

- Không xóa / ghi đè file PDF hay file JSON gốc của người dùng; chỉ ghi `TB_<số>.json` mới (không ghi đè nếu đã có,
  trừ khi người dùng bảo làm lại), `du-lieu.json` (có bản `.bak`) và `phieu-kiem-tra.txt`.
- Dữ liệu có thể lệch giữa TBXN và đơn (tên sửa tay, người đã mất, tờ cũ). TBXN là căn cứ chính cho thửa (tờ, thửa,
  diện tích, mục đích…) và cho biết ai đứng tên; **họ tên, số giấy tờ, năm sinh của chủ theo thẻ CCCD** (Quy tắc tên,
  bước 3); đơn để đối chiếu.
- Nếu người dùng có bảng quy đổi tờ mã 2 cấp ↔ 3 cấp (Excel), dùng nó để đối chiếu tờ trên đơn với TBXN.
