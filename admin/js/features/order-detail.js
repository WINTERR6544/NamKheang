// Sidebar: (opened from any order) the full order page: details, history and the shop's next step
route(/^\/order\/(\d+)$/, async (el, [id]) => {
  await loadFeature("order-actions");
  const d = await loadOrder(Number(id));
  const { o } = d;
  const reload = () => { refreshCounts(); navigate(); };
  const { panel, handle } = orderNext(d, reload);

  /* ----- detail cards ----- */
  const Q = d.quote;
  const card = (t, body) => `<div class="card"><h2>${t}</h2>${body}</div>`;
  const list = (rows, f) => rows.length ? `<ul style="padding-left:18px;margin:0;font-size:.88rem">${rows.map((r) => `<li>${f(r)}</li>`).join("")}</ul>` : `<div class="muted small">ยังไม่มี</div>`;
  // QC results grouped by stage and round: manufacturing QC and the factory's on-site QC after installation
  const rounds = [...new Map(d.qc.map((x) => [`${x.stage}:${x.round_no}`, { stage: x.stage, round: x.round_no }])).values()]
    .sort((a, b) => (a.stage === b.stage ? a.round - b.round : a.stage === "onsite" ? 1 : -1));
  el.innerHTML = `<div class="head"><div><a class="small" href="#/orders">← คำสั่งซื้อ</a><h1 class="mono">${esc(o.order_code)} ${pill(o.status)}</h1></div></div>
    <div class="grid cols2">
      ${card("ลูกค้า / รายละเอียด", `<dl class="kv"><dt>ลูกค้า</dt><dd>${esc(o.customers?.name)}</dd><dt>ติดต่อ</dt><dd>${esc(o.customers?.phone)} · ${esc(o.customers?.email)}</dd>
        <dt>รุ่น</dt><dd>${esc(o.machine_models?.name ?? typeTH(o.machine_type))} · ${esc(o.capacity)}</dd><dt>จำนวน</dt><dd>${o.quantity ?? 1} เครื่อง</dd><dt>ที่อยู่ติดตั้ง</dt><dd>${esc(o.install_address)}</dd>
        <dt>ไฟฟ้า / พื้นที่</dt><dd>${esc(o.install_power ?? "-")} / ${esc(o.install_space ?? "-")}</dd><dt>โรงงาน</dt><dd>${esc(o.factories?.name ?? "-")}</dd>
        <dt>คาดว่าผลิตเสร็จ</dt><dd>${dateTH(o.est_finish_date)}</dd><dt>วันที่สั่ง</dt><dd>${dateTH(o.created_at, true)}</dd></dl>`)}
      <div class="card next"><h2>ขั้นตอนถัดไป</h2><div id="panel">${panel}</div></div>
    </div>
    <div class="grid cols2" style="margin-top:18px">
      ${card("ใบเสนอราคา", Q ? `<table class="t"><tbody>${Q.quotation_items.map((i) => `<tr><td>${esc(i.description)}</td><td style="text-align:right">${baht(i.amount)}</td></tr>`).join("")}
        <tr><td>VAT</td><td style="text-align:right">${baht(Q.vat)}</td></tr><tr><td><b>ยอดรวม</b></td><td style="text-align:right"><b>${baht(Q.total_price)}</b></td></tr>
        <tr><td>มัดจำ</td><td style="text-align:right">${baht(Q.deposit_amount)}</td></tr></tbody></table><div class="small muted">ใช้ได้ถึง ${dateTH(Q.valid_until)} · ${esc({ sent: "รอลูกค้ายืนยัน", accepted: "ลูกค้ายอมรับแล้ว", rejected: "ลูกค้าปฏิเสธ", expired: "หมดอายุ" }[Q.status] ?? Q.status)}</div>` : `<div class="muted small">ยังไม่มีใบเสนอราคา</div>`)}
      ${card("การชำระเงิน", list(d.pays, (p) => `${esc({ deposit: "มัดจำ", final: "ยอดคงเหลือ", refund: "คืนเงินมัดจำ" }[p.pay_type])} ${baht(p.amount)} บาท — ${p.verified ? "ตรวจแล้ว" : "รอตรวจ"}${p.receipt_no ? ` <span class="mono">${esc(p.receipt_no)}</span>` : ""} ${p.slip_path ? `<button class="btn sm ghost" data-act="slip:${p.payment_id}">สลิป</button>` : ""}`))}
      ${card("คำสั่งผลิต / โรงงาน", list(d.asg, (a) => `${esc(a.factories?.name)} — ${esc({ pending: "รอตอบรับ", accepted: "ตอบรับแล้ว", rejected: "ปฏิเสธ" }[a.response])}${a.reject_reason ? `: ${esc(a.reject_reason)}` : ""} <span class="muted">(${dateTH(a.sent_at)})</span>`) +
        `<h2 style="margin-top:12px">การผลิต</h2>` + list(d.prod, (u) => `${esc({ started: "เริ่มผลิต", in_progress: "กำลังผลิต", finished: "ผลิตเสร็จ", delayed: "ล่าช้า" }[u.stage])}${u.est_finish_date ? ` · คาดว่าเสร็จ ${dateTH(u.est_finish_date)}` : ""}${u.note ? ` · ${esc(u.note)}` : ""}`))}
      ${card("QC / ติดตั้ง / ตรวจรับ", (rounds.length ? rounds.map((g) => { const rs = d.qc.filter((x) => x.stage === g.stage && x.round_no === g.round); return `<div class="small"><b>${g.stage === "onsite" ? "QC หน้างาน (โรงงาน หลังติดตั้ง)" : "QC (โรงงาน)"} รอบ ${g.round}</b>: ${rs.map((x) => `${x.passed ? "✅" : "❌"} ${esc((x.qc_items?.item_name_th || x.qc_items?.item_name))}${x.note ? ` (${esc(x.note)})` : ""}`).join(" · ")}</div>`; }).join("") : `<div class="muted small">ยังไม่มีผล QC</div>`) +
        `<h2 style="margin-top:12px">นัดติดตั้ง</h2>` + list(d.ap, (a) => `${dateTH(a.install_datetime, true)} — ${esc(({ scheduled: "นัดแล้ว", rescheduled: "เลื่อนนัด", completed: "เสร็จสิ้น", cancelled: "ยกเลิก" }[a.status] ?? a.status))}${a.reschedule_reason ? ` (${esc(a.reschedule_reason)})` : ""}`) +
        `<h2 style="margin-top:12px">ผลการตรวจรับ</h2>` + list(d.ac, (c) => `${c.passed ? "✅ ผ่าน" : "❌ แจ้งปัญหา"}${c.note ? `: ${esc(c.note)}` : ""} <span class="muted">(${dateTH(c.checked_at, true)})</span>${!c.passed ? (c.forwarded_at ? ` <span class="pill ok">ส่งให้โรงงานแล้ว ${dateTH(c.forwarded_at, true)}</span>` : ` <span class="pill warn">ยังไม่ได้ส่งให้โรงงาน</span>`) : ""}`))}
      ${card("ประวัติสถานะ", `<ol class="tl">${d.logs.map((l) => `<li><span class="d"></span><div>${esc(STATUS[l.status])}<div class="small muted">${dateTH(l.changed_at, true)}</div></div></li>`).join("")}</ol>`)}
      ${card("การแจ้งเตือนถึงลูกค้า", list(d.notes, (n) => `${esc(n.message)} <span class="muted">${dateTH(n.created_at, true)}</span>`))}
    </div>`;

  el.onclick = (e) => { const b = e.target.closest("[data-act]"); if (b) handle(b.dataset.act); };
});
