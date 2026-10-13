import {
  heading,
  card,
  button,
  icon,
  badge,
  empty,
} from "../components/customer_ui.js";
import { esc, date, orderUrl, money, balance } from "../lib.js";
import {
  listOrders,
  orderCounts,
  getOrder,
  getRules,
} from "../services/customer_order_service.js";
import { listNotifications } from "../services/customer_notification_service.js";
import { TYPE_LABELS } from "../customer_constants.js";
import { currentAcceptance, quoteExpired } from "../customer_rules.js";
import { CONFIG } from "../customer_config.js";
function milestones(d) {
  const status = d.o.status,
    index = status >= 8 ? 3 : status >= 5 ? 2 : status >= 4 ? 1 : 0;
  return (
    '<div class="dashboard-progress-head"><b>ความคืบหน้าคำสั่งซื้อ</b><small>' +
    esc(
      {
        0: "รับรายละเอียดแล้ว",
        1: "รอยืนยันใบเสนอราคา",
        2: "รอประสานโรงงาน",
        3: "รอโรงงานตอบรับ",
        4: "กำลังผลิต",
        5: "ตรวจคุณภาพ",
        6: "แก้ไขตามผล QC",
        7: "ผ่าน QC",
        8: "ยืนยันวันติดตั้ง",
        9: "รอตรวจรับ",
      }[status] || "",
    ) +
    '</small></div><ol class="dashboard-milestones">' +
    ["ยืนยันคำสั่งซื้อ", "กำลังผลิต", "ตรวจสอบ QC", "ติดตั้ง", "ปิดคำสั่งซื้อ"]
      .map(
        (label, i) =>
          '<li class="' +
          (i < index ? "done" : i === index ? "current" : "") +
          '"><span>' +
          (i < index ? "✓" : i === index ? "●" : "") +
          "</span><small>" +
          label +
          "</small></li>",
      )
      .join("") +
    "</ol>"
  );
}
function latestCard(d) {
  const last = d.logs.at(-1),
    p = d.payments;
  const depositPending = p.some((x) => x.pay_type === "deposit" && !x.verified),
    finalPending = p.some((x) => x.pay_type === "final" && !x.verified);
  const action =
    d.o.status === 1 && !depositPending
      ? {
          page:
            d.quote?.status === "accepted" && !quoteExpired(d.quote)
              ? "deposit"
              : "quotation",
          label:
            d.quote?.status === "accepted" ? "ชำระมัดจำ" : "ตรวจสอบใบเสนอราคา",
          text: "มัดจำตามใบเสนอราคา",
          amount: d.quote?.deposit_amount,
        }
      : d.o.status === 9 && !finalPending
        ? {
            page: Boolean(currentAcceptance(d.o, d.acceptance))
              ? "final-payment"
              : "acceptance",
            label: "ดำเนินการต่อ",
            text: "ยอดคงเหลือตามใบเสนอราคา",
            amount: balance(d.quote, p),
          }
        : null;
  return card(
    "",
    '<div class="row between"><div><small>คำสั่งซื้อล่าสุด</small> ' +
      badge(d.o.status) +
      "<h2>" +
      esc(d.o.machine_models?.name ?? d.o.machine_type) +
      "</h2><small>Order No. " +
      esc(d.o.order_code) +
      " · " +
      esc(d.o.install_address) +
      "</small></div>" +
      button(
        "↗ ดูรายละเอียดและติดตาม",
        orderUrl("order", d.o.order_id),
        "ghost sm",
      ) +
      '</div><div class="dashboard-facts">' +
      [
        ["ประเภทน้ำแข็ง", TYPE_LABELS[d.o.machine_type] ?? d.o.machine_type],
        ["กำลังผลิตรวม", d.o.capacity],
        ["อัปเดตล่าสุด", date(last?.changed_at, true)],
      ]
        .map(
          ([label, value]) =>
            "<div><small>" +
            label +
            "</small><strong>" +
            esc(value) +
            "</strong></div>",
        )
        .join("") +
      "</div>" +
      milestones(d) +
      (action
        ? '<div class="dashboard-payment-note"><div><b>' +
          action.text +
          " " +
          money(action.amount) +
          "</b><small>ร้านจะยืนยันสถานะหลังตรวจสอบหลักฐานการชำระแล้ว</small></div>" +
          button(
            action.label,
            orderUrl(action.page, d.o.order_id),
            "ghost sm",
          ) +
          "</div>"
        : depositPending || finalPending
          ? '<div class="banner warning">ส่งหลักฐานแล้ว รอร้านตรวจสอบการชำระเงิน</div>'
          : ""),
  );
}
function deadline(label, value, asset) {
  const parsed = value ? new Date(value) : null;
  return (
    '<div class="deadline ' +
    (asset === "imgCalendarClock" ? "tint" : "") +
    '"><div class="deadline-day"><strong>' +
    (parsed
      ? new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          timeZone: "Asia/Bangkok",
        }).format(parsed)
      : "—") +
    "</strong><small>" +
    (parsed
      ? new Intl.DateTimeFormat("th-TH", {
          month: "short",
          timeZone: "Asia/Bangkok",
        }).format(parsed)
      : "") +
    "</small></div><div><small>" +
    icon(asset) +
    " " +
    label +
    "</small><b>" +
    date(value, asset === "imgCalendarClock") +
    "</b></div></div>"
  );
}
export async function render(context, el) {
  const id = context.profile.customer_id;
  const [counts, latest, notifications, rules] = await Promise.all([
    orderCounts(id),
    listOrders(id, { size: 1, group: "active" }),
    listNotifications(id, 1, 5),
    getRules(),
  ]);
  const d = latest.rows[0] ? await getOrder(latest.rows[0].order_id, id) : null;
  const scheduled = d?.appointments
    .filter((a) => a.status === "scheduled")
    .at(-1);
  const accepted = d ? currentAcceptance(d.o, d.acceptance) : null;
  const due =
    d?.o.status === 1
      ? d.quote?.valid_until
      : d?.o.status === 9 && accepted?.passed
        ? new Date(
            new Date(accepted.checked_at).getTime() +
              (rules.final_payment_days ?? 7) * 86400000,
          ).toISOString()
        : null;
  const payment =
    d?.o.status === 1 && !d.payments.some((p) => p.pay_type === "deposit")
      ? {
          title: "ชำระมัดจำตามใบเสนอราคา",
          amount: d.quote?.deposit_amount,
          page:
            d.quote?.status === "accepted" && !quoteExpired(d.quote)
              ? "deposit"
              : "quotation",
        }
      : d?.o.status === 9 && !d.payments.some((p) => p.pay_type === "final")
        ? {
            title: "ตรวจรับและชำระยอดคงเหลือ",
            amount: balance(d.quote, d.payments),
            page: accepted?.passed ? "final-payment" : "acceptance",
          }
        : null;
  el.innerHTML =
    heading(
      "สวัสดี คุณ" + context.profile.name.split(" ")[0],
      "ติดตามสถานะคำสั่งซื้อและกำหนดการสำคัญของคุณได้ในที่เดียว",
      button("+ สร้างคำสั่งซื้อใหม่", "#/new-order"),
    ) +
    '<div class="kpis">' +
    [
      ["กำลังดำเนินการ", counts.active, "imgLoaderCircle", "#/orders"],
      ["ขั้นชำระเงิน", counts.payment, "imgWalletCards", "#/payments"],
      ["รอติดตั้ง", counts.installation, "imgCalendarClock", "#/orders"],
      ["เสร็จสิ้น", counts.done, "imgCircleCheck", "#/orders"],
    ]
      .map(
        ([label, count, asset, url]) =>
          '<a class="kpi" href="' +
          url +
          '"><span class="kpi-icon">' +
          icon(asset) +
          "</span><div><small>" +
          label +
          "</small><strong>" +
          count +
          '</strong><span class="caption">ดูรายการของคุณ</span></div></a>',
      )
      .join("") +
    '</div><div class="grid cols-main dashboard-main"><div class="stack">' +
    (d
      ? latestCard(d)
      : card(
          "",
          empty(
            "เริ่มต้นคำสั่งซื้อแรกของคุณ",
            "เลือกรุ่นเครื่องและส่งรายละเอียดให้ร้านเสนอราคา",
            button("สร้างคำสั่งซื้อ", "#/new-order"),
          ),
        )) +
    card(
      "อัปเดตล่าสุด",
      notifications.rows.length
        ? '<ul class="activity dashboard-activity">' +
            notifications.rows
              .map(
                (n) =>
                  '<li><span class="activity-dot"></span><div><a href="' +
                  (n.order_id
                    ? orderUrl("order", n.order_id)
                    : "#/notifications") +
                  '">' +
                  esc(n.message) +
                  "</a><small>" +
                  date(n.created_at, true) +
                  "</small></div></li>",
              )
              .join("") +
            '</ul><div class="actions">' +
            button("ดูทั้งหมด", "#/notifications", "ghost sm") +
            "</div>"
        : empty("ยังไม่มีการแจ้งเตือน"),
    ) +
    '</div><div class="stack">' +
    card(
      "กำหนดการสำคัญ",
      d
        ? deadline("คาดว่าผลิตเสร็จ", d.o.est_finish_date, "imgLoaderCircle") +
            deadline(
              "วันนัดติดตั้ง",
              scheduled?.install_datetime,
              "imgCalendarClock",
            ) +
            deadline("ครบกำหนดดำเนินการ", due, "imgWalletCards")
        : '<p class="muted">กำหนดการจะแสดงเมื่อร้านและโรงงานยืนยันข้อมูล</p>',
    ) +
    card(
      payment ? payment.title : "การชำระเงิน",
      payment
        ? '<p class="small">ตรวจสอบยอดและเอกสารก่อนชำระ</p><div class="row between"><strong class="payment-amount">' +
            money(payment.amount) +
            "</strong>" +
            button("ดำเนินการ", orderUrl(payment.page, d.o.order_id), "sm") +
            "</div>"
        : '<p class="small">ตรวจสอบประวัติ หลักฐาน และใบเสร็จของคุณ</p><div class="actions">' +
            button("ดูรายการชำระเงิน", "#/payments", "block") +
            "</div>",
      "dark",
    ) +
    card(
      "ต้องการความช่วยเหลือ?",
      '<p class="small muted">ติดต่อร้านผ่านข้อมูลที่ยืนยันแล้วในใบเสนอราคา</p>' +
        (CONFIG.supportPhone
          ? '<a class="support-phone" href="tel:' +
            esc(CONFIG.supportPhone) +
            '">' +
            esc(CONFIG.supportPhone) +
            "</a>"
          : "") +
        (CONFIG.supportEmail
          ? '<p><a href="mailto:' +
            esc(CONFIG.supportEmail) +
            '">' +
            esc(CONFIG.supportEmail) +
            "</a></p>"
          : "") +
        '<div class="actions">' +
        button("ข้อมูลติดต่อของฉัน", "#/profile", "ghost sm") +
        "</div>",
    ) +
    "</div></div>";
}
