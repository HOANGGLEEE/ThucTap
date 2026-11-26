#!/usr/bin/env python3
"""Tạo khung JSON cho TB từ thư mục hồ sơ quét `TB <số>` (tên file theo Quy định đặt tên HSQ 25.10).

Dùng:
  python khung_tb.py "<thư mục TB 1891>" ["<thư mục TB khác>" ...] --ra "<thư mục data của tiện ích>"
  python khung_tb.py "<thư mục cha chứa nhiều thư mục TB xxxx>" --ra "<thư mục data>"

Việc script làm (chỉ dựa vào TÊN FILE, chưa đọc nội dung PDF):
  - tìm các cặp `KH 2959.07777.<tờ>.<thửa>-….TBXN.pdf` / `.DDK.pdf`, đếm trang từng file;
  - thư mục có 2 cặp trở lên mà nội dung TBXN giống nhau (so ảnh từng trang – bản sao ký số lại vẫn tính là giống)
    = 1 TB bị tách tên vì tên file quá dài
    → gộp lại thành 1 TB, Số biên nhận = KH 2959.07777. + TẤT CẢ tờ.thửa (nối bằng “-”);
  - các cặp có TBXN khác nhau → coi là các hồ sơ riêng: <số>-1, <số>-2… (và cảnh báo);
  - ghi khung <data>/TB_<số>.json: thửa có sẵn số tờ, số thửa; các trường khác để trống để điền
    sau khi đọc PDF. Không ghi đè file đã có (trừ khi thêm --ghi-de).
"""
import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata

PREFIX = 'KH 2959.07777.'
NGUON_GOC = 'Công nhận QSDĐ như giao đất không thu tiền sử dụng đất'
GIAY_TO = ['Đơn đăng ký', 'Thông báo xác nhận kết quả đăng ký']
RE_FILE = re.compile(r'^KH\s*2959\.07777\.(.+?)\.(TBXN|DDK)\.pdf$', re.I)
RE_PAIR = re.compile(r'^(\d+)\.(\d+[A-Za-z]?)$')
RE_TB = re.compile(r'TB\s*[_\- ]?\s*(\d{2,5})', re.I)


def nfc(s):
    return unicodedata.normalize('NFC', s)


