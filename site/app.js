// Shared helpers. Loaded after the Supabase UMD script, so `supabase` is a global.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key: safe in the browser, RLS protects the data
);

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const errText = (e) => (e && e.message) || "เกิดข้อผิดพลาด";

// Customer-facing wording for orders.status (codes come from the order_statuses table)
const STATUS_LABEL = {
  0: "ส่งคำสั่งซื้อแล้ว รอร้านเสนอราคา", 1: "ร้านเสนอราคาแล้ว รอยืนยัน", 2: "ชำระมัดจำแล้ว",
  3: "ส่งโรงงานผลิตแล้ว", 4: "กำลังผลิต", 5: "ผลิตเสร็จ รอตรวจคุณภาพ", 6: "แก้ไขตามผลตรวจคุณภาพ",
  7: "ผ่านการตรวจคุณภาพ", 8: "นัดวันติดตั้งแล้ว", 9: "ติดตั้งเสร็จ รอตรวจรับ", 10: "เสร็จสิ้น", 99: "ยกเลิก",
};
const MAIN_PATH = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10]; // rework (6) only shows if it happened
const MACHINE_TYPES = ["เครื่องทำน้ำแข็งหลอด", "เครื่องทำน้ำแข็งเกล็ด", "เครื่องทำน้ำแข็งก้อน"];
const CAPACITIES = ["500 กก./วัน", "1 ตัน/วัน", "2 ตัน/วัน", "5 ตัน/วัน"];

const baht = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท";
const dateTH = (s, time) =>
  s ? new Date(s).toLocaleString("th-TH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "-";
const pillClass = (s) => (s === 99 ? "pill cancel" : s === 10 ? "pill done" : "pill");

// Redirects to the login page when signed out. Returns the session otherwise.
async function requireSession() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    location.replace("login.html");
    return null;
  }
  mountHeader(true);
  return data.session;
}

function mountHeader(signedIn) {
  const here = location.pathname.split("/").pop();
  const h = document.createElement("header");
  h.className = "top";
  h.innerHTML = `<div class="in"><a class="logo" href="index.html"><span>❄</span> ICEFLOW</a><nav>${
    signedIn
      ? `<a href="orders.html">คำสั่งซื้อของฉัน</a><button id="logout">ออกจากระบบ</button>`
      : here === "login.html" ? `<a href="index.html">หน้าแรก</a>` : `<a href="login.html">เข้าสู่ระบบ</a>`
  }</nav></div>`;
  document.body.prepend(h);
  const out = $("#logout", h);
  if (out) out.onclick = async () => { await db.auth.signOut(); location.replace("login.html"); };
}

// Decorative barcode drawn from a string (same text -> same bars)
function barcode(text) {
  let x = 0, bars = "";
  [...("*" + text + "*")].flatMap((c) => {
    const n = c.charCodeAt(0);
    return [1 + (n % 3), 1 + ((n >> 2) % 3), 1 + ((n >> 4) % 2), 1 + ((n >> 5) % 3)];
  }).forEach((w, i) => { if (i % 2 === 0) bars += `<rect x="${x}" width="${w}" height="54"/>`; x += w; });
  return `<svg class="barcode" viewBox="0 0 ${x} 54" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${bars}</svg>`;
}
