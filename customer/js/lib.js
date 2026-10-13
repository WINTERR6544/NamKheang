// Shared route, formatting and table helpers.
export const FEATURES = Object.freeze({
  receipt: "customer_receipt",
  dashboard: "customer_dashboard",
  orders: "customer_orders",
  catalog: "customer_new_order",
  "new-order": "customer_new_order",
  order: "customer_order",
  quotation: "customer_quotation",
  deposit: "customer_payment_form",
  appointment: "customer_appointment",
  acceptance: "customer_acceptance",
  "final-payment": "customer_payment_form",
  "cancel-order": "customer_cancel",
  refund: "customer_refund",
  payments: "customer_payments",
  notifications: "customer_notifications",
  profile: "customer_profile",
});
export const AUTH_PAGES = ["login", "sign-up", "reset-password"];
const orderPages = [
  "order",
  "quotation",
  "deposit",
  "appointment",
  "acceptance",
  "final-payment",
  "cancel-order",
  "refund",
  "receipt",
];
export function routeUrl(page, values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined) params.set(key, value);
  let path = "#/" + page;
  if (orderPages.includes(page) && params.has("id")) {
    path += "/" + encodeURIComponent(params.get("id"));
    params.delete("id");
  }
  return path + (params.size ? "?" + params.toString() : "");
}
export function parseRoute(hash = globalThis.location?.hash || "") {
  const raw = hash.replace(/^#\/?/, "");
  const at = raw.indexOf("?");
  const path = at < 0 ? raw : raw.slice(0, at);
  const params = new URLSearchParams(at < 0 ? "" : raw.slice(at + 1));
  const segments = path.split("/");
  const page = segments[0] || "index";
  const valid =
    page === "index" ||
    AUTH_PAGES.includes(page) ||
    Object.hasOwn(FEATURES, page);
  if (
    !valid ||
    segments.length > 2 ||
    (segments.length === 2 && !orderPages.includes(page))
  )
    return { page: "not-found", params, key: hash };
  try {
    if (segments[1]) params.set("id", decodeURIComponent(segments[1]));
  } catch {
    return { page: "not-found", params, key: hash };
  }
  return { page, params, orderId: params.get("id"), key: hash };
}
export const routeParams = () => parseRoute().params;
export function authRedirect(page) {
  const target = new URL("index.html", location.href);
  target.searchParams.set("customer_page", page);
  return target.href;
}

export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (value) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
export const date = (value, time = false) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        ...(time ? { timeStyle: "short" } : {}),
      }).format(new Date(value))
    : "ยังไม่กำหนด";
export const todayBangkok = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const orderUrl = (page, id) => routeUrl(page, { id });
export const normalizePhone = (value) => {
  let s = String(value ?? "").replace(/[\s()-]/g, "");
  if (s.startsWith("+66")) s = "0" + s.slice(3);
  return s;
};
export const validId = (value) =>
  /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
export const balance = (quote, payments) =>
  Math.max(
    0,
    Number(quote?.total_price ?? 0) -
      payments
        .filter((p) => p.pay_type === "deposit" && p.verified)
        .reduce((sum, p) => sum + Number(p.amount), 0),
  );
export const initials = (name) =>
  String(name || "ล")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

// Same column contract as admin/core.js: { h, f(row), cls }.

export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export function table(columns, rows, href) {
  if (!rows.length) return '<div class="empty">ยังไม่มีรายการ</div>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th class="${esc(c.cls || "")}">${esc(c.h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr ${href ? `class="click" data-href="${esc(href(row))}" tabindex="0" role="link" aria-label="ดูรายละเอียด"` : ""}>${columns.map((c) => `<td class="${esc(c.cls || "")}">${c.f(row)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export function wireTable(root) {
  // Event delegation works after pagination redraws, just like admin's row navigation.
  if (root.dataset.tableWired) return;
  root.dataset.tableWired = "true";
  function open(event) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (event.type === "click" && event.button !== 0) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    if (event.target.closest("a,button,input,select,textarea")) return;
    const row = event.target.closest("tr[data-href]");
    if (!row || !root.contains(row)) return;
    event.preventDefault();
    location.assign(row.dataset.href);
  }
  root.addEventListener("click", open);
  root.addEventListener("keydown", open);
}
