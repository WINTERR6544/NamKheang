// Sidebar: Orders > Quotations
route(/^\/orders\/quotations$/, async (el) => {
  const rows = must(await db.from("quotations").select("quotation_id, order_id, total_price, deposit_amount, valid_until, status, created_at, orders(order_code, status, customers(name))").order("created_at", { ascending: false }).limit(500));
  const today = new Date(new Date().toDateString());
  const st = (q) => q.status === "sent" && new Date(q.valid_until) < today ? `<span class="pill bad">Expired</span>` :
    ({ sent: `<span class="pill warn">Awaiting customer</span>`, accepted: `<span class="pill ok">Customer accepted</span>`, rejected: `<span class="pill bad">Rejected</span>`, expired: `<span class="pill bad">Expired</span>` })[q.status];
  el.innerHTML = head("Quotations", "Quotations issued") + `<div class="card">${table([
    { h: "Order", f: (q) => `<a class="mono" href="#/order/${q.order_id}"><b>${esc(q.orders?.order_code)}</b></a>` }, { h: "Customer", f: (q) => esc(q.orders?.customers?.name) },
    { h: "Total (THB)", f: (q) => baht(q.total_price) }, { h: "Deposit", f: (q) => baht(q.deposit_amount) },
    { h: "Valid until", f: (q) => dateTH(q.valid_until) }, { h: "Quote status", f: st }, { h: "Issued", f: (q) => dateTH(q.created_at) },
  ], rows, (q) => `#/order/${q.order_id}`)}</div>`;
});
