# Mẫu dữ liệu TB cho tiện ích “VBDLIS Điền Nhanh”

Tiện ích tự đọc `…/vbdlis-dien-nhanh/data/du-lieu.json`, nhưng skill ghi ra `C:\Users\Hoang\Downloads\data` (người dùng
nạp bằng “Mở file…”). du-lieu.json là một **danh sách** các TB. Mỗi TB là một hồ sơ trên VBDLIS
(bước Tiếp nhận hồ sơ + bước Nhập đơn đăng ký). File lẻ `TB_<số>.json` chứa **một** TB (cùng cấu trúc).

## Mẫu một TB (dữ liệu giả, chỉ để xem cấu trúc)

```json
{
  "tb": "1234",
  "soBienNhan": "KH 2959.07777.241.15-241.26-250.17",
  "diaChiTaiSan": "TDP Lý Nhân, phường Việt Yên, TP Bắc Ninh",
  "nguoiNop": {
    "hoTen": "NGUYỄN VĂN A",
    "soGiayTo": "<12 chữ số trên thẻ>",
    "diaChi": "TDP Lý Nhân, phường Việt Yên, TP Bắc Ninh"
  },
  "chu": [
    {
      "hoTen": "NGUYỄN VĂN A",
      "namSinh": "1960",
      "gioiTinh": "Nam",
      "loaiGiayTo": "Căn cước công dân",
      "soGiayTo": "<12 chữ số trên thẻ>",
      "noiCap": "Cục Cảnh sát Quản lý hành chính về TTXH",
      "diaChi": "TDP Lý Nhân, phường Việt Yên, TP Bắc Ninh"
    }
  ],
  "thua": [
    { "soThua": "15", "soTo": "241", "dienTich": "224.6", "mdsd": "LUC",
      "diaChi": "TDP Lý Nhân, phường Việt Yên, TP Bắc Ninh", "thoiHan": "50 năm",
      "nguonGoc": "Công nhận QSDĐ như giao đất không thu tiền sử dụng đất" }
  ],
  "giayTo": ["Đơn đăng ký", "Thông báo xác nhận kết quả đăng ký"],
  "ghiChu": "Đơn ghi tờ cũ 11/20 – đã dùng tờ mới 241/250 theo TBXN."
}
```

## Từng trường: lấy ở đâu, ghi thế nào

