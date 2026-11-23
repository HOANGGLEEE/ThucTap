// VBDLIS Điền Nhanh – bộ điền (chạy trong từng khung của trang VBDLIS)
// Tìm ô theo NHÃN hiển thị trên màn hình (vd. "Số thửa", "Số giấy tờ"), không phụ thuộc id của trang.
// Bấm nút MỞ cửa sổ nhập: "+ Thêm thửa đất" (màn hình tiếp nhận) và "Thêm → Cá nhân" / "Thêm → Thửa đất"
// (cửa sổ Nhập đơn đăng ký). Nút Lưu được bấm: "Lưu" của cửa sổ CHỦ SỬ DỤNG (bạn yêu cầu nhập chủ tự động), "Lưu" cửa sổ
// THỬA ĐẤT khi bật “Tự động hết” – qua 2 lệnh markSave → clickMark; và các nút bảng điền gửi qua lệnh clickBtn
// (Lưu hồ sơ, Lưu thông tin đăng ký, Hoàn tất, Đóng – chỉ khi bật “Tự động hết”). Bộ điền không bao giờ bấm Kết ISO / Chuyển tiếp /
// Thực thi / Trả hồ sơ: Chuyển tiếp + Thực thi (chuyển hồ sơ cho đúng tài khoản) do bảng điền tự bấm, có kiểm tra riêng.
(() => {
  const VERSION = 30;
  // cửa sổ chủ sử dụng (cùng mẫu với bảng điền)
  const CHU_WIN = /^((thong tin|them|moi|cap nhat|sua|chi tiet) )*(ca nhan|chu su dung|nguoi su dung|chu so huu)\b/;
  const THUA_WIN = /^((them|moi|thong tin|chi tiet|cap nhat|sua) )*thua dat\b/;
  // nút bộ điền KHÔNG BAO GIỜ bấm qua clickBtn / answerDialog (kể cả khi bật “Tự động hết”)
  const NEVER_BTN = /^(ket iso|chuyen tiep|thuc thi|tra ho so|xoa|xoa ho so|huy ho so)$/;
  // tab Trường – nút của màn hình: bạn tích nút nào thì “Điền” / “Điền ngay” bấm nút đó, theo thứ tự bạn đặt.
  // Không khóa nút nào (bạn yêu cầu 22/11: “không có nút nào bị cấm tick”) – chỉ bấm khi BẠN bấm Điền; ▶ / 🤖 không dùng các nút này.
  if (window.__vbdlis && window.__vbdlis.v === VERSION) return;
  const TOKEN = Math.random().toString(36).slice(2, 8); // đánh dấu riêng cho lần nạp này (tránh nhầm dấu cũ)
  let lastFill = null; // kết quả lần điền gần nhất (cho bước kiểm tra lại)
  let seq = 0;
  let fillSeq = 0;
  let chain = Promise.resolve(); // các lệnh điền chạy lần lượt, không chồng nhau
  // lần cuối BẠN gõ phím, hoặc bấm vào một ô nhập trên trang (không tính bảng điền) – để không giành con trỏ khi bạn đang gõ
  // (bấm nút Lưu của cửa sổ trước không tính, để cửa sổ sau vẫn được đặt sẵn con trỏ)
  let lastUserAct = 0;
  const noteUser = (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (t && t.id === 'vbdlis-dien-nhanh-host') return;
    if (e.type === 'mousedown' && !(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .select2-container')))
      return;
    lastUserAct = Date.now();
  };
  document.addEventListener('keydown', noteUser, true);
  document.addEventListener('mousedown', noteUser, true);
  // viền vàng tạm cho một nút: nhớ viền gốc một lần, lần tô sau thay hẹn giờ cũ (không bị dính viền)
  const ring = (b, color, ms) => {
    if (b.dataset.vbdlisRing === undefined) b.dataset.vbdlisRing = b.style.boxShadow || '';
    b.style.boxShadow = `0 0 0 4px ${color}`;
    clearTimeout(b.__vbdlisRingT);
    b.__vbdlisRingT = setTimeout(() => {
      b.style.boxShadow = b.dataset.vbdlisRing || '';
      delete b.dataset.vbdlisRing;
    }, ms);
  };

  // ---------- Cấu hình các màn hình ----------
  // scope: 'page' = màn hình tiếp nhận (bỏ qua cửa sổ con), 'modal' = cửa sổ con đang mở trên cùng
  // kind: 'text' ô gõ chữ, 'select' danh sách chọn, 'checkbox' ô tích, 'any' loại nào cũng được
  // optional: cửa sổ có thể không có ô đó → không báo lỗi khi không thấy
  // exact: danh sách chọn phải khớp đúng chữ (không đoán gần đúng)
  // numeric: ô số (diện tích) – dữ liệu phải là số dùng dấu chấm thập phân
  // expect: tên cửa sổ hợp lệ cho màn hình này (không điền nhầm vào cửa sổ khác)
  const SECTIONS = {
    // --- các bước của "Chạy cả TB" (màn hình Tiếp nhận hồ sơ) ---
    donVi: {
      scope: 'page',
      fields: [{ key: 'phuongXa', name: 'Phường/Xã', labels: ['Phường/Xã', 'Phường/Xã/Thị trấn'], kind: 'select', exact: true }],
    },
    quyTrinh: {
      scope: 'page',
      fields: [{ key: 'quyTrinh', name: 'Quy trình/Thủ tục', labels: ['Quy trình/Thủ tục', 'Quy trình'], kind: 'select' }],
    },
    soBN: {
      scope: 'page',
      fields: [{ key: 'soBienNhan', name: 'Số biên nhận', labels: ['Số biên nhận'], kind: 'text' }],
    },
    nguoiNop: {
      scope: 'page',
      fields: [
        { key: 'diaChiTaiSan', name: 'Địa chỉ tài sản', labels: ['Địa chỉ tài sản'], kind: 'text', optional: true },
        { key: 'nguoiNop', name: 'Người nộp hồ sơ', labels: ['Người nộp hồ sơ'], kind: 'text' },
        { key: 'soGiayTo', name: 'Số giấy tờ', labels: ['Số giấy tờ'], kind: 'text' },
        { key: 'diaChi', name: 'Địa chỉ', labels: ['Địa chỉ'], kind: 'text' },
      ],
    },
    bienNhan: {
      scope: 'page',
      fields: [
        { key: 'soBienNhan', name: 'Số biên nhận', labels: ['Số biên nhận'], kind: 'text' },
        { key: 'diaChiTaiSan', name: 'Địa chỉ tài sản', labels: ['Địa chỉ tài sản'], kind: 'text', optional: true },
        { key: 'nguoiNop', name: 'Người nộp hồ sơ', labels: ['Người nộp hồ sơ'], kind: 'text' },
        { key: 'soGiayTo', name: 'Số giấy tờ', labels: ['Số giấy tờ'], kind: 'text' },
        { key: 'diaChi', name: 'Địa chỉ', labels: ['Địa chỉ'], kind: 'text' },
      ],
    },
    chu: {
      scope: 'modal',
      expect: /^((thong tin|them|moi|cap nhat|sua|chi tiet) )*(ca nhan|chu su dung|nguoi su dung|chu so huu)\b/,
      keyLabels: ['Họ tên chủ', 'Họ và tên'],
      fields: [
        { key: 'loaiDoiTuong', name: 'Loại đối tượng', labels: ['Loại đối tượng'], kind: 'select', optional: true, exact: true },
        { key: 'danToc', name: 'Dân tộc', labels: ['Dân tộc'], kind: 'select', optional: true, exact: true },
        { key: 'quocTich', name: 'Quốc tịch 1', labels: ['Quốc tịch 1', 'Quốc tịch'], kind: 'select', optional: true, exact: true },
        { key: 'loaiGiayTo', name: 'Loại giấy tờ', labels: ['Loại giấy tờ'], kind: 'select', exact: true },
        { key: 'hoTen', name: 'Họ tên chủ', labels: ['Họ tên chủ', 'Họ tên', 'Họ và tên'], kind: 'text' },
        { key: 'ngaySinh', name: 'Ngày sinh', labels: ['Ngày sinh'], kind: 'text', force: true, widget: true },
        { key: 'namSinh', name: 'Năm sinh', labels: ['Năm sinh'], kind: 'text', force: true },
        { key: 'gioiTinhNam', name: 'Giới tính (ô Nam)', labels: ['Giới tính'], kind: 'checkbox', checkText: 'nam' },
        { key: 'soGiayTo', name: 'Số giấy tờ', labels: ['Số giấy tờ'], kind: 'text' },
        { key: 'noiCap', name: 'Nơi cấp', labels: ['Nơi cấp'], kind: 'any', exact: true },
        { key: 'diaChi', name: 'Địa chỉ chi tiết', labels: ['Địa chỉ chi tiết', 'Địa chỉ'], kind: 'text' },
      ],
      // đang mở "Nhập đơn đăng ký" → tự bấm "Thêm" → "Cá nhân" (chỉ mở cửa sổ nhập, không bấm Lưu)
      menu: {
        inside: /^nhap don dang ky\b/,
        ids: ['btnThemChuSuDung'],
        title: 'Thêm chủ sử dụng',
        item: 'Cá nhân',
        label: 'Thêm → Cá nhân',
        dup: (root, v) => {
          const t = treeText(root, 'treeChuSuDung');
          if (t === null) return '';
          const digits = String(v.soGiayTo || '').replace(/\D/g, '');
          let has;
          if (digits.length >= 9) has = new RegExp(`(^|\\D)${digits}(\\D|$)`).test(t);
          else {
            // cây ghi “Năm sinh:1957” → bỏ dấu hai chấm trước khi so
            const nt = norm(t).replace(/\s*:\s*/g, ' ');
            has = !!v.hoTen && nt.includes(norm(v.hoTen)) && (!v.namSinh || nt.includes('nam sinh ' + v.namSinh));
          }
          return has
            ? `chủ “${v.hoTen}” đã có trong đơn (mục Chủ sử dụng) – không thêm nữa. Cần sửa thì chọn chủ đó, bấm “Sửa” trên VBDLIS rồi bấm Điền`
            : '';
        },
      },
    },
    // dùng cho cả cửa sổ "Thêm thửa đất" (gọn) và "Thông tin thửa đất" (đầy đủ); KHÔNG dùng cho "Tìm thửa đất"
    thua: {
      scope: 'modal',
      opener: ['Thêm thửa đất'], // chưa mở cửa sổ nào → tự bấm nút này trên trang rồi điền
      expect: /^((them|moi|thong tin|chi tiet|cap nhat|sua) )*thua dat\b/,
      keyLabels: ['Số thửa', 'Số thứ tự thửa'],
      fields: [
        { key: 'mdsd', name: 'MĐSD cấp giấy', labels: ['MĐSD cấp giấy', 'Mục đích sử dụng'], kind: 'select', optional: true },
        { key: 'soThua', name: 'Số thửa', labels: ['Số thửa', 'Số thứ tự thửa', 'Thửa đất số'], kind: 'text' },
        { key: 'soTo', name: 'Số tờ', labels: ['Số tờ', 'Số hiệu tờ bản đồ', 'Tờ bản đồ số', 'Tờ bản đồ'], kind: 'text' },
        { key: 'dienTich', name: 'Diện tích', labels: ['Diện tích'], kind: 'text', all: true, widget: true, numeric: true },
        { key: 'dienTichPL', name: 'Diện tích PL', labels: ['Diện tích PL', 'Diện tích pháp lý'], kind: 'text', optional: true, widget: true, numeric: true },
        { key: 'nguonGoc', name: 'Nguồn gốc đất', labels: ['Nguồn gốc đất', 'Nguồn gốc sử dụng đất'], kind: 'select', optional: true, exact: true },
        { key: 'thoiHan', name: 'Thời hạn SD', labels: ['Thời hạn SD', 'Thời hạn sử dụng'], kind: 'any', optional: true, force: true, exact: true },
        { key: 'diaChi', name: 'Địa chỉ', labels: ['Địa chỉ chi tiết', 'Địa chỉ'], kind: 'text' },
      ],
      menu: {
        inside: /^nhap don dang ky\b/,
        ids: ['btnThemTaiSan'],
        title: 'Thêm tài sản',
        item: 'Thửa đất',
        label: 'Thêm → Thửa đất',
        dup: (root, v) => {
          const t = treeText(root, 'treeTaiSan');
          if (t === null || !v.soThua || !v.soTo) return '';
          const n = (x) => {
            const y = String(x).trim();
            return /^\d+$/.test(y) ? String(parseInt(y, 10)) : y.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          };
          const re = new RegExp(`(^|[^\\d])0*${n(v.soThua)}\\s*\\(\\s*0*${n(v.soTo)}\\s*\\)`);
          return re.test(t)
            ? `thửa ${v.soThua} tờ ${v.soTo} đã có trong đơn (mục Thửa đất và tài sản) – không thêm nữa. Cần sửa thì chọn thửa đó, bấm “Sửa” trên VBDLIS rồi bấm Điền`
            : '';
        },
      },
    },
    // cửa sổ "Nhập đơn đăng ký" (bước xử lý hồ sơ): Điều kiện cấp giấy, Đăng ký lần đầu
    donDK: {
      scope: 'modal',
      expect: /^nhap don dang ky\b/,
      keyLabels: ['Điều kiện cấp giấy'],
      fields: [
        { key: 'dieuKienCapGiay', name: 'Điều kiện cấp giấy', labels: ['Điều kiện cấp giấy'], kind: 'select', exact: true },
        { key: 'dangKyLanDau', name: 'Đăng ký lần đầu', labels: ['Đăng ký lần đầu'], kind: 'checkbox' },
      ],
    },
    // có cửa sổ "Thông tin hồ sơ quét" thì điền vào đó; KHÔNG mở cửa sổ nào thì điền ô "Tên tài liệu muốn thêm"
    giayTo: {
      scope: 'modal',
      fallback: 'giayToPage',
      expect: /^((thong tin|them|cap nhat|sua) )*(ho so quet|giay to dinh kem|tai lieu dinh kem)\b/,
      keyLabels: ['Tên giấy tờ'],
      fields: [
        { key: 'loai', name: 'Loại giấy tờ', labels: ['Loại giấy tờ'], kind: 'select', exact: true },
        { key: 'moTa', name: 'Mô tả', labels: ['Mô tả'], kind: 'text' },
        { key: 'ten', name: 'Tên giấy tờ', labels: ['Tên giấy tờ'], kind: 'text' },
      ],
    },
    giayToPage: {
      scope: 'page',
      fields: [{ key: 'ten', name: 'Tên tài liệu muốn thêm', labels: ['Tên tài liệu muốn thêm', 'Tên tài liệu'], kind: 'text' }],
    },
  };

  // ---------- Tiện ích ----------
  // norm: bỏ dấu, chữ thường – CHỈ dùng để tìm nhãn / lựa chọn, không dùng để so giá trị đã điền
  const norm = (s) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[*:：?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  // so giá trị: giữ nguyên dấu tiếng Việt, chỉ bỏ khác biệt hoa/thường và khoảng trắng
  const normVal = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  // tốc độ tự động (bảng điền gửi kèm mỗi lệnh): Chậm / Rất chậm → chờ trang lâu hơn; Nhanh không làm bộ điền chờ ít đi
  let SPEEDK = 1;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SPEEDK));
  const PANEL_HOST = 'vbdlis-dien-nhanh-host';
  const CANON_NUM = /^\d+(\.\d+)?$/; // số dùng dấu chấm thập phân, vd 56.5

  const isVisible = (el) => {
    if (!el || !el.isConnected || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  const CTRL =
    'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]), select, textarea';
  const LABEL_SEL = 'label, span, div, td, th, b, strong, p, legend, dt, font, i, em';
  const MODAL_SEL = '.modal, [role="dialog"], .ui-dialog, .k-window, .bootbox, .swal2-popup, .layui-layer';
  // không leo qua các khối này khi tìm ô đi kèm nhãn (tránh lấy ô của trường/mục bên cạnh)
  const STOP_SEL = '.row, .form-group, .panel-body, .card-body';
  const HARD_STOP = 'fieldset, form, table, .modal-body, .modal-content, .modal-dialog';
  const BTN_LIKE = 'a, button, .btn, [role="button"]';
  // Ô có mặt nạ / định dạng của trang (Inputmask, AutoNumeric, lịch chọn ngày): gõ thẳng thì trang làm sai
  // (vd. "22" → "2", "78.1" → "m²") → điền luôn MỘT lần bằng thư viện của trang (bước 2), không gõ trước
  const MASKED = '.number, .area, .datepicker, .hasDatepicker, [data-inputmask], [im-insert]';
  const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  const directOK = (c, v) => {
    if (c.tagName !== 'INPUT' || !c.matches(MASKED)) return false;
    if (c.matches('.datepicker, .hasDatepicker')) return DATE_RE.test(v);
    return CANON_NUM.test(v); // ô số / diện tích / mặt nạ: chỉ khi là số dạng 56.5
  };
  // chữ của cây danh sách (vd. cây Chủ sử dụng / Thửa đất trong cửa sổ Nhập đơn đăng ký); null = không có cây
  const treeText = (root, id) => {
    const t = root.querySelector('#' + id);
    return t ? (t.textContent || '').replace(/\s+/g, ' ') : null;
  };
  // từng nút của cây (jstree: li > a.jstree-anchor, con nằm trong ul lồng) kèm độ sâu; null = không có cây
  const treeNodes = (root, id) => {
    const t = root.querySelector('#' + id);
    if (!t) return null;
    const out = [];
    const lis = t.querySelectorAll('li');
    if (!lis.length) {
      String(t.innerText || t.textContent || '')
        .split(/\n+/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .forEach((text) => out.push({ text, level: 0 }));
      return out;
    }
    for (const li of lis) {
      const a = li.querySelector(':scope > a, :scope > .jstree-anchor');
      let text;
      if (a) text = a.textContent;
      else {
        const c = li.cloneNode(true);
        c.querySelectorAll('ul, ol').forEach((x) => x.remove());
        text = c.textContent;
      }
      text = String(text || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      let level = 0;
      for (let p = li.parentElement; p && p !== t; p = p.parentElement) if (p.tagName === 'LI') level++;
      out.push({ text, level });
    }
    return out;
  };

  const zIndexOf = (el) => {
    let z = 0;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const v = parseInt(getComputedStyle(e).zIndex, 10);
      if (!isNaN(v)) z = Math.max(z, v);
    }
    return z;
  };

  // cửa sổ “ma”: Bootstrap đã bỏ lớp in / show (đang đóng) hoặc gần như trong suốt – trên màn hình không còn thấy
  function modalPhantom(m) {
    if (m.classList.contains('modal') && m.classList.contains('fade') && !m.classList.contains('in') && !m.classList.contains('show')) return true;
    let op = 1;
    for (let e = m.querySelector('.modal-dialog, .modal-content') || m; e && e !== document.documentElement; e = e.parentElement) {
      const v = parseFloat(getComputedStyle(e).opacity);
      if (!isNaN(v)) op *= v;
    }
    return op < 0.1;
  }
  function openModals() {
    const ms = [...document.querySelectorAll(MODAL_SEL)].filter(
      (m) => isVisible(m) && !m.closest('#' + PANEL_HOST) && !modalPhantom(m) && [...m.querySelectorAll(CTRL)].some(usable)
    );
    return ms.filter((m) => !ms.some((o) => o !== m && o.contains(m))); // giữ lớp ngoài cùng
  }

  // Cửa sổ m có đang lộ ra (không bị cửa sổ khác che) không: thử vài điểm trong khung cửa sổ.
  // true / false; null = không thử được (khung ngoài màn hình hoặc bị bảng điền che hết)
  const z0 = (el) => {
    const v = parseInt(getComputedStyle(el).zIndex, 10);
    return isNaN(v) ? 0 : v;
  };
  function exposed(m) {
    const box = m.querySelector('.modal-dialog, .modal-content, .ui-dialog-content, .k-window-content') || m;
    const r = box.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const pts = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.5, 0.08], [0.25, 0.75], [0.75, 0.75], [0.1, 0.5]];
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      if (x < 1 || y < 1 || x > innerWidth - 2 || y > innerHeight - 2) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit.closest('#' + PANEL_HOST + ', #vbdlis-rec-host')) continue; // bảng điền / huy hiệu ghi che → thử điểm khác
      return m.contains(hit);
    }
    return null;
  }

  function topModal() {
    const ms = openModals();
    if (!ms.length) return null;
    if (ms.length > 1) {
      // nhiều cửa sổ cùng hiện (vd. "Quy trình xử lý" nằm dưới "Nhập đơn đăng ký"): lấy cái thật sự nằm trên cùng
      const vis = ms.filter((m) => exposed(m) === true);
      if (vis.length === 1) return vis[0];
    }
    ms.sort(
      (a, b) =>
        z0(a) - z0(b) ||
        zIndexOf(a) - zIndexOf(b) ||
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
    );
    return ms[ms.length - 1];
  }
  const modalOf = (el) => (el && el.closest(MODAL_SEL)) || null;

  // Tên cửa sổ: ưu tiên phần tử tiêu đề thật (.modal-title…), bỏ chữ của nút (×, Đóng…)
  function modalTitle(m) {
    const ownText = (t) => {
      const c = t.cloneNode(true);
      c.querySelectorAll('button, .close, a, select, input, textarea, .btn').forEach((x) => x.remove());
      return (c.textContent || '').replace(/\s+/g, ' ').trim();
    };
    const pick = (sel) => {
      for (const t of m.querySelectorAll(sel)) {
        const s = ownText(t);
        if (s && s.length <= 80) return s;
      }
      return '';
    };
    return (
      pick('.modal-title, .ui-dialog-title, .k-window-title, .swal2-title') ||
      pick('.modal-header h1, .modal-header h2, .modal-header h3, .modal-header h4, .modal-header h5, .modal-header strong') ||
      pick('.modal-header, [class*="title"], [class*="header"], h1, h2, h3, h4, h5')
    );
  }
  const titleKey = (s) => norm(s).replace(/^[^a-z0-9]+/, '');
  function scopeName(m) {
    if (!m) return 'màn hình chính';
    return `cửa sổ “${modalTitle(m) || 'không tên'}”`;
  }

  function getScope(type) {
    if (type === 'modal') {
      const m = topModal();
      return m ? { root: m, exclude: [], name: scopeName(m), title: modalTitle(m) } : null;
    }
    return { root: document.body, exclude: openModals(), name: scopeName(null), title: '' };
  }

  // Tìm các phần tử nhãn có chữ đúng bằng `text` (bỏ dấu, bỏ * : ?)
  function findLabels(scope, text) {
    const t = norm(text);
    if (!t) return [];
    const hits = [];
    for (const el of scope.root.querySelectorAll(LABEL_SEL)) {
      const raw = el.textContent;
      if (!raw || raw.length > 80) continue;
      if (norm(raw) !== t) continue;
      if (el.closest('#' + PANEL_HOST)) continue;
      if (scope.exclude.some((r) => r.contains(el))) continue;
      if (!isVisible(el)) continue;
      hits.push(el);
    }
    const deep = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
    const labels = deep.filter((el) => el.tagName === 'LABEL');
    if (labels.length) return labels;
    const others = deep.filter((el) => el.tagName !== 'TH');
    return others.length ? others : deep;
  }

  const fits = (c, kind) => {
    const tag = c.tagName;
    const type = (c.type || '').toLowerCase();
    if (kind === 'checkbox') return tag === 'INPUT' && type === 'checkbox';
    if (tag === 'INPUT' && (type === 'checkbox' || type === 'radio')) return false;
    if (kind === 'select') return tag === 'SELECT';
    if (kind === 'text') return tag === 'INPUT' || tag === 'TEXTAREA';
    return true;
  };
  // select bị thư viện (select2/chosen…) ẩn đi vẫn dùng được nếu khung chứa nó đang hiện;
  // ô tích / ô chọn kiểu “tô đẹp” (ô thật bị ẩn, hiện hình vẽ thay) cũng vậy
  const usable = (c) =>
    isVisible(c) || ((c.tagName === 'SELECT' || c.type === 'checkbox' || c.type === 'radio') && !!c.parentElement && isVisible(c.parentElement));
  // ô tích theo chữ của chính nó (label[for], nhãn bọc ô, hoặc chữ ngay cạnh) – phải đúng MỘT ô
  function checkByOwnText(scope, text) {
    const k = textKey(text);
    if (!k) return null;
    const cs = [...scope.root.querySelectorAll('input[type=checkbox]')].filter(
      (c) => usable(c) && !c.closest('#' + PANEL_HOST) && !scope.exclude.some((r) => r.contains(c)) && nearText(c, null) === k
    );
    return cs.length === 1 ? cs[0] : null;
  }

  function firstUsableCtrl(s) {
    if (s.matches(CTRL)) return usable(s) ? s : null;
    return [...s.querySelectorAll(CTRL)].find(usable) || null;
  }
  // chữ "thật" (bỏ * ? : và ký hiệu) – dùng để nhận biết nhãn/giá trị của trường khác
  const textKey = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const isUnit = (t) => /^(m|m2|m 2|ha|vnd|dong)$/.test(t); // "m²", "VNĐ"… đứng cạnh ô
  // khối s có chữ riêng (nhãn của trường khác) đứng trước ô c → ô đó không thuộc nhãn đang xét
  function foreignTextBefore(s, c) {
    for (const l of s.querySelectorAll(LABEL_SEL)) {
      if (l.contains(c) || l.querySelector(CTRL)) continue; // khung bọc ô, không phải nhãn
      if (l.closest(BTN_LIKE)) continue; // chữ trên nút / đường link
      if (!(l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (textKey(l.textContent)) return true;
    }
    return false;
  }

  // Từ nhãn, tìm ô nhập đi kèm: for=… (chỉ trong phạm vi), ô nằm trong nhãn, hoặc ô ĐẦU TIÊN ở phần tử liền sau.
  // Ô đầu tiên sai loại / thuộc nhãn khác → trả null (báo lỗi) chứ không đi tìm tiếp sang trường khác.
  // Chữ nhãn nằm trong <span>/<b> của một <label> → dùng chính <label> đó (để có for= và đi tiếp đúng chỗ)
  function labelElOf(lab, scope) {
    if (lab.tagName === 'LABEL') return lab;
    const L = lab.closest('label');
    return L && (!scope || scope.root.contains(L)) ? L : lab;
  }
  function findControl(lab0, kind, scope) {
    const lab = labelElOf(lab0, scope);
    const inScope = (c) =>
      !c.closest('#' + PANEL_HOST) && (!scope || (scope.root.contains(c) && !scope.exclude.some((r) => r.contains(c))));
    if (lab.htmlFor) {
      const cands = [...document.querySelectorAll(`[id="${CSS.escape(lab.htmlFor)}"]`)].filter(
        (c) => c.matches(CTRL) && fits(c, kind) && usable(c) && inScope(c) && modalOf(c) === modalOf(lab)
      );
      if (cands.length === 1) return cands[0];
    }
    const own = [...lab.querySelectorAll(CTRL)].find((c) => fits(c, kind) && usable(c));
    if (own) return own;
    let el = lab;
    for (let depth = 0; depth < 4 && el && el !== document.body; depth++) {
      for (let s = el.nextElementSibling; s; s = s.nextElementSibling) {
        if (s.id === PANEL_HOST) continue;
        const c = firstUsableCtrl(s);
        if (!c) {
          // đường link / nút chen giữa nhãn và ô (vd. "? Trợ giúp", "Lấy lại thông tin biên nhận: KH…") → bỏ qua
          if (s.matches(BTN_LIKE)) continue;
          // chữ / giá trị của trường khác chen giữa → dừng, không lấy ô phía sau (tránh điền nhầm trường)
          const tk = textKey(s.textContent);
          if (tk && !isUnit(tk)) return null;
          continue;
        }
        if (c !== s && foreignTextBefore(s, c)) return null; // ô của trường khác
        return fits(c, kind) && inScope(c) ? c : null;
      }
      el = el.parentElement;
      if (!el || el === document.body || (scope && el === scope.root)) break;
      if (el.matches(HARD_STOP)) break; // không vượt ranh giới form / fieldset / bảng / cửa sổ
      // khối bao (row/form-group…) đã có ô nhập mà không tìm thấy ô đúng → không leo ra ngoài nữa
      if (el.matches(STOP_SEL) && firstUsableCtrl(el)) break;
    }
    return null;
  }

  // Ô tích theo chữ bên cạnh (vd. "Nam" cạnh nhãn "Giới tính"); nhiều ô khớp / không rõ → không chọn
  function findCheckByText(lab0, text, scope) {
    const lab = labelElOf(lab0, scope);
    let box = lab.parentElement;
    for (let d = 0; d < 3 && box && box !== document.body; d++) {
      const cands = [...box.querySelectorAll('input[type=checkbox]')].filter(
        (c) =>
          usable(c) &&
          !c.closest('#' + PANEL_HOST) &&
          (!scope || (scope.root.contains(c) && !scope.exclude.some((r) => r.contains(c)))) &&
          lab.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING &&
          nearText(c, lab) === text
      );
      if (cands.length === 1) return cands[0];
      if (cands.length > 1) return null;
      if (scope && box === scope.root) break;
      box = box.parentElement;
    }
    return null;
  }

  // chữ ngay cạnh ô tích (vd. "Nam"); fieldLab = nhãn của trường ("Giới tính") – không tính là chữ của ô
  function nearText(c, fieldLab) {
    if (c.id) {
      const l = document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
      if (l && l !== fieldLab && textKey(l.textContent)) return textKey(l.textContent);
    }
    const w = c.closest('label');
    if (w && w !== fieldLab && textKey(w.textContent)) return textKey(w.textContent);
    // null = gặp nhãn của trường (bỏ qua bên đó), '' = gặp ô khác / hết
    const side = (dir) => {
      for (let x = c[dir]; x; x = x[dir]) {
        if (fieldLab && (x === fieldLab || (x.nodeType === 1 && x.contains(fieldLab)))) return null;
        if (x.nodeType === 1 && x.matches && x.matches(CTRL)) return '';
        const t = textKey(x.textContent);
        if (t) return t;
      }
      return '';
    };
    const prev = side('previousSibling');
    if (prev) return prev;
    return side('nextSibling') || '';
  }

  const describe = (c) => {
    let d = c.tagName.toLowerCase();
    if (c.tagName === 'INPUT') d += `[${(c.type || 'text').toLowerCase()}]`;
    if (c.id) d += '#' + c.id;
    if (c.name) d += ` name=${c.name}`;
    return d;
  };
  const valOf = (c) => {
    let v;
    if (c.tagName === 'SELECT') v = c.selectedIndex >= 0 ? c.options[c.selectedIndex].text : '';
    else if (c.type === 'checkbox' || c.type === 'radio') v = c.checked ? '☑' : '☐';
    else v = c.value;
    v = String(v || '').replace(/\s+/g, ' ').trim();
    return v.length > 40 ? v.slice(0, 40) + '…' : v;
  };

  function flash(el, ok) {
    const prev = el.style.outline;
    const prevOff = el.style.outlineOffset;
    el.style.outline = `2px solid ${ok ? '#16a34a' : '#dc2626'}`;
    el.style.outlineOffset = '1px';
    setTimeout(() => {
      el.style.outline = prev;
      el.style.outlineOffset = prevOff;
    }, 2500);
  }

  const fire = (el, ...types) => types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));

  function nativeSet(el, v) {
    const proto =
      el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  }

  // Số trên trang kiểu en-US "1,225 m²" / "56.5 m²" / "1225" → số; dạng khác → NaN (coi như không khớp)
  const pageNum = (s) => {
    const t = String(s ?? '').trim().replace(/\s*(m²|m2)$/i, '');
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(t)) return NaN;
    return parseFloat(t.replace(/,/g, ''));
  };
  // So giá trị trên trang (a) với giá trị cần điền (b). Ô số: chỉ so số khi b đúng dạng 56.5
  const sameValue = (a, b, numeric) => {
    if (normVal(a) === normVal(b)) return true;
    if (!numeric) return false;
    const bs = String(b ?? '').trim();
    return CANON_NUM.test(bs) && pageNum(a) === parseFloat(bs);
  };

  function setText(el, v, f) {
    if (el.disabled) return { ok: false, msg: 'ô đang bị khóa' };
    if (el.readOnly && !f.force) return { ok: false, msg: 'ô chỉ đọc – bỏ qua' };
    if (sameValue(el.value, v, f.numeric)) return { ok: true, msg: 'đã có sẵn', same: true };
    try {
      el.focus({ preventScroll: true });
    } catch (e) {}
    nativeSet(el, v);
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
    } catch (e) {
      fire(el, 'input');
    }
    fire(el, 'change');
    el.blur();
    return { ok: true, msg: el.value === v ? '' : `ô hiện: ${el.value}` };
  }

  // ---------- Nút ----------
  const normBtn = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // khóa nút của mẫu: bỏ số đếm TRONG NGOẶC cuối tên (vd. “Quá hạn xử lý (16)”); số không trong ngoặc (vd. “Tác vụ 2”) là một phần tên
  const btnKeyOf = (s) => (/\(\s*\d+\s*\)\s*$/.test(s) ? normBtn(s).replace(/(\s\d+)+$/, '') : normBtn(s));
  const realLink = (el) => {
    if (el.tagName !== 'A') return false;
    if (el.matches('[data-toggle="modal"], [data-bs-toggle="modal"]')) return false;
    const h = (el.getAttribute('href') || '').trim();
    return !!h && !/^(#|javascript:)/i.test(h);
  };
  function buttonsByText(texts, root, mods) {
    const ts = texts.map(normBtn);
    const cands = [...root.querySelectorAll('button, a, [role="button"], input[type="button"], .btn')].filter(
      (el) =>
        !el.disabled &&
        !el.closest('#' + PANEL_HOST) &&
        ts.includes(normBtn(el.value || el.textContent)) &&
        isVisible(el) &&
        !mods.some((x) => x.contains(el))
    );
    return cands.filter((el) => !cands.some((o) => o !== el && el.contains(o))); // bỏ khung bọc ngoài
  }
  // các nút của màn hình / cửa sổ (tab Trường): theo thứ tự trên trang, bỏ khung bọc ngoài. key = chữ đã bỏ dấu
  // (nút chỉ có biểu tượng: 'title:' + tên gợi ý), nth = lần thứ mấy chữ đó xuất hiện
  function tplButtons(root, mods) {
    // mọi nút: button, link (trừ link dữ liệu nằm trong dòng bảng, vd. ✎ số biên nhận), [role=button], .btn
    const all = [...root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], .btn')].filter(
      (el) =>
        isVisible(el) &&
        !el.closest('#' + PANEL_HOST) &&
        !mods.some((x) => x.contains(el)) &&
        !(el.tagName === 'A' && !el.matches('.btn, [role="button"]') && el.closest('tbody'))
    );
    const top = all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
    const seen = new Map();
    const out = [];
    for (const el of top) {
      const text = String(el.value || el.textContent || '').replace(/\s+/g, ' ').trim();
      const tip = String(el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('data-original-title') || '').replace(/\s+/g, ' ').trim();
      // bỏ số đếm TRONG NGOẶC cuối tên (vd. “Quá hạn xử lý (16)”) – số đổi thì mẫu vẫn nhận ra nút.
      // Số không trong ngoặc (vd. “Tác vụ 2”, “In mẫu 1”) là một phần tên nút – giữ (không lẫn “Tác vụ 2” với “Tác vụ 3”)
      const nb = btnKeyOf(text);
      let key = nb || (normBtn(tip) ? 'title:' + btnKeyOf(tip) : '');
      let shown = text || tip;
      if (!key) {
        // nút chỉ có biểu tượng (vd. 🔍 fa-search): lấy theo tên biểu tượng
        const ic = el.querySelector('i[class], span[class*="fa-"], span[class*="glyphicon"]');
        const cls = ic ? [...ic.classList].find((c) => /^(fa|glyphicon|icon)-/.test(c) && !/^fa-(fw|lg|[2-5]x)$/.test(c)) : '';
        if (cls) {
          key = 'icon:' + cls;
          shown = `(biểu tượng ${cls})`;
        }
      }
      if (!key) continue; // không chữ, không tên, không biểu tượng → bỏ
      const nth = seen.get(key) || 0;
      seen.set(key, nth + 1);
      out.push({ el, text: shown, key, nth });
    }
    return out;
  }
  // phần đầu tên cửa sổ trước chữ số đầu tiên (giống tplStem của bảng điền) – mẫu khớp cửa sổ khi tên còn lại chỉ khác phần số
  const tplStemF = (k) => {
    const s0 = String(k || '');
    const st = s0.split(/\d/)[0].replace(/(\s|-|–|:|\||\(|kh)+$/g, '').trim();
    return st.length >= 6 ? st : s0;
  };
  const tplWinMatch = (k, tk) => !!tk && (k === tk || tplStemF(k) === tk);
  // khóa màn hình chính (không có cửa sổ con) = địa chỉ trang (mỗi màn hình VBDLIS một địa chỉ) – mẫu mỗi màn hình tách riêng
  const pageHeadingKey = () => 'path:' + (location.pathname.replace(/\/+$/, '') + (location.hash || '').split('?')[0]).toLowerCase();
  // tên màn hình để hiện cho bạn: tiêu đề có tên quen thuộc (vd. “Danh sách hồ sơ thụ lý”), không thì tiêu đề đầu tiên
  function pageHeadingName() {
    const known = /^(danh sach ho so thu ly|tiep nhan ho so|xu ly cong viec)$/;
    let first = '';
    for (const el of document.querySelectorAll('h1, h2, h3, .page-title, .content-header, header span, .main-header span, .navbar span, .title')) {
      if (el.closest('#' + PANEL_HOST) || el.closest('.modal, [role="dialog"]') || !isVisible(el)) continue;
      const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (raw.length < 4 || raw.length > 60) continue;
      if (known.test(norm(raw))) return raw;
      if (!first) first = raw;
    }
    return first || location.pathname;
  }
  // màn hình Tiếp nhận hồ sơ (có nhãn “Người nộp hồ sơ” đang hiện)
  const isReception = () => findLabels(getScope('page'), 'Người nộp hồ sơ').some(isVisible);
  // ghi chú cho bạn (không khóa): 'link' = đường link sang trang khác (bấm là trang chuyển, các nút sau không bấm được nữa)
  function tplBtnLock(b) {
    return realLink(b.el) ? 'link' : '';
  }
  // Nút mở cửa sổ nhập (vd. "+ Thêm thửa đất"): phải là nút duy nhất (không phải đường link sang trang khác)
  function findOpener(texts) {
    const cands = buttonsByText(texts, document.body, openModals()).filter((el) => !realLink(el));
    if (cands.length === 1) return { btn: cands[0] };
    if (!cands.length) return { err: `không thấy nút “${texts[0]}” trên trang` };
    const t = thuaTableEl();
    const near = t
      ? cands.filter((b) => {
          const box = b.closest('fieldset, .panel, .card, .box, section, .portlet');
          return box && box.contains(t);
        })
      : [];
    if (near.length === 1) return { btn: near[0] };
    return { err: `thấy ${cands.length} nút “${texts[0]}” – không biết bấm nút nào, bấm tay giúp` };
  }

  // Nút thả xuống "Thêm" trong cửa sổ Nhập đơn đăng ký (theo id; không có id thì theo chữ gợi ý title)
  function menuButton(menu, root) {
    let c = menu.ids.map((id) => root.querySelector('#' + CSS.escape(id))).filter((b) => b && isVisible(b));
    if (!c.length)
      c = [...root.querySelectorAll('a[title], button[title]')].filter((b) => normBtn(b.title) === normBtn(menu.title) && isVisible(b));
    return c.length === 1 ? c[0] : null;
  }
  // mục trong danh sách thả xuống của nút đó (vd. "Cá nhân", "Thửa đất") – phải duy nhất
  function menuItem(btn, text) {
    const box = btn.closest('.dropdown, .btn-group') || btn.parentElement;
    const list = box && box.querySelector('.dropdown-menu, [role="menu"]');
    if (!list) return null;
    const items = [...list.querySelectorAll('a, button, li')].filter((a) => normBtn(a.textContent) === normBtn(text));
    const deep = items.filter((a) => !items.some((o) => o !== a && a.contains(o)));
    return deep.length === 1 ? deep[0] : null;
  }
  const noNav = (el) => {
    // chặn chuyển trang nếu là đường link có href (thư viện của trang vẫn chạy như bình thường)
    if (el.tagName === 'A' && el.hasAttribute('href')) el.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
  };
  async function openViaMenu(sec, scope, values) {
    const m = sec.menu;
    const btn = menuButton(m, scope.root);
    if (!btn) return { err: `không thấy nút “Thêm” (${m.title}) trong ${scope.name} – bấm tay “${m.label}” rồi bấm Điền` };
    const item = menuItem(btn, m.item);
    if (!item) return { err: `không thấy mục “${m.item}” trong nút “Thêm” – bấm tay “${m.label}” rồi bấm Điền` };
    if (realLink(btn) || realLink(item)) return { err: `nút “${m.label}” là đường link sang trang khác – bấm tay giúp` };
    const dup = m.dup ? m.dup(scope.root, values || {}) : '';
    if (dup) return { dup };
    noNav(btn);
    btn.click(); // mở danh sách thả xuống (như bạn bấm)
    await sleep(150);
    noNav(item);
    item.click(); // chọn "Cá nhân" / "Thửa đất" → trang mở cửa sổ nhập (không phải nút Lưu)
    let ns = null;
    for (let t = 0; t < 100 && !ns; t++) {
      // máy chủ chậm: chờ tối đa ~15 giây
      await sleep(150);
      const s2 = getScope('modal');
      if (s2 && s2.root !== scope.root && scopeMatches(sec, s2)) ns = s2;
    }
    if (ns) await sleep(600); // chờ cửa sổ dựng xong các ô
    return { opened: m.label, scope: ns };
  }

  // Bảng thửa ở mục "Thông tin tài sản" (có cột Số thửa, Số tờ)
  function tableCols(t) {
    const heads = [...t.querySelectorAll('thead th, thead td')].map((h) => textKey(h.textContent));
    const iThua = heads.findIndex((h) => /^(so thua|thua so|so thu tu thua|thua dat so)$/.test(h));
    const iTo = heads.findIndex((h) => /^(so to|to so|so to ban do|to ban do|to ban do so|so hieu to ban do)$/.test(h));
    let iDt = heads.indexOf('dien tich');
    if (iDt < 0) iDt = heads.findIndex((h) => /^dien tich( m2| m)?$/.test(h)); // "Diện tích (m²)" – không lấy "Diện tích PL"
    return { iThua, iTo, iDt };
  }
  function thuaTableEl() {
    const mods = openModals();
    for (const t of document.querySelectorAll('table')) {
      if (!isVisible(t) || mods.some((m) => m.contains(t))) continue;
      const c = tableCols(t);
      if (c.iThua >= 0 && c.iTo >= 0) return t;
    }
    return null;
  }
  function readThuaTable() {
    const t = thuaTableEl();
    if (!t) return { found: false, rows: [] };
    const { iThua, iTo, iDt } = tableCols(t);
    const cellVal = (c) => {
      const inp = c.querySelector('input, select, textarea');
      return ((inp ? inp.value : c.textContent) || '').replace(/\s+/g, ' ').trim();
    };
    const rows = [];
    for (const tr of t.querySelectorAll('tbody tr')) {
      const cells = [...tr.children];
      if (cells.length <= Math.max(iThua, iTo)) continue; // dòng "Vui lòng chọn ít nhất một thửa đất"
      rows.push({ soThua: cellVal(cells[iThua]), soTo: cellVal(cells[iTo]), dienTich: iDt >= 0 && cells[iDt] ? cellVal(cells[iDt]) : '' });
    }
    return { found: true, hasArea: iDt >= 0, rows };
  }

  function pageControl(label, kind) {
    const scope = getScope('page');
    const lab = findLabels(scope, label)[0];
    return lab ? findControl(lab, kind, scope) : null;
  }

  // Các thao tác nhỏ cho chế độ "Chạy cả TB" – chỉ đọc trang / tô nút; KHÔNG bấm nút nào
  async function act(msg) {
    const base = { frame: location.href };
    switch (msg.action) {
      case 'modalState': {
        const m = topModal();
        const title = m ? modalTitle(m) : '';
        return { ...base, open: !!m, name: m ? scopeName(m) : '', title, key: titleKey(title) };
      }
      case 'readThuaTable':
        return { ...base, ...readThuaTable() };
      case 'donHas': {
        const m = topModal();
        if (!m || !/^nhap don dang ky\b/.test(titleKey(modalTitle(m)))) return { ...base, ok: false };
        const sec = SECTIONS[msg.kind];
        if (!sec || !sec.menu || !sec.menu.dup) return { ...base, ok: false };
        const tree = treeText(m, msg.kind === 'chu' ? 'treeChuSuDung' : 'treeTaiSan');
        return { ...base, ok: true, tree: tree !== null, has: !!sec.menu.dup(m, msg.values || {}) };
      }
      case 'donRead': {
        // đọc cây Chủ sử dụng / Thửa đất và tài sản của cửa sổ “Nhập đơn đăng ký” (để biết hồ sơ của TB nào, đối chiếu số liệu)
        const m = topModal();
        if (!m || !/^nhap don dang ky\b/.test(titleKey(modalTitle(m)))) return { ...base, ok: false };
        // jstree đang nạp dữ liệu: nút “Loading …” (li.jstree-loading)
        const loading = !!m.querySelector('#treeChuSuDung .jstree-loading, #treeTaiSan .jstree-loading');
        // ô “Mã đơn”: trang điền sẵn số biên nhận của hồ sơ (vd. “KH 2959.07777.255.47-245.142…”) – nhận hồ sơ theo ô này
        // khi cây chủ / thửa còn trống. Tìm theo nhãn; không thấy thì ô nào trong cửa sổ có giá trị dạng số biên nhận.
        let maDon = '';
        try {
          const sc = { root: m, exclude: [], name: scopeName(m), title: modalTitle(m) };
          const lab = findLabels(sc, 'Mã đơn')[0];
          const mc = lab ? findControl(lab, 'text', sc) : null;
          if (mc && /KH\s*2959\.07777\.\d/i.test(mc.value || '')) maDon = String(mc.value).trim();
        } catch (e) {}
        if (!maDon) {
          const v = [...m.querySelectorAll('input')].map((i) => String(i.value || '').trim()).filter((x) => /^KH\s*2959\.07777\.\d/i.test(x));
          if (new Set(v).size === 1) maDon = v[0];
        }
        return { ...base, ok: true, loading, maDon, chu: treeNodes(m, 'treeChuSuDung'), thua: treeNodes(m, 'treeTaiSan') };
      }
      case 'dialogState': {
        // hộp hỏi / thông báo của trang chỉ có nút, không có ô nhập (vd. “Cập nhật địa chỉ tài sản: Đồng ý / Không”)
        const ds = [...document.querySelectorAll(MODAL_SEL)].filter(
          (m) =>
            isVisible(m) &&
            !m.closest('#' + PANEL_HOST) &&
            !m.querySelector(CTRL) &&
            [...m.querySelectorAll('button, .btn')].some(isVisible) &&
            (m.textContent || '').length < 1500
        );
        const top = ds.filter((m) => !ds.some((o) => o !== m && o.contains(m)));
        return { ...base, open: top.length > 0, titles: top.map((m) => modalTitle(m) || 'hộp thông báo của trang') };
      }
      case 'readField': {
        const c = pageControl(msg.label, 'text');
        return { ...base, ok: !!c, value: c ? c.value : '' };
      }
      case 'hasCellText': {
        const t = norm(msg.text);
        const mods = openModals();
        const ok = [...document.querySelectorAll('td')].some(
          (td) => !mods.some((m) => m.contains(td)) && isVisible(td) && norm(td.textContent).includes(t)
        );
        return { ...base, ok };
      }
      case 'selectHasOption': {
        const sel = pageControl(msg.label, 'select');
        const t = norm(msg.text);
        return { ...base, ok: !!sel && [...sel.options].some((o) => norm(o.text).includes(t)) };
      }
      case 'markSelect': {
        const sel = pageControl(msg.label, 'select');
        if (!sel) return { ...base, ok: false };
        const id = `${TOKEN}-${++seq}`;
        sel.setAttribute('data-vbdlis-id', id);
        return { ...base, ok: true, id };
      }
      case 'probe':
        return { ...base, ...probe() };
      case 'focusSave': {
        // đặt sẵn con trỏ vào nút “Lưu” của cửa sổ đang mở (KHÔNG bấm) – bạn kiểm tra xong tự nhấn Enter
        const tm = topModal();
        if (!tm) return { ...base, ok: false };
        const b = buttonsByText(msg.texts || ['Lưu'], tm, [])[0];
        if (!b) return { ...base, ok: false };
        // bạn đang gõ / bấm trên trang (3 giây gần đây), hoặc đang mở danh sách chọn → không giành con trỏ
        const ae = document.activeElement;
        if (Date.now() - lastUserAct < 3000 || (ae && ae.closest && ae.closest('.select2-container, .select2-dropdown')))
          return { ...base, ok: false, busy: true };
        try {
          b.focus({ preventScroll: true });
        } catch (e) {}
        ring(b, '#f59e0b', 15000);
        return { ...base, ok: document.activeElement === b };
      }
      case 'markSave': {
        // nhập chủ tự động: cửa sổ trên cùng phải đúng là cửa sổ CHỦ SỬ DỤNG và có đúng 1 nút “Lưu” → đánh dấu nút đó.
        // Lệnh clickMark sau mới bấm (bảng điền thấy đúng 1 khung đánh dấu được thì mới gửi) – không bấm 2 nơi.
        const tm = topModal();
        if (!tm) return { ...base, ok: false };
        const winRe = msg.win === 'chu' ? CHU_WIN : msg.win === 'thua' ? THUA_WIN : null;
        if (!winRe || !winRe.test(titleKey(modalTitle(tm))) || /^tim\b/.test(titleKey(modalTitle(tm))))
          return { ...base, ok: false, why: `cửa sổ trên cùng không phải cửa sổ ${msg.win === 'thua' ? 'thửa đất' : 'chủ sử dụng'}` };
        const bs = buttonsByText(['Lưu'], tm, []);
        if (bs.length !== 1) return { ...base, ok: false, why: bs.length ? 'cửa sổ có nhiều nút Lưu' : 'không thấy nút Lưu' };
        // ngay trước khi bấm: đọc lại các ô vừa điền của cửa sổ này (chỉ đọc) – trang tự xóa / đổi ô nào thì KHÔNG bấm, để bạn xem
        const mine = ((lastFill && lastFill.items) || []).filter((x) => x.c && x.c.isConnected && tm.contains(x.c));
        if (!mine.length) return { ...base, ok: false, why: 'không kiểm lại được các ô vừa điền' };
        const changed = mine.filter((x) => x.res && x.res.ok && !sameValue(x.c.value, x.v, x.f.numeric));
        if (changed.length) return { ...base, ok: false, why: 'trang đã đổi ô ' + changed.map((x) => x.res.name || x.f.name).join(', ') };
        document.querySelectorAll('[data-vbdlis-save]').forEach((x) => x.removeAttribute('data-vbdlis-save'));
        const id = `${TOKEN}-${++seq}`;
        bs[0].setAttribute('data-vbdlis-save', id);
        return { ...base, ok: true, id };
      }
      case 'clickMark': {
        // bấm nút vừa đánh dấu (chỉ khung có đúng dấu đó); dấu dùng một lần
        let hit = null;
        document.querySelectorAll('[data-vbdlis-save]').forEach((x) => {
          if (!hit && x.getAttribute('data-vbdlis-save') === String(msg.id || '')) hit = x;
          x.removeAttribute('data-vbdlis-save');
        });
        if (!hit || !hit.isConnected || hit.disabled || !isVisible(hit)) return { ...base, ok: false };
        hit.click();
        return { ...base, ok: true };
      }
      case 'clickBtn': {
        // “Tự động hết” (bạn bật): bấm MỘT nút theo chữ – trong cửa sổ trên cùng (inModal, tên cửa sổ phải khớp msg.win)
        // hoặc trên màn hình chính (không có cửa sổ con nào mở). Thấy 0 hoặc ≥ 2 nút → không bấm.
        const texts = (msg.texts || []).filter((t) => !NEVER_BTN.test(normBtn(t)));
        if (!texts.length) return { ...base, ok: false, why: 'nút không được phép bấm' };
        const tm = topModal();
        let bs;
        if (msg.inModal) {
          if (!tm) return { ...base, ok: false, why: 'không có cửa sổ nào đang mở' };
          if (msg.win && !new RegExp(msg.win).test(titleKey(modalTitle(tm)))) return { ...base, ok: false, why: `cửa sổ trên cùng là ${scopeName(tm)}` };
          bs = buttonsByText(texts, tm, []);
        } else {
          if (tm) return { ...base, ok: false, why: `đang mở ${scopeName(tm)}` };
          bs = buttonsByText(texts, document.body, openModals()).filter((b) => !realLink(b));
        }
        if (bs.length !== 1) return { ...base, ok: false, none: !bs.length, why: bs.length ? `thấy ${bs.length} nút “${texts[0]}”` : `không thấy nút “${texts[0]}”` };
        if (NEVER_BTN.test(normBtn(bs[0].value || bs[0].textContent))) return { ...base, ok: false, why: 'nút không được phép bấm' };
        noNav(bs[0]);
        bs[0].click();
        return { ...base, ok: true };
      }
      case 'tplClick': {
        // tab Trường: bấm MỘT nút bạn đã tích. Bước 1 (dry): tìm đúng cửa sổ + đúng nút (id / chữ + thứ tự), đánh dấu nút bằng token;
        // bảng điền thấy đúng 1 nút ở đúng 1 khung mới gửi bước 2 (bấm nút mang token đó) – không bấm nhầm nút trùng chữ / khung khác.
        if (!msg.dry) {
          const el = msg.token ? document.querySelector(`[data-vbdlis-tplbtn="${CSS.escape(msg.token)}"]`) : null;
          if (!el) return null; // khung khác
          el.removeAttribute('data-vbdlis-tplbtn');
          if (!isVisible(el) || el.disabled) return { ...base, ok: false, why: 'nút vừa ẩn / mờ' };
          const link = realLink(el);
          el.click(); // đường link: để trang chuyển như khi bạn bấm
          return { ...base, ok: true, link };
        }
        document.querySelectorAll('[data-vbdlis-tplbtn]').forEach((x) => x.removeAttribute('data-vbdlis-tplbtn'));
        const tm = topModal();
        if (msg.scope === 'modal') {
          if (!tm) return { ...base, found: 0, why: 'cửa sổ của mẫu không còn mở' };
          if (msg.titleKey && !tplWinMatch(titleKey(modalTitle(tm)), msg.titleKey)) return { ...base, found: 0, why: `cửa sổ trên cùng là ${scopeName(tm)}` };
        } else {
          if (tm) return { ...base, found: 0, why: `đang mở ${scopeName(tm)}` };
          if (msg.base === 'bienNhan' ? !isReception() : msg.titleKey && pageHeadingKey() !== msg.titleKey)
            return { ...base, found: 0, why: 'đang ở màn hình khác màn hình của mẫu' };
        }
        const inWin = msg.scope === 'modal';
        const list = tplButtons(inWin ? tm : document.body, inWin ? [] : openModals());
        const want = msg.btn || {};
        let hit = want.id ? list.filter((b) => b.el.id === want.id && b.key === want.key) : [];
        if (hit.length !== 1) hit = list.filter((b) => b.key === want.key && b.nth === (want.nth || 0));
        // mẫu lưu ở bản trước (khóa bỏ cả số không trong ngoặc, vd. “Tác vụ 2” → “tac vu”): tìm theo ĐÚNG chữ của nút đã tích (chỉ 1 nút).
        // Khóa của bản này (khóa = khóa tính lại từ chữ nút) mà nút vắng → không bấm nút khác cùng chữ
        const wk = String(want.key || '');
        if (!hit.length && want.text && !/^icon:/.test(wk) && wk !== btnKeyOf(want.text) && wk !== 'title:' + btnKeyOf(want.text)) {
          const byText = list.filter((b) => normBtn(b.text) === normBtn(want.text));
          if (byText.length === 1) hit = byText;
        }
        if (hit.length !== 1) return { ...base, found: hit.length, why: hit.length ? `thấy ${hit.length} nút “${want.text || want.key}”` : `không thấy nút “${want.text || want.key}”` };
        const b = hit[0];
        if (b.el.disabled) return { ...base, found: 1, why: 'nút đang mờ (chưa bấm được)' };
        b.el.setAttribute('data-vbdlis-tplbtn', String(msg.token || ''));
        return { ...base, found: 1, ok: true, text: b.text };
      }
      case 'answerDialog': {
        // “Tự động hết”: trả lời hộp hỏi ĐÃ BIẾT của trang (vd. “Cập nhật địa chỉ tài sản” → Đồng ý,
        // “Giấy tờ tùy thân đã tồn tại…” → Đồng ý). Hộp lạ → không bấm, trả về chữ của hộp để bảng điền dừng chờ bạn.
        const ds = [...document.querySelectorAll(MODAL_SEL)].filter(
          (m) => isVisible(m) && !m.closest('#' + PANEL_HOST) && !m.querySelector(CTRL) && [...m.querySelectorAll('button, .btn')].some(isVisible) && (m.textContent || '').length < 1500
        );
        const top = ds.filter((m) => !ds.some((o) => o !== m && o.contains(m)));
        if (!top.length) return { ...base, ok: false, open: false };
        const d = top[top.length - 1];
        const text = norm(d.textContent);
        const rule = (msg.rules || []).find((r) => new RegExp(r.re).test(text));
        const title = modalTitle(d) || 'hộp thông báo của trang';
        const raw = (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!rule) return { ...base, ok: false, open: true, title, text: raw };
        // rule.btn: một chữ hoặc danh sách chữ nút (vd. Đồng ý / Có / OK) – phải thấy ĐÚNG MỘT nút
        const labels = [].concat(rule.btn || []);
        const b = buttonsByText(labels, d, []).filter((x) => !NEVER_BTN.test(normBtn(x.value || x.textContent)));
        if (b.length !== 1) return { ...base, ok: false, open: true, title, text: `${raw} (không thấy, hoặc thấy nhiều nút “${labels.join(' / ')}”)` };
        const said = (b[0].value || b[0].textContent || '').replace(/\s+/g, ' ').trim();
        b[0].click();
        return { ...base, ok: true, open: true, title, btn: said };
      }
      case 'highlight': {
        const tm = msg.inModal ? topModal() : null;
        if (msg.inModal && !tm) return { ...base, ok: false };
        const b = (tm ? buttonsByText(msg.texts || [], tm, []) : buttonsByText(msg.texts || [], document.body, openModals()))[0];
        if (!b) return { ...base, ok: false };
        b.scrollIntoView({ block: 'center', behavior: 'smooth' });
        ring(b, msg.color || '#f59e0b', 10000);
        return { ...base, ok: true };
      }
      default:
        return null;
    }
  }

  // Ô không có nhãn, chỉ có chữ mờ gợi ý (placeholder), vd. "Tên tài liệu muốn thêm"
  function findByPlaceholder(scope, text, kind) {
    const t = norm(text);
    return [...scope.root.querySelectorAll(CTRL)].find(
      (c) =>
        fits(c, kind) &&
        [c.placeholder, c.getAttribute('aria-label'), c.title].some((p) => p && norm(p) === t) &&
        !scope.exclude.some((r) => r.contains(c)) &&
        !c.closest('#' + PANEL_HOST) &&
        usable(c)
    );
  }

  // Chọn lựa chọn: khớp đúng chữ / mã trước; gần đúng (vd. "LUC" → "LUC (Đất chuyên trồng lúa)",
  // "XA_KH2959" → "XA_KH2959. Đăng ký…") chỉ khi duy nhất 1 lựa chọn khớp, và không dùng cho ô exact.
  const fold = (s) =>
    norm(s)
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\s*([-()/])\s*/g, '$1');
  const keepColon = (s) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  function pickOption(sel, v, exact) {
    const t = fold(v);
    const opts = [...sel.options].filter((o) => !o.disabled);
    const ex = opts.filter((o) => fold(o.text) === t);
    if (ex.length && new Set(ex.map((o) => o.value)).size > 1)
      return { err: `có ${ex.length} lựa chọn cùng tên “${v}” – chọn tay` };
    if (ex.length) return { o: ex[0] };
    const exv = opts.filter((o) => o.value !== '' && fold(o.value) === t);
    if (exv.length === 1) return { o: exv[0] };
    if (exact) return { err: `không có lựa chọn đúng “${v}”` };
    const k = keepColon(v);
    const pre = new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[(.\\-:]`);
    const fuzzy = opts.filter((o) => {
      const n = keepColon(o.text);
      return pre.test(n) || n.includes(`(${k})`);
    });
    if (fuzzy.length === 1) return { o: fuzzy[0] };
    if (fuzzy.length > 1)
      return {
        err: `nhiều lựa chọn khớp “${v}”: ${fuzzy
          .slice(0, 4)
          .map((o) => o.text.trim())
          .join(' | ')} – chọn tay`,
      };
    return { err: `không có lựa chọn “${v}”` };
  }

  function setSelect(sel, v, f) {
    if (sel.disabled) return { ok: false, msg: 'ô đang bị khóa' };
    if (!sel.options.length) return { ok: false, msg: 'danh sách chọn đang trống (phải gõ tìm tay)' };
    const p = pickOption(sel, v, !!f.exact);
    if (!p.o) return { ok: false, msg: p.err };
    const o = p.o;
    if (sel.value === o.value && o.selected) return { ok: true, msg: 'đã đúng sẵn', same: true };
    nativeSet(sel, o.value);
    o.selected = true;
    fire(sel, 'input', 'change');
    sel.dispatchEvent(new Event('chosen:updated', { bubbles: true }));
    return { ok: true, msg: o.text.replace(/\s+/g, ' ').trim() };
  }

  function setCheck(c, want, f) {
    want = !!want;
    if (c.disabled) return { ok: false, msg: 'ô đang bị khóa' };
    if (c.checked === want) return { ok: true, msg: 'đã đúng sẵn', same: true };
    c.click();
    if (c.checked !== want) {
      c.checked = want;
      fire(c, 'change');
    }
    return { ok: true, msg: want ? 'đã tích' : 'đã bỏ tích' };
  }

  // cửa sổ đang mở có đúng loại cho màn hình này không
  function scopeMatches(sec, scope) {
    if (!sec.expect) return true;
    if (scope.title) return sec.expect.test(titleKey(scope.title));
    return (sec.keyLabels || []).some((L) => findLabels(scope, L).length); // cửa sổ không có tiêu đề → nhận theo nhãn chính
  }

  // ---------- Kiểm tra tiện ích (VBDLIS đổi giao diện → biết ngay ô nào tiện ích không còn tìm thấy) ----------
  // Chỉ đọc trang, không điền, không bấm gì. Tìm ô giống hệt lúc điền (nhãn → ô; không có nhãn thì chữ mờ gợi ý).
  function locate(f, scope) {
    let labs = [];
    for (const L of f.labels) {
      labs = findLabels(scope, L);
      if (labs.length) break;
    }
    if (labs.length) {
      const lab = labs[f.nth || 0] || labs[0];
      const c = f.kind === 'checkbox' && f.checkText ? findCheckByText(lab, f.checkText, scope) : findControl(lab, f.kind, scope);
      return c ? { ok: true } : { ok: false, why: 'thấy nhãn nhưng không thấy ô nhập' };
    }
    for (const L of f.labels) if (findByPlaceholder(scope, L, f.kind)) return { ok: true };
    return { ok: false, why: 'không thấy nhãn' };
  }
  const NOT_USED = new Set(['ngaySinh']); // tiện ích không điền các ô này
  function probe() {
    const m = topModal();
    const key = m ? titleKey(modalTitle(m)) : '';
    const items = [];
    const fields = (secKeys, scope) => {
      const seen = new Set();
      for (const k of secKeys)
        for (const f of SECTIONS[k].fields) {
          if (NOT_USED.has(f.key) || seen.has(f.name)) continue;
          seen.add(f.name);
          const r = locate(f, scope);
          items.push({ name: 'Ô “' + f.name + '”', ok: r.ok, optional: !!f.optional, why: r.why || '' });
        }
    };
    const thing = (name, ok, optional, why) => items.push({ name, ok: !!ok, optional: !!optional, why: ok ? '' : why || 'không thấy' });
    let screen;
    if (!m) {
      screen = 'màn hình Tiếp nhận hồ sơ';
      const t = readThuaTable();
      const opener = findOpener(SECTIONS.thua.opener).btn;
      const lhs = buttonsByText(['Lưu hồ sơ'], document.body, openModals()).length;
      // chỉ coi là màn hình tiếp nhận khi thấy thứ riêng của nó (bảng thửa, nút “Thêm thửa đất” / “Lưu hồ sơ”);
      // không thì đây là trang khác (danh sách hồ sơ…) hoặc khung phụ, không phải giao diện đổi
      if (!t.found && !opener && !lhs) return { frame: location.href, screen, known: false, items: [] };
      const scope = getScope('page');
      fields(['donVi', 'quyTrinh', 'bienNhan'], scope);
      fields(['giayToPage'], scope);
      items[items.length - 1].optional = true;
      thing('Bảng thửa (cột Số thửa, Số tờ)', t.found, false, 'không thấy bảng có cột Số thửa / Số tờ');
      thing('Cột Diện tích trong bảng thửa', t.found && t.hasArea, false, 'bảng thửa không có cột Diện tích');
      thing('Nút “Thêm thửa đất”', opener, false);
      thing('Nút “Lưu hồ sơ” (tiện ích chỉ tô vàng)', lhs, false);
    } else if (/^nhap don dang ky\b/.test(key)) {
      screen = 'cửa sổ “Nhập đơn đăng ký”';
      const scope = getScope('modal');
      fields(['donDK'], scope);
      thing('Cây Chủ sử dụng', m.querySelector('#treeChuSuDung'), false);
      thing('Cây Thửa đất và tài sản', m.querySelector('#treeTaiSan'), false);
      thing('Nút “Thêm” (chủ sử dụng)', menuButton(SECTIONS.chu.menu, m), false);
      thing('Nút “Thêm” (tài sản)', menuButton(SECTIONS.thua.menu, m), false);
      thing('Nút “Lưu thông tin đăng ký” (tiện ích chỉ tô vàng)', buttonsByText(['Lưu thông tin đăng ký'], m, []).length, false);
      thing('Nút “Hoàn tất”', buttonsByText(['Hoàn tất'], m, []).length, true);
    } else {
      const secKey = ['chu', 'thua', 'giayTo'].find((k) => SECTIONS[k].expect.test(key));
      screen = scopeName(m);
      if (!secKey) return { frame: location.href, screen, known: false, items: [] };
      fields([secKey], getScope('modal'));
      thing('Nút “Lưu” của cửa sổ (tiện ích không bấm)', buttonsByText(['Lưu'], m, []).length, false);
    }
    return { frame: location.href, screen, known: true, items };
  }

  // ---------- Điền ----------
  // Mẫu trường bạn chọn ở tab “Trường”: { tpl: true, base: 'chu' | 'thua' | 'donDK' | 'bienNhan' | '', keys: [các ô dữ liệu TB được tích],
  //   extra: [{ key, label, nth, kind }] (ô lấy giá trị mẫu), scope: 'modal' | 'page', titleKey } → một màn hình điền như SECTIONS
  function tplSection(t) {
    const b = t.base && SECTIONS[t.base];
    const keys = new Set(t.keys || []);
    const baseFields = !b ? [] : t.base === 'bienNhan' ? [...SECTIONS.donVi.fields, ...SECTIONS.quyTrinh.fields, ...b.fields] : b.fields;
    const fields = [
      ...baseFields.filter((f) => keys.has(f.key)),
      ...(t.extra || []).map((x) => ({
        key: x.key,
        name: x.label + (x.nth ? ` (${x.nth + 1})` : ''),
        labels: [x.label],
        nth: x.nth || 0,
        kind: x.kind === 'checkbox' ? 'checkbox' : x.kind === 'select' ? 'select' : x.kind === 'text' ? 'text' : 'any',
        exact: true,
        force: false,
      })),
    ];
    // mẫu bạn bấm “Điền” / 🤖 chạy mẫu (strict): ô đã tích mà màn hình không có nhãn → báo ✗ (không bỏ qua như ô “có thể không có”)
    if (t.strict) fields.forEach((x, i) => (fields[i] = { ...x, optional: false }));
    if (b) return { ...b, fields };
    const tk = String(t.titleKey || '');
    return {
      scope: t.scope === 'page' ? 'page' : 'modal',
      expect: t.scope === 'page' || !tk ? undefined : { test: (k) => tplWinMatch(k, tk) },
      fields,
    };
  }

  async function fill(sectionKey, values) {
    const sec = sectionKey && typeof sectionKey === 'object' && sectionKey.tpl ? tplSection(sectionKey) : SECTIONS[sectionKey];
    const base = { frame: location.href };
    if (!sec) return { ...base, noScope: true, results: [] };
    let scope = getScope(sec.scope);
    let opened = '';
    if (scope && sec.menu && sec.scope === 'modal' && !scopeMatches(sec, scope) && sec.menu.inside.test(titleKey(scope.title))) {
      const mo = await openViaMenu(sec, scope, values);
      if (mo.dup) return { ...base, noScope: true, dup: mo.dup, results: [] };
      if (mo.err) return { ...base, noScope: true, openerErr: mo.err, results: [] };
      opened = mo.opened;
      scope = mo.scope;
      if (!scope) return { ...base, noScope: true, opened, results: [] };
    }
    if (!scope && sec.opener) {
      const o = findOpener(sec.opener);
      if (!o.btn) return { ...base, noScope: true, openerErr: o.err, results: [] };
      opened = (o.btn.value || o.btn.textContent || '').replace(/\s+/g, ' ').trim();
      if (o.btn.tagName === 'A') {
        // nút dạng đường link: chặn chuyển trang (thư viện của trang vẫn mở cửa sổ như bình thường)
        o.btn.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
      }
      o.btn.click(); // chỉ mở cửa sổ nhập, không phải nút Lưu
      for (let t = 0; t < 100 && !scope; t++) {
        // máy chủ chậm: chờ tối đa ~15 giây
        await sleep(150);
        scope = getScope(sec.scope);
      }
      if (scope) await sleep(600); // chờ cửa sổ dựng xong các ô
    }
    if (!scope) return sec.fallback ? fill(sec.fallback, values) : { ...base, noScope: true, opened, results: [] };
    if (sec.scope === 'modal' && !scopeMatches(sec, scope)) return { ...base, wrongScope: scope.name, results: [] };

    const token = `${TOKEN}:${++fillSeq}`;
    const results = [];
    const recheck = [];
    const usedCtrls = new Set(); // mỗi ô chỉ nhận 1 trường
    const viaPage = []; // ô có mặt nạ / định dạng → điền ở bước 2 bằng thư viện của trang
    // điền danh sách chọn trước (có thể làm trang tự đổi các ô khác), rồi mới điền ô chữ
    const order = [...sec.fields].sort((a, b) => (a.kind === 'select' ? 0 : 1) - (b.kind === 'select' ? 0 : 1));
    let waited = false;
    for (const f of order) {
      const v = values ? values[f.key] : undefined;
      if (v === undefined || v === null || v === '') continue;
      const shown = f.kind === 'checkbox' ? (v ? 'tích' : 'bỏ tích') : String(v);
      if (f.numeric && !CANON_NUM.test(String(v).trim())) {
        results.push({ key: f.key, name: f.name, value: shown, ok: false, msg: 'diện tích không hợp lệ (cần dạng 56.5) – không điền' });
        continue;
      }
      if (!waited && f.kind !== 'select' && results.some((r) => r.changed)) {
        await sleep(600);
        waited = true;
      }
      let labs = [];
      for (const L of f.labels) {
        labs = findLabels(scope, L);
        if (labs.length) break;
      }
      let targets = labs.length ? (f.all ? labs : [labs[f.nth || 0]].filter(Boolean)) : [];
      let direct = null;
      if (!targets.length) {
        for (const L of f.labels) {
          direct = findByPlaceholder(scope, L, f.kind);
          if (direct) break;
        }
        // ô tích chỉ có chữ của chính nó (vd. “Có quyền sử dụng đất”, “Đăng ký lần đầu”)
        if (!direct && f.kind === 'checkbox' && !f.checkText)
          for (const L of f.labels) {
            direct = checkByOwnText(scope, L);
            if (direct) break;
          }
        if (!direct) {
          if (!f.optional)
            results.push({ key: f.key, name: f.name, value: shown, ok: false, msg: 'không thấy nhãn này trên màn hình' });
          continue;
        }
        targets = [null];
      }
      for (const [idx, lab] of targets.entries()) {
        const name = targets.length > 1 ? `${f.name} (${idx + 1})` : f.name;
        const c = lab
          ? f.kind === 'checkbox' && f.checkText
            ? findCheckByText(lab, f.checkText, scope)
            : findControl(lab, f.kind, scope) || (f.kind === 'checkbox' ? checkByOwnText(scope, lab.textContent) : null)
          : direct;
        if (!c) {
          const why = f.checkText ? `không thấy (hoặc thấy nhiều) ô tích “${f.checkText}” cạnh nhãn` : 'thấy nhãn nhưng không thấy ô nhập đúng loại';
          results.push({ key: f.key, name, value: shown, ok: false, msg: why });
          continue;
        }
        if (usedCtrls.has(c)) {
          results.push({ key: f.key, name, value: shown, ok: false, msg: 'trùng ô với trường khác – không điền' });
          continue;
        }
        usedCtrls.add(c);
        let r;
        if (f.kind !== 'checkbox' && c.tagName !== 'SELECT' && directOK(c, String(v))) {
          if (c.disabled) r = { ok: false, msg: 'ô đang bị khóa' };
          else if (c.readOnly && !f.force) r = { ok: false, msg: 'ô chỉ đọc – bỏ qua' };
          else if (sameValue(c.value, String(v), true)) r = { ok: true, msg: 'đã có sẵn', same: true };
          else {
            results.push({ key: f.key, name, value: shown, ok: false, msg: 'chưa điền xong (bước 2 chưa chạy)', el: describe(c), changed: true });
            viaPage.push({ c, v: String(v), res: results[results.length - 1] });
            continue;
          }
          flash(c, r.ok);
          results.push({ key: f.key, name, value: shown, ok: r.ok, msg: r.msg, el: describe(c), changed: false });
          continue;
        }
        if (f.kind === 'checkbox') r = setCheck(c, v, f);
        else if (c.tagName === 'SELECT') r = setSelect(c, String(v), f);
        else r = setText(c, String(v), f);
        flash(c, r.ok);
        results.push({ key: f.key, name, value: shown, ok: r.ok, msg: r.msg, el: describe(c), changed: r.ok && !r.same });
        if (r.ok && f.kind !== 'checkbox' && c.tagName !== 'SELECT')
          recheck.push({ c, v: String(v), f, same: !!r.same, res: results[results.length - 1] });
      }
    }

    // Trang có thể tự xóa ô sau khi đổi ô khác (vd. điền Ngày sinh làm mất Năm sinh) → kiểm tra lại và điền bù
    if (recheck.length) {
      await sleep(700);
      for (const x of recheck) {
        if (!x.c.isConnected || !isVisible(x.c)) {
          x.res.ok = false;
          x.res.msg = 'cửa sổ đã dựng lại, ô không còn – bấm Điền lại';
          continue;
        }
        if (sameValue(x.c.value, x.v, x.f.numeric)) continue;
        const r = setText(x.c, x.v, { force: true, numeric: x.f.numeric });
        await sleep(50);
        const kept = sameValue(x.c.value, x.v, x.f.numeric);
        x.res.ok = r.ok && kept;
        x.res.msg = kept ? 'trang tự xóa – đã điền lại' : `trang không giữ giá trị (đang hiện: “${x.c.value}”)`;
        flash(x.c, x.res.ok);
      }
    }

    // Bước 2 (background gọi, chạy trong trang): điền bằng chính thư viện của trang cho
    //  - ô vẫn không nhận (thường là ô có lịch chọn ngày, ô số định dạng "m²")
    //  - ô ngày / diện tích (widget): có thể hiện đúng chữ mà thư viện của trang vẫn giữ giá trị rỗng/0
    const retry = [];
    for (const x of recheck) {
      if (!x.c.isConnected) continue;
      const soft = x.res.ok;
      if (soft && (!x.f.widget || x.same)) continue;
      const id = `${TOKEN}-${++seq}`;
      x.c.setAttribute('data-vbdlis-id', id);
      retry.push({
        id,
        value: x.v,
        soft,
        numeric: !!x.f.numeric,
        idx: results.indexOf(x.res),
        date: /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x.v),
      });
    }
    for (const x of viaPage) {
      if (!x.c.isConnected) continue;
      const id = `${TOKEN}-${++seq}`;
      x.c.setAttribute('data-vbdlis-id', id);
      retry.push({ id, value: x.v, soft: false, numeric: CANON_NUM.test(x.v), idx: results.indexOf(x.res), date: DATE_RE.test(x.v) });
    }
    retry.sort((a, b) => (b.date ? 1 : 0) - (a.date ? 1 : 0)); // ngày trước (trang có thể tự tính Năm sinh từ Ngày sinh)
    lastFill = { token, frame: location.href, scopeName: scope.name, opened, results, retry, items: recheck };
    return { ...base, token, scopeName: scope.name, opened, results, retry };
  }

  // Sau bước 2: đọc lại các ô, ô nào vẫn sai thì báo rõ
  async function verify(token, methods) {
    const last = lastFill;
    if (!last || last.token !== token) return null;
    await sleep(400);
    for (const it of last.retry) {
      const r = last.results[it.idx];
      if (!r) continue;
      const els = document.querySelectorAll(`[data-vbdlis-id="${it.id}"]`);
      const el = els.length === 1 ? els[0] : null;
      els.forEach((e) => e.removeAttribute('data-vbdlis-id'));
      if (!el || !isVisible(el)) {
        r.ok = false;
        r.msg = 'ô không còn trên trang (cửa sổ đã dựng lại) – bấm Điền lại';
        continue;
      }
      const m = (methods || []).find((x) => x && x.id === it.id);
      const kept = sameValue(el.value, it.value, it.numeric);
      if (it.soft && !(m && m.method)) {
        // trang không có thư viện riêng cho ô này → giữ kết quả cũ nếu ô vẫn đúng
        if (!kept) {
          r.ok = false;
          r.msg = `trang tự đổi thành “${el.value}”`;
        }
        continue;
      }
      if (it.soft && kept) {
        r.msg = [r.msg, `qua ${m.method}`].filter(Boolean).join(', ');
        flash(el, true);
        continue;
      }
      r.ok = kept;
      r.msg = kept
        ? `điền qua ${(m && m.method) || 'trang'}`
        : `trang vẫn chưa nhận (ô đang hiện “${el.value}”${m && m.method ? ', đã thử ' + m.method : ''}) – gõ tay giúp`;
      flash(el, kept);
    }
    // các ô đã điền đúng trước đó có bị trang đổi lại không (vd. Năm sinh tự tính lại)
    for (const x of last.items) {
      if (!x.res.ok || last.retry.some((it) => last.results[it.idx] === x.res)) continue;
      if (!x.c.isConnected || !isVisible(x.c)) {
        x.res.ok = false;
        x.res.msg = 'cửa sổ đã dựng lại, ô không còn – bấm Điền lại';
        continue;
      }
      if (!sameValue(x.c.value, x.v, x.f.numeric)) {
        setText(x.c, x.v, { force: true, numeric: x.f.numeric });
        await sleep(50);
        x.res.ok = sameValue(x.c.value, x.v, x.f.numeric);
        x.res.msg = x.res.ok ? 'trang tự đổi – đã điền lại' : `trang tự đổi thành “${x.c.value}”`;
        flash(x.c, x.res.ok);
      }
    }
    fillEnd();
    return { frame: last.frame, token, scopeName: last.scopeName, opened: last.opened, results: last.results };
  }

  // điền xong: báo bộ ghi thao tác ghi ngay các ô vừa đổi (khi cờ "tiện ích" còn bật), rồi mới tắt cờ
  function fillEnd() {
    try {
      document.dispatchEvent(new CustomEvent('vbdlis-fill-end'));
    } catch (e) {}
    window.__vbdlisActive = 0;
  }

  // ---------- Quét trường (để chỉnh cho khớp trang thật) ----------
  function scan() {
    const m = topModal();
    const scope = m ? { root: m, exclude: [] } : { root: document.body, exclude: [] };
    const els = [...scope.root.querySelectorAll(LABEL_SEL)].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 80 || (norm(t).match(/[a-z]/g) || []).length < 2) return false; // bỏ "*", "➜"…
      if (el.closest('#' + PANEL_HOST) || el.closest('button, option, select')) return false;
      // bỏ khối bao quanh ô nhập (chữ của nó là chữ trong danh sách chọn), trừ nhãn bọc ô tích;
      // khối chứa từ 2 ô trở lên (vd. hàng có 2 ô tích “Đồng sử dụng”, “Đăng ký lần đầu”) là khung, không phải nhãn
      const inner = [...el.querySelectorAll(CTRL)];
      if (inner.length > 1 || inner.some((c) => c.type !== 'checkbox' && c.type !== 'radio')) return false;
      return isVisible(el);
    });
    const deep = els.filter((el) => !els.some((o) => o !== el && el.contains(o) && norm(o.textContent) === norm(el.textContent)));
    const byCtrl = new Map(); // ô → nhãn gần nhất phía trước
    for (const el of deep) {
      // 'any' không nhận ô tích → thử thêm ô tích (vd. “Có quyền sử dụng đất”, “Đồng sử dụng”, “Đăng ký lần đầu”)
      const c = findControl(el, 'any', scope) || findControl(el, 'checkbox', scope);
      if (c && !byCtrl.has(c)) byCtrl.set(c, el);
    }
    // ô tích còn lại: chữ nằm NGAY SAU ô (không có nhãn đứng trước) → lấy chữ đó làm tên trường
    const rawNear = (c) => {
      if (c.id) {
        const l = document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
        if (l && l.textContent.trim()) return l;
      }
      const w = c.closest('label');
      if (w && w.textContent.trim()) return w;
      for (let x = c.nextElementSibling; x; x = x.nextElementSibling) {
        if (x.matches(CTRL) || x.querySelector(CTRL)) break;
        if ((x.textContent || '').trim()) return x;
      }
      return null;
    };
    for (const c of scope.root.querySelectorAll('input[type=checkbox]')) {
      if (byCtrl.has(c) || !usable(c) || c.closest('#' + PANEL_HOST)) continue;
      const el = rawNear(c);
      const t = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
      if (el && t && t.length <= 80 && (norm(t).match(/[a-z]/g) || []).length >= 2) byCtrl.set(c, el);
    }
    // màn hình này ứng với phần nào của tiện ích (để biết ô nào lấy được từ dữ liệu TB)
    const tk = m ? titleKey(modalTitle(m)) : '';
    const recep = !m && isReception();
    const secKey = !m ? (recep ? 'bienNhan' : '') : /^tim\b/.test(tk) ? '' : ['donDK', 'chu', 'thua', 'giayTo'].find((k) => SECTIONS[k].expect.test(tk)) || '';
    const pageTk = !m && !recep ? pageHeadingKey() : '';
    const known = (label) => {
      if (!secKey) return null;
      const n = norm(label);
      const secs = secKey === 'bienNhan' ? ['bienNhan', 'donVi', 'quyTrinh'] : [secKey];
      for (const s of secs) for (const f of SECTIONS[s].fields) if (f.labels.some((L) => norm(L) === n)) return { key: f.key, sec: s, name: f.name };
      return null;
    };
    const kindOf = (c) => (c.tagName === 'SELECT' ? 'select' : c.type === 'checkbox' ? 'checkbox' : c.type === 'radio' ? 'radio' : 'text');
    const fullVal = (c) =>
      c.tagName === 'SELECT'
        ? String((c.selectedIndex >= 0 && c.options[c.selectedIndex] && c.options[c.selectedIndex].text) || '').replace(/\s+/g, ' ').trim()
        : c.type === 'checkbox' || c.type === 'radio'
          ? !!c.checked
          : String(c.value || '');
    const sc = { root: scope.root, exclude: m ? [] : openModals(), name: scopeName(m), title: m ? modalTitle(m) : '' };
    const items = [...byCtrl.entries()]
      .sort((a, b) => (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .slice(0, 150)
      .map(([c, el]) => {
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        // lần thứ mấy nhãn này xuất hiện (nhãn trùng, vd. 2 ô “Diện tích”) – điền đúng ô đó
        const labs = findLabels(sc, label);
        const nth = Math.max(0, labs.findIndex((l) => l === el || l.contains(el) || el.contains(l)));
        const k = known(label);
        const kind = kindOf(c);
        return {
          label,
          nth,
          control: describe(c),
          value: valOf(c),
          kind,
          full: fullVal(c),
          locked: !!(c.disabled || (c.readOnly && kind === 'text')),
          opts: c.tagName === 'SELECT' ? [...c.options].slice(0, 40).map((o) => o.text.replace(/\s+/g, ' ').trim()) : undefined,
          key: k ? k.key : '',
          sec: k ? k.sec : '',
          kname: k ? k.name : '',
        };
      });
    // các nút của màn hình / cửa sổ (bạn yêu cầu 22/11: “lấy cả nút, tất cả các button”) – tích được hết
    const buttons = tplButtons(scope.root, m ? [] : openModals())
      .slice(0, 150)
      .map((b) => ({ text: b.text, key: b.key, nth: b.nth, id: b.el.id || '', lock: tplBtnLock(b), off: !!b.el.disabled }));
    return { frame: location.href, scopeName: m ? scopeName(m) : pageTk ? `màn hình “${pageHeadingName()}”` : scopeName(m), title: m ? modalTitle(m) : '', titleKey: m ? tk : pageTk, secKey, scope: m ? 'modal' : 'page', items, buttons };
  }

  function run(msg) {
    if (!msg) return null;
    SPEEDK = Math.max(1, Math.min(4, Number(msg.speed) || 1));
    if (msg.type === 'vbdlis-scan') return scan();
    if (msg.type === 'vbdlis-fill') {
      // __vbdlisActive: để bộ ghi thao tác biết thay đổi nào là do tiện ích điền (không phải người dùng gõ)
      const p = chain
        .then(() => {
          window.__vbdlisActive = Date.now();
          return fill(msg.section, msg.values || {});
        })
        .then(
          (r) => {
            if (!r || !r.retry || !r.retry.length) fillEnd(); // còn bước 2 thì verify() sẽ xóa
            return r;
          },
          (e) => {
            fillEnd();
            throw e;
          }
        );
      chain = p.catch(() => {});
      return p;
    }
    if (msg.type === 'vbdlis-act') return act(msg);
    return null;
  }

  window.__vbdlis = { v: VERSION, run, verify, _t: { norm, findLabels, findControl, findCheckByText, nearText, topModal, modalTitle, pickOption, sameValue, pageNum, readThuaTable, getScope, menuButton, menuItem, directOK, SECTIONS } };
})();
