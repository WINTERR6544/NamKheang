import {
  $,
  heading,
  card,
  button,
  orderSummary,
  quotationTable,
} from "../components/customer_ui.js";

import { getOrder } from "../services/customer_order_service.js";
import { esc, money, date, orderUrl } from "../lib.js";
export async function render(context, el) {
  const d = await getOrder(context.orderId, context.profile.customer_id);
  const final = d.payments.find(
    (p) => p.pay_type === "final" && p.verified && p.receipt_no,
  );
  el.innerHTML =
    heading("ใบเสร็จรับเงิน", "ข้อมูลจากใบเสร็จที่ร้านออกหลังตรวจสอบการชำระ") +
    orderSummary(d.o);
  if (!final) {
    el.innerHTML += card(
      "ยังไม่มีใบเสร็จ",
      "<p>ใบเสร็จจะแสดงเมื่อร้านตรวจสอบยอดคงเหลือและออกเลขที่ใบเสร็จแล้ว</p>" +
        button("กลับไปคำสั่งซื้อ", orderUrl("order", d.o.order_id), "ghost"),
    );
    return;
  }
  const deposits = d.payments
    .filter((p) => p.pay_type === "deposit" && p.verified)
    .reduce((n, p) => n + Number(p.amount), 0);
  el.innerHTML += card(
    "NamKheang · ใบเสร็จ " + final.receipt_no,
    '<dl class="summary-dl"><dt>ผู้ชำระ</dt><dd>' +
      esc(context.profile.name) +
      "</dd><dt>เลขที่คำสั่งซื้อ</dt><dd>" +
      esc(d.o.order_code) +
      "</dd><dt>วันที่ชำระยอดคงเหลือ</dt><dd>" +
      date(final.paid_at, true) +
      "</dd><dt>มัดจำที่ตรวจสอบแล้ว</dt><dd>" +
      money(deposits) +
      "</dd><dt>ยอดคงเหลือที่รับชำระ</dt><dd>" +
      money(final.amount) +
      "</dd><dt>รับชำระรวม</dt><dd>" +
      money(deposits + Number(final.amount)) +
      "</dd></dl>" +
      (d.quote ? quotationTable(d.quote) : "") +
      '<p class="muted small">สำเนาข้อมูลการรับชำระจากระบบ หากต้องการใบกำกับภาษีหรือเอกสารต้นฉบับ กรุณาติดต่อร้าน</p><div class="actions"><button class="btn" id="print-receipt">พิมพ์ / บันทึก PDF</button>' +
      button("กลับไปคำสั่งซื้อ", orderUrl("order", d.o.order_id), "ghost") +
      "</div>",
  );
  $("#print-receipt").onclick = () => window.print();
}
