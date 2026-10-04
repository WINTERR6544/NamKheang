// Order popup: a side panel with the order summary and the shop's next step.
// Opened by clicking any order row, card or link (see the click handler in core.js). Ctrl/Cmd-click opens the full page.
(function () {
  const css = `
  #op-bd { position: fixed; inset: 0; background: rgba(8, 20, 20, .35); z-index: 40; }
  #op { position: fixed; top: 0; right: 0; bottom: 0; width: min(410px, 100vw); background: #fff; z-index: 41; border-left: 1px solid var(--line);
        padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; box-shadow: -8px 0 24px rgba(0, 0, 0, .12); }
  #op .op-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  #op .op-x { border: 0; background: transparent; font-size: 26px; line-height: 1; cursor: pointer; color: var(--muted); }
  #op .op-code { font-size: 1.25rem; font-weight: 700; margin-bottom: 4px; }
  #op .card.next { padding: 14px; box-shadow: none; }
  #op .card.next p { margin: 4px 0 10px; }
  #op details { font-size: .88rem; }
  #op summary { cursor: pointer; font-weight: 600; padding: 4px 0; }
  #op details h2 { margin: 12px 0 4px; font-size: .85rem; }
  #op details ul { margin: 0; padding-left: 18px; }`;

  const close = () => { document.getElementById("op")?.remove(); document.getElementById("op-bd")?.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape" && !document.querySelector(".ov")) close(); };

  // the next order that needs the shop, after this one (oldest first, wrapping round)
  async function nextTask(cur) {
    const [orders, pays] = await Promise.all([fetchOrders(null), db.from("payments").select("order_id, pay_type").eq("verified", false).then(must)]);
    const pending = (type) => new Set(pays.filter((p) => p.pay_type === type).map((p) => p.order_id));
    const dep = pending("deposit"), fin = pending("final"), ref = pending("refund");
    const needs = (o) => (o.status === 1 ? dep.has(o.order_id) : o.status === 9 ? fin.has(o.order_id) : o.status === 99 ? ref.has(o.order_id) : o.status !== 10);
    const list = orders.slice().reverse();
    const i = list.findIndex((o) => o.order_id === cur);
    const rotated = [...list.slice(i + 1), ...list.slice(0, Math.max(i, 0))];
    return rotated.find(needs)?.order_id ?? null;
  }

  const details = (d) => {
    const { o, quote: Q } = d, li = (rows, f) => rows.length ? `<ul>${rows.map((r) => `<li>${f(r)}</li>`).join("")}</ul>` : `<div class="muted small">None yet</div>`;
    return `<h2>Contact</h2><div>${esc(o.customers?.phone)} · ${esc(o.customers?.email)}</div>
      <h2>Install</h2><div>${esc(o.install_address)}<br><span class="muted">${esc(o.install_power ?? "-")} · ${esc(o.install_space ?? "-")}</span></div>
      <h2>Quotation</h2>${Q ? `<div>Total ${baht(Q.total_price)} · deposit ${baht(Q.deposit_amount)}<br><span class="muted">Valid until ${dateTH(Q.valid_until)}</span></div>` : `<div class="muted small">No quotation yet</div>`}
      <h2>Payments</h2>${li(d.pays, (p) => `${esc({ deposit: "Deposit", final: "Final", refund: "Refund" }[p.pay_type])} ${baht(p.amount)} · ${p.verified ? "verified" : "pending"}`)}
      <h2>History</h2>${li(d.logs, (l) => `${esc(STATUS[l.status])} <span class="muted">${dateTH(l.changed_at, true)}</span>`)}`;
  };

  window.openOrderPopup = async function openOrderPopup(id) {
    if (!document.getElementById("op-css")) { const s = document.createElement("style"); s.id = "op-css"; s.textContent = css; document.head.append(s); }
    await loadFeature("order-actions");
    if (!document.getElementById("op-bd")) {
      const bd = document.createElement("div"); bd.id = "op-bd"; bd.onclick = close; document.body.append(bd);
      const p = document.createElement("div"); p.id = "op"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "Order details"); document.body.append(p);
      document.addEventListener("keydown", onKey);
    }
    const panel = document.getElementById("op");
    panel.innerHTML = `<p class="muted">Loading...</p>`;
    let d;
    try { d = await loadOrder(id); } catch (e) { toast(errText(e), true); return close(); }
    const reload = () => { refreshCounts(); openOrderPopup(id); navigate(); };
    const { panel: next, handle } = orderNext(d, reload);
    const { o, quote: Q } = d;
    panel.innerHTML = `<div class="op-h"><div><div class="op-code mono">${esc(o.order_code)}</div>${pill(o.status)}</div><button class="op-x" aria-label="Close">&times;</button></div>
      <dl class="kv"><dt>Customer</dt><dd>${esc(o.customers?.name)}</dd><dt>Model</dt><dd>${esc(o.machine_models?.name ?? o.machine_type)} · ${esc(o.capacity)}</dd>
        <dt>Total</dt><dd>${Q ? baht(Q.total_price) + " THB" : "—"}</dd><dt>Factory</dt><dd>${esc(o.factories?.name ?? "-")}</dd></dl>
      <div class="card next"><h2>Next step</h2><div>${next}</div></div>
      <div class="row"><button class="btn ghost" id="op-nx">Next task →</button><a class="btn ghost" data-full href="#/order/${o.order_id}">Open full page</a></div>
      <details><summary>Details and history</summary>${details(d)}</details>`;
    $(".op-x", panel).onclick = close;
    $(".op-x", panel).focus();
    $(".next", panel).onclick = (e) => { const b = e.target.closest("[data-act]"); if (b) handle(b.dataset.act); };
    $("#op-nx", panel).onclick = async () => {
      const n = await nextTask(id).catch(() => null);
      if (n) openOrderPopup(n); else toast("Nothing else needs you");
    };
    $("a[data-full]", panel).addEventListener("click", close);
  };
})();
