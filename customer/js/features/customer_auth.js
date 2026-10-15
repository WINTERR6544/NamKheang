import { routeParams, esc } from "../lib.js";
import {
  $,
  field,
  checkbox,
  banner,
  busy,
  toast,
  confirm,
  icon,
} from "../components/customer_ui.js";
import {
  bindValidation,
  validators,
} from "../components/customer_validation.js";
import {
  signIn,
  signUp,
  sendReset,
  changePassword,
  session,
  signOut,
} from "../services/customer_auth_service.js";
import { errorMessage, errorField } from "../customer_errors.js";

// Decorative rows of the brand name for the sign-in panel; each row holds the text twice so
// the CSS loop (translateX -50%) is seamless.
const brandRows = () => {
  const half = "<span>NamKheang ✻</span>".repeat(6);
  return '<div class="auth-marquee" aria-hidden="true">' + ("<div>" + half + half + "</div>").repeat(9) + "</div>";
};
const passwordField = (name, label) =>
  field(name, label, {
    type: "password",
    required: true,
    autocomplete: name === "password" ? "current-password" : "new-password",
    maxLength: 128,
  })
    .replace("<input", '<div class="password-wrap"><input')
    .replace(
      "<p id=",
      '<button type="button" class="icon-btn reveal" aria-label="แสดงรหัสผ่าน">' +
        icon("imgEyeOff", "49:2594") +
        "</button></div><p id=",
    );
