// List pages: dashboard, orders, quotations, manufacturing, installation, payments.
const ORDER_SEL = "order_id, order_code, status, machine_type, capacity, created_at, sent_at, est_finish_date, customers(name, phone), factories(name), machine_models(name)";
async function fetchOrders(statuses) {
  let q = db.from("orders").select(ORDER_SEL).order("created_at", { ascending: false }).limit(1000);
  if (statuses) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
const must = (r) => { if (r.error) throw r.error; return r.data; };
const head = (title, sub) => `<div class="head"><div><h1>${title}</h1>${sub ? `<div class="muted">${sub}</div>` : ""}</div></div>`;
const orderLink = (o) => `<a class="mono" href="#/order/${o.order_id}"><b>${esc(o.order_code)}</b></a>`;
const who = (o) => `${esc(o.customers?.name)}<div class="small muted">${esc(o.customers?.phone)}</div>`;
const ORDER_COLS = [
  { h: "Order", f: orderLink }, { h: "ลูกค้า", f: who },
  { h: "รุ่น", f: (o) => `${esc(o.machine_models?.name ?? o.machine_type)}<div class="small muted">${esc(o.capacity)}</div>` },
  { h: "สถานะ", f: (o) => pill(o.status) }, { h: "โรงงาน", f: (o) => esc(o.factories?.name ?? "-") }, { h: "สั่งเมื่อ", f: (o) => dateTH(o.created_at) },
];
const goOrder = (o) => `#/order/${o.order_id}`;

/* ---------------- Dashboard ---------------- */
route(/^\/dashboard$/, async (el) => {
  const [orders, pays, pend, quotes, aps, rules] = await Promise.all([
    fetchOrders(null),
    db.from("payments").select("pay_type, order_id, paid_at").eq("verified", false).then(must),
    db.from("factory_assignments").select("order_id, sent_at").eq("response", "pending").then(must),
    db.from("quotations").select("order_id, valid_until").eq("status", "sent").then(must),
    db.from("appointments").select("order_id, status").eq("status", "scheduled").then(must),
    db.from("business_rules").select("rule_key, value").then(must),
  ]);
  const rule = Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)]));
  const by = (...s) => orders.filter((o) => s.includes(o.status));
  const cnt = (...s) => by(...s).length;
  const payN = (t) => pays.filter((p) => p.pay_type === t).length;
  const today = new Date(new Date().toDateString());
  const oMap = new Map(orders.map((o) => [o.order_id, o]));
  const scheduled = new Set(aps.map((a) => a.order_id));

  // KPI tiles follow the Figma dashboard
  const tiles = [
    ["New Order", cnt(0), "รอตรวจรายละเอียด", "#/orders/new", 1], ["Quotation", cnt(1), "รอออก / ตอบรับราคา", "#/orders/quotations"],
    ["Deposit", payN("deposit"), "รอตรวจมัดจำ", "#/payments/deposit", 1], ["Factory", cnt(2) + pend.length, "รอโรงงานรับงาน", "#/mfg/requests"],
    ["Production", cnt(4), "กำลังผลิต", "#/mfg/production"], ["QC/Rework", cnt(5, 6), cnt(6) ? `ต้องแก้ไข ${cnt(6)} รายการ` : "รอตรวจ QC", "#/mfg/qc", cnt(6)],
    ["Installation", cnt(7, 8), `นัดติดตั้งแล้ว ${cnt(8)} งาน`, "#/installation"], ["Customer Acceptance", cnt(9), "รอลูกค้าตรวจรับ", "#/installation"],
    ["Payment", payN("final"), "รอตรวจยอดสุดท้าย", "#/payments/final", 1], ["Completed", cnt(10), "ปิดงานแล้ว", "#/orders?status=10"],
  ];

  // task list: what the shop should do now, overdue first
  const tasks = [];
  const add = (o, title, who, href, btn, late, note) => tasks.push({ o, title, who, href, btn, late, note });
  by(0).forEach((o) => add(o, "ตรวจคำสั่งซื้อใหม่จากลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "ตรวจคำสั่งซื้อ"));
  quotes.forEach((q) => { const o = oMap.get(q.order_id); if (o?.status === 1 && new Date(q.valid_until) < today) add(o, "ใบเสนอราคาหมดอายุ ติดตามลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "เปิดออเดอร์", 1, `หมดอายุ ${dateTH(q.valid_until)}`); });
  pays.forEach((p) => { const o = oMap.get(p.order_id); if (!o) return;
    if (p.pay_type === "deposit") add(o, "ตรวจหลักฐานชำระมัดจำ", o.customers?.name, "#/payments/deposit", "ตรวจมัดจำ", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "final") add(o, "ตรวจยอดสุดท้ายและออกใบเสร็จ", o.customers?.name, "#/payments/final", "ตรวจยอดสุดท้าย", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "refund") add(o, "โอนคืนมัดจำให้ลูกค้า", o.customers?.name, "#/payments/refund", "คืนเงิน", 0, dateTH(p.paid_at, true)); });
  by(2).forEach((o) => add(o, "ส่งคำสั่งผลิตให้โรงงาน", o.customers?.name, `#/order/${o.order_id}`, "ส่งโรงงาน"));
  pend.forEach((a) => { const o = oMap.get(a.order_id); if (!o) return; const d = daysAgo(a.sent_at);
    add(o, "ติดตามโรงงานตอบรับ", o.factories?.name, "#/mfg/requests", "บันทึกคำตอบ", d > rule.factory_reply_days, d > rule.factory_reply_days ? `เกินกำหนด ${Math.floor(d - rule.factory_reply_days)} วัน` : `ส่งเมื่อ ${dateTH(a.sent_at, true)}`); });
  by(4).forEach((o) => { if (o.est_finish_date && new Date(o.est_finish_date) < today) add(o, "การผลิตเลยกำหนด ติดตามโรงงาน", o.factories?.name, `#/order/${o.order_id}`, "อัปเดตการผลิต", 1, `เลยกำหนด ${dateTH(o.est_finish_date)}`); });
  by(5).forEach((o) => add(o, "ตรวจ QC เครื่องที่ผลิตเสร็จ", o.factories?.name, `#/order/${o.order_id}`, "ตรวจ QC"));
  by(6).forEach((o) => add(o, "ติดตามงาน QC ที่ต้องแก้ไข", o.factories?.name, `#/order/${o.order_id}`, "ติดตาม QC", 1));
  by(7).forEach((o) => add(o, "นัดวันติดตั้งกับลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "นัดติดตั้ง"));
  by(8).forEach((o) => { if (!scheduled.has(o.order_id)) add(o, "ลูกค้าขอนัดติดตั้งใหม่", o.customers?.name, `#/order/${o.order_id}`, "นัดติดตั้ง", 1); });
  tasks.sort((x, y) => (y.late ? 1 : 0) - (x.late ? 1 : 0));
  const lateN = tasks.filter((x) => x.late).length;
  const stages = [["New Order", cnt(0)], ["Quotation", cnt(1)], ["Deposit", payN("deposit")], ["Factory", cnt(2) + pend.length], ["Production", cnt(4)],
    ["QC/Rework", cnt(5, 6)], ["Installation", cnt(7, 8)], ["Customer Acceptance", cnt(9)], ["Payment", payN("final")], ["Completed", cnt(10)]];
  const max = Math.max(1, ...stages.map((s) => s[1]));
  const active = orders.filter((o) => ![10, 99].includes(o.status)).length;
  const hour = new Date().getHours();

  el.innerHTML = `<div class="head"><div><h1>สวัสดี ${esc(window.ME?.name)}</h1><div class="muted">ภาพรวมคำสั่งซื้อและงานที่ต้องดูแล · ${new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</div></div></div>
    <h2>ภาพรวมทุกขั้นตอน</h2>
    <div class="kpis">${tiles.map(([t, n, l, h, hot]) => `<a class="kpi ${hot && n ? "hot" : ""}" href="${h}"><div class="t">${t}</div><div class="n">${n}</div><div class="l">${l}</div></a>`).join("")}</div>
    <div class="grid cols-main">
      <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">งานที่ต้องทำ</h2>
        <span class="pill ${lateN ? "bad" : ""}">${tasks.length} งาน${lateN ? ` · เกินกำหนด ${lateN}` : ""}</span></div>
        <div style="margin-top:14px">${tasks.length ? tasks.slice(0, 10).map((x) => `<div class="task ${x.late ? "late" : ""}"><div><div class="ti">${x.title}</div>
          <div class="s mono">${orderLink(x.o)} · ${esc(x.who ?? "")}${x.note ? ` · <b>${esc(x.note)}</b>` : ""}</div></div><a class="btn ghost sm" href="${x.href}">${x.btn}</a></div>`).join("") + (tasks.length > 10 ? `<div class="small muted">และอีก ${tasks.length - 10} งาน</div>` : "")
          : `<div class="empty">ไม่มีงานค้าง 🎉</div>`}</div></div>
      <div class="card"><h2>Order pipeline</h2><div class="small muted" style="margin:-6px 0 8px">ครบทุกขั้นตอน ตั้งแต่รับคำสั่งซื้อจนปิดงาน</div>
        ${stages.map(([l, n]) => `<div class="bar"><span class="lab">${l}</span><span class="track"><span class="fill" style="width:${(n / max) * 100}%"></span></span><span class="v">${n}</span></div>`).join("")}
        <div class="small muted" style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">${active} งานกำลังดำเนินการ · ${cnt(10)} งานเสร็จสิ้น · ${cnt(99)} ยกเลิก</div></div>
    </div>`;
});

/* ---------------- Orders ---------------- */
async function ordersPage(el, title, sub, statuses, withStatusFilter) {
  const p = hashParams().get("status");
  const all = await fetchOrders(statuses ?? (p ? [Number(p)] : null));
  el.innerHTML = head(title, sub) + `<div class="card"><div class="filters">
      <input id="q" placeholder="ค้นหา: เลข order / ชื่อ / เบอร์">
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
route(/^\/orders$/, (el) => ordersPage(el, "All Orders", "ออเดอร์ทั้งหมด", null, true));
route(/^\/orders\/new$/, (el) => ordersPage(el, "New Orders", "ตรวจคำสั่งซื้อใหม่ แล้วออกใบเสนอราคา", [0]));
route(/^\/orders\/cancelled$/, (el) => ordersPage(el, "Cancelled", "ออเดอร์ที่ยกเลิก", [99]));

route(/^\/orders\/quotations$/, async (el) => {
  const rows = must(await db.from("quotations").select("quotation_id, order_id, total_price, deposit_amount, valid_until, status, created_at, orders(order_code, status, customers(name))").order("created_at", { ascending: false }).limit(500));
  const today = new Date(new Date().toDateString());
  const st = (q) => q.status === "sent" && new Date(q.valid_until) < today ? `<span class="pill bad">หมดอายุ</span>` :
    ({ sent: `<span class="pill warn">รอลูกค้า</span>`, accepted: `<span class="pill ok">ลูกค้ายืนยัน</span>`, rejected: `<span class="pill bad">ปฏิเสธ</span>`, expired: `<span class="pill bad">หมดอายุ</span>` })[q.status];
  el.innerHTML = head("Quotations", "ใบเสนอราคาที่ออกแล้ว") + `<div class="card">${table([
    { h: "Order", f: (q) => `<a class="mono" href="#/order/${q.order_id}"><b>${esc(q.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (q) => esc(q.orders?.customers?.name) },
    { h: "รวม (บาท)", f: (q) => baht(q.total_price) }, { h: "มัดจำ", f: (q) => baht(q.deposit_amount) },
    { h: "ใช้ได้ถึง", f: (q) => dateTH(q.valid_until) }, { h: "สถานะใบเสนอราคา", f: st }, { h: "ออกเมื่อ", f: (q) => dateTH(q.created_at) },
  ], rows, (q) => `#/order/${q.order_id}`)}</div>`;
});

/* ---------------- Manufacturing ---------------- */
route(/^\/mfg\/requests$/, async (el) => {
  const [orders, asg] = await Promise.all([
    fetchOrders([2, 3]),
    db.from("factory_assignments").select("assignment_id, order_id, response, reject_reason, sent_at, responded_at, factories(name), orders(order_code, customers(name))").order("sent_at", { ascending: false }).limit(300).then(must),
  ]);
  const latest = new Map();
  asg.forEach((a) => { if (!latest.has(a.order_id)) latest.set(a.order_id, a); });
  const toSend = orders.filter((o) => o.status === 2 || (o.status === 3 && latest.get(o.order_id)?.response === "rejected"));
  const waiting = orders.filter((o) => o.status === 3 && latest.get(o.order_id)?.response === "pending");
  const sendCols = [...ORDER_COLS.slice(0, 2), { h: "หมายเหตุ", f: (o) => o.status === 3 ? `<span class="pill bad">${esc(latest.get(o.order_id).factories?.name)} ปฏิเสธ: ${esc(latest.get(o.order_id).reject_reason)}</span>` : "ชำระมัดจำแล้ว" },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 3 ? "เลือกโรงงานใหม่" : "ส่งโรงงาน"}</a>` }];
  const waitCols = [...ORDER_COLS.slice(0, 2), { h: "โรงงาน", f: (o) => esc(o.factories?.name) },
    { h: "ส่งเมื่อ", f: (o) => `${dateTH(o.sent_at, true)}${daysAgo(o.sent_at) > 3 ? ` <span class="pill bad">เกิน 3 วัน</span>` : ""}` },
    { h: "บันทึกคำตอบแทนโรงงาน", f: (o) => `<button class="btn sm green" data-act="accept" data-o="${o.order_id}">รับผลิต</button> <button class="btn sm red" data-act="reject" data-o="${o.order_id}">ปฏิเสธ</button>` }];
  el.innerHTML = head("Factory Requests", "ส่งคำสั่งผลิตและบันทึกคำตอบของโรงงาน (ร้านบันทึกแทนโรงงาน)") +
    `<div class="card"><h2>รอส่งโรงงาน / ต้องเลือกโรงงานใหม่ (${toSend.length})</h2>${table(sendCols, toSend, goOrder)}</div>
     <div class="card"><h2>รอโรงงานตอบ (${waiting.length})</h2>${table(waitCols, waiting)}</div>
     <div class="card"><h2>ประวัติคำสั่งผลิต</h2>${table([
       { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "โรงงาน", f: (a) => esc(a.factories?.name) },
       { h: "ส่งเมื่อ", f: (a) => dateTH(a.sent_at, true) },
       { h: "ผล", f: (a) => ({ pending: `<span class="pill warn">รอตอบ</span>`, accepted: `<span class="pill ok">รับผลิต</span>`, rejected: `<span class="pill bad">ปฏิเสธ</span>` })[a.response] },
       { h: "เหตุผล / ตอบเมื่อ", f: (a) => `${esc(a.reject_reason ?? "")}<div class="small muted">${dateTH(a.responded_at, true)}</div>` },
     ], asg)}</div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const oid = Number(b.dataset.o);
    if (b.dataset.act === "accept") {
      try { await rpc("staff_factory_response", { p_order: oid, p_accept: true }, "บันทึกว่าโรงงานรับผลิตแล้ว"); navigate(); } catch (er) { toast(errText(er), true); }
    } else {
      const done = await modal("โรงงานปฏิเสธ", `<label>เหตุผลที่โรงงานปฏิเสธ</label><textarea id="r" rows="3"></textarea>`, { ok: "บันทึก",
        onOk: async (m) => { await rpc("staff_factory_response", { p_order: oid, p_accept: false, p_reason: $("#r", m).value }, "บันทึกการปฏิเสธแล้ว"); } });
      if (done) navigate();
    }
  };
});

route(/^\/mfg\/production$/, async (el) => {
  const [orders, ups] = await Promise.all([fetchOrders([3, 4]),
    db.from("production_updates").select("order_id, stage, est_finish_date, note, created_at, orders(order_code)").order("created_at", { ascending: false }).limit(50).then(must)]);
  const rows = orders.filter((o) => o.status === 4 || o.status === 3);
  const late = (o) => o.status === 4 && o.est_finish_date && new Date(o.est_finish_date) < new Date(new Date().toDateString());
  el.innerHTML = head("Production", "ติดตามการผลิตและวันเสร็จโดยประมาณ") + `<div class="card"><h2>งานผลิต (${rows.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "โรงงาน", f: (o) => esc(o.factories?.name) },
    { h: "สถานะ", f: (o) => o.status === 3 ? `<span class="pill warn">รอเริ่มผลิต / รอโรงงานตอบ</span>` : `<span class="pill">กำลังผลิต</span>` },
    { h: "เสร็จโดยประมาณ", f: (o) => `${dateTH(o.est_finish_date)}${late(o) ? ` <span class="pill bad">เลยกำหนด</span>` : ""}` },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">จัดการ</a>` },
  ], rows, goOrder)}</div>
  <div class="card"><h2>อัปเดตล่าสุด</h2>${table([
    { h: "Order", f: (u) => esc(u.orders?.order_code) }, { h: "ขั้น", f: (u) => esc({ started: "เริ่มผลิต", in_progress: "กำลังผลิต", finished: "ผลิตเสร็จ", delayed: "ล่าช้า" }[u.stage]) },
    { h: "ETA", f: (u) => dateTH(u.est_finish_date) }, { h: "หมายเหตุ", f: (u) => esc(u.note ?? "") }, { h: "เมื่อ", f: (u) => dateTH(u.created_at, true) },
  ], ups)}</div>`;
});

route(/^\/mfg\/qc$/, async (el) => {
  const [orders, res] = await Promise.all([fetchOrders([5, 6]),
    db.from("qc_results").select("order_id, round_no, passed, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(1000).then(must)]);
  const g = new Map();
  res.forEach((r) => { const k = r.order_id + "-" + r.round_no; const x = g.get(k) ?? { ...r, pass: 0, fail: 0 }; r.passed ? x.pass++ : x.fail++; g.set(k, x); });
  el.innerHTML = head("QC", "ตรวจคุณภาพก่อนนัดติดตั้ง") + `<div class="card"><h2>รอตรวจ / รอแก้ไข (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "สถานะ", f: (o) => pill(o.status) }, { h: "โรงงาน", f: (o) => esc(o.factories?.name) },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 5 ? "ตรวจ QC" : "ดูผลตรวจ"}</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>ประวัติการตรวจ</h2>${table([
    { h: "Order", f: (r) => `<a class="mono" href="#/order/${r.order_id}">${esc(r.orders?.order_code)}</a>` }, { h: "ลูกค้า", f: (r) => esc(r.orders?.customers?.name) },
    { h: "รอบ", f: (r) => r.round_no }, { h: "ผล", f: (r) => r.fail ? `<span class="pill bad">ไม่ผ่าน ${r.fail} หัวข้อ</span>` : `<span class="pill ok">ผ่านทั้งหมด</span>` },
    { h: "ตรวจเมื่อ", f: (r) => dateTH(r.checked_at, true) },
  ], [...g.values()])}</div>`;
});

/* ---------------- Installation + customer acceptance ---------------- */
route(/^\/installation$/, async (el) => {
  const [orders, ap, ac] = await Promise.all([fetchOrders([7, 8, 9]),
    db.from("appointments").select("order_id, install_datetime, status, reschedule_count").order("created_at", { ascending: false }).then(must),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(200).then(must)]);
  const lastAp = new Map(), lastAc = new Map();
  ap.forEach((a) => { if (!lastAp.has(a.order_id)) lastAp.set(a.order_id, a); });
  ac.forEach((a) => { if (!lastAc.has(a.order_id)) lastAc.set(a.order_id, a); });
  const need = (o) => o.status === 7 ? "รอนัดวัน" : o.status === 8 && lastAp.get(o.order_id)?.status !== "scheduled" ? "ลูกค้าขอนัดใหม่" : o.status === 8 ? "รอวันติดตั้ง / ยืนยันติดตั้ง" : "รอลูกค้าตรวจรับและชำระ";
  el.innerHTML = head("Installation", "นัดวันติดตั้ง เลื่อนวัน และดูผลตรวจรับของลูกค้า (การติดตั้งทำโดยโรงงาน)") + `<div class="card"><h2>งานติดตั้ง (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "สถานะ", f: (o) => pill(o.status) },
    { h: "วันนัด", f: (o) => { const a = lastAp.get(o.order_id); return a ? `${dateTH(a.install_datetime, true)}<div class="small muted">${esc(a.status)}${a.reschedule_count ? ` · เลื่อน ${a.reschedule_count} ครั้ง` : ""}</div>` : "-"; } },
    { h: "ต้องทำ", f: (o) => `<span class="pill ${need(o) === "ลูกค้าขอนัดใหม่" ? "bad" : "warn"}">${need(o)}</span>` },
    { h: "ผลตรวจรับล่าสุด", f: (o) => { const c = lastAc.get(o.order_id); return c ? (c.passed ? `<span class="pill ok">ผ่าน</span>` : `<span class="pill bad">ไม่ผ่าน</span> ${esc(c.note)}`) : "-"; } },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">จัดการ</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>Customer Acceptance</h2>${table([
    { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "ลูกค้า", f: (a) => esc(a.orders?.customers?.name) },
    { h: "ผล", f: (a) => a.passed ? `<span class="pill ok">ตรวจรับผ่าน</span>` : `<span class="pill bad">พบปัญหา</span>` },
    { h: "ปัญหาที่แจ้ง", f: (a) => esc(a.note ?? "") }, { h: "เมื่อ", f: (a) => dateTH(a.checked_at, true) },
  ], ac)}</div>`;
});

/* ---------------- Payments: deposit / final / refund ---------------- */
const PAY_TITLE = { deposit: "Deposit", final: "Final Payment", refund: "Refund" };
route(/^\/payments\/(deposit|final|refund)$/, async (el, [type]) => {
  const rows = must(await db.from("payments").select("*, orders(order_code, status, customers(name))").eq("pay_type", type).order("paid_at", { ascending: false }).limit(300));
  const sel = hashParams().get("show") ?? "pending";
  const shown = rows.filter((p) => sel === "all" || (sel === "pending") === !p.verified);
  const method = { qr: "QR", transfer: "โอน", cash: "เงินสด" };
  el.innerHTML = head(PAY_TITLE[type], { deposit: "ตรวจสลิปมัดจำ", final: "ตรวจยอดสุดท้ายและออกใบเสร็จ", refund: "คืนมัดจำให้ลูกค้าที่ยกเลิก" }[type]) +
    `<div class="card"><div class="filters"><select id="sh"><option value="pending">รอดำเนินการ</option><option value="done">ดำเนินการแล้ว</option><option value="all">ทั้งหมด</option></select></div>${table([
      { h: "Order", f: (p) => `<a class="mono" href="#/order/${p.order_id}"><b>${esc(p.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (p) => esc(p.orders?.customers?.name) },
      { h: "จำนวน (บาท)", f: (p) => baht(p.amount) },
      ...(type === "refund" ? [{ h: "บัญชีลูกค้า", f: (p) => esc(p.refund_account ?? "— ยังไม่ระบุ") }] : [{ h: "วิธีชำระ", f: (p) => esc(method[p.payment_method] ?? "-") }]),
      { h: "สลิป", f: (p) => p.slip_path ? `<button class="btn sm ghost" data-act="slip" data-p="${p.payment_id}">ดู</button>` : "-" },
      { h: "สถานะ", f: (p) => p.verified ? `<span class="pill ok">${type === "refund" ? "โอนคืนแล้ว" : "ตรวจแล้ว"}</span>${p.receipt_no ? `<div class="small mono">${esc(p.receipt_no)}</div>` : ""}` : `<span class="pill warn">รอดำเนินการ</span>` },
      { h: "เมื่อ", f: (p) => dateTH(p.paid_at, true) },
      { h: "", f: (p) => p.verified ? "" : type === "refund"
        ? `<button class="btn sm green" data-act="refund" data-p="${p.payment_id}">คืนเงิน</button>`
        : `<button class="btn sm green" data-act="ok" data-p="${p.payment_id}">อนุมัติ</button> <button class="btn sm red" data-act="no" data-p="${p.payment_id}">ปฏิเสธ</button>` },
    ], shown)}</div>`;
  $("#sh").value = sel; $("#sh").onchange = () => { location.hash = `#/payments/${type}?show=${$("#sh").value}`; };
  const byId = new Map(rows.map((p) => [String(p.payment_id), p]));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = byId.get(b.dataset.p), act = b.dataset.act;
    const after = () => { refreshCounts(); navigate(); };
    if (act === "slip") return showSlip(p.slip_path);
    if (act === "ok") {
      try { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: true }, type === "final" ? "อนุมัติแล้ว ออกใบเสร็จ งานเสร็จสิ้น" : "อนุมัติมัดจำแล้ว"); after(); } catch (er) { toast(errText(er), true); }
    } else if (act === "no") {
      if (await modal("ปฏิเสธหลักฐานการชำระ", `<label>เหตุผล (ลูกค้าจะได้รับแจ้งเตือน)</label><textarea id="r" rows="3"></textarea>`, { ok: "ปฏิเสธ",
        onOk: async (m) => { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: false, p_reason: $("#r", m).value }, "ปฏิเสธแล้ว แจ้งลูกค้าให้ส่งใหม่"); } })) after();
    } else if (act === "refund") {
      if (await modal("โอนคืนมัดจำ", `<p>คืน <b>${baht(p.amount)} บาท</b> ให้ ${esc(p.orders?.customers?.name)}</p><label>บัญชีลูกค้า</label><input id="a" value="${esc(p.refund_account ?? "")}"><label style="margin-top:10px">สลิปการโอนคืน</label><input id="f" type="file" accept="image/*">`, { ok: "ยืนยันโอนคืนแล้ว",
        onOk: async (m) => {
          const f = $("#f", m).files[0]; if (!f) throw new Error("กรุณาแนบสลิปการโอนคืน");
          const path = await uploadSlip(f, `refund-${p.payment_id}`);
          await rpc("staff_confirm_refund", { p_payment: p.payment_id, p_account: $("#a", m).value, p_slip: path }, "บันทึกการคืนเงินแล้ว");
        } })) after();
    }
  };
});
