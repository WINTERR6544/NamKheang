import {
  $,
  heading,
  card,
  button,
  orderSummary,
  field,
  modal,
  toast,
} from "../components/customer_ui.js";
import {
  bindValidation,
  validators,
} from "../components/customer_validation.js";
import {
  getOrder,
  getRules,
  requestReschedule,
  getRescheduleRequests,
} from "../services/customer_order_service.js";
import { esc, date } from "../lib.js";
import { rescheduleGate } from "../customer_rules.js";
import { CustomerError } from "../customer_errors.js";

export async function render(context, el) {
  const detail = await getOrder(context.orderId, context.profile.customer_id);
  const [rules, requests] = await Promise.all([
    getRules(),
    getRescheduleRequests(detail.o.order_id, context.profile.customer_id),
  ]);
  const appointment = detail.appointments
    .filter((item) => item.status === "scheduled")
    .at(-1);
  const lastAcceptance = detail.acceptance.at(-1);
  const notice = rules.reschedule_notice_days ?? 1;
  const gate = rescheduleGate(detail.o, appointment, requests.rows, notice);
  const pending = gate.pending;
  const requestState = !requests.available
    ? '<div class="banner warning">บริการขอเลื่อนนัดยังไม่พร้อม กรุณาติดต่อร้าน</div>'
    : pending
      ? `<div class="banner warning" role="status"><strong>ส่งคำขอเลื่อนนัดแล้ว · รอร้านยืนยัน</strong><p>วันที่เสนอ: ${date(pending.preferred_datetime, true)}</p><p>เหตุผล: ${esc(pending.reason)}</p><small>วันนัดเดิมยังคงอยู่จนกว่าร้านประสานและยืนยันวันใหม่</small></div>`
      : appointment && detail.o.status === 8 && !gate.allowed
        ? `<div class="banner warning">${esc(gate.reason)}</div>`
        : "";
  el.innerHTML =
    heading(
      "นัดหมายติดตั้ง",
      "ตรวจสอบกำหนดการและเตรียมสถานที่ให้พร้อมก่อนทีมช่างเข้าติดตั้ง",
    ) +
    orderSummary(detail.o) +
    '<div class="grid cols-main">' +
    card(
      appointment
        ? "นัดหมายที่ยืนยันแล้ว"
        : lastAcceptance?.passed === false
          ? "รอประสานวันเข้าดำเนินการใหม่"
          : "รอกำหนดวันติดตั้ง",
      (appointment
        ? `<div class="appointment-date">${date(appointment.install_datetime, true)}</div>`
        : '<div class="banner warning">ยังไม่มีนัดหมายใหม่ที่ยืนยัน กรุณารอร้านประสานงาน</div>') +
        (lastAcceptance?.passed === false
          ? `<p>ปัญหาที่แจ้ง: ${esc(lastAcceptance.note)}</p>`
          : "") +
        `<div class="rule"></div><dl class="summary-dl"><dt>สถานที่ติดตั้ง</dt><dd>${esc(detail.o.install_address)}</dd><dt>ระบบไฟฟ้า</dt><dd>${esc(detail.o.install_power || "ยังไม่ระบุ")}</dd><dt>พื้นที่</dt><dd>${esc(detail.o.install_space || "ยังไม่ระบุ")}</dd></dl>` +
        requestState +
        (requests.available && gate.allowed
          ? '<div class="actions"><button class="btn ghost" id="reschedule">ขอเลื่อนนัด</button></div>'
          : "") +
        (appointment
          ? `<small>แจ้งล่วงหน้าอย่างน้อย ${esc(notice)} วัน วันนัดเดิมยังคงอยู่จนกว่าร้านยืนยันใหม่</small>`
          : ""),
    ) +
    card(
      "เตรียมพร้อมก่อนวันติดตั้ง",
      "<ul><li>จุดน้ำดีและท่อน้ำทิ้งตามแบบที่ตกลง</li><li>ระบบไฟฟ้า เบรกเกอร์ และสายดินที่เหมาะกับรุ่นเครื่อง</li><li>พื้นที่ติดตั้งและทางเข้าให้ทีมช่างเข้าถึงได้</li><li>ผู้ประสานงานอยู่รับทีมช่างและร่วมทดสอบ</li></ul>",
    ) +
    "</div>" +
    card(
      "ประวัตินัดหมาย",
      detail.appointments.length
        ? '<ul class="activity">' +
            detail.appointments
              .map(
                (item) =>
                  `<li>${date(item.install_datetime, true)} · ${esc({ scheduled: "ยืนยันนัด", rescheduled: "เลื่อนแล้ว", completed: "ติดตั้งแล้ว", cancelled: "ยกเลิก" }[item.status] || item.status)}${item.reschedule_reason ? `<small>${esc(item.reschedule_reason)}</small>` : ""}</li>`,
              )
              .join("") +
            "</ul>"
        : '<p class="muted">ยังไม่มีประวัตินัดหมาย</p>',
    ) +
    (requests.rows.length
      ? card(
          "ประวัติคำขอเลื่อนนัด",
          '<ul class="activity">' +
            requests.rows
              .map(
                (request) =>
                  `<li><strong>${request.status === "pending" ? "รอร้านยืนยัน" : "ร้านกำหนดนัดใหม่แล้ว"}</strong> · ${date(request.preferred_datetime, true)}<p>${esc(request.reason)}</p><small>ส่งคำขอ ${date(request.created_at, true)}</small></li>`,
              )
              .join("") +
            "</ul>",
        )
      : "");

  $("#reschedule", el)?.addEventListener("click", () =>
    modal(
      "ขอเลื่อนวันติดตั้ง",
      '<form id="reschedule-form" novalidate>' +
        field("preferred", "วันและเวลาที่สะดวก", {
          type: "datetime-local",
          required: true,
        }) +
        field("reason", "เหตุผลการเลื่อน", {
          type: "textarea",
          required: true,
        }) +
        "</form>",
      {
        saveLabel: "ส่งคำขอ",
        onOpen(dialog) {
          dialog.validation = bindValidation($("#reschedule-form", dialog), {
            preferred: (value) =>
              value && new Date(value + ":00+07:00") > new Date()
                ? ""
                : "กรุณาเลือกวันและเวลาในอนาคต",
            reason: validators.note,
          });
        },
        async onSave(dialog) {
          if (!dialog.validation.validate())
            throw new CustomerError("กรุณาตรวจสอบข้อมูลที่กรอก");
          const values = dialog.validation.values();
          await requestReschedule(
            detail.o.order_id,
            new Date(values.preferred + ":00+07:00").toISOString(),
            values.reason,
          );
          toast("ส่งคำขอเลื่อนนัดแล้ว วันนัดเดิมยังคงอยู่");
          await context.reload();
        },
      },
    ),
  );
}
