// Sidebar: Installation (install dates, the factory's on-site QC, and the customer's acceptance results.
// A problem goes customer -> shop -> factory: the shop forwards it and books a fix visit from the order page)
route(/^\/installation$/, async (el) => {
  const [orders, ap, ac, qc, moves, cmoves] = await Promise.all([fetchOrders([7, 8, 9]),
    db.from("install_reschedule_requests").select("request_id, order_id, proposed_datetime, reason, status, created_at, resolved_at, appointments(install_datetime), orders(order_code, customers(name))").order("created_at", { ascending: false }).limit(100).then(must),
    db.from("appointments").select("order_id, install_datetime, status, reschedule_count").order("created_at", { ascending: false }).then(must),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, forwarded_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(200).then(must),
    db.from("qc_results").select("order_id, round_no, passed").eq("stage", "onsite").order("checked_at", { ascending: false }).limit(500).then(must),
    db.from("customer_reschedule_requests").select("request_id, order_id, preferred_datetime, reason, status, created_at, resolved_at, appointments(install_datetime), orders(order_code, customers(name))").order("created_at", { ascending: false }).limit(100).then(must)]);
  const lastAp = new Map(), lastAc = new Map(), onsite = new Map(); // onsite: newest on-site QC round per order
  ap.forEach((a) => { if (!lastAp.has(a.order_id)) lastAp.set(a.order_id, a); });
  ac.forEach((a) => { if (!lastAc.has(a.order_id)) lastAc.set(a.order_id, a); });
  qc.forEach((r) => { const x = onsite.get(r.order_id); if (!x || r.round_no > x.round_no) onsite.set(r.order_id, { round_no: r.round_no, fail: 0 }); if (!r.passed && onsite.get(r.order_id).round_no === r.round_no) onsite.get(r.order_id).fail++; });
  const problem = (o) => o.status === 9 && lastAc.get(o.order_id) && !lastAc.get(o.order_id).passed;
  const need = (o) => o.status === 7 ? "ต้องนัดวันติดตั้ง" : o.status === 8 && lastAp.get(o.order_id)?.status !== "scheduled" ? "ลูกค้าขอวันนัดใหม่"
    : o.status === 8 ? "รอวันติดตั้ง / รอโรงงานยืนยัน" : problem(o) ? (lastAc.get(o.order_id).forwarded_at ? "ส่งปัญหาให้โรงงานแล้ว · นัดเข้าแก้ไข" : "ลูกค้าแจ้งปัญหา · ติดต่อโรงงาน") : "รอลูกค้าตรวจรับและชำระยอดคงเหลือ";
  const pending = moves.filter((m) => m.status === "pending"), byId = new Map(pending.map((m) => [String(m.request_id), m]));
  const movesCard = `<div class="card"><h2>คำขอเลื่อนนัดจากโรงงาน (รอ ${pending.length} รายการ)</h2>${table([
    { h: "คำสั่งซื้อ", f: (m) => `<a class="mono" href="#/order/${m.order_id}"><b>${esc(m.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (m) => esc(m.orders?.customers?.name) },
    { h: "วันนัดเดิม", f: (m) => m.appointments?.install_datetime ? dateTH(m.appointments.install_datetime, true) : "-" },
    { h: "โรงงานขอเป็น", f: (m) => `<b>${dateTH(m.proposed_datetime, true)}</b>` }, { h: "เหตุผล", f: (m) => esc(m.reason) },
    { h: "สถานะ", f: (m) => m.status === "pending" ? `<span class="pill warn">รอร้านดำเนินการ</span>` : `<span class="pill ok">ดำเนินการแล้ว ${dateTH(m.resolved_at, true)}</span>` },
    { h: "", f: (m) => m.status === "pending" ? `<button class="btn sm green" data-mv="book" data-r="${m.request_id}">นัดตามวันนี้</button> <a class="btn sm ghost" href="#/order/${m.order_id}">เลือกวันอื่น</a>` : "" },
  ], moves.slice(0, 30))}</div>`;
  // UC8 alt: the customer can ask to move the date too
  const cpending = cmoves.filter((m) => m.status === "pending"), cById = new Map(cpending.map((m) => [String(m.request_id), m]));
  const cmovesCard = `<div class="card"><h2>คำขอเลื่อนนัดจากลูกค้า (รอ ${cpending.length} รายการ)</h2>${table([
    { h: "คำสั่งซื้อ", f: (m) => `<a class="mono" href="#/order/${m.order_id}"><b>${esc(m.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (m) => esc(m.orders?.customers?.name) },
    { h: "วันนัดเดิม", f: (m) => m.appointments?.install_datetime ? dateTH(m.appointments.install_datetime, true) : "-" },
    { h: "ลูกค้าขอเป็น", f: (m) => `<b>${dateTH(m.preferred_datetime, true)}</b>` }, { h: "เหตุผล", f: (m) => esc(m.reason) },
    { h: "สถานะ", f: (m) => m.status === "pending" ? `<span class="pill warn">รอร้านดำเนินการ</span>` : `<span class="pill ok">ดำเนินการแล้ว ${dateTH(m.resolved_at, true)}</span>` },
    { h: "", f: (m) => m.status === "pending" ? `<button class="btn sm green" data-cmv="book" data-r="${m.request_id}">นัดตามวันนี้</button> <a class="btn sm ghost" href="#/order/${m.order_id}">เลือกวันอื่น</a>` : "" },
  ], cmoves.slice(0, 30))}</div>`;
  el.innerHTML = head("การติดตั้ง", "นัดวันติดตั้งและนัดเข้าแก้ไข โรงงานเป็นผู้ติดตั้งและตรวจ QC หน้างาน จากนั้นลูกค้าตรวจรับหรือแจ้งปัญหาถึงร้าน") + movesCard + cmovesCard + `<div class="card"><h2>งานติดตั้ง (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "สถานะ", f: (o) => pill(o.status) },
    { h: "วันติดตั้ง", f: (o) => { const a = lastAp.get(o.order_id); return a ? `${dateTH(a.install_datetime, true)}<div class="small muted">${esc(a.status)}${a.reschedule_count ? ` · เลื่อนแล้ว ${a.reschedule_count} ครั้ง` : ""}</div>` : "-"; } },
    { h: "QC หน้างาน (โรงงาน)", f: (o) => { const q = onsite.get(o.order_id); return q ? `รอบ ${q.round_no}: ${q.fail ? `<span class="pill bad">ไม่ผ่าน ${q.fail} ข้อ</span>` : `<span class="pill ok">ผ่าน</span>`}` : `<span class="muted">-</span>`; } },
    { h: "สิ่งที่ต้องทำ", f: (o) => `<span class="pill ${need(o) === "ลูกค้าขอวันนัดใหม่" || problem(o) ? "bad" : "warn"}">${need(o)}</span>` },
    { h: "ผลตรวจรับล่าสุด (ลูกค้า)", f: (o) => { const c = lastAc.get(o.order_id); return c ? (c.passed ? `<span class="pill ok">ผ่าน</span>` : `<span class="pill bad">มีปัญหา</span> ${esc(c.note)}`) : "-"; } },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">จัดการ</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>ผลการตรวจรับของลูกค้า</h2>${table([
    { h: "คำสั่งซื้อ", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "ลูกค้า", f: (a) => esc(a.orders?.customers?.name) },
    { h: "ผล", f: (a) => a.passed ? `<span class="pill ok">ตรวจรับแล้ว</span>` : `<span class="pill bad">แจ้งปัญหา</span>` },
    { h: "ปัญหาที่แจ้ง", f: (a) => esc(a.note ?? "") },
    { h: "ส่งให้โรงงาน", f: (a) => a.passed ? "-" : a.forwarded_at ? `<span class="pill ok">${dateTH(a.forwarded_at, true)}</span>` : `<span class="pill warn">ยังไม่ส่ง</span>` },
    { h: "วันเวลา", f: (a) => dateTH(a.checked_at, true) },
  ], ac)}</div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-mv], [data-cmv]"); if (!b) return;
    const isCustomer = b.hasAttribute("data-cmv");
    const m = (isCustomer ? cById : byId).get(b.dataset.r); if (!m) return;
    b.disabled = true;
    const when = isCustomer ? m.preferred_datetime : m.proposed_datetime;
    try { await rpc("staff_schedule_install", { p_order: m.order_id, p_datetime: when, p_reason: `${isCustomer ? "ลูกค้า" : "โรงงาน"}ขอเลื่อน: ${m.reason}`.slice(0, 500) }, "บันทึกนัดแล้ว แจ้งลูกค้าและโรงงานเรียบร้อย"); refreshCounts(); navigate(); }
    catch (er) { b.disabled = false; toast(errText(er), true); }
  };
});
