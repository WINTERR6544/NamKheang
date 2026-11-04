// Shared by the order page and the order popup: loads one order, works out the shop's next step for it,
// and holds the handlers behind the buttons (quote, verify slip, send to factory, QC review, schedule, cancel ...).
async function loadOrder(id) {
  const q = (t, sel, o = "created_at", asc = true) => db.from(t).select(sel).eq("order_id", id).order(o, { ascending: asc });
  const [o, logs, quotes, pays, asg, prod, qc, ap, ac, notes, facs, items, rules, moves, cmoves, reviews] = await Promise.all([
    db.from("orders").select("*, customers(name, phone, email), factories(name), machine_models(name, code, price)").eq("order_id", id).maybeSingle().then(must),
    q("order_status_logs", "status, changed_at", "changed_at").then(must),
    q("quotations", "*, quotation_items(description, amount)", "created_at", false).then(must),
    q("payments", "*", "paid_at").then(must),
    q("factory_assignments", "*, factories(name)", "sent_at").then(must),
    q("production_updates", "*", "created_at").then(must),
    q("qc_results", "*, qc_items(item_name, item_name_th)", "round_no").then(must),
    q("appointments", "*", "created_at").then(must),
    q("acceptance_checks", "*", "checked_at").then(must),
    q("notifications", "message, created_at", "created_at", false).limit(8).then(must),
    db.from("factories").select("factory_id, name").eq("is_active", true).order("name").then(must),
    db.from("qc_items").select("item_id, item_name, item_name_th").eq("is_active", true).order("item_id").then(must),
    db.from("business_rules").select("rule_key, value").then(must),
    q("install_reschedule_requests", "request_id, proposed_datetime, reason, status, created_at, resolved_at").then(must),
    q("customer_reschedule_requests", "request_id, preferred_datetime, reason, status, created_at, resolved_at").then(must),
    q("qc_reviews", "round_no, passed, failed_items, note, reviewed_at", "round_no").then(must),
  ]);
  if (!o) throw new Error("ไม่พบคำสั่งซื้อ");
  return { o, logs, moves, cmoves, reviews, quote: quotes[0] ?? null, pays, asg, prod, qc, ap, ac, notes, facs, items, rules: Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)])) };
}


