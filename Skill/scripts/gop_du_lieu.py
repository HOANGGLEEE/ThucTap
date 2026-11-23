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
GIAY_TO = ['Đơn đăng ký', 'Thông báo xác nhận kết quả đăng ký']
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
        info = cccd_info(so)
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

    if os.path.exists(out_path) and not a.lam_moi:
        try:
            j, fixes = load_loose(out_path)
            for x in as_list(j):
                if isinstance(x, dict) and nfc(x.get('tb')):
                    merged[nfc(x['tb'])] = x
                    origin[nfc(x['tb'])] = OUT
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
          f'{total_warn} chỗ cần xem. Mở bảng điền (Alt+Q) là tiện ích tự đọc file này.')
    return phieu_kiem_tra(data, a.nguon)


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
