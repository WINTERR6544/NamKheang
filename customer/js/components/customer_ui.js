import { esc, money, date, orderUrl, table } from "../lib.js";
import { STATUS } from "../customer_constants.js";
import { errorMessage } from "../customer_errors.js";

import { ASSETS } from "../customer_assets.js";
export const $ = (s, root = document) => root.querySelector(s);
export function icon(name, screen = "215:1027", className = "") {
  const source = ASSETS[screen]?.[name];
  return source
    ? '<img class="icon ' +
        esc(className) +
        '" src="' +
        esc(source) +
        '" alt="" aria-hidden="true">'
    : "";
}
export const heading = (title, description = "", action = "") =>
  '<div class="page-head"><div><h1>' +
  esc(title) +
  '</h1><p class="muted">' +
  esc(description) +
  "</p></div>" +
  action +
  "</div>";
export const card = (title, body, cls = "") =>
  '<section class="card ' +
  cls +
  '">' +
  (title ? "<h2>" + esc(title) + "</h2>" : "") +
  body +
  "</section>";
export const button = (label, href, cls = "") =>
  '<a class="btn ' + cls + '" href="' + esc(href) + '">' + esc(label) + "</a>";
export const badge = (status) =>
  '<span class="badge ' +
  (status === 99
    ? "bad"
    : status === 10
      ? "success"
      : [1, 8, 9].includes(status)
        ? "warning"
        : "") +
  '"><i></i>' +
  esc(STATUS[status] ?? "ไม่ทราบสถานะ") +
  "</span>";
export const loading = (label = "กำลังโหลดข้อมูล") =>
  '<div class="loading" role="status" aria-live="polite"><span class="spinner"></span><p>' +
  esc(label) +
  '</p><div class="skeleton"></div><div class="skeleton short"></div></div>';
export const empty = (title, description = "", action = "") =>
  '<div class="empty"><span class="empty-mark">' +
  icon("imgClipboardList") +
  "</span><h2>" +
  esc(title) +
  '</h2><p class="muted">' +
  esc(description) +
  "</p>" +
  action +
  "</div>";
export function errorState(error, retry) {
  const el = document.createElement("div");
  el.className = "card empty";
  el.innerHTML =
    '<h2>โหลดข้อมูลไม่สำเร็จ</h2><p class="banner error" role="alert">' +
    esc(errorMessage(error)) +
    '</p><button class="btn" type="button">ลองใหม่</button>';
  $("button", el).onclick = retry;
  return el;
}
export function toast(message, type = "success") {
  let region = $("#toasts");
  if (!region) {
    region = document.createElement("div");
    region.id = "toasts";
    region.className = "toasts";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const item = document.createElement("div");
  item.className = "toast " + type;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), type === "error" ? 8000 : 4500);
}
export function banner(form, message, type = "error") {
  const target = form.querySelector("[data-banner]");
  if (target) {
    target.className = "banner " + type;
    target.textContent = message;
    target.hidden = !message;
  }
}
export function field(
  name,
  label,
  {
    value = "",
    type = "text",
    required = false,
    placeholder = "",
    readonly = false,
    options = null,
    rows = 3,
    autocomplete = "",
    maxLength = 1000,
  } = {},
) {
  const id = "field-" + name;
  const attrs =
    ' id="' +
    id +
    '" name="' +
    name +
    '" aria-describedby="' +
    id +
    '-error" ' +
    (required ? "required " : "") +
    (readonly ? "readonly " : "");
  const input = options
    ? "<select" +
      attrs +
      ">" +
      options
        .map(
          (o) =>
            '<option value="' +
            esc(o.value) +
            '" ' +
            (String(value) === String(o.value) ? "selected" : "") +
            ">" +
            esc(o.label) +
            "</option>",
        )
        .join("") +
      "</select>"
    : type === "textarea"
      ? "<textarea" +
        attrs +
        ' rows="' +
        rows +
        '" maxlength="' +
        maxLength +
        '" placeholder="' +
        esc(placeholder) +
        '">' +
        esc(value) +
        "</textarea>"
      : "<input" +
        attrs +
        ' type="' +
        type +
        '" value="' +
        esc(value) +
        '" placeholder="' +
        esc(placeholder) +
        '" autocomplete="' +
        esc(autocomplete) +
        '" maxlength="' +
        maxLength +
        '" ' +
        (type === "tel" ? 'inputmode="tel"' : "") +
        ">";
  return (
    '<div class="field"><label for="' +
    id +
    '">' +
    esc(label) +
    (required ? '<span class="required"> *</span>' : "") +
    "</label>" +
    input +
    '<p id="' +
    id +
    '-error" class="field-error" data-error="' +
    name +
    '" hidden></p></div>'
  );
}
export function checkbox(name, label, checked = false) {
  return (
    '<div class="field"><label class="check-row"><input type="checkbox" name="' +
    name +
    '" ' +
    (checked ? "checked" : "") +
    ' aria-describedby="field-' +
    name +
    '-error"><span>' +
    esc(label) +
    '</span></label><p class="field-error" id="field-' +
    name +
    '-error" data-error="' +
    name +
    '" hidden></p></div>'
  );
}
export async function busy(form, task) {
  if (form.dataset.busy === "true") return;
  form.dataset.busy = "true";
  form.setAttribute("aria-busy", "true");
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  const labels = buttons.map((b) => b.innerHTML);
  buttons.forEach((b) => {
    b.disabled = true;
    b.textContent = "กำลังดำเนินการ…";
  });
  try {
    return await task();
  } finally {
    delete form.dataset.busy;
    form.removeAttribute("aria-busy");
    buttons.forEach((b, i) => {
      b.disabled = false;
      b.innerHTML = labels[i];
    });
  }
}
export function modal(
  title,
  body,
  {
    onOpen,
    onSave,
    saveLabel = "ยืนยัน",
    danger = false,
    className = "",
    headerHtml = "",
    showFooter = true,
  } = {},
) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "modal " + className;
    dialog.innerHTML =
      '<div class="modal-head">' +
      (headerHtml || '<h2 id="dialog-title">' + esc(title) + "</h2>") +
      '<button type="button" class="icon-btn close" aria-label="ปิด">' +
      icon("imgX", "236:13997") +
      (className === "profile-modal" ? "<span>ปิด</span>" : "") +
      '</button></div><div class="modal-body">' +
      body +
      '</div><div class="banner error" data-dialog-error hidden role="alert"></div><div class="modal-actions"><button type="button" class="btn ghost close">กลับ</button>' +
      (onSave
        ? '<button type="button" class="btn ' +
          (danger ? "danger" : "") +
          '" data-save>' +
          esc(saveLabel) +
          "</button>"
        : "") +
      "</div>";
    if (!showFooter) dialog.querySelector(".modal-actions").remove();
    dialog.setAttribute("aria-labelledby", "dialog-title");
    document.body.append(dialog);
    let saving = false;
    const finish = (value) => {
      dialog.close();
      dialog.remove();
      previous?.focus();
      resolve(value);
    };
    dialog.querySelectorAll(".close").forEach(
      (b) =>
        (b.onclick = () => {
          if (!saving) finish(false);
        }),
    );
    dialog.addEventListener("customer:dispose", () => {
      if (!saving) finish(false);
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (!saving) finish(false);
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog && !saving) {
        const r = dialog.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          finish(false);
      }
    });
    if (onSave)
      $("[data-save]", dialog).onclick = async () => {
        if (saving) return;
        saving = true;
        const b = $("[data-save]", dialog);
        b.disabled = true;
        b.textContent = "กำลังดำเนินการ…";
        $("[data-dialog-error]", dialog).hidden = true;
        try {
          await onSave(dialog);
          finish(true);
        } catch (error) {
          const target = $("[data-dialog-error]", dialog);
          target.textContent = errorMessage(error);
          target.hidden = false;
          b.disabled = false;
          b.textContent = saveLabel;
          saving = false;
        }
      };
    dialog.showModal();
    onOpen?.(dialog);
    dialog.querySelectorAll("form").forEach((form) =>
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (onSave) $("[data-save]", dialog).click();
      }),
    );
  });
}
export const confirm = (
  title,
  description,
  { label = "ยืนยัน", danger = false } = {},
) =>
  modal(title, "<p>" + esc(description) + "</p>", {
    saveLabel: label,
    danger,
    onSave: async () => {},
  });
