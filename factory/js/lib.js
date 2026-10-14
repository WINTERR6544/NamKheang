// Helpers shared by the feature pages in js/features/: loading this factory's requests and the bits of UI they share.

// A request is one factory_assignments row for my factory. Its state for the factory:
//   pending  = waiting for my reply (order still at 3 waiting_factory)
//   rejected = I declined
//   accepted = I accepted (moves on to Production, not listed on Manufacturing Requests)
//   closed   = still pending but the shop cancelled the order, so it can no longer be answered
const REQ_SEL = "assignment_id, order_id, response, reject_reason, sent_at, responded_at, " +
  "orders(order_id, order_code, status, machine_type, capacity, customers(name), machine_models(name))";
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

// "สรุปงานที่ประเมิน" card on the accept / decline page
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

// ---- Production (UC6) ----
// A production job is an order this factory accepted. Its stage for the factory:
//   ready  = accepted, production not started (order at 3)
//   making = in production (4); the factory updates the estimated finish date or marks it finished
//   qc     = finished and handed to QC or later (5 and up), read-only here
const PROD_SEL = "assignment_id, order_id, responded_at, orders(order_id, order_code, status, machine_type, capacity, started_at, est_finish_date, finished_at, " +
  "customers(name), machine_models(name, description))";
const prodStage = (s) => (s === 3 ? "ready" : s === 4 ? "making" : "qc");
const toJob = (a) => ({ ...a, o: a.orders, stage: prodStage(a.orders.status) });

// the Production page lists only active jobs: 3 waiting to start, 4 in production.
// Once finished (5 waiting_qc and later) a job belongs to QC / Rework and Installation, so the database query leaves it out.
const ACTIVE = [3, 4];
async function fetchProduction() {
  const rows = must(await db.from("factory_assignments").select(PROD_SEL.replace("orders(", "orders!inner("))
    .eq("factory_id", ME.factory_id).eq("response", "accepted").in("orders.status", ACTIVE)
    .order("responded_at", { ascending: false }).limit(1000));
  return rows.map(toJob);
}
async function fetchJob(orderId) {
  const rows = must(await db.from("factory_assignments").select(PROD_SEL).eq("factory_id", ME.factory_id).eq("response", "accepted")
    .eq("order_id", orderId).limit(1));
  if (!rows.length || !rows[0].orders || rows[0].orders.status === 99) throw new Error("ไม่พบงานผลิตนี้ หรือโรงงานของคุณยังไม่ได้รับผลิตงานนี้");
  return toJob(rows[0]);
}
// production timeline; empty until the factory_production migration lets the factory read it
async function fetchProductionUpdates(orderId) {
  const r = await db.from("production_updates").select("update_id, stage, est_finish_date, note, created_at").eq("order_id", orderId).order("created_at", { ascending: false });
  return r.error ? [] : r.data;
}

// estimated finish date ("YYYY-MM-DD") against today, in whole days
const pad2 = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const daysUntil = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
// local "YYYY-MM-DD" of a timestamp (started_at)
const isoOf = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
// an estimated finish date before the day production started cannot be right (data entered outside the factory page)
const badPlan = (o) => !!(o.est_finish_date && o.started_at && o.est_finish_date < isoOf(o.started_at));
// same rule as the nightly remind_production_deadlines job: in production and due by tomorrow
const dueSoon = (j) => j.stage === "making" && j.o.est_finish_date && daysUntil(j.o.est_finish_date) <= 1;
function dueText(j) {
  if (j.stage !== "making" || !j.o.est_finish_date) return "";
  if (badPlan(j.o)) return `<span class="red">วันที่คาดว่าจะเสร็จอยู่ก่อนวันเริ่มผลิต กรุณากำหนดใหม่</span>`;
  const n = daysUntil(j.o.est_finish_date);
  return n < 0 ? `<span class="red">เลยวันที่คาดว่าจะเสร็จ ${-n} วัน</span>` : n === 0 ? `<span class="amber">ครบกำหนดวันนี้</span>`
    : n === 1 ? `<span class="amber">ครบกำหนดพรุ่งนี้</span>` : `อีก ${n} วัน`;
}
const AFTER = { 5: "รอตรวจ QC", 6: "Rework", 7: "ผ่าน QC", 8: "นัดติดตั้งแล้ว", 9: "ติดตั้งแล้ว", 10: "เสร็จสิ้น" };
function stagePill(j) {
  if (j.stage === "ready") return `<span class="pill dot warn">รอเริ่มผลิต</span>`;
  if (j.stage === "making") return `<span class="pill dot">กำลังผลิต</span>`;
  return `<span class="pill dot ${j.o.status === 6 ? "bad" : "ok"}">${AFTER[j.o.status] ?? "ส่งตรวจ QC แล้ว"}</span>`;
}

