// Sidebar: Manufacturing > Factory Requests
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
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 3 ? "เลือกโรงงานอื่น" : "ส่งให้โรงงาน"}</a>` }];
  const waitCols = [...ORDER_COLS.slice(0, 2), { h: "โรงงาน", f: (o) => esc(o.factories?.name) },
    { h: "ส่งเมื่อ", f: (o) => `${dateTH(o.sent_at, true)}${daysAgo(o.sent_at) > 3 ? ` <span class="pill bad">เกิน 3 วัน</span>` : ""}` },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">ดู</a>` }];
  el.innerHTML = head("คำขอผลิตถึงโรงงาน", "ส่งคำสั่งผลิตให้โรงงาน และติดตามการตอบรับ (โรงงานตอบในระบบของโรงงานเอง)") +
    `<div class="card"><h2>รอส่ง / ต้องเลือกโรงงานใหม่ (${toSend.length})</h2>${table(sendCols, toSend, goOrder)}</div>
     <div class="card"><h2>รอโรงงานตอบรับ (${waiting.length})</h2>${table(waitCols, waiting)}</div>
     <div class="card"><h2>ประวัติคำสั่งผลิต</h2>${table([
       { h: "คำสั่งซื้อ", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "โรงงาน", f: (a) => esc(a.factories?.name) },
       { h: "ส่งเมื่อ", f: (a) => dateTH(a.sent_at, true) },
       { h: "ผล", f: (a) => ({ pending: `<span class="pill warn">รอตอบรับ</span>`, accepted: `<span class="pill ok">ตอบรับแล้ว</span>`, rejected: `<span class="pill bad">ปฏิเสธ</span>` })[a.response] },
       { h: "เหตุผล / วันที่ตอบ", f: (a) => `${esc(a.reject_reason ?? "")}<div class="small muted">${dateTH(a.responded_at, true)}</div>` },
     ], asg)}</div>`;
});
