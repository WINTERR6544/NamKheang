// Shared admin core: Supabase client, helpers, modal/toast, router, sidebar, login gate.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key; RLS + staff_* functions protect the data
);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const errText = (e) => (e && e.message) || "เกิดข้อผิดพลาด";
const baht = (n) => Number(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTH = (s, time) => (s ? new Date(s).toLocaleString("th-TH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "-");
const daysAgo = (s) => (Date.now() - new Date(s).getTime()) / 86400000;

// Staff wording for orders.status
const STATUS = {
  0: "ใหม่ รอเสนอราคา", 1: "เสนอราคาแล้ว", 2: "มัดจำแล้ว รอส่งโรงงาน", 3: "ส่งโรงงานแล้ว", 4: "กำลังผลิต",
  5: "ผลิตเสร็จ รอ QC", 6: "QC ไม่ผ่าน รอแก้ไข", 7: "ผ่าน QC รอนัดติดตั้ง", 8: "นัดติดตั้งแล้ว", 9: "ติดตั้งแล้ว รอตรวจรับ",
  10: "เสร็จสิ้น", 99: "ยกเลิก",
};
const pill = (s) => `<span class="pill ${s === 10 ? "ok" : s === 99 ? "bad" : [0, 2, 5, 7, 9].includes(s) ? "warn" : ""}">${esc(STATUS[s] ?? s)}</span>`;

function toast(msg, bad) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3000);
}

// modal(title, bodyHtml, { ok, onOk(root) }) -> resolves true when onOk succeeded
function modal(title, body, { ok = "บันทึก", onOk, onOpen } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "ov";
    ov.innerHTML = `<div class="card" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><div class="m">${body}</div>
      <div class="err" hidden style="margin-top:12px"></div>
      <div class="row end" style="margin-top:14px"><button class="btn ghost c">ปิด</button>${onOk ? `<button class="btn o">${esc(ok)}</button>` : ""}</div></div>`;
    document.body.append(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    $(".c", ov).onclick = () => close(false);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(false); });
    if (onOpen) onOpen($(".m", ov));
    if (onOk) $(".o", ov).onclick = async () => {
      const b = $(".o", ov), er = $(".err", ov);
      b.disabled = true; er.hidden = true;
      try { await onOk($(".m", ov)); close(true); }
      catch (e) { er.textContent = errText(e); er.hidden = false; b.disabled = false; }
    };
  });
}

// run an RPC, toast the result, throw on error
async function rpc(name, args, okMsg) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  if (okMsg) toast(okMsg);
  return data;
}

