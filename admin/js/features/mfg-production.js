// Sidebar: Manufacturing > Production
route(/^\/mfg\/production$/, async (el) => {
  const [orders, ups] = await Promise.all([fetchOrders([3, 4]),
    db.from("production_updates").select("order_id, stage, est_finish_date, note, created_at, orders(order_code)").order("created_at", { ascending: false }).limit(50).then(must)]);
  const rows = orders.filter((o) => o.status === 4 || o.status === 3);
  const late = (o) => o.status === 4 && o.est_finish_date && new Date(o.est_finish_date) < new Date(new Date().toDateString());
  el.innerHTML = head("Production", "Track production and estimated finish dates") + `<div class="card"><h2>Production jobs (${rows.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "Status", f: (o) => o.status === 3 ? `<span class="pill warn">Waiting to start / for factory reply</span>` : `<span class="pill">In production</span>` },
    { h: "Est. finish", f: (o) => `${dateTH(o.est_finish_date)}${late(o) ? ` <span class="pill bad">Overdue</span>` : ""}` },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">Manage</a>` },
  ], rows, goOrder)}</div>
  <div class="card"><h2>Latest updates</h2>${table([
    { h: "Order", f: (u) => esc(u.orders?.order_code) }, { h: "Stage", f: (u) => esc({ started: "Started", in_progress: "In progress", finished: "Finished", delayed: "Delayed" }[u.stage]) },
    { h: "ETA", f: (u) => dateTH(u.est_finish_date) }, { h: "Note", f: (u) => esc(u.note ?? "") }, { h: "When", f: (u) => dateTH(u.created_at, true) },
  ], ups)}</div>`;
});