export async function renderAuth(page) {
  const register = page === "sign-up",
    reset = page === "reset-password";
  const auth = await session();
  // Recovery token is handled by Supabase before the password-update form is shown.
  const recovery =
    reset &&
    auth &&
    (/type=recovery/.test(location.hash) ||
      sessionStorage.getItem("iceflow.customer.recovery") === "yes");
  if (auth && !reset) {
    location.replace("#/dashboard");
    return;
  }
  const title = register
    ? "สร้างบัญชี"
    : reset
      ? recovery
        ? "ตั้งรหัสผ่านใหม่"
        : "ลืมรหัสผ่าน"
      : "ยินดีต้อนรับกลับ";
  document.body.className = "auth-body";
  document.title = title + " · NamKheang";
  $("#app").innerHTML =
    '<div class="auth-shell"><section class="auth-art"><a class="brand" href="#/index"><span class="brand-mark">' +
    icon("imgIceMachineSymbol", "49:2594") +
    '</span><span><b>NamKheang</b><small>ICE MACHINE CRM</small></span></a>' +
    brandRows() +
    '</section><main class="auth-area"><div class="auth-top"><a href="#/index">← กลับหน้าหลัก</a></div><form class="auth-card" id="auth-form" novalidate><h1>' +
    title +
    '</h1><p class="muted">' +
    (reset
      ? "ส่งลิงก์กู้คืนบัญชีไปยังอีเมลของคุณ"
      : "จัดการคำสั่งซื้อและติดตามการผลิตได้ในที่เดียว") +
    "</p>" +
    (register
      ? field("name", "ชื่อ–นามสกุล", {
          required: true,
          autocomplete: "name",
          maxLength: 120,
        }) +
        field("phone", "เบอร์โทรศัพท์", {
          type: "tel",
          required: true,
          autocomplete: "tel",
          maxLength: 20,
        })
      : "") +
    (!recovery
      ? field(
          register || reset ? "email" : "identifier",
          register || reset ? "อีเมล" : "อีเมลหรือเบอร์โทรศัพท์",
          {
            type: register || reset ? "email" : "text",
            required: true,
            autocomplete: "username",
            placeholder: "name@company.co.th",
            maxLength: 254,
          },
        )
      : "") +
    (!reset || recovery ? passwordField("password", "รหัสผ่าน") : "") +
    (register || recovery
      ? passwordField("confirm_password", "ยืนยันรหัสผ่าน")
      : "") +
    (!register && !reset
      ? '<div class="auth-options">' +
        checkbox(
          "remember",
          "จดจำการเข้าสู่ระบบ",
          localStorage.getItem("iceflow.customer.remember") !== "no",
        ) +
        '<a href="#/reset-password">ลืมรหัสผ่าน?</a></div>'
      : "") +
    '<div data-banner hidden role="alert"></div><button type="submit" class="btn block">' +
    (register
      ? "สมัครสมาชิก"
      : reset
        ? recovery
          ? "บันทึกรหัสผ่าน"
          : "ส่งลิงก์กู้คืนบัญชี"
        : "เข้าสู่ระบบ") +
    '</button><div class="rule"></div><p class="auth-switch">' +
    (register
      ? 'มีบัญชีแล้ว? <a href="#/login">เข้าสู่ระบบ</a>'
      : 'ยังไม่มีบัญชี? <a href="#/sign-up">สมัครสมาชิก</a>') +
    "</p></form></main></div>";
  const form = $("#auth-form"),
    rules = {};
  if (register) {
    rules.name = validators.name;
    rules.phone = validators.phone;
  }
  if (register || (reset && !recovery)) rules.email = validators.email;
  if (!register && !reset)
    rules.identifier = (v) =>
      String(v).includes("@") ? validators.email(v) : validators.phone(v);
  if (!reset || recovery)
    rules.password =
      register || recovery
        ? validators.password
        : (v) => validators.required(v, "รหัสผ่าน");
  if (register || recovery)
    rules.confirm_password = (v, values) =>
      v === values.password ? "" : "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  const validation = bindValidation(form, rules);
  form.querySelectorAll(".reveal").forEach(
    (b) =>
      (b.onclick = () => {
        const input = b.previousElementSibling;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        b.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
      }),
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!validation.validate()) return;
    banner(form, "");
    const v = validation.values();
    await busy(form, async () => {
      try {
        if (reset) {
          if (recovery) {
            await changePassword(v.password);
            sessionStorage.removeItem("iceflow.customer.recovery");
            await signOut();
            location.replace("#/login?reset=success");
          } else {
            await sendReset(v.email);
            banner(
              form,
              "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์กู้คืนให้ กรุณาตรวจสอบกล่องจดหมาย",
              "success",
            );
          }
        } else if (register) {
          if (
            !(await confirm(
              "ยืนยันสมัครสมาชิก",
              "ตรวจสอบชื่อ เบอร์โทรศัพท์ และอีเมลก่อนสร้างบัญชี",
              {
                label: "สร้างบัญชี",
              },
            ))
          )
            return;
          const data = await signUp(v);
          if (data.session) location.replace("#/dashboard");
          else
            banner(
              form,
              "ตรวจสอบอีเมลเพื่อยืนยันบัญชี หากอีเมลนี้มีบัญชีอยู่แล้ว ให้เข้าสู่ระบบหรือกู้คืนรหัสผ่าน",
              "success",
            );
        } else {
          localStorage.setItem(
            "iceflow.customer.remember",
            v.remember ? "yes" : "no",
          );
          await signIn(v.identifier, v.password);
          location.replace("#/dashboard");
        }
      } catch (error) {
        const text = errorMessage(error);
        banner(form, text);
        const name = errorField(error);
        if (name && form.elements.namedItem(name)) validation.error(name, text);
      }
    });
  };
  if (routeParams().get("reset") === "success")
    banner(form, "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ", "success");
}
const ARROW =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const MODEL_IMG = (code) => "img/models/" + code + ".webp";
// Landing page (public): what NamKheang does, the three ice types, the order steps.
// Figures match the live data: models T-500…C-500, deposit 40% / balance 60%,
// reschedule notice 1 day. Machine pictures are AI illustrations, labelled as such.
export function renderLanding() {
  document.body.className = "landing-body";
  const types = [
    ["if-t10", "น้ำแข็งหลอด", "T-500 · T-1000 · T-2000", "500 กก. ถึง 2 ตันต่อวัน สำหรับร้านน้ำแข็ง ร้านอาหาร และจุดขายส่ง"],
    ["if-f20", "น้ำแข็งเกล็ด", "F-1000 · F-2000", "1–2 ตันต่อวัน สำหรับแผงอาหารทะเลและงานแช่เย็นสินค้า"],
    ["if-c05", "น้ำแข็งซอง", "C-500", "500 กก. ต่อวัน ก้อนใหญ่ ละลายช้า สำหรับเรือประมงและการขนส่ง"],
  ];
  const steps = [
    ["ส่งคำสั่งซื้อ", "เลือกรุ่น จำนวน และที่อยู่ติดตั้ง"],
    ["ยืนยันราคา", 'ร้านส่งใบเสนอราคา ชำระมัดจำ <b class="pct">40%</b>'],
    ["ผลิตและ QC", "โรงงานผลิต แล้วตรวจทุกข้อก่อนส่ง"],
    ["นัดติดตั้ง", "เลือกวันติดตั้ง เลื่อนได้ล่วงหน้า 1 วัน"],
    ["ตรวจรับ", 'ทดสอบเครื่อง แล้วชำระส่วนที่เหลือ <b class="pct">60%</b>'],
  ];
  const users = [
    ["ร้านน้ำแข็งและร้านอาหาร", "น้ำแข็งหลอดใช้กับเครื่องดื่มและขายปลีก"],
    ["แผงอาหารทะเลและตลาด", "น้ำแข็งเกล็ดคลุมสินค้าได้ทั่วถึง ไม่ช้ำ"],
    ["เรือประมงและโรงงานแปรรูป", "น้ำแข็งซองเก็บความเย็นได้นานระหว่างขนส่ง"],
  ];
  $("#app").innerHTML =
    '<div class="lp">' +
    '<header class="lp-wrap lp-top"><a class="lp-logo" href="#/index" aria-label="NamKheang หน้าแรก">Nam<b>Kheang</b></a>' +
    '<nav class="lp-nav"><button type="button" data-scroll="lp-types">รุ่นเครื่อง</button><button type="button" data-scroll="lp-steps">ขั้นตอนการสั่ง</button>' +
    '<a href="#/orders">ติดตามคำสั่งซื้อ</a><a class="pill teal" href="../">เข้าสู่ระบบ ' + ARROW + "</a></nav></header>" +
    '<main><section class="lp-wrap lp-hero"><div class="lp-hero-copy"><p class="lp-eyebrow">ผลิต · ติดตั้ง · ดูแล</p>' +
    "<h1>เครื่องทำน้ำแข็ง<br><em>สั่งผลิตได้ในที่เดียว</em></h1>" +
    '<p class="lp-lead">เลือกรุ่น ขอใบเสนอราคา แล้วติดตามได้ทุกขั้น ตั้งแต่โรงงานเริ่มผลิต ตรวจ QC จนช่างติดตั้งถึงหน้าร้านคุณ</p>' +
    '<div class="lp-row"><button type="button" class="pill teal" data-scroll="lp-types">ดูรุ่นเครื่อง ' + ARROW + '</button><a class="pill line" href="#/sign-up">สมัครสมาชิก ' + ARROW + "</a></div></div>" +
    '<div class="lp-collage" aria-hidden="true"><div class="lp-pattern"></div>' +
    '<img class="lp-ph one" src="' + MODEL_IMG("if-t20") + '" alt="" width="512" height="512">' +
    '<img class="lp-ph two" src="' + MODEL_IMG("if-f10") + '" alt="" width="512" height="512">' +
    '<img class="lp-ph three" src="' + MODEL_IMG("if-c05") + '" alt="" width="512" height="512">' +
    '<p class="lp-tag">ผลิต 500 กก. – 2 ตัน <b>ต่อวัน</b></p></div></section>' +
    '<section class="lp-band"><div class="lp-wrap"><h2>บอกขนาดที่ต้องใช้ แล้วให้เราดูแลที่เหลือ</h2>' +
    "<p>ร้านรับคำสั่งซื้อ ส่งให้โรงงานผลิต ตรวจคุณภาพก่อนส่ง และนัดวันติดตั้งให้ คุณเห็นสถานะทุกครั้งที่งานขยับ</p>" +
    '<div class="lp-row center"><button type="button" class="pill coral" data-scroll="lp-types">รุ่นเครื่อง ' + ARROW +
    '</button><button type="button" class="pill teal" data-scroll="lp-steps">ขั้นตอน ' + ARROW +
    '</button><a class="pill pink" href="#/sign-up">สมัครสมาชิก ' + ARROW + "</a></div></div></section>" +
    '<section class="lp-wrap lp-sec" id="lp-types"><h2>เลือกชนิดน้ำแข็ง</h2><div class="lp-types">' +
    types
      .map(
        ([img, name, models, text]) =>
          '<article class="lp-type"><figure><img src="' + MODEL_IMG(img) + '" alt="เครื่อง' + name + '" loading="lazy" width="512" height="512"><figcaption>ภาพประกอบ</figcaption></figure>' +
          "<h3>" + name + '</h3><p class="lp-models">' + models + "</p><p>" + text + '</p><a class="pill line" href="#/catalog">ดูรุ่นและราคา ' + ARROW + "</a></article>",
      )
      .join("") +
    "</div></section>" +
    '<section class="lp-wrap lp-sec flush" id="lp-steps"><h2>สั่งอย่างไร</h2><ol class="lp-steps">' +
    steps.map(([t, d]) => "<li><h3>" + t + "</h3><p>" + d + "</p></li>").join("") +
    "</ol></section>" +
    '<section class="lp-wrap lp-sec flush"><h2>ใครใช้ NamKheang</h2><ul class="lp-users">' +
    users.map(([t, d]) => "<li><h3>" + t + "</h3><p>" + d + "</p></li>").join("") +
    '</ul><div class="lp-cta"><p>พร้อมสั่งเครื่องแล้ว?</p><a class="pill teal" href="#/sign-up">สมัครสมาชิก ' + ARROW +
    '</a><a class="pill line" href="../">มีบัญชีแล้ว เข้าสู่ระบบ ' + ARROW + "</a></div></section></main>" +
    '<footer class="lp-wrap lp-foot"><span>NamKheang · ระบบสั่งผลิตเครื่องทำน้ำแข็ง</span><span>รูปเครื่องเป็นภาพประกอบ ราคายืนยันตามใบเสนอราคาจากร้าน</span></footer></div>';
  document.querySelectorAll("[data-scroll]").forEach((b) =>
    b.addEventListener("click", () =>
      document.getElementById(b.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    ),
  );
}
