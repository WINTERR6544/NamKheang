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
  const sendCols = [...ORDER_COLS.slice(0, 2), { h: "Note", f: (o) => o.status === 3 ? `<span class="pill bad">${esc(latest.get(o.order_id).factories?.name)} declined: ${esc(latest.get(o.order_id).reject_reason)}</span>` : "Deposit paid" },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 3 ? "Choose another factory" : "Send to factory"}</a>` }];
  const waitCols = [...ORDER_COLS.slice(0, 2), { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "Sent", f: (o) => `${dateTH(o.sent_at, true)}${daysAgo(o.sent_at) > 3 ? ` <span class="pill bad">over 3 days</span>` : ""}` },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">View</a>` }];
  el.innerHTML = head("Factory Requests", "Send production orders and record the factory's reply (the factory replies in its own portal)") +
    `<div class="card"><h2>To send / needs another factory (${toSend.length})</h2>${table(sendCols, toSend, goOrder)}</div>
     <div class="card"><h2>Waiting for factory reply (${waiting.length})</h2>${table(waitCols, waiting)}</div>
     <div class="card"><h2>Production order history</h2>${table([
       { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "Factory", f: (a) => esc(a.factories?.name) },
       { h: "Sent", f: (a) => dateTH(a.sent_at, true) },
       { h: "Result", f: (a) => ({ pending: `<span class="pill warn">Pending</span>`, accepted: `<span class="pill ok">Accepted</span>`, rejected: `<span class="pill bad">Rejected</span>` })[a.response] },
       { h: "Reason / replied", f: (a) => `${esc(a.reject_reason ?? "")}<div class="small muted">${dateTH(a.responded_at, true)}</div>` },
     ], asg)}</div>`;
});
