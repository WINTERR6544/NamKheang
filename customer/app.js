// Shared helpers. Loaded after the Supabase UMD script, so `supabase` is a global.
const db = supabase.createClient(
  "https://neotkiugfgktrjyzrbji.supabase.co",
  "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG", // publishable key: safe in the browser, RLS protects the data
);

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const errText = (e) => (e && e.message) || "Something went wrong";

// Customer-facing wording for orders.status (codes come from the order_statuses table)
const STATUS_LABEL = {
  0: "Order sent, waiting for the shop's quote", 1: "Quote ready, please confirm", 2: "Deposit paid",
  3: "Sent to the factory", 4: "In production", 5: "Built, awaiting quality check", 6: "Being fixed after quality check",
  7: "Quality check passed", 8: "Installation scheduled", 9: "Installed, awaiting your acceptance", 10: "Completed", 99: "Cancelled",
};
const MAIN_PATH = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10]; // rework (6) only shows if it happened
const MACHINE_TYPES = ["Tube ice machine", "Flake ice machine", "Block ice machine"];
const CAPACITIES = ["500 kg/day", "1 ton/day", "2 tons/day", "5 tons/day"];

const baht = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " THB";
const dateTH = (s, time) =>
  s ? new Date(s).toLocaleString("en-GB", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : "-";
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
      ? `<a href="orders.html">My orders</a><button id="logout">Log out</button>`
      : here === "login.html" ? `<a href="index.html">Home</a>` : `<a href="login.html">Log in</a>`
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
