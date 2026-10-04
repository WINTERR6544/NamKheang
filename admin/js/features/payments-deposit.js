// Sidebar: Payments > Deposit
route(/^\/payments\/deposit$/, (el) => paymentsPage(el, {
  type: "deposit", title: "Deposit", sub: "Check deposit slips",
  actions: verifyActions,
  onAct: (act, p, after) => verifyAct(act, p, after, "Deposit approved"),
}));
