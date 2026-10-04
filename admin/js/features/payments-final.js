// Sidebar: Payments > Final Payment
route(/^\/payments\/final$/, (el) => paymentsPage(el, {
  type: "final", title: "Final Payment", sub: "Check final payment and issue receipt",
  actions: verifyActions,
  onAct: (act, p, after) => verifyAct(act, p, after, "Approved. Receipt issued, order completed"),
}));
