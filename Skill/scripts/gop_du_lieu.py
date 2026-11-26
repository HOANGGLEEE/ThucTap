#!/usr/bin/env python3
"""Gộp các file dữ liệu TB (*.json) trong thư mục data của tiện ích “VBDLIS Điền Nhanh” thành data/du-lieu.json.

Tiện ích CHỈ tự đọc file data/du-lieu.json (mỗi lần mở bảng điền). Các file lẻ (TB_1891.json, tb-1892.json…)
phải được gộp vào du-lieu.json thì mới lên tiện ích.

  python gop_du_lieu.py "<thư mục data>"              gộp mọi file *.json vào du-lieu.json (giữ các TB chỉ có
                                                       trong du-lieu.json), chuẩn hóa, ghi file, in báo cáo
  python gop_du_lieu.py "<thư mục data>" --kiem-tra   chỉ kiểm tra + báo cáo, không ghi gì
  python gop_du_lieu.py "<thư mục data>" --lam-moi    dựng lại du-lieu.json CHỈ từ các file lẻ
  python gop_du_lieu.py "<thư mục data>" --bo 1891-1 1891-2   bỏ các TB này khỏi du-lieu.json
  thêm --nguon "<thư mục chứa các thư mục TB xxxx>"          để phiếu kiểm tra đối chiếu cả tên file PDF

Sau khi ghi du-lieu.json, script tự chạy PHIẾU KIỂM TRA (kiem_tra.py, cùng thư mục): in phiếu LỖI / CẢNH BÁO /
GHI CHÚ, ghi <data>/phieu-kiem-tra.txt; mã thoát 1 nếu phiếu còn LỖI.

Chuẩn hóa (ghi lại trong báo cáo, việc tự suy luận thì ghi thêm vào “ghiChu” của TB):
  - JSON gõ tay có lỗi nhỏ (thiếu dấu phẩy cuối dòng, dấu phẩy thừa, 56,5 không ngoặc kép, ngoặc kép “ ”) → tự sửa;
  - diện tích 56,5 → 56.5; 1.712,6 → 1712.6; bỏ “m²”; số không rõ (1.225 / 1,225) → giữ nguyên và cảnh báo;
  - mục đích “LUC (Đất chuyên trồng lúa)” → “LUC”; thời hạn trống → “50 năm”; nguồn gốc trống → mặc định;
  - Số biên nhận trống → dựng KH 2959.07777.<tờ>.<thửa>-… theo danh sách thửa; có rồi thì đối chiếu với danh sách thửa;
  - họ tên chủ → IN HOA; số giấy tờ chỉ giữ chữ số; năm sinh / giới tính trống → suy từ số CCCD 12 số
    (chữ số thứ 4: 0 nam 19xx, 1 nữ 19xx, 2 nam 20xx, 3 nữ 20xx; chữ số 5–6: năm sinh) và đối chiếu nếu đã có;
  - người nộp trống → lấy chủ thứ nhất; địa chỉ trống → lấy địa chỉ thửa đầu tiên.
Ghi du-lieu.json dạng UTF-8 không BOM, thụt lề 2, sắp xếp theo số TB; bản cũ được giữ ở du-lieu.json.bak.
"""
import argparse
import copy
import json
import os
import re
import shutil
import sys
import unicodedata

PREFIX = 'KH 2959.07777.'
OUT = 'du-lieu.json'
NGUON_GOC = 'Công nhận QSDĐ như giao đất không thu tiền sử dụng đất'
THOI_HAN = '50 năm'
# đất ở (người dùng chốt 23/11): phường là đô thị → ONT / ONT+CLN / CLN+ONT đều ghi ODT;
# nguồn gốc “có thu tiền”, thời hạn “Lâu dài” (chỉ thay khi đang trống hoặc đang là mặc định đất nông nghiệp)
NGUON_GOC_DAT_O = 'Công nhận QSDĐ như giao đất có thu tiền sử dụng đất'
THOI_HAN_DAT_O = 'Lâu dài'
DAT_O_RE = re.compile(r'^\s*(ONT|ODT)(\s*[+,/;&]\s*CLN)?\s*$|^\s*CLN\s*[+,/;&]\s*(ONT|ODT)\s*$', re.I)
GIAY_TO = ['Đơn đăng ký', 'Thông báo xác nhận kết quả đăng ký']
# chủ chỉ có CMND (người dùng chốt 25/11): chung chủ → bỏ người có CMND; chỉ có người CMND → chủ hộ (chủ thứ nhất)
# nhập số CCCD thay này (VBDLIS cần số CCCD 12 số), loại “Căn cước công dân”
SO_THAY_CMND = '033205007296'
NOI_CAP_CCCD = 'Cục Cảnh sát Quản lý hành chính về TTXH'
RE_PAIR = re.compile(r'^(\d+)\.(\d+[A-Za-z]?)$')


# ---------------- đọc JSON dễ dãi ----------------
def explain(e, src):
    line, col = getattr(e, 'lineno', 0), getattr(e, 'colno', 0)
    lines = src.split('\n')
    show = lambda n: (lines[n - 1] if 0 < n <= len(lines) else '').strip()[:90]
    msg = f'JSON sai ở dòng {line}, cột {col}: «{show(line)}»'
    if line > 1:
        msg += f' (dòng trước: «{show(line - 1)}»)'
    return msg + ' – thường do thiếu dấu phẩy, thiếu ngoặc kép " hoặc thiếu ngoặc } ].'


