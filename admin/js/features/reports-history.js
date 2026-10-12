// Sidebar: Admin > Reports / History (order status history, view only)
route(/^\/history$/, async (el) => {
  const rows = await db.from("order_status_logs").select("order_id, status, note, changed_at, orders(order_code, customers(name)), users(name)").order("changed_at", { ascending: false }).limit(300).then(must);
  el.innerHTML = head("Reports / History", "Latest 300 order status changes") + `<div class="card">${table([
    { h: "When", f: (l) => dateTH(l.changed_at, true) },
    { h: "Order", f: (l) => `<a class="mono" href="#/order/${l.order_id}">${esc(l.orders?.order_code)}</a>` },
    { h: "Customer", f: (l) => esc(l.orders?.customers?.name ?? "-") },
    { h: "Status", f: (l) => pill(l.status) }, { h: "By", f: (l) => esc(l.users?.name ?? "System") }, { h: "Note", f: (l) => esc(l.note ?? "") },
  ], rows)}</div>`;
});
