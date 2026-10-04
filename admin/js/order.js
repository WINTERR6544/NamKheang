// Order detail: everything about one order + the shop's next action for its current status.
async function loadOrder(id) {
  const q = (t, sel, o = "created_at", asc = true) => db.from(t).select(sel).eq("order_id", id).order(o, { ascending: asc });
  const [o, logs, quotes, pays, asg, prod, qc, ap, ac, notes, facs, items, rules] = await Promise.all([
    db.from("orders").select("*, customers(name, phone, email), factories(name), machine_models(name, code, price)").eq("order_id", id).maybeSingle().then(must),
    q("order_status_logs", "status, changed_at", "changed_at").then(must),
    q("quotations", "*, quotation_items(description, amount)", "created_at", false).then(must),
    q("payments", "*", "paid_at").then(must),
    q("factory_assignments", "*, factories(name)", "sent_at").then(must),
    q("production_updates", "*", "created_at").then(must),
    q("qc_results", "*, qc_items(item_name)", "round_no").then(must),
    q("appointments", "*", "created_at").then(must),
    q("acceptance_checks", "*", "checked_at").then(must),
    q("notifications", "message, created_at", "created_at", false).limit(8).then(must),
    db.from("factories").select("factory_id, name").eq("is_active", true).order("name").then(must),
    db.from("qc_items").select("item_id, item_name").eq("is_active", true).order("item_id").then(must),
    db.from("business_rules").select("rule_key, value").then(must),
  ]);
  if (!o) throw new Error("ไม่พบออเดอร์นี้");
  return { o, logs, quote: quotes[0] ?? null, pays, asg, prod, qc, ap, ac, notes, facs, items, rules: Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)])) };
}

