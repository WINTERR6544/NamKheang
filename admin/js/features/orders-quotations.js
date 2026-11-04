// Sidebar: Orders > Quotations
route(/^\/orders\/quotations$/, async (el) => {
  const rows = must(await db.from("quotations").select("quotation_id, order_id, total_price, deposit_amount, valid_until, status, created_at, orders(order_code, status, customers(name))").order("created_at", { ascending: false }).limit(500));
  const today = new Date(new Date().toDateString());
  const st = (q) => q.status === "sent" && new Date(q.valid_until) < today ? `<span class="pill bad">หมดอายุ</span>` :
    ({ sent: `<span class="pill warn">รอลูกค้ายืนยัน</span>`, accepted: `<span class="pill ok">ลูกค้ายอมรับแล้ว</span>`, rejected: `<span class="pill bad">ลูกค้าปฏิเสธ</span>`, expired: `<span class="pill bad">หมดอายุ</span>` })[q.status];
  el.innerHTML = head("ใบเสนอราคา", "ใบเสนอราคาที่ออกให้ลูกค้า") + `<div class="card">${table([
    { h: "คำสั่งซื้อ", f: (q) => `<a class="mono" href="#/order/${q.order_id}"><b>${esc(q.orders?.order_code)}</b></a>` }, { h: "ลูกค้า", f: (q) => esc(q.orders?.customers?.name) },
    { h: "ยอดรวม (บาท)", f: (q) => baht(q.total_price) }, { h: "มัดจำ", f: (q) => baht(q.deposit_amount) },
    { h: "ใช้ได้ถึง", f: (q) => dateTH(q.valid_until) }, { h: "สถานะใบเสนอราคา", f: st }, { h: "วันที่ออก", f: (q) => dateTH(q.created_at) },
  ], rows, (q) => `#/order/${q.order_id}`)}</div>`;
});