// ---- QC / Rework (UC7) ----
// The factory records manufacturing QC (staff_qc_submit) and sends fixed work back (staff_rework_done); the shop only views it.
//   5 waiting_qc -> record a round: every item passes -> 7 qc_passed, any item fails -> 6 rework
//   6 rework     -> fix the failed items, send back -> 5 waiting_qc (next round)
//   7 qc_passed  -> read-only here; the shop books the install
const QC_ACTIVE = [5, 6, 7];
async function fetchQcJobs() {
  const rows = must(await db.from("factory_assignments").select(PROD_SEL.replace("orders(", "orders!inner("))
    .eq("factory_id", ME.factory_id).eq("response", "accepted").in("orders.status", QC_ACTIVE)
    .order("responded_at", { ascending: false }).limit(1000));
  return rows.map(toJob);
}
async function fetchQcJob(orderId) {
  const j = await fetchJob(orderId);
  if (!QC_ACTIVE.includes(j.o.status)) throw new Error("งานนี้ไม่ได้อยู่ในขั้นตอน QC");
  return j;
}
// QC rounds of some orders for one stage (production, or onsite at the install), grouped: Map(order_id -> [{ round_no, at, items: [...] }] newest first).
// Empty until the factory_qc migration lets the factory read qc_results.
async function fetchQcRounds(orderIds, stage = "production") {
  const byOrder = new Map(orderIds.map((id) => [id, []]));
  if (!orderIds.length) return byOrder;
  const r = await db.from("qc_results").select("order_id, round_no, item_id, passed, note, checked_at, qc_items(item_name, item_name_th)")
    .eq("stage", stage).in("order_id", orderIds).order("round_no", { ascending: false }).order("item_id");
  for (const x of r.error ? [] : r.data) {
    const list = byOrder.get(x.order_id);
    let round = list.find((k) => k.round_no === x.round_no);
    if (!round) list.push(round = { round_no: x.round_no, at: x.checked_at, items: [] });
    round.items.push(x);
  }
  for (const list of byOrder.values()) for (const k of list) k.failed = k.items.filter((i) => !i.passed);
  return byOrder;
}
async function fetchQcItems() {
  const r = await db.from("qc_items").select("item_id, item_name, item_name_th, description_th, description_en, fix_example_th").eq("is_active", true).order("item_id");
  return r.error ? [] : r.data;
}
let maxRoundsP;
const qcMaxRounds = () => (maxRoundsP ??= db.from("business_rules").select("value").eq("rule_key", "max_qc_rounds").maybeSingle()
  .then((r) => Number(r.data?.value ?? 3)).catch(() => 3));
