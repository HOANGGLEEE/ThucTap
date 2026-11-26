#!/usr/bin/env python3
"""Phiếu kiểm tra dữ liệu TB của tiện ích “VBDLIS Điền Nhanh” – CHỈ ĐỌC, không sửa dữ liệu.

Chạy SAU khi đã làm JSON / gộp du-lieu.json, TRƯỚC khi nạp du-lieu.csv vào tiện ích:

  python kiem_tra.py "<thư mục data>" ["<thư mục nguồn chứa các thư mục TB xxxx>"]

In phiếu tiếng Việt chia 3 mục LỖI / CẢNH BÁO / GHI CHÚ theo số TB và ghi ra <data>/phieu-kiem-tra.txt.
Mã thoát: 1 nếu có LỖI, 0 nếu không có LỖI, 2 nếu sai tham số. Số giấy tờ trong phiếu được che (vd. 027******001).
gop_du_lieu.py tự chạy phiếu này sau khi ghi du-lieu.json.

LỖI (phải sửa trước khi nạp):
  - JSON hỏng; thiếu trường bắt buộc: tb, soBienNhan, nguoiNop.hoTen, chu[].hoTen/namSinh/gioiTinh/soGiayTo,
    thua[].soThua/soTo/dienTich/mdsd (chủ "tuyChon" – người dùng chung – thiếu thì chỉ CẢNH BÁO);
  - TB trùng số; file lẻ TB_*.json chưa gộp hoặc khác bản trong du-lieu.json;
  - Số biên nhận khác "KH 2959.07777." + các "<tờ>.<thửa>" nối bằng "-" (đủ thửa, đúng thứ tự trong "thua");
  - số CCCD sai quy tắc mã (12 số; số thứ 4: 0 nam 19xx, 1 nữ 19xx, 2 nam 20xx, 3 nữ 20xx; số 5–6 = 2 số cuối
    năm sinh) so với năm sinh / giới tính; sai độ dài (CCCD 12 số, CMND 9 số được chấp nhận);
    một số giấy tờ mà nhiều tên;
  - diện tích không phải số / viết dấu phẩy; mục đích không phải mã; người nộp khác chủ thứ nhất;
  - có thư mục nguồn: tờ.thửa trong tên PDF mà JSON thiếu / JSON thừa, thư mục chưa có JSON, thiếu file TBXN.
CẢNH BÁO (xem lại): cùng tờ/thửa ở 2 TB, TB trùng toàn bộ thửa, thứ tự thửa khác tên file, thiếu file DDK,
  JSON không có thư mục nguồn, quy tắc tên (ghi chú nói thẻ CCCD ghi tên khác tên đang nhập), ghi chú còn việc
  chưa xong ("kiểm tra lại", "cần hỏi lại"…), mã tỉnh lạ, cùng tên + năm sinh mà số lệch vài chữ số,
  thiếu địa chỉ / thời hạn / nguồn gốc…
GHI CHÚ: mọi ghiChu khác rỗng (người nhập đọc trước khi nhập).
"""
import argparse
import copy
import datetime
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from itertools import combinations, permutations

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # không tạo __pycache__ trong thư mục skill
try:
    import gop_du_lieu as gop  # dùng chung cách đọc JSON dễ dãi + chuẩn hóa của bước gộp
except Exception:  # thiếu file gop_du_lieu.py → vẫn kiểm tra được, chỉ so sánh thô
    gop = None

PREFIX = 'KH 2959.07777.'
OUT = 'du-lieu.json'
PHIEU = 'phieu-kiem-tra.txt'
LOI, CANH, GHI = 'LỖI', 'CẢNH BÁO', 'GHI CHÚ'
LAST_PHIEU = None
NAM_NAY = datetime.date.today().year

RE_FILE = re.compile(r'^KH\s*2959\.07777\.(.+?)\.(TBXN|DDK)\.pdf$', re.I)
RE_PAIR = re.compile(r'^(\d+)\.(\d+[A-Za-z]?)$')
RE_TB_DIR = re.compile(r'^\s*TB\s*[_\- ]?\s*(\d{2,6})(?!\d)', re.I)
RE_TB_FILE = re.compile(r'^TB[_\- ]?(\d+(?:-\d+)?)\.json$', re.I)

# mã tỉnh (3 số đầu CCCD – nơi đăng ký khai sinh), 63 tỉnh/thành theo danh mục cũ
MA_TINH = set('001 002 004 006 008 010 011 012 014 015 017 019 020 022 024 025 026 027 030 031 033 034 035 036 '
              '037 038 040 042 044 045 046 048 049 051 052 054 056 058 060 062 064 066 067 068 070 072 074 075 '
              '077 079 080 082 083 084 086 087 089 091 092 093 094 095 096'.split())
SO_THAY_CMND = '033205007296'  # số CCCD thay cho chủ hộ chỉ có CMND (người dùng chốt 25/11), xem gop_du_lieu.py
LOAI_GT = ('Căn cước công dân', 'Căn cước', 'Chứng minh nhân dân')


def _chu_hoa_vn():
    out = set('ABCDEFGHIJKLMNOPQRSTUVWXYZĐĂÂÊÔƠƯ')
    for v in 'AĂÂEÊIOÔƠUƯY':
        for dau in ('̀', '́', '̉', '̃', '̣'):
            out.add(unicodedata.normalize('NFC', v + dau))
    return ''.join(sorted(out))


