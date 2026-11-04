// Sidebar: Admin > Customers (view only)
route(/^\/customers$/, async (el) => {
  const rows = await db.from("customers").select("customer_id, name, phone, email, created_at, orders(order_id, status, created_at)").order("created_at", { ascending: false }).limit(1000).then(must);
  const open = (c) => c.orders.filter((o) => o.status !== 10 && o.status !== 99).length;
  el.innerHTML = head("ลูกค้า", "ลูกค้าทุกคนที่สมัครสมาชิกในเว็บไซต์") + `<div class="card"><h2>ลูกค้า (${rows.length})</h2>${table([
    { h: "ชื่อ", f: (c) => esc(c.name) }, { h: "เบอร์โทร", f: (c) => esc(c.phone) }, { h: "อีเมล", f: (c) => esc(c.email) },
    { h: "คำสั่งซื้อ", f: (c) => c.orders.length }, { h: "กำลังดำเนินการ", f: (c) => open(c) }, { h: "วันที่สมัคร", f: (c) => dateTH(c.created_at) },
  ], rows)}</div>`;
});
