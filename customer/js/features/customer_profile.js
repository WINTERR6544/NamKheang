import { routeParams, normalizePhone, esc, initials } from "../lib.js";
import {
  $,
  heading,
  modal,
  confirm,
  busy,
  banner,
  toast,
  icon,
  passwordField,
  bindReveal,
} from "../components/customer_ui.js";
import {
  profileCard,
  profileFields,
  profileHeader,
} from "../components/customer_profile_components.js";
import {
  bindValidation,
  validators,
} from "../components/customer_validation.js";

import {
  getProfile,
  saveProfile,
} from "../services/customer_profile_service.js";
import { changeEmail, changePassword } from "../services/customer_auth_service.js";
import { errorMessage, errorField } from "../customer_errors.js";
import { updateProfile, paintTopAvatar } from "../components/customer_layout.js";
import { client } from "../services/customer_supabase_client.js";
import { session } from "../services/customer_auth_service.js";

// profile picture (../shared/avatar.js): shown in the card's circle; change/remove on the profile page
async function paintCardAvatar(root, url) {
  if (!window.NKAvatar) return;
  if (url === undefined) url = window.NKAvatar.urlOf((await session().catch(() => null))?.user);
  window.NKAvatar.paint([$(".profile-identity .avatar", root)], url);
  return url;
}
async function mountPicture(el) {
  if (!window.NKAvatar) return;
  const url = await paintCardAvatar(el);
  const box = document.createElement("div");
  box.className = "av-actions";
  $(".profile-identity > div", el)?.append(box);
  window.NKAvatar.picker(box, client(), url, (next) => {
    paintCardAvatar(el, next);
    paintTopAvatar(next);
  }, (message, bad) => toast(message, bad ? "error" : "success"));
}
export async function openProfile(context) {
  context.profile = await getProfile();
  if (context.isCurrent && !context.isCurrent()) return;
  await modal("ข้อมูลส่วนตัวและการติดต่อ", profileCard(context.profile), {
    className: "profile-modal",
    headerHtml: profileHeader(),
    showFooter: false,
    onOpen(dialog) {
      paintCardAvatar(dialog);
      $("[data-edit]", dialog).onclick = () => {
        $(".close", dialog).click();
        location.assign("#/profile?edit=1");
      };
    },
  });
}
// Change password while signed in (Supabase auth updateUser); the email reset link stays on the sign-in page.
const passwordCard = () =>
  `<form id="password-form" class="card profile-card profile-password" novalidate>
    <h2>เปลี่ยนรหัสผ่าน</h2><p class="muted">อย่างน้อย 8 ตัวอักษร</p>
    <input type="text" name="username" autocomplete="username" hidden>` +
  passwordField("new_password", "รหัสผ่านใหม่") +
  passwordField("confirm_new_password", "ยืนยันรหัสผ่านใหม่") +
  `<div data-banner hidden role="alert"></div>
    <div class="profile-edit-actions"><button type="submit" class="btn">เปลี่ยนรหัสผ่าน</button></div></form>`;