UP = _chu_hoa_vn()
# "thẻ CCCD ghi NGUYỄN VĂN A", "đơn, Mẫu 15a và thẻ CCCD đều ghi “NGUYỄN VĂN A”"… (tên IN HOA 2–6 chữ)
RE_THE_GHI = re.compile(r'(?i:thẻ|cccd|căn cước)[^.;–—\n]*?\bghi\s*:?\s*["“”«]?([' + UP + r']+(?:[ \t]+[' + UP + r']+){1,5})')
KHONG_PHAI_TEN = {'CCCD', 'CMND', 'TBXN', 'DDK', 'MRZ', 'CĂN', 'CƯỚC', 'CC'}
RE_MO = re.compile(r'mờ|không đọc|không rõ|không có thẻ|thiếu thẻ', re.I)
RE_VIEC_DO = re.compile(r'kiểm tra (?:lại|trước)|cần (?:xác định|hỏi lại|kiểm tra|xem lại)'
                        r'|chưa (?:rõ|đọc được|xác định|điền)', re.I)


# ---------------- tiện ích ----------------
def s(v):
    return unicodedata.normalize('NFC', str(v)).strip() if v is not None else ''


def ten(v):
    return re.sub(r'\s+', ' ', s(v)).upper()


def chu_so(v):
    return re.sub(r'\D', '', s(v))


def bo0(v):
    return re.sub(r'^0+(?=\d)', '', v)


def bo_dau(t):
    t = unicodedata.normalize('NFD', t)
    return ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn').replace('Đ', 'D').replace('đ', 'd')


def gan_giong(a, b):
    """Hai họ tên gần giống: chỉ khác dấu, hoặc khác đúng một chữ (cùng số chữ)."""
    wa, wb = a.split(), b.split()
    if len(wa) != len(wb) or not wa:
        return False
    return bo_dau(a) == bo_dau(b) or sum(x == y for x, y in zip(wa, wb)) >= len(wa) - 1


def tb_key(tb):
    if tb == '':
        return (0, 0, '')
    m = re.match(r'^(\d+)(.*)$', tb)
    return (1, int(m.group(1)), m.group(2)) if m else (2, 0, tb)


def so_key(v):
    m = re.match(r'^(\d+)(.*)$', v)
    return (int(m.group(1)), m.group(2)) if m else (10 ** 9, v)


def goc_tb(tb):
    m = re.match(r'^(\d+)', tb)
    return m.group(1) if m else tb


def liet_ke(xs, n=8):
    xs = list(xs)
    return ', '.join(xs[:n]) + (f' … (+{len(xs) - n})' if len(xs) > n else '')


def _che_so(d):
    return d[:3] + '*' * (len(d) - 6) + d[-3:] if len(d) >= 9 else d[:2] + '*' * (len(d) - 4) + d[-2:]


def che(text):
    """Che số giấy tờ trong mọi dòng của phiếu: giữ 3 số đầu + 3 số cuối, phần giữa thành dấu *."""
    text = re.sub(r'(?<!\d)\d{3}(?: \d{3}){2,3}(?!\d)', lambda m: _che_so(m.group(0).replace(' ', '')), text)
    return re.sub(r'\d{7,}', lambda m: _che_so(m.group(0)), text)


