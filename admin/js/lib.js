// Helpers shared by the feature pages in js/features/.
const ORDER_SEL = "order_id, order_code, status, machine_type, capacity, quantity, created_at, sent_at, est_finish_date, customers(name, phone), factories(name), machine_models(name)";
async function fetchOrders(statuses) {
  let q = db.from("orders").select(ORDER_SEL).order("created_at", { ascending: false }).limit(1000);
  if (statuses) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
const head = (title, sub) => `<div class="head"><div><h1>${title}</h1>${sub ? `<div class="muted">${sub}</div>` : ""}</div></div>`;
const orderLink = (o) => `<a class="mono" href="#/order/${o.order_id}"><b>${esc(o.order_code)}</b></a>`;
const who = (o) => `${esc(o.customers?.name)}<div class="small muted">${esc(o.customers?.phone)}</div>`;
const ORDER_COLS = [
  { h: "คำสั่งซื้อ", f: orderLink }, { h: "ลูกค้า", f: who },
  { h: "รุ่น", f: (o) => `${esc(o.machine_models?.name ?? typeTH(o.machine_type))}${o.quantity > 1 ? ` <b>× ${o.quantity}</b>` : ""}<div class="small muted">${esc(o.capacity)}</div>` },
  { h: "สถานะ", f: (o) => pill(o.status) }, { h: "โรงงาน", f: (o) => esc(o.factories?.name ?? "-") }, { h: "วันที่สั่ง", f: (o) => dateTH(o.created_at) },
];
const goOrder = (o) => `#/order/${o.order_id}`;

/* Shared orders list. orders-* features pass a title, subtitle and the statuses to show. */
async function ordersPage(el, title, sub, statuses, withStatusFilter) {
  const p = hashParams().get("status");
  const all = await fetchOrders(statuses ?? (p ? [Number(p)] : null));
  el.innerHTML = head(title, sub) + `<div class="card"><div class="filters">
      <input id="q" placeholder="ค้นหา: เลขคำสั่งซื้อ / ชื่อ / เบอร์โทร">
      ${withStatusFilter ? `<select id="st"><option value="">ทุกสถานะ</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : ""}
    </div><div id="tb"></div></div>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), st = $("#st")?.value;
    const rows = all.filter((o) => (!st || String(o.status) === st) &&
      (!q || [o.order_code, o.customers?.name, o.customers?.phone].some((x) => String(x ?? "").toLowerCase().includes(q))));
    $("#tb").innerHTML = table(ORDER_COLS, rows, goOrder);
  };
  $("#q").oninput = draw; $("#st")?.addEventListener("change", draw); draw();
}

/* Shared payments list. A payments-* feature supplies the type, titles, the row actions and what they do. */
async function paymentsPage(el, { type, title, sub, actions, onAct }) {
  const rows = must(await db.from("payments").select("*, orders(order_code, status, customers(name))").eq("pay_type", type).order("paid_at", { ascending: false }).limit(300));
  const sel = hashParams().get("show") ?? "pending";
  const shown = rows.filter((p) => sel === "all" || (sel === "pending") === !p.verified);
  const method = { qr: "QR พร้อมเพย์", transfer: "โอนเงิน", cash: "เงินสด" };
  el.innerHTML = head(title, sub) +
    `<div class="card"><div class="filters"><select id="sh"><option value="pending">รอตรวจสอบ</option><option value="done">ตรวจแล้ว</option><option value="all">ทั้งหมด</option></select></div>${table([
      { h: "คำสั่งซื้อ", f: (p) => `<a class="mono" href="#/order/${p.order_id}"><b>${esc(p.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (p) => esc(p.orders?.customers?.name) },
      { h: "จำนวนเงิน (บาท)", f: (p) => baht(p.amount) },
      ...(type === "refund" ? [{ h: "บัญชีลูกค้า", f: (p) => esc(p.refund_account ?? "— ยังไม่ระบุ") }] : [{ h: "วิธีชำระ", f: (p) => esc(method[p.payment_method] ?? "-") }]),
      { h: "สลิป", f: (p) => p.slip_path ? `<button class="btn sm ghost" data-act="slip" data-p="${p.payment_id}">ดู</button>` : "-" },
      { h: "สถานะ", f: (p) => p.verified ? `<span class="pill ok">${type === "refund" ? "คืนเงินแล้ว" : "ตรวจแล้ว"}</span>${p.receipt_no ? `<div class="small mono">${esc(p.receipt_no)}</div>` : ""}` : `<span class="pill warn">รอตรวจสอบ</span>` },
      { h: "วันเวลา", f: (p) => dateTH(p.paid_at, true) },
      { h: "", f: (p) => (p.verified ? "" : actions(p)) },
    ], shown)}</div>`;
  $("#sh").value = sel; $("#sh").onchange = () => { location.hash = `#/payments/${type}?show=${$("#sh").value}`; };
  const byId = new Map(rows.map((p) => [String(p.payment_id), p]));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = byId.get(b.dataset.p), act = b.dataset.act;
    if (act === "slip") return showSlip(p.slip_path);
    await onAct(act, p, () => { refreshCounts(); navigate(); });
  };
}

/* Approve / reject buttons and handler shared by the deposit and final-payment pages. */
const verifyActions = (p) => `<button class="btn sm green" data-act="ok" data-p="${p.payment_id}">อนุมัติ</button> <button class="btn sm red" data-act="no" data-p="${p.payment_id}">ปฏิเสธ</button>`;
async function verifyAct(act, p, after, approvedMsg) {
  if (act === "ok") {
    try { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: true }, approvedMsg); after(); } catch (er) { toast(errText(er), true); }
  } else if (act === "no") {
    if (await modal("ปฏิเสธหลักฐานการชำระเงิน", `<label>เหตุผล (ลูกค้าจะได้รับแจ้ง)</label><textarea id="r" rows="3"></textarea>`, { ok: "ปฏิเสธ",
      onOk: async (m) => { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: false, p_reason: $("#r", m).value }, "ปฏิเสธแล้ว แจ้งให้ลูกค้าส่งหลักฐานใหม่"); } })) after();
  }
}
