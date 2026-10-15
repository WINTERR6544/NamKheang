// Shared by admin/ and factory/ (staff sites): the helpers that were copied verbatim between
// admin/js/core.js and factory/js/core.js. Classic script, no modules: load it BEFORE js/core.js.
// Locale-specific pieces (errText, dateTH, navigate, sidebar, boot, showLogin) stay in each core.js.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key; RLS + staff_* / factory_* functions protect the data
);

// admin/, factory/ and the portal share one stored session. When it ends (sign-out here or in
// another tab, or a refresh that fails), reload to this site's own sign-in screen instead of
// staying on a page whose requests now run signed out (empty lists, 401 errors). Nothing happens
// while the sign-in screen is already showing, so its error messages stay visible.
let signedIn = false;
const toGate = () => { if (document.getElementById("app")?.hidden === false) location.reload(); };
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
    s.onerror = () => { delete loaded[name]; reject(new Error(`feature "${name}" is not installed`)); };
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
  b.type = "button"; b.className = "side-toggle"; b.textContent = "☰"; b.title = b.ariaLabel = "Toggle sidebar";
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