# ---------------- file CSV du-lieu.csv (người dùng 25/11: “nạp exel thay json … để dễ tiền kiểm soát”, rồi “csv cơ”, “không dùng xlsx”) ----
# Cùng mẫu cột với nút “⬇ Xuất CSV” của tiện ích: mỗi hàng một người nộp / một chủ / một thửa; cột “Dòng” ghi Người nộp, Chủ 1…,
# Thửa 1…; ô của cả TB (Số biên nhận, Địa chỉ tài sản, Giấy tờ, Ghi chú…) ở hàng Người nộp; cột “Cần xem” = cảnh báo / lỗi của TB.
# File UTF-16 + dấu Tab (Excel mở thẳng, đúng tiếng Việt, đúng cột); ô số dễ bị Excel đổi (số 0 đầu, 56.5…) ghi dạng ="…".
# Người dùng mở bằng Excel soát / sửa, lưu (giữ kiểu CSV), rồi nạp vào tiện ích (Dữ liệu → Mở file…). Lần gộp sau, chỗ người dùng
# sửa trong du-lieu.csv được lấy lại (file luôn đúng) và ghi về file lẻ – không bị bản cũ ghi đè. Không dùng .xlsx.
XL = 'du-lieu.csv'
XL_COLS = [  # thứ tự cột như đầu (người dùng 25/11: “cứ ghi như đầu”) – cùng tiện ích
    ('tb', 'TB'), ('dong', 'Dòng'), ('hoTen', 'Họ tên'), ('namSinh', 'Năm sinh'), ('gioiTinh', 'Giới tính'),
    ('loaiGiayTo', 'Loại giấy tờ'), ('soGiayTo', 'Số giấy tờ'), ('noiCap', 'Nơi cấp'), ('soTo', 'Số tờ'), ('soThua', 'Số thửa'),
    ('dienTich', 'Diện tích'), ('dienTichPL', 'Diện tích PL'), ('mdsd', 'MĐSD'), ('nguonGoc', 'Nguồn gốc'), ('thoiHan', 'Thời hạn'),
    ('diaChi', 'Địa chỉ'), ('soBienNhan', 'Số biên nhận'), ('diaChiTaiSan', 'Địa chỉ tài sản'), ('giayTo', 'Giấy tờ'),
    ('ghiChu', 'Ghi chú'), ('phuongXa', 'Phường/Xã'), ('quyTrinh', 'Quy trình'), ('dieuKienCapGiay', 'Điều kiện cấp giấy'),
    ('dangKyLanDau', 'Đăng ký lần đầu'), ('loaiDoiTuong', 'Loại đối tượng'), ('danToc', 'Dân tộc'), ('quocTich', 'Quốc tịch'),
    ('canXem', 'Cần xem'),
]
XL_OPT = {'dienTichPL', 'phuongXa', 'quyTrinh', 'dieuKienCapGiay', 'dangKyLanDau', 'loaiDoiTuong', 'danToc', 'quocTich'}
XL_TB = ['soBienNhan', 'diaChiTaiSan', 'giayTo', 'ghiChu', 'phuongXa', 'quyTrinh', 'dieuKienCapGiay', 'dangKyLanDau']
XL_CHU = ['hoTen', 'namSinh', 'gioiTinh', 'loaiGiayTo', 'soGiayTo', 'noiCap', 'diaChi', 'loaiDoiTuong', 'danToc', 'quocTich']
XL_THUA = ['soThua', 'soTo', 'dienTich', 'dienTichPL', 'mdsd', 'diaChi', 'thoiHan', 'nguonGoc']
XL_NOP = ['hoTen', 'soGiayTo', 'diaChi']
XL_KNOWN = {'tb', 'nguoiNop', 'chu', 'thua', *XL_TB}
XL_ALIAS = {'so tb': 'tb', 'tb so': 'tb', 'so thong bao': 'tb', 'loai dong': 'dong', 'ho va ten': 'hoTen', 'ten': 'hoTen',
            'so cccd': 'soGiayTo', 'cccd': 'soGiayTo', 'so dinh danh': 'soGiayTo', 'to': 'soTo', 'to ban do': 'soTo',
            'so to ban do': 'soTo', 'thua': 'soThua', 'thua so': 'soThua', 'dien tich m2': 'dienTich', 'muc dich': 'mdsd',
            'muc dich su dung': 'mdsd', 'loai dat': 'mdsd', 'mdsd cap giay': 'mdsd', 'so bn': 'soBienNhan',
            'dia chi thua': 'diaChi', 'thoi han sd': 'thoiHan', 'nguon goc dat': 'nguonGoc'}


def _k(s):
    t = unicodedata.normalize('NFD', str(s or '').replace('đ', 'd').replace('Đ', 'D'))
    t = ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()


def xl_key(h):
    n = _k(h)
    if not n:
        return ''
    for k, lab in XL_COLS:
        if _k(lab) == n:
            return k
    return XL_ALIAS.get(n, '')


def _cell(v):
    if v is None:
        return ''
    m = re.fullmatch(r'\s*="(.*)"\s*', str(v), flags=re.S)  # ô ="…" (để Excel giữ số 0 đầu) → bỏ vỏ
    if m:
        v = m.group(1).replace('""', '"')
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(v)).replace('\xa0', ' ')).strip()


