// Sidebar: Payments > Deposit
route(/^\/payments\/deposit$/, (el) => paymentsPage(el, {
  type: "deposit", title: "มัดจำ", sub: "ตรวจสลิปการชำระมัดจำ",
  actions: verifyActions,
  onAct: (act, p, after) => verifyAct(act, p, after, "อนุมัติมัดจำแล้ว"),
}));