function bindPassword(el, email) {
  const form = $("#password-form", el);
  form.elements.namedItem("username").value = email || "";
  const validation = bindValidation(form, {
    new_password: validators.password,
    confirm_new_password: (value, all) =>
      value && value === all.new_password ? "" : "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  });
  const hidePasswords = bindReveal(form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    hidePasswords();
    if (!validation.validate()) return;
    await busy(form, async () => {
      try {
        await changePassword(validation.values().new_password);
        form.reset();
        toast("เปลี่ยนรหัสผ่านแล้ว");
      } catch (error) {
        const m = String(error?.message || "");
        banner(
          form,
          /different from the old/i.test(m)
            ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม"
            : /reauth|recent/i.test(m)
              ? "เพื่อความปลอดภัย กรุณาออกจากระบบแล้วเข้าใหม่ก่อนเปลี่ยนรหัสผ่าน"
              : errorMessage(error),
        );
      }
    });
  };
}
// Same layout as the staff profile page (../shared/staff-profile.js): account card with the picture on the
// left, change-password card on the right. The account card switches between details and the edit form.
const longDateTH = (s) =>
  s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-";
const identity = (profile) =>
  `<div class="profile-identity"><span class="avatar">${esc(initials(profile.name))}</span><div><h2>${esc(profile.name)}</h2><p class="muted">${esc(profile.email)}</p><span class="badge"><i></i>บัญชีใช้งานอยู่</span></div></div><div class="rule"></div>`;
const spec = (label, value) => `<dt>${esc(label)}</dt><dd>${esc(value || "ยังไม่ระบุ")}</dd>`;
const accountCard = (profile) =>
  `<section class="card profile-card profile-account">${identity(profile)}
    <dl class="profile-spec">${spec("ชื่อ–นามสกุล", profile.name)}${spec("เบอร์โทรศัพท์", profile.phone)}${spec("อีเมล", profile.email)}${spec("บริษัท / องค์กร", profile.company)}${spec("ที่อยู่ติดต่อ", profile.contact_address)}<dt>เข้าร่วมเมื่อ</dt><dd>${longDateTH(profile.created_at)}</dd></dl>
    <div class="profile-edit-actions"><button type="button" class="btn ghost" data-edit>${icon("imgPencil", "236:13997")}แก้ไขข้อมูล</button></div>
  </section>`;
export async function render(context, el) {
  let profile = await getProfile();
  context.profile = profile;
  const page = (left) =>
    heading("โปรไฟล์ของฉัน", "ดูและแก้ไขข้อมูลบัญชีของคุณ") +
    `<div class="profile-page profile-grid">${left}${passwordCard()}</div>`;
  function show() {
    if (document.body.dataset.ready === "true")
      history.replaceState(null, "", "#/profile");
    el.innerHTML = page(accountCard(profile));
    $("[data-edit]", el).onclick = edit;
    bindPassword(el, profile.email);
    mountPicture(el);
  }
  function edit() {
    el.innerHTML = page(
      `<form id="profile-form" class="card profile-card profile-account profile-edit" novalidate>${identity(profile)}
        ${profileFields(profile)}
        <div data-banner hidden role="alert"></div><div class="rule"></div>
        <div class="profile-edit-actions"><button type="button" class="btn ghost" id="discard">ยกเลิก</button>
        <button type="submit" class="btn">${icon("imgCheck", "236:13712")}บันทึก</button></div></form>`,
    );
    bindPassword(el, profile.email);
    mountPicture(el);
    const form = $("#profile-form", el);
    const validation = bindValidation(form, {
      name: validators.name,
      phone: validators.phone,
      email: validators.email,
      contact_address: validators.address,
    });
    $("#discard", el).onclick = async () => {
      if (
        await confirm("ยกเลิกการแก้ไข?", "ข้อมูลที่ยังไม่บันทึกจะถูกทิ้ง", {
          label: "ยกเลิกการแก้ไข",
        })
      )
        show();
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!validation.validate()) return;
      const values = validation.values();
      values.phone = normalizePhone(values.phone);
      if (
        !(await confirm(
          "บันทึกข้อมูลลูกค้า?",
          "ข้อมูลติดต่อใหม่จะใช้สำหรับประสานงานคำสั่งซื้อ",
          { label: "บันทึก" },
        ))
      )
        return;
      await busy(form, async () => {
        let contactSaved = false,
          emailRequested = false;
        try {
          await saveProfile(values);
          contactSaved = true;
          if (
            values.email.trim().toLowerCase() !== profile.email.toLowerCase()
          ) {
            await changeEmail(values.email);
            emailRequested = true;
          }
          profile = await getProfile();
          context.profile = profile;
          updateProfile(profile);
          toast(
            emailRequested
              ? "บันทึกข้อมูลแล้ว กรุณายืนยันการเปลี่ยนอีเมลจากกล่องจดหมาย"
              : "บันทึกข้อมูลแล้ว",
          );
          show();
        } catch (error) {
          const partial = contactSaved
            ? "ข้อมูลติดต่อบันทึกแล้ว กรุณาตรวจสอบการเปลี่ยนอีเมลหรือโหลดข้อมูลล่าสุดก่อนลองใหม่ · "
            : "";
          banner(form, partial + errorMessage(error));
          const name = errorField(error);
          if (name && form.elements.namedItem(name))
            validation.error(name, errorMessage(error));
        }
      });
    };
  }
  show();
  if (routeParams().get("edit") === "1") {
    edit();
  }
}
