---
name: tao-du-lieu-vbdlis
description: Tạo / cập nhật file dữ liệu TB (data/du-lieu.json và các file TB_xxxx.json) cho tiện ích Chrome “VBDLIS Điền Nhanh” từ hồ sơ quét TBXN + đơn đăng ký (DDK) trong các thư mục “TB xxxx”, hoặc gộp các file JSON TB lẻ thành du-lieu.json. Dùng bất cứ khi nào người dùng nhờ “làm json TB 1896”, “làm dữ liệu cho tiện ích / cho extension”, “TB 1897 cho tôi”, “xuất JSON cho tiện ích VBDLIS”, “tạo / cập nhật du-lieu.json”, “gộp TB vào data”, “tiện ích không load dữ liệu / Failed to fetch thư mục data”, kể cả khi chỉ gửi thư mục scan TBXN+DDK mà không nói rõ là JSON. Cũng dùng khi nhờ “kiểm tra du-lieu.json / phiếu kiểm tra dữ liệu TB” trước khi nạp vào tiện ích.
---

# Tạo dữ liệu TB cho tiện ích VBDLIS Điền Nhanh

Người dùng là cán bộ nhập hồ sơ đăng ký đất đai (phường Việt Yên, TP Bắc Ninh) lên VBDLIS. Tiện ích Chrome
“VBDLIS Điền Nhanh” (thư mục `vbdlis-dien-nhanh`) điền sẵn VBDLIS từ dữ liệu TB người dùng **nạp bằng file CSV**
(bản 1.21.20, 25/11: “bỏ nạp json đi” – tiện ích không nạp JSON, không tự đọc thư mục data nữa). Skill vẫn làm việc bằng
JSON (`TB_<số>.json` → gộp `du-lieu.json`) – đó là file làm việc của Claude; thứ đưa người dùng nạp là **`du-lieu.csv`**
gop_du_lieu.py ghi kèm. Nhiệm vụ của skill: làm ra dữ liệu **đúng**, **gộp vào du-lieu.json** và ghi **du-lieu.csv**.

**Người dùng nạp bằng file CSV mở bằng Excel (chốt 25/11: “nạp exel thay json … để dễ tiền kiểm soát”, rồi “csv cơ”,
“không dùng xlsx”)**: gop_du_lieu.py ghi kèm **`du-lieu.csv`** (cùng dữ liệu; UTF-16 + dấu Tab – Excel mở thẳng, đúng
tiếng Việt; mỗi hàng một người nộp / chủ / thửa; cột **Cần xem** = cảnh báo + LỖI / CẢNH BÁO của phiếu kiểm tra; ô số dễ
bị Excel đổi ghi dạng `="…"`). Người dùng mở bằng Excel soát / sửa, lưu (giữ kiểu CSV), rồi nạp vào tiện ích (Dữ liệu →
“Mở file CSV…” hoặc kéo thả du-lieu.csv vào bảng điền → xem trước TB mới / TB đổi gì → tích chọn → “Nạp”; file luôn
đúng – TB có trong file lấy đúng theo file; nạp lại không mất tiến độ). Lần gộp sau, chỗ người dùng sửa
trong du-lieu.csv được lấy lại và ghi về `TB_<số>.json` (không bị bản cũ ghi đè). JSON vẫn là nơi skill làm việc.
Không làm / không đọc file .xlsx. Người dùng có thể **gõ nhanh** TB mới trong du-lieu.csv (tiện ích 1.21.21): ô TB trống = TB
hàng trên, Dòng gõ n / c / t hoặc để trống, TB “VD” là hàng mẫu (bỏ) – gop_du_lieu.py đọc được hết; ô để trống (nơi cấp, địa
chỉ…) tiện ích tự điền lúc nạp. Có hàng bị bỏ (thiếu TB, Dòng lạ) thì gop không ghi đè du-lieu.csv – báo người dùng sửa hàng đó.

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

**Thư mục data ra (người dùng chốt 23/11)**: `C:\Users\Hoang\Downloads\data` – ở ngoài thư mục tiện ích. Không ghi vào
`vbdlis-dien-nhanh\data` (chỉ chép đè vào đó khi người dùng bảo rõ). Người dùng hay tự chuyển / xoá thư mục này giữa các
lần làm → chưa có thì tạo lại; có TB cũ của đợt trước thì hỏi giữ hay xoá trước khi gộp.

