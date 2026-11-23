#!/usr/bin/env python3
"""Xem PDF scan bằng mắt: render trang thành ảnh JPG rồi mở ảnh bằng công cụ đọc ảnh (Read).

  python xem_pdf.py <file.pdf> <thư mục ảnh> --luoi
      1 ảnh lưới thu nhỏ mọi trang (đánh số) – để biết trang nào là TBXN, danh sách thửa, đơn, CCCD.
  python xem_pdf.py <file.pdf> <thư mục ảnh> [--trang 1,3-4] [--scale 1.6] [--xoay 90]
      render các trang (mặc định: tất cả) ở cỡ đọc được.
  python xem_pdf.py <file.pdf> <thư mục ảnh> --trang 3 --cat 0.05,0.35,0.6,0.5 --scale 4
      phóng to 1 vùng để đọc chữ số nhỏ (số CCCD, diện tích…). Vùng = trái,trên,phải,dưới tính theo
      tỉ lệ 0–1 của trang (sau khi xoay). Cắt nhiều vùng: lặp lại --cat.

In ra đường dẫn từng ảnh và kích thước. Ảnh xám (nhẹ, dễ đọc). Không sửa file PDF gốc.
"""
import argparse
import os
import sys

import pypdfium2 as pdfium
from PIL import Image, ImageDraw


def parse_pages(spec, n):
    if not spec:
        return list(range(1, n + 1))
    out = []
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-', 1)
            out.extend(range(int(a), int(b) + 1))
        elif part:
            out.append(int(part))
    return [p for p in out if 1 <= p <= n]


def render(pdf, i, scale, rot):
    img = pdf[i - 1].render(scale=scale).to_pil().convert('L')
    if rot:
        img = img.rotate(-rot, expand=True)  # xoay theo chiều kim đồng hồ
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('ra')
    ap.add_argument('--trang', default='')
    ap.add_argument('--scale', type=float, default=1.6)
    ap.add_argument('--xoay', type=int, default=0, choices=[0, 90, 180, 270])
    ap.add_argument('--cat', action='append', default=[], help='trái,trên,phải,dưới (0–1)')
    ap.add_argument('--luoi', action='store_true', help='ảnh lưới thu nhỏ tất cả các trang')
    a = ap.parse_args()

    os.makedirs(a.ra, exist_ok=True)
    pdf = pdfium.PdfDocument(a.pdf)
    n = len(pdf)
    stem = os.path.splitext(os.path.basename(a.pdf))[0]
    stem = ('TBXN' if stem.upper().endswith('.TBXN') else 'DDK' if stem.upper().endswith('.DDK') else stem[:20])
    print(f'{os.path.basename(a.pdf)}: {n} trang')

    if a.luoi:
        thumbs = []
        for i in range(1, n + 1):
            t = render(pdf, i, 0.45, a.xoay)
            lab = Image.new('L', (t.width, 26), 255)
            ImageDraw.Draw(lab).text((6, 6), f'trang {i}', fill=0)
            box = Image.new('L', (t.width, t.height + 26), 255)
            box.paste(lab, (0, 0))
            box.paste(t, (0, 26))
            thumbs.append(box)
        cols = 4 if n > 6 else max(1, min(n, 3))
        w = max(t.width for t in thumbs)
        h = max(t.height for t in thumbs)
        rows = (n + cols - 1) // cols
        sheet = Image.new('L', (cols * (w + 8), rows * (h + 8)), 200)
        for k, t in enumerate(thumbs):
            sheet.paste(t, ((k % cols) * (w + 8), (k // cols) * (h + 8)))
        if max(sheet.size) > 2400:
            r = 2400 / max(sheet.size)
            sheet = sheet.resize((int(sheet.width * r), int(sheet.height * r)))
        p = os.path.join(a.ra, f'{stem}_luoi.jpg')
        sheet.save(p, quality=80)
        print(p, sheet.size)
        return

    for i in parse_pages(a.trang, n):
        img = render(pdf, i, a.scale, a.xoay)
        if a.cat:
            for k, c in enumerate(a.cat, 1):
                x0, y0, x1, y1 = [float(v) for v in c.split(',')]
                crop = img.crop((int(x0 * img.width), int(y0 * img.height), int(x1 * img.width), int(y1 * img.height)))
                p = os.path.join(a.ra, f'{stem}_p{i}_vung{k}.jpg')
                crop.save(p, quality=90)
                print(p, crop.size)
        else:
            if max(img.size) > 2200:
                r = 2200 / max(img.size)
                img = img.resize((int(img.width * r), int(img.height * r)))
            p = os.path.join(a.ra, f'{stem}_p{i}.jpg')
            img.save(p, quality=85)
            print(p, img.size)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
