// Factory core: helpers, icons, router, sidebar, login gate.
// Same structure as admin/js/core.js; the factory sees only its own requests (RLS + factory_* functions).
// db, $, $$, esc, must, toast, rpc, route, main, hashParams and loadFeature come from ../shared/staff-lib.js.
const errText = (e) => (e && e.message) || "เกิดข้อผิดพลาด";

// Thai dates in the Buddhist era, as in the Figma: "11 มิ.ย. 2569", "11 มิ.ย. 2569 · 14:20 น."
const dateTH = (s) => (s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-");
const timeTH = (s) => (s ? new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น." : "");
const dateTimeTH = (s) => (s ? `${dateTH(s)} · ${timeTH(s)}` : "-");
const monthTH = (s) => new Date(s).toLocaleDateString("th-TH", { month: "short", year: "numeric" });
const monthKey = (s) => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// ---- router ----
// breadcrumb: "NamKheang / Factory > <page> / <extra>"; a feature can add its part once its data is loaded
function setCrumbs(...parts) {
  $("#crumbs").innerHTML = `<span>NamKheang / Factory</span>${icon("chevronRight", 14)}<b>${parts.map(esc).join(" / ")}</b>`;
}

// ---- features: one file per page, loaded when its route is first opened ----
// A feature file calls route(...) when it loads. If a file is missing (not built yet) the page says so.
const FEATURES = [
  [/^\/dashboard$/, "dashboard"],
  [/^\/requests$/, "requests"], [/^\/requests\/\d+\/evaluate$/, "request-evaluate"],
  [/^\/production$/, "production"], [/^\/production\/\d+$/, "production-detail"], [/^\/qc$/, "qc"], [/^\/qc\/\d+$/, "qc-detail"], [/^\/installation$/, "installation"], [/^\/installation\/\d+(\/confirm)?$/, "installation-detail"],
  [/^\/notifications$/, "notifications"], [/^\/profile$/, "profile"],
];
async function navigate() {
  const path = (location.hash || "#/dashboard").slice(1).split("?")[0];
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
  return `<a class="nk-logo" href="#/dashboard">Nam<b>Kheang</b></a><span class="nk-tag">โรงงาน · Factory</span>
    <div class="group">Workspace</div>` +
    NAV.map((n) => `<a class="nav" href="${n.href}">${icon(n.icon)}<span>${n.label}</span></a>`).join("") +
    `<div class="grow"></div>
    <div class="who"><span class="avatar">${esc(initials(user.name))}</span><div><b>${esc(user.name)}</b><div class="small">ผู้จัดการโรงงาน</div></div></div>`;
}

// ---- login gate ----
async function boot() {
  const { data } = await db.auth.getSession();
  if (!data.session) return location.replace("../"); // universal sign-in
  const { data: u } = await db.from("users").select("user_id, name, role, factory_id, is_active").eq("auth_id", data.session.user.id).maybeSingle();
  if (!u || !u.is_active || u.role !== "factory" || !u.factory_id) return location.replace("../"); // the portal opens the site that matches this account
  window.ME = u;
  $("#app").hidden = false;
  $("#side").innerHTML = sidebar(u);
  $("#bell").innerHTML = icon("bell") + $("#bell").innerHTML;
  $("#mename").textContent = u.name; $("#av").textContent = initials(u.name);
  $("#logout").innerHTML = icon("logout", 16);
  $("#logout").onclick = async () => { await db.auth.signOut(); location.replace("../"); };
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  await navigate();
  refreshShell();
}

// bell dot (unread messages, requests waiting for a reply, production due by tomorrow) refreshed after every action
async function refreshShell() {
  try {
    const [reqs, jobs, notes] = await Promise.all([fetchRequests(), fetchProduction(), fetchFactoryNotes(50)]);
    $("#belld").hidden = !notes.some((n) => !n.read_at) && !reqs.some((r) => r.state === "pending") && !jobs.some(dueSoon);
  } catch { /* the shell still works without these */ }
}
