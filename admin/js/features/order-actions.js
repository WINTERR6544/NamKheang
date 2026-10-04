// Shared by the order page and the order popup: loads one order, works out the shop's next step for it,
// and holds the handlers behind the buttons (quote, verify slip, send to factory, QC, schedule, cancel ...).
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
  if (!o) throw new Error("Order not found");
  return { o, logs, quote: quotes[0] ?? null, pays, asg, prod, qc, ap, ac, notes, facs, items, rules: Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)])) };
}


function orderNext(d, reload) {
  const { o } = d;
  const pay = (t) => d.pays.find((p) => p.pay_type === t);
  const lastAsg = d.asg[d.asg.length - 1];
  const sched = d.ap.find((a) => a.status === "scheduled");
  const lastAcc = d.ac[d.ac.length - 1];
  const failedQc = (() => { const r = Math.max(0, ...d.qc.map((x) => x.round_no)); return d.qc.filter((x) => x.round_no === r && !x.passed); })();
  const canCancel = [0, 1, 2, 3].includes(o.status);

  /* ----- next-action panel ----- */
  const btn = (act, label, cls = "") => `<button class="btn ${cls}" data-act="${act}">${label}</button>`;
  const payBtns = (p) => `<div class="row">${p.slip_path ? btn("slip:" + p.payment_id, "View slip", "ghost") : "<span class='pill'>Paid in cash, no slip</span>"}${btn("ok:" + p.payment_id, "Approve", "green")}${btn("no:" + p.payment_id, "Reject", "red")}</div>`;
  let panel = "";
  switch (o.status) {
    case 0: panel = `<p>Review the order details, then issue a quote</p>${btn("quote", "Issue quote")}`; break;
    case 1: { const p = pay("deposit");
      panel = p ? `<p>The customer sent a deposit slip for ${baht(p.amount)} THB. Please verify it.</p>${payBtns(p)}` : `<p class="muted">Waiting for the customer to accept the quote and pay the deposit (quote valid until ${dateTH(d.quote?.valid_until)})</p>`; break; }
    case 2: panel = `<p>Deposit verified. Send the production order to a factory.</p>${btn("send", "Send production order")}`; break;
    case 3:
      if (lastAsg?.response === "pending") panel = `<p>Waiting for <b>${esc(lastAsg.factories?.name)}</b> to reply (sent ${dateTH(lastAsg.sent_at, true)}). Record the reply on the factory's behalf.</p><div class="row">${btn("accept", "Factory accepted", "green")}${btn("reject", "Factory declined", "red")}</div>`;
      else if (lastAsg?.response === "rejected") panel = `<p><b>${esc(lastAsg.factories?.name)}</b> declined: ${esc(lastAsg.reject_reason)}. Choose another factory.</p>${btn("send", "Choose another factory")}`;
      else panel = `<p><b>${esc(lastAsg?.factories?.name)}</b> accepted. Start production and set an estimated finish date.</p>${btn("start", "Start production")}`;
      break;
    case 4: panel = `<p>In production · estimated finish ${dateTH(o.est_finish_date)}</p><div class="row">${btn("progress", "Update / report a delay", "ghost")}${btn("finish", "Finished", "green")}</div>`; break;
    case 5: panel = `<p>QC round ${Math.max(0, ...d.qc.map((x) => x.round_no)) + 1} (up to ${d.rules.max_qc_rounds} rounds before considering another factory)</p>${btn("qc", "Record QC result")}`; break;
    case 6: panel = `<p>QC failed: ${failedQc.map((x) => esc(x.qc_items?.item_name) + (x.note ? ` (${esc(x.note)})` : "")).join(", ")}</p>${btn("rework", "Factory fixed it, re-run QC", "green")}`; break;
    case 7: panel = `<p>QC passed. Arrange the install date with the customer and the factory.</p>${btn("schedule", "Schedule install")}`; break;
    case 8: panel = sched
      ? `<p>Install scheduled for <b>${dateTH(sched.install_datetime, true)}</b> (the factory does the installation)</p><div class="row">${btn("schedule", "Reschedule", "ghost")}${btn("installed", "Factory confirmed install done", "green")}</div>`
      : `<p class="err">The customer reported a problem after inspection: ${esc(lastAcc?.note ?? "-")}. Coordinate a fix with the factory, then set a new date.</p>${btn("schedule", "Schedule a new install date")}`; break;
    case 9: { const p = pay("final");
      panel = p ? `<p>The customer accepted the machine and sent a slip for the balance of ${baht(p.amount)} THB.</p>${payBtns(p)}` : `<p class="muted">Waiting for the customer to accept the machine and pay the balance.</p>`; break; }
    case 10: panel = `<p>✅ Completed · receipt <b class="mono">${esc(pay("final")?.receipt_no ?? "-")}</b></p>`; break;
    case 99: { const r = pay("refund");
      panel = `<p>Cancelled by ${esc({ customer: "the customer", shop: "the shop", system: "the system" }[o.cancelled_by] ?? "-")}: ${esc(o.cancel_reason)}</p>` +
        (r ? (r.verified ? `<p>The deposit has been transferred back.</p>` : `<p>Waiting to transfer back the deposit of ${baht(r.amount)} THB.</p><a class="btn" href="#/payments/refund">Go to Refund</a>`) : ""); break; }
  }
  if (canCancel) panel += `<div style="margin-top:12px">${btn("cancel", "Cancel order", "red sm")}</div>`;

  /* ----- actions ----- */
  const run = async (fn) => { try { await fn(); reload(); } catch (e) { toast(errText(e), true); } };
  const form = (title, body, ok, onOk, onOpen) => modal(title, body, { ok, onOk, onOpen }).then((done) => done && reload());
  const facOptions = d.facs.map((f) => `<option value="${f.factory_id}">${esc(f.name)}${d.asg.some((a) => a.factory_id === f.factory_id && a.response === "rejected") ? " (declined before)" : ""}</option>`).join("");
  const cancelForm = () => form("Cancel order", `<label>Reason</label><textarea id="r" rows="3"></textarea>${[2, 3].includes(o.status) ? `<p class="small">A verified deposit exists. A refund entry will be created.</p>` : ""}`, "Confirm cancel",
    (m) => rpc("staff_cancel_order", { p_order: o.order_id, p_reason: $("#r", m).value }, "Cancelled"));
  const dateInput = (min) => `<input id="dt" type="datetime-local" ${min ? `min="${min}"` : ""}>`;
  const actions = {
    quote: () => {
      const price = o.machine_models?.price ?? "";
      let rowsHtml = (desc, amt) => `<div class="it"><input class="ds" placeholder="Item" value="${esc(desc)}"><input class="am" type="number" min="0" step="0.01" placeholder="Price" value="${esc(amt)}"><button type="button" class="btn sm red x">×</button></div>`;
      form("Issue quote", `<div class="items" id="its">${rowsHtml(`${o.machine_models?.name ?? o.machine_type} · ${o.capacity}`, price)}</div>
        <button type="button" class="btn sm ghost" id="add" style="margin-top:8px">+ Add item</button>
        <div class="grid cols3" style="margin-top:12px;gap:8px"><div><label>VAT %</label><input id="vat" type="number" value="7"></div><div><label>Deposit %</label><input id="dep" type="number" value="${d.rules.deposit_percent}"></div><div><label>Valid (days)</label><input id="days" type="number" value="${d.rules.quote_valid_days}"></div></div>
        <div class="sum" id="sum" style="margin-top:12px"></div>`, "Issue quote",
        (m) => {
          const items = $$(".it", m).map((r) => ({ description: $(".ds", r).value.trim(), amount: Number($(".am", r).value) })).filter((i) => i.description && i.amount > 0);
          return rpc("staff_create_quote", { p_order: o.order_id, p_items: items, p_vat_percent: Number($("#vat", m).value), p_deposit_percent: Number($("#dep", m).value), p_valid_days: Number($("#days", m).value) }, "Quote issued");
        },
        (m) => {
          const calc = () => {
            const sub = $$(".am", m).reduce((s, i) => s + (Number(i.value) || 0), 0), vat = sub * (Number($("#vat", m).value) || 0) / 100;
            $("#sum", m).innerHTML = `Subtotal ${baht(sub)} · VAT ${baht(vat)}<br><b>Total ${baht(sub + vat)}</b> · deposit ${baht((sub + vat) * (Number($("#dep", m).value) || 0) / 100)}`;
          };
          m.addEventListener("input", calc);
          m.addEventListener("click", (e) => { if (e.target.classList.contains("x") && $$(".it", m).length > 1) { e.target.closest(".it").remove(); calc(); } });
          $("#add", m).onclick = () => { $("#its", m).insertAdjacentHTML("beforeend", rowsHtml("", "")); };
          calc();
        });
    },
    send: () => form(lastAsg?.response === "rejected" ? "Choose another factory" : "Send production order to a factory", `<label>Factory</label><select id="f">${facOptions}</select>`, "Send production order",
      (m) => rpc("staff_send_to_factory", { p_order: o.order_id, p_factory: Number($("#f", m).value) }, "Production order sent")),
    accept: () => run(() => rpc("staff_factory_response", { p_order: o.order_id, p_accept: true }, "Recorded: the factory accepted")),
    reject: () => form("Factory declined", `<label>Reason</label><textarea id="r" rows="3"></textarea>`, "Save",
      (m) => rpc("staff_factory_response", { p_order: o.order_id, p_accept: false, p_reason: $("#r", m).value }, "Rejection recorded")),
    start: () => form("Start production", `<label>Estimated finish date</label><input id="e" type="date"><label style="margin-top:10px">Note</label><input id="n">`, "Start production",
      (m) => rpc("staff_production", { p_order: o.order_id, p_stage: "started", p_est: $("#e", m).value || null, p_note: $("#n", m).value || null }, "Production started. The customer was notified")),
    progress: () => form("Update production", `<label>Status</label><select id="s"><option value="in_progress">In production, on plan</option><option value="delayed">Delayed (notify the customer)</option></select>
      <label style="margin-top:10px">New estimated finish date</label><input id="e" type="date" value="${esc(o.est_finish_date ?? "")}"><label style="margin-top:10px">Note</label><input id="n">`, "Save",
      (m) => rpc("staff_production", { p_order: o.order_id, p_stage: $("#s", m).value, p_est: $("#e", m).value || null, p_note: $("#n", m).value || null }, "Updated")),
    finish: () => run(() => rpc("staff_production", { p_order: o.order_id, p_stage: "finished", p_est: null, p_note: null }, "Finished. Sent on to QC")),
    qc: () => form("Record QC result", d.items.map((i) => `<div style="margin-bottom:10px"><label>${esc(i.item_name)}</label><div class="row"><select class="ps" data-i="${i.item_id}" style="width:auto"><option value="1">Pass</option><option value="0">Fail</option></select><input class="nt" placeholder="What must be fixed (if failed)" style="flex:1"></div></div>`).join(""), "Record QC result",
      async (m) => {
        const res = $$(".ps", m).map((s) => ({ item_id: Number(s.dataset.i), passed: s.value === "1", note: s.closest(".row").querySelector(".nt").value || null }));
        if (res.some((r) => !r.passed && !r.note)) throw new Error("Please say what must be fixed for each failed item");
        const s = await rpc("staff_qc_submit", { p_order: o.order_id, p_results: res });
        toast(s === 7 ? "Passed every QC item" : "QC failed. Sent back to the factory to fix", s !== 7);
      }),
    rework: () => run(() => rpc("staff_rework_done", { p_order: o.order_id }, "Sent for QC again")),
    schedule: () => form(sched ? "Reschedule install" : "Schedule install", `<label>Date and time</label>${dateInput()}${sched ? `<label style="margin-top:10px">Reason for rescheduling</label><input id="r">` : ""}`, "Save appointment",
      (m) => { if (!$("#dt", m).value) throw new Error("Please choose a date and time"); return rpc("staff_schedule_install", { p_order: o.order_id, p_datetime: new Date($("#dt", m).value).toISOString(), p_reason: $("#r", m)?.value || null }, "Appointment saved. The customer was notified"); }),
    installed: () => run(() => rpc("staff_confirm_installed", { p_order: o.order_id }, "Recorded: install done. Waiting for the customer to inspect it")),
    cancel: cancelForm,
  };
  const handle = (key) => {
    const [act, arg] = key.split(":");
    if (act === "slip") return showSlip(d.pays.find((p) => String(p.payment_id) === arg)?.slip_path);
    if (act === "ok") return run(() => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: true }, "Approved"));
    if (act === "no") return form("Reject payment proof", `<label>Reason (the customer is notified)</label><textarea id="r" rows="3"></textarea>`, "Reject",
      (m) => rpc("staff_verify_payment", { p_payment: Number(arg), p_approve: false, p_reason: $("#r", m).value }, "Rejected. The customer was asked to send it again"));
    actions[act]?.();
  };
  return { panel, handle };
}
