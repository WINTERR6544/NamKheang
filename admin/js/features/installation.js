// Sidebar: Installation (install dates, the factory's on-site QC, and the customer's acceptance results.
// A problem goes customer -> shop -> factory: the shop forwards it and books a fix visit from the order page)
route(/^\/installation$/, async (el) => {
  const [orders, ap, ac, qc, moves] = await Promise.all([fetchOrders([7, 8, 9]),
    db.from("install_reschedule_requests").select("request_id, order_id, proposed_datetime, reason, status, created_at, resolved_at, appointments(install_datetime), orders(order_code, customers(name))").order("created_at", { ascending: false }).limit(100).then(must),
    db.from("appointments").select("order_id, install_datetime, status, reschedule_count").order("created_at", { ascending: false }).then(must),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, forwarded_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(200).then(must),
    db.from("qc_results").select("order_id, round_no, passed").eq("stage", "onsite").order("checked_at", { ascending: false }).limit(500).then(must)]);
  const lastAp = new Map(), lastAc = new Map(), onsite = new Map(); // onsite: newest on-site QC round per order
  ap.forEach((a) => { if (!lastAp.has(a.order_id)) lastAp.set(a.order_id, a); });
  ac.forEach((a) => { if (!lastAc.has(a.order_id)) lastAc.set(a.order_id, a); });
  qc.forEach((r) => { const x = onsite.get(r.order_id); if (!x || r.round_no > x.round_no) onsite.set(r.order_id, { round_no: r.round_no, fail: 0 }); if (!r.passed && onsite.get(r.order_id).round_no === r.round_no) onsite.get(r.order_id).fail++; });
  const problem = (o) => o.status === 9 && lastAc.get(o.order_id) && !lastAc.get(o.order_id).passed;
  const need = (o) => o.status === 7 ? "Needs a date" : o.status === 8 && lastAp.get(o.order_id)?.status !== "scheduled" ? "Customer asked for a new date"
    : o.status === 8 ? "Awaiting install day / factory confirmation" : problem(o) ? (lastAc.get(o.order_id).forwarded_at ? "Problem sent to the factory: book a fix visit" : "Customer problem: contact the factory") : "Awaiting customer acceptance and payment";
  const pending = moves.filter((m) => m.status === "pending"), byId = new Map(pending.map((m) => [String(m.request_id), m]));
  const movesCard = `<div class="card"><h2>Reschedule requests from the factory (${pending.length} waiting)</h2>${table([
    { h: "Order", f: (m) => `<a class="mono" href="#/order/${m.order_id}"><b>${esc(m.orders?.order_code)}</b></a>` }, { h: "Customer", f: (m) => esc(m.orders?.customers?.name) },
    { h: "Booked date", f: (m) => m.appointments?.install_datetime ? dateTH(m.appointments.install_datetime, true) : "-" },
    { h: "Factory asks for", f: (m) => `<b>${dateTH(m.proposed_datetime, true)}</b>` }, { h: "Reason", f: (m) => esc(m.reason) },
    { h: "Status", f: (m) => m.status === "pending" ? `<span class="pill warn">Waiting for the shop</span>` : `<span class="pill ok">Answered ${dateTH(m.resolved_at, true)}</span>` },
    { h: "", f: (m) => m.status === "pending" ? `<button class="btn sm green" data-mv="book" data-r="${m.request_id}">Book this date</button> <a class="btn sm ghost" href="#/order/${m.order_id}">Another date</a>` : "" },
  ], moves.slice(0, 30))}</div>`;
  el.innerHTML = head("Installation", "Schedule install dates and fix visits. The factory installs and does the on-site QC; the customer then accepts or reports a problem to the shop") + movesCard + `<div class="card"><h2>Install jobs (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Status", f: (o) => pill(o.status) },
    { h: "Install date", f: (o) => { const a = lastAp.get(o.order_id); return a ? `${dateTH(a.install_datetime, true)}<div class="small muted">${esc(a.status)}${a.reschedule_count ? ` · rescheduled ${a.reschedule_count}×` : ""}</div>` : "-"; } },
    { h: "On-site QC (factory)", f: (o) => { const q = onsite.get(o.order_id); return q ? `Round ${q.round_no}: ${q.fail ? `<span class="pill bad">Failed ${q.fail}</span>` : `<span class="pill ok">Passed</span>`}` : `<span class="muted">-</span>`; } },
    { h: "To do", f: (o) => `<span class="pill ${need(o) === "Customer asked for a new date" || problem(o) ? "bad" : "warn"}">${need(o)}</span>` },
    { h: "Latest acceptance (customer)", f: (o) => { const c = lastAc.get(o.order_id); return c ? (c.passed ? `<span class="pill ok">Passed</span>` : `<span class="pill bad">Problem</span> ${esc(c.note)}`) : "-"; } },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">Manage</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>Customer Acceptance</h2>${table([
    { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "Customer", f: (a) => esc(a.orders?.customers?.name) },
    { h: "Result", f: (a) => a.passed ? `<span class="pill ok">Accepted</span>` : `<span class="pill bad">Problem reported</span>` },
    { h: "Problem reported", f: (a) => esc(a.note ?? "") },
    { h: "Sent to factory", f: (a) => a.passed ? "-" : a.forwarded_at ? `<span class="pill ok">${dateTH(a.forwarded_at, true)}</span>` : `<span class="pill warn">Not yet</span>` },
    { h: "When", f: (a) => dateTH(a.checked_at, true) },
  ], ac)}</div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-mv]"); if (!b) return;
    const m = byId.get(b.dataset.r); if (!m) return;
    b.disabled = true;
    try { await rpc("staff_schedule_install", { p_order: m.order_id, p_datetime: m.proposed_datetime, p_reason: `Factory request: ${m.reason}`.slice(0, 500) }, "Appointment saved. The customer and the factory were notified"); refreshCounts(); navigate(); }
    catch (er) { b.disabled = false; toast(errText(er), true); }
  };
});