**Chỉ giao CSV (người dùng chốt 25/11: “không cần json nữa”)**: làm việc (khung, TB_<số>.json, gộp, phiếu) trong một thư
mục làm việc ở thư mục nháp; mỗi đợt giao cho người dùng **một thư mục** trong `Downloads\data` chỉ có **`du-lieu.csv`**
(+ `phieu-kiem-tra.txt`), cả đợt một file tổng (không tách theo TDP). Không chép TB_*.json / du-lieu.json sang đó. Nạp:
bảng điền → Dữ liệu → “Mở file…” → du-lieu.csv.

## Quy trình

Các script nằm trong thư mục `scripts/` của skill này (dùng đường dẫn đầy đủ khi chạy). Cần Python có
`pypdfium2`, `Pillow`. Chạy `python` **không có `-I`** (pypdfium2 nằm ở user site-packages; với `-I` khung_tb.py báo
“? trang” và tách nhầm “TBXN KHÁC”). Đặt `PYTHONIOENCODING=utf-8` để in được tiếng Việt.

**Đợt lớn (vài chục – hơn trăm TB)**: dựng khung xong thì chia TB cho ~10 subagent chạy song song. Viết một file brief
trong thư mục nháp (quy tắc bước 2–3, đường dẫn script, thư mục nguồn, mẫu ghi chú) và giao mỗi agent một dải TB; mỗi agent
chỉ sửa `TB_<số>.json` của dải mình trong thư mục khung nháp. Xong thì tự kiểm chéo (cùng số CCCD mà khác tên giữa các
TB, chu[0] so với bảng Excel nếu có, thửa ODT đủ Lâu dài / có thu tiền), rồi mới chép sang data và gộp.

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
  - **Chủ chỉ có CMND cũ (người dùng chốt 25/11)**:
    - Chung chủ mà có người chỉ có CMND → **bỏ người có CMND**, chỉ nhập các chủ có CCCD / Căn cước.
    - TB chỉ có chủ hộ có CMND (không ai có CCCD) → nhập chủ hộ với **số `033205007296`**, loại
      `Căn cước công dân`, nơi cấp Cục Cảnh sát…; họ tên, năm sinh, giới tính vẫn theo CMND / TBXN (số mờ cũng được).
    - Khi đọc hồ sơ cứ ghi chủ CMND như thường (loại `Chứng minh nhân dân`, số 9 chữ số hoặc để trống nếu mờ) –
      gop_du_lieu.py tự áp dụng quy tắc này và ghi ghiChu; kiem_tra.py không kiểm quy tắc mã với số thay này.
- Chủ **chỉ cần Năm sinh** (không cần Ngày sinh, Ngày cấp, Ngày hết hạn).
- **Đất ở (người dùng chốt 23/11)**: mục đích `ONT`, `ONT+CLN` (hay `CLN+ONT`) → ghi **`ODT`** (phường = đô thị);
  thửa đó thời hạn **`Lâu dài`**, nguồn gốc **`Công nhận QSDĐ như giao đất có thu tiền sử dụng đất`**. gop_du_lieu.py
  tự đổi nếu lỡ ghi ONT / để mặc định nông nghiệp; tiện ích cũng tự đổi khi điền.
- **Thư mục data (người dùng chốt 23/11)**: ghi mọi file ra `C:\Users\Hoang\Downloads\data` (ngoài thư mục
  tiện ích), không ghi vào `vbdlis-dien-nhanh\data`. Báo người dùng nạp **du-lieu.csv** bằng bảng điền → Dữ liệu →
  “Mở file CSV…” (xem trước rồi “Nạp”; file luôn đúng). Tiện ích không nạp JSON nữa.
- **Không ghi chú chuyện “thư mục có N cặp PDF cùng nội dung”** (người dùng bảo xoá – người nhập không cần biết).
- Các trường hợp hay gặp (đã chốt cách làm):
  - TBXN ghi tên kèm biệt danh / số phân biệt, vd. `NGUYỄN VĂN A (PHÚC)`, `… - 2`, `NGUYỄN VĂN A (THẮM)` → nhập tên
    theo thẻ, bỏ phần kèm; ghi chú một câu.
  - Mặt sau thẻ là của người khác (MRZ ghi tên / số khác mặt trước) → chỉ lấy theo mặt trước khớp TBXN; ghi chú.
  - Số CCCD hay năm sinh trên TBXN / đơn / Mẫu 15a lệch thẻ → nhập theo thẻ (đối chiếu MRZ và quy tắc mã), ghi chú cả hai.
  - Hồ sơ không có thẻ → tên + số theo TBXN; nếu cùng người có thẻ ở TB khác trong đợt thì đối chiếu số, nơi cấp lấy theo
    thẻ đó (không có thì để trống).
  - Dấu tên trên thẻ mờ → nhập theo TBXN, ghi `Tên: thẻ CCCD mờ dấu – nhập theo TBXN (…)`.
  - Đơn có chữ viết tay “đã chuyển nhượng…”, “còn thiếu thửa / diện tích”, thêm thửa TBXN không có, “nhà ông …” →
    **chỉ nhập theo TBXN**, chép ý chữ tay vào ghi chú và đưa vào mục Cần anh/chị xem.
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

