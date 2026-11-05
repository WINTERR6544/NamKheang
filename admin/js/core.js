// Admin core: helpers, modal, router, sidebar, login gate.
// db, $, $$, esc, toast, rpc, route, main, hashParams and loadFeature come from ../shared/staff-lib.js.
const errText = (e) => nkErrorTH(e); // plain Thai, from ../shared/errors-th.js
const baht = (n) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTH = (s, time) => (s ? new Date(s).toLocaleString("th-TH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "-");
const daysAgo = (s) => (Date.now() - new Date(s).getTime()) / 86400000;

// Staff wording for orders.status
const STATUS = {
  0: "ใหม่ · รอออกใบเสนอราคา", 1: "ส่งใบเสนอราคาแล้ว", 2: "ชำระมัดจำแล้ว · รอส่งโรงงาน", 3: "ส่งโรงงานแล้ว", 4: "กำลังผลิต",
  5: "ผลิตเสร็จ · รอตรวจ QC", 6: "ไม่ผ่าน QC · กำลังแก้ไข", 7: "ผ่าน QC · รอนัดติดตั้ง", 8: "นัดติดตั้งแล้ว", 9: "ติดตั้งแล้ว · รอตรวจรับ",
  10: "เสร็จสมบูรณ์", 99: "ยกเลิกแล้ว",
};
const pill = (s) => `<span class="pill ${s === 10 ? "ok" : s === 99 ? "bad" : [0, 2, 5, 7, 9].includes(s) ? "warn" : ""}">${esc(STATUS[s] ?? s)}</span>`;

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

async function slipUrl(path) {
  const { data, error } = await db.storage.from("payment-slips").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
async function showSlip(path) {
  if (!path) return toast("ไม่มีไฟล์สลิป (ชำระเงินสด)", true);
  try { const u = await slipUrl(path); modal("สลิปการโอน", `<a href="${u}" target="_blank" rel="noopener"><img class="slip" src="${u}" alt="สลิปการโอนเงิน"></a>`); }
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
function crumbsFor(path) {
  let grp = "", item = null;
  for (const n of NAV) { if (n.group) grp = n.group; else if (n.href === "#" + path) { item = n; if (!n.sub) grp = ""; break; } }
  const parts = [];
  if (/^\/order\/\d+$/.test(path)) parts.push("คำสั่งซื้อ", "รายละเอียดคำสั่งซื้อ");
  else if (item) { if (grp) parts.push(grp); parts.push(item.label); }
  return `<span>NamKheang / ร้าน</span>${icon("chevronRight", 14)}<b>${parts.map(esc).join(" / ")}</b>`;
}

// ---- features: one file per page, loaded when its route is first opened ----
// A feature file calls route(...) when it loads. If a file is missing (branch not merged yet) the page says so.
const FEATURES = [
  [/^\/dashboard$/, "dashboard"], [/^\/notifications$/, "notifications"],
  [/^\/orders$/, "orders-all"], [/^\/orders\/new$/, "orders-new"], [/^\/orders\/quotations$/, "orders-quotations"], [/^\/orders\/cancelled$/, "orders-cancelled"],
  [/^\/order\/\d+$/, "order-detail"],
  [/^\/mfg\/requests$/, "mfg-requests"], [/^\/mfg\/status$/, "mfg-status"],
  [/^\/installation$/, "installation"], [/^\/(accounts|customers|users|factories)$/, "accounts"], [/^\/settings\/payment$/, "payment-details"], [/^\/reports$/, "reports"],
  [/^\/payments\/deposit$/, "payments-deposit"], [/^\/payments\/final$/, "payments-final"], [/^\/payments\/refund$/, "payments-refund"],
];
async function navigate() {
  const path = (location.hash || "#/dashboard").slice(1).split("?")[0];
  $("#crumbs").innerHTML = crumbsFor(path);
  $$("aside a.nav").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + path));
  const feature = FEATURES.find(([re]) => re.test(path));
  if (feature) {
    try { await loadFeature(feature[1]); }
    catch { main().innerHTML = `<div class="card empty">ยังไม่มีหน้านี้ในเวอร์ชันนี้<div class="small">ไม่พบไฟล์: js/features/${feature[1]}.js</div></div>`; return; }
  }
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      main().innerHTML = `<p class="muted">กำลังโหลด…</p>`;
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
  { label: "แดชบอร์ด", href: "#/dashboard", icon: "grid" },
  { label: "การแจ้งเตือน", href: "#/notifications", key: "note", icon: "bell" },
  G("คำสั่งซื้อ"),
  { label: "คำสั่งซื้อทั้งหมด", href: "#/orders", sub: 1, icon: "list" }, { label: "คำสั่งซื้อใหม่", href: "#/orders/new", sub: 1, key: "new", icon: "inbox" },
  { label: "ใบเสนอราคา", href: "#/orders/quotations", sub: 1, icon: "fileText" }, { label: "ยกเลิกแล้ว", href: "#/orders/cancelled", sub: 1, icon: "ban" },
  G("การผลิต"),
  { label: "คำขอผลิตถึงโรงงาน", href: "#/mfg/requests", sub: 1, icon: "clipboard" }, { label: "สถานะการผลิต", href: "#/mfg/status", sub: 1, icon: "activity" },
  { label: "การติดตั้ง", href: "#/installation", sub: 1, icon: "wrench" },
  G("การชำระเงิน"),
  { label: "มัดจำ", href: "#/payments/deposit", sub: 1, key: "dep", icon: "wallet" }, { label: "ยอดคงเหลือ", href: "#/payments/final", sub: 1, key: "fin", icon: "receipt" },
  { label: "คืนเงิน", href: "#/payments/refund", sub: 1, key: "ref", icon: "undo" },
  G("รายงาน"),
  { label: "รายงานสรุป", href: "#/reports", sub: 1, icon: "barChart" },
  G("ผู้ดูแลระบบ"),
  { label: "บัญชีและสิทธิ์", href: "#/accounts", sub: 1, icon: "shield" },
  { label: "บัญชีรับเงิน", href: "#/settings/payment", sub: 1, icon: "wallet" },
  G("บัญชีของฉัน"),
  { label: "โปรไฟล์", href: "#/profile", sub: 1, icon: "user" },
];
const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("");
// same frame as the factory site: icon menu, the signed-in person at the bottom, sign-out in the top bar
function sidebar(user) {
  return `<a class="nk-logo" href="#/dashboard">Nam<b>Kheang</b></a><span class="nk-tag">ร้าน · ผู้ดูแลระบบ</span>` +
    NAV.map((n) =>
      n.group ? `<div class="group">${n.group}</div>` :
      `<a class="nav" href="${n.href}">${icon(n.icon)}<span>${n.label}</span>${n.key ? `<span class="count" id="c-${n.key}" hidden></span>` : ""}</a>`).join("") +
    `<div class="grow"></div>
    <div class="who"><a class="who-link" href="#/profile" title="โปรไฟล์ของฉัน"><span class="avatar">${esc(initials(user.name))}</span><div><b>${esc(user.name)}</b><div class="small">ผู้ดูแลระบบ</div></div></a><button class="menu-btn" type="button" title="ออกจากระบบ" aria-label="ออกจากระบบ"></button></div>`;
}
async function refreshCounts() {
  const [n, p, u] = await Promise.all([
    db.from("orders").select("order_id", { count: "exact", head: true }).eq("status", 0),
    db.from("payments").select("pay_type").eq("verified", false),
    db.from("notifications").select("notification_id", { count: "exact", head: true }).eq("recipient_type", "shop").is("read_at", null),
  ]);
  const c = { new: n.count ?? 0, dep: 0, fin: 0, ref: 0, note: u.count ?? 0 };
  (p.data ?? []).forEach((x) => { c[{ deposit: "dep", final: "fin", refund: "ref" }[x.pay_type]]++; });
  for (const [k, v] of Object.entries(c)) { const el = $("#c-" + k); if (el) { el.textContent = v; el.hidden = !v; } }
  // the bell shows unread shop notifications and opens the notifications page
  $("#bellc").textContent = c.note; $("#bellc").hidden = !c.note;
}

// ---- login gate ----
async function boot() {
  const { data } = await db.auth.getSession();
  if (!data.session) return location.replace("../"); // universal sign-in
  const { data: u } = await db.from("users").select("user_id, name, role, is_active").eq("auth_id", data.session.user.id).maybeSingle();
  if (!u || !u.is_active || u.role !== "admin") return location.replace("../"); // the portal opens the site that matches this account
  window.ME = u;
  $("#app").hidden = false;
  $("#side").innerHTML = sidebar(u);
  $("#bell").innerHTML = icon("bell") + $("#bell").innerHTML;
  $("#mename").textContent = u.name; $("#av").textContent = initials(u.name);
  NKAvatar.paint([$("#av"), $(".who .avatar")], NKAvatar.urlOf(data.session.user)); // profile picture, if set
  // sign-out sits in the top bar and, while the sidebar is open (top bar group hidden), next to the name
  $$("#logout, .who .menu-btn").forEach((b) => {
    b.innerHTML = icon("logout", 16);
    b.onclick = async () => { await db.auth.signOut(); location.replace("../"); };
  });
  await navigate();
  refreshCounts();
}

// generic table: cols = [{h, f(row)->html, cls}], rows, onClick(row)->href
function table(cols, rows, href) {
  if (!rows.length) return `<div class="empty">ไม่มีรายการ</div>`;
  return `<div class="tw"><table class="t"><thead><tr>${cols.map((c) => `<th>${c.h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) =>
    `<tr ${href ? `class="click" data-href="${href(r)}"` : ""}>${cols.map((c) => `<td>${c.f(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
// Clicking an order (row, card or link) opens the order popup when that feature is installed.
// Ctrl/Cmd/Shift-click, or a link marked data-full, still opens the full order page.
document.addEventListener("click", async (e) => {
  if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const t = e.target.closest('a[href^="#/order/"], tr[data-href^="#/order/"]');
  const m = t && (t.getAttribute("href") || t.dataset.href).match(/^#\/order\/(\d+)$/);
  if (m && t.dataset.full === undefined && !e.target.closest("button, input, select, #op")) {
    e.preventDefault();
    try { await loadFeature("popup"); openOrderPopup(Number(m[1])); } catch { location.hash = "#/order/" + m[1]; }
    return;
  }
  if (e.target.closest("button, a, input, select")) return;
  const tr = e.target.closest("tr[data-href]");
  if (tr) location.hash = tr.dataset.href;
});
