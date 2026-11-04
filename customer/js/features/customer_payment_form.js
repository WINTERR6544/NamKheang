import {
  $,
  heading,
  card,
  field,
  button,
  orderSummary,
  checkbox,
  confirm,
  busy,
  banner,
  toast,
  icon,
} from "../components/customer_ui.js";
import {
  bindValidation,
  validators,
} from "../components/customer_validation.js";
import { getOrder } from "../services/customer_order_service.js";
import {
  uploadSlip,
  submitPayment,
  discardSlip,
  shopPaymentDetails,
} from "../services/customer_payment_service.js";
import { balance, money, esc, todayBangkok, orderUrl } from "../lib.js";
import { paymentGate } from "../customer_rules.js";
import { MAX_SLIP_BYTES, SLIP_TYPES } from "../customer_constants.js";
import { errorMessage } from "../customer_errors.js";
// Demo QR picture (not scannable): three finder squares, a "DEMO" band and a few data dots.
const finder = (x, y) =>
  '<rect x="' + x + '" y="' + y + '" width="28" height="28" rx="3"/>' +
  '<rect x="' + (x + 4) + '" y="' + (y + 4) + '" width="20" height="20" rx="2" fill="#fff"/>' +
  '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="12" height="12" rx="1.5"/>';
const DEMO_QR =
  '<svg class="qr-demo" viewBox="0 0 120 120" role="img" aria-label="QR ตัวอย่าง">' +
  finder(4, 4) +
  finder(88, 4) +
  finder(4, 88) +
  [[44, 8], [56, 8], [68, 20], [44, 28], [80, 32], [44, 90], [56, 90], [80, 90], [100, 90], [68, 102], [92, 102], [56, 110], [80, 110], [104, 110]]
    .map(([x, y]) => '<rect class="dot" x="' + x + '" y="' + y + '" width="6" height="6" rx="1"/>')
    .join("") +
  '<rect class="band" x="0" y="45" width="120" height="30"/><text x="60" y="66" text-anchor="middle">DEMO</text></svg>';
