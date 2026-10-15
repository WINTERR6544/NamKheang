import { $, confirm, toast } from "./customer_ui.js";
import { esc, initials } from "../lib.js";
import { errorMessage } from "../customer_errors.js";
import { signOut } from "../services/customer_auth_service.js";
import { unreadCount } from "../services/customer_notification_service.js";
// NamKheang app shell: the landing page's top bar (wordmark, menu, pill button) over a centred page.
const nav = [
  ["dashboard", "หน้าหลัก"],
  ["orders", "คำสั่งซื้อของฉัน"],
  ["payments", "การชำระเงิน"],
  ["notifications", "แจ้งเตือน"],
];
// Line icons (Lucide, ISC licence) drawn inline so they take the text colour.
const svg = (d) =>
  '<svg class="ln" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  d +
  "</svg>";
const LOGOUT = svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
const MENU = svg('<path d="M4 6h16M4 12h16M4 18h16"/>');
export function layout(profile, page) {
  const active = [
    "quotation",
    "deposit",
    "final-payment",
    "refund",
    "receipt",
    "payments",
  ].includes(page)
    ? "payments"
    : ["order", "appointment", "acceptance", "cancel-order", "orders"].includes(page)
      ? "orders"
      : ["new-order", "catalog"].includes(page)
        ? "new-order"
        : page;
  document.body.className = "app-page";
  $("#app").innerHTML =
    '<a class="skip-link" href="#view">ข้ามไปเนื้อหา</a>' +
    '<header class="app-top"><div class="app-wrap app-bar">' +
    '<a class="app-logo" href="#/dashboard" aria-label="NamKheang หน้าหลัก">Nam<b>Kheang</b></a>' +
    '<nav class="app-nav" id="app-nav" aria-label="เมนูหลัก">' +
    nav
      .map(
        ([key, label]) =>
          '<a href="#/' +
          key +
          '"' +
          (active === key ? ' class="on" aria-current="page"' : "") +
          ">" +
          label +
          (key === "notifications" ? '<span id="unread" class="app-count" hidden></span>' : "") +
          "</a>",
      )
      .join("") +
    '<button id="logout-m" class="app-nav-out" type="button">ออกจากระบบ</button></nav>' +
    '<div class="app-tools"><a class="pill coral app-new' +
    (active === "new-order" ? " on" : "") +
    '" href="#/new-order">สั่งซื้อใหม่ <span aria-hidden="true">→</span></a>' +
    '<button class="app-me" id="profile-button" type="button" aria-label="ข้อมูลส่วนตัว"><span class="avatar">' +
    esc(initials(profile.name)) +
    '</span><span class="account-copy"><b>' +
    esc(profile.name.split(" ")[0]) +
    "</b><small>" +
    esc(profile.company || "บัญชีลูกค้า") +
    '</small></span></button><button id="logout" class="app-icon app-out" type="button" aria-label="ออกจากระบบ" title="ออกจากระบบ">' +
    LOGOUT +
    '</button><button class="app-icon app-menu" id="menu" type="button" aria-label="เปิดเมนู" aria-expanded="false" aria-controls="app-nav">' +
    MENU +
    "</button></div></div></header>" +
    '<main id="view" class="app-wrap" tabindex="-1"></main>' +
    '<footer class="app-foot"><div class="app-wrap"><span class="app-logo small">Nam<b>Kheang</b></span><span>© 2026 NamKheang · ระบบสั่งผลิตเครื่องทำน้ำแข็ง</span></div></footer>';
  const menu = $("#menu");
  menu.onclick = () => {
    const open = $("#app-nav").classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  };
  $("#profile-button").onclick = () =>
    window.dispatchEvent(new CustomEvent("customer:profile"));
  const logout = async () => {
    if (
      await confirm(
        "ออกจากระบบ?",
        "คุณสามารถเข้าสู่ระบบใหม่เพื่อติดตามคำสั่งซื้อได้",
        { label: "ออกจากระบบ" },
      )
    ) {
      try {
        await signOut();
        location.replace("#/login");
      } catch (error) {
        toast(errorMessage(error), "error");
      }
    }
  };
  $("#logout").onclick = logout;
  $("#logout-m").onclick = logout;
  refreshUnread(profile);
}
export async function refreshUnread(profile) {
  try {
    const count = await unreadCount(profile.customer_id);
    const el = $("#unread");
    if (el) {
      el.hidden = !count;
      el.textContent = count > 99 ? "99+" : count;
    }
  } catch {
    /* Notification failure must not prevent navigation. */
  }
}

export function updateProfile(profile) {
  const firstName = profile.name.split(" ")[0];
  const top = $("#profile-button");
  if (top) {
    $(".avatar", top).textContent = initials(profile.name);
    $(".account-copy b", top).textContent = firstName;
    $(".account-copy small", top).textContent =
      profile.company || "บัญชีลูกค้า";
  }
}
