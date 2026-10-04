// Sidebar: Payments > Refund
route(/^\/payments\/refund$/, (el) => paymentsPage(el, {
  type: "refund", title: "Refund", sub: "Return deposits to customers who cancelled",
  actions: (p) => `<button class="btn sm green" data-act="refund" data-p="${p.payment_id}">Refund</button>`,
  onAct: async (act, p, after) => {
    if (act !== "refund") return;
    if (await modal("Transfer deposit back", `<p>Refund <b>${baht(p.amount)} THB</b> to ${esc(p.orders?.customers?.name)}</p><label>Customer account</label><input id="a" value="${esc(p.refund_account ?? "")}"><label style="margin-top:10px">Refund transfer slip</label><input id="f" type="file" accept="image/*">`, { ok: "Confirm refunded",
      onOk: async (m) => {
        const f = $("#f", m).files[0]; if (!f) throw new Error("Please attach the refund transfer slip");
        const path = await uploadSlip(f, `refund-${p.payment_id}`);
        await rpc("staff_confirm_refund", { p_payment: p.payment_id, p_account: $("#a", m).value, p_slip: path }, "Refund recorded");
      } })) after();
  },
}));