route(/^\/order\/(\d+)$/, async (el, [id]) => {
  const d = await loadOrder(Number(id));
  const { o } = d;
  const reload = () => { refreshCounts(); navigate(); };
  const pay = (t) => d.pays.find((p) => p.pay_type === t);
  const lastAsg = d.asg[d.asg.length - 1];
  const sched = d.ap.find((a) => a.status === "scheduled");
  const lastAcc = d.ac[d.ac.length - 1];
  const failedQc = (() => { const r = Math.max(0, ...d.qc.map((x) => x.round_no)); return d.qc.filter((x) => x.round_no === r && !x.passed); })();
  const canCancel = [0, 1, 2, 3].includes(o.status);

  /* ----- next-action panel ----- */
  const btn = (act, label, cls = "") => `<button class="btn ${cls}" data-act="${act}">${label}</button>`;
  const payBtns = (p) => `<div class="row">${p.slip_path ? btn("slip:" + p.payment_id, "ดูสลิป", "ghost") : "<span class='pill'>ชำระเงินสด ไม่มีสลิป</span>"}${btn("ok:" + p.payment_id, "อนุมัติ", "green")}${btn("no:" + p.payment_id, "ปฏิเสธ", "red")}</div>`;
  let panel = "";
  switch (o.status) {
    case 0: panel = `<p>ตรวจรายละเอียดคำสั่งซื้อ แล้วออกใบเสนอราคา</p>${btn("quote", "ออกใบเสนอราคา")}`; break;
    case 1: { const p = pay("deposit");
      panel = p ? `<p>ลูกค้าส่งหลักฐานมัดจำ ${baht(p.amount)} บาท รอตรวจสอบ</p>${payBtns(p)}` : `<p class="muted">รอลูกค้ายืนยันราคาและชำระมัดจำ (ใบเสนอราคาใช้ได้ถึง ${dateTH(d.quote?.valid_until)})</p>`; break; }
    case 2: panel = `<p>มัดจำตรวจแล้ว ส่งคำสั่งผลิตให้โรงงาน</p>${btn("send", "ส่งคำสั่งผลิต")}`; break;
    case 3:
      if (lastAsg?.response === "pending") panel = `<p>รอ <b>${esc(lastAsg.factories?.name)}</b> ตอบ (ส่งเมื่อ ${dateTH(lastAsg.sent_at, true)}) — บันทึกคำตอบแทนโรงงาน</p><div class="row">${btn("accept", "โรงงานรับผลิต", "green")}${btn("reject", "โรงงานปฏิเสธ", "red")}</div>`;
      else if (lastAsg?.response === "rejected") panel = `<p><b>${esc(lastAsg.factories?.name)}</b> ปฏิเสธ: ${esc(lastAsg.reject_reason)} — เลือกโรงงานใหม่</p>${btn("send", "เลือกโรงงานใหม่")}`;
      else panel = `<p><b>${esc(lastAsg?.factories?.name)}</b> รับผลิตแล้ว เริ่มผลิตและระบุวันเสร็จโดยประมาณ</p>${btn("start", "เริ่มผลิต")}`;
      break;
    case 4: panel = `<p>กำลังผลิต · เสร็จโดยประมาณ ${dateTH(o.est_finish_date)}</p><div class="row">${btn("progress", "อัปเดต / แจ้งล่าช้า", "ghost")}${btn("finish", "ผลิตเสร็จ", "green")}</div>`; break;
    case 5: panel = `<p>ตรวจ QC รอบที่ ${Math.max(0, ...d.qc.map((x) => x.round_no)) + 1} (สูงสุด ${d.rules.max_qc_rounds} รอบก่อนพิจารณาเปลี่ยนโรงงาน)</p>${btn("qc", "บันทึกผล QC")}`; break;
    case 6: panel = `<p>QC ไม่ผ่าน: ${failedQc.map((x) => esc(x.qc_items?.item_name) + (x.note ? ` (${esc(x.note)})` : "")).join(", ")}</p>${btn("rework", "โรงงานแก้ไขเสร็จ ส่งตรวจใหม่", "green")}`; break;
    case 7: panel = `<p>ผ่าน QC แล้ว นัดวันติดตั้งกับลูกค้าและโรงงาน</p>${btn("schedule", "นัดวันติดตั้ง")}`; break;
    case 8: panel = sched
      ? `<p>นัดติดตั้ง <b>${dateTH(sched.install_datetime, true)}</b> (การติดตั้งทำโดยโรงงาน)</p><div class="row">${btn("schedule", "เลื่อนวัน", "ghost")}${btn("installed", "โรงงานยืนยันติดตั้งเสร็จ", "green")}</div>`
      : `<p class="err">ลูกค้าแจ้งปัญหาหลังตรวจรับ: ${esc(lastAcc?.note ?? "-")} — ประสานโรงงานแก้ไข แล้วนัดวันใหม่</p>${btn("schedule", "นัดวันติดตั้งใหม่")}`; break;
    case 9: { const p = pay("final");
      panel = p ? `<p>ลูกค้าตรวจรับผ่านและส่งหลักฐานยอดคงเหลือ ${baht(p.amount)} บาท</p>${payBtns(p)}` : `<p class="muted">รอลูกค้าตรวจรับและชำระยอดคงเหลือ</p>`; break; }
    case 10: panel = `<p>✅ เสร็จสิ้น · ใบเสร็จ <b class="mono">${esc(pay("final")?.receipt_no ?? "-")}</b></p>`; break;
    case 99: { const r = pay("refund");
      panel = `<p>ยกเลิกโดย ${esc({ customer: "ลูกค้า", shop: "ร้าน", system: "ระบบ" }[o.cancelled_by] ?? "-")}: ${esc(o.cancel_reason)}</p>` +
        (r ? (r.verified ? `<p>โอนคืนมัดจำแล้ว</p>` : `<p>รอโอนคืนมัดจำ ${baht(r.amount)} บาท</p><a class="btn" href="#/payments/refund">ไปหน้า Refund</a>`) : ""); break; }
  }
  if (canCancel) panel += `<div style="margin-top:12px">${btn("cancel", "ยกเลิกคำสั่งซื้อ", "red sm")}</div>`;

  /* ----- detail cards ----- */
  const Q = d.quote;
  const card = (t, body) => `<div class="card"><h2>${t}</h2>${body}</div>`;
  const list = (rows, f) => rows.length ? `<ul style="padding-left:18px;margin:0;font-size:.88rem">${rows.map((r) => `<li>${f(r)}</li>`).join("")}</ul>` : `<div class="muted small">ยังไม่มี</div>`;
  const rounds = [...new Set(d.qc.map((x) => x.round_no))];
  el.innerHTML = `<div class="head"><div><a class="small" href="#/orders">← Orders</a><h1 class="mono">${esc(o.order_code)} ${pill(o.status)}</h1></div></div>
    <div class="grid cols2">
      ${card("ลูกค้า / รายละเอียด", `<dl class="kv"><dt>ลูกค้า</dt><dd>${esc(o.customers?.name)}</dd><dt>ติดต่อ</dt><dd>${esc(o.customers?.phone)} · ${esc(o.customers?.email)}</dd>
        <dt>รุ่น</dt><dd>${esc(o.machine_models?.name ?? o.machine_type)} · ${esc(o.capacity)}</dd><dt>สถานที่ติดตั้ง</dt><dd>${esc(o.install_address)}</dd>
        <dt>ไฟฟ้า / พื้นที่</dt><dd>${esc(o.install_power ?? "-")} / ${esc(o.install_space ?? "-")}</dd><dt>โรงงาน</dt><dd>${esc(o.factories?.name ?? "-")}</dd>
        <dt>เสร็จโดยประมาณ</dt><dd>${dateTH(o.est_finish_date)}</dd><dt>สั่งเมื่อ</dt><dd>${dateTH(o.created_at, true)}</dd></dl>`)}
      <div class="card next"><h2>ขั้นตอนถัดไป</h2><div id="panel">${panel}</div></div>
    </div>
    <div class="grid cols2" style="margin-top:18px">
      ${card("ใบเสนอราคา", Q ? `<table class="t"><tbody>${Q.quotation_items.map((i) => `<tr><td>${esc(i.description)}</td><td style="text-align:right">${baht(i.amount)}</td></tr>`).join("")}
        <tr><td>VAT</td><td style="text-align:right">${baht(Q.vat)}</td></tr><tr><td><b>รวม</b></td><td style="text-align:right"><b>${baht(Q.total_price)}</b></td></tr>
        <tr><td>มัดจำ</td><td style="text-align:right">${baht(Q.deposit_amount)}</td></tr></tbody></table><div class="small muted">ใช้ได้ถึง ${dateTH(Q.valid_until)} · ${esc(Q.status)}</div>` : `<div class="muted small">ยังไม่ออกใบเสนอราคา</div>`)}
      ${card("การชำระเงิน", list(d.pays, (p) => `${esc({ deposit: "มัดจำ", final: "ยอดสุดท้าย", refund: "คืนมัดจำ" }[p.pay_type])} ${baht(p.amount)} — ${p.verified ? "ตรวจแล้ว" : "รอตรวจ"}${p.receipt_no ? ` <span class="mono">${esc(p.receipt_no)}</span>` : ""} ${p.slip_path ? `<button class="btn sm ghost" data-act="slip:${p.payment_id}">สลิป</button>` : ""}`))}
      ${card("คำสั่งผลิต / โรงงาน", list(d.asg, (a) => `${esc(a.factories?.name)} — ${esc({ pending: "รอตอบ", accepted: "รับผลิต", rejected: "ปฏิเสธ" }[a.response])}${a.reject_reason ? `: ${esc(a.reject_reason)}` : ""} <span class="muted">(${dateTH(a.sent_at)})</span>`) +
        `<h2 style="margin-top:12px">การผลิต</h2>` + list(d.prod, (u) => `${esc({ started: "เริ่มผลิต", in_progress: "กำลังผลิต", finished: "ผลิตเสร็จ", delayed: "ล่าช้า" }[u.stage])}${u.est_finish_date ? ` · ETA ${dateTH(u.est_finish_date)}` : ""}${u.note ? ` · ${esc(u.note)}` : ""}`))}
      ${card("QC / ติดตั้ง / ตรวจรับ", (rounds.length ? rounds.map((r) => { const rs = d.qc.filter((x) => x.round_no === r); return `<div class="small"><b>QC รอบ ${r}</b>: ${rs.map((x) => `${x.passed ? "✅" : "❌"} ${esc(x.qc_items?.item_name)}${x.note ? ` (${esc(x.note)})` : ""}`).join(" · ")}</div>`; }).join("") : `<div class="muted small">ยังไม่มีผล QC</div>`) +
        `<h2 style="margin-top:12px">นัดติดตั้ง</h2>` + list(d.ap, (a) => `${dateTH(a.install_datetime, true)} — ${esc(a.status)}${a.reschedule_reason ? ` (${esc(a.reschedule_reason)})` : ""}`) +
        `<h2 style="margin-top:12px">ผลตรวจรับ</h2>` + list(d.ac, (c) => `${c.passed ? "✅ ผ่าน" : "❌ พบปัญหา"}${c.note ? `: ${esc(c.note)}` : ""} <span class="muted">(${dateTH(c.checked_at, true)})</span>`))}
      ${card("History / Timeline", `<ol class="tl">${d.logs.map((l) => `<li><span class="d"></span><div>${esc(STATUS[l.status])}<div class="small muted">${dateTH(l.changed_at, true)}</div></div></li>`).join("")}</ol>`)}
      ${card("การแจ้งเตือนลูกค้า", list(d.notes, (n) => `${esc(n.message)} <span class="muted">${dateTH(n.created_at, true)}</span>`))}
    </div>`;

  /* ----- actions ----- */
  const run = async (fn) => { try { await fn(); reload(); } catch (e) { toast(errText(e), true); } };
  const form = (title, body, ok, onOk, onOpen) => modal(title, body, { ok, onOk, onOpen }).then((done) => done && reload());
  const facOptions = d.facs.map((f) => `<option value="${f.factory_id}">${esc(f.name)}${d.asg.some((a) => a.factory_id === f.factory_id && a.response === "rejected") ? " (เคยปฏิเสธ)" : ""}</option>`).join("");
  const cancelForm = () => form("ยกเลิกคำสั่งซื้อ", `<label>เหตุผล</label><textarea id="r" rows="3"></textarea>${[2, 3].includes(o.status) ? `<p class="small">มีมัดจำที่ตรวจแล้ว ระบบจะสร้างรายการคืนเงินให้</p>` : ""}`, "ยืนยันยกเลิก",
    (m) => rpc("staff_cancel_order", { p_order: o.order_id, p_reason: $("#r", m).value }, "ยกเลิกแล้ว"));
  const dateInput = (min) => `<input id="dt" type="datetime-local" ${min ? `min="${min}"` : ""}>`;
  const actions = {
    quote: () => {
      const price = o.machine_models?.price ?? "";
      let rowsHtml = (desc, amt) => `<div class="it"><input class="ds" placeholder="รายการ" value="${esc(desc)}"><input class="am" type="number" min="0" step="0.01" placeholder="ราคา" value="${esc(amt)}"><button type="button" class="btn sm red x">×</button></div>`;
      form("ออกใบเสนอราคา", `<div class="items" id="its">${rowsHtml(`${o.machine_models?.name ?? o.machine_type} · ${o.capacity}`, price)}</div>
        <button type="button" class="btn sm ghost" id="add" style="margin-top:8px">+ เพิ่มรายการ</button>
        <div class="grid cols3" style="margin-top:12px;gap:8px"><div><label>VAT %</label><input id="vat" type="number" value="7"></div><div><label>มัดจำ %</label><input id="dep" type="number" value="${d.rules.deposit_percent}"></div><div><label>ใช้ได้ (วัน)</label><input id="days" type="number" value="${d.rules.quote_valid_days}"></div></div>
        <div class="sum" id="sum" style="margin-top:12px"></div>`, "ออกใบเสนอราคา",
        (m) => {
          const items = $$(".it", m).map((r) => ({ description: $(".ds", r).value.trim(), amount: Number($(".am", r).value) })).filter((i) => i.description && i.amount > 0);
          return rpc("staff_create_quote", { p_order: o.order_id, p_items: items, p_vat_percent: Number($("#vat", m).value), p_deposit_percent: Number($("#dep", m).value), p_valid_days: Number($("#days", m).value) }, "ออกใบเสนอราคาแล้ว");
        },
        (m) => {
          const calc = () => {
            const sub = $$(".am", m).reduce((s, i) => s + (Number(i.value) || 0), 0), vat = sub * (Number($("#vat", m).value) || 0) / 100;
            $("#sum", m).innerHTML = `รวมก่อน VAT ${baht(sub)} · VAT ${baht(vat)}<br><b>รวมทั้งสิ้น ${baht(sub + vat)}</b> · มัดจำ ${baht((sub + vat) * (Number($("#dep", m).value) || 0) / 100)}`;
          };
          m.addEventListener("input", calc);
          m.addEventListener("click", (e) => { if (e.target.classList.contains("x") && $$(".it", m).length > 1) { e.target.closest(".it").remove(); calc(); } });
          $("#add", m).onclick = () => { $("#its", m).insertAdjacentHTML("beforeend", rowsHtml("", "")); };
          calc();
        });
    },
    send: () => form(lastAsg?.response === "rejected" ? "เลือกโรงงานใหม่" : "ส่งคำสั่งผลิตให้โรงงาน", `<label>โรงงาน</label><select id="f">${facOptions}</select>`, "ส่งคำสั่งผลิต",
      (m) => rpc("staff_send_to_factory", { p_order: o.order_id, p_factory: Number($("#f", m).value) }, "ส่งคำสั่งผลิตแล้ว")),
    accept: () => run(() => rpc("staff_factory_response", { p_order: o.order_id, p_accept: true }, "บันทึกว่าโรงงานรับผลิต")),
    reject: () => form("โรงงานปฏิเสธ", `<label>เหตุผล</label><textarea id="r" rows="3"></textarea>`, "บันทึก",
      (m) => rpc("staff_factory_response", { p_order: o.order_id, p_accept: false, p_reason: $("#r", m).value }, "บันทึกการปฏิเสธแล้ว")),
    start: () => form("เริ่มผลิต", `<label>วันเสร็จโดยประมาณ</label><input id="e" type="date"><label style="margin-top:10px">หมายเหตุ</label><input id="n">`, "เริ่มผลิต",
      (m) => rpc("staff_production", { p_order: o.order_id, p_stage: "started", p_est: $("#e", m).value || null, p_note: $("#n", m).value || null }, "เริ่มผลิตแล้ว แจ้งลูกค้า")),
    progress: () => form("อัปเดตการผลิต", `<label>สถานะ</label><select id="s"><option value="in_progress">กำลังผลิตตามแผน</option><option value="delayed">ล่าช้า (แจ้งลูกค้า)</option></select>
      <label style="margin-top:10px">วันเสร็จโดยประมาณใหม่</label><input id="e" type="date" value="${esc(o.est_finish_date ?? "")}"><label style="margin-top:10px">หมายเหตุ</label><input id="n">`, "บันทึก",
      (m) => rpc("staff_production", { p_order: o.order_id, p_stage: $("#s", m).value, p_est: $("#e", m).value || null, p_note: $("#n", m).value || null }, "อัปเดตแล้ว")),
    finish: () => run(() => rpc("staff_production", { p_order: o.order_id, p_stage: "finished", p_est: null, p_note: null }, "ผลิตเสร็จ ส่งต่อ QC")),
    qc: () => form("บันทึกผล QC", d.items.map((i) => `<div style="margin-bottom:10px"><label>${esc(i.item_name)}</label><div class="row"><select class="ps" data-i="${i.item_id}" style="width:auto"><option value="1">ผ่าน</option><option value="0">ไม่ผ่าน</option></select><input class="nt" placeholder="จุดที่ต้องแก้ (ถ้าไม่ผ่าน)" style="flex:1"></div></div>`).join(""), "บันทึกผล QC",
      async (m) => {
        const res = $$(".ps", m).map((s) => ({ item_id: Number(s.dataset.i), passed: s.value === "1", note: s.closest(".row").querySelector(".nt").value || null }));
        if (res.some((r) => !r.passed && !r.note)) throw new Error("กรุณาระบุจุดที่ต้องแก้ของหัวข้อที่ไม่ผ่าน");
        const s = await rpc("staff_qc_submit", { p_order: o.order_id, p_results: res });
        toast(s === 7 ? "ผ่าน QC ทุกหัวข้อ" : "QC ไม่ผ่าน ส่งกลับโรงงานแก้ไข", s !== 7);
      }),
    rework: () => run(() => rpc("staff_rework_done", { p_order: o.order_id }, "ส่งตรวจ QC ใหม่")),
    schedule: () => form(sched ? "เลื่อนวันติดตั้ง" : "นัดวันติดตั้ง", `<label>วัน-เวลา</label>${dateInput()}${sched ? `<label style="margin-top:10px">เหตุผลที่เลื่อน</label><input id="r">` : ""}`, "บันทึกนัด",
      (m) => { if (!$("#dt", m).value) throw new Error("กรุณาเลือกวัน-เวลา"); return rpc("staff_schedule_install", { p_order: o.order_id, p_datetime: new Date($("#dt", m).value).toISOString(), p_reason: $("#r", m)?.value || null }, "บันทึกนัดแล้ว แจ้งลูกค้า"); }),
    installed: () => run(() => rpc("staff_confirm_installed", { p_order: o.order_id }, "บันทึกว่าติดตั้งเสร็จ รอลูกค้าตรวจรับ")),
    cancel: cancelForm,
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const [act, arg] = b.dataset.act.split(":");
    if (act === "slip") return showSlip(d.pays.find((p) => String(p.payment_id) === arg)?.slip_path);
    if (act === "ok") return run(() => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: true }, "อนุมัติแล้ว"));
    if (act === "no") return form("ปฏิเสธหลักฐานการชำระ", `<label>เหตุผล (ลูกค้าจะได้รับแจ้ง)</label><textarea id="r" rows="3"></textarea>`, "ปฏิเสธ",
      (m) => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: false, p_reason: $("#r", m).value }, "ปฏิเสธแล้ว แจ้งลูกค้าให้ส่งใหม่"));
    actions[act]?.();
  };
});
