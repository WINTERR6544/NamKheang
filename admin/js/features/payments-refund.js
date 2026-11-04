// Sidebar: Payments > Refund
route(/^\/payments\/refund$/, (el) => paymentsPage(el, {
  type: "refund", title: "คืนเงิน", sub: "คืนเงินมัดจำให้ลูกค้าที่ยกเลิกคำสั่งซื้อ",
  actions: (p) => `<button class="btn sm green" data-act="refund" data-p="${p.payment_id}">คืนเงิน</button>`,
  onAct: async (act, p, after) => {
    if (act !== "refund") return;
    if (await modal("โอนคืนเงินมัดจำ", `<p>คืนเงิน <b>${baht(p.amount)} บาท</b> ให้ ${esc(p.orders?.customers?.name)}</p><label>บัญชีลูกค้า</label><input id="a" value="${esc(p.refund_account ?? "")}"><label style="margin-top:10px">สลิปการโอนคืน</label><input id="f" type="file" accept="image/*">`, { ok: "ยืนยันว่าคืนเงินแล้ว",
      onOk: async (m) => {
        const f = $("#f", m).files[0]; if (!f) throw new Error("กรุณาแนบสลิปการโอนคืน");
        const path = await uploadSlip(f, `refund-${p.payment_id}`);
        await rpc("staff_confirm_refund", { p_payment: p.payment_id, p_account: $("#a", m).value, p_slip: path }, "บันทึกการคืนเงินแล้ว");
      } })) after();
  },
}));