def sha1(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def content_sig(path):
    """Dấu nội dung: ảnh thu nhỏ từng trang. Hai bản sao cùng nội dung (vd. ký số lại, khác giờ ký) cho cùng dấu."""
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(path)
        return tuple(hashlib.sha1(pdf[i].render(scale=0.25).to_pil().convert('L').tobytes()).hexdigest()
                     for i in range(len(pdf)))
    except Exception:
        return (sha1(path),)


def page_count(path):
    try:
        import pypdfium2 as pdfium
        return len(pdfium.PdfDocument(path))
    except Exception:
        try:
            from pypdf import PdfReader
            return len(PdfReader(path).pages)
        except Exception:
            return None


def pair_key(pair):
    m = RE_PAIR.match(pair)
    if not m:
        return (10 ** 9, pair)
    return (int(m.group(1)), int(re.sub(r'\D', '', m.group(2)) or 0))


def scan_folder(folder):
    """Trả về (số TB, danh sách TB-khung, các dòng báo cáo)."""
    base = nfc(os.path.basename(os.path.normpath(folder)))
    m = RE_TB.search(base)
    tb = m.group(1) if m else None
    lines = [f'== {base}']
    if not tb:
        lines.append('  ✗ tên thư mục không có số TB (cần dạng “TB 1891”) – bỏ qua')
        return None, [], lines
    groups = {}
    others = []
    for f in sorted(os.listdir(folder)):
        if not f.lower().endswith('.pdf'):
            continue
        mm = RE_FILE.match(nfc(f).strip())
        if not mm:
            others.append(f)
            continue
        groups.setdefault(mm.group(1).strip(), {})[mm.group(2).upper()] = os.path.join(folder, f)
    for f in others:
        lines.append(f'  ? file không đúng mẫu tên 25.10, bỏ qua: {f}')
    if not groups:
        lines.append('  ✗ không có cặp TBXN/DDK nào đúng mẫu tên')
        return tb, [], lines

    halves = []
    for stem, g in groups.items():
        pairs = [p.strip() for p in stem.split('-') if p.strip()]
        bad = [p for p in pairs if not RE_PAIR.match(p)]
        info = {k: (os.path.basename(v), page_count(v)) for k, v in g.items()}
        for k in ('TBXN', 'DDK'):
            if k not in g:
                lines.append(f'  ✗ thiếu file {k} cho “{stem}”')
        if bad:
            lines.append(f'  ✗ tờ.thửa không đọc được trong tên file: {", ".join(bad)}')
        halves.append({'stem': stem, 'pairs': pairs, 'files': g, 'info': info,
                       'tbxn': content_sig(g['TBXN']) if 'TBXN' in g else None,
                       'ddk': content_sig(g['DDK']) if 'DDK' in g else None})

    for h in halves:
        for k, (name, pages) in h['info'].items():
            lines.append(f'  {k}: {name} ({pages if pages is not None else "?"} trang)')

    out = []
    tbxn_hashes = {h['tbxn'] for h in halves if h['tbxn']}
    ddk_hashes = {h['ddk'] for h in halves if h['ddk']}
    if len(halves) > 1 and len(tbxn_hashes) == 1 and len(ddk_hashes) > 1:
        lines.append('  ⚠ các bản TBXN giống nhau nhưng các bản DDK KHÁC nhau – xem lại thư mục này')
    if len(halves) == 1:
        h = halves[0]
        out.append((tb, h['pairs'], ''))
    elif len(tbxn_hashes) == 1:
        # cùng 1 TBXN, tên file bị chia đôi vì quá dài → 1 TB
        halves.sort(key=lambda h: pair_key(h['pairs'][0]))
        pairs = [p for h in halves for p in h['pairs']]
        note = ''  # người dùng 23/11: không ghi chú chuyện nhiều cặp PDF – người nhập không cần
        lines.append(f'  • {len(halves)} cặp PDF cùng nội dung → gộp 1 TB, {len(pairs)} thửa. NHỚ: thứ tự các nhóm thửa đang '
                     f'tạm theo tên file – đối chiếu STT trên danh sách thửa của TBXN, sai thì sắp lại cả “thua” lẫn Số biên nhận.')
        out.append((tb, pairs, note))
    else:
        lines.append(f'  ⚠ {len(halves)} cặp PDF có TBXN KHÁC nhau → tạo {len(halves)} hồ sơ {tb}-1, {tb}-2… – kiểm tra lại')
        halves.sort(key=lambda h: pair_key(h['pairs'][0]))
        for k, h in enumerate(halves, 1):
            out.append((f'{tb}-{k}', h['pairs'], f'Thư mục TB {tb} có nhiều cặp PDF khác nội dung – đây là cặp “{h["stem"]}”.'))

    result = []
    for tb_id, pairs, note in out:
        thua = []
        for p in pairs:
            mm = RE_PAIR.match(p)
            to, so = (mm.group(1), mm.group(2)) if mm else ('', p)
            thua.append({'soThua': so, 'soTo': to, 'dienTich': '', 'mdsd': '', 'diaChi': '',
                         'thoiHan': '50 năm', 'nguonGoc': NGUON_GOC})
        result.append({
            'tb': tb_id,
            'soBienNhan': PREFIX + '-'.join(pairs),
            'diaChiTaiSan': '',
            'nguoiNop': {'hoTen': '', 'soGiayTo': '', 'diaChi': ''},
            'chu': [{'hoTen': '', 'namSinh': '', 'gioiTinh': '', 'loaiGiayTo': 'Căn cước công dân',
                     'soGiayTo': '', 'noiCap': '', 'diaChi': ''}],
            'thua': thua,
            'giayTo': list(GIAY_TO),
            'ghiChu': note,
        })
        lines.append(f'  → TB {tb_id}: {len(pairs)} thửa | Số biên nhận: {PREFIX + "-".join(pairs)}')
    return tb, result, lines


def main():
    ap = argparse.ArgumentParser(description='Tạo khung TB_<số>.json từ thư mục hồ sơ quét TB <số>.')
    ap.add_argument('thu_muc', nargs='+', help='thư mục “TB <số>” hoặc thư mục cha chứa nhiều thư mục TB')
    ap.add_argument('--ra', required=True, help='thư mục ghi TB_<số>.json (thường là thư mục data của tiện ích)')
    ap.add_argument('--ghi-de', action='store_true', help='ghi đè TB_<số>.json đã có')
    a = ap.parse_args()

    folders = []
    for d in a.thu_muc:
        d = os.path.abspath(d)
        if not os.path.isdir(d):
            print(f'✗ không có thư mục: {d}')
            continue
        if RE_TB.search(os.path.basename(d)):
            folders.append(d)
        else:
            subs = [os.path.join(d, x) for x in sorted(os.listdir(d)) if os.path.isdir(os.path.join(d, x)) and RE_TB.search(x)]
            if not subs:
                print(f'✗ {d}: không phải thư mục TB và không chứa thư mục “TB <số>” nào')
            folders.extend(subs)

    os.makedirs(a.ra, exist_ok=True)
    made = 0
    for f in folders:
        _, items, lines = scan_folder(f)
        print('\n'.join(lines))
        for it in items:
            path = os.path.join(a.ra, f'TB_{it["tb"]}.json')
            if os.path.exists(path) and not a.ghi_de:
                print(f'  • đã có {os.path.basename(path)} – không ghi đè (thêm --ghi-de nếu muốn làm lại)')
                continue
            with open(path, 'w', encoding='utf-8', newline='\n') as fh:
                json.dump(it, fh, ensure_ascii=False, indent=2)
                fh.write('\n')
            made += 1
            print(f'  ✓ đã ghi khung {path}')
    print(f'\nXong: {made} file khung. Bước sau: đọc TBXN + DDK rồi điền các trường còn trống.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
