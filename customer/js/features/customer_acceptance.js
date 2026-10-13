import {
  $,
  heading,
  card,
  button,
  orderSummary,
  field,
  checkbox,
  confirm,
  busy,
  banner,
  toast,
} from "../components/customer_ui.js";
import {
  bindValidation,
  validators,
} from "../components/customer_validation.js";
import {
  getOrder,
  submitAcceptance,
} from "../services/customer_order_service.js";
import { orderDetails } from "../components/customer_order_components.js";
import { orderUrl } from "../lib.js";
import { errorMessage } from "../customer_errors.js";
export async function render(context, el) {
  const d = await getOrder(context.orderId, context.profile.customer_id);
  el.innerHTML =
    heading(
      "ตรวจรับเครื่องและการติดตั้ง",
      "ตรวจสอบการทำงานของเครื่องก่อนยืนยัน หรือแจ้งปัญหาให้ร้านดูแล",
    ) +
    orderSummary(d.o) +
    orderDetails(d);
  if (d.o.status !== 9) {
    el.innerHTML += card(
      "ยังไม่พร้อมตรวจรับ",
      "<p>ตรวจรับได้เมื่อโรงงานยืนยันว่าติดตั้งเสร็จแล้ว</p>",
    );
    return;
  }
  if (d.payments.some((p) => p.pay_type === "final")) {
    el.innerHTML += card(
      "ส่งหลักฐานชำระแล้ว",
      "<p>รอร้านตรวจสอบ ไม่สามารถเปลี่ยนผลตรวจรับระหว่างรอตรวจเงิน</p>",
    );
    return;
  }
  el.innerHTML +=
    '<div class="grid cols2" style="margin-top:18px"><form class="card" id="accept-form" novalidate><h2>ตรวจรับเครื่อง</h2>' +
    checkbox("installed", "ติดตั้งเครื่องและระบบครบถ้วนแล้ว") +
    checkbox("tested", "ทดสอบการผลิตน้ำแข็งและการทำงานแล้ว") +
    checkbox("trained", "ได้รับคู่มือและคำแนะนำการใช้งานแล้ว") +
    field("inspector", "ชื่อผู้ตรวจรับ", {
      required: true,
      value: context.profile.name,
      maxLength: 120,
    }) +
    checkbox("confirmed", "ยืนยันว่าตรวจสอบและรับมอบเครื่องครบถ้วนแล้ว") +
    '<div class="banner">ตรวจรับผ่านแล้วจึงเข้าสู่ขั้นชำระยอดคงเหลือ</div><div data-banner hidden role="alert"></div><button class="btn block" type="submit">ยืนยันตรวจรับผ่าน</button></form><form class="card" id="problem-form" novalidate><h2>แจ้งปัญหาจากการตรวจรับ</h2><p class="muted small">หากพบปัญหา ร้านจะประสานโรงงานและกำหนดวันเข้าดำเนินการใหม่</p>' +
    field("note", "เหตุผล / รายละเอียดปัญหา", {
      type: "textarea",
      required: true,
      rows: 5,
      placeholder: "ระบุส่วนที่มีปัญหาและอาการ",
    }) +
    '<div data-banner hidden role="alert"></div><button class="btn danger block" type="submit">แจ้งปัญหาและขอนัดใหม่</button></form></div>';
  const form = $("#accept-form"),
    check = bindValidation(form, {
      installed: (v) => (v ? "" : "กรุณายืนยันการติดตั้ง"),
      tested: (v) => (v ? "" : "กรุณาทดสอบการทำงานก่อน"),
      trained: (v) => (v ? "" : "กรุณายืนยันว่าได้รับคู่มือ"),
      inspector: validators.name,
      confirmed: (v) => (v ? "" : "กรุณายืนยันการตรวจรับ"),
    });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!check.validate()) return;
    if (
      !(await confirm(
        "ยืนยันตรวจรับผ่าน?",
        "ระบบจะบันทึกผลตรวจรับและเปิดขั้นชำระยอดคงเหลือ",
        {
          label: "ยืนยันตรวจรับ",
        },
      ))
    )
      return;
    await busy(form, async () => {
      try {
        await submitAcceptance(
          d.o.order_id,
          true,
          "ผู้ตรวจรับ: " + check.values().inspector,
        );
        location.href = orderUrl("final-payment", d.o.order_id);
      } catch (error) {
        banner(form, errorMessage(error));
      }
    });
  };
  const problem = $("#problem-form"),
    validation = bindValidation(problem, { note: validators.note });
  problem.onsubmit = async (e) => {
    e.preventDefault();
    if (!validation.validate()) return;
    if (
      !(await confirm(
        "ส่งปัญหาให้ร้าน?",
        "คำสั่งซื้อจะยังไม่ปิด และรอร้านประสานวันเข้าดำเนินการใหม่",
        {
          label: "แจ้งปัญหา",
        },
      ))
    )
      return;
    await busy(problem, async () => {
      try {
        await submitAcceptance(d.o.order_id, false, validation.values().note);
        toast("แจ้งปัญหาแล้ว รอร้านประสานนัดใหม่");
        location.href = orderUrl("appointment", d.o.order_id);
      } catch (error) {
        banner(problem, errorMessage(error));
      }
    });
  };
}
