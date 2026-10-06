// Helpers shared by the feature pages in js/features/: loading this factory's requests and the bits of UI they share.

// A request is one factory_assignments row for my factory. Its state for the factory:
//   pending  = waiting for my reply (order still at 3 waiting_factory)
//   rejected = I declined
//   accepted = I accepted (moves on to Production, not listed on Manufacturing Requests)
//   closed   = still pending but the shop cancelled the order, so it can no longer be answered
const REQ_SEL = "assignment_id, order_id, response, reject_reason, sent_at, responded_at, " +
  "orders(order_id, order_code, status, machine_type, capacity, install_address, install_power, install_space, created_at, " +
  "customers(name, phone, email), machine_models(name, code, description))";
const reqState = (a) => (a.response === "pending" ? (a.orders?.status === 3 ? "pending" : "closed") : a.response);

async function fetchRequests() {
  const rows = must(await db.from("factory_assignments").select(REQ_SEL).eq("factory_id", ME.factory_id)
    .order("sent_at", { ascending: false }).limit(1000));
  return rows.map((a) => ({ ...a, state: reqState(a) }));
}
// the latest request for one order (a shop can send the same order to this factory again after a decline)
async function fetchRequest(orderId) {
  const rows = must(await db.from("factory_assignments").select(REQ_SEL).eq("factory_id", ME.factory_id).eq("order_id", orderId)
    .order("sent_at", { ascending: false }).limit(1));
  if (!rows.length) throw new Error("ไม่พบคำขอผลิตนี้ หรือคำขอนี้ไม่ได้ส่งมาที่โรงงานของคุณ");
  return { ...rows[0], state: reqState(rows[0]) };
}
async function fetchFactory() {
  return must(await db.from("factories").select("factory_id, name, capacity_per_month").eq("factory_id", ME.factory_id).maybeSingle());
}
const STATE = {
  pending: ["รอประเมิน", ""], rejected: ["ปฏิเสธแล้ว", "bad"], accepted: ["รับผลิตแล้ว", "ok"], closed: ["ร้านยกเลิกคำสั่งซื้อ", "mute"],
};
const statePill = (s) => `<span class="pill dot ${STATE[s][1]}">${STATE[s][0]}</span>`;
const modelName = (o) => o.machine_models?.name ?? o.machine_type;

// orders I accepted that are still with me (accepted, in production, waiting for QC, rework)
function capacityCard(fac, reqs) {
  if (!fac?.capacity_per_month) return "";
  const load = reqs.filter((r) => r.response === "accepted" && [3, 4, 5, 6].includes(r.orders?.status)).length;
  const pct = Math.min(100, Math.round((load / fac.capacity_per_month) * 100));
  return `<div class="capcard"><b>${esc(fac.name)}</b><div class="row-sb small"><span>งานผลิตในมือ</span><span>${pct}%</span></div>
    <div class="track"><span style="width:${pct}%"></span></div>
    <div class="small">${load} / ${fac.capacity_per_month} เครื่องต่อเดือน · ${load < fac.capacity_per_month ? "ยังรับงานได้" : "เต็มกำลังผลิต"}</div></div>`;
}

// "สรุปคำขอผลิต" card, shared by the detail page and the accept / decline page
function summaryCard(title, a) {
  const o = a.orders;
  return `<div class="card"><h2>${title}</h2>
    <div class="row-sb"><div><div class="eyebrow">ORDER NO.</div><div class="code-lg">${esc(o.order_code)}</div></div>${statePill(a.state)}</div>
    <hr>
    <dl class="kv2">
      <div><dt>รุ่นเครื่อง</dt><dd>${esc(modelName(o))}<div class="small muted">${esc(o.capacity)}</div></dd></div>
      <div><dt>ลูกค้า</dt><dd>${esc(o.customers?.name ?? "-")}</dd></div>
      <div><dt>วันที่ส่งคำขอ</dt><dd>${dateTimeTH(a.sent_at)}</dd></div>
      ${a.state === "rejected" ? `<div class="full"><dt>เหตุผลที่ปฏิเสธ · ${dateTimeTH(a.responded_at)}</dt><dd>${esc(a.reject_reason)}</dd></div>` : ""}
      ${a.state === "accepted" ? `<div class="full"><dt>รับผลิตเมื่อ</dt><dd>${dateTimeTH(a.responded_at)}</dd></div>` : ""}
    </dl></div>`;
}
