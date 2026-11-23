// VBDLIS Điền Nhanh – bước 2: điền các ô "khó" bằng chính thư viện của trang VBDLIS
// (ô có lịch chọn ngày, ô số định dạng "56.5 m²", ô có mặt nạ nhập…).
// Hàm này được background chạy TRONG trang (world MAIN) để dùng được jQuery/plugin của trang.
// Các ô cần điền đã được bộ điền đánh dấu bằng thuộc tính data-vbdlis-id.
// eslint-disable-next-line no-unused-vars
var vbdlisPageSetter = async function (items) {
  const $ = window.jQuery;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const it of items || []) {
    const found = document.querySelectorAll('[data-vbdlis-id="' + it.id + '"]');
    if (found.length !== 1) {
      out.push({ id: it.id, method: '' }); // không thấy hoặc trùng dấu → không đụng vào ô nào
      continue;
    }
    const el = found[0];
    const v = String(it.value).trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    const date = m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
    // chỉ coi là số khi đúng dạng dấu chấm thập phân (56.5); "56,5" đã được bảng điền đổi trước đó
    const num = it.numeric && /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : NaN;
    const hosts = [el, el.parentElement, el.closest('.input-group'), el.closest('.date')].filter(Boolean);
    const used = [];
    try {
      // 1) ô số có định dạng (AutoNumeric / Kendo)
      if (!isNaN(num)) {
        const an = window.AutoNumeric && window.AutoNumeric.getAutoNumericElement && window.AutoNumeric.getAutoNumericElement(el);
        if (an) {
          an.set(num);
          used.push('AutoNumeric');
        } else if ($ && $.fn.autoNumeric && $(el).data('autoNumeric')) {
          $(el).autoNumeric('set', num);
          used.push('autoNumeric');
        } else if ($ && $(el).data('kendoNumericTextBox')) {
          const w = $(el).data('kendoNumericTextBox');
          w.value(num);
          w.trigger('change');
          used.push('kendoNumericTextBox');
        }
      }
      // 2) ô ngày có lịch chọn
      if (date && !used.length && $) {
        for (const h of hosts) {
          const $h = $(h);
          if ($h.data('kendoDatePicker')) {
            const w = $h.data('kendoDatePicker');
            w.value(date);
            w.trigger('change');
            used.push('kendoDatePicker');
            break;
          }
          if ($h.data('DateTimePicker')) {
            $h.data('DateTimePicker').date(v);
            used.push('DateTimePicker');
            break;
          }
          if ($h.data('daterangepicker')) {
            const p = $h.data('daterangepicker');
            p.setStartDate(date);
            p.setEndDate(date);
            used.push('daterangepicker');
            break;
          }
          if ($h.data('datepicker') && $.fn.datepicker) {
            $h.datepicker('setDate', date); // bootstrap-datepicker và jQuery UI đều có setDate
            used.push('datepicker');
            break;
          }
        }
      }
      if (date && !used.length && el._flatpickr) {
        el._flatpickr.setDate(date, true);
        used.push('flatpickr');
      }
      // 3) ô có mặt nạ nhập
      if (!used.length && el.inputmask && typeof el.inputmask.setValue === 'function') {
        el.inputmask.setValue(v);
        used.push('inputmask');
      }
      // 4) không nhận ra thư viện: ô đã hiện đúng (soft) thì để nguyên; ô bị trang xóa thì đặt bằng jQuery của trang
      if (!used.length && !it.soft && $) {
        $(el).val(v);
        used.push('jQuery');
      }
      if (!used.length && !it.soft && !$) {
        // trang không có jQuery: gán thẳng giá trị (sự kiện change bắn ở dưới)
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        used.push('native');
      }
      if (used.length) {
        if ($) $(el).trigger('change');
        else el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {
      used.push('lỗi ' + (e && e.message));
    }
    await sleep(120);
    out.push({ id: it.id, method: used.join('+') });
  }
  return out;
};

// Ô chọn dùng select2: một số trang chỉ phản ứng với sự kiện "select2:select" (vd. thêm quy trình vào bảng)
// eslint-disable-next-line no-unused-vars
var vbdlisFireSelect2 = function (id) {
  const found = document.querySelectorAll('[data-vbdlis-id="' + id + '"]');
  found.forEach((e) => e.removeAttribute('data-vbdlis-id'));
  if (found.length !== 1) return { ok: false, why: 'không thấy ô' };
  const el = found[0];
  const $ = window.jQuery;
  if (!$) return { ok: false, why: 'trang không có jQuery' };
  const opt = el.options[el.selectedIndex];
  $(el).trigger({ type: 'select2:select', params: { data: { id: el.value, text: opt ? opt.text : '', element: opt } } });
  return { ok: true };
};

// Đính kèm file quét: tiện ích đã đặt sẵn file vào một ô ẩn input[data-vbdlis-for="<data-id của dòng>"].
// Khi BẠN bấm “Tải lên” ở dòng đó, trang thường gọi input.click() để mở hộp chọn file → thay vì mở hộp,
// đưa file đã đặt sẵn vào ô của dòng rồi báo “change” như khi bạn chọn file. Ô không có file đặt sẵn → mở hộp như thường.
// eslint-disable-next-line no-unused-vars
var vbdlisArmFile = function () {
  const V = 2; // đổi số này khi sửa móc: trang chưa tải lại (F5) vẫn được thay móc mới
  if (window.__vbdlisFileHook === V) return { ok: true, already: true };
  const P = HTMLInputElement.prototype;
  // giữ hàm gốc của trình duyệt từ lần cài đầu (móc cũ không bị lồng vào móc mới)
  const orig = window.__vbdlisOrig || { click: P.click, showPicker: P.showPicker };
  window.__vbdlisOrig = orig;
  window.__vbdlisFileHook = V;
  // nhớ phần tử có data-id vừa được bấm (nút “Tải lên” của dòng): trang tạo ô chọn file MỚI (không data-id) thì vẫn biết dòng nào
  if (!window.__vbdlisLastClick) {
    window.__vbdlisLastClick = { id: '', at: 0 };
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target && e.target.closest && e.target.closest('[data-id]');
        if (a) window.__vbdlisLastClick = { id: a.getAttribute('data-id') || '', at: Date.now() };
      },
      true
    );
  }
  // ô chọn file của một dòng có file đặt sẵn → đưa BẢN SAO file vào ô đó, báo “change”, trả true (không mở hộp chọn file)
  const supply = (el) => {
    try {
      if (el.type !== 'file') return false;
      const tr = el.closest('tr');
      const last = window.__vbdlisLastClick;
      const id =
        el.getAttribute('data-id') ||
        (tr && tr.getAttribute('data-id')) ||
        el.getAttribute('data-vbdlis-armed') ||
        (last && Date.now() - last.at < 3000 ? last.id : '');
      if (!id) return false;
      // ô đặt sẵn nằm trong bảng điền (shadow DOM của tiện ích) – trang không thấy, không đụng tới
      const host = document.getElementById('vbdlis-dien-nhanh-host');
      const pool = [...((host && host.shadowRoot && host.shadowRoot.querySelectorAll('input[data-vbdlis-for]')) || [])];
      const stash = pool.find((s) => s.getAttribute('data-vbdlis-for') === id);
      if (!stash || !stash.files || !stash.files.length) return false;
      // bản sao riêng: gán chung một danh sách file thì trang xoá ô này (value='') sẽ xoá luôn bản kia
      const dt = new DataTransfer();
      for (const f of stash.files) dt.items.add(f);
      el.files = dt.files;
      stash.remove(); // dùng một lần
      setTimeout(() => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, 0);
      return true;
    } catch (e) {
      return false;
    }
  };
  P.click = function () {
    if (supply(this)) return undefined;
    return orig.click.apply(this, arguments);
  };
  if (typeof orig.showPicker === 'function') {
    P.showPicker = function () {
      if (supply(this)) return undefined;
      return orig.showPicker.apply(this, arguments);
    };
  }
  return { ok: true };
};