// state of a QC job for the list: pending (first check), recheck (sent back after a fix), fail (6), pass (7)
function qcState(j, rounds) {
  if (j.o.status === 6) return "fail";
  if (j.o.status === 7) return "pass";
  return rounds.length ? "recheck" : "pending";
}
const QC_STATE = { pending: ["รอตรวจ QC", "warn"], recheck: ["รอตรวจซ้ำหลังแก้ไข", "warn"], fail: ["ไม่ผ่าน · รอแก้ไข", "bad"], pass: ["ผ่าน QC", "ok"] };
const qcPill = (s) => `<span class="pill dot ${QC_STATE[s][1]}">${QC_STATE[s][0]}</span>`;
// "ระบบทำความเย็นและการผลิตน้ำแข็ง" over "Cooling system and ice production", and what to check (Thai / English) under it.
// The Thai name, descriptions and the fix example live in qc_items (migration qc_items_thai), so an admin edits them in the database;
// an item without a Thai name shows its English name only.
function qcTitle(it, withDesc) {
  return `<b>${esc(it.item_name_th || it.item_name)}</b>${it.item_name_th ? `<div class="small muted">${esc(it.item_name)}</div>` : ""}` +
    (withDesc && (it.description_th || it.description_en) ? `<div class="small desc">${esc(it.description_th ?? "")}${it.description_th && it.description_en ? "<br>" : ""}<span class="muted">${esc(it.description_en ?? "")}</span></div>` : "");
}

// ---- Installation (UC8 schedule, UC9 confirm install, UC10 fix after a failed acceptance) ----
// The shop books the date (staff_schedule_install tells the factory). The factory records an on-site QC and confirms the install.
//   7 qc_passed  -> waiting for the shop to book a date
//   8 scheduled  -> install (or a fix visit after the customer reported a problem); confirm when installed and tested
//   9 installed  -> waiting for the customer to accept; a forwarded problem means a fix visit is coming
const INST_ACTIVE = [7, 8, 9];
const INST_SEL = "assignment_id, order_id, responded_at, orders!inner(order_id, order_code, status, machine_type, capacity, install_address, install_power, " +
  "install_space, finished_at, installed_at, customers(name, phone), machine_models(name))";
async function fetchInstallJobs(orderId) {
  let q = db.from("factory_assignments").select(INST_SEL).eq("factory_id", ME.factory_id).eq("response", "accepted").in("orders.status", INST_ACTIVE);
  if (orderId) q = q.eq("order_id", orderId);
  const rows = must(await q.order("responded_at", { ascending: false }).limit(1000));
  return rows.map((a) => ({ ...a, o: a.orders }));
}
async function fetchInstallJob(orderId) {
  const [j] = await fetchInstallJobs(orderId);
  if (!j) throw new Error("ไม่พบงานติดตั้งนี้ หรืองานนี้ไม่ได้อยู่ในขั้นตอนติดตั้ง");
  return j;
}
// appointments and forwarded customer problems of some orders; empty until the factory_installation migration
async function fetchInstallExtras(orderIds) {
  const appts = new Map(orderIds.map((id) => [id, []])), probs = new Map();
  if (!orderIds.length) return { appts, probs };
  const [a, p] = await Promise.all([
    db.from("appointments").select("appointment_id, order_id, install_datetime, status, reschedule_count, reschedule_reason, created_at")
      .in("order_id", orderIds).order("created_at", { ascending: false }),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, forwarded_at").in("order_id", orderIds).order("checked_at", { ascending: false }),
  ]);
  for (const x of a.error ? [] : a.data) appts.get(x.order_id)?.push(x);
  for (const x of p.error ? [] : p.data) if (!probs.has(x.order_id)) probs.set(x.order_id, x);
  return { appts, probs };
}
// the customer's latest forwarded problem, if it is newer than the last confirmed install
const openProblem = (j, prob) => (prob && !prob.passed && (!j.o.installed_at || prob.checked_at > j.o.installed_at) ? prob : null);
function instState(j, appt, prob) {
  if (j.o.status === 7) return "waiting";
  if (j.o.status === 8) return openProblem(j, prob) ? "fix" : "scheduled";
  return openProblem(j, prob) ? "reported" : "installed";
}
const INST_STATE = { waiting: ["รอประสานวันนัด", "warn"], scheduled: ["ยืนยันนัดแล้ว", ""], fix: ["นัดเข้าแก้ไข", "bad"],
  installed: ["ติดตั้งเสร็จ · รอตรวจรับ", "ok"], reported: ["ลูกค้าแจ้งปัญหา · รอร้านนัด", "bad"] };
const instPill = (s) => `<span class="pill dot ${INST_STATE[s][1]}">${INST_STATE[s][0]}</span>`;
const timeOnly = (s) => new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";

