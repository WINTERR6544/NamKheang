import { table, esc, money, date, orderUrl } from "../lib.js";
import {
  $,
  heading,
  card,
  empty,
  button,
  toast,
  loading,
  errorState,
} from "../components/customer_ui.js";

import {
  listPayments,
  signedSlip,
} from "../services/customer_payment_service.js";

import { PAYMENT_LABELS } from "../customer_constants.js";
import { errorMessage } from "../customer_errors.js";
export async function showSlip(path) {
  // Open immediately to avoid popup blockers, then replace with a short-lived URL.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await signedSlip(path);
    if (tab) tab.location.replace(url);
    else location.assign(url);
  } catch (error) {
    tab?.close();
    toast(errorMessage(error), "error");
  }
}

export async function render(context, el) {
  el.innerHTML =
    heading("การชำระเงิน", "ตรวจสอบหลักฐานการชำระ ใบเสร็จ และการคืนมัดจำ") +
    '<div class="toolbar"><div class="row"><select id="payment-type" aria-label="ประเภทการชำระ"><option value="all">ทุกประเภท</option><option value="deposit">มัดจำ</option><option value="final">ยอดคงเหลือ</option><option value="refund">คืนมัดจำ</option></select><select id="payment-status" aria-label="สถานะการตรวจสอบ"><option value="all">ทุกสถานะ</option><option value="pending">รอตรวจสอบ</option><option value="verified">ตรวจสอบแล้ว</option></select></div></div><div class="card table-card" id="payment-table"></div>';
  let page = 1,
    generation = 0;
  const size = 20,
    target = $("#payment-table", el);
  context.onDispose?.(() => {
    generation++;
  });
  async function draw() {
    const token = ++generation;
    target.innerHTML = loading();
    try {
      const result = await listPayments(context.profile.customer_id, {
        page,
        size,
        type: $("#payment-type", el).value,
        state: $("#payment-status", el).value,
      });
      if (token !== generation) return;
      if (page > 1 && (page - 1) * size >= result.count) {
        page = 1;
        return draw();
      }
      target.innerHTML = result.rows.length
        ? table(
            [
              {
                h: "คำสั่งซื้อ",
                cls: "mono",
                f: (payment) => esc(payment.orders.order_code),
              },
              {
                h: "ประเภท",
                f: (payment) =>
                  esc(PAYMENT_LABELS[payment.pay_type] || payment.pay_type),
              },
              { h: "จำนวนเงิน", f: (payment) => money(payment.amount) },
              {
                h: "สถานะ",
                f: (payment) =>
                  `<span class="badge ${payment.verified ? "success" : "warning"}">${payment.verified ? (payment.pay_type === "refund" ? "คืนเงินแล้ว" : "ตรวจสอบแล้ว") : "รอตรวจสอบ"}</span>`,
              },
              { h: "วันที่", f: (payment) => date(payment.paid_at, true) },
              {
                h: "รายละเอียด",
                f: (payment) =>
                  button(
                    payment.pay_type === "refund"
                      ? "บัญชีและคืนเงิน"
                      : "ดูคำสั่งซื้อ",
                    orderUrl(
                      payment.pay_type === "refund" ? "refund" : "order",
                      payment.order_id,
                    ),
                    "ghost sm",
                  ) +
                  (payment.verified && payment.receipt_no
                    ? " " +
                      button(
                        "ใบเสร็จ",
                        orderUrl("receipt", payment.order_id),
                        "ghost sm",
                      )
                    : "") +
                  (payment.slip_path
                    ? ` <button class="btn ghost sm" data-slip="${esc(payment.slip_path)}">หลักฐาน</button>`
                    : ""),
              },
            ],
            result.rows,
          )
        : empty(
            "ไม่มีรายการที่ตรงกับตัวกรอง",
            "รายการจะแสดงหลังส่งหลักฐานการชำระเงิน",
            button("ดูคำสั่งซื้อ", "#/orders"),
          );
      target.innerHTML += `<div class="pagination"><small>แสดง ${result.rows.length} จาก ${result.count} รายการ</small><div class="row"><button id="payment-prev" aria-label="หน้าก่อน" ${page <= 1 ? "disabled" : ""}>‹</button><button class="current" aria-current="page">${page}</button><button id="payment-next" aria-label="หน้าถัดไป" ${page * size >= result.count ? "disabled" : ""}>›</button></div></div>`;
      $("#payment-prev", el).onclick = () => {
        page--;
        draw();
      };
      $("#payment-next", el).onclick = () => {
        page++;
        draw();
      };
    } catch (error) {
      if (token === generation) target.replaceChildren(errorState(error, draw));
    }
  }
  // One listener survives every filter/pagination redraw.
  target.onclick = (event) => {
    const button = event.target.closest("[data-slip]");
    if (button) showSlip(button.dataset.slip);
  };
  $("#payment-type", el).onchange = $("#payment-status", el).onchange = () => {
    page = 1;
    draw();
  };
  await draw();
}