def ds_dict(v):
    return [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []


class Phieu:
    def __init__(self):
        self.muc = {LOI: {}, CANH: {}, GHI: {}}

    def add(self, level, tb, msg):
        lst = self.muc[level].setdefault(tb, [])
        if msg not in lst:
            lst.append(msg)

    def loi(self, tb, msg):
        self.add(LOI, tb, msg)

    def canh(self, tb, msg):
        self.add(CANH, tb, msg)

    def ghi(self, tb, msg):
        self.add(GHI, tb, msg)

    def dem(self, level):
        return sum(len(v) for v in self.muc[level].values())

    def tbs(self, level):
        return sorted((t for t in self.muc[level] if t), key=tb_key)


# ---------------- đọc dữ liệu ----------------
def doc_json(path):
    """→ (dữ liệu, None) JSON chuẩn; (dữ liệu, mô tả) chỉ đọc được kiểu dễ dãi; (None, lỗi) hỏng."""
    try:
        raw = open(path, 'rb').read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return None, 'không phải văn bản UTF-8'
    except OSError as e:
        return None, f'không mở được ({e.strerror})'
    if not raw.strip():
        return None, 'file rỗng'
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        msg = f'JSON sai ở dòng {e.lineno}, cột {e.colno}'
    if gop:
        try:
            j, fixes = gop.load_loose(path)
            return j, msg + (' (gop_du_lieu.py tự sửa được: ' + '; '.join(fixes) + ')' if fixes else '')
        except Exception as e2:
            return None, str(e2)
    return None, msg


def lay_ds(j):
    if isinstance(j, list):
        return j
    if isinstance(j, dict):
        for k in ('tb', 'data'):
            if isinstance(j.get(k), list):
                return j[k]
        return [j]
    return None


def chuan_hoa(x):
    if gop is None:
        return x
    try:
        return gop.normalize(copy.deepcopy(x), [], [])
    except Exception:
        return x


def cho_khac(a, b, path=''):
    """Danh sách (đường dẫn trường, giá trị a, giá trị b) khác nhau giữa 2 TB."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b), key=str):
            if a.get(k) != b.get(k):
                out += cho_khac(a.get(k), b.get(k), f'{path}.{k}' if path else str(k))
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [(f'{path} ({len(a)} ↔ {len(b)} mục)', None, None)]
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                out += cho_khac(x, y, f'{path}[{i}]')
        return out
    return [(path or '(toàn bộ)', a, b)]


def doc_data(data, P):
    """Đọc du-lieu.json và các file lẻ. Trả (TB → bản dùng để kiểm tra, thống kê)."""
    out_path = os.path.join(data, OUT)
    dl, dl_ok = defaultdict(list), False
    if os.path.exists(out_path):
        j, msg = doc_json(out_path)
        items = lay_ds(j) if j is not None else None
        if j is None:
            P.loi('', f'{OUT}: {msg} – tiện ích không đọc được file này')
        elif items is None:
            P.loi('', f'{OUT}: không phải danh sách TB')
        else:
            dl_ok = True
            if msg:
                P.loi('', f'{OUT}: không phải JSON chuẩn – {msg}; chạy lại gop_du_lieu.py')
            for k, x in enumerate(items, 1):
                if not isinstance(x, dict) or not s(x.get('tb')):
                    P.loi('', f'{OUT}: mục thứ {k} thiếu "tb" (số thông báo)')
                    continue
                dl[s(x['tb'])].append(x)
    else:
        P.loi('', f'chưa có {OUT} – tiện ích chưa thấy dữ liệu; chạy gop_du_lieu.py')

    le = defaultdict(list)  # TB → [(tên file, TB, thời điểm sửa)]
    n_file = 0
    for f in sorted(os.listdir(data)):
        path = os.path.join(data, f)
        if not f.lower().endswith('.json') or f.lower() == OUT or not os.path.isfile(path):
            continue
        n_file += 1
        j, msg = doc_json(path)
        items = lay_ds(j) if j is not None else None
        if j is None or items is None:
            P.loi('', f'{f}: {msg or "không phải dữ liệu TB"} – không gộp được')
            continue
        if msg:
            P.canh('', f'{f}: không phải JSON chuẩn – {msg}')
        mt = os.path.getmtime(path)
        m = RE_TB_FILE.match(f)
        for k, x in enumerate(items, 1):
            if not isinstance(x, dict) or not s(x.get('tb')):
                P.loi('', f'{f}: mục thứ {k} thiếu "tb" (số thông báo)')
                continue
            tb = s(x['tb'])
            if m and len(items) == 1 and tb != m.group(1):
                P.loi(tb, f'file {f} nhưng trong file là TB {tb} – đổi tên file hoặc sửa "tb"')
            le[tb].append((f, x, mt))

    dl_mtime = os.path.getmtime(out_path) if dl_ok else 0
    eff, chua_gop = {}, set()
    for tb in sorted(set(dl) | set(le), key=tb_key):
        if len(dl.get(tb, [])) > 1:
            P.loi(tb, f'TB trùng số: {len(dl[tb])} mục cùng số TB trong {OUT}')
        files = sorted(le.get(tb, []), key=lambda r: r[2])
        if len(files) > 1:
            same = all(chuan_hoa(r[1]) == chuan_hoa(files[0][1]) for r in files[1:])
            P.add(CANH if same else LOI, tb, f'TB trùng số ở {len(files)} file lẻ: {", ".join(r[0] for r in files)}'
                  + (' (cùng nội dung)' if same else f' – khác nội dung; gop_du_lieu.py lấy file sửa sau cùng ({files[-1][0]})'))
        if tb in dl:
            eff[tb] = dl[tb][-1]
            if files:
                f, x, mt = files[-1]
                a, b = chuan_hoa(x), chuan_hoa(dl[tb][-1])
                if a != b:
                    diffs = cho_khac(a, b)
                    show = []
                    for p, va, vb in diffs[:4]:
                        if va is None and vb is None or isinstance(va, (dict, list)) or isinstance(vb, (dict, list)):
                            show.append(p)
                        else:
                            show.append(f'{p}: file “{s(va)[:40]}” / {OUT} “{s(vb)[:40]}”')
                    hint = ('file lẻ sửa sau – chạy lại gop_du_lieu.py' if mt > dl_mtime
                            else f'{OUT} sửa sau file lẻ – thống nhất lại 2 bản')
                    P.loi(tb, f'{f} khác bản trong {OUT} ({hint}); khác ở: ' + '; '.join(show)
                          + (f' … (+{len(diffs) - 4})' if len(diffs) > 4 else ''))
        else:
            eff[tb] = files[-1][1]
            if dl_ok:
                chua_gop.add(tb)
    stat = {'dl': sum(len(v) for v in dl.values()) if dl_ok else None, 'le': n_file, 'chua_gop': chua_gop}
    return eff, stat


# ---------------- kiểm tra từng TB ----------------
def la_khung(x):
    """TB mới là khung (khung_tb.py): chưa có tên / số giấy tờ chủ nào, chưa thửa nào có diện tích / mục đích."""
    if not isinstance(x, dict):
        return False
    chu, thua = ds_dict(x.get('chu')), ds_dict(x.get('thua'))
    return bool(thua) and all(not s(c.get('hoTen')) and not s(c.get('soGiayTo')) for c in chu) \
        and all(not s(t.get('dienTich')) and not s(t.get('mdsd')) for t in thua)


def kiem_dien_tich(v):
    """→ (lỗi, cảnh báo)"""
    if isinstance(v, bool):
        return f'diện tích “{v}” không phải số', None
    if isinstance(v, (int, float)):
        return (None, None) if v > 0 else (f'diện tích {v} phải lớn hơn 0', None)
    t = s(v)
    if re.fullmatch(r'\d+(\.\d+)?', t):
        if float(t) <= 0:
            return f'diện tích “{t}” phải lớn hơn 0', None
        if re.fullmatch(r'\d+\.\d{3,}', t):
            return None, f'diện tích “{t}” có 3 chữ số sau dấu chấm – dấu chấm hàng nghìn? (phải là dấu chấm thập phân)'
        return None, None
    if re.fullmatch(r'\d+,\d+', t):
        return f'diện tích “{t}” viết dấu phẩy – phải là “{t.replace(",", ".")}”', None
    return f'diện tích “{t}” không phải số (dạng đúng: 56.5)', None


def kiem_so_giay_to(tb, c, lab, P):
    so_raw = s(c.get('soGiayTo'))
    if not so_raw:
        return
    so = chu_so(so_raw)
    if so != so_raw:
        P.loi(tb, f'{lab}: số giấy tờ có ký tự không phải chữ số')
    loai = s(c.get('loaiGiayTo'))
    if so == SO_THAY_CMND:  # số CCCD thay cho chủ chỉ có CMND (người dùng chốt 25/11) – không kiểm quy tắc mã
        return
    if len(so) == 12:
        if loai == 'Chứng minh nhân dân':
            P.canh(tb, f'{lab}: số 12 chữ số nhưng loại giấy tờ ghi CMND')
        if so[:3] not in MA_TINH:
            P.canh(tb, f'{lab}: 3 số đầu “{so[:3]}” không phải mã tỉnh – có thể đọc nhầm số CCCD')
        g = int(so[3])
        if g > 3:
            P.loi(tb, f'{lab}: số CCCD có chữ số thứ 4 là {g} (chỉ có 0–3) – đọc lại số trên thẻ')
            return
        nam = (1900 if g < 2 else 2000) + int(so[4:6])
        gt = 'Nam' if g % 2 == 0 else 'Nữ'
        ns, gts = s(c.get('namSinh')), s(c.get('gioiTinh'))
        if re.fullmatch(r'\d{4}', ns) and int(ns) != nam:
            P.loi(tb, f'{lab}: năm sinh {ns} nhưng số CCCD cho năm {nam} (chữ số 4–6 “{so[3:6]}”) – đọc lại số hoặc năm sinh')
        if gts in ('Nam', 'Nữ') and gts != gt:
            P.loi(tb, f'{lab}: giới tính {gts} nhưng số CCCD (chữ số thứ 4 = {g}) là {gt} – đọc lại')
    elif len(so) == 9:
        if loai and loai != 'Chứng minh nhân dân':
            P.canh(tb, f'{lab}: số 9 chữ số (CMND) nhưng loại giấy tờ ghi “{loai}”')
    else:
        P.loi(tb, f'{lab}: số giấy tờ có {len(so)} chữ số (CCCD 12, CMND 9)')


def kiem_quy_tac_ten(tb, gc, chu, P):
    """Quy tắc tên: hoTen theo thẻ CCCD. Ghi chú nói 'thẻ … ghi <TÊN>' mà TÊN gần giống nhưng khác tên đang nhập."""
    names = [ten(c.get('hoTen')) for c in chu if s(c.get('hoTen'))]
    for m in RE_THE_GHI.finditer(gc):
        words = m.group(1).split()
        while words and words[-1] in KHONG_PHAI_TEN:
            words.pop()
        while words and words[0] in KHONG_PHAI_TEN:
            words.pop(0)
        if len(words) < 2:
            continue
        the = ' '.join(words)
        if the in names:
            continue
        giong = [n for n in names if gan_giong(n, the)]
        if not giong:
            continue  # tên của người khác, không phải chủ đang nhập
        a = max(gc.rfind(ch, 0, m.start()) for ch in '.;\n') + 1
        ends = [i for i in (gc.find(ch, m.end()) for ch in '.;\n') if i >= 0]
        if RE_MO.search(gc[a:min(ends) if ends else len(gc)]):
            continue  # thẻ mờ / không đọc được → được nhập theo TBXN
        P.canh(tb, f'quy tắc tên: ghi chú nói thẻ CCCD ghi “{the}” nhưng đang nhập “{giong[0]}” – tên phải theo thẻ '
                   f'(chỉ theo TBXN khi thẻ mờ / không có thẻ); sửa hoTen (và người nộp) rồi viết lại ghi chú')


def kiem_tb(tb, x, P):
    if not isinstance(x, dict):
        P.loi(tb, 'mục dữ liệu không phải một TB {…}')
        return
    if not re.fullmatch(r'\d{1,6}(-\d{1,3})?', tb):
        P.canh(tb, f'số TB “{tb}” lạ (thường chỉ là số, vd. 1527)')

    # --- thửa ---
    thua_raw = x.get('thua')
    thua = ds_dict(thua_raw)
    if not thua:
        P.loi(tb, 'chưa có thửa nào ("thua")')
    elif len(thua) != len(thua_raw):
        P.loi(tb, 'danh sách thửa có mục không phải {…}')
    pairs, seen = [], {}
    thieu = defaultdict(list)
    for i, t in enumerate(thua, 1):
        so, to = s(t.get('soThua')), s(t.get('soTo'))
        nhan = f'thửa {so or "?"} tờ {to or "?"}'
        pairs.append(f'{to}.{so}' if so and to else None)
        for k in ('soThua', 'soTo'):
            v = s(t.get(k))
            if not v:
                thieu[k].append(f'thửa thứ {i}')
            elif not re.fullmatch(r'\d+[A-Za-z]?', v):
                P.loi(tb, f'{nhan}: {"số thửa" if k == "soThua" else "số tờ"} “{v}” không phải số')
        if so and to:
            key = (bo0(to), bo0(so))
            if key in seen:
                P.loi(tb, f'{nhan} lặp 2 lần trong danh sách thửa (thứ {seen[key]} và {i})')
            else:
                seen[key] = i
        for k in ('dienTich', 'dienTichPL'):
            v = t.get(k)
            if v is None or s(v) == '':
                if k == 'dienTich':
                    thieu[k].append(nhan)
                continue
            err, warn = kiem_dien_tich(v)
            if err:
                P.loi(tb, f'{nhan}: {err}')
            if warn:
                P.canh(tb, f'{nhan}: {warn}')
        md = s(t.get('mdsd'))
        if not md:
            thieu['mdsd'].append(nhan)
        elif not re.fullmatch(r'[A-Z]{2,4}', md):
            if re.fullmatch(r'[A-Z]{2,4}(?:\s*[+,;/]\s*[A-Z]{2,4})+', md):
                P.canh(tb, f'{nhan}: mục đích “{md}” có nhiều mã – xem VBDLIS chọn thế nào')
            else:
                P.loi(tb, f'{nhan}: mục đích “{md}” phải là mã (LUC, LUK, BHK, NTS…)')
        for k in ('thoiHan', 'nguonGoc', 'diaChi'):
            if not s(t.get(k)):
                thieu[k].append(nhan)
    lab = {'soThua': 'số thửa', 'soTo': 'số tờ', 'dienTich': 'diện tích', 'mdsd': 'mục đích sử dụng (mdsd)',
           'thoiHan': 'thời hạn', 'nguonGoc': 'nguồn gốc', 'diaChi': 'địa chỉ thửa'}
    for k in ('soThua', 'soTo', 'dienTich', 'mdsd'):
        if thieu[k]:
            P.loi(tb, f'thiếu {lab[k]}: {liet_ke(thieu[k])}')
    for k in ('thoiHan', 'nguonGoc', 'diaChi'):
        if thieu[k]:
            P.canh(tb, f'thiếu {lab[k]}: {liet_ke(thieu[k])}')

    # --- Số biên nhận ---
    sbn = x.get('soBienNhan')
    sbn_s = s(sbn)
    if not sbn_s:
        P.loi(tb, 'thiếu Số biên nhận (soBienNhan)')
    elif thua and None not in pairs:
        dung = PREFIX + '-'.join(pairs)
        if sbn != dung:
            m = re.match(r'^KH\s*2959\s*\.\s*07777\s*\.(.*)$', sbn_s)
            if not m:
                P.loi(tb, f'Số biên nhận “{sbn_s}” không bắt đầu bằng “{PREFIX}”')
            else:
                got = [p.strip() for p in m.group(1).split('-') if p.strip()]
                if got == pairs:
                    P.loi(tb, f'Số biên nhận viết sai khoảng trắng – phải đúng “{dung}”')
                elif sorted(got) == sorted(pairs):
                    P.loi(tb, 'Số biên nhận đủ thửa nhưng khác thứ tự danh sách thửa (thứ tự theo STT trên TBXN – '
                              'sắp lại "thua" hoặc Số biên nhận)')
                else:
                    du = [p for p in got if p not in pairs]
                    thieu_ = [p for p in pairs if p not in got]
                    P.loi(tb, 'Số biên nhận không khớp danh sách thửa'
                          + (f' – Số biên nhận có mà danh sách không có: {liet_ke(du)}' if du else '')
                          + (f' – danh sách có mà Số biên nhận không có: {liet_ke(thieu_)}' if thieu_ else '')
                          + ('' if du or thieu_ else ' – có tờ.thửa lặp'))

    # --- chủ sử dụng ---
    chu_raw = x.get('chu')
    chu = ds_dict(chu_raw)
    if not chu:
        P.loi(tb, 'chưa có chủ sử dụng ("chu")')
    elif len(chu) != len(chu_raw):
        P.loi(tb, 'danh sách chủ có mục không phải {…}')
    ids = {}
    for k, c in enumerate(chu, 1):
        tuy = bool(c.get('tuyChon'))
        ht = ten(c.get('hoTen'))
        nhan = f'chủ {k}' + (f' {ht}' if ht else '') + (' (dùng chung)' if tuy else '')
        thieu_c = [v for f_, v in (('hoTen', 'họ tên'), ('namSinh', 'năm sinh'), ('gioiTinh', 'giới tính'),
                                   ('soGiayTo', 'số giấy tờ')) if not s(c.get(f_))]
        if thieu_c:
            P.add(CANH if tuy else LOI, tb, f'{nhan}: thiếu {", ".join(thieu_c)}')
        if ht:
            if s(c.get('hoTen')) != s(c.get('hoTen')).upper():
                P.canh(tb, f'{nhan}: họ tên chưa IN HOA như trên thẻ')
            if re.search(r'[\d@#/\\()]', ht):
                P.loi(tb, f'{nhan}: họ tên có ký tự lạ')
            if ht.split()[0] == 'NGUYÊN':
                P.canh(tb, f'{nhan}: họ “NGUYÊN” – thường là NGUYỄN đọc sai dấu, xem lại thẻ')
        ns = s(c.get('namSinh'))
        if ns and not (re.fullmatch(r'\d{4}', ns) and 1900 <= int(ns) <= NAM_NAY):
            P.loi(tb, f'{nhan}: năm sinh “{ns}” không hợp lệ (4 chữ số)')
        gt = s(c.get('gioiTinh'))
        if gt and gt not in ('Nam', 'Nữ'):
            P.loi(tb, f'{nhan}: giới tính “{gt}” phải là Nam hoặc Nữ')
        loai = s(c.get('loaiGiayTo'))
        if loai and loai not in LOAI_GT:
            P.canh(tb, f'{nhan}: loại giấy tờ “{loai}” lạ (Căn cước công dân / Căn cước / Chứng minh nhân dân)')
        kiem_so_giay_to(tb, c, nhan, P)
        so = chu_so(c.get('soGiayTo'))
        if so:
            if so in ids:
                P.loi(tb, f'{nhan}: trùng số giấy tờ với chủ {ids[so]}')
            ids.setdefault(so, k)
        if not s(c.get('diaChi')):
            P.canh(tb, f'{nhan}: thiếu địa chỉ')

    # --- người nộp = chủ thứ nhất ---
    nn = x.get('nguoiNop')
    if not isinstance(nn, dict):
        P.loi(tb, 'thiếu người nộp hồ sơ ("nguoiNop")')
        nn = {}
    elif not s(nn.get('hoTen')):
        P.loi(tb, 'thiếu họ tên người nộp (nguoiNop.hoTen)')
    first = next((c for c in chu if not c.get('tuyChon')), chu[0] if chu else {})
    if nn and s(nn.get('hoTen')) and s(first.get('hoTen')) and ten(nn.get('hoTen')) != ten(first.get('hoTen')):
        P.loi(tb, f'người nộp “{ten(nn.get("hoTen"))}” khác chủ thứ nhất “{ten(first.get("hoTen"))}” '
                  f'(người nộp = chủ thứ nhất, tên theo thẻ CCCD)')
    nso, fso = chu_so(nn.get('soGiayTo')), chu_so(first.get('soGiayTo'))
    if nso and fso and nso != fso:
        P.loi(tb, f'số giấy tờ người nộp {nso} khác số của chủ thứ nhất {fso}')
    elif nn and not nso and fso:
        P.canh(tb, 'thiếu số giấy tờ người nộp (nguoiNop.soGiayTo)')
    if nn and not s(nn.get('diaChi')):
        P.canh(tb, 'thiếu địa chỉ người nộp')
    if not s(x.get('diaChiTaiSan')):
        P.canh(tb, 'thiếu địa chỉ tài sản (diaChiTaiSan)')

    # --- ghi chú ---
    gc = s(x.get('ghiChu'))
    if gc:
        P.ghi(tb, gc)
        kiem_quy_tac_ten(tb, gc, chu, P)
        m = RE_VIEC_DO.search(gc)
        if m:
            P.canh(tb, f'ghi chú còn việc chưa xong (“{m.group(0)}”) – xử lý xong thì viết lại ghi chú cho đúng kết quả')


# ---------------- đối chiếu giữa các TB ----------------
def kiem_cheo(eff, P):
    by_id = defaultdict(list)  # số giấy tờ → [(TB, tên, năm sinh)]
    for tb, x in eff.items():
        if not isinstance(x, dict):
            continue
        for c in ds_dict(x.get('chu')):
            so = chu_so(c.get('soGiayTo'))
            if len(so) in (9, 12) and so != SO_THAY_CMND:
                by_id[so].append((tb, ten(c.get('hoTen')), s(c.get('namSinh'))))
    def gom(rows, idx, mine):
        """'GIÁ TRỊ (TB a, b); GIÁ TRỊ 2 (TB c)' cho các giá trị khác 'mine'."""
        g = defaultdict(set)
        for r in rows:
            if r[idx] and r[idx] != mine:
                g[r[idx]].add(r[0])
        return '; '.join(f'{v} (TB {", ".join(sorted(t, key=tb_key))})' for v, t in sorted(g.items()))

    for so, rows in by_id.items():
        if len({r[1] for r in rows if r[1]}) > 1:
            for tb, nm, _ in rows:
                P.loi(tb, f'số giấy tờ {so} của {nm or "?"} cũng có ở {gom(rows, 1, nm)} – một số mà nhiều tên')
        if len({r[2] for r in rows if r[2]}) > 1:
            for tb, nm, ns in rows:
                P.loi(tb, f'số giấy tờ {so} ({nm}) năm sinh {ns or "?"} nhưng nơi khác ghi {gom(rows, 2, ns)}')
    by_name = defaultdict(set)
    for so, rows in by_id.items():
        for tb, nm, ns in rows:
            if nm and ns:
                by_name[(nm, ns)].add(so)
    for (nm, ns), sos in by_name.items():
        for a, b in combinations(sorted(sos), 2):
            if len(a) == len(b) == 12:
                d = sum(p != q for p, q in zip(a, b))
                if d <= 3:
                    ta = sorted({r[0] for r in by_id[a]}, key=tb_key)
                    tbb = sorted({r[0] for r in by_id[b]}, key=tb_key)
                    for tb in ta + tbb:
                        P.canh(tb, f'{nm} ({ns}): TB {", ".join(ta)} ghi số {a}, TB {", ".join(tbb)} ghi số {b} '
                                   f'(lệch {d} chữ số) – cùng một người thì có một số đọc nhầm')

    def keys(x):
        return frozenset((bo0(s(t.get('soTo'))), bo0(s(t.get('soThua')))) for t in ds_dict(x.get('thua'))
                         if s(t.get('soTo')) and s(t.get('soThua')))

    def chu_cua(x):
        ch = ds_dict(x.get('chu'))
        return {chu_so(c.get('soGiayTo')) for c in ch if chu_so(c.get('soGiayTo'))}, \
               {ten(c.get('hoTen')) for c in ch if s(c.get('hoTen'))}

    def da_neu(tb, other):
        return bool(re.search(r'(?<!\d)' + re.escape(other) + r'(?!\d)', s(eff[tb].get('ghiChu'))))

    eff = {tb: x for tb, x in eff.items() if isinstance(x, dict)}
    sig = defaultdict(list)
    for tb, x in eff.items():
        k = keys(x)
        if k:
            sig[k].append(tb)
    whole = set()
    for k, tbs in sig.items():
        if len(tbs) < 2:
            continue
        for tb in tbs:
            for o in tbs:
                if o == tb:
                    continue
                (ia, na), (ib, nb) = chu_cua(eff[tb]), chu_cua(eff[o])
                cung = bool(ia & ib or na & nb)
                P.canh(tb, f'trùng toàn bộ thửa với TB {o} ({len(k)} thửa, {"cùng chủ" if cung else "khác chủ"})'
                           + (' – ghi chú đã nêu' if da_neu(tb, o) else '') + ' – xác định nhập TB nào')
        for a, b in combinations(tbs, 2):
            whole.add(frozenset((a, b)))
    by_parcel = defaultdict(set)
    for tb, x in eff.items():
        for to, so in keys(x):
            by_parcel[(to, so)].add(tb)
    shared = defaultdict(lambda: defaultdict(list))  # TB → (các TB khác) → [thửa]
    for (to, so), tbs in sorted(by_parcel.items(), key=lambda kv: (so_key(kv[0][0]), so_key(kv[0][1]))):
        for a in tbs:
            others = tuple(sorted((b for b in tbs if b != a and frozenset((a, b)) not in whole), key=tb_key))
            if others:
                shared[a][others].append(f'{so} tờ {to}')
    for a in sorted(shared, key=tb_key):
        for others, lst in shared[a].items():
            P.canh(a, f'thửa {liet_ke(lst)} cũng có ở TB {", ".join(others)}'
                      + (' – ghi chú đã nêu' if all(da_neu(a, b) for b in others) else ''))


# ---------------- đối chiếu thư mục nguồn ----------------
def tim_thu_muc(nguon):
    def co_pdf(d):
        try:
            return any(f.lower().endswith('.pdf') for f in os.listdir(d))
        except OSError:
            return False

    m = RE_TB_DIR.match(os.path.basename(os.path.normpath(nguon)))
    if m and co_pdf(nguon):
        return [(m.group(1), nguon)]
    out = []
    for root, dirs, _ in os.walk(nguon):
        dirs.sort()
        if os.path.normpath(root) == os.path.normpath(nguon):
            continue
        m = RE_TB_DIR.match(os.path.basename(root))
        if m and (co_pdf(root) or not dirs):
            out.append((m.group(1), root))
            dirs[:] = []
    return out


def doc_thu_muc(num, paths, P):
    stems, order = {}, []
    for path in paths:
        for f in sorted(os.listdir(path)):
            full = os.path.join(path, f)
            if not os.path.isfile(full) or not f.lower().endswith('.pdf'):
                continue
            m = RE_FILE.match(unicodedata.normalize('NFC', f).strip())
            if not m:
                P.canh(num, f'file không đúng mẫu tên 25.10 (bỏ qua): {f}')
                continue
            if os.path.getsize(full) == 0:
                P.loi(num, f'file rỗng (0 byte): {f}')
            stem = m.group(1).strip()
            if stem not in stems:
                stems[stem] = {}
                order.append(stem)
            stems[stem][m.group(2).upper()] = full
    if not stems:
        P.loi(num, f'thư mục “{os.path.basename(paths[0])}” không có PDF đúng mẫu tên '
                   f'“{PREFIX}<tờ>.<thửa>….TBXN.pdf / .DDK.pdf”')
    halves = []
    for stem in order:
        g = stems[stem]
        if 'TBXN' not in g:
            P.loi(num, f'thiếu file TBXN cho “{PREFIX}{stem}”')
        if 'DDK' not in g:
            P.canh(num, f'thiếu file DDK (đơn + ảnh CCCD) cho “{PREFIX}{stem}”')
        ps = [p.strip() for p in stem.split('-') if p.strip()]
        bad = [p for p in ps if not RE_PAIR.match(p)]
        if bad:
            P.canh(num, f'tờ.thửa không đọc được trong tên file: {", ".join(bad)}')
        halves.append([p for p in ps if RE_PAIR.match(p)])
    return [h for h in halves if h]


def khop_thu_tu(J, halves):
    if len(halves) == 1:
        return J == halves[0]
    if len(halves) > 6:
        return True
    return any(J == [p for h in perm for p in h] for perm in permutations(halves))


def kiem_nguon(nguon, eff, P):
    folders = tim_thu_muc(nguon)
    by_num = defaultdict(list)
    for num, path in folders:
        by_num[num].append(path)
    json_by_goc = defaultdict(list)
    for tb in eff:
        json_by_goc[goc_tb(tb)].append(tb)
    for num in sorted(by_num, key=int):
        paths = by_num[num]
        if len(paths) > 1:
            P.canh(num, f'{len(paths)} thư mục cùng số TB: {", ".join(os.path.basename(p) for p in paths)}')
        halves = doc_thu_muc(num, paths, P)
        tbs = sorted(json_by_goc.get(num, []), key=tb_key)
        if not tbs:
            P.loi(num, f'có thư mục nguồn “{os.path.basename(paths[0])}” nhưng chưa có dữ liệu JSON')
            continue
        J = [f'{s(t.get("soTo"))}.{s(t.get("soThua"))}' for tb in tbs if isinstance(eff[tb], dict)
             for t in ds_dict(eff[tb].get('thua'))]
        F = [p for h in halves for p in h]
        if not F:
            continue
        dup = sorted({p for p in F if F.count(p) > 1})
        if dup:
            P.canh(num, f'tờ.thửa lặp trong tên các file PDF: {liet_ke(dup)}')
        fs, js = set(F), set(J)
        thieu = [p for p in F if p not in js]
        du = [p for p in J if p not in fs]
        if thieu:
            P.loi(num, f'tên PDF có thửa (tờ.thửa) mà JSON không có: {liet_ke(thieu)}')
        if du:
            P.loi(num, f'JSON có thửa (tờ.thửa) mà tên PDF không có: {liet_ke(du)}')
        if not thieu and not du and not dup and len(J) == len(F) and not khop_thu_tu(J, halves):
            P.canh(num, 'thứ tự thửa trong JSON khác thứ tự trong tên file PDF (tên file theo STT danh sách thửa '
                        'TBXN) – xem lại STT trên TBXN')
    khong = sorted((tb for tb in eff if goc_tb(tb) not in by_num), key=tb_key)
    if khong:
        P.canh('', f'{len(khong)} TB có dữ liệu nhưng không có thư mục “TB xxxx” trong nguồn: {liet_ke(khong, 20)}')
    return len(folders)


# ---------------- phiếu ----------------
def run(data, nguon=None, ghi_file=True, in_ra=True):
    """Kiểm tra, in phiếu, ghi <data>/phieu-kiem-tra.txt. Trả mã thoát: 1 có LỖI, 0 không, 2 sai tham số."""
    data = os.path.abspath(data)
    if not os.path.isdir(data):
        print(f'✗ không có thư mục data: {data}')
        return 2
    if nguon and not os.path.isdir(nguon):
        print(f'✗ không có thư mục nguồn: {nguon}')
        return 2
    global LAST_PHIEU
    P = Phieu()
    LAST_PHIEU = P  # gop_du_lieu.py lấy LỖI / CẢNH BÁO từng TB ghi vào cột “Cần xem” của du-lieu.csv
    eff, stat = doc_data(data, P)
    for tb in sorted(eff, key=tb_key):
        x = eff[tb]
        chua = tb in stat['chua_gop']
        if la_khung(x):  # khung khung_tb.py vừa dựng, chưa đọc PDF → 1 dòng thay cho cả chục dòng "thiếu …"
            P.loi(tb, f'khung chưa điền – chưa đọc TBXN/DDK ({len(ds_dict(x.get("thua")))} thửa; chủ, diện tích, '
                      f'mục đích còn trống)' + (f'; chưa gộp vào {OUT}' if chua else ''))
            continue
        if chua:
            P.loi(tb, f'chưa có trong {OUT} (tiện ích chưa thấy TB này) – chạy gop_du_lieu.py; nếu đã cố ý bỏ TB này '
                      f'thì xóa / đổi tên file lẻ')
        kiem_tb(tb, x, P)
    kiem_cheo(eff, P)
    n_dir = kiem_nguon(os.path.abspath(nguon), eff, P) if nguon else None

    good = [x for x in eff.values() if isinstance(x, dict)]
    n_thua = sum(len(ds_dict(x.get('thua'))) for x in good)
    n_chu = sum(len(ds_dict(x.get('chu'))) for x in good)
    nl, nc, ng = P.dem(LOI), P.dem(CANH), P.dem(GHI)
    L = [f'PHIẾU KIỂM TRA DỮ LIỆU TB – {datetime.datetime.now():%d/%m/%Y %H:%M}',
         f'Data : {data}']
    if nguon:
        L.append(f'Nguồn: {os.path.abspath(nguon)} ({n_dir} thư mục TB)')
    L.append(f'Dữ liệu: {OUT} {stat["dl"] if stat["dl"] is not None else "–"} TB · {stat["le"]} file lẻ · '
             f'{len(eff)} TB kiểm tra · {n_thua} thửa · {n_chu} chủ')
    L.append(f'KẾT QUẢ: {nl} LỖI ({len(P.tbs(LOI))} TB) · {nc} CẢNH BÁO ({len(P.tbs(CANH))} TB) · {ng} GHI CHÚ')
    if P.tbs(LOI):
        L.append(f'TB có LỖI      : {", ".join(P.tbs(LOI))}')
    if P.tbs(CANH):
        L.append(f'TB có CẢNH BÁO : {", ".join(t for t in P.tbs(CANH) if t not in P.muc[LOI])}'
                 + (' (và các TB có LỖI ở trên)' if set(P.tbs(CANH)) & set(P.tbs(LOI)) else ''))
    for level, title in ((LOI, 'LỖI – phải sửa trước khi nạp vào tiện ích'),
                         (CANH, 'CẢNH BÁO – xem lại, sai thì sửa'),
                         (GHI, 'GHI CHÚ – ghi chú trong dữ liệu, người nhập đọc trước khi nhập')):
        items = P.muc[level]
        if not items:
            continue
        L += ['', f'══ {title} ══']
        for tb in sorted(items, key=tb_key):
            head = 'Chung' if tb == '' else f'TB {tb}'
            if level == GHI and len(items[tb]) == 1:
                L.append(f'{head}: {items[tb][0]}')
                continue
            L.append(head)
            L += [f'  • {msg}' for msg in items[tb]]
    out_txt = os.path.join(data, PHIEU)
    L.append('')
    if nl:
        L.append(f'→ Còn {nl} LỖI: sửa (đọc lại PDF nếu cần), chạy lại gop_du_lieu.py rồi kiểm tra lại. Phiếu: {out_txt}')
    else:
        L.append(f'→ Không có LỖI. Xem các CẢNH BÁO rồi nạp du-lieu.csv vào tiện ích (Dữ liệu → Mở file CSV…). Phiếu: {out_txt}')
    text = che('\n'.join(L))
    if in_ra:
        print(text)
    if ghi_file:
        try:
            with open(out_txt, 'w', encoding='utf-8-sig') as fh:
                fh.write(text + '\n')
        except OSError as e:
            print(f'✗ không ghi được {out_txt}: {e}')
    return 1 if nl else 0


def main():
    ap = argparse.ArgumentParser(description='Phiếu kiểm tra dữ liệu TB (du-lieu.json + TB_*.json) trước khi nạp vào '
                                             'tiện ích VBDLIS Điền Nhanh. Chỉ đọc; ghi phiếu ra <data>/phieu-kiem-tra.txt.')
    ap.add_argument('data', help='thư mục data của tiện ích (…/vbdlis-dien-nhanh/data)')
    ap.add_argument('nguon', nargs='?', help='thư mục nguồn chứa các thư mục “TB xxxx” (PDF TBXN + DDK) – tùy chọn')
    a = ap.parse_args()
    sys.exit(run(a.data, a.nguon))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    main()
