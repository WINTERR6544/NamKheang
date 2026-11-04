// Sidebar: Dashboard
route(/^\/dashboard$/, async (el) => {
  const [orders, pays, pend, quotes, aps, rules, accs, qcr, qcv, cmoves] = await Promise.all([
    fetchOrders(null),
    db.from("payments").select("pay_type, order_id, paid_at").eq("verified", false).then(must),
    db.from("factory_assignments").select("order_id, sent_at").eq("response", "pending").then(must),
    db.from("quotations").select("order_id, valid_until").eq("status", "sent").then(must),
    db.from("appointments").select("order_id, status").eq("status", "scheduled").then(must),
    db.from("business_rules").select("rule_key, value").then(must),
    db.from("acceptance_checks").select("order_id, passed, forwarded_at, checked_at").order("checked_at", { ascending: false }).limit(500).then(must),
    db.from("qc_results").select("order_id, round_no").eq("stage", "production").order("round_no", { ascending: false }).limit(2000).then(must),
    db.from("qc_reviews").select("order_id, round_no").then(must),
    db.from("customer_reschedule_requests").select("order_id, preferred_datetime").eq("status", "pending").then(must),
  ]);
  // QC rounds the factory recorded that the shop has not reviewed yet (UC7)
  const lastRound = new Map(); qcr.forEach((r) => { if (!lastRound.has(r.order_id)) lastRound.set(r.order_id, r.round_no); });
  const reviewed = new Set(qcv.map((r) => r.order_id + ":" + r.round_no));
  const needsReview = (o) => o.status === 5 && lastRound.has(o.order_id) && !reviewed.has(o.order_id + ":" + lastRound.get(o.order_id));
  const rule = Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)]));
  const lastAcc = new Map(); accs.forEach((a) => { if (!lastAcc.has(a.order_id)) lastAcc.set(a.order_id, a); }); // newest customer check per order
  const by = (...s) => orders.filter((o) => s.includes(o.status));
  const cnt = (...s) => by(...s).length;
  const payN = (t) => pays.filter((p) => p.pay_type === t).length;
  const today = new Date(new Date().toDateString());
  const oMap = new Map(orders.map((o) => [o.order_id, o]));
  const scheduled = new Set(aps.map((a) => a.order_id));

  // KPI tiles follow the Figma dashboard
  const tiles = [
    ["คำสั่งซื้อใหม่", cnt(0), "ตรวจรายละเอียด", "#/orders/new", 1], ["ใบเสนอราคา", cnt(1), "รอลูกค้าตอบกลับ", "#/orders/quotations"],
    ["มัดจำ", payN("deposit"), "สลิปรอตรวจ", "#/payments/deposit", 1], ["โรงงาน", cnt(2) + pend.length, "รอส่ง / รอโรงงานตอบรับ", "#/mfg/requests"],
    ["การผลิต", cnt(4), "กำลังผลิต", "#/mfg/status"], ["QC / แก้ไข", cnt(5, 6), cnt(6) ? `ต้องแก้ไข ${cnt(6)} รายการ` : "รอตรวจ QC", "#/mfg/status", cnt(6)],
    ["การติดตั้ง", cnt(7, 8), `นัดแล้ว ${cnt(8)} รายการ`, "#/installation"], ["ตรวจรับ", cnt(9), "รอลูกค้าตรวจรับ", "#/installation"],
    ["ยอดคงเหลือ", payN("final"), "สลิปยอดคงเหลือรอตรวจ", "#/payments/final", 1], ["เสร็จสมบูรณ์", cnt(10), "ปิดงานแล้ว", "#/orders?status=10"],
  ];

  // task list: what the shop should do now, overdue first
  const tasks = [];
  const add = (o, title, who, href, btn, late, note) => tasks.push({ o, title, who, href, btn, late, note });
  by(0).forEach((o) => add(o, "ตรวจคำสั่งซื้อใหม่จากลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "ตรวจคำสั่งซื้อ"));
  // an unanswered quote is cancelled by the system after its valid-until date (nightly job), so warn before that
  quotes.forEach((q) => { const o = oMap.get(q.order_id); if (o?.status !== 1) return;
    const left = Math.round((new Date(q.valid_until) - today) / 86400000);
    if (left < 0) add(o, "ใบเสนอราคาหมดอายุ ระบบจะยกเลิกคำสั่งซื้ออัตโนมัติคืนนี้", o.customers?.name, `#/order/${o.order_id}`, "เปิดคำสั่งซื้อ", 1, `หมดอายุ ${dateTH(q.valid_until)}`);
    else if (left <= 2) add(o, "ใบเสนอราคาใกล้หมดอายุ ติดตามลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "เปิดคำสั่งซื้อ", 0, left === 0 ? "หมดอายุวันนี้" : `หมดอายุในอีก ${left} วัน`); });
  pays.forEach((p) => { const o = oMap.get(p.order_id); if (!o) return;
    if (p.pay_type === "deposit") add(o, "ตรวจสลิปมัดจำ", o.customers?.name, "#/payments/deposit", "ตรวจมัดจำ", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "final") add(o, "ตรวจยอดคงเหลือและออกใบเสร็จ", o.customers?.name, "#/payments/final", "ตรวจยอดคงเหลือ", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "refund") add(o, "โอนคืนเงินมัดจำให้ลูกค้า", o.customers?.name, "#/payments/refund", "คืนเงิน", 0, dateTH(p.paid_at, true)); });
  by(2).forEach((o) => add(o, "ส่งคำสั่งผลิตให้โรงงาน", o.customers?.name, `#/order/${o.order_id}`, "ส่งให้โรงงาน"));
  pend.forEach((a) => { const o = oMap.get(a.order_id); if (!o) return; const d = daysAgo(a.sent_at);
    add(o, "ติดตามการตอบรับจากโรงงาน", o.factories?.name, "#/mfg/requests", "ดู", d > rule.factory_reply_days, d > rule.factory_reply_days ? `เลยกำหนด ${Math.floor(d - rule.factory_reply_days)} วัน` : `ส่งเมื่อ ${dateTH(a.sent_at, true)}`); });
  by(4).forEach((o) => { if (o.est_finish_date && new Date(o.est_finish_date) < today) add(o, "ผลิตเลยกำหนด ติดตามโรงงาน", o.factories?.name, `#/order/${o.order_id}`, "ดูสถานะ", 1, `กำหนดเดิม ${dateTH(o.est_finish_date)}`); });
  by(5).forEach((o) => needsReview(o)
    ? add(o, `ตรวจผล QC ของโรงงาน (รอบ ${lastRound.get(o.order_id)})`, o.factories?.name, `#/order/${o.order_id}`, "ตรวจผล QC", 1)
    : add(o, "รอโรงงานตรวจ QC เครื่องที่ผลิตเสร็จ", o.factories?.name, `#/order/${o.order_id}`, "ดูสถานะ"));
  by(6).forEach((o) => add(o, "ติดตามการแก้ไขตามผล QC", o.factories?.name, `#/order/${o.order_id}`, "ติดตาม", 1));
  by(7).forEach((o) => add(o, "นัดวันติดตั้งกับลูกค้า", o.customers?.name, `#/order/${o.order_id}`, "นัดติดตั้ง"));
  by(8).forEach((o) => { if (!scheduled.has(o.order_id)) add(o, "ลูกค้าขอวันติดตั้งใหม่", o.customers?.name, `#/order/${o.order_id}`, "นัดติดตั้ง", 1); });
  cmoves.forEach((m) => { const o = oMap.get(m.order_id); if (o?.status === 8) add(o, "ลูกค้าขอเลื่อนวันติดตั้ง", o.customers?.name, `#/order/${o.order_id}`, "ตอบคำขอ", 1, `ต้องการ ${dateTH(m.preferred_datetime, true)}`); });
  // customer -> shop -> factory: a problem reported after the install
  by(9).forEach((o) => { const a = lastAcc.get(o.order_id); if (!a || a.passed) return;
    if (a.forwarded_at) add(o, "ส่งปัญหาให้โรงงานแล้ว นัดเข้าแก้ไข", o.customers?.name, `#/order/${o.order_id}`, "นัดเข้าแก้ไข", 0, `ส่งเมื่อ ${dateTH(a.forwarded_at, true)}`);
    else add(o, "ลูกค้าแจ้งปัญหา ส่งต่อให้โรงงาน", o.customers?.name, `#/order/${o.order_id}`, "เปิดคำสั่งซื้อ", 1, dateTH(a.checked_at, true)); });
  tasks.sort((x, y) => (y.late ? 1 : 0) - (x.late ? 1 : 0));
  const lateN = tasks.filter((x) => x.late).length;
  const stages = [["คำสั่งซื้อใหม่", cnt(0)], ["ใบเสนอราคา", cnt(1)], ["มัดจำ", payN("deposit")], ["โรงงาน", cnt(2) + pend.length], ["การผลิต", cnt(4)],
    ["QC / แก้ไข", cnt(5, 6)], ["การติดตั้ง", cnt(7, 8)], ["ตรวจรับ", cnt(9)], ["ยอดคงเหลือ", payN("final")], ["เสร็จสมบูรณ์", cnt(10)]];
  const max = Math.max(1, ...stages.map((s) => s[1]));
  const active = orders.filter((o) => ![10, 99].includes(o.status)).length;
  const hour = new Date().getHours();

  el.innerHTML = `<div class="head"><div><h1>สวัสดี ${esc(window.ME?.name)}</h1><div class="muted">ภาพรวมคำสั่งซื้อและงานที่ต้องทำ · ${new Date().toLocaleDateString("th-TH", { dateStyle: "full" })}</div></div></div>
    <h2>ภาพรวมทุกขั้นตอน</h2>
    <div class="kpis">${tiles.map(([t, n, l, h, hot]) => `<a class="kpi ${hot && n ? "hot" : ""}" href="${h}"><div class="t">${t}</div><div class="n">${n}</div><div class="l">${l}</div></a>`).join("")}</div>
    <div class="grid cols-main">
      <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">งานที่ต้องทำ</h2>
        <span class="pill ${lateN ? "bad" : ""}">${tasks.length} งาน${lateN ? ` · เลยกำหนด ${lateN}` : ""}</span></div>
        <div style="margin-top:14px">${tasks.length ? tasks.slice(0, 10).map((x) => `<div class="task ${x.late ? "late" : ""}"><div><div class="ti">${x.title}</div>
          <div class="s mono">${orderLink(x.o)} · ${esc(x.who ?? "")}${x.note ? ` · <b>${esc(x.note)}</b>` : ""}</div></div><a class="btn ghost sm" href="${x.href}">${x.btn}</a></div>`).join("") + (tasks.length > 10 ? `<div class="small muted">และอีก ${tasks.length - 10} งาน</div>` : "")
          : `<div class="empty">ไม่มีงานค้าง 🎉</div>`}</div></div>
      <div class="card"><h2>คำสั่งซื้อตามขั้นตอน</h2><div class="small muted" style="margin:-6px 0 8px">ตั้งแต่รับคำสั่งซื้อจนปิดงาน</div>
        ${stages.map(([l, n]) => `<div class="bar"><span class="lab">${l}</span><span class="track"><span class="fill" style="width:${(n / max) * 100}%"></span></span><span class="v">${n}</span></div>`).join("")}
        <div class="small muted" style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">กำลังดำเนินการ ${active} · เสร็จสมบูรณ์ ${cnt(10)} · ยกเลิก ${cnt(99)}</div></div>
    </div>`;
});
