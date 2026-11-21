// VBDLIS Điền Nhanh – bộ điền (chạy trong từng khung của trang VBDLIS)
// Tìm ô theo NHÃN hiển thị trên màn hình (vd. "Số thửa", "Số giấy tờ"), không phụ thuộc id của trang.
// Không bao giờ bấm nút Lưu. Chỉ bấm nút MỞ cửa sổ nhập: "+ Thêm thửa đất" (màn hình tiếp nhận) và
// "Thêm → Cá nhân" / "Thêm → Thửa đất" (cửa sổ Nhập đơn đăng ký).
(() => {
  const VERSION = 14;
  if (window.__vbdlis && window.__vbdlis.v === VERSION) return;
  const TOKEN = Math.random().toString(36).slice(2, 8); // đánh dấu riêng cho lần nạp này (tránh nhầm dấu cũ)
  let lastFill = null; // kết quả lần điền gần nhất (cho bước kiểm tra lại)
  let seq = 0;
  let fillSeq = 0;
  let chain = Promise.resolve(); // các lệnh điền chạy lần lượt, không chồng nhau

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
        { key: 'ngayHetHan', name: 'Ngày hết hạn', labels: ['Ngày hết hạn'], kind: 'text', force: true, widget: true },
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
            const nt = norm(t);
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

  const zIndexOf = (el) => {
    let z = 0;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const v = parseInt(getComputedStyle(e).zIndex, 10);
      if (!isNaN(v)) z = Math.max(z, v);
    }
    return z;
  };

  function openModals() {
    const ms = [...document.querySelectorAll(MODAL_SEL)].filter(
      (m) => isVisible(m) && !m.closest('#' + PANEL_HOST) && [...m.querySelectorAll(CTRL)].some(usable)
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
  // select bị thư viện (select2/chosen…) ẩn đi vẫn dùng được nếu khung chứa nó đang hiện
  const usable = (c) => isVisible(c) || (c.tagName === 'SELECT' && isVisible(c.parentElement));

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
      case 'highlight': {
        const tm = msg.inModal ? topModal() : null;
        if (msg.inModal && !tm) return { ...base, ok: false };
        const b = (tm ? buttonsByText(msg.texts || [], tm, []) : buttonsByText(msg.texts || [], document.body, openModals()))[0];
        if (!b) return { ...base, ok: false };
        b.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const prev = b.style.boxShadow;
        b.style.boxShadow = `0 0 0 4px ${msg.color || '#f59e0b'}`;
        setTimeout(() => (b.style.boxShadow = prev), 10000);
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

  // ---------- Điền ----------
  async function fill(sectionKey, values) {
    const sec = SECTIONS[sectionKey];
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
            : findControl(lab, f.kind, scope)
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
      if (!t || t.length > 40 || (norm(t).match(/[a-z]/g) || []).length < 2) return false; // bỏ "*", "➜"…
      if (el.closest('#' + PANEL_HOST) || el.closest('button, option, select')) return false;
      // bỏ khối bao quanh ô nhập (chữ của nó là chữ trong danh sách chọn), trừ nhãn bọc ô tích
      if ([...el.querySelectorAll(CTRL)].some((c) => c.type !== 'checkbox' && c.type !== 'radio')) return false;
      return isVisible(el);
    });
    const deep = els.filter((el) => !els.some((o) => o !== el && el.contains(o) && norm(o.textContent) === norm(el.textContent)));
    const byCtrl = new Map(); // ô → nhãn gần nhất phía trước
    for (const el of deep) {
      const c = findControl(el, 'any', scope);
      if (c) byCtrl.set(c, el);
    }
    const items = [...byCtrl.entries()]
      .sort((a, b) => (a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .slice(0, 150)
      .map(([c, el]) => ({ label: el.textContent.replace(/\s+/g, ' ').trim(), control: describe(c), value: valOf(c) }));
    return { frame: location.href, scopeName: scopeName(m), items };
  }

  function run(msg) {
    if (!msg) return null;
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