async function slipUrl(path) {
  const { data, error } = await db.storage.from("payment-slips").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
async function showSlip(path) {
  if (!path) return toast("ไม่มีไฟล์สลิป (ชำระเงินสด)", true);
  try { const u = await slipUrl(path); modal("สลิป", `<a href="${u}" target="_blank" rel="noopener"><img class="slip" src="${u}" alt="สลิป"></a>`); }
  catch (e) { toast(errText(e), true); }
}
async function uploadSlip(file, prefix) {
  const { data: u } = await db.auth.getUser();
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
  const path = `${u.user.id}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("payment-slips").upload(path, file);
  if (error) throw error;
  return path;
}

// ---- router ----
const routes = [];
const route = (re, fn) => routes.push({ re, fn });
const main = () => $("#view");
const hashParams = () => new URLSearchParams((location.hash.split("?")[1]) || "");
function crumbsFor(path) {
  let grp = "", item = null;
  for (const n of NAV) { if (n.group) grp = n.group; else if (n.href === "#" + path) { item = n; if (!n.sub) grp = ""; break; } }
  const parts = ["Shop / Admin"];
  if (/^\/order\/\d+$/.test(path)) parts.push("Orders", "Order detail");
  else if (item) { if (grp) parts.push(grp); parts.push(item.label); }
  return parts.map((p, i) => (i === parts.length - 1 ? `<b>${p}</b>` : p)).join(" / ");
}
async function navigate() {
  const path = (location.hash || "#/dashboard").slice(1).split("?")[0];
  $("#crumbs").innerHTML = crumbsFor(path);
  $$("aside a.nav").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + path));
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      main().innerHTML = `<p class="muted">กำลังโหลด...</p>`;
      try { await r.fn(main(), m.slice(1)); } catch (e) { main().innerHTML = `<div class="err">${esc(errText(e))}</div>`; }
      window.scrollTo(0, 0);
      return;
    }
  }
  main().innerHTML = `<div class="card empty">ไม่พบหน้านี้</div>`;
}
window.addEventListener("hashchange", navigate);

// ---- sidebar ----
const G = (label) => ({ group: label });
const NAV = [
  { label: "Dashboard", href: "#/dashboard" },
  G("Orders"),
  { label: "All Orders", href: "#/orders", sub: 1 }, { label: "New Orders", href: "#/orders/new", sub: 1, key: "new" },
  { label: "Quotations", href: "#/orders/quotations", sub: 1 }, { label: "Cancelled", href: "#/orders/cancelled", sub: 1 },
  G("Manufacturing"),
  { label: "Factory Requests", href: "#/mfg/requests", sub: 1 }, { label: "Production", href: "#/mfg/production", sub: 1 }, { label: "QC", href: "#/mfg/qc", sub: 1 },
  { label: "Installation", href: "#/installation" },
  G("Payments"),
  { label: "Deposit", href: "#/payments/deposit", sub: 1, key: "dep" }, { label: "Final Payment", href: "#/payments/final", sub: 1, key: "fin" },
  { label: "Refund", href: "#/payments/refund", sub: 1, key: "ref" },
  G("Admin"),
  { label: "Customers", soon: 1 }, { label: "Factories", soon: 1 }, { label: "Notifications", soon: 1 },
  { label: "Reports / History", soon: 1 }, { label: "Users & Roles", soon: 1, sub: 1 },
];
function sidebar(user) {
  return `<div class="brand">ICEFLOW</div><div class="sub-brand">SHOP &amp; ADMIN CRM</div>` +
    NAV.map((n) =>
      n.group ? `<div class="group">${n.group}</div>` :
      n.soon ? `<a class="nav soon ${n.sub ? "sub" : ""}" aria-disabled="true">${n.label}<span class="small">soon</span></a>` :
      `<a class="nav ${n.sub ? "sub" : ""}" href="${n.href}">${n.label}${n.key ? `<span class="count" id="c-${n.key}" hidden></span>` : ""}</a>`).join("") +
    `<div class="who">${esc(user.name)} · ${esc(user.role)}<br><button class="btn sm ghost" id="logout" style="margin-top:8px">ออกจากระบบ</button></div>`;
}
async function refreshCounts() {
  const [n, p] = await Promise.all([
    db.from("orders").select("order_id", { count: "exact", head: true }).eq("status", 0),
    db.from("payments").select("pay_type").eq("verified", false),
  ]);
  const c = { new: n.count ?? 0, dep: 0, fin: 0, ref: 0 };
  (p.data ?? []).forEach((x) => { c[{ deposit: "dep", final: "fin", refund: "ref" }[x.pay_type]]++; });
  for (const [k, v] of Object.entries(c)) { const el = $("#c-" + k); if (el) { el.textContent = v; el.hidden = !v; } }
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  $("#bellc").textContent = total; $("#bellc").hidden = !total;
}

// ---- login gate ----
async function boot() {
  const { data } = await db.auth.getSession();
  if (!data.session) return showLogin();
  const { data: u } = await db.from("users").select("user_id, name, role, is_active").eq("auth_id", data.session.user.id).maybeSingle();
  if (!u || !u.is_active || !["admin", "shop"].includes(u.role)) return showLogin("บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งานฝั่งร้าน");
  window.ME = u;
  $("#gate").hidden = true; $("#app").hidden = false;
  $("#side").innerHTML = sidebar(u);
  $("#mename").textContent = u.name + " · " + u.role; $("#av").textContent = (u.name || "?").trim().charAt(0).toUpperCase();
  $("#bell").onclick = () => { location.hash = "#/dashboard"; };
  $("#upd").textContent = "อัปเดตล่าสุด " + dateTH(new Date(), true);
  $("#logout").onclick = async () => { await db.auth.signOut(); location.hash = ""; location.reload(); };
  await navigate();
  refreshCounts();
}
function showLogin(msg) {
  $("#gate").hidden = false; $("#app").hidden = true;
  const err = $("#gerr");
  err.textContent = msg || ""; err.hidden = !msg;
  $("#gform").onsubmit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    const { error } = await db.auth.signInWithPassword({ email: $("#gemail").value, password: $("#gpass").value });
    if (error) { err.textContent = /invalid login/i.test(error.message) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : errText(error); err.hidden = false; return; }
    boot();
  };
  if (msg) db.auth.signOut();
}

// generic table: cols = [{h, f(row)->html, cls}], rows, onClick(row)->href
function table(cols, rows, href) {
  if (!rows.length) return `<div class="empty">ไม่มีรายการ</div>`;
  return `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th>${c.h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) =>
    `<tr ${href ? `class="click" data-href="${href(r)}"` : ""}>${cols.map((c) => `<td>${c.f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("button, a, input, select")) return;
  const tr = e.target.closest("tr[data-href]");
  if (tr) location.hash = tr.dataset.href;
});