| Trường | Lấy từ | Cách ghi |
|---|---|---|
| `tb` | tên thư mục `TB 1234`, đối chiếu số trên TBXN “Số: …/TB” | chuỗi: `"1234"` |
| `soBienNhan` | tên file PDF (bỏ `.TBXN.pdf`) | `KH 2959.07777.<tờ>.<thửa>-<tờ>.<thửa>…`, đúng thứ tự STT trên danh sách thửa TBXN. Thư mục có 2 cặp PDF cùng nội dung (tên bị chia vì quá dài) → nối **tất cả** tờ.thửa thành một chuỗi |
| `diaChiTaiSan` | TBXN mục 1c (địa chỉ người sử dụng đất – quy ước dùng cho mọi ô địa chỉ) | vd. `TDP Lý Nhân, phường Việt Yên, TP Bắc Ninh` (giữ cách viết của TBXN) |
| `nguoiNop.hoTen`, `.soGiayTo` | chủ thứ nhất (người đứng tên TBXN) | đúng như `chu[0]` (tên theo thẻ – xem Quy tắc tên) |
| `nguoiNop.diaChi` | TBXN mục 1c | như `diaChiTaiSan` (quy ước của người dùng: không lấy địa chỉ thường trú trên CCCD) |
| `chu[].hoTen` | **ảnh thẻ CCCD / Căn cước của chính người đó** trong DDK. Chỉ khi thẻ mờ không đọc được hoặc không có thẻ mới lấy TBXN (xem **Quy tắc tên** dưới bảng) | IN HOA, đủ dấu đúng như trên thẻ; khác TBXN thì ghi vào `ghiChu` |
| `chu[].namSinh` | CCCD (ngày sinh) | 4 chữ số. Tiện ích chỉ điền **Năm sinh** |
| `chu[].gioiTinh` | CCCD | `"Nam"` / `"Nữ"` |
| `chu[].loaiGiayTo` | loại thẻ | `"Căn cước công dân"`; thẻ mới ghi “CĂN CƯỚC” (cấp từ 1/7/2024) → `"Căn cước"`; CMND 9 số → `"Chứng minh nhân dân"` (khi gộp: chủ hộ CMND → số thay `033205007296`, loại `"Căn cước công dân"`; chung chủ → bỏ chủ CMND – xem **Ai là chủ** mục 5) |
| `chu[].soGiayTo` | mặt trước CCCD “Số/No.”, đối chiếu dòng MRZ mặt sau `IDVNM…` | 12 chữ số, không dấu cách |
| `chu[].noiCap` | mặt sau thẻ | CCCD gắn chip cấp từ 2021 thường là “Cục Cảnh sát quản lý hành chính về trật tự xã hội” → ghi `Cục Cảnh sát Quản lý hành chính về TTXH`; không đọc được → để `""` (VBDLIS có sẵn giá trị mặc định này) |
| `chu[].diaChi` | TBXN mục 1c | như `diaChiTaiSan` |
| `chu` (danh sách) | **các thẻ CCCD / Căn cước trong DDK** | mỗi thẻ một chủ, có bao nhiêu thẻ thì bấy nhiêu chủ. Chung chủ mà chỉ có thẻ của một số người → chỉ nhập người có thẻ, người còn lại ghi vào `ghiChu`. Xem **Ai là chủ** dưới bảng |
| `chu[].tuyChon` | — | không dùng cho người có thẻ (người có thẻ luôn nhập đủ). Chỉ còn trong dữ liệu cũ; tiện ích vẫn thêm mọi chủ trong danh sách |
| `thua[].soThua`, `.soTo` | danh sách thửa kèm TBXN | tờ theo **mã 2 cấp của TBXN** (đơn có thể ghi tờ cũ – không dùng tờ của đơn) |
| `thua[].dienTich` | cột diện tích của TBXN | dấu **chấm** thập phân, không đơn vị: `56,5` → `"56.5"`, `1.712,6` → `"1712.6"` |
| `thua[].mdsd` | cột mục đích của TBXN | mã: `LUC`, `LUK`, `BHK`, `NTS`, `CLN`… **Đất ở: `ONT`, `ONT+CLN`, `CLN+ONT` → ghi `ODT`** (phường là đô thị – người dùng chốt 23/11) |
| `thua[].diaChi` | TBXN mục 1c (theo quy ước); nếu cột “Địa chỉ thửa đất” của danh sách ghi nơi khác hẳn thì ghi chú để người dùng quyết | |
| `thua[].thoiHan` | cột thời hạn | đất nông nghiệp: `"50 năm"`; **đất ở (ODT): `"Lâu dài"`**; TBXN ghi rõ giá trị khác thì theo TBXN |
| `thua[].nguonGoc` | cột nguồn gốc | mặc định `Công nhận QSDĐ như giao đất không thu tiền sử dụng đất`; **đất ở (ODT): `Công nhận QSDĐ như giao đất có thu tiền sử dụng đất`** |
| `giayTo` | — | `["Đơn đăng ký", "Thông báo xác nhận kết quả đăng ký"]` |
| `ghiChu` | — | những điều người dùng cần biết khi nhập: tên thẻ khác TBXN (ghi cả hai và nguồn đã nhập), tên sửa tay, tờ cũ/mới, số đọc không chắc, địa chỉ khác nhau… Hiện ở khung vàng của bảng điền. Viết kết quả đã kiểm, không để lời nhắc “kiểm tra lại” |

Không cần: `ngayCap`, `ngayHetHan`, `ngaySinh` (tiện ích không điền các ô này). Có thì để nguyên, không sao.

## Ai là chủ – người dùng đã chốt