def doc_csv_rows(path):
    """Đọc file CSV / Unicode Text: mã theo BOM (UTF-16 / UTF-8), không BOM thì UTF-8 rồi cp1258; dấu Tab / ; / , đoán theo dòng đầu."""
    import csv
    import io
    b = open(path, 'rb').read()
    if b[:2] == b'PK' or b[:2] == b'\xd0\xcf':
        raise ValueError('đây là file Excel .xlsx / .xls, không phải CSV – trong Excel bấm “Lưu thành”, chọn kiểu CSV')
    if b[:2] in (b'\xff\xfe', b'\xfe\xff'):
        t = b.decode('utf-16')
    elif b[:3] == b'\xef\xbb\xbf':
        t = b[3:].decode('utf-8')
    else:
        try:
            t = b.decode('utf-8')
        except UnicodeDecodeError:
            t = b.decode('cp1258', errors='replace')
    first = next((ln for ln in t.splitlines() if ln.strip()), '')
    dl = '\t' if '\t' in first else ';' if first.count(';') > first.count(',') else ','
    return [[_cell(c) for c in r] for r in csv.reader(io.StringIO(t, newline=''), delimiter=dl)]


def csv_o(v):
    """Ô CSV: số dễ bị Excel đổi (số 0 đầu, có . , / -, từ 12 chữ số) và chữ mở đầu = + - @ → ="…"; ô có dấu " → bọc ngoặc kép."""
    t = re.sub(r'[\t\r\n]+', ' ', '' if v is None else str(v))
    num = re.fullmatch(r'\d[\d.,/\-]*', t) and (re.match(r'0\d', t) or re.search(r'[.,/\-]', t) or len(t) >= 12)
    formula = re.match(r'[=+\-@]', t)
    if (num or formula) and len(t) <= 250:
        return '="' + t.replace('"', '""') + '"'
    if formula:
        return ' ' + t
    return '"' + t.replace('"', '""') + '"' if '"' in t else t


def _so(v, loai, ghi):
    """Số giấy tờ từ Excel: bỏ cách / chấm; Excel bỏ mất số 0 đầu (ô dạng số) → thêm lại."""
    so = re.sub(r'[\s.\-]', '', v or '')
    if re.fullmatch(r'\d{11}', so) and (not loai or 'can cuoc' in _k(loai)):
        ghi.append(f'số giấy tờ thiếu số 0 đầu (Excel bỏ mất) – đã thêm')
        return '0' + so
    return so if re.fullmatch(r'\d+', so) else (v or '')


def doc_excel(path):
    """du-lieu.csv → (danh sách TB, các hàng lỗi bị bỏ)."""
    rows = doc_csv_rows(path)
    hi, keys = -1, None
    for i, r in enumerate(rows[:15]):
        ks = [xl_key(c) for c in r]
        if 'tb' in ks and 'dong' in ks:
            hi, keys = i, ks
            break
    if hi < 0:
        raise ValueError('không thấy hàng tiêu đề có cột “TB” và cột “Dòng”')
    by, errs = {}, []
    last_tb = ''
    for i in range(hi + 1, len(rows)):
        r = rows[i]
        v = {}
        for j, k in enumerate(keys):
            if k and k not in ('canXem', 'tienDo') and j < len(r) and r[j] and not v.get(k):
                v[k] = r[j]
        if not any(v.values()):
            continue
        # gõ nhanh (như tiện ích 1.21.21): ô TB trống = TB hàng trên; hàng mẫu TB “VD” bỏ qua; Dòng gõ n / c / t hoặc để trống
        tb = re.sub(r'^tb\s*', '', v.get('tb', ''), flags=re.I) or last_tb
        if not tb:
            errs.append(f'hàng {i + 1}: thiếu số TB – bỏ hàng')
            continue
        last_tb = tb
        if _k(tb) in ('vd', 'mau', 'vi du'):
            continue
        d = _k(v.get('dong', ''))
        if d.startswith('nguoi nop') or d in ('nop', 'nn', 'n'):
            kind = 'nop'
        elif re.match(r'chu\b', d) or re.fullmatch(r'c ?\d*', d):
            kind = 'chu'
        elif re.match(r'thua\b', d) or re.fullmatch(r't ?\d*', d):
            kind = 'thua'
        elif d in ('tb', 'ho so', 'chung'):
            kind = 'tb'
        elif d:
            kind = ''
        elif any(v.get(k) for k in ('soTo', 'soThua', 'dienTich', 'mdsd')):
            kind = 'thua'
        elif any(v.get(k) for k in ('hoTen', 'soGiayTo', 'namSinh')):
            kind = 'chu'
        else:
            kind = 'tb'
        if not kind:
            errs.append(f'hàng {i + 1} (TB {tb}): cột Dòng ghi “{v.get("dong")}” – không hiểu, bỏ hàng')
            continue
        o = by.setdefault(tb, {'chu': [], 'thua': [], 'tbv': {}, 'nop': None})
        for k in XL_TB:
            if v.get(k) and not o['tbv'].get(k):
                o['tbv'][k] = v[k]
        pick = lambda ks: {k: v[k] for k in ks if v.get(k)}
        if kind == 'nop':
            o['nop'] = pick(XL_NOP)
        elif kind == 'chu':
            o['chu'].append(pick(XL_CHU))
        elif kind == 'thua':
            o['thua'].append(pick(XL_THUA))
    items = []
    for tb, o in by.items():
        ghi = []
        for c in o['chu']:
            if c.get('soGiayTo'):
                c['soGiayTo'] = _so(c['soGiayTo'], c.get('loaiGiayTo'), ghi)
        x = {'tb': tb}
        for k in ('soBienNhan', 'diaChiTaiSan'):
            if o['tbv'].get(k):
                x[k] = o['tbv'][k]
        if o['nop']:
            if o['nop'].get('soGiayTo'):
                o['nop']['soGiayTo'] = _so(o['nop']['soGiayTo'], '', ghi)
            x['nguoiNop'] = o['nop']
        x['chu'] = o['chu']
        x['thua'] = o['thua']
        for k in XL_TB[2:]:
            if o['tbv'].get(k):
                x[k] = [g for g in re.split(r'\s*[;\n]\s*', o['tbv'][k]) if g] if k == 'giayTo' else o['tbv'][k]
        if ghi:
            errs.append(f'TB {tb}: ' + '; '.join(sorted(set(ghi))))
        items.append(x)
    return items, errs


