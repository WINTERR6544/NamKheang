// Sidebar: Admin > Customers (view only)
route(/^\/customers$/, async (el) => {
  const rows = await db.from("customers").select("customer_id, name, phone, email, created_at, orders(order_id, status, created_at)").order("created_at", { ascending: false }).limit(1000).then(must);
  const open = (c) => c.orders.filter((o) => o.status !== 10 && o.status !== 99).length;
  el.innerHTML = head("Customers", "Everyone who registered on the customer site") + `<div class="card"><h2>Customers (${rows.length})</h2>${table([
    { h: "Name", f: (c) => esc(c.name) }, { h: "Phone", f: (c) => esc(c.phone) }, { h: "Email", f: (c) => esc(c.email) },
    { h: "Orders", f: (c) => c.orders.length }, { h: "Open", f: (c) => open(c) }, { h: "Joined", f: (c) => dateTH(c.created_at) },
  ], rows)}</div>`;
});
