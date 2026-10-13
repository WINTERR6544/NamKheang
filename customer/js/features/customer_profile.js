import { routeParams, normalizePhone } from "../lib.js";
import {
  $,
  heading,
  modal,
  confirm,
  busy,
  banner,
  toast,
  icon,
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
import { changeEmail } from "../services/customer_auth_service.js";
import { errorMessage, errorField } from "../customer_errors.js";
import { updateProfile } from "../components/customer_layout.js";

export async function openProfile(context) {
  context.profile = await getProfile();
  if (context.isCurrent && !context.isCurrent()) return;
  await modal("ข้อมูลส่วนตัวและการติดต่อ", profileCard(context.profile), {
    className: "profile-modal",
    headerHtml: profileHeader(),
    showFooter: false,
    onOpen(dialog) {
      $("[data-edit]", dialog).onclick = () => {
        $(".close", dialog).click();
        location.assign("#/profile?edit=1");
      };
    },
  });
}
export async function render(context, el) {
  let profile = await getProfile();
  context.profile = profile;
  function show() {
    if (document.body.dataset.ready === "true")
      history.replaceState(null, "", "#/profile");
    el.innerHTML =
      heading(
        "ข้อมูลส่วนตัวและการติดต่อ",
        "จัดการข้อมูลสำหรับติดต่อและประสานงาน",
      ) + `<div class="profile-page">${profileCard(profile)}</div>`;
    $("[data-edit]", el).onclick = edit;
  }
  function edit() {
    el.innerHTML =
      heading("แก้ไขข้อมูลลูกค้า", "บันทึกเฉพาะข้อมูลในบัญชีของคุณ") +
      `<div class="profile-page"><form id="profile-form" class="card profile-edit" novalidate>
        <h2>Edit · แก้ไขข้อมูล</h2>${profileFields(profile)}
        <div data-banner hidden role="alert"></div><div class="rule"></div>
        <div class="profile-edit-actions"><button type="button" class="btn ghost" id="discard">ยกเลิก</button>
        <button type="submit" class="btn">${icon("imgCheck", "236:13712")}บันทึก</button></div></form></div>`;
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