def xl_canon(x):
    """Nội dung của TB theo các cột của file CSV (không kể thứ tự ô, ô trống) – để biết người dùng có sửa trong file không."""
    def cl(v):
        if isinstance(v, dict):
            return {k: cl(w) for k, w in sorted(v.items()) if w not in ('', None, [], {})}
        if isinstance(v, list):
            return [cl(w) for w in v]
        return str(v) if isinstance(v, (int, float)) else nfc(v)
    p = {k: x.get(k) for k in ('tb', *XL_TB)}
    p['nguoiNop'] = {k: (x.get('nguoiNop') or {}).get(k) for k in XL_NOP}
    p['chu'] = [{k: (c or {}).get(k) for k in XL_CHU} for c in x.get('chu') or []]
    p['thua'] = [{k: (t or {}).get(k) for k in XL_THUA} for t in x.get('thua') or []]
    if 'giayTo' in p and not isinstance(p['giayTo'], list):
        p['giayTo'] = [p['giayTo']] if p['giayTo'] else []
    return json.dumps(cl(p), ensure_ascii=False, sort_keys=True)


def ghi_excel(path, result, can_xem):
    """Ghi du-lieu.csv: UTF-16 (có BOM) + dấu Tab, xuống dòng CRLF – Excel mở thẳng, đúng tiếng Việt, đúng cột."""
    def has(k):
        return any(x.get(k) not in (None, '', []) or any((c or {}).get(k) for c in x.get('chu') or [])
                   or any((t or {}).get(k) for t in x.get('thua') or []) for x in result)
    cols = [(k, lab) for k, lab in XL_COLS if k not in XL_OPT or has(k)]
    out = [[lab for _, lab in cols]]
    st = lambda v: '' if v is None else str(v)
    for x in result:
        tbv = {k: ('; '.join(x.get('giayTo') or []) if k == 'giayTo' else x.get(k)) for k in XL_TB}
        n = x.get('nguoiNop') or {}

        def line(dong, o, cx):
            out.append([st(x['tb']) if k == 'tb' else dong if k == 'dong' else cx if k == 'canXem' else st(o.get(k))
                        for k, _ in cols])
        line('Người nộp', {**tbv, 'hoTen': n.get('hoTen'), 'soGiayTo': n.get('soGiayTo'), 'diaChi': n.get('diaChi')},
             '; '.join(can_xem.get(x['tb'], [])))
        for i, c in enumerate(x.get('chu') or [], 1):
            ns = c.get('namSinh') or (re.search(r'(\d{4})\s*$', nfc(c.get('ngaySinh'))) or [None, ''])[1]
            line(f'Chủ {i}', {**c, 'namSinh': ns}, '')
        for i, t in enumerate(x.get('thua') or [], 1):
            line(f'Thửa {i}', t, '')
    text = '\r\n'.join('\t'.join(csv_o(v) for v in r) for r in out) + '\r\n'
    with open(path, 'wb') as fh:
        fh.write(b'\xff\xfe' + text.encode('utf-16-le'))


def load_loose(path):
    raw = open(path, 'rb').read().decode('utf-8-sig')  # bỏ BOM
    src = raw.strip()
    try:
        return json.loads(src), []
    except json.JSONDecodeError as e0:
        fixes = []
        t = src

        def fix(pattern, repl, what):
            nonlocal t
            new, n = re.subn(pattern, repl, t)
            if n:
                t = new
                fixes.append(f'{what} ({n} chỗ)')

        fix(r',(\s*[}\]])', r'\1', 'bỏ dấu phẩy thừa trước } ]')
        fix(r'("\s*:\s*)(\d+),(\d{1,3})(?=\s*[,}\r\n])', r'\1"\2.\3"', 'số thập phân viết dấu phẩy 56,5 → "56.5"')
        fix(r'("|\d|true|false|null|[}\]])([ \t]*\r?\n\s*)(?=["{\[])', r'\1,\2', 'thêm dấu phẩy còn thiếu cuối dòng')
        try:
            return json.loads(t), fixes
        except json.JSONDecodeError:
            pass
        fix(r'[“”„‟]', '"', 'đổi ngoặc kép kiểu Word “ ” thành "')
        try:
            return json.loads(t), fixes
        except json.JSONDecodeError:
            raise ValueError(explain(e0, src))


def as_list(j):
    if isinstance(j, list):
        return j
    if isinstance(j, dict):
        for k in ('tb', 'data'):
            if isinstance(j.get(k), list):
                return j[k]
        return [j]
    raise ValueError('nội dung không phải dữ liệu TB (cần một TB {…} hoặc danh sách [ … ])')


# ---------------- chuẩn hóa ----------------
def nfc(s):
    return unicodedata.normalize('NFC', str(s)).strip() if s is not None else ''


def norm_area(s):
    """Trả (giá trị, lỗi). 56,5 → 56.5; 1.712,6 → 1712.6; không rõ → lỗi."""
    raw = nfc(s)
    t = re.sub(r'\s+', '', raw)
    t = re.sub(r'(m²|m2)$', '', t, flags=re.I)
    if not t:
        return '', None
    if re.fullmatch(r'\d{1,3}\.\d{3}', t) or re.fullmatch(r'\d{1,3}(\.\d{3}){2,}', t):
        return raw, f'diện tích “{raw}” không rõ dấu chấm là hàng nghìn hay thập phân'
    if re.fullmatch(r'\d+(\.\d+)?', t):
        return t, None
    if re.fullmatch(r'\d+,\d{1,2}', t):
        return t.replace(',', '.'), None
    if re.fullmatch(r'\d{1,3}(\.\d{3})+,\d{1,2}', t):
        return t.replace('.', '').replace(',', '.'), None
    if re.fullmatch(r'\d+,\d{3}', t):
        return raw, f'diện tích “{raw}” không rõ dấu phẩy là hàng nghìn hay thập phân'
    return raw, f'diện tích “{raw}” không phải số'


