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
  const list = (rows, f) => rows.length ? `<ul style="padding-left:18px;margin:0;font-size:.88rem">${rows.map((r) => `<li>${f(r)}</li>`).join("")}</ul>` : `<div class="muted small">None yet</div>`;
  // QC results grouped by stage and round: manufacturing QC and the factory's on-site QC after installation
  const rounds = [...new Map(d.qc.map((x) => [`${x.stage}:${x.round_no}`, { stage: x.stage, round: x.round_no }])).values()]
    .sort((a, b) => (a.stage === b.stage ? a.round - b.round : a.stage === "onsite" ? 1 : -1));
  el.innerHTML = `<div class="head"><div><a class="small" href="#/orders">← Orders</a><h1 class="mono">${esc(o.order_code)} ${pill(o.status)}</h1></div></div>
    <div class="grid cols2">
      ${card("Customer / details", `<dl class="kv"><dt>Customer</dt><dd>${esc(o.customers?.name)}</dd><dt>Contact</dt><dd>${esc(o.customers?.phone)} · ${esc(o.customers?.email)}</dd>
        <dt>Model</dt><dd>${esc(o.machine_models?.name ?? o.machine_type)} · ${esc(o.capacity)}</dd><dt>Install address</dt><dd>${esc(o.install_address)}</dd>
        <dt>Power / area</dt><dd>${esc(o.install_power ?? "-")} / ${esc(o.install_space ?? "-")}</dd><dt>Factory</dt><dd>${esc(o.factories?.name ?? "-")}</dd>
        <dt>Est. finish</dt><dd>${dateTH(o.est_finish_date)}</dd><dt>Ordered</dt><dd>${dateTH(o.created_at, true)}</dd></dl>`)}
      <div class="card next"><h2>Next step</h2><div id="panel">${panel}</div></div>
    </div>
    <div class="grid cols2" style="margin-top:18px">
      ${card("Quotation", Q ? `<table class="t"><tbody>${Q.quotation_items.map((i) => `<tr><td>${esc(i.description)}</td><td style="text-align:right">${baht(i.amount)}</td></tr>`).join("")}
        <tr><td>VAT</td><td style="text-align:right">${baht(Q.vat)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${baht(Q.total_price)}</b></td></tr>
        <tr><td>Deposit</td><td style="text-align:right">${baht(Q.deposit_amount)}</td></tr></tbody></table><div class="small muted">Valid until ${dateTH(Q.valid_until)} · ${esc(Q.status)}</div>` : `<div class="muted small">No quotation yet</div>`)}
      ${card("Payments", list(d.pays, (p) => `${esc({ deposit: "Deposit", final: "Final", refund: "Deposit refund" }[p.pay_type])} ${baht(p.amount)} — ${p.verified ? "verified" : "pending"}${p.receipt_no ? ` <span class="mono">${esc(p.receipt_no)}</span>` : ""} ${p.slip_path ? `<button class="btn sm ghost" data-act="slip:${p.payment_id}">Slip</button>` : ""}`))}
      ${card("Production order / factory", list(d.asg, (a) => `${esc(a.factories?.name)} — ${esc({ pending: "pending", accepted: "accepted", rejected: "declined" }[a.response])}${a.reject_reason ? `: ${esc(a.reject_reason)}` : ""} <span class="muted">(${dateTH(a.sent_at)})</span>`) +
        `<h2 style="margin-top:12px">Production</h2>` + list(d.prod, (u) => `${esc({ started: "Started", in_progress: "In progress", finished: "Finished", delayed: "Delayed" }[u.stage])}${u.est_finish_date ? ` · ETA ${dateTH(u.est_finish_date)}` : ""}${u.note ? ` · ${esc(u.note)}` : ""}`))}
      ${card("QC / install / acceptance", (rounds.length ? rounds.map((g) => { const rs = d.qc.filter((x) => x.stage === g.stage && x.round_no === g.round); return `<div class="small"><b>${g.stage === "onsite" ? "On-site QC (factory, after install)" : "QC (factory)"} round ${g.round}</b>: ${rs.map((x) => `${x.passed ? "✅" : "❌"} ${esc(x.qc_items?.item_name)}${x.note ? ` (${esc(x.note)})` : ""}`).join(" · ")}</div>`; }).join("") : `<div class="muted small">No QC results yet</div>`) +
        `<h2 style="margin-top:12px">Install appointments</h2>` + list(d.ap, (a) => `${dateTH(a.install_datetime, true)} — ${esc(a.status)}${a.reschedule_reason ? ` (${esc(a.reschedule_reason)})` : ""}`) +
        `<h2 style="margin-top:12px">Acceptance results</h2>` + list(d.ac, (c) => `${c.passed ? "✅ Passed" : "❌ Problem reported"}${c.note ? `: ${esc(c.note)}` : ""} <span class="muted">(${dateTH(c.checked_at, true)})</span>${!c.passed ? (c.forwarded_at ? ` <span class="pill ok">Sent to the factory ${dateTH(c.forwarded_at, true)}</span>` : ` <span class="pill warn">Not sent to the factory yet</span>`) : ""}`))}
      ${card("History / Timeline", `<ol class="tl">${d.logs.map((l) => `<li><span class="d"></span><div>${esc(STATUS[l.status])}<div class="small muted">${dateTH(l.changed_at, true)}</div></div></li>`).join("")}</ol>`)}
      ${card("Customer notifications", list(d.notes, (n) => `${esc(n.message)} <span class="muted">${dateTH(n.created_at, true)}</span>`))}
    </div>`;

  el.onclick = (e) => { const b = e.target.closest("[data-act]"); if (b) handle(b.dataset.act); };
});
