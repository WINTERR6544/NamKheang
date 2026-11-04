// Sidebar: Payments > Final Payment
route(/^\/payments\/final$/, (el) => paymentsPage(el, {
  type: "final", title: "ยอดคงเหลือ", sub: "ตรวจสลิปยอดคงเหลือและออกใบเสร็จ",
  actions: verifyActions,
  onAct: (act, p, after) => verifyAct(act, p, after, "อนุมัติแล้ว ออกใบเสร็จและปิดคำสั่งซื้อเรียบร้อย"),
}));