def tb_key(tb):
    m = re.match(r'^(\d+)(.*)$', tb)
    return (int(m.group(1)), m.group(2)) if m else (10 ** 9, tb)


def cccd_info(so):
    """CCCD 12 số → (năm sinh, giới tính) theo quy tắc mã; None nếu không suy được."""
    if not re.fullmatch(r'\d{12}', so or ''):
        return None
    g = int(so[3])
    if g > 3:
        return None
    century = 1900 if g in (0, 1) else 2000
    return str(century + int(so[4:6])), ('Nam' if g % 2 == 0 else 'Nữ')


def la_cmnd(c):
    """Chủ chỉ có CMND cũ: loại ghi CMND, hoặc số 9 chữ số (không tính số thay đã điền)."""
    so = re.sub(r'\D', '', nfc(c.get('soGiayTo')))
    if so == SO_THAY_CMND:
        return False
    return nfc(c.get('loaiGiayTo')) == 'Chứng minh nhân dân' or len(so) == 9


def xu_ly_cmnd(x, chu, notes):
    """Người dùng chốt 25/11: chung chủ mà có chủ CMND → bỏ chủ CMND; chỉ toàn chủ CMND → giữ chủ hộ (chủ thứ nhất),
    nhập số CCCD thay SO_THAY_CMND. Ghi lại vào ghiChu của TB (để người nhập biết)."""
    if not chu:
        return chu
    cm = [c for c in chu if la_cmnd(c)]
    if not cm:
        return chu
    gc = []
    if len(cm) < len(chu):
        keep = [c for c in chu if not la_cmnd(c)]
        gc.append('Chung chủ: bỏ chủ chỉ có CMND (' + ', '.join(nfc(c.get('hoTen')).upper() or '?' for c in cm)
                  + ') – chỉ nhập chủ có CCCD.')
    else:
        head = chu[0]
        if len(chu) > 1:
            gc.append('Mọi chủ chỉ có CMND – chỉ nhập chủ hộ ' + nfc(head.get('hoTen')).upper() + ', bỏ '
                      + ', '.join(nfc(c.get('hoTen')).upper() or '?' for c in chu[1:]) + '.')
        head['soGiayTo'] = SO_THAY_CMND
        head['loaiGiayTo'] = 'Căn cước công dân'
        head['noiCap'] = NOI_CAP_CCCD
        gc.append(f'Chủ hộ {nfc(head.get("hoTen")).upper()} chỉ có CMND – nhập số CCCD thay {SO_THAY_CMND} '
                  '(người dùng chốt), năm sinh / giới tính vẫn theo CMND.')
        keep = [head]
    old = nfc(x.get('ghiChu'))
    add = ' '.join(g for g in gc if g not in old)
    if add:
        x['ghiChu'] = (old + ' ' + add).strip() if old else add
    nn = x.get('nguoiNop')
    if isinstance(nn, dict):  # người nộp = chủ thứ nhất mới
        nn['hoTen'] = nfc(keep[0].get('hoTen')).upper()
        nn['soGiayTo'] = re.sub(r'\D', '', nfc(keep[0].get('soGiayTo')))
    return keep


