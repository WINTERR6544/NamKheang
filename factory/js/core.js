// Shared factory core: Supabase client, helpers, icons, toast, router, sidebar, login gate.
// Same structure as admin/js/core.js; the factory sees only its own requests (RLS + factory_* functions).
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key; RLS + factory_* functions protect the data
);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const errText = (e) => (e && e.message) || "เกิดข้อผิดพลาด";
const must = (r) => { if (r.error) throw r.error; return r.data; };

// Thai dates in the Buddhist era, as in the Figma: "11 มิ.ย. 2569", "11 มิ.ย. 2569 · 14:20 น."
const dateTH = (s) => (s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-");
const timeTH = (s) => (s ? new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น." : "");
const dateTimeTH = (s) => (s ? `${dateTH(s)} · ${timeTH(s)}` : "-");
const monthTH = (s) => new Date(s).toLocaleDateString("th-TH", { month: "short", year: "numeric" });
const monthKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// Line icons (Lucide, ISC licence), drawn inline so there is no icon dependency
const ICONS = {
  snowflake: '<path d="M2 12h20M12 2v20m8-6-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM17 18h1M12 18h1M7 18h1"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  sort: '<path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/>',
  arrowUpRight: '<path d="M7 7h10v10M7 17 17 7"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>', chevronLeft: '<path d="m15 18-6-6 6-6"/>', chevronDown: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
  pin: '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const icon = (name, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function toast(msg, bad) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3000);
}

// run an RPC, toast the result, throw on error
async function rpc(name, args, okMsg) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  if (okMsg) toast(okMsg);
  return data;
}

// ---- router ----
const routes = [];
const route = (re, fn) => routes.push({ re, fn });
const main = () => $("#view");
const hashParams = () => new URLSearchParams((location.hash.split("?")[1]) || "");
// breadcrumb: "ICEFLOW / Factory > <page> / <extra>"; a feature can add its part once its data is loaded
function setCrumbs(...parts) {
  $("#crumbs").innerHTML = `<span>ICEFLOW / Factory</span>${icon("chevronRight", 14)}<b>${parts.map(esc).join(" / ")}</b>`;
}

// ---- features: one file per page, loaded when its route is first opened ----
// A feature file calls route(...) when it loads. If a file is missing (not built yet) the page says so.
const FEATURES = [
  [/^\/dashboard$/, "dashboard"],
  [/^\/requests$/, "requests"], [/^\/requests\/\d+\/evaluate$/, "request-evaluate"],
  [/^\/production$/, "production"], [/^\/production\/\d+$/, "production-detail"], [/^\/qc$/, "qc"], [/^\/qc\/\d+$/, "qc-detail"], [/^\/installation$/, "installation"], [/^\/installation\/\d+(\/confirm)?$/, "installation-detail"],
  [/^\/notifications$/, "notifications"], [/^\/profile$/, "profile"],
];
const loaded = {};
function loadFeature(name) {
  if (!loaded[name]) loaded[name] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `js/features/${name}.js`;
    s.onload = resolve;
    s.onerror = () => { delete loaded[name]; reject(new Error(`feature "${name}" is not installed`)); };
    document.head.append(s);
  });
  return loaded[name];
}

async function navigate() {
  const path = (location.hash || "#/requests").slice(1).split("?")[0];
  const item = NAV.find((n) => path === n.href.slice(1) || path.startsWith(n.href.slice(1) + "/"));
  setCrumbs(item ? item.label : "");
  $$("aside a.nav").forEach((a) => a.classList.toggle("on", a === $(`aside a.nav[href="${item?.href}"]`)));
  const feature = FEATURES.find(([re]) => re.test(path));
  if (feature) {
    try { await loadFeature(feature[1]); }
    catch { main().innerHTML = `<div class="card empty">หน้านี้ยังไม่เปิดใช้งานในเวอร์ชันนี้<div class="small">Missing: js/features/${feature[1]}.js</div></div>`; return; }
  }
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
const NAV = [
  { label: "Dashboard", href: "#/dashboard", icon: "grid" },
  { label: "Manufacturing Requests", href: "#/requests", icon: "clipboard" },
  { label: "Production", href: "#/production", icon: "factory" },
  { label: "QC / Rework", href: "#/qc", icon: "circleCheck" },
  { label: "Installation", href: "#/installation", icon: "wrench" },
  { label: "Notifications", href: "#/notifications", icon: "bell" },
  { label: "Profile", href: "#/profile", icon: "user" },
];
const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("");
function sidebar(user) {
  return `<div class="brand"><span class="logo">${icon("snowflake", 20)}</span><div>ICEFLOW<div class="sub-brand">FACTORY WORKSPACE</div></div></div>
    <div class="group">Workspace</div>` +
    NAV.map((n) => `<a class="nav" href="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`).join("") +
    `<div class="grow"></div><div id="capw"></div>
    <div class="who"><span class="avatar">${esc(initials(user.name))}</span><div><b>${esc(user.name)}</b><div class="small">ผู้จัดการโรงงาน</div></div></div>`;
}

// ---- login gate ----
async function boot() {
  const { data } = await db.auth.getSession();
  if (!data.session) return showLogin();
  const { data: u } = await db.from("users").select("user_id, name, role, factory_id, is_active").eq("auth_id", data.session.user.id).maybeSingle();
  if (!u || !u.is_active || u.role !== "factory" || !u.factory_id) return showLogin("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานฝั่งโรงงาน");
  window.ME = u;
  $("#gate").hidden = true; $("#app").hidden = false;
  $("#side").innerHTML = sidebar(u);
  $("#bell").innerHTML = icon("bell") + $("#bell").innerHTML;
  $("#mename").textContent = u.name; $("#av").textContent = initials(u.name);
  $("#logout").innerHTML = icon("logout", 16);
  $("#logout").onclick = async () => { await db.auth.signOut(); location.hash = ""; location.reload(); };
  if (!location.hash) history.replaceState(null, "", "#/requests");
  await navigate();
  refreshShell();
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

// bell dot (requests waiting for a reply, production due by tomorrow) and the sidebar capacity card; refreshed after every action
async function refreshShell() {
  try {
    const [reqs, fac, jobs] = await Promise.all([fetchRequests(), fetchFactory(), fetchProduction()]);
    $("#belld").hidden = !reqs.some((r) => r.state === "pending") && !jobs.some(dueSoon);
    $("#capw").innerHTML = capacityCard(fac, reqs);
  } catch { /* the shell still works without these */ }
}
