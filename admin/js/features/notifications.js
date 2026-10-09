// Sidebar: Admin > Notifications (messages the system sent to the shop, e.g. factory replies; view only)
route(/^\/notifications$/, async (el) => {
  const rows = await db.from("notifications").select("order_id, message, created_at, orders(order_code, customers(name))")
    .eq("recipient_type", "shop").order("created_at", { ascending: false }).limit(200).then(must);
  el.innerHTML = head("Notifications", "Latest 200 messages for the shop") + `<div class="card">${table([
    { h: "When", f: (n) => dateTH(n.created_at, true) },
    { h: "Order", f: (n) => n.orders ? `<a class="mono" href="#/order/${n.order_id}">${esc(n.orders.order_code)}</a>` : "-" },
    { h: "Customer", f: (n) => esc(n.orders?.customers?.name ?? "-") },
    { h: "Message", f: (n) => esc(n.message) },
  ], rows)}</div>`;
});