def normalize(x, warn, notes):
    """Chuẩn hóa 1 TB tại chỗ. warn: cảnh báo cần người xem; notes: những gì đã tự điền/suy luận."""
    x['tb'] = nfc(x.get('tb'))
    thua = x.get('thua') or []
    x['thua'] = thua
    # địa chỉ chung của TB (để điền chỗ trống)
    addr = nfc(x.get('diaChiTaiSan')) or next((nfc(t.get('diaChi')) for t in thua if nfc(t.get('diaChi'))), '') \
        or nfc((x.get('nguoiNop') or {}).get('diaChi'))
    miss_area, miss_md, bad_pair = [], [], []
    filled_th = filled_ng = 0
    for t in thua:
        for k in ('soThua', 'soTo'):
            t[k] = re.sub(r'\s+', '', nfc(t.get(k)))
        who = f'{t["soThua"] or "?"}/{t["soTo"] or "?"}'
        if not t['soThua'] or not t['soTo']:
            bad_pair.append(who)
        for key in ('dienTich', 'dienTichPL'):
            if key not in t:
                continue
            v, err = norm_area(t.get(key))
            t[key] = v
            if err:
                warn.append(f'thửa {who}: {err}')
        if not t.get('dienTich'):
            miss_area.append(who)
        md = nfc(t.get('mdsd'))
        if DAT_O_RE.match(md):
            # đất ở: ONT / ONT+CLN → ODT, nguồn gốc có thu tiền, thời hạn lâu dài
            t['mdsd'] = 'ODT'
            if nfc(t.get('nguonGoc')) in ('', NGUON_GOC):
                t['nguonGoc'] = NGUON_GOC_DAT_O
            if nfc(t.get('thoiHan')) in ('', THOI_HAN):
                t['thoiHan'] = THOI_HAN_DAT_O
        else:
            m = re.match(r'^([A-Za-z]{2,4})\b', md)
            t['mdsd'] = m.group(1).upper() if m else md
        if not t['mdsd']:
            miss_md.append(who)
        if not nfc(t.get('thoiHan')):
            t['thoiHan'] = THOI_HAN
            filled_th += 1
        if not nfc(t.get('nguonGoc')):
            t['nguonGoc'] = NGUON_GOC
            filled_ng += 1
        if not nfc(t.get('diaChi')):
            if addr:
                t['diaChi'] = addr
            else:
                warn.append(f'thửa {who}: thiếu địa chỉ')
    if not thua:
        warn.append('chưa có thửa nào')
    if bad_pair:
        warn.append(f'thửa thiếu số thửa/số tờ: {", ".join(bad_pair)}')
    if miss_area:
        warn.append(f'thiếu diện tích {len(miss_area)} thửa: {", ".join(miss_area)}')
    if miss_md:
        warn.append(f'thiếu mục đích sử dụng {len(miss_md)} thửa: {", ".join(miss_md)}')

    # Số biên nhận ↔ danh sách thửa
    pairs = [f'{t["soTo"]}.{t["soThua"]}' for t in thua]
    sbn = re.sub(r'\s+', ' ', nfc(x.get('soBienNhan')))
    if not sbn:
        if thua and not bad_pair:
            x['soBienNhan'] = PREFIX + '-'.join(pairs)
            notes.append('Số biên nhận dựng theo danh sách thửa (mẫu tên 25.10) – kiểm tra lại')
        else:
            warn.append('thiếu Số biên nhận')
    else:
        x['soBienNhan'] = sbn
        m = re.match(r'^KH\s*2959\.07777\.(.+)$', sbn)
        if m:
            got = [p.strip() for p in m.group(1).split('-')]
            if got != pairs:
                if sorted(got) == sorted(pairs):
                    warn.append('thứ tự thửa khác thứ tự trong Số biên nhận')
                else:
                    extra = [p for p in got if p not in pairs]
                    lack = [p for p in pairs if p not in got]
                    warn.append('Số biên nhận không khớp danh sách thửa' + (f' – thửa có trong số BN mà không có trong danh sách: {", ".join(extra)}' if extra else '')
                                + (f' – thửa trong danh sách mà số BN không có: {", ".join(lack)}' if lack else ''))

    # chủ sử dụng
    chu = x.get('chu') or []
    chu = xu_ly_cmnd(x, chu, notes)
    x['chu'] = chu
    if not chu:
        warn.append('chưa có chủ sử dụng')
    for k, c in enumerate(chu, 1):
        c['hoTen'] = nfc(c.get('hoTen')).upper()
        c['soGiayTo'] = re.sub(r'\D', '', nfc(c.get('soGiayTo')))
        if not c.get('loaiGiayTo'):
            c['loaiGiayTo'] = 'Căn cước công dân'
        if not nfc(c.get('diaChi')) and addr:
            c['diaChi'] = addr
        name = c['hoTen'] or f'chủ {k}'
        if not c['hoTen']:
            warn.append(f'chủ {k}: thiếu họ tên')
        elif c['hoTen'].split()[0] == 'NGUYÊN':
            warn.append(f'{name}: họ “NGUYÊN” – có thể là NGUYỄN bị đọc sai dấu, xem lại trên CCCD')
        so = c['soGiayTo']
        if not so:
            warn.append(f'{name}: thiếu số giấy tờ')
        elif len(so) not in (9, 12):
            warn.append(f'{name}: số giấy tờ “{so}” có {len(so)} chữ số (CCCD phải 12, CMND 9)')
        if not nfc(c.get('namSinh')):
            m = re.search(r'(\d{4})\s*$', nfc(c.get('ngaySinh')))
            if m:
                c['namSinh'] = m.group(1)
        info = None if so == SO_THAY_CMND else cccd_info(so)
        ns, gt = nfc(c.get('namSinh')), nfc(c.get('gioiTinh'))
        if info:
            if not ns:
                c['namSinh'] = info[0]
                notes.append(f'Năm sinh {name} suy từ số CCCD')
            elif ns != info[0]:
                warn.append(f'{name}: năm sinh {ns} khác năm theo số CCCD ({info[0]}) – xem lại số CCCD hoặc năm sinh')
            if not gt:
                c['gioiTinh'] = info[1]
                notes.append(f'Giới tính {name} suy từ số CCCD')
            elif gt.lower() != info[1].lower():
                warn.append(f'{name}: giới tính {gt} khác theo số CCCD ({info[1]})')
        else:
            if not nfc(c.get('namSinh')):
                warn.append(f'{name}: thiếu năm sinh')
            if not gt:
                warn.append(f'{name}: thiếu giới tính')
        if c.get('gioiTinh'):
            c['gioiTinh'] = 'Nữ' if nfc(c['gioiTinh']).lower() in ('nữ', 'nu', 'nư') else 'Nam' if nfc(c['gioiTinh']).lower() == 'nam' else nfc(c['gioiTinh'])

    # người nộp hồ sơ
    nn = x.get('nguoiNop') or {}
    x['nguoiNop'] = nn
    first = next((c for c in chu if not c.get('tuyChon')), chu[0] if chu else {})
    used = []
    for key, src in (('hoTen', first.get('hoTen')), ('soGiayTo', first.get('soGiayTo')), ('diaChi', addr)):
        if not nfc(nn.get(key)) and src:
            nn[key] = src
            used.append(key)
        else:
            nn[key] = nfc(nn.get(key))
    if 'hoTen' in used or 'soGiayTo' in used:
        notes.append('Người nộp hồ sơ lấy theo chủ thứ nhất')
    for key, lab in (('hoTen', 'tên người nộp'), ('soGiayTo', 'số giấy tờ người nộp'), ('diaChi', 'địa chỉ người nộp')):
        if not nn.get(key):
            warn.append(f'thiếu {lab}')
    if not nfc(x.get('diaChiTaiSan')) and addr:
        x['diaChiTaiSan'] = addr
    if not x.get('giayTo'):
        x['giayTo'] = list(GIAY_TO)
    if notes:
        old = nfc(x.get('ghiChu'))
        add = [n for n in notes if n not in old]
        if add:
            x['ghiChu'] = (old + (' ' if old else '') + '[Tự điền: ' + '; '.join(add) + '.]').strip()
    return x