Ghi xong, script tự chạy **phiếu kiểm tra** (bước 5), rồi ghi **`du-lieu.csv`** (cột Cần xem lấy từ cảnh báo + phiếu) và
trả mã thoát 1 nếu phiếu còn LỖI. Trước khi gộp, script đọc `du-lieu.csv` đang có: TB nào người dùng đã sửa trong file
(khác bản du-lieu.json lúc ghi file CSV) thì lấy theo file CSV và ghi lại vào `TB_<số>.json` (file lẻ sửa SAU file CSV
thì file lẻ thắng). File đang mở trong Excel → script báo, chưa đọc / chưa ghi được: nhờ người dùng đóng file rồi chạy
lại. Người dùng lỡ lưu thành .xlsx → script báo, nhờ lưu lại kiểu CSV. `--nguon` (không bắt buộc)
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

- Kết quả chính trước: “Đã thêm TB 1896, 1897 vào du-lieu.json và du-lieu.csv (tổng N TB)”.
- Mỗi TB một dòng: chủ, số thửa, Số biên nhận (rút gọn nếu dài).
- Mục **Cần anh/chị xem**: danh sách TB có LỖI / CẢNH BÁO trong phiếu kiểm tra (số TB + vấn đề ngắn), cộng những điều
  đọc không chắc: số / tên khó đọc, tên thẻ khác TBXN, thửa thiếu diện tích, tờ đơn khác tờ TBXN, tên sửa tay…
- Nhắc cách nạp: data nằm ở `Downloads\data` (ngoài tiện ích) nên tiện ích **không tự đọc** → mở
  `Downloads\data\du-lieu.csv` bằng Excel soát cột **Cần xem** (sửa nếu cần, lưu giữ kiểu CSV), rồi mở bảng điền (Alt+Q) →
  Dữ liệu → **“Mở file CSV…”** (hoặc kéo thả) chọn `du-lieu.csv` → xem trước → **“Nạp”**. **File luôn đúng**: TB có trong file
  được lấy đúng theo file; nạp lại không mất tiến độ. Không cần tải lại tiện ích. Tiện ích **không nạp JSON** nữa – đừng
  bảo người dùng nạp du-lieu.json hay TB_*.json.
- Mục Cần anh/chị xem nên chia nhóm: cần quyết (thẻ người lạ, chuyển nhượng, thửa ghi tay) / người đứng tên TBXN khác chủ
  đã nhập / số CCCD lệch / tên thẻ khác TBXN / dấu mờ / không có thẻ / khác. Không chép số CCCD đầy đủ (chỉ 4–5 số cuối).

## Khi chỉ có JSON (không có PDF)

Người dùng để sẵn các file `TB_xxxx.json` (hoặc dán JSON) và tiện ích không thấy dữ liệu: tiện ích (từ 1.21.20) chỉ
nạp file CSV. Chạy bước 4 (gop_du_lieu.py) để gộp và ghi `du-lieu.csv`, nhắc người dùng nạp file đó, rồi báo các TB
còn thiếu gì (diện tích, mục đích, số giấy tờ…) để người dùng bổ sung hoặc gửi PDF cho đọc lại.

## Lưu ý

- Không xóa / ghi đè file PDF hay file JSON gốc của người dùng; chỉ ghi `TB_<số>.json` mới (không ghi đè nếu đã có,
  trừ khi người dùng bảo làm lại, hoặc người dùng đã sửa TB đó trong du-lieu.csv – gop ghi lại, bản cũ `.bak`),
  `du-lieu.json` (có bản `.bak`), `du-lieu.csv` và `phieu-kiem-tra.txt`.
- Dữ liệu có thể lệch giữa TBXN và đơn (tên sửa tay, người đã mất, tờ cũ). TBXN là căn cứ chính cho thửa (tờ, thửa,
  diện tích, mục đích…) và cho biết ai đứng tên; **họ tên, số giấy tờ, năm sinh của chủ theo thẻ CCCD** (Quy tắc tên,
  bước 3); đơn để đối chiếu.
- Nếu người dùng có bảng quy đổi tờ mã 2 cấp ↔ 3 cấp (Excel), dùng nó để đối chiếu tờ trên đơn với TBXN.
