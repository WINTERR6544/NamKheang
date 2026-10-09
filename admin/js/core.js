// Shared admin core: Supabase client, helpers, modal/toast, router, sidebar, login gate.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key; RLS + staff_* functions protect the data
);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const errText = (e) => (e && e.message) || "Something went wrong";
const baht = (n) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTH = (s, time) => (s ? new Date(s).toLocaleString("en-GB", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "-");
const daysAgo = (s) => (Date.now() - new Date(s).getTime()) / 86400000;

// Staff wording for orders.status
const STATUS = {
  0: "New, waiting for quote", 1: "Quoted", 2: "Deposit paid, to send to factory", 3: "Sent to factory", 4: "In production",
  5: "Built, waiting for QC", 6: "QC failed, being fixed", 7: "QC passed, to schedule install", 8: "Install scheduled", 9: "Installed, waiting for acceptance",
  10: "Completed", 99: "Cancelled",
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
function modal(title, body, { ok = "Save", onOk, onOpen } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "ov";
    ov.innerHTML = `<div class="card" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><div class="m">${body}</div>
      <div class="err" hidden style="margin-top:12px"></div>
      <div class="row end" style="margin-top:14px"><button class="btn ghost c">Close</button>${onOk ? `<button class="btn o">${esc(ok)}</button>` : ""}</div></div>`;
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
  if (!path) return toast("No slip file (paid in cash)", true);
  try { const u = await slipUrl(path); modal("Slip", `<a href="${u}" target="_blank" rel="noopener"><img class="slip" src="${u}" alt="Payment slip"></a>`); }
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

// ---- features: one file per page, loaded when its route is first opened ----
// A feature file calls route(...) when it loads. If a file is missing (branch not merged yet) the page says so.
const FEATURES = [
  [/^\/dashboard$/, "dashboard"],
  [/^\/orders$/, "orders-all"], [/^\/orders\/new$/, "orders-new"], [/^\/orders\/quotations$/, "orders-quotations"], [/^\/orders\/cancelled$/, "orders-cancelled"],
  [/^\/order\/\d+$/, "order-detail"],
  [/^\/mfg\/requests$/, "mfg-requests"], [/^\/mfg\/status$/, "mfg-status"],
  [/^\/installation$/, "installation"], [/^\/notifications$/, "notifications"], [/^\/customers$/, "customers"], [/^\/factories$/, "factories"], [/^\/history$/, "reports-history"], [/^\/users$/, "users-roles"],
  [/^\/payments\/deposit$/, "payments-deposit"], [/^\/payments\/final$/, "payments-final"], [/^\/payments\/refund$/, "payments-refund"],
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
// ---- boards: a sidebar group's pages can also be shown as a board (List | Board switch) ----
// Each group's board is js/features/board-<group>.js; the shared renderer is features/board.js. Missing files hide the switch.
const BOARD_OF = [[/^\/orders(\/|$)/, "order"], [/^\/payments\//, "payments"], [/^\/(mfg\/|installation$)/, "mfg"]];
const boardProbe = {};
const boardInstalled = (g) => (boardProbe[g] ??= fetch(`js/features/board-${g}.js`, { method: "HEAD" }).then((r) => r.ok).catch(() => false));
// The List | Board choice is remembered per sidebar group (browser storage, so it survives reloads).
// A link with an explicit ?view=list|board wins and is saved; a plain link (sidebar, breadcrumb) uses the saved choice.
const viewKey = (g) => "iceflow.view." + g;
async function currentView(g) {
  const asked = hashParams().get("view");
  if (asked === "board" || asked === "list") { try { localStorage.setItem(viewKey(g), asked); } catch {} return asked; }
  let saved = null;
  try { saved = localStorage.getItem(viewKey(g)); } catch {}
  return saved === "board" && (await boardInstalled(g)) ? "board" : "list";
}
async function addViewToggle(path, group, isBoard) {
  if (!(await boardInstalled(group))) return;
  const head = main().querySelector(".head");
  if (!head || head.querySelector(".seg") || (location.hash || "").slice(1).split("?")[0] !== path) return;
  const seg = document.createElement("div");
  seg.className = "seg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "View");
  seg.innerHTML = `<a href="#${path}?view=list" class="${isBoard ? "" : "on"}">List</a><a href="#${path}?view=board" class="${isBoard ? "on" : ""}">Board</a>`;
  head.append(seg);
}

async function navigate() {
  const path = (location.hash || "#/dashboard").slice(1).split("?")[0];
  $("#crumbs").innerHTML = crumbsFor(path);
  $$("aside a.nav").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + path));
  const group = BOARD_OF.find(([re]) => re.test(path))?.[1];
  if (group && (await currentView(group)) === "board") {
    main().innerHTML = `<p class="muted">Loading...</p>`;
    try { await loadFeature("board"); await loadFeature("board-" + group); }
    catch { main().innerHTML = `<div class="card empty">The board view is not installed in this build.<div class="small">Missing: js/features/board-${group}.js</div></div>`; return; }
    try { await renderBoard(main(), group); } catch (e) { main().innerHTML = `<div class="err">${esc(errText(e))}</div>`; }
    addViewToggle(path, group, true);
    window.scrollTo(0, 0);
    return;
  }
  const feature = FEATURES.find(([re]) => re.test(path));
  if (feature) {
    try { await loadFeature(feature[1]); }
    catch { main().innerHTML = `<div class="card empty">This page is not installed in this build.<div class="small">Missing: js/features/${feature[1]}.js</div></div>`; return; }
  }
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      main().innerHTML = `<p class="muted">Loading...</p>`;
      try { await r.fn(main(), m.slice(1)); } catch (e) { main().innerHTML = `<div class="err">${esc(errText(e))}</div>`; }
      if (group) addViewToggle(path, group, false);
      window.scrollTo(0, 0);
      return;
    }
  }
  main().innerHTML = `<div class="card empty">Page not found</div>`;
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
  { label: "Factory Requests", href: "#/mfg/requests", sub: 1 }, { label: "Order Status", href: "#/mfg/status", sub: 1 },
  { label: "Installation", href: "#/installation" },
  G("Payments"),
  { label: "Deposit", href: "#/payments/deposit", sub: 1, key: "dep" }, { label: "Final Payment", href: "#/payments/final", sub: 1, key: "fin" },
  { label: "Refund", href: "#/payments/refund", sub: 1, key: "ref" },
  G("Admin"),
  { label: "Customers", href: "#/customers" }, { label: "Factories", href: "#/factories" }, { label: "Notifications", href: "#/notifications" },
  { label: "Reports / History", href: "#/history" }, { label: "Users & Roles", href: "#/users", sub: 1 },
];
function sidebar(user) {
  return `<div class="brand">ICEFLOW</div><div class="sub-brand">SHOP &amp; ADMIN CRM</div>` +
    NAV.map((n) =>
      n.group ? `<div class="group">${n.group}</div>` :
      n.soon ? `<a class="nav soon ${n.sub ? "sub" : ""}" aria-disabled="true">${n.label}<span class="small">soon</span></a>` :
      `<a class="nav ${n.sub ? "sub" : ""}" href="${n.href}">${n.label}${n.key ? `<span class="count" id="c-${n.key}" hidden></span>` : ""}</a>`).join("") +
    `<div class="who">${esc(user.name)} · ${esc(user.role)}<br><button class="btn sm ghost" id="logout" style="margin-top:8px">Log out</button></div>`;
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
  if (!u || !u.is_active || !["admin", "shop"].includes(u.role)) return showLogin("This account does not have shop access");
  window.ME = u;
  $("#gate").hidden = true; $("#app").hidden = false;
  $("#side").innerHTML = sidebar(u);
  $("#mename").textContent = u.name + " · " + u.role; $("#av").textContent = (u.name || "?").trim().charAt(0).toUpperCase();
  $("#bell").onclick = () => { location.hash = "#/dashboard"; };
  $("#upd").textContent = "Last updated " + dateTH(new Date(), true);
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
    if (error) { err.textContent = /invalid login/i.test(error.message) ? "Wrong email or password" : errText(error); err.hidden = false; return; }
    boot();
  };
  if (msg) db.auth.signOut();
}

// generic table: cols = [{h, f(row)->html, cls}], rows, onClick(row)->href
function table(cols, rows, href) {
  if (!rows.length) return `<div class="empty">No items</div>`;
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
