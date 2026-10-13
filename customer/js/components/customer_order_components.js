import { card, button, badge, quotationTable } from "./customer_ui.js";
import { esc, date, money, orderUrl, balance } from "../lib.js";
import { currentAcceptance, quoteExpired } from "../customer_rules.js";
import { STATUS, MAIN_PATH, CANCELLABLE } from "../customer_constants.js";
export function timeline(d) {
  // Keep every log, including rework loops and repeat installation appointments.
  return card(
    "ประวัติคำสั่งซื้อ",
    '<ol class="timeline">' +
      d.logs
        .map(
          (l, i) =>
            '<li class="done ' +
            (i === d.logs.length - 1 ? "current" : "") +
            '"><strong>' +
            esc(STATUS[l.status]) +
            "</strong><small>" +
            date(l.changed_at, true) +
            "</small>" +
            (l.note ? "<p>" + esc(l.note) + "</p>" : "") +
            "</li>",
        )
        .join("") +
      "</ol>",
  );
}
export function progress(d) {
  const index = MAIN_PATH.indexOf(d.o.status === 6 ? 5 : d.o.status);
  return (
    '<div class="progress" aria-label="สถานะ ' +
    esc(STATUS[d.o.status]) +
    '">' +
    MAIN_PATH.map(
      (s, i) =>
        '<span class="' +
        (i < index ? "done" : i === index ? "current" : "") +
        '" title="' +
        esc(STATUS[s]) +
        '"></span>',
    ).join("") +
    "</div>"
  );
}
export function nextAction(d) {
  const { o, quote: q, payments: p, acceptance: ac } = d;
  const pending = (type) => p.some((x) => x.pay_type === type && !x.verified);
  let title = "",
    text = "",
    page = "";
  if (o.status === 0) {
    title = "รอใบเสนอราคา";
    text = "ร้านได้รับคำสั่งซื้อแล้ว และจะตรวจสอบรายละเอียดเพื่อออกใบเสนอราคา";
  } else if (o.status === 1) {
    title = pending("deposit") ? "รอตรวจสอบมัดจำ" : "ใบเสนอราคาพร้อมแล้ว";
    text = pending("deposit")
      ? "ส่งหลักฐานแล้ว รอร้านตรวจสอบก่อนเข้าสู่ขั้นตอนผลิต"
      : "ตรวจสอบรายการและราคาก่อนยืนยัน";
    page = pending("deposit")
      ? ""
      : q?.status === "accepted" && !quoteExpired(q)
        ? "deposit"
        : "quotation";
  } else if ([2, 3].includes(o.status)) {
    title = "กำลังประสานโรงงาน";
    text = "ร้านจะยืนยันโรงงานหลังตรวจมัดจำแล้ว";
  } else if (o.status === 4) {
    title = "กำลังผลิตเครื่อง";
    text = "กำหนดผลิตเสร็จโดยประมาณ " + date(o.est_finish_date);
  } else if ([5, 6].includes(o.status)) {
    title = o.status === 6 ? "กำลังแก้ไขตามผล QC" : "กำลังตรวจคุณภาพ";
    text = "ร้านและโรงงานจะตรวจให้ครบก่อนนัดติดตั้ง";
  } else if ([7, 8].includes(o.status)) {
    title = "กำหนดการติดตั้ง";
    text =
      o.status === 7
        ? "ร้านกำลังประสานวันสะดวก"
        : "ตรวจสอบวันนัดและเตรียมพื้นที่ติดตั้ง";
    page = "appointment";
  } else if (o.status === 9) {
    title = pending("final")
      ? "รอตรวจสอบยอดคงเหลือ"
      : "ตรวจรับและชำระยอดคงเหลือ";
    text = pending("final")
      ? "ส่งหลักฐานแล้ว รอร้านตรวจสอบและออกใบเสร็จ"
      : "ตรวจสอบการทำงานของเครื่องก่อนยืนยัน";
    page = pending("final")
      ? ""
      : Boolean(currentAcceptance(o, ac))
        ? "final-payment"
        : "acceptance";
  } else if (o.status === 10) {
    title = "คำสั่งซื้อเสร็จสมบูรณ์";
    text = "ตรวจรับและชำระเงินครบแล้ว";
  } else {
    title = "คำสั่งซื้อยกเลิกแล้ว";
    text = o.cancel_reason || "";
    page = p.some((x) => x.pay_type === "refund") ? "refund" : "";
  }
  return card(
    title,
    '<p class="muted">' +
      esc(text) +
      "</p>" +
      (page
        ? '<div class="actions">' +
          button("ดำเนินการต่อ", orderUrl(page, o.order_id)) +
          "</div>"
        : ""),
  );
}
export const paymentSummary = (d) =>
  card(
    "สรุปยอดชำระ",
    '<dl class="summary-dl"><dt>ยอดตามใบเสนอราคา</dt><dd>' +
      money(d.quote?.total_price) +
      "</dd><dt>มัดจำที่ตรวจสอบแล้ว</dt><dd>" +
      money(
        d.payments
          .filter((p) => p.pay_type === "deposit" && p.verified)
          .reduce((s, p) => s + Number(p.amount), 0),
      ) +
      "</dd><dt>ยอดคงเหลือ</dt><dd>" +
      money(balance(d.quote, d.payments)) +
      "</dd></dl>",
  );
export function orderDetails(d) {
  return card(
    "รายละเอียดเครื่องและการติดตั้ง",
    '<dl class="summary-dl"><dt>ประเภทเครื่อง</dt><dd>' +
      esc(d.o.machine_type) +
      "</dd><dt>กำลังผลิต</dt><dd>" +
      esc(d.o.capacity) +
      "</dd><dt>ที่อยู่ติดตั้ง</dt><dd>" +
      esc(d.o.install_address) +
      "</dd><dt>ระบบไฟฟ้า</dt><dd>" +
      esc(d.o.install_power || "ยังไม่ระบุ") +
      "</dd><dt>พื้นที่ติดตั้ง</dt><dd>" +
      esc(d.o.install_space || "ยังไม่ระบุ") +
      "</dd><dt>ผลิตเสร็จโดยประมาณ</dt><dd>" +
      date(d.o.est_finish_date) +
      "</dd></dl>",
  );
}