1. `chu` = đúng những người **có thẻ CCCD / Căn cước trong DDK**, mỗi thẻ một chủ (có bao nhiêu thẻ thì bấy nhiêu chủ).
2. Chung chủ (TBXN / đơn / Mẫu 15a ghi nhiều người) mà chỉ có thẻ của một số người → chỉ nhập người có thẻ; người không
   có thẻ không đưa vào `chu`, chỉ ghi chú (tên giả): `Sử dụng chung với NGUYỄN VĂN B (không có thẻ trong hồ sơ) – không nhập.`
3. Thứ tự theo TBXN rồi đơn / Mẫu 15a; `chu[0]` = người có thẻ đứng đầu, `nguoiNop` = `chu[0]`. Người đứng tên TBXN
   không có thẻ → ghi chú `Người đứng tên TBXN … không có thẻ – nhập chủ theo thẻ: …`.
4. Không có thẻ nào → nhập người đứng tên TBXN. Thẻ của người không có tên trong TBXN / đơn / Mẫu 15a → không tự thêm, báo người dùng.
5. **CMND cũ (chốt 25/11)**: chung chủ mà có chủ chỉ có CMND → bỏ chủ CMND. Chỉ có chủ hộ có CMND → nhập chủ hộ với số
   CCCD thay `033205007296`, loại `Căn cước công dân`, nơi cấp `Cục Cảnh sát Quản lý hành chính về TTXH`; năm sinh /
   giới tính theo CMND. `gop_du_lieu.py` tự làm việc này (nhận chủ CMND qua loại `Chứng minh nhân dân` hoặc số 9 chữ số).

## Quy tắc tên (họ tên chủ) – người dùng đã chốt

1. `chu[].hoTen` = họ tên **in trên thẻ CCCD / Căn cước của chính người đó** (ảnh thẻ trong DDK), IN HOA, đủ dấu như thẻ.
   `nguoiNop.hoTen` = `chu[0].hoTen`.
2. **Chỉ khi** thẻ mờ không đọc được tên, hoặc hồ sơ không có thẻ, mới lấy tên trên TBXN.
3. Tên thẻ khác tên TBXN (khác dấu, khác chữ đệm, khác một chữ) → vẫn nhập theo thẻ; `ghiChu` ghi rõ khác ở đâu và đã
   nhập theo nguồn nào. Mẫu (tên giả):
   - `Tên: TBXN ghi LÊ VĂN AN, thẻ CCCD ghi LÊ VĂN ÂN – nhập theo CCCD.`
   - `Tên: thẻ CCCD mờ – nhập theo TBXN (LÊ VĂN AN).`
   - `Tên: hồ sơ không có thẻ – nhập theo TBXN.`
4. “Thẻ của chính người đó” = số thẻ khớp số trên TBXN / đơn / Mẫu 15a, hoặc cùng năm sinh và tên chỉ lệch dấu / chữ
   đệm. Thẻ của người khác (vd. con nộp thay bố mẹ) thì không đổi chủ theo thẻ – ghi chú và báo người dùng.

Phiếu kiểm tra (`scripts/kiem_tra.py`) cảnh báo khi `ghiChu` nói “thẻ … ghi <TÊN>” mà tên đó khác `hoTen` (trừ khi câu
đó nói thẻ mờ / không có thẻ) – nên viết ghi chú theo đúng các mẫu trên.

## Kiểm tra số CCCD

Số CCCD 12 chữ số: 3 số đầu = mã tỉnh nơi đăng ký khai sinh (vd. Bắc Giang 024, Bắc Ninh 027), số thứ 4 = giới tính
và thế kỷ (0 nam / 1 nữ sinh 19xx, 2 nam / 3 nữ sinh 20xx), số 5–6 = hai số cuối năm sinh.
Vd số bắt đầu bằng `027 1 62…` → mã tỉnh 027, chữ số thứ 4 là 1 → nữ, sinh 1962. Năm sinh / giới tính đọc trên thẻ
phải khớp quy tắc này; không khớp nghĩa là đọc nhầm một chữ số → đọc lại (phóng to, đối chiếu dòng MRZ mặt sau).
CMND cũ 9 chữ số không có quy tắc này (phiếu kiểm tra chấp nhận, loại giấy tờ ghi `Chứng minh nhân dân`).