export function orderSummary(o) {
  return (
    '<section class="order-summary"><div><p class="eyebrow">ORDER ' +
    esc(o.order_code) +
    "</p><h2>" +
    esc(o.machine_models?.name ?? o.machine_type) +
    "</h2><p>" +
    esc(o.capacity) +
    " · " +
    esc(o.install_address) +
    "</p></div>" +
    badge(o.status) +
    "</section>"
  );
}
export function orderTable(rows) {
  if (!rows.length)
    return empty(
      "ยังไม่มีคำสั่งซื้อ",
      "เริ่มต้นด้วยการเลือกรุ่นเครื่องและส่งรายละเอียด",
      button("สร้างคำสั่งซื้อ", "#/new-order"),
    );
  return table(
    [
      {
        h: "ORDER NO.",
        cls: "mono",
        f: (o) => `<strong>${esc(o.order_code)}</strong>`,
      },
      {
        h: "รุ่นเครื่อง / กำลังผลิต",
        f: (o) =>
          `<strong>${esc(o.machine_models?.name ?? o.machine_type)}</strong><small>${esc(o.capacity)}</small>`,
      },
      { h: "วันที่สั่ง", f: (o) => date(o.created_at) },
      { h: "สถานะปัจจุบัน", f: (o) => badge(o.status) },
      {
        h: "การทำงาน",
        f: (o) =>
          button("ดูรายละเอียด", orderUrl("order", o.order_id), "ghost sm"),
      },
    ],
    rows,
    (o) => orderUrl("order", o.order_id),
  );
}
export const quotationTable = (q) =>
  '<div class="table-wrap"><table><thead><tr><th>รายการ</th><th class="right">จำนวนเงิน</th></tr></thead><tbody>' +
  q.quotation_items
    .map(
      (i) =>
        "<tr><td>" +
        esc(i.description) +
        '</td><td class="right">' +
        money(i.amount) +
        "</td></tr>",
    )
    .join("") +
  '<tr><td>ยอดก่อนภาษี</td><td class="right">' +
  money(q.subtotal) +
  "</td></tr><tr><td>VAT" +
  (q.subtotal
    ? " (" + ((Number(q.vat) / Number(q.subtotal)) * 100).toFixed(2) + "%)"
    : "") +
  '</td><td class="right">' +
  money(q.vat) +
  '</td></tr><tr class="total"><td>ยอดรวมสุทธิ</td><td class="right">' +
  money(q.total_price) +
  "</td></tr></tbody></table></div>";
