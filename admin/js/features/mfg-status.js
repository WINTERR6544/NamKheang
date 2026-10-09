// Sidebar: Manufacturing > Order Status (read-only: what the factory reported for each order sent to it)
route(/^\/mfg\/status$/, async (el) => {
  const [orders, ups, qc] = await Promise.all([fetchOrders([3, 4, 5, 6, 7, 8]),
    db.from("production_updates").select("order_id, stage, note, created_at").order("created_at", { ascending: false }).limit(1000).then(must),
    db.from("qc_results").select("order_id, round_no, passed, checked_at").order("checked_at", { ascending: false }).limit(1000).then(must)]);
  const lastUp = new Map(); ups.forEach((u) => { if (!lastUp.has(u.order_id)) lastUp.set(u.order_id, u); });
  const lastQc = new Map(); // newest round per order
  qc.forEach((r) => { const x = lastQc.get(r.order_id); if (!x || r.round_no > x.round_no) lastQc.set(r.order_id, { round_no: r.round_no, fail: 0, at: r.checked_at }); if (!r.passed && lastQc.get(r.order_id).round_no === r.round_no) lastQc.get(r.order_id).fail++; });
  const late = (o) => o.status === 4 && o.est_finish_date && new Date(o.est_finish_date) < new Date(new Date().toDateString());
  const stage = { started: "Started", in_progress: "In progress", finished: "Finished", delayed: "Delayed" };
  el.innerHTML = head("Order Status", "Status reported by the factory (view only)") + `<div class="card"><h2>Orders at the factory (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Factory", f: (o) => esc(o.factories?.name) }, { h: "Status", f: (o) => pill(o.status) },
    { h: "Est. finish", f: (o) => `${dateTH(o.est_finish_date)}${late(o) ? ` <span class="pill bad">Overdue</span>` : ""}` },
    { h: "Latest factory update", f: (o) => { const u = lastUp.get(o.order_id); return u ? `${esc(stage[u.stage])}${u.note ? ` · ${esc(u.note)}` : ""}<div class="small muted">${dateTH(u.created_at, true)}</div>` : `<span class="muted">-</span>`; } },
    { h: "QC", f: (o) => { const q = lastQc.get(o.order_id); return q ? `Round ${q.round_no}: ${q.fail ? `<span class="pill bad">Failed ${q.fail}</span>` : `<span class="pill ok">Passed</span>`}` : `<span class="muted">-</span>`; } },
  ], orders, goOrder)}</div>`;
});
