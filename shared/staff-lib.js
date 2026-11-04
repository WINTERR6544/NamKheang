// Shared by admin/ and factory/ (staff sites): the helpers that were copied verbatim between
// admin/js/core.js and factory/js/core.js. Classic script, no modules: load it BEFORE js/core.js.
// Locale-specific pieces (errText, dateTH, navigate, sidebar, boot, showLogin) stay in each core.js.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key; RLS + staff_* / factory_* functions protect the data
);

// admin/, factory/ and the portal share one stored session. When it ends (sign-out here or in
// another tab, or a refresh that fails), go to the universal sign-in page instead of
// staying on a page whose requests now run signed out (empty lists, 401 errors).
let signedIn = false;
const toGate = () => location.replace("../");
db.auth.onAuthStateChange((event, session) => {
  if (session) signedIn = true;
  else if (signedIn && event === "SIGNED_OUT") toGate();
});
// a tab left open in the background: check again before showing the next page
async function sessionGone() {
  if (!signedIn) return false;
  const { data } = await db.auth.getSession();
  return !data.session;
}
window.addEventListener("hashchange", async () => { if (await sessionGone()) toGate(); });
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && (await sessionGone())) toGate();
});

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// machine_type is stored in English (it is a key); show it in Thai
const TYPE_TH = { "Tube ice machine": "เครื่องทำน้ำแข็งหลอด", "Flake ice machine": "เครื่องทำน้ำแข็งเกล็ด", "Block ice machine": "เครื่องทำน้ำแข็งก้อน" };
const typeTH = (t) => TYPE_TH[t] ?? t;
const must = (r) => { if (r.error) throw r.error; return r.data; };

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

// ---- line icons (Lucide, ISC licence), drawn inline so there is no icon dependency ----
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
  checks: '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  list: '<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
};
const icon = (name, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---- router state ----
const routes = [];
const route = (re, fn) => routes.push({ re, fn });
const main = () => $("#view");
const hashParams = () => new URLSearchParams((location.hash.split("?")[1]) || "");

// ---- feature loader: js/features/<name>.js, relative to the page that includes this file ----
const loaded = {};
function loadFeature(name) {
  if (!loaded[name]) loaded[name] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `js/features/${name}.js`;
    s.onload = resolve;
    s.onerror = () => { delete loaded[name]; reject(new Error(`ไม่พบหน้า "${name}"`)); };
    document.head.append(s);
  });
  return loaded[name];
}

// ---- collapsible sidebar: a button at the start of the topbar toggles .collapsed on #app ----
// Wide screens remember the choice per browser; narrow screens use it as a slide-over menu that starts closed.
(() => {
  const app = $("#app"), bar = $(".topbar");
  if (!app || !bar) return;
  const KEY = "sidebar-collapsed";
  const wide = () => window.matchMedia("(min-width: 901px)").matches;
  const b = document.createElement("button");
  b.type = "button"; b.className = "side-toggle"; b.textContent = "☰"; b.title = b.ariaLabel = "เปิด/ปิดเมนู";
  const sync = () => b.setAttribute("aria-expanded", String(!app.classList.contains("collapsed")));
  let saved = false;
  try { saved = localStorage.getItem(KEY) === "1"; } catch { /* private mode: just not remembered */ }
  app.classList.toggle("collapsed", wide() ? saved : true);
  b.onclick = () => {
    const on = app.classList.toggle("collapsed");
    if (wide()) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ } }
    sync();
  };
  // tap outside the open drawer to close it (the drawer covers the toggle button)
  const bd = document.createElement("div");
  bd.className = "side-backdrop";
  bd.onclick = () => { app.classList.add("collapsed"); sync(); };
  app.append(bd);
  // after picking a page on a narrow screen, get the menu out of the way
  window.addEventListener("hashchange", () => { if (!wide()) { app.classList.add("collapsed"); sync(); } });
  sync();
  bar.prepend(b);
})();
