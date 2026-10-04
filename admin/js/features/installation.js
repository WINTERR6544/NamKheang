// Sidebar: Installation (install dates + customer acceptance results)
route(/^\/installation$/, async (el) => {
  const [orders, ap, ac] = await Promise.all([fetchOrders([7, 8, 9]),
    db.from("appointments").select("order_id, install_datetime, status, reschedule_count").order("created_at", { ascending: false }).then(must),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(200).then(must)]);
  const lastAp = new Map(), lastAc = new Map();
  ap.forEach((a) => { if (!lastAp.has(a.order_id)) lastAp.set(a.order_id, a); });
  ac.forEach((a) => { if (!lastAc.has(a.order_id)) lastAc.set(a.order_id, a); });
  const need = (o) => o.status === 7 ? "Needs a date" : o.status === 8 && lastAp.get(o.order_id)?.status !== "scheduled" ? "Customer asked for a new date" : o.status === 8 ? "Awaiting install day / confirmation" : "Awaiting customer acceptance and payment";
  el.innerHTML = head("Installation", "Schedule install dates, reschedule, and see the customer's acceptance results (the factory does the installation)") + `<div class="card"><h2>Install jobs (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Status", f: (o) => pill(o.status) },
    { h: "Install date", f: (o) => { const a = lastAp.get(o.order_id); return a ? `${dateTH(a.install_datetime, true)}<div class="small muted">${esc(a.status)}${a.reschedule_count ? ` · rescheduled ${a.reschedule_count}×` : ""}</div>` : "-"; } },
    { h: "To do", f: (o) => `<span class="pill ${need(o) === "Customer asked for a new date" ? "bad" : "warn"}">${need(o)}</span>` },
    { h: "Latest acceptance", f: (o) => { const c = lastAc.get(o.order_id); return c ? (c.passed ? `<span class="pill ok">Passed</span>` : `<span class="pill bad">Failed</span> ${esc(c.note)}`) : "-"; } },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">Manage</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>Customer Acceptance</h2>${table([
    { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "Customer", f: (a) => esc(a.orders?.customers?.name) },
    { h: "Result", f: (a) => a.passed ? `<span class="pill ok">Accepted</span>` : `<span class="pill bad">Problem reported</span>` },
    { h: "Problem reported", f: (a) => esc(a.note ?? "") }, { h: "When", f: (a) => dateTH(a.checked_at, true) },
  ], ac)}</div>`;
});
