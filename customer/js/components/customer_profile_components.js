import { card, field, icon } from "./customer_ui.js";
import { esc, initials } from "../lib.js";

function detail(label, value) {
  return `<div class="profile-detail"><dt>${esc(label)}</dt><dd>${esc(value || "ยังไม่ระบุ")}</dd></div>`;
}
export function profileCard(profile) {
  return card(
    "",
    `<div class="profile-details">
    <div class="profile-identity"><span class="avatar">${esc(initials(profile.name))}</span><div><h2>${esc(profile.name)}</h2><p class="muted">${esc(profile.company || "บัญชีลูกค้า")}</p><span class="badge"><i></i>${profile.is_active === false ? "บัญชีถูกระงับ" : "บัญชีใช้งานอยู่"}</span></div></div>
    <div class="rule"></div><dl class="profile-data">
      ${detail("ชื่อ–นามสกุล", profile.name)}
      <div class="profile-contact-grid">${detail("เบอร์โทรศัพท์", profile.phone)}${detail("อีเมล", profile.email)}</div>
      ${detail("บริษัท / องค์กร", profile.company)}${detail("ที่อยู่ติดต่อ", profile.contact_address)}
    </dl><button type="button" class="btn block" data-edit>${icon("imgPencil", "236:13997")}แก้ไข</button>
  </div>`,
    "profile-card",
  );
}
export function profileFields(profile) {
  return (
    field("name", "ชื่อ–นามสกุล", {
      value: profile.name,
      required: true,
      autocomplete: "name",
      maxLength: 120,
    }) +
    `<div class="profile-contact-grid">${field("phone", "เบอร์โทรศัพท์", { value: profile.phone, required: true, type: "tel", autocomplete: "tel", maxLength: 20 })}${field("email", "อีเมล", { value: profile.email, required: true, type: "email", autocomplete: "email", maxLength: 254 })}</div>` +
    field("company", "บริษัท / องค์กร", {
      value: profile.company || "",
      maxLength: 200,
    }) +
    field("contact_address", "ที่อยู่ติดต่อ", {
      value: profile.contact_address || "",
      type: "textarea",
      required: true,
      rows: 3,
    }) +
    `<p class="muted small">เปลี่ยนอีเมลแล้วต้องยืนยันผ่านลิงก์ในอีเมลก่อนเข้าสู่ระบบด้วยอีเมลใหม่</p>`
  );
}
export function profileHeader() {
  return `<span class="profile-header-icon">${icon("imgAccountMultipleOutline", "236:13997")}</span><div class="profile-header-copy"><h2 id="dialog-title">ข้อมูลส่วนตัวและการติดต่อ</h2><p>NAMKHEANG CUSTOMER · จัดการข้อมูลสำหรับติดต่อและประสานงาน</p></div>`;
}