function orderNext(d, reload) {
  const { o } = d;
  const pay = (t) => d.pays.find((p) => p.pay_type === t);
  const lastAsg = d.asg[d.asg.length - 1];
  const waited = lastAsg ? (Date.now() - new Date(lastAsg.sent_at).getTime()) / 86400000 : 0; // days since the request was sent
  const sched = d.ap.find((a) => a.status === "scheduled");
  const lastAcc = d.ac[d.ac.length - 1];
  const prodQc = d.qc.filter((x) => x.stage !== "onsite"); // manufacturing QC: the factory records each round, the shop reviews it (UC7)
  const qcRound = Math.max(0, ...prodQc.map((x) => x.round_no));
  const lastRound = prodQc.filter((x) => x.round_no === qcRound);
  const lastReview = d.reviews.find((r) => r.round_no === qcRound);
  const toReview = o.status === 5 && qcRound > 0 && !lastReview; // recorded, waiting for the shop
  const itemName = (id) => esc(d.items.find((i) => i.item_id === id)?.item_name_th ?? d.items.find((i) => i.item_id === id)?.item_name ?? lastRound.find((x) => x.item_id === id)?.qc_items?.item_name ?? "#" + id);
  const qcRows = lastRound.map((x) => `<tr><td>${esc((x.qc_items?.item_name_th || x.qc_items?.item_name))}</td><td>${x.passed ? `<span class="pill ok">ผ่าน</span>` : `<span class="pill bad">ไม่ผ่าน</span>`}</td><td>${esc(x.note ?? "")}</td></tr>`).join("");
  const canCancel = [0, 1, 2, 3].includes(o.status);
  const move = d.moves.find((m) => m.status === "pending"); // the factory asked to move the booked install
  const cmove = d.cmoves.find((m) => m.status === "pending"); // the customer asked to move it (UC8 alt)

  /* ----- next-action panel ----- */
  const btn = (act, label, cls = "") => `<button class="btn ${cls}" data-act="${act}">${label}</button>`;
  const payBtns = (p) => `<div class="row">${p.slip_path ? btn("slip:" + p.payment_id, "ดูสลิป", "ghost") : "<span class='pill'>ชำระเงินสด ไม่มีสลิป</span>"}${btn("ok:" + p.payment_id, "อนุมัติ", "green")}${btn("no:" + p.payment_id, "ปฏิเสธ", "red")}</div>`;
  let panel = "";
  switch (o.status) {
    case 0: panel = `<p>ตรวจรายละเอียดคำสั่งซื้อ แล้วออกใบเสนอราคา</p>${btn("quote", "ออกใบเสนอราคา")}`; break;
    case 1: { const p = pay("deposit");
      panel = p ? `<p>ลูกค้าส่งสลิปมัดจำ ${baht(p.amount)} บาท กรุณาตรวจสอบ</p>${payBtns(p)}` : `<p class="muted">รอลูกค้ายืนยันใบเสนอราคาและชำระมัดจำ (ใบเสนอราคาใช้ได้ถึง ${dateTH(d.quote?.valid_until)})</p>`; break; }
    case 2: panel = `<p>ตรวจมัดจำแล้ว ส่งคำสั่งผลิตให้โรงงานได้เลย</p>${btn("send", "ส่งคำสั่งผลิต")}`; break;
    case 3:
      if (lastAsg?.response === "pending") panel = `<p>รอ <b>${esc(lastAsg.factories?.name)}</b> ตอบรับ (ส่งเมื่อ ${dateTH(lastAsg.sent_at, true)}) โรงงานตอบในระบบของโรงงานเอง</p>` +
        (waited >= d.rules.factory_reply_days ? `<p class="err">ไม่มีการตอบกลับมา ${Math.floor(waited)} วัน (กำหนด ${d.rules.factory_reply_days} วัน)</p>${btn("withdraw", "ถอนคำขอและเลือกโรงงานอื่น", "red sm")}` : "");
      else if (lastAsg?.response === "rejected") panel = `<p><b>${esc(lastAsg.factories?.name)}</b> ปฏิเสธ: ${esc(lastAsg.reject_reason)} กรุณาเลือกโรงงานอื่น</p>${btn("send", "เลือกโรงงานอื่น")}`;
      else panel = `<p><b>${esc(lastAsg?.factories?.name)}</b> ตอบรับแล้ว รอโรงงานเริ่มผลิต</p>`;
      break;
    case 4: panel = `<p>กำลังผลิตที่โรงงาน · คาดว่าเสร็จ ${dateTH(o.est_finish_date)}</p>`; break;
    case 5: panel = toReview
      ? `<p><b>โรงงานบันทึกผล QC รอบ ${qcRound} แล้ว กรุณาตรวจผล</b></p>
        <div class="tw"><table class="t"><thead><tr><th>หัวข้อ</th><th>ผลจากโรงงาน</th><th>หมายเหตุ</th></tr></thead><tbody>${qcRows}</tbody></table></div>
        <div class="row" style="margin-top:10px">${lastRound.every((x) => x.passed) ? btn("qc_pass", "ผ่าน QC", "green") : ""}${btn("qc_back", "ส่งกลับให้แก้ไข", lastRound.every((x) => x.passed) ? "ghost" : "red")}</div>`
      : `<p>QC รอบที่ ${qcRound + 1} (ไม่เกิน ${d.rules.max_qc_rounds} รอบก่อนพิจารณาโรงงานอื่น) รอโรงงานบันทึกผล QC</p>`; break;
    case 6: panel = `<p>ส่ง QC รอบ ${qcRound} กลับให้โรงงานแก้: ${(lastReview?.failed_items ?? []).map(itemName).join(", ") || "-"}${lastReview?.note ? ` · ${esc(lastReview.note)}` : ""} รอโรงงานแก้ไข</p>`; break;
    case 7: panel = `<p>ผ่าน QC แล้ว นัดวันติดตั้งกับลูกค้าและโรงงาน</p>${btn("schedule", "นัดติดตั้ง")}`; break;
    case 8: panel = sched
      ? `<p>นัดติดตั้ง <b>${dateTH(sched.install_datetime, true)}</b> (โรงงานติดตั้ง ตรวจ QC หน้างาน แล้วยืนยันการติดตั้ง)</p>` +
        (move ? `<div class="card" style="margin:10px 0"><p><b>โรงงานขอเลื่อนติดตั้งเป็น ${dateTH(move.proposed_datetime, true)}</b></p><p class="small">เหตุผล: ${esc(move.reason)}</p>
          <div class="row">${btn("book_move", "นัดตามวันที่ขอ", "green")}${btn("schedule", "เลือกวันอื่น", "ghost")}</div></div>` : "") +
        (cmove ? `<div class="card" style="margin:10px 0"><p><b>ลูกค้าขอเลื่อนติดตั้งเป็น ${dateTH(cmove.preferred_datetime, true)}</b></p><p class="small">เหตุผล: ${esc(cmove.reason)} · ขอเมื่อ ${dateTH(cmove.created_at, true)}</p>
          <p class="small muted">ตรวจสอบวันกับโรงงานก่อน</p>
          <div class="row">${btn("book_cmove", "นัดตามวันที่ลูกค้าขอ", "green")}${btn("schedule", "เลือกวันอื่น", "ghost")}</div></div>` : "") +
        (move || cmove ? "" : `<div class="row">${btn("schedule", "เลื่อนนัด", "ghost")}</div>`)
      : `<p class="err">ลูกค้าแจ้งปัญหาหลังตรวจเครื่อง: ${esc(lastAcc?.note ?? "-")} ประสานโรงงานเพื่อแก้ไข แล้วนัดวันใหม่</p>${btn("schedule", "นัดวันติดตั้งใหม่")}`; break;
    case 9: { const p = pay("final");
      if (p) panel = `<p>ลูกค้าตรวจรับเครื่องแล้ว และส่งสลิปยอดคงเหลือ ${baht(p.amount)} บาท</p>${payBtns(p)}`;
      else if (lastAcc && !lastAcc.passed) // customer -> shop -> factory
        panel = `<p class="err">ลูกค้าแจ้งปัญหาหลังตรวจเครื่อง: ${esc(lastAcc.note ?? "-")}</p>` +
          (lastAcc.forwarded_at ? `<p class="small muted">ส่งให้โรงงานแล้ว ${dateTH(lastAcc.forwarded_at, true)} ตกลงวันเข้าแก้ไขกับโรงงาน แล้วบันทึกนัด</p>` : `<p class="small muted">แจ้งโรงงานก่อน</p>`) +
          `<div class="row">${lastAcc.forwarded_at ? "" : btn("forward", "ส่งปัญหาให้โรงงาน")}${btn("schedule", "นัดเข้าแก้ไข", lastAcc.forwarded_at ? "" : "ghost")}</div>`;
      else panel = `<p class="muted">รอลูกค้าตรวจรับเครื่องและชำระยอดคงเหลือ</p>`;
      break; }
    case 10: panel = `<p>✅ เสร็จสมบูรณ์ · ใบเสร็จ <b class="mono">${esc(pay("final")?.receipt_no ?? "-")}</b></p>`; break;
    case 99: { const r = pay("refund");
      panel = `<p>ยกเลิกโดย${esc({ customer: "ลูกค้า", shop: "ร้าน", system: "ระบบ" }[o.cancelled_by] ?? " -")}: ${esc(o.cancel_reason)}</p>` +
        (r ? (r.verified ? `<p>โอนคืนเงินมัดจำแล้ว</p>` : `<p>รอโอนคืนเงินมัดจำ ${baht(r.amount)} บาท</p><a class="btn" href="#/payments/refund">ไปหน้าคืนเงิน</a>`) : ""); break; }
  }
  if (canCancel) panel += `<div style="margin-top:12px">${btn("cancel", "ยกเลิกคำสั่งซื้อ", "red sm")}</div>`;

  /* ----- actions ----- */
  const run = async (fn) => { try { await fn(); reload(); } catch (e) { toast(errText(e), true); } };
  const form = (title, body, ok, onOk, onOpen) => modal(title, body, { ok, onOk, onOpen }).then((done) => done && reload());
  // UC5: factories that declined this order are left out of the list
  const declined = new Set(d.asg.filter((a) => a.response === "rejected").map((a) => a.factory_id));
  const facOptions = d.facs.filter((f) => !declined.has(f.factory_id)).map((f) => `<option value="${f.factory_id}">${esc(f.name)}</option>`).join("");
  const cancelForm = () => form("ยกเลิกคำสั่งซื้อ", `<label>เหตุผล</label><textarea id="r" rows="3"></textarea>${[2, 3].includes(o.status) ? `<p class="small">มีมัดจำที่ตรวจแล้ว ระบบจะสร้างรายการคืนเงินให้</p>` : ""}`, "ยืนยันยกเลิก",
    (m) => rpc("staff_cancel_order", { p_order: o.order_id, p_reason: $("#r", m).value }, "ยกเลิกแล้ว"));
  const dateInput = (min) => `<input id="dt" type="datetime-local" ${min ? `min="${min}"` : ""}>`;
  const actions = {
    quote: () => {
      const qty = o.quantity ?? 1;
      const price = o.machine_models?.price != null ? Number(o.machine_models.price) * qty : "";
      let rowsHtml = (desc, amt) => `<div class="it"><input class="ds" placeholder="รายการ" value="${esc(desc)}"><input class="am" type="number" min="0" step="0.01" placeholder="ราคา" value="${esc(amt)}"><button type="button" class="btn sm red x">×</button></div>`;
      form("ออกใบเสนอราคา", `<div class="items" id="its">${rowsHtml(`${o.machine_models?.name ?? typeTH(o.machine_type)} · ${o.capacity}${qty > 1 ? ` × ${qty}` : ""}`, price)}</div>
        <button type="button" class="btn sm ghost" id="add" style="margin-top:8px">+ เพิ่มรายการ</button>
        <div class="grid cols3" style="margin-top:12px;gap:8px"><div><label>VAT (%)</label><input id="vat" type="number" value="7"></div><div><label>มัดจำ (%)</label><input id="dep" type="number" value="${d.rules.deposit_percent}"></div><div><label>ใช้ได้ (วัน)</label><input id="days" type="number" value="${d.rules.quote_valid_days}"></div></div>
        <div class="sum" id="sum" style="margin-top:12px"></div>`, "ออกใบเสนอราคา",
        (m) => {
          const items = $$(".it", m).map((r) => ({ description: $(".ds", r).value.trim(), amount: Number($(".am", r).value) })).filter((i) => i.description && i.amount > 0);
          return rpc("staff_create_quote", { p_order: o.order_id, p_items: items, p_vat_percent: Number($("#vat", m).value), p_deposit_percent: Number($("#dep", m).value), p_valid_days: Number($("#days", m).value) }, "ออกใบเสนอราคาแล้ว");
        },
        (m) => {
          const calc = () => {
            const sub = $$(".am", m).reduce((s, i) => s + (Number(i.value) || 0), 0), vat = sub * (Number($("#vat", m).value) || 0) / 100;
            $("#sum", m).innerHTML = `ราคาก่อน VAT ${baht(sub)} · VAT ${baht(vat)}<br><b>ยอดรวม ${baht(sub + vat)}</b> · มัดจำ ${baht((sub + vat) * (Number($("#dep", m).value) || 0) / 100)}`;
          };
          m.addEventListener("input", calc);
          m.addEventListener("click", (e) => { if (e.target.classList.contains("x") && $$(".it", m).length > 1) { e.target.closest(".it").remove(); calc(); } });
          $("#add", m).onclick = () => { $("#its", m).insertAdjacentHTML("beforeend", rowsHtml("", "")); };
          calc();
        });
    },
    send: () => facOptions
      ? form(lastAsg?.response === "rejected" ? "เลือกโรงงานอื่น" : "ส่งคำสั่งผลิตให้โรงงาน", `<label>โรงงาน</label><select id="f">${facOptions}</select>`, "ส่งคำสั่งผลิต",
        (m) => rpc("staff_send_to_factory", { p_order: o.order_id, p_factory: Number($("#f", m).value) }, "ส่งคำสั่งผลิตแล้ว"))
      : form("ไม่มีโรงงานที่รับได้", `<p>โรงงานที่เปิดใช้งานทุกแห่งปฏิเสธคำสั่งซื้อนี้แล้ว ยกเลิกคำสั่งซื้อได้ และระบบจะคืนมัดจำที่ตรวจแล้ว</p>`, "ยกเลิกคำสั่งซื้อแทน", () => { setTimeout(cancelForm); return true; }),
    forward: () => run(() => rpc("staff_forward_problem", { p_order: o.order_id }, "ส่งปัญหาให้โรงงานแล้ว")),
    withdraw: () => form("ถอนคำขอผลิต", `<p>โรงงานยังไม่ตอบกลับ ระบบจะถอนคำขอและแจ้งโรงงาน จากนั้นเลือกโรงงานอื่นได้</p><label>หมายเหตุ (ไม่บังคับ)</label><textarea id="r" rows="3"></textarea>`, "ถอนคำขอ",
      (m) => rpc("staff_withdraw_request", { p_order: o.order_id, p_reason: $("#r", m).value.trim() || null }, "ถอนคำขอแล้ว เลือกโรงงานอื่นได้เลย")),
    schedule: () => form(sched ? "เลื่อนนัดติดตั้ง" : o.status === 9 ? "นัดเข้าแก้ไข" : "นัดติดตั้ง", `<label>วันและเวลา</label>${dateInput()}${sched ? `<label style="margin-top:10px">เหตุผลที่เลื่อน</label><input id="r">` : ""}`, "บันทึกนัด",
      (m) => { if (!$("#dt", m).value) throw new Error("กรุณาเลือกวันและเวลา"); return rpc("staff_schedule_install", { p_order: o.order_id, p_datetime: new Date($("#dt", m).value).toISOString(), p_reason: $("#r", m)?.value || null }, "บันทึกนัดแล้ว แจ้งลูกค้าเรียบร้อย"); }),
    book_move: () => run(() => rpc("staff_schedule_install", { p_order: o.order_id, p_datetime: move.proposed_datetime, p_reason: `โรงงานขอเลื่อน: ${move.reason}`.slice(0, 500) }, "บันทึกนัดแล้ว แจ้งลูกค้าและโรงงานเรียบร้อย")),
    book_cmove: () => run(() => rpc("staff_schedule_install", { p_order: o.order_id, p_datetime: cmove.preferred_datetime, p_reason: `ลูกค้าขอเลื่อน: ${cmove.reason}`.slice(0, 500) }, "บันทึกนัดแล้ว แจ้งลูกค้าและโรงงานเรียบร้อย")),
    qc_pass: () => form(`ผ่าน QC รอบ ${qcRound}`, `<p>ทุกหัวข้อผ่านการตรวจที่โรงงาน เมื่อผ่าน QC แล้วจะนัดติดตั้งได้</p><label>หมายเหตุ (ไม่บังคับ)</label><input id="r">`, "ผ่าน QC",
      (m) => rpc("staff_qc_review", { p_order: o.order_id, p_pass: true, p_note: $("#r", m).value.trim() || null }, "ผ่าน QC แล้ว ขั้นต่อไปคือนัดติดตั้ง")),
    qc_back: () => form(`ส่ง QC รอบ ${qcRound} กลับให้แก้ไข`, `<p class="small">เลือกหัวข้อที่โรงงานต้องแก้ หัวข้อที่โรงงานบันทึกว่าไม่ผ่านถูกเลือกไว้แล้ว</p>
        ${lastRound.map((x) => `<label class="row" style="font-weight:400;gap:8px"><input type="checkbox" class="fi" value="${x.item_id}" ${x.passed ? "" : "checked"} style="width:auto"> ${esc((x.qc_items?.item_name_th || x.qc_items?.item_name))}${x.note ? ` <span class="muted small">(${esc(x.note)})</span>` : ""}</label>`).join("")}
        <label style="margin-top:10px">สิ่งที่ต้องแก้ (โรงงานจะเห็นข้อความนี้)</label><textarea id="r" rows="3"></textarea>`, "ส่งกลับ",
      (m) => {
        const ids = $$(".fi:checked", m).map((c) => Number(c.value)), note = $("#r", m).value.trim();
        if (!ids.length && !note) throw new Error("เลือกหัวข้อหรือเขียนสิ่งที่ต้องแก้อย่างน้อยหนึ่งอย่าง");
        return rpc("staff_qc_review", { p_order: o.order_id, p_pass: false, p_note: note || null, p_failed_items: ids }, "ส่งกลับแล้ว แจ้งโรงงานให้แก้ไขเรียบร้อย");
      }),
    cancel: cancelForm,
  };
  const handle = (key) => {
    const [act, arg] = key.split(":");
    if (act === "slip") return showSlip(d.pays.find((p) => String(p.payment_id) === arg)?.slip_path);
    if (act === "ok") return run(() => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: true }, "อนุมัติแล้ว"));
    if (act === "no") return form("ปฏิเสธหลักฐานการชำระเงิน", `<label>เหตุผล (ลูกค้าจะได้รับแจ้ง)</label><textarea id="r" rows="3"></textarea>`, "ปฏิเสธ",
      (m) => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: false, p_reason: $("#r", m).value }, "ปฏิเสธแล้ว แจ้งให้ลูกค้าส่งหลักฐานใหม่"));
    actions[act]?.();
  };
  return { panel, handle };
}
