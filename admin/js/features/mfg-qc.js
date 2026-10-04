// Sidebar: Manufacturing > QC
route(/^\/mfg\/qc$/, async (el) => {
  const [orders, res] = await Promise.all([fetchOrders([5, 6]),
    db.from("qc_results").select("order_id, round_no, passed, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(1000).then(must)]);
  const g = new Map();
  res.forEach((r) => { const k = r.order_id + "-" + r.round_no; const x = g.get(k) ?? { ...r, pass: 0, fail: 0 }; r.passed ? x.pass++ : x.fail++; g.set(k, x); });
  el.innerHTML = head("QC", "Quality check before the install date") + `<div class="card"><h2>Awaiting QC / fixes (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Status", f: (o) => pill(o.status) }, { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 5 ? "Run QC" : "View results"}</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>QC history</h2>${table([
    { h: "Order", f: (r) => `<a class="mono" href="#/order/${r.order_id}">${esc(r.orders?.order_code)}</a>` }, { h: "Customer", f: (r) => esc(r.orders?.customers?.name) },
    { h: "Round", f: (r) => r.round_no }, { h: "Result", f: (r) => r.fail ? `<span class="pill bad">Failed ${r.fail} items</span>` : `<span class="pill ok">All passed</span>` },
    { h: "Checked", f: (r) => dateTH(r.checked_at, true) },
  ], [...g.values()])}</div>`;
});