# ---------------- chính ----------------
def main():
    ap = argparse.ArgumentParser(description='Gộp dữ liệu TB thành du-lieu.json cho tiện ích VBDLIS Điền Nhanh.')
    ap.add_argument('data', help='thư mục data của tiện ích (…/vbdlis-dien-nhanh/data)')
    ap.add_argument('--kiem-tra', action='store_true', help='chỉ kiểm tra, không ghi')
    ap.add_argument('--lam-moi', action='store_true', help='bỏ qua du-lieu.json cũ, dựng lại chỉ từ các file lẻ')
    ap.add_argument('--bo', nargs='*', default=[], help='số TB cần bỏ khỏi du-lieu.json')
    ap.add_argument('--nguon', help='thư mục nguồn chứa các thư mục “TB xxxx” – phiếu kiểm tra đối chiếu tên file PDF')
    a = ap.parse_args()

    data = os.path.abspath(a.data)
    if not os.path.isdir(data):
        print(f'✗ không có thư mục {data}')
        return 2
    out_path = os.path.join(data, OUT)
    merged = {}
    origin = {}
    problems = []
    dl_prev = {}  # TB → bản trong du-lieu.json lúc đọc
    xl_edit = set()  # TB lấy theo chỗ bạn sửa trong du-lieu.csv
    xl_bad = False  # du-lieu.csv đang có mà không đọc được → không ghi đè (khỏi mất chỗ bạn sửa)

    if os.path.exists(out_path) and not a.lam_moi:
        try:
            j, fixes = load_loose(out_path)
            for x in as_list(j):
                if isinstance(x, dict) and nfc(x.get('tb')):
                    merged[nfc(x['tb'])] = x
                    origin[nfc(x['tb'])] = OUT
                    dl_prev[nfc(x['tb'])] = copy.deepcopy(x)
            if fixes:
                print(f'• {OUT}: đã tự sửa JSON: {"; ".join(fixes)}')
        except Exception as e:
            problems.append(f'{OUT}: {e} – bỏ qua nội dung cũ, dựng lại từ các file lẻ')

    files = sorted([f for f in os.listdir(data) if f.lower().endswith('.json') and f != OUT],
                   key=lambda f: os.path.getmtime(os.path.join(data, f)))
    for f in files:
        try:
            j, fixes = load_loose(os.path.join(data, f))
            items = as_list(j)
        except Exception as e:
            problems.append(f'{f}: {e}')
            continue
        if fixes:
            print(f'• {f}: đã tự sửa JSON: {"; ".join(fixes)}')
        for k, x in enumerate(items, 1):
            if not isinstance(x, dict) or not nfc(x.get('tb')):
                problems.append(f'{f}: mục {k} thiếu “tb” (số thông báo) – bỏ qua')
                continue
            tb = nfc(x['tb'])
            if tb in merged and origin.get(tb) not in (OUT, f):
                print(f'• TB {tb} có ở cả {origin[tb]} và {f} – dùng bản trong {f} (file sửa sau cùng)')
            merged[tb] = x
            origin[tb] = f

    # du-lieu.csv: TB bạn sửa (bằng Excel) trong file này (khác bản du-lieu.json lúc ghi file) → lấy theo file CSV (file luôn đúng);
    # file lẻ sửa SAU file CSV thì file lẻ thắng
    xl_path = os.path.join(data, XL)
    if os.path.exists(xl_path) and not a.lam_moi:
        try:
            xitems, xerrs = doc_excel(xl_path)
            xl_mt = os.path.getmtime(xl_path)
            for e in xerrs:
                print(f'• {XL}: {e}')
            if any('bỏ hàng' in e for e in xerrs):
                xl_bad = True
                problems.append(f'{XL} có hàng lỗi bị bỏ (xem các dòng • ở trên) – sửa các hàng đó rồi chạy lại; '
                                f'chưa ghi đè {XL} để khỏi mất hàng bạn đã gõ')
            for x in xitems:
                tb = x['tb']
                if tb in dl_prev and xl_canon(x) == xl_canon(dl_prev[tb]):
                    continue  # TB này bạn không sửa trong Excel
                src = origin.get(tb)
                if src and src != OUT and os.path.getmtime(os.path.join(data, src)) > xl_mt:
                    print(f'• TB {tb}: {XL} có sửa nhưng {src} sửa sau – dùng {src}')
                    continue
                keep = {k: v for k, v in (merged.get(tb) or {}).items() if k not in XL_KNOWN}
                merged[tb] = {**x, **keep}
                xl_edit.add(tb)
                print(f'• TB {tb}: lấy bản bạn sửa trong {XL} (file luôn đúng)')
        except PermissionError:
            xl_bad = True
            problems.append(f'{XL} đang mở trong Excel – đóng file rồi chạy lại (lần này chưa đọc chỗ bạn sửa trong file)')
        except Exception as e:
            xl_bad = True
            problems.append(f'{XL}: {e} – chưa đọc chỗ bạn sửa trong file, cũng chưa ghi đè file đó')

    for tb in a.bo:
        if merged.pop(nfc(tb), None) is not None:
            print(f'• đã bỏ TB {tb} khỏi du-lieu.json')
        else:
            print(f'• không có TB {tb} để bỏ')

    # TB gốc và các phần tách (1891 và 1891-1, 1891-2) cùng có → dễ trùng
    for tb in list(merged):
        parts = [t for t in merged if re.fullmatch(re.escape(tb) + r'-\d+', t)]
        if parts:
            problems.append(f'có cả TB {tb} và {", ".join(parts)} – nếu là cùng một TB thì bỏ bớt (--bo {" ".join(parts)})')

    rows = []
    total_warn = 0
    for tb in sorted(merged, key=tb_key):
        warn, notes = [], []
        x = normalize(merged[tb], warn, notes)
        name = (x.get('nguoiNop') or {}).get('hoTen') or (x['chu'][0]['hoTen'] if x.get('chu') else '')
        rows.append((tb, name, len(x['thua']), warn, notes, origin.get(tb, '')))
        total_warn += len(warn)

    print(f'\n=== {len(rows)} TB ===')
    for tb, name, n, warn, notes, src in rows:
        print(f'TB {tb} – {name} – {n} thửa  ({src})')
        for n_ in notes:
            print(f'    • tự điền: {n_}')
        for w in warn:
            print(f'    ⚠ {w}')
    if problems:
        print('\n=== Lỗi / cần xem ===')
        for p in problems:
            print(f'✗ {p}')

    if a.kiem_tra:
        print('\n(Chỉ kiểm tra – chưa ghi file. Phiếu kiểm tra kiem_tra.py chạy sau khi ghi du-lieu.json.)')
        return 0
    result = [merged[tb] for tb in sorted(merged, key=tb_key)]
    if os.path.exists(out_path):
        shutil.copyfile(out_path, out_path + '.bak')
    with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(f'\n✓ Đã ghi {out_path}: {len(result)} TB, {sum(len(x["thua"]) for x in result)} thửa; '
          f'{total_warn} chỗ cần xem. (File làm việc của Claude – tiện ích nạp du-lieu.csv, không nạp JSON.)')
    # TB lấy theo du-lieu.csv → ghi lại vào file lẻ của TB đó (các bản thống nhất, phiếu kiểm tra không báo lệch)
    for tb in sorted(xl_edit, key=tb_key):
        src = origin.get(tb)
        if not src or src == OUT or tb not in merged:
            continue
        p = os.path.join(data, src)
        try:
            j, _ = load_loose(p)
            lst = [merged[tb] if isinstance(y, dict) and nfc(y.get('tb')) == tb else y for y in as_list(j)]
            shutil.copyfile(p, p + '.bak')
            with open(p, 'w', encoding='utf-8', newline='\n') as fh:
                json.dump(lst[0] if isinstance(j, dict) and len(lst) == 1 else lst, fh, ensure_ascii=False, indent=2)
                fh.write('\n')
            print(f'• đã ghi lại {src} theo {XL} (bản cũ: {src}.bak)')
        except Exception as e:
            print(f'✗ không ghi lại được {src} theo {XL}: {e}')
    code = phieu_kiem_tra(data, a.nguon)
    # du-lieu.csv: cùng dữ liệu, mỗi hàng một người nộp / chủ / thửa, cột Cần xem = cảnh báo khi gộp + LỖI / CẢNH BÁO của phiếu
    can_xem = {}
    for tb, name, n, warn, notes, src in rows:
        can_xem.setdefault(tb, []).extend(warn)
    try:
        import kiem_tra
        P = getattr(kiem_tra, 'LAST_PHIEU', None)
        if P is not None:
            for tb in merged:
                can_xem.setdefault(tb, []).extend(['LỖI: ' + m for m in P.muc[kiem_tra.LOI].get(tb, [])]
                                                  + P.muc[kiem_tra.CANH].get(tb, []))
    except Exception:
        pass
    can_xem = {tb: list(dict.fromkeys(v)) for tb, v in can_xem.items()}
    try:
        if xl_bad:
            raise RuntimeError('file đang có còn chỗ chưa đọc được (xem các dòng ✗ / • ở trên) – chưa ghi đè; sửa / lưu lại file đó '
                               'kiểu CSV rồi chạy lại gop_du_lieu.py (hoặc xóa / đổi tên file đó để ghi bản mới)')
        ghi_excel(xl_path, result, can_xem)
        print(f'✓ Đã ghi {xl_path} – mở bằng Excel soát cột “Cần xem”, sửa nếu cần, lưu (giữ kiểu CSV, không lưu .xlsx), rồi nạp '
              f'vào tiện ích: Dữ liệu → “Mở file CSV…” (hoặc kéo thả file vào bảng điền) → xem trước → “Nạp”.')
    except PermissionError:
        print(f'✗ {XL} đang mở trong Excel – đóng file rồi chạy lại gop_du_lieu.py để ghi bản mới')
    except Exception as e:
        print(f'✗ không ghi được {XL}: {e}')
    return code


def phieu_kiem_tra(data, nguon=None):
    """Chạy kiem_tra.py (cùng thư mục) trên thư mục data vừa gộp; trả mã thoát của phiếu (1 = còn LỖI)."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        sys.dont_write_bytecode = True  # không tạo __pycache__ trong thư mục skill
        import kiem_tra
    except Exception as e:
        print(f'\n(Không chạy được phiếu kiểm tra kiem_tra.py: {e})')
        return 0
    print('\n' + '=' * 70)
    return kiem_tra.run(data, nguon)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main() or 0)