export async function render(context, el) {
  const bank = await shopPaymentDetails();
  const d = await getOrder(context.orderId, context.profile.customer_id),
    type = context.page === "deposit" ? "deposit" : "final";
  const q = d.quote,
    amount =
      type === "deposit" ? Number(q?.deposit_amount) : balance(q, d.payments);
  el.innerHTML =
    heading(
      type === "deposit" ? "ชำระมัดจำ" : "ชำระยอดคงเหลือ",
      "โอนเงินตามยอดที่ระบุ แล้วแนบหลักฐานเพื่อให้ร้านตรวจสอบ",
    ) + orderSummary(d.o);
  const gate = paymentGate(d, type),
    submitted = gate.submitted;
  if (submitted) {
    el.innerHTML += card(
      submitted.verified ? "ตรวจสอบการชำระแล้ว" : "รอร้านตรวจสอบ",
      "<p>ยอด " +
        money(submitted.amount) +
        "</p><p>ส่งหลักฐานแล้ว ไม่ต้องส่งซ้ำ</p>" +
        button("ดูรายการชำระเงิน", "#/payments", "ghost"),
    );
    return;
  }
  if (!gate.allowed) {
    el.innerHTML += card(
      "ยังไม่สามารถชำระเงินขั้นนี้",
      "<p>" +
        esc(gate.reason) +
        "</p>" +
        button("กลับไปคำสั่งซื้อ", orderUrl("order", d.o.order_id), "ghost"),
    );
    return;
  }
  el.innerHTML +=
    card(
      "",
      '<div class="row between"><div><p>ยอด' +
        (type === "deposit" ? "มัดจำ" : "คงเหลือ") +
        'ตามใบเสนอราคา</p><strong class="amount">' +
        money(amount) +
        '</strong></div><dl class="summary-dl"><dt>ยอดรวม</dt><dd>' +
        money(q.total_price) +
        "</dd><dt>มัดจำ</dt><dd>" +
        money(q.deposit_amount) +
        "</dd></dl></div>",
      "tint",
    ) +
    '<form class="grid cols2" id="payment-form" novalidate style="margin-top:18px">' +
    card(
      "1. ช่องทางชำระเงิน",
      (bank.accountNumber || bank.promptpay
        ? '<div class="pay-account"><h3>' +
          icon("imgAccountMultipleOutline", "236:13997") +
          'รายละเอียดบัญชี</h3><dl class="summary-dl">' +
          (bank.accountNumber
            ? "<dt>ธนาคาร</dt><dd>" + esc(bank.name) + "</dd><dt>ชื่อบัญชี</dt><dd>" + esc(bank.accountName) +
              "</dd><dt>เลขบัญชี</dt><dd><b>" + esc(bank.accountNumber) + "</b></dd>"
            : "") +
          (bank.promptpay ? "<dt>พร้อมเพย์</dt><dd>" + esc(bank.promptpay) + "</dd>" : "") +
          "</dl></div>"
        : '<div class="banner warning">ร้านยังไม่ได้ใส่บัญชีรับเงิน กรุณาขอบัญชีธนาคารหรือ QR จากร้านก่อนโอนเงิน</div>') +
        // The shop's own QR when it has uploaded one, otherwise a demo picture.
        '<div class="pay-qr">' +
        (bank.qrImage
          ? '<img src="' + esc(bank.qrImage) + '" alt="QR ชำระเงินของร้าน"><div><strong>QR Payment</strong><p class="small muted">สแกนเพื่อชำระเงินเข้าบัญชีร้าน</p></div>'
          : DEMO_QR +
            '<div><strong>QR Payment (ภาพสาธิต)</strong><p class="small muted">สำหรับแสดงรูปแบบการชำระเงินเท่านั้น ไม่เชื่อมกับบัญชีหรือระบบรับเงินใด ๆ</p></div>') +
        "</div>" +
        (bank.note ? '<p class="small muted">' + esc(bank.note) + "</p>" : "") +
        '<div class="rule"></div><p class="small">สถานะชำระเงินจะเปลี่ยนเมื่อร้านตรวจสอบยอดและหลักฐานแล้ว</p>',
    ) +
    '<section class="card"><h2>2. แนบหลักฐานการชำระเงิน</h2>' +
    '<div class="grid cols2">' +
    field("paid_date", "วันที่ชำระ", {
      type: "date",
      required: true,
      value: todayBangkok(),
    }) +
    field("paid_time", "เวลาชำระ", { type: "time", required: true }) +
    "</div>" +
    field("amount", "จำนวนเงินที่ชำระ (บาท)", {
      type: "number",
      value: amount.toFixed(2),
      readonly: true,
    }) +
    '<div class="field" id="slip-field"><label for="slip">หลักฐาน JPG, PNG หรือ PDF *</label><div class="file-drop">' +
    icon("imgCamera", "231:6699") +
    '<p>เลือกไฟล์หลักฐานการชำระเงิน</p><input id="slip" type="file" name="slip" accept="image/jpeg,image/png,application/pdf" aria-describedby="slip-error"><p class="upload-note">ขนาดไม่เกิน 10 MB</p><div id="preview"></div></div><p id="slip-error" class="field-error" data-error="slip" hidden></p></div>' +
    checkbox("confirmed", "ตรวจสอบยอด วันที่ และหลักฐานว่าถูกต้องแล้ว") +
    '<div data-banner hidden role="alert"></div><button class="btn block" type="submit">ส่งหลักฐานการชำระเงิน</button></section></form>';
  const form = $("#payment-form");
  let file = null,
    objectUrl = null;
  const validation = bindValidation(form, {
    paid_date: (v) =>
      v && v <= todayBangkok() ? "" : "กรุณาระบุวันที่ไม่เกินวันนี้",
    paid_time: (v) => (v ? "" : "กรุณาระบุเวลาชำระ"),
    confirmed: (v) => (v ? "" : "กรุณายืนยันความถูกต้อง"),
  });
  $("#slip").onchange = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    file = $("#slip").files[0] ?? null;
    const error =
      file &&
      (!SLIP_TYPES.includes(file.type) ||
        file.size > MAX_SLIP_BYTES ||
        !file.size)
        ? "กรุณาเลือก JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB"
        : "";
    $("#slip-error").textContent = error;
    $("#slip-error").hidden = !error;
    $("#slip").setAttribute("aria-invalid", String(Boolean(error)));
    if (error) {
      file = null;
      $("#preview").innerHTML = "";
      return;
    }
    $("#preview").innerHTML = file
      ? '<div class="file-info"><span>' +
        esc(file.name) +
        " · " +
        (file.size / 1024 / 1024).toFixed(2) +
        ' MB</span><button type="button" class="text-btn" id="remove-file">ลบ</button></div>'
      : "";
    if (file?.type.startsWith("image/")) {
      objectUrl = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.className = "file-preview";
      img.src = objectUrl;
      img.alt = "ตัวอย่างหลักฐาน";
      $("#preview").prepend(img);
    }
    if ($("#remove-file"))
      $("#remove-file").onclick = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        file = null;
        $("#slip").value = "";
        $("#preview").innerHTML = "";
      };
  };
  const cleanupPreview = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  window.addEventListener("pagehide", cleanupPreview, { once: true });
  context.onDispose?.(() => {
    cleanupPreview();
    window.removeEventListener("pagehide", cleanupPreview);
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!validation.validate()) return;
    const v = validation.values();
    if (!file) {
      $("#slip-error").textContent = "กรุณาแนบหลักฐานการชำระ";
      $("#slip-error").hidden = false;
      $("#slip").focus();
      return;
    }
    const paidAt = new Date(v.paid_date + "T" + v.paid_time + ":00+07:00");
    if (paidAt > new Date(Date.now() + 300000)) {
      banner(form, "วันที่และเวลาชำระต้องไม่อยู่ในอนาคต");
      return;
    }
    if (
      !(await confirm(
        "ส่งหลักฐานการชำระเงิน?",
        "ยอด " + money(amount) + " ร้านจะตรวจสอบก่อนยืนยันการชำระ",
        {
          label: "ส่งหลักฐาน",
        },
      ))
    )
      return;
    await busy(form, async () => {
      let path = null;
      try {
        path = await uploadSlip(file, context.profile.auth_id, d.o.order_id);
        await submitPayment({
          orderId: d.o.order_id,
          type,
          method: "transfer",
          path,
          amount,
          paidAt: paidAt.toISOString(),
        });
        toast("ส่งหลักฐานแล้ว รอร้านตรวจสอบ");
        location.replace(orderUrl("order", d.o.order_id));
      } catch (error) {
        if (path) {
          try {
            await discardSlip(path);
          } catch {
            /* Keep the payment error visible even when cleanup fails. */
          }
        }
        banner(form, errorMessage(error));
      }
    });
  };
}
